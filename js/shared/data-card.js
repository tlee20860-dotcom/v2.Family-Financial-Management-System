// data-card.js — 通用卡片渲染（v103.0.20）
import { getEntityDef, getEntityUi } from '../entity/entity-definitions.js';
import { esc as escapeHtml } from '../lib/dom.js';
import { formatCellValue } from '../lib/format.js';

const LISTENER_KEY = '__dcClickListener';

export function renderDataCard(options) {
  const { container, entityKey, rows, options: extra = {}, hooks = {} } = options;
  const root = _resolveEl(container);
  if (!root) return null;

  const def = getEntityDef(entityKey);
  const customCols = extra.columns || extra.fields;
  const hasCustom = Array.isArray(customCols) && customCols.length > 0;
  if (!def && !hasCustom) return null;

  const effectiveDef = def || { fields: [] };
  const effectiveUi = def ? (getEntityUi(entityKey) || {}) : { canEdit: false, canDelete: false };
  const { gridClass = 'grid grid-3', resolvers = {} } = extra;

  const fieldMap = {};
  (effectiveDef.fields || []).forEach((f) => { fieldMap[f.id] = f; });

  const colMap = {};
  (customCols || []).forEach((c) => { colMap[c.id] = c; });

  const primaryColumn = effectiveUi.primaryColumn || null;
  const cardFields = effectiveUi.cardFields
    || (customCols ? customCols.slice(1, 4).map((c) => c.id) : (effectiveDef.fields || []).filter((f) => f.id !== primaryColumn).slice(0, 3).map((f) => f.id));

  const hasActions = (effectiveUi.canEdit !== false) || (effectiveUi.canDelete !== false);
  const _rows = typeof hooks.beforeRender === 'function' ? (hooks.beforeRender(rows) || rows) : rows;

  _paint();

  function _paint() {
    if (!_rows || _rows.length === 0) {
      _render(root, '<div class="glass-card"><div class="empty-state">尚無資料</div></div>');
      return;
    }
    const html = `<div class="${gridClass}" style="gap:12px;">${_rows.map((r, i) => _card(r, i)).join('')}</div>`;
    _render(root, html);
    _bind();
    if (typeof hooks.afterRender === 'function') hooks.afterRender(root);
  }

  function _card(row, i) {
    const header = typeof hooks.customHeader === 'function' ? (hooks.customHeader(row) || _defaultHeader(row)) : _defaultHeader(row);
    const body = typeof hooks.customBody === 'function' ? (hooks.customBody(row) || _defaultBody(row)) : _defaultBody(row);
    const footer = typeof hooks.customFooter === 'function' ? (hooks.customFooter(row) || _defaultFooter(row)) : _defaultFooter(row);
    return `<div class="glass-card data-card" data-row-index="${i}">${header}${body}${footer}</div>`;
  }

  function _defaultHeader(row) {
    const v = primaryColumn ? row[primaryColumn] : (row.name || '（未命名）');
    return `<div class="data-card-primary" style="font-size:15px;font-weight:700;color:var(--neon-cyan);margin-bottom:10px;word-break:break-word;">${escapeHtml(v || '（未命名）')}</div>`;
  }

  function _defaultBody(row) {
    if (!cardFields.length) return '';
    return `<div class="data-card-fields" style="display:flex;flex-direction:column;gap:6px;font-size:13px;">${cardFields.map((id) => {
      const field = fieldMap[id] || colMap[id];
      if (!field) return '';
      const val = row[id];
      const r = resolvers[id];
      const content = r ? r(val, row) : formatCellValue(val, field.type);
      return `<div class="data-card-field" style="display:flex;justify-content:space-between;gap:12px;"><span class="data-card-label" style="color:var(--text-muted);font-size:11px;flex-shrink:0;">${escapeHtml(field.label)}</span><span class="data-card-value" style="text-align:right;word-break:break-word;">${content}</span></div>`;
    }).join('')}</div>`;
  }

  function _defaultFooter(row) {
    if (!hasActions) return '';
    let h = '';
    if (typeof hooks.customActions === 'function') {
      h += (hooks.customActions(row) || []).map((a) => `<button type="button" class="btn btn-sm ${escapeHtml(a.className || 'btn-ghost')}" data-action="${escapeHtml(a.action || 'custom')}">${a.icon ? `<i data-lucide="${escapeHtml(a.icon)}" style="width:14px;height:14px;"></i>` : ''}${escapeHtml(a.label)}</button>`).join('');
    }
    if (effectiveUi.canEdit !== false) h += `<button type="button" class="btn btn-sm btn-ghost" data-action="edit"><i data-lucide="pencil" style="width:14px;height:14px;"></i> 編輯</button>`;
    if (effectiveUi.canDelete !== false) h += `<button type="button" class="btn btn-sm btn-danger" data-action="delete"><i data-lucide="trash-2" style="width:14px;height:14px;"></i> 刪除</button>`;
    return `<div class="data-card-footer" style="margin-top:12px;padding-top:12px;border-top:1px dashed rgba(255,255,255,0.08);display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;">${h}</div>`;
  }

  function _render(el, html) {
    if (el.__lastHtml === html) return;
    el.__lastHtml = html;
    el.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();
  }

  function _bind() {
    const old = root[LISTENER_KEY];
    if (old) root.removeEventListener('click', old);
    const listener = (e) => {
      const btn = e.target.closest('button[data-action]');
      if (btn) {
        const card = btn.closest('[data-row-index]');
        if (!card) return;
        const row = _rows[Number(card.dataset.rowIndex)];
        if (!row) return;
        const action = btn.dataset.action;
        if (typeof hooks.customActions === 'function') {
          const m = (hooks.customActions(row) || []).find((a) => (a.action || 'custom') === action);
          if (m?.onClick) { e.stopPropagation(); m.onClick(row); return; }
        }
        if (action === 'edit' && hooks.onEdit) { e.stopPropagation(); hooks.onEdit(row); return; }
        if (action === 'delete' && hooks.onDelete) { e.stopPropagation(); hooks.onDelete(row); return; }
        return;
      }
      const card = e.target.closest('.data-card[data-row-index]');
      if (card && hooks.onCardClick) hooks.onCardClick(_rows[Number(card.dataset.rowIndex)]);
    };
    root.addEventListener('click', listener);
    root[LISTENER_KEY] = listener;
  }

  return {
    container: root,
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

/* ═══════════════════════════════════════════
   END OF FILE
   File: js/shared/data-card.js
   Version: v103.0.20
   Batch: B22
   ═══════════════════════════════════════════ */