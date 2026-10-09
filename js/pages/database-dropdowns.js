// ============================================
// database-dropdowns.js — 下拉選項（v103.0.0）
// 位置：js/pages/database-dropdowns.js
// ============================================
// v103.0.0：保留 v102 邏輯，僅更新 import 路徑
// ============================================
import { listenFamilyOptions, saveFamilyOptions } from '../core/db.js';
import { getOptions } from '../config/app-config.js';
import { esc } from '../lib/dom.js';
import { showToast } from '../ui/toast.js';
import { openModal, closeModal, openConfirm } from '../ui/modal.js';
import { buildForm } from '../ui/form-builder.js';
import { createListenerGroup } from '../shared/listener-group.js';

let _container = null;
let _options = {};
let _editFormApi = null;
let _listHandler = null;

const listenerGroup = createListenerGroup();
const EDIT_MODAL_ID = 'db-dropdown-edit-modal';

const GROUPS = [
  { key: 'memberRoles',            label: '成員角色',     icon: 'users',        type: 'value-label', hint: '用於成員的角色選項' },
  { key: 'policyTypes',            label: '保單類型',     icon: 'shield',       type: 'value-label', hint: '保險保單的類型（普通保險 / 基金保險）' },
  { key: 'insurancePaymentTypes',  label: '保險付款類型', icon: 'credit-card',  type: 'value-label', hint: '保單的付款方式（年繳 / 月繳 / 一次付款）' },
  { key: 'categoryOrder',          label: '類別順序',     icon: 'list-ordered', type: 'string',      hint: '年度報表中類別的顯示順序' },
];

export function initDropdownsTab(containerId) {
  _container = document.getElementById(containerId);
  if (!_container) return null;

  _container.innerHTML = `
    <div class="banner" style="margin-bottom:16px;">
      ℹ️ 此處集中管理全站的下拉選項，修改後會即時同步至相關頁面。
    </div>
    <div id="db-dropdowns-list" class="grid grid-2" style="gap:16px; align-items:start;"></div>
  `;

  _renderEditModal();
  _bindEvents();

  listenerGroup.add(listenFamilyOptions((data) => {
    _options = _normalizeOptions(data);
    _render();
  }));

  return { refresh: _render, destroy: _destroy };
}

function _renderEditModal() {
  document.getElementById(EDIT_MODAL_ID)?.remove();
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
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(EDIT_MODAL_ID); });
}

function _normalizeOptions(data) {
  const fb = {
    memberRoles: getOptions('memberRoles'),
    policyTypes: getOptions('policyTypes'),
    insurancePaymentTypes: getOptions('insurancePaymentTypes'),
    categoryOrder: getOptions('categoryOrder'),
  };
  if (!data || Object.keys(data).length === 0) return fb;
  return {
    memberRoles:           Array.isArray(data.memberRoles)           ? data.memberRoles           : fb.memberRoles,
    policyTypes:           Array.isArray(data.policyTypes)           ? data.policyTypes           : fb.policyTypes,
    insurancePaymentTypes: Array.isArray(data.insurancePaymentTypes) ? data.insurancePaymentTypes : fb.insurancePaymentTypes,
    categoryOrder:         Array.isArray(data.categoryOrder)         ? data.categoryOrder         : fb.categoryOrder,
  };
}

