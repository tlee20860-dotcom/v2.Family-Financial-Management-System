// ============================================
// app-config.js — 平台預設 + 家庭覆蓋設定載入（v101.5）
// 位置：js/config/app-config.js
// ============================================
// v101.5 修正：
//   ✅ 新增 disposeAppConfig（供 app.js 的 destroyApp 呼叫）
//   ✅ 修正 _mergeAll 為「逐鍵深層合併」（家庭覆蓋優先）
//   ✅ 修正監聽重複註冊問題（先 dispose 再 watch）
//   ✅ 新增 getOptionsRaw（供 entity-helpers 使用）
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
 * @param {string} familyId
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
 * 監聽平台預設變更
 * 🆕 v101.5：先清空舊監聽，避免重複註冊
 */
export function watchPlatformDefaults() {
  // 清空舊的 platform 監聽（只清 platform 部分）
  _unsubscribers = _unsubscribers.filter((entry) => {
    if (entry.scope === 'platform') {
      try { entry.unsub(); } catch (e) { /* noop */ }
      return false;
    }
    return true;
  });

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
    _unsubscribers.push({ scope: 'platform', unsub });
  });
}

/**
 * 監聽家庭設定變更
 * 🆕 v101.5：先清空舊監聽，避免重複註冊
 */
export function watchFamilySettings() {
  if (!_familyId) return;

  // 清空舊的 family 監聽
  _unsubscribers = _unsubscribers.filter((entry) => {
    if (entry.scope === 'family') {
      try { entry.unsub(); } catch (e) { /* noop */ }
      return false;
    }
    return true;
  });

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
    _unsubscribers.push({ scope: 'family', unsub });
  });
}

/**
 * 銷毀所有監聽
 */
export function disposeAppConfig() {
  _unsubscribers.forEach((entry) => {
    try { entry.unsub(); } catch (e) { /* noop */ }
  });
  _unsubscribers = [];
  _listeners = [];
  _familyId = '';
  _merged = null;
}

/* ============================================
   對外查詢
   ============================================ */

export function getStatuses() {
  const raw = _merged?.statuses || _toObject(DEFAULT_STATUSES);
  return Object.entries(raw)
    .map(([id, s]) => ({ id, ...s }))
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

export function getStatusesByCategory(category) {
  return getStatuses().filter((s) => s.category === category);
}

export function getDefaultStatus(category) {
  const list = getStatusesByCategory(category);
  return list.find((s) => !s.isDone) || list[0] || null;
}

export function findStatusByName(name) {
  return getStatuses().find((s) => s.name === name) || null;
}

export function isDoneStatus(name) {
  const s = findStatusByName(name);
  return s ? !!s.isDone : false;
}

/**
 * 取得下拉選項
 * @param {string} key
 */
export function getOptions(key) {
  const opts = _merged?.options || DEFAULT_OPTIONS;
  return opts[key] || DEFAULT_OPTIONS[key] || [];
}

/**
 * 🆕 v101.5：取得完整 options 物件（供 entity-helpers 使用）
 */
export function getOptionsRaw() {
  return _merged?.options || DEFAULT_OPTIONS;
}

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

export function getYearList() {
  const { startYear, endYear } = getYearRange();
  const list = [];
  for (let y = startYear; y <= endYear; y++) list.push(y);
  return list;
}

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
 */
export function onConfigChange(callback) {
  _listeners.push(callback);
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

/**
 * 🆕 v101.5：逐鍵深層合併
 * - statuses: 家庭完整覆蓋（因為是清單，逐項合併會混亂）
 * - options: 逐鍵合併（家庭只覆蓋有定義的鍵）
 * - yearRange: 逐鍵合併
 * - uiConstants: 逐鍵合併
 */
function _mergeAll() {
  return {
    statuses: _familyOverrides.statuses || _platformDefaults.statuses || _toObject(DEFAULT_STATUSES),
    options: _mergeOptions(_familyOverrides.options, _platformDefaults.options),
    yearRange: _mergeObject(_familyOverrides.yearRange, _platformDefaults.yearRange, DEFAULT_YEAR_RANGE),
    uiConstants: _mergeObject(_familyOverrides.uiConstants, _platformDefaults.uiConstants, DEFAULT_UI_CONSTANTS),
  };
}

/**
 * options 逐鍵合併（家庭只覆蓋有定義的鍵）
 */
function _mergeOptions(familyOpts, platformOpts) {
  const base = platformOpts || DEFAULT_OPTIONS;
  if (!familyOpts || typeof familyOpts !== 'object') return base;

  const merged = { ...base };
  Object.entries(familyOpts).forEach(([key, val]) => {
    if (val != null) merged[key] = val;
  });
  return merged;
}

/**
 * 通用物件逐鍵合併
 */
function _mergeObject(familyObj, platformObj, fallback) {
  const base = platformObj || fallback;
  if (!familyObj || typeof familyObj !== 'object') return base;
  return { ...base, ...familyObj };
}

function _notifyAll() {
  _listeners.forEach((cb) => {
    try { cb(_merged); } catch (e) { console.error('[app-config] listener error:', e); }
  });
}