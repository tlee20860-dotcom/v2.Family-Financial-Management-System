// ============================================
// fixed-expenses.js — 固定支出明細（v101 只讀化）
// 位置：js/pages/fixed-expenses.js
// ============================================
// v101 改動：
//   ✅ 移除新增 / 編輯 / 刪除（移至綜合輸入中心）
//   ✅ 移除 checkbox（改為只讀狀態 badge）
//   ✅ 保留卡片 / 表格雙模式
//   ✅ 加「前往輸入中心」按鈕
//   ✅ 狀態依 app-config
//   ✅ 底部快速摘要（待處理固定支出）
// ============================================

import {
  listenFixedTemplates, listenFixedExpenses,
  getFixedExpensesOnce, getFixedExpensesForYear,
} from '../core/db.js';
import { AppState } from '../core/state.js';
import { getStatusesByCategory } from '../config/app-config.js';
import { escapeHtml, formatHKD } from '../core/utils.js';
import { renderPageFilter } from '../shared/page-filter.js';
import { initViewToggle } from '../shared/view-toggle.js';
import { renderQuickSummary } from '../shared/quick-summary.js';
import { QUICK_SUMMARY_TYPES } from '../config/constants.js';

/* ============================================
   Module 狀態
   ============================================ */
let _templates = [];
let _monthlyData = {};
let _unsubTemplates = null;
let _unsubMonth = null;
let _unsubYM = null;
let _filterInstance = null;
let _viewToggle = null;
let _expandedKeys = new Set();

/* ============================================
   主入口
   ============================================ */
export async function initFixedExpensesPage() {
  // 檢視切換
  _viewToggle = initViewToggle({
    containerId: 'view-toggle-root',
    storageKey: 'fixed-view',
    defaultView: 'card',
    cardText: '卡片',
    tableText: '表格',
    autoApply: false,
    onChange: () => _render(),
  });

  // 前往輸入中心
  document.getElementById('go-input-center-btn')?.addEventListener('click', () => {
    window.location.href = 'input-center.html';
  });

  // 頁面篩選（只留年份）
  _filterInstance = renderPageFilter({
    containerId: 'page-filter-root',
    fields: ['year'],
  });

  // 監聽模板
  _unsubTemplates = listenFixedTemplates((list) => {
    _templates = list;
    _loadYearData();
  });

  // 監聽 AppState
  _unsubYM = AppState.on('ym-change', () => _loadYearData());

  return {
    destroy: _destroy,
  };
}

/* ============================================
   載入整年資料
   ============================================ */
async function _loadYearData() {
  const year = AppState.year;
  if (!year) return;

  try {
    const monthlyData = {};
    const promises = [];
    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, '0');
      promises.push(
        getFixedExpensesOnce(year, mm).then((list) => {
          monthlyData[mm] = list;
        })
      );
    }
    await Promise.all(promises);
    _monthlyData = monthlyData;
    _render();
  } catch (err) {
    console.error('[fixed-expenses] 載入失敗：', err);
  }
}

/* ============================================
   渲染
   ============================================ */
