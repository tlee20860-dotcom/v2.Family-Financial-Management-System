// ============================================
// merge.js — 結算資料合併邏輯（v101）
// 位置：js/pages/settlements/merge.js
// ============================================
// 用途：
//   將 3 個來源（個人支出 / 固定支出 / 保險扣款）
//   合併為統一格式的陣列，供 render.js 渲染
//
// 統一格式（row）：
//   {
//     key: string,              // 唯一識別（給事件用）
//     source: 'personal' | 'fixed' | 'insurance',
//     sourceLabel: string,      // 🏷個人 / 📋固定 / 🛡保險
//     year: string,
//     month: string,
//     memberId: string,         // personal / insurance 有；fixed 為 'shared'
//     memberName: string,       // 保留（呼叫端可自行 lookup）
//     name: string,             // 項目名稱
//     amount: number,
//     status: string,           // 狀態名稱（中文）
//     isDone: boolean,          // 是否為「已完成」類（依 app-config）
//     date: string,             // YYYY-MM-DD
//     isAutoLinked: boolean,    // 是否保險連動
//     // 內部欄位（供改狀態時定位）
//     _ref: {
//       // personal: { memberId, expenseId }
//       // fixed:    { id }
//       // insurance:{ policyId }
//     }
//   }
// ============================================

import { getStatusesByCategory } from '../../config/app-config.js';
import { RESERVED_IDS } from '../../config/constants.js';

/* ============================================
   主函式
   ============================================ */

/**
 * 合併 3 個來源
 * @param {Object} params
 * @param {Array} params.memberExpenses - 個人支出（含 memberId）
 * @param {Array} params.fixedExpenses - 固定支出
 * @param {Array} params.insuranceRows - 保險扣款（由 index.js 準備好）
 * @param {string} params.year
 * @param {string} params.month
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

  /* ============================================
     1. 個人支出（排除保險連動的鏡像紀錄）
     ============================================ */
  memberExpenses
    .filter((e) => !e.isAutoLinked)   // 排除 linked_{policyId}
    .forEach((e) => {
      rows.push(_buildPersonalRow(e, year, month));
    });

  /* ============================================
     2. 固定支出（排除「不適用」）
     ============================================ */
  fixedExpenses
    .filter((f) => f.status !== '不適用')
    .forEach((f) => {
      rows.push(_buildFixedRow(f, year, month));
    });

  /* ============================================
     3. 保險扣款
     ============================================ */
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
   建立 Row：保險扣款
   ============================================ */
function _buildInsuranceRow(p, year, month) {
  // 名稱顯示：保單名稱（含受保人）
  const displayName = p.policyName || '（未命名保單）';

  return {
    key: `insurance-${year}-${month}-${p.policyId}`,
    source: 'insurance',
    sourceLabel: '🛡 保險',
    year,
    month,
    memberId: p.memberId || '',
    name: displayName,
    amount: Number(p.amount) || 0,
    status: p.status || '已扣款',
    isDone: _isDoneStatus(p.status, 'insurance'),
    date: p.date || '',
    isAutoLinked: false,
    _ref: {
      policyId: p.policyId,
      memberId: p.memberId,
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

  // Fallback：以「已」開頭視為完成
  return statusName.startsWith('已');
}

/* ============================================
   輔助：依來源取得狀態選項
   ============================================ */
export function getStatusesForSource(source) {
  const map = {
    personal: 'personal',
    fixed: 'fixed',
    insurance: 'insurance',
  };
  const category = map[source] || 'personal';

  try {
    return getStatusesByCategory(category);
  } catch (e) {
    return [];
  }
}

/* ============================================
   輔助：分組統計（依來源）
   ============================================ */
export function groupBySource(rows) {
  const groups = {
    personal: [],
    fixed: [],
    insurance: [],
  };

  rows.forEach((r) => {
    if (groups[r.source]) groups[r.source].push(r);
  });

  return groups;
}

/* ============================================
   輔助：計算各來源的待處理總額
   ============================================ */
export function calcPendingTotals(rows) {
  const result = {
    personal: 0,
    fixed: 0,
    insurance: 0,
    total: 0,
  };

  rows.forEach((r) => {
    if (r.isDone) return;
    if (result[r.source] != null) {
      result[r.source] += r.amount;
    }
    result.total += r.amount;
  });

  return result;
}