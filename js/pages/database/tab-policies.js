// ============================================
// tab-policies.js — 基礎資料庫：保單 Tab（v101.5）
// 位置：js/pages/database/tab-policies.js
// ============================================
// v101.5 修正：
//   ✅ 新增 / 編輯改用 entity-modal（保單欄位由 SSOT 提供）
//   ✅ 刪除使用 entity-helpers 的 deleteEntity
//   ✅ 保單持有人 / 受保人顯示保留
//   ✅ 使用 registerPageCleanup 註冊清理
// ============================================

import {
  listenInsurancePolicies, listenMembers, listenInsuranceCompanies,
} from '../../core/db.js';
import { escapeHtml, sortMembers } from '../../core/utils.js';
import { showToast } from '../../shared/toast.js';
import { openConfirm } from '../../shared/modal.js';
import { openEntityModal } from '../../shared/entity-modal.js';
import { deleteEntity } from '../../shared/entity-helpers.js';
import { ENTITY_KEYS } from '../../config/constants.js';

/* ============================================
   Module 狀態
   ============================================ */
let _policies = [];
let _members = [];
let _companies = [];
let _unsubscribers = [];
let _listClickHandler = null;
let _addBtnHandler = null;

/* ============================================
   主入口
   ============================================ */
export function initPoliciesTab(containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.warn(`⚠️ initPoliciesTab: 找不到容器 #${containerId}`);
    return null;
  }

  container.innerHTML = _buildSkeleton();

  _unsubscribers.push(
    listenMembers((list) => {
      _members = sortMembers(list);
      _render();
    })
  );

  _unsubscribers.push(
    listenInsuranceCompanies((list) => {
      _companies = list;
    })
  );

  _unsubscribers.push(
    listenInsurancePolicies((list) => {
      _policies = list;
      _render();
    })
  );

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
      <div class="text-muted" style="font-size:13px;">管理保單（保單持有人、受保人、供款年期、保費）</div>
      <button class="btn btn-primary" id="db-policies-add-btn">
        <i data-lucide="plus"></i> 新增保單
      </button>
    </div>

    <div class="glass-card collapsible-card collapsible-card-flat" id="db-policies-list-card">
      <div class="collapsible-header" id="db-policies-list-header">
        <div class="collapsible-header-title">
          <i data-lucide="shield" style="width:16px;height:16px;"></i>
          <span>保單清單 <span class="text-muted" id="db-policies-count" style="font-size:12px; margin-left:6px;"></span></span>
        </div>
        <i data-lucide="chevron-down" class="collapsible-arrow"></i>
      </div>
      <div class="collapsible-body" style="display:block;">
        <div id="db-policies-list"></div>
      </div>
    </div>
  `;
}

/* ============================================
   新增按鈕
   ============================================ */
function _bindAddButton() {
  const btn = document.getElementById('db-policies-add-btn');
  if (!btn) return;

  _addBtnHandler = () => {
    openEntityModal({
      entity: ENTITY_KEYS.POLICY,
      mode: 'add',
      allRows: _policies,
    });
  };
  btn.addEventListener('click', _addBtnHandler);
}

/* ============================================
   渲染清單
   ============================================ */
function _render() {
  const listEl = document.getElementById('db-policies-list');
  const countEl = document.getElementById('db-policies-count');
  if (!listEl) return;

  if (countEl) countEl.textContent = `（共 ${_policies.length} 張）`;

  if (_policies.length === 0) {
    listEl.innerHTML = `<div class="empty-state">尚無保單，請點擊上方「新增保單」</div>`;
    return;
  }

  listEl.innerHTML = `
    <div style="overflow-x:auto;">
      <table class="data-table mobile-cards">
        <thead>
          <tr>
            <th>保單名稱</th>
            <th class="hide-mobile">保單持有人</th>
            <th class="hide-mobile">受保人</th>
            <th class="hide-mobile">公司</th>
            <th class="num">年期</th>
            <th style="width:180px;">操作</th>
          </tr>
        </thead>
        <tbody>
          ${_policies.map((p) => _renderRow(p)).join('')}
        </tbody>
      </table>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
}

function _renderRow(p) {
  const holder = _members.find((m) => m.id === (p.policyHolderId || p.memberId));
  const holderName = holder ? holder.name : '（未指定）';
  const insured = _members.find((m) => m.id === p.memberId);
  const insuredName = insured ? insured.name : '（未指定）';
  const totalYears = Number(p.totalPolicyYears) || 0;
  const currentPeriod = Number(p.currentPeriodIndex) || 1;

  return `
    <tr data-id="${p.id}">
      <td data-primary="1">
        ${escapeHtml(p.name || '（未命名）')}
        ${p.type === 'fund_insurance' ? '<span class="badge badge-info" style="margin-left:6px;">基金</span>' : ''}
      </td>
      <td class="hide-mobile" data-label="保單持有人">${escapeHtml(holderName)}</td>
      <td class="hide-mobile" data-label="受保人">${escapeHtml(insuredName)}</td>
      <td class="hide-mobile" data-label="公司" style="font-size:11px; color:var(--text-muted);">
        ${escapeHtml(p.company || '—')}
      </td>
      <td class="num" data-label="年期" style="font-size:12px;">
        ${currentPeriod} / ${totalYears} 年
      </td>
      <td data-label="操作">
        <button class="btn btn-sm btn-ghost" data-action="edit" data-id="${p.id}">編輯</button>
        <button class="btn btn-sm btn-danger" data-action="delete" data-id="${p.id}">刪除</button>
      </td>
    </tr>
  `;
}

/* ============================================
   清單事件
   ============================================ */
function _bindListEvents() {
  const listEl = document.getElementById('db-policies-list');
  if (!listEl) return;

  _listClickHandler = async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const id = btn.dataset.id;
    const action = btn.dataset.action;
    const policy = _policies.find((p) => p.id === id);
    if (!policy) return;

    if (action === 'edit') {
      openEntityModal({
        entity: ENTITY_KEYS.POLICY,
        mode: 'edit',
        id: policy.id,
        allRows: _policies,
      });
    } else if (action === 'delete') {
      const ok = await openConfirm(
        `⚠️ 確定要刪除保單「${policy.name}」嗎？\n\n這將會一併刪除所有相關的扣款紀錄與成員支出，此操作無法復原。`,
        { title: '刪除保單', okText: '刪除', okClass: 'btn-danger' }
      );
      if (!ok) return;

      try {
        await deleteEntity(ENTITY_KEYS.POLICY, policy.id, policy.memberId);
        showToast('✅ 保單與相關紀錄已徹底刪除', 'success');
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
  _unsubscribers.forEach((fn) => {
    try { fn(); } catch (e) { /* noop */ }
  });
  _unsubscribers = [];

  if (_listClickHandler) {
    const listEl = document.getElementById('db-policies-list');
    listEl?.removeEventListener('click', _listClickHandler);
    _listClickHandler = null;
  }
  if (_addBtnHandler) {
    const btn = document.getElementById('db-policies-add-btn');
    btn?.removeEventListener('click', _addBtnHandler);
    _addBtnHandler = null;
  }
}