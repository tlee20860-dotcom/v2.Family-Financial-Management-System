// ============================================
// index.js — 綜合輸入中心入口（v102.0.0）
// 位置：js/pages/input-center/index.js
// ============================================
// v102.0.0 修正：
//   ✅ [P2-10] 家用轉入改走 bank-helpers 的 createTransactionForContribution
//   ✅ [P2-11] 新增支出若銀行交易建立失敗，回滾孤兒交易
//   ✅ 6 個按鈕（新增支出 / 家用轉入 / 個人收入 / 保單 / 基金 / 銀行交易▼）
//   ✅ 銀行交易下拉（手動入帳 / 手動出帳）
//   ✅ 家用轉入表單新增「所屬年度 / 月份」選擇
// ============================================

import { initTabPanel } from '../../shared/tab-panel.js';
import { showToast } from '../../shared/toast.js';
import { openEntityModal } from '../../shared/entity-modal.js';
import { ENTITY_KEYS, RESERVED_IDS } from '../../config/constants.js';
import { AppState } from '../../core/state.js';
import {
  addExpense, saveIncome, savePersonalIncome,
  getMembersOnce, getItemsOnce, updateExpense, removeBankTransaction,
  listenCategories, listenPaymentMethods, listenBankAccounts,
} from '../../core/db.js';
import { getStatusesByCategory, getDefaultStatus, getYearList } from '../../config/app-config.js';
import { escapeHtml, todayISO } from '../../core/utils.js';
import { buildForm } from '../../shared/form-builder.js';
import { openModal, closeModal } from '../../shared/modal.js';
import { api } from '../../core/api.js';
import {
  createTransactionForExpense,
  createTransactionForContribution,
} from '../../shared/bank-helpers.js';
import { registerPageCleanup } from '../../core/app.js';

/* ============================================
   Tab 定義
   ============================================ */
const TABS = [
  { key: 'expense',   label: '支出', icon: 'receipt',   panelId: 'ic-panel-expense'   },
  { key: 'insurance', label: '保險', icon: 'shield',    panelId: 'ic-panel-insurance' },
  { key: 'fund',      label: '基金', icon: 'line-chart', panelId: 'ic-panel-fund'      },
  { key: 'bank',      label: '銀行', icon: 'landmark',  panelId: 'ic-panel-bank'      },
];

/* ============================================
   Module 狀態
   ============================================ */
let _container = null;
let _tabPanel = null;
let _tabInstances = {
  expense:   null,
  insurance: null,
  fund:      null,
  bank:      null,
};

let _modalListenerCleanups = [];
let _bankTxnDropdownHandler = null;
let _bankTxnOutsideHandler = null;

function _cleanupModalListeners() {
  _modalListenerCleanups.forEach((fn) => {
    try { fn(); } catch (e) { /* noop */ }
  });
  _modalListenerCleanups = [];
}

/* ============================================
   主入口
   ============================================ */
export async function initInputCenterPage() {
  _container = document.getElementById('input-center-root');
  if (!_container) {
    console.warn('⚠️ initInputCenterPage: 找不到容器 #input-center-root');
    return null;
  }

  _renderSkeleton();
  _bindButtons();

  _tabPanel = initTabPanel({
    containerId: 'ic-tab-bar-root',
    tabs: TABS,
    defaultKey: 'expense',
    storageKey: 'input-center-tab',
    onChange: (key) => _activateTab(key),
  });

  if (_tabPanel) {
    await _activateTab(_tabPanel.getCurrent());
  }

  registerPageCleanup(_destroy);

  return {
    switchTo: (key) => _tabPanel?.switchTo(key),
    getCurrent: () => _tabPanel?.getCurrent(),
    destroy: _destroy,
  };
}

/* ============================================
   骨架
   ============================================ */
