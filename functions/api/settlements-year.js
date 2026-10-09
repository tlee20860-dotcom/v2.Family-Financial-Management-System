// ============================================
// settlements-year.js — 結算清單年度聚合 API（v102.0.0）
// 位置：functions/api/settlements-year.js
// ============================================
// v102.0.0 修正：
//   ✅ [P1-1] memberExpensesByMonth 補回 bankId / txnId
//   ✅ 保留 v101.10.0 全部功能
// ============================================

import { dbGet, jsonResponse } from './_config.js';
import {
  authenticate,
  errorResponse,
  handleError,
  handleOptions,
  roundInt,
} from './_helpers.js';

export async function onRequestGet({ request }) {
  try {
    const url = new URL(request.url);
    const familyId = url.searchParams.get('familyId');
    const year = url.searchParams.get('year');

    if (!familyId) return errorResponse('MISSING_FIELDS', '缺少 familyId');
    if (!year || !/^\d{4}$/.test(year)) {
      return errorResponse('MISSING_FIELDS', 'year 格式錯誤（yyyy）');
    }

    const auth = await authenticate(request, { needFamily: true });
    if (auth instanceof Response) return auth;
    const { token } = auth;

    const basePath = `families/${familyId}`;

    // 平行讀取三個節點
    const [expensesSnap, policiesSnap, paymentsSnap] = await Promise.all([
      dbGet(`${basePath}/expenses/${year}`, token),
      dbGet(`${basePath}/insurance_policies`, token),
      dbGet(`${basePath}/insurance_payments`, token),
    ]);

    const expensesObj = expensesSnap || {};
    const policiesObj = policiesSnap || {};
    const paymentsObj = paymentsSnap || {};

    // 構建 memberExpensesByMonth（每月一個陣列，含 memberId）
    const memberExpensesByMonth = {};
    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, '0');
      const monthData = expensesObj[mm]?.member_expenses || {};
      const rows = [];
      Object.entries(monthData).forEach(([memberId, items]) => {
        Object.entries(items || {}).forEach(([id, e]) => {
          rows.push({
            id,
            memberId,
            name: e.name || '',
            amount: roundInt(e.amount),
            status: e.status || '',
            date: e.date || '',
            categoryId: e.categoryId || '',
            itemId: e.itemId || '',
            paymentMethodId: e.paymentMethodId || '',
            isAutoLinked: !!e.isAutoLinked,
            policyId: e.policyId || '',
            bankId: e.bankId || '',                       // 🆕 v102.0.0
            txnId: e.txnId || '',                         // 🆕 v102.0.0
            repaidDate: e.repaidDate || '',
            createdAt: e.createdAt || 0,
          });
        });
      });
      memberExpensesByMonth[mm] = rows;
    }

    // policies 陣列化（含 v102.0.0 的 paymentMode / advanceHolderId）
    const policies = Object.entries(policiesObj).map(([id, p]) => ({
      id,
      type: p.type || 'normal',
      name: p.name || '',
      company: p.company || '',
      memberId: p.memberId || '',
      policyHolderId: p.policyHolderId || '',
      paymentMode: p.paymentMode || 'direct',              // 🆕 v102.0.0
      advanceHolderId: p.advanceHolderId || '',            // 🆕 v102.0.0
      firstStartYear: Number(p.firstStartYear) || 0,
      firstStartMonth: String(p.firstStartMonth || '01').padStart(2, '0'),
      totalPolicyYears: Number(p.totalPolicyYears) || 0,
      currentPeriodIndex: Number(p.currentPeriodIndex) || 1,
      periods: p.periods || {},
      monthlyPremium: roundInt(p.monthlyPremium),
      monthlyAverage: roundInt(p.monthlyAverage),
      annualPremium: roundInt(p.annualPremium),
      isCompleted: !!p.isCompleted,
    }));

    // paymentsCache（只回傳該年度，減少傳輸量）
    const paymentsCache = {};
    policies.forEach((p) => {
      const pYearPayments = paymentsObj[p.id]?.[year] || {};
      paymentsCache[p.id] = { [year]: pYearPayments };
    });

    return jsonResponse({
      ok: true,
      year,
      memberExpensesByMonth,
      policies,
      paymentsCache,
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
