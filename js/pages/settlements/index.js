// ============================================
// index.js — 結算清單入口（v101）
// 位置：js/pages/settlements/index.js
// ============================================
// 用途：
//   合併「個人支出 + 固定支出 + 保險扣款」成一張大表
//   支援篩選（年月 / 來源 / 狀態 / 成員）
//   支援改狀態（連動各版面）
//
// 設計：
//   - 單一資料流：AppState ym-change 觸發重載
//   - 資料合併 → merge.js
//   - 渲染 → render.js
// ============================================

import { AppState } from '../../core/state.js';
import {
  listenAllMemberExpenses,
  getFixedExpensesOnce,
  getInsurancePoliciesOnce,
  getInsurancePaymentsOnce,
} from '../../core/db.js';
import { renderPageFilter } from '../../shared/page-filter.js';
import { initViewToggle } from '../../shared/view-toggle.js';
import { showToast } from '../../shared/toast.js';
import { mergeSettlementData } from './merge.js';
import { renderSettlementTable, renderSettlementCards, renderSummary } from './render.js';

/* ============================================
   Module 狀態
   ============================================ */
let _members = [];
let _categories = [];
let _paymentMethods = [];

let _rows = [];                 // 合併後的所有列
let _filtered = [];             // 篩選後
let _filters = {
  year: '',
  month: '',
  source: '',                   // '' | 'personal' | 'fixed' | 'insurance'
  status: '',
  member: '',
};
let _sortMode = 'pending-first';  // 'pending-first' | 'date-desc' | 'date-asc' | 'amount-desc'

let _unsubExpenses = null;
let _unsubYM = null;
let _filterInstance = null;
let _viewToggle = null;

/* ============================================
   主入口
   ============================================ */
export async function initSettlementsPage() {
  // 檢視切換（卡片 / 表格）
  _viewToggle = initViewToggle({
    containerId: 'view-toggle-root',
    storageKey: 'settlements-view',
    defaultView: 'table',
    cardText: '卡片',
    tableText: '表格',
    autoApply: false,
    onChange: () => _render(),
  });

  // 頁面篩選欄（年 / 月 + 來源 / 狀態 / 成員）
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

  // 統一由 AppState 觸發
  _unsubYM = AppState.on('ym-change', () => _reload());

  // 初次載入
  await _reload();

  return {
    destroy: _destroy,
  };
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

  // 若為全年模式 → 逐月合併；否則只抓單月
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
  // 取消舊監聽
  if (_unsubExpenses) {
    try { _unsubExpenses(); } catch (e) { /* noop */ }
    _unsubExpenses = null;
  }

  // 立即監聽個人支出（即時）
  _unsubExpenses = listenAllMemberExpenses(year, month, async (memberExpenses) => {
    // 讀取該月的固定支出 + 保險扣款
    const [fixedExpenses, insuranceRows] = await Promise.all([
      _loadFixed(year, month),
      _loadInsurancePayments(year, month),
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

  const allRows = [];
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    const [expenses, fixed, insuranceRows] = await Promise.all([
      _loadMemberExpenses(year, mm),
      _loadFixed(year, mm),
      _loadInsurancePayments(year, mm),
    ]);

    const rows = mergeSettlementData({
      memberExpenses: expenses,
      fixedExpenses: fixed,
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
async function _loadMemberExpenses(year, month) {
  // 動態載入該月所有成員支出（非監聽）
  return new Promise((resolve) => {
    const unsub = listenAllMemberExpenses(year, month, (list) => {
      unsub();
      resolve(list);
    }, () => resolve([]));
  });
}

async function _loadFixed(year, month) {
  try {
    return await getFixedExpensesOnce(year, month);
  } catch (e) {
    return [];
  }
}

async function _loadInsurancePayments(year, month) {
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

/* ============================================
   渲染
   ============================================ */
function _render() {
  // 篩選
  _filtered = _applyFilters(_rows);

  // 排序
  _filtered = _applySort(_filtered);

  // 統計
  _renderStats();

  // 表格 / 卡片
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
    // 成員只過濾個人支出
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
        // 未處理置頂
        if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;
        // 其次依日期新→舊
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

  _setText('settlement-pending-total', formatHKD(pendingTotal));
  _setText('settlement-pending-count', `${pending.length} 筆`);
  _setText('settlement-done-total', formatHKD(doneTotal));
  _setText('settlement-done-count', `${done.length} 筆`);
  _setText('settlement-grand-total', formatHKD(total));
  _setText('settlement-grand-count', `${_filtered.length} 筆`);
}

/* ============================================
   工具
   ============================================ */
function _setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function formatHKD(n) {
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
// 在 _render() 最後加：
import { bindStatusChangeEvents, updateRowStatus } from './render.js';

// ... 在 render 函式內，view 分支之後：

// 綁定狀態變更（只綁一次）
if (!window._settlementStatusBound) {
  window._settlementStatusBound = true;
  document.addEventListener('change', async (e) => {
    const sel = e.target.closest('.settlement-status-select');
    if (!sel) return;
    const key = sel.dataset.key;
    const newStatus = sel.value;
    const row = _rows.find((r) => r.key === key);
    if (!row) return;
    try {
      await updateRowStatus(row, newStatus);
      // 更新本地資料
      row.status = newStatus;
      row.isDone = newStatus.startsWith('已');
      showToast('✅ 狀態已更新', 'success');
      _render();
    } catch (err) {
      showToast('更新失敗：' + err.message, 'error');
      _render(); // 還原
    }
  });
}