// ============================================
// member-report.js — 成員與家庭收入與支出明細（v101.6.13）
// 位置：js/pages/member-report.js
// ============================================
// v101.6.13 修正：
//   ✅ [統一] 成員清單從卡片改為表格（跟隨保險清單兩種模式）
//       - 使用 renderDataTable 統一渲染
//       - 欄位：成員 / 收入 / 支出 / 保險 / 淨額
//       - 「家庭共用」固定最後一列
//       - 手機橫排表格 + 橫向滾動
//   ✅ 保留 v101.6.6 全部功能（統計卡 / 明細展開）
// ============================================

import { AppState } from '../core/state.js';
import {
  listenMembers,
  listenAllIncome,
  listenAllExpenses,
} from '../core/db.js';
import {
  escapeHtml, formatHKD, sortMembers, setText,
} from '../core/utils.js';
import { renderPageFilter } from '../shared/page-filter.js';
import { renderStatsCards } from '../shared/stats-cards.js';
import { renderDataTable } from '../shared/data-table.js';
import { createListenerGroup } from '../shared/listener-group.js';
import { RESERVED_IDS } from '../config/constants.js';
import { registerPageCleanup } from '../core/app.js';

/* ============================================
   Module 狀態
   ============================================ */
let _members = [];
let _allIncome = [];
let _allExpenses = [];
let _selectedMemberId = null;
let _currentYear = '';

let _filterInstance = null;
let _statsApi = null;
let _memberTableApi = null;
let _memberRows = [];   // 保存最近一次渲染的 row 資料（供選中樣式用）

let _detailToggleHandler = null;

const listenerGroup = createListenerGroup();

/* ============================================
   主入口
   ============================================ */
export async function initMemberReportPage() {
  _currentYear = AppState.year || String(new Date().getFullYear());

  _filterInstance = renderPageFilter({
    containerId: 'page-filter-root',
    fields: ['year'],
    onChange: (f) => {
      _currentYear = f.year || _currentYear;
      _render();
    },
  });

  listenerGroup.add(
    listenMembers((list) => {
      _members = sortMembers(list);
      _render();
    })
  );

  listenerGroup.add(
    listenAllIncome((list) => {
      _allIncome = list || [];
      _render();
    })
  );

  listenerGroup.add(
    listenAllExpenses((list) => {
      _allExpenses = list || [];
      _render();
    })
  );

  _bindDetailToggle();

  registerPageCleanup(_destroy);

  return { destroy: _destroy };
}

/* ============================================
   事件綁定（明細展開）
   ============================================ */
function _bindDetailToggle() {
  _detailToggleHandler = (e) => {
    const header = e.target.closest('[data-toggle-month]');
    if (!header) return;
    const month = header.dataset.toggleMonth;
    const detail = header.nextElementSibling;
    if (!detail) return;

    const isOpen = detail.style.display !== 'none';
    detail.style.display = isOpen ? 'none' : 'block';

    const arrow = header.querySelector('[data-arrow]');
    if (arrow) {
      arrow.setAttribute('data-lucide', isOpen ? 'chevron-down' : 'chevron-up');
      if (window.lucide) window.lucide.createIcons();
    }
  };

  document.getElementById('member-detail-root')?.addEventListener('click', _detailToggleHandler);
}

/* ============================================
   渲染
   ============================================ */
function _render() {
  const yearLabel = `${_currentYear} 年`;
  setText('member-report-subtitle', `${yearLabel} · 收入與支出明細`);

  _renderStats();
  _renderMemberList();
  _renderDetail();
}

/* ============================================
   統計卡
   ============================================ */
function _renderStats() {
  const year = _currentYear;

  let totalIncome = 0;
  let totalExpense = 0;
  let totalInsurance = 0;

  _allIncome.forEach((inc) => {
    if (inc.year !== year) return;
    totalIncome += Number(inc.amount) || 0;
  });

  _allExpenses.forEach((e) => {
    if (e.year !== year) return;
    const amount = Number(e.amount) || 0;
    if (e.isAutoLinked) {
      totalInsurance += amount;
    } else {
      totalExpense += amount;
    }
  });

  const net = totalIncome - totalExpense - totalInsurance;

  const cards = [
    {
      title: `${year} 年度總收入`,
      value: formatHKD(totalIncome),
      valueClass: 'emerald',
      hint: '所有成員收入加總',
      icon: 'trending-up',
    },
    {
      title: `${year} 年度總支出`,
      value: formatHKD(totalExpense),
      valueClass: 'red',
      hint: '含家庭共用支出',
      icon: 'trending-down',
    },
    {
      title: `${year} 年度保險平攤`,
      value: formatHKD(totalInsurance),
      valueClass: 'magenta',
      hint: '保險自動分攤加總',
      icon: 'shield',
    },
    {
      title: `${year} 年度淨餘額`,
      value: formatHKD(net),
      valueClass: net >= 0 ? 'emerald' : 'red',
      hint: '收入 − 支出 − 保險',
      icon: 'wallet',
    },
  ];

  if (_statsApi) {
    try { _statsApi.destroy(); } catch (e) { /* noop */ }
    _statsApi = null;
  }

  _statsApi = renderStatsCards({
    container: 'member-report-stats-root',
    cards,
    columns: 4,
  });
}

