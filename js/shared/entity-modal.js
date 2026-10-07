// ============================================
// entity-modal.js — 通用實體編輯 Modal（v101.5 🆕）
// 位置：js/shared/entity-modal.js
// ============================================
// 職責：
//   提供全站統一的「新增 / 編輯」Modal。
//   所有呼叫端只需呼叫 openEntityModal，不自行建立 Modal DOM。
//
// 內部流程：
//   1. 從 entity-definitions.js 讀取 entity 定義
//   2. 用 form-builder.js 建立表單
//   3. 用 modal.js 開啟 Modal
//   4. 提交時呼叫 entity-helpers.js 的 createEntity / updateEntity
//   5. 成功 → Toast + onSuccess + 關閉
//
// 使用範例：
//   import { openEntityModal } from '../shared/entity-modal.js';
//
//   await openEntityModal({
//     entity: 'bank',
//     mode: 'add',
//     onSuccess: () => refresh(),
//   });
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
 * @param {Object} [options.initialData] - 預填資料（edit 時通常不用傳）
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

  // 建立 / 重設 Modal DOM
  _ensureModal();

  // 設定標題
  const titleEl = document.getElementById(TITLE_ID);
  if (titleEl) {
    const action = mode === 'edit' ? '編輯' : '新增';
    titleEl.textContent = `${action}${def.label}`;
  }

  // 準備初始資料
  let initData = initialData;
  if (mode === 'edit' && id && !initData) {
    // 從 allRows 找
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

  // 開啟 Modal
  openModal(MODAL_ID);

  // 自動聚焦第一個欄位
  setTimeout(() => {
    const firstInput = document.querySelector(`#${FORM_ROOT_ID} input, #${FORM_ROOT_ID} select`);
    if (firstInput) firstInput.focus();
  }, 100);

  return formApi;
}

/* ============================================
   內部工具
   ============================================ */

/**
 * 確保 Modal DOM 存在（不存在則建立，存在則保留）
 */
function _ensureModal() {
  let overlay = document.getElementById(MODAL_ID);
  if (overlay) {
    // 清空表單容器
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

  // 點擊 backdrop 關閉
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeModal(MODAL_ID);
    }
  });
}

/* ============================================
   便利方法
   ============================================ */

/**
 * 關閉實體 Modal
 */
export function closeEntityModal() {
  closeModal(MODAL_ID);
}