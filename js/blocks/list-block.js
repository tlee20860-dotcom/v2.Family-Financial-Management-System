// list-block.js — 列表區（v103.0.18）
import { esc } from '../lib/dom.js';
import { formatCellValue } from '../lib/format.js';
import { resolveExpr } from '../engines/render-engine.js';
import { getColumns, getResolvers } from '../config/column-registry.js';
import { getEntityUi } from '../entity/entity-definitions.js';
import { AppState } from '../core/state.js';

/* 🆕 就地更新：同 HTML 不重繪 */
function _render(container, html) {
  if (container.__lastHtml === html) return;
  container.__lastHtml = html;
  container.innerHTML = html;
  if (window.lucide) window.lucide.createIcons();
}

export function mount(block, ctx) {
  const container = document.getElementById(block.container);
  if (!container) return { onDepsChange: () => {}, destroy: () => {} };

  const columnsKey = typeof block.columns === 'string' ? block.columns : (block.columnsKey || '');
  const columns = _resolveColumns(block, columnsKey);
  const resolvers = columnsKey ? getResolvers(columnsKey) : {};
  const tableId = block.tableId || columnsKey || block.container;
  const expandable = !!block.expandable;
  const emptyText = block.emptyText || '尚無資料';
  const _expanded = new Set();
  let _handler = null;

  function render() {
    const view = _resolveView(block, ctx);
    const rows = _getRows(block, ctx);
    if (!rows || rows.length === 0) {
      _render(container, `<div class="glass-card"><div class="empty-state">${esc(emptyText)}</div></div>`);
      return;
    }
    const html = view === 'card'
      ? _renderCards(block, ctx, rows, columns, resolvers)
      : _renderTable(block, ctx, rows, columns, resolvers, _expanded);
    _render(container, html);
    _bind();
  }

  function _bind() {
    if (_handler) container.removeEventListener('click', _handler);
    _handler = (e) => {
      const expandBtn = e.target.closest('button[data-action="toggle-expand"]');
      if (expandBtn) {
        e.preventDefault();
        const idx = Number(expandBtn.dataset.index);
        _expanded.has(idx) ? _expanded.delete(idx) : _expanded.add(idx);
        render();
        return;
      }
      const actionBtn = e.target.closest('button[data-action][data-index]');
      if (actionBtn && actionBtn.dataset.action !== 'toggle-expand') {
        const idx = Number(actionBtn.dataset.index);
        const rows = _getRows(block, ctx);
        const row = rows[idx];
        if (!row) return;
        const actions = typeof block.actions === 'function' ? (block.actions(row, ctx) || []) : [];
        const matched = actions.find((a) => (a.action || '') === actionBtn.dataset.action);
        if (matched && typeof matched.onClick === 'function') {
          e.stopPropagation();
          matched.onClick(row, ctx);
        }
      }
    };
    container.addEventListener('click', _handler);
  }

  render();

  return {
    onDepsChange: render,
    destroy: () => {
      if (_handler) container.removeEventListener('click', _handler);
      container.innerHTML = '';
      container.__lastHtml = '';
      _expanded.clear();
    },
  };
}

function _renderTable(block, ctx, rows, columns, resolvers, expanded) {
  const hasActions = typeof block.actions === 'function';
  const expandable = !!block.expandable;
  const head = `<thead><tr>${expandable ? '<th class="expand-col" style="width:36px;"></th>' : ''}${columns.map((c) => `<th class="${c.type === 'number' ? 'num' : ''}">${esc(c.label)}</th>`).join('')}${hasActions ? '<th style="width:160px;">操作</th>' : ''}</tr></thead>`;
  const body = rows.map((row, i) => {
    const main = `<tr data-row-index="${i}">
      ${expandable ? `<td class="expand-col"><button type="button" class="btn btn-sm btn-ghost" data-action="toggle-expand" data-index="${i}" style="padding:2px 6px;"><i data-lucide="${expanded.has(i) ? 'chevron-down' : 'chevron-right'}" style="width:14px;height:14px;"></i></button></td>` : ''}
      ${columns.map((col) => _cell(col, row, resolvers)).join('')}
      ${hasActions ? _actions(row, i, block, ctx) : ''}
    </tr>`;
    if (!expandable || typeof block.renderDetail !== 'function') return main;
    const total = columns.length + (expandable ? 1 : 0) + (hasActions ? 1 : 0);
    return main + `<tr class="detail-row" style="display:${expanded.has(i) ? 'table-row' : 'none'};"><td colspan="${total}" class="detail-cell">${block.renderDetail(row, ctx) || ''}</td></tr>`;
  }).join('');
  return `<div class="data-table-scroll-wrapper"><table class="data-table">${head}<tbody>${body}</tbody></table></div>`;
}

