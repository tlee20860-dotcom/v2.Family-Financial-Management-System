// ============================================
// listener-group.js — 訂閱管理（v103.0.11）
// 位置：js/shared/listener-group.js
// ============================================
// v103.0.11 重構：
//   ✅ [H06] 標記 @deprecated，內部實作改走 lib/lifecycle.js
//   ✅ 對外 API 保持 100% 相容（add / addAll / remove / count / destroy）
//   ✅ 未來版本將完全移除，呼叫端請改用 lib/lifecycle.js
// ============================================

import { createCleanupRegistry } from '../lib/lifecycle.js';

/* ============================================
   主函式（相容層）
   ============================================ */

/**
 * @deprecated v103.0.11 — 請改用 `lib/lifecycle.js` 的 `createCleanupRegistry`
 *
 * 建立訂閱群組
 * @returns {Object} { add, addAll, remove, count, destroy }
 */
export function createListenerGroup() {
  const registry = createCleanupRegistry();
  let _destroyed = false;

  return {
    /**
     * 新增一個訂閱
     * @param {Function} unsubscribe - onValue 回傳的取消函式
     * @returns {Function} 該訂閱的取消函式
     */
    add(unsubscribe) {
      if (_destroyed) {
        console.warn('[listener-group] 群組已銷毀，忽略新增訂閱');
        return () => {};
      }
      registry.add(unsubscribe);
      return unsubscribe;
    },

    /**
     * 批次新增訂閱
     * @param {Function[]} unsubscribeList
     */
    addAll(unsubscribeList = []) {
      if (_destroyed) return;
      registry.addAll(unsubscribeList);
    },

    /**
     * 移除指定訂閱（不執行，只移除）
     * @param {Function} unsubscribe
     */
    remove(unsubscribe) {
      registry.remove(unsubscribe);
    },

    /**
     * 目前訂閱數量
     */
    count() {
      return registry.size();
    },

    /**
     * 銷毀所有訂閱（執行每個 unsubscribe）
     */
    destroy() {
      if (_destroyed) return;
      _destroyed = true;
      registry.run();
    },
  };
}

/* ============================================
   便利函式
   ============================================ */

/**
 * @deprecated v103.0.11 — 請改用 `createCleanupRegistry()` + 手動包裝 onDestroy
 *
 * 建立「自動銷毀」的訂閱群組（用於頁面）
 * @param {Function} onDestroy - 額外清理回呼（選填）
 * @returns {Object}
 */
export function createPageListenerGroup(onDestroy) {
  const group = createListenerGroup();
  const originalDestroy = group.destroy;

  group.destroy = () => {
    originalDestroy();
    if (typeof onDestroy === 'function') {
      try { onDestroy(); } catch (e) {
        console.warn('[listener-group] onDestroy 失敗：', e);
      }
    }
  };

  return group;
}