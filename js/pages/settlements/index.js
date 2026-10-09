// ============================================
// index.js — 結算清單入口（v102.0.0）
// 位置：js/pages/settlements/index.js
// ============================================
// v102.0.0 修正：
//   ✅ 支援支出編輯時的出帳銀行變更（含銀行交易同步）
//   ✅ 保險結算時彈出「選擇銀行」Modal
//   ✅ 保單 paymentMode='advance' 時，還款給代墊成員
//   ✅ 保留 v101.10.0 全部功能（聚合 API + 單次讀取）
// ============================================

import { AppState } from '../../core/state.js';
import {
  listenMembers,
  listenAllMemberExpenses,
  getAllMemberExpensesOnce,
  getCategoriesOnce,
  getItemsOnce,
  getPaymentMethodsOnce,
} from '../../core/db.js';
import {
  formatHKD, escapeHtml, setText,
} from '../../core/utils.js';
import { callApi } from '../../core/api.js';
import { renderPageFilter } from '../../shared/page-filter.js';
import { showToast } from '../../shared/toast.js';
import { renderStatsCards } from '../../shared/stats-cards.js';
import { renderDataTable } from '../../shared/data-table.js';
import { initViewToggle } from '../../shared/view-toggle.js';
import { createListenerGroup } from '../../shared/listener-group.js';
import { registerPageCleanup } from '../../core/app.js';
import { estimateMonthlyAmount } from '../../shared/insurance-calc.js';

import { mergeSettlementData } from './merge.js';
import {
  renderStatusCell,
  renderSourceBadge,
  getMemberName,
  updateRowStatus,
  setMembersCache,
  openSettlementEditModal,
  handleSettlementDelete,
} from './render.js';

/* ============================================
   Module 狀態
   ============================================ */
let _rows = [];
let _filtered = [];
let _filters = {
  year: '',
  month: '',
  source: '',
  status: '',
  member: '',
};
let _sortMode = 'pending-first';

let _categories = [];
let _items = [];
let _payments = [];

let _filterInstance = null;
let _viewToggle = null;
let _statsApi = null;
let _tableApi = null;
let _sortHandler = null;
let _statusChangeHandler = null;

let _monthlyUnsub = null;

const listenerGroup = createListenerGroup();

const TABLE_COLUMNS = [
  { id: 'source',   label: '來源',      defaultVisible: true,  defaultWidth: 90 },
  { id: 'yearMonth', label: '年月',      defaultVisible: true,  defaultWidth: 90 },
  { id: 'member',   label: '成員',      defaultVisible: true,  defaultWidth: 90 },
  { id: 'name',     label: '項目名稱',   defaultVisible: true,  defaultWidth: 200 },
  { id: 'amount',   label: '金額',      defaultVisible: true,  defaultWidth: 110 },
  { id: 'date',     label: '日期',      defaultVisible: true,  defaultWidth: 100 },
  { id: 'status',   label: '狀態',      defaultVisible: true,  defaultWidth: 140 },
];

/* ============================================
   從 AppState 同步年月至 _filters
   ============================================ */
function _syncYearMonthFromAppState() {
  const { year, month } = AppState.getYearMonth();
  _filters.year = year || '';
  _filters.month = month === 'all' ? '' : (month || '');
}

/* ============================================
   主入口
   ============================================ */
