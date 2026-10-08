// ============================================
// annual-report.js — 年度報表（v101.7.3）
// 位置：js/pages/annual-report.js
// ============================================
// v101.7.3 修正：
//   ✅ [統一] 統計卡改用 renderStatsCards（跟隨 v101.7.2 的三模式）
//       - 移除 HTML 硬寫 + 手動更新 DOM
//       - 改用 #annual-stats-root 容器
//   ✅ 保留 v101.7.0 全部功能（雙模式 + 可摺疊 + 每列展開）
// ============================================

import { api } from '../core/api.js';
import { AppState } from '../core/state.js';
import { formatHKD, formatNumber, escapeHtml } from '../core/utils.js';
import { getOptions } from '../config/app-config.js';
import { initCollapsibleCard } from '../shared/collapsible-card.js';
import { renderDataTable } from '../shared/data-table.js';
import { renderStatsCards } from '../shared/stats-cards.js';
import { initViewToggle } from '../shared/view-toggle.js';
import { registerPageCleanup } from '../core/app.js';

let _currentYear = '';
let _currentView = 'summary';
let _currentDisplayMonth = '01';
let _annualData = null;
let _cards = [];
let _viewToggle = null;
let _statsApi = null;
let _summaryTableApi = null;
let _yearSwitcherHandler = null;
let _monthSwitcherHandler = null;

/* ============================================
   主入口
   ============================================ */
export function initAnnualReportPage() {
  _cards.push(initCollapsibleCard('summary-table-card', 'ar-summary-open', true));
  _cards.push(initCollapsibleCard('payment-stats-card', 'ar-payment-stats-open', true));
  _cards.push(initCollapsibleCard('monthly-table-card', 'ar-monthly-open', true));

  _viewToggle = initViewToggle({
    containerId: 'report-view-toggle-root',
    storageKey: 'annual-report-view',
    defaultView: 'table',
    cardText: '卡片',
    tableText: '表格',
    autoApply: false,
    onChange: () => {
      if (_currentView === 'summary' && _annualData) _renderSummary();
    },
  });

  const { year } = AppState.getYearMonth();
  _currentYear = year;
  _currentDisplayMonth = AppState.month === 'all' ? '01' : AppState.month;

  _renderYearSwitcher();
  _renderMonthSwitcher();

  document.getElementById('view-summary-btn')?.addEventListener('click', () => _switchView('summary'));
  document.getElementById('view-monthly-btn')?.addEventListener('click', () => _switchView('monthly'));
  document.getElementById('export-excel-btn')?.addEventListener('click', _exportToExcel);

  _loadAnnual();

  registerPageCleanup(_destroy);
  return { destroy: _destroy };
}

/* ============================================
   檢視切換
   ============================================ */
function _switchView(view) {
  _currentView = view;

  const summaryView = document.getElementById('summary-view');
  const monthlyView = document.getElementById('monthly-view');
  const monthSwitcher = document.getElementById('month-switcher');
  const summaryBtn = document.getElementById('view-summary-btn');
  const monthlyBtn = document.getElementById('view-monthly-btn');
  const viewToggleRoot = document.getElementById('report-view-toggle-root');

  if (view === 'summary') {
    if (summaryView) summaryView.style.display = 'block';
    if (monthlyView) monthlyView.style.display = 'none';
    if (monthSwitcher) monthSwitcher.style.display = 'none';
    if (viewToggleRoot) viewToggleRoot.style.display = '';
    summaryBtn?.classList.add('btn-primary');
    summaryBtn?.classList.remove('btn-ghost');
    monthlyBtn?.classList.add('btn-ghost');
    monthlyBtn?.classList.remove('btn-primary');
    if (_annualData) _renderSummary();
  } else {
    if (summaryView) summaryView.style.display = 'none';
    if (monthlyView) monthlyView.style.display = 'block';
    if (monthSwitcher) monthSwitcher.style.display = 'flex';
    if (viewToggleRoot) viewToggleRoot.style.display = 'none';
    summaryBtn?.classList.add('btn-ghost');
    summaryBtn?.classList.remove('btn-primary');
    monthlyBtn?.classList.add('btn-primary');
    monthlyBtn?.classList.remove('btn-ghost');
    if (_annualData) _renderMonthly();
  }
}

/* ============================================
   年份 / 月份切換
   ============================================ */
