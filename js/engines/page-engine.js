// ============================================
// page-engine.js — 頁面引擎（v103.0.17）
// 位置：js/engines/page-engine.js
// ============================================
// v103.0.17 修正：
//   ✅ 新增 ctx.onDataChange(fn) 統一通知機制
//   ✅ 廢除猴子補丁（不再覆寫 ctx.invalidate）
// ============================================

import { subscribe, makeReactive, getNestedValue } from './data-engine.js';
import { mountBlock, collectBlockDeps } from './render-engine.js';
import { AppState } from '../core/state.js';

/* ============================================
   錯誤橫幅
   ============================================ */
function _showError(msg) {
  try {
    let b = document.getElementById('__page_engine_error__');
    if (!b) {
      b = document.createElement('div');
      b.id = '__page_engine_error__';
      b.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#F43F5E;color:#fff;padding:12px 16px;font-size:13px;font-family:monospace;z-index:99999;white-space:pre-wrap;max-height:50vh;overflow-y:auto;';
      document.body.appendChild(b);
    }
    b.textContent += `[page-engine] ${msg}\n`;
  } catch (e) {}
}

function _hideError() {
  const b = document.getElementById('__page_engine_error__');
  if (b) b.remove();
}

/* ============================================
   主入口
   ============================================ */
export async function createPage(schema) {
  if (!schema || typeof schema !== 'object') throw new Error('[page-engine] schema 為必填');
  _hideError();

  const ctx = {
    meta: { title: schema.title || '' },
    state: {}, data: {}, derived: {},
    _unsubs: [], _blockInstances: [], _dependents: {}, _stateUnsubs: [],
    _dataChangeCallbacks: [],
    _customMountInstance: null,
    invalidate: (key) => _onKeyChange(ctx, schema, key),
    setState: (keyPath, value) => _setState(ctx, keyPath, value),

    /* 🆕 統一資料變更通知（取代猴子補丁） */
    onDataChange: (fn) => {
      if (typeof fn !== 'function') return () => {};
      ctx._dataChangeCallbacks.push(fn);
      return () => {
        ctx._dataChangeCallbacks = ctx._dataChangeCallbacks.filter((f) => f !== fn);
      };
    },
  };

  try {
    ctx.state = makeReactive({ ...(schema.state || {}) }, (keyPath) => _onStateChange(ctx, schema, keyPath));
  } catch (err) { _showError('makeReactive 失敗：' + err.message); }

  _buildDependencyGraph(ctx, schema);
  _subscribeAllData(ctx, schema);
  _bindAppStateEvents(ctx, schema);
  _computeAllDerived(ctx, schema);

  try { await _mountAllBlocks(ctx, schema); } catch (err) { _showError('mount 失敗：' + err.message); }

  if (typeof schema.customMount === 'function') {
    try { ctx._customMountInstance = await schema.customMount(ctx); } catch (err) { _showError('customMount 失敗：' + err.message); }
  }

  return { ctx, destroy: () => _destroy(ctx), ready: Promise.resolve() };
}

/* ============================================
   1. 依賴圖
   ============================================ */
function _buildDependencyGraph(ctx, schema) {
  ctx._dependents = {};
  const add = (d, n) => {
    if (!ctx._dependents[d]) ctx._dependents[d] = [];
    if (!ctx._dependents[d].includes(n)) ctx._dependents[d].push(n);
  };
  Object.entries(schema.derived || {}).forEach(([n, c]) => (c.deps || []).forEach((d) => add(d, n)));
}

/* ============================================
   2. data 訂閱
   ============================================ */
function _subscribeAllData(ctx, schema) {
  Object.entries(schema.data || {}).forEach(([key, cfg]) => {
    try {
      const unsub = subscribe(cfg, ({ data, error }) => {
        if (error) { console.warn(`[page-engine] data.${key} 錯誤：`, error); return; }
        ctx.data[key] = data;
        _onKeyChange(ctx, schema, 'data.' + key);
      });
      ctx._unsubs.push(unsub);
    } catch (err) { _showError(`訂閱 data.${key} 失敗：${err.message}`); }
  });
}

/* ============================================
   3. AppState 事件
   ============================================ */
function _bindAppStateEvents(ctx, schema) {
  const handle = () => {
    _resubscribeDataWithParams(ctx, schema);
    _computeAllDerived(ctx, schema);
    _notifyAllBlocks(ctx);
    _notifyDataChangeCallbacks(ctx, '__APP__');
  };
  try {
    ctx._stateUnsubs.push(AppState.on('ym-change', handle));
    ctx._stateUnsubs.push(AppState.on('family-change', handle));
  } catch (err) { /* noop */ }
}

function _resubscribeDataWithParams(ctx, schema) {
  const hasParam = Object.values(schema.data || {}).some((c) => /\{\w+\}/.test(c.path || ''));
  if (!hasParam) return;
  ctx._unsubs.forEach((u) => { try { u(); } catch (e) {} });
  ctx._unsubs = [];
  _subscribeAllData(ctx, schema);
}

/* ============================================
   4. 變更
   ============================================ */
function _onStateChange(ctx, schema, keyPath) {
  _onKeyChange(ctx, schema, `state.${keyPath}`);
}

