// ============================================
// clear-bank-balances.js — 清除舊銀行結餘（v102.0.0 🆕）
// 位置：functions/api/clear-bank-balances.js
// ============================================
// 用途：
//   一次性清除 families/{familyId}/bank_balances/ 節點
//   v102.0.0 銀行系統重構，廢除舊 bank_balances
//
// 請求：
//   POST /api/clear-bank-balances
//     body: { familyId, confirm: 'CONFIRM_DELETE' }
//
// 權限：
//   - superadmin：可清除任何家庭
//   - owner：可清除自己家庭
// ============================================

import { dbGet, dbDelete } from './_config.js';
import {
  authenticate,
  errorResponse,
  handleError,
  handleOptions,
  successResponse,
} from './_helpers.js';

const CONFIRM_TOKEN = 'CONFIRM_DELETE';

export async function onRequestPost({ request }) {
  try {
    const body = await request.json();
    const { familyId, confirm } = body || {};

    if (!familyId) return errorResponse('MISSING_FIELDS', '缺少 familyId');
    if (confirm !== CONFIRM_TOKEN) {
      return errorResponse('BAD_REQUEST', '必須提供確認參數 confirm="CONFIRM_DELETE"');
    }

    const auth = await authenticate(request, { needFamily: true, body });
    if (auth instanceof Response) return auth;
    const { token, isSuper, isOwner } = auth;

    // 只有 superadmin 或 owner 可執行
    if (!isSuper && !isOwner) {
      return errorResponse('FORBIDDEN', '只有家庭擁有者才能執行此操作');
    }

    // 檢查舊資料是否存在
    const existing = await dbGet(`families/${familyId}/bank_balances`, token);
    if (!existing) {
      return successResponse({
        cleared: false,
        message: '無舊銀行結餘資料',
      });
    }

    // 統計舊資料筆數
    let recordCount = 0;
    Object.values(existing).forEach((months) => {
      Object.values(months || {}).forEach((banks) => {
        recordCount += Object.keys(banks || {}).length;
      });
    });

    // 執行刪除
    const ok = await dbDelete(`families/${familyId}/bank_balances`, token);
    if (!ok) return errorResponse('INTERNAL', '刪除失敗');

    return successResponse({
      cleared: true,
      recordCount,
      message: `已清除 ${recordCount} 筆舊銀行結餘紀錄`,
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function onRequestOptions() {
  return handleOptions();
}