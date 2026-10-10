// stats-block.js — 統計卡區（v103.0.18）
import { esc } from '../lib/dom.js';
import { resolveExpr } from '../engines/render-engine.js';
import { AppState } from '../core/state.js';
import { STORAGE_KEYS } from '../config/constants.js';

function _render(container, html) {
  if (container.__lastHtml === html) return;
  container.__lastHtml = html;
  container.innerHTML = html;
  if (window.lucide) window.lucide.createIcons();
}

export function mount(block, ctx) {
  const container = document.getElementById(block.container);
  if (!container) return { onDepsChange: () => {}, destroy: () => {} };

  let _unsubView = null, _resizeH = null;

  function render() {
    const mode = block.mode || _getStatsMode();
    const displayMode = _resolveDisplayMode(mode);
    const cards = _resolveCards(block, ctx);
    if (cards.length === 0) { container.innerHTML = ''; container.__lastHtml = ''; return; }
    const html = displayMode === 'C' ? _integrated(cards) : _compact(cards);
    _render(container, html);
  }

  render();
  if ((block.mode || _getStatsMode()) === 'auto') {
    _unsubView = AppState.on('view-change', render);
    _resizeH = _debounce(render, 200);
    window.addEventListener('resize', _resizeH);
  }

  return {
    onDepsChange: render,
    destroy: () => {
      if (_unsubView) { try { _unsubView(); } catch (e) {} }
      if (_resizeH) window.removeEventListener('resize', _resizeH);
      container.innerHTML = '';
      container.__lastHtml = '';
    },
  };
}

function _integrated(cards) {
  return `<div class="stats-integrated" style="margin-bottom:20px;"><div class="stats-integrated-grid">${cards.map(_integratedCell).join('')}</div></div>`;
}

function _integratedCell(c) {
  const icon = c.icon ? `<i data-lucide="${esc(c.icon)}" style="width:13px;height:13px;"></i>` : '';
  const title = icon ? `<div class="stats-integrated-title">${icon}<span>${esc(c.title || '')}</span></div>` : `<div class="stats-integrated-title"><span>${esc(c.title || '')}</span></div>`;
  const hint = c.hint ? `<div class="stats-integrated-hint">${esc(c.hint)}</div>` : '';
  return `<div class="stats-integrated-cell">${title}<div class="stats-integrated-value mono ${esc(c.valueClass || '')}">${c.value == null ? '—' : esc(String(c.value))}</div>${hint}</div>`;
}

function _compact(cards) {
  const cols = Math.min(4, Math.max(2, cards.length));
  return `<div class="stats-compact-grid stats-compact-grid-${cols}" style="margin-bottom:20px;">${cards.map(_compactCard).join('')}</div>`;
}

function _compactCard(c) {
  const icon = c.icon ? `<i data-lucide="${esc(c.icon)}" style="width:12px;height:12px;"></i>` : '';
  const title = icon ? `<div class="glass-card-title" style="display:flex;align-items:center;gap:4px;">${icon}<span>${esc(c.title || '')}</span></div>` : `<div class="glass-card-title">${esc(c.title || '')}</div>`;
  const hint = c.hint ? `<div class="glass-card-hint">${esc(c.hint)}</div>` : '';
  return `<div class="glass-card stats-compact-card">${title}<div class="glass-card-value mono ${esc(c.valueClass || '')}">${c.value == null ? '—' : esc(String(c.value))}</div>${hint}</div>`;
}

function _resolveCards(block, ctx) {
  let raw = block.cards;
  if (typeof raw === 'string') {
    try { raw = resolveExpr(raw, ctx); } catch (e) { return []; }
  }
  if (!Array.isArray(raw)) return [];
  return raw.map((c) => ({ ...c, value: _resolveVal(c.value, ctx), hint: _resolveVal(c.hint, ctx) }));
}

function _resolveVal(val, ctx) {
  if (typeof val !== 'string') return val;
  if (/^(\$\.|state\.|data\.|\$data\.|\$state\.)/.test(val)) {
    try { return resolveExpr(val, ctx); } catch (e) { return val; }
  }
  return val;
}

function _getStatsMode() {
  try {
    const s = localStorage.getItem(STORAGE_KEYS.STATS_MODE);
    if (s === 'integrated' || s === 'compact' || s === 'auto') return s;
  } catch (e) {}
  return 'auto';
}

function _resolveDisplayMode(mode) {
  if (mode === 'integrated') return 'C';
  if (mode === 'compact') return 'B';
  if (typeof window !== 'undefined' && window.innerWidth < 640) return 'B';
  return AppState.getCurrentView() === 'table' ? 'C' : 'B';
}

function _debounce(fn, wait) {
  let t = null;
  return function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), wait); };
}