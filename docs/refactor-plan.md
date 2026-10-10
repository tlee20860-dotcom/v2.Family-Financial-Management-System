# 重構計畫 — v102.1.0 → v103.0.19

最後更新：B21
狀態：重構完成 ✅
實際執行：含 B12~B20 修復

方案代號：F（終極宣告式）

---

## 一、方案選擇

### 方案對比

| 方案 | 檔案數 | 行數 | 頁面層 | 風險 |
|---|---|---|---|---|
| A 最小修復 | 104 | 28,000 | 9,000 | 極低 |
| B 模組化 | 89 | 24,000 | 7,500 | 低 |
| C Registry | 91 | 22,000 | 6,500 | 中 |
| D Blocks | 92 | 21,000 | 5,000 | 中 |
| E 響應式 | 90 | 20,000 | 3,000 | 中高 |
| F 終極宣告式 | 95 | 19,300 | 1,200 | 中高 |

### 選擇 F 理由

| 理由 | 說明 |
|---|---|
| 一次性解決 | 所有問題一次重構 |
| 頁面精簡 | 頁面層精簡 87% |
| 新增成本低 | 未來頁面只需 Schema |
| 相容層小 | < 300 行 |

### 實際結果（v103.0.19）

| 項目 | 預期 | 實際 |
|---|---|---|
| 檔案數 | 95 | 約 118（含 docs / 新增） |
| 頁面層行數 | 1,200 | ~1,600（含 customMount） |

---

## 二、目標架構

### 三層架構

