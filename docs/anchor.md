# 主錨點 — 家庭財務 Web App

最後更新：B24
當前批次：B23
專案狀態：測試中

---

## 🚀 快速上手（AI 30 秒）

**這是什麼**：家庭財務與固定供款管理 Web App，深色科幻霓虹主題。

**技術棧**：純 HTML + CSS + ES Module JS + Firebase RTDB + Cloudflare Pages Functions

**核心架構（三層）**：
Firebase RTDB → data-engine → page-engine → derived → block → DOM

**關鍵概念**：
- 5 Registry（SSOT）：狀態 / 名稱 / 文字 / 欄位 / 常數
- 3 Engine：page / data / render
- 5 Block：stats / list / filter / detail / form
- 13 Page Schema：純宣告式

**五大鐵則**：
1. 最簡潔實用
2. 無補丁（能宣告就不手寫）
3. SSOT 極大化
4. 檔案 ≤ 500 行
5. AI 優先（不需為人類可讀性妥協）

**交付流程**：
1. 讀 docs/ 全部 14 檔
2. 使用者說「請交付第 N 波」或「需要更新清單」
3. AI 依 progress.md + file-manifest.md 交付

**讀取順序**：
anchor → ai-guide → file-manifest → progress → 依情境讀其餘

---

## 零、AI 協作與交付規則（最高優先）

### 0.1 問題處理流程（強制）

遇到問題時：
1. 先提供「診斷 + 修正方案」
2. 列出選項與建議
3. 等待使用者確認後才交付
4. 不得直接交付未經確認的修改

### 0.2 程式碼編輯原則（強制）

1. 最簡潔：能 1 行不寫 10 行
2. 最實用：能跑、能維護、不炫技
3. SSOT 極大化：任何邏輯只存在一處
4. AI 優先（最高）：
   - 本專案所有代碼皆由 AI 編寫，不需為人類可讀性妥協
   - 只需「AI 能理解邏輯」即可
   - 註解只寫「為什麼」不寫「做什麼」
   - 變數命名可極簡（_r, _m, _h 可接受）
   - 不寫裝飾性註解、不寫分隔線、不寫空行排版
   - 函式可 1 行則 1 行（箭頭函式優先）
5. 邊界條件（不受「AI 優先」影響）：
   - export 函式名：需語意明確
   - CSS class：保留 kebab-case
   - API 路徑：保留（向後相容）
   - Firebase 欄位名：保留（資料相容）
6. 禁止：
   - 複製貼上重複邏輯
   - 猴子補丁（改引擎，不改呼叫端）
   - 手寫 HTML 字串（用 render engine / block）
   - 為了「避免新增檔案」而妥協

### 0.3 無補丁原則（最高）

1. 定義：補丁 = 為修 A 而加 B，B 只掩蓋症狀
2. 禁止補丁思維：
   - 加快取變數判斷「資料有沒有變」
   - 猴子補丁覆寫引擎方法
   - 重複「訂閱 → render → destroy → create」
3. 寧願重寫：若需補丁 → 停下 → 檢視根本設計 → 一次重寫該模組
4. 更好就換：發現更好方案 → 不管已交付與否，直接換

### 0.4 檔案大小限制

| 類型 | 建議 | 上限 |
|---|---|---|
| Registry | 50~150 | 300 |
| Engine | 200~300 | 500 |
| Block | 100~200 | 300 |
| Lib | 50~150 | 250 |
| UI 元件 | 100~250 | 400 |
| Layout | 100~200 | 300 |
| Page Schema | 30~150 | 300 |
| Functions API | 100~400 | 800 |
| Docs | 50~700 | 1000 |

超過 500 行 → 拆檔。

### 0.5 共用元件化（核心）

1. 同一功能在多頁出現 → 抽成共用模組
2. 未來修改只改共用模組 1 處
3. 判斷準則：「這功能未來會不會改？」
   - 會 → 抽共用
   - 不會 → 可留在原檔
4. 禁止在多頁重複實作同一功能

### 0.6 交付批次號（強制）

| 範圍 | 格式 | 範例 |
|---|---|---|
| B01 ~ B99 | B + 2 位數字 | B01, B99 |
| B99 之後 | C01 ~ C99 | C01, C99 |
| C99 之後 | D01 ~ D99 | D01, D99 |
| 依此類推 | A → B → C → D → ... | |
| 重交付 | B{n}.{x} | B18.1 |

規則：
1. 每波交付必須有批次號
2. 檔案內註解：Batch: B{nn}
3. 禁止混用「波次」與「版本號」
4. 禁止每次換說法

