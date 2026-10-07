// ============================================
// entity-modal.js — 通用實體編輯 Modal（v101.6）
// 位置：js/shared/entity-modal.js
// ============================================
// v101.6 修正：
//   ✅ 新增 openEntityAddModal（簡化新增）
//   ✅ 新增 openEntityEditModal（簡化編輯）
//   ✅ 支援 initialData
//   ✅ 支援 onSuccess / onCancel
//   ✅ 移除 fixedTemplate 相關處理
//
// API 凍結：v101.6 發布後只加不改
// ============================================

import { buildForm } from './form-builder.js';
import { openModal, closeModal } from './modal.js';
import { showToast } from './toast.js';
import {
  createEntity,
  updateEntity,
  buildInitialData,
  getFieldDefaults,
} from './entity-helpers.js';
import { getEntityDef } from '../config/entity-definitions.js';
import { escapeHtml } from '../core/utils.js';

/* ============================================
   常數
   ============================================ */
const MODAL_ID = 'entity-modal-root';
const FORM_ROOT_ID = 'entity-modal-form-root';
const TITLE_ID = 'entity-modal-title';

/* ============================================
   主函式
   ============================================ */

/**
 * 開啟實體編輯 Modal
 * @param {Object} options
 * @param {string} options.entity - entityKey
 * @param {'add'|'edit'} options.mode
 * @param {string} [options.id] - edit 時必填
 * @param {Object} [options.initialData] - 預填資料
 * @param {Array} [options.allRows] - 現有資料（供 validate 用）
 * @param {Function} [options.onSuccess] - (result) => {}
 * @param {Function} [options.onCancel] - () => {}
 * @returns {Promise<Object|null>}
 */
export async function openEntityModal(options) {
  const {
    entity,
    mode = 'add',
    id = null,
    initialData = null,
    allRows = [],
    onSuccess,
    onCancel,
  } = options;

  const def = getEntityDef(entity);
  if (!def) {
    showToast(`未知的實體：${entity}`, 'error');
    return null;
  }

  _ensureModal();

  const titleEl = document.getElementById(TITLE_ID);
  if (titleEl) {
    const action = mode === 'edit' ? '編輯' : '新增';
    titleEl.textContent = `${action}${def.label}`;
  }

  // 準備初始資料
  let initData = initialData;
  if (mode === 'edit' && id && !initData) {
    const row = allRows.find((r) => r.id === id);
    if (row) initData = buildInitialData(entity, row);
  }
  if (mode === 'add' && !initData) {
    initData = getFieldDefaults(entity);
  }

  // 建立表單
  const formApi = buildForm({
    containerId: FORM_ROOT_ID,
    idPrefix: 'em-',
    fields: def.fields,
    submitText: mode === 'edit' ? '儲存' : `新增${def.label}`,
    showCancel: true,
    cancelText: '取消',
    initialData: initData,
    beforeSubmit: (data) => {
      if (def.validate) {
        const err = def.validate(data, allRows, id);
        if (err) return err;
      }
      return true;
    },
    onSubmit: async (data) => {
      try {
        let result;
        if (mode === 'edit' && id) {
          await updateEntity(entity, id, data, allRows);
          result = { id, data };
          showToast(`✅ 已更新${def.label}`, 'success');
        } else {
          const newId = await createEntity(entity, data, allRows);
          result = { id: newId, data };
          showToast(`✅ 已新增${def.label}`, 'success');
        }
        closeModal(MODAL_ID);
        if (typeof onSuccess === 'function') onSuccess(result);
      } catch (err) {
        console.error('[entity-modal] 提交失敗：', err);
        showToast('操作失敗：' + (err.message || err), 'error');
      }
    },
    onCancel: () => {
      closeModal(MODAL_ID);
      if (typeof onCancel === 'function') onCancel();
    },
  });

  openModal(MODAL_ID);

  setTimeout(() => {
    const firstInput = document.querySelector(`#${FORM_ROOT_ID} input, #${FORM_ROOT_ID} select`);
    if (firstInput) firstInput.focus();
  }, 100);

  return formApi;
}

/* ============================================
   便利函式
   ============================================ */

/**
 * 開啟「新增」Modal
 */
export function openEntityAddModal(entity, options = {}) {
  return openEntityModal({
    entity,
    mode: 'add',
    ...options,
  });
}

/**
 * 開啟「編輯」Modal
 */
export function openEntityEditModal(entity, id, options = {}) {
  return openEntityModal({
    entity,
    mode: 'edit',
    id,
    ...options,
  });
}

/**
 * 關閉實體 Modal
 */
export function closeEntityModal() {
  closeModal(MODAL_ID);
}

/* ============================================
   內部工具
   ============================================ */

function _ensureModal() {
  let overlay = document.getElementById(MODAL_ID);
  if (overlay) {
    const formRoot = document.getElementById(FORM_ROOT_ID);
    if (formRoot) formRoot.innerHTML = '';
    return;
  }

  overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = MODAL_ID;
  overlay.innerHTML = `
    <div class="modal" style="max-width:560px; max-height:90vh; overflow-y:auto;">
      <h2 class="modal-title" id="${TITLE_ID}">編輯</h2>
      <div id="${FORM_ROOT_ID}"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeModal(MODAL_ID);
    }
  });
}