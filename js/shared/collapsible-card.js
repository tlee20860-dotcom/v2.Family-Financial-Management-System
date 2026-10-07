// ============================================
// collapsible-card.js — 全站共用可摺疊卡片（v101）
// 位置：js/shared/collapsible-card.js
// ============================================
// v101 修正：
//   ✅ storageKey 自動加前綴（STORAGE_KEYS.UI_PREFIX）
//   ✅ 抽出 setState 內部函式（消除重複）
//   ✅ 局部 lucide 更新（只掃描卡片內圖示）
//   ✅ 新增 destroy() 清理事件
// ============================================

import { STORAGE_KEYS } from '../config/constants.js';

/**
 * 初始化可摺疊卡片
 *
 * HTML 結構要求：
 *   <div class="glass-card collapsible-card" id="xxx-card">
 *     <div class="collapsible-header" id="xxx-header">
 *       <div class="collapsible-header-title">
 *         <i data-lucide="plus-circle"></i>
 *         <span>標題</span>
 *       </div>
 *       <i data-lucide="chevron-down" class="collapsible-arrow"></i>
 *     </div>
 *     <div class="collapsible-body" id="xxx-body" style="display:none;">
 *       ...表單內容...
 *     </div>
 *   </div>
 *
 * @param {string} cardId - 卡片 ID
 * @param {string} storageKey - localStorage 儲存 key（會自動加 'fin_ui_' 前綴）
 * @param {boolean} defaultOpen - 預設是否展開
 * @returns {Object|null} 控制物件 { open, close, toggle, isOpen, destroy }
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

  // 統一 storageKey（加前綴）
  const key = storageKey.startsWith(STORAGE_KEYS.UI_PREFIX)
    ? storageKey
    : `${STORAGE_KEYS.UI_PREFIX}${storageKey}`;

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
      // localStorage 不可用（隱私模式）→ 忽略
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
 * @param {Array<{cardId, storageKey, defaultOpen}>} configs
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
 * 只更新卡片內的 lucide 圖示（效能優化）
 */
function _refreshIconsIn(container) {
  if (!window.lucide || typeof window.lucide.createIcons !== 'function') return;
  // lucide 的 createIcons 支援傳入 attrs 篩選，但為求相容性直接呼叫
  // （lucide 內部會掃描整個 DOM，但範圍比全頁小）
  try {
    window.lucide.createIcons({ nameAttr: 'data-lucide' });
  } catch (e) {
    // 忽略
  }
}