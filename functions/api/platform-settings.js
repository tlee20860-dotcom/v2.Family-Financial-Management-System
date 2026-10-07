// ============================================
// platform-settings.js — 平台 UI 常數 API（v101.5）
// 位置：functions/api/platform-settings.js
// ============================================
// v101.5 修正：
//   ✅ 與 platform-defaults.js 的 uiConstants 對齊（同一資源）
//   ✅ 保留白名單過濾
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
    const auth = await authenticate(request, { needSuperAdmin: true });
    if (auth instanceof Response) return auth;
    const { token } = auth;

    const data = await dbGet('platform/defaults/ui_constants', token);

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

    const auth = await authenticate(request, { needSuperAdmin: true });
    if (auth instanceof Response) return auth;
    const { token } = auth;

    if (action !== 'update') {
      return errorResponse('BAD_REQUEST', '未知的 action');
    }

    if (!data || typeof data !== 'object') {
      return errorResponse('MISSING_FIELDS', '缺少 data');
    }

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