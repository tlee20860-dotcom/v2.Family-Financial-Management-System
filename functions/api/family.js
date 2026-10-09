// ============================================
// family.js — 家庭設定 + 帳號 + lookup（v103.0.1）
// 位置：functions/api/family.js
// ============================================
// v103.0.1 修復：
//   ✅ onRequestGet 依 pathname 分派：
//       - /api/family-accounts  → 帳號列表
//       - /api/family-settings  → 家庭設定
//   ✅ onRequestPost 依 pathname + action 分派：
//       - /api/lookup-family    → 查詢所屬家庭
//       - /api/family-accounts  → 帳號 CRUD
//       - /api/family-settings  → 家庭設定 CRUD
// ============================================

import {
  dbGet, dbPut, dbPush, dbDelete, dbSignUp,
  FIREBASE_API_KEY, IDENTITY_TOOLKIT_URL,
} from './_config.js';
import {
  authenticate, errorResponse, handleError, handleOptions,
  successResponse, requireFields, objToList,
  verifySuperAdmin, verifyFamilyAccess,
  verifyFamilyAccessByUid, extractToken,
} from './_helpers.js';

/* ============================================
   GET — 依 pathname 分派
   ============================================ */
export async function onRequestGet(context) {
  try {
    const { request } = context;
    const url = new URL(request.url);
    const path = url.pathname;
    const familyId = url.searchParams.get('familyId');

    /* /api/family-accounts */
    if (path.endsWith('/family-accounts')) {
      return await _listAccounts(request, familyId);
    }

    /* /api/family-settings（預設） */
    return await _getSettings(request, familyId);
  } catch (err) {
    return handleError(err);
  }
}

/* ============================================
   POST — 依 pathname + action 分派
   ============================================ */
export async function onRequestPost(context) {
  try {
    const { request } = context;
    const url = new URL(request.url);
    const path = url.pathname;

    let body = {};
    try {
      body = await request.json();
    } catch (e) {
      body = {};
    }

    const { action } = body || {};

    /* /api/lookup-family：無 action */
    if (path.endsWith('/lookup-family') || action === undefined || action === null) {
      return await _lookupFamily(request);
    }

    /* /api/family-accounts */
    if (path.endsWith('/family-accounts')) {
      switch (action) {
        case 'create':  return await _createAccount(request, body);
        case 'restore': return await _restoreAccount(request, body);
        case 'update':  return await _updateAccount(request, body);
        case 'remove':  return await _removeAccount(request, body);
        default:
          return errorResponse('BAD_REQUEST', `未知的 action：${action}`);
      }
    }

    /* /api/family-settings */
    if (path.endsWith('/family-settings')) {
      switch (action) {
        case 'update':        return await _updateSettings(request, body);
        case 'put-status':    return await _putStatus(request, body);
        case 'delete-status': return await _deleteStatus(request, body);
        default:
          return errorResponse('BAD_REQUEST', `未知的 action：${action}`);
      }
    }

    return errorResponse('BAD_REQUEST', `未知的路徑：${path}`);
  } catch (err) {
    return handleError(err);
  }
}

export async function onRequestOptions() {
  return handleOptions();
}

/* ============================================
   1. 家庭設定 GET
   ============================================ */
async function _getSettings(request, familyId) {
  if (!familyId) return errorResponse('MISSING_FIELDS', '缺少 familyId');

  const auth = await authenticate(request, { needFamily: true });
  if (auth instanceof Response) return auth;
  const { token } = auth;

  const basePath = `families/${familyId}`;
  const [statuses, options, yearRange, uiConstants] = await Promise.all([
    dbGet(`${basePath}/statuses`, token),
    dbGet(`${basePath}/settings/options`, token),
    dbGet(`${basePath}/settings/year_range`, token),
    dbGet(`${basePath}/settings/ui_constants`, token),
  ]);

  return successResponse({
    familyId,
    statuses: objToList(statuses || {}, _byOrder),
    options: options || null,
    yearRange: yearRange || null,
    uiConstants: uiConstants || null,
  });
}

