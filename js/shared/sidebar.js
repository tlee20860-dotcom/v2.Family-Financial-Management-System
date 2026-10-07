// ============================================
// sidebar.js — 左側導覽選單（v101 重寫：分類摺疊）
// 位置：js/shared/sidebar.js
// ============================================
// v101 改動：
//   ✅ 改為 6~8 個分類群組（工作流）
//   ✅ 群組可獨立摺疊 + 狀態持久化
//   ✅ 成員子群組雙層摺疊
//   ✅ 當前頁面所在群組自動展開
//   ✅ 內部排序不變（成員依 order，選單依 sidebar-order）
//   ✅ 支援 destroy
// ============================================

import { listenMembers } from '../core/db.js';
import { escapeHtml, sortMembers } from '../core/utils.js';
import { STORAGE_KEYS } from '../config/constants.js';
import {
  getAllGroups,
  getGroupByHref,
  getMembersGroup,
  loadOpenGroupSet,
  saveOpenGroupSet,
  ensureGroupOpenFor,
} from './sidebar-groups.js';
import { sortByOrder, watchSidebarOrder, DEFAULT_ORDER } from './sidebar-order.js';

const ROLE_ICON = { husband: 'user', wife: 'user', child: 'user', other: 'user' };

/* ============================================
   Module 層級狀態
   ============================================ */
let _isMembersGroupOpen = null;
let _currentOrder = [...DEFAULT_ORDER];
let _currentMembers = [];
let _currentGroups = [];
let _activeHref = '';
let _unsubscribers = [];
let _eventsBound = false;
let _navEl = null;

/* ============================================
   對外主函式
   ============================================ */

/**
 * 渲染側邊欄
 * @param {string} containerId - 容器 ID（預設 'sidebar-root'）
 * @param {string} activeHref - 當前頁面 href
 */
export async function renderSidebar(containerId = 'sidebar-root', activeHref = '') {
  const root = document.getElementById(containerId);
  if (!root) return;

  _activeHref = activeHref;
  root.classList.add('sidebar');

  root.innerHTML = `
    <div class="sidebar-header">
      <div class="sidebar-logo">◈ FAMILY.FIN</div>
    </div>
    <nav class="sidebar-nav" id="sidebar-nav-inner"></nav>
  `;

  _navEl = root.querySelector('#sidebar-nav-inner');

  // 讀取成員群組展開狀態
  if (_isMembersGroupOpen === null) {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.MEMBERS_GROUP_OPEN);
      _isMembersGroupOpen = saved === 'true';
    } catch (e) {
      _isMembersGroupOpen = false;
    }
  }

  // 成員頁面 → 強制展開
  const isMemberPage =
    activeHref.includes('member-detail') || activeHref.includes('members.html');
  if (isMemberPage) _isMembersGroupOpen = true;

  // 讀取群組展開狀態
  _currentGroups = getAllGroups().map((g) => ({
    ...g,
    isOpen: false,
  }));
  const openSet = loadOpenGroupSet();
  ensureGroupOpenFor(openSet, activeHref);
  _currentGroups.forEach((g) => {
    g.isOpen = openSet.has(g.key);
  });
  saveOpenGroupSet(openSet);

  // 綁定全域事件（只綁一次）
  _bindGlobalEvents();

  // 監聽側邊欄排序
  const unsubOrder = watchSidebarOrder((order) => {
    _currentOrder = order;
    _renderNav();
  });
  _unsubscribers.push(unsubOrder);

  // 監聽成員
  const unsubMembers = listenMembers((members) => {
    _currentMembers = sortMembers(members);
    _renderNav();
  });
  _unsubscribers.push(unsubMembers);

  // 桌面版摺疊狀態
  try {
    const collapsed = localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED) === 'true';
    if (collapsed && window.innerWidth >= 640) root.classList.add('collapsed');
  } catch (e) { /* noop */ }
}

/* ============================================
   渲染導覽
   ============================================ */
