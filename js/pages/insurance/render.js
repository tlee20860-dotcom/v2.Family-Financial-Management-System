// ============================================
// render.js — 保險渲染模組（v101.6）
// 位置：js/pages/insurance/render.js
// ============================================
// v101.6 修正：
//   ✅ 卡片 / 表格新增「編輯 / 刪除」按鈕（data-action）
//   ✅ 移除「更新扣款」按鈕（改為結算清單編輯）
//   ✅ 保留「恢復供款」按鈕（data-action="restore"）
// ============================================

import { escapeHtml, formatHKD } from '../../core/utils.js';
import {
  getPeriodRange,
  calcProgress,
  getPolicyHolderId,
} from '../../shared/insurance-calc.js';

/* ============================================
   全域展開狀態
   ============================================ */
const _expandedKeys = new Set();

export function toggleExpand(key) {
  if (_expandedKeys.has(key)) _expandedKeys.delete(key);
  else _expandedKeys.add(key);
}

export function isExpanded(key) {
  return _expandedKeys.has(key);
}

export function clearExpanded() {
  _expandedKeys.clear();
}

/* ============================================
   1. 統計卡（已由 index.js 使用 stats-cards 處理，此函式保留相容）
   ============================================ */
export function renderStats() {
  // v101.6：已由 index.js 的 _renderStats 使用 stats-cards.js
  // 保留空函式供相容
}

/* ============================================
   2. 已供滿區塊
   ============================================ */
