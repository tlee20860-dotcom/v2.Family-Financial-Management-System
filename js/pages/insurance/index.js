// ============================================
// index.js — 保險付款入口（v101.5）
// 位置：js/pages/insurance/index.js
// ============================================
// v101.5 修正：
//   ✅ computeEnrichedPolicies 改 import shared/insurance-calc.js
//   ✅ 使用 registerPageCleanup 註冊清理
//   ✅ bindGlobalListeners 補 unbind
//   ✅ sync-all 改用 openConfirm
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
import { openConfirm } from '../../shared/modal.js';
import { registerPageCleanup } from '../../core/app.js';

// 🆕 v101.5：改 import shared/insurance-calc.js
import { computeEnrichedPolicies } from '../../shared/insurance-calc.js';

import {
  renderPolicyGrid,
  renderPolicyTable,
  renderCompletedSection,
  renderStats,
} from './render.js';
import { bindGlobalListeners, unbindGlobalListeners } from './modals.js';

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
let _syncAllHandler = null;

/* ============================================
   主入口
   ============================================ */
export async function initInsurancePage() {
  _viewToggle = initViewToggle({
    containerId: 'view-toggle-root',
    storageKey: 'insurance-view',
    defaultView: 'card',
    cardText: '卡片',
    tableText: '表格',
    autoApply: false,
    onChange: () => _render(),
  });

  // 🆕 v101.5：改 openConfirm
  _syncAllHandler = async () => {
    const ok = await openConfirm('確定要重新同步所有保單的已扣款支出嗎？', {
      title: '同步所有支出',
      okText: '同步',
      okClass: 'btn-magenta',
    });
    if (!ok) return;
    try {
      const { syncAllPolicyExpenses } = await import('./sync.js');
      await syncAllPolicyExpenses(_policies, _paymentsCache);
      showToast('✅ 已同步所有保單支出', 'success');
    } catch (err) {
      showToast('同步失敗：' + err.message, 'error');
    }
  };
  document.getElementById('sync-all-btn')?.addEventListener('click', _syncAllHandler);

  _filterInstance = renderPageFilter({
    containerId: 'page-filter-root',
    fields: ['year', 'month'],
  });

  bindGlobalListeners({
    getPolicies: () => _policies,
    refresh: () => _reloadAndRender(),
  });

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

  _unsubscribers.push(AppState.on('ym-change', () => _reloadAndRender()));

  registerPageCleanup(_destroy);

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

  renderStats({ enriched: _enriched, year });

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
  // 🆕 v101.5：解除 modals.js 的全域監聽
  try { unbindGlobalListeners(); } catch (e) { /* noop */ }

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
  if (_syncAllHandler) {
    document.getElementById('sync-all-btn')?.removeEventListener('click', _syncAllHandler);
    _syncAllHandler = null;
  }
}