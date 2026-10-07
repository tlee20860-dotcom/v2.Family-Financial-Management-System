// ============================================
// merge.js — 結算資料合併邏輯（v101.6）
// 位置：js/pages/settlements/merge.js
// ============================================
// v101.6 修正：
//   ✅ 移除 fixedExpenses 來源（固定支出廢除）
//   ✅ 保留「家庭共用支出」（作為 shared member 的個人支出）
//   ✅ 保險 row 支援 policyHolderId
// ============================================

import { getStatusesByCategory } from '../../config/app-config.js';
import { RESERVED_IDS } from '../../config/constants.js';

/* ============================================
   主函式
   ============================================ */

/**
 * 合併 2 個來源
 * @param {Object} params
 * @param {Array} params.memberExpenses - 成員支出（含家庭共用）
 * @param {Array} params.insuranceRows - 保險扣款
 * @param {string} params.year
 * @param {string} params.month
 * @returns {Array} 合併後的 row 陣列
 */
export function mergeSettlementData({
  memberExpenses = [],
  insuranceRows = [],
  year,
  month,
}) {
  const rows = [];

  // 1. 個人支出（含家庭共用）
  memberExpenses
    .filter((e) => !e.isAutoLinked)
    .forEach((e) => {
      rows.push(_buildPersonalRow(e, year, month));
    });

  // 2. 保險扣款
  insuranceRows.forEach((p) => {
    rows.push(_buildInsuranceRow(p, year, month));
  });

  return rows;
}

/* ============================================
   建立 Row：個人支出（含家庭共用）
   ============================================ */
function _buildPersonalRow(e, year, month) {
  const isShared = e.memberId === RESERVED_IDS.SHARED_MEMBER;

  return {
    key: `personal-${year}-${month}-${e.memberId}-${e.id}`,
    source: 'personal',
    sourceLabel: isShared ? '🏠 家庭' : '🏷 個人',
    year,
    month,
    memberId: e.memberId || '',
    name: e.name || '（未命名）',
    amount: Number(e.amount) || 0,
    status: e.status || '未處理',
    isDone: _isDoneStatus(e.status, 'personal'),
    date: e.date || '',
    categoryId: e.categoryId || '',
    isAutoLinked: false,
    _ref: {
      memberId: e.memberId,
      expenseId: e.id,
    },
  };
}

/* ============================================
   建立 Row：保險扣款
   ============================================ */
function _buildInsuranceRow(p, year, month) {
  const effectiveMemberId = p.policyHolderId || p.memberId || '';
  const displayName = p.policyName || '（未命名保單）';

  return {
    key: `insurance-${year}-${month}-${p.policyId}`,
    source: 'insurance',
    sourceLabel: '🛡 保險',
    year,
    month,
    memberId: effectiveMemberId,
    name: displayName,
    amount: Number(p.amount) || 0,
    status: p.status || '已扣款',
    isDone: _isDoneStatus(p.status, 'insurance'),
    date: p.date || '',
    categoryId: '',
    isAutoLinked: false,
    _ref: {
      policyId: p.policyId,
      memberId: effectiveMemberId,
    },
  };
}

/* ============================================
   判斷是否「已完成」
   ============================================ */
function _isDoneStatus(statusName, category) {
  if (!statusName) return false;

  try {
    const statuses = getStatusesByCategory(category);
    const found = statuses.find((s) => s.name === statusName);
    if (found) return !!found.isDone;
  } catch (e) {
    // app-config 尚未載入時 fallback
  }

  return statusName.startsWith('已');
}