// ============================================
// filter-block.js — 篩選列區 Block（v103.0.0）
// 位置：js/blocks/filter-block.js
// ============================================
// 職責：
//   1. 渲染年月 / 自訂篩選列
//   2. 變更時寫回 ctx.state（透過 ctx.setState）
//
// Block 定義：
//   {
//     type: 'filter',
//     container: 'xxx-filter',
//     fields: ['year', 'month'],           // 內建欄位
//     customFields: [                       // 自訂欄位（選填）
//       { id: 'source', label: '來源', options: [...] },
//     ],
//     bind: 'state.filters',                // 綁定路徑（必填）
//   }
// ============================================

import { esc } from '../lib/dom.js';
import { resolveExpr } from '../engines/render-engine.js';
import { getYearList } from '../config/app-config.js';
import { AppState } from '../core/state.js';

/* ============================================
   mount
   ============================================ */
export function mount(block, ctx) {
  const container = document.getElementById(block.container);
  if (!container) {
    console.warn(`[filter-block] 找不到容器 #${block.container}`);
    return { onDepsChange: () => {}, destroy: () => {} };
  }

  const bindPath = (block.bind || 'state.filters').replace(/^state\./, '');
  let _changeHandler = null;

  function render() {
    const currentFilters = _getFilters(ctx, bindPath);
    const fields = block.fields || ['year', 'month'];

    const parts = [];

    if (fields.includes('year')) {
      parts.push(_renderYearSelect(currentFilters.year));
    }
    if (fields.includes('month')) {
      parts.push(_renderMonthSelect(currentFilters.month));
    }

    (block.customFields || []).forEach((f) => {
      parts.push(_renderCustomSelect(f, currentFilters[f.id]));
    });

    container.innerHTML = `
      <div class="page-filter-bar">
        ${parts.join('')}
      </div>
    `;

    bindEvents();

    if (window.lucide) window.lucide.createIcons();
  }

  function bindEvents() {
    if (_changeHandler) {
      container.removeEventListener('change', _changeHandler);
    }

    _changeHandler = (e) => {
      const sel = e.target.closest('select[data-filter]');
      if (!sel) return;

      const key = sel.dataset.filter;
      const value = sel.value;

      _setFilter(ctx, bindPath, key, value);
    };

    container.addEventListener('change', _changeHandler);
  }

  function onDepsChange() {
    render();
  }

  function destroy() {
    if (_changeHandler) {
      container.removeEventListener('change', _changeHandler);
      _changeHandler = null;
    }
    container.innerHTML = '';
  }

  /* 首次渲染 */
  render();

  return { onDepsChange, destroy };
}

/* ============================================
   內建欄位渲染
   ============================================ */
function _renderYearSelect(currentValue) {
  const years = getYearList();
  const opts = years.map((y) => {
    const sel = String(y) === String(currentValue) ? 'selected' : '';
    return `<option value="${y}" ${sel}>${y} 年</option>`;
  }).join('');

  return `
    <div class="filter-group">
      <label class="field-label">年份</label>
      <select class="select" data-filter="year">${opts}</select>
    </div>
  `;
}

function _renderMonthSelect(currentValue) {
  let opts = `<option value="" ${currentValue === '' || currentValue === 'all' ? 'selected' : ''}>全部</option>`;
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    const sel = mm === String(currentValue) ? 'selected' : '';
    opts += `<option value="${mm}" ${sel}>${m} 月</option>`;
  }

  return `
    <div class="filter-group">
      <label class="field-label">月份</label>
      <select class="select" data-filter="month">${opts}</select>
    </div>
  `;
}

function _renderCustomSelect(field, currentValue) {
  const opts = (field.options || []).map((o) => {
    const sel = String(o.value) === String(currentValue) ? 'selected' : '';
    return `<option value="${esc(o.value)}" ${sel}>${esc(o.label)}</option>`;
  }).join('');

  return `
    <div class="filter-group">
      <label class="field-label">${esc(field.label || '')}</label>
      <select class="select" data-filter="${esc(field.id)}">${opts}</select>
    </div>
  `;
}

/* ============================================
   篩選讀寫
   ============================================ */
function _getFilters(ctx, bindPath) {
  try {
    const expr = `state.${bindPath}`;
    const val = resolveExpr(expr, ctx);
    return val || {};
  } catch (e) {
    return {};
  }
}

function _setFilter(ctx, bindPath, key, value) {
  const normalized = (key === 'month' && value === 'all') ? '' : value;

  try {
    if (typeof ctx.setState === 'function') {
      ctx.setState(`${bindPath}.${key}`, normalized);
    } else {
      /* fallback：直接寫入 ctx.state */
      const keys = bindPath.split('.');
      const target = keys.reduce((acc, k) => {
        if (acc[k] == null || typeof acc[k] !== 'object') acc[k] = {};
        return acc[k];
      }, ctx.state);
      target[key] = normalized;
    }
  } catch (err) {
    console.error('[filter-block] 寫入 state 失敗：', err);
  }
}