function _renderYearSwitcher() {
  const el = document.getElementById('year-switcher');
  if (!el) return;

  const y = Number(_currentYear);
  el.innerHTML = `
    <button type="button" class="year-btn year-arrow" data-year="${y - 1}">◀ ${y - 1}</button>
    <button type="button" class="year-btn active">${y}</button>
    <button type="button" class="year-btn year-arrow" data-year="${y + 1}">${y + 1} ▶</button>
  `;

  if (_yearSwitcherHandler) el.removeEventListener('click', _yearSwitcherHandler);
  _yearSwitcherHandler = (e) => {
    const btn = e.target.closest('button[data-year]');
    if (!btn) return;
    _currentYear = btn.dataset.year;
    _renderYearSwitcher();
    _loadAnnual();
  };
  el.addEventListener('click', _yearSwitcherHandler);
}

function _renderMonthSwitcher() {
  const el = document.getElementById('month-switcher');
  if (!el) return;

  let html = '';
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    html += `<button type="button" class="month-btn ${mm === _currentDisplayMonth ? 'active' : ''}" data-month="${mm}">${m}月</button>`;
  }
  el.innerHTML = html;

  if (_monthSwitcherHandler) el.removeEventListener('click', _monthSwitcherHandler);
  _monthSwitcherHandler = (e) => {
    const btn = e.target.closest('button[data-month]');
    if (!btn) return;
    _currentDisplayMonth = btn.dataset.month;
    _renderMonthSwitcher();
    if (_annualData) _renderMonthly();
  };
  el.addEventListener('click', _monthSwitcherHandler);
}

/* ============================================
   載入年度資料
   ============================================ */
async function _loadAnnual() {
  const titleEl = document.getElementById('report-year-title');
  if (titleEl) titleEl.textContent = `${_currentYear} 年`;

  const summaryRoot = document.getElementById('summary-table-root');
  if (summaryRoot) summaryRoot.innerHTML = '<div class="empty-state">載入中…</div>';

  const mtbody = document.getElementById('monthly-tbody');
  if (mtbody) mtbody.innerHTML = '<tr><td colspan="3" class="empty-state">載入中…</td></tr>';

  try {
    const result = await api.fetchAnnualSummary(_currentYear);
    _annualData = _buildAnnualData(_currentYear, result.monthly);
    _renderStats();
    if (_currentView === 'summary') _renderSummary();
    else _renderMonthly();
  } catch (err) {
    console.error('年度報表載入失敗：', err);
    if (summaryRoot) summaryRoot.innerHTML = '<div class="empty-state text-red">載入失敗，請稍後再試。</div>';
    if (mtbody) mtbody.innerHTML = '<tr><td colspan="3" class="empty-state text-red">載入失敗，請稍後再試。</td></tr>';
  }
}

/* ============================================
   建立年度資料結構
   ============================================ */
function _buildAnnualData(year, monthlyResults) {
  const memberMap = {};
  const fixedMap = {};
  const paymentMap = {};
  const monthlyTotals = { income: Array(12).fill(0), expense: Array(12).fill(0) };

  monthlyResults.forEach((monthData, idx) => {
    const incomeBreakdown = monthData.incomeBreakdown || {};
    Object.entries(incomeBreakdown).forEach(([memberId, amount]) => {
      const num = Math.round(Number(amount) || 0);
      if (num === 0) return;
      const displayName = memberId === 'extra' ? '額外收入' : (monthData.perMember?.[memberId]?.memberName || memberId);
      if (!memberMap[memberId]) {
        memberMap[memberId] = { id: memberId, name: displayName, order: memberId === 'extra' ? Number.MAX_SAFE_INTEGER : 0, income: Array(12).fill(0), expenses: {} };
      }
      memberMap[memberId].income[idx] = num;
    });

    const perMember = monthData.perMember || {};
    Object.entries(perMember).forEach(([memberId, mData]) => {
      if (!memberMap[memberId]) {
        memberMap[memberId] = { id: memberId, name: mData.memberName || memberId, order: mData.order != null ? mData.order : Number.MAX_SAFE_INTEGER, income: Array(12).fill(0), expenses: {} };
      }
      memberMap[memberId].order = mData.order != null ? mData.order : memberMap[memberId].order;
      (mData.items || []).forEach((item) => {
        const catId = item.categoryId || '__none__';
        const catName = item.categoryName || '（未分類）';
        if (!memberMap[memberId].expenses[catId]) memberMap[memberId].expenses[catId] = { name: catName, amounts: Array(12).fill(0) };
        memberMap[memberId].expenses[catId].amounts[idx] += Math.round(Number(item.amount) || 0);
      });
    });

    (monthData.fixedList || []).forEach((f) => {
      const catId = f.categoryId || '__none__';
      const catName = f.categoryName || '其他';
      const itemName = f.name || '（未命名）';
      if (!fixedMap[catId]) fixedMap[catId] = { catId, catName, items: {} };
      if (!fixedMap[catId].items[itemName]) fixedMap[catId].items[itemName] = Array(12).fill(0);
      fixedMap[catId].items[itemName][idx] += Math.round(Number(f.amount) || 0);
    });

    const pb = monthData.paymentBreakdown || {};
    Object.entries(pb).forEach(([pmName, amount]) => {
      if (!paymentMap[pmName]) paymentMap[pmName] = Array(12).fill(0);
      paymentMap[pmName][idx] += Math.round(Number(amount) || 0);
    });

    monthlyTotals.income[idx] = Math.round(monthData.totalIncome || 0);
    monthlyTotals.expense[idx] = Math.round(monthData.totalExpense || 0);
  });

  const membersArr = Object.values(memberMap).sort((a, b) => {
    if (a.id === 'extra') return 1;
    if (b.id === 'extra') return -1;
    const oa = a.order != null ? a.order : Number.MAX_SAFE_INTEGER;
    const ob = b.order != null ? b.order : Number.MAX_SAFE_INTEGER;
    if (oa !== ob) return oa - ob;
    return 0;
  });

  return { year, members: membersArr, fixedExpenses: fixedMap, paymentBreakdown: paymentMap, monthly: monthlyTotals };
}

