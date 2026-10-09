// ============================================
// admin.js — 平台家庭管理（v103.0.0）
// 位置：functions/api/admin.js
// ============================================
// v103.0.0 合併：
//   ✅ 合併 admin-families.js + admin-init-family.js
//   ✅ 內部透過 ?action= 分派（GET / POST）
//   ✅ 舊 URL 路徑保持不變（/api/admin-families、/api/admin-init-family）
// ============================================

import { dbGet, dbPut, dbDelete } from './_config.js';
import {
  authenticate, errorResponse, handleError, handleOptions,
  successResponse, requireFields,
} from './_helpers.js';

/* ============================================
   FALLBACK 預設值
   ============================================ */
const FALLBACK = {
  members: {
    mem_husband:  { name: '成員1', role: 'husband', order: 0 },
    mem_wife:     { name: '成員2', role: 'wife',    order: 1 },
    mem_son:      { name: '成員3', role: 'child',   order: 2 },
    mem_daughter: { name: '成員4', role: 'child',   order: 3 },
  },
  banks: {},
  insurance_companies: {
    comp_ftlife:     { name: '富通', order: 1 },
    comp_prudential: { name: '保誠', order: 2 },
    comp_fwd:        { name: 'FWD',  order: 3 },
    comp_aia:        { name: 'AIA',  order: 4 },
    comp_manulife:   { name: '宏利', order: 5 },
    comp_axa:        { name: 'AXA',  order: 6 },
  },
  payment_methods: {
    pm_cash:   { name: '現金',   order: 1 },
    pm_boc:    { name: '中銀',   order: 2 },
    pm_hsbc:   { name: '匯豐',   order: 3 },
    pm_hangs:  { name: '恆生',   order: 4 },
    pm_credit: { name: '信用卡', order: 5 },
  },
  expense_categories: {
    cat_medical:   { name: '醫療類',     order: 1 },
    cat_school:    { name: '學校類',     order: 2 },
    cat_insurance: { name: '保險類',     order: 3 },
    cat_fixed:     { name: '固定費用類', order: 4 },
    cat_other:     { name: '其他',       order: 5 },
  },
  expense_items: {
    item_med_01: { categoryKey: 'cat_medical',   name: '看病-一般' },
    item_med_02: { categoryKey: 'cat_medical',   name: '看病-專科' },
    item_med_03: { categoryKey: 'cat_medical',   name: '牙醫' },
    item_med_04: { categoryKey: 'cat_medical',   name: '藥費' },
    item_sch_01: { categoryKey: 'cat_school',    name: '學費' },
    item_sch_02: { categoryKey: 'cat_school',    name: '功課輔導班' },
    item_sch_03: { categoryKey: 'cat_school',    name: '興趣班' },
    item_sch_04: { categoryKey: 'cat_school',    name: '書本費' },
    item_sch_05: { categoryKey: 'cat_school',    name: '校車費' },
    item_ins_01: { categoryKey: 'cat_insurance', name: '住院保險' },
    item_ins_02: { categoryKey: 'cat_insurance', name: '人壽保險' },
    item_ins_03: { categoryKey: 'cat_insurance', name: '意外保險' },
    item_fix_01: { categoryKey: 'cat_fixed',     name: '水費' },
    item_fix_02: { categoryKey: 'cat_fixed',     name: '電費' },
    item_fix_03: { categoryKey: 'cat_fixed',     name: '煤氣費' },
    item_fix_04: { categoryKey: 'cat_fixed',     name: '管理費' },
    item_fix_05: { categoryKey: 'cat_fixed',     name: '房租' },
    item_oth_01: { categoryKey: 'cat_other',     name: '其他' },
  },
  statuses: {
    status_untreated: { name: '未處理', category: 'personal',  isDone: false, order: 1 },
    status_done:      { name: '已處理', category: 'personal',  isDone: true,  order: 2 },
    status_unrepaid:  { name: '未還款', category: 'personal',  isDone: false, order: 3 },
    status_repaid:    { name: '已還款', category: 'personal',  isDone: true,  order: 4 },
    status_unpaid:    { name: '未付款', category: 'fixed',     isDone: false, order: 5 },
    status_paid:      { name: '已付款', category: 'fixed',     isDone: true,  order: 6 },
    status_na:        { name: '不適用', category: 'fixed',     isDone: true,  order: 7 },
    status_unbilled:  { name: '未扣款', category: 'insurance', isDone: false, order: 8 },
    status_billed:    { name: '已扣款', category: 'insurance', isDone: true,  order: 9 },
  },
  options: {
    memberRoles: [
      { value: 'husband', label: '老公 / 丈夫' },
      { value: 'wife',    label: '老婆 / 妻子' },
      { value: 'child',   label: '子女' },
      { value: 'other',   label: '其他' },
    ],
    cycles: [
      { value: '每月',    label: '每月' },
      { value: '每2個月', label: '每2個月' },
      { value: '每季',    label: '每季' },
      { value: '每年',    label: '每年' },
      { value: '一次性',  label: '一次性' },
    ],
    policyTypes: [
      { value: 'normal',         label: '普通保險（住院 / 人壽 / 意外）' },
      { value: 'fund_insurance', label: '基金保險（投資型，月供）' },
    ],
    insurancePaymentTypes: [
      { value: '年繳',     label: '年繳' },
      { value: '月繳',     label: '月繳' },
      { value: '一次付款', label: '一次付款' },
    ],
    categoryOrder: ['銀行類', '醫療類', '學校類', '保險類', '固定費用類', '交通類', '其他'],
  },
  year_range: { startYear: null, futureYears: 5 },
  ui_constants: { nameMaxLenDesktop: 12, nameMaxLenMobile: 6, toastDuration: 2000 },
};

