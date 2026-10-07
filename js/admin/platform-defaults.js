// ============================================
// platform-defaults.js — 平台預設資料庫（v101）
// 位置：js/admin/platform-defaults.js
// ============================================
// 9 個子 Tab 整合（superadmin 專用）
//   1. 成員       members
//   2. 銀行       banks
//   3. 保險公司   companies
//   4. 支付方式   payments
//   5. 支出結構   categories + items
//   6. 狀態       statuses
//   7. 下拉選項   options
//   8. 年份範圍   yearRange
//   9. UI 常數    uiConstants
//
// 資料位置：platform/defaults/*
// 影響：新家庭初始化時套用（不影響既有家庭）
// ============================================

import { api } from '../core/api.js';
import { escapeHtml } from '../core/utils.js';
import { showToast } from '../shared/toast.js';
import { initTabPanel } from '../shared/tab-panel.js';
import { buildForm } from '../shared/form-builder.js';
import { openModal, closeModal, openConfirm } from '../shared/modal.js';

/* ============================================
   Module 狀態
   ============================================ */
let _container = null;
let _tabPanel = null;

// 每個 Tab 的資料快取
const _cache = {
  members: [],
  banks: [],
  companies: [],
  payments: [],
  categories: [],
  items: [],
  statuses: [],
  options: null,
  yearRange: null,
  uiConstants: null,
};

// 子 Tab 的實例（僅特殊處理的 Tab 需要）
const _instances = {};

const EDIT_MODAL_ID = 'pd-edit-modal';

/* ============================================
   泛型清單 Tab 定義
   ============================================ */
const LIST_TABS = [
  {
    key: 'members',
    label: '成員',
    icon: 'users',
    resource: 'members',
    fields: [
      { id: 'name', label: '名稱', type: 'text', required: true, maxlength: 20 },
      { id: 'role', label: '角色', type: 'select', required: true,
        options: [
          { value: 'husband', label: '老公 / 丈夫' },
          { value: 'wife', label: '老婆 / 妻子' },
          { value: 'child', label: '子女' },
          { value: 'other', label: '其他' },
        ],
        includeEmpty: false,
      },
      { id: 'order', label: '排序', type: 'number', min: 0 },
    ],
    displayColumns: ['name', 'role', 'order'],
  },
  {
    key: 'banks',
    label: '銀行',
    icon: 'landmark',
    resource: 'banks',
    fields: [
      { id: 'name', label: '銀行名稱', type: 'text', required: true, maxlength: 20 },
      { id: 'order', label: '排序', type: 'number', min: 0 },
    ],
    displayColumns: ['name', 'order'],
  },
  {
    key: 'companies',
    label: '保險公司',
    icon: 'shield',
    resource: 'companies',
    fields: [
      { id: 'name', label: '公司名稱', type: 'text', required: true, maxlength: 30 },
      { id: 'order', label: '排序', type: 'number', min: 0 },
    ],
    displayColumns: ['name', 'order'],
  },
  {
    key: 'payments',
    label: '支付方式',
    icon: 'credit-card',
    resource: 'payments',
    fields: [
      { id: 'name', label: '支付方式名稱', type: 'text', required: true, maxlength: 20 },
      { id: 'order', label: '排序', type: 'number', min: 0 },
    ],
    displayColumns: ['name', 'order'],
  },
  {
    key: 'statuses',
    label: '狀態',
    icon: 'tag',
    resource: 'statuses',
    fields: [
      { id: 'name', label: '狀態名稱', type: 'text', required: true, maxlength: 20 },
      {
        id: 'category', label: '所屬類別', type: 'select', required: true, includeEmpty: false,
        options: [
          { value: 'personal', label: '個人支出' },
          { value: 'fixed', label: '固定支出' },
          { value: 'insurance', label: '保險' },
        ],
      },
      {
        id: 'isDone', label: '是否為「已完成」', type: 'select', required: true, includeEmpty: false,
        options: [
          { value: 'false', label: '否（未處理類）' },
          { value: 'true', label: '是（已完成類）' },
        ],
      },
      { id: 'order', label: '排序', type: 'number', min: 0 },
    ],
    displayColumns: ['name', 'category', 'order'],
    valueTransform: {
      // isDone 從 boolean 轉字串（表單 select）
      toForm: (data) => ({ ...data, isDone: data.isDone ? 'true' : 'false' }),
      // 從表單轉回 boolean
      fromForm: (data) => ({ ...data, isDone: data.isDone === 'true' }),
    },
  },
];

/* ============================================
   Tab 定義（9 個）
   ============================================ */