function _getCategoryOrder() {
  try {
    const order = getOptions('categoryOrder');
    if (Array.isArray(order) && order.length > 0) return order;
  } catch (e) {}
  return ['銀行類', '醫療類', '學校類', '保險類', '固定費用類', '交通類', '其他'];
}

/* ============================================
   🆕 v101.7.3：統計卡（改用 renderStatsCards）
   ============================================ */
function _renderStats() {
  if (!_annualData) return;

  const totalIncome = _annualData.monthly.income.reduce((s, x) => s + x, 0);
  const totalExpense = _annualData.monthly.expense.reduce((s, x) => s + x, 0);
  const balance = totalIncome - totalExpense;

  const cards = [
    {
      title: `${_currentYear} 年度總收入`,
      value: formatHKD(totalIncome),
      valueClass: 'emerald',
      hint: '所有成員收入加總',
      icon: 'trending-up',
    },
    {
      title: `${_currentYear} 年度總支出`,
      value: formatHKD(totalExpense),
      valueClass: 'red',
      hint: '含保險平攤',
      icon: 'trending-down',
    },
    {
      title: `${_currentYear} 年度淨結餘`,
      value: formatHKD(balance),
      valueClass: balance >= 0 ? 'emerald' : 'red',
      hint: '收入 − 支出',
      icon: 'wallet',
    },
  ];

  if (_statsApi) { try { _statsApi.destroy(); } catch (e) {} _statsApi = null; }

  _statsApi = renderStatsCards({
    container: 'annual-stats-root',
    cards,
    columns: 3,
  });
}

/* ============================================
   全年總合（依 view 切換）
   ============================================ */
function _renderSummary() {
  const view = _viewToggle?.getView() || 'table';
  const tableRoot = document.getElementById('summary-table-root');
  const cardRoot = document.getElementById('summary-card-root');

  if (view === 'card') {
    if (tableRoot) tableRoot.style.display = 'none';
    if (cardRoot) { cardRoot.style.display = 'block'; _renderSummaryCards(cardRoot); }
  } else {
    if (tableRoot) tableRoot.style.display = 'block';
    if (cardRoot) cardRoot.style.display = 'none';
    _renderSummaryTable();
  }

  _renderPaymentStatsCard();
}

/* ============================================
   全年總合 — 表格
   ============================================ */
