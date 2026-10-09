// ============================================
// lifecycle.js — 生命週期清理註冊器（v103.0.0）
// 位置：js/lib/lifecycle.js
// ============================================
// 職責：
//   1. 統一管理「需要清理的資源」
//   2. 集中一次性銷毀（避免記憶體洩漏）
//   3. 支援 add / addAll / run
//
// 使用場景：
//   - Firebase onValue 監聽
//   - addEventListener 監聽
//   - setInterval / setTimeout
//   - 任何需要 destroy 的物件
// ============================================

/**
 * 建立清理註冊器
 *
 * @returns {{
 *   add: (fn: Function) => Function,
 *   addAll: (fns: Function[]) => void,
 *   remove: (fn: Function) => void,
 *   size: () => number,
 *   run: () => void,
 *   isDestroyed: () => boolean,
 * }}
 */
export function createCleanupRegistry() {
  const _items = [];
  let _destroyed = false;

  return {
    /**
     * 新增清理函式
     * @param {Function} fn
     * @returns {Function} 原 fn（方便鏈式）
     */
    add(fn) {
      if (_destroyed) {
        console.warn('[lifecycle] 註冊器已銷毀，忽略新增');
        return fn;
      }
      if (typeof fn === 'function') _items.push(fn);
      return fn;
    },

    /**
     * 批次新增
     * @param {Function[]} fns
     */
    addAll(fns = []) {
      if (_destroyed) return;
      fns.forEach((fn) => {
        if (typeof fn === 'function') _items.push(fn);
      });
    },

    /**
     * 移除指定清理函式（不執行）
     * @param {Function} fn
     */
    remove(fn) {
      const idx = _items.indexOf(fn);
      if (idx >= 0) _items.splice(idx, 1);
    },

    /**
     * 目前待清理數量
     * @returns {number}
     */
    size() {
      return _items.length;
    },

    /**
     * 執行所有清理函式（僅一次）
     * - 個別失敗不影響其他
     * - 執行後清空
     */
    run() {
      if (_destroyed) return;
      _destroyed = true;

      const snapshot = _items.slice();
      _items.length = 0;

      snapshot.forEach((fn) => {
        try {
          fn();
        } catch (err) {
          console.warn('[lifecycle] 清理函式失敗：', err);
        }
      });
    },

    /**
     * 是否已銷毀
     * @returns {boolean}
     */
    isDestroyed() {
      return _destroyed;
    },
  };
}
