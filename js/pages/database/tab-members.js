// ============================================
// tab-members.js — 基礎資料庫：成員 Tab（v101）
// 位置：js/pages/database/tab-members.js
// ============================================
// 功能：成員的新增 / 編輯 / 刪除 / 排序 / 角色
// ============================================

import {
  listenMembers, addMember, updateMember, removeMember,
  updateMemberOrders, deleteMemberAndData,
} from '../../core/db.js';
import { getOptions } from '../../config/app-config.js';
import { escapeHtml, sortMembers } from '../../core/utils.js';
import { showToast } from '../../shared/toast.js';
import { openModal, closeModal, openConfirm } from '../../shared/modal.js';
import { buildForm } from '../../shared/form-builder.js';

/* ============================================
   Module 狀態
   ============================================ */
let _container = null;
let _members = [];
let _formApi = null;
let _editingId = null;
let _unsubscribers = [];

const MODAL_ID = 'db-member-modal';

/* ============================================
   主入口
   ============================================ */
export function initMembersTab(containerId) {
  _container = document.getElementById(containerId);
  if (!_container) {
    console.warn(`⚠️ initMembersTab: 找不到容器 #${containerId}`);
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
    <div id="db-members-form-root" class="mb-16"></div>

    <div class="glass-card collapsible-card collapsible-card-flat" id="db-members-list-card">
      <div class="collapsible-header" id="db-members-list-header">
        <div class="collapsible-header-title">
          <i data-lucide="users" style="width:16px;height:16px;"></i>
          <span>成員清單 <span class="text-muted" id="db-members-count" style="font-size:12px; margin-left:6px;"></span></span>
        </div>
        <i data-lucide="chevron-down" class="collapsible-arrow"></i>
      </div>
      <div class="collapsible-body" style="display:block;">
        <div id="db-members-list"></div>
      </div>
    </div>
  `;
}

/* ============================================
   新增表單
   ============================================ */
function _renderForm() {
  const roleOptions = getOptions('memberRoles');

  _formApi = buildForm({
    containerId: 'db-members-form-root',
    fields: [
      { type: 'text',   id: 'db-mem-name', label: '名稱', required: true, placeholder: '例如：老公、梓舜', maxlength: 20 },
      { type: 'select', id: 'db-mem-role', label: '角色', required: true, includeEmpty: false, options: roleOptions },
    ],
    submitText: '新增成員',
    showCancel: false,
    showReset: true,
    resetText: '重置',
    onSubmit: _handleAdd,
  });
}

async function _handleAdd(data) {
  const name = (data['db-mem-name'] || '').trim();
  const role = data['db-mem-role'];
  if (!name) {
    return { field: 'db-mem-name', message: '請填寫名稱' };
  }

  const maxOrder = _members.reduce(
    (max, m) => Math.max(max, m.order != null ? m.order : -1),
    -1
  );

  try {
    await addMember({ name, role, order: maxOrder + 1 });
    showToast(`✅ 已新增成員「${name}」`, 'success');
    _formApi.reset();
  } catch (err) {
    showToast('新增失敗：' + err.message, 'error');
  }
}

/* ============================================
   編輯 Modal
   ============================================ */
function _renderModal() {
  const roleOptions = getOptions('memberRoles');

  // 若已存在 → 移除
  const existing = document.getElementById(MODAL_ID);
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = MODAL_ID;
  overlay.innerHTML = `
    <div class="modal">
      <h2 class="modal-title" id="db-member-modal-title">編輯成員</h2>
      <div id="db-member-modal-form-root"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  // 建立 Modal 內的表單
  const modalForm = buildForm({
    containerId: 'db-member-modal-form-root',
    fields: [
      { type: 'text',   id: 'db-mem-edit-name', label: '名稱', required: true, maxlength: 20 },
      { type: 'select', id: 'db-mem-edit-role', label: '角色', required: true, includeEmpty: false, options: roleOptions },
    ],
    submitText: '儲存',
    showCancel: true,
    cancelText: '取消',
    onSubmit: _handleEdit,
    onCancel: () => closeModal(MODAL_ID),
  });

  // 儲存供後續使用
  overlay._formApi = modalForm;

  // Backdrop + ESC
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(MODAL_ID);
  });
}

async function _handleEdit(data) {
  if (!_editingId) return;

  const name = (data['db-mem-edit-name'] || '').trim();
  const role = data['db-mem-edit-role'];
  if (!name) {
    return { field: 'db-mem-edit-name', message: '請填寫名稱' };
  }

  try {
    await updateMember(_editingId, { name, role });
    showToast('✅ 已更新成員', 'success');
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
    listenMembers((list) => {
      _members = sortMembers(list);
      _render();
    })
  );
}

/* ============================================
   渲染清單
   ============================================ */
