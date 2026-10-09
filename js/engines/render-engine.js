// ============================================
// render-engine.js — 渲染引擎（v103.0.0）
// 位置：js/engines/render-engine.js
// ============================================
// 職責：
//   1. 解讀 Schema 中的表達式（'$.xxx' / 'state.xxx'）
//   2. 依 block.type 動態載入對應 Block 模組並掛載
//   3. 提供 block 依賴掃描（供 page-engine 通知）
//
// 設計原則：
//   - 表達式解析集中此處（不散落各 block）
//   - block 掛載採動態 import，未使用的 block 不載入
// ============================================

import { getNestedValue } from './data-engine.js';

/* ============================================
   1. 表達式解析
   ============================================ */

/**
 * 解析表達式
 *
 * 支援格式：
 *   '$.stats'       → ctx.derived.stats 或 ctx.data.stats
 *   'state.filters' → ctx.state.filters
 *   '$data.members' → ctx.data.members
 *   其他字串         → 原樣回傳
 *
 * @param {*} expr
 * @param {Object} ctx
 * @returns {*}
 */
export function resolveExpr(expr, ctx) {
  if (typeof expr !== 'string') return expr;
  if (!ctx) return expr;

  /* ---------- $.xxx → derived 優先，其次 data ---------- */
  if (expr.startsWith('$.')) {
    const key = expr.slice(2);
    if (ctx.derived && key in ctx.derived) return ctx.derived[key];
    if (ctx.data && key in ctx.data) return ctx.data[key];
    return undefined;
  }

  /* ---------- $data.xxx → data ---------- */
  if (expr.startsWith('$data.')) {
    const key = expr.slice(6);
    return getNestedValue(ctx.data, key);
  }

  /* ---------- $state.xxx → state ---------- */
  if (expr.startsWith('$state.')) {
    const key = expr.slice(7);
    return getNestedValue(ctx.state, key);
  }

  /* ---------- state.xxx → state ---------- */
  if (expr.startsWith('state.')) {
    return getNestedValue(ctx.state, expr.slice(6));
  }

  /* ---------- data.xxx → data ---------- */
  if (expr.startsWith('data.')) {
    return getNestedValue(ctx.data, expr.slice(5));
  }

  return expr;
}

/**
 * 解析物件中所有表達式（遞迴）
 * - 只處理字串值
 * - 物件 / 陣列遞迴
 *
 * @param {*} obj
 * @param {Object} ctx
 * @returns {*}
 */
export function resolveDeep(obj, ctx) {
  if (obj == null) return obj;

  if (typeof obj === 'string') {
    return resolveExpr(obj, ctx);
  }

  if (Array.isArray(obj)) {
    return obj.map((x) => resolveDeep(x, ctx));
  }

  if (typeof obj === 'object') {
    const out = {};
    Object.entries(obj).forEach(([k, v]) => {
      out[k] = resolveDeep(v, ctx);
    });
    return out;
  }

  return obj;
}

/* ============================================
   2. Block 掛載
   ============================================ */

/**
 * 掛載一個 Block
 *
 * @param {Object} block - { type, container, ... }
 * @param {Object} ctx
 * @returns {Promise<{onDepsChange: Function, destroy: Function}|null>}
 */
export async function mountBlock(block, ctx) {
  const { type } = block || {};
  if (!type) {
    console.warn('[render-engine] block.type 為必填');
    return null;
  }

  let mod;
  try {
    mod = await import(`../blocks/${type}-block.js`);
  } catch (err) {
    console.warn(`[render-engine] 找不到 block：${type}-block.js`, err);
    return null;
  }

  if (typeof mod.mount !== 'function') {
    console.warn(`[render-engine] block ${type} 沒有 export mount`);
    return null;
  }

  try {
    const instance = await mod.mount(block, ctx);
    return instance || { onDepsChange: () => {}, destroy: () => {} };
  } catch (err) {
    console.error(`[render-engine] block ${type} 掛載失敗：`, err);
    return null;
  }
}

/* ============================================
   3. Block 依賴掃描
   ============================================ */

const DERIVED_REF_RE = /\$\.([a-zA-Z_$][\w$]*)/g;
const STATE_REF_RE = /state\.([a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*)*)/g;

/**
 * 掃描 Block 中所有表達式依賴
 *
 * @param {Object} block
 * @returns {{ derived: Set<string>, state: Set<string> }}
 */
export function collectBlockDeps(block) {
  const derived = new Set();
  const state = new Set();

  const scan = (obj) => {
    if (obj == null) return;

    if (typeof obj === 'string') {
      // 掃 $.xxx
      let m;
      DERIVED_REF_RE.lastIndex = 0;
      while ((m = DERIVED_REF_RE.exec(obj)) !== null) {
        derived.add(m[1]);
      }

      // 掃 state.xxx
      STATE_REF_RE.lastIndex = 0;
      while ((m = STATE_REF_RE.exec(obj)) !== null) {
        state.add(m[1]);
      }
      return;
    }

    if (Array.isArray(obj)) {
      obj.forEach(scan);
      return;
    }

    if (typeof obj === 'object') {
      Object.values(obj).forEach(scan);
    }
  };

  scan(block);

  return { derived, state };
}
