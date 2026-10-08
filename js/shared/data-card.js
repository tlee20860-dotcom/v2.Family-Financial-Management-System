// ============================================
// data-card.js — 通用卡片渲染（v101.6.6）
// 位置：js/shared/data-card.js
// ============================================
// v101.6.6 修正：
//   ✅ [BUG-11] 移除本地 _formatCell，改用 utils.formatCellValue（SSOT）
//
// API 凍結：v101.6 發布後只加不改
// ============================================

import { getEntityDef, getEntityUi } from '../config/entity-definitions.js';
import { escapeHtml, formatCellValue } from '../core/utils.js';

/* ============================================
   主函式
   ============================================ */

/**
 * 渲染資料卡片
 */
export function renderDataCard(options) {
  const {
    container,
    entityKey,
    rows,
    options: extraOptions = {},
    hooks = {},
  } = options;

  const root = _resolveElement(container);
  if (!root) {
    console.warn('⚠️ renderDataCard: 找不到容器', container);
    return null;
  }

  const def = getEntityDef(entityKey);
  const customFields = extraOptions.fields;
  const hasCustomFields = Array.isArray(customFields) && customFields.length > 0;

  if (!def && !hasCustomFields) {
    console.warn(`⚠️ renderDataCard: 找不到實體 ${entityKey}，且未提供自訂欄位`);
    return null;
  }

  const effectiveDef = def || { fields: [] };
  const effectiveUi = def
    ? (getEntityUi(entityKey) || {})
    : { canEdit: false, canDelete: false };

  const {
    gridClass = 'grid grid-3',
    resolvers = {},
  } = extraOptions;

  /* ============================================
     準備欄位定義
     ============================================ */
  const fieldMap = {};
  (effectiveDef.fields || []).forEach((f) => { fieldMap[f.id] = f; });

  const primaryColumn = effectiveUi.primaryColumn || null;
  const cardFields = effectiveUi.cardFields || (effectiveDef.fields || [])
    .filter((f) => f.id !== primaryColumn)
    .slice(0, 3)
    .map((f) => f.id);

  const hasActions = (effectiveUi.canEdit !== false) || (effectiveUi.canDelete !== false);

  /* ============================================
     渲染
     ============================================ */
  const _beforeRows = typeof hooks.beforeRender === 'function'
    ? (hooks.beforeRender(rows) || rows)
    : rows;

  _render();

  function _render() {
    if (!_beforeRows || _beforeRows.length === 0) {
      _renderEmpty(root);
      return;
    }

    root.innerHTML = `
      <div class="${gridClass}" style="gap:12px;">
        ${_beforeRows.map((row, i) => _renderCard(row, i)).join('')}
      </div>
    `;

    _bindEvents();
    if (window.lucide) window.lucide.createIcons();
    if (typeof hooks.afterRender === 'function') hooks.afterRender(root);
  }

  function _renderCard(row, index) {
    const headerHtml = typeof hooks.customHeader === 'function'
      ? (hooks.customHeader(row) || _defaultHeader(row))
      : _defaultHeader(row);

    const bodyHtml = typeof hooks.customBody === 'function'
      ? (hooks.customBody(row) || _defaultBody(row))
      : _defaultBody(row);

    const footerHtml = typeof hooks.customFooter === 'function'
      ? (hooks.customFooter(row) || _defaultFooter(row))
      : _defaultFooter(row);

    return `
      <div class="glass-card data-card" data-row-index="${index}">
        ${headerHtml}
        ${bodyHtml}
        ${footerHtml}
      </div>
    `;
  }

  function _defaultHeader(row) {
    const primaryValue = primaryColumn ? row[primaryColumn] : (row.name || '（未命名）');

    return `
      <div class="data-card-primary" style="font-size:15px; font-weight:700; color:var(--neon-cyan); margin-bottom:10px; word-break:break-word;">
        ${escapeHtml(primaryValue || '（未命名）')}
      </div>
    `;
  }

  function _defaultBody(row) {
    if (!cardFields.length) return '';

    return `
      <div class="data-card-fields" style="display:flex; flex-direction:column; gap:6px; font-size:13px;">
        ${cardFields.map((id) => {
          const field = fieldMap[id];
          if (!field) return '';
          const val = row[id];
          const resolver = resolvers[id];
          // 🆕 v101.6.6：使用 utils.formatCellValue（SSOT）
          const content = resolver
            ? resolver(val, row)
            : formatCellValue(val, field.type);
          return `
            <div class="data-card-field" style="display:flex; justify-content:space-between; gap:12px;">
              <span class="data-card-label" style="color:var(--text-muted); font-size:11px; flex-shrink:0;">
                ${escapeHtml(field.label)}
              </span>
              <span class="data-card-value" style="text-align:right; word-break:break-word;">
                ${content}
              </span>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function _defaultFooter(row) {
    if (!hasActions) return '';

    let actionsHtml = '';

    if (typeof hooks.customActions === 'function') {
      const customActions = hooks.customActions(row) || [];
      actionsHtml += customActions.map((a) => `
        <button class="btn btn-sm ${escapeHtml(a.className || 'btn-ghost')}"
                data-action="${escapeHtml(a.action || 'custom')}">
          ${a.icon ? `<i data-lucide="${escapeHtml(a.icon)}" style="width:14px;height:14px;"></i>` : ''}
          ${escapeHtml(a.label)}
        </button>
      `).join('');
    }

    if (effectiveUi.canEdit !== false) {
      actionsHtml += `<button class="btn btn-sm btn-ghost" data-action="edit">
        <i data-lucide="pencil" style="width:14px;height:14px;"></i> 編輯
      </button>`;
    }
    if (effectiveUi.canDelete !== false) {
      actionsHtml += `<button class="btn btn-sm btn-danger" data-action="delete">
        <i data-lucide="trash-2" style="width:14px;height:14px;"></i> 刪除
      </button>`;
    }

    return `
      <div class="data-card-footer" style="margin-top:12px; padding-top:12px; border-top:1px dashed rgba(255,255,255,0.08); display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap;">
        ${actionsHtml}
      </div>
    `;
  }

  /* ============================================
     事件綁定
     ============================================ */
  let _listener = null;

  function _bindEvents() {
    if (_listener) {
      root.removeEventListener('click', _listener);
    }

    _listener = (e) => {
      const actionBtn = e.target.closest('button[data-action]');
      if (actionBtn) {
        const action = actionBtn.dataset.action;
        const card = actionBtn.closest('[data-row-index]');
        if (!card) return;

        const index = Number(card.dataset.rowIndex);
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

      const card = e.target.closest('.data-card[data-row-index]');
      if (card && typeof hooks.onCardClick === 'function') {
        const index = Number(card.dataset.rowIndex);
        const row = _beforeRows[index];
        if (row) hooks.onCardClick(row);
      }
    };

    root.addEventListener('click', _listener);
  }

  /* ============================================
     對外 API
     ============================================ */
  return {
    container: root,

    refresh: () => _render(),

    destroy: () => {
      if (_listener) {
        root.removeEventListener('click', _listener);
        _listener = null;
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