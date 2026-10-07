// ============================================
// annual-report.js — 年度報表（v101）
// 位置：js/pages/annual-report.js
// ============================================
// v101 修正（重大）：
//   ✅ 分類邏輯改為 categoryId 精確比對（原版用字串比對，全部分到「其他」）
//   ✅ CATEGORY_ORDER 改讀 app-config（家庭可自訂）
//   ✅ 支付方式統計併入總表
//   ✅ 匯出 Excel 支援 categoryId 分類
//   ✅ 全年資料平行載入（Promise.all）
// ============================================

import { api } from '../core/api.js';
import { AppState } from '../core/state.js';
import {
  formatHKD, formatNumber, escapeHtml,
} from '../core/utils.js';
import {
  getOptions, getStatuses,
} from '../config/app-config.js';
import { initCollapsibleCard } from '../shared/collapsible-card.js';

/* ============================================
   Module 狀態
   ============================================ */
let _currentYear = '';
let _currentView = 'summary';
let _currentDisplayMonth = '01';
let _annualData = null;
let _membersCache = [];
let _categoriesCache = [];
let _unsubscribers = [];

/* ============================================
   主入口
   ============================================ */
export function initAnnualReportPage() {
  // 初始化可摺疊卡片
  initCollapsibleCard('summary-table-card', 'ar-summary-open', true);
  initCollapsibleCard('payment-stats-card', 'ar-payment-stats-open', true);
  initCollapsibleCard('monthly-table-card', 'ar-monthly-open', true);

  const { year } = AppState.getYearMonth();
  _currentYear = year;
  _currentDisplayMonth = AppState.month === 'all' ? '01' : AppState.month;

  _renderYearSwitcher();
  _renderMonthSwitcher();

  // 檢視切換
  document.getElementById('view-summary-btn')?.addEventListener('click', () => {
    _switchView('summary');
  });
  document.getElementById('view-monthly-btn')?.addEventListener('click', () => {
    _switchView('monthly');
  });

  // 匯出 Excel
  document.getElementById('export-excel-btn')?.addEventListener('click', _exportToExcel);

  // 初次載入
  _loadAnnual();

  return {
    destroy: _destroy,
  };
}

/* ============================================
   檢視切換
   ============================================ */
function _switchView(view) {
  _currentView = view;

  const summaryView = document.getElementById('summary-view');
  const monthlyView = document.getElementById('monthly-view');
  const monthSwitcher = document.getElementById('month-switcher');
  const summaryBtn = document.getElementById('view-summary-btn');
  const monthlyBtn = document.getElementById('view-monthly-btn');

  if (view === 'summary') {
    if (summaryView) summaryView.style.display = 'block';
    if (monthlyView) monthlyView.style.display = 'none';
    if (monthSwitcher) monthSwitcher.style.display = 'none';
    summaryBtn?.classList.add('btn-primary');
    summaryBtn?.classList.remove('btn-ghost');
    monthlyBtn?.classList.add('btn-ghost');
    monthlyBtn?.classList.remove('btn-primary');
    if (_annualData) _renderSummary();
  } else {
    if (summaryView) summaryView.style.display = 'none';
    if (monthlyView) monthlyView.style.display = 'block';
    if (monthSwitcher) monthSwitcher.style.display = 'flex';
    summaryBtn?.classList.add('btn-ghost');
    summaryBtn?.classList.remove('btn-primary');
    monthlyBtn?.classList.add('btn-primary');
    monthlyBtn?.classList.remove('btn-ghost');
    if (_annualData) _renderMonthly();
  }
}

/* ============================================
   年份切換
   ============================================ */
function _renderYearSwitcher() {
  const el = document.getElementById('year-switcher');
  if (!el) return;

  const y = Number(_currentYear);
  el.innerHTML = `
    <button class="year-btn year-arrow" data-year="${y - 1}">◀ ${y - 1}</button>
    <button class="year-btn active">${y}</button>
    <button class="year-btn year-arrow" data-year="${y + 1}">${y + 1} ▶</button>
  `;

  el.querySelectorAll('button[data-year]').forEach((btn) => {
    btn.addEventListener('click', () => {
      _currentYear = btn.dataset.year;
      _renderYearSwitcher();
      _loadAnnual();
    });
  });
}

