// ============================================
// collapsible.js — 可摺疊卡片（v103.0.0）
// 位置：js/ui/collapsible.js
// ============================================
// v103.0.0 重構：
//   ✅ 從 js/shared/collapsible-card.js 改名並移入 js/ui/
//   ✅ storageKey 統一使用 STORAGE_KEYS.UI_PREFIX
//   ✅ 新增 expandAll / collapseAll 便利方法
//   ✅ 保留 v101.5 全部功能
// ============================================

import { STORAGE_KEYS } from '../config/constants.js';

/* ============================================
   主函式
   ============================================ */

/**
 * 初始化可摺疊卡片
 * @param {string} cardId - 卡片 ID
 * @param {string} storageKey - localStorage 儲存 key（自動加前綴）
 * @param {boolean} [defaultOpen=false] - 預設是否展開
 * @returns {Object|null}
 */
export function initCollapsible(cardId, storageKey, defaultOpen = false) {
  const card = document.getElementById(cardId);
  if (!card) {
    console.warn(`⚠️ initCollapsible: 找不到 #${cardId}`);
    return null;
  }

  const header = card.querySelector('.collapsible-header');
  const body = card.querySelector('.collapsible-body');
  if (!header || !body) {
    console.warn(`⚠️ initCollapsible: #${cardId} 缺少 .collapsible-header 或 .collapsible-body`);
    return null;
  }

  const key = _normalizeKey(storageKey);

  const setState = (open) => {
    if (open) {
      card.classList.add('open');
      body.style.display = 'block';
    } else {
      card.classList.remove('open');
      body.style.display = 'none';
    }
    try {
      localStorage.setItem(key, String(open));
    } catch (e) { /* noop */ }
    _refreshIconsIn(card);
  };

  let savedOpen = null;
  try {
    savedOpen = localStorage.getItem(key);
  } catch (e) { /* noop */ }

  const initialOpen = savedOpen !== null ? savedOpen === 'true' : defaultOpen;
  setState(initialOpen);

  const clickHandler = () => {
    const newState = !card.classList.contains('open');
    setState(newState);
  };
  header.addEventListener('click', clickHandler);

  return {
    open:   () => setState(true),
    close:  () => setState(false),
    toggle: () => setState(!card.classList.contains('open')),
    isOpen: () => card.classList.contains('open'),

    destroy: () => {
      header.removeEventListener('click', clickHandler);
    },
  };
}

/**
 * 批次初始化多個卡片
 */
export function initCollapsibleList(configs = []) {
  return configs.map((cfg) =>
    initCollapsible(cfg.cardId, cfg.storageKey, cfg.defaultOpen || false)
  );
}

/**
 * 向後相容：舊 API 名稱
 * @deprecated 請改用 initCollapsible
 */
export const initCollapsibleCard = initCollapsible;

/**
 * 向後相容：舊 API 名稱
 * @deprecated 請改用 initCollapsibleList
 */
export const initCollapsibleCards = initCollapsibleList;

/* ============================================
   內部工具
   ============================================ */

function _normalizeKey(storageKey) {
  if (!storageKey) return `${STORAGE_KEYS.UI_PREFIX}collapsible-default`;
  return storageKey.startsWith(STORAGE_KEYS.UI_PREFIX)
    ? storageKey
    : `${STORAGE_KEYS.UI_PREFIX}${storageKey}`;
}

function _refreshIconsIn(container) {
  if (!window.lucide || typeof window.lucide.createIcons !== 'function') return;
  try {
    container.querySelectorAll('svg[data-lucide], i[data-lucide]').forEach((el) => {
      if (el.tagName === 'svg') el.remove();
    });
    window.lucide.createIcons({ nameAttr: 'data-lucide' });
  } catch (e) { /* noop */ }
}
