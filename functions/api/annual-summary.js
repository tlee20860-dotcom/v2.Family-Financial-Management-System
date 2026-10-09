// ============================================
// annual-summary.js — Dashboard 年度聚合 API（v102.0.0）
// 位置：functions/api/annual-summary.js
// ============================================
// v102.0.0 修正：
//   ✅ [P0-4] 銀行結餘改從 bank_accounts + transactions 計算
//   ✅ 移除對已廢除的 bank_balances 節點的依賴
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
      bankAccountsSnap,
      fundsSnap,
    ] = await Promise.all([
      dbGet(`${basePath}/expenses`, token),
      dbGet(`${basePath}/income`, token),
      dbGet(`${basePath}/insurance_policies`, token),
      dbGet(`${basePath}/bank_accounts`, token),         // 🆕 v102.0.0
      dbGet(`${basePath}/funds`, token),
    ]);

    const expensesObj = expensesSnap || {};
    const incomeObj = incomeSnap || {};
    const policiesObj = policiesSnap || {};
    const bankAccountsObj = bankAccountsSnap || {};
    const fundsObj = fundsSnap || {};

    const policyList = Object.entries(policiesObj).map(([id, p]) => ({ id, ...p }));

    // 🆕 v102.0.0：攤平銀行帳號與交易
    const bankAccountsList = Object.entries(bankAccountsObj).map(([id, acc]) => ({
      id,
      name: acc.name || '',
      type: acc.type || 'family',
      initialBalance: Number(acc.initialBalance) || 0,
      initialYear: acc.initialYear || '',
      initialMonth: acc.initialMonth || '',
    }));

    const allTransactions = [];
    Object.entries(bankAccountsObj).forEach(([bid, bankData]) => {
      const txns = bankData.transactions || {};
      Object.entries(txns).forEach(([txnId, txn]) => {
        allTransactions.push({ id: txnId, bankId: bid, ...txn });
      });
    });

    const years = [];
    for (let y = startYear; y <= endYear; y++) {
      years.push(_buildYearSummary(
        y,
        expensesObj,
        incomeObj,
        policyList,
        bankAccountsList,
        allTransactions,
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

function _buildYearSummary(year, expensesObj, incomeObj, policyList, bankAccounts, allTransactions, fundsObj) {
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

  // 🆕 v102.0.0：該年度 12 月的銀行結餘（從 bank_accounts 計算）
  const bankBalance = _calcTotalBankBalance(bankAccounts, allTransactions, year, '12');

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

/* ============================================
   🆕 v102.0.0：銀行餘額計算（後端版本，與前端 bank-helpers.js 邏輯一致）
   ============================================ */

function _calcTotalBankBalance(bankAccounts, allTransactions, targetYear, targetMonth) {
  let total = 0;
  (bankAccounts || []).forEach((acc) => {
    const txns = (allTransactions || []).filter((t) => t.bankId === acc.id);
    total += _calcBankBalance(acc, txns, targetYear, targetMonth);
  });
  return total;
}

function _calcBankBalance(bankAccount, transactions, targetYear, targetMonth) {
  if (!bankAccount) return 0;

  const initial = Number(bankAccount.initialBalance) || 0;
  const initY = Number(bankAccount.initialYear) || 0;
  const initM = Number(bankAccount.initialMonth) || 0;

  if (!initY || !initM) return initial;

  const tY = Number(targetYear);
  const tM = Number(targetMonth);

  if (tY < initY || (tY === initY && tM < initM)) {
    return initial;
  }

  let balance = initial;
  (transactions || []).forEach((txn) => {
    const date = txn.date || '';
    if (!date || date.length < 7) return;

    const [y, m] = date.split('-').map(Number);
    const afterInit = y > initY || (y === initY && m > initM);
    const beforeTarget = y < tY || (y === tY && m <= tM);

    if (!afterInit || !beforeTarget) return;

    const amount = Number(txn.amount) || 0;
    if (txn.type === 'in') {
      balance += amount;
    } else if (txn.type === 'out') {
      balance -= amount;
    } else if (txn.type === 'transfer') {
      balance -= amount;
    }
  });

  return balance;
}
