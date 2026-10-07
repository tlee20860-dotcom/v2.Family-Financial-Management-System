// ============================================
// entity-definitions.js — 實體表單定義 SSOT（v101.5 🆕）
// 位置：js/config/entity-definitions.js
// ============================================
// 這是「統一管理架構」的唯一真實來源。
// 所有實體的新增 / 編輯 / 刪除，都必須從這裡讀取欄位定義。
//
// 支援實體：
//   member / bank / policy / fund / category / item / payment / status / fixedTemplate
//
// 使用方式：
//   import { getEntityDef, getAllEntityKeys } from '../config/entity-definitions.js';
//   const def = getEntityDef('bank');
// ============================================

import {
  addMember, updateMember, removeMember, deleteMemberAndData,
  addBank, updateBank, removeBank, deleteBankAndBalances,
  addInsurancePolicy, updateInsurancePolicy, removeInsurancePolicy, deleteInsurancePolicyAndData,
  addFund, updateFund, removeFund,
  addCategory, updateCategory, removeCategory,
  addItem, updateItem, removeItem,
  addPaymentMethod, updatePaymentMethod, removePaymentMethod,
  addStatus, updateStatus, removeStatus,
  addFixedTemplate, updateFixedTemplate, removeFixedTemplate, deleteFixedTemplateAndMonths,
} from '../core/db.js';

import { ENTITY_KEYS, LIMITS } from './constants.js';

/* ============================================
   實體定義表
   ============================================ */
