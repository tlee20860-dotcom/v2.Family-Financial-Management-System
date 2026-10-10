// ============================================
// annual-report.js — 年度報表（v103.0.15 Page Schema）
// 位置：js/pages/annual-report.js
// ============================================
// v103.0.15 修正：
//   ✅ [P17-01] 改用 blocks 機制（page-engine 自動通知）
//   ✅ view toggle 用 display 切換
// ============================================

import { formatHKD } from '../lib/format.js';
import { esc } from '../lib/dom.js';
import { AppState } from '../core/state.js';
import { RESERVED_IDS } from '../config/constants.js';
import { resolveName } from '../config/entity-registry.js';
import { renderDataTable } from '../shared/data-table.js';
import { initViewToggle } from '../ui/view-toggle.js';

export default {
  title: '年度報表',
  data: {
    members:           { type: 'list', path: 'members' },
    allIncome:         { type: 'raw', path: 'income' },
    allExpenses:       { type: 'raw', path: 'expenses' },
    allPersonalIncome: { type: 'raw', path: 'personal_income' },
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
      compute: _buildStats,
    },
    monthlyRows: {
      deps: ['data.members', 'data.allExpenses', 'state.year', 'state.displayMonth'],
      compute: _buildMonthlyRows,
    },
  },
  blocks: [
    { type: 'stats', container: 'annual-stats-root', cards: '$.statsCards' },
  ],

  customMount: (ctx) => {
    let _toggle = null, _sumApi = null, _monApi = null;

    const renderViews = () => {
      _renderSummary(ctx);
      _renderMonthly(ctx);
    };

    _renderYearSwitcher(ctx, renderViews);
    _renderMonthSwitcher(ctx, renderViews);
    renderViews();

    _toggle = initViewToggle({
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

    const initialView = _toggle?.getView() || 'summary';
    document.getElementById('annual-summary-view').style.display = initialView === 'summary' ? 'block' : 'none';
    document.getElementById('annual-monthly-view').style.display = initialView === 'monthly' ? 'block' : 'none';

    const _orig = ctx.invalidate;
    ctx.invalidate = (k) => { _orig(k); setTimeout(renderViews, 0); };

    const exportBtn = document.getElementById('export-excel-btn');
    const onExport = () => _exportCsv(ctx);
    if (exportBtn) exportBtn.addEventListener('click', onExport);

    return {
      destroy: () => {
        if (_toggle) { try { _toggle.destroy(); } catch (e) {} }
        if (_sumApi) { try { _sumApi.destroy(); } catch (e) {} }
        if (_monApi) { try { _monApi.destroy(); } catch (e) {} }
        if (exportBtn) exportBtn.removeEventListener('click', onExport);
      },
    };
  },
};

/* ============================================
   View 渲染
   ============================================ */
function _renderSummary(ctx) {
  const root = document.getElementById('annual-summary-view');
  if (!root) return;
  const rows = ctx.derived.membersRows;
  if (!rows || rows.length === 0) {
    root.innerHTML = '<div class="glass-card"><div class="empty-state">載入中…</div></div>';
    return;
  }
  renderDataTable({
    container: root,
    entityKey: '__annual_summary__',
    rows,
    tableId: 'annual-summary-table',
    options: {
      columns: [
        { id: 'name', label: '成員', defaultVisible: true },
        { id: 'income', label: '家用轉入', defaultVisible: true, type: 'number' },
        { id: 'personalIncome', label: '個人收入', defaultVisible: true, type: 'number' },
        { id: 'expense', label: '總支出', defaultVisible: true, type: 'number' },
        { id: 'net', label: '淨結餘', defaultVisible: true, type: 'number' },
      ],
      resolvers: {
        name: (v, r) => r.__isTotal ? `<b style="color:var(--neon-cyan);">${esc(v)}</b>` : (r.__isShared ? `<span class="text-magenta">${esc(v)}</span>` : esc(v)),
        income: (v) => v > 0 ? `<span class="text-emerald">${formatHKD(v)}</span>` : '<span class="text-muted">—</span>',
        personalIncome: (v) => v > 0 ? `<span class="text-cyan">${formatHKD(v)}</span>` : '<span class="text-muted">—</span>',
        expense: (v) => v > 0 ? `<span class="text-red">${formatHKD(v)}</span>` : '<span class="text-muted">—</span>',
        net: (v) => `<span class="${v >= 0 ? 'text-emerald' : 'text-red'}">${formatHKD(v)}</span>`,
      },
      storageKey: 'annual-summary-table',
    },
  });
}

function _renderMonthly(ctx) {
  const root = document.getElementById('annual-monthly-view');
  if (!root) return;
  const rows = ctx.derived.monthlyRows || [];
  const { year, displayMonth } = ctx.state;
  if (rows.length === 0) {
    root.innerHTML = `<div class="glass-card"><div class="empty-state">${year}-${displayMonth} 尚無支出紀錄</div></div>`;
    return;
  }
  const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  root.innerHTML = `<div class="banner mb-16" style="display:flex;justify-content:space-between;"><span>${year} 年 ${displayMonth} 月支出明細</span><span class="mono text-red" style="font-weight:700;">總計 ${formatHKD(total)}</span></div><div id="annual-monthly-table-root"></div>`;
  renderDataTable({
    container: 'annual-monthly-table-root',
    entityKey: '__annual_monthly__',
    rows,
    tableId: 'annual-monthly-table',
    options: {
      mobileCardMode: true,
      columns: [
        { id: 'date', label: '日期', defaultVisible: true },
        { id: 'memberName', label: '成員', defaultVisible: true },
        { id: 'categoryName', label: '類別', defaultVisible: true },
        { id: 'itemName', label: '項目', defaultVisible: true },
        { id: 'name', label: '名稱', defaultVisible: true },
        { id: 'amount', label: '金額', defaultVisible: true, type: 'number' },
        { id: 'status', label: '狀態', defaultVisible: true },
      ],
      resolvers: {
        date: (v) => esc(v || '—'),
        memberName: (v) => esc(v || '—'),
        categoryName: (v) => v ? `<span class="badge badge-info">${esc(v)}</span>` : '<span class="badge badge-muted">—</span>',
        itemName: (v) => esc(v || '—'),
        name: (v) => esc(v || '—'),
        amount: (v) => `<span class="mono text-red">${formatHKD(v)}</span>`,
        status: (v) => `<span class="badge ${v && v.startsWith('已') ? 'badge-success' : 'badge-pending'}">${esc(v || '—')}</span>`,
      },
      storageKey: 'annual-monthly-table',
    },
  });
}

/* ============================================
   年份 / 月份切換
   ============================================ */
function _renderYearSwitcher(ctx, onChange) {
  const root = document.getElementById('annual-year-switcher');
  if (!root) return;
  const cur = ctx.state.year;
  const curY = new Date().getFullYear();
  const years = [];
  for (let y = curY - 5; y <= curY + 1; y++) years.push(String(y));
  root.innerHTML = `<div class="year-switcher">${years.map((y) => `<button type="button" class="year-btn ${y === cur ? 'active' : ''}" data-year="${y}">${y}</button>`).join('')}</div>`;
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-year]');
    if (!btn) return;
    ctx.state.year = btn.dataset.year;
    root.querySelectorAll('.year-btn').forEach((b) => b.classList.toggle('active', b.dataset.year === btn.dataset.year));
    onChange();
  });
}

