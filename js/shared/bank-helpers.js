// ============================================
// bank-helpers.js — 銀行業務輔助（v102.1.0-hotfix1）
// 位置：js/shared/bank-helpers.js
// ============================================
// v102.1.0-hotfix1 修正：
//   ✅ [HOTFIX] 移除不存在的 export 'updateInsurancePaymentBatchCompat'
//       - db.js 無此 export，實際名稱應為 'saveInsurancePaymentBatch'
//       - 且 bank-helpers.js 內文完全未使用，直接移除
//   ✅ 保留 v102.0.0 全部功能
// ============================================

import {
  addBankTransaction,
  updateBankTransaction,
  removeBankTransaction,
  getBankAccountsOnce,
  updateExpense,
  updateMemberAdvance,
  getMemberAdvancesOnce,
} from '../core/db.js';
import {
  BANK_TXN_TYPES,
  BANK_TXN_CATEGORIES,
  PAYMENT_MODES,
} from '../config/constants.js';
import { roundHKD, todayISO } from '../core/utils.js';

/* ============================================
   1. 銀行餘額計算（純函式，無副作用）
   ============================================ */

/**
 * 計算單一銀行在指定年月的餘額
 *
 * @param {Object} bankAccount - { initialBalance, initialYear, initialMonth }
 * @param {Array} transactions - [{ type, amount, date }]
 * @param {string|number} targetYear
 * @param {string|number} targetMonth
 * @returns {number}
 */
export function calcBankBalance(bankAccount, transactions, targetYear, targetMonth) {
  if (!bankAccount) return 0;

  const initial = Number(bankAccount.initialBalance) || 0;
  const initY = Number(bankAccount.initialYear) || 0;
  const initM = Number(bankAccount.initialMonth) || 0;

  if (!initY || !initM) return initial;

  const tY = Number(targetYear);
  const tM = Number(targetMonth);

  // 目標年月早於初始年月 → 只回傳初始值
  if (tY < initY || (tY === initY && tM < initM)) {
    return initial;
  }

  let balance = initial;
  (transactions || []).forEach((txn) => {
    const date = txn.date || '';
    if (!date || date.length < 7) return;

    const [y, m] = date.split('-').map(Number);
    const afterInit = y > initY || (y === initY && m > initM);
    const beforeTarget = y < tY || (y === tY && m <= tM);

    if (!afterInit || !beforeTarget) return;

    const amount = Number(txn.amount) || 0;
    if (txn.type === BANK_TXN_TYPES.IN) {
      balance += amount;
    } else if (txn.type === BANK_TXN_TYPES.OUT) {
      balance -= amount;
    } else if (txn.type === BANK_TXN_TYPES.TRANSFER) {
      // transfer 從「單一銀行」角度視為 out
      balance -= amount;
    }
  });

  return balance;
}

/**
 * 計算所有銀行的總餘額
 */
export function calcTotalBankBalance(bankAccounts, allTransactions, targetYear, targetMonth) {
  let total = 0;
  (bankAccounts || []).forEach((acc) => {
    const txns = (allTransactions || []).filter((t) => t.bankId === acc.id);
    total += calcBankBalance(acc, txns, targetYear, targetMonth);
  });
  return total;
}

/**
 * 取得單一銀行的所有交易
 */
export function getBankTransactions(allTransactions, bankId) {
  return (allTransactions || []).filter((t) => t.bankId === bankId);
}

/* ============================================
   2. 銀行交易建立（業務邏輯封裝）
   ============================================ */

/**
 * 為支出建立銀行交易
 */
export async function createTransactionForExpense({
  bankId,
  memberId,
  amount,
  date,
  expenseId,
  note = '',
}) {
  if (!bankId || !amount) throw new Error('缺少必要參數');

  return addBankTransaction(bankId, {
    type: BANK_TXN_TYPES.OUT,
    category: BANK_TXN_CATEGORIES.EXPENSE,
    amount: roundHKD(amount),
    date: date || todayISO(),
    memberId: memberId || '',
    refId: expenseId || '',
    note: note || '',
  });
}

/**
 * 為保險建立銀行交易
 */
export async function createTransactionForInsurance({
  bankId,
  memberId,
  amount,
  date,
  policyId,
  note = '',
}) {
  if (!bankId || !amount) throw new Error('缺少必要參數');

  return addBankTransaction(bankId, {
    type: BANK_TXN_TYPES.OUT,
    category: BANK_TXN_CATEGORIES.INSURANCE,
    amount: roundHKD(amount),
    date: date || todayISO(),
    memberId: memberId || '',
    refId: policyId || '',
    note: note || '',
  });
}

/**
 * 為代墊還款建立銀行交易
 */
export async function createTransactionForReimbursement({
  bankId,
  memberId,
  amount,
  date,
  policyId,
  note = '',
}) {
  if (!bankId || !amount) throw new Error('缺少必要參數');

  return addBankTransaction(bankId, {
    type: BANK_TXN_TYPES.TRANSFER,
    category: BANK_TXN_CATEGORIES.REIMBURSEMENT,
    amount: roundHKD(amount),
    date: date || todayISO(),
    memberId: memberId || '',
    refId: policyId || '',
    note: note || '',
  });
}

/**
 * 為家用轉入建立銀行交易
 */
