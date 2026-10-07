// ============================================
// calc.js — 保險計算模組（v101）
// 位置：js/pages/insurance/calc.js
// ============================================
// 純計算函式（無副作用），可獨立測試
//
// 提供：
//   getPeriodRange(policy, periodIndex)          期間起迄
//   getPeriodInfo(policy, year, month)           當前年月屬於第幾期
//   getPolicyAnnualPremium(policy, year)         該年度年繳保費
//   getPolicyTotalPremium(policy)                保單總供款
//   getPolicyPaidTotal(payments)                 已供款總額
//   isPolicyCompleted(policy)                    是否供滿
//   computeEnrichedPolicies(policies, cache)     批次計算
//   countCompletedPolicies(enriched)             已供滿數量
// ============================================

/* ============================================
   1. 期間範圍
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
   2. 年繳保費
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
   3. 保單總供款
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

  // fallback 值
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
   4. 已供款總額
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

/* ============================================
   5. 供款狀態
   ============================================ */

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

/* ============================================
   6. 批次計算
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
   7. 統計：本年度總保費
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

/* ============================================
   8. 進度
   ============================================ */

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