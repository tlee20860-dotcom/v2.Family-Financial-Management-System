// ============================================
// recent-list.js — 輸入中心：最近 20 筆（v101.8.0）
// 位置：js/pages/input-center/recent-list.js
// ============================================
// v101.8.0 修正：
//   ✅ 依 AppState.canInput 隱藏編輯 / 刪除按鈕
//   ✅ 唯讀模式下卡片 footer 不顯示
//   ✅ 保留 v101.7.1 成員顯示修正
// ============================================

import {
  listenAllExpenses, listenAllIncome,
  updateExpense, removeExpense,
  updateIncomeEntry, getIncomeOnce,
  getMembersOnce,
} from '../../core/db.js';
import { escapeHtml, formatHKD, setText } from '../../core/utils.js';
import { getStatusesByCategory } from '../../config/app-config.js';
import { RESERVED_IDS, LIMITS } from '../../config/constants.js';
import { AppState } from '../../core/state.js';
import { showToast } from '../../shared/toast.js';
import { openModal, closeModal, openConfirm } from '../../shared/modal.js';
import { buildForm } from '../../shared/form-builder.js';
import { createListenerGroup } from '../../shared/listener-group.js';
import { renderDataTable } from '../../shared/data-table.js';
import { initViewToggle } from '../../shared/view-toggle.js';

let _expenses = [];
let _incomes = [];
let _members = [];
let _membersMap = {};

let _viewToggle = null;
let _tableApi = null;
let _tableRoot = null;

export function initRecentList(containerId, options = {}) {
  const root = document.getElementById(containerId);
  if (!root) {
    console.warn(`⚠️ initRecentList: 找不到容器 #${containerId}`);
    return null;
  }

  const listenerGroup = createListenerGroup();
  _tableRoot = root;

  root.innerHTML = `
    <div class="flex flex-between items-center flex-wrap gap-12 mb-12">
      <div id="${containerId}-view-toggle"></div>
    </div>
    <div id="${containerId}-content"></div>
  `;

  _viewToggle = initViewToggle({
    containerId: `${containerId}-view-toggle`,
    storageKey: 'recent-list-view',
    defaultView: 'table',
    cardText: '卡片',
    tableText: '表格',
    autoApply: false,
    onChange: () => _renderContent(containerId),
  });

  _loadMembers().then(() => _renderContent(containerId));

  listenerGroup.add(listenAllExpenses((list) => {
    _expenses = list || [];
    _renderContent(containerId);
  }));

  listenerGroup.add(listenAllIncome((list) => {
    _incomes = list || [];
    _renderContent(containerId);
  }));

  return {
    refresh: () => _renderContent(containerId),
    destroy: () => {
      listenerGroup.destroy();
      if (_viewToggle) { try { _viewToggle.destroy(); } catch (e) {} _viewToggle = null; }
      if (_tableApi) { try { _tableApi.destroy(); } catch (e) {} _tableApi = null; }
      root.innerHTML = '';
      _tableRoot = null;
    },
  };
}

async function _loadMembers() {
  try {
    const members = await getMembersOnce();
    _members = members || [];
    _membersMap = {};
    _members.forEach((m) => { _membersMap[m.id] = m.name; });
  } catch (e) {
    console.warn('[recent-list] 載入成員失敗：', e);
  }
}

/* ============================================
   渲染內容
   ============================================ */
function _renderContent(containerId) {
  const contentEl = document.getElementById(`${containerId}-content`);
  if (!contentEl) return;

  if (_tableApi) { try { _tableApi.destroy(); } catch (e) {} _tableApi = null; }

  const items = _mergeItems();
  items.sort((a, b) => b._ts - a._ts);
  const limited = items.slice(0, LIMITS.RECENT_LIST_LIMIT);

  if (limited.length === 0) {
    contentEl.innerHTML = '<div class="glass-card"><div class="empty-state">尚無新增資料</div></div>';
    return;
  }

  const view = _viewToggle?.getView() || 'table';

  if (view === 'card') {
    _renderCards(contentEl, limited, items.length);
  } else {
    _renderTable(contentEl, limited, items.length);
  }
}

/* ============================================
   表格模式
   ============================================ */
