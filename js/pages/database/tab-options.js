// ============================================
// tab-options.js — 基礎資料庫：支付 / 狀態 Tab（v101.6）
// 位置：js/pages/database/tab-options.js
// ============================================
// v101.6 重寫：
//   ✅ 使用 entity-list-page.js 統一骨架
//   ✅ 左右並排：支付方式 + 狀態
//   ✅ 兩個子面板各自獨立管理
// ============================================

import { initEntityListPage } from '../../shared/entity-list-page.js';
import { ENTITY_KEYS } from '../../config/constants.js';

/* ============================================
   Module 狀態
   ============================================ */
let _paymentsInstance = null;
let _statusesInstance = null;

/* ============================================
   主入口
   ============================================ */
export function initOptionsTab(containerId) {
  const root = document.getElementById(containerId);
  if (!root) {
    console.warn(`⚠️ initOptionsTab: 找不到容器 #${containerId}`);
    return null;
  }

  root.innerHTML = `
    <div class="grid grid-2" style="gap:16px; align-items:start;">
      <div id="${containerId}-pay-panel"></div>
      <div id="${containerId}-status-panel"></div>
    </div>
  `;

  // 左：支付方式
  _paymentsInstance = initEntityListPage({
    entity: ENTITY_KEYS.PAYMENT,
    containerId: `${containerId}-pay-panel`,
    options: {
      defaultView: 'table',
      showViewToggle: false,
      showHeader: true,
      storageKey: 'db-payments-view',
    },
  });

  // 右：狀態
  _statusesInstance = initEntityListPage({
    entity: ENTITY_KEYS.STATUS,
    containerId: `${containerId}-status-panel`,
    options: {
      defaultView: 'table',
      showViewToggle: false,
      showHeader: true,
      storageKey: 'db-statuses-view',
    },
  });

  return {
    refresh: () => {
      try { _paymentsInstance?.refresh(); } catch (e) { /* noop */ }
      try { _statusesInstance?.refresh(); } catch (e) { /* noop */ }
    },
    destroy: () => {
      try { _paymentsInstance?.destroy(); } catch (e) { /* noop */ }
      try { _statusesInstance?.destroy(); } catch (e) { /* noop */ }
      _paymentsInstance = null;
      _statusesInstance = null;
      root.innerHTML = '';
    },
  };
}