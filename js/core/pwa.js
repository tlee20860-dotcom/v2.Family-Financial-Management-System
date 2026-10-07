// ============================================
// pwa.js — PWA 初始化（v101）
// 位置：js/core/pwa.js
// ============================================

let _pwaInitialized = false;
let _swRegistration = null;

/**
 * 初始化 PWA
 * - 動態注入 manifest / theme-color / mobile-web-app-capable
 * - 註冊 Service Worker
 * - 監聽更新
 */
export function initPWA() {
  if (_pwaInitialized) return;
  _pwaInitialized = true;

  _injectMetaTags();
  _registerServiceWorker();
}

/* ============================================
   動態注入 meta / link
   ============================================ */
function _injectMetaTags() {
  const head = document.head;

  // manifest
  if (!document.querySelector('link[rel="manifest"]')) {
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = './manifest.json';
    head.appendChild(link);
  }

  // theme-color
  if (!document.querySelector('meta[name="theme-color"]')) {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = '#080B11';
    head.appendChild(meta);
  }

  // 標準 PWA meta
  if (!document.querySelector('meta[name="mobile-web-app-capable"]')) {
    const meta = document.createElement('meta');
    meta.name = 'mobile-web-app-capable';
    meta.content = 'yes';
    head.appendChild(meta);
  }

  // iOS 相容 meta
  if (!document.querySelector('meta[name="apple-mobile-web-app-capable"]')) {
    const meta = document.createElement('meta');
    meta.name = 'apple-mobile-web-app-capable';
    meta.content = 'yes';
    head.appendChild(meta);
  }

  if (!document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')) {
    const meta = document.createElement('meta');
    meta.name = 'apple-mobile-web-app-status-bar-style';
    meta.content = 'black-translucent';
    head.appendChild(meta);
  }

  if (!document.querySelector('meta[name="apple-mobile-web-app-title"]')) {
    const meta = document.createElement('meta');
    meta.name = 'apple-mobile-web-app-title';
    meta.content = 'FAMILY.FIN';
    head.appendChild(meta);
  }
}

/* ============================================
   Service Worker 註冊
   ============================================ */
function _registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
      _swRegistration = reg;
      console.log('✅ Service Worker 已註冊：', reg.scope);

      // 主動檢查更新
      reg.update().catch(() => { /* noop */ });

      // 監聽更新
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('🔄 新版本已就緒，下次開啟生效');
          }
        });
      });
    } catch (err) {
      console.warn('⚠️ Service Worker 註冊失敗：', err);
    }
  });

  // 當新 SW 接管時，重新載入頁面（只觸發一次）
  let _refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (_refreshing) return;
    _refreshing = true;
    console.log('🔄 Service Worker 已更新，重新載入頁面');
    window.location.reload();
  });
}

/* ============================================
   對外 API
   ============================================ */

/**
 * 手動觸發 SW 更新檢查
 * @returns {Promise<void>}
 */
export async function checkForUpdate() {
  if (_swRegistration) {
    try {
      await _swRegistration.update();
    } catch (err) {
      console.warn('[pwa] 檢查更新失敗：', err);
    }
  }
}

/**
 * 取得 SW 註冊物件（debug 用）
 */
export function getSWRegistration() {
  return _swRegistration;
}