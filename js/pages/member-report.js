// ============================================
// member-report.js — 成員與家庭收入與支出明細（v101.9.0）
// 位置：js/pages/member-report.js
// ============================================
// v101.9.0 修正：
//   ✅ 完全移除 page-filter（Q6：年份由 Navbar 控制）
//   ✅ 監聽 ym-change 更新 _currentYear
//   ✅ 保留「家庭共用」為獨立項目（Q6 確認）
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
import { renderStatsCards } from '../shared/stats-cards.js';
import { renderDataTable } from '../shared/data-table.js';
import { initViewToggle } from '../shared/view-toggle.js';
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
let _memberRows = [];

let _viewToggle = null;
let _statsApi = null;
let _memberTableApi = null;
let _detailToggleHandler = null;
let _cardClickHandler = null;

const listenerGroup = createListenerGroup();

/* ============================================
   主入口
   ============================================ */
export async function initMemberReportPage() {
  // 🆕 v101.9.0：初始年份從 AppState
  _currentYear = AppState.year || String(new Date().getFullYear());

  _viewToggle = initViewToggle({
    containerId: 'member-view-toggle-root',
    storageKey: 'member-report-view',
    defaultView: 'table',
    cardText: '卡片',
    tableText: '表格',
    autoApply: false,
    onChange: () => _render(),
  });

  // 🆕 v101.9.0：移除 renderPageFilter，改由 Navbar 控制

  listenerGroup.add(listenMembers((list) => {
    _members = sortMembers(list);
    _render();
  }));
  listenerGroup.add(listenAllIncome((list) => {
    _allIncome = list || [];
    _render();
  }));
  listenerGroup.add(listenAllExpenses((list) => {
    _allExpenses = list || [];
    _render();
  }));

  // 🆕 v101.9.0：監聽年月變更
  listenerGroup.add(AppState.on('ym-change', () => {
    _currentYear = AppState.year || _currentYear;
    _render();
  }));

  _bindDetailToggle();
  _bindCardClick();

  registerPageCleanup(_destroy);

  return { destroy: _destroy };
}

