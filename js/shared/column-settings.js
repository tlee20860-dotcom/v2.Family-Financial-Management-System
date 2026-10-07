// ============================================
// column-settings.js — 表格欄位設定 SSOT（v101.6 🆕）
// 位置：js/shared/column-settings.js
// ============================================
// 職責：
//   1. 管理表格欄位的顯示 / 隱藏 / 排序 / 寬度
//   2. 儲存至 localStorage
//   3. 提供設定面板（勾選 / 拖曳 / 寬度）
//
// 儲存格式：
//   localStorage['fin_ui_columns_{tableId}'] = JSON.stringify({
//     visible: ['name', 'order'],
//     order: ['name', 'order'],
//     widths: { name: 200, order: 80 },
//   })
// ============================================

import { buildColumnSettingsKey } from '../config/constants.js';
import { escapeHtml } from '../core/utils.js';

/* ============================================
   主函式
   ============================================ */

/**
 * 初始化欄位設定
 * @param {Object} options
 * @param {string} options.tableId - 表格 ID（用於持久化）
 * @param {Array} options.columns - 所有可用欄位 [{ id, label, defaultVisible?, defaultWidth? }]
 * @param {string[]} [options.defaultVisible] - 預設可見欄位（若未提供，用 columns 的 defaultVisible）
 * @returns {Object} 設定 API
 */
