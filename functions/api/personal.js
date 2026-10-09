// ============================================
// personal.js — 個人收入 + 成員代墊（v103.0.0）
// 位置：functions/api/personal.js
// ============================================
// v103.0.0 合併：
//   ✅ 合併 personal-income.js + member-advances.js
//   ✅ 內部透過 ?action= 分派
//   ✅ 舊 URL 路徑保持不變
// ============================================

import { dbGet, dbPut, dbPush, dbDelete } from './_config.js';
import {
  authenticate, errorResponse, handleError, handleOptions,
  successResponse, requireFields, objToList, roundInt,
  verifyFamilyAccess,
} from './_helpers.js';

/* ============================================
   GET — 分派
   ============================================ */
export async function onRequestGet({ request }) {
  try {
    const url = new URL(request.url);
    const familyId = url.searchParams.get('familyId');
    const memberId = url.searchParams.get('memberId');
    const action = url.searchParams.get('action') || 'list';
    const resource = url.searchParams.get('resource') || 'income';

    if (!familyId) return errorResponse('MISSING_FIELDS', '缺少 familyId');

    if (resource === 'advances' || action === 'listAll-advances') {
      return await _listAdvances(request, familyId, memberId, action);
    }

    return await _listPersonalIncome(request, familyId, memberId, action);
  } catch (err) {
    return handleError(err);
  }
}

/* ============================================
   POST — 分派
   ============================================ */
export async function onRequestPost({ request }) {
  try {
    const body = await request.json();
    const { familyId, memberId, action, advanceId } = body || {};

    if (!familyId) return errorResponse('MISSING_FIELDS', '缺少 familyId');

    /* 代墊相關 */
    if (advanceId !== undefined || body.resource === 'advances') {
      if (action === 'create')  return await _advanceCreate(request, body);
      if (action === 'update')  return await _advanceUpdate(request, body);
      if (action === 'remove')  return await _advanceRemove(request, body);
    }

    /* 個人收入 */
    if (action === 'save')   return await _incomeSave(request, body);
    if (action === 'remove') return await _incomeRemove(request, body);

    return errorResponse('BAD_REQUEST', `未知的 action：${action}`);
  } catch (err) {
    return handleError(err);
  }
}

export async function onRequestOptions() {
  return handleOptions();
}

/* ============================================
   1. 個人收入 LIST
   ============================================ */
async function _listPersonalIncome(request, familyId, memberId, action) {
  if (action !== 'list') return errorResponse('BAD_REQUEST', 'GET 僅支援 action=list');

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
    return successResponse({ familyId, memberId, income: data || {} });
  }

  if (!isOwner && !isSuper) return errorResponse('FORBIDDEN', '需要 owner 權限才能讀取所有成員收入');

  const all = await dbGet(`families/${familyId}/personal_income`, token);
  return successResponse({ familyId, personalIncome: all || {} });
}

/* ============================================
   2. 個人收入 SAVE / REMOVE
   ============================================ */
async function _incomeSave(request, body) {
  const { familyId, memberId, year, month, amount } = body;
  const missing = requireFields(body, ['familyId', 'memberId', 'year', 'month']);
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

  const num = roundInt(amount);
  if (num <= 0) {
    await dbDelete(path, token);
    return successResponse({ deleted: true });
  }
  const ok = await dbPut(path, num, token);
  if (!ok) return errorResponse('INTERNAL', '寫入失敗');
  return successResponse({ saved: true, amount: num });
}

async function _incomeRemove(request, body) {
  const { familyId, memberId, year, month } = body;
  const missing = requireFields(body, ['familyId', 'memberId', 'year', 'month']);
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
  const ok = await dbDelete(`families/${familyId}/personal_income/${memberId}/${yyyy}/${mm}`, token);
  if (!ok) return errorResponse('INTERNAL', '刪除失敗');
  return successResponse({ removed: true });
}

/* ============================================
   3. 代墊 LIST
   ============================================ */
async function _listAdvances(request, familyId, memberId, action) {
  const auth = await authenticate(request, { needFamily: true });
  if (auth instanceof Response) return auth;
  const { token } = auth;

  if (action === 'listAll' || action === 'listAll-advances') {
    const all = await dbGet(`families/${familyId}/member_advances`, token);
    const flat = [];
    Object.entries(all || {}).forEach(([mid, advances]) => {
      Object.entries(advances || {}).forEach(([advanceId, adv]) => {
        flat.push({ id: advanceId, memberId: mid, ...adv });
      });
    });
    flat.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    return successResponse({ familyId, advances: flat, count: flat.length });
  }

  if (action !== 'list') return errorResponse('BAD_REQUEST', 'GET 僅支援 action=list 或 action=listAll');
  if (!memberId) return errorResponse('MISSING_FIELDS', '缺少 memberId');

  const data = await dbGet(`families/${familyId}/member_advances/${memberId}`, token);
  const list = objToList(data || {}, (a, b) => (a.createdAt || 0) - (b.createdAt || 0));

  return successResponse({ familyId, memberId, advances: list, count: list.length });
}

/* ============================================
   4. 代墊 CREATE / UPDATE / REMOVE
   ============================================ */
