// ============================================
// merge.js — 結算資料合併邏輯（v101.8.6）
// 位置：js/pages/settlements/merge.js
// ============================================
// v101.8.6 修正：
//   ✅ [一致性] 保險平攤以 linked_xxx 為主
//       - 確保與總覽儀表板的支出金額一致
//       - 孤兒 linked_xxx 仍正確顯示
//   ✅ 保留 v101.6.11 全部功能
// ============================================

import { getStatusesByCategory } from '../../config/app-config.js';
import { RESERVED_IDS } from '../../config/constants.js';

/* ============================================
   主函式
   ============================================ */

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

  // 2. 🆕 保險平攤（linked_xxx）：建立 policyId → linked expense 對照
  const linkedMap = {};
  memberExpenses
    .filter((e) => e.isAutoLinked)
    .forEach((e) => {
      const policyId = e.policyId || _extractPolicyId(e.id);
      if (!policyId) return;
      linkedMap[policyId] = e;
    });

  // 3. 🆕 合併 linked_xxx + insuranceRows（以 linked 為主）
  const allPolicyIds = new Set([
    ...Object.keys(linkedMap),
    ...insuranceRows.map((p) => p.policyId),
  ]);

  allPolicyIds.forEach((policyId) => {
    const linked = linkedMap[policyId];
    const insuranceRow = insuranceRows.find((p) => p.policyId === policyId);

    if (linked) {
      // 🆕 優先使用 linked_xxx（與總覽一致）
      rows.push(_buildLinkedInsuranceRow(linked, insuranceRow, year, month, policyId));
    } else if (insuranceRow) {
      // 只有 insuranceRow（未扣款，或 linked 尚未產生）
      rows.push(_buildInsuranceRow(insuranceRow, year, month));
    }
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
    itemId: e.itemId || '',
    paymentMethodId: e.paymentMethodId || '',
    isAutoLinked: false,
    _ref: {
      memberId: e.memberId,
      expenseId: e.id,
    },
  };
}

/* ============================================
   🆕 v101.8.6：建立 Row：保險平攤（以 linked 為主）
   ============================================ */
function _buildLinkedInsuranceRow(linked, insuranceRow, year, month, policyId) {
  // 從 linked 讀取金額 / 狀態 / 日期
  // 從 insuranceRow 讀取 policyName / memberId（若存在）
  const effectiveMemberId = insuranceRow?.policyHolderId
    || insuranceRow?.memberId
    || linked.memberId
    || '';

  const status = linked.status || insuranceRow?.status || '已扣款';

  return {
    key: `insurance-${year}-${month}-${policyId}`,
    source: 'insurance',
    sourceLabel: '🛡 保險',
    year,
    month,
    memberId: effectiveMemberId,
    name: insuranceRow?.policyName || linked.name || '（未命名保單）',
    amount: Number(linked.amount) || 0,   // 🆕 以 linked amount 為主
    status,
    isDone: _isDoneStatus(status, 'insurance'),
    date: linked.date || insuranceRow?.date || '',
    categoryId: linked.categoryId || '',
    isAutoLinked: true,
    _ref: {
      policyId,
      memberId: effectiveMemberId,
      linkedId: linked.id,   // 🆕 保存 linked 的 id（供更新 / 刪除使用）
    },
  };
}

/* ============================================
   建立 Row：保險扣款（無 linked_xxx 時使用）
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
      // ⚠️ 無 linkedId（可能為未扣款）
    },
  };
}

/* ============================================
   🆕 v101.8.6：從 linked_{policyId} 提取 policyId
   ============================================ */
function _extractPolicyId(id) {
  if (!id || typeof id !== 'string') return '';
  if (id.startsWith('linked_')) return id.slice(7);
  return '';
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