### 0.7 更新清單流程（強制）

使用者說「需要更新清單」時：

1. AI 先列「所有已交付批次」
2. 使用者回「已部署到 B{n}」
3. AI 列「B{n} 之後所有批次的最新版清單」
4. 同檔以最新批次為準
5. 格式：B{批次} ← 路徑

### 0.8 交付前自我檢查（強制）

每次交付前，AI 必須列出：

1. 本次交付約束：單檔行數 / SSOT / 是否最簡潔
2. 受影響範圍：哪些檔案 / 頁面 / 依賴衝突
3. 待驗證項：測試清單 + vConsole 指令
4. 風險提醒：破壞性改動 / 向後相容 / 測試順序
5. 檔案結束標記：每個檔案有 END OF FILE
6. 檔案清單更新：file-manifest.md 已更新

### 0.9 AI 必須遵循錨點

- 錨點是最高權威
- 執行前先核對錨點內容
- 如發現衝突 → 立即提醒使用者
- 不得默默照做或默默違反

### 0.10 主動提案義務

- 看到更好方案 → 主動提出
- 決策不合理 → 明確反對並說明
- 不因「使用者已決定」而放棄建議

### 0.11 檔案結束標記（B20 起強制）

每個交付檔案最後必須加：

| 元素 | 內容 |
|---|---|
| 分隔線 | ═══（39 個半形等號） |
| 標題 | END OF FILE |
| 檔案 | File: {路徑} |
| 版本 | Version: {項目版本} |
| 批次 | Batch: {批次號} |
| 註解符號 | 依檔案類型 |

註解符號對照：

| 檔案類型 | 註解符號 |
|---|---|
| .js / .css | /* ... */ |
| .md | /* ... */ 或 <!-- ... --> |
| .html | <!-- ... --> |
| .json | ❌ 不支援（不用） |

生效範圍：B20 起。B01~B19 已交付檔案不補。

### 0.12 檔案清單維護（強制）

1. 見 file-manifest.md
2. 每次交付後必須更新版本 + 批次
3. 清單格式：| 檔案 | 版本 | 批次 |

### 0.13 交付格式（強制）

每個檔案交付由三部分組成：

| 部分 | 格式 |
|---|---|
| 檔案路徑 | 標題 `## 📁 檔案路徑` + 獨立 code block |
| 分隔標題 | 標題 `## 📄 檔案內容` |
| 檔案內容 | code block，附語言標示 |

語言標示對照：

| 副檔名 | 標示 |
|---|---|
| .js | js |
| .md | md |
| .json | json |
| .css | css |
| .html | html |

含內層 code block 時的規則：

| 內層最多 backtick | 外層 backtick |
|---|---|
| 3 個 | 4 個 |
| 4 個 | 5 個 |
| 5 個 | 6 個 |
| N 個 | N + 1 個 |

規則：外層 backtick 數量 = 內層最多 backtick 數量 + 1

其他規則：
1. 每檔獨立區塊，不可合併
2. 內容必須完整，不可 diff
3. 不可用「...」「同上」「略」
4. 檔案最後加 END OF FILE 標記（B20 起）
5. 交付清單開頭標示「批次號」與「本輪第幾批」

### 0.14 交付前檢查清單

| 項目 | 檢查 |
|---|---|
| import 完整 | 是 |
| export 完整 | 是 |
| 無語法錯誤 | 是 |
| 符合 SSOT 原則 | 是 |
| 路徑與專案結構一致 | 是 |
| 所有 button 有 type="button" | 是 |
| 狀態判定走 status-registry | 是 |
| 名稱解析走 entity-registry | 是 |
| 顯示文字走 label-registry | 是 |
| 表格欄位走 column-registry | 是 |
| 檔案最後有 END OF FILE | 是 |
| 已更新 file-manifest.md | 是 |

### 0.15 交付前檔案結構檢查（強制）

每次交付前：

1. 檢查現有檔案：
   - 讀 file-manifest.md
   - 確認是否已有類似功能檔案

2. 複用優先：
   - 已有共用檔案 → 擴充，不新增
   - 無共用檔案 → 才考慮新增
   - 禁止為單一功能新增檔案

3. 合併檢查：
   - 新功能可併入現有檔案？
   - 與現有 lib / ui 功能重疊？
   - 能抽為 helper 但不新增檔？

4. 判斷：
   - 有現成可用 → 擴充
   - 沒有 → 才新增
   - 能不加檔就不加檔

例外：docs/ 不受此限（為 AI 協作便利而存在）。

### 0.16 最簡潔實用自我檢查（強制）

