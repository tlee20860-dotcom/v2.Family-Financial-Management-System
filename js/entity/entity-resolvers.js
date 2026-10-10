// ============================================
// entity-resolvers.js — Entity 欄位顯示 SSOT（v103.0.16）
// 位置：js/entity/entity-resolvers.js
// ============================================
// 職責：
//   每個 entity 的欄位 → HTML 顯示轉換
//   集中 1 處，避免散落各頁
// ============================================

import { esc } from '../lib/dom.js';
import { formatHKD, formatNumber } from '../lib/format.js';
import { resolveName } from '../config/entity-registry.js';
import { BANK_TXN_TYPE_LABELS, BANK_TXN_CATEGORY_LABELS } from '../config/constants.js';

export const RESOLVERS = {
  member: {
    name: (v) => esc(v || '—'),
    role: (v) => esc(v || '—'),
    order: (v) => formatNumber(v),
  },

  bank: {
    name: (v) => esc(v || '—'),
    order: (v) => formatNumber(v),
  },

  policy: {
    name: (v) => esc(v || '（未命名）'),
    company: (v) => esc(v || '—'),
    policyHolderId: (v) => v ? esc(resolveName('members', v) || v) : '—',
    memberId: (v) => v ? esc(resolveName('members', v) || v) : '—',
    firstStartYear: (v, r) => esc(`${v || ''}-${r.firstStartMonth || ''}`),
    annualPremium: (v) => `<span class="mono text-cyan">${formatHKD(v)}</span>`,
    totalPremium: (v) => `<span class="mono text-magenta">${formatHKD(v)}</span>`,
    monthlyPremium: (v) => `<span class="mono">${formatHKD(v)}</span>`,
    type: (v) => v === 'fund_insurance' ? '基金保險' : '普通保險',
    paymentMode: (v) => v === 'advance' ? '代墊' : '直接',
    paymentType: (v) => esc(v || '—'),
    currentPeriodIndex: (v) => `<span class="mono">${v || 1}</span>`,
    totalPolicyYears: (v) => `<span class="mono">${v || 0}</span>`,
  },

  fund: {
    name: (v) => esc(v || '（未命名）'),
    cost: (v) => `<span class="mono">${formatHKD(v)}</span>`,
    currentValue: (v) => `<span class="mono text-emerald">${formatHKD(v)}</span>`,
    units: (v) => `<span class="mono">${v || '—'}</span>`,
    note: (v) => esc(v || '—'),
  },

  category: {
    name: (v) => esc(v || '—'),
    order: (v) => formatNumber(v),
  },

  item: {
    name: (v) => esc(v || '—'),
    categoryId: (v) => v ? `<span class="badge badge-info">${esc(resolveName('categories', v) || v)}</span>` : '—',
  },

  payment: {
    name: (v) => esc(v || '—'),
    order: (v) => formatNumber(v),
  },

  status: {
    name: (v) => esc(v || '—'),
    category: (v) => {
      const map = { personal: '個人支出', fixed: '固定支出', insurance: '保險' };
      return esc(map[v] || v || '—');
    },
    isDone: (v) => v ? '<span class="badge badge-success">是</span>' : '<span class="badge badge-muted">否</span>',
    order: (v) => formatNumber(v),
  },
};

/* ============================================
   便利：拿某個 entity 的 resolvers
   ============================================ */
export function getEntityResolvers(entityKey) {
  const map = {
    member: 'member',
    bank: 'bank',
    policy: 'policy',
    fund: 'fund',
    category: 'category',
    item: 'item',
    payment: 'payment',
    status: 'status',
  };
  const key = map[entityKey];
  return key ? (RESOLVERS[key] || {}) : {};
}