const ALL_TABS = [
  { key: 'members',    label: '成員',       icon: 'users' },
  { key: 'banks',      label: '銀行',       icon: 'landmark' },
  { key: 'companies',  label: '保險公司',   icon: 'shield' },
  { key: 'payments',   label: '支付方式',   icon: 'credit-card' },
  { key: 'categories', label: '支出結構',   icon: 'tags' },
  { key: 'statuses',   label: '狀態',       icon: 'tag' },
  { key: 'options',    label: '下拉選項',   icon: 'list-ordered' },
  { key: 'yearRange',  label: '年份範圍',   icon: 'calendar' },
  { key: 'uiConstants',label: 'UI 常數',    icon: 'palette' },
];

/* ============================================
   主入口
   ============================================ */
export function initPlatformDefaults(containerId) {
  _container = document.getElementById(containerId);
  if (!_container) {
    console.warn(`⚠️ initPlatformDefaults: 找不到容器 #${containerId}`);
    return null;
  }

  // 渲染骨架
  _container.innerHTML = `
    <div id="pd-tabs-root"></div>
    ${ALL_TABS.map((t) => `
      <div id="pd-panel-${t.key}" class="tab-panel" style="display:none;"></div>
    `).join('')}
  `;

  // 初始化 Tab 面板
  _tabPanel = initTabPanel({
    containerId: 'pd-tabs-root',
    tabs: ALL_TABS.map((t) => ({
      key: t.key,
      label: t.label,
      icon: t.icon,
      panelId: `pd-panel-${t.key}`,
    })),
    defaultKey: 'members',
    storageKey: 'pd-tab',
    wrap: true,
    onChange: (key) => _activateTab(key),
  });

  if (_tabPanel) {
    _activateTab(_tabPanel.getCurrent());
  }

  return {
    refresh: () => {
      const key = _tabPanel?.getCurrent();
      if (key) _activateTab(key, true);
    },
    destroy: _destroy,
  };
}

/* ============================================
   啟用 Tab
   ============================================ */
async function _activateTab(key, force = false) {
  const panel = document.getElementById(`pd-panel-${key}`);
  if (!panel) return;

  // 若已載入且不強制 → 只做 refresh
  if (!force && panel.dataset.loaded === '1' && _instances[key]?.refresh) {
    try { _instances[key].refresh(); } catch (e) { /* noop */ }
    return;
  }

  panel.dataset.loaded = '1';
  panel.innerHTML = `<div class="empty-state">載入中…</div>`;

  try {
    // 泛型清單 Tab
    const listTab = LIST_TABS.find((t) => t.key === key);
    if (listTab) {
      _instances[key] = await _renderListTab(panel, listTab);
      return;
    }

    // 特殊 Tab
    switch (key) {
      case 'categories':
        _instances[key] = await _renderCategoriesTab(panel);
        break;
      case 'options':
        _instances[key] = await _renderOptionsTab(panel);
        break;
      case 'yearRange':
        _instances[key] = await _renderYearRangeTab(panel);
        break;
      case 'uiConstants':
        _instances[key] = await _renderUIConstantsTab(panel);
        break;
      default:
        panel.innerHTML = `<div class="banner banner-error">未知的 Tab：${key}</div>`;
    }
  } catch (err) {
    console.error(`[platform-defaults] 載入 ${key} 失敗：`, err);
    panel.innerHTML = `<div class="banner banner-error">載入失敗：${escapeHtml(err.message)}</div>`;
  }
}

/* ============================================
   === 泛型清單 Tab ===
   ============================================ */

