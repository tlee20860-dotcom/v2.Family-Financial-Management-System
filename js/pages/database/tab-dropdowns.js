// ============================================
// tab-dropdowns.js — 基礎資料庫：下拉選項 Tab（v101.5）
// 位置：js/pages/database/tab-dropdowns.js
// ============================================
// v101.5 修正：
//   ✅ 保留 GROUPS 定義（用於分組顯示，非 SSOT）
//   ✅ 新增 / 編輯改用 openConfirm + 專屬 Modal（因選項結構特殊）
//   ✅ 使用 _container.querySelector + 完整清理
// ============================================

import { listenFamilyOptions, saveFamilyOptions } from '../../core/db.js';
import { getOptions } from '../../config/app-config.js';
import { escapeHtml } from '../../core/utils.js';
import { showToast } from '../../shared/toast.js';
import { openModal, closeModal, openConfirm } from '../../shared/modal.js';
import { buildForm } from '../../shared/form-builder.js';

/* ============================================
   Module 狀態
   ============================================ */
let _container = null;
let _options = {};
let _unsubOptions = null;
let _listHandler = null;
let _editFormApi = null;

const EDIT_MODAL_ID = 'db-dropdown-edit-modal';

/* ============================================
   選項群組定義
   ============================================ */
const GROUPS = [
  { key: 'memberRoles',           label: '成員角色',     icon: 'users',        type: 'value-label', hint: '用於成員的角色選項' },
  { key: 'cycles',                label: '付款週期',     icon: 'repeat',       type: 'value-label', hint: '固定支出的付款週期' },
  { key: 'policyTypes',           label: '保單類型',     icon: 'shield',       type: 'value-label', hint: '保險保單的類型' },
  { key: 'insurancePaymentTypes', label: '保險付款類型', icon: 'credit-card',  type: 'value-label', hint: '保單的付款方式（年繳 / 月繳 / 一次付款）' },
  { key: 'categoryOrder',         label: '類別順序',     icon: 'list-ordered', type: 'string',      hint: '年度報表中類別的顯示順序' },
];

/* ============================================
   主入口
   ============================================ */
export function initDropdownsTab(containerId) {
  _container = document.getElementById(containerId);
  if (!_container) {
    console.warn(`⚠️ initDropdownsTab: 找不到容器 #${containerId}`);
    return null;
  }

  _container.innerHTML = _buildSkeleton();
  _renderEditModal();
  _bindEvents();

  _unsubOptions = listenFamilyOptions((data) => {
    _options = _normalizeOptions(data);
    _render();
  });

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
    <div class="banner" style="margin-bottom:16px;">
      ℹ️ 此處集中管理全站的下拉選項，修改後會即時同步至相關頁面。
    </div>

    <div id="db-dropdowns-list" class="grid grid-2" style="gap:16px; align-items:start;"></div>
  `;
}

/* ============================================
   編輯 Modal（共用）
   ============================================ */
function _renderEditModal() {
  const existing = document.getElementById(EDIT_MODAL_ID);
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = EDIT_MODAL_ID;
  overlay.innerHTML = `
    <div class="modal" style="max-width:480px;">
      <h2 class="modal-title" id="db-dropdown-modal-title">編輯選項</h2>
      <div id="db-dropdown-modal-form-root"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(EDIT_MODAL_ID);
  });
}

/* ============================================
   資料正規化
   ============================================ */
function _normalizeOptions(data) {
  const fallback = {
    memberRoles: getOptions('memberRoles'),
    cycles: getOptions('cycles'),
    policyTypes: getOptions('policyTypes'),
    insurancePaymentTypes: getOptions('insurancePaymentTypes'),
    categoryOrder: getOptions('categoryOrder'),
  };

  if (!data || Object.keys(data).length === 0) return fallback;

  return {
    memberRoles: Array.isArray(data.memberRoles) ? data.memberRoles : fallback.memberRoles,
    cycles: Array.isArray(data.cycles) ? data.cycles : fallback.cycles,
    policyTypes: Array.isArray(data.policyTypes) ? data.policyTypes : fallback.policyTypes,
    insurancePaymentTypes: Array.isArray(data.insurancePaymentTypes) ? data.insurancePaymentTypes : fallback.insurancePaymentTypes,
    categoryOrder: Array.isArray(data.categoryOrder) ? data.categoryOrder : fallback.categoryOrder,
  };
}

/* ============================================
   事件綁定
   ============================================ */
function _bindEvents() {
  const listEl = _container.querySelector('#db-dropdowns-list');
  if (!listEl) return;

  _listHandler = async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const groupKey = btn.dataset.group;
    const action = btn.dataset.action;
    const idx = Number(btn.dataset.index);

    if (action === 'add') {
      _openAddModal(groupKey);
    } else if (action === 'edit') {
      _openEditModal(groupKey, idx);
    } else if (action === 'delete') {
      await _handleDelete(groupKey, idx);
    } else if (action === 'move-up') {
      await _move(groupKey, idx, 'up');
    } else if (action === 'move-down') {
      await _move(groupKey, idx, 'down');
    }
  };

  listEl.addEventListener('click', _listHandler);
}

