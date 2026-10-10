# 常見任務 SOP

最後更新：B21
用途：AI 執行常見任務時，依此步驟操作

---

## 一、修 Bug

### 步驟

| 步驟 | 動作 |
|---|---|
| 1 | 讀 incident-log.md（是否已記錄） |
| 2 | 複現問題（若需要） |
| 3 | 診斷根本原因（不只症狀） |
| 4 | 提供「診斷 + 修正方案」 |
| 5 | 待使用者確認 |
| 6 | 交付完整檔案 |
| 7 | 更新 file-manifest.md |
| 8 | 更新 progress.md |
| 9 | 若反覆發生 → 記錄到 incident-log.md |

### 診斷原則

| 面向 | 檢查項 |
|---|---|
| 症狀 | 使用者描述 vs 實際行為 |
| 時間點 | 何時開始（對應哪個批次） |
| 範圍 | 影響哪些頁面 / 檔案 |
| 根本原因 | 是補丁問題？SSOT 違反？邏輯錯誤？ |

### 修正原則

| 原則 | 說明 |
|---|---|
| 根本解決 | 不補丁、不掩蓋 |
| 最小改動 | 範圍 ≤ 30% 檔案 |
| 順便檢查 | 套用 anchor 0.17 機會型重構 |
| 完整交付 | 不 diff |

---

## 二、新增頁面

### 步驟

| 步驟 | 動作 |
|---|---|
| 1 | 讀 anchor.md 0.15（檔案結構檢查） |
| 2 | 檢查 file-manifest.md（是否有類似頁面） |
| 3 | 寫 js/pages/xxx.js（Page Schema） |
| 4 | 寫 xxx.html（載入邏輯） |
| 5 | 更新 constants.js 的 SIDEBAR_GROUPS |
| 6 | 更新 constants.js 的 ROUTES |
| 7 | 更新 sw.js 的 STATIC_ASSETS |
| 8 | 更新 file-manifest.md |
| 9 | 更新 page-map.md |

### Page Schema 結構

| 欄位 | 說明 |
|---|---|
| title | 頁面標題 |
| data | Firebase 訂閱配置（key → config） |
| state | 響應式狀態初始值 |
| derived | 衍生資料（key → { deps, compute }） |
| blocks | UI 區塊陣列 |
| onYearMonthChange | 年月變更 hook（可選） |
| customMount | 逃生艙（可選） |

### data 配置

| 欄位 | 說明 |
|---|---|
| type | list / object / value / raw |
| path | Firebase 相對路徑（可含 {key} / {__all__}） |
| transform | 資料轉換函式（可選） |

### block 常用類型

| type | 必要欄位 |
|---|---|
| stats | container, cards |
| list | container, rows, columns |
| filter | container, fields, bind |

### customMount 回傳

| 欄位 | 說明 |
|---|---|
| destroy | 清理函式（unsub / destroy 等） |

### HTML 結構

| 元素 | 說明 |
|---|---|
| head | 4 個 CSS（theme / layout / components / utilities） |
| body | app-shell > sidebar-root + main-area |
| main-area | navbar-root + content |
| content | page-header + 各 block container |
| scripts | lucide + modulepreload + type="module" |

### HTML 載入邏輯

| 部分 | 內容 |
|---|---|
| 1 | 載入 initApp from app-shell.js |
| 2 | 載入 createPage from page-engine.js |
| 3 | 載入 schema from pages/xxx.js |
| 4 | 呼叫 initApp（帶 activeHref / title） |
| 5 | 若 user 存在 → 呼叫 createPage(schema) |

### 新增頁面需同步更新

| 檔案 | 更新 |
|---|---|
| js/config/constants.js | SIDEBAR_GROUPS + ROUTES |
| sw.js | STATIC_ASSETS 加新檔 |
| docs/file-manifest.md | 加檔案列 |
| docs/progress.md | 記錄批次 |
| docs/page-map.md | 加頁面 → 檔案 |

---

## 三、改 Block

### 步驟

| 步驟 | 動作 |
|---|---|
| 1 | 找出所有使用此 block 的頁面（grep） |
| 2 | 評估改動是否向後相容 |
| 3 | 若破壞性 → 加參數（不破壞舊呼叫） |
| 4 | 改 block |
| 5 | 驗證所有使用頁 |
| 6 | 更新 file-manifest.md |

### 找使用頁

| 指令 | 用途 |
|---|---|
| `grep -r "type: 'list'" js/pages/` | 找 list block 使用 |
| `grep -r "type: 'stats'" js/pages/` | 找 stats block 使用 |
| `grep -r "type: 'filter'" js/pages/` | 找 filter block 使用 |

### block 使用對照

| Block | 使用頁 |
|---|---|
| stats-block | dashboard / portfolio / annual-report / member-report |
| list-block | portfolio / member-report |
| filter-block | （未使用） |
| detail-block | （未使用） |
| form-block | （未使用） |

---

## 四、改 Registry

### 步驟

| 步驟 | 動作 |
|---|---|
| 1 | 讀 api-contracts.md（對應 API） |
| 2 | 找出所有 import 此 registry 的檔案 |
| 3 | 加新 API（不破壞舊 API） |
| 4 | 改 registry |
| 5 | 更新 api-contracts.md |
| 6 | 更新 file-manifest.md |

### 禁止

| 項目 | 說明 |
|---|---|
| 直接改 export 函式名 | 會破壞其他檔案 |
| 直接改回傳格式 | 會破壞呼叫端 |
| 刪除 export | 除非確認無使用 |

### 找使用檔案

