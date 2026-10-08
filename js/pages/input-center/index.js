// ============================================
// index.js — 綜合輸入中心入口（v101.8.0）
// 位置：js/pages/input-center/index.js
// ============================================
// v101.8.0 修正：
//   ✅ 依 AppState.canInput 隱藏上方 5 個按鈕
//   ✅ 唯讀模式下顯示提示 banner
//   ✅ 保留 v101.6.4 全部功能（4 Tab / lazy load）
// ============================================

import { initTabPanel } from '../../shared/tab-panel.js';
import { showToast } from '../../shared/toast.js';
import { openEntityModal } from '../../shared/entity-modal.js';
import { ENTITY_KEYS, RESERVED_IDS } from '../../config/constants.js';
import { AppState } from '../../core/state.js';
import {
  addExpense, saveIncome, saveBankBalance,
  getMembersOnce, getAllMemberExpensesOnce,
  getIncomeOnce,
} from '../../core/db.js';
import { getStatusesByCategory, getDefaultStatus } from '../../config/app-config.js';
import { escapeHtml, formatHKD, todayISO } from '../../core/utils.js';
import { buildForm } from '../../shared/form-builder.js';
import { openModal, closeModal, openConfirm } from '../../shared/modal.js';
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
  // 🆕 v101.8.0：依 canInput 決定是否顯示新增按鈕
  const userCanInput = AppState.getCanInput();

  const buttonsHtml = userCanInput ? `
    <div class="flex flex-wrap gap-8 mb-20" id="ic-buttons-root">
      <button type="button" class="btn btn-primary" data-action="add-expense">
        <i data-lucide="plus"></i> 新增支出
      </button>
      <button type="button" class="btn btn-primary" data-action="add-income">
        <i data-lucide="plus"></i> 新增收入
      </button>
      <button type="button" class="btn btn-primary" data-action="add-policy">
        <i data-lucide="plus"></i> 新增保單
      </button>
      <button type="button" class="btn btn-primary" data-action="add-fund">
        <i data-lucide="plus"></i> 新增基金
      </button>
      <button type="button" class="btn btn-primary" data-action="add-bank-balance">
        <i data-lucide="plus"></i> 新增銀行結餘
      </button>
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
  if (!root) return;   // 唯讀模式無此容器

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    switch (action) {
      case 'add-expense':
        _openAddExpenseModal();
        break;
      case 'add-income':
        _openAddIncomeModal();
        break;
      case 'add-policy':
        openEntityModal({ entity: ENTITY_KEYS.POLICY, mode: 'add' });
        break;
      case 'add-fund':
        openEntityModal({ entity: ENTITY_KEYS.FUND, mode: 'add' });
        break;
      case 'add-bank-balance':
        _openAddBankBalanceModal();
        break;
    }
  });
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
   新增支出 Modal
   ============================================ */
async function _openAddExpenseModal() {
  if (!AppState.getCanInput()) return;

  const MODAL_ID = 'ic-add-expense-modal';
  _destroyModal(MODAL_ID);

  const ym = AppState.getYearMonth();
  const curYear = ym.year || String(new Date().getFullYear());
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
      { type: 'select', id: 'year',   label: '所屬年份', required: true, includeEmpty: false, options: _yearOptions(curYear), defaultValue: curYear },
      { type: 'select', id: 'month',  label: '所屬月份', required: true, includeEmpty: false, options: _monthOptions(), defaultValue: curMonth },
      { type: 'select', id: 'member', label: '支出成員', required: true, includeEmpty: true, emptyText: '— 請選擇 —', options: memberOptions },
      { type: 'text',   id: 'date',   label: '支出日期', placeholder: 'YYYY-MM-DD', maxlength: 10, defaultValue: todayISO() },
      { type: 'select', id: 'category', label: '支出類別', required: true, includeEmpty: true, emptyText: '— 請選擇類別 —' },
      { type: 'select', id: 'item', label: '項目', required: true, includeEmpty: true, emptyText: '— 請先選擇類別 —' },
      { type: 'number', id: 'amount', label: '費用（HK$）', required: true, min: 0, step: 1, placeholder: '0' },
      { type: 'select', id: 'payment', label: '支付方式', includeEmpty: true, emptyText: '— 請選擇 —' },
      { type: 'select', id: 'status', label: '狀態', includeEmpty: false,
        options: statusList.map((s) => ({ value: s.name, label: s.name })),
        defaultValue: defaultStatus?.name || '未處理' },
    ],
    submitText: '新增支出',
    showCancel: true,
    cancelText: '取消',
    onSubmit: async (data) => {
      const itemName = await _getItemName(data.item);
      await addExpense(data.year, data.month, data.member, {
        name: itemName || '（未命名）',
        amount: Number(data.amount) || 0,
        status: data.status,
        date: data.date || todayISO(),
        categoryId: data.category,
        itemId: data.item,
        paymentMethodId: data.payment || '',
      });
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

  _populateExpenseForm(formApi);

  openModal(MODAL_ID);
  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   新增收入 Modal
   ============================================ */
async function _openAddIncomeModal() {
  if (!AppState.getCanInput()) return;

  const MODAL_ID = 'ic-add-income-modal';
  _destroyModal(MODAL_ID);

  const ym = AppState.getYearMonth();
  const curYear = ym.year || String(new Date().getFullYear());
  const curMonth = ym.month === 'all' ? '01' : (ym.month || '01');

  const members = await getMembersOnce();
  const sortedMembers = sortMembersLocal(members);

  const fields = [
    { type: 'select', id: 'year',  label: '所屬年份', required: true, includeEmpty: false, options: _yearOptions(curYear), defaultValue: curYear },
    { type: 'select', id: 'month', label: '所屬月份', required: true, includeEmpty: false, options: _monthOptions(), defaultValue: curMonth },
  ];
  sortedMembers.forEach((m) => {
    fields.push({
      type: 'number',
      id: `member_${m.id}`,
      label: m.name,
      min: 0,
      step: 1,
      placeholder: '0',
    });
  });
  fields.push({
    type: 'number',
    id: 'extra',
    label: '額外收入（HK$）',
    min: 0,
    step: 1,
    placeholder: '0',
  });

  _createModal(MODAL_ID, '新增收入');
  buildForm({
    containerId: `${MODAL_ID}-form-root`,
    fields,
    submitText: '儲存收入',
    showCancel: true,
    cancelText: '取消',
    onSubmit: async (data) => {
      const payload = {};
      sortedMembers.forEach((m) => {
        const val = Number(data[`member_${m.id}`]) || 0;
        if (val > 0) payload[m.id] = val;
      });
      const extra = Number(data.extra) || 0;
      if (extra > 0) payload[RESERVED_IDS.EXTRA_INCOME] = extra;

      await saveIncome(data.year, data.month, payload);
      showToast(`✅ 已儲存 ${data.year} 年 ${data.month} 月收入`, 'success');
      closeModal(MODAL_ID);
      _refreshCurrentTab();
    },
    onCancel: () => closeModal(MODAL_ID),
  });

  openModal(MODAL_ID);
  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   新增銀行結餘 Modal
   ============================================ */
async function _openAddBankBalanceModal() {
  if (!AppState.getCanInput()) return;

  const MODAL_ID = 'ic-add-bank-modal';
  _destroyModal(MODAL_ID);

  const ym = AppState.getYearMonth();
  const curYear = ym.year || String(new Date().getFullYear());
  const curMonth = ym.month === 'all' ? '01' : (ym.month || '01');

  _createModal(MODAL_ID, '新增銀行結餘');
  const formApi = buildForm({
    containerId: `${MODAL_ID}-form-root`,
    fields: [
      { type: 'select', id: 'year',  label: '所屬年份', required: true, includeEmpty: false, options: _yearOptions(curYear), defaultValue: curYear },
      { type: 'select', id: 'month', label: '所屬月份', required: true, includeEmpty: false, options: _monthOptions(), defaultValue: curMonth },
      { type: 'select', id: 'bank',  label: '銀行', required: true, includeEmpty: true, emptyText: '— 請選擇銀行 —' },
      { type: 'number', id: 'amount', label: '結餘金額（HK$）', required: true, min: 0, step: 1, placeholder: '0' },
    ],
    submitText: '儲存結餘',
    showCancel: true,
    cancelText: '取消',
    onSubmit: async (data) => {
      await saveBankBalance(data.year, data.month, data.bank, Number(data.amount) || 0);
      showToast(`✅ 已儲存 ${data.year} 年 ${data.month} 月結餘`, 'success');
      closeModal(MODAL_ID);
      _refreshCurrentTab();
    },
    onCancel: () => closeModal(MODAL_ID),
  });

  const { listenBanks } = await import('../../core/db.js');
  const unsub = listenBanks((list) => {
    const options = list.map((b) => ({ value: b.id, label: b.name }));
    formApi.updateOptions('bank', options, {
      includeEmpty: true,
      emptyText: '— 請選擇銀行 —',
    });
  });

  const origDestroy = formApi.destroy;
  formApi.destroy = () => {
    try { unsub(); } catch (e) { /* noop */ }
    origDestroy();
  };

  openModal(MODAL_ID);
  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   表單填充輔助
   ============================================ */
async function _populateExpenseForm(formApi) {
  const { listenCategories, listenPaymentMethods } = await import('../../core/db.js');

  const unsubCat = listenCategories((list) => {
    formApi.updateOptions('category', list.map((c) => ({ value: c.id, label: c.name })), {
      includeEmpty: true,
      emptyText: '— 請選擇類別 —',
    });
  });

  const unsubPay = listenPaymentMethods((list) => {
    formApi.updateOptions('payment', list.map((p) => ({ value: p.id, label: p.name })), {
      includeEmpty: true,
      emptyText: '— 請選擇 —',
    });
  });

  const origDestroy = formApi.destroy;
  formApi.destroy = () => {
    try { unsubCat(); } catch (e) { /* noop */ }
    try { unsubPay(); } catch (e) { /* noop */ }
    origDestroy();
  };
}

async function _getItemsByCategory(categoryId) {
  const items = await _getItemsOnce();
  const filtered = categoryId
    ? items.filter((i) => i.categoryId === categoryId)
    : items;
  return filtered.map((i) => ({ value: i.id, label: i.name }));
}

async function _getItemName(itemId) {
  if (!itemId) return '';
  const items = await _getItemsOnce();
  const found = items.find((i) => i.id === itemId);
  return found ? found.name : '';
}

let _itemsCache = null;
let _itemsCacheTime = 0;

async function _getItemsOnce() {
  const now = Date.now();
  if (_itemsCache && (now - _itemsCacheTime < 5000)) {
    return _itemsCache;
  }
  const { get } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js');
  const { familyRef } = await import('../../core/db.js');
  const snap = await get(familyRef('expense_items'));
  const val = snap.val() || {};
  _itemsCache = Object.entries(val).map(([id, x]) => ({ id, ...x }));
  _itemsCacheTime = now;
  return _itemsCache;
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
function _yearOptions(currentYear) {
  const cur = Number(currentYear) || new Date().getFullYear();
  const opts = [];
  for (let i = -3; i <= 3; i++) {
    const y = cur + i;
    opts.push({ value: String(y), label: `${y} 年` });
  }
  return opts;
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

  _destroyModal('ic-add-expense-modal');
  _destroyModal('ic-add-income-modal');
  _destroyModal('ic-add-bank-modal');

  _itemsCache = null;
  _itemsCacheTime = 0;
  _container = null;
}