// _insurance.js — 保險同步 lib（v103.0.21）
import { dbGet, dbPut, dbDelete } from './_config.js';
import { errorResponse, handleError, successResponse, requireFields, roundInt, buildLinkedKey, authenticate } from './_helpers.js';

export async function handleInsuranceSync(request) {
  try {
    const body = await request.json();
    const { action, familyId, policyId, memberId, policyName, monthlyAverage, year, month, expenseStatusName, paymentStatusName, bankId, txnId, paymentMode, advanceHolderId } = body || {};
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

    /* DELETE */
    if (action === 'delete') {
      await dbDelete(expensePath, token);
      await dbDelete(paymentPath, token);
      if (paymentMode === 'advance' && advanceHolderId) {
        try { await _refundAdvance({ basePath, policyId, advanceHolderId, amount, year, month, token }); } catch (e) { console.warn('[insurance] 退還代墊失敗：', e); }
      }
      /* 撤銷基金累積 */
      try { await _reverseFundAccumulation({ basePath, policyId, year, month, token }); } catch (e) { console.warn('[insurance] 撤銷基金累積失敗：', e); }
      return successResponse({ deleted: true });
    }

    /* UPSERT */
    const statuses = await dbGet(`${basePath}/statuses`, token) || {};
    const categories = await dbGet(`${basePath}/expense_categories`, token) || {};
    const firstCategoryId = _getFirstCategoryId(categories);

    const resolvedExpenseStatus = expenseStatusName || _findDoneStatus(statuses, 'personal') || '已還款';
    const resolvedPaymentStatus = paymentStatusName || _findDoneStatus(statuses, 'insurance') || '已扣款';

    const expense = {
      name: `${policyName} (平攤)`, amount, status: resolvedExpenseStatus, date: '',
      categoryId: firstCategoryId, itemId: '', paymentMethodId: '',
      bankId: bankId || '', txnId: txnId || '',
      isAutoLinked: true, policyId, createdAt: Date.now(),
    };
    const expenseOk = await dbPut(expensePath, expense, token);

    const paymentRecord = {
      status: resolvedPaymentStatus, amount,
      date: new Date().toISOString().slice(0, 10),
      bankId: bankId || '', txnId: txnId || '',
      paymentMode: paymentMode || 'direct',
    };
    const paymentOk = await dbPut(paymentPath, paymentRecord, token);

    if (paymentMode === 'advance' && advanceHolderId) {
      try { await _deductAdvance({ basePath, policyId, advanceHolderId, amount, year, month, token }); } catch (e) { console.warn('[insurance] 更新代墊記錄失敗：', e); }
    }

    /* 基金累積 */
    try { await _accumulateFunds({ basePath, policyId, year, month, token }); } catch (e) { console.warn('[insurance] 基金累積失敗：', e); }

    if (!expenseOk && !paymentOk) return errorResponse('INTERNAL', '寫入失敗，請檢查 Firebase 規則');

    return successResponse({ path: expensePath, expenseStatus: resolvedExpenseStatus, paymentStatus: resolvedPaymentStatus, categoryId: firstCategoryId, paymentMode: paymentMode || 'direct' });
  } catch (err) {
    return handleError(err);
  }
}

/* ============================================
   基金累積（依 policy.fundsAllocation）
   ============================================ */
async function _accumulateFunds({ basePath, policyId, year, month, token }) {
  const policy = await dbGet(`${basePath}/insurance_policies/${policyId}`, token);
  if (!policy || policy.type !== 'fund_insurance') return;
  const alloc = policy.fundsAllocation || [];
  if (alloc.length === 0) return;

  const monthlyPremium = roundInt(policy.monthlyPremium);
  const yk = String(year), mk = String(month).padStart(2, '0');

  for (const a of alloc) {
    const fundId = a.fundId;
    if (!fundId) continue;
    const addCost = Math.round(monthlyPremium * (Number(a.pct) || 0) / 100);
    const fundPath = `${basePath}/funds/${fundId}`;
    const fund = await dbGet(fundPath, token) || {};
    const snapPath = `${fundPath}/snapshots/${yk}/${mk}`;
    const snap = await dbGet(snapPath, token) || {};
    const newCum = roundInt(snap.cumulativeCost) + addCost;
    await dbPut(snapPath, {
      ...snap,
      cumulativeCost: newCum,
      contribution: addCost,
      createdAt: snap.createdAt || Date.now(),
      updatedAt: Date.now(),
    }, token);
    /* 標記 fund 為保險基金 */
    if (fund.type !== 'insurance') {
      await dbPut(fundPath, { ...fund, type: 'insurance', policyId }, token);
    }
  }
}

