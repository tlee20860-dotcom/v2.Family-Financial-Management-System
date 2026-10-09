// ============================================
// form-handler.js — 提交封裝（v103.0.2）
// 位置：js/shared/form-handler.js
// ============================================
// v103.0.2 修正：
//   ✅ 從 './toast.js' 改為 '../ui/toast.js'
// ============================================

import { showToast } from '../ui/toast.js';

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

/**
 * 提交並顯示成功訊息（簡化版）
 */
export function submitAndToast(action, message = '✅ 已儲存') {
  return handleSubmit({ action, successMessage: message });
}

/**
 * 提交並靜默（不顯示 Toast）
 */
export function submitSilent(action) {
  return handleSubmit({ action, silent: true });
}