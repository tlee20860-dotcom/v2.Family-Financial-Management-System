# 事故日誌

最後更新：B21
適用批次：B11 ~ B20

**用途**：記錄歷史問題，避免重複犯錯

**格式**：每項含「症狀 / 原因 / 解決 / 教訓」

---

## 總覽

| 批次 | 編號 | 主題 | 嚴重度 |
|---|---|---|---|
| B11 | P01~P13 | 首次部署 13 問題 | 🔴 多項阻斷 |
| B12 | B01~B07 | 阻斷級修復 | 🔴 多項阻斷 |
| B13 | H01~H11 | SSOT 統一 | 🟠 高 |
| B14 | M01~M18 | 中優先 | 🟡 中 |
| B15 | L01~L07 | 低優先 | 🟢 低 |
| B16 | P16-01~05 | 第二輪測試 | 🟠 高 |
| B17 | P17-01~06 | 第三輪測試 | 🔴 多項阻斷 |
| B18 | — | entity-resolvers | 🟡 中 |
| B18.1 | — | onDataChange | 🟡 中 |
| B19 | — | 無補丁重構 | 🟡 中 |
| B20 | P18-01~05 | 第四輪測試 | 🟠 高 |

---

## B11：首次部署（P01~P13）

### P01 CF Functions 路由 500

| 項目 | 內容 |
|---|---|
| 症狀 | GET /api/lookup-family → 500；No such module "family.js" |
| 原因 | CF Pages Functions 每個 URL 需對應獨立實體檔；跨檔 re-export 不支援 |
| 解決 | 主檔改 `_xxx.js`；加 `[[path]].js` Catch-all 分派 |
| 教訓 | 用「底線前綴 + Catch-all」最穩定 |

### P02 HTML 缺 .html 匹配到 .js

| 項目 | 內容 |
|---|---|
| 症狀 | 訪問 /database → 顯示 database.js 原始碼 |
| 原因 | CF 路由優先序：先找 .html，找不到才匹配 .js |
| 解決 | SIDEBAR_GROUPS 所有 href 加 .html |
| 教訓 | 內部連結一律帶 .html |

### P03 _redirects 重定向循環

| 項目 | 內容 |
|---|---|
| 症狀 | ERR_TOO_MANY_REDIRECTS |
| 原因 | _redirects 對 / 加 200 內部改寫，CF 已預設處理 |
| 解決 | 刪除 _redirects |
| 教訓 | 不要對 / 加 _redirects 規則 |

### P04 page-engine 缺 customMount

| 項目 | 內容 |
|---|---|
| 症狀 | 5 個頁面空白（input-center / settings / database / settlements / insurance） |
| 原因 | createPage 只處理 schema.blocks，沒呼叫 customMount |
| 解決 | 加 `if (typeof schema.customMount === 'function')` |
| 教訓 | customMount 是重要逃生艙 |

### P05 _onKeyChange 缺 data. 前綴

| 項目 | 內容 |
|---|---|
| 症狀 | 統計卡顯示 0；derived 不重算 |
| 原因 | 依賴圖註冊 key 帶前綴，callback 呼叫時缺 |
| 解決 | `_onKeyChange(ctx, schema, 'data.' + key)` |
| 教訓 | 依賴圖與事件觸發 key 必須一致 |

### P06 esc 從錯誤檔導入

| 項目 | 內容 |
|---|---|
| 症狀 | SyntaxError: does not provide an export named 'esc' |
| 原因 | esc 在 lib/dom.js，但從 lib/format.js 導入 |
| 解決 | import { esc } from '../lib/dom.js' |
| 教訓 | esc → dom.js；format* → format.js |

### P07 derived 對 undefined 崩潰

| 項目 | 內容 |
|---|---|
| 症狀 | derived.statsCards 計算失敗：Cannot read properties of undefined |
| 原因 | 非同步資料初始未到，derived 計算時 data 為 undefined |
| 解決 | _computeOne 加 undefined 檢查 |
| 教訓 | derived 計算必須容忍 undefined |

### P08 手機無 Console

| 項目 | 內容 |
|---|---|
| 症狀 | 手機除錯困難 |
| 解決 | 內嵌 vConsole（js/core/debug.js） |
| 教訓 | 手機必須內嵌 vConsole |

### P09 app-shell 靜態 import 崩潰

| 項目 | 內容 |
|---|---|
| 症狀 | 側邊欄空白；全站崩潰 |
| 原因 | app-shell.js 頂部靜態 import debug.js，缺失時整檔失敗 |
| 解決 | 改動態 import + try-catch |
| 教訓 | 非必要模組一律用動態 import |

