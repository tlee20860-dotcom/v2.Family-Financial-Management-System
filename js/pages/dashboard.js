// ============================================
// dashboard.js — 總覽儀表板（v101.5）
// 位置：js/pages/dashboard.js
// ============================================
// v101.5 修正：
//   ✅ filterInstance 提升至 module 層級（destroy 完整）
//   ✅ 使用 registerPageCleanup 註冊清理
//   ✅ 快速摘要使用共用 builder（不再自己組裝）
// ============================================

import { api } from '../core/api.js';
import { AppState } from '../core/state.js';
import { formatHKD, escapeHtml } from '../core/utils.js';
import { renderPageFilter } from '../shared/page-filter.js';
import { renderQuickSummary, buildTopCategoriesData, buildRecentActivityData } from '../shared/quick-summary.js';
import { QUICK_SUMMARY_TYPES } from '../config/constants.js';
import { registerPageCleanup } from '../core/app.js';

/* ============================================
   Module 狀態
   ============================================ */
let _filterInstance = null;
let _unsubscribeYM = null;

/* ============================================
   主入口
   ============================================ */
export async function initDashboardPage() {
  _filterInstance = renderPageFilter({
    containerId: 'page-filter-root',
    fields: ['year', 'month'],
  });

  _unsubscribeYM = AppState.on('ym-change', () => loadDashboard());

  await loadDashboard();

  registerPageCleanup(_destroy);

  return {
    destroy: _destroy,
  };
}

/* ============================================
   載入
   ============================================ */
async function loadDashboard() {
  const { year, month } = AppState.getYearMonth();
  const isAnnual = month === 'all';

  const monthEl = document.getElementById('dashboard-month');
  if (monthEl) {
    monthEl.textContent = isAnnual ? `${year} 年 全年總覽` : `${year} 年 ${month} 月`;
  }

  const annualView = document.getElementById('annual-view');
  const monthlyView = document.getElementById('monthly-view');
  if (annualView) annualView.style.display = isAnnual ? 'block' : 'none';
  if (monthlyView) monthlyView.style.display = isAnnual ? 'none' : 'block';

  try {
    if (isAnnual) {
      const data = await api.fetchAnnualSummary(year);
      renderAnnual(data);
    } else {
      const data = await api.summary(year, month);
      renderMonthly(data);
    }
  } catch (err) {
    console.error('儀表板載入失敗：', err);
    showError('無法載入家庭財務資料，請稍後再試。');
  }
}

/* ============================================
   全年模式
   ============================================ */
function renderAnnual(data) {
  setText('annual-income', formatHKD(data.totalIncome));
  setText('annual-expense', formatHKD(data.totalExpense));
  setText('annual-net', formatHKD(data.netBalance));
  setText('annual-assets', formatHKD(data.totalAssets));
  setText('annual-insurance', formatHKD(data.yearlyInsuranceTotal));

  const netEl = document.getElementById('annual-net');
  if (netEl) {
    netEl.classList.remove('emerald', 'red');
    netEl.classList.add(data.netBalance >= 0 ? 'emerald' : 'red');
  }

  const container = document.getElementById('monthly-cards');
  if (container) {
    container.innerHTML = (data.monthly || []).map((m, i) => _renderMonthCard(m, i + 1)).join('');
    _bindMonthCardToggles(container);
  }

  if (window.lucide) window.lucide.createIcons();

  _renderAnnualQuickSummary(data);
}

function _renderMonthCard(m, monthNum) {
  const netColor = m.netBalance >= 0 ? 'var(--neon-emerald)' : 'var(--neon-red)';
  const perMember = m.perMember || {};
  const totalItems = Object.values(perMember).reduce((s, x) => s + (x.itemCount || 0), 0);

  return `
    <div class="glass-card" style="margin-bottom:10px; padding:14px;" data-month-card="${monthNum}">
      <div class="month-toggle" style="display:flex; justify-content:space-between; align-items:center; gap:12px; cursor:pointer;">
        <div style="display:flex; gap:20px; align-items:center; flex-wrap:wrap;">
          <div style="font-weight:700; font-size:16px; color:var(--neon-cyan); min-width:60px;">${monthNum} 月</div>
          <div style="font-size:12px; color:var(--text-muted);">
            收入 <span class="mono text-emerald">${formatHKD(m.totalIncome)}</span>
            ｜ 支出 <span class="mono text-red">${formatHKD(m.totalExpense)}</span>
          </div>
        </div>
        <div class="mono" style="color:${netColor}; font-weight:700; font-size:14px;">
          ${formatHKD(m.netBalance)}
        </div>
      </div>
      <div class="month-detail" style="display:none; margin-top:12px; padding-top:12px; border-top:1px dashed rgba(255,255,255,0.1);">
        <div style="font-size:12px; color:var(--text-muted); margin-bottom:8px;">共 ${totalItems} 筆成員支出</div>
        ${Object.entries(perMember).map(([mid, md]) => `
          <div style="display:flex; justify-content:space-between; font-size:13px; padding:4px 0;">
            <span>${escapeHtml(md.memberName || '（未知）')}</span>
            <span class="mono text-magenta">${formatHKD(md.sum)}</span>
          </div>
        `).join('') || '<div style="font-size:12px; color:var(--text-muted);">本月無成員支出</div>'}
        ${(m.fixedList || []).length ? `
          <div style="margin-top:10px; font-size:12px; color:var(--text-muted);">固定支出</div>
          ${(m.fixedList || []).map((f) => `
            <div style="display:flex; justify-content:space-between; font-size:13px; padding:4px 0;">
              <span>${escapeHtml(f.name || '')}</span>
              <span class="mono text-orange">${formatHKD(f.amount)}</span>
            </div>
          `).join('')}
        ` : ''}
      </div>
    </div>
  `;
}

