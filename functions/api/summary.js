// ============================================
// summary.js — GET /api/summary?familyId=...&year=YYYY&month=MM（v101.8.8）
// 位置：functions/api/summary.js
// ============================================
// v101.8.8 修正：
//   ✅ 基金保險也檢查年度範圍（firstStartYear + totalPolicyYears）
//       - 原本基金保險一律計算，不論年份 → 年度總供款不準
//   ✅ 保留 v101.5 / v101.6 全部功能
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
      bankBalances,
      prevBankBalances,
      banks,
      paymentMethods,
      statuses,
      settingsOptions,
    ] = await Promise.all([
      dbGet(`${basePath}/members`, token),
      dbGet(`${basePath}/insurance_policies`, token),
      year && month ? dbGet(`${basePath}/expenses/${year}/${month}/member_expenses`, token) : null,
      year && month ? dbGet(`${basePath}/income/${year}/${month}`, token) : null,
      dbGet(`${basePath}/funds`, token),
      year && month ? dbGet(`${basePath}/fixed_expenses/${year}/${month}`, token) : null,
      dbGet(`${basePath}/expense_categories`, token),
      dbGet(`${basePath}/expense_items`, token),
      year && month ? dbGet(`${basePath}/bank_balances/${year}/${month}`, token) : null,
      dbGet(`${basePath}/bank_balances/${prevY}/${prevMonthStr}`, token),
      dbGet(`${basePath}/banks`, token),
      dbGet(`${basePath}/payment_methods`, token),
      dbGet(`${basePath}/statuses`, token),
      dbGet(`${basePath}/settings/options`, token),
    ]);

    const membersObj = members || {};
    const policiesObj = policies || {};
    const expensesObj = expenses || {};
    const incomeObj = income || {};
    const fundsObj = funds || {};
    const fixedObj = fixed || {};
    const categoriesObj = categories || {};
    const itemsObj = items || {};
    const bankBalancesObj = bankBalances || {};
    const prevBankBalancesObj = prevBankBalances || {};
    const banksObj = banks || {};
    const paymentsObj = paymentMethods || {};
    const statusesObj = statuses || {};

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
       收入匯總
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
       保險匯總（🆕 v101.8.8：基金保險也檢查年度）
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

      // 統一年度檢查
      const totalMonths = (curY - firstY) * 12 + (curM - firstM);
      if (totalMonths < 0) return;   // 尚未開始

      const periodIndex = Math.floor(totalMonths / 12) + 1;
      if (totalYears > 0 && periodIndex > totalYears) return;   // 已供滿

      // 🆕 基金保險：monthlyPremium × 12
      if (p.type === 'fund_insurance') {
        const mp = roundInt(p.monthlyPremium);
        if (mp <= 0) return;
        monthlyInsuranceAverage += mp;
        yearlyInsuranceTotal += mp * 12;
        activePolicyCount++;
        return;
      }

      // 普通保險：從 periods 讀取
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
       資產匯總
       ============================================ */
    const bankBalanceTotal = Object.values(bankBalancesObj)
      .reduce((s, b) => s + roundInt(b.amount), 0);

    const fundList = Object.values(fundsObj);
    const fundValue = fundList.reduce((s, f) => s + roundInt(f.currentValue), 0);
    const totalAssets = bankBalanceTotal + fundValue;

    const prevBankTotal = Object.values(prevBankBalancesObj)
      .reduce((s, b) => s + roundInt(b.amount), 0);
    const availableFunds = prevBankTotal + totalIncome;

    const netBalance = totalIncome - totalExpense;

    return jsonResponse({
      ok: true,
      year,
      month,

      totalIncome: roundInt(totalIncome),
      totalExpense: roundInt(totalExpense),
      netBalance: roundInt(netBalance),

      yearlyInsuranceTotal: roundInt(yearlyInsuranceTotal),
      monthlyInsuranceAverage: roundInt(monthlyInsuranceAverage),
      policyCount: activePolicyCount,

      totalAssets: roundInt(totalAssets),
      bankBalance: roundInt(bankBalanceTotal),
      fundValue: roundInt(fundValue),
      fundCount: fundList.length,

      prevBankTotal: roundInt(prevBankTotal),
      availableFunds: roundInt(availableFunds),
      bankCount: Object.keys(banksObj).length,

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