async function _renderListTab(panel, tabConfig) {
  panel.innerHTML = `
    <div id="pd-${tabConfig.key}-form-root" class="mb-16"></div>
    <div class="glass-card collapsible-card collapsible-card-flat" style="padding:0;">
      <div class="collapsible-header">
        <div class="collapsible-header-title">
          <i data-lucide="${tabConfig.icon}" style="width:16px;height:16px;"></i>
          <span>${escapeHtml(tabConfig.label)}清單 <span class="text-muted" id="pd-${tabConfig.key}-count" style="font-size:12px; margin-left:6px;"></span></span>
        </div>
      </div>
      <div class="collapsible-body" style="display:block;">
        <div id="pd-${tabConfig.key}-list"></div>
      </div>
    </div>
  `;

  // 新增表單
  const formApi = buildForm({
    containerId: `pd-${tabConfig.key}-form-root`,
    fields: _buildFormFields(tabConfig.fields),
    submitText: `新增${tabConfig.label}`,
    showCancel: false,
    showReset: true,
    resetText: '重置',
    onSubmit: async (data) => {
      const clean = _cleanFormData(data, tabConfig);
      try {
        await api.platformDefaults.put(tabConfig.resource, null, clean);
        showToast(`✅ 已新增`, 'success');
        formApi.reset();
        await refresh();
      } catch (err) {
        showToast('新增失敗：' + err.message, 'error');
      }
    },
  });

  /* 資料載入 */
  let _list = [];

  async function load() {
    try {
      const result = await api.platformDefaults.list(tabConfig.resource);
      _list = result.list || [];
    } catch (err) {
      _list = [];
    }
    renderList();
  }

  /* 清單渲染 */
  function renderList() {
    const listEl = document.getElementById(`pd-${tabConfig.key}-list`);
    const countEl = document.getElementById(`pd-${tabConfig.key}-count`);
    if (!listEl) return;

    if (countEl) countEl.textContent = `（共 ${_list.length} 筆）`;

    if (_list.length === 0) {
      listEl.innerHTML = `<div class="empty-state">尚無資料</div>`;
      return;
    }

    listEl.innerHTML = `
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              ${tabConfig.displayColumns.map((col) => {
                const field = tabConfig.fields.find((f) => f.id === col);
                return `<th>${escapeHtml(field?.label || col)}</th>`;
              }).join('')}
              <th style="width:130px;">操作</th>
            </tr>
          </thead>
          <tbody>
            ${_list.map((row) => `
              <tr data-id="${row.id}">
                ${tabConfig.displayColumns.map((col) => {
                  const val = row[col];
                  return `<td>${_renderCellValue(val, col, tabConfig)}</td>`;
                }).join('')}
                <td>
                  <button class="btn btn-sm btn-ghost" data-action="edit" data-id="${row.id}">編輯</button>
                  <button class="btn btn-sm btn-danger" data-action="delete" data-id="${row.id}">刪除</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
  }

  /* 清單事件 */
  panel.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    const row = _list.find((x) => x.id === id);
    if (!row) return;

    if (action === 'edit') {
      await _openEditModal(tabConfig, row, refresh);
    } else if (action === 'delete') {
      const ok = await openConfirm(
        `確定要刪除「${row.name || id}」嗎？\n\n（不會影響已存在的家庭）`,
        { title: '刪除', okText: '刪除', okClass: 'btn-danger' }
      );
      if (!ok) return;
      try {
        await api.platformDefaults.remove(tabConfig.resource, id);
        showToast('✅ 已刪除', 'success');
        await refresh();
      } catch (err) {
        showToast('刪除失敗：' + err.message, 'error');
      }
    }
  });

  /* refresh */
  async function refresh() {
    await load();
  }

  await load();

  return { refresh };
}

/* ============================================
   編輯 Modal（泛型）
   ============================================ */
