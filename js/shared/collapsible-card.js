// ============================================
// collapsible-card.js — 全站共用可摺疊卡片（v101.5）
// 位置：js/shared/collapsible-card.js
// ============================================
// v101.5 修正：
//   ✅ storageKey 統一使用 STORAGE_KEYS.UI_PREFIX
//   ✅ 修正 _refreshIconsIn 註解與實作不符（改為局部掃描）
//   ✅ 抽出 _normalizeKey（避免各模組重複拼字串）
//   ✅ 新增 destroy 清理事件
// ============================================

import { STORAGE_KEYS } from '../config/constants.js';

/* ============================================
   主函式
   ============================================ */

/**
 * 初始化可摺疊卡片
 * @param {string} cardId - 卡片 ID
 * @param {string} storageKey - localStorage 儲存 key（自動加前綴）
 * @param {boolean} defaultOpen - 預設是否展開
 * @returns {Object|null}
 */
export function initCollapsibleCard(cardId, storageKey, defaultOpen = false) {
  const card = document.getElementById(cardId);
  if (!card) {
    console.warn(`⚠️ initCollapsibleCard: 找不到 #${cardId}`);
    return null;
  }

  const header = card.querySelector('.collapsible-header');
  const body = card.querySelector('.collapsible-body');
  if (!header || !body) {
    console.warn(`⚠️ initCollapsibleCard: #${cardId} 缺少 .collapsible-header 或 .collapsible-body`);
    return null;
  }

  // 統一 storageKey
  const key = _normalizeKey(storageKey);

  // 內部狀態設定
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
    } catch (e) {
      // localStorage 不可用（隱私模式）
    }
    _refreshIconsIn(card);
  };

  // 讀取儲存狀態
  let savedOpen = null;
  try {
    savedOpen = localStorage.getItem(key);
  } catch (e) {
    // 忽略
  }
  const initialOpen = savedOpen !== null ? savedOpen === 'true' : defaultOpen;
  setState(initialOpen);

  // 綁定點擊
  const clickHandler = () => {
    const newState = !card.classList.contains('open');
    setState(newState);
  };
  header.addEventListener('click', clickHandler);

  return {
    open:    () => setState(true),
    close:   () => setState(false),
    toggle:  () => setState(!card.classList.contains('open')),
    isOpen:  () => card.classList.contains('open'),

    destroy: () => {
      header.removeEventListener('click', clickHandler);
    },
  };
}

/**
 * 批次初始化多個卡片
 */
export function initCollapsibleCards(configs = []) {
  return configs.map((cfg) =>
    initCollapsibleCard(cfg.cardId, cfg.storageKey, cfg.defaultOpen || false)
  );
}

/* ============================================
   內部工具
   ============================================ */

/**
 * 統一 storageKey（自動加前綴）
 */
function _normalizeKey(storageKey) {
  if (!storageKey) return `${STORAGE_KEYS.UI_PREFIX}collapsible-default`;
  return storageKey.startsWith(STORAGE_KEYS.UI_PREFIX)
    ? storageKey
    : `${STORAGE_KEYS.UI_PREFIX}${storageKey}`;
}

/**
 * 只更新卡片內的 lucide 圖示（效能優化）
 * 注意：lucide 的 createIcons 沒有提供局部掃描 API，
 * 因此這裡改為先移除卡片內已有的 svg，再呼叫全域 createIcons。
 * 這比全頁重繪快，但仍會掃描全頁。
 */
function _refreshIconsIn(container) {
  if (!window.lucide || typeof window.lucide.createIcons !== 'function') return;
  try {
    // 移除卡片內已渲染的 svg（讓 lucide 重新渲染）
    container.querySelectorAll('svg[data-lucide], i[data-lucide]').forEach((el) => {
      if (el.tagName === 'svg') el.remove();
    });
    window.lucide.createIcons({ nameAttr: 'data-lucide' });
  } catch (e) {
    // 忽略
  }
}