function _renderSummaryTable() {
  const root = document.getElementById('summary-table-root');
  if (!root) return;

  if (_summaryTableApi) { try { _summaryTableApi.destroy(); } catch (e) {} _summaryTableApi = null; }

  const catOrder = _getCategoryOrder();

  const columns = [
    { id: 'name', label: '成員', defaultVisible: true, defaultWidth: 100 },
    { id: 'income', label: '總收入', defaultVisible: true, defaultWidth: 120 },
    { id: 'expense', label: '總支出', defaultVisible: true, defaultWidth: 120 },
    ...catOrder.map((c) => ({ id: `cat_${c}`, label: c, defaultVisible: true, defaultWidth: 110, type: 'number' })),
    { id: 'net', label: '淨結餘', defaultVisible: true, defaultWidth: 130 },
  ];

  const rows = [];
  _annualData.members.forEach((m) => {
    if (m.id === 'extra') return;
    const totalIncome = m.income.reduce((s, x) => s + x, 0);
    const catTotals = Object.fromEntries(catOrder.map((c) => [c, 0]));
    let totalExpense = 0;
    let unmatchedTotal = 0;

    Object.entries(m.expenses).forEach(([catId, catData]) => {
      const sum = catData.amounts.reduce((s, x) => s + x, 0);
      totalExpense += sum;
      const catName = catData.name || '（未分類）';
      if (catTotals[catName] != null) catTotals[catName] += sum;
      else unmatchedTotal += sum;
    });
    if (unmatchedTotal > 0 && catTotals['其他'] != null) catTotals['其他'] += unmatchedTotal;

    const row = {
      __key: m.id,
      name: m.name,
      income: totalIncome,
      expense: totalExpense,
      net: totalIncome - totalExpense,
    };
    catOrder.forEach((c) => { row[`cat_${c}`] = catTotals[c]; });
    rows.push(row);
  });

  // 家庭共用
  const sharedCatTotals = Object.fromEntries(catOrder.map((c) => [c, 0]));
  let sharedTotal = 0;
  Object.values(_annualData.fixedExpenses).forEach((catData) => {
    const catName = catData.catName || '其他';
    let catSum = 0;
    Object.values(catData.items).forEach((arr) => { catSum += arr.reduce((a, b) => a + b, 0); });
    sharedTotal += catSum;
    if (sharedCatTotals[catName] != null) sharedCatTotals[catName] += catSum;
    else if (sharedCatTotals['其他'] != null) sharedCatTotals['其他'] += catSum;
  });

  if (sharedTotal > 0) {
    const sharedRow = {
      __key: 'shared',
      name: '家庭共用',
      income: 0,
      expense: sharedTotal,
      net: -sharedTotal,
      __isShared: true,
    };
    catOrder.forEach((c) => { sharedRow[`cat_${c}`] = sharedCatTotals[c]; });
    rows.push(sharedRow);
  }

  // 額外收入
  const extraMember = _annualData.members.find((m) => m.id === 'extra');
  const extraIncome = extraMember ? extraMember.income.reduce((s, x) => s + x, 0) : 0;

  // 總計列
  const grandTotalIncome = rows.reduce((s, r) => s + r.income, 0);
  const grandTotalExpense = rows.reduce((s, r) => s + r.expense, 0);
  const grandCatTotals = Object.fromEntries(catOrder.map((c) => [c, 0]));
  rows.forEach((r) => catOrder.forEach((c) => { grandCatTotals[c] += r[`cat_${c}`] || 0; }));

  const totalRow = {
    __key: '__total__',
    name: '【總計】',
    income: grandTotalIncome + extraIncome,
    expense: grandTotalExpense,
    net: grandTotalIncome + extraIncome - grandTotalExpense,
    __isTotal: true,
  };
  catOrder.forEach((c) => { totalRow[`cat_${c}`] = grandCatTotals[c]; });

  _summaryTableApi = renderDataTable({
    container: root,
    entityKey: '__annual_summary__',
    rows: [...rows, totalRow],
    tableId: 'annual-summary-table',
    options: {
      columns,
      resolvers: {
        name: (_, row) => {
          if (row.__isTotal) return `<b style="color:var(--neon-cyan);">${escapeHtml(row.name)}</b>`;
          if (row.__isShared) return `<span class="text-magenta">${escapeHtml(row.name)}</span>`;
          return escapeHtml(row.name);
        },
        income: (val) => val > 0 ? `<span class="text-emerald">${formatHKD(val)}</span>` : '<span class="text-muted">—</span>',
        expense: (val) => val > 0 ? `<span class="text-red">${formatHKD(val)}</span>` : '<span class="text-muted">—</span>',
        net: (val) => `<span class="${val >= 0 ? 'text-emerald' : 'text-red'}">${formatHKD(val)}</span>`,
      },
      mobileCardMode: false,
      collapsible: true,
      defaultCollapsed: false,
      expandable: true,
      storageKey: 'annual-summary-table',
      renderDetail: (row) => _renderMemberDetail(row, catOrder),
    },
    hooks: { customActions: () => [] },
  });

  if (window.lucide) window.lucide.createIcons();
}

