// ============================================
// entity-definitions.js — 實體表單定義 SSOT（v103.0.0）
// 位置：js/entity/entity-definitions.js
// ============================================
// v103.0.0 重構：
//   ✅ 從 js/config/entity-definitions.js 移入 js/entity/
//   ✅ import 路徑更新（constants / db）
//   ✅ 保留 v102.0.0 全部功能（含 POLICY 代墊自動建立）
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
  addMemberAdvance,
} from '../core/db.js';

import { ENTITY_KEYS, LIMITS } from '../config/constants.js';

/* ============================================
   POLICY 建立包裝（代墊模式自動建立 member_advances）
   ============================================ */
async function _createPolicyWithAdvance(policy) {
  const policyId = await addInsurancePolicy(policy);
  if (!policyId) return policyId;

  // 代墊模式：自動建立 member_advances
  if (
    policy.paymentMode === 'advance' &&
    policy.advanceHolderId &&
    Number(policy.totalPremium) > 0
  ) {
    try {
      const advanceId = await addMemberAdvance(policy.advanceHolderId, {
        policyId,
        totalAmount: Number(policy.totalPremium) || 0,
        remainingAmount: Number(policy.totalPremium) || 0,
        startYear: String(policy.firstStartYear || ''),
        startMonth: String(policy.firstStartMonth || '01').padStart(2, '0'),
        note: `代墊：${policy.name || ''}`,
      });

      if (advanceId) {
        // 寫回保單的 advanceId（供未來查詢）
        await updateInsurancePolicy(policyId, { advanceId });
      }
    } catch (err) {
      // 保單已建立，但代墊建立失敗 → 記錄警告，不回滾保單
      console.warn('[entity-definitions] 建立代墊記錄失敗：', err);
    }
  }

  return policyId;
}

