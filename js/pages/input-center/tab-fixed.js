// ============================================
// tab-fixed.js — 綜合輸入中心：固定支出 Tab（v101）
// 位置：js/pages/input-center/tab-fixed.js
// ============================================

import {
  listenFixedTemplates, listenFixedExpenses,
  updateFixedExpense,
} from '../../core/db.js';
import { AppState } from '../../core/state.js';
import { getStatusesByCategory } from '../../config/app-config.js';
import { escapeHtml, formatHKD } from '../../core/utils.js';
import { fillStatusSelect } from '../../shared/select-helpers.js';
import { fillYearSelect, fillMonthSelect } from '../../shared/date-helpers.js';
import { showToast } from '../../shared/toast.js';

/* ============================================
   Module 狀態
   ============================================ */
let _container = null;
let _templates = [];
let _monthlyData = {};        // { '01': [items], ... }
let _unsubscribers = [];

let _currentYear = '';
let _currentMonth = '';
let _currentView = 'card';    // 'card' | 'table'

/* ============================================
   主入口
   ============================================ */
export function initFixedTab(containerId) {
  _container = document.getElementById(containerId);
  if (!_container) {
    console.warn(`⚠️ initFixedTab: 找不到容器 #${containerId}`);
    return null;
  }

  const ym = AppState.getYearMonth();
  _currentYear = ym.year;
  _currentMonth = ym.month === 'all' ? '01' : ym.month;

  _container.innerHTML = _buildSkeleton();

  _buildFilters();
  _bindListeners();
  _bindListEvents();

  return {
    refresh: _loadAndRender,
    destroy: _destroy,
  };
}

/* ============================================
   骨架
   ============================================ */
function _buildSkeleton() {
  return `
    <div class="banner" style="margin-bottom:16px;">
      ℹ️ 固定支出每月自動產生，此處只需更新「金額」與「狀態」。
      若要新增或刪除固定支出項目，請至「基礎資料庫」頁面管理。
    </div>

    <div class="glass-card collapsible-card collapsible-card-flat" id="ic-fixed-list-card">
      <div class="collapsible-header" id="ic-fixed-list-header">
        <div class="collapsible-header-title">
          <i data-lucide="file-text" style="width:16px;height:16px;"></i>
          <span>固定支出明細 <span class="text-muted" id="ic-fixed-count" style="font-size:12px; margin-left:6px;"></span></span>
        </div>
        <div style="display:flex; align-items:center; gap:10px;" onclick="event.stopPropagation()">
          <div class="view-toggle-group">
            <button class="btn btn-sm btn-primary" id="ic-fixed-view-card">卡片</button>
            <button class="btn btn-sm btn-ghost" id="ic-fixed-view-table">表格</button>
          </div>
          <i data-lucide="chevron-down" class="collapsible-arrow"></i>
        </div>
      </div>
      <div class="collapsible-body" style="display:block;">
        <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end; margin-bottom:16px;">
          <div class="filter-group" style="min-width:110px;">
            <label class="field-label">年份</label>
            <select class="select" id="ic-fixed-year-filter"></select>
          </div>
          <div class="filter-group" style="min-width:110px;">
            <label class="field-label">月份</label>
            <select class="select" id="ic-fixed-month-filter"></select>
          </div>
        </div>
        <div id="ic-fixed-list"></div>
      </div>
    </div>
  `;
}

/* ============================================
   篩選
   ============================================ */
function _buildFilters() {
  fillYearSelect('ic-fixed-year-filter', { defaultValue: _currentYear });
  fillMonthSelect('ic-fixed-month-filter', { defaultValue: _currentMonth, includeAll: false });

  document.getElementById('ic-fixed-year-filter')?.addEventListener('change', (e) => {
    _currentYear = e.target.value;
    _loadAndRender();
  });
  document.getElementById('ic-fixed-month-filter')?.addEventListener('change', (e) => {
    _currentMonth = e.target.value;
    _loadAndRender();
  });

  // 檢視切換
  document.getElementById('ic-fixed-view-card')?.addEventListener('click', () => _setView('card'));
  document.getElementById('ic-fixed-view-table')?.addEventListener('click', () => _setView('table'));
}

function _setView(view) {
  _currentView = view;
  const cardBtn = document.getElementById('ic-fixed-view-card');
  const tableBtn = document.getElementById('ic-fixed-view-table');
  if (!cardBtn || !tableBtn) return;
  if (view === 'card') {
    cardBtn.classList.add('btn-primary'); cardBtn.classList.remove('btn-ghost');
    tableBtn.classList.add('btn-ghost'); tableBtn.classList.remove('btn-primary');
  } else {
    cardBtn.classList.add('btn-ghost'); cardBtn.classList.remove('btn-primary');
    tableBtn.classList.add('btn-primary'); tableBtn.classList.remove('btn-ghost');
  }
  _render();
}

/* ============================================
   資料監聽
   ============================================ */
function _bindListeners() {
  // 模板
  _unsubscribers.push(
    listenFixedTemplates((list) => {
      _templates = list;
      _loadAndRender();
    })
  );

  // 監聽當前月份的支出（每次年/月變更會重新監聽）
  _watchMonth();
}

let _unsubMonth = null;
function _watchMonth() {
  if (_unsubMonth) {
    try { _unsubMonth(); } catch (e) { /* noop */ }
    _unsubMonth = null;
  }
  _unsubMonth = listenFixedExpenses(_currentYear, _currentMonth, (list) => {
    _monthlyData = {};
    _monthlyData[_currentMonth] = list;
    _render();
  });
}

async function _loadAndRender() {
  _watchMonth();
  // 監聽為即時，無需另外載入
  _render();
}

