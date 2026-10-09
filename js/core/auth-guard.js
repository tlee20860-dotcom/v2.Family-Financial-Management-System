// ============================================
// auth-guard.js — 路由守衛（v101.10.0）
// 位置：js/core/auth-guard.js
// ============================================
// v101.10.0 修正：
//   ✅ [P1-4] fallback 策略改為「僅網路錯誤」時使用
//       - NOT_FOUND / FORBIDDEN → 拒絕存取
//       - 網路錯誤 / 5xx → fallback 到 UID = familyId
//   ✅ [效能] sessionStorage 快取 lookupFamily 結果（TTL 5 分鐘）
//       - 切頁時不再重複呼叫 lookupFamily API
//   ✅ 匯出 clearAuthContextCache(uid) 供登出使用
// ============================================

import { watchAuth, isSuperAdmin } from './auth.js';
import { AppState } from './state.js';
import { api } from './api.js';

/* ============================================
   快取設定
   ============================================ */
const AUTH_CONTEXT_CACHE_PREFIX = 'fin_auth_context_';
const AUTH_CONTEXT_TTL_MS = 5 * 60 * 1000;   // 5 分鐘

/* ============================================
   主入口
   ============================================ */

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

      // 取消監聽
      try { unsubscribe(); } catch (e) { /* noop */ }

      /* ============================================
         1. 未登入 → 清除快取 + 導向 login
         ============================================ */
      if (!user) {
        _clearAllAuthContexts();
        window.location.href = 'login.html';
        resolve(null);
        return;
      }

      // 設定使用者狀態
      AppState.setUser(user);
      const superAdmin = isSuperAdmin(user);
      AppState.setSuperAdmin(superAdmin);

      /* ============================================
         2. superadmin
         ============================================ */
      if (superAdmin) {
        AppState.setRole('superadmin');
        AppState.setCanInput(true);
        AppState.setDisplayName('超級管理員');

        if (requireFamily && !AppState.getFamilyId()) {
          window.location.href = 'admin.html';
          resolve(null);
          return;
        }

        resolve(user);
        return;
      }

      /* ============================================
         3. 一般帳號 → 優先讀快取
         ============================================ */
      const cached = _readAuthContextCache(user.uid);
      if (cached) {
        _applyAuthContext(cached);
        resolve(user);
        return;
      }

      /* ============================================
         4. 快取未命中 → 呼叫 lookupFamily
         ============================================ */
      try {
        const result = await api.lookupFamily();

        if (result && result.familyId) {
          const ctx = {
            familyId: result.familyId,
            familyName: result.familyName || '我的家庭',
            memberAccount: result.memberAccount,
            ownerUid: result.isLegacy ? result.familyId : undefined,
          };

          _writeAuthContextCache(user.uid, ctx);
          _applyAuthContext(ctx);
          resolve(user);
          return;
        }
      } catch (err) {
        const status = err?.status;
        const code = err?.code;

        // 4a. 401 → api.js 已導向 login
        if (status === 401 || code === 'UNAUTHORIZED') {
          resolve(null);
          return;
        }

        // 4b. 明確拒絕（v101.10.0：不再 fallback）
        if (
          status === 403 || code === 'FORBIDDEN' ||
          status === 404 || code === 'NOT_FOUND'
        ) {
          console.warn('[auth-guard] lookupFamily 明確拒絕：', code, err.message);
          alert(
            '無法查詢您的家庭資訊。\n\n' +
            '若您認為這是錯誤，請聯繫平台管理員。'
          );
          window.location.href = 'login.html';
          resolve(null);
          return;
        }

        // 4c. 網路錯誤 / 5xx → fallback
        console.warn('[auth-guard] lookupFamily 網路失敗，將使用 fallback：', err.message);
      }

      /* ============================================
         5. fallback（僅網路錯誤時使用）
         ============================================ */
      _applyFallbackContext(user);
      resolve(user);
    });
  });
}

/* ============================================
   內部：套用 Auth Context
   ============================================ */
function _applyAuthContext(ctx) {
  AppState.setAccountContext({
    familyId: ctx.familyId,
    familyName: ctx.familyName,
    memberAccount: ctx.memberAccount,
    ownerUid: ctx.ownerUid,
  });
}

function _applyFallbackContext(user) {
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

/* ============================================
   內部：sessionStorage 快取
   ============================================ */
function _readAuthContextCache(uid) {
  if (!uid) return null;
  try {
    const raw = sessionStorage.getItem(`${AUTH_CONTEXT_CACHE_PREFIX}${uid}`);
    if (!raw) return null;

    const data = JSON.parse(raw);
    if (!data || !data.cachedAt) return null;

    // TTL 檢查
    if (Date.now() - data.cachedAt > AUTH_CONTEXT_TTL_MS) {
      sessionStorage.removeItem(`${AUTH_CONTEXT_CACHE_PREFIX}${uid}`);
      return null;
    }

    return data;
  } catch (e) {
    return null;
  }
}

function _writeAuthContextCache(uid, ctx) {
  if (!uid) return;
  try {
    sessionStorage.setItem(
      `${AUTH_CONTEXT_CACHE_PREFIX}${uid}`,
      JSON.stringify({ ...ctx, cachedAt: Date.now() })
    );
  } catch (e) { /* noop */ }
}

function _clearAllAuthContexts() {
  try {
    const keys = Object.keys(sessionStorage);
    keys.forEach((k) => {
      if (k.startsWith(AUTH_CONTEXT_CACHE_PREFIX)) {
        sessionStorage.removeItem(k);
      }
    });
  } catch (e) { /* noop */ }
}

/**
 * v101.10.0：清除指定 UID 的 auth-context 快取
 * 供登出、帳號被移除 / 更新時呼叫
 */
export function clearAuthContextCache(uid) {
  if (!uid) return;
  try {
    sessionStorage.removeItem(`${AUTH_CONTEXT_CACHE_PREFIX}${uid}`);
  } catch (e) { /* noop */ }
}

/**
 * v101.10.0：清除所有 auth-context 快取
 * 供強制重新登入時使用
 */
export function clearAllAuthContexts() {
  _clearAllAuthContexts();
}

/* ============================================
   向後相容 API
   ============================================ */

export function isLoggedIn() {
  return !!AppState.currentUser;
}

export function checkSuperAdmin() {
  return !!AppState.isSuperAdmin;
}

export function canInput() {
  return !!AppState.canInput;
}

export function isFamilyOwner() {
  return AppState.role === 'owner';
}