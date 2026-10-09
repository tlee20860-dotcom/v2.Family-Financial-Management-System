// ============================================
// form-builder.js — 通用動態表單建構器（v103.0.0）
// 位置：js/ui/form-builder.js
// ============================================
// v103.0.0 重構：
//   ✅ 從 js/shared/form-builder.js 移入 js/ui/
//   ✅ 逸出改用 lib/dom.js 的 esc()
//   ✅ 保留 v101.8.7 全部功能（含 number-plain）
//   ✅ getDynamicOptions 從 entity-helpers.js 移入（仍由此處呼叫）
// ============================================

import { esc } from '../lib/dom.js';
import { showToast } from './toast.js';
import { getDynamicOptions } from '../shared/entity-helpers.js';

/* ============================================
   主函式
   ============================================ */

export function buildForm(options) {
  const {
    containerId,
    fields = [],
    idPrefix = '',
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
    initialData = null,
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

  const fieldsHtml = _renderFields(fields, fieldIdMap);

  const buttons = [];
  if (showReset) {
    buttons.push(`<button type="button" class="btn btn-ghost" data-form-action="reset">${esc(resetText)}</button>`);
  }
  if (showCancel) {
    buttons.push(`<button type="button" class="btn btn-ghost" data-form-action="cancel">${esc(cancelText)}</button>`);
  }
  buttons.push(`<button type="submit" class="btn btn-primary" data-form-action="submit">
    <i data-lucide="check"></i> <span>${esc(submitText)}</span>
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
  const _dynamicCleanups = [];

  /* ============================================
     事件：Submit
     ============================================ */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (_submitting) return;

    _clearErrors();

    const data = _collectData(fields, fieldIdMap);

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

    if (typeof beforeSubmit === 'function') {
      let result;
      try {
        result = await beforeSubmit(data);
      } catch (err) {
        console.error('[form-builder] beforeSubmit 失敗：', err);
        showToast('驗證失敗：' + (err.message || err), 'error');
        return;
      }
      if (result === false) return;
      if (typeof result === 'string') {
        showToast(result, 'warning');
        return;
      }
      if (result && result.field && result.message) {
        const resolvedField = fieldIdMap[result.field] || result.field;
        _showFieldError(resolvedField, result.message, fieldIdMap);
        showToast(result.message, 'warning');
        return;
      }
    }

    if (typeof onSubmit !== 'function') return;

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
    const resolvedId = map && map[fieldId] ? map[fieldId] : fieldId;
    const el = document.getElementById(resolvedId);
    if (!el) return;
    const fieldEl = el.closest('.field');
    if (!fieldEl) return;
    fieldEl.classList.add('has-error');

    const old = fieldEl.querySelector('.field-error');
    if (old) old.remove();

    const errorDiv = document.createElement('div');
    errorDiv.className = 'field-error';
    errorDiv.style.cssText = 'color:var(--neon-red); font-size:11px; margin-top:4px;';
    errorDiv.textContent = message;
    fieldEl.appendChild(errorDiv);
  }

  /* ============================================
     初始化欄位（動態選項 / 連動）
     ============================================ */
  async function _initDynamicFields() {
    for (const f of fields) {
      if (f.type === 'select' && f.optionsSource) {
        try {
          const opts = await getDynamicOptions(f.optionsSource);
          api.updateOptions(f.id, opts, {
            includeEmpty: f.includeEmpty !== false,
            emptyText: f.emptyText || '— 請選擇 —',
          });
        } catch (err) {
          console.warn(`[form-builder] 載入動態選項失敗 (${f.optionsSource})：`, err);
        }
      }

      if (initialData && initialData[f.id] !== undefined) {
        api.setFieldValue(f.id, initialData[f.id]);
      } else if (f.defaultValue != null) {
        const def = typeof f.defaultValue === 'function' ? f.defaultValue() : f.defaultValue;
        api.setFieldValue(f.id, def);
      }

      if (f.dependsOn) {
        const sourceId = fieldIdMap[f.dependsOn] || f.dependsOn;
        const sourceEl = document.getElementById(sourceId);
        if (sourceEl) {
          const handler = async () => {
            const sourceVal = sourceEl.value;
            if (f.optionsSource === 'items') {
              const opts = await getDynamicOptions('items', { categoryId: sourceVal });
              api.updateOptions(f.id, opts, {
                includeEmpty: true,
                emptyText: sourceVal ? '— 請選擇項目 —' : '— 請先選擇類別 —',
              });
            }
          };
          sourceEl.addEventListener('change', handler);
          _dynamicCleanups.push(() => sourceEl.removeEventListener('change', handler));
        }
      }
    }
  }

  /* ============================================
     對外 API
     ============================================ */
  const api = {
    root,
    form,

    getData: () => _collectData(fields, fieldIdMap),

    setData: (data) => {
      Object.entries(data || {}).forEach(([k, v]) => {
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

    getFieldEl: (fieldId) => {
      const resolvedId = fieldIdMap[fieldId] || fieldId;
      return document.getElementById(resolvedId);
    },

    reset: () => {
      form.reset();
      _clearErrors();
      if (typeof onReset === 'function') onReset();
    },

    setError: (fieldId, message) => {
      _showFieldError(fieldId, message, fieldIdMap);
    },

    clearErrors: _clearErrors,

    updateOptions: (fieldId, options, config = {}) => {
      const resolvedId = fieldIdMap[fieldId] || fieldId;
      const el = document.getElementById(resolvedId);
      if (!el) return;
      const { includeEmpty = true, emptyText = '— 請選擇 —' } = config;
      const cur = el.value;
      let html = includeEmpty ? `<option value="">${esc(emptyText)}</option>` : '';
      html += options.map((o) =>
        `<option value="${esc(o.value)}">${esc(o.label)}</option>`
      ).join('');
      el.innerHTML = html;
      if (cur && options.some((o) => String(o.value) === cur)) el.value = cur;
    },

    onFieldChange: (fieldId, callback) => {
      const resolvedId = fieldIdMap[fieldId] || fieldId;
      const el = document.getElementById(resolvedId);
      if (!el) return () => {};
      el.addEventListener('change', callback);
      return () => el.removeEventListener('change', callback);
    },

    submit: () => {
      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    },

    setSubmitting: _setSubmitting,

    destroy: () => {
      _dynamicCleanups.forEach((fn) => {
        try { fn(); } catch (e) { /* noop */ }
      });
      _dynamicCleanups.length = 0;
      root.innerHTML = '';
    },
  };

  _initDynamicFields().then(() => {
    if (window.lucide) window.lucide.createIcons();
  });

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

  const finalId = fieldIdMap[id] || id;

  let inputHtml = '';

  if (type === 'select') {
    let opts = '';
    if (f.includeEmpty !== false) {
      opts += `<option value="">${esc(f.emptyText || '— 請選擇 —')}</option>`;
    }
    opts += options.map((o) =>
      `<option value="${esc(o.value)}">${esc(o.label)}</option>`
    ).join('');
    inputHtml = `<select class="select" id="${finalId}" ${required ? 'required' : ''} ${disabled ? 'disabled' : ''}>${opts}</select>`;
  } else if (type === 'number' || type === 'number-plain') {
    const attrs = [
      min != null ? `min="${min}"` : '',
      max != null ? `max="${max}"` : '',
      step != null ? `step="${step}"` : 'step="1"',
    ].filter(Boolean).join(' ');
    const inputClass = type === 'number' ? 'input mono' : 'input';
    inputHtml = `<input class="${inputClass}" id="${finalId}" type="number" ${attrs} ${required ? 'required' : ''} ${disabled ? 'disabled' : ''} placeholder="${esc(placeholder)}">`;
  } else if (type === 'text') {
    inputHtml = `<input class="input" id="${finalId}" type="text" ${required ? 'required' : ''} ${disabled ? 'disabled' : ''} placeholder="${esc(placeholder)}" maxlength="${f.maxlength || 60}">`;
  } else if (type === 'textarea') {
    inputHtml = `<textarea class="input" id="${finalId}" ${required ? 'required' : ''} ${disabled ? 'disabled' : ''} placeholder="${esc(placeholder)}" maxlength="${f.maxlength || 200}" rows="${f.rows || 3}"></textarea>`;
  } else if (type === 'checkbox') {
    return `
      <div class="field" style="display:flex; align-items:center; gap:8px;">
        <input type="checkbox" id="${finalId}" style="width:auto; cursor:pointer;" ${disabled ? 'disabled' : ''}>
        <label for="${finalId}" style="font-size:13px; color:var(--text-secondary); cursor:pointer;">${esc(label)}</label>
      </div>
    `;
  } else if (type === 'custom') {
    return `<div class="field">${f.html || ''}</div>`;
  } else if (type === 'hidden') {
    return `<input type="hidden" id="${finalId}" value="${esc(f.value || '')}">`;
  }

  const inputWrapper = extraBtn
    ? `<div style="display:flex; gap:8px;">
         <div style="flex:1;">${inputHtml}</div>
         <button type="button" class="btn btn-sm btn-ghost" id="${finalId}-extra-btn" style="padding:0 12px;" title="${esc(extraBtn.title || '')}">
           <i data-lucide="${esc(extraBtn.icon || 'plus')}" style="width:16px;height:16px;"></i>
         </button>
       </div>`
    : inputHtml;

  const hintHtml = hint
    ? `<div class="glass-card-hint" style="margin-top:4px;">${esc(hint)}</div>`
    : '';

  return `
    <div class="field">
      <label class="field-label" for="${finalId}">${esc(label)}${required ? ' *' : ''}</label>
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
    } else if (f.type === 'number' || f.type === 'number-plain') {
      data[f.id] = el.value === '' ? 0 : (isNaN(Number(el.value)) ? 0 : Number(el.value));
    } else {
      data[f.id] = el.value;
    }
  });
  return data;
}

function _validateRequired(fields, data, fieldIdMap) {
  for (const f of fields) {
    if (!f.required) continue;
    if (f.type === 'custom' || f.type === 'hidden') continue;

    const val = data[f.id];
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
