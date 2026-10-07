// ============================================
// member-detail.js — 成員個人版面（v101 只讀化）
// 位置：js/pages/member-detail.js
// ============================================
// v101 改動：
//   ✅ 只讀化（不編輯）
//   ✅ 統一由 AppState ym-change 載入
//   ✅ 底部加快速摘要（近 3 月趨勢）
//   ✅ 顯示狀態 badge（依 app-config）
//   ✅ 移除 api.fetchAnnualSummary 過度使用
//     → 直接讀 RTDB 全年 expenses
// ============================================

import {
  getMembersOnce, listenExpenses,
  getIncomeOnce,
} from '../core/db.js';
import { AppState } from '../core/state.js';
import { getStatusesByCategory } from '../config/app-config.js';
import { formatHKD, escapeHtml, getMemberDisplayName } from '../core/utils.js';
import { renderPageFilter } from '../shared/page-filter.js';
import { renderQuickSummary } from '../shared/quick-summary.js';
import { QUICK_SUMMARY_TYPES } from '../config/constants.js';
import { db } from '../config/firebase-config.js';
import { ref, get } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';

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

  // 讀取成員名稱
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

  // 頁面篩選
  _filterInstance = renderPageFilter({
    containerId: 'page-filter-root',
    fields: ['year', 'month'],
  });

  // 統一由 AppState ym-change 觸發
  _unsubscribeYM = AppState.on('ym-change', () => loadData());

  await loadData();

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
   全年模式
   ============================================ */
async function _loadAnnual(year) {
  try {
    const familyId = AppState.getFamilyId();
    const snap = await get(ref(db, `families/${familyId}/expenses/${year}`));
    const data = snap.val() || {};

    const monthlyData = [];
    let total = 0;

    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, '0');
      const memberExpenses = data[mm]?.member_expenses?.[_memberId] || {};
      const items = Object.entries(memberExpenses).map(([id, e]) => ({ id, ...e }));
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

  const container = document.getElementById('annual-monthly-cards');
  if (!container) return;

  if (monthlyData.length === 0) {
    container.innerHTML = `<div class="glass-card"><div class="empty-state">本年度尚無支出紀錄</div></div>`;
    return;
  }

  const cards = monthlyData.map((m) => {
    const rows = m.items.map((it) => `
      <tr>
        <td>${escapeHtml(it.name || '')}</td>
        <td class="num">${formatHKD(it.amount)}</td>
        <td>${_renderStatusBadge(it.status)}</td>
        <td class="mono" style="font-size:11px; color:var(--text-muted);">${escapeHtml(it.date || '—')}</td>
      </tr>
    `).join('');

    return `
      <div class="glass-card" style="margin-bottom:10px; padding:14px;">
        <div class="month-toggle" style="display:flex; justify-content:space-between; align-items:center; gap:12px; cursor:pointer; user-select:none;">
          <div style="font-weight:700; font-size:15px; color:var(--neon-cyan);">${m.monthNum} 月</div>
          <div class="mono text-magenta" style="font-weight:700;">${formatHKD(m.sum)}</div>
        </div>
        <div class="month-detail" style="display:none; margin-top:12px; padding-top:12px; border-top:1px dashed rgba(255,255,255,0.1);">
          <table class="data-table" style="font-size:12px;">
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = cards;

  container.querySelectorAll('.month-toggle').forEach((el) => {
    el.addEventListener('click', () => {
      const d = el.nextElementSibling;
      d.style.display = d.style.display === 'none' ? 'block' : 'none';
    });
  });

  if (window.lucide) window.lucide.createIcons();
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
        <td>${_renderStatusBadge(x.status)}</td>
        <td class="mono" style="font-size:12px; color:var(--text-muted);">${escapeHtml(x.date || '—')}</td>
      </tr>
    `;
  }).join('');

  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   狀態 badge（依 app-config）
   ============================================ */
function _renderStatusBadge(status) {
  const statuses = getStatusesByCategory('personal');
  const s = statuses.find((x) => x.name === status);
  const isDone = s ? !!s.isDone : (status && status.startsWith('已'));
  const cls = isDone ? 'badge-success' : 'badge-pending';
  return `<span class="badge ${cls}">${escapeHtml(status || '未處理')}</span>`;
}

/* ============================================
   快速摘要（近 3 月趨勢）
   ============================================ */
async function _renderQuickSummary(year, month, isAnnual) {
  const root = document.getElementById('quick-summary-root');
  if (!root) return;

  if (isAnnual) {
    root.innerHTML = '';
    return;
  }

  // 取近 3 個月
  const months = _getLast3Months(year, month);

  try {
    const familyId = AppState.getFamilyId();
    const data = {};

    await Promise.all(months.map(async ({ year: y, month: mm }) => {
      const snap = await get(ref(db, `families/${familyId}/expenses/${y}/${mm}/member_expenses/${_memberId}`));
      data[`${y}-${mm}`] = snap.val() || {};
    }));

    const values = months.map(({ year: y, month: mm }) => {
      const items = Object.values(data[`${y}-${mm}`] || {});
      return items.reduce((s, x) => s + (Number(x.amount) || 0), 0);
    });

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
}