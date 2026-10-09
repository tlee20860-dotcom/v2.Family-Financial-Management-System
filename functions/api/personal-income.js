// ============================================
// personal-income.js — 個人收入 API（v102.0.0）
// 位置：functions/api/personal-income.js
// ============================================
// v102.0.0 修正：
//   ✅ [P1-6] _resolveOwnMemberId 加入 fallback：
//       1. memberAccount.memberId
//       2. 用 displayName 匹配 members
//       3. 若家庭只有 1 個成員，自動使用
//   ✅ 保留 v102.0.0 全部功能
// ============================================

import { dbGet, dbPut, dbDelete } from './_config.js';
import {
  authenticate,
  errorResponse,
  handleError,
  handleOptions,
  successResponse,
  requireFields,
  roundInt,
  verifyFamilyAccess,
} from './_helpers.js';

/* ============================================
   GET — 列出個人收入
   ============================================ */
export async function onRequestGet({ request }) {
  try {
    const url = new URL(request.url);
    const familyId = url.searchParams.get('familyId');
    const memberId = url.searchParams.get('memberId');
    const action = url.searchParams.get('action') || 'list';

    if (!familyId) return errorResponse('MISSING_FIELDS', '缺少 familyId');
    if (action !== 'list') {
      return errorResponse('BAD_REQUEST', 'GET 僅支援 action=list');
    }

    const auth = await authenticate(request, { needFamily: true });
    if (auth instanceof Response) return auth;
    const { token, user } = auth;

    const accessResult = await verifyFamilyAccess(token, familyId);
    if (!accessResult) return errorResponse('FORBIDDEN', '無權存取');

    const isOwner = accessResult.isOwner;
    const isSuper = accessResult.isSuper;

    if (memberId && !isOwner && !isSuper) {
      const ownMemberId = await _resolveOwnMemberId(familyId, user.localId, token);
      if (!ownMemberId || ownMemberId !== memberId) {
        return errorResponse('FORBIDDEN', '無權讀取其他成員的收入');
      }
    }

    if (memberId) {
      const data = await dbGet(`families/${familyId}/personal_income/${memberId}`, token);
      return successResponse({
        familyId,
        memberId,
        income: data || {},
      });
    }

    if (!isOwner && !isSuper) {
      return errorResponse('FORBIDDEN', '需要 owner 權限才能讀取所有成員收入');
    }

    const all = await dbGet(`families/${familyId}/personal_income`, token);
    return successResponse({
      familyId,
      personalIncome: all || {},
    });
  } catch (err) {
    return handleError(err);
  }
}

/* ============================================
   POST — save / remove
   ============================================ */
export async function onRequestPost({ request }) {
  try {
    const body = await request.json();
    const { familyId, memberId, year, month, amount, action } = body || {};

    const missing = requireFields(body, ['familyId', 'memberId', 'year', 'month', 'action']);
    if (missing) return errorResponse('MISSING_FIELDS', '缺少必要欄位');

    const auth = await authenticate(request, { needFamily: true, body });
    if (auth instanceof Response) return auth;
    const { token, user } = auth;

    const accessResult = await verifyFamilyAccess(token, familyId);
    if (!accessResult) return errorResponse('FORBIDDEN', '無權存取');

    const isOwner = accessResult.isOwner;
    const isSuper = accessResult.isSuper;

    if (!isOwner && !isSuper) {
      const ownMemberId = await _resolveOwnMemberId(familyId, user.localId, token);
      if (!ownMemberId || ownMemberId !== memberId) {
        return errorResponse('FORBIDDEN', '無權修改其他成員的收入');
      }
    }

    const mm = String(month).padStart(2, '0');
    const yyyy = String(year);
    const path = `families/${familyId}/personal_income/${memberId}/${yyyy}/${mm}`;

    if (action === 'save') {
      const num = roundInt(amount);
      if (num <= 0) {
        await dbDelete(path, token);
        return successResponse({ deleted: true });
      }
      const ok = await dbPut(path, num, token);
      if (!ok) return errorResponse('INTERNAL', '寫入失敗');
      return successResponse({ saved: true, amount: num });
    }

    if (action === 'remove') {
      const ok = await dbDelete(path, token);
      if (!ok) return errorResponse('INTERNAL', '刪除失敗');
      return successResponse({ removed: true });
    }

    return errorResponse('BAD_REQUEST', `未知的 action：${action}`);
  } catch (err) {
    return handleError(err);
  }
}

export async function onRequestOptions() {
  return handleOptions();
}

/* ============================================
   🆕 v102.0.0：解析當前登入者對應的 memberId（含 fallback）
   ============================================ */
async function _resolveOwnMemberId(familyId, uid, token) {
  const memberAccount = await dbGet(
    `platform/families/${familyId}/memberAccounts/${uid}`,
    token
  );

  // 1. 優先使用 memberAccount.memberId
  if (memberAccount && memberAccount.memberId) {
    return memberAccount.memberId;
  }

  // 🆕 P1-6 fallback 1：用 displayName 匹配 members
  if (memberAccount && memberAccount.displayName) {
    try {
      const members = await dbGet(`families/${familyId}/members`, token);
      if (members && typeof members === 'object') {
        const dn = String(memberAccount.displayName).trim();
        const matched = Object.entries(members).find(([id, m]) => {
          const name = String((m && m.name) || '').trim();
          return name === dn;
        });
        if (matched) return matched[0];
      }
    } catch (e) {
      console.warn('[personal-income] fallback 1 失敗：', e);
    }
  }

  // 🆕 P1-6 fallback 2：若家庭只有 1 個成員，自動使用（單人家庭情境）
  try {
    const members = await dbGet(`families/${familyId}/members`, token);
    if (members && typeof members === 'object') {
      const keys = Object.keys(members);
      if (keys.length === 1) return keys[0];
    }
  } catch (e) {
    console.warn('[personal-income] fallback 2 失敗：', e);
  }

  return '';
}
