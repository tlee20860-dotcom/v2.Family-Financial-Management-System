// ============================================
// bank.js — 銀行帳號 + 交易 + 清除舊結餘（v103.0.0）
// 位置：functions/api/bank.js
// ============================================
// v103.0.0 合併：
//   ✅ 合併 bank-accounts.js + bank-transactions.js + clear-bank-balances.js
//   ✅ 內部透過 ?action= 分派
//   ✅ 舊 URL 路徑保持不變
// ============================================

import { dbGet, dbPut, dbPush, dbDelete } from './_config.js';
import {
  authenticate, errorResponse, handleError, handleOptions,
  successResponse, requireFields, objToList, roundInt,
} from './_helpers.js';

const VALID_TYPES = ['in', 'out', 'transfer'];
const VALID_CATEGORIES = ['contribution', 'expense', 'insurance', 'reimbursement', 'manual'];
const CONFIRM_TOKEN = 'CONFIRM_DELETE';

/* ============================================
   GET — 分派
   ============================================ */
export async function onRequestGet({ request }) {
  try {
    const url = new URL(request.url);
    const familyId = url.searchParams.get('familyId');
    const bankId = url.searchParams.get('bankId');
    const action = url.searchParams.get('action') || 'accounts-list';
    const resource = url.searchParams.get('resource') || 'accounts';

    if (!familyId) return errorResponse('MISSING_FIELDS', '缺少 familyId');

    /* 交易相關 */
    if (action === 'list' && bankId) return await _listBankTransactions(request, familyId, bankId);
    if (action === 'listAll') return await _listAllBankTransactions(request, familyId);

    /* 帳號列表（預設） */
    return await _listBankAccounts(request, familyId);
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
    const { familyId, bankId, action, txnId, id, data, confirm } = body || {};

    if (!familyId) return errorResponse('MISSING_FIELDS', '缺少 familyId');

    /* 清除舊結餘 */
    if (action === 'clear-old-balances') {
      return await _clearOldBalances(request, body);
    }

    /* 交易 CRUD */
    if (bankId && (action === 'create' || action === 'update' || action === 'remove') && txnId !== undefined) {
      return await _txnCreate(request, body);
    }
    if (bankId && action === 'create') return await _txnCreate(request, body);
    if (bankId && action === 'update') return await _txnUpdate(request, body);
    if (bankId && action === 'remove') return await _txnRemove(request, body);

    /* 帳號 CRUD */
    if (action === 'create') return await _accCreate(request, body);
    if (action === 'update') return await _accUpdate(request, body);
    if (action === 'remove') return await _accRemove(request, body);

    return errorResponse('BAD_REQUEST', `未知的 action：${action}`);
  } catch (err) {
    return handleError(err);
  }
}

export async function onRequestOptions() {
  return handleOptions();
}

/* ============================================
   1. 帳號列表
   ============================================ */
async function _listBankAccounts(request, familyId) {
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

  return successResponse({ familyId, accounts: list, count: list.length });
}

/* ============================================
   2. 帳號 CREATE
   ============================================ */
async function _accCreate(request, body) {
  const { familyId, data } = body;
  const auth = await authenticate(request, { needFamily: true, body });
  if (auth instanceof Response) return auth;
  const { token } = auth;

  if (!data || typeof data !== 'object') return errorResponse('MISSING_FIELDS', '缺少 data');
  const missing = requireFields(data, ['name']);
  if (missing) return errorResponse('MISSING_FIELDS', '缺少 name');

  const familySnap = await dbGet(`platform/families/${familyId}`, token);
  if (!familySnap) return errorResponse('NOT_FOUND', `找不到家庭 ${familyId}`);

  const clean = {
    name: String(data.name).trim(),
    type: ['family', 'personal'].includes(data.type) ? data.type : 'family',
    initialBalance: roundInt(data.initialBalance),
    initialYear: String(data.initialYear || new Date().getFullYear()),
    initialMonth: String(data.initialMonth || '01').padStart(2, '0'),
    order: Number(data.order) || 0,
    createdAt: Date.now(),
  };

  const newId = await dbPush(`families/${familyId}/bank_accounts`, clean, token);
  if (!newId) return errorResponse('INTERNAL', '寫入失敗');
  return successResponse({ id: newId, data: clean });
}

/* ============================================
   3. 帳號 UPDATE
   ============================================ */
