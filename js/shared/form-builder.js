// ============================================
// form-builder.js — 通用動態表單建構器（v101）
// 位置：js/shared/form-builder.js
// ============================================
// 用途：
//   在 Tab 內、Modal 內、卡片內動態產生表單
//   與 input-form.js 的差異：
//     - input-form.js → 外層附可摺疊卡片（用於「新增」表單）
//     - form-builder.js → 只產生 <form> 主體（用於 Tab 內切換、Modal 內）
//
// 用法：
//   const builder = buildForm({
//     containerId: 'edit-form-root',
//     fields: [...],
//     submitText: '儲存',
//     cancelText: '取消',
//     onSubmit: async (data) => { ... },
//     onCancel: () => { ... },
//   });
//   builder.setData({ name: 'xxx' });
//   builder.getData();
//   builder.reset();
//   builder.setFieldValue('name', 'yyy');
//   builder.setError('amount', '金額必須大於 0');
//   builder.clearErrors();
//   builder.destroy();
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

  // 產生欄位 HTML
  const fieldsHtml = _renderFields(fields);

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

    const data = _collectData(fields);

    // 自動必填檢查
    if (autoValidate) {
      const error = _validateRequired(fields, data);
      if (error) {
        _showFieldError(error.field, error.message);
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
        _showFieldError(result.field, result.message);
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

  function _showFieldError(fieldId, message) {
    const el = document.getElementById(fieldId);
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
     * 取得表單資料
     */
    getData: () => _collectData(fields),

    /**
     * 設定表單資料
     */
    setData: (data) => {
      Object.entries(data || {}).forEach(([k, v]) => {
        const el = document.getElementById(k);
        if (!el) return;
        if (el.type === 'checkbox') {
          el.checked = !!v;
        } else {
          el.value = v ?? '';
        }
      });
    },

    /**
     * 設定單一欄位值
     */
    setFieldValue: (fieldId, value) => {
      const el = document.getElementById(fieldId);
      if (!el) return;
      if (el.type === 'checkbox') {
        el.checked = !!value;
      } else {
        el.value = value ?? '';
      }
    },

    /**
     * 取得單一欄位值
     */
    getFieldValue: (fieldId) => {
      const el = document.getElementById(fieldId);
      if (!el) return null;
      if (el.type === 'checkbox') return el.checked;
      if (el.type === 'number') {
        const n = Number(el.value);
        return isNaN(n) ? 0 : n;
      }
      return el.value;
    },

    /**
     * 取得欄位 DOM
     */
    getFieldEl: (fieldId) => document.getElementById(fieldId),

    /**
     * 重設表單
     */
    reset: () => {
      form.reset();
      _clearErrors();
      if (typeof onReset === 'function') onReset();
    },

    /**
     * 顯示欄位錯誤
     */
    setError: (fieldId, message) => {
      _showFieldError(fieldId, message);
    },

    /**
     * 清除所有錯誤
     */
    clearErrors: _clearErrors,

    /**
     * 動態更新 select 選項
     */
    updateOptions: (fieldId, options, config = {}) => {
      const el = document.getElementById(fieldId);
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
     * 綁定欄位變更
     */
    onFieldChange: (fieldId, callback) => {
      const el = document.getElementById(fieldId);
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
   欄位渲染（與 input-form.js 邏輯一致）
   ============================================ */

function _renderFields(fields) {
  const output = [];
  let buffer = [];

  const flushBuffer = () => {
    if (buffer.length === 0) return;
    output.push(`<div class="form-stack-row">${buffer.join('')}</div>`);
    buffer = [];
  };

  fields.forEach((f) => {
    const html = _renderField(f);
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

function _renderField(f) {
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

  let inputHtml = '';

  if (type === 'select') {
    let opts = '';
    if (f.includeEmpty !== false) {
      opts += `<option value="">${escapeHtml(f.emptyText || '— 請選擇 —')}</option>`;
    }
    opts += options.map((o) =>
      `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`
    ).join('');
    inputHtml = `<select class="select" id="${id}" ${required ? 'required' : ''} ${disabled ? 'disabled' : ''}>${opts}</select>`;
  } else if (type === 'number') {
    const attrs = [
      min != null ? `min="${min}"` : '',
      max != null ? `max="${max}"` : '',
      step != null ? `step="${step}"` : 'step="1"',
    ].filter(Boolean).join(' ');
    inputHtml = `<input class="input mono" id="${id}" type="number" ${attrs} ${required ? 'required' : ''} ${disabled ? 'disabled' : ''} placeholder="${escapeHtml(placeholder)}">`;
  } else if (type === 'text') {
    inputHtml = `<input class="input" id="${id}" type="text" ${required ? 'required' : ''} ${disabled ? 'disabled' : ''} placeholder="${escapeHtml(placeholder)}" maxlength="${f.maxlength || 60}">`;
  } else if (type === 'textarea') {
    inputHtml = `<textarea class="input" id="${id}" ${required ? 'required' : ''} ${disabled ? 'disabled' : ''} placeholder="${escapeHtml(placeholder)}" maxlength="${f.maxlength || 200}" rows="${f.rows || 3}"></textarea>`;
  } else if (type === 'checkbox') {
    return `
      <div class="field" style="display:flex; align-items:center; gap:8px;">
        <input type="checkbox" id="${id}" style="width:auto; cursor:pointer;" ${disabled ? 'disabled' : ''}>
        <label for="${id}" style="font-size:13px; color:var(--text-secondary); cursor:pointer;">${escapeHtml(label)}</label>
      </div>
    `;
  } else if (type === 'custom') {
    return `<div class="field">${f.html || ''}</div>`;
  } else if (type === 'hidden') {
    return `<input type="hidden" id="${id}" value="${escapeHtml(f.value || '')}">`;
  }

  const inputWrapper = extraBtn
    ? `<div style="display:flex; gap:8px;">
         <div style="flex:1;">${inputHtml}</div>
         <button type="button" class="btn btn-sm btn-ghost" id="${id}-extra-btn" style="padding:0 12px;" title="${escapeHtml(extraBtn.title || '')}">
           <i data-lucide="${extraBtn.icon || 'plus'}" style="width:16px;height:16px;"></i>
         </button>
       </div>`
    : inputHtml;

  const hintHtml = hint
    ? `<div class="glass-card-hint" style="margin-top:4px;">${escapeHtml(hint)}</div>`
    : '';

  return `
    <div class="field">
      <label class="field-label" for="${id}">${escapeHtml(label)}${required ? ' *' : ''}</label>
      ${inputWrapper}
      ${hintHtml}
    </div>
  `;
}

/* ============================================
   資料收集 / 驗證
   ============================================ */

function _collectData(fields) {
  const data = {};
  fields.forEach((f) => {
    if (f.type === 'custom') return;
    const el = document.getElementById(f.id);
    if (!el) return;

    if (f.type === 'checkbox') {
      data[f.id] = el.checked;
    } else if (f.type === 'number') {
      const num = Number(el.value);
      data[f.id] = isNaN(num) ? 0 : num;
    } else {
      data[f.id] = el.value;
    }
  });
  return data;
}

function _validateRequired(fields, data) {
  for (const f of fields) {
    if (!f.required) continue;
    if (f.type === 'custom' || f.type === 'hidden') continue;

    const val = data[f.id];
    if (val === '' || val == null || (f.type === 'number' && val === 0 && f.allowZero !== true)) {
      return {
        field: f.id,
        message: `請填寫「${f.label}」`,
      };
    }
  }
  return null;
}