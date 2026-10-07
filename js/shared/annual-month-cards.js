// ============================================
// annual-month-cards.js — 全站共用年度 12 個月折疊卡（v101）
// 位置：js/shared/annual-month-cards.js
// ============================================
// v101 修正：
//   ✅ 新增 storageKey 選項（折疊狀態持久化）
//   ✅ 標題 / detailHtml 由呼叫端負責 escape（文件說明）
//   ✅ 新增 destroy()
//   ✅ 支援 emptyHtml 自訂空狀態
// ============================================

import { formatHKD } from '../core/utils.js';

/**
 * 渲染年度 12 個月折疊卡
 *
 * HTML 容器要求：
 *   <div id="annual-monthly-cards"></div>
 *
 * @param {string} containerId - 容器 ID
 * @param {Object} options
 * @param {Function} options.getMonthData - (monthNum) => { title, total, detailHtml }
 * @param {Function} [options.totalFormatter] - (num) => string（預設 formatHKD）
 * @param {string} [options.emptyText] - 無資料時的文字
 * @param {string} [options.emptyHtml] - 無資料時的自訂 HTML（優先於 emptyText）
 * @param {string} [options.storageKey] - 折疊狀態儲存 key（選填）
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
 * 產生單一月份明細 row 的 HTML（供 getMonthData 使用）
 *
 * @param {string} name - 項目名稱（需自行 escape）
 * @param {number} amount - 金額
 * @param {string} colorClass - 顏色 class（預設 'text-emerald'）
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
  const key = storageKey.startsWith('fin_ui_') ? storageKey : `fin_ui_${storageKey}`;
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
  const key = storageKey.startsWith('fin_ui_') ? storageKey : `fin_ui_${storageKey}`;
  try {
    localStorage.setItem(key, JSON.stringify([...set]));
  } catch (e) {
    // 忽略
  }
}