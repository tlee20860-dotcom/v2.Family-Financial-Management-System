// ============================================
// dashboard.js — 總覽儀表板（v102.0.0）
// 位置：js/pages/dashboard.js
// ============================================
// v102.0.0 修正：
//   ✅ 統計卡第 1 張改為「家庭總餘額」（從 bank_accounts 計算）
//   ✅ 其他統計卡保留：年度總收入（家用轉入）/ 年度總支出 / 年度淨餘額
//   ✅ 保留 v101.7.6 全部功能
// ============================================

import { api } from '../core/api.js';
import { AppState } from '../core/state.js';
import { formatHKD, escapeHtml, setText } from '../core/utils.js';
import {
  listenBankAccounts, listenAllBankTransactions,
} from '../core/db.js';
import { calcTotalBankBalance } from '../shared/bank-helpers.js';
import { renderStatsCards } from '../shared/stats-cards.js';
import { renderDataTable } from '../shared/data-table.js';
import { initViewToggle } from '../shared/view-toggle.js';
import { createListenerGroup } from '../shared/listener-group.js';
import { registerPageCleanup } from '../core/app.js';

let _annualData = {};
let _years = [];
let _currentYear = 0;
let _bankAccounts = [];
let _bankTransactions = [];
let _statsCardsApi = null;
let _viewToggle = null;
let _annualTableApi = null;
let _errorEl = null;

const listenerGroup = createListenerGroup();

/* ============================================
   主入口
   ============================================ */
export async function initDashboardPage() {
  _errorEl = document.getElementById('dashboard-error');

  _currentYear = Number(AppState.year) || new Date().getFullYear();
  _years = _getSurroundingYears(_currentYear);

  setText('dashboard-subtitle', `${_years[0]} ~ ${_years[_years.length - 1]} 年`);

  _viewToggle = initViewToggle({
    containerId: 'dashboard-view-toggle-root',
    storageKey: 'dashboard-view',
    defaultView: 'table',
    cardText: '卡片',
    tableText: '表格',
    autoApply: false,
    onChange: () => _renderAnnual(),
  });

  // 🆕 v102.0.0：監聽銀行帳號 / 交易
  listenerGroup.add(listenBankAccounts((list) => {
    _bankAccounts = list || [];
    _renderStatsCards();
  }));

  listenerGroup.add(listenAllBankTransactions((list) => {
    _bankTransactions = list || [];
    _renderStatsCards();
  }));

  listenerGroup.add(AppState.on('ym-change', () => {
    _currentYear = Number(AppState.year) || _currentYear;
    _years = _getSurroundingYears(_currentYear);
    setText('dashboard-subtitle', `${_years[0]} ~ ${_years[_years.length - 1]} 年`);
    _loadAnnualData();
  }));

  await _loadAnnualData();

  registerPageCleanup(_destroy);
  return { destroy: _destroy };
}

function _getSurroundingYears(currentYear) {
  const years = [];
  for (let i = -2; i <= 2; i++) years.push(currentYear + i);
  return years;
}

/* ============================================
   載入年度資料
   ============================================ */
async function _loadAnnualData() {
  _annualData = {};

  _renderStatsCards();
  _renderAnnual();

  // 階段 1：當前年
  try {
    _annualData[_currentYear] = await api.fetchAnnualSummary(_currentYear);
    _renderStatsCards();
    _renderAnnual();
  } catch (err) {
    console.error(`[dashboard] 載入 ${_currentYear} 失敗：`, err);
    _showError(`無法載入 ${_currentYear} 年度資料`);
  }

  // 階段 2：其餘
  for (const y of _years) {
    if (y === _currentYear) continue;
    try {
      _annualData[y] = await api.fetchAnnualSummary(y);
    } catch (err) {
      console.warn(`[dashboard] 載入 ${y} 失敗：`, err);
    }
    _renderAnnual();
  }
}

/* ============================================
   統計卡（🆕 v102.0.0：家庭總餘額）
   ============================================ */
