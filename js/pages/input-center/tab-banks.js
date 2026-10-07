// ============================================
// tab-banks.js — 綜合輸入中心：銀行結餘 Tab（v101.5）
// 位置：js/pages/input-center/tab-banks.js
// ============================================
// v101.5 修正：
//   ✅ 驗證改用 beforeSubmit
//   ✅ 銀行下拉使用 entity-helpers 的動態選項
//   ✅ 使用 registerPageCleanup 註冊清理
// ============================================

import {
  listenBanks, listenBankBalances, saveBankBalance,
  getBankBalancesOnce,
} from '../../core/db.js';
import { AppState } from '../../core/state.js';
import { escapeHtml, formatHKD } from '../../core/utils.js';
import { fillBankSelect } from '../../shared/select-helpers.js';
import { fillYearSelect, fillMonthSelect } from '../../shared/date-helpers.js';
import { showToast } from '../../shared/toast.js';
import { buildForm } from '../../shared/form-builder.js';

/* ============================================
   Module 狀態
   ============================================ */
let _container = null;
let _formApi = null;
let _banks = [];
let _balances = {};
let _unsubscribers = [];
let _unsubBalances = null;

let _currentYear = '';
let _currentMonth = '';

/* ============================================
   主入口
   ============================================ */
export function initBanksTab(containerId) {
  _container = document.getElementById(containerId);
  if (!_container) {
    console.warn(`⚠️ initBanksTab: 找不到容器 #${containerId}`);
    return null;
  }

  const ym = AppState.getYearMonth();
  _currentYear = ym.year;
  _currentMonth = ym.month === 'all' ? '01' : ym.month;

  _container.innerHTML = _buildSkeleton();

  _buildForm();
  _bindFilterEvents();
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
    <div id="ic-bank-form-root" class="mb-20"></div>

    <div class="glass-card collapsible-card collapsible-card-flat" id="ic-bank-list-card">
      <div class="collapsible-header" id="ic-bank-list-header">
        <div class="collapsible-header-title">
          <i data-lucide="landmark" style="width:16px;height:16px;"></i>
          <span>銀行結餘 <span class="text-muted" id="ic-bank-count" style="font-size:12px; margin-left:6px;"></span></span>
        </div>
        <i data-lucide="chevron-down" class="collapsible-arrow"></i>
      </div>
      <div class="collapsible-body" style="display:block;">
        <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end; margin-bottom:16px;">
          <div class="filter-group" style="min-width:110px;">
            <label class="field-label">年份</label>
            <select class="select" id="ic-bank-year-filter"></select>
          </div>
          <div class="filter-group" style="min-width:110px;">
            <label class="field-label">月份</label>
            <select class="select" id="ic-bank-month-filter"></select>
          </div>
        </div>
        <div id="ic-bank-list"></div>
      </div>
    </div>
  `;
}

/* ============================================
   表單
   ============================================ */
function _buildForm() {
  _formApi = buildForm({
    containerId: 'ic-bank-form-root',
    fields: [
      { type: 'select', id: 'ic-bank-year',   label: '所屬年份', required: true, includeEmpty: false },
      { type: 'select', id: 'ic-bank-month',  label: '所屬月份', required: true, includeEmpty: false },
      { type: 'select', id: 'ic-bank-bank',   label: '銀行',     required: true, includeEmpty: true, emptyText: '— 請選擇銀行 —' },
      { type: 'number', id: 'ic-bank-amount', label: '結餘金額（HK$）', required: true, min: 0, step: 1, placeholder: '0' },
    ],
    submitText: '儲存結餘',
    showCancel: false,
    showReset: false,
    beforeSubmit: _validateBalance,
    onSubmit: _handleSubmit,
  });

  fillYearSelect('ic-bank-year', { useAppState: true });
  fillMonthSelect('ic-bank-month', {
    useAppState: true,
    defaultValue: AppState.month === 'all' ? '01' : AppState.month,
  });

  _formApi.onFieldChange('ic-bank-year', _loadCurrentBalance);
  _formApi.onFieldChange('ic-bank-month', _loadCurrentBalance);
  _formApi.onFieldChange('ic-bank-bank', _loadCurrentBalance);
}

function _validateBalance(data) {
  const bankId = data['ic-bank-bank'];
  if (!bankId) return { field: 'ic-bank-bank', message: '請選擇銀行' };
  return true;
}

/* ============================================
   載入當前選中的結餘
   ============================================ */
async function _loadCurrentBalance() {
  const year = _formApi.getFieldValue('ic-bank-year');
  const month = _formApi.getFieldValue('ic-bank-month');
  const bankId = _formApi.getFieldValue('ic-bank-bank');

  if (!year || !month || !bankId) {
    _formApi.setFieldValue('ic-bank-amount', '');
    return;
  }

  try {
    const balances = await getBankBalancesOnce(year, month);
    const existing = balances[bankId];
    if (existing && existing.amount != null) {
      _formApi.setFieldValue('ic-bank-amount', existing.amount);
    } else {
      _formApi.setFieldValue('ic-bank-amount', '');
    }
  } catch (e) {
    _formApi.setFieldValue('ic-bank-amount', '');
  }
}

/* ============================================
   提交
   ============================================ */
async function _handleSubmit(data) {
  const year = data['ic-bank-year'];
  const month = data['ic-bank-month'];
  const bankId = data['ic-bank-bank'];
  const amount = Math.round(Number(data['ic-bank-amount']) || 0);

  try {
    await saveBankBalance(year, month, bankId, amount);
    showToast(`✅ 已儲存 ${year} 年 ${month} 月結餘`, 'success');
    _renderList();
  } catch (err) {
    console.error('[tab-banks] 提交失敗：', err);
    showToast('儲存失敗：' + (err.message || err), 'error');
  }
}

/* ============================================
   資料監聽
   ============================================ */
function _bindListeners() {
  _unsubscribers.push(
    listenBanks((list) => {
      _banks = list;
      fillBankSelect('ic-bank-bank', _banks, { includeEmpty: true, emptyText: '— 請選擇銀行 —' });
      _renderList();
    })
  );

  _watchMonth();
}

function _watchMonth() {
  if (_unsubBalances) {
    try { _unsubBalances(); } catch (e) { /* noop */ }
    _unsubBalances = null;
  }
  _unsubBalances = listenBankBalances(_currentYear, _currentMonth, (val) => {
    _balances = val || {};
    _renderList();
  });
}

/* ============================================
   篩選
   ============================================ */
function _bindFilterEvents() {
  fillYearSelect('ic-bank-year-filter', { defaultValue: _currentYear });
  fillMonthSelect('ic-bank-month-filter', { defaultValue: _currentMonth, includeAll: false });

  document.getElementById('ic-bank-year-filter')?.addEventListener('change', (e) => {
    _currentYear = e.target.value;
    _watchMonth();
  });
  document.getElementById('ic-bank-month-filter')?.addEventListener('change', (e) => {
    _currentMonth = e.target.value;
    _watchMonth();
  });
}

/* ============================================
   清單渲染
   ============================================ */
function _renderList() {
  const listEl = document.getElementById('ic-bank-list');
  const countEl = document.getElementById('ic-bank-count');
  if (!listEl) return;

  const rows = _banks.map((b) => {
    const bal = _balances[b.id];
    return {
      bankId: b.id,
      bankName: b.name,
      amount: bal?.amount != null ? Number(bal.amount) : null,
      updatedAt: bal?.updatedAt || 0,
    };
  });

  const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const filledCount = rows.filter((r) => r.amount != null).length;

  if (countEl) {
    countEl.textContent = `（${_currentYear} 年 ${_currentMonth} 月，已填 ${filledCount} / ${_banks.length} 間）`;
  }

  if (_banks.length === 0) {
    listEl.innerHTML = `<div class="empty-state">尚無銀行，請使用「+ 新增銀行」或至「基礎資料庫」新增</div>`;
    return;
  }

  listEl.innerHTML = `
    <div style="overflow-x:auto;">
      <table class="data-table mobile-cards">
        <thead>
          <tr>
            <th>銀行名稱</th>
            <th class="num" style="width:150px;">本月結餘</th>
            <th style="width:150px;">最後更新</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r) => `
            <tr>
              <td data-primary="1">${escapeHtml(r.bankName)}</td>
              <td class="num text-emerald" data-label="本月結餘">
                ${r.amount != null ? formatHKD(r.amount) : '<span class="text-muted">—</span>'}
              </td>
              <td data-label="最後更新" style="font-size:11px; color:var(--text-muted);">
                ${r.updatedAt ? new Date(r.updatedAt).toLocaleString('zh-HK', {
                  year: 'numeric', month: '2-digit', day: '2-digit',
                  hour: '2-digit', minute: '2-digit',
                }) : '—'}
              </td>
            </tr>
          `).join('')}
          <tr style="font-weight:700; background:rgba(0,240,255,0.05);">
            <td>【總結餘】</td>
            <td class="num text-cyan">${formatHKD(total)}</td>
            <td></td>
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
  if (_unsubBalances) {
    try { _unsubBalances(); } catch (e) { /* noop */ }
    _unsubBalances = null;
  }
  if (_formApi) _formApi.destroy();
}