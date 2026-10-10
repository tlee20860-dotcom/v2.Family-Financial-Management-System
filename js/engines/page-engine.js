// ============================================
// page-engine.js — 頁面引擎（v103.0.15）
// 位置：js/engines/page-engine.js
// ============================================
// v103.0.15 修正：
//   ✅ [P17-03] 新增 schema.onYearMonthChange hook
//   ✅ 保留 v103.0.11 全部修正
// ============================================

import { subscribe, makeReactive, getNestedValue } from './data-engine.js';
import { mountBlock, collectBlockDeps } from './render-engine.js';
import { AppState } from '../core/state.js';

/* ============================================
   錯誤橫幅
   ============================================ */
function _showError(msg) {
  try {
    let banner = document.getElementById('__page_engine_error__');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = '__page_engine_error__';
      banner.style.cssText = `position:fixed;top:0;left:0;right:0;background:#F43F5E;color:#fff;padding:12px 16px;font-size:13px;font-family:monospace;z-index:99999;white-space:pre-wrap;max-height:50vh;overflow-y:auto;box-shadow:0 4px 20px rgba(0,0,0,0.5);`;
      document.body.appendChild(banner);
    }
    banner.textContent += `[page-engine] ${msg}\n`;
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
  if (!schema || typeof schema !== 'object') {
    _showError('schema 為必填');
    throw new Error('[page-engine] schema 為必填');
  }

  _hideError();
  console.log('[page-engine] createPage 開始：', schema.title || '(無標題)');

  const ctx = {
    meta: { title: schema.title || '' },
    state: {}, data: {}, derived: {},
    _unsubs: [], _blockInstances: [], _dependents: [], _stateUnsubs: [],
    _customMountInstance: null,
    invalidate: (key) => _onInvalidate(ctx, schema, key),
    setState: (keyPath, value) => _setState(ctx, keyPath, value),
  };

  try {
    ctx.state = makeReactive(
      { ...(schema.state || {}) },
      (keyPath, value, oldValue) => _onStateChange(ctx, schema, keyPath, value, oldValue)
    );
  } catch (err) {
    _showError('makeReactive 失敗：' + err.message);
    console.error('[page-engine] makeReactive 失敗：', err);
  }

  _buildDependencyGraph(ctx, schema);
  _subscribeAllData(ctx, schema);
  _bindAppStateEvents(ctx, schema);
  _computeAllDerived(ctx, schema);

  try {
    await _mountAllBlocks(ctx, schema);
  } catch (err) {
    _showError('mountAllBlocks 失敗：' + err.message);
    console.error('[page-engine] mountAllBlocks 失敗：', err);
  }

  /* customMount 執行（含 onYearMonthChange 註冊） */
  if (typeof schema.customMount === 'function') {
    try {
      ctx._customMountInstance = await schema.customMount(ctx);
    } catch (err) {
      _showError('customMount 失敗：' + err.message);
      console.error('[page-engine] customMount 執行失敗：', err);
    }
  }

  /* 🆕 v103.0.15 [P17-03]：onYearMonthChange hook */
  if (typeof schema.onYearMonthChange === 'function') {
    const unsub = AppState.on('ym-change', () => {
      try { schema.onYearMonthChange(ctx); } catch (err) {
        console.error('[page-engine] onYearMonthChange 失敗：', err);
      }
    });
    ctx._stateUnsubs.push(unsub);
  }

  console.log('[page-engine] createPage 完成');
  return { ctx, destroy: () => _destroy(ctx), ready: Promise.resolve() };
}

/* ============================================
   1. 依賴圖
   ============================================ */
function _buildDependencyGraph(ctx, schema) {
  ctx._dependents = {};
  const addDep = (dep, dependent) => {
    if (!ctx._dependents[dep]) ctx._dependents[dep] = [];
    if (!ctx._dependents[dep].includes(dependent)) ctx._dependents[dep].push(dependent);
  };
  Object.entries(schema.derived || {}).forEach(([name, cfg]) => {
    (cfg.deps || []).forEach((dep) => addDep(dep, name));
  });
}

/* ============================================
   2. data 訂閱
   ============================================ */
