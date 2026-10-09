// ============================================
// bank-account-manager.js — 銀行帳號管理元件（v102.0.0 🆕）
// 位置：js/shared/bank-account-manager.js
// ============================================
// 職責：
//   提供可重用的銀行帳號管理區塊（用於設定頁面）
//   - 列出所有銀行帳號
//   - 新增 / 編輯 / 刪除
//   - 設定初始餘額與年月
//   - 危險操作：清除舊銀行結餘
//
// 使用方式：
//   initBankAccountManager('container-id', { canInput: true });
// ============================================

import { api } from '../core/api.js';
import { AppState } from '../core/state.js';
import { escapeHtml, formatHKD } from '../core/utils.js';
import { showToast } from './toast.js';
import { openModal, closeModal, openConfirm } from './modal.js';
import { buildForm } from './form-builder.js';

/* ============================================
   Module 狀態
   ============================================ */
let _containerId = '';
let _accounts = [];
let _canInput = false;
let _listHandler = null;
let _formApi = null;

const EDIT_MODAL_ID = 'bank-account-edit-modal';

/* ============================================
   主入口
   ============================================ */
export function initBankAccountManager(containerId, options = {}) {
  _containerId = containerId;
  _canInput = options.canInput !== false;

  const root = document.getElementById(containerId);
  if (!root) {
    console.warn(`⚠️ initBankAccountManager: 找不到容器 #${containerId}`);
    return null;
  }

  _renderSkeleton();
  _bindEvents();
  _loadAccounts();

  return {
    refresh: _loadAccounts,
    destroy: _destroy,
  };
}

/* ============================================
   骨架
   ============================================ */
function _renderSkeleton() {
  const root = document.getElementById(_containerId);
  if (!root) return;

  const addBtnHtml = _canInput ? `
    <button type="button" class="btn btn-primary" id="${_containerId}-add-btn">
      <i data-lucide="plus" style="width:14px;height:14px;"></i> 新增銀行帳號
    </button>
  ` : '';

  const dangerZoneHtml = _canInput ? `
    <div class="glass-card" style="margin-top:16px; border-color:rgba(244,63,94,0.3); background:rgba(244,63,94,0.03);">
      <div class="glass-card-title" style="display:flex; align-items:center; gap:8px; margin-bottom:12px; color:var(--neon-red);">
        <i data-lucide="alert-triangle" style="width:14px;height:14px;"></i>
        <span>危險區域</span>
      </div>
      <p class="glass-card-hint mb-12">
        v102.0.0 銀行系統重構後，舊的「銀行結餘」資料已廢除。若有殘留舊資料，可在此一次清除。
      </p>
      <button type="button" class="btn btn-danger" id="${_containerId}-clear-old-btn">
        <i data-lucide="trash-2" style="width:14px;height:14px;"></i> 清除舊銀行結餘資料
      </button>
    </div>
  ` : '';

  root.innerHTML = `
    <div class="flex flex-between items-center flex-wrap gap-12 mb-16">
      <div class="text-muted" style="font-size:13px;">
        共 <span id="${_containerId}-count">0</span> 個銀行帳號
      </div>
      <div class="flex items-center gap-8 flex-wrap">
        ${addBtnHtml}
      </div>
    </div>

    <div id="${_containerId}-list"></div>

    ${dangerZoneHtml}
  `;

  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   事件綁定
   ============================================ */
function _bindEvents() {
  const root = document.getElementById(_containerId);
  if (!root) return;

  // 新增按鈕
  if (_canInput) {
    const addBtn = document.getElementById(`${_containerId}-add-btn`);
    if (addBtn) {
      addBtn.addEventListener('click', _handleAdd);
    }

    const clearBtn = document.getElementById(`${_containerId}-clear-old-btn`);
    if (clearBtn) {
      clearBtn.addEventListener('click', _handleClearOldBalances);
    }
  }

  // 列表事件委派
  const listEl = document.getElementById(`${_containerId}-list`);
  if (!listEl) return;

  if (_listHandler) {
    listEl.removeEventListener('click', _listHandler);
  }

  _listHandler = async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;

    if (action === 'edit') {
      await _handleEdit(id);
    } else if (action === 'delete') {
      await _handleDelete(id);
    }
  };

  listEl.addEventListener('click', _listHandler);
}

/* ============================================
   載入帳號
   ============================================ */
async function _loadAccounts() {
  const listEl = document.getElementById(`${_containerId}-list`);
  const countEl = document.getElementById(`${_containerId}-count`);
  if (!listEl) return;

  listEl.innerHTML = '<div class="empty-state">載入中…</div>';

  try {
    const result = await api.bankAccounts.list();
    _accounts = result.accounts || [];
    if (countEl) countEl.textContent = String(_accounts.length);
    _renderList();
  } catch (err) {
    console.error('[bank-account-manager] 載入失敗：', err);
    listEl.innerHTML = `<div class="empty-state text-red">載入失敗：${escapeHtml(err.message)}</div>`;
  }
}

