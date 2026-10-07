// ============================================
// personal-expenses.js — 個人支出明細（v101 只讀化）
// 位置：js/pages/personal-expenses.js
// ============================================
// v101 改動：
//   ✅ 移除新增 / 編輯 / 刪除（移至綜合輸入中心）
//   ✅ 保留卡片 / 表格雙模式
//   ✅ 統一由 AppState ym-change 載入
//   ✅ 加「前往輸入中心」按鈕
//   ✅ 狀態 badge 依 app-config
//   ✅ 手機版自動卡片化（.data-table.mobile-cards）
// ============================================

import {
  listenMembers, listenCategories, listenPaymentMethods,
  listenAllExpenses,
} from '../core/db.js';
import { AppState } from '../core/state.js';
import { getStatusesByCategory } from '../config/app-config.js';
import {
  escapeHtml, formatHKD, sortMembers, getMemberDisplayName,
} from '../core/utils.js';
import { renderPageFilter } from '../shared/page-filter.js';
import { initViewToggle } from '../shared/view-toggle.js';
import { renderQuickSummary } from '../shared/quick-summary.js';
import { QUICK_SUMMARY_TYPES } from '../config/constants.js';

/* ============================================
   Module 狀態
   ============================================ */
let _members = [];
let _categories = [];
let _payments = [];
let _allExpenses = [];
let _filters = { year: '', month: '', member: '', category: '' };
let _viewToggle = null;
let _filterInstance = null;
let _unsubscribers = [];

/* ============================================
   主入口
   ============================================ */
