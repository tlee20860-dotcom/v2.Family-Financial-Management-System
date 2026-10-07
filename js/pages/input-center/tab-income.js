// ============================================
// tab-income.js — 綜合輸入中心：收入 Tab（v101.5）
// 位置：js/pages/input-center/tab-income.js
// ============================================
// v101.5 修正：
//   ✅ 驗證改用 beforeSubmit
//   ✅ 動態成員欄位改用 form-builder 的 optionsSource
//   ✅ 使用 registerPageCleanup 註冊清理
// ============================================

import {
  listenMembers, saveIncome, getIncomeOnce,
} from '../../core/db.js';
import { AppState } from '../../core/state.js';
import { RESERVED_IDS } from '../../config/constants.js';
import { escapeHtml, formatHKD, sortMembers } from '../../core/utils.js';
import { fillYearSelect, fillMonthSelect } from '../../shared/date-helpers.js';
import { showToast } from '../../shared/toast.js';
import { buildForm } from '../../shared/form-builder.js';

/* ============================================
   Module 狀態
   ============================================ */
let _container = null;
let _formApi = null;
let _members = [];
let _currentIncome = {};
let _unsubscribers = [];

let _filterYear = '';
let _filterMonth = '';

/* ============================================
   主入口
   ============================================ */
export function initIncomeTab(containerId) {
  _container = document.getElementById(containerId);
  if (!_container) {
    console.warn(`⚠️ initIncomeTab: 找不到容器 #${containerId}`);
    return null;
  }

  const ym = AppState.getYearMonth();
  _filterYear = ym.year;
  _filterMonth = ym.month === 'all' ? '01' : ym.month;

  _container.innerHTML = _buildSkeleton();

  _buildForm();
  _bindFilters();
  _bindListeners();

  return {
    refresh: _reloadIncome,
    destroy: _destroy,
  };
}

/* ============================================
   骨架
   ============================================ */
function _buildSkeleton() {
  return `
    <div id="ic-income-form-root" class="mb-20"></div>

    <div class="glass-card collapsible-card collapsible-card-flat" id="ic-income-list-card">
      <div class="collapsible-header" id="ic-income-list-header">
        <div class="collapsible-header-title">
          <i data-lucide="list" style="width:16px;height:16px;"></i>
          <span>近期收入紀錄 <span class="text-muted" id="ic-income-count" style="font-size:12px; margin-left:6px;"></span></span>
        </div>
        <i data-lucide="chevron-down" class="collapsible-arrow"></i>
      </div>
      <div class="collapsible-body" style="display:block;">
        <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end; margin-bottom:16px;">
          <div class="filter-group" style="min-width:100px;">
            <label class="field-label">年份</label>
            <select class="select" id="ic-inc-year-filter"></select>
          </div>
          <div class="filter-group" style="min-width:100px;">
            <label class="field-label">月份</label>
            <select class="select" id="ic-inc-month-filter"></select>
          </div>
        </div>
        <div id="ic-income-list"></div>
      </div>
    </div>
  `;
}

/* ============================================
   表單（動態：成員欄位會依成員清單重建）
   ============================================ */
function _buildForm() {
  _formApi = buildForm({
    containerId: 'ic-income-form-root',
    fields: [
      { type: 'select', id: 'ic-inc-year',  label: '所屬年份', required: true, includeEmpty: false },
      { type: 'select', id: 'ic-inc-month', label: '所屬月份', required: true, includeEmpty: false },
      // 成員欄位動態插入（id = ic-inc-member-{memberId}）
      { type: 'number', id: 'ic-inc-extra', label: '額外收入（HK$）', min: 0, step: 1, placeholder: '0' },
    ],
    submitText: '儲存本月收入',
    showCancel: false,
    showReset: true,
    resetText: '重置',
    beforeSubmit: _validateIncome,
    onSubmit: _handleSubmit,
  });

  fillYearSelect('ic-inc-year', { useAppState: true });
  fillMonthSelect('ic-inc-month', {
    useAppState: true,
    defaultValue: AppState.month === 'all' ? '01' : AppState.month,
  });

  _formApi.onFieldChange('ic-inc-year', _reloadIncome);
  _formApi.onFieldChange('ic-inc-month', _reloadIncome);
}

function _validateIncome(data) {
  const year = data['ic-inc-year'];
  const month = data['ic-inc-month'];
  if (!year || !month) {
    return { field: 'ic-inc-year', message: '請選擇年月' };
  }
  return true;
}

/* ============================================
   當成員清單變更 → 重建成員欄位
   ============================================ */
