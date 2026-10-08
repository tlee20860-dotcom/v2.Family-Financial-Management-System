// ============================================
// portfolio.js — 基金投資表（v101.8.0）
// 位置：js/pages/portfolio.js
// ============================================
// v101.8.0 修正：
//   ✅ 依 AppState.canInput 隱藏新增 / 編輯 / 刪除按鈕
//   ✅ 唯讀模式下卡片 / 表格不顯示操作欄
//   ✅ 保留 v101.6.12 表格橫排 + v101.7.0 雙模式
// ============================================

import { listenFunds } from '../core/db.js';
import { escapeHtml, formatHKD, setText } from '../core/utils.js';
import { ENTITY_KEYS } from '../config/constants.js';
import { AppState } from '../core/state.js';
import { initViewToggle } from '../shared/view-toggle.js';
import { renderQuickSummary } from '../shared/quick-summary.js';
import { renderStatsCards } from '../shared/stats-cards.js';
import { openEntityModal } from '../shared/entity-modal.js';
import { deleteEntity } from '../shared/entity-helpers.js';
import { openConfirm } from '../shared/modal.js';
import { showToast } from '../shared/toast.js';
import { createListenerGroup } from '../shared/listener-group.js';
import { QUICK_SUMMARY_TYPES } from '../config/constants.js';
import { registerPageCleanup } from '../core/app.js';

/* ============================================
   Module 狀態
   ============================================ */
let _funds = [];
let _viewToggle = null;
let _statsApi = null;
let _addFundHandler = null;
let _addFirstFundHandler = null;
let _cardClickHandler = null;
let _tableClickHandler = null;

const listenerGroup = createListenerGroup();

/* ============================================
   主入口
   ============================================ */
export async function initPortfolioPage() {
  const userCanInput = AppState.getCanInput();

  _viewToggle = initViewToggle({
    containerId: 'view-toggle-root',
    storageKey: 'portfolio-view',
    defaultView: 'card',
    cardText: '卡片',
    tableText: '表格',
    autoApply: false,
    onChange: () => _render(),
  });

  // 🆕 v101.8.0：依 canInput 決定是否綁定新增按鈕
  if (userCanInput) {
    _addFundHandler = () => {
      openEntityModal({
        entity: ENTITY_KEYS.FUND,
        mode: 'add',
        allRows: _funds,
      });
    };
    document.getElementById('add-fund-btn')?.addEventListener('click', _addFundHandler);

    _addFirstFundHandler = () => {
      openEntityModal({
        entity: ENTITY_KEYS.FUND,
        mode: 'add',
        allRows: _funds,
      });
    };
    document.getElementById('add-first-fund-btn')?.addEventListener('click', _addFirstFundHandler);
  } else {
    // 唯讀：隱藏新增按鈕
    const addBtn = document.getElementById('add-fund-btn');
    if (addBtn) addBtn.style.display = 'none';
    const addFirstBtn = document.getElementById('add-first-fund-btn');
    if (addFirstBtn) addFirstBtn.style.display = 'none';
  }

  listenerGroup.add(
    listenFunds((list) => {
      _funds = list || [];
      _render();
    })
  );

  _bindListActions();

  registerPageCleanup(_destroy);

  return { destroy: _destroy };
}

/* ============================================
   渲染
   ============================================ */
