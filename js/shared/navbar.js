// ============================================
// navbar.js — 頂部導覽列（v101.2）
// 位置：js/shared/navbar.js
// ============================================
// v101.2 修正：
//   ✅ 事件處理改為「只在點 backdrop 本身時關閉」
//   ✅ 加入 closest 判斷，避免點 sidebar 內部被攔截
// ============================================

import { AppState } from '../core/state.js';
import { getDisplayName } from '../core/auth.js';
import { STORAGE_KEYS } from '../config/constants.js';

let _eventBound = false;
let _unsubscribeUserChange = null;

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
    <button class="hamburger" id="hamburger-btn" aria-label="切換選單">
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

  const name = getDisplayName(user);
  const familyName = AppState.getFamilyName();
  const familyTag = familyName ? ` · ${familyName}` : '';

  box.innerHTML = `<span class="mono" style="font-size:12px; color:var(--text-muted); margin-right:10px;">👤 ${name}${familyTag}</span>`;
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
      // 手機版：點擊後關閉 sidebar（但不阻止跳轉）
      if (window.innerWidth < 640) {
        _closeMobileSidebar();
      }
      // 不 stopPropagation，讓 <a> 的預設跳轉繼續
      return;
    }

    /* ---------- 4. 點 sidebar 群組標題 → 由 sidebar.js 處理 ---------- */
    const groupToggle = e.target.closest('[data-group-toggle]');
    if (groupToggle) {
      // 群組展開由 sidebar.js 的 document listener 處理
      // 這裡不做事，避免衝突
      return;
    }
  });

  /* ---------- 監聽使用者變更 ---------- */
  if (_unsubscribeUserChange) {
    try { _unsubscribeUserChange(); } catch (err) { /* noop */ }
  }
  _unsubscribeUserChange = AppState.on('user-change', () => _renderUserInfo());
  AppState.on('family-change', () => _renderUserInfo());
}

/* ============================================
   Sidebar 開關
   ============================================ */
function _toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;

  if (window.innerWidth < 640) {
    // 手機版
    const isOpen = sidebar.classList.contains('mobile-open');
    if (isOpen) {
      _closeMobileSidebar();
    } else {
      _openMobileSidebar();
    }
  } else {
    // 桌面版：摺疊
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

  // 確保 backdrop 存在
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
  if (_unsubscribeUserChange) {
    try { _unsubscribeUserChange(); } catch (err) { /* noop */ }
    _unsubscribeUserChange = null;
  }
}
