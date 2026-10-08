// ============================================
// render.js — 結算清單渲染輔助（v101.6.7）
// 位置：js/pages/settlements/render.js
// ============================================
// v101.6.7 新增：
//   ✅ openSettlementEditModal(row, onSuccess) - 編輯 Modal
//   ✅ handleSettlementDelete(row, onSuccess) - 刪除 / 取消扣款
//   ✅ 個人支出：完整編輯（名稱/金額/日期/狀態）
//   ✅ 保險扣款：僅改狀態，刪除 = 取消扣款
// ============================================

import {
  updateEntityStatus,
  saveInsurancePaymentBatch,
  removeInsurancePaymentBatch,
  updateExpense,
  removeExpense,
} from '../../core/db.js';
import { api } from '../../core/api.js';
import { getStatusesByCategory } from '../../config/app-config.js';
import { escapeHtml } from '../../core/utils.js';
import { isDoneStatus } from '../../shared/entity-helpers.js';
import { buildForm } from '../../shared/form-builder.js';
import { openModal, closeModal, openConfirm } from '../../shared/modal.js';
import { showToast } from '../../shared/toast.js';

/* ============================================
   成員快取（由 index.js 注入）
   ============================================ */
let _membersCache = [];

export function setMembersCache(members) {
  _membersCache = members || [];
}

export function getMembersCache() {
  return _membersCache;
}

/* ============================================
   狀態欄位渲染
   ============================================ */
export function renderStatusCell(row) {
  const statuses = getStatusesByCategory(row.source);
  if (statuses.length === 0) {
    return _renderStatusBadge(row.status, row.isDone);
  }

  const options = statuses.map((s) =>
    `<option value="${escapeHtml(s.name)}" ${s.name === row.status ? 'selected' : ''}>${escapeHtml(s.name)}</option>`
  ).join('');

  return `
    <select class="select settlement-status-select" data-key="${escapeHtml(row.key)}"
            style="padding:5px 8px; font-size:12px; background:rgba(8,11,17,0.6);">
      ${options}
    </select>
  `;
}

function _renderStatusBadge(status, isDone) {
  const cls = isDone ? 'badge-success' : 'badge-pending';
  return `<span class="badge ${cls}">${escapeHtml(status || '未處理')}</span>`;
}

/* ============================================
   來源 badge 渲染
   ============================================ */
export function renderSourceBadge(row) {
  const map = {
    personal:  { cls: 'badge-info',    label: row.memberId === 'shared' ? '🏠 家庭' : '🏷 個人' },
    insurance: { cls: 'badge-success', label: '🛡 保險' },
  };
  const cfg = map[row.source] || map.personal;
  return `<span class="badge ${cfg.cls}">${cfg.label}</span>`;
}

/* ============================================
   成員名稱
   ============================================ */
export function getMemberName(row) {
  if (row.source === 'personal' || row.source === 'insurance') {
    const m = _membersCache.find((x) => x.id === row.memberId);
    if (m) return m.name;
    if (row.memberId === 'shared') return '家庭共用';
  }
  return row._memberName || '（未知）';
}

/* ============================================
   狀態寫回（核心邏輯）
   ============================================ */
export async function updateRowStatus(row, newStatus) {
  if (!row) throw new Error('找不到紀錄');

  const isDone = isDoneStatus(newStatus, row.source);

  switch (row.source) {
    case 'personal':
      return updateEntityStatus('personal', row, newStatus, isDone);
    case 'insurance':
      return _updateInsuranceStatus(row, newStatus, isDone);
    default:
      throw new Error('未知的來源：' + row.source);
  }
}

async function _updateInsuranceStatus(row, newStatus, isDone) {
  const { policyId, memberId } = row._ref;
  const year = row.year;
  const month = row.month;

  if (isDone) {
    await saveInsurancePaymentBatch(policyId, year, month, {
      status: newStatus,
      amount: row.amount,
    });
    await api.insuranceSync({
      policyId,
      memberId,
      policyName: row.name,
      monthlyAverage: row.amount,
      year,
      month,
    });
  } else {
    await removeInsurancePaymentBatch(policyId, year, month);
    await api.insuranceUnsync({
      policyId,
      memberId,
      year,
      month,
    });
  }
}

/* ============================================
   🆕 v101.6.7：編輯 Modal
   -------------------------------------------------
   個人支出：可編輯 名稱 / 金額 / 日期 / 狀態
   保險扣款：僅可編輯「狀態」（其他欄位 disabled）
   ============================================ */