export async function initSettlementsPage() {
  _syncYearMonthFromAppState();

  _viewToggle = initViewToggle({
    containerId: 'settlement-view-toggle-root',
    storageKey: 'settlements-view',
    defaultView: 'table',
    cardText: '卡片',
    tableText: '表格',
    autoApply: false,
    onChange: () => _render(),
  });

  _filterInstance = renderPageFilter({
    containerId: 'page-filter-root',
    fields: [],
    renderExtra: () => `
      <div class="filter-group">
        <label class="field-label">來源</label>
        <select class="select" data-filter="source">
          <option value="">全部</option>
          <option value="personal">🏷 個人支出</option>
          <option value="insurance">🛡 保險扣款</option>
        </select>
      </div>
      <div class="filter-group">
        <label class="field-label">狀態</label>
        <select class="select" data-filter="status">
          <option value="">全部</option>
        </select>
      </div>
      <div class="filter-group">
        <label class="field-label">成員</label>
        <select class="select" data-filter="member">
          <option value="">全部</option>
        </select>
      </div>
    `,
    onChange: (f) => {
      _filters.source = f.source || '';
      _filters.status = f.status || '';
      _filters.member = f.member || '';
      _render();
    },
  });

  _sortHandler = (e) => {
    _sortMode = e.target.value;
    _render();
  };
  document.getElementById('settlement-sort')?.addEventListener('change', _sortHandler);

  listenerGroup.add(
    listenMembers((list) => {
      setMembersCache(list);
      _render();
    })
  );

  listenerGroup.add(AppState.on('ym-change', () => {
    _syncYearMonthFromAppState();
    _reload();
  }));

  _bindStatusChange();
  _loadOptionsCache();

  await _reload();

  registerPageCleanup(_destroy);

  return { destroy: _destroy };
}

/* ============================================
   載入選項快取
   ============================================ */
async function _loadOptionsCache() {
  try {
    const [cats, items, pays] = await Promise.all([
      getCategoriesOnce(),
      getItemsOnce(),
      getPaymentMethodsOnce(),
    ]);
    _categories = cats || [];
    _items = items || [];
    _payments = pays || [];
  } catch (e) {
    console.warn('[settlements] 載入選項失敗：', e);
  }
}

/* ============================================
   狀態變更事件委派
   ============================================ */
function _bindStatusChange() {
  const root = document.getElementById('settlement-table-root');
  if (!root) return;

  _statusChangeHandler = async (e) => {
    if (!AppState.getCanInput()) return;

    const sel = e.target.closest('.settlement-status-select');
    if (!sel) return;

    const key = sel.dataset.key;
    const newStatus = sel.value;
    const row = _rows.find((r) => r.key === key);
    if (!row) return;

    try {
      await updateRowStatus(row, newStatus);
      row.status = newStatus;
      row.isDone = newStatus.startsWith('已');
      showToast('✅ 狀態已更新', 'success');
      _render();
    } catch (err) {
      showToast('更新失敗：' + err.message, 'error');
      _render();
    }
  };

  root.addEventListener('change', _statusChangeHandler);
}

/* ============================================
   重新載入
   ============================================ */
async function _reload() {
  const { year, month } = AppState.getYearMonth();
  const isAnnual = month === 'all';

  setText('settlement-month',
    isAnnual ? `${year} 年 全年總覽` : `${year} 年 ${month} 月`);

  if (isAnnual) {
    await _loadAnnual(year);
  } else {
    await _loadMonthly(year, month);
  }
}

/* ============================================
   單月載入
   ============================================ */
async function _loadMonthly(year, month) {
  if (_monthlyUnsub) {
    try { _monthlyUnsub(); } catch (e) { /* noop */ }
    _monthlyUnsub = null;
  }

  _monthlyUnsub = listenAllMemberExpenses(year, month, async (memberExpenses) => {
    const insuranceRows = await _loadInsurancePaymentsForMonthOptimized(year, month);

    _rows = mergeSettlementData({
      memberExpenses,
      insuranceRows,
      year,
      month,
    });

    _render();
  });

  listenerGroup.add(_monthlyUnsub);
}

/* ============================================
   全年載入（聚合 API）
   ============================================ */
async function _loadAnnual(year) {
  if (_monthlyUnsub) {
    try { _monthlyUnsub(); } catch (e) { /* noop */ }
    _monthlyUnsub = null;
  }

  try {
    const result = await callApi(
      `/api/settlements-year?familyId=${AppState.getFamilyId()}&year=${year}`
    );

    if (!result || !result.memberExpensesByMonth) {
      throw new Error('聚合 API 回傳格式錯誤');
    }

    const { memberExpensesByMonth, policies, paymentsCache } = result;

    const allRows = [];
    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, '0');
      const monthExpenses = memberExpensesByMonth[mm] || [];
      const insuranceRows = _buildInsuranceRowsFromCache(
        policies || [],
        paymentsCache || {},
        year,
        mm
      );

      const rows = mergeSettlementData({
        memberExpenses: monthExpenses,
        insuranceRows,
        year,
        month: mm,
      });
      allRows.push(...rows);
    }

    _rows = allRows;
    _render();
  } catch (err) {
    console.error('[settlements] 全年聚合 API 失敗，改為逐月讀取：', err);
    await _loadAnnualFallback(year);
  }
}

