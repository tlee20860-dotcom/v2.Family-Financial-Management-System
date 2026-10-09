// ============================================
// tab-panel.js — Tab 切換元件（v103.0.11）
// 位置：js/ui/tab-panel.js
// ============================================
// v103.0.11 修正：
//   ✅ [M05] localStorage key 前綴改用 STORAGE_PREFIXES.UI
// ============================================

import { esc } from '../lib/dom.js';
import { STORAGE_PREFIXES } from '../config/constants.js';

/* ============================================
   主函式
   ============================================ */
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

  const normalizedTabs = tabs.map((t) => ({
    ...t,
    panelId: t.panelId || `${containerId}-panel-${t.key}`,
  }));

  const initialKey = _resolveInitialKey(normalizedTabs, defaultKey, storageKey);

  const wrapClass = wrap ? ' tab-bar-wrap' : '';
  root.innerHTML = `
    <div class="tab-bar${wrapClass}">
      ${normalizedTabs.map((t) => _renderTabBtn(t, t.key === initialKey)).join('')}
    </div>
  `;

  const clickHandler = (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    const key = btn.dataset.tabKey;
    if (key) switchTo(key);
  };
  root.addEventListener('click', clickHandler);

  if (window.lucide) window.lucide.createIcons();

  let _currentKey = initialKey;

  function switchTo(key) {
    if (!normalizedTabs.some((t) => t.key === key)) return;
    if (key === _currentKey) return;

    _currentKey = key;

    root.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tabKey === key);
    });

    normalizedTabs.forEach((t) => {
      const panel = document.getElementById(t.panelId);
      if (!panel) return;
      panel.classList.toggle('active', t.key === key);
      panel.style.display = t.key === key ? 'block' : 'none';
    });

    if (storageKey) {
      try {
        localStorage.setItem(_fullKey(storageKey), key);
      } catch (e) { /* noop */ }
    }

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

  _applyInitialState(normalizedTabs, initialKey);

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
    refresh: () => {
      const tab = normalizedTabs.find((t) => t.key === _currentKey);
      if (typeof onChange === 'function') onChange(_currentKey, tab);
    },
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
    ? `<i data-lucide="${esc(tab.icon)}" style="width:14px;height:14px;"></i>`
    : '';
  return `
    <button type="button" class="tab-btn ${isActive ? 'active' : ''}" data-tab-key="${esc(tab.key)}">
      ${iconHtml}
      <span>${esc(tab.label)}</span>
    </button>
  `;
}

/**
 * 🆕 v103.0.11：統一使用 STORAGE_PREFIXES.UI
 */
function _fullKey(storageKey) {
  if (!storageKey) return `${STORAGE_PREFIXES.UI}tab-default`;
  return storageKey.startsWith(STORAGE_PREFIXES.UI)
    ? storageKey
    : `${STORAGE_PREFIXES.UI}${storageKey}`;
}

function _resolveInitialKey(tabs, defaultKey, storageKey) {
  if (storageKey) {
    try {
      const saved = localStorage.getItem(_fullKey(storageKey));
      if (saved && tabs.some((t) => t.key === saved)) return saved;
    } catch (e) { /* noop */ }
  }
  if (defaultKey && tabs.some((t) => t.key === defaultKey)) return defaultKey;
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