function _renderMonthSwitcher(ctx, onChange) {
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
    onChange();
  });
}

/* ============================================
   Helpers
   ============================================ */
function _buildAnnualRows(members, allIncome, allExpenses, allPersonalIncome, year) {
  const yk = String(year || '');
  const yi = (allIncome || {})[yk] || {};
  const ye = (allExpenses || {})[yk] || {};
  const rows = (members || []).map((m) => {
    let income = 0, personalIncome = 0, expense = 0;
    Object.values(yi).forEach((md) => { income += Number(md && md[m.id]) || 0; });
    Object.values((allPersonalIncome || {})[m.id] || {}[yk] || {}).forEach((v) => { personalIncome += Number(v) || 0; });
    Object.values(ye).forEach((md) => {
      const me = (md && md.member_expenses && md.member_expenses[m.id]) || {};
      Object.values(me).forEach((e) => { expense += Number(e && e.amount) || 0; });
    });
    return { id: m.id, name: m.name, income: Math.round(income), personalIncome: Math.round(personalIncome), expense: Math.round(expense), net: Math.round(income + personalIncome - expense) };
  });
  let sharedExpense = 0;
  Object.values(ye).forEach((md) => {
    const se = (md && md.member_expenses && md.member_expenses[RESERVED_IDS.SHARED_MEMBER]) || {};
    Object.values(se).forEach((e) => { sharedExpense += Number(e && e.amount) || 0; });
  });
  if (sharedExpense > 0) rows.push({ id: RESERVED_IDS.SHARED_MEMBER, name: '家庭共用', income: 0, personalIncome: 0, expense: Math.round(sharedExpense), net: -Math.round(sharedExpense), __isShared: true });
  const total = rows.reduce((s, r) => ({ income: s.income + r.income, personalIncome: s.personalIncome + r.personalIncome, expense: s.expense + r.expense, net: s.net + r.net }), { income: 0, personalIncome: 0, expense: 0, net: 0 });
  rows.push({ id: '__total__', name: '總計', income: total.income, personalIncome: total.personalIncome, expense: total.expense, net: total.net, __isTotal: true });
  return rows;
}

