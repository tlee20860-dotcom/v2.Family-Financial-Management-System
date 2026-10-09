// ============================================
// render.js — 結算清單渲染輔助（v101.10.0）
// 位置：js/pages/settlements/render.js
// ============================================
// v101.10.0 修正：
//   ✅ [P3-10] row._ref 無 fallback → 加入防護
//       - _openPersonalEditForm 的 memberId 讀取加 optional chaining
//       - updateRowStatus 的 row._ref 讀取加防護
//       - handleSettlementDelete 的 row._ref 讀取加防護
//   ✅ 保留 v101.8.6 全部功能（linkedId 支援）
// ============================================

import {
  updateEntityStatus,
  saveInsurancePaymentBatch,
  removeInsurancePaymentBatch,
  updateExpense,
  removeExpense,
  batchUpdateExpenses,
  getMembersOnce,
  getCategoriesOnce,
  getItemsOnce,
  getPaymentMethodsOnce,
} from '../../core/db.js';
import { api } from '../../core/api.js';
import { getStatusesByCategory } from '../../config/app-config.js';
import { escapeHtml } from '../../core/utils.js';
import { isDoneStatus } from '../../shared/entity-helpers.js';
import { buildForm } from '../../shared/form-builder.js';
import { openModal, closeModal, openConfirm } from '../../shared/modal.js';
import { showToast } from '../../shared/toast.js';
import { AppState } from '../../core/state.js';

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

  // v101.10.0：加防護
  const ref = row._ref || {};
  const isDone = isDoneStatus(newStatus, row.source);

  switch (row.source) {
    case 'personal':
      return updateEntityStatus('personal', row, newStatus, isDone);
    case 'insurance':
      return _updateInsuranceStatus(row, newStatus, isDone, ref);
    default:
      throw new Error('未知的來源：' + row.source);
  }
}

/**
 * 更新保險狀態（支援 linked_xxx）
 */
async function _updateInsuranceStatus(row, newStatus, isDone, ref) {
  const { policyId, memberId, linkedId } = ref;
  const year = row.year;
  const month = row.month;

  if (!policyId) throw new Error('缺少 policyId');
  if (!memberId) throw new Error('缺少 memberId');

  if (isDone) {
    // 寫入 insurance_payments
    await saveInsurancePaymentBatch(policyId, year, month, {
      status: newStatus,
      amount: row.amount,
    });

    // 若 linked 存在 → 同步更新；否則呼叫 insuranceSync 產生
    if (linkedId) {
      await updateExpense(year, month, memberId, linkedId, {
        status: newStatus,
      });
    } else {
      await api.insuranceSync({
        policyId,
        memberId,
        policyName: row.name,
        monthlyAverage: row.amount,
        year,
        month,
      });
    }
  } else {
    // 移除 insurance_payments
    await removeInsurancePaymentBatch(policyId, year, month);

    // 若 linked 存在 → 移除；否則呼叫 insuranceUnsync
    if (linkedId) {
      await removeExpense(year, month, memberId, linkedId);
    } else {
      await api.insuranceUnsync({
        policyId,
        memberId,
        year,
        month,
      });
    }
  }
}

/* ============================================
   編輯 Modal
   ============================================ */
