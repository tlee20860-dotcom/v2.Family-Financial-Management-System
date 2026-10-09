// ============================================
// async.js — 非同步輔助（v103.0.0）
// 位置：js/lib/async.js
// ============================================
// 職責：
//   1. 統一 try-catch + Toast 流程
//   2. 統一確認對話框 + 執行流程
//   3. 統一載入中 / 錯誤狀態顯示
//   4. safe() 靜默錯誤處理
//
// 設計原則：
//   - 呼叫端不需重複寫 try / catch / toast
//   - 錯誤一律回傳 { ok, error } 形式
// ============================================

import { showToast } from '../shared/toast.js';
import { openConfirm } from '../shared/modal.js';
import { esc } from './dom.js';

/* ============================================
   1. withToast — 執行 + Toast
   ============================================ */

/**
 * 執行 fn，成功顯示 Toast，失敗顯示錯誤 Toast
 *
 * @param {string|null} successMsg - 成功訊息（null 表示不顯示）
 * @param {Function} fn - async 函式
 * @param {Object} [opts]
 * @param {string} [opts.errorMsg] - 自訂錯誤前綴
 * @param {boolean} [opts.silent=false] - 靜默模式
 * @param {number} [opts.duration] - Toast 持續時間
 * @returns {Promise<{ok: boolean, result?: *, error?: Error}>}
 */
export async function withToast(successMsg, fn, opts = {}) {
  try {
    const result = await fn();
    if (successMsg && !opts.silent) {
      showToast(successMsg, 'success', opts.duration);
    }
    return { ok: true, result };
  } catch (err) {
    const msg = opts.errorMsg
      ? `${opts.errorMsg}：${err.message || err}`
      : (err.message || '操作失敗');
    if (!opts.silent) {
      showToast(msg, 'error', opts.duration);
    }
    return { ok: false, error: err };
  }
}

/* ============================================
   2. withConfirm — 確認 + 執行 + Toast
   ============================================ */

/**
 * 先顯示確認對話框，確認後執行 fn 並顯示 Toast
 *
 * @param {string} message - 確認訊息
 * @param {Function} fn - async 函式
 * @param {Object} [opts]
 * @param {string} [opts.successMsg] - 成功訊息
 * @param {string} [opts.errorMsg] - 錯誤前綴
 * @param {string} [opts.title] - 對話框標題
 * @param {string} [opts.okText] - 確定按鈕文字
 * @param {string} [opts.okClass] - 確定按鈕 class
 * @returns {Promise<{ok?: boolean, cancelled?: boolean, result?: *, error?: Error}>}
 */
export async function withConfirm(message, fn, opts = {}) {
  const ok = await openConfirm(message, opts);
  if (!ok) return { cancelled: true };

  return await withToast(opts.successMsg, fn, opts);
}

/* ============================================
   3. withAsyncState — 載入中 / 錯誤狀態
   ============================================ */

/**
 * 在容器內顯示載入中，執行 fn
 * - 成功：回傳結果
 * - 失敗：在容器內顯示錯誤，並拋出
 *
 * @param {string|Element} container - 容器 ID 或元素
 * @param {Function} fn - async 函式
 * @param {Object} [opts]
 * @param {string} [opts.loadingText='載入中…']
 * @param {string} [opts.errorPrefix='載入失敗']
 * @returns {Promise<*>}
 */
export async function withAsyncState(container, fn, opts = {}) {
  const root = typeof container === 'string'
    ? document.getElementById(container)
    : container;

  if (!root) {
    console.warn('[async] withAsyncState: 找不到容器', container);
    return await fn();
  }

  const loadingText = opts.loadingText || '載入中…';
  const errorPrefix = opts.errorPrefix || '載入失敗';

  root.innerHTML = `<div class="empty-state">${esc(loadingText)}</div>`;

  try {
    return await fn();
  } catch (err) {
    console.error('[async] withAsyncState 執行失敗：', err);
    root.innerHTML = `<div class="empty-state text-red">${esc(errorPrefix)}：${esc(err.message || err)}</div>`;
    throw err;
  }
}

/* ============================================
   4. safe — 靜默錯誤處理
   ============================================ */

/**
 * 執行 fn，任何錯誤都回傳 fallback
 *
 * @param {Function} fn - async 函式
 * @param {*} [fallback=null]
 * @returns {Promise<*>}
 */
export async function safe(fn, fallback = null) {
  try {
    return await fn();
  } catch (err) {
    console.warn('[async.safe]', err);
    return fallback;
  }
}
