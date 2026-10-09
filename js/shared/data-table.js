// ============================================
// data-table.js — 通用表格渲染（v101.7.0）
// 位置：js/shared/data-table.js
// ============================================
// v103.0.2 修正：
//   ✅ 從 '../config/entity-definitions.js' 改為 '../entity/entity-definitions.js'
// ============================================

import { getEntityDef, getEntityUi } from '../entity/entity-definitions.js';
import { escapeHtml, formatCellValue } from '../core/utils.js';
import { initColumnSettings } from './column-settings.js';

const LISTENER_KEY = '__dtClickListener';
const COLLAPSE_STORAGE_PREFIX = 'fin_ui_collapse_';

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
    mobileCardMode = false,
    tableClass = '',
    expandable = false,
    renderDetail = null,
    collapsible = false,
    defaultCollapsed = false,
    headerActions = [],
    storageKey = _tableId,
  } = extraOptions;

  const finalTableClass = [
    'data-table',
    mobileCardMode ? 'mobile-cards' : '',
    tableClass,
  ].filter(Boolean).join(' ');

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

  const collapseKey = `${COLLAPSE_STORAGE_PREFIX}${storageKey}`;
  let _collapsed = false;
  if (collapsible) {
    try {
      const saved = localStorage.getItem(collapseKey);
      _collapsed = saved === null ? defaultCollapsed : saved === 'true';
    } catch (e) {
      _collapsed = defaultCollapsed;
    }
  }

  const _expandedRows = new Set();

  const colSettings = initColumnSettings({
    tableId: _tableId,
    columns: allColumns,
  });

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

    const totalCols = visibleCols.length + (expandable ? 1 : 0);

    const leftHtml = collapsible
      ? `<button type="button" class="btn btn-sm btn-ghost" data-action="toggle-collapse">
          <i data-lucide="${_collapsed ? 'chevron-right' : 'chevron-down'}" style="width:14px;height:14px;"></i>
          <span>共 ${_beforeRows.length} 筆</span>
        </button>`
      : `<span class="text-muted" style="font-size:12px;">共 ${_beforeRows.length} 筆</span>`;

    const headerActionsHtml = headerActions.map((a) => `
      <button type="button" class="btn btn-sm ${escapeHtml(a.className || 'btn-ghost')}"
              data-action="${escapeHtml(a.action)}">
        ${a.icon ? `<i data-lucide="${escapeHtml(a.icon)}" style="width:14px;height:14px;"></i>` : ''}
        <span>${escapeHtml(a.label)}</span>
      </button>
    `).join('');

    root.innerHTML = `
      <div class="data-table-header">
        <div class="data-table-header-left">
          ${leftHtml}
        </div>
        <div class="data-table-header-right">
          <button type="button" class="btn btn-sm btn-ghost" data-action="column-settings" title="欄位設定">
            <i data-lucide="columns" style="width:14px;height:14px;"></i>
            <span class="hide-mobile">欄位</span>
          </button>
          ${headerActionsHtml}
        </div>
      </div>
      <div class="data-table-body" style="display:${_collapsed ? 'none' : 'block'};">
        <div class="glass-card collapsible-card collapsible-card-flat" style="padding:0;">
          <div class="data-table-scroll-wrapper">
            <table class="${finalTableClass}">
              <thead>
                <tr>
                  ${expandable ? '<th class="expand-col" style="width:36px;"></th>' : ''}
                  ${visibleCols.map((col) => _renderTh(col, colSettings)).join('')}
                </tr>
              </thead>
              <tbody>
                ${_beforeRows.map((row, i) => _renderRowWithDetail(row, i, visibleCols, totalCols)).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    _bindEvents();
    if (window.lucide) window.lucide.createIcons();
    if (typeof hooks.afterRender === 'function') hooks.afterRender(root);
  }

  function _renderTh(col, settings) {
    const width = settings.getWidth(col.id);
    const style = width ? `style="width:${width}px;"` : '';
    const cls = col.type === 'number' ? 'num' : '';
    return `<th class="${cls}" ${style}>${escapeHtml(col.label)}</th>`;
  }

  function _renderRowWithDetail(row, index, visibleCols, totalCols) {
    const mainRow = `
      <tr data-row-index="${index}">
        ${expandable ? `
          <td class="expand-col">
            <button type="button" class="btn btn-sm btn-ghost" data-action="toggle-expand" data-index="${index}" style="padding:2px 6px;">
              <i data-lucide="${_expandedRows.has(index) ? 'chevron-down' : 'chevron-right'}" style="width:14px;height:14px;"></i>
            </button>
          </td>
        ` : ''}
        ${visibleCols.map((col, colIdx) => _renderTd(col, row, colIdx === 0)).join('')}
      </tr>
    `;

    if (!expandable || typeof renderDetail !== 'function') {
      return mainRow;
    }

    const isExpanded = _expandedRows.has(index);
    const detailRow = `
      <tr class="detail-row" data-detail-index="${index}" style="display:${isExpanded ? 'table-row' : 'none'};">
        <td colspan="${totalCols}" class="detail-cell">
          ${renderDetail(row)}
        </td>
      </tr>
    `;

    return mainRow + detailRow;
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
    const content = resolver ? resolver(val, row) : formatCellValue(val, col.type);

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

  function _bindEvents() {
    const oldListener = root[LISTENER_KEY];
    if (oldListener) {
      root.removeEventListener('click', oldListener);
      root[LISTENER_KEY] = null;
    }

    const listener = (e) => {
      const collapseBtn = e.target.closest('button[data-action="toggle-collapse"]');
      if (collapseBtn) {
        _collapsed = !_collapsed;
        try { localStorage.setItem(collapseKey, String(_collapsed)); } catch (err) {}
        _render();
        return;
      }

      const expandBtn = e.target.closest('button[data-action="toggle-expand"]');
      if (expandBtn) {
        const idx = Number(expandBtn.dataset.index);
        if (_expandedRows.has(idx)) _expandedRows.delete(idx);
        else _expandedRows.add(idx);
        _render();
        return;
      }

      const headerActionBtn = e.target.closest('.data-table-header-right button[data-action]');
      if (headerActionBtn) {
        const action = headerActionBtn.dataset.action;
        if (action === 'column-settings') {
          colSettings.openPanel({ onChange: () => _render() });
          return;
        }
        const matched = headerActions.find((a) => a.action === action);
        if (matched && typeof matched.onClick === 'function') {
          e.stopPropagation();
          matched.onClick();
          return;
        }
        return;
      }

      const actionBtn = e.target.closest('tbody button[data-action]');
      if (actionBtn) {
        const action = actionBtn.dataset.action;
        const tr = actionBtn.closest('tr[data-row-index]');
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