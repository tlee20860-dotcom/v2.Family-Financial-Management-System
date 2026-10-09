// ============================================
// debug.js — 手機除錯工具（v103.0.12）
// 位置：js/core/debug.js
// ============================================
// v103.0.12 修正：
//   ✅ [M16] 預設關閉 vConsole（正式上線狀態）
//           訪問頁面加 ?debug=1 才啟用
// ============================================

let _initialized = false;

/* ============================================
   主入口
   ============================================ */
export function initDebug() {
  if (_initialized) return;
  _initialized = true;

  if (window.__vconsole_loaded__) return;

  const params = new URLSearchParams(location.search);
  const debugParam = params.get('debug');

  /* 🆕 v103.0.12 [M16]：
     正式階段：只有 ?debug=1 才啟用
     若 localStorage 記錄為關閉，一律不啟用（除 ?debug=1 強制） */
  if (debugParam !== '1') {
    return;
  }

  window.__vconsole_loaded__ = true;

  // 全域錯誤捕獲（在 vConsole 載入前也要生效）
  window.addEventListener('error', (e) => {
    console.error('[GLOBAL ERROR]', e.message, e.filename, e.lineno);
  });
  window.addEventListener('unhandledrejection', (e) => {
    console.error('[UNHANDLED]', e.reason);
  });

  // 動態載入 vConsole
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/vconsole@3.15.0/dist/vconsole.min.js';
  script.async = false;
  script.onload = () => {
    try {
      if (window.VConsole) {
        window.vConsole = new window.VConsole({
          maxLogNumber: 2000,
          onReady: () => {
            console.log('[debug] vConsole 已就緒');
          },
        });
      }
    } catch (err) {
      console.warn('[debug] vConsole 初始化失敗：', err);
    }
  };
  script.onerror = () => {
    console.warn('[debug] vConsole 載入失敗（CDN 問題？）');
  };
  document.head.appendChild(script);
}

/**
 * 手動關閉 vConsole（供 Console 中呼叫）
 */
export function disableDebug() {
  try {
    localStorage.setItem('__debug_off__', '1');
    if (window.vConsole && window.vConsole.destroy) {
      window.vConsole.destroy();
    }
    window.__vconsole_loaded__ = false;
    console.log('[debug] 已關閉，重新整理頁面後生效');
  } catch (e) { /* noop */ }
}

/**
 * 手動啟用 vConsole（供 Console 中呼叫）
 */
export function enableDebug() {
  try {
    localStorage.removeItem('__debug_off__');
    location.reload();
  } catch (e) { /* noop */ }
}