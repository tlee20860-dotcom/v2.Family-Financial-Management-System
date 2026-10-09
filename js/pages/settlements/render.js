// ============================================
// render.js — 結算清單渲染輔助（v102.0.0）
// 位置：js/pages/settlements/render.js
// ============================================
// v102.0.0 修正：
//   ✅ 保險結算時彈出「選擇銀行」Modal
//   ✅ 依 paymentMode 分派（direct / advance）
//   ✅ 支出編輯新增「出帳銀行」欄位 + 同步銀行交易
//   ✅ 保留 v101.10.0 全部功能
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
  getInsurancePoliciesOnce,
  getMemberAdvancesOnce,
  updateMemberAdvance,
  updateInsurancePolicy,
  listenBankAccounts,
} from '../../core/db.js';
import { api } from '../../core/api.js';
import { getStatusesByCategory } from '../../config/app-config.js';
import { escapeHtml, formatHKD } from '../../core/utils.js';
import { isDoneStatus } from '../../shared/entity-helpers.js';
import { buildForm } from '../../shared/form-builder.js';
import { openModal, closeModal, openConfirm } from '../../shared/modal.js';
import { showToast } from '../../shared/toast.js';
import { AppState } from '../../core/state.js';
import {
  syncExpenseToBank,
  cleanupExpenseBankTransaction,
} from '../../shared/bank-helpers.js';

/* ============================================
   成員快取
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
   來源 badge
   ============================================ */
export function renderSourceBadge(row) {
  const map = {
    personal:  { cls: 'badge-info',    label: row.memberId === 'shared' ? '🏠 家庭' : '🏷 個人' },
    insurance: { cls: 'badge-success', label: '🛡 保險' },
  };
  const cfg = map[row.source] || map.personal;
  return `<span class="badge ${cfg.cls}">${cfg.label}</span>`;
}

export function getMemberName(row) {
  if (row.source === 'personal' || row.source === 'insurance') {
    const m = _membersCache.find((x) => x.id === row.memberId);
    if (m) return m.name;
    if (row.memberId === 'shared') return '家庭共用';
  }
  return row._memberName || '（未知）';
}

/* ============================================
   狀態寫回（核心）
   ============================================ */
