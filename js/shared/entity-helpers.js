// ============================================
// entity-helpers.js — 通用實體 CRUD 輔助（v101.5 🆕）
// 位置：js/shared/entity-helpers.js
// ============================================
// 職責：
//   1. 薄封裝 db.js 的 CRUD（不重新實作）
//   2. 提供動態選項（供 form-builder 的 optionsSource）
//   3. 提供跨來源改狀態（供 settlements / 各頁面）
//   4. 提供 badge 渲染（統一全站狀態顯示）
//
// 設計原則：
//   - 不處理 UI（Toast / Modal 由呼叫端處理）
//   - 不重新實作 CRUD（呼叫 db.js）
//   - 只做「表單資料 ↔ db 物件」的轉換
// ============================================

import {
  // 成員
  listenMembers, getMembersOnce,
  // 銀行
  listenBanks,
  // 保險公司
  listenInsuranceCompanies,
  // 支付方式
  listenPaymentMethods,
  // 類別 / 項目
  listenCategories, listenItems,
  // 狀態
  listenStatuses,
  // 更新狀態
  updateEntityStatus as dbUpdateEntityStatus,
} from '../core/db.js';

import {
  getEntityDef,
  resolveFieldDefault,
} from '../config/entity-definitions.js';

import {
  getOptions,
  getStatusesByCategory,
} from '../config/app-config.js';

import {
  escapeHtml,
  sortMembers,
} from '../core/utils.js';

import {
  RESERVED_IDS,
  getStatusBadgeClass,
} from '../config/constants.js';

/* ============================================
   1. CRUD（薄封裝）
   ============================================ */

/**
 * 建立實體
 * @param {string} entityKey
 * @param {Object} data - 表單資料
 * @param {Array} [allRows] - 現有資料（供 validate / beforeCreate 用）
 * @returns {Promise<string>} 新 ID
 */
export async function createEntity(entityKey, data, allRows = []) {
  const def = getEntityDef(entityKey);
  if (!def) throw new Error(`未知的實體：${entityKey}`);
  if (!def.db.create) throw new Error(`實體 ${entityKey} 不支援新增`);

  // 轉換（fromForm）
  let payload = def.fromForm ? def.fromForm(data) : { ...data };

  // 驗證
  if (def.validate) {
    const err = def.validate(payload, allRows, null);
    if (err) throw new Error(err.message);
  }

  // 建立前處理（beforeCreate）
  if (def.beforeCreate) {
    payload = def.beforeCreate(payload, allRows);
  }

  return def.db.create(payload);
}

/**
 * 更新實體
 * @param {string} entityKey
 * @param {string} id
 * @param {Object} data - 表單資料
 * @param {Array} [allRows]
 * @returns {Promise<void>}
 */
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

/**
 * 刪除實體（一般）
 * @param {string} entityKey
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function removeEntity(entityKey, id) {
  const def = getEntityDef(entityKey);
  if (!def) throw new Error(`未知的實體：${entityKey}`);
  if (!def.db.remove) throw new Error(`實體 ${entityKey} 不支援刪除`);
  return def.db.remove(id);
}

/**
 * 刪除實體（含關聯資料）
 * @param {string} entityKey
 * @param {string} id
 * @param {...any} args - 額外參數（例如 policy 的 memberId）
 * @returns {Promise<void>}
 */
export async function deleteEntity(entityKey, id, ...args) {
  const def = getEntityDef(entityKey);
  if (!def) throw new Error(`未知的實體：${entityKey}`);
  if (!def.db.delete) {
    // fallback 到一般刪除
    return removeEntity(entityKey, id);
  }
  return def.db.delete(id, ...args);
}

/* ============================================
   2. 動態選項（供 form-builder 使用）
   ============================================ */

/**
 * 取得動態選項
 * @param {string} source
 * @param {Object} [context] - 例如 { categoryId }
 * @returns {Promise<Array<{value, label}>>}
 */