function _onKeyChange(ctx, schema, changedKey) {
  const dirty = new Set();
  _markDirty(ctx, changedKey, dirty);
  if (dirty.size > 0) _recomputeDerivedSubset(ctx, schema, dirty);
  _notifyBlocksForChangedKeys(ctx, changedKey, dirty);
  _notifyDataChangeCallbacks(ctx, changedKey);
}

/* ============================================
   5. 通知
   ============================================ */
function _notifyDataChangeCallbacks(ctx, changedKey) {
  ctx._dataChangeCallbacks.forEach((fn) => {
    try { fn(changedKey); } catch (err) {
      console.error('[page-engine] onDataChange 失敗：', err);
    }
  });
}

function _notifyAllBlocks(ctx) {
  ctx._blockInstances.forEach(({ instance }) => {
    try { instance.onDepsChange?.(); } catch (e) {}
  });
}

function _notifyBlocksForChangedKeys(ctx, changedKey, dirtySet) {
  const affected = new Set(dirtySet);
  affected.add(changedKey);
  ctx._blockInstances.forEach(({ instance, deps }) => {
    const should = _hasAny(deps.derived, affected) ||
      (changedKey.startsWith('state.') && _hasAny(deps.state, affected));
    if (should && instance.onDepsChange) {
      try { instance.onDepsChange(); } catch (e) {}
    }
  });
}

function _hasAny(set, keys) {
  if (!set || set.size === 0) return false;
  for (const k of keys) if (set.has(k)) return true;
  return false;
}

/* ============================================
   6. derived
   ============================================ */
function _markDirty(ctx, key, dirtySet) {
  if (dirtySet.has(key)) return;
  dirtySet.add(key);
  (ctx._dependents[key] || []).forEach((d) => _markDirty(ctx, d, dirtySet));
}

function _computeAllDerived(ctx, schema) {
  const def = schema.derived || {};
  _topoSort(Object.keys(def), def).forEach((n) => _computeOne(ctx, schema, n, def[n]));
}

function _recomputeDerivedSubset(ctx, schema, dirtySet) {
  const def = schema.derived || {};
  _topoSort(Object.keys(def), def).forEach((n) => {
    if (dirtySet.has(n)) _computeOne(ctx, schema, n, def[n]);
  });
}

function _computeOne(ctx, schema, name, cfg) {
  const deps = cfg.deps || [];
  const def = schema.derived || {};
  try {
    const args = deps.map((d) => _resolveDep(ctx, d));
    const hasUndef = deps.some((d, i) => {
      if (d.startsWith('data.')) return args[i] === undefined;
      if (d in def) return args[i] === undefined;
      return false;
    });
    if (hasUndef) { ctx.derived[name] = undefined; return; }
    ctx.derived[name] = cfg.compute(...args);
  } catch (err) {
    console.error(`[page-engine] derived.${name} 失敗：`, err);
    ctx.derived[name] = undefined;
  }
}

function _resolveDep(ctx, dep) {
  if (!dep) return undefined;
  if (dep.startsWith('state.')) return getNestedValue(ctx.state, dep.slice(6));
  if (dep.startsWith('data.')) return getNestedValue(ctx.data, dep.slice(5));
  if (dep in ctx.derived) return ctx.derived[dep];
  if (dep in ctx.data) return ctx.data[dep];
  return undefined;
}

function _topoSort(names, defs) {
  const visited = new Set(), result = [];
  const visit = (n, stack) => {
    if (visited.has(n)) return;
    if (stack.has(n)) return;
    stack.add(n);
    ((defs[n] || {}).deps || []).forEach((d) => { if (d in defs) visit(d, stack); });
    stack.delete(n);
    visited.add(n);
    result.push(n);
  };
  names.forEach((n) => visit(n, new Set()));
  return result;
}

/* ============================================
   7. Blocks
   ============================================ */
async function _mountAllBlocks(ctx, schema) {
  for (const block of (schema.blocks || [])) {
    const inst = await mountBlock(block, ctx);
    if (!inst) { _showError(`block "${block.type}" 失敗`); continue; }
    ctx._blockInstances.push({ block, instance: inst, deps: collectBlockDeps(block) });
  }
}

/* ============================================
   8. state 設值
   ============================================ */
function _setState(ctx, keyPath, value) {
  if (!keyPath) return;
  const keys = String(keyPath).split('.');
  const last = keys.pop();
  const target = keys.reduce((acc, k) => {
    if (acc[k] == null || typeof acc[k] !== 'object') acc[k] = {};
    return acc[k];
  }, ctx.state);
  target[last] = value;
}

/* ============================================
   9. 銷毀
   ============================================ */
function _destroy(ctx) {
  if (ctx._customMountInstance?.destroy) {
    try { ctx._customMountInstance.destroy(); } catch (e) {}
  }
  ctx._blockInstances.forEach(({ instance }) => {
    try { instance.destroy?.(); } catch (e) {}
  });
  ctx._unsubs.forEach((u) => { try { u(); } catch (e) {} });
  ctx._stateUnsubs.forEach((u) => { try { u(); } catch (e) {} });
  ctx._blockInstances = [];
  ctx._unsubs = [];
  ctx._stateUnsubs = [];
  ctx._dataChangeCallbacks = [];
  ctx.data = {};
  ctx.derived = {};
  ctx._dependents = {};
}