// ============================================
// form-builder.js — 通用動態表單建構器（v101.2）
// 位置：js/shared/form-builder.js
// ============================================
// v101.2 修正：
//   ✅ 必填驗證：0 視為有效值（不擋金額 0 / 排序 0）
//   ✅ beforeSubmit 回傳 field 自動加 pd- 前綴（若無前綴）
//   ✅ 支援 idPrefix 選項（統一前綴管理）
//   ✅ 強化必填空值判斷（只擋 '' / null / undefined）
// ============================================

import { escapeHtml } from '../core/utils.js';
import { showToast } from './toast.js';

/* ============================================
   主函式
   ============================================ */

/**
 * 建立動態表單
 * @param {Object} options
 * @param {string} options.containerId - 容器 ID
 * @param {Array} options.fields - 欄位定義
 * @param {string} [options.idPrefix] - 欄位 ID 前綴（自動加在 f.id 前）
 * @param {string} [options.submitText='儲存']
 * @param {string} [options.cancelText='取消']
 * @param {boolean} [options.showCancel=true]
 * @param {boolean} [options.showReset=false]
 * @param {string} [options.resetText='重置']
 * @param {Function} [options.onSubmit] - (data, api) => Promise
 * @param {Function} [options.onCancel] - () => {}
 * @param {Function} [options.onReset] - () => {}
 * @param {Function} [options.beforeSubmit] - (data) => true | string | {field, message}
 * @param {boolean} [options.autoValidate=true] - 是否自動檢查必填
 * @returns {Object|null}
 */
