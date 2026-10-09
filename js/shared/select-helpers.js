// ============================================
// select-helpers.js — 全站共用下拉選項填充（v103.0.11）
// 位置：js/shared/select-helpers.js
// ============================================
// v103.0.11 修正：
//   ✅ [H04] escapeHtml 改從 lib/dom.js 導入
//   ✅ sortMembers 保留從 core/utils.js 導入（該函式仍定義於此）
// ============================================

import { esc as escapeHtml } from '../lib/dom.js';
import { sortMembers } from '../core/utils.js';

/* ============================================
   通用填充
   ============================================ */
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

export function fillCompanySelect(target, companies, config = {}) {
  fillSelect(target, companies || [], {
    valueKey: 'id',
    labelKey: 'name',
    includeEmpty: config.includeEmpty !== false,
    emptyText: config.emptyText || '— 請選擇 —',
    preserveValue: config.preserveValue !== false,
  });
}

export function fillBankSelect(target, banks, config = {}) {
  fillSelect(target, banks || [], {
    valueKey: 'id',
    labelKey: 'name',
    includeEmpty: config.includeEmpty !== false,
    emptyText: config.emptyText || '— 請選擇銀行 —',
    preserveValue: config.preserveValue !== false,
  });
}

export function fillStatusSelect(target, statuses, config = {}) {
  let filtered = statuses || [];
  if (config.category) {
    filtered = filtered.filter((s) => s.category === config.category);
  }
  const sorted = [...filtered].sort((a, b) => (a.order || 0) - (b.order || 0));

  const options = sorted.map((s) => ({ value: s.name, label: s.name }));

  fillSelect(target, options, {
    valueKey: 'value',
    labelKey: 'label',
    includeEmpty: config.includeEmpty !== false,
    emptyText: config.emptyText || '— 請選擇 —',
    preserveValue: config.preserveValue !== false,
  });
}

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