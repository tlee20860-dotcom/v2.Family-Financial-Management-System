// ============================================
// form-handler.js — 提交封裝（v101.6 🆕）
// 位置：js/shared/form-handler.js
// ============================================
// 職責：
//   統一 try-catch + Toast 邏輯
//   避免每個頁面重複寫「try { await action } catch { showToast }」
//
// API 凍結：v101.6 發布後只加不改
// ============================================

import { showToast } from './toast.js';

/* ============================================
   主函式
   ============================================ */

/**
 * 提交封裝
 * @param {Object} options
 * @param {Function} options.action - 執行函式（async）
 * @param {string} [options.successMessage='✅ 操作成功'] - 成功訊息
 * @param {string} [options.errorMessage] - 錯誤訊息前綴（若未提供，用 err.message）
 * @param {Function} [options.onSuccess] - 成功回呼 (result) => {}
 * @param {Function} [options.onError] - 失敗回呼 (err) => {}
 * @param {boolean} [options.silent=false] - 是否靜默（不顯示 Toast）
 * @returns {Promise<{ success, result?, error? }>}
 */
export async function handleSubmit(options) {
  const {
    action,
    successMessage = '✅ 操作成功',
    errorMessage,
    onSuccess,
    onError,
    silent = false,
  } = options;

  if (typeof action !== 'function') {
    console.warn('[form-handler] action 必須是函式');
    return { success: false, error: new Error('action 必須是函式') };
  }

  try {
    const result = await action();

    if (!silent && successMessage) {
      showToast(successMessage, 'success');
    }
    if (typeof onSuccess === 'function') {
      try { onSuccess(result); } catch (e) {
        console.error('[form-handler] onSuccess 失敗：', e);
      }
    }

    return { success: true, result };
  } catch (err) {
    console.error('[form-handler] 操作失敗：', err);

    if (!silent) {
      const msg = errorMessage
        ? `${errorMessage}：${err.message || err}`
        : `操作失敗：${err.message || err}`;
      showToast(msg, 'error');
    }

    if (typeof onError === 'function') {
      try { onError(err); } catch (e) {
        console.error('[form-handler] onError 失敗：', e);
      }
    }

    return { success: false, error: err };
  }
}

/* ============================================
   便利函式
   ============================================ */

/**
 * 提交並顯示成功訊息（簡化版）
 * @param {Function} action
 * @param {string} [message]
 * @returns {Promise<{ success, result?, error? }>}
 */
export function submitAndToast(action, message = '✅ 已儲存') {
  return handleSubmit({ action, successMessage: message });
}

/**
 * 提交並靜默（不顯示 Toast）
 * @param {Function} action
 * @returns {Promise<{ success, result?, error? }>}
 */
export function submitSilent(action) {
  return handleSubmit({ action, silent: true });
}