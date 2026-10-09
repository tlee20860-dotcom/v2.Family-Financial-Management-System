// ============================================
// lookup-family.js — 登入後查詢所屬家庭（v101.10.0）
// 位置：functions/api/lookup-family.js
// ============================================
// v101.10.0 修正：
//   ✅ [P1-2] verifyFamilyAccessByUid 傳入 token
//   ✅ [P1-2] dbGet 家庭名稱傳入 token
//   ✅ 保留 v101.8.0 全部功能
// ============================================

import { dbGet } from './_config.js';
import {
  authenticate,
  errorResponse,
  handleError,
  handleOptions,
  successResponse,
  verifyFamilyAccessByUid,
} from './_helpers.js';

export async function onRequestPost({ request }) {
  try {
    // 驗證登入
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    const { user, token } = auth;

    const uid = user.localId;

    // v101.10.0：傳入 token 給 verifyFamilyAccessByUid
    const result = await verifyFamilyAccessByUid(uid, token);

    if (!result) {
      return errorResponse('NOT_FOUND', '此帳號不屬於任何家庭，請聯繫管理員');
    }

    // 讀取家庭名稱（v101.10.0：傳入 token）
    let familyName = '我的家庭';
    try {
      const familySnap = await dbGet(`platform/families/${result.familyId}`, token);
      if (familySnap?.name) familyName = familySnap.name;
    } catch (e) {
      // 忽略
    }

    // 若為新版，讀取 memberAccount（含 displayName / canInput）
    let memberAccount = result.memberAccount;
    if (!memberAccount) {
      // Fallback：使用預設值
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
  } catch (err) {
    return handleError(err);
  }
}

export async function onRequestOptions() {
  return handleOptions();
}