function _renderStatsCards() {
  const data = _annualData[_currentYear];
  if (!data && _bankAccounts.length === 0) {
    if (_statsCardsApi) { try { _statsCardsApi.destroy(); } catch (e) {} _statsCardsApi = null; }
    return;
  }

  const { year, month } = AppState.getYearMonth();
  const targetYear = _currentYear;
  const targetMonth = month === 'all' ? '12' : month;

  // 🆕 家庭總餘額
  const totalBankBalance = calcTotalBankBalance(
    _bankAccounts, _bankTransactions, targetYear, targetMonth
  );

  const monthsWithData = (data?.monthly || []).filter((m) => m.totalExpense > 0).length;
  const monthlyAvg = data && monthsWithData > 0 ? Math.round(data.totalExpense / monthsWithData) : 0;

  const cards = [
    {
      title: '家庭總餘額',
      value: formatHKD(totalBankBalance),
      valueClass: totalBankBalance >= 0 ? 'emerald' : 'red',
      hint: `共 ${_bankAccounts.length} 個銀行帳號`,
      icon: 'landmark',
    },
    {
      title: `${_currentYear} 家庭收入`,
      value: formatHKD(data?.totalIncome || 0),
      valueClass: 'emerald',
      hint: '家用轉入加總',
      icon: 'trending-up',
    },
    {
      title: `${_currentYear} 年度總支出`,
      value: formatHKD(data?.totalExpense || 0),
      valueClass: 'red',
      hint: '含保險平攤',
      icon: 'trending-down',
    },
    {
      title: `${_currentYear} 年度淨餘額`,
      value: formatHKD(data?.netBalance || 0),
      valueClass: (data?.netBalance || 0) >= 0 ? 'emerald' : 'red',
      hint: '家用轉入 − 支出',
      icon: 'wallet',
    },
  ];

  if (_statsCardsApi) { try { _statsCardsApi.destroy(); } catch (e) {} }
  _statsCardsApi = renderStatsCards({
    container: 'stats-cards-root',
    cards,
    columns: 4,
  });
}

/* ============================================
   年度資料準備
   ============================================ */
function _getAnnualRows() {
  return _years.map((year) => {
    const data = _annualData[year];
    const isCurrent = year === _currentYear;

    if (!data) {
      return { year, isCurrent, hasData: false };
    }

    const monthsWithData = (data.monthly || []).filter((m) => m.totalExpense > 0).length;
    const avg = monthsWithData > 0 ? Math.round(data.totalExpense / monthsWithData) : 0;

    return {
      year,
      isCurrent,
      hasData: true,
      totalIncome: data.totalIncome,
      totalExpense: data.totalExpense,
      insurance: data.yearlyInsuranceTotal,
      net: data.netBalance,
      avg,
    };
  });
}

/* ============================================
   年度渲染
   ============================================ */
function _renderAnnual() {
  const view = _viewToggle?.getView() || 'table';
  const tableRoot = document.getElementById('annual-table-root');
  const cardRoot = document.getElementById('annual-card-root');

  if (view === 'card') {
    if (tableRoot) tableRoot.style.display = 'none';
    if (cardRoot) { cardRoot.style.display = 'block'; _renderAnnualCards(cardRoot); }
  } else {
    if (tableRoot) tableRoot.style.display = 'block';
    if (cardRoot) cardRoot.style.display = 'none';
    _renderAnnualTable();
  }
}

