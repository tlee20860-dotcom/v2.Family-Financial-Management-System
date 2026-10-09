// ============================================
// list-block.js — 列表區 Block（v103.0.0）
// 位置：js/blocks/list-block.js
// ============================================
// 職責：
//   1. 渲染表格 / 卡片兩種模式
//   2. 欄位從 column-registry 取得（SSOT）
//   3. 名稱解析走 entity-registry（SSOT）
//   4. 狀態顯示走 status-registry（SSOT）
//   5. 支援點擊 row / 編輯 / 刪除 callback（透過 ctx）
//
// Block 定義：
//   {
//     type: 'list',
//     container: 'xxx-list',
//     rows: '$.filtered',              // 表達式（必填）
//     columns: 'settlements',           // column-registry key
//     entityKey: 'policy',              // entity-registry key（卡片模式用）
//     tableId: 'settlements-table',     // 欄位設定儲存 key
//     view: 'table' | 'card',           // 選填；預設從 AppState.currentView
//     emptyText: '尚無資料',
//     expandable: true,
//     renderDetail: (row, ctx) => html, // 展開明細（選填）
//     actions: (row, ctx) => [ ... ],   // 自訂操作按鈕（選填）
//     onRowClick: (row, ctx) => void,   // 選填
//   }
// ============================================

import { esc } from '../lib/dom.js';
import { formatCellValue, formatHKD } from '../lib/format.js';
import { resolveExpr } from '../engines/render-engine.js';
import {
  getColumns,
  getResolvers,
} from '../config/column-registry.js';
import { getEntityUi } from '../entity/entity-definitions.js';
import { AppState } from '../core/state.js';
import { initViewToggle } from '../ui/view-toggle.js';

/* ============================================
   mount
   ============================================ */
export function mount(block, ctx) {
  const container = document.getElementById(block.container);
  if (!container) {
    console.warn(`[list-block] 找不到容器 #${block.container}`);
    return { onDepsChange: () => {}, destroy: () => {} };
  }

  /* ---------- 解析設定 ---------- */
  const columnsKey = typeof block.columns === 'string'
    ? block.columns
    : (block.columnsKey || '');

  const columns = _resolveColumns(block, columnsKey);
  const resolvers = columnsKey ? getResolvers(columnsKey) : {};

  const tableId = block.tableId || columnsKey || block.container;
  const expandable = !!block.expandable;
  const emptyText = block.emptyText || '尚無資料';

  const _expandedRows = new Set();
  let _listHandler = null;
  let _viewToggle = null;

  /* ---------- 首次渲染 ---------- */
  render();

  /* ---------- 事件綁定 ---------- */
  function bindEvents() {
    if (_listHandler) {
      container.removeEventListener('click', _listHandler);
    }

    _listHandler = (e) => {
      /* 展開 / 收合 */
      const expandBtn = e.target.closest('button[data-action="toggle-expand"]');
      if (expandBtn) {
        e.preventDefault();
        const idx = Number(expandBtn.dataset.index);
        if (_expandedRows.has(idx)) _expandedRows.delete(idx);
        else _expandedRows.add(idx);
        render();
        return;
      }

      /* 操作按鈕 */
      const actionBtn = e.target.closest('button[data-action][data-index]');
      if (actionBtn) {
        const action = actionBtn.dataset.action;
        if (action === 'toggle-expand') return;
        const idx = Number(actionBtn.dataset.index);
        const rows = _getRows(block, ctx);
        const row = rows[idx];
        if (!row) return;

        const actions = typeof block.actions === 'function'
          ? (block.actions(row, ctx) || [])
          : [];

        const matched = actions.find((a) => (a.action || '') === action);
        if (matched && typeof matched.onClick === 'function') {
          e.stopPropagation();
          matched.onClick(row, ctx);
          return;
        }
        return;
      }

      /* Row 點擊 */
      const tr = e.target.closest('tr[data-row-index]');
      if (tr && typeof block.onRowClick === 'function') {
        const idx = Number(tr.dataset.rowIndex);
        const rows = _getRows(block, ctx);
        const row = rows[idx];
        if (row) block.onRowClick(row, ctx);
      }
    };

    container.addEventListener('click', _listHandler);
  }

  /* ---------- 渲染 ---------- */
  function render() {
    const view = _resolveView(block, ctx);
    const rows = _getRows(block, ctx);

    if (!rows || rows.length === 0) {
      _renderEmpty(container, emptyText);
      return;
    }

    if (view === 'card') {
      _renderCards(container, block, ctx, rows, columns);
    } else {
      _renderTable(container, block, ctx, rows, columns, resolvers, tableId, expandable, _expandedRows);
    }

    bindEvents();

    if (window.lucide) window.lucide.createIcons();
  }

  function onDepsChange() {
    render();
  }

  function destroy() {
    if (_listHandler) {
      container.removeEventListener('click', _listHandler);
      _listHandler = null;
    }
    if (_viewToggle) {
      try { _viewToggle.destroy(); } catch (e) { /* noop */ }
      _viewToggle = null;
    }
    container.innerHTML = '';
    _expandedRows.clear();
  }

  return { onDepsChange, destroy };
}

