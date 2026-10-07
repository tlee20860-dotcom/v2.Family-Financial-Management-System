// ============================================
// insurance-sync.js — POST /api/insurance-sync（v101.4）
// 位置：functions/api/insurance-sync.js
// ============================================
// v101.4 修正：
//   ✅ 保險連動自動帶入「第一個類別」（依 order 排序）
//   ✅ 支援 policyHolderId（保單持有人）
//   ✅ 狀態動態化（從 families/{uid}/statuses 讀取）
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
      // 🆕 v101.4
      expenseStatusName,
      paymentStatusName,
    } = body || {};

    // 必填檢查
    const missing = requireFields(body, ['familyId', 'policyId', 'memberId', 'year', 'month']);
    if (missing) return errorResponse('MISSING_FIELDS', '', 400);

    // 權限檢查
    const auth = await authenticate(request, { needFamily: true, body });
    if (auth instanceof Response) return auth;
    const { token } = auth;

    const basePath = `families/${familyId}`;
    const linkedKey = `linked_${policyId}`;
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

    // 讀取家庭狀態清單
    const statuses = await dbGet(`${basePath}/statuses`, token) || {};

    // 🆕 v101.4：讀取家庭類別清單，取「第一個類別」（order 最小）
    const categories = await dbGet(`${basePath}/expense_categories`, token) || {};
    const firstCategoryId = _getFirstCategoryId(categories);

    // 解析最終狀態名稱
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
      categoryId: firstCategoryId,   // 🆕 自動帶入第一個類別
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
 * 依 order 升序排序，取第一個
 * @param {Object} categories - { catId: { name, order } }
 * @returns {string} 類別 ID，或空字串（若無類別）
 */
function _getFirstCategoryId(categories) {
  const list = Object.entries(categories || {})
    .map(([id, c]) => ({ id, ...c }))
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  return list.length > 0 ? list[0].id : '';
}

/**
 * 從狀態清單找出指定類別的「已完成」狀態名稱
 */
function _findDoneStatus(statuses, category) {
  const list = Object.entries(statuses)
    .map(([id, s]) => ({ id, ...s }))
    .filter((s) => s.category === category && s.isDone)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  return list.length > 0 ? list[0].name : null;
}
