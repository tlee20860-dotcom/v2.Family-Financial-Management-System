// ============================================
// registry.js — Registry 統一初始化（v103.0.0）
// 位置：js/lib/registry.js
// ============================================
// 職責：
//   1. 統一初始化所有 Registry（status / entity / label / column）
//   2. 統一銷毀
//   3. 提供初始化狀態查詢
//
// 說明：
//   - status-registry / label-registry / column-registry 為純資料，無需初始化
//   - 僅 entity-registry 需要 Firebase 訂閱
// ============================================

import {
  init as initEntityRegistry,
  destroy as destroyEntityRegistry,
  isInitialized as isEntityRegistryInitialized,
} from '../config/entity-registry.js';

/* ============================================
   Module 狀態
   ============================================ */
let _initialized = false;

/* ============================================
   對外 API
   ============================================ */

/**
 * 初始化所有 Registry
 * - 已初始化 → 回傳 true
 * - 若尚未有 familyId → 回傳 false（可由呼叫端稍後重試）
 *
 * @returns {boolean}
 */
export function initAllRegistries() {
  if (_initialized) return true;

  const ok = initEntityRegistry();
  if (ok) {
    _initialized = true;
    console.log('✅ 所有 Registry 已初始化');
  } else {
    console.warn('[registry] entity-registry 初始化失敗（可能尚未選擇家庭）');
  }

  return ok;
}

/**
 * 銷毀所有 Registry
 */
export function destroyAllRegistries() {
  try {
    destroyEntityRegistry();
  } catch (err) {
    console.warn('[registry] destroy 失敗：', err);
  }
  _initialized = false;
}

/**
 * 查詢是否已初始化
 * @returns {boolean}
 */
export function isAllRegistriesReady() {
  return _initialized && isEntityRegistryInitialized();
}
