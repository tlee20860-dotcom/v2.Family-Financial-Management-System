// ============================================
// form-block.js — 表單 Modal 區 Block（v103.0.0）
// 位置：js/blocks/form-block.js
// ============================================
// 職責：
//   1. 提供「新增」按鈕，點擊開啟 entity-modal
//   2. 支援「編輯」按鈕（透過 block.editFrom = '$.selectedRow'）
//   3. 成功後呼叫 ctx.invalidate() 重算
//
// Block 定義：
//   {
//     type: 'form',
//     container: 'xxx-form',
//     entity: 'member',                // entityKey（必填）
//     mode: 'add' | 'edit',            // 預設 add
//     editRow: '$.selectedRow',        // edit 模式用：表達式指向 row
//     buttonLabel: '新增成員',
//     buttonClass: 'btn-primary',
//     icon: 'plus',
//     allRows: '$.filtered',            // 供 validate 用
//   }
// ============================================

import { esc } from '../lib/dom.js';
import { resolveExpr } from '../engines/render-engine.js';
import { openEntityModal } from '../entity/entity-modal.js';
import { getEntityDef } from '../entity/entity-definitions.js';
import { AppState } from '../core/state.js';

/* ============================================
   mount
   ============================================ */
export function mount(block, ctx) {
  const container = document.getElementById(block.container);
  if (!container) {
    console.warn(`[form-block] 找不到容器 #${block.container}`);
    return { onDepsChange: () => {}, destroy: () => {} };
  }

  const def = getEntityDef(block.entity);
  if (!def) {
    console.warn(`[form-block] 未知的 entity：${block.entity}`);
    return { onDepsChange: () => {}, destroy: () => {} };
  }

  let _clickHandler = null;

  function render() {
    const mode = block.mode || 'add';
    const userCanInput = AppState.getCanInput();

    if (!userCanInput) {
      container.innerHTML = '';
      return;
    }

    if (mode === 'edit') {
      const row = _resolveEditRow(block, ctx);
      if (row == null) {
        container.innerHTML = '';
        return;
      }
    }

    const label = block.buttonLabel || `${mode === 'edit' ? '編輯' : '新增'}${def.label}`;
    const cls = block.buttonClass || 'btn-primary';
    const icon = block.icon || (mode === 'edit' ? 'pencil' : 'plus');

    container.innerHTML = `
      <button type="button" class="btn ${esc(cls)}" data-form-action="open">
        <i data-lucide="${esc(icon)}"></i> ${esc(label)}
      </button>
    `;

    bindEvents();

    if (window.lucide) window.lucide.createIcons();
  }

  function bindEvents() {
    if (_clickHandler) {
      container.removeEventListener('click', _clickHandler);
    }

    _clickHandler = async (e) => {
      const btn = e.target.closest('button[data-form-action="open"]');
      if (!btn) return;
      e.preventDefault();
      await _openModal(block, ctx);
    };

    container.addEventListener('click', _clickHandler);
  }

  function onDepsChange() {
    render();
  }

  function destroy() {
    if (_clickHandler) {
      container.removeEventListener('click', _clickHandler);
      _clickHandler = null;
    }
    container.innerHTML = '';
  }

  /* 首次渲染 */
  render();

  return { onDepsChange, destroy };
}

/* ============================================
   開啟 Modal
   ============================================ */
async function _openModal(block, ctx) {
  const mode = block.mode || 'add';
  const allRows = _resolveAllRows(block, ctx);

  let id = null;
  let initialData = null;

  if (mode === 'edit') {
    const row = _resolveEditRow(block, ctx);
    if (!row) return;
    id = row.id;
  }

  await openEntityModal({
    entity: block.entity,
    mode,
    id,
    initialData,
    allRows,
    onSuccess: () => {
      /* 觸發重算（若 ctx 提供 invalidate） */
      try {
        if (typeof ctx.invalidate === 'function') {
          ctx.invalidate('__form_saved__');
        }
      } catch (err) {
        console.warn('[form-block] invalidate 失敗：', err);
      }
    },
  });
}

/* ============================================
   工具
   ============================================ */
function _resolveEditRow(block, ctx) {
  if (!block.editRow) {
    /* fallback：從 ctx.state.selectedRow 取 */
    try {
      return ctx.state?.selectedRow || null;
    } catch (e) {
      return null;
    }
  }

  if (typeof block.editRow === 'string') {
    try {
      return resolveExpr(block.editRow, ctx);
    } catch (e) {
      return null;
    }
  }

  if (typeof block.editRow === 'object') return block.editRow;
  return null;
}

function _resolveAllRows(block, ctx) {
  if (!block.allRows) return [];
  if (typeof block.allRows === 'string') {
    try {
      const resolved = resolveExpr(block.allRows, ctx);
      return Array.isArray(resolved) ? resolved : [];
    } catch (e) {
      return [];
    }
  }
  if (Array.isArray(block.allRows)) return block.allRows;
  return [];
}