### P10 SW stale-while-revalidate

| 項目 | 內容 |
|---|---|
| 症狀 | 部署新檔後需訪問兩次才生效 |
| 解決 | 全部改 network-first |
| 教訓 | 開發階段用 network-first |

### P11 GitHub 檔案未真正更新

| 項目 | 內容 |
|---|---|
| 症狀 | 本機改了但線上仍是舊版 |
| 解決 | GitHub 網頁編輯（按 .）最安全 |
| 教訓 | 部署後直接訪問檔案 URL 驗證 |

### P12 database.js 內容錯誤

| 項目 | 內容 |
|---|---|
| 症狀 | database.html 顯示 dashboard 內容 |
| 原因 | 複製貼上時誤覆蓋 |
| 解決 | 完全覆蓋為正確 Schema |
| 教訓 | 複製貼上時務必確認目標檔案 |

### P13 js/shared/* 舊 import 路徑

| 項目 | 內容 |
|---|---|
| 症狀 | Failed to resolve module specifier |
| 原因 | 檔案從 shared/ 移到 ui/ / entity/ / lib/，但舊檔仍 import 舊路徑 |
| 解決 | 全部按 v103 交付紀錄覆蓋 |
| 教訓 | 檔案搬移後全域搜尋舊路徑 |

---

## B12：阻斷級修復（B01~B07）

| 編號 | 症狀 | 原因 | 解決 |
|---|---|---|---|
| B01 | settings.html 顯示 settlements 邏輯 | 複製貼上誤覆蓋（同 P12） | 完全重寫 |
| B02 | 舊合併版 Functions 與 [[path]].js 衝突 | 同時存在舊版與新版 | 刪 7 個舊檔 |
| B03 | finance-overview / member-report 結構錯 | data-engine 未支援 {__all__} | 加 {__all__} + type: 'raw' |
| B04 | portfolio / member-report derived 崩潰 | page-engine 缺 undefined 檢查（同 P07） | 補 hasUndefinedDep |
| B05 | 輸入中心上方按鈕無效 | HTML 缺 ic-buttons-root | 加容器 |
| B06 | settlements.js 死代碼 | 表格用 badge 非 select | 移除監聽器 |
| B07 | settlements.js 兩份版本 | v103.0.6 + v103.0.11 | 保留 v103.0.11 |

---

## B13：SSOT 統一（H01~H11）