export function openSettlementEditModal(row, onSuccess) {
  if (!row) return;

  const MODAL_ID = 'settlement-edit-modal';
  const FORM_ROOT_ID = `${MODAL_ID}-form-root`;
  document.getElementById(MODAL_ID)?.remove();

  const isInsurance = row.source === 'insurance';

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay active';
  overlay.id = MODAL_ID;
  overlay.innerHTML = `
    <div class="modal" style="max-width:480px; max-height:90vh; overflow-y:auto;">
      <h2 class="modal-title">編輯${isInsurance ? '保險扣款' : '支出'}</h2>
      <div id="${FORM_ROOT_ID}"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  const statuses = getStatusesByCategory(isInsurance ? 'insurance' : 'personal');

  const fields = [
    {
      type: 'custom',
      id: 'info',
      html: `
        <div class="glass-card-hint" style="margin-bottom:12px;">
          來源：<b>${escapeHtml(row.sourceLabel || '')}</b>　
          成員：<b>${escapeHtml(getMemberName(row))}</b>　
          年月：<b>${escapeHtml(row.year)}-${escapeHtml(row.month)}</b>
          ${isInsurance ? '<br><span style="color:var(--neon-orange);">⚠️ 保險扣款金額由保單自動計算，僅能修改狀態</span>' : ''}
        </div>
      `,
    },
    {
      type: 'text',
      id: 'name',
      label: '項目名稱',
      required: true,
      maxlength: 60,
      disabled: isInsurance,
    },
    {
      type: 'number',
      id: 'amount',
      label: '金額（HK$）',
      required: true,
      min: 0,
      step: 1,
      disabled: isInsurance,
    },
    {
      type: 'text',
      id: 'date',
      label: '日期',
      placeholder: 'YYYY-MM-DD',
      maxlength: 10,
      disabled: isInsurance,
    },
    {
      type: 'select',
      id: 'status',
      label: '狀態',
      includeEmpty: false,
      options: statuses.map((s) => ({ value: s.name, label: s.name })),
    },
  ];

  buildForm({
    containerId: FORM_ROOT_ID,
    fields,
    submitText: '儲存',
    showCancel: true,
    cancelText: '取消',
    initialData: {
      name: row.name || '',
      amount: row.amount || 0,
      date: row.date || '',
      status: row.status || '',
    },
    onSubmit: async (data) => {
      try {
        if (row.source === 'personal') {
          // 個人支出：完整編輯
          const { memberId, expenseId } = row._ref;
          await updateExpense(row.year, row.month, memberId, expenseId, {
            name: data.name,
            amount: Number(data.amount) || 0,
            date: data.date || '',
            status: data.status,
          });
        } else if (row.source === 'insurance') {
          // 保險：僅改狀態
          if (data.status !== row.status) {
            await updateRowStatus(row, data.status);
          }
        }
        closeModal(MODAL_ID);
        showToast('✅ 已儲存', 'success');
        if (typeof onSuccess === 'function') onSuccess();
      } catch (err) {
        console.error('[settlements] 儲存失敗：', err);
        showToast('儲存失敗：' + err.message, 'error');
      }
    },
    onCancel: () => closeModal(MODAL_ID),
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(MODAL_ID);
  });

  openModal(MODAL_ID);
  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   🆕 v101.6.7：刪除 / 取消扣款
   -------------------------------------------------
   個人支出：實際刪除
   保險扣款：取消扣款（移除 payment 記錄 + 清除 linked 支出）
   ============================================ */
export async function handleSettlementDelete(row, onSuccess) {
  if (!row) return;

  if (row.source === 'insurance') {
    // 保險扣款：取消扣款
    const ok = await openConfirm(
      `確定要取消「${row.name}」在 ${row.year}-${row.month} 的扣款紀錄嗎？\n\n保單本身不會被刪除，僅取消此月份的扣款狀態（會同步移除對應的成員支出）。`,
      { title: '取消扣款', okText: '確定', okClass: 'btn-danger' }
    );
    if (!ok) return;

    try {
      const { policyId, memberId } = row._ref;
      await removeInsurancePaymentBatch(policyId, row.year, row.month);
      await api.insuranceUnsync({
        policyId,
        memberId,
        year: row.year,
        month: row.month,
      });
      showToast('✅ 已取消扣款', 'success');
      if (typeof onSuccess === 'function') onSuccess();
    } catch (err) {
      console.error('[settlements] 取消扣款失敗：', err);
      showToast('操作失敗：' + err.message, 'error');
    }
  } else {
    // 個人支出：實際刪除
    const ok = await openConfirm(
      `確定要刪除「${row.name}」（${row.year}-${row.month}）嗎？`,
      { title: '刪除支出', okText: '刪除', okClass: 'btn-danger' }
    );
    if (!ok) return;

    try {
      const { memberId, expenseId } = row._ref;
      await removeExpense(row.year, row.month, memberId, expenseId);
      showToast('✅ 已刪除', 'success');
      if (typeof onSuccess === 'function') onSuccess();
    } catch (err) {
      console.error('[settlements] 刪除失敗：', err);
      showToast('刪除失敗：' + err.message, 'error');
    }
  }
}