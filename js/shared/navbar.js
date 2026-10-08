// ============================================
// navbar.js — 頂部導覽列（v101.9.0）
// 位置：js/shared/navbar.js
// ============================================
// v101.9.0 新增：
//   ✅ 年月選擇器（依 activeHref 顯示 / 隱藏）
//   ✅ 顯示頁面：insurance / portfolio / settlements /
//                finance-overview / member-report
//   ✅ 桌面版顯示「2024 年」「9 月」，手機版精簡「2024」「9」
//   ✅ 切換時觸發 AppState.setYearMonth → ym-change 事件
//   ✅ 監聽 ym-change 事件同步 UI
// ============================================

import { AppState } from '../core/state.js';
import { getDisplayName } from '../core/auth.js';
import { STORAGE_KEYS } from '../config/constants.js';
import { getYearList } from '../config/app-config.js';
import { escapeHtml } from '../core/utils.js';

let _eventBound = false;
let _unsubscribeUserChange = null;
let _unsubscribeFamilyChange = null;
let _unsubscribeMemberAccountChange = null;
let _unsubscribeYMChange = null;
let _currentActiveHref = '';

/* ============================================
   🆕 v101.9.0：顯示年月選擇器的頁面
   ============================================ */
const SHOW_YEAR_MONTH_PAGES = [
  'insurance.html',
  'portfolio.html',
  'settlements.html',
  'finance-overview.html',
  'member-report.html',
];

/* ============================================
   渲染頂部導覽列
   ============================================ */
export function renderNavbar(containerId = 'navbar-root', title = '', activeHref = '') {
  const root = document.getElementById(containerId);
  if (!root) return;

  _currentActiveHref = activeHref;

  root.classList.add('navbar');
  const isSuper = AppState.isSuperAdmin;

  const adminBtn = isSuper
    ? `<a href="admin.html" class="btn btn-sm btn-ghost" title="平台管理" style="padding:6px 10px;">
         <i data-lucide="settings" style="width:16px;height:16px;"></i>
       </a>`
    : '';

  // 🆕 v101.9.0：判斷是否顯示年月選擇器
  const showYearMonth = SHOW_YEAR_MONTH_PAGES.includes(activeHref);
  const yearMonthHtml = showYearMonth ? `<div id="navbar-year-month" class="navbar-year-month"></div>` : '';

  root.innerHTML = `
    <button type="button" class="hamburger" id="hamburger-btn" aria-label="切換選單">
      <i data-lucide="menu"></i>
    </button>
    <div class="navbar-title">${title || ''}</div>
    ${yearMonthHtml}
    ${adminBtn}
    <div class="navbar-user" id="navbar-user"></div>
  `;

  _renderUserInfo();

  // 🆕 v101.9.0：渲染年月選擇器
  if (showYearMonth) {
    _renderYearMonth();
  }

  if (!_eventBound) {
    _eventBound = true;
    _bindGlobalEvents();
  }
}

/* ============================================
   🆕 v101.9.0：年月選擇器
   ============================================ */
function _renderYearMonth() {
  const box = document.getElementById('navbar-year-month');
  if (!box) return;

  const { year, month } = AppState.getYearMonth();
  const years = getYearList();

  // 年份選項
  let yearOpts = '';
  years.forEach((y) => {
    const sel = String(y) === String(year) ? 'selected' : '';
    yearOpts += `<option value="${y}" ${sel}>${y} 年</option>`;
  });

  // 月份選項（含「全部」）
  let monthOpts = `<option value="all" ${month === 'all' ? 'selected' : ''}>全部</option>`;
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    const sel = mm === String(month) ? 'selected' : '';
    monthOpts += `<option value="${mm}" ${sel}>${m} 月</option>`;
  }

  box.innerHTML = `
    <select class="navbar-ym-select navbar-ym-year" data-ym="year" aria-label="年份">
      ${yearOpts}
    </select>
    <select class="navbar-ym-select navbar-ym-month" data-ym="month" aria-label="月份">
      ${monthOpts}
    </select>
  `;

  // 綁定 change 事件
  box.querySelectorAll('.navbar-ym-select').forEach((sel) => {
    sel.addEventListener('change', () => {
      const ySel = box.querySelector('[data-ym="year"]');
      const mSel = box.querySelector('[data-ym="month"]');
      AppState.setYearMonth(ySel.value, mSel.value);
    });
  });

  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   使用者資訊
   ============================================ */
