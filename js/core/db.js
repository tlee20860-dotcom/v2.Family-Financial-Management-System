// ============================================
// db.js — Firebase RTDB 讀寫封裝（v101.6.11）
// 位置：js/core/db.js
// ============================================
// v101.6.11 新增：
//   ✅ getCategoriesOnce() — 支出類別一次讀取
//   ✅ getItemsOnce() — 支出項目一次讀取
//       （供結算清單編輯 Modal 使用）
// ============================================

import { db } from '../config/firebase-config.js';
import { AppState } from './state.js';
import {
  RESERVED_IDS,
  LINKED_PREFIX,
  buildLinkedKey,
} from '../config/constants.js';
import {
  ref, onValue, push, set, update, remove, get,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

/* ============================================
   路徑工具
   ============================================ */

export function familyPath(subpath) {
  const familyId = AppState.getFamilyId();
  if (!familyId) throw new Error('尚未選擇家庭');
  return `families/${familyId}/${subpath}`;
}

export function familyRef(subpath) {
  return ref(db, familyPath(subpath));
}

function listen(subpath, callback, onError) {
  const familyId = AppState.getFamilyId();
  if (!familyId) {
    console.warn('⚠️ 尚未選擇家庭，略過 Firebase 讀取：', subpath);
    if (onError) onError(new Error('尚未選擇家庭'));
    return () => {};
  }
  const r = ref(db, `families/${familyId}/${subpath}`);
  return onValue(r, callback, (err) => {
    console.error(`❌ Firebase 讀取失敗 [${subpath}]：`, err);
    if (onError) onError(err);
  });
}

function listenList(subpath, sortFn, callback, onError) {
  return listen(subpath, (snap) => {
    const val = snap.val() || {};
    const list = Object.entries(val).map(([id, x]) => ({ id, ...x }));
    list.sort(sortFn);
    callback(list);
  }, onError);
}

const byCreatedAt = (a, b) => (a.createdAt || 0) - (b.createdAt || 0);
const byOrder = (a, b) => (a.order || 0) - (b.order || 0);
const byOrderThenCreated = (a, b) => {
  const oa = a.order != null ? a.order : Number.MAX_SAFE_INTEGER;
  const ob = b.order != null ? b.order : Number.MAX_SAFE_INTEGER;
  if (oa !== ob) return oa - ob;
  return (a.createdAt || 0) - (b.createdAt || 0);
};

const roundInt = (v) => Math.round(Number(v) || 0);

/* ============================================
   成員
   ============================================ */

export function listenMembers(cb, err) {
  return listenList('members', byOrderThenCreated, cb, err);
}

export async function getMembersOnce() {
  const snap = await get(familyRef('members'));
  const val = snap.val() || {};
  return Object.entries(val).map(([id, m]) => ({ id, ...m }));
}

export async function addMember(member) {
  const newRef = push(familyRef('members'));
  await set(newRef, {
    name: member.name || '',
    role: member.role || 'other',
    order: member.order != null ? Number(member.order) : 0,
    createdAt: Date.now(),
  });
  return newRef.key;
}

export async function updateMember(id, patch) {
  const clean = {};
  if (patch.name !== undefined) clean.name = String(patch.name).trim();
  if (patch.role !== undefined) clean.role = patch.role;
  if (patch.order !== undefined) clean.order = Number(patch.order) || 0;
  if (Object.keys(clean).length === 0) return;
  await update(familyRef(`members/${id}`), clean);
}

export async function removeMember(id) {
  await remove(familyRef(`members/${id}`));
}

export async function updateMemberOrders(orderMap) {
  const familyId = AppState.getFamilyId();
  if (!familyId) throw new Error('尚未選擇家庭');
  const updates = {};
  Object.entries(orderMap).forEach(([id, order]) => {
    updates[`families/${familyId}/members/${id}/order`] = Number(order);
  });
  await update(ref(db), updates);
}

export async function deleteMemberAndData(memberId) {
  const familyId = AppState.getFamilyId();
  if (!familyId) throw new Error('尚未選擇家庭');
  const expensesSnap = await get(ref(db, `families/${familyId}/expenses`));
  const allExpenses = expensesSnap.val() || {};
  const updates = {};

  Object.entries(allExpenses).forEach(([year, months]) => {
    Object.entries(months || {}).forEach(([month, monthData]) => {
      if (monthData.member_expenses && monthData.member_expenses[memberId]) {
        updates[`families/${familyId}/expenses/${year}/${month}/member_expenses/${memberId}`] = null;
      }
    });
  });

  updates[`families/${familyId}/members/${memberId}`] = null;
  await update(ref(db), updates);
}

/* ============================================
   銀行
   ============================================ */

export function listenBanks(cb, err) {
  return listenList('banks', byOrderThenCreated, cb, err);
}

export async function addBank(nameOrObj) {
  const name = typeof nameOrObj === 'string' ? nameOrObj : (nameOrObj?.name || '');
  const newRef = push(familyRef('banks'));
  await set(newRef, {
    name: String(name).trim(),
    order: 0,
    createdAt: Date.now(),
  });
  return newRef.key;
}

export async function updateBank(id, patch) {
  const clean = {};
  if (typeof patch === 'string') {
    clean.name = String(patch).trim();
  } else if (patch && typeof patch === 'object') {
    if (patch.name !== undefined) clean.name = String(patch.name).trim();
    if (patch.order !== undefined) clean.order = Number(patch.order) || 0;
  }
  if (Object.keys(clean).length === 0) return;
  await update(familyRef(`banks/${id}`), clean);
}

export async function removeBank(id) {
  await remove(familyRef(`banks/${id}`));
}

export async function deleteBankAndBalances(bankId) {
  const familyId = AppState.getFamilyId();
  if (!familyId) throw new Error('尚未選擇家庭');
  const snap = await get(ref(db, `families/${familyId}/bank_balances`));
  const allBalances = snap.val() || {};
  const updates = {};

  Object.entries(allBalances).forEach(([year, months]) => {
    Object.entries(months || {}).forEach(([month, banks]) => {
      if (banks && banks[bankId]) {
        updates[`families/${familyId}/bank_balances/${year}/${month}/${bankId}`] = null;
      }
    });
  });

  updates[`families/${familyId}/banks/${bankId}`] = null;
  await update(ref(db), updates);
}

/* ============================================
   銀行結餘
   ============================================ */

export function listenBankBalances(year, month, cb, err) {
  if (!year || !month) {
    const ym = AppState.getYearMonth();
    year = ym.year; month = ym.month;
  }
  return listen(`bank_balances/${year}/${month}`, (snap) => cb(snap.val() || {}), err);
}

export async function getBankBalancesOnce(year, month) {
  const snap = await get(familyRef(`bank_balances/${year}/${month}`));
  return snap.val() || {};
}

export async function saveBankBalance(year, month, bankId, amount) {
  if (!year || !month) {
    const ym = AppState.getYearMonth();
    year = ym.year; month = ym.month;
  }
  await update(familyRef(`bank_balances/${year}/${month}`), {
    [bankId]: { amount: roundInt(amount), updatedAt: Date.now() },
  });
}

export async function getPrevMonthBankTotal(year, month) {
  const y = Number(year);
  const m = Number(month);
  let prevY = y;
  let prevM = m - 1;
  if (prevM < 1) { prevY = y - 1; prevM = 12; }
  const prevMonthStr = String(prevM).padStart(2, '0');
  const snap = await get(familyRef(`bank_balances/${prevY}/${prevMonthStr}`));
  const val = snap.val() || {};
  return Object.values(val).reduce((s, b) => s + roundInt(b.amount), 0);
}

/* ============================================
   保險公司
   ============================================ */

export function listenInsuranceCompanies(cb, err) {
  return listenList('insurance_companies', byCreatedAt, cb, err);
}

export async function addInsuranceCompany(name) {
  const newRef = push(familyRef('insurance_companies'));
  await set(newRef, { name: name || '', createdAt: Date.now() });
  return newRef.key;
}

export async function updateInsuranceCompany(id, newName) {
  await update(familyRef(`insurance_companies/${id}`), { name: newName });
}

export async function removeInsuranceCompany(id) {
  await remove(familyRef(`insurance_companies/${id}`));
}

export async function updatePolicyCompanyName(oldName, newName) {
  const familyId = AppState.getFamilyId();
  if (!familyId) throw new Error('尚未選擇家庭');
  const snap = await get(ref(db, `families/${familyId}/insurance_policies`));
  const policies = snap.val() || {};
  const updates = {};
  Object.entries(policies).forEach(([id, p]) => {
    if (p.company === oldName) {
      updates[`families/${familyId}/insurance_policies/${id}/company`] = newName;
    }
  });
  if (Object.keys(updates).length > 0) await update(ref(db), updates);
  return Object.keys(updates).length;
}

/* ============================================
   支付方式
   ============================================ */

export function listenPaymentMethods(cb, err) {
  return listenList('payment_methods', byOrder, cb, err);
}

export async function addPaymentMethod(pm) {
  const newRef = push(familyRef('payment_methods'));
  await set(newRef, {
    name: pm.name || '',
    order: Number(pm.order) || 0,
    createdAt: Date.now(),
  });
  return newRef.key;
}

export async function updatePaymentMethod(id, patch) {
  const clean = {};
  if (patch.name !== undefined) clean.name = String(patch.name).trim();
  if (patch.order !== undefined) clean.order = Number(patch.order) || 0;
  if (Object.keys(clean).length === 0) return;
  await update(familyRef(`payment_methods/${id}`), clean);
}

export async function removePaymentMethod(id) {
  await remove(familyRef(`payment_methods/${id}`));
}

export async function getPaymentMethodsOnce() {
  const snap = await get(familyRef('payment_methods'));
  const val = snap.val() || {};
  const list = Object.entries(val).map(([id, p]) => ({ id, ...p }));
  list.sort(byOrder);
  return list;
}

/* ============================================
   支出類別 / 項目
   ============================================ */

export function listenCategories(cb, err) {
  return listenList('expense_categories', byOrder, cb, err);
}

// 🆕 v101.6.11：一次讀取（供結算清單編輯 Modal 使用）
export async function getCategoriesOnce() {
  const snap = await get(familyRef('expense_categories'));
  const val = snap.val() || {};
  const list = Object.entries(val).map(([id, c]) => ({ id, ...c }));
  list.sort(byOrder);
  return list;
}

export async function addCategory(cat) {
  const newRef = push(familyRef('expense_categories'));
  await set(newRef, {
    name: cat.name || '',
    order: Number(cat.order) || 0,
    createdAt: Date.now(),
  });
  return newRef.key;
}

export async function updateCategory(id, patch) {
  const clean = {};
  if (patch.name !== undefined) clean.name = String(patch.name).trim();
  if (patch.order !== undefined) clean.order = Number(patch.order) || 0;
  if (Object.keys(clean).length === 0) return;
  await update(familyRef(`expense_categories/${id}`), clean);
}

export async function removeCategory(id) {
  await remove(familyRef(`expense_categories/${id}`));
}

export function listenItems(cb, err) {
  return listenList('expense_items', byCreatedAt, cb, err);
}

// 🆕 v101.6.11：一次讀取（供結算清單編輯 Modal 使用）
export async function getItemsOnce() {
  const snap = await get(familyRef('expense_items'));
  const val = snap.val() || {};
  return Object.entries(val).map(([id, i]) => ({ id, ...i }));
}

export async function addItem(item) {
  const newRef = push(familyRef('expense_items'));
  await set(newRef, {
    name: item.name || '',
    categoryId: item.categoryId || '',
    createdAt: Date.now(),
  });
  return newRef.key;
}

export async function updateItem(id, patch) {
  const clean = {};
  if (patch.name !== undefined) clean.name = String(patch.name).trim();
  if (patch.categoryId !== undefined) clean.categoryId = patch.categoryId;
  if (Object.keys(clean).length === 0) return;
  await update(familyRef(`expense_items/${id}`), clean);
}

export async function removeItem(id) {
  await remove(familyRef(`expense_items/${id}`));
}

/* ============================================
   狀態清單
   ============================================ */

export function listenStatuses(cb, err) {
  return listenList('statuses', byOrder, cb, err);
}

export async function getStatusesOnce() {
  const snap = await get(familyRef('statuses'));
  const val = snap.val() || {};
  const list = Object.entries(val).map(([id, s]) => ({ id, ...s }));
  list.sort(byOrder);
  return list;
}

export async function addStatus(data) {
  const newRef = push(familyRef('statuses'));
  await set(newRef, {
    name: data.name || '',
    category: data.category || 'personal',
    isDone: !!data.isDone,
    order: Number(data.order) || 0,
    createdAt: Date.now(),
  });
  return newRef.key;
}

export async function updateStatus(id, patch) {
  const clean = {};
  if (patch.name !== undefined) clean.name = String(patch.name).trim();
  if (patch.category !== undefined) clean.category = patch.category;
  if (patch.isDone !== undefined) clean.isDone = !!patch.isDone;
  if (patch.order !== undefined) clean.order = Number(patch.order) || 0;
  if (Object.keys(clean).length === 0) return;
  await update(familyRef(`statuses/${id}`), clean);
}

export async function removeStatus(id) {
  await remove(familyRef(`statuses/${id}`));
}

/* ============================================
   家庭設定
   ============================================ */

export function listenFamilyOptions(cb, err) {
  return listen('settings/options', (snap) => cb(snap.val() || {}), err);
}

export async function saveFamilyOptions(options) {
  await set(familyRef('settings/options'), options || {});
}

export function listenYearRange(cb, err) {
  return listen('settings/year_range', (snap) => cb(snap.val() || {}), err);
}

export async function saveYearRange(data) {
  await set(familyRef('settings/year_range'), {
    startYear: data.startYear != null ? Number(data.startYear) : null,
    futureYears: Number(data.futureYears) || 5,
  });
}

export function listenUIConstants(cb, err) {
  return listen('settings/ui_constants', (snap) => cb(snap.val() || {}), err);
}

export async function saveUIConstants(data) {
  await set(familyRef('settings/ui_constants'), data || {});
}

/* ============================================
   平台預設資料庫
   ============================================ */

const PLATFORM_PATHS = {
  members: 'members',
  banks: 'banks',
  companies: 'insurance_companies',
  payments: 'payment_methods',
  categories: 'expense_categories',
  items: 'expense_items',
  statuses: 'statuses',
  options: 'options',
  yearRange: 'year_range',
  uiConstants: 'ui_constants',
};

function platformPath(resource) {
  const path = PLATFORM_PATHS[resource];
  if (!path) throw new Error(`未知的平台資源：${resource}`);
  return `platform/defaults/${path}`;
}

export function listenPlatformResource(resource, cb, err) {
  return onValue(
    ref(db, platformPath(resource)),
    (snap) => {
      const val = snap.val();
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        const list = Object.entries(val).map(([id, x]) => ({ id, ...x }));
        list.sort(byOrderThenCreated);
        cb(list);
      } else {
        cb(val || null);
      }
    },
    (e) => {
      console.error(`❌ 平台資源讀取失敗 [${resource}]：`, e);
      if (err) err(e);
    }
  );
}

