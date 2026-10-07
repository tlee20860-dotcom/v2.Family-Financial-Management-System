// ============================================
// utils.js — 通用工具函式（v101）
// 位置：js/core/utils.js
// ============================================
// v101 修正：
//   ✅ 新增 roundHKD（統一四捨五入）
//   ✅ 新增 truncate（名稱截斷，讀 constants 長度）
//   ✅ 新增 debounce / throttle
//   ✅ 新增 parseDate / dateToStr
//   ✅ escapeHtml 強化（處理 null / undefined）
// ============================================

import { LIMITS, RESERVED_IDS } from '../config/constants.js';

/* ============================================
   金額格式化
   ============================================ */

/**
 * 格式化為 HK$ 顯示（整數）
 * @param {number} amount
 * @returns {string}
 */
export function formatHKD(amount) {
  if (amount == null || isNaN(amount)) return 'HK$ 0';
  const rounded = Math.round(Number(amount));
  return 'HK$ ' + rounded.toLocaleString('zh-HK');
}

/**
 * 格式化數字（整數，無貨幣符號）
 * @param {number} amount
 * @returns {string}
 */
export function formatNumber(amount) {
  if (amount == null || isNaN(amount)) return '0';
  const rounded = Math.round(Number(amount));
  return rounded.toLocaleString('zh-HK');
}

/**
 * 四捨五入為整數
 * @param {number|string} value
 * @returns {number}
 */
export function roundHKD(value) {
  const n = Number(value);
  return isNaN(n) ? 0 : Math.round(n);
}

/**
 * 限制金額範圍
 * @param {number} value
 * @returns {number}
 */
export function clampAmount(value) {
  const n = roundHKD(value);
  if (n < 0) return 0;
  if (n > LIMITS.AMOUNT_MAX) return LIMITS.AMOUNT_MAX;
  return n;
}

/* ============================================
   日期工具
   ============================================ */

/**
 * 今日 ISO 日期（YYYY-MM-DD）
 */
export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * 當前年月
 * @returns {{year: string, month: string}}
 */
export function currentYearMonth() {
  const d = new Date();
  return {
    year: String(d.getFullYear()),
    month: String(d.getMonth() + 1).padStart(2, '0'),
  };
}

/**
 * Date → YYYY-MM-DD
 */
export function dateToStr(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/**
 * 字串 → Date（容錯）
 */
export function parseDate(str) {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/* ============================================
   字串工具
   ============================================ */

/**
 * HTML escape
 * @param {*} s
 * @returns {string}
 */
export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

/**
 * 名稱截斷（依螢幕寬度選擇長度）
 * @param {string} name
 * @param {number} [maxLen] - 若未提供，依螢幕寬度自動選擇
 * @returns {string}
 */
export function truncate(name, maxLen) {
  if (!name) return '';
  const s = String(name);
  let len = maxLen;
  if (len == null) {
    len = (typeof window !== 'undefined' && window.innerWidth < 640)
      ? LIMITS.NAME_MAX_LEN_MOBILE
      : LIMITS.NAME_MAX_LEN_DESKTOP;
  }
  if (s.length <= len) return s;
  return s.slice(0, len) + '…';
}

/* ============================================
   DOM 工具
   ============================================ */

export function qs(sel, parent = document) {
  return parent.querySelector(sel);
}

export function qsa(sel, parent = document) {
  return [...parent.querySelectorAll(sel)];
}

/* ============================================
   成員排序
   ============================================ */

/**
 * 成員排序（依 order，其次 createdAt）
 */
export function sortMembers(members) {
  return [...(members || [])].sort((a, b) => {
    const oa = a.order != null ? a.order : Number.MAX_SAFE_INTEGER;
    const ob = b.order != null ? b.order : Number.MAX_SAFE_INTEGER;
    if (oa !== ob) return oa - ob;
    return (a.createdAt || 0) - (b.createdAt || 0);
  });
}

/**
 * 判斷是否為「額外收入」保留鍵
 */
export function isExtraIncome(memberId) {
  return memberId === RESERVED_IDS.EXTRA_INCOME;
}

/**
 * 判斷是否為「家庭共用」保留鍵
 */
export function isSharedMember(memberId) {
  return memberId === RESERVED_IDS.SHARED_MEMBER;
}

/**
 * 取得成員顯示名稱（含保留鍵處理）
 * @param {string} memberId
 * @param {Array} members
 * @returns {string}
 */
export function getMemberDisplayName(memberId, members = []) {
  if (isExtraIncome(memberId)) return '額外收入';
  if (isSharedMember(memberId)) return '家庭共用支出';
  const m = members.find((x) => x.id === memberId);
  return m ? m.name : '（未知）';
}

/* ============================================
   效能工具
   ============================================ */

/**
 * Debounce
 * @param {Function} fn
 * @param {number} wait - 毫秒
 * @returns {Function}
 */
export function debounce(fn, wait = 300) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

/**
 * Throttle
 * @param {Function} fn
 * @param {number} wait - 毫秒
 * @returns {Function}
 */
export function throttle(fn, wait = 300) {
  let last = 0;
  return function (...args) {
    const now = Date.now();
    if (now - last >= wait) {
      last = now;
      fn.apply(this, args);
    }
  };
}

/* ============================================
   雜項
   ============================================ */

/**
 * 深拷貝（僅支援純資料）
 */
export function deepClone(obj) {
  if (obj == null || typeof obj !== 'object') return obj;
  return JSON.parse(JSON.stringify(obj));
}

/**
 * 產生唯一 ID（前端暫用）
 */
export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 將陣列轉為 key-value 物件
 */
export function arrayToMap(arr, keyField = 'id') {
  const map = {};
  (arr || []).forEach((item) => {
    if (item && item[keyField] != null) map[item[keyField]] = item;
  });
  return map;
}