// ============================================
// entity-list-page.js — 實體列表頁骨架（v101.6 🆕）
// 位置：js/shared/entity-list-page.js
// ============================================
// 職責：
//   1. 從 entity-definitions.js 讀取配置
//   2. 自動監聽 Firebase 資料
//   3. 自動渲染「新增 / 編輯 / 刪除」按鈕
//   4. 整合 data-table / data-card / column-settings
//   5. 整合 view-toggle（可選）
//   6. 整合 page-filter（可選）
//   7. 支援 hooks
//
// 使用方式：
//   initEntityListPage({
//     entity: 'bank',
//     containerId: 'db-banks-panel',
//     hooks: { ... },
//   });
//
// API 凍結：v101.6 發布後只加不改
// ============================================

import { getEntityDef, getEntityUi } from '../config/entity-definitions.js';
import { escapeHtml } from '../core/utils.js';
import { renderDataTable } from './data-table.js';
import { renderDataCard } from './data-card.js';
import { openEntityModal } from './entity-modal.js';
import { openConfirm } from './modal.js';
import { showToast } from './toast.js';
import { createListenerGroup } from './listener-group.js';
import { handleSubmit } from './form-handler.js';
import { deleteEntity, listenEntity } from './entity-helpers.js';
import { initViewToggle } from './view-toggle.js';

/* ============================================
   主函式
   ============================================ */

/**
 * 初始化實體列表頁
 * @param {Object} options
 * @param {string} options.entity - 必填：entityKey
 * @param {string} options.containerId - 必填：容器 ID
 * @param {Object} [options.hooks] - Hook
 * @param {Object} [options.filters] - 篩選配置
 * @param {Object} [options.options] - 選項
 * @returns {Object} { refresh, getRows, setView, destroy }
 */
