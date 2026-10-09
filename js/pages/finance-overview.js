// ============================================
// finance-overview.js — 銀行交易（v102.0.0）
// 位置：js/pages/finance-overview.js
// ============================================
// v102.0.0 大改造：
//   ✅ 頁面改名為「銀行交易」
//   ✅ 統計卡 4 張：家庭總餘額 / 本月入帳 / 本月出帳 / 淨變動
//   ✅ 家庭總餘額支援摺疊展開各銀行獨立餘額
//   ✅ Tab 結構：銀行清單 / 交易記錄
//   ✅ 交易記錄支援篩選（type / category / member）
//   ✅ 手動新增交易（入帳 / 出帳）
//   ✅ 移除舊「收入明細」「銀行結餘明細」區塊
// ============================================

import { AppState } from '../core/state.js';
import {
  listenMembers,
  listenBankAccounts,
  listenAllBankTransactions,
  getBankAccountsOnce,
} from '../core/db.js';
import {
  escapeHtml, formatHKD, setText, sortMembers,
} from '../core/utils.js';
import { api } from '../core/api.js';
import {
  BANK_TXN_TYPES,
  BANK_TXN_CATEGORIES,
  BANK_TXN_TYPE_LABELS,
  BANK_TXN_CATEGORY_LABELS,
  BANK_TXN_CATEGORY_BADGES,
} from '../config/constants.js';
import {
  calcBankBalance,
  getBankTransactions,
} from '../shared/bank-helpers.js';
import { renderStatsCards } from '../shared/stats-cards.js';
import { renderDataTable } from '../shared/data-table.js';
import { showToast } from '../shared/toast.js';
import { openModal, closeModal, openConfirm } from '../shared/modal.js';
import { buildForm } from '../shared/form-builder.js';
import { createListenerGroup } from '../shared/listener-group.js';
import { registerPageCleanup } from '../core/app.js';

/* ============================================
   Module 狀態
   ============================================ */
let _bankAccounts = [];
let _transactions = [];
let _members = [];

let _statsApi = null;
let _balanceExpanded = false;
let _activeTab = 'banks';   // 'banks' | 'transactions'

let _txnFilters = {
  type: '',
  category: '',
  member: '',
};

let _statsCardsHandler = null;
let _tabClickHandler = null;
let _txnFilterHandler = null;
let _addTxnHandler = null;
let _quickAddHandler = null;

const listenerGroup = createListenerGroup();

/* ============================================
   主入口
   ============================================ */
export async function initFinanceOverviewPage() {
  _renderSkeleton();
  _bindEvents();

  listenerGroup.add(listenMembers((list) => {
    _members = sortMembers(list);
    _render();
  }));

  listenerGroup.add(listenBankAccounts((list) => {
    _bankAccounts = list || [];
    _render();
  }));

  listenerGroup.add(listenAllBankTransactions((list) => {
    _transactions = list || [];
    _render();
  }));

  listenerGroup.add(AppState.on('ym-change', () => _render()));

  registerPageCleanup(_destroy);

  return { destroy: _destroy };
}

/* ============================================
   骨架
   ============================================ */
