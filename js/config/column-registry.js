// ============================================
// column-registry.js — 表格欄位 SSOT（v103.0.0）
// 位置：js/config/column-registry.js
// ============================================
// 職責：
//   1. 集中定義所有表格的欄位結構
//   2. 集中定義欄位值轉換函式（RESOLVERS）
//   3. 提供 getColumns / getResolvers 查詢 API
//
// 設計原則：
//   - 所有表格欄位只存在此處
//   - 欄位與 resolver 分開，方便列印 / 匯出重用
//   - resolver 為純函式，不依賴外部狀態
// ============================================

import { formatHKD, formatNumber, escapeHtml } from '../core/utils.js';
import {
  BANK_TXN_TYPE_LABELS,
  BANK_TXN_CATEGORY_LABELS,
  BANK_TXN_CATEGORY_BADGES,
  BANK_ACCOUNT_TYPE_LABELS,
} from './constants.js';
import { badgeClass as statusBadgeClass, label as statusLabel } from './status-registry.js';

/* ============================================
   1. 欄位定義（COLUMNS）
   -------------------------------------------------
   每個欄位結構：
   {
     id: 唯一識別,
     label: 顯示文字,
     defaultVisible: 預設是否顯示（可省略 = true）,
     defaultWidth: 預設寬度 px（可省略）,
     type: 'text' | 'number' | 'date' | 'select' | 'actions',
   }
   ============================================ */