每次交付程式碼前，AI 必須自問：

1. 這是不是最簡潔的實作方式？
   - 能否用更少的行數？
   - 有沒有現成函式可用？
   - 有沒有重複邏輯可抽？

2. 這是不是最實用的實作方式？
   - 是否解決根本問題？
   - 是否會被未來改動影響？
   - 是否遵循 SSOT？

3. 有沒有更簡潔的替代方案？
   - 若「加檔案」→ 能否「擴充現有」？
   - 若「加函式」→ 能否「複用現有」？
   - 若「加參數」→ 能否「用預設值」？

4. 違規判斷：
   - 「好像可以更好」→ 重寫
   - 「先這樣之後再優化」→ 停手
   - 「反正是小檔案」→ 檢查合併可能

### 0.17 機會型重構（強制）

每次交付某檔案時（即使只修 1 個 bug），必須檢查整個檔案：

1. 檢查範圍：讀完整個檔案，分類 A / B / C 級

2. 分級處理：
   - 🟥 A 級（違反硬規則）→ 一定順便改：
     - 重複邏輯 / 補丁思維 / 檔案 > 500 行 / 手寫 HTML 字串
   - 🟧 B 級（可優化）→ 順便改，需記錄：
     - 可縮短行數 / 可抽區域變數 / 命名可精簡
   - 🟨 C 級（微調）→ 記錄但不改：
     - 註解措辭 / 空行 / 排版

3. 判斷準則：
   - 有明確改善 → 改
   - 「好像也差不多」→ 不改
   - 「不知道」→ 不改

4. 邊界：
   - 改動範圍 ≤ 30% 檔案
   - 超出 → 拆出另案
   - 只重構，不加功能
   - 不得超出使用者要求範圍（除 A 級）

5. 輸出：
   - 檔頭註解記錄順便改動
   - 交付摘要列出

6. 禁止：為改而改 / 範圍 > 30% / 引入新功能 / 一次動多檔

### 0.18 文檔寫作原則（強制）

1. 示範 code block 用「規則 + 表格」
   - 不用真 code block 示範「含 code block 的格式」
   - 用「情況 → 做法」表格
   - 例：外層 backtick = 內層 + 1

2. 唯一真相 + 引用
   - 規則集中在 anchor.md
   - 其他 docs 只引用，不重複定義
   - 補充「操作範例」而非「重新定義」

3. 清單用表格，敘述用段落
   - 清單類（檔案 / API / 批次）→ 表格
   - 決策類 → 段落
   - 禁止：清單混段落

4. 格式示範避開嵌套
   - 若必須示範含 code block 的格式
   - 用文字描述（不用真 code block）
   - 或放文件最尾，獨立區塊

5. 表格 ≤ 30 行
   - 超過 → 拆多個小表格
   - 表格內容不含 |

6. 禁止：
   - 用 code block 示範「含 code block 的東西」
   - 重複定義 anchor 已有的規則
   - 表格 > 30 行
   - 表格內含 | 特殊字元

---

## 一、專案身份

| 項目 | 內容 |
|---|---|
| 專案 | 家庭財務與固定供款管理 Web App |
| GitHub | family-fin-v2 |
| 部署 | Cloudflare Pages |
| 資料庫 | Firebase RTDB (asia-southeast1) |
| 登入 | Firebase Auth（自訂帳號 @familyfin.local） |
| 前端 | 純 HTML + CSS + ES Module JS |
| 後端 | Cloudflare Pages Functions |
| 視覺 | 深色科幻霓虹（Cyan / Magenta / Emerald） |
| 金額 | 四捨五入至整數 |

---

## 二、核心架構原則

| 原則 | 說明 |
|---|---|
| SSOT 極大化 | 任何知識只存在一處 |
| 宣告式 > 命令式 | 頁面只描述「要什麼」 |
| 舊資料 100% 相容 | 讀取時 normalize |
| 操作邏輯不變 | 只改實作方式 |
| 無補丁 | 能宣告就不手寫，能就地更新就不 destroy/create |

---

## 三、5 大 Registry

| Registry | 職責 |
|---|---|
| status-registry.js | 狀態系統 |
| entity-registry.js | 名稱解析 |
| label-registry.js | 顯示文字 |
| column-registry.js | 表格欄位 |
| constants.js | 全站常數 |

---

## 四、3 大引擎

| 引擎 | 職責 |
|---|---|
| page-engine.js | 解讀 Schema、生命週期、onDataChange |
| data-engine.js | Firebase 訂閱 + 衍生 |
| render-engine.js | 掛載 UI 區塊 |

---

