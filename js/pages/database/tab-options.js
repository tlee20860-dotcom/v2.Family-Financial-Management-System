// ============================================
// tab-options.js — 基礎資料庫：支付 / 狀態 Tab（v101）
// 位置：js/pages/database/tab-options.js
// ============================================
// 功能：
//   左側：支付方式 CRUD + 排序
//   右側：狀態清單 CRUD（依 3 類別分組顯示）
// ============================================

import {
  listenPaymentMethods, addPaymentMethod, updatePaymentMethod, removePaymentMethod,
  listenStatuses, addStatus, updateStatus, removeStatus,
} from '../../core/db.js';
import { escapeHtml } from '../../core/utils.js';
import { showToast } from '../../shared/toast.js';
import { openModal, closeModal, openConfirm } from '../../shared/modal.js';
import { buildForm } from '../../shared/form-builder.js';

/* ============================================
   Module 狀態
   ============================================ */
let _container = null;
let _payments = [];
let _statuses = [];
let _payFormApi = null;
let _statusFormApi = null;
let _payModalFormApi = null;
let _statusModalFormApi = null;
let _editingPayId = null;
let _editingStatusId = null;
let _unsubscribers = [];

const PAY_MODAL_ID = 'db-pay-modal';
const STATUS_MODAL_ID = 'db-status-modal';

/* 狀態類別對照 */
const STATUS_CATEGORIES = [
  { value: 'personal',  label: '個人支出' },
  { value: 'fixed',     label: '固定支出' },
  { value: 'insurance', label: '保險' },
];

/* ============================================
   主入口
   ============================================ */
export function initOptionsTab(containerId) {
  _container = document.getElementById(containerId);
  if (!_container) {
    console.warn(`⚠️ initOptionsTab: 找不到容器 #${containerId}`);
    return null;
  }

  _container.innerHTML = _buildSkeleton();

  _renderPayForm();
  _renderStatusForm();
  _renderPayModal();
  _renderStatusModal();
  _bindEvents();
  _bindListeners();

  return {
    refresh: _render,
    destroy: _destroy,
  };
}

/* ============================================
   骨架
   ============================================ */
function _buildSkeleton() {
  return `
    <div class="grid grid-2" style="gap:16px; align-items:start;">

      <!-- 左：支付方式 -->
      <div>
        <div id="db-pay-form-root" class="mb-16"></div>

        <div class="glass-card collapsible-card collapsible-card-flat" id="db-pays-list-card">
          <div class="collapsible-header" id="db-pays-list-header">
            <div class="collapsible-header-title">
              <i data-lucide="credit-card" style="width:16px;height:16px;"></i>
              <span>支付方式 <span class="text-muted" id="db-pays-count" style="font-size:12px; margin-left:6px;"></span></span>
            </div>
            <i data-lucide="chevron-down" class="collapsible-arrow"></i>
          </div>
          <div class="collapsible-body" style="display:block;">
            <div id="db-pays-list"></div>
          </div>
        </div>
      </div>

      <!-- 右：狀態 -->
      <div>
        <div id="db-status-form-root" class="mb-16"></div>

        <div class="glass-card collapsible-card collapsible-card-flat" id="db-status-list-card">
          <div class="collapsible-header" id="db-status-list-header">
            <div class="collapsible-header-title">
              <i data-lucide="tag" style="width:16px;height:16px;"></i>
              <span>狀態清單 <span class="text-muted" id="db-status-count" style="font-size:12px; margin-left:6px;"></span></span>
            </div>
            <i data-lucide="chevron-down" class="collapsible-arrow"></i>
          </div>
          <div class="collapsible-body" style="display:block;">
            <div id="db-status-list"></div>
          </div>
        </div>
      </div>

    </div>
  `;
}

/* ============================================
   支付方式新增表單
   ============================================ */
function _renderPayForm() {
  _payFormApi = buildForm({
    containerId: 'db-pay-form-root',
    fields: [
      { type: 'text',   id: 'db-pay-name',  label: '支付方式名稱', required: true, placeholder: '例如：現金、中銀', maxlength: 20 },
      { type: 'number', id: 'db-pay-order', label: '排序（數字越小越前）', min: 0, placeholder: '0' },
    ],
    submitText: '新增支付方式',
    showCancel: false,
    showReset: true,
    resetText: '重置',
    onSubmit: _handlePayAdd,
  });
}

