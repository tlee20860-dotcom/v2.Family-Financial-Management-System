// ============================================
// tab-categories.js — 基礎資料庫：支出結構 Tab（v101）
// 位置：js/pages/database/tab-categories.js
// ============================================
// 功能：
//   左側：支出類別 CRUD + 排序
//   右側：支出項目 CRUD（依類別過濾）
//   桌面：左右並排；手機：上下堆疊
// ============================================

import {
  listenCategories, addCategory, updateCategory, removeCategory,
  listenItems, addItem, updateItem, removeItem,
} from '../../core/db.js';
import { escapeHtml } from '../../core/utils.js';
import { showToast } from '../../shared/toast.js';
import { openModal, closeModal, openConfirm } from '../../shared/modal.js';
import { buildForm } from '../../shared/form-builder.js';

/* ============================================
   Module 狀態
   ============================================ */
let _container = null;
let _categories = [];
let _items = [];
let _catFormApi = null;
let _itemFormApi = null;
let _catModalFormApi = null;
let _itemModalFormApi = null;
let _editingCatId = null;
let _editingItemId = null;
let _filterCategoryId = '';
let _unsubscribers = [];

const CAT_MODAL_ID = 'db-cat-modal';
const ITEM_MODAL_ID = 'db-item-modal';

/* ============================================
   主入口
   ============================================ */
