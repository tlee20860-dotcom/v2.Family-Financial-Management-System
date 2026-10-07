// ============================================
// modal.js — 全站共用 Modal 開關（v101）
// 位置：js/shared/modal.js
// ============================================
// v101 修正：
//   ✅ 支援 Stack（多層 Modal）
//   ✅ 新增 openConfirm 便捷方法
//   ✅ 強化 ESC 處理（只關最上層）
//   ✅ 新增 destroy 清理
// ============================================

const _stack = [];

/**
 * 開啟 Modal
 * @param {string|HTMLElement} target - Modal 元素 ID 或元素本身
 * @param {Object} [options]
 * @param {boolean} [options.pushToStack=true] - 是否推入堆疊
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
 * @param {string|HTMLElement} target
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

/**
 * 綁定 Modal 內的「取消」按鈕
 * @param {string} modalId
 * @param {string} cancelBtnId
 */
export function bindModalCancel(modalId, cancelBtnId) {
  const btn = document.getElementById(cancelBtnId);
  if (!btn) return;
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    closeModal(modalId);
  });
}

/**
 * 綁定點擊 overlay 背景關閉 Modal
 * @param {string} modalId
 */
export function bindModalBackdropClose(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal(modalId);
  });
}

/**
 * 綁定 ESC 鍵關閉最上層 Modal（只需呼叫一次）
 */
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

/**
 * 一次綁定多個 Modal（cancel + backdrop + esc）
 * @param {Array<{modalId: string, cancelBtnId?: string}>} configs
 */
export function bindModals(configs = []) {
  configs.forEach((cfg) => {
    if (cfg.cancelBtnId) bindModalCancel(cfg.modalId, cfg.cancelBtnId);
    bindModalBackdropClose(cfg.modalId);
  });
  bindModalEscClose();
}

/* ============================================
   便捷：確認對話框（取代原生 confirm）
   ============================================ */

let _confirmResolve = null;

/**
 * 顯示確認對話框
 * @param {string} message - 訊息
 * @param {Object} [options]
 * @param {string} [options.title='確認']
 * @param {string} [options.okText='確定']
 * @param {string} [options.cancelText='取消']
 * @param {string} [options.okClass='btn-danger']
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

    // 建立 Modal DOM
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
   內部工具
   ============================================ */
function resolveElement(target) {
  if (typeof target === 'string') return document.getElementById(target);
  if (target instanceof HTMLElement) return target;
  return null;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}