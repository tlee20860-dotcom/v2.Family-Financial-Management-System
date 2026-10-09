// ============================================
// navbar.js — 頂部導覽列（v103.0.0）
// 位置：js/layout/navbar.js
// ============================================
// v103.0.0 重構：
//   ✅ 從 js/shared/navbar.js 移入 js/layout/
//   ✅ 逸出改用 lib/dom.js 的 esc()
//   ✅ SHOW_YEAR_MONTH_PAGES 改從 constants.js 讀取（SSOT）
//   ✅ Sidebar 開關改呼叫 layout/sidebar.js 暴露的方法
//   ✅ admin 導向改使用 ROUTES 常數
// ============================================

import { AppState } from '../core/state.js';
import { getDisplayName } from '../core/auth.js';
import { STORAGE_KEYS, SHOW_YEAR_MONTH_PAGES, ROUTES, ROLES } from '../config/constants.js';
import { getYearList } from '../config/app-config.js';
import { esc } from '../lib/dom.js';
import { toggleSidebar } from './sidebar.js';

/* ============================================
   Module 狀態
   ============================================ */
let _eventBound = false;
let _unsubscribeUserChange = null;
let _unsubscribeFamilyChange = null;
let _unsubscribeMemberAccountChange = null;
let _unsubscribeYMChange = null;
let _currentActiveHref = '';
let _yearMonthChangeHandler = null;

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
    ? `<a href="${ROUTES.ADMIN}" class="btn btn-sm btn-ghost" title="平台管理" style="padding:6px 10px;">
         <i data-lucide="settings" style="width:16px;height:16px;"></i>
       </a>`
    : '';

  const showYearMonth = SHOW_YEAR_MONTH_PAGES.includes(activeHref);
  const yearMonthHtml = showYearMonth ? `<div id="navbar-year-month" class="navbar-year-month"></div>` : '';

  root.innerHTML = `
    <button type="button" class="hamburger" id="hamburger-btn" aria-label="切換選單">
      <i data-lucide="menu"></i>
    </button>
    <div class="navbar-title">${esc(title)}</div>
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
   年月選擇器
   ============================================ */
function _renderYearMonth() {
  const box = document.getElementById('navbar-year-month');
  if (!box) return;

  const { year, month } = AppState.getYearMonth();
  const years = getYearList();

  let yearOpts = '';
  years.forEach((y) => {
    const sel = String(y) === String(year) ? 'selected' : '';
    yearOpts += `<option value="${y}" ${sel}>${y} 年</option>`;
  });

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
  if (role === ROLES.SUPERADMIN) {
    roleBadge = ' <span class="badge badge-magenta" style="font-size:10px;">超級管理員</span>';
  } else if (role === ROLES.OWNER) {
    roleBadge = ' <span class="badge badge-info" style="font-size:10px;">👑</span>';
  } else if (role === ROLES.MEMBER) {
    roleBadge = ' <span class="badge badge-muted" style="font-size:10px;">成員</span>';
  }

  const readonlyBadge = (!canInput && role !== ROLES.SUPERADMIN)
    ? ' <span class="badge badge-pending" style="font-size:10px;">唯讀</span>'
    : '';

  box.innerHTML = `
    <span class="mono navbar-user-text" style="font-size:12px; color:var(--text-muted); margin-right:10px;">
      👤 ${esc(displayName)}${esc(familyTag)}${roleBadge}${readonlyBadge}
    </span>
  `;
}

/* ============================================
   全域事件
   ============================================ */
function _bindGlobalEvents() {
  document.addEventListener('click', (e) => {
    /* ---------- Hamburger：切換 Sidebar ---------- */
    if (e.target.closest('#hamburger-btn')) {
      e.preventDefault();
      e.stopPropagation();
      toggleSidebar();
      return;
    }

    /* ---------- Sidebar backdrop：關閉行動版 ---------- */
    if (e.target.classList.contains('sidebar-backdrop')) {
      /* 由 sidebar.js 內部處理 */
      return;
    }

    /* ---------- 點擊 Sidebar 內的 nav-item（手機自動關閉） ---------- */
    const navLink = e.target.closest('.sidebar .nav-item');
    if (navLink) {
      return;
    }

    /* ---------- 群組展開（由 sidebar.js 內部處理） ---------- */
    const groupToggle = e.target.closest('[data-group-toggle]');
    if (groupToggle) {
      return;
    }
  });

  /* ---------- AppState 事件訂閱 ---------- */
  if (_unsubscribeUserChange) { try { _unsubscribeUserChange(); } catch (err) { /* noop */ } }
  _unsubscribeUserChange = AppState.on('user-change', () => _renderUserInfo());

  if (_unsubscribeFamilyChange) { try { _unsubscribeFamilyChange(); } catch (err) { /* noop */ } }
  _unsubscribeFamilyChange = AppState.on('family-change', () => _renderUserInfo());

  if (_unsubscribeMemberAccountChange) { try { _unsubscribeMemberAccountChange(); } catch (err) { /* noop */ } }
  _unsubscribeMemberAccountChange = AppState.on('member-account-change', () => _renderUserInfo());

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

  if (_yearMonthChangeHandler) {
    const box = document.getElementById('navbar-year-month');
    if (box) {
      try { box.removeEventListener('change', _yearMonthChangeHandler); } catch (e) { /* noop */ }
    }
    _yearMonthChangeHandler = null;
  }
}
