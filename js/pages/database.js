// ============================================
// database.js — 基礎資料庫（v103.0.0 Page Schema）
// 位置：js/pages/database.js
// ============================================
// 合併 v102 的 database/index.js + 6 個 tab 檔案
// ============================================
import { createPage } from '../engines/page-engine.js';
import { initTabPanel } from '../ui/tab-panel.js';
import { initEntityListPage } from '../shared/entity-list-page.js';
import { ENTITY_KEYS } from '../config/constants.js';

export default {
  title: '基礎資料庫',

  data: {},
  state: { activeTab: 'members' },
  derived: {},
  blocks: [],

  customMount: (ctx) => {
    const TABS = [
      { key: 'members',    label: '成員',     icon: 'users',        panelId: 'db-panel-members' },
      { key: 'banks',      label: '銀行',     icon: 'landmark',     panelId: 'db-panel-banks' },
      { key: 'categories', label: '支出結構', icon: 'tags',         panelId: 'db-panel-categories' },
      { key: 'options',    label: '支付/狀態',icon: 'credit-card',  panelId: 'db-panel-options' },
      { key: 'dropdowns',  label: '下拉選項', icon: 'list-ordered', panelId: 'db-panel-dropdowns' },
      { key: 'yearrange',  label: '年份範圍', icon: 'calendar',     panelId: 'db-panel-yearrange' },
    ];

    const instances = {};

    const loadTab = async (key) => {
      if (instances[key]) {
        try { instances[key].refresh?.(); } catch (e) { /* noop */ }
        return;
      }
      const panelId = TABS.find((t) => t.key === key).panelId;
      if (key === 'members') {
        instances[key] = initEntityListPage({ entity: ENTITY_KEYS.MEMBER, containerId: panelId, options: { defaultView: 'table', showViewToggle: true, storageKey: 'db-members-view' } });
      } else if (key === 'banks') {
        instances[key] = initEntityListPage({ entity: ENTITY_KEYS.BANK, containerId: panelId, options: { defaultView: 'table', showViewToggle: true, storageKey: 'db-banks-view' } });
      }
      /* categories / options / dropdowns / yearrange 由既有 shared 模組處理 */
    };

    const tabPanel = initTabPanel({
      containerId: 'db-tab-bar-root',
      tabs: TABS,
      defaultKey: 'members',
      storageKey: 'database-tab',
      wrap: true,
      onChange: (key) => { loadTab(key); },
    });

    return {
      destroy: () => {
        Object.values(instances).forEach((i) => { try { i?.destroy?.(); } catch (e) {} });
        try { tabPanel?.destroy(); } catch (e) {}
      },
    };
  },
};
