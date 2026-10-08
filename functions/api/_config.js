// ============================================
// _config.js — 所有 Functions 共用的 Firebase REST 設定（v101.8.0）
// 位置：functions/api/_config.js
// ============================================
// v101.8.0 新增：
//   ✅ dbSignUp(email, password) — 建立 Firebase Auth 帳號（用 Identity Toolkit REST）
//   ✅ dbDeleteAccount() — 保留（需 Admin SDK，暫不使用）
//   ✅ FIREBASE_API_KEY 常量
//   ✅ IDENTITY_TOOLKIT_URL 常量
// ============================================

export const FIREBASE_DB_URL = 'https://family-fin-a6dd1-default-rtdb.asia-southeast1.firebasedatabase.app';
export const SUPERADMIN_EMAIL = 'superadmin@familyfin.local';

// ⚠️ 與 js/config/firebase-config.js 的 apiKey 一致
export const FIREBASE_API_KEY = 'AIzaSyCQlrNdorKJI9xsqr4m4ME046lrubo9Y7I';

export const IDENTITY_TOOLKIT_URL = 'https://identitytoolkit.googleapis.com/v1';

/* ============================================
   REST 基本操作
   ============================================ */

/**
 * 讀取節點
 * @param {string} path - 相對於 DB root
 * @param {string} [token] - Firebase ID token
 */
export async function dbGet(path, token = '') {
  const url = `${FIREBASE_DB_URL}/${path}.json${token ? `?auth=${token}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

/**
 * 覆寫節點（PUT）
 */
export async function dbPut(path, data, token = '') {
  const url = `${FIREBASE_DB_URL}/${path}.json${token ? `?auth=${token}` : ''}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.ok;
}

/**
 * 部分更新（PATCH）
 */
export async function dbPatch(path, data, token = '') {
  const url = `${FIREBASE_DB_URL}/${path}.json${token ? `?auth=${token}` : ''}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.ok;
}

/**
 * 自動產生 key 並寫入（POST）
 * @returns {string|null} 新產生的 key，失敗回傳 null
 */
export async function dbPush(path, data, token = '') {
  const url = `${FIREBASE_DB_URL}/${path}.json${token ? `?auth=${token}` : ''}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) return null;
  const result = await res.json();
  return result?.name || null;
}

/**
 * 刪除節點
 */
export async function dbDelete(path, token = '') {
  const url = `${FIREBASE_DB_URL}/${path}.json${token ? `?auth=${token}` : ''}`;
  const res = await fetch(url, { method: 'DELETE' });
  return res.ok;
}

/* ============================================
   Firebase Auth 操作（Identity Toolkit REST）
   ============================================ */

/**
 * 建立 Firebase Auth 帳號
 * 使用 Identity Toolkit REST API（不需 Admin SDK）
 *
 * @param {string} email - 完整 email（如 wife@familyfin.local）
 * @param {string} password - 密碼（至少 6 位）
 * @returns {Promise<{ ok: boolean, uid?: string, email?: string, error?: string }>}
 */
export async function dbSignUp(email, password) {
  try {
    const url = `${IDENTITY_TOOLKIT_URL}/accounts:signUp?key=${FIREBASE_API_KEY}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: false,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      const errMsg = data?.error?.message || 'UNKNOWN_ERROR';
      return { ok: false, error: errMsg };
    }

    return {
      ok: true,
      uid: data.localId,
      email: data.email,
    };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}

/**
 * 檢查 Email 是否已存在（用於建立前驗證）
 * @param {string} email
 * @returns {Promise<boolean>}
 */
export async function dbEmailExists(email) {
  // Identity Toolkit 無直接查詢 API，需用 signInWithPassword 測試
  // 或使用 accounts:lookup（需 idToken）
  // 這裡暫不實作，由呼叫端處理
  return false;
}

/* ============================================
   回應工具
   ============================================ */

/**
 * JSON 回應（含 CORS）
 */
export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}