// ============================================
// member-report.js — 成員收支明細（v103.0.0 Page Schema）
// 位置：js/pages/member-report.js
// ============================================
import { createPage } from '../engines/page-engine.js';
import { formatHKD } from '../lib/format.js';
import { AppState } from '../core/state.js';
import { RESERVED_IDS } from '../config/constants.js';

export default {
  title: '成員與家庭收入與支出明細',

  data: {
    members:        { type: 'list', path: 'members' },
    allIncome:      { type: 'list', path: 'income/{__all__}', transform: _flatIncome },
    allExpenses:    { type: 'list', path: 'expenses/{__all__}', transform: _flatExpenses },
  },

  state: {
    currentYear: String(AppState.year || new Date().getFullYear()),
    selectedMemberId: null,
    view: 'table',
  },

  derived: {
    rows: {
      deps: ['data.members', 'data.allIncome', 'data.allExpenses', 'state.currentYear'],
      compute: _buildRows,
    },
    statsCards: {
      deps: ['rows', 'state.currentYear'],
      compute: _buildStats,
    },
  },

  blocks: [
    { type: 'stats', container: 'member-report-stats-root', cards: '$.statsCards' },
    { type: 'list', container: 'member-list-root', rows: '$.rows',
      columns: 'memberReport', tableId: 'member-report-table',
      view: 'table', emptyText: '尚無成員' },
  ],
};

function _flatIncome(raw) {
  const flat = [];
  Object.entries(raw || {}).forEach(([year, months]) => {
    Object.entries(months || {}).forEach(([month, data]) => {
      Object.entries(data || {}).forEach(([memberId, amount]) => {
        flat.push({ year, month, memberId, amount: Number(amount) || 0 });
      });
    });
  });
  return flat;
}

function _flatExpenses(raw) {
  const flat = [];
  Object.entries(raw || {}).forEach(([year, months]) => {
    Object.entries(months || {}).forEach(([month, mData]) => {
      Object.entries(mData?.member_expenses || {}).forEach(([memberId, items]) => {
        Object.entries(items || {}).forEach(([id, e]) => {
          flat.push({ id, memberId, year, month, ...e });
        });
      });
    });
  });
  return flat;
}

function _buildRows(members, allIncome, allExpenses, year) {
  const list = members.map((m) => ({ id: m.id, name: m.name, isShared: false }));
  list.push({ id: RESERVED_IDS.SHARED_MEMBER, name: '家庭共用', isShared: true });

  return list.map((m) => {
    const income = allIncome.filter((i) => i.year === year && i.memberId === m.id)
      .reduce((s, i) => s + i.amount, 0);
    const exps = allExpenses.filter((e) => e.year === year && e.memberId === m.id);
    const expense = exps.filter((e) => !e.isAutoLinked).reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const insurance = exps.filter((e) => e.isAutoLinked).reduce((s, e) => s + (Number(e.amount) || 0), 0);
    return { ...m, income, expense, insurance, personalIncome: 0, net: income - expense - insurance };
  });
}

function _buildStats(rows, year) {
  const totalIncome = rows.reduce((s, r) => s + r.income, 0);
  const totalExpense = rows.reduce((s, r) => s + r.expense, 0);
  const totalInsurance = rows.reduce((s, r) => s + r.insurance, 0);
  const net = totalIncome - totalExpense - totalInsurance;
  return [
    { title: `${year} 家庭收入`, value: formatHKD(totalIncome), valueClass: 'emerald', hint: '家用轉入加總', icon: 'trending-up' },
    { title: `${year} 年度總支出`, value: formatHKD(totalExpense), valueClass: 'red', hint: '含家庭共用支出', icon: 'trending-down' },
    { title: `${year} 年度保險平攤`, value: formatHKD(totalInsurance), valueClass: 'magenta', hint: '保險自動分攤加總', icon: 'shield' },
    { title: `${year} 年度淨餘額`, value: formatHKD(net), valueClass: net >= 0 ? 'emerald' : 'red', hint: '收入 − 支出 − 保險', icon: 'wallet' },
  ];
}
