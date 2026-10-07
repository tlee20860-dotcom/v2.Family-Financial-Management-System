// ============================================
// select-helpers.js — 全站共用下拉選項填充（v101）
// 位置：js/shared/select-helpers.js
// ============================================
// v101 修正：
//   ✅ 排序邏輯統一（byOrder / byName）
//   ✅ 新增 fillStatusSelect（狀態清單）
//   ✅ 新增 fillGenericSelect（自訂 valueKey/labelKey）
//   ✅ 內部 resolveElement 統一
// ============================================

import { escapeHtml, sortMembers } from '../core/utils.js';

/* ============================================
   通用填充
   ============================================ */

/**
 * 通用填充下拉選項
 * @param {string|HTMLElement} target - 元素 ID 或元素本身
 * @param {Array} options - 選項陣列
 * @param {Object} [config]
 * @param {string} [config.valueKey='id']
 * @param {string} [config.labelKey='name']
 * @param {boolean} [config.includeEmpty=false]
 * @param {string} [config.emptyText='— 請選擇 —']
 * @param {boolean} [config.preserveValue=true]
 */
export function fillSelect(target, options, config = {}) {
  const {
    valueKey = 'id',
    labelKey = 'name',
    includeEmpty = false,
    emptyText = '— 請選擇 —',
    preserveValue = true,
  } = config;

  const sel = _resolveElement(target);
  if (!sel) {
    console.warn('⚠️ fillSelect: 找不到元素', target);
    return;
  }

  const cur = preserveValue ? sel.value : '';

  let html = includeEmpty
    ? `<option value="">${escapeHtml(emptyText)}</option>`
    : '';

  html += (options || []).map((o) => {
    const val = o[valueKey];
    const label = o[labelKey];
    return `<option value="${escapeHtml(val)}">${escapeHtml(label)}</option>`;
  }).join('');

  sel.innerHTML = html;

  if (preserveValue && cur && (options || []).some((o) => String(o[valueKey]) === cur)) {
    sel.value = cur;
  }
}

/* ============================================
   業務專用填充
   ============================================ */

/**
 * 填充成員下拉
 */
export function fillMemberSelect(target, members, config = {}) {
  const sorted = sortMembers(members);
  fillSelect(target, sorted, {
    valueKey: 'id',
    labelKey: 'name',
    includeEmpty: config.includeEmpty !== false,
    emptyText: config.emptyText || '— 請選擇 —',
    preserveValue: config.preserveValue !== false,
  });
}

/**
 * 填充類別下拉
 */
export function fillCategorySelect(target, categories, config = {}) {
  const sorted = [...(categories || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  fillSelect(target, sorted, {
    valueKey: 'id',
    labelKey: 'name',
    includeEmpty: config.includeEmpty !== false,
    emptyText: config.emptyText || '— 請選擇類別 —',
    preserveValue: config.preserveValue !== false,
  });
}

/**
 * 填充項目下拉（依類別過濾）
 * @param {string|HTMLElement} target
 * @param {Array} items - 全部項目
 * @param {string} categoryId - 過濾類別 ID（空字串 → 全部）
 * @param {Object} config
 */
export function fillItemSelect(target, items, categoryId, config = {}) {
  const filtered = categoryId
    ? (items || []).filter((i) => i.categoryId === categoryId)
    : (items || []);

  fillSelect(target, filtered, {
    valueKey: 'id',
    labelKey: 'name',
    includeEmpty: config.includeEmpty !== false,
    emptyText: config.emptyText || (categoryId ? '— 請選擇項目 —' : '— 請先選擇類別 —'),
    preserveValue: config.preserveValue !== false,
  });
}

/**
 * 填充支付方式下拉
 */
export function fillPaymentSelect(target, payments, config = {}) {
  const sorted = [...(payments || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  fillSelect(target, sorted, {
    valueKey: 'id',
    labelKey: 'name',
    includeEmpty: config.includeEmpty !== false,
    emptyText: config.emptyText || '— 請選擇 —',
    preserveValue: config.preserveValue !== false,
  });
}

/**
 * 填充保險公司下拉
 */
export function fillCompanySelect(target, companies, config = {}) {
  fillSelect(target, companies || [], {
    valueKey: 'id',
    labelKey: 'name',
    includeEmpty: config.includeEmpty !== false,
    emptyText: config.emptyText || '— 請選擇 —',
    preserveValue: config.preserveValue !== false,
  });
}

/**
 * 填充銀行下拉
 */
export function fillBankSelect(target, banks, config = {}) {
  fillSelect(target, banks || [], {
    valueKey: 'id',
    labelKey: 'name',
    includeEmpty: config.includeEmpty !== false,
    emptyText: config.emptyText || '— 請選擇銀行 —',
    preserveValue: config.preserveValue !== false,
  });
}

/**
 * 🆕 v101：填充狀態下拉
 * @param {string|HTMLElement} target
 * @param {Array} statuses - 狀態陣列（含 name）
 * @param {Object} config
 * @param {'personal'|'fixed'|'insurance'} [config.category] - 過濾類別
 */
export function fillStatusSelect(target, statuses, config = {}) {
  let filtered = statuses || [];
  if (config.category) {
    filtered = filtered.filter((s) => s.category === config.category);
  }
  const sorted = [...filtered].sort((a, b) => (a.order || 0) - (b.order || 0));

  // 狀態以 name 為 value（保持中文字串，相容舊資料）
  const options = sorted.map((s) => ({ value: s.name, label: s.name }));

  fillSelect(target, options, {
    valueKey: 'value',
    labelKey: 'label',
    includeEmpty: config.includeEmpty !== false,
    emptyText: config.emptyText || '— 請選擇 —',
    preserveValue: config.preserveValue !== false,
  });
}

/**
 * 🆕 v101：填充年份下拉（從 app-config 讀取範圍）
 * @param {string|HTMLElement} target
 * @param {Array<number>} years - 年份陣列
 * @param {Object} config
 */
export function fillYearListSelect(target, years, config = {}) {
  const options = (years || []).map((y) => ({
    value: String(y),
    label: `${y} 年`,
  }));
  fillSelect(target, options, {
    valueKey: 'value',
    labelKey: 'label',
    includeEmpty: config.includeEmpty === true,
    emptyText: config.emptyText || '— 請選擇 —',
    preserveValue: config.preserveValue !== false,
  });
}

/* ============================================
   內部工具
   ============================================ */
function _resolveElement(target) {
  if (typeof target === 'string') return document.getElementById(target);
  if (target instanceof HTMLElement) return target;
  return null;
}