/* ============================================
   GET — 列出所有家庭 / 分派
   ============================================ */
export async function onRequestGet({ request }) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'list';

    const auth = await authenticate(request, { needSuperAdmin: true });
    if (auth instanceof Response) return auth;
    const { token } = auth;

    if (action === 'list') {
      const list = await dbGet('platform/families', token);
      const families = Object.entries(list || {}).map(([uid, data]) => ({ uid, ...data }));
      families.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      return successResponse({ families });
    }

    return errorResponse('BAD_REQUEST', `未知的 action：${action}`);
  } catch (err) {
    return handleError(err);
  }
}

/* ============================================
   POST — add / remove / init
   ============================================ */
export async function onRequestPost({ request }) {
  try {
    const body = await request.json();
    const { action, uid, name, email } = body || {};

    const auth = await authenticate(request, { needSuperAdmin: true });
    if (auth instanceof Response) return auth;
    const { token } = auth;

    switch (action) {
      case 'add':      return await _handleAdd(body, token);
      case 'remove':   return await _handleRemove(body, token);
      case 'init':     return await _handleInit(body, token);
      default:
        return errorResponse('BAD_REQUEST', '未知的 action');
    }
  } catch (err) {
    return handleError(err);
  }
}

export async function onRequestOptions() {
  return handleOptions();
}

/* ============================================
   ADD
   ============================================ */
async function _handleAdd(body, token) {
  const { uid, name, email } = body;
  const missing = requireFields(body, ['uid', 'name']);
  if (missing) return errorResponse('MISSING_FIELDS', '缺少 uid 或 name');

  const success = await dbPut(`platform/families/${uid}`, {
    name: String(name).trim(),
    ownerEmail: email ? String(email).trim() : '',
    createdAt: Date.now(),
  }, token);

  if (!success) return errorResponse('INTERNAL', 'Firebase 寫入失敗');
  return successResponse();
}

/* ============================================
   REMOVE（含索引清理）
   ============================================ */
async function _handleRemove(body, token) {
  const { uid } = body;
  const missing = requireFields(body, ['uid']);
  if (missing) return errorResponse('MISSING_FIELDS', '缺少 uid');

  let accounts = null;
  try {
    accounts = await dbGet(`platform/families/${uid}/memberAccounts`, token);
  } catch (e) { accounts = null; }

  const cleanups = [];
  if (accounts && typeof accounts === 'object') {
    Object.entries(accounts).forEach(([memberUid, acc]) => {
      cleanups.push(dbDelete(`platform/uid_index/${memberUid}`, token).catch(() => false));
      if (acc && acc.account) {
        cleanups.push(dbDelete(`platform/email_index/${acc.account}`, token).catch(() => false));
      }
    });
  }
  await Promise.all(cleanups);

  const ok1 = await dbDelete(`platform/families/${uid}`, token);
  const ok2 = await dbDelete(`families/${uid}`, token);

  if (!ok1 && !ok2) return errorResponse('INTERNAL', '刪除失敗');

  return successResponse({
    deletedPlatform: ok1,
    deletedFamilyData: ok2,
    cleanedIndexes: cleanups.length,
  });
}

/* ============================================
   INIT — 初始化家庭預設資料
   ============================================ */
