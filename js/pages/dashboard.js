// ============================================
// dashboard.js — 總覽儀表板（v103.0.0 Page Schema）
// 位置：js/pages/dashboard.js
// ============================================
import { createPage } from '../engines/page-engine.js';
import { calcTotalBankBalance } from '../lib/bank.js';
import { formatHKD } from '../lib/format.js';
import { AppState } from '../core/state.js';

export default {
  title: '總覽儀表板',

  data: {
    bankAccounts:    { type: 'list', path: 'bank_accounts' },
    bankTransactions:{ type: 'list', path: 'bank_accounts/{__all__}', transform: _flattenTxns },
    members:         { type: 'list', path: 'members' },
  },

  state: {
    currentYear: String(AppState.year || new Date().getFullYear()),
    annualData:  {},
  },

  derived: {
    totalBankBalance: {
      deps: ['data.bankAccounts', 'data.bankTransactions', 'state.currentYear', 'state.currentMonth'],
      compute: (accounts, txns, year, month) => {
        const tM = month === 'all' ? '12' : (month || '12');
        return calcTotalBankBalance(accounts, txns, year, tM);
      },
    },
    statsCards: {
      deps: ['totalBankBalance', 'data.bankAccounts', 'state.currentYear', 'state.annualData'],
      compute: _buildStatsCards,
    },
  },

  blocks: [
    { type: 'stats',  container: 'stats-cards-root', cards: '$.statsCards' },
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

function _buildStatsCards(totalBankBalance, accounts, year, annualData) {
  const data = annualData?.[year] || {};
  return [
    { title: '家庭總餘額', value: formatHKD(totalBankBalance),
      valueClass: totalBankBalance >= 0 ? 'emerald' : 'red',
      hint: `共 ${accounts.length} 個銀行帳號`, icon: 'landmark' },
    { title: `${year} 家庭收入`, value: formatHKD(data.totalIncome || 0),
      valueClass: 'emerald', hint: '家用轉入加總', icon: 'trending-up' },
    { title: `${year} 年度總支出`, value: formatHKD(data.totalExpense || 0),
      valueClass: 'red', hint: '含保險平攤', icon: 'trending-down' },
    { title: `${year} 年度淨餘額`, value: formatHKD(data.netBalance || 0),
      valueClass: (data.netBalance || 0) >= 0 ? 'emerald' : 'red',
      hint: '家用轉入 − 支出', icon: 'wallet' },
  ];
}