async function _loadAnnualFallback(year) {
  const allRows = [];
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    try {
      const monthExpenses = await getAllMemberExpensesOnce(year, mm);
      const insuranceRows = await _loadInsurancePaymentsForMonthOptimized(year, mm);

      const rows = mergeSettlementData({
        memberExpenses: monthExpenses,
        insuranceRows,
        year,
        month: mm,
      });
      allRows.push(...rows);
    } catch (e) {
      console.warn(`[settlements] fallback 載入 ${year}-${mm} 失敗：`, e);
    }
  }
  _rows = allRows;
  _render();
}

/* ============================================
   單月保險扣款（單次讀取）
   ============================================ */
async function _loadInsurancePaymentsForMonthOptimized(year, month) {
  try {
    const { get } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js');
    const { familyRef } = await import('../../core/db.js');
    const snap = await get(familyRef('insurance_payments'));
    const allPayments = snap.val() || {};

    const policiesSnap = await get(familyRef('insurance_policies'));
    const policiesObj = policiesSnap.val() || {};
    const policies = Object.entries(policiesObj).map(([id, p]) => ({ id, ...p }));

    const rows = [];
    policies.forEach((p) => {
      const existing = allPayments?.[p.id]?.[year]?.[month];

      if (existing) {
        rows.push(_buildInsuranceRow(p, existing, year, month));
      } else {
        const estimated = estimateMonthlyAmount(p, year, month);
        if (estimated > 0 || p.type === 'fund_insurance') {
          rows.push(_buildInsuranceRow(p, { status: '未扣款', amount: estimated, date: '' }, year, month));
        }
      }
    });

    return rows;
  } catch (e) {
    console.warn('[settlements] 載入保單扣款失敗：', e);
    return [];
  }
}

function _buildInsuranceRowsFromCache(policies, paymentsCache, year, month) {
  const rows = [];

  policies.forEach((p) => {
    const existing = paymentsCache?.[p.id]?.[year]?.[month];

    if (existing) {
      rows.push(_buildInsuranceRow(p, existing, year, month));
    } else {
      const estimated = estimateMonthlyAmount(p, year, month);
      if (estimated > 0 || p.type === 'fund_insurance') {
        rows.push(_buildInsuranceRow(p, { status: '未扣款', amount: estimated, date: '' }, year, month));
      }
    }
  });

  return rows;
}

function _buildInsuranceRow(policy, payment, year, month) {
  return {
    policyId: policy.id,
    policyName: policy.name,
    memberId: policy.memberId,
    policyHolderId: policy.policyHolderId || policy.memberId,
    type: policy.type,
    paymentMode: policy.paymentMode || 'direct',              // 🆕 v102.0.0
    advanceHolderId: policy.advanceHolderId || '',            // 🆕 v102.0.0
    status: payment.status || '已扣款',
    amount: Number(payment.amount) || 0,
    date: payment.date || '',
    bankId: payment.bankId || '',                             // 🆕 v102.0.0
    txnId: payment.txnId || '',                               // 🆕 v102.0.0
  };
}

/* ============================================
   渲染
   ============================================ */
function _render() {
  _filtered = _applyFilters(_rows);
  _filtered = _applySort(_filtered);

  _renderStats();

  const view = _viewToggle?.getView() || 'table';
  const tableRoot = document.getElementById('settlement-table-root');
  const cardRoot = document.getElementById('settlement-card-root');

  if (!tableRoot) return;

  if (view === 'card') {
    tableRoot.style.display = 'none';
    if (cardRoot) {
      cardRoot.style.display = 'block';
      _renderCards(cardRoot);
    }
  } else {
    tableRoot.style.display = 'block';
    if (cardRoot) cardRoot.style.display = 'none';
    _renderTable();
  }
}