function _cell(col, row, resolvers) {
  const val = row[col.id];
  const r = resolvers[col.id];
  const content = r ? r(val, row) : formatCellValue(val, col.type);
  return `<td class="${col.type === 'number' ? 'num' : ''}">${content}</td>`;
}

function _actions(row, i, block, ctx) {
  const actions = typeof block.actions === 'function' ? (block.actions(row, ctx) || []) : [];
  if (actions.length === 0) return '<td></td>';
  return `<td>${actions.map((a) => `<button type="button" class="btn btn-sm ${esc(a.className || 'btn-ghost')}" data-action="${esc(a.action || 'custom')}" data-index="${i}">${a.icon ? `<i data-lucide="${esc(a.icon)}" style="width:14px;height:14px;"></i>` : ''}${esc(a.label || '')}</button>`).join('')}</td>`;
}

function _renderCards(block, ctx, rows, columns, resolvers) {
  const entityUi = block.entityKey ? getEntityUi(block.entityKey) : null;
  const primaryCol = entityUi?.primaryColumn || columns[0]?.id || 'name';
  const cardFields = entityUi?.cardFields || columns.slice(1, 4).map((c) => c.id);
  const colMap = {};
  columns.forEach((c) => { colMap[c.id] = c; });
  const hasActions = typeof block.actions === 'function';
  return `<div class="data-cards-grid">${rows.map((row, i) => {
    const fields = cardFields.map((id) => {
      const col = colMap[id];
      if (!col) return '';
      const val = row[id];
      const r = resolvers[id];
      const content = r ? r(val, row) : formatCellValue(val, col.type);
      return `<div class="data-card-field"><span class="data-card-label">${esc(col.label)}</span><span class="data-card-value">${content}</span></div>`;
    }).join('');
    const actions = hasActions ? (block.actions(row, ctx) || []) : [];
    const actionsHtml = actions.length > 0
      ? `<div class="data-card-footer">${actions.map((a) => `<button type="button" class="btn btn-sm ${esc(a.className || 'btn-ghost')}" data-action="${esc(a.action || 'custom')}" data-index="${i}">${a.icon ? `<i data-lucide="${esc(a.icon)}" style="width:14px;height:14px;"></i>` : ''}${esc(a.label || '')}</button>`).join('')}</div>`
      : '';
    return `<div class="glass-card data-card" data-row-index="${i}"><div class="data-card-primary">${esc(row[primaryCol] || row.name || '（未命名）')}</div><div class="data-card-fields">${fields}</div>${actionsHtml}</div>`;
  }).join('')}</div>`;
}

function _getRows(block, ctx) {
  if (!block.rows) return [];
  if (typeof block.rows === 'string') {
    const r = resolveExpr(block.rows, ctx);
    return Array.isArray(r) ? r : [];
  }
  return Array.isArray(block.rows) ? block.rows : [];
}

function _resolveColumns(block, key) {
  if (Array.isArray(block.columns)) return block.columns;
  if (key) return getColumns(key);
  return [];
}

function _resolveView(block, ctx) {
  if (block.view === 'table' || block.view === 'card') return block.view;
  return AppState.getCurrentView() === 'card' ? 'card' : 'table';
}