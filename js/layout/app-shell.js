// ============================================
// app-shell.js — App Shell 初始化（v103.0.8）
// 位置：js/layout/app-shell.js
// ============================================
// v103.0.8 修正：
//   ✅ initApp 開頭呼叫 initDebug()（全站啟用 vConsole）
// ============================================

import { renderSidebar, destroySidebar } from './sidebar.js';
import { renderNavbar, destroyNavbar } from './navbar.js';
import { requireLogin } from '../core/auth-guard.js';
import { initPWA } from '../core/pwa.js';
import { AppState } from '../core/state.js';
import { initDebug } from '../core/debug.js';
import {
  initAppConfig,
  watchPlatformDefaults,
  watchFamilySettings,
  disposeAppConfig,
} from '../config/app-config.js';
import {
  initAllRegistries,
  destroyAllRegistries,
} from '../lib/registry.js';

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
    console.warn('[app-shell] initApp 已被呼叫過，忽略重複呼叫');
    return null;
  }
  _initialized = true;

  /* ---------- 0. Debug（vConsole） ---------- */
  try {
    initDebug();
  } catch (err) {
    console.warn('[app-shell] initDebug 失敗：', err);
  }

  /* ---------- 1. PWA ---------- */
  try {
    initPWA();
  } catch (err) {
    console.warn('[app-shell] PWA 初始化失敗：', err);
  }

  /* ---------- 2. AppState ---------- */
  AppState.init();

  /* ---------- 3. 登入驗證 ---------- */
  let user = null;
  if (needAuth) {
    try {
      user = await requireLogin({ requireFamily });
    } catch (err) {
      console.error('[app-shell] 登入驗證失敗：', err);
      return null;
    }
    if (!user) return null;
  }

  /* ---------- 4. app-config ---------- */
  try {
    await initAppConfig(AppState.getFamilyId());
    watchPlatformDefaults();
    if (AppState.getFamilyId()) {
      watchFamilySettings();
    }
  } catch (err) {
    console.warn('[app-shell] app-config 載入失敗（使用常數 fallback）：', err);
  }

  /* ---------- 5. Registry 初始化 ---------- */
  try {
    initAllRegistries();
  } catch (err) {
    console.warn('[app-shell] Registry 初始化失敗：', err);
  }

  /* ---------- 6. Sidebar ---------- */
  const sidebarRoot = document.getElementById('sidebar-root');
  if (sidebarRoot) {
    try {
      await renderSidebar('sidebar-root', activeHref);
    } catch (err) {
      console.error('[app-shell] Sidebar 渲染失敗：', err);
    }
  }

  /* ---------- 7. Navbar ---------- */
  try {
    renderNavbar('navbar-root', title, activeHref);
  } catch (err) {
    console.error('[app-shell] Navbar 渲染失敗：', err);
  }

  /* ---------- 8. Icons ---------- */
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

/* ============================================
   銷毀
   ============================================ */
export function destroyApp() {
  _pageCleanups.forEach((fn) => {
    try { fn(); } catch (e) {
      console.error('[app-shell] cleanup error:', e);
    }
  });
  _pageCleanups = [];

  try { destroySidebar(); } catch (e) { /* noop */ }
  try { destroyNavbar(); } catch (e) { /* noop */ }
  try { disposeAppConfig(); } catch (e) { /* noop */ }
  try { destroyAllRegistries(); } catch (e) { /* noop */ }

  AppState.destroy();

  _initialized = false;
}