async function _openEditModal(tabConfig, row, onSave) {
  // 建立 Modal
  let overlay = document.getElementById(EDIT_MODAL_ID);
  if (overlay) overlay.remove();

  overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = EDIT_MODAL_ID;
  overlay.innerHTML = `
    <div class="modal" style="max-width:480px;">
      <h2 class="modal-title">編輯「${escapeHtml(tabConfig.label)}」</h2>
      <div id="pd-edit-modal-form-root"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  // 表單
  const formApi = buildForm({
    containerId: 'pd-edit-modal-form-root',
    fields: _buildFormFields(tabConfig.fields),
    submitText: '儲存',
    showCancel: true,
    cancelText: '取消',
    onSubmit: async (data) => {
      const clean = _cleanFormData(data, tabConfig);
      try {
        await api.platformDefaults.put(tabConfig.resource, row.id, clean);
        showToast('✅ 已更新', 'success');
        closeModal(EDIT_MODAL_ID);
        await onSave();
      } catch (err) {
        showToast('更新失敗：' + err.message, 'error');
      }
    },
    onCancel: () => closeModal(EDIT_MODAL_ID),
  });

  // 填入現值
  const formData = tabConfig.valueTransform?.toForm
    ? tabConfig.valueTransform.toForm(row)
    : row;
  formApi.setData(formData);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(EDIT_MODAL_ID);
  });

  openModal(EDIT_MODAL_ID);
}

/* ============================================
   表單欄位轉換
   ============================================ */
function _buildFormFields(fields) {
  return fields.map((f) => ({
    type: f.type,
    id: `pd-${f.id}`,
    label: f.label,
    required: f.required,
    maxlength: f.maxlength,
    min: f.min,
    max: f.max,
    step: f.step,
    options: f.options,
    includeEmpty: f.includeEmpty !== undefined ? f.includeEmpty : true,
    emptyText: f.emptyText || '— 請選擇 —',
    placeholder: f.placeholder,
    hint: f.hint,
  }));
}

function _cleanFormData(data, tabConfig) {
  const clean = {};
  tabConfig.fields.forEach((f) => {
    const key = `pd-${f.id}`;
    let val = data[key];

    // 型別轉換
    if (f.type === 'number') {
      val = Number(val) || 0;
    } else if (f.type === 'text') {
      val = String(val || '').trim();
    }

    clean[f.id] = val;
  });

  // 額外轉換（如 isDone 從 'true' 轉 true）
  if (tabConfig.valueTransform?.fromForm) {
    return tabConfig.valueTransform.fromForm(clean);
  }

  return clean;
}

function _renderCellValue(val, col, tabConfig) {
  if (val == null || val === '') return '<span class="text-muted">—</span>';

  // 布林值
  if (typeof val === 'boolean') {
    return val ? '<span class="badge badge-success">是</span>' : '<span class="badge badge-muted">否</span>';
  }

  // 列舉顯示轉換
  const field = tabConfig.fields.find((f) => f.id === col);
  if (field?.type === 'select' && field.options) {
    const opt = field.options.find((o) => String(o.value) === String(val));
    if (opt) return escapeHtml(opt.label);
  }

  // 預設
  return escapeHtml(String(val));
}

/* ============================================
   === 支出結構 Tab（類別 + 項目）===
   ============================================ */
async function _renderCategoriesTab(panel) {
  panel.innerHTML = `
    <div class="grid grid-2" style="gap:16px; align-items:start;">
      <div>
        <div id="pd-cat-form-root" class="mb-16"></div>
        <div class="glass-card collapsible-card collapsible-card-flat" style="padding:0;">
          <div class="collapsible-header">
            <div class="collapsible-header-title">
              <i data-lucide="tags" style="width:16px;height:16px;"></i>
              <span>支出類別 <span class="text-muted" id="pd-cat-count" style="font-size:12px; margin-left:6px;"></span></span>
            </div>
          </div>
          <div class="collapsible-body" style="display:block;">
            <div id="pd-cat-list"></div>
          </div>
        </div>
      </div>
      <div>
        <div id="pd-item-form-root" class="mb-16"></div>
        <div class="glass-card collapsible-card collapsible-card-flat" style="padding:0;">
          <div class="collapsible-header">
            <div class="collapsible-header-title">
              <i data-lucide="list" style="width:16px;height:16px;"></i>
              <span>支出項目 <span class="text-muted" id="pd-item-count" style="font-size:12px; margin-left:6px;"></span></span>
            </div>
          </div>
          <div class="collapsible-body" style="display:block;">
            <div id="pd-item-list"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  let _categories = [];
  let _items = [];

  /* 類別表單 */
  const catFormApi = buildForm({
    containerId: 'pd-cat-form-root',
    fields: [
      { type: 'text',   id: 'pd-cat-name',  label: '類別名稱', required: true, maxlength: 20 },
      { type: 'number', id: 'pd-cat-order', label: '排序', min: 0 },
    ],
    submitText: '新增類別',
    showCancel: false,
    showReset: true,
    resetText: '重置',
    onSubmit: async (data) => {
      const clean = {
        name: String(data['pd-cat-name'] || '').trim(),
        order: Number(data['pd-cat-order']) || 0,
      };
      if (!clean.name) return { field: 'pd-cat-name', message: '請填寫名稱' };
      try {
        await api.platformDefaults.put('categories', null, clean);
        showToast('✅ 已新增類別', 'success');
        catFormApi.reset();
        await refresh();
      } catch (err) {
        showToast('新增失敗：' + err.message, 'error');
      }
    },
  });

  /* 項目表單 */
  const itemFormApi = buildForm({
    containerId: 'pd-item-form-root',
    fields: [
      { type: 'select', id: 'pd-item-cat',  label: '所屬類別', required: true, includeEmpty: true, emptyText: '— 請選擇 —' },
      { type: 'text',   id: 'pd-item-name', label: '項目名稱', required: true, maxlength: 30 },
    ],
    submitText: '新增項目',
    showCancel: false,
    showReset: true,
    resetText: '重置',
    onSubmit: async (data) => {
      const clean = {
        name: String(data['pd-item-name'] || '').trim(),
        categoryKey: data['pd-item-cat'] || '',
      };
      if (!clean.name || !clean.categoryKey) {
        return { field: 'pd-item-name', message: '請填寫完整' };
      }
      try {
        await api.platformDefaults.put('items', null, clean);
        showToast('✅ 已新增項目', 'success');
        itemFormApi.reset();
        await refresh();
      } catch (err) {
        showToast('新增失敗：' + err.message, 'error');
      }
    },
  });

  /* 載入 */
  async function load() {
    try {
      const [catRes, itemRes] = await Promise.all([
        api.platformDefaults.list('categories'),
        api.platformDefaults.list('items'),
      ]);
      _categories = catRes.list || [];
      _items = itemRes.list || [];
    } catch (err) {
      _categories = [];
      _items = [];
    }

    // 更新項目表單的類別選項
    itemFormApi.updateOptions('pd-item-cat',
      _categories.map((c) => ({ value: c.id, label: c.name })),
      { includeEmpty: true, emptyText: '— 請選擇 —' }
    );

    renderCategories();
    renderItems();
  }

  function renderCategories() {
    const listEl = document.getElementById('pd-cat-list');
    const countEl = document.getElementById('pd-cat-count');
    if (!listEl) return;
    if (countEl) countEl.textContent = `（${_categories.length}）`;

    if (_categories.length === 0) {
      listEl.innerHTML = `<div class="empty-state">尚無類別</div>`;
      return;
    }

    listEl.innerHTML = `
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead><tr><th>名稱</th><th class="num" style="width:60px;">排序</th><th style="width:130px;">操作</th></tr></thead>
          <tbody>
            ${_categories.map((c) => `
              <tr data-id="${c.id}">
                <td>${escapeHtml(c.name)}</td>
                <td class="num">${c.order || 0}</td>
                <td>
                  <button class="btn btn-sm btn-ghost" data-action="edit-cat" data-id="${c.id}">編輯</button>
                  <button class="btn btn-sm btn-danger" data-action="del-cat" data-id="${c.id}">刪除</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  }

  function renderItems() {
    const listEl = document.getElementById('pd-item-list');
    const countEl = document.getElementById('pd-item-count');
    if (!listEl) return;
    if (countEl) countEl.textContent = `（${_items.length}）`;

    if (_items.length === 0) {
      listEl.innerHTML = `<div class="empty-state">尚無項目</div>`;
      return;
    }

    listEl.innerHTML = `
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead><tr><th>名稱</th><th style="width:100px;">類別</th><th style="width:130px;">操作</th></tr></thead>
          <tbody>
            ${_items.map((it) => {
              const cat = _categories.find((c) => c.id === it.categoryKey);
              return `
                <tr data-id="${it.id}">
                  <td>${escapeHtml(it.name)}</td>
                  <td><span class="badge badge-info">${escapeHtml(cat?.name || '—')}</span></td>
                  <td>
                    <button class="btn btn-sm btn-ghost" data-action="edit-item" data-id="${it.id}">編輯</button>
                    <button class="btn btn-sm btn-danger" data-action="del-item" data-id="${it.id}">刪除</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  }

  /* 事件 */
  panel.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;

    switch (action) {
      case 'edit-cat': {
        const cat = _categories.find((c) => c.id === id);
        if (!cat) return;
        await _openSimpleEditModal({
          title: '編輯類別',
          resource: 'categories',
          id: cat.id,
          fields: [
            { type: 'text',   id: 'name',  label: '類別名稱', required: true, maxlength: 20 },
            { type: 'number', id: 'order', label: '排序', min: 0 },
          ],
          initialData: { name: cat.name, order: cat.order || 0 },
          onSave: refresh,
        });
        break;
      }
      case 'del-cat': {
        const cat = _categories.find((c) => c.id === id);
        if (!cat) return;
        const used = _items.filter((i) => i.categoryKey === id);
        if (used.length > 0) {
          showToast(`無法刪除：此類別下還有 ${used.length} 個項目`, 'warning');
          return;
        }
        const ok = await openConfirm(`確定要刪除類別「${cat.name}」嗎？`, { okText: '刪除', okClass: 'btn-danger' });
        if (!ok) return;
        try {
          await api.platformDefaults.remove('categories', id);
          showToast('✅ 已刪除', 'success');
          await refresh();
        } catch (err) {
          showToast('刪除失敗：' + err.message, 'error');
        }
        break;
      }
      case 'edit-item': {
        const it = _items.find((x) => x.id === id);
        if (!it) return;
        await _openSimpleEditModal({
          title: '編輯項目',
          resource: 'items',
          id: it.id,
          fields: [
            {
              type: 'select', id: 'categoryKey', label: '所屬類別', required: true, includeEmpty: true,
              options: _categories.map((c) => ({ value: c.id, label: c.name })),
            },
            { type: 'text', id: 'name', label: '項目名稱', required: true, maxlength: 30 },
          ],
          initialData: { categoryKey: it.categoryKey || '', name: it.name || '' },
          onSave: refresh,
        });
        break;
      }
      case 'del-item': {
        const it = _items.find((x) => x.id === id);
        if (!it) return;
        const ok = await openConfirm(`確定要刪除項目「${it.name}」嗎？`, { okText: '刪除', okClass: 'btn-danger' });
        if (!ok) return;
        try {
          await api.platformDefaults.remove('items', id);
          showToast('✅ 已刪除', 'success');
          await refresh();
        } catch (err) {
          showToast('刪除失敗：' + err.message, 'error');
        }
        break;
      }
    }
  });

  async function refresh() {
    await load();
  }

  await load();

  return { refresh };
}

