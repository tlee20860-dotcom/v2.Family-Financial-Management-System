// ============================================
// auth-guard.js — 路由守衛（v103.0.11）
// 位置：js/core/auth-guard.js
// ============================================
// v103.0.11 修正：
//   ✅ [H10] fallback 改為「唯讀模式」（canInput = false）
//   ✅ [H10] 加 toast 提示使用者網路異常
// ============================================

import { watchAuth, isSuperAdmin } from './auth.js';
import { AppState } from './state.js';
import { api } from './api.js';
import { SESSION_KEYS, ROUTES, ROLES } from '../config/constants.js';

const AUTH_CONTEXT_CACHE_PREFIX = SESSION_KEYS.AUTH_CONTEXT_PREFIX;
const AUTH_CONTEXT_TTL_MS = 5 * 60 * 1000;

/* ============================================
   主入口
   ============================================ */
export function requireLogin({ requireFamily = true } = {}) {
  return new Promise((resolve) => {
    let resolved = false;

    const unsubscribe = watchAuth(async (user) => {
      if (resolved) return;
      resolved = true;

      try { unsubscribe(); } catch (e) { /* noop */ }

      /* ---------- 1. 未登入 ---------- */
      if (!user) {
        _clearAllAuthContexts();
        window.location.href = ROUTES.LOGIN;
        resolve(null);
        return;
      }

      AppState.setUser(user);
      const superAdmin = isSuperAdmin(user);
      AppState.setSuperAdmin(superAdmin);

      /* ---------- 2. superadmin ---------- */
      if (superAdmin) {
        AppState.setRole(ROLES.SUPERADMIN);
        AppState.setCanInput(true);
        AppState.setDisplayName('超級管理員');

        if (requireFamily && !AppState.getFamilyId()) {
          window.location.href = ROUTES.ADMIN;
          resolve(null);
          return;
        }

        resolve(user);
        return;
      }

      /* ---------- 3. 讀快取 ---------- */
      const cached = _readAuthContextCache(user.uid);
      if (cached) {
        _applyAuthContext(cached);
        resolve(user);
        return;
      }

      /* ---------- 4. 呼叫 lookupFamily ---------- */
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

        // 4a. 401
        if (status === 401 || code === 'UNAUTHORIZED') {
          resolve(null);
          return;
        }

        // 4b. 明確拒絕
        if (
          status === 403 || code === 'FORBIDDEN' ||
          status === 404 || code === 'NOT_FOUND'
        ) {
          console.warn('[auth-guard] lookupFamily 明確拒絕：', code, err.message);
          alert(
            '無法查詢您的家庭資訊。\n\n' +
            '若您認為這是錯誤，請聯繫平台管理員。'
          );
          window.location.href = ROUTES.LOGIN;
          resolve(null);
          return;
        }

        // 4c. 網路錯誤 / 5xx → fallback（唯讀）
        console.warn('[auth-guard] lookupFamily 網路失敗，將使用 fallback（唯讀模式）：', err.message);
      }

      /* ---------- 5. fallback（唯讀） ---------- */
      _applyFallbackContext(user);
      _notifyFallback();
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

/**
 * 🆕 v103.0.11 [H10]：fallback 為唯讀模式
 */
function _applyFallbackContext(user) {
  AppState.setFamily(user.uid, '我的家庭', user.uid);
  AppState.setRole(ROLES.MEMBER);
  AppState.setCanInput(false);
  AppState.setDisplayName(user.email?.split('@')[0] || '成員');
  AppState.setMemberAccount({
    email: user.email || '',
    displayName: AppState.getDisplayName(),
    role: ROLES.MEMBER,
    canInput: false,
  });
}

/**
 * 🆕 v103.0.11 [H10]：提示使用者
 */
async function _notifyFallback() {
  try {
    const mod = await import('../ui/toast.js');
    if (mod && typeof mod.showToast === 'function') {
      mod.showToast('⚠️ 網路不穩，已進入唯讀模式', 'warning', 5000);
    }
  } catch (e) { /* noop */ }
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

export function clearAuthContextCache(uid) {
  if (!uid) return;
  try {
    sessionStorage.removeItem(`${AUTH_CONTEXT_CACHE_PREFIX}${uid}`);
  } catch (e) { /* noop */ }
}

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
  return AppState.role === ROLES.OWNER;
}