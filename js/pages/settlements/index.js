// ============================================
// index.js — 結算清單入口（v101.3）
// 位置：js/pages/settlements/index.js
// ============================================
// v101.3 修正：
//   ✅ 加入 listenMembers 監聽 + setMembersCache
//     → render.js 的 _getMemberName 可取得真實成員名稱
// ============================================

import { AppState } from '../../core/state.js';
import {
  listenMembers,
  listenAllMemberExpenses,
  getFixedExpensesOnce,
  getInsurancePoliciesOnce,
  getInsurancePaymentsOnce,
  getAllMemberExpensesOnce,
} from '../../core/db.js';
import { renderPageFilter } from '../../shared/page-filter.js';
import { initViewToggle } from '../../shared/view-toggle.js';
import { showToast } from '../../shared/toast.js';
import { mergeSettlementData } from './merge.js';
import {
  renderSettlementTable,
  renderSettlementCards,
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

let _unsubExpenses = null;
let _unsubMembers = null;
let _unsubYM = null;
let _filterInstance = null;
let _viewToggle = null;

/* ============================================
   主入口
   ============================================ */
export async function initSettlementsPage() {
  // 檢視切換
  _viewToggle = initViewToggle({
    containerId: 'view-toggle-root',
    storageKey: 'settlements-view',
    defaultView: 'table',
    cardText: '卡片',
    tableText: '表格',
    autoApply: false,
    onChange: () => _render(),
  });

  // 頁面篩選欄
  _filterInstance = renderPageFilter({
    containerId: 'page-filter-root',
    fields: ['year', 'month'],
    renderExtra: () => `
      <div class="filter-group">
        <label class="field-label">來源</label>
        <select class="select" data-filter="source">
          <option value="">全部</option>
          <option value="personal">🏷 個人支出</option>
          <option value="fixed">📋 固定支出</option>
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

  // 排序切換
  document.getElementById('settlement-sort')?.addEventListener('change', (e) => {
    _sortMode = e.target.value;
    _render();
  });

  // 綁定狀態變更（事件委派）
  _bindStatusChange();

  // 🆕 v101.3：監聽成員 → 更新 membersCache
  _unsubMembers = listenMembers((list) => {
    setMembersCache(list);
    _render();  // 成員名稱更新後重繪
  });

  // 統一由 AppState 觸發
  _unsubYM = AppState.on('ym-change', () => _reload());

  // 初次載入
  await _reload();

  return {
    destroy: _destroy,
  };
}

/* ============================================
   狀態變更事件委派
   ============================================ */
function _bindStatusChange() {
  const cardEl = document.getElementById('settlements-card-view');
  const tableEl = document.getElementById('settlements-table-view');

  const handler = async (e) => {
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

  cardEl?.addEventListener('change', handler);
  tableEl?.addEventListener('change', handler);
}

/* ============================================
   重新載入
   ============================================ */
async function _reload() {
  const { year, month } = AppState.getYearMonth();
  const isAnnual = month === 'all';

  const monthEl = document.getElementById('settlement-month');
  if (monthEl) {
    monthEl.textContent = isAnnual
      ? `${year} 年 全年總覽`
      : `${year} 年 ${month} 月`;
  }

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
  if (_unsubExpenses) {
    try { _unsubExpenses(); } catch (e) { /* noop */ }
    _unsubExpenses = null;
  }

  _unsubExpenses = listenAllMemberExpenses(year, month, async (memberExpenses) => {
    const [fixedExpenses, insuranceRows] = await Promise.all([
      _loadFixed(year, month),
      _loadInsurancePaymentsForMonth(year, month),
    ]);

    _rows = mergeSettlementData({
      memberExpenses,
      fixedExpenses,
      insuranceRows,
      year,
      month,
    });

    _render();
  });
}

/* ============================================
   全年載入
   ============================================ */
async function _loadAnnual(year) {
  if (_unsubExpenses) {
    try { _unsubExpenses(); } catch (e) { /* noop */ }
    _unsubExpenses = null;
  }

  const [allExpenses, allFixed, policies] = await Promise.all([
    _loadAllMemberExpensesForYear(year),
    _loadFixedForYear(year),
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
    const monthFixed = allFixed[mm] || [];
    const insuranceRows = _buildInsuranceRows(policies, paymentsCache, year, mm);

    const rows = mergeSettlementData({
      memberExpenses: monthExpenses,
      fixedExpenses: monthFixed,
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

async function _loadFixedForYear(year) {
  const result = {};
  const promises = [];

  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    promises.push(
      getFixedExpensesOnce(year, mm).then((list) => {
        result[mm] = list;
      }).catch(() => {
        result[mm] = [];
      })
    );
  }

  await Promise.all(promises);
  return result;
}

async function _loadFixed(year, month) {
  try {
    return await getFixedExpensesOnce(year, month);
  } catch (e) {
    return [];
  }
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
          rows.push({
            policyId: p.id,
            policyName: p.name,
            memberId: p.memberId,
            type: p.type,
            status: existing.status || '已扣款',
            amount: Number(existing.amount) || 0,
            date: existing.date || '',
          });
        } else {
          const estimated = _estimateMonthlyAmount(p, year, month);
          if (estimated > 0 || p.type === 'fund_insurance') {
            rows.push({
              policyId: p.id,
              policyName: p.name,
              memberId: p.memberId,
              type: p.type,
              status: '未扣款',
              amount: estimated,
              date: '',
            });
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
      rows.push({
        policyId: p.id,
        policyName: p.name,
        memberId: p.memberId,
        type: p.type,
        status: existing.status || '已扣款',
        amount: Number(existing.amount) || 0,
        date: existing.date || '',
      });
    } else {
      const estimated = _estimateMonthlyAmount(p, year, month);
      if (estimated > 0 || p.type === 'fund_insurance') {
        rows.push({
          policyId: p.id,
          policyName: p.name,
          memberId: p.memberId,
          type: p.type,
          status: '未扣款',
          amount: estimated,
          date: '',
        });
      }
    }
  });

  return rows;
}

function _estimateMonthlyAmount(policy, year, month) {
  if (policy.type === 'fund_insurance') {
    return Math.round(Number(policy.monthlyPremium) || 0);
  }

  const y = Number(year);
  const m = Number(month);
  const firstY = Number(policy.firstStartYear) || 0;
  const firstM = Number(policy.firstStartMonth) || 1;
  if (!firstY) return 0;

  const totalMonths = (y - firstY) * 12 + (m - firstM);
  if (totalMonths < 0) return 0;

  const periodIndex = Math.floor(totalMonths / 12) + 1;
  if (policy.totalPolicyYears && periodIndex > policy.totalPolicyYears) return 0;

  const periodData = (policy.periods || {})[String(periodIndex)];
  if (periodData && periodData.monthlyAverage) {
    return Math.round(Number(periodData.monthlyAverage) || 0);
  }

  const periodKeys = Object.keys(policy.periods || {})
    .map(Number)
    .filter((n) => !isNaN(n) && n > 0)
    .sort((a, b) => a - b);

  if (periodKeys.length > 0) {
    const below = periodKeys.filter((k) => k <= periodIndex);
    const target = below.length > 0 ? below[below.length - 1] : periodKeys[0];
    const tp = policy.periods[String(target)];
    if (tp && tp.monthlyAverage) return Math.round(Number(tp.monthlyAverage));
  }

  return Math.round(Number(policy.monthlyAverage) || 0);
}

/* ============================================
   渲染
   ============================================ */
function _render() {
  _filtered = _applyFilters(_rows);
  _filtered = _applySort(_filtered);

  _renderStats();

  const view = _viewToggle?.getView() || 'table';
  const cardEl = document.getElementById('settlements-card-view');
  const tableEl = document.getElementById('settlements-table-view');
  if (!cardEl || !tableEl) return;

  const countEl = document.getElementById('settlement-count');
  if (countEl) countEl.textContent = `（共 ${_filtered.length} 筆）`;

  if (view === 'card') {
    cardEl.style.display = 'block';
    tableEl.style.display = 'none';
    renderSettlementCards(cardEl, _filtered);
  } else {
    cardEl.style.display = 'none';
    tableEl.style.display = 'block';
    renderSettlementTable(tableEl, _filtered);
  }

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
    if (_filters.member && r.source === 'personal' && r.memberId !== _filters.member) return false;
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
   統計
   ============================================ */
function _renderStats() {
  const pending = _filtered.filter((r) => !r.isDone);
  const done = _filtered.filter((r) => r.isDone);

  const pendingTotal = pending.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const doneTotal = done.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const total = pendingTotal + doneTotal;

  _setText('settlement-pending-total', _fmt(pendingTotal));
  _setText('settlement-pending-count', `${pending.length} 筆`);
  _setText('settlement-done-total', _fmt(doneTotal));
  _setText('settlement-done-count', `${done.length} 筆`);
  _setText('settlement-grand-total', _fmt(total));
  _setText('settlement-grand-count', `${_filtered.length} 筆`);
}

/* ============================================
   工具
   ============================================ */
function _setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function _fmt(n) {
  if (n == null || isNaN(n)) return 'HK$ 0';
  return 'HK$ ' + Math.round(Number(n)).toLocaleString('zh-HK');
}

/* ============================================
   銷毀
   ============================================ */
function _destroy() {
  if (_unsubExpenses) {
    try { _unsubExpenses(); } catch (e) { /* noop */ }
    _unsubExpenses = null;
  }
  if (_unsubMembers) {
    try { _unsubMembers(); } catch (e) { /* noop */ }
    _unsubMembers = null;
  }
  if (_unsubYM) {
    try { _unsubYM(); } catch (e) { /* noop */ }
    _unsubYM = null;
  }
  if (_filterInstance) {
    try { _filterInstance.destroy(); } catch (e) { /* noop */ }
    _filterInstance = null;
  }
  if (_viewToggle) {
    try { _viewToggle.destroy(); } catch (e) { /* noop */ }
    _viewToggle = null;
  }
}
