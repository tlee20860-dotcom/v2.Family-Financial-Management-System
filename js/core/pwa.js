// ============================================
// pwa.js — PWA 初始化（v101.10.0）
// 位置：js/core/pwa.js
// ============================================
// v101.10.0 修正：
//   ✅ [痛點 1] 修復「手機開 app 需開 2 次」問題
//       - 原本 controllerchange 無條件 reload
//       - 首次註冊 SW 也會觸發 controllerchange → 自動 reload
//       - 修正：用 _hadController 判斷是否首次註冊
//   ✅ 保留 v101 全部功能（meta 注入 / SW 註冊 / 更新檢查）
// ============================================

let _pwaInitialized = false;
let _swRegistration = null;

// 🆕 v101.10.0：追蹤是否已有 controller
// - 首次註冊：頁面載入時無 controller，SW activate → clients.claim() 觸發 controllerchange
//   → 此時 _hadController === false，不 reload（避免「開 2 次」）
// - SW 更新：頁面載入時已有 controller，新 SW activate → 觸發 controllerchange
//   → 此時 _hadController === true，reload 一次讓頁面用新 SW
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

  // 初始化時檢查是否已有 controller（表示上次已註冊過 SW）
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

      // 監聽更新（僅記錄，不自動 reload）
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
     🆕 v101.10.0：controllerchange 智慧判斷
     ============================================
     - 首次註冊：_hadController === false → 不 reload
     - SW 更新：_hadController === true → reload 一次
     ============================================ */
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // 首次註冊（頁面載入時無 controller）→ 不 reload
    if (!_hadController) {
      _hadController = true;
      return;
    }

    // 避免無限循環
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