async function _advanceCreate(request, body) {
  const { familyId, memberId, data } = body;
  if (!familyId) return errorResponse('MISSING_FIELDS', '缺少 familyId');
  if (!memberId) return errorResponse('MISSING_FIELDS', '缺少 memberId');

  const auth = await authenticate(request, { needFamily: true, body });
  if (auth instanceof Response) return auth;
  const { token } = auth;

  if (!data || typeof data !== 'object') return errorResponse('MISSING_FIELDS', '缺少 data');
  const missing = requireFields(data, ['policyId', 'totalAmount']);
  if (missing) return errorResponse('MISSING_FIELDS', '缺少 policyId 或 totalAmount');

  const totalAmount = roundInt(data.totalAmount);
  if (totalAmount <= 0) return errorResponse('BAD_REQUEST', 'totalAmount 必須大於 0');

  const clean = {
    policyId: String(data.policyId),
    totalAmount,
    remainingAmount: totalAmount,
    startYear: String(data.startYear || ''),
    startMonth: String(data.startMonth || '').padStart(2, '0'),
    note: data.note || '',
    paidMonths: {},
    createdAt: Date.now(),
  };

  const newId = await dbPush(`families/${familyId}/member_advances/${memberId}`, clean, token);
  if (!newId) return errorResponse('INTERNAL', '寫入失敗');
  return successResponse({ id: newId, data: clean });
}

async function _advanceUpdate(request, body) {
  const { familyId, memberId, advanceId, data } = body;
  if (!familyId) return errorResponse('MISSING_FIELDS', '缺少 familyId');
  if (!memberId) return errorResponse('MISSING_FIELDS', '缺少 memberId');
  if (!advanceId) return errorResponse('MISSING_FIELDS', '缺少 advanceId');

  const auth = await authenticate(request, { needFamily: true, body });
  if (auth instanceof Response) return auth;
  const { token } = auth;

  if (!data || typeof data !== 'object') return errorResponse('MISSING_FIELDS', '缺少 data');

  const basePath = `families/${familyId}/member_advances/${memberId}`;
  const existing = await dbGet(`${basePath}/${advanceId}`, token);
  if (!existing) return errorResponse('NOT_FOUND', '找不到此代墊記錄');

  /* 拒絕直接修改 remainingAmount */
  if (data.remainingAmount !== undefined) {
    return errorResponse('FORBIDDEN',
      'remainingAmount 為系統自動計算欄位，不可直接修改。若需調整，請透過保險結算（扣款 / 取消扣款）由系統自動處理。', 403);
  }

  const clean = {};
  if (data.policyId !== undefined) clean.policyId = String(data.policyId);
  if (data.totalAmount !== undefined) {
    const total = roundInt(data.totalAmount);
    if (total <= 0) return errorResponse('BAD_REQUEST', 'totalAmount 必須大於 0');
    clean.totalAmount = total;

    const oldTotal = roundInt(existing.totalAmount);
    const oldRemaining = roundInt(existing.remainingAmount);
    const paidSum = Math.max(0, oldTotal - oldRemaining);
    clean.remainingAmount = Math.max(0, total - paidSum);
  }
  if (data.startYear !== undefined) clean.startYear = String(data.startYear);
  if (data.startMonth !== undefined) clean.startMonth = String(data.startMonth).padStart(2, '0');
  if (data.note !== undefined) clean.note = String(data.note);

  if (Object.keys(clean).length === 0) return errorResponse('BAD_REQUEST', '沒有任何欄位要更新');
  clean.updatedAt = Date.now();

  const ok = await dbPut(`${basePath}/${advanceId}`, { ...existing, ...clean }, token);
  if (!ok) return errorResponse('INTERNAL', '更新失敗');
  return successResponse({ advanceId, data: { ...existing, ...clean } });
}

async function _advanceRemove(request, body) {
  const { familyId, memberId, advanceId } = body;
  if (!familyId) return errorResponse('MISSING_FIELDS', '缺少 familyId');
  if (!memberId) return errorResponse('MISSING_FIELDS', '缺少 memberId');
  if (!advanceId) return errorResponse('MISSING_FIELDS', '缺少 advanceId');

  const auth = await authenticate(request, { needFamily: true, body });
  if (auth instanceof Response) return auth;
  const { token } = auth;

  const basePath = `families/${familyId}/member_advances/${memberId}`;
  const existing = await dbGet(`${basePath}/${advanceId}`, token);
  if (!existing) return errorResponse('NOT_FOUND', '找不到此代墊記錄');

  const ok = await dbDelete(`${basePath}/${advanceId}`, token);
  if (!ok) return errorResponse('INTERNAL', '刪除失敗');
  return successResponse({ removedId: advanceId });
}

/* ============================================
   5. 內部工具：解析當前登入者的 memberId
   ============================================ */
async function _resolveOwnMemberId(familyId, uid, token) {
  const memberAccount = await dbGet(`platform/families/${familyId}/memberAccounts/${uid}`, token);
  if (memberAccount && memberAccount.memberId) return memberAccount.memberId;

  if (memberAccount && memberAccount.displayName) {
    try {
      const members = await dbGet(`families/${familyId}/members`, token);
      if (members && typeof members === 'object') {
        const dn = String(memberAccount.displayName).trim();
        const matched = Object.entries(members).find(([, m]) => String((m && m.name) || '').trim() === dn);
        if (matched) return matched[0];
      }
    } catch (e) { /* noop */ }
  }

  try {
    const members = await dbGet(`families/${familyId}/members`, token);
    if (members && typeof members === 'object') {
      const keys = Object.keys(members);
      if (keys.length === 1) return keys[0];
    }
  } catch (e) { /* noop */ }

  return '';
}