function _render() {
  _renderStats();

  const view = _viewToggle?.getView() || 'card';
  const cardEl = document.getElementById('fund-card-view');
  const tableEl = document.getElementById('fund-table-view');
  const emptyEl = document.getElementById('fund-empty-state');

  if (!cardEl || !tableEl) return;

  if (_funds.length === 0) {
    if (emptyEl) emptyEl.style.display = 'block';
    cardEl.style.display = 'none';
    tableEl.style.display = 'none';
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';

  if (view === 'card') {
    cardEl.style.display = 'block';
    tableEl.style.display = 'none';
    _renderCards(cardEl);
  } else {
    cardEl.style.display = 'none';
    tableEl.style.display = 'block';
    _renderTable(tableEl);
  }

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
  const sign = pnl >= 0 ? '+' : '';

  const cards = [
    {
      title: '總投入成本',
      value: formatHKD(totalCost),
      valueClass: '',
      hint: `共 ${_funds.length} 筆持倉`,
      icon: 'wallet',
    },
    {
      title: '總現時價值',
      value: formatHKD(totalValue),
      valueClass: 'emerald',
      hint: '最新現值加總',
      icon: 'line-chart',
    },
    {
      title: '總帳面盈虧',
      value: `${sign}${formatHKD(pnl)} (${pnlPct}%)`,
      valueClass: pnl >= 0 ? 'emerald' : 'red',
      hint: pnl >= 0 ? '獲利中' : '虧損中',
      icon: pnl >= 0 ? 'trending-up' : 'trending-down',
    },
  ];

  if (_statsApi) { try { _statsApi.destroy(); } catch (e) {} }

  _statsApi = renderStatsCards({
    container: 'portfolio-stats-root',
    cards,
    columns: 3,
  });
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
  const pnlClass = pnl >= 0 ? 'text-emerald' : 'text-red';
  const sign = pnl >= 0 ? '+' : '';

  // 🆕 v101.8.0：依 canInput 決定是否顯示操作按鈕
  const userCanInput = AppState.getCanInput();
  const actionsHtml = userCanInput ? `
    <div class="policy-actions">
      <button type="button" class="btn btn-sm btn-ghost" data-action="edit-fund" data-id="${f.id}">
        <i data-lucide="pencil" style="width:14px;height:14px;"></i> 編輯
      </button>
      <button type="button" class="btn btn-sm btn-danger" data-action="delete-fund" data-id="${f.id}">
        <i data-lucide="trash-2" style="width:14px;height:14px;"></i> 刪除
      </button>
    </div>
  ` : '';

  return `
    <div class="glass-card fund-card" data-id="${f.id}">
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
          <span class="policy-info-value ${pnlClass}">${sign}${formatHKD(pnl)}</span>
        </div>
        <div class="policy-info-item">
          <span class="policy-info-label">報酬率</span>
          <span class="policy-info-value ${pnlClass}">${pnlPct}%</span>
        </div>
        <div class="policy-info-item">
          <span class="policy-info-label">持有單位數</span>
          <span class="policy-info-value">${f.units || '—'}</span>
        </div>
      </div>

      ${f.note ? `<div class="glass-card-hint">📝 ${escapeHtml(f.note)}</div>` : ''}

      ${actionsHtml}
    </div>
  `;
}

/* ============================================
   表格模式
   ============================================ */
function _renderTable(container) {
  // 🆕 v101.8.0：依 canInput 決定是否顯示操作欄
  const userCanInput = AppState.getCanInput();

  const actionsHeader = userCanInput ? `<th style="width:150px;">操作</th>` : '';

  container.innerHTML = `
    <div class="glass-card collapsible-card collapsible-card-flat" style="padding:0;">
      <div class="data-table-scroll-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>基金名稱</th>
              <th class="num">投入成本</th>
              <th class="num">現時價值</th>
              <th class="num">盈虧</th>
              <th class="num">報酬率</th>
              <th class="num">單位數</th>
              ${actionsHeader}
            </tr>
          </thead>
          <tbody>
            ${_funds.map((f) => _renderTableRow(f)).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function _renderTableRow(f) {
  const cost = Number(f.cost) || 0;
  const value = Number(f.currentValue) || 0;
  const pnl = value - cost;
  const pnlPct = cost > 0 ? ((pnl / cost) * 100).toFixed(2) : '0.00';
  const pnlCls = pnl >= 0 ? 'text-emerald' : 'text-red';
  const sign = pnl >= 0 ? '+' : '';

  // 🆕 v101.8.0：依 canInput 決定是否顯示操作按鈕
  const userCanInput = AppState.getCanInput();
  const actionsCell = userCanInput ? `
    <td>
      <button type="button" class="btn btn-sm btn-ghost" data-action="edit-fund" data-id="${f.id}">
        <i data-lucide="pencil" style="width:14px;height:14px;"></i> 編輯
      </button>
      <button type="button" class="btn btn-sm btn-danger" data-action="delete-fund" data-id="${f.id}">
        <i data-lucide="trash-2" style="width:14px;height:14px;"></i> 刪除
      </button>
    </td>
  ` : '';

  return `
    <tr data-id="${f.id}">
      <td>
        ${escapeHtml(f.name || '（未命名）')}
        ${f.note ? `<div style="font-size:11px; color:var(--text-muted); margin-top:2px;">${escapeHtml(f.note)}</div>` : ''}
      </td>
      <td class="num">${formatHKD(cost)}</td>
      <td class="num text-emerald">${formatHKD(value)}</td>
      <td class="num ${pnlCls}">${sign}${formatHKD(pnl)}</td>
      <td class="num ${pnlCls}">${pnlPct}%</td>
      <td class="num">${f.units || '—'}</td>
      ${actionsCell}
    </tr>
  `;
}

/* ============================================
   事件綁定（🆕 v101.8.0：依 canInput 決定是否綁定）
   ============================================ */
function _bindListActions() {
  if (!AppState.getCanInput()) return;   // 🆕 唯讀不綁定

  const cardEl = document.getElementById('fund-card-view');
  const tableEl = document.getElementById('fund-table-view');

  const handler = async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;
    if (!id) return;

    const fund = _funds.find((f) => f.id === id);
    if (!fund) return;

    if (action === 'edit-fund') {
      openEntityModal({
        entity: ENTITY_KEYS.FUND,
        mode: 'edit',
        id: fund.id,
        allRows: _funds,
      });
    } else if (action === 'delete-fund') {
      await _handleDeleteFund(fund);
    }
  };

  // 保存 handler 供 destroy 清理
  _cardClickHandler = handler;
  _tableClickHandler = handler;

  cardEl?.addEventListener('click', handler);
  tableEl?.addEventListener('click', handler);
}

async function _handleDeleteFund(fund) {
  const ok = await openConfirm(`確定要刪除基金「${fund.name}」嗎？`, {
    title: '刪除基金',
    okText: '刪除',
    okClass: 'btn-danger',
  });
  if (!ok) return;

  try {
    await deleteEntity(ENTITY_KEYS.FUND, fund.id);
    showToast('✅ 已刪除基金', 'success');
  } catch (err) {
    console.error('[portfolio] 刪除失敗：', err);
    showToast('刪除失敗：' + err.message, 'error');
  }
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
  listenerGroup.destroy();

  if (_viewToggle) { try { _viewToggle.destroy(); } catch (e) {} _viewToggle = null; }
  if (_statsApi) { try { _statsApi.destroy(); } catch (e) {} _statsApi = null; }

  if (_addFundHandler) {
    document.getElementById('add-fund-btn')?.removeEventListener('click', _addFundHandler);
    _addFundHandler = null;
  }
  if (_addFirstFundHandler) {
    document.getElementById('add-first-fund-btn')?.removeEventListener('click', _addFirstFundHandler);
    _addFirstFundHandler = null;
  }
  if (_cardClickHandler) {
    document.getElementById('fund-card-view')?.removeEventListener('click', _cardClickHandler);
    _cardClickHandler = null;
  }
  if (_tableClickHandler) {
    document.getElementById('fund-table-view')?.removeEventListener('click', _tableClickHandler);
    _tableClickHandler = null;
  }
}