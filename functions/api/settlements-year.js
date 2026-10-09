// ============================================
// settlements-year.js — 結算清單年度聚合 API（v101.10.0 🆕）
// 位置：functions/api/settlements-year.js
// ============================================
// 用途：
//   一次回傳指定年度所有月份 + 保險 payments，取代前端 12 + N 次 API
//   前端保留 mergeSettlementData 邏輯（不重複實作）
//
// 請求：
//   GET /api/settlements-year?familyId={uid}&year=2024
//   Headers: { Authorization: Bearer {idToken} }
//
// 回應：
//   {
//     ok: true,
//     year: 2024,
//     memberExpensesByMonth: {
//       "01": [ { id, memberId, name, amount, status, ... }, ... ],
//       "02": [ ... ],
//       ...
//       "12": [ ... ]
//     },
//     policies: [ { id, type, name, memberId, policyHolderId, ... }, ... ],
//     paymentsCache: {
//       [policyId]: {
//         "2024": {
//           "01": { status, amount, date },
//           ...
//         }
//       }
//     }
//   }
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
            createdAt: e.createdAt || 0,
          });
        });
      });
      memberExpensesByMonth[mm] = rows;
    }

    // policies 陣列化
    const policies = Object.entries(policiesObj).map(([id, p]) => ({
      id,
      type: p.type || 'normal',
      name: p.name || '',
      company: p.company || '',
      memberId: p.memberId || '',
      policyHolderId: p.policyHolderId || '',
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