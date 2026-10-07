// ============================================
// member-report.js — 成員與家庭收入與支出明細（v101.6 🆕）
// 位置：js/pages/member-report.js
// ============================================
// 職責：
//   1. 顯示成員清單（含「家庭共用」獨立顯示）
//   2. 點擊成員 → 顯示該成員的收入 / 支出 / 保險平攤明細
//   3. 明細粒度：每月總計 + 點擊展開每筆
//
// 資料來源：
//   - 收入：income/{year}/{month}/{memberId}
//   - 支出：expenses/{year}/{month}/member_expenses/{memberId}
//   - 保險平攤：expenses 中 isAutoLinked=true 的紀錄（依 policyId 分類）
//
// 不含成員資料明細（在基礎資料庫查看）
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
import { renderStatusBadge } from '../shared/entity-helpers.js';
import { createListenerGroup } from '../shared/listener-group.js';
import { RESERVED_IDS } from '../config/constants.js';
import { registerPageCleanup } from '../core/app.js';

/* ============================================
   Module 狀態
   ============================================ */
let _members = [];
let _allIncome = [];      // [{ year, month, memberId, amount }]
let _allExpenses = [];    // [{ id, year, month, memberId, ... }]
let _selectedMemberId = null;   // 'shared' 或 member id
let _currentYear = '';

let _filterInstance = null;
let _statsApi = null;
let _memberListHandler = null;
let _detailToggleHandler = null;

const listenerGroup = createListenerGroup();

/* ============================================
   主入口
   ============================================ */
export async function initMemberReportPage() {
  _currentYear = AppState.year || String(new Date().getFullYear());

  // 年份選擇器（只留年份）
  _filterInstance = renderPageFilter({
    containerId: 'page-filter-root',
    fields: ['year'],
    onChange: (f) => {
      _currentYear = f.year || _currentYear;
      _render();
    },
  });

  // 監聽成員
  listenerGroup.add(
    listenMembers((list) => {
      _members = sortMembers(list);
      _render();
    })
  );

  // 監聽所有收入
  listenerGroup.add(
    listenAllIncome((list) => {
      _allIncome = list || [];
      _render();
    })
  );

  // 監聽所有支出
  listenerGroup.add(
    listenAllExpenses((list) => {
      _allExpenses = list || [];
      _render();
    })
  );

  // 綁定事件
  _bindEvents();

  registerPageCleanup(_destroy);

  return { destroy: _destroy };
}

/* ============================================
   事件綁定
   ============================================ */
