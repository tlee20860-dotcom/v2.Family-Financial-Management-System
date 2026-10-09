// ============================================
// summary.js — 摘要 / 年度聚合 / 結算年度（v103.0.0）
// 位置：functions/api/summary.js
// ============================================
// v103.0.0 合併：
//   ✅ 合併 summary.js + annual-summary.js + settlements-year.js
//   ✅ 內部透過 ?action= 分派（GET）
//   ✅ 舊 URL 路徑保持不變（相容層）
// ============================================

import { dbGet, jsonResponse } from './_config.js';
import {
  authenticate, errorResponse, handleError, handleOptions,
  objToList, roundInt,
} from './_helpers.js';

/* ============================================
   路由分派
   ============================================ */
export async function onRequestGet({ request }) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'monthly';

    switch (action) {
      case 'monthly':           return _handleMonthly(request);
      case 'annual':            return _handleAnnual(request);
      case 'settlements-year':  return _handleSettlementsYear(request);
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
   1. 單月摘要（原 summary.js）
   ============================================ */
async function _handleMonthly(request) {
  const url = new URL(request.url);
  const familyId = url.searchParams.get('familyId');
  const year = url.searchParams.get('year');
  const month = url.searchParams.get('month');

  if (!familyId) return errorResponse('MISSING_FIELDS', '缺少 familyId');

  const auth = await authenticate(request, { needFamily: true });
  if (auth instanceof Response) return auth;
  const { token } = auth;

  const basePath = `families/${familyId}`;

  let prevY = Number(year);
  let prevM = Number(month) - 1;
  if (prevM < 1) { prevY -= 1; prevM = 12; }
  const prevMonthStr = String(prevM).padStart(2, '0');

  const [
    members, policies, expenses, income, funds, fixed,
    categories, items, banks, paymentMethods, statuses, settingsOptions,
    bankAccounts, personalIncome, memberAdvances,
  ] = await Promise.all([
    dbGet(`${basePath}/members`, token),
    dbGet(`${basePath}/insurance_policies`, token),
    year && month ? dbGet(`${basePath}/expenses/${year}/${month}/member_expenses`, token) : null,
    year && month ? dbGet(`${basePath}/income/${year}/${month}`, token) : null,
    dbGet(`${basePath}/funds`, token),
    year && month ? dbGet(`${basePath}/fixed_expenses/${year}/${month}`, token) : null,
    dbGet(`${basePath}/expense_categories`, token),
    dbGet(`${basePath}/expense_items`, token),
    dbGet(`${basePath}/banks`, token),
    dbGet(`${basePath}/payment_methods`, token),
    dbGet(`${basePath}/statuses`, token),
    dbGet(`${basePath}/settings/options`, token),
    dbGet(`${basePath}/bank_accounts`, token),
    dbGet(`${basePath}/personal_income`, token),
    dbGet(`${basePath}/member_advances`, token),
  ]);

  const membersObj = members || {};
  const statusesObj = statuses || {};
  const statusMap = {};
  Object.entries(statusesObj).forEach(([id, s]) => { if (s && s.name) statusMap[s.name] = { id, ...s }; });

  /* 成員支出匯總 */
  const perMember = {};
  let totalExpense = 0;
  Object.entries(expenses || {}).forEach(([memberId, list]) => {
    const itemsArr = objToList(list, (a, b) => (a.date || '').localeCompare(b.date || '')).map((e) => {
      const statusInfo = statusMap[e.status];
      return {
        id: e.id, name: e.name || '', amount: roundInt(e.amount),
        status: e.status || '未處理',
        statusIsDone: statusInfo ? !!statusInfo.isDone : false,
        date: e.date || '',
        categoryId: e.categoryId || '',
        categoryName: (categories || {})[e.categoryId]?.name || '',
        itemId: e.itemId || '',
        itemName: (items || {})[e.itemId]?.name || '',
        isAutoLinked: e.isAutoLinked || false,
        policyId: e.policyId || '',
        paymentMethodId: e.paymentMethodId || '',
        paymentMethodName: (paymentMethods || {})[e.paymentMethodId]?.name || '',
        bankId: e.bankId || '',
        txnId: e.txnId || '',
      };
    });
    const sum = itemsArr.reduce((s, e) => s + e.amount, 0);
    perMember[memberId] = {
      memberName: (membersObj[memberId]?.name) || '（未知成員）',
      itemCount: itemsArr.length, sum: roundInt(sum), items: itemsArr,
    };
    totalExpense += sum;
  });

  /* 固定支出（legacy） */
  const fixedList = objToList(fixed || {}).map((x) => {
    const statusInfo = statusMap[x.status];
    return {
      id: x.id, name: x.name || '', amount: roundInt(x.amount),
      cycle: x.cycle || '每月', note: x.note || '',
      status: x.status || '未付款',
      statusIsDone: statusInfo ? !!statusInfo.isDone : false,
      paidDate: x.paidDate || '',
      categoryId: x.categoryId || '',
      categoryName: (categories || {})[x.categoryId]?.name || '其他',
      paymentMethodId: x.paymentMethodId || '',
      paymentMethodName: (paymentMethods || {})[x.paymentMethodId]?.name || '',
      memberId: x.memberId || 'shared',
      createdAt: x.createdAt || 0,
    };
  }).filter((x) => x.status !== '不適用');

  const fixedTotal = fixedList.reduce((s, x) => s + x.amount, 0);
  const fixedPendingList = fixedList.filter((x) => !x.statusIsDone);
  const fixedPendingTotal = fixedPendingList.reduce((s, x) => s + x.amount, 0);
  totalExpense += fixedTotal;

  /* 收入（家用轉入） */
  const incomeBreakdown = {};
  let totalIncome = 0;
  Object.entries(income || {}).forEach(([key, val]) => {
    const num = roundInt(val);
    if (key === 'extra' || membersObj[key]) {
      incomeBreakdown[key] = num;
      totalIncome += num;
    }
  });

  /* 個人收入 */
  let personalIncomeTotal = 0;
  const personalIncomeBreakdown = {};
  Object.entries(personalIncome || {}).forEach(([memberId, yearData]) => {
    const monthData = yearData?.[year] || {};
    const sum = Object.values(monthData).reduce((s, v) => s + roundInt(v), 0);
    if (sum > 0) { personalIncomeBreakdown[memberId] = sum; personalIncomeTotal += sum; }
  });

  /* 保險匯總 */
  const policyList = Object.values(policies || {});
  let yearlyInsuranceTotal = 0, monthlyInsuranceAverage = 0, activePolicyCount = 0;
  const curY = Number(year), curM = Number(month);

  policyList.forEach((p) => {
    const firstY = Number(p.firstStartYear) || 0;
    const firstM = Number(p.firstStartMonth) || 1;
    const totalYears = Number(p.totalPolicyYears) || 0;
    if (!firstY) return;
    const totalMonths = (curY - firstY) * 12 + (curM - firstM);
    if (totalMonths < 0) return;
    const periodIndex = Math.floor(totalMonths / 12) + 1;
    if (totalYears > 0 && periodIndex > totalYears) return;

    if (p.type === 'fund_insurance') {
      const mp = roundInt(p.monthlyPremium);
      if (mp <= 0) return;
      monthlyInsuranceAverage += mp;
      yearlyInsuranceTotal += mp * 12;
      activePolicyCount++;
      return;
    }
    const periodData = (p.periods || {})[String(periodIndex)];
    if (periodData) {
      monthlyInsuranceAverage += roundInt(periodData.monthlyAverage);
      yearlyInsuranceTotal += roundInt(periodData.annualPremium);
      activePolicyCount++;
    }
  });

  /* 支付方式 */
  const paymentBreakdown = {};
  Object.values(perMember).forEach((m) => {
    (m.items || []).forEach((it) => {
      const pmName = it.paymentMethodName || '（未指定）';
      paymentBreakdown[pmName] = (paymentBreakdown[pmName] || 0) + it.amount;
    });
  });
  fixedList.forEach((f) => {
    const pmName = f.paymentMethodName || '（未指定）';
    paymentBreakdown[pmName] = (paymentBreakdown[pmName] || 0) + f.amount;
  });
  if (monthlyInsuranceAverage > 0) {
    paymentBreakdown['（保險扣款）'] = (paymentBreakdown['（保險扣款）'] || 0) + monthlyInsuranceAverage;
  }

  /* 銀行餘額 */
  const bankAccountsList = Object.entries(bankAccounts || {}).map(([id, acc]) => ({ id, ...acc }));
  const allTransactions = [];
  Object.entries(bankAccounts || {}).forEach(([bid, bankData]) => {
    Object.entries(bankData.transactions || {}).forEach(([txnId, txn]) => {
      allTransactions.push({ id: txnId, bankId: bid, ...txn });
    });
  });
  const currentBankTotal = _calcBankTotal(bankAccountsList, allTransactions, year, month);
  const prevBankTotal = _calcBankTotal(bankAccountsList, allTransactions, prevY, prevMonthStr);

  const fundValue = Object.values(funds || {}).reduce((s, f) => s + roundInt(f.currentValue), 0);
  const totalAssets = currentBankTotal + fundValue;
  const availableFunds = prevBankTotal + totalIncome;
  const netBalance = totalIncome - totalExpense;

  /* 代墊 */
  const advancesList = [];
  let totalAdvanceRemaining = 0;
  Object.entries(memberAdvances || {}).forEach(([memberId, advances]) => {
    Object.entries(advances || {}).forEach(([advanceId, adv]) => {
      const remaining = roundInt(adv.remainingAmount);
      totalAdvanceRemaining += remaining;
      advancesList.push({ id: advanceId, memberId, ...adv, remainingAmount: remaining });
    });
  });

  return jsonResponse({
    ok: true, year, month,
    totalIncome: roundInt(totalIncome),
    totalExpense: roundInt(totalExpense),
    netBalance: roundInt(netBalance),
    personalIncomeTotal: roundInt(personalIncomeTotal),
    personalIncomeBreakdown,
    yearlyInsuranceTotal: roundInt(yearlyInsuranceTotal),
    monthlyInsuranceAverage: roundInt(monthlyInsuranceAverage),
    policyCount: activePolicyCount,
    totalAssets: roundInt(totalAssets),
    bankBalance: roundInt(currentBankTotal),
    bankAccounts: bankAccountsList,
    fundValue: roundInt(fundValue),
    fundCount: Object.keys(funds || {}).length,
    prevBankTotal: roundInt(prevBankTotal),
    availableFunds: roundInt(availableFunds),
    bankCount: bankAccountsList.length,
    memberAdvances: advancesList,
    totalAdvanceRemaining: roundInt(totalAdvanceRemaining),
    fixedTotal: roundInt(fixedTotal),
    fixedPendingTotal: roundInt(fixedPendingTotal),
    fixedPendingCount: fixedPendingList.length,
    fixedList, perMember,
    memberCount: Object.keys(membersObj).length,
    incomeBreakdown, paymentBreakdown, statusMap,
    options: settingsOptions || null,
  });
}

/* ============================================
   2. 年度聚合（原 annual-summary.js）
   ============================================ */
async function _handleAnnual(request) {
  const url = new URL(request.url);
  const familyId = url.searchParams.get('familyId');
  const startYear = Number(url.searchParams.get('startYear'));
  const endYear = Number(url.searchParams.get('endYear'));

  if (!familyId) return errorResponse('MISSING_FIELDS', '缺少 familyId');
  if (!startYear || !endYear || startYear > endYear) return errorResponse('MISSING_FIELDS', 'startYear / endYear 無效');
  if (endYear - startYear > 10) return errorResponse('BAD_REQUEST', '年度範圍不可超過 10 年');

  const auth = await authenticate(request, { needFamily: true });
  if (auth instanceof Response) return auth;
  const { token } = auth;

  const basePath = `families/${familyId}`;
  const [expensesSnap, incomeSnap, policiesSnap, bankAccountsSnap, fundsSnap] = await Promise.all([
    dbGet(`${basePath}/expenses`, token),
    dbGet(`${basePath}/income`, token),
    dbGet(`${basePath}/insurance_policies`, token),
    dbGet(`${basePath}/bank_accounts`, token),
    dbGet(`${basePath}/funds`, token),
  ]);

  const expensesObj = expensesSnap || {};
  const incomeObj = incomeSnap || {};
  const policiesObj = policiesSnap || {};
  const bankAccountsObj = bankAccountsSnap || {};
  const fundsObj = fundsSnap || {};

  const policyList = Object.entries(policiesObj).map(([id, p]) => ({ id, ...p }));
  const bankAccountsList = Object.entries(bankAccountsObj).map(([id, acc]) => ({
    id, name: acc.name || '', type: acc.type || 'family',
    initialBalance: Number(acc.initialBalance) || 0,
    initialYear: acc.initialYear || '', initialMonth: acc.initialMonth || '',
  }));
  const allTransactions = [];
  Object.entries(bankAccountsObj).forEach(([bid, bankData]) => {
    Object.entries(bankData.transactions || {}).forEach(([txnId, txn]) => {
      allTransactions.push({ id: txnId, bankId: bid, ...txn });
    });
  });

  const years = [];
  for (let y = startYear; y <= endYear; y++) {
    years.push(_buildYearSummary(y, expensesObj, incomeObj, policyList, bankAccountsList, allTransactions, fundsObj));
  }

  return jsonResponse({ ok: true, startYear, endYear, years });
}

function _buildYearSummary(year, expensesObj, incomeObj, policyList, bankAccounts, allTransactions, fundsObj) {
  const yearStr = String(year);
  const yearExpenses = expensesObj[yearStr] || {};
  const yearIncome = incomeObj[yearStr] || {};
  const monthly = [];
  let yearTotalIncome = 0, yearTotalExpense = 0, monthsWithData = 0;

  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    const monthIncomeObj = yearIncome[mm] || {};
    let totalIncome = 0;
    Object.values(monthIncomeObj).forEach((v) => { totalIncome += roundInt(v); });

    const monthExpenses = yearExpenses[mm]?.member_expenses || {};
    let totalExpense = 0;
    Object.values(monthExpenses).forEach((memberData) => {
      Object.values(memberData || {}).forEach((e) => { totalExpense += roundInt(e.amount); });
    });

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
        if (periodData) monthlyIns += roundInt(periodData.monthlyAverage);
      }
    });

    if (totalExpense > 0) monthsWithData++;
    monthly.push({
      monthNum: m, month: mm,
      totalIncome: roundInt(totalIncome),
      totalExpense: roundInt(totalExpense),
      netBalance: roundInt(totalIncome - totalExpense),
      monthlyInsuranceAverage: roundInt(monthlyIns),
    });
    yearTotalIncome += totalIncome;
    yearTotalExpense += totalExpense;
  }

  let yearlyInsTotal = 0, monthlyInsAvg = 0, policyCount = 0;
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

  const bankBalance = _calcBankTotal(bankAccounts, allTransactions, year, '12');
  const fundValue = Object.values(fundsObj).reduce((s, f) => s + roundInt(f.currentValue), 0);

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
   3. 結算年度（原 settlements-year.js）
   ============================================ */
