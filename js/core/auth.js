// ============================================
// auth.js — 自訂帳號登入 / 登出 封裝（v103.0.0）
// 位置：js/core/auth.js
// ============================================
// v103.0.0 重構：
//   ✅ 版本號更新（無功能變更）
//   ✅ 匯入 ROUTES 統一登入導向
//   ✅ 保留 v101 全部功能
// ============================================

import { auth } from '../config/firebase-config.js';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  SUPERADMIN_DOMAIN,
  SUPERADMIN_EMAIL,
  STORAGE_KEYS,
  ROUTES,
} from '../config/constants.js';

/* ============================================
   帳號 <-> Email 轉換
   ============================================ */

/**
 * 帳號 → Email
 * @param {string} account - 帳號（可不含 @）
 * @returns {string}
 */
export function toEmail(account) {
  if (!account) return '';
  return account.includes('@') ? account : `${account}${SUPERADMIN_DOMAIN}`;
}

/**
 * Email → 帳號
 * @param {string} email
 * @returns {string}
 */
export function toAccount(email) {
  if (!email) return '';
  return email.replace(SUPERADMIN_DOMAIN, '');
}

/* ============================================
   登入 / 登出
   ============================================ */

/**
 * 使用自訂帳號登入
 * @param {string} account - 帳號
 * @param {string} password - 密碼
 * @returns {Promise<Object>} Firebase user
 */
export async function loginWithCustomAccount(account, password) {
  const email = toEmail(account);
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

/**
 * 登出並清理 localStorage
 */
export async function logout() {
  try {
    await signOut(auth);
  } catch (err) {
    console.warn('[auth] signOut 失敗：', err);
  }

  localStorage.removeItem(STORAGE_KEYS.FAMILY_ID);
  localStorage.removeItem(STORAGE_KEYS.FAMILY_NAME);
  window.location.href = ROUTES.LOGIN;
}

/* ============================================
   監聽 / 查詢
   ============================================ */

/**
 * 監聽登入狀態
 * @param {Function} callback - (user) => void
 * @returns {Function} unsubscribe
 */
export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

/**
 * 取得顯示名稱（帳號部分）
 * @param {Object} user - Firebase user
 * @returns {string}
 */
export function getDisplayName(user) {
  return user ? toAccount(user.email) : '';
}

/**
 * 判斷是否為超級管理員
 * @param {Object} user - Firebase user
 * @returns {boolean}
 */
export function isSuperAdmin(user) {
  return !!user && user.email === SUPERADMIN_EMAIL;
}

/* ============================================
   匯出常數（給其他模組使用）
   ============================================ */
export { SUPERADMIN_DOMAIN, SUPERADMIN_EMAIL };
