# 關鍵決策記錄（ADR）

最後更新：B21
用途：記錄重大設計決策，讓新 AI 理解脈絡，避免反向改動

---

## 決策索引

| 編號 | 主題 | 時間 |
|---|---|---|
| ADR-001 | Page Schema 宣告式 | B01~B11 |
| ADR-002 | Functions 底線前綴 + Catch-all | B11 |
| ADR-003 | onDataChange 統一通知 | B18.1 |
| ADR-004 | Registry SSOT | B01 |
| ADR-005 | AI 優先原則 | B19 |
| ADR-006 | 無補丁原則 | B19 |
| ADR-007 | 批次號系統 | B19 |
| ADR-008 | docs 例外（不受不新增限制） | B21 |
| ADR-009 | 文檔寫作原則 | B21 |
| ADR-010 | 機會型重構 | B20 |
| ADR-011 | SW network-first | B11 |
| ADR-012 | 舊資料 normalize | B01 |
| ADR-013 | 8 個實體定義集中 | B06 |
| ADR-014 | entity-resolvers 集中顯示 | B18 |
| ADR-015 | 共用元件化（Modal / filter-sort） | B19 |

---

## ADR-001：Page Schema 宣告式

| 項目 | 內容 |
|---|---|
| 背景 | v102 頁面層 9,000 行，重複度高 |
| 決策 | 頁面改寫為 Schema（宣告式） |
| 理由 | 頁面只描述「要什麼」；引擎解讀 + 渲染；SSOT 集中 |
| 影響 | 13 頁面從 ~700 行 → ~80 行；頁面層精簡 82% |
| 替代 | 保留命令式（重複度高）；MVC（過度工程） |

---

## ADR-002：Functions 底線前綴 + Catch-all

| 項目 | 內容 |
|---|---|
| 背景 | P01 事故，CF Pages Functions 路由 500 |
| 決策 | 主檔改 `_xxx.js`；用 `[[path]].js` 統一分派 |
| 理由 | CF Pages 每個 URL 對應獨立實體檔案；不支援跨檔 re-export |
| 影響 | Functions 從 13 檔 → 10 檔；所有端點走 `[[path]].js` |
| 替代 | 各端點獨立檔（CF 不支援）；shim re-export（CF 失敗） |
| 禁止 | 新增獨立 `xxx.js`（除 `_xxx.js`） |

---

## ADR-003：onDataChange 統一通知

| 項目 | 內容 |
|---|---|
| 背景 | B18.1，customMount 頁面資料到達不更新 |
| 決策 | page-engine 加 `ctx.onDataChange(fn)` |
| 理由 | 統一通知機制；避免猴子補丁（覆寫 `ctx.invalidate`）；各頁只寫 1 行 |
| 影響 | 5 個頁面受益；廢除所有猴子補丁 |
| 替代 | 各頁訂閱 AppState（重複）；抽共用 helper（多一檔） |
| 禁止 | 覆寫 `ctx.invalidate`；加快取變數判斷「資料有沒有變」 |

---

## ADR-004：Registry SSOT

| 項目 | 內容 |
|---|---|
| 背景 | v102 狀態文字散落 15+ 檔 |
| 決策 | 抽 5 大 Registry |
| 理由 | 任何知識只存在一處；修改只改 1 處；跨檔一致 |
| 影響 | 修改動全身問題解決；全站狀態文字統一 |
| 替代 | 無（SSOT 為核心原則） |
| 禁止 | 硬編碼狀態字串；直接顯示 ID；欄位結構重複定義 |

**5 大 Registry**：

| Registry | 職責 |
|---|---|
| status-registry | 狀態系統 |
| entity-registry | 名稱解析 |
| label-registry | 顯示文字 |
| column-registry | 表格欄位 |
| constants | 全站常數 |

---

## ADR-005：AI 優先原則