export function buildForm(options) {
  const {
    containerId,
    fields = [],
    idPrefix = '',   // 🆕 v101.2：全域前綴
    submitText = '儲存',
    cancelText = '取消',
    resetText = '重置',
    showCancel = true,
    showReset = false,
    onSubmit,
    onCancel,
    onReset,
    beforeSubmit,
    autoValidate = true,
  } = options;

  const root = document.getElementById(containerId);
  if (!root) {
    console.warn(`⚠️ buildForm: 找不到容器 #${containerId}`);
    return null;
  }

  // 每個欄位的最終 ID（f.id 加上前綴）
  const fieldIdMap = {};
  fields.forEach((f) => {
    if (f.type === 'custom' || f.type === 'hidden') return;
    fieldIdMap[f.id] = idPrefix ? `${idPrefix}${f.id}` : f.id;
  });

  // 產生欄位 HTML
  const fieldsHtml = _renderFields(fields, fieldIdMap);

  // 按鈕列
  const buttons = [];
  if (showReset) {
    buttons.push(`<button type="button" class="btn btn-ghost" data-form-action="reset">${escapeHtml(resetText)}</button>`);
  }
  if (showCancel) {
    buttons.push(`<button type="button" class="btn btn-ghost" data-form-action="cancel">${escapeHtml(cancelText)}</button>`);
  }
  buttons.push(`<button type="submit" class="btn btn-primary" data-form-action="submit">
    <i data-lucide="check"></i> <span>${escapeHtml(submitText)}</span>
  </button>`);

  root.innerHTML = `
    <form class="form-builder-form" novalidate>
      <div class="form-stack">
        ${fieldsHtml}
      </div>
      <div class="form-builder-actions" style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px;">
        ${buttons.join('')}
      </div>
    </form>
  `;

  const form = root.querySelector('form');
  const submitBtn = form.querySelector('[data-form-action="submit"]');
  const submitBtnLabel = submitBtn.querySelector('span');

  /* ============================================
     內部狀態
     ============================================ */
  let _submitting = false;

  /* ============================================
     事件：Submit
     ============================================ */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (_submitting) return;

    // 清除舊錯誤
    _clearErrors();

    const data = _collectData(fields, fieldIdMap);

    // 自動必填檢查
    if (autoValidate) {
      const error = _validateRequired(fields, data, fieldIdMap);
      if (error) {
        _showFieldError(error.field, error.message, fieldIdMap);
        showToast(error.message, 'warning');
        const el = document.getElementById(error.field);
        if (el) el.focus();
        return;
      }
    }

    // 自訂驗證
    if (typeof beforeSubmit === 'function') {
      const result = beforeSubmit(data);
      if (result === false) return;
      if (typeof result === 'string') {
        showToast(result, 'warning');
        return;
      }
      if (result && result.field && result.message) {
        // 🆕 v101.2：自動加前綴（若回傳的 field 是「原始 id」）
        const resolvedField = fieldIdMap[result.field] || result.field;
        _showFieldError(resolvedField, result.message, fieldIdMap);
        showToast(result.message, 'warning');
        return;
      }
    }

    if (typeof onSubmit !== 'function') return;

    // 送出
    _setSubmitting(true);
    try {
      await onSubmit(data, api);
    } catch (err) {
      console.error('[form-builder] 送出失敗：', err);
      showToast('送出失敗：' + (err.message || err), 'error');
    } finally {
      _setSubmitting(false);
    }
  });

  /* ============================================
     事件：按鈕列
     ============================================ */
  form.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-form-action]');
    if (!btn) return;
    const action = btn.dataset.formAction;

    if (action === 'cancel' && typeof onCancel === 'function') {
      onCancel();
    } else if (action === 'reset') {
      form.reset();
      _clearErrors();
      if (typeof onReset === 'function') onReset();
    }
  });

  /* ============================================
     內部方法
     ============================================ */
  function _setSubmitting(isSubmitting) {
    _submitting = isSubmitting;
    submitBtn.disabled = isSubmitting;
    if (submitBtnLabel) {
      submitBtnLabel.textContent = isSubmitting ? '處理中…' : submitText;
    }
  }

  function _clearErrors() {
    form.querySelectorAll('.field-error').forEach((el) => el.remove());
    form.querySelectorAll('.field.has-error').forEach((el) => {
      el.classList.remove('has-error');
    });
  }

  function _showFieldError(fieldId, message, map) {
    // 若 fieldId 是原始 id（無前綴），轉成最終 id
    const resolvedId = map && map[fieldId] ? map[fieldId] : fieldId;
    const el = document.getElementById(resolvedId);
    if (!el) return;
    const fieldEl = el.closest('.field');
    if (!fieldEl) return;
    fieldEl.classList.add('has-error');

    // 移除舊錯誤訊息
    const old = fieldEl.querySelector('.field-error');
    if (old) old.remove();

    // 加入錯誤訊息
    const errorDiv = document.createElement('div');
    errorDiv.className = 'field-error';
    errorDiv.style.cssText = 'color:var(--neon-red); font-size:11px; margin-top:4px;';
    errorDiv.textContent = message;
    fieldEl.appendChild(errorDiv);
  }

  /* ============================================
     對外 API
     ============================================ */
  const api = {
    root,
    form,

    /**
     * 取得表單資料（key 為「原始 f.id」，不含前綴）
     */
    getData: () => _collectData(fields, fieldIdMap),

    /**
     * 設定表單資料（key 可為「原始 f.id」或「最終 id」）
     */
    setData: (data) => {
      Object.entries(data || {}).forEach(([k, v]) => {
        // 優先嘗試「最終 id」，其次「原始 id」
        const resolvedId = fieldIdMap[k] || k;
        const el = document.getElementById(resolvedId);
        if (!el) return;
        if (el.type === 'checkbox') {
          el.checked = !!v;
        } else {
          el.value = v ?? '';
        }
      });
    },

    /**
     * 設定單一欄位值（key 可為「原始 f.id」或「最終 id」）
     */
    setFieldValue: (fieldId, value) => {
      const resolvedId = fieldIdMap[fieldId] || fieldId;
      const el = document.getElementById(resolvedId);
      if (!el) return;
      if (el.type === 'checkbox') {
        el.checked = !!value;
      } else {
        el.value = value ?? '';
      }
    },

    /**
     * 取得單一欄位值（key 可為「原始 f.id」或「最終 id」）
     */
    getFieldValue: (fieldId) => {
      const resolvedId = fieldIdMap[fieldId] || fieldId;
      const el = document.getElementById(resolvedId);
      if (!el) return null;
      if (el.type === 'checkbox') return el.checked;
      if (el.type === 'number') {
        const n = Number(el.value);
        return isNaN(n) ? 0 : n;
      }
      return el.value;
    },

    /**
     * 取得欄位 DOM（key 可為「原始 f.id」或「最終 id」）
     */
    getFieldEl: (fieldId) => {
      const resolvedId = fieldIdMap[fieldId] || fieldId;
      return document.getElementById(resolvedId);
    },

    /**
     * 重設表單
     */
    reset: () => {
      form.reset();
      _clearErrors();
      if (typeof onReset === 'function') onReset();
    },

    /**
     * 顯示欄位錯誤（fieldId 可為原始 id）
     */
    setError: (fieldId, message) => {
      _showFieldError(fieldId, message, fieldIdMap);
    },

    /**
     * 清除所有錯誤
     */
    clearErrors: _clearErrors,

    /**
     * 動態更新 select 選項
     */
    updateOptions: (fieldId, options, config = {}) => {
      const resolvedId = fieldIdMap[fieldId] || fieldId;
      const el = document.getElementById(resolvedId);
      if (!el) return;
      const { includeEmpty = true, emptyText = '— 請選擇 —' } = config;
      const cur = el.value;
      let html = includeEmpty ? `<option value="">${escapeHtml(emptyText)}</option>` : '';
      html += options.map((o) =>
        `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`
      ).join('');
      el.innerHTML = html;
      if (cur && options.some((o) => String(o.value) === cur)) el.value = cur;
    },

    /**
     * 綁定欄位變更（fieldId 可為原始 id）
     */
    onFieldChange: (fieldId, callback) => {
      const resolvedId = fieldIdMap[fieldId] || fieldId;
      const el = document.getElementById(resolvedId);
      if (el) el.addEventListener('change', callback);
    },

    /**
     * 手動觸發送出（debug 用）
     */
    submit: () => {
      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    },

    /**
     * 銷毀
     */
    destroy: () => {
      root.innerHTML = '';
    },
  };

  if (window.lucide) window.lucide.createIcons();

  return api;
}

