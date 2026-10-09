// ============================================
// status-registry.js — 狀態系統 SSOT（v103.0.0）
// 位置：js/config/status-registry.js
// ============================================
// 職責：
//   1. 定義標準狀態代碼（pending / done / skipped）
//   2. 讀取時將舊名稱正規化為新代碼（normalize）
//   3. 依來源提供顯示文字（label / options）
//   4. 提供 isDone / badgeClass 判定
//
// 設計原則：
//   - 全站狀態知識只存在此處
//   - 讀取時 normalize，寫入時直接寫新代碼
//   - 舊資料 100% 相容（LEGACY_MAP）
// ============================================

/* ============================================
   1. 標準狀態代碼
   ============================================ */
export const STATUS = {
  PENDING: 'pending',
  DONE:    'done',
  SKIPPED: 'skipped',
};

/* ============================================
   2. isDone 判定表
   ============================================ */
export const IS_DONE = {
  [STATUS.PENDING]: false,
  [STATUS.DONE]:    true,
  [STATUS.SKIPPED]: true,
};

/* ============================================
   3. 顯示文字（依來源）
   -------------------------------------------------
   - default：未指定來源時的通用文字
   - bySource：指定來源時的專屬文字
   ============================================ */
export const LABELS = {
  default: {
    [STATUS.PENDING]: '未處理',
    [STATUS.DONE]:    '已處理',
    [STATUS.SKIPPED]: '不適用',
  },
  bySource: {
    personal: {
      [STATUS.PENDING]: '未付款',
      [STATUS.DONE]:    '已付款',
      [STATUS.SKIPPED]: '不適用',
    },
    fixed: {
      [STATUS.PENDING]: '未付款',
      [STATUS.DONE]:    '已付款',
      [STATUS.SKIPPED]: '不適用',
    },
    insurance: {
      [STATUS.PENDING]: '未扣款',
      [STATUS.DONE]:    '已扣款',
      [STATUS.SKIPPED]: '不適用',
    },
    income: {
      [STATUS.PENDING]: '未轉入',
      [STATUS.DONE]:    '已轉入',
      [STATUS.SKIPPED]: '不適用',
    },
  },
};

/* ============================================
   4. 舊名稱 → 新代碼（相容層）
   -------------------------------------------------
   涵蓋 v102 之前所有曾出現過的狀態名稱
   ============================================ */
export const LEGACY_MAP = {
  // pending 類
  '未處理': STATUS.PENDING,
  '未還款': STATUS.PENDING,
  '未付款': STATUS.PENDING,
  '未扣款': STATUS.PENDING,
  '未轉入': STATUS.PENDING,

  // done 類
  '已處理': STATUS.DONE,
  '已還款': STATUS.DONE,
  '已付款': STATUS.DONE,
  '已扣款': STATUS.DONE,
  '已轉入': STATUS.DONE,

  // skipped 類
  '不適用': STATUS.SKIPPED,
};

/* ============================================
   5. 反查：新代碼 → 舊名稱（依來源）
   -------------------------------------------------
   供舊資料寫入 / 相容 API 使用（如 summary.js 仍讀 '已扣款'）
   ============================================ */
export const LABELS_BY_SOURCE = {
  personal:  { [STATUS.PENDING]: '未處理', [STATUS.DONE]: '已處理', [STATUS.SKIPPED]: '不適用' },
  fixed:     { [STATUS.PENDING]: '未付款', [STATUS.DONE]: '已付款', [STATUS.SKIPPED]: '不適用' },
  insurance: { [STATUS.PENDING]: '未扣款', [STATUS.DONE]: '已扣款', [STATUS.SKIPPED]: '不適用' },
  income:    { [STATUS.PENDING]: '未轉入', [STATUS.DONE]: '已轉入', [STATUS.SKIPPED]: '不適用' },
};

/* ============================================
   6. badge class 對照
   ============================================ */
export const BADGE_CLASS = {
  [STATUS.PENDING]: 'badge-pending',
  [STATUS.DONE]:    'badge-success',
  [STATUS.SKIPPED]: 'badge-muted',
};

/* ============================================
   7. 對外 API
   ============================================ */

/**
 * 正規化任意輸入為標準代碼
 * - 若已是新代碼 → 直接回傳
 * - 若為舊名稱 → 依 LEGACY_MAP 轉換
 * - 若為空 / 未知 → 回傳 pending
 *
 * @param {string} raw
 * @returns {'pending'|'done'|'skipped'}
 */
export function normalize(raw) {
  if (raw == null || raw === '') return STATUS.PENDING;

  // 已是新代碼
  if (raw === STATUS.PENDING || raw === STATUS.DONE || raw === STATUS.SKIPPED) {
    return raw;
  }

  // 舊名稱映射
  return LEGACY_MAP[raw] || STATUS.PENDING;
}

/**
 * 是否為「完成」狀態（含 skipped）
 * @param {string} raw
 * @returns {boolean}
 */
export function isDone(raw) {
  const code = normalize(raw);
  return !!IS_DONE[code];
}

/**
 * 取得顯示文字
 * @param {string} raw - 狀態（新代碼或舊名稱）
 * @param {Object} [opts]
 * @param {'personal'|'fixed'|'insurance'|'income'} [opts.source] - 來源
 * @returns {string}
 */
export function label(raw, opts = {}) {
  const code = normalize(raw);
  const source = opts.source;

  if (source && LABELS.bySource[source] && LABELS.bySource[source][code]) {
    return LABELS.bySource[source][code];
  }
  return LABELS.default[code] || LABELS.default[STATUS.PENDING];
}

/**
 * 取得下拉選項
 * @param {Object} [opts]
 * @param {'personal'|'fixed'|'insurance'|'income'} [opts.source]
 * @param {boolean} [opts.includeSkipped=false] - 是否包含 skipped
 * @returns {Array<{value: string, label: string}>}
 */
export function options(opts = {}) {
  const codes = [STATUS.PENDING, STATUS.DONE];
  if (opts.includeSkipped) codes.push(STATUS.SKIPPED);

  return codes.map((code) => ({
    value: code,
    label: label(code, { source: opts.source }),
  }));
}

/**
 * 取得 badge class
 * @param {string} raw
 * @returns {string}
 */
export function badgeClass(raw) {
  const code = normalize(raw);
  return BADGE_CLASS[code] || BADGE_CLASS[STATUS.PENDING];
}

/**
 * 新代碼 → 舊名稱（依來源）
 * 供需要寫入舊格式的相容 API 使用
 *
 * @param {string} code
 * @param {string} source
 * @returns {string}
 */
export function toLegacyName(code, source = 'personal') {
  const normalized = normalize(code);
  const map = LABELS_BY_SOURCE[source] || LABELS_BY_SOURCE.personal;
  return map[normalized] || map[STATUS.PENDING];
}

/**
 * 便利判斷：是否為待處理
 */
export function isPending(raw) {
  return normalize(raw) === STATUS.PENDING;
}

/**
 * 便利判斷：是否為已跳過
 */
export function isSkipped(raw) {
  return normalize(raw) === STATUS.SKIPPED;
}
