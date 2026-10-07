// ============================================
// recent-list.js — 輸入中心：最近 20 筆（v101.6 🆕）
// 位置：js/pages/input-center/recent-list.js
// ============================================
// 職責：
//   顯示最近 20 筆新增的資料（支出 + 收入混合）
//   每筆提供「編輯 / 刪除」按鈕
//   無年月區分（依 createdAt 排序）
// ============================================

import {
  listenAllExpenses, listenAllIncome,
  updateExpense, removeExpense,
  updateIncomeEntry, getIncomeOnce,
  getMembersOnce,
} from '../../core/db.js';
import {
  escapeHtml, formatHKD, todayISO, setText,
} from '../../core/utils.js';
import { getStatusesByCategory } from '../../config/app-config.js';
import { RESERVED_IDS, LIMITS } from '../../config/constants.js';
import { showToast } from '../../shared/toast.js';
import { openModal, closeModal, openConfirm } from '../../shared/modal.js';
import { buildForm } from '../../shared/form-builder.js';
import { createListenerGroup } from '../../shared/listener-group.js';

/* ============================================
   Module 狀態
   ============================================ */
let _expenses = [];
let _incomes = [];
let _members = [];
let _membersMap = {};
let _itemsMap = {};
let _categoriesMap = {};
let _paymentsMap = {};

/* ============================================
   主函式
   ============================================ */
export function initRecentList(containerId, options = {}) {
  const root = document.getElementById(containerId);
  if (!root) {
    console.warn(`⚠️ initRecentList: 找不到容器 #${containerId}`);
    return null;
  }

  const listenerGroup = createListenerGroup();

  root.innerHTML = '<div class="empty-state">載入中…</div>';

  // 載入成員
  _loadMembers().then(() => _render(root));

  // 監聽資料
  listenerGroup.add(listenAllExpenses((list) => {
    _expenses = list || [];
    _render(root);
  }));

  listenerGroup.add(listenAllIncome((list) => {
    _incomes = list || [];
    _render(root);
  }));

  // 綁定事件
  const clickHandler = (e) => _handleClick(e, root);
  root.addEventListener('click', clickHandler);

  return {
    refresh: () => _render(root),
    destroy: () => {
      listenerGroup.destroy();
      root.removeEventListener('click', clickHandler);
      root.innerHTML = '';
    },
  };
}

/* ============================================
   載入成員
   ============================================ */
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
   渲染
   ============================================ */