/* ============================================
   2. 家庭設定 UPDATE / PUT-STATUS / DELETE-STATUS
   ============================================ */
async function _updateSettings(request, body) {
  const { familyId, data } = body;
  if (!familyId) return errorResponse('MISSING_FIELDS', '缺少 familyId');

  const auth = await authenticate(request, { needFamily: true, body });
  if (auth instanceof Response) return auth;
  const { token } = auth;

  const basePath = `families/${familyId}`;
  if (!data || typeof data !== 'object') return errorResponse('MISSING_FIELDS', '缺少 data');

  const results = {};
  if (data.options !== undefined) {
    results.options = await dbPut(`${basePath}/settings/options`, _sanitizeOptions(data.options), token);
  }
  if (data.yearRange !== undefined) {
    results.yearRange = await dbPut(`${basePath}/settings/year_range`, _sanitizeYearRange(data.yearRange), token);
  }
  if (data.uiConstants !== undefined) {
    results.uiConstants = await dbPut(`${basePath}/settings/ui_constants`, _sanitizeUIConstants(data.uiConstants), token);
  }

  if (Object.values(results).some((v) => v === false)) {
    return errorResponse('INTERNAL', '部分寫入失敗');
  }
  return successResponse({ results });
}

async function _putStatus(request, body) {
  const { familyId, id, data } = body;
  if (!familyId) return errorResponse('MISSING_FIELDS', '缺少 familyId');
  if (!data || typeof data !== 'object') return errorResponse('MISSING_FIELDS', '缺少 data');
  if (!data.name) return errorResponse('MISSING_FIELDS', '缺少 data.name');

  const auth = await authenticate(request, { needFamily: true, body });
  if (auth instanceof Response) return auth;
  const { token } = auth;

  const clean = {
    name: String(data.name).trim(),
    category: ['personal', 'fixed', 'insurance'].includes(data.category) ? data.category : 'personal',
    isDone: !!data.isDone,
    order: Number(data.order) || 0,
    createdAt: data.createdAt || Date.now(),
  };

  let savedId = id;
  if (id) {
    const ok = await dbPut(`families/${familyId}/statuses/${id}`, clean, token);
    if (!ok) return errorResponse('INTERNAL', '寫入失敗');
  } else {
    savedId = await dbPush(`families/${familyId}/statuses`, clean, token);
    if (!savedId) return errorResponse('INTERNAL', '寫入失敗');
  }
  return successResponse({ id: savedId, data: clean });
}

async function _deleteStatus(request, body) {
  const { familyId, id } = body;
  if (!familyId) return errorResponse('MISSING_FIELDS', '缺少 familyId');
  if (!id) return errorResponse('MISSING_FIELDS', '缺少 id');

  const auth = await authenticate(request, { needFamily: true, body });
  if (auth instanceof Response) return auth;
  const { token } = auth;

  const ok = await dbDelete(`families/${familyId}/statuses/${id}`, token);
  if (!ok) return errorResponse('INTERNAL', '刪除失敗');
  return successResponse({ deletedId: id });
}

/* ============================================
   3. 帳號 LIST
   ============================================ */
async function _listAccounts(request, familyId) {
  if (!familyId) return errorResponse('MISSING_FIELDS', '缺少 familyId');

  const token = extractToken(request);
  const superUser = await verifySuperAdmin(token);
  let authorized = false;
  if (superUser) authorized = true;
  else if (await verifyFamilyAccess(token, familyId)) authorized = true;

  if (!authorized) return errorResponse('FORBIDDEN', '無權存取此家庭的帳號列表');

  const accountsSnap = await dbGet(`platform/families/${familyId}/memberAccounts`, token);
  const accounts = objToList(accountsSnap || {}, (a, b) => (a.createdAt || 0) - (b.createdAt || 0));

  return successResponse({ familyId, accounts, count: accounts.length });
}