/* ============================================
   月份切換
   ============================================ */
function _renderMonthSwitcher() {
  const el = document.getElementById('month-switcher');
  if (!el) return;

  let html = '';
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    html += `<button class="month-btn ${mm === _currentDisplayMonth ? 'active' : ''}" data-month="${mm}">${m}月</button>`;
  }
  el.innerHTML = html;

  el.querySelectorAll('button[data-month]').forEach((btn) => {
    btn.addEventListener('click', () => {
      _currentDisplayMonth = btn.dataset.month;
      _renderMonthSwitcher();
      if (_annualData) _renderMonthly();
    });
  });
}

/* ============================================
   載入全年資料
   ============================================ */
async function _loadAnnual() {
  const titleEl = document.getElementById('report-year-title');
  if (titleEl) titleEl.textContent = `${_currentYear} 年`;

  const tbody = document.getElementById('summary-tbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="empty-state">載入中…</td></tr>';
  const mtbody = document.getElementById('monthly-tbody');
  if (mtbody) mtbody.innerHTML = '<tr><td colspan="3" class="empty-state">載入中…</td></tr>';

  try {
    // 平行載入 12 個月
    const promises = [];
    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, '0');
      promises.push(api.summary(_currentYear, mm));
    }
    const results = await Promise.all(promises);

    _annualData = _buildAnnualData(_currentYear, results);

    _renderStats();
    if (_currentView === 'summary') _renderSummary();
    else _renderMonthly();
  } catch (err) {
    console.error('年度報表載入失敗：', err);
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="9" class="empty-state text-red">載入失敗，請稍後再試。</td></tr>';
    }
    if (mtbody) {
      mtbody.innerHTML = '<tr><td colspan="3" class="empty-state text-red">載入失敗，請稍後再試。</td></tr>';
    }
  }
}

/* ============================================
   建立年度資料結構
   ============================================ */
function _buildAnnualData(year, monthlyResults) {
  const memberMap = {};       // { memberId: { id, name, order, income[12], expenses: { catId: { name, amounts[12] } } } }
  const fixedMap = {};        // { catId: { catName, items: { itemName, amounts[12] } } }
  const paymentMap = {};      // { pmName: [12] }
  const monthlyTotals = { income: Array(12).fill(0), expense: Array(12).fill(0) };

  // 快取成員與類別
  _membersCache = [];
  _categoriesCache = [];

  monthlyResults.forEach((monthData, idx) => {
    /* ============ 收入 ============ */
    const incomeBreakdown = monthData.incomeBreakdown || {};
    Object.entries(incomeBreakdown).forEach(([memberId, amount]) => {
      const num = Math.round(Number(amount) || 0);
      if (num === 0) return;

      const displayName = memberId === 'extra'
        ? '額外收入'
        : (monthData.perMember?.[memberId]?.memberName || memberId);

      if (!memberMap[memberId]) {
        memberMap[memberId] = {
          id: memberId,
          name: displayName,
          order: memberId === 'extra' ? Number.MAX_SAFE_INTEGER : 0,
          income: Array(12).fill(0),
          expenses: {},   // { catId: { name, amounts[12] } }
        };
      }
      memberMap[memberId].income[idx] = num;
    });

    /* ============ 成員支出（依 categoryId 分類） ============ */
    const perMember = monthData.perMember || {};
    Object.entries(perMember).forEach(([memberId, mData]) => {
      if (!memberMap[memberId]) {
        memberMap[memberId] = {
          id: memberId,
          name: mData.memberName || memberId,
          order: mData.order != null ? mData.order : Number.MAX_SAFE_INTEGER,
          income: Array(12).fill(0),
          expenses: {},
        };
      }
      memberMap[memberId].order = mData.order != null ? mData.order : memberMap[memberId].order;

      (mData.items || []).forEach((item) => {
        // ✅ v101：改用 categoryId 精確比對
        const catId = item.categoryId || '__none__';
        const catName = item.categoryName || '（未分類）';

        if (!memberMap[memberId].expenses[catId]) {
          memberMap[memberId].expenses[catId] = {
            name: catName,
            amounts: Array(12).fill(0),
          };
        }
        memberMap[memberId].expenses[catId].amounts[idx] += Math.round(Number(item.amount) || 0);
      });
    });

    /* ============ 固定支出（依 categoryId 分類） ============ */
    (monthData.fixedList || []).forEach((f) => {
      const catId = f.categoryId || '__none__';
      const catName = f.categoryName || '其他';
      const itemName = f.name || '（未命名）';

      if (!fixedMap[catId]) {
        fixedMap[catId] = { catId, catName, items: {} };
      }
      if (!fixedMap[catId].items[itemName]) {
        fixedMap[catId].items[itemName] = Array(12).fill(0);
      }
      fixedMap[catId].items[itemName][idx] += Math.round(Number(f.amount) || 0);
    });

    /* ============ 支付方式統計 ============ */
    const pb = monthData.paymentBreakdown || {};
    Object.entries(pb).forEach(([pmName, amount]) => {
      if (!paymentMap[pmName]) paymentMap[pmName] = Array(12).fill(0);
      paymentMap[pmName][idx] += Math.round(Number(amount) || 0);
    });

    /* ============ 月度總計 ============ */
    monthlyTotals.income[idx] = Math.round(monthData.totalIncome || 0);
    monthlyTotals.expense[idx] = Math.round(monthData.totalExpense || 0);
  });

  /* ============ 排序成員 ============ */
  const membersArr = Object.values(memberMap).sort((a, b) => {
    if (a.id === 'extra') return 1;
    if (b.id === 'extra') return -1;
    const oa = a.order != null ? a.order : Number.MAX_SAFE_INTEGER;
    const ob = b.order != null ? b.order : Number.MAX_SAFE_INTEGER;
    if (oa !== ob) return oa - ob;
    return 0;
  });

  return {
    year,
    members: membersArr,
    fixedExpenses: fixedMap,        // { catId: { catId, catName, items } }
    paymentBreakdown: paymentMap,
    monthly: monthlyTotals,
  };
}

