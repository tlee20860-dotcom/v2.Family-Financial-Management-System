// ============================================
// navbar.js — 頂部導覽列（v101.10.0）
// 位置：js/shared/navbar.js
// ============================================
// v101.10.0 修正：
//   ✅ [P3-12] _renderYearMonth 的 change 監聽器保存供 destroy 清理
//       - 改用 event delegation（一個監聽器，非每個 select 一個）
//       - 加入 module 變數 _yearMonthChangeHandler
//       - destroyNavbar 統一移除
//   ✅ 保留 v101.9.0 全部功能（年月選擇器 / SHOW_YEAR_MONTH_PAGES）
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

// 🆕 v101.10.0：保存年月選擇器的 change 監聽器
let _yearMonthChangeHandler = null;

/* ============================================
   顯示年月選擇器的頁面
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

  // 判斷是否顯示年月選擇器
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

  if (showYearMonth) {
    _renderYearMonth();
  }

  if (!_eventBound) {
    _eventBound = true;
    _bindGlobalEvents();
  }
}

/* ============================================
   年月選擇器（v101.10.0：改 event delegation）
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

  // 🆕 v101.10.0：改用 event delegation
  // 先移除舊監聽器（避免重複）
  if (_yearMonthChangeHandler) {
    box.removeEventListener('change', _yearMonthChangeHandler);
  }

  _yearMonthChangeHandler = (e) => {
    const sel = e.target.closest('[data-ym]');
    if (!sel) return;

    const ySel = box.querySelector('[data-ym="year"]');
    const mSel = box.querySelector('[data-ym="month"]');
    if (ySel && mSel) {
      AppState.setYearMonth(ySel.value, mSel.value);
    }
  };

  box.addEventListener('change', _yearMonthChangeHandler);

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
      👤 ${escapeHtml(displayName)}${escapeHtml(familyTag)}${roleBadge}${readonlyBadge}
    </span>
  `;
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

  /* ---------- 監聽年月變更 ---------- */
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

  // 🆕 v101.10.0：清理年月選擇器的 change 監聽器
  if (_yearMonthChangeHandler) {
    const box = document.getElementById('navbar-year-month');
    if (box) {
      try { box.removeEventListener('change', _yearMonthChangeHandler); } catch (e) { /* noop */ }
    }
    _yearMonthChangeHandler = null;
  }
}