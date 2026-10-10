// ============================================
// input-center.js — 綜合輸入中心（v103.0.15 Page Schema）
// 位置：js/pages/input-center.js
// ============================================
// v103.0.15 修正：
//   ✅ [P17-05] 支出 Tab 改用 listenAllExpenses（讀全年）
// ============================================

import { initTabPanel } from '../ui/tab-panel.js';
import { initEntityListPage } from '../shared/entity-list-page.js';
import { renderDataTable } from '../shared/data-table.js';
import { buildForm } from '../ui/form-builder.js';
import { openModal, closeModal, openConfirm } from '../ui/modal.js';
import { showToast } from '../ui/toast.js';
import {
  listenAllExpenses, addExpense, updateExpense, removeExpense,
  saveIncome, savePersonalIncome,
} from '../core/db.js';
import { getDynamicOptions } from '../entity/entity-helpers.js';
import { openEntityModal } from '../entity/entity-modal.js';
import { resolveName } from '../config/entity-registry.js';
import { AppState } from '../core/state.js';
import { ENTITY_KEYS, RESERVED_IDS } from '../config/constants.js';
import { esc } from '../lib/dom.js';
import { formatHKD } from '../lib/format.js';

const EXPENSE_MODAL_ID = 'ic-expense-modal';
const CONTRIB_MODAL_ID = 'ic-contribution-modal';
const PERSONAL_MODAL_ID = 'ic-personal-income-modal';

