// ============================================
// sync.js — 保險支出同步模組（v101）
// 位置：js/pages/insurance/sync.js
// ============================================
// 職責：
//   將 insurance_payments 的扣款紀錄同步到成員支出
//   與後端 api.insuranceSync / insuranceUnsync 互動
//
// 提供：
//   autoSyncPolicyExpenses(policy, payments)     單一保單同步
//   syncAllPolicyExpenses(policies, paymentsCache) 批次同步
//   autoSyncAfterEdit(policy)                    編輯後同步
// ============================================

import { getInsurancePaymentsOnce } from '../../core/db.js';
import { api } from '../../core/api.js';
import { getPeriodInfo } from './calc.js';

/* ============================================
   1. 單一保單同步
   ============================================ */

/**
 * 同步單一保單的所有已扣款紀錄到成員支出
 * @param {Object} policy - 保單物件
 * @param {Object} [payments] - 若未提供則從 RTDB 讀取
 * @returns {Promise<number>} 成功同步筆數
 */
export async function autoSyncPolicyExpenses(policy, payments) {
  if (!policy || !policy.id) return 0;

  // 若未提供 payments，從 RTDB 讀取
  if (!payments) {
    try {
      payments = await getInsurancePaymentsOnce(policy.id);
    } catch (e) {
      payments = {};
    }
  }

  if (!payments || Object.keys(payments).length === 0) return 0;

  const promises = [];
  let syncCount = 0;

  for (const [year, months] of Object.entries(payments)) {
    for (const [month, data] of Object.entries(months || {})) {
      if (data.status !== '已扣款') continue;

      const y = Number(year);
      const m = Number(month);

      // 計算該月份所屬期別的分攤金額
      const amount = _resolveMonthlyAmount(policy, y, m, data);

      promises.push(
        api.insuranceSync({
          policyId: policy.id,
          memberId: policy.memberId,
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

/**
 * 同步所有保單的已扣款紀錄
 * @param {Array} policies
 * @param {Object} [paymentsCache] - { policyId: paymentsObj }，未提供則逐一讀取
 * @returns {Promise<number>} 總同步筆數
 */
export async function syncAllPolicyExpenses(policies, paymentsCache = {}) {
  if (!policies || policies.length === 0) return 0;

  const promises = policies.map((p) =>
    autoSyncPolicyExpenses(p, paymentsCache[p.id])
  );

  const results = await Promise.all(promises);
  return results.reduce((s, n) => s + n, 0);
}

/* ============================================
   3. 編輯後同步（用於 modal 儲存後）
   ============================================ */

/**
 * 保單編輯後自動同步
 * 用於 updateInsurancePolicy 後，將所有已扣款紀錄重新同步
 * （適用於：改金額、改期間、改名稱）
 *
 * @param {Object} policy - 更新後的保單（需含 id）
 * @returns {Promise<number>}
 */
export async function autoSyncAfterEdit(policy) {
  if (!policy || !policy.id) return 0;
  return await autoSyncPolicyExpenses(policy);
}

/* ============================================
   4. 單筆扣款同步
   ============================================ */

/**
 * 同步單筆扣款（用於保險扣款 Tab 的即時操作）
 * @param {Object} params
 * @param {string} params.policyId
 * @param {string} params.memberId
 * @param {string} params.policyName
 * @param {string} params.year
 * @param {string} params.month
 * @param {number} params.amount
 * @returns {Promise<void>}
 */
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

/**
 * 移除單筆扣款的同步
 */
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

/* ============================================
   5. 內部：計算某月分攤金額
   ============================================ */

/**
 * 解析某年月的分攤金額
 * 優先順序：
 *   1. payment.amount（若存在且 > 0）
 *   2. 該月所屬期別的 monthlyAverage
 *   3. policy.monthlyAverage（fallback）
 *
 * @param {Object} policy
 * @param {number} year
 * @param {number} month
 * @param {Object} paymentData
 * @returns {number}
 */
function _resolveMonthlyAmount(policy, year, month, paymentData) {
  // 1. payment 自帶金額
  if (paymentData && paymentData.amount && Number(paymentData.amount) > 0) {
    return Math.round(Number(paymentData.amount));
  }

  // 2. 該月所屬期別
  const info = getPeriodInfo(policy, year, month);
  if (info) {
    const periodData = (policy.periods || {})[String(info.periodIndex)];
    if (periodData && periodData.monthlyAverage) {
      return Math.round(Number(periodData.monthlyAverage));
    }
  }

  // 3. fallback
  if (policy.type === 'fund_insurance') {
    return Math.round(Number(policy.monthlyPremium) || 0);
  }

  return Math.round(Number(policy.monthlyAverage) || 0);
}