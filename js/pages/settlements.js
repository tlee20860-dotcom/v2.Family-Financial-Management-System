// ============================================
// settlements.js — 結算清單（v103.0.14 Page Schema）
// 位置：js/pages/settlements.js
// ============================================
// v103.0.14 修正：
//   ✅ [問題5] 加編輯按鈕 + 編輯 Modal
//   ✅ [問題5] mobileCardMode: true
//   ✅ [問題1] 成員名稱改用 entity-registry 解析
// ============================================

import { formatHKD } from '../lib/format.js';
import { esc } from '../lib/dom.js';
import { mergeSettlementData } from '../lib/merge.js';
import { listenAllMemberExpenses, removeExpense, updateExpense } from '../core/db.js';
import { resolveName } from '../config/entity-registry.js';
import { AppState } from '../core/state.js';
import { showToast } from '../ui/toast.js';
import { openConfirm } from '../ui/modal.js';
import { buildForm } from '../ui/form-builder.js';
import { openModal, closeModal } from '../ui/modal.js';
import { renderPageFilter } from '../shared/page-filter.js';
import { renderStatsCards } from '../shared/stats-cards.js';
import { renderDataTable } from '../shared/data-table.js';
import { RESERVED_IDS } from '../config/constants.js';
import { getDynamicOptions } from '../entity/entity-helpers.js';

const EDIT_MODAL_ID = 'settlement-edit-modal';

