// ============================================
// page-engine.js — 頁面引擎（v103.0.11）
// 位置：js/engines/page-engine.js
// ============================================
// v103.0.11 修正：
//   ✅ [B04] _computeOne 補上 undefined 依賴檢查（合併 v103.0.7 P07 修正）
//   ✅ 保留 v103.0.4 的 data. 前綴修正（P05）
//   ✅ 保留 customMount 支援（P04）
// ============================================

import {
  subscribe,
  makeReactive,
  getNestedValue,
} from './data-engine.js';
import { mountBlock, collectBlockDeps } from './render-engine.js';
import { AppState } from '../core/state.js';

/* ============================================
   錯誤橫幅（手機除錯用）
   ============================================ */
function _showError(msg) {
  try {
    let banner = document.getElementById('__page_engine_error__');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = '__page_engine_error__';
      banner.style.cssText = `
        position: fixed;
        top: 0; left: 0; right: 0;
        background: #F43F5E;
        color: #fff;
        padding: 12px 16px;
        font-size: 13px;
        font-family: monospace;
        z-index: 99999;
        white-space: pre-wrap;
        max-height: 50vh;
        overflow-y: auto;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
      `;
      document.body.appendChild(banner);
    }
    banner.textContent += `[page-engine] ${msg}\n`;
  } catch (e) { /* noop */ }
}

function _hideError() {
  const banner = document.getElementById('__page_engine_error__');
  if (banner) banner.remove();
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
    state: {},
    data: {},
    derived: {},

    _unsubs: [],
    _blockInstances: [],
    _dependents: {},
    _stateUnsubs: [],
    _customMountInstance: null,

    invalidate: (key) => _onInvalidate(ctx, schema, key),
    setState: (keyPath, value) => _setState(ctx, keyPath, value),
  };

  /* ---------- 2. 建立 state（響應式） ---------- */
  try {
    ctx.state = makeReactive(
      { ...(schema.state || {}) },
      (keyPath, value, oldValue) => _onStateChange(ctx, schema, keyPath, value, oldValue)
    );
  } catch (err) {
    _showError('makeReactive 失敗：' + err.message);
    console.error('[page-engine] makeReactive 失敗：', err);
  }

  /* ---------- 3. 建立依賴圖 ---------- */
  _buildDependencyGraph(ctx, schema);

  /* ---------- 4. 訂閱 data ---------- */
  _subscribeAllData(ctx, schema);

  /* ---------- 5. AppState 事件 ---------- */
  _bindAppStateEvents(ctx, schema);

  /* ---------- 6. 初始計算 derived ---------- */
  _computeAllDerived(ctx, schema);

  /* ---------- 7. 掛載 blocks ---------- */
  try {
    await _mountAllBlocks(ctx, schema);
  } catch (err) {
    _showError('mountAllBlocks 失敗：' + err.message);
    console.error('[page-engine] mountAllBlocks 失敗：', err);
  }

  /* ---------- 8. 執行 customMount（若有） ---------- */
  if (typeof schema.customMount === 'function') {
    try {
      ctx._customMountInstance = await schema.customMount(ctx);
    } catch (err) {
      _showError('customMount 失敗：' + err.message + '\n' + (err.stack || ''));
      console.error('[page-engine] customMount 執行失敗：', err);
    }
  }

  console.log('[page-engine] createPage 完成');
  return {
    ctx,
    destroy: () => _destroy(ctx),
    ready: Promise.resolve(),
  };
}

/* ============================================
   1. 依賴圖
   ============================================ */
function _buildDependencyGraph(ctx, schema) {
  ctx._dependents = {};
  const addDep = (dep, dependent) => {
    if (!ctx._dependents[dep]) ctx._dependents[dep] = [];
    if (!ctx._dependents[dep].includes(dependent)) {
      ctx._dependents[dep].push(dependent);
    }
  };
  Object.entries(schema.derived || {}).forEach(([name, cfg]) => {
    (cfg.deps || []).forEach((dep) => addDep(dep, name));
  });
  console.log('[page-engine] 依賴圖：', ctx._dependents);
}

/* ============================================
   2. data 訂閱
   ============================================ */