export async function getPlatformResourceOnce(resource) {
  const snap = await get(ref(db, platformPath(resource)));
  return snap.val();
}

export async function putPlatformResource(resource, id, data) {
  if (id) {
    await set(ref(db, `${platformPath(resource)}/${id}`), data);
    return id;
  }
  const newRef = push(ref(db, platformPath(resource)));
  await set(newRef, data);
  return newRef.key;
}

export async function removePlatformResource(resource, id) {
  await remove(ref(db, `${platformPath(resource)}/${id}`));
}

export async function setPlatformResource(resource, data) {
  await set(ref(db, platformPath(resource)), data || {});
}

/* ============================================
   成員支出
   ============================================ */

function expensePath(year, month, memberId) {
  return `expenses/${year}/${month}/member_expenses/${memberId}`;
}

export function listenExpenses(year, month, memberId, cb, err) {
  if (!year || !month) {
    const ym = AppState.getYearMonth();
    year = ym.year; month = ym.month;
  }
  return listen(expensePath(year, month, memberId), (snap) => {
    const val = snap.val() || {};
    const list = Object.entries(val).map(([id, e]) => ({ id, ...e }));
    list.sort(byCreatedAt);
    cb(list);
  }, err);
}

export function listenAllExpenses(cb, err) {
  return listen('expenses', (snap) => {
    const val = snap.val() || {};
    const flat = [];
    Object.entries(val).forEach(([year, months]) => {
      Object.entries(months || {}).forEach(([month, monthData]) => {
        Object.entries(monthData.member_expenses || {}).forEach(([memberId, items]) => {
          Object.entries(items || {}).forEach(([id, exp]) => {
            flat.push({ id, memberId, year, month, ...exp });
          });
        });
      });
    });
    cb(flat);
  }, err);
}