function _subscribeAllData(ctx, schema) {
  const dataCfg = schema.data || {};
  Object.entries(dataCfg).forEach(([key, cfg]) => {
    try {
      const unsub = subscribe(cfg, ({ data, error }) => {
        if (error) { console.warn(`[page-engine] data.${key} 錯誤：`, error); return; }
        ctx.data[key] = data;
        _onKeyChange(ctx, schema, 'data.' + key);
      });
      ctx._unsubs.push(unsub);
    } catch (err) {
      _showError(`訂閱 data.${key} 失敗：${err.message}`);
      console.error(`[page-engine] 訂閱 data.${key} 失敗：`, err);
    }
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
  };
  try {
    ctx._stateUnsubs.push(AppState.on('ym-change', handle));
    ctx._stateUnsubs.push(AppState.on('family-change', handle));
  } catch (err) {
    console.warn('[page-engine] AppState 訂閱失敗：', err);
  }
}

/* ============================================
   4. 佔位符重訂閱
   ============================================ */
function _resubscribeDataWithParams(ctx, schema) {
  const dataCfg = schema.data || {};
  const hasParam = Object.values(dataCfg).some((cfg) => /\{\w+\}/.test(cfg.path || ''));
  if (!hasParam) return;
  ctx._unsubs.forEach((u) => { try { u(); } catch (e) {} });
  ctx._unsubs = [];
  _subscribeAllData(ctx, schema);
}

/* ============================================
   5. 狀態 / 資料變更
   ============================================ */
function _onStateChange(ctx, schema, keyPath) {
  _onKeyChange(ctx, schema, `state.${keyPath}`);
}

function _onKeyChange(ctx, schema, changedKey) {
  const dirty = new Set();
  _markDirty(ctx, changedKey, dirty);
  if (dirty.size > 0) _recomputeDerivedSubset(ctx, schema, dirty);
  _notifyBlocksForChangedKeys(ctx, changedKey, dirty);
}

function _onInvalidate(ctx, schema, key) {
  _onKeyChange(ctx, schema, key);
}

/* ============================================
   6. derived 依賴追蹤
   ============================================ */
function _markDirty(ctx, key, dirtySet) {
  if (dirtySet.has(key)) return;
  dirtySet.add(key);
  (ctx._dependents[key] || []).forEach((d) => _markDirty(ctx, d, dirtySet));
}

function _computeAllDerived(ctx, schema) {
  const def = schema.derived || {};
  _topoSort(Object.keys(def), def).forEach((name) => _computeOne(ctx, schema, name, def[name]));
}

function _recomputeDerivedSubset(ctx, schema, dirtySet) {
  const def = schema.derived || {};
  _topoSort(Object.keys(def), def).forEach((name) => {
    if (dirtySet.has(name)) _computeOne(ctx, schema, name, def[name]);
  });
}

function _computeOne(ctx, schema, name, cfg) {
  const deps = cfg.deps || [];
  const derivedDef = schema.derived || {};
  try {
    const args = deps.map((dep) => _resolveDep(ctx, dep));
    const hasUndef = deps.some((dep, i) => {
      if (dep.startsWith('data.')) return args[i] === undefined;
      if (dep in derivedDef) return args[i] === undefined;
      return false;
    });
    if (hasUndef) { ctx.derived[name] = undefined; return; }
    ctx.derived[name] = cfg.compute(...args);
  } catch (err) {
    console.error(`[page-engine] derived.${name} 計算失敗：`, err);
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
  const visit = (name, stack) => {
    if (visited.has(name)) return;
    if (stack.has(name)) return;
    stack.add(name);
    ((defs[name] || {}).deps || []).forEach((d) => { if (d in defs) visit(d, stack); });
    stack.delete(name);
    visited.add(name);
    result.push(name);
  };
  names.forEach((n) => visit(n, new Set()));
  return result;
}

/* ============================================
   7. Blocks
   ============================================ */
async function _mountAllBlocks(ctx, schema) {
  for (const block of (schema.blocks || [])) {
    const instance = await mountBlock(block, ctx);
    if (!instance) { _showError(`block "${block.type}" 掛載失敗`); continue; }
    ctx._blockInstances.push({ block, instance, deps: collectBlockDeps(block) });
  }
}

function _notifyAllBlocks(ctx) {
  ctx._blockInstances.forEach(({ instance }) => {
    try { instance.onDepsChange?.(); } catch (err) {}
  });
}

function _notifyBlocksForChangedKeys(ctx, changedKey, dirtySet) {
  const affected = new Set(dirtySet);
  affected.add(changedKey);
  ctx._blockInstances.forEach(({ instance, deps }) => {
    const shouldNotify = _setHasAny(deps.derived, affected) ||
      (changedKey.startsWith('state.') && _setHasAny(deps.state, affected));
    if (shouldNotify && instance.onDepsChange) {
      try { instance.onDepsChange(); } catch (err) {}
    }
  });
}

function _setHasAny(set, keys) {
  if (!set || set.size === 0) return false;
  for (const k of keys) if (set.has(k)) return true;
  return false;
}

/* ============================================
   8. state 設值
   ============================================ */
function _setState(ctx, keyPath, value) {
  if (!keyPath) return;
  const keys = String(keyPath).split('.');
  const last = keys.pop();
  const target = keys.reduce((acc, key) => {
    if (acc[key] == null || typeof acc[key] !== 'object') acc[key] = {};
    return acc[key];
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
  ctx.data = {};
  ctx.derived = {};
  ctx._dependents = [];
}