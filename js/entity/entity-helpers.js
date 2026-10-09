// ============================================
// entity-helpers.js — 通用實體 CRUD 輔助（v103.0.0）
// 位置：js/entity/entity-helpers.js
// ============================================
// v103.0.0 重構：
//   ✅ 從 js/shared/entity-helpers.js 移入 js/entity/
//   ✅ 逸出改用 lib/dom.js 的 esc()
//   ✅ getDynamicOptions 來源改為 entity-definitions.js（SSOT）
//   ✅ 保留 v102.0.0 全部功能（含 paymentModes / bankAccounts）
// ============================================

import {
  listenMembers, getMembersOnce,
  listenBanks, listenFunds,
  listenInsurancePolicies, getInsurancePoliciesOnce,
  listenInsuranceCompanies,
  listenPaymentMethods,
  listenCategories, listenItems,
  listenStatuses,
  listenBankAccounts,
  updateEntityStatus as dbUpdateEntityStatus,
} from '../core/db.js';

import { getEntityDef, resolveFieldDefault } from './entity-definitions.js';
import { getOptions, getStatusesByCategory } from '../config/app-config.js';
import { sortMembers } from '../core/utils.js';
import { esc } from '../lib/dom.js';
import {
  getStatusBadgeClass,
  RESERVED_IDS,
} from '../config/constants.js';

/* ============================================
   1. CRUD（薄封裝）
   ============================================ */

export async function createEntity(entityKey, data, allRows = []) {
  const def = getEntityDef(entityKey);
  if (!def) throw new Error(`未知的實體：${entityKey}`);
  if (!def.db.create) throw new Error(`實體 ${entityKey} 不支援新增`);

  let payload = def.fromForm ? def.fromForm(data) : { ...data };

  if (def.validate) {
    const err = def.validate(payload, allRows, null);
    if (err) throw new Error(err.message);
  }

  if (def.beforeCreate) {
    payload = def.beforeCreate(payload, allRows);
  }

  return def.db.create(payload);
}

export async function updateEntity(entityKey, id, data, allRows = []) {
  const def = getEntityDef(entityKey);
  if (!def) throw new Error(`未知的實體：${entityKey}`);
  if (!def.db.update) throw new Error(`實體 ${entityKey} 不支援更新`);

  let payload = def.fromForm ? def.fromForm(data) : { ...data };

  if (def.validate) {
    const err = def.validate(payload, allRows, id);
    if (err) throw new Error(err.message);
  }

  return def.db.update(id, payload);
}

export async function removeEntity(entityKey, id) {
  const def = getEntityDef(entityKey);
  if (!def) throw new Error(`未知的實體：${entityKey}`);
  if (!def.db.remove) throw new Error(`實體 ${entityKey} 不支援刪除`);
  return def.db.remove(id);
}

export async function deleteEntity(entityKey, id, ...args) {
  const def = getEntityDef(entityKey);
  if (!def) throw new Error(`未知的實體：${entityKey}`);
  if (!def.db.delete) {
    return removeEntity(entityKey, id);
  }
  return def.db.delete(id, ...args);
}

/* ============================================
   2. 動態選項
   ============================================ */

export async function getDynamicOptions(source, context = {}) {
  if (!source) return [];

  try {
    switch (source) {
      case 'members':
      case 'membersWithShared': {
        const list = await getMembersOnce();
        return sortMembers(list).map((m) => ({ value: m.id, label: m.name }));
      }

      case 'categories': {
        const list = await _getOnce('expense_categories');
        return list
          .sort((a, b) => (a.order || 0) - (b.order || 0))
          .map((c) => ({ value: c.id, label: c.name }));
      }

      case 'items': {
        const list = await _getOnce('expense_items');
        const filtered = context.categoryId
          ? list.filter((i) => i.categoryId === context.categoryId)
          : list;
        return filtered.map((i) => ({ value: i.id, label: i.name }));
      }

      case 'payments': {
        const list = await _getOnce('payment_methods');
        return list
          .sort((a, b) => (a.order || 0) - (b.order || 0))
          .map((p) => ({ value: p.id, label: p.name }));
      }

      case 'companies': {
        const list = await _getOnce('insurance_companies');
        return list.map((c) => ({ value: c.name, label: c.name }));
      }

      case 'banks': {
        const list = await _getOnce('banks');
        return list
          .sort((a, b) => (a.order || 0) - (b.order || 0))
          .map((b) => ({ value: b.id, label: b.name }));
      }

      case 'bankAccounts': {
        const list = await _getOnce('bank_accounts');
        return list
          .sort((a, b) => (a.order || 0) - (b.order || 0))
          .map((b) => ({ value: b.id, label: b.name }));
      }

      case 'statuses:personal':
        return _statusOptions('personal');
      case 'statuses:fixed':
        return _statusOptions('fixed');
      case 'statuses:insurance':
        return _statusOptions('insurance');

      case 'memberRoles':
        return getOptions('memberRoles');
      case 'policyTypes':
        return getOptions('policyTypes');
      case 'insurancePaymentTypes':
        return getOptions('insurancePaymentTypes');
      case 'paymentModes':
        return getOptions('paymentModes');
      case 'categoryOrder':
        return getOptions('categoryOrder');

      case 'statusCategories':
        return [
          { value: 'personal',  label: '個人支出' },
          { value: 'fixed',     label: '固定支出' },
          { value: 'insurance', label: '保險' },
        ];

      case 'booleanOptions':
        return [
          { value: 'false', label: '否（未處理類）' },
          { value: 'true',  label: '是（已完成類）' },
        ];

      case 'months': {
        const opts = [];
        for (let m = 1; m <= 12; m++) {
          opts.push({ value: String(m).padStart(2, '0'), label: `${m} 月` });
        }
        return opts;
      }

      default:
        console.warn(`[entity-helpers] 未知的 optionsSource：${source}`);
        return [];
    }
  } catch (err) {
    console.error(`[entity-helpers] 載入動態選項失敗 (${source})：`, err);
    return [];
  }
}

