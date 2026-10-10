# 交付進度

最後更新：B21
當前批次：B20
狀態：B20 已部署，待測試

---

## 總覽

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
| B09 | Pages | 13 | ✅ |
| B10 | Functions API | 12+ | ✅ |
| B11 | 實戰修復（13 問題） | 20+ | ✅ |
| B12 | 阻斷級修復 | 5 + 刪 7 | ✅ |
| B13 | SSOT 統一 | 17 | ✅ |
| B14 | 中優先 | 12 | ✅ |
| B15 | 低優先 | 5 | ✅ |
| B16 | 問題清單修正（P16） | 13 | ✅ |
| B17 | 問題清單修正（P17） | 9 | ✅ |
| B18 | entity-resolvers + portfolio | 4 | ✅ |
| B18.1 | page-engine onDataChange | 2 | ✅ |
| B19 | 無補丁重構 | 11 | ✅ |
| B20 | 第二輪測試修復（P18） | 10 | ⏳ 待測 |
| B21 | docs 重構 | 13 | 🔄 進行中 |

---

## B11：實戰修復（摘要）

**主題**：首次部署後 13 個問題

| 編號 | 問題 | 狀態 |
|---|---|---|
| P01 | CF Functions 路由 500 | ✅ |
| P02 | HTML 缺 .html 匹配 .js | ✅ |
| P03 | _redirects 重定向循環 | ✅ |
| P04 | page-engine 缺 customMount | ✅ |
| P05 | _onKeyChange 缺 data. 前綴 | ✅ |
| P06 | esc 從錯誤檔導入 | ✅ |
| P07 | derived 對 undefined 崩潰 | ✅ |
| P08 | 手機無 Console | ✅ |
| P09 | app-shell 靜態 import 崩潰 | ✅ |
| P10 | SW stale-while-revalidate | ✅ |
| P11 | GitHub 檔案未更新 | ⚠️ 流程 |
| P12 | database.js 內容錯誤 | ✅ |
| P13 | js/shared/* 舊 import | ✅ |

詳見 `incident-log.md`。

---

## B12：阻斷級修復（摘要）

| 編號 | 問題 | 狀態 |
|---|---|---|
| B01 | settings.js 內容錯誤 | ✅ |
| B02 | 舊合併版 Functions 衝突 | ✅ |
| B03 | {__all__} 佔位符 | ✅ |
| B04 | page-engine 缺 undefined 檢查 | ✅ |
| B05 | input-center.html 缺按鈕容器 | ✅ |
| B06 | settlements.js 死代碼 | ✅ |
| B07 | settlements.js 重複版本 | ✅ |

---

## B13：SSOT 統一（摘要）

| 編號 | 問題 | 狀態 |
|---|---|---|
| H01 | 版本號不一致 | ✅ |
| H02 | core/utils.js 格式化重複 | ✅ |
| H03 | escapeHtml vs esc | ✅ |
| H04 | js/shared/* 未重構 | ✅ |
| H05 | column-settings 未走 ui/modal | ✅ |
| H06 | listener-group 功能重疊 | ✅ |
| H07 | form-handler 功能重疊 | ✅ |
| H08 | column-registry 路徑錯 | ✅ |
| H09 | db.js 廢除節點仍寫 | ✅ |
| H10 | auth-guard fallback 安全 | ✅ |
| H11 | db.js PLATFORM_PATHS 重複 | ✅ |

---

## B14：中優先（摘要）

B14A / B14B / B14C，修 M01~M18。

重點：
- dashboard 年度資料讀取
- tab-panel / view-toggle 用 STORAGE_PREFIXES
- utils / state 修正
- portfolio allRows
- annual-report 年度計算 + CSV
- member-report personalIncome
- db saveIncome 用 update
- debug.js 預設關閉

---

## B15：低優先（摘要）

修 L01~L07。

重點：
- navbar 死代碼移除
- sidebar 多餘 async 移除
- quick-summary 命名修正
- form-block / finance-overview 移除未使用 import

---

## B16：問題清單修正（摘要）

修 P16-01~P16-05。

重點：
- 新增支出 Modal
- 年度報表月度明細
- 成員名稱 resolveName
- 系統設定個人化 Tab
- 基金表格 block

---

## B17：問題清單修正（摘要）

修 P17-01~P17-06。

重點：
- 年度報表改用 blocks
- 基金表格加 block
- onYearMonthChange hook
- resolveName 補強
- input-center 改用 listenAllExpenses
- entity-list-page 傳 resolvers

---

## B18：entity-resolvers + portfolio

| # | 檔案 | 變更 |
|---|---|---|
| 1 | `js/entity/entity-resolvers.js` | 🆕 新增 |
| 2 | `js/shared/entity-list-page.js` | 傳 resolvers |
| 3 | `js/pages/portfolio.js` | blocks |
| 4 | `portfolio.html` | view toggle 容器 |

---

## B18.1：page-engine onDataChange

| # | 檔案 | 變更 |
|---|---|---|
| 1 | `js/engines/page-engine.js` | 加 ctx.onDataChange |
| 2 | `js/pages/dashboard.js` | 用 onDataChange |

---

## B19：無補丁重構

**主題**：全面無補丁

| # | 檔案 | 變更 |
|---|---|---|
| 1 | `js/blocks/list-block.js` | renderInPlace |
| 2 | `js/blocks/stats-block.js` | renderInPlace |
| 3 | `js/shared/data-table.js` | renderInPlace |
| 4 | `js/lib/expense-modal.js` | 🆕 共用 |
| 5 | `js/lib/income-modal.js` | 🆕 共用 |
| 6 | `js/lib/filter-sort.js` | 🆕 共用 |
| 7 | `js/pages/insurance.js` | 重構 |
| 8 | `js/pages/annual-report.js` | 重構 |
| 9 | `js/pages/finance-overview.js` | 重構 |
| 10 | `js/pages/input-center.js` | 重構（-420 行） |
| 11 | `js/pages/settlements.js` | 重構（-100 行） |

---

## B20：第二輪測試修復

**主題**：B19 部署後 5 個問題

| # | 檔案 | 問題 |
|---|---|---|
| 1 | `js/ui/view-toggle.js` | 加 cardValue / tableValue |
| 2 | `css/layout.css` | .sidebar-nav min-height: 0 |
| 3 | `settlements.html` | 加 toggle 容器 |
| 4 | `member-report.html` | 加 toggle 容器 |
| 5 | `js/pages/settlements.js` | 加 toggle |
| 6 | `js/pages/member-report.js` | 加 toggle + 副標題 |
| 7 | `js/pages/input-center.js` | 支出 Tab 加 toggle |
| 8 | `js/pages/annual-report.js` | 用 cardValue/tableValue |
| 9 | `js/pages/insurance.js` | 已供滿展開 |
| 10 | `js/pages/finance-overview.js` | 副標題更新 |

---

## B21：docs 重構（進行中）

**主題**：docs 全盤重構

| # | 檔案 | 狀態 |
|---|---|---|
| 1 | `anchor.md` | ✅ |
| 2 | `ai-guide.md` | ✅ |
| 3 | `file-manifest.md` | ✅ |
| 4 | `progress.md` | 🔄 本檔 |
| 5 | `sop.md` | 待交付 |
| 6 | `adr.md` | 待交付 |
| 7 | `page-map.md` | 待交付 |
| 8 | `README.md` | 待交付 |
| 9 | `delivery-rules.md` | 待交付 |
| 10 | `incident-log.md` | 待交付 |
| 11 | `refactor-plan.md` | 待交付 |
| 12 | `api-contracts.md` | 待交付 |
| 13 | `data-structure.md` | 待交付 |
| 14 | `compatibility.md` | 待交付 |

---

## 下一步

| 項目 | 狀態 |
|---|---|
| B20 部署 | ✅ 完成 |
| B20 測試 | ⏳ 待回報 |
| B21 docs | 🔄 進行中 |

**待測試完成**：
- 若無誤 → 進入正式上線準備
- 若有誤 → 交付 B22 修復

---

/* ═══════════════════════════════════════════
   END OF FILE
   File: docs/progress.md
   Version: v103.0.19
   Batch: B21
   ═══════════════════════════════════════════ */