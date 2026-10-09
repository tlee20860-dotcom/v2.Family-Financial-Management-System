// ============================================
// dom.js — DOM 操作 SSOT（v103.0.0）
// 位置：js/lib/dom.js
// ============================================
// 職責：
//   1. 統一 DOM 選取 / 建立 / 逸出
//   2. 條件執行輔助（when / unless）
//   3. 取代散落各處的 querySelector / innerHTML 拼接
//
// 設計原則：
//   - 無依賴，純函式
//   - esc() 為全站 HTML 逸出 SSOT
// ============================================

/* ============================================
   1. 選取
   ============================================ */

/**
 * querySelector 單一
 * @param {string} sel
 * @param {Element|Document} [root=document]
 * @returns {Element|null}
 */
export function qs(sel, root = document) {
  if (!sel) return null;
  return (root || document).querySelector(sel);
}

/**
 * querySelectorAll → Array
 * @param {string} sel
 * @param {Element|Document} [root=document]
 * @returns {Element[]}
 */
export function qsa(sel, root = document) {
  if (!sel) return [];
  return [...(root || document).querySelectorAll(sel)];
}

/* ============================================
   2. HTML 逸出（SSOT）
   ============================================ */

const _ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * HTML 逸出
 * - null / undefined → fallback
 * - 其他 → 逸出字元
 *
 * @param {*} v
 * @param {string} [fallback='']
 * @returns {string}
 */
export function esc(v, fallback = '') {
  if (v == null) return fallback;
  return String(v).replace(/[&<>"']/g, (c) => _ESCAPE_MAP[c]);
}

/* ============================================
   3. 條件執行
   ============================================ */

/**
 * 若 cond 為真則執行 fn
 * @param {*} cond
 * @param {Function} fn
 * @returns {*} fn 的回傳值或 undefined
 */
export function when(cond, fn) {
  if (cond && typeof fn === 'function') return fn();
  return undefined;
}

/**
 * 若 cond 為假則執行 fn
 * @param {*} cond
 * @param {Function} fn
 * @returns {*} fn 的回傳值或 undefined
 */
export function unless(cond, fn) {
  if (!cond && typeof fn === 'function') return fn();
  return undefined;
}

/* ============================================
   4. 建立元素
   ============================================ */

/**
 * 建立 DOM 元素
 *
 * @param {string} tag
 * @param {Object} [attrs] - 屬性（class / style / dataset / on* 有特殊處理）
 * @param {Array|Node|string} [children]
 * @returns {HTMLElement}
 */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);

  if (attrs && typeof attrs === 'object') {
    Object.entries(attrs).forEach(([key, val]) => {
      if (val == null || val === false) return;

      if (key === 'class' || key === 'className') {
        node.className = val;
      } else if (key === 'style' && typeof val === 'object') {
        Object.assign(node.style, val);
      } else if (key === 'dataset' && typeof val === 'object') {
        Object.assign(node.dataset, val);
      } else if (key.startsWith('on') && typeof val === 'function') {
        node.addEventListener(key.slice(2).toLowerCase(), val);
      } else if (key === 'html') {
        node.innerHTML = val;
      } else if (key === 'text') {
        node.textContent = val;
      } else {
        node.setAttribute(key, val);
      }
    });
  }

  const kids = Array.isArray(children) ? children : [children];
  kids.forEach((c) => {
    if (c == null || c === false) return;
    if (c instanceof Node) node.appendChild(c);
    else node.appendChild(document.createTextNode(String(c)));
  });

  return node;
}