/* ============================================
   欄位渲染
   ============================================ */

function _renderFields(fields, fieldIdMap) {
  const output = [];
  let buffer = [];

  const flushBuffer = () => {
    if (buffer.length === 0) return;
    output.push(`<div class="form-stack-row">${buffer.join('')}</div>`);
    buffer = [];
  };

  fields.forEach((f) => {
    const html = _renderField(f, fieldIdMap);

    if (f.layout === 'half') {
      buffer.push(html);
      if (buffer.length >= 2) flushBuffer();
    } else {
      flushBuffer();
      output.push(html);
    }
  });

  flushBuffer();
  return output.join('');
}

function _renderField(f, fieldIdMap) {
  const {
    type,
    id,
    label,
    required = false,
    placeholder = '',
    options = [],
    min,
    max,
    step,
    disabled = false,
    extraBtn,
    hint,
  } = f;

  // 最終 ID
  const finalId = fieldIdMap[id] || id;

  let inputHtml = '';

  if (type === 'select') {
    let opts = '';
    if (f.includeEmpty !== false) {
      opts += `<option value="">${escapeHtml(f.emptyText || '— 請選擇 —')}</option>`;
    }
    opts += options.map((o) =>
      `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`
    ).join('');
    inputHtml = `<select class="select" id="${finalId}" ${required ? 'required' : ''} ${disabled ? 'disabled' : ''}>${opts}</select>`;
  } else if (type === 'number') {
    const attrs = [
      min != null ? `min="${min}"` : '',
      max != null ? `max="${max}"` : '',
      step != null ? `step="${step}"` : 'step="1"',
    ].filter(Boolean).join(' ');
    inputHtml = `<input class="input mono" id="${finalId}" type="number" ${attrs} ${required ? 'required' : ''} ${disabled ? 'disabled' : ''} placeholder="${escapeHtml(placeholder)}">`;
  } else if (type === 'text') {
    inputHtml = `<input class="input" id="${finalId}" type="text" ${required ? 'required' : ''} ${disabled ? 'disabled' : ''} placeholder="${escapeHtml(placeholder)}" maxlength="${f.maxlength || 60}">`;
  } else if (type === 'textarea') {
    inputHtml = `<textarea class="input" id="${finalId}" ${required ? 'required' : ''} ${disabled ? 'disabled' : ''} placeholder="${escapeHtml(placeholder)}" maxlength="${f.maxlength || 200}" rows="${f.rows || 3}"></textarea>`;
  } else if (type === 'checkbox') {
    return `
      <div class="field" style="display:flex; align-items:center; gap:8px;">
        <input type="checkbox" id="${finalId}" style="width:auto; cursor:pointer;" ${disabled ? 'disabled' : ''}>
        <label for="${finalId}" style="font-size:13px; color:var(--text-secondary); cursor:pointer;">${escapeHtml(label)}</label>
      </div>
    `;
  } else if (type === 'custom') {
    return `<div class="field">${f.html || ''}</div>`;
  } else if (type === 'hidden') {
    return `<input type="hidden" id="${finalId}" value="${escapeHtml(f.value || '')}">`;
  }

  const inputWrapper = extraBtn
    ? `<div style="display:flex; gap:8px;">
         <div style="flex:1;">${inputHtml}</div>
         <button type="button" class="btn btn-sm btn-ghost" id="${finalId}-extra-btn" style="padding:0 12px;" title="${escapeHtml(extraBtn.title || '')}">
           <i data-lucide="${extraBtn.icon || 'plus'}" style="width:16px;height:16px;"></i>
         </button>
       </div>`
    : inputHtml;

  const hintHtml = hint
    ? `<div class="glass-card-hint" style="margin-top:4px;">${escapeHtml(hint)}</div>`
    : '';

  return `
    <div class="field">
      <label class="field-label" for="${finalId}">${escapeHtml(label)}${required ? ' *' : ''}</label>
      ${inputWrapper}
      ${hintHtml}
    </div>
  `;
}

