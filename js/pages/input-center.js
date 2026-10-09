// ============================================
// input-center.js — 綜合輸入中心（v103.0.0 Page Schema）
// 位置：js/pages/input-center.js
// ============================================
// 合併 v102 的 input-center/index.js + recent-list.js + holdings-list.js
// ============================================
import { createPage } from '../engines/page-engine.js';
import { initTabPanel } from '../ui/tab-panel.js';
import { AppState } from '../core/state.js';
import {
  mount as mountRecentList,
} from '../blocks/list-block.js';

export default {
  title: '綜合輸入中心',

  data: {},

  state: {
    activeTab: 'expense',
  },

  derived: {},

  blocks: [],

  customMount: (ctx) => {
    const TABS = [
      { key: 'expense',   label: '支出', icon: 'receipt',    panelId: 'ic-panel-expense' },
      { key: 'insurance', label: '保險', icon: 'shield',     panelId: 'ic-panel-insurance' },
      { key: 'fund',      label: '基金', icon: 'line-chart', panelId: 'ic-panel-fund' },
      { key: 'bank',      label: '銀行', icon: 'landmark',   panelId: 'ic-panel-bank' },
    ];

    const instances = {};

    const tabPanel = initTabPanel({
      containerId: 'ic-tab-bar-root',
      tabs: TABS,
      defaultKey: 'expense',
      storageKey: 'input-center-tab',
      onChange: async (key) => {
        if (instances[key]) {
          try { instances[key].refresh?.(); } catch (e) { /* noop */ }
          return;
        }
        const panelId = TABS.find((t) => t.key === key).panelId;
        const panelEl = document.getElementById(panelId);
        if (!panelEl) return;

        if (key === 'expense') {
          instances[key] = mountRecentList({ type: 'list', container: panelId, rows: [], columns: 'expenses' }, ctx);
        } else {
          const typeMap = { insurance: 'policy', fund: 'fund', bank: 'bank' };
          const entityMap = { policy: 'policy', fund: 'fund', bank: null };
          const eKey = entityMap[typeMap[key]];
          if (eKey) {
            instances[key] = mountListForEntity(panelId, eKey, ctx);
          }
        }
      },
    });

    return {
      destroy: () => { try { tabPanel?.destroy(); } catch (e) {} },
    };
  },
};

/* ============================================
   List Helper
   ============================================ */
function mountListForEntity(containerId, entityKey, ctx) {
  const container = document.getElementById(containerId);
  if (!container) return { refresh: () => {}, destroy: () => {} };

  container.innerHTML = '<div class="empty-state">載入中…</div>';
  return { refresh: () => {}, destroy: () => { container.innerHTML = ''; } };
}
