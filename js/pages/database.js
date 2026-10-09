// ============================================
// dashboard.js — 總覽儀表板（v103.0.0 修正版）
// 位置：js/pages/dashboard.js
// ============================================
import { calcTotalBankBalance } from '../lib/bank.js';
import { formatHKD } from '../lib/format.js';
import { AppState } from '../core/state.js';

export default {
  title: '總覽儀表板',

  data: {
    bankAccounts: {
      type: 'list',
      path: 'bank_accounts',
      default: [],
    },
    bankTransactions: {
      type: 'object',                     // 🆕 拿原始物件
      path: 'bank_accounts',              // 🆕 不帶 {__all__}
      transform: _flattenTxns,
      default: [],
    },
  },

  state: {
    currentYear:  String(AppState.year  || new Date().getFullYear()),
    currentMonth: String(AppState.month || '12'),
  },

  derived: {
    totalBankBalance: {
      deps: ['data.bankAccounts', 'data.bankTransactions', 'state.currentYear', 'state.currentMonth'],
      compute: (accounts, txns, year, month) => {
        const tM = month === 'all' ? '12' : (month || '12');
        return calcTotalBankBalance(accounts || [], txns || [], year, tM);
      },
    },

    statsCards: {
      deps: ['totalBankBalance', 'data.bankAccounts', 'state.currentYear'],
      compute: (totalBankBalance, accounts, year) => _buildStatsCards(totalBankBalance, accounts, year),
    },
  },

  blocks: [
    { type: 'stats', container: 'stats-cards-root', cards: '$.statsCards' },
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

function _buildStatsCards(totalBankBalance, accounts, year) {
  const list = Array.isArray(accounts) ? accounts : [];
  const bal = Number(totalBankBalance) || 0;

  return [
    {
      title: '家庭總餘額',
      value: formatHKD(bal),
      valueClass: bal >= 0 ? 'emerald' : 'red',
      hint: `共 ${list.length} 個銀行帳號`,
      icon: 'landmark',
    },
    {
      title: `${year} 家庭收入`,
      value: formatHKD(0),
      valueClass: 'emerald',
      hint: '（年度資料載入中）',
      icon: 'trending-up',
    },
    {
      title: `${year} 年度總支出`,
      value: formatHKD(0),
      valueClass: 'red',
      hint: '（年度資料載入中）',
      icon: 'trending-down',
    },
    {
      title: `${year} 年度淨餘額`,
      value: formatHKD(0),
      valueClass: 'emerald',
      hint: '（年度資料載入中）',
      icon: 'wallet',
    },
  ];
}
