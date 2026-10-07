// ============================================
// _helpers.js — API 共用輔助函式（v101）
// 位置：functions/api/_helpers.js
// ============================================
// v101.1 修正：
//   ✅ 補上 Firebase Web API Key（verifyToken 需要）
//   ✅ 加 token 快取（同一請求內避免重複驗證）
// ============================================

import { SUPERADMIN_EMAIL, jsonResponse } from './_config.js';

/* ============================================
   常數
   ============================================ */

// ⚠️ 與 js/config/firebase-config.js 的 apiKey 一致
const FIREBASE_API_KEY = 'AIzaSyCQlrNdorKJI9xsqr4m4ME046lrubo9Y7I';

const IDENTITY_TOOLKIT_URL =
  'https://identitytoolkit.googleapis.com/v1/accounts:lookup';

/* ============================================
   0. Token 快取（同一請求內避免重複驗證）
   ============================================ */

const _tokenCache = new Map();   // token → { user, expireAt }
const _TOKEN_CACHE_MS = 60 * 1000;   // 快取 60 秒

/* ============================================
   1. Token 解析
   ============================================ */

/**
 * 從請求中取出 Firebase ID token
 * @param {Request} request
 * @returns {string} token 或空字串
 */
export function extractToken(request) {
  const authHeader = request.headers.get('Authorization') || '';
  return authHeader.replace('Bearer ', '').trim();
}

/* ============================================
   2. Token 驗證（透過 Firebase Identity Toolkit）
   ============================================ */

/**
 * 驗證 token 並取得使用者資訊
 * @param {string} token
 * @returns {Promise<Object|null>} { localId, email, ... } 或 null
 */
export async function verifyToken(token) {
  if (!token) return null;

  // 快取檢查
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

    // 存入快取
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

/**
 * 驗證是否為超級管理員
 * @param {string} token
 * @returns {Promise<Object|null>} 使用者物件或 null
 */
export async function verifySuperAdmin(token) {
  const user = await verifyToken(token);
  if (!user) return null;
  if (user.email !== SUPERADMIN_EMAIL) return null;
  return user;
}

/**
 * 驗證是否可存取某家庭
 * - superadmin：可存取所有家庭
 * - 一般帳號：僅可存取自己（uid === familyId）
 *
 * @param {string} token
 * @param {string} familyId
 * @returns {Promise<{ user: Object, isSuper: boolean } | null>}
 */
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

/**
 * 檢查必填欄位
 * @param {Object} body
 * @param {string[]} fields
 * @returns {Object|null} 缺漏時回傳 { ok: false, error: 'MISSING_FIELDS', fields: [...] }，否則 null
 */
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
   5. 錯誤回應（標準化）
   ============================================ */

/**
 * 回應錯誤（統一格式）
 * @param {string} code - 錯誤代碼（UNAUTHORIZED / FORBIDDEN / MISSING_FIELDS / NOT_FOUND / INTERNAL）
 * @param {string} [message] - 補充訊息
 * @param {number} [status] - HTTP 狀態碼（依 code 自動決定）
 * @returns {Response}
 */
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

/**
 * 全域錯誤處理（catch 用）
 * @param {Error} err
 * @returns {Response}
 */
export function handleError(err) {
  console.error('[_helpers] API error:', err);
  return errorResponse('INTERNAL', String(err?.message || err));
}

/**
 * 回應成功
 */
export function successResponse(data = {}) {
  return jsonResponse({ ok: true, ...data });
}

/* ============================================
   6. 通用驗證流程
   ============================================ */

/**
 * 快速驗證鏈：解析 token + 檢查必填
 * 若驗證失敗直接回傳 Response，呼叫端可 `if (response) return response;`
 *
 * @param {Request} request
 * @param {Object} [options]
 * @param {Object} [options.body] - 已解析的 body
 * @param {string[]} [options.requiredFields] - 必填欄位
 * @param {boolean} [options.needSuperAdmin] - 是否需 superadmin
 * @param {boolean} [options.needFamily] - 是否需家庭權限（從 body.familyId 取）
 * @returns {Promise<{ token: string, user: Object, isSuper: boolean } | Response>}
 */
export async function authenticate(request, options = {}) {
  const { body, requiredFields, needSuperAdmin, needFamily } = options;

  const token = extractToken(request);

  // 必填檢查
  if (requiredFields && body) {
    const missingResult = requireFields(body, requiredFields);
    if (missingResult) return errorResponse('MISSING_FIELDS', '', 400);
  }

  // Superadmin 檢查
  if (needSuperAdmin) {
    const user = await verifySuperAdmin(token);
    if (!user) return errorResponse('FORBIDDEN', '需要超級管理員權限');
    return { token, user, isSuper: true };
  }

  // 家庭權限檢查
  if (needFamily) {
    const familyId = body?.familyId;
    if (!familyId) return errorResponse('MISSING_FIELDS', 'familyId 為必填');
    const result = await verifyFamilyAccess(token, familyId);
    if (!result) return errorResponse('FORBIDDEN', '無權存取此家庭');
    return { token, user: result.user, isSuper: result.isSuper };
  }

  // 基本 token 檢查
  const user = await verifyToken(token);
  if (!user) return errorResponse('UNAUTHORIZED', '請重新登入');
  return { token, user, isSuper: user.email === SUPERADMIN_EMAIL };
}

/* ============================================
   7. 資料工具
   ============================================ */

/**
 * 過濾空物件（Firebase 常見：null / {} 需排除）
 */
export function filterEmpty(obj) {
  if (!obj || typeof obj !== 'object') return {};
  const out = {};
  Object.entries(obj).forEach(([k, v]) => {
    if (v != null) out[k] = v;
  });
  return out;
}

/**
 * 將 Firebase 物件轉為陣列（含 id）
 */
export function objToList(obj, sortFn) {
  const list = Object.entries(obj || {}).map(([id, x]) => ({ id, ...x }));
  if (typeof sortFn === 'function') list.sort(sortFn);
  return list;
}

/**
 * 整數化（金額用）
 */
export function roundInt(v) {
  return Math.round(Number(v) || 0);
}