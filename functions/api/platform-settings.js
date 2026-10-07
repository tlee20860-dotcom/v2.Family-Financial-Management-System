// ============================================
// platform-settings.js — 平台 UI 常數 API（v101 新增）
// 位置：functions/api/platform-settings.js
// ============================================
// 端點：
//   GET  /api/platform-settings          取得平台 UI 常數
//   POST /api/platform-settings          更新平台 UI 常數
//         { action: 'update', data: {...} }
//
// 用途：
//   superadmin 在 admin.html → 平台預設 → UI 常數 分頁編輯
//   儲存於 platform/defaults/ui_constants
//
// 讀取優先順序（前端）：
//   1. families/{uid}/settings/ui_constants （家庭覆蓋）
//   2. platform/defaults/ui_constants       （平台預設）
//   3. constants.js DEFAULT_UI_CONSTANTS    （硬編碼 fallback）
// ============================================

import { dbGet, dbPut } from './_config.js';
import {
  authenticate,
  errorResponse,
  handleError,
  handleOptions,
  successResponse,
} from './_helpers.js';

/* ============================================
   GET — 讀取平台 UI 常數
   ============================================ */
export async function onRequestGet({ request }) {
  try {
    // 權限檢查：需 superadmin
    const auth = await authenticate(request, { needSuperAdmin: true });
    if (auth instanceof Response) return auth;
    const { token } = auth;

    const data = await dbGet('platform/defaults/ui_constants', token);

    // 若尚未設定，回傳空物件（前端會 fallback 到常數）
    return successResponse({
      data: data || {},
    });
  } catch (err) {
    return handleError(err);
  }
}

/* ============================================
   POST — 更新平台 UI 常數
   ============================================ */
export async function onRequestPost({ request }) {
  try {
    const body = await request.json();
    const { action, data } = body || {};

    // 權限檢查：需 superadmin
    const auth = await authenticate(request, { needSuperAdmin: true });
    if (auth instanceof Response) return auth;
    const { token } = auth;

    if (action !== 'update') {
      return errorResponse('BAD_REQUEST', '未知的 action');
    }

    if (!data || typeof data !== 'object') {
      return errorResponse('MISSING_FIELDS', '缺少 data');
    }

    // 白名單過濾（只允許已知欄位）
    const clean = {
      nameMaxLenDesktop: _toInt(data.nameMaxLenDesktop, 12),
      nameMaxLenMobile: _toInt(data.nameMaxLenMobile, 6),
      toastDuration: _toInt(data.toastDuration, 2000),
    };

    const ok = await dbPut('platform/defaults/ui_constants', clean, token);
    if (!ok) {
      return errorResponse('INTERNAL', '寫入失敗，請檢查 Firebase 規則');
    }

    return successResponse({ data: clean });
  } catch (err) {
    return handleError(err);
  }
}

/* ============================================
   OPTIONS preflight
   ============================================ */
export async function onRequestOptions() {
  return handleOptions();
}

/* ============================================
   內部工具
   ============================================ */

function _toInt(v, fallback) {
  const n = Number(v);
  if (isNaN(n) || n < 0) return fallback;
  return Math.floor(n);
}