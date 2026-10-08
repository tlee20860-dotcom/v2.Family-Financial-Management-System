// ============================================
// index.js — 保險清單表入口（v101.8.8）
// 位置：js/pages/insurance/index.js
// ============================================
// v101.8.8 修正：
//   ✅ _reloadAndRender 傳 AppState.year 給 computeEnrichedPolicies
//       - 原本 computeEnrichedPolicies 用 new Date().getFullYear()
//       - 導致切換年度時，_currentAnnualPremium 未更新
//   ✅ _renderStats 依當前選中年份計算
// ============================================

import {
  listenInsurancePolicies,
  listenMembers,
  getInsurancePaymentsOnce,
} from '../../core/db.js';
import { AppState } from '../../core/state.js';
import {
  escapeHtml, formatHKD, sortMembers, setText,
} from '../../core/utils.js';
import { ENTITY_KEYS } from '../../config/constants.js';
import { initViewToggle } from '../../shared/view-toggle.js';
import { showToast } from '../../shared/toast.js';
import { openConfirm } from '../../shared/modal.js';
import { openEntityModal } from '../../shared/entity-modal.js';
import { deleteEntity } from '../../shared/entity-helpers.js';
import { renderStatsCards } from '../../shared/stats-cards.js';
import { createListenerGroup } from '../../shared/listener-group.js';
import { computeEnrichedPolicies } from '../../shared/insurance-calc.js';
import { registerPageCleanup } from '../../core/app.js';

