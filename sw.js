// ============================================
// sw.js — Service Worker（v101.10.0）
// ============================================
// v101.10.0 更新：
//   ✅ CACHE_NAME = family-fin-v131（v129 → v131）
//   ✅ 快取策略重構：
//      - HTML: network-first（先網路，失敗回快取，再失敗回 index.html）
//      - JS / CSS: stale-while-revalidate（先快取，背景更新）
//      - icons / manifest: cache-first
//      - API / Firebase / CDN: 不攔截
//   ✅ 對應效能提升：切頁時間大幅降低
// ============================================

const CACHE_NAME = 'family-fin-v131';

/* ============================================
   預快取清單（首次安裝時快取）
   注意：不預快取 HTML（避免版本鎖死）
   ============================================ */
const STATIC_ASSETS = [
  './css/theme.css',
  './css/layout.css',
  './css/components.css',
  './css/utilities.css',
  './css/pages/annual-report.css',
  './css/pages/insurance.css',

  './js/config/constants.js',
  './js/config/firebase-config.js',
  './js/config/app-config.js',
  './js/config/entity-definitions.js',

  './js/core/state.js',
  './js/core/app.js',
  './js/core/auth.js',
  './js/core/auth-guard.js',
  './js/core/api.js',
  './js/core/db.js',
  './js/core/utils.js',
  './js/core/pwa.js',

  './js/shared/toast.js',
  './js/shared/modal.js',
  './js/shared/page-filter.js',
  './js/shared/collapsible-card.js',
  './js/shared/annual-month-cards.js',
  './js/shared/select-helpers.js',
  './js/shared/date-helpers.js',
  './js/shared/navbar.js',
  './js/shared/sidebar.js',
  './js/shared/sidebar-groups.js',
  './js/shared/tab-panel.js',
  './js/shared/view-toggle.js',
  './js/shared/data-card.js',
  './js/shared/quick-summary.js',
  './js/shared/form-builder.js',
  './js/shared/insurance-calc.js',
  './js/shared/entity-modal.js',
  './js/shared/entity-helpers.js',
  './js/shared/column-settings.js',
  './js/shared/data-table.js',
  './js/shared/stats-cards.js',
  './js/shared/entity-list-page.js',
  './js/shared/form-handler.js',
  './js/shared/listener-group.js',

  './js/pages/dashboard.js',
  './js/pages/portfolio.js',
  './js/pages/annual-report.js',
  './js/pages/settings.js',
  './js/pages/finance-overview.js',
  './js/pages/member-report.js',

  './js/pages/input-center/index.js',
  './js/pages/input-center/recent-list.js',
  './js/pages/input-center/holdings-list.js',

  './js/pages/database/index.js',
  './js/pages/database/tab-members.js',
  './js/pages/database/tab-banks.js',
  './js/pages/database/tab-categories.js',
  './js/pages/database/tab-options.js',
  './js/pages/database/tab-dropdowns.js',
  './js/pages/database/tab-yearrange.js',

  './js/pages/settlements/index.js',
  './js/pages/settlements/merge.js',
  './js/pages/settlements/render.js',

  './js/pages/insurance/index.js',
  './js/pages/insurance/render.js',
  './js/pages/insurance/sync.js',
  './js/pages/insurance/modals.js',

  './js/admin/admin.js',
  './js/admin/platform-defaults.js',

  './manifest.json',
  './icons/icon.svg',
];

/* ============================================
   INSTALL：預快取靜態資源 + skipWaiting
   ============================================ */
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        STATIC_ASSETS.map((url) =>
          cache.add(url).catch((err) => console.warn('⚠️ 快取失敗：', url, err))
        )
      )
    ).then(() => self.skipWaiting())
  );
});

/* ============================================
   ACTIVATE：清除舊版快取 + clients.claim
   ============================================ */
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => {
            console.log('🗑 清除舊快取：', k);
            return caches.delete(k);
          })
      )
    ).then(() => self.clients.claim())
  );
});

/* ============================================
   FETCH：依資源類型分派策略
   ============================================ */
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // 只處理同源請求
  if (url.origin !== self.location.origin) return;

  // API 不攔截
  if (url.pathname.startsWith('/api/')) return;

  // HTML / 頁面導航：network-first
  if (
    e.request.mode === 'navigate' ||
    url.pathname.endsWith('.html') ||
    url.pathname === '/' ||
    url.pathname.endsWith('/')
  ) {
    e.respondWith(_networkFirst(e.request));
    return;
  }

  // JS / CSS：stale-while-revalidate
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    e.respondWith(_staleWhileRevalidate(e.request));
    return;
  }

  // 其他（icon / manifest 等）：cache-first
  e.respondWith(_cacheFirst(e.request));
});

/* ============================================
   策略 1：Network-First（HTML）
   -------------------------------------------------
   先嘗試網路 → 成功則更新快取
              → 失敗則讀快取
              → 都失敗則回 index.html（SPA fallback）
   ============================================ */
async function _networkFirst(request) {
  try {
    const res = await fetch(request);
    if (res && res.status === 200 && res.type === 'basic') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, res.clone());
    }
    return res;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    // SPA fallback
    const fallback = await caches.match('./index.html');
    if (fallback) return fallback;
    return new Response('離線中，請稍後再試', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

/* ============================================
   策略 2：Stale-While-Revalidate（JS / CSS）
   -------------------------------------------------
   立即回快取 → 背景 fetch 更新快取
   若無快取 → 直接 fetch
   ============================================ */
async function _staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((res) => {
      if (res && res.status === 200 && res.type === 'basic') {
        cache.put(request, res.clone());
      }
      return res;
    })
    .catch(() => cached);

  return cached || fetchPromise;
}

/* ============================================
   策略 3：Cache-First（icon / manifest）
   -------------------------------------------------
   先讀快取 → 命中回快取
            → 未命中 fetch 並寫入快取
   ============================================ */
async function _cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const res = await fetch(request);
    if (res && res.status === 200 && res.type === 'basic') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, res.clone());
    }
    return res;
  } catch (err) {
    return new Response('資源未快取', { status: 404 });
  }
}