function _bindDetailToggle() {
  _detailToggleHandler = (e) => {
    const header = e.target.closest('[data-toggle-month]');
    if (!header) return;
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

function _bindCardClick() {
  _cardClickHandler = (e) => {
    const card = e.target.closest('[data-member-id]');
    if (!card) return;
    const id = card.dataset.memberId;
    if (!id) return;
    _selectedMemberId = id;
    _render();
  };
  document.getElementById('member-card-root')?.addEventListener('click', _cardClickHandler);
}

/* ============================================
   渲染
   ============================================ */
function _render() {
  setText('member-report-subtitle', `${_currentYear} 年 · 收入與支出明細`);
  _renderStats();
  _computeRows();

  const view = _viewToggle?.getView() || 'table';
  const listRoot = document.getElementById('member-list-root');
  const cardRoot = document.getElementById('member-card-root');

  if (view === 'card') {
    if (listRoot) listRoot.style.display = 'none';
    if (cardRoot) {
      cardRoot.style.display = 'block';
      _renderCards(cardRoot);
    }
  } else {
    if (listRoot) listRoot.style.display = 'block';
    if (cardRoot) cardRoot.style.display = 'none';
    _renderTable();
  }

  _renderDetail();
}

/* ============================================
   統計卡
   ============================================ */
function _renderStats() {
  let totalIncome = 0;
  let totalExpense = 0;
  let totalInsurance = 0;

  _allIncome.forEach((inc) => {
    if (inc.year !== _currentYear) return;
    totalIncome += Number(inc.amount) || 0;
  });

  _allExpenses.forEach((e) => {
    if (e.year !== _currentYear) return;
    const amount = Number(e.amount) || 0;
    if (e.isAutoLinked) totalInsurance += amount;
    else totalExpense += amount;
  });

  const net = totalIncome - totalExpense - totalInsurance;

  const cards = [
    { title: `${_currentYear} 年度總收入`, value: formatHKD(totalIncome), valueClass: 'emerald', hint: '所有成員收入加總', icon: 'trending-up' },
    { title: `${_currentYear} 年度總支出`, value: formatHKD(totalExpense), valueClass: 'red', hint: '含家庭共用支出', icon: 'trending-down' },
    { title: `${_currentYear} 年度保險平攤`, value: formatHKD(totalInsurance), valueClass: 'magenta', hint: '保險自動分攤加總', icon: 'shield' },
    { title: `${_currentYear} 年度淨餘額`, value: formatHKD(net), valueClass: net >= 0 ? 'emerald' : 'red', hint: '收入 − 支出 − 保險', icon: 'wallet' },
  ];

  if (_statsApi) { try { _statsApi.destroy(); } catch (e) {} }
  _statsApi = renderStatsCards({ container: 'member-report-stats-root', cards, columns: 4 });
}

/* ============================================
   計算成員資料
   ============================================ */
function _computeRows() {
  const list = [];
  _members.forEach((m) => list.push({ id: m.id, name: m.name, isShared: false }));
  list.push({ id: RESERVED_IDS.SHARED_MEMBER, name: '家庭共用', isShared: true });

  _memberRows = list.map((m) => {
    const income = _allIncome
      .filter((i) => i.year === _currentYear && i.memberId === m.id)
      .reduce((s, i) => s + (Number(i.amount) || 0), 0);

    const expenseRecords = _allExpenses.filter((e) => e.year === _currentYear && e.memberId === m.id);
    const expense = expenseRecords.filter((e) => !e.isAutoLinked).reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const insurance = expenseRecords.filter((e) => e.isAutoLinked).reduce((s, e) => s + (Number(e.amount) || 0), 0);

    return {
      id: m.id,
      name: m.name,
      isShared: m.isShared,
      income, expense, insurance,
      net: income - expense - insurance,
    };
  });
}

/* ============================================
   表格模式
   ============================================ */
function _renderTable() {
  const root = document.getElementById('member-list-root');
  if (!root) return;

  if (_memberTableApi) { try { _memberTableApi.destroy(); } catch (e) {} _memberTableApi = null; }

  _memberTableApi = renderDataTable({
    container: root,
    entityKey: '__member_report__',
    rows: _memberRows,
    tableId: 'member-report-table',
    options: {
      columns: [
        { id: 'name',      label: '成員', defaultVisible: true, defaultWidth: 140 },
        { id: 'income',    label: '收入', defaultVisible: true, defaultWidth: 140 },
        { id: 'expense',   label: '支出', defaultVisible: true, defaultWidth: 140 },
        { id: 'insurance', label: '保險', defaultVisible: true, defaultWidth: 140 },
        { id: 'net',       label: '淨額', defaultVisible: true, defaultWidth: 140 },
      ],
      resolvers: {
        name: (_, row) => escapeHtml(row.name) + (row.isShared ? ' <span class="badge badge-muted" style="font-size:10px;">🏠</span>' : ''),
        income: (_, row) => row.isShared ? '<span class="text-muted">—</span>' : `<span class="text-emerald">${formatHKD(row.income)}</span>`,
        expense: (_, row) => `<span class="text-red">${formatHKD(row.expense)}</span>`,
        insurance: (_, row) => row.insurance === 0 ? '<span class="text-muted">—</span>' : `<span class="text-magenta">${formatHKD(row.insurance)}</span>`,
        net: (_, row) => row.isShared ? '<span class="text-muted">—</span>' : `<span class="${row.net >= 0 ? 'text-emerald' : 'text-red'}">${formatHKD(row.net)}</span>`,
      },
      mobileCardMode: false,
      collapsible: true,
      defaultCollapsed: false,
      expandable: true,
      storageKey: 'member-report-table',
      renderDetail: (row) => _renderMemberRowDetail(row),
    },
    hooks: {
      customActions: () => [],
      onRowClick: (row) => {
        _selectedMemberId = row.id;
        _updateMemberRowSelection();
        _renderDetail();
      },
    },
  });

  _updateMemberRowSelection();
  if (window.lucide) window.lucide.createIcons();
}

function _renderMemberRowDetail(row) {
  const months = [];
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    const income = _allIncome
      .filter((i) => i.year === _currentYear && i.month === mm && i.memberId === row.id)
      .reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const records = _allExpenses.filter((e) => e.year === _currentYear && e.month === mm && e.memberId === row.id);
    const expense = records.filter((e) => !e.isAutoLinked).reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const insurance = records.filter((e) => e.isAutoLinked).reduce((s, e) => s + (Number(e.amount) || 0), 0);
    if (income === 0 && expense === 0 && insurance === 0) continue;
    months.push({ month: m, income, expense, insurance });
  }

  if (months.length === 0) {
    return `<div class="empty-state" style="padding:12px;">${escapeHtml(row.name)} 尚無資料</div>`;
  }

  return `
    <div style="font-size:13px;">
      <div style="display:grid; grid-template-columns:80px 1fr 1fr 1fr; gap:6px 16px; font-size:11px; color:var(--text-muted); margin-bottom:6px; text-transform:uppercase; letter-spacing:1px;">
        <div>月份</div>
        ${!row.isShared ? '<div>收入</div>' : '<div></div>'}
        <div>支出</div>
        <div>保險</div>
      </div>
      ${months.map((m) => `
        <div style="display:grid; grid-template-columns:80px 1fr 1fr 1fr; gap:6px 16px; padding:6px 0; border-top:1px solid rgba(255,255,255,0.04);">
          <div class="mono" style="color:var(--neon-cyan); font-weight:600;">${m.month} 月</div>
          ${!row.isShared ? `<div class="mono text-emerald">${formatHKD(m.income)}</div>` : '<div></div>'}
          <div class="mono text-red">${formatHKD(m.expense)}</div>
          <div class="mono text-magenta">${m.insurance > 0 ? formatHKD(m.insurance) : '—'}</div>
        </div>
      `).join('')}
    </div>
  `;
}

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
   卡片模式
   ============================================ */
function _renderCards(container) {
  if (!_memberRows.length) {
    container.innerHTML = `<div class="empty-state">尚無成員</div>`;
    return;
  }

  container.innerHTML = `
    <div class="data-cards-grid">
      ${_memberRows.map((m) => _renderMemberCard(m)).join('')}
    </div>
  `;
  if (window.lucide) window.lucide.createIcons();
}

function _renderMemberCard(m) {
  const isSelected = m.id === _selectedMemberId;
  const netColor = m.net >= 0 ? 'text-emerald' : 'text-red';

  return `
    <div class="glass-card" data-member-id="${escapeHtml(m.id)}"
         style="padding:14px; cursor:pointer; transition:all 0.2s; ${isSelected ? 'border-color:var(--neon-cyan); box-shadow:0 0 15px rgba(0,240,255,0.15);' : ''}">
      <div style="font-weight:600; font-size:14px; margin-bottom:8px; word-break:break-word;">
        ${escapeHtml(m.name)}${m.isShared ? ' 🏠' : ''}
      </div>
      <div style="display:flex; flex-direction:column; gap:4px; font-size:12px;">
        ${!m.isShared ? `
          <div style="display:flex; justify-content:space-between;">
            <span class="text-muted">收入</span>
            <span class="mono text-emerald">${formatHKD(m.income)}</span>
          </div>
        ` : ''}
        <div style="display:flex; justify-content:space-between;">
          <span class="text-muted">支出</span>
          <span class="mono text-red">${formatHKD(m.expense)}</span>
        </div>
        ${m.insurance > 0 ? `
          <div style="display:flex; justify-content:space-between;">
            <span class="text-muted">保險</span>
            <span class="mono text-magenta">${formatHKD(m.insurance)}</span>
          </div>
        ` : ''}
        ${!m.isShared ? `
          <div style="display:flex; justify-content:space-between; margin-top:6px; padding-top:6px; border-top:1px dashed rgba(255,255,255,0.08);">
            <span class="text-muted">淨額</span>
            <span class="mono ${netColor}">${formatHKD(m.net)}</span>
          </div>
        ` : ''}
      </div>
    </div>
  `;
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
      ? { id: RESERVED_IDS.SHARED_MEMBER, name: '家庭共用' } : null);

  if (!member) {
    if (titleEl) titleEl.textContent = '明細';
    root.innerHTML = '<div class="empty-state" style="padding:24px;">找不到此成員</div>';
    return;
  }

  if (titleEl) titleEl.textContent = `${member.name} · ${_currentYear} 年明細`;

  const months = [];
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    const incomeRecords = _allIncome.filter((i) => i.year === _currentYear && i.month === mm && i.memberId === member.id);
    const income = incomeRecords.reduce((s, i) => s + (Number(i.amount) || 0), 0);

    const expenseRecords = _allExpenses.filter((e) => e.year === _currentYear && e.month === mm && e.memberId === member.id);
    const expense = expenseRecords.filter((e) => !e.isAutoLinked).reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const insurance = expenseRecords.filter((e) => e.isAutoLinked).reduce((s, e) => s + (Number(e.amount) || 0), 0);

    if (income === 0 && expense === 0 && insurance === 0) continue;
    months.push({ monthNum: m, month: mm, income, expense, insurance, incomeRecords,
      expenseRecords: expenseRecords.filter((e) => !e.isAutoLinked),
      insuranceRecords: expenseRecords.filter((e) => e.isAutoLinked) });
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
        ${!isShared ? `<div style="flex:1; min-width:100px;"><div style="font-size:11px; color:var(--text-muted);">年度總收入</div><div class="mono text-emerald" style="font-weight:700; font-size:14px;">${formatHKD(totalIncome)}</div></div>` : ''}
        <div style="flex:1; min-width:100px;"><div style="font-size:11px; color:var(--text-muted);">年度總支出</div><div class="mono text-red" style="font-weight:700; font-size:14px;">${formatHKD(totalExpense)}</div></div>
        <div style="flex:1; min-width:100px;"><div style="font-size:11px; color:var(--text-muted);">年度保險平攤</div><div class="mono text-magenta" style="font-weight:700; font-size:14px;">${formatHKD(totalInsurance)}</div></div>
        ${!isShared ? `<div style="flex:1; min-width:100px;"><div style="font-size:11px; color:var(--text-muted);">年度淨額</div><div class="mono ${totalIncome - totalExpense - totalInsurance >= 0 ? 'text-emerald' : 'text-red'}" style="font-weight:700; font-size:14px;">${formatHKD(totalIncome - totalExpense - totalInsurance)}</div></div>` : ''}
      </div>
      ${months.map((m) => _renderMonthBlock(m, member, isShared)).join('')}
    </div>
  `;
  if (window.lucide) window.lucide.createIcons();
}

function _renderMonthBlock(m, member, isShared) {
  return `
    <div style="margin-bottom:10px; border:1px solid var(--glass-border); border-radius:var(--radius-md); overflow:hidden;">
      <div data-toggle-month="${m.month}" style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:rgba(0,240,255,0.03); cursor:pointer;">
        <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
          <div style="font-weight:600; font-size:14px; color:var(--neon-cyan); min-width:60px;">${m.monthNum} 月</div>
          <div style="font-size:12px; color:var(--text-muted); display:flex; gap:12px; flex-wrap:wrap;">
            ${!isShared && m.income > 0 ? `<span>收入 <span class="mono text-emerald">${formatHKD(m.income)}</span></span>` : ''}
            ${m.expense > 0 ? `<span>支出 <span class="mono text-red">${formatHKD(m.expense)}</span></span>` : ''}
            ${m.insurance > 0 ? `<span>保險 <span class="mono text-magenta">${formatHKD(m.insurance)}</span></span>` : ''}
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          ${!isShared ? `<span class="mono" style="font-size:13px; font-weight:600; color:${m.income - m.expense - m.insurance >= 0 ? 'var(--neon-emerald)' : 'var(--neon-red)'};">${formatHKD(m.income - m.expense - m.insurance)}</span>` : ''}
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
    sections.push(`<div style="margin-bottom:12px;"><div style="font-size:11px; color:var(--text-muted); text-transform:uppercase; margin-bottom:6px;">收入</div>${m.incomeRecords.map((r) => `<div style="display:flex; justify-content:space-between; padding:4px 0; font-size:13px;"><span>${r.memberId === RESERVED_IDS.EXTRA_INCOME ? '額外收入' : escapeHtml(member.name)}</span><span class="mono text-emerald">${formatHKD(r.amount)}</span></div>`).join('')}</div>`);
  }
  if (m.expenseRecords.length > 0) {
    sections.push(`<div style="margin-bottom:12px;"><div style="font-size:11px; color:var(--text-muted); text-transform:uppercase; margin-bottom:6px;">支出</div>${m.expenseRecords.map((r) => `<div style="display:flex; justify-content:space-between; padding:4px 0; font-size:13px; gap:8px;"><div style="flex:1; min-width:0;"><span>${escapeHtml(r.name || '（未命名）')}</span>${r.date ? `<span style="font-size:11px; color:var(--text-muted); margin-left:6px;">${escapeHtml(r.date)}</span>` : ''}</div><span class="mono text-red">${formatHKD(r.amount)}</span></div>`).join('')}</div>`);
  }
  if (m.insuranceRecords.length > 0) {
    sections.push(`<div><div style="font-size:11px; color:var(--text-muted); text-transform:uppercase; margin-bottom:6px;">保險平攤</div>${m.insuranceRecords.map((r) => `<div style="display:flex; justify-content:space-between; padding:4px 0; font-size:13px; gap:8px;"><div style="flex:1; min-width:0;"><span>${escapeHtml(r.name || '（未命名）')}</span><span class="badge badge-info" style="margin-left:6px; font-size:10px;">保險</span></div><span class="mono text-magenta">${formatHKD(r.amount)}</span></div>`).join('')}</div>`);
  }
  if (sections.length === 0) return '<div class="empty-state" style="padding:12px;">本月無資料</div>';
  return sections.join('');
}

/* ============================================
   銷毀
   ============================================ */
function _destroy() {
  listenerGroup.destroy();
  if (_viewToggle) { try { _viewToggle.destroy(); } catch (e) {} _viewToggle = null; }
  if (_statsApi) { try { _statsApi.destroy(); } catch (e) {} _statsApi = null; }
  if (_memberTableApi) { try { _memberTableApi.destroy(); } catch (e) {} _memberTableApi = null; }
  if (_detailToggleHandler) {
    document.getElementById('member-detail-root')?.removeEventListener('click', _detailToggleHandler);
    _detailToggleHandler = null;
  }
  if (_cardClickHandler) {
    document.getElementById('member-card-root')?.removeEventListener('click', _cardClickHandler);
    _cardClickHandler = null;
  }
  _members = [];
  _allIncome = [];
  _allExpenses = [];
  _selectedMemberId = null;
  _memberRows = [];
}