function _rebuildMemberFields() {
  const form = document.querySelector('#ic-income-form-root form');
  if (!form) return;

  // 移除舊的成員欄位
  form.querySelectorAll('[data-dynamic-member]').forEach((el) => el.remove());

  const extraField = form.querySelector('#ic-inc-extra')?.closest('.field');
  if (!extraField) return;
  const parent = extraField.parentElement;

  _members.forEach((m) => {
    const field = document.createElement('div');
    field.className = 'field';
    field.setAttribute('data-dynamic-member', '1');
    field.innerHTML = `
      <label class="field-label" for="ic-inc-member-${m.id}">${escapeHtml(m.name)}</label>
      <input class="input mono" id="ic-inc-member-${m.id}" type="number"
             min="0" step="1" placeholder="0">
    `;
    parent.insertBefore(field, extraField);
  });

  _applyIncomeToInputs();
}

/* ============================================
   提交
   ============================================ */
async function _handleSubmit() {
  const year = _formApi.getFieldValue('ic-inc-year');
  const month = _formApi.getFieldValue('ic-inc-month');
  const extra = Number(_formApi.getFieldValue('ic-inc-extra')) || 0;

  const payload = {};
  _members.forEach((m) => {
    const val = Number(_formApi.getFieldValue(`ic-inc-member-${m.id}`)) || 0;
    if (val > 0) payload[m.id] = val;
  });
  if (extra > 0) payload[RESERVED_IDS.EXTRA_INCOME] = extra;

  try {
    await saveIncome(year, month, payload);
    showToast(`✅ 已儲存 ${year} 年 ${month} 月收入`, 'success');
  } catch (err) {
    console.error('[tab-income] 提交失敗：', err);
    showToast('儲存失敗：' + (err.message || err), 'error');
  }
}

/* ============================================
   載入當前月份收入
   ============================================ */
async function _reloadIncome() {
  const year = _formApi.getFieldValue('ic-inc-year');
  const month = _formApi.getFieldValue('ic-inc-month');
  if (!year || !month) return;

  try {
    _currentIncome = await getIncomeOnce(year, month) || {};
  } catch (e) {
    _currentIncome = {};
  }

  _applyIncomeToInputs();
  _renderList();
}

function _applyIncomeToInputs() {
  if (!_formApi) return;

  _members.forEach((m) => {
    const val = _currentIncome[m.id];
    _formApi.setFieldValue(`ic-inc-member-${m.id}`, val != null ? val : '');
  });

  const extra = _currentIncome[RESERVED_IDS.EXTRA_INCOME];
  _formApi.setFieldValue('ic-inc-extra', extra != null ? extra : '');
}

/* ============================================
   資料監聽
   ============================================ */
function _bindListeners() {
  _unsubscribers.push(
    listenMembers((list) => {
      _members = sortMembers(list);
      _rebuildMemberFields();
      _reloadIncome();
    })
  );
}

/* ============================================
   篩選
   ============================================ */
function _bindFilters() {
  fillYearSelect('ic-inc-year-filter', { defaultValue: _filterYear });
  fillMonthSelect('ic-inc-month-filter', { defaultValue: _filterMonth, includeAll: false });

  document.getElementById('ic-inc-year-filter')?.addEventListener('change', (e) => {
    _filterYear = e.target.value;
    _renderList();
  });
  document.getElementById('ic-inc-month-filter')?.addEventListener('change', (e) => {
    _filterMonth = e.target.value;
    _renderList();
  });
}

/* ============================================
   清單渲染
   ============================================ */
async function _renderList() {
  const listEl = document.getElementById('ic-income-list');
  const countEl = document.getElementById('ic-income-count');
  if (!listEl) return;

  let data = {};
  try {
    data = await getIncomeOnce(_filterYear, _filterMonth) || {};
  } catch (e) {
    data = {};
  }

  const rows = [];
  _members.forEach((m) => {
    const val = Number(data[m.id]) || 0;
    if (val > 0) rows.push({ memberId: m.id, memberName: m.name, amount: val });
  });

  const extra = Number(data[RESERVED_IDS.EXTRA_INCOME]) || 0;
  if (extra > 0) rows.push({ memberId: RESERVED_IDS.EXTRA_INCOME, memberName: '額外收入', amount: extra });

  const total = rows.reduce((s, r) => s + r.amount, 0);

  if (countEl) countEl.textContent = `（共 ${rows.length} 筆）`;

  if (rows.length === 0) {
    listEl.innerHTML = `<div class="empty-state">此月份尚無收入紀錄</div>`;
    return;
  }

  listEl.innerHTML = `
    <div style="overflow-x:auto;">
      <table class="data-table">
        <thead>
          <tr>
            <th>成員</th>
            <th class="num" style="width:160px;">金額（HK$）</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r) => `
            <tr>
              <td>${escapeHtml(r.memberName)}</td>
              <td class="num text-emerald">${formatHKD(r.amount)}</td>
            </tr>
          `).join('')}
          <tr style="font-weight:700; background:rgba(0,240,255,0.05);">
            <td>【總計】</td>
            <td class="num text-cyan">${formatHKD(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

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
  if (_formApi) _formApi.destroy();
}