// ============================================
// insurance.js — 保險計算模組（v103.0.0）
// 位置：js/lib/insurance.js
// ============================================
// 來源：從 js/shared/insurance-calc.js 改名（v103.0.0）
//
// 職責：
//   1. 保單持有人 fallback（policyHolderId → memberId）
//   2. 保單期間範圍 / 期數計算
//   3. 年繳保費 / 月平均 / 總供款
//   4. 已供款總額 / 完成期數
//   5. 供款進度 / 完成判斷
//   6. 批次 enrich（computeEnrichedPolicies）
// ============================================

import { getPolicyEffectiveMemberId } from '../config/constants.js';

/* ============================================
   1. 成員 ID fallback
   ============================================ */
export function getPolicyHolderId(policy) {
  return getPolicyEffectiveMemberId(policy);
}

/* ============================================
   2. 期間範圍
   ============================================ */
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
export function getPolicyAnnualPremium(policy, targetYear) {
  if (!policy) return 0;

  const year = Number(targetYear);
  const firstY = Number(policy.firstStartYear) || 0;

  if (!firstY || year < firstY) return 0;

  const periodIndex = year - firstY + 1;
  const totalYears = Number(policy.totalPolicyYears) || 0;

  if (totalYears > 0 && periodIndex > totalYears) return 0;

  // 基金保險 = monthlyPremium × 12
  if (policy.type === 'fund_insurance') {
    const mp = Number(policy.monthlyPremium) || 0;
    return Math.round(mp * 12);
  }

  const periods = policy.periods || {};
  const p = periods[String(periodIndex)];

  if (p && p.annualPremium) {
    return Math.round(Number(p.annualPremium));
  }

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
   4. 每月分攤金額
   ============================================ */
export function resolveMonthlyAmount(policy, year, month, paymentData) {
  if (!policy) return 0;

  if (paymentData && paymentData.amount && Number(paymentData.amount) > 0) {
    return Math.round(Number(paymentData.amount));
  }

  if (policy.type === 'fund_insurance') {
    return Math.round(Number(policy.monthlyPremium) || 0);
  }

  const info = getPeriodInfo(policy, year, month);
  if (info) {
    const periodData = (policy.periods || {})[String(info.periodIndex)];
    if (periodData && periodData.monthlyAverage) {
      return Math.round(Number(periodData.monthlyAverage));
    }
  }

  return Math.round(Number(policy.monthlyAverage) || 0);
}

export function estimateMonthlyAmount(policy, year, month) {
  return resolveMonthlyAmount(policy, year, month, null);
}

/* ============================================
   5. 保單總供款
   ============================================ */
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
   6. 已供款總額 / 完成期數
   ============================================ */
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
export function isPolicyCompleted(policy) {
  if (!policy) return false;
  if (policy.isCompleted) return true;
  if (policy.type === 'fund_insurance') return false;

  const total = Number(policy.totalPolicyPeriods) || 0;
  if (total <= 0) return false;

  const done = Number(policy.completedPeriods) || 0;
  return done >= total;
}

export function calcProgress(policy) {
  const total = Number(policy.totalPolicyPeriods) || 0;
  const done = Number(policy.completedPeriods) || 0;
  if (total <= 0) return 0;
  return Math.min(100, Math.round((done / total) * 100));
}

/* ============================================
   8. 批次計算
   ============================================ */
export function computeEnrichedPolicies(policies, paymentsCache, targetYear) {
  const year = Number(targetYear) || new Date().getFullYear();

  return (policies || []).map((p) => {
    const payments = paymentsCache[p.id] || {};
    const completedPeriods = p.type === 'fund_insurance' ? 0 : countCompletedPeriods(payments);

    const currentAnnualPremium = getPolicyAnnualPremium(p, year);
    const totalPremium = getPolicyTotalPremium(p);
    const paidTotal = getPolicyPaidTotal(payments);

    const enriched = {
      ...p,
      completedPeriods,
      _payments: payments,
      _currentAnnualPremium: currentAnnualPremium,
      _totalPremium: totalPremium,
      _paidTotal: paidTotal,
      _targetYear: year,
    };

    enriched._isCompleted = isPolicyCompleted(enriched);

    return enriched;
  });
}

export function countCompletedPolicies(enriched) {
  return (enriched || []).filter((p) => p._isCompleted).length;
}

/* ============================================
   9. 統計
   ============================================ */
export function calcYearTotalPremium(enriched, year) {
  return (enriched || []).reduce((s, p) => s + getPolicyAnnualPremium(p, year), 0);
}

export function calcMonthlyTotalAverage(enriched, year, month) {
  let total = 0;
  (enriched || []).forEach((p) => {
    if (p.type === 'fund_insurance') {
      const info = getPeriodInfo(p, year, month);
      if (info) {
        total += Math.round(Number(p.monthlyPremium) || 0);
      }
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