export async function updateRowStatus(row, newStatus) {
  if (!row) throw new Error('找不到紀錄');

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

/* ============================================
   🆕 v102.0.0：保險狀態更新（含銀行選擇）
   ============================================ */
async function _updateInsuranceStatus(row, newStatus, isDone, ref) {
  const { policyId, memberId, linkedId } = ref;
  const year = row.year;
  const month = row.month;

  if (!policyId) throw new Error('缺少 policyId');
  if (!memberId) throw new Error('缺少 memberId');

  // 讀取保單資訊（含 paymentMode）
  let policy = null;
  try {
    const policies = await getInsurancePoliciesOnce();
    policy = policies.find((p) => p.id === policyId);
  } catch (e) {}

  if (!policy) throw new Error('找不到保單');

  const paymentMode = policy.paymentMode || 'direct';

  /* ============================================
     情境 1：已扣款（需要銀行）
     ============================================ */
  if (isDone) {
    // 若已有 bankId/txnId → 直接更新狀態（不重複彈 Modal）
    if (row.bankId && row.txnId) {
      return await _writeInsurancePaymentDone(row, policy, paymentMode, row.bankId, row.txnId, linkedId, memberId, year, month, newStatus);
    }

    // 彈出「選擇銀行」Modal
    await _openBankSelectModal({
      title: paymentMode === 'advance' ? '代墊還款（選擇銀行）' : '保險扣款（選擇銀行）',
      amount: row.amount,
      policyId,
      memberId,
      year,
      month,
      paymentMode,
      advanceHolderId: policy.advanceHolderId || '',
      status: newStatus,
      linkedId,
      onConfirm: async (bankId) => {
        return await _writeInsurancePaymentDone(row, policy, paymentMode, bankId, '', linkedId, memberId, year, month, newStatus);
      },
    });
    return;
  }

  /* ============================================
     情境 2：取消扣款（移除付款 / 交易）
     ============================================ */
  await removeInsurancePaymentBatch(policyId, year, month);

  // 清理銀行交易
  if (row.bankId && row.txnId) {
    const { removeBankTransaction } = await import('../../core/db.js');
    try {
      await removeBankTransaction(row.bankId, row.txnId);
    } catch (e) {
      console.warn('[settlements] 刪除銀行交易失敗：', e);
    }
  }

  // 清理 linked 支出
  if (linkedId) {
    await removeExpense(year, month, memberId, linkedId);
  } else {
    await api.insuranceUnsync({ policyId, memberId, year, month });
  }

  // 🆕 v102.0.0：若為代墊模式，退還 remainingAmount
  if (paymentMode === 'advance' && policy.advanceHolderId) {
    try {
      const advances = await getMemberAdvancesOnce(policy.advanceHolderId);
      const target = advances.find((a) => a.policyId === policyId);
      if (target) {
        const refund = Number(row.amount) || 0;
        await updateMemberAdvance(policy.advanceHolderId, target.id, {
          remainingAmount: (Number(target.remainingAmount) || 0) + refund,
        });
      }
    } catch (e) {
      console.warn('[settlements] 退還代墊失敗：', e);
    }
  }
}

/**
 * 寫入保險付款（含銀行交易）
 */
async function _writeInsurancePaymentDone(row, policy, paymentMode, bankId, _existingTxnId, linkedId, memberId, year, month, newStatus) {
  // 1. 建立銀行交易
  let txnId = '';
  try {
    if (paymentMode === 'advance') {
      // 代墊模式 → 還款給代墊成員
      const { createTransactionForReimbursement } = await import('../../shared/bank-helpers.js');
      txnId = await createTransactionForReimbursement({
        bankId,
        memberId: policy.advanceHolderId || memberId,
        amount: row.amount,
        date: row.date || new Date().toISOString().slice(0, 10),
        policyId: policy.id,
        note: `${policy.name} (代墊還款)`,
      });
    } else {
      // 直接付款 → 支付給保險公司
      const { createTransactionForInsurance } = await import('../../shared/bank-helpers.js');
      txnId = await createTransactionForInsurance({
        bankId,
        memberId,
        amount: row.amount,
        date: row.date || new Date().toISOString().slice(0, 10),
        policyId: policy.id,
        note: policy.name,
      });
    }
  } catch (e) {
    console.warn('[settlements] 建立銀行交易失敗：', e);
  }

  // 2. 寫入 insurance_payments（含 bankId / txnId / paymentMode）
  await saveInsurancePaymentBatch(policy.id, year, month, {
    status: newStatus,
    amount: row.amount,
    bankId,
    txnId,
  });

  // 3. 更新 linked 支出（或建立）
  if (linkedId) {
    await updateExpense(year, month, memberId, linkedId, {
      status: newStatus,
      bankId,
      txnId,
    });
  } else {
    await api.insuranceSync({
      policyId: policy.id,
      memberId,
      policyName: policy.name,
      monthlyAverage: row.amount,
      year,
      month,
      bankId,
      txnId,
      paymentMode,
      advanceHolderId: policy.advanceHolderId || '',
    });
  }

  // 4. 🆕 v102.0.0：代墊模式扣減 remainingAmount（後端已在 API 處理，前端不重複）
  // （insurance-sync.js 後端已自動扣減，此處不需再扣）

  showToast('✅ 狀態已更新', 'success');
}

/* ============================================
   🆕 v102.0.0：選擇銀行 Modal
   ============================================ */
async function _openBankSelectModal({
  title, amount, policyId, memberId, year, month, paymentMode, advanceHolderId, status, linkedId, onConfirm,
}) {
  const MODAL_ID = 'settlements-bank-select-modal';
  document.getElementById(MODAL_ID)?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay active';
  overlay.id = MODAL_ID;
  overlay.innerHTML = `
    <div class="modal" style="max-width:480px;">
      <h2 class="modal-title">${escapeHtml(title)}</h2>
      <div id="${MODAL_ID}-form-root"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(MODAL_ID);
  });

  // 提示文字
  const infoHtml = `
    <div class="glass-card-hint" style="margin-bottom:12px;">
      金額：<b class="mono text-cyan">${formatHKD(amount)}</b>
      ${paymentMode === 'advance'
        ? `<br>代墊成員：<b>${escapeHtml(_memberName(advanceHolderId))}</b>（將從家庭帳號還款給該成員）`
        : `<br>將從家庭帳號支付給保險公司`}
    </div>
  `;

  const formApi = buildForm({
    containerId: `${MODAL_ID}-form-root`,
    fields: [
      { type: 'custom', id: 'info', html: infoHtml },
      { type: 'select', id: 'bankId', label: '選擇銀行', required: true, includeEmpty: true, emptyText: '— 請選擇銀行 —' },
    ],
    submitText: '確認',
    showCancel: true,
    cancelText: '取消',
    onSubmit: async (data) => {
      if (!data.bankId) {
        showToast('請選擇銀行', 'warning');
        return;
      }
      try {
        await onConfirm(data.bankId);
        closeModal(MODAL_ID);
      } catch (err) {
        console.error('[settlements] 確認失敗：', err);
        showToast('失敗：' + err.message, 'error');
      }
    },
    onCancel: () => closeModal(MODAL_ID),
  });

  // 動態載入銀行帳號
  listenBankAccounts((list) => {
    formApi.updateOptions('bankId', list.map((b) => ({ value: b.id, label: b.name })), {
      includeEmpty: true,
      emptyText: '— 請選擇銀行 —',
    });
  });

  openModal(MODAL_ID);
  if (window.lucide) window.lucide.createIcons();
}

function _memberName(memberId) {
  const m = _membersCache.find((x) => x.id === memberId);
  return m ? m.name : '（未知）';
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
   個人支出編輯表單（🆕 含出帳銀行）
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
      // 🆕 v102.0.0：出帳銀行
      { type: 'select', id: 'bankId', label: '出帳銀行（選填）', includeEmpty: true, emptyText: '— 不關聯銀行 —' },
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
      bankId: row.bankId || '',                     // 🆕 v102.0.0
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
        const newBankId = data.bankId || '';
        const oldBankId = row.bankId || '';
        const oldTxnId = row.txnId || '';

        const pathChanged = newYear !== oldYear || newMonth !== oldMonth || newMemberId !== oldMemberId;

        // 🆕 v102.0.0：同步銀行交易
        const newTxnId = await syncExpenseToBank({
          oldBankId,
          oldTxnId,
          newBankId,
          expenseData: {
            memberId: newMemberId,
            amount: Number(data.amount) || 0,
            date: data.date || '',
            name: data.name,
          },
          expenseId: oldExpenseId,
        });

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
              bankId: newBankId,
              txnId: newTxnId || '',
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
            bankId: newBankId,
            txnId: newTxnId || '',
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

  // 動態載入銀行
  listenBankAccounts((list) => {
    formApi.updateOptions('bankId', list.map((b) => ({ value: b.id, label: b.name })), {
      includeEmpty: true,
      emptyText: '— 不關聯銀行 —',
    });
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
   保險扣款編輯表單（僅狀態 + 銀行）
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
            ${row.bankId ? `<br>目前銀行：<b>${escapeHtml(row.bankId)}</b>` : ''}
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

  const ref = row._ref || {};

  if (row.source === 'insurance') {
    const ok = await openConfirm(
      `確定要取消「${row.name}」在 ${row.year}-${row.month} 的扣款紀錄嗎？\n\n保單本身不會被刪除，僅取消此月份的扣款狀態（會同步移除對應的成員支出與銀行交易）。`,
      { title: '取消扣款', okText: '確定', okClass: 'btn-danger' }
    );
    if (!ok) return;

    try {
      const { policyId, memberId, linkedId } = ref;

      if (!policyId) {
        showToast('缺少保單資訊', 'error');
        return;
      }

      // 1. 刪除 insurance_payments
      await removeInsurancePaymentBatch(policyId, row.year, row.month);

      // 2. 清理銀行交易
      if (row.bankId && row.txnId) {
        const { removeBankTransaction } = await import('../../core/db.js');
        try {
          await removeBankTransaction(row.bankId, row.txnId);
        } catch (e) {
          console.warn('[settlements] 刪除銀行交易失敗：', e);
        }
      }

      // 3. 清理 linked 支出
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

      // 🆕 v102.0.0：清理銀行交易
      if (row.bankId && row.txnId) {
        await cleanupExpenseBankTransaction(row.bankId, row.txnId);
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