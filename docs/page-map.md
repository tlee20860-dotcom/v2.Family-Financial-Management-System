# 頁面 → 檔案對照表

最後更新：B24
用途：改某功能時，快速查哪些頁面受影響

---

## 總覽

| 頁面 | HTML | Schema | 主要 Blocks |
|---|---|---|---|
| 登入 | login.html | — | — |
| 註冊 | register.html | — | — |
| 平台管理 | admin.html | — | （用 admin.js） |
| 總覽儀表板 | index.html | dashboard.js | stats |
| 綜合輸入中心 | input-center.html | input-center.js | — |
| 基礎資料庫 | database.html | database.js | — |
| 保險清單表 | insurance.html | insurance.js | — |
| 基金投資表 | portfolio.html | portfolio.js | stats |
| 結算清單 | settlements.html | settlements.js | — |
| 銀行交易 | finance-overview.html | finance-overview.js | — |
| 年度報表 | annual-report.html | annual-report.js | stats |
| 成員報表 | member-report.html | member-report.js | stats |
| 系統設定 | settings.html | settings.js | — |

---

## 共用（所有主頁）

所有 .html（除 login / register）皆載入：

| 檔案 | 職責 |
|---|---|
| js/layout/app-shell.js | App Shell 初始化 |
| js/layout/sidebar.js | 側邊欄 |
| js/layout/navbar.js | 頂部導覽 |
| js/core/auth-guard.js | 登入驗證 |
| js/core/state.js | 全域狀態 |
| js/core/api.js | API 呼叫 |
| js/core/pwa.js | PWA |
| js/core/debug.js | vConsole（動態） |
| js/config/app-config.js | 平台/家庭設定 |
| js/config/firebase-config.js | Firebase |
| js/lib/registry.js | Registry 統一初始化 |

---

## index.html（總覽儀表板）

| 檔案 | 用途 |
|---|---|
| js/pages/dashboard.js | Schema |
| js/blocks/stats-block.js | 統計卡 |
| js/shared/stats-cards.js | （透過 block 呼叫） |
| js/lib/bank.js | 銀行餘額計算 |
| js/lib/format.js | 格式化 |
| js/config/entity-registry.js | 名稱解析 |
| js/config/column-registry.js | 欄位 |

---

## input-center.html（綜合輸入中心）

| 檔案 | 用途 |
|---|---|
| js/pages/input-center.js | Schema（customMount） |
| js/ui/tab-panel.js | Tab 切換 |
| js/ui/view-toggle.js | 卡片/表格切換 |
| js/ui/modal.js | Modal 管理 |
| js/ui/toast.js | Toast |
| js/lib/expense-modal.js | 支出 Modal |
| js/lib/income-modal.js | 收入 Modal |
| js/shared/entity-list-page.js | 保險/基金/銀行 Tab |
| js/shared/data-table.js | 表格 |
| js/shared/data-card.js | 卡片 |
| js/entity/entity-modal.js | 保單/基金 Modal |
| js/entity/entity-funds-allocation.js | 保單關聯基金（B23） |
| js/core/db.js | Firebase 讀寫 |
| js/core/state.js | 全域狀態 |
| js/config/entity-registry.js | 名稱解析 |

---

## database.html（基礎資料庫）

| 檔案 | 用途 |
|---|---|
| js/pages/database.js | Schema（customMount） |
| js/pages/database-options.js | 支付/狀態 Tab |
| js/pages/database-dropdowns.js | 下拉選項 Tab |
| js/pages/database-yearrange.js | 年份範圍 Tab |
| js/ui/tab-panel.js | Tab 切換 |
| js/shared/entity-list-page.js | 成員/銀行/類別/項目 |
| js/shared/data-table.js | 表格 |
| js/shared/data-card.js | 卡片 |
| js/entity/entity-modal.js | 編輯 Modal |
| js/entity/entity-helpers.js | CRUD |
| js/entity/entity-resolvers.js | 顯示邏輯 |
| js/config/entity-registry.js | 名稱解析 |
| js/config/app-config.js | 家庭設定 |
| js/core/db.js | Firebase 讀寫 |
| js/ui/toast.js | Toast |
| js/ui/modal.js | Modal |
| js/ui/form-builder.js | 表單 |

