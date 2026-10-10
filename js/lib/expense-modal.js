// expense-modal.js — 支出編輯 Modal（v103.0.18）
import { buildForm } from '../ui/form-builder.js';
import { openModal, closeModal, openConfirm } from '../ui/modal.js';
import { showToast } from '../ui/toast.js';
import { addExpense, updateExpense, removeExpense } from '../core/db.js';
import { getDynamicOptions } from '../entity/entity-helpers.js';
import { AppState } from '../core/state.js';
import { RESERVED_IDS } from '../config/constants.js';
import { esc } from '../lib/dom.js';

const MODAL_ID = 'app-expense-modal';

/**
 * 開啟支出 Modal
 * @param {Object} opts
 * @param {Object} [opts.row] - 編輯時傳入；新增時省略
 * @param {Function} [opts.onSuccess] - 成功回呼
 */
export async function openExpenseModal(opts = {}) {
  const { row = null, onSuccess } = opts;
  const isEdit = !!row;
  document.getElementById(MODAL_ID)?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = MODAL_ID;
  overlay.innerHTML = `<div class="modal" style="max-width:560px;max-height:90vh;overflow-y:auto;"><h2 class="modal-title">${isEdit ? '編輯' : '新增'}支出</h2><div id="${MODAL_ID}-form-root"></div></div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(MODAL_ID); });

  const [members, categories, payments, banks] = await Promise.all([
    getDynamicOptions('members'),
    getDynamicOptions('categories'),
    getDynamicOptions('payments'),
    getDynamicOptions('bankAccounts'),
  ]);
  const memberOptions = [...members, { value: RESERVED_IDS.SHARED_MEMBER, label: '🏠 家庭共用' }];
  const { year, month } = AppState.getYearMonth();

  buildForm({
    containerId: `${MODAL_ID}-form-root`,
    fields: [
      { type: 'select', id: 'm-member', label: '成員', required: true, includeEmpty: false, options: memberOptions },
      { type: 'text', id: 'm-name', label: '項目名稱', required: true, maxlength: 60 },
      { type: 'number', id: 'm-amount', label: '金額（HK$）', required: true, min: 0, step: 1 },
      { type: 'text', id: 'm-date', label: '日期（YYYY-MM-DD）' },
      { type: 'select', id: 'm-cat', label: '類別', includeEmpty: true, options: categories },
      { type: 'select', id: 'm-item', label: '項目', includeEmpty: true, options: [] },
      { type: 'select', id: 'm-pay', label: '支付方式', includeEmpty: true, options: payments },
      { type: 'select', id: 'm-bank', label: '銀行（可選）', includeEmpty: true, options: banks },
      { type: 'select', id: 'm-status', label: '狀態', includeEmpty: false, options: [{ value: 'pending', label: '未處理' }, { value: 'done', label: '已處理' }] },
    ],
    submitText: isEdit ? '儲存' : '新增',
    showCancel: true,
    cancelText: '取消',
    initialData: isEdit ? {
      'm-member': row.memberId || '',
      'm-name': row.name || '',
      'm-amount': row.amount || 0,
      'm-date': row.date || '',
      'm-cat': row.categoryId || '',
      'm-item': row.itemId || '',
      'm-pay': row.paymentMethodId || '',
      'm-bank': row.bankId || '',
      'm-status': row.status || 'pending',
    } : {
      'm-member': AppState.getCurrentMemberId() || memberOptions[0]?.value || '',
      'm-amount': 0,
      'm-date': new Date().toISOString().slice(0, 10),
      'm-status': 'pending',
    },
    onSubmit: async (data) => {
      try {
        const memberId = data['m-member'];
        const payload = {
          name: data['m-name'],
          amount: Number(data['m-amount']) || 0,
          date: data['m-date'] || '',
          categoryId: data['m-cat'] || '',
          itemId: data['m-item'] || '',
          paymentMethodId: data['m-pay'] || '',
          bankId: data['m-bank'] || '',
          status: data['m-status'] || 'pending',
        };
        if (isEdit) {
          if (memberId !== row.memberId) {
            await removeExpense(row.year, row.month, row.memberId, row.id);
            await addExpense(row.year, row.month, memberId, payload);
          } else {
            await updateExpense(row.year, row.month, memberId, row.id, payload);
          }
          showToast('✅ 已更新支出', 'success');
        } else {
          const y = year || String(new Date().getFullYear());
          const m = month === 'all' ? '01' : month;
          await addExpense(y, m, memberId, payload);
          showToast('✅ 已新增支出', 'success');
        }
        closeModal(MODAL_ID);
        if (typeof onSuccess === 'function') onSuccess();
      } catch (err) { showToast('儲存失敗：' + err.message, 'error'); }
    },
    onCancel: () => closeModal(MODAL_ID),
  });

  /* 類別 → 項目聯動 */
  const catEl = document.getElementById('m-cat');
  const itemEl = document.getElementById('m-item');
  if (catEl && itemEl) {
    const updateItems = async () => {
      const list = await getDynamicOptions('items', { categoryId: catEl.value });
      itemEl.innerHTML = '<option value="">— 請選擇項目 —</option>' +
        list.map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('');
    };
    catEl.addEventListener('change', updateItems);
    if (isEdit && row.categoryId) {
      await updateItems();
      if (row.itemId) itemEl.value = row.itemId;
    }
  }

  openModal(MODAL_ID);
  if (window.lucide) window.lucide.createIcons();
}