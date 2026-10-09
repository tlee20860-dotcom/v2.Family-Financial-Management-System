// ============================================
// finance-overview.js — 銀行交易（v103.0.12 Page Schema）
// 位置：js/pages/finance-overview.js
// ============================================
// v103.0.12 修正：
//   ✅ [L06] 移除未使用的 createPage / calcBankBalance / initTabPanel / AppState
//   ✅ 修正 bankTransactions data path（用 raw 讀整個 bank_accounts）
// ============================================

import { formatHKD } from '../lib/format.js';
import { calcTotalBankBalance } from '../lib/bank.js';

export default {
  title: '銀行交易',

  data: {
    bankAccounts: {
      type: 'list',
      path: 'bank_accounts',
    },
    bankTransactions: {
      type: 'raw',
      path: 'bank_accounts',
      transform: _flattenTxns,
    },
    members: {
      type: 'list',
      path: 'members',
    },
  },

  state: {
    activeTab: 'banks',
    txFilters: { type: '', category: '', member: '' },
    currentYear: '',
    currentMonth: '',
  },

  derived: {
    statsCards: {
      deps: ['data.bankAccounts', 'data.bankTransactions', 'state.currentYear', 'state.currentMonth'],
      compute: _buildStats,
    },
    filteredTxns: {
      deps: ['data.bankTransactions', 'state.txFilters', 'state.currentYear', 'state.currentMonth'],
      compute: _filterTxns,
    },
  },

  blocks: [
    { type: 'stats', container: 'finance-stats-root', cards: '$.statsCards' },
    {
      type: 'filter',
      container: 'finance-txn-filter-root',
      fields: [],
      customFields: [
        { id: 'type', label: '類型', options: [
          { value: '', label: '全部' }, { value: 'in', label: '入帳' },
          { value: 'out', label: '出帳' }, { value: 'transfer', label: '內部轉帳' },
        ]},
        { id: 'category', label: '分類', options: [
          { value: '', label: '全部' }, { value: 'contribution', label: '家用轉入' },
          { value: 'expense', label: '支出' }, { value: 'insurance', label: '保險' },
          { value: 'reimbursement', label: '代墊報銷' }, { value: 'manual', label: '手動' },
        ]},
      ],
      bind: 'state.txFilters',
    },
    {
      type: 'list',
      container: 'finance-txn-root',
      rows: '$.filteredTxns',
      columns: 'bankTransactions',
      tableId: 'finance-txn-table',
      view: 'table',
      emptyText: '此條件下尚無交易記錄',
    },
  ],
};

/* ============================================
   Helpers
   ============================================ */
function _flattenTxns(rawAccounts) {
  const flat = [];
  Object.entries(rawAccounts || {}).forEach(([bankId, bank]) => {
    Object.entries(bank?.transactions || {}).forEach(([txnId, txn]) => {
      flat.push({ id: txnId, bankId, bankName: bank?.name || '', ...txn });
    });
  });
  return flat;
}

function _buildStats(accounts, txns, year, month) {
  const list = accounts || [];
  const txnList = txns || [];
  const tM = month === 'all' ? '12' : (month || '12');
  const y = year || String(new Date().getFullYear());

  const total = calcTotalBankBalance(list, txnList, y, tM);
  const prefix = `${y}-${String(tM).padStart(2, '0')}`;
  const monthTxns = txnList.filter((t) => (t.date || '').startsWith(prefix));
  const inTotal = monthTxns.filter((t) => t.type === 'in').reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const outTotal = monthTxns.filter((t) => t.type !== 'in').reduce((s, t) => s + (Number(t.amount) || 0), 0);

  return [
    {
      title: '家庭總餘額',
      value: formatHKD(total),
      valueClass: total >= 0 ? 'emerald' : 'red',
      hint: `共 ${list.length} 個銀行帳號`,
      icon: 'landmark',
    },
    {
      title: '本月入帳',
      value: formatHKD(inTotal),
      valueClass: 'emerald',
      hint: `${monthTxns.filter((t) => t.type === 'in').length} 筆`,
      icon: 'arrow-down-circle',
    },
    {
      title: '本月出帳',
      value: formatHKD(outTotal),
      valueClass: 'red',
      hint: `${monthTxns.filter((t) => t.type !== 'in').length} 筆`,
      icon: 'arrow-up-circle',
    },
    {
      title: '本月淨變動',
      value: formatHKD(inTotal - outTotal),
      valueClass: (inTotal - outTotal) >= 0 ? 'emerald' : 'red',
      hint: '入帳 − 出帳',
      icon: 'trending-up',
    },
  ];
}

function _filterTxns(txns, filters, year, month) {
  const list = txns || [];
  const y = year || String(new Date().getFullYear());
  const tM = month === 'all' ? null : (month || null);
  let out = list;

  if (tM) {
    const prefix = `${y}-${String(tM).padStart(2, '0')}`;
    out = out.filter((t) => (t.date || '').startsWith(prefix));
  } else {
    out = out.filter((t) => (t.date || '').startsWith(y));
  }
  if (filters.type)     out = out.filter((t) => t.type === filters.type);
  if (filters.category) out = out.filter((t) => t.category === filters.category);
  if (filters.member)   out = out.filter((t) => t.memberId === filters.member);

  return [...out].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}