// ============================================
// settings.js — 系統設定（v103.0.11 Page Schema）
// 位置：js/pages/settings.js
// ============================================
// v103.0.11 修正：
//   ✅ 移除未使用的 createPage import
//   ✅ 銀行帳號 Tab 切回時呼叫 refresh()
//   ✅ Tab 順序：平台設定 / 銀行帳號 / 個人化
// ============================================

import { initTabPanel } from '../ui/tab-panel.js';
import { initBankAccountManager } from '../shared/bank-account-manager.js';
import { AppState } from '../core/state.js';

export default {
  title: '系統設定',

  data: {},

  state: {
    activeTab: AppState.isSuperAdmin ? 'platform' : 'banks',
  },

  derived: {},

  blocks: [],

  /* ============================================
     Settings 為複雜頁面，透過 customMount 保留原有邏輯
     ============================================ */
  customMount: (ctx) => {
    const isSuper = AppState.isSuperAdmin;
    const tabs = [];

    if (isSuper) {
      tabs.push({
        key: 'platform',
        label: '平台設定',
        icon: 'settings',
        panelId: 'settings-panel-platform',
      });
    }

    tabs.push({
      key: 'banks',
      label: '銀行帳號',
      icon: 'landmark',
      panelId: 'settings-panel-banks',
    });

    tabs.push({
      key: 'personal',
      label: '個人化',
      icon: 'user',
      panelId: 'settings-panel-personal',
    });

    const tabPanel = initTabPanel({
      containerId: 'settings-tabs',
      tabs,
      defaultKey: isSuper ? 'platform' : 'banks',
      storageKey: 'settings-tab',
      onChange: (key) => {
        // 銀行帳號 Tab：首次載入初始化，之後 refresh
        if (key === 'banks') {
          if (!ctx._bankMgr) {
            ctx._bankMgr = initBankAccountManager('bank-account-manager-root', {
              canInput: AppState.getCanInput(),
            });
          } else {
            try { ctx._bankMgr.refresh?.(); } catch (e) { /* noop */ }
          }
        }
      },
    });

    ctx._bankMgr = null;
    ctx._tabPanel = tabPanel;

    return {
      destroy: () => {
        try { tabPanel?.destroy(); } catch (e) { /* noop */ }
        if (ctx._bankMgr) {
          try { ctx._bankMgr.destroy?.(); } catch (e) { /* noop */ }
          ctx._bankMgr = null;
        }
      },
    };
  },
};