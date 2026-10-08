// ============================================
// dashboard.js — 總覽儀表板（v101.7.0）
// 位置：js/pages/dashboard.js
// ============================================
// v101.7.0 新增：
//   ✅ 雙模式切換（卡片 / 表格）
//   ✅ 年度總覽：可摺疊 + 每列展開
// ============================================

import { api } from '../core/api.js';
import { AppState } from '../core/state.js';
import { formatHKD, escapeHtml, setText } from '../core/utils.js';
import { renderStatsCards } from '../shared/stats-cards.js';
import { renderDataTable } from '../shared/data-table.js';
import { initViewToggle } from '../shared/view-toggle.js';
import { registerPageCleanup } from '../core/app.js';

let _annualData = {};
let _years = [];
let _currentYear = 0;
let _statsCardsApi = null;
let _viewToggle = null;
let _annualTableApi = null;
let _errorEl = null;

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
   載入年度資料（兩階段）
   ============================================ */
async function _loadAnnualData() {
  _annualData = {};

  // 初始渲染
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

  // 階段 2：其餘 4 年
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
   統計卡
   ============================================ */
function _renderStatsCards() {
  const data = _annualData[_currentYear];
  if (!data) {
    if (_statsCardsApi) { try { _statsCardsApi.destroy(); } catch (e) {} _statsCardsApi = null; }
    return;
  }

  const monthsWithData = (data.monthly || []).filter((m) => m.totalExpense > 0).length;
  const monthlyAvg = monthsWithData > 0 ? Math.round(data.totalExpense / monthsWithData) : 0;

  const cards = [
    { title: `${_currentYear} 年度總收入`, value: formatHKD(data.totalIncome), valueClass: 'emerald', hint: '所有成員收入加總', icon: 'trending-up' },
    { title: `${_currentYear} 年度總支出`, value: formatHKD(data.totalExpense), valueClass: 'red', hint: '含保險平攤', icon: 'trending-down' },
    { title: `${_currentYear} 年度淨餘額`, value: formatHKD(data.netBalance), valueClass: data.netBalance >= 0 ? 'emerald' : 'red', hint: '收入 − 支出', icon: 'wallet' },
    { title: `${_currentYear} 每月平均支出`, value: formatHKD(monthlyAvg), valueClass: 'magenta', hint: monthsWithData > 0 ? `依 ${monthsWithData} 個月計算` : '尚無支出', icon: 'calculator' },
  ];

  if (_statsCardsApi) { try { _statsCardsApi.destroy(); } catch (e) {} }
  _statsCardsApi = renderStatsCards({ container: 'stats-cards-root', cards, columns: 4 });
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
      year, isCurrent, hasData: true,
      totalIncome: data.totalIncome,
      totalExpense: data.totalExpense,
      insurance: data.yearlyInsuranceTotal,
      net: data.netBalance,
      avg,
    };
  });
}

/* ============================================
   年度渲染（依 view 切換）
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

/* ============================================
   年度表格
   ============================================ */
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
        { id: 'year',      label: '年度', defaultVisible: true, defaultWidth: 100 },
        { id: 'income',    label: '總收入', defaultVisible: true, defaultWidth: 130 },
        { id: 'expense',   label: '總支出', defaultVisible: true, defaultWidth: 130 },
        { id: 'insurance', label: '保險平攤', defaultVisible: true, defaultWidth: 130 },
        { id: 'net',       label: '淨餘額', defaultVisible: true, defaultWidth: 130 },
        { id: 'avg',       label: '每月平均', defaultVisible: true, defaultWidth: 130 },
      ],
      resolvers: {
        year: (_, row) => `${row.year} 年${row.isCurrent ? ' <span class="badge badge-info" style="font-size:10px;">今年</span>' : ''}`,
        income: (val) => `<span class="text-emerald">${formatHKD(val)}</span>`,
        expense: (val) => `<span class="text-red">${formatHKD(val)}</span>`,
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
          <div><div style="color:var(--text-muted); font-size:11px; margin-bottom:2px;">年度總收入</div><div class="mono text-emerald">${formatHKD(row.totalIncome)}</div></div>
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

/* ============================================
   年度卡片
   ============================================ */
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

/* ============================================
   錯誤顯示
   ============================================ */
function _showError(msg) {
  if (_errorEl) {
    _errorEl.textContent = '⚠ ' + msg;
    _errorEl.style.display = 'block';
  }
}

/* ============================================
   銷毀
   ============================================ */
function _destroy() {
  if (_statsCardsApi) { try { _statsCardsApi.destroy(); } catch (e) {} _statsCardsApi = null; }
  if (_viewToggle) { try { _viewToggle.destroy(); } catch (e) {} _viewToggle = null; }
  if (_annualTableApi) { try { _annualTableApi.destroy(); } catch (e) {} _annualTableApi = null; }
  _annualData = {};
  _years = [];
}