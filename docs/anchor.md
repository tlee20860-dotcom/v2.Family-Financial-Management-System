# 主錨點 — 家庭財務 Web App v103.0.18

最後更新：B19
當前版本：v103.0.18
SW 快取版本：family-fin-v139

## AI 讀取順序

當使用者說「請交付第 N 波」時：

1. `anchor.md`（本檔案）
2. `refactor-plan.md`
3. `progress.md`
4. `delivery-rules.md`
5. `api-contracts.md`
6. `data-structure.md`
7. `compatibility.md`

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
4. AI 可讀即可：
   - 不為「人類可讀性」犧牲簡潔
   - 註解只寫「為什麼」，不寫「做什麼」
   - 變數命名可極簡（只要語意明確）
5. 禁止：
   - 複製貼上重複邏輯
   - 猴子補丁（改引擎，不改呼叫端）
   - 手寫 HTML 字串（用 render engine / block）
   - 為了「避免新增檔案」而妥協

### 0.3 無補丁原則（最高優先）

1. 定義：補丁 = 為修 A 而加 B，B 只掩蓋症狀
2. 禁止補丁思維：
   - ❌ 加快取變數判斷「資料有沒有變」
   - ❌ 猴子補丁覆寫引擎方法
   - ❌ 重複「訂閱 → render → destroy → create」
3. 寧願重寫：
   - 若發現需要補丁 → 停下
   - 檢視更根本的設計
   - 一次重新編寫該模組
4. 更好就換：
   - 若發現更好、更簡潔、更實用的方法
   - 不管已交付與否，直接換
   - 不為「向後相容」妥協品質

### 0.4 檔案大小限制

- 單檔 ≤ 500 行（一次 text 可交付）
- 超過 → 拆檔
- 目標：一檔一職責

### 0.5 共用元件化（核心）

- 同一功能在多頁出現 → 抽成共用模組
- 未來修改只改共用模組 1 處
- 禁止在多頁重複實作同一功能
- 判斷準則：「這功能未來會不會改？」
  - 會 → 抽共用
  - 不會 → 可留在原檔

### 0.6 交付批次號（強制）

格式：
- `B01 ~ B99`：B + 2 位數字
- `B99 之後`：`C01 ~ C99`
- `C99 之後`：`D01 ~ D99`
- 依此類推（前綴字母 A → B → C → D → ...）
- 重交付：`B{n}.{x}`（例：B18.1）

規則：
1. 每波交付必須有批次號
2. 檔案內註解：`v103.0.xx`（項目版本）+ 批次號
3. 禁止混用「波次」與「版本號」
4. 禁止每次換說法

### 0.7 更新清單流程（強制）

使用者說「需要更新清單」時：

1. AI 先列「所有已交付批次」：
   ```
   目前已交付批次：
   - B01 ~ B19
   請回覆你目前已部署到哪個批次？
   ```

2. 使用者回「已部署到 B{n}」：
   - AI 列「B{n} 之後所有批次的最新版清單」
   - 同檔以最新批次為準
   - 格式：`B{批次} ← 路徑`

3. 使用者回「全未部署」：
   - AI 列「全部批次的最新版清單」

4. 格式範例：
   ```
   B18.1 ← js/engines/page-engine.js
   B18   ← js/entity/entity-resolvers.js
   B19   ← js/shared/data-table.js
   ```

### 0.8 交付前自我檢查（強制）

每次交付前，AI 必須列出：

1. 本次交付約束：
   - 單檔行數（≤ 500）
   - 是否有重複邏輯需抽出
   - 是否遵循 SSOT
   - 是否最簡潔實用

2. 受影響範圍：
   - 哪些檔案改動
   - 哪些頁面受影響
   - 是否有依賴衝突

3. 待驗證項：
   - 明確列出測試清單
   - 給出可在 vConsole 執行的驗證指令

