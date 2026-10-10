// ============================================
// annual-report.js — 年度報表（v103.0.14 Page Schema）
// 位置：js/pages/annual-report.js
// ============================================
// v103.0.14 修正：
//   ✅ [問題7] 加年度切換 + 月度切換 + 月度明細表
// ============================================

import { formatHKD } from '../lib/format.js';
import { esc } from '../lib/dom.js';
import { AppState } from '../core/state.js';
import { RESERVED_IDS } from '../config/constants.js';
import { showToast } from '../ui/toast.js';
import { resolveName } from '../config/entity-registry.js';
import { initViewToggle } from '../ui/view-toggle.js';

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
    displayMonth: '01',
    view: 'summary',
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
    monthlyRows: {
      deps: ['data.members', 'data.allExpenses', 'state.year', 'state.displayMonth'],
      compute: _buildMonthlyRows,
    },
  },

  blocks: [],

  customMount: (ctx) => {
    /* 渲染年份切換 */
    _renderYearSwitcher(ctx);

    /* 渲染月份切換 */
    _renderMonthSwitcher(ctx);

    /* 渲染兩個 view */
    _renderSummaryView(ctx);
    _renderMonthlyView(ctx);

    /* view toggle */
    const toggle = initViewToggle({
      containerId: 'annual-view-toggle',
      storageKey: 'annual-report-view',
      defaultView: 'summary',
      cardText: '全年總合',
      tableText: '月度明細',
      onChange: (view) => {
        ctx.state.view = view;
        document.getElementById('annual-summary-view').style.display = view === 'summary' ? 'block' : 'none';
        document.getElementById('annual-monthly-view').style.display = view === 'monthly' ? 'block' : 'none';
      },
    });

    /* 初次渲染 */
    const initialView = toggle?.getView() || 'summary';
    document.getElementById('annual-summary-view').style.display = initialView === 'summary' ? 'block' : 'none';
    document.getElementById('annual-monthly-view').style.display = initialView === 'monthly' ? 'block' : 'none';

    /* 監聽 derived 變化重繪 */
    const _orig = ctx.invalidate;
    ctx.invalidate = (key) => {
      _orig(key);
      setTimeout(() => {
        _renderSummaryView(ctx);
        _renderMonthlyView(ctx);
      }, 0);
    };

    /* 匯出按鈕 */
    const exportBtn = document.getElementById('export-excel-btn');
    const onExport = () => _exportCsv(ctx);
    if (exportBtn) exportBtn.addEventListener('click', onExport);

    return {
      destroy: () => {
        if (toggle) { try { toggle.destroy(); } catch (e) {} }
        if (exportBtn) exportBtn.removeEventListener('click', onExport);
      },
    };
  },
};

/* ============================================
   年份切換
   ============================================ */
function _renderYearSwitcher(ctx) {
  const root = document.getElementById('annual-year-switcher');
  if (!root) return;

  const current = ctx.state.year;
  const curY = new Date().getFullYear();
  const years = [];
  for (let y = curY - 5; y <= curY + 1; y++) years.push(String(y));

  root.innerHTML = `
    <div class="year-switcher">
      ${years.map((y) => `
        <button type="button" class="year-btn ${y === current ? 'active' : ''}" data-year="${y}">${y}</button>
      `).join('')}
    </div>
  `;

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-year]');
    if (!btn) return;
    ctx.state.year = btn.dataset.year;
    root.querySelectorAll('.year-btn').forEach((b) => b.classList.toggle('active', b.dataset.year === btn.dataset.year));
  });
}

/* ============================================
   月份切換
   ============================================ */
function _renderMonthSwitcher(ctx) {
  const root = document.getElementById('annual-month-switcher');
  if (!root) return;

  const cur = ctx.state.displayMonth;
  let html = '<div class="month-switcher">';
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    html += `<button type="button" class="month-btn ${mm === cur ? 'active' : ''}" data-month="${mm}">${m}月</button>`;
  }
  html += '</div>';
  root.innerHTML = html;

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-month]');
    if (!btn) return;
    ctx.state.displayMonth = btn.dataset.month;
    root.querySelectorAll('.month-btn').forEach((b) => b.classList.toggle('active', b.dataset.month === btn.dataset.month));
  });
}

