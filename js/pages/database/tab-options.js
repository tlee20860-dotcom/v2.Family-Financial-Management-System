// ============================================
// tab-options.js — 基礎資料庫：支付 / 狀態 Tab（v101.5）
// 位置：js/pages/database/tab-options.js
// ============================================
// v101.5 修正：
//   ✅ 支付方式 / 狀態 新增 / 編輯改用 entity-modal
//   ✅ 刪除使用 entity-helpers 的 deleteEntity
//   ✅ 事件監聽改用 _container.querySelector + 完整清理
//   ✅ 狀態編輯改用 entity-definitions 的 isDone（boolean 轉換）
// ============================================

import {
  listenPaymentMethods, listenStatuses,
} from '../../core/db.js';
import { escapeHtml } from '../../core/utils.js';
import { showToast } from '../../shared/toast.js';
import { openConfirm } from '../../shared/modal.js';
import { openEntityModal } from '../../shared/entity-modal.js';
import { deleteEntity } from '../../shared/entity-helpers.js';
import { ENTITY_KEYS } from '../../config/constants.js';

/* ============================================
   Module 狀態
   ============================================ */
let _container = null;
let _payments = [];
let _statuses = [];
let _unsubscribers = [];
let _payListHandler = null;
let _statusListHandler = null;
let _payAddHandler = null;
let _statusAddHandler = null;

/* 狀態類別對照 */
const STATUS_CATEGORY_LABELS = {
  personal: '個人支出',
  fixed: '固定支出',
  insurance: '保險',
};

/* ============================================
   主入口
   ============================================ */
