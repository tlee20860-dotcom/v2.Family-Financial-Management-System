// ============================================
// utils.js — 通用工具函式（v103.0.0）
// 位置：js/core/utils.js
// ============================================
// v103.0.0 重構：
//   ✅ 移除 deprecated calculateBankBalance / calculateTotalBankBalance
//      （SSOT 已統一至 js/shared/bank-helpers.js 的 calcBankBalance）
//   ✅ 保留 v102.1.0 全部其他功能
//   ✅ 版本號更新
// ============================================

import {
  LIMITS, RESERVED_IDS,
  BANK_TXN_TYPE_LABELS, BANK_TXN_CATEGORY_LABELS, BANK_TXN_CATEGORY_BADGES,
} from '../config/constants.js';

/* ============================================
   金額格式化
   ============================================ */

export function formatHKD(amount) {
  if (amount == null || isNaN(amount)) return 'HK$ 0';
  const rounded = Math.round(Number(amount));
  return 'HK$ ' + rounded.toLocaleString('zh-HK');
}

export function formatNumber(amount) {
  if (amount == null || isNaN(amount)) return '0';
  const rounded = Math.round(Number(amount));
  return rounded.toLocaleString('zh-HK');
}

export function roundHKD(value) {
  const n = Number(value);
  return isNaN(n) ? 0 : Math.round(n);
}

export function clampAmount(value) {
  const n = roundHKD(value);
  if (n < 0) return 0;
  if (n > LIMITS.AMOUNT_MAX) return LIMITS.AMOUNT_MAX;
  return n;
}

export function formatPercent(value, digits = 2) {
  const n = Number(value);
  if (isNaN(n)) return '0%';
  return `${n.toFixed(digits)}%`;
}

/* ============================================
   統一的 cell 值格式化（SSOT）
   ============================================ */
export function formatCellValue(val, type) {
  if (val == null || val === '') return '<span class="text-muted">—</span>';

  switch (type) {
    case 'number':
      return formatHKD(val);
    case 'number-plain':
      return formatNumber(val);
    case 'date':
      return escapeHtml(String(val));
    case 'select':
    case 'text':
    default:
      return escapeHtml(String(val));
  }
}

/* ============================================
   銀行交易格式化
   ============================================ */

export function formatTransactionType(type) {
  return BANK_TXN_TYPE_LABELS[type] || type || '未知';
}

export function formatTransactionCategory(category) {
  return BANK_TXN_CATEGORY_LABELS[category] || category || '未分類';
}

export function getCategoryBadgeClass(category) {
  return BANK_TXN_CATEGORY_BADGES[category] || 'badge-muted';
}

/* ============================================
   日期工具
   ============================================ */

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function currentYearMonth() {
  const d = new Date();
  return {
    year: String(d.getFullYear()),
    month: String(d.getMonth() + 1).padStart(2, '0'),
  };
}

export function dateToStr(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function parseDate(str) {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/* ============================================
   字串工具
   ============================================ */

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

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

export function safeParseInt(value, fallback = 0) {
  const n = parseInt(value, 10);
  return isNaN(n) ? fallback : n;
}

export function safeParseFloat(value, fallback = 0) {
  const n = parseFloat(value);
  return isNaN(n) ? fallback : n;
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

export function setText(target, text) {
  const el = typeof target === 'string' ? document.getElementById(target) : target;
  if (el) el.textContent = text;
}

export function renderEmptyState(container, message, options = {}) {
  const el = typeof container === 'string' ? document.getElementById(container) : container;
  if (!el) return;

  const { icon, actionHtml } = options;
  const iconHtml = icon
    ? `<i data-lucide="${escapeHtml(icon)}" style="width:48px;height:48px;opacity:0.4;"></i>`
    : '';

  el.innerHTML = `
    <div class="empty-state">
      ${iconHtml}
      <p style="margin-top:12px;">${escapeHtml(message)}</p>
      ${actionHtml || ''}
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   成員排序
   ============================================ */

export function sortMembers(members) {
  return [...(members || [])].sort((a, b) => {
    const oa = a.order != null ? a.order : Number.MAX_SAFE_INTEGER;
    const ob = b.order != null ? b.order : Number.MAX_SAFE_INTEGER;
    if (oa !== ob) return oa - ob;
    return (a.createdAt || 0) - (b.createdAt || 0);
  });
}

export function isExtraIncome(memberId) {
  return memberId === RESERVED_IDS.EXTRA_INCOME;
}

export function isSharedMember(memberId) {
  return memberId === RESERVED_IDS.SHARED_MEMBER;
}

export function getMemberDisplayName(memberId, members = []) {
  if (isExtraIncome(memberId)) return '額外收入';
  if (isSharedMember(memberId)) return '家庭共用';
  const m = members.find((x) => x.id === memberId);
  return m ? m.name : '（未知）';
}

/* ============================================
   效能工具
   ============================================ */

export function debounce(fn, wait = 300) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

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

export function deepClone(obj) {
  if (obj == null || typeof obj !== 'object') return obj;
  return JSON.parse(JSON.stringify(obj));
}

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function arrayToMap(arr, keyField = 'id') {
  const map = {};
  (arr || []).forEach((item) => {
    if (item && item[keyField] != null) map[item[keyField]] = item;
  });
  return map;
}

export function makeSortFn(sortKey, order = 'asc') {
  const dir = order === 'desc' ? -1 : 1;
  return (a, b) => {
    const va = a[sortKey];
    const vb = b[sortKey];

    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;

    if (typeof va === 'number' && typeof vb === 'number') {
      return (va - vb) * dir;
    }

    return String(va).localeCompare(String(vb), 'zh-HK') * dir;
  };
}