/* ============================================
   4. 帳號 CREATE
   ============================================ */
async function _createAccount(request, body) {
  const { familyId, account, password, displayName, role, canInput, memberId: inputMemberId } = body;
  const missing = requireFields(body, ['account', 'password', 'displayName']);
  if (missing) return errorResponse('MISSING_FIELDS', '缺少 account / password / displayName');

  const auth = await authenticate(request, { needSuperAdmin: true });
  if (auth instanceof Response) return auth;
  const { token } = auth;

  if (!familyId) return errorResponse('MISSING_FIELDS', '缺少 familyId');
  const familySnap = await dbGet(`platform/families/${familyId}`, token);
  if (!familySnap) return errorResponse('NOT_FOUND', `找不到家庭 ${familyId}`);

  const accountStr = String(account).trim().toLowerCase();
  if (!/^[a-z0-9._-]+$/.test(accountStr)) {
    return errorResponse('BAD_REQUEST', '帳號只能包含小寫英數字、點、底線、連字號');
  }
  const pwdStr = String(password);
  if (pwdStr.length < 6) return errorResponse('BAD_REQUEST', '密碼至少 6 位');

  const roleStr = role === 'owner' ? 'owner' : 'member';
  const email = `${accountStr}@familyfin.local`;

  const existing = await dbGet(`platform/email_index/${accountStr}`, token);
  if (existing) return errorResponse('CONFLICT', `帳號 ${accountStr} 已存在於平台記錄`);

  const signUpResult = await dbSignUp(email, pwdStr);
  if (!signUpResult.ok) {
    if (signUpResult.error === 'EMAIL_EXISTS') {
      return errorResponse('EMAIL_EXISTS', `帳號「${accountStr}」已存在於 Firebase 系統`, 409);
    }
    return errorResponse('INTERNAL', `建立帳號失敗：${signUpResult.error}`);
  }

  const newUid = signUpResult.uid;
  const now = Date.now();
  const memberId = String(inputMemberId || '').trim()
    || await _resolveMemberId(familyId, displayName, token);

  const accountData = {
    email, account: accountStr,
    displayName: String(displayName).trim(),
    role: roleStr, canInput: canInput !== false, memberId, createdAt: now,
  };

  const ok1 = await dbPut(`platform/families/${familyId}/memberAccounts/${newUid}`, accountData, token);
  if (!ok1) {
    return errorResponse('INTERNAL', `Firebase Auth 帳號已建立（${email}），但寫入平台記錄失敗`, 500);
  }

  const ok2 = await dbPut(`platform/uid_index/${newUid}`, familyId, token);
  if (!ok2) {
    await dbDelete(`platform/families/${familyId}/memberAccounts/${newUid}`, token);
    return errorResponse('INTERNAL', `uid_index 寫入失敗`, 500);
  }

  await dbPut(`platform/email_index/${accountStr}`, { uid: newUid, familyId }, token);
  return successResponse({ uid: newUid, account: accountData });
}

/* ============================================
   5. 帳號 RESTORE
   ============================================ */