async function _accUpdate(request, body) {
  const { familyId, id, data } = body;
  const auth = await authenticate(request, { needFamily: true, body });
  if (auth instanceof Response) return auth;
  const { token } = auth;

  if (!id) return errorResponse('MISSING_FIELDS', '缺少 id');
  if (!data || typeof data !== 'object') return errorResponse('MISSING_FIELDS', '缺少 data');

  const basePath = `families/${familyId}/bank_accounts`;
  const existing = await dbGet(`${basePath}/${id}`, token);
  if (!existing) return errorResponse('NOT_FOUND', '找不到此銀行帳號');

  const clean = {};
  if (data.name !== undefined) clean.name = String(data.name).trim();
  if (data.type !== undefined && ['family', 'personal'].includes(data.type)) clean.type = data.type;
  if (data.initialBalance !== undefined) clean.initialBalance = roundInt(data.initialBalance);
  if (data.initialYear !== undefined) clean.initialYear = String(data.initialYear);
  if (data.initialMonth !== undefined) clean.initialMonth = String(data.initialMonth).padStart(2, '0');
  if (data.order !== undefined) clean.order = Number(data.order) || 0;

  if (Object.keys(clean).length === 0) return errorResponse('BAD_REQUEST', '沒有任何欄位要更新');
  clean.updatedAt = Date.now();

  const ok = await dbPut(`${basePath}/${id}`, { ...existing, ...clean }, token);
  if (!ok) return errorResponse('INTERNAL', '更新失敗');
  return successResponse({ id, data: { ...existing, ...clean } });
}

/* ============================================
   4. 帳號 REMOVE（含引用檢查）
   ============================================ */
async function _accRemove(request, body) {
  const { familyId, id } = body;
  const auth = await authenticate(request, { needFamily: true, body });
  if (auth instanceof Response) return auth;
  const { token } = auth;

  if (!id) return errorResponse('MISSING_FIELDS', '缺少 id');

  const basePath = `families/${familyId}/bank_accounts`;
  const existing = await dbGet(`${basePath}/${id}`, token);
  if (!existing) return errorResponse('NOT_FOUND', '找不到此銀行帳號');

  const txns = await dbGet(`${basePath}/${id}/transactions`, token);
  const txnCount = txns ? Object.keys(txns).length : 0;

  const refCount = await _countBankReferences(familyId, id, token);
  if (refCount > 0) {
    return errorResponse('CONFLICT',
      `此銀行帳號仍被 ${refCount} 筆記錄引用（支出 / 保險扣款），請先移除引用或改用「強制刪除」。`, 409);
  }

  const ok = await dbDelete(`${basePath}/${id}`, token);
  if (!ok) return errorResponse('INTERNAL', '刪除失敗');
  return successResponse({ removedId: id, removedTxnCount: txnCount });
}

async function _countBankReferences(familyId, bankId, token) {
  const familyBase = `families/${familyId}`;
  let count = 0;

  try {
    const expensesSnap = await dbGet(`${familyBase}/expenses`, token);
    if (expensesSnap && typeof expensesSnap === 'object') {
      Object.values(expensesSnap).forEach((months) => {
        Object.values(months || {}).forEach((monthData) => {
          Object.values(monthData?.member_expenses || {}).forEach((items) => {
            Object.values(items || {}).forEach((e) => {
              if (e && e.bankId === bankId) count++;
            });
          });
        });
      });
    }
  } catch (err) { /* noop */ }

  try {
    const paymentsSnap = await dbGet(`${familyBase}/insurance_payments`, token);
    if (paymentsSnap && typeof paymentsSnap === 'object') {
      Object.values(paymentsSnap).forEach((years) => {
        Object.values(years || {}).forEach((months) => {
          Object.values(months || {}).forEach((p) => {
            if (p && p.bankId === bankId) count++;
          });
        });
      });
    }
  } catch (err) { /* noop */ }

  return count;
}

/* ============================================
   5. 交易 LIST
   ============================================ */