/* ============================================
   === 通用編輯 Modal ===
   ============================================ */
async function _openSimpleEditModal({ title, resource, id, fields, initialData, onSave }) {
  let overlay = document.getElementById(EDIT_MODAL_ID);
  if (overlay) overlay.remove();

  overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = EDIT_MODAL_ID;
  overlay.innerHTML = `
    <div class="modal" style="max-width:480px;">
      <h2 class="modal-title">${escapeHtml(title)}</h2>
      <div id="pd-edit-modal-form-root"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  const formApi = buildForm({
    containerId: 'pd-edit-modal-form-root',
    fields: fields.map((f) => ({
      type: f.type,
      id: `pd-${f.id}`,
      label: f.label,
      required: f.required,
      maxlength: f.maxlength,
      min: f.min,
      max: f.max,
      options: f.options,
      includeEmpty: f.includeEmpty !== undefined ? f.includeEmpty : true,
    })),
    submitText: '儲存',
    showCancel: true,
    cancelText: '取消',
    onSubmit: async (data) => {
      const clean = {};
      fields.forEach((f) => {
        let val = data[`pd-${f.id}`];
        if (f.type === 'number') val = Number(val) || 0;
        else if (f.type === 'text') val = String(val || '').trim();
        clean[f.id] = val;
      });

      try {
        await api.platformDefaults.put(resource, id, clean);
        showToast('✅ 已更新', 'success');
        closeModal(EDIT_MODAL_ID);
        if (onSave) await onSave();
      } catch (err) {
        showToast('更新失敗：' + err.message, 'error');
      }
    },
    onCancel: () => closeModal(EDIT_MODAL_ID),
  });

  // 填入現值
  const setData = {};
  fields.forEach((f) => { setData[`pd-${f.id}`] = initialData[f.id] ?? ''; });
  formApi.setData(setData);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(EDIT_MODAL_ID);
  });

  openModal(EDIT_MODAL_ID);
}

/* ============================================
   === 下拉選項 Tab ===
   ============================================ */
async function _renderOptionsTab(panel) {
  const GROUPS = [
    { key: 'memberRoles', label: '成員角色', type: 'value-label' },
    { key: 'cycles', label: '付款週期', type: 'value-label' },
    { key: 'policyTypes', label: '保單類型', type: 'value-label' },
    { key: 'insurancePaymentTypes', label: '保險付款類型', type: 'value-label' },
    { key: 'categoryOrder', label: '類別順序', type: 'string' },
  ];

  let _options = {};

  panel.innerHTML = `
    <div class="banner" style="margin-bottom:16px;">
      ℹ️ 此處定義「新家庭初始化時」的下拉選項預設值。
    </div>
    <div id="pd-options-list" class="grid grid-2" style="gap:16px; align-items:start;"></div>
  `;

  async function load() {
    try {
      const result = await api.platformDefaults.list('options');
      // options 是單物件
      _options = result.data || {};
    } catch (err) {
      _options = {};
    }
    render();
  }

  function render() {
    const listEl = document.getElementById('pd-options-list');
    if (!listEl) return;

    listEl.innerHTML = GROUPS.map((g) => _renderGroupCard(g)).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  function _renderGroupCard(group) {
    const list = _options[group.key] || [];
    const rows = list.map((item, i) => {
      const main = group.type === 'value-label'
        ? `<div style="font-weight:500;">${escapeHtml(item.label || '')}</div>
           <div style="font-size:11px; color:var(--text-muted); font-family:var(--font-mono);">${escapeHtml(item.value || '')}</div>`
        : `<div style="font-weight:500;">${escapeHtml(item)}</div>`;

      return `
        <div style="display:flex; align-items:center; gap:8px; padding:8px 10px; border-bottom:1px solid rgba(255,255,255,0.04);">
          <div style="flex:1; min-width:0;">${main}</div>
          <div style="display:flex; gap:2px;">
            <button class="btn btn-sm btn-ghost" data-action="edit-opt" data-group="${group.key}" data-index="${i}">編輯</button>
            <button class="btn btn-sm btn-danger" data-action="del-opt" data-group="${group.key}" data-index="${i}">刪除</button>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="glass-card collapsible-card collapsible-card-flat">
        <div class="collapsible-header">
          <div class="collapsible-header-title">
            <i data-lucide="list-ordered" style="width:16px;height:16px;"></i>
            <span>${escapeHtml(group.label)} <span class="text-muted" style="font-size:12px;">（${list.length}）</span></span>
          </div>
          <button class="btn btn-sm btn-ghost" data-action="add-opt" data-group="${group.key}">
            <i data-lucide="plus" style="width:14px;height:14px;"></i> 新增
          </button>
        </div>
        <div class="collapsible-body" style="display:block; padding:0;">
          ${list.length === 0 ? `<div class="empty-state" style="padding:20px;">尚未設定</div>` : `<div>${rows}</div>`}
        </div>
      </div>
    `;
  }

  /* 事件 */
  panel.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const groupKey = btn.dataset.group;
    const index = Number(btn.dataset.index);
    const group = GROUPS.find((g) => g.key === groupKey);
    if (!group) return;

    if (action === 'add-opt') {
      await _openOptionEditModal(group, null, -1, _options, refresh);
    } else if (action === 'edit-opt') {
      await _openOptionEditModal(group, (_options[groupKey] || [])[index], index, _options, refresh);
    } else if (action === 'del-opt') {
      const item = (_options[groupKey] || [])[index];
      if (item == null) return;
      const displayName = group.type === 'value-label' ? (item.label || item.value) : item;
      const ok = await openConfirm(`確定要刪除「${displayName}」嗎？`, { okText: '刪除', okClass: 'btn-danger' });
      if (!ok) return;
      const newList = (_options[groupKey] || []).filter((_, i) => i !== index);
      try {
        await api.platformDefaults.set('options', { ..._options, [groupKey]: newList });
        showToast('✅ 已刪除', 'success');
        await refresh();
      } catch (err) {
        showToast('刪除失敗：' + err.message, 'error');
      }
    }
  });

  async function refresh() {
    await load();
  }

  await load();

  return { refresh };
}

/* 選項編輯 Modal */
async function _openOptionEditModal(group, item, index, allOptions, onSave) {
  const isAdd = index < 0;

  let overlay = document.getElementById(EDIT_MODAL_ID);
  if (overlay) overlay.remove();

  overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = EDIT_MODAL_ID;
  overlay.innerHTML = `
    <div class="modal" style="max-width:480px;">
      <h2 class="modal-title">${isAdd ? '新增' : '編輯'}「${escapeHtml(group.label)}」</h2>
      <div id="pd-edit-modal-form-root"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  const fields = group.type === 'value-label'
    ? [
        { type: 'text', id: 'pd-opt-value', label: '值（英文 / 代碼）', required: true, maxlength: 40 },
        { type: 'text', id: 'pd-opt-label', label: '顯示名稱', required: true, maxlength: 40 },
      ]
    : [
        { type: 'text', id: 'pd-opt-value', label: '名稱', required: true, maxlength: 40 },
      ];

  const formApi = buildForm({
    containerId: 'pd-edit-modal-form-root',
    fields,
    submitText: isAdd ? '新增' : '儲存',
    showCancel: true,
    cancelText: '取消',
    onSubmit: async (data) => {
      const list = [...(allOptions[group.key] || [])];

      if (group.type === 'value-label') {
        const value = String(data['pd-opt-value'] || '').trim();
        const label = String(data['pd-opt-label'] || '').trim();
        if (!value || !label) return { field: 'pd-opt-value', message: '請填寫完整' };

        // 檢查重複
        if (list.some((x, i) => i !== index && x.value === value)) {
          return { field: 'pd-opt-value', message: '此值已存在' };
        }

        const newItem = { value, label };
        if (isAdd) list.push(newItem);
        else list[index] = newItem;
      } else {
        const value = String(data['pd-opt-value'] || '').trim();
        if (!value) return { field: 'pd-opt-value', message: '請填寫名稱' };
        if (list.some((x, i) => i !== index && x === value)) {
          return { field: 'pd-opt-value', message: '此名稱已存在' };
        }
        if (isAdd) list.push(value);
        else list[index] = value;
      }

      try {
        await api.platformDefaults.set('options', { ...allOptions, [group.key]: list });
        showToast('✅ 已儲存', 'success');
        closeModal(EDIT_MODAL_ID);
        await onSave();
      } catch (err) {
        showToast('儲存失敗：' + err.message, 'error');
      }
    },
    onCancel: () => closeModal(EDIT_MODAL_ID),
  });

  // 填入現值
  if (!isAdd && item != null) {
    if (group.type === 'value-label') {
      formApi.setData({ 'pd-opt-value': item.value || '', 'pd-opt-label': item.label || '' });
    } else {
      formApi.setData({ 'pd-opt-value': item || '' });
    }
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(EDIT_MODAL_ID);
  });

  openModal(EDIT_MODAL_ID);
}