export function initColumnSettings(options) {
  const {
    tableId,
    columns = [],
    defaultVisible,
  } = options;

  if (!tableId) throw new Error('initColumnSettings: tableId 為必填');
  if (!columns.length) throw new Error('initColumnSettings: columns 不可為空');

  const storageKey = buildColumnSettingsKey(tableId);

  // 計算預設值
  const _defaultVisible = defaultVisible
    || columns.filter((c) => c.defaultVisible !== false).map((c) => c.id);
  const _defaultOrder = columns.map((c) => c.id);
  const _defaultWidths = {};
  columns.forEach((c) => {
    if (c.defaultWidth != null) _defaultWidths[c.id] = c.defaultWidth;
  });

  // 當前狀態
  let _visible = [..._defaultVisible];
  let _order = [..._defaultOrder];
  let _widths = { ..._defaultWidths };

  // 從 localStorage 讀取
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
      }
      if (Array.isArray(data.order)) {
        const validOrder = data.order.filter((id) => columns.some((c) => c.id === id));
        // 補齊未包含的欄位
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

  /**
   * 取得目前可見的欄位（依 _order 排序）
   * @returns {Array}
   */
  function getVisibleColumns() {
    return _order
      .filter((id) => _visible.includes(id))
      .map((id) => columns.find((c) => c.id === id))
      .filter(Boolean);
  }

  /**
   * 取得所有欄位（依 _order 排序，含可見狀態）
   * @returns {Array}
   */
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

  /**
   * 取得欄位寬度
   */
  function getWidth(columnId) {
    return _widths[columnId] ?? null;
  }

  /**
   * 設定可見欄位
   */
  function setVisible(ids) {
    _visible = ids.filter((id) => columns.some((c) => c.id === id));
    // 至少保留一個
    if (_visible.length === 0) {
      _visible = [_defaultOrder[0]];
    }
    _saveToStorage();
  }

  /**
   * 設定欄位順序
   */
  function setOrder(ids) {
    _order = ids.filter((id) => columns.some((c) => c.id === id));
    // 補齊未包含的
    columns.forEach((c) => {
      if (!_order.includes(c.id)) _order.push(c.id);
    });
    _saveToStorage();
  }

  /**
   * 設定欄位寬度
   */
  function setWidth(columnId, width) {
    if (width == null || width <= 0) {
      delete _widths[columnId];
    } else {
      _widths[columnId] = Number(width);
    }
    _saveToStorage();
  }

  /**
   * 重置為預設
   */
  function reset() {
    _visible = [..._defaultVisible];
    _order = [..._defaultOrder];
    _widths = { ..._defaultWidths };
    _saveToStorage();
  }

  /**
   * 開啟設定面板
   * @param {Object} [options]
   * @param {Function} [options.onChange] - 變更回呼
   */
  function openPanel(options = {}) {
    _renderPanel(options.onChange);
  }

  /* ============================================
     設定面板渲染
     ============================================ */

  function _renderPanel(onChange) {
    const MODAL_ID = `column-settings-panel-${tableId}`;
    let overlay = document.getElementById(MODAL_ID);
    if (overlay) overlay.remove();

    overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.id = MODAL_ID;
    overlay.innerHTML = `
      <div class="modal" style="max-width:480px; max-height:90vh; overflow-y:auto;">
        <h2 class="modal-title">欄位設定</h2>
        <p style="font-size:12px; color:var(--text-muted); margin-bottom:16px;">
          勾選顯示、拖曳調整順序、輸入寬度（px）
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

    // 渲染欄位清單
    const listEl = overlay.querySelector(`#${MODAL_ID}-list`);
    const tempState = getAllColumns().map((c) => ({ ...c }));

    function renderList() {
      listEl.innerHTML = tempState.map((c, i) => `
        <div class="column-settings-row" data-id="${escapeHtml(c.id)}" data-index="${i}"
             style="display:flex; align-items:center; gap:10px; padding:10px 8px; border-bottom:1px solid rgba(255,255,255,0.05);"
             draggable="true">
          <i data-lucide="grip-vertical" style="width:16px;height:16px;color:var(--text-muted);cursor:grab;"></i>
          <label style="display:flex; align-items:center; gap:8px; flex:1; cursor:pointer;">
            <input type="checkbox" data-role="visible" ${c.visible ? 'checked' : ''}
                   style="width:auto; cursor:pointer;">
            <span style="font-size:13px;">${escapeHtml(c.label)}</span>
          </label>
          <input type="number" data-role="width" value="${c.width ?? ''}"
                 placeholder="自動" min="40" max="500" step="10"
                 style="width:80px; padding:4px 8px; font-size:12px; background:rgba(8,11,17,0.6); border:1px solid var(--glass-border); border-radius:var(--radius-sm); color:var(--text-primary);">
          <span style="font-size:11px; color:var(--text-muted);">px</span>
        </div>
      `).join('');

      if (window.lucide) window.lucide.createIcons();
    }

    renderList();

    /* ============================================
       事件：勾選可見
       ============================================ */
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

    /* ============================================
       事件：拖曳排序
       ============================================ */
    let _dragIndex = null;

    listEl.addEventListener('dragstart', (e) => {
      const row = e.target.closest('.column-settings-row');
      if (!row) return;
      _dragIndex = Number(row.dataset.index);
      row.style.opacity = '0.4';
    });

    listEl.addEventListener('dragend', (e) => {
      const row = e.target.closest('.column-settings-row');
      if (row) row.style.opacity = '1';
    });

    listEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      const row = e.target.closest('.column-settings-row');
      if (!row) return;
      row.style.borderTop = '2px solid var(--neon-cyan)';
    });

    listEl.addEventListener('dragleave', (e) => {
      const row = e.target.closest('.column-settings-row');
      if (row) row.style.borderTop = '';
    });

    listEl.addEventListener('drop', (e) => {
      e.preventDefault();
      const row = e.target.closest('.column-settings-row');
      if (!row) return;
      row.style.borderTop = '';
      const dropIndex = Number(row.dataset.index);
      if (_dragIndex == null || _dragIndex === dropIndex) return;

      const [moved] = tempState.splice(_dragIndex, 1);
      tempState.splice(dropIndex, 0, moved);
      _dragIndex = null;
      renderList();
    });

    /* ============================================
       事件：按鈕
       ============================================ */
    overlay.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
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
          overlay.remove();
          return;
        }

        if (action === 'save') {
          setVisible(tempState.filter((c) => c.visible).map((c) => c.id));
          setOrder(tempState.map((c) => c.id));
          tempState.forEach((c) => setWidth(c.id, c.width));
          overlay.remove();
          if (typeof onChange === 'function') onChange();
          return;
        }
      }

      if (e.target === overlay) {
        overlay.remove();
      }
    });
  }

  /* ============================================
     回傳 API
     ============================================ */
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