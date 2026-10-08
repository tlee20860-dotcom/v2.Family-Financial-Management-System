// ============================================
// finance-overview.js — 財務總覽（v101.7.0）
// 位置：js/pages/finance-overview.js
// ============================================
// v101.7.0 新增：
//   ✅ 雙模式切換（卡片 / 表格）
//   ✅ 收入明細 + 銀行明細：可摺疊 + 每列展開
// ============================================

import { AppState } from '../core/state.js';
import {
  listenBanks, listenMembers,
  getIncomeOnce, getBankBalancesOnce,
  getAllMemberExpensesOnce, getPrevMonthBankTotal,
} from '../core/db.js';
import {
  escapeHtml, formatHKD, sortMembers, setText,
} from '../core/utils.js';
import { renderPageFilter } from '../shared/page-filter.js';
import { renderStatsCards } from '../shared/stats-cards.js';
import { renderDataTable } from '../shared/data-table.js';
import { initViewToggle } from '../shared/view-toggle.js';
import { createListenerGroup } from '../shared/listener-group.js';
import { RESERVED_IDS } from '../config/constants.js';
import { registerPageCleanup } from '../core/app.js';

let _members = [];
let _banks = [];
let _income = {};
let _balances = {};
let _expenses = [];
let _prevBankTotal = 0;

let _filterInstance = null;
let _viewToggle = null;
let _statsApi = null;
let _incomeTableApi = null;
let _bankTableApi = null;

const listenerGroup = createListenerGroup();

/* ============================================
   主入口
   ============================================ */
export async function initFinanceOverviewPage() {
  _viewToggle = initViewToggle({
    containerId: 'finance-view-toggle-root',
    storageKey: 'finance-view',
    defaultView: 'table',
    cardText: '卡片',
    tableText: '表格',
    autoApply: false,
    onChange: () => _render(),
  });

  _filterInstance = renderPageFilter({
    containerId: 'page-filter-root',
    fields: ['year', 'month'],
  });

  listenerGroup.add(AppState.on('ym-change', () => _reload()));

  listenerGroup.add(listenMembers((list) => {
    _members = sortMembers(list);
    _render();
  }));

  listenerGroup.add(listenBanks((list) => {
    _banks = list || [];
    _reload();
  }));

  await _reload();

  registerPageCleanup(_destroy);
  return { destroy: _destroy };
}

/* ============================================
   載入
   ============================================ */
async function _reload() {
  const { year, month } = AppState.getYearMonth();
  setText('finance-month-label',
    month === 'all' ? `${year} 年（請選擇月份）` : `${year} 年 ${month} 月`);

  if (month === 'all') {
    _income = {}; _balances = {}; _expenses = []; _prevBankTotal = 0;
    _render();
    return;
  }

  try {
    const [income, balances, expenses, prevBankTotal] = await Promise.all([
      getIncomeOnce(year, month),
      getBankBalancesOnce(year, month),
      getAllMemberExpensesOnce(year, month),
      getPrevMonthBankTotal(year, month),
    ]);
    _income = income || {};
    _balances = balances || {};
    _expenses = expenses || [];
    _prevBankTotal = Number(prevBankTotal) || 0;
  } catch (err) {
    console.error('[finance-overview] 載入失敗：', err);
    _income = {}; _balances = {}; _expenses = []; _prevBankTotal = 0;
  }
  _render();
}

/* ============================================
   渲染
   ============================================ */