async function _reverseFundAccumulation({ basePath, policyId, year, month, token }) {
  const policy = await dbGet(`${basePath}/insurance_policies/${policyId}`, token);
  if (!policy || policy.type !== 'fund_insurance') return;
  const alloc = policy.fundsAllocation || [];
  if (alloc.length === 0) return;
  const monthlyPremium = roundInt(policy.monthlyPremium);
  const yk = String(year), mk = String(month).padStart(2, '0');

  for (const a of alloc) {
    const fundId = a.fundId;
    if (!fundId) continue;
    const subCost = Math.round(monthlyPremium * (Number(a.pct) || 0) / 100);
    const snapPath = `${basePath}/funds/${fundId}/snapshots/${yk}/${mk}`;
    const snap = await dbGet(snapPath, token);
    if (!snap) continue;
    const newCum = Math.max(0, roundInt(snap.cumulativeCost) - subCost);
    if (newCum === 0 && !snap.shares && !snap.nav) {
      await dbDelete(snapPath, token);
    } else {
      await dbPut(snapPath, { ...snap, cumulativeCost: newCum, contribution: 0, updatedAt: Date.now() }, token);
    }
  }
}

/* ============================================
   代墊
   ============================================ */
async function _deductAdvance({ basePath, policyId, advanceHolderId, amount, year, month, token }) {
  const advances = await dbGet(`${basePath}/member_advances/${advanceHolderId}`, token);
  if (!advances) return;
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  for (const [advanceId, adv] of Object.entries(advances)) {
    if (adv.policyId !== policyId) continue;
    const paidMonths = (adv.paidMonths && typeof adv.paidMonths === 'object') ? { ...adv.paidMonths } : {};
    if (paidMonths[monthKey]) return;
    const newRemaining = Math.max(0, roundInt(adv.remainingAmount) - amount);
    paidMonths[monthKey] = true;
    await dbPut(`${basePath}/member_advances/${advanceHolderId}/${advanceId}`, { ...adv, remainingAmount: newRemaining, paidMonths, updatedAt: Date.now() }, token);
    return;
  }
}

async function _refundAdvance({ basePath, policyId, advanceHolderId, amount, year, month, token }) {
  const advances = await dbGet(`${basePath}/member_advances/${advanceHolderId}`, token);
  if (!advances) return;
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  for (const [advanceId, adv] of Object.entries(advances)) {
    if (adv.policyId !== policyId) continue;
    const paidMonths = (adv.paidMonths && typeof adv.paidMonths === 'object') ? { ...adv.paidMonths } : {};
    if (!paidMonths[monthKey]) return;
    delete paidMonths[monthKey];
    const totalAmount = roundInt(adv.totalAmount);
    const newRemaining = Math.min(totalAmount, roundInt(adv.remainingAmount) + amount);
    await dbPut(`${basePath}/member_advances/${advanceHolderId}/${advanceId}`, { ...adv, remainingAmount: newRemaining, paidMonths, updatedAt: Date.now() }, token);
    return;
  }
}

function _getFirstCategoryId(categories) {
  const list = Object.entries(categories || {}).map(([id, c]) => ({ id, ...c })).sort((a, b) => (a.order || 0) - (b.order || 0));
  return list.length > 0 ? list[0].id : '';
}

function _findDoneStatus(statuses, category) {
  const list = Object.entries(statuses).map(([id, s]) => ({ id, ...s })).filter((s) => s.category === category && s.isDone).sort((a, b) => (a.order || 0) - (b.order || 0));
  if (list.length > 0) return list[0].name;
  const anyDone = Object.entries(statuses).map(([id, s]) => ({ id, ...s })).filter((s) => s.isDone).sort((a, b) => (a.order || 0) - (b.order || 0));
  return anyDone.length > 0 ? anyDone[0].name : null;
}

/* ═══════════════════════════════════════════
   END OF FILE
   File: functions/api/_insurance.js
   Version: v103.0.21
   Batch: B23
   ═══════════════════════════════════════════ */