function _renderSkeleton() {
  const root = document.getElementById('finance-overview-root');
  if (!root) return;

  const userCanInput = AppState.getCanInput();

  const addBtnHtml = userCanInput ? `
    <div class="flex items-center gap-8 flex-wrap">
      <button type="button" class="btn btn-primary" data-action="add-txn">
        <i data-lucide="plus"></i> 新增交易
      </button>
    </div>
  ` : '';

  root.innerHTML = `
    <div class="page-header flex flex-between items-end flex-wrap gap-12">
      <div>
        <h1 class="page-title">銀行交易</h1>
        <p class="page-subtitle" id="finance-month-label">載入中…</p>
      </div>
      <div class="flex items-center gap-12 flex-wrap">
        ${addBtnHtml}
      </div>
    </div>

    <div id="finance-stats-root"></div>

    <!-- Tab 切換 -->
    <div class="tab-bar tab-bar-wrap mb-16" id="finance-tabs">
      <button type="button" class="tab-btn active" data-tab="banks">
        <i data-lucide="landmark" style="width:14px;height:14px;"></i>
        <span>銀行清單</span>
      </button>
      <button type="button" class="tab-btn" data-tab="transactions">
        <i data-lucide="list" style="width:14px;height:14px;"></i>
        <span>交易記錄</span>
      </button>
    </div>

    <!-- 銀行清單 Tab -->
    <div id="finance-panel-banks" class="tab-panel active">
      <div id="finance-banks-root"></div>
    </div>

    <!-- 交易記錄 Tab -->
    <div id="finance-panel-transactions" class="tab-panel" style="display:none;">
      <div id="finance-txn-filter-root" class="mb-16"></div>
      <div id="finance-txn-root"></div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   事件綁定
   ============================================ */
function _bindEvents() {
  const root = document.getElementById('finance-overview-root');
  if (!root) return;

  // Tab 切換
  _tabClickHandler = (e) => {
    const btn = e.target.closest('button[data-tab]');
    if (!btn) return;
    _activeTab = btn.dataset.tab;
    _renderTabs();
    _renderContent();
  };
  document.getElementById('finance-tabs')?.addEventListener('click', _tabClickHandler);

  // 新增交易
  _addTxnHandler = () => _openAddTransactionModal();
  root.querySelector('[data-action="add-txn"]')?.addEventListener('click', _addTxnHandler);

  // 家庭總餘額卡片展開（事件委派）
  _statsCardsHandler = (e) => {
    const card = e.target.closest('[data-action="toggle-balance"]');
    if (card) {
      _balanceExpanded = !_balanceExpanded;
      _renderStats();
      return;
    }
    // 快速新增按鈕（展開後各銀行）
    const quickBtn = e.target.closest('button[data-quick-add]');
    if (quickBtn) {
      const bankId = quickBtn.dataset.quickAdd;
      const type = quickBtn.dataset.type;
      _openAddTransactionModal(bankId, type);
      return;
    }
  };
  document.getElementById('finance-stats-root')?.addEventListener('click', _statsCardsHandler);

  // 交易篩選
  _txnFilterHandler = (e) => {
    const sel = e.target.closest('select[data-filter]');
    if (!sel) return;
    _txnFilters[sel.dataset.filter] = sel.value;
    _renderContent();
  };
  document.getElementById('finance-txn-filter-root')?.addEventListener('change', _txnFilterHandler);
}

/* ============================================
   渲染 Tabs
   ============================================ */
function _renderTabs() {
  document.querySelectorAll('#finance-tabs .tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === _activeTab);
  });
  document.getElementById('finance-panel-banks').style.display = _activeTab === 'banks' ? 'block' : 'none';
  document.getElementById('finance-panel-transactions').style.display = _activeTab === 'transactions' ? 'block' : 'none';
}

/* ============================================
   主渲染
   ============================================ */
function _render() {
  const { year, month } = AppState.getYearMonth();
  setText('finance-month-label',
    month === 'all' ? `${year} 年（請選擇月份）` : `${year} 年 ${month} 月`);

  _renderStats();
  _renderContent();
}

function _renderContent() {
  if (_activeTab === 'banks') {
    _renderBanksList();
  } else {
    _renderTransactionsList();
  }
}

/* ============================================
   統計卡
   ============================================ */
function _renderStats() {
  const { year, month } = AppState.getYearMonth();
  const targetMonth = month === 'all' ? '12' : month;

  // 家庭總餘額
  let totalBalance = 0;
  _bankAccounts.forEach((acc) => {
    const txns = getBankTransactions(_transactions, acc.id);
    totalBalance += calcBankBalance(acc, txns, year, targetMonth);
  });

  // 本月交易
  const monthTxns = _transactions.filter((t) => (t.date || '').startsWith(`${year}-${String(targetMonth).padStart(2, '0')}`));
  const inTotal = monthTxns.filter((t) => t.type === BANK_TXN_TYPES.IN)
    .reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const outTotal = monthTxns.filter((t) => t.type === BANK_TXN_TYPES.OUT)
    .reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const transferTotal = monthTxns.filter((t) => t.type === BANK_TXN_TYPES.TRANSFER)
    .reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const netChange = inTotal - outTotal - transferTotal;

  // 展開後的銀行明細
  let bankDetailHtml = '';
  if (_balanceExpanded) {
    bankDetailHtml = `
      <div style="padding:12px 18px 16px; border-top:1px dashed rgba(255,255,255,0.08);">
        ${_bankAccounts.length === 0 ? '<div class="text-muted text-sm">尚無銀行帳號</div>' :
          _bankAccounts.map((acc) => {
            const txns = getBankTransactions(_transactions, acc.id);
            const bal = calcBankBalance(acc, txns, year, targetMonth);
            return `
              <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0;">
                <div style="display:flex; align-items:center; gap:8px; min-width:0;">
                  <span style="font-size:13px;">🏦 ${escapeHtml(acc.name)}</span>
                  <span class="badge ${acc.type === 'personal' ? 'badge-muted' : 'badge-info'}" style="font-size:10px;">
                    ${acc.type === 'personal' ? '個人' : '家庭'}
                  </span>
                </div>
                <span class="mono" style="font-size:13px; ${bal >= 0 ? 'color:var(--neon-emerald);' : 'color:var(--neon-red);'}">
                  ${formatHKD(bal)}
                </span>
              </div>
            `;
          }).join('')}
      </div>
    `;
  }

  const balanceCard = `
    <div class="stats-integrated-cell" style="grid-column: span 2; position:relative; cursor:pointer;" data-action="toggle-balance">
      <div class="stats-integrated-title" style="display:flex; justify-content:space-between; align-items:center;">
        <span>家庭總餘額</span>
        <i data-lucide="${_balanceExpanded ? 'chevron-up' : 'chevron-down'}" style="width:14px;height:14px;"></i>
      </div>
      <div class="stats-integrated-value mono ${totalBalance >= 0 ? 'emerald' : 'red'}">${formatHKD(totalBalance)}</div>
      <div class="stats-integrated-hint">共 ${_bankAccounts.length} 個銀行帳號${_balanceExpanded ? '' : '（點擊展開）'}</div>
      ${bankDetailHtml}
    </div>
  `;

  const cards = [
    {
      title: '本月入帳',
      value: formatHKD(inTotal),
      valueClass: 'emerald',
      hint: `${monthTxns.filter((t) => t.type === 'in').length} 筆`,
      icon: 'arrow-down-circle',
    },
    {
      title: '本月出帳',
      value: formatHKD(outTotal + transferTotal),
      valueClass: 'red',
      hint: `${monthTxns.filter((t) => t.type === 'out' || t.type === 'transfer').length} 筆`,
      icon: 'arrow-up-circle',
    },
    {
      title: '本月淨變動',
      value: formatHKD(netChange),
      valueClass: netChange >= 0 ? 'emerald' : 'red',
      hint: '入帳 − 出帳',
      icon: 'trending-up',
    },
  ];

  if (_statsApi) { try { _statsApi.destroy(); } catch (e) {} }

  _statsApi = renderStatsCards({
    container: 'finance-stats-root',
    cards,
    columns: 4,
    customFirstCell: balanceCard,
  });

  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   銀行清單 Tab
   ============================================ */
function _renderBanksList() {
  const root = document.getElementById('finance-banks-root');
  if (!root) return;

  if (_bankAccounts.length === 0) {
    root.innerHTML = `
      <div class="glass-card">
        <div class="empty-state">
          <i data-lucide="landmark" style="width:48px;height:48px;opacity:0.4;"></i>
          <p style="margin-top:12px;">尚未建立銀行帳號</p>
          <p style="margin-top:6px; font-size:12px; color:var(--text-muted);">請先至「系統設定 → 銀行帳號」新增</p>
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  const { year, month } = AppState.getYearMonth();
  const targetMonth = month === 'all' ? '12' : month;

  root.innerHTML = `
    <div class="data-cards-grid">
      ${_bankAccounts.map((acc) => _renderBankCard(acc, year, targetMonth)).join('')}
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
}

function _renderBankCard(acc, year, month) {
  const txns = getBankTransactions(_transactions, acc.id);
  const balance = calcBankBalance(acc, txns, year, month);

  // 本月交易
  const monthTxns = txns.filter((t) => (t.date || '').startsWith(`${year}-${String(month).padStart(2, '0')}`));
  const inTotal = monthTxns.filter((t) => t.type === 'in').reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const outTotal = monthTxns.filter((t) => t.type !== 'in').reduce((s, t) => s + (Number(t.amount) || 0), 0);

  const userCanInput = AppState.getCanInput();
  const actionsHtml = userCanInput ? `
    <div style="margin-top:12px; padding-top:12px; border-top:1px dashed rgba(255,255,255,0.08); display:flex; gap:8px; justify-content:flex-end;">
      <button type="button" class="btn btn-sm btn-ghost" data-action="add-in" data-bank="${escapeHtml(acc.id)}">
        <i data-lucide="plus" style="width:12px;height:12px;"></i> 入帳
      </button>
      <button type="button" class="btn btn-sm btn-ghost" data-action="add-out" data-bank="${escapeHtml(acc.id)}">
        <i data-lucide="plus" style="width:12px;height:12px;"></i> 出帳
      </button>
    </div>
  ` : '';

  return `
    <div class="glass-card" style="padding:16px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:12px;">
        <div style="flex:1; min-width:0;">
          <div style="font-size:15px; font-weight:700; color:var(--neon-cyan); word-break:break-word;">
            ${escapeHtml(acc.name)}
          </div>
          <div style="margin-top:4px;">
            <span class="badge ${acc.type === 'personal' ? 'badge-muted' : 'badge-info'}" style="font-size:10px;">
              ${acc.type === 'personal' ? '個人帳號' : '家庭帳號'}
            </span>
          </div>
        </div>
      </div>

      <div style="margin-bottom:12px;">
        <div class="text-muted" style="font-size:11px; margin-bottom:4px;">當前餘額</div>
        <div class="mono" style="font-size:22px; font-weight:700; ${balance >= 0 ? 'color:var(--neon-emerald);' : 'color:var(--neon-red);'}">
          ${formatHKD(balance)}
        </div>
      </div>

      <div style="display:flex; flex-direction:column; gap:4px; font-size:12px;">
        <div style="display:flex; justify-content:space-between;">
          <span class="text-muted">本月入帳</span>
          <span class="mono text-emerald">${formatHKD(inTotal)}</span>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span class="text-muted">本月出帳</span>
          <span class="mono text-red">${formatHKD(outTotal)}</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-top:4px; padding-top:4px; border-top:1px dashed rgba(255,255,255,0.06);">
          <span class="text-muted">初始餘額</span>
          <span class="mono" style="font-size:11px; color:var(--text-muted);">${formatHKD(acc.initialBalance)}</span>
        </div>
      </div>

      ${actionsHtml}
    </div>
  `;
}

/* ============================================
   交易記錄 Tab
   ============================================ */
function _renderTransactionsList() {
  _renderTxnFilters();
  _renderTxnTable();
}

function _renderTxnFilters() {
  const root = document.getElementById('finance-txn-filter-root');
  if (!root) return;

  const memberOptions = _members.map((m) => ({ value: m.id, label: m.name }));

  root.innerHTML = `
    <div class="page-filter-bar">
      <div class="filter-group">
        <label class="field-label">類型</label>
        <select class="select" data-filter="type">
          <option value="">全部</option>
          <option value="in" ${_txnFilters.type === 'in' ? 'selected' : ''}>入帳</option>
          <option value="out" ${_txnFilters.type === 'out' ? 'selected' : ''}>出帳</option>
          <option value="transfer" ${_txnFilters.type === 'transfer' ? 'selected' : ''}>內部轉帳</option>
        </select>
      </div>
      <div class="filter-group">
        <label class="field-label">分類</label>
        <select class="select" data-filter="category">
          <option value="">全部</option>
          ${Object.entries(BANK_TXN_CATEGORY_LABELS).map(([k, v]) =>
            `<option value="${k}" ${_txnFilters.category === k ? 'selected' : ''}>${v}</option>`
          ).join('')}
        </select>
      </div>
      <div class="filter-group">
        <label class="field-label">成員</label>
        <select class="select" data-filter="member">
          <option value="">全部</option>
          ${memberOptions.map((m) =>
            `<option value="${m.value}" ${_txnFilters.member === m.value ? 'selected' : ''}>${escapeHtml(m.label)}</option>`
          ).join('')}
        </select>
      </div>
    </div>
  `;
}

function _renderTxnTable() {
  const root = document.getElementById('finance-txn-root');
  if (!root) return;

  const { year, month } = AppState.getYearMonth();

  // 篩選
  let filtered = _transactions;
  if (month !== 'all') {
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    filtered = filtered.filter((t) => (t.date || '').startsWith(prefix));
  } else {
    filtered = filtered.filter((t) => (t.date || '').startsWith(year));
  }
  if (_txnFilters.type) filtered = filtered.filter((t) => t.type === _txnFilters.type);
  if (_txnFilters.category) filtered = filtered.filter((t) => t.category === _txnFilters.category);
  if (_txnFilters.member) filtered = filtered.filter((t) => t.memberId === _txnFilters.member);

  // 排序：新到舊
  filtered = [...filtered].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  if (filtered.length === 0) {
    root.innerHTML = `
      <div class="glass-card">
        <div class="empty-state">此條件下尚無交易記錄</div>
      </div>
    `;
    return;
  }

  const userCanInput = AppState.getCanInput();

  renderDataTable({
    container: root,
    entityKey: '__bank_transactions__',
    rows: filtered,
    tableId: 'finance-txn-table',
    options: {
      columns: [
        { id: 'date',     label: '日期',   defaultVisible: true, defaultWidth: 110 },
        { id: 'bankName', label: '銀行',   defaultVisible: true, defaultWidth: 100 },
        { id: 'typeLabel',label: '類型',   defaultVisible: true, defaultWidth: 90 },
        { id: 'catLabel', label: '分類',   defaultVisible: true, defaultWidth: 100 },
        { id: 'memberName', label: '成員', defaultVisible: true, defaultWidth: 100 },
        { id: 'amount',   label: '金額',   defaultVisible: true, defaultWidth: 120 },
        { id: 'note',     label: '備註',   defaultVisible: true, defaultWidth: 180 },
      ],
      resolvers: {
        date: (v) => `<span class="mono" style="font-size:12px;">${escapeHtml(v || '—')}</span>`,
        bankName: (_, row) => escapeHtml(row.bankName || '—'),
        typeLabel: (_, row) => {
          const cls = row.type === 'in' ? 'badge-success' : (row.type === 'transfer' ? 'badge-info' : 'badge-pending');
          return `<span class="badge ${cls}">${BANK_TXN_TYPE_LABELS[row.type] || row.type}</span>`;
        },
        catLabel: (_, row) => {
          const cls = BANK_TXN_CATEGORY_BADGES[row.category] || 'badge-muted';
          return `<span class="badge ${cls}">${BANK_TXN_CATEGORY_LABELS[row.category] || row.category}</span>`;
        },
        memberName: (_, row) => {
          const m = _members.find((x) => x.id === row.memberId);
          return escapeHtml(m ? m.name : (row.memberId || '—'));
        },
        amount: (v, row) => {
          const cls = row.type === 'in' ? 'text-emerald' : 'text-red';
          const sign = row.type === 'in' ? '+' : '-';
          return `<span class="mono ${cls}">${sign}${formatHKD(v)}</span>`;
        },
        note: (v) => escapeHtml(v || '—'),
      },
      mobileCardMode: false,
      collapsible: true,
      defaultCollapsed: false,
      expandable: true,
      storageKey: 'finance-txn-table',
      renderDetail: (row) => `
        <div style="font-size:13px; display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:8px 20px;">
          <div><div style="color:var(--text-muted); font-size:11px; margin-bottom:2px;">日期</div><div class="mono">${escapeHtml(row.date)}</div></div>
          <div><div style="color:var(--text-muted); font-size:11px; margin-bottom:2px;">銀行</div><div>${escapeHtml(row.bankName || '—')}</div></div>
          <div><div style="color:var(--text-muted); font-size:11px; margin-bottom:2px;">類型</div><div>${BANK_TXN_TYPE_LABELS[row.type] || row.type}</div></div>
          <div><div style="color:var(--text-muted); font-size:11px; margin-bottom:2px;">分類</div><div>${BANK_TXN_CATEGORY_LABELS[row.category] || row.category}</div></div>
          <div><div style="color:var(--text-muted); font-size:11px; margin-bottom:2px;">金額</div><div class="mono">${formatHKD(row.amount)}</div></div>
          ${row.note ? `<div style="grid-column:1/-1;"><div style="color:var(--text-muted); font-size:11px; margin-bottom:2px;">備註</div><div>${escapeHtml(row.note)}</div></div>` : ''}
        </div>
      `,
    },
    hooks: {
      customActions: userCanInput
        ? (row) => [
            { label: '編輯', icon: 'pencil', className: 'btn-ghost', action: 'edit-txn',
              onClick: (r) => _openEditTransactionModal(r) },
            { label: '刪除', icon: 'trash-2', className: 'btn-danger', action: 'delete-txn',
              onClick: (r) => _handleDeleteTransaction(r) },
          ]
        : () => [],
    },
  });

  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   新增 / 編輯交易 Modal
   ============================================ */
async function _openAddTransactionModal(defaultBankId, defaultType) {
  if (!AppState.getCanInput()) return;
  if (_bankAccounts.length === 0) {
    showToast('請先至「系統設定 → 銀行帳號」新增銀行', 'warning');
    return;
  }
  await _openTxnModal(null, defaultBankId, defaultType);
}

async function _openEditTransactionModal(txn) {
  if (!AppState.getCanInput()) return;
  await _openTxnModal(txn);
}

async function _openTxnModal(txn, defaultBankId, defaultType) {
  const isEdit = !!txn;
  const MODAL_ID = 'finance-txn-modal';
  document.getElementById(MODAL_ID)?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay active';
  overlay.id = MODAL_ID;
  overlay.innerHTML = `
    <div class="modal" style="max-width:520px; max-height:90vh; overflow-y:auto;">
      <h2 class="modal-title">${isEdit ? '編輯交易' : '新增交易'}</h2>
      <div id="${MODAL_ID}-form-root"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(MODAL_ID);
  });

  const bankOptions = _bankAccounts.map((a) => ({ value: a.id, label: a.name }));
  const memberOptions = _members.map((m) => ({ value: m.id, label: m.name }));

  const initialData = isEdit ? {
    bankId: txn.bankId,
    type: txn.type,
    category: txn.category,
    amount: txn.amount,
    date: txn.date,
    memberId: txn.memberId || '',
    note: txn.note || '',
  } : {
    bankId: defaultBankId || _bankAccounts[0]?.id || '',
    type: defaultType || 'in',
    category: 'manual',
    amount: 0,
    date: new Date().toISOString().slice(0, 10),
    memberId: '',
    note: '',
  };

  buildForm({
    containerId: `${MODAL_ID}-form-root`,
    fields: [
      {
        type: 'select', id: 'bankId', label: '銀行', required: true, includeEmpty: false,
        options: bankOptions,
        disabled: isEdit,   // 編輯時不允許換銀行
      },
      {
        type: 'select', id: 'type', label: '類型', required: true, includeEmpty: false,
        options: [
          { value: 'in', label: '入帳' },
          { value: 'out', label: '出帳' },
          { value: 'transfer', label: '內部轉帳' },
        ],
      },
      {
        type: 'select', id: 'category', label: '分類', required: true, includeEmpty: false,
        options: [
          { value: 'contribution', label: '家用轉入' },
          { value: 'expense', label: '支出' },
          { value: 'insurance', label: '保險' },
          { value: 'reimbursement', label: '代墊報銷' },
          { value: 'manual', label: '手動' },
        ],
      },
      {
        type: 'number', id: 'amount', label: '金額（HK$）', required: true, min: 0, step: 1,
      },
      {
        type: 'text', id: 'date', label: '日期', required: true, placeholder: 'YYYY-MM-DD', maxlength: 10,
      },
      {
        type: 'select', id: 'memberId', label: '成員（可選）', includeEmpty: true,
        emptyText: '— 不指定 —',
        options: memberOptions,
      },
      {
        type: 'text', id: 'note', label: '備註（可選）', maxlength: 60,
      },
    ],
    submitText: isEdit ? '儲存' : '新增',
    showCancel: true,
    cancelText: '取消',
    initialData,
    onSubmit: async (data) => {
      try {
        const payload = {
          type: data.type,
          category: data.category,
          amount: Number(data.amount) || 0,
          date: data.date,
          memberId: data.memberId || '',
          note: data.note || '',
        };
        if (isEdit) {
          await api.bankTransactions.update(txn.bankId, txn.id, payload);
          showToast('✅ 已更新交易', 'success');
        } else {
          await api.bankTransactions.create(data.bankId, payload);
          showToast('✅ 已新增交易', 'success');
        }
        closeModal(MODAL_ID);
      } catch (err) {
        showToast((isEdit ? '更新' : '新增') + '失敗：' + err.message, 'error');
      }
    },
    onCancel: () => closeModal(MODAL_ID),
  });

  openModal(MODAL_ID);
  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   刪除交易
   ============================================ */
