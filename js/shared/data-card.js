// ============================================
// data-card.js — 資料卡片化 renderer（v101）
// 位置：js/shared/data-card.js
// ============================================
// 用途：
//   將資料陣列渲染成「卡片列表」或「表格」
//   配合 view-toggle.js 實現雙模式切換
//
// 兩種使用方式：
//
// 【方式 1】純 CSS 卡片化（推薦，最省事）
//   renderDataTable(container, items, columns) → 產出 table.mobile-cards
//   手機版自動由 utilities.css 的 .data-table.mobile-cards 卡片化
//
// 【方式 2】JS 雙模式（真正兩套 DOM）
//   renderDataCards() 卡片 + renderDataTable() 表格
//   配合 view-toggle 切換容器顯示
//
// 欄位定義（column）：
//   {
//     key: 'memberId',              // 資料欄位名
//     label: '成員',                // 顯示名稱
//     primary: true,                // 卡片模式：主要欄位（大字）
//     hideMobile: false,            // 手機版隱藏
//     type: 'text'|'number'|'badge'|'date',
//     format: (val, row) => str,    // 自訂格式化
//     render: (val, row) => str,    // 完全自訂 HTML（優先於 format）
//     align: 'left'|'right'|'center',
//     width: '100px',               // 桌面表格欄寬
//     cssClass: 'custom-class',
//   }
// ============================================

import { escapeHtml, formatHKD, formatNumber } from '../core/utils.js';

/* ============================================
   主函式：渲染表格（支援手機卡片化）
   ============================================ */

/**
 * 渲染資料表格
 * 手機版自動套用 .mobile-cards 卡片化（純 CSS）
 *
 * @param {string|HTMLElement} container - 容器 ID 或元素
 * @param {Array} items - 資料陣列
 * @param {Array} columns - 欄位定義
 * @param {Object} [options]
 * @param {string} [options.emptyText='尚無資料']
 * @param {boolean} [options.mobileCards=true] - 是否套用手機卡片化
 * @param {Function} [options.rowClass] - (row, i) => string
 * @returns {Object} { container, table, tbody }
 */
export function renderDataTable(container, items, columns, options = {}) {
  const {
    emptyText = '尚無資料',
    mobileCards = true,
    rowClass,
  } = options;

  const root = _resolveElement(container);
  if (!root) {
    console.warn('⚠️ renderDataTable: 找不到容器', container);
    return null;
  }

  const mobileClass = mobileCards ? ' mobile-cards' : '';

  if (!items || items.length === 0) {
    root.innerHTML = `<div class="empty-state">${escapeHtml(emptyText)}</div>`;
    return { container: root, table: null, tbody: null };
  }

  // 產出 thead
  const theadHtml = `
    <thead>
      <tr>
        ${columns.map((col) => {
          const cls = _thClass(col);
          const style = col.width ? `style="width:${col.width};"` : '';
          return `<th class="${cls}" ${style}>${escapeHtml(col.label)}</th>`;
        }).join('')}
      </tr>
    </thead>
  `;

  // 產出 tbody
  const tbodyHtml = `
    <tbody>
      ${items.map((row, i) => _renderTableRow(row, i, columns, rowClass)).join('')}
    </tbody>
  `;

  root.innerHTML = `
    <div style="overflow-x:auto;">
      <table class="data-table${mobileClass}">
        ${theadHtml}
        ${tbodyHtml}
      </table>
    </div>
  `;

  return {
    container: root,
    table: root.querySelector('table'),
    tbody: root.querySelector('tbody'),
  };
}

/* ============================================
   主函式：渲染卡片列表
   ============================================ */

/**
 * 渲染卡片列表
 *
 * @param {string|HTMLElement} container - 容器 ID 或元素
 * @param {Array} items - 資料陣列
 * @param {Array} columns - 欄位定義
 * @param {Object} [options]
 * @param {string} [options.emptyText='尚無資料']
 * @param {string} [options.gridClass='grid grid-3'] - 外層 grid class
 * @param {Function} [options.rowClass] - (row, i) => string
 * @param {Function} [options.cardFooter] - (row, i) => string 卡片底部按鈕區 HTML
 * @returns {Object} { container, cards }
 */
export function renderDataCards(container, items, columns, options = {}) {
  const {
    emptyText = '尚無資料',
    gridClass = 'grid grid-3',
    rowClass,
    cardFooter,
  } = options;

  const root = _resolveElement(container);
  if (!root) {
    console.warn('⚠️ renderDataCards: 找不到容器', container);
    return null;
  }

  if (!items || items.length === 0) {
    root.innerHTML = `<div class="empty-state">${escapeHtml(emptyText)}</div>`;
    return { container: root, cards: [] };
  }

  const cardsHtml = items.map((row, i) => {
    const extraCls = rowClass ? (rowClass(row, i) || '') : '';
    return _renderCard(row, i, columns, extraCls, cardFooter);
  }).join('');

  root.innerHTML = `<div class="${gridClass}">${cardsHtml}</div>`;

  return {
    container: root,
    cards: root.querySelectorAll('.data-card'),
  };
}

