// ============================================
// input-center.js — 綜合輸入中心（v103.0.0 修正版）
// 位置：js/pages/input-center.js
// ============================================
// v103.0.0 修正：
//   ✅ 補回 6 個按鈕（新增支出 / 家用轉入 / 個人收入 / 保單 / 基金 / 銀行交易▼）
//   ✅ 補回銀行交易下拉（手動入帳 / 手動出帳）
//   ✅ 支出 Tab 掛載真實資料（listenAllExpenses + listenAllIncome）
//   ✅ 保險 / 基金 / 銀行 Tab 掛載真實資料
//   ✅ 保留 P2-10 / P2-11 修正（銀行交易 rollback）
// ============================================

import { createPage } from '../engines/page-engine.js';
import { initTabPanel } from '../ui/tab-panel.js';
import { showToast } from '../ui/toast.js';
import { openModal, closeModal } from '../ui/modal.js';
import { buildForm } from '../ui/form-builder.js';
import { openEntityModal } from '../entity/entity-modal.js';
import { getEntityDef } from '../entity/entity-definitions.js';
import { AppState } from '../core/state.js';
import { esc } from '../lib/dom.js';
import { formatHKD } from '../lib/format.js';
import { todayISO } from '../core/utils.js';
import {
  ENTITY_KEYS, RESERVED_IDS,
} from '../config/constants.js';
import { getStatusesByCategory, getDefaultStatus, getYearList } from '../config/app-config.js';
import {
  addExpense, saveIncome, savePersonalIncome,
  getMembersOnce, getItemsOnce, updateExpense, removeBankTransaction,
  listenCategories, listenPaymentMethods, listenBankAccounts,
  listenAllExpenses, listenAllIncome,
  listenInsurancePolicies, listenFunds,
} from '../core/db.js';
import { api } from '../core/api.js';
import {
  createTransactionForExpense,
  createTransactionForContribution,
} from '../lib/bank.js';

export default {
  title: '綜合輸入中心',
  data: {},
  state: { activeTab: 'expense' },
  derived: {},
  blocks: [],

  customMount: (ctx) => {
    const root = document.getElementById('input-center-root');
    if (!root) return { destroy: () => {} };

    /* ============================================
       1. 骨架：按鈕列 + Tab Bar + 4 個 Panel
       ============================================ */
    _renderSkeleton(root);

    /* ============================================
       2. 按鈕綁定
       ============================================ */
    _bindButtons(root);

    /* ============================================
       3. Tab 面板
       ============================================ */
    const tabInstances = {};
    const TABS = [
      { key: 'expense',   label: '支出', icon: 'receipt',    panelId: 'ic-panel-expense' },
      { key: 'insurance', label: '保險', icon: 'shield',     panelId: 'ic-panel-insurance' },
      { key: 'fund',      label: '基金', icon: 'line-chart', panelId: 'ic-panel-fund' },
      { key: 'bank',      label: '銀行', icon: 'landmark',   panelId: 'ic-panel-bank' },
    ];

    const tabPanel = initTabPanel({
      containerId: 'ic-tab-bar-root',
      tabs: TABS,
      defaultKey: 'expense',
      storageKey: 'input-center-tab',
      onChange: (key) => _activateTab(key, tabInstances, TABS),
    });

    /* 初次載入 */
    if (tabPanel) _activateTab(tabPanel.getCurrent(), tabInstances, TABS);

    /* ============================================
       4. 銷毀
       ============================================ */
    return {
      destroy: () => {
        Object.values(tabInstances).forEach((inst) => {
          try { inst?.destroy?.(); } catch (e) { /* noop */ }
        });
        try { tabPanel?.destroy(); } catch (e) { /* noop */ }
        _cleanupDropdown();
        _destroyAllModals();
      },
    };
  },
};

/* ============================================
   骨架
   ============================================ */
