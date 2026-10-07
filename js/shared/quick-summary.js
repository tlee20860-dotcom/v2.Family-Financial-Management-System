// ============================================
// quick-summary.js — 快速摘要卡（v101）
// 位置：js/shared/quick-summary.js
// ============================================
// 用途：
//   填補頁面底部空白，顯示該頁最相關的速覽資訊
//
// 支援 5 種類型：
//   1. top-categories   本月 Top N 支出類別（水平條）
//   2. recent-activity  最近 N 筆活動
//   3. member-trend     成員近 N 月趨勢
//   4. pending-fixed    本月未付款固定支出
//   5. asset-pie        資產配置圓餅（純 CSS）
//
// 用法：
//   renderQuickSummary({
//     containerId: 'quick-summary-root',
//     type: 'top-categories',
//     data: [...],
//     title: '本月 Top 5 支出類別',
//   });
// ============================================

import { escapeHtml, formatHKD } from '../core/utils.js';
import { QUICK_SUMMARY_TYPES } from '../config/constants.js';

/* ============================================
   主函式
   ============================================ */

/**
 * 渲染快速摘要卡
 * @param {Object} options
 * @param {string} options.containerId - 容器 ID
 * @param {string} options.type - QUICK_SUMMARY_TYPES 之一
 * @param {string} [options.title] - 卡片標題
 * @param {string} [options.icon] - Lucide icon
 * @param {*} options.data - 依 type 不同
 * @param {Function} [options.onClick] - (item) => {} 點擊某列回呼
 * @returns {Object|null}
 */
