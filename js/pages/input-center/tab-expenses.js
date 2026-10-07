// ============================================
// tab-expenses.js — 綜合輸入中心：日常支出 Tab（v101）
// 位置：js/pages/input-center/tab-expenses.js
// ============================================

import {
  listenMembers, listenCategories, listenItems, listenPaymentMethods,
  listenAllExpenses, addExpense, updateExpense, removeExpense,
  addFixedTemplate,
} from '../../core/db.js';
import { AppState } from '../../core/state.js';
import {
  getOptions, getStatusesByCategory, getDefaultStatus,
} from '../../config/app-config.js';
import {
  escapeHtml, formatHKD, todayISO,
} from '../../core/utils.js';
import { buildForm } from '../../shared/form-builder.js';
import {
  fillMemberSelect, fillCategorySelect, fillItemSelect,
  fillPaymentSelect, fillStatusSelect,
} from '../../shared/select-helpers.js';
import { fillYearSelect, fillMonthSelect } from '../../shared/date-helpers.js';
import { showToast } from '../../shared/toast.js';
import { openConfirm } from '../../shared/modal.js';

/* ============================================
   Module 狀態
   ============================================ */
let _container = null;
let _formApi = null;
let _members = [];
let _categories = [];
let _items = [];
let _payments = [];
let _allExpenses = [];
let _unsubscribers = [];

let _filterYear = '';
let _filterMonth = '';
let _filterMember = '';

/* ============================================
   主入口
   ============================================ */
