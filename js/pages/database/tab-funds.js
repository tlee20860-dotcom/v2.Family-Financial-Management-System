// ============================================
// tab-funds.js — 基礎資料庫：基金 Tab（v101）
// 位置：js/pages/database/tab-funds.js
// ============================================
// 功能：基金的完整 CRUD（含名稱、成本、現值、單位數、備註）
// ============================================

import {
  listenFunds, addFund, updateFund, removeFund,
} from '../../core/db.js';
import { escapeHtml, formatHKD } from '../../core/utils.js';
import { showToast } from '../../shared/toast.js';
import { openModal, closeModal, openConfirm } from '../../shared/modal.js';
import { buildForm } from '../../shared/form-builder.js';

/* ============================================
   Module 狀態
   ============================================ */
let _container = null;
let _funds = [];
let _formApi = null;
let _modalFormApi = null;
let _editingId = null;
let _unsubscribers = [];

const MODAL_ID = 'db-fund-modal';

/* ============================================
   主入口
   ============================================ */
export function initFundsTab(containerId) {
  _container = document.getElementById(containerId);
  if (!_container) {
    console.warn(`⚠️ initFundsTab: 找不到容器 #${containerId}`);
    return null;
  }

  _container.innerHTML = _buildSkeleton();

  _renderForm();
  _renderModal();
  _bindListEvents();
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
    <div id="db-funds-form-root" class="mb-16"></div>

    <div class="glass-card collapsible-card collapsible-card-flat" id="db-funds-list-card">
      <div class="collapsible-header" id="db-funds-list-header">
        <div class="collapsible-header-title">
          <i data-lucide="line-chart" style="width:16px;height:16px;"></i>
          <span>基金清單 <span class="text-muted" id="db-funds-count" style="font-size:12px; margin-left:6px;"></span></span>
        </div>
        <i data-lucide="chevron-down" class="collapsible-arrow"></i>
      </div>
      <div class="collapsible-body" style="display:block;">
        <div id="db-funds-list"></div>
      </div>
    </div>
  `;
}

/* ============================================
   新增表單
   ============================================ */
function _renderForm() {
  _formApi = buildForm({
    containerId: 'db-funds-form-root',
    fields: [
      { type: 'text',   id: 'db-fund-name',  label: '基金名稱', required: true, placeholder: '例如：富達環球股票基金', maxlength: 60 },
      { type: 'number', id: 'db-fund-cost',  label: '投入成本（HK$）', required: true, min: 0, step: 1, placeholder: '0' },
      { type: 'number', id: 'db-fund-value', label: '現時價值（HK$）', required: true, min: 0, step: 1, placeholder: '0' },
      { type: 'number', id: 'db-fund-units', label: '持有單位數（可選）', min: 0, step: 0.0001, placeholder: '例如：123.4567' },
      { type: 'text',   id: 'db-fund-note',  label: '備註（可選）', placeholder: '例如：月供計劃', maxlength: 60 },
    ],
    submitText: '新增基金',
    showCancel: false,
    showReset: true,
    resetText: '重置',
    onSubmit: _handleAdd,
  });
}

async function _handleAdd(data) {
  const name = (data['db-fund-name'] || '').trim();
  const cost = Math.round(Number(data['db-fund-cost']) || 0);
  const currentValue = Math.round(Number(data['db-fund-value']) || 0);
  const units = Number(data['db-fund-units']) || 0;
  const note = (data['db-fund-note'] || '').trim();

  if (!name) {
    return { field: 'db-fund-name', message: '請填寫基金名稱' };
  }

  try {
    await addFund({ name, cost, currentValue, units, note });
    showToast(`✅ 已新增基金「${name}」`, 'success');
    _formApi.reset();
  } catch (err) {
    showToast('新增失敗：' + err.message, 'error');
  }
}

/* ============================================
   編輯 Modal
   ============================================ */
function _renderModal() {
  const existing = document.getElementById(MODAL_ID);
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = MODAL_ID;
  overlay.innerHTML = `
    <div class="modal" style="max-width:520px;">
      <h2 class="modal-title">編輯基金</h2>
      <div id="db-fund-modal-form-root"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  _modalFormApi = buildForm({
    containerId: 'db-fund-modal-form-root',
    fields: [
      { type: 'hidden', id: 'db-fund-edit-id' },
      { type: 'text',   id: 'db-fund-edit-name',  label: '基金名稱', required: true, maxlength: 60 },
      { type: 'number', id: 'db-fund-edit-cost',  label: '投入成本（HK$）', required: true, min: 0, step: 1 },
      { type: 'number', id: 'db-fund-edit-value', label: '現時價值（HK$）', required: true, min: 0, step: 1 },
      { type: 'number', id: 'db-fund-edit-units', label: '持有單位數（可選）', min: 0, step: 0.0001 },
      { type: 'text',   id: 'db-fund-edit-note',  label: '備註（可選）', maxlength: 60 },
    ],
    submitText: '儲存',
    showCancel: true,
    cancelText: '取消',
    onSubmit: _handleEdit,
    onCancel: () => closeModal(MODAL_ID),
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(MODAL_ID);
  });
}

