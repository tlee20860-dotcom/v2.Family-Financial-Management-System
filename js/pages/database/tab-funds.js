// ============================================
// tab-funds.js — 基礎資料庫：基金 Tab（v101.5）
// 位置：js/pages/database/tab-funds.js
// ============================================
// v101.5 修正：
//   ✅ 新增 / 編輯改用 entity-modal
//   ✅ 刪除使用 entity-helpers 的 deleteEntity
//   ✅ 使用 registerPageCleanup 註冊清理
// ============================================

import { listenFunds } from '../../core/db.js';
import { escapeHtml, formatHKD } from '../../core/utils.js';
import { showToast } from '../../shared/toast.js';
import { openConfirm } from '../../shared/modal.js';
import { openEntityModal } from '../../shared/entity-modal.js';
import { deleteEntity } from '../../shared/entity-helpers.js';
import { ENTITY_KEYS } from '../../config/constants.js';

/* ============================================
   Module 狀態
   ============================================ */
let _funds = [];
let _unsubFunds = null;
let _listClickHandler = null;
let _addBtnHandler = null;

/* ============================================
   主入口
   ============================================ */
export function initFundsTab(containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.warn(`⚠️ initFundsTab: 找不到容器 #${containerId}`);
    return null;
  }

  container.innerHTML = _buildSkeleton();

  _unsubFunds = listenFunds((list) => {
    _funds = list;
    _render();
  });

  _bindListEvents();
  _bindAddButton();

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
    <div class="flex flex-between items-center flex-wrap gap-12 mb-16">
      <div class="text-muted" style="font-size:13px;">管理基金持倉（名稱、成本、現值、單位數）</div>
      <button class="btn btn-primary" id="db-funds-add-btn">
        <i data-lucide="plus"></i> 新增基金
      </button>
    </div>

    <div class="glass-card collapsible-card collapsible-card-flat" id="db-funds-list-card">
      <div class="collapsible-header" id="db-funds-list-header">
        <div class="collapsible-header-title">
          <i data-lucide="line-chart" style="width:16px;height:16px;"></i>
          <span>基金清單 <span class="text-muted" id="db-funds-count" style="font-size:12px; margin-left:6px;"></span></span>
        </div>
        <i data-lucide="chevron-down" class="collapsible-arrow"></i>
      </div>
      <div class="collapsible-body" style="display:block;">
        <div id="db-funds-list"></div>
      </div>
    </div>
  `;
}

/* ============================================
   新增按鈕
   ============================================ */
function _bindAddButton() {
  const btn = document.getElementById('db-funds-add-btn');
  if (!btn) return;

  _addBtnHandler = () => {
    openEntityModal({
      entity: ENTITY_KEYS.FUND,
      mode: 'add',
      allRows: _funds,
    });
  };
  btn.addEventListener('click', _addBtnHandler);
}

/* ============================================
   渲染清單
   ============================================ */
function _render() {
  const listEl = document.getElementById('db-funds-list');
  const countEl = document.getElementById('db-funds-count');
  if (!listEl) return;

  if (countEl) countEl.textContent = `（共 ${_funds.length} 筆）`;

  if (_funds.length === 0) {
    listEl.innerHTML = `<div class="empty-state">尚無基金，請點擊上方「新增基金」</div>`;
    return;
  }

  listEl.innerHTML = `
    <div style="overflow-x:auto;">
      <table class="data-table mobile-cards">
        <thead>
          <tr>
            <th>基金名稱</th>
            <th class="num">投入成本</th>
            <th class="num">現時價值</th>
            <th class="num hide-mobile">盈虧</th>
            <th style="width:180px;">操作</th>
          </tr>
        </thead>
        <tbody>
          ${_funds.map((f) => _renderRow(f)).join('')}
        </tbody>
      </table>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
}

function _renderRow(f) {
  const cost = Number(f.cost) || 0;
  const value = Number(f.currentValue) || 0;
  const pnl = value - cost;
  const pnlCls = pnl >= 0 ? 'text-emerald' : 'text-red';
  const sign = pnl >= 0 ? '+' : '';

  return `
    <tr data-id="${f.id}">
      <td data-primary="1">
        ${escapeHtml(f.name || '（未命名）')}
        ${f.note ? `<div style="font-size:11px; color:var(--text-muted); margin-top:2px;">${escapeHtml(f.note)}</div>` : ''}
      </td>
      <td class="num" data-label="投入成本">${formatHKD(cost)}</td>
      <td class="num text-emerald" data-label="現時價值">${formatHKD(value)}</td>
      <td class="num hide-mobile ${pnlCls}" data-label="盈虧">${sign}${formatHKD(pnl)}</td>
      <td data-label="操作">
        <button class="btn btn-sm btn-ghost" data-action="edit" data-id="${f.id}">編輯</button>
        <button class="btn btn-sm btn-danger" data-action="delete" data-id="${f.id}">刪除</button>
      </td>
    </tr>
  `;
}

/* ============================================
   清單事件
   ============================================ */
function _bindListEvents() {
  const listEl = document.getElementById('db-funds-list');
  if (!listEl) return;

  _listClickHandler = async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const id = btn.dataset.id;
    const action = btn.dataset.action;
    const fund = _funds.find((f) => f.id === id);
    if (!fund) return;

    if (action === 'edit') {
      openEntityModal({
        entity: ENTITY_KEYS.FUND,
        mode: 'edit',
        id: fund.id,
        allRows: _funds,
      });
    } else if (action === 'delete') {
      const ok = await openConfirm(`確定要刪除基金「${fund.name}」嗎？`, {
        title: '刪除基金',
        okText: '刪除',
        okClass: 'btn-danger',
      });
      if (!ok) return;

      try {
        await deleteEntity(ENTITY_KEYS.FUND, fund.id);
        showToast('✅ 已刪除', 'success');
      } catch (err) {
        showToast('刪除失敗：' + err.message, 'error');
      }
    }
  };

  listEl.addEventListener('click', _listClickHandler);
}

/* ============================================
   銷毀
   ============================================ */
function _destroy() {
  if (_unsubFunds) {
    try { _unsubFunds(); } catch (e) { /* noop */ }
    _unsubFunds = null;
  }
  if (_listClickHandler) {
    const listEl = document.getElementById('db-funds-list');
    listEl?.removeEventListener('click', _listClickHandler);
    _listClickHandler = null;
  }
  if (_addBtnHandler) {
    const btn = document.getElementById('db-funds-add-btn');
    btn?.removeEventListener('click', _addBtnHandler);
    _addBtnHandler = null;
  }
}