// ============================================
// entity-registry.js — 名稱解析 SSOT（v103.0.0）
// 位置：js/config/entity-registry.js
// ============================================
// 職責：
//   1. 註冊 7 種實體，統一從 Firebase 訂閱
//   2. 提供 ID → 名稱的即時解析（resolveName）
//   3. 提供列表（getList）、名稱 Map（getNameMap）
//
// 設計原則：
//   - 全站「名稱解析」只走此處
//   - 一個實體只訂閱一次（單例）
//   - 舊 banks 節點一併註冊（相容層）
//   - destroy() 完整清理所有監聽
// ============================================

import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { db } from './firebase-config.js';
import { AppState } from '../core/state.js';
import { ENTITY_KEYS } from './constants.js';

/* ============================================
   1. 實體路徑對照表（含舊資料相容）
   -------------------------------------------------
   - members / banks / bank_accounts
   - categories → expense_categories
   - items → expense_items
   - companies → insurance_companies
   - payments → payment_methods
   ============================================ */
const PATHS = {
  members:       'members',
  banks:         'banks',                  // 舊資料相容
  bank_accounts: 'bank_accounts',
  categories:    'expense_categories',
  items:         'expense_items',
  companies:     'insurance_companies',
  payments:      'payment_methods',
};

/* ============================================
   2. 排序函式
   ============================================ */
function byOrderThenCreated(a, b) {
  const oa = a.order != null ? a.order : Number.MAX_SAFE_INTEGER;
  const ob = b.order != null ? b.order : Number.MAX_SAFE_INTEGER;
  if (oa !== ob) return oa - ob;
  return (a.createdAt || 0) - (b.createdAt || 0);
}

function byCreatedAt(a, b) {
  return (a.createdAt || 0) - (b.createdAt || 0);
}

/* ============================================
   3. Module 狀態
   ============================================ */
const _lists = {};           // { members: [{id, name, ...}], ... }
const _nameMaps = {};        // { members: { id: name }, ... }
const _unsubscribers = [];   // 所有 Firebase 監聽的 unsubscribe
let _initialized = false;

/* ============================================
   4. 初始化 / 銷毀
   ============================================ */

/**
 * 啟動所有實體訂閱
 * - 已初始化則略過（單例）
 * - 若尚未有 familyId，回傳 false
 */
export function init() {
  if (_initialized) return true;

  const familyId = AppState.getFamilyId();
  if (!familyId) {
    console.warn('[entity-registry] 尚未選擇家庭，略過初始化');
    return false;
  }

  Object.entries(PATHS).forEach(([key, path]) => {
    const r = ref(db, `families/${familyId}/${path}`);
    const sortFn = (key === 'members' || key === 'banks' || key === 'bank_accounts')
      ? byOrderThenCreated
      : byCreatedAt;

    const unsub = onValue(
      r,
      (snap) => {
        const val = snap.val() || {};
        const list = Object.entries(val).map(([id, x]) => ({ id, ...x }));
        list.sort(sortFn);

        _lists[key] = list;

        const map = {};
        list.forEach((x) => { map[x.id] = x.name || ''; });
        _nameMaps[key] = map;
      },
      (err) => {
        console.warn(`[entity-registry] 讀取 ${key} 失敗：`, err);
        _lists[key] = _lists[key] || [];
        _nameMaps[key] = _nameMaps[key] || {};
      }
    );

    _unsubscribers.push(unsub);
  });

  _initialized = true;
  return true;
}

/**
 * 清理所有訂閱與狀態
 */
export function destroy() {
  _unsubscribers.forEach((unsub) => {
    try { unsub(); } catch (e) { /* noop */ }
  });
  _unsubscribers.length = 0;

  Object.keys(_lists).forEach((k) => { delete _lists[k]; });
  Object.keys(_nameMaps).forEach((k) => { delete _nameMaps[k]; });

  _initialized = false;
}

/**
 * 是否已初始化
 */
export function isInitialized() {
  return _initialized;
}

/* ============================================
   5. 查詢 API
   ============================================ */

/**
 * 解析 ID → 名稱
 * @param {'members'|'banks'|'bank_accounts'|'categories'|'items'|'companies'|'payments'} type
 * @param {string} id
 * @param {string} [fallback='']
 * @returns {string}
 */
export function resolveName(type, id, fallback = '') {
  if (!id) return fallback;
  const map = _nameMaps[type];
  if (!map) return fallback;
  return map[id] || fallback;
}

/**
 * 取得列表（回傳複本，避免外部修改）
 * @param {string} type
 * @returns {Array}
 */
export function getList(type) {
  return [...(_lists[type] || [])];
}

/**
 * 取得 { id: name } 映射（回傳複本）
 * @param {string} type
 * @returns {Object}
 */
export function getNameMap(type) {
  return { ...(_nameMaps[type] || {}) };
}

/**
 * 便利函式：解析多個 ID
 * @param {string} type
 * @param {string[]} ids
 * @returns {Object} { id: name }
 */
export function resolveNames(type, ids = []) {
  const result = {};
  ids.forEach((id) => { result[id] = resolveName(type, id, ''); });
  return result;
}

/* ============================================
   6. 便利常數查詢（依 ENTITY_KEYS）
   ============================================ */
export const ENTITY_TYPE_MAP = {
  [ENTITY_KEYS.MEMBER]:   'members',
  [ENTITY_KEYS.BANK]:     'banks',
  [ENTITY_KEYS.CATEGORY]: 'categories',
  [ENTITY_KEYS.ITEM]:     'items',
  [ENTITY_KEYS.PAYMENT]:  'payments',
  [ENTITY_KEYS.STATUS]:   'statuses',   // 注意：statuses 非 name 型實體，但保留對照
  [ENTITY_KEYS.POLICY]:   'members',    // 保單持有人 fallback
  [ENTITY_KEYS.FUND]:     'funds',      // funds 不在此 registry 訂閱（由頁面自行處理）
};

/**
 * 依 ENTITY_KEYS 查名稱
 * @param {string} entityKey - ENTITY_KEYS 之一
 * @param {string} id
 * @param {string} [fallback='']
 */
export function resolveEntityName(entityKey, id, fallback = '') {
  const type = ENTITY_TYPE_MAP[entityKey];
  if (!type) return fallback;
  return resolveName(type, id, fallback);
}