function _renderMemberDetail(row, catOrder) {
  if (row.__isTotal) {
    return `<div style="font-size:13px; color:var(--text-muted); padding:8px 0;">總計為所有成員加總，無展開內容。</div>`;
  }

  if (row.__isShared) {
    return `
      <div style="font-size:13px;">
        <div style="color:var(--text-muted); font-size:11px; margin-bottom:6px;">家庭共用支出（依類別）</div>
        <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:8px 16px;">
          ${catOrder.filter((c) => row[`cat_${c}`] > 0).map((c) => `
            <div style="display:flex; justify-content:space-between;">
              <span class="text-muted">${escapeHtml(c)}</span>
              <span class="mono text-magenta">${formatHKD(row[`cat_${c}`])}</span>
            </div>
          `).join('') || '<div class="text-muted">無資料</div>'}
        </div>
      </div>
    `;
  }

  return `
    <div style="font-size:13px;">
      <div style="color:var(--text-muted); font-size:11px; margin-bottom:6px;">${escapeHtml(row.name)} 年度類別明細</div>
      <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:8px 16px;">
        ${catOrder.filter((c) => row[`cat_${c}`] > 0).map((c) => `
          <div style="display:flex; justify-content:space-between;">
            <span class="text-muted">${escapeHtml(c)}</span>
            <span class="mono">${formatHKD(row[`cat_${c}`])}</span>
          </div>
        `).join('') || '<div class="text-muted">無類別支出</div>'}
      </div>
    </div>
  `;
}

/* ============================================
   全年總合 — 卡片
   ============================================ */