async function _handleDeleteTransaction(txn) {
  if (!AppState.getCanInput()) return;

  const ok = await openConfirm(
    `確定要刪除此交易嗎？\n\n${txn.date} · ${txn.bankName} · ${BANK_TXN_TYPE_LABELS[txn.type]} ${formatHKD(txn.amount)}`,
    { title: '刪除交易', okText: '刪除', okClass: 'btn-danger' }
  );
  if (!ok) return;

  try {
    await api.bankTransactions.remove(txn.bankId, txn.id);
    showToast('✅ 已刪除交易', 'success');
  } catch (err) {
    showToast('刪除失敗：' + err.message, 'error');
  }
}

/* ============================================
   銷毀
   ============================================ */
function _destroy() {
  listenerGroup.destroy();
  if (_statsApi) { try { _statsApi.destroy(); } catch (e) {} _statsApi = null; }
  if (_statsCardsHandler) {
    document.getElementById('finance-stats-root')?.removeEventListener('click', _statsCardsHandler);
    _statsCardsHandler = null;
  }
  if (_tabClickHandler) {
    document.getElementById('finance-tabs')?.removeEventListener('click', _tabClickHandler);
    _tabClickHandler = null;
  }
  if (_txnFilterHandler) {
    document.getElementById('finance-txn-filter-root')?.removeEventListener('change', _txnFilterHandler);
    _txnFilterHandler = null;
  }
  if (_addTxnHandler) {
    document.getElementById('finance-overview-root')?.querySelector('[data-action="add-txn"]')?.removeEventListener('click', _addTxnHandler);
    _addTxnHandler = null;
  }
  _bankAccounts = [];
  _transactions = [];
  _members = [];
  _txnFilters = { type: '', category: '', member: '' };
}