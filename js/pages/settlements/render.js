// ============================================
// render.js — 結算清單渲染（v101.3）
// 位置：js/pages/settlements/render.js
// ============================================
// v101.3 修正：
//   ✅ 移除未使用的 bindStatusChangeEvents export
//   ✅ 移除未使用的 AppState import
//   ✅ 移除未使用的 renderSummary export
//   ✅ 新增 setMembersCache / 修正 _getMemberName（顯示真實成員名）
// ============================================

import {
  updateExpense,
  updateFixedExpense,
  saveInsurancePaymentBatch,
  removeInsurancePaymentBatch,
} from '../../core/db.js';
import { api } from '../../core/api.js';
import { getStatusesByCategory } from '../../config/app-config.js';
import { escapeHtml, formatHKD } from '../../core/utils.js';

/* ============================================
   🆕 v101.3：成員快取（由 index.js 注入）
   ============================================ */
let _membersCache = [];

/**
 * 設定成員快取
 * @param {Array} members - [{ id, name, ... }]
 */
export function setMembersCache(members) {
  _membersCache = members || [];
}

/* ============================================
   對外：表格渲染
   ============================================ */
export function renderSettlementTable(container, rows) {
  if (!container) return;

  if (!rows || rows.length === 0) {
    container.innerHTML = `
      <div class="glass-card">
        <div class="empty-state">沒有符合條件的紀錄</div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="glass-card collapsible-card collapsible-card-flat" style="padding:0;">
      <div style="overflow-x:auto;">
        <table class="data-table settlement-table mobile-cards">
          <thead>
            <tr>
              <th style="width:90px;">來源</th>
              <th class="hide-mobile" style="width:80px;">年月</th>
              <th class="hide-mobile" style="width:80px;">成員</th>
              <th>項目名稱</th>
              <th class="num" style="width:110px;">金額</th>
              <th class="hide-mobile" style="width:100px;">日期</th>
              <th style="width:140px;">狀態</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((r) => _renderTableRow(r)).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function _renderTableRow(r) {
  const memberName = _getMemberName(r);
  const statusCell = _renderStatusCell(r);

  return `
    <tr data-key="${escapeHtml(r.key)}">
      <td data-label="來源">${_renderSourceBadge(r)}</td>
      <td class="hide-mobile mono" data-label="年月" style="font-size:12px;">
        ${escapeHtml(r.year)}-${escapeHtml(r.month)}
      </td>
      <td class="hide-mobile" data-label="成員" style="font-size:12px;">
        ${escapeHtml(memberName)}
      </td>
      <td data-primary="1">${escapeHtml(r.name)}</td>
      <td class="num" data-label="金額">${formatHKD(r.amount)}</td>
      <td class="hide-mobile mono" data-label="日期" style="font-size:11px; color:var(--text-muted);">
        ${escapeHtml(r.date || '—')}
      </td>
      <td data-label="狀態">${statusCell}</td>
    </tr>
  `;
}

/* ============================================
   對外：卡片渲染
   ============================================ */
export function renderSettlementCards(container, rows) {
  if (!container) return;

  if (!rows || rows.length === 0) {
    container.innerHTML = `
      <div class="glass-card">
        <div class="empty-state">沒有符合條件的紀錄</div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="grid grid-3" style="gap:10px;">
      ${rows.map((r) => _renderCard(r)).join('')}
    </div>
  `;
}

function _renderCard(r) {
  const memberName = _getMemberName(r);
  const statusCell = _renderStatusCell(r);

  return `
    <div class="glass-card" data-key="${escapeHtml(r.key)}" style="padding:14px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; margin-bottom:10px;">
        <div style="flex:1; min-width:0;">
          <div style="margin-bottom:6px;">${_renderSourceBadge(r)}</div>
          <div style="font-weight:600; color:var(--text-primary); word-break:break-word; margin-bottom:4px;">
            ${escapeHtml(r.name)}
          </div>
          <div style="font-size:11px; color:var(--text-muted);">
            ${escapeHtml(r.year)}-${escapeHtml(r.month)} · ${escapeHtml(memberName)}
            ${r.date ? ` · ${escapeHtml(r.date)}` : ''}
          </div>
        </div>
        <div style="text-align:right; flex-shrink:0;">
          <div class="mono text-emerald" style="font-weight:700; font-size:14px;">
            ${formatHKD(r.amount)}
          </div>
        </div>
      </div>
      <div style="padding-top:10px; border-top:1px dashed rgba(255,255,255,0.08);">
        ${statusCell}
      </div>
    </div>
  `;
}

/* ============================================
   來源 Badge
   ============================================ */
function _renderSourceBadge(r) {
  const map = {
    personal:  { cls: 'badge-info',    label: '🏷 個人' },
    fixed:     { cls: 'badge-magenta', label: '📋 固定' },
    insurance: { cls: 'badge-success', label: '🛡 保險' },
  };
  const cfg = map[r.source] || map.personal;
  return `<span class="badge ${cfg.cls}">${cfg.label}</span>`;
}

/* ============================================
   狀態 Cell（含可改狀態的下拉）
   ============================================ */
function _renderStatusCell(r) {
  const statuses = getStatusesByCategory(r.source);
  if (statuses.length === 0) {
    return _renderStatusBadge(r.status, r.isDone);
  }

  const options = statuses.map((s) =>
    `<option value="${escapeHtml(s.name)}" ${s.name === r.status ? 'selected' : ''}>${escapeHtml(s.name)}</option>`
  ).join('');

  return `
    <select class="select settlement-status-select" data-key="${escapeHtml(r.key)}"
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
   成員名稱（🆕 v101.3：使用 membersCache）
   ============================================ */
function _getMemberName(r) {
  if (r.source === 'fixed') {
    return r.memberId === 'shared' ? '家庭共用' : '（成員）';
  }

  if (r.source === 'personal' || r.source === 'insurance') {
    const m = _membersCache.find((x) => x.id === r.memberId);
    if (m) return m.name;
  }

  return r._memberName || '（未知）';
}

/* ============================================
   狀態寫回（核心邏輯）
   ============================================ */
export async function updateRowStatus(row, newStatus) {
  if (!row) throw new Error('找不到紀錄');

  const isDone = _isDoneByName(newStatus, row.source);
  const today = new Date().toISOString().slice(0, 10);

  switch (row.source) {
    case 'personal':
      return _updatePersonalStatus(row, newStatus, isDone ? today : '');
    case 'fixed':
      return _updateFixedStatus(row, newStatus, isDone ? today : '');
    case 'insurance':
      return _updateInsuranceStatus(row, newStatus, isDone);
    default:
      throw new Error('未知的來源：' + row.source);
  }
}

async function _updatePersonalStatus(row, newStatus, repaidDate) {
  const { memberId, expenseId } = row._ref;
  await updateExpense(row.year, row.month, memberId, expenseId, {
    status: newStatus,
    repaidDate,
  });
}

async function _updateFixedStatus(row, newStatus, paidDate) {
  const { id } = row._ref;
  await updateFixedExpense(row.year, row.month, id, {
    status: newStatus,
    paidDate,
  });
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

/* ============================================
   判斷是否「已完成」
   ============================================ */
function _isDoneByName(statusName, source) {
  try {
    const statuses = getStatusesByCategory(source);
    const found = statuses.find((s) => s.name === statusName);
    if (found) return !!found.isDone;
  } catch (e) {
    // ignore
  }
  return statusName && statusName.startsWith('已');
}