export function listenAllMemberExpenses(year, month, cb, err) {
  if (!year || !month) {
    const ym = AppState.getYearMonth();
    year = ym.year; month = ym.month;
  }
  return listen(`expenses/${year}/${month}/member_expenses`, (snap) => {
    const val = snap.val() || {};
    const flat = [];
    Object.entries(val).forEach(([memberId, items]) => {
      Object.entries(items || {}).forEach(([id, exp]) => {
        flat.push({ id, memberId, ...exp });
      });
    });
    flat.sort(byCreatedAt);
    cb(flat);
  }, err);
}

export async function getAllMemberExpensesOnce(year, month) {
  const snap = await get(familyRef(`expenses/${year}/${month}/member_expenses`));
  const val = snap.val() || {};
  const flat = [];
  Object.entries(val).forEach(([memberId, items]) => {
    Object.entries(items || {}).forEach(([id, exp]) => {
      flat.push({ id, memberId, ...exp });
    });
  });
  flat.sort(byCreatedAt);
  return flat;
}

export async function getMemberExpensesForYear(year, memberId) {
  const familyId = AppState.getFamilyId();
  if (!familyId) throw new Error('尚未選擇家庭');
  if (!year || !memberId) return {};

  try {
    const snap = await get(ref(db, `families/${familyId}/expenses/${year}`));
    const yearData = snap.val() || {};

    const result = {};
    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, '0');
      const memberExpenses = yearData[mm]?.member_expenses?.[memberId] || {};
      const items = Object.entries(memberExpenses).map(([id, e]) => ({ id, ...e }));
      items.sort(byCreatedAt);
      result[mm] = items;
    }
    return result;
  } catch (e) {
    console.warn(`[db] getMemberExpensesForYear 讀取失敗：`, e);
    return {};
  }
}

