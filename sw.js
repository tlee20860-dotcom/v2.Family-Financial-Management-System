// ============================================
// sw.js — Service Worker（v103.0.0）
// ============================================
// v103.0.0 更新：
//   ✅ CACHE_NAME = family-fin-v135
//   ✅ STATIC_ASSETS 對應 v103.0.0 新目錄結構
// ============================================

const CACHE_NAME = 'family-fin-v136';          // 從 v135 → v136

const STATIC_ASSETS = [
  './css/theme.css',
  './css/layout.css',
  './css/components.css',
  './css/utilities.css',
  './css/pages/annual-report.css',
  './css/pages/insurance.css',

  /* Config（含 5 Registry） */
  './js/config/constants.js',
  './js/config/firebase-config.js',
  './js/config/app-config.js',
  './js/config/status-registry.js',
  './js/config/entity-registry.js',
  './js/config/label-registry.js',
  './js/config/column-registry.js',

  /* Core */
  './js/core/state.js',
  './js/core/auth.js',
  './js/core/auth-guard.js',
  './js/core/api.js',
  './js/core/db.js',
  './js/core/utils.js',
  './js/core/pwa.js',

  /* Lib */
  './js/lib/dom.js',
  './js/lib/async.js',
  './js/lib/lifecycle.js',
  './js/lib/registry.js',
  './js/lib/merge.js',
  './js/lib/insurance.js',
  './js/lib/bank.js',
  './js/lib/format.js',

  /* Engines */
  './js/engines/data-engine.js',
  './js/engines/render-engine.js',
  './js/engines/page-engine.js',

  /* Blocks */
  './js/blocks/stats-block.js',
  './js/blocks/list-block.js',
  './js/blocks/filter-block.js',
  './js/blocks/detail-block.js',
  './js/blocks/form-block.js',

  /* UI */
  './js/ui/toast.js',
  './js/ui/modal.js',
  './js/ui/form-builder.js',
  './js/ui/tab-panel.js',
  './js/ui/view-toggle.js',
  './js/ui/collapsible.js',

  /* Layout */
  './js/layout/navbar.js',
  './js/layout/sidebar.js',
  './js/layout/app-shell.js',

  /* Entity */
  './js/entity/entity-definitions.js',
  './js/entity/entity-helpers.js',
  './js/entity/entity-modal.js',

  /* Shared（v103 仍在使用的） */
  './js/shared/bank-account-manager.js',
  './js/shared/collapsible-card.js',
  './js/shared/column-settings.js',
  './js/shared/data-card.js',
  './js/shared/data-table.js',
  './js/shared/date-helpers.js',
  './js/shared/entity-list-page.js',
  './js/shared/form-handler.js',
  './js/shared/listener-group.js',
  './js/shared/page-filter.js',
  './js/shared/quick-summary.js',
  './js/shared/select-helpers.js',
  './js/shared/stats-cards.js',

  /* Pages */
  './js/pages/dashboard.js',
  './js/pages/portfolio.js',
  './js/pages/annual-report.js',
  './js/pages/settings.js',
  './js/pages/finance-overview.js',
  './js/pages/member-report.js',
  './js/pages/input-center.js',
  './js/pages/database.js',
  './js/pages/database-options.js',
  './js/pages/database-dropdowns.js',
  './js/pages/database-yearrange.js',
  './js/pages/settlements.js',
  './js/pages/insurance.js',

  /* Admin */
  './js/admin/admin.js',
  './js/admin/platform-defaults.js',

  './manifest.json',
  './icons/icon.svg',
];

/* ============================================
   INSTALL
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
   ACTIVATE
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
   FETCH
   ============================================ */
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (
    e.request.mode === 'navigate' ||
    url.pathname.endsWith('.html') ||
    url.pathname === '/' ||
    url.pathname.endsWith('/')
  ) {
    e.respondWith(_networkFirst(e.request));
    return;
  }

  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    e.respondWith(_staleWhileRevalidate(e.request));
    return;
  }

  e.respondWith(_cacheFirst(e.request));
});

/* ============================================
   策略
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
    const fallback = await caches.match('./index.html');
    if (fallback) return fallback;
    return new Response('離線中，請稍後再試', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

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
