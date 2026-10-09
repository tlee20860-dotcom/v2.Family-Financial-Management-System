// ============================================
// settlements.js — 結算清單（v103.0.11 Page Schema）
// 位置：js/pages/settlements.js
// ============================================
// v103.0.11 修正：
//   ✅ [B06] 移除 .settlement-status-select 死代碼（表格用 badge 顯示，非 select）
//   ✅ [B07] 統一版本號 v103.0.11
// ============================================

import { formatHKD } from '../lib/format.js';
import { esc } from '../lib/dom.js';
import { mergeSettlementData } from '../lib/merge.js';
import { listenAllMemberExpenses, removeExpense } from '../core/db.js';
import { AppState } from '../core/state.js';
import { showToast } from '../ui/toast.js';
import { openConfirm } from '../ui/modal.js';
import { renderPageFilter } from '../shared/page-filter.js';
import { renderStatsCards } from '../shared/stats-cards.js';
import { renderDataTable } from '../shared/data-table.js';

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
            member: (_, r) => esc(r.memberId),
            name: (_, r) => esc(r.name),
            amount: (v) => formatHKD(v),
            status: (v, r) => `<span class="badge ${r.isDone ? 'badge-success' : 'badge-pending'}">${esc(v)}</span>`,
          },
          storageKey: 'settlement-table',
        },
        hooks: {
          customActions: userCanInput ? (row) => [{
            label: row.source === 'insurance' ? '取消扣款' : '刪除',
            icon: 'trash-2',
            className: 'btn-danger',
            action: 'del',
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
          }] : () => [],
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

    /* 初次設定 */
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
      },
    };
  },
};

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