function _render() {
  const year = AppState.year;
  const monthEl = document.getElementById('fixed-month');
  if (monthEl) monthEl.textContent = `${year} 年度明細`;

  const cardEl = document.getElementById('fixed-card-view');
  const tableEl = document.getElementById('fixed-table-view');
  if (!cardEl || !tableEl) return;

  const countEl = document.getElementById('fixed-total-count');
  if (countEl) countEl.textContent = `（共 ${_templates.length} 項）`;

  if (_templates.length === 0) {
    const emptyHtml = `
      <div class="glass-card">
        <div class="empty-state">
          <i data-lucide="file-text" style="width:48px;height:48px;opacity:0.4;"></i>
          <p style="margin-top:12px;">尚無固定支出</p>
          <button class="btn btn-primary" onclick="window.location.href='input-center.html'" style="margin-top:12px;">
            <i data-lucide="plus"></i> 前往輸入中心
          </button>
        </div>
      </div>
    `;
    cardEl.innerHTML = emptyHtml;
    tableEl.innerHTML = '';
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  const view = _viewToggle?.getView() || 'card';

  if (view === 'card') {
    cardEl.style.display = 'block';
    tableEl.style.display = 'none';
    cardEl.innerHTML = _templates.map((t) => _renderCard(t)).join('');
  } else {
    cardEl.style.display = 'none';
    tableEl.style.display = 'block';
    tableEl.innerHTML = _renderTable();
  }

  // 底部快速摘要
  _renderQuickSummary();

  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   卡片模式
   ============================================ */
function _renderCard(t) {
  const key = `card-${t.id}`;
  const isExpanded = _expandedKeys.has(key);
  const memberName = t.memberId === 'shared' ? '家庭共用' : '（成員）';
  const summary = _getTemplateSummary(t);

  return `
    <div class="glass-card fixed-card" style="margin-bottom:16px; padding:16px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap; margin-bottom:12px;">
        <div style="flex:1; min-width:0;">
          <div style="font-size:15px; font-weight:700; color:var(--neon-cyan); margin-bottom:2px;">
            ${escapeHtml(t.name || '（未命名）')}
          </div>
          <div style="font-size:11px; color:var(--text-muted);">
            ${escapeHtml(memberName)} · 週期：${escapeHtml(t.cycle || '每月')}
            ${t.note ? ` · ${escapeHtml(t.note)}` : ''}
          </div>
        </div>
        <div style="text-align:right; flex-shrink:0;">
          <div class="mono" style="font-size:14px; font-weight:700; color:var(--neon-cyan);">
            ${formatHKD(t.amount || 0)} / 期
          </div>
        </div>
      </div>

      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:10px;">
        <span class="badge badge-muted">已付款 ${summary.paid} / ${summary.total}</span>
        <span class="badge badge-pending">未付款 ${summary.pending}</span>
        ${summary.skipped > 0 ? `<span class="badge badge-muted">不適用 ${summary.skipped}</span>` : ''}
      </div>

      <button class="btn btn-sm btn-ghost fixed-expand-btn" data-toggle-key="${key}" style="width:100%; justify-content:space-between;">
        <span>${isExpanded ? '收起明細' : '展開明細'}</span>
        <i data-lucide="${isExpanded ? 'chevron-up' : 'chevron-down'}" style="width:14px;height:14px;"></i>
      </button>

      <div style="display:${isExpanded ? 'block' : 'none'}; margin-top:10px;">
        ${_renderTemplateDetail(t)}
      </div>
    </div>
  `;
}

/* ============================================
   每月明細
   ============================================ */
function _renderTemplateDetail(t) {
  const year = AppState.year;
  const rows = [];

  for (let m = 1; m <= 12; m++) {
    const monthStr = String(m).padStart(2, '0');
    const list = _monthlyData[monthStr] || [];
    const item = list.find((x) => x.name === t.name);
    if (!item) continue;

    const status = item.status || '未付款';
    const amount = item.amount || 0;
    const statusBadge = _renderStatusBadge(status, 'fixed');

    rows.push(`
      <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.04);">
        <div class="mono" style="font-size:12px; color:var(--text-secondary); min-width:50px;">${m}月</div>
        <div class="mono" style="font-size:13px; font-weight:600; color:var(--text-primary); text-align:right; flex:1;">
          ${formatHKD(amount)}
        </div>
        <div style="flex-shrink:0; margin-left:12px;">${statusBadge}</div>
      </div>
    `);
  }

  if (rows.length === 0) {
    return `<div class="empty-state" style="padding:12px;">本年度無資料</div>`;
  }

  return `<div>${rows.join('')}</div>`;
}

/* ============================================
   表格模式
   ============================================ */
function _renderTable() {
  return `
    <div class="glass-card collapsible-card collapsible-card-flat" style="padding:0;">
      <div style="overflow-x:auto;">
        <table class="data-table mobile-cards">
          <thead>
            <tr>
              <th>項目名稱</th>
              <th>週期</th>
              <th class="num">每月金額</th>
              <th>已付款</th>
              <th>未付款</th>
            </tr>
          </thead>
          <tbody>
            ${_templates.map((t) => {
              const summary = _getTemplateSummary(t);
              const memberName = t.memberId === 'shared' ? '家庭共用' : '（成員）';
              return `
                <tr>
                  <td data-primary="1">
                    ${escapeHtml(t.name || '')}
                    <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">
                      ${escapeHtml(memberName)} · ${escapeHtml(t.cycle || '每月')}
                    </div>
                  </td>
                  <td data-label="週期">${escapeHtml(t.cycle || '每月')}</td>
                  <td class="num" data-label="每月金額">${formatHKD(t.amount || 0)}</td>
                  <td data-label="已付款"><span class="badge badge-success">${summary.paid} / ${summary.total}</span></td>
                  <td data-label="未付款"><span class="badge badge-pending">${summary.pending}</span></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/* ============================================
   快速摘要（待處理固定支出）
   ============================================ */
function _renderQuickSummary() {
  const root = document.getElementById('quick-summary-root');
  if (!root) return;

  // 收集當前月份所有未付款項目
  const ym = AppState.getYearMonth();
  if (ym.month === 'all') {
    root.innerHTML = '';
    return;
  }
  const monthList = _monthlyData[ym.month] || [];
  const pending = monthList.filter((x) => {
    const status = x.status || '未付款';
    return status !== '已付款' && status !== '不適用';
  });

  if (pending.length === 0) {
    root.innerHTML = '';
    return;
  }

  renderQuickSummary({
    containerId: 'quick-summary-root',
    type: QUICK_SUMMARY_TYPES.PENDING_FIXED,
    title: `${ym.month} 月待處理固定支出`,
    icon: 'alert-circle',
    data: pending.map((p) => ({
      id: p.id,
      name: p.name,
      amount: p.amount,
      status: p.status,
      month: ym.month,
    })),
  });
}

/* ============================================
   狀態工具
   ============================================ */
function _renderStatusBadge(status, category) {
  const statuses = getStatusesByCategory(category || 'fixed');
  const s = statuses.find((x) => x.name === status);
  const isDone = s ? !!s.isDone : (status && status.startsWith('已'));
  const isSkipped = status === '不適用';
  let cls = 'badge-pending';
  if (isDone) cls = 'badge-success';
  if (isSkipped) cls = 'badge-muted';
  return `<span class="badge ${cls}">${escapeHtml(status || '未付款')}</span>`;
}

/* ============================================
   模板統計
   ============================================ */
function _getTemplateSummary(t) {
  let paid = 0;
  let pending = 0;
  let skipped = 0;
  let total = 0;

  for (let m = 1; m <= 12; m++) {
    const monthStr = String(m).padStart(2, '0');
    const list = _monthlyData[monthStr] || [];
    const item = list.find((x) => x.name === t.name);
    if (!item) continue;
    total++;
    const status = item.status || '未付款';
    if (status === '已付款') paid++;
    else if (status === '不適用') skipped++;
    else pending++;
  }

  return { paid, pending, skipped, total };
}

/* ============================================
   明細展開事件（委派）
   ============================================ */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.fixed-expand-btn');
  if (!btn) return;
  const key = btn.dataset.toggleKey;
  if (!key) return;

  if (_expandedKeys.has(key)) _expandedKeys.delete(key);
  else _expandedKeys.add(key);

  _render();
});

/* ============================================
   銷毀
   ============================================ */
function _destroy() {
  if (_unsubTemplates) {
    try { _unsubTemplates(); } catch (e) { /* noop */ }
    _unsubTemplates = null;
  }
  if (_unsubMonth) {
    try { _unsubMonth(); } catch (e) { /* noop */ }
    _unsubMonth = null;
  }
  if (_unsubYM) {
    try { _unsubYM(); } catch (e) { /* noop */ }
    _unsubYM = null;
  }
  if (_filterInstance) {
    try { _filterInstance.destroy(); } catch (e) { /* noop */ }
    _filterInstance = null;
  }
  if (_viewToggle) {
    try { _viewToggle.destroy(); } catch (e) { /* noop */ }
    _viewToggle = null;
  }
}