export default {
  title: '結算清單',
  data: {},
  state: {
    filters: { year: '', month: '', source: '', status: '', member: '' },
    sortMode: 'pending-first',
  },
  derived: {},
  blocks: [],

  customMount: (ctx) => {
    let _rows = [];
    let _filtered = [];
    let _statsApi = null;
    let _tableApi = null;
    let _filterInstance = null;
    let _sortHandler = null;
    let _monthlyUnsub = null;

    const reload = () => {
      const { year, month } = AppState.getYearMonth();
      const y = String(year);

      if (_monthlyUnsub) { try { _monthlyUnsub(); } catch (e) { /* noop */ } }
      _monthlyUnsub = listenAllMemberExpenses(y, month, async (memberExpenses) => {
        _rows = mergeSettlementData({ memberExpenses, insuranceRows: [], year: y, month });
        render();
      });
    };

    const render = () => {
      _filtered = _applyFilters(_rows, ctx.state.filters);
      _filtered = _applySort(_filtered, ctx.state.sortMode);
      renderStats();

      const tableRoot = document.getElementById('settlement-table-root');
      if (!tableRoot) return;
      if (_tableApi) { try { _tableApi.destroy(); } catch (e) { /* noop */ } _tableApi = null; }

      const userCanInput = AppState.getCanInput();
      _tableApi = renderDataTable({
        container: tableRoot,
        entityKey: '__settlement__',
        rows: _filtered,
        tableId: 'settlement-table',
        options: {
          mobileCardMode: true,
          columns: [
            { id: 'source', label: '來源', defaultVisible: true },
            { id: 'yearMonth', label: '年月', defaultVisible: true },
            { id: 'member', label: '成員', defaultVisible: true },
            { id: 'name', label: '項目名稱', defaultVisible: true },
            { id: 'amount', label: '金額', defaultVisible: true, type: 'number' },
            { id: 'date', label: '日期', defaultVisible: true },
            { id: 'status', label: '狀態', defaultVisible: true },
          ],
          resolvers: {
            source: (_, r) => r.source === 'insurance'
              ? '<span class="badge badge-success">🛡 保險</span>'
              : '<span class="badge badge-info">🏷 個人</span>',
            yearMonth: (_, r) => `${esc(r.year)}-${esc(r.month)}`,
            member: (_, r) => {
              if (r.memberId === RESERVED_IDS.SHARED_MEMBER) return '🏠 家庭共用';
              return esc(resolveName('members', r.memberId) || r.memberId || '—');
            },
            name: (_, r) => esc(r.name),
            amount: (v) => formatHKD(v),
            status: (v, r) => `<span class="badge ${r.isDone ? 'badge-success' : 'badge-pending'}">${esc(v)}</span>`,
          },
          storageKey: 'settlement-table',
        },
        hooks: {
          customActions: userCanInput ? (row) => [
            {
              label: '編輯', icon: 'pencil', className: 'btn-ghost', action: 'edit',
              onClick: (r) => _openEditModal(r, reload),
            },
            {
              label: row.source === 'insurance' ? '取消扣款' : '刪除', icon: 'trash-2', className: 'btn-danger', action: 'del',
              onClick: async (r) => {
                const ok = await openConfirm(`確定要刪除「${r.name}」嗎？`, { okText: '刪除', okClass: 'btn-danger' });
                if (!ok) return;
                try {
                  if (r.source === 'personal' && r._ref) {
                    await removeExpense(r.year, r.month, r._ref.memberId, r._ref.expenseId);
                  }
                  showToast('✅ 已刪除', 'success');
                  reload();
                } catch (e) {
                  showToast('刪除失敗：' + e.message, 'error');
                }
              },
            },
          ] : () => [],
        },
      });
    };

    const renderStats = () => {
      const pending = _filtered.filter((r) => !r.isDone);
      const done = _filtered.filter((r) => r.isDone);
      const pendingTotal = pending.reduce((s, r) => s + (Number(r.amount) || 0), 0);
      const doneTotal = done.reduce((s, r) => s + (Number(r.amount) || 0), 0);
      if (_statsApi) { try { _statsApi.destroy(); } catch (e) { /* noop */ } }
      _statsApi = renderStatsCards({
        container: 'settlement-stats-root',
        cards: [
          { title: '待處理', value: formatHKD(pendingTotal), valueClass: 'magenta', hint: `${pending.length} 筆`, icon: 'clock' },
          { title: '已處理', value: formatHKD(doneTotal), valueClass: 'emerald', hint: `${done.length} 筆`, icon: 'check-circle' },
          { title: '總計', value: formatHKD(pendingTotal + doneTotal), valueClass: 'cyan', hint: `${_filtered.length} 筆`, icon: 'calculator' },
        ],
        columns: 3,
      });
    };

    const { year, month } = AppState.getYearMonth();
    ctx.state.filters.year = String(year);
    ctx.state.filters.month = month === 'all' ? '' : String(month);

    _filterInstance = renderPageFilter({
      containerId: 'page-filter-root',
      fields: [],
      renderExtra: () => `
        <div class="filter-group">
          <label class="field-label">來源</label>
          <select class="select" data-filter="source">
            <option value="">全部</option>
            <option value="personal">🏷 個人支出</option>
            <option value="insurance">🛡 保險扣款</option>
          </select>
        </div>
      `,
      onChange: (f) => {
        ctx.state.filters.source = f.source || '';
        render();
      },
    });

    _sortHandler = (e) => {
      ctx.state.sortMode = e.target.value;
      render();
    };
    document.getElementById('settlement-sort')?.addEventListener('change', _sortHandler);

    reload();

    return {
      destroy: () => {
        if (_monthlyUnsub) { try { _monthlyUnsub(); } catch (e) { /* noop */ } _monthlyUnsub = null; }
        if (_filterInstance) { try { _filterInstance.destroy(); } catch (e) { /* noop */ } }
        if (_statsApi) { try { _statsApi.destroy(); } catch (e) { /* noop */ } }
        if (_tableApi) { try { _tableApi.destroy(); } catch (e) { /* noop */ } }
        if (_sortHandler) {
          document.getElementById('settlement-sort')?.removeEventListener('change', _sortHandler);
        }
        document.getElementById(EDIT_MODAL_ID)?.remove();
      },
    };
  },
};

/* ============================================
   編輯 Modal
   ============================================ */
