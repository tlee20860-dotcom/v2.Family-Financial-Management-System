// ============================================
// navbar.js — 頂部導覽列（v101）
// 位置：js/shared/navbar.js
// ============================================
// v101 修正：
//   ✅ 移除與 app.js 重複的 #navbar-user 設定（統一在 navbar 處理）
//   ✅ 硬編碼 @familyfin.local → 用 getDisplayName
//   ✅ localStorage key 加前綴（STORAGE_KEYS）
//   ✅ 全域事件監聽只綁一次（用 module-level flag）
//   ✅ 支援 destroy
// ============================================

import { AppState } from '../core/state.js';
import { getDisplayName } from '../core/auth.js';
import { STORAGE_KEYS } from '../config/constants.js';

let _eventBound = false;
let _unsubscribeUserChange = null;

/**
 * 渲染頂部導覽列
 * @param {string} containerId - 容器 ID（預設 'navbar-root'）
 * @param {string} title - 頁面標題
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

  // 初次渲染使用者資訊
  _renderUserInfo();

  // 全域事件（只需綁定一次）
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
  // Hamburger 按鈕 / Backdrop 點擊
  document.addEventListener('click', (e) => {
    if (e.target.closest('#hamburger-btn')) {
      _toggleSidebar();
      return;
    }
    const backdrop = e.target.closest('.sidebar-backdrop');
    if (backdrop && backdrop.classList.contains('active')) {
      _closeMobileSidebar();
    }
  });

  // 監聽使用者變更
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
    // 手機版：抽屜模式
    sidebar.classList.toggle('mobile-open');
    let backdrop = document.querySelector('.sidebar-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'sidebar-backdrop';
      document.body.appendChild(backdrop);
    }
    backdrop.classList.toggle('active');
  } else {
    // 桌面版：摺疊模式
    sidebar.classList.toggle('collapsed');
    try {
      localStorage.setItem(
        STORAGE_KEYS.SIDEBAR_COLLAPSED,
        String(sidebar.classList.contains('collapsed'))
      );
    } catch (err) { /* noop */ }
  }
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

/**
 * 更新 navbar 標題（不重新渲染整個 navbar）
 */
export function setNavbarTitle(title) {
  const el = document.querySelector('.navbar-title');
  if (el) el.textContent = title || '';
}

/**
 * 手動刷新使用者資訊
 */
export function refreshNavbarUser() {
  _renderUserInfo();
}

/**
 * 銷毀 navbar 事件綁定（用於 SPA 切頁）
 */
export function destroyNavbar() {
  if (_unsubscribeUserChange) {
    try { _unsubscribeUserChange(); } catch (err) { /* noop */ }
    _unsubscribeUserChange = null;
  }
  // 註：document 層級的事件用 _eventBound 保護，不主動移除
}