## 五、5 大 Block

| Block | 職責 |
|---|---|
| stats-block.js | 統計卡區 |
| list-block.js | 列表區 |
| filter-block.js | 篩選列區 |
| detail-block.js | 明細展開區 |
| form-block.js | 表單 Modal 區 |

---

## 六、Page Schema 欄位

| 欄位 | 類型 | 說明 |
|---|---|---|
| title | string | 頁面標題 |
| data | object | Firebase 訂閱配置 |
| state | object | 響應式狀態初始值 |
| derived | object | 衍生資料計算 |
| blocks | array | UI 區塊 |
| onYearMonthChange | function | 年月變更 hook（可選） |
| customMount | function | 逃生艙（可選） |

data 配置：

| 欄位 | 說明 |
|---|---|
| type | list / object / value / raw |
| path | Firebase 路徑 |
| transform | 資料轉換（可選） |

block 常用：

| type | 必要欄位 |
|---|---|
| stats | container, cards |
| list | container, rows, columns |

customMount 回傳：

| 欄位 | 說明 |
|---|---|
| destroy | 清理函式 |

ctx 提供：

| 方法 | 用途 |
|---|---|
| ctx.onDataChange(fn) | 訂閱資料變更 |
| ctx.setState(path, val) | 設 state |
| ctx.invalidate(key) | 觸發重算 |

---

## 七、目標檔案結構

js/config（7 檔）：constants / firebase-config / app-config / 4 Registry

js/core（8 檔）：state / api / db / auth / auth-guard / utils / pwa / debug

js/lib（11 檔）：dom / async / lifecycle / registry / merge / insurance / bank / format / expense-modal / income-modal / filter-sort

js/engines（3 檔）：page / data / render

js/blocks（5 檔）：stats / list / filter / detail / form

js/ui（6 檔）：toast / modal / form-builder / tab-panel / view-toggle / collapsible

js/layout（3 檔）：navbar / sidebar / app-shell

js/entity（5 檔）：entity-modal / entity-helpers / entity-definitions / entity-resolvers / entity-funds-allocation

js/admin（2 檔）：admin / platform-defaults

js/pages（13 檔）：純 Schema

functions/api（10 檔）：_config / _helpers / _admin / _bank / _family / _insurance / _personal / _platform / _summary / [[path]]

docs（14 檔）：README / anchor / ai-guide / file-manifest / progress / sop / adr / page-map / delivery-rules / refactor-plan / api-contracts / data-structure / compatibility / incident-log

---

## 八、關鍵字索引

| 關鍵字 | 讀此檔 |
|---|---|
| 狀態 / pending / done | status-registry.js + data-structure.md |
| 名稱解析 / ID | entity-registry.js + entity-resolvers.js |
| 表格欄位 | column-registry.js |
| 顯示文字 | label-registry.js |
| 常數 / 路徑 | constants.js |
| Firebase 節點 | data-structure.md |
| API 端點 | api-contracts.md |
| 舊資料相容 | compatibility.md |
| 交付格式 / 批次號 | anchor.md 0.6, 0.13 |
| 檔案清單 | file-manifest.md |
| 常見任務 | sop.md |
| 關鍵決策 | adr.md |
| 頁面 → 檔案 | page-map.md |
| 事故 / 教訓 | incident-log.md |
| 重構歷程 | refactor-plan.md |
| 進度 | progress.md |
| AI 決策樹 | ai-guide.md |

---

## 九、下一步

| 使用者說 | AI 動作 |
|---|---|
| 「請交付第 N 波」 | 依 progress.md 交付 |
| 「查看進度」 | 讀 progress.md 回報 |
| 「需要更新清單」 | 列已交付批次，待確認 |
| 「有問題」 | 先診斷 + 方案，待確認後修 |

---

## 十、目前狀態

| 項目 | 值 |
|---|---|
| 當前批次 | B23 |
| SW 版本 | family-fin-v139 |
| 部署 URL | family-financial-management-system.pages.dev |
| 測試狀態 | B23 已部署，待測試 |

---

## 十一、待辦事項

| 項目 | 狀態 |
|---|---|
| 效能優化：SW 改回 stale-while-revalidate | 未做 |
| 補齊 js/shared/ 未使用檔案清理 | 未做 |
| 補 _headers | 未做 |
| B20 起所有交付加 END OF FILE | 已生效 |
| 機會型重構套用 | B21 起生效 |

---

/* ═══════════════════════════════════════════
   END OF FILE
   File: docs/anchor.md
   Version: v103.0.21
   Batch: B24
   ═══════════════════════════════════════════ */