export function renderQuickSummary(options) {
  const {
    containerId,
    type,
    title,
    icon = 'activity',
    data,
    onClick,
  } = options;

  const root = document.getElementById(containerId);
  if (!root) {
    console.warn(`⚠️ renderQuickSummary: 找不到容器 #${containerId}`);
    return null;
  }

  let titleText = title;
  let bodyHtml = '';

  switch (type) {
    case QUICK_SUMMARY_TYPES.TOP_CATEGORIES:
      titleText = titleText || '熱門類別';
      bodyHtml = _renderTopCategories(data);
      break;
    case QUICK_SUMMARY_TYPES.RECENT_ACTIVITY:
      titleText = titleText || '最近活動';
      bodyHtml = _renderRecentActivity(data);
      break;
    case QUICK_SUMMARY_TYPES.MEMBER_TREND:
      titleText = titleText || '成員趨勢';
      bodyHtml = _renderMemberTrend(data);
      break;
    case QUICK_SUMMARY_TYPES.PENDING_FIXED:
      titleText = titleText || '待處理固定支出';
      bodyHtml = _renderPendingFixed(data);
      break;
    case QUICK_SUMMARY_TYPES.ASSET_PIE:
      titleText = titleText || '資產配置';
      bodyHtml = _renderAssetPie(data);
      break;
    default:
      titleText = titleText || '摘要';
      bodyHtml = '<div class="text-muted text-sm">無摘要資料</div>';
  }

  root.innerHTML = `
    <div class="quick-summary-card">
      <div class="quick-summary-title">
        <i data-lucide="${icon}" style="width:16px;height:16px;"></i>
        <span>${escapeHtml(titleText)}</span>
      </div>
      <div class="quick-summary-list">
        ${bodyHtml}
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  // 綁定點擊
  if (typeof onClick === 'function') {
    root.querySelectorAll('[data-summary-key]').forEach((el) => {
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => {
        onClick(el.dataset.summaryKey, el);
      });
    });
  }

  return { container: root };
}

/**
 * 清除摘要卡
 */
export function clearQuickSummary(containerId) {
  const root = document.getElementById(containerId);
  if (root) root.innerHTML = '';
}

/* ============================================
   1. Top 分類
   ============================================ */

/**
 * @param {Array} data - [{ name, amount, categoryId? }, ...]（已排序，Top N）
 */
function _renderTopCategories(data) {
  const list = (data || []).filter((x) => (Number(x.amount) || 0) > 0);
  if (list.length === 0) {
    return '<div class="text-muted text-sm">本月尚無支出紀錄</div>';
  }

  const max = Math.max(...list.map((x) => Number(x.amount) || 0)) || 1;

  return list.map((x) => {
    const amount = Number(x.amount) || 0;
    const pct = Math.round((amount / max) * 100);
    const key = x.categoryId || x.name;

    return `
      <div class="quick-summary-row" data-summary-key="${escapeHtml(key)}" style="display:block; padding:8px 0;">
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
          <span class="label">${escapeHtml(x.name || '（未命名）')}</span>
          <span class="value">${formatHKD(amount)}</span>
        </div>
        <div class="progress" style="height:6px;">
          <div class="progress-bar" style="width:${pct}%;"></div>
        </div>
      </div>
    `;
  }).join('');
}

/* ============================================
   2. 最近活動
   ============================================ */

/**
 * @param {Array} data - [{ title, subtitle, amount, date, badge? }, ...]
 */
function _renderRecentActivity(data) {
  const list = (data || []).slice(0, 5);
  if (list.length === 0) {
    return '<div class="text-muted text-sm">尚無活動紀錄</div>';
  }

  return list.map((x, i) => {
    const key = x.key || `act-${i}`;
    const badgeHtml = x.badge
      ? `<span class="badge badge-info" style="margin-left:6px;">${escapeHtml(x.badge)}</span>`
      : '';
    const amountHtml = x.amount != null
      ? `<span class="value">${formatHKD(x.amount)}</span>`
      : '';

    return `
      <div class="quick-summary-row" data-summary-key="${escapeHtml(key)}">
        <div style="display:flex; flex-direction:column; gap:2px; flex:1; min-width:0;">
          <span class="label" style="color:var(--text-primary); font-weight:500;">
            ${escapeHtml(x.title || '')}${badgeHtml}
          </span>
          ${x.subtitle ? `<span class="label" style="font-size:11px;">${escapeHtml(x.subtitle)}</span>` : ''}
        </div>
        ${amountHtml}
      </div>
    `;
  }).join('');
}

/* ============================================
   3. 成員趨勢（近 N 月）
   ============================================ */

/**
 * @param {Object} data
 * @param {Array} data.months - ['2026-07', '2026-08', '2026-09']
 * @param {Array} data.members - [{ name, values: [100, 200, 300] }, ...]
 */
function _renderMemberTrend(data) {
  if (!data || !data.members || data.members.length === 0) {
    return '<div class="text-muted text-sm">尚無趨勢資料</div>';
  }

  const months = data.months || [];
  const members = data.members;
  const maxVal = Math.max(
    ...members.flatMap((m) => m.values.map((v) => Number(v) || 0)),
    1
  );

  return members.map((m) => {
    const total = m.values.reduce((s, v) => s + (Number(v) || 0), 0);
    const bars = m.values.map((v) => {
      const pct = Math.round(((Number(v) || 0) / maxVal) * 100);
      return `<div style="flex:1; height:20px; background:rgba(0,240,255,0.08); border-radius:3px; position:relative; overflow:hidden;">
        <div style="position:absolute; bottom:0; left:0; right:0; height:${pct}%; background:linear-gradient(180deg, var(--neon-cyan), var(--neon-magenta));"></div>
      </div>`;
    }).join('');

    return `
      <div class="quick-summary-row" style="display:block; padding:8px 0;">
        <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
          <span class="label">${escapeHtml(m.name)}</span>
          <span class="value">${formatHKD(total)}</span>
        </div>
        <div style="display:flex; gap:3px; align-items:flex-end;">${bars}</div>
        <div style="display:flex; justify-content:space-between; font-size:10px; color:var(--text-muted); margin-top:4px;">
          ${months.map((mm) => `<span style="flex:1; text-align:center;">${escapeHtml(mm)}</span>`).join('')}
        </div>
      </div>
    `;
  }).join('');
}

/* ============================================
   4. 待處理固定支出
   ============================================ */

/**
 * @param {Array} data - [{ name, amount, month, status, id }, ...]
 */
function _renderPendingFixed(data) {
  const list = (data || []).filter((x) => x.status !== '已付款' && x.status !== '不適用');
  if (list.length === 0) {
    return '<div class="text-muted text-sm">✅ 本月固定支出全部已處理</div>';
  }

  const total = list.reduce((s, x) => s + (Number(x.amount) || 0), 0);

  const rows = list.slice(0, 5).map((x) => `
    <div class="quick-summary-row" data-summary-key="${escapeHtml(x.id || x.name)}">
      <span class="label">${escapeHtml(x.name || '')}${x.month ? ` · ${escapeHtml(String(x.month))}月` : ''}</span>
      <span class="value" style="color:var(--neon-orange);">${formatHKD(x.amount)}</span>
    </div>
  `).join('');

  const moreHint = list.length > 5
    ? `<div class="text-muted text-xs" style="text-align:center; margin-top:8px;">還有 ${list.length - 5} 筆待處理…</div>`
    : '';

  return `
    ${rows}
    ${moreHint}
    <div class="quick-summary-row" style="border-top:1px solid rgba(255,255,255,0.06); margin-top:8px; padding-top:8px;">
      <span class="label" style="font-weight:600; color:var(--text-primary);">未付款總計</span>
      <span class="value" style="color:var(--neon-orange); font-weight:700;">${formatHKD(total)}</span>
    </div>
  `;
}

/* ============================================
   5. 資產圓餅（純 CSS 條狀）
   ============================================ */

/**
 * @param {Object} data
 * @param {Array} data.items - [{ name, amount, color }, ...]
 */
function _renderAssetPie(data) {
  if (!data || !data.items || data.items.length === 0) {
    return '<div class="text-muted text-sm">尚無資產資料</div>';
  }

  const items = data.items.filter((x) => (Number(x.amount) || 0) > 0);
  if (items.length === 0) {
    return '<div class="text-muted text-sm">尚無資產資料</div>';
  }

  const total = items.reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const defaultColors = [
    'var(--neon-cyan)',
    'var(--neon-magenta)',
    'var(--neon-emerald)',
    'var(--neon-orange)',
    '#818cf8',
  ];

  // 水平堆疊條
  const bar = items.map((x, i) => {
    const pct = (Number(x.amount) / total) * 100;
    const color = x.color || defaultColors[i % defaultColors.length];
    return `<div style="width:${pct}%; height:100%; background:${color};" title="${escapeHtml(x.name)} ${pct.toFixed(1)}%"></div>`;
  }).join('');

  // 圖例
  const legend = items.map((x, i) => {
    const pct = ((Number(x.amount) / total) * 100).toFixed(1);
    const color = x.color || defaultColors[i % defaultColors.length];
    return `
      <div class="quick-summary-row">
        <span class="label" style="display:flex; align-items:center; gap:8px;">
          <span style="display:inline-block; width:10px; height:10px; border-radius:2px; background:${color};"></span>
          ${escapeHtml(x.name)}
          <span style="color:var(--text-muted); font-size:11px;">${pct}%</span>
        </span>
        <span class="value">${formatHKD(x.amount)}</span>
      </div>
    `;
  }).join('');

  return `
    <div style="width:100%; height:12px; border-radius:6px; overflow:hidden; display:flex; margin-bottom:12px; background:rgba(255,255,255,0.04);">
      ${bar}
    </div>
    ${legend}
    <div class="quick-summary-row" style="border-top:1px solid rgba(255,255,255,0.06); margin-top:8px; padding-top:8px;">
      <span class="label" style="font-weight:600; color:var(--text-primary);">總資產</span>
      <span class="value" style="color:var(--neon-emerald); font-weight:700;">${formatHKD(total)}</span>
    </div>
  `;
}

/* ============================================
   便捷：資料輔助產生器
   ============================================ */

/**
 * 從 perMember + categories 產生 Top 分類資料
 * @param {Object} perMember - { memberId: { items: [...] } }
 * @param {Array} categories - [{ id, name }]
 * @param {number} [topN=5]
 * @returns {Array}
 */
export function buildTopCategoriesData(perMember, categories, topN = 5) {
  const catMap = {};
  categories.forEach((c) => { catMap[c.id] = c.name; });

  const totals = {};
  Object.values(perMember || {}).forEach((m) => {
    (m.items || []).forEach((it) => {
      const catId = it.categoryId || '__none__';
      const catName = catMap[catId] || '（未分類）';
      if (!totals[catId]) totals[catId] = { categoryId: catId, name: catName, amount: 0 };
      totals[catId].amount += Number(it.amount) || 0;
    });
  });

  return Object.values(totals)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, topN);
}

/**
 * 產生「最近活動」資料（從多個來源混合）
 * @param {Object} params
 * @param {Array} [params.expenses]
 * @param {Array} [params.fixedExpenses]
 * @param {Array} [params.incomes]
 * @param {number} [limit=5]
 * @returns {Array}
 */
export function buildRecentActivityData({ expenses = [], fixedExpenses = [], incomes = [] }, limit = 5) {
  const activities = [];

  expenses.forEach((e) => {
    activities.push({
      key: e.id,
      title: e.name || '支出',
      subtitle: e.date || '',
      amount: -(Number(e.amount) || 0),
      badge: e.isAutoLinked ? '保險' : '',
      _ts: e.createdAt || 0,
    });
  });

  fixedExpenses.forEach((f) => {
    activities.push({
      key: f.id,
      title: f.name || '固定支出',
      subtitle: f.paidDate || '',
      amount: -(Number(f.amount) || 0),
      badge: '固定',
      _ts: f.createdAt || 0,
    });
  });

  Object.entries(incomes || {}).forEach(([memberId, amount]) => {
    activities.push({
      key: `income-${memberId}`,
      title: memberId === 'extra' ? '額外收入' : `收入（${memberId}）`,
      subtitle: '',
      amount: Number(amount) || 0,
      badge: '收入',
      _ts: 0,
    });
  });

  return activities
    .sort((a, b) => b._ts - a._ts)
    .slice(0, limit)
    .map(({ _ts, ...rest }) => rest);
}