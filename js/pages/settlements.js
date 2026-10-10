// settlements.js — 結算清單（v103.0.18）
import { formatHKD } from '../lib/format.js';
import { esc } from '../lib/dom.js';
import { mergeSettlementData } from '../lib/merge.js';
import { applyFilters, applySort } from '../lib/filter-sort.js';
import { listenAllMemberExpenses, removeExpense } from '../core/db.js';
import { resolveName } from '../config/entity-registry.js';
import { AppState } from '../core/state.js';
import { showToast } from '../ui/toast.js';
import { openConfirm } from '../ui/modal.js';
import { openExpenseModal } from '../lib/expense-modal.js';
import { renderPageFilter } from '../shared/page-filter.js';
import { renderStatsCards } from '../shared/stats-cards.js';
import { renderDataTable } from '../shared/data-table.js';
import { RESERVED_IDS } from '../config/constants.js';

export default {
  title: '結算清單',
  data: {},
  state: {
    filters: { year: '', month: '', source: '' },
    sortMode: 'pending-first',
  },
  derived: {},
  blocks: [],

  customMount: (ctx) => {
    let _rows = [], _filtered = [];
    let _statsApi = null, _tableApi = null, _filterInstance = null, _sortH = null, _monthlyUnsub = null;

    const reload = () => {
      const { year, month } = AppState.getYearMonth();
      if (_monthlyUnsub) { try { _monthlyUnsub(); } catch (e) {} }
      _monthlyUnsub = listenAllMemberExpenses(String(year), month, (memberExpenses) => {
        _rows = mergeSettlementData({ memberExpenses, insuranceRows: [], year: String(year), month });
        render();
      });
    };

    const render = () => {
      _filtered = applySort(applyFilters(_rows, ctx.state.filters), ctx.state.sortMode);
      _paintStats();
      _paintTable();
    };

    const _paintStats = () => {
      const pending = _filtered.filter((r) => !r.isDone);
      const done = _filtered.filter((r) => r.isDone);
      const pt = pending.reduce((s, r) => s + (Number(r.amount) || 0), 0);
      const dt = done.reduce((s, r) => s + (Number(r.amount) || 0), 0);
      if (_statsApi) { try { _statsApi.destroy(); } catch (e) {} }
      _statsApi = renderStatsCards({
        container: 'settlement-stats-root',
        cards: [
          { title: '待處理', value: formatHKD(pt), valueClass: 'magenta', hint: `${pending.length} 筆`, icon: 'clock' },
          { title: '已處理', value: formatHKD(dt), valueClass: 'emerald', hint: `${done.length} 筆`, icon: 'check-circle' },
          { title: '總計', value: formatHKD(pt + dt), valueClass: 'cyan', hint: `${_filtered.length} 筆`, icon: 'calculator' },
        ],
        columns: 3,
      });
    };

    const _paintTable = () => {
      const root = document.getElementById('settlement-table-root');
      if (!root) return;
      if (_tableApi) { try { _tableApi.destroy(); } catch (e) {} _tableApi = null; }
      const canInput = AppState.getCanInput();
      _tableApi = renderDataTable({
        container: root,
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
            source: (_, r) => r.source === 'insurance' ? '<span class="badge badge-success">🛡 保險</span>' : '<span class="badge badge-info">🏷 個人</span>',
            yearMonth: (_, r) => `${esc(r.year)}-${esc(r.month)}`,
            member: (_, r) => r.memberId === RESERVED_IDS.SHARED_MEMBER ? '🏠 家庭共用' : esc(resolveName('members', r.memberId) || r.memberId || '—'),
            name: (_, r) => esc(r.name),
            amount: (v) => formatHKD(v),
            status: (v, r) => `<span class="badge ${r.isDone ? 'badge-success' : 'badge-pending'}">${esc(v)}</span>`,
          },
          storageKey: 'settlement-table',
        },
        hooks: {
          customActions: canInput ? (row) => [
            { label: '編輯', icon: 'pencil', className: 'btn-ghost', action: 'edit', onClick: () => {
              if (row.source === 'insurance') { showToast('保險請至「保險清單表」編輯', 'info', 3000); window.location.href = 'insurance.html'; return; }
              openExpenseModal({
                row: { id: row._ref?.expenseId, year: row.year, month: row.month, memberId: row.memberId, name: row.name, amount: row.amount, date: row.date, categoryId: row.categoryId, itemId: row.itemId, paymentMethodId: row.paymentMethodId, bankId: row.bankId, status: row.isDone ? 'done' : 'pending' },
                onSuccess: reload,
              });
            }},
            { label: row.source === 'insurance' ? '取消扣款' : '刪除', icon: 'trash-2', className: 'btn-danger', action: 'del', onClick: async () => {
              const ok = await openConfirm(`確定要刪除「${row.name}」嗎？`, { okText: '刪除', okClass: 'btn-danger' });
              if (!ok) return;
              try {
                if (row.source === 'personal' && row._ref) await removeExpense(row.year, row.month, row._ref.memberId, row._ref.expenseId);
                showToast('✅ 已刪除', 'success'); reload();
              } catch (e) { showToast('刪除失敗：' + e.message, 'error'); }
            }},
          ] : () => [],
        },
      });
    };

    const { year, month } = AppState.getYearMonth();
    ctx.state.filters.year = String(year);
    ctx.state.filters.month = month === 'all' ? '' : String(month);

    _filterInstance = renderPageFilter({
      containerId: 'page-filter-root',
      fields: [],
      renderExtra: () => `<div class="filter-group"><label class="field-label">來源</label><select class="select" data-filter="source"><option value="">全部</option><option value="personal">🏷 個人支出</option><option value="insurance">🛡 保險扣款</option></select></div>`,
      onChange: (f) => { ctx.state.filters.source = f.source || ''; render(); },
    });

    _sortH = (e) => { ctx.state.sortMode = e.target.value; render(); };
    document.getElementById('settlement-sort')?.addEventListener('change', _sortH);

    const unsub = ctx.onDataChange((key) => { if (key === '__APP__') reload(); });

    reload();

    return {
      destroy: () => {
        unsub();
        if (_monthlyUnsub) { try { _monthlyUnsub(); } catch (e) {} }
        if (_filterInstance) { try { _filterInstance.destroy(); } catch (e) {} }
        if (_statsApi) { try { _statsApi.destroy(); } catch (e) {} }
        if (_tableApi) { try { _tableApi.destroy(); } catch (e) {} }
        if (_sortH) document.getElementById('settlement-sort')?.removeEventListener('change', _sortH);
      },
    };
  },
};