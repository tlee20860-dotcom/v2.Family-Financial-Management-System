// ============================================
// async.js — 非同步輔助（v103.0.2）
// 位置：js/lib/async.js
// ============================================
// v103.0.2 修正：
//   ✅ 從 '../shared/toast.js' 改為 '../ui/toast.js'
//   ✅ 從 '../shared/modal.js' 改為 '../ui/modal.js'
// ============================================

import { showToast } from '../ui/toast.js';
import { openConfirm } from '../ui/modal.js';
import { esc } from './dom.js';

/* ============================================
   1. withToast
   ============================================ */
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
   2. withConfirm
   ============================================ */
export async function withConfirm(message, fn, opts = {}) {
  const ok = await openConfirm(message, opts);
  if (!ok) return { cancelled: true };

  return await withToast(opts.successMsg, fn, opts);
}

/* ============================================
   3. withAsyncState
   ============================================ */
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
   4. safe
   ============================================ */
export async function safe(fn, fallback = null) {
  try {
    return await fn();
  } catch (err) {
    console.warn('[async.safe]', err);
    return fallback;
  }
}