function _bindEvents() {
  // 成員清單點擊
  _memberListHandler = (e) => {
    const card = e.target.closest('[data-member-id]');
    if (!card) return;
    const id = card.dataset.memberId;
    if (!id) return;

    _selectedMemberId = id;
    _render();
  };

  document.getElementById('member-list-root')?.addEventListener('click', _memberListHandler);

  // 明細展開切換
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

  // 收入
  _allIncome.forEach((inc) => {
    if (inc.year !== year) return;
    totalIncome += Number(inc.amount) || 0;
  });

  // 支出 + 保險平攤
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
      hint: '不含保險平攤',
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
   成員清單
   ============================================ */
function _renderMemberList() {
  const root = document.getElementById('member-list-root');
  if (!root) return;

  const year = _currentYear;

  // 組合清單：真實成員 + 家庭共用
  const list = [];

  _members.forEach((m) => {
    list.push({
      id: m.id,
      name: m.name,
      isShared: false,
    });
  });

  // 家庭共用（獨立顯示）
  list.push({
    id: RESERVED_IDS.SHARED_MEMBER,
    name: '家庭共用',
    isShared: true,
  });

  if (list.length === 0) {
    root.innerHTML = '<div class="empty-state" style="padding:20px;">尚無成員</div>';
    return;
  }

  root.innerHTML = `
    <div class="grid grid-3" style="gap:10px; padding:16px 20px 20px;">
      ${list.map((m) => _renderMemberCard(m, year)).join('')}
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
}

function _renderMemberCard(m, year) {
  // 計算該成員的年度收入 / 支出 / 保險
  const income = _allIncome
    .filter((i) => i.year === year && i.memberId === m.id)
    .reduce((s, i) => s + (Number(i.amount) || 0), 0);

  const expense = _allExpenses
    .filter((e) => e.year === year && e.memberId === m.id && !e.isAutoLinked)
    .reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const insurance = _allExpenses
    .filter((e) => e.year === year && e.memberId === m.id && e.isAutoLinked)
    .reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const net = income - expense - insurance;
  const isSelected = m.id === _selectedMemberId;

  const roleLabel = m.isShared ? '🏠 家庭支出' : '';
  const netColor = net >= 0 ? 'text-emerald' : 'text-red';

  return `
    <div class="glass-card"
         data-member-id="${escapeHtml(m.id)}"
         style="padding:14px; cursor:pointer; transition:all 0.2s; ${isSelected ? 'border-color:var(--neon-cyan); box-shadow:0 0 15px rgba(0,240,255,0.15);' : ''}">
      <div style="font-weight:600; font-size:14px; margin-bottom:2px; word-break:break-word;">
        ${escapeHtml(m.name)}
      </div>
      ${roleLabel ? `<div style="font-size:11px; color:var(--text-muted); margin-bottom:8px;">${roleLabel}</div>` : '<div style="margin-bottom:8px;"></div>'}
      <div style="display:flex; flex-direction:column; gap:4px; font-size:12px;">
        ${!m.isShared ? `
          <div style="display:flex; justify-content:space-between;">
            <span class="text-muted">收入</span>
            <span class="mono text-emerald">${formatHKD(income)}</span>
          </div>
        ` : ''}
        <div style="display:flex; justify-content:space-between;">
          <span class="text-muted">支出</span>
          <span class="mono text-red">${formatHKD(expense)}</span>
        </div>
        ${insurance > 0 ? `
          <div style="display:flex; justify-content:space-between;">
            <span class="text-muted">保險</span>
            <span class="mono text-magenta">${formatHKD(insurance)}</span>
          </div>
        ` : ''}
        ${!m.isShared ? `
          <div style="display:flex; justify-content:space-between; margin-top:6px; padding-top:6px; border-top:1px dashed rgba(255,255,255,0.08);">
            <span class="text-muted">淨額</span>
            <span class="mono ${netColor}">${formatHKD(net)}</span>
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

  // 組合 12 個月的資料
  const months = [];
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');

    // 收入
    const incomeRecords = _allIncome.filter(
      (i) => i.year === _currentYear && i.month === mm && i.memberId === member.id
    );
    const income = incomeRecords.reduce((s, i) => s + (Number(i.amount) || 0), 0);

    // 支出（含保險平攤）
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

  // 總計
  const totalIncome = months.reduce((s, m) => s + m.income, 0);
  const totalExpense = months.reduce((s, m) => s + m.expense, 0);
  const totalInsurance = months.reduce((s, m) => s + m.insurance, 0);

  root.innerHTML = `
    <div style="padding:0 20px 20px;">
      <!-- 總計 -->
      <div style="display:flex; gap:16px; flex-wrap:wrap; margin-bottom:16px; padding:12px; background:rgba(0,240,255,0.03); border-radius:var(--radius-md); border:1px solid var(--glass-border);">
        ${!member.id === RESERVED_IDS.SHARED_MEMBER && !member.isShared ? `
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
        ${!member.isShared ? `
          <div style="flex:1; min-width:100px;">
            <div style="font-size:11px; color:var(--text-muted);">年度淨額</div>
            <div class="mono ${totalIncome - totalExpense - totalInsurance >= 0 ? 'text-emerald' : 'text-red'}" style="font-weight:700; font-size:14px;">
              ${formatHKD(totalIncome - totalExpense - totalInsurance)}
            </div>
          </div>
        ` : ''}
      </div>

      <!-- 每月明細 -->
      ${months.map((m) => _renderMonthBlock(m, member)).join('')}
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
}

function _renderMonthBlock(m, member) {
  return `
    <div style="margin-bottom:10px; border:1px solid var(--glass-border); border-radius:var(--radius-md); overflow:hidden;">
      <div data-toggle-month="${m.month}"
           style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:rgba(0,240,255,0.03); cursor:pointer;">
        <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
          <div style="font-weight:600; font-size:14px; color:var(--neon-cyan); min-width:60px;">
            ${m.monthNum} 月
          </div>
          <div style="font-size:12px; color:var(--text-muted); display:flex; gap:12px; flex-wrap:wrap;">
            ${!member.isShared && m.income > 0 ? `<span>收入 <span class="mono text-emerald">${formatHKD(m.income)}</span></span>` : ''}
            ${m.expense > 0 ? `<span>支出 <span class="mono text-red">${formatHKD(m.expense)}</span></span>` : ''}
            ${m.insurance > 0 ? `<span>保險 <span class="mono text-magenta">${formatHKD(m.insurance)}</span></span>` : ''}
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          ${!member.isShared ? `
            <span class="mono" style="font-size:13px; font-weight:600; color:${m.income - m.expense - m.insurance >= 0 ? 'var(--neon-emerald)' : 'var(--neon-red)'};">
              ${formatHKD(m.income - m.expense - m.insurance)}
            </span>
          ` : ''}
          <i data-lucide="chevron-down" data-arrow style="width:14px;height:14px;color:var(--text-muted);"></i>
        </div>
      </div>
      <div style="display:none; padding:12px 14px; border-top:1px dashed rgba(255,255,255,0.06);">
        ${_renderMonthDetails(m, member)}
      </div>
    </div>
  `;
}

function _renderMonthDetails(m, member) {
  const sections = [];

  // 收入明細
  if (!member.isShared && m.incomeRecords.length > 0) {
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

  // 支出明細
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

  // 保險平攤明細
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
  if (_memberListHandler) {
    document.getElementById('member-list-root')?.removeEventListener('click', _memberListHandler);
    _memberListHandler = null;
  }
  if (_detailToggleHandler) {
    document.getElementById('member-detail-root')?.removeEventListener('click', _detailToggleHandler);
    _detailToggleHandler = null;
  }

  _members = [];
  _allIncome = [];
  _allExpenses = [];
  _selectedMemberId = null;
}