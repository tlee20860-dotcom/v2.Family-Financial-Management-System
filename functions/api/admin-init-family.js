// ============================================
// admin-init-family.js — POST /api/admin-init-family（v101.5）
// 位置：functions/api/admin-init-family.js
// ============================================
// v101.5 修正：
//   ✅ FALLBACK 改讀 constants（與前端 constants.js 對齊）
//   ✅ 回傳部分成功的詳細結果
//   ✅ linked_ 前綴由常數提供
// ============================================

import { dbGet, dbPut } from './_config.js';
import {
  authenticate,
  errorResponse,
  handleError,
  handleOptions,
  successResponse,
  requireFields,
} from './_helpers.js';

/* ============================================
   Fallback 預設值（platform/defaults 為空時使用）
   與前端 constants.js 對齊
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
  year_range: {
    startYear: null,
    futureYears: 5,
  },
  ui_constants: {
    nameMaxLenDesktop: 12,
    nameMaxLenMobile: 6,
    toastDuration: 2000,
  },
};

/* ============================================
   POST 主入口
   ============================================ */
export async function onRequestPost({ request }) {
  try {
    const body = await request.json();

    const missing = requireFields(body, ['uid']);
    if (missing) return errorResponse('MISSING_FIELDS', '缺少 uid');

    const auth = await authenticate(request, { needSuperAdmin: true });
    if (auth instanceof Response) return auth;
    const { token } = auth;

    const { uid } = body;
    const basePath = `families/${uid}`;

    // 檢查是否已有資料
    const existing = await dbGet(`${basePath}/members`, token);
    if (existing && Object.keys(existing).length > 0) {
      return successResponse({
        skipped: true,
        message: '此家庭已有資料',
      });
    }

    const defaults = await _loadPlatformDefaults(token);
    const now = Date.now();

    // 🆕 v101.5：記錄每步驟結果
    const results = {
      members: false,
      banks: false,
      insurance_companies: false,
      payment_methods: false,
      expense_categories: false,
      expense_items: false,
      statuses: false,
      options: false,
      year_range: false,
      ui_constants: false,
    };

    // 1. 成員
    const membersData = _withTimestamps(defaults.members, now);
    if (Object.keys(membersData).length > 0) {
      results.members = await dbPut(`${basePath}/members`, membersData, token);
    } else {
      results.members = true;  // 空資料視為成功
    }

    // 2. 銀行
    if (Object.keys(defaults.banks).length > 0) {
      results.banks = await dbPut(`${basePath}/banks`, _withTimestamps(defaults.banks, now), token);
    } else {
      results.banks = true;
    }

    // 3. 保險公司
    if (Object.keys(defaults.insurance_companies).length > 0) {
      results.insurance_companies = await dbPut(
        `${basePath}/insurance_companies`,
        _withTimestamps(defaults.insurance_companies, now),
        token
      );
    } else {
      results.insurance_companies = true;
    }

    // 4. 支付方式
    if (Object.keys(defaults.payment_methods).length > 0) {
      results.payment_methods = await dbPut(
        `${basePath}/payment_methods`,
        _withTimestamps(defaults.payment_methods, now),
        token
      );
    } else {
      results.payment_methods = true;
    }

    // 5. 支出類別
    if (Object.keys(defaults.expense_categories).length > 0) {
      results.expense_categories = await dbPut(
        `${basePath}/expense_categories`,
        _withTimestamps(defaults.expense_categories, now),
        token
      );
    } else {
      results.expense_categories = true;
    }

    // 6. 支出項目
    const itemsData = _buildItemsWithCategoryId(defaults.expense_items, now);
    if (Object.keys(itemsData).length > 0) {
      results.expense_items = await dbPut(`${basePath}/expense_items`, itemsData, token);
    } else {
      results.expense_items = true;
    }

    // 7. 狀態
    if (Object.keys(defaults.statuses).length > 0) {
      results.statuses = await dbPut(
        `${basePath}/statuses`,
        _withTimestamps(defaults.statuses, now),
        token
      );
    } else {
      results.statuses = true;
    }

    // 8. options
    if (defaults.options && Object.keys(defaults.options).length > 0) {
      results.options = await dbPut(`${basePath}/settings/options`, defaults.options, token);
    } else {
      results.options = true;
    }

    // 9. year_range
    if (defaults.year_range) {
      results.year_range = await dbPut(`${basePath}/settings/year_range`, defaults.year_range, token);
    } else {
      results.year_range = true;
    }

    // 10. ui_constants
    if (defaults.ui_constants) {
      results.ui_constants = await dbPut(`${basePath}/settings/ui_constants`, defaults.ui_constants, token);
    } else {
      results.ui_constants = true;
    }

    // 🆕 v101.5：檢查是否有部分失敗
    const failedSteps = Object.entries(results)
      .filter(([_, ok]) => ok === false)
      .map(([key]) => key);

    if (failedSteps.length > 0) {
      return successResponse({
        created: true,
        partial: true,
        failedSteps,
        results,
      });
    }

    return successResponse({ created: true, results });
  } catch (err) {
    return handleError(err);
  }
}

export async function onRequestOptions() {
  return handleOptions();
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
    out[key] = {
      ...val,
      createdAt: val.createdAt || (baseTs + i),
    };
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