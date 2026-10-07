// ============================================
// index.js — 綜合輸入中心入口（v101.6）
// 位置：js/pages/input-center/index.js
// ============================================
// v101.6 重寫：
//   ✅ 上方 5 個新增按鈕（支出 / 收入 / 保單 / 基金 / 銀行結餘）
//   ✅ 下方兩區塊：最近 20 筆 + 保單/基金/銀行（全部）
//   ✅ 廢除 Tab 切換
//   ✅ 新增「複製上月支出」功能
//   ✅ 使用 buildForm 動態建立 Modal
// ============================================

import { AppState } from '../../core/state.js';
import {
  addExpense, saveIncome, saveBankBalance,
  getMembersOnce, getAllMemberExpensesOnce,
  getIncomeOnce,
} from '../../core/db.js';
import {
  getStatusesByCategory, getDefaultStatus,
} from '../../config/app-config.js';
import {
  escapeHtml, formatHKD, todayISO, sortMembers, setText,
} from '../../core/utils.js';
import { buildForm } from '../../shared/form-builder.js';
import { openModal, closeModal, openConfirm } from '../../shared/modal.js';
import { showToast } from '../../shared/toast.js';
import { openEntityModal } from '../../shared/entity-modal.js';
import { fillYearSelect, fillMonthSelect } from '../../shared/date-helpers.js';
import {
  fillMemberSelect, fillCategorySelect, fillItemSelect,
  fillPaymentSelect, fillStatusSelect, fillBankSelect,
} from '../../shared/select-helpers.js';
import { RESERVED_IDS, ENTITY_KEYS } from '../../config/constants.js';
import { registerPageCleanup } from '../../core/app.js';

/* ============================================
   Module 狀態
   ============================================ */
let _container = null;
let _recentInstance = null;
let _holdingsInstance = null;

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

  // 動態載入子模組
  await _loadSubModules();

  registerPageCleanup(_destroy);

  return { destroy: _destroy };
}

/* ============================================
   骨架
   ============================================ */
