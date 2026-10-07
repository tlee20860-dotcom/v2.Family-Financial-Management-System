// ============================================
// tab-insurance.js — 綜合輸入中心：保險扣款 Tab（v101.4）
// 位置：js/pages/input-center/tab-insurance.js
// ============================================
// v101.4 修正：
//   ✅ 保單下拉顯示「保單名稱（保單持有人）」
//   ✅ 加入 listenMembers 取得真實成員名稱
//   ✅ 使用 policyHolderId（fallback memberId）
// ============================================

import {
  listenInsurancePolicies,
  listenMembers,
  getInsurancePaymentsOnce,
  saveInsurancePaymentBatch,
  removeInsurancePaymentBatch,
} from '../../core/db.js';
import { AppState } from '../../core/state.js';
import { getStatusesByCategory } from '../../config/app-config.js';
import { escapeHtml, formatHKD, sortMembers } from '../../core/utils.js';
import { api } from '../../core/api.js';
import { showToast } from '../../shared/toast.js';
import { buildForm } from '../../shared/form-builder.js';
import { fillStatusSelect } from '../../shared/select-helpers.js';
import { fillYearSelect, fillMonthSelect } from '../../shared/date-helpers.js';

/* ============================================
   Module 狀態
   ============================================ */
let _container = null;
let _formApi = null;
let _policies = [];
let _members = [];
let _payments = {};

let _filterYear = '';
let _filterMonth = '';
let _unsubscribers = [];

/* ============================================
   主入口
   ============================================ */
export function initInsuranceTab(containerId) {
  _container = document.getElementById(containerId);
  if (!_container) {
    console.warn(`⚠️ initInsuranceTab: 找不到容器 #${containerId}`);
    return null;
  }

  const ym = AppState.getYearMonth();
  _filterYear = ym.year;
  _filterMonth = ym.month === 'all' ? '01' : ym.month;

  _container.innerHTML = _buildSkeleton();

  _buildForm();
  _bindFilters();
  _bindListEvents();
  _bindListeners();

  return {
    refresh: _renderList,
    destroy: _destroy,
  };
}

/* ============================================
   骨架
   ============================================ */
function _buildSkeleton() {
  return `
    <div class="banner" style="margin-bottom:16px;">
      ℹ️ 選擇保單與年月後，輸入該月扣款狀態。
      <strong>未扣款</strong>：不建立紀錄；<strong>已扣款</strong>：自動同步至成員支出。
    </div>

    <div id="ic-ins-form-root" class="mb-20"></div>

    <div class="glass-card collapsible-card collapsible-card-flat" id="ic-ins-list-card">
      <div class="collapsible-header" id="ic-ins-list-header">
        <div class="collapsible-header-title">
          <i data-lucide="list" style="width:16px;height:16px;"></i>
          <span>近期扣款紀錄 <span class="text-muted" id="ic-ins-count" style="font-size:12px; margin-left:6px;"></span></span>
        </div>
        <i data-lucide="chevron-down" class="collapsible-arrow"></i>
      </div>
      <div class="collapsible-body" style="display:block;">
        <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end; margin-bottom:16px;">
          <div class="filter-group" style="min-width:100px;">
            <label class="field-label">年份</label>
            <select class="select" id="ic-ins-year-filter"></select>
          </div>
          <div class="filter-group" style="min-width:100px;">
            <label class="field-label">月份</label>
            <select class="select" id="ic-ins-month-filter"></select>
          </div>
        </div>
        <div id="ic-ins-list"></div>
      </div>
    </div>
  `;
}

/* ============================================
   表單
   ============================================ */
function _buildForm() {
  const statusList = getStatusesByCategory('insurance');

  _formApi = buildForm({
    containerId: 'ic-ins-form-root',
    fields: [
      { type: 'select', id: 'ic-ins-policy', label: '保單', required: true, includeEmpty: true, emptyText: '— 請選擇保單 —' },
      { type: 'select', id: 'ic-ins-year',   label: '所屬年份', required: true, includeEmpty: false },
      { type: 'select', id: 'ic-ins-month',  label: '所屬月份', required: true, includeEmpty: false },
      { type: 'select', id: 'ic-ins-status', label: '狀態', includeEmpty: false },
      { type: 'number', id: 'ic-ins-amount', label: '金額（HK$）', required: true, min: 0, step: 1, placeholder: '0' },
      { type: 'hidden', id: 'ic-ins-original-status', value: '' },
    ],
    submitText: '儲存扣款紀錄',
    showCancel: false,
    showReset: false,
    onSubmit: _handleSubmit,
  });

  fillYearSelect('ic-ins-year', { useAppState: true });
  fillMonthSelect('ic-ins-month', {
    useAppState: true,
    defaultValue: AppState.month === 'all' ? '01' : AppState.month,
  });

  fillStatusSelect('ic-ins-status', statusList, { includeEmpty: false });

  _formApi.onFieldChange('ic-ins-policy', _loadCurrentPayment);
  _formApi.onFieldChange('ic-ins-year', _loadCurrentPayment);
  _formApi.onFieldChange('ic-ins-month', _loadCurrentPayment);
}