export async function addExpense(year, month, memberId, expense) {
  if (!year || !month) {
    const ym = AppState.getYearMonth();
    year = ym.year; month = ym.month;
  }
  const newRef = push(familyRef(expensePath(year, month, memberId)));
  await set(newRef, {
    name: expense.name || '',
    amount: roundInt(expense.amount),
    status: expense.status || '未處理',
    date: expense.date || '',
    categoryId: expense.categoryId || '',
    itemId: expense.itemId || '',
    paymentMethodId: expense.paymentMethodId || '',
    isAutoLinked: expense.isAutoLinked || false,
    policyId: expense.policyId || '',
    createdAt: Date.now(),
  });
  return newRef.key;
}

export async function updateExpense(year, month, memberId, expId, patch) {
  if (!year || !month) {
    const ym = AppState.getYearMonth();
    year = ym.year; month = ym.month;
  }
  const clean = { ...patch };
  if (clean.amount != null) clean.amount = roundInt(clean.amount);
  await update(familyRef(`${expensePath(year, month, memberId)}/${expId}`), clean);
}

export async function removeExpense(year, month, memberId, expId) {
  if (!year || !month) {
    const ym = AppState.getYearMonth();
    year = ym.year; month = ym.month;
  }
  await remove(familyRef(`${expensePath(year, month, memberId)}/${expId}`));
}