function _bindMonthCardToggles(container) {
  container.querySelectorAll('.month-toggle').forEach((el) => {
    el.addEventListener('click', () => {
      const detail = el.nextElementSibling;
      if (!detail) return;
      detail.style.display = detail.style.display === 'none' ? 'block' : 'none';
    });
  });
}

/* ============================================
   單月模式
   ============================================ */
function renderMonthly(data) {
  setText('stat-income',    formatHKD(data.totalIncome));
  setText('stat-expense',   formatHKD(data.totalExpense));
  setText('stat-net',       formatHKD(data.netBalance));
  setText('stat-insurance', formatHKD(data.yearlyInsuranceTotal));
  setText('stat-assets',    formatHKD(data.totalAssets));
  setText('stat-monthly-insurance', formatHKD(data.monthlyInsuranceAverage));

  const netEl = document.getElementById('stat-net');
  if (netEl) {
    netEl.classList.remove('emerald', 'red');
    netEl.classList.add(data.netBalance >= 0 ? 'emerald' : 'red');
  }

  const breakdown = data.incomeBreakdown || {};
  const perMember = data.perMember || {};
  const parts = [];
  Object.entries(breakdown).forEach(([key, val]) => {
    if (key === 'extra') {
      parts.push(`額外 ${formatHKD(val)}`);
    } else {
      const memberName = perMember[key]?.memberName || key;
      parts.push(`${memberName} ${formatHKD(val)}`);
    }
  });
  setText('hint-income', parts.length ? parts.join(' ＋ ') : '本月尚未設定收入');

  const totalItems = Object.values(perMember).reduce((s, m) => s + (m.itemCount || 0), 0);
  setText('hint-expense', `共 ${totalItems} 筆項目`);

  setText('hint-assets',
    `銀行 ${formatHKD(data.bankBalance)} ＋ 基金 ${formatHKD(data.fundValue)}`
  );

  setText('hint-insurance', `共 ${data.policyCount || 0} 張保單`);

  _renderMonthlyQuickSummary(data);
}

/* ============================================
   快速摘要卡
   ============================================ */
function _renderAnnualQuickSummary(data) {
  const root = document.getElementById('quick-summary-root');
  if (!root) return;

  // 使用共用 builder
  const perMember = {};
  (data.monthly || []).forEach((m) => {
    Object.entries(m.perMember || {}).forEach(([mid, md]) => {
      if (!perMember[mid]) perMember[mid] = { items: [] };
      perMember[mid].items.push(...(md.items || []));
    });
  });

  const categories = _collectCategoriesFromItems(
    Object.values(perMember).flatMap((m) => m.items)
  );

  const topList = Object.entries(categories)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  renderQuickSummary({
    containerId: 'quick-summary-root',
    type: QUICK_SUMMARY_TYPES.TOP_CATEGORIES,
    title: `${data.year} 年 Top 5 支出類別`,
    icon: 'trending-up',
    data: topList,
  });
}

function _renderMonthlyQuickSummary(data) {
  const topEl = document.getElementById('quick-summary-top');
  const recentEl = document.getElementById('quick-summary-recent');

  const allItems = [];
  Object.entries(data.perMember || {}).forEach(([memberId, md]) => {
    (md.items || []).forEach((it) => {
      allItems.push(it);
    });
  });

  const categories = _collectCategoriesFromItems(allItems);
  const topList = Object.entries(categories)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  // 最近活動（使用共用 builder）
  const recentData = buildRecentActivityData({
    expenses: allItems.map((it) => ({
      id: it.id,
      name: it.name,
      date: it.date,
      amount: it.amount,
      isAutoLinked: it.isAutoLinked,
      createdAt: it.createdAt || 0,
    })),
  }, 5);

  if (topEl) {
    renderQuickSummary({
      containerId: 'quick-summary-top',
      type: QUICK_SUMMARY_TYPES.TOP_CATEGORIES,
      title: '本月 Top 5 支出類別',
      icon: 'trending-up',
      data: topList,
    });
  }

  if (recentEl) {
    renderQuickSummary({
      containerId: 'quick-summary-recent',
      type: QUICK_SUMMARY_TYPES.RECENT_ACTIVITY,
      title: '最近活動',
      icon: 'activity',
      data: recentData,
    });
  }
}

function _collectCategoriesFromItems(items) {
  const categories = {};
  (items || []).forEach((it) => {
    const catName = it.categoryName || '（未分類）';
    if (!categories[catName]) categories[catName] = 0;
    categories[catName] += Number(it.amount) || 0;
  });
  return categories;
}

/* ============================================
   工具
   ============================================ */
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function showError(msg) {
  const banner = document.getElementById('dashboard-error');
  if (banner) {
    banner.textContent = '⚠ ' + msg;
    banner.style.display = 'block';
  }
}

/* ============================================
   銷毀
   ============================================ */
function _destroy() {
  if (_unsubscribeYM) {
    try { _unsubscribeYM(); } catch (e) { /* noop */ }
    _unsubscribeYM = null;
  }
  if (_filterInstance) {
    try { _filterInstance.destroy(); } catch (e) { /* noop */ }
    _filterInstance = null;
  }
}