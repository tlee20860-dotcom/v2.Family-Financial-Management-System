// ============================================
// entity-list-page.js — 實體列表頁骨架（v103.0.2）
// 位置：js/shared/entity-list-page.js
// ============================================
// v103.0.2 修正：
//   ✅ entity-definitions 路徑改為 ../entity/
//   ✅ entity-modal / entity-helpers 路徑改為 ../entity/
//   ✅ modal / toast / view-toggle 路徑改為 ../ui/
// ============================================

import { getEntityDef, getEntityUi } from '../entity/entity-definitions.js';
import { escapeHtml } from '../core/utils.js';
import { AppState } from '../core/state.js';
import { renderDataTable } from './data-table.js';
import { renderDataCard } from './data-card.js';
import { openEntityModal } from '../entity/entity-modal.js';
import { openConfirm } from '../ui/modal.js';
import { showToast } from '../ui/toast.js';
import { createListenerGroup } from './listener-group.js';
import { handleSubmit } from './form-handler.js';
import { deleteEntity, listenEntity } from '../entity/entity-helpers.js';
import { initViewToggle } from '../ui/view-toggle.js';

/* ============================================
   主函式
   ============================================ */

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
    canCreate: rawCanCreate = true,
    canEdit: rawCanEdit = true,
    canDelete: rawCanDelete = true,
    deleteConfirmText,
  } = ui;

  const userCanInput = AppState.getCanInput();
  const canCreate = rawCanCreate && userCanInput;
  const canEdit = rawCanEdit && userCanInput;
  const canDelete = rawCanDelete && userCanInput;

  const {
    defaultView = 'table',
    showViewToggle = false,
    showHeader = true,
    storageKey = null,
  } = extraOptions;

  let _rows = [];
  let _viewToggle = null;
  let _currentView = defaultView;
  let _tableApi = null;
  let _cardApi = null;

  const listenerGroup = createListenerGroup();

  _renderSkeleton();
  _startListening();

  return {
    refresh: _refresh,
    getRows: () => _rows,
    setView: _setView,
    destroy: _destroy,
  };

  function _renderSkeleton() {
    const headerHtml = showHeader ? `
      <div class="entity-list-header flex flex-between items-center flex-wrap gap-12 mb-16">
        <div class="text-muted" style="font-size:13px;">
          ${escapeHtml(def.label)}管理${!userCanInput ? '（唯讀模式）' : ''}
        </div>
        <div class="flex items-center gap-8 flex-wrap">
          ${showViewToggle ? `<div id="${containerId}-view-toggle"></div>` : ''}
          ${canCreate ? `
            <button type="button" class="btn btn-primary" id="${containerId}-add-btn">
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

    if (canCreate) {
      const addBtn = document.getElementById(`${containerId}-add-btn`);
      if (addBtn) {
        addBtn.addEventListener('click', _handleAdd);
      }
    }

    if (window.lucide) window.lucide.createIcons();
  }

  function _startListening() {
    const unsub = listenEntity(entity, (rows) => {
      _rows = rows || [];
      _renderContent();
    });
    listenerGroup.add(unsub);
  }

  function _renderContent() {
    const contentEl = document.getElementById(`${containerId}-content`);
    if (!contentEl) return;

    if (_tableApi) { try { _tableApi.destroy(); } catch (e) {} _tableApi = null; }
    if (_cardApi) { try { _cardApi.destroy(); } catch (e) {} _cardApi = null; }

    if (_currentView === 'card') {
      _cardApi = renderDataCard({
        container: contentEl,
        entityKey: entity,
        rows: _rows,
        options: extraOptions,
        hooks: {
          ...hooks,
          onEdit: canEdit ? _handleEdit : undefined,
          onDelete: canDelete ? _handleDelete : undefined,
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
          onEdit: canEdit ? _handleEdit : undefined,
          onDelete: canDelete ? _handleDelete : undefined,
        },
      });
    }

    if (!canEdit && !canDelete) {
      _hideActionButtons(contentEl);
    }
  }

  function _hideActionButtons(contentEl) {
    contentEl.querySelectorAll('th').forEach((th) => {
      const colId = th.dataset.colId || '';
      const isAction = colId === '__actions__' || th.textContent.trim() === '操作';
      if (isAction) th.style.display = 'none';
    });

    contentEl.querySelectorAll('td[data-label="操作"]').forEach((td) => {
      td.style.display = 'none';
    });

    contentEl.querySelectorAll('.data-card-footer').forEach((footer) => {
      if (footer.children.length === 0) {
        footer.style.display = 'none';
      }
    });
  }

  function _handleAdd() {
    if (!canCreate) return;

    if (typeof hooks.onBeforeAdd === 'function') {
      const result = hooks.onBeforeAdd();
      if (result === false) return;
      if (result && typeof result === 'object') {
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

  function _handleEdit(row) {
    if (!canEdit) return;

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

  async function _handleDelete(row) {
    if (!canDelete) return;

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

    let extraArgs = [];
    if (entity === 'policy') {
      extraArgs = [row.policyHolderId || row.memberId];
    }

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

  function _refresh() {
    _renderContent();
  }

  function _setView(view) {
    _currentView = view;
    if (_viewToggle) _viewToggle.setView(view);
    _renderContent();
  }

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
export function initEntityListPages(configs = []) {
  return configs.map((cfg) => initEntityListPage(cfg));
}