// ============================================
// insurance-sync.js — POST /api/insurance-sync（v102.0.0）
// 位置：functions/api/insurance-sync.js
// ============================================
// v102.0.0 修正：
//   ✅ 支援 bankId / txnId（保險扣款關聯銀行）
//   ✅ 支援 paymentMode（direct / advance）
//   ✅ 支援 advanceId（代墊模式）
//   ✅ [P1-5] 代墊扣減冪等（記錄 paidMonths，避免重複扣減）
//   ✅ [P1-5] delete 分支退還 remainingAmount
//   ✅ 保留 v101.5 全部功能
// ============================================

import { dbGet, dbPut, dbDelete, dbPush } from './_config.js';
import {
  authenticate,
  errorResponse,
  handleError,
  handleOptions,
  successResponse,
  requireFields,
  roundInt,
  buildLinkedKey,
} from './_helpers.js';

export async function onRequestPost({ request }) {
  try {
    const body = await request.json();

    const {
      action,
      familyId,
      policyId,
      memberId,
      policyName,
      monthlyAverage,
      year,
      month,
      expenseStatusName,
      paymentStatusName,
      bankId,
      txnId,
      paymentMode,
      advanceHolderId,
    } = body || {};

    const missing = requireFields(body, ['familyId', 'policyId', 'memberId', 'year', 'month']);
    if (missing) return errorResponse('MISSING_FIELDS', '', 400);

    const auth = await authenticate(request, { needFamily: true, body });
    if (auth instanceof Response) return auth;
    const { token } = auth;

    const basePath = `families/${familyId}`;

    const linkedKey = buildLinkedKey(policyId);
    const expensePath = `${basePath}/expenses/${year}/${month}/member_expenses/${memberId}/${linkedKey}`;
    const paymentPath = `${basePath}/insurance_payments/${policyId}/${year}/${month}`;

    const amount = roundInt(monthlyAverage);

    /* ============================================
       DELETE 分支
       ============================================ */
    if (action === 'delete') {
      await dbDelete(expensePath, token);
      await dbDelete(paymentPath, token);

      // 🆕 v102.0.0：若為代墊模式，退還 remainingAmount（冪等）
      if (paymentMode === 'advance' && advanceHolderId) {
        try {
          await _refundAdvance({
            basePath, policyId, advanceHolderId, amount, year, month, token,
          });
        } catch (e) {
          console.warn('[insurance-sync] 退還代墊失敗：', e);
        }
      }

      return successResponse({ deleted: true });
    }

    /* ============================================
       UPSERT 分支
       ============================================ */

    const statuses = await dbGet(`${basePath}/statuses`, token) || {};

    const categories = await dbGet(`${basePath}/expense_categories`, token) || {};
    const firstCategoryId = _getFirstCategoryId(categories);

    const resolvedExpenseStatus =
      expenseStatusName || _findDoneStatus(statuses, 'personal') || '已還款';
    const resolvedPaymentStatus =
      paymentStatusName || _findDoneStatus(statuses, 'insurance') || '已扣款';

    /* ============================================
       寫入成員支出（保險平攤）
       ============================================ */
    const expense = {
      name: `${policyName} (平攤)`,
      amount,
      status: resolvedExpenseStatus,
      date: '',
      categoryId: firstCategoryId,
      itemId: '',
      paymentMethodId: '',
      bankId: bankId || '',
      txnId: txnId || '',
      isAutoLinked: true,
      policyId,
      createdAt: Date.now(),
    };
    const expenseOk = await dbPut(expensePath, expense, token);

    /* ============================================
       寫入保險付款紀錄
       ============================================ */
    const paymentRecord = {
      status: resolvedPaymentStatus,
      amount,
      date: new Date().toISOString().slice(0, 10),
      bankId: bankId || '',
      txnId: txnId || '',
      paymentMode: paymentMode || 'direct',
    };
    const paymentOk = await dbPut(paymentPath, paymentRecord, token);

    /* ============================================
       🆕 v102.0.0：若為代墊模式，更新 member_advances（冪等）
       ============================================ */
    if (paymentMode === 'advance' && advanceHolderId) {
      try {
        await _deductAdvance({
          basePath, policyId, advanceHolderId, amount, year, month, token,
        });
      } catch (e) {
        console.warn('[insurance-sync] 更新代墊記錄失敗：', e);
      }
    }

    if (!expenseOk && !paymentOk) {
      return errorResponse('INTERNAL', '寫入失敗，請檢查 Firebase 規則');
    }

    return successResponse({
      path: expensePath,
      expenseStatus: resolvedExpenseStatus,
      paymentStatus: resolvedPaymentStatus,
      categoryId: firstCategoryId,
      paymentMode: paymentMode || 'direct',
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function onRequestOptions() {
  return handleOptions();
}

/* ============================================
   🆕 v102.0.0：代墊扣減（冪等）
   ============================================ */
async function _deductAdvance({ basePath, policyId, advanceHolderId, amount, year, month, token }) {
  const advances = await dbGet(`${basePath}/member_advances/${advanceHolderId}`, token);
  if (!advances) return;

  const monthKey = `${year}-${String(month).padStart(2, '0')}`;

  for (const [advanceId, adv] of Object.entries(advances)) {
    if (adv.policyId !== policyId) continue;

    const paidMonths = (adv.paidMonths && typeof adv.paidMonths === 'object')
      ? { ...adv.paidMonths }
      : {};

    // 🆕 P1-5：冪等檢查 — 同一月份已扣減過則跳過
    if (paidMonths[monthKey]) return;

    const newRemaining = Math.max(0, roundInt(adv.remainingAmount) - amount);
    paidMonths[monthKey] = true;

    await dbPut(`${basePath}/member_advances/${advanceHolderId}/${advanceId}`, {
      ...adv,
      remainingAmount: newRemaining,
      paidMonths,
      updatedAt: Date.now(),
    }, token);

    return;
  }
}

/* ============================================
   🆕 v102.0.0：代墊退還（冪等）
   ============================================ */
async function _refundAdvance({ basePath, policyId, advanceHolderId, amount, year, month, token }) {
  const advances = await dbGet(`${basePath}/member_advances/${advanceHolderId}`, token);
  if (!advances) return;

  const monthKey = `${year}-${String(month).padStart(2, '0')}`;

  for (const [advanceId, adv] of Object.entries(advances)) {
    if (adv.policyId !== policyId) continue;

    const paidMonths = (adv.paidMonths && typeof adv.paidMonths === 'object')
      ? { ...adv.paidMonths }
      : {};

    // 若未記錄該月扣減，則不應退還
    if (!paidMonths[monthKey]) return;

    delete paidMonths[monthKey];
    const totalAmount = roundInt(adv.totalAmount);
    const newRemaining = Math.min(
      totalAmount,
      roundInt(adv.remainingAmount) + amount
    );

    await dbPut(`${basePath}/member_advances/${advanceHolderId}/${advanceId}`, {
      ...adv,
      remainingAmount: newRemaining,
      paidMonths,
      updatedAt: Date.now(),
    }, token);

    return;
  }
}

/* ============================================
   內部工具
   ============================================ */

function _getFirstCategoryId(categories) {
  const list = Object.entries(categories || {})
    .map(([id, c]) => ({ id, ...c }))
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  return list.length > 0 ? list[0].id : '';
}

function _findDoneStatus(statuses, category) {
  const list = Object.entries(statuses)
    .map(([id, s]) => ({ id, ...s }))
    .filter((s) => s.category === category && s.isDone)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  if (list.length > 0) return list[0].name;

  const anyDone = Object.entries(statuses)
    .map(([id, s]) => ({ id, ...s }))
    .filter((s) => s.isDone)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  return anyDone.length > 0 ? anyDone[0].name : null;
}