export async function initPersonalExpensesPage() {
  // 檢視切換
  _viewToggle = initViewToggle({
    containerId: 'view-toggle-root',
    storageKey: 'pe-view',
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

  // 篩選欄
  _filterInstance = renderPageFilter({
    containerId: 'page-filter-root',
    fields: ['year', 'month'],
    renderExtra: () => `
      <div class="filter-group">
        <label class="field-label">成員</label>
        <select class="select" data-filter="member">
          <option value="">全部</option>
          ${_members.map((m) => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('')}
        </select>
      </div>
      <div class="filter-group">
        <label class="field-label">類別</label>
        <select class="select" data-filter="category">
          <option value="">全部</option>
          ${_categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
        </select>
      </div>
    `,
    onChange: (f) => {
      _filters = {
        year: f.year || '',
        month: f.month === 'all' ? '' : (f.month || ''),
        member: f.member || '',
        category: f.category || '',
      };
      _render();
    },
  });

  // 資料監聽
  _unsubscribers.push(
    listenMembers((list) => {
      _members = sortMembers(list);
      _updateFilterOptions();
    })
  );

  _unsubscribers.push(
    listenCategories((list) => {
      _categories = list;
      _updateFilterOptions();
    })
  );

  _unsubscribers.push(
    listenPaymentMethods((list) => {
      _payments = list;
      _render();
    })
  );

  _unsubscribers.push(
    listenAllExpenses((list) => {
      _allExpenses = list;
      _render();
    })
  );

  return {
    destroy: _destroy,
  };
}

/* ============================================
   篩選欄更新
   ============================================ */
function _updateFilterOptions() {
  const root = document.getElementById('page-filter-root');
  if (!root) return;

  const memberSel = root.querySelector('select[data-filter="member"]');
  if (memberSel) {
    const cur = memberSel.value;
    memberSel.innerHTML = `<option value="">全部</option>` +
      _members.map((m) => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('');
    if (cur && _members.some((m) => m.id === cur)) memberSel.value = cur;
  }

  const catSel = root.querySelector('select[data-filter="category"]');
  if (catSel) {
    const cur = catSel.value;
    catSel.innerHTML = `<option value="">全部</option>` +
      _categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    if (cur && _categories.some((c) => c.id === cur)) catSel.value = cur;
  }
}

/* ============================================
   渲染
   ============================================ */
function _render() {
  const filtered = _filteredList();
  const view = _viewToggle?.getView() || 'card';

  const cardEl = document.getElementById('pe-card-view');
  const tableEl = document.getElementById('pe-table-view');
  if (!cardEl || !tableEl) return;

  const countEl = document.getElementById('pe-total-count');
  if (countEl) countEl.textContent = `（共 ${filtered.length} 筆）`;

  if (view === 'card') {
    cardEl.style.display = 'block';
    tableEl.style.display = 'none';
    _renderCards(filtered, cardEl);
  } else {
    cardEl.style.display = 'none';
    tableEl.style.display = 'block';
    _renderTable(filtered, tableEl);
  }

  _renderQuickSummary(filtered);

  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   過濾
   ============================================ */
function _filteredList() {
  return _allExpenses
    .filter((x) => {
      if (_filters.year && x.year !== _filters.year) return false;
      if (_filters.month && x.month !== _filters.month) return false;
      if (_filters.member && x.memberId !== _filters.member) return false;
      if (_filters.category && x.categoryId !== _filters.category) return false;
      return true;
    })
    .sort((a, b) => {
      if (a.year !== b.year) return b.year.localeCompare(a.year);
      if (a.month !== b.month) return b.month.localeCompare(a.month);
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
}

/* ============================================
   卡片模式
   ============================================ */
function _renderCards(list, container) {
  if (list.length === 0) {
    container.innerHTML = `<div class="glass-card"><div class="empty-state">沒有符合條件的支出紀錄</div></div>`;
    return;
  }

  container.innerHTML = `
    <div class="grid grid-3" style="gap:10px;">
      ${list.map((x) => _renderCard(x)).join('')}
    </div>
  `;
}

function _renderCard(x) {
  const member = _members.find((m) => m.id === x.memberId);
  const memberName = member ? member.name : (getMemberDisplayName(x.memberId, _members));
  const cat = _categories.find((c) => c.id === x.categoryId);
  const catName = cat ? cat.name : '—';
  const pm = _payments.find((p) => p.id === x.paymentMethodId);
  const pmName = pm ? pm.name : '—';
  const autoBadge = x.isAutoLinked
    ? '<span class="badge badge-info" style="margin-left:6px;">保險</span>'
    : '';

  return `
    <div class="glass-card" style="padding:14px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; margin-bottom:8px;">
        <div style="flex:1; min-width:0;">
          <div style="font-weight:600; color:var(--text-primary); margin-bottom:2px; word-break:break-word;">
            ${escapeHtml(x.name || '（未命名）')}${autoBadge}
          </div>
          <div style="font-size:11px; color:var(--text-muted);">
            ${escapeHtml(x.year)}-${escapeHtml(x.month)} · ${escapeHtml(memberName)}
          </div>
        </div>
        <div style="text-align:right; flex-shrink:0;">
          <div class="mono text-emerald" style="font-weight:700;">${formatHKD(x.amount)}</div>
        </div>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; font-size:11px; color:var(--text-muted); flex-wrap:wrap;">
        <span>${escapeHtml(catName)}${pmName !== '—' ? ` · ${escapeHtml(pmName)}` : ''}</span>
        <span>${_renderStatusBadge(x.status)}</span>
      </div>
      ${x.date ? `<div style="font-size:11px; color:var(--text-muted); margin-top:4px;">${escapeHtml(x.date)}</div>` : ''}
    </div>
  `;
}

/* ============================================
   表格模式
   ============================================ */
function _renderTable(list, container) {
  if (list.length === 0) {
    container.innerHTML = `<div class="glass-card"><div class="empty-state">沒有符合條件的支出紀錄</div></div>`;
    return;
  }

  container.innerHTML = `
    <div class="glass-card collapsible-card collapsible-card-flat" style="padding:0;">
      <div style="overflow-x:auto;">
        <table class="data-table pe-table mobile-cards">
          <thead>
            <tr>
              <th style="width:80px;">年月</th>
              <th style="width:70px;">成員</th>
              <th>項目名稱</th>
              <th class="hide-mobile" style="width:80px;">類別</th>
              <th class="hide-mobile" style="width:90px;">支付方式</th>
              <th class="hide-mobile" style="width:90px;">日期</th>
              <th class="num" style="width:90px;">金額</th>
              <th style="width:80px;">狀態</th>
            </tr>
          </thead>
          <tbody>
            ${list.map((x) => _renderRow(x)).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function _renderRow(x) {
  const member = _members.find((m) => m.id === x.memberId);
  const memberName = member ? member.name : (getMemberDisplayName(x.memberId, _members));
  const cat = _categories.find((c) => c.id === x.categoryId);
  const catName = cat ? cat.name : '—';
  const pm = _payments.find((p) => p.id === x.paymentMethodId);
  const pmName = pm ? pm.name : '—';
  const autoBadge = x.isAutoLinked
    ? '<span class="badge badge-info" style="margin-left:4px;">保險</span>'
    : '';

  return `
    <tr>
      <td class="pe-ym-cell" data-label="年月" style="font-family:var(--font-mono); font-size:12px;">${escapeHtml(x.year)}-${escapeHtml(x.month)}</td>
      <td data-label="成員">${escapeHtml(memberName)}</td>
      <td data-primary="1">${escapeHtml(x.name || '')}${autoBadge}</td>
      <td class="hide-mobile" data-label="類別" style="font-size:11px; color:var(--text-muted);">${escapeHtml(catName)}</td>
      <td class="hide-mobile" data-label="支付方式" style="font-size:11px; color:var(--text-muted);">${escapeHtml(pmName)}</td>
      <td class="hide-mobile" data-label="日期" style="font-size:11px; color:var(--text-muted);">${escapeHtml(x.date || '—')}</td>
      <td class="num" data-label="金額">${formatHKD(x.amount)}</td>
      <td data-label="狀態">${_renderStatusBadge(x.status)}</td>
    </tr>
  `;
}

/* ============================================
   狀態 badge
   ============================================ */
function _renderStatusBadge(status) {
  const statuses = getStatusesByCategory('personal');
  const s = statuses.find((x) => x.name === status);
  const isDone = s ? !!s.isDone : (status && status.startsWith('已'));
  const cls = isDone ? 'badge-success' : 'badge-pending';
  return `<span class="badge ${cls}">${escapeHtml(status || '未處理')}</span>`;
}

/* ============================================
   快速摘要
   ============================================ */
function _renderQuickSummary(list) {
  const root = document.getElementById('quick-summary-root');
  if (!root) return;

  if (list.length === 0) {
    root.innerHTML = '';
    return;
  }

  // Top 5 類別
  const catTotals = {};
  list.forEach((x) => {
    const cat = _categories.find((c) => c.id === x.categoryId);
    const name = cat ? cat.name : '（未分類）';
    if (!catTotals[name]) catTotals[name] = 0;
    catTotals[name] += Number(x.amount) || 0;
  });

  const topList = Object.entries(catTotals)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  renderQuickSummary({
    containerId: 'quick-summary-root',
    type: QUICK_SUMMARY_TYPES.TOP_CATEGORIES,
    title: 'Top 5 支出類別',
    icon: 'trending-up',
    data: topList,
  });
}

/* ============================================
   銷毀
   ============================================ */
function _destroy() {
  _unsubscribers.forEach((fn) => {
    try { fn(); } catch (e) { /* noop */ }
  });
  _unsubscribers = [];
  if (_viewToggle) {
    try { _viewToggle.destroy(); } catch (e) { /* noop */ }
    _viewToggle = null;
  }
  if (_filterInstance) {
    try { _filterInstance.destroy(); } catch (e) { /* noop */ }
    _filterInstance = null;
  }
}