const ENTITY_DEFS = {

  /* ============================================
     1. 成員
     ============================================ */
  [ENTITY_KEYS.MEMBER]: {
    key: ENTITY_KEYS.MEMBER,
    label: '成員',
    labelPlural: '成員',
    icon: 'users',
    db: {
      create: addMember,
      update: updateMember,
      remove: removeMember,
      delete: deleteMemberAndData,
    },
    fields: [
      {
        id: 'name',
        label: '名稱',
        type: 'text',
        required: true,
        maxlength: 20,
        placeholder: '例如：老公、梓舜',
      },
      {
        id: 'role',
        label: '角色',
        type: 'select',
        required: true,
        optionsSource: 'memberRoles',
      },
      {
        id: 'order',
        label: '排序',
        type: 'number',
        min: 0,
        defaultValue: 0,
      },
    ],
    // 新增時自動填入 order
    beforeCreate: (data, allRows) => {
      const maxOrder = (allRows || []).reduce(
        (max, m) => Math.max(max, m.order != null ? m.order : -1),
        -1
      );
      return { ...data, order: maxOrder + 1 };
    },
  },

  /* ============================================
     2. 銀行
     ============================================ */
  [ENTITY_KEYS.BANK]: {
    key: ENTITY_KEYS.BANK,
    label: '銀行',
    labelPlural: '銀行',
    icon: 'landmark',
    db: {
      create: addBank,
      update: updateBank,
      remove: removeBank,
      delete: deleteBankAndBalances,
    },
    fields: [
      {
        id: 'name',
        label: '銀行名稱',
        type: 'text',
        required: true,
        maxlength: 20,
        placeholder: '例如：中銀、匯豐',
      },
    ],
    validate: (data, allRows, currentId) => {
      const name = (data.name || '').trim();
      if (allRows && allRows.some((b) => b.id !== currentId && b.name === name)) {
        return { field: 'name', message: '此銀行名稱已存在' };
      }
      return null;
    },
  },

  /* ============================================
     3. 保單
     ============================================ */
  [ENTITY_KEYS.POLICY]: {
    key: ENTITY_KEYS.POLICY,
    label: '保單',
    labelPlural: '保單',
    icon: 'shield',
    db: {
      create: addInsurancePolicy,
      update: updateInsurancePolicy,
      remove: removeInsurancePolicy,
      delete: deleteInsurancePolicyAndData,
    },
    fields: [
      {
        id: 'type',
        label: '保單類型',
        type: 'select',
        required: true,
        optionsSource: 'policyTypes',
      },
      {
        id: 'memberId',
        label: '受保人',
        type: 'select',
        required: true,
        optionsSource: 'members',
      },
      {
        id: 'policyHolderId',
        label: '保單持有人',
        type: 'select',
        required: false,
        optionsSource: 'members',
        emptyText: '— 同受保人 —',
        hint: '若未選擇，預設與受保人相同',
      },
      {
        id: 'name',
        label: '保單名稱',
        type: 'text',
        required: true,
        maxlength: 60,
        placeholder: '例如：危疾+住院',
      },
      {
        id: 'company',
        label: '保險公司',
        type: 'select',
        required: false,
        optionsSource: 'companies',
      },
      {
        id: 'firstStartYear',
        label: '保單開始年份',
        type: 'number',
        required: true,
        min: 2000,
        max: 2100,
        defaultValue: () => new Date().getFullYear(),
      },
      {
        id: 'firstStartMonth',
        label: '保單開始月份',
        type: 'select',
        required: true,
        optionsSource: 'months',
        defaultValue: '01',
      },
      {
        id: 'totalPolicyYears',
        label: '總供款年期',
        type: 'number',
        required: true,
        min: 1,
        max: 50,
        defaultValue: 5,
      },
      {
        id: 'currentPeriodIndex',
        label: '當前第幾年度',
        type: 'number',
        required: true,
        min: 1,
        max: 50,
        defaultValue: 1,
      },
      {
        id: 'paymentType',
        label: '付款類型',
        type: 'select',
        required: true,
        optionsSource: 'insurancePaymentTypes',
      },
      {
        id: 'account',
        label: '扣款帳戶（可選）',
        type: 'text',
        required: false,
        maxlength: 60,
      },
      {
        id: 'annualPremium',
        label: '當前年度年繳保費（HK$）',
        type: 'number',
        required: true,
        min: 0,
        step: 1,
        defaultValue: 0,
      },
    ],
    // 保單的特殊轉換：把 annualPremium 轉為 periods 物件
    fromForm: (data) => {
      const startYear = Number(data.firstStartYear);
      const startMonth = String(data.firstStartMonth || '01').padStart(2, '0');
      const currentPeriod = Number(data.currentPeriodIndex);
      const annualPremium = Math.round(Number(data.annualPremium) || 0);
      const totalYears = Number(data.totalPolicyYears);

      const periodRange = _getPeriodRange(startYear, startMonth, currentPeriod);
      const periods = {};
      periods[String(currentPeriod)] = {
        periodIndex: currentPeriod,
        startYear: periodRange.startY,
        startMonth: periodRange.startM,
        annualPremium,
        monthlyAverage: Math.round(annualPremium / 12),
      };

      return {
        type: data.type || 'normal',
        memberId: data.memberId,
        policyHolderId: data.policyHolderId || data.memberId,
        name: data.name,
        company: data.company || '',
        paymentType: data.paymentType || '年繳',
        firstStartYear: startYear,
        firstStartMonth: startMonth,
        totalPolicyYears: totalYears,
        totalPolicyPeriods: totalYears * 12,
        totalPremium: annualPremium * totalYears,
        currentPeriodIndex: currentPeriod,
        account: data.account || '',
        periods,
      };
    },
    // 保單的特殊轉換：把 periods 轉回 annualPremium
    toForm: (row) => {
      const curPeriod = (row.periods || {})[String(row.currentPeriodIndex || 1)];
      return {
        ...row,
        annualPremium: curPeriod ? curPeriod.annualPremium : 0,
      };
    },
  },

  /* ============================================
     4. 基金
     ============================================ */
  [ENTITY_KEYS.FUND]: {
    key: ENTITY_KEYS.FUND,
    label: '基金',
    labelPlural: '基金',
    icon: 'line-chart',
    db: {
      create: addFund,
      update: updateFund,
      remove: removeFund,
      delete: null,   // 基金沒有關聯資料
    },
    fields: [
      {
        id: 'name',
        label: '基金名稱',
        type: 'text',
        required: true,
        maxlength: 60,
        placeholder: '例如：富達環球股票基金',
      },
      {
        id: 'cost',
        label: '投入成本（HK$）',
        type: 'number',
        required: true,
        min: 0,
        step: 1,
        defaultValue: 0,
      },
      {
        id: 'currentValue',
        label: '現時價值（HK$）',
        type: 'number',
        required: true,
        min: 0,
        step: 1,
        defaultValue: 0,
      },
      {
        id: 'units',
        label: '持有單位數（可選）',
        type: 'number',
        required: false,
        min: 0,
        step: 0.0001,
        defaultValue: 0,
      },
      {
        id: 'note',
        label: '備註（可選）',
        type: 'text',
        required: false,
        maxlength: 60,
      },
    ],
  },

  /* ============================================
     5. 支出類別
     ============================================ */
  [ENTITY_KEYS.CATEGORY]: {
    key: ENTITY_KEYS.CATEGORY,
    label: '支出類別',
    labelPlural: '支出類別',
    icon: 'tags',
    db: {
      create: addCategory,
      update: updateCategory,
      remove: removeCategory,
      delete: null,
    },
    fields: [
      {
        id: 'name',
        label: '類別名稱',
        type: 'text',
        required: true,
        maxlength: 20,
        placeholder: '例如：醫療類',
      },
      {
        id: 'order',
        label: '排序',
        type: 'number',
        min: 0,
        defaultValue: 0,
      },
    ],
    validate: (data, allRows, currentId) => {
      const name = (data.name || '').trim();
      if (allRows && allRows.some((c) => c.id !== currentId && c.name === name)) {
        return { field: 'name', message: '此類別名稱已存在' };
      }
      return null;
    },
  },

  /* ============================================
     6. 支出項目
     ============================================ */
  [ENTITY_KEYS.ITEM]: {
    key: ENTITY_KEYS.ITEM,
    label: '支出項目',
    labelPlural: '支出項目',
    icon: 'list',
    db: {
      create: addItem,
      update: updateItem,
      remove: removeItem,
      delete: null,
    },
    fields: [
      {
        id: 'categoryId',
        label: '所屬類別',
        type: 'select',
        required: true,
        optionsSource: 'categories',
      },
      {
        id: 'name',
        label: '項目名稱',
        type: 'text',
        required: true,
        maxlength: 30,
        placeholder: '例如：看病-濕疹',
      },
    ],
  },

  /* ============================================
     7. 支付方式
     ============================================ */
  [ENTITY_KEYS.PAYMENT]: {
    key: ENTITY_KEYS.PAYMENT,
    label: '支付方式',
    labelPlural: '支付方式',
    icon: 'credit-card',
    db: {
      create: addPaymentMethod,
      update: updatePaymentMethod,
      remove: removePaymentMethod,
      delete: null,
    },
    fields: [
      {
        id: 'name',
        label: '支付方式名稱',
        type: 'text',
        required: true,
        maxlength: 20,
        placeholder: '例如：現金、中銀',
      },
      {
        id: 'order',
        label: '排序',
        type: 'number',
        min: 0,
        defaultValue: 0,
      },
    ],
    validate: (data, allRows, currentId) => {
      const name = (data.name || '').trim();
      if (allRows && allRows.some((p) => p.id !== currentId && p.name === name)) {
        return { field: 'name', message: '此名稱已存在' };
      }
      return null;
    },
  },

  /* ============================================
     8. 狀態
     ============================================ */
  [ENTITY_KEYS.STATUS]: {
    key: ENTITY_KEYS.STATUS,
    label: '狀態',
    labelPlural: '狀態',
    icon: 'tag',
    db: {
      create: addStatus,
      update: updateStatus,
      remove: removeStatus,
      delete: null,
    },
    fields: [
      {
        id: 'name',
        label: '狀態名稱',
        type: 'text',
        required: true,
        maxlength: 20,
        placeholder: '例如：未處理、已還款',
      },
      {
        id: 'category',
        label: '所屬類別',
        type: 'select',
        required: true,
        optionsSource: 'statusCategories',
      },
      {
        id: 'isDone',
        label: '是否為「已完成」',
        type: 'select',
        required: true,
        optionsSource: 'booleanOptions',
        defaultValue: 'false',
      },
      {
        id: 'order',
        label: '排序',
        type: 'number',
        min: 0,
        defaultValue: 0,
      },
    ],
    toForm: (row) => ({ ...row, isDone: row.isDone ? 'true' : 'false' }),
    fromForm: (data) => ({ ...data, isDone: data.isDone === 'true' }),
    validate: (data, allRows, currentId) => {
      const name = (data.name || '').trim();
      if (allRows && allRows.some((s) => s.id !== currentId && s.name === name)) {
        return { field: 'name', message: '此狀態名稱已存在' };
      }
      return null;
    },
  },

  /* ============================================
     9. 固定支出模板
     ============================================ */
  [ENTITY_KEYS.FIXED_TEMPLATE]: {
    key: ENTITY_KEYS.FIXED_TEMPLATE,
    label: '固定支出',
    labelPlural: '固定支出',
    icon: 'file-text',
    db: {
      create: addFixedTemplate,
      update: updateFixedTemplate,
      remove: removeFixedTemplate,
      delete: deleteFixedTemplateAndMonths,
    },
    fields: [
      {
        id: 'name',
        label: '項目名稱',
        type: 'text',
        required: true,
        maxlength: 30,
        placeholder: '例如：管理費、房租',
      },
      {
        id: 'categoryId',
        label: '支出類別',
        type: 'select',
        required: false,
        optionsSource: 'categories',
      },
      {
        id: 'itemId',
        label: '支出項目',
        type: 'select',
        required: false,
        optionsSource: 'items',
        dependsOn: 'categoryId',
      },
      {
        id: 'memberId',
        label: '負責成員',
        type: 'select',
        required: false,
        optionsSource: 'membersWithShared',
        emptyText: '— 家庭共用 —',
      },
      {
        id: 'amount',
        label: '每月金額（HK$）',
        type: 'number',
        required: true,
        min: 0,
        step: 1,
        defaultValue: 0,
      },
      {
        id: 'cycle',
        label: '付款週期',
        type: 'select',
        required: true,
        optionsSource: 'cycles',
        defaultValue: '每月',
      },
      {
        id: 'paymentMethodId',
        label: '支付方式',
        type: 'select',
        required: false,
        optionsSource: 'payments',
      },
      {
        id: 'note',
        label: '備註（可選）',
        type: 'text',
        required: false,
        maxlength: 60,
      },
    ],
  },
};

