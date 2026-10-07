// ============================================
// income.js — 每月收入明細（v101 只讀化）
// 位置：js/pages/income.js
// ============================================
// v101 改動：
//   ✅ 移除新增 / 編輯 / 刪除（移至綜合輸入中心）
//   ✅ 保留卡片 / 表格雙模式
//   ✅ 統一由 AppState ym-change 載入
//   ✅ 加「前往輸入中心」按鈕
//   ✅ 年度明細彈窗改為 Promise.all（避免序列查詢）
//   ✅ 底部快速摘要（月度收入趨勢）
// ============================================

import {
  listenMembers, listenAllIncome, getIncomeOnce,
} from '../core/db.js';
import { AppState } from '../core/state.js';
import { RESERVED_IDS } from '../config/constants.js';
import {
  escapeHtml, formatHKD, sortMembers, getMemberDisplayName,
} from '../core/utils.js';
import { renderPageFilter } from '../shared/page-filter.js';
import { initViewToggle } from '../shared/view-toggle.js';
import { renderQuickSummary } from '../shared/quick-summary.js';
import { QUICK_SUMMARY_TYPES } from '../config/constants.js';
import { openModal, closeModal } from '../shared/modal.js';

/* ============================================
   Module 狀態
   ============================================ */
let _members = [];
let _allIncome = [];
let _filters = { year: '', month: '', member: '' };
let _viewToggle = null;
let _filterInstance = null;
let _unsubscribers = [];

/* ============================================
   主入口
   ============================================ */
export async function initIncomePage() {
  // 檢視切換
  _viewToggle = initViewToggle({
    containerId: 'view-toggle-root',
    storageKey: 'income-view',
    defaultView: 'card',
    cardText: '卡片',
    tableText: '表格',
    autoApply: false,
    onChange: () => _render(),
  });

  // 前往輸入中心
  document.getElementById('go-input-center-btn')?.addEventListener('click', () => {
    window.location.href = 'input-center.html';
  });

  // 頁面篩選
  _filterInstance = renderPageFilter({
    containerId: 'page-filter-root',
    fields: ['year', 'month'],
    renderExtra: () => `
      <div class="filter-group">
        <label class="field-label">成員</label>
        <select class="select" data-filter="member">
          <option value="">全部</option>
          <option value="extra">額外收入</option>
          ${_members.map((m) => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('')}
        </select>
      </div>
    `,
    onChange: (f) => {
      _filters = {
        year: f.year || '',
        month: f.month === 'all' ? '' : (f.month || ''),
        member: f.member || '',
      };
      _render();
    },
  });

  // 年度明細按鈕
  document.getElementById('view-annual-income-btn')?.addEventListener('click', _openAnnualModal);
  document.getElementById('income-detail-cancel-btn')?.addEventListener('click', () => closeModal('income-detail-modal'));

  // 資料監聽
  _unsubscribers.push(
    listenMembers((list) => {
      _members = sortMembers(list);
      _updateFilterOptions();
    })
  );

  _unsubscribers.push(
    listenAllIncome((list) => {
      _allIncome = list;
      _render();
    })
  );

  return {
    destroy: _destroy,
  };
}

/* ============================================
   篩選欄更新
   ============================================ */