export async function markMemberExpenseRepaid(year, month, memberId, expId, statusName) {
  await update(familyRef(`${expensePath(year, month, memberId)}/${expId}`), {
    status: statusName,
    repaidDate: statusName && statusName.startsWith('已')
      ? new Date().toISOString().slice(0, 10)
      : '',
  });
}

export async function batchUpdateExpenses(updates) {
  const familyId = AppState.getFamilyId();
  if (!familyId) throw new Error('尚未選擇家庭');

  const finalUpdates = {};

  for (const item of updates) {
    const { oldYear, oldMonth, oldMemberId, expenseId, data } = item;
    const newYear = data.year || oldYear;
    const newMonth = data.month || oldMonth;
    const newMemberId = data.memberId || oldMemberId;

    const pathChanged =
      newYear !== oldYear || newMonth !== oldMonth || newMemberId !== oldMemberId;

    if (pathChanged) {
      finalUpdates[
        `families/${familyId}/expenses/${oldYear}/${oldMonth}/member_expenses/${oldMemberId}/${expenseId}`
      ] = null;
      const newRef = push(
        ref(db, `families/${familyId}/expenses/${newYear}/${newMonth}/member_expenses/${newMemberId}`)
      );
      finalUpdates[
        `families/${familyId}/expenses/${newYear}/${newMonth}/member_expenses/${newMemberId}/${newRef.key}`
      ] = {
        name: data.name || '',
        amount: roundInt(data.amount),
        status: data.status || '未處理',
        date: data.date || '',
        categoryId: data.categoryId || '',
        itemId: data.itemId || '',
        paymentMethodId: data.paymentMethodId || '',
        isAutoLinked: false,
        createdAt: Date.now(),
      };
    } else {
      finalUpdates[
        `families/${familyId}/expenses/${oldYear}/${oldMonth}/member_expenses/${oldMemberId}/${expenseId}`
      ] = {
        name: data.name || '',
        amount: roundInt(data.amount),
        status: data.status || '未處理',
        date: data.date || '',
        categoryId: data.categoryId || '',
        itemId: data.itemId || '',
        paymentMethodId: data.paymentMethodId || '',
      };
    }
  }

  await update(ref(db), finalUpdates);
}