export function initCategoriesTab(containerId) {
  _container = document.getElementById(containerId);
  if (!_container) {
    console.warn(`⚠️ initCategoriesTab: 找不到容器 #${containerId}`);
    return null;
  }

  _container.innerHTML = _buildSkeleton();

  _renderCatForm();
  _renderItemForm();
  _renderCatModal();
  _renderItemModal();
  _bindEvents();
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
    <div class="grid grid-2" style="gap:16px; align-items:start;">

      <!-- 左：類別 -->
      <div>
        <div id="db-cat-form-root" class="mb-16"></div>

        <div class="glass-card collapsible-card collapsible-card-flat" id="db-cats-list-card">
          <div class="collapsible-header" id="db-cats-list-header">
            <div class="collapsible-header-title">
              <i data-lucide="tags" style="width:16px;height:16px;"></i>
              <span>支出類別 <span class="text-muted" id="db-cats-count" style="font-size:12px; margin-left:6px;"></span></span>
            </div>
            <i data-lucide="chevron-down" class="collapsible-arrow"></i>
          </div>
          <div class="collapsible-body" style="display:block;">
            <div id="db-cats-list"></div>
          </div>
        </div>
      </div>

      <!-- 右：項目 -->
      <div>
        <div id="db-item-form-root" class="mb-16"></div>

        <div class="glass-card collapsible-card collapsible-card-flat" id="db-items-list-card">
          <div class="collapsible-header" id="db-items-list-header">
            <div class="collapsible-header-title">
              <i data-lucide="list" style="width:16px;height:16px;"></i>
              <span>支出項目 <span class="text-muted" id="db-items-count" style="font-size:12px; margin-left:6px;"></span></span>
            </div>
            <div style="display:flex; align-items:center; gap:10px;" onclick="event.stopPropagation()">
              <select class="select" id="db-item-filter" style="width:auto; padding:4px 8px; font-size:12px;">
                <option value="">全部分類</option>
              </select>
              <i data-lucide="chevron-down" class="collapsible-arrow"></i>
            </div>
          </div>
          <div class="collapsible-body" style="display:block;">
            <div id="db-items-list"></div>
          </div>
        </div>
      </div>

    </div>
  `;
}

/* ============================================
   類別新增表單
   ============================================ */
function _renderCatForm() {
  _catFormApi = buildForm({
    containerId: 'db-cat-form-root',
    fields: [
      { type: 'text',   id: 'db-cat-name',  label: '類別名稱', required: true, placeholder: '例如：醫療類', maxlength: 20 },
      { type: 'number', id: 'db-cat-order', label: '排序（數字越小越前）', min: 0, placeholder: '0' },
    ],
    submitText: '新增類別',
    showCancel: false,
    showReset: true,
    resetText: '重置',
    onSubmit: _handleCatAdd,
  });
}

async function _handleCatAdd(data) {
  const name = (data['db-cat-name'] || '').trim();
  const order = Number(data['db-cat-order']) || 0;

  if (!name) {
    return { field: 'db-cat-name', message: '請填寫類別名稱' };
  }

  if (_categories.some((c) => c.name === name)) {
    return { field: 'db-cat-name', message: '此類別名稱已存在' };
  }

  try {
    await addCategory({ name, order });
    showToast(`✅ 已新增類別「${name}」`, 'success');
    _catFormApi.reset();
  } catch (err) {
    showToast('新增失敗：' + err.message, 'error');
  }
}

/* ============================================
   項目新增表單
   ============================================ */
function _renderItemForm() {
  _itemFormApi = buildForm({
    containerId: 'db-item-form-root',
    fields: [
      { type: 'select', id: 'db-item-cat',  label: '所屬類別', required: true, includeEmpty: true, emptyText: '— 請選擇 —' },
      { type: 'text',   id: 'db-item-name', label: '項目名稱', required: true, placeholder: '例如：看病-濕疹', maxlength: 30 },
    ],
    submitText: '新增項目',
    showCancel: false,
    showReset: true,
    resetText: '重置',
    onSubmit: _handleItemAdd,
  });

  // 預設跟隨篩選
  _itemFormApi.onFieldChange('db-item-cat', () => {
    // 可擴充：切換時自動聚焦
  });
}

async function _handleItemAdd(data) {
  const name = (data['db-item-name'] || '').trim();
  const categoryId = data['db-item-cat'];

  if (!name || !categoryId) {
    return { field: 'db-item-name', message: '請選擇類別並填寫項目名稱' };
  }

  try {
    await addItem({ name, categoryId });
    showToast(`✅ 已新增項目「${name}」`, 'success');
    _itemFormApi.reset();
    // 若當前篩選 = 該類別，保持一致性
    if (_filterCategoryId === categoryId) {
      _render();
    }
  } catch (err) {
    showToast('新增失敗：' + err.message, 'error');
  }
}

/* ============================================
   類別編輯 Modal
   ============================================ */
function _renderCatModal() {
  const existing = document.getElementById(CAT_MODAL_ID);
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = CAT_MODAL_ID;
  overlay.innerHTML = `
    <div class="modal">
      <h2 class="modal-title">編輯類別</h2>
      <div id="db-cat-modal-form-root"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  _catModalFormApi = buildForm({
    containerId: 'db-cat-modal-form-root',
    fields: [
      { type: 'hidden', id: 'db-cat-edit-id' },
      { type: 'text',   id: 'db-cat-edit-name',  label: '類別名稱', required: true, maxlength: 20 },
      { type: 'number', id: 'db-cat-edit-order', label: '排序', min: 0 },
    ],
    submitText: '儲存',
    showCancel: true,
    cancelText: '取消',
    onSubmit: _handleCatEdit,
    onCancel: () => closeModal(CAT_MODAL_ID),
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(CAT_MODAL_ID);
  });
}

async function _handleCatEdit(data) {
  const id = data['db-cat-edit-id'];
  if (!id) return;

  const name = (data['db-cat-edit-name'] || '').trim();
  const order = Number(data['db-cat-edit-order']) || 0;

  if (!name) {
    return { field: 'db-cat-edit-name', message: '請填寫類別名稱' };
  }

  try {
    await updateCategory(id, { name, order });
    showToast('✅ 已更新類別', 'success');
    closeModal(CAT_MODAL_ID);
    _editingCatId = null;
  } catch (err) {
    showToast('更新失敗：' + err.message, 'error');
  }
}

/* ============================================
   項目編輯 Modal
   ============================================ */
