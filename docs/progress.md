# 交付進度 — v103.0.18

最後更新：B19
最新批次：B19
狀態：B19 部署完成，待測試

═══════════════════════════════════════════════════════
【總覽】
═══════════════════════════════════════════════════════

| 批次 | 主題 | 檔案數 | 狀態 |
|---|---|---|---|
| B01 | 5 Registry + constants | 5 | ✅ |
| B02 | Core 基礎 | 7 | ✅ |
| B03 | Lib 工具集 | 8 | ✅ |
| B04 | UI 元件 | 6 | ✅ |
| B05 | Layout | 3 | ✅ |
| B06 | Entity | 3 | ✅ |
| B07 | Engines | 3 | ✅ |
| B08 | Blocks | 5 | ✅ |
| B09 | Pages（13 Schema） | 13 | ✅ |
| B10 | Functions API + 系統層 | 12+ | ✅ |
| B11 | 實戰修復（13 問題） | 20+ | ✅ |
| B12 | 阻斷級修復 | 5 + 刪 7 | ✅ |
| B13 | SSOT 統一 | 17 | ✅ |
| B14 | 中優先 | 12 | ✅ |
| B15 | 低優先 | 5 | ✅ |
| B16 | 問題清單修正（P16） | 13 | ✅ |
| B17 | 問題清單修正（P17） | 9 | ✅ |
| B18 | entity-resolvers + portfolio | 4 | ✅ |
| B18.1 | page-engine onDataChange | 2 | ✅ |
| B19 | 無補丁重構 | 10 | ✅ |

═══════════════════════════════════════════════════════
【B01~B11：重構階段】（摘要）
═══════════════════════════════════════════════════════

詳見舊版 progress.md（已省略）。

═══════════════════════════════════════════════════════
【B12：阻斷級修復】✅
═══════════════════════════════════════════════════════

主題：修復 B01~B07 阻斷級問題

| # | 檔案 | 變更 |
|---|---|---|
| 1 | `js/engines/data-engine.js` | 支援 {__all__} + type:'raw' |
| 2 | `js/engines/page-engine.js` | 補 undefined 檢查 |
| 3 | `input-center.html` | 補 ic-buttons-root |
| 4 | `js/pages/input-center.js` | 綁定按鈕 + 支出 Tab |
| 5 | `js/pages/settlements.js` | 移除死代碼 |
| 🗑 | functions/api/{admin,bank,family,insurance,personal,platform,summary}.js | 刪除 |

═══════════════════════════════════════════════════════
【B13：SSOT 統一】✅
═══════════════════════════════════════════════════════

主題：修復 H01~H11

| # | 檔案 | 變更 |
|---|---|---|
| 1 | `js/config/constants.js` | 版本號統一 |
| 2 | `js/core/db.js` | 移除 updateFixedExpenseCompat |
| 3 | `js/core/utils.js` | 格式化 re-export |
| 4 | `js/core/auth-guard.js` | fallback 唯讀 |
| 5 | `js/config/column-registry.js` | 路徑修正 |
| 6 | `js/shared/bank-account-manager.js` | 路徑修正 |
| 7 | `js/shared/column-settings.js` | 路徑修正 |
| 8 | `js/shared/data-card.js` | 路徑修正 |
| 9 | `js/shared/data-table.js` | 路徑修正 |
| 10 | `js/shared/entity-list-page.js` | 路徑修正 |
| 11 | `js/shared/page-filter.js` | 路徑修正 |
| 12 | `js/shared/quick-summary.js` | 路徑修正 |
| 13 | `js/shared/select-helpers.js` | 路徑修正 |
| 14 | `js/shared/stats-cards.js` | 路徑修正 |
| 15 | `js/shared/form-handler.js` | deprecated |
| 16 | `js/shared/listener-group.js` | deprecated |
| 17 | `sw.js` | 版本統一 |

═══════════════════════════════════════════════════════
【B14：中優先】✅
═══════════════════════════════════════════════════════

主題：修復 M01~M18

包含 B14A、B14B、B14C

| # | 檔案 | 變更 |
|---|---|---|
| 1 | `js/pages/dashboard.js` | 年度資料讀取 |
| 2 | `js/ui/tab-panel.js` | STORAGE_PREFIXES |
| 3 | `js/ui/view-toggle.js` | STORAGE_PREFIXES |
| 4 | `js/core/utils.js` | M07 修正 |
| 5 | `js/core/state.js` | M08 修正 |
| 6 | `js/pages/portfolio.js` | allRows |
| 7 | `js/ui/form-builder.js` | 簽名文件化 |
| 8 | `js/pages/annual-report.js` | 年度計算 + CSV |
| 9 | `js/pages/member-report.js` | personalIncome |
| 10 | `js/core/db.js` | saveIncome 用 update |
| 11 | `login.html` | SESSION_KEYS |
| 12 | `insurance.html` | 移除 inline vConsole |
| 13 | `settlements.html` | 移除 inline vConsole |
| 14 | `js/core/debug.js` | 預設關閉 |