function _buildStats(rows, year) {
  const dataRows = (rows || []).filter((r) => !r.__isTotal);
  const tI = dataRows.reduce((s, r) => s + r.income, 0);
  const tPI = dataRows.reduce((s, r) => s + r.personalIncome, 0);
  const tE = dataRows.reduce((s, r) => s + r.expense, 0);
  const net = tI + tPI - tE;
  return [
    { title: `${year} 家用轉入`, value: formatHKD(tI), valueClass: 'emerald', hint: '家庭成員轉入加總', icon: 'trending-up' },
    { title: `${year} 個人收入`, value: formatHKD(tPI), valueClass: 'cyan', hint: '成員個人收入加總', icon: 'wallet' },
    { title: `${year} 年度總支出`, value: formatHKD(tE), valueClass: 'red', hint: '含家庭共用支出', icon: 'trending-down' },
    { title: `${year} 年度淨結餘`, value: formatHKD(net), valueClass: net >= 0 ? 'emerald' : 'red', hint: '轉入 + 個人收入 − 支出', icon: 'calculator' },
  ];
}

function _buildMonthlyRows(members, allExpenses, year, month) {
  const yk = String(year || '');
  const mk = String(month || '');
  const ye = (allExpenses || {})[yk] || {};
  const monthData = ye[mk] || {};
  const memberExps = monthData.member_expenses || {};
  const rows = [];
  Object.entries(memberExps).forEach(([memberId, items]) => {
    const memberName = memberId === RESERVED_IDS.SHARED_MEMBER ? '🏠 家庭共用' : (resolveName('members', memberId) || memberId);
    Object.entries(items || {}).forEach(([id, e]) => {
      rows.push({
        id, memberId, memberName,
        name: e.name || '', amount: Number(e.amount) || 0,
        status: e.status || '', date: e.date || '',
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
  if (rows.length === 0) return;
  const year = ctx.state.year;
  const lines = [['成員', '家用轉入', '個人收入', '總支出', '淨結餘'].join(',')];
  rows.forEach((r) => {
    lines.push([`"${String(r.name || '').replace(/"/g, '""')}"`, r.income, r.personalIncome, r.expense, r.net].join(','));
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
}