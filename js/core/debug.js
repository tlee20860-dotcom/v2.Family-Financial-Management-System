// ============================================
// debug.js — 手機除錯工具（v103.0.13）
// 位置：js/core/debug.js
// ============================================
// v103.0.13 修正：
//   ✅ 新增 forceEnableDebug() / forceDisableDebug() / isDebugEnabled()
//   ✅ 支援從「系統設定 → 個人化」手動開啟 vConsole
//   ✅ initDebug() 保留 ?debug=1 URL 參數自動啟用邏輯
// ============================================

const VCONSOLE_CDN = 'https://cdn.jsdelivr.net/npm/vconsole@3.15.0/dist/vconsole.min.js';

let _initialized = false;
let _scriptLoaded = false;
let _scriptLoadingPromise = null;

/* ============================================
   主入口（由 app-shell 自動呼叫）
   ============================================ */
export function initDebug() {
  if (_initialized) return;
  _initialized = true;

  const params = new URLSearchParams(location.search);
  const debugParam = params.get('debug');

  // 只有 ?debug=1 才自動啟用
  if (debugParam !== '1') return;

  forceEnableDebug();
}

/* ============================================
   手動啟用（從系統設定呼叫）
   @returns {Promise<boolean>} 是否成功
   ============================================ */
export async function forceEnableDebug() {
  // 已載入 → 直接返回
  if (window.vConsole) return true;

  try {
    await _loadScript();
  } catch (err) {
    console.warn('[debug] vConsole CDN 載入失敗：', err);
    return false;
  }

  if (!window.VConsole) {
    console.warn('[debug] window.VConsole 不存在（CDN 載入異常）');
    return false;
  }

  try {
    window.vConsole = new window.VConsole({
      maxLogNumber: 2000,
    });
    window.__vconsole_loaded__ = true;
    console.log('[debug] vConsole 已啟用');
    return true;
  } catch (err) {
    console.warn('[debug] vConsole 初始化失敗：', err);
    return false;
  }
}

/* ============================================
   手動關閉
   @returns {boolean} 是否成功
   ============================================ */
export function forceDisableDebug() {
  if (window.vConsole && typeof window.vConsole.destroy === 'function') {
    try {
      window.vConsole.destroy();
    } catch (err) {
      console.warn('[debug] vConsole destroy 失敗：', err);
    }
  }
  window.vConsole = null;
  window.__vconsole_loaded__ = false;
  console.log('[debug] vConsole 已關閉');
  return true;
}

/* ============================================
   查詢目前狀態
   @returns {boolean}
   ============================================ */
export function isDebugEnabled() {
  return !!(window.vConsole && window.__vconsole_loaded__);
}

/* ============================================
   內部：載入 CDN 腳本（僅一次）
   ============================================ */
function _loadScript() {
  if (_scriptLoaded && window.VConsole) return Promise.resolve();
  if (_scriptLoadingPromise) return _scriptLoadingPromise;

  _scriptLoadingPromise = new Promise((resolve, reject) => {
    // 若已存在 <script>（重複載入）
    const existing = document.querySelector(`script[src="${VCONSOLE_CDN}"]`);
    if (existing && window.VConsole) {
      _scriptLoaded = true;
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = VCONSOLE_CDN;
    script.async = true;
    script.onload = () => {
      _scriptLoaded = true;
      resolve();
    };
    script.onerror = () => {
      _scriptLoadingPromise = null;
      reject(new Error('CDN 載入失敗'));
    };
    document.head.appendChild(script);
  });

  return _scriptLoadingPromise;
}

/* ============================================
   向後相容別名
   ============================================ */
export const disableDebug = forceDisableDebug;
export const enableDebug = forceEnableDebug;