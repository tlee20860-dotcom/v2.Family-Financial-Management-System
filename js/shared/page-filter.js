// ============================================
// page-filter.js — 全站共用的頁面篩選欄（v101）
// 位置：js/shared/page-filter.js
// ============================================
// v101 修正：
//   ✅ 年份範圍改讀 app-config（settings/year_range）
//   ✅ onChange 只負責回呼，不自動設定 AppState（統一由呼叫端決定）
//   ✅ 新增 destroy() 清理監聽器
//   ✅ 支援額外篩選欄位重新渲染（updateExtra）
// ============================================

import { AppState } from '../core/state.js';
import { escapeHtml } from '../core/utils.js';
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

  if (typeof renderExtra === 'function') {
    const extra = renderExtra();
    if (extra) parts.push(extra);
  }

  root.innerHTML = `<div class="page-filter-bar">${parts.join('')}</div>`;

  const changeHandler = () => {
    const filters = collectFilters(root);
    if (autoSyncAppState && filters.year && filters.month) {
      AppState.setYearMonth(filters.year, filters.month);
    }
    if (typeof onChange === 'function') onChange(filters);
  };

  root.querySelectorAll('select[data-filter]').forEach((sel) => {
    sel.addEventListener('change', changeHandler);
  });

  // 監聽 AppState 變更（表單儲存後同步）
  let unsubscribeYMEvent = null;
  if (autoSyncAppState) {
    unsubscribeYMEvent = AppState.on('ym-change', ({ year, month }) => {
      const ySel = root.querySelector('select[data-filter="year"]');
      const mSel = root.querySelector('select[data-filter="month"]');
      if (ySel && ySel.value !== String(year)) ySel.value = String(year);
      if (mSel && mSel.value !== String(month)) mSel.value = String(month);
    });
  }

  // 初次回呼
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

    /**
     * 重新渲染額外欄位（用於成員清單等非同步載入完成後）
     * @param {Function} newRenderExtra
     */
    updateExtra: (newRenderExtra) => {
      const bar = root.querySelector('.page-filter-bar');
      if (!bar) return;
      // 移除舊的額外欄位
      const old = bar.querySelectorAll('[data-extra-group]');
      old.forEach((el) => el.remove());
      // 加入新的
      if (typeof newRenderExtra === 'function') {
        const temp = document.createElement('div');
        temp.innerHTML = newRenderExtra();
        const children = [...temp.children];
        children.forEach((el) => {
          el.setAttribute('data-extra-group', '1');
          bar.appendChild(el);
        });
      }
      // 重新綁定 change
      root.querySelectorAll('select[data-filter]').forEach((sel) => {
        sel.removeEventListener('change', changeHandler);
        sel.addEventListener('change', changeHandler);
      });
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
function collectFilters(root) {
  const filters = {};
  root.querySelectorAll('select[data-filter]').forEach((sel) => {
    filters[sel.dataset.filter] = sel.value;
  });
  return filters;
}

/**
 * 重新渲染（向下相容舊 API）
 */
export function refreshPageFilter(instance) {
  if (instance && typeof instance.refresh === 'function') instance.refresh();
}