function _renderItemModal() {
  const existing = document.getElementById(ITEM_MODAL_ID);
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = ITEM_MODAL_ID;
  overlay.innerHTML = `
    <div class="modal">
      <h2 class="modal-title">編輯項目</h2>
      <div id="db-item-modal-form-root"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  _itemModalFormApi = buildForm({
    containerId: 'db-item-modal-form-root',
    fields: [
      { type: 'hidden', id: 'db-item-edit-id' },
      { type: 'select', id: 'db-item-edit-cat',  label: '所屬類別', required: true, includeEmpty: true, emptyText: '— 請選擇 —' },
      { type: 'text',   id: 'db-item-edit-name', label: '項目名稱', required: true, maxlength: 30 },
    ],
    submitText: '儲存',
    showCancel: true,
    cancelText: '取消',
    onSubmit: _handleItemEdit,
    onCancel: () => closeModal(ITEM_MODAL_ID),
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(ITEM_MODAL_ID);
  });
}

async function _handleItemEdit(data) {
  const id = data['db-item-edit-id'];
  if (!id) return;

  const name = (data['db-item-edit-name'] || '').trim();
  const categoryId = data['db-item-edit-cat'];

  if (!name || !categoryId) {
    return { field: 'db-item-edit-name', message: '請選擇類別並填寫項目名稱' };
  }

  try {
    await updateItem(id, { name, categoryId });
    showToast('✅ 已更新項目', 'success');
    closeModal(ITEM_MODAL_ID);
    _editingItemId = null;
  } catch (err) {
    showToast('更新失敗：' + err.message, 'error');
  }
}

/* ============================================
   資料監聽
   ============================================ */
function _bindListeners() {
  _unsubscribers.push(
    listenCategories((list) => {
      _categories = list;
      _refreshCategoryOptions();
      _render();
    })
  );

  _unsubscribers.push(
    listenItems((list) => {
      _items = list;
      _render();
    })
  );
}

function _refreshCategoryOptions() {
  const options = _categories.map((c) => ({ value: c.id, label: c.name }));

  // 新增表單
  _itemFormApi?.updateOptions('db-item-cat', options, { includeEmpty: true, emptyText: '— 請選擇 —' });

  // 編輯 Modal
  _itemModalFormApi?.updateOptions('db-item-edit-cat', options, { includeEmpty: true, emptyText: '— 請選擇 —' });

  // 篩選下拉
  const filterSel = document.getElementById('db-item-filter');
  if (filterSel) {
    const cur = filterSel.value;
    filterSel.innerHTML = `<option value="">全部分類</option>` +
      _categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    if (cur && _categories.some((c) => c.id === cur)) filterSel.value = cur;
  }
}

/* ============================================
   事件綁定
   ============================================ */
function _bindEvents() {
  // 類別清單
  document.getElementById('db-cats-list')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    const cat = _categories.find((c) => c.id === id);
    if (!cat) return;

    if (action === 'edit') {
      _openCatEditModal(cat);
    } else if (action === 'delete') {
      await _handleCatDelete(cat);
    }
  });

  // 項目清單
  document.getElementById('db-items-list')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    const item = _items.find((i) => i.id === id);
    if (!item) return;

    if (action === 'edit') {
      _openItemEditModal(item);
    } else if (action === 'delete') {
      await _handleItemDelete(item);
    }
  });

  // 篩選
  document.getElementById('db-item-filter')?.addEventListener('change', (e) => {
    _filterCategoryId = e.target.value;
    _renderItems();
  });
}

/* ============================================
   類別 / 項目 操作
   ============================================ */
function _openCatEditModal(cat) {
  _editingCatId = cat.id;
  _catModalFormApi?.setData({
    'db-cat-edit-id': cat.id,
    'db-cat-edit-name': cat.name || '',
    'db-cat-edit-order': cat.order || 0,
  });
  openModal(CAT_MODAL_ID);
}

async function _handleCatDelete(cat) {
  const used = _items.filter((i) => i.categoryId === cat.id);
  if (used.length > 0) {
    showToast(`無法刪除：此類別下還有 ${used.length} 個項目`, 'warning');
    return;
  }

  const ok = await openConfirm(`確定要刪除類別「${cat.name}」嗎？`, {
    title: '刪除類別',
    okText: '刪除',
    okClass: 'btn-danger',
  });
  if (!ok) return;

  try {
    await removeCategory(cat.id);
    showToast('✅ 已刪除類別', 'success');
  } catch (err) {
    showToast('刪除失敗：' + err.message, 'error');
  }
}

function _openItemEditModal(item) {
  _editingItemId = item.id;
  _itemModalFormApi?.setData({
    'db-item-edit-id': item.id,
    'db-item-edit-cat': item.categoryId || '',
    'db-item-edit-name': item.name || '',
  });
  openModal(ITEM_MODAL_ID);
}

async function _handleItemDelete(item) {
  const ok = await openConfirm(`確定要刪除項目「${item.name}」嗎？`, {
    title: '刪除項目',
    okText: '刪除',
    okClass: 'btn-danger',
  });
  if (!ok) return;

  try {
    await removeItem(item.id);
    showToast('✅ 已刪除項目', 'success');
  } catch (err) {
    showToast('刪除失敗：' + err.message, 'error');
  }
}

/* ============================================
   渲染
   ============================================ */
function _render() {
  _renderCategories();
  _renderItems();
}

function _renderCategories() {
  const listEl = document.getElementById('db-cats-list');
  const countEl = document.getElementById('db-cats-count');
  if (!listEl) return;

  if (countEl) countEl.textContent = `（共 ${_categories.length} 個）`;

  if (_categories.length === 0) {
    listEl.innerHTML = `<div class="empty-state">尚無類別，請從上方新增</div>`;
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
          ${_categories.map((c) => `
            <tr data-id="${c.id}">
              <td>${escapeHtml(c.name)}</td>
              <td class="num">${c.order || 0}</td>
              <td>
                <button class="btn btn-sm btn-ghost" data-action="edit" data-id="${c.id}">編輯</button>
                <button class="btn btn-sm btn-danger" data-action="delete" data-id="${c.id}">刪除</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
}