/* ============================================
   主函式：雙模式渲染（配合 view-toggle）
   ============================================ */

/**
 * 同時渲染卡片與表格，並依當前 view 切換顯示
 * 需先使用 view-toggle.js 的 initViewToggle
 *
 * 用法：
 *   <div id="card-view" data-view-card-only></div>
 *   <div id="table-view" data-view-table-only></div>
 *
 *   renderDataDual({
 *     cardContainerId: 'card-view',
 *     tableContainerId: 'table-view',
 *     items, columns, options
 *   });
 *
 * @param {Object} params
 * @param {string} params.cardContainerId
 * @param {string} params.tableContainerId
 * @param {Array} params.items
 * @param {Array} params.columns
 * @param {Object} [params.options] - 傳給兩個 render 的共用選項
 */
export function renderDataDual({ cardContainerId, tableContainerId, items, columns, options = {} }) {
  if (cardContainerId) {
    renderDataCards(cardContainerId, items, columns, {
      gridClass: options.cardGridClass || 'grid grid-3',
      emptyText: options.emptyText,
      rowClass: options.rowClass,
      cardFooter: options.cardFooter,
    });
  }
  if (tableContainerId) {
    renderDataTable(tableContainerId, items, columns, {
      emptyText: options.emptyText,
      mobileCards: options.mobileCards !== false,
      rowClass: options.rowClass,
    });
  }
}

/* ============================================
   內部：表格 row
   ============================================ */

function _renderTableRow(row, i, columns, rowClassFn) {
  const extraCls = rowClassFn ? (rowClassFn(row, i) || '') : '';
  return `
    <tr class="${extraCls}" data-row-index="${i}">
      ${columns.map((col) => _renderTableCell(row, col)).join('')}
    </tr>
  `;
}

function _renderTableCell(row, col) {
  const val = row[col.key];
  const classes = [];
  if (col.align === 'right' || col.type === 'number') classes.push('num');
  if (col.hideMobile) classes.push('hide-mobile');
  if (col.cssClass) classes.push(col.cssClass);

  // 卡片化需要的 data-label（手機版顯示）
  const dataLabel = col.label ? `data-label="${escapeHtml(col.label)}"` : '';
  const dataPrimary = col.primary ? 'data-primary="1"' : '';

  const content = _renderCellContent(val, row, col);

  return `<td class="${classes.join(' ')}" ${dataLabel} ${dataPrimary}>${content}</td>`;
}

/* ============================================
   內部：卡片
   ============================================ */

function _renderCard(row, i, columns, extraCls, cardFooterFn) {
  // 主要欄位（大字）
  const primaryCols = columns.filter((c) => c.primary);
  const secondaryCols = columns.filter((c) => !c.primary && c.key);

  const primaryHtml = primaryCols.length > 0
    ? primaryCols.map((col) => {
      const val = row[col.key];
      const content = _renderCellContent(val, row, col);
      return `
        <div class="data-card-primary">
          ${content}
        </div>
      `;
    }).join('')
    : '';

  const secondaryHtml = secondaryCols.length > 0
    ? `
      <div class="data-card-fields">
        ${secondaryCols.map((col) => {
          const val = row[col.key];
          const content = _renderCellContent(val, row, col);
          return `
            <div class="data-card-field">
              <span class="data-card-label">${escapeHtml(col.label)}</span>
              <span class="data-card-value">${content}</span>
            </div>
          `;
        }).join('')}
      </div>
    `
    : '';

  const footerHtml = cardFooterFn ? cardFooterFn(row, i) : '';

  return `
    <div class="glass-card data-card ${extraCls}" data-row-index="${i}">
      ${primaryHtml}
      ${secondaryHtml}
      ${footerHtml ? `<div class="data-card-footer">${footerHtml}</div>` : ''}
    </div>
  `;
}

/* ============================================
   內部：儲存格內容
   ============================================ */

function _renderCellContent(val, row, col) {
  // 1. render 完全自訂（優先）
  if (typeof col.render === 'function') {
    const html = col.render(val, row);
    return html == null ? '' : String(html);
  }

  // 2. format 自訂格式化
  if (typeof col.format === 'function') {
    const str = col.format(val, row);
    return str == null ? '' : escapeHtml(String(str));
  }

  // 3. 依 type 處理
  if (val == null || val === '') {
    return '<span class="text-muted">—</span>';
  }

  switch (col.type) {
    case 'number':
      return formatHKD(val);
    case 'number-plain':
      return formatNumber(val);
    case 'badge':
      return `<span class="badge badge-info">${escapeHtml(val)}</span>`;
    case 'date':
      return escapeHtml(String(val));
    case 'text':
    default:
      return escapeHtml(String(val));
  }
}

/* ============================================
   內部：class 輔助
   ============================================ */

function _thClass(col) {
  const classes = [];
  if (col.align === 'right' || col.type === 'number') classes.push('num');
  if (col.hideMobile) classes.push('hide-mobile');
  if (col.cssClass) classes.push(col.cssClass);
  return classes.join(' ');
}

function _resolveElement(target) {
  if (typeof target === 'string') return document.getElementById(target);
  if (target instanceof HTMLElement) return target;
  return null;
}