export function initOptionsTab(containerId) {
  _container = document.getElementById(containerId);
  if (!_container) {
    console.warn(`⚠️ initOptionsTab: 找不到容器 #${containerId}`);
    return null;
  }

  _container.innerHTML = _buildSkeleton();

  _unsubscribers.push(
    listenPaymentMethods((list) => {
      _payments = list;
      _render();
    })
  );

  _unsubscribers.push(
    listenStatuses((list) => {
      _statuses = list;
      _render();
    })
  );

  _bindEvents();

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
    <div class="grid grid-2" style="gap:16px; align-items:start;">

      <!-- 左：支付方式 -->
      <div>
        <div class="flex flex-between items-center flex-wrap gap-12 mb-12">
          <div class="text-muted" style="font-size:13px;">支付方式</div>
          <button class="btn btn-primary btn-sm" id="db-pay-add-btn">
            <i data-lucide="plus" style="width:14px;height:14px;"></i> 新增支付方式
          </button>
        </div>

        <div class="glass-card collapsible-card collapsible-card-flat" id="db-pays-list-card">
          <div class="collapsible-header" id="db-pays-list-header">
            <div class="collapsible-header-title">
              <i data-lucide="credit-card" style="width:16px;height:16px;"></i>
              <span>支付方式 <span class="text-muted" id="db-pays-count" style="font-size:12px; margin-left:6px;"></span></span>
            </div>
            <i data-lucide="chevron-down" class="collapsible-arrow"></i>
          </div>
          <div class="collapsible-body" style="display:block;">
            <div id="db-pays-list"></div>
          </div>
        </div>
      </div>

      <!-- 右：狀態 -->
      <div>
        <div class="flex flex-between items-center flex-wrap gap-12 mb-12">
          <div class="text-muted" style="font-size:13px;">狀態清單</div>
          <button class="btn btn-primary btn-sm" id="db-status-add-btn">
            <i data-lucide="plus" style="width:14px;height:14px;"></i> 新增狀態
          </button>
        </div>

        <div class="glass-card collapsible-card collapsible-card-flat" id="db-status-list-card">
          <div class="collapsible-header" id="db-status-list-header">
            <div class="collapsible-header-title">
              <i data-lucide="tag" style="width:16px;height:16px;"></i>
              <span>狀態清單 <span class="text-muted" id="db-status-count" style="font-size:12px; margin-left:6px;"></span></span>
            </div>
            <i data-lucide="chevron-down" class="collapsible-arrow"></i>
          </div>
          <div class="collapsible-body" style="display:block;">
            <div id="db-status-list"></div>
          </div>
        </div>
      </div>

    </div>
  `;
}

/* ============================================
   事件綁定
   ============================================ */
function _bindEvents() {
  _payListHandler = async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    const payment = _payments.find((p) => p.id === id);
    if (!payment) return;

    if (action === 'edit') {
      openEntityModal({
        entity: ENTITY_KEYS.PAYMENT,
        mode: 'edit',
        id: payment.id,
        allRows: _payments,
      });
    } else if (action === 'delete') {
      const ok = await openConfirm(
        `確定要刪除支付方式「${payment.name}」嗎？\n\n已使用此支付方式的支出紀錄不會被刪除，但會顯示為「（已刪除）」。`,
        { title: '刪除支付方式', okText: '刪除', okClass: 'btn-danger' }
      );
      if (!ok) return;
      try {
        await deleteEntity(ENTITY_KEYS.PAYMENT, payment.id);
        showToast('✅ 已刪除', 'success');
      } catch (err) {
        showToast('刪除失敗：' + err.message, 'error');
      }
    }
  };
  _container.querySelector('#db-pays-list')?.addEventListener('click', _payListHandler);

  _statusListHandler = async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    const status = _statuses.find((s) => s.id === id);
    if (!status) return;

    if (action === 'edit') {
      openEntityModal({
        entity: ENTITY_KEYS.STATUS,
        mode: 'edit',
        id: status.id,
        allRows: _statuses,
      });
    } else if (action === 'delete') {
      const ok = await openConfirm(
        `確定要刪除狀態「${status.name}」嗎？\n\n已使用此狀態的紀錄不會被刪除，但會顯示原本的狀態文字。`,
        { title: '刪除狀態', okText: '刪除', okClass: 'btn-danger' }
      );
      if (!ok) return;
      try {
        await deleteEntity(ENTITY_KEYS.STATUS, status.id);
        showToast('✅ 已刪除', 'success');
      } catch (err) {
        showToast('刪除失敗：' + err.message, 'error');
      }
    }
  };
  _container.querySelector('#db-status-list')?.addEventListener('click', _statusListHandler);

  _payAddHandler = () => {
    openEntityModal({
      entity: ENTITY_KEYS.PAYMENT,
      mode: 'add',
      allRows: _payments,
    });
  };
  _container.querySelector('#db-pay-add-btn')?.addEventListener('click', _payAddHandler);

  _statusAddHandler = () => {
    openEntityModal({
      entity: ENTITY_KEYS.STATUS,
      mode: 'add',
      allRows: _statuses,
    });
  };
  _container.querySelector('#db-status-add-btn')?.addEventListener('click', _statusAddHandler);
}

/* ============================================
   渲染
   ============================================ */
function _render() {
  _renderPayments();
  _renderStatuses();
}

function _renderPayments() {
  const listEl = _container.querySelector('#db-pays-list');
  const countEl = _container.querySelector('#db-pays-count');
  if (!listEl) return;

  if (countEl) countEl.textContent = `（共 ${_payments.length} 個）`;

  if (_payments.length === 0) {
    listEl.innerHTML = `<div class="empty-state">尚無支付方式</div>`;
    return;
  }

  listEl.innerHTML = `
    <div style="overflow-x:auto;">
      <table class="data-table">
        <thead>
          <tr>
            <th>名稱</th>
            <th class="num" style="width:60px;">排序</th>
            <th style="width:130px;">操作</th>
          </tr>
        </thead>
        <tbody>
          ${_payments.map((p) => `
            <tr data-id="${p.id}">
              <td>${escapeHtml(p.name)}</td>
              <td class="num">${p.order || 0}</td>
              <td>
                <button class="btn btn-sm btn-ghost" data-action="edit" data-id="${p.id}">編輯</button>
                <button class="btn btn-sm btn-danger" data-action="delete" data-id="${p.id}">刪除</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
}

function _renderStatuses() {
  const listEl = _container.querySelector('#db-status-list');
  const countEl = _container.querySelector('#db-status-count');
  if (!listEl) return;

  if (countEl) countEl.textContent = `（共 ${_statuses.length} 個）`;

  if (_statuses.length === 0) {
    listEl.innerHTML = `<div class="empty-state">尚無狀態</div>`;
    return;
  }

  const groups = { personal: [], fixed: [], insurance: [] };
  _statuses.forEach((s) => {
    const cat = s.category || 'personal';
    if (groups[cat]) groups[cat].push(s);
    else groups.personal.push(s);
  });

  listEl.innerHTML = Object.entries(groups)
    .filter(([, list]) => list.length > 0)
    .map(([cat, list]) => `
      <div style="margin-bottom:16px;">
        <div style="font-size:11px; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">
          ${STATUS_CATEGORY_LABELS[cat] || cat}
        </div>
        <div style="overflow-x:auto;">
          <table class="data-table">
            <tbody>
              ${list.map((s) => `
                <tr data-id="${s.id}">
                  <td>
                    ${escapeHtml(s.name)}
                    ${s.isDone ? '<span class="badge badge-success" style="margin-left:6px;">已完成</span>' : ''}
                  </td>
                  <td class="num" style="width:50px; font-size:11px; color:var(--text-muted);">${s.order || 0}</td>
                  <td style="width:130px;">
                    <button class="btn btn-sm btn-ghost" data-action="edit" data-id="${s.id}">編輯</button>
                    <button class="btn btn-sm btn-danger" data-action="delete" data-id="${s.id}">刪除</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `).join('');

  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   銷毀
   ============================================ */
function _destroy() {
  _unsubscribers.forEach((fn) => {
    try { fn(); } catch (e) { /* noop */ }
  });
  _unsubscribers = [];

  if (_payListHandler && _container) {
    _container.querySelector('#db-pays-list')?.removeEventListener('click', _payListHandler);
    _payListHandler = null;
  }
  if (_statusListHandler && _container) {
    _container.querySelector('#db-status-list')?.removeEventListener('click', _statusListHandler);
    _statusListHandler = null;
  }
  if (_payAddHandler && _container) {
    _container.querySelector('#db-pay-add-btn')?.removeEventListener('click', _payAddHandler);
    _payAddHandler = null;
  }
  if (_statusAddHandler && _container) {
    _container.querySelector('#db-status-add-btn')?.removeEventListener('click', _statusAddHandler);
    _statusAddHandler = null;
  }
}