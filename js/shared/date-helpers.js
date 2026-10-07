// ============================================
// date-helpers.js — 全站共用年月下拉填充（v101）
// 位置：js/shared/date-helpers.js
// ============================================
// v101 修正：
//   ✅ 年份範圍改讀 app-config（settings/year_range）
//   ✅ 移除硬編碼 range = 5
//   ✅ 新增 useAppState 選項（自動從 AppState 讀預設值）
// ============================================

import { AppState } from '../core/state.js';
import { getYearList, getYearRange } from '../config/app-config.js';

/**
 * 填充年份下拉（範圍由 app-config 提供）
 *
 * @param {string|HTMLElement} target - 元素 ID 或元素本身
 * @param {Object} [config]
 * @param {string} [config.defaultValue] - 預設選中值
 * @param {boolean} [config.preserveValue=true] - 是否保留原選中值
 * @param {boolean} [config.includeAll=false] - 是否加入「全部」選項
 * @param {boolean} [config.useAppState=false] - 是否從 AppState 讀預設
 */
export function fillYearSelect(target, config = {}) {
  const {
    defaultValue,
    preserveValue = true,
    includeAll = false,
    useAppState = false,
  } = config;

  const sel = _resolveElement(target);
  if (!sel) {
    console.warn('⚠️ fillYearSelect: 找不到元素', target);
    return;
  }

  const cur = preserveValue ? sel.value : '';
  const years = getYearList();

  let html = includeAll ? `<option value="">全部</option>` : '';
  years.forEach((y) => {
    html += `<option value="${y}">${y} 年</option>`;
  });

  sel.innerHTML = html;

  // 優先順序：defaultValue > useAppState > preserveValue > 最後一年
  let targetVal = null;
  if (defaultValue != null) {
    targetVal = String(defaultValue);
  } else if (useAppState) {
    targetVal = String(AppState.year);
  } else if (preserveValue && cur && sel.querySelector(`option[value="${cur}"]`)) {
    targetVal = cur;
  }

  if (targetVal && sel.querySelector(`option[value="${targetVal}"]`)) {
    sel.value = targetVal;
  } else {
    // fallback：當前年（若在清單內）或最後一年
    const curY = String(new Date().getFullYear());
    if (sel.querySelector(`option[value="${curY}"]`)) {
      sel.value = curY;
    } else if (years.length > 0) {
      sel.value = String(years[years.length - 1]);
    }
  }
}

/**
 * 填充月份下拉
 *
 * @param {string|HTMLElement} target
 * @param {Object} [config]
 * @param {boolean} [config.includeAll=false] - 是否加入「全部」選項
 * @param {string} [config.allText='全部']
 * @param {string} [config.defaultValue] - 預設選中值（'01' ~ '12' 或 'all'）
 * @param {boolean} [config.preserveValue=true]
 * @param {boolean} [config.useAppState=false] - 從 AppState 讀（'all' → '01'）
 */
export function fillMonthSelect(target, config = {}) {
  const {
    includeAll = false,
    allText = '全部',
    defaultValue,
    preserveValue = true,
    useAppState = false,
  } = config;

  const sel = _resolveElement(target);
  if (!sel) {
    console.warn('⚠️ fillMonthSelect: 找不到元素', target);
    return;
  }

  const cur = preserveValue ? sel.value : '';

  let html = includeAll ? `<option value="all">${allText}</option>` : '';
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    html += `<option value="${mm}">${m} 月</option>`;
  }

  sel.innerHTML = html;

  let targetVal = null;
  if (defaultValue != null) {
    targetVal = String(defaultValue);
  } else if (useAppState) {
    // AppState.month === 'all' → '01'
    targetVal = AppState.month === 'all' ? '01' : String(AppState.month);
  } else if (preserveValue && cur && sel.querySelector(`option[value="${cur}"]`)) {
    targetVal = cur;
  }

  if (targetVal && sel.querySelector(`option[value="${targetVal}"]`)) {
    sel.value = targetVal;
  }
}

/**
 * 一次填充年份 + 月份
 *
 * @param {string} yearTarget
 * @param {string} monthTarget
 * @param {Object} [config]
 */
export function fillYearMonthSelects(yearTarget, monthTarget, config = {}) {
  fillYearSelect(yearTarget, config);
  fillMonthSelect(monthTarget, config);
}

/* ============================================
   資訊查詢
   ============================================ */

/**
 * 取得可用年份清單
 */
export function getAvailableYears() {
  return getYearList();
}

/**
 * 取得年份範圍
 * @returns {{startYear: number, endYear: number}}
 */
export function getYearRangeInfo() {
  return getYearRange();
}

/* ============================================
   內部工具
   ============================================ */
function _resolveElement(target) {
  if (typeof target === 'string') return document.getElementById(target);
  if (target instanceof HTMLElement) return target;
  return null;
}