| 層級 | 職責 | 檔案 |
|---|---|---|
| L1 頁面層 | 純 Schema | js/pages/*.js |
| L2 引擎層 | 解讀 + 生命週期 | js/engines/*.js |
| L3 核心層 | Registry + Block + State + API | js/config, blocks, core |

### 資料流

Firebase RTDB → data-engine → page-engine → derived → block → DOM

---

## 三、5 大 Registry

| Registry | 職責 | 檔案 |
|---|---|---|
| status-registry | 狀態系統 | js/config/status-registry.js |
| entity-registry | 名稱解析 | js/config/entity-registry.js |
| label-registry | 顯示文字 | js/config/label-registry.js |
| column-registry | 表格欄位 | js/config/column-registry.js |
| constants | 全站常數 | js/config/constants.js |

### status-registry 內容

| 項目 | 說明 |
|---|---|
| STATUS | pending / done / skipped |
| IS_DONE | 判定表 |
| LABELS | 依來源的顯示文字 |
| LEGACY_MAP | 舊名稱 → 新代碼 |
| API | normalize / isDone / label / options / badgeClass |

### entity-registry 內容

| 項目 | 說明 |
|---|---|
| PATHS | 7 種實體路徑 |
| API | init / destroy / resolveName / getList / getNameMap |

### label-registry 內容

| 分類 | 用途 |
|---|---|
| common | 通用 |
| pages | 頁面標題 |
| fields | 欄位 |
| actions | 動作 |
| confirm | 確認對話框 |
| toast | Toast 訊息 |
| emptyState | 空狀態 |
| nav | 導覽 |
| roles | 角色 |

### column-registry 內容

| 項目 | 說明 |
|---|---|
| COLUMNS | 16 種表格欄位 |
| RESOLVERS | 值轉換函式 |
| API | getColumns / getResolvers |

### constants 內容

| 分類 | 內容 |
|---|---|
| 版本 | APP_VERSION / SW_VERSION |
| Storage | STORAGE_KEYS / PREFIXES / SESSION_KEYS |
| 限制 | LIMITS |
| ID | RESERVED_IDS |
| 角色 | ROLES / SOURCES |
| 交易 | BANK_TXN_* / PAYMENT_MODES |
| 實體 | ENTITY_KEYS |
| 導覽 | SIDEBAR_GROUPS / ROUTES |
| 預設 | DEFAULT_* |
| 平台資源 | PLATFORM_RESOURCES |
| 工具 | buildLinkedKey / buildColumnSettingsKey |

---

## 四、3 大引擎

### page-engine.js

| 項目 | 說明 |
|---|---|
| 職責 | 解讀 Schema、生命週期、onDataChange |
| 對外 | createPage(schema) → { ctx, destroy, ready } |
| ctx 提供 | state / data / derived / invalidate / setState / onDataChange |
| schema 支援 | title / data / state / derived / blocks / onYearMonthChange / customMount |

### data-engine.js

| 項目 | 說明 |
|---|---|
| 職責 | Firebase 訂閱 + 衍生 |
| type | list / object / value / raw |
| 路徑 | 支援 {key} 與 {__all__} |
| 對外 | subscribe / fetchOnce / makeReactive / resolvePath |

### render-engine.js

| 項目 | 說明 |
|---|---|
| 職責 | 掛載 UI 區塊 |
| 對外 | mountBlock / resolveExpr / resolveDeep / collectBlockDeps |

---

## 五、5 大 Block

| Block | 職責 | 對應舊元件 |
|---|---|---|
| stats-block | 統計卡區 | stats-cards |
| list-block | 列表區 | data-table + data-card + view-toggle |
| filter-block | 篩選列區 | page-filter |
| detail-block | 明細展開區 | 各頁 renderDetail |
| form-block | 表單 Modal 區 | entity-modal + form-builder |

**B19 起**：所有 block 加 `renderInPlace`（同 HTML 不重繪）。

**Block 對外 API**：

| 項目 | 說明 |
|---|---|
| mount(block, ctx) | 回傳 { onDepsChange, destroy } |

---

## 六、檔案結構變動

### 刪除（重構期間）

| 類型 | 檔案 |
|---|---|
| 舊頁面子目錄 | input-center / database / settlements / insurance |
| 舊 core | core/app.js（改 layout/app-shell） |
| 舊 Functions | admin.js / bank.js / family.js / insurance.js / personal.js / platform.js / summary.js（合併版） |
| 舊 shared | 部分重組至 ui / layout / entity / lib |

### 新增（重構期間）

| 類型 | 檔案數 |
|---|---|
| Registry | 5 |
| Lib | 4（dom / async / lifecycle / registry） |
| Engines | 3 |
| Blocks | 5 |
| Layout | 1（app-shell） |
| Core | 1（debug） |
| Entity | 1（entity-resolvers） |
| Lib 追加 | 3（expense-modal / income-modal / filter-sort） |
| Functions | 8（_admin / _bank / _family / _insurance / _personal / _platform / _summary / [[path]]） |

### 修改（~50 檔）

修正 import 路徑、修復邏輯錯誤、無補丁重構。

---

## 七、舊資料相容

詳見 `compatibility.md`。

| 舊資料 | 相容策略 |
|---|---|
| 舊狀態名稱 | status.normalize() 轉換 |
| 舊 banks 節點 | entity-registry 註冊 |
| 舊 bank_balances | 不讀寫 |
| 舊 fixed_expenses | summary.js 讀取 |
| 舊 linked_xxx | merge.js 解析 |
| 缺 paymentMode | fallback 'direct' |
| 缺 memberId | 3 層 fallback |

---

## 八、效能保證

| 措施 | 說明 |
|---|---|
| CF Pages + Brotli | 自動壓縮 |
| 引擎 ~700 行 | ~15KB gzip |
| modulepreload | 並行載入 |
| Firebase 監聽 | 集中訂閱 |
| Functions Catch-all | 統一入口 |
| Block renderInPlace | 不 destroy/create |

---

## 九、重構成果

### 對比表

| 項目 | v102 | v103.0.19 |
|---|---|---|
| 檔案數 | 104 | 約 118 |
| 頁面層行數 | 9,000 | ~1,600 |
| Registry 集中 | 0 | 5 |
| Engine | 0 | 3 |
| Block | 0 | 5 |
| Page Schema | 0 | 13 |
| 手機除錯 | 無 | vConsole |
| SW 策略 | stale | network-first |
| 無補丁 | ❌ | ✅（B19） |
| 統一自動更新 | ❌ | ✅（onDataChange） |
| 共用 Modal | ❌ | ✅（lib/*-modal） |
| 共用 filter-sort | ❌ | ✅（lib/filter-sort） |

### 關鍵成果

| 成果 | 說明 |
|---|---|
| 頁面精簡 | 82% |
| SSOT 集中 | 5 Registry |
| 宣告式 | 3 引擎 |
| 可重用 | 5 Block |
| Page Schema | 13 個 |
| 舊資料相容 | 100% |
| 操作邏輯不變 | 只改實作 |
| 手機除錯 | vConsole |
| 無補丁 | 全面重構 |

---

## 十、重構期間挑戰（B12~B20）

詳見 `incident-log.md`。

| 批次 | 主題 | 檔案數 |
|---|---|---|
| B12 | 阻斷級修復（B01~B07） | 5 + 刪 7 |
| B13 | SSOT 統一（H01~H11） | 17 |
| B14 | 中優先（M01~M18） | 12 |
| B15 | 低優先（L01~L07） | 5 |
| B16 | 第二輪測試（P16-01~05） | 13 |
| B17 | 第三輪測試（P17-01~06） | 9 |
| B18 | entity-resolvers + portfolio | 4 |
| B18.1 | page-engine onDataChange | 2 |
| B19 | 無補丁重構 | 11 |
| B20 | 第四輪測試（P18-01~05） | 10 |

---

## 十一、教訓總結

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
| onDataChange | 必須支援 |
| 依賴圖 | key 與事件觸發一致 |
| derived | 容忍 undefined |

### Import 相關

| 教訓 | 說明 |
|---|---|
| esc | 從 lib/dom.js |
| format* | 從 lib/format.js |
| 檔案搬移 | 全域搜尋舊路徑 |

### Service Worker 相關

| 教訓 | 說明 |
|---|---|
| 開發階段 | network-first |
| 正式階段 | 可改 stale |
| CACHE_NAME | 有版本號 |

### 除錯相關

| 教訓 | 說明 |
|---|---|
| 手機 vConsole | 必備 |
| 非必要模組 | 動態 import |
| 全域 error | 監聽 |

### 部署相關

| 教訓 | 說明 |
|---|---|
| 檔案 URL | 直接訪問驗證 |
| 頁面表現 | 不可信（快取） |
| GitHub 網頁編輯 | 最安全 |

### 無補丁原則（B19）

| 教訓 | 說明 |
|---|---|
| 宣告 | 能宣告就不手寫 |
| 就地更新 | 不 destroy/create |
| 更好就換 | 不為向後相容妥協 |

---

## 十二、未來方向

| 方向 | 說明 |
|---|---|
| 效能優化 | SW 改回 stale-while-revalidate |
| 清理 | 移除 js/shared/ 未使用檔 |
| 類型檢查 | 未來可加 JSDoc |
| 單元測試 | 未來可加 vitest |

---

/* ═══════════════════════════════════════════
   END OF FILE
   File: docs/refactor-plan.md
   Version: v103.0.19
   Batch: B21
   ═══════════════════════════════════════════ */