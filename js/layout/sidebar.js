// ============================================
// sidebar.js — 左側導覽選單（v103.0.0）
// 位置：js/layout/sidebar.js
// ============================================
// v103.0.0 重構：
//   ✅ 從 js/shared/sidebar.js + sidebar-groups.js 合併
//   ✅ 逸出改用 lib/dom.js 的 esc()
//   ✅ SIDEBAR_GROUPS 從 constants.js 讀取（SSOT）
//   ✅ 暴露 toggleSidebar / openMobileSidebar / closeMobileSidebar
//   ✅ 從 STORAGE_KEYS 讀取 SIDEBAR_COLLAPSED / SIDEBAR_GROUPS
// ============================================

import { SIDEBAR_GROUPS, STORAGE_KEYS } from '../config/constants.js';
import { esc } from '../lib/dom.js';

/* ============================================
   Module 狀態
   ============================================ */
let _currentGroups = [];
let _activeHref = '';
let _eventsBound = false;
let _navEl = null;

/* ============================================
   主入口
   ============================================ */
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

  _currentGroups = SIDEBAR_GROUPS.map((g) => ({
    ...g,
    isOpen: false,
  }));

  const openSet = _loadOpenGroupSet();
  _ensureGroupOpenFor(openSet, activeHref);
  _currentGroups.forEach((g) => {
    g.isOpen = openSet.has(g.key);
  });
  _saveOpenGroupSet(openSet);

  _bindGlobalEvents();
  _renderNav();

  try {
    const collapsed = localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED) === 'true';
    if (collapsed && window.innerWidth >= 640) root.classList.add('collapsed');
  } catch (e) { /* noop */ }
}

/* ============================================
   渲染
   ============================================ */
function _renderNav() {
  if (!_navEl) return;

  const html = _currentGroups.map((g) => _renderGroup(g)).join('');
  _navEl.innerHTML = html;

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function _renderGroup(group) {
  const arrowIcon = group.isOpen ? 'chevron-down' : 'chevron-right';
  const openClass = group.isOpen ? 'open' : '';

  const innerHtml = (group.items || []).map((item) => _renderNavItem(item)).join('');

  return `
    <div class="nav-group ${openClass}" data-group-key="${esc(group.key)}">
      <div class="nav-group-title collapsible ${openClass}" data-group-toggle="${esc(group.key)}">
        <span class="nav-group-label">
          <i data-lucide="${esc(group.icon || 'folder')}" class="nav-group-icon"></i>
          <span>${esc(group.label)}</span>
        </span>
        <i data-lucide="${arrowIcon}" class="nav-group-arrow"></i>
      </div>
      <div class="nav-group-body" style="display:${group.isOpen ? 'block' : 'none'};">
        ${innerHtml}
      </div>
    </div>
  `;
}

function _renderNavItem(item) {
  const isActive = item.href === _activeHref ? 'active' : '';
  return `
    <a class="nav-item ${isActive}" href="${esc(item.href)}">
      <i data-lucide="${esc(item.icon)}" class="nav-icon"></i>
      <span class="nav-label">${esc(item.label)}</span>
    </a>
  `;
}

/* ============================================
   事件綁定
   ============================================ */
function _bindGlobalEvents() {
  if (_eventsBound) return;
  _eventsBound = true;

  document.addEventListener('click', _globalClickHandler);
}

function _globalClickHandler(e) {
  /* ---------- 群組展開 / 收合 ---------- */
  const groupToggle = e.target.closest('[data-group-toggle]');
  if (groupToggle) {
    e.preventDefault();
    _toggleGroup(groupToggle.dataset.groupToggle);
    return;
  }

  /* ---------- Backdrop 點擊 → 關閉行動版 ---------- */
  if (e.target.classList.contains('sidebar-backdrop')) {
    closeMobileSidebar();
    return;
  }

  /* ---------- Nav 項目點擊（手機）→ 自動關閉 ---------- */
  const navLink = e.target.closest('.sidebar .nav-item');
  if (navLink) {
    if (window.innerWidth < 640) {
      closeMobileSidebar();
    }
    return;
  }
}

function _toggleGroup(key) {
  const group = _currentGroups.find((g) => g.key === key);
  if (!group) return;

  group.isOpen = !group.isOpen;

  const openSet = new Set(
    _currentGroups.filter((g) => g.isOpen).map((g) => g.key)
  );
  _saveOpenGroupSet(openSet);

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

/* ============================================
   Sidebar 開關（公開 API）
   ============================================ */

/**
 * 切換 Sidebar 狀態
 * - 手機：開 / 關抽屜
 * - 桌面：展開 / 收合
 */
export function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;

  if (window.innerWidth < 640) {
    const isOpen = sidebar.classList.contains('mobile-open');
    if (isOpen) closeMobileSidebar();
    else openMobileSidebar();
  } else {
    sidebar.classList.toggle('collapsed');
    try {
      localStorage.setItem(
        STORAGE_KEYS.SIDEBAR_COLLAPSED,
        String(sidebar.classList.contains('collapsed'))
      );
    } catch (err) { /* noop */ }
  }
}

/**
 * 開啟手機版抽屜
 */
export function openMobileSidebar() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;
  sidebar.classList.add('mobile-open');

  let backdrop = document.querySelector('.sidebar-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'sidebar-backdrop';
    document.body.appendChild(backdrop);
  }
  backdrop.classList.add('active');
}

/**
 * 關閉手機版抽屜
 */
export function closeMobileSidebar() {
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) sidebar.classList.remove('mobile-open');

  const backdrop = document.querySelector('.sidebar-backdrop');
  if (backdrop) backdrop.classList.remove('active');
}

/* ============================================
   銷毀
   ============================================ */
export function destroySidebar() {
  _navEl = null;

  if (_eventsBound) {
    document.removeEventListener('click', _globalClickHandler);
    _eventsBound = false;
  }

  closeMobileSidebar();

  _currentGroups = [];
  _activeHref = '';
}

/* ============================================
   內部：展開狀態管理（原 sidebar-groups.js 邏輯）
   ============================================ */

function _loadOpenGroupSet() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SIDEBAR_GROUPS);
    if (!raw) return _getDefaultOpenSet();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return _getDefaultOpenSet();
    return new Set(arr);
  } catch (e) {
    return _getDefaultOpenSet();
  }
}

function _saveOpenGroupSet(set) {
  try {
    localStorage.setItem(STORAGE_KEYS.SIDEBAR_GROUPS, JSON.stringify([...set]));
  } catch (e) { /* noop */ }
}

function _getDefaultOpenSet() {
  const set = new Set();
  SIDEBAR_GROUPS.forEach((g) => {
    if (g.defaultOpen) set.add(g.key);
  });
  return set;
}

function _ensureGroupOpenFor(set, activeHref) {
  if (!activeHref) return set;
  const g = SIDEBAR_GROUPS.find((group) =>
    (group.items || []).some((it) => it.href === activeHref)
  );
  if (g) set.add(g.key);
  return set;
}