/* ============================================
   載入當前選中的扣款狀態
   ============================================ */
async function _loadCurrentPayment() {
  const policyId = _formApi.getFieldValue('ic-ins-policy');
  const year = _formApi.getFieldValue('ic-ins-year');
  const month = _formApi.getFieldValue('ic-ins-month');

  if (!policyId || !year || !month) {
    _formApi.setFieldValue('ic-ins-amount', 0);
    return;
  }

  const policy = _policies.find((p) => p.id === policyId);
  if (!policy) return;

  let payments = {};
  try {
    payments = await getInsurancePaymentsOnce(policyId);
  } catch (e) {
    payments = {};
  }

  const existing = payments?.[year]?.[month];

  if (existing) {
    _formApi.setFieldValue('ic-ins-status', existing.status || '已扣款');
    _formApi.setFieldValue('ic-ins-amount', existing.amount || 0);
    _formApi.setFieldValue('ic-ins-original-status', existing.status || '已扣款');
  } else {
    _formApi.setFieldValue('ic-ins-status', '未扣款');
    _formApi.setFieldValue('ic-ins-amount', _getMonthlyAmount(policy, year, month));
    _formApi.setFieldValue('ic-ins-original-status', '');
  }
}

/**
 * 計算保單在該年月的分攤金額
 */
function _getMonthlyAmount(policy, year, month) {
  if (!policy) return 0;
  if (policy.type === 'fund_insurance') {
    return Math.round(Number(policy.monthlyPremium) || 0);
  }

  const y = Number(year);
  const m = Number(month);
  const firstY = Number(policy.firstStartYear) || 0;
  const firstM = Number(policy.firstStartMonth) || 1;
  if (!firstY) return 0;

  const totalMonths = (y - firstY) * 12 + (m - firstM);
  if (totalMonths < 0) return 0;

  const periodIndex = Math.floor(totalMonths / 12) + 1;
  if (policy.totalPolicyYears && periodIndex > policy.totalPolicyYears) return 0;

  const periodData = (policy.periods || {})[String(periodIndex)];
  if (periodData && periodData.monthlyAverage) {
    return Math.round(Number(periodData.monthlyAverage) || 0);
  }

  const periodKeys = Object.keys(policy.periods || {})
    .map(Number)
    .filter((n) => !isNaN(n) && n > 0)
    .sort((a, b) => a - b);

  if (periodKeys.length > 0) {
    const below = periodKeys.filter((k) => k <= periodIndex);
    const target = below.length > 0 ? below[below.length - 1] : periodKeys[0];
    const tp = policy.periods[String(target)];
    if (tp && tp.monthlyAverage) return Math.round(Number(tp.monthlyAverage));
  }

  return Math.round(Number(policy.monthlyAverage) || 0);
}

/* ============================================
   提交
   ============================================ */
async function _handleSubmit(data) {
  const policyId = data['ic-ins-policy'];
  const year = data['ic-ins-year'];
  const month = data['ic-ins-month'];
  const status = data['ic-ins-status'];
  const amount = Math.round(Number(data['ic-ins-amount']) || 0);

  const policy = _policies.find((p) => p.id === policyId);
  if (!policy) {
    return { field: 'ic-ins-policy', message: '請選擇有效的保單' };
  }

  // 🆕 v101.4：用保單持有人作為 memberId（fallback 受保人）
  const effectiveMemberId = policy.policyHolderId || policy.memberId;

  const isDoneStatus = _isDoneInsuranceStatus(status);

  try {
    if (isDoneStatus) {
      await saveInsurancePaymentBatch(policyId, year, month, {
        status,
        amount,
      });
      await api.insuranceSync({
        policyId,
        memberId: effectiveMemberId,
        policyName: policy.name,
        monthlyAverage: amount,
        year,
        month,
      });
      showToast(`✅ 已記錄扣款（${year}-${month}）`, 'success');
    } else {
      await removeInsurancePaymentBatch(policyId, year, month);
      await api.insuranceUnsync({
        policyId,
        memberId: effectiveMemberId,
        year,
        month,
      });
      showToast('✅ 已標記為未扣款', 'success');
    }

    await _loadCurrentPayment();
    _renderList();
  } catch (err) {
    console.error('[tab-insurance] 提交失敗：', err);
    showToast('儲存失敗：' + (err.message || err), 'error');
  }
}