/* ============================================
   保險
   ============================================ */

export function listenInsurancePolicies(cb, err) {
  return listenList('insurance_policies', byCreatedAt, cb, err);
}

export async function getInsurancePoliciesOnce() {
  const snap = await get(familyRef('insurance_policies'));
  const val = snap.val() || {};
  const list = Object.entries(val).map(([id, p]) => ({ id, ...p }));
  list.sort(byCreatedAt);
  return list;
}

export async function addInsurancePolicy(policy) {
  const newRef = push(familyRef('insurance_policies'));
  await set(newRef, {
    type: policy.type || 'normal',
    memberId: policy.memberId || '',
    policyHolderId: policy.policyHolderId || '',
    name: policy.name || '',
    company: policy.company || '',
    paymentType: policy.paymentType || '年繳',
    firstStartYear: Number(policy.firstStartYear) || 0,
    firstStartMonth: String(policy.firstStartMonth || '01').padStart(2, '0'),
    totalPolicyYears: Number(policy.totalPolicyYears) || 0,
    totalPolicyPeriods: Number(policy.totalPolicyPeriods) || 0,
    totalPremium: roundInt(policy.totalPremium),
    currentPeriodIndex: Number(policy.currentPeriodIndex) || 1,
    account: policy.account || '',
    periods: policy.periods || {},
    createdAt: Date.now(),
  });
  return newRef.key;
}

export async function updateInsurancePolicy(id, patch) {
  const clean = {};
  const fields = [
    'type', 'memberId', 'policyHolderId', 'name', 'company', 'paymentType',
    'firstStartYear', 'firstStartMonth', 'totalPolicyYears', 'totalPolicyPeriods',
    'totalPremium', 'currentPeriodIndex', 'account', 'periods', 'isCompleted',
  ];
  fields.forEach((f) => {
    if (patch[f] !== undefined) clean[f] = patch[f];
  });
  if (clean.totalPremium != null) clean.totalPremium = roundInt(clean.totalPremium);
  if (Object.keys(clean).length === 0) return;
  await update(familyRef(`insurance_policies/${id}`), clean);
}