/* ============================================
   === 年份範圍 Tab ===
   ============================================ */
async function _renderYearRangeTab(panel) {
  let _data = { startYear: null, futureYears: 5 };

  panel.innerHTML = `
    <div class="banner" style="margin-bottom:16px;">
      ℹ️ 定義「新家庭初始化時」的預設年份範圍（家庭可自行覆蓋）。
    </div>
    <div class="glass-card" style="max-width:520px;">
      <div id="pd-yr-form-root"></div>
    </div>
  `;

  const formApi = buildForm({
    containerId: 'pd-yr-form-root',
    fields: [
      {
        type: 'number', id: 'pd-yr-start', label: '起始年份',
        min: 1900, max: 2200, step: 1,
        placeholder: '留空 = 當前年 - 3',
        hint: '若填寫的年份大於「當前年 - 3」，實際套用時會自動調整',
      },
      {
        type: 'number', id: 'pd-yr-future', label: '往後顯示年數',
        required: true, min: 0, max: 20, step: 1,
      },
    ],
    submitText: '儲存年份範圍',
    showCancel: false,
    showReset: false,
    onSubmit: async (data) => {
      const startYear = (data['pd-yr-start'] === '' || data['pd-yr-start'] == null)
        ? null : Number(data['pd-yr-start']);
      const futureYears = Number(data['pd-yr-future']) || 5;

      if (startYear != null && (isNaN(startYear) || startYear < 1900 || startYear > 2200)) {
        return { field: 'pd-yr-start', message: '請填寫合理的年份' };
      }
      if (futureYears < 0 || futureYears > 20) {
        return { field: 'pd-yr-future', message: '請填寫 0 ~ 20 之間的數字' };
      }

      try {
        await api.platformDefaults.set('yearRange', { startYear, futureYears });
        showToast('✅ 年份範圍已儲存', 'success');
      } catch (err) {
        showToast('儲存失敗：' + err.message, 'error');
      }
    },
  });

  async function load() {
    try {
      const result = await api.platformDefaults.list('yearRange');
      _data = result.data || { startYear: null, futureYears: 5 };
    } catch (err) {
      _data = { startYear: null, futureYears: 5 };
    }
    formApi.setData({
      'pd-yr-start': _data.startYear != null ? _data.startYear : '',
      'pd-yr-future': _data.futureYears || 5,
    });
  }

  await load();

  return { refresh: load };
}

