// ============================================
// dashboard.js — 總覽儀表板（v103.0.15 Page Schema）
// 位置：js/pages/dashboard.js
// ============================================
// v103.0.15 修正：
//   ✅ [P17-03] 加 onYearMonthChange hook
// ============================================

import { calcTotalBankBalance } from '../lib/bank.js';
import { formatHKD } from '../lib/format.js';
import { AppState } from '../core/state.js';

let _ctx = null;

export default {
  title: '總覽儀表板',
  data: {
    bankAccounts:     { type: 'list', path: 'bank_accounts' },
    bankTransactions: { type: 'object', path: 'bank_accounts', transform: _flatten },
    members:          { type: 'list', path: 'members' },
    allIncome:        { type: 'raw', path: 'income' },
    allExpenses:      { type: 'raw', path: 'expenses' },
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
      compute: (b, a, y, t) => _buildCards(b, a, y, t),
    },
    subtitle: {
      deps: ['data.members', 'data.bankAccounts', 'data.bankTransactions', 'state.currentYear'],
      compute: _buildSubtitle,
    },
  },
  blocks: [
    { type: 'stats', container: 'stats-cards-root', cards: '$.statsCards' },
  ],

  onYearMonthChange: () => { if (_ctx) _updateSubtitle(_ctx); },

  customMount: (ctx) => {
    _ctx = ctx;
    _updateSubtitle(ctx);
    const _orig = ctx.invalidate;
    ctx.invalidate = (k) => { _orig(k); setTimeout(() => _updateSubtitle(ctx), 0); };
    return { destroy: () => { _ctx = null; } };
  },
};

function _updateSubtitle(ctx) {
  const el = document.getElementById('dashboard-subtitle');
  if (el) el.textContent = ctx.derived.subtitle || '載入中…';
}

/* ============================================
   Helpers
   ============================================ */
function _flatten(raw) {
  const flat = [];
  Object.entries(raw || {}).forEach(([bankId, bank]) => {
    Object.entries(bank?.transactions || {}).forEach(([txnId, txn]) => {
      flat.push({ id: txnId, bankId, bankName: bank?.name || '', ...txn });
    });
  });
  return flat;
}

function _computeYearTotals(allIncome, allExpenses, year) {
  const yk = String(year || '');
  if (!yk) return { totalIncome: 0, totalExpense: 0, net: 0, monthCount: 0 };
  const yi = (allIncome || {})[yk] || {};
  let totalIncome = 0;
  Object.values(yi).forEach((md) => Object.values(md || {}).forEach((v) => { totalIncome += Number(v) || 0; }));
  const ye = (allExpenses || {})[yk] || {};
  let totalExpense = 0, monthCount = 0;
  Object.values(ye).forEach((md) => {
    const me = md?.member_expenses || {};
    let s = 0;
    Object.values(me).forEach((items) => Object.values(items || {}).forEach((e) => { s += Number(e?.amount) || 0; }));
    if (s > 0) monthCount++;
    totalExpense += s;
  });
  return { totalIncome: Math.round(totalIncome), totalExpense: Math.round(totalExpense), net: Math.round(totalIncome - totalExpense), monthCount };
}

function _buildCards(totalBankBalance, accounts, year, yearTotals) {
  const list = Array.isArray(accounts) ? accounts : [];
  const bal = Number(totalBankBalance) || 0;
  const t = yearTotals || { totalIncome: 0, totalExpense: 0, net: 0, monthCount: 0 };
  return [
    { title: '家庭總餘額', value: formatHKD(bal), valueClass: bal >= 0 ? 'emerald' : 'red', hint: `共 ${list.length} 個銀行帳號`, icon: 'landmark' },
    { title: `${year} 家庭收入`, value: formatHKD(t.totalIncome), valueClass: 'emerald', hint: '家用轉入 + 額外收入', icon: 'trending-up' },
    { title: `${year} 年度總支出`, value: formatHKD(t.totalExpense), valueClass: 'red', hint: `${t.monthCount} 個月有紀錄`, icon: 'trending-down' },
    { title: `${year} 年度淨餘額`, value: formatHKD(t.net), valueClass: t.net >= 0 ? 'emerald' : 'red', hint: t.net >= 0 ? '收支平衡' : '支出大於收入', icon: 'wallet' },
  ];
}

function _buildSubtitle(members, accounts, txns, year) {
  return `${year} 年 · ${(members || []).length} 位成員 · ${(accounts || []).length} 個銀行帳號 · ${(txns || []).length} 筆交易`;
}