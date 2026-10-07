// ============================================
// tab-members.js — 基礎資料庫：成員 Tab（v101.5）
// 位置：js/pages/database/tab-members.js
// ============================================
// v101.5 修正：
//   ✅ 新增 / 編輯改用 entity-modal（讀取 entity-definitions.js）
//   ✅ 表單欄位改由 SSOT 提供
//   ✅ 刪除使用 entity-helpers 的 deleteEntity
//   ✅ 使用 registerPageCleanup 註冊清理
// ============================================

import {
  listenMembers, updateMemberOrders,
} from '../../core/db.js';
import { getOptions } from '../../config/app-config.js';
import { escapeHtml, sortMembers } from '../../core/utils.js';
import { showToast } from '../../shared/toast.js';
import { openConfirm } from '../../shared/modal.js';
import { openEntityModal } from '../../shared/entity-modal.js';
import { deleteEntity } from '../../shared/entity-helpers.js';
import { ENTITY_KEYS } from '../../config/constants.js';

/* ============================================
   Module 狀態
   ============================================ */
let _container = null;
let _members = [];
let _unsubMembers = null;
let _listClickHandler = null;
let _addBtnHandler = null;

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

  _unsubMembers = listenMembers((list) => {
    _members = sortMembers(list);
    _render();
  });

  _bindListEvents();
  _bindAddButton();

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
    <div class="flex flex-between items-center flex-wrap gap-12 mb-16">
      <div class="text-muted" style="font-size:13px;">管理家庭成員（名稱、角色、排序）</div>
      <button class="btn btn-primary" id="db-members-add-btn">
        <i data-lucide="plus"></i> 新增成員
      </button>
    </div>

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
   新增按鈕
   ============================================ */
function _bindAddButton() {
  const btn = document.getElementById('db-members-add-btn');
  if (!btn) return;

  _addBtnHandler = () => {
    openEntityModal({
      entity: ENTITY_KEYS.MEMBER,
      mode: 'add',
      allRows: _members,
    });
  };
  btn.addEventListener('click', _addBtnHandler);
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
    listEl.innerHTML = `<div class="empty-state">尚無成員，請點擊上方「新增成員」</div>`;
    return;
  }

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

  _listClickHandler = async (e) => {
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
  };

  listEl.addEventListener('click', _listClickHandler);
}

function _openEditModal(member) {
  openEntityModal({
    entity: ENTITY_KEYS.MEMBER,
    mode: 'edit',
    id: member.id,
    allRows: _members,
  });
}

async function _handleDelete(member) {
  const ok = await openConfirm(
    `⚠️ 確定要刪除成員「${member.name}」嗎？\n\n這將會一併刪除該成員在所有月份的所有支出紀錄（含保險平攤），此操作無法復原。`,
    { title: '刪除成員', okText: '刪除', okClass: 'btn-danger' }
  );
  if (!ok) return;

  try {
    await deleteEntity(ENTITY_KEYS.MEMBER, member.id);
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
  if (_unsubMembers) {
    try { _unsubMembers(); } catch (e) { /* noop */ }
    _unsubMembers = null;
  }
  if (_listClickHandler) {
    const listEl = document.getElementById('db-members-list');
    listEl?.removeEventListener('click', _listClickHandler);
    _listClickHandler = null;
  }
  if (_addBtnHandler) {
    const btn = document.getElementById('db-members-add-btn');
    btn?.removeEventListener('click', _addBtnHandler);
    _addBtnHandler = null;
  }
}