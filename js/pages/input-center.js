// ============================================
// input-center.js — 綜合輸入中心（v103.0.1 Page Schema）
// 位置：js/pages/input-center.js
// ============================================
import { createPage } from '../engines/page-engine.js';
import { initTabPanel } from '../ui/tab-panel.js';
import { initEntityListPage } from '../shared/entity-list-page.js';
import { AppState } from '../core/state.js';
import { ENTITY_KEYS } from '../config/constants.js';

export default {
  title: '綜合輸入中心',
  data: {},
  state: { activeTab: 'expense' },
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

    const loadTab = async (key) => {
      if (instances[key]) {
        try { instances[key].refresh?.(); } catch (e) { /* noop */ }
        return;
      }
      const tabDef = TABS.find((t) => t.key === key);
      if (!tabDef) return;

      const panelEl = document.getElementById(tabDef.panelId);
      if (!panelEl) {
        console.warn(`[input-center] 找不到面板 #${tabDef.panelId}`);
        return;
      }

      /* 保險 / 基金 / 銀行 → 使用 entity-list-page */
      if (key === 'insurance') {
        instances[key] = initEntityListPage({
          entity: ENTITY_KEYS.POLICY,
          containerId: tabDef.panelId,
          options: { defaultView: 'table', showViewToggle: true, storageKey: 'ic-insurance-view' },
        });
      } else if (key === 'fund') {
        instances[key] = initEntityListPage({
          entity: ENTITY_KEYS.FUND,
          containerId: tabDef.panelId,
          options: { defaultView: 'table', showViewToggle: true, storageKey: 'ic-fund-view' },
        });
      } else if (key === 'bank') {
        instances[key] = initEntityListPage({
          entity: ENTITY_KEYS.BANK,
          containerId: tabDef.panelId,
          options: { defaultView: 'table', showViewToggle: true, storageKey: 'ic-bank-view' },
        });
      } else if (key === 'expense') {
        /* 支出：使用 recent-list 風格骨架（簡易顯示最近支出） */
        panelEl.innerHTML = `
          <div class="banner mb-16">
            ℹ️ 點擊上方按鈕新增支出或家用轉入。以下為最近 20 筆資料。
          </div>
          <div id="ic-recent-list-root"></div>
        `;
        /* 這裡保留佔位，由下方 list-block 動態掛載 */
        instances[key] = { refresh: () => {}, destroy: () => { panelEl.innerHTML = ''; } };
      }
    };

    /* 初始化 Tab 面板 */
    const tabPanel = initTabPanel({
      containerId: 'ic-tab-bar-root',
      tabs: TABS,
      defaultKey: 'expense',
      storageKey: 'input-center-tab',
      onChange: (key) => {
        ctx.state.activeTab = key;
        loadTab(key);
      },
    });

    /* 首次載入預設 Tab */
    loadTab(tabPanel?.getCurrent() || 'expense');

    /* 綁定上方按鈕（新增支出 / 家用轉入 / 個人收入 / 保單 / 基金 / 銀行交易▼） */
    const btnRoot = document.getElementById('ic-buttons-root');
    if (btnRoot) {
      btnRoot.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;
        /* 這裡由使用者自行接上對應 Modal 邏輯，或保留現有邏輯 */
        console.log('[input-center] button action:', action);
      });
    }

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