export async function removeInsurancePolicy(id) {
  await remove(familyRef(`insurance_policies/${id}`));
}

/**
 * 刪除保單與所有相關資料
 * @param {string} policyId
 * @param {string} [memberId] - 可選，若未提供會自動從 policy 讀取 policyHolderId
 */
export async function deleteInsurancePolicyAndData(policyId, memberId) {
  const familyId = AppState.getFamilyId();
  if (!familyId) throw new Error('尚未選擇家庭');

  // memberId fallback（v101.6.6 修正）
  let effectiveMemberId = memberId;
  if (!effectiveMemberId) {
    try {
      const policySnap = await get(ref(db, `families/${familyId}/insurance_policies/${policyId}`));
      const policy = policySnap.val();
      if (policy) {
        effectiveMemberId = policy.policyHolderId || policy.memberId || '';
      }
    } catch (e) {
      console.warn(`[db] deleteInsurancePolicyAndData: 讀取 policy 失敗`, e);
    }
  }

  const paymentsSnap = await get(ref(db, `families/${familyId}/insurance_payments/${policyId}`));
  const payments = paymentsSnap.val() || {};
  const updates = {};

  const linkedKey = buildLinkedKey(policyId);

  if (effectiveMemberId) {
    for (const [year, months] of Object.entries(payments)) {
      for (const [month] of Object.entries(months)) {
        updates[
          `families/${familyId}/expenses/${year}/${month}/member_expenses/${effectiveMemberId}/${linkedKey}`
        ] = null;
      }
    }
  } else {
    console.warn(`[db] deleteInsurancePolicyAndData: 保單 ${policyId} 找不到 policyHolderId / memberId，將略過連結支出清理`);
  }

  updates[`families/${familyId}/insurance_payments/${policyId}`] = null;
  updates[`families/${familyId}/insurance_policies/${policyId}`] = null;
  await update(ref(db), updates);
}

export async function addInsurancePeriod(policyId, periodIndex, periodData) {
  await set(familyRef(`insurance_policies/${policyId}/periods/${periodIndex}`), {
    periodIndex: Number(periodIndex),
    startYear: Number(periodData.startYear),
    startMonth: String(periodData.startMonth).padStart(2, '0'),
    annualPremium: roundInt(periodData.annualPremium),
    monthlyAverage: roundInt(periodData.monthlyAverage),
  });
}

export function listenInsurancePayment(policyId, year, month, cb, err) {
  return listen(`insurance_payments/${policyId}/${year}/${month}`, (snap) => cb(snap.val() || {}), err);
}

export async function getInsurancePaymentsOnce(policyId) {
  const snap = await get(familyRef(`insurance_payments/${policyId}`));
  return snap.val() || {};
}

export async function saveInsurancePaymentBatch(policyId, year, month, data) {
  await set(familyRef(`insurance_payments/${policyId}/${year}/${month}`), {
    status: data.status || '已扣款',
    amount: roundInt(data.amount),
    date: data.date || new Date().toISOString().slice(0, 10),
  });
}

export async function removeInsurancePaymentBatch(policyId, year, month) {
  await remove(familyRef(`insurance_payments/${policyId}/${year}/${month}`));
}

/* ============================================
   收入
   ============================================ */

export function listenIncome(year, month, cb, err) {
  if (!year || !month) {
    const ym = AppState.getYearMonth();
    year = ym.year; month = ym.month;
  }
  return listen(`income/${year}/${month}`, (snap) => cb(snap.val() || {}), err);
}

export async function getIncomeOnce(year, month) {
  const snap = await get(familyRef(`income/${year}/${month}`));
  return snap.val() || {};
}

export async function saveIncome(year, month, data) {
  if (!year || !month) {
    const ym = AppState.getYearMonth();
    year = ym.year; month = ym.month;
  }
  const clean = {};
  Object.entries(data).forEach(([key, val]) => {
    const num = roundInt(val);
    if (num > 0) clean[key] = num;
  });
  await set(familyRef(`income/${year}/${month}`), clean);
}