/* ============================================
   === UI 常數 Tab ===
   ============================================ */
async function _renderUIConstantsTab(panel) {
  panel.innerHTML = `
    <div class="banner" style="margin-bottom:16px;">
      ℹ️ 定義「新家庭初始化時」的預設 UI 常數（家庭可自行覆蓋）。
    </div>
    <div class="glass-card" style="max-width:520px;">
      <div id="pd-ui-form-root"></div>
    </div>
  `;

  const formApi = buildForm({
    containerId: 'pd-ui-form-root',
    fields: [
      {
        type: 'number', id: 'pd-ui-name-desktop', label: '名稱截斷長度（桌面）',
        required: true, min: 4, max: 40, step: 1,
      },
      {
        type: 'number', id: 'pd-ui-name-mobile', label: '名稱截斷長度（手機）',
        required: true, min: 2, max: 20, step: 1,
      },
      {
        type: 'number', id: 'pd-ui-toast', label: 'Toast 顯示時間（毫秒）',
        required: true, min: 500, max: 10000, step: 100,
      },
    ],
    submitText: '儲存 UI 常數',
    showCancel: false,
    showReset: false,
    onSubmit: async (data) => {
      const payload = {
        nameMaxLenDesktop: Number(data['pd-ui-name-desktop']),
        nameMaxLenMobile: Number(data['pd-ui-name-mobile']),
        toastDuration: Number(data['pd-ui-toast']),
      };
      try {
        await api.platformDefaults.set('uiConstants', payload);
        showToast('✅ UI 常數已儲存', 'success');
      } catch (err) {
        showToast('儲存失敗：' + err.message, 'error');
      }
    },
  });

  async function load() {
    try {
      const result = await api.platformDefaults.list('uiConstants');
      const data = result.data || {};
      formApi.setData({
        'pd-ui-name-desktop': data.nameMaxLenDesktop || 12,
        'pd-ui-name-mobile': data.nameMaxLenMobile || 6,
        'pd-ui-toast': data.toastDuration || 2000,
      });
    } catch (err) {
      formApi.setData({
        'pd-ui-name-desktop': 12,
        'pd-ui-name-mobile': 6,
        'pd-ui-toast': 2000,
      });
    }
  }

  await load();

  return { refresh: load };
}

/* ============================================
   銷毀
   ============================================ */
function _destroy() {
  Object.values(_instances).forEach((inst) => {
    try { inst?.destroy?.(); } catch (e) { /* noop */ }
  });

  if (_tabPanel) {
    try { _tabPanel.destroy(); } catch (e) { /* noop */ }
    _tabPanel = null;
  }
}