function _renderNav() {
  if (!_navEl) return;

  const html = _currentGroups.map((g) => _renderGroup(g)).join('');
  _navEl.innerHTML = html;

  // 更新成員子群組顯示
  _updateMembersGroupUI();

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

/**
 * 渲染單一群組
 */
function _renderGroup(group) {
  const arrowIcon = group.isOpen ? 'chevron-down' : 'chevron-right';
  const openClass = group.isOpen ? 'open' : '';

  // 群組內項目（若為 members 群組，先插入成員子群組）
  let innerHtml = '';
  if (group.hasMembersSub) {
    innerHtml += _renderMembersSubGroup();
  }

  // 排序後的 items
  const sortedItems = sortByOrder(group.items || [], _currentOrder);
  innerHtml += sortedItems.map((item) => _renderNavItem(item)).join('');

  return `
    <div class="nav-group ${openClass}" data-group-key="${group.key}">
      <div class="nav-group-title collapsible ${openClass}" data-group-toggle="${group.key}">
        <span class="nav-group-label">
          <i data-lucide="${group.icon || 'folder'}" class="nav-group-icon"></i>
          <span>${escapeHtml(group.label)}</span>
        </span>
        <i data-lucide="${arrowIcon}" class="nav-group-arrow"></i>
      </div>
      <div class="nav-group-body" style="display:${group.isOpen ? 'block' : 'none'};">
        ${innerHtml}
      </div>
    </div>
  `;
}

/**
 * 渲染成員子群組（雙層摺疊）
 */
function _renderMembersSubGroup() {
  const openClass = _isMembersGroupOpen ? 'open' : '';
  const arrowIcon = _isMembersGroupOpen ? 'chevron-down' : 'chevron-right';

  const memberItems = _currentMembers.map((m) =>
    _renderNavItem({
      icon: ROLE_ICON[m.role] || 'user',
      label: m.name,
      href: `member-detail.html?id=${m.id}`,
    })
  ).join('');

  const manageItem = _renderNavItem({
    icon: 'plus',
    label: '管理成員',
    href: 'members.html',
  });

  return `
    <div class="nav-sub-group">
      <div class="nav-group-title collapsible nav-sub-title ${openClass}" data-members-toggle="1">
        <span class="nav-group-label">
          <i data-lucide="users" class="nav-group-icon"></i>
          <span>成員版面</span>
        </span>
        <i data-lucide="${arrowIcon}" class="nav-group-arrow"></i>
      </div>
      <div class="nav-sub" id="members-group-sub" style="display:${_isMembersGroupOpen ? 'block' : 'none'};">
        ${memberItems}
        ${manageItem}
      </div>
    </div>
  `;
}

/**
 * 渲染單一 nav item
 */
function _renderNavItem(item) {
  const isActive = item.href === _activeHref ? 'active' : '';
  return `
    <a class="nav-item ${isActive}" href="${item.href}">
      <i data-lucide="${item.icon}" class="nav-icon"></i>
      <span class="nav-label">${escapeHtml(item.label)}</span>
    </a>
  `;
}

/* ============================================
   全域事件綁定（module 層級）
   ============================================ */
function _bindGlobalEvents() {
  if (_eventsBound) return;
  _eventsBound = true;

  document.addEventListener('click', (e) => {
    // 群組標題點擊
    const groupToggle = e.target.closest('[data-group-toggle]');
    if (groupToggle) {
      e.preventDefault();
      _toggleGroup(groupToggle.dataset.groupToggle);
      return;
    }

    // 成員子群組點擊
    const membersToggle = e.target.closest('[data-members-toggle]');
    if (membersToggle) {
      e.preventDefault();
      _toggleMembersSub();
      return;
    }
  });
}

/* ============================================
   切換邏輯
   ============================================ */
function _toggleGroup(key) {
  const group = _currentGroups.find((g) => g.key === key);
  if (!group) return;

  group.isOpen = !group.isOpen;

  // 儲存展開狀態
  const openSet = new Set(
    _currentGroups.filter((g) => g.isOpen).map((g) => g.key)
  );
  saveOpenGroupSet(openSet);

  // 直接更新 DOM（避免整個重繪閃爍）
  const groupEl = _navEl.querySelector(`.nav-group[data-group-key="${key}"]`);
  if (!groupEl) {
    _renderNav();
    return;
  }

  const titleEl = groupEl.querySelector('.nav-group-title');
  const bodyEl = groupEl.querySelector('.nav-group-body');
  const arrowEl = titleEl.querySelector('.nav-group-arrow');

  if (group.isOpen) {
    groupEl.classList.add('open');
    titleEl.classList.add('open');
    if (bodyEl) bodyEl.style.display = 'block';
    if (arrowEl) arrowEl.setAttribute('data-lucide', 'chevron-down');
  } else {
    groupEl.classList.remove('open');
    titleEl.classList.remove('open');
    if (bodyEl) bodyEl.style.display = 'none';
    if (arrowEl) arrowEl.setAttribute('data-lucide', 'chevron-right');
  }

  if (window.lucide) window.lucide.createIcons();
}

function _toggleMembersSub() {
  _isMembersGroupOpen = !_isMembersGroupOpen;

  try {
    localStorage.setItem(STORAGE_KEYS.MEMBERS_GROUP_OPEN, String(_isMembersGroupOpen));
  } catch (e) { /* noop */ }

  _updateMembersGroupUI();
}

function _updateMembersGroupUI() {
  if (!_navEl) return;
  const sub = _navEl.querySelector('#members-group-sub');
  const title = _navEl.querySelector('.nav-sub-title');
  if (!sub || !title) return;

  if (_isMembersGroupOpen) {
    title.classList.add('open');
    sub.style.display = 'block';
  } else {
    title.classList.remove('open');
    sub.style.display = 'none';
  }

  const arrow = title.querySelector('.nav-group-arrow');
  if (arrow) {
    arrow.setAttribute('data-lucide', _isMembersGroupOpen ? 'chevron-down' : 'chevron-right');
    if (window.lucide) window.lucide.createIcons();
  }
}

/* ============================================
   對外 API
   ============================================ */

/**
 * 關閉手機側邊欄
 */
export function closeMobileSidebar() {
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) sidebar.classList.remove('mobile-open');
  const backdrop = document.querySelector('.sidebar-backdrop');
  if (backdrop) backdrop.classList.remove('active');
}

/**
 * 銷毀監聽
 */
export function destroySidebar() {
  _unsubscribers.forEach((fn) => {
    try { fn(); } catch (e) { /* noop */ }
  });
  _unsubscribers = [];
  _navEl = null;
}