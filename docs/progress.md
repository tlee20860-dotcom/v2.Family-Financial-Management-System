# 交付進度 — v103.0.11

最後更新：2026-10-10
當前波次：第 11 波（已完成）
狀態：重構完成 ✅

═══════════════════════════════════════════════════════
【總覽】
═══════════════════════════════════════════════════════

| 波 | 主題 | 檔案數 | 狀態 |
|---|---|---|---|
| 1 | 5 Registry + constants | 5 | ✅ 已交付 |
| 2 | Core 基礎 | 7 | ✅ 已交付 |
| 3 | Lib 工具集 | 8 | ✅ 已交付 |
| 4 | UI 元件 | 6 | ✅ 已交付 |
| 5 | Layout | 3 | ✅ 已交付 |
| 6 | Entity | 3 | ✅ 已交付 |
| 7 | Engines | 3 | ✅ 已交付 |
| 8 | Blocks | 5 | ✅ 已交付 |
| 9 | Pages（13 Schema） | 13 | ✅ 已交付 |
| 10 | Functions API + 系統層 | 12 | ✅ 已交付 |
| 11 | 實戰修復 | 20+ | ✅ 已交付 |

═══════════════════════════════════════════════════════
【第 1 波：5 Registry + constants】✅
═══════════════════════════════════════════════════════

狀態：已交付
檔案數：5

| # | 檔案 | 說明 |
|---|---|---|
| 1 | js/config/status-registry.js | 🆕 狀態 SSOT |
| 2 | js/config/entity-registry.js | 🆕 名稱 SSOT |
| 3 | js/config/label-registry.js | 🆕 文字 SSOT |
| 4 | js/config/column-registry.js | 🆕 欄位 SSOT |
| 5 | js/config/constants.js | 🔧 擴充常數 |

═══════════════════════════════════════════════════════
【第 2 波：Core 基礎】✅
═══════════════════════════════════════════════════════

狀態：已交付
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

═══════════════════════════════════════════════════════
【第 3 波：Lib 工具集】✅
═══════════════════════════════════════════════════════

狀態：已交付
檔案數：8

| # | 檔案 | 說明 |
|---|---|---|
| 1 | js/lib/dom.js | 🆕 qs / qsa / esc / when |
| 2 | js/lib/async.js | 🆕 withToast / withConfirm |
| 3 | js/lib/lifecycle.js | 🆕 createCleanupRegistry |
| 4 | js/lib/registry.js | 🆕 Registry 統一初始化 |
| 5 | js/lib/merge.js | 🆕 從 settlements/merge.js 抽出 |
| 6 | js/lib/insurance.js | 🆕 從 insurance-calc.js 改名 |
| 7 | js/lib/bank.js | 🆕 從 bank-helpers.js 改名 |
| 8 | js/lib/format.js | 🆕 從 utils 抽出格式化 |

═══════════════════════════════════════════════════════
【第 4 波：UI 元件】✅
═══════════════════════════════════════════════════════

狀態：已交付
檔案數：6

| # | 檔案 | 說明 |
|---|---|---|
| 1 | js/ui/toast.js | 從 shared 移入 |
| 2 | js/ui/modal.js | 🔧 擴充 |
| 3 | js/ui/form-builder.js | 從 shared 移入 |
| 4 | js/ui/tab-panel.js | 從 shared 移入 |
| 5 | js/ui/view-toggle.js | 從 shared 移入 |
| 6 | js/ui/collapsible.js | 🆕 改名 |

═══════════════════════════════════════════════════════
【第 5 波：Layout】✅
═══════════════════════════════════════════════════════

狀態：已交付
檔案數：3

| # | 檔案 | 說明 |
|---|---|---|
| 1 | js/layout/navbar.js | 從 shared 移入 |
| 2 | js/layout/sidebar.js | 合併 sidebar-groups |
| 3 | js/layout/app-shell.js | 🆕 從 core/app.js 抽出 |

═══════════════════════════════════════════════════════
【第 6 波：Entity】✅
═══════════════════════════════════════════════════════

狀態：已交付
檔案數：3

| # | 檔案 | 說明 |
|---|---|---|
| 1 | js/entity/entity-modal.js | 從 shared 移入 |
| 2 | js/entity/entity-helpers.js | 🔧 精簡 |
| 3 | js/entity/entity-definitions.js | 從 config 移入 |

═══════════════════════════════════════════════════════
【第 7 波：Engines】✅
═══════════════════════════════════════════════════════

狀態：已交付
檔案數：3

| # | 檔案 | 說明 |
|---|---|---|
| 1 | js/engines/page-engine.js | 🆕（v103.0.8 修正） |
| 2 | js/engines/data-engine.js | 🆕 |
| 3 | js/engines/render-engine.js | 🆕 |

═══════════════════════════════════════════════════════
【第 8 波：Blocks】✅
═══════════════════════════════════════════════════════

狀態：已交付
檔案數：5

| # | 檔案 | 說明 |
|---|---|---|
| 1 | js/blocks/stats-block.js | 🆕 |
| 2 | js/blocks/list-block.js | 🆕 |
| 3 | js/blocks/filter-block.js | 🆕 |
| 4 | js/blocks/detail-block.js | 🆕 |
| 5 | js/blocks/form-block.js | 🆕 |

