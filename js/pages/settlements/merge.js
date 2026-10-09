// ============================================
// merge.js — 結算資料合併邏輯（v102.0.0）
// 位置：js/pages/settlements/merge.js
// ============================================
// v102.0.0 修正：
//   ✅ 合併 bankId / txnId / paymentMode / advanceHolderId
//   ✅ 保留 v101.8.6 全部功能（以 linked 為主）
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

  // 2. linked_xxx 對照
  const linkedMap = {};
  memberExpenses
    .filter((e) => e.isAutoLinked)
    .forEach((e) => {
      const policyId = e.policyId || _extractPolicyId(e.id);
      if (!policyId) return;
      linkedMap[policyId] = e;
    });

  // 3. 合併 linked_xxx + insuranceRows
  const allPolicyIds = new Set([
    ...Object.keys(linkedMap),
    ...insuranceRows.map((p) => p.policyId),
  ]);

  allPolicyIds.forEach((policyId) => {
    const linked = linkedMap[policyId];
    const insuranceRow = insuranceRows.find((p) => p.policyId === policyId);

    if (linked) {
      rows.push(_buildLinkedInsuranceRow(linked, insuranceRow, year, month, policyId));
    } else if (insuranceRow) {
      rows.push(_buildInsuranceRow(insuranceRow, year, month));
    }
  });

  return rows;
}

/* ============================================
   個人支出
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
    bankId: e.bankId || '',                 // 🆕 v102.0.0
    txnId: e.txnId || '',                   // 🆕 v102.0.0
    isAutoLinked: false,
    _ref: {
      memberId: e.memberId,
      expenseId: e.id,
    },
  };
}

/* ============================================
   保險平攤（以 linked 為主）
   ============================================ */
function _buildLinkedInsuranceRow(linked, insuranceRow, year, month, policyId) {
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
    amount: Number(linked.amount) || 0,
    status,
    isDone: _isDoneStatus(status, 'insurance'),
    date: linked.date || insuranceRow?.date || '',
    categoryId: linked.categoryId || '',
    bankId: linked.bankId || insuranceRow?.bankId || '',           // 🆕 v102.0.0
    txnId: linked.txnId || insuranceRow?.txnId || '',              // 🆕 v102.0.0
    paymentMode: insuranceRow?.paymentMode || 'direct',            // 🆕 v102.0.0
    advanceHolderId: insuranceRow?.advanceHolderId || '',          // 🆕 v102.0.0
    isAutoLinked: true,
    _ref: {
      policyId,
      memberId: effectiveMemberId,
      linkedId: linked.id,
    },
  };
}

/* ============================================
   保險（無 linked_xxx 時）
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
    bankId: p.bankId || '',                        // 🆕 v102.0.0
    txnId: p.txnId || '',                          // 🆕 v102.0.0
    paymentMode: p.paymentMode || 'direct',        // 🆕 v102.0.0
    advanceHolderId: p.advanceHolderId || '',      // 🆕 v102.0.0
    isAutoLinked: false,
    _ref: {
      policyId: p.policyId,
      memberId: effectiveMemberId,
    },
  };
}

/* ============================================
   內部工具
   ============================================ */
function _extractPolicyId(id) {
  if (!id || typeof id !== 'string') return '';
  if (id.startsWith('linked_')) return id.slice(7);
  return '';
}

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