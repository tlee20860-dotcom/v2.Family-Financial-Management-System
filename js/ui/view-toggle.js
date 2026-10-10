// ============================================
// view-toggle.js — 卡片 / 表格切換（v103.0.19）
// 位置：js/ui/view-toggle.js
// ============================================
// v103.0.19 修正：
//   ✅ 加 cardValue / tableValue 參數（支援自訂 view 值）
//   ✅ 向後相容：不傳參數時預設 'card' / 'table'
// ============================================

import { esc } from '../lib/dom.js';
import { AppState } from '../core/state.js';
import { STORAGE_PREFIXES } from '../config/constants.js';

export function initViewToggle(options) {
  const {
    containerId,
    storageKey,
    defaultView = 'card',
    cardText = '卡片模式',
    tableText = '表格模式',
    cardValue = 'card',
    tableValue = 'table',
    onChange,
    autoApply = true,
  } = options;

  const root = document.getElementById(containerId);
  if (!root) {
    console.warn(`⚠️ initViewToggle: 找不到容器 #${containerId}`);
    return null;
  }

  const storageFullKey = _fullKey(storageKey);
  const validValues = [cardValue, tableValue];
  let _currentView = _loadView(storageFullKey, defaultView, validValues);

  if (validValues.includes(_currentView)) {
    AppState.setCurrentView(_currentView);
  }

  root.innerHTML = `
    <div class="view-toggle-group">
      <button type="button" class="btn btn-sm ${_currentView === cardValue ? 'btn-primary' : 'btn-ghost'}" data-view="${esc(cardValue)}">${esc(cardText)}</button>
      <button type="button" class="btn btn-sm ${_currentView === tableValue ? 'btn-primary' : 'btn-ghost'}" data-view="${esc(tableValue)}">${esc(tableText)}</button>
    </div>
  `;

  if (autoApply) _applyIfStandard(_currentView);

  const clickHandler = (e) => {
    const btn = e.target.closest('button[data-view]');
    if (!btn) return;
    setView(btn.dataset.view);
  };
  root.addEventListener('click', clickHandler);

  if (window.lucide) window.lucide.createIcons();

  function setView(view) {
    if (!validValues.includes(view)) return;
    if (view === _currentView) return;

    _currentView = view;

    root.querySelectorAll('button[data-view]').forEach((btn) => {
      const isActive = btn.dataset.view === view;
      btn.classList.toggle('btn-primary', isActive);
      btn.classList.toggle('btn-ghost', !isActive);
    });

    try { localStorage.setItem(storageFullKey, view); } catch (e) { /* noop */ }

    if (autoApply) _applyIfStandard(view);
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
      if (autoApply) _applyIfStandard(_currentView);
      if (typeof onChange === 'function') onChange(_currentView);
    },
    destroy: () => {
      root.removeEventListener('click', clickHandler);
    },
  };
}

/**
 * 僅當 view 為標準 'card' / 'table' 時，才做 body class 切換
 */
function _applyIfStandard(view) {
  if (view === 'card' || view === 'table') applyViewToDom(view);
}

export function buildToggleHTML(config = {}) {
  const {
    cardText = '卡片模式',
    tableText = '表格模式',
    cardValue = 'card',
    tableValue = 'table',
    currentView = cardValue,
  } = config;
  return `
    <div class="view-toggle-group">
      <button type="button" class="btn btn-sm ${currentView === cardValue ? 'btn-primary' : 'btn-ghost'}" data-view="${esc(cardValue)}">${esc(cardText)}</button>
      <button type="button" class="btn btn-sm ${currentView === tableValue ? 'btn-primary' : 'btn-ghost'}" data-view="${esc(tableValue)}">${esc(tableText)}</button>
    </div>
  `;
}

export function getSavedView(storageKey, defaultView = 'card') {
  const valid = ['card', 'table'];
  return _loadView(_fullKey(storageKey), defaultView, valid);
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

function _fullKey(storageKey) {
  if (!storageKey) return `${STORAGE_PREFIXES.VIEW}default`;
  return storageKey.startsWith(STORAGE_PREFIXES.VIEW)
    ? storageKey
    : `${STORAGE_PREFIXES.VIEW}${storageKey}`;
}

function _loadView(fullKey, defaultValue, validValues) {
  try {
    const saved = localStorage.getItem(fullKey);
    if (validValues.includes(saved)) return saved;
  } catch (e) { /* noop */ }
  return defaultValue;
}

/* ═══════════════════════════════════════════
   END OF FILE
   File: js/ui/view-toggle.js
   Version: v103.0.19
   Batch: B20
   ═══════════════════════════════════════════ */