/* ============================================
   渲染列表
   ============================================ */
function _renderList() {
  const listEl = document.getElementById(`${_containerId}-list`);
  if (!listEl) return;

  if (_accounts.length === 0) {
    listEl.innerHTML = `
      <div class="glass-card">
        <div class="empty-state">
          <i data-lucide="landmark" style="width:48px;height:48px;opacity:0.4;"></i>
          <p style="margin-top:12px;">尚無銀行帳號</p>
          ${_canInput ? '<p style="margin-top:6px; font-size:12px; color:var(--text-muted);">請點擊上方「新增銀行帳號」建立第一個帳號</p>' : ''}
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  listEl.innerHTML = `
    <div style="overflow-x:auto;">
      <table class="data-table">
        <thead>
          <tr>
            <th style="width:60px;">排序</th>
            <th>名稱</th>
            <th style="width:100px;">類型</th>
            <th class="num" style="width:130px;">初始餘額</th>
            <th style="width:110px;">初始年月</th>
            ${_canInput ? '<th style="width:160px;">操作</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${_accounts.map((acc) => _renderRow(acc)).join('')}
        </tbody>
      </table>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
}

function _renderRow(acc) {
  const typeLabel = acc.type === 'personal' ? '👤 個人' : '🏠 家庭';
  const initYM = `${acc.initialYear || '—'}-${acc.initialMonth || '—'}`;

  const actionsCell = _canInput ? `
    <td>
      <button type="button" class="btn btn-sm btn-ghost" data-action="edit" data-id="${escapeHtml(acc.id)}">
        <i data-lucide="pencil" style="width:12px;height:12px;"></i> 編輯
      </button>
      <button type="button" class="btn btn-sm btn-danger" data-action="delete" data-id="${escapeHtml(acc.id)}">
        <i data-lucide="trash-2" style="width:12px;height:12px;"></i> 刪除
      </button>
    </td>
  ` : '';

  return `
    <tr>
      <td class="mono" style="color:var(--text-muted);">${acc.order || 0}</td>
      <td style="font-weight:500;">${escapeHtml(acc.name || '')}</td>
      <td style="font-size:12px;">${typeLabel}</td>
      <td class="num mono">${formatHKD(acc.initialBalance)}</td>
      <td class="mono" style="font-size:12px; color:var(--text-muted);">${initYM}</td>
      ${actionsCell}
    </tr>
  `;
}

/* ============================================
   新增
   ============================================ */
async function _handleAdd() {
  if (!_canInput) return;
  await _openEditModal(null);
}

/* ============================================
   編輯
   ============================================ */
async function _handleEdit(id) {
  if (!_canInput) return;
  const acc = _accounts.find((a) => a.id === id);
  if (!acc) {
    showToast('找不到此銀行帳號', 'error');
    return;
  }
  await _openEditModal(acc);
}

/* ============================================
   開啟編輯 Modal
   ============================================ */
async function _openEditModal(account) {
  const isEdit = !!account;
  document.getElementById(EDIT_MODAL_ID)?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay active';
  overlay.id = EDIT_MODAL_ID;
  overlay.innerHTML = `
    <div class="modal" style="max-width:520px; max-height:90vh; overflow-y:auto;">
      <h2 class="modal-title">${isEdit ? '編輯' : '新增'}銀行帳號</h2>
      <div id="${EDIT_MODAL_ID}-form-root"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(EDIT_MODAL_ID);
  });

  // 年月選項
  const currentYear = new Date().getFullYear();
  const yearOptions = [];
  for (let y = currentYear - 3; y <= currentYear + 1; y++) {
    yearOptions.push({ value: String(y), label: `${y} 年` });
  }
  const monthOptions = [];
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    monthOptions.push({ value: mm, label: `${m} 月` });
  }

  const initialData = isEdit ? {
    name: account.name || '',
    type: account.type || 'family',
    initialBalance: account.initialBalance || 0,
    initialYear: account.initialYear || String(currentYear),
    initialMonth: account.initialMonth || '01',
    order: account.order || 0,
  } : {
    type: 'family',
    initialBalance: 0,
    initialYear: String(currentYear),
    initialMonth: '01',
    order: _accounts.length,
  };

  _formApi = buildForm({
    containerId: `${EDIT_MODAL_ID}-form-root`,
    fields: [
      { type: 'text', id: 'name', label: '銀行名稱', required: true, maxlength: 20, placeholder: '例如：中銀、匯豐' },
      {
        type: 'select', id: 'type', label: '類型', required: true, includeEmpty: false,
        options: [
          { value: 'family', label: '🏠 家庭帳號' },
          { value: 'personal', label: '👤 個人帳號' },
        ],
        defaultValue: 'family',
      },
      {
        type: 'number', id: 'initialBalance', label: '初始餘額（HK$）', required: true,
        min: 0, step: 1, placeholder: '0',
        hint: '此帳號在「初始年月」時的餘額',
      },
      {
        type: 'select', id: 'initialYear', label: '初始年份', required: true,
        includeEmpty: false, options: yearOptions,
      },
      {
        type: 'select', id: 'initialMonth', label: '初始月份', required: true,
        includeEmpty: false, options: monthOptions,
      },
      {
        type: 'number', id: 'order', label: '排序', min: 0, step: 1, defaultValue: 0,
        hint: '數字越小越前面',
      },
    ],
    submitText: isEdit ? '儲存' : '新增',
    showCancel: true,
    cancelText: '取消',
    initialData,
    beforeSubmit: (data) => {
      const name = (data.name || '').trim();
      if (!name) return { field: 'name', message: '請填寫銀行名稱' };
      // 檢查重複名稱
      const dup = _accounts.find((a) =>
        (isEdit ? a.id !== account.id : true) && a.name === name
      );
      if (dup) return { field: 'name', message: '此銀行名稱已存在' };
      return true;
    },
    onSubmit: async (data) => {
      try {
        const payload = {
          name: data.name.trim(),
          type: data.type,
          initialBalance: Number(data.initialBalance) || 0,
          initialYear: data.initialYear,
          initialMonth: data.initialMonth,
          order: Number(data.order) || 0,
        };

        if (isEdit) {
          await api.bankAccounts.update(account.id, payload);
          showToast('✅ 已更新銀行帳號', 'success');
        } else {
          await api.bankAccounts.create(payload);
          showToast('✅ 已新增銀行帳號', 'success');
        }
        closeModal(EDIT_MODAL_ID);
        await _loadAccounts();
      } catch (err) {
        showToast((isEdit ? '更新' : '新增') + '失敗：' + err.message, 'error');
      }
    },
    onCancel: () => closeModal(EDIT_MODAL_ID),
  });

  openModal(EDIT_MODAL_ID);
  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   刪除
   ============================================ */
async function _handleDelete(id) {
  if (!_canInput) return;
  const acc = _accounts.find((a) => a.id === id);
  if (!acc) return;

  const ok = await openConfirm(
    `⚠️ 確定要刪除「${acc.name}」嗎？\n\n這將會一併刪除該帳號的所有交易記錄，此操作無法復原。`,
    { title: '刪除銀行帳號', okText: '刪除', okClass: 'btn-danger' }
  );
  if (!ok) return;

  try {
    const result = await api.bankAccounts.remove(id);
    const txnCount = result.removedTxnCount || 0;
    showToast(
      txnCount > 0
        ? `✅ 已刪除（連同 ${txnCount} 筆交易）`
        : '✅ 已刪除',
      'success'
    );
    await _loadAccounts();
  } catch (err) {
    showToast('刪除失敗：' + err.message, 'error');
  }
}

/* ============================================
   清除舊銀行結餘
   ============================================ */
async function _handleClearOldBalances() {
  if (!_canInput) return;

  const ok = await openConfirm(
    '⚠️ 確定要清除所有「舊版銀行結餘」資料嗎？\n\n' +
    '這會刪除 families/{familyId}/bank_balances/ 下的所有資料。\n\n' +
    'v102.0.0 銀行系統重構後，舊資料已不再使用，此操作無法復原。',
    { title: '清除舊銀行結餘', okText: '確定清除', okClass: 'btn-danger' }
  );
  if (!ok) return;

  try {
    const result = await api.clearBankBalances();
    if (result.cleared) {
      showToast(`✅ 已清除 ${result.recordCount || 0} 筆舊資料`, 'success');
    } else {
      showToast('無舊資料可清除', 'info');
    }
  } catch (err) {
    showToast('清除失敗：' + err.message, 'error');
  }
}

/* ============================================
   銷毀
   ============================================ */
function _destroy() {
  const root = document.getElementById(_containerId);
  if (root) {
    const listEl = document.getElementById(`${_containerId}-list`);
    if (listEl && _listHandler) {
      listEl.removeEventListener('click', _listHandler);
    }
  }
  if (_formApi) { try { _formApi.destroy(); } catch (e) {} _formApi = null; }
  document.getElementById(EDIT_MODAL_ID)?.remove();
  _accounts = [];
  _listHandler = null;
  _containerId = '';
}