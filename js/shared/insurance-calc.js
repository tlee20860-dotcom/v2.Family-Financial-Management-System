// ============================================
// insurance-calc.js — 保險計算模組（v101.5 🆕）
// 位置：js/shared/insurance-calc.js
// ============================================
// v101.5 新增：
//   ✅ 從 js/pages/insurance/calc.js 提升為全站共用
//   ✅ 新增 resolveMonthlyAmount（合併 sync.js 的 _resolveMonthlyAmount）
//   ✅ 新增 getPolicyHolderId（policyHolderId fallback 規則）
//   ✅ 純計算函式，無副作用
//
// 使用對象：
//   js/pages/insurance/*.js
//   js/pages/settlements/*.js
//   js/pages/input-center/tab-insurance.js
//   functions/api/summary.js 的對應邏輯（後端自行實作，不 import）
// ============================================

import { getPolicyEffectiveMemberId } from '../config/constants.js';

/* ============================================
   1. 成員 ID fallback
   ============================================ */

/**
 * 取得保單的有效成員 ID（policyHolderId || memberId）
 * @param {Object} policy
 * @returns {string}
 */
export function getPolicyHolderId(policy) {
  return getPolicyEffectiveMemberId(policy);
}

/* ============================================
   2. 期間範圍
   ============================================ */

/**
 * 取得某期（年度）的起迄日期
 * @param {Object} policy
 * @param {number} periodIndex - 第幾期（1-based）
 * @returns {{startY, startM, endY, endM, rangeText}}
 */
export function getPeriodRange(policy, periodIndex) {
  const firstY = Number(policy.firstStartYear) || 0;
  const firstM = Number(policy.firstStartMonth) || 1;

  const startDate = new Date(firstY, firstM - 1, 1);
  startDate.setMonth(startDate.getMonth() + (periodIndex - 1) * 12);

  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 11);

  return {
    startY: startDate.getFullYear(),
    startM: String(startDate.getMonth() + 1).padStart(2, '0'),
    endY: endDate.getFullYear(),
    endM: String(endDate.getMonth() + 1).padStart(2, '0'),
    rangeText: `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')} ~ ${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}`,
  };
}

/**
 * 取得某年月所屬的期別資訊
 * @param {Object} policy
 * @param {number} year
 * @param {number} month
 * @returns {Object|null} { periodIndex, startY, startM, endY, endM, rangeText }
 */
export function getPeriodInfo(policy, year, month) {
  const firstY = Number(policy.firstStartYear) || 0;
  const firstM = Number(policy.firstStartMonth) || 1;

  if (!firstY || firstY < 2000 || firstY > 2100) return null;
  if (!firstM || firstM < 1 || firstM > 12) return null;

  const startDate = new Date(firstY, firstM - 1, 1);
  const currentDate = new Date(Number(year), Number(month) - 1, 1);

  const diffMonths =
    (currentDate.getFullYear() - startDate.getFullYear()) * 12 +
    (currentDate.getMonth() - startDate.getMonth());

  if (diffMonths < 0) return null;

  const periodIndex = Math.floor(diffMonths / 12) + 1;

  const totalYears = Number(policy.totalPolicyYears) || 0;
  if (totalYears > 0 && periodIndex > totalYears) return null;

  return { periodIndex, ...getPeriodRange(policy, periodIndex) };
}

/* ============================================
   3. 年繳保費
   ============================================ */

/**
 * 取得該年度的年繳保費
 * 基金保險 → 0（不適用）
 * @param {Object} policy
 * @param {number|string} targetYear
 * @returns {number}
 */
