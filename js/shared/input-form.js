// ============================================
// input-form.js — 全站共用可摺疊輸入表單（v101.3）
// 位置：js/shared/input-form.js
// ============================================
// v101.3 修正：
//   ✅ bindExtraButtons 改為純空函式（保留向後相容，零風險）
//   ✅ 移除 console.warn（避免打擾）
// ============================================

import { escapeHtml } from '../core/utils.js';
import { showToast } from './toast.js';

const DEFAULT_ICON = 'plus-circle';

/**
 * 建立可摺疊輸入表單
 */
export function createInputForm(options) {
  const {
    containerId,
    storageKey,
    title,
    icon = DEFAULT_ICON,
    fields = [],
    submitText = '儲存',
    resetText = '重置',
    defaultOpen = false,
    onSubmit,
    onReset,
    beforeSubmit,
  } = options;

  const root = document.getElementById(containerId);
  if (!root) {
    console.warn(`⚠️ createInputForm: 找不到容器 #${containerId}`);
    return null;
  }

  const fieldsHtml = _renderFields(fields);

  root.innerHTML = `
    <div class="glass-card collapsible-card" id="${containerId}-card">
      <div class="collapsible-header" id="${containerId}-header">
        <div class="collapsible-header-title">
          <i data-lucide="${icon}" style="width:16px;height:16px;"></i>
          <span>${escapeHtml(title)}</span>
        </div>
        <i data-lucide="chevron-down" class="collapsible-arrow"></i>
      </div>
      <div class="collapsible-body" id="${containerId}-body" style="display:none;">
        <form id="${containerId}-form">
          <div class="form-stack">
            ${fieldsHtml}
          </div>
          <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px;">
            <button type="button" class="btn btn-ghost" id="${containerId}-reset">${escapeHtml(resetText)}</button>
            <button type="submit" class="btn btn-primary" id="${containerId}-submit">
              <i data-lucide="check"></i> <span>${escapeHtml(submitText)}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  const card = document.getElementById(`${containerId}-card`);
  const header = document.getElementById(`${containerId}-header`);
  const body = document.getElementById(`${containerId}-body`);
  const form = document.getElementById(`${containerId}-form`);
  const resetBtn = document.getElementById(`${containerId}-reset`);
  const submitBtn = document.getElementById(`${containerId}-submit`);
  const submitBtnLabel = submitBtn.querySelector('span');

  const key = storageKey.startsWith('fin_ui_') ? storageKey : `fin_ui_${storageKey}`;
  let savedOpen = null;
  try { savedOpen = localStorage.getItem(key); } catch (e) { /* noop */ }
  const initialOpen = savedOpen !== null ? savedOpen === 'true' : defaultOpen;

  const setOpen = (open) => {
    if (open) {
      card.classList.add('open');
      body.style.display = 'block';
    } else {
      card.classList.remove('open');
      body.style.display = 'none';
    }
    try { localStorage.setItem(key, String(open)); } catch (e) { /* noop */ }
    if (window.lucide) window.lucide.createIcons();
  };
  setOpen(initialOpen);

  const headerClickHandler = () => {
    setOpen(!card.classList.contains('open'));
  };
  header.addEventListener('click', headerClickHandler);

  const api = {
    root,
    card,
    header,
    body,
    form,

    open: () => setOpen(true),
    close: () => setOpen(false),
    toggle: () => setOpen(!card.classList.contains('open')),
    isOpen: () => card.classList.contains('open'),

    reset: () => {
      form.reset();
      if (typeof onReset === 'function') onReset();
    },

    getData: () => _collectData(fields),

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

    onFieldChange: (fieldId, callback) => {
      const el = document.getElementById(fieldId);
      if (el) el.addEventListener('change', callback);
    },

    getFieldEl: (fieldId) => document.getElementById(fieldId),

    setSubmitting: (isSubmitting) => {
      submitBtn.disabled = isSubmitting;
      if (submitBtnLabel) {
        submitBtnLabel.textContent = isSubmitting ? '處理中…' : submitText;
      }
    },

    destroy: () => {
      header.removeEventListener('click', headerClickHandler);
    },
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    for (const f of fields) {
      if (!f.required) continue;
      const el = document.getElementById(f.id);
      if (!el) continue;
      const val = el.value;
      if (val === '' || val == null) {
        showToast(`請填寫「${f.label}」`, 'warning');
        el.focus();
        return;
      }
    }

    const data = _collectData(fields);

    if (typeof beforeSubmit === 'function') {
      const result = beforeSubmit(data);
      if (result === false) return;
      if (typeof result === 'string') {
        showToast(result, 'warning');
        return;
      }
    }

    api.setSubmitting(true);
    try {
      await onSubmit(data, api);
    } catch (err) {
      console.error('[input-form] 送出失敗：', err);
      showToast('送出失敗：' + (err.message || err), 'error');
    } finally {
      api.setSubmitting(false);
    }
  });

  resetBtn.addEventListener('click', () => {
    form.reset();
    if (typeof onReset === 'function') onReset();
  });

  fields.forEach((f) => {
    if (!f.extraBtn) return;
    const btn = document.getElementById(`${f.id}-extra-btn`);
    if (btn && typeof f.extraBtn.onClick === 'function') {
      btn.addEventListener('click', f.extraBtn.onClick);
    }
  });

  if (window.lucide) window.lucide.createIcons();

  return api;
}

/* ============================================
   向後相容：空函式（v101.3 已自動化，此為 no-op）
   ============================================ */
export function bindExtraButtons() {
  // v101.3：createInputForm 已自動綁定，此函式保留為向後相容
  // 若未來確認無人使用，可完全移除
}

/* ============================================
   內部函式
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

function _collectData(fields) {
  const data = {};
  fields.forEach((f) => {
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
