// ============================================
// dashboard.js — 總覽儀表板（v101.6.6）
// 位置：js/pages/dashboard.js
// ============================================
// v101.6.6 修正：
//   ✅ [BUG-08] 修復一次 60 次 API 呼叫問題
//       - 當前年度優先載入 → 立即渲染
//       - 其餘 4 年順序載入 → 漸進式更新表格
//       - 峰值並行請求：12（單年度 12 月）
//   ✅ 保留所有 v101.6 功能
// ============================================

import { api } from '../core/api.js';
import { AppState } from '../core/state.js';
import { formatHKD, escapeHtml, setText } from '../core/utils.js';
import { renderStatsCards } from '../shared/stats-cards.js';
import { registerPageCleanup } from '../core/app.js';

/* ============================================
   Module 狀態
   ============================================ */
let _annualData = {};
let _statsCardsApi = null;
let _errorEl = null;

/* ============================================
   主入口
   ============================================ */
export async function initDashboardPage() {
  _errorEl = document.getElementById('dashboard-error');

  const currentYear = Number(AppState.year) || new Date().getFullYear();
  const years = _getSurroundingYears(currentYear);

  setText('dashboard-subtitle', `${years[0]} ~ ${years[years.length - 1]} 年`);

  await _loadAnnualData(years, currentYear);

  registerPageCleanup(_destroy);

  return { destroy: _destroy };
}

/* ============================================
   取得前後 2 年
   ============================================ */
function _getSurroundingYears(currentYear) {
  const years = [];
  for (let i = -2; i <= 2; i++) {
    years.push(currentYear + i);
  }
  return years;
}

/* ============================================
   載入年度資料（🆕 v101.6.6：兩階段載入）
   ============================================ */
async function _loadAnnualData(years, currentYear) {
  _annualData = {};

  // 初始表格（全部顯示「載入中…」）
  _renderAnnualTable(years, currentYear);

  /* ---------- 階段 1：當前年度（優先） ---------- */
  try {
    _annualData[currentYear] = await api.fetchAnnualSummary(currentYear);
    _renderStatsCards(currentYear);
    _renderAnnualTable(years, currentYear);
  } catch (err) {
    console.error(`[dashboard] 載入 ${currentYear} 年度失敗：`, err);
    _showError(`無法載入 ${currentYear} 年度資料`);
  }

  /* ---------- 階段 2：其餘 4 年（順序載入，漸進式更新） ---------- */
  for (const y of years) {
    if (y === currentYear) continue;

    try {
      _annualData[y] = await api.fetchAnnualSummary(y);
    } catch (err) {
      console.warn(`[dashboard] 載入 ${y} 年度失敗：`, err);
      // 保留為 null（表格會顯示「尚無資料」）
    }

    // 每完成一年，更新表格
    _renderAnnualTable(years, currentYear);
  }
}

/* ============================================
   統計卡（當前年度）
   ============================================ */
function _renderStatsCards(currentYear) {
  const data = _annualData[currentYear];
  if (!data) return;

  const monthsWithData = (data.monthly || []).filter((m) => m.totalExpense > 0).length;
  const monthlyAvg = monthsWithData > 0
    ? Math.round(data.totalExpense / monthsWithData)
    : 0;

  const cards = [
    {
      title: `${currentYear} 年度總收入`,
      value: formatHKD(data.totalIncome),
      valueClass: 'emerald',
      hint: '所有成員收入加總',
      icon: 'trending-up',
    },
    {
      title: `${currentYear} 年度總支出`,
      value: formatHKD(data.totalExpense),
      valueClass: 'red',
      hint: '含保險平攤',
      icon: 'trending-down',
    },
    {
      title: `${currentYear} 年度淨餘額`,
      value: formatHKD(data.netBalance),
      valueClass: data.netBalance >= 0 ? 'emerald' : 'red',
      hint: '收入 − 支出',
      icon: 'wallet',
    },
    {
      title: `${currentYear} 每月平均支出`,
      value: formatHKD(monthlyAvg),
      valueClass: 'magenta',
      hint: monthsWithData > 0 ? `依 ${monthsWithData} 個月計算` : '尚無支出',
      icon: 'calculator',
    },
  ];

  if (_statsCardsApi) {
    try { _statsCardsApi.destroy(); } catch (e) { /* noop */ }
  }

  _statsCardsApi = renderStatsCards({
    container: 'stats-cards-root',
    cards,
    columns: 4,
  });
}

/* ============================================
   年度清單表格
   ============================================ */
function _renderAnnualTable(years, currentYear) {
  const root = document.getElementById('annual-table-root');
  if (!root) return;

  const rows = years.map((year) => {
    const data = _annualData[year];
    const isCurrent = year === currentYear;

    if (!data) {
      return {
        year,
        isCurrent,
        totalIncome: null,
        totalExpense: null,
        insurance: null,
        net: null,
        avg: null,
        hasData: false,
      };
    }

    const monthsWithData = (data.monthly || []).filter((m) => m.totalExpense > 0).length;
    const avg = monthsWithData > 0 ? Math.round(data.totalExpense / monthsWithData) : 0;

    return {
      year,
      isCurrent,
      totalIncome: data.totalIncome,
      totalExpense: data.totalExpense,
      insurance: data.yearlyInsuranceTotal,
      net: data.netBalance,
      avg,
      hasData: true,
    };
  });

  root.innerHTML = `
    <div style="overflow-x:auto;">
      <table class="data-table">
        <thead>
          <tr>
            <th style="width:120px;">年度</th>
            <th class="num">總收入</th>
            <th class="num">總支出</th>
            <th class="num hide-mobile">保險平攤</th>
            <th class="num">淨餘額</th>
            <th class="num hide-mobile">每月平均支出</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r) => _renderAnnualRow(r)).join('')}
        </tbody>
      </table>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
}

function _renderAnnualRow(r) {
  const currentBadge = r.isCurrent
    ? '<span class="badge badge-info" style="margin-left:6px;">今年</span>'
    : '';

  if (!r.hasData) {
    return `
      <tr style="${r.isCurrent ? 'background:rgba(0,240,255,0.03);' : ''}">
        <td>${r.year} 年${currentBadge}</td>
        <td colspan="5" class="empty-state" style="text-align:center;">尚無資料</td>
      </tr>
    `;
  }

  const netClass = r.net >= 0 ? 'text-emerald' : 'text-red';

  return `
    <tr style="${r.isCurrent ? 'background:rgba(0,240,255,0.03); font-weight:600;' : ''}">
      <td>${r.year} 年${currentBadge}</td>
      <td class="num text-emerald">${formatHKD(r.totalIncome)}</td>
      <td class="num text-red">${formatHKD(r.totalExpense)}</td>
      <td class="num hide-mobile text-magenta">${formatHKD(r.insurance)}</td>
      <td class="num ${netClass}">${formatHKD(r.net)}</td>
      <td class="num hide-mobile">${formatHKD(r.avg)}</td>
    </tr>
  `;
}

/* ============================================
   錯誤顯示
   ============================================ */
function _showError(msg) {
  if (_errorEl) {
    _errorEl.textContent = '⚠ ' + msg;
    _errorEl.style.display = 'block';
  }
}

/* ============================================
   銷毀
   ============================================ */
function _destroy() {
  if (_statsCardsApi) {
    try { _statsCardsApi.destroy(); } catch (e) { /* noop */ }
    _statsCardsApi = null;
  }
  _annualData = {};
}