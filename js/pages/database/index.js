// ============================================
// index.js — 基礎資料庫入口（v101.6）
// 位置：js/pages/database/index.js
// ============================================
// v101.6 修正：
//   ✅ 從 8 Tab 縮減為 6 Tab
//   ✅ 移除「保單」「基金」Tab（已移到輸入中心）
//   ✅ 所有 Tab 使用 entity-list-page.js 統一骨架
// ============================================

import { initTabPanel } from '../../shared/tab-panel.js';
import { showToast } from '../../shared/toast.js';
import { registerPageCleanup } from '../../core/app.js';

/* ============================================
   Tab 實例記錄
   ============================================ */
let _tabInstances = {
  members:    null,
  banks:      null,
  categories: null,
  options:    null,
  dropdowns:  null,
  yearrange:  null,
};

let _tabPanel = null;

/* ============================================
   Tab 定義（6 個）
   ============================================ */
const TABS = [
  { key: 'members',    label: '成員',       icon: 'users',        panelId: 'db-panel-members'    },
  { key: 'banks',      label: '銀行',       icon: 'landmark',     panelId: 'db-panel-banks'      },
  { key: 'categories', label: '支出結構',   icon: 'tags',         panelId: 'db-panel-categories' },
  { key: 'options',    label: '支付/狀態',  icon: 'credit-card',  panelId: 'db-panel-options'    },
  { key: 'dropdowns',  label: '下拉選項',   icon: 'list-ordered', panelId: 'db-panel-dropdowns'  },
  { key: 'yearrange',  label: '年份範圍',   icon: 'calendar',     panelId: 'db-panel-yearrange'  },
];

/* ============================================
   主入口
   ============================================ */
export function initDatabasePage() {
  const root = document.getElementById('database-root');
  if (!root) {
    console.warn('⚠️ initDatabasePage: 找不到容器 #database-root');
    return;
  }

  root.innerHTML = `
    <div id="db-tab-bar-root"></div>
    ${TABS.map((t) => `
      <div id="${t.panelId}" class="tab-panel" style="display:none;"></div>
    `).join('')}
  `;

  _tabPanel = initTabPanel({
    containerId: 'db-tab-bar-root',
    tabs: TABS,
    defaultKey: 'members',
    storageKey: 'database-tab',
    wrap: true,
    onChange: (key) => {
      _activateTab(key);
    },
  });

  if (_tabPanel) {
    _activateTab(_tabPanel.getCurrent());
  }

  registerPageCleanup(_destroy);

  return {
    switchTo: (key) => _tabPanel?.switchTo(key),
    getCurrent: () => _tabPanel?.getCurrent(),
    destroy: _destroy,
  };
}

/* ============================================
   啟用指定 Tab（懶載入）
   ============================================ */
async function _activateTab(key) {
  const tabDef = TABS.find((t) => t.key === key);
  if (!tabDef) return;

  if (_tabInstances[key]) {
    try {
      _tabInstances[key].refresh?.();
    } catch (err) {
      console.error(`[database] refresh ${key} 失敗：`, err);
    }
    return;
  }

  try {
    const instance = await _initTabModule(key, tabDef.panelId);
    _tabInstances[key] = instance;
  } catch (err) {
    console.error(`[database] 初始化 ${key} 失敗：`, err);
    showToast(`載入「${tabDef.label}」失敗`, 'error');

    const panel = document.getElementById(tabDef.panelId);
    if (panel) {
      panel.innerHTML = `
        <div class="banner banner-error">
          載入失敗：${err.message || err}
        </div>
      `;
    }
  }
}

/* ============================================
   動態載入 Tab 模組
   ============================================ */
async function _initTabModule(key, containerId) {
  let module;
  let initFn;

  switch (key) {
    case 'members':
      module = await import('./tab-members.js');
      initFn = module.initMembersTab;
      break;

    case 'banks':
      module = await import('./tab-banks.js');
      initFn = module.initBanksTab;
      break;

    case 'categories':
      module = await import('./tab-categories.js');
      initFn = module.initCategoriesTab;
      break;

    case 'options':
      module = await import('./tab-options.js');
      initFn = module.initOptionsTab;
      break;

    case 'dropdowns':
      module = await import('./tab-dropdowns.js');
      initFn = module.initDropdownsTab;
      break;

    case 'yearrange':
      module = await import('./tab-yearrange.js');
      initFn = module.initYearRangeTab;
      break;

    default:
      throw new Error(`未知的 Tab：${key}`);
  }

  if (typeof initFn !== 'function') {
    throw new Error(`Tab ${key} 沒有對應的初始化函式`);
  }

  return initFn(containerId);
}

/* ============================================
   銷毀
   ============================================ */
function _destroy() {
  Object.entries(_tabInstances).forEach(([key, instance]) => {
    if (!instance) return;
    try {
      instance.destroy?.();
    } catch (err) {
      console.warn(`[database] destroy ${key} 失敗：`, err);
    }
  });

  _tabInstances = {
    members: null, banks: null, categories: null,
    options: null, dropdowns: null, yearrange: null,
  };

  if (_tabPanel) {
    try { _tabPanel.destroy(); } catch (e) { /* noop */ }
    _tabPanel = null;
  }
}