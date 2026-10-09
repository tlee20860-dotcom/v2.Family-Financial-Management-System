// ============================================
// pwa.js — PWA 初始化（v103.0.0）
// 位置：js/core/pwa.js
// ============================================
// v103.0.0 重構：
//   ✅ 版本號更新（無功能變更）
//   ✅ 保留 v101.10.0 全部功能
//      - 修復「手機開 app 需開 2 次」問題（_hadController 判斷）
//      - 動態注入 manifest / theme-color / iOS meta
//      - Service Worker 註冊 + 更新檢查
// ============================================

let _pwaInitialized = false;
let _swRegistration = null;

/**
 * 追蹤是否已有 controller
 * - 首次註冊：頁面載入時無 controller，SW activate → clients.claim() 觸發 controllerchange
 *   → 此時 _hadController === false，不 reload（避免「開 2 次」）
 * - SW 更新：頁面載入時已有 controller，新 SW activate → 觸發 controllerchange
 *   → 此時 _hadController === true，reload 一次讓頁面用新 SW
 */
let _hadController = false;
let _refreshing = false;

/**
 * 初始化 PWA
 * - 動態注入 manifest / theme-color / mobile-web-app-capable
 * - 註冊 Service Worker
 * - 監聽更新
 */
export function initPWA() {
  if (_pwaInitialized) return;
  _pwaInitialized = true;

  if ('serviceWorker' in navigator) {
    _hadController = !!navigator.serviceWorker.controller;
  }

  _injectMetaTags();
  _registerServiceWorker();
}

/* ============================================
   動態注入 meta / link
   ============================================ */
function _injectMetaTags() {
  const head = document.head;

  if (!document.querySelector('link[rel="manifest"]')) {
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = './manifest.json';
    head.appendChild(link);
  }

  if (!document.querySelector('meta[name="theme-color"]')) {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = '#080B11';
    head.appendChild(meta);
  }

  if (!document.querySelector('meta[name="mobile-web-app-capable"]')) {
    const meta = document.createElement('meta');
    meta.name = 'mobile-web-app-capable';
    meta.content = 'yes';
    head.appendChild(meta);
  }

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

      reg.update().catch(() => { /* noop */ });

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

  /* ============================================
     controllerchange 智慧判斷
     ============================================ */
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!_hadController) {
      _hadController = true;
      return;
    }

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