function _renderAnnualTable() {
  const root = document.getElementById('annual-table-root');
  if (!root) return;

  if (_annualTableApi) { try { _annualTableApi.destroy(); } catch (e) {} _annualTableApi = null; }

  const rows = _getAnnualRows().filter((r) => r.hasData);

  if (!rows.length) {
    root.innerHTML = '<div class="empty-state" style="padding:20px;">載入中…</div>';
    return;
  }

  _annualTableApi = renderDataTable({
    container: root,
    entityKey: '__annual__',
    rows,
    tableId: 'dashboard-annual-table',
    options: {
      columns: [
        { id: 'year',         label: '年度',     defaultVisible: true, defaultWidth: 100 },
        { id: 'totalIncome',  label: '家庭收入',   defaultVisible: true, defaultWidth: 130 },   // 🔄 改名
        { id: 'totalExpense', label: '總支出',   defaultVisible: true, defaultWidth: 130 },
        { id: 'insurance',    label: '保險平攤', defaultVisible: true, defaultWidth: 130 },
        { id: 'net',          label: '淨餘額',   defaultVisible: true, defaultWidth: 130 },
        { id: 'avg',          label: '每月平均', defaultVisible: true, defaultWidth: 130 },
      ],
      resolvers: {
        year: (_, row) => `${row.year} 年${row.isCurrent ? ' <span class="badge badge-info" style="font-size:10px;">今年</span>' : ''}`,
        totalIncome: (val) => `<span class="text-emerald">${formatHKD(val)}</span>`,
        totalExpense: (val) => `<span class="text-red">${formatHKD(val)}</span>`,
        insurance: (val) => `<span class="text-magenta">${formatHKD(val)}</span>`,
        net: (val) => `<span class="${val >= 0 ? 'text-emerald' : 'text-red'}">${formatHKD(val)}</span>`,
        avg: (val) => formatHKD(val),
      },
      mobileCardMode: false,
      collapsible: true,
      defaultCollapsed: false,
      expandable: true,
      storageKey: 'dashboard-annual-table',
      renderDetail: (row) => `
        <div style="font-size:13px; display:grid; grid-template-columns:repeat(auto-fill, minmax(160px, 1fr)); gap:8px 20px;">
          <div><div style="color:var(--text-muted); font-size:11px; margin-bottom:2px;">家庭收入</div><div class="mono text-emerald">${formatHKD(row.totalIncome)}</div></div>
          <div><div style="color:var(--text-muted); font-size:11px; margin-bottom:2px;">年度總支出</div><div class="mono text-red">${formatHKD(row.totalExpense)}</div></div>
          <div><div style="color:var(--text-muted); font-size:11px; margin-bottom:2px;">保險平攤</div><div class="mono text-magenta">${formatHKD(row.insurance)}</div></div>
          <div><div style="color:var(--text-muted); font-size:11px; margin-bottom:2px;">淨餘額</div><div class="mono ${row.net >= 0 ? 'text-emerald' : 'text-red'}">${formatHKD(row.net)}</div></div>
          <div><div style="color:var(--text-muted); font-size:11px; margin-bottom:2px;">每月平均支出</div><div class="mono">${formatHKD(row.avg)}</div></div>
        </div>
      `,
    },
    hooks: { customActions: () => [] },
  });
}

function _renderAnnualCards(container) {
  const rows = _getAnnualRows().filter((r) => r.hasData);

  if (!rows.length) {
    container.innerHTML = '<div class="empty-state" style="padding:20px;">載入中…</div>';
    return;
  }

  container.innerHTML = `
    <div class="data-cards-grid">
      ${rows.map((r) => `
        <div class="glass-card" style="padding:16px; ${r.isCurrent ? 'border-color:var(--neon-cyan);' : ''}">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <div style="font-size:15px; font-weight:700; color:var(--neon-cyan);">${r.year} 年</div>
            ${r.isCurrent ? '<span class="badge badge-info" style="font-size:10px;">今年</span>' : ''}
          </div>
          <div style="display:flex; flex-direction:column; gap:6px; font-size:13px;">
            <div style="display:flex; justify-content:space-between;"><span class="text-muted">收入</span><span class="mono text-emerald">${formatHKD(r.totalIncome)}</span></div>
            <div style="display:flex; justify-content:space-between;"><span class="text-muted">支出</span><span class="mono text-red">${formatHKD(r.totalExpense)}</span></div>
            <div style="display:flex; justify-content:space-between;"><span class="text-muted">保險</span><span class="mono text-magenta">${formatHKD(r.insurance)}</span></div>
            <div style="display:flex; justify-content:space-between;"><span class="text-muted">每月平均</span><span class="mono">${formatHKD(r.avg)}</span></div>
            <div style="display:flex; justify-content:space-between; margin-top:6px; padding-top:6px; border-top:1px dashed rgba(255,255,255,0.08);">
              <span class="text-muted">淨餘額</span>
              <span class="mono ${r.net >= 0 ? 'text-emerald' : 'text-red'}" style="font-weight:700;">${formatHKD(r.net)}</span>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function _showError(msg) {
  if (_errorEl) {
    _errorEl.textContent = '⚠ ' + msg;
    _errorEl.style.display = 'block';
  }
}

function _destroy() {
  listenerGroup.destroy();
  if (_statsCardsApi) { try { _statsCardsApi.destroy(); } catch (e) {} _statsCardsApi = null; }
  if (_viewToggle) { try { _viewToggle.destroy(); } catch (e) {} _viewToggle = null; }
  if (_annualTableApi) { try { _annualTableApi.destroy(); } catch (e) {} _annualTableApi = null; }
  _annualData = {};
  _years = [];
  _bankAccounts = [];
  _bankTransactions = [];
}