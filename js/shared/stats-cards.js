// ============================================
// stats-cards.js — 統計卡片渲染（v101.6 🆕）
// 位置：js/shared/stats-cards.js
// ============================================
// 職責：
//   統一渲染統計卡（橫排 N 卡）
//
// API 凍結：v101.6 發布後只加不改
// ============================================

import { escapeHtml } from '../core/utils.js';

/* ============================================
   主函式
   ============================================ */

/**
 * 渲染統計卡
 * @param {Object} options
 * @param {HTMLElement|string} options.container - 容器
 * @param {Array} options.cards - 卡片資料
 * @param {string} options.cards[].title - 標題
 * @param {string|number} options.cards[].value - 主數值
 * @param {string} [options.cards[].valueClass] - 數值顏色 class（emerald / magenta / cyan / red / orange）
 * @param {string} [options.cards[].hint] - 提示文字
 * @param {string} [options.cards[].icon] - Lucide icon
 * @param {number} [options.columns=3] - 每列卡片數（2 / 3 / 4）
 * @param {number} [options.mb=20] - 下方間距（px）
 * @returns {Object} { container, destroy }
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
    return { container: root, destroy: () => { root.innerHTML = ''; } };
  }

  const gridClass = `grid grid-${columns}`;

  root.innerHTML = `
    <div class="${gridClass}" style="margin-bottom:${mb}px;">
      ${cards.map((c) => _renderCard(c)).join('')}
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  return {
    container: root,
    destroy: () => { root.innerHTML = ''; },
  };
}

/* ============================================
   內部工具
   ============================================ */

function _renderCard(card) {
  const {
    title = '',
    value = '—',
    valueClass = '',
    hint = '',
    icon = '',
  } = card;

  const iconHtml = icon
    ? `<i data-lucide="${escapeHtml(icon)}" style="width:14px;height:14px;"></i>`
    : '';

  const titleHtml = iconHtml
    ? `<div class="glass-card-title" style="display:flex;align-items:center;gap:6px;">${iconHtml}<span>${escapeHtml(title)}</span></div>`
    : `<div class="glass-card-title">${escapeHtml(title)}</div>`;

  const hintHtml = hint
    ? `<div class="glass-card-hint">${escapeHtml(hint)}</div>`
    : '';

  return `
    <div class="glass-card">
      ${titleHtml}
      <div class="glass-card-value mono ${escapeHtml(valueClass)}">${_formatValue(value)}</div>
      ${hintHtml}
    </div>
  `;
}

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