function _renderItems() {
  const listEl = document.getElementById('db-items-list');
  const countEl = document.getElementById('db-items-count');
  if (!listEl) return;

  const filtered = _filterCategoryId
    ? _items.filter((i) => i.categoryId === _filterCategoryId)
    : _items;

  if (countEl) countEl.textContent = `（共 ${filtered.length} 個）`;

  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="empty-state">尚無項目</div>`;
    return;
  }

  listEl.innerHTML = `
    <div style="overflow-x:auto;">
      <table class="data-table">
        <thead>
          <tr>
            <th>名稱</th>
            <th style="width:120px;">所屬類別</th>
            <th style="width:130px;">操作</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map((it) => {
            const cat = _categories.find((c) => c.id === it.categoryId);
            const catName = cat ? cat.name : '（未分類）';
            return `
              <tr data-id="${it.id}">
                <td>${escapeHtml(it.name)}</td>
                <td><span class="badge badge-info">${escapeHtml(catName)}</span></td>
                <td>
                  <button class="btn btn-sm btn-ghost" data-action="edit" data-id="${it.id}">編輯</button>
                  <button class="btn btn-sm btn-danger" data-action="delete" data-id="${it.id}">刪除</button>
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

/* ============================================
   銷毀
   ============================================ */
function _destroy() {
  _unsubscribers.forEach((fn) => {
    try { fn(); } catch (e) { /* noop */ }
  });
  _unsubscribers = [];
  if (_catFormApi) _catFormApi.destroy();
  if (_itemFormApi) _itemFormApi.destroy();
  if (_catModalFormApi) _catModalFormApi.destroy();
  if (_itemModalFormApi) _itemModalFormApi.destroy();

  document.getElementById(CAT_MODAL_ID)?.remove();
  document.getElementById(ITEM_MODAL_ID)?.remove();
}