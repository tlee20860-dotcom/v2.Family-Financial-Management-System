// ============================================
// member-detail.js — 成員個人版面（v101.5）
// 位置：js/pages/member-detail.js
// ============================================
// v101.5 修正：
//   ✅ 狀態 badge 改用 entity-helpers 的 renderStatusBadge
//   ✅ 使用 registerPageCleanup 註冊清理
//   ✅ 年度折疊卡改用 annual-month-cards.js
//   ✅ 快速摘要使用共用 builder
// ============================================

import {
  getMembersOnce,
  listenExpenses,
  getMemberExpensesForYear,
} from '../core/db.js';
import { AppState } from '../core/state.js';
import { formatHKD, escapeHtml } from '../core/utils.js';
import { renderPageFilter } from '../shared/page-filter.js';
import { renderQuickSummary } from '../shared/quick-summary.js';
import { renderAnnualMonthCards } from '../shared/annual-month-cards.js';
import { renderStatusBadge } from '../shared/entity-helpers.js';
import { QUICK_SUMMARY_TYPES } from '../config/constants.js';
import { registerPageCleanup } from '../core/app.js';

/* ============================================
   Module 狀態
   ============================================ */
let _memberId = '';
let _memberName = '';
let _members = [];
let _expenses = [];
let _unsubExpenses = null;
let _unsubscribeYM = null;
let _filterInstance = null;
let _annualCardsInstance = null;

/* ============================================
   主入口
   ============================================ */
export async function initMemberDetailPage(id) {
  _memberId = id;

  if (!AppState.getFamilyId()) {
    _showError('錯誤：未選擇家庭');
    return;
  }

  if (!_memberId) {
    document.getElementById('member-name').textContent = '未指定成員';
    return;
  }

  try {
    _members = await getMembersOnce();
    const me = _members.find((m) => m.id === _memberId);
    if (me) {
      _memberName = me.name;
      document.getElementById('member-name').textContent = me.name;
      document.title = `${me.name} | 家庭財務`;
    } else {
      document.getElementById('member-name').textContent = '（成員已不存在）';
    }
  } catch (err) {
    document.getElementById('member-name').textContent = '（無法讀取成員）';
  }

  const idLabel = document.getElementById('member-id-label');
  if (idLabel) idLabel.textContent = `ID：${_memberId}`;

  _filterInstance = renderPageFilter({
    containerId: 'page-filter-root',
    fields: ['year', 'month'],
  });

  _unsubscribeYM = AppState.on('ym-change', () => loadData());

  await loadData();

  registerPageCleanup(_destroy);

  return { destroy: _destroy };
}

/* ============================================
   載入
   ============================================ */
async function loadData() {
  const { year, month } = AppState.getYearMonth();
  const isAnnual = month === 'all';

  const annualEl = document.getElementById('annual-view');
  const monthlyEl = document.getElementById('monthly-view');

  if (annualEl) annualEl.style.display = isAnnual ? 'block' : 'none';
  if (monthlyEl) monthlyEl.style.display = isAnnual ? 'none' : 'block';

  if (isAnnual) {
    await _loadAnnual(year);
  } else {
    await _loadMonthly(year, month);
  }

  _renderQuickSummary(year, month, isAnnual);
}

/* ============================================
   全年模式（使用 annual-month-cards）
   ============================================ */
async function _loadAnnual(year) {
  try {
    const yearData = await getMemberExpensesForYear(year, _memberId);

    const monthlyData = [];
    let total = 0;

    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, '0');
      const items = yearData[mm] || [];
      items.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

      const sum = items.reduce((s, x) => s + (Number(x.amount) || 0), 0);
      if (items.length > 0) {
        total += sum;
        monthlyData.push({ monthNum: m, month: mm, items, sum });
      }
    }

    _renderAnnual(year, monthlyData, total);
  } catch (err) {
    console.error('[member-detail] 全年載入失敗：', err);
    const container = document.getElementById('annual-monthly-cards');
    if (container) {
      container.innerHTML = `<div class="glass-card"><div class="empty-state text-red">載入失敗：${escapeHtml(err.message)}</div></div>`;
    }
  }
}

