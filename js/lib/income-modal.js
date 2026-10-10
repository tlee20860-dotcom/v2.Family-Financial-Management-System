// income-modal.js — 收入 Modal（v103.0.18）
import { buildForm } from '../ui/form-builder.js';
import { openModal, closeModal } from '../ui/modal.js';
import { showToast } from '../ui/toast.js';
import { saveIncome, savePersonalIncome } from '../core/db.js';
import { getDynamicOptions } from '../entity/entity-helpers.js';
import { AppState } from '../core/state.js';

const CONTRIB_ID = 'app-contribution-modal';
const PERSONAL_ID = 'app-personal-income-modal';

/**
 * 家用轉入 Modal
 */
export async function openContributionModal(opts = {}) {
  const { onSuccess } = opts;
  document.getElementById(CONTRIB_ID)?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = CONTRIB_ID;
  overlay.innerHTML = `<div class="modal" style="max-width:480px;"><h2 class="modal-title">家用轉入</h2><div id="${CONTRIB_ID}-form-root"></div></div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(CONTRIB_ID); });

  const members = await getDynamicOptions('members');
  const { year, month } = AppState.getYearMonth();
  const y = year || String(new Date().getFullYear());
  const m = month === 'all' ? '01' : month;

  buildForm({
    containerId: `${CONTRIB_ID}-form-root`,
    fields: [
      { type: 'select', id: 'c-member', label: '成員', required: true, includeEmpty: false, options: members },
      { type: 'number', id: 'c-amount', label: '金額（HK$）', required: true, min: 0, step: 1 },
    ],
    submitText: '儲存',
    showCancel: true,
    cancelText: '取消',
    onSubmit: async (data) => {
      try {
        await saveIncome(y, m, { [data['c-member']]: Number(data['c-amount']) || 0 });
        showToast(`✅ 已為 ${y}-${m} 新增家用轉入`, 'success');
        closeModal(CONTRIB_ID);
        if (typeof onSuccess === 'function') onSuccess();
      } catch (err) { showToast('儲存失敗：' + err.message, 'error'); }
    },
    onCancel: () => closeModal(CONTRIB_ID),
  });

  openModal(CONTRIB_ID);
  if (window.lucide) window.lucide.createIcons();
}

/**
 * 個人收入 Modal
 */
export async function openPersonalIncomeModal(opts = {}) {
  const { onSuccess } = opts;
  document.getElementById(PERSONAL_ID)?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = PERSONAL_ID;
  overlay.innerHTML = `<div class="modal" style="max-width:480px;"><h2 class="modal-title">個人收入</h2><div id="${PERSONAL_ID}-form-root"></div></div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(PERSONAL_ID); });

  const members = await getDynamicOptions('members');
  const { year, month } = AppState.getYearMonth();
  const y = year || String(new Date().getFullYear());
  const m = month === 'all' ? '01' : month;

  buildForm({
    containerId: `${PERSONAL_ID}-form-root`,
    fields: [
      { type: 'select', id: 'p-member', label: '成員', required: true, includeEmpty: false, options: members },
      { type: 'number', id: 'p-amount', label: '金額（HK$）', required: true, min: 0, step: 1 },
    ],
    submitText: '儲存',
    showCancel: true,
    cancelText: '取消',
    onSubmit: async (data) => {
      try {
        await savePersonalIncome(data['p-member'], y, m, Number(data['p-amount']) || 0);
        showToast(`✅ 已為 ${y}-${m} 新增個人收入`, 'success');
        closeModal(PERSONAL_ID);
        if (typeof onSuccess === 'function') onSuccess();
      } catch (err) { showToast('儲存失敗：' + err.message, 'error'); }
    },
    onCancel: () => closeModal(PERSONAL_ID),
  });

  openModal(PERSONAL_ID);
  if (window.lucide) window.lucide.createIcons();
}