/* ============================================
   取得分類順序（從 app-config）
   ============================================ */
function _getCategoryOrder() {
  try {
    const order = getOptions('categoryOrder');
    if (Array.isArray(order) && order.length > 0) return order;
  } catch (e) { /* noop */ }

  return ['銀行類', '醫療類', '學校類', '保險類', '固定費用類', '交通類', '其他'];
}

/* ============================================
   統計卡
   ============================================ */
function _renderStats() {
  const totalIncome = _annualData.monthly.income.reduce((s, x) => s + x, 0);
  const totalExpense = _annualData.monthly.expense.reduce((s, x) => s + x, 0);
  const balance = totalIncome - totalExpense;

  const incomeEl = document.getElementById('annual-income');
  const expenseEl = document.getElementById('annual-expense');
  const balanceEl = document.getElementById('annual-balance');

  if (incomeEl) incomeEl.textContent = formatHKD(totalIncome);
  if (expenseEl) expenseEl.textContent = formatHKD(totalExpense);
  if (balanceEl) {
    balanceEl.textContent = formatHKD(balance);
    balanceEl.classList.remove('emerald', 'red');
    balanceEl.classList.add(balance >= 0 ? 'emerald' : 'red');
  }
}

/* ============================================
   全年總合（依類別欄位）
   ============================================ */