/* ============================================
   成員清單（🆕 v101.6.13：改為表格）
   ============================================ */
function _renderMemberList() {
  const root = document.getElementById('member-list-root');
  if (!root) return;

  const year = _currentYear;

  // 準備清單：真實成員 + 家庭共用（最後）
  const list = [];
  _members.forEach((m) => {
    list.push({ id: m.id, name: m.name, isShared: false });
  });
  list.push({ id: RESERVED_IDS.SHARED_MEMBER, name: '家庭共用', isShared: true });

  // 計算每個成員的統計
  _memberRows = list.map((m) => {
    const income = _allIncome
      .filter((i) => i.year === year && i.memberId === m.id)
      .reduce((s, i) => s + (Number(i.amount) || 0), 0);

    const expenseRecords = _allExpenses
      .filter((e) => e.year === year && e.memberId === m.id);
    const expense = expenseRecords
      .filter((e) => !e.isAutoLinked)
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const insurance = expenseRecords
      .filter((e) => e.isAutoLinked)
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);

    const net = income - expense - insurance;

    return {
      id: m.id,
      name: m.name,
      isShared: m.isShared,
      income,
      expense,
      insurance,
      net,
    };
  });

  // 銷毀舊表格
  if (_memberTableApi) {
    try { _memberTableApi.destroy(); } catch (e) { /* noop */ }
    _memberTableApi = null;
  }

  _memberTableApi = renderDataTable({
    container: root,
    entityKey: '__member_report__',
    rows: _memberRows,
    tableId: 'member-report-table',
    options: {
      columns: [
        { id: 'name',      label: '成員', defaultVisible: true, defaultWidth: 120 },
        { id: 'income',    label: '收入', defaultVisible: true, defaultWidth: 130 },
        { id: 'expense',   label: '支出', defaultVisible: true, defaultWidth: 130 },
        { id: 'insurance', label: '保險', defaultVisible: true, defaultWidth: 130 },
        { id: 'net',       label: '淨額', defaultVisible: true, defaultWidth: 130 },
      ],
      resolvers: {
        name: (_, row) => {
          const sharedTag = row.isShared
            ? ' <span class="badge badge-muted" style="font-size:10px; margin-left:4px;">🏠</span>'
            : '';
          return escapeHtml(row.name) + sharedTag;
        },
        income: (_, row) => {
          if (row.isShared) return '<span class="text-muted">—</span>';
          return `<span class="text-emerald">${formatHKD(row.income)}</span>`;
        },
        expense: (_, row) => {
          return `<span class="text-red">${formatHKD(row.expense)}</span>`;
        },
        insurance: (_, row) => {
          if (row.insurance === 0) return '<span class="text-muted">—</span>';
          return `<span class="text-magenta">${formatHKD(row.insurance)}</span>`;
        },
        net: (_, row) => {
          if (row.isShared) return '<span class="text-muted">—</span>';
          const cls = row.net >= 0 ? 'text-emerald' : 'text-red';
          return `<span class="${cls}">${formatHKD(row.net)}</span>`;
        },
      },
      // 🆕 v101.6.13：明確橫排（跟隨保險清單）
      mobileCardMode: false,
    },
    hooks: {
      customActions: () => [],   // 無操作按鈕
      onRowClick: (row) => {
        _selectedMemberId = row.id;
        _updateMemberRowSelection();
        _renderDetail();
      },
    },
  });

  // 初始選中樣式
  _updateMemberRowSelection();

  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   更新成員列選中樣式（不重繪表格）
   ============================================ */
function _updateMemberRowSelection() {
  const root = document.getElementById('member-list-root');
  if (!root) return;

  root.querySelectorAll('tr[data-row-index]').forEach((tr) => {
    const idx = Number(tr.dataset.rowIndex);
    const row = _memberRows[idx];
    if (!row) return;

    tr.style.cursor = 'pointer';

    if (row.id === _selectedMemberId) {
      tr.style.background = 'rgba(0,240,255,0.08)';
      tr.style.boxShadow = 'inset 3px 0 0 var(--neon-cyan)';
    } else {
      tr.style.background = '';
      tr.style.boxShadow = '';
    }
  });
}

