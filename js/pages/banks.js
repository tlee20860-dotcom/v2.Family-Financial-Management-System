// ============================================
// banks.js — 銀行管理明細（v101.2 只讀化）
// 位置：js/pages/banks.js
// ============================================
// v101.2 修正：
//   ✅ 移除未使用的 getBankBalancesOnceForYear import（致命 Bug）
//   ✅ 統一由 AppState ym-change 載入
// ============================================

import {
  listenBanks, getBankBalancesOnce,
} from '../core/db.js';
import { AppState } from '../core/state.js';
import { escapeHtml, formatHKD } from '../core/utils.js';
import { renderPageFilter } from '../shared/page-filter.js';
import { initViewToggle } from '../shared/view-toggle.js';
import { renderQuickSummary } from '../shared/quick-summary.js';
import { QUICK_SUMMARY_TYPES } from '../config/constants.js';

/* ============================================
   Module 狀態
   ============================================ */
let _banks = [];
let _balances = {};
let _prevBalances = {};
let _filters = { year: '', month: 'all', bank: '' };
let _currentMode = 'annual';  // 'monthly' | 'annual'
let _viewToggle = null;
let _filterInstance = null;
let _unsubBanks = null;
let _unsubYM = null;

/* ============================================
   主入口
   ============================================ */