export async function openSettlementEditModal(row, onSuccess) {
  if (!row) return;

  const MODAL_ID = 'settlement-edit-modal';
  const FORM_ROOT_ID = `${MODAL_ID}-form-root`;
  document.getElementById(MODAL_ID)?.remove();

  const isInsurance = row.source === 'insurance';

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay active';
  overlay.id = MODAL_ID;
  overlay.innerHTML = `
    <div class="modal" style="max-width:560px; max-height:90vh; overflow-y:auto;">
      <h2 class="modal-title">編輯${isInsurance ? '保險扣款' : '支出'}</h2>
      <div id="${FORM_ROOT_ID}"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  if (isInsurance) {
    _openInsuranceEditForm(row, FORM_ROOT_ID, MODAL_ID, onSuccess);
  } else {
    await _openPersonalEditForm(row, FORM_ROOT_ID, MODAL_ID, onSuccess);
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(MODAL_ID);
  });

  openModal(MODAL_ID);
  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   個人支出編輯表單
   ============================================ */
async function _openPersonalEditForm(row, containerId, modalId, onSuccess) {
  let members = [];
  let categories = [];
  let items = [];
  let payments = [];
  try {
    const results = await Promise.all([
      getMembersOnce(),
      getCategoriesOnce(),
      getItemsOnce(),
      getPaymentMethodsOnce(),
    ]);
    members = results[0] || [];
    categories = results[1] || [];
    items = results[2] || [];
    payments = results[3] || [];
  } catch (e) {
    console.warn('[settlements] 載入選項失敗：', e);
  }

  const statuses = getStatusesByCategory('personal');

  const curYear = new Date().getFullYear();
  const yearOptions = [];
  for (let i = -3; i <= 3; i++) {
    const y = curYear + i;
    yearOptions.push({ value: String(y), label: `${y} 年` });
  }
  if (!yearOptions.some((o) => o.value === String(row.year))) {
    yearOptions.push({ value: String(row.year), label: `${row.year} 年` });
    yearOptions.sort((a, b) => Number(a.value) - Number(b.value));
  }

  const monthOptions = [];
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    monthOptions.push({ value: mm, label: `${m} 月` });
  }

  const memberOptions = members.map((m) => ({ value: m.id, label: m.name }));
  if (!memberOptions.some((o) => o.value === 'shared')) {
    memberOptions.push({ value: 'shared', label: '家庭共用' });
  }

  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }));
  const itemOptions = row.categoryId
    ? items.filter((i) => i.categoryId === row.categoryId).map((i) => ({ value: i.id, label: i.name }))
    : [];
  const paymentOptions = payments.map((p) => ({ value: p.id, label: p.name }));

  // v101.10.0：加防護
  const ref = row._ref || {};
  const currentMemberId = ref.memberId || row.memberId || '';
  const currentExpenseId = ref.expenseId || '';

  const formApi = buildForm({
    containerId,
    fields: [
      { type: 'custom', id: 'info', html: `<div class="glass-card-hint" style="margin-bottom:12px;">來源：<b>${escapeHtml(row.sourceLabel || '')}</b></div>` },
      { type: 'select', id: 'year', label: '年份', required: true, includeEmpty: false, options: yearOptions },
      { type: 'select', id: 'month', label: '月份', required: true, includeEmpty: false, options: monthOptions },
      { type: 'select', id: 'memberId', label: '成員', required: true, includeEmpty: false, options: memberOptions },
      { type: 'text', id: 'name', label: '項目名稱', required: true, maxlength: 60 },
      { type: 'number', id: 'amount', label: '金額（HK$）', required: true, min: 0, step: 1 },
      { type: 'text', id: 'date', label: '日期', placeholder: 'YYYY-MM-DD', maxlength: 10 },
      { type: 'select', id: 'categoryId', label: '支出類別', includeEmpty: true, emptyText: '— 請選擇類別 —', options: categoryOptions },
      { type: 'select', id: 'itemId', label: '項目', includeEmpty: true, emptyText: row.categoryId ? '— 請選擇項目 —' : '— 請先選擇類別 —', options: itemOptions },
      { type: 'select', id: 'paymentMethodId', label: '支付方式', includeEmpty: true, emptyText: '— 請選擇 —', options: paymentOptions },
      { type: 'select', id: 'status', label: '狀態', includeEmpty: false, options: statuses.map((s) => ({ value: s.name, label: s.name })) },
    ],
    submitText: '儲存',
    showCancel: true,
    cancelText: '取消',
    initialData: {
      year: String(row.year),
      month: String(row.month),
      memberId: currentMemberId,
      name: row.name || '',
      amount: row.amount || 0,
      date: row.date || '',
      categoryId: row.categoryId || '',
      itemId: row.itemId || '',
      paymentMethodId: row.paymentMethodId || '',
      status: row.status || '未處理',
    },
    onSubmit: async (data) => {
      try {
        const oldMemberId = currentMemberId;
        const oldYear = row.year;
        const oldMonth = row.month;
        const oldExpenseId = currentExpenseId;

        if (!oldExpenseId) {
          throw new Error('缺少 expenseId，無法更新');
        }

        const newYear = String(data.year);
        const newMonth = String(data.month);
        const newMemberId = data.memberId;

        const pathChanged = newYear !== oldYear || newMonth !== oldMonth || newMemberId !== oldMemberId;

        if (pathChanged) {
          await batchUpdateExpenses([{
            oldYear, oldMonth, oldMemberId,
            expenseId: oldExpenseId,
            data: {
              year: newYear, month: newMonth, memberId: newMemberId,
              name: data.name,
              amount: Number(data.amount) || 0,
              date: data.date || '',
              categoryId: data.categoryId || '',
              itemId: data.itemId || '',
              paymentMethodId: data.paymentMethodId || '',
              status: data.status,
            },
          }]);
        } else {
          await updateExpense(oldYear, oldMonth, oldMemberId, oldExpenseId, {
            name: data.name,
            amount: Number(data.amount) || 0,
            date: data.date || '',
            categoryId: data.categoryId || '',
            itemId: data.itemId || '',
            paymentMethodId: data.paymentMethodId || '',
            status: data.status,
          });
        }

        closeModal(modalId);
        showToast('✅ 已儲存', 'success');
        if (typeof onSuccess === 'function') onSuccess();
      } catch (err) {
        console.error('[settlements] 儲存失敗：', err);
        showToast('儲存失敗：' + err.message, 'error');
      }
    },
    onCancel: () => closeModal(modalId),
  });

  if (formApi) {
    formApi.onFieldChange('categoryId', () => {
      const catId = formApi.getFieldValue('categoryId');
      const filtered = catId
        ? items.filter((i) => i.categoryId === catId).map((i) => ({ value: i.id, label: i.name }))
        : [];
      formApi.updateOptions('itemId', filtered, {
        includeEmpty: true,
        emptyText: catId ? '— 請選擇項目 —' : '— 請先選擇類別 —',
      });
    });
  }
}

/* ============================================
   保險扣款編輯表單（僅狀態）
   ============================================ */
function _openInsuranceEditForm(row, containerId, modalId, onSuccess) {
  const statuses = getStatusesByCategory('insurance');

  buildForm({
    containerId,
    fields: [
      {
        type: 'custom',
        id: 'info',
        html: `
          <div class="glass-card-hint" style="margin-bottom:12px;">
            來源：<b>${escapeHtml(row.sourceLabel || '')}</b>　
            成員：<b>${escapeHtml(getMemberName(row))}</b>　
            年月：<b>${escapeHtml(row.year)}-${escapeHtml(row.month)}</b>
            <br><span style="color:var(--neon-orange);">
              ⚠️ 保險扣款金額由保單自動計算，僅能修改狀態
            </span>
          </div>
        `,
      },
      {
        type: 'select',
        id: 'status',
        label: '狀態',
        includeEmpty: false,
        options: statuses.map((s) => ({ value: s.name, label: s.name })),
      },
    ],
    submitText: '儲存',
    showCancel: true,
    cancelText: '取消',
    initialData: { status: row.status || '' },
    onSubmit: async (data) => {
      try {
        if (data.status !== row.status) {
          await updateRowStatus(row, data.status);
        }
        closeModal(modalId);
        showToast('✅ 已儲存', 'success');
        if (typeof onSuccess === 'function') onSuccess();
      } catch (err) {
        console.error('[settlements] 儲存失敗：', err);
        showToast('儲存失敗：' + err.message, 'error');
      }
    },
    onCancel: () => closeModal(modalId),
  });
}

/* ============================================
   刪除 / 取消扣款
   ============================================ */
export async function handleSettlementDelete(row, onSuccess) {
  if (!row) return;

  // v101.10.0：加防護
  const ref = row._ref || {};

  if (row.source === 'insurance') {
    const ok = await openConfirm(
      `確定要取消「${row.name}」在 ${row.year}-${row.month} 的扣款紀錄嗎？\n\n保單本身不會被刪除，僅取消此月份的扣款狀態（會同步移除對應的成員支出）。`,
      { title: '取消扣款', okText: '確定', okClass: 'btn-danger' }
    );
    if (!ok) return;

    try {
      const { policyId, memberId, linkedId } = ref;

      if (!policyId) {
        showToast('缺少保單資訊', 'error');
        return;
      }

      await removeInsurancePaymentBatch(policyId, row.year, row.month);

      if (linkedId) {
        await removeExpense(row.year, row.month, memberId, linkedId);
      } else {
        await api.insuranceUnsync({
          policyId,
          memberId,
          year: row.year,
          month: row.month,
        });
      }

      showToast('✅ 已取消扣款', 'success');
      if (typeof onSuccess === 'function') onSuccess();
    } catch (err) {
      console.error('[settlements] 取消扣款失敗：', err);
      showToast('操作失敗：' + err.message, 'error');
    }
  } else {
    const ok = await openConfirm(
      `確定要刪除「${row.name}」（${row.year}-${row.month}）嗎？`,
      { title: '刪除支出', okText: '刪除', okClass: 'btn-danger' }
    );
    if (!ok) return;

    try {
      const { memberId, expenseId } = ref;

      if (!memberId || !expenseId) {
        showToast('缺少必要資訊，無法刪除', 'error');
        return;
      }

      await removeExpense(row.year, row.month, memberId, expenseId);
      showToast('✅ 已刪除', 'success');
      if (typeof onSuccess === 'function') onSuccess();
    } catch (err) {
      console.error('[settlements] 刪除失敗：', err);
      showToast('刪除失敗：' + err.message, 'error');
    }
  }
}