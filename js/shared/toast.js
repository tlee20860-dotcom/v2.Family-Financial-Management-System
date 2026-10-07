// ============================================
// toast.js — 全站共用 Toast 提示（v101）
// 位置：js/shared/toast.js
// ============================================
// v101 修正：
//   ✅ duration 預設從 app-config 讀取（getUIConstants）
//   ✅ 支援多個 toast 同時顯示（獨立 DOM）
//   ✅ 移除硬編碼時間
// ============================================

import { getUIConstants } from '../config/app-config.js';

const COLORS = {
  success: 'rgba(16, 185, 129, 0.95)',
  error:   'rgba(244, 63, 94, 0.95)',
  info:    'rgba(0, 240, 255, 0.95)',
  warning: 'rgba(251, 146, 60, 0.95)',
};

const CONTAINER_ID = 'app-toast-container';
const MAX_TOASTS = 3;

/**
 * 顯示 Toast 提示
 * @param {string} msg - 訊息內容
 * @param {'success'|'error'|'info'|'warning'} type - 類型
 * @param {number} [duration] - 顯示時間（毫秒），未提供則從 app-config 讀取
 */
export function showToast(msg, type = 'success', duration) {
  // 讀取預設 duration
  if (duration == null) {
    try {
      const cfg = getUIConstants();
      duration = cfg.toastDuration;
    } catch (e) {
      duration = 2000;
    }
  }

  const container = _getOrCreateContainer();

  // 限制數量
  while (container.children.length >= MAX_TOASTS) {
    container.removeChild(container.firstChild);
  }

  const toast = document.createElement('div');
  toast.className = 'app-toast';
  toast.style.cssText = `
    background: ${COLORS[type] || COLORS.success};
    color: #fff;
    padding: 12px 22px;
    border-radius: 8px;
    font-size: 14px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    opacity: 0;
    transform: translateY(10px);
    transition: opacity 0.3s ease, transform 0.3s ease;
    max-width: 90%;
    text-align: center;
    pointer-events: none;
    margin-top: 8px;
  `;
  toast.textContent = msg;

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, duration);
}

/* ============================================
   便捷方法
   ============================================ */
export const toastSuccess = (msg, duration) => showToast(msg, 'success', duration);
export const toastError   = (msg, duration) => showToast(msg, 'error', duration);
export const toastInfo    = (msg, duration) => showToast(msg, 'info', duration);
export const toastWarning = (msg, duration) => showToast(msg, 'warning', duration);

/* ============================================
   內部工具
   ============================================ */
function _getOrCreateContainer() {
  let container = document.getElementById(CONTAINER_ID);
  if (container) return container;

  container = document.createElement('div');
  container.id = CONTAINER_ID;
  container.style.cssText = `
    position: fixed;
    bottom: 30px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 99999;
    display: flex;
    flex-direction: column;
    align-items: center;
    pointer-events: none;
    max-width: 90%;
  `;
  document.body.appendChild(container);
  return container;
}