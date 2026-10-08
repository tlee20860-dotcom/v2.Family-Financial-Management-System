// ============================================
// family-accounts.js — 家庭成員帳號管理 API（v101.8.0 🆕）
// 位置：functions/api/family-accounts.js
// ============================================
// 用途：
//   superadmin 管理每個家庭的多個成員帳號
//
// 支援 action：
//   - list   列出指定家庭的所有成員帳號
//   - create 建立新成員帳號（同時建立 Firebase Auth + 寫入 RTDB）
//   - update 更新成員帳號（displayName / role / canInput）
//   - remove 移除成員帳號（不刪除 Firebase Auth 帳號）
//
// 權限：需要 superadmin
//
// 資料結構：
//   platform/families/{familyId}/memberAccounts/{uid}/
//     { email, displayName, role, canInput, createdAt }
//   platform/uid_index/{uid} = familyId
// ============================================

import { dbGet, dbPut, dbDelete, dbSignUp, SUPERADMIN_EMAIL } from './_config.js';
import {
  authenticate,
  errorResponse,
  handleError,
  handleOptions,
  requireFields,
  successResponse,
  objToList,
} from './_helpers.js';

/* ============================================
   GET — 列出家庭帳號
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

    const auth = await authenticate(request, { needSuperAdmin: true });
    if (auth instanceof Response) return auth;

    const accountsSnap = await dbGet(`platform/families/${familyId}/memberAccounts`);
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
   POST — create / update / remove
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

    if (!familyId) {
      return errorResponse('MISSING_FIELDS', '缺少 familyId');
    }

    // 檢查家庭存在
    const familySnap = await dbGet(`platform/families/${familyId}`);
    if (!familySnap) {
      return errorResponse('NOT_FOUND', `找不到家庭 ${familyId}`);
    }

    switch (action) {
      case 'create':
        return await _handleCreate(body);
      case 'update':
        return await _handleUpdate(body);
      case 'remove':
        return await _handleRemove(body);
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
async function _handleCreate(body) {
  const { familyId, account, password, displayName, role, canInput } = body;

  const missing = requireFields(body, ['account', 'password', 'displayName']);
  if (missing) return errorResponse('MISSING_FIELDS', '缺少 account / password / displayName');

  // 帳號格式驗證
  const accountStr = String(account).trim().toLowerCase();
  if (!/^[a-z0-9._-]+$/.test(accountStr)) {
    return errorResponse('BAD_REQUEST', '帳號只能包含小寫英數字、點、底線、連字號');
  }

  // 密碼長度
  const pwdStr = String(password);
  if (pwdStr.length < 6) {
    return errorResponse('BAD_REQUEST', '密碼至少 6 位');
  }

  // 角色驗證
  const roleStr = role === 'owner' ? 'owner' : 'member';

  // Email 組裝
  const email = `${accountStr}@familyfin.local`;

  // 檢查是否已存在
  const existing = await dbGet(`platform/email_index/${accountStr}`);
  if (existing) {
    return errorResponse('CONFLICT', `帳號 ${accountStr} 已存在`);
  }

  // 建立 Firebase Auth 帳號
  const signUpResult = await dbSignUp(email, pwdStr);
  if (!signUpResult.ok) {
    const errMap = {
      EMAIL_EXISTS: '此帳號已存在',
      WEAK_PASSWORD: '密碼強度不足（至少 6 位）',
      INVALID_EMAIL: '帳號格式錯誤',
      OPERATION_NOT_ALLOWED: 'Firebase 專案未開啟 Email/Password 登入方式',
    };
    const msg = errMap[signUpResult.error] || signUpResult.error;
    return errorResponse('INTERNAL', `建立帳號失敗：${msg}`);
  }

  const newUid = signUpResult.uid;
  const now = Date.now();

  // 寫入 memberAccounts
  const accountData = {
    email,
    account: accountStr,
    displayName: String(displayName).trim(),
    role: roleStr,
    canInput: canInput !== false, // 預設 true
    createdAt: now,
  };

  const ok1 = await dbPut(`platform/families/${familyId}/memberAccounts/${newUid}`, accountData);
  if (!ok1) {
    return errorResponse('INTERNAL', '寫入 memberAccounts 失敗');
  }

  // 寫入 uid_index
  const ok2 = await dbPut(`platform/uid_index/${newUid}`, familyId);
  if (!ok2) {
    return errorResponse('INTERNAL', '寫入 uid_index 失敗（帳號已建立，請聯繫管理員）');
  }

  // 寫入 email_index
  await dbPut(`platform/email_index/${accountStr}`, { uid: newUid, familyId });

  return successResponse({
    uid: newUid,
    account: accountData,
  });
}

/* ============================================
   UPDATE — 更新成員帳號
   ============================================ */
async function _handleUpdate(body) {
  const { familyId, uid, displayName, role, canInput } = body;

  const missing = requireFields(body, ['uid']);
  if (missing) return errorResponse('MISSING_FIELDS', '缺少 uid');

  // 檢查帳號存在
  const existing = await dbGet(`platform/families/${familyId}/memberAccounts/${uid}`);
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
    // ⚠️ 不允許修改為 owner（owner 只能有一個）
    // 若原本就是 owner 則允許保留
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

  const ok = await dbPut(`platform/families/${familyId}/memberAccounts/${uid}`, {
    ...existing,
    ...patch,
  });

  if (!ok) {
    return errorResponse('INTERNAL', '更新失敗');
  }

  return successResponse({
    uid,
    patch,
  });
}

/* ============================================
   REMOVE — 移除成員帳號
   ============================================
   注意：
   - 只從 memberAccounts + uid_index + email_index 移除
   - 不刪除 Firebase Auth 帳號（需 Admin SDK）
   - 若同一 email 被重新建立，會產生新 UID
   ============================================ */
async function _handleRemove(body) {
  const { familyId, uid } = body;

  const missing = requireFields(body, ['uid']);
  if (missing) return errorResponse('MISSING_FIELDS', '缺少 uid');

  // 檢查帳號存在
  const existing = await dbGet(`platform/families/${familyId}/memberAccounts/${uid}`);
  if (!existing) {
    return errorResponse('NOT_FOUND', '找不到此成員帳號');
  }

  // 保護：主帳號（owner）不可移除
  if (existing.role === 'owner') {
    return errorResponse('FORBIDDEN', '不可移除此家庭的主帳號（owner）');
  }

  // 從 memberAccounts 移除
  const ok1 = await dbDelete(`platform/families/${familyId}/memberAccounts/${uid}`);
  if (!ok1) {
    return errorResponse('INTERNAL', '移除 memberAccounts 失敗');
  }

  // 從 uid_index 移除
  await dbDelete(`platform/uid_index/${uid}`);

  // 從 email_index 移除
  if (existing.account) {
    await dbDelete(`platform/email_index/${existing.account}`);
  }

  return successResponse({
    removedUid: uid,
    removedAccount: existing.account,
  });
}

/* ============================================
   OPTIONS
   ============================================ */
export async function onRequestOptions() {
  return handleOptions();
}