// ============================================
// view-toggle.js — 卡片 / 表格檢視切換（v101）
// 位置：js/shared/view-toggle.js
// ============================================
// 用途：
//   全站列表頁支援「卡片模式 / 表格模式」切換
//   狀態存 localStorage，跨頁一致
//
// 用法：
//   const toggle = initViewToggle({
//     containerId: 'view-toggle-root',   // 或自訂容器
//     storageKey: 'personal-expenses-view',
//     defaultView: 'card',                // 'card' | 'table'
//     onChange: (view) => { ... },
//   });
//   toggle.getView();
//   toggle.setView('table');
//   toggle.destroy();
//
// 或者直接呼叫 buildToggleHTML() 產出按鈕 HTML，
//   再自己綁定事件：
//   <div class="view-toggle-group" id="xxx-toggle">
//     <button class="btn btn-sm btn-primary" data-view="card">卡片模式</button>
//     <button class="btn btn-sm btn-ghost" data-view="table">表格模式</button>
//   </div>
// ============================================

import { escapeHtml } from '../core/utils.js';

const PREFIX = 'fin_ui_view_';

/* ============================================
   主函式
   ============================================ */

/**
 * 初始化檢視切換
 * @param {Object} options
 * @param {string} options.containerId - 容器 ID（按鈕將注入此容器）
 * @param {string} options.storageKey - localStorage key（自動加前綴）
 * @param {'card'|'table'} [options.defaultView='card']
 * @param {string} [options.cardText='卡片模式']
 * @param {string} [options.tableText='表格模式']
 * @param {Function} [options.onChange] - 切換回呼 (view) => {}
 * @param {boolean} [options.autoApply=true] - 是否自動切換 .view-card-only / .view-table-only 顯示
 * @returns {Object|null}
 */
export function initViewToggle(options) {
  const {
    containerId,
    storageKey,
    defaultView = 'card',
    cardText = '卡片模式',
    tableText = '表格模式',
    onChange,
    autoApply = true,
  } = options;

  const root = document.getElementById(containerId);
  if (!root) {
    console.warn(`⚠️ initViewToggle: 找不到容器 #${containerId}`);
    return null;
  }

  const storageFullKey = _fullKey(storageKey);
  let _currentView = _loadView(storageFullKey, defaultView);

  // 渲染按鈕
  root.innerHTML = `
    <div class="view-toggle-group">
      <button type="button" class="btn btn-sm ${_currentView === 'card' ? 'btn-primary' : 'btn-ghost'}" data-view="card">${escapeHtml(cardText)}</button>
      <button type="button" class="btn btn-sm ${_currentView === 'table' ? 'btn-primary' : 'btn-ghost'}" data-view="table">${escapeHtml(tableText)}</button>
    </div>
  `;

  // 套用初始顯示
  if (autoApply) _applyView(_currentView);

  // 綁定點擊
  const clickHandler = (e) => {
    const btn = e.target.closest('button[data-view]');
    if (!btn) return;
    setView(btn.dataset.view);
  };
  root.addEventListener('click', clickHandler);

  if (window.lucide) window.lucide.createIcons();

  /* ============================================
     對外 API
     ============================================ */
  function setView(view) {
    if (view !== 'card' && view !== 'table') return;
    if (view === _currentView) return;

    _currentView = view;

    // 更新按鈕狀態
    root.querySelectorAll('button[data-view]').forEach((btn) => {
      const isActive = btn.dataset.view === view;
      btn.classList.toggle('btn-primary', isActive);
      btn.classList.toggle('btn-ghost', !isActive);
    });

    // 儲存
    try { localStorage.setItem(storageFullKey, view); } catch (e) { /* noop */ }

    // 套用顯示
    if (autoApply) _applyView(view);

    // 回呼
    if (typeof onChange === 'function') {
      try { onChange(view); } catch (err) { console.error('[view-toggle] onChange error:', err); }
    }
  }

  function _applyView(view) {
    // 全域套用：切換 <body> 的 class，讓 CSS 控制顯示
    document.body.classList.toggle('view-card-mode', view === 'card');
    document.body.classList.toggle('view-table-mode', view === 'table');

    // 個別套用：只切換容器內 .view-card-only / .view-table-only
    document.querySelectorAll('[data-view-card-only]').forEach((el) => {
      el.style.display = view === 'card' ? '' : 'none';
    });
    document.querySelectorAll('[data-view-table-only]').forEach((el) => {
      el.style.display = view === 'table' ? '' : 'none';
    });
  }

  return {
    root,
    getView: () => _currentView,
    setView,
    /**
     * 重新觸發 onChange（用於資料更新後重繪）
     */
    refresh: () => {
      if (autoApply) _applyView(_currentView);
      if (typeof onChange === 'function') onChange(_currentView);
    },
    /**
     * 銷毀
     */
    destroy: () => {
      root.removeEventListener('click', clickHandler);
    },
  };
}

/* ============================================
   工具函式（可獨立使用）
   ============================================ */

/**
 * 產生 toggle 按鈕的 HTML（若不想用 initViewToggle 的自動注入）
 * @param {Object} config
 * @returns {string}
 */
export function buildToggleHTML(config = {}) {
  const {
    cardText = '卡片模式',
    tableText = '表格模式',
    currentView = 'card',
  } = config;

  return `
    <div class="view-toggle-group">
      <button type="button" class="btn btn-sm ${currentView === 'card' ? 'btn-primary' : 'btn-ghost'}" data-view="card">${escapeHtml(cardText)}</button>
      <button type="button" class="btn btn-sm ${currentView === 'table' ? 'btn-primary' : 'btn-ghost'}" data-view="table">${escapeHtml(tableText)}</button>
    </div>
  `;
}

/**
 * 讀取已儲存的檢視（供外部查詢）
 * @param {string} storageKey
 * @param {'card'|'table'} [defaultView='card']
 * @returns {'card'|'table'}
 */
export function getSavedView(storageKey, defaultView = 'card') {
  return _loadView(_fullKey(storageKey), defaultView);
}

/**
 * 儲存檢視
 * @param {string} storageKey
 * @param {'card'|'table'} view
 */
export function saveView(storageKey, view) {
  try { localStorage.setItem(_fullKey(storageKey), view); } catch (e) { /* noop */ }
}

/**
 * 套用檢視到 DOM（若不想用 initViewToggle）
 * @param {'card'|'table'} view
 */
export function applyViewToDom(view) {
  document.body.classList.toggle('view-card-mode', view === 'card');
  document.body.classList.toggle('view-table-mode', view === 'table');

  document.querySelectorAll('[data-view-card-only]').forEach((el) => {
    el.style.display = view === 'card' ? '' : 'none';
  });
  document.querySelectorAll('[data-view-table-only]').forEach((el) => {
    el.style.display = view === 'table' ? '' : 'none';
  });
}

/* ============================================
   內部工具
   ============================================ */
function _fullKey(storageKey) {
  if (!storageKey) return `${PREFIX}default`;
  return storageKey.startsWith(PREFIX) ? storageKey : `${PREFIX}${storageKey}`;
}

function _loadView(fullKey, defaultView) {
  try {
    const saved = localStorage.getItem(fullKey);
    if (saved === 'card' || saved === 'table') return saved;
  } catch (e) { /* noop */ }
  return defaultView;
}