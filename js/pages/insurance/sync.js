// ============================================
// sync.js — 保險支出同步模組（v101.5）
// 位置：js/pages/insurance/sync.js
// ============================================
// v101.5 修正：
//   ✅ _resolveMonthlyAmount 改 import shared/insurance-calc.js
//   ✅ memberId 統一使用 getPolicyHolderId
//   ✅ 改 import getPeriodInfo from shared/insurance-calc.js
// ============================================

import { getInsurancePaymentsOnce } from '../../core/db.js';
import { api } from '../../core/api.js';
import {
  getPeriodInfo,
  resolveMonthlyAmount,
  getPolicyHolderId,
} from '../../shared/insurance-calc.js';

/* ============================================
   1. 單一保單同步
   ============================================ */

/**
 * 同步單一保單的所有已扣款紀錄到成員支出
 */
export async function autoSyncPolicyExpenses(policy, payments) {
  if (!policy || !policy.id) return 0;

  if (!payments) {
    try {
      payments = await getInsurancePaymentsOnce(policy.id);
    } catch (e) {
      payments = {};
    }
  }

  if (!payments || Object.keys(payments).length === 0) return 0;

  // 🆕 v101.5：統一使用 getPolicyHolderId
  const effectiveMemberId = getPolicyHolderId(policy);

  const promises = [];
  let syncCount = 0;

  for (const [year, months] of Object.entries(payments)) {
    for (const [month, data] of Object.entries(months || {})) {
      if (data.status !== '已扣款') continue;

      const y = Number(year);
      const m = Number(month);

      // 🆕 v101.5：使用 shared/insurance-calc.js 的 resolveMonthlyAmount
      const amount = resolveMonthlyAmount(policy, y, m, data);

      promises.push(
        api.insuranceSync({
          policyId: policy.id,
          memberId: effectiveMemberId,
          policyName: policy.name,
          monthlyAverage: amount,
          year,
          month,
        }).catch((err) => {
          console.error(`[sync] 同步失敗 ${policy.id} ${year}-${month}：`, err);
          return null;
        })
      );
      syncCount++;
    }
  }

  await Promise.all(promises);
  return syncCount;
}

/* ============================================
   2. 批次同步（所有保單）
   ============================================ */
export async function syncAllPolicyExpenses(policies, paymentsCache = {}) {
  if (!policies || policies.length === 0) return 0;

  const promises = policies.map((p) =>
    autoSyncPolicyExpenses(p, paymentsCache[p.id])
  );

  const results = await Promise.all(promises);
  return results.reduce((s, n) => s + n, 0);
}

/* ============================================
   3. 編輯後同步
   ============================================ */
export async function autoSyncAfterEdit(policy) {
  if (!policy || !policy.id) return 0;
  return await autoSyncPolicyExpenses(policy);
}

/* ============================================
   4. 單筆扣款同步
   ============================================ */
export async function syncSinglePayment({
  policyId, memberId, policyName, year, month, amount,
}) {
  await api.insuranceSync({
    policyId,
    memberId,
    policyName,
    monthlyAverage: amount,
    year,
    month,
  });
}

export async function unsyncSinglePayment({
  policyId, memberId, year, month,
}) {
  await api.insuranceUnsync({
    policyId,
    memberId,
    year,
    month,
  });
}