export function initExpensesTab(containerId) {
  _container = document.getElementById(containerId);
  if (!_container) {
    console.warn(`⚠️ initExpensesTab: 找不到容器 #${containerId}`);
    return null;
  }

  // 初始化篩選值
  const ym = AppState.getYearMonth();
  _filterYear = ym.year;
  _filterMonth = ym.month === 'all' ? '01' : ym.month;

  // 渲染頁面骨架
  _container.innerHTML = _buildSkeleton();

  // 建立表單
  _buildForm();

  // 綁定資料監聽
  _bindListeners();

  // 綁定篩選事件
  _bindFilterEvents();

  // 綁定清單事件
  _bindListEvents();

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
    <div id="ic-expenses-form-root" class="mb-20"></div>

    <div class="glass-card collapsible-card collapsible-card-flat" id="ic-expenses-list-card">
      <div class="collapsible-header" id="ic-expenses-list-header">
        <div class="collapsible-header-title">
          <i data-lucide="list" style="width:16px;height:16px;"></i>
          <span>最近輸入 <span class="text-muted" id="ic-expenses-count" style="font-size:12px; margin-left:6px;"></span></span>
        </div>
        <i data-lucide="chevron-down" class="collapsible-arrow"></i>
      </div>
      <div class="collapsible-body" style="display:block;">
        <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end; margin-bottom:16px;">
          <div class="filter-group" style="min-width:100px;">
            <label class="field-label">年份</label>
            <select class="select" id="ic-exp-year-filter"></select>
          </div>
          <div class="filter-group" style="min-width:100px;">
            <label class="field-label">月份</label>
            <select class="select" id="ic-exp-month-filter"></select>
          </div>
          <div class="filter-group" style="min-width:100px;">
            <label class="field-label">成員</label>
            <select class="select" id="ic-exp-member-filter">
              <option value="">全部</option>
            </select>
          </div>
        </div>
        <div id="ic-expenses-list"></div>
      </div>
    </div>
  `;
}

/* ============================================
   表單
   ============================================ */
function _buildForm() {
  const statusList = getStatusesByCategory('personal');

  _formApi = buildForm({
    containerId: 'ic-expenses-form-root',
    fields: [
      { type: 'select', id: 'ic-exp-year',     label: '所屬年份', required: true, includeEmpty: false },
      { type: 'select', id: 'ic-exp-month',    label: '所屬月份', required: true, includeEmpty: false },
      { type: 'select', id: 'ic-exp-member',   label: '支出成員', required: true, includeEmpty: true, emptyText: '— 請選擇 —' },
      { type: 'text',   id: 'ic-exp-date',     label: '支出日期', placeholder: 'YYYY-MM-DD', maxlength: 10 },
      { type: 'select', id: 'ic-exp-category', label: '支出類別', required: true, includeEmpty: true, emptyText: '— 請選擇類別 —' },
      { type: 'select', id: 'ic-exp-item',     label: '項目',     required: true, includeEmpty: true, emptyText: '— 請先選擇類別 —',
        extraBtn: {
          icon: 'plus', title: '新增項目',
          onClick: _handleQuickAddItem,
        },
      },
      { type: 'number', id: 'ic-exp-amount',   label: '費用（HK$）', required: true, min: 0, step: 1, placeholder: '0' },
      { type: 'select', id: 'ic-exp-payment',  label: '支付方式', includeEmpty: true, emptyText: '— 請選擇 —' },
      { type: 'select', id: 'ic-exp-status',   label: '狀態',    includeEmpty: false },
      { type: 'checkbox', id: 'ic-exp-fixed',  label: '設為每月固定支出' },
      // 隱藏欄位用於編輯模式
      { type: 'hidden', id: 'ic-exp-edit-id' },
      { type: 'hidden', id: 'ic-exp-edit-old-year' },
      { type: 'hidden', id: 'ic-exp-edit-old-month' },
      { type: 'hidden', id: 'ic-exp-edit-old-member' },
    ],
    submitText: '新增支出',
    showCancel: false,
    showReset: true,
    resetText: '重置',
    onSubmit: _handleSubmit,
  });

  // 初始化年月下拉
  fillYearSelect('ic-exp-year', { useAppState: true });
  fillMonthSelect('ic-exp-month', { useAppState: true });

  // 日期預設今天
  const dateEl = document.getElementById('ic-exp-date');
  if (dateEl && !dateEl.value) dateEl.value = todayISO();

  // 初始化狀態下拉
  fillStatusSelect('ic-exp-status', statusList, { includeEmpty: false });

  // 類別 → 項目連動
  _formApi.onFieldChange('ic-exp-category', () => {
    const catId = _formApi.getFieldValue('ic-exp-category');
    fillItemSelect('ic-exp-item', _items, catId, {
      includeEmpty: true,
      emptyText: catId ? '— 請選擇項目 —' : '— 請先選擇類別 —',
    });
  });
}

/* ============================================
   提交
   ============================================ */
async function _handleSubmit(data) {
  const targetYear = data['ic-exp-year'];
  const targetMonth = data['ic-exp-month'];
  const targetMember = data['ic-exp-member'];
  const catId = data['ic-exp-category'];
  const itemId = data['ic-exp-item'];
  const itemName = _items.find((i) => i.id === itemId)?.name || '';
  const amount = Number(data['ic-exp-amount']) || 0;
  const status = data['ic-exp-status'];
  const date = (data['ic-exp-date'] || '').trim() || todayISO();
  const paymentId = data['ic-exp-payment'] || '';
  const editId = data['ic-exp-edit-id'];
  const oldYear = data['ic-exp-edit-old-year'];
  const oldMonth = data['ic-exp-edit-old-month'];
  const oldMember = data['ic-exp-edit-old-member'];
  const setFixed = data['ic-exp-fixed'];

  if (!targetMember || !itemName || amount <= 0) {
    return { field: 'ic-exp-amount', message: '請填寫完整資料' };
  }

  const payload = {
    name: itemName,
    amount,
    status,
    date,
    categoryId: catId,
    itemId,
    paymentMethodId: paymentId,
  };

  try {
    if (editId && oldYear && oldMonth && oldMember) {
      // 編輯模式
      if (targetYear === oldYear && targetMonth === oldMonth && targetMember === oldMember) {
        await updateExpense(targetYear, targetMonth, targetMember, editId, payload);
      } else {
        // 移動：先刪除舊的，再新增
        await removeExpense(oldYear, oldMonth, oldMember, editId);
        await addExpense(targetYear, targetMonth, targetMember, payload);
      }
      showToast('✅ 已更新支出', 'success');
      _exitEditMode();
    } else {
      // 新增模式
      await addExpense(targetYear, targetMonth, targetMember, payload);
      showToast(`✅ 已新增 ${targetYear} 年 ${targetMonth} 月支出`, 'success');

      if (setFixed) {
        await addFixedTemplate({
          name: itemName,
          categoryId: catId,
          itemId,
          memberId: targetMember,
          amount,
          paymentMethodId: paymentId,
        });
      }
    }

    // 重置表單（保留年月）
    _resetFormKeepYM();
  } catch (err) {
    console.error('[tab-expenses] 提交失敗：', err);
    showToast('儲存失敗：' + (err.message || err), 'error');
  }
}

function _resetFormKeepYM() {
  const year = _formApi.getFieldValue('ic-exp-year');
  const month = _formApi.getFieldValue('ic-exp-month');

  _formApi.reset();
  _formApi.setFieldValue('ic-exp-year', year);
  _formApi.setFieldValue('ic-exp-month', month);
  _formApi.setFieldValue('ic-exp-date', todayISO());
  _formApi.setFieldValue('ic-exp-edit-id', '');
  _formApi.setFieldValue('ic-exp-edit-old-year', '');
  _formApi.setFieldValue('ic-exp-edit-old-month', '');
  _formApi.setFieldValue('ic-exp-edit-old-member', '');
  fillItemSelect('ic-exp-item', _items, '', { includeEmpty: true });
}

function _exitEditMode() {
  _formApi.setFieldValue('ic-exp-edit-id', '');
  _formApi.setFieldValue('ic-exp-edit-old-year', '');
  _formApi.setFieldValue('ic-exp-edit-old-month', '');
  _formApi.setFieldValue('ic-exp-edit-old-member', '');
  _resetFormKeepYM();
}

/* ============================================
   快速新增項目
   ============================================ */
async function _handleQuickAddItem() {
  const catId = _formApi.getFieldValue('ic-exp-category');
  if (!catId) {
    showToast('請先選擇類別', 'warning');
    return;
  }
  const name = prompt('請輸入新項目名稱：');
  if (!name || !name.trim()) return;

  try {
    const { addItem } = await import('../../core/db.js');
    await addItem({ name: name.trim(), categoryId: catId });
    showToast(`✅ 已新增項目「${name.trim()}」`, 'success');
  } catch (err) {
    showToast('新增項目失敗：' + err.message, 'error');
  }
}

/* ============================================
   資料監聽
   ============================================ */
function _bindListeners() {
  // 成員
  _unsubscribers.push(
    listenMembers((list) => {
      _members = list;
      fillMemberSelect('ic-exp-member', _members, { includeEmpty: true });
      _refreshMemberFilter();
    })
  );

  // 類別
  _unsubscribers.push(
    listenCategories((list) => {
      _categories = list;
      fillCategorySelect('ic-exp-category', _categories, { includeEmpty: true });
    })
  );

  // 項目
  _unsubscribers.push(
    listenItems((list) => {
      _items = list;
      const catId = _formApi?.getFieldValue('ic-exp-category') || '';
      fillItemSelect('ic-exp-item', _items, catId, { includeEmpty: true });
    })
  );

  // 支付方式
  _unsubscribers.push(
    listenPaymentMethods((list) => {
      _payments = list;
      fillPaymentSelect('ic-exp-payment', _payments, { includeEmpty: true });
    })
  );

  // 支出清單
  _unsubscribers.push(
    listenAllExpenses((list) => {
      _allExpenses = list;
      _renderList();
    })
  );
}

/* ============================================
   篩選
   ============================================ */
function _bindFilterEvents() {
  fillYearSelect('ic-exp-year-filter', { defaultValue: _filterYear });
  fillMonthSelect('ic-exp-month-filter', { defaultValue: _filterMonth, includeAll: false });

  document.getElementById('ic-exp-year-filter')?.addEventListener('change', (e) => {
    _filterYear = e.target.value;
    _renderList();
  });
  document.getElementById('ic-exp-month-filter')?.addEventListener('change', (e) => {
    _filterMonth = e.target.value;
    _renderList();
  });
  document.getElementById('ic-exp-member-filter')?.addEventListener('change', (e) => {
    _filterMember = e.target.value;
    _renderList();
  });
}

function _refreshMemberFilter() {
  const sel = document.getElementById('ic-exp-member-filter');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = `<option value="">全部</option>` +
    _members.map((m) => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('');
  if (cur && _members.some((m) => m.id === cur)) sel.value = cur;
}

/* ============================================
   清單渲染
   ============================================ */
function _renderList() {
  const listEl = document.getElementById('ic-expenses-list');
  const countEl = document.getElementById('ic-expenses-count');
  if (!listEl) return;

  // 過濾
  let filtered = _allExpenses.filter((x) => {
    if (_filterYear && x.year !== _filterYear) return false;
    if (_filterMonth && x.month !== _filterMonth) return false;
    if (_filterMember && x.memberId !== _filterMember) return false;
    return true;
  });

  // 排序：新到舊
  filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  // 只顯示最近 50 筆
  const limited = filtered.slice(0, 50);

  if (countEl) countEl.textContent = `（共 ${filtered.length} 筆）`;

  if (limited.length === 0) {
    listEl.innerHTML = `<div class="empty-state">此條件下尚無支出紀錄</div>`;
    return;
  }

  listEl.innerHTML = limited.map((x) => _renderExpenseRow(x)).join('');

  if (window.lucide) window.lucide.createIcons();
}

function _renderExpenseRow(x) {
  const member = _members.find((m) => m.id === x.memberId);
  const memberName = member ? member.name : '（未知）';
  const cat = _categories.find((c) => c.id === x.categoryId);
  const catName = cat ? cat.name : '—';
  const pm = _payments.find((p) => p.id === x.paymentMethodId);
  const pmName = pm ? pm.name : '—';
  const isAutoLinked = x.isAutoLinked;

  const statusBadge = _statusBadge(x.status);
  const autoBadge = isAutoLinked
    ? '<span class="badge badge-info" style="margin-left:6px;">保險連動</span>'
    : '';

  const actions = isAutoLinked
    ? '<span class="text-muted" style="font-size:11px;">由保險模組管理</span>'
    : `
      <button class="btn btn-sm btn-ghost" data-action="edit" data-key="${x.year}-${x.month}-${x.memberId}-${x.id}">編輯</button>
      <button class="btn btn-sm btn-danger" data-action="delete" data-key="${x.year}-${x.month}-${x.memberId}-${x.id}">刪除</button>
    `;

  return `
    <div class="data-card" data-key="${x.year}-${x.month}-${x.memberId}-${x.id}" style="margin-bottom:8px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:8px;">
        <div style="flex:1; min-width:0;">
          <div style="font-weight:600; color:var(--text-primary); margin-bottom:2px;">
            ${escapeHtml(x.name || '（未命名）')}${autoBadge}
          </div>
          <div style="font-size:11px; color:var(--text-muted);">
            ${escapeHtml(x.year)}-${escapeHtml(x.month)} · ${escapeHtml(memberName)} · ${escapeHtml(catName)}
            ${x.date ? ` · ${escapeHtml(x.date)}` : ''}
            ${pmName !== '—' ? ` · ${escapeHtml(pmName)}` : ''}
          </div>
        </div>
        <div style="text-align:right;">
          <div class="mono text-emerald" style="font-weight:700;">${formatHKD(x.amount)}</div>
          <div style="margin-top:4px;">${statusBadge}</div>
        </div>
      </div>
      <div style="display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap;">${actions}</div>
    </div>
  `;
}

function _statusBadge(status) {
  const statuses = getStatusesByCategory('personal');
  const s = statuses.find((x) => x.name === status);
  const isDone = s ? s.isDone : (status && status.startsWith('已'));
  const cls = isDone ? 'badge-success' : 'badge-pending';
  return `<span class="badge ${cls}">${escapeHtml(status || '未處理')}</span>`;
}

/* ============================================
   清單事件（編輯 / 刪除）
   ============================================ */
function _bindListEvents() {
  const listEl = document.getElementById('ic-expenses-list');
  if (!listEl) return;

  listEl.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const key = btn.dataset.key;
    const parts = key.split('-');
    if (parts.length < 4) return;

    const [year, month, memberId, id] = parts;
    const exp = _allExpenses.find((x) =>
      x.id === id && x.year === year && x.month === month && x.memberId === memberId
    );
    if (!exp) return;

    if (btn.dataset.action === 'edit') {
      _enterEditMode(exp);
    } else if (btn.dataset.action === 'delete') {
      const ok = await openConfirm(`確定要刪除「${exp.name}」嗎？`, { okClass: 'btn-danger' });
      if (!ok) return;
      try {
        await removeExpense(year, month, memberId, id);
        showToast('✅ 已刪除', 'success');
      } catch (err) {
        showToast('刪除失敗：' + err.message, 'error');
      }
    }
  });
}

function _enterEditMode(exp) {
  _formApi.setFieldValue('ic-exp-edit-id', exp.id);
  _formApi.setFieldValue('ic-exp-edit-old-year', exp.year);
  _formApi.setFieldValue('ic-exp-edit-old-month', exp.month);
  _formApi.setFieldValue('ic-exp-edit-old-member', exp.memberId);

  _formApi.setFieldValue('ic-exp-year', exp.year);
  _formApi.setFieldValue('ic-exp-month', exp.month);
  _formApi.setFieldValue('ic-exp-member', exp.memberId);
  _formApi.setFieldValue('ic-exp-date', exp.date || '');
  _formApi.setFieldValue('ic-exp-category', exp.categoryId || '');
  fillItemSelect('ic-exp-item', _items, exp.categoryId || '', { includeEmpty: true });
  setTimeout(() => _formApi.setFieldValue('ic-exp-item', exp.itemId || ''), 50);
  _formApi.setFieldValue('ic-exp-amount', exp.amount || 0);
  _formApi.setFieldValue('ic-exp-payment', exp.paymentMethodId || '');
  _formApi.setFieldValue('ic-exp-status', exp.status || '');

  // 滾動到表單
  document.getElementById('ic-expenses-form-root')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  showToast('進入編輯模式，修改後按儲存', 'info');
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