function _renderAnnual(year, monthlyData, total) {
  const totalEl = document.getElementById('annual-total');
  if (totalEl) totalEl.textContent = formatHKD(total);

  // 銷毀舊的實例
  if (_annualCardsInstance) {
    try { _annualCardsInstance.destroy(); } catch (e) { /* noop */ }
    _annualCardsInstance = null;
  }

  // 建立 monthNum → data 的 map
  const dataMap = {};
  monthlyData.forEach((m) => { dataMap[m.monthNum] = m; });

  _annualCardsInstance = renderAnnualMonthCards('annual-monthly-cards', {
    storageKey: `member-detail-annual-${_memberId}`,
    getMonthData: (monthNum) => {
      const data = dataMap[monthNum];
      if (!data) return null;

      const rows = data.items.map((it) => `
        <div class="annual-month-row">
          <span>${escapeHtml(it.name || '')}</span>
          <span class="mono text-emerald">${formatHKD(it.amount)}</span>
        </div>
      `).join('');

      return {
        title: `${monthNum} 月`,
        total: data.sum,
        detailHtml: rows,
      };
    },
    emptyText: '本年度尚無支出紀錄',
  });
}

/* ============================================
   單月模式
   ============================================ */
async function _loadMonthly(year, month) {
  const monthLabel = document.getElementById('expense-month-label');
  if (monthLabel) monthLabel.textContent = `${year} 年 ${month} 月`;

  if (_unsubExpenses) {
    try { _unsubExpenses(); } catch (e) { /* noop */ }
    _unsubExpenses = null;
  }

  _unsubExpenses = listenExpenses(year, month, _memberId, (list) => {
    _expenses = list;
    _renderExpenses();
  });
}

function _renderExpenses() {
  const tbody = document.getElementById('expense-tbody');
  if (!tbody) return;

  const total = _expenses.reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const totalEl = document.getElementById('expense-total');
  if (totalEl) totalEl.textContent = formatHKD(total);

  if (_expenses.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-state">尚無支出紀錄</td></tr>`;
    return;
  }

  tbody.innerHTML = _expenses.map((x) => {
    const autoBadge = x.isAutoLinked
      ? '<span class="badge badge-info" style="margin-left:6px;">保險連動</span>'
      : '';

    return `
      <tr>
        <td>${escapeHtml(x.name || '')}${autoBadge}</td>
        <td class="num">${formatHKD(x.amount)}</td>
        <td>${renderStatusBadge(x.status, 'personal')}</td>
        <td class="mono" style="font-size:12px; color:var(--text-muted);">${escapeHtml(x.date || '—')}</td>
      </tr>
    `;
  }).join('');

  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   快速摘要
   ============================================ */
async function _renderQuickSummary(year, month, isAnnual) {
  const root = document.getElementById('quick-summary-root');
  if (!root) return;

  if (isAnnual) {
    root.innerHTML = '';
    return;
  }

  const months = _getLast3Months(year, month);

  try {
    const results = await Promise.all(
      months.map(({ year: y, month: mm }) =>
        getMemberExpensesForYear(y, _memberId).then((data) => data[mm] || [])
          .catch(() => [])
      )
    );

    const values = results.map((items) =>
      items.reduce((s, x) => s + (Number(x.amount) || 0), 0)
    );

    const monthLabels = months.map(({ year: y, month: mm }) => `${y}-${mm}`);

    renderQuickSummary({
      containerId: 'quick-summary-root',
      type: QUICK_SUMMARY_TYPES.MEMBER_TREND,
      title: `${_memberName} 近 3 個月支出趨勢`,
      icon: 'trending-up',
      data: {
        months: monthLabels,
        members: [{
          name: _memberName,
          values,
        }],
      },
    });
  } catch (err) {
    console.warn('[member-detail] 快速摘要載入失敗：', err);
    root.innerHTML = '';
  }
}

function _getLast3Months(year, month) {
  const y = Number(year);
  const m = Number(month);
  const result = [];

  for (let i = 2; i >= 0; i--) {
    let targetM = m - i;
    let targetY = y;
    while (targetM < 1) {
      targetM += 12;
      targetY -= 1;
    }
    result.push({
      year: String(targetY),
      month: String(targetM).padStart(2, '0'),
    });
  }
  return result;
}

/* ============================================
   錯誤
   ============================================ */
function _showError(msg) {
  document.getElementById('member-name').textContent = msg;
  const tbody = document.getElementById('expense-tbody');
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-state text-red">${msg}</td></tr>`;
  }
}

/* ============================================
   銷毀
   ============================================ */
function _destroy() {
  if (_unsubExpenses) {
    try { _unsubExpenses(); } catch (e) { /* noop */ }
    _unsubExpenses = null;
  }
  if (_unsubscribeYM) {
    try { _unsubscribeYM(); } catch (e) { /* noop */ }
    _unsubscribeYM = null;
  }
  if (_filterInstance) {
    try { _filterInstance.destroy(); } catch (e) { /* noop */ }
    _filterInstance = null;
  }
  if (_annualCardsInstance) {
    try { _annualCardsInstance.destroy(); } catch (e) { /* noop */ }
    _annualCardsInstance = null;
  }
}