/* ============================================
   統計卡
   ============================================ */
function _renderStats() {
  const pending = _filtered.filter((r) => !r.isDone);
  const done = _filtered.filter((r) => r.isDone);

  const pendingTotal = pending.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const doneTotal = done.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const total = pendingTotal + doneTotal;

  const cards = [
    { title: '待處理', value: formatHKD(pendingTotal), valueClass: 'magenta', hint: `${pending.length} 筆`, icon: 'clock' },
    { title: '已處理', value: formatHKD(doneTotal), valueClass: 'emerald', hint: `${done.length} 筆`, icon: 'check-circle' },
    { title: '總計', value: formatHKD(total), valueClass: 'cyan', hint: `${_filtered.length} 筆`, icon: 'calculator' },
  ];

  if (_statsApi) { try { _statsApi.destroy(); } catch (e) {} }
  _statsApi = renderStatsCards({
    container: 'settlement-stats-root',
    cards,
    columns: 3,
  });
}

/* ============================================
   表格
   ============================================ */
function _renderTable() {
  const root = document.getElementById('settlement-table-root');
  if (!root) return;

  if (_tableApi) { try { _tableApi.destroy(); } catch (e) {} _tableApi = null; }

  const userCanInput = AppState.getCanInput();

  const actionFactory = userCanInput
    ? (row) => [
        {
          label: '編輯',
          icon: 'pencil',
          className: 'btn-ghost',
          action: 'edit-settlement',
          onClick: (r) => openSettlementEditModal(r, _reload),
        },
        {
          label: row.source === 'insurance' ? '取消扣款' : '刪除',
          icon: 'trash-2',
          className: 'btn-danger',
          action: 'delete-settlement',
          onClick: (r) => handleSettlementDelete(r, _reload),
        },
      ]
    : () => [];

  _tableApi = renderDataTable({
    container: root,
    entityKey: '__settlement__',
    rows: _filtered,
    tableId: 'settlement-table',
    options: {
      columns: TABLE_COLUMNS,
      resolvers: {
        source: (_, row) => renderSourceBadge(row),
        yearMonth: (_, row) => `${escapeHtml(row.year)}-${escapeHtml(row.month)}`,
        member: (_, row) => escapeHtml(getMemberName(row)),
        name: (_, row) => escapeHtml(row.name),
        amount: (val) => formatHKD(val),
        date: (val) => escapeHtml(val || '—'),
      },
      mobileCardMode: false,
      collapsible: true,
      defaultCollapsed: false,
      expandable: true,
      storageKey: 'settlement-table',
      renderDetail: (row) => _renderRowDetail(row),
    },
    hooks: {
      customCellRender: (col, row) => {
        if (col.id === 'status') {
          if (!userCanInput) {
            return _renderStatusBadge(row);
          }
          return renderStatusCell(row);
        }
        return null;
      },
      customActions: actionFactory,
    },
  });

  if (window.lucide) window.lucide.createIcons();
}

function _renderStatusBadge(row) {
  const cls = row.isDone ? 'badge-success' : 'badge-pending';
  const status = row.status || '未處理';
  return `<span class="badge ${cls}">${escapeHtml(status)}</span>`;
}

function _renderRowDetail(row) {
  const cat = row.categoryId ? _categories.find((c) => c.id === row.categoryId) : null;
  const item = row.itemId ? _items.find((i) => i.id === row.itemId) : null;
  const pay = row.paymentMethodId ? _payments.find((p) => p.id === row.paymentMethodId) : null;

  const fields = [
    { label: '來源', value: row.sourceLabel },
    { label: '成員', value: getMemberName(row) },
    { label: '年月', value: `${row.year}-${row.month}` },
    { label: '項目名稱', value: row.name },
    { label: '金額', value: formatHKD(row.amount) },
    { label: '日期', value: row.date || '—' },
    { label: '狀態', value: row.status },
  ];

  if (cat) fields.push({ label: '類別', value: cat.name });
  if (item) fields.push({ label: '項目', value: item.name });
  if (pay) fields.push({ label: '支付方式', value: pay.name });
  if (row.isAutoLinked) fields.push({ label: '類型', value: '保險自動產生' });

  return `
    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); gap:8px 20px; font-size:13px;">
      ${fields.map((f) => `
        <div>
          <div style="font-size:11px; color:var(--text-muted); margin-bottom:2px;">${escapeHtml(f.label)}</div>
          <div style="color:var(--text-primary);">${escapeHtml(String(f.value))}</div>
        </div>
      `).join('')}
    </div>
  `;
}

