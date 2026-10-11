# 關鍵決策記錄（ADR）

最後更新：B24
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
| ADR-008 | docs 例外 | B21 |
| ADR-009 | 文檔寫作原則 | B21 |
| ADR-010 | 機會型重構 | B20 |
| ADR-011 | SW network-first | B11 |
| ADR-012 | 舊資料 normalize | B01 |
| ADR-013 | 8 個實體定義集中 | B06 |
| ADR-014 | entity-resolvers 集中顯示 | B18 |
| ADR-015 | 共用元件化（Modal / filter-sort） | B19 |
| ADR-016 | 基金分兩類（保險 / 獨立） | B23 |
| ADR-017 | 基金快照（B23） | B23 |
| ADR-018 | 保險扣款觸發基金累積 | B23 |

---

## ADR-001：Page Schema 宣告式

| 項目 | 內容 |
|---|---|
| 背景 | v102 頁面層 9,000 行，重複度高 |
| 決策 | 頁面改寫為 Schema |
| 理由 | 頁面只描述「要什麼」；引擎解讀 + 渲染；SSOT 集中 |
| 影響 | 13 頁面從 ~700 行 → ~80 行；頁面層精簡 82% |
| 替代 | 保留命令式（重複度高）；MVC（過度工程） |

---

## ADR-002：Functions 底線前綴 + Catch-all

| 項目 | 內容 |
|---|---|
| 背景 | P01 事故，CF Pages Functions 路由 500 |
| 決策 | 主檔改 `_xxx.js`；用 `[[path]].js` 統一分派 |
| 理由 | CF 每個 URL 對應獨立實體檔案；不支援跨檔 re-export |
| 影響 | Functions 從 13 檔 → 10 檔 |
| 替代 | 各端點獨立檔（CF 不支援）；shim re-export（CF 失敗） |
| 禁止 | 新增獨立 `xxx.js`（除 `_xxx.js`） |

---

## ADR-003：onDataChange 統一通知

| 項目 | 內容 |
|---|---|
| 背景 | B18.1，customMount 頁面資料到達不更新 |
| 決策 | page-engine 加 `ctx.onDataChange(fn)` |
| 理由 | 統一通知；避免猴子補丁；各頁只寫 1 行 |
| 影響 | 5 個頁面受益；廢除所有猴子補丁 |
| 替代 | 各頁訂閱 AppState（重複）；抽 helper（多一檔） |
| 禁止 | 覆寫 `ctx.invalidate`；加快取變數判斷 |

---

## ADR-004：Registry SSOT

| 項目 | 內容 |
|---|---|
| 背景 | v102 狀態文字散落 15+ 檔 |
| 決策 | 抽 5 大 Registry |
| 理由 | 知識只存在一處；修改只改 1 處；跨檔一致 |
| 影響 | 修改動全身問題解決 |
| 禁止 | 硬編碼狀態字串；直接顯示 ID；欄位結構重複定義 |

**5 Registry**：

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
| 決策 | 不需為人類可讀性妥協 |
| 理由 | AI 讀取為主；簡潔 = 更少 token |
| 影響 | 檔案行數 -20%；變數命名可極簡 |
| 邊界 | export 名 / CSS class / API 路徑 / Firebase 欄位不受影響 |

---

## ADR-006：無補丁原則

| 項目 | 內容 |
|---|---|
| 背景 | B19，發現多處補丁思維 |
| 決策 | 能宣告就不手寫；能就地更新就不 destroy/create；寧願重寫 |
| 理由 | 補丁掩蓋症狀；長期維護成本高 |
| 影響 | block 加 `renderInPlace`；廢除快取變數判斷；廢除猴子補丁 |
| 禁止 | 加快取變數；猴子補丁；重複「訂閱 → render → destroy → create」 |

---

## ADR-007：批次號系統

| 項目 | 內容 |
|---|---|
| 背景 | 使用者反饋「波次 / 項目版本 / 檔案版本」3 種說法混亂 |
| 決策 | 統一使用批次號 |
| 理由 | 對使用者友善；對應「哪一波」 |
| 影響 | 檔案內註解：Batch: B{nn}；廢除「項目版本號」 |

**格式**：

| 範圍 | 格式 |
|---|---|
| B01 ~ B99 | B + 2 位數字 |
| B99 之後 | C01 ~ C99 |
| C99 之後 | D01 ~ D99 |
| 依此類推 | A → B → C → D → ... |
| 重交付 | B{n}.{x} |

---

## ADR-008：docs 例外

| 項目 | 內容 |
|---|---|
| 背景 | 規則 0.15「能不加檔就不加檔」 |
| 決策 | docs 例外 |
| 理由 | docs 為 AI 協作便利而存在；拆分可依情境挑檔 |
| 影響 | docs 從 9 檔 → 14 檔 |
| 邊界 | 只限 docs；code（js / css / html）仍受限制 |