function _renderSkeleton() {
  _container.innerHTML = `
    <!-- 按鈕列 -->
    <div class="flex flex-wrap gap-8 mb-20" id="ic-buttons-root">
      <button class="btn btn-primary" data-action="add-expense">
        <i data-lucide="plus"></i> 新增支出
      </button>
      <button class="btn btn-primary" data-action="add-income">
        <i data-lucide="plus"></i> 新增收入
      </button>
      <button class="btn btn-primary" data-action="add-policy">
        <i data-lucide="plus"></i> 新增保單
      </button>
      <button class="btn btn-primary" data-action="add-fund">
        <i data-lucide="plus"></i> 新增基金
      </button>
      <button class="btn btn-primary" data-action="add-bank-balance">
        <i data-lucide="plus"></i> 新增銀行結餘
      </button>
    </div>

    <!-- 最近 20 筆 -->
    <div class="glass-card collapsible-card collapsible-card-flat" style="padding:0; margin-bottom:20px;">
      <div class="collapsible-header">
        <div class="collapsible-header-title">
          <i data-lucide="clock" style="width:16px;height:16px;"></i>
          <span>最近新增（支出 / 收入）</span>
        </div>
      </div>
      <div class="collapsible-body" style="display:block;">
        <div id="ic-recent-root"></div>
      </div>
    </div>

    <!-- 保單 / 基金 / 銀行（全部） -->
    <div class="glass-card collapsible-card collapsible-card-flat" style="padding:0;">
      <div class="collapsible-header">
        <div class="collapsible-header-title">
          <i data-lucide="briefcase" style="width:16px;height:16px;"></i>
          <span>保單 / 基金 / 銀行</span>
        </div>
      </div>
      <div class="collapsible-body" style="display:block;">
        <div id="ic-holdings-root"></div>
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   按鈕綁定
   ============================================ */
function _bindButtons() {
  const root = document.getElementById('ic-buttons-root');
  if (!root) return;

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
   新增支出 Modal
   ============================================ */
async function _openAddExpenseModal() {
  const MODAL_ID = 'ic-add-expense-modal';
  _destroyModal(MODAL_ID);

  const ym = AppState.getYearMonth();
  const curYear = ym.year || String(new Date().getFullYear());
  const curMonth = ym.month === 'all' ? '01' : (ym.month || '01');

  // 準備資料
  const [members, statusList] = await Promise.all([
    getMembersOnce(),
    Promise.resolve(getStatusesByCategory('personal')),
  ]);

  const memberOptions = [
    ...sortMembers(members).map((m) => ({ value: m.id, label: m.name })),
    { value: RESERVED_IDS.SHARED_MEMBER, label: '家庭共用' },
  ];
  const defaultStatus = getDefaultStatus('personal');

  // 建立 Modal
  const overlay = _createModal(MODAL_ID, '新增支出');
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
      { type: 'select', id: 'status', label: '狀態', includeEmpty: false, options: statusList.map((s) => ({ value: s.name, label: s.name })), defaultValue: defaultStatus?.name || '未處理' },
    ],
    submitText: '新增支出',
    showCancel: true,
    cancelText: '取消',
    onSubmit: async (data) => {
      const itemId = data.item;
      // 查 item 名稱
      const { listenItems } = await import('../../core/db.js');
      const { getItemsOnce } = await import('../../core/db.js').catch(() => ({ getItemsOnce: null }));
      // 從 items 快取取名稱
      const itemName = await _getItemName(itemId);

      await addExpense(data.year, data.month, data.member, {
        name: itemName || '（未命名）',
        amount: Number(data.amount) || 0,
        status: data.status,
        date: data.date || todayISO(),
        categoryId: data.category,
        itemId,
        paymentMethodId: data.payment || '',
      });
      showToast('✅ 已新增支出', 'success');
      closeModal(MODAL_ID);
      _refreshAll();
    },
    onCancel: () => closeModal(MODAL_ID),
  });

  // 類別 → 項目連動
  formApi.onFieldChange('category', async () => {
    const catId = formApi.getFieldValue('category');
    const items = await _getItemsByCategory(catId);
    formApi.updateOptions('item', items, {
      includeEmpty: true,
      emptyText: catId ? '— 請選擇項目 —' : '— 請先選擇類別 —',
    });
  });

  // 載入類別 / 支付方式
  _populateExpenseForm(formApi);

  // 底部「複製上月支出」按鈕
  const copyBtnWrapper = document.createElement('div');
  copyBtnWrapper.style.cssText = 'margin-top:12px; padding-top:12px; border-top:1px dashed rgba(255,255,255,0.08); text-align:right;';
  copyBtnWrapper.innerHTML = `
    <button class="btn btn-ghost btn-sm" id="${MODAL_ID}-copy-btn">
      <i data-lucide="copy" style="width:14px;height:14px;"></i>
      複製上月支出
    </button>
  `;
  overlay.querySelector('.modal').appendChild(copyBtnWrapper);

  document.getElementById(`${MODAL_ID}-copy-btn`)?.addEventListener('click', () => {
    const targetYear = formApi.getFieldValue('year');
    const targetMonth = formApi.getFieldValue('month');
    _openCopyLastMonthModal(targetYear, targetMonth);
  });

  openModal(MODAL_ID);
  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   新增收入 Modal
   ============================================ */
async function _openAddIncomeModal() {
  const MODAL_ID = 'ic-add-income-modal';
  _destroyModal(MODAL_ID);

  const ym = AppState.getYearMonth();
  const curYear = ym.year || String(new Date().getFullYear());
  const curMonth = ym.month === 'all' ? '01' : (ym.month || '01');

  const members = await getMembersOnce();
  const sortedMembers = sortMembers(members);

  // 動態欄位：每個成員一個 number
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

  const overlay = _createModal(MODAL_ID, '新增收入');
  const formApi = buildForm({
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
      _refreshAll();
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
  const MODAL_ID = 'ic-add-bank-modal';
  _destroyModal(MODAL_ID);

  const ym = AppState.getYearMonth();
  const curYear = ym.year || String(new Date().getFullYear());
  const curMonth = ym.month === 'all' ? '01' : (ym.month || '01');

  const overlay = _createModal(MODAL_ID, '新增銀行結餘');
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
      _refreshAll();
    },
    onCancel: () => closeModal(MODAL_ID),
  });

  // 載入銀行清單
  const { listenBanks } = await import('../../core/db.js');
  const unsub = listenBanks((list) => {
    const options = list.map((b) => ({ value: b.id, label: b.name }));
    formApi.updateOptions('bank', options, {
      includeEmpty: true,
      emptyText: '— 請選擇銀行 —',
    });
  });

  // 監聽清除
  const origDestroy = formApi.destroy;
  formApi.destroy = () => {
    try { unsub(); } catch (e) { /* noop */ }
    origDestroy();
  };

  openModal(MODAL_ID);
  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   複製上月支出 Modal
   ============================================ */
async function _openCopyLastMonthModal(targetYear, targetMonth) {
  const MODAL_ID = 'ic-copy-last-month-modal';
  _destroyModal(MODAL_ID);

  // 計算上月
  const y = Number(targetYear);
  const m = Number(targetMonth);
  let prevY = y;
  let prevM = m - 1;
  if (prevM < 1) { prevY = y - 1; prevM = 12; }
  const prevMonthStr = String(prevM).padStart(2, '0');

  // 讀取上月支出
  const allExpenses = await getAllMemberExpensesOnce(prevY, prevMonthStr);
  const filtered = allExpenses.filter((e) => !e.isAutoLinked);

  if (filtered.length === 0) {
    showToast(`${prevY} 年 ${prevMonthStr} 月沒有可複製的支出`, 'info');
    return;
  }

  // 取得成員名稱
  const members = await getMembersOnce();
  const memberMap = {};
  members.forEach((mm) => { memberMap[mm.id] = mm.name; });

  // 建立 Modal
  const overlay = _createModal(MODAL_ID, `複製 ${prevY}-${prevMonthStr} 支出`);
  const modalEl = overlay.querySelector('.modal');
  modalEl.innerHTML = `
    <h2 class="modal-title">複製 ${prevY} 年 ${prevMonthStr} 月支出</h2>
    <p style="font-size:12px; color:var(--text-muted); margin-bottom:12px;">
      勾選要複製到 ${targetYear} 年 ${targetMonth} 月的支出項目
    </p>
    <div style="max-height:50vh; overflow-y:auto; margin-bottom:16px;">
      <div style="display:flex; justify-content:flex-end; margin-bottom:8px;">
        <button type="button" class="btn btn-sm btn-ghost" id="${MODAL_ID}-toggle-all">
          全選 / 全不選
        </button>
      </div>
      ${filtered.map((e, i) => `
        <label style="display:flex; align-items:center; gap:10px; padding:8px; border-bottom:1px solid rgba(255,255,255,0.05); cursor:pointer;">
          <input type="checkbox" data-index="${i}" checked style="width:auto; cursor:pointer;">
          <div style="flex:1; min-width:0;">
            <div style="font-weight:500; font-size:13px;">${escapeHtml(e.name || '（未命名）')}</div>
            <div style="font-size:11px; color:var(--text-muted);">
              ${escapeHtml(memberMap[e.memberId] || e.memberId || '（未知）')}
              ${e.date ? ' · ' + escapeHtml(e.date) : ''}
            </div>
          </div>
          <div class="mono text-emerald" style="font-weight:600; font-size:13px;">
            ${formatHKD(e.amount)}
          </div>
        </label>
      `).join('')}
    </div>
    <div class="modal-actions">
      <button type="button" class="btn btn-ghost" id="${MODAL_ID}-cancel">取消</button>
      <button type="button" class="btn btn-primary" id="${MODAL_ID}-confirm">
        <i data-lucide="copy"></i> 複製
      </button>
    </div>
  `;

  const toggleBtn = document.getElementById(`${MODAL_ID}-toggle-all`);
  toggleBtn?.addEventListener('click', () => {
    const checkboxes = modalEl.querySelectorAll('input[type="checkbox"]');
    const allChecked = [...checkboxes].every((c) => c.checked);
    checkboxes.forEach((c) => { c.checked = !allChecked; });
  });

  document.getElementById(`${MODAL_ID}-cancel`)?.addEventListener('click', () => {
    closeModal(MODAL_ID);
  });

  document.getElementById(`${MODAL_ID}-confirm`)?.addEventListener('click', async () => {
    const checkboxes = modalEl.querySelectorAll('input[type="checkbox"]');
    const selected = [];
    checkboxes.forEach((c) => {
      if (c.checked) {
        const idx = Number(c.dataset.index);
        selected.push(filtered[idx]);
      }
    });

    if (selected.length === 0) {
      showToast('請至少勾選一個項目', 'warning');
      return;
    }

    const ok = await openConfirm(`確定要複製 ${selected.length} 筆支出到 ${targetYear}-${targetMonth} 嗎？`, {
      title: '複製支出',
      okText: '複製',
      okClass: 'btn-primary',
    });
    if (!ok) return;

    let successCount = 0;
    for (const e of selected) {
      try {
        await addExpense(targetYear, targetMonth, e.memberId, {
          name: e.name,
          amount: Number(e.amount) || 0,
          status: e.status || '未處理',
          date: todayISO(),
          categoryId: e.categoryId || '',
          itemId: e.itemId || '',
          paymentMethodId: e.paymentMethodId || '',
        });
        successCount++;
      } catch (err) {
        console.error(`[copy-last-month] 複製失敗：`, err);
      }
    }

    showToast(`✅ 已複製 ${successCount} 筆支出`, 'success');
    closeModal(MODAL_ID);
    _refreshAll();
  });

  openModal(MODAL_ID);
  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   載入子模組
   ============================================ */
async function _loadSubModules() {
  try {
    const [recentMod, holdingsMod] = await Promise.all([
      import('./recent-list.js'),
      import('./holdings-list.js'),
    ]);

    _recentInstance = recentMod.initRecentList('ic-recent-root', {
      onRefresh: () => _refreshAll(),
    });
    _holdingsInstance = holdingsMod.initHoldingsList('ic-holdings-root', {
      onRefresh: () => _refreshAll(),
    });
  } catch (err) {
    console.error('[input-center] 載入子模組失敗：', err);
  }
}

/* ============================================
   刷新全部
   ============================================ */
function _refreshAll() {
  if (_recentInstance) {
    try { _recentInstance.refresh(); } catch (e) { /* noop */ }
  }
  if (_holdingsInstance) {
    try { _holdingsInstance.refresh(); } catch (e) { /* noop */ }
  }
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
  const { listenItems } = await import('../../core/db.js');
  // 用一次性方式讀取
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

/* ============================================
   銷毀
   ============================================ */
function _destroy() {
  // 銷毀子模組
  if (_recentInstance) {
    try { _recentInstance.destroy(); } catch (e) { /* noop */ }
    _recentInstance = null;
  }
  if (_holdingsInstance) {
    try { _holdingsInstance.destroy(); } catch (e) { /* noop */ }
    _holdingsInstance = null;
  }

  // 移除所有 Modal
  _destroyModal('ic-add-expense-modal');
  _destroyModal('ic-add-income-modal');
  _destroyModal('ic-add-bank-modal');
  _destroyModal('ic-copy-last-month-modal');

  // 清空 items 快取
  _itemsCache = null;
  _itemsCacheTime = 0;

  _container = null;
}