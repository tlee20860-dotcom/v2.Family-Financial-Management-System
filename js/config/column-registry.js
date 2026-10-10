// ============================================
// column-registry.js — 表格欄位 SSOT（v103.0.15）
// 位置：js/config/column-registry.js
// ============================================
// v103.0.15 修正：
//   ✅ [P17-04] items.categoryId 用 resolveName
//   ✅ [P17-06] insurance.policyHolder / member 用 resolveName
//   ✅ [DEBUG] 臨時 log（驗證後移除）
// ============================================

import { formatHKD, formatNumber } from '../lib/format.js';
import { esc as escapeHtml } from '../lib/dom.js';
import { resolveName } from './entity-registry.js';
import {
  BANK_TXN_TYPE_LABELS, BANK_TXN_CATEGORY_LABELS, BANK_TXN_CATEGORY_BADGES,
  BANK_ACCOUNT_TYPE_LABELS, RESERVED_IDS,
} from './constants.js';
import { badgeClass as statusBadgeClass, label as statusLabel } from './status-registry.js';

/* ============================================
   臨時 debug（驗證後移除）
   ============================================ */
function _dbg(label, id, name) {
  if (id && !name) console.warn(`[DEBUG] ${label} resolveName('${id}') → 空`);
}

/* ============================================
   1. COLUMNS
   ============================================ */
export const COLUMNS = {
  members: [
    { id: 'name', label: '名稱', defaultVisible: true, defaultWidth: 160 },
    { id: 'role', label: '角色', defaultVisible: true, defaultWidth: 120 },
    { id: 'order', label: '排序', defaultVisible: true, defaultWidth: 80, type: 'number' },
  ],
  banks: [
    { id: 'name', label: '名稱', defaultVisible: true, defaultWidth: 160 },
    { id: 'order', label: '排序', defaultVisible: true, defaultWidth: 80, type: 'number' },
  ],
  bankAccounts: [
    { id: 'order', label: '排序', defaultVisible: true, defaultWidth: 60 },
    { id: 'name', label: '名稱', defaultVisible: true, defaultWidth: 160 },
    { id: 'type', label: '類型', defaultVisible: true, defaultWidth: 100 },
    { id: 'initialBalance', label: '初始餘額', defaultVisible: true, defaultWidth: 130, type: 'number' },
    { id: 'initialYM', label: '初始年月', defaultVisible: true, defaultWidth: 110 },
  ],
  categories: [
    { id: 'name', label: '名稱', defaultVisible: true, defaultWidth: 200 },
    { id: 'order', label: '排序', defaultVisible: true, defaultWidth: 80, type: 'number' },
  ],
  items: [
    { id: 'name', label: '名稱', defaultVisible: true, defaultWidth: 200 },
    { id: 'categoryId', label: '所屬類別', defaultVisible: true, defaultWidth: 140 },
  ],
  payments: [
    { id: 'name', label: '名稱', defaultVisible: true, defaultWidth: 160 },
    { id: 'order', label: '排序', defaultVisible: true, defaultWidth: 80, type: 'number' },
  ],
  statuses: [
    { id: 'name', label: '名稱', defaultVisible: true, defaultWidth: 140 },
    { id: 'category', label: '所屬類別', defaultVisible: true, defaultWidth: 110 },
    { id: 'isDone', label: '已完成', defaultVisible: true, defaultWidth: 90 },
    { id: 'order', label: '排序', defaultVisible: true, defaultWidth: 70, type: 'number' },
  ],
  companies: [{ id: 'name', label: '名稱', defaultVisible: true, defaultWidth: 160 }],
  funds: [
    { id: 'name', label: '基金名稱', defaultVisible: true, defaultWidth: 200 },
    { id: 'cost', label: '投入成本', defaultVisible: true, defaultWidth: 130, type: 'number' },
    { id: 'currentValue', label: '現時價值', defaultVisible: true, defaultWidth: 130, type: 'number' },
    { id: 'units', label: '單位數', defaultVisible: true, defaultWidth: 100, type: 'number' },
    { id: 'note', label: '備註', defaultVisible: false, defaultWidth: 180 },
  ],
  insurance: [
    { id: 'name', label: '保單名稱', defaultVisible: true, defaultWidth: 200 },
    { id: 'company', label: '保險公司', defaultVisible: true, defaultWidth: 120 },
    { id: 'policyHolder', label: '持有人', defaultVisible: true, defaultWidth: 100 },
    { id: 'member', label: '受保人', defaultVisible: true, defaultWidth: 100 },
    { id: 'startDate', label: '開始日期', defaultVisible: true, defaultWidth: 110 },
    { id: 'annualPremium', label: '本期年繳', defaultVisible: true, defaultWidth: 120, type: 'number' },
    { id: 'totalPremium', label: '保單總供款', defaultVisible: true, defaultWidth: 130, type: 'number' },
    { id: 'paidTotal', label: '已供款總額', defaultVisible: true, defaultWidth: 130, type: 'number' },
    { id: 'progress', label: '進度', defaultVisible: true, defaultWidth: 140 },
  ],
  settlements: [
    { id: 'source', label: '來源', defaultVisible: true, defaultWidth: 90 },
    { id: 'yearMonth', label: '年月', defaultVisible: true, defaultWidth: 90 },
    { id: 'member', label: '成員', defaultVisible: true, defaultWidth: 90 },
    { id: 'name', label: '項目名稱', defaultVisible: true, defaultWidth: 200 },
    { id: 'amount', label: '金額', defaultVisible: true, defaultWidth: 110, type: 'number' },
    { id: 'date', label: '日期', defaultVisible: true, defaultWidth: 100 },
    { id: 'status', label: '狀態', defaultVisible: true, defaultWidth: 140 },
  ],
  bankTransactions: [
    { id: 'date', label: '日期', defaultVisible: true, defaultWidth: 110 },
    { id: 'bankName', label: '銀行', defaultVisible: true, defaultWidth: 100 },
    { id: 'typeLabel', label: '類型', defaultVisible: true, defaultWidth: 90 },
    { id: 'catLabel', label: '分類', defaultVisible: true, defaultWidth: 100 },
    { id: 'memberName', label: '成員', defaultVisible: true, defaultWidth: 100 },
    { id: 'amount', label: '金額', defaultVisible: true, defaultWidth: 120, type: 'number' },
    { id: 'note', label: '備註', defaultVisible: true, defaultWidth: 180 },
  ],
  annualSummary: [
    { id: 'name', label: '成員', defaultVisible: true, defaultWidth: 100 },
    { id: 'income', label: '家用轉入', defaultVisible: true, defaultWidth: 120, type: 'number' },
    { id: 'personalIncome', label: '個人收入', defaultVisible: true, defaultWidth: 120, type: 'number' },
    { id: 'expense', label: '總支出', defaultVisible: true, defaultWidth: 120, type: 'number' },
    { id: 'net', label: '淨結餘', defaultVisible: true, defaultWidth: 130, type: 'number' },
  ],
  annualMonthly: [
    { id: 'date', label: '日期', defaultVisible: true, defaultWidth: 110 },
    { id: 'memberName', label: '成員', defaultVisible: true, defaultWidth: 100 },
    { id: 'categoryName', label: '類別', defaultVisible: true, defaultWidth: 100 },
    { id: 'itemName', label: '項目', defaultVisible: true, defaultWidth: 120 },
    { id: 'name', label: '名稱', defaultVisible: true, defaultWidth: 180 },
    { id: 'amount', label: '金額', defaultVisible: true, defaultWidth: 110, type: 'number' },
    { id: 'status', label: '狀態', defaultVisible: true, defaultWidth: 120 },
  ],
  memberReport: [
    { id: 'name', label: '成員', defaultVisible: true, defaultWidth: 140 },
    { id: 'income', label: '家用轉入', defaultVisible: true, defaultWidth: 140, type: 'number' },
    { id: 'personalIncome', label: '個人收入', defaultVisible: true, defaultWidth: 130, type: 'number' },
    { id: 'expense', label: '支出', defaultVisible: true, defaultWidth: 140, type: 'number' },
    { id: 'insurance', label: '保險', defaultVisible: true, defaultWidth: 140, type: 'number' },
    { id: 'net', label: '淨額', defaultVisible: true, defaultWidth: 140, type: 'number' },
  ],
};

