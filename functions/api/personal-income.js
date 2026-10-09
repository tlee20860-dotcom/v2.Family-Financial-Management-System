// ============================================
// personal-income.js — 個人收入 API（v102.0.0 🆕）
// 位置：functions/api/personal-income.js
// ============================================
// 用途：
//   管理家庭成員的個人收入（不進家庭總帳）
//
// 請求：
//   GET  /api/personal-income?familyId={uid}&memberId={id}&action=list
//   POST /api/personal-income
//     body: { familyId, memberId, year, month, amount, action: 'save' }
//     body: { familyId, memberId, year, month, action: 'remove' }
//
// 權限：
//   - superadmin：可讀寫任何家庭
//   - owner：可讀寫所有成員
//   - member：僅可讀寫自己的 memberId
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

    /* ============================================
       權限檢查（Q6-B+C）
       - superadmin / owner：可讀任何成員
       - member：僅可讀自己
       ============================================ */
    const accessResult = await verifyFamilyAccess(token, familyId);
    if (!accessResult) return errorResponse('FORBIDDEN', '無權存取');

    const isOwner = accessResult.isOwner;
    const isSuper = accessResult.isSuper;

    if (memberId && !isOwner && !isSuper) {
      // member 只能讀自己
      const ownMemberId = await _resolveOwnMemberId(familyId, user.localId, token);
      if (ownMemberId !== memberId) {
        return errorResponse('FORBIDDEN', '無權讀取其他成員的收入');
      }
    }

    /* ============================================
       若指定 memberId：回傳該成員的收入
       ============================================ */
    if (memberId) {
      const data = await dbGet(`families/${familyId}/personal_income/${memberId}`, token);
      return successResponse({
        familyId,
        memberId,
        income: data || {},
      });
    }

    /* ============================================
       若未指定：回傳所有成員的收入（僅 owner / superadmin）
       ============================================ */
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

    /* ============================================
       權限檢查：member 只能操作自己
       ============================================ */
    if (!isOwner && !isSuper) {
      const ownMemberId = await _resolveOwnMemberId(familyId, user.localId, token);
      if (ownMemberId !== memberId) {
        return errorResponse('FORBIDDEN', '無權修改其他成員的收入');
      }
    }

    /* ============================================
       寫入 / 刪除
       ============================================ */
    const mm = String(month).padStart(2, '0');
    const yyyy = String(year);
    const path = `families/${familyId}/personal_income/${memberId}/${yyyy}/${mm}`;

    if (action === 'save') {
      const num = roundInt(amount);
      if (num <= 0) {
        // 金額為 0 → 刪除該筆
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
   內部工具：解析當前登入者對應的 memberId
   ============================================ */
async function _resolveOwnMemberId(familyId, uid, token) {
  const memberAccount = await dbGet(
    `platform/families/${familyId}/memberAccounts/${uid}`,
    token
  );
  if (memberAccount && memberAccount.memberId) {
    return memberAccount.memberId;
  }
  // fallback：若無 memberId 對應，用 uid 比對
  return '';
}