function _isDoneInsuranceStatus(statusName) {
  const statuses = getStatusesByCategory('insurance');
  const s = statuses.find((x) => x.name === statusName);
  if (s) return !!s.isDone;
  return statusName && statusName.startsWith('已');
}

/* ============================================
   資料監聽
   ============================================ */
function _bindListeners() {
  // 成員
  _unsubscribers.push(
    listenMembers((list) => {
      _members = sortMembers(list);
      _refreshPolicySelect();
      _renderList();
    })
  );

  // 保單
  _unsubscribers.push(
    listenInsurancePolicies(async (list) => {
      _policies = list;
      _refreshPolicySelect();
      await _loadAllPayments();
      _renderList();
    })
  );
}

/**
 * 🆕 v101.4：更新保單下拉（顯示「保單名稱（保單持有人）」）
 */
function _refreshPolicySelect() {
  _formApi.updateOptions('ic-ins-policy', _policies.map((p) => {
    const holderName = _memberName(p.policyHolderId || p.memberId);
    return {
      value: p.id,
      label: `${p.name}（${holderName}）`,
    };
  }), { includeEmpty: true, emptyText: '— 請選擇保單 —' });
}

/**
 * 取得成員名稱
 */
function _memberName(memberId) {
  if (!memberId) return '（未指定）';
  const m = _members.find((x) => x.id === memberId);
  return m ? m.name : '（已刪除成員）';
}

async function _loadAllPayments() {
  _payments = {};
  const promises = _policies.map(async (p) => {
    try {
      const data = await getInsurancePaymentsOnce(p.id);
      _payments[p.id] = data || {};
    } catch (e) {
      _payments[p.id] = {};
    }
  });
  await Promise.all(promises);
}

/* ============================================
   篩選
   ============================================ */
function _bindFilters() {
  fillYearSelect('ic-ins-year-filter', { defaultValue: _filterYear });
  fillMonthSelect('ic-ins-month-filter', { defaultValue: _filterMonth, includeAll: false });

  document.getElementById('ic-ins-year-filter')?.addEventListener('change', (e) => {
    _filterYear = e.target.value;
    _renderList();
  });
  document.getElementById('ic-ins-month-filter')?.addEventListener('change', (e) => {
    _filterMonth = e.target.value;
    _renderList();
  });
}

/* ============================================
   清單渲染
   ============================================ */
function _renderList() {
  const listEl = document.getElementById('ic-ins-list');
  const countEl = document.getElementById('ic-ins-count');
  if (!listEl) return;

  const rows = [];
  _policies.forEach((p) => {
    const payment = _payments[p.id]?.[_filterYear]?.[_filterMonth];
    if (payment) {
      rows.push({
        policyId: p.id,
        policyName: p.name,
        memberId: p.policyHolderId || p.memberId,
        memberName: _memberName(p.policyHolderId || p.memberId),
        amount: payment.amount || 0,
        status: payment.status || '已扣款',
        date: payment.date || '',
      });
    }
  });

  if (countEl) countEl.textContent = `（${_filterYear} 年 ${_filterMonth} 月，共 ${rows.length} 筆）`;

  if (rows.length === 0) {
    listEl.innerHTML = `<div class="empty-state">此月份尚無扣款紀錄</div>`;
    return;
  }

  rows.sort((a, b) => (a.policyName || '').localeCompare(b.policyName || ''));

  listEl.innerHTML = rows.map((r) => _renderRow(r)).join('');

  if (window.lucide) window.lucide.createIcons();
}

function _renderRow(r) {
  const statusBadge = _statusBadge(r.status);

  return `
    <div class="data-card" data-policy-id="${r.policyId}" style="margin-bottom:8px; padding:12px 14px;">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
        <div style="flex:1; min-width:0;">
          <div style="font-weight:600; color:var(--text-primary); margin-bottom:2px;">
            ${escapeHtml(r.policyName)}
          </div>
          <div style="font-size:11px; color:var(--text-muted);">
            ${escapeHtml(r.memberName)} · ${r.date ? escapeHtml(r.date) : `${_filterYear}-${_filterMonth}`}
          </div>
        </div>
        <div style="text-align:right;">
          <div class="mono text-emerald" style="font-weight:700;">${formatHKD(r.amount)}</div>
          <div style="margin-top:4px;">${statusBadge}</div>
        </div>
      </div>
    </div>
  `;
}

function _statusBadge(status) {
  const statuses = getStatusesByCategory('insurance');
  const s = statuses.find((x) => x.name === status);
  const isDone = s ? s.isDone : (status && status.startsWith('已'));
  const cls = isDone ? 'badge-success' : 'badge-pending';
  return `<span class="badge ${cls}">${escapeHtml(status || '未扣款')}</span>`;
}

/* ============================================
   清單事件
   ============================================ */
function _bindListEvents() {
  // 未來擴充
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