/* ============================================
   渲染：表格
   ============================================ */
function _renderTable(container, block, ctx, rows, columns, resolvers, tableId, expandable, expandedRows) {
  const hasActions = typeof block.actions === 'function';

  const visibleCols = columns;

  const headerHtml = `
    <thead>
      <tr>
        ${expandable ? '<th class="expand-col" style="width:36px;"></th>' : ''}
        ${visibleCols.map((c) => `<th class="${c.type === 'number' ? 'num' : ''}">${esc(c.label)}</th>`).join('')}
        ${hasActions ? '<th style="width:160px;">操作</th>' : ''}
      </tr>
    </thead>
  `;

  const bodyHtml = rows.map((row, i) => {
    const mainRow = `
      <tr data-row-index="${i}">
        ${expandable ? `
          <td class="expand-col">
            <button type="button" class="btn btn-sm btn-ghost" data-action="toggle-expand" data-index="${i}" style="padding:2px 6px;">
              <i data-lucide="${expandedRows.has(i) ? 'chevron-down' : 'chevron-right'}" style="width:14px;height:14px;"></i>
            </button>
          </td>
        ` : ''}
        ${visibleCols.map((col) => _renderCell(col, row, resolvers)).join('')}
        ${hasActions ? _renderActionsCell(row, i, block, ctx) : ''}
      </tr>
    `;

    if (!expandable || typeof block.renderDetail !== 'function') {
      return mainRow;
    }

    const isExpanded = expandedRows.has(i);
    const totalCols = visibleCols.length + (expandable ? 1 : 0) + (hasActions ? 1 : 0);
    const detailRow = `
      <tr class="detail-row" style="display:${isExpanded ? 'table-row' : 'none'};">
        <td colspan="${totalCols}" class="detail-cell">
          ${block.renderDetail(row, ctx) || ''}
        </td>
      </tr>
    `;

    return mainRow + detailRow;
  }).join('');

  container.innerHTML = `
    <div class="data-table-scroll-wrapper">
      <table class="data-table">
        ${headerHtml}
        <tbody>${bodyHtml}</tbody>
      </table>
    </div>
  `;
}

function _renderCell(col, row, resolvers) {
  const val = row[col.id];
  const resolver = resolvers[col.id];
  const content = resolver
    ? resolver(val, row)
    : formatCellValue(val, col.type);

  const cls = col.type === 'number' ? 'num' : '';
  return `<td class="${cls}">${content}</td>`;
}

function _renderActionsCell(row, index, block, ctx) {
  const actions = typeof block.actions === 'function'
    ? (block.actions(row, ctx) || [])
    : [];

  if (actions.length === 0) return '<td></td>';

  return `
    <td>
      ${actions.map((a) => `
        <button type="button" class="btn btn-sm ${esc(a.className || 'btn-ghost')}"
                data-action="${esc(a.action || 'custom')}"
                data-index="${index}">
          ${a.icon ? `<i data-lucide="${esc(a.icon)}" style="width:14px;height:14px;"></i>` : ''}
          ${esc(a.label || '')}
        </button>
      `).join('')}
    </td>
  `;
}