function _renderSummary() {
  const thead = document.getElementById('summary-thead');
  const tbody = document.getElementById('summary-tbody');
  if (!thead || !tbody) return;

  const catOrder = _getCategoryOrder();

  // 表頭
  thead.innerHTML = `<tr>
    <th style="min-width:100px;">成員</th>
    <th class="num">總收入</th>
    <th class="num">總支出</th>
    ${catOrder.map((c) => `<th class="num">${escapeHtml(c)}</th>`).join('')}
    <th class="num">年度淨結餘</th>
  </tr>`;

  const rows = [];
  let grandTotalIncome = 0;
  let grandTotalExpense = 0;
  const grandCategoryTotals = Object.fromEntries(catOrder.map((c) => [c, 0]));

  // 成員列
  _annualData.members.forEach((m) => {
    if (m.id === 'extra') return;

    const totalIncome = m.income.reduce((s, x) => s + x, 0);

    // ✅ v101：依 categoryId 精確對應到 categoryOrder
    const catTotals = Object.fromEntries(catOrder.map((c) => [c, 0]));
    let totalExpense = 0;
    let unmatchedTotal = 0;

    Object.entries(m.expenses).forEach(([catId, catData]) => {
      const sum = catData.amounts.reduce((s, x) => s + x, 0);
      totalExpense += sum;

      const catName = catData.name || '（未分類）';
      if (catTotals[catName] != null) {
        catTotals[catName] += sum;
      } else {
        unmatchedTotal += sum;
      }
    });

    // 未對應的歸到「其他」欄位
    if (unmatchedTotal > 0 && catTotals['其他'] != null) {
      catTotals['其他'] += unmatchedTotal;
    }

    grandTotalIncome += totalIncome;
    grandTotalExpense += totalExpense;
    catOrder.forEach((c) => { grandCategoryTotals[c] += catTotals[c]; });

    rows.push(`
      <tr>
        <td>${escapeHtml(m.name)}</td>
        <td class="num text-emerald">${formatHKD(totalIncome)}</td>
        <td class="num text-red">${formatHKD(totalExpense)}</td>
        ${catOrder.map((c) => `<td class="num">${catTotals[c] > 0 ? formatHKD(catTotals[c]) : '—'}</td>`).join('')}
        <td class="num" style="color:${(totalIncome - totalExpense) >= 0 ? 'var(--neon-emerald)' : 'var(--neon-red)'};">
          ${formatHKD(totalIncome - totalExpense)}
        </td>
      </tr>
    `);
  });

  // 家庭共用支出列（依 categoryId → catName）
  const sharedCatTotals = Object.fromEntries(catOrder.map((c) => [c, 0]));
  let sharedTotal = 0;

  Object.values(_annualData.fixedExpenses).forEach((catData) => {
    const catName = catData.catName || '其他';
    let catSum = 0;
    Object.values(catData.items).forEach((arr) => {
      catSum += arr.reduce((a, b) => a + b, 0);
    });
    sharedTotal += catSum;

    if (sharedCatTotals[catName] != null) {
      sharedCatTotals[catName] += catSum;
    } else if (sharedCatTotals['其他'] != null) {
      sharedCatTotals['其他'] += catSum;
    }
  });

  grandTotalExpense += sharedTotal;
  catOrder.forEach((c) => { grandCategoryTotals[c] += sharedCatTotals[c]; });

  if (sharedTotal > 0) {
    rows.push(`
      <tr class="shared-row">
        <td>家庭共用支出</td>
        <td class="num">—</td>
        <td class="num">${formatHKD(sharedTotal)}</td>
        ${catOrder.map((c) => `<td class="num">${sharedCatTotals[c] > 0 ? formatHKD(sharedCatTotals[c]) : '—'}</td>`).join('')}
        <td class="num" style="color:var(--neon-magenta);">-${formatHKD(sharedTotal)}</td>
      </tr>
    `);
  }

  // 額外收入
  const extraMember = _annualData.members.find((m) => m.id === 'extra');
  const extraIncome = extraMember ? extraMember.income.reduce((s, x) => s + x, 0) : 0;
  grandTotalIncome += extraIncome;

  // 總計列
  rows.push(`
    <tr class="group-header">
      <td>【總計】</td>
      <td class="num">${formatHKD(grandTotalIncome)}</td>
      <td class="num">${formatHKD(grandTotalExpense)}</td>
      ${catOrder.map((c) => `<td class="num">${formatHKD(grandCategoryTotals[c])}</td>`).join('')}
      <td class="num" style="color:${(grandTotalIncome - grandTotalExpense) >= 0 ? 'var(--neon-emerald)' : 'var(--neon-red)'};">
        ${formatHKD(grandTotalIncome - grandTotalExpense)}
      </td>
    </tr>
  `);

  tbody.innerHTML = rows.join('');

  if (window.lucide) window.lucide.createIcons();

  // 支付方式統計卡
  _renderPaymentStatsCard();
}

/* ============================================
   支付方式統計卡
   ============================================ */
