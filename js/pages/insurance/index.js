// ============================================
// index.js — 保險付款入口（v101.3）
// 位置：js/pages/insurance/index.js
// ============================================
// v101.3 修正：
//   ✅ 移除未使用的 listenInsuranceCompanies 監聽（死監聽）
//   ✅ 移除未使用的 _companies 變數
//   ✅ 簡化 renderCompletedSection 呼叫
// ============================================

import {
  listenInsurancePolicies,
  listenMembers,
  getInsurancePaymentsOnce,
} from '../../core/db.js';
import { AppState } from '../../core/state.js';
import { renderPageFilter } from '../../shared/page-filter.js';
import { initViewToggle } from '../../shared/view-toggle.js';
import { showToast } from '../../shared/toast.js';

import { computeEnrichedPolicies } from './calc.js';
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
let _paymentsCache = {};
let _enriched = [];
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

  // 綁定全域事件（展開 / 恢復供款 / 單一同步）
  bindGlobalListeners({
    getPolicies: () => _policies,
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

  renderStats({
    enriched: _enriched,
    year,
  });

  const completed = _enriched.filter((p) => p._isCompleted);
  const active = _enriched.filter((p) => !p._isCompleted);

  renderCompletedSection(completed, _members);

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
    renderPolicyGrid(cardEl, active, { members: _members });
  } else {
    cardEl.style.display = 'none';
    tableEl.style.display = 'block';
    renderPolicyTable(tableEl, active, { members: _members });
  }

  if (window.lucide) window.lucide.createIcons();
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
