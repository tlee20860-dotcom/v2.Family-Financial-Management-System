// ============================================
// app-config.js — 平台預設 + 家庭覆蓋設定載入
// 位置：js/config/app-config.js
// ============================================
// 讀取順序（優先級）：
//   1. families/{UID}/settings/* （家庭覆蓋）
//   2. platform/defaults/*       （平台預設）
//   3. constants.js              （硬編碼 fallback）
// ============================================

import { db } from './firebase-config.js';
import { ref, get, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import {
  DEFAULT_STATUSES,
  DEFAULT_OPTIONS,
  DEFAULT_YEAR_RANGE,
  DEFAULT_UI_CONSTANTS,
  LIMITS,
} from './constants.js';

/* ============================================
   內部狀態
   ============================================ */
let _familyId = '';
let _merged = null;
let _listeners = [];
let _unsubscribers = [];

let _platformDefaults = {
  statuses: null,
  options: null,
  yearRange: null,
  uiConstants: null,
};

let _familyOverrides = {
  statuses: null,
  options: null,
  yearRange: null,
  uiConstants: null,
};

/* ============================================
   初始化 / 銷毀
   ============================================ */

/**
 * 初始化 app-config
 * @param {string} familyId - 當前家庭 UID（空字串代表尚未選擇家庭）
 */
export async function initAppConfig(familyId = '') {
  _familyId = familyId || '';

  // 載入平台預設
  const [pStatuses, pOptions, pYearRange, pUI] = await Promise.all([
    _get('platform/defaults/statuses'),
    _get('platform/defaults/options'),
    _get('platform/defaults/year_range'),
    _get('platform/defaults/ui_constants'),
  ]);

  _platformDefaults = {
    statuses: pStatuses,
    options: pOptions,
    yearRange: pYearRange,
    uiConstants: pUI,
  };

  // 載入家庭覆蓋
  if (_familyId) {
    const [fStatuses, fOptions, fYearRange, fUI] = await Promise.all([
      _get(`families/${_familyId}/statuses`),
      _get(`families/${_familyId}/settings/options`),
      _get(`families/${_familyId}/settings/year_range`),
      _get(`families/${_familyId}/settings/ui_constants`),
    ]);

    _familyOverrides = {
      statuses: fStatuses,
      options: fOptions,
      yearRange: fYearRange,
      uiConstants: fUI,
    };
  } else {
    _familyOverrides = {
      statuses: null, options: null, yearRange: null, uiConstants: null,
    };
  }

  _merged = _mergeAll();
  _notifyAll();
  return _merged;
}

/**
 * 監聽平台預設變更（superadmin 修改時即時同步）
 */
export function watchPlatformDefaults() {
  const paths = [
    ['statuses',    'platform/defaults/statuses'],
    ['options',     'platform/defaults/options'],
    ['yearRange',   'platform/defaults/year_range'],
    ['uiConstants', 'platform/defaults/ui_constants'],
  ];

  paths.forEach(([key, path]) => {
    const unsub = onValue(ref(db, path), (snap) => {
      _platformDefaults[key] = snap.val();
      _merged = _mergeAll();
      _notifyAll();
    });
    _unsubscribers.push(unsub);
  });
}

/**
 * 監聽家庭設定變更
 */
export function watchFamilySettings() {
  if (!_familyId) return;

  const paths = [
    ['statuses',    `families/${_familyId}/statuses`],
    ['options',     `families/${_familyId}/settings/options`],
    ['yearRange',   `families/${_familyId}/settings/year_range`],
    ['uiConstants', `families/${_familyId}/settings/ui_constants`],
  ];

  paths.forEach(([key, path]) => {
    const unsub = onValue(ref(db, path), (snap) => {
      _familyOverrides[key] = snap.val();
      _merged = _mergeAll();
      _notifyAll();
    });
    _unsubscribers.push(unsub);
  });
}

/**
 * 銷毀所有監聽
 */
export function disposeAppConfig() {
  _unsubscribers.forEach((fn) => { try { fn(); } catch (e) { /* noop */ } });
  _unsubscribers = [];
  _listeners = [];
  _familyId = '';
  _merged = null;
}

/* ============================================
   對外查詢
   ============================================ */

/**
 * 取得所有狀態（依 order 排序）
 */
export function getStatuses() {
  const raw = _merged?.statuses || _toObject(DEFAULT_STATUSES);
  return Object.entries(raw)
    .map(([id, s]) => ({ id, ...s }))
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

/**
 * 依類別取得狀態
 * @param {'personal'|'fixed'|'insurance'} category
 */
export function getStatusesByCategory(category) {
  return getStatuses().filter((s) => s.category === category);
}

/**
 * 取得該類別的預設狀態（isDone = false 的第一個，或清單第一個）
 */
export function getDefaultStatus(category) {
  const list = getStatusesByCategory(category);
  return list.find((s) => !s.isDone) || list[0] || null;
}

/**
 * 依中文名稱查詢狀態（用於舊資料相容）
 */
export function findStatusByName(name) {
  return getStatuses().find((s) => s.name === name) || null;
}

/**
 * 判斷是否為「已完成」狀態（依名稱）
 */
export function isDoneStatus(name) {
  const s = findStatusByName(name);
  return s ? !!s.isDone : false;
}

/**
 * 取得下拉選項
 * @param {'memberRoles'|'cycles'|'policyTypes'|'insurancePaymentTypes'|'categoryOrder'} key
 */
export function getOptions(key) {
  const opts = _merged?.options || DEFAULT_OPTIONS;
  return opts[key] || DEFAULT_OPTIONS[key] || [];
}

/**
 * 取得年份範圍（考慮當前年）
 */
export function getYearRange() {
  const cfg = _merged?.yearRange || DEFAULT_YEAR_RANGE;
  const curY = new Date().getFullYear();

  let startYear;
  if (cfg.startYear != null && cfg.startYear !== '') {
    startYear = Math.min(Number(cfg.startYear), curY - LIMITS.YEAR_PAST_DEFAULT);
  } else {
    startYear = curY - LIMITS.YEAR_PAST_DEFAULT;
  }
  const futureYears = Number(cfg.futureYears) || LIMITS.YEAR_FUTURE_DEFAULT;

  return { startYear, endYear: curY + futureYears };
}

/**
 * 產生年份陣列
 */
export function getYearList() {
  const { startYear, endYear } = getYearRange();
  const list = [];
  for (let y = startYear; y <= endYear; y++) list.push(y);
  return list;
}

/**
 * 取得 UI 常數
 */
export function getUIConstants() {
  const cfg = _merged?.uiConstants || DEFAULT_UI_CONSTANTS;
  return {
    nameMaxLenDesktop: Number(cfg.nameMaxLenDesktop) || LIMITS.NAME_MAX_LEN_DESKTOP,
    nameMaxLenMobile: Number(cfg.nameMaxLenMobile) || LIMITS.NAME_MAX_LEN_MOBILE,
    toastDuration: Number(cfg.toastDuration) || LIMITS.TOAST_DURATION_DEFAULT,
  };
}

/**
 * 訂閱設定變更
 * @param {Function} callback - (config) => void
 * @returns {Function} 取消訂閱函式
 */
export function onConfigChange(callback) {
  _listeners.push(callback);
  // 立即回呼一次
  try { callback(_merged); } catch (e) { console.error('[app-config] listener error:', e); }
  return () => {
    _listeners = _listeners.filter((cb) => cb !== callback);
  };
}

/* ============================================
   內部工具
   ============================================ */

async function _get(path) {
  try {
    const snap = await get(ref(db, path));
    return snap.val();
  } catch (err) {
    console.warn(`[app-config] 讀取失敗 ${path}：`, err);
    return null;
  }
}

function _toObject(arr) {
  const obj = {};
  arr.forEach((item, i) => {
    obj[item.key || `default_${i}`] = { ...item };
  });
  return obj;
}

function _mergeAll() {
  return {
    statuses: _familyOverrides.statuses || _platformDefaults.statuses || _toObject(DEFAULT_STATUSES),
    options: _familyOverrides.options || _platformDefaults.options || DEFAULT_OPTIONS,
    yearRange: _familyOverrides.yearRange || _platformDefaults.yearRange || DEFAULT_YEAR_RANGE,
    uiConstants: _familyOverrides.uiConstants || _platformDefaults.uiConstants || DEFAULT_UI_CONSTANTS,
  };
}

function _notifyAll() {
  _listeners.forEach((cb) => {
    try { cb(_merged); } catch (e) { console.error('[app-config] listener error:', e); }
  });
}