async function _listBankTransactions(request, familyId, bankId) {
  const auth = await authenticate(request, { needFamily: true });
  if (auth instanceof Response) return auth;
  const { token } = auth;

  const data = await dbGet(`families/${familyId}/bank_accounts/${bankId}/transactions`, token);
  const list = objToList(data || {}, (a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  return successResponse({ familyId, bankId, transactions: list, count: list.length });
}

async function _listAllBankTransactions(request, familyId) {
  const auth = await authenticate(request, { needFamily: true });
  if (auth instanceof Response) return auth;
  const { token } = auth;

  const allBanks = await dbGet(`families/${familyId}/bank_accounts`, token);
  const bankMap = allBanks || {};
  const flat = [];

  for (const [bid, bankData] of Object.entries(bankMap)) {
    const txns = bankData.transactions || {};
    Object.entries(txns).forEach(([txnId, txn]) => {
      flat.push({ id: txnId, bankId: bid, bankName: bankData.name || '', ...txn });
    });
  }
  flat.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

  return successResponse({ familyId, transactions: flat, count: flat.length });
}

/* ============================================
   6. 交易 CREATE / UPDATE / REMOVE
   ============================================ */
async function _txnCreate(request, body) {
  const { familyId, bankId, data } = body;
  const auth = await authenticate(request, { needFamily: true, body });
  if (auth instanceof Response) return auth;
  const { token } = auth;

  if (!data || typeof data !== 'object') return errorResponse('MISSING_FIELDS', '缺少 data');
  const missing = requireFields(data, ['type', 'amount']);
  if (missing) return errorResponse('MISSING_FIELDS', '缺少 type 或 amount');
  if (!VALID_TYPES.includes(data.type)) return errorResponse('BAD_REQUEST', `無效的 type：${data.type}`);

  const bankSnap = await dbGet(`families/${familyId}/bank_accounts/${bankId}`, token);
  if (!bankSnap) return errorResponse('NOT_FOUND', `找不到銀行帳號 ${bankId}`);

  const category = VALID_CATEGORIES.includes(data.category) ? data.category : 'manual';
  const clean = {
    type: data.type, category,
    amount: roundInt(data.amount),
    date: data.date || new Date().toISOString().slice(0, 10),
    memberId: data.memberId || '',
    refId: data.refId || '', note: data.note || '',
    createdAt: Date.now(),
  };

  const newId = await dbPush(`families/${familyId}/bank_accounts/${bankId}/transactions`, clean, token);
  if (!newId) return errorResponse('INTERNAL', '寫入失敗');
  return successResponse({ id: newId, data: clean });
}

async function _txnUpdate(request, body) {
  const { familyId, bankId, txnId, data } = body;
  const auth = await authenticate(request, { needFamily: true, body });
  if (auth instanceof Response) return auth;
  const { token } = auth;

  if (!txnId) return errorResponse('MISSING_FIELDS', '缺少 txnId');
  if (!data || typeof data !== 'object') return errorResponse('MISSING_FIELDS', '缺少 data');

  const basePath = `families/${familyId}/bank_accounts/${bankId}/transactions`;
  const existing = await dbGet(`${basePath}/${txnId}`, token);
  if (!existing) return errorResponse('NOT_FOUND', '找不到此交易');

  const clean = {};
  if (data.type !== undefined) {
    if (!VALID_TYPES.includes(data.type)) return errorResponse('BAD_REQUEST', `無效的 type：${data.type}`);
    clean.type = data.type;
  }
  if (data.category !== undefined) clean.category = VALID_CATEGORIES.includes(data.category) ? data.category : 'manual';
  if (data.amount !== undefined) clean.amount = roundInt(data.amount);
  if (data.date !== undefined) clean.date = String(data.date);
  if (data.memberId !== undefined) clean.memberId = String(data.memberId);
  if (data.refId !== undefined) clean.refId = String(data.refId);
  if (data.note !== undefined) clean.note = String(data.note);

  if (Object.keys(clean).length === 0) return errorResponse('BAD_REQUEST', '沒有任何欄位要更新');
  clean.updatedAt = Date.now();

  const ok = await dbPut(`${basePath}/${txnId}`, { ...existing, ...clean }, token);
  if (!ok) return errorResponse('INTERNAL', '更新失敗');
  return successResponse({ txnId, data: { ...existing, ...clean } });
}

async function _txnRemove(request, body) {
  const { familyId, bankId, txnId } = body;
  const auth = await authenticate(request, { needFamily: true, body });
  if (auth instanceof Response) return auth;
  const { token } = auth;

  if (!txnId) return errorResponse('MISSING_FIELDS', '缺少 txnId');

  const basePath = `families/${familyId}/bank_accounts/${bankId}/transactions`;
  const existing = await dbGet(`${basePath}/${txnId}`, token);
  if (!existing) return errorResponse('NOT_FOUND', '找不到此交易');

  let cleanedSource = null;
  try {
    cleanedSource = await _cleanupSourceRef({ familyId, bankId, txnId, txn: existing, token });
  } catch (err) { /* noop */ }

  const ok = await dbDelete(`${basePath}/${txnId}`, token);
  if (!ok) return errorResponse('INTERNAL', '刪除失敗');
  return successResponse({ removedId: txnId, cleanedSource });
}

async function _cleanupSourceRef({ familyId, bankId, txnId, txn, token }) {
  const { category, refId, memberId, date } = txn;
  const base = `families/${familyId}`;

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

  if (category === 'contribution' && date) {
    return { type: 'contribution', note: '來源為 income 節點，無需清理 refId' };
  }

  return null;
}

/* ============================================
   7. 清除舊銀行結餘
   ============================================ */
async function _clearOldBalances(request, body) {
  const { familyId, confirm } = body;
  if (!familyId) return errorResponse('MISSING_FIELDS', '缺少 familyId');
  if (confirm !== CONFIRM_TOKEN) {
    return errorResponse('BAD_REQUEST', '必須提供確認參數 confirm="CONFIRM_DELETE"');
  }

  const auth = await authenticate(request, { needFamily: true, body });
  if (auth instanceof Response) return auth;
  const { token, isSuper, isOwner } = auth;

  if (!isSuper && !isOwner) {
    return errorResponse('FORBIDDEN', '只有家庭擁有者才能執行此操作');
  }

  const existing = await dbGet(`families/${familyId}/bank_balances`, token);
  if (!existing) return successResponse({ cleared: false, message: '無舊銀行結餘資料' });

  let recordCount = 0;
  Object.values(existing).forEach((months) => {
    Object.values(months || {}).forEach((banks) => {
      recordCount += Object.keys(banks || {}).length;
    });
  });

  const ok = await dbDelete(`families/${familyId}/bank_balances`, token);
  if (!ok) return errorResponse('INTERNAL', '刪除失敗');

  return successResponse({
    cleared: true, recordCount,
    message: `已清除 ${recordCount} 筆舊銀行結餘紀錄`,
  });
}