═══════════════════════════════════════════════════════
【第 9 波：Pages（13 Schema）】✅
═══════════════════════════════════════════════════════

狀態：已交付
檔案數：13

| # | 檔案 | 說明 |
|---|---|---|
| 1 | js/pages/dashboard.js | 純 Schema |
| 2 | js/pages/portfolio.js | 純 Schema |
| 3 | js/pages/annual-report.js | 純 Schema |
| 4 | js/pages/settings.js | Schema + customMount |
| 5 | js/pages/finance-overview.js | 純 Schema |
| 6 | js/pages/member-report.js | 純 Schema |
| 7 | js/pages/input-center.js | Schema + customMount |
| 8 | js/pages/database.js | Schema + customMount |
| 9 | js/pages/database-options.js | Helper |
| 10 | js/pages/database-dropdowns.js | Helper |
| 11 | js/pages/database-yearrange.js | Helper |
| 12 | js/pages/settlements.js | Schema + customMount |
| 13 | js/pages/insurance.js | Schema + customMount |

═══════════════════════════════════════════════════════
【第 10 波：Functions API + 系統層】✅
═══════════════════════════════════════════════════════

狀態：已交付
檔案數：12+（含 13 個 HTML）

| # | 檔案 | 說明 |
|---|---|---|
| 1 | functions/api/_config.js | 保留 |
| 2 | functions/api/_helpers.js | 🔧 精簡 |
| 3 | functions/api/summary.js | 合併 |
| 4 | functions/api/insurance.js | 合併 |
| 5 | functions/api/admin.js | 合併 |
| 6 | functions/api/platform.js | 合併 |
| 7 | functions/api/family.js | 合併 |
| 8 | functions/api/bank.js | 合併 |
| 9 | functions/api/personal.js | 合併 |
| 10 | sw.js | 🔧 更新版本 |
| 11 | manifest.json | 保留 |
| 12 | 13 個 HTML | 🔧 引入新入口 |

═══════════════════════════════════════════════════════
【第 11 波：實戰修復】✅
═══════════════════════════════════════════════════════

狀態：已交付
檔案數：20+
主題：部署後修復 13 個問題

■ Functions API 重構（方案 B）

| # | 檔案 | 說明 |
|---|---|---|
| 1 | functions/api/[[path]].js | 🆕 Catch-all 路由 |
| 2 | functions/api/_family.js | 🆕 從 family.js 改名 |
| 3 | functions/api/_admin.js | 🆕 |
| 4 | functions/api/_bank.js | 🆕 |
| 5 | functions/api/_personal.js | 🆕 |
| 6 | functions/api/_platform.js | 🆕 |
| 7 | functions/api/_summary.js | 🆕 |
| 8 | functions/api/_insurance.js | 🆕 |

■ 前端修復

| # | 檔案 | 說明 |
|---|---|---|
| 9 | js/config/constants.js | href 加 .html |
| 10 | js/engines/page-engine.js | v103.0.8 修正 |
| 11 | js/layout/app-shell.js | 動態 import debug |
| 12 | js/core/debug.js | 🆕 vConsole 注入 |
| 13 | js/pages/insurance.js | esc 導入修正 |
| 14 | js/pages/settlements.js | esc 導入修正 |
| 15 | js/pages/database.js | 內容覆蓋 |
| 16 | js/shared/bank-account-manager.js | import 修正 |
| 17 | js/shared/data-card.js | import 修正 |
| 18 | js/shared/data-table.js | import 修正 |
| 19 | js/shared/entity-list-page.js | import 修正 |
| 20 | js/shared/form-handler.js | import 修正 |
| 21 | js/ui/form-builder.js | import 修正 |
| 22 | js/lib/async.js | import 修正 |
| 23 | js/admin/admin.js | import 修正 |
| 24 | js/admin/platform-defaults.js | import 修正 |
| 25 | sw.js | network-first |
| 26 | settlements.html | 完整覆蓋 |

詳細問題與解決方案 → incident-log.md

═══════════════════════════════════════════════════════
【檔案統計】
═══════════════════════════════════════════════════════

| 層級 | 檔案數 |
|---|---|
| js/config/ | 7 |
| js/core/ | 8（含 debug.js） |
| js/lib/ | 8 |
| js/engines/ | 3 |
| js/blocks/ | 5 |
| js/ui/ | 6 |
| js/layout/ | 3 |
| js/entity/ | 3 |
| js/admin/ | 2 |
| js/shared/ | 12（保留） |
| js/pages/ | 13 |
| functions/api/ | 10 |
| HTML | 13 |
| CSS | 6 |
| docs/ | 9 |
| 根目錄設定 | 3（sw/manifest/icons） |

合計：約 111 檔

═══════════════════════════════════════════════════════
【下一步】
═══════════════════════════════════════════════════════

重構完成 ✅

未來可能方向：
1. 修改現有頁面
2. 新增功能
3. 效能優化
4. 正式上線準備

回覆「請讀取 docs/，[任務描述]」→ AI 依文檔回報

═══════════════════════════════════════════════════════
【結束】
═══════════════════════════════════════════════════════