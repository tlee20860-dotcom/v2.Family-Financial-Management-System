// ============================================
// member-report.js — 成員收支明細（v103.0.11 Page Schema）
// 位置：js/pages/member-report.js
// ============================================
// v103.0.11 修正：
//   ✅ [M12] personalIncome 從 personal_income 節點實際讀取
//   ✅ [M12] data 改用 type: 'raw' 讀取 object 結構
// ============================================

import { formatHKD } from '../lib/format.js';
import { AppState } from '../core/state.js';
import { RESERVED_IDS } from '../config/constants.js';

export default {
  title: '成員與家庭收入與支出明細',

  data: {
    members:           { type: 'list', path: 'members' },
    allIncome:         { type: 'raw',  path: 'income' },
    allExpenses:       { type: 'raw',  path: 'expenses' },
    allPersonalIncome: { type: 'raw',  path: 'personal_income' },
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
    {
      type: 'list',
      container: 'member-list-root',
      rows: '$.rows',
      columns: 'memberReport',
      tableId: 'member-report-table',
      view: 'table',
      emptyText: '尚無成員',
    },
  ],
};

/* ============================================
   Helpers
   ============================================ */

/**
 * 🆕 [M12] 從 raw object 結構計算每位成員的年度收支
 */
function _buildRows(members, allIncome, allExpenses, allPersonalIncome, year) {
  const yearStr = String(year || '');
  const incomeYear = (allIncome || {})[yearStr] || {};
  const expenseYear = (allExpenses || {})[yearStr] || {};

  const list = (members || []).map((m) => ({
    id: m.id,
    name: m.name,
    isShared: false,
  }));
  list.push({
    id: RESERVED_IDS.SHARED_MEMBER,
    name: '家庭共用',
    isShared: true,
  });

  return list.map((m) => {
    /* 家用轉入 */
    let income = 0;
    if (!m.isShared) {
      Object.values(incomeYear).forEach((monthData) => {
        income += Number(monthData && monthData[m.id]) || 0;
      });
    }

    /* 個人收入 */
    let personalIncome = 0;
    if (!m.isShared) {
      const memberPersonal = (allPersonalIncome || {})[m.id] || {};
      const yearPersonal = memberPersonal[yearStr] || {};
      Object.values(yearPersonal).forEach((amt) => {
        personalIncome += Number(amt) || 0;
      });
    }

    /* 支出（分為一般支出 / 保險連動） */
    let expense = 0;
    let insurance = 0;
    Object.values(expenseYear).forEach((monthData) => {
      const memberExps = (monthData && monthData.member_expenses && monthData.member_expenses[m.id]) || {};
      Object.values(memberExps).forEach((e) => {
        const amt = Number(e && e.amount) || 0;
        if (e && e.isAutoLinked) {
          insurance += amt;
        } else {
          expense += amt;
        }
      });
    });

    return {
      ...m,
      income: Math.round(income),
      expense: Math.round(expense),
      insurance: Math.round(insurance),
      personalIncome: Math.round(personalIncome),
      net: Math.round(income + personalIncome - expense - insurance),
    };
  });
}

function _buildStats(rows, year) {
  const list = rows || [];
  const totalIncome = list.reduce((s, r) => s + r.income, 0);
  const totalPersonalIncome = list.reduce((s, r) => s + r.personalIncome, 0);
  const totalExpense = list.reduce((s, r) => s + r.expense, 0);
  const totalInsurance = list.reduce((s, r) => s + r.insurance, 0);
  const net = totalIncome + totalPersonalIncome - totalExpense - totalInsurance;

  return [
    {
      title: `${year} 家庭收入`,
      value: formatHKD(totalIncome),
      valueClass: 'emerald',
      hint: '家用轉入加總',
      icon: 'trending-up',
    },
    {
      title: `${year} 個人收入`,
      value: formatHKD(totalPersonalIncome),
      valueClass: 'cyan',
      hint: '成員個人收入加總',
      icon: 'wallet',
    },
    {
      title: `${year} 年度總支出`,
      value: formatHKD(totalExpense),
      valueClass: 'red',
      hint: '含家庭共用支出',
      icon: 'trending-down',
    },
    {
      title: `${year} 年度保險平攤`,
      value: formatHKD(totalInsurance),
      valueClass: 'magenta',
      hint: '保險自動分攤加總',
      icon: 'shield',
    },
    {
      title: `${year} 年度淨餘額`,
      value: formatHKD(net),
      valueClass: net >= 0 ? 'emerald' : 'red',
      hint: '收入 + 個人 − 支出 − 保險',
      icon: 'calculator',
    },
  ];
}