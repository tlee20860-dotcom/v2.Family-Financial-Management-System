// ============================================
// detail-block.js — 明細展開區 Block（v103.0.0）
// 位置：js/blocks/detail-block.js
// ============================================
// 職責：
//   1. 依 row 表達式渲染單筆明細
//   2. row 為 null 時顯示空狀態
//   3. 支援巢狀欄位網格顯示
//
// Block 定義：
//   {
//     type: 'detail',
//     container: 'xxx-detail',
//     row: '$.selectedRow',                 // 表達式（必填）
//     fields: [                              // 顯示欄位
//       { label: '名稱', key: 'name' },
//       { label: '金額', key: 'amount', type: 'number' },
//       { label: '狀態', key: 'status', resolver: (val, row) => html },
//     ],
//     emptyText: '請選擇一筆資料',
//     title: '$.selectedRow.name',           // 選填，標題
//   }
// ============================================

import { esc } from '../lib/dom.js';
import { formatCellValue } from '../lib/format.js';
import { resolveExpr } from '../engines/render-engine.js';

/* ============================================
   mount
   ============================================ */
export function mount(block, ctx) {
  const container = document.getElementById(block.container);
  if (!container) {
    console.warn(`[detail-block] 找不到容器 #${block.container}`);
    return { onDepsChange: () => {}, destroy: () => {} };
  }

  function render() {
    const row = _resolveRow(block, ctx);

    if (row == null) {
      _renderEmpty(container, block.emptyText || '請選擇一筆資料');
      return;
    }

    const title = _resolveTitle(block, ctx, row);
    const fields = block.fields || [];

    container.innerHTML = `
      <div style="padding:12px 0;">
        ${title ? `<div style="font-size:15px; font-weight:700; color:var(--neon-cyan); margin-bottom:12px;">${esc(title)}</div>` : ''}
        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(160px, 1fr)); gap:8px 20px; font-size:13px;">
          ${fields.map((f) => _renderField(f, row)).join('')}
        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
  }

  function onDepsChange() {
    render();
  }

  function destroy() {
    container.innerHTML = '';
  }

  /* 首次渲染 */
  render();

  return { onDepsChange, destroy };
}

/* ============================================
   欄位渲染
   ============================================ */
function _renderField(field, row) {
  const val = row[field.key];
  let content;

  if (typeof field.resolver === 'function') {
    try {
      content = field.resolver(val, row);
    } catch (err) {
      console.error(`[detail-block] resolver 失敗 [${field.key}]：`, err);
      content = '—';
    }
  } else {
    content = formatCellValue(val, field.type);
  }

  return `
    <div>
      <div style="font-size:11px; color:var(--text-muted); margin-bottom:2px;">${esc(field.label || field.key)}</div>
      <div style="color:var(--text-primary);">${content}</div>
    </div>
  `;
}

/* ============================================
   空狀態
   ============================================ */
function _renderEmpty(container, text) {
  container.innerHTML = `
    <div class="empty-state" style="padding:24px;">${esc(text)}</div>
  `;
}

/* ============================================
   解析 row / title
   ============================================ */
function _resolveRow(block, ctx) {
  if (!block.row) return null;
  if (typeof block.row === 'string') {
    try {
      return resolveExpr(block.row, ctx);
    } catch (e) {
      return null;
    }
  }
  if (typeof block.row === 'object') return block.row;
  return null;
}

function _resolveTitle(block, ctx, row) {
  if (block.title) {
    if (typeof block.title === 'string') {
      try {
        const resolved = resolveExpr(block.title, ctx);
        if (resolved != null) return String(resolved);
      } catch (e) { /* noop */ }
    }
    return String(block.title);
  }

  /* 若 row 有 name 或 title 屬性，自動使用 */
  if (row.name) return String(row.name);
  if (row.title) return String(row.title);
  return '';
}