---

## insurance.html（保險清單表）

| 檔案 | 用途 |
|---|---|
| js/pages/insurance.js | Schema（customMount） |
| js/shared/stats-cards.js | 統計卡 |
| js/shared/data-table.js | 表格（B22 新增） |
| js/ui/view-toggle.js | 卡片/表格切換（B22 新增） |
| js/lib/insurance.js | 保單計算 |
| js/lib/format.js | 格式化 |
| js/lib/dom.js | esc |
| js/entity/entity-modal.js | 保單編輯 |
| js/entity/entity-funds-allocation.js | 保單關聯基金（B23） |
| js/entity/entity-helpers.js | CRUD |
| js/core/db.js | Firebase 讀寫 |
| js/config/entity-registry.js | 名稱解析 |
| js/ui/modal.js | Modal |
| js/ui/toast.js | Toast |

---

## portfolio.html（基金投資表）

| 檔案 | 用途 |
|---|---|
| js/pages/portfolio.js | Schema（customMount，B23 重寫） |
| js/blocks/stats-block.js | 統計卡 |
| js/entity/entity-modal.js | 基金編輯 |
| js/entity/entity-funds-allocation.js | 保單關聯基金（B23） |
| js/entity/entity-helpers.js | CRUD |
| js/ui/view-toggle.js | （B23 移除，改分區） |
| js/ui/modal.js | 快照 Modal（B23） |
| js/ui/form-builder.js | 快照表單（B23） |
| js/core/db.js | 基金 + snapshot CRUD |
| js/lib/format.js | 格式化 |
| js/config/column-registry.js | fundSnapshots 欄位（B23） |

---

## settlements.html（結算清單）

| 檔案 | 用途 |
|---|---|
| js/pages/settlements.js | Schema（customMount） |
| js/lib/merge.js | 合併資料 |
| js/lib/filter-sort.js | 篩選/排序 |
| js/lib/expense-modal.js | 編輯 Modal |
| js/lib/format.js | 格式化 |
| js/lib/dom.js | esc |
| js/shared/page-filter.js | 篩選列 |
| js/shared/stats-cards.js | 統計卡 |
| js/shared/data-table.js | 表格 |
| js/shared/data-card.js | 卡片 |
| js/ui/view-toggle.js | 切換 |
| js/ui/modal.js | Modal |
| js/ui/toast.js | Toast |
| js/core/db.js | Firebase 讀寫 |
| js/config/entity-registry.js | 名稱解析 |

---

## finance-overview.html（銀行交易）

| 檔案 | 用途 |
|---|---|
| js/pages/finance-overview.js | Schema（customMount） |
| js/shared/stats-cards.js | 統計卡 |
| js/shared/data-table.js | 表格 |
| js/shared/data-card.js | 卡片（B22 新增） |
| js/ui/view-toggle.js | 切換（B22 新增） |
| js/lib/bank.js | 餘額計算 |
| js/lib/format.js | 格式化 |
| js/lib/dom.js | esc |
| js/config/entity-registry.js | 名稱解析 |
| js/core/db.js | Firebase 讀寫 |

---

## annual-report.html（年度報表）

| 檔案 | 用途 |
|---|---|
| js/pages/annual-report.js | Schema（customMount） |
| js/blocks/stats-block.js | 統計卡 |
| js/ui/view-toggle.js | 全年/月度切換 |
| js/lib/format.js | 格式化 |
| js/lib/dom.js | esc |
| js/config/entity-registry.js | 名稱解析 |
| js/shared/stats-cards.js | （透過 block 呼叫） |

---

## member-report.html（成員報表）