async function _handleSettlementsYear(request) {
  const url = new URL(request.url);
  const familyId = url.searchParams.get('familyId');
  const year = url.searchParams.get('year');

  if (!familyId) return errorResponse('MISSING_FIELDS', '缺少 familyId');
  if (!year || !/^\d{4}$/.test(year)) return errorResponse('MISSING_FIELDS', 'year 格式錯誤（yyyy）');

  const auth = await authenticate(request, { needFamily: true });
  if (auth instanceof Response) return auth;
  const { token } = auth;

  const basePath = `families/${familyId}`;
  const [expensesSnap, policiesSnap, paymentsSnap] = await Promise.all([
    dbGet(`${basePath}/expenses/${year}`, token),
    dbGet(`${basePath}/insurance_policies`, token),
    dbGet(`${basePath}/insurance_payments`, token),
  ]);

  const expensesObj = expensesSnap || {};
  const policiesObj = policiesSnap || {};
  const paymentsObj = paymentsSnap || {};

  const memberExpensesByMonth = {};
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    const monthData = expensesObj[mm]?.member_expenses || {};
    const rows = [];
    Object.entries(monthData).forEach(([memberId, items]) => {
      Object.entries(items || {}).forEach(([id, e]) => {
        rows.push({
          id, memberId, name: e.name || '', amount: roundInt(e.amount),
          status: e.status || '', date: e.date || '',
          categoryId: e.categoryId || '', itemId: e.itemId || '',
          paymentMethodId: e.paymentMethodId || '',
          isAutoLinked: !!e.isAutoLinked, policyId: e.policyId || '',
          bankId: e.bankId || '', txnId: e.txnId || '',
          repaidDate: e.repaidDate || '', createdAt: e.createdAt || 0,
        });
      });
    });
    memberExpensesByMonth[mm] = rows;
  }

  const policies = Object.entries(policiesObj).map(([id, p]) => ({
    id,
    type: p.type || 'normal', name: p.name || '', company: p.company || '',
    memberId: p.memberId || '', policyHolderId: p.policyHolderId || '',
    paymentMode: p.paymentMode || 'direct',
    advanceHolderId: p.advanceHolderId || '',
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

  const paymentsCache = {};
  policies.forEach((p) => {
    const pYearPayments = paymentsObj[p.id]?.[year] || {};
    paymentsCache[p.id] = { [year]: pYearPayments };
  });

  return jsonResponse({ ok: true, year, memberExpensesByMonth, policies, paymentsCache });
}

/* ============================================
   內部工具：銀行餘額
   ============================================ */
function _calcBankTotal(bankAccounts, transactions, targetYear, targetMonth) {
  if (!targetYear || !targetMonth) return 0;
  const tY = Number(targetYear);
  const tM = Number(targetMonth);
  let total = 0;

  bankAccounts.forEach((acc) => {
    const init = Number(acc.initialBalance) || 0;
    const initY = Number(acc.initialYear) || 0;
    const initM = Number(acc.initialMonth) || 0;
    if (!initY || !initM) { total += init; return; }
    if (tY < initY || (tY === initY && tM < initM)) { total += init; return; }

    let balance = init;
    transactions.filter((t) => t.bankId === acc.id).forEach((txn) => {
      const date = txn.date || '';
      if (!date || date.length < 7) return;
      const [y, m] = date.split('-').map(Number);
      const afterInit = y > initY || (y === initY && m > initM);
      const beforeTarget = y < tY || (y === tY && m <= tM);
      if (!afterInit || !beforeTarget) return;
      const amount = Number(txn.amount) || 0;
      if (txn.type === 'in') balance += amount;
      else if (txn.type === 'out') balance -= amount;
      else if (txn.type === 'transfer') balance -= amount;
    });
    total += balance;
  });

  return total;
}
