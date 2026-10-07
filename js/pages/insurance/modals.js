// ============================================
// modals.js — 保險頁面事件綁定（v101.2）
// 位置：js/pages/insurance/modals.js
// ============================================
// v101.2 修正：
//   ✅ 移除未使用的 _getMembers / _getCompanies / _getEnriched
//   ✅ 只保留實際使用的 getter（getPolicies / refresh）
//   ✅ 對應 index.js 的 bindGlobalListeners 參數變更
// ============================================

import {
  updateInsurancePolicy,
} from '../../core/db.js';
import { showToast } from '../../shared/toast.js';
import { toggleExpand } from './render.js';
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

  /* ---------- 2. 動作按鈕 ---------- */
  const actionBtn = e.target.closest('button[data-action]');
  if (!actionBtn) return;

  const action = actionBtn.dataset.action;
  const id = actionBtn.dataset.id;

  switch (action) {
    case 'restore':
      await _handleRestore(id);
      break;
    case 'sync-one':
      await _handleSyncOne(id);
      break;
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

  if (!confirm(`確定要恢復保單「${policy.name}」的供款狀態嗎？`)) return;

  try {
    await updateInsurancePolicy(policyId, {
      ...policy,
      isCompleted: false,
    });

    // 重新同步支出
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
  }
}
