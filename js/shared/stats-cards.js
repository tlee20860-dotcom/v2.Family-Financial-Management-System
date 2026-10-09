// ============================================
// stats-cards.js — 統計卡片渲染（v102.0.0）
// 位置：js/shared/stats-cards.js
// ============================================
// v102.0.0 新增：
//   ✅ options.customFirstCell（自訂第一格 HTML）
//       - 用於「家庭總餘額」摺疊展開卡片
//   ✅ 保留 v101.7.2 全部功能
// ============================================

import { escapeHtml } from '../core/utils.js';
import { AppState } from '../core/state.js';
import { STORAGE_KEYS } from '../config/constants.js';

/* ============================================
   主函式
   ============================================ */

export function renderStatsCards(options) {
  const {
    container,
    cards = [],
    columns = 3,
    mb = 20,
    customFirstCell = null,   // 🆕 v102.0.0
  } = options;

  const root = _resolveElement(container);
  if (!root) {
    console.warn('⚠️ renderStatsCards: 找不到容器', container);
    return null;
  }

  if (!cards.length && !customFirstCell) {
    root.innerHTML = '';
    return { container: root, refresh: () => {}, destroy: () => { root.innerHTML = ''; } };
  }

  let _unsubViewChange = null;
  let _resizeHandler = null;

  function _render() {
    const mode = _getStatsMode();
    const displayMode = _resolveDisplayMode(mode);

    if (displayMode === 'C') {
      _renderIntegrated(root, cards, mb, customFirstCell);
    } else {
      _renderCompact(root, cards, columns, mb, customFirstCell);
    }

    if (window.lucide) window.lucide.createIcons();
  }

  function _renderCurrent() {
    _render();
  }

  _render();

  if (_getStatsMode() === 'auto') {
    _unsubViewChange = AppState.on('view-change', _render);
    _resizeHandler = _debounce(() => _render(), 200);
    window.addEventListener('resize', _resizeHandler);
  }

  return {
    container: root,
    refresh: _renderCurrent,
    destroy: () => {
      if (_unsubViewChange) {
        try { _unsubViewChange(); } catch (e) { /* noop */ }
        _unsubViewChange = null;
      }
      if (_resizeHandler) {
        window.removeEventListener('resize', _resizeHandler);
        _resizeHandler = null;
      }
      root.innerHTML = '';
    },
  };
}

/* ============================================
   模式解析
   ============================================ */

function _getStatsMode() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.STATS_MODE);
    if (saved === 'integrated' || saved === 'compact' || saved === 'auto') return saved;
  } catch (e) { /* noop */ }
  return 'auto';
}

function _resolveDisplayMode(mode) {
  if (mode === 'integrated') return 'C';
  if (mode === 'compact') return 'B';
  if (typeof window !== 'undefined' && window.innerWidth < 640) return 'B';
  return AppState.getCurrentView() === 'table' ? 'C' : 'B';
}

/* ============================================
   方案 C：整合卡（🆕 v102.0.0：支援 customFirstCell）
   ============================================ */
function _renderIntegrated(root, cards, mb, customFirstCell) {
  const cellsHtml = [
    customFirstCell || '',
    ...cards.map((c) => _renderIntegratedCell(c)),
  ].join('');

  root.innerHTML = `
    <div class="stats-integrated" style="margin-bottom:${mb}px;">
      <div class="stats-integrated-grid">
        ${cellsHtml}
      </div>
    </div>
  `;
}

function _renderIntegratedCell(card) {
  const {
    title = '',
    value = '—',
    valueClass = '',
    hint = '',
    icon = '',
  } = card;

  const iconHtml = icon
    ? `<i data-lucide="${escapeHtml(icon)}" style="width:13px;height:13px;"></i>`
    : '';

  const titleHtml = iconHtml
    ? `<div class="stats-integrated-title">${iconHtml}<span>${escapeHtml(title)}</span></div>`
    : `<div class="stats-integrated-title"><span>${escapeHtml(title)}</span></div>`;

  const hintHtml = hint
    ? `<div class="stats-integrated-hint">${escapeHtml(hint)}</div>`
    : '';

  return `
    <div class="stats-integrated-cell">
      ${titleHtml}
      <div class="stats-integrated-value mono ${escapeHtml(valueClass)}">${_formatValue(value)}</div>
      ${hintHtml}
    </div>
  `;
}

/* ============================================
   方案 B：緊湊獨立卡（🆕 v102.0.0：支援 customFirstCell）
   ============================================ */
function _renderCompact(root, cards, columns, mb, customFirstCell) {
  const cols = columns || 3;
  const count = cards.length + (customFirstCell ? 1 : 0);

  const effectiveCols = Math.min(cols, count);

  const firstHtml = customFirstCell
    ? `<div class="glass-card stats-compact-card" style="grid-column: span 2;">${customFirstCell}</div>`
    : '';

  root.innerHTML = `
    <div class="stats-compact-grid stats-compact-grid-${effectiveCols}" style="margin-bottom:${mb}px;">
      ${firstHtml}
      ${cards.map((c) => _renderCompactCard(c)).join('')}
    </div>
  `;
}

function _renderCompactCard(card) {
  const {
    title = '',
    value = '—',
    valueClass = '',
    hint = '',
    icon = '',
  } = card;

  const iconHtml = icon
    ? `<i data-lucide="${escapeHtml(icon)}" style="width:12px;height:12px;"></i>`
    : '';

  const titleHtml = iconHtml
    ? `<div class="glass-card-title" style="display:flex;align-items:center;gap:4px;">${iconHtml}<span>${escapeHtml(title)}</span></div>`
    : `<div class="glass-card-title">${escapeHtml(title)}</div>`;

  const hintHtml = hint
    ? `<div class="glass-card-hint">${escapeHtml(hint)}</div>`
    : '';

  return `
    <div class="glass-card stats-compact-card">
      ${titleHtml}
      <div class="glass-card-value mono ${escapeHtml(valueClass)}">${_formatValue(value)}</div>
      ${hintHtml}
    </div>
  `;
}

/* ============================================
   內部工具
   ============================================ */
function _formatValue(value) {
  if (value == null) return '—';
  if (typeof value === 'string') return escapeHtml(value);
  return escapeHtml(String(value));
}

function _resolveElement(target) {
  if (typeof target === 'string') return document.getElementById(target);
  if (target instanceof HTMLElement) return target;
  return null;
}

function _debounce(fn, wait) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}