// ============================================
// portfolio.js — 基金投資明細（v101 只讀化）
// 位置：js/pages/portfolio.js
// ============================================
// v101 改動：
//   ✅ 移除新增 / 編輯 / 刪除（移至基礎資料庫）
//   ✅ 保留卡片 / 表格雙模式
//   ✅ 加「前往基礎資料庫」按鈕
//   ✅ 底部快速摘要（資產配置）
// ============================================

import { listenFunds } from '../core/db.js';
import { escapeHtml, formatHKD } from '../core/utils.js';
import { initViewToggle } from '../shared/view-toggle.js';
import { renderQuickSummary } from '../shared/quick-summary.js';
import { QUICK_SUMMARY_TYPES } from '../config/constants.js';

/* ============================================
   Module 狀態
   ============================================ */
let _funds = [];
let _viewToggle = null;
let _unsubFunds = null;

/* ============================================
   主入口
   ============================================ */
export async function initPortfolioPage() {
  // 檢視切換
  _viewToggle = initViewToggle({
    containerId: 'view-toggle-root',
    storageKey: 'portfolio-view',
    defaultView: 'card',
    cardText: '卡片',
    tableText: '表格',
    autoApply: false,
    onChange: () => _render(),
  });

  // 前往基礎資料庫
  document.getElementById('go-database-btn')?.addEventListener('click', () => {
    window.location.href = 'database.html';
  });

  // 前往輸入中心（更新現值）
  document.getElementById('go-input-center-btn')?.addEventListener('click', () => {
    window.location.href = 'input-center.html';
  });

  // 監聽基金
  _unsubFunds = listenFunds((list) => {
    _funds = list;
    _render();
  });

  return {
    destroy: _destroy,
  };
}

/* ============================================
   渲染
   ============================================ */
