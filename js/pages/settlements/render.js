// ============================================
// render.js — 結算清單渲染輔助（v101.6）
// 位置：js/pages/settlements/render.js
// ============================================
// v101.6 重寫：
//   ✅ 只保留「狀態欄位」與「更新狀態」邏輯
//   ✅ 表格渲染改由 data-table.js 統一處理
//   ✅ setMembersCache 保留相容
// ============================================

import {
  updateEntityStatus,
  saveInsurancePaymentBatch,
  removeInsurancePaymentBatch,
} from '../../core/db.js';
import { api } from '../../core/api.js';
import { getStatusesByCategory } from '../../config/app-config.js';
import { escapeHtml } from '../../core/utils.js';
import { isDoneStatus } from '../../shared/entity-helpers.js';

/* ============================================
   成員快取（由 index.js 注入）
   ============================================ */
let _membersCache = [];

export function setMembersCache(members) {
  _membersCache = members || [];
}

export function getMembersCache() {
  return _membersCache;
}

/* ============================================
   狀態欄位渲染（供 data-table.js 的 customCellRender 使用）
   ============================================ */
export function renderStatusCell(row) {
  const statuses = getStatusesByCategory(row.source);
  if (statuses.length === 0) {
    return _renderStatusBadge(row.status, row.isDone);
  }

  const options = statuses.map((s) =>
    `<option value="${escapeHtml(s.name)}" ${s.name === row.status ? 'selected' : ''}>${escapeHtml(s.name)}</option>`
  ).join('');

  return `
    <select class="select settlement-status-select" data-key="${escapeHtml(row.key)}"
            style="padding:5px 8px; font-size:12px; background:rgba(8,11,17,0.6);">
      ${options}
    </select>
  `;
}

function _renderStatusBadge(status, isDone) {
  const cls = isDone ? 'badge-success' : 'badge-pending';
  return `<span class="badge ${cls}">${escapeHtml(status || '未處理')}</span>`;
}

/* ============================================
   來源 badge 渲染（供 data-table.js 使用）
   ============================================ */
export function renderSourceBadge(row) {
  const map = {
    personal:  { cls: 'badge-info',    label: row.memberId === 'shared' ? '🏠 家庭' : '🏷 個人' },
    insurance: { cls: 'badge-success', label: '🛡 保險' },
  };
  const cfg = map[row.source] || map.personal;
  return `<span class="badge ${cfg.cls}">${cfg.label}</span>`;
}

/* ============================================
   成員名稱
   ============================================ */
export function getMemberName(row) {
  if (row.source === 'personal' || row.source === 'insurance') {
    const m = _membersCache.find((x) => x.id === row.memberId);
    if (m) return m.name;
    if (row.memberId === 'shared') return '家庭共用';
  }
  return row._memberName || '（未知）';
}

/* ============================================
   狀態寫回（核心邏輯）
   ============================================ */
export async function updateRowStatus(row, newStatus) {
  if (!row) throw new Error('找不到紀錄');

  const isDone = isDoneStatus(newStatus, row.source);

  switch (row.source) {
    case 'personal':
      return updateEntityStatus('personal', row, newStatus, isDone);
    case 'insurance':
      return _updateInsuranceStatus(row, newStatus, isDone);
    default:
      throw new Error('未知的來源：' + row.source);
  }
}

async function _updateInsuranceStatus(row, newStatus, isDone) {
  const { policyId, memberId } = row._ref;
  const year = row.year;
  const month = row.month;

  if (isDone) {
    await saveInsurancePaymentBatch(policyId, year, month, {
      status: newStatus,
      amount: row.amount,
    });
    await api.insuranceSync({
      policyId,
      memberId,
      policyName: row.name,
      monthlyAverage: row.amount,
      year,
      month,
    });
  } else {
    await removeInsurancePaymentBatch(policyId, year, month);
    await api.insuranceUnsync({
      policyId,
      memberId,
      year,
      month,
    });
  }
}