function _bindEvents() {
  const listEl = _container.querySelector('#db-dropdowns-list');
  if (!listEl) return;
  _listHandler = async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const { group, action, index } = btn.dataset;
    const idx = Number(index);
    if (action === 'add') _openAddModal(group);
    else if (action === 'edit') _openEditModal(group, idx);
    else if (action === 'delete') await _handleDelete(group, idx);
    else if (action === 'move-up') await _move(group, idx, 'up');
    else if (action === 'move-down') await _move(group, idx, 'down');
  };
  listEl.addEventListener('click', _listHandler);
}

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
      ? `<div style="font-weight:500;">${esc(item.label || '')}</div><div style="font-size:11px; color:var(--text-muted); font-family:var(--font-mono);">${esc(item.value || '')}</div>`
      : `<div style="font-weight:500;">${esc(item)}</div>`;
    return `
      <div style="display:flex; align-items:center; gap:8px; padding:8px 10px; border-bottom:1px solid rgba(255,255,255,0.04);">
        <div style="flex:1; min-width:0;">${mainText}</div>
        <div style="display:flex; gap:2px;">
          <button type="button" class="btn btn-sm btn-ghost" data-action="move-up" data-group="${group.key}" data-index="${i}" ${isFirst ? 'disabled' : ''} style="padding:2px 5px;"><i data-lucide="chevron-up" style="width:12px;height:12px;"></i></button>
          <button type="button" class="btn btn-sm btn-ghost" data-action="move-down" data-group="${group.key}" data-index="${i}" ${isLast ? 'disabled' : ''} style="padding:2px 5px;"><i data-lucide="chevron-down" style="width:12px;height:12px;"></i></button>
          <button type="button" class="btn btn-sm btn-ghost" data-action="edit" data-group="${group.key}" data-index="${i}">編輯</button>
          <button type="button" class="btn btn-sm btn-danger" data-action="delete" data-group="${group.key}" data-index="${i}">刪除</button>
        </div>
      </div>
    `;
  }).join('');
  return `
    <div class="glass-card collapsible-card collapsible-card-flat">
      <div class="collapsible-header">
        <div class="collapsible-header-title">
          <i data-lucide="${group.icon}" style="width:16px;height:16px;"></i>
          <span>${esc(group.label)} <span class="text-muted" style="font-size:12px; margin-left:6px;">（${list.length}）</span></span>
        </div>
        <button type="button" class="btn btn-sm btn-ghost" data-action="add" data-group="${group.key}"><i data-lucide="plus" style="width:14px;height:14px;"></i> 新增</button>
      </div>
      <div class="collapsible-body" style="display:block; padding:0;">
        ${list.length === 0 ? `<div class="empty-state" style="padding:20px;">尚未設定</div>` : `<div>${rows}</div>`}
        <div style="padding:8px 12px; font-size:11px; color:var(--text-muted); border-top:1px solid rgba(255,255,255,0.04);">${esc(group.hint)}</div>
      </div>
    </div>
  `;
}

function _openAddModal(groupKey) {
  const group = GROUPS.find((g) => g.key === groupKey);
  if (!group) return;
  const titleEl = document.getElementById('db-dropdown-modal-title');
  if (titleEl) titleEl.textContent = `新增「${group.label}」`;
  const formRoot = document.getElementById('db-dropdown-modal-form-root');
  if (!formRoot) return;
  formRoot.innerHTML = '';

  const isVL = group.type === 'value-label';
  const fields = isVL
    ? [
        { type: 'text', id: 'dd-value', label: '值（英文 / 代碼）', required: true, maxlength: 40 },
        { type: 'text', id: 'dd-label', label: '顯示名稱', required: true, maxlength: 40 },
      ]
    : [{ type: 'text', id: 'dd-value', label: '名稱', required: true, maxlength: 40 }];

  _editFormApi = buildForm({
    containerId: 'db-dropdown-modal-form-root', fields,
    submitText: '新增', showCancel: true, cancelText: '取消',
    beforeSubmit: (d) => _validateOption(group, d, null),
    onSubmit: async (d) => {
      const list = [...(_options[group.key] || [])];
      if (isVL) list.push({ value: (d['dd-value'] || '').trim(), label: (d['dd-label'] || '').trim() });
      else list.push((d['dd-value'] || '').trim());
      try {
        await _saveGroup(group.key, list);
        showToast('✅ 已新增', 'success');
        closeModal(EDIT_MODAL_ID);
      } catch (err) { showToast('新增失敗：' + err.message, 'error'); }
    },
    onCancel: () => closeModal(EDIT_MODAL_ID),
  });
  openModal(EDIT_MODAL_ID);
}

