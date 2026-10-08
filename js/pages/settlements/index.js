// ============================================
// index.js — 結算清單入口（v101.6.6）
// 位置：js/pages/settlements/index.js
// ============================================
// v101.6.6 修正：
//   ✅ [BUG-01] 修復監聽器洩漏：_loadMonthly 每次呼叫前先取消舊訂閱
//   ✅ 保留所有 v101.6 功能
// ============================================

import { AppState } from '../../core/state.js';
import {
  listenMembers,
  listenAllMemberExpenses,
  getInsurancePoliciesOnce,
  getInsurancePaymentsOnce,
  getAllMemberExpensesOnce,
} from '../../core/db.js';
import {
  formatHKD, escapeHtml, setText,
} from '../../core/utils.js';
import { renderPageFilter } from '../../shared/page-filter.js';
import { showToast } from '../../shared/toast.js';
import { renderStatsCards } from '../../shared/stats-cards.js';
import { renderDataTable } from '../../shared/data-table.js';
import { createListenerGroup } from '../../shared/listener-group.js';
import { registerPageCleanup } from '../../core/app.js';
import { estimateMonthlyAmount } from '../../shared/insurance-calc.js';

import { mergeSettlementData } from './merge.js';
import {
  renderStatusCell,
  renderSourceBadge,
  getMemberName,
  updateRowStatus,
  setMembersCache,
} from './render.js';

/* ============================================
   Module 狀態
   ============================================ */
let _rows = [];
let _filtered = [];
let _filters = {
  year: '',
  month: '',
  source: '',
  status: '',
  member: '',
};
let _sortMode = 'pending-first';

let _filterInstance = null;
let _statsApi = null;
let _tableApi = null;
let _sortHandler = null;
let _statusChangeHandler = null;

// 🆕 v101.6.6：單月監聽器的 unsubscribe（避免 BUG-01 洩漏）
let _monthlyUnsub = null;

const listenerGroup = createListenerGroup();

/* 表格欄位定義 */
const TABLE_COLUMNS = [
  { id: 'source',   label: '來源',      defaultVisible: true,  defaultWidth: 90 },
  { id: 'yearMonth', label: '年月',      defaultVisible: true,  defaultWidth: 90 },
  { id: 'member',   label: '成員',      defaultVisible: true,  defaultWidth: 90 },
  { id: 'name',     label: '項目名稱',   defaultVisible: true,  defaultWidth: 200 },
  { id: 'amount',   label: '金額',      defaultVisible: true,  defaultWidth: 110 },
  { id: 'date',     label: '日期',      defaultVisible: true,  defaultWidth: 100 },
  { id: 'status',   label: '狀態',      defaultVisible: true,  defaultWidth: 140 },
];

/* ============================================
   主入口
   ============================================ */
export async function initSettlementsPage() {
  _filterInstance = renderPageFilter({
    containerId: 'page-filter-root',
    fields: ['year', 'month'],
    renderExtra: () => `
      <div class="filter-group">
        <label class="field-label">來源</label>
        <select class="select" data-filter="source">
          <option value="">全部</option>
          <option value="personal">🏷 個人支出</option>
          <option value="insurance">🛡 保險扣款</option>
        </select>
      </div>
      <div class="filter-group">
        <label class="field-label">狀態</label>
        <select class="select" data-filter="status">
          <option value="">全部</option>
        </select>
      </div>
      <div class="filter-group">
        <label class="field-label">成員</label>
        <select class="select" data-filter="member">
          <option value="">全部</option>
        </select>
      </div>
    `,
    onChange: (f) => {
      _filters = {
        year: f.year || '',
        month: f.month === 'all' ? '' : (f.month || ''),
        source: f.source || '',
        status: f.status || '',
        member: f.member || '',
      };
      _render();
    },
  });

  // 排序
  _sortHandler = (e) => {
    _sortMode = e.target.value;
    _render();
  };
  document.getElementById('settlement-sort')?.addEventListener('change', _sortHandler);

  // 訂閱成員 → 更新快取
  listenerGroup.add(
    listenMembers((list) => {
      setMembersCache(list);
      _render();
    })
  );

  // 訂閱年月變更
  listenerGroup.add(AppState.on('ym-change', () => _reload()));

  // 綁定狀態變更
  _bindStatusChange();

  // 初次載入
  await _reload();

  registerPageCleanup(_destroy);

  return { destroy: _destroy };
}

/* ============================================
   狀態變更事件委派
   ============================================ */
