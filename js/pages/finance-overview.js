// ============================================
// finance-overview.js — 銀行交易（v103.0.0 Page Schema）
// 位置：js/pages/finance-overview.js
// ============================================
import { createPage } from '../engines/page-engine.js';
import { formatHKD } from '../lib/format.js';
import { calcBankBalance, calcTotalBankBalance } from '../lib/bank.js';
import { initTabPanel } from '../ui/tab-panel.js';
import { AppState } from '../core/state.js';

export default {
  title: '銀行交易',

  data: {
    bankAccounts:     { type: 'list', path: 'bank_accounts' },
    bankTransactions: { type: 'list', path: 'bank_accounts/{__all__}', transform: _flattenTxns },
    members:          { type: 'list', path: 'members' },
  },

  state: {
    activeTab: 'banks',
    txFilters: { type: '', category: '', member: '' },
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
    { type: 'stats',  container: 'finance-stats-root', cards: '$.statsCards' },
    { type: 'filter', container: 'finance-txn-filter-root', fields: [], customFields: [
        { id: 'type',     label: '類型', options: [
          { value: '', label: '全部' }, { value: 'in', label: '入帳' },
          { value: 'out', label: '出帳' }, { value: 'transfer', label: '內部轉帳' },
        ]},
        { id: 'category', label: '分類', options: [
          { value: '', label: '全部' }, { value: 'contribution', label: '家用轉入' },
          { value: 'expense', label: '支出' }, { value: 'insurance', label: '保險' },
          { value: 'reimbursement', label: '代墊報銷' }, { value: 'manual', label: '手動' },
        ]},
      ], bind: 'state.txFilters' },
    { type: 'list', container: 'finance-txn-root', rows: '$.filteredTxns',
      columns: 'bankTransactions', tableId: 'finance-txn-table', view: 'table',
      emptyText: '此條件下尚無交易記錄' },
  ],
};

function _flattenTxns(raw) {
  const flat = [];
  Object.entries(raw || {}).forEach(([bankId, bank]) => {
    Object.entries(bank?.transactions || {}).forEach(([txnId, txn]) => {
      flat.push({ id: txnId, bankId, bankName: bank?.name || '', ...txn });
    });
  });
  return flat;
}

function _buildStats(accounts, txns, year, month) {
  const tM = month === 'all' ? '12' : (month || '12');
  const total = calcTotalBankBalance(accounts, txns, year, tM);
  const prefix = `${year}-${String(tM).padStart(2, '0')}`;
  const monthTxns = txns.filter((t) => (t.date || '').startsWith(prefix));
  const inTotal = monthTxns.filter((t) => t.type === 'in').reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const outTotal = monthTxns.filter((t) => t.type !== 'in').reduce((s, t) => s + (Number(t.amount) || 0), 0);

  return [
    { title: '家庭總餘額', value: formatHKD(total),
      valueClass: total >= 0 ? 'emerald' : 'red',
      hint: `共 ${accounts.length} 個銀行帳號`, icon: 'landmark' },
    { title: '本月入帳', value: formatHKD(inTotal), valueClass: 'emerald',
      hint: `${monthTxns.filter((t) => t.type === 'in').length} 筆`, icon: 'arrow-down-circle' },
    { title: '本月出帳', value: formatHKD(outTotal), valueClass: 'red',
      hint: `${monthTxns.filter((t) => t.type !== 'in').length} 筆`, icon: 'arrow-up-circle' },
    { title: '本月淨變動', value: formatHKD(inTotal - outTotal),
      valueClass: (inTotal - outTotal) >= 0 ? 'emerald' : 'red',
      hint: '入帳 − 出帳', icon: 'trending-up' },
  ];
}

function _filterTxns(txns, filters, year, month) {
  const tM = month === 'all' ? null : month;
  let out = txns;

  if (tM) {
    const prefix = `${year}-${String(tM).padStart(2, '0')}`;
    out = out.filter((t) => (t.date || '').startsWith(prefix));
  } else {
    out = out.filter((t) => (t.date || '').startsWith(year));
  }
  if (filters.type)     out = out.filter((t) => t.type === filters.type);
  if (filters.category) out = out.filter((t) => t.category === filters.category);
  if (filters.member)   out = out.filter((t) => t.memberId === filters.member);

  return [...out].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}