export const COLUMNS = {

  /* ---------- 成員 ---------- */
  members: [
    { id: 'name',  label: '名稱', defaultVisible: true, defaultWidth: 160 },
    { id: 'role',  label: '角色', defaultVisible: true, defaultWidth: 120 },
    { id: 'order', label: '排序', defaultVisible: true, defaultWidth: 80, type: 'number' },
  ],

  /* ---------- 銀行（舊） ---------- */
  banks: [
    { id: 'name',  label: '名稱', defaultVisible: true, defaultWidth: 160 },
    { id: 'order', label: '排序', defaultVisible: true, defaultWidth: 80, type: 'number' },
  ],

  /* ---------- 銀行帳號（新） ---------- */
  bankAccounts: [
    { id: 'order',          label: '排序',     defaultVisible: true,  defaultWidth: 60 },
    { id: 'name',           label: '名稱',     defaultVisible: true,  defaultWidth: 160 },
    { id: 'type',           label: '類型',     defaultVisible: true,  defaultWidth: 100 },
    { id: 'initialBalance', label: '初始餘額', defaultVisible: true,  defaultWidth: 130, type: 'number' },
    { id: 'initialYM',      label: '初始年月', defaultVisible: true,  defaultWidth: 110 },
  ],

  /* ---------- 支出類別 ---------- */
  categories: [
    { id: 'name',  label: '名稱', defaultVisible: true, defaultWidth: 200 },
    { id: 'order', label: '排序', defaultVisible: true, defaultWidth: 80, type: 'number' },
  ],

  /* ---------- 支出項目 ---------- */
  items: [
    { id: 'name',       label: '名稱',   defaultVisible: true, defaultWidth: 200 },
    { id: 'categoryId', label: '所屬類別', defaultVisible: true, defaultWidth: 140 },
  ],

  /* ---------- 支付方式 ---------- */
  payments: [
    { id: 'name',  label: '名稱', defaultVisible: true, defaultWidth: 160 },
    { id: 'order', label: '排序', defaultVisible: true, defaultWidth: 80, type: 'number' },
  ],

  /* ---------- 狀態 ---------- */
  statuses: [
    { id: 'name',     label: '名稱',   defaultVisible: true, defaultWidth: 140 },
    { id: 'category', label: '所屬類別', defaultVisible: true, defaultWidth: 110 },
    { id: 'isDone',   label: '已完成',  defaultVisible: true, defaultWidth: 90 },
    { id: 'order',    label: '排序',   defaultVisible: true, defaultWidth: 70, type: 'number' },
  ],

  /* ---------- 保險公司 ---------- */
  companies: [
    { id: 'name', label: '名稱', defaultVisible: true, defaultWidth: 160 },
  ],

  /* ---------- 基金 ---------- */
  funds: [
    { id: 'name',         label: '基金名稱', defaultVisible: true, defaultWidth: 200 },
    { id: 'cost',         label: '投入成本', defaultVisible: true, defaultWidth: 130, type: 'number' },
    { id: 'currentValue', label: '現時價值', defaultVisible: true, defaultWidth: 130, type: 'number' },
    { id: 'units',        label: '單位數',   defaultVisible: true, defaultWidth: 100, type: 'number' },
    { id: 'note',         label: '備註',     defaultVisible: false, defaultWidth: 180 },
  ],

  /* ---------- 保險保單 ---------- */
  insurance: [
    { id: 'name',         label: '保單名稱', defaultVisible: true, defaultWidth: 200 },
    { id: 'company',      label: '保險公司', defaultVisible: true, defaultWidth: 120 },
    { id: 'policyHolder', label: '持有人',   defaultVisible: true, defaultWidth: 100 },
    { id: 'member',       label: '受保人',   defaultVisible: true, defaultWidth: 100 },
    { id: 'startDate',    label: '開始日期', defaultVisible: true, defaultWidth: 110 },
    { id: 'annualPremium',label: '本期年繳', defaultVisible: true, defaultWidth: 120, type: 'number' },
    { id: 'totalPremium', label: '保單總供款', defaultVisible: true, defaultWidth: 130, type: 'number' },
    { id: 'paidTotal',    label: '已供款總額', defaultVisible: true, defaultWidth: 130, type: 'number' },
    { id: 'progress',     label: '進度',     defaultVisible: true, defaultWidth: 140 },
  ],

  /* ---------- 結算清單 ---------- */
  settlements: [
    { id: 'source',    label: '來源',     defaultVisible: true, defaultWidth: 90 },
    { id: 'yearMonth', label: '年月',     defaultVisible: true, defaultWidth: 90 },
    { id: 'member',    label: '成員',     defaultVisible: true, defaultWidth: 90 },
    { id: 'name',      label: '項目名稱', defaultVisible: true, defaultWidth: 200 },
    { id: 'amount',    label: '金額',     defaultVisible: true, defaultWidth: 110, type: 'number' },
    { id: 'date',      label: '日期',     defaultVisible: true, defaultWidth: 100 },
    { id: 'status',    label: '狀態',     defaultVisible: true, defaultWidth: 140 },
  ],

  /* ---------- 銀行交易 ---------- */
  bankTransactions: [
    { id: 'date',       label: '日期', defaultVisible: true, defaultWidth: 110 },
    { id: 'bankName',   label: '銀行', defaultVisible: true, defaultWidth: 100 },
    { id: 'typeLabel',  label: '類型', defaultVisible: true, defaultWidth: 90 },
    { id: 'catLabel',   label: '分類', defaultVisible: true, defaultWidth: 100 },
    { id: 'memberName', label: '成員', defaultVisible: true, defaultWidth: 100 },
    { id: 'amount',     label: '金額', defaultVisible: true, defaultWidth: 120, type: 'number' },
    { id: 'note',       label: '備註', defaultVisible: true, defaultWidth: 180 },
  ],

  /* ---------- 儀表板：年度總覽 ---------- */
  dashboardAnnual: [
    { id: 'year',         label: '年度',     defaultVisible: true, defaultWidth: 100 },
    { id: 'totalIncome',  label: '家庭收入', defaultVisible: true, defaultWidth: 130, type: 'number' },
    { id: 'totalExpense', label: '總支出',   defaultVisible: true, defaultWidth: 130, type: 'number' },
    { id: 'insurance',    label: '保險平攤', defaultVisible: true, defaultWidth: 130, type: 'number' },
    { id: 'net',          label: '淨餘額',   defaultVisible: true, defaultWidth: 130, type: 'number' },
    { id: 'avg',          label: '每月平均', defaultVisible: true, defaultWidth: 130, type: 'number' },
  ],

  /* ---------- 年度報表：全年總合 ---------- */
  annualSummary: [
    { id: 'name',           label: '成員',     defaultVisible: true, defaultWidth: 100 },
    { id: 'income',         label: '家用轉入', defaultVisible: true, defaultWidth: 120, type: 'number' },
    { id: 'personalIncome', label: '個人收入', defaultVisible: true, defaultWidth: 120, type: 'number' },
    { id: 'expense',        label: '總支出',   defaultVisible: true, defaultWidth: 120, type: 'number' },
    { id: 'net',            label: '淨結餘',   defaultVisible: true, defaultWidth: 130, type: 'number' },
  ],

  /* ---------- 成員報表 ---------- */
  memberReport: [
    { id: 'name',           label: '成員',     defaultVisible: true, defaultWidth: 140 },
    { id: 'income',         label: '家用轉入', defaultVisible: true, defaultWidth: 140, type: 'number' },
    { id: 'personalIncome', label: '個人收入', defaultVisible: true, defaultWidth: 130, type: 'number' },
    { id: 'expense',        label: '支出',     defaultVisible: true, defaultWidth: 140, type: 'number' },
    { id: 'insurance',      label: '保險',     defaultVisible: true, defaultWidth: 140, type: 'number' },
    { id: 'net',            label: '淨額',     defaultVisible: true, defaultWidth: 140, type: 'number' },
  ],
};

/* ============================================
   2. 值轉換函式（RESOLVERS）
   -------------------------------------------------
   每個 resolver 簽名：(value, row) => string(HTML)
   ============================================ */