/* ============================================
   渲染：卡片
   ============================================ */
function _renderCards(container, block, ctx, rows, columns) {
  const entityUi = block.entityKey ? getEntityUi(block.entityKey) : null;
  const primaryCol = entityUi?.primaryColumn || columns[0]?.id || 'name';
  const cardFields = entityUi?.cardFields || columns.slice(1, 4).map((c) => c.id);

  const resolvers = block.columnsKey ? getResolvers(block.columnsKey) : {};

  container.innerHTML = `
    <div class="data-cards-grid">
      ${rows.map((row, i) => _renderCard(row, i, primaryCol, cardFields, columns, resolvers, block, ctx)).join('')}
    </div>
  `;
}

function _renderCard(row, index, primaryCol, cardFields, columns, resolvers, block, ctx) {
  const primaryVal = row[primaryCol] || row.name || '（未命名）';
  const colMap = {};
  columns.forEach((c) => { colMap[c.id] = c; });

  const fieldsHtml = cardFields.map((id) => {
    const col = colMap[id];
    if (!col) return '';
    const val = row[id];
    const resolver = resolvers[id];
    const content = resolver ? resolver(val, row) : formatCellValue(val, col.type);
    return `
      <div class="data-card-field" style="display:flex; justify-content:space-between; gap:12px;">
        <span class="data-card-label" style="color:var(--text-muted); font-size:11px; flex-shrink:0;">
          ${esc(col.label)}
        </span>
        <span class="data-card-value" style="text-align:right; word-break:break-word;">
          ${content}
        </span>
      </div>
    `;
  }).join('');

  const actions = typeof block.actions === 'function'
    ? (block.actions(row, ctx) || [])
    : [];

  const actionsHtml = actions.length > 0
    ? `
      <div class="data-card-footer" style="margin-top:12px; padding-top:12px; border-top:1px dashed rgba(255,255,255,0.08); display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap;">
        ${actions.map((a) => `
          <button type="button" class="btn btn-sm ${esc(a.className || 'btn-ghost')}"
                  data-action="${esc(a.action || 'custom')}"
                  data-index="${index}">
            ${a.icon ? `<i data-lucide="${esc(a.icon)}" style="width:14px;height:14px;"></i>` : ''}
            ${esc(a.label || '')}
          </button>
        `).join('')}
      </div>
    `
    : '';

  return `
    <div class="glass-card data-card" data-row-index="${index}">
      <div class="data-card-primary" style="font-size:15px; font-weight:700; color:var(--neon-cyan); margin-bottom:10px; word-break:break-word;">
        ${esc(primaryVal)}
      </div>
      <div class="data-card-fields" style="display:flex; flex-direction:column; gap:6px; font-size:13px;">
        ${fieldsHtml}
      </div>
      ${actionsHtml}
    </div>
  `;
}

/* ============================================
   空狀態
   ============================================ */
function _renderEmpty(container, text) {
  container.innerHTML = `
    <div class="glass-card">
      <div class="empty-state">${esc(text)}</div>
    </div>
  `;
}

/* ============================================
   工具
   ============================================ */
function _getRows(block, ctx) {
  if (!block.rows) return [];
  if (typeof block.rows === 'string') {
    const resolved = resolveExpr(block.rows, ctx);
    return Array.isArray(resolved) ? resolved : [];
  }
  if (Array.isArray(block.rows)) return block.rows;
  return [];
}

function _resolveColumns(block, columnsKey) {
  if (Array.isArray(block.columns)) {
    return block.columns;
  }
  if (columnsKey) {
    return getColumns(columnsKey);
  }
  return [];
}

function _resolveView(block, ctx) {
  if (block.view === 'table' || block.view === 'card') return block.view;
  return AppState.getCurrentView() === 'card' ? 'card' : 'table';
}
