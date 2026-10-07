// ============================================
// modal.js — 全站共用 Modal 開關（v101.5）
// 位置：js/shared/modal.js
// ============================================
// v101.5 修正：
//   ✅ 移除重複定義的 escapeHtml，改用 utils.js
//   ✅ 強化 ESC 處理（只關最上層）
//   ✅ 新增 destroy / cleanAll
// ============================================

import { escapeHtml } from '../core/utils.js';

const _stack = [];

/* ============================================
   開關
   ============================================ */

/**
 * 開啟 Modal
 */
export function openModal(target, options = {}) {
  const { pushToStack = true } = options;
  const modal = resolveElement(target);
  if (!modal) return;

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';

  if (pushToStack && !_stack.includes(modal)) {
    _stack.push(modal);
  }
}

/**
 * 關閉 Modal
 */
export function closeModal(target) {
  const modal = resolveElement(target);
  if (!modal) return;

  modal.classList.remove('active');

  const idx = _stack.indexOf(modal);
  if (idx >= 0) _stack.splice(idx, 1);

  if (_stack.length === 0) {
    document.body.style.overflow = '';
  }
}

/**
 * 關閉所有 Modal
 */
export function closeAllModals() {
  document.querySelectorAll('.modal-overlay.active').forEach((m) => {
    m.classList.remove('active');
  });
  _stack.length = 0;
  document.body.style.overflow = '';
}

/**
 * 取得堆疊最上層 Modal
 */
export function getTopModal() {
  return _stack.length > 0 ? _stack[_stack.length - 1] : null;
}

/* ============================================
   綁定工具
   ============================================ */

export function bindModalCancel(modalId, cancelBtnId) {
  const btn = document.getElementById(cancelBtnId);
  if (!btn) return;
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    closeModal(modalId);
  });
}

export function bindModalBackdropClose(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal(modalId);
  });
}

export function bindModalEscClose() {
  if (window._modalEscBound) return;
  window._modalEscBound = true;

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const top = getTopModal();
    if (!top) return;
    closeModal(top);
  });
}

export function bindModals(configs = []) {
  configs.forEach((cfg) => {
    if (cfg.cancelBtnId) bindModalCancel(cfg.modalId, cfg.cancelBtnId);
    bindModalBackdropClose(cfg.modalId);
  });
  bindModalEscClose();
}

/* ============================================
   便捷：確認對話框
   ============================================ */

let _confirmResolve = null;

/**
 * 顯示確認對話框
 * @param {string} message
 * @param {Object} [options]
 * @returns {Promise<boolean>}
 */
export function openConfirm(message, options = {}) {
  const {
    title = '確認',
    okText = '確定',
    cancelText = '取消',
    okClass = 'btn-danger',
  } = options;

  return new Promise((resolve) => {
    _confirmResolve = resolve;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.id = '__confirm-modal';
    overlay.innerHTML = `
      <div class="modal" style="max-width:400px;">
        <h2 class="modal-title">${escapeHtml(title)}</h2>
        <div style="font-size:14px; line-height:1.6; color:var(--text-secondary); white-space:pre-wrap;">${escapeHtml(message)}</div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-confirm-action="cancel">${escapeHtml(cancelText)}</button>
          <button type="button" class="btn ${okClass}" data-confirm-action="ok">${escapeHtml(okText)}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    const handleClick = (e) => {
      const btn = e.target.closest('[data-confirm-action]');
      if (!btn) {
        if (e.target === overlay) _closeConfirm(false);
        return;
      }
      _closeConfirm(btn.dataset.confirmAction === 'ok');
    };

    const handleKey = (e) => {
      if (e.key === 'Escape') _closeConfirm(false);
      if (e.key === 'Enter') _closeConfirm(true);
    };

    overlay.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKey, { once: false });

    overlay._cleanup = () => {
      overlay.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  });
}

function _closeConfirm(result) {
  const overlay = document.getElementById('__confirm-modal');
  if (overlay) {
    if (overlay._cleanup) overlay._cleanup();
    overlay.remove();
  }
  document.body.style.overflow = '';
  if (_confirmResolve) {
    _confirmResolve(result);
    _confirmResolve = null;
  }
}

/* ============================================
   銷毀
   ============================================ */

export function destroyModal(target) {
  const modal = resolveElement(target);
  if (!modal) return;
  closeModal(modal);
  modal.remove();
}

export function cleanAllModals() {
  closeAllModals();
  _stack.length = 0;
}

/* ============================================
   內部工具
   ============================================ */
function resolveElement(target) {
  if (typeof target === 'string') return document.getElementById(target);
  if (target instanceof HTMLElement) return target;
  return null;
}