/* ============================================
   全年總合
   ============================================ */
function _renderSummaryView(ctx) {
  const root = document.getElementById('annual-summary-view');
  if (!root) return;

  const rows = ctx.derived.membersRows || [];
  if (rows.length === 0) {
    root.innerHTML = '<div class="glass-card"><div class="empty-state">載入中…</div></div>';
    return;
  }

  root.innerHTML = `
    <div class="summary-table-wrapper">
      <table class="annual-table">
        <thead>
          <tr>
            <th>成員</th>
            <th class="num">家用轉入</th>
            <th class="num">個人收入</th>
            <th class="num">總支出</th>
            <th class="num">淨結餘</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r) => `
            <tr class="${r.__isTotal ? 'group-header' : (r.__isShared ? 'shared-row' : '')}">
              <td>${esc(r.name)}</td>
              <td class="num">${formatHKD(r.income)}</td>
              <td class="num">${formatHKD(r.personalIncome)}</td>
              <td class="num">${formatHKD(r.expense)}</td>
              <td class="num ${r.net >= 0 ? 'text-emerald' : 'text-red'}">${formatHKD(r.net)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/* ============================================
   月度明細
   ============================================ */
function _renderMonthlyView(ctx) {
  const root = document.getElementById('annual-monthly-view');
  if (!root) return;

  const rows = ctx.derived.monthlyRows || [];
  const year = ctx.state.year;
  const month = ctx.state.displayMonth;

  if (rows.length === 0) {
    root.innerHTML = `<div class="glass-card"><div class="empty-state">${year}-${month} 尚無支出紀錄</div></div>`;
    return;
  }

  const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  root.innerHTML = `
    <div class="banner mb-16" style="display:flex; justify-content:space-between; align-items:center;">
      <span>${year} 年 ${month} 月支出明細</span>
      <span class="mono text-red" style="font-weight:700;">總計 ${formatHKD(total)}</span>
    </div>
    <div class="monthly-table-wrapper">
      <table class="monthly-table">
        <thead>
          <tr>
            <th>日期</th>
            <th>成員</th>
            <th>類別</th>
            <th>項目</th>
            <th>名稱</th>
            <th class="num">金額</th>
            <th>狀態</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r) => `
            <tr>
              <td class="mono">${esc(r.date || '—')}</td>
              <td>${esc(r.memberName || '—')}</td>
              <td>${r.categoryName ? `<span class="badge badge-info">${esc(r.categoryName)}</span>` : '—'}</td>
              <td>${esc(r.itemName || '—')}</td>
              <td>${esc(r.name || '—')}</td>
              <td class="num">${formatHKD(r.amount)}</td>
              <td><span class="badge ${r.statusIsDone ? 'badge-success' : 'badge-pending'}">${esc(r.status || '—')}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/* ============================================
   Helpers
   ============================================ */
function _buildAnnualRows(members, allIncome, allExpenses, allPersonalIncome, year) {
  const yearStr = String(year || '');
  const incomeYear = (allIncome || {})[yearStr] || {};
  const expenseYear = (allExpenses || {})[yearStr] || {};

  const rows = (members || []).map((m) => {
    let income = 0;
    Object.values(incomeYear).forEach((monthData) => {
      income += Number(monthData && monthData[m.id]) || 0;
    });

    let personalIncome = 0;
    const memberPersonal = (allPersonalIncome || {})[m.id] || {};
    const yearPersonal = memberPersonal[yearStr] || {};
    Object.values(yearPersonal).forEach((amt) => {
      personalIncome += Number(amt) || 0;
    });

    let expense = 0;
    Object.values(expenseYear).forEach((monthData) => {
      const memberExps = (monthData && monthData.member_expenses && monthData.member_expenses[m.id]) || {};
      Object.values(memberExps).forEach((e) => {
        expense += Number(e && e.amount) || 0;
      });
    });

    return {
      id: m.id, name: m.name,
      income: Math.round(income),
      personalIncome: Math.round(personalIncome),
      expense: Math.round(expense),
      net: Math.round(income + personalIncome - expense),
    };
  });

  let sharedExpense = 0;
  Object.values(expenseYear).forEach((monthData) => {
    const sharedExps = (monthData && monthData.member_expenses && monthData.member_expenses[RESERVED_IDS.SHARED_MEMBER]) || {};
    Object.values(sharedExps).forEach((e) => {
      sharedExpense += Number(e && e.amount) || 0;
    });
  });
  if (sharedExpense > 0) {
    rows.push({
      id: RESERVED_IDS.SHARED_MEMBER, name: '家庭共用',
      income: 0, personalIncome: 0,
      expense: Math.round(sharedExpense),
      net: -Math.round(sharedExpense),
      __isShared: true,
    });
  }

  const total = rows.reduce((s, r) => ({
    income: s.income + r.income,
    personalIncome: s.personalIncome + r.personalIncome,
    expense: s.expense + r.expense,
    net: s.net + r.net,
  }), { income: 0, personalIncome: 0, expense: 0, net: 0 });

  rows.push({
    id: '__total__', name: '總計',
    income: total.income, personalIncome: total.personalIncome,
    expense: total.expense, net: total.net,
    __isTotal: true,
  });

  return rows;
}

function _buildAnnualStats(rows, year) {
  const dataRows = (rows || []).filter((r) => !r.__isTotal);
  const totalIncome = dataRows.reduce((s, r) => s + r.income, 0);
  const totalPersonalIncome = dataRows.reduce((s, r) => s + r.personalIncome, 0);
  const totalExpense = dataRows.reduce((s, r) => s + r.expense, 0);
  const net = totalIncome + totalPersonalIncome - totalExpense;

  return [
    { title: `${year} 家用轉入`, value: formatHKD(totalIncome), valueClass: 'emerald', hint: '家庭成員轉入加總', icon: 'trending-up' },
    { title: `${year} 個人收入`, value: formatHKD(totalPersonalIncome), valueClass: 'cyan', hint: '成員個人收入加總', icon: 'wallet' },
    { title: `${year} 年度總支出`, value: formatHKD(totalExpense), valueClass: 'red', hint: '含家庭共用支出', icon: 'trending-down' },
    { title: `${year} 年度淨結餘`, value: formatHKD(net), valueClass: net >= 0 ? 'emerald' : 'red', hint: '轉入 + 個人收入 − 支出', icon: 'calculator' },
  ];
}

function _buildMonthlyRows(members, allExpenses, year, month) {
  const yearStr = String(year || '');
  const monthStr = String(month || '');
  const expenseYear = (allExpenses || {})[yearStr] || {};
  const monthData = expenseYear[monthStr] || {};
  const memberExps = monthData.member_expenses || {};

  const rows = [];
  Object.entries(memberExps).forEach(([memberId, items]) => {
    const memberName = memberId === RESERVED_IDS.SHARED_MEMBER
      ? '🏠 家庭共用'
      : (resolveName('members', memberId) || memberId);

    Object.entries(items || {}).forEach(([id, e]) => {
      rows.push({
        id,
        memberId,
        memberName,
        name: e.name || '',
        amount: Number(e.amount) || 0,
        status: e.status || '',
        statusIsDone: e.status === 'done',
        date: e.date || '',
        categoryId: e.categoryId || '',
        categoryName: resolveName('categories', e.categoryId) || '',
        itemId: e.itemId || '',
        itemName: resolveName('items', e.itemId) || '',
      });
    });
  });

  rows.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  return rows;
}

function _exportCsv(ctx) {
  const rows = ctx.derived.membersRows || [];
  if (rows.length === 0) {
    showToast('沒有資料可匯出', 'warning');
    return;
  }

  const year = ctx.state.year;
  const headers = ['成員', '家用轉入', '個人收入', '總支出', '淨結餘'];
  const lines = [headers.join(',')];

  rows.forEach((r) => {
    lines.push([
      `"${String(r.name || '').replace(/"/g, '""')}"`,
      r.income, r.personalIncome, r.expense, r.net,
    ].join(','));
  });

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