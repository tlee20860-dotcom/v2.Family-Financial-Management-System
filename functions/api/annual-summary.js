// ============================================
// annual-summary.js — Dashboard 年度聚合 API（v101.10.0 🆕）
// 位置：functions/api/annual-summary.js
// ============================================
// 用途：
//   一次回傳多個年度的統計資料，取代前端 5 年 × 12 月 = 60 次 API 呼叫
//
// 請求：
//   GET /api/annual-summary?familyId={uid}&startYear=2023&endYear=2027
//   Headers: { Authorization: Bearer {idToken} }
//
// 回應：
//   {
//     ok: true,
//     startYear: 2023,
//     endYear: 2027,
//     years: [
//       {
//         year: 2023,
//         totalIncome: 0,
//         totalExpense: 0,
//         netBalance: 0,
//         yearlyInsuranceTotal: 0,
//         monthlyInsuranceAverage: 0,
//         policyCount: 0,
//         bankBalance: 0,
//         fundValue: 0,
//         totalAssets: 0,
//         avg: 0,
//         monthly: [ { monthNum, month, totalIncome, totalExpense, netBalance, monthlyInsuranceAverage }, ... 12 items ]
//       },
//       ...
//     ]
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
    const startYear = Number(url.searchParams.get('startYear'));
    const endYear = Number(url.searchParams.get('endYear'));

    if (!familyId) return errorResponse('MISSING_FIELDS', '缺少 familyId');
    if (!startYear || !endYear || startYear > endYear) {
      return errorResponse('MISSING_FIELDS', 'startYear / endYear 無效');
    }
    if (endYear - startYear > 10) {
      return errorResponse('BAD_REQUEST', '年度範圍不可超過 10 年');
    }

    const auth = await authenticate(request, { needFamily: true });
    if (auth instanceof Response) return auth;
    const { token } = auth;

    const basePath = `families/${familyId}`;

    // 一次讀取所有需要的節點
    const [
      expensesSnap,
      incomeSnap,
      policiesSnap,
      bankBalancesSnap,
      fundsSnap,
    ] = await Promise.all([
      dbGet(`${basePath}/expenses`, token),
      dbGet(`${basePath}/income`, token),
      dbGet(`${basePath}/insurance_policies`, token),
      dbGet(`${basePath}/bank_balances`, token),
      dbGet(`${basePath}/funds`, token),
    ]);

    const expensesObj = expensesSnap || {};
    const incomeObj = incomeSnap || {};
    const policiesObj = policiesSnap || {};
    const bankBalancesObj = bankBalancesSnap || {};
    const fundsObj = fundsSnap || {};

    const policyList = Object.entries(policiesObj).map(([id, p]) => ({ id, ...p }));

    const years = [];
    for (let y = startYear; y <= endYear; y++) {
      years.push(_buildYearSummary(
        y,
        expensesObj,
        incomeObj,
        policyList,
        bankBalancesObj,
        fundsObj
      ));
    }

    return jsonResponse({
      ok: true,
      startYear,
      endYear,
      years,
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

function _buildYearSummary(year, expensesObj, incomeObj, policyList, bankBalancesObj, fundsObj) {
  const yearStr = String(year);
  const yearExpenses = expensesObj[yearStr] || {};
  const yearIncome = incomeObj[yearStr] || {};

  const monthly = [];
  let yearTotalIncome = 0;
  let yearTotalExpense = 0;
  let monthsWithData = 0;

  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');

    // 收入
    const monthIncomeObj = yearIncome[mm] || {};
    let totalIncome = 0;
    Object.values(monthIncomeObj).forEach((v) => {
      totalIncome += roundInt(v);
    });

    // 支出
    const monthExpenses = yearExpenses[mm]?.member_expenses || {};
    let totalExpense = 0;
    Object.values(monthExpenses).forEach((memberData) => {
      Object.values(memberData || {}).forEach((e) => {
        totalExpense += roundInt(e.amount);
      });
    });

    // 保險平攤（依當前 y/m 檢查保單年度）
    let monthlyIns = 0;
    policyList.forEach((p) => {
      const firstY = Number(p.firstStartYear) || 0;
      const firstM = Number(p.firstStartMonth) || 1;
      const totalYears = Number(p.totalPolicyYears) || 0;

      if (!firstY) return;

      const totalMonths = (year - firstY) * 12 + (m - firstM);
      if (totalMonths < 0) return;

      const periodIndex = Math.floor(totalMonths / 12) + 1;
      if (totalYears > 0 && periodIndex > totalYears) return;

      if (p.type === 'fund_insurance') {
        monthlyIns += roundInt(p.monthlyPremium);
      } else {
        const periodData = (p.periods || {})[String(periodIndex)];
        if (periodData) {
          monthlyIns += roundInt(periodData.monthlyAverage);
        }
      }
    });

    if (totalExpense > 0) monthsWithData++;

    monthly.push({
      monthNum: m,
      month: mm,
      totalIncome: roundInt(totalIncome),
      totalExpense: roundInt(totalExpense),
      netBalance: roundInt(totalIncome - totalExpense),
      monthlyInsuranceAverage: roundInt(monthlyIns),
    });

    yearTotalIncome += totalIncome;
    yearTotalExpense += totalExpense;
  }

  // 年度保險總供款（依 targetYear）
  let yearlyInsTotal = 0;
  let monthlyInsAvg = 0;
  let policyCount = 0;
  policyList.forEach((p) => {
    const firstY = Number(p.firstStartYear) || 0;
    const totalYears = Number(p.totalPolicyYears) || 0;
    if (!firstY || year < firstY) return;

    const periodIndex = year - firstY + 1;
    if (totalYears > 0 && periodIndex > totalYears) return;

    if (p.type === 'fund_insurance') {
      const mp = roundInt(p.monthlyPremium);
      if (mp <= 0) return;
      yearlyInsTotal += mp * 12;
      monthlyInsAvg += mp;
      policyCount++;
    } else {
      const periodData = (p.periods || {})[String(periodIndex)];
      if (periodData) {
        yearlyInsTotal += roundInt(periodData.annualPremium);
        monthlyInsAvg += roundInt(periodData.monthlyAverage);
        policyCount++;
      }
    }
  });

  // 該年度 12 月的銀行結餘
  const decBanks = bankBalancesObj[yearStr]?.['12'] || {};
  const bankBalance = Object.values(decBanks).reduce(
    (s, b) => s + roundInt(b.amount),
    0
  );

  // 基金現值（即時）
  const fundValue = Object.values(fundsObj).reduce(
    (s, f) => s + roundInt(f.currentValue),
    0
  );

  return {
    year,
    totalIncome: roundInt(yearTotalIncome),
    totalExpense: roundInt(yearTotalExpense),
    netBalance: roundInt(yearTotalIncome - yearTotalExpense),
    yearlyInsuranceTotal: roundInt(yearlyInsTotal),
    monthlyInsuranceAverage: roundInt(monthlyInsAvg),
    policyCount,
    bankBalance: roundInt(bankBalance),
    fundValue: roundInt(fundValue),
    totalAssets: roundInt(bankBalance + fundValue),
    avg: monthsWithData > 0 ? Math.round(yearTotalExpense / monthsWithData) : 0,
    monthly,
  };
}