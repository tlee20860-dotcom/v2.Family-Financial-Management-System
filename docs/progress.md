# 交付進度 — v103.0.0

最後更新：2026-10-09
當前波次：第 1 波（已完成）
下一波次：第 2 波（Core 基礎）

## 總覽

| 波 | 主題 | 檔案數 | 狀態 |
|---|---|---|---|
| 1 | 5 Registry + constants | 5 | ✅ 已交付 |
| 2 | Core 基礎 | 7 | ⏳ 待交付 |
| 3 | Lib 工具集 | 8 | ⏳ 待交付 |
| 4 | UI 元件 | 6 | ⏳ 待交付 |
| 5 | Layout | 3 | ⏳ 待交付 |
| 6 | Entity | 3 | ⏳ 待交付 |
| 7 | Engines | 3 | ⏳ 待交付 |
| 8 | Blocks | 5 | ⏳ 待交付 |
| 9 | Pages（13 Schema） | 13 | ⏳ 待交付 |
| 10 | Functions API + 系統層 | 12 | ⏳ 待交付 |

## 第 1 波：5 Registry + constants ✅

狀態：已交付
檔案數：5

| # | 檔案 | 說明 |
|---|---|---|
| 1 | js/config/status-registry.js | 🆕 狀態 SSOT |
| 2 | js/config/entity-registry.js | 🆕 名稱 SSOT |
| 3 | js/config/label-registry.js | 🆕 文字 SSOT |
| 4 | js/config/column-registry.js | 🆕 欄位 SSOT |
| 5 | js/config/constants.js | 🔧 擴充常數 |

## 第 2 波：Core 基礎 ⏳

狀態：待交付
檔案數：7

| # | 檔案 | 說明 |
|---|---|---|
| 1 | js/core/state.js | 🔧 擴充 |
| 2 | js/core/api.js | 🔧 精簡 |
| 3 | js/core/db.js | 🔧 合併 |
| 4 | js/core/auth.js | 保留 |
| 5 | js/core/auth-guard.js | 保留 |
| 6 | js/core/utils.js | 🔧 精簡 |
| 7 | js/core/pwa.js | 保留 |

依賴：第 1 波

## 第 3 波：Lib 工具集 ⏳

狀態：待交付
檔案數：8

| # | 檔案 | 說明 |
|---|---|---|
| 1 | js/lib/dom.js | 🆕 qs / qsa / esc / when |
| 2 | js/lib/async.js | 🆕 withToast / withConfirm / withAsyncState |
| 3 | js/lib/lifecycle.js | 🆕 createCleanupRegistry |
| 4 | js/lib/registry.js | 🆕 Registry 統一初始化 |
| 5 | js/lib/merge.js | 🆕 從 settlements/merge.js 抽出 |
| 6 | js/lib/insurance.js | 🆕 從 insurance-calc.js 改名 |
| 7 | js/lib/bank.js | 🆕 從 bank-helpers.js 改名 |
| 8 | js/lib/format.js | 🆕 從 utils 抽出格式化 |

依賴：第 1、2 波

## 第 4 波：UI 元件 ⏳

狀態：待交付
檔案數：6

| # | 檔案 | 說明 |
|---|---|---|
| 1 | js/ui/toast.js | 保留 |
| 2 | js/ui/modal.js | 🔧 擴充 |
| 3 | js/ui/form-builder.js | 保留 |
| 4 | js/ui/tab-panel.js | 保留 |
| 5 | js/ui/view-toggle.js | 保留 |
| 6 | js/ui/collapsible.js | 🆕 改名 |

依賴：第 1~3 波

## 第 5 波：Layout ⏳

狀態：待交付
檔案數：3

| # | 檔案 | 說明 |
|---|---|---|
| 1 | js/layout/navbar.js | 保留 |
| 2 | js/layout/sidebar.js | 合併 sidebar-groups |
| 3 | js/layout/app-shell.js | 🆕 從 core/app.js 抽出 |

依賴：第 1~4 波

## 第 6 波：Entity ⏳

狀態：待交付
檔案數：3

| # | 檔案 | 說明 |
|---|---|---|
| 1 | js/entity/entity-modal.js | 保留 |
| 2 | js/entity/entity-helpers.js | 🔧 精簡 |
| 3 | js/entity/entity-definitions.js | 🔧 精簡 |

依賴：第 1~5 波

## 第 7 波：Engines ⏳

狀態：待交付
檔案數：3

| # | 檔案 | 說明 |
|---|---|---|
| 1 | js/engines/page-engine.js | 🆕 |
| 2 | js/engines/data-engine.js | 🆕 |
| 3 | js/engines/render-engine.js | 🆕 |

依賴：第 1~6 波

## 第 8 波：Blocks ⏳

狀態：待交付
檔案數：5

| # | 檔案 | 說明 |
|---|---|---|
| 1 | js/blocks/stats-block.js | 🆕 |
| 2 | js/blocks/list-block.js | 🆕 |
| 3 | js/blocks/filter-block.js | 🆕 |
| 4 | js/blocks/detail-block.js | 🆕 |
| 5 | js/blocks/form-block.js | 🆕 |

依賴：第 1~7 波

## 第 9 波：Pages（13 Schema）⏳

狀態：待交付
檔案數：13

| # | 檔案 | 說明 |
|---|---|---|
| 1 | js/pages/dashboard.js | 🔧 改為 Schema |
| 2 | js/pages/portfolio.js | 🔧 改為 Schema |
| 3 | js/pages/annual-report.js | 🔧 改為 Schema |
| 4 | js/pages/settings.js | 🔧 改為 Schema |
| 5 | js/pages/finance-overview.js | 🔧 改為 Schema |
| 6 | js/pages/member-report.js | 🔧 改為 Schema |
| 7 | js/pages/input-center.js | 🔧 合併 3 檔 |
| 8 | js/pages/database.js | 🔧 合併 |
| 9 | js/pages/database-options.js | 🔧 合併 |
| 10 | js/pages/database-dropdowns.js | 🔧 保留 |
| 11 | js/pages/database-yearrange.js | 🔧 保留 |
| 12 | js/pages/settlements.js | 🔧 合併 |
| 13 | js/pages/insurance.js | 🔧 合併 |

依賴：第 1~8 波

## 第 10 波：Functions API + 系統層 ⏳

狀態：待交付
檔案數：12

| # | 檔案 | 說明 |
|---|---|---|
| 1 | functions/api/_config.js | 保留 |
| 2 | functions/api/_helpers.js | 🔧 精簡 |
| 3 | functions/api/summary.js | 🔧 合併 |
| 4 | functions/api/insurance.js | 🔧 合併 |
| 5 | functions/api/admin.js | 🔧 合併 |
| 6 | functions/api/platform.js | 🔧 合併 |
| 7 | functions/api/family.js | 🔧 合併 |
| 8 | functions/api/bank.js | 🔧 合併 |
| 9 | functions/api/personal.js | 🔧 合併 |
| 10 | sw.js | 🔧 更新版本 |
| 11 | manifest.json | 保留 |
| 12 | 13 個 HTML | 🔧 引入新入口 |

依賴：全部

## 下一步

回覆「請交付第 2 波」→ AI 開始交付 Core 基礎（7 檔）