async function _handleInit(body, token) {
  const { uid } = body;
  const missing = requireFields(body, ['uid']);
  if (missing) return errorResponse('MISSING_FIELDS', '缺少 uid');

  const basePath = `families/${uid}`;

  const existing = await dbGet(`${basePath}/members`, token);
  if (existing && Object.keys(existing).length > 0) {
    return successResponse({ skipped: true, message: '此家庭已有資料' });
  }

  const defaults = await _loadPlatformDefaults(token);
  const now = Date.now();

  const results = {
    members: false, banks: false, insurance_companies: false,
    payment_methods: false, expense_categories: false, expense_items: false,
    statuses: false, options: false, year_range: false, ui_constants: false,
  };

  const membersData = _withTimestamps(defaults.members, now);
  results.members = Object.keys(membersData).length > 0
    ? await dbPut(`${basePath}/members`, membersData, token) : true;

  if (Object.keys(defaults.banks).length > 0) {
    results.banks = await dbPut(`${basePath}/banks`, _withTimestamps(defaults.banks, now), token);
  } else results.banks = true;

  if (Object.keys(defaults.insurance_companies).length > 0) {
    results.insurance_companies = await dbPut(`${basePath}/insurance_companies`, _withTimestamps(defaults.insurance_companies, now), token);
  } else results.insurance_companies = true;

  if (Object.keys(defaults.payment_methods).length > 0) {
    results.payment_methods = await dbPut(`${basePath}/payment_methods`, _withTimestamps(defaults.payment_methods, now), token);
  } else results.payment_methods = true;

  if (Object.keys(defaults.expense_categories).length > 0) {
    results.expense_categories = await dbPut(`${basePath}/expense_categories`, _withTimestamps(defaults.expense_categories, now), token);
  } else results.expense_categories = true;

  const itemsData = _buildItemsWithCategoryId(defaults.expense_items, now);
  results.expense_items = Object.keys(itemsData).length > 0
    ? await dbPut(`${basePath}/expense_items`, itemsData, token) : true;

  if (Object.keys(defaults.statuses).length > 0) {
    results.statuses = await dbPut(`${basePath}/statuses`, _withTimestamps(defaults.statuses, now), token);
  } else results.statuses = true;

  if (defaults.options && Object.keys(defaults.options).length > 0) {
    results.options = await dbPut(`${basePath}/settings/options`, defaults.options, token);
  } else results.options = true;

  if (defaults.year_range) {
    results.year_range = await dbPut(`${basePath}/settings/year_range`, defaults.year_range, token);
  } else results.year_range = true;

  if (defaults.ui_constants) {
    results.ui_constants = await dbPut(`${basePath}/settings/ui_constants`, defaults.ui_constants, token);
  } else results.ui_constants = true;

  const failedSteps = Object.entries(results).filter(([, ok]) => ok === false).map(([k]) => k);
  if (failedSteps.length > 0) {
    return successResponse({ created: true, partial: true, failedSteps, results });
  }
  return successResponse({ created: true, results });
}

/* ============================================
   內部工具
   ============================================ */
async function _loadPlatformDefaults(token) {
  const [members, banks, companies, payments, categories, items, statuses, options, yearRange, uiConstants] =
    await Promise.all([
      dbGet('platform/defaults/members', token),
      dbGet('platform/defaults/banks', token),
      dbGet('platform/defaults/insurance_companies', token),
      dbGet('platform/defaults/payment_methods', token),
      dbGet('platform/defaults/expense_categories', token),
      dbGet('platform/defaults/expense_items', token),
      dbGet('platform/defaults/statuses', token),
      dbGet('platform/defaults/options', token),
      dbGet('platform/defaults/year_range', token),
      dbGet('platform/defaults/ui_constants', token),
    ]);

  return {
    members:             members    && Object.keys(members).length    ? members    : FALLBACK.members,
    banks:               banks      && Object.keys(banks).length      ? banks      : FALLBACK.banks,
    insurance_companies: companies  && Object.keys(companies).length  ? companies  : FALLBACK.insurance_companies,
    payment_methods:     payments   && Object.keys(payments).length   ? payments   : FALLBACK.payment_methods,
    expense_categories:  categories && Object.keys(categories).length ? categories : FALLBACK.expense_categories,
    expense_items:       items      && Object.keys(items).length      ? items      : FALLBACK.expense_items,
    statuses:            statuses   && Object.keys(statuses).length   ? statuses   : FALLBACK.statuses,
    options:             options    && Object.keys(options).length    ? options    : FALLBACK.options,
    year_range:          yearRange  || FALLBACK.year_range,
    ui_constants:        uiConstants || FALLBACK.ui_constants,
  };
}

function _withTimestamps(data, baseTs) {
  const out = {};
  let i = 0;
  Object.entries(data || {}).forEach(([key, val]) => {
    out[key] = { ...val, createdAt: val.createdAt || (baseTs + i) };
    i++;
  });
  return out;
}

function _buildItemsWithCategoryId(items, baseTs) {
  const out = {};
  let i = 0;
  Object.entries(items || {}).forEach(([key, val]) => {
    const categoryId = val.categoryKey || val.categoryId || '';
    out[key] = {
      name: val.name || '',
      categoryId,
      createdAt: val.createdAt || (baseTs + i),
    };
    i++;
  });
  return out;
}
