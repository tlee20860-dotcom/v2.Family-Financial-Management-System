// ============================================
// app.js — 每個頁面共用的初始化（v101.2）
// 位置：js/core/app.js
// ============================================
// v101.2 修正：
//   ✅ 呼叫 watchPlatformDefaults() / watchFamilySettings()
//      → 平台預設或家庭設定變更時，自動同步到前端
//   ✅ 整合 watch 機制，避免重整頁面才生效
// ============================================

import { renderSidebar } from '../shared/sidebar.js';
import { renderNavbar } from '../shared/navbar.js';
import { requireLogin } from './auth-guard.js';
import { initPWA } from './pwa.js';
import { AppState } from './state.js';
import {
  initAppConfig,
  watchPlatformDefaults,
  watchFamilySettings,
} from '../config/app-config.js';

/**
 * 頁面初始化
 * @param {Object} options
 * @param {string} options.activeHref - 當前頁面 href（用於 sidebar 高亮）
 * @param {string} options.title - navbar 標題
 * @param {boolean} options.needAuth - 是否需要登入驗證（預設 true）
 * @param {boolean} options.requireFamily - 是否必須選擇家庭（預設 true）
 * @returns {Promise<Object|null>} user 物件或 null
 */
export async function initApp({
  activeHref = '',
  title = '',
  needAuth = true,
  requireFamily = true,
} = {}) {
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

  // 4. 載入 app-config（平台預設 + 家庭覆蓋）
  try {
    await initAppConfig(AppState.getFamilyId());

    // 🆕 v101.2：啟動即時同步監聽
    // 1) 平台預設變更（superadmin 改設定時，家庭端即時反映）
    watchPlatformDefaults();
    // 2) 家庭設定變更（跨裝置即時同步）
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

  // 6. Navbar 渲染
  try {
    renderNavbar('navbar-root', title);
  } catch (err) {
    console.error('[app] Navbar 渲染失敗：', err);
  }

  // 7. Lucide icon 渲染
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }

  return user;
}

/**
 * 頁面卸載清理（用於 SPA 化或頁面切換時）
 */
export function destroyApp() {
  AppState.destroy();
}