| 檔案 | 用途 |
|---|---|
| js/pages/member-report.js | Schema（customMount） |
| js/blocks/stats-block.js | 統計卡 |
| js/shared/data-table.js | 表格 |
| js/shared/data-card.js | 卡片 |
| js/ui/view-toggle.js | 切換 |
| js/lib/format.js | 格式化 |
| js/lib/dom.js | esc |
| js/config/entity-registry.js | 名稱解析 |
| js/shared/stats-cards.js | （透過 block 呼叫） |

---

## settings.html（系統設定）

| 檔案 | 用途 |
|---|---|
| js/pages/settings.js | Schema（customMount） |
| js/ui/tab-panel.js | Tab 切換 |
| js/shared/bank-account-manager.js | 銀行帳號管理 |
| js/shared/entity-list-page.js | 家庭成員 |
| js/shared/stats-cards.js | （家庭成員用） |
| js/ui/toast.js | Toast |
| js/ui/modal.js | Modal |
| js/ui/form-builder.js | 表單 |
| js/core/state.js | 全域狀態 |
| js/core/auth.js | 登出 |
| js/core/debug.js | vConsole 控制 |
| js/config/constants.js | STORAGE_KEYS |
| js/entity/entity-helpers.js | CRUD |

---

## admin.html（平台管理）

| 檔案 | 用途 |
|---|---|
| js/admin/admin.js | 主邏輯 |
| js/admin/platform-defaults.js | 預設資料庫 |
| js/ui/tab-panel.js | Tab |
| js/ui/toast.js | Toast |
| js/ui/modal.js | Modal |
| js/ui/form-builder.js | 表單 |
| js/core/api.js | API 呼叫 |
| js/core/state.js | 全域狀態 |
| js/layout/app-shell.js | App Shell |

---

## login.html / register.html

| 檔案 | 用途 |
|---|---|
| js/core/auth.js | 登入 |
| js/core/state.js | 全域狀態 |
| js/core/pwa.js | PWA |
| js/config/constants.js | SESSION_KEYS |

---

## 共用 Registry（所有頁）

| Registry | 用途 |
|---|---|
| status-registry.js | 狀態正規化 |
| entity-registry.js | ID → 名稱 |
| label-registry.js | 顯示文字 |
| column-registry.js | 表格欄位 |
| constants.js | 全站常數 |

---

## 改動影響對照

| 若改此檔 | 影響頁面 |
|---|---|
| page-engine.js | 全部主頁 |
| data-engine.js | 全部主頁 |
| render-engine.js | 全部主頁 |
| list-block.js | portfolio / member-report |
| stats-block.js | dashboard / portfolio / annual-report / member-report |
| filter-block.js | （未使用） |
| detail-block.js | （未使用） |
| form-block.js | （未使用） |
| column-registry.js | 全部有表格的頁 |
| entity-registry.js | 全部用名稱解析的頁 |
| status-registry.js | settlements + 全部狀態顯示 |
| label-registry.js | 全部 |
| constants.js | 全部 |
| app-shell.js | 全部主頁 |
| sidebar.js | 全部主頁 |
| navbar.js | 全部主頁 |
| api.js | 全部用 API 的頁 |
| auth-guard.js | 全部主頁 |
| db.js | 全部主頁 |
| ui/modal.js | 全部有 Modal 的頁 |
| ui/toast.js | 全部有 Toast 的頁 |
| ui/view-toggle.js | settlements / portfolio / annual-report / member-report / insurance / finance-overview |
| ui/tab-panel.js | input-center / database / settings / admin |
| lib/expense-modal.js | input-center / settlements |
| lib/income-modal.js | input-center |
| lib/filter-sort.js | settlements |
| entity-funds-allocation.js | input-center / insurance / portfolio |
| _insurance.js | 保險累積基金 |

---

/* ═══════════════════════════════════════════
   END OF FILE
   File: docs/page-map.md
   Version: v103.0.21
   Batch: B24
   ═══════════════════════════════════════════ */