async function _handleEdit(data) {
  const id = data['db-fund-edit-id'];
  if (!id) return;

  const name = (data['db-fund-edit-name'] || '').trim();
  const cost = Math.round(Number(data['db-fund-edit-cost']) || 0);
  const currentValue = Math.round(Number(data['db-fund-edit-value']) || 0);
  const units = Number(data['db-fund-edit-units']) || 0;
  const note = (data['db-fund-edit-note'] || '').trim();

  if (!name) {
    return { field: 'db-fund-edit-name', message: '請填寫基金名稱' };
  }

  try {
    await updateFund(id, { name, cost, currentValue, units, note });
    showToast('✅ 已更新基金', 'success');
    closeModal(MODAL_ID);
    _editingId = null;
  } catch (err) {
    showToast('更新失敗：' + err.message, 'error');
  }
}

/* ============================================
   資料監聽
   ============================================ */
function _bindListeners() {
  _unsubscribers.push(
    listenFunds((list) => {
      _funds = list;
      _render();
    })
  );
}

/* ============================================
   渲染清單
   ============================================ */
function _render() {
  const listEl = document.getElementById('db-funds-list');
  const countEl = document.getElementById('db-funds-count');
  if (!listEl) return;

  if (countEl) countEl.textContent = `（共 ${_funds.length} 筆）`;

  if (_funds.length === 0) {
    listEl.innerHTML = `<div class="empty-state">尚無基金，請從上方新增</div>`;
    return;
  }

  listEl.innerHTML = `
    <div style="overflow-x:auto;">
      <table class="data-table mobile-cards">
        <thead>
          <tr>
            <th>基金名稱</th>
            <th class="num">投入成本</th>
            <th class="num">現時價值</th>
            <th class="num hide-mobile">盈虧</th>
            <th style="width:180px;">操作</th>
          </tr>
        </thead>
        <tbody>
          ${_funds.map((f) => _renderRow(f)).join('')}
        </tbody>
      </table>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
}

function _renderRow(f) {
  const cost = Number(f.cost) || 0;
  const value = Number(f.currentValue) || 0;
  const pnl = value - cost;
  const pnlCls = pnl >= 0 ? 'text-emerald' : 'text-red';
  const sign = pnl >= 0 ? '+' : '';

  return `
    <tr data-id="${f.id}">
      <td data-primary="1">
        ${escapeHtml(f.name || '（未命名）')}
        ${f.note ? `<div style="font-size:11px; color:var(--text-muted); margin-top:2px;">${escapeHtml(f.note)}</div>` : ''}
      </td>
      <td class="num" data-label="投入成本">${formatHKD(cost)}</td>
      <td class="num text-emerald" data-label="現時價值">${formatHKD(value)}</td>
      <td class="num hide-mobile ${pnlCls}" data-label="盈虧">${sign}${formatHKD(pnl)}</td>
      <td data-label="操作">
        <button class="btn btn-sm btn-ghost" data-action="edit" data-id="${f.id}">編輯</button>
        <button class="btn btn-sm btn-danger" data-action="delete" data-id="${f.id}">刪除</button>
      </td>
    </tr>
  `;
}

/* ============================================
   清單事件
   ============================================ */
function _bindListEvents() {
  const listEl = document.getElementById('db-funds-list');
  if (!listEl) return;

  listEl.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const id = btn.dataset.id;
    const action = btn.dataset.action;
    const fund = _funds.find((f) => f.id === id);
    if (!fund) return;

    if (action === 'edit') {
      _openEditModal(fund);
    } else if (action === 'delete') {
      const ok = await openConfirm(`確定要刪除基金「${fund.name}」嗎？`, {
        title: '刪除基金',
        okText: '刪除',
        okClass: 'btn-danger',
      });
      if (!ok) return;

      try {
        await removeFund(fund.id);
        showToast('✅ 已刪除', 'success');
      } catch (err) {
        showToast('刪除失敗：' + err.message, 'error');
      }
    }
  });
}

function _openEditModal(fund) {
  _editingId = fund.id;
  if (!_modalFormApi) return;

  _modalFormApi.setData({
    'db-fund-edit-id': fund.id,
    'db-fund-edit-name': fund.name || '',
    'db-fund-edit-cost': fund.cost || 0,
    'db-fund-edit-value': fund.currentValue || 0,
    'db-fund-edit-units': fund.units || 0,
    'db-fund-edit-note': fund.note || '',
  });

  openModal(MODAL_ID);
}

/* ============================================
   銷毀
   ============================================ */
function _destroy() {
  _unsubscribers.forEach((fn) => {
    try { fn(); } catch (e) { /* noop */ }
  });
  _unsubscribers = [];
  if (_formApi) _formApi.destroy();
  if (_modalFormApi) _modalFormApi.destroy();

  const overlay = document.getElementById(MODAL_ID);
  if (overlay) overlay.remove();
}