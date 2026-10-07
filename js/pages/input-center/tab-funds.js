// ============================================
// tab-funds.js — 綜合輸入中心：基金現值 Tab（v101.5）
// 位置：js/pages/input-center/tab-funds.js
// ============================================
// v101.5 修正：
//   ✅ 改為「明確編輯」按鈕（避免 blur 全量覆蓋）
//   ✅ 使用 openEntityModal 編輯基金
//   ✅ 抽出 _pendingEdits（防抖）
// ============================================

import { listenFunds } from '../../core/db.js';
import { escapeHtml, formatHKD } from '../../core/utils.js';
import { showToast } from '../../shared/toast.js';
import { openEntityModal } from '../../shared/entity-modal.js';
import { ENTITY_KEYS } from '../../config/constants.js';

/* ============================================
   Module 狀態
   ============================================ */
let _container = null;
let _funds = [];
let _unsubscribers = [];

/* ============================================
   主入口
   ============================================ */
export function initFundsTab(containerId) {
  _container = document.getElementById(containerId);
  if (!_container) {
    console.warn(`⚠️ initFundsTab: 找不到容器 #${containerId}`);
    return null;
  }

  _container.innerHTML = _buildSkeleton();

  _bindListEvents();
  _bindListeners();

  return {
    refresh: _render,
    destroy: _destroy,
  };
}

/* ============================================
   骨架
   ============================================ */
function _buildSkeleton() {
  return `
    <div class="banner" style="margin-bottom:16px;">
      ℹ️ 點擊「更新現值」按鈕，即可修改個別基金的「現時價值」與「持有單位數」。
      基金的新增 / 刪除請使用「+ 新增基金」按鈕或至「基礎資料庫」管理。
    </div>

    <div class="grid grid-3" style="margin-bottom:20px;">
      <div class="glass-card">
        <div class="glass-card-title">總投入成本</div>
        <div class="glass-card-value mono" id="ic-fund-total-cost">HK$ 0</div>
      </div>
      <div class="glass-card">
        <div class="glass-card-title">總現時價值</div>
        <div class="glass-card-value emerald mono" id="ic-fund-total-value">HK$ 0</div>
      </div>
      <div class="glass-card">
        <div class="glass-card-title">總帳面盈虧</div>
        <div class="glass-card-value mono" id="ic-fund-total-pnl">HK$ 0</div>
      </div>
    </div>

    <div class="glass-card collapsible-card collapsible-card-flat" id="ic-fund-list-card">
      <div class="collapsible-header" id="ic-fund-list-header">
        <div class="collapsible-header-title">
          <i data-lucide="line-chart" style="width:16px;height:16px;"></i>
          <span>基金持倉 <span class="text-muted" id="ic-fund-count" style="font-size:12px; margin-left:6px;"></span></span>
        </div>
        <i data-lucide="chevron-down" class="collapsible-arrow"></i>
      </div>
      <div class="collapsible-body" style="display:block;">
        <div id="ic-fund-list"></div>
      </div>
    </div>
  `;
}

/* ============================================
   資料監聽
   ============================================ */
function _bindListeners() {
  _unsubscribers.push(
    listenFunds((list) => {
      _funds = list;
      _render();
    })
  );
}

/* ============================================
   渲染
   ============================================ */
