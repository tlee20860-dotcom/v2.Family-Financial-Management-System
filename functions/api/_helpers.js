// ============================================
// _helpers.js — API 共用輔助函式（v101.2）
// 位置：functions/api/_helpers.js
// ============================================
// v101.2 修正：
//   ✅ 就地定義 handleOptions（不用 re-export）
//   ✅ 避免 Cloudflare bundler 不支援 re-export 的問題
// ============================================

import { SUPERADMIN_EMAIL, jsonResponse } from './_config.js';

/* ============================================
   CORS preflight 處理（就地定義）
   ============================================ */
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

/* ============================================
   常數
   ============================================ */

// ⚠️ 與 js/config/firebase-config.js 的 apiKey 一致
const FIREBASE_API_KEY = 'AIzaSyCQlrNdorKJI9xsqr4m4ME046lrubo9Y7I';

const IDENTITY_TOOLKIT_URL =
  'https://identitytoolkit.googleapis.com/v1/accounts:lookup';

/* ============================================
   0. Token 快取
   ============================================ */

const _tokenCache = new Map();
const _TOKEN_CACHE_MS = 60 * 1000;

/* ============================================
   1. Token 解析
   ============================================ */

export function extractToken(request) {
  const authHeader = request.headers.get('Authorization') || '';
  return authHeader.replace('Bearer ', '').trim();
}

/* ============================================
   2. Token 驗證
   ============================================ */

export async function verifyToken(token) {
  if (!token) return null;

  const cached = _tokenCache.get(token);
  if (cached && cached.expireAt > Date.now()) {
    return cached.user;
  }

  try {
    const res = await fetch(`${IDENTITY_TOOLKIT_URL}?key=${FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
    });

    if (!res.ok) {
      console.warn('[_helpers] verifyToken 回應非 OK：', res.status);
      return null;
    }

    const data = await res.json();
    const user = data?.users?.[0] || null;

    if (user) {
      _tokenCache.set(token, {
        user,
        expireAt: Date.now() + _TOKEN_CACHE_MS,
      });
    }

    return user;
  } catch (err) {
    console.warn('[_helpers] verifyToken 失敗：', err);
    return null;
  }
}

/* ============================================
   3. 權限驗證
   ============================================ */

export async function verifySuperAdmin(token) {
  const user = await verifyToken(token);
  if (!user) return null;
  if (user.email !== SUPERADMIN_EMAIL) return null;
  return user;
}

export async function verifyFamilyAccess(token, familyId) {
  if (!familyId) return null;

  const user = await verifyToken(token);
  if (!user) return null;

  const isSuper = user.email === SUPERADMIN_EMAIL;
  if (isSuper) return { user, isSuper: true };

  if (user.localId !== familyId) return null;
  return { user, isSuper: false };
}

/* ============================================
   4. 必填欄位檢查
   ============================================ */

export function requireFields(body, fields) {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'INVALID_BODY', fields };
  }

  const missing = fields.filter((f) => {
    const v = body[f];
    return v === '' || v == null;
  });

  if (missing.length > 0) {
    return { ok: false, error: 'MISSING_FIELDS', fields: missing };
  }
  return null;
}

/* ============================================
   5. 錯誤回應
   ============================================ */

export function errorResponse(code, message = '', status) {
  const statusMap = {
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    MISSING_FIELDS: 400,
    INVALID_BODY: 400,
    BAD_REQUEST: 400,
    NOT_FOUND: 404,
    CONFLICT: 409,
    INTERNAL: 500,
  };

  const httpStatus = status || statusMap[code] || 500;

  const body = { ok: false, error: code };
  if (message) body.message = message;

  return jsonResponse(body, httpStatus);
}

export function handleError(err) {
  console.error('[_helpers] API error:', err);
  return errorResponse('INTERNAL', String(err?.message || err));
}

export function successResponse(data = {}) {
  return jsonResponse({ ok: true, ...data });
}

/* ============================================
   6. 通用驗證流程
   ============================================ */

export async function authenticate(request, options = {}) {
  const { body, requiredFields, needSuperAdmin, needFamily } = options;

  const token = extractToken(request);

  if (requiredFields && body) {
    const missingResult = requireFields(body, requiredFields);
    if (missingResult) return errorResponse('MISSING_FIELDS', '', 400);
  }

  if (needSuperAdmin) {
    const user = await verifySuperAdmin(token);
    if (!user) return errorResponse('FORBIDDEN', '需要超級管理員權限');
    return { token, user, isSuper: true };
  }

  if (needFamily) {
    const familyId = body?.familyId;
    if (!familyId) return errorResponse('MISSING_FIELDS', 'familyId 為必填');
    const result = await verifyFamilyAccess(token, familyId);
    if (!result) return errorResponse('FORBIDDEN', '無權存取此家庭');
    return { token, user: result.user, isSuper: result.isSuper };
  }

  const user = await verifyToken(token);
  if (!user) return errorResponse('UNAUTHORIZED', '請重新登入');
  return { token, user, isSuper: user.email === SUPERADMIN_EMAIL };
}

/* ============================================
   7. 資料工具
   ============================================ */

export function filterEmpty(obj) {
  if (!obj || typeof obj !== 'object') return {};
  const out = {};
  Object.entries(obj).forEach(([k, v]) => {
    if (v != null) out[k] = v;
  });
  return out;
}

export function objToList(obj, sortFn) {
  const list = Object.entries(obj || {}).map(([id, x]) => ({ id, ...x }));
  if (typeof sortFn === 'function') list.sort(sortFn);
  return list;
}

export function roundInt(v) {
  return Math.round(Number(v) || 0);
}