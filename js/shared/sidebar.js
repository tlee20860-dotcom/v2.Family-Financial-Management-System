// ============================================
// sidebar.js — 左側導覽選單（v102.0.0）
// 位置：js/shared/sidebar.js
// ============================================
// v102.0.0 修正：
//   ✅ 版本號更新（無功能變更）
//   ✅ 側邊欄項目名稱由 constants.js 統一控制（「銀行交易」）
// ============================================

import { escapeHtml } from '../core/utils.js';
import { STORAGE_KEYS } from '../config/constants.js';
import {
  getAllGroups,
  getGroupByHref,
  loadOpenGroupSet,
  saveOpenGroupSet,
  ensureGroupOpenFor,
} from './sidebar-groups.js';

let _currentGroups = [];
let _activeHref = '';
let _eventsBound = false;
let _navEl = null;

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

  _bindGlobalEvents();
  _renderNav();

  try {
    const collapsed = localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED) === 'true';
    if (collapsed && window.innerWidth >= 640) root.classList.add('collapsed');
  } catch (e) { /* noop */ }
}

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

function _renderNavItem(item) {
  const isActive = item.href === _activeHref ? 'active' : '';
  return `
    <a class="nav-item ${isActive}" href="${item.href}">
      <i data-lucide="${item.icon}" class="nav-icon"></i>
      <span class="nav-label">${escapeHtml(item.label)}</span>
    </a>
  `;
}

function _bindGlobalEvents() {
  if (_eventsBound) return;
  _eventsBound = true;
  document.addEventListener('click', _globalClickHandler);
}

function _globalClickHandler(e) {
  const groupToggle = e.target.closest('[data-group-toggle]');
  if (groupToggle) {
    e.preventDefault();
    _toggleGroup(groupToggle.dataset.groupToggle);
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
  saveOpenGroupSet(openSet);

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

export function closeMobileSidebar() {
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) sidebar.classList.remove('mobile-open');
  const backdrop = document.querySelector('.sidebar-backdrop');
  if (backdrop) backdrop.classList.remove('active');
}

export function destroySidebar() {
  _navEl = null;

  if (_eventsBound) {
    document.removeEventListener('click', _globalClickHandler);
    _eventsBound = false;
  }
}