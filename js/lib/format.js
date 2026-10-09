// ============================================
// format.js — 格式化工具 SSOT（v103.0.0）
// 位置：js/lib/format.js
// ============================================
// 來源：從 js/core/utils.js 抽出格式化函式（v103.0.0）
//
// 職責：
//   1. 金額格式化（HKD / 純數字 / 百分比）
//   2. 通用 cell 值格式化
//   3. 銀行交易類型 / 分類格式化
//
// 設計原則：
//   - 所有數字格式化一律走此處
//   - 純函式，無副作用
// ============================================

import { esc } from './dom.js';
import {
  LIMITS,
  BANK_TXN_TYPE_LABELS,
  BANK_TXN_CATEGORY_LABELS,
  BANK_TXN_CATEGORY_BADGES,
} from '../config/constants.js';

/* ============================================
   1. 金額格式化
   ============================================ */

/**
 * 格式化為 HK$ 顯示
 * @param {*} amount
 * @returns {string}
 */
export function formatHKD(amount) {
  if (amount == null || isNaN(amount)) return 'HK$ 0';
  const rounded = Math.round(Number(amount));
  return 'HK$ ' + rounded.toLocaleString('zh-HK');
}

/**
 * 格式化為純數字（千分位）
 * @param {*} amount
 * @returns {string}
 */
export function formatNumber(amount) {
  if (amount == null || isNaN(amount)) return '0';
  const rounded = Math.round(Number(amount));
  return rounded.toLocaleString('zh-HK');
}

/**
 * 四捨五入至整數
 * @param {*} value
 * @returns {number}
 */
export function roundHKD(value) {
  const n = Number(value);
  return isNaN(n) ? 0 : Math.round(n);
}

/**
 * 限制金額範圍（0 ~ AMOUNT_MAX）
 * @param {*} value
 * @returns {number}
 */
export function clampAmount(value) {
  const n = roundHKD(value);
  if (n < 0) return 0;
  if (n > LIMITS.AMOUNT_MAX) return LIMITS.AMOUNT_MAX;
  return n;
}

/**
 * 格式化百分比
 * @param {*} value
 * @param {number} [digits=2]
 * @returns {string}
 */
export function formatPercent(value, digits = 2) {
  const n = Number(value);
  if (isNaN(n)) return '0%';
  return `${n.toFixed(digits)}%`;
}

/* ============================================
   2. 通用 cell 值格式化（依欄位 type）
   ============================================ */

/**
 * 通用 cell 值格式化（SSOT）
 * @param {*} val
 * @param {'text'|'number'|'number-plain'|'date'|'select'} [type='text']
 * @returns {string} HTML
 */
export function formatCellValue(val, type) {
  if (val == null || val === '') return '<span class="text-muted">—</span>';

  switch (type) {
    case 'number':
      return formatHKD(val);
    case 'number-plain':
      return formatNumber(val);
    case 'date':
      return esc(String(val));
    case 'select':
    case 'text':
    default:
      return esc(String(val));
  }
}

/* ============================================
   3. 銀行交易格式化
   ============================================ */

/**
 * 交易類型顯示文字
 * @param {string} type
 * @returns {string}
 */
export function formatTransactionType(type) {
  return BANK_TXN_TYPE_LABELS[type] || type || '未知';
}

/**
 * 交易分類顯示文字
 * @param {string} category
 * @returns {string}
 */
export function formatTransactionCategory(category) {
  return BANK_TXN_CATEGORY_LABELS[category] || category || '未分類';
}

/**
 * 交易分類 badge class
 * @param {string} category
 * @returns {string}
 */
export function getCategoryBadgeClass(category) {
  return BANK_TXN_CATEGORY_BADGES[category] || 'badge-muted';
}