export function renderCompletedSection(completed, members) {
  const section = document.getElementById('completed-section');
  const grid = document.getElementById('completed-grid');
  const countEl = document.getElementById('completed-count');
  const body = document.getElementById('completed-body');
  if (!section || !grid) return;

  if (!completed || completed.length === 0) {
    section.style.display = 'none';
    section.classList.remove('open');
    if (body) body.style.display = 'none';
    if (countEl) countEl.textContent = '0';
    grid.innerHTML = '';
    return;
  }

  section.style.display = 'block';
  if (countEl) countEl.textContent = String(completed.length);

  grid.innerHTML = completed.map((p) => _renderCardInner(p, members, true)).join('');

  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   3. 卡片模式
   ============================================ */
export function renderPolicyGrid(container, list, { members }) {
  if (!container) return;

  if (!list || list.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <div class="grid grid-3" id="policy-grid">
      ${list.map((p) => `
        <div class="glass-card policy-card">
          ${_renderCardInner(p, members, false)}
        </div>
      `).join('')}
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   卡片內部內容
   ============================================ */
function _renderCardInner(p, members, isCompleted) {
  if (p.type === 'fund_insurance') {
    return _renderFundInsuranceCard(p, members);
  }
  return _renderNormalPolicyCard(p, members, isCompleted);
}

function _memberName(members, memberId) {
  const m = members.find((x) => x.id === memberId);
  return m ? m.name : '（未指定）';
}

function _holderName(members, p) {
  return _memberName(members, getPolicyHolderId(p));
}

function _renderFundInsuranceCard(p, members) {
  const insuredName = _memberName(members, p.memberId);
  const holderName = _holderName(members, p);

  return `
    <div class="policy-header">
      <div>
        <div class="policy-name">${escapeHtml(p.name || '')}</div>
        <div class="policy-company">${escapeHtml(p.company || '')} · 基金保險</div>
      </div>
    </div>
    <div class="policy-info-grid">
      <div class="policy-info-item">
        <span class="policy-info-label">保單持有人</span>
        <span class="policy-info-value">${escapeHtml(holderName)}</span>
      </div>
      <div class="policy-info-item">
        <span class="policy-info-label">受保人</span>
        <span class="policy-info-value">${escapeHtml(insuredName)}</span>
      </div>
    </div>
    <div class="policy-info-grid" style="margin-top:10px; padding-top:10px; border-top:1px dashed rgba(255,255,255,0.08);">
      <div class="policy-info-item">
        <span class="policy-info-label">每月供款</span>
        <span class="policy-info-value text-cyan">${formatHKD(p.monthlyPremium)}</span>
      </div>
      <div class="policy-info-item">
        <span class="policy-info-label">保單總供款</span>
        <span class="policy-info-value text-magenta">${formatHKD(p._totalPremium)}</span>
      </div>
      <div class="policy-info-item">
        <span class="policy-info-label">供款年期</span>
        <span class="policy-info-value">${p.totalPolicyYears || '—'} 年</span>
      </div>
    </div>
    <div class="policy-actions">
      <button class="btn btn-sm btn-ghost" data-action="edit-policy" data-id="${p.id}">
        <i data-lucide="pencil" style="width:14px;height:14px;"></i> 編輯
      </button>
      <button class="btn btn-sm btn-danger" data-action="delete-policy" data-id="${p.id}">
        <i data-lucide="trash-2" style="width:14px;height:14px;"></i> 刪除
      </button>
    </div>
  `;
}

function _renderNormalPolicyCard(p, members, isCompleted) {
  const insuredName = _memberName(members, p.memberId);
  const holderName = _holderName(members, p);
  const totalPeriods = p.totalPolicyPeriods || 0;
  const done = p.completedPeriods || 0;
  const pct = calcProgress(p);
  const startDateText = `${p.firstStartYear}-${p.firstStartMonth}`;
  const currentAnnual = p._currentAnnualPremium || 0;
  const totalPremium = p._totalPremium || 0;
  const paidTotal = p._paidTotal || 0;
  const remaining = Math.max(0, totalPremium - paidTotal);

  const displayYear = new Date().getFullYear();
  const cardKey = `card-${p.id}`;
  const isOpen = isExpanded(cardKey);

  return `
    <div class="policy-header">
      <div>
        <div class="policy-name">${escapeHtml(p.name || '')}</div>
        <div class="policy-company">${escapeHtml(p.company || '')} · 普通保險</div>
      </div>
    </div>

    <div class="policy-info-grid">
      <div class="policy-info-item">
        <span class="policy-info-label">保單持有人</span>
        <span class="policy-info-value">${escapeHtml(holderName)}</span>
      </div>
      <div class="policy-info-item">
        <span class="policy-info-label">受保人</span>
        <span class="policy-info-value">${escapeHtml(insuredName)}</span>
      </div>
      <div class="policy-info-item">
        <span class="policy-info-label">開始日期</span>
        <span class="policy-info-value">${startDateText}</span>
      </div>
    </div>

    <div class="policy-info-grid" style="margin-top:10px; padding-top:10px; border-top:1px dashed rgba(255,255,255,0.08);">
      <div class="policy-info-item">
        <span class="policy-info-label">本期年繳（${displayYear}）</span>
        <span class="policy-info-value text-cyan">${formatHKD(currentAnnual)}</span>
      </div>
      <div class="policy-info-item">
        <span class="policy-info-label">保單總供款</span>
        <span class="policy-info-value text-magenta">${formatHKD(totalPremium)}</span>
      </div>
      <div class="policy-info-item">
        <span class="policy-info-label">已供款總額</span>
        <span class="policy-info-value text-emerald">${formatHKD(paidTotal)}</span>
      </div>
      <div class="policy-info-item">
        <span class="policy-info-label">剩餘供款</span>
        <span class="policy-info-value text-orange">${formatHKD(remaining)}</span>
      </div>
    </div>

    <div class="policy-progress" style="margin-top:12px;">
      <div class="policy-progress-text">
        <span>整體供款進度</span>
        <span>${done} / ${totalPeriods} 期 (${pct}%)</span>
      </div>
      <div class="progress">
        <div class="progress-bar" style="width:${pct}%;"></div>
      </div>
    </div>

    <div style="margin-top:12px;">
      <button class="btn btn-sm btn-ghost insurance-expand-btn" data-toggle-key="${cardKey}" style="width:100%; justify-content:space-between;">
        <span>${isOpen ? '收起明細' : '展開明細'}</span>
        <i data-lucide="${isOpen ? 'chevron-up' : 'chevron-down'}" style="width:14px;height:14px;"></i>
      </button>
      <div class="insurance-expand-body" style="display:${isOpen ? 'block' : 'none'}; margin-top:10px;">
        ${_renderPolicyDetail(p, p._payments || {})}
      </div>
    </div>

    <div class="policy-actions">
      <button class="btn btn-sm btn-ghost" data-action="edit-policy" data-id="${p.id}">
        <i data-lucide="pencil" style="width:14px;height:14px;"></i> 編輯
      </button>
      <button class="btn btn-sm btn-danger" data-action="delete-policy" data-id="${p.id}">
        <i data-lucide="trash-2" style="width:14px;height:14px;"></i> 刪除
      </button>
      ${isCompleted ? `<button class="btn btn-sm btn-ghost" data-action="restore" data-id="${p.id}">
        <i data-lucide="rotate-ccw" style="width:14px;height:14px;"></i> 恢復供款
      </button>` : ''}
    </div>
  `;
}

/* ============================================
   4. 表格模式
   ============================================ */
export function renderPolicyTable(container, list, { members }) {
  if (!container) return;

  if (!list || list.length === 0) {
    container.innerHTML = '';
    return;
  }

  const sorted = [...list].sort((a, b) => {
    const da = new Date(Number(a.firstStartYear), Number(a.firstStartMonth) - 1, 1);
    const db = new Date(Number(b.firstStartYear), Number(b.firstStartMonth) - 1, 1);
    return da - db;
  });

  container.innerHTML = `
    <div class="glass-card policy-table-wrapper" style="padding:0; overflow:hidden;">
      <div style="overflow-x:auto;">
        <table class="policy-table">
          <thead>
            <tr>
              <th style="width:36px;"></th>
              <th class="hide-mobile">開始日期</th>
              <th class="hide-mobile">持有人</th>
              <th class="hide-mobile">受保人</th>
              <th>保單名稱</th>
              <th class="hide-mobile">保險公司</th>
              <th class="num">本期年繳</th>
              <th class="num hide-mobile">保單總供款</th>
              <th class="num">已供款總額</th>
              <th class="num hide-mobile">每月分攤</th>
              <th class="progress-cell">進度</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${sorted.map((p) => _renderTableRow(p, members)).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
}

function _renderTableRow(p, members) {
  const insuredName = _memberName(members, p.memberId);
  const holderName = _holderName(members, p);
  const isFund = p.type === 'fund_insurance';
  const totalPeriods = p.totalPolicyPeriods || 0;
  const done = p.completedPeriods || 0;
  const pct = calcProgress(p);
  const currentAnnual = p._currentAnnualPremium || 0;
  const totalPremium = p._totalPremium || 0;
  const paidTotal = p._paidTotal || 0;
  const startDateText = `${p.firstStartYear}-${p.firstStartMonth}`;
  const monthly = isFund
    ? (p.monthlyPremium || 0)
    : ((p.periods?.[String(p.currentPeriodIndex || 1)]?.monthlyAverage) || p.monthlyAverage || 0);

  const tableKey = `table-${p.id}`;
  const isOpen = isExpanded(tableKey);

  return `
    <tr>
      <td>
        <button class="btn btn-sm btn-ghost" data-toggle-key="${tableKey}" style="padding:2px 6px;">
          <i data-lucide="${isOpen ? 'chevron-up' : 'chevron-down'}" style="width:14px;height:14px;"></i>
        </button>
      </td>
      <td class="mono hide-mobile" style="font-size:12px;">${startDateText}</td>
      <td class="hide-mobile">${escapeHtml(holderName)}</td>
      <td class="hide-mobile">${escapeHtml(insuredName)}</td>
      <td class="policy-name-cell">${escapeHtml(p.name || '')}</td>
      <td class="hide-mobile" style="font-size:12px; color:var(--text-muted);">${escapeHtml(p.company || '—')}</td>
      <td class="num text-cyan">${formatHKD(currentAnnual)}</td>
      <td class="num text-magenta hide-mobile">${formatHKD(totalPremium)}</td>
      <td class="num text-emerald">${formatHKD(paidTotal)}</td>
      <td class="num text-magenta hide-mobile">${formatHKD(monthly)}</td>
      <td class="progress-cell">
        <div class="progress-text">${done} / ${totalPeriods} 期 (${pct}%)</div>
        <div class="progress"><div class="progress-bar" style="width:${pct}%;"></div></div>
      </td>
      <td>
        <button class="btn btn-sm btn-ghost" data-action="edit-policy" data-id="${p.id}" title="編輯">
          <i data-lucide="pencil" style="width:14px;height:14px;"></i>
        </button>
        <button class="btn btn-sm btn-danger" data-action="delete-policy" data-id="${p.id}" title="刪除">
          <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
        </button>
      </td>
    </tr>
    <tr class="insurance-table-detail-row" style="display:${isOpen ? 'table-row' : 'none'};">
      <td colspan="12">
        <div class="detail-wrapper">
          ${_renderPolicyDetail(p, p._payments || {})}
        </div>
      </td>
    </tr>
  `;
}

/* ============================================
   5. 保單明細（每月扣款狀態，唯讀）
   ============================================ */
function _renderPolicyDetail(policy, payments) {
  const totalYears = policy.totalPolicyYears || 1;
  const detailBlocks = [];

  for (let i = 1; i <= totalYears; i++) {
    const range = getPeriodRange(policy, i);
    const key = `detail-${policy.id}-${i}`;
    const isOpen = isExpanded(key);

    const months = [];
    const detailStart = new Date(range.startY, Number(range.startM) - 1, 1);
    let totalPaid = 0;

    for (let j = 0; j < 12; j++) {
      const cur = new Date(detailStart);
      cur.setMonth(cur.getMonth() + j);
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const payment = payments[y]?.[m] || {};
      const defaultAmount = Math.round(
        (policy.periods?.[String(i)]?.monthlyAverage) || policy.monthlyAverage || 0
      );
      const amount = payment.amount ? Math.round(payment.amount) : defaultAmount;
      const isPaid = payment.status === '已扣款';
      if (isPaid) totalPaid += amount;

      months.push(`
        <div class="insurance-month-row">
          <div class="ins-date">${y}-${m}</div>
          <div style="flex:1; text-align:right;" class="mono">${formatHKD(amount)}</div>
          <div style="flex-shrink:0; min-width:70px; text-align:right;">
            ${isPaid
              ? '<span class="badge badge-success">已扣款</span>'
              : '<span class="badge badge-pending">未扣款</span>'}
          </div>
        </div>
      `);
    }

    detailBlocks.push(`
      <div class="insurance-year-block">
        <div class="insurance-year-header" data-toggle-key="${key}">
          <span class="ins-year-title">第 ${i} 年度（${range.rangeText}）</span>
          <div class="ins-year-right">
            <span class="mono ins-paid-sum">已扣款：${formatHKD(totalPaid)}</span>
            <i data-lucide="${isOpen ? 'chevron-up' : 'chevron-down'}" style="width:14px;height:14px;color:var(--text-muted);"></i>
          </div>
        </div>
        <div class="insurance-year-body" style="display:${isOpen ? 'block' : 'none'};">
          ${months.join('')}
        </div>
      </div>
    `);
  }

  return `<div class="insurance-detail-container">${detailBlocks.join('')}</div>`;
}

/* ============================================
   工具
   ============================================ */
function _setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}