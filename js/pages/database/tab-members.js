// ============================================
// tab-members.js — 基礎資料庫：成員 Tab（v101.6）
// 位置：js/pages/database/tab-members.js
// ============================================
// v101.6 重寫：
//   ✅ 使用 entity-list-page.js 統一骨架
//   ✅ 所有 CRUD 由 entity-modal 統一處理
//   ✅ 支援表格 / 卡片切換
//   ✅ 支援欄位調整
// ============================================

import { initEntityListPage } from '../../shared/entity-list-page.js';
import { ENTITY_KEYS } from '../../config/constants.js';

/* ============================================
   主入口
   ============================================ */
export function initMembersTab(containerId) {
  return initEntityListPage({
    entity: ENTITY_KEYS.MEMBER,
    containerId,
    options: {
      defaultView: 'table',
      showViewToggle: true,
      showHeader: true,
      storageKey: 'db-members-view',
    },
  });
}