function _renderSkeleton() {
  const userCanInput = AppState.getCanInput();

  const buttonsHtml = userCanInput ? `
    <div class="flex flex-wrap gap-8 mb-20" id="ic-buttons-root" style="position:relative;">
      <button type="button" class="btn btn-primary" data-action="add-expense">
        <i data-lucide="plus"></i> 新增支出
      </button>
      <button type="button" class="btn btn-primary" data-action="add-contribution">
        <i data-lucide="plus"></i> 家用轉入
      </button>
      <button type="button" class="btn btn-primary" data-action="add-personal-income">
        <i data-lucide="plus"></i> 個人收入
      </button>
      <button type="button" class="btn btn-primary" data-action="add-policy">
        <i data-lucide="plus"></i> 新增保單
      </button>
      <button type="button" class="btn btn-primary" data-action="add-fund">
        <i data-lucide="plus"></i> 新增基金
      </button>
      <div style="position:relative;" id="ic-bank-txn-dropdown">
        <button type="button" class="btn btn-primary" data-action="bank-txn-toggle">
          <i data-lucide="landmark"></i> 銀行交易 <i data-lucide="chevron-down" style="width:14px;height:14px;"></i>
        </button>
        <div id="ic-bank-txn-menu" class="glass-card" style="display:none; position:absolute; top:calc(100% + 6px); left:0; z-index:100; min-width:180px; padding:6px; border-radius:var(--radius-sm);">
          <button type="button" class="btn btn-ghost" style="width:100%; justify-content:flex-start;" data-action="add-manual-in">
            <i data-lucide="arrow-down-circle" style="width:14px;height:14px; color:var(--neon-emerald);"></i> 手動入帳
          </button>
          <button type="button" class="btn btn-ghost" style="width:100%; justify-content:flex-start;" data-action="add-manual-out">
            <i data-lucide="arrow-up-circle" style="width:14px;height:14px; color:var(--neon-red);"></i> 手動出帳
          </button>
        </div>
      </div>
    </div>
  ` : `
    <div class="banner mb-20" style="border-color:rgba(251,146,60,0.3); background:rgba(251,146,60,0.06); color:var(--neon-orange);">
      <i data-lucide="lock" style="width:14px;height:14px;"></i>
      目前為唯讀模式，僅可檢視資料。如需輸入權限請聯繫管理員。
    </div>
  `;

  _container.innerHTML = `
    ${buttonsHtml}
    <div id="ic-tab-bar-root" class="mb-16"></div>
    <div id="ic-panel-expense"   class="tab-panel" style="display:none;"></div>
    <div id="ic-panel-insurance" class="tab-panel" style="display:none;"></div>
    <div id="ic-panel-fund"      class="tab-panel" style="display:none;"></div>
    <div id="ic-panel-bank"      class="tab-panel" style="display:none;"></div>
  `;

  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   按鈕綁定
   ============================================ */
function _bindButtons() {
  const root = document.getElementById('ic-buttons-root');
  if (!root) return;

  root.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    switch (action) {
      case 'add-expense': _openAddExpenseModal(); break;
      case 'add-contribution': _openAddContributionModal(); break;
      case 'add-personal-income': _openAddPersonalIncomeModal(); break;
      case 'add-policy': openEntityModal({ entity: ENTITY_KEYS.POLICY, mode: 'add' }); break;
      case 'add-fund': openEntityModal({ entity: ENTITY_KEYS.FUND, mode: 'add' }); break;
      case 'bank-txn-toggle': _toggleBankTxnDropdown(); break;
      case 'add-manual-in':
        _closeBankTxnDropdown();
        _openManualBankTxnModal('in');
        break;
      case 'add-manual-out':
        _closeBankTxnDropdown();
        _openManualBankTxnModal('out');
        break;
    }
  });

  _bankTxnOutsideHandler = (e) => {
    const dropdown = document.getElementById('ic-bank-txn-dropdown');
    if (!dropdown) return;
    if (!dropdown.contains(e.target)) {
      _closeBankTxnDropdown();
    }
  };
  document.addEventListener('click', _bankTxnOutsideHandler);
}

function _toggleBankTxnDropdown() {
  const menu = document.getElementById('ic-bank-txn-menu');
  if (!menu) return;
  const isOpen = menu.style.display === 'block';
  if (isOpen) {
    _closeBankTxnDropdown();
  } else {
    menu.style.display = 'block';
    if (window.lucide) window.lucide.createIcons();
  }
}

function _closeBankTxnDropdown() {
  const menu = document.getElementById('ic-bank-txn-menu');
  if (menu) menu.style.display = 'none';
}

/* ============================================
   Tab 啟用（懶載入）
   ============================================ */
