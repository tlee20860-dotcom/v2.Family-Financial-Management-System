// ============================================
// database-options.js — 支付方式 + 狀態（v103.0.0 Page Schema）
// 位置：js/pages/database-options.js
// ============================================
import { initEntityListPage } from '../shared/entity-list-page.js';
import { ENTITY_KEYS } from '../config/constants.js';

export const TABS = [
  { key: 'payments', label: '支付方式', icon: 'credit-card', entity: ENTITY_KEYS.PAYMENT },
  { key: 'statuses', label: '狀態',     icon: 'tag',         entity: ENTITY_KEYS.STATUS  },
];

export function mountOptionsTab(containerId) {
  const root = document.getElementById(containerId);
  if (!root) return null;

  root.innerHTML = `
    <div class="grid grid-2" style="gap:16px; align-items:start;">
      <div id="${containerId}-pay-panel"></div>
      <div id="${containerId}-status-panel"></div>
    </div>
  `;

  const payApi = initEntityListPage({
    entity: ENTITY_KEYS.PAYMENT,
    containerId: `${containerId}-pay-panel`,
    options: { defaultView: 'table', showViewToggle: false, storageKey: 'db-payments-view' },
  });

  const statusApi = initEntityListPage({
    entity: ENTITY_KEYS.STATUS,
    containerId: `${containerId}-status-panel`,
    options: { defaultView: 'table', showViewToggle: false, storageKey: 'db-statuses-view' },
  });

  return {
    refresh: () => { payApi?.refresh?.(); statusApi?.refresh?.(); },
    destroy: () => { payApi?.destroy?.(); statusApi?.destroy?.(); root.innerHTML = ''; },
  };
}
