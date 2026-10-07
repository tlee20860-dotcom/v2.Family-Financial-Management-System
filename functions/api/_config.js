// ============================================
// _config.js — 所有 Functions 共用的 Firebase REST 設定（v101）
// 位置：functions/api/_config.js
// ============================================
// v101 修正：
//   ✅ 補 Access-Control-Allow-Methods / Headers
//   ✅ 新增 dbPatch / dbPush
//   ✅ 新增 OPTIONS preflight 處理 helper
//   ✅ 錯誤回應標準化
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
 * 🆕 v101：部分更新（PATCH）
 * 只更新指定欄位，未指定的保留
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
 * 🆕 v101：自動產生 key 並寫入（POST）
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

/**
 * 處理 CORS preflight
 */
export function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}