// ============================================
// bank-accounts.js — 銀行帳號 CRUD API（v102.0.0 🆕）
// 位置：functions/api/bank-accounts.js
// ============================================
// 用途：
//   管理家庭的銀行帳號（家庭帳號 / 個人帳號）
//
// 請求：
//   GET  /api/bank-accounts?familyId={uid}&action=list
//   POST /api/bank-accounts
//     body: { familyId, action: 'create' | 'update' | 'remove', id?, data? }
//
// 權限：
//   - superadmin：可讀寫任何家庭
//   - 家庭成員：可讀寫自己家庭
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
   GET — 列出銀行帳號
   ============================================ */
export async function onRequestGet({ request }) {
  try {
    const url = new URL(request.url);
    const familyId = url.searchParams.get('familyId');
    const action = url.searchParams.get('action') || 'list';

    if (!familyId) return errorResponse('MISSING_FIELDS', '缺少 familyId');
    if (action !== 'list') {
      return errorResponse('BAD_REQUEST', 'GET 僅支援 action=list');
    }

    const auth = await authenticate(request, { needFamily: true });
    if (auth instanceof Response) return auth;
    const { token } = auth;

    const data = await dbGet(`families/${familyId}/bank_accounts`, token);
    const list = objToList(data || {}, (a, b) => {
      const oa = a.order != null ? a.order : Number.MAX_SAFE_INTEGER;
      const ob = b.order != null ? b.order : Number.MAX_SAFE_INTEGER;
      if (oa !== ob) return oa - ob;
      return (a.createdAt || 0) - (b.createdAt || 0);
    });

    return successResponse({
      familyId,
      accounts: list,
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
    const { familyId, action, id, data } = body || {};

    if (!familyId) return errorResponse('MISSING_FIELDS', '缺少 familyId');
    if (!action) return errorResponse('MISSING_FIELDS', '缺少 action');

    const auth = await authenticate(request, { needFamily: true, body });
    if (auth instanceof Response) return auth;
    const { token } = auth;

    // 驗證家庭存在
    const familySnap = await dbGet(`platform/families/${familyId}`, token);
    if (!familySnap) {
      return errorResponse('NOT_FOUND', `找不到家庭 ${familyId}`);
    }

    const basePath = `families/${familyId}/bank_accounts`;

    switch (action) {
      case 'create':
        return await _handleCreate(basePath, data, token);
      case 'update':
        return await _handleUpdate(basePath, id, data, token);
      case 'remove':
        return await _handleRemove(basePath, id, token);
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

  const missing = requireFields(data, ['name']);
  if (missing) return errorResponse('MISSING_FIELDS', '缺少 name');

  const clean = {
    name: String(data.name).trim(),
    type: ['family', 'personal'].includes(data.type) ? data.type : 'family',
    initialBalance: roundInt(data.initialBalance),
    initialYear: String(data.initialYear || new Date().getFullYear()),
    initialMonth: String(data.initialMonth || '01').padStart(2, '0'),
    order: Number(data.order) || 0,
    createdAt: Date.now(),
  };

  const newId = await dbPush(basePath, clean, token);
  if (!newId) return errorResponse('INTERNAL', '寫入失敗');

  return successResponse({ id: newId, data: clean });
}

/* ============================================
   內部：UPDATE
   ============================================ */
async function _handleUpdate(basePath, id, data, token) {
  if (!id) return errorResponse('MISSING_FIELDS', '缺少 id');
  if (!data || typeof data !== 'object') {
    return errorResponse('MISSING_FIELDS', '缺少 data');
  }

  const existing = await dbGet(`${basePath}/${id}`, token);
  if (!existing) return errorResponse('NOT_FOUND', '找不到此銀行帳號');

  const clean = {};
  if (data.name !== undefined) clean.name = String(data.name).trim();
  if (data.type !== undefined && ['family', 'personal'].includes(data.type)) {
    clean.type = data.type;
  }
  if (data.initialBalance !== undefined) clean.initialBalance = roundInt(data.initialBalance);
  if (data.initialYear !== undefined) clean.initialYear = String(data.initialYear);
  if (data.initialMonth !== undefined) {
    clean.initialMonth = String(data.initialMonth).padStart(2, '0');
  }
  if (data.order !== undefined) clean.order = Number(data.order) || 0;

  if (Object.keys(clean).length === 0) {
    return errorResponse('BAD_REQUEST', '沒有任何欄位要更新');
  }

  clean.updatedAt = Date.now();

  const ok = await dbPut(`${basePath}/${id}`, { ...existing, ...clean }, token);
  if (!ok) return errorResponse('INTERNAL', '更新失敗');

  return successResponse({ id, data: { ...existing, ...clean } });
}

/* ============================================
   內部：REMOVE
   ============================================ */
async function _handleRemove(basePath, id, token) {
  if (!id) return errorResponse('MISSING_FIELDS', '缺少 id');

  const existing = await dbGet(`${basePath}/${id}`, token);
  if (!existing) return errorResponse('NOT_FOUND', '找不到此銀行帳號');

  // 檢查是否有交易記錄（可選：警告但允許刪除）
  const txns = await dbGet(`${basePath}/${id}/transactions`, token);
  const txnCount = txns ? Object.keys(txns).length : 0;

  // 直接刪除帳號（連同交易）
  const ok = await dbDelete(`${basePath}/${id}`, token);
  if (!ok) return errorResponse('INTERNAL', '刪除失敗');

  return successResponse({
    removedId: id,
    removedTxnCount: txnCount,
  });
}