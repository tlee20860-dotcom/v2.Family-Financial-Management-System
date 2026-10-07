// ============================================
// input-form.js — 全站共用可摺疊輸入表單（v101）
// 位置：js/shared/input-form.js
// ============================================
// v101 修正（重大 Bug）：
//   ✅ 修 api 未宣告就使用（TDZ）→ 提前宣告
//   ✅ 修 window.showToast 未掛載 → import 直用
//   ✅ 修 layout: 'half' 無效 → 自動分組為 .form-stack-row
//   ✅ 修 bindExtraButtons 需手動呼叫 → 內部自動綁定
//   ✅ 加 loading 狀態 + 防連點
//   ✅ alert() 改為 showToast
//   ✅ 新增 destroy()
// ============================================

import { escapeHtml } from '../core/utils.js';
import { showToast } from './toast.js';

const DEFAULT_ICON = 'plus-circle';

/**
 * 建立可摺疊輸入表單
 * @param {Object} options
 * @param {string} options.containerId - 容器 ID
 * @param {string} options.storageKey - localStorage key
 * @param {string} options.title - 表單標題
 * @param {string} [options.icon] - Lucide icon 名稱
 * @param {Array} options.fields - 欄位定義陣列
 * @param {string} [options.submitText] - 送出按鈕文字
 * @param {string} [options.resetText] - 重置按鈕文字
 * @param {boolean} [options.defaultOpen] - 預設是否展開
 * @param {Function} options.onSubmit - 送出回呼 (data, api) => Promise
 * @param {Function} [options.onReset] - 重置回呼
 * @param {Function} [options.beforeSubmit] - 送出前驗證 (data) => bool | string
 * @returns {Object|null}
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

  // 產生欄位 HTML（支援 layout='half' 自動分組）
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

  // 初始化展開狀態
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

  // 綁定展開/收起
  const headerClickHandler = () => {
    setOpen(!card.classList.contains('open'));
  };
  header.addEventListener('click', headerClickHandler);

  /* ============================================
     對外 API（提前宣告，避免 TDZ）
     ============================================ */
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

  /* ============================================
     送出處理
     ============================================ */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // 驗證必填
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

    // 自訂驗證
    if (typeof beforeSubmit === 'function') {
      const result = beforeSubmit(data);
      if (result === false) return;
      if (typeof result === 'string') {
        showToast(result, 'warning');
        return;
      }
    }

    // 送出（加 loading + 防連點）
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

  /* ============================================
     重置
     ============================================ */
  resetBtn.addEventListener('click', () => {
    form.reset();
    if (typeof onReset === 'function') onReset();
  });

  /* ============================================
     自動綁定 extraBtn（不需手動呼叫）
     ============================================ */
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
   向下相容：舊 API 保留
   ============================================ */
export function bindExtraButtons(formConfig) {
  // v101：createInputForm 已自動綁定，此函式保留為 no-op
  console.warn('[input-form] bindExtraButtons 已於 v101 自動化，無需手動呼叫');
}

/* ============================================
   內部函式
   ============================================ */

/**
 * 渲染欄位（自動處理 layout='half' 分組）
 */
function _renderFields(fields) {
  const output = [];
  let buffer = [];   // 暫存連續 half 欄位

  const flushBuffer = () => {
    if (buffer.length === 0) return;
    output.push(`<div class="form-stack-row">${buffer.join('')}</div>`);
    buffer = [];
  };

  fields.forEach((f) => {
    const html = _renderField(f);

    if (f.layout === 'half') {
      buffer.push(html);
      // 湊滿 2 個就 flush
      if (buffer.length >= 2) flushBuffer();
    } else {
      flushBuffer();
      output.push(html);
    }
  });

  flushBuffer();
  return output.join('');
}

/**
 * 渲染單一欄位
 */
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

/**
 * 收集欄位值
 */
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