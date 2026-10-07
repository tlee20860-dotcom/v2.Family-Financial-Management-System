// ============================================
// _config.js — 所有 Functions 共用的 Firebase REST 設定（v101.5）
// 位置：functions/api/_config.js
// ============================================
// v101.5 修正：
//   ✅ 移除未被使用的 handleOptions（改用 _helpers.js 的）
//   ✅ 保留 REST 操作（GET / PUT / PATCH / POST / DELETE）
//   ✅ 保留 jsonResponse / CORS 設定
// ============================================

export const FIREBASE_DB_URL = 'https://family-fin-a6dd1-default-rtdb.asia-southeast1.firebasedatabase.app';
export const SUPERADMIN_EMAIL = 'superadmin@familyfin.local';

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