function _subscribeAllData(ctx, schema) {
  const dataCfg = schema.data || {};
  Object.entries(dataCfg).forEach(([key, cfg]) => {
    try {
      const unsub = subscribe(cfg, ({ data, error }) => {
        if (error) {
          console.warn(`[page-engine] data.${key} 錯誤：`, error);
          return;
        }
        ctx.data[key] = data;
        console.log(`[page-engine] data.${key} 更新：`, data);
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
    const u1 = AppState.on('ym-change', handle);
    const u2 = AppState.on('family-change', handle);
    ctx._stateUnsubs.push(u1, u2);
  } catch (err) {
    console.warn('[page-engine] AppState 訂閱失敗：', err);
  }
}

/* ============================================
   4. 佔位符重訂閱
   ============================================ */
function _resubscribeDataWithParams(ctx, schema) {
  const dataCfg = schema.data || {};
  const paramKeys = Object.entries(dataCfg)
    .filter(([, cfg]) => /\{\w+\}/.test(cfg.path || ''))
    .map(([key]) => key);

  if (paramKeys.length === 0) return;

  ctx._unsubs.forEach((unsub) => {
    try { unsub(); } catch (e) { /* noop */ }
  });
  ctx._unsubs = [];
  _subscribeAllData(ctx, schema);
}

/* ============================================
   5. 狀態 / 資料變更
   ============================================ */
function _onStateChange(ctx, schema, keyPath, value, oldValue) {
  _onKeyChange(ctx, schema, `state.${keyPath}`);
}

function _onKeyChange(ctx, schema, changedKey) {
  const dirty = new Set();
  _markDirty(ctx, changedKey, dirty);

  if (dirty.size > 0) {
    _recomputeDerivedSubset(ctx, schema, dirty);
  }
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
  const dependents = ctx._dependents[key] || [];
  dependents.forEach((dep) => _markDirty(ctx, dep, dirtySet));
}

function _computeAllDerived(ctx, schema) {
  const derivedDef = schema.derived || {};
  const ordered = _topoSort(Object.keys(derivedDef), derivedDef);
  ordered.forEach((name) => _computeOne(ctx, schema, name, derivedDef[name]));
  console.log('[page-engine] derived 全部計算完成：', Object.keys(ctx.derived));
}

function _recomputeDerivedSubset(ctx, schema, dirtySet) {
  const derivedDef = schema.derived || {};
  const ordered = _topoSort(Object.keys(derivedDef), derivedDef);
  ordered.forEach((name) => {
    if (dirtySet.has(name)) _computeOne(ctx, schema, name, derivedDef[name]);
  });
}

/**
 * 🆕 v103.0.11 [B04]：
 *   補上 undefined 依賴檢查——任何 data.* 或 derived.* 依賴為 undefined
 *   時，跳過計算並保持 derived[name] = undefined，等資料到達後由
 *   _onKeyChange 觸發重算。
 */
function _computeOne(ctx, schema, name, cfg) {
  const deps = cfg.deps || [];
  const derivedDef = schema.derived || {};

  try {
    const args = deps.map((dep) => _resolveDep(ctx, dep));

    // 🆕 檢查是否有 undefined 依賴
    const hasUndefinedDep = deps.some((dep, i) => {
      if (dep.startsWith('data.')) return args[i] === undefined;
      if (dep in derivedDef) return args[i] === undefined;
      return false;
    });

    if (hasUndefinedDep) {
      ctx.derived[name] = undefined;
      return;
    }

    ctx.derived[name] = cfg.compute(...args);
  } catch (err) {
    _showError(`derived.${name} 計算失敗：${err.message}`);
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
  const visited = new Set();
  const result = [];
  const visit = (name, stack) => {
    if (visited.has(name)) return;
    if (stack.has(name)) {
      console.warn(`[page-engine] derived 循環依賴：${name}`);
      return;
    }
    stack.add(name);
    const cfg = defs[name] || {};
    (cfg.deps || []).forEach((dep) => {
      if (dep in defs) visit(dep, stack);
    });
    stack.delete(name);
    visited.add(name);
    result.push(name);
  };
  names.forEach((name) => visit(name, new Set()));
  return result;
}

/* ============================================
   7. Blocks 掛載
   ============================================ */
async function _mountAllBlocks(ctx, schema) {
  const blocks = schema.blocks || [];
  console.log('[page-engine] 準備掛載 blocks：', blocks.length);
  for (const block of blocks) {
    const instance = await mountBlock(block, ctx);
    if (!instance) {
      _showError(`block "${block.type}" 掛載失敗`);
      continue;
    }
    const deps = collectBlockDeps(block);
    ctx._blockInstances.push({ block, instance, deps });
  }
}

function _notifyAllBlocks(ctx) {
  ctx._blockInstances.forEach(({ instance }) => {
    try {
      if (typeof instance.onDepsChange === 'function') instance.onDepsChange();
    } catch (err) {
      console.error('[page-engine] block onDepsChange 失敗：', err);
    }
  });
}

function _notifyBlocksForChangedKeys(ctx, changedKey, dirtySet) {
  const affected = new Set(dirtySet);
  affected.add(changedKey);
  ctx._blockInstances.forEach(({ instance, deps }) => {
    const shouldNotify =
      _setHasAny(deps.derived, affected) ||
      (changedKey.startsWith('state.') && _setHasAny(deps.state, affected));
    if (shouldNotify && typeof instance.onDepsChange === 'function') {
      try { instance.onDepsChange(); } catch (err) {
        console.error('[page-engine] block onDepsChange 失敗：', err);
      }
    }
  });
}

function _setHasAny(set, keys) {
  if (!set || set.size === 0) return false;
  for (const k of keys) { if (set.has(k)) return true; }
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
  if (ctx._customMountInstance && typeof ctx._customMountInstance.destroy === 'function') {
    try { ctx._customMountInstance.destroy(); } catch (err) {
      console.warn('[page-engine] customMount destroy 失敗：', err);
    }
    ctx._customMountInstance = null;
  }

  ctx._blockInstances.forEach(({ instance }) => {
    try { if (typeof instance.destroy === 'function') instance.destroy(); } catch (err) {
      console.warn('[page-engine] block destroy 失敗：', err);
    }
  });
  ctx._blockInstances = [];

  ctx._unsubs.forEach((unsub) => { try { unsub(); } catch (err) { /* noop */ } });
  ctx._unsubs = [];

  ctx._stateUnsubs.forEach((unsub) => { try { unsub(); } catch (err) { /* noop */ } });
  ctx._stateUnsubs = [];

  ctx.data = {};
  ctx.derived = {};
  ctx._dependents = {};
}