export default {
  title: '綜合輸入中心',
  data: {},
  state: { activeTab: 'expense' },
  derived: {},
  blocks: [],

  customMount: (ctx) => {
    const TABS = [
      { key: 'expense', label: '支出', icon: 'receipt', panelId: 'ic-panel-expense' },
      { key: 'insurance', label: '保險', icon: 'shield', panelId: 'ic-panel-insurance' },
      { key: 'fund', label: '基金', icon: 'line-chart', panelId: 'ic-panel-fund' },
      { key: 'bank', label: '銀行', icon: 'landmark', panelId: 'ic-panel-bank' },
    ];
    const instances = {};
    let _btnHandler = null, _expenseUnsub = null, _expenseTableApi = null;

    const loadTab = async (key) => {
      if (instances[key]) { try { instances[key].refresh?.(); } catch (e) {} return; }
      const tabDef = TABS.find((t) => t.key === key);
      if (!tabDef) return;
      const panelEl = document.getElementById(tabDef.panelId);
      if (!panelEl) return;

      if (key === 'insurance') {
        instances[key] = initEntityListPage({ entity: ENTITY_KEYS.POLICY, containerId: tabDef.panelId, options: { defaultView: 'table', showViewToggle: true, storageKey: 'ic-insurance-view', mobileCardMode: true } });
      } else if (key === 'fund') {
        instances[key] = initEntityListPage({ entity: ENTITY_KEYS.FUND, containerId: tabDef.panelId, options: { defaultView: 'table', showViewToggle: true, storageKey: 'ic-fund-view', mobileCardMode: true } });
      } else if (key === 'bank') {
        instances[key] = initEntityListPage({ entity: ENTITY_KEYS.BANK, containerId: tabDef.panelId, options: { defaultView: 'table', showViewToggle: true, storageKey: 'ic-bank-view', mobileCardMode: true } });
      } else if (key === 'expense') {
        panelEl.innerHTML = `
          <div class="banner mb-16">ℹ️ 以下為最近 50 筆支出。點「編輯」可修改，點「刪除」可移除。</div>
          <div id="ic-expense-table-root"></div>
        `;
        _loadExpenses();
        instances[key] = {
          refresh: _loadExpenses,
          destroy: () => {
            if (_expenseUnsub) { try { _expenseUnsub(); } catch (e) {} _expenseUnsub = null; }
            if (_expenseTableApi) { try { _expenseTableApi.destroy(); } catch (e) {} _expenseTableApi = null; }
            panelEl.innerHTML = '';
          },
        };
      }
    };

    const _loadExpenses = () => {
      if (_expenseUnsub) { try { _expenseUnsub(); } catch (e) {} _expenseUnsub = null; }
      _expenseUnsub = listenAllExpenses((allRows) => {
        const { year } = AppState.getYearMonth();
        const list = (allRows || [])
          .filter((r) => String(r.year) === String(year))
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
          .slice(0, 50);
        _renderExpenseTable(list);
      });
    };

    const _renderExpenseTable = (rows) => {
      const root = document.getElementById('ic-expense-table-root');
      if (!root) return;
      if (_expenseTableApi) { try { _expenseTableApi.destroy(); } catch (e) {} _expenseTableApi = null; }
      if (!rows || rows.length === 0) {
        root.innerHTML = '<div class="glass-card"><div class="empty-state">尚無支出紀錄</div></div>';
        return;
      }
      const userCanInput = AppState.getCanInput();
      _expenseTableApi = renderDataTable({
        container: root,
        entityKey: '__recent_expense__',
        rows,
        tableId: 'ic-recent-expense-table',
        options: {
          mobileCardMode: true,
          columns: [
            { id: 'date', label: '日期', defaultVisible: true },
            { id: 'memberName', label: '成員', defaultVisible: true },
            { id: 'name', label: '項目名稱', defaultVisible: true },
            { id: 'amount', label: '金額', defaultVisible: true, type: 'number' },
            { id: 'status', label: '狀態', defaultVisible: true },
          ],
          resolvers: {
            date: (v) => esc(v || '—'),
            memberName: (_, r) => r.memberId === RESERVED_IDS.SHARED_MEMBER ? '🏠 家庭共用' : esc(resolveName('members', r.memberId) || r.memberId || '—'),
            name: (v) => esc(v || '（未命名）'),
            amount: (v) => formatHKD(v),
            status: (v) => `<span class="badge ${v === 'done' ? 'badge-success' : 'badge-pending'}">${esc(v || '—')}</span>`,
          },
          storageKey: 'ic-recent-expense-table',
        },
        hooks: {
          customActions: userCanInput ? (row) => [
            { label: '編輯', icon: 'pencil', className: 'btn-ghost', action: 'edit', onClick: (r) => _openExpenseModal(r) },
            { label: '刪除', icon: 'trash-2', className: 'btn-danger', action: 'del', onClick: async (r) => {
              const ok = await openConfirm(`確定要刪除「${r.name}」嗎？`, { okText: '刪除', okClass: 'btn-danger' });
              if (!ok) return;
              try { await removeExpense(r.year, r.month, r.memberId, r.id); showToast('✅ 已刪除', 'success'); }
              catch (err) { showToast('刪除失敗：' + err.message, 'error'); }
            }},
          ] : () => [],
        },
      });
    };

    /* Modal: 新增/編輯支出 */
    const _openExpenseModal = async (row = null) => {
      const isEdit = !!row;
      document.getElementById(EXPENSE_MODAL_ID)?.remove();
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.id = EXPENSE_MODAL_ID;
      overlay.innerHTML = `<div class="modal" style="max-width:560px;max-height:90vh;overflow-y:auto;"><h2 class="modal-title">${isEdit ? '編輯' : '新增'}支出</h2><div id="${EXPENSE_MODAL_ID}-form-root"></div></div>`;
      document.body.appendChild(overlay);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(EXPENSE_MODAL_ID); });

      const members = await getDynamicOptions('members');
      const memberOptions = [...members, { value: RESERVED_IDS.SHARED_MEMBER, label: '🏠 家庭共用' }];
      const categories = await getDynamicOptions('categories');
      const payments = await getDynamicOptions('payments');
      const banks = await getDynamicOptions('bankAccounts');
      const { year, month } = AppState.getYearMonth();

      buildForm({
        containerId: `${EXPENSE_MODAL_ID}-form-root`,
        fields: [
          { type: 'select', id: 'exp-member', label: '成員', required: true, includeEmpty: false, options: memberOptions },
          { type: 'text', id: 'exp-name', label: '項目名稱', required: true, maxlength: 60 },
          { type: 'number', id: 'exp-amount', label: '金額（HK$）', required: true, min: 0, step: 1 },
          { type: 'text', id: 'exp-date', label: '日期（YYYY-MM-DD）' },
          { type: 'select', id: 'exp-category', label: '類別', includeEmpty: true, options: categories },
          { type: 'select', id: 'exp-item', label: '項目', includeEmpty: true, options: [] },
          { type: 'select', id: 'exp-payment', label: '支付方式', includeEmpty: true, options: payments },
          { type: 'select', id: 'exp-bank', label: '銀行（可選）', includeEmpty: true, options: banks },
          { type: 'select', id: 'exp-status', label: '狀態', includeEmpty: false, options: [{ value: 'pending', label: '未處理' }, { value: 'done', label: '已處理' }] },
        ],
        submitText: isEdit ? '儲存' : '新增',
        showCancel: true,
        cancelText: '取消',
        initialData: isEdit ? {
          'exp-member': row.memberId || '',
          'exp-name': row.name || '',
          'exp-amount': row.amount || 0,
          'exp-date': row.date || '',
          'exp-category': row.categoryId || '',
          'exp-item': row.itemId || '',
          'exp-payment': row.paymentMethodId || '',
          'exp-bank': row.bankId || '',
          'exp-status': row.status || 'pending',
        } : {
          'exp-member': AppState.getCurrentMemberId() || memberOptions[0]?.value || '',
          'exp-amount': 0,
          'exp-date': new Date().toISOString().slice(0, 10),
          'exp-status': 'pending',
        },
        onSubmit: async (data) => {
          try {
            const memberId = data['exp-member'];
            const payload = {
              name: data['exp-name'], amount: Number(data['exp-amount']) || 0,
              date: data['exp-date'] || '', categoryId: data['exp-category'] || '',
              itemId: data['exp-item'] || '', paymentMethodId: data['exp-payment'] || '',
              bankId: data['exp-bank'] || '', status: data['exp-status'] || 'pending',
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
            closeModal(EXPENSE_MODAL_ID);
          } catch (err) { showToast('儲存失敗：' + err.message, 'error'); }
        },
        onCancel: () => closeModal(EXPENSE_MODAL_ID),
      });

      /* 類別 → 項目聯動 */
      const catEl = document.getElementById('exp-category');
      const itemEl = document.getElementById('exp-item');
      if (catEl && itemEl) {
        const updateItems = async () => {
          const catId = catEl.value;
          const items = await getDynamicOptions('items', { categoryId: catId });
          let html = '<option value="">— 請選擇項目 —</option>';
          items.forEach((o) => { html += `<option value="${esc(o.value)}">${esc(o.label)}</option>`; });
          itemEl.innerHTML = html;
        };
        catEl.addEventListener('change', updateItems);
        if (isEdit && row.categoryId) { await updateItems(); if (row.itemId) itemEl.value = row.itemId; }
      }
      openModal(EXPENSE_MODAL_ID);
      if (window.lucide) window.lucide.createIcons();
    };

    /* Modal: 家用轉入 */
    const _openContributionModal = async () => {
      document.getElementById(CONTRIB_MODAL_ID)?.remove();
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.id = CONTRIB_MODAL_ID;
      overlay.innerHTML = `<div class="modal" style="max-width:480px;"><h2 class="modal-title">家用轉入</h2><div id="${CONTRIB_MODAL_ID}-form-root"></div></div>`;
      document.body.appendChild(overlay);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(CONTRIB_MODAL_ID); });

      const members = await getDynamicOptions('members');
      const { year, month } = AppState.getYearMonth();
      const y = year || String(new Date().getFullYear());
      const m = month === 'all' ? '01' : month;

      buildForm({
        containerId: `${CONTRIB_MODAL_ID}-form-root`,
        fields: [
          { type: 'select', id: 'c-member', label: '成員', required: true, includeEmpty: false, options: members },
          { type: 'number', id: 'c-amount', label: '金額（HK$）', required: true, min: 0, step: 1 },
        ],
        submitText: '儲存', showCancel: true, cancelText: '取消',
        onSubmit: async (data) => {
          try {
            await saveIncome(y, m, { [data['c-member']]: Number(data['c-amount']) || 0 });
            showToast(`✅ 已為 ${y}-${m} 新增家用轉入`, 'success');
            closeModal(CONTRIB_MODAL_ID);
          } catch (err) { showToast('儲存失敗：' + err.message, 'error'); }
        },
        onCancel: () => closeModal(CONTRIB_MODAL_ID),
      });
      openModal(CONTRIB_MODAL_ID);
      if (window.lucide) window.lucide.createIcons();
    };

    /* Modal: 個人收入 */
    const _openPersonalIncomeModal = async () => {
      document.getElementById(PERSONAL_MODAL_ID)?.remove();
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.id = PERSONAL_MODAL_ID;
      overlay.innerHTML = `<div class="modal" style="max-width:480px;"><h2 class="modal-title">個人收入</h2><div id="${PERSONAL_MODAL_ID}-form-root"></div></div>`;
      document.body.appendChild(overlay);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(PERSONAL_MODAL_ID); });

      const members = await getDynamicOptions('members');
      const { year, month } = AppState.getYearMonth();
      const y = year || String(new Date().getFullYear());
      const m = month === 'all' ? '01' : month;

      buildForm({
        containerId: `${PERSONAL_MODAL_ID}-form-root`,
        fields: [
          { type: 'select', id: 'p-member', label: '成員', required: true, includeEmpty: false, options: members },
          { type: 'number', id: 'p-amount', label: '金額（HK$）', required: true, min: 0, step: 1 },
        ],
        submitText: '儲存', showCancel: true, cancelText: '取消',
        onSubmit: async (data) => {
          try {
            await savePersonalIncome(data['p-member'], y, m, Number(data['p-amount']) || 0);
            showToast(`✅ 已為 ${y}-${m} 新增個人收入`, 'success');
            closeModal(PERSONAL_MODAL_ID);
          } catch (err) { showToast('儲存失敗：' + err.message, 'error'); }
        },
        onCancel: () => closeModal(PERSONAL_MODAL_ID),
      });
      openModal(PERSONAL_MODAL_ID);
      if (window.lucide) window.lucide.createIcons();
    };

    const tabPanel = initTabPanel({
      containerId: 'ic-tab-bar-root',
      tabs: TABS,
      defaultKey: 'expense',
      storageKey: 'input-center-tab',
      onChange: (key) => { ctx.state.activeTab = key; loadTab(key); },
    });
    loadTab(tabPanel?.getCurrent() || 'expense');

    const btnRoot = document.getElementById('ic-buttons-root');
    if (btnRoot) {
      _btnHandler = async (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;
        switch (action) {
          case 'add-expense': await _openExpenseModal(null); break;
          case 'add-contribution': await _openContributionModal(); break;
          case 'add-personal-income': await _openPersonalIncomeModal(); break;
          case 'add-policy': openEntityModal({ entity: ENTITY_KEYS.POLICY, mode: 'add' }); break;
          case 'add-fund': openEntityModal({ entity: ENTITY_KEYS.FUND, mode: 'add' }); break;
        }
      };
      btnRoot.addEventListener('click', _btnHandler);
    }

    return {
      destroy: () => {
        Object.values(instances).forEach((inst) => { try { inst?.destroy?.(); } catch (e) {} });
        try { tabPanel?.destroy(); } catch (e) {}
        if (_btnHandler && btnRoot) { try { btnRoot.removeEventListener('click', _btnHandler); } catch (e) {} _btnHandler = null; }
        document.getElementById(EXPENSE_MODAL_ID)?.remove();
        document.getElementById(CONTRIB_MODAL_ID)?.remove();
        document.getElementById(PERSONAL_MODAL_ID)?.remove();
      },
    };
  },
};