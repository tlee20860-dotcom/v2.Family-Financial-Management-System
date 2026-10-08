// ============================================
// view-toggle.js — 卡片 / 表格檢視切換（v101.6.6）
// 位置：js/shared/view-toggle.js
// ============================================
// v101.6.6 修正：
//   ✅ [BUG-07] 內部 _applyView 改為呼叫 applyViewToDom（消除重複）
//   ✅ 保留所有 v101 功能
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
  if (autoApply) applyViewToDom(_currentView);

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

    // 🆕 v101.6.6：直接呼叫導出的 applyViewToDom（BUG-07 修正）
    if (autoApply) applyViewToDom(view);

    // 回呼
    if (typeof onChange === 'function') {
      try { onChange(view); } catch (err) { console.error('[view-toggle] onChange error:', err); }
    }
  }

  return {
    root,
    getView: () => _currentView,
    setView,
    refresh: () => {
      if (autoApply) applyViewToDom(_currentView);
      if (typeof onChange === 'function') onChange(_currentView);
    },
    destroy: () => {
      root.removeEventListener('click', clickHandler);
    },
  };
}

/* ============================================
   工具函式（可獨立使用）
   ============================================ */

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

export function getSavedView(storageKey, defaultView = 'card') {
  return _loadView(_fullKey(storageKey), defaultView);
}

export function saveView(storageKey, view) {
  try { localStorage.setItem(_fullKey(storageKey), view); } catch (e) { /* noop */ }
}

/**
 * 套用檢視到 DOM（SSOT：唯一的 DOM 套用邏輯）
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