/* ============================================
   實體定義表（8 個）
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
      { id: 'name', label: '名稱', type: 'text', required: true, maxlength: 20, placeholder: '例如：老公、梓舜' },
      { id: 'role', label: '角色', type: 'select', required: true, optionsSource: 'memberRoles' },
      { id: 'order', label: '排序', type: 'number-plain', min: 0, defaultValue: 0 },
    ],

    ui: {
      listColumns: ['name', 'role', 'order'],
      cardFields: ['role', 'order'],
      primaryColumn: 'name',
      searchFields: ['name'],
      sortOptions: [
        { value: 'order-asc',  label: '排序（小→大）' },
        { value: 'name-asc',   label: '名稱（A→Z）' },
      ],
      defaultSort: 'order-asc',
      pageSize: LIMITS.DEFAULT_TABLE_PAGE_SIZE,
      canCreate: true,
      canEdit: true,
      canDelete: true,
      deleteConfirmText: (row) => `⚠️ 確定要刪除成員「${row.name}」嗎？\n\n這將會一併刪除該成員在所有月份的所有支出紀錄（含保險平攤），此操作無法復原。`,
    },

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
      { id: 'name', label: '銀行名稱', type: 'text', required: true, maxlength: 20, placeholder: '例如：中銀、匯豐' },
    ],

    ui: {
      listColumns: ['name'],
      cardFields: ['name'],
      primaryColumn: 'name',
      searchFields: ['name'],
      sortOptions: [
        { value: 'name-asc',  label: '名稱（A→Z）' },
        { value: 'name-desc', label: '名稱（Z→A）' },
      ],
      defaultSort: 'name-asc',
      pageSize: LIMITS.DEFAULT_TABLE_PAGE_SIZE,
      canCreate: true,
      canEdit: true,
      canDelete: true,
      deleteConfirmText: (row) => `⚠️ 確定要刪除「${row.name}」嗎？\n\n這將會一併刪除該銀行在所有月份的結餘紀錄，此操作無法復原。`,
    },

    validate: (data, allRows, currentId) => {
      const name = (data.name || '').trim();
      if (allRows && allRows.some(b => b.id !== currentId && b.name === name)) {
        return { field: 'name', message: '此銀行名稱已存在' };
      }
      return null;
    },
  },

  /* ============================================
     3. 保單（含代墊自動建立）
     ============================================ */
  [ENTITY_KEYS.POLICY]: {
    key: ENTITY_KEYS.POLICY,
    label: '保單',
    labelPlural: '保單',
    icon: 'shield',

    db: {
      create: _createPolicyWithAdvance,
      update: updateInsurancePolicy,
      remove: removeInsurancePolicy,
      delete: deleteInsurancePolicyAndData,
    },

    fields: [
      { id: 'type', label: '保單類型', type: 'select', required: true, optionsSource: 'policyTypes' },
      { id: 'memberId', label: '受保人', type: 'select', required: true, optionsSource: 'members' },
      { id: 'policyHolderId', label: '保單持有人', type: 'select', required: false, optionsSource: 'members', emptyText: '— 同受保人 —', hint: '若未選擇，預設與受保人相同' },
      { id: 'name', label: '保單名稱', type: 'text', required: true, maxlength: 60, placeholder: '例如：危疾+住院' },
      { id: 'company', label: '保險公司', type: 'select', required: false, optionsSource: 'companies' },

      { id: 'paymentMode', label: '付款模式', type: 'select', required: true, optionsSource: 'paymentModes', defaultValue: 'direct' },
      { id: 'advanceHolderId', label: '代墊成員（若為代墊模式）', type: 'select', required: false, optionsSource: 'members', emptyText: '— 請選擇 —', hint: '僅在「代墊模式」時需要' },

      { id: 'firstStartYear', label: '保單開始年份', type: 'number-plain', required: true, min: 2000, max: 2100, defaultValue: () => new Date().getFullYear() },
      { id: 'firstStartMonth', label: '保單開始月份', type: 'select', required: true, optionsSource: 'months', defaultValue: '01' },
      { id: 'totalPolicyYears', label: '總供款年期', type: 'number-plain', required: true, min: 1, max: 50, defaultValue: 5 },
      { id: 'currentPeriodIndex', label: '當前第幾年度', type: 'number-plain', required: true, min: 1, max: 50, defaultValue: 1 },
      { id: 'paymentType', label: '付款類型', type: 'select', required: true, optionsSource: 'insurancePaymentTypes' },
      { id: 'account', label: '扣款帳戶（可選）', type: 'text', required: false, maxlength: 60 },
      { id: 'monthlyPremium', label: '月供金額（HK$）', type: 'number', required: false, min: 0, step: 1, defaultValue: 0, hint: '💡 基金保險（投資型）填此欄；普通保險留空即可' },
      { id: 'annualPremium', label: '當前年度年繳保費（HK$）', type: 'number', required: false, min: 0, step: 1, defaultValue: 0, hint: '💡 普通保險（住院 / 人壽 / 意外）填此欄' },
    ],

    ui: {
      listColumns: ['name', 'policyHolderId', 'memberId', 'company', 'currentPeriodIndex'],
      cardFields: ['policyHolderId', 'memberId', 'firstStartYear', 'annualPremium'],
      primaryColumn: 'name',
      searchFields: ['name', 'company'],
      sortOptions: [
        { value: 'name-asc',        label: '名稱（A→Z）' },
        { value: 'startYear-asc',   label: '開始年（舊→新）' },
        { value: 'startYear-desc',  label: '開始年（新→舊）' },
      ],
      defaultSort: 'name-asc',
      pageSize: LIMITS.DEFAULT_TABLE_PAGE_SIZE,
      canCreate: true,
      canEdit: true,
      canDelete: true,
      deleteConfirmText: (row) => `⚠️ 確定要刪除保單「${row.name}」嗎？\n\n這將會一併刪除所有相關的扣款紀錄與成員支出，此操作無法復原。`,
    },

    validate: (data, allRows, currentId) => {
      const type = data.type || 'normal';
      const monthlyPremium = Number(data.monthlyPremium) || 0;
      const annualPremium = Number(data.annualPremium) || 0;
      const paymentMode = data.paymentMode || 'direct';

      if (type === 'fund_insurance' && monthlyPremium <= 0) {
        return { field: 'monthlyPremium', message: '基金保險請填寫月供金額（大於 0）' };
      }
      if (type === 'normal' && annualPremium <= 0) {
        return { field: 'annualPremium', message: '普通保險請填寫年繳保費（大於 0）' };
      }
      if (paymentMode === 'advance' && !data.advanceHolderId) {
        return { field: 'advanceHolderId', message: '代墊模式需指定代墊成員' };
      }
      return null;
    },

    fromForm: (data) => {
      const type = data.type || 'normal';
      const paymentMode = data.paymentMode || 'direct';
      const startYear = Number(data.firstStartYear);
      const startMonth = String(data.firstStartMonth || '01').padStart(2, '0');
      const currentPeriod = Number(data.currentPeriodIndex);
      const annualPremium = Math.round(Number(data.annualPremium) || 0);
      const monthlyPremium = Math.round(Number(data.monthlyPremium) || 0);
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
        type,
        memberId: data.memberId,
        policyHolderId: data.policyHolderId || data.memberId,
        name: data.name,
        company: data.company || '',
        paymentType: data.paymentType || '年繳',
        paymentMode,
        advanceHolderId: paymentMode === 'advance' ? (data.advanceHolderId || '') : '',
        firstStartYear: startYear,
        firstStartMonth: startMonth,
        totalPolicyYears: totalYears,
        totalPolicyPeriods: totalYears * 12,
        totalPremium: annualPremium * totalYears,
        currentPeriodIndex: currentPeriod,
        account: data.account || '',
        monthlyPremium,
        annualPremium,
        periods,
      };
    },

    toForm: (row) => {
      const curPeriod = (row.periods || {})[String(row.currentPeriodIndex || 1)];
      return {
        ...row,
        annualPremium: curPeriod ? curPeriod.annualPremium : (row.annualPremium || 0),
        monthlyPremium: row.monthlyPremium || 0,
        paymentMode: row.paymentMode || 'direct',
        advanceHolderId: row.advanceHolderId || '',
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
      delete: null,
    },

    fields: [
      { id: 'name', label: '基金名稱', type: 'text', required: true, maxlength: 60, placeholder: '例如：富達環球股票基金' },
      { id: 'cost', label: '投入成本（HK$）', type: 'number', required: true, min: 0, step: 1, defaultValue: 0 },
      { id: 'currentValue', label: '現時價值（HK$）', type: 'number', required: true, min: 0, step: 1, defaultValue: 0 },
      { id: 'units', label: '持有單位數（可選）', type: 'number-plain', required: false, min: 0, step: 0.0001, defaultValue: 0 },
      { id: 'note', label: '備註（可選）', type: 'text', required: false, maxlength: 60 },
    ],

    ui: {
      listColumns: ['name', 'cost', 'currentValue', 'units'],
      cardFields: ['cost', 'currentValue', 'units'],
      primaryColumn: 'name',
      searchFields: ['name'],
      sortOptions: [
        { value: 'name-asc',   label: '名稱（A→Z）' },
        { value: 'value-desc', label: '現值（大→小）' },
      ],
      defaultSort: 'name-asc',
      pageSize: LIMITS.DEFAULT_TABLE_PAGE_SIZE,
      canCreate: true,
      canEdit: true,
      canDelete: true,
      deleteConfirmText: (row) => `確定要刪除基金「${row.name}」嗎？`,
    },
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
      { id: 'name', label: '類別名稱', type: 'text', required: true, maxlength: 20, placeholder: '例如：醫療類' },
      { id: 'order', label: '排序', type: 'number-plain', min: 0, defaultValue: 0 },
    ],

    ui: {
      listColumns: ['name', 'order'],
      cardFields: ['order'],
      primaryColumn: 'name',
      searchFields: ['name'],
      sortOptions: [
        { value: 'order-asc', label: '排序（小→大）' },
        { value: 'name-asc',  label: '名稱（A→Z）' },
      ],
      defaultSort: 'order-asc',
      pageSize: LIMITS.DEFAULT_TABLE_PAGE_SIZE,
      canCreate: true,
      canEdit: true,
      canDelete: true,
      deleteConfirmText: (row) => `確定要刪除類別「${row.name}」嗎？`,
    },

    validate: (data, allRows, currentId) => {
      const name = (data.name || '').trim();
      if (allRows && allRows.some(c => c.id !== currentId && c.name === name)) {
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
      { id: 'categoryId', label: '所屬類別', type: 'select', required: true, optionsSource: 'categories' },
      { id: 'name', label: '項目名稱', type: 'text', required: true, maxlength: 30, placeholder: '例如：看病-濕疹' },
    ],

    ui: {
      listColumns: ['name', 'categoryId'],
      cardFields: ['categoryId'],
      primaryColumn: 'name',
      searchFields: ['name'],
      sortOptions: [{ value: 'name-asc', label: '名稱（A→Z）' }],
      defaultSort: 'name-asc',
      pageSize: LIMITS.DEFAULT_TABLE_PAGE_SIZE,
      canCreate: true,
      canEdit: true,
      canDelete: true,
      deleteConfirmText: (row) => `確定要刪除項目「${row.name}」嗎？`,
    },
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
      { id: 'name', label: '支付方式名稱', type: 'text', required: true, maxlength: 20, placeholder: '例如：現金、中銀' },
      { id: 'order', label: '排序', type: 'number-plain', min: 0, defaultValue: 0 },
    ],

    ui: {
      listColumns: ['name', 'order'],
      cardFields: ['order'],
      primaryColumn: 'name',
      searchFields: ['name'],
      sortOptions: [
        { value: 'order-asc', label: '排序（小→大）' },
        { value: 'name-asc',  label: '名稱（A→Z）' },
      ],
      defaultSort: 'order-asc',
      pageSize: LIMITS.DEFAULT_TABLE_PAGE_SIZE,
      canCreate: true,
      canEdit: true,
      canDelete: true,
      deleteConfirmText: (row) => `確定要刪除支付方式「${row.name}」嗎？`,
    },

    validate: (data, allRows, currentId) => {
      const name = (data.name || '').trim();
      if (allRows && allRows.some(p => p.id !== currentId && p.name === name)) {
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
      { id: 'name', label: '狀態名稱', type: 'text', required: true, maxlength: 20, placeholder: '例如：未處理、已還款' },
      { id: 'category', label: '所屬類別', type: 'select', required: true, optionsSource: 'statusCategories' },
      { id: 'isDone', label: '是否為「已完成」', type: 'select', required: true, optionsSource: 'booleanOptions', defaultValue: 'false' },
      { id: 'order', label: '排序', type: 'number-plain', min: 0, defaultValue: 0 },
    ],

    ui: {
      listColumns: ['name', 'category', 'isDone', 'order'],
      cardFields: ['category', 'isDone', 'order'],
      primaryColumn: 'name',
      searchFields: ['name'],
      sortOptions: [
        { value: 'order-asc',    label: '排序（小→大）' },
        { value: 'category-asc', label: '類別' },
      ],
      defaultSort: 'order-asc',
      pageSize: LIMITS.DEFAULT_TABLE_PAGE_SIZE,
      canCreate: true,
      canEdit: true,
      canDelete: true,
      deleteConfirmText: (row) => `確定要刪除狀態「${row.name}」嗎？`,
    },

    toForm: (row) => ({ ...row, isDone: row.isDone ? 'true' : 'false' }),
    fromForm: (data) => ({ ...data, isDone: data.isDone === 'true' }),

    validate: (data, allRows, currentId) => {
      const name = (data.name || '').trim();
      if (allRows && allRows.some(s => s.id !== currentId && s.name === name)) {
        return { field: 'name', message: '此狀態名稱已存在' };
      }
      return null;
    },
  },
};

/* ============================================
   對外 API
   ============================================ */

export function getEntityDef(entityKey) {
  return ENTITY_DEFS[entityKey] || null;
}

export function getAllEntityKeys() {
  return Object.keys(ENTITY_DEFS);
}

export function getAllEntityDefs() {
  return { ...ENTITY_DEFS };
}

export function getEntityFields(entityKey) {
  const def = getEntityDef(entityKey);
  return def ? def.fields : [];
}

export function getEntityFormFields(entityKey) {
  return getEntityFields(entityKey).filter((f) => f.type !== 'hidden');
}

export function getEntityUi(entityKey) {
  const def = getEntityDef(entityKey);
  return def ? def.ui : null;
}

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
