// ============================================
// tab-categories.js — 基礎資料庫：支出結構 Tab（v101.5）
// 位置：js/pages/database/tab-categories.js
// ============================================
// v101.5 修正：
//   ✅ 類別 / 項目新增 / 編輯改用 entity-modal
//   ✅ 刪除使用 entity-helpers 的 deleteEntity
//   ✅ 事件監聽改用 _container.querySelector + 完整清理
//   ✅ 使用 registerPageCleanup 註冊清理
// ============================================

import {
  listenCategories, listenItems,
} from '../../core/db.js';
import { escapeHtml } from '../../core/utils.js';
import { showToast } from '../../shared/toast.js';
import { openConfirm } from '../../shared/modal.js';
import { openEntityModal } from '../../shared/entity-modal.js';
import { deleteEntity } from '../../shared/entity-helpers.js';
import { ENTITY_KEYS } from '../../config/constants.js';

/* ============================================
   Module 狀態
   ============================================ */
let _container = null;
let _categories = [];
let _items = [];
let _filterCategoryId = '';
let _unsubscribers = [];
let _catListHandler = null;
let _itemListHandler = null;
let _catAddHandler = null;
let _itemAddHandler = null;
let _filterHandler = null;

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

  _bindEvents();

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
        <div class="flex flex-between items-center flex-wrap gap-12 mb-12">
          <div class="text-muted" style="font-size:13px;">支出類別</div>
          <button class="btn btn-primary btn-sm" id="db-cat-add-btn">
            <i data-lucide="plus" style="width:14px;height:14px;"></i> 新增類別
          </button>
        </div>

        <div class="glass-card collapsible-card collapsible-card-flat" id="db-cats-list-card">
          <div class="collapsible-header" id="db-cats-list-header">
            <div class="collapsible-header-title">
              <i data-lucide="tags" style="width:16px;height:16px;"></i>
              <span>類別清單 <span class="text-muted" id="db-cats-count" style="font-size:12px; margin-left:6px;"></span></span>
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
        <div class="flex flex-between items-center flex-wrap gap-12 mb-12">
          <div class="text-muted" style="font-size:13px;">支出項目</div>
          <button class="btn btn-primary btn-sm" id="db-item-add-btn">
            <i data-lucide="plus" style="width:14px;height:14px;"></i> 新增項目
          </button>
        </div>

        <div class="glass-card collapsible-card collapsible-card-flat" id="db-items-list-card">
          <div class="collapsible-header" id="db-items-list-header">
            <div class="collapsible-header-title">
              <i data-lucide="list" style="width:16px;height:16px;"></i>
              <span>項目清單 <span class="text-muted" id="db-items-count" style="font-size:12px; margin-left:6px;"></span></span>
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
   事件綁定
   ============================================ */
function _bindEvents() {
  // 類別清單
  _catListHandler = async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    const cat = _categories.find((c) => c.id === id);
    if (!cat) return;

    if (action === 'edit') {
      openEntityModal({
        entity: ENTITY_KEYS.CATEGORY,
        mode: 'edit',
        id: cat.id,
        allRows: _categories,
      });
    } else if (action === 'delete') {
      await _handleCatDelete(cat);
    }
  };
  _container.querySelector('#db-cats-list')?.addEventListener('click', _catListHandler);

  // 項目清單
  _itemListHandler = async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    const item = _items.find((i) => i.id === id);
    if (!item) return;

    if (action === 'edit') {
      openEntityModal({
        entity: ENTITY_KEYS.ITEM,
        mode: 'edit',
        id: item.id,
        allRows: _items,
      });
    } else if (action === 'delete') {
      await _handleItemDelete(item);
    }
  };
  _container.querySelector('#db-items-list')?.addEventListener('click', _itemListHandler);

  // 篩選
  _filterHandler = (e) => {
    _filterCategoryId = e.target.value;
    _renderItems();
  };
  _container.querySelector('#db-item-filter')?.addEventListener('change', _filterHandler);

  // 新增按鈕
  _catAddHandler = () => {
    openEntityModal({
      entity: ENTITY_KEYS.CATEGORY,
      mode: 'add',
      allRows: _categories,
    });
  };
  _container.querySelector('#db-cat-add-btn')?.addEventListener('click', _catAddHandler);

  _itemAddHandler = () => {
    openEntityModal({
      entity: ENTITY_KEYS.ITEM,
      mode: 'add',
      initialData: _filterCategoryId ? { categoryId: _filterCategoryId } : null,
      allRows: _items,
    });
  };
  _container.querySelector('#db-item-add-btn')?.addEventListener('click', _itemAddHandler);
}

/* ============================================
   類別 / 項目刪除
   ============================================ */
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
    await deleteEntity(ENTITY_KEYS.CATEGORY, cat.id);
    showToast('✅ 已刪除類別', 'success');
  } catch (err) {
    showToast('刪除失敗：' + err.message, 'error');
  }
}

async function _handleItemDelete(item) {
  const ok = await openConfirm(`確定要刪除項目「${item.name}」嗎？`, {
    title: '刪除項目',
    okText: '刪除',
    okClass: 'btn-danger',
  });
  if (!ok) return;

  try {
    await deleteEntity(ENTITY_KEYS.ITEM, item.id);
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
  const listEl = _container.querySelector('#db-cats-list');
  const countEl = _container.querySelector('#db-cats-count');
  if (!listEl) return;

  if (countEl) countEl.textContent = `（共 ${_categories.length} 個）`;

  if (_categories.length === 0) {
    listEl.innerHTML = `<div class="empty-state">尚無類別，請點擊上方「新增類別」</div>`;
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
  const listEl = _container.querySelector('#db-items-list');
  const countEl = _container.querySelector('#db-items-count');
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
   篩選下拉更新
   ============================================ */
function _refreshCategoryOptions() {
  const filterSel = _container.querySelector('#db-item-filter');
  if (filterSel) {
    const cur = filterSel.value;
    filterSel.innerHTML = `<option value="">全部分類</option>` +
      _categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    if (cur && _categories.some((c) => c.id === cur)) filterSel.value = cur;
  }
}

/* ============================================
   銷毀
   ============================================ */
function _destroy() {
  _unsubscribers.forEach((fn) => {
    try { fn(); } catch (e) { /* noop */ }
  });
  _unsubscribers = [];

  if (_catListHandler && _container) {
    _container.querySelector('#db-cats-list')?.removeEventListener('click', _catListHandler);
    _catListHandler = null;
  }
  if (_itemListHandler && _container) {
    _container.querySelector('#db-items-list')?.removeEventListener('click', _itemListHandler);
    _itemListHandler = null;
  }
  if (_filterHandler && _container) {
    _container.querySelector('#db-item-filter')?.removeEventListener('change', _filterHandler);
    _filterHandler = null;
  }
  if (_catAddHandler && _container) {
    _container.querySelector('#db-cat-add-btn')?.removeEventListener('click', _catAddHandler);
    _catAddHandler = null;
  }
  if (_itemAddHandler && _container) {
    _container.querySelector('#db-item-add-btn')?.removeEventListener('click', _itemAddHandler);
    _itemAddHandler = null;
  }
}