| 項目 | 內容 |
|---|---|
| 背景 | 專案所有代碼皆由 AI 編寫 |
| 決策 | 不需為「人類可讀性」妥協；只需「AI 能理解邏輯」即可 |
| 理由 | AI 讀取為主；人類不直接維護；簡潔 = 更少 token |
| 影響 | 檔案行數 -20%；變數命名可極簡；不寫裝飾性註解 |
| 替代 | 保留人類可讀性（檔案膨脹）；雙版本（維護負擔） |

**邊界**（不受此限）：

| 情境 | 是否適用 |
|---|---|
| export 函式名 | ❌ 需語意明確 |
| CSS class | ❌ 保留 kebab-case |
| API 路徑 | ❌ 向後相容 |
| Firebase 欄位 | ❌ 資料相容 |
| 內部變數 | ✅ 可極簡（`_r` / `_m`） |
| 註解 | ✅ 只寫「為什麼」 |

---

## ADR-006：無補丁原則

| 項目 | 內容 |
|---|---|
| 背景 | B19，發現多處補丁思維 |
| 決策 | 能宣告就不手寫；能就地更新就不 destroy/create；寧願重寫不補丁 |
| 理由 | 補丁掩蓋症狀；補丁累積 = 技術債；長期維護成本高 |
| 影響 | block 加 `renderInPlace`；廢除快取變數判斷；廢除猴子補丁 |
| 替代 | 保留補丁（短期快長期痛）；漸進重構（慢） |
| 禁止 | 加快取變數判斷；猴子補丁覆寫引擎；重複「訂閱 → render → destroy → create」 |

**判斷準則**：「這行是解決問題還是掩蓋？」→ 掩蓋 → 重寫

---

## ADR-007：批次號系統

| 項目 | 內容 |
|---|---|
| 背景 | 使用者反饋「波次 / 項目版本 / 檔案版本」3 種說法混亂 |
| 決策 | 統一使用批次號 |
| 理由 | 對使用者友善（不需記版本號）；對應「哪一波」；用於「更新清單」流程 |
| 影響 | 檔案內註解：`Batch: B{nn}`；交付清單標示批次號；廢除「項目版本號」 |
| 替代 | 純數字（累積快不易記）；日期（與部署脫鉤） |

**格式**：

| 範圍 | 格式 |
|---|---|
| B01 ~ B99 | B + 2 位數字 |
| B99 之後 | C01 ~ C99 |
| C99 之後 | D01 ~ D99 |
| 依此類推 | A → B → C → D → ... |
| 重交付 | B{n}.{x} |

---

## ADR-008：docs 例外（不受不新增限制）

| 項目 | 內容 |
|---|---|
| 背景 | 規則 0.15「能不加檔就不加檔」 |
| 決策 | docs 例外，不受此限 |
| 理由 | docs 為 AI 協作便利而存在；AI 讀 docs 的負擔遠小於讀 code；拆分可讓 AI 依情境挑檔 |
| 影響 | docs 從 9 檔 → 14 檔；各檔職責單一 |
| 邊界 | 只限 docs；code（js / css / html）仍受限制 |

---

## ADR-009：文檔寫作原則

| 項目 | 內容 |
|---|---|
| 背景 | 使用者發現「用 code block 示範含 code block 的格式」導致嵌套提前關閉 |
| 決策 | 示範用「規則 + 表格」，不用真 code block |
| 理由 | 避免嵌套問題；節省檔案大小；AI 學規則不需示範 |
| 影響 | 全部 docs 改用表格說明格式；backtick 規則：外層 = 內層 + 1 |
| 替代 | 5 backtick 示範（複雜）；JSON 化（過度工程） |

**規則**：

| 情境 | 做法 |
|---|---|
| 示範含 code block 的格式 | 用表格列「情況 → 做法」 |
| 清單類 | 表格 |
| 敘述類 | 段落 |
| 表格大小 | ≤ 30 行 |
| 表格內容 | 不含 `|` |

---

## ADR-010：機會型重構

