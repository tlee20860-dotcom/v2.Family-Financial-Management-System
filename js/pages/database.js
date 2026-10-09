// ============================================
// database.js — 基礎資料庫（v103.0.3 Page Schema）
// 位置：js/pages/database.js
// ============================================
// v103.0.3 修正：
//   ✅ 6 Tab：成員 / 銀行 / 支出結構 / 支付狀態 / 下拉選項 / 年份範圍
// ============================================

import { initTabPanel } from '../ui/tab-panel.js';
import { initEntityListPage } from '../shared/entity-list-page.js';
import { ENTITY_KEYS } from '../config/constants.js';
import { initDropdownsTab } from './database-dropdowns.js';
import { initYearRangeTab } from './database-yearrange.js';
import { mountOptionsTab } from './database-options.js';

export default {
  title: '基礎資料庫',
  data: {},
  state: { activeTab: 'members' },
  derived: {},
  blocks: [],

  customMount: (ctx) => {
    const TABS = [
      { key: 'members',    label: '成員',      icon: 'users',        panelId: 'db-panel-members' },
      { key: 'banks',      label: '銀行',      icon: 'landmark',     panelId: 'db-panel-banks' },
      { key: 'categories', label: '支出結構',  icon: 'tags',         panelId: 'db-panel-categories' },
      { key: 'options',    label: '支付/狀態', icon: 'credit-card',  panelId: 'db-panel-options' },
      { key: 'dropdowns',  label: '下拉選項',  icon: 'list-ordered', panelId: 'db-panel-dropdowns' },
      { key: 'yearrange',  label: '年份範圍',  icon: 'calendar',     panelId: 'db-panel-yearrange' },
    ];

    const instances = {};

    const loadTab = async (key) => {
      if (instances[key]) {
        try { instances[key].refresh?.(); } catch (e) { /* noop */ }
        return;
      }
      const tabDef = TABS.find((t) => t.key === key);
      if (!tabDef) return;
      const panelId = tabDef.panelId;

      try {
        switch (key) {
          case 'members':
            instances[key] = initEntityListPage({
              entity: ENTITY_KEYS.MEMBER,
              containerId: panelId,
              options: {
                defaultView: 'table',
                showViewToggle: true,
                storageKey: 'db-members-view',
              },
            });
            break;

          case 'banks':
            instances[key] = initEntityListPage({
              entity: ENTITY_KEYS.BANK,
              containerId: panelId,
              options: {
                defaultView: 'table',
                showViewToggle: true,
                storageKey: 'db-banks-view',
              },
            });
            break;

          case 'categories': {
            const root = document.getElementById(panelId);
            if (!root) return;
            root.innerHTML = `
              <div class="grid grid-2" style="gap:16px; align-items:start;">
                <div id="${panelId}-cat-panel"></div>
                <div id="${panelId}-item-panel"></div>
              </div>
            `;
            const catApi = initEntityListPage({
              entity: ENTITY_KEYS.CATEGORY,
              containerId: `${panelId}-cat-panel`,
              options: {
                defaultView: 'table',
                showViewToggle: false,
                storageKey: 'db-categories-view',
              },
            });
            const itemApi = initEntityListPage({
              entity: ENTITY_KEYS.ITEM,
              containerId: `${panelId}-item-panel`,
              options: {
                defaultView: 'table',
                showViewToggle: false,
                storageKey: 'db-items-view',
              },
            });
            instances[key] = {
              refresh: () => {
                catApi?.refresh?.();
                itemApi?.refresh?.();
              },
              destroy: () => {
                catApi?.destroy?.();
                itemApi?.destroy?.();
                root.innerHTML = '';
              },
            };
            break;
          }

          case 'options':
            instances[key] = mountOptionsTab(panelId);
            break;

          case 'dropdowns':
            instances[key] = initDropdownsTab(panelId);
            break;

          case 'yearrange':
            instances[key] = initYearRangeTab(panelId);
            break;
        }
      } catch (err) {
        console.error(`[database] 載入 ${key} 失敗：`, err);
        const panelEl = document.getElementById(panelId);
        if (panelEl) {
          panelEl.innerHTML = `<div class="banner banner-error">載入失敗：${err.message || err}</div>`;
        }
      }
    };

    const tabPanel = initTabPanel({
      containerId: 'db-tab-bar-root',
      tabs: TABS,
      defaultKey: 'members',
      storageKey: 'database-tab',
      wrap: true,
      onChange: (key) => {
        ctx.state.activeTab = key;
        loadTab(key);
      },
    });

    loadTab(tabPanel?.getCurrent() || 'members');

    return {
      destroy: () => {
        Object.values(instances).forEach((inst) => {
          try { inst?.destroy?.(); } catch (e) { /* noop */ }
        });
        try { tabPanel?.destroy(); } catch (e) { /* noop */ }
      },
    };
  },
};