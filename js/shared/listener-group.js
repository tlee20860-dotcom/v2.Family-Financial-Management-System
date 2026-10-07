// ============================================
// listener-group.js — 訂閱管理（v101.6 🆕）
// 位置：js/shared/listener-group.js
// ============================================
// 職責：
//   統一管理 Firebase 訂閱（onValue）
//   集中銷毀，避免記憶體洩漏
//
// 使用方式：
//   const group = createListenerGroup();
//   group.add(listenMembers(cb));
//   group.add(listenBanks(cb));
//   group.destroy();  // 一次清理全部
//
// API 凍結：v101.6 發布後只加不改
// ============================================

/* ============================================
   主函式
   ============================================ */

/**
 * 建立訂閱群組
 * @returns {Object} { add, addAll, remove, count, destroy }
 */
export function createListenerGroup() {
  const _listeners = [];
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
      if (typeof unsubscribe === 'function') {
        _listeners.push(unsubscribe);
      }
      return unsubscribe;
    },

    /**
     * 批次新增訂閱
     * @param {Function[]} unsubscribeList
     */
    addAll(unsubscribeList = []) {
      unsubscribeList.forEach((fn) => this.add(fn));
    },

    /**
     * 移除指定訂閱
     * @param {Function} unsubscribe
     */
    remove(unsubscribe) {
      const idx = _listeners.indexOf(unsubscribe);
      if (idx >= 0) {
        _listeners.splice(idx, 1);
        try { unsubscribe(); } catch (e) { /* noop */ }
      }
    },

    /**
     * 目前訂閱數量
     */
    count() {
      return _listeners.length;
    },

    /**
     * 銷毀所有訂閱
     */
    destroy() {
      if (_destroyed) return;
      _destroyed = true;

      _listeners.forEach((fn) => {
        try { fn(); } catch (e) {
          console.warn('[listener-group] 訂閱取消失敗：', e);
        }
      });
      _listeners.length = 0;
    },
  };
}

/* ============================================
   便利函式
   ============================================ */

/**
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