---

## ADR-009：文檔寫作原則

| 項目 | 內容 |
|---|---|
| 背景 | 發現「用 code block 示範含 code block 的格式」導致嵌套問題 |
| 決策 | 示範用「規則 + 表格」 |
| 理由 | 避免嵌套；節省檔案大小 |
| 影響 | 全部 docs 改用表格；backtick 規則：外層 = 內層 + 1 |
| 替代 | 5 backtick 示範（複雜）；JSON 化（過度工程） |

---

## ADR-010：機會型重構

| 項目 | 內容 |
|---|---|
| 背景 | 使用者要求「每次交付都檢查舊代碼可簡化處」 |
| 決策 | 分 A / B / C 級處理 |
| 理由 | 每次交付都是改善機會；需控制範圍 |
| 影響 | 改動範圍 ≤ 30% 檔案 |
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
| 背景 | P10，stale 導致需訪問 2 次 |
| 決策 | 全部改 network-first |
| 理由 | 開發階段頻繁部署；一次生效 |
| 影響 | sw.js 全改 network-first；CACHE_NAME 每次部署升版 |
| 未來 | 正式階段可改回 stale |

---

## ADR-012：舊資料 normalize

| 項目 | 內容 |
|---|---|
| 背景 | 狀態名稱從「未付款」改為 `pending` |
| 決策 | 讀取時 normalize；寫入時寫新代碼；舊節點保留 |
| 理由 | 不破壞舊資料；不需大規模遷移 |
| 影響 | compatibility.md 記錄映射 |

---

## ADR-013：8 個實體定義集中

| 項目 | 內容 |
|---|---|
| 背景 | 表單欄位散落各頁 |
| 決策 | entity-definitions.js 集中 |
| 理由 | 表單欄位只定義一處；動態生成 |
| 影響 | 新增實體只改 1 檔 |

**8 個實體**：member / bank / policy / fund / category / item / payment / status

---

## ADR-014：entity-resolvers 集中顯示

| 項目 | 內容 |
|---|---|
| 背景 | P17-06，保險受保人顯示 ID |
| 決策 | 新增 entity-resolvers.js |
| 理由 | entity 欄位 → 顯示 HTML 集中 |
| 影響 | entity-list-page 傳 resolvers |

---

## ADR-015：共用元件化（Modal / filter-sort）

| 項目 | 內容 |
|---|---|
| 背景 | B19，expense-modal 在 2 頁重複 |
| 決策 | 抽 lib/expense-modal.js + lib/income-modal.js + lib/filter-sort.js |
| 理由 | 2 頁共用；未來只改 1 處 |
| 影響 | input-center.js -420 行；settlements.js -100 行 |

**共用檔對照**：

| 檔案 | 使用頁 |
|---|---|
| lib/expense-modal.js | input-center / settlements |
| lib/income-modal.js | input-center |
| lib/filter-sort.js | settlements |

---

## ADR-016：基金分兩類（保險 / 獨立）

| 項目 | 內容 |
|---|---|
| 背景 | 使用者需求：每月供款 3500，按比例購買 3 款基金 |
| 決策 | 基金分 `type: 'insurance'` 與 `'standalone'` |
| 理由 | 保險基金掛於基金保險保單；獨立基金手動管理 |
| 影響 | insurance_policies 加 fundsAllocation；funds 加 type / policyId |
| 替代 | 全獨立（無法自動累積）；全保險（無法獨立記錄） |

---

## ADR-017：基金快照（B23）

| 項目 | 內容 |
|---|---|
| 背景 | 需每月記錄股數 / 股價 / 現值 / 盈虧 |
| 決策 | 每基金存 `snapshots/{year}/{month}` |
| 理由 | 保留歷史；可對比每月變化 |
| 影響 | funds 加 snapshots 節點；portfolio 加快照 Modal |

**snapshot 欄位**：shares / nav / value / contribution / cumulativeCost

---

## ADR-018：保險扣款觸發基金累積（B23）

| 項目 | 內容 |
|---|---|
| 背景 | 基金保險每月供款需自動分配到各基金 |
| 決策 | 結算清單改保險狀態為 done → 呼叫 _accumulateFunds |
| 理由 | 使用者只操作結算清單；系統自動分配 |
| 影響 | _insurance.js 加累積邏輯；撤銷時回退 |
| 禁止 | 手動修改 cumulativeCost |

---

/* ═══════════════════════════════════════════
   END OF FILE
   File: docs/adr.md
   Version: v103.0.21
   Batch: B24
   ═══════════════════════════════════════════ */