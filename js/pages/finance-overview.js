// ============================================
// finance-overview.js — 財務總覽（v101.6 🆕）
// 位置：js/pages/finance-overview.js
// ============================================
// 職責：
//   合併「收入」與「銀行結餘」為單一頁面
//   共用一個年月選擇器
//   各自總計 + 合併總計
// ============================================

import { AppState } from '../core/state.js';
import {
  listenBanks,
  listenMembers,
  getIncomeOnce,
  getBankBalancesOnce,
} from '../core/db.js';
import {
  escapeHtml, formatHKD, sortMembers, setText,
} from '../core/utils.js';
import { renderPageFilter } from '../shared/page-filter.js';
import { renderStatsCards } from '../shared/stats-cards.js';
import { createListenerGroup } from '../shared/listener-group.js';
import { RESERVED_IDS } from '../config/constants.js';
import { registerPageCleanup } from '../core/app.js';

/* ============================================
   Module 狀態
   ============================================ */
let _members = [];
let _banks = [];
let _income = {};
let _balances = {};

let _filterInstance = null;
let _statsApi = null;

const listenerGroup = createListenerGroup();

/* ============================================
   主入口
   ============================================ */
export async function initFinanceOverviewPage() {
  // 共用年月選擇器
  _filterInstance = renderPageFilter({
    containerId: 'page-filter-root',
    fields: ['year', 'month'],
  });

  // 監聽年月變更
  listenerGroup.add(
    AppState.on('ym-change', () => _reload())
  );

  // 監聽成員
  listenerGroup.add(
    listenMembers((list) => {
      _members = sortMembers(list);
      _renderIncomeSection();
    })
  );

  // 監聽銀行（銀行清單不隨年月變）
  listenerGroup.add(
    listenBanks((list) => {
      _banks = list || [];
      _reload();
    })
  );

  // 初次載入
  await _reload();

  registerPageCleanup(_destroy);

  return { destroy: _destroy };
}

/* ============================================
   載入資料
   ============================================ */
async function _reload() {
  const { year, month } = AppState.getYearMonth();

  setText('finance-month-label',
    month === 'all' ? `${year} 年（請選擇月份）` : `${year} 年 ${month} 月`);

  // 全年模式：清空資料，顯示提示
  if (month === 'all') {
    _income = {};
    _balances = {};
    _render();
    return;
  }

  try {
    const [income, balances] = await Promise.all([
      getIncomeOnce(year, month),
      getBankBalancesOnce(year, month),
    ]);
    _income = income || {};
    _balances = balances || {};
  } catch (err) {
    console.error('[finance-overview] 載入失敗：', err);
    _income = {};
    _balances = {};
  }

  _render();
}

/* ============================================
   渲染
   ============================================ */
function _render() {
  _renderStats();
  _renderIncomeSection();
  _renderBankSection();
}

/* ============================================
   統計卡
   ============================================ */
function _renderStats() {
  const totalIncome = Object.values(_income).reduce((s, v) => s + (Number(v) || 0), 0);
  const totalBank = Object.values(_balances).reduce((s, b) => s + (Number(b.amount) || 0), 0);
  const total = totalIncome + totalBank;

  const cards = [
    {
      title: '當月總收入',
      value: formatHKD(totalIncome),
      valueClass: 'emerald',
      hint: '所有成員收入加總',
      icon: 'trending-up',
    },
    {
      title: '當月銀行結餘',
      value: formatHKD(totalBank),
      valueClass: 'cyan',
      hint: `共 ${_banks.length} 間銀行`,
      icon: 'landmark',
    },
    {
      title: '合計可用資金',
      value: formatHKD(total),
      valueClass: 'magenta',
      hint: '收入 + 銀行結餘',
      icon: 'wallet',
    },
  ];

  if (_statsApi) {
    try { _statsApi.destroy(); } catch (e) { /* noop */ }
    _statsApi = null;
  }

  _statsApi = renderStatsCards({
    container: 'finance-stats-root',
    cards,
    columns: 3,
  });
}

/* ============================================
   收入區塊
   ============================================ */
function _renderIncomeSection() {
  const root = document.getElementById('income-section-root');
  if (!root) return;

  // 組合資料
  const rows = [];
  _members.forEach((m) => {
    const val = Number(_income[m.id]) || 0;
    rows.push({ name: m.name, amount: val });
  });

  const extra = Number(_income[RESERVED_IDS.EXTRA_INCOME]) || 0;
  if (extra > 0) {
    rows.push({ name: '額外收入', amount: extra });
  }

  const visibleRows = rows.filter((r) => r.amount > 0);

  if (visibleRows.length === 0) {
    root.innerHTML = '<div class="empty-state" style="padding:20px;">此月份尚無收入紀錄</div>';
    return;
  }

  const total = visibleRows.reduce((s, r) => s + r.amount, 0);

  root.innerHTML = `
    <div style="overflow-x:auto;">
      <table class="data-table">
        <thead>
          <tr>
            <th>成員</th>
            <th class="num" style="width:160px;">金額（HK$）</th>
          </tr>
        </thead>
        <tbody>
          ${visibleRows.map((r) => `
            <tr>
              <td>${escapeHtml(r.name)}</td>
              <td class="num text-emerald">${formatHKD(r.amount)}</td>
            </tr>
          `).join('')}
          <tr style="font-weight:700; background:rgba(0,240,255,0.05);">
            <td>【收入總計】</td>
            <td class="num text-cyan">${formatHKD(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

/* ============================================
   銀行區塊
   ============================================ */
function _renderBankSection() {
  const root = document.getElementById('bank-section-root');
  if (!root) return;

  if (_banks.length === 0) {
    root.innerHTML = '<div class="empty-state" style="padding:20px;">尚未新增銀行</div>';
    return;
  }

  const rows = _banks.map((b) => {
    const bal = _balances[b.id] || {};
    return {
      id: b.id,
      name: b.name,
      amount: Number(bal.amount) || 0,
      updatedAt: bal.updatedAt || 0,
    };
  });

  const total = rows.reduce((s, r) => s + r.amount, 0);

  root.innerHTML = `
    <div style="overflow-x:auto;">
      <table class="data-table mobile-cards">
        <thead>
          <tr>
            <th>銀行名稱</th>
            <th class="num" style="width:160px;">結餘（HK$）</th>
            <th class="hide-mobile" style="width:150px;">最後更新</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r) => `
            <tr>
              <td data-primary="1">${escapeHtml(r.name)}</td>
              <td class="num text-emerald" data-label="結餘">${formatHKD(r.amount)}</td>
              <td class="hide-mobile" data-label="最後更新" style="font-size:11px; color:var(--text-muted);">
                ${r.updatedAt ? new Date(r.updatedAt).toLocaleString('zh-HK', {
                  year: 'numeric', month: '2-digit', day: '2-digit',
                  hour: '2-digit', minute: '2-digit',
                }) : '—'}
              </td>
            </tr>
          `).join('')}
          <tr style="font-weight:700; background:rgba(0,240,255,0.05);">
            <td>【銀行結餘總計】</td>
            <td class="num text-cyan">${formatHKD(total)}</td>
            <td class="hide-mobile"></td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
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

  _members = [];
  _banks = [];
  _income = {};
  _balances = {};
}