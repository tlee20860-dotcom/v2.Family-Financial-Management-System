// ============================================
// family-accounts.js — 家庭成員帳號管理 API（v101.8.4）
// 位置：functions/api/family-accounts.js
// ============================================
// v101.8.4 新增：
//   ✅ GET 支援 needFamily 權限（家庭成員可讀自己家庭）
//   ✅ superadmin 可讀任何家庭，成員只能讀自己家庭
// ============================================

import {
  dbGet, dbPut, dbDelete, dbSignUp,
  SUPERADMIN_EMAIL, FIREBASE_API_KEY, IDENTITY_TOOLKIT_URL,
} from './_config.js';
import {
  authenticate,
  errorResponse,
  handleError,
  handleOptions,
  requireFields,
  successResponse,
  objToList,
  verifyToken,
  verifySuperAdmin,
  verifyFamilyAccess,
  extractToken,
} from './_helpers.js';

/* ============================================
   GET — 列出家庭帳號
   -------------------------------------------------
   v101.8.4：
   - superadmin 可讀任何家庭
   - 家庭成員只能讀自己家庭
   ============================================ */
export async function onRequestGet({ request }) {
  try {
    const url = new URL(request.url);
    const familyId = url.searchParams.get('familyId');
    const action = url.searchParams.get('action') || 'list';

    if (action !== 'list') {
      return errorResponse('BAD_REQUEST', 'GET 僅支援 action=list');
    }

    if (!familyId) {
      return errorResponse('MISSING_FIELDS', '缺少 familyId');
    }

    const token = extractToken(request);

    // 🆕 v101.8.4：先嘗試 superadmin
    const superUser = await verifySuperAdmin(token);
    let authorized = false;

    if (superUser) {
      authorized = true;
    } else {
      // 🆕 v101.8.4：非 superadmin → 檢查是否為該家庭成員
      const familyResult = await verifyFamilyAccess(token, familyId);
      if (familyResult) {
        authorized = true;
      }
    }

    if (!authorized) {
      return errorResponse('FORBIDDEN', '無權存取此家庭的帳號列表');
    }

    // 讀取帳號列表
    const accountsSnap = await dbGet(
      `platform/families/${familyId}/memberAccounts`,
      token
    );
    const accounts = objToList(accountsSnap || {}, (a, b) => (a.createdAt || 0) - (b.createdAt || 0));

    return successResponse({
      familyId,
      accounts,
      count: accounts.length,
    });
  } catch (err) {
    return handleError(err);
  }
}

/* ============================================
   POST — create / restore / update / remove
   ============================================ */
export async function onRequestPost({ request }) {
  try {
    const body = await request.json();
    const { action, familyId, uid } = body || {};

    if (!action) {
      return errorResponse('MISSING_FIELDS', '缺少 action');
    }

    const auth = await authenticate(request, { needSuperAdmin: true });
    if (auth instanceof Response) return auth;
    const { token } = auth;

    if (!familyId) {
      return errorResponse('MISSING_FIELDS', '缺少 familyId');
    }

    const familySnap = await dbGet(`platform/families/${familyId}`, token);
    if (!familySnap) {
      return errorResponse('NOT_FOUND', `找不到家庭 ${familyId}`);
    }

    switch (action) {
      case 'create':
        return await _handleCreate(body, token);
      case 'restore':
        return await _handleRestore(body, token);
      case 'update':
        return await _handleUpdate(body, token);
      case 'remove':
        return await _handleRemove(body, token);
      default:
        return errorResponse('BAD_REQUEST', `未知的 action：${action}`);
    }
  } catch (err) {
    return handleError(err);
  }
}

/* ============================================
   CREATE — 建立新成員帳號
   ============================================ */