import {
  renderPolicyGrid,
  renderPolicyTable,
  renderCompletedSection,
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
let _statsApi = null;
let _syncAllHandler = null;
let _addPolicyHandler = null;
let _addFirstPolicyHandler = null;

const listenerGroup = createListenerGroup();

/* ============================================
   主入口
   ============================================ */
export async function initInsurancePage() {
  const userCanInput = AppState.getCanInput();

  _viewToggle = initViewToggle({
    containerId: 'view-toggle-root',
    storageKey: 'insurance-view',
    defaultView: 'card',
    cardText: '卡片',
    tableText: '表格',
    autoApply: false,
    onChange: () => _render(),
  });

  if (userCanInput) {
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

    _addPolicyHandler = () => {
      openEntityModal({
        entity: ENTITY_KEYS.POLICY,
        mode: 'add',
        allRows: _policies,
      });
    };
    document.getElementById('add-policy-btn')?.addEventListener('click', _addPolicyHandler);

    _addFirstPolicyHandler = () => {
      openEntityModal({
        entity: ENTITY_KEYS.POLICY,
        mode: 'add',
        allRows: _policies,
      });
    };
    document.getElementById('add-first-policy-btn')?.addEventListener('click', _addFirstPolicyHandler);
  } else {
    document.getElementById('sync-all-btn')?.style.setProperty('display', 'none');
    document.getElementById('add-policy-btn')?.style.setProperty('display', 'none');
    document.getElementById('add-first-policy-btn')?.style.setProperty('display', 'none');
  }

  bindGlobalListeners({
    getPolicies: () => _policies,
    refresh: () => _reloadAndRender(),
  });

  listenerGroup.add(
    listenInsurancePolicies((list) => {
      _policies = list || [];
      _reloadAndRender();
    })
  );

  listenerGroup.add(
    listenMembers((list) => {
      _members = sortMembers(list);
      _reloadAndRender();
    })
  );

  listenerGroup.add(AppState.on('ym-change', () => _reloadAndRender()));

  if (userCanInput) {
    _bindListActions();
  }

  await _reloadAndRender();

  registerPageCleanup(_destroy);

  return { destroy: _destroy };
}

/* ============================================
   重新載入 + 渲染（🆕 v101.8.8：傳 targetYear）
   ============================================ */
async function _reloadAndRender() {
  // 🆕 v101.8.8：從 AppState 取得當前選中年份
  const { year } = AppState.getYearMonth();
  const targetYear = Number(year) || new Date().getFullYear();

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

  // 🆕 v101.8.8：傳 targetYear
  _enriched = computeEnrichedPolicies(_policies, _paymentsCache, targetYear);

  _render();
}

/* ============================================
   渲染
   ============================================ */
function _render() {
  const { year, month } = AppState.getYearMonth();
  setText('insurance-month', month === 'all' ? `${year} 年 全年總覽` : `${year} 年 ${month} 月`);

  _renderStats(year);

  const completed = _enriched.filter((p) => p._isCompleted);
  const active = _enriched.filter((p) => !p._isCompleted);

  renderCompletedSection(completed, _members);

  const view = _viewToggle?.getView() || 'card';
  const cardEl = document.getElementById('insurance-card-view');
  const tableEl = document.getElementById('insurance-table-view');
  const emptyEl = document.getElementById('insurance-empty-state');

  if (!cardEl || !tableEl) return;

  if (_enriched.length === 0) {
    if (emptyEl) {
      emptyEl.style.display = 'block';
      const addFirstBtn = document.getElementById('add-first-policy-btn');
      if (addFirstBtn && !AppState.getCanInput()) {
        addFirstBtn.style.display = 'none';
      }
    }
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
   統計卡（🆕 v101.8.8：依當前選中年份）
   ============================================ */
function _renderStats(year) {
  // 🆕 v101.8.8：_currentAnnualPremium 已依 targetYear 計算
  // 只累加「該年度有供款」的保單（getPolicyAnnualPremium 已處理）
  const yearTotal = _enriched.reduce(
    (s, p) => s + (p._currentAnnualPremium || 0),
    0
  );

  // 供款中 / 已供滿 依 enriched 狀態
  const activeCount = _enriched.filter((p) => !p._isCompleted).length;
  const completedCount = _enriched.filter((p) => p._isCompleted).length;
  const totalCount = _enriched.length;

  const cards = [
    {
      title: `${year} 年度保單總供款`,
      value: formatHKD(yearTotal),
      valueClass: 'cyan',
      hint: `共 ${totalCount} 張保單`,
      icon: 'wallet',
    },
    {
      title: '供款中保單',
      value: `${activeCount} 張`,
      valueClass: 'emerald',
      hint: '未供滿的保單數量',
      icon: 'shield',
    },
    {
      title: '已供滿保單',
      value: `${completedCount} 張`,
      valueClass: 'emerald',
      hint: '已完成供款年期',
      icon: 'check-circle',
    },
  ];

  if (_statsApi) { try { _statsApi.destroy(); } catch (e) {} }

  _statsApi = renderStatsCards({
    container: 'insurance-stats-root',
    cards,
    columns: 3,
  });
}

/* ============================================
   卡片 / 表格的編輯 / 刪除事件
   ============================================ */
function _bindListActions() {
  const cardEl = document.getElementById('insurance-card-view');
  const tableEl = document.getElementById('insurance-table-view');

  const handler = async (e) => {
    if (!AppState.getCanInput()) return;

    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;
    if (!id) return;

    const policy = _policies.find((p) => p.id === id);
    if (!policy) return;

    if (action === 'edit-policy') {
      openEntityModal({
        entity: ENTITY_KEYS.POLICY,
        mode: 'edit',
        id: policy.id,
        allRows: _policies,
      });
    } else if (action === 'delete-policy') {
      await _handleDeletePolicy(policy);
    }
  };

  cardEl?.addEventListener('click', handler);
  tableEl?.addEventListener('click', handler);
}

async function _handleDeletePolicy(policy) {
  const ok = await openConfirm(
    `⚠️ 確定要刪除保單「${policy.name}」嗎？\n\n這將會一併刪除所有相關的扣款紀錄與成員支出，此操作無法復原。`,
    { title: '刪除保單', okText: '刪除', okClass: 'btn-danger' }
  );
  if (!ok) return;

  try {
    const effectiveMemberId = policy.policyHolderId || policy.memberId;
    await deleteEntity(ENTITY_KEYS.POLICY, policy.id, effectiveMemberId);
    showToast('✅ 保單與相關紀錄已徹底刪除', 'success');
  } catch (err) {
    console.error('[insurance] 刪除失敗：', err);
    showToast('刪除失敗：' + err.message, 'error');
  }
}

/* ============================================
   銷毀
   ============================================ */
function _destroy() {
  try { unbindGlobalListeners(); } catch (e) { /* noop */ }
  listenerGroup.destroy();

  if (_viewToggle) { try { _viewToggle.destroy(); } catch (e) {} _viewToggle = null; }
  if (_statsApi) { try { _statsApi.destroy(); } catch (e) {} _statsApi = null; }

  if (_syncAllHandler) {
    document.getElementById('sync-all-btn')?.removeEventListener('click', _syncAllHandler);
    _syncAllHandler = null;
  }
  if (_addPolicyHandler) {
    document.getElementById('add-policy-btn')?.removeEventListener('click', _addPolicyHandler);
    _addPolicyHandler = null;
  }
  if (_addFirstPolicyHandler) {
    document.getElementById('add-first-policy-btn')?.removeEventListener('click', _addFirstPolicyHandler);
    _addFirstPolicyHandler = null;
  }
}