function _render() {
  _renderStats();

  const view = _viewToggle?.getView() || 'table';

  // 收入區塊
  const incomeTableEl = document.getElementById('income-section-root');
  const incomeCardEl = document.getElementById('income-card-root');
  if (view === 'card') {
    if (incomeTableEl) incomeTableEl.style.display = 'none';
    if (incomeCardEl) { incomeCardEl.style.display = 'block'; _renderIncomeCards(incomeCardEl); }
  } else {
    if (incomeTableEl) incomeTableEl.style.display = 'block';
    if (incomeCardEl) incomeCardEl.style.display = 'none';
    _renderIncomeTable();
  }

  // 銀行區塊
  const bankTableEl = document.getElementById('bank-section-root');
  const bankCardEl = document.getElementById('bank-card-root');
  if (view === 'card') {
    if (bankTableEl) bankTableEl.style.display = 'none';
    if (bankCardEl) { bankCardEl.style.display = 'block'; _renderBankCards(bankCardEl); }
  } else {
    if (bankTableEl) bankTableEl.style.display = 'block';
    if (bankCardEl) bankCardEl.style.display = 'none';
    _renderBankTable();
  }

  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   統計卡
   ============================================ */
function _renderStats() {
  const totalIncome = Object.values(_income).reduce((s, v) => s + (Number(v) || 0), 0);
  const totalBank = Object.values(_balances).reduce((s, b) => s + (Number(b.amount) || 0), 0);
  const totalExpense = _expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const remaining = totalIncome + _prevBankTotal - totalExpense;

  const cards = [
    { title: '當月總收入', value: formatHKD(totalIncome), valueClass: 'emerald', hint: '所有成員收入加總', icon: 'trending-up' },
    { title: '上月銀行結餘', value: formatHKD(_prevBankTotal), valueClass: 'cyan', hint: '可動用的起始資金', icon: 'landmark' },
    { title: '當月總支出', value: formatHKD(totalExpense), valueClass: 'red', hint: `共 ${_expenses.length} 筆`, icon: 'trending-down' },
    { title: '動用資金', value: formatHKD(remaining), valueClass: remaining >= 0 ? 'magenta' : 'red', hint: '收入 + 上月結餘 − 支出', icon: 'wallet' },
  ];

  if (_statsApi) { try { _statsApi.destroy(); } catch (e) {} }
  _statsApi = renderStatsCards({ container: 'finance-stats-root', cards, columns: 4 });
}

/* ============================================
   收入表格
   ============================================ */
function _renderIncomeTable() {
  const root = document.getElementById('income-section-root');
  if (!root) return;

  if (_incomeTableApi) { try { _incomeTableApi.destroy(); } catch (e) {} _incomeTableApi = null; }

  const rows = [];
  _members.forEach((m) => rows.push({ id: m.id, name: m.name, amount: Number(_income[m.id]) || 0 }));
  const extra = Number(_income[RESERVED_IDS.EXTRA_INCOME]) || 0;
  if (extra > 0) rows.push({ id: RESERVED_IDS.EXTRA_INCOME, name: '額外收入', amount: extra });

  const visible = rows.filter((r) => r.amount > 0);

  if (visible.length === 0) {
    root.innerHTML = '<div class="empty-state" style="padding:20px;">此月份尚無收入紀錄</div>';
    return;
  }

  _incomeTableApi = renderDataTable({
    container: root,
    entityKey: '__income__',
    rows: visible,
    tableId: 'finance-income-table',
    options: {
      columns: [
        { id: 'name',   label: '成員', defaultVisible: true, defaultWidth: 200 },
        { id: 'amount', label: '金額（HK$）', defaultVisible: true, defaultWidth: 160 },
      ],
      resolvers: {
        name: (_, row) => escapeHtml(row.name),
        amount: (val) => `<span class="text-emerald">${formatHKD(val)}</span>`,
      },
      mobileCardMode: false,
      collapsible: true,
      defaultCollapsed: false,
      expandable: true,
      storageKey: 'finance-income-table',
      renderDetail: (row) => `
        <div style="font-size:13px;">
          <div style="color:var(--text-muted); font-size:11px; margin-bottom:4px;">成員</div>
          <div style="margin-bottom:8px;">${escapeHtml(row.name)}</div>
          <div style="color:var(--text-muted); font-size:11px; margin-bottom:4px;">當月收入</div>
          <div class="mono text-emerald" style="font-weight:700;">${formatHKD(row.amount)}</div>
        </div>
      `,
    },
    hooks: { customActions: () => [] },
  });

  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   收入卡片
   ============================================ */
function _renderIncomeCards(container) {
  const rows = [];
  _members.forEach((m) => rows.push({ id: m.id, name: m.name, amount: Number(_income[m.id]) || 0 }));
  const extra = Number(_income[RESERVED_IDS.EXTRA_INCOME]) || 0;
  if (extra > 0) rows.push({ id: RESERVED_IDS.EXTRA_INCOME, name: '額外收入', amount: extra });

  const visible = rows.filter((r) => r.amount > 0);

  if (visible.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:20px;">此月份尚無收入紀錄</div>';
    return;
  }

  container.innerHTML = `
    <div class="data-cards-grid">
      ${visible.map((r) => `
        <div class="glass-card" style="padding:14px;">
          <div style="font-size:13px; color:var(--text-muted); margin-bottom:6px;">${escapeHtml(r.name)}</div>
          <div class="mono text-emerald" style="font-size:18px; font-weight:700;">${formatHKD(r.amount)}</div>
        </div>
      `).join('')}
    </div>
  `;
}

/* ============================================
   銀行表格
   ============================================ */
function _renderBankTable() {
  const root = document.getElementById('bank-section-root');
  if (!root) return;

  if (_bankTableApi) { try { _bankTableApi.destroy(); } catch (e) {} _bankTableApi = null; }

  if (_banks.length === 0) {
    root.innerHTML = '<div class="empty-state" style="padding:20px;">尚未新增銀行</div>';
    return;
  }

  const rows = _banks.map((b) => {
    const bal = _balances[b.id] || {};
    return {
      id: b.id,
      name: b.name,
      amount: Number(bal.amount) || 0,
      updatedAt: bal.updatedAt || 0,
    };
  });

  _bankTableApi = renderDataTable({
    container: root,
    entityKey: '__bank_balances__',
    rows,
    tableId: 'finance-bank-table',
    options: {
      columns: [
        { id: 'name',   label: '銀行名稱', defaultVisible: true, defaultWidth: 200 },
        { id: 'amount', label: '結餘（HK$）', defaultVisible: true, defaultWidth: 160 },
      ],
      resolvers: {
        name: (_, row) => escapeHtml(row.name),
        amount: (val) => `<span class="text-emerald">${formatHKD(val)}</span>`,
      },
      mobileCardMode: false,
      collapsible: true,
      defaultCollapsed: false,
      expandable: true,
      storageKey: 'finance-bank-table',
      renderDetail: (row) => `
        <div style="font-size:13px; display:grid; grid-template-columns:repeat(auto-fill, minmax(160px,1fr)); gap:8px 20px;">
          <div><div style="color:var(--text-muted); font-size:11px; margin-bottom:2px;">銀行</div><div>${escapeHtml(row.name)}</div></div>
          <div><div style="color:var(--text-muted); font-size:11px; margin-bottom:2px;">結餘</div><div class="mono text-emerald">${formatHKD(row.amount)}</div></div>
          <div><div style="color:var(--text-muted); font-size:11px; margin-bottom:2px;">最後更新</div><div style="font-size:12px;">${row.updatedAt ? new Date(row.updatedAt).toLocaleString('zh-HK', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}</div></div>
        </div>
      `,
    },
    hooks: { customActions: () => [] },
  });

  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   銀行卡片
   ============================================ */
function _renderBankCards(container) {
  if (_banks.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:20px;">尚未新增銀行</div>';
    return;
  }

  container.innerHTML = `
    <div class="data-cards-grid">
      ${_banks.map((b) => {
        const bal = _balances[b.id] || {};
        const amount = Number(bal.amount) || 0;
        return `
          <div class="glass-card" style="padding:14px;">
            <div style="font-size:13px; color:var(--text-muted); margin-bottom:6px;">${escapeHtml(b.name)}</div>
            <div class="mono text-emerald" style="font-size:18px; font-weight:700;">${formatHKD(amount)}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/* ============================================
   銷毀
   ============================================ */
function _destroy() {
  listenerGroup.destroy();
  if (_filterInstance) { try { _filterInstance.destroy(); } catch (e) {} _filterInstance = null; }
  if (_viewToggle) { try { _viewToggle.destroy(); } catch (e) {} _viewToggle = null; }
  if (_statsApi) { try { _statsApi.destroy(); } catch (e) {} _statsApi = null; }
  if (_incomeTableApi) { try { _incomeTableApi.destroy(); } catch (e) {} _incomeTableApi = null; }
  if (_bankTableApi) { try { _bankTableApi.destroy(); } catch (e) {} _bankTableApi = null; }
  _members = []; _banks = []; _income = {}; _balances = {}; _expenses = []; _prevBankTotal = 0;
}