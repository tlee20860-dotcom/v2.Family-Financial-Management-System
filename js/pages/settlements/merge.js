// ============================================
// merge.js — 結算資料合併邏輯（v101.5）
// 位置：js/pages/settlements/merge.js
// ============================================
// v101.5 修正：
//   ✅ 移除未使用的 getStatusesForSource / groupBySource / calcPendingTotals（死程式碼）
//   ✅ 保險 row 支援 policyHolderId
//   ✅ _isDoneStatus 改用 entity-helpers 的 isDoneStatus
// ============================================

import { getStatusesByCategory } from '../../config/app-config.js';
import { RESERVED_IDS } from '../../config/constants.js';

/* ============================================
   主函式
   ============================================ */

/**
 * 合併 3 個來源
 * @param {Object} params
 * @returns {Array} 合併後的 row 陣列
 */
export function mergeSettlementData({
  memberExpenses = [],
  fixedExpenses = [],
  insuranceRows = [],
  year,
  month,
}) {
  const rows = [];

  // 1. 個人支出（排除保險連動的鏡像紀錄）
  memberExpenses
    .filter((e) => !e.isAutoLinked)
    .forEach((e) => {
      rows.push(_buildPersonalRow(e, year, month));
    });

  // 2. 固定支出（排除「不適用」）
  fixedExpenses
    .filter((f) => f.status !== '不適用')
    .forEach((f) => {
      rows.push(_buildFixedRow(f, year, month));
    });

  // 3. 保險扣款
  insuranceRows.forEach((p) => {
    rows.push(_buildInsuranceRow(p, year, month));
  });

  return rows;
}

/* ============================================
   建立 Row：個人支出
   ============================================ */
function _buildPersonalRow(e, year, month) {
  return {
    key: `personal-${year}-${month}-${e.memberId}-${e.id}`,
    source: 'personal',
    sourceLabel: '🏷 個人',
    year,
    month,
    memberId: e.memberId || '',
    name: e.name || '（未命名）',
    amount: Number(e.amount) || 0,
    status: e.status || '未處理',
    isDone: _isDoneStatus(e.status, 'personal'),
    date: e.date || '',
    isAutoLinked: false,
    _ref: {
      memberId: e.memberId,
      expenseId: e.id,
    },
  };
}

/* ============================================
   建立 Row：固定支出
   ============================================ */
function _buildFixedRow(f, year, month) {
  return {
    key: `fixed-${year}-${month}-${f.id}`,
    source: 'fixed',
    sourceLabel: '📋 固定',
    year,
    month,
    memberId: f.memberId || RESERVED_IDS.SHARED_MEMBER,
    name: f.name || '（未命名）',
    amount: Number(f.amount) || 0,
    status: f.status || '未付款',
    isDone: _isDoneStatus(f.status, 'fixed'),
    date: f.paidDate || '',
    isAutoLinked: false,
    _ref: {
      id: f.id,
    },
  };
}

/* ============================================
   建立 Row：保險扣款（🆕 v101.5：policyHolderId）
   ============================================ */
function _buildInsuranceRow(p, year, month) {
  // 有效成員 ID 優先使用 policyHolderId
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