async function _activateTab(key) {
  const tabDef = TABS.find((t) => t.key === key);
  if (!tabDef) return;

  if (_tabInstances[key]) {
    try { _tabInstances[key].refresh?.(); } catch (e) { /* noop */ }
    return;
  }

  try {
    const instance = await _initTabModule(key, tabDef.panelId);
    _tabInstances[key] = instance;
  } catch (err) {
    console.error(`[input-center] 初始化 ${key} 失敗：`, err);
    showToast(`載入「${tabDef.label}」失敗`, 'error');
    const panel = document.getElementById(tabDef.panelId);
    if (panel) {
      panel.innerHTML = `<div class="banner banner-error">載入失敗：${err.message || err}</div>`;
    }
  }
}

async function _initTabModule(key, containerId) {
  switch (key) {
    case 'expense': {
      const m = await import('./recent-list.js');
      return m.initRecentList(containerId, {});
    }
    case 'insurance': {
      const m = await import('./holdings-list.js');
      return m.initHoldingsList(containerId, { types: ['policy'] });
    }
    case 'fund': {
      const m = await import('./holdings-list.js');
      return m.initHoldingsList(containerId, { types: ['fund'] });
    }
    case 'bank': {
      const m = await import('./holdings-list.js');
      return m.initHoldingsList(containerId, { types: ['bank'] });
    }
    default:
      throw new Error(`未知的 Tab：${key}`);
  }
}

/* ============================================
   新增支出 Modal（🆕 P2-11：孤兒交易回滾）
   ============================================ */
