// ============================================
// members.js — 成員清單（v101.3 只讀化）
// 位置：js/pages/members.js
// ============================================
// v101.3 修正：
//   ✅ 移除未使用的 renderDataCards / renderDataTable import（死 import）
//   ✅ 移除未使用的 _buildColumns() 函式
//   ✅ _renderQuickSummary 移除 async（無 await）
// ============================================

import { listenMembers } from '../core/db.js';
import { escapeHtml, sortMembers } from '../core/utils.js';
import { getOptions } from '../config/app-config.js';
import { initViewToggle } from '../shared/view-toggle.js';
import { renderQuickSummary } from '../shared/quick-summary.js';
import { QUICK_SUMMARY_TYPES } from '../config/constants.js';

/* ============================================
   Module 狀態
   ============================================ */
let _members = [];
let _unsubscribers = [];
let _viewToggle = null;

/* ============================================
   主入口
   ============================================ */
export async function initMembersPage() {
  // 初始化檢視切換
  _viewToggle = initViewToggle({
    containerId: 'view-toggle-root',
    storageKey: 'members-view',
    defaultView: 'card',
    cardText: '卡片',
    tableText: '表格',
    autoApply: false,
    onChange: () => _render(),
  });

  // 綁定「管理成員」按鈕
  document.getElementById('manage-members-btn')?.addEventListener('click', () => {
    window.location.href = 'database.html';
  });

  // 監聽成員
  _unsubscribers.push(
    listenMembers((list) => {
      _members = sortMembers(list);
      _render();
    })
  );

  return {
    destroy: _destroy,
  };
}

/* ============================================
   渲染
   ============================================ */
function _render() {
  const view = _viewToggle?.getView() || 'card';

  if (view === 'card') {
    _renderCards();
  } else {
    _renderTable();
  }

  _renderQuickSummary();
  _renderCount();
}

/* ============================================
   卡片模式
   ============================================ */
function _renderCards() {
  const cardEl = document.getElementById('members-card-view');
  const tableEl = document.getElementById('members-table-view');
  if (!cardEl || !tableEl) return;

  cardEl.style.display = 'block';
  tableEl.style.display = 'none';

  if (_members.length === 0) {
    cardEl.innerHTML = `
      <div class="glass-card">
        <div class="empty-state">
          <i data-lucide="users" style="width:48px;height:48px;opacity:0.4;"></i>
          <p style="margin-top:12px;">尚無成員</p>
          <button class="btn btn-primary" onclick="window.location.href='database.html'" style="margin-top:12px;">
            <i data-lucide="plus"></i> 新增成員
          </button>
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  const roleMap = _buildRoleMap();

  cardEl.innerHTML = `
    <div class="grid grid-3" id="members-grid">
      ${_members.map((m) => _renderCard(m, roleMap)).join('')}
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
}

function _renderCard(m, roleMap) {
  const roleLabel = roleMap[m.role] || m.role || '其他';

  return `
    <div class="glass-card" style="position:relative;">
      <div class="glass-card-title">${escapeHtml(roleLabel)}</div>
      <div class="glass-card-value" style="word-break:break-word;">${escapeHtml(m.name)}</div>
      <div style="margin-top:14px;">
        <a class="btn btn-sm" href="member-detail.html?id=${m.id}" style="width:100%; justify-content:center;">
          <i data-lucide="arrow-right" style="width:14px;height:14px;"></i>
          進入版面
        </a>
      </div>
    </div>
  `;
}

/* ============================================
   表格模式
   ============================================ */
function _renderTable() {
  const cardEl = document.getElementById('members-card-view');
  const tableEl = document.getElementById('members-table-view');
  if (!cardEl || !tableEl) return;

  cardEl.style.display = 'none';
  tableEl.style.display = 'block';

  const roleMap = _buildRoleMap();

  if (_members.length === 0) {
    tableEl.innerHTML = `
      <div class="glass-card">
        <div class="empty-state">尚無成員</div>
      </div>
    `;
    return;
  }

  tableEl.innerHTML = `
    <div class="glass-card collapsible-card collapsible-card-flat" style="padding:0;">
      <div style="overflow-x:auto;">
        <table class="data-table mobile-cards">
          <thead>
            <tr>
              <th>名稱</th>
              <th>角色</th>
              <th style="width:140px;">操作</th>
            </tr>
          </thead>
          <tbody>
            ${_members.map((m) => `
              <tr>
                <td data-primary="1">${escapeHtml(m.name)}</td>
                <td data-label="角色">
                  <span class="badge badge-info">${escapeHtml(roleMap[m.role] || m.role || '其他')}</span>
                </td>
                <td data-label="操作">
                  <a class="btn btn-sm" href="member-detail.html?id=${m.id}">進入版面</a>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   快速摘要（成員概覽）
   ============================================ */
function _renderQuickSummary() {
  const root = document.getElementById('quick-summary-root');
  if (!root) return;

  if (_members.length === 0) {
    root.innerHTML = '';
    return;
  }

  const roleMap = _buildRoleMap();
  const items = _members.map((m) => ({
    key: m.id,
    title: m.name,
    subtitle: roleMap[m.role] || m.role || '其他',
    amount: null,
    badge: '',
  }));

  renderQuickSummary({
    containerId: 'quick-summary-root',
    type: QUICK_SUMMARY_TYPES.RECENT_ACTIVITY,
    title: '成員概覽',
    icon: 'users',
    data: items,
    onClick: (key) => {
      window.location.href = `member-detail.html?id=${key}`;
    },
  });
}

/* ============================================
   工具
   ============================================ */
function _buildRoleMap() {
  const roles = getOptions('memberRoles');
  const map = {};
  roles.forEach((r) => { map[r.value] = r.label; });
  return map;
}

function _renderCount() {
  const el = document.getElementById('members-count');
  if (el) el.textContent = `（共 ${_members.length} 位）`;
}

/* ============================================
   銷毀
   ============================================ */
function _destroy() {
  _unsubscribers.forEach((fn) => {
    try { fn(); } catch (e) { /* noop */ }
  });
  _unsubscribers = [];
  if (_viewToggle) {
    try { _viewToggle.destroy(); } catch (e) { /* noop */ }
    _viewToggle = null;
  }
}