function _openEditModal(groupKey, index) {
  const group = GROUPS.find((g) => g.key === groupKey);
  const list = _options[groupKey] || [];
  const item = list[index];
  if (!group || item == null) return;

  const titleEl = document.getElementById('db-dropdown-modal-title');
  if (titleEl) titleEl.textContent = `編輯「${group.label}」`;
  const formRoot = document.getElementById('db-dropdown-modal-form-root');
  if (!formRoot) return;
  formRoot.innerHTML = '';

  const isVL = group.type === 'value-label';
  const fields = isVL
    ? [
        { type: 'text', id: 'dd-value', label: '值（英文 / 代碼）', required: true, maxlength: 40 },
        { type: 'text', id: 'dd-label', label: '顯示名稱', required: true, maxlength: 40 },
      ]
    : [{ type: 'text', id: 'dd-value', label: '名稱', required: true, maxlength: 40 }];

  const initialData = isVL
    ? { 'dd-value': item.value || '', 'dd-label': item.label || '' }
    : { 'dd-value': item || '' };

  _editFormApi = buildForm({
    containerId: 'db-dropdown-modal-form-root', fields,
    submitText: '儲存', showCancel: true, cancelText: '取消',
    initialData,
    beforeSubmit: (d) => _validateOption(group, d, index),
    onSubmit: async (d) => {
      const newList = [...list];
      if (isVL) newList[index] = { value: (d['dd-value'] || '').trim(), label: (d['dd-label'] || '').trim() };
      else newList[index] = (d['dd-value'] || '').trim();
      try {
        await _saveGroup(groupKey, newList);
        showToast('✅ 已更新', 'success');
        closeModal(EDIT_MODAL_ID);
      } catch (err) { showToast('更新失敗：' + err.message, 'error'); }
    },
    onCancel: () => closeModal(EDIT_MODAL_ID),
  });
  openModal(EDIT_MODAL_ID);
}

function _validateOption(group, data, index) {
  const value = (data['dd-value'] || '').trim();
  if (!value) return { field: 'dd-value', message: group.type === 'value-label' ? '請填寫值' : '請填寫名稱' };
  const list = _options[group.key] || [];
  if (group.type === 'value-label') {
    const label = (data['dd-label'] || '').trim();
    if (!label) return { field: 'dd-label', message: '請填寫顯示名稱' };
    if (list.some((x, i) => i !== index && x.value === value)) return { field: 'dd-value', message: '此值已存在' };
  } else {
    if (list.some((x, i) => i !== index && x === value)) return { field: 'dd-value', message: '此名稱已存在' };
  }
  return true;
}

async function _handleDelete(groupKey, index) {
  const group = GROUPS.find((g) => g.key === groupKey);
  const list = _options[groupKey] || [];
  const item = list[index];
  if (item == null) return;
  const displayName = group.type === 'value-label' ? (item.label || item.value) : item;
  const ok = await openConfirm(`確定要刪除「${displayName}」嗎？\n\n已使用此選項的舊資料不會被修改。`, { title: '刪除選項', okText: '刪除', okClass: 'btn-danger' });
  if (!ok) return;
  try { await _saveGroup(groupKey, list.filter((_, i) => i !== index)); showToast('✅ 已刪除', 'success'); }
  catch (err) { showToast('刪除失敗：' + err.message, 'error'); }
}

async function _move(groupKey, index, direction) {
  const list = [...(_options[groupKey] || [])];
  const newIdx = direction === 'up' ? index - 1 : index + 1;
  if (newIdx < 0 || newIdx >= list.length) return;
  [list[index], list[newIdx]] = [list[newIdx], list[index]];
  try { await _saveGroup(groupKey, list); } catch (err) { showToast('排序失敗：' + err.message, 'error'); }
}

async function _saveGroup(groupKey, newList) {
  const merged = { ..._options };
  merged[groupKey] = newList;
  await saveFamilyOptions(merged);
  _options = merged;
  _render();
}

function _destroy() {
  listenerGroup.destroy();
  if (_listHandler && _container) {
    _container.querySelector('#db-dropdowns-list')?.removeEventListener('click', _listHandler);
    _listHandler = null;
  }
  if (_editFormApi) { try { _editFormApi.destroy(); } catch (e) {} _editFormApi = null; }
  document.getElementById(EDIT_MODAL_ID)?.remove();
  _container = null;
}