function _renderSummaryCards(container) {
  const catOrder = _getCategoryOrder();

  const memberCards = _annualData.members
    .filter((m) => m.id !== 'extra')
    .map((m) => {
      const totalIncome = m.income.reduce((s, x) => s + x, 0);
      let totalExpense = 0;
      const catTotals = Object.fromEntries(catOrder.map((c) => [c, 0]));
      Object.entries(m.expenses).forEach(([catId, catData]) => {
        const sum = catData.amounts.reduce((s, x) => s + x, 0);
        totalExpense += sum;
        const catName = catData.name || '（未分類）';
        if (catTotals[catName] != null) catTotals[catName] += sum;
        else if (catTotals['其他'] != null) catTotals['其他'] += sum;
      });
      const net = totalIncome - totalExpense;
      return `
        <div class="glass-card" style="padding:14px;">
          <div style="font-size:15px; font-weight:700; color:var(--neon-cyan); margin-bottom:8px;">${escapeHtml(m.name)}</div>
          <div style="display:flex; flex-direction:column; gap:4px; font-size:12px;">
            <div style="display:flex; justify-content:space-between;"><span class="text-muted">收入</span><span class="mono text-emerald">${formatHKD(totalIncome)}</span></div>
            <div style="display:flex; justify-content:space-between;"><span class="text-muted">支出</span><span class="mono text-red">${formatHKD(totalExpense)}</span></div>
            <div style="display:flex; justify-content:space-between; margin-top:6px; padding-top:6px; border-top:1px dashed rgba(255,255,255,0.08);">
              <span class="text-muted">淨結餘</span>
              <span class="mono ${net >= 0 ? 'text-emerald' : 'text-red'}" style="font-weight:700;">${formatHKD(net)}</span>
            </div>
          </div>
        </div>
      `;
    });

  let sharedHtml = '';
  const sharedTotals = Object.fromEntries(catOrder.map((c) => [c, 0]));
  let sharedTotal = 0;
  Object.values(_annualData.fixedExpenses).forEach((catData) => {
    const catName = catData.catName || '其他';
    let catSum = 0;
    Object.values(catData.items).forEach((arr) => { catSum += arr.reduce((a, b) => a + b, 0); });
    sharedTotal += catSum;
    if (sharedTotals[catName] != null) sharedTotals[catName] += catSum;
    else if (sharedTotals['其他'] != null) sharedTotals['其他'] += catSum;
  });

  if (sharedTotal > 0) {
    sharedHtml = `
      <div class="glass-card" style="padding:14px; border-color:rgba(217,70,239,0.4);">
        <div style="font-size:15px; font-weight:700; color:var(--neon-magenta); margin-bottom:8px;">家庭共用</div>
        <div style="display:flex; flex-direction:column; gap:4px; font-size:12px;">
          <div style="display:flex; justify-content:space-between;"><span class="text-muted">支出</span><span class="mono text-red">${formatHKD(sharedTotal)}</span></div>
          <div style="display:flex; justify-content:space-between; margin-top:6px; padding-top:6px; border-top:1px dashed rgba(255,255,255,0.08);">
            <span class="text-muted">淨額</span>
            <span class="mono text-magenta" style="font-weight:700;">-${formatHKD(sharedTotal)}</span>
          </div>
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <div style="padding:16px 20px 20px;">
      <div class="data-cards-grid">
        ${memberCards.join('')}
        ${sharedHtml}
      </div>
    </div>
  `;
}

/* ============================================
   支付方式統計卡
   ============================================ */
function _renderPaymentStatsCard() {
  const container = document.getElementById('payment-stats-card');
  const body = document.getElementById('payment-stats-body');
  if (!container || !body) return;

  const pb = _annualData.paymentBreakdown || {};
  const entries = Object.entries(pb).filter(([, arr]) => arr.some((v) => v > 0));

  if (entries.length === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  entries.sort((a, b) => {
    const sa = a[1].reduce((s, x) => s + x, 0);
    const sb = b[1].reduce((s, x) => s + x, 0);
    return sb - sa;
  });

  const grandTotal = entries.reduce((s, [, arr]) => s + arr.reduce((a, b) => a + b, 0), 0);

  body.innerHTML = `
    <div style="padding:16px 20px 20px;">
      <div class="data-cards-grid">
        ${entries.map(([pmName, arr]) => {
          const total = arr.reduce((s, x) => s + x, 0);
          return `
            <div class="glass-card" style="padding:14px;">
              <div style="font-size:13px; color:var(--text-muted); margin-bottom:6px;">${escapeHtml(pmName)}</div>
              <div class="mono text-emerald" style="font-size:18px; font-weight:700;">${formatHKD(total)}</div>
            </div>
          `;
        }).join('')}
      </div>
      <div style="margin-top:12px; padding:10px 14px; background:rgba(0,240,255,0.04); border-radius:var(--radius-md); display:flex; justify-content:space-between; font-size:13px;">
        <span class="text-muted">年度總支出</span>
        <span class="mono text-cyan" style="font-weight:700;">${formatHKD(grandTotal)}</span>
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   按月明細
   ============================================ */
function _renderMonthly() {
  const tbody = document.getElementById('monthly-tbody');
  if (!tbody) return;

  const monthIdx = Number(_currentDisplayMonth) - 1;
  const rows = [];
  const sumArr = (arr) => arr.reduce((s, x) => s + x, 0);

  const incomeRows = _annualData.members.filter((m) => m.income.some((v) => v > 0));
  if (incomeRows.length > 0) {
    rows.push(`<tr class="group-header"><td>【收入】</td><td class="num"></td><td class="num"></td></tr>`);
    incomeRows.forEach((m) => {
      const current = m.income[monthIdx] || 0;
      const annual = sumArr(m.income);
      rows.push(`<tr><td>${escapeHtml(m.name)}</td><td class="num text-emerald">${current ? formatNumber(current) : '—'}</td><td class="num text-emerald">${annual ? formatNumber(annual) : '—'}</td></tr>`);
    });
    const totalCurrent = _annualData.monthly.income[monthIdx] || 0;
    const totalAnnual = sumArr(_annualData.monthly.income);
    rows.push(`<tr class="subtotal-row"><td>收入小計</td><td class="num">${formatNumber(totalCurrent)}</td><td class="num">${formatNumber(totalAnnual)}</td></tr>`);
  }

  _annualData.members.forEach((m) => {
    if (m.id === 'extra') return;
    const catIds = Object.keys(m.expenses);
    if (catIds.length === 0) return;

    let currentMemberSum = 0;
    let annualMemberSum = 0;
    const byCat = {};
    catIds.forEach((catId) => {
      const catData = m.expenses[catId];
      const amounts = catData.amounts;
      currentMemberSum += amounts[monthIdx] || 0;
      annualMemberSum += sumArr(amounts);
      const catName = catData.name || '（未分類）';
      if (!byCat[catName]) byCat[catName] = [];
      byCat[catName].push({ catId, catData });
    });

    rows.push(`<tr class="group-header"><td>【${escapeHtml(m.name)}】</td><td class="num"></td><td class="num"></td></tr>`);

    const catOrder = _getCategoryOrder();
    const sortedCatNames = Object.keys(byCat).sort((a, b) => {
      const ia = catOrder.indexOf(a);
      const ib = catOrder.indexOf(b);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    });

    sortedCatNames.forEach((catName) => {
      const catTotal = { current: 0, annual: 0 };
      byCat[catName].forEach(({ catData }) => {
        catTotal.current += catData.amounts[monthIdx] || 0;
        catTotal.annual += sumArr(catData.amounts);
      });
      rows.push(`<tr><td style="padding-left:24px; color:var(--text-secondary); font-size:12px;">${escapeHtml(catName)}</td><td class="num">${catTotal.current ? formatNumber(catTotal.current) : '—'}</td><td class="num">${catTotal.annual ? formatNumber(catTotal.annual) : '—'}</td></tr>`);
    });

    rows.push(`<tr class="subtotal-row"><td>${escapeHtml(m.name)}小計</td><td class="num">${formatNumber(currentMemberSum)}</td><td class="num">${formatNumber(annualMemberSum)}</td></tr>`);
  });

  const allFixedItems = {};
  Object.values(_annualData.fixedExpenses).forEach((catData) => {
    Object.entries(catData.items).forEach(([name, arr]) => {
      if (!allFixedItems[name]) allFixedItems[name] = Array(12).fill(0);
      arr.forEach((v, i) => { allFixedItems[name][i] += v; });
    });
  });

  const fixedItemNames = Object.keys(allFixedItems).sort();
  if (fixedItemNames.length > 0) {
    rows.push(`<tr class="group-header"><td>【家庭共用支出】</td><td class="num"></td><td class="num"></td></tr>`);
    let sharedCurrentTotal = 0;
    let sharedAnnualTotal = 0;
    fixedItemNames.forEach((name) => {
      const amounts = allFixedItems[name];
      const current = amounts[monthIdx] || 0;
      const annual = sumArr(amounts);
      sharedCurrentTotal += current;
      sharedAnnualTotal += annual;
      rows.push(`<tr><td>${escapeHtml(name)}</td><td class="num">${current ? formatNumber(current) : '—'}</td><td class="num">${annual ? formatNumber(annual) : '—'}</td></tr>`);
    });
    rows.push(`<tr class="subtotal-row"><td>家庭共用支出小計</td><td class="num">${formatNumber(sharedCurrentTotal)}</td><td class="num">${formatNumber(sharedAnnualTotal)}</td></tr>`);
  }

  const expenseCurrent = _annualData.monthly.expense[monthIdx] || 0;
  const expenseAnnual = sumArr(_annualData.monthly.expense);
  const incomeCurrent = _annualData.monthly.income[monthIdx] || 0;
  const incomeAnnual = sumArr(_annualData.monthly.income);
  const netCurrent = incomeCurrent - expenseCurrent;
  const netAnnual = incomeAnnual - expenseAnnual;

  rows.push(`<tr class="group-header"><td>【月度總計】</td><td class="num"></td><td class="num"></td></tr>`);
  rows.push(`<tr class="total-row"><td>當月總支出</td><td class="num">${formatNumber(expenseCurrent)}</td><td class="num">${formatNumber(expenseAnnual)}</td></tr>`);
  rows.push(`<tr class="net-row"><td>當月淨結餘</td><td class="num" style="color:${netCurrent >= 0 ? 'var(--neon-emerald)' : 'var(--neon-red)'};">${formatNumber(netCurrent)}</td><td class="num" style="color:${netAnnual >= 0 ? 'var(--neon-emerald)' : 'var(--neon-red)'};">${formatNumber(netAnnual)}</td></tr>`);

  tbody.innerHTML = rows.join('');
  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   匯出 Excel
   ============================================ */
async function _exportToExcel() {
  if (!_annualData) { alert('資料尚未載入完成'); return; }

  if (typeof XLSX === 'undefined') {
    try {
      await _loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
    } catch (err) {
      alert('Excel 匯出工具載入失敗，請稍後再試');
      return;
    }
  }

  const data = _annualData;
  const rows = [];
  rows.push(['項目', '1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月', '年度小計']);

  const totalIncome = Math.round(data.monthly.income.reduce((s, x) => s + x, 0));
  const totalExpense = Math.round(data.monthly.expense.reduce((s, x) => s + x, 0));
  const balance = totalIncome - totalExpense;

  rows.push(['【收入】', '', '', '', '', '', '', '', '', '', '', '', '', '']);
  data.members.filter((m) => m.income.some((v) => v > 0)).forEach((m) => {
    const subtotal = Math.round(m.income.reduce((s, x) => s + x, 0));
    rows.push([`  ${m.name}`, ...m.income.map((v) => Math.round(v)), subtotal]);
  });
  rows.push(['收入小計', ...data.monthly.income.map((v) => Math.round(v)), totalIncome]);

  data.members.forEach((m) => {
    if (m.id === 'extra') return;
    const catIds = Object.keys(m.expenses);
    if (catIds.length === 0) return;
    rows.push([`【${m.name}】`, '', '', '', '', '', '', '', '', '', '', '', '', '']);
    const monthlyMemberTotal = Array(12).fill(0);
    Object.entries(m.expenses).forEach(([catId, catData]) => {
      const amounts = catData.amounts;
      amounts.forEach((v, i) => { monthlyMemberTotal[i] += v; });
      const subtotal = Math.round(amounts.reduce((s, x) => s + x, 0));
      rows.push([`  ${catData.name || '（未分類）'}`, ...amounts.map((v) => Math.round(v)), subtotal]);
    });
    const memberSubtotal = Math.round(monthlyMemberTotal.reduce((s, x) => s + x, 0));
    rows.push([`${m.name}小計`, ...monthlyMemberTotal.map((v) => Math.round(v)), memberSubtotal]);
  });

  const fixedCatIds = Object.keys(data.fixedExpenses);
  if (fixedCatIds.length > 0) {
    const monthlyFixedTotal = Array(12).fill(0);
    fixedCatIds.forEach((catId) => {
      const catData = data.fixedExpenses[catId];
      rows.push([`【家庭共用支出 - ${catData.catName}】`, '', '', '', '', '', '', '', '', '', '', '', '', '']);
      Object.entries(catData.items).forEach(([name, amounts]) => {
        amounts.forEach((v, i) => { monthlyFixedTotal[i] += v; });
        const subtotal = Math.round(amounts.reduce((s, x) => s + x, 0));
        rows.push([`  ${name}`, ...amounts.map((v) => Math.round(v)), subtotal]);
      });
    });
    const fixedSubtotal = Math.round(monthlyFixedTotal.reduce((s, x) => s + x, 0));
    rows.push(['固定支出小計', ...monthlyFixedTotal.map((v) => Math.round(v)), fixedSubtotal]);
  }

  const pbEntries = Object.entries(data.paymentBreakdown || {}).filter(([, arr]) => arr.some((v) => v > 0));
  if (pbEntries.length > 0) {
    rows.push(['【支付方式統計】', '', '', '', '', '', '', '', '', '', '', '', '', '']);
    let pmGrand = 0;
    pbEntries.forEach(([pmName, arr]) => {
      const total = Math.round(arr.reduce((s, x) => s + x, 0));
      pmGrand += total;
      rows.push([`  ${pmName}`, ...arr.map((v) => Math.round(v)), total]);
    });
    rows.push(['支付方式合計', '', '', '', '', '', '', '', '', '', '', '', '', pmGrand]);
  }

  rows.push(['【月度總計】', '', '', '', '', '', '', '', '', '', '', '', '', '']);
  rows.push(['當月總支出', ...data.monthly.expense.map((v) => Math.round(v)), totalExpense]);
  const netMonthly = data.monthly.income.map((v, i) => v - data.monthly.expense[i]);
  rows.push(['當月淨結餘', ...netMonthly.map((v) => Math.round(v)), balance]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 32 }, ...Array(12).fill({ wch: 12 }), { wch: 14 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `${data.year}年度報表`);

  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const filename = `家庭報表(${data.year})-${mm}${dd}${hh}${ss}.xlsx`;

  XLSX.writeFile(wb, filename);
}

function _loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

/* ============================================
   銷毀
   ============================================ */
function _destroy() {
  _cards.forEach((c) => { try { c?.destroy(); } catch (e) {} });
  _cards = [];

  if (_viewToggle) { try { _viewToggle.destroy(); } catch (e) {} _viewToggle = null; }
  if (_statsApi) { try { _statsApi.destroy(); } catch (e) {} _statsApi = null; }
  if (_summaryTableApi) { try { _summaryTableApi.destroy(); } catch (e) {} _summaryTableApi = null; }

  const yearEl = document.getElementById('year-switcher');
  if (yearEl && _yearSwitcherHandler) { yearEl.removeEventListener('click', _yearSwitcherHandler); _yearSwitcherHandler = null; }
  const monthEl = document.getElementById('month-switcher');
  if (monthEl && _monthSwitcherHandler) { monthEl.removeEventListener('click', _monthSwitcherHandler); _monthSwitcherHandler = null; }
}