═══════════════════════════════════════════════════════
【B15：低優先】✅
═══════════════════════════════════════════════════════

主題：修復 L01~L07

| # | 檔案 | 變更 |
|---|---|---|
| 1 | `js/layout/navbar.js` | 移除死代碼 |
| 2 | `js/layout/sidebar.js` | 移除多餘 async |
| 3 | `js/shared/quick-summary.js` | _renderAssetBar |
| 4 | `js/blocks/form-block.js` | 移除未使用 import |
| 5 | `js/pages/finance-overview.js` | 移除未使用 import |

═══════════════════════════════════════════════════════
【B16：問題清單修正（P16）】✅
═══════════════════════════════════════════════════════

主題：修復 P16-01~P16-05

| # | 檔案 | 變更 |
|---|---|---|
| 1 | `js/config/column-registry.js` | resolveName |
| 2 | `js/shared/entity-list-page.js` | resolvers |
| 3 | `js/pages/insurance.js` | ym-change |
| 4 | `js/pages/finance-overview.js` | ym-change |
| 5 | `js/pages/dashboard.js` | ym-change |
| 6 | `js/pages/member-report.js` | ym-change |
| 7 | `js/pages/input-center.js` | listenAllExpenses |
| 8 | `js/pages/annual-report.js` | derived 顯示 |
| 9 | `js/pages/portfolio.js` | table block |
| 10 | `portfolio.html` | view toggle |
| 11 | `js/pages/settings.js` | 個人化 Tab |
| 12 | `js/core/debug.js` | 手動 API |
| 13 | `js/pages/settlements.js` | 編輯 Modal |

═══════════════════════════════════════════════════════
【B17：問題清單修正（P17）】✅
═══════════════════════════════════════════════════════

主題：修復 P17-01~P17-06

| # | 檔案 | 變更 |
|---|---|---|
| 1 | `js/engines/page-engine.js` | onYearMonthChange hook |
| 2 | `js/config/column-registry.js` | resolveName + debug log |
| 3 | `js/pages/insurance.js` | resolveName |
| 4 | `js/pages/finance-overview.js` | 刪 _getBankHelper |
| 5 | `js/pages/dashboard.js` | onDataChange |
| 6 | `js/pages/member-report.js` | onDataChange |
| 7 | `js/pages/input-center.js` | listenAllExpenses |
| 8 | `js/pages/annual-report.js` | blocks |
| 9 | `js/pages/portfolio.js` | table block |

═══════════════════════════════════════════════════════
【B18：entity-resolvers + portfolio】✅
═══════════════════════════════════════════════════════

| # | 檔案 | 變更 |
|---|---|---|
| 1 | `js/entity/entity-resolvers.js` | 🆕 新增 |
| 2 | `js/shared/entity-list-page.js` | 傳 resolvers |
| 3 | `js/pages/portfolio.js` | blocks |
| 4 | `portfolio.html` | view toggle 容器 |

═══════════════════════════════════════════════════════
【B18.1：page-engine onDataChange】✅
═══════════════════════════════════════════════════════

| # | 檔案 | 變更 |
|---|---|---|
| 1 | `js/engines/page-engine.js` | 加 ctx.onDataChange |
| 2 | `js/pages/dashboard.js` | 用 onDataChange |

═══════════════════════════════════════════════════════
【B19：無補丁重構】✅
═══════════════════════════════════════════════════════

主題：全面無補丁重構

| # | 檔案 | 變更 |
|---|---|---|
| 1 | `js/blocks/list-block.js` | renderInPlace |
| 2 | `js/blocks/stats-block.js` | renderInPlace |
| 3 | `js/shared/data-table.js` | renderInPlace |
| 4 | `js/lib/expense-modal.js` | 🆕 共用 Modal |
| 5 | `js/lib/income-modal.js` | 🆕 共用 Modal |
| 6 | `js/lib/filter-sort.js` | 🆕 共用 helper |
| 7 | `js/pages/insurance.js` | 重構 |
| 8 | `js/pages/annual-report.js` | 重構 |
| 9 | `js/pages/finance-overview.js` | 重構 |
| 10 | `js/pages/input-center.js` | 重構（-420 行） |
| 11 | `js/pages/settlements.js` | 重構（-100 行） |

═══════════════════════════════════════════════════════
【下一步】
═══════════════════════════════════════════════════════

B19 部署完成，待測試。

若測試無誤：
1. 更新完整 docs/（anchor + progress + README + incident-log）
2. 進入正式上線準備

若測試有誤：
1. 修復問題，交付 B20
2. 更新 docs/

═══════════════════════════════════════════════════════
【結束】
═══════════════════════════════════════════════════════