function _renderSkeleton(root) {
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

  root.innerHTML = `
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
let _outsideHandler = null;

function _bindButtons(root) {
  const btnRoot = document.getElementById('ic-buttons-root');
  if (!btnRoot) return;

  btnRoot.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    switch (action) {
      case 'add-expense':           _openAddExpenseModal(); break;
      case 'add-contribution':      _openAddContributionModal(); break;
      case 'add-personal-income':   _openAddPersonalIncomeModal(); break;
      case 'add-policy':
        openEntityModal({ entity: ENTITY_KEYS.POLICY, mode: 'add' });
        break;
      case 'add-fund':
        openEntityModal({ entity: ENTITY_KEYS.FUND, mode: 'add' });
        break;
      case 'bank-txn-toggle':       _toggleDropdown(); break;
      case 'add-manual-in':
        _closeDropdown();
        _openManualTxnModal('in');
        break;
      case 'add-manual-out':
        _closeDropdown();
        _openManualTxnModal('out');
        break;
    }
  });

  _outsideHandler = (e) => {
    const dd = document.getElementById('ic-bank-txn-dropdown');
    if (!dd) return;
    if (!dd.contains(e.target)) _closeDropdown();
  };
  document.addEventListener('click', _outsideHandler);
}

function _cleanupDropdown() {
  if (_outsideHandler) {
    document.removeEventListener('click', _outsideHandler);
    _outsideHandler = null;
  }
}

function _toggleDropdown() {
  const menu = document.getElementById('ic-bank-txn-menu');
  if (!menu) return;
  const isOpen = menu.style.display === 'block';
  if (isOpen) _closeDropdown();
  else {
    menu.style.display = 'block';
    if (window.lucide) window.lucide.createIcons();
  }
}

function _closeDropdown() {
  const menu = document.getElementById('ic-bank-txn-menu');
  if (menu) menu.style.display = 'none';
}

/* ============================================
   Tab 啟用（掛載真實資料）
   ============================================ */
function _activateTab(key, instances, tabs) {
  const def = tabs.find((t) => t.key === key);
  if (!def) return;

  if (instances[key]) {
    try { instances[key].refresh?.(); } catch (e) { /* noop */ }
    return;
  }

  const panelEl = document.getElementById(def.panelId);
  if (!panelEl) return;

  if (key === 'expense') {
    instances[key] = _mountExpenseList(panelEl);
  } else if (key === 'insurance') {
    instances[key] = _mountHoldingsList(panelEl, 'policy');
  } else if (key === 'fund') {
    instances[key] = _mountHoldingsList(panelEl, 'fund');
  } else if (key === 'bank') {
    instances[key] = _mountHoldingsList(panelEl, 'bank');
  }
}

/* ============================================
   支出 Tab：最近 20 筆
   ============================================ */
function _mountExpenseList(panelEl) {
  let _expenses = [];
  let _incomes = [];
  let _members = [];
  let _banks = {};

  panelEl.innerHTML = `
    <div class="text-muted mb-12" style="font-size:12px;">載入中…</div>
    <div id="ic-expense-list"></div>
  `;

  const render = () => {
    const listEl = document.getElementById('ic-expense-list');
    if (!listEl) return;

    const items = [
      ..._expenses.map((e) => ({
        kind: 'expense',
        id: e.id, year: e.year, month: e.month, memberId: e.memberId,
        name: e.name || '（未命名支出）',
        amount: Number(e.amount) || 0,
        date: e.date || '',
        status: e.status || '',
        bankId: e.bankId || '',
        _ts: e.createdAt || 0,
      })),
      ..._incomes.map((inc, i) => ({
        kind: 'income',
        id: `${inc.year}|${inc.month}|${inc.memberId}`,
        year: inc.year, month: inc.month, memberId: inc.memberId,
        name: `${_memberName(inc.memberId, _members)} 家用轉入`,
        amount: inc.amount,
        date: '',
        status: '已轉入',
        bankId: '',
        _ts: new Date(Number(inc.year), Number(inc.month) - 1, 1).getTime() + i,
      })),
    ];

    items.sort((a, b) => b._ts - a._ts);
    const top20 = items.slice(0, 20);

    if (top20.length === 0) {
      listEl.innerHTML = '<div class="glass-card"><div class="empty-state">尚無新增資料</div></div>';
      return;
    }

    listEl.innerHTML = `
      <div class="text-muted mb-12" style="font-size:12px;">共 ${items.length} 筆，顯示最近 ${top20.length} 筆</div>
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>類型</th>
              <th>年月</th>
              <th>成員</th>
              <th>項目</th>
              <th>出帳銀行</th>
              <th class="num">金額</th>
              <th>日期</th>
              <th style="width:140px;">操作</th>
            </tr>
          </thead>
          <tbody>
            ${top20.map((it) => `
              <tr>
                <td>${it.kind === 'income'
                  ? '<span class="badge badge-success">家用轉入</span>'
                  : '<span class="badge badge-pending">支出</span>'}</td>
                <td class="mono" style="font-size:12px;">${esc(it.year)}-${esc(it.month)}</td>
                <td>${esc(_memberName(it.memberId, _members))}</td>
                <td>${esc(it.name)}</td>
                <td>${it.bankId ? `<span class="badge badge-info" style="font-size:11px;">${esc(_banks[it.bankId] || '—')}</span>` : '<span class="text-muted">—</span>'}</td>
                <td class="num ${it.kind === 'income' ? 'text-emerald' : 'text-red'}">${formatHKD(it.amount)}</td>
                <td class="mono" style="font-size:11px; color:var(--text-muted);">${esc(it.date || '—')}</td>
                <td>
                  <button type="button" class="btn btn-sm btn-ghost" data-del-kind="${it.kind}" data-del-id="${esc(it.id)}" data-del-y="${esc(it.year)}" data-del-m="${esc(it.month)}" data-del-mem="${esc(it.memberId)}">
                    <i data-lucide="trash-2" style="width:12px;height:12px;"></i> 刪除
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    /* 刪除事件 */
    listEl.querySelectorAll('button[data-del-kind]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const kind = btn.dataset.delKind;
        const y = btn.dataset.delY;
        const m = btn.dataset.delM;
        const mem = btn.dataset.delMem;
        const id = btn.dataset.delId;

        if (kind === 'expense') {
          try {
            const { removeExpense } = await import('../core/db.js');
            await removeExpense(y, m, mem, id);
            showToast('✅ 已刪除支出', 'success');
          } catch (err) {
            showToast('刪除失敗：' + err.message, 'error');
          }
        } else {
          try {
            const { updateIncomeEntry } = await import('../core/db.js');
            await updateIncomeEntry(y, m, mem, 0);
            showToast('✅ 已刪除家用轉入', 'success');
          } catch (err) {
            showToast('刪除失敗：' + err.message, 'error');
          }
        }
      });
    });

    if (window.lucide) window.lucide.createIcons();
  };

  /* 訂閱 */
  const unsub1 = listenAllExpenses((list) => { _expenses = list || []; render(); });
  const unsub2 = listenAllIncome((list) => { _incomes = list || []; render(); });
  const unsub3 = listenBankAccounts((list) => {
    _banks = {};
    (list || []).forEach((b) => { _banks[b.id] = b.name; });
    render();
  });

  getMembersOnce().then((list) => { _members = list || []; render(); }).catch(() => {});

  return {
    refresh: render,
    destroy: () => {
      try { unsub1(); } catch (e) {}
      try { unsub2(); } catch (e) {}
      try { unsub3(); } catch (e) {}
      panelEl.innerHTML = '';
    },
  };
}

/* ============================================
   保險 / 基金 / 銀行 Tab
   ============================================ */
function _mountHoldingsList(panelEl, kind) {
  let _items = [];
  let _banks = {};
  let _members = [];

  panelEl.innerHTML = '<div class="empty-state">載入中…</div>';

  const render = () => {
    if (_items.length === 0) {
      panelEl.innerHTML = `<div class="glass-card"><div class="empty-state">尚無${_kindLabel(kind)}</div></div>`;
      return;
    }

    panelEl.innerHTML = `
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>${_renderHeader(kind)}</thead>
          <tbody>${_items.map((r) => _renderRow(kind, r, _members, _banks)).join('')}</tbody>
        </table>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
  };

  const subscribe = () => {
    if (kind === 'policy') return listenInsurancePolicies((list) => { _items = list || []; render(); });
    if (kind === 'fund')   return listenFunds((list) => { _items = list || []; render(); });
    if (kind === 'bank')   return listenBankAccounts((list) => { _items = list || []; render(); });
    return () => {};
  };

  const unsub1 = subscribe();
  const unsub2 = listenBankAccounts((list) => {
    _banks = {};
    (list || []).forEach((b) => { _banks[b.id] = b.name; });
    render();
  });

  getMembersOnce().then((list) => { _members = list || []; render(); }).catch(() => {});

  return {
    refresh: render,
    destroy: () => {
      try { unsub1(); } catch (e) {}
      try { unsub2(); } catch (e) {}
      panelEl.innerHTML = '';
    },
  };
}

function _kindLabel(kind) {
  if (kind === 'policy') return '保單';
  if (kind === 'fund') return '基金';
  if (kind === 'bank') return '銀行帳號';
  return '資料';
}

function _renderHeader(kind) {
  if (kind === 'policy') {
    return '<tr><th>保單名稱</th><th>保險公司</th><th>持有人</th><th class="num">本期年繳</th></tr>';
  }
  if (kind === 'fund') {
    return '<tr><th>基金名稱</th><th class="num">單位數</th><th class="num">現值</th></tr>';
  }
  if (kind === 'bank') {
    return '<tr><th>銀行名稱</th><th>類型</th><th class="num">初始餘額</th><th>初始年月</th></tr>';
  }
  return '';
}

function _renderRow(kind, r, members, banks) {
  if (kind === 'policy') {
    const cur = (r.periods || {})[String(r.currentPeriodIndex || 1)];
    const holder = members.find((m) => m.id === (r.policyHolderId || r.memberId));
    return `<tr>
      <td>${esc(r.name || '—')}</td>
      <td>${esc(r.company || '—')}</td>
      <td>${esc(holder?.name || '—')}</td>
      <td class="num text-emerald">${formatHKD(cur ? cur.annualPremium : 0)}</td>
    </tr>`;
  }
  if (kind === 'fund') {
    return `<tr>
      <td>${esc(r.name || '—')}</td>
      <td class="num">${esc(String(r.units || '—'))}</td>
      <td class="num text-emerald">${formatHKD(r.currentValue)}</td>
    </tr>`;
  }
  if (kind === 'bank') {
    return `<tr>
      <td>${esc(r.name || '—')}</td>
      <td>${r.type === 'personal' ? '<span class="badge badge-muted">個人</span>' : '<span class="badge badge-info">家庭</span>'}</td>
      <td class="num">${formatHKD(r.initialBalance)}</td>
      <td class="mono" style="font-size:12px; color:var(--text-muted);">${esc(r.initialYear || '—')}-${esc(r.initialMonth || '—')}</td>
    </tr>`;
  }
  return '';
}

/* ============================================
   工具
   ============================================ */
function _memberName(memberId, members) {
  if (memberId === RESERVED_IDS.EXTRA_INCOME) return '額外收入';
  if (memberId === RESERVED_IDS.SHARED_MEMBER) return '家庭共用';
  const m = (members || []).find((x) => x.id === memberId);
  return m ? m.name : '（未知）';
}

function _yearOptions() {
  return getYearList().map((y) => ({ value: String(y), label: `${y} 年` }));
}

function _monthOptions() {
  const opts = [];
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    opts.push({ value: mm, label: `${m} 月` });
  }
  return opts;
}

