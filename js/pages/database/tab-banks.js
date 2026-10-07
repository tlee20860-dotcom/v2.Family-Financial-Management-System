// ============================================
// tab-banks.js — 基礎資料庫：銀行 Tab（v101）
// 位置：js/pages/database/tab-banks.js
// ============================================
// 功能：銀行的新增 / 編輯 / 刪除 / 排序
// ============================================

import {
  listenBanks, addBank, removeBank, deleteBankAndBalances,
} from '../../core/db.js';
import { escapeHtml } from '../../core/utils.js';
import { showToast } from '../../shared/toast.js';
import { openConfirm } from '../../shared/modal.js';
import { buildForm } from '../../shared/form-builder.js';

/* ============================================
   Module 狀態
   ============================================ */
let _container = null;
let _banks = [];
let _formApi = null;
let _unsubscribers = [];

/* ============================================
   主入口
   ============================================ */
export function initBanksTab(containerId) {
  _container = document.getElementById(containerId);
  if (!_container) {
    console.warn(`⚠️ initBanksTab: 找不到容器 #${containerId}`);
    return null;
  }

  _container.innerHTML = _buildSkeleton();

  _renderForm();
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
    <div id="db-banks-form-root" class="mb-16"></div>

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
   新增表單
   ============================================ */
function _renderForm() {
  _formApi = buildForm({
    containerId: 'db-banks-form-root',
    fields: [
      { type: 'text', id: 'db-bank-name', label: '銀行名稱', required: true, placeholder: '例如：中銀、匯豐', maxlength: 20 },
    ],
    submitText: '新增銀行',
    showCancel: false,
    showReset: true,
    resetText: '重置',
    onSubmit: _handleAdd,
  });
}

async function _handleAdd(data) {
  const name = (data['db-bank-name'] || '').trim();
  if (!name) {
    return { field: 'db-bank-name', message: '請填寫銀行名稱' };
  }

  // 檢查重複
  if (_banks.some((b) => b.name === name)) {
    return { field: 'db-bank-name', message: '此銀行名稱已存在' };
  }

  try {
    await addBank(name);
    showToast(`✅ 已新增銀行「${name}」`, 'success');
    _formApi.reset();
  } catch (err) {
    showToast('新增失敗：' + err.message, 'error');
  }
}

/* ============================================
   資料監聽
   ============================================ */
function _bindListeners() {
  _unsubscribers.push(
    listenBanks((list) => {
      _banks = list;
      _render();
    })
  );
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
    listEl.innerHTML = `<div class="empty-state">尚無銀行，請從上方新增</div>`;
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

  listEl.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const id = btn.dataset.id;
    const action = btn.dataset.action;
    const bank = _banks.find((b) => b.id === id);
    if (!bank) return;

    if (action === 'delete') {
      const ok = await openConfirm(
        `⚠️ 確定要刪除「${bank.name}」嗎？\n\n這將會一併刪除該銀行在所有月份的結餘紀錄，此操作無法復原。`,
        { title: '刪除銀行', okText: '刪除', okClass: 'btn-danger' }
      );
      if (!ok) return;

      try {
        await deleteBankAndBalances(bank.id);
        showToast('✅ 銀行與相關紀錄已徹底刪除', 'success');
      } catch (err) {
        showToast('刪除失敗：' + err.message, 'error');
      }
    }
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
  if (_formApi) _formApi.destroy();
}