4. 風險提醒：
   - 有無破壞性改動
   - 有無向後相容問題
   - 建議測試順序

5. 檔案結束標記（B20 起）：
   - 每個交付檔案最後有 `END OF FILE` 標記
   - 標記含 `File` / `Version` / `Batch`
   - 格式統一（═ 分隔線）

6. 檔案清單更新：
   - 本次交付的檔案已更新至「檔案清單」
   - 版本號與批次號正確

### 0.9 AI 必須遵循錨點

- 錨點是最高權威
- 執行前先核對錨點內容
- 如發現衝突 → 立即提醒使用者
- 不得默默照做，也不得默默違反

### 0.10 主動提案義務

- 看到更好方案 → 主動提出
- 決策不合理 → 明確反對並說明
- 不因「使用者已決定」而放棄建議

### 0.11 檔案結束標記（強制，B20 起生效）

**格式**（每個交付檔案最後）：

```
/* ═══════════════════════════════════════════
   END OF FILE
   File: {路徑}
   Version: {項目版本}
   Batch: {批次號}
   ═══════════════════════════════════════════ */
```

**目的**：
- 快速檢查是否為最新版
- 檢查檔案是否被截斷
- 便於工具掃描

**生效範圍**：B20 起所有新交付。B01~B19 已交付檔案不補。

### 0.12 檔案清單維護（強制）

1. 本錨點必須維護「檔案清單」段落
2. 每次交付後必須更新清單中的版本 + 批次
3. 清單格式：`| 檔案 | 版本 | 批次 |`
4. 清單按目錄分類

### 0.13 交付格式（強制）

每個檔案交付必須用以下格式：

```
## 📁 檔案路徑

```
{相對路徑}
```

## 📄 檔案內容

```{lang}
（完整內容）
```
```

**規則**：

1. 檔案路徑單獨用一個 code block（無語言標示）
2. 檔案內容用 `code block` 包裹，附語言標示（js / md / json / css / html）
3. **若內容內含 ``` code block**，外層用 4 backtick（````）包裹
4. 每個檔案獨立區塊，不可合併多檔
5. 內容必須完整
6. **不可用 diff**
7. **不可用「...」「同上」「略」**
8. 檔案最後加 `END OF FILE` 標記（B20 起）
9. 交付清單開頭必須標示「批次號」與「本輪第幾批」

### 0.14 自我檢查清單（每次交付前）

- [ ] import 完整
- [ ] export 完整
- [ ] 無語法錯誤
- [ ] 符合 SSOT 原則
- [ ] 路徑與專案結構一致
- [ ] 所有 button 有 `type="button"`
- [ ] 狀態判定走 `status-registry`
- [ ] 名稱解析走 `entity-registry`
- [ ] 顯示文字走 `label-registry`
- [ ] 表格欄位走 `column-registry`
- [ ] 檔案最後有 `END OF FILE` 標記（B20 起）
- [ ] 已更新檔案清單

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

1. SSOT 極大化：任何知識只存在一處
2. 宣告式 > 命令式：頁面只描述「要什麼」
3. 舊資料 100% 相容：讀取時 normalize
4. 操作邏輯不變：只改實作方式
5. 無補丁：能宣告就不手寫，能就地更新就不 destroy/create

---

## 三、5 大 Registry

| Registry | 職責 |
|---|---|
| `status-registry.js` | 狀態系統 |
| `entity-registry.js` | 名稱解析 |
| `label-registry.js` | 顯示文字 |
| `column-registry.js` | 表格欄位 |
| `constants.js` | 全站常數 |

---

## 四、3 大引擎

| 引擎 | 職責 | 行數 |
|---|---|---|
| `page-engine.js` | 解讀 Schema、生命週期、`onDataChange` 通知 | ~280 |
| `data-engine.js` | Firebase 訂閱 + 衍生 | ~200 |
| `render-engine.js` | 掛載 UI 區塊 | ~250 |

---

## 五、5 大 Block

| Block | 職責 |
|---|---|
| `stats-block.js` | 統計卡區 |
| `list-block.js` | 列表區 |
| `filter-block.js` | 篩選列區 |
| `detail-block.js` | 明細展開區 |
| `form-block.js` | 表單 Modal 區 |

---

## 六、Page Schema 格式

```js
export default {
  title: '頁面標題',
  data: {
    members:  { type: 'list', path: 'members' },
    expenses: { type: 'raw', path: 'expenses' },
  },
  state: {
    filters: { year: '', month: '' },
  },
  derived: {
    rows: { deps: ['data.members', 'data.expenses'], compute: (m, e) => ... },
  },
  blocks: [
    { type: 'stats', container: 'xxx-stats', cards: '$.stats' },
    { type: 'list',  container: 'xxx-list',  rows: '$.rows', columns: 'xxx' },
  ],
  // 可選：年月變更 hook
  onYearMonthChange: (ctx) => { ... },
  // 可選：逃生艙
  customMount: (ctx) => {
    const unsub = ctx.onDataChange((key) => { ... });
    return { destroy: () => unsub() };
  },
};
```

---

## 七、目標檔案結構

```
js/
├── config/（7）constants / firebase-config / app-config / 4 Registry
├── core/（8）state / api / db / auth / auth-guard / utils / pwa / debug
├── lib/（11）dom / async / lifecycle / registry / merge / insurance / bank / format / expense-modal / income-modal / filter-sort
├── engines/（3）page / data / render
├── blocks/（5）stats / list / filter / detail / form
├── ui/（6）toast / modal / form-builder / tab-panel / view-toggle / collapsible
├── layout/（3）navbar / sidebar / app-shell
├── entity/（4）entity-modal / entity-helpers / entity-definitions / entity-resolvers
├── admin/（2）admin / platform-defaults
└── pages/（13）純 Schema

