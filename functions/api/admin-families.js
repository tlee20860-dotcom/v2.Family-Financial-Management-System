// ============================================
// admin-families.js — 平台管理 API（v101.10.0）
// 位置：functions/api/admin-families.js
// ============================================
// v101.10.0 修正：
//   ✅ [P2-1] remove 家庭時，清理該家庭所有成員的
//             platform/uid_index / platform/email_index
//   ✅ 保留 v101.5 全部功能
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
       REMOVE（v101.10.0：加入索引清理）
       ============================================ */
    if (action === 'remove') {
      const missing = requireFields(body, ['uid']);
      if (missing) return errorResponse('MISSING_FIELDS', '缺少 uid');

      // v101.10.0：先讀取所有成員帳號，清理索引
      let accounts = null;
      try {
        accounts = await dbGet(`platform/families/${uid}/memberAccounts`, token);
      } catch (e) {
        accounts = null;
      }

      const cleanups = [];
      if (accounts && typeof accounts === 'object') {
        Object.entries(accounts).forEach(([memberUid, acc]) => {
          // 清理 uid_index
          cleanups.push(
            dbDelete(`platform/uid_index/${memberUid}`, token).catch(() => false)
          );
          // 清理 email_index（若成員有 account 欄位）
          if (acc && acc.account) {
            cleanups.push(
              dbDelete(`platform/email_index/${acc.account}`, token).catch(() => false)
            );
          }
        });
      }
      await Promise.all(cleanups);

      // 刪除平台記錄與家庭資料
      const ok1 = await dbDelete(`platform/families/${uid}`, token);
      const ok2 = await dbDelete(`families/${uid}`, token);

      if (!ok1 && !ok2) {
        return errorResponse('INTERNAL', '刪除失敗');
      }
      return successResponse({
        deletedPlatform: ok1,
        deletedFamilyData: ok2,
        cleanedIndexes: cleanups.length,
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