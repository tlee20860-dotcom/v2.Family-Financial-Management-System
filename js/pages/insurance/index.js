// ============================================
// index.js — 保險付款入口（v101，拆檔重構）
// 位置：js/pages/insurance/index.js
// ============================================
// 職責：組裝 5 個子模組 + 頁面初始化 + 檢視切換
//
// 子模組：
//   calc.js    → 純計算（年繳 / 月分攤 / 期間範圍）
//   render.js  → 渲染（卡片 / 表格 / 明細）
//   sync.js    → 支出同步（與後端 API 互動）
//   modals.js  → 編輯 Modal 綁定
// ============================================

import {
  listenInsurancePolicies, listenMembers, listenInsuranceCompanies,
} from '../../core/db.js';
import { AppState } from '../../core/state.js';
import { renderPageFilter } from '../../shared/page-filter.js';
import { initViewToggle } from '../../shared/view-toggle.js';
import { showToast } from '../../shared/toast.js';
import { getInsurancePaymentsOnce } from '../../core/db.js';

import {
  computeEnrichedPolicies,
  countCompletedPolicies,
} from './calc.js';
import {
  renderPolicyGrid,
  renderPolicyTable,
  renderCompletedSection,
  renderStats,
} from './render.js';
import { bindGlobalListeners } from './modals.js';

/* ============================================
   Module 狀態
   ============================================ */
let _policies = [];
let _members = [];
let _companies = [];
let _paymentsCache = {};        // { policyId: paymentsObj }
let _enriched = [];              // 含計算結果的保單
let _viewToggle = null;
let _filterInstance = null;
let _unsubscribers = [];

/* ============================================
   主入口
   ============================================ */
export async function initInsurancePage() {
  // 檢視切換
  _viewToggle = initViewToggle({
    containerId: 'view-toggle-root',
    storageKey: 'insurance-view',
    defaultView: 'card',
    cardText: '卡片',
    tableText: '表格',
    autoApply: false,
    onChange: () => _render(),
  });

  // 前往輸入中心（更新每月扣款）
  document.getElementById('go-input-center-btn')?.addEventListener('click', () => {
    window.location.href = 'input-center.html';
  });

  // 前往基礎資料庫（管理保單定義）
  document.getElementById('manage-policies-btn')?.addEventListener('click', () => {
    window.location.href = 'database.html';
  });

  // 同步所有支出按鈕
  document.getElementById('sync-all-btn')?.addEventListener('click', async () => {
    if (!confirm('確定要重新同步所有保單的已扣款支出嗎？')) return;
    try {
      const { syncAllPolicyExpenses } = await import('./sync.js');
      await syncAllPolicyExpenses(_policies, _paymentsCache);
      showToast('✅ 已同步所有保單支出', 'success');
    } catch (err) {
      showToast('同步失敗：' + err.message, 'error');
    }
  });

  // 頁面篩選
  _filterInstance = renderPageFilter({
    containerId: 'page-filter-root',
    fields: ['year', 'month'],
  });

  // 綁定 Modal 與全域事件
  bindGlobalListeners({
    getPolicies: () => _policies,
    getMembers: () => _members,
    getCompanies: () => _companies,
    getEnriched: () => _enriched,
    refresh: () => _reloadAndRender(),
  });

  // 監聽資料
  _unsubscribers.push(
    listenInsurancePolicies((list) => {
      _policies = list;
      _reloadAndRender();
    })
  );

  _unsubscribers.push(
    listenMembers((list) => {
      _members = list;
      _reloadAndRender();
    })
  );

  _unsubscribers.push(
    listenInsuranceCompanies((list) => {
      _companies = list;
      _reloadAndRender();
    })
  );

  // AppState 變更 → 重繪
  _unsubscribers.push(AppState.on('ym-change', () => _reloadAndRender()));

  return {
    destroy: _destroy,
  };
}

/* ============================================
   重新載入 + 渲染
   ============================================ */
async function _reloadAndRender() {
  if (_policies.length === 0) {
    _enriched = [];
    _paymentsCache = {};
    _render();
    return;
  }

  // 載入所有保單的付款紀錄
  const paymentsArr = await Promise.all(
    _policies.map(async (p) => {
      try {
        return [p.id, await getInsurancePaymentsOnce(p.id)];
      } catch (e) {
        return [p.id, {}];
      }
    })
  );

  _paymentsCache = {};
  paymentsArr.forEach(([id, data]) => {
    _paymentsCache[id] = data || {};
  });

  // 計算 enriched
  _enriched = computeEnrichedPolicies(_policies, _paymentsCache);

  _render();
}

/* ============================================
   渲染
   ============================================ */
function _render() {
  const { year, month } = AppState.getYearMonth();
  const monthEl = document.getElementById('insurance-month');
  if (monthEl) {
    monthEl.textContent = month === 'all' ? `${year} 年 全年總覽` : `${year} 年 ${month} 月`;
  }

  // 統計卡
  renderStats({
    enriched: _enriched,
    year,
  });

  // 已供滿保單
  const completed = _enriched.filter((p) => p._isCompleted);
  const active = _enriched.filter((p) => !p._isCompleted);

  renderCompletedSection(completed, _members, _companies);

  // 主要清單
  const view = _viewToggle?.getView() || 'card';
  const cardEl = document.getElementById('insurance-card-view');
  const tableEl = document.getElementById('insurance-table-view');
  const emptyEl = document.getElementById('insurance-empty-state');

  if (!cardEl || !tableEl) return;

  if (_enriched.length === 0) {
    if (emptyEl) emptyEl.style.display = 'block';
    cardEl.style.display = 'none';
    tableEl.style.display = 'none';
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';

  if (active.length === 0) {
    cardEl.style.display = 'none';
    tableEl.style.display = 'none';
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  if (view === 'card') {
    cardEl.style.display = 'block';
    tableEl.style.display = 'none';
    renderPolicyGrid(cardEl, active, {
      members: _members,
      paymentsCache: _paymentsCache,
    });
  } else {
    cardEl.style.display = 'none';
    tableEl.style.display = 'block';
    renderPolicyTable(tableEl, active, {
      members: _members,
      paymentsCache: _paymentsCache,
    });
  }

  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   對外：取得當前資料（供 modals.js 使用）
   ============================================ */
export function getCurrentPolicies() { return _policies; }
export function getCurrentMembers() { return _members; }
export function getCurrentCompanies() { return _companies; }
export function getCurrentPaymentsCache() { return _paymentsCache; }
export function refreshAll() { return _reloadAndRender(); }

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