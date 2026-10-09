// ============================================
// bank-transactions.js — 銀行交易 CRUD API（v102.0.0 🆕）
// 位置：functions/api/bank-transactions.js
// ============================================
// 用途：
//   管理銀行帳號下的交易記錄（入帳 / 出帳 / 內部轉帳）
//
// 請求：
//   GET  /api/bank-transactions?familyId={uid}&bankId={id}&action=list
//   GET  /api/bank-transactions?familyId={uid}&action=listAll
//   POST /api/bank-transactions
//     body: { familyId, bankId, action: 'create' | 'update' | 'remove', txnId?, data? }
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

const VALID_TYPES = ['in', 'out', 'transfer'];
const VALID_CATEGORIES = ['contribution', 'expense', 'insurance', 'reimbursement', 'manual'];

/* ============================================
   GET — 列出交易（單一銀行 / 全部銀行）
   ============================================ */
export async function onRequestGet({ request }) {
  try {
    const url = new URL(request.url);
    const familyId = url.searchParams.get('familyId');
    const bankId = url.searchParams.get('bankId');
    const action = url.searchParams.get('action') || 'list';

    if (!familyId) return errorResponse('MISSING_FIELDS', '缺少 familyId');

    const auth = await authenticate(request, { needFamily: true });
    if (auth instanceof Response) return auth;
    const { token } = auth;

    /* ============================================
       listAll：所有銀行的交易（Dashboard 用）
       ============================================ */
    if (action === 'listAll') {
      const allBanks = await dbGet(`families/${familyId}/bank_accounts`, token);
      const bankMap = allBanks || {};
      const flat = [];

      for (const [bid, bankData] of Object.entries(bankMap)) {
        const txns = bankData.transactions || {};
        Object.entries(txns).forEach(([txnId, txn]) => {
          flat.push({
            id: txnId,
            bankId: bid,
            bankName: bankData.name || '',
            ...txn,
          });
        });
      }

      flat.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

      return successResponse({
        familyId,
        transactions: flat,
        count: flat.length,
      });
    }

    /* ============================================
       list：單一銀行的交易
       ============================================ */
    if (action !== 'list') {
      return errorResponse('BAD_REQUEST', 'GET 僅支援 action=list 或 action=listAll');
    }

    if (!bankId) return errorResponse('MISSING_FIELDS', '缺少 bankId');

    const data = await dbGet(
      `families/${familyId}/bank_accounts/${bankId}/transactions`,
      token
    );
    const list = objToList(data || {}, (a, b) => (a.createdAt || 0) - (b.createdAt || 0));

    return successResponse({
      familyId,
      bankId,
      transactions: list,
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
    const { familyId, bankId, action, txnId, data } = body || {};

    if (!familyId) return errorResponse('MISSING_FIELDS', '缺少 familyId');
    if (!bankId) return errorResponse('MISSING_FIELDS', '缺少 bankId');
    if (!action) return errorResponse('MISSING_FIELDS', '缺少 action');

    const auth = await authenticate(request, { needFamily: true, body });
    if (auth instanceof Response) return auth;
    const { token } = auth;

    // 驗證銀行帳號存在
    const bankSnap = await dbGet(
      `families/${familyId}/bank_accounts/${bankId}`,
      token
    );
    if (!bankSnap) {
      return errorResponse('NOT_FOUND', `找不到銀行帳號 ${bankId}`);
    }

    const basePath = `families/${familyId}/bank_accounts/${bankId}/transactions`;

    switch (action) {
      case 'create':
        return await _handleCreate(basePath, data, token);
      case 'update':
        return await _handleUpdate(basePath, txnId, data, token);
      case 'remove':
        return await _handleRemove(basePath, txnId, token);
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

  const missing = requireFields(data, ['type', 'amount']);
  if (missing) return errorResponse('MISSING_FIELDS', '缺少 type 或 amount');

  if (!VALID_TYPES.includes(data.type)) {
    return errorResponse('BAD_REQUEST', `無效的 type：${data.type}`);
  }

  const category = VALID_CATEGORIES.includes(data.category)
    ? data.category
    : 'manual';

  const clean = {
    type: data.type,
    category,
    amount: roundInt(data.amount),
    date: data.date || new Date().toISOString().slice(0, 10),
    memberId: data.memberId || '',
    refId: data.refId || '',
    note: data.note || '',
    createdAt: Date.now(),
  };

  const newId = await dbPush(basePath, clean, token);
  if (!newId) return errorResponse('INTERNAL', '寫入失敗');

  return successResponse({ id: newId, data: clean });
}

/* ============================================
   內部：UPDATE
   ============================================ */
async function _handleUpdate(basePath, txnId, data, token) {
  if (!txnId) return errorResponse('MISSING_FIELDS', '缺少 txnId');
  if (!data || typeof data !== 'object') {
    return errorResponse('MISSING_FIELDS', '缺少 data');
  }

  const existing = await dbGet(`${basePath}/${txnId}`, token);
  if (!existing) return errorResponse('NOT_FOUND', '找不到此交易');

  const clean = {};
  if (data.type !== undefined) {
    if (!VALID_TYPES.includes(data.type)) {
      return errorResponse('BAD_REQUEST', `無效的 type：${data.type}`);
    }
    clean.type = data.type;
  }
  if (data.category !== undefined) {
    clean.category = VALID_CATEGORIES.includes(data.category) ? data.category : 'manual';
  }
  if (data.amount !== undefined) clean.amount = roundInt(data.amount);
  if (data.date !== undefined) clean.date = String(data.date);
  if (data.memberId !== undefined) clean.memberId = String(data.memberId);
  if (data.refId !== undefined) clean.refId = String(data.refId);
  if (data.note !== undefined) clean.note = String(data.note);

  if (Object.keys(clean).length === 0) {
    return errorResponse('BAD_REQUEST', '沒有任何欄位要更新');
  }

  clean.updatedAt = Date.now();

  const ok = await dbPut(`${basePath}/${txnId}`, { ...existing, ...clean }, token);
  if (!ok) return errorResponse('INTERNAL', '更新失敗');

  return successResponse({ txnId, data: { ...existing, ...clean } });
}

/* ============================================
   內部：REMOVE
   ============================================ */
async function _handleRemove(basePath, txnId, token) {
  if (!txnId) return errorResponse('MISSING_FIELDS', '缺少 txnId');

  const existing = await dbGet(`${basePath}/${txnId}`, token);
  if (!existing) return errorResponse('NOT_FOUND', '找不到此交易');

  const ok = await dbDelete(`${basePath}/${txnId}`, token);
  if (!ok) return errorResponse('INTERNAL', '刪除失敗');

  return successResponse({ removedId: txnId });
}