// ============================================
// auth-guard.js — 路由守衛（v101.8.0）
// 位置：js/core/auth-guard.js
// ============================================
// v101.8.0 修正：
//   ✅ 登入後呼叫 api.lookupFamily() 查詢所屬家庭
//   ✅ 設定 AppState 的 role / canInput / displayName / memberAccount
//   ✅ 向後相容：UID = familyId 的舊家庭仍可登入
//   ✅ superadmin 不需要 lookupFamily
// ============================================

import { watchAuth, isSuperAdmin } from './auth.js';
import { AppState } from './state.js';
import { api } from './api.js';

/**
 * 確認使用者已登入，並設定 AppState
 * @param {Object} options
 * @param {boolean} options.requireFamily - 是否必須選擇家庭（admin 頁面設 false）
 * @returns {Promise<Object|null>} Firebase user 或 null（會被導向）
 */
export function requireLogin({ requireFamily = true } = {}) {
  return new Promise((resolve) => {
    let resolved = false;

    const unsubscribe = watchAuth(async (user) => {
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

      // 🆕 v101.8.0：superadmin 直接設定 role / canInput
      if (superAdmin) {
        AppState.setRole('superadmin');
        AppState.setCanInput(true);
        AppState.setDisplayName('超級管理員');

        // superadmin 若未選擇家庭，且當前頁面需要家庭 → admin.html
        if (requireFamily && !AppState.getFamilyId()) {
          window.location.href = 'admin.html';
          resolve(null);
          return;
        }

        resolve(user);
        return;
      }

      // 🆕 v101.8.0：一般帳號 → 呼叫 lookupFamily
      try {
        const result = await api.lookupFamily();

        if (result && result.familyId) {
          // 成功查到家庭
          AppState.setAccountContext({
            familyId: result.familyId,
            familyName: result.familyName || '我的家庭',
            memberAccount: result.memberAccount,
            ownerUid: result.isLegacy ? result.familyId : undefined,
          });

          resolve(user);
          return;
        }
      } catch (err) {
        // lookupFamily 失敗 → fallback 到舊版
        console.warn('[auth-guard] lookupFamily 失敗，使用 fallback：', err.message);
      }

      // 🆕 v101.8.0：Fallback 邏輯（向後相容）
      // - 若 lookupFamily 失敗，嘗試用 UID = familyId 的舊模式
      // - 若 user.uid 在 platform/families 中存在 → 舊家庭
      // - 若不存在 → 拒絕存取

      // 直接嘗試用 UID 作為 familyId
      if (!AppState.getFamilyId() || AppState.getFamilyId() !== user.uid) {
        AppState.setFamily(user.uid, '我的家庭', user.uid);
        AppState.setRole('owner');
        AppState.setCanInput(true);
        AppState.setDisplayName(user.email?.split('@')[0] || '成員');
        AppState.setMemberAccount({
          email: user.email || '',
          displayName: AppState.getDisplayName(),
          role: 'owner',
          canInput: true,
        });
      }

      resolve(user);
    });
  });
}

/**
 * 同步檢查是否已登入（不等待非同步結果）
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

/**
 * 🆕 v101.8.0：檢查是否有輸入權限
 * @returns {boolean}
 */
export function canInput() {
  return !!AppState.canInput;
}

/**
 * 🆕 v101.8.0：檢查是否為家庭主帳號
 * @returns {boolean}
 */
export function isFamilyOwner() {
  return AppState.role === 'owner';
}