functions/api/（10）_config / _helpers / _admin / _bank / _family / _insurance / _personal / _platform / _summary / [[path]]
docs/（9）README / anchor / refactor-plan / progress / delivery-rules / api-contracts / data-structure / compatibility / incident-log
```

---

## 八、檔案清單（最新版本）

最後更新：B19

### js/config/（7）

| 檔案 | 版本 | 批次 |
|---|---|---|
| `constants.js` | v103.0.12 | B13 |
| `firebase-config.js` | — | B04 |
| `app-config.js` | v102.0.0 | B04 |
| `status-registry.js` | v103.0.0 | B01 |
| `entity-registry.js` | v103.0.0 | B04 |
| `label-registry.js` | v103.0.0 | B01 |
| `column-registry.js` | v103.0.15 | B17 |

### js/core/（8）

| 檔案 | 版本 | 批次 |
|---|---|---|
| `state.js` | v103.0.11 | B14A |
| `db.js` | v103.0.12 | B14B |
| `utils.js` | v103.0.11 | B14A |
| `auth.js` | v103.0.0 | B05 |
| `auth-guard.js` | v103.0.11 | B13A |
| `api.js` | v103.0.0 | B05 |
| `pwa.js` | v103.0.0 | B05 |
| `debug.js` | v103.0.14 | B14C |

### js/lib/（11）

| 檔案 | 版本 | 批次 |
|---|---|---|
| `dom.js` | v103.0.0 | B03 |
| `format.js` | v103.0.0 | B03 |
| `async.js` | v103.0.2 | B03 |
| `lifecycle.js` | v103.0.0 | B03 |
| `registry.js` | v103.0.0 | B03 |
| `merge.js` | v103.0.0 | B03 |
| `insurance.js` | v103.0.0 | B03 |
| `bank.js` | v103.0.0 | B03 |
| `expense-modal.js` | v103.0.18 | B19 |
| `income-modal.js` | v103.0.18 | B19 |
| `filter-sort.js` | v103.0.18 | B19 |

### js/engines/（3）

| 檔案 | 版本 | 批次 |
|---|---|---|
| `page-engine.js` | v103.0.17 | B18.1 |
| `data-engine.js` | v103.0.11 | B12 |
| `render-engine.js` | v103.0.0 | B07 |

### js/blocks/（5）

| 檔案 | 版本 | 批次 |
|---|---|---|
| `list-block.js` | v103.0.18 | B19 |
| `stats-block.js` | v103.0.18 | B19 |
| `filter-block.js` | v103.0.0 | B08 |
| `detail-block.js` | v103.0.0 | B08 |
| `form-block.js` | v103.0.12 | B15 |

### js/ui/（6）

| 檔案 | 版本 | 批次 |
|---|---|---|
| `toast.js` | v103.0.0 | B04 |
| `modal.js` | v103.0.0 | B04 |
| `form-builder.js` | v103.0.11 | B14B |
| `tab-panel.js` | v103.0.12 | B14A |
| `view-toggle.js` | v103.0.12 | B14A |
| `collapsible.js` | v103.0.0 | B04 |

### js/layout/（3）

| 檔案 | 版本 | 批次 |
|---|---|---|
| `navbar.js` | v103.0.12 | B15 |
| `sidebar.js` | v103.0.12 | B15 |
| `app-shell.js` | v103.0.9 | B11 |

### js/entity/（4）

| 檔案 | 版本 | 批次 |
|---|---|---|
| `entity-definitions.js` | v103.0.0 | B06 |
| `entity-helpers.js` | v103.0.0 | B06 |
| `entity-modal.js` | v103.0.0 | B06 |
| `entity-resolvers.js` | v103.0.16 | B18 |

### js/admin/（2）

| 檔案 | 版本 | 批次 |
|---|---|---|
| `admin.js` | v103.0.2 | B11 |
| `platform-defaults.js` | v103.0.2 | B11 |

### js/shared/（12）

| 檔案 | 版本 | 批次 |
|---|---|---|
| `data-table.js` | v103.0.18 | B19 |
| `data-card.js` | v103.0.11 | B13B1 |
| `entity-list-page.js` | v103.0.16 | B18 |
| `column-settings.js` | v103.0.11 | B13B1 |
| `bank-account-manager.js` | v103.0.11 | B13B1 |
| `page-filter.js` | v103.0.11 | B13B2 |
| `quick-summary.js` | v103.0.12 | B15 |
| `select-helpers.js` | v103.0.11 | B13B2 |
| `stats-cards.js` | v103.0.11 | B13B2 |
| `date-helpers.js` | v101 | （未變） |
| `form-handler.js` | v103.0.11 | B13B3 |
| `listener-group.js` | v103.0.11 | B13B3 |

### js/pages/（13）

| 檔案 | 版本 | 批次 |
|---|---|---|
| `dashboard.js` | v103.0.17 | B18.1 |
| `portfolio.js` | v103.0.16 | B18 |
| `annual-report.js` | v103.0.18 | B19 |
| `settings.js` | v103.0.13 | B14C |
| `finance-overview.js` | v103.0.18 | B19 |
| `member-report.js` | v103.0.15 | B17 |
| `input-center.js` | v103.0.18 | B19 |
| `database.js` | v103.0.3 | B11 |
| `database-options.js` | v103.0.0 | B11 |
| `database-dropdowns.js` | v103.0.0 | B11 |
| `database-yearrange.js` | v103.0.0 | B11 |
| `settlements.js` | v103.0.18 | B19 |
| `insurance.js` | v103.0.18 | B19 |

### functions/api/（10）

| 檔案 | 版本 | 批次 |
|---|---|---|
| `[[path]].js` | v103.0.2 | B11 |
| `_config.js` | v103.0.0 | B10 |
| `_helpers.js` | v103.0.0 | B10 |
| `_admin.js` | v103.0.2 | B11 |
| `_bank.js` | v103.0.2 | B11 |
| `_family.js` | v103.0.2 | B11 |
| `_insurance.js` | v103.0.2 | B11 |
| `_personal.js` | v103.0.2 | B11 |
| `_platform.js` | v103.0.2 | B11 |
| `_summary.js` | v103.0.2 | B11 |

### 根目錄

| 檔案 | 版本 | 批次 |
|---|---|---|
| `sw.js` | v103.0.11 | B13A |
| `manifest.json` | — | （未變） |
| `portfolio.html` | — | B18 |
| 其餘 12 HTML | — | B11 |

---

## 九、批次歷史

| 批次 | 波次 | 主題 | 檔案數 |
|---|---|---|---|
| B01 | 第 1 波 | 5 Registry + constants | 5 |
| B02 | 第 2 波 | Core 基礎 | 7 |
| B03 | 第 3 波 | Lib 工具集 | 8 |
| B04 | 第 4 波 | UI 元件 | 6 |
| B05 | 第 5 波 | Layout | 3 |
| B06 | 第 6 波 | Entity | 3 |
| B07 | 第 7 波 | Engines | 3 |
| B08 | 第 8 波 | Blocks | 5 |
| B09 | 第 9 波 | Pages | 13 |
| B10 | 第 10 波 | Functions API + 系統層 | 12+ |
| B11 | 第 11 波 | 實戰修復（13 問題） | 20+ |
| B12 | 第 12 波 | 阻斷級修復 | 5 + 刪 7 |
| B13 | 第 13 波 | SSOT 統一 | 17 |
| B14 | 第 14 波 | 中優先 | 12 |
| B15 | 第 15 波 | 低優先 | 5 |
| B16 | 第 16 波 | 問題清單修正（P16） | 13 |
| B17 | 第 17 波 | 問題清單修正（P17） | 9 |
| B18 | 第 18 波 | entity-resolvers + portfolio | 4 |
| B18.1 | 第 18 波 v2 | page-engine onDataChange | 2 |
| B19 | 第 19 波 | 無補丁重構 | 10 |

---

## 十、下一步

回覆：
- 「請交付第 N 波」→ AI 依 `progress.md` 交付
- 「查看進度」→ AI 讀取 `progress.md` 回報
- 「需要更新清單」→ AI 列已交付批次，待使用者確認部署進度

---

## 十一、待辦事項

- [ ] 效能優化：SW 改回 stale-while-revalidate
- [ ] 補齊 `js/shared/` 中未使用檔案的清理
- [ ] 補 `_headers`（若 MIME type 有問題）
- [ ] B20 起所有交付加 `END OF FILE` 標記

---

## 十二、目前狀態

| 項目 | 值 |
|---|---|
| 專案版本 | v103.0.18 |
| 最新批次 | B19 |
| SW 版本 | family-fin-v139 |
| 部署 URL | https://family-financial-management-system.pages.dev |
| 測試狀態 | ⏳ B19 部署完成，待測試 |

完成度：
- ✅ 5 Registry
- ✅ 3 Engine（含 `onDataChange` hook）
- ✅ 5 Block（含 `renderInPlace`）
- ✅ 13 Page Schema
- ✅ Functions API（10 檔）
- ✅ 全站頁面可訪問
- ✅ 所有 API 正常
- ✅ 統計卡顯示
- ✅ 手機 vConsole 除錯
- ✅ Service Worker network-first
- ✅ 無補丁重構（B19）
- ✅ 統一自動更新（`onDataChange`）
- ✅ 共用 Modal（`lib/expense-modal` / `income-modal`）
- ✅ 共用 filter/sort（`lib/filter-sort`）

---

/* ═══════════════════════════════════════════
   END OF FILE
   File: docs/anchor.md
   Version: v103.0.18
   Batch: B19
   ═══════════════════════════════════════════ */