| 項目 | 內容 |
|---|---|
| 背景 | 使用者要求「每次交付都檢查舊代碼可簡化處」 |
| 決策 | 分 A / B / C 級處理 |
| 理由 | 每次交付都是改善機會；需避免「為改而改」；控制範圍 |
| 影響 | 改動範圍 ≤ 30% 檔案；超出拆出另案 |
| 替代 | 不重構（累積債）；全面重構（範圍失控） |
| 禁止 | 為改而改；範圍 > 30%；引入新功能；一次動多檔 |

**分級**：

| 級別 | 處理 |
|---|---|
| 🟥 A 級（違反硬規則） | 一定順便改 |
| 🟧 B 級（可優化） | 順便改，需記錄 |
| 🟨 C 級（微調） | 記錄但不改 |

---

## ADR-011：SW network-first（開發階段）

| 項目 | 內容 |
|---|---|
| 背景 | P10，stale-while-revalidate 導致需訪問 2 次 |
| 決策 | 全部改 network-first |
| 理由 | 開發階段頻繁部署；network-first 一次生效；部署即時反映 |
| 影響 | sw.js 全改 network-first；CACHE_NAME 每次部署升版 |
| 替代 | stale（部署需 2 次）；完全不用 SW（失去離線） |
| 未來 | 正式階段可改回 stale（效能優先） |

---

## ADR-012：舊資料 normalize

| 項目 | 內容 |
|---|---|
| 背景 | 狀態名稱從「未付款」改為 `pending` 等新代碼 |
| 決策 | 讀取時 `status.normalize(raw)` 自動轉換；寫入時寫新代碼；舊節點保留 |
| 理由 | 不破壞舊資料；不需大規模遷移；使用者零感知 |
| 影響 | compatibility.md 記錄舊名稱映射；db.js 寫入時 normalizeStatus() |
| 替代 | 一次性遷移（風險高）；雙軌並存（複雜） |

---

## ADR-013：8 個實體定義集中

| 項目 | 內容 |
|---|---|
| 背景 | 表單欄位散落各頁 |
| 決策 | `entity-definitions.js` 集中 8 個實體定義 |
| 理由 | 表單欄位只定義一處；entity-modal 動態生成；entity-list-page 動態渲染 |
| 影響 | 新增實體只改 1 檔；表單驗證集中 |
| 替代 | 各頁自己定義（重複） |

**8 個實體**：

| 實體 | 用途 |
|---|---|
| member | 成員 |
| bank | 銀行 |
| policy | 保單 |
| fund | 基金 |
| category | 支出類別 |
| item | 支出項目 |
| payment | 支付方式 |
| status | 狀態 |

---

## ADR-014：entity-resolvers 集中顯示

| 項目 | 內容 |
|---|---|
| 背景 | P17-06，保險受保人顯示 ID |
| 決策 | 新增 `entity-resolvers.js` |
| 理由 | entity 欄位 → 顯示 HTML 集中；entity-list-page 傳給 renderDataTable；避免 column-registry 承擔 entity 專屬邏輯 |
| 影響 | entity-list-page 傳 resolvers；portfolio / input-center 等受益 |
| 替代 | 放在 entity-definitions（混職責）；放在 column-registry（承擔過多） |

---

## ADR-015：共用元件化（Modal / filter-sort）

| 項目 | 內容 |
|---|---|
| 背景 | B19，expense-modal 在 input-center / settlements 重複；filter-sort 在 settlements 重複 |
| 決策 | 抽 `lib/expense-modal.js` + `lib/income-modal.js` + `lib/filter-sort.js` |
| 理由 | 2 頁共用；未來修改只改 1 處；符合「共用元件化」原則 |
| 影響 | input-center.js -420 行；settlements.js -100 行 |
| 替代 | 各頁自己實作（重複） |

**共用檔對照**：

| 檔案 | 使用頁 |
|---|---|
| lib/expense-modal.js | input-center / settlements |
| lib/income-modal.js | input-center |
| lib/filter-sort.js | settlements |

---

/* ═══════════════════════════════════════════
   END OF FILE
   File: docs/adr.md
   Version: v103.0.19
   Batch: B21
   ═══════════════════════════════════════════ */