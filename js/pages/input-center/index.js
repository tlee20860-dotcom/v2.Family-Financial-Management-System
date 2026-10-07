// ============================================
// index.js — 綜合輸入中心入口（v101.5）
// 位置：js/pages/input-center/index.js
// ============================================
// v101.5 修正：
//   ✅ 每個 Tab 加「+ 新增 XX」按鈕（依 entity-definitions.js）
//   ✅ 使用 registerPageCleanup 註冊清理
//   ✅ 統一 await initXxxPage
// ============================================

import { initTabPanel } from '../../shared/tab-panel.js';
import { showToast } from '../../shared/toast.js';
import { openEntityModal } from '../../shared/entity-modal.js';
import { registerPageCleanup } from '../../core/app.js';
import { ENTITY_KEYS } from '../../config/constants.js';

/* ============================================
   Tab 模組（lazy import）
   ============================================ */
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
   Tab 定義（含「+ 新增」按鈕對應的實體）
   ============================================ */
const TABS = [
  {
    key: 'expenses',
    label: '日常支出',
    icon: 'pencil',
    panelId: 'ic-panel-expenses',
    containerId: 'ic-panel-expenses',
    quickAdd: null,   // 表單本身就是新增
  },
  {
    key: 'fixed',
    label: '固定支出',
    icon: 'file-text',
    panelId: 'ic-panel-fixed',
    containerId: 'ic-panel-fixed',
    quickAdd: {
      entity: ENTITY_KEYS.FIXED_TEMPLATE,
      label: '新增固定支出',
    },
  },
  {
    key: 'insurance',
    label: '保險扣款',
    icon: 'shield',
    panelId: 'ic-panel-insurance',
    containerId: 'ic-panel-insurance',
    quickAdd: {
      entity: ENTITY_KEYS.POLICY,
      label: '新增保單',
    },
  },
  {
    key: 'income',
    label: '收入',
    icon: 'dollar-sign',
    panelId: 'ic-panel-income',
    containerId: 'ic-panel-income',
    quickAdd: null,   // 表單本身就是儲存
  },
  {
    key: 'banks',
    label: '銀行結餘',
    icon: 'landmark',
    panelId: 'ic-panel-banks',
    containerId: 'ic-panel-banks',
    quickAdd: {
      entity: ENTITY_KEYS.BANK,
      label: '新增銀行',
    },
  },
  {
    key: 'funds',
    label: '基金現值',
    icon: 'line-chart',
    panelId: 'ic-panel-funds',
    containerId: 'ic-panel-funds',
    quickAdd: {
      entity: ENTITY_KEYS.FUND,
      label: '新增基金',
    },
  },
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

  // 渲染骨架：Tab 按鈕列 + 快捷新增按鈕列 + 6 個 panel
  root.innerHTML = `
    <div class="flex flex-between items-center flex-wrap gap-12 mb-16">
      <div id="ic-tab-bar-root" style="flex:1; min-width:0;"></div>
      <div id="ic-quick-add-root" class="flex gap-8 flex-wrap"></div>
    </div>
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
    wrap: true,
    onChange: (key) => {
      _activateTab(key);
      _renderQuickAdd(key);
    },
  });

  // 初次進入
  if (_tabPanel) {
    const current = _tabPanel.getCurrent();
    _activateTab(current);
    _renderQuickAdd(current);
  }

  // 註冊清理
  registerPageCleanup(_destroy);

  return {
    switchTo: (key) => _tabPanel?.switchTo(key),
    getCurrent: () => _tabPanel?.getCurrent(),
    destroy: _destroy,
  };
}

/* ============================================
   快捷新增按鈕
   ============================================ */
function _renderQuickAdd(tabKey) {
  const root = document.getElementById('ic-quick-add-root');
  if (!root) return;

  const tabDef = TABS.find((t) => t.key === tabKey);
  if (!tabDef || !tabDef.quickAdd) {
    root.innerHTML = '';
    return;
  }

  root.innerHTML = `
    <button class="btn btn-primary" id="ic-quick-add-btn">
      <i data-lucide="plus"></i> ${tabDef.quickAdd.label}
    </button>
  `;

  document.getElementById('ic-quick-add-btn')?.addEventListener('click', () => {
    _handleQuickAdd(tabDef.quickAdd.entity);
  });

  if (window.lucide) window.lucide.createIcons();
}

async function _handleQuickAdd(entityKey) {
  await openEntityModal({
    entity: entityKey,
    mode: 'add',
    onSuccess: () => {
      // 重新整理當前 Tab
      const current = _tabPanel?.getCurrent();
      if (current && _tabInstances[current]) {
        try { _tabInstances[current].refresh?.(); } catch (e) { /* noop */ }
      }
    },
  });
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
      console.error(`[input-center] refresh ${key} 失敗：`, err);
    }
    return;
  }

  try {
    const instance = await _initTabModule(key, tabDef.containerId);
    _tabInstances[key] = instance;
  } catch (err) {
    console.error(`[input-center] 初始化 ${key} 失敗：`, err);
    showToast(`載入「${tabDef.label}」失敗`, 'error');

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