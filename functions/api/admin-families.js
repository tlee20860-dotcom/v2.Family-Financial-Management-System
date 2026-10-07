// ============================================
// admin-families.js — 平台管理 API（v101.5）
// 位置：functions/api/admin-families.js
// ============================================
// v101.5 修正：
//   ✅ 使用 PLATFORM_RESOURCES 的相對路徑（與 _helpers.js 對齊）
//   ✅ 錯誤訊息標準化
// ============================================

import { dbGet, dbPut, dbDelete } from './_config.js';
import {
  authenticate,
  errorResponse,
  handleError,
  handleOptions,
  successResponse,
  requireFields,
} from './_helpers.js';

/* ============================================
   GET — 列出所有家庭
   ============================================ */
export async function onRequestGet({ request }) {
  try {
    const auth = await authenticate(request, { needSuperAdmin: true });
    if (auth instanceof Response) return auth;
    const { token } = auth;

    const list = await dbGet('platform/families', token);
    const families = Object.entries(list || {}).map(([uid, data]) => ({ uid, ...data }));
    families.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    return successResponse({ families });
  } catch (err) {
    return handleError(err);
  }
}

/* ============================================
   POST — 新增 / 刪除家庭
   ============================================ */
export async function onRequestPost({ request }) {
  try {
    const body = await request.json();
    const { action, uid, name, email } = body || {};

    const auth = await authenticate(request, { needSuperAdmin: true });
    if (auth instanceof Response) return auth;
    const { token } = auth;

    /* ============================================
       ADD
       ============================================ */
    if (action === 'add') {
      const missing = requireFields(body, ['uid', 'name']);
      if (missing) return errorResponse('MISSING_FIELDS', '缺少 uid 或 name');

      const success = await dbPut(`platform/families/${uid}`, {
        name: String(name).trim(),
        ownerEmail: email ? String(email).trim() : '',
        createdAt: Date.now(),
      }, token);

      if (!success) {
        return errorResponse('INTERNAL', 'Firebase 寫入失敗，請檢查規則或 Token');
      }
      return successResponse();
    }

    /* ============================================
       REMOVE
       ============================================ */
    if (action === 'remove') {
      const missing = requireFields(body, ['uid']);
      if (missing) return errorResponse('MISSING_FIELDS', '缺少 uid');

      // 同時刪除 platform 記錄與整個家庭資料
      const ok1 = await dbDelete(`platform/families/${uid}`, token);
      const ok2 = await dbDelete(`families/${uid}`, token);

      if (!ok1 && !ok2) {
        return errorResponse('INTERNAL', '刪除失敗');
      }
      return successResponse({
        deletedPlatform: ok1,
        deletedFamilyData: ok2,
      });
    }

    return errorResponse('BAD_REQUEST', '未知的 action');
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