function _bindStatusChange() {
  const root = document.getElementById('settlement-table-root');
  if (!root) return;

  _statusChangeHandler = async (e) => {
    const sel = e.target.closest('.settlement-status-select');
    if (!sel) return;

    const key = sel.dataset.key;
    const newStatus = sel.value;
    const row = _rows.find((r) => r.key === key);
    if (!row) return;

    try {
      await updateRowStatus(row, newStatus);
      row.status = newStatus;
      row.isDone = newStatus.startsWith('已');
      showToast('✅ 狀態已更新', 'success');
      _render();
    } catch (err) {
      showToast('更新失敗：' + err.message, 'error');
      _render();
    }
  };

  root.addEventListener('change', _statusChangeHandler);
}

/* ============================================
   重新載入
   ============================================ */
async function _reload() {
  const { year, month } = AppState.getYearMonth();
  const isAnnual = month === 'all';

  setText('settlement-month',
    isAnnual ? `${year} 年 全年總覽` : `${year} 年 ${month} 月`);

  if (isAnnual) {
    await _loadAnnual(year);
  } else {
    await _loadMonthly(year, month);
  }
}

/* ============================================
   單月載入
   ============================================ */
async function _loadMonthly(year, month) {
  // 🆕 v101.6.6：先取消舊的 monthly 監聽器（BUG-01 修正）
  if (_monthlyUnsub) {
    try { _monthlyUnsub(); } catch (e) { /* noop */ }
    _monthlyUnsub = null;
  }

  _monthlyUnsub = listenAllMemberExpenses(year, month, async (memberExpenses) => {
    const insuranceRows = await _loadInsurancePaymentsForMonth(year, month);

    _rows = mergeSettlementData({
      memberExpenses,
      insuranceRows,
      year,
      month,
    });

    _render();
  });

  listenerGroup.add(_monthlyUnsub);
}

/* ============================================
   全年載入
   ============================================ */
async function _loadAnnual(year) {
  // 全年模式時，取消單月監聽器
  if (_monthlyUnsub) {
    try { _monthlyUnsub(); } catch (e) { /* noop */ }
    _monthlyUnsub = null;
  }

  const [allExpenses, policies] = await Promise.all([
    _loadAllMemberExpensesForYear(year),
    getInsurancePoliciesOnce(),
  ]);

  const paymentsCache = {};
  await Promise.all(policies.map(async (p) => {
    try {
      paymentsCache[p.id] = await getInsurancePaymentsOnce(p.id);
    } catch (e) {
      paymentsCache[p.id] = {};
    }
  }));

  const allRows = [];
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    const monthExpenses = allExpenses.filter((e) => e.month === mm);
    const insuranceRows = _buildInsuranceRows(policies, paymentsCache, year, mm);

    const rows = mergeSettlementData({
      memberExpenses: monthExpenses,
      insuranceRows,
      year,
      month: mm,
    });
    allRows.push(...rows);
  }

  _rows = allRows;
  _render();
}

/* ============================================
   資料讀取輔助
   ============================================ */
async function _loadAllMemberExpensesForYear(year) {
  const promises = [];
  const result = [];

  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    promises.push(
      getAllMemberExpensesOnce(year, mm).then((list) => {
        list.forEach((e) => {
          e.year = year;
          e.month = mm;
          result.push(e);
        });
      }).catch(() => {})
    );
  }

  await Promise.all(promises);
  return result;
}

async function _loadInsurancePaymentsForMonth(year, month) {
  try {
    const policies = await getInsurancePoliciesOnce();
    const rows = [];

    await Promise.all(policies.map(async (p) => {
      try {
        const payments = await getInsurancePaymentsOnce(p.id);
        const existing = payments?.[year]?.[month];

        if (existing) {
          rows.push(_buildInsuranceRow(p, existing, year, month));
        } else {
          const estimated = estimateMonthlyAmount(p, year, month);
          if (estimated > 0 || p.type === 'fund_insurance') {
            rows.push(_buildInsuranceRow(p, { status: '未扣款', amount: estimated, date: '' }, year, month));
          }
        }
      } catch (e) {
        // 忽略單一保單錯誤
      }
    }));

    return rows;
  } catch (e) {
    return [];
  }
}

function _buildInsuranceRows(policies, paymentsCache, year, month) {
  const rows = [];

  policies.forEach((p) => {
    const existing = paymentsCache[p.id]?.[year]?.[month];

    if (existing) {
      rows.push(_buildInsuranceRow(p, existing, year, month));
    } else {
      const estimated = estimateMonthlyAmount(p, year, month);
      if (estimated > 0 || p.type === 'fund_insurance') {
        rows.push(_buildInsuranceRow(p, { status: '未扣款', amount: estimated, date: '' }, year, month));
      }
    }
  });

  return rows;
}

