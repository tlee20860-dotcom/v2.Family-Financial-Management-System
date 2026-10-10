// ============================================
// dashboard.js — 總覽儀表板（v103.0.14 Page Schema）
// 位置：js/pages/dashboard.js
// ============================================
// v103.0.14 修正：
//   ✅ [問題11] 副標題改為實際資訊（成員 / 銀行 / 交易數）
// ============================================

import { calcTotalBankBalance } from '../lib/bank.js';
import { formatHKD } from '../lib/format.js';
import { AppState } from '../core/state.js';

export default {
  title: '總覽儀表板',

  data: {
    bankAccounts:     { type: 'list', path: 'bank_accounts' },
    bankTransactions: { type: 'object', path: 'bank_accounts', transform: _flattenTxns },
    members:          { type: 'list', path: 'members' },
    allIncome:        { type: 'raw',  path: 'income' },
    allExpenses:      { type: 'raw',  path: 'expenses' },
  },

  state: {
    currentYear: String(AppState.year || new Date().getFullYear()),
    currentMonth: String(AppState.month || '12'),
  },

  derived: {
    totalBankBalance: {
      deps: ['data.bankAccounts', 'data.bankTransactions', 'state.currentYear', 'state.currentMonth'],
      compute: (accounts, txns, year, month) => {
        const tM = month === 'all' ? '12' : (month || '12');
        return calcTotalBankBalance(accounts || [], txns || [], year, tM);
      },
    },
    yearTotals: {
      deps: ['data.allIncome', 'data.allExpenses', 'state.currentYear'],
      compute: _computeYearTotals,
    },
    statsCards: {
      deps: ['totalBankBalance', 'data.bankAccounts', 'state.currentYear', 'yearTotals'],
      compute: (totalBankBalance, accounts, year, yearTotals) =>
        _buildStatsCards(totalBankBalance, accounts, year, yearTotals),
    },
    subtitle: {
      deps: ['data.members', 'data.bankAccounts', 'data.bankTransactions', 'state.currentYear'],
      compute: _buildSubtitle,
    },
  },

  blocks: [
    { type: 'stats', container: 'stats-cards-root', cards: '$.statsCards' },
  ],

  customMount: (ctx) => {
    const _update = () => {
      const el = document.getElementById('dashboard-subtitle');
      if (el) el.textContent = ctx.derived.subtitle || '載入中…';
    };
    _update();

    const _orig = ctx.invalidate;
    ctx.invalidate = (key) => {
      _orig(key);
      setTimeout(_update, 0);
    };

    return { destroy: () => {} };
  },
};

/* ============================================
   Helpers
   ============================================ */
function _flattenTxns(rawAccounts) {
  const flat = [];
  Object.entries(rawAccounts || {}).forEach(([bankId, bank]) => {
    Object.entries(bank?.transactions || {}).forEach(([txnId, txn]) => {
      flat.push({ id: txnId, bankId, bankName: bank?.name || '', ...txn });
    });
  });
  return flat;
}

function _computeYearTotals(allIncome, allExpenses, year) {
  const yearKey = String(year || '');
  if (!yearKey) return { totalIncome: 0, totalExpense: 0, net: 0, monthCount: 0 };
  const yearIncome = (allIncome || {})[yearKey] || {};
  let totalIncome = 0;
  Object.values(yearIncome).forEach((monthData) => {
    Object.values(monthData || {}).forEach((amt) => { totalIncome += Number(amt) || 0; });
  });
  const yearExpenses = (allExpenses || {})[yearKey] || {};
  let totalExpense = 0, monthCount = 0;
  Object.values(yearExpenses).forEach((monthData) => {
    const memberExps = monthData?.member_expenses || {};
    let monthSum = 0;
    Object.values(memberExps).forEach((items) => {
      Object.values(items || {}).forEach((e) => { monthSum += Number(e?.amount) || 0; });
    });
    if (monthSum > 0) monthCount++;
    totalExpense += monthSum;
  });
  return {
    totalIncome: Math.round(totalIncome),
    totalExpense: Math.round(totalExpense),
    net: Math.round(totalIncome - totalExpense),
    monthCount,
  };
}

function _buildStatsCards(totalBankBalance, accounts, year, yearTotals) {
  const list = Array.isArray(accounts) ? accounts : [];
  const bal = Number(totalBankBalance) || 0;
  const totals = yearTotals || { totalIncome: 0, totalExpense: 0, net: 0, monthCount: 0 };
  const income = Number(totals.totalIncome) || 0;
  const expense = Number(totals.totalExpense) || 0;
  const net = Number(totals.net) || 0;

  return [
    { title: '家庭總餘額', value: formatHKD(bal), valueClass: bal >= 0 ? 'emerald' : 'red', hint: `共 ${list.length} 個銀行帳號`, icon: 'landmark' },
    { title: `${year} 家庭收入`, value: formatHKD(income), valueClass: 'emerald', hint: income > 0 ? '家用轉入 + 額外收入' : '尚無收入紀錄', icon: 'trending-up' },
    { title: `${year} 年度總支出`, value: formatHKD(expense), valueClass: 'red', hint: expense > 0 ? `${totals.monthCount} 個月有紀錄` : '尚無支出紀錄', icon: 'trending-down' },
    { title: `${year} 年度淨餘額`, value: formatHKD(net), valueClass: net >= 0 ? 'emerald' : 'red', hint: net >= 0 ? '收支平衡' : '支出大於收入', icon: 'wallet' },
  ];
}

function _buildSubtitle(members, accounts, txns, year) {
  const memberCount = (members || []).length;
  const bankCount = (accounts || []).length;
  const txnCount = (txns || []).length;
  return `${year} 年 · ${memberCount} 位成員 · ${bankCount} 個銀行帳號 · ${txnCount} 筆交易`;
}