/* ============================================
   卡片模式
   ============================================ */
function _renderCards(container) {
  if (!_filtered.length) {
    container.innerHTML = `<div class="glass-card"><div class="empty-state">尚無資料</div></div>`;
    return;
  }

  container.innerHTML = `
    <div class="data-cards-grid">
      ${_filtered.map((row) => _renderCard(row)).join('')}
    </div>
  `;

  _bindCardEvents();

  if (window.lucide) window.lucide.createIcons();
}

function _renderCard(row) {
  const cat = row.categoryId ? _categories.find((c) => c.id === row.categoryId) : null;
  const item = row.itemId ? _items.find((i) => i.id === row.itemId) : null;
  const pay = row.paymentMethodId ? _payments.find((p) => p.id === row.paymentMethodId) : null;

  const sourceBadge = renderSourceBadge(row);
  const statusBadge = row.isDone
    ? `<span class="badge badge-success">${escapeHtml(row.status)}</span>`
    : `<span class="badge badge-pending">${escapeHtml(row.status)}</span>`;

  const userCanInput = AppState.getCanInput();
  const actionsHtml = userCanInput ? `
    <div class="data-card-footer" style="margin-top:12px; padding-top:12px; border-top:1px dashed rgba(255,255,255,0.08); display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap;">
      <button type="button" class="btn btn-sm btn-ghost" data-action="edit-settlement" data-key="${escapeHtml(row.key)}">
        <i data-lucide="pencil" style="width:14px;height:14px;"></i> 編輯
      </button>
      <button type="button" class="btn btn-sm btn-danger" data-action="delete-settlement" data-key="${escapeHtml(row.key)}">
        <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
        ${row.source === 'insurance' ? '取消扣款' : '刪除'}
      </button>
    </div>
  ` : '';

  return `
    <div class="glass-card settlement-card" data-key="${escapeHtml(row.key)}">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:10px;">
        <div style="flex:1; min-width:0;">
          <div style="font-size:15px; font-weight:700; color:var(--neon-cyan); word-break:break-word; margin-bottom:4px;">
            ${escapeHtml(row.name || '（未命名）')}
          </div>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            ${sourceBadge}
            ${statusBadge}
          </div>
        </div>
        <div class="mono" style="font-size:16px; font-weight:700; color:${row.source === 'insurance' ? 'var(--neon-magenta)' : 'var(--neon-red)'}; white-space:nowrap;">
          ${formatHKD(row.amount)}
        </div>
      </div>

      <div class="data-card-fields" style="display:flex; flex-direction:column; gap:6px; font-size:13px;">
        <div class="data-card-field" style="display:flex; justify-content:space-between; gap:12px;">
          <span class="data-card-label" style="color:var(--text-muted); font-size:11px; flex-shrink:0;">年月</span>
          <span class="data-card-value">${escapeHtml(row.year)}-${escapeHtml(row.month)}</span>
        </div>
        <div class="data-card-field" style="display:flex; justify-content:space-between; gap:12px;">
          <span class="data-card-label" style="color:var(--text-muted); font-size:11px; flex-shrink:0;">成員</span>
          <span class="data-card-value">${escapeHtml(getMemberName(row))}</span>
        </div>
        ${row.date ? `
          <div class="data-card-field" style="display:flex; justify-content:space-between; gap:12px;">
            <span class="data-card-label" style="color:var(--text-muted); font-size:11px; flex-shrink:0;">日期</span>
            <span class="data-card-value mono" style="font-size:12px;">${escapeHtml(row.date)}</span>
          </div>
        ` : ''}
        ${cat ? `
          <div class="data-card-field" style="display:flex; justify-content:space-between; gap:12px;">
            <span class="data-card-label" style="color:var(--text-muted); font-size:11px; flex-shrink:0;">類別</span>
            <span class="data-card-value">${escapeHtml(cat.name)}</span>
          </div>
        ` : ''}
        ${item ? `
          <div class="data-card-field" style="display:flex; justify-content:space-between; gap:12px;">
            <span class="data-card-label" style="color:var(--text-muted); font-size:11px; flex-shrink:0;">項目</span>
            <span class="data-card-value">${escapeHtml(item.name)}</span>
          </div>
        ` : ''}
        ${pay ? `
          <div class="data-card-field" style="display:flex; justify-content:space-between; gap:12px;">
            <span class="data-card-label" style="color:var(--text-muted); font-size:11px; flex-shrink:0;">支付方式</span>
            <span class="data-card-value">${escapeHtml(pay.name)}</span>
          </div>
        ` : ''}
      </div>

      ${actionsHtml}
    </div>
  `;
}