function _statusOptions(category) {
  const list = getStatusesByCategory(category);
  return list.map((s) => ({ value: s.name, label: s.name }));
}

async function _getOnce(path) {
  const { get } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js');
  const { familyRef } = await import('../core/db.js');
  const snap = await get(familyRef(path));
  const val = snap.val() || {};
  return Object.entries(val).map(([id, x]) => ({ id, ...x }));
}

/* ============================================
   3. 跨來源改狀態
   ============================================ */

export async function updateEntityStatus(source, row, newStatus) {
  const isDone = _isDoneStatus(newStatus, source);
  return dbUpdateEntityStatus(source, row, newStatus, isDone);
}

export function isDoneStatus(statusName, category) {
  return _isDoneStatus(statusName, category);
}

function _isDoneStatus(statusName, category) {
  if (!statusName) return false;
  try {
    const statuses = getStatusesByCategory(category);
    const found = statuses.find((s) => s.name === statusName);
    if (found) return !!found.isDone;
  } catch (e) {
    // ignore
  }
  return statusName.startsWith('已');
}

/* ============================================
   4. 狀態 badge 渲染
   ============================================ */

export function renderStatusBadge(statusName, category) {
  const isDone = _isDoneStatus(statusName, category);
  const isSkipped = statusName === '不適用';
  const cls = getStatusBadgeClass(isDone, isSkipped);
  const fallback = _getStatusFallback(category);
  return `<span class="badge ${cls}">${esc(statusName || fallback)}</span>`;
}

function _getStatusFallback(category) {
  switch (category) {
    case 'fixed':     return '未付款';
    case 'insurance': return '未扣款';
    case 'personal':
    default:          return '未處理';
  }
}

/* ============================================
   5. 資料轉換輔助
   ============================================ */

export function buildPayload(entityKey, formData) {
  const def = getEntityDef(entityKey);
  if (!def) throw new Error(`未知的實體：${entityKey}`);
  return def.fromForm ? def.fromForm(formData) : { ...formData };
}

export function buildInitialData(entityKey, row) {
  const def = getEntityDef(entityKey);
  if (!def) throw new Error(`未知的實體：${entityKey}`);
  return def.toForm ? def.toForm(row) : { ...row };
}

export function getFieldDefaults(entityKey) {
  const def = getEntityDef(entityKey);
  if (!def) return {};
  const result = {};
  def.fields.forEach((f) => {
    if (f.defaultValue != null) {
      result[f.id] = resolveFieldDefault(f);
    }
  });
  return result;
}

/* ============================================
   6. 監聽輔助
   ============================================ */

export function listenEntity(entityKey, cb, err) {
  switch (entityKey) {
    case 'member':      return listenMembers(cb, err);
    case 'bank':        return listenBanks(cb, err);
    case 'category':    return listenCategories(cb, err);
    case 'item':        return listenItems(cb, err);
    case 'payment':     return listenPaymentMethods(cb, err);
    case 'status':      return listenStatuses(cb, err);
    case 'company':     return listenInsuranceCompanies(cb, err);
    case 'policy':      return listenInsurancePolicies(cb, err);
    case 'fund':        return listenFunds(cb, err);
    case 'bankAccount': return listenBankAccounts(cb, err);
    default:
      console.warn(`[entity-helpers] listenEntity 不支援：${entityKey}`);
      return () => {};
  }
}

/* ============================================
   7. 便利函式
   ============================================ */

export async function getPoliciesOnce() {
  return getInsurancePoliciesOnce();
}

/**
 * 判斷 ID 是否為保留 ID
 */
export function isReservedId(id) {
  return id === RESERVED_IDS.EXTRA_INCOME || id === RESERVED_IDS.SHARED_MEMBER;
}