function sortMembersLocal(list) {
  return [...(list || [])].sort((a, b) => {
    const oa = a.order != null ? a.order : Number.MAX_SAFE_INTEGER;
    const ob = b.order != null ? b.order : Number.MAX_SAFE_INTEGER;
    if (oa !== ob) return oa - ob;
    return (a.createdAt || 0) - (b.createdAt || 0);
  });
}

function _createModal(id, title) {
  document.getElementById(id)?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = id;
  overlay.innerHTML = `
    <div class="modal" style="max-width:560px; max-height:90vh; overflow-y:auto;">
      <h2 class="modal-title">${esc(title)}</h2>
      <div id="${id}-form-root"></div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(id); });
  return overlay;
}

function _destroyAllModals() {
  ['ic-add-expense-modal', 'ic-add-contribution-modal', 'ic-add-personal-income-modal', 'ic-add-manual-txn-modal']
    .forEach((id) => document.getElementById(id)?.remove());
}

/* ============================================
   新增支出 Modal
   ============================================ */
async function _openAddExpenseModal() {
  if (!AppState.getCanInput()) return;

  const MODAL_ID = 'ic-add-expense-modal';
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
      { type: 'number', id: 'amount', label: '費用（HK$）', required: true, min: 0, step: 1 },
      { type: 'select', id: 'payment', label: '支付方式', includeEmpty: true, emptyText: '— 請選擇 —' },
      { type: 'select', id: 'bankId', label: '出帳銀行（選填）', includeEmpty: true, emptyText: '— 不關聯銀行 —' },
      { type: 'select', id: 'status', label: '狀態', includeEmpty: false,
        options: statusList.map((s) => ({ value: s.name, label: s.name })),
        defaultValue: defaultStatus?.name || '未處理' },
    ],
    submitText: '新增支出', showCancel: true, cancelText: '取消',
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

      const expenseId = await addExpense(data.year, data.month, data.member, payload);

      if (data.bankId && expenseId) {
        let txnId = '';
        try {
          txnId = await createTransactionForExpense({
            bankId: data.bankId, memberId: data.member,
            amount: payload.amount, date: payload.date,
            expenseId, note: itemName || '',
          });
          await updateExpense(data.year, data.month, data.member, expenseId, { txnId });
        } catch (e) {
          console.warn('[input-center] 建立銀行交易失敗：', e);
          if (txnId) {
            try { await removeBankTransaction(data.bankId, txnId); } catch (re) { /* noop */ }
          }
          showToast('支出已新增，但銀行交易建立失敗（已回滾）', 'warning');
        }
      }

      showToast('✅ 已新增支出', 'success');
      closeModal(MODAL_ID);
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

  listenCategories((list) => {
    formApi.updateOptions('category', list.map((c) => ({ value: c.id, label: c.name })), {
      includeEmpty: true, emptyText: '— 請選擇類別 —',
    });
  });

  listenPaymentMethods((list) => {
    formApi.updateOptions('payment', list.map((p) => ({ value: p.id, label: p.name })), {
      includeEmpty: true, emptyText: '— 請選擇 —',
    });
  });

  listenBankAccounts((list) => {
    formApi.updateOptions('bankId', list.map((b) => ({ value: b.id, label: b.name })), {
      includeEmpty: true, emptyText: '— 不關聯銀行 —',
    });
  });

  openModal(MODAL_ID);
  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   家用轉入 Modal
   ============================================ */
async function _openAddContributionModal() {
  if (!AppState.getCanInput()) return;

  const MODAL_ID = 'ic-add-contribution-modal';
  const ym = AppState.getYearMonth();
  const curMonth = ym.month === 'all' ? '01' : (ym.month || '01');

  const members = await getMembersOnce();
  const sorted = sortMembersLocal(members);

  _createModal(MODAL_ID, '家用轉入');
  const formApi = buildForm({
    containerId: `${MODAL_ID}-form-root`,
    fields: [
      { type: 'select', id: 'year',  label: '所屬年份', required: true, includeEmpty: false, options: _yearOptions(), defaultValue: ym.year || String(new Date().getFullYear()) },
      { type: 'select', id: 'month', label: '所屬月份', required: true, includeEmpty: false, options: _monthOptions(), defaultValue: curMonth },
      { type: 'select', id: 'member', label: '轉入成員', required: true, includeEmpty: true, emptyText: '— 請選擇成員 —', options: sorted.map((m) => ({ value: m.id, label: m.name })) },
      { type: 'number', id: 'amount', label: '轉入金額（HK$）', required: true, min: 0, step: 1 },
      { type: 'select', id: 'bankId', label: '轉入銀行', required: true, includeEmpty: true, emptyText: '— 請選擇銀行 —' },
      { type: 'text', id: 'note', label: '備註（可選）', maxlength: 60 },
    ],
    submitText: '確認轉入', showCancel: true, cancelText: '取消',
    onSubmit: async (data) => {
      const amount = Number(data.amount) || 0;
      if (amount <= 0) { showToast('金額必須大於 0', 'warning'); return; }

      const year = String(data.year);
      const month = String(data.month);
      const memberId = data.member;

      await saveIncome(year, month, { [memberId]: amount });

      try {
        await createTransactionForContribution({
          bankId: data.bankId, memberId, amount,
          date: `${year}-${month}-01`,
          note: data.note || '家用轉入',
        });
      } catch (e) {
        console.warn('[input-center] 建立銀行交易失敗：', e);
        showToast('家用轉入已記錄，但銀行交易建立失敗', 'warning');
      }

      showToast(`✅ 已記錄 ${year}-${month} 家用轉入`, 'success');
      closeModal(MODAL_ID);
    },
    onCancel: () => closeModal(MODAL_ID),
  });

  listenBankAccounts((list) => {
    formApi.updateOptions('bankId', list.map((b) => ({ value: b.id, label: b.name })), {
      includeEmpty: true, emptyText: '— 請選擇銀行 —',
    });
  });

  openModal(MODAL_ID);
  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   個人收入 Modal
   ============================================ */
async function _openAddPersonalIncomeModal() {
  if (!AppState.getCanInput()) return;

  const MODAL_ID = 'ic-add-personal-income-modal';
  const ym = AppState.getYearMonth();
  const curMonth = ym.month === 'all' ? '01' : (ym.month || '01');

  const members = await getMembersOnce();
  const sorted = sortMembersLocal(members);
  const currentMemberId = AppState.getCurrentMemberId();
  const isOwner = AppState.getRole() === 'owner' || AppState.isSuperAdmin;

  const memberOptions = isOwner
    ? sorted.map((m) => ({ value: m.id, label: m.name }))
    : sorted.filter((m) => m.id === currentMemberId).map((m) => ({ value: m.id, label: m.name }));

  if (memberOptions.length === 0) {
    showToast('找不到您的成員身份，請聯繫管理員', 'error');
    return;
  }

  _createModal(MODAL_ID, '個人收入');
  buildForm({
    containerId: `${MODAL_ID}-form-root`,
    fields: [
      { type: 'select', id: 'year',  label: '所屬年份', required: true, includeEmpty: false, options: _yearOptions(), defaultValue: ym.year || String(new Date().getFullYear()) },
      { type: 'select', id: 'month', label: '所屬月份', required: true, includeEmpty: false, options: _monthOptions(), defaultValue: curMonth },
      { type: 'select', id: 'memberId', label: '成員', required: true, includeEmpty: false, options: memberOptions, disabled: !isOwner, hint: isOwner ? '' : '（僅能輸入自己的個人收入）' },
      { type: 'number', id: 'amount', label: '金額（HK$）', required: true, min: 0, step: 1 },
    ],
    submitText: '儲存', showCancel: true, cancelText: '取消',
    onSubmit: async (data) => {
      const amount = Number(data.amount) || 0;
      if (amount <= 0) { showToast('金額必須大於 0', 'warning'); return; }
      try {
        await savePersonalIncome(data.memberId, data.year, data.month, amount);
        showToast(`✅ 已記錄 ${data.year}-${data.month} 個人收入`, 'success');
        closeModal(MODAL_ID);
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
   ============================================ */
async function _openManualTxnModal(type) {
  if (!AppState.getCanInput()) return;

  const MODAL_ID = 'ic-add-manual-txn-modal';
  _createModal(MODAL_ID, type === 'in' ? '手動入帳' : '手動出帳');

  const formApi = buildForm({
    containerId: `${MODAL_ID}-form-root`,
    fields: [
      { type: 'select', id: 'bankId', label: '銀行', required: true, includeEmpty: true, emptyText: '— 請選擇銀行 —' },
      { type: 'number', id: 'amount', label: '金額（HK$）', required: true, min: 0, step: 1 },
      { type: 'text', id: 'date', label: '日期', required: true, placeholder: 'YYYY-MM-DD', maxlength: 10, defaultValue: todayISO() },
      { type: 'text', id: 'note', label: '備註', maxlength: 60, placeholder: '例如：利息、手續費' },
    ],
    submitText: '新增', showCancel: true, cancelText: '取消',
    onSubmit: async (data) => {
      const amount = Number(data.amount) || 0;
      if (amount <= 0) { showToast('金額必須大於 0', 'warning'); return; }
      try {
        await api.bankTransactions.create(data.bankId, {
          type, category: 'manual', amount,
          date: data.date, note: data.note || '',
        });
        showToast(`✅ 已新增${type === 'in' ? '入帳' : '出帳'}`, 'success');
        closeModal(MODAL_ID);
      } catch (e) {
        showToast('新增失敗：' + e.message, 'error');
      }
    },
    onCancel: () => closeModal(MODAL_ID),
  });

  listenBankAccounts((list) => {
    formApi.updateOptions('bankId', list.map((b) => ({ value: b.id, label: b.name })), {
      includeEmpty: true, emptyText: '— 請選擇銀行 —',
    });
  });

  openModal(MODAL_ID);
  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   項目輔助
   ============================================ */
async function _getItemsByCategory(categoryId) {
  const items = await getItemsOnce();
  const filtered = categoryId ? items.filter((i) => i.categoryId === categoryId) : items;
  return filtered.map((i) => ({ value: i.id, label: i.name }));
}

async function _getItemName(itemId) {
  if (!itemId) return '';
  const items = await getItemsOnce();
  const found = items.find((i) => i.id === itemId);
  return found ? found.name : '';
}
