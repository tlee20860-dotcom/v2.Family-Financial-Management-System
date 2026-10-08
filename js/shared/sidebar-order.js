// ============================================
// sidebar-order.js — 側邊欄排序管理（v101.6.6）
// 位置：js/shared/sidebar-order.js
// ============================================
// v101.6.6 修正：
//   ✅ [BUG-15] ALL_MENU_ITEMS / DEFAULT_ORDER 由 module 常數改為動態 getter
//       - 移除 export const，避免 module 載入時快照
//       - 新增 getAllMenuItems() / getDefaultOrder()
//   ✅ 保留排序邏輯（sortByOrder / moveOrderItem / watchSidebarOrder）
//   ✅ 補齊新選單自動加入機制
// ============================================

import { listenSidebarOrder, saveSidebarOrder } from '../core/db.js';
import { flattenAllItems, flattenAllHrefs } from './sidebar-groups.js';

/* ============================================
   🆕 v101.6.6：動態 getter（取代舊 export const）
   ============================================ */

/**
 * 取得所有可排序的側邊欄選單（攤平自 SIDEBAR_GROUPS）
 * 格式：[{ icon, label, href, groupKey }, ...]
 * @returns {Array}
 */
export function getAllMenuItems() {
  return flattenAllItems();
}

/**
 * 取得預設順序（href 陣列）
 * @returns {string[]}
 */
export function getDefaultOrder() {
  return flattenAllHrefs();
}

/* ============================================
   排序工具
   ============================================ */

/**
 * 依自訂順序排序選單
 * @param {Array} items - 選單項目陣列（含 href）
 * @param {string[]} order - href 順序陣列
 * @returns {Array} 排序後的選單
 */
export function sortByOrder(items, order) {
  if (!order || !Array.isArray(order)) return items;

  const map = new Map();
  order.forEach((href, i) => map.set(href, i));

  return [...items].sort((a, b) => {
    const ia = map.has(a.href) ? map.get(a.href) : 999;
    const ib = map.has(b.href) ? map.get(b.href) : 999;
    return ia - ib;
  });
}

/**
 * 在陣列中移動項目
 * @param {string[]} order - 當前順序
 * @param {string} href - 要移動的項目
 * @param {'up'|'down'} direction
 * @returns {string[]} 新順序（若無法移動則回傳原陣列複本）
 */
export function moveOrderItem(order, href, direction) {
  const arr = [...order];
  const idx = arr.indexOf(href);
  if (idx < 0) return arr;

  const newIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (newIdx < 0 || newIdx >= arr.length) return arr;

  [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
  return arr;
}

/* ============================================
   Firebase 同步
   ============================================ */

/**
 * 監聽側邊欄排序（Firebase 同步）
 * 若從未設定過 → 回傳預設順序
 * 自動補齊未包含的項目（新選單加入時）
 * @param {Function} callback - (order: string[]) => void
 * @returns {Function} unsubscribe
 */
export function watchSidebarOrder(callback) {
  return listenSidebarOrder((order) => {
    // 🆕 v101.6.6：動態取得預設順序
    const defaultOrder = getDefaultOrder();

    if (!order || !Array.isArray(order) || order.length === 0) {
      callback([...defaultOrder]);
      return;
    }

    // 補齊未包含的項目
    const merged = [...order];
    defaultOrder.forEach((href) => {
      if (!merged.includes(href)) merged.push(href);
    });

    // 過濾掉已不存在的項目（選單被移除時）
    const valid = merged.filter((href) => defaultOrder.includes(href));

    callback(valid);
  });
}

/**
 * 儲存排序到 Firebase
 * @param {string[]} order
 */
export async function persistSidebarOrder(order) {
  await saveSidebarOrder(order);
}

/**
 * 重置為預設順序
 */
export async function resetSidebarOrder() {
  await saveSidebarOrder([...getDefaultOrder()]);
}

/* ============================================
   查詢工具
   ============================================ */

/**
 * 取得項目的顯示資訊
 * @param {string} href
 * @returns {Object|null}
 */
export function getMenuItemByHref(href) {
  return getAllMenuItems().find((it) => it.href === href) || null;
}