let _cardClickHandler = null;

function _bindCardEvents() {
  const cardRoot = document.getElementById('settlement-card-root');
  if (!cardRoot) return;

  if (_cardClickHandler) {
    cardRoot.removeEventListener('click', _cardClickHandler);
  }

  _cardClickHandler = async (e) => {
    if (!AppState.getCanInput()) return;

    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const key = btn.dataset.key;
    const row = _filtered.find((r) => r.key === key);
    if (!row) return;

    if (action === 'edit-settlement') {
      openSettlementEditModal(row, _reload);
    } else if (action === 'delete-settlement') {
      handleSettlementDelete(row, _reload);
    }
  };

  cardRoot.addEventListener('click', _cardClickHandler);
}

/* ============================================
   篩選 / 排序
   ============================================ */
function _applyFilters(list) {
  return list.filter((r) => {
    if (_filters.year && r.year !== _filters.year) return false;
    if (_filters.month && r.month !== _filters.month) return false;
    if (_filters.source && r.source !== _filters.source) return false;
    if (_filters.status && r.status !== _filters.status) return false;
    if (_filters.member && r.memberId !== _filters.member) return false;
    return true;
  });
}

function _applySort(list) {
  const arr = [...list];

  switch (_sortMode) {
    case 'date-desc':
      arr.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      break;
    case 'date-asc':
      arr.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      break;
    case 'amount-desc':
      arr.sort((a, b) => b.amount - a.amount);
      break;
    case 'pending-first':
    default:
      arr.sort((a, b) => {
        if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;
        return (b.date || '').localeCompare(a.date || '');
      });
  }

  return arr;
}

/* ============================================
   銷毀
   ============================================ */
function _destroy() {
  listenerGroup.destroy();

  if (_monthlyUnsub) {
    try { _monthlyUnsub(); } catch (e) {}
    _monthlyUnsub = null;
  }

  if (_filterInstance) { try { _filterInstance.destroy(); } catch (e) {} _filterInstance = null; }
  if (_viewToggle) { try { _viewToggle.destroy(); } catch (e) {} _viewToggle = null; }
  if (_statsApi) { try { _statsApi.destroy(); } catch (e) {} _statsApi = null; }
  if (_tableApi) { try { _tableApi.destroy(); } catch (e) {} _tableApi = null; }

  if (_sortHandler) {
    document.getElementById('settlement-sort')?.removeEventListener('change', _sortHandler);
    _sortHandler = null;
  }
  if (_statusChangeHandler) {
    document.getElementById('settlement-table-root')?.removeEventListener('change', _statusChangeHandler);
    _statusChangeHandler = null;
  }
  if (_cardClickHandler) {
    document.getElementById('settlement-card-root')?.removeEventListener('click', _cardClickHandler);
    _cardClickHandler = null;
  }

  _rows = [];
  _filtered = [];
  _categories = [];
  _items = [];
  _payments = [];
}