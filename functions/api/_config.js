// ============================================
// _config.js — Firebase REST 設定（v103.0.0）
// 位置：functions/api/_config.js
// ============================================
// v103.0.0 重構：
//   ✅ 版本號更新（無功能變更）
//   ✅ 保留 v101.8.0 全部功能
// ============================================

export const FIREBASE_DB_URL = 'https://family-fin-a6dd1-default-rtdb.asia-southeast1.firebasedatabase.app';
export const SUPERADMIN_EMAIL = 'superadmin@familyfin.local';
export const FIREBASE_API_KEY = 'AIzaSyCQlrNdorKJI9xsqr4m4ME046lrubo9Y7I';
export const IDENTITY_TOOLKIT_URL = 'https://identitytoolkit.googleapis.com/v1';

/* ============================================
   REST 基本操作
   ============================================ */

export async function dbGet(path, token = '') {
  const url = `${FIREBASE_DB_URL}/${path}.json${token ? `?auth=${token}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

export async function dbPut(path, data, token = '') {
  const url = `${FIREBASE_DB_URL}/${path}.json${token ? `?auth=${token}` : ''}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.ok;
}

export async function dbPatch(path, data, token = '') {
  const url = `${FIREBASE_DB_URL}/${path}.json${token ? `?auth=${token}` : ''}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.ok;
}

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

export async function dbDelete(path, token = '') {
  const url = `${FIREBASE_DB_URL}/${path}.json${token ? `?auth=${token}` : ''}`;
  const res = await fetch(url, { method: 'DELETE' });
  return res.ok;
}

/* ============================================
   Firebase Auth 操作（Identity Toolkit REST）
   ============================================ */

export async function dbSignUp(email, password) {
  try {
    const url = `${IDENTITY_TOOLKIT_URL}/accounts:signUp?key=${FIREBASE_API_KEY}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: false }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data?.error?.message || 'UNKNOWN_ERROR' };
    }
    return { ok: true, uid: data.localId, email: data.email };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}

export async function dbEmailExists(email) {
  // Identity Toolkit 無直接查詢 API，由呼叫端處理
  return false;
}

/* ============================================
   回應工具
   ============================================ */

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
