// ============================================
// bank-transactions.js — 銀行交易 CRUD API（v102.0.0）
// 位置：functions/api/bank-transactions.js
// ============================================
// v102.0.0 修正：
//   ✅ [P2-4] _handleRemove 刪除前清理來源的 txnId（依 refId 反查）
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
       listAll：所有銀行的交易
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
        return await _handleRemove(basePath, txnId, token, familyId, bankId);
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
   🆕 v102.0.0：內部：REMOVE（含來源清理）
   ============================================ */
async function _handleRemove(basePath, txnId, token, familyId, bankId) {
  if (!txnId) return errorResponse('MISSING_FIELDS', '缺少 txnId');

  const existing = await dbGet(`${basePath}/${txnId}`, token);
  if (!existing) return errorResponse('NOT_FOUND', '找不到此交易');

  // 🆕 P2-4：依 category / refId 反查來源，清理 txnId 引用
  let cleanedSource = null;
  try {
    cleanedSource = await _cleanupSourceRef({
      familyId,
      bankId,
      txnId,
      txn: existing,
      token,
    });
  } catch (err) {
    console.warn('[bank-transactions] 清理來源失敗：', err);
  }

  const ok = await dbDelete(`${basePath}/${txnId}`, token);
  if (!ok) return errorResponse('INTERNAL', '刪除失敗');

  return successResponse({
    removedId: txnId,
    cleanedSource,
  });
}

/* ============================================
   🆕 v102.0.0：內部工具 — 依 refId 反查並清理
   -------------------------------------------------
   依 category 對應來源：
     - 'expense'       → expenses/{year}/{month}/member_expenses/{memberId}/{refId}
     - 'insurance'     → insurance_payments/{refId}/{year}/{month}
     - 'reimbursement' → insurance_payments/{refId}/{year}/{month}
     - 'contribution'  → 無固定 refId（依 memberId + date）
     - 'manual'        → 無
   ============================================ */
async function _cleanupSourceRef({ familyId, bankId, txnId, txn, token }) {
  const { category, refId, memberId, date } = txn;
  const base = `families/${familyId}`;

  /* ---------- 支出 ---------- */
  if (category === 'expense' && refId && memberId && date) {
    const [y, m] = (date || '').split('-');
    if (y && m) {
      const mm = String(m).padStart(2, '0');
      const path = `${base}/expenses/${y}/${mm}/member_expenses/${memberId}/${refId}`;
      const src = await dbGet(path, token);
      if (src && src.txnId === txnId) {
        await dbPut(path, { ...src, txnId: '' }, token);
        return { type: 'expense', path, clearedTxnId: true };
      }
    }
  }

  /* ---------- 保險 / 代墊還款 ---------- */
  if ((category === 'insurance' || category === 'reimbursement') && refId && date) {
    const [y, m] = (date || '').split('-');
    if (y && m) {
      const mm = String(m).padStart(2, '0');
      const path = `${base}/insurance_payments/${refId}/${y}/${mm}`;
      const src = await dbGet(path, token);
      if (src && src.txnId === txnId) {
        await dbPut(path, { ...src, txnId: '' }, token);
        return { type: 'insurance_payment', path, clearedTxnId: true };
      }
    }
  }

  /* ---------- 家用轉入 ---------- */
  if (category === 'contribution' && date) {
    // 家用轉入無固定 refId，僅記錄清理事件
    return { type: 'contribution', note: '來源為 income 節點，無需清理 refId' };
  }

  return null;
}
