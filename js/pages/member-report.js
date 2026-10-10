// ============================================
// member-report.js — 成員收支明細（v103.0.15 Page Schema）
// 位置：js/pages/member-report.js
// ============================================
// v103.0.15 修正：
//   ✅ [P17-03] 加 onYearMonthChange hook
// ============================================

import { formatHKD } from '../lib/format.js';
import { AppState } from '../core/state.js';
import { RESERVED_IDS } from '../config/constants.js';

export default {
  title: '成員與家庭收入與支出明細',
  data: {
    members:           { type: 'list', path: 'members' },
    allIncome:         { type: 'raw', path: 'income' },
    allExpenses:       { type: 'raw', path: 'expenses' },
    allPersonalIncome: { type: 'raw', path: 'personal_income' },
  },
  state: {
    currentYear: String(AppState.year || new Date().getFullYear()),
    selectedMemberId: null,
    view: 'table',
  },
  derived: {
    rows: {
      deps: ['data.members', 'data.allIncome', 'data.allExpenses', 'data.allPersonalIncome', 'state.currentYear'],
      compute: _buildRows,
    },
    statsCards: {
      deps: ['rows', 'state.currentYear'],
      compute: _buildStats,
    },
  },
  blocks: [
    { type: 'stats', container: 'member-report-stats-root', cards: '$.statsCards' },
    { type: 'list', container: 'member-list-root', rows: '$.rows', columns: 'memberReport', tableId: 'member-report-table', view: 'table', emptyText: '尚無成員' },
  ],

  onYearMonthChange: () => {
    if (_ctx) {
      _ctx.state.currentYear = String(AppState.year || new Date().getFullYear());
    }
  },

  customMount: (ctx) => {
    _ctx = ctx;
    return { destroy: () => { _ctx = null; } };
  },
};

let _ctx = null;

/* ============================================
   Helpers
   ============================================ */
function _buildRows(members, allIncome, allExpenses, allPersonalIncome, year) {
  const yk = String(year || '');
  const yi = (allIncome || {})[yk] || {};
  const ye = (allExpenses || {})[yk] || {};
  const list = (members || []).map((m) => ({ id: m.id, name: m.name, isShared: false }));
  list.push({ id: RESERVED_IDS.SHARED_MEMBER, name: '家庭共用', isShared: true });

  return list.map((m) => {
    let income = 0, personalIncome = 0, expense = 0, insurance = 0;
    if (!m.isShared) {
      Object.values(yi).forEach((md) => { income += Number(md && md[m.id]) || 0; });
      const mp = (allPersonalIncome || {})[m.id] || {};
      Object.values(mp[yk] || {}).forEach((v) => { personalIncome += Number(v) || 0; });
    }
    Object.values(ye).forEach((md) => {
      const me = (md && md.member_expenses && md.member_expenses[m.id]) || {};
      Object.values(me).forEach((e) => {
        const amt = Number(e && e.amount) || 0;
        if (e && e.isAutoLinked) insurance += amt; else expense += amt;
      });
    });
    return { ...m, income: Math.round(income), expense: Math.round(expense), insurance: Math.round(insurance), personalIncome: Math.round(personalIncome), net: Math.round(income + personalIncome - expense - insurance) };
  });
}

function _buildStats(rows, year) {
  const list = rows || [];
  const tI = list.reduce((s, r) => s + r.income, 0);
  const tPI = list.reduce((s, r) => s + r.personalIncome, 0);
  const tE = list.reduce((s, r) => s + r.expense, 0);
  const tIns = list.reduce((s, r) => s + r.insurance, 0);
  const net = tI + tPI - tE - tIns;
  return [
    { title: `${year} 家庭收入`, value: formatHKD(tI), valueClass: 'emerald', hint: '家用轉入加總', icon: 'trending-up' },
    { title: `${year} 個人收入`, value: formatHKD(tPI), valueClass: 'cyan', hint: '成員個人收入加總', icon: 'wallet' },
    { title: `${year} 年度總支出`, value: formatHKD(tE), valueClass: 'red', hint: '含家庭共用支出', icon: 'trending-down' },
    { title: `${year} 年度保險平攤`, value: formatHKD(tIns), valueClass: 'magenta', hint: '保險自動分攤加總', icon: 'shield' },
    { title: `${year} 年度淨餘額`, value: formatHKD(net), valueClass: net >= 0 ? 'emerald' : 'red', hint: '收入 + 個人 − 支出 − 保險', icon: 'calculator' },
  ];
}