async function _openAddExpenseModal() {
  if (!AppState.getCanInput()) return;

  _cleanupModalListeners();

  const MODAL_ID = 'ic-add-expense-modal';
  _destroyModal(MODAL_ID);

  const ym = AppState.getYearMonth();
  const curMonth = ym.month === 'all' ? '01' : (ym.month || '01');

  const [members, statusList] = await Promise.all([
    getMembersOnce(),
    Promise.resolve(getStatusesByCategory('personal')),
  ]);

  const memberOptions = [
    ...sortMembersLocal(members).map((m) => ({ value: m.id, label: m.name })),
    { value: RESERVED_IDS.SHARED_MEMBER, label: '家庭共用' },
  ];
  const defaultStatus = getDefaultStatus('personal');

  _createModal(MODAL_ID, '新增支出');
  const formApi = buildForm({
    containerId: `${MODAL_ID}-form-root`,
    fields: [
      { type: 'select', id: 'year',   label: '所屬年份', required: true, includeEmpty: false, options: _yearOptions(), defaultValue: ym.year || String(new Date().getFullYear()) },
      { type: 'select', id: 'month',  label: '所屬月份', required: true, includeEmpty: false, options: _monthOptions(), defaultValue: curMonth },
      { type: 'select', id: 'member', label: '支出成員', required: true, includeEmpty: true, emptyText: '— 請選擇 —', options: memberOptions },
      { type: 'text',   id: 'date',   label: '支出日期', placeholder: 'YYYY-MM-DD', maxlength: 10, defaultValue: todayISO() },
      { type: 'select', id: 'category', label: '支出類別', required: true, includeEmpty: true, emptyText: '— 請選擇類別 —' },
      { type: 'select', id: 'item', label: '項目', required: true, includeEmpty: true, emptyText: '— 請先選擇類別 —' },
      { type: 'number', id: 'amount', label: '費用（HK$）', required: true, min: 0, step: 1, placeholder: '0' },
      { type: 'select', id: 'payment', label: '支付方式', includeEmpty: true, emptyText: '— 請選擇 —' },
      { type: 'select', id: 'bankId', label: '出帳銀行（選填）', includeEmpty: true, emptyText: '— 不關聯銀行 —', hint: '選擇後會自動建立銀行交易' },
      { type: 'select', id: 'status', label: '狀態', includeEmpty: false,
        options: statusList.map((s) => ({ value: s.name, label: s.name })),
        defaultValue: defaultStatus?.name || '未處理' },
    ],
    submitText: '新增支出',
    showCancel: true,
    cancelText: '取消',
    onSubmit: async (data) => {
      const itemName = await _getItemName(data.item);
      const payload = {
        name: itemName || '（未命名）',
        amount: Number(data.amount) || 0,
        status: data.status,
        date: data.date || todayISO(),
        categoryId: data.category,
        itemId: data.item,
        paymentMethodId: data.payment || '',
        bankId: data.bankId || '',
      };

      // 1. 先建立支出
      const expenseId = await addExpense(data.year, data.month, data.member, payload);

      // 2. 若選了銀行，建立交易並寫回 txnId
      //    🆕 P2-11：若寫回失敗，回滾孤兒交易
      if (data.bankId && expenseId) {
        let txnId = '';
        try {
          txnId = await createTransactionForExpense({
            bankId: data.bankId,
            memberId: data.member,
            amount: payload.amount,
            date: payload.date,
            expenseId,
            note: itemName || '',
          });
          await updateExpense(data.year, data.month, data.member, expenseId, { txnId });
        } catch (e) {
          console.warn('[input-center] 建立銀行交易失敗：', e);
          // 🆕 P2-11：回滾孤兒交易
          if (txnId) {
            try {
              await removeBankTransaction(data.bankId, txnId);
            } catch (rollbackErr) {
              console.warn('[input-center] 回滾交易失敗：', rollbackErr);
            }
          }
          showToast('支出已新增，但銀行交易建立失敗（已回滾）', 'warning');
        }
      }

      showToast('✅ 已新增支出', 'success');
      closeModal(MODAL_ID);
      _refreshCurrentTab();
    },
    onCancel: () => closeModal(MODAL_ID),
  });

  formApi.onFieldChange('category', async () => {
    const catId = formApi.getFieldValue('category');
    const items = await _getItemsByCategory(catId);
    formApi.updateOptions('item', items, {
      includeEmpty: true,
      emptyText: catId ? '— 請選擇項目 —' : '— 請先選擇類別 —',
    });
  });

  const unsubCat = listenCategories((list) => {
    formApi.updateOptions('category', list.map((c) => ({ value: c.id, label: c.name })), {
      includeEmpty: true,
      emptyText: '— 請選擇類別 —',
    });
  });
  _modalListenerCleanups.push(unsubCat);

  const unsubPay = listenPaymentMethods((list) => {
    formApi.updateOptions('payment', list.map((p) => ({ value: p.id, label: p.name })), {
      includeEmpty: true,
      emptyText: '— 請選擇 —',
    });
  });
  _modalListenerCleanups.push(unsubPay);

  const unsubBank = listenBankAccounts((list) => {
    formApi.updateOptions('bankId', list.map((b) => ({ value: b.id, label: b.name })), {
      includeEmpty: true,
      emptyText: '— 不關聯銀行 —',
    });
  });
  _modalListenerCleanups.push(unsubBank);

  openModal(MODAL_ID);
  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   家用轉入 Modal（🆕 P2-10：改走 bank-helpers）
   ============================================ */
async function _openAddContributionModal() {
  if (!AppState.getCanInput()) return;

  _cleanupModalListeners();

  const MODAL_ID = 'ic-add-contribution-modal';
  _destroyModal(MODAL_ID);

  const ym = AppState.getYearMonth();
  const curMonth = ym.month === 'all' ? '01' : (ym.month || '01');

  const members = await getMembersOnce();
  const sortedMembers = sortMembersLocal(members);

  _createModal(MODAL_ID, '家用轉入');

  const formApi = buildForm({
    containerId: `${MODAL_ID}-form-root`,
    fields: [
      { type: 'select', id: 'year',  label: '所屬年份', required: true, includeEmpty: false, options: _yearOptions(), defaultValue: ym.year || String(new Date().getFullYear()) },
      { type: 'select', id: 'month', label: '所屬月份', required: true, includeEmpty: false, options: _monthOptions(), defaultValue: curMonth },
      { type: 'select', id: 'member', label: '轉入成員', required: true, includeEmpty: true, emptyText: '— 請選擇成員 —', options: sortedMembers.map((m) => ({ value: m.id, label: m.name })) },
      { type: 'number', id: 'amount', label: '轉入金額（HK$）', required: true, min: 0, step: 1, placeholder: '0' },
      { type: 'select', id: 'bankId', label: '轉入銀行', required: true, includeEmpty: true, emptyText: '— 請選擇銀行 —' },
      { type: 'text', id: 'note', label: '備註（可選）', maxlength: 60 },
    ],
    submitText: '確認轉入',
    showCancel: true,
    cancelText: '取消',
    onSubmit: async (data) => {
      const amount = Number(data.amount) || 0;
      if (amount <= 0) {
        showToast('金額必須大於 0', 'warning');
        return;
      }

      const year = String(data.year);
      const month = String(data.month);
      const memberId = data.member;

      // 1. 寫入 income/{year}/{month}/{memberId}
      await saveIncome(year, month, { [memberId]: amount });

      // 2. 🆕 P2-10：改走 bank-helpers 的 createTransactionForContribution
      try {
        await createTransactionForContribution({
          bankId: data.bankId,
          memberId,
          amount,
          date: `${year}-${month}-01`,
          note: data.note || '家用轉入',
        });
      } catch (e) {
        console.warn('[input-center] 建立銀行交易失敗：', e);
        showToast('家用轉入已記錄，但銀行交易建立失敗', 'warning');
      }

      showToast(`✅ 已記錄 ${year}-${month} 家用轉入`, 'success');
      closeModal(MODAL_ID);
      _refreshCurrentTab();
    },
    onCancel: () => closeModal(MODAL_ID),
  });

  const unsubBank = listenBankAccounts((list) => {
    formApi.updateOptions('bankId', list.map((b) => ({ value: b.id, label: b.name })), {
      includeEmpty: true,
      emptyText: '— 請選擇銀行 —',
    });
  });
  _modalListenerCleanups.push(unsubBank);

  openModal(MODAL_ID);
  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   個人收入 Modal
   ============================================ */
async function _openAddPersonalIncomeModal() {
  if (!AppState.getCanInput()) return;

  _cleanupModalListeners();

  const MODAL_ID = 'ic-add-personal-income-modal';
  _destroyModal(MODAL_ID);

  const ym = AppState.getYearMonth();
  const curMonth = ym.month === 'all' ? '01' : (ym.month || '01');

  const members = await getMembersOnce();
  const sortedMembers = sortMembersLocal(members);
  const currentMemberId = AppState.getCurrentMemberId();
  const isOwner = AppState.getRole() === 'owner' || AppState.isSuperAdmin;

  const memberOptions = isOwner
    ? sortedMembers.map((m) => ({ value: m.id, label: m.name }))
    : sortedMembers.filter((m) => m.id === currentMemberId).map((m) => ({ value: m.id, label: m.name }));

  if (memberOptions.length === 0) {
    showToast('找不到您的成員身份，請聯繫管理員', 'error');
    return;
  }

  _createModal(MODAL_ID, '個人收入');
  const formApi = buildForm({
    containerId: `${MODAL_ID}-form-root`,
    fields: [
      { type: 'select', id: 'year',  label: '所屬年份', required: true, includeEmpty: false, options: _yearOptions(), defaultValue: ym.year || String(new Date().getFullYear()) },
      { type: 'select', id: 'month', label: '所屬月份', required: true, includeEmpty: false, options: _monthOptions(), defaultValue: curMonth },
      {
        type: 'select', id: 'memberId', label: '成員', required: true, includeEmpty: false,
        options: memberOptions,
        disabled: !isOwner,
        hint: isOwner ? '' : '（僅能輸入自己的個人收入）',
      },
      { type: 'number', id: 'amount', label: '金額（HK$）', required: true, min: 0, step: 1, placeholder: '0' },
    ],
    submitText: '儲存',
    showCancel: true,
    cancelText: '取消',
    onSubmit: async (data) => {
      const amount = Number(data.amount) || 0;
      if (amount <= 0) {
        showToast('金額必須大於 0', 'warning');
        return;
      }

      try {
        await savePersonalIncome(data.memberId, data.year, data.month, amount);
        showToast(`✅ 已記錄 ${data.year}-${data.month} 個人收入`, 'success');
        closeModal(MODAL_ID);
        _refreshCurrentTab();
      } catch (e) {
        showToast('儲存失敗：' + e.message, 'error');
      }
    },
    onCancel: () => closeModal(MODAL_ID),
  });

  openModal(MODAL_ID);
  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   手動銀行交易 Modal
   -------------------------------------------------
   manual 交易為純手動無業務邏輯（無 refId / 無來源），
   直接呼叫 api.bankTransactions.create。
   ============================================ */
async function _openManualBankTxnModal(type) {
  if (!AppState.getCanInput()) return;

  _cleanupModalListeners();

  const MODAL_ID = 'ic-add-manual-txn-modal';
  _destroyModal(MODAL_ID);

  _createModal(MODAL_ID, type === 'in' ? '手動入帳' : '手動出帳');

  const formApi = buildForm({
    containerId: `${MODAL_ID}-form-root`,
    fields: [
      { type: 'select', id: 'bankId', label: '銀行', required: true, includeEmpty: true, emptyText: '— 請選擇銀行 —' },
      { type: 'number', id: 'amount', label: '金額（HK$）', required: true, min: 0, step: 1, placeholder: '0' },
      { type: 'text', id: 'date', label: '日期', required: true, placeholder: 'YYYY-MM-DD', maxlength: 10, defaultValue: todayISO() },
      { type: 'text', id: 'note', label: '備註', maxlength: 60, placeholder: '例如：利息、手續費' },
    ],
    submitText: '新增',
    showCancel: true,
    cancelText: '取消',
    onSubmit: async (data) => {
      const amount = Number(data.amount) || 0;
      if (amount <= 0) {
        showToast('金額必須大於 0', 'warning');
        return;
      }

      try {
        await api.bankTransactions.create(data.bankId, {
          type,
          category: 'manual',
          amount,
          date: data.date,
          note: data.note || '',
        });
        showToast(`✅ 已新增${type === 'in' ? '入帳' : '出帳'}`, 'success');
        closeModal(MODAL_ID);
        _refreshCurrentTab();
      } catch (e) {
        showToast('新增失敗：' + e.message, 'error');
      }
    },
    onCancel: () => closeModal(MODAL_ID),
  });

  const unsubBank = listenBankAccounts((list) => {
    formApi.updateOptions('bankId', list.map((b) => ({ value: b.id, label: b.name })), {
      includeEmpty: true,
      emptyText: '— 請選擇銀行 —',
    });
  });
  _modalListenerCleanups.push(unsubBank);

  openModal(MODAL_ID);
  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   項目查詢
   ============================================ */
async function _getItemsByCategory(categoryId) {
  const items = await getItemsOnce();
  const filtered = categoryId
    ? items.filter((i) => i.categoryId === categoryId)
    : items;
  return filtered.map((i) => ({ value: i.id, label: i.name }));
}

async function _getItemName(itemId) {
  if (!itemId) return '';
  const items = await getItemsOnce();
  const found = items.find((i) => i.id === itemId);
  return found ? found.name : '';
}

/* ============================================
   Modal 輔助
   ============================================ */
function _createModal(modalId, title) {
  _destroyModal(modalId);

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = modalId;
  overlay.innerHTML = `
    <div class="modal" style="max-width:560px; max-height:90vh; overflow-y:auto;">
      <h2 class="modal-title">${escapeHtml(title)}</h2>
      <div id="${modalId}-form-root"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(modalId);
  });

  return overlay;
}

function _destroyModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.remove();
}

/* ============================================
   年份 / 月份選項
   ============================================ */
function _yearOptions() {
  const years = getYearList();
  return years.map((y) => ({ value: String(y), label: `${y} 年` }));
}

function _monthOptions() {
  const opts = [];
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    opts.push({ value: mm, label: `${m} 月` });
  }
  return opts;
}

function sortMembersLocal(members) {
  return [...(members || [])].sort((a, b) => {
    const oa = a.order != null ? a.order : Number.MAX_SAFE_INTEGER;
    const ob = b.order != null ? b.order : Number.MAX_SAFE_INTEGER;
    if (oa !== ob) return oa - ob;
    return (a.createdAt || 0) - (b.createdAt || 0);
  });
}

/* ============================================
   刷新當前 Tab
   ============================================ */
function _refreshCurrentTab() {
  const key = _tabPanel?.getCurrent();
  if (key && _tabInstances[key]) {
    try { _tabInstances[key].refresh?.(); } catch (e) { /* noop */ }
  }
}

/* ============================================
   銷毀
   ============================================ */
function _destroy() {
  Object.entries(_tabInstances).forEach(([key, instance]) => {
    if (!instance) return;
    try { instance.destroy?.(); } catch (e) { /* noop */ }
  });
  _tabInstances = { expense: null, insurance: null, fund: null, bank: null };

  if (_tabPanel) {
    try { _tabPanel.destroy(); } catch (e) { /* noop */ }
    _tabPanel = null;
  }

  _cleanupModalListeners();

  if (_bankTxnOutsideHandler) {
    document.removeEventListener('click', _bankTxnOutsideHandler);
    _bankTxnOutsideHandler = null;
  }

  const btnRoot = document.getElementById('ic-buttons-root');
  if (btnRoot) {
    const newRoot = btnRoot.cloneNode(false);
    btnRoot.parentNode?.replaceChild(newRoot, btnRoot);
  }

  _destroyModal('ic-add-expense-modal');
  _destroyModal('ic-add-contribution-modal');
  _destroyModal('ic-add-personal-income-modal');
  _destroyModal('ic-add-manual-txn-modal');

  _container = null;
}
