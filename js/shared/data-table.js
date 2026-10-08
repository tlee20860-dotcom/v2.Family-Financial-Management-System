// ============================================
// data-table.js — 通用表格渲染（v101.6.12）
// 位置：js/shared/data-table.js
// ============================================
// v101.6.12 修正：
//   ✅ [統一] 新增 mobileCardMode 參數（預設 false）
//       - false → 橫排表格（跟隨保險清單）
//       - true  → 手機自動卡片化（向後相容）
//   ✅ 新增 tableClass 自訂 class
//   ✅ 保留 v101.6.9 的 type="button" 與監聽器儲存機制
//
// API 凍結：v101.6 發布後只加不改
// ============================================

import { getEntityDef, getEntityUi } from '../config/entity-definitions.js';
import { escapeHtml, formatCellValue } from '../core/utils.js';
import { initColumnSettings } from './column-settings.js';

/* ============================================
   監聽器儲存 key（避免累積）
   ============================================ */
const LISTENER_KEY = '__dtClickListener';

/* ============================================
   主函式
   ============================================ */

export function renderDataTable(options) {
  const {
    container,
    entityKey,
    rows,
    tableId,
    options: extraOptions = {},
    hooks = {},
  } = options;

  const root = _resolveElement(container);
  if (!root) {
    console.warn('⚠️ renderDataTable: 找不到容器', container);
    return null;
  }

  const def = getEntityDef(entityKey);
  const customColumns = extraOptions.columns;
  const hasCustomColumns = Array.isArray(customColumns) && customColumns.length > 0;

  if (!def && !hasCustomColumns) {
    console.warn(`⚠️ renderDataTable: 找不到實體 ${entityKey}，且未提供自訂欄位`);
    return null;
  }

  const effectiveDef = def || { fields: [] };
  const effectiveUi = def
    ? (getEntityUi(entityKey) || {})
    : { canEdit: false, canDelete: false };

  const _tableId = tableId || entityKey;
  const {
    resolvers = {},
    // 🆕 v101.6.12：預設 false（橫排表格，跟隨保險清單）
    mobileCardMode = false,
    // 🆕 v101.6.12：額外自訂 class
    tableClass = '',
  } = extraOptions;

  // 🆕 v101.6.12：組合最終 table class
  const finalTableClass = [
    'data-table',
    mobileCardMode ? 'mobile-cards' : '',
    tableClass,
  ].filter(Boolean).join(' ');

  /* ============================================
     準備欄位定義
     ============================================ */
  const fieldMap = {};
  (effectiveDef.fields || []).forEach((f) => { fieldMap[f.id] = f; });

  let allColumns;
  if (hasCustomColumns) {
    allColumns = customColumns.map((c) => ({ ...c }));
  } else {
    const listCols = effectiveUi.listColumns || (effectiveDef.fields || []).map((f) => f.id);
    allColumns = listCols.map((id) => {
      const field = fieldMap[id];
      return {
        id,
        label: field?.label || id,
        type: field?.type || 'text',
        defaultVisible: true,
      };
    });
  }

  /* ============================================
     判斷是否需要操作欄位
     ============================================ */
  const hasBuiltinActions = (effectiveUi.canEdit !== false) || (effectiveUi.canDelete !== false);
  const hasCustomActions = typeof hooks.customActions === 'function';
  const shouldRenderActions = hasBuiltinActions || hasCustomActions;

  if (shouldRenderActions && !allColumns.some((c) => c.id === '__actions__')) {
    allColumns.push({
      id: '__actions__',
      label: '操作',
      type: 'actions',
      defaultVisible: true,
      defaultWidth: 180,
    });
  }

  /* ============================================
     初始化欄位設定
     ============================================ */
  const colSettings = initColumnSettings({
    tableId: _tableId,
    columns: allColumns,
  });

  /* ============================================
     渲染
     ============================================ */
  const _beforeRows = typeof hooks.beforeRender === 'function'
    ? (hooks.beforeRender(rows) || rows)
    : rows;

  _render();

  function _render() {
    const visibleCols = colSettings.getVisibleColumns();

    if (!_beforeRows || _beforeRows.length === 0) {
      _renderEmpty(root);
      return;
    }

    root.innerHTML = `
      <div class="data-table-header">
        <div class="data-table-header-left">
          <span class="text-muted" style="font-size:12px;">共 ${_beforeRows.length} 筆</span>
        </div>
        <div class="data-table-header-right">
          <button type="button" class="btn btn-sm btn-ghost" data-action="column-settings" title="欄位設定">
            <i data-lucide="columns" style="width:14px;height:14px;"></i>
            <span class="hide-mobile">欄位</span>
          </button>
        </div>
      </div>
      <div class="glass-card collapsible-card collapsible-card-flat" style="padding:0;">
        <div class="data-table-scroll-wrapper">
          <table class="${finalTableClass}">
            <thead>
              <tr>
                ${visibleCols.map((col) => _renderTh(col, colSettings)).join('')}
              </tr>
            </thead>
            <tbody>
              ${_beforeRows.map((row, i) => _renderRow(row, i, visibleCols)).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    _bindEvents();
    if (window.lucide) window.lucide.createIcons();
    if (typeof hooks.afterRender === 'function') hooks.afterRender(root);
  }

  /* ============================================
     thead / tbody 渲染
     ============================================ */
  function _renderTh(col, settings) {
    const width = settings.getWidth(col.id);
    const style = width ? `style="width:${width}px;"` : '';
    const cls = col.type === 'number' ? 'num' : '';
    return `<th class="${cls}" ${style}>${escapeHtml(col.label)}</th>`;
  }

  function _renderRow(row, index, visibleCols) {
    return `
      <tr data-row-index="${index}">
        ${visibleCols.map((col, colIdx) => _renderTd(col, row, colIdx === 0)).join('')}
      </tr>
    `;
  }

  function _renderTd(col, row, isFirst) {
    if (col.id === '__actions__') {
      return `<td data-label="操作">${_renderActions(col, row)}</td>`;
    }

    if (typeof hooks.customCellRender === 'function') {
      const custom = hooks.customCellRender(col, row);
      if (custom !== null && custom !== undefined) {
        return `<td data-label="${escapeHtml(col.label)}" ${isFirst ? 'data-primary="1"' : ''}>${custom}</td>`;
      }
    }

    const val = row[col.id];
    const resolver = resolvers[col.id];
    const content = resolver
      ? resolver(val, row)
      : formatCellValue(val, col.type);

    const cls = col.type === 'number' ? 'num' : '';
    const dataLabel = isFirst ? 'data-primary="1"' : `data-label="${escapeHtml(col.label)}"`;

    return `<td class="${cls}" ${dataLabel}>${content}</td>`;
  }

  function _renderActions(col, row) {
    let actionsHtml = '';

    if (typeof hooks.customActions === 'function') {
      const customActions = hooks.customActions(row) || [];
      actionsHtml += customActions.map((a) => `
        <button type="button" class="btn btn-sm ${escapeHtml(a.className || 'btn-ghost')}"
                data-action="${escapeHtml(a.action || 'custom')}">
          ${a.icon ? `<i data-lucide="${escapeHtml(a.icon)}" style="width:14px;height:14px;"></i>` : ''}
          ${escapeHtml(a.label)}
        </button>
      `).join('');
    }

    const ui = effectiveUi;
    if (ui.canEdit !== false) {
      actionsHtml += `<button type="button" class="btn btn-sm btn-ghost" data-action="edit">
        <i data-lucide="pencil" style="width:14px;height:14px;"></i> 編輯
      </button>`;
    }
    if (ui.canDelete !== false) {
      actionsHtml += `<button type="button" class="btn btn-sm btn-danger" data-action="delete">
        <i data-lucide="trash-2" style="width:14px;height:14px;"></i> 刪除
      </button>`;
    }

    return actionsHtml;
  }

  /* ============================================
     事件綁定
     ============================================ */
  function _bindEvents() {
    const oldListener = root[LISTENER_KEY];
    if (oldListener) {
      root.removeEventListener('click', oldListener);
      root[LISTENER_KEY] = null;
    }

    const listener = (e) => {
      const settingsBtn = e.target.closest('button[data-action="column-settings"]');
      if (settingsBtn) {
        colSettings.openPanel({
          onChange: () => _render(),
        });
        return;
      }

      const actionBtn = e.target.closest('button[data-action]');
      if (actionBtn) {
        const action = actionBtn.dataset.action;
        const tr = actionBtn.closest('tr');
        if (!tr) return;

        const index = Number(tr.dataset.rowIndex);
        const row = _beforeRows[index];
        if (!row) return;

        if (typeof hooks.customActions === 'function') {
          const customActions = hooks.customActions(row) || [];
          const matched = customActions.find((a) => (a.action || 'custom') === action);
          if (matched && typeof matched.onClick === 'function') {
            e.stopPropagation();
            matched.onClick(row);
            return;
          }
        }

        if (action === 'edit' && typeof hooks.onEdit === 'function') {
          e.stopPropagation();
          hooks.onEdit(row);
          return;
        }
        if (action === 'delete' && typeof hooks.onDelete === 'function') {
          e.stopPropagation();
          hooks.onDelete(row);
          return;
        }
        return;
      }

      const tr = e.target.closest('tr[data-row-index]');
      if (tr && typeof hooks.onRowClick === 'function') {
        const index = Number(tr.dataset.rowIndex);
        const row = _beforeRows[index];
        if (row) hooks.onRowClick(row);
      }
    };

    root.addEventListener('click', listener);
    root[LISTENER_KEY] = listener;
  }

  /* ============================================
     對外 API
     ============================================ */
  return {
    container: root,
    table: root.querySelector('table'),

    refresh: () => _render(),

    destroy: () => {
      const oldListener = root[LISTENER_KEY];
      if (oldListener) {
        root.removeEventListener('click', oldListener);
        root[LISTENER_KEY] = null;
      }
      root.innerHTML = '';
    },
  };
}

/* ============================================
   內部工具
   ============================================ */

function _resolveElement(target) {
  if (typeof target === 'string') return document.getElementById(target);
  if (target instanceof HTMLElement) return target;
  return null;
}

function _renderEmpty(root) {
  root.innerHTML = `
    <div class="glass-card">
      <div class="empty-state">尚無資料</div>
    </div>
  `;
}