| Registry | grep 指令 |
|---|---|
| status-registry | `grep -r "status-registry" js/` |
| entity-registry | `grep -r "entity-registry" js/` |
| label-registry | `grep -r "label-registry" js/` |
| column-registry | `grep -r "column-registry" js/` |
| constants | `grep -r "config/constants" js/` |

---

## 五、改 Lib

### 步驟

| 步驟 | 動作 |
|---|---|
| 1 | 檢查是否可複用現有 lib（anchor 0.15） |
| 2 | 若無 → 評估抽新 lib 或擴充現有 |
| 3 | 改 lib |
| 4 | 更新 file-manifest.md |

### 判斷準則

| 情境 | 做法 |
|---|---|
| 只有 1 頁用 | 留在原檔 |
| 2+ 頁用 | 抽 lib |
| 未來會擴充 | 抽 lib |
| 純一次性邏輯 | 留在原檔 |

---

## 六、改 Functions API

### 步驟

| 步驟 | 動作 |
|---|---|
| 1 | 讀 api-contracts.md |
| 2 | 決定哪個 _xxx.js |
| 3 | 改 handler 函式 |
| 4 | 若加新端點 → 改 [[path]].js 分派 |
| 5 | 更新 api-contracts.md |
| 6 | 更新 file-manifest.md |

### 路由對照

| 端點 | 檔案 |
|---|---|
| GET /api/summary | _summary.js |
| GET /api/annual-summary | _summary.js |
| GET /api/bank-accounts | _bank.js |
| POST /api/family-settings | _family.js |
| POST /api/insurance-sync | _insurance.js |
| POST /api/admin-init-family | _admin.js |

所有端點透過 [[path]].js 分派。

### 禁止

| 項目 | 說明 |
|---|---|
| 新增獨立 xxx.js | 除 _xxx.js |
| 用 shim re-export | 見 P01 事故 |

---

## 七、改資料結構

### 步驟

| 步驟 | 動作 |
|---|---|
| 1 | 讀 data-structure.md |
| 2 | 讀 compatibility.md |
| 3 | 評估是否影響舊資料 |
| 4 | 若影響 → 加相容層 |
| 5 | 改程式碼 |
| 6 | 更新 data-structure.md |
| 7 | 更新 compatibility.md |

### 相容原則

| 原則 | 說明 |
|---|---|
| 舊資料 100% 可讀 | 不刪、不破壞 |
| 讀取時 normalize | 舊名稱轉新代碼 |
| 寫入時新格式 | 不寫舊名稱 |
| 不刪舊節點 | 保留向後相容 |

---

## 八、更新 docs

### 步驟

| 步驟 | 動作 |
|---|---|
| 1 | 找出受影響的 docs |
| 2 | 依「變更影響矩陣」（見下） |
| 3 | 更新版本 + 批次 |
| 4 | 交付完整檔案 |

### 變更影響矩陣

| 改動 | 同步更新 |
|---|---|
| 新增頁面 | file-manifest / progress / page-map / sw.js / constants.js |
| 改 API | api-contracts / file-manifest |
| 改資料結構 | data-structure / compatibility |
| 改相容策略 | compatibility / data-structure |
| 改 Registry API | api-contracts / file-manifest |
| 修 Bug | incident-log / progress / file-manifest |
| 改交付規則 | delivery-rules / anchor |

---

## 九、部署後驗證

### 步驟

| 步驟 | 動作 |
|---|---|
| 1 | 訪問主要頁面 |
| 2 | vConsole 檢查 Error 分頁 |
| 3 | 切換年月 → 驗證連動 |
| 4 | 檢查 API 回應 |
| 5 | 手機測試 |

### 驗證清單

| 頁面 | 檢查項 |
|---|---|
| index.html | 統計卡有數字 |
| settings.html | 3 Tab 可切換 |
| database.html | 6 Tab 可切換 |
| input-center.html | 5 按鈕可開啟 Modal |
| settlements.html | 表格 + toggle |
| insurance.html | 卡片 + 已供滿展開 |
| annual-report.html | 月度明細分組 |
| member-report.html | 副標題顯示成員數 |
| finance-overview.html | 副標題顯示年月 |

### vConsole 啟用方式

| 方式 | 操作 |
|---|---|
| URL 參數 | 訪問 `?debug=1` |
| 系統設定 | 個人化 Tab → 除錯工具 → 開啟 |

### vConsole 檢查項

| 分頁 | 檢查 |
|---|---|
| Log | 執行日誌（[page-engine] / [app-shell]） |
| Error | 紅色錯誤（最重要） |
| Network | API 請求（/api/*） |
| Storage | localStorage / sessionStorage |

---

## 十、緊急回滾

### 若部署後壞掉

| 步驟 | 動作 |
|---|---|
| 1 | GitHub 找到上一個 commit |
| 2 | Revert 到該 commit |
| 3 | CF Pages 自動重新部署 |
| 4 | 分析問題後重做 |

### 禁止

| 項目 | 說明 |
|---|---|
| 手動改線上檔案 | 用 Git 流程 |
| 強制 push 覆蓋歷史 | 用 revert |

---

## 十一、任務速查

| 任務 | 章節 |
|---|---|
| 修 Bug | 一 |
| 新增頁面 | 二 |
| 改 Block | 三 |
| 改 Registry | 四 |
| 改 Lib | 五 |
| 改 Functions API | 六 |
| 改資料結構 | 七 |
| 更新 docs | 八 |
| 部署後驗證 | 九 |
| 緊急回滾 | 十 |

---

/* ═══════════════════════════════════════════
   END OF FILE
   File: docs/sop.md
   Version: v103.0.19
   Batch: B21
   ═══════════════════════════════════════════ */