/* ============================================
   渲染
   ============================================ */
function _render() {
  const listEl = _container.querySelector('#db-dropdowns-list');
  if (!listEl) return;

  listEl.innerHTML = GROUPS.map((g) => _renderGroupCard(g)).join('');

  if (window.lucide) window.lucide.createIcons();
}

function _renderGroupCard(group) {
  const list = _options[group.key] || [];

  const rows = list.map((item, i) => {
    const isFirst = i === 0;
    const isLast = i === list.length - 1;

    const mainText = group.type === 'value-label'
      ? `<div style="font-weight:500;">${escapeHtml(item.label || '')}</div>
         <div style="font-size:11px; color:var(--text-muted); font-family:var(--font-mono);">${escapeHtml(item.value || '')}</div>`
      : `<div style="font-weight:500;">${escapeHtml(item)}</div>`;

    return `
      <div class="dd-row" style="display:flex; align-items:center; gap:8px; padding:8px 10px; border-bottom:1px solid rgba(255,255,255,0.04);">
        <div style="flex:1; min-width:0;">${mainText}</div>
        <div style="display:flex; gap:2px;">
          <button class="btn btn-sm btn-ghost" data-action="move-up" data-group="${group.key}" data-index="${i}"
            ${isFirst ? 'disabled' : ''} title="上移" style="padding:2px 5px;">
            <i data-lucide="chevron-up" style="width:12px;height:12px;"></i>
          </button>
          <button class="btn btn-sm btn-ghost" data-action="move-down" data-group="${group.key}" data-index="${i}"
            ${isLast ? 'disabled' : ''} title="下移" style="padding:2px 5px;">
            <i data-lucide="chevron-down" style="width:12px;height:12px;"></i>
          </button>
          <button class="btn btn-sm btn-ghost" data-action="edit" data-group="${group.key}" data-index="${i}">編輯</button>
          <button class="btn btn-sm btn-danger" data-action="delete" data-group="${group.key}" data-index="${i}">刪除</button>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="glass-card collapsible-card collapsible-card-flat">
      <div class="collapsible-header">
        <div class="collapsible-header-title">
          <i data-lucide="${group.icon}" style="width:16px;height:16px;"></i>
          <span>${escapeHtml(group.label)} <span class="text-muted" style="font-size:12px; margin-left:6px;">（${list.length}）</span></span>
        </div>
        <button class="btn btn-sm btn-ghost" data-action="add" data-group="${group.key}">
          <i data-lucide="plus" style="width:14px;height:14px;"></i> 新增
        </button>
      </div>
      <div class="collapsible-body" style="display:block; padding:0;">
        ${list.length === 0
          ? `<div class="empty-state" style="padding:20px;">尚未設定</div>`
          : `<div>${rows}</div>`}
        <div style="padding:8px 12px; font-size:11px; color:var(--text-muted); border-top:1px solid rgba(255,255,255,0.04);">
          ${escapeHtml(group.hint)}
        </div>
      </div>
    </div>
  `;
}

/* ============================================
   新增 / 編輯
   ============================================ */
function _openAddModal(groupKey) {
  const group = GROUPS.find((g) => g.key === groupKey);
  if (!group) return;

  const titleEl = document.getElementById('db-dropdown-modal-title');
  if (titleEl) titleEl.textContent = `新增「${group.label}」`;

  const formRoot = document.getElementById('db-dropdown-modal-form-root');
  if (!formRoot) return;
  formRoot.innerHTML = '';

  const fields = group.type === 'value-label'
    ? [
        { type: 'text', id: 'dd-value', label: '值（英文 / 代碼）', required: true, placeholder: '例如：husband', maxlength: 40 },
        { type: 'text', id: 'dd-label', label: '顯示名稱', required: true, placeholder: '例如：老公 / 丈夫', maxlength: 40 },
      ]
    : [
        { type: 'text', id: 'dd-value', label: '名稱', required: true, placeholder: '例如：醫療類', maxlength: 40 },
      ];

  _editFormApi = buildForm({
    containerId: 'db-dropdown-modal-form-root',
    fields,
    submitText: '新增',
    showCancel: true,
    cancelText: '取消',
    beforeSubmit: (data) => _validateOption(group, data, null),
    onSubmit: async (data) => {
      const list = [...(_options[group.key] || [])];

      if (group.type === 'value-label') {
        list.push({
          value: (data['dd-value'] || '').trim(),
          label: (data['dd-label'] || '').trim(),
        });
      } else {
        list.push((data['dd-value'] || '').trim());
      }

      try {
        await _saveGroup(group.key, list);
        showToast('✅ 已新增', 'success');
        closeModal(EDIT_MODAL_ID);
      } catch (err) {
        showToast('新增失敗：' + err.message, 'error');
      }
    },
    onCancel: () => closeModal(EDIT_MODAL_ID),
  });

  openModal(EDIT_MODAL_ID);
  setTimeout(() => document.getElementById('dd-value')?.focus(), 100);
}

function _openEditModal(groupKey, index) {
  const group = GROUPS.find((g) => g.key === groupKey);
  if (!group) return;

  const list = _options[groupKey] || [];
  const item = list[index];
  if (item == null) return;

  const titleEl = document.getElementById('db-dropdown-modal-title');
  if (titleEl) titleEl.textContent = `編輯「${group.label}」`;

  const formRoot = document.getElementById('db-dropdown-modal-form-root');
  if (!formRoot) return;
  formRoot.innerHTML = '';

  const isValueLabel = group.type === 'value-label';

  const fields = isValueLabel
    ? [
        { type: 'text', id: 'dd-value', label: '值（英文 / 代碼）', required: true, maxlength: 40 },
        { type: 'text', id: 'dd-label', label: '顯示名稱', required: true, maxlength: 40 },
      ]
    : [
        { type: 'text', id: 'dd-value', label: '名稱', required: true, maxlength: 40 },
      ];

  const initialData = isValueLabel
    ? { 'dd-value': item.value || '', 'dd-label': item.label || '' }
    : { 'dd-value': item || '' };

  _editFormApi = buildForm({
    containerId: 'db-dropdown-modal-form-root',
    fields,
    submitText: '儲存',
    showCancel: true,
    cancelText: '取消',
    initialData,
    beforeSubmit: (data) => _validateOption(group, data, index),
    onSubmit: async (data) => {
      const newList = [...list];

      if (isValueLabel) {
        newList[index] = {
          value: (data['dd-value'] || '').trim(),
          label: (data['dd-label'] || '').trim(),
        };
      } else {
        newList[index] = (data['dd-value'] || '').trim();
      }

      try {
        await _saveGroup(groupKey, newList);
        showToast('✅ 已更新', 'success');
        closeModal(EDIT_MODAL_ID);
      } catch (err) {
        showToast('更新失敗：' + err.message, 'error');
      }
    },
    onCancel: () => closeModal(EDIT_MODAL_ID),
  });

  openModal(EDIT_MODAL_ID);
}

function _validateOption(group, data, index) {
  const value = (data['dd-value'] || '').trim();
  if (!value) {
    return { field: 'dd-value', message: group.type === 'value-label' ? '請填寫值' : '請填寫名稱' };
  }

  const list = _options[group.key] || [];

  if (group.type === 'value-label') {
    const label = (data['dd-label'] || '').trim();
    if (!label) return { field: 'dd-label', message: '請填寫顯示名稱' };
    if (list.some((x, i) => i !== index && x.value === value)) {
      return { field: 'dd-value', message: '此值已存在' };
    }
  } else {
    if (list.some((x, i) => i !== index && x === value)) {
      return { field: 'dd-value', message: '此名稱已存在' };
    }
  }

  return true;
}

/* ============================================
   刪除 / 排序
   ============================================ */
async function _handleDelete(groupKey, index) {
  const group = GROUPS.find((g) => g.key === groupKey);
  if (!group) return;

  const list = _options[groupKey] || [];
  const item = list[index];
  if (item == null) return;

  const displayName = group.type === 'value-label' ? (item.label || item.value) : item;

  const ok = await openConfirm(
    `確定要刪除「${displayName}」嗎？\n\n已使用此選項的舊資料不會被修改。`,
    { title: '刪除選項', okText: '刪除', okClass: 'btn-danger' }
  );
  if (!ok) return;

  const newList = list.filter((_, i) => i !== index);

  try {
    await _saveGroup(groupKey, newList);
    showToast('✅ 已刪除', 'success');
  } catch (err) {
    showToast('刪除失敗：' + err.message, 'error');
  }
}

async function _move(groupKey, index, direction) {
  const list = [...(_options[groupKey] || [])];
  const newIdx = direction === 'up' ? index - 1 : index + 1;
  if (newIdx < 0 || newIdx >= list.length) return;

  [list[index], list[newIdx]] = [list[newIdx], list[index]];

  try {
    await _saveGroup(groupKey, list);
  } catch (err) {
    showToast('排序失敗：' + err.message, 'error');
  }
}

/* ============================================
   儲存
   ============================================ */
async function _saveGroup(groupKey, newList) {
  const merged = { ..._options };
  merged[groupKey] = newList;

  await saveFamilyOptions(merged);
  _options = merged;
  _render();
}

/* ============================================
   銷毀
   ============================================ */
function _destroy() {
  if (_unsubOptions) {
    try { _unsubOptions(); } catch (e) { /* noop */ }
    _unsubOptions = null;
  }

  if (_listHandler && _container) {
    _container.querySelector('#db-dropdowns-list')?.removeEventListener('click', _listHandler);
    _listHandler = null;
  }
  if (_editFormApi) {
    try { _editFormApi.destroy(); } catch (e) { /* noop */ }
    _editFormApi = null;
  }

  document.getElementById(EDIT_MODAL_ID)?.remove();
}