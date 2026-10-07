// ============================================
// tab-policies.js — 基礎資料庫：保單 Tab（v101.4）
// 位置：js/pages/database/tab-policies.js
// ============================================
// v101.4 修正：
//   ✅ 新增「保單持有人」欄位（policyHolderId）
//   ✅ 保留「受保人」欄位（memberId）
//   ✅ 列表顯示「持有人 / 受保人」
// ============================================

import {
  listenInsurancePolicies, listenMembers, listenInsuranceCompanies,
  addInsurancePolicy, updateInsurancePolicy, removeInsurancePolicy,
  deleteInsurancePolicyAndData, addInsurancePeriod,
  addInsuranceCompany,
} from '../../core/db.js';
import { getOptions } from '../../config/app-config.js';
import { escapeHtml, formatHKD, sortMembers } from '../../core/utils.js';
import { showToast } from '../../shared/toast.js';
import { openModal, closeModal, openConfirm } from '../../shared/modal.js';
import { buildForm } from '../../shared/form-builder.js';

/* ============================================
   Module 狀態
   ============================================ */
let _container = null;
let _policies = [];
let _members = [];
let _companies = [];
let _formApi = null;
let _modalFormApi = null;
let _editingId = null;
let _unsubscribers = [];

const MODAL_ID = 'db-policy-modal';

/* ============================================
   主入口
   ============================================ */
