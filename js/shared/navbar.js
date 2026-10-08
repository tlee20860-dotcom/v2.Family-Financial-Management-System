// ============================================
// navbar.js — 頂部導覽列（v101.8.0）
// 位置：js/shared/navbar.js
// ============================================
// v101.8.0 修正：
//   ✅ 顯示登入者 displayName（若存在），fallback 到帳號名稱
//   ✅ 顯示角色標籤（owner / member / superadmin）
//   ✅ 唯讀帳號加「唯讀」badge
// ============================================

import { AppState } from '../core/state.js';
import { getDisplayName } from '../core/auth.js';
import { STORAGE_KEYS } from '../config/constants.js';

let _eventBound = false;
let _unsubscribeUserChange = null;
let _unsubscribeFamilyChange = null;
let _unsubscribeMemberAccountChange = null;

/**
 * 渲染頂部導覽列
 */
export function renderNavbar(containerId = 'navbar-root', title = '') {
  const root = document.getElementById(containerId);
  if (!root) return;

  root.classList.add('navbar');
  const isSuper = AppState.isSuperAdmin;

  const adminBtn = isSuper
    ? `<a href="admin.html" class="btn btn-sm btn-ghost" title="平台管理" style="padding:6px 10px;">
         <i data-lucide="settings" style="width:16px;height:16px;"></i>
       </a>`
    : '';

  root.innerHTML = `
    <button type="button" class="hamburger" id="hamburger-btn" aria-label="切換選單">
      <i data-lucide="menu"></i>
    </button>
    <div class="navbar-title">${title || ''}</div>
    ${adminBtn}
    <div class="navbar-user" id="navbar-user"></div>
  `;

  _renderUserInfo();

  if (!_eventBound) {
    _eventBound = true;
    _bindGlobalEvents();
  }
}

/* ============================================
   使用者資訊（🆕 v101.8.0）
   ============================================ */
function _renderUserInfo() {
  const box = document.getElementById('navbar-user');
  if (!box) return;

  const user = AppState.currentUser;
  if (!user) {
    box.innerHTML = '';
    return;
  }

  // 🆕 v101.8.0：優先使用 displayName，fallback 到帳號名稱
  const displayName = AppState.getDisplayName() || getDisplayName(user);
  const familyName = AppState.getFamilyName();
  const role = AppState.getRole();
  const canInput = AppState.getCanInput();

  const familyTag = familyName ? ` · ${familyName}` : '';

  // 🆕 v101.8.0：角色標籤
  let roleBadge = '';
  if (role === 'superadmin') {
    roleBadge = ' <span class="badge badge-magenta" style="font-size:10px;">超級管理員</span>';
  } else if (role === 'owner') {
    roleBadge = ' <span class="badge badge-info" style="font-size:10px;">👑</span>';
  } else if (role === 'member') {
    roleBadge = ' <span class="badge badge-muted" style="font-size:10px;">成員</span>';
  }

  // 🆕 v101.8.0：唯讀標記
  const readonlyBadge = (!canInput && role !== 'superadmin')
    ? ' <span class="badge badge-pending" style="font-size:10px;">唯讀</span>'
    : '';

  box.innerHTML = `
    <span class="mono" style="font-size:12px; color:var(--text-muted); margin-right:10px;">
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

    /* ---------- 2. 點 backdrop（僅點 backdrop 本身）---------- */
    if (e.target.classList.contains('sidebar-backdrop')) {
      _closeMobileSidebar();
      return;
    }

    /* ---------- 3. 點 sidebar 內部的連結 → 讓它自然跳轉 ---------- */
    const navLink = e.target.closest('.sidebar .nav-item');
    if (navLink) {
      if (window.innerWidth < 640) {
        _closeMobileSidebar();
      }
      return;
    }

    /* ---------- 4. 點 sidebar 群組標題 → 由 sidebar.js 處理 ---------- */
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

  // 🆕 v101.8.0：監聽 memberAccount 變更
  if (_unsubscribeMemberAccountChange) { try { _unsubscribeMemberAccountChange(); } catch (err) { /* noop */ } }
  _unsubscribeMemberAccountChange = AppState.on('member-account-change', () => _renderUserInfo());
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
}