/* ============================================
   對外 API
   ============================================ */

/**
 * 取得實體定義
 * @param {string} entityKey
 * @returns {Object|null}
 */
export function getEntityDef(entityKey) {
  return ENTITY_DEFS[entityKey] || null;
}

/**
 * 取得所有實體 key
 * @returns {string[]}
 */
export function getAllEntityKeys() {
  return Object.keys(ENTITY_DEFS);
}

/**
 * 取得所有實體定義
 * @returns {Object}
 */
export function getAllEntityDefs() {
  return { ...ENTITY_DEFS };
}

/**
 * 取得實體的欄位定義
 * @param {string} entityKey
 * @returns {Array}
 */
export function getEntityFields(entityKey) {
  const def = getEntityDef(entityKey);
  return def ? def.fields : [];
}

/**
 * 取得實體的欄位（僅新增用，排除隱藏欄位）
 * @param {string} entityKey
 * @returns {Array}
 */
export function getEntityFormFields(entityKey) {
  return getEntityFields(entityKey).filter((f) => f.type !== 'hidden');
}

/**
 * 解析欄位的預設值
 * @param {Object} field
 * @returns {*}
 */
export function resolveFieldDefault(field) {
  if (field.defaultValue == null) return '';
  if (typeof field.defaultValue === 'function') return field.defaultValue();
  return field.defaultValue;
}

/* ============================================
   內部工具
   ============================================ */

function _getPeriodRange(firstY, firstM, periodIndex) {
  const startDate = new Date(Number(firstY), Number(firstM) - 1, 1);
  startDate.setMonth(startDate.getMonth() + (periodIndex - 1) * 12);
  return {
    startY: startDate.getFullYear(),
    startM: String(startDate.getMonth() + 1).padStart(2, '0'),
  };
}