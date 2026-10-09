// ============================================
// stats-block.js — 統計卡區 Block（v103.0.0）
// 位置：js/blocks/stats-block.js
// ============================================
// 職責：
//   1. 渲染統計卡網格（整合 C / 緊湊 B 兩種模式）
//   2. 卡片值可為表達式（$.xxx / state.xxx）
//   3. 依 STORAGE_KEYS.STATS_MODE 決定顯示模式
//
// Block 定義：
//   {
//     type: 'stats',
//     container: 'xxx-stats',
//     cards: [ { title, value, valueClass, hint, icon }, ... ],
//     mode: 'auto' | 'integrated' | 'compact',   // 選填，預設 auto
//   }
// ============================================

import { esc } from '../lib/dom.js';
import { resolveExpr } from '../engines/render-engine.js';
import { AppState } from '../core/state.js';
import { STORAGE_KEYS } from '../config/constants.js';

/* ============================================
   mount
   ============================================ */
export function mount(block, ctx) {
  const container = document.getElementById(block.container);
  if (!container) {
    console.warn(`[stats-block] 找不到容器 #${block.container}`);
    return { onDepsChange: () => {}, destroy: () => {} };
  }

  let _unsubViewChange = null;
  let _resizeHandler = null;

  function render() {
    const mode = block.mode || _getStatsMode();
    const displayMode = _resolveDisplayMode(mode);

    if (displayMode === 'C') {
      _renderIntegrated(container, block, ctx);
    } else {
      _renderCompact(container, block, ctx);
    }

    if (window.lucide) window.lucide.createIcons();
  }

  function onDepsChange() {
    render();
  }

  /* 首次渲染 */
  render();

  /* auto 模式：監聽 view-change + resize */
  if ((block.mode || _getStatsMode()) === 'auto') {
    _unsubViewChange = AppState.on('view-change', render);
    _resizeHandler = _debounce(render, 200);
    window.addEventListener('resize', _resizeHandler);
  }

  function destroy() {
    if (_unsubViewChange) {
      try { _unsubViewChange(); } catch (e) { /* noop */ }
      _unsubViewChange = null;
    }
    if (_resizeHandler) {
      window.removeEventListener('resize', _resizeHandler);
      _resizeHandler = null;
    }
    container.innerHTML = '';
  }

  return { onDepsChange, destroy };
}

/* ============================================
   渲染：整合卡（C）
   ============================================ */
function _renderIntegrated(container, block, ctx) {
  const cards = _resolveCards(block, ctx);
  if (cards.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <div class="stats-integrated" style="margin-bottom:20px;">
      <div class="stats-integrated-grid">
        ${cards.map((c) => _renderIntegratedCell(c)).join('')}
      </div>
    </div>
  `;
}

function _renderIntegratedCell(card) {
  const iconHtml = card.icon
    ? `<i data-lucide="${esc(card.icon)}" style="width:13px;height:13px;"></i>`
    : '';

  const titleHtml = iconHtml
    ? `<div class="stats-integrated-title">${iconHtml}<span>${esc(card.title || '')}</span></div>`
    : `<div class="stats-integrated-title"><span>${esc(card.title || '')}</span></div>`;

  const hintHtml = card.hint
    ? `<div class="stats-integrated-hint">${esc(card.hint)}</div>`
    : '';

  const valueCls = card.valueClass || '';
  const valueHtml = card.value == null ? '—' : esc(String(card.value));

  return `
    <div class="stats-integrated-cell">
      ${titleHtml}
      <div class="stats-integrated-value mono ${esc(valueCls)}">${valueHtml}</div>
      ${hintHtml}
    </div>
  `;
}

/* ============================================
   渲染：緊湊卡（B）
   ============================================ */
function _renderCompact(container, block, ctx) {
  const cards = _resolveCards(block, ctx);
  if (cards.length === 0) {
    container.innerHTML = '';
    return;
  }

  const cols = Math.min(4, Math.max(2, cards.length));

  container.innerHTML = `
    <div class="stats-compact-grid stats-compact-grid-${cols}" style="margin-bottom:20px;">
      ${cards.map((c) => _renderCompactCard(c)).join('')}
    </div>
  `;
}

function _renderCompactCard(card) {
  const iconHtml = card.icon
    ? `<i data-lucide="${esc(card.icon)}" style="width:12px;height:12px;"></i>`
    : '';

  const titleHtml = iconHtml
    ? `<div class="glass-card-title" style="display:flex;align-items:center;gap:4px;">${iconHtml}<span>${esc(card.title || '')}</span></div>`
    : `<div class="glass-card-title">${esc(card.title || '')}</div>`;

  const hintHtml = card.hint
    ? `<div class="glass-card-hint">${esc(card.hint)}</div>`
    : '';

  const valueCls = card.valueClass || '';
  const valueHtml = card.value == null ? '—' : esc(String(card.value));

  return `
    <div class="glass-card stats-compact-card">
      ${titleHtml}
      <div class="glass-card-value mono ${esc(valueCls)}">${valueHtml}</div>
      ${hintHtml}
    </div>
  `;
}

/* ============================================
   解析卡片（支援表達式）
   ============================================ */
function _resolveCards(block, ctx) {
  let rawCards = block.cards;

  /* 🆕 支援 block.cards 為表達式字串 */
  if (typeof rawCards === 'string') {
    try {
      rawCards = resolveExpr(rawCards, ctx);
    } catch (e) {
      console.warn('[stats-block] cards 表達式解析失敗：', e);
      return [];
    }
  }

  if (!Array.isArray(rawCards)) {
    console.warn('[stats-block] cards 解析後不是陣列：', rawCards);
    return [];
  }

  return rawCards.map((c) => ({
    ...c,
    value: _resolveValue(c.value, ctx),
    hint: _resolveValue(c.hint, ctx),
  }));
}

function _resolveValue(val, ctx) {
  if (typeof val !== 'string') return val;
  if (
    val.startsWith('$.') ||
    val.startsWith('state.') ||
    val.startsWith('data.') ||
    val.startsWith('$data.') ||
    val.startsWith('$state.')
  ) {
    try {
      return resolveExpr(val, ctx);
    } catch (e) {
      return val;
    }
  }
  return val;
}

/* ============================================
   模式判斷
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
   工具
   ============================================ */
function _debounce(fn, wait) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}
