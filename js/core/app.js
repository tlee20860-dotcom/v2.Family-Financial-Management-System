// ============================================
// app.js — 每個頁面共用的初始化（v102.0.0）
// 位置：js/core/app.js
// ============================================
// v102.0.0 修正：
//   ✅ 版本號更新（無功能變更）
//   ✅ 保留 v101.9.0 全部功能
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

let _pageCleanups = [];
let _initialized = false;

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

  try {
    initPWA();
  } catch (err) {
    console.warn('[app] PWA 初始化失敗：', err);
  }

  AppState.init();

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

  try {
    await initAppConfig(AppState.getFamilyId());
    watchPlatformDefaults();
    if (AppState.getFamilyId()) {
      watchFamilySettings();
    }
  } catch (err) {
    console.warn('[app] app-config 載入失敗（使用常數 fallback）：', err);
  }

  const sidebarRoot = document.getElementById('sidebar-root');
  if (sidebarRoot) {
    try {
      await renderSidebar('sidebar-root', activeHref);
    } catch (err) {
      console.error('[app] Sidebar 渲染失敗：', err);
    }
  }

  try {
    renderNavbar('navbar-root', title, activeHref);
  } catch (err) {
    console.error('[app] Navbar 渲染失敗：', err);
  }

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }

  return user;
}

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