async function _restoreAccount(request, body) {
  const { familyId, account, password, displayName, role, canInput, memberId: inputMemberId } = body;
  const missing = requireFields(body, ['account', 'password', 'displayName']);
  if (missing) return errorResponse('MISSING_FIELDS', '缺少必要欄位');

  const auth = await authenticate(request, { needSuperAdmin: true });
  if (auth instanceof Response) return auth;
  const { token } = auth;

  const accountStr = String(account).trim().toLowerCase();
  const pwdStr = String(password);
  const email = `${accountStr}@familyfin.local`;

  const existingIndex = await dbGet(`platform/email_index/${accountStr}`, token);
  if (existingIndex) return errorResponse('CONFLICT', `帳號 ${accountStr} 已在平台記錄中`);

  const signInResult = await _signInWithPassword(email, pwdStr);
  if (!signInResult.ok) {
    if (signInResult.error === 'EMAIL_NOT_FOUND') return errorResponse('NOT_FOUND', '此帳號在 Firebase 系統中不存在');
    if (signInResult.error === 'INVALID_PASSWORD' || signInResult.error === 'INVALID_LOGIN_CREDENTIALS') {
      return errorResponse('FORBIDDEN', '舊密碼錯誤');
    }
    return errorResponse('INTERNAL', `驗證失敗：${signInResult.error}`);
  }

  const uid = signInResult.uid;
  const uidIndex = await dbGet(`platform/uid_index/${uid}`, token);
  if (uidIndex) return errorResponse('CONFLICT', `此帳號已屬於家庭 ${uidIndex}`);

  const now = Date.now();
  const memberId = String(inputMemberId || '').trim()
    || await _resolveMemberId(familyId, displayName, token);

  const accountData = {
    email, account: accountStr,
    displayName: String(displayName).trim(),
    role: role === 'owner' ? 'owner' : 'member',
    canInput: canInput !== false, memberId, createdAt: now, restoredAt: now,
  };

  const ok1 = await dbPut(`platform/families/${familyId}/memberAccounts/${uid}`, accountData, token);
  if (!ok1) return errorResponse('INTERNAL', '寫入 memberAccounts 失敗');

  const ok2 = await dbPut(`platform/uid_index/${uid}`, familyId, token);
  if (!ok2) {
    await dbDelete(`platform/families/${familyId}/memberAccounts/${uid}`, token);
    return errorResponse('INTERNAL', '寫入 uid_index 失敗');
  }

  await dbPut(`platform/email_index/${accountStr}`, { uid, familyId }, token);
  return successResponse({ restored: true, uid, account: accountData });
}

/* ============================================
   6. 帳號 UPDATE
   ============================================ */
async function _updateAccount(request, body) {
  const { familyId, uid, displayName, role, canInput, memberId: inputMemberId } = body;
  if (!familyId) return errorResponse('MISSING_FIELDS', '缺少 familyId');
  if (!uid) return errorResponse('MISSING_FIELDS', '缺少 uid');

  const auth = await authenticate(request, { needSuperAdmin: true });
  if (auth instanceof Response) return auth;
  const { token } = auth;

  const existing = await dbGet(`platform/families/${familyId}/memberAccounts/${uid}`, token);
  if (!existing) return errorResponse('NOT_FOUND', '找不到此成員帳號');

  const patch = {};
  if (displayName !== undefined) {
    const dn = String(displayName).trim();
    if (!dn) return errorResponse('BAD_REQUEST', '顯示名稱不可為空');
    patch.displayName = dn;
  }
  if (role !== undefined) {
    if (role !== 'owner' && role !== 'member') return errorResponse('BAD_REQUEST', 'role 必須是 owner 或 member');
    if (role === 'owner' && existing.role !== 'owner') return errorResponse('BAD_REQUEST', '不可將成員升級為 owner');
    patch.role = role;
  }
  if (canInput !== undefined) patch.canInput = canInput === true;
  if (inputMemberId !== undefined) patch.memberId = String(inputMemberId || '').trim();

  if (Object.keys(patch).length === 0) return errorResponse('BAD_REQUEST', '沒有任何欄位要更新');
  patch.updatedAt = Date.now();

  const ok = await dbPut(`platform/families/${familyId}/memberAccounts/${uid}`, { ...existing, ...patch }, token);
  if (!ok) return errorResponse('INTERNAL', '更新失敗');
  return successResponse({ uid, patch });
}

/* ============================================
   7. 帳號 REMOVE
   ============================================ */