async function _handlePayAdd(data) {
  const name = (data['db-pay-name'] || '').trim();
  const order = Number(data['db-pay-order']) || 0;

  if (!name) {
    return { field: 'db-pay-name', message: '請填寫支付方式名稱' };
  }
  if (_payments.some((p) => p.name === name)) {
    return { field: 'db-pay-name', message: '此名稱已存在' };
  }

  try {
    await addPaymentMethod({ name, order });
    showToast(`✅ 已新增支付方式「${name}」`, 'success');
    _payFormApi.reset();
  } catch (err) {
    showToast('新增失敗：' + err.message, 'error');
  }
}

/* ============================================
   狀態新增表單
   ============================================ */
function _renderStatusForm() {
  _statusFormApi = buildForm({
    containerId: 'db-status-form-root',
    fields: [
      { type: 'text',   id: 'db-status-name',  label: '狀態名稱', required: true, placeholder: '例如：未處理、已還款', maxlength: 20 },
      { type: 'select', id: 'db-status-cat',   label: '所屬類別', required: true, includeEmpty: false, options: STATUS_CATEGORIES },
      { type: 'select', id: 'db-status-done',  label: '是否為「已完成」', required: true, includeEmpty: false,
        options: [
          { value: 'false', label: '否（未處理類）' },
          { value: 'true',  label: '是（已完成類）' },
        ],
      },
      { type: 'number', id: 'db-status-order', label: '排序（數字越小越前）', min: 0, placeholder: '0' },
    ],
    submitText: '新增狀態',
    showCancel: false,
    showReset: true,
    resetText: '重置',
    onSubmit: _handleStatusAdd,
  });

  // 預設：未完成
  _statusFormApi.setFieldValue('db-status-done', 'false');
}

async function _handleStatusAdd(data) {
  const name = (data['db-status-name'] || '').trim();
  const category = data['db-status-cat'];
  const isDone = data['db-status-done'] === 'true';
  const order = Number(data['db-status-order']) || 0;

  if (!name) {
    return { field: 'db-status-name', message: '請填寫狀態名稱' };
  }
  if (_statuses.some((s) => s.name === name)) {
    return { field: 'db-status-name', message: '此狀態名稱已存在' };
  }

  try {
    await addStatus({ name, category, isDone, order });
    showToast(`✅ 已新增狀態「${name}」`, 'success');
    _statusFormApi.reset();
    _statusFormApi.setFieldValue('db-status-done', 'false');
  } catch (err) {
    showToast('新增失敗：' + err.message, 'error');
  }
}

/* ============================================
   支付方式編輯 Modal
   ============================================ */