| 編號 | 主題 | 解決 |
|---|---|---|
| H01 | 版本號不一致 | 統一 |
| H02 | utils 格式化重複 format.js | re-export |
| H03 | escapeHtml vs esc | re-export |
| H04 | js/shared/* 12 檔未重構 | 改 import from lib/ |
| H05 | column-settings 未走 ui/modal | 改用 openModal |
| H06 | listener-group 功能重疊 | deprecated |
| H07 | form-handler 功能重疊 | deprecated |
| H08 | column-registry 路徑錯 | format* → lib/format.js |
| H09 | db.js 廢除節點仍寫 | 移除 updateFixedExpenseCompat |
| H10 | auth-guard fallback 安全 | 改唯讀 |
| H11 | db.js PLATFORM_PATHS 重複 | 從 constants 導入 |

---

## B14：中優先（M01~M18）

| 編號 | 主題 |
|---|---|
| M01 | listenPlatformResource object 型強制轉 list |
| M02 | dashboard 3 卡片永遠 HK$ 0 |
| M03 | portfolio _fundActions 未傳 allRows |
| M04 | form-builder onSubmit 簽名混亂 |
| M05 | tab-panel / view-toggle 直接讀寫 localStorage |
| M06 | db.js saveIncome 用 set() 非 update() |
| M07 | getMemberDisplayName 回傳「（未知）」 |
| M08 | getRoleLabel 硬編碼中文 |
| M09 | input-center 支出 Tab 未實作 |
| M10 | annual-report membersRows 只原樣返回 |
| M11 | annual-report export-excel-btn 未綁定 |
| M12 | member-report personalIncome 硬編碼 0 |
| M13 | 用 shared/stats-cards 非 blocks/stats-block |
| M14 | login.html 硬編碼 AUTH_CONTEXT_CACHE_PREFIX |
| M15 | inline vConsole 只在 2 頁 |
| M16 | debug.js 預設啟用 vConsole |
| M17 | entity-definitions 從 db.js 導入大量函式 |
| M18 | 保單建立後再次寫入 advanceId |

---

## B15：低優先（L01~L07）

| 編號 | 主題 |
|---|---|
| L01 | navbar _bindGlobalEvents 空 return 分支 |
| L02 | sidebar renderSidebar 多餘 async |
| L03 | quick-summary _renderAssetPie 命名不符 |
| L04 | page-filter 導入 escapeHtml 未使用 |
| L05 | form-block 導入 esc 未使用 |
| L06 | 3 檔導入 createPage 未使用 |
| L07 | utils.uid 用 Math.random() |

---

## B16：第二輪測試（P16-01~05）

| 編號 | 症狀 | 原因 | 解決 |
|---|---|---|---|
| P16-01 | 新增支出開錯 Modal | input-center.js 佔位實作 | 寫新支出 Modal |
| P16-02 | 年度報表缺月度明細切換 | 未實作 | 加年份 + 月份切換 |
| P16-03 | 成員名稱顯示 push key | resolver 只 escapeHtml(val) | resolveName('members', ...) |
| P16-04 | 系統設定缺成員資料 | customMount 只保留 Tab | 補 _initPersonalTab |
| P16-05 | 基金版面沒資料 | display:none 隱藏 | 改 blocks |

---

## B17：第三輪測試（P17-01~06）

| 編號 | 症狀 | 原因 | 解決 |
|---|---|---|---|
| P17-01 | 年度報表資料沒顯示 | derived 依賴非同步；blocks:[] 無通知 | 改用 blocks |
| P17-02 | 基金表格沒資料 | 只有 stats block | 加 table block |
| P17-03 | 年月沒連動 | customMount 沒訂閱 ym-change | 加 onYearMonthChange hook |
| P17-04 | 類別顯示 ID | resolver 只 escapeHtml(val) | resolveName('categories', ...) |
| P17-05 | 輸入中心沒支出 | listenAllMemberExpenses(null, null) 失敗 | 改用 listenAllExpenses |
| P17-06 | 保險持單人顯示 ID | entity-list-page 沒傳 resolvers | 新增 entity-resolvers.js |

---

## B20：第四輪測試（P18-01~05）

| 編號 | 症狀 | 原因 | 解決 |
|---|---|---|---|
| P18-01 | 多頁缺 view toggle | 頁面未初始化 initViewToggle | 各頁呼叫 + HTML 加容器 |
| P18-02 | 年度報表月度明細沒資料 | view-toggle 硬編碼 card/table | 加 cardValue/tableValue |
| P18-03 | 已供滿保單不能展開 | insurance.js 遺漏展開邏輯 | 加展開 handler |
| P18-04 | 副標題顯示「載入中」 | 未更新副標題 | 各頁 syncSubtitle |
| P18-05 | 側欄不能滑到底 | flex 子項缺 min-height: 0 | 加 min-height |

---

## 歷史重演警告

以下問題**重複發生**，需特別注意：

| 類型 | 首次 | 再次 | 防止 |
|---|---|---|---|
| 複製貼上誤覆蓋 | P12 database.js | B01 settings.js | 交付前確認目標檔案 |
| page-engine 修正遺漏 | P07 缺 undefined | B04 又缺 | 改 page-engine 需回歸測試 |
| 舊 import 路徑殘留 | P13 js/shared/* | B02 舊 Functions | 檔案搬移後全域搜尋 |

---

## 核心教訓總結

### CF Pages 相關

| 教訓 | 說明 |
|---|---|
| Functions 路由 | 每個 URL 對應獨立實體檔 |
| 不支援 shim | 用底線前綴 + Catch-all |
| 靜態檔案 | 所有連結帶 .html |
| _redirects | 不要對 / 加規則 |

### Page Engine 相關

| 教訓 | 說明 |
|---|---|
| customMount | 必須支援 |
| onDataChange | 必須支援統一通知 |
| 依賴圖 | key 與事件觸發一致 |
| undefined | derived 需容忍 |

### 程式碼相關

| 教訓 | 說明 |
|---|---|
| esc 路徑 | 從 lib/dom.js |
| format* 路徑 | 從 lib/format.js |
| 檔案搬移 | 全域搜尋舊路徑 |
| 無補丁 | 寧願重寫 |

### 部署相關

| 教訓 | 說明 |
|---|---|
| 訪問檔案 URL | 驗證部署 |
| GitHub 網頁編輯 | 最安全 |
| SW network-first | 開發階段 |
| vConsole | 手機必備 |

### 交付相關

| 教訓 | 說明 |
|---|---|
| 先方案後交付 | 待確認 |
| 完整檔案 | 不 diff |
| END OF FILE | 檢查完整性 |
| 檔案 ≤ 500 行 | 拆檔 |

---

/* ═══════════════════════════════════════════
   END OF FILE
   File: docs/incident-log.md
   Version: v103.0.19
   Batch: B21
   ═══════════════════════════════════════════ */