export async function initBanksPage() {
  // 檢視切換
  _viewToggle = initViewToggle({
    containerId: 'view-toggle-root',
    storageKey: 'banks-view',
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
        <label class="field-label">銀行</label>
        <select class="select" data-filter="bank">
          <option value="">全部</option>
          ${_banks.map((b) => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('')}
        </select>
      </div>
    `,
    onChange: (f) => {
      _filters = {
        year: f.year || '',
        month: f.month || 'all',
        bank: f.bank || '',
      };
      // 依月份決定模式
      if (_filters.month === 'all') {
        _currentMode = 'annual';
      } else {
        _currentMode = 'monthly';
      }
      _updateToggleUI();
      _loadBalances();
    },
  });

  // 監聽 AppState
  _unsubYM = AppState.on('ym-change', () => _loadBalances());

  // 監聽銀行
  _unsubBanks = listenBanks((list) => {
    _banks = list;
    _updateFilterOptions();
    _loadBalances();
  });

  // 綁定單月/全年切換
  _bindToggleButtons();

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
  const bankSel = root.querySelector('select[data-filter="bank"]');
  if (bankSel) {
    const cur = bankSel.value;
    bankSel.innerHTML = `<option value="">全部</option>` +
      _banks.map((b) => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('');
    if (cur && _banks.some((b) => b.id === cur)) bankSel.value = cur;
  }
}

/* ============================================
   單月/全年切換
   ============================================ */
function _bindToggleButtons() {
  document.getElementById('view-month-btn')?.addEventListener('click', () => {
    _currentMode = 'monthly';
    _filters.month = _filters.month === 'all' ? '01' : _filters.month;
    _updateToggleUI();
    _loadBalances();
  });

  document.getElementById('view-annual-btn')?.addEventListener('click', () => {
    _currentMode = 'annual';
    _filters.month = 'all';
    _updateToggleUI();
    _loadBalances();
  });

  _updateToggleUI();
}

function _updateToggleUI() {
  const monthBtn = document.getElementById('view-month-btn');
  const annualBtn = document.getElementById('view-annual-btn');
  if (!monthBtn || !annualBtn) return;

  if (_currentMode === 'monthly') {
    monthBtn.classList.add('btn-primary'); monthBtn.classList.remove('btn-ghost');
    annualBtn.classList.add('btn-ghost'); annualBtn.classList.remove('btn-primary');
  } else {
    monthBtn.classList.add('btn-ghost'); monthBtn.classList.remove('btn-primary');
    annualBtn.classList.add('btn-primary'); annualBtn.classList.remove('btn-ghost');
  }
}

/* ============================================
   載入結餘
   ============================================ */
async function _loadBalances() {
  const targetYear = _filters.year || AppState.year;

  if (_currentMode === 'annual') {
    await _loadAnnual(targetYear);
  } else {
    await _loadMonthly(targetYear, _filters.month || '01');
  }
}

/* ============================================
   單月模式
   ============================================ */
async function _loadMonthly(year, month) {
  const monthLabel = document.getElementById('banks-month');
  if (monthLabel) monthLabel.textContent = `${year} 年 ${month} 月 結餘`;

  // 顯示單月檢視
  const summaryView = document.getElementById('banks-summary-view');
  const annualView = document.getElementById('banks-annual-view');
  if (summaryView) summaryView.style.display = 'block';
  if (annualView) annualView.style.display = 'none';

  try {
    const [balances, prevBalances] = await Promise.all([
      getBankBalancesOnce(year, month),
      _getPrevMonthBalances(year, month),
    ]);
    _balances = balances || {};
    _prevBalances = prevBalances || {};
    _render();
  } catch (err) {
    console.error('[banks] 載入失敗：', err);
  }
}

async function _getPrevMonthBalances(year, month) {
  const y = Number(year);
  const m = Number(month);
  let prevY = y;
  let prevM = m - 1;
  if (prevM < 1) { prevY = y - 1; prevM = 12; }
  const prevMonthStr = String(prevM).padStart(2, '0');
  try {
    return await getBankBalancesOnce(prevY, prevMonthStr);
  } catch (e) {
    return {};
  }
}

/* ============================================
   全年模式
   ============================================ */
async function _loadAnnual(year) {
  const monthLabel = document.getElementById('banks-month');
  if (monthLabel) monthLabel.textContent = `${year} 年度總覽`;

  // 顯示全年檢視
  const summaryView = document.getElementById('banks-summary-view');
  const annualView = document.getElementById('banks-annual-view');
  if (summaryView) summaryView.style.display = 'none';
  if (annualView) annualView.style.display = 'block';

  try {
    const monthlyBalances = [];
    const promises = [];
    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, '0');
      promises.push(getBankBalancesOnce(year, mm));
    }
    const results = await Promise.all(promises);
    results.forEach((r, i) => {
      monthlyBalances.push({ monthNum: i + 1, month: String(i + 1).padStart(2, '0'), data: r || {} });
    });

    _renderAnnual(year, monthlyBalances);
  } catch (err) {
    console.error('[banks] 全年載入失敗：', err);
  }
}

/* ============================================
   渲染（單月）
   ============================================ */
function _render() {
  const cardEl = document.getElementById('banks-card-view');
  const tableEl = document.getElementById('banks-table-view');
  if (!cardEl || !tableEl) return;

  const filteredBanks = _filteredBanks();
  const view = _viewToggle?.getView() || 'card';

  const countEl = document.getElementById('bank-count');
  if (countEl) countEl.textContent = `（共 ${filteredBanks.length} 間）`;

  // 統計卡
  const total = filteredBanks.reduce((s, b) => s + (Number(_balances[b.id]?.amount) || 0), 0);
  const totalEl = document.getElementById('bank-total');
  if (totalEl) totalEl.textContent = formatHKD(total);

  // 可用金額（上月結餘）
  const prevTotal = Object.values(_prevBalances).reduce((s, b) => s + (Number(b.amount) || 0), 0);
  const availEl = document.getElementById('bank-available');
  if (availEl) availEl.textContent = formatHKD(prevTotal);

  if (filteredBanks.length === 0) {
    const emptyHtml = `
      <div class="glass-card">
        <div class="empty-state">
          <i data-lucide="landmark" style="width:48px;height:48px;opacity:0.4;"></i>
          <p style="margin-top:12px;">尚未新增銀行</p>
          <button class="btn btn-primary" onclick="window.location.href='database.html'" style="margin-top:12px;">
            <i data-lucide="plus"></i> 前往基礎資料庫
          </button>
        </div>
      </div>
    `;
    cardEl.innerHTML = emptyHtml;
    tableEl.innerHTML = '';
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  if (view === 'card') {
    cardEl.style.display = 'block';
    tableEl.style.display = 'none';
    _renderCards(filteredBanks, cardEl);
  } else {
    cardEl.style.display = 'none';
    tableEl.style.display = 'block';
    _renderTable(filteredBanks, tableEl);
  }

  _renderQuickSummary(filteredBanks);

  if (window.lucide) window.lucide.createIcons();
}

function _filteredBanks() {
  if (_filters.bank) {
    return _banks.filter((b) => b.id === _filters.bank);
  }
  return _banks;
}

/* ============================================
   卡片模式
   ============================================ */
function _renderCards(list, container) {
  container.innerHTML = `
    <div class="grid grid-3" style="gap:10px;">
      ${list.map((b) => {
        const bal = _balances[b.id] || {};
        const prevBal = _prevBalances[b.id] || {};
        const amount = Number(bal.amount) || 0;
        const prevAmount = Number(prevBal.amount) || 0;
        const diff = amount - prevAmount;

        return `
          <div class="glass-card" style="padding:14px;">
            <div style="font-size:14px; font-weight:700; color:var(--neon-cyan); margin-bottom:10px; word-break:break-word;">
              ${escapeHtml(b.name)}
            </div>
            <div style="font-size:11px; color:var(--text-muted); margin-bottom:6px;">本月結餘</div>
            <div class="mono text-emerald" style="font-size:18px; font-weight:700; margin-bottom:10px;">
              ${formatHKD(amount)}
            </div>
            ${prevAmount > 0 ? `
              <div style="font-size:11px; color:var(--text-muted); display:flex; justify-content:space-between;">
                <span>上月：${formatHKD(prevAmount)}</span>
                <span class="${diff >= 0 ? 'text-emerald' : 'text-red'}">
                  ${diff >= 0 ? '+' : ''}${formatHKD(diff)}
                </span>
              </div>
            ` : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/* ============================================
   表格模式
   ============================================ */
function _renderTable(list, container) {
  container.innerHTML = `
    <div class="glass-card collapsible-card collapsible-card-flat" style="padding:0;">
      <div style="overflow-x:auto;">
        <table class="data-table mobile-cards">
          <thead>
            <tr>
              <th>銀行名稱</th>
              <th class="num hide-mobile" style="width:130px;">上月結餘</th>
              <th class="num" style="width:150px;">本月結餘</th>
              <th class="hide-mobile" style="width:150px;">最後更新</th>
            </tr>
          </thead>
          <tbody>
            ${list.map((b) => {
              const bal = _balances[b.id] || {};
              const prevBal = _prevBalances[b.id] || {};
              const amount = Number(bal.amount) || 0;
              const prevAmount = Number(prevBal.amount) || 0;
              const updated = bal.updatedAt
                ? new Date(bal.updatedAt).toLocaleString('zh-HK', {
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit',
                  })
                : '—';

              return `
                <tr>
                  <td data-primary="1">${escapeHtml(b.name)}</td>
                  <td class="num hide-mobile" data-label="上月結餘" style="color:var(--text-muted);">
                    ${formatHKD(prevAmount)}
                  </td>
                  <td class="num text-emerald" data-label="本月結餘">${formatHKD(amount)}</td>
                  <td class="hide-mobile" data-label="最後更新" style="font-size:11px; color:var(--text-muted);">
                    ${escapeHtml(updated)}
                  </td>
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
   全年模式渲染
   ============================================ */
function _renderAnnual(year, monthlyBalances) {
  const container = document.getElementById('annual-monthly-cards');
  if (!container) return;

  const filteredBanks = _filteredBanks();
  let lastTotal = 0;

  const cards = monthlyBalances.map((mb) => {
    const total = filteredBanks.reduce((s, b) => s + (Number(mb.data[b.id]?.amount) || 0), 0);
    if (total > 0) lastTotal = total;

    const rows = filteredBanks.length === 0
      ? '<div style="font-size:12px; color:var(--text-muted);">尚無銀行</div>'
      : filteredBanks.map((b) => {
        const amount = Number(mb.data[b.id]?.amount) || 0;
        return `
          <div class="annual-month-row">
            <span>${escapeHtml(b.name)}</span>
            <span class="mono text-emerald">${formatHKD(amount)}</span>
          </div>
        `;
      }).join('');

    return `
      <div class="annual-month-card">
        <div class="annual-month-header">
          <div class="month-title">${mb.monthNum} 月</div>
          <div class="month-total">${formatHKD(total)}</div>
        </div>
        <div class="annual-month-detail" style="display:none;">
          ${rows}
        </div>
      </div>
    `;
  }).join('');

  const annualTotalEl = document.getElementById('annual-bank-total');
  if (annualTotalEl) annualTotalEl.textContent = formatHKD(lastTotal);

  container.innerHTML = cards;

  container.querySelectorAll('.annual-month-header').forEach((el) => {
    el.addEventListener('click', () => {
      const d = el.nextElementSibling;
      d.style.display = d.style.display === 'none' ? 'block' : 'none';
    });
  });

  _renderQuickSummary(filteredBanks);

  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   快速摘要（資產配置）
   ============================================ */
function _renderQuickSummary(filteredBanks) {
  const root = document.getElementById('quick-summary-root');
  if (!root) return;

  if (filteredBanks.length === 0) {
    root.innerHTML = '';
    return;
  }

  const items = filteredBanks.map((b) => ({
    name: b.name,
    amount: Number(_balances[b.id]?.amount) || 0,
  })).filter((x) => x.amount > 0);

  if (items.length === 0) {
    root.innerHTML = '';
    return;
  }

  renderQuickSummary({
    containerId: 'quick-summary-root',
    type: QUICK_SUMMARY_TYPES.ASSET_PIE,
    title: '銀行資產配置',
    icon: 'pie-chart',
    data: { items },
  });
}

/* ============================================
   銷毀
   ============================================ */
function _destroy() {
  if (_unsubBanks) {
    try { _unsubBanks(); } catch (e) { /* noop */ }
    _unsubBanks = null;
  }
  if (_unsubYM) {
    try { _unsubYM(); } catch (e) { /* noop */ }
    _unsubYM = null;
  }
  if (_viewToggle) {
    try { _viewToggle.destroy(); } catch (e) { /* noop */ }
    _viewToggle = null;
  }
  if (_filterInstance) {
    try { _filterInstance.destroy(); } catch (e) { /* noop */ }
    _filterInstance = null;
  }
}
