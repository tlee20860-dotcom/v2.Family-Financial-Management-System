// ============================================
// stats-cards.js — 統計卡片渲染（v101.7.2）
// 位置：js/shared/stats-cards.js
// ============================================
// v101.7.2 新增：
//   ✅ 三種顯示模式：
//      - auto（預設）：手機緊湊 / 桌面跟隨 view-toggle
//      - integrated：整合卡（單卡內部分隔）
//      - compact：緊湊獨立卡（2x2 / 3 欄 / 4 欄）
//   ✅ 監聽 AppState 的 view-change 事件自動重繪
//   ✅ 支援 localStorage 儲存的模式設定
//
// 讀取設定：localStorage['fin_ui_stats_mode'] = 'auto' | 'integrated' | 'compact'
// ============================================

import { escapeHtml } from '../core/utils.js';
import { AppState } from '../core/state.js';
import { STORAGE_KEYS } from '../config/constants.js';

/* ============================================
   主函式
   ============================================ */

/**
 * 渲染統計卡
 * @param {Object} options
 * @param {HTMLElement|string} options.container - 容器
 * @param {Array} options.cards - 卡片資料
 * @param {number} [options.columns=3] - 每列卡片數（2 / 3 / 4）
 * @param {number} [options.mb=20] - 下方間距（px）
 * @returns {Object} { container, refresh, destroy }
 */
export function renderStatsCards(options) {
  const {
    container,
    cards = [],
    columns = 3,
    mb = 20,
  } = options;

  const root = _resolveElement(container);
  if (!root) {
    console.warn('⚠️ renderStatsCards: 找不到容器', container);
    return null;
  }

  if (!cards.length) {
    root.innerHTML = '';
    return { container: root, refresh: () => {}, destroy: () => { root.innerHTML = ''; } };
  }

  let _unsubViewChange = null;
  let _resizeHandler = null;

  function _render() {
    const mode = _getStatsMode();
    const displayMode = _resolveDisplayMode(mode);

    if (displayMode === 'C') {
      _renderIntegrated(root, cards, mb);
    } else {
      _renderCompact(root, cards, columns, mb);
    }

    if (window.lucide) window.lucide.createIcons();
  }

  function _renderCurrent() {
    _render();
  }

  // 初次渲染
  _render();

  // auto 模式：訂閱 view 變化 + 螢幕尺寸變化
  if (_getStatsMode() === 'auto') {
    _unsubViewChange = AppState.on('view-change', _render);

    // 螢幕尺寸變化也需重繪（桌面 ⇄ 手機）
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
  // 強制模式
  if (mode === 'integrated') return 'C';
  if (mode === 'compact') return 'B';

  // auto：手機 → B，桌面跟隨 view
  if (typeof window !== 'undefined' && window.innerWidth < 640) return 'B';
  return AppState.getCurrentView() === 'table' ? 'C' : 'B';
}

/* ============================================
   方案 C：整合卡
   ============================================ */
function _renderIntegrated(root, cards, mb) {
  root.innerHTML = `
    <div class="stats-integrated" style="margin-bottom:${mb}px;">
      <div class="stats-integrated-grid">
        ${cards.map((c) => _renderIntegratedCell(c)).join('')}
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
   方案 B：緊湊獨立卡
   ============================================ */
function _renderCompact(root, cards, columns, mb) {
  const cols = columns || 3;
  const count = cards.length;

  // 若卡片數 < columns，用實際數量
  const effectiveCols = Math.min(cols, count);

  root.innerHTML = `
    <div class="stats-compact-grid stats-compact-grid-${effectiveCols}" style="margin-bottom:${mb}px;">
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