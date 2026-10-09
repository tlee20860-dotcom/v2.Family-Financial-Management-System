// ============================================
// data-engine.js — 資料引擎（v103.0.0）
// 位置：js/engines/data-engine.js
// ============================================
// 職責：
//   1. Firebase 訂閱（含路徑佔位符解析）
//   2. 響應式狀態（Proxy 深層代理）
//   3. 一次性讀取（get）
//   4. 路徑 / 值工具
//
// 設計原則：
//   - 純資料層，不涉及 UI
//   - 訂閱 / 讀取一律走此處，統一錯誤處理
// ============================================

import {
  ref, onValue, get,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { db } from '../config/firebase-config.js';
import { AppState } from '../core/state.js';

/* ============================================
   1. 路徑解析
   ============================================ */

/**
 * 解析路徑為完整 Firebase 路徑
 * - 自動加上 `families/{familyId}/` 前綴
 * - 替換 `{key}` 佔位符（從 params 取值）
 *
 * @param {string} rawPath - 如 'members' / 'expenses/{year}/{month}/member_expenses'
 * @param {Object} [params={}] - 佔位符對應值
 * @returns {string}
 */
export function resolvePath(rawPath, params = {}) {
  const familyId = AppState.getFamilyId();
  if (!familyId) throw new Error('尚未選擇家庭');

  if (!rawPath) throw new Error('路徑為必填');

  const resolved = String(rawPath).replace(/\{(\w+)\}/g, (_, key) => {
    if (params[key] == null || params[key] === '') {
      console.warn(`[data-engine] 路徑佔位符 {${key}} 未提供值`);
      return '';
    }
    return String(params[key]);
  });

  return `families/${familyId}/${resolved}`;
}

/* ============================================
   2. 訂閱
   ============================================ */

/**
 * 訂閱一個 Firebase 路徑
 *
 * @param {Object} cfg
 * @param {string} cfg.path - 相對路徑（可含 {key} 佔位符）
 * @param {'list'|'object'|'value'} [cfg.type='object']
 * @param {Function} [cfg.transform] - (data) => newData
 * @param {Object} [cfg.params={}] - 佔位符對應值
 * @param {Function} callback - ({ type, data, raw, error }) => void
 * @returns {Function} unsubscribe
 */
export function subscribe(cfg, callback) {
  const {
    path,
    type = 'object',
    transform,
    params = {},
  } = cfg || {};

  let resolvedPath;
  try {
    resolvedPath = resolvePath(path, params);
  } catch (err) {
    console.warn('[data-engine] 路徑解析失敗：', err);
    callback({ type, data: type === 'list' ? [] : null, error: err });
    return () => {};
  }

  const r = ref(db, resolvedPath);

  const unsub = onValue(
    r,
    (snap) => {
      let data = snap.val();

      if (type === 'list') {
        data = _toList(data);
      }

      if (typeof transform === 'function') {
        try {
          data = transform(data, snap);
        } catch (err) {
          console.error(`[data-engine] transform 失敗 [${path}]：`, err);
        }
      }

      try {
        callback({ type, data, raw: snap });
      } catch (err) {
        console.error(`[data-engine] callback 失敗 [${path}]：`, err);
      }
    },
    (err) => {
      console.error(`[data-engine] 訂閱失敗 [${resolvedPath}]：`, err);
      callback({ type, data: type === 'list' ? [] : null, error: err });
    }
  );

  return unsub;
}

/* ============================================
   3. 一次性讀取
   ============================================ */

/**
 * 一次性讀取路徑
 *
 * @param {Object} cfg
 * @param {string} cfg.path
 * @param {'list'|'object'|'value'} [cfg.type='object']
 * @param {Function} [cfg.transform]
 * @param {Object} [cfg.params={}]
 * @returns {Promise<*>}
 */
export async function fetchOnce(cfg) {
  const {
    path,
    type = 'object',
    transform,
    params = {},
  } = cfg || {};

  const resolvedPath = resolvePath(path, params);
  const snap = await get(ref(db, resolvedPath));

  let data = snap.val();
  if (type === 'list') {
    data = _toList(data);
  }
  if (typeof transform === 'function') {
    data = transform(data, snap);
  }

  return data;
}

/* ============================================
   4. 響應式物件（Proxy 深層代理）
   ============================================ */

/**
 * 建立響應式物件
 * - 深層代理：任何嵌套屬性變更皆觸發 onChange
 * - 相同值不觸發
 *
 * @param {Object} obj - 初始物件
 * @param {Function} onChange - (keyPath, value, oldValue) => void
 * @param {string} [pathPrefix='']
 * @returns {Proxy}
 */
export function makeReactive(obj, onChange, pathPrefix = '') {
  const handler = {
    set(target, key, value) {
      const keyPath = pathPrefix ? `${pathPrefix}.${key}` : String(key);
      const oldValue = target[key];

      if (oldValue === value) return true;

      // 若新值為物件 → 遞迴代理
      if (value != null && typeof value === 'object' && !Array.isArray(value)) {
        target[key] = _deepProxy(value, onChange, keyPath);
      } else {
        target[key] = value;
      }

      try {
        onChange(keyPath, target[key], oldValue);
      } catch (err) {
        console.error('[data-engine] onChange 失敗：', err);
      }
      return true;
    },

    get(target, key) {
      return target[key];
    },

    deleteProperty(target, key) {
      const keyPath = pathPrefix ? `${pathPrefix}.${key}` : String(key);
      if (!(key in target)) return true;

      const oldValue = target[key];
      delete target[key];

      try {
        onChange(keyPath, undefined, oldValue);
      } catch (err) {
        console.error('[data-engine] onChange 失敗：', err);
      }
      return true;
    },
  };

  return _deepProxy(obj, onChange, pathPrefix, handler);
}

/**
 * 內部：深層代理工具
 */
function _deepProxy(obj, onChange, pathPrefix, customHandler) {
  const handler = customHandler || {
    set(target, key, value) {
      const keyPath = pathPrefix ? `${pathPrefix}.${key}` : String(key);
      const oldValue = target[key];
      if (oldValue === value) return true;

      if (value != null && typeof value === 'object' && !Array.isArray(value)) {
        target[key] = _deepProxy(value, onChange, keyPath);
      } else {
        target[key] = value;
      }

      try { onChange(keyPath, target[key], oldValue); } catch (err) {
        console.error('[data-engine] onChange 失敗：', err);
      }
      return true;
    },
    get(target, key) { return target[key]; },
    deleteProperty(target, key) {
      const keyPath = pathPrefix ? `${pathPrefix}.${key}` : String(key);
      if (!(key in target)) return true;
      const oldValue = target[key];
      delete target[key];
      try { onChange(keyPath, undefined, oldValue); } catch (err) {
        console.error('[data-engine] onChange 失敗：', err);
      }
      return true;
    },
  };

  // 對巢狀物件預先代理
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    Object.keys(obj).forEach((key) => {
      const val = obj[key];
      if (val != null && typeof val === 'object' && !Array.isArray(val)) {
        obj[key] = _deepProxy(val, onChange, pathPrefix ? `${pathPrefix}.${key}` : key);
      }
    });
  }

  return new Proxy(obj, handler);
}

/* ============================================
   5. 工具函式
   ============================================ */

/**
 * 物件 / null → 陣列（含 id）
 */
function _toList(val) {
  if (!val || typeof val !== 'object') return [];
  return Object.entries(val).map(([id, x]) => {
    if (x != null && typeof x === 'object') return { id, ...x };
    return { id, value: x };
  });
}

/**
 * 深層取值（'a.b.c'）
 */
export function getNestedValue(obj, path) {
  if (obj == null || !path) return undefined;
  return String(path).split('.').reduce(
    (acc, key) => (acc == null ? undefined : acc[key]),
    obj
  );
}

/**
 * 深層設值（會觸發 Proxy onChange）
 */
export function setNestedValue(obj, path, value) {
  if (!path) return;
  const keys = String(path).split('.');
  const last = keys.pop();
  const target = keys.reduce((acc, key) => {
    if (acc[key] == null || typeof acc[key] !== 'object') acc[key] = {};
    return acc[key];
  }, obj);
  target[last] = value;
}
