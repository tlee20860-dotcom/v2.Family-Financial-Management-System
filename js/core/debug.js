// ============================================
// debug.js — 手機除錯工具（v103.0.14）
// 位置：js/core/debug.js
// ============================================
// v103.0.14 修正：
//   ✅ [問題8] 用 localStorage 持久化「已啟用」狀態（跨頁保持）
// ============================================

const VCONSOLE_CDN = 'https://cdn.jsdelivr.net/npm/vconsole@3.15.0/dist/vconsole.min.js';
const STORAGE_KEY = '__debug_enabled__';

let _initialized = false;
let _scriptLoaded = false;
let _scriptLoadingPromise = null;

/* ============================================
   主入口
   ============================================ */
export function initDebug() {
  if (_initialized) return;
  _initialized = true;

  /* URL 參數 ?debug=1 強制啟用並持久化 */
  const params = new URLSearchParams(location.search);
  if (params.get('debug') === '1') {
    _setEnabled(true);
    forceEnableDebug();
    return;
  }

  /* URL 參數 ?debug=0 關閉並清除 */
  if (params.get('debug') === '0') {
    _setEnabled(false);
    return;
  }

  /* 🆕 讀 localStorage 持久化標記 */
  if (_isEnabled()) {
    forceEnableDebug();
  }
}

/* ============================================
   啟用
   ============================================ */
export async function forceEnableDebug() {
  if (window.vConsole) return true;
  _setEnabled(true);

  try {
    await _loadScript();
  } catch (err) {
    console.warn('[debug] vConsole CDN 載入失敗：', err);
    return false;
  }

  if (!window.VConsole) return false;

  try {
    window.vConsole = new window.VConsole({ maxLogNumber: 2000 });
    window.__vconsole_loaded__ = true;
    console.log('[debug] vConsole 已啟用（跨頁保持）');
    return true;
  } catch (err) {
    console.warn('[debug] vConsole 初始化失敗：', err);
    return false;
  }
}

/* ============================================
   關閉
   ============================================ */
export function forceDisableDebug() {
  _setEnabled(false);
  if (window.vConsole && typeof window.vConsole.destroy === 'function') {
    try { window.vConsole.destroy(); } catch (err) {}
  }
  window.vConsole = null;
  window.__vconsole_loaded__ = false;
  console.log('[debug] vConsole 已關閉');
  return true;
}

export function isDebugEnabled() {
  return !!(window.vConsole && window.__vconsole_loaded__);
}

/* ============================================
   內部
   ============================================ */
function _isEnabled() {
  try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch (e) { return false; }
}

function _setEnabled(on) {
  try {
    if (on) localStorage.setItem(STORAGE_KEY, '1');
    else localStorage.removeItem(STORAGE_KEY);
  } catch (e) {}
}

function _loadScript() {
  if (_scriptLoaded && window.VConsole) return Promise.resolve();
  if (_scriptLoadingPromise) return _scriptLoadingPromise;

  _scriptLoadingPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${VCONSOLE_CDN}"]`);
    if (existing && window.VConsole) {
      _scriptLoaded = true;
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = VCONSOLE_CDN;
    script.async = true;
    script.onload = () => { _scriptLoaded = true; resolve(); };
    script.onerror = () => { _scriptLoadingPromise = null; reject(new Error('CDN 載入失敗')); };
    document.head.appendChild(script);
  });

  return _scriptLoadingPromise;
}

export const disableDebug = forceDisableDebug;
export const enableDebug = forceEnableDebug;