export async function getDynamicOptions(source, context = {}) {
  if (!source) return [];

  try {
    switch (source) {
      case 'members': {
        const list = await getMembersOnce();
        return sortMembers(list).map((m) => ({ value: m.id, label: m.name }));
      }

      case 'membersWithShared': {
        const list = await getMembersOnce();
        const opts = sortMembers(list).map((m) => ({ value: m.id, label: m.name }));
        return opts;
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

      case 'statuses:personal':
        return _statusOptions('personal');
      case 'statuses:fixed':
        return _statusOptions('fixed');
      case 'statuses:insurance':
        return _statusOptions('insurance');

      case 'memberRoles':
        return getOptions('memberRoles');
      case 'cycles':
        return getOptions('cycles');
      case 'policyTypes':
        return getOptions('policyTypes');
      case 'insurancePaymentTypes':
        return getOptions('insurancePaymentTypes');

      case 'statusCategories':
        return [
          { value: 'personal', label: '個人支出' },
          { value: 'fixed', label: '固定支出' },
          { value: 'insurance', label: '保險' },
        ];

      case 'booleanOptions':
        return [
          { value: 'false', label: '否（未處理類）' },
          { value: 'true', label: '是（已完成類）' },
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

/**
 * 從 Firebase 讀取一次清單
 * @param {string} path - 相對於 families/{uid}/
 */
async function _getOnce(path) {
  // 動態 import 避免循環依賴
  const { get } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js');
  const { familyRef } = await import('../core/db.js');
  const snap = await get(familyRef(path));
  const val = snap.val() || {};
  return Object.entries(val).map(([id, x]) => ({ id, ...x }));
}

/* ============================================
   3. 跨來源改狀態（供 settlements 使用）
   ============================================ */

/**
 * 更新實體狀態（跨來源）
 * @param {'personal'|'fixed'} source
 * @param {Object} row - 結算 row（含 _ref）
 * @param {string} newStatus
 * @returns {Promise<void>}
 */
export async function updateEntityStatus(source, row, newStatus) {
  const isDone = _isDoneStatus(newStatus, source);
  return dbUpdateEntityStatus(source, row, newStatus, isDone);
}

/**
 * 判斷狀態是否為「已完成」
 * @param {string} statusName
 * @param {string} category
 * @returns {boolean}
 */
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
   4. 狀態 badge 渲染（統一全站）
   ============================================ */

/**
 * 渲染狀態 badge
 * @param {string} statusName
 * @param {string} category - 'personal' | 'fixed' | 'insurance'
 * @returns {string} HTML
 */
export function renderStatusBadge(statusName, category) {
  const isDone = _isDoneStatus(statusName, category);
  const isSkipped = statusName === '不適用';
  const cls = getStatusBadgeClass(isDone, isSkipped);
  const fallback = _getStatusFallback(category);
  return `<span class="badge ${cls}">${escapeHtml(statusName || fallback)}</span>`;
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

/**
 * 從表單資料建立 payload（含 fromForm）
 */
export function buildPayload(entityKey, formData) {
  const def = getEntityDef(entityKey);
  if (!def) throw new Error(`未知的實體：${entityKey}`);
  return def.fromForm ? def.fromForm(formData) : { ...formData };
}

/**
 * 從 db 物件建立表單初始資料（含 toForm）
 */
export function buildInitialData(entityKey, row) {
  const def = getEntityDef(entityKey);
  if (!def) throw new Error(`未知的實體：${entityKey}`);
  return def.toForm ? def.toForm(row) : { ...row };
}

/**
 * 取得欄位預設值集合
 */
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
   6. 監聽輔助（供各頁面用）
   ============================================ */

/**
 * 監聽實體清單（依 entityKey 自動選擇 listener）
 * @param {string} entityKey
 * @param {Function} cb
 * @param {Function} [err]
 * @returns {Function} unsubscribe
 */
export function listenEntity(entityKey, cb, err) {
  switch (entityKey) {
    case 'member':
      return listenMembers(cb, err);
    case 'bank':
      return listenBanks(cb, err);
    case 'category':
      return listenCategories(cb, err);
    case 'item':
      return listenItems(cb, err);
    case 'payment':
      return listenPaymentMethods(cb, err);
    case 'status':
      return listenStatuses(cb, err);
    case 'company':
      return listenInsuranceCompanies(cb, err);
    default:
      console.warn(`[entity-helpers] listenEntity 不支援：${entityKey}`);
      return () => {};
  }
}