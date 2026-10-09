// ============================================
// member-advances.js — 成員代墊 API（v102.1.0）
// 位置：functions/api/member-advances.js
// ============================================
// v102.1.0 修正：
//   ✅ [P3-13] _handleUpdate 不再允許直接修改 remainingAmount
//       remainingAmount 只能由 insurance-sync.js 系統自動更新
//   ✅ 保留 v102.0.0 全部功能
// ============================================

import { dbGet, dbPut, dbPush, dbDelete } from './_config.js';
import {
  authenticate,
  errorResponse,
  handleError,
  handleOptions,
  successResponse,
  requireFields,
  objToList,
  roundInt,
} from './_helpers.js';

/* ============================================
   GET — 列出代墊記錄
   ============================================ */
export async function onRequestGet({ request }) {
  try {
    const url = new URL(request.url);
    const familyId = url.searchParams.get('familyId');
    const memberId = url.searchParams.get('memberId');
    const action = url.searchParams.get('action') || 'list';

    if (!familyId) return errorResponse('MISSING_FIELDS', '缺少 familyId');

    const auth = await authenticate(request, { needFamily: true });
    if (auth instanceof Response) return auth;
    const { token } = auth;

    if (action === 'listAll') {
      const all = await dbGet(`families/${familyId}/member_advances`, token);
      const flat = [];
      Object.entries(all || {}).forEach(([mid, advances]) => {
        Object.entries(advances || {}).forEach(([advanceId, adv]) => {
          flat.push({ id: advanceId, memberId: mid, ...adv });
        });
      });
      flat.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      return successResponse({
        familyId,
        advances: flat,
        count: flat.length,
      });
    }

    if (action !== 'list') {
      return errorResponse('BAD_REQUEST', 'GET 僅支援 action=list 或 action=listAll');
    }

    if (!memberId) return errorResponse('MISSING_FIELDS', '缺少 memberId');

    const data = await dbGet(`families/${familyId}/member_advances/${memberId}`, token);
    const list = objToList(data || {}, (a, b) => (a.createdAt || 0) - (b.createdAt || 0));

    return successResponse({
      familyId,
      memberId,
      advances: list,
      count: list.length,
    });
  } catch (err) {
    return handleError(err);
  }
}

/* ============================================
   POST — create / update / remove
   ============================================ */
export async function onRequestPost({ request }) {
  try {
    const body = await request.json();
    const { familyId, memberId, action, advanceId, data } = body || {};

    if (!familyId) return errorResponse('MISSING_FIELDS', '缺少 familyId');
    if (!memberId) return errorResponse('MISSING_FIELDS', '缺少 memberId');
    if (!action) return errorResponse('MISSING_FIELDS', '缺少 action');

    const auth = await authenticate(request, { needFamily: true, body });
    if (auth instanceof Response) return auth;
    const { token } = auth;

    const basePath = `families/${familyId}/member_advances/${memberId}`;

    switch (action) {
      case 'create':
        return await _handleCreate(basePath, data, token);
      case 'update':
        return await _handleUpdate(basePath, advanceId, data, token);
      case 'remove':
        return await _handleRemove(basePath, advanceId, token);
      default:
        return errorResponse('BAD_REQUEST', `未知的 action：${action}`);
    }
  } catch (err) {
    return handleError(err);
  }
}

export async function onRequestOptions() {
  return handleOptions();
}

/* ============================================
   內部：CREATE
   ============================================ */
async function _handleCreate(basePath, data, token) {
  if (!data || typeof data !== 'object') {
    return errorResponse('MISSING_FIELDS', '缺少 data');
  }

  const missing = requireFields(data, ['policyId', 'totalAmount']);
  if (missing) return errorResponse('MISSING_FIELDS', '缺少 policyId 或 totalAmount');

  const totalAmount = roundInt(data.totalAmount);
  if (totalAmount <= 0) {
    return errorResponse('BAD_REQUEST', 'totalAmount 必須大於 0');
  }

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

  const newId = await dbPush(basePath, clean, token);
  if (!newId) return errorResponse('INTERNAL', '寫入失敗');

  return successResponse({ id: newId, data: clean });
}

/* ============================================
   🆕 P3-13：內部：UPDATE（限制 remainingAmount）
   ============================================ */
async function _handleUpdate(basePath, advanceId, data, token) {
  if (!advanceId) return errorResponse('MISSING_FIELDS', '缺少 advanceId');
  if (!data || typeof data !== 'object') {
    return errorResponse('MISSING_FIELDS', '缺少 data');
  }

  const existing = await dbGet(`${basePath}/${advanceId}`, token);
  if (!existing) return errorResponse('NOT_FOUND', '找不到此代墊記錄');

  // 🆕 P3-13：拒絕直接修改 remainingAmount
  if (data.remainingAmount !== undefined) {
    return errorResponse(
      'FORBIDDEN',
      'remainingAmount 為系統自動計算欄位，不可直接修改。' +
      '若需調整，請透過保險結算（扣款 / 取消扣款）由系統自動處理。',
      403
    );
  }

  const clean = {};
  if (data.policyId !== undefined) clean.policyId = String(data.policyId);
  if (data.totalAmount !== undefined) {
    const total = roundInt(data.totalAmount);
    if (total <= 0) {
      return errorResponse('BAD_REQUEST', 'totalAmount 必須大於 0');
    }
    clean.totalAmount = total;

    // 若更新 totalAmount，remainingAmount 需同步重算（= total - 已扣減總額）
    const paidMonths = (existing.paidMonths && typeof existing.paidMonths === 'object')
      ? existing.paidMonths
      : {};
    const paidCount = Object.keys(paidMonths).length;
    const oldTotal = roundInt(existing.totalAmount);
    const oldRemaining = roundInt(existing.remainingAmount);
    const paidSum = Math.max(0, oldTotal - oldRemaining);
    clean.remainingAmount = Math.max(0, total - paidSum);
  }
  if (data.startYear !== undefined) clean.startYear = String(data.startYear);
  if (data.startMonth !== undefined) {
    clean.startMonth = String(data.startMonth).padStart(2, '0');
  }
  if (data.note !== undefined) clean.note = String(data.note);

  if (Object.keys(clean).length === 0) {
    return errorResponse('BAD_REQUEST', '沒有任何欄位要更新');
  }

  clean.updatedAt = Date.now();

  const ok = await dbPut(`${basePath}/${advanceId}`, { ...existing, ...clean }, token);
  if (!ok) return errorResponse('INTERNAL', '更新失敗');

  return successResponse({ advanceId, data: { ...existing, ...clean } });
}

/* ============================================
   內部：REMOVE
   ============================================ */
async function _handleRemove(basePath, advanceId, token) {
  if (!advanceId) return errorResponse('MISSING_FIELDS', '缺少 advanceId');

  const existing = await dbGet(`${basePath}/${advanceId}`, token);
  if (!existing) return errorResponse('NOT_FOUND', '找不到此代墊記錄');

  const ok = await dbDelete(`${basePath}/${advanceId}`, token);
  if (!ok) return errorResponse('INTERNAL', '刪除失敗');

  return successResponse({ removedId: advanceId });
}