async function _handleCreate(body, token) {
  const { familyId, account, password, displayName, role, canInput } = body;

  const missing = requireFields(body, ['account', 'password', 'displayName']);
  if (missing) return errorResponse('MISSING_FIELDS', '缺少 account / password / displayName');

  const accountStr = String(account).trim().toLowerCase();
  if (!/^[a-z0-9._-]+$/.test(accountStr)) {
    return errorResponse('BAD_REQUEST', '帳號只能包含小寫英數字、點、底線、連字號');
  }

  const pwdStr = String(password);
  if (pwdStr.length < 6) {
    return errorResponse('BAD_REQUEST', '密碼至少 6 位');
  }

  const roleStr = role === 'owner' ? 'owner' : 'member';
  const email = `${accountStr}@familyfin.local`;

  const existing = await dbGet(`platform/email_index/${accountStr}`, token);
  if (existing) {
    return errorResponse('CONFLICT', `帳號 ${accountStr} 已存在於平台記錄`);
  }

  const signUpResult = await dbSignUp(email, pwdStr);
  if (!signUpResult.ok) {
    if (signUpResult.error === 'EMAIL_EXISTS') {
      return errorResponse(
        'EMAIL_EXISTS',
        `帳號「${accountStr}」已存在於 Firebase 系統（可能為先前建立未完成）。\n請改用其他名稱，或使用「復原舊帳號」功能。`,
        409
      );
    }

    const errMap = {
      WEAK_PASSWORD: '密碼強度不足（至少 6 位）',
      INVALID_EMAIL: '帳號格式錯誤',
      OPERATION_NOT_ALLOWED: 'Firebase 專案未開啟 Email/Password 登入方式',
    };
    const msg = errMap[signUpResult.error] || signUpResult.error;
    return errorResponse('INTERNAL', `建立帳號失敗：${msg}`);
  }

  const newUid = signUpResult.uid;
  const now = Date.now();

  const accountData = {
    email,
    account: accountStr,
    displayName: String(displayName).trim(),
    role: roleStr,
    canInput: canInput !== false,
    createdAt: now,
  };

  const ok1 = await dbPut(
    `platform/families/${familyId}/memberAccounts/${newUid}`,
    accountData,
    token
  );
  if (!ok1) {
    return errorResponse(
      'INTERNAL',
      `Firebase Auth 帳號已建立（${email}），但寫入平台記錄失敗。\n請至 Firebase Console → Authentication 刪除該帳號後重試。`,
      500
    );
  }

  const ok2 = await dbPut(`platform/uid_index/${newUid}`, familyId, token);
  if (!ok2) {
    await dbDelete(`platform/families/${familyId}/memberAccounts/${newUid}`, token);
    return errorResponse(
      'INTERNAL',
      `Firebase Auth 帳號已建立（${email}），但 uid_index 寫入失敗。\n請至 Firebase Console → Authentication 刪除該帳號後重試。`,
      500
    );
  }

  await dbPut(`platform/email_index/${accountStr}`, { uid: newUid, familyId }, token);

  return successResponse({ uid: newUid, account: accountData });
}

/* ============================================
   RESTORE — 復原孤兒帳號
   ============================================ */
