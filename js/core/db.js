// db.js — Firebase RTDB 讀寫封裝（v103.0.21）
import { db } from '../config/firebase-config.js';
import { AppState } from './state.js';
import { RESERVED_IDS, buildLinkedKey, PLATFORM_RESOURCES } from '../config/constants.js';
import { normalize as normalizeStatus } from '../config/status-registry.js';
import { ref, onValue, push, set, update, remove, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const roundInt = (v) => Math.round(Number(v) || 0);
const byCreatedAt = (a, b) => (a.createdAt || 0) - (b.createdAt || 0);
const byOrder = (a, b) => (a.order || 0) - (b.order || 0);
const byOrderThenCreated = (a, b) => {
  const oa = a.order != null ? a.order : Number.MAX_SAFE_INTEGER;
  const ob = b.order != null ? b.order : Number.MAX_SAFE_INTEGER;
  if (oa !== ob) return oa - ob;
  return (a.createdAt || 0) - (b.createdAt || 0);
};

export function familyPath(subpath) {
  const familyId = AppState.getFamilyId();
  if (!familyId) throw new Error('尚未選擇家庭');
  return `families/${familyId}/${subpath}`;
}
export function familyRef(subpath) { return ref(db, familyPath(subpath)); }

function listen(subpath, callback, onError) {
  const familyId = AppState.getFamilyId();
  if (!familyId) { if (onError) onError(new Error('尚未選擇家庭')); return () => {}; }
  return onValue(ref(db, `families/${familyId}/${subpath}`), callback, (err) => {
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

/* ============ 成員 ============ */
export function listenMembers(cb, err) { return listenList('members', byOrderThenCreated, cb, err); }
export async function getMembersOnce() {
  const snap = await get(familyRef('members'));
  return Object.entries(snap.val() || {}).map(([id, m]) => ({ id, ...m }));
}
export async function addMember(m) {
  const r = push(familyRef('members'));
  await set(r, { name: m.name || '', role: m.role || 'other', order: m.order != null ? Number(m.order) : 0, createdAt: Date.now() });
  return r.key;
}
export async function updateMember(id, p) {
  const c = {};
  if (p.name !== undefined) c.name = String(p.name).trim();
  if (p.role !== undefined) c.role = p.role;
  if (p.order !== undefined) c.order = Number(p.order) || 0;
  if (!Object.keys(c).length) return;
  await update(familyRef(`members/${id}`), c);
}
export async function removeMember(id) { await remove(familyRef(`members/${id}`)); }
export async function deleteMemberAndData(memberId) {
  const fid = AppState.getFamilyId(); if (!fid) throw new Error('尚未選擇家庭');
  const snap = await get(ref(db, `families/${fid}/expenses`));
  const up = {};
  Object.entries(snap.val() || {}).forEach(([y, ms]) => {
    Object.entries(ms || {}).forEach(([m, md]) => {
      if (md.member_expenses && md.member_expenses[memberId]) up[`families/${fid}/expenses/${y}/${m}/member_expenses/${memberId}`] = null;
    });
  });
  up[`families/${fid}/members/${memberId}`] = null;
  up[`families/${fid}/personal_income/${memberId}`] = null;
  await update(ref(db), up);
}

/* ============ 銀行（舊） ============ */
export function listenBanks(cb, err) { return listenList('banks', byOrderThenCreated, cb, err); }
export async function addBank(x) {
  const name = typeof x === 'string' ? x : (x?.name || '');
  const r = push(familyRef('banks'));
  await set(r, { name: String(name).trim(), order: 0, createdAt: Date.now() });
  return r.key;
}
export async function updateBank(id, p) {
  const c = {};
  if (typeof p === 'string') c.name = String(p).trim();
  else if (p && typeof p === 'object') {
    if (p.name !== undefined) c.name = String(p.name).trim();
    if (p.order !== undefined) c.order = Number(p.order) || 0;
  }
  if (!Object.keys(c).length) return;
  await update(familyRef(`banks/${id}`), c);
}
export async function removeBank(id) { await remove(familyRef(`banks/${id}`)); }
export async function deleteBankAndBalances(bid) {
  const fid = AppState.getFamilyId(); if (!fid) throw new Error('尚未選擇家庭');
  const snap = await get(ref(db, `families/${fid}/bank_balances`));
  const up = {};
  Object.entries(snap.val() || {}).forEach(([y, ms]) => {
    Object.entries(ms || {}).forEach(([m, bs]) => {
      if (bs && bs[bid]) up[`families/${fid}/bank_balances/${y}/${m}/${bid}`] = null;
    });
  });
  up[`families/${fid}/banks/${bid}`] = null;
  await update(ref(db), up);
}

/* ============ 銀行帳號 ============ */
export function listenBankAccounts(cb, err) { return listenList('bank_accounts', byOrderThenCreated, cb, err); }
export async function getBankAccountsOnce() {
  const snap = await get(familyRef('bank_accounts'));
  return Object.entries(snap.val() || {}).map(([id, b]) => ({ id, ...b }));
}
export async function addBankAccount(d) {
  const r = push(familyRef('bank_accounts'));
  await set(r, {
    name: String(d.name || '').trim(),
    type: d.type || 'family',
    ownerType: d.ownerType || 'family',
    ownerId: d.ownerId || 'family',
    isSystemCreated: !!d.isSystemCreated,
    initialBalance: roundInt(d.initialBalance),
    initialYear: String(d.initialYear || new Date().getFullYear()),
    initialMonth: String(d.initialMonth || '01').padStart(2, '0'),
    order: Number(d.order) || 0,
    createdAt: Date.now(),
  });
  return r.key;
}
export async function updateBankAccount(id, p) {
  const c = {};
  ['name', 'type', 'ownerType', 'ownerId'].forEach((k) => { if (p[k] !== undefined) c[k] = p[k]; });
  if (p.name !== undefined) c.name = String(p.name).trim();
  if (p.isSystemCreated !== undefined) c.isSystemCreated = !!p.isSystemCreated;
  if (p.initialBalance !== undefined) c.initialBalance = roundInt(p.initialBalance);
  if (p.initialYear !== undefined) c.initialYear = String(p.initialYear);
  if (p.initialMonth !== undefined) c.initialMonth = String(p.initialMonth).padStart(2, '0');
  if (p.order !== undefined) c.order = Number(p.order) || 0;
  if (!Object.keys(c).length) return;
  await update(familyRef(`bank_accounts/${id}`), c);
}
export async function removeBankAccount(id) { await remove(familyRef(`bank_accounts/${id}`)); }

/* ============ 銀行交易 ============ */
export function listenBankTransactions(bid, cb, err) {
  if (!bid) return () => {};
  return listenList(`bank_accounts/${bid}/transactions`, byCreatedAt, cb, err);
}
export function listenAllBankTransactions(cb, err) {
  return listen('bank_accounts', (snap) => {
    const val = snap.val() || {};
    const flat = [];
    Object.entries(val).forEach(([bid, bd]) => {
      Object.entries(bd.transactions || {}).forEach(([tid, txn]) => {
        flat.push({ id: tid, bankId: bid, bankName: bd.name || '', ...txn });
      });
    });
    flat.sort(byCreatedAt);
    cb(flat);
  }, err);
}
export async function getBankTransactionsOnce(bid) {
  if (!bid) return [];
  const snap = await get(familyRef(`bank_accounts/${bid}/transactions`));
  return Object.entries(snap.val() || {}).map(([id, t]) => ({ id, ...t })).sort(byCreatedAt);
}
export async function addBankTransaction(bid, d) {
  if (!bid) throw new Error('缺少 bankId');
  const r = push(familyRef(`bank_accounts/${bid}/transactions`));
  await set(r, {
    type: d.type || 'manual', category: d.category || 'manual',
    amount: roundInt(d.amount),
    date: d.date || new Date().toISOString().slice(0, 10),
    memberId: d.memberId || '', refId: d.refId || '', note: d.note || '',
    createdAt: Date.now(),
  });
  return r.key;
}
export async function updateBankTransaction(bid, tid, p) {
  if (!bid || !tid) throw new Error('缺少參數');
  const c = {};
  ['type', 'category', 'amount', 'date', 'memberId', 'refId', 'note'].forEach((k) => { if (p[k] !== undefined) c[k] = p[k]; });
  if (c.amount != null) c.amount = roundInt(c.amount);
  if (!Object.keys(c).length) return;
  c.updatedAt = Date.now();
  await update(familyRef(`bank_accounts/${bid}/transactions/${tid}`), c);
}
export async function removeBankTransaction(bid, tid) {
  if (!bid || !tid) throw new Error('缺少參數');
  await remove(familyRef(`bank_accounts/${bid}/transactions/${tid}`));
}

/* ============ 個人收入 ============ */
export function listenPersonalIncome(mid, cb, err) {
  if (!mid) return () => {};
  return listen(`personal_income/${mid}`, (snap) => cb(snap.val() || {}), err);
}
export function listenAllPersonalIncome(cb, err) { return listen('personal_income', (s) => cb(s.val() || {}), err); }
export async function getPersonalIncomeOnce(mid) {
  if (!mid) return {};
  const snap = await get(familyRef(`personal_income/${mid}`));
  return snap.val() || {};
}
export async function savePersonalIncome(mid, y, m, amt) {
  if (!mid || !y || !m) throw new Error('缺少參數');
  const n = roundInt(amt);
  const path = `personal_income/${mid}/${y}`;
  if (n > 0) await update(familyRef(path), { [String(m).padStart(2, '0')]: n });
  else await remove(familyRef(`${path}/${String(m).padStart(2, '0')}`));
}
export async function removePersonalIncomeEntry(mid, y, m) {
  if (!mid || !y || !m) throw new Error('缺少參數');
  await remove(familyRef(`personal_income/${mid}/${y}/${String(m).padStart(2, '0')}`));
}

/* ============ 成員代墊 ============ */
export function listenMemberAdvances(mid, cb, err) {
  if (!mid) return () => {};
  return listenList(`member_advances/${mid}`, byCreatedAt, cb, err);
}
export function listenAllMemberAdvances(cb, err) {
  return listen('member_advances', (snap) => {
    const val = snap.val() || {};
    const flat = [];
    Object.entries(val).forEach(([mid, ad]) => {
      Object.entries(ad || {}).forEach(([aid, adv]) => flat.push({ id: aid, memberId: mid, ...adv }));
    });
    flat.sort(byCreatedAt);
    cb(flat);
  }, err);
}
export async function getMemberAdvancesOnce(mid) {
  if (!mid) return [];
  const snap = await get(familyRef(`member_advances/${mid}`));
  return Object.entries(snap.val() || {}).map(([id, a]) => ({ id, ...a })).sort(byCreatedAt);
}
export async function addMemberAdvance(mid, d) {
  if (!mid) throw new Error('缺少 memberId');
  const r = push(familyRef(`member_advances/${mid}`));
  await set(r, {
    policyId: d.policyId || '',
    totalAmount: roundInt(d.totalAmount),
    remainingAmount: roundInt(d.totalAmount),
    startYear: String(d.startYear || ''),
    startMonth: String(d.startMonth || '').padStart(2, '0'),
    note: d.note || '',
    createdAt: Date.now(),
  });
  return r.key;
}
export async function updateMemberAdvance(mid, aid, p) {
  if (!mid || !aid) throw new Error('缺少參數');
  const c = {};
  ['policyId', 'totalAmount', 'remainingAmount', 'startYear', 'startMonth', 'note'].forEach((k) => { if (p[k] !== undefined) c[k] = p[k]; });
  if (c.totalAmount != null) c.totalAmount = roundInt(c.totalAmount);
  if (c.remainingAmount != null) c.remainingAmount = roundInt(c.remainingAmount);
  if (!Object.keys(c).length) return;
  c.updatedAt = Date.now();
  await update(familyRef(`member_advances/${mid}/${aid}`), c);
}
export async function removeMemberAdvance(mid, aid) {
  if (!mid || !aid) throw new Error('缺少參數');
  await remove(familyRef(`member_advances/${mid}/${aid}`));
}

/* ============ 銀行結餘（舊） ============ */
export function listenBankBalances(y, m, cb, err) {
  if (!y || !m) { const ym = AppState.getYearMonth(); y = ym.year; m = ym.month; }
  return listen(`bank_balances/${y}/${m}`, (s) => cb(s.val() || {}), err);
}
export async function getBankBalancesOnce(y, m) {
  const snap = await get(familyRef(`bank_balances/${y}/${m}`));
  return snap.val() || {};
}
export async function saveBankBalance(y, m, bid, amt) {
  if (!y || !m) { const ym = AppState.getYearMonth(); y = ym.year; m = ym.month; }
  await update(familyRef(`bank_balances/${y}/${m}`), { [bid]: { amount: roundInt(amt), updatedAt: Date.now() } });
}
export async function getPrevMonthBankTotal(y, m) {
  const yy = Number(y), mm = Number(m);
  let py = yy, pm = mm - 1;
  if (pm < 1) { py = yy - 1; pm = 12; }
  const snap = await get(familyRef(`bank_balances/${py}/${String(pm).padStart(2, '0')}`));
  return Object.values(snap.val() || {}).reduce((s, b) => s + roundInt(b.amount), 0);
}
export async function clearAllBankBalances() {
  const fid = AppState.getFamilyId(); if (!fid) throw new Error('尚未選擇家庭');
  await remove(ref(db, `families/${fid}/bank_balances`));
}

/* ============ 保險公司 ============ */
export function listenInsuranceCompanies(cb, err) { return listenList('insurance_companies', byCreatedAt, cb, err); }
export async function addInsuranceCompany(name) {
  const r = push(familyRef('insurance_companies'));
  await set(r, { name: name || '', createdAt: Date.now() });
  return r.key;
}
export async function updateInsuranceCompany(id, nn) { await update(familyRef(`insurance_companies/${id}`), { name: nn }); }
export async function removeInsuranceCompany(id) { await remove(familyRef(`insurance_companies/${id}`)); }
export async function updatePolicyCompanyName(on, nn) {
  const fid = AppState.getFamilyId(); if (!fid) throw new Error('尚未選擇家庭');
  const snap = await get(ref(db, `families/${fid}/insurance_policies`));
  const ps = snap.val() || {}; const up = {};
  Object.entries(ps).forEach(([id, p]) => { if (p.company === on) up[`families/${fid}/insurance_policies/${id}/company`] = nn; });
  if (Object.keys(up).length) await update(ref(db), up);
  return Object.keys(up).length;
}

/* ============ 支付方式 ============ */
export function listenPaymentMethods(cb, err) { return listenList('payment_methods', byOrder, cb, err); }
export async function addPaymentMethod(pm) {
  const r = push(familyRef('payment_methods'));
  await set(r, { name: pm.name || '', order: Number(pm.order) || 0, createdAt: Date.now() });
  return r.key;
}
export async function updatePaymentMethod(id, p) {
  const c = {};
  if (p.name !== undefined) c.name = String(p.name).trim();
  if (p.order !== undefined) c.order = Number(p.order) || 0;
  if (!Object.keys(c).length) return;
  await update(familyRef(`payment_methods/${id}`), c);
}
export async function removePaymentMethod(id) { await remove(familyRef(`payment_methods/${id}`)); }
export async function getPaymentMethodsOnce() {
  const snap = await get(familyRef('payment_methods'));
  const list = Object.entries(snap.val() || {}).map(([id, p]) => ({ id, ...p }));
  list.sort(byOrder);
  return list;
}

/* ============ 支出類別 / 項目 ============ */
export function listenCategories(cb, err) { return listenList('expense_categories', byOrder, cb, err); }
export async function getCategoriesOnce() {
  const snap = await get(familyRef('expense_categories'));
  const list = Object.entries(snap.val() || {}).map(([id, c]) => ({ id, ...c }));
  list.sort(byOrder);
  return list;
}
export async function addCategory(c) {
  const r = push(familyRef('expense_categories'));
  await set(r, { name: c.name || '', order: Number(c.order) || 0, createdAt: Date.now() });
  return r.key;
}
export async function updateCategory(id, p) {
  const cl = {};
  if (p.name !== undefined) cl.name = String(p.name).trim();
  if (p.order !== undefined) cl.order = Number(p.order) || 0;
  if (!Object.keys(cl).length) return;
  await update(familyRef(`expense_categories/${id}`), cl);
}
export async function removeCategory(id) { await remove(familyRef(`expense_categories/${id}`)); }

export function listenItems(cb, err) { return listenList('expense_items', byCreatedAt, cb, err); }
export async function getItemsOnce() {
  const snap = await get(familyRef('expense_items'));
  return Object.entries(snap.val() || {}).map(([id, i]) => ({ id, ...i }));
}
export async function addItem(it) {
  const r = push(familyRef('expense_items'));
  await set(r, { name: it.name || '', categoryId: it.categoryId || '', createdAt: Date.now() });
  return r.key;
}
export async function updateItem(id, p) {
  const c = {};
  if (p.name !== undefined) c.name = String(p.name).trim();
  if (p.categoryId !== undefined) c.categoryId = p.categoryId;
  if (!Object.keys(c).length) return;
  await update(familyRef(`expense_items/${id}`), c);
}
export async function removeItem(id) { await remove(familyRef(`expense_items/${id}`)); }

/* ============ 狀態 ============ */
export function listenStatuses(cb, err) { return listenList('statuses', byOrder, cb, err); }
export async function getStatusesOnce() {
  const snap = await get(familyRef('statuses'));
  const list = Object.entries(snap.val() || {}).map(([id, s]) => ({ id, ...s }));
  list.sort(byOrder);
  return list;
}
export async function addStatus(d) {
  const r = push(familyRef('statuses'));
  await set(r, { name: d.name || '', category: d.category || 'personal', isDone: !!d.isDone, order: Number(d.order) || 0, createdAt: Date.now() });
  return r.key;
}
export async function updateStatus(id, p) {
  const c = {};
  if (p.name !== undefined) c.name = String(p.name).trim();
  if (p.category !== undefined) c.category = p.category;
  if (p.isDone !== undefined) c.isDone = !!p.isDone;
  if (p.order !== undefined) c.order = Number(p.order) || 0;
  if (!Object.keys(c).length) return;
  await update(familyRef(`statuses/${id}`), c);
}
export async function removeStatus(id) { await remove(familyRef(`statuses/${id}`)); }

/* ============ 家庭設定 ============ */
export function listenFamilyOptions(cb, err) { return listen('settings/options', (s) => cb(s.val() || {}), err); }
export async function saveFamilyOptions(o) { await set(familyRef('settings/options'), o || {}); }
export function listenYearRange(cb, err) { return listen('settings/year_range', (s) => cb(s.val() || {}), err); }
export async function saveYearRange(d) {
  await set(familyRef('settings/year_range'), {
    startYear: d.startYear != null ? Number(d.startYear) : null,
    futureYears: Number(d.futureYears) || 5,
  });
}
export function listenUIConstants(cb, err) { return listen('settings/ui_constants', (s) => cb(s.val() || {}), err); }
export async function saveUIConstants(d) { await set(familyRef('settings/ui_constants'), d || {}); }

/* ============ 平台預設 ============ */
function platformPath(resource) {
  const c = PLATFORM_RESOURCES[resource];
  if (!c) throw new Error(`未知的平台資源：${resource}`);
  return `platform/defaults/${c.path}`;
}
export function listenPlatformResource(resource, cb, err) {
  const c = PLATFORM_RESOURCES[resource];
  if (!c) { console.warn(`[db] 未知平台資源：${resource}`); return () => {}; }
  return onValue(ref(db, platformPath(resource)), (snap) => {
    const val = snap.val();
    if (c.type === 'list' && val && typeof val === 'object' && !Array.isArray(val)) {
      const list = Object.entries(val).map(([id, x]) => ({ id, ...x }));
      list.sort(byOrderThenCreated);
      cb(list);
    } else cb(val || null);
  }, (e) => { console.error(`❌ 平台資源失敗 [${resource}]：`, e); if (err) err(e); });
}
export async function getPlatformResourceOnce(r) { const s = await get(ref(db, platformPath(r))); return s.val(); }
export async function putPlatformResource(r, id, d) {
  if (id) { await set(ref(db, `${platformPath(r)}/${id}`), d); return id; }
  const nr = push(ref(db, platformPath(r)));
  await set(nr, d); return nr.key;
}
export async function removePlatformResource(r, id) { await remove(ref(db, `${platformPath(r)}/${id}`)); }
export async function setPlatformResource(r, d) { await set(ref(db, platformPath(r)), d || {}); }

/* ============ 成員支出 ============ */
function expensePath(y, m, mid) { return `expenses/${y}/${m}/member_expenses/${mid}`; }
export function listenExpenses(y, m, mid, cb, err) {
  if (!y || !m) { const ym = AppState.getYearMonth(); y = ym.year; m = ym.month; }
  return listen(expensePath(y, m, mid), (snap) => {
    const list = Object.entries(snap.val() || {}).map(([id, e]) => ({ id, ...e }));
    list.sort(byCreatedAt);
    cb(list);
  }, err);
}
export function listenAllExpenses(cb, err) {
  return listen('expenses', (snap) => {
    const flat = [];
    Object.entries(snap.val() || {}).forEach(([y, ms]) => {
      Object.entries(ms || {}).forEach(([m, md]) => {
        Object.entries(md.member_expenses || {}).forEach(([mid, items]) => {
          Object.entries(items || {}).forEach(([id, exp]) => flat.push({ id, memberId: mid, year: y, month: m, ...exp }));
        });
      });
    });
    cb(flat);
  }, err);
}
export function listenAllMemberExpenses(y, m, cb, err) {
  if (!y || !m) { const ym = AppState.getYearMonth(); y = ym.year; m = ym.month; }
  return listen(`expenses/${y}/${m}/member_expenses`, (snap) => {
    const flat = [];
    Object.entries(snap.val() || {}).forEach(([mid, items]) => {
      Object.entries(items || {}).forEach(([id, exp]) => flat.push({ id, memberId: mid, ...exp }));
    });
    flat.sort(byCreatedAt);
    cb(flat);
  }, err);
}
export async function getAllMemberExpensesOnce(y, m) {
  const snap = await get(familyRef(`expenses/${y}/${m}/member_expenses`));
  const flat = [];
  Object.entries(snap.val() || {}).forEach(([mid, items]) => {
    Object.entries(items || {}).forEach(([id, exp]) => flat.push({ id, memberId: mid, ...exp }));
  });
  flat.sort(byCreatedAt);
  return flat;
}
export async function getMemberExpensesForYear(y, mid) {
  const fid = AppState.getFamilyId(); if (!fid) throw new Error('尚未選擇家庭');
  if (!y || !mid) return {};
  try {
    const snap = await get(ref(db, `families/${fid}/expenses/${y}`));
    const yd = snap.val() || {}; const out = {};
    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, '0');
      const me = yd[mm]?.member_expenses?.[mid] || {};
      const items = Object.entries(me).map(([id, e]) => ({ id, ...e }));
      items.sort(byCreatedAt);
      out[mm] = items;
    }
    return out;
  } catch (e) { return {}; }
}
export async function addExpense(y, m, mid, exp) {
  if (!y || !m) { const ym = AppState.getYearMonth(); y = ym.year; m = ym.month; }
  const r = push(familyRef(expensePath(y, m, mid)));
  await set(r, {
    name: exp.name || '', amount: roundInt(exp.amount),
    status: normalizeStatus(exp.status || '未處理'),
    date: exp.date || '',
    categoryId: exp.categoryId || '', itemId: exp.itemId || '',
    paymentMethodId: exp.paymentMethodId || '',
    bankId: exp.bankId || '', txnId: exp.txnId || '',
    isAutoLinked: exp.isAutoLinked || false, policyId: exp.policyId || '',
    createdAt: Date.now(),
  });
  return r.key;
}
export async function updateExpense(y, m, mid, eid, p) {
  if (!y || !m) { const ym = AppState.getYearMonth(); y = ym.year; m = ym.month; }
  const c = { ...p };
  if (c.amount != null) c.amount = roundInt(c.amount);
  if (c.status !== undefined) c.status = normalizeStatus(c.status);
  await update(familyRef(`${expensePath(y, m, mid)}/${eid}`), c);
}
export async function removeExpense(y, m, mid, eid) {
  if (!y || !m) { const ym = AppState.getYearMonth(); y = ym.year; m = ym.month; }
  await remove(familyRef(`${expensePath(y, m, mid)}/${eid}`));
}
export async function markMemberExpenseRepaid(y, m, mid, eid, sn) {
  await update(familyRef(`${expensePath(y, m, mid)}/${eid}`), {
    status: normalizeStatus(sn),
    repaidDate: sn && sn.startsWith('已') ? new Date().toISOString().slice(0, 10) : '',
  });
}
export async function batchUpdateExpenses(updates) {
  const fid = AppState.getFamilyId(); if (!fid) throw new Error('尚未選擇家庭');
  const fu = {};
  for (const item of updates) {
    const { oldYear, oldMonth, oldMemberId, expenseId, data } = item;
    const ny = data.year || oldYear, nm = data.month || oldMonth, nmid = data.memberId || oldMemberId;
    const ns = normalizeStatus(data.status || '未處理');
    const pc = ny !== oldYear || nm !== oldMonth || nmid !== oldMemberId;
    if (pc) {
      fu[`families/${fid}/expenses/${oldYear}/${oldMonth}/member_expenses/${oldMemberId}/${expenseId}`] = null;
      const nr = push(ref(db, `families/${fid}/expenses/${ny}/${nm}/member_expenses/${nmid}`));
      fu[`families/${fid}/expenses/${ny}/${nm}/member_expenses/${nmid}/${nr.key}`] = {
        name: data.name || '', amount: roundInt(data.amount), status: ns,
        date: data.date || '', categoryId: data.categoryId || '', itemId: data.itemId || '',
        paymentMethodId: data.paymentMethodId || '', bankId: data.bankId || '', txnId: data.txnId || '',
        isAutoLinked: false, createdAt: Date.now(),
      };
    } else {
      fu[`families/${fid}/expenses/${oldYear}/${oldMonth}/member_expenses/${oldMemberId}/${expenseId}`] = {
        name: data.name || '', amount: roundInt(data.amount), status: ns,
        date: data.date || '', categoryId: data.categoryId || '', itemId: data.itemId || '',
        paymentMethodId: data.paymentMethodId || '', bankId: data.bankId || '', txnId: data.txnId || '',
      };
    }
  }
  await update(ref(db), fu);
}

/* ============ 保險 ============ */
export function listenInsurancePolicies(cb, err) { return listenList('insurance_policies', byCreatedAt, cb, err); }
export async function getInsurancePoliciesOnce() {
  const snap = await get(familyRef('insurance_policies'));
  const list = Object.entries(snap.val() || {}).map(([id, p]) => ({ id, ...p }));
  list.sort(byCreatedAt);
  return list;
}
export async function addInsurancePolicy(p) {
  const r = push(familyRef('insurance_policies'));
  await set(r, {
    type: p.type || 'normal',
    memberId: p.memberId || '', policyHolderId: p.policyHolderId || '',
    name: p.name || '', company: p.company || '',
    paymentType: p.paymentType || '年繳',
    paymentMode: p.paymentMode || 'direct',
    advanceHolderId: p.advanceHolderId || '', advanceId: p.advanceId || '',
    firstStartYear: Number(p.firstStartYear) || 0,
    firstStartMonth: String(p.firstStartMonth || '01').padStart(2, '0'),
    totalPolicyYears: Number(p.totalPolicyYears) || 0,
    totalPolicyPeriods: Number(p.totalPolicyPeriods) || 0,
    totalPremium: roundInt(p.totalPremium),
    currentPeriodIndex: Number(p.currentPeriodIndex) || 1,
    monthlyPremium: roundInt(p.monthlyPremium),
    annualPremium: roundInt(p.annualPremium),
    account: p.account || '',
    fundsAllocation: Array.isArray(p.fundsAllocation) ? p.fundsAllocation : [],
    periods: p.periods || {},
    createdAt: Date.now(),
  });
  return r.key;
}
export async function updateInsurancePolicy(id, p) {
  const c = {};
  const f = ['type', 'memberId', 'policyHolderId', 'name', 'company', 'paymentType', 'paymentMode', 'advanceHolderId', 'advanceId', 'firstStartYear', 'firstStartMonth', 'totalPolicyYears', 'totalPolicyPeriods', 'totalPremium', 'currentPeriodIndex', 'monthlyPremium', 'annualPremium', 'account', 'periods', 'isCompleted', 'fundsAllocation'];
  f.forEach((k) => { if (p[k] !== undefined) c[k] = p[k]; });
  if (c.totalPremium != null) c.totalPremium = roundInt(c.totalPremium);
  if (c.monthlyPremium != null) c.monthlyPremium = roundInt(c.monthlyPremium);
  if (c.annualPremium != null) c.annualPremium = roundInt(c.annualPremium);
  if (!Object.keys(c).length) return;
  await update(familyRef(`insurance_policies/${id}`), c);
}
export async function removeInsurancePolicy(id) { await remove(familyRef(`insurance_policies/${id}`)); }
export async function deleteInsurancePolicyAndData(pid, mid) {
  const fid = AppState.getFamilyId(); if (!fid) throw new Error('尚未選擇家庭');
  let em = mid;
  if (!em) {
    try {
      const ps = await get(ref(db, `families/${fid}/insurance_policies/${pid}`));
      const p = ps.val();
      if (p) em = p.policyHolderId || p.memberId || '';
    } catch (e) {}
  }
  const psnap = await get(ref(db, `families/${fid}/insurance_payments/${pid}`));
  const pms = psnap.val() || {}; const up = {};
  const lk = buildLinkedKey(pid);
  if (em) {
    for (const [y, ms] of Object.entries(pms)) {
      for (const [m] of Object.entries(ms)) {
        up[`families/${fid}/expenses/${y}/${m}/member_expenses/${em}/${lk}`] = null;
      }
    }
  }
  up[`families/${fid}/insurance_payments/${pid}`] = null;
  up[`families/${fid}/insurance_policies/${pid}`] = null;
  await update(ref(db), up);
}
export async function addInsurancePeriod(pid, pi, pd) {
  await set(familyRef(`insurance_policies/${pid}/periods/${pi}`), {
    periodIndex: Number(pi),
    startYear: Number(pd.startYear),
    startMonth: String(pd.startMonth).padStart(2, '0'),
    annualPremium: roundInt(pd.annualPremium),
    monthlyAverage: roundInt(pd.monthlyAverage),
  });
}
export function listenInsurancePayment(pid, y, m, cb, err) {
  return listen(`insurance_payments/${pid}/${y}/${m}`, (s) => cb(s.val() || {}), err);
}
export async function getInsurancePaymentsOnce(pid) {
  const snap = await get(familyRef(`insurance_payments/${pid}`));
  return snap.val() || {};
}
export async function saveInsurancePaymentBatch(pid, y, m, d) {
  await set(familyRef(`insurance_payments/${pid}/${y}/${m}`), {
    status: normalizeStatus(d.status || '已扣款'),
    amount: roundInt(d.amount),
    date: d.date || new Date().toISOString().slice(0, 10),
    bankId: d.bankId || '', txnId: d.txnId || '',
  });
}
export async function removeInsurancePaymentBatch(pid, y, m) {
  await remove(familyRef(`insurance_payments/${pid}/${y}/${m}`));
}

/* ============ 收入（家用轉入） ============ */
export function listenIncome(y, m, cb, err) {
  if (!y || !m) { const ym = AppState.getYearMonth(); y = ym.year; m = ym.month; }
  return listen(`income/${y}/${m}`, (s) => cb(s.val() || {}), err);
}
export async function getIncomeOnce(y, m) {
  const snap = await get(familyRef(`income/${y}/${m}`));
  return snap.val() || {};
}
export async function saveIncome(y, m, data) {
  if (!y || !m) { const ym = AppState.getYearMonth(); y = ym.year; m = ym.month; }
  const up = {};
  Object.entries(data || {}).forEach(([k, v]) => {
    const n = roundInt(v);
    up[k] = n > 0 ? n : null;
  });
  if (!Object.keys(up).length) return;
  await update(familyRef(`income/${y}/${m}`), up);
}
export function listenAllIncome(cb, err) {
  return listen('income', (snap) => {
    const flat = [];
    Object.entries(snap.val() || {}).forEach(([y, ms]) => {
      Object.entries(ms || {}).forEach(([m, data]) => {
        Object.entries(data || {}).forEach(([mid, amt]) => flat.push({ year: y, month: m, memberId: mid, amount: roundInt(amt) }));
      });
    });
    cb(flat);
  }, err);
}
export async function updateIncomeEntry(y, m, mid, amt) {
  const n = roundInt(amt);
  if (n > 0) await update(familyRef(`income/${y}/${m}`), { [mid]: n });
  else await remove(familyRef(`income/${y}/${m}/${mid}`));
}
export async function removeIncomeEntry(y, m, mid) { await remove(familyRef(`income/${y}/${m}/${mid}`)); }

/* ============ 基金 ============ */
export function listenFunds(cb, err) { return listenList('funds', byCreatedAt, cb, err); }
export async function getFundsOnce() {
  const snap = await get(familyRef('funds'));
  return Object.entries(snap.val() || {}).map(([id, f]) => ({ id, ...f }));
}
export async function addFund(f) {
  const r = push(familyRef('funds'));
  await set(r, {
    name: f.name || '',
    type: f.type || 'standalone',
    policyId: f.policyId || '',
    cost: roundInt(f.cost),
    currentValue: roundInt(f.currentValue),
    units: Number(f.units) || 0,
    initialYear: f.initialYear ? String(f.initialYear) : '',
    initialMonth: f.initialMonth ? String(f.initialMonth).padStart(2, '0') : '',
    note: f.note || '',
    createdAt: Date.now(),
  });
  return r.key;
}
export async function updateFund(id, p) {
  const c = {};
  if (p.name !== undefined) c.name = String(p.name).trim();
  if (p.type !== undefined) c.type = p.type;
  if (p.policyId !== undefined) c.policyId = p.policyId;
  if (p.cost !== undefined) c.cost = roundInt(p.cost);
  if (p.currentValue !== undefined) c.currentValue = roundInt(p.currentValue);
  if (p.units !== undefined) c.units = Number(p.units) || 0;
  if (p.initialYear !== undefined) c.initialYear = String(p.initialYear);
  if (p.initialMonth !== undefined) c.initialMonth = String(p.initialMonth).padStart(2, '0');
  if (p.note !== undefined) c.note = String(p.note || '').trim();
  if (!Object.keys(c).length) return;
  await update(familyRef(`funds/${id}`), c);
}
export async function removeFund(id) { await remove(familyRef(`funds/${id}`)); }

/* 🆕 基金快照 */
export function listenFundSnapshots(fundId, cb, err) {
  return listen(`funds/${fundId}/snapshots`, (snap) => cb(snap.val() || {}), err);
}
export async function getFundSnapshotsOnce(fundId) {
  const snap = await get(familyRef(`funds/${fundId}/snapshots`));
  return snap.val() || {};
}
export async function saveFundSnapshot(fundId, y, m, data) {
  const path = `funds/${fundId}/snapshots/${y}/${String(m).padStart(2, '0')}`;
  const existing = await get(familyRef(path));
  const ex = existing.val() || {};
  await set(familyRef(path), {
    shares: Number(data.shares) || 0,
    nav: Number(data.nav) || 0,
    value: roundInt(Number(data.shares || 0) * Number(data.nav || 0)),
    contribution: roundInt(data.contribution || ex.contribution || 0),
    cumulativeCost: roundInt(data.cumulativeCost != null ? data.cumulativeCost : ex.cumulativeCost || 0),
    createdAt: ex.createdAt || Date.now(),
    updatedAt: Date.now(),
  });
}
export async function removeFundSnapshot(fundId, y, m) {
  await remove(familyRef(`funds/${fundId}/snapshots/${y}/${String(m).padStart(2, '0')}`));
}

/* ============ 跨來源改狀態 ============ */
export async function updateEntityStatus(source, row, ns, isDone) {
  const today = new Date().toISOString().slice(0, 10);
  switch (source) {
    case 'personal': {
      const { memberId, expenseId } = row._ref;
      await updateExpense(row.year, row.month, memberId, expenseId, { status: ns, repaidDate: isDone ? today : '' });
      return;
    }
    case 'insurance': throw new Error('保險狀態請呼叫 api.insuranceSync()');
    case 'fixed': throw new Error('fixed_expenses 已廢除');
    default: throw new Error('未知的來源：' + source);
  }
}

/* ============ 側邊欄（已廢除） ============ */
export function listenSidebarOrder(cb, err) {
  return listen('settings/sidebar_order', (snap) => {
    const v = snap.val();
    if (!v) { cb(null); return; }
    const arr = Array.isArray(v) ? v : Object.values(v);
    cb(arr.filter((x) => typeof x === 'string'));
  }, err);
}
export async function saveSidebarOrder(order) {
  if (!Array.isArray(order)) throw new Error('order 必須是陣列');
  await set(familyRef('settings/sidebar_order'), order);
}

/* ═══════════════════════════════════════════
   END OF FILE
   File: js/core/db.js
   Version: v103.0.21
   Batch: B23
   ═══════════════════════════════════════════ */