function _updateFilterOptions() {
  const root = document.getElementById('page-filter-root');
  if (!root) return;

  const memberSel = root.querySelector('select[data-filter="member"]');
  if (memberSel) {
    const cur = memberSel.value;
    memberSel.innerHTML = `<option value="">全部</option>` +
      `<option value="extra">額外收入</option>` +
      _members.map((m) => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('');
    if (cur && (cur === 'extra' || _members.some((m) => m.id === cur))) memberSel.value = cur;
  }
}

/* ============================================
   渲染
   ============================================ */
function _render() {
  const filtered = _filteredList();
  const view = _viewToggle?.getView() || 'card';

  const cardEl = document.getElementById('income-card-view');
  const tableEl = document.getElementById('income-table-view');
  if (!cardEl || !tableEl) return;

  const countEl = document.getElementById('income-total-count');
  if (countEl) countEl.textContent = `（共 ${filtered.length} 筆）`;

  if (view === 'card') {
    cardEl.style.display = 'block';
    tableEl.style.display = 'none';
    _renderCards(filtered, cardEl);
  } else {
    cardEl.style.display = 'none';
    tableEl.style.display = 'block';
    _renderTable(filtered, tableEl);
  }

  _renderQuickSummary(filtered);

  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   過濾
   ============================================ */
function _filteredList() {
  return _allIncome
    .filter((x) => {
      if (_filters.year && x.year !== _filters.year) return false;
      if (_filters.month && x.month !== _filters.month) return false;
      if (_filters.member && x.memberId !== _filters.member) return false;
      return true;
    })
    .sort((a, b) => {
      if (a.year !== b.year) return b.year.localeCompare(a.year);
      if (a.month !== b.month) return b.month.localeCompare(a.month);
      if (a.memberId === RESERVED_IDS.EXTRA_INCOME) return 1;
      if (b.memberId === RESERVED_IDS.EXTRA_INCOME) return -1;
      return 0;
    });
}

/* ============================================
   卡片模式
   ============================================ */
function _renderCards(list, container) {
  if (list.length === 0) {
    container.innerHTML = `<div class="glass-card"><div class="empty-state">沒有符合條件的收入紀錄</div></div>`;
    return;
  }

  // 依年月分組
  const groups = {};
  list.forEach((x) => {
    const key = `${x.year}-${x.month}`;
    if (!groups[key]) groups[key] = { year: x.year, month: x.month, items: [] };
    groups[key].items.push(x);
  });

  const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  container.innerHTML = sortedKeys.map((key) => {
    const g = groups[key];
    const total = g.items.reduce((s, x) => s + (Number(x.amount) || 0), 0);

    return `
      <div class="glass-card" style="margin-bottom:12px; padding:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; padding-bottom:10px; border-bottom:1px dashed rgba(255,255,255,0.08);">
          <div style="font-size:14px; font-weight:700; color:var(--neon-cyan);">
            ${escapeHtml(g.year)} 年 ${escapeHtml(g.month)} 月
          </div>
          <div class="mono text-emerald" style="font-weight:700; font-size:14px;">
            ${formatHKD(total)}
          </div>
        </div>
        <div style="display:flex; flex-direction:column; gap:6px;">
          ${g.items.map((x) => {
            const memberName = x.memberId === RESERVED_IDS.EXTRA_INCOME
              ? '<span class="badge badge-info">額外收入</span>'
              : escapeHtml(getMemberDisplayName(x.memberId, _members));
            return `
              <div style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
                <span style="font-size:13px; color:var(--text-secondary);">${memberName}</span>
                <span class="mono text-emerald" style="font-size:13px; font-weight:600;">${formatHKD(x.amount)}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');
}

/* ============================================
   表格模式
   ============================================ */
function _renderTable(list, container) {
  if (list.length === 0) {
    container.innerHTML = `<div class="glass-card"><div class="empty-state">沒有符合條件的收入紀錄</div></div>`;
    return;
  }

  container.innerHTML = `
    <div class="glass-card collapsible-card collapsible-card-flat" style="padding:0;">
      <div style="overflow-x:auto;">
        <table class="data-table income-table mobile-cards">
          <thead>
            <tr>
              <th style="width:80px;">年份</th>
              <th style="width:80px;">月份</th>
              <th>成員</th>
              <th class="num" style="width:140px;">金額（HK$）</th>
            </tr>
          </thead>
          <tbody>
            ${list.map((x) => {
              const memberName = x.memberId === RESERVED_IDS.EXTRA_INCOME
                ? '<span class="badge badge-info">額外收入</span>'
                : escapeHtml(getMemberDisplayName(x.memberId, _members));
              return `
                <tr>
                  <td class="income-ym-cell" data-label="年份">${escapeHtml(x.year)}</td>
                  <td class="income-ym-cell" data-label="月份">${escapeHtml(x.month)}</td>
                  <td data-primary="1">${memberName}</td>
                  <td class="num text-emerald" data-label="金額">${formatHKD(x.amount)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/* ============================================
   快速摘要（近 6 月收入趨勢）
   ============================================ */
function _renderQuickSummary(list) {
  const root = document.getElementById('quick-summary-root');
  if (!root) return;

  if (list.length === 0) {
    root.innerHTML = '';
    return;
  }

  // 依年月分組
  const byYM = {};
  list.forEach((x) => {
    const key = `${x.year}-${x.month}`;
    if (!byYM[key]) byYM[key] = 0;
    byYM[key] += Number(x.amount) || 0;
  });

  // 取最近 6 個月
  const keys = Object.keys(byYM).sort((a, b) => a.localeCompare(b)).slice(-6);
  if (keys.length === 0) {
    root.innerHTML = '';
    return;
  }

  const values = keys.map((k) => byYM[k]);
  const total = values.reduce((s, x) => s + x, 0);
  const avg = Math.round(total / values.length);

  const rows = keys.map((k, i) => {
    const [y, m] = k.split('-');
    return {
      key: k,
      title: `${y} 年 ${m} 月`,
      subtitle: `平均 ${formatHKD(avg)}`,
      amount: values[i],
      badge: '',
    };
  });

  renderQuickSummary({
    containerId: 'quick-summary-root',
    type: QUICK_SUMMARY_TYPES.RECENT_ACTIVITY,
    title: '最近收入紀錄',
    icon: 'trending-up',
    data: rows,
  });
}

/* ============================================
   年度明細彈窗（一次載入 12 個月）
   ============================================ */
async function _openAnnualModal() {
  const year = _filters.year || AppState.year;
  const titleEl = document.getElementById('income-detail-title');
  if (titleEl) titleEl.textContent = `${year} 年度收入明細`;

  const body = document.getElementById('income-detail-body');
  if (!body) return;

  body.innerHTML = `<div class="empty-state">載入中…</div>`;
  openModal('income-detail-modal');

  try {
    // 平行載入 12 個月（避免序列）
    const promises = [];
    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, '0');
      promises.push(getIncomeOnce(year, mm));
    }
    const results = await Promise.all(promises);

    // 建立表頭
    let header = '<tr><th style="padding:8px; border-bottom:1px solid var(--glass-border); position:sticky; left:0; background:var(--bg-navy); z-index:2; min-width:60px;">月份</th>';
    _members.forEach((m) => {
      header += `<th style="padding:8px; text-align:right; border-bottom:1px solid var(--glass-border); min-width:100px;">${escapeHtml(m.name)}</th>`;
    });
    header += '<th style="padding:8px; text-align:right; border-bottom:1px solid var(--glass-border); min-width:100px;">額外</th>';
    header += '<th style="padding:8px; text-align:right; border-bottom:1px solid var(--glass-border); min-width:100px;">小計</th></tr>';

    // 建立資料列（唯讀）
    let rows = '';
    for (let m = 1; m <= 12; m++) {
      const data = results[m - 1] || {};
      let rowTotal = 0;
      let row = `<tr><td style="padding:8px; font-family:var(--font-mono); font-size:12px; position:sticky; left:0; background:var(--bg-navy); z-index:1; border-bottom:1px solid rgba(255,255,255,0.04);">${m}月</td>`;

      _members.forEach((mem) => {
        const val = Number(data[mem.id]) || 0;
        rowTotal += val;
        row += `<td style="padding:8px; text-align:right; font-family:var(--font-mono); font-size:12px; border-bottom:1px solid rgba(255,255,255,0.04);">${val > 0 ? formatHKD(val) : '<span class="text-muted">—</span>'}</td>`;
      });

      const extra = Number(data[RESERVED_IDS.EXTRA_INCOME]) || 0;
      rowTotal += extra;
      row += `<td style="padding:8px; text-align:right; font-family:var(--font-mono); font-size:12px; border-bottom:1px solid rgba(255,255,255,0.04);">${extra > 0 ? formatHKD(extra) : '<span class="text-muted">—</span>'}</td>`;
      row += `<td style="padding:8px; text-align:right; font-family:var(--font-mono); font-size:12px; font-weight:700; color:var(--neon-cyan); border-bottom:1px solid rgba(255,255,255,0.04);">${formatHKD(rowTotal)}</td>`;
      row += '</tr>';
      rows += row;
    }

    body.innerHTML = `
      <div style="overflow-x:auto; max-height:60vh;">
        <table style="width:100%; border-collapse:collapse; min-width:600px;">
          <thead>${header}</thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    body.innerHTML = `<div class="empty-state text-red">載入失敗：${escapeHtml(err.message)}</div>`;
  }
}

/* ============================================
   銷毀
   ============================================ */
function _destroy() {
  _unsubscribers.forEach((fn) => {
    try { fn(); } catch (e) { /* noop */ }
  });
  _unsubscribers = [];
  if (_viewToggle) {
    try { _viewToggle.destroy(); } catch (e) { /* noop */ }
    _viewToggle = null;
  }
  if (_filterInstance) {
    try { _filterInstance.destroy(); } catch (e) { /* noop */ }
    _filterInstance = null;
  }
}