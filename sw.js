// ============================================
// sw.js — Service Worker（v103.0.11）
// 位置：sw.js
// ============================================
// v103.0.11：
//   ✅ 版本號統一至 v103.0.11
//   ✅ CACHE_NAME 保持 family-fin-v139
//   ✅ 全部 network-first（開發階段）
// ============================================

const CACHE_NAME = 'family-fin-v139';

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
  './js/config/status-registry.js',
  './js/config/entity-registry.js',
  './js/config/label-registry.js',
  './js/config/column-registry.js',

  './js/core/state.js',
  './js/core/auth.js',
  './js/core/auth-guard.js',
  './js/core/api.js',
  './js/core/db.js',
  './js/core/utils.js',
  './js/core/pwa.js',
  './js/core/debug.js',

  './js/lib/dom.js',
  './js/lib/async.js',
  './js/lib/lifecycle.js',
  './js/lib/registry.js',
  './js/lib/merge.js',
  './js/lib/insurance.js',
  './js/lib/bank.js',
  './js/lib/format.js',

  './js/engines/data-engine.js',
  './js/engines/render-engine.js',
  './js/engines/page-engine.js',

  './js/blocks/stats-block.js',
  './js/blocks/list-block.js',
  './js/blocks/filter-block.js',
  './js/blocks/detail-block.js',
  './js/blocks/form-block.js',

  './js/ui/toast.js',
  './js/ui/modal.js',
  './js/ui/form-builder.js',
  './js/ui/tab-panel.js',
  './js/ui/view-toggle.js',
  './js/ui/collapsible.js',

  './js/layout/navbar.js',
  './js/layout/sidebar.js',
  './js/layout/app-shell.js',

  './js/entity/entity-definitions.js',
  './js/entity/entity-helpers.js',
  './js/entity/entity-modal.js',

  './js/shared/bank-account-manager.js',
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

  './js/admin/admin.js',
  './js/admin/platform-defaults.js',

  './manifest.json',
  './icons/icon.svg',
];

/* ============================================
   INSTALL
   ============================================ */
self.addEventListener('install', (e) => {
  console.log('[SW] install (v103.0.11, cache=' + CACHE_NAME + ')');
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        STATIC_ASSETS.map((url) =>
          cache.add(url).catch((err) => console.warn('[SW] 快取失敗：', url, err.message))
        )
      )
    ).then(() => {
      console.log('[SW] install 完成，skipWaiting');
      return self.skipWaiting();
    })
  );
});

/* ============================================
   ACTIVATE
   ============================================ */
self.addEventListener('activate', (e) => {
  console.log('[SW] activate');
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => {
            console.log('[SW] 清除舊快取：', k);
            return caches.delete(k);
          })
      )
    ).then(() => {
      console.log('[SW] activate 完成，clients.claim');
      return self.clients.claim();
    })
  );
});

/* ============================================
   FETCH（全部 network-first）
   ============================================ */
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  e.respondWith(_networkFirst(e.request));
});

/* ============================================
   策略：Network First
   ============================================ */
async function _networkFirst(request) {
  const url = new URL(request.url);
  const isHtml = request.mode === 'navigate'
    || url.pathname.endsWith('.html')
    || url.pathname === '/'
    || url.pathname.endsWith('/');

  try {
    const res = await fetch(request);

    if (res && res.status === 200 && res.type === 'basic') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, res.clone());
    }
    return res;
  } catch (err) {
    console.log('[SW] 網路失敗，嘗試快取：', url.pathname);
    const cached = await caches.match(request);
    if (cached) return cached;

    if (isHtml) {
      const fallback = await caches.match('./index.html');
      if (fallback) return fallback;
    }

    return new Response('離線中，請稍後再試', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}