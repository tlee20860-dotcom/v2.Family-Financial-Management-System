// ============================================
// summary.js — GET /api/summary（v102.0.0）
// 位置：functions/api/summary.js
// ============================================
// v102.0.0 修正：
//   ✅ 加入 bankAccounts / bankTransactions 統計
//   ✅ 加入 householdContributions（家用轉入，即 income/）
//   ✅ 加入 personalIncomeTotal（若為 owner）
//   ✅ 移除 bankBalance 對舊 bank_balances/ 的依賴
//   ✅ 保留 v101.8.8 全部功能
// ============================================

import { dbGet, jsonResponse } from './_config.js';
import {
  authenticate,
  errorResponse,
  handleError,
  handleOptions,
  objToList,
  roundInt,
} from './_helpers.js';

export async function onRequestGet({ request }) {
  try {
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
      members,
      policies,
      expenses,
      income,
      funds,
      fixed,
      categories,
      items,
      banks,
      paymentMethods,
      statuses,
      settingsOptions,
      bankAccounts,
      personalIncome,
      memberAdvances,
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
    const policiesObj = policies || {};
    const expensesObj = expenses || {};
    const incomeObj = income || {};
    const fundsObj = funds || {};
    const fixedObj = fixed || {};
    const categoriesObj = categories || {};
    const itemsObj = items || {};
    const banksObj = banks || {};
    const paymentsObj = paymentMethods || {};
    const statusesObj = statuses || {};
    const bankAccountsObj = bankAccounts || {};

    const statusMap = {};
    Object.entries(statusesObj).forEach(([id, s]) => {
      if (s && s.name) statusMap[s.name] = { id, ...s };
    });

    /* ============================================
       成員支出匯總
       ============================================ */
    const perMember = {};
    let totalExpense = 0;

    Object.entries(expensesObj).forEach(([memberId, list]) => {
      const itemsArr = objToList(list, (a, b) =>
        (a.date || '').localeCompare(b.date || '')
      ).map((e) => {
        const catId = e.categoryId || '';
        const itemId = e.itemId || '';
        const pmId = e.paymentMethodId || '';
        const statusInfo = statusMap[e.status];
        return {
          id: e.id,
          name: e.name || '',
          amount: roundInt(e.amount),
          status: e.status || '未處理',
          statusIsDone: statusInfo ? !!statusInfo.isDone : false,
          date: e.date || '',
          categoryId: catId,
          categoryName: categoriesObj[catId]?.name || '',
          itemId,
          itemName: itemsObj[itemId]?.name || '',
          isAutoLinked: e.isAutoLinked || false,
          policyId: e.policyId || '',
          paymentMethodId: pmId,
          paymentMethodName: paymentsObj[pmId]?.name || '',
          bankId: e.bankId || '',                // 🆕 v102.0.0
          txnId: e.txnId || '',                  // 🆕 v102.0.0
        };
      });

      const sum = itemsArr.reduce((s, e) => s + e.amount, 0);
      perMember[memberId] = {
        memberName: membersObj[memberId]?.name || '（未知成員）',
        itemCount: itemsArr.length,
        sum: roundInt(sum),
        items: itemsArr,
      };
      totalExpense += sum;
    });

    /* ============================================
       固定支出匯總（legacy）
       ============================================ */
    const fixedList = objToList(fixedObj).map((x) => {
      const catId = x.categoryId || '';
      const pmId = x.paymentMethodId || '';
      const statusInfo = statusMap[x.status];
      return {
        id: x.id,
        name: x.name || '',
        amount: roundInt(x.amount),
        cycle: x.cycle || '每月',
        note: x.note || '',
        status: x.status || '未付款',
        statusIsDone: statusInfo ? !!statusInfo.isDone : false,
        paidDate: x.paidDate || '',
        categoryId: catId,
        categoryName: categoriesObj[catId]?.name || '其他',
        paymentMethodId: pmId,
        paymentMethodName: paymentsObj[pmId]?.name || '',
        memberId: x.memberId || 'shared',
        createdAt: x.createdAt || 0,
      };
    }).filter((x) => x.status !== '不適用');

    const fixedTotal = fixedList.reduce((s, x) => s + x.amount, 0);
    const fixedPendingList = fixedList.filter((x) => !x.statusIsDone);
    const fixedPendingTotal = fixedPendingList.reduce((s, x) => s + x.amount, 0);
    const fixedPendingCount = fixedPendingList.length;

    totalExpense += fixedTotal;

    /* ============================================
       收入匯總（🆕 v102.0.0：改為「家用轉入」）
       ============================================ */
    const incomeBreakdown = {};
    let totalIncome = 0;
    Object.entries(incomeObj).forEach(([key, val]) => {
      const num = roundInt(val);
      if (key === 'extra' || membersObj[key]) {
        incomeBreakdown[key] = num;
        totalIncome += num;
      }
    });

    /* ============================================
       🆕 v102.0.0：個人收入總和（僅 owner / superadmin 可見）
       ============================================ */
    const personalIncomeObj = personalIncome || {};
    let personalIncomeTotal = 0;
    const personalIncomeBreakdown = {};
    Object.entries(personalIncomeObj).forEach(([memberId, yearData]) => {
      const monthData = yearData?.[year] || {};
      const sum = Object.values(monthData).reduce((s, v) => s + roundInt(v), 0);
      if (sum > 0) {
        personalIncomeBreakdown[memberId] = sum;
        personalIncomeTotal += sum;
      }
    });

    /* ============================================
       保險匯總（支援基金保險 + 代墊模式）
       ============================================ */
    const policyList = Object.values(policiesObj);
    let yearlyInsuranceTotal = 0;
    let monthlyInsuranceAverage = 0;
    let activePolicyCount = 0;
    const curY = Number(year);
    const curM = Number(month);

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

    /* ============================================
       支付方式統計
       ============================================ */
    const paymentBreakdown = {};

    Object.values(perMember).forEach((m) => {
      (m.items || []).forEach((it) => {
        const pmName = it.paymentMethodName || '（未指定）';
        if (!paymentBreakdown[pmName]) paymentBreakdown[pmName] = 0;
        paymentBreakdown[pmName] += it.amount;
      });
    });

    fixedList.forEach((f) => {
      const pmName = f.paymentMethodName || '（未指定）';
      if (!paymentBreakdown[pmName]) paymentBreakdown[pmName] = 0;
      paymentBreakdown[pmName] += f.amount;
    });

    if (monthlyInsuranceAverage > 0) {
      const pmName = '（保險扣款）';
      paymentBreakdown[pmName] = (paymentBreakdown[pmName] || 0) + monthlyInsuranceAverage;
    }

    /* ============================================
       🆕 v102.0.0：銀行餘額計算（從 bank_accounts + transactions）
       ============================================ */
    const bankAccountsList = Object.entries(bankAccountsObj).map(([id, acc]) => ({
      id, ...acc,
    }));

    // 收集所有交易
    const allTransactions = [];
    Object.entries(bankAccountsObj).forEach(([bid, bankData]) => {
      const txns = bankData.transactions || {};
      Object.entries(txns).forEach(([txnId, txn]) => {
        allTransactions.push({ id: txnId, bankId: bid, ...txn });
      });
    });

    // 計算當前月份總餘額（簡化：使用初始餘額 + 交易）
    const currentBankTotal = _calculateBankTotal(
      bankAccountsList,
      allTransactions,
      year,
      month
    );

    const fundList = Object.values(fundsObj);
    const fundValue = fundList.reduce((s, f) => s + roundInt(f.currentValue), 0);
    const totalAssets = currentBankTotal + fundValue;

    const prevBankTotal = _calculateBankTotal(
      bankAccountsList,
      allTransactions,
      prevY,
      prevMonthStr
    );
    const availableFunds = prevBankTotal + totalIncome;

    const netBalance = totalIncome - totalExpense;

    /* ============================================
       🆕 v102.0.0：代墊統計
       ============================================ */
    const memberAdvancesObj = memberAdvances || {};
    const advancesList = [];
    let totalAdvanceRemaining = 0;
    Object.entries(memberAdvancesObj).forEach(([memberId, advances]) => {
      Object.entries(advances || {}).forEach(([advanceId, adv]) => {
        const remaining = roundInt(adv.remainingAmount);
        totalAdvanceRemaining += remaining;
        advancesList.push({
          id: advanceId,
          memberId,
          ...adv,
          remainingAmount: remaining,
        });
      });
    });

    return jsonResponse({
      ok: true,
      year,
      month,

      totalIncome: roundInt(totalIncome),
      totalExpense: roundInt(totalExpense),
      netBalance: roundInt(netBalance),

      // 🆕 v102.0.0
      personalIncomeTotal: roundInt(personalIncomeTotal),
      personalIncomeBreakdown,

      yearlyInsuranceTotal: roundInt(yearlyInsuranceTotal),
      monthlyInsuranceAverage: roundInt(monthlyInsuranceAverage),
      policyCount: activePolicyCount,

      totalAssets: roundInt(totalAssets),
      bankBalance: roundInt(currentBankTotal),   // 🔄 從 bank_accounts 計算
      bankAccounts: bankAccountsList,            // 🆕 v102.0.0
      fundValue: roundInt(fundValue),
      fundCount: fundList.length,

      prevBankTotal: roundInt(prevBankTotal),
      availableFunds: roundInt(availableFunds),
      bankCount: bankAccountsList.length,

      // 🆕 v102.0.0
      memberAdvances: advancesList,
      totalAdvanceRemaining: roundInt(totalAdvanceRemaining),

      fixedTotal: roundInt(fixedTotal),
      fixedPendingTotal: roundInt(fixedPendingTotal),
      fixedPendingCount,
      fixedList,

      perMember,
      memberCount: Object.keys(membersObj).length,

      incomeBreakdown,
      paymentBreakdown,
      statusMap,
      options: settingsOptions || null,
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function onRequestOptions() {
  return handleOptions();
}

/* ============================================
   內部工具：計算銀行總餘額
   ============================================ */
function _calculateBankTotal(bankAccounts, transactions, targetYear, targetMonth) {
  if (!targetYear || !targetMonth) return 0;

  const tY = Number(targetYear);
  const tM = Number(targetMonth);
  let total = 0;

  bankAccounts.forEach((acc) => {
    const init = Number(acc.initialBalance) || 0;
    const initY = Number(acc.initialYear) || 0;
    const initM = Number(acc.initialMonth) || 0;

    if (!initY || !initM) {
      total += init;
      return;
    }

    // 目標早於初始
    if (tY < initY || (tY === initY && tM < initM)) {
      total += init;
      return;
    }

    let balance = init;
    transactions
      .filter((t) => t.bankId === acc.id)
      .forEach((txn) => {
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