function _buildInsuranceRow(policy, payment, year, month) {
  return {
    policyId: policy.id,
    policyName: policy.name,
    memberId: policy.memberId,
    policyHolderId: policy.policyHolderId || policy.memberId,
    type: policy.type,
    status: payment.status || '已扣款',
    amount: Number(payment.amount) || 0,
    date: payment.date || '',
  };
}

/* ============================================
   渲染
   ============================================ */
function _render() {
  _filtered = _applyFilters(_rows);
  _filtered = _applySort(_filtered);

  _renderStats();
  _renderTable();
}

/* ============================================
   統計卡
   ============================================ */
function _renderStats() {
  const pending = _filtered.filter((r) => !r.isDone);
  const done = _filtered.filter((r) => r.isDone);

  const pendingTotal = pending.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const doneTotal = done.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const total = pendingTotal + doneTotal;

  const cards = [
    {
      title: '待處理',
      value: formatHKD(pendingTotal),
      valueClass: 'magenta',
      hint: `${pending.length} 筆`,
      icon: 'clock',
    },
    {
      title: '已處理',
      value: formatHKD(doneTotal),
      valueClass: 'emerald',
      hint: `${done.length} 筆`,
      icon: 'check-circle',
    },
    {
      title: '總計',
      value: formatHKD(total),
      valueClass: 'cyan',
      hint: `${_filtered.length} 筆`,
      icon: 'calculator',
    },
  ];

  if (_statsApi) {
    try { _statsApi.destroy(); } catch (e) { /* noop */ }
  }

  _statsApi = renderStatsCards({
    container: 'settlement-stats-root',
    cards,
    columns: 3,
  });
}

/* ============================================
   表格（使用 data-table.js）
   ============================================ */
function _renderTable() {
  const root = document.getElementById('settlement-table-root');
  if (!root) return;

  if (_tableApi) {
    try { _tableApi.destroy(); } catch (e) { /* noop */ }
    _tableApi = null;
  }

  _tableApi = renderDataTable({
    container: root,
    entityKey: '__settlement__',
    rows: _filtered,
    tableId: 'settlement-table',
    options: {
      columns: TABLE_COLUMNS,
      resolvers: {
        source: (_, row) => renderSourceBadge(row),
        yearMonth: (_, row) => `${escapeHtml(row.year)}-${escapeHtml(row.month)}`,
        member: (_, row) => escapeHtml(getMemberName(row)),
        name: (_, row) => escapeHtml(row.name),
        amount: (val) => formatHKD(val),
        date: (val) => escapeHtml(val || '—'),
      },
    },
    hooks: {
      customCellRender: (col, row) => {
        if (col.id === 'status') {
          return renderStatusCell(row);
        }
        return null;
      },
      customActions: () => [],
    },
  });

  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   篩選
   ============================================ */
function _applyFilters(list) {
  return list.filter((r) => {
    if (_filters.year && r.year !== _filters.year) return false;
    if (_filters.month && r.month !== _filters.month) return false;
    if (_filters.source && r.source !== _filters.source) return false;
    if (_filters.status && r.status !== _filters.status) return false;
    if (_filters.member && r.memberId !== _filters.member) return false;
    return true;
  });
}

/* ============================================
   排序
   ============================================ */
function _applySort(list) {
  const arr = [...list];

  switch (_sortMode) {
    case 'date-desc':
      arr.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      break;
    case 'date-asc':
      arr.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      break;
    case 'amount-desc':
      arr.sort((a, b) => b.amount - a.amount);
      break;
    case 'pending-first':
    default:
      arr.sort((a, b) => {
        if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;
        return (b.date || '').localeCompare(a.date || '');
      });
  }

  return arr;
}

/* ============================================
   銷毀
   ============================================ */
function _destroy() {
  listenerGroup.destroy();

  // 🆕 v101.6.6：明確取消 monthly 監聽器
  if (_monthlyUnsub) {
    try { _monthlyUnsub(); } catch (e) { /* noop */ }
    _monthlyUnsub = null;
  }

  if (_filterInstance) {
    try { _filterInstance.destroy(); } catch (e) { /* noop */ }
    _filterInstance = null;
  }
  if (_statsApi) {
    try { _statsApi.destroy(); } catch (e) { /* noop */ }
    _statsApi = null;
  }
  if (_tableApi) {
    try { _tableApi.destroy(); } catch (e) { /* noop */ }
    _tableApi = null;
  }
  if (_sortHandler) {
    document.getElementById('settlement-sort')?.removeEventListener('change', _sortHandler);
    _sortHandler = null;
  }
  if (_statusChangeHandler) {
    const root = document.getElementById('settlement-table-root');
    root?.removeEventListener('change', _statusChangeHandler);
    _statusChangeHandler = null;
  }
}
