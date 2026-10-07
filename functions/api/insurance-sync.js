// ============================================
// insurance-sync.js — POST /api/insurance-sync（v101）
// 位置：functions/api/insurance-sync.js
// ============================================
// v101 修正：
//   ✅ 加 token 驗證 + 家庭權限檢查
//   ✅ 狀態動態化（從 families/{uid}/statuses 讀取，不再硬編碼）
//   ✅ 允許 body 傳入自訂 statusName
//   ✅ 統一路徑組裝 / 金額 roundInt
// ============================================

import { dbGet, dbPut, dbDelete } from './_config.js';
import {
  authenticate,
  errorResponse,
  handleError,
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
      // 🆕 v101：允許自訂狀態名稱
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

    // 讀取家庭狀態清單（動態決定狀態名稱）
    const statuses = await dbGet(`${basePath}/statuses`, token) || {};

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
      categoryId: '',
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
    });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * 處理 OPTIONS preflight
 */
export async function onRequestOptions() {
  const { handleOptions } = await import('./_config.js');
  return handleOptions();
}

/* ============================================
   內部工具
   ============================================ */

/**
 * 從狀態清單找出指定類別的「已完成」狀態名稱
 * @param {Object} statuses - { id: { name, category, isDone } }
 * @param {'personal'|'fixed'|'insurance'} category
 * @returns {string|null}
 */
function _findDoneStatus(statuses, category) {
  const list = Object.entries(statuses)
    .map(([id, s]) => ({ id, ...s }))
    .filter((s) => s.category === category && s.isDone)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  return list.length > 0 ? list[0].name : null;
}