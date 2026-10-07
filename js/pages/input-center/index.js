// ============================================
// index.js — 綜合輸入中心入口（v101）
// 位置：js/pages/input-center/index.js
// ============================================
// 用途：
//   組裝 6 個 Tab（日常支出 / 固定支出 / 保險扣款 / 收入 / 銀行結餘 / 基金現值）
//   使用 tab-panel.js 進行切換
//   支援懶載入（第一次進入才初始化該 Tab）
// ============================================

import { initTabPanel } from '../../shared/tab-panel.js';
import { showToast } from '../../shared/toast.js';

// Tab 模組（lazy import）
let _tabModules = {
  expenses:  null,
  fixed:     null,
  insurance: null,
  income:    null,
  banks:     null,
  funds:     null,
};

let _tabInstances = {
  expenses:  null,
  fixed:     null,
  insurance: null,
  income:    null,
  banks:     null,
  funds:     null,
};

let _tabPanel = null;

/* ============================================
   Tab 定義
   ============================================ */
const TABS = [
  { key: 'expenses',  label: '日常支出', icon: 'pencil',       panelId: 'ic-panel-expenses',  containerId: 'ic-panel-expenses'  },
  { key: 'fixed',     label: '固定支出', icon: 'file-text',    panelId: 'ic-panel-fixed',     containerId: 'ic-panel-fixed'     },
  { key: 'insurance', label: '保險扣款', icon: 'shield',       panelId: 'ic-panel-insurance', containerId: 'ic-panel-insurance' },
  { key: 'income',    label: '收入',     icon: 'dollar-sign',  panelId: 'ic-panel-income',    containerId: 'ic-panel-income'    },
  { key: 'banks',     label: '銀行結餘', icon: 'landmark',     panelId: 'ic-panel-banks',     containerId: 'ic-panel-banks'     },
  { key: 'funds',     label: '基金現值', icon: 'line-chart',   panelId: 'ic-panel-funds',     containerId: 'ic-panel-funds'     },
];

/* ============================================
   主入口
   ============================================ */
export function initInputCenterPage() {
  const root = document.getElementById('input-center-root');
  if (!root) {
    console.warn('⚠️ initInputCenterPage: 找不到容器 #input-center-root');
    return;
  }

  // 渲染骨架：Tab 按鈕列 + 6 個 panel
  root.innerHTML = `
    <div id="ic-tab-bar-root"></div>
    ${TABS.map((t) => `
      <div id="${t.panelId}" class="tab-panel" style="display:none;"></div>
    `).join('')}
  `;

  // 初始化 Tab 面板
  _tabPanel = initTabPanel({
    containerId: 'ic-tab-bar-root',
    tabs: TABS,
    defaultKey: 'expenses',
    storageKey: 'input-center-tab',
    wrap: true,   // 6 Tab 分兩行
    onChange: (key) => {
      _activateTab(key);
    },
  });

  // 初次進入：載入預設 Tab
  if (_tabPanel) {
    _activateTab(_tabPanel.getCurrent());
  }

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

  // 已初始化 → 只呼叫 refresh
  if (_tabInstances[key]) {
    try {
      _tabInstances[key].refresh?.();
    } catch (err) {
      console.error(`[input-center] refresh ${key} 失敗：`, err);
    }
    return;
  }

  // 第一次進入 → 初始化
  try {
    const instance = await _initTabModule(key, tabDef.containerId);
    _tabInstances[key] = instance;
  } catch (err) {
    console.error(`[input-center] 初始化 ${key} 失敗：`, err);
    showToast(`載入「${tabDef.label}」失敗`, 'error');

    // 顯示錯誤訊息
    const panel = document.getElementById(tabDef.containerId);
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
    case 'expenses':
      module = await import('./tab-expenses.js');
      initFn = module.initExpensesTab;
      break;

    case 'fixed':
      module = await import('./tab-fixed.js');
      initFn = module.initFixedTab;
      break;

    case 'insurance':
      module = await import('./tab-insurance.js');
      initFn = module.initInsuranceTab;
      break;

    case 'income':
      module = await import('./tab-income.js');
      initFn = module.initIncomeTab;
      break;

    case 'banks':
      module = await import('./tab-banks.js');
      initFn = module.initBanksTab;
      break;

    case 'funds':
      module = await import('./tab-funds.js');
      initFn = module.initFundsTab;
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
      console.warn(`[input-center] destroy ${key} 失敗：`, err);
    }
  });
  _tabInstances = {
    expenses: null, fixed: null, insurance: null,
    income: null, banks: null, funds: null,
  };
  if (_tabPanel) {
    try { _tabPanel.destroy(); } catch (e) { /* noop */ }
    _tabPanel = null;
  }
}