export const RESOLVERS = {

  /* ---------- 成員 ---------- */
  members: {
    role: (val) => escapeHtml(String(val || '—')),
    order: (val) => formatNumber(val),
  },

  /* ---------- 銀行 ---------- */
  banks: {
    order: (val) => formatNumber(val),
  },

  /* ---------- 銀行帳號 ---------- */
  bankAccounts: {
    name: (val) => escapeHtml(val || '—'),
    type: (val) => {
      const label = BANK_ACCOUNT_TYPE_LABELS[val] || val || '—';
      const cls = val === 'personal' ? 'badge-muted' : 'badge-info';
      return `<span class="badge ${cls}">${escapeHtml(label)}</span>`;
    },
    initialBalance: (val) => `<span class="mono">${formatHKD(val)}</span>`,
    initialYM: (_, row) => `<span class="mono" style="font-size:12px; color:var(--text-muted);">${escapeHtml(row.initialYear || '—')}-${escapeHtml(row.initialMonth || '—')}</span>`,
  },

  /* ---------- 支出類別 ---------- */
  categories: {
    order: (val) => formatNumber(val),
  },

  /* ---------- 支出項目 ---------- */
  items: {
    categoryId: (val) => {
      const name = val || '—';
      return `<span class="badge badge-info">${escapeHtml(name)}</span>`;
    },
  },

  /* ---------- 支付方式 ---------- */
  payments: {
    order: (val) => formatNumber(val),
  },

  /* ---------- 狀態 ---------- */
  statuses: {
    category: (val) => {
      const map = { personal: '個人支出', fixed: '固定支出', insurance: '保險' };
      return escapeHtml(map[val] || val || '—');
    },
    isDone: (val) => val
      ? '<span class="badge badge-success">是</span>'
      : '<span class="badge badge-muted">否</span>',
    order: (val) => formatNumber(val),
  },

  /* ---------- 保險公司 ---------- */
  companies: {
    name: (val) => escapeHtml(val || '—'),
  },

  /* ---------- 基金 ---------- */
  funds: {
    name: (val) => escapeHtml(val || '（未命名）'),
    cost: (val) => `<span class="mono">${formatHKD(val)}</span>`,
    currentValue: (val) => `<span class="mono text-emerald">${formatHKD(val)}</span>`,
    units: (val) => `<span class="mono">${val || '—'}</span>`,
    note: (val) => escapeHtml(val || '—'),
  },

  /* ---------- 保險保單 ---------- */
  insurance: {
    name: (val) => escapeHtml(val || '（未命名）'),
    company: (val) => escapeHtml(val || '—'),
    policyHolder: (val) => escapeHtml(val || '—'),
    member: (val) => escapeHtml(val || '—'),
    startDate: (_, row) => `<span class="mono" style="font-size:12px;">${escapeHtml(row.firstStartYear || '')}-${escapeHtml(row.firstStartMonth || '')}</span>`,
    annualPremium: (val) => `<span class="mono text-cyan">${formatHKD(val)}</span>`,
    totalPremium: (val) => `<span class="mono text-magenta">${formatHKD(val)}</span>`,
    paidTotal: (val) => `<span class="mono text-emerald">${formatHKD(val)}</span>`,
    progress: (_, row) => {
      const done = row.completedPeriods || 0;
      const total = row.totalPolicyPeriods || 0;
      const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
      return `<div style="font-size:11px; color:var(--text-muted); font-family:var(--font-mono); margin-bottom:3px;">${done} / ${total} 期 (${pct}%)</div><div class="progress" style="height:5px;"><div class="progress-bar" style="width:${pct}%;"></div></div>`;
    },
  },

  /* ---------- 結算清單 ---------- */
  settlements: {
    source: (_, row) => {
      const map = {
        personal:  { cls: 'badge-info',    label: row.memberId === 'shared' ? '🏠 家庭' : '🏷 個人' },
        insurance: { cls: 'badge-success', label: '🛡 保險' },
      };
      const cfg = map[row.source] || map.personal;
      return `<span class="badge ${cfg.cls}">${cfg.label}</span>`;
    },
    yearMonth: (_, row) => `${escapeHtml(row.year)}-${escapeHtml(row.month)}`,
    member: (val) => escapeHtml(val || '—'),
    name: (val) => escapeHtml(val || '—'),
    amount: (val) => formatHKD(val),
    date: (val) => escapeHtml(val || '—'),
    status: (val, row) => {
      const cls = statusBadgeClass(val);
      return `<span class="badge ${cls}">${escapeHtml(statusLabel(val, { source: row.source }))}</span>`;
    },
  },

  /* ---------- 銀行交易 ---------- */
  bankTransactions: {
    date: (val) => `<span class="mono" style="font-size:12px;">${escapeHtml(val || '—')}</span>`,
    bankName: (val) => escapeHtml(val || '—'),
    typeLabel: (_, row) => {
      const cls = row.type === 'in' ? 'badge-success' : (row.type === 'transfer' ? 'badge-info' : 'badge-pending');
      return `<span class="badge ${cls}">${escapeHtml(BANK_TXN_TYPE_LABELS[row.type] || row.type)}</span>`;
    },
    catLabel: (_, row) => {
      const cls = BANK_TXN_CATEGORY_BADGES[row.category] || 'badge-muted';
      return `<span class="badge ${cls}">${escapeHtml(BANK_TXN_CATEGORY_LABELS[row.category] || row.category)}</span>`;
    },
    memberName: (val) => escapeHtml(val || '—'),
    amount: (val, row) => {
      const cls = row.type === 'in' ? 'text-emerald' : 'text-red';
      const sign = row.type === 'in' ? '+' : '-';
      return `<span class="mono ${cls}">${sign}${formatHKD(val)}</span>`;
    },
    note: (val) => escapeHtml(val || '—'),
  },

  /* ---------- 儀表板：年度總覽 ---------- */
  dashboardAnnual: {
    year: (val, row) => `${val} 年${row.isCurrent ? ' <span class="badge badge-info" style="font-size:10px;">今年</span>' : ''}`,
    totalIncome: (val) => `<span class="text-emerald">${formatHKD(val)}</span>`,
    totalExpense: (val) => `<span class="text-red">${formatHKD(val)}</span>`,
    insurance: (val) => `<span class="text-magenta">${formatHKD(val)}</span>`,
    net: (val) => `<span class="${val >= 0 ? 'text-emerald' : 'text-red'}">${formatHKD(val)}</span>`,
    avg: (val) => formatHKD(val),
  },

  /* ---------- 年度報表：全年總合 ---------- */
  annualSummary: {
    name: (val, row) => {
      if (row.__isTotal) return `<b style="color:var(--neon-cyan);">${escapeHtml(val)}</b>`;
      if (row.__isShared) return `<span class="text-magenta">${escapeHtml(val)}</span>`;
      return escapeHtml(val);
    },
    income: (val) => val > 0 ? `<span class="text-emerald">${formatHKD(val)}</span>` : '<span class="text-muted">—</span>',
    personalIncome: (val) => val > 0 ? `<span class="text-cyan">${formatHKD(val)}</span>` : '<span class="text-muted">—</span>',
    expense: (val) => val > 0 ? `<span class="text-red">${formatHKD(val)}</span>` : '<span class="text-muted">—</span>',
    net: (val) => `<span class="${val >= 0 ? 'text-emerald' : 'text-red'}">${formatHKD(val)}</span>`,
  },

  /* ---------- 成員報表 ---------- */
  memberReport: {
    name: (val, row) => escapeHtml(val) + (row.isShared ? ' <span class="badge badge-muted" style="font-size:10px;">🏠</span>' : ''),
    income: (_, row) => row.isShared ? '<span class="text-muted">—</span>' : `<span class="text-emerald">${formatHKD(row.income)}</span>`,
    personalIncome: (_, row) => (row.isShared || row.personalIncome === 0) ? '<span class="text-muted">—</span>' : `<span class="text-cyan">${formatHKD(row.personalIncome)}</span>`,
    expense: (_, row) => `<span class="text-red">${formatHKD(row.expense)}</span>`,
    insurance: (_, row) => row.insurance === 0 ? '<span class="text-muted">—</span>' : `<span class="text-magenta">${formatHKD(row.insurance)}</span>`,
    net: (_, row) => row.isShared ? '<span class="text-muted">—</span>' : `<span class="${row.net >= 0 ? 'text-emerald' : 'text-red'}">${formatHKD(row.net)}</span>`,
  },
};

/* ============================================
   3. 對外 API
   ============================================ */

/**
 * 取得欄位定義（回傳複本）
 * @param {string} key - COLUMNS 的 key
 * @returns {Array}
 */
export function getColumns(key) {
  const cols = COLUMNS[key];
  if (!cols) {
    console.warn(`[column-registry] 未知的 COLUMNS key：${key}`);
    return [];
  }
  return cols.map((c) => ({ ...c }));
}

/**
 * 取得欄位值轉換函式（回傳複本）
 * @param {string} key - RESOLVERS 的 key
 * @returns {Object}
 */
export function getResolvers(key) {
  const res = RESOLVERS[key];
  if (!res) return {};
  return { ...res };
}

/**
 * 便利函式：動態追加欄位（如 cat_xxx）
 * @param {string} key
 * @param {Array} extraColumns
 * @returns {Array}
 */
export function getColumnsWith(key, extraColumns = []) {
  return [...getColumns(key), ...extraColumns];
}
