// ============================================
// auth-guard.js — 路由守衛（v101）
// 位置：js/core/auth-guard.js
// ============================================
// v101 修正：
//   ✅ requireLogin 用 once 模式，避免監聽堆疊
//   ✅ superadmin 無家庭 → admin.html
//   ✅ 一般帳號自動設定 familyId = uid
//   ✅ 回傳 Promise 保證 resolve 一次
// ============================================

import { watchAuth, isSuperAdmin } from './auth.js';
import { AppState } from './state.js';

/**
 * 確認使用者已登入，並設定 AppState
 * @param {Object} options
 * @param {boolean} options.requireFamily - 是否必須選擇家庭（admin 頁面設 false）
 * @returns {Promise<Object|null>} Firebase user 或 null（會被導向）
 */
export function requireLogin({ requireFamily = true } = {}) {
  return new Promise((resolve) => {
    let resolved = false;

    const unsubscribe = watchAuth((user) => {
      if (resolved) return;
      resolved = true;

      // 取消監聽（避免堆疊）
      try { unsubscribe(); } catch (e) { /* noop */ }

      // 未登入 → 導向 login
      if (!user) {
        window.location.href = 'login.html';
        resolve(null);
        return;
      }

      // 設定使用者狀態
      AppState.setUser(user);
      const superAdmin = isSuperAdmin(user);
      AppState.setSuperAdmin(superAdmin);

      if (superAdmin) {
        // superadmin 若未選擇家庭，且當前頁面需要家庭 → admin.html
        if (requireFamily && !AppState.getFamilyId()) {
          window.location.href = 'admin.html';
          resolve(null);
          return;
        }
      } else {
        // 一般家庭帳號：自動設定 familyId = uid
        if (!AppState.getFamilyId() || AppState.getFamilyId() !== user.uid) {
          AppState.setFamily(user.uid, '我的家庭');
        }
      }

      resolve(user);
    });
  });
}

/**
 * 同步檢查是否已登入（不等待非同步結果）
 * 用於非同步流程中的快速檢查
 * @returns {boolean}
 */
export function isLoggedIn() {
  return !!AppState.currentUser;
}

/**
 * 檢查是否為超級管理員（從 AppState）
 * @returns {boolean}
 */
export function checkSuperAdmin() {
  return !!AppState.isSuperAdmin;
}