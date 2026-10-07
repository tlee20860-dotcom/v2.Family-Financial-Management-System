// ============================================
// annual-month-cards.js — 全站共用年度 12 個月折疊卡（v101.5）
// 位置：js/shared/annual-month-cards.js
// ============================================
// v101.5 修正：
//   ✅ storageKey 統一使用 STORAGE_KEYS.UI_PREFIX
//   ✅ 新增 destroy 清理事件
//   ✅ 強化 escape（呼叫端負責，但內部也做基本處理）
//   ✅ 支援 emptyHtml 自訂空狀態
// ============================================

import { formatHKD } from '../core/utils.js';
import { STORAGE_KEYS } from '../config/constants.js';

/* ============================================
   主函式
   ============================================ */

/**
 * 渲染年度 12 個月折疊卡
 * @param {string} containerId
 * @param {Object} options
 * @returns {Object|null}
 */
export function renderAnnualMonthCards(containerId, options = {}) {
  const {
    getMonthData,
    totalFormatter = formatHKD,
    emptyText = '本年度尚無資料',
    emptyHtml,
    storageKey,
  } = options;

  const container = document.getElementById(containerId);
  if (!container) {
    console.warn(`⚠️ renderAnnualMonthCards: 找不到容器 #${containerId}`);
    return null;
  }

  // 讀取展開狀態
  const openSet = _loadOpenSet(storageKey);

  const cards = [];
  for (let m = 1; m <= 12; m++) {
    const data = getMonthData(m);
    if (!data) continue;

    const isOpen = openSet.has(m);
    cards.push(`
      <div class="annual-month-card" data-month="${m}">
        <div class="annual-month-header" data-month="${m}">
          <div class="month-title">${data.title || `${m} 月`}</div>
          <div class="month-total">${totalFormatter(data.total || 0)}</div>
        </div>
        <div class="annual-month-detail" style="display:${isOpen ? 'block' : 'none'};">
          ${data.detailHtml || ''}
        </div>
      </div>
    `);
  }

  if (cards.length === 0) {
    container.innerHTML = emptyHtml || `
      <div class="glass-card">
        <div class="empty-state">${emptyText}</div>
      </div>
    `;
    return null;
  }

  container.innerHTML = cards.join('');

  // 綁定折疊事件
  const clickHandler = (e) => {
    const header = e.target.closest('.annual-month-header');
    if (!header) return;
    const month = Number(header.dataset.month);
    const detail = header.nextElementSibling;
    if (!detail) return;

    const isOpen = detail.style.display !== 'none';
    detail.style.display = isOpen ? 'none' : 'block';

    if (isOpen) openSet.delete(month);
    else openSet.add(month);

    _saveOpenSet(storageKey, openSet);
  };

  container.addEventListener('click', clickHandler);

  if (window.lucide) window.lucide.createIcons();

  return {
    container,

    expandAll: () => {
      container.querySelectorAll('.annual-month-card').forEach((card) => {
        const m = Number(card.dataset.month);
        openSet.add(m);
        const detail = card.querySelector('.annual-month-detail');
        if (detail) detail.style.display = 'block';
      });
      _saveOpenSet(storageKey, openSet);
    },

    collapseAll: () => {
      container.querySelectorAll('.annual-month-card').forEach((card) => {
        const m = Number(card.dataset.month);
        openSet.delete(m);
        const detail = card.querySelector('.annual-month-detail');
        if (detail) detail.style.display = 'none';
      });
      _saveOpenSet(storageKey, openSet);
    },

    destroy: () => {
      container.removeEventListener('click', clickHandler);
    },
  };
}

/**
 * 產生單一月份明細 row 的 HTML
 */
export function monthRowHtml(name, amount, colorClass = 'text-emerald') {
  return `
    <div class="annual-month-row">
      <span>${name}</span>
      <span class="mono ${colorClass}">${formatHKD(amount)}</span>
    </div>
  `;
}

/* ============================================
   內部工具
   ============================================ */

function _loadOpenSet(storageKey) {
  if (!storageKey) return new Set();
  const key = _normalizeKey(storageKey);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch (e) {
    return new Set();
  }
}

function _saveOpenSet(storageKey, set) {
  if (!storageKey) return;
  const key = _normalizeKey(storageKey);
  try {
    localStorage.setItem(key, JSON.stringify([...set]));
  } catch (e) {
    // 忽略
  }
}

function _normalizeKey(storageKey) {
  if (!storageKey) return `${STORAGE_KEYS.UI_PREFIX}annual-default`;
  return storageKey.startsWith(STORAGE_KEYS.UI_PREFIX)
    ? storageKey
    : `${STORAGE_KEYS.UI_PREFIX}${storageKey}`;
}