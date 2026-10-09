// ============================================
// column-settings.js — 表格欄位設定（v103.0.11）
// 位置：js/shared/column-settings.js
// ============================================
// v103.0.11 修正：
//   ✅ [H04] escapeHtml 改從 lib/dom.js 導入
//   ✅ [H05] 改用 ui/modal.js 的 openModal / closeModal
// ============================================

import { buildColumnSettingsKey } from '../config/constants.js';
import { esc as escapeHtml } from '../lib/dom.js';
import { openModal, closeModal } from '../ui/modal.js';

/* ============================================
   主函式
   ============================================ */
export function initColumnSettings(options) {
  const {
    tableId,
    columns = [],
    defaultVisible,
  } = options;

  if (!tableId) throw new Error('initColumnSettings: tableId 為必填');
  if (!columns.length) throw new Error('initColumnSettings: columns 不可為空');

  const storageKey = buildColumnSettingsKey(tableId);

  const _defaultVisible = defaultVisible
    || columns.filter((c) => c.defaultVisible !== false).map((c) => c.id);
  const _defaultOrder = columns.map((c) => c.id);
  const _defaultWidths = {};
  columns.forEach((c) => {
    if (c.defaultWidth != null) _defaultWidths[c.id] = c.defaultWidth;
  });

  let _visible = [..._defaultVisible];
  let _order = [..._defaultOrder];
  let _widths = { ..._defaultWidths };

  _loadFromStorage();

  /* ============================================
     內部工具
     ============================================ */
  function _loadFromStorage() {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const data = JSON.parse(raw);

      if (Array.isArray(data.visible)) {
        _visible = data.visible.filter((id) => columns.some((c) => c.id === id));
        columns.forEach((c) => {
          if (c.defaultVisible !== false && !_visible.includes(c.id)) {
            _visible.push(c.id);
          }
        });
      }

      if (Array.isArray(data.order)) {
        const validOrder = data.order.filter((id) => columns.some((c) => c.id === id));
        columns.forEach((c) => {
          if (!validOrder.includes(c.id)) validOrder.push(c.id);
        });
        _order = validOrder;
      }

      if (data.widths && typeof data.widths === 'object') {
        _widths = { ..._defaultWidths, ...data.widths };
      }
    } catch (e) {
      console.warn('[column-settings] 讀取失敗：', e);
    }
  }

  function _saveToStorage() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        visible: _visible,
        order: _order,
        widths: _widths,
      }));
    } catch (e) {
      console.warn('[column-settings] 儲存失敗：', e);
    }
  }

  /* ============================================
     對外 API
     ============================================ */
  function getVisibleColumns() {
    return _order
      .filter((id) => _visible.includes(id))
      .map((id) => columns.find((c) => c.id === id))
      .filter(Boolean);
  }

  function getAllColumns() {
    return _order
      .map((id) => columns.find((c) => c.id === id))
      .filter(Boolean)
      .map((c) => ({
        ...c,
        visible: _visible.includes(c.id),
        width: _widths[c.id] ?? null,
      }));
  }

  function getWidth(columnId) {
    return _widths[columnId] ?? null;
  }

  function setVisible(ids) {
    _visible = ids.filter((id) => columns.some((c) => c.id === id));
    if (_visible.length === 0) {
      _visible = [_defaultOrder[0]];
    }
    _saveToStorage();
  }

  function setOrder(ids) {
    _order = ids.filter((id) => columns.some((c) => c.id === id));
    columns.forEach((c) => {
      if (!_order.includes(c.id)) _order.push(c.id);
    });
    _saveToStorage();
  }

  function setWidth(columnId, width) {
    if (width == null || width <= 0) {
      delete _widths[columnId];
    } else {
      _widths[columnId] = Number(width);
    }
    _saveToStorage();
  }

  function reset() {
    _visible = [..._defaultVisible];
    _order = [..._defaultOrder];
    _widths = { ..._defaultWidths };
    _saveToStorage();
  }

  function openPanel(options = {}) {
    _renderPanel(options.onChange);
  }

  /* ============================================
     設定面板渲染（改走 ui/modal.js）
     ============================================ */
  function _renderPanel(onChange) {
    const MODAL_ID = `column-settings-panel-${tableId}`;
    let overlay = document.getElementById(MODAL_ID);
    if (overlay) overlay.remove();

    overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = MODAL_ID;
    overlay.innerHTML = `
      <div class="modal" style="max-width:480px; max-height:90vh; overflow-y:auto;">
        <h2 class="modal-title">欄位設定</h2>
        <p style="font-size:12px; color:var(--text-muted); margin-bottom:16px;">
          勾選顯示、用 ↑↓ 調整順序、輸入寬度（px）
        </p>
        <div id="${MODAL_ID}-list"></div>
        <div class="modal-actions" style="margin-top:20px;">
          <button type="button" class="btn btn-ghost" data-action="reset">
            <i data-lucide="rotate-ccw" style="width:14px;height:14px;"></i> 重置
          </button>
          <button type="button" class="btn btn-ghost" data-action="cancel">取消</button>
          <button type="button" class="btn btn-primary" data-action="save">儲存</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const listEl = overlay.querySelector(`#${MODAL_ID}-list`);
    const tempState = getAllColumns().map((c) => ({ ...c }));

    function renderList() {
      listEl.innerHTML = tempState.map((c, i) => {
        const isFirst = i === 0;
        const isLast = i === tempState.length - 1;

        return `
          <div class="column-settings-row" data-id="${escapeHtml(c.id)}" data-index="${i}"
               style="display:flex; align-items:center; gap:8px; padding:10px 8px; border-bottom:1px solid rgba(255,255,255,0.05);">
            <div style="display:flex; flex-direction:column; gap:2px; flex-shrink:0;">
              <button type="button" class="btn btn-sm btn-ghost" data-role="move-up"
                      ${isFirst ? 'disabled' : ''}
                      style="padding:2px 6px; line-height:1; min-width:auto;">
                <i data-lucide="chevron-up" style="width:14px;height:14px;"></i>
              </button>
              <button type="button" class="btn btn-sm btn-ghost" data-role="move-down"
                      ${isLast ? 'disabled' : ''}
                      style="padding:2px 6px; line-height:1; min-width:auto;">
                <i data-lucide="chevron-down" style="width:14px;height:14px;"></i>
              </button>
            </div>
            <label style="display:flex; align-items:center; gap:8px; flex:1; cursor:pointer; min-width:0;">
              <input type="checkbox" data-role="visible" ${c.visible ? 'checked' : ''}
                     style="width:auto; cursor:pointer; flex-shrink:0;">
              <span style="font-size:13px; word-break:break-word;">${escapeHtml(c.label)}</span>
            </label>
            <input type="number" data-role="width" value="${c.width ?? ''}"
                   placeholder="自動" min="40" max="500" step="10"
                   style="width:70px; padding:4px 8px; font-size:12px; background:rgba(8,11,17,0.6); border:1px solid var(--glass-border); border-radius:var(--radius-sm); color:var(--text-primary); flex-shrink:0;">
            <span style="font-size:11px; color:var(--text-muted); flex-shrink:0;">px</span>
          </div>
        `;
      }).join('');

      if (window.lucide) window.lucide.createIcons();
    }

    renderList();

    listEl.addEventListener('change', (e) => {
      const checkbox = e.target.closest('input[data-role="visible"]');
      if (checkbox) {
        const row = checkbox.closest('.column-settings-row');
        const id = row.dataset.id;
        const item = tempState.find((c) => c.id === id);
        if (item) item.visible = checkbox.checked;
        return;
      }
      const widthInput = e.target.closest('input[data-role="width"]');
      if (widthInput) {
        const row = widthInput.closest('.column-settings-row');
        const id = row.dataset.id;
        const item = tempState.find((c) => c.id === id);
        if (item) item.width = widthInput.value ? Number(widthInput.value) : null;
      }
    });

    listEl.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-role]');
      if (!btn) return;

      const role = btn.dataset.role;
      const row = btn.closest('.column-settings-row');
      if (!row) return;

      const index = Number(row.dataset.index);
      if (isNaN(index)) return;

      if (role === 'move-up' && index > 0) {
        [tempState[index - 1], tempState[index]] = [tempState[index], tempState[index - 1]];
        renderList();
      } else if (role === 'move-down' && index < tempState.length - 1) {
        [tempState[index], tempState[index + 1]] = [tempState[index + 1], tempState[index]];
        renderList();
      }
    });

    overlay.addEventListener('click', (e) => {
      const btn = e.target.closest('.modal-actions button[data-action]');
      if (btn) {
        const action = btn.dataset.action;

        if (action === 'reset') {
          reset();
          tempState.length = 0;
          tempState.push(...getAllColumns());
          renderList();
          if (typeof onChange === 'function') onChange();
          return;
        }

        if (action === 'cancel') {
          closeModal(MODAL_ID);
          overlay.remove();
          return;
        }

        if (action === 'save') {
          setVisible(tempState.filter((c) => c.visible).map((c) => c.id));
          setOrder(tempState.map((c) => c.id));
          tempState.forEach((c) => setWidth(c.id, c.width));
          closeModal(MODAL_ID);
          overlay.remove();
          if (typeof onChange === 'function') onChange();
          return;
        }
      }

      if (e.target === overlay) {
        closeModal(MODAL_ID);
        overlay.remove();
      }
    });

    openModal(MODAL_ID);
    if (window.lucide) window.lucide.createIcons();
  }

  return {
    getVisibleColumns,
    getAllColumns,
    getWidth,
    setVisible,
    setOrder,
    setWidth,
    reset,
    openPanel,
  };
}