/* ============================================
   明細區塊
   ============================================ */
function _renderDetail() {
  const root = document.getElementById('member-detail-root');
  const titleEl = document.getElementById('member-detail-title');
  if (!root) return;

  if (!_selectedMemberId) {
    if (titleEl) titleEl.textContent = '明細';
    root.innerHTML = '<div class="empty-state" style="padding:24px;">請點擊上方成員查看明細</div>';
    return;
  }

  const member = _members.find((m) => m.id === _selectedMemberId)
    || (_selectedMemberId === RESERVED_IDS.SHARED_MEMBER
      ? { id: RESERVED_IDS.SHARED_MEMBER, name: '家庭共用' }
      : null);

  if (!member) {
    if (titleEl) titleEl.textContent = '明細';
    root.innerHTML = '<div class="empty-state" style="padding:24px;">找不到此成員</div>';
    return;
  }

  if (titleEl) {
    titleEl.textContent = `${member.name} · ${_currentYear} 年明細`;
  }

  const months = [];
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');

    const incomeRecords = _allIncome.filter(
      (i) => i.year === _currentYear && i.month === mm && i.memberId === member.id
    );
    const income = incomeRecords.reduce((s, i) => s + (Number(i.amount) || 0), 0);

    const expenseRecords = _allExpenses.filter(
      (e) => e.year === _currentYear && e.month === mm && e.memberId === member.id
    );
    const expense = expenseRecords
      .filter((e) => !e.isAutoLinked)
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const insurance = expenseRecords
      .filter((e) => e.isAutoLinked)
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);

    if (income === 0 && expense === 0 && insurance === 0) continue;

    months.push({
      monthNum: m,
      month: mm,
      income,
      expense,
      insurance,
      incomeRecords,
      expenseRecords: expenseRecords.filter((e) => !e.isAutoLinked),
      insuranceRecords: expenseRecords.filter((e) => e.isAutoLinked),
    });
  }

  if (months.length === 0) {
    root.innerHTML = `<div class="empty-state" style="padding:24px;">${escapeHtml(member.name)} 在 ${_currentYear} 年尚無資料</div>`;
    return;
  }

  const totalIncome = months.reduce((s, m) => s + m.income, 0);
  const totalExpense = months.reduce((s, m) => s + m.expense, 0);
  const totalInsurance = months.reduce((s, m) => s + m.insurance, 0);

  const isShared = member.id === RESERVED_IDS.SHARED_MEMBER;

  root.innerHTML = `
    <div style="padding:0 20px 20px;">
      <div style="display:flex; gap:16px; flex-wrap:wrap; margin-bottom:16px; padding:12px; background:rgba(0,240,255,0.03); border-radius:var(--radius-md); border:1px solid var(--glass-border);">
        ${!isShared ? `
          <div style="flex:1; min-width:100px;">
            <div style="font-size:11px; color:var(--text-muted);">年度總收入</div>
            <div class="mono text-emerald" style="font-weight:700; font-size:14px;">${formatHKD(totalIncome)}</div>
          </div>
        ` : ''}
        <div style="flex:1; min-width:100px;">
          <div style="font-size:11px; color:var(--text-muted);">年度總支出</div>
          <div class="mono text-red" style="font-weight:700; font-size:14px;">${formatHKD(totalExpense)}</div>
        </div>
        <div style="flex:1; min-width:100px;">
          <div style="font-size:11px; color:var(--text-muted);">年度保險平攤</div>
          <div class="mono text-magenta" style="font-weight:700; font-size:14px;">${formatHKD(totalInsurance)}</div>
        </div>
        ${!isShared ? `
          <div style="flex:1; min-width:100px;">
            <div style="font-size:11px; color:var(--text-muted);">年度淨額</div>
            <div class="mono ${totalIncome - totalExpense - totalInsurance >= 0 ? 'text-emerald' : 'text-red'}" style="font-weight:700; font-size:14px;">
              ${formatHKD(totalIncome - totalExpense - totalInsurance)}
            </div>
          </div>
        ` : ''}
      </div>

      ${months.map((m) => _renderMonthBlock(m, member, isShared)).join('')}
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
}

function _renderMonthBlock(m, member, isShared) {
  return `
    <div style="margin-bottom:10px; border:1px solid var(--glass-border); border-radius:var(--radius-md); overflow:hidden;">
      <div data-toggle-month="${m.month}"
           style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:rgba(0,240,255,0.03); cursor:pointer;">
        <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
          <div style="font-weight:600; font-size:14px; color:var(--neon-cyan); min-width:60px;">
            ${m.monthNum} 月
          </div>
          <div style="font-size:12px; color:var(--text-muted); display:flex; gap:12px; flex-wrap:wrap;">
            ${!isShared && m.income > 0 ? `<span>收入 <span class="mono text-emerald">${formatHKD(m.income)}</span></span>` : ''}
            ${m.expense > 0 ? `<span>支出 <span class="mono text-red">${formatHKD(m.expense)}</span></span>` : ''}
            ${m.insurance > 0 ? `<span>保險 <span class="mono text-magenta">${formatHKD(m.insurance)}</span></span>` : ''}
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          ${!isShared ? `
            <span class="mono" style="font-size:13px; font-weight:600; color:${m.income - m.expense - m.insurance >= 0 ? 'var(--neon-emerald)' : 'var(--neon-red)'};">
              ${formatHKD(m.income - m.expense - m.insurance)}
            </span>
          ` : ''}
          <i data-lucide="chevron-down" data-arrow style="width:14px;height:14px;color:var(--text-muted);"></i>
        </div>
      </div>
      <div style="display:none; padding:12px 14px; border-top:1px dashed rgba(255,255,255,0.06);">
        ${_renderMonthDetails(m, member, isShared)}
      </div>
    </div>
  `;
}

function _renderMonthDetails(m, member, isShared) {
  const sections = [];

  if (!isShared && m.incomeRecords.length > 0) {
    sections.push(`
      <div style="margin-bottom:12px;">
        <div style="font-size:11px; color:var(--text-muted); text-transform:uppercase; margin-bottom:6px;">收入</div>
        ${m.incomeRecords.map((r) => `
          <div style="display:flex; justify-content:space-between; padding:4px 0; font-size:13px;">
            <span>${r.memberId === RESERVED_IDS.EXTRA_INCOME ? '額外收入' : escapeHtml(member.name)}</span>
            <span class="mono text-emerald">${formatHKD(r.amount)}</span>
          </div>
        `).join('')}
      </div>
    `);
  }

  if (m.expenseRecords.length > 0) {
    sections.push(`
      <div style="margin-bottom:12px;">
        <div style="font-size:11px; color:var(--text-muted); text-transform:uppercase; margin-bottom:6px;">支出</div>
        ${m.expenseRecords.map((r) => `
          <div style="display:flex; justify-content:space-between; padding:4px 0; font-size:13px; gap:8px;">
            <div style="flex:1; min-width:0;">
              <span>${escapeHtml(r.name || '（未命名）')}</span>
              ${r.date ? `<span style="font-size:11px; color:var(--text-muted); margin-left:6px;">${escapeHtml(r.date)}</span>` : ''}
            </div>
            <span class="mono text-red">${formatHKD(r.amount)}</span>
          </div>
        `).join('')}
      </div>
    `);
  }

  if (m.insuranceRecords.length > 0) {
    sections.push(`
      <div>
        <div style="font-size:11px; color:var(--text-muted); text-transform:uppercase; margin-bottom:6px;">保險平攤</div>
        ${m.insuranceRecords.map((r) => `
          <div style="display:flex; justify-content:space-between; padding:4px 0; font-size:13px; gap:8px;">
            <div style="flex:1; min-width:0;">
              <span>${escapeHtml(r.name || '（未命名）')}</span>
              <span class="badge badge-info" style="margin-left:6px; font-size:10px;">保險</span>
            </div>
            <span class="mono text-magenta">${formatHKD(r.amount)}</span>
          </div>
        `).join('')}
      </div>
    `);
  }

  if (sections.length === 0) {
    return '<div class="empty-state" style="padding:12px;">本月無資料</div>';
  }

  return sections.join('');
}

/* ============================================
   銷毀
   ============================================ */
function _destroy() {
  listenerGroup.destroy();

  if (_filterInstance) {
    try { _filterInstance.destroy(); } catch (e) { /* noop */ }
    _filterInstance = null;
  }
  if (_statsApi) {
    try { _statsApi.destroy(); } catch (e) { /* noop */ }
    _statsApi = null;
  }
  if (_memberTableApi) {
    try { _memberTableApi.destroy(); } catch (e) { /* noop */ }
    _memberTableApi = null;
  }
  if (_detailToggleHandler) {
    document.getElementById('member-detail-root')?.removeEventListener('click', _detailToggleHandler);
    _detailToggleHandler = null;
  }

  _members = [];
  _allIncome = [];
  _allExpenses = [];
  _selectedMemberId = null;
  _memberRows = [];
}