async function _handleRestore(body, token) {
  const { familyId, account, password, displayName, role, canInput } = body;

  const missing = requireFields(body, ['account', 'password', 'displayName']);
  if (missing) return errorResponse('MISSING_FIELDS', '缺少 account / password / displayName');

  const accountStr = String(account).trim().toLowerCase();
  const pwdStr = String(password);
  const email = `${accountStr}@familyfin.local`;

  const existingIndex = await dbGet(`platform/email_index/${accountStr}`, token);
  if (existingIndex) {
    return errorResponse('CONFLICT', `帳號 ${accountStr} 已在平台記錄中，不需復原`);
  }

  const signInResult = await _signInWithPassword(email, pwdStr);
  if (!signInResult.ok) {
    if (signInResult.error === 'EMAIL_NOT_FOUND') {
      return errorResponse('NOT_FOUND', '此帳號在 Firebase 系統中不存在，無法復原');
    }
    if (
      signInResult.error === 'INVALID_PASSWORD' ||
      signInResult.error === 'INVALID_LOGIN_CREDENTIALS'
    ) {
      return errorResponse('FORBIDDEN', '舊密碼錯誤，無法復原此帳號');
    }
    if (signInResult.error === 'TOO_MANY_ATTEMPTS_TRY_LATER') {
      return errorResponse('FORBIDDEN', '嘗試次數過多，請稍後再試');
    }
    return errorResponse('INTERNAL', `驗證失敗：${signInResult.error}`);
  }

  const uid = signInResult.uid;

  const uidIndex = await dbGet(`platform/uid_index/${uid}`, token);
  if (uidIndex) {
    return errorResponse('CONFLICT', `此帳號已屬於家庭 ${uidIndex}，無法重複復原`);
  }

  const now = Date.now();
  const accountData = {
    email,
    account: accountStr,
    displayName: String(displayName).trim(),
    role: role === 'owner' ? 'owner' : 'member',
    canInput: canInput !== false,
    createdAt: now,
    restoredAt: now,
  };

  const ok1 = await dbPut(
    `platform/families/${familyId}/memberAccounts/${uid}`,
    accountData,
    token
  );
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
   UPDATE
   ============================================ */
async function _handleUpdate(body, token) {
  const { familyId, uid, displayName, role, canInput } = body;

  const missing = requireFields(body, ['uid']);
  if (missing) return errorResponse('MISSING_FIELDS', '缺少 uid');

  const existing = await dbGet(`platform/families/${familyId}/memberAccounts/${uid}`, token);
  if (!existing) {
    return errorResponse('NOT_FOUND', '找不到此成員帳號');
  }

  const patch = {};

  if (displayName !== undefined) {
    const dn = String(displayName).trim();
    if (!dn) return errorResponse('BAD_REQUEST', '顯示名稱不可為空');
    patch.displayName = dn;
  }

  if (role !== undefined) {
    if (role !== 'owner' && role !== 'member') {
      return errorResponse('BAD_REQUEST', 'role 必須是 owner 或 member');
    }
    if (role === 'owner' && existing.role !== 'owner') {
      return errorResponse('BAD_REQUEST', '不可將成員升級為 owner');
    }
    patch.role = role;
  }

  if (canInput !== undefined) {
    patch.canInput = canInput === true;
  }

  if (Object.keys(patch).length === 0) {
    return errorResponse('BAD_REQUEST', '沒有任何欄位要更新');
  }

  patch.updatedAt = Date.now();

  const ok = await dbPut(
    `platform/families/${familyId}/memberAccounts/${uid}`,
    { ...existing, ...patch },
    token
  );

  if (!ok) return errorResponse('INTERNAL', '更新失敗');

  return successResponse({ uid, patch });
}

/* ============================================
   REMOVE
   ============================================ */
async function _handleRemove(body, token) {
  const { familyId, uid } = body;

  const missing = requireFields(body, ['uid']);
  if (missing) return errorResponse('MISSING_FIELDS', '缺少 uid');

  const existing = await dbGet(`platform/families/${familyId}/memberAccounts/${uid}`, token);
  if (!existing) {
    return errorResponse('NOT_FOUND', '找不到此成員帳號');
  }

  if (existing.role === 'owner') {
    return errorResponse('FORBIDDEN', '不可移除此家庭的主帳號（owner）');
  }

  const ok1 = await dbDelete(`platform/families/${familyId}/memberAccounts/${uid}`, token);
  if (!ok1) return errorResponse('INTERNAL', '移除 memberAccounts 失敗');

  await dbDelete(`platform/uid_index/${uid}`, token);

  if (existing.account) {
    await dbDelete(`platform/email_index/${existing.account}`, token);
  }

  return successResponse({
    removedUid: uid,
    removedAccount: existing.account,
    note: 'Firebase Auth 帳號仍保留',
  });
}

/* ============================================
   內部工具 — signInWithPassword
   ============================================ */
async function _signInWithPassword(email, password) {
  try {
    const url = `${IDENTITY_TOOLKIT_URL}/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: false }),
    });

    const data = await res.json();

    if (!res.ok) {
      const errMsg = data?.error?.message || 'UNKNOWN_ERROR';
      return { ok: false, error: errMsg };
    }

    return { ok: true, uid: data.localId, email: data.email };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}

export async function onRequestOptions() {
  return handleOptions();
}