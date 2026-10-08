// ============================================
// tab-banks.js — 基礎資料庫：銀行 Tab（v101.6.6）
// 位置：js/pages/database/tab-banks.js
// ============================================
// v101.6.6 修正：
//   ✅ [BUG-06] 改用 entity-list-page.js 統一骨架（符合防呆 #71 / #72）
//   ✅ 支援表格欄位可調整
//   ✅ 支援卡片 / 表格模式切換
// ============================================

import { initEntityListPage } from '../../shared/entity-list-page.js';
import { ENTITY_KEYS } from '../../config/constants.js';

/* ============================================
   主入口
   ============================================ */
export function initBanksTab(containerId) {
  return initEntityListPage({
    entity: ENTITY_KEYS.BANK,
    containerId,
    options: {
      defaultView: 'table',
      showViewToggle: true,
      showHeader: true,
      storageKey: 'db-banks-view',
    },
  });
}