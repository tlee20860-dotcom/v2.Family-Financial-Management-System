// ============================================
// page-filter.js — 全站共用的頁面篩選欄（v103.0.11）
// 位置：js/shared/page-filter.js
// ============================================
// v103.0.11 修正：
//   ✅ [H04] 移除未使用的 escapeHtml import
// ============================================

import { AppState } from '../core/state.js';
import { getYearList } from '../config/app-config.js';

/**
 * 渲染頁面篩選欄
 * @param {Object} options
 * @param {string} options.containerId - 容器 ID（預設 'page-filter-root'）
 * @param {string[]} options.fields - ['year', 'month']
 * @param {Function} options.onChange - 篩選變更回呼 (filters) => {}
 * @param {Function} options.renderExtra - 額外欄位 HTML 產生器
 * @param {boolean} options.includeAllMonth - 月份是否含「全年」（預設 true）
 * @param {boolean} options.autoSyncAppState - 是否自動同步 AppState（預設 true）
 * @returns {Object|null} { root, getFilters, refresh, updateExtra, destroy }
 */
export function renderPageFilter(options = {}) {
  const {
    containerId = 'page-filter-root',
    fields = ['year', 'month'],
    onChange,
    renderExtra,
    includeAllMonth = true,
    autoSyncAppState = true,
  } = options;

  const root = document.getElementById(containerId);
  if (!root) {
    console.warn(`⚠️ renderPageFilter: 找不到容器 #${containerId}`);
    return null;
  }

  const { year: stateYear, month: stateMonth } = AppState.getYearMonth();

  const parts = [];

  if (fields.includes('year')) {
    const years = getYearList();
    let opts = '';
    years.forEach((y) => {
      const sel = String(y) === String(stateYear) ? 'selected' : '';
      opts += `<option value="${y}" ${sel}>${y} 年</option>`;
    });
    parts.push(`
      <div class="filter-group">
        <label class="field-label">年份</label>
        <select class="select" data-filter="year">${opts}</select>
      </div>
    `);
  }

  if (fields.includes('month')) {
    let opts = includeAllMonth ? `<option value="all">全部</option>` : '';
    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, '0');
      const sel = mm === String(stateMonth) ? 'selected' : '';
      opts += `<option value="${mm}" ${sel}>${m} 月</option>`;
    }
    parts.push(`
      <div class="filter-group">
        <label class="field-label">月份</label>
        <select class="select" data-filter="month">${opts}</select>
      </div>
    `);
  }

  const extraHtml = _renderExtraInto(renderExtra);

  root.innerHTML = `<div class="page-filter-bar">${parts.join('')}${extraHtml}</div>`;

  /* ============================================
     事件綁定
     ============================================ */
  const changeHandler = () => {
    const filters = collectFilters(root);
    if (autoSyncAppState && filters.year && filters.month) {
      AppState.setYearMonth(filters.year, filters.month);
    }
    if (typeof onChange === 'function') onChange(filters);
  };

  const bindSelects = () => {
    root.querySelectorAll('select[data-filter]').forEach((sel) => {
      sel.removeEventListener('change', changeHandler);
      sel.addEventListener('change', changeHandler);
    });
  };

  bindSelects();

  let unsubscribeYMEvent = null;
  if (autoSyncAppState) {
    unsubscribeYMEvent = AppState.on('ym-change', ({ year, month }) => {
      const ySel = root.querySelector('select[data-filter="year"]');
      const mSel = root.querySelector('select[data-filter="month"]');
      if (ySel && ySel.value !== String(year)) ySel.value = String(year);
      if (mSel && mSel.value !== String(month)) mSel.value = String(month);
    });
  }

  if (typeof onChange === 'function') {
    onChange(collectFilters(root));
  }

  if (window.lucide) window.lucide.createIcons();

  return {
    root,
    getFilters: () => collectFilters(root),

    refresh: () => {
      const filters = collectFilters(root);
      if (typeof onChange === 'function') onChange(filters);
    },

    updateExtra: (newRenderExtra) => {
      const bar = root.querySelector('.page-filter-bar');
      if (!bar) return;

      bar.querySelectorAll('[data-extra-group]').forEach((el) => el.remove());

      const newHtml = _renderExtraInto(newRenderExtra);
      if (newHtml) {
        const temp = document.createElement('div');
        temp.innerHTML = newHtml;
        const children = [...temp.children];
        children.forEach((el) => {
          el.setAttribute('data-extra-group', '1');
          bar.appendChild(el);
        });
      }

      bindSelects();

      if (window.lucide) window.lucide.createIcons();
    },

    destroy: () => {
      root.querySelectorAll('select[data-filter]').forEach((sel) => {
        sel.removeEventListener('change', changeHandler);
      });
      if (unsubscribeYMEvent) {
        try { unsubscribeYMEvent(); } catch (e) { /* noop */ }
      }
    },
  };
}

/* ============================================
   內部工具
   ============================================ */
function _renderExtraInto(renderExtra) {
  if (typeof renderExtra !== 'function') return '';

  const extra = renderExtra();
  if (!extra) return '';

  const wrapper = document.createElement('div');
  wrapper.setAttribute('data-extra-group', '1');
  wrapper.style.display = 'contents';

  wrapper.innerHTML = extra;
  return wrapper.outerHTML;
}

function collectFilters(root) {
  const filters = {};
  root.querySelectorAll('select[data-filter]').forEach((sel) => {
    filters[sel.dataset.filter] = sel.value;
  });
  return filters;
}

export function refreshPageFilter(instance) {
  if (instance && typeof instance.refresh === 'function') instance.refresh();
}