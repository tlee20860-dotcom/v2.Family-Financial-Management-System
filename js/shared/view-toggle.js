// ============================================
// view-toggle.js — 卡片 / 表格檢視切換（v101.7.2）
// 位置：js/shared/view-toggle.js
// ============================================
// v101.7.2 新增：
//   ✅ 切換時同步更新 AppState.currentView
//   ✅ 初始化時也同步一次（供 stats-cards 使用）
// ============================================

import { escapeHtml } from '../core/utils.js';
import { AppState } from '../core/state.js';

const PREFIX = 'fin_ui_view_';

/* ============================================
   主函式
   ============================================ */
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

  // 🆕 v101.7.2：初始化時同步 AppState
  AppState.setCurrentView(_currentView);

  // 渲染按鈕
  root.innerHTML = `
    <div class="view-toggle-group">
      <button type="button" class="btn btn-sm ${_currentView === 'card' ? 'btn-primary' : 'btn-ghost'}" data-view="card">${escapeHtml(cardText)}</button>
      <button type="button" class="btn btn-sm ${_currentView === 'table' ? 'btn-primary' : 'btn-ghost'}" data-view="table">${escapeHtml(tableText)}</button>
    </div>
  `;

  if (autoApply) applyViewToDom(_currentView);

  const clickHandler = (e) => {
    const btn = e.target.closest('button[data-view]');
    if (!btn) return;
    setView(btn.dataset.view);
  };
  root.addEventListener('click', clickHandler);

  if (window.lucide) window.lucide.createIcons();

  function setView(view) {
    if (view !== 'card' && view !== 'table') return;
    if (view === _currentView) return;

    _currentView = view;

    root.querySelectorAll('button[data-view]').forEach((btn) => {
      const isActive = btn.dataset.view === view;
      btn.classList.toggle('btn-primary', isActive);
      btn.classList.toggle('btn-ghost', !isActive);
    });

    try { localStorage.setItem(storageFullKey, view); } catch (e) { /* noop */ }

    if (autoApply) applyViewToDom(view);

    // 🆕 v101.7.2：同步更新 AppState（供 stats-cards 監聽）
    AppState.setCurrentView(view);

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
   工具函式
   ============================================ */
export function buildToggleHTML(config = {}) {
  const { cardText = '卡片模式', tableText = '表格模式', currentView = 'card' } = config;
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