function _render() {
  const listEl = document.getElementById('db-members-list');
  const countEl = document.getElementById('db-members-count');
  if (!listEl) return;

  if (countEl) countEl.textContent = `（共 ${_members.length} 位）`;

  if (_members.length === 0) {
    listEl.innerHTML = `<div class="empty-state">尚無成員，請從上方新增</div>`;
    return;
  }

  const roleMap = _getRoleMap();

  listEl.innerHTML = `
    <div style="overflow-x:auto;">
      <table class="data-table mobile-cards">
        <thead>
          <tr>
            <th style="width:60px;">排序</th>
            <th>名稱</th>
            <th style="width:120px;">角色</th>
            <th style="width:180px;">操作</th>
          </tr>
        </thead>
        <tbody>
          ${_members.map((m, i) => _renderRow(m, i)).join('')}
        </tbody>
      </table>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
}

function _renderRow(m, index) {
  const roleMap = _getRoleMap();
  const roleLabel = roleMap[m.role] || m.role || '其他';
  const isFirst = index === 0;
  const isLast = index === _members.length - 1;

  return `
    <tr data-id="${m.id}">
      <td data-label="排序">
        <div style="display:flex; gap:4px; align-items:center;">
          <button class="btn btn-sm btn-ghost" data-action="move-up" data-id="${m.id}"
            ${isFirst ? 'disabled' : ''} title="上移"
            style="padding:2px 6px; line-height:1;">
            <i data-lucide="chevron-up" style="width:14px;height:14px;"></i>
          </button>
          <button class="btn btn-sm btn-ghost" data-action="move-down" data-id="${m.id}"
            ${isLast ? 'disabled' : ''} title="下移"
            style="padding:2px 6px; line-height:1;">
            <i data-lucide="chevron-down" style="width:14px;height:14px;"></i>
          </button>
        </div>
      </td>
      <td data-primary="1">${escapeHtml(m.name)}</td>
      <td data-label="角色">
        <span class="badge badge-info">${escapeHtml(roleLabel)}</span>
      </td>
      <td data-label="操作">
        <button class="btn btn-sm btn-ghost" data-action="edit" data-id="${m.id}">編輯</button>
        <button class="btn btn-sm btn-danger" data-action="delete" data-id="${m.id}">刪除</button>
      </td>
    </tr>
  `;
}

function _getRoleMap() {
  const roles = getOptions('memberRoles');
  const map = {};
  roles.forEach((r) => { map[r.value] = r.label; });
  return map;
}

/* ============================================
   清單事件
   ============================================ */
function _bindListEvents() {
  const listEl = document.getElementById('db-members-list');
  if (!listEl) return;

  listEl.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const id = btn.dataset.id;
    const action = btn.dataset.action;
    const member = _members.find((m) => m.id === id);
    if (!member) return;

    switch (action) {
      case 'edit':
        _openEditModal(member);
        break;
      case 'delete':
        await _handleDelete(member);
        break;
      case 'move-up':
        await _moveMember(id, 'up');
        break;
      case 'move-down':
        await _moveMember(id, 'down');
        break;
    }
  });
}

function _openEditModal(member) {
  _editingId = member.id;

  const overlay = document.getElementById(MODAL_ID);
  if (!overlay || !overlay._formApi) return;

  overlay._formApi.setData({
    'db-mem-edit-name': member.name || '',
    'db-mem-edit-role': member.role || 'other',
  });

  openModal(MODAL_ID);
  setTimeout(() => {
    document.getElementById('db-mem-edit-name')?.focus();
  }, 100);
}

async function _handleDelete(member) {
  const ok = await openConfirm(
    `⚠️ 確定要刪除成員「${member.name}」嗎？\n\n這將會一併刪除該成員在所有月份的所有支出紀錄（含保險平攤），此操作無法復原。`,
    { title: '刪除成員', okText: '刪除', okClass: 'btn-danger' }
  );
  if (!ok) return;

  try {
    await deleteMemberAndData(member.id);
    showToast('✅ 成員與相關紀錄已徹底刪除', 'success');
  } catch (err) {
    showToast('刪除失敗：' + err.message, 'error');
  }
}

async function _moveMember(memberId, direction) {
  const sorted = [..._members];
  const idx = sorted.findIndex((m) => m.id === memberId);
  if (idx < 0) return;

  const newIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (newIdx < 0 || newIdx >= sorted.length) return;

  [sorted[idx], sorted[newIdx]] = [sorted[newIdx], sorted[idx]];

  const orderMap = {};
  sorted.forEach((m, i) => { orderMap[m.id] = i; });

  try {
    await updateMemberOrders(orderMap);
  } catch (err) {
    console.error('更新成員順序失敗：', err);
    showToast('調整順序失敗，請稍後再試。', 'error');
  }
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

  // 移除 Modal
  const overlay = document.getElementById(MODAL_ID);
  if (overlay) {
    if (overlay._formApi) overlay._formApi.destroy();
    overlay.remove();
  }
}