/* ============================================
   2. RESOLVERS
   ============================================ */
export const RESOLVERS = {
  members: {
    role: (val) => escapeHtml(String(val || '—')),
    order: (val) => formatNumber(val),
  },
  banks: { order: (val) => formatNumber(val) },
  bankAccounts: {
    name: (val) => escapeHtml(val || '—'),
    type: (val) => {
      const label = BANK_ACCOUNT_TYPE_LABELS[val] || val || '—';
      const cls = val === 'personal' ? 'badge-muted' : 'badge-info';
      return `<span class="badge ${cls}">${escapeHtml(label)}</span>`;
    },
    initialBalance: (val) => `<span class="mono">${formatHKD(val)}</span>`,
    initialYM: (_, row) => `<span class="mono" style="font-size:12px;color:var(--text-muted);">${escapeHtml(row.initialYear || '—')}-${escapeHtml(row.initialMonth || '—')}</span>`,
  },
  categories: { order: (val) => formatNumber(val) },
  items: {
    /* 🆕 [P17-04] */
    categoryId: (val) => {
      if (!val) return '<span class="badge badge-muted">—</span>';
      const name = resolveName('categories', val);
      _dbg('items.categoryId', val, name);
      return `<span class="badge badge-info">${escapeHtml(name || val)}</span>`;
    },
  },
  payments: { order: (val) => formatNumber(val) },
  statuses: {
    category: (val) => {
      const map = { personal: '個人支出', fixed: '固定支出', insurance: '保險' };
      return escapeHtml(map[val] || val || '—');
    },
    isDone: (val) => val ? '<span class="badge badge-success">是</span>' : '<span class="badge badge-muted">否</span>',
    order: (val) => formatNumber(val),
  },
  companies: { name: (val) => escapeHtml(val || '—') },
  funds: {
    name: (val) => escapeHtml(val || '（未命名）'),
    cost: (val) => `<span class="mono">${formatHKD(val)}</span>`,
    currentValue: (val) => `<span class="mono text-emerald">${formatHKD(val)}</span>`,
    units: (val) => `<span class="mono">${val || '—'}</span>`,
    note: (val) => escapeHtml(val || '—'),
  },
  insurance: {
    name: (val) => escapeHtml(val || '（未命名）'),
    company: (val) => escapeHtml(val || '—'),
    /* 🆕 [P17-06] */
    policyHolder: (val) => {
      if (!val) return '—';
      const name = resolveName('members', val);
      _dbg('insurance.policyHolder', val, name);
      return escapeHtml(name || val);
    },
    member: (val) => {
      if (!val) return '—';
      const name = resolveName('members', val);
      _dbg('insurance.member', val, name);
      return escapeHtml(name || val);
    },
    startDate: (_, row) => `<span class="mono" style="font-size:12px;">${escapeHtml(row.firstStartYear || '')}-${escapeHtml(row.firstStartMonth || '')}</span>`,
    annualPremium: (val) => `<span class="mono text-cyan">${formatHKD(val)}</span>`,
    totalPremium: (val) => `<span class="mono text-magenta">${formatHKD(val)}</span>`,
    paidTotal: (val) => `<span class="mono text-emerald">${formatHKD(val)}</span>`,
    progress: (_, row) => {
      const done = row.completedPeriods || 0;
      const total = row.totalPolicyPeriods || 0;
      const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
      return `<div style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);margin-bottom:3px;">${done} / ${total} 期 (${pct}%)</div><div class="progress" style="height:5px;"><div class="progress-bar" style="width:${pct}%;"></div></div>`;
    },
  },
  settlements: {
    source: (_, row) => {
      const map = {
        personal: { cls: 'badge-info', label: row.memberId === 'shared' ? '🏠 家庭' : '🏷 個人' },
        insurance: { cls: 'badge-success', label: '🛡 保險' },
      };
      const cfg = map[row.source] || map.personal;
      return `<span class="badge ${cfg.cls}">${cfg.label}</span>`;
    },
    yearMonth: (_, row) => `${escapeHtml(row.year)}-${escapeHtml(row.month)}`,
    /* 🆕 [P17-01] */
    member: (_, row) => {
      if (row.memberId === RESERVED_IDS.SHARED_MEMBER) return '🏠 家庭共用';
      if (!row.memberId) return '—';
      const name = resolveName('members', row.memberId);
      _dbg('settlements.member', row.memberId, name);
      return escapeHtml(name || row.memberId);
    },
    name: (val) => escapeHtml(val || '—'),
    amount: (val) => formatHKD(val),
    date: (val) => escapeHtml(val || '—'),
    status: (val, row) => {
      const cls = statusBadgeClass(val);
      return `<span class="badge ${cls}">${escapeHtml(statusLabel(val, { source: row.source }))}</span>`;
    },
  },
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
    memberName: (val) => {
      if (!val) return '—';
      const name = resolveName('members', val);
      return escapeHtml(name || val);
    },
    amount: (val, row) => {
      const cls = row.type === 'in' ? 'text-emerald' : 'text-red';
      const sign = row.type === 'in' ? '+' : '-';
      return `<span class="mono ${cls}">${sign}${formatHKD(val)}</span>`;
    },
    note: (val) => escapeHtml(val || '—'),
  },
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
  annualMonthly: {
    date: (val) => `<span class="mono" style="font-size:12px;">${escapeHtml(val || '—')}</span>`,
    memberName: (val) => escapeHtml(val || '—'),
    categoryName: (val) => val ? `<span class="badge badge-info">${escapeHtml(val)}</span>` : '<span class="badge badge-muted">—</span>',
    itemName: (val) => escapeHtml(val || '—'),
    name: (val) => escapeHtml(val || '—'),
    amount: (val) => `<span class="mono text-red">${formatHKD(val)}</span>`,
    status: (val) => `<span class="badge ${val && val.startsWith('已') ? 'badge-success' : 'badge-pending'}">${escapeHtml(val || '—')}</span>`,
  },
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
export function getColumns(key) {
  const cols = COLUMNS[key];
  if (!cols) { console.warn(`[column-registry] 未知 key：${key}`); return []; }
  return cols.map((c) => ({ ...c }));
}

export function getResolvers(key) {
  const res = RESOLVERS[key];
  return res ? { ...res } : {};
}

export function getColumnsWith(key, extra = []) {
  return [...getColumns(key), ...extra];
}