// ============================================
// tab-panel.js — Tab 切換元件（v101）
// 位置：js/shared/tab-panel.js
// ============================================
// 用途：
//   綜合輸入中心 / 基礎資料庫 / 平台預設 / settings / admin 的分頁
//
// 用法：
//   const tabs = initTabPanel({
//     containerId: 'xxx-tabs',
//     tabs: [
//       { key: 'tab1', label: '📝 分頁1', icon: 'pencil', panelId: 'panel-tab1' },
//       { key: 'tab2', label: '💰 分頁2', icon: 'dollar-sign', panelId: 'panel-tab2' },
//     ],
//     defaultKey: 'tab1',
//     storageKey: 'xxx-tab',
//     onChange: (key) => { ... },
//   });
//   tabs.switchTo('tab2');
//   tabs.getCurrent();
//   tabs.destroy();
// ============================================

import { escapeHtml } from '../core/utils.js';

/* ============================================
   主函式
   ============================================ */

/**
 * 初始化 Tab 面板
 * @param {Object} options
 * @param {string} options.containerId - Tab 按鈕列的容器 ID
 * @param {Array} options.tabs - Tab 定義陣列
 * @param {string} options.tabs[].key - Tab 唯一識別
 * @param {string} options.tabs[].label - 顯示標籤（可含 emoji）
 * @param {string} [options.tabs[].icon] - Lucide icon 名稱（可選）
 * @param {string} [options.tabs[].panelId] - 對應 panel 元素 ID（可選，預設 `${containerId}-panel-${key}`）
 * @param {string} [options.defaultKey] - 預設 Tab key
 * @param {string} [options.storageKey] - localStorage 記憶鍵（自動加前綴）
 * @param {boolean} [options.wrap=false] - 是否多行顯示（8 Tab 用）
 * @param {Function} [options.onChange] - 切換回呼 (key, tab) => {}
 * @returns {Object}
 */
export function initTabPanel(options) {
  const {
    containerId,
    tabs = [],
    defaultKey,
    storageKey,
    wrap = false,
    onChange,
  } = options;

  const root = document.getElementById(containerId);
  if (!root) {
    console.warn(`⚠️ initTabPanel: 找不到容器 #${containerId}`);
    return null;
  }

  if (tabs.length === 0) {
    console.warn('⚠️ initTabPanel: tabs 陣列為空');
    return null;
  }

  // 補齊 panelId
  const normalizedTabs = tabs.map((t) => ({
    ...t,
    panelId: t.panelId || `${containerId}-panel-${t.key}`,
  }));

  // 決定初始 key
  const initialKey = _resolveInitialKey(normalizedTabs, defaultKey, storageKey);

  // 渲染 Tab 按鈕列
  const wrapClass = wrap ? ' tab-bar-wrap' : '';
  root.innerHTML = `
    <div class="tab-bar${wrapClass}">
      ${normalizedTabs.map((t) => _renderTabBtn(t, t.key === initialKey)).join('')}
    </div>
  `;

  // 事件：點擊 Tab 切換
  const clickHandler = (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    const key = btn.dataset.tabKey;
    if (key) switchTo(key);
  };
  root.addEventListener('click', clickHandler);

  if (window.lucide) window.lucide.createIcons();

  /* ============================================
     對外 API
     ============================================ */
  let _currentKey = initialKey;

  function switchTo(key) {
    if (!normalizedTabs.some((t) => t.key === key)) return;
    if (key === _currentKey) return;

    _currentKey = key;

    // 更新按鈕 active
    root.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tabKey === key);
    });

    // 更新 panel 顯示
    normalizedTabs.forEach((t) => {
      const panel = document.getElementById(t.panelId);
      if (!panel) return;
      panel.classList.toggle('active', t.key === key);
      panel.style.display = t.key === key ? 'block' : 'none';
    });

    // 儲存狀態
    if (storageKey) {
      try {
        const k = storageKey.startsWith('fin_ui_') ? storageKey : `fin_ui_${storageKey}`;
        localStorage.setItem(k, key);
      } catch (e) { /* noop */ }
    }

    // 回呼
    if (typeof onChange === 'function') {
      const tab = normalizedTabs.find((t) => t.key === key);
      try {
        onChange(key, tab);
      } catch (err) {
        console.error('[tab-panel] onChange error:', err);
      }
    }

    if (window.lucide) window.lucide.createIcons();
  }

  // 初次套用初始狀態
  _applyInitialState(normalizedTabs, initialKey);

  // 初次回呼
  if (typeof onChange === 'function') {
    const tab = normalizedTabs.find((t) => t.key === initialKey);
    try {
      onChange(initialKey, tab);
    } catch (err) {
      console.error('[tab-panel] initial onChange error:', err);
    }
  }

  return {
    root,
    tabs: normalizedTabs,
    getCurrent: () => _currentKey,
    switchTo,
    /**
     * 重新觸發當前 Tab 的 onChange（用於資料更新後重繪）
     */
    refresh: () => {
      const tab = normalizedTabs.find((t) => t.key === _currentKey);
      if (typeof onChange === 'function') onChange(_currentKey, tab);
    },
    /**
     * 銷毀
     */
    destroy: () => {
      root.removeEventListener('click', clickHandler);
    },
  };
}

/* ============================================
   內部函式
   ============================================ */

function _renderTabBtn(tab, isActive) {
  const iconHtml = tab.icon
    ? `<i data-lucide="${tab.icon}" style="width:14px;height:14px;"></i>`
    : '';
  return `
    <button type="button" class="tab-btn ${isActive ? 'active' : ''}" data-tab-key="${escapeHtml(tab.key)}">
      ${iconHtml}
      <span>${escapeHtml(tab.label)}</span>
    </button>
  `;
}

function _resolveInitialKey(tabs, defaultKey, storageKey) {
  // 1. 優先 localStorage
  if (storageKey) {
    try {
      const k = storageKey.startsWith('fin_ui_') ? storageKey : `fin_ui_${storageKey}`;
      const saved = localStorage.getItem(k);
      if (saved && tabs.some((t) => t.key === saved)) return saved;
    } catch (e) { /* noop */ }
  }
  // 2. 其次 defaultKey
  if (defaultKey && tabs.some((t) => t.key === defaultKey)) return defaultKey;
  // 3. fallback 第一個
  return tabs[0].key;
}

function _applyInitialState(tabs, activeKey) {
  tabs.forEach((t) => {
    const panel = document.getElementById(t.panelId);
    if (!panel) return;
    const isActive = t.key === activeKey;
    panel.classList.toggle('active', isActive);
    panel.style.display = isActive ? 'block' : 'none';
  });
}