// ============================================
// tab-banks.js — 基礎資料庫：銀行 Tab（v101.5）
// 位置：js/pages/database/tab-banks.js
// ============================================
// v101.5 修正：
//   ✅ 新增 / 編輯改用 entity-modal
//   ✅ 刪除使用 entity-helpers 的 deleteEntity
//   ✅ 使用 registerPageCleanup 註冊清理
// ============================================

import { listenBanks } from '../../core/db.js';
import { escapeHtml } from '../../core/utils.js';
import { showToast } from '../../shared/toast.js';
import { openConfirm } from '../../shared/modal.js';
import { openEntityModal } from '../../shared/entity-modal.js';
import { deleteEntity } from '../../shared/entity-helpers.js';
import { ENTITY_KEYS } from '../../config/constants.js';

/* ============================================
   Module 狀態
   ============================================ */
let _banks = [];
let _unsubBanks = null;
let _listClickHandler = null;
let _addBtnHandler = null;

/* ============================================
   主入口
   ============================================ */
export function initBanksTab(containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.warn(`⚠️ initBanksTab: 找不到容器 #${containerId}`);
    return null;
  }

  container.innerHTML = _buildSkeleton();

  _unsubBanks = listenBanks((list) => {
    _banks = list;
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
      <div class="text-muted" style="font-size:13px;">管理銀行清單（用於銀行結餘輸入）</div>
      <button class="btn btn-primary" id="db-banks-add-btn">
        <i data-lucide="plus"></i> 新增銀行
      </button>
    </div>

    <div class="glass-card collapsible-card collapsible-card-flat" id="db-banks-list-card">
      <div class="collapsible-header" id="db-banks-list-header">
        <div class="collapsible-header-title">
          <i data-lucide="landmark" style="width:16px;height:16px;"></i>
          <span>銀行清單 <span class="text-muted" id="db-banks-count" style="font-size:12px; margin-left:6px;"></span></span>
        </div>
        <i data-lucide="chevron-down" class="collapsible-arrow"></i>
      </div>
      <div class="collapsible-body" style="display:block;">
        <div id="db-banks-list"></div>
      </div>
    </div>
  `;
}

/* ============================================
   新增按鈕
   ============================================ */
function _bindAddButton() {
  const btn = document.getElementById('db-banks-add-btn');
  if (!btn) return;

  _addBtnHandler = () => {
    openEntityModal({
      entity: ENTITY_KEYS.BANK,
      mode: 'add',
      allRows: _banks,
    });
  };
  btn.addEventListener('click', _addBtnHandler);
}

/* ============================================
   渲染清單
   ============================================ */
function _render() {
  const listEl = document.getElementById('db-banks-list');
  const countEl = document.getElementById('db-banks-count');
  if (!listEl) return;

  if (countEl) countEl.textContent = `（共 ${_banks.length} 間）`;

  if (_banks.length === 0) {
    listEl.innerHTML = `<div class="empty-state">尚無銀行，請點擊上方「新增銀行」</div>`;
    return;
  }

  listEl.innerHTML = `
    <div style="overflow-x:auto;">
      <table class="data-table mobile-cards">
        <thead>
          <tr>
            <th style="width:60px;">序號</th>
            <th>銀行名稱</th>
            <th style="width:180px;">操作</th>
          </tr>
        </thead>
        <tbody>
          ${_banks.map((b, i) => _renderRow(b, i)).join('')}
        </tbody>
      </table>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
}

function _renderRow(b, index) {
  return `
    <tr data-id="${b.id}">
      <td data-label="序號" class="mono" style="color:var(--text-muted);">${index + 1}</td>
      <td data-primary="1">${escapeHtml(b.name)}</td>
      <td data-label="操作">
        <button class="btn btn-sm btn-ghost" data-action="edit" data-id="${b.id}">編輯</button>
        <button class="btn btn-sm btn-danger" data-action="delete" data-id="${b.id}">刪除</button>
      </td>
    </tr>
  `;
}

/* ============================================
   清單事件
   ============================================ */
function _bindListEvents() {
  const listEl = document.getElementById('db-banks-list');
  if (!listEl) return;

  _listClickHandler = async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const id = btn.dataset.id;
    const action = btn.dataset.action;
    const bank = _banks.find((b) => b.id === id);
    if (!bank) return;

    if (action === 'edit') {
      openEntityModal({
        entity: ENTITY_KEYS.BANK,
        mode: 'edit',
        id: bank.id,
        allRows: _banks,
      });
    } else if (action === 'delete') {
      const ok = await openConfirm(
        `⚠️ 確定要刪除「${bank.name}」嗎？\n\n這將會一併刪除該銀行在所有月份的結餘紀錄，此操作無法復原。`,
        { title: '刪除銀行', okText: '刪除', okClass: 'btn-danger' }
      );
      if (!ok) return;

      try {
        await deleteEntity(ENTITY_KEYS.BANK, bank.id);
        showToast('✅ 銀行與相關紀錄已徹底刪除', 'success');
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
  if (_unsubBanks) {
    try { _unsubBanks(); } catch (e) { /* noop */ }
    _unsubBanks = null;
  }
  if (_listClickHandler) {
    const listEl = document.getElementById('db-banks-list');
    listEl?.removeEventListener('click', _listClickHandler);
    _listClickHandler = null;
  }
  if (_addBtnHandler) {
    const btn = document.getElementById('db-banks-add-btn');
    btn?.removeEventListener('click', _addBtnHandler);
    _addBtnHandler = null;
  }
}