function _renderPayModal() {
  const existing = document.getElementById(PAY_MODAL_ID);
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = PAY_MODAL_ID;
  overlay.innerHTML = `
    <div class="modal">
      <h2 class="modal-title">編輯支付方式</h2>
      <div id="db-pay-modal-form-root"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  _payModalFormApi = buildForm({
    containerId: 'db-pay-modal-form-root',
    fields: [
      { type: 'hidden', id: 'db-pay-edit-id' },
      { type: 'text',   id: 'db-pay-edit-name',  label: '支付方式名稱', required: true, maxlength: 20 },
      { type: 'number', id: 'db-pay-edit-order', label: '排序', min: 0 },
    ],
    submitText: '儲存',
    showCancel: true,
    cancelText: '取消',
    onSubmit: _handlePayEdit,
    onCancel: () => closeModal(PAY_MODAL_ID),
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(PAY_MODAL_ID);
  });
}

async function _handlePayEdit(data) {
  const id = data['db-pay-edit-id'];
  if (!id) return;

  const name = (data['db-pay-edit-name'] || '').trim();
  const order = Number(data['db-pay-edit-order']) || 0;

  if (!name) {
    return { field: 'db-pay-edit-name', message: '請填寫名稱' };
  }

  try {
    await updatePaymentMethod(id, { name, order });
    showToast('✅ 已更新支付方式', 'success');
    closeModal(PAY_MODAL_ID);
    _editingPayId = null;
  } catch (err) {
    showToast('更新失敗：' + err.message, 'error');
  }
}

/* ============================================
   狀態編輯 Modal
   ============================================ */
function _renderStatusModal() {
  const existing = document.getElementById(STATUS_MODAL_ID);
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = STATUS_MODAL_ID;
  overlay.innerHTML = `
    <div class="modal">
      <h2 class="modal-title">編輯狀態</h2>
      <div id="db-status-modal-form-root"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  _statusModalFormApi = buildForm({
    containerId: 'db-status-modal-form-root',
    fields: [
      { type: 'hidden', id: 'db-status-edit-id' },
      { type: 'text',   id: 'db-status-edit-name',  label: '狀態名稱', required: true, maxlength: 20 },
      { type: 'select', id: 'db-status-edit-cat',   label: '所屬類別', required: true, includeEmpty: false, options: STATUS_CATEGORIES },
      { type: 'select', id: 'db-status-edit-done',  label: '是否為「已完成」', required: true, includeEmpty: false,
        options: [
          { value: 'false', label: '否（未處理類）' },
          { value: 'true',  label: '是（已完成類）' },
        ],
      },
      { type: 'number', id: 'db-status-edit-order', label: '排序', min: 0 },
    ],
    submitText: '儲存',
    showCancel: true,
    cancelText: '取消',
    onSubmit: _handleStatusEdit,
    onCancel: () => closeModal(STATUS_MODAL_ID),
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(STATUS_MODAL_ID);
  });
}

async function _handleStatusEdit(data) {
  const id = data['db-status-edit-id'];
  if (!id) return;

  const name = (data['db-status-edit-name'] || '').trim();
  const category = data['db-status-edit-cat'];
  const isDone = data['db-status-edit-done'] === 'true';
  const order = Number(data['db-status-edit-order']) || 0;

  if (!name) {
    return { field: 'db-status-edit-name', message: '請填寫狀態名稱' };
  }

  try {
    await updateStatus(id, { name, category, isDone, order });
    showToast('✅ 已更新狀態', 'success');
    closeModal(STATUS_MODAL_ID);
    _editingStatusId = null;
  } catch (err) {
    showToast('更新失敗：' + err.message, 'error');
  }
}

/* ============================================
   資料監聽
   ============================================ */
function _bindListeners() {
  _unsubscribers.push(
    listenPaymentMethods((list) => {
      _payments = list;
      _render();
    })
  );

  _unsubscribers.push(
    listenStatuses((list) => {
      _statuses = list;
      _render();
    })
  );
}

/* ============================================
   事件綁定
   ============================================ */
function _bindEvents() {
  document.getElementById('db-pays-list')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    const payment = _payments.find((p) => p.id === id);
    if (!payment) return;

    if (action === 'edit') {
      _editingPayId = id;
      _payModalFormApi?.setData({
        'db-pay-edit-id': payment.id,
        'db-pay-edit-name': payment.name || '',
        'db-pay-edit-order': payment.order || 0,
      });
      openModal(PAY_MODAL_ID);
    } else if (action === 'delete') {
      const ok = await openConfirm(
        `確定要刪除支付方式「${payment.name}」嗎？\n\n已使用此支付方式的支出紀錄不會被刪除，但會顯示為「（已刪除）」。`,
        { title: '刪除支付方式', okText: '刪除', okClass: 'btn-danger' }
      );
      if (!ok) return;
      try {
        await removePaymentMethod(id);
        showToast('✅ 已刪除', 'success');
      } catch (err) {
        showToast('刪除失敗：' + err.message, 'error');
      }
    }
  });

  document.getElementById('db-status-list')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    const status = _statuses.find((s) => s.id === id);
    if (!status) return;

    if (action === 'edit') {
      _editingStatusId = id;
      _statusModalFormApi?.setData({
        'db-status-edit-id': status.id,
        'db-status-edit-name': status.name || '',
        'db-status-edit-cat': status.category || 'personal',
        'db-status-edit-done': status.isDone ? 'true' : 'false',
        'db-status-edit-order': status.order || 0,
      });
      openModal(STATUS_MODAL_ID);
    } else if (action === 'delete') {
      const ok = await openConfirm(
        `確定要刪除狀態「${status.name}」嗎？\n\n已使用此狀態的紀錄不會被刪除，但會顯示原本的狀態文字。`,
        { title: '刪除狀態', okText: '刪除', okClass: 'btn-danger' }
      );
      if (!ok) return;
      try {
        await removeStatus(id);
        showToast('✅ 已刪除', 'success');
      } catch (err) {
        showToast('刪除失敗：' + err.message, 'error');
      }
    }
  });
}

