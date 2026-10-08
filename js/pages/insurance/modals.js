// ============================================
// modals.js — 保險頁面事件綁定（v101.6.10）
// 位置：js/pages/insurance/modals.js
// ============================================
// v101.6.10 修正：
//   ✅ [已供滿保單不能點開] _handleClick 加入 #completed-header 判斷
//       - 呼叫 render.js 的 toggleCompletedSection()
//   ✅ 保留 v101.6 的其他處理
// ============================================

import { updateInsurancePolicy } from '../../core/db.js';
import { showToast } from '../../shared/toast.js';
import { openConfirm } from '../../shared/modal.js';
import { toggleExpand, toggleCompletedSection } from './render.js';
import {
  autoSyncPolicyExpenses,
  autoSyncAfterEdit,
} from './sync.js';

/* ============================================
   Module 狀態
   ============================================ */
let _bound = false;
let _getPolicies = null;
let _refresh = null;

/* ============================================
   主入口
   ============================================ */
export function bindGlobalListeners(config) {
  _getPolicies = config.getPolicies;
  _refresh = config.refresh;

  if (_bound) return;
  _bound = true;

  document.addEventListener('click', _handleClick);
}

/* ============================================
   全域點擊處理
   ============================================ */
async function _handleClick(e) {
  /* ---------- 0. 🆕 v101.6.10：已供滿保單區塊展開 / 收合 ---------- */
  const completedHeader = e.target.closest('#completed-header');
  if (completedHeader) {
    e.preventDefault();
    e.stopPropagation();
    toggleCompletedSection();
    return;
  }

  /* ---------- 1. 展開 / 收合明細 ---------- */
  const toggleBtn = e.target.closest('[data-toggle-key]');
  if (toggleBtn) {
    e.preventDefault();
    e.stopPropagation();
    const key = toggleBtn.dataset.toggleKey;
    if (key) {
      toggleExpand(key);
      if (_refresh) _refresh();
    }
    return;
  }

  /* ---------- 2. 恢復供款 ---------- */
  const restoreBtn = e.target.closest('button[data-action="restore"]');
  if (restoreBtn) {
    e.preventDefault();
    e.stopPropagation();
    await _handleRestore(restoreBtn.dataset.id);
    return;
  }

  /* ---------- 3. 單一保單同步 ---------- */
  const syncBtn = e.target.closest('button[data-action="sync-one"]');
  if (syncBtn) {
    e.preventDefault();
    e.stopPropagation();
    await _handleSyncOne(syncBtn.dataset.id);
    return;
  }
}

/* ============================================
   1. 恢復供款
   ============================================ */
async function _handleRestore(policyId) {
  const policies = _getPolicies?.() || [];
  const policy = policies.find((p) => p.id === policyId);
  if (!policy) {
    showToast('找不到此保單', 'error');
    return;
  }

  const ok = await openConfirm(`確定要恢復保單「${policy.name}」的供款狀態嗎？`, {
    title: '恢復供款',
    okText: '恢復',
    okClass: 'btn-primary',
  });
  if (!ok) return;

  try {
    await updateInsurancePolicy(policyId, { isCompleted: false });

    const updatedPolicy = { ...policy, isCompleted: false };
    await autoSyncAfterEdit(updatedPolicy);

    showToast('✅ 已恢復供款', 'success');
    if (_refresh) _refresh();
  } catch (err) {
    console.error('[insurance] 恢復失敗：', err);
    showToast('恢復失敗：' + err.message, 'error');
  }
}

/* ============================================
   2. 單一保單同步
   ============================================ */
async function _handleSyncOne(policyId) {
  const policies = _getPolicies?.() || [];
  const policy = policies.find((p) => p.id === policyId);
  if (!policy) {
    showToast('找不到此保單', 'error');
    return;
  }

  try {
    const count = await autoSyncPolicyExpenses(policy);
    showToast(`✅ 已同步 ${count} 筆扣款紀錄`, 'success');
    if (_refresh) _refresh();
  } catch (err) {
    console.error('[insurance] 同步失敗：', err);
    showToast('同步失敗：' + err.message, 'error');
  }
}

/* ============================================
   3. 卸載
   ============================================ */
export function unbindGlobalListeners() {
  if (_bound) {
    document.removeEventListener('click', _handleClick);
    _bound = false;
    _getPolicies = null;
    _refresh = null;
  }
}