export function listenAllIncome(cb, err) {
  return listen('income', (snap) => {
    const val = snap.val() || {};
    const flat = [];
    Object.entries(val).forEach(([year, months]) => {
      Object.entries(months || {}).forEach(([month, data]) => {
        Object.entries(data || {}).forEach(([memberId, amount]) => {
          flat.push({ year, month, memberId, amount: roundInt(amount) });
        });
      });
    });
    cb(flat);
  }, err);
}

export async function updateIncomeEntry(year, month, memberId, amount) {
  const num = roundInt(amount);
  if (num > 0) {
    await update(familyRef(`income/${year}/${month}`), { [memberId]: num });
  } else {
    await remove(familyRef(`income/${year}/${month}/${memberId}`));
  }
}

export async function removeIncomeEntry(year, month, memberId) {
  await remove(familyRef(`income/${year}/${month}/${memberId}`));
}

/* ============================================
   基金
   ============================================ */

export function listenFunds(cb, err) {
  return listenList('funds', byCreatedAt, cb, err);
}

export async function getFundsOnce() {
  const snap = await get(familyRef('funds'));
  const val = snap.val() || {};
  return Object.entries(val).map(([id, f]) => ({ id, ...f }));
}

export async function addFund(fund) {
  const newRef = push(familyRef('funds'));
  await set(newRef, {
    name: fund.name || '',
    cost: roundInt(fund.cost),
    currentValue: roundInt(fund.currentValue),
    units: Number(fund.units) || 0,
    note: fund.note || '',
    createdAt: Date.now(),
  });
  return newRef.key;
}

export async function updateFund(id, patch) {
  const clean = {};
  if (patch.name !== undefined) clean.name = String(patch.name).trim();
  if (patch.cost !== undefined) clean.cost = roundInt(patch.cost);
  if (patch.currentValue !== undefined) clean.currentValue = roundInt(patch.currentValue);
  if (patch.units !== undefined) clean.units = Number(patch.units) || 0;
  if (patch.note !== undefined) clean.note = String(patch.note || '').trim();
  if (Object.keys(clean).length === 0) return;
  await update(familyRef(`funds/${id}`), clean);
}

export async function removeFund(id) {
  await remove(familyRef(`funds/${id}`));
}

/* ============================================
   跨來源改狀態（供 settlements 使用）
   ============================================ */

export async function updateEntityStatus(source, row, newStatus, isDone) {
  const today = new Date().toISOString().slice(0, 10);

  switch (source) {
    case 'personal': {
      const { memberId, expenseId } = row._ref;
      await updateExpense(row.year, row.month, memberId, expenseId, {
        status: newStatus,
        repaidDate: isDone ? today : '',
      });
      return;
    }
    case 'fixed': {
      const { id } = row._ref;
      await updateFixedExpenseCompat(row.year, row.month, id, {
        status: newStatus,
        paidDate: isDone ? today : '',
      });
      return;
    }
    case 'insurance': {
      throw new Error('保險狀態請使用 settlements/render.js 的 updateRowStatus');
    }
    default:
      throw new Error('未知的來源：' + source);
  }
}

/**
 * 固定支出相容函式（僅供 updateEntityStatus 使用）
 */
async function updateFixedExpenseCompat(year, month, id, patch) {
  const clean = { ...patch };
  if (clean.amount != null) clean.amount = roundInt(clean.amount);
  await update(familyRef(`fixed_expenses/${year}/${month}/${id}`), clean);
}

/* ============================================
   側邊欄排序
   ============================================ */

export function listenSidebarOrder(cb, err) {
  return listen('settings/sidebar_order', (snap) => {
    const val = snap.val();
    if (!val) { cb(null); return; }
    const arr = Array.isArray(val) ? val : Object.values(val);
    cb(arr.filter((x) => typeof x === 'string'));
  }, err);
}

export async function saveSidebarOrder(order) {
  if (!Array.isArray(order)) throw new Error('order 必須是陣列');
  await set(familyRef('settings/sidebar_order'), order);
}