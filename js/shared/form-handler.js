// ============================================
// form-handler.js — 提交封裝（v103.0.11）
// 位置：js/shared/form-handler.js
// ============================================
// v103.0.11 重構：
//   ✅ [H07] 標記 @deprecated，內部實作改走 lib/async.js 的 withToast
//   ✅ 對外 API 保持 100% 相容（handleSubmit / submitAndToast / submitSilent）
//   ✅ 未來版本將完全移除，呼叫端請改用 lib/async.js
// ============================================

import { withToast } from '../lib/async.js';

/**
 * @deprecated v103.0.11 — 請改用 `lib/async.js` 的 `withToast`
 *
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

  const { ok, result, error } = await withToast(
    silent ? null : successMessage,
    action,
    {
      silent,
      errorMsg: errorMessage,
    }
  );

  if (ok) {
    if (typeof onSuccess === 'function') {
      try { onSuccess(result); } catch (e) {
        console.error('[form-handler] onSuccess 失敗：', e);
      }
    }
    return { success: true, result };
  }

  if (typeof onError === 'function') {
    try { onError(error); } catch (e) {
      console.error('[form-handler] onError 失敗：', e);
    }
  }
  return { success: false, error };
}

/**
 * @deprecated v103.0.11 — 請改用 `withToast('✅ 已儲存', fn)`
 *
 * 提交並顯示成功訊息（簡化版）
 */
export function submitAndToast(action, message = '✅ 已儲存') {
  return handleSubmit({ action, successMessage: message });
}

/**
 * @deprecated v103.0.11 — 請改用 `withToast(null, fn, { silent: true })`
 *
 * 提交並靜默（不顯示 Toast）
 */
export function submitSilent(action) {
  return handleSubmit({ action, silent: true });
}