function _render(root) {
  if (!root) return;

  // 合併支出 + 收入
  const items = _mergeItems();

  // 依 createdAt 降序
  items.sort((a, b) => b._ts - a._ts);

  // 取前 N 筆
  const limited = items.slice(0, LIMITS.RECENT_LIST_LIMIT);

  if (limited.length === 0) {
    root.innerHTML = '<div class="empty-state">尚無新增資料</div>';
    return;
  }

  root.innerHTML = `
    <div style="padding:0 20px 20px;">
      <div class="text-muted" style="font-size:12px; margin-bottom:10px;">
        共 ${items.length} 筆，顯示最近 ${limited.length} 筆
      </div>
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width:70px;">類型</th>
              <th class="hide-mobile" style="width:90px;">年月</th>
              <th>項目</th>
              <th class="num" style="width:110px;">金額</th>
              <th style="width:150px;">操作</th>
            </tr>
          </thead>
          <tbody>
            ${limited.map((it) => _renderRow(it)).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   合併支出 + 收入
   ============================================ */
function _mergeItems() {
  const items = [];

  // 支出
  _expenses.forEach((e) => {
    items.push({
      type: 'expense',
      typeLabel: '支出',
      typeBadge: 'badge-pending',
      id: e.id,
      year: e.year,
      month: e.month,
      memberId: e.memberId,
      name: e.name || '（未命名支出）',
      amount: Number(e.amount) || 0,
      date: e.date || '',
      status: e.status || '',
      _ts: e.createdAt || 0,
      _raw: e,
    });
  });

  // 收入
  _incomes.forEach((inc, idx) => {
    const ts = new Date(Number(inc.year), Number(inc.month) - 1, 1).getTime() + idx;
    const memberName = inc.memberId === RESERVED_IDS.EXTRA_INCOME
      ? '額外收入'
      : (_membersMap[inc.memberId] || '（未知）');

    items.push({
      type: 'income',
      typeLabel: '收入',
      typeBadge: 'badge-success',
      id: `income-${inc.year}-${inc.month}-${inc.memberId}`,
      year: inc.year,
      month: inc.month,
      memberId: inc.memberId,
      name: `${memberName} 收入`,
      amount: Number(inc.amount) || 0,
      date: '',
      status: '',
      _ts: ts,
      _raw: inc,
    });
  });

  return items;
}

/* ============================================
   單列渲染
   ============================================ */
function _renderRow(it) {
  const memberName = it.memberId === RESERVED_IDS.EXTRA_INCOME
    ? '額外收入'
    : (_membersMap[it.memberId] || '（未知）');

  const subtitle = it.type === 'expense'
    ? `${escapeHtml(memberName)}${it.date ? ' · ' + escapeHtml(it.date) : ''}`
    : '';

  return `
    <tr data-type="${it.type}" data-key="${escapeHtml(it.id)}">
      <td data-label="類型">
        <span class="badge ${it.typeBadge}">${it.typeLabel}</span>
      </td>
      <td class="hide-mobile mono" data-label="年月" style="font-size:12px;">
        ${escapeHtml(it.year)}-${escapeHtml(it.month)}
      </td>
      <td data-primary="1">
        ${escapeHtml(it.name)}
        ${subtitle ? `<div style="font-size:11px; color:var(--text-muted); margin-top:2px;">${subtitle}</div>` : ''}
      </td>
      <td class="num ${it.type === 'income' ? 'text-emerald' : 'text-red'}" data-label="金額">
        ${formatHKD(it.amount)}
      </td>
      <td data-label="操作">
        <button class="btn btn-sm btn-ghost" data-action="edit" data-key="${escapeHtml(it.id)}">編輯</button>
        <button class="btn btn-sm btn-danger" data-action="delete" data-key="${escapeHtml(it.id)}">刪除</button>
      </td>
    </tr>
  `;
}

/* ============================================
   事件處理
   ============================================ */
function _handleClick(e, root) {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;

  const action = btn.dataset.action;
  const key = btn.dataset.key;
  const tr = btn.closest('tr');
  if (!tr) return;

  const type = tr.dataset.type;

  if (action === 'edit') {
    if (type === 'expense') _openEditExpenseModal(key);
    else if (type === 'income') _openEditIncomeModal(key);
  } else if (action === 'delete') {
    if (type === 'expense') _handleDeleteExpense(key);
    else if (type === 'income') _handleDeleteIncome(key);
  }
}

/* ============================================
   編輯支出
   ============================================ */
async function _openEditExpenseModal(key) {
  // key 格式：{year}-{month}-{memberId}-{id}
  const parts = key.split('-');
  if (parts.length < 4) return;
  const [year, month, memberId, id] = parts;

  const expense = _expenses.find((e) =>
    e.id === id && e.year === year && e.month === month && e.memberId === memberId
  );
  if (!expense) {
    showToast('找不到此支出', 'error');
    return;
  }

  const MODAL_ID = 'ic-edit-expense-modal';
  _destroyModal(MODAL_ID);

  const memberName = _membersMap[memberId] || '（未知）';
  const statusList = getStatusesByCategory('personal');

  const overlay = _createModal(MODAL_ID, '編輯支出');
  const formApi = buildForm({
    containerId: `${MODAL_ID}-form-root`,
    fields: [
      { type: 'custom', id: 'info', html: `
        <div class="glass-card-hint" style="margin-bottom:12px;">
          成員：<b>${escapeHtml(memberName)}</b>　
          年月：<b>${escapeHtml(year)}-${escapeHtml(month)}</b>
        </div>
      `},
      { type: 'text', id: 'name', label: '項目名稱', required: true, maxlength: 60 },
      { type: 'number', id: 'amount', label: '費用（HK$）', required: true, min: 0, step: 1 },
      { type: 'text', id: 'date', label: '支出日期', placeholder: 'YYYY-MM-DD', maxlength: 10 },
      { type: 'select', id: 'status', label: '狀態', includeEmpty: false,
        options: statusList.map((s) => ({ value: s.name, label: s.name })) },
    ],
    submitText: '儲存',
    showCancel: true,
    cancelText: '取消',
    initialData: {
      name: expense.name || '',
      amount: expense.amount || 0,
      date: expense.date || '',
      status: expense.status || '未處理',
    },
    onSubmit: async (data) => {
      await updateExpense(year, month, memberId, id, {
        name: data.name,
        amount: Number(data.amount) || 0,
        date: data.date || '',
        status: data.status,
      });
      showToast('✅ 已更新支出', 'success');
      closeModal(MODAL_ID);
    },
    onCancel: () => closeModal(MODAL_ID),
  });

  openModal(MODAL_ID);
  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   刪除支出
   ============================================ */
async function _handleDeleteExpense(key) {
  const parts = key.split('-');
  if (parts.length < 4) return;
  const [year, month, memberId, id] = parts;

  const expense = _expenses.find((e) =>
    e.id === id && e.year === year && e.month === month && e.memberId === memberId
  );
  if (!expense) return;

  const ok = await openConfirm(`確定要刪除「${expense.name}」嗎？`, {
    title: '刪除支出',
    okText: '刪除',
    okClass: 'btn-danger',
  });
  if (!ok) return;

  try {
    await removeExpense(year, month, memberId, id);
    showToast('✅ 已刪除', 'success');
  } catch (err) {
    showToast('刪除失敗：' + err.message, 'error');
  }
}

/* ============================================
   編輯收入
   ============================================ */
async function _openEditIncomeModal(key) {
  // key 格式：income-{year}-{month}-{memberId}
  const parts = key.split('-');
  if (parts.length < 4) return;
  const [, year, month, memberId] = parts;

  const memberName = memberId === RESERVED_IDS.EXTRA_INCOME
    ? '額外收入'
    : (_membersMap[memberId] || '（未知）');

  // 讀取當前值
  let currentAmount = 0;
  try {
    const allIncome = await getIncomeOnce(year, month) || {};
    currentAmount = Number(allIncome[memberId]) || 0;
  } catch (e) {
    console.warn('[recent-list] 讀取收入失敗：', e);
  }

  const MODAL_ID = 'ic-edit-income-modal';
  _destroyModal(MODAL_ID);

  const overlay = _createModal(MODAL_ID, '編輯收入');
  const formApi = buildForm({
    containerId: `${MODAL_ID}-form-root`,
    fields: [
      { type: 'custom', id: 'info', html: `
        <div class="glass-card-hint" style="margin-bottom:12px;">
          成員：<b>${escapeHtml(memberName)}</b>　
          年月：<b>${escapeHtml(year)}-${escapeHtml(month)}</b>
        </div>
      `},
      { type: 'number', id: 'amount', label: '金額（HK$）', required: true, min: 0, step: 1 },
    ],
    submitText: '儲存',
    showCancel: true,
    cancelText: '取消',
    initialData: { amount: currentAmount },
    onSubmit: async (data) => {
      const amount = Number(data.amount) || 0;
      await updateIncomeEntry(year, month, memberId, amount);
      showToast('✅ 已更新收入', 'success');
      closeModal(MODAL_ID);
    },
    onCancel: () => closeModal(MODAL_ID),
  });

  openModal(MODAL_ID);
  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   刪除收入
   ============================================ */
async function _handleDeleteIncome(key) {
  const parts = key.split('-');
  if (parts.length < 4) return;
  const [, year, month, memberId] = parts;

  const memberName = memberId === RESERVED_IDS.EXTRA_INCOME
    ? '額外收入'
    : (_membersMap[memberId] || '（未知）');

  const ok = await openConfirm(`確定要刪除「${year}-${month} ${memberName}」的收入嗎？`, {
    title: '刪除收入',
    okText: '刪除',
    okClass: 'btn-danger',
  });
  if (!ok) return;

  try {
    await updateIncomeEntry(year, month, memberId, 0);
    showToast('✅ 已刪除', 'success');
  } catch (err) {
    showToast('刪除失敗：' + err.message, 'error');
  }
}

/* ============================================
   Modal 輔助
   ============================================ */
function _createModal(modalId, title) {
  _destroyModal(modalId);

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = modalId;
  overlay.innerHTML = `
    <div class="modal" style="max-width:480px; max-height:90vh; overflow-y:auto;">
      <h2 class="modal-title">${escapeHtml(title)}</h2>
      <div id="${modalId}-form-root"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(modalId);
  });

  return overlay;
}

function _destroyModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.remove();
}