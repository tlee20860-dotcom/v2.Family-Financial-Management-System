// ============================================
// sidebar-groups.js — 側邊欄分類群組工具（v101.6）
// 位置：js/shared/sidebar-groups.js
// ============================================
// v101.6 修正：
//   ✅ 移除 getMembersGroup（「成員與收入」群組已廢除）
//   ✅ 移除 hasMembersSub 相關邏輯
//   ✅ SIDEBAR_GROUPS 改由 constants.js 提供（v101.6 新結構）
// ============================================

import { SIDEBAR_GROUPS, STORAGE_KEYS } from '../config/constants.js';

/* ============================================
   查詢工具
   ============================================ */

/**
 * 取得所有群組
 */
export function getAllGroups() {
  return SIDEBAR_GROUPS;
}

/**
 * 依 key 取得群組
 * @param {string} key
 */
export function getGroupByKey(key) {
  return SIDEBAR_GROUPS.find((g) => g.key === key) || null;
}

/**
 * 依 href 取得所屬群組
 * @param {string} href
 */
export function getGroupByHref(href) {
  if (!href) return null;
  return SIDEBAR_GROUPS.find((g) =>
    (g.items || []).some((it) => it.href === href)
  ) || null;
}

/**
 * 依 href 取得群組 key
 * @param {string} href
 */
export function getGroupKeyByHref(href) {
  const g = getGroupByHref(href);
  return g ? g.key : '';
}

/**
 * 攤平所有群組的項目成 href 陣列
 */
export function flattenAllHrefs() {
  const result = [];
  SIDEBAR_GROUPS.forEach((g) => {
    (g.items || []).forEach((it) => {
      if (it.href) result.push(it.href);
    });
  });
  return result;
}

/**
 * 攤平所有群組的項目成 {icon, label, href, groupKey} 陣列
 */
export function flattenAllItems() {
  const result = [];
  SIDEBAR_GROUPS.forEach((g) => {
    (g.items || []).forEach((it) => {
      result.push({ ...it, groupKey: g.key });
    });
  });
  return result;
}

/* ============================================
   展開狀態管理
   ============================================ */

/**
 * 讀取展開的群組 key 集合
 * @returns {Set<string>}
 */
export function loadOpenGroupSet() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SIDEBAR_GROUPS);
    if (!raw) return _getDefaultOpenSet();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return _getDefaultOpenSet();
    return new Set(arr);
  } catch (e) {
    return _getDefaultOpenSet();
  }
}

/**
 * 儲存展開的群組 key 集合
 * @param {Set<string>} set
 */
export function saveOpenGroupSet(set) {
  try {
    localStorage.setItem(STORAGE_KEYS.SIDEBAR_GROUPS, JSON.stringify([...set]));
  } catch (e) {
    // 忽略
  }
}

/**
 * 依 activeHref 自動展開所在群組（加入 set）
 * @param {Set<string>} set
 * @param {string} activeHref
 * @returns {Set<string>}
 */
export function ensureGroupOpenFor(set, activeHref) {
  const g = getGroupByHref(activeHref);
  if (g) set.add(g.key);
  return set;
}

/* ============================================
   內部工具
   ============================================ */
function _getDefaultOpenSet() {
  const set = new Set();
  SIDEBAR_GROUPS.forEach((g) => {
    if (g.defaultOpen) set.add(g.key);
  });
  return set;
}