function _renderPaymentStatsCard() {
  const container = document.getElementById('payment-stats-card');
  const body = document.getElementById('payment-stats-body');
  if (!container || !body) return;

  const pb = _annualData.paymentBreakdown || {};
  const entries = Object.entries(pb).filter(([, arr]) => arr.some((v) => v > 0));

  if (entries.length === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';

  // 依總額排序
  entries.sort((a, b) => {
    const sa = a[1].reduce((s, x) => s + x, 0);
    const sb = b[1].reduce((s, x) => s + x, 0);
    return sb - sa;
  });

  const rows = entries.map(([pmName, arr]) => {
    const total = arr.reduce((s, x) => s + x, 0);
    return `
      <tr>
        <td>${escapeHtml(pmName)}</td>
        <td class="num text-emerald">${formatHKD(total)}</td>
      </tr>
    `;
  }).join('');

  const grandTotal = entries.reduce((s, [, arr]) => s + arr.reduce((a, b) => a + b, 0), 0);

  body.innerHTML = `
    <div style="overflow-x:auto;">
      <table class="annual-table" style="min-width:400px;">
        <thead>
          <tr><th>支付方式</th><th class="num">年度總支出</th></tr>
        </thead>
        <tbody>
          ${rows}
          <tr class="group-header">
            <td>【總計】</td>
            <td class="num">${formatHKD(grandTotal)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   按月明細
   ============================================ */
function _renderMonthly() {
  const tbody = document.getElementById('monthly-tbody');
  if (!tbody) return;

  const monthIdx = Number(_currentDisplayMonth) - 1;
  const rows = [];
  const sumArr = (arr) => arr.reduce((s, x) => s + x, 0);

  /* ============ 收入區塊 ============ */
  const incomeRows = _annualData.members.filter((m) => m.income.some((v) => v > 0));
  if (incomeRows.length > 0) {
    rows.push(`<tr class="group-header"><td>【收入】</td><td class="num"></td><td class="num"></td></tr>`);

    incomeRows.forEach((m) => {
      const current = m.income[monthIdx] || 0;
      const annual = sumArr(m.income);
      rows.push(`
        <tr>
          <td>${escapeHtml(m.name)}</td>
          <td class="num text-emerald">${current ? formatNumber(current) : '—'}</td>
          <td class="num text-emerald">${annual ? formatNumber(annual) : '—'}</td>
        </tr>
      `);
    });

    const totalCurrent = _annualData.monthly.income[monthIdx] || 0;
    const totalAnnual = sumArr(_annualData.monthly.income);
    rows.push(`
      <tr class="subtotal-row">
        <td>收入小計</td>
        <td class="num">${formatNumber(totalCurrent)}</td>
        <td class="num">${formatNumber(totalAnnual)}</td>
      </tr>
    `);
  }

  /* ============ 成員支出區塊 ============ */
  _annualData.members.forEach((m) => {
    if (m.id === 'extra') return;
    const catIds = Object.keys(m.expenses);
    if (catIds.length === 0) return;

    let currentMemberSum = 0;
    let annualMemberSum = 0;

    // 依類別分組
    const byCat = {};
    catIds.forEach((catId) => {
      const catData = m.expenses[catId];
      const amounts = catData.amounts;
      currentMemberSum += amounts[monthIdx] || 0;
      annualMemberSum += sumArr(amounts);

      const catName = catData.name || '（未分類）';
      if (!byCat[catName]) byCat[catName] = [];
      byCat[catName].push({ catId, catData });
    });

    rows.push(`<tr class="group-header"><td>【${escapeHtml(m.name)}】</td><td class="num"></td><td class="num"></td></tr>`);

    // 依分類順序列出
    const catOrder = _getCategoryOrder();
    const sortedCatNames = Object.keys(byCat).sort((a, b) => {
      const ia = catOrder.indexOf(a);
      const ib = catOrder.indexOf(b);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    });

    sortedCatNames.forEach((catName) => {
      const catTotal = {
        current: 0,
        annual: 0,
      };
      byCat[catName].forEach(({ catData }) => {
        catTotal.current += catData.amounts[monthIdx] || 0;
        catTotal.annual += sumArr(catData.amounts);
      });

      rows.push(`
        <tr>
          <td style="padding-left:24px; color:var(--text-secondary); font-size:12px;">${escapeHtml(catName)}</td>
          <td class="num">${catTotal.current ? formatNumber(catTotal.current) : '—'}</td>
          <td class="num">${catTotal.annual ? formatNumber(catTotal.annual) : '—'}</td>
        </tr>
      `);
    });

    rows.push(`
      <tr class="subtotal-row">
        <td>${escapeHtml(m.name)}小計</td>
        <td class="num">${formatNumber(currentMemberSum)}</td>
        <td class="num">${formatNumber(annualMemberSum)}</td>
      </tr>
    `);
  });

  /* ============ 家庭共用支出區塊 ============ */
  const allFixedItems = {};
  Object.values(_annualData.fixedExpenses).forEach((catData) => {
    Object.entries(catData.items).forEach(([name, arr]) => {
      if (!allFixedItems[name]) allFixedItems[name] = Array(12).fill(0);
      arr.forEach((v, i) => { allFixedItems[name][i] += v; });
    });
  });

  const fixedItemNames = Object.keys(allFixedItems).sort();
  if (fixedItemNames.length > 0) {
    rows.push(`<tr class="group-header"><td>【家庭共用支出】</td><td class="num"></td><td class="num"></td></tr>`);

    let sharedCurrentTotal = 0;
    let sharedAnnualTotal = 0;

    fixedItemNames.forEach((name) => {
      const amounts = allFixedItems[name];
      const current = amounts[monthIdx] || 0;
      const annual = sumArr(amounts);
      sharedCurrentTotal += current;
      sharedAnnualTotal += annual;

      rows.push(`
        <tr>
          <td>${escapeHtml(name)}</td>
          <td class="num">${current ? formatNumber(current) : '—'}</td>
          <td class="num">${annual ? formatNumber(annual) : '—'}</td>
        </tr>
      `);
    });

    rows.push(`
      <tr class="subtotal-row">
        <td>家庭共用支出小計</td>
        <td class="num">${formatNumber(sharedCurrentTotal)}</td>
        <td class="num">${formatNumber(sharedAnnualTotal)}</td>
      </tr>
    `);
  }

  /* ============ 月度總計 ============ */
  const expenseCurrent = _annualData.monthly.expense[monthIdx] || 0;
  const expenseAnnual = sumArr(_annualData.monthly.expense);
  const incomeCurrent = _annualData.monthly.income[monthIdx] || 0;
  const incomeAnnual = sumArr(_annualData.monthly.income);
  const netCurrent = incomeCurrent - expenseCurrent;
  const netAnnual = incomeAnnual - expenseAnnual;

  rows.push(`<tr class="group-header"><td>【月度總計】</td><td class="num"></td><td class="num"></td></tr>`);
  rows.push(`
    <tr class="total-row">
      <td>當月總支出</td>
      <td class="num">${formatNumber(expenseCurrent)}</td>
      <td class="num">${formatNumber(expenseAnnual)}</td>
    </tr>
  `);
  rows.push(`
    <tr class="net-row">
      <td>當月淨結餘</td>
      <td class="num" style="color:${netCurrent >= 0 ? 'var(--neon-emerald)' : 'var(--neon-red)'};">${formatNumber(netCurrent)}</td>
      <td class="num" style="color:${netAnnual >= 0 ? 'var(--neon-emerald)' : 'var(--neon-red)'};">${formatNumber(netAnnual)}</td>
    </tr>
  `);

  tbody.innerHTML = rows.join('');
  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   匯出 Excel
   ============================================ */
function _exportToExcel() {
  if (!_annualData) {
    alert('資料尚未載入完成');
    return;
  }

  if (typeof XLSX === 'undefined') {
    alert('Excel 匯出工具尚未載入，請稍後再試');
    return;
  }

  const data = _annualData;
  const rows = [];

  rows.push(['項目', '1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月', '年度小計']);

  const totalIncome = Math.round(data.monthly.income.reduce((s, x) => s + x, 0));
  const totalExpense = Math.round(data.monthly.expense.reduce((s, x) => s + x, 0));
  const balance = totalIncome - totalExpense;

  /* ============ 收入 ============ */
  rows.push(['【收入】', '', '', '', '', '', '', '', '', '', '', '', '', '']);
  data.members.filter((m) => m.income.some((v) => v > 0)).forEach((m) => {
    const subtotal = Math.round(m.income.reduce((s, x) => s + x, 0));
    rows.push([`  ${m.name}`, ...m.income.map((v) => Math.round(v)), subtotal]);
  });
  rows.push(['收入小計', ...data.monthly.income.map((v) => Math.round(v)), totalIncome]);

  /* ============ 成員支出（依類別） ============ */
  data.members.forEach((m) => {
    if (m.id === 'extra') return;
    const catIds = Object.keys(m.expenses);
    if (catIds.length === 0) return;

    rows.push([`【${m.name}】`, '', '', '', '', '', '', '', '', '', '', '', '', '']);

    const monthlyMemberTotal = Array(12).fill(0);
    Object.entries(m.expenses).forEach(([catId, catData]) => {
      const amounts = catData.amounts;
      amounts.forEach((v, i) => { monthlyMemberTotal[i] += v; });
      const subtotal = Math.round(amounts.reduce((s, x) => s + x, 0));
      rows.push([`  ${catData.name || '（未分類）'}`, ...amounts.map((v) => Math.round(v)), subtotal]);
    });

    const memberSubtotal = Math.round(monthlyMemberTotal.reduce((s, x) => s + x, 0));
    rows.push([`${m.name}小計`, ...monthlyMemberTotal.map((v) => Math.round(v)), memberSubtotal]);
  });

  /* ============ 家庭共用支出 ============ */
  const fixedCatIds = Object.keys(data.fixedExpenses);
  if (fixedCatIds.length > 0) {
    const monthlyFixedTotal = Array(12).fill(0);

    fixedCatIds.forEach((catId) => {
      const catData = data.fixedExpenses[catId];
      rows.push([`【家庭共用支出 - ${catData.catName}】`, '', '', '', '', '', '', '', '', '', '', '', '', '']);

      Object.entries(catData.items).forEach(([name, amounts]) => {
        amounts.forEach((v, i) => { monthlyFixedTotal[i] += v; });
        const subtotal = Math.round(amounts.reduce((s, x) => s + x, 0));
        rows.push([`  ${name}`, ...amounts.map((v) => Math.round(v)), subtotal]);
      });
    });

    const fixedSubtotal = Math.round(monthlyFixedTotal.reduce((s, x) => s + x, 0));
    rows.push(['固定支出小計', ...monthlyFixedTotal.map((v) => Math.round(v)), fixedSubtotal]);
  }

  /* ============ 支付方式統計 ============ */
  const pbEntries = Object.entries(data.paymentBreakdown || {}).filter(([, arr]) => arr.some((v) => v > 0));
  if (pbEntries.length > 0) {
    rows.push(['【支付方式統計】', '', '', '', '', '', '', '', '', '', '', '', '', '']);
    let pmGrand = 0;
    pbEntries.forEach(([pmName, arr]) => {
      const total = Math.round(arr.reduce((s, x) => s + x, 0));
      pmGrand += total;
      rows.push([`  ${pmName}`, ...arr.map((v) => Math.round(v)), total]);
    });
    rows.push(['支付方式合計', '', '', '', '', '', '', '', '', '', '', '', '', pmGrand]);
  }

  /* ============ 月度總計 ============ */
  rows.push(['【月度總計】', '', '', '', '', '', '', '', '', '', '', '', '', '']);
  rows.push(['當月總支出', ...data.monthly.expense.map((v) => Math.round(v)), totalExpense]);
  const netMonthly = data.monthly.income.map((v, i) => v - data.monthly.expense[i]);
  rows.push(['當月淨結餘', ...netMonthly.map((v) => Math.round(v)), balance]);

  /* ============ 建立工作表 ============ */
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 32 }, ...Array(12).fill({ wch: 12 }), { wch: 14 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `${data.year}年度報表`);

  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const filename = `家庭報表(${data.year})-${mm}${dd}${hh}${ss}.xlsx`;

  XLSX.writeFile(wb, filename);
}

/* ============================================
   銷毀
   ============================================ */
function _destroy() {
  _unsubscribers.forEach((fn) => {
    try { fn(); } catch (e) { /* noop */ }
  });
  _unsubscribers = [];
}