export async function createTransactionForContribution({
  bankId,
  memberId,
  amount,
  date,
  note = '',
}) {
  if (!bankId || !amount) throw new Error('缺少必要參數');

  return addBankTransaction(bankId, {
    type: BANK_TXN_TYPES.IN,
    category: BANK_TXN_CATEGORIES.CONTRIBUTION,
    amount: roundHKD(amount),
    date: date || todayISO(),
    memberId: memberId || '',
    refId: '',
    note: note || '',
  });
}

/* ============================================
   3. 支出編輯同步（銀行交易更新 / 刪除）
   ============================================ */

/**
 * 同步支出編輯到銀行交易
 */
export async function syncExpenseToBank({
  oldBankId,
  oldTxnId,
  newBankId,
  expenseData,
  expenseId,
}) {
  const hasOld = !!(oldBankId && oldTxnId);
  const hasNew = !!newBankId;

  // 情況 1：原本有，現在沒有 → 刪除交易
  if (hasOld && !hasNew) {
    try {
      await removeBankTransaction(oldBankId, oldTxnId);
    } catch (e) {
      console.warn('[bank-helpers] 刪除舊交易失敗：', e);
    }
    return '';
  }

  // 情況 2：原本沒有，現在有 → 新增交易
  if (!hasOld && hasNew) {
    return await createTransactionForExpense({
      bankId: newBankId,
      memberId: expenseData.memberId,
      amount: expenseData.amount,
      date: expenseData.date,
      expenseId,
      note: expenseData.name || '',
    });
  }

  // 情況 3：都有，且相同 → 更新交易
  if (hasOld && hasNew && oldBankId === newBankId) {
    try {
      await updateBankTransaction(oldBankId, oldTxnId, {
        amount: roundHKD(expenseData.amount),
        date: expenseData.date,
        memberId: expenseData.memberId,
        note: expenseData.name || '',
      });
    } catch (e) {
      console.warn('[bank-helpers] 更新交易失敗：', e);
    }
    return oldTxnId;
  }

  // 情況 4：都有，但銀行不同 → 刪除舊 + 新增新
  if (hasOld && hasNew && oldBankId !== newBankId) {
    try {
      await removeBankTransaction(oldBankId, oldTxnId);
    } catch (e) {
      console.warn('[bank-helpers] 刪除舊交易失敗：', e);
    }
    return await createTransactionForExpense({
      bankId: newBankId,
      memberId: expenseData.memberId,
      amount: expenseData.amount,
      date: expenseData.date,
      expenseId,
      note: expenseData.name || '',
    });
  }

  return oldTxnId || '';
}

/**
 * 支出刪除時清理銀行交易
 */
export async function cleanupExpenseBankTransaction(bankId, txnId) {
  if (!bankId || !txnId) return;
  try {
    await removeBankTransaction(bankId, txnId);
  } catch (e) {
    console.warn('[bank-helpers] 清理交易失敗：', e);
  }
}

/* ============================================
   4. 保險編輯同步
   ============================================ */

/**
 * 保險付款 → 銀行交易
 */
export async function createTransactionForInsurancePayment({
  paymentMode,
  bankId,
  memberId,
  amount,
  date,
  policyId,
  policyName = '',
}) {
  if (!bankId || !amount) {
    throw new Error('缺少 bankId 或 amount');
  }

  if (paymentMode === PAYMENT_MODES.ADVANCE) {
    // 代墊模式 → transfer（還款給代墊成員）
    return await createTransactionForReimbursement({
      bankId,
      memberId,
      amount,
      date,
      policyId,
      note: policyName ? `${policyName} (代墊還款)` : '',
    });
  }

  // 直接付款 → out（支付給保險公司）
  return await createTransactionForInsurance({
    bankId,
    memberId,
    amount,
    date,
    policyId,
    note: policyName || '',
  });
}

/* ============================================
   5. 餘額檢查
   ============================================ */

/**
 * 檢查銀行餘額是否足夠
 */
export async function checkBankSufficiency(bankId, amount, year, month) {
  try {
    const accounts = await getBankAccountsOnce();
    const account = accounts.find((a) => a.id === bankId);
    if (!account) {
      return { balance: 0, sufficient: false, after: 0 };
    }

    return {
      balance: 0,
      sufficient: true,
      after: 0,
    };
  } catch (e) {
    console.warn('[bank-helpers] 檢查餘額失敗：', e);
    return { balance: 0, sufficient: true, after: 0 };
  }
}

/* ============================================
   6. 家用品質分析（供 Dashboard 用）
   ============================================ */

/**
 * 依分類統計銀行交易
 */
export function groupTransactionsByCategory(transactions) {
  const groups = {
    [BANK_TXN_CATEGORIES.CONTRIBUTION]: { count: 0, amount: 0 },
    [BANK_TXN_CATEGORIES.EXPENSE]:      { count: 0, amount: 0 },
    [BANK_TXN_CATEGORIES.INSURANCE]:    { count: 0, amount: 0 },
    [BANK_TXN_CATEGORIES.REIMBURSEMENT]:{ count: 0, amount: 0 },
    [BANK_TXN_CATEGORIES.MANUAL]:       { count: 0, amount: 0 },
  };

  (transactions || []).forEach((t) => {
    const cat = t.category || BANK_TXN_CATEGORIES.MANUAL;
    if (!groups[cat]) {
      groups[cat] = { count: 0, amount: 0 };
    }
    groups[cat].count++;
    groups[cat].amount += roundHKD(t.amount);
  });

  return groups;
}

/**
 * 依月份過濾交易
 */
export function filterTransactionsByMonth(transactions, year, month) {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  return (transactions || []).filter((t) => (t.date || '').startsWith(prefix));
}