export function getPolicyAnnualPremium(policy, targetYear) {
  if (!policy) return 0;

  if (policy.type === 'fund_insurance') return 0;

  const year = Number(targetYear);
  const firstY = Number(policy.firstStartYear) || 0;

  if (!firstY || year < firstY) return 0;

  const periodIndex = year - firstY + 1;
  const totalYears = Number(policy.totalPolicyYears) || 0;

  if (totalYears > 0 && periodIndex > totalYears) return 0;

  const periods = policy.periods || {};
  const p = periods[String(periodIndex)];

  if (p && p.annualPremium) {
    return Math.round(Number(p.annualPremium));
  }

  // fallback：找最接近的期別
  const periodKeys = Object.keys(periods)
    .map(Number)
    .filter((n) => !isNaN(n) && n > 0)
    .sort((a, b) => a - b);

  if (periodKeys.length > 0) {
    const below = periodKeys.filter((k) => k <= periodIndex);
    const target = below.length > 0 ? below[below.length - 1] : periodKeys[0];
    const tp = periods[String(target)];
    if (tp && tp.annualPremium) return Math.round(Number(tp.annualPremium));
  }

  return Math.round(Number(policy.annualPremium) || 0);
}

/* ============================================
   4. 每月分攤金額（統一入口）
   ============================================ */

/**
 * 解析某年月的分攤金額
 * 優先順序：
 *   1. paymentData.amount（若存在且 > 0）
 *   2. 該月所屬期別的 monthlyAverage
 *   3. policy.monthlyAverage（fallback）
 *   4. 基金保險 → policy.monthlyPremium
 *
 * @param {Object} policy
 * @param {number} year
 * @param {number} month
 * @param {Object} [paymentData]
 * @returns {number}
 */
