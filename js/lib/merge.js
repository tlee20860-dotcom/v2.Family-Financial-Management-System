// ============================================
// merge.js — 結算資料合併邏輯（v103.0.0）
// 位置：js/lib/merge.js
// ============================================
// 來源：從 js/pages/settlements/merge.js 抽出（v103.0.0）
//
// 職責：
//   1. 合併「個人支出 / 保險扣款」為統一的結算資料列
//   2. 解析舊 linked_xxx 為保單對照
//   3. 保險狀態只接受保險類別（避免混用個人類別狀態）
//
// 相容：
//   - 舊 linked_ 前綴完全相容
//   - 保險狀態 fallback 至「未扣款」
// ============================================

import { getStatusesByCategory } from '../config/app-config.js';
import { RESERVED_IDS } from '../config/constants.js';

/* ============================================
   保險類別狀態快取（避免重複查詢）
   ============================================ */
let _insuranceStatusNames = null;

function _getInsuranceStatusNames() {
  if (_insuranceStatusNames) return _insuranceStatusNames;
  try {
    const list = getStatusesByCategory('insurance');
    _insuranceStatusNames = new Set(list.map((s) => s.name));
  } catch (e) {
    _insuranceStatusNames = new Set(['未扣款', '已扣款']);
  }
  return _insuranceStatusNames;
}

/**
 * 重置快取（家庭切換 / 設定更新時呼叫）
 */
export function resetInsuranceStatusCache() {
  _insuranceStatusNames = null;
}

/* ============================================
   主函式
   ============================================ */

/**
 * 合併結算資料
 *
 * @param {Object} params
 * @param {Array} params.memberExpenses - 成員支出（含 isAutoLinked）
 * @param {Array} params.insuranceRows - 保險扣款列
 * @param {string|number} params.year
 * @param {string|number} params.month
 * @returns {Array} 合併後的結算列
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
    bankId: e.bankId || '',
    txnId: e.txnId || '',
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

  // 保險類別狀態解析（優先順序）：
  //   1. insurance_payments.status（若為保險類別狀態）
  //   2. linked.status（若為保險類別狀態）
  //   3. '未扣款'（fallback）
  const status = _resolveInsuranceStatus(insuranceRow?.status, linked.status);

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
    bankId: linked.bankId || insuranceRow?.bankId || '',
    txnId: linked.txnId || insuranceRow?.txnId || '',
    paymentMode: insuranceRow?.paymentMode || 'direct',
    advanceHolderId: insuranceRow?.advanceHolderId || '',
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

  const status = _resolveInsuranceStatus(p.status);

  return {
    key: `insurance-${year}-${month}-${p.policyId}`,
    source: 'insurance',
    sourceLabel: '🛡 保險',
    year,
    month,
    memberId: effectiveMemberId,
    name: displayName,
    amount: Number(p.amount) || 0,
    status,
    isDone: _isDoneStatus(status, 'insurance'),
    date: p.date || '',
    categoryId: '',
    bankId: p.bankId || '',
    txnId: p.txnId || '',
    paymentMode: p.paymentMode || 'direct',
    advanceHolderId: p.advanceHolderId || '',
    isAutoLinked: false,
    _ref: {
      policyId: p.policyId,
      memberId: effectiveMemberId,
    },
  };
}

/* ============================================
   保險狀態解析（只接受保險類別狀態）
   ============================================ */
function _resolveInsuranceStatus(...candidates) {
  const validNames = _getInsuranceStatusNames();
  for (const c of candidates) {
    if (!c) continue;
    if (validNames.has(c)) return c;
  }
  return '未扣款';
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
    // fallback
  }

  return statusName.startsWith('已');
}
