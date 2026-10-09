// ============================================
// app-shell.js — App Shell 初始化（v103.0.9）
// 位置：js/layout/app-shell.js
// ============================================
// v103.0.9 修正：
//   ✅ [關鍵] initDebug 改為動態 import + try-catch
//      - 即使 debug.js 不存在，app-shell 也不會崩潰
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

let _pageCleanups = [];
let _initialized = false;

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

  /* ---------- 0. Debug（vConsole）安全載入 ---------- */
  try {
    const mod = await import('../core/debug.js');
    if (mod && typeof mod.initDebug === 'function') {
      mod.initDebug();
    }
  } catch (err) {
    // debug.js 不存在時，不影響主流程
    console.warn('[app-shell] debug 載入失敗（可忽略）：', err.message);
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
    console.warn('[app-shell] app-config 載入失敗：', err);
  }

  /* ---------- 5. Registry ---------- */
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
      console.log('[app-shell] Sidebar 渲染完成');
    } catch (err) {
      console.error('[app-shell] Sidebar 渲染失敗：', err);
      // 顯示錯誤在側邊欄位置
      sidebarRoot.innerHTML = `
        <div style="padding:16px; color:#F43F5E; font-size:12px; font-family:monospace;">
          ⚠️ Sidebar 渲染失敗：<br>${err.message}
        </div>
      `;
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

export function registerPageCleanup(fn) {
  if (typeof fn === 'function') {
    _pageCleanups.push(fn);
  }
}

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