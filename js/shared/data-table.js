// data-table.js — 通用表格渲染（v103.0.18）
import { getEntityDef, getEntityUi } from '../entity/entity-definitions.js';
import { esc as escapeHtml } from '../lib/dom.js';
import { formatCellValue } from '../lib/format.js';
import { initColumnSettings } from './column-settings.js';

const LISTENER_KEY = '__dtClickListener';
const COLLAPSE_PREFIX = 'fin_ui_collapse_';

function _render(root, html) {
  if (root.__lastHtml === html) return false;
  root.__lastHtml = html;
  root.innerHTML = html;
  if (window.lucide) window.lucide.createIcons();
  return true;
}

export function renderDataTable(options) {
  const { container, entityKey, rows, tableId, options: extra = {}, hooks = {} } = options;
  const root = _resolveEl(container);
  if (!root) return null;

  const def = getEntityDef(entityKey);
  const customCols = extra.columns;
  const hasCustom = Array.isArray(customCols) && customCols.length > 0;
  if (!def && !hasCustom) return null;

  const effectiveDef = def || { fields: [] };
  const effectiveUi = def ? (getEntityUi(entityKey) || {}) : { canEdit: false, canDelete: false };
  const _tableId = tableId || entityKey;
  const {
    resolvers = {}, mobileCardMode = false, tableClass = '',
    expandable = false, renderDetail = null,
    collapsible = false, defaultCollapsed = false,
    headerActions = [], storageKey = _tableId,
  } = extra;

  const finalClass = ['data-table', mobileCardMode ? 'mobile-cards' : '', tableClass].filter(Boolean).join(' ');
  const fieldMap = {};
  (effectiveDef.fields || []).forEach((f) => { fieldMap[f.id] = f; });

  let allCols;
  if (hasCustom) allCols = customCols.map((c) => ({ ...c }));
  else {
    const listCols = effectiveUi.listColumns || (effectiveDef.fields || []).map((f) => f.id);
    allCols = listCols.map((id) => {
      const f = fieldMap[id];
      return { id, label: f?.label || id, type: f?.type || 'text', defaultVisible: true };
    });
  }

  const hasBuiltin = (effectiveUi.canEdit !== false) || (effectiveUi.canDelete !== false);
  const hasCustomActions = typeof hooks.customActions === 'function';
  const shouldActions = hasBuiltin || hasCustomActions;
  if (shouldActions && !allCols.some((c) => c.id === '__actions__')) {
    allCols.push({ id: '__actions__', label: '操作', type: 'actions', defaultVisible: true, defaultWidth: 180 });
  }

  const collapseKey = `${COLLAPSE_PREFIX}${storageKey}`;
  let _collapsed = false;
  if (collapsible) {
    try { const s = localStorage.getItem(collapseKey); _collapsed = s === null ? defaultCollapsed : s === 'true'; } catch (e) {}
  }

  const _expanded = new Set();
  const colSettings = initColumnSettings({ tableId: _tableId, columns: allCols });
  const _rows = typeof hooks.beforeRender === 'function' ? (hooks.beforeRender(rows) || rows) : rows;

  _paint();

  function _paint() {
    const visible = colSettings.getVisibleColumns();
    if (!_rows || _rows.length === 0) {
      _render(root, `<div class="glass-card"><div class="empty-state">尚無資料</div></div>`);
      _bind();
      return;
    }
    const total = visible.length + (expandable ? 1 : 0);
    const left = collapsible
      ? `<button type="button" class="btn btn-sm btn-ghost" data-action="toggle-collapse"><i data-lucide="${_collapsed ? 'chevron-right' : 'chevron-down'}" style="width:14px;height:14px;"></i><span>共 ${_rows.length} 筆</span></button>`
      : `<span class="text-muted" style="font-size:12px;">共 ${_rows.length} 筆</span>`;
    const headerActionsHtml = headerActions.map((a) => `<button type="button" class="btn btn-sm ${escapeHtml(a.className || 'btn-ghost')}" data-action="${escapeHtml(a.action)}">${a.icon ? `<i data-lucide="${escapeHtml(a.icon)}" style="width:14px;height:14px;"></i>` : ''}<span>${escapeHtml(a.label)}</span></button>`).join('');
    const head = `<thead><tr>${expandable ? '<th class="expand-col" style="width:36px;"></th>' : ''}${visible.map((c) => {
      const w = colSettings.getWidth(c.id);
      return `<th class="${c.type === 'number' ? 'num' : ''}" ${w ? `style="width:${w}px;"` : ''}>${escapeHtml(c.label)}</th>`;
    }).join('')}</tr></thead>`;
    const body = _rows.map((row, i) => _rowHtml(row, i, visible, total)).join('');
    const html = `<div class="data-table-header"><div class="data-table-header-left">${left}</div><div class="data-table-header-right"><button type="button" class="btn btn-sm btn-ghost" data-action="column-settings" title="欄位設定"><i data-lucide="columns" style="width:14px;height:14px;"></i><span class="hide-mobile">欄位</span></button>${headerActionsHtml}</div></div><div class="data-table-body" style="display:${_collapsed ? 'none' : 'block'};"><div class="glass-card collapsible-card collapsible-card-flat" style="padding:0;"><div class="data-table-scroll-wrapper"><table class="${finalClass}">${head}<tbody>${body}</tbody></table></div></div></div>`;
    _render(root, html);
    _bind();
    if (typeof hooks.afterRender === 'function') hooks.afterRender(root);
  }

  function _rowHtml(row, i, visible, total) {
    const main = `<tr data-row-index="${i}">${expandable ? `<td class="expand-col"><button type="button" class="btn btn-sm btn-ghost" data-action="toggle-expand" data-index="${i}" style="padding:2px 6px;"><i data-lucide="${_expanded.has(i) ? 'chevron-down' : 'chevron-right'}" style="width:14px;height:14px;"></i></button></td>` : ''}${visible.map((c, ci) => _cell(c, row, ci === 0)).join('')}</tr>`;
    if (!expandable || typeof renderDetail !== 'function') return main;
    return main + `<tr class="detail-row" data-detail-index="${i}" style="display:${_expanded.has(i) ? 'table-row' : 'none'};"><td colspan="${total}" class="detail-cell">${renderDetail(row)}</td></tr>`;
  }

  function _cell(col, row, isFirst) {
    if (col.id === '__actions__') return `<td data-label="操作">${_actions(col, row)}</td>`;
    if (typeof hooks.customCellRender === 'function') {
      const c = hooks.customCellRender(col, row);
      if (c !== null && c !== undefined) return `<td data-label="${escapeHtml(col.label)}" ${isFirst ? 'data-primary="1"' : ''}>${c}</td>`;
    }
    const val = row[col.id];
    const r = resolvers[col.id];
    const content = r ? r(val, row) : formatCellValue(val, col.type);
    return `<td class="${col.type === 'number' ? 'num' : ''}" ${isFirst ? 'data-primary="1"' : `data-label="${escapeHtml(col.label)}"`}>${content}</td>`;
  }

  function _actions(col, row) {
    let h = '';
    if (typeof hooks.customActions === 'function') {
      h += (hooks.customActions(row) || []).map((a) => `<button type="button" class="btn btn-sm ${escapeHtml(a.className || 'btn-ghost')}" data-action="${escapeHtml(a.action || 'custom')}">${a.icon ? `<i data-lucide="${escapeHtml(a.icon)}" style="width:14px;height:14px;"></i>` : ''}${escapeHtml(a.label)}</button>`).join('');
    }
    if (effectiveUi.canEdit !== false) h += `<button type="button" class="btn btn-sm btn-ghost" data-action="edit"><i data-lucide="pencil" style="width:14px;height:14px;"></i> 編輯</button>`;
    if (effectiveUi.canDelete !== false) h += `<button type="button" class="btn btn-sm btn-danger" data-action="delete"><i data-lucide="trash-2" style="width:14px;height:14px;"></i> 刪除</button>`;
    return h;
  }

  function _bind() {
    const old = root[LISTENER_KEY];
    if (old) root.removeEventListener('click', old);
    const listener = (e) => {
      const colBtn = e.target.closest('button[data-action="toggle-collapse"]');
      if (colBtn) { _collapsed = !_collapsed; try { localStorage.setItem(collapseKey, String(_collapsed)); } catch (err) {} _paint(); return; }
      const expBtn = e.target.closest('button[data-action="toggle-expand"]');
      if (expBtn) { const i = Number(expBtn.dataset.index); _expanded.has(i) ? _expanded.delete(i) : _expanded.add(i); _paint(); return; }
      const hBtn = e.target.closest('.data-table-header-right button[data-action]');
      if (hBtn) {
        const a = hBtn.dataset.action;
        if (a === 'column-settings') { colSettings.openPanel({ onChange: _paint }); return; }
        const m = headerActions.find((x) => x.action === a);
        if (m?.onClick) { e.stopPropagation(); m.onClick(); return; }
        return;
      }
      const actBtn = e.target.closest('tbody button[data-action]');
      if (actBtn) {
        const a = actBtn.dataset.action;
        const tr = actBtn.closest('tr[data-row-index]');
        if (!tr) return;
        const row = _rows[Number(tr.dataset.rowIndex)];
        if (!row) return;
        if (typeof hooks.customActions === 'function') {
          const m = (hooks.customActions(row) || []).find((x) => (x.action || 'custom') === a);
          if (m?.onClick) { e.stopPropagation(); m.onClick(row); return; }
        }
        if (a === 'edit' && hooks.onEdit) { e.stopPropagation(); hooks.onEdit(row); return; }
        if (a === 'delete' && hooks.onDelete) { e.stopPropagation(); hooks.onDelete(row); return; }
        return;
      }
      const tr = e.target.closest('tr[data-row-index]');
      if (tr && hooks.onRowClick) hooks.onRowClick(_rows[Number(tr.dataset.rowIndex)]);
    };
    root.addEventListener('click', listener);
    root[LISTENER_KEY] = listener;
  }

  return {
    container: root,
    table: root.querySelector('table'),
    refresh: _paint,
    destroy: () => {
      const old = root[LISTENER_KEY];
      if (old) root.removeEventListener('click', old);
      root.innerHTML = '';
      root.__lastHtml = '';
    },
  };
}

function _resolveEl(t) {
  if (typeof t === 'string') return document.getElementById(t);
  if (t instanceof HTMLElement) return t;
  return null;
}