async function _openEditModal(row, onSaved) {
  if (row.source === 'insurance') {
    showToast('保險扣款請至「保險清單表」編輯', 'info', 3000);
    window.location.href = 'insurance.html';
    return;
  }

  document.getElementById(EDIT_MODAL_ID)?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = EDIT_MODAL_ID;
  overlay.innerHTML = `
    <div class="modal" style="max-width:560px; max-height:90vh; overflow-y:auto;">
      <h2 class="modal-title">編輯支出</h2>
      <div id="${EDIT_MODAL_ID}-form-root"></div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(EDIT_MODAL_ID);
  });

  const categories = await getDynamicOptions('categories');
  const payments = await getDynamicOptions('payments');
  const banks = await getDynamicOptions('bankAccounts');
  const items = row.categoryId
    ? await getDynamicOptions('items', { categoryId: row.categoryId })
    : [];

  buildForm({
    containerId: `${EDIT_MODAL_ID}-form-root`,
    fields: [
      { type: 'text', id: 'ed-name', label: '項目名稱', required: true, maxlength: 60 },
      { type: 'number', id: 'ed-amount', label: '金額（HK$）', required: true, min: 0, step: 1 },
      { type: 'text', id: 'ed-date', label: '日期（YYYY-MM-DD）', required: false },
      { type: 'select', id: 'ed-category', label: '類別', includeEmpty: true, options: categories },
      { type: 'select', id: 'ed-item', label: '項目', includeEmpty: true, options: items },
      { type: 'select', id: 'ed-payment', label: '支付方式', includeEmpty: true, options: payments },
      { type: 'select', id: 'ed-bank', label: '銀行（可選）', includeEmpty: true, options: banks },
      { type: 'select', id: 'ed-status', label: '狀態', includeEmpty: false, options: [
        { value: 'pending', label: '未處理' },
        { value: 'done', label: '已處理' },
      ]},
    ],
    submitText: '儲存',
    showCancel: true,
    cancelText: '取消',
    initialData: {
      'ed-name': row.name || '',
      'ed-amount': row.amount || 0,
      'ed-date': row.date || '',
      'ed-category': row.categoryId || '',
      'ed-item': row.itemId || '',
      'ed-payment': row.paymentMethodId || '',
      'ed-bank': row.bankId || '',
      'ed-status': row.status === 'done' || row.isDone ? 'done' : 'pending',
    },
    onSubmit: async (data) => {
      try {
        const ref = row._ref || {};
        await updateExpense(row.year, row.month, ref.memberId, ref.expenseId, {
          name: data['ed-name'],
          amount: Number(data['ed-amount']) || 0,
          date: data['ed-date'] || '',
          categoryId: data['ed-category'] || '',
          itemId: data['ed-item'] || '',
          paymentMethodId: data['ed-payment'] || '',
          bankId: data['ed-bank'] || '',
          status: data['ed-status'],
        });
        showToast('✅ 已更新支出', 'success');
        closeModal(EDIT_MODAL_ID);
        if (typeof onSaved === 'function') onSaved();
      } catch (err) {
        showToast('儲存失敗：' + err.message, 'error');
      }
    },
    onCancel: () => closeModal(EDIT_MODAL_ID),
  });

  /* 類別變更 → 更新項目 */
  const catEl = document.getElementById('ed-category');
  const itemEl = document.getElementById('ed-item');
  if (catEl && itemEl) {
    catEl.addEventListener('change', async () => {
      const catId = catEl.value;
      const list = await getDynamicOptions('items', { categoryId: catId });
      let html = '<option value="">— 請選擇項目 —</option>';
      list.forEach((o) => { html += `<option value="${esc(o.value)}">${esc(o.label)}</option>`; });
      itemEl.innerHTML = html;
    });
  }

  openModal(EDIT_MODAL_ID);
  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   Helpers
   ============================================ */
function _applyFilters(list, filters) {
  return list.filter((r) => {
    if (filters.year && r.year !== filters.year) return false;
    if (filters.month && r.month !== filters.month) return false;
    if (filters.source && r.source !== filters.source) return false;
    if (filters.status && r.status !== filters.status) return false;
    if (filters.member && r.memberId !== filters.member) return false;
    return true;
  });
}

function _applySort(list, sortMode) {
  const arr = [...list];
  switch (sortMode) {
    case 'date-desc':
      arr.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      break;
    case 'date-asc':
      arr.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      break;
    case 'amount-desc':
      arr.sort((a, b) => b.amount - a.amount);
      break;
    default:
      arr.sort((a, b) => {
        if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;
        return (b.date || '').localeCompare(a.date || '');
      });
  }
  return arr;
}