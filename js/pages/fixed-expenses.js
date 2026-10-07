// ============================================
// fixed-expenses.js — 固定支出明細（v101.5）
// 位置：js/pages/fixed-expenses.js
// ============================================
// v101.5 修正：
//   ✅ 事件綁定從 module 層級移到 init 內（可完全清理）
//   ✅ 新增「+ 新增固定支出」按鈕（透過 entity-modal）
//   ✅ 狀態 badge 改用 entity-helpers 的 renderStatusBadge
//   ✅ 使用 registerPageCleanup 註冊清理
// ============================================

import {
  listenFixedTemplates, listenFixedExpenses,
} from '../core/db.js';
import { AppState } from '../core/state.js';
import { escapeHtml, formatHKD } from '../core/utils.js';
import { renderPageFilter } from '../shared/page-filter.js';
import { initViewToggle } from '../shared/view-toggle.js';
import { renderQuickSummary } from '../shared/quick-summary.js';
import { renderStatusBadge } from '../shared/entity-helpers.js';
import { openEntityModal } from '../shared/entity-modal.js';
import { QUICK_SUMMARY_TYPES, ENTITY_KEYS } from '../config/constants.js';
import { registerPageCleanup } from '../core/app.js';

/* ============================================
   Module 狀態
   ============================================ */
let _templates = [];
let _monthlyData = {};
let _unsubTemplates = null;
let _unsubMonths = [];
let _unsubYM = null;
let _filterInstance = null;
let _viewToggle = null;
let _expandedKeys = new Set();
let _expandClickHandler = null;
let _templateEditHandler = null;

/* ============================================
   主入口
   ============================================ */
export async function initFixedExpensesPage() {
  _viewToggle = initViewToggle({
    containerId: 'view-toggle-root',
    storageKey: 'fixed-view',
    defaultView: 'card',
    cardText: '卡片',
    tableText: '表格',
    autoApply: false,
    onChange: () => _render(),
  });

  document.getElementById('go-input-center-btn')?.addEventListener('click', () => {
    window.location.href = 'input-center.html';
  });

  // 🆕 v101.5：新增固定支出按鈕
  document.getElementById('add-fixed-template-btn')?.addEventListener('click', () => {
    openEntityModal({
      entity: ENTITY_KEYS.FIXED_TEMPLATE,
      mode: 'add',
      allRows: _templates,
    });
  });

  _filterInstance = renderPageFilter({
    containerId: 'page-filter-root',
    fields: ['year'],
  });

  _unsubTemplates = listenFixedTemplates((list) => {
    _templates = list;
    _watchAllMonths();
  });

  _unsubYM = AppState.on('ym-change', () => _watchAllMonths());

  _watchAllMonths();

  // 事件綁定（全部在 init 內）
  _expandClickHandler = (e) => {
    const btn = e.target.closest('.fixed-expand-btn');
    if (!btn) return;
    const key = btn.dataset.toggleKey;
    if (!key) return;

    if (_expandedKeys.has(key)) _expandedKeys.delete(key);
    else _expandedKeys.add(key);

    _render();
  };
  document.addEventListener('click', _expandClickHandler);

  _templateEditHandler = (e) => {
    const btn = e.target.closest('button[data-action="edit-template"]');
    if (!btn) return;
    const id = btn.dataset.id;
    const template = _templates.find((t) => t.id === id);
    if (!template) return;

    openEntityModal({
      entity: ENTITY_KEYS.FIXED_TEMPLATE,
      mode: 'edit',
      id: template.id,
      allRows: _templates,
    });
  };

  const cardEl = document.getElementById('fixed-card-view');
  const tableEl = document.getElementById('fixed-table-view');
  cardEl?.addEventListener('click', _templateEditHandler);
  tableEl?.addEventListener('click', _templateEditHandler);

  registerPageCleanup(_destroy);

  return {
    destroy: _destroy,
  };
}

/* ============================================
   監聽整年 12 個月
   ============================================ */
function _watchAllMonths() {
  _unsubMonths.forEach((fn) => {
    try { fn(); } catch (e) { /* noop */ }
  });
  _unsubMonths = [];
  _monthlyData = {};

  const year = AppState.year;
  if (!year) return;

  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    const unsub = listenFixedExpenses(year, mm, (list) => {
      _monthlyData[mm] = list;
      _render();
    }, () => {
      _monthlyData[mm] = [];
    });
    _unsubMonths.push(unsub);
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
          <p style="font-size:12px; color:var(--text-muted); margin-top:8px;">
            使用「+ 新增固定支出」按鈕，或至「基礎資料庫」新增
          </p>
          <div style="margin-top:16px; display:flex; gap:8px; justify-content:center; flex-wrap:wrap;">
            <button class="btn btn-primary" onclick="document.getElementById('add-fixed-template-btn')?.click()">
              <i data-lucide="plus"></i> 新增固定支出
            </button>
            <a class="btn btn-ghost" href="database.html">
              <i data-lucide="database"></i> 基礎資料庫
            </a>
          </div>
        </div>
      </div>
    `;
    cardEl.style.display = 'block';
    tableEl.style.display = 'none';
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
        <span class="badge badge-success">已付款 ${summary.paid} / ${summary.total}</span>
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

      <div style="margin-top:12px; display:flex; justify-content:flex-end; gap:6px;">
        <button class="btn btn-sm btn-ghost" data-action="edit-template" data-id="${t.id}">
          <i data-lucide="pencil" style="width:14px;height:14px;"></i> 編輯
        </button>
      </div>
    </div>
  `;
}

function _renderTemplateDetail(t) {
  const rows = [];

  for (let m = 1; m <= 12; m++) {
    const monthStr = String(m).padStart(2, '0');
    const list = _monthlyData[monthStr] || [];
    const item = list.find((x) => x.name === t.name);
    if (!item) continue;

    const status = item.status || '未付款';
    const amount = item.amount || 0;
    const statusBadge = renderStatusBadge(status, 'fixed');

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
              <th style="width:120px;">操作</th>
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
                  <td data-label="操作">
                    <button class="btn btn-sm btn-ghost" data-action="edit-template" data-id="${t.id}">
                      <i data-lucide="pencil" style="width:14px;height:14px;"></i> 編輯
                    </button>
                  </td>
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
   銷毀
   ============================================ */
function _destroy() {
  if (_unsubTemplates) {
    try { _unsubTemplates(); } catch (e) { /* noop */ }
    _unsubTemplates = null;
  }
  _unsubMonths.forEach((fn) => {
    try { fn(); } catch (e) { /* noop */ }
  });
  _unsubMonths = [];
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
  if (_expandClickHandler) {
    document.removeEventListener('click', _expandClickHandler);
    _expandClickHandler = null;
  }
  if (_templateEditHandler) {
    const cardEl = document.getElementById('fixed-card-view');
    const tableEl = document.getElementById('fixed-table-view');
    cardEl?.removeEventListener('click', _templateEditHandler);
    tableEl?.removeEventListener('click', _templateEditHandler);
    _templateEditHandler = null;
  }
}