/* ============================================
   渲染
   ============================================ */
function _render() {
  const listEl = document.getElementById('ic-fixed-list');
  const countEl = document.getElementById('ic-fixed-count');
  if (!listEl) return;

  const monthList = _monthlyData[_currentMonth] || [];

  if (countEl) countEl.textContent = `（${_currentYear} 年 ${_currentMonth} 月，共 ${monthList.length} 筆）`;

  if (monthList.length === 0) {
    listEl.innerHTML = `<div class="empty-state">此月份尚無固定支出紀錄</div>`;
    return;
  }

  // 排序：依 createdAt
  const sorted = [...monthList].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

  if (_currentView === 'card') {
    listEl.innerHTML = `<div class="grid grid-3" style="gap:10px;">${sorted.map((x) => _renderCard(x)).join('')}</div>`;
  } else {
    listEl.innerHTML = _renderTable(sorted);
  }

  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   卡片渲染
   ============================================ */
function _renderCard(x) {
  const statuses = getStatusesByCategory('fixed');
  const statusOptions = _buildStatusOptions(statuses, x.status);
  const statusBadge = _statusBadge(x.status);

  return `
    <div class="data-card" data-id="${x.id}" style="padding:14px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:10px;">
        <div style="font-weight:600; color:var(--text-primary); font-size:14px;">
          ${escapeHtml(x.name || '（未命名）')}
        </div>
        <div>${statusBadge}</div>
      </div>
      <div class="field" style="margin-bottom:10px;">
        <label class="field-label" style="font-size:11px;">金額（HK$）</label>
        <input type="number" class="input mono" data-action="update-amount"
               value="${x.amount || 0}" min="0" step="1"
               style="padding:6px 10px; font-size:14px;">
      </div>
      <div class="field" style="margin-bottom:0;">
        <label class="field-label" style="font-size:11px;">狀態</label>
        <select class="select" data-action="update-status" style="padding:6px 10px; font-size:13px;">
          ${statusOptions}
        </select>
      </div>
    </div>
  `;
}

/* ============================================
   表格渲染
   ============================================ */
function _renderTable(list) {
  const statuses = getStatusesByCategory('fixed');
  return `
    <div style="overflow-x:auto;">
      <table class="data-table">
        <thead>
          <tr>
            <th>項目名稱</th>
            <th class="num" style="width:130px;">金額（HK$）</th>
            <th style="width:130px;">狀態</th>
          </tr>
        </thead>
        <tbody>
          ${list.map((x) => {
            const statusOptions = _buildStatusOptions(statuses, x.status);
            return `
              <tr data-id="${x.id}">
                <td>${escapeHtml(x.name || '（未命名）')}</td>
                <td>
                  <input type="number" class="input mono" data-action="update-amount"
                         value="${x.amount || 0}" min="0" step="1"
                         style="padding:4px 8px; font-size:13px; text-align:right;">
                </td>
                <td>
                  <select class="select" data-action="update-status" style="padding:4px 8px; font-size:13px;">
                    ${statusOptions}
                  </select>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/* ============================================
   狀態工具
   ============================================ */
function _buildStatusOptions(statuses, current) {
  if (statuses.length === 0) {
    return `
      <option value="未付款" ${current === '未付款' ? 'selected' : ''}>未付款</option>
      <option value="已付款" ${current === '已付款' ? 'selected' : ''}>已付款</option>
      <option value="不適用" ${current === '不適用' ? 'selected' : ''}>不適用</option>
    `;
  }
  return statuses.map((s) =>
    `<option value="${escapeHtml(s.name)}" ${s.name === current ? 'selected' : ''}>${escapeHtml(s.name)}</option>`
  ).join('');
}

function _statusBadge(status) {
  const statuses = getStatusesByCategory('fixed');
  const s = statuses.find((x) => x.name === status);
  const isDone = s ? s.isDone : (status && status.startsWith('已'));
  const cls = isDone ? 'badge-success' : 'badge-pending';
  return `<span class="badge ${cls}">${escapeHtml(status || '未付款')}</span>`;
}

/* ============================================
   清單事件（改金額 / 改狀態）
   ============================================ */
function _bindListEvents() {
  const listEl = document.getElementById('ic-fixed-list');
  if (!listEl) return;

  // 改金額（blur 時寫入）
  listEl.addEventListener('blur', async (e) => {
    const input = e.target.closest('input[data-action="update-amount"]');
    if (!input) return;
    const row = input.closest('[data-id]');
    if (!row) return;
    const id = row.dataset.id;
    const amount = Math.round(Number(input.value) || 0);

    try {
      await updateFixedExpense(_currentYear, _currentMonth, id, { amount });
      showToast('✅ 已更新金額', 'success');
    } catch (err) {
      showToast('更新失敗：' + err.message, 'error');
    }
  }, true);  // 使用 capture 因為 blur 不冒泡

  // 改狀態
  listEl.addEventListener('change', async (e) => {
    const sel = e.target.closest('select[data-action="update-status"]');
    if (!sel) return;
    const row = sel.closest('[data-id]');
    if (!row) return;
    const id = row.dataset.id;
    const status = sel.value;

    try {
      await updateFixedExpense(_currentYear, _currentMonth, id, {
        status,
        paidDate: status.startsWith('已') ? new Date().toISOString().slice(0, 10) : '',
      });
      showToast('✅ 已更新狀態', 'success');
    } catch (err) {
      showToast('更新失敗：' + err.message, 'error');
    }
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
  if (_unsubMonth) {
    try { _unsubMonth(); } catch (e) { /* noop */ }
    _unsubMonth = null;
  }
}