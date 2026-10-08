// ============================================
// app.js — 每個頁面共用的初始化（v101.9.0）
// 位置：js/core/app.js
// ============================================
// v101.9.0 修正：
//   ✅ renderNavbar 傳入 activeHref（供年月選擇器判斷）
// ============================================

import { renderSidebar, destroySidebar } from '../shared/sidebar.js';
import { renderNavbar, destroyNavbar } from '../shared/navbar.js';
import { requireLogin } from './auth-guard.js';
import { initPWA } from './pwa.js';
import { AppState } from './state.js';
import {
  initAppConfig,
  watchPlatformDefaults,
  watchFamilySettings,
  disposeAppConfig,
} from '../config/app-config.js';

/* ============================================
   Module 狀態
   ============================================ */
let _pageCleanups = [];
let _initialized = false;

/* ============================================
   主入口
   ============================================ */
export async function initApp({
  activeHref = '',
  title = '',
  needAuth = true,
  requireFamily = true,
} = {}) {
  if (_initialized) {
    console.warn('[app] initApp 已被呼叫過，忽略重複呼叫');
    return null;
  }
  _initialized = true;

  // 1. PWA 初始化
  try {
    initPWA();
  } catch (err) {
    console.warn('[app] PWA 初始化失敗：', err);
  }

  // 2. 全域狀態初始化
  AppState.init();

  // 3. 登入驗證
  let user = null;
  if (needAuth) {
    try {
      user = await requireLogin({ requireFamily });
    } catch (err) {
      console.error('[app] 登入驗證失敗：', err);
      return null;
    }
    if (!user) return null;
  }

  // 4. 載入 app-config
  try {
    await initAppConfig(AppState.getFamilyId());
    watchPlatformDefaults();
    if (AppState.getFamilyId()) {
      watchFamilySettings();
    }
  } catch (err) {
    console.warn('[app] app-config 載入失敗（使用常數 fallback）：', err);
  }

  // 5. Sidebar 渲染
  const sidebarRoot = document.getElementById('sidebar-root');
  if (sidebarRoot) {
    try {
      await renderSidebar('sidebar-root', activeHref);
    } catch (err) {
      console.error('[app] Sidebar 渲染失敗：', err);
    }
  }

  // 6. Navbar 渲染（🆕 v101.9.0：傳 activeHref）
  try {
    renderNavbar('navbar-root', title, activeHref);
  } catch (err) {
    console.error('[app] Navbar 渲染失敗：', err);
  }

  // 7. Lucide icon 渲染
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }

  return user;
}

/* ============================================
   頁面清理註冊
   ============================================ */
export function registerPageCleanup(fn) {
  if (typeof fn === 'function') {
    _pageCleanups.push(fn);
  }
}

export function destroyApp() {
  _pageCleanups.forEach((fn) => {
    try { fn(); } catch (e) { console.error('[app] cleanup error:', e); }
  });
  _pageCleanups = [];

  try { destroySidebar(); } catch (e) { /* noop */ }
  try { destroyNavbar(); } catch (e) { /* noop */ }
  try { disposeAppConfig(); } catch (e) { /* noop */ }

  AppState.destroy();

  _initialized = false;
}