export function initPoliciesTab(containerId) {
  _container = document.getElementById(containerId);
  if (!_container) {
    console.warn(`⚠️ initPoliciesTab: 找不到容器 #${containerId}`);
    return null;
  }

  _container.innerHTML = _buildSkeleton();

  _renderForm();
  _renderModal();
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
    <div id="db-policies-form-root" class="mb-16"></div>

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
   新增表單
   ============================================ */
function _renderForm() {
  const policyTypes = getOptions('policyTypes');
  const paymentTypes = getOptions('insurancePaymentTypes');
  const currentYear = new Date().getFullYear();

  _formApi = buildForm({
    containerId: 'db-policies-form-root',
    fields: [
      {
        type: 'select', id: 'db-pol-type', label: '保單類型',
        includeEmpty: false, options: policyTypes,
      },
      { type: 'select', id: 'db-pol-member', label: '受保人', required: true, includeEmpty: true, emptyText: '— 請選擇 —' },
      // 🆕 v101.4：保單持有人
      { type: 'select', id: 'db-pol-holder', label: '保單持有人', required: false, includeEmpty: true, emptyText: '— 同受保人 —' },
      { type: 'text',   id: 'db-pol-name',   label: '保單名稱', required: true, placeholder: '例如：危疾+住院', maxlength: 60 },
      {
        type: 'select', id: 'db-pol-company', label: '保險公司',
        includeEmpty: true, emptyText: '— 請選擇 —',
        extraBtn: {
          icon: 'plus', title: '新增保險公司',
          onClick: _handleQuickAddCompany,
        },
      },
      { type: 'number', id: 'db-pol-start-year',  label: '保單開始年份', required: true, min: 2000, max: 2100, placeholder: String(currentYear) },
      { type: 'select', id: 'db-pol-start-month', label: '保單開始月份', required: true, includeEmpty: false },
      { type: 'number', id: 'db-pol-total-years', label: '總供款年期', required: true, min: 1, max: 50, placeholder: '5' },
      { type: 'number', id: 'db-pol-current-period', label: '當前第幾年度', required: true, min: 1, max: 50, placeholder: '1' },
      {
        type: 'select', id: 'db-pol-payment-type', label: '付款類型',
        includeEmpty: false, options: paymentTypes,
      },
      { type: 'text',   id: 'db-pol-account', label: '扣款帳戶（可選）', maxlength: 60 },
      { type: 'number', id: 'db-pol-annual',  label: '當前年度年繳保費（HK$）', required: true, min: 0, step: 1, placeholder: '0' },
    ],
    submitText: '新增保單',
    showCancel: false,
    showReset: true,
    resetText: '重置',
    onSubmit: _handleAdd,
  });

  // 月份選項
  const months = [];
  for (let m = 1; m <= 12; m++) {
    months.push({ value: String(m).padStart(2, '0'), label: `${m} 月` });
  }
  _formApi.updateOptions('db-pol-start-month', months, { includeEmpty: false });

  // 預設值
  _formApi.setFieldValue('db-pol-start-year', currentYear);
  _formApi.setFieldValue('db-pol-start-month', '01');
  _formApi.setFieldValue('db-pol-total-years', 5);
  _formApi.setFieldValue('db-pol-current-period', 1);
}

async function _handleAdd(data) {
  const type = data['db-pol-type'] || 'normal';
  const memberId = data['db-pol-member'];
  const policyHolderId = data['db-pol-holder'] || memberId;   // 🆕 若未選，預設 = 受保人
  const name = (data['db-pol-name'] || '').trim();
  const company = data['db-pol-company'] || '';
  const startYear = Number(data['db-pol-start-year']);
  const startMonth = String(data['db-pol-start-month'] || '01').padStart(2, '0');
  const totalYears = Number(data['db-pol-total-years']);
  const currentPeriod = Number(data['db-pol-current-period']);
  const paymentType = data['db-pol-payment-type'];
  const account = (data['db-pol-account'] || '').trim();
  const annualPremium = Math.round(Number(data['db-pol-annual']) || 0);

  if (!name || !memberId) {
    return { field: 'db-pol-name', message: '請填寫保單名稱並選擇受保人' };
  }

  // 建立 periods 物件
  const periodRange = _getPeriodRange(startYear, startMonth, currentPeriod);
  const periods = {};
  periods[String(currentPeriod)] = {
    periodIndex: currentPeriod,
    startYear: periodRange.startY,
    startMonth: periodRange.startM,
    annualPremium,
    monthlyAverage: Math.round(annualPremium / 12),
  };

  const payload = {
    type,
    memberId,
    policyHolderId,   // 🆕 v101.4
    name,
    company,
    paymentType,
    firstStartYear: startYear,
    firstStartMonth: startMonth,
    totalPolicyYears: totalYears,
    totalPolicyPeriods: totalYears * 12,
    totalPremium: annualPremium * totalYears,
    currentPeriodIndex: currentPeriod,
    account,
    periods,
  };

  try {
    await addInsurancePolicy(payload);
    showToast(`✅ 已新增保單「${name}」`, 'success');
    _formApi.reset();
    _formApi.setFieldValue('db-pol-start-year', new Date().getFullYear());
    _formApi.setFieldValue('db-pol-start-month', '01');
    _formApi.setFieldValue('db-pol-total-years', 5);
    _formApi.setFieldValue('db-pol-current-period', 1);
  } catch (err) {
    showToast('新增失敗：' + err.message, 'error');
  }
}

/* ============================================
   編輯 Modal
   ============================================ */
function _renderModal() {
  const policyTypes = getOptions('policyTypes');
  const paymentTypes = getOptions('insurancePaymentTypes');

  const existing = document.getElementById(MODAL_ID);
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = MODAL_ID;
  overlay.innerHTML = `
    <div class="modal" style="max-width:560px; max-height:90vh; overflow-y:auto;">
      <h2 class="modal-title">編輯保單</h2>
      <div id="db-pol-modal-form-root"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  const months = [];
  for (let m = 1; m <= 12; m++) {
    months.push({ value: String(m).padStart(2, '0'), label: `${m} 月` });
  }

  _modalFormApi = buildForm({
    containerId: 'db-pol-modal-form-root',
    fields: [
      { type: 'hidden', id: 'db-pol-edit-id' },
      { type: 'select', id: 'db-pol-edit-type', label: '保單類型', includeEmpty: false, options: policyTypes },
      { type: 'select', id: 'db-pol-edit-member', label: '受保人', required: true, includeEmpty: true, emptyText: '— 請選擇 —' },
      // 🆕 v101.4：保單持有人
      { type: 'select', id: 'db-pol-edit-holder', label: '保單持有人', required: false, includeEmpty: true, emptyText: '— 同受保人 —' },
      { type: 'text',   id: 'db-pol-edit-name', label: '保單名稱', required: true, maxlength: 60 },
      { type: 'select', id: 'db-pol-edit-company', label: '保險公司', includeEmpty: true, emptyText: '— 請選擇 —' },
      { type: 'number', id: 'db-pol-edit-start-year', label: '保單開始年份', required: true, min: 2000, max: 2100 },
      { type: 'select', id: 'db-pol-edit-start-month', label: '保單開始月份', required: true, includeEmpty: false },
      { type: 'number', id: 'db-pol-edit-total-years', label: '總供款年期', required: true, min: 1, max: 50 },
      { type: 'number', id: 'db-pol-edit-current-period', label: '當前第幾年度', required: true, min: 1, max: 50 },
      { type: 'select', id: 'db-pol-edit-payment-type', label: '付款類型', includeEmpty: false, options: paymentTypes },
      { type: 'text',   id: 'db-pol-edit-account', label: '扣款帳戶（可選）', maxlength: 60 },
      { type: 'number', id: 'db-pol-edit-annual', label: '當前年度年繳保費（HK$）', required: true, min: 0, step: 1 },
    ],
    submitText: '儲存',
    showCancel: true,
    cancelText: '取消',
    onSubmit: _handleEdit,
    onCancel: () => closeModal(MODAL_ID),
  });

  _modalFormApi.updateOptions('db-pol-edit-start-month', months, { includeEmpty: false });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(MODAL_ID);
  });
}

async function _handleEdit(data) {
  const id = data['db-pol-edit-id'];
  if (!id) return;

  const type = data['db-pol-edit-type'] || 'normal';
  const memberId = data['db-pol-edit-member'];
  const policyHolderId = data['db-pol-edit-holder'] || memberId;   // 🆕
  const name = (data['db-pol-edit-name'] || '').trim();
  const company = data['db-pol-edit-company'] || '';
  const startYear = Number(data['db-pol-edit-start-year']);
  const startMonth = String(data['db-pol-edit-start-month'] || '01').padStart(2, '0');
  const totalYears = Number(data['db-pol-edit-total-years']);
  const currentPeriod = Number(data['db-pol-edit-current-period']);
  const paymentType = data['db-pol-edit-payment-type'];
  const account = (data['db-pol-edit-account'] || '').trim();
  const annualPremium = Math.round(Number(data['db-pol-edit-annual']) || 0);

  if (!name || !memberId) {
    return { field: 'db-pol-edit-name', message: '請填寫保單名稱並選擇受保人' };
  }

  const original = _policies.find((p) => p.id === id);
  const periods = { ...(original?.periods || {}) };

  const periodRange = _getPeriodRange(startYear, startMonth, currentPeriod);
  periods[String(currentPeriod)] = {
    periodIndex: currentPeriod,
    startYear: periodRange.startY,
    startMonth: periodRange.startM,
    annualPremium,
    monthlyAverage: Math.round(annualPremium / 12),
  };

  const payload = {
    type,
    memberId,
    policyHolderId,   // 🆕
    name,
    company,
    paymentType,
    firstStartYear: startYear,
    firstStartMonth: startMonth,
    totalPolicyYears: totalYears,
    totalPolicyPeriods: totalYears * 12,
    totalPremium: annualPremium * totalYears,
    currentPeriodIndex: currentPeriod,
    account,
    periods,
  };

  try {
    await updateInsurancePolicy(id, payload);
    showToast('✅ 保單已更新', 'success');
    closeModal(MODAL_ID);
    _editingId = null;
  } catch (err) {
    showToast('更新失敗：' + err.message, 'error');
  }
}

/* ============================================
   資料監聽
   ============================================ */
function _bindListeners() {
  _unsubscribers.push(
    listenMembers((list) => {
      _members = sortMembers(list);
      const options = _members.map((m) => ({ value: m.id, label: m.name }));
      _formApi?.updateOptions('db-pol-member', options, { includeEmpty: true, emptyText: '— 請選擇 —' });
      _formApi?.updateOptions('db-pol-holder', options, { includeEmpty: true, emptyText: '— 同受保人 —' });
      _modalFormApi?.updateOptions('db-pol-edit-member', options, { includeEmpty: true, emptyText: '— 請選擇 —' });
      _modalFormApi?.updateOptions('db-pol-edit-holder', options, { includeEmpty: true, emptyText: '— 同受保人 —' });
      // 成員更新後重繪列表（顯示名稱）
      _render();
    })
  );

  _unsubscribers.push(
    listenInsuranceCompanies((list) => {
      _companies = list;
      const options = _companies.map((c) => ({ value: c.name, label: c.name }));
      _formApi?.updateOptions('db-pol-company', options, { includeEmpty: true, emptyText: '— 請選擇 —' });
      _modalFormApi?.updateOptions('db-pol-edit-company', options, { includeEmpty: true, emptyText: '— 請選擇 —' });
    })
  );

  _unsubscribers.push(
    listenInsurancePolicies((list) => {
      _policies = list;
      _render();
    })
  );
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
    listEl.innerHTML = `<div class="empty-state">尚無保單，請從上方新增</div>`;
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

  listEl.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const id = btn.dataset.id;
    const action = btn.dataset.action;
    const policy = _policies.find((p) => p.id === id);
    if (!policy) return;

    if (action === 'edit') {
      _openEditModal(policy);
    } else if (action === 'delete') {
      const ok = await openConfirm(
        `⚠️ 確定要刪除保單「${policy.name}」嗎？\n\n這將會一併刪除所有相關的扣款紀錄與成員支出，此操作無法復原。`,
        { title: '刪除保單', okText: '刪除', okClass: 'btn-danger' }
      );
      if (!ok) return;

      try {
        await deleteInsurancePolicyAndData(policy.id, policy.memberId);
        showToast('✅ 保單與相關紀錄已徹底刪除', 'success');
      } catch (err) {
        showToast('刪除失敗：' + err.message, 'error');
      }
    }
  });
}

function _openEditModal(policy) {
  _editingId = policy.id;

  if (!_modalFormApi) return;

  const curPeriodData = (policy.periods || {})[String(policy.currentPeriodIndex || 1)];
  const annualPremium = curPeriodData ? curPeriodData.annualPremium : 0;

  _modalFormApi.setData({
    'db-pol-edit-id': policy.id,
    'db-pol-edit-type': policy.type || 'normal',
    'db-pol-edit-member': policy.memberId || '',
    'db-pol-edit-holder': policy.policyHolderId || '',   // 🆕
    'db-pol-edit-name': policy.name || '',
    'db-pol-edit-company': policy.company || '',
    'db-pol-edit-start-year': policy.firstStartYear || new Date().getFullYear(),
    'db-pol-edit-start-month': policy.firstStartMonth || '01',
    'db-pol-edit-total-years': policy.totalPolicyYears || 5,
    'db-pol-edit-current-period': policy.currentPeriodIndex || 1,
    'db-pol-edit-payment-type': policy.paymentType || '年繳',
    'db-pol-edit-account': policy.account || '',
    'db-pol-edit-annual': annualPremium,
  });

  openModal(MODAL_ID);
}

/* ============================================
   快速新增保險公司
   ============================================ */
async function _handleQuickAddCompany() {
  const name = prompt('請輸入新的保險公司名稱：');
  if (!name || !name.trim()) return;

  const trimmed = name.trim();
  if (_companies.some((c) => c.name === trimmed)) {
    showToast('此公司名稱已存在', 'warning');
    return;
  }

  try {
    await addInsuranceCompany(trimmed);
    showToast(`✅ 已新增「${trimmed}」`, 'success');

    setTimeout(() => {
      const current = _formApi?.getFieldValue('db-pol-company');
      if (!current) _formApi?.setFieldValue('db-pol-company', trimmed);
    }, 300);
  } catch (err) {
    showToast('新增失敗：' + err.message, 'error');
  }
}

/* ============================================
   期間範圍工具
   ============================================ */
function _getPeriodRange(firstY, firstM, periodIndex) {
  const startDate = new Date(Number(firstY), Number(firstM) - 1, 1);
  startDate.setMonth(startDate.getMonth() + (periodIndex - 1) * 12);
  return {
    startY: startDate.getFullYear(),
    startM: String(startDate.getMonth() + 1).padStart(2, '0'),
  };
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
  if (_modalFormApi) _modalFormApi.destroy();

  const overlay = document.getElementById(MODAL_ID);
  if (overlay) overlay.remove();
}