function _renderTable(contentEl, limited, totalCount) {
  contentEl.innerHTML = `
    <div class="text-muted" style="font-size:12px; margin-bottom:10px;">
      共 ${totalCount} 筆，顯示最近 ${limited.length} 筆
    </div>
    <div id="recent-list-table-root"></div>
  `;

  // 🆕 v101.8.0：依 canInput 決定是否提供編輯 / 刪除
  const userCanInput = AppState.getCanInput();

  _tableApi = renderDataTable({
    container: 'recent-list-table-root',
    entityKey: '__recent__',
    rows: limited,
    tableId: 'recent-list-table',
    options: {
      columns: [
        { id: 'typeLabel', label: '類型', defaultVisible: true, defaultWidth: 90 },
        { id: 'ym',        label: '年月', defaultVisible: true, defaultWidth: 100 },
        { id: 'member',    label: '成員', defaultVisible: true, defaultWidth: 100 },
        { id: 'name',      label: '項目', defaultVisible: true, defaultWidth: 200 },
        { id: 'amount',    label: '金額', defaultVisible: true, defaultWidth: 120 },
        { id: 'date',      label: '日期', defaultVisible: true, defaultWidth: 110 },
      ],
      resolvers: {
        typeLabel: (_, row) => `<span class="badge ${row.typeBadge}">${row.typeLabel}</span>`,
        ym: (_, row) => `<span class="mono" style="font-size:12px;">${escapeHtml(row.year)}-${escapeHtml(row.month)}</span>`,
        member: (_, row) => `<span style="font-size:12px;">${escapeHtml(_memberName(row.memberId))}</span>`,
        name: (_, row) => escapeHtml(row.name),
        amount: (val, row) => `<span class="text-${row.type === 'income' ? 'emerald' : 'red'}">${formatHKD(val)}</span>`,
        date: (val) => `<span class="mono" style="font-size:11px; color:var(--text-muted);">${escapeHtml(val || '—')}</span>`,
      },
      mobileCardMode: false,
      collapsible: true,
      defaultCollapsed: false,
      expandable: true,
      storageKey: 'recent-list-table',
      renderDetail: (row) => `
        <div style="font-size:13px; display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:8px 20px;">
          <div><div style="color:var(--text-muted); font-size:11px; margin-bottom:2px;">類型</div><div>${escapeHtml(row.typeLabel)}</div></div>
          <div><div style="color:var(--text-muted); font-size:11px; margin-bottom:2px;">年月</div><div class="mono">${escapeHtml(row.year)}-${escapeHtml(row.month)}</div></div>
          <div><div style="color:var(--text-muted); font-size:11px; margin-bottom:2px;">成員</div><div>${escapeHtml(_memberName(row.memberId))}</div></div>
          <div><div style="color:var(--text-muted); font-size:11px; margin-bottom:2px;">項目</div><div>${escapeHtml(row.name)}</div></div>
          <div><div style="color:var(--text-muted); font-size:11px; margin-bottom:2px;">金額</div><div class="mono text-${row.type === 'income' ? 'emerald' : 'red'}">${formatHKD(row.amount)}</div></div>
          <div><div style="color:var(--text-muted); font-size:11px; margin-bottom:2px;">日期</div><div>${escapeHtml(row.date || '—')}</div></div>
        </div>
      `,
    },
    hooks: {
      // 🆕 v101.8.0：依 canInput 決定是否提供操作按鈕
      customActions: userCanInput
        ? (row) => [
            { label: '編輯', icon: 'pencil', className: 'btn-ghost', action: 'edit-row', onClick: (r) => _handleEdit(r) },
            { label: '刪除', icon: 'trash-2', className: 'btn-danger', action: 'delete-row', onClick: (r) => _handleDelete(r) },
          ]
        : () => [],
    },
  });

  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   卡片模式
   ============================================ */
function _renderCards(contentEl, limited, totalCount) {
  contentEl.innerHTML = `
    <div class="text-muted" style="font-size:12px; margin-bottom:10px;">
      共 ${totalCount} 筆，顯示最近 ${limited.length} 筆
    </div>
    <div class="data-cards-grid" id="recent-list-cards-root">
      ${limited.map((it) => _renderCard(it)).join('')}
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  const cardsRoot = document.getElementById('recent-list-cards-root');
  if (cardsRoot) {
    cardsRoot.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const key = btn.dataset.key;
      const row = limited.find((r) => r.id === key);
      if (!row) return;
      const action = btn.dataset.action;
      if (action === 'edit-row') _handleEdit(row);
      else if (action === 'delete-row') _handleDelete(row);
    });
  }
}

function _renderCard(it) {
  const memberName = _memberName(it.memberId);
  const amountCls = it.type === 'income' ? 'text-emerald' : 'text-red';
  // 🆕 v101.8.0：依 canInput 決定是否顯示按鈕
  const userCanInput = AppState.getCanInput();

  const actionsHtml = userCanInput ? `
    <div style="margin-top:12px; padding-top:12px; border-top:1px dashed rgba(255,255,255,0.08); display:flex; gap:8px; justify-content:flex-end;">
      <button type="button" class="btn btn-sm btn-ghost" data-action="edit-row" data-key="${escapeHtml(it.id)}">
        <i data-lucide="pencil" style="width:14px;height:14px;"></i> 編輯
      </button>
      <button type="button" class="btn btn-sm btn-danger" data-action="delete-row" data-key="${escapeHtml(it.id)}">
        <i data-lucide="trash-2" style="width:14px;height:14px;"></i> 刪除
      </button>
    </div>
  ` : '';

  return `
    <div class="glass-card" style="padding:14px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:10px;">
        <div style="flex:1; min-width:0;">
          <div style="font-size:14px; font-weight:600; word-break:break-word;">${escapeHtml(it.name)}</div>
          <div style="margin-top:4px;"><span class="badge ${it.typeBadge}">${it.typeLabel}</span></div>
        </div>
        <div class="mono ${amountCls}" style="font-size:16px; font-weight:700; white-space:nowrap;">${formatHKD(it.amount)}</div>
      </div>
      <div style="display:flex; flex-direction:column; gap:4px; font-size:12px;">
        <div style="display:flex; justify-content:space-between;"><span class="text-muted">年月</span><span class="mono">${escapeHtml(it.year)}-${escapeHtml(it.month)}</span></div>
        <div style="display:flex; justify-content:space-between;"><span class="text-muted">成員</span><span>${escapeHtml(memberName)}</span></div>
        ${it.date ? `<div style="display:flex; justify-content:space-between;"><span class="text-muted">日期</span><span class="mono">${escapeHtml(it.date)}</span></div>` : ''}
      </div>
      ${actionsHtml}
    </div>
  `;
}

/* ============================================
   資料合併
   ============================================ */
function _mergeItems() {
  const items = [];

  _expenses.forEach((e) => {
    items.push({
      type: 'expense', typeLabel: '支出', typeBadge: 'badge-pending',
      id: `${e.year}|${e.month}|${e.memberId}|${e.id}`,
      year: e.year, month: e.month, memberId: e.memberId,
      name: e.name || '（未命名支出）', amount: Number(e.amount) || 0,
      date: e.date || '', status: e.status || '',
      _ts: e.createdAt || 0, _raw: e,
    });
  });

  _incomes.forEach((inc, idx) => {
    const ts = new Date(Number(inc.year), Number(inc.month) - 1, 1).getTime() + idx;
    const memberName = _memberName(inc.memberId);
    items.push({
      type: 'income', typeLabel: '收入', typeBadge: 'badge-success',
      id: `${inc.year}|${inc.month}|${inc.memberId}`,
      year: inc.year, month: inc.month, memberId: inc.memberId,
      name: `${memberName} 收入`, amount: Number(inc.amount) || 0,
      date: '', status: '',
      _ts: ts, _raw: inc,
    });
  });

  return items;
}

function _memberName(memberId) {
  if (memberId === RESERVED_IDS.EXTRA_INCOME) return '額外收入';
  if (memberId === RESERVED_IDS.SHARED_MEMBER) return '家庭共用';
  return _membersMap[memberId] || '（未知）';
}

/* ============================================
   編輯 / 刪除處理（僅 canInput 時可呼叫）
   ============================================ */
async function _handleEdit(row) {
  if (!AppState.getCanInput()) return;
  if (row.type === 'expense') _openEditExpenseModal(row);
  else if (row.type === 'income') _openEditIncomeModal(row);
}

async function _handleDelete(row) {
  if (!AppState.getCanInput()) return;
  if (row.type === 'expense') _deleteExpense(row);
  else if (row.type === 'income') _deleteIncome(row);
}

async function _openEditExpenseModal(row) {
  const parts = row.id.split('|');
  if (parts.length < 4) return;
  const [year, month, memberId, id] = parts;

  const expense = _expenses.find((e) => e.id === id && e.year === year && e.month === month && e.memberId === memberId);
  if (!expense) { showToast('找不到此支出', 'error'); return; }

  const MODAL_ID = 'ic-edit-expense-modal';
  _destroyModal(MODAL_ID);

  const memberName = _memberName(memberId);
  const statusList = getStatusesByCategory('personal');

  _createModal(MODAL_ID, '編輯支出');
  buildForm({
    containerId: `${MODAL_ID}-form-root`,
    fields: [
      { type: 'custom', id: 'info', html: `<div class="glass-card-hint" style="margin-bottom:12px;">成員：<b>${escapeHtml(memberName)}</b>　年月：<b>${escapeHtml(year)}-${escapeHtml(month)}</b></div>` },
      { type: 'text', id: 'name', label: '項目名稱', required: true, maxlength: 60 },
      { type: 'number', id: 'amount', label: '費用（HK$）', required: true, min: 0, step: 1 },
      { type: 'text', id: 'date', label: '支出日期', placeholder: 'YYYY-MM-DD', maxlength: 10 },
      { type: 'select', id: 'status', label: '狀態', includeEmpty: false, options: statusList.map((s) => ({ value: s.name, label: s.name })) },
    ],
    submitText: '儲存',
    showCancel: true,
    cancelText: '取消',
    initialData: { name: expense.name || '', amount: expense.amount || 0, date: expense.date || '', status: expense.status || '未處理' },
    onSubmit: async (data) => {
      await updateExpense(year, month, memberId, id, {
        name: data.name, amount: Number(data.amount) || 0, date: data.date || '', status: data.status,
      });
      showToast('✅ 已更新支出', 'success');
      closeModal(MODAL_ID);
    },
    onCancel: () => closeModal(MODAL_ID),
  });

  openModal(MODAL_ID);
  if (window.lucide) window.lucide.createIcons();
}

async function _deleteExpense(row) {
  const parts = row.id.split('|');
  if (parts.length < 4) return;
  const [year, month, memberId, id] = parts;
  const expense = _expenses.find((e) => e.id === id && e.year === year && e.month === month && e.memberId === memberId);
  if (!expense) return;

  const ok = await openConfirm(`確定要刪除「${expense.name}」嗎？`, { title: '刪除支出', okText: '刪除', okClass: 'btn-danger' });
  if (!ok) return;
  try { await removeExpense(year, month, memberId, id); showToast('✅ 已刪除', 'success'); }
  catch (err) { showToast('刪除失敗：' + err.message, 'error'); }
}

async function _openEditIncomeModal(row) {
  const parts = row.id.split('|');
  if (parts.length < 3) return;
  const [year, month, memberId] = parts;
  const memberName = _memberName(memberId);

  let currentAmount = 0;
  try {
    const allIncome = await getIncomeOnce(year, month) || {};
    currentAmount = Number(allIncome[memberId]) || 0;
  } catch (e) {}

  const MODAL_ID = 'ic-edit-income-modal';
  _destroyModal(MODAL_ID);
  _createModal(MODAL_ID, '編輯收入');
  buildForm({
    containerId: `${MODAL_ID}-form-root`,
    fields: [
      { type: 'custom', id: 'info', html: `<div class="glass-card-hint" style="margin-bottom:12px;">成員：<b>${escapeHtml(memberName)}</b>　年月：<b>${escapeHtml(year)}-${escapeHtml(month)}</b></div>` },
      { type: 'number', id: 'amount', label: '金額（HK$）', required: true, min: 0, step: 1 },
    ],
    submitText: '儲存',
    showCancel: true,
    cancelText: '取消',
    initialData: { amount: currentAmount },
    onSubmit: async (data) => {
      await updateIncomeEntry(year, month, memberId, Number(data.amount) || 0);
      showToast('✅ 已更新收入', 'success');
      closeModal(MODAL_ID);
    },
    onCancel: () => closeModal(MODAL_ID),
  });
  openModal(MODAL_ID);
  if (window.lucide) window.lucide.createIcons();
}

async function _deleteIncome(row) {
  const parts = row.id.split('|');
  if (parts.length < 3) return;
  const [year, month, memberId] = parts;
  const memberName = _memberName(memberId);

  const ok = await openConfirm(`確定要刪除「${year}-${month} ${memberName}」的收入嗎？`, { title: '刪除收入', okText: '刪除', okClass: 'btn-danger' });
  if (!ok) return;
  try { await updateIncomeEntry(year, month, memberId, 0); showToast('✅ 已刪除', 'success'); }
  catch (err) { showToast('刪除失敗：' + err.message, 'error'); }
}

function _createModal(modalId, title) {
  _destroyModal(modalId);
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = modalId;
  overlay.innerHTML = `<div class="modal" style="max-width:480px; max-height:90vh; overflow-y:auto;"><h2 class="modal-title">${escapeHtml(title)}</h2><div id="${modalId}-form-root"></div></div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(modalId); });
  return overlay;
}

function _destroyModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.remove();
}