function _renderUserInfo() {
  const box = document.getElementById('navbar-user');
  if (!box) return;

  const user = AppState.currentUser;
  if (!user) {
    box.innerHTML = '';
    return;
  }

  const displayName = AppState.getDisplayName() || getDisplayName(user);
  const familyName = AppState.getFamilyName();
  const role = AppState.getRole();
  const canInput = AppState.getCanInput();

  const familyTag = familyName ? ` · ${familyName}` : '';

  let roleBadge = '';
  if (role === 'superadmin') {
    roleBadge = ' <span class="badge badge-magenta" style="font-size:10px;">超級管理員</span>';
  } else if (role === 'owner') {
    roleBadge = ' <span class="badge badge-info" style="font-size:10px;">👑</span>';
  } else if (role === 'member') {
    roleBadge = ' <span class="badge badge-muted" style="font-size:10px;">成員</span>';
  }

  const readonlyBadge = (!canInput && role !== 'superadmin')
    ? ' <span class="badge badge-pending" style="font-size:10px;">唯讀</span>'
    : '';

  box.innerHTML = `
    <span class="mono navbar-user-text" style="font-size:12px; color:var(--text-muted); margin-right:10px;">
      👤 ${_escape(displayName)}${familyTag}${roleBadge}${readonlyBadge}
    </span>
  `;
}

function _escape(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

/* ============================================
   全域事件
   ============================================ */
function _bindGlobalEvents() {
  document.addEventListener('click', (e) => {
    /* ---------- 1. 漢堡按鈕 ---------- */
    if (e.target.closest('#hamburger-btn')) {
      e.preventDefault();
      e.stopPropagation();
      _toggleSidebar();
      return;
    }

    /* ---------- 2. 點 backdrop ---------- */
    if (e.target.classList.contains('sidebar-backdrop')) {
      _closeMobileSidebar();
      return;
    }

    /* ---------- 3. 點 sidebar 內部連結 ---------- */
    const navLink = e.target.closest('.sidebar .nav-item');
    if (navLink) {
      if (window.innerWidth < 640) {
        _closeMobileSidebar();
      }
      return;
    }

    /* ---------- 4. 點 sidebar 群組標題 ---------- */
    const groupToggle = e.target.closest('[data-group-toggle]');
    if (groupToggle) {
      return;
    }
  });

  /* ---------- 監聽使用者變更 ---------- */
  if (_unsubscribeUserChange) { try { _unsubscribeUserChange(); } catch (err) { /* noop */ } }
  _unsubscribeUserChange = AppState.on('user-change', () => _renderUserInfo());

  if (_unsubscribeFamilyChange) { try { _unsubscribeFamilyChange(); } catch (err) { /* noop */ } }
  _unsubscribeFamilyChange = AppState.on('family-change', () => _renderUserInfo());

  if (_unsubscribeMemberAccountChange) { try { _unsubscribeMemberAccountChange(); } catch (err) { /* noop */ } }
  _unsubscribeMemberAccountChange = AppState.on('member-account-change', () => _renderUserInfo());

  /* ---------- 🆕 v101.9.0：監聽年月變更 ---------- */
  if (_unsubscribeYMChange) { try { _unsubscribeYMChange(); } catch (err) { /* noop */ } }
  _unsubscribeYMChange = AppState.on('ym-change', () => {
    if (!SHOW_YEAR_MONTH_PAGES.includes(_currentActiveHref)) return;
    const box = document.getElementById('navbar-year-month');
    if (!box) return;
    const { year, month } = AppState.getYearMonth();
    const ySel = box.querySelector('[data-ym="year"]');
    const mSel = box.querySelector('[data-ym="month"]');
    if (ySel && ySel.value !== String(year)) ySel.value = String(year);
    if (mSel && mSel.value !== String(month)) mSel.value = String(month);
  });
}

/* ============================================
   Sidebar 開關
   ============================================ */
function _toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;

  if (window.innerWidth < 640) {
    const isOpen = sidebar.classList.contains('mobile-open');
    if (isOpen) _closeMobileSidebar();
    else _openMobileSidebar();
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

function _openMobileSidebar() {
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

function _closeMobileSidebar() {
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) sidebar.classList.remove('mobile-open');

  const backdrop = document.querySelector('.sidebar-backdrop');
  if (backdrop) backdrop.classList.remove('active');
}

/* ============================================
   對外 API
   ============================================ */
export function setNavbarTitle(title) {
  const el = document.querySelector('.navbar-title');
  if (el) el.textContent = title || '';
}

export function refreshNavbarUser() {
  _renderUserInfo();
}

export function destroyNavbar() {
  if (_unsubscribeUserChange) { try { _unsubscribeUserChange(); } catch (err) { /* noop */ } _unsubscribeUserChange = null; }
  if (_unsubscribeFamilyChange) { try { _unsubscribeFamilyChange(); } catch (err) { /* noop */ } _unsubscribeFamilyChange = null; }
  if (_unsubscribeMemberAccountChange) { try { _unsubscribeMemberAccountChange(); } catch (err) { /* noop */ } _unsubscribeMemberAccountChange = null; }
  if (_unsubscribeYMChange) { try { _unsubscribeYMChange(); } catch (err) { /* noop */ } _unsubscribeYMChange = null; }
}