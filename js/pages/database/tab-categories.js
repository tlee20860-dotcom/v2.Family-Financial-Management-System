// ============================================
// tab-categories.js — 基礎資料庫：支出結構 Tab（v101.6）
// 位置：js/pages/database/tab-categories.js
// ============================================
// v101.6 重寫：
//   ✅ 使用 entity-list-page.js 統一骨架
//   ✅ 左右並排：類別 + 項目
//   ✅ 兩個子面板各自獨立管理
// ============================================

import { initEntityListPage } from '../../shared/entity-list-page.js';
import { ENTITY_KEYS } from '../../config/constants.js';

/* ============================================
   Module 狀態
   ============================================ */
let _categoriesInstance = null;
let _itemsInstance = null;

/* ============================================
   主入口
   ============================================ */
export function initCategoriesTab(containerId) {
  const root = document.getElementById(containerId);
  if (!root) {
    console.warn(`⚠️ initCategoriesTab: 找不到容器 #${containerId}`);
    return null;
  }

  root.innerHTML = `
    <div class="grid grid-2" style="gap:16px; align-items:start;">
      <div id="${containerId}-cat-panel"></div>
      <div id="${containerId}-item-panel"></div>
    </div>
  `;

  // 左：支出類別
  _categoriesInstance = initEntityListPage({
    entity: ENTITY_KEYS.CATEGORY,
    containerId: `${containerId}-cat-panel`,
    options: {
      defaultView: 'table',
      showViewToggle: false,
      showHeader: true,
      storageKey: 'db-categories-view',
    },
  });

  // 右：支出項目
  _itemsInstance = initEntityListPage({
    entity: ENTITY_KEYS.ITEM,
    containerId: `${containerId}-item-panel`,
    options: {
      defaultView: 'table',
      showViewToggle: false,
      showHeader: true,
      storageKey: 'db-items-view',
    },
    hooks: {
      onBeforeAdd: () => {
        // 若類別只有 1 個，自動帶入
        const categories = _categoriesInstance?.getRows() || [];
        if (categories.length === 1) {
          return { categoryId: categories[0].id };
        }
        return undefined;
      },
    },
  });

  return {
    refresh: () => {
      try { _categoriesInstance?.refresh(); } catch (e) { /* noop */ }
      try { _itemsInstance?.refresh(); } catch (e) { /* noop */ }
    },
    destroy: () => {
      try { _categoriesInstance?.destroy(); } catch (e) { /* noop */ }
      try { _itemsInstance?.destroy(); } catch (e) { /* noop */ }
      _categoriesInstance = null;
      _itemsInstance = null;
      root.innerHTML = '';
    },
  };
}