async function _removeAccount(request, body) {
  const { familyId, uid } = body;
  if (!familyId) return errorResponse('MISSING_FIELDS', '缺少 familyId');
  if (!uid) return errorResponse('MISSING_FIELDS', '缺少 uid');

  const auth = await authenticate(request, { needSuperAdmin: true });
  if (auth instanceof Response) return auth;
  const { token } = auth;

  const existing = await dbGet(`platform/families/${familyId}/memberAccounts/${uid}`, token);
  if (!existing) return errorResponse('NOT_FOUND', '找不到此成員帳號');
  if (existing.role === 'owner') return errorResponse('FORBIDDEN', '不可移除此家庭的主帳號（owner）');

  const ok1 = await dbDelete(`platform/families/${familyId}/memberAccounts/${uid}`, token);
  if (!ok1) return errorResponse('INTERNAL', '移除 memberAccounts 失敗');

  await dbDelete(`platform/uid_index/${uid}`, token);
  if (existing.account) await dbDelete(`platform/email_index/${existing.account}`, token);

  return successResponse({ removedUid: uid, removedAccount: existing.account });
}

/* ============================================
   8. lookup-family
   ============================================ */
async function _lookupFamily(request) {
  const auth = await authenticate(request);
  if (auth instanceof Response) return auth;
  const { user, token } = auth;

  const uid = user.localId;
  const result = await verifyFamilyAccessByUid(uid, token);
  if (!result) return errorResponse('NOT_FOUND', '此帳號不屬於任何家庭，請聯繫管理員');

  let familyName = '我的家庭';
  try {
    const familySnap = await dbGet(`platform/families/${result.familyId}`, token);
    if (familySnap?.name) familyName = familySnap.name;
  } catch (e) { /* noop */ }

  let memberAccount = result.memberAccount;
  if (!memberAccount) {
    memberAccount = {
      email: user.email || '',
      displayName: '成員',
      role: 'member',
      canInput: true,
    };
  }

  return successResponse({
    familyId: result.familyId,
    familyName,
    memberAccount,
    isLegacy: result.isLegacy,
  });
}

/* ============================================
   9. 內部工具
   ============================================ */
const _byOrder = (a, b) => (a.order || 0) - (b.order || 0);

function _sanitizeOptions(options) {
  if (!options || typeof options !== 'object') return {};
  const clean = {};
  ['memberRoles', 'cycles', 'policyTypes', 'insurancePaymentTypes', 'categoryOrder'].forEach((key) => {
    if (Array.isArray(options[key])) clean[key] = options[key];
  });
  return clean;
}

function _sanitizeYearRange(data) {
  if (!data || typeof data !== 'object') return { startYear: null, futureYears: 5 };
  return {
    startYear: data.startYear != null && data.startYear !== '' ? Number(data.startYear) : null,
    futureYears: Number(data.futureYears) || 5,
  };
}

function _sanitizeUIConstants(data) {
  if (!data || typeof data !== 'object') return {};
  const clean = {};
  if (data.nameMaxLenDesktop != null) clean.nameMaxLenDesktop = _toInt(data.nameMaxLenDesktop, 12);
  if (data.nameMaxLenMobile != null) clean.nameMaxLenMobile = _toInt(data.nameMaxLenMobile, 6);
  if (data.toastDuration != null) clean.toastDuration = _toInt(data.toastDuration, 2000);
  return clean;
}

function _toInt(v, fallback) {
  const n = Number(v);
  if (isNaN(n) || n < 0) return fallback;
  return Math.floor(n);
}

async function _resolveMemberId(familyId, displayName, token) {
  const dn = String(displayName || '').trim();
  if (!dn) return '';
  try {
    const members = await dbGet(`families/${familyId}/members`, token);
    if (!members || typeof members !== 'object') return '';
    const matched = Object.entries(members).find(([, m]) => String((m && m.name) || '').trim() === dn);
    return matched ? matched[0] : '';
  } catch (err) {
    return '';
  }
}

async function _signInWithPassword(email, password) {
  try {
    const url = `${IDENTITY_TOOLKIT_URL}/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: false }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data?.error?.message || 'UNKNOWN_ERROR' };
    return { ok: true, uid: data.localId, email: data.email };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}
