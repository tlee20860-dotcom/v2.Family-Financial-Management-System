// ============================================
// sw.js — Service Worker（v101.5）
// ============================================
// v101.5 更新：
//   ✅ CACHE_NAME = family-fin-v105
//   ✅ 移除 input-form.js（已刪除）
//   ✅ 移除 insurance/calc.js（已刪除）
//   ✅ 新增 entity-definitions.js / entity-modal.js / entity-helpers.js
//   ✅ 新增 shared/insurance-calc.js
//   ✅ 移除未使用的 insurance/calc.js 路徑
// ============================================

const CACHE_NAME = 'family-fin-v105';

const STATIC_ASSETS = [
  // ================= CSS =================
  './css/theme.css',
  './css/layout.css',
  './css/components.css',
  './css/utilities.css',
  './css/pages/annual-report.css',
  './css/pages/insurance.css',

  // ================= JS — config =================
  './js/config/constants.js',
  './js/config/firebase-config.js',
  './js/config/app-config.js',
  './js/config/entity-definitions.js',   // 🆕 v101.5

  // ================= JS — core =================
  './js/core/state.js',
  './js/core/app.js',
  './js/core/auth.js',
  './js/core/auth-guard.js',
  './js/core/api.js',
  './js/core/db.js',
  './js/core/utils.js',
  './js/core/pwa.js',

  // ================= JS — shared =================
  './js/shared/toast.js',
  './js/shared/modal.js',
  './js/shared/page-filter.js',
  './js/shared/collapsible-card.js',
  './js/shared/annual-month-cards.js',
  './js/shared/select-helpers.js',
  './js/shared/date-helpers.js',
  './js/shared/navbar.js',
  './js/shared/sidebar.js',
  './js/shared/sidebar-order.js',
  './js/shared/sidebar-groups.js',
  './js/shared/tab-panel.js',
  './js/shared/view-toggle.js',
  './js/shared/data-card.js',
  './js/shared/quick-summary.js',
  './js/shared/form-builder.js',
  './js/shared/insurance-calc.js',       // 🆕 v101.5
  './js/shared/entity-modal.js',         // 🆕 v101.5
  './js/shared/entity-helpers.js',       // 🆕 v101.5

  // ================= JS — pages (根目錄) =================
  './js/pages/dashboard.js',
  './js/pages/members.js',
  './js/pages/member-detail.js',
  './js/pages/personal-expenses.js',
  './js/pages/fixed-expenses.js',
  './js/pages/income.js',
  './js/pages/banks.js',
  './js/pages/portfolio.js',
  './js/pages/annual-report.js',
  './js/pages/settings.js',

  // ================= JS — pages/input-center =================
  './js/pages/input-center/index.js',
  './js/pages/input-center/tab-expenses.js',
  './js/pages/input-center/tab-fixed.js',
  './js/pages/input-center/tab-insurance.js',
  './js/pages/input-center/tab-income.js',
  './js/pages/input-center/tab-banks.js',
  './js/pages/input-center/tab-funds.js',

  // ================= JS — pages/database =================
  './js/pages/database/index.js',
  './js/pages/database/tab-members.js',
  './js/pages/database/tab-banks.js',
  './js/pages/database/tab-policies.js',
  './js/pages/database/tab-funds.js',
  './js/pages/database/tab-categories.js',
  './js/pages/database/tab-options.js',
  './js/pages/database/tab-dropdowns.js',
  './js/pages/database/tab-yearrange.js',

  // ================= JS — pages/settlements =================
  './js/pages/settlements/index.js',
  './js/pages/settlements/merge.js',
  './js/pages/settlements/render.js',

  // ================= JS — pages/insurance =================
  './js/pages/insurance/index.js',
  './js/pages/insurance/render.js',
  './js/pages/insurance/sync.js',
  './js/pages/insurance/modals.js',

  // ================= JS — admin =================
  './js/admin/admin.js',
  './js/admin/platform-defaults.js',

  // ================= PWA 資源 =================
  './manifest.json',
  './icons/icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return Promise.all(
          STATIC_ASSETS.map((url) =>
            cache.add(url).catch((err) => {
              console.warn('⚠️ 快取失敗：', url, err);
            })
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
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
  ) {
    return;
  }

  if (url.pathname.endsWith('.html') || url.pathname === '/') {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(e.request).then((cached) => cached || caches.match('./index.html'))
      )
  );
});