export function initEntityListPage(options) {
  const {
    entity,
    containerId,
    hooks = {},
    filters = null,
    options: extraOptions = {},
  } = options;

  const root = document.getElementById(containerId);
  if (!root) {
    console.warn(`⚠️ initEntityListPage: 找不到容器 #${containerId}`);
    return null;
  }

  const def = getEntityDef(entity);
  if (!def) {
    console.warn(`⚠️ initEntityListPage: 找不到實體 ${entity}`);
    return null;
  }

  const ui = getEntityUi(entity) || {};
  const {
    canCreate = true,
    canEdit = true,
    canDelete = true,
    deleteConfirmText,
  } = ui;

  const {
    defaultView = 'table',         // 'table' | 'card'
    showViewToggle = false,        // 是否顯示卡片/表格切換
    showHeader = true,             // 是否顯示 header（新增按鈕）
    storageKey = null,             // view-toggle 的 storageKey
  } = extraOptions;

  /* ============================================
     Module 狀態
     ============================================ */
  let _rows = [];
  let _viewToggle = null;
  let _currentView = defaultView;
  let _tableApi = null;
  let _cardApi = null;

  const listenerGroup = createListenerGroup();

  /* ============================================
     渲染骨架
     ============================================ */
  _renderSkeleton();

  /* ============================================
     啟動監聽
     ============================================ */
  _startListening();

  /* ============================================
     回傳 API
     ============================================ */
  return {
    refresh: _refresh,
    getRows: () => _rows,
    setView: _setView,
    destroy: _destroy,
  };

  /* ============================================
     內部：渲染骨架
     ============================================ */
  function _renderSkeleton() {
    const headerHtml = showHeader ? `
      <div class="entity-list-header flex flex-between items-center flex-wrap gap-12 mb-16">
        <div class="text-muted" style="font-size:13px;">
          ${escapeHtml(def.label)}管理
        </div>
        <div class="flex items-center gap-8 flex-wrap">
          ${showViewToggle ? `<div id="${containerId}-view-toggle"></div>` : ''}
          ${canCreate ? `
            <button class="btn btn-primary" id="${containerId}-add-btn">
              <i data-lucide="plus"></i> 新增${escapeHtml(def.label)}
            </button>
          ` : ''}
        </div>
      </div>
    ` : '';

    root.innerHTML = `
      ${headerHtml}
      <div id="${containerId}-content"></div>
    `;

    // 初始化 view-toggle
    if (showViewToggle) {
      _viewToggle = initViewToggle({
        containerId: `${containerId}-view-toggle`,
        storageKey: storageKey || `${entity}-view`,
        defaultView,
        cardText: '卡片',
        tableText: '表格',
        autoApply: false,
        onChange: (view) => {
          _currentView = view;
          _renderContent();
        },
      });
      _currentView = _viewToggle.getView();
    }

    // 綁定「新增」按鈕
    if (canCreate) {
      const addBtn = document.getElementById(`${containerId}-add-btn`);
      if (addBtn) {
        addBtn.addEventListener('click', _handleAdd);
      }
    }

    if (window.lucide) window.lucide.createIcons();
  }

  /* ============================================
     內部：啟動監聽
     ============================================ */
  function _startListening() {
    const unsub = listenEntity(entity, (rows) => {
      _rows = rows || [];
      _renderContent();
    });
    listenerGroup.add(unsub);
  }

  /* ============================================
     內部：渲染內容
     ============================================ */
  function _renderContent() {
    const contentEl = document.getElementById(`${containerId}-content`);
    if (!contentEl) return;

    // 銷毀舊的
    if (_tableApi) { try { _tableApi.destroy(); } catch (e) {} _tableApi = null; }
    if (_cardApi) { try { _cardApi.destroy(); } catch (e) {} _cardApi = null; }

    // 依視圖渲染
    if (_currentView === 'card') {
      _cardApi = renderDataCard({
        container: contentEl,
        entityKey: entity,
        rows: _rows,
        options: extraOptions,
        hooks: {
          ...hooks,
          onEdit: _handleEdit,
          onDelete: _handleDelete,
        },
      });
    } else {
      _tableApi = renderDataTable({
        container: contentEl,
        entityKey: entity,
        rows: _rows,
        tableId: `${entity}-table`,
        options: extraOptions,
        hooks: {
          ...hooks,
          onEdit: _handleEdit,
          onDelete: _handleDelete,
        },
      });
    }
  }

  /* ============================================
     內部：新增
     ============================================ */
  function _handleAdd() {
    if (typeof hooks.onBeforeAdd === 'function') {
      const result = hooks.onBeforeAdd();
      if (result === false) return;
      if (result && typeof result === 'object') {
        // hook 可回傳 initialData
        openEntityModal({
          entity,
          mode: 'add',
          initialData: result,
          allRows: _rows,
        });
        return;
      }
    }

    openEntityModal({
      entity,
      mode: 'add',
      allRows: _rows,
    });
  }

  /* ============================================
     內部：編輯
     ============================================ */
  function _handleEdit(row) {
    if (typeof hooks.onBeforeEdit === 'function') {
      const result = hooks.onBeforeEdit(row);
      if (result === false) return;
    }

    openEntityModal({
      entity,
      mode: 'edit',
      id: row.id,
      allRows: _rows,
    });
  }

  /* ============================================
     內部：刪除
     ============================================ */
  async function _handleDelete(row) {
    if (!canDelete) return;

    // 確認訊息
    let confirmText;
    if (typeof hooks.deleteConfirmText === 'function') {
      confirmText = hooks.deleteConfirmText(row);
    } else if (typeof deleteConfirmText === 'function') {
      confirmText = deleteConfirmText(row);
    } else {
      confirmText = `確定要刪除「${row.name || row.id}」嗎？`;
    }

    const ok = await openConfirm(confirmText, {
      title: `刪除${def.label}`,
      okText: '刪除',
      okClass: 'btn-danger',
    });
    if (!ok) return;

    // 特殊處理：policy 需要傳 memberId
    let extraArgs = [];
    if (entity === 'policy') {
      extraArgs = [row.memberId];
    } else if (entity === 'member') {
      extraArgs = [];
    } else if (entity === 'bank') {
      extraArgs = [];
    }

    // hook 可自訂 delete args
    if (typeof hooks.getDeleteArgs === 'function') {
      extraArgs = hooks.getDeleteArgs(row) || [];
    }

    await handleSubmit({
      action: () => deleteEntity(entity, row.id, ...extraArgs),
      successMessage: `✅ 已刪除${def.label}`,
      onSuccess: () => {
        if (typeof hooks.afterDelete === 'function') {
          hooks.afterDelete(row);
        }
      },
    });
  }

  /* ============================================
     內部：刷新
     ============================================ */
  function _refresh() {
    _renderContent();
  }

  /* ============================================
     內部：切換視圖
     ============================================ */
  function _setView(view) {
    _currentView = view;
    if (_viewToggle) _viewToggle.setView(view);
    _renderContent();
  }

  /* ============================================
     內部：銷毀
     ============================================ */
  function _destroy() {
    listenerGroup.destroy();

    if (_tableApi) { try { _tableApi.destroy(); } catch (e) {} _tableApi = null; }
    if (_cardApi) { try { _cardApi.destroy(); } catch (e) {} _cardApi = null; }
    if (_viewToggle) { try { _viewToggle.destroy(); } catch (e) {} _viewToggle = null; }

    root.innerHTML = '';
  }
}

/* ============================================
   便利函式
   ============================================ */

/**
 * 批次初始化多個實體列表頁
 * @param {Array} configs - [{ entity, containerId, hooks, ... }]
 * @returns {Array}
 */
export function initEntityListPages(configs = []) {
  return configs.map((cfg) => initEntityListPage(cfg));
}