export function resolveMonthlyAmount(policy, year, month, paymentData) {
  if (!policy) return 0;

  // 1. payment 自帶金額
  if (paymentData && paymentData.amount && Number(paymentData.amount) > 0) {
    return Math.round(Number(paymentData.amount));
  }

  // 基金保險
  if (policy.type === 'fund_insurance') {
    return Math.round(Number(policy.monthlyPremium) || 0);
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
  return Math.round(Number(policy.monthlyAverage) || 0);
}

/**
 * 估算某年月的分攤金額（不考慮已存在的 payment）
 * 用於 settlements 的「未扣款」保險顯示
 * @param {Object} policy
 * @param {number} year
 * @param {number} month
 * @returns {number}
 */
export function estimateMonthlyAmount(policy, year, month) {
  return resolveMonthlyAmount(policy, year, month, null);
}

/* ============================================
   5. 保單總供款
   ============================================ */

/**
 * 計算保單總供款（所有年期加總）
 * @param {Object} policy
 * @returns {number}
 */
export function getPolicyTotalPremium(policy) {
  if (!policy) return 0;

  if (policy.type === 'fund_insurance') {
    const monthly = Number(policy.monthlyPremium) || 0;
    const years = Number(policy.totalPolicyYears) || 0;
    return Math.round(monthly * 12 * years);
  }

  const totalYears = Number(policy.totalPolicyYears) || 0;

  if (totalYears === 0) {
    return Math.round(Number(policy.annualPremium) || 0);
  }

  const periods = policy.periods || {};
  const periodKeys = Object.keys(periods)
    .map(Number)
    .filter((n) => !isNaN(n) && n > 0)
    .sort((a, b) => a - b);

  let fallback = Math.round(Number(policy.annualPremium) || 0);
  if (!fallback && periodKeys.length > 0) {
    const last = periods[String(periodKeys[periodKeys.length - 1])];
    if (last && last.annualPremium) fallback = Math.round(Number(last.annualPremium));
  }

  let total = 0;
  for (let i = 1; i <= totalYears; i++) {
    const p = periods[String(i)];
    if (p && p.annualPremium) {
      total += Math.round(Number(p.annualPremium));
    } else {
      total += fallback;
    }
  }

  return total;
}

/* ============================================
   6. 已供款總額
   ============================================ */

/**
 * 計算已供款總額
 * @param {Object} payments - { year: { month: { status, amount } } }
 * @returns {number}
 */
export function getPolicyPaidTotal(payments) {
  let total = 0;
  Object.values(payments || {}).forEach((yearData) => {
    Object.values(yearData || {}).forEach((mData) => {
      if (mData && mData.status === '已扣款') {
        total += Math.round(Number(mData.amount) || 0);
      }
    });
  });
  return total;
}

/**
 * 計算已完成期數（依 payments 中「已扣款」的月份數）
 * @param {Object} payments
 * @returns {number}
 */
export function countCompletedPeriods(payments) {
  let count = 0;
  Object.values(payments || {}).forEach((yearData) => {
    Object.values(yearData || {}).forEach((mData) => {
      if (mData && mData.status === '已扣款') count++;
    });
  });
  return count;
}

/* ============================================
   7. 供款狀態
   ============================================ */

/**
 * 判斷是否已供滿
 * @param {Object} policy
 * @returns {boolean}
 */
export function isPolicyCompleted(policy) {
  if (!policy) return false;
  if (policy.isCompleted) return true;
  if (policy.type === 'fund_insurance') return false;

  const total = Number(policy.totalPolicyPeriods) || 0;
  if (total <= 0) return false;

  const done = Number(policy.completedPeriods) || 0;
  return done >= total;
}

/**
 * 計算供款進度百分比
 * @param {Object} policy
 * @returns {number} 0~100
 */
export function calcProgress(policy) {
  const total = Number(policy.totalPolicyPeriods) || 0;
  const done = Number(policy.completedPeriods) || 0;
  if (total <= 0) return 0;
  return Math.min(100, Math.round((done / total) * 100));
}

/* ============================================
   8. 批次計算
   ============================================ */

/**
 * 批次 enrich 所有保單
 * @param {Array} policies
 * @param {Object} paymentsCache - { policyId: paymentsObj }
 * @returns {Array} enriched 保單陣列
 */
export function computeEnrichedPolicies(policies, paymentsCache) {
  return (policies || []).map((p) => {
    const payments = paymentsCache[p.id] || {};
    const completedPeriods = p.type === 'fund_insurance' ? 0 : countCompletedPeriods(payments);

    const currentYear = new Date().getFullYear();
    const currentAnnualPremium = getPolicyAnnualPremium(p, currentYear);
    const totalPremium = getPolicyTotalPremium(p);
    const paidTotal = getPolicyPaidTotal(payments);

    const enriched = {
      ...p,
      completedPeriods,
      _payments: payments,
      _currentAnnualPremium: currentAnnualPremium,
      _totalPremium: totalPremium,
      _paidTotal: paidTotal,
    };

    enriched._isCompleted = isPolicyCompleted(enriched);

    return enriched;
  });
}

/**
 * 計算已供滿保單數量
 */
export function countCompletedPolicies(enriched) {
  return (enriched || []).filter((p) => p._isCompleted).length;
}

/* ============================================
   9. 統計
   ============================================ */

/**
 * 計算本年度所有保單的總保費
 * @param {Array} enriched
 * @param {number|string} year
 * @returns {number}
 */
export function calcYearTotalPremium(enriched, year) {
  return (enriched || []).reduce((s, p) => s + (p._currentAnnualPremium || 0), 0);
}

/**
 * 計算當前月分攤總額
 * @param {Array} enriched
 * @param {number} year
 * @param {number} month
 * @returns {number}
 */
export function calcMonthlyTotalAverage(enriched, year, month) {
  let total = 0;
  (enriched || []).forEach((p) => {
    if (p.type === 'fund_insurance') {
      total += Math.round(Number(p.monthlyPremium) || 0);
      return;
    }
    const info = getPeriodInfo(p, year, month);
    if (!info) return;
    const periodData = (p.periods || {})[String(info.periodIndex)];
    if (periodData && periodData.monthlyAverage) {
      total += Math.round(Number(periodData.monthlyAverage));
    }
  });
  return total;
}