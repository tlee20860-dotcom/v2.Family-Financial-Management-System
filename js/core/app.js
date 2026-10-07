// ============================================
// app.js — 每個頁面共用的初始化（v101）
// 位置：js/core/app.js
// ============================================
// v101 修正：
//   ✅ 移除重複的 familyId 設定（統一由 auth-guard 處理）
//   ✅ 整合 app-config 載入（平台預設 + 家庭覆蓋）
//   ✅ 移除 navbar-user 重複設定（統一由 navbar.js 處理）
//   ✅ 新增 destroy / cleanup 機制
// ============================================

import { renderSidebar } from '../shared/sidebar.js';
import { renderNavbar } from '../shared/navbar.js';
import { requireLogin } from './auth-guard.js';
import { initPWA } from './pwa.js';
import { AppState } from './state.js';
import { initAppConfig } from '../config/app-config.js';

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

  // 6. Navbar 渲染（navbar.js 內部會處理使用者資訊顯示）
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