/* ============================================
   渲染
   ============================================ */
function _render() {
  _renderPayments();
  _renderStatuses();
}

function _renderPayments() {
  const listEl = document.getElementById('db-pays-list');
  const countEl = document.getElementById('db-pays-count');
  if (!listEl) return;

  if (countEl) countEl.textContent = `（共 ${_payments.length} 個）`;

  if (_payments.length === 0) {
    listEl.innerHTML = `<div class="empty-state">尚無支付方式</div>`;
    return;
  }

  listEl.innerHTML = `
    <div style="overflow-x:auto;">
      <table class="data-table">
        <thead>
          <tr>
            <th>名稱</th>
            <th class="num" style="width:60px;">排序</th>
            <th style="width:130px;">操作</th>
          </tr>
        </thead>
        <tbody>
          ${_payments.map((p) => `
            <tr data-id="${p.id}">
              <td>${escapeHtml(p.name)}</td>
              <td class="num">${p.order || 0}</td>
              <td>
                <button class="btn btn-sm btn-ghost" data-action="edit" data-id="${p.id}">編輯</button>
                <button class="btn btn-sm btn-danger" data-action="delete" data-id="${p.id}">刪除</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
}

function _renderStatuses() {
  const listEl = document.getElementById('db-status-list');
  const countEl = document.getElementById('db-status-count');
  if (!listEl) return;

  if (countEl) countEl.textContent = `（共 ${_statuses.length} 個）`;

  if (_statuses.length === 0) {
    listEl.innerHTML = `<div class="empty-state">尚無狀態</div>`;
    return;
  }

  // 依類別分組
  const groups = {
    personal: [],
    fixed: [],
    insurance: [],
  };
  _statuses.forEach((s) => {
    const cat = s.category || 'personal';
    if (groups[cat]) groups[cat].push(s);
    else groups.personal.push(s);
  });

  const categoryLabels = {
    personal: '個人支出',
    fixed: '固定支出',
    insurance: '保險',
  };

  listEl.innerHTML = Object.entries(groups)
    .filter(([, list]) => list.length > 0)
    .map(([cat, list]) => `
      <div style="margin-bottom:16px;">
        <div style="font-size:11px; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">
          ${categoryLabels[cat] || cat}
        </div>
        <div style="overflow-x:auto;">
          <table class="data-table">
            <tbody>
              ${list.map((s) => `
                <tr data-id="${s.id}">
                  <td>
                    ${escapeHtml(s.name)}
                    ${s.isDone ? '<span class="badge badge-success" style="margin-left:6px;">已完成</span>' : ''}
                  </td>
                  <td class="num" style="width:50px; font-size:11px; color:var(--text-muted);">${s.order || 0}</td>
                  <td style="width:130px;">
                    <button class="btn btn-sm btn-ghost" data-action="edit" data-id="${s.id}">編輯</button>
                    <button class="btn btn-sm btn-danger" data-action="delete" data-id="${s.id}">刪除</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `).join('');

  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   銷毀
   ============================================ */
function _destroy() {
  _unsubscribers.forEach((fn) => {
    try { fn(); } catch (e) { /* noop */ }
  });
  _unsubscribers = [];
  if (_payFormApi) _payFormApi.destroy();
  if (_statusFormApi) _statusFormApi.destroy();
  if (_payModalFormApi) _payModalFormApi.destroy();
  if (_statusModalFormApi) _statusModalFormApi.destroy();

  document.getElementById(PAY_MODAL_ID)?.remove();
  document.getElementById(STATUS_MODAL_ID)?.remove();
}