/* ============================================
   資料收集 / 驗證
   ============================================ */

function _collectData(fields, fieldIdMap) {
  const data = {};
  fields.forEach((f) => {
    if (f.type === 'custom') return;
    const finalId = fieldIdMap[f.id] || f.id;
    const el = document.getElementById(finalId);
    if (!el) return;

    if (f.type === 'checkbox') {
      data[f.id] = el.checked;
    } else if (f.type === 'number') {
      const num = Number(el.value);
      // 🆕 空字串 → 0；否則用解析後的數字
      data[f.id] = el.value === '' ? 0 : (isNaN(num) ? 0 : num);
    } else {
      data[f.id] = el.value;
    }
  });
  return data;
}

/**
 * 🆕 v101.2：必填驗證
 * - 空值判斷：只擋 '' / null / undefined
 * - 0 視為有效值（可通過）
 */
function _validateRequired(fields, data, fieldIdMap) {
  for (const f of fields) {
    if (!f.required) continue;
    if (f.type === 'custom' || f.type === 'hidden') continue;

    const val = data[f.id];

    // 🆕 只擋「真空值」
    const isEmpty = val === '' || val === null || val === undefined;

    if (isEmpty) {
      const finalId = fieldIdMap[f.id] || f.id;
      return {
        field: finalId,
        message: `請填寫「${f.label}」`,
      };
    }
  }
  return null;
}