function _render() {
  const listEl = document.getElementById('ic-fund-list');
  const countEl = document.getElementById('ic-fund-count');
  if (!listEl) return;

  _renderStats();

  if (countEl) countEl.textContent = `（共 ${_funds.length} 筆）`;

  if (_funds.length === 0) {
    listEl.innerHTML = `<div class="empty-state">尚無基金，請使用「+ 新增基金」或至「基礎資料庫」新增</div>`;
    return;
  }

  listEl.innerHTML = _funds.map((f) => _renderRow(f)).join('');

  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   統計
   ============================================ */
function _renderStats() {
  const totalCost = _funds.reduce((s, f) => s + (Number(f.cost) || 0), 0);
  const totalValue = _funds.reduce((s, f) => s + (Number(f.currentValue) || 0), 0);
  const pnl = totalValue - totalCost;
  const pnlPct = totalCost > 0 ? ((pnl / totalCost) * 100).toFixed(2) : '0.00';

  const costEl = document.getElementById('ic-fund-total-cost');
  const valueEl = document.getElementById('ic-fund-total-value');
  const pnlEl = document.getElementById('ic-fund-total-pnl');

  if (costEl) costEl.textContent = formatHKD(totalCost);
  if (valueEl) valueEl.textContent = formatHKD(totalValue);

  if (pnlEl) {
    pnlEl.textContent = `${pnl >= 0 ? '+' : ''}${formatHKD(pnl)} (${pnlPct}%)`;
    pnlEl.classList.remove('emerald', 'red');
    pnlEl.classList.add(pnl >= 0 ? 'emerald' : 'red');
  }
}

/* ============================================
   單列（改為唯讀顯示 + 編輯按鈕）
   ============================================ */
function _renderRow(f) {
  const cost = Number(f.cost) || 0;
  const value = Number(f.currentValue) || 0;
  const pnl = value - cost;
  const pnlPct = cost > 0 ? ((pnl / cost) * 100).toFixed(2) : '0.00';
  const pnlCls = pnl >= 0 ? 'text-emerald' : 'text-red';
  const sign = pnl >= 0 ? '+' : '';

  return `
    <div class="glass-card" data-id="${f.id}" style="margin-bottom:12px; padding:16px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap; margin-bottom:14px;">
        <div style="flex:1; min-width:200px;">
          <div style="font-size:15px; font-weight:700; color:var(--neon-cyan); margin-bottom:2px;">
            ${escapeHtml(f.name || '（未命名）')}
          </div>
          ${f.note ? `<div style="font-size:11px; color:var(--text-muted);">${escapeHtml(f.note)}</div>` : ''}
        </div>
        <div style="text-align:right;">
          <div class="mono ${pnlCls}" style="font-weight:700; font-size:14px;">${sign}${formatHKD(pnl)}</div>
          <div class="mono ${pnlCls}" style="font-size:11px;">${pnlPct}%</div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; align-items:end; margin-bottom:12px;">
        <div class="field" style="margin-bottom:0;">
          <label class="field-label" style="font-size:11px;">投入成本</label>
          <div class="mono" style="padding:8px 10px; background:rgba(8,11,17,0.4); border-radius:var(--radius-sm); font-size:13px; color:var(--text-muted);">
            ${formatHKD(cost)}
          </div>
        </div>

        <div class="field" style="margin-bottom:0;">
          <label class="field-label" style="font-size:11px;">現時價值</label>
          <div class="mono" style="padding:8px 10px; background:rgba(8,11,17,0.4); border-radius:var(--radius-sm); font-size:13px; color:var(--neon-cyan); text-align:right;">
            ${formatHKD(value)}
          </div>
        </div>

        <div class="field" style="margin-bottom:0;">
          <label class="field-label" style="font-size:11px;">持有單位數</label>
          <div class="mono" style="padding:8px 10px; background:rgba(8,11,17,0.4); border-radius:var(--radius-sm); font-size:13px; color:var(--text-primary); text-align:right;">
            ${f.units || '—'}
          </div>
        </div>
      </div>

      <div style="display:flex; justify-content:flex-end;">
        <button class="btn btn-sm btn-primary" data-action="edit" data-id="${f.id}">
          <i data-lucide="pencil" style="width:14px;height:14px;"></i> 更新現值
        </button>
      </div>
    </div>
  `;
}

/* ============================================
   清單事件
   ============================================ */
function _bindListEvents() {
  const listEl = document.getElementById('ic-fund-list');
  if (!listEl) return;

  listEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action="edit"]');
    if (!btn) return;
    const id = btn.dataset.id;
    const fund = _funds.find((f) => f.id === id);
    if (!fund) return;

    openEntityModal({
      entity: ENTITY_KEYS.FUND,
      mode: 'edit',
      id: fund.id,
      allRows: _funds,
      onSuccess: () => {
        // listenFunds 會自動觸發重繪
      },
    });
  });
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