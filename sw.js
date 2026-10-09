// ============================================
// sw.js — Service Worker（v102.1.0）
// ============================================
// v102.1.0 更新：
//   ✅ CACHE_NAME = family-fin-v134.1（v133 → v134）
// ============================================

const CACHE_NAME = 'family-fin-v133';

/* ============================================
   預快取清單
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
  './js/shared/bank-helpers.js',
  './js/shared/bank-account-manager.js',

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