function _render() {
  _renderStats();

  const view = _viewToggle?.getView() || 'card';
  const cardEl = document.getElementById('fund-card-view');
  const tableEl = document.getElementById('fund-table-view');

  if (!cardEl || !tableEl) return;

  if (_funds.length === 0) {
    const emptyHtml = `
      <div class="glass-card">
        <div class="empty-state">
          <i data-lucide="line-chart" style="width:48px;height:48px;opacity:0.4;"></i>
          <p style="margin-top:12px;">尚無基金持倉</p>
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
    _renderCards(cardEl);
  } else {
    cardEl.style.display = 'none';
    tableEl.style.display = 'block';
    _renderTable(tableEl);
  }

  // 快速摘要（資產配置）
  _renderQuickSummary();

  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   統計卡
   ============================================ */
function _renderStats() {
  const totalCost = _funds.reduce((s, f) => s + (Number(f.cost) || 0), 0);
  const totalValue = _funds.reduce((s, f) => s + (Number(f.currentValue) || 0), 0);
  const pnl = totalValue - totalCost;
  const pnlPct = totalCost > 0 ? ((pnl / totalCost) * 100).toFixed(2) : '0.00';

  const costEl = document.getElementById('stat-fund-cost');
  const valueEl = document.getElementById('stat-fund-value');
  const pnlEl = document.getElementById('stat-fund-pnl');

  if (costEl) costEl.textContent = formatHKD(totalCost);
  if (valueEl) valueEl.textContent = formatHKD(totalValue);

  if (pnlEl) {
    pnlEl.textContent = `${pnl >= 0 ? '+' : ''}${formatHKD(pnl)} (${pnlPct}%)`;
    pnlEl.classList.remove('emerald', 'red');
    pnlEl.classList.add(pnl >= 0 ? 'emerald' : 'red');
  }

  const countEl = document.getElementById('fund-count');
  if (countEl) countEl.textContent = `（共 ${_funds.length} 筆）`;
}

/* ============================================
   卡片模式
   ============================================ */
function _renderCards(container) {
  container.innerHTML = `
    <div class="grid grid-3" style="gap:12px;">
      ${_funds.map((f) => _renderCard(f)).join('')}
    </div>
  `;
}

function _renderCard(f) {
  const cost = Number(f.cost) || 0;
  const value = Number(f.currentValue) || 0;
  const pnl = value - cost;
  const pnlPct = cost > 0 ? ((pnl / cost) * 100).toFixed(2) : '0.00';
  const pnlClass = pnl >= 0 ? 'emerald' : 'red';
  const sign = pnl >= 0 ? '+' : '';

  return `
    <div class="glass-card policy-card">
      <div class="policy-header">
        <div style="min-width:0; flex:1;">
          <div class="policy-name" style="word-break:break-word;">${escapeHtml(f.name || '（未命名）')}</div>
          <div class="policy-company">FUND</div>
        </div>
      </div>

      <div class="policy-info-grid">
        <div class="policy-info-item">
          <span class="policy-info-label">投入成本</span>
          <span class="policy-info-value">${formatHKD(cost)}</span>
        </div>
        <div class="policy-info-item">
          <span class="policy-info-label">現時價值</span>
          <span class="policy-info-value text-cyan">${formatHKD(value)}</span>
        </div>
        <div class="policy-info-item">
          <span class="policy-info-label">帳面盈虧</span>
          <span class="policy-info-value text-${pnlClass}">${sign}${formatHKD(pnl)}</span>
        </div>
        <div class="policy-info-item">
          <span class="policy-info-label">報酬率</span>
          <span class="policy-info-value text-${pnlClass}">${pnlPct}%</span>
        </div>
        <div class="policy-info-item">
          <span class="policy-info-label">持有單位數</span>
          <span class="policy-info-value">${f.units || '—'}</span>
        </div>
      </div>

      ${f.note ? `<div class="glass-card-hint">📝 ${escapeHtml(f.note)}</div>` : ''}
    </div>
  `;
}

/* ============================================
   表格模式
   ============================================ */
function _renderTable(container) {
  container.innerHTML = `
    <div class="glass-card collapsible-card collapsible-card-flat" style="padding:0;">
      <div style="overflow-x:auto;">
        <table class="data-table mobile-cards">
          <thead>
            <tr>
              <th>基金名稱</th>
              <th class="num">投入成本</th>
              <th class="num">現時價值</th>
              <th class="num hide-mobile">盈虧</th>
              <th class="num hide-mobile">報酬率</th>
              <th class="num hide-mobile">單位數</th>
            </tr>
          </thead>
          <tbody>
            ${_funds.map((f) => {
              const cost = Number(f.cost) || 0;
              const value = Number(f.currentValue) || 0;
              const pnl = value - cost;
              const pnlPct = cost > 0 ? ((pnl / cost) * 100).toFixed(2) : '0.00';
              const pnlCls = pnl >= 0 ? 'text-emerald' : 'text-red';
              const sign = pnl >= 0 ? '+' : '';

              return `
                <tr>
                  <td data-primary="1">
                    ${escapeHtml(f.name || '（未命名）')}
                    ${f.note ? `<div style="font-size:11px; color:var(--text-muted); margin-top:2px;">${escapeHtml(f.note)}</div>` : ''}
                  </td>
                  <td class="num" data-label="投入成本">${formatHKD(cost)}</td>
                  <td class="num text-emerald" data-label="現時價值">${formatHKD(value)}</td>
                  <td class="num hide-mobile ${pnlCls}" data-label="盈虧">${sign}${formatHKD(pnl)}</td>
                  <td class="num hide-mobile ${pnlCls}" data-label="報酬率">${pnlPct}%</td>
                  <td class="num hide-mobile" data-label="單位數">${f.units || '—'}</td>
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
   快速摘要（資產配置）
   ============================================ */
function _renderQuickSummary() {
  const root = document.getElementById('quick-summary-root');
  if (!root) return;

  const items = _funds
    .map((f) => ({
      name: f.name || '（未命名）',
      amount: Number(f.currentValue) || 0,
    }))
    .filter((x) => x.amount > 0);

  if (items.length === 0) {
    root.innerHTML = '';
    return;
  }

  renderQuickSummary({
    containerId: 'quick-summary-root',
    type: QUICK_SUMMARY_TYPES.ASSET_PIE,
    title: '基金資產配置',
    icon: 'pie-chart',
    data: { items },
  });
}

/* ============================================
   銷毀
   ============================================ */
function _destroy() {
  if (_unsubFunds) {
    try { _unsubFunds(); } catch (e) { /* noop */ }
    _unsubFunds = null;
  }
  if (_viewToggle) {
    try { _viewToggle.destroy(); } catch (e) { /* noop */ }
    _viewToggle = null;
  }
}