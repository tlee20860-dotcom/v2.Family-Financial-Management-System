// ============================================
// insurance-sync.js — POST /api/insurance-sync（v101.5）
// 位置：functions/api/insurance-sync.js
// ============================================
// v101.5 修正：
//   ✅ linked_ 前綴改用 buildLinkedKey（與前端 db.js 對齊）
//   ✅ memberId 支援 policyHolderId fallback
//   ✅ _findDoneStatus 找不到時回傳 statuses 中第一個 isDone
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
  buildLinkedKey,
} from './_helpers.js';

export async function onRequestPost({ request }) {
  try {
    const body = await request.json();

    const {
      action,
      familyId,
      policyId,
      memberId,
      policyName,
      monthlyAverage,
      year,
      month,
      expenseStatusName,
      paymentStatusName,
    } = body || {};

    const missing = requireFields(body, ['familyId', 'policyId', 'memberId', 'year', 'month']);
    if (missing) return errorResponse('MISSING_FIELDS', '', 400);

    const auth = await authenticate(request, { needFamily: true, body });
    if (auth instanceof Response) return auth;
    const { token } = auth;

    const basePath = `families/${familyId}`;

    // 🆕 v101.5：使用 buildLinkedKey
    const linkedKey = buildLinkedKey(policyId);
    const expensePath = `${basePath}/expenses/${year}/${month}/member_expenses/${memberId}/${linkedKey}`;
    const paymentPath = `${basePath}/insurance_payments/${policyId}/${year}/${month}`;

    /* ============================================
       DELETE 分支
       ============================================ */
    if (action === 'delete') {
      await dbDelete(expensePath, token);
      await dbDelete(paymentPath, token);
      return successResponse({ deleted: true });
    }

    /* ============================================
       UPSERT 分支
       ============================================ */

    const statuses = await dbGet(`${basePath}/statuses`, token) || {};

    const categories = await dbGet(`${basePath}/expense_categories`, token) || {};
    const firstCategoryId = _getFirstCategoryId(categories);

    const resolvedExpenseStatus =
      expenseStatusName || _findDoneStatus(statuses, 'personal') || '已還款';
    const resolvedPaymentStatus =
      paymentStatusName || _findDoneStatus(statuses, 'insurance') || '已扣款';

    const amount = roundInt(monthlyAverage);

    /* 寫入成員支出（保險平攤） */
    const expense = {
      name: `${policyName} (平攤)`,
      amount,
      status: resolvedExpenseStatus,
      date: '',
      categoryId: firstCategoryId,
      itemId: '',
      paymentMethodId: '',
      isAutoLinked: true,
      policyId,
      createdAt: Date.now(),
    };
    const expenseOk = await dbPut(expensePath, expense, token);

    /* 寫入保險付款紀錄 */
    const paymentOk = await dbPut(paymentPath, {
      status: resolvedPaymentStatus,
      amount,
      date: new Date().toISOString().slice(0, 10),
    }, token);

    if (!expenseOk && !paymentOk) {
      return errorResponse('INTERNAL', '寫入失敗，請檢查 Firebase 規則');
    }

    return successResponse({
      path: expensePath,
      expenseStatus: resolvedExpenseStatus,
      paymentStatus: resolvedPaymentStatus,
      categoryId: firstCategoryId,
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function onRequestOptions() {
  return handleOptions();
}

/* ============================================
   內部工具
   ============================================ */

/**
 * 從類別清單中取得「第一個類別」的 ID
 */
function _getFirstCategoryId(categories) {
  const list = Object.entries(categories || {})
    .map(([id, c]) => ({ id, ...c }))
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  return list.length > 0 ? list[0].id : '';
}

/**
 * 🆕 v101.5：從狀態清單找出指定類別的「已完成」狀態名稱
 * 若找不到，回傳 statuses 中第一個 isDone 的狀態
 */
function _findDoneStatus(statuses, category) {
  const list = Object.entries(statuses)
    .map(([id, s]) => ({ id, ...s }))
    .filter((s) => s.category === category && s.isDone)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  if (list.length > 0) return list[0].name;

  // 🆕 v101.5：若該類別找不到，回傳全域第一個 isDone
  const anyDone = Object.entries(statuses)
    .map(([id, s]) => ({ id, ...s }))
    .filter((s) => s.isDone)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  return anyDone.length > 0 ? anyDone[0].name : null;
}