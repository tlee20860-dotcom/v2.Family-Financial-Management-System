// ============================================
// app-shell.js — App Shell 初始化（v103.0.0）
// 位置：js/layout/app-shell.js
// ============================================
// 來源：從 js/core/app.js 抽出（v103.0.0）
//
// 職責：
//   1. 每個頁面的統一初始化流程
//   2. 掛載 Sidebar / Navbar
//   3. 載入 app-config（平台預設 + 家庭覆蓋）
//   4. 初始化所有 Registry
//   5. 頁面清理註冊（供 destroyApp 統一呼叫）
// ============================================

import { renderSidebar, destroySidebar } from './sidebar.js';
import { renderNavbar, destroyNavbar } from './navbar.js';
import { requireLogin } from '../core/auth-guard.js';
import { initPWA } from '../core/pwa.js';
import { AppState } from '../core/state.js';
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

/**
 * 初始化 App Shell
 *
 * @param {Object} [options]
 * @param {string} [options.activeHref='']      - 當前頁面 href（用於 sidebar 高亮）
 * @param {string} [options.title='']           - 頁面標題
 * @param {boolean} [options.needAuth=true]     - 是否需要登入
 * @param {boolean} [options.requireFamily=true]- 是否必須選擇家庭
 * @returns {Promise<Object|null>} Firebase user 或 null
 */
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

/**
 * 註冊頁面銷毀回呼
 * @param {Function} fn
 */
export function registerPageCleanup(fn) {
  if (typeof fn === 'function') {
    _pageCleanups.push(fn);
  }
}

/* ============================================
   銷毀
   ============================================ */

/**
 * 銷毀 App Shell
 * - 執行所有頁面清理
 * - 銷毀 Sidebar / Navbar / Registry / AppConfig
 * - 重設 AppState
 */
export function destroyApp() {
  /* ---------- 1. 頁面清理 ---------- */
  _pageCleanups.forEach((fn) => {
    try { fn(); } catch (e) {
      console.error('[app-shell] cleanup error:', e);
    }
  });
  _pageCleanups = [];

  /* ---------- 2. Layout ---------- */
  try { destroySidebar(); } catch (e) { /* noop */ }
  try { destroyNavbar(); } catch (e) { /* noop */ }

  /* ---------- 3. Config ---------- */
  try { disposeAppConfig(); } catch (e) { /* noop */ }

  /* ---------- 4. Registry ---------- */
  try { destroyAllRegistries(); } catch (e) { /* noop */ }

  /* ---------- 5. AppState ---------- */
  AppState.destroy();

  _initialized = false;
}
