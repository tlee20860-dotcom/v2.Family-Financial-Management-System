// ============================================
// lookup-family.js — 登入後查詢所屬家庭（v101.8.0 🆕）
// 位置：functions/api/lookup-family.js
// ============================================
// 用途：
//   登入後呼叫，查詢該帳號所屬的家庭
//   - 新版：從 platform/uid_index/{uid} 查詢
//   - 舊版 fallback：UID 即 familyId
//
// 請求：
//   POST /api/lookup-family
//   Headers: { Authorization: Bearer {idToken} }
//   Body: 無（從 token 取得 uid）
//
// 回應：
//   {
//     ok: true,
//     familyId: 'K1',
//     familyName: '我的家庭',
//     memberAccount: {
//       email: 'wife@familyfin.local',
//       displayName: '媽媽',
//       role: 'member',
//       canInput: true
//     },
//     isLegacy: false
//   }
//
//   或若找不到：
//   { ok: false, error: 'NOT_FOUND', message: '此帳號不屬於任何家庭' }
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
    const { user } = auth;

    const uid = user.localId;

    // 查詢所屬家庭
    const result = await verifyFamilyAccessByUid(uid);

    if (!result) {
      return errorResponse('NOT_FOUND', '此帳號不屬於任何家庭，請聯繫管理員');
    }

    // 讀取家庭名稱
    let familyName = '我的家庭';
    try {
      const familySnap = await dbGet(`platform/families/${result.familyId}`);
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