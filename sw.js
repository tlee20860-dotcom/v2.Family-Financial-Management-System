// ============================================
// sw.js — Service Worker（v101.8.2）
// ============================================
// v101.8.2 更新：
//   ✅ CACHE_NAME = family-fin-v123（v122 → v123）
//   ✅ 對應 v101.8.2 修正：
//      - js/admin/admin.js（復原 Modal 密碼可編輯）
// ============================================

const CACHE_NAME = 'family-fin-v125';

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

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(STATIC_ASSETS.map((url) =>
        cache.add(url).catch((err) => console.warn('⚠️ 快取失敗：', url, err))
      ))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (
    url.origin !== self.location.origin ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('gstatic') ||
    url.hostname.includes('unpkg') ||
    url.hostname.includes('jsdelivr') ||
    url.hostname.includes('cdnjs') ||
    url.pathname.startsWith('/api/')
  ) return;
  if (url.pathname.endsWith('.html') || url.pathname === '/') return;

  e.respondWith(
    fetch(e.request).then((res) => {
      if (res && res.status === 200 && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request).then((cached) => cached || caches.match('./index.html')))
  );
});