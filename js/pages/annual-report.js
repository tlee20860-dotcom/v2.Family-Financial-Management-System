// ============================================
// annual-report.js — 年度報表（v103.0.11 Page Schema）
// 位置：js/pages/annual-report.js
// ============================================
// v103.0.11 修正：
//   ✅ [M10] membersRows 實際計算年度收支
//   ✅ [M11] 綁定 export-excel-btn（匯出 CSV）
// ============================================

import { formatHKD } from '../lib/format.js';
import { AppState } from '../core/state.js';
import { RESERVED_IDS } from '../config/constants.js';
import { showToast } from '../ui/toast.js';

export default {
  title: '年度報表',

  data: {
    members:           { type: 'list', path: 'members' },
    allIncome:         { type: 'raw',  path: 'income' },
    allExpenses:       { type: 'raw',  path: 'expenses' },
    allPersonalIncome: { type: 'raw',  path: 'personal_income' },
  },

  state: {
    year: String(AppState.year || new Date().getFullYear()),
  },

  derived: {
    membersRows: {
      deps: ['data.members', 'data.allIncome', 'data.allExpenses', 'data.allPersonalIncome', 'state.year'],
      compute: _buildAnnualRows,
    },

    statsCards: {
      deps: ['membersRows', 'state.year'],
      compute: _buildAnnualStats,
    },
  },

  blocks: [
    { type: 'stats', container: 'annual-stats-root', cards: '$.statsCards' },
    {
      type: 'list',
      container: 'summary-table-root',
      rows: '$.membersRows',
      columns: 'annualSummary',
      tableId: 'annual-summary-table',
      view: 'table',
      emptyText: '載入中…',
    },
  ],

  /* ============================================
     🆕 [M11] 綁定匯出 Excel 按鈕
     ============================================ */
  customMount: (ctx) => {
    const btn = document.getElementById('export-excel-btn');
    const handler = () => _exportCsv(ctx);
    if (btn) btn.addEventListener('click', handler);

    return {
      destroy: () => {
        if (btn) btn.removeEventListener('click', handler);
      },
    };
  },
};

/* ============================================
   Helpers
   ============================================ */

/**
 * 🆕 [M10] 計算年度每位成員收支
 */
function _buildAnnualRows(members, allIncome, allExpenses, allPersonalIncome, year) {
  const yearStr = String(year || '');
  const incomeYear = (allIncome || {})[yearStr] || {};
  const expenseYear = (allExpenses || {})[yearStr] || {};

  const rows = (members || []).map((m) => {
    /* 家用轉入 */
    let income = 0;
    Object.values(incomeYear).forEach((monthData) => {
      income += Number(monthData && monthData[m.id]) || 0;
    });

    /* 個人收入 */
    let personalIncome = 0;
    const memberPersonal = (allPersonalIncome || {})[m.id] || {};
    const yearPersonal = memberPersonal[yearStr] || {};
    Object.values(yearPersonal).forEach((amt) => {
      personalIncome += Number(amt) || 0;
    });

    /* 支出 */
    let expense = 0;
    Object.values(expenseYear).forEach((monthData) => {
      const memberExps = (monthData && monthData.member_expenses && monthData.member_expenses[m.id]) || {};
      Object.values(memberExps).forEach((e) => {
        expense += Number(e && e.amount) || 0;
      });
    });

    return {
      id: m.id,
      name: m.name,
      income: Math.round(income),
      personalIncome: Math.round(personalIncome),
      expense: Math.round(expense),
      net: Math.round(income + personalIncome - expense),
    };
  });

  /* 家庭共用列 */
  let sharedExpense = 0;
  Object.values(expenseYear).forEach((monthData) => {
    const sharedExps = (monthData && monthData.member_expenses && monthData.member_expenses[RESERVED_IDS.SHARED_MEMBER]) || {};
    Object.values(sharedExps).forEach((e) => {
      sharedExpense += Number(e && e.amount) || 0;
    });
  });

  if (sharedExpense > 0) {
    rows.push({
      id: RESERVED_IDS.SHARED_MEMBER,
      name: '家庭共用',
      income: 0,
      personalIncome: 0,
      expense: Math.round(sharedExpense),
      net: -Math.round(sharedExpense),
      __isShared: true,
    });
  }

  /* 總計列 */
  const total = rows.reduce((s, r) => ({
    income: s.income + r.income,
    personalIncome: s.personalIncome + r.personalIncome,
    expense: s.expense + r.expense,
    net: s.net + r.net,
  }), { income: 0, personalIncome: 0, expense: 0, net: 0 });

  rows.push({
    id: '__total__',
    name: '總計',
    income: total.income,
    personalIncome: total.personalIncome,
    expense: total.expense,
    net: total.net,
    __isTotal: true,
  });

  return rows;
}

/**
 * 🆕 [M10] 統計卡
 */
function _buildAnnualStats(rows, year) {
  const dataRows = (rows || []).filter((r) => !r.__isTotal);
  const totalIncome = dataRows.reduce((s, r) => s + r.income, 0);
  const totalPersonalIncome = dataRows.reduce((s, r) => s + r.personalIncome, 0);
  const totalExpense = dataRows.reduce((s, r) => s + r.expense, 0);
  const net = totalIncome + totalPersonalIncome - totalExpense;

  return [
    {
      title: `${year} 家用轉入`,
      value: formatHKD(totalIncome),
      valueClass: 'emerald',
      hint: '家庭成員轉入加總',
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
      title: `${year} 年度淨結餘`,
      value: formatHKD(net),
      valueClass: net >= 0 ? 'emerald' : 'red',
      hint: '轉入 + 個人收入 − 支出',
      icon: 'calculator',
    },
  ];
}

/**
 * 🆕 [M11] 匯出 CSV（Excel 可讀，含 BOM 避免亂碼）
 */
function _exportCsv(ctx) {
  const rows = (ctx.derived && ctx.derived.membersRows) || [];
  if (rows.length === 0) {
    showToast('沒有資料可匯出', 'warning');
    return;
  }

  const year = ctx.state.year || new Date().getFullYear();

  const headers = ['成員', '家用轉入', '個人收入', '總支出', '淨結餘'];
  const lines = [headers.join(',')];

  rows.forEach((r) => {
    lines.push([
      `"${String(r.name || '').replace(/"/g, '""')}"`,
      r.income,
      r.personalIncome,
      r.expense,
      r.net,
    ].join(','));
  });

  /* BOM 讓 Excel 正確識別 UTF-8 */
  const csv = '\uFEFF' + lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `annual-report-${year}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
  showToast(`✅ 已匯出 ${year} 年度報表`, 'success');
}