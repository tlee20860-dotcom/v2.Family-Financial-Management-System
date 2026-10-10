# 重構計畫 — v102.1.0 → v103.0.18

最後更新：B19
狀態：重構完成 ✅
實際執行：含 B12~B19 修復

方案代號：F（終極宣告式）

═══════════════════════════════════════════════════════
【一、方案選擇理由】
═══════════════════════════════════════════════════════

| 方案 | 檔案數 | 行數 | 頁面層 | 風險 |
|---|---|---|---|---|
| A 最小修復 | 104 | 28,000 | 9,000 | 極低 |
| B 模組化 | 89 | 24,000 | 7,500 | 低 |
| C Registry | 91 | 22,000 | 6,500 | 中 |
| D Blocks | 92 | 21,000 | 5,000 | 中 |
| E 響應式 | 90 | 20,000 | 3,000 | 中高 |
| **F 終極宣告式** | **95** | **19,300** | **1,200** | **中高** |

實際結果（v103.0.18）：
- 檔案數：約 111 檔（含 docs / debug / entity-resolvers / lib modals）
- 頁面層：約 1,600 行（含 customMount 頁面）

═══════════════════════════════════════════════════════
【二、目標架構】
═══════════════════════════════════════════════════════

L1 頁面層：純 Schema（~30~80 行）
     ↓ Page Engine 解讀
L2 引擎層：page-engine / data-engine / render-engine
     ↓ 呼叫 Registry 與 Block
L3 核心層：Registry × 5 / Block × 5 / State / API

實際實現：
  L1 → js/pages/*.js（13 個 Schema）
  L2 → js/engines/*.js（3 個）
  L3 → js/config/*.js（5 Registry）
       js/blocks/*.js（5 Block）
       js/core/*.js（state / api / db）

═══════════════════════════════════════════════════════
【三、5 大 Registry 設計】
═══════════════════════════════════════════════════════

■ 3.1 status-registry.js

  export const STATUS = { PENDING: 'pending', DONE: 'done', SKIPPED: 'skipped' };
  export const IS_DONE = {...};
  export const LABELS = {...};
  export const LEGACY_MAP = {...};

  export function normalize(raw);
  export function isDone(raw);
  export function label(raw, { source });
  export function options({ source });
  export function badgeClass(raw);

■ 3.2 entity-registry.js

  註冊 7 種實體：
    members / banks / bank_accounts / categories
    items / companies / payments

  export function init();
  export function destroy();
  export function resolveName(type, id, fallback);
  export function getList(type);
  export function getNameMap(type);
  export function isInitialized();

■ 3.3 label-registry.js

  export const LABELS = {
    common, pages, fields, actions, confirm, toast, emptyState,
  };

  export function L(path, params);

■ 3.4 column-registry.js

  export const COLUMNS = {
    members, banks, bankAccounts, insurance, funds,
    categories, items, payments, statuses, companies,
    settlements, bankTransactions, dashboardAnnual,
    annualSummary, annualMonthly, memberReport,
  };

  export const RESOLVERS = {...};

  export function getColumns(key);
  export function getResolvers(key);

■ 3.5 constants.js

  擴充內容：
    APP_VERSION / SW_VERSION
    STORAGE_KEYS / STORAGE_PREFIXES / SESSION_KEYS
    LIMITS / RESERVED_IDS / ROLES / SOURCES
    BANK_TXN_TYPES / BANK_TXN_CATEGORIES
    BANK_ACCOUNT_TYPES / PAYMENT_MODES
    ENTITY_KEYS / SIDEBAR_GROUPS / ROUTES
    SHOW_YEAR_MONTH_PAGES
    DEFAULT_STATUSES / DEFAULT_OPTIONS
    DEFAULT_YEAR_RANGE / DEFAULT_UI_CONSTANTS
    PLATFORM_RESOURCES
    buildLinkedKey / getPolicyEffectiveMemberId
    buildColumnSettingsKey

═══════════════════════════════════════════════════════
【四、3 大引擎】
═══════════════════════════════════════════════════════

■ 4.1 page-engine.js

  export function createPage(schema);

  schema 格式：
    {
      title,            // 頁面標題
      data,             // Firebase 訂閱配置
      state,            // 響應式狀態初始值
      derived,          // 衍生資料計算
      blocks,           // UI 區塊
      onYearMonthChange,// 年月變更 hook（可選）
      customMount,      // 複雜邏輯逃生艙（可選）
    }

  回傳：
    { ctx, destroy, ready }

  ctx 結構：
    {
      meta, state, data, derived,
      invalidate(key),
      setState(keyPath, value),
      onDataChange(fn),   // 統一資料變更通知
    }

  版本歷程：
    v103.0.0 → 首次交付（缺 customMount）
    v103.0.1 → 補 customMount
    v103.0.4 → 補 data. 前綴
    v103.0.7 → 容忍 undefined 依賴
    v103.0.8 → 修正 _computeOne schema 傳遞
    v103.0.15 → 加 onYearMonthChange hook
    v103.0.17 → 加 ctx.onDataChange（B18.1）

■ 4.2 data-engine.js

  export function subscribe(cfg, callback);
  export function makeReactive(obj, onChange);
  export function fetchOnce(cfg);
  export function resolvePath(rawPath, params);
  export function getNestedValue(obj, path);
  export function setNestedValue(obj, path, value);

  支援 type: 'list' | 'object' | 'value' | 'raw'
  支援 {key} 與 {__all__} 佔位符

■ 4.3 render-engine.js

  export function mountBlock(block, ctx);
  export function resolveExpr(expr, ctx);
  export function resolveDeep(obj, ctx);
  export function collectBlockDeps(block);

═══════════════════════════════════════════════════════
【五、5 大 Block】
═══════════════════════════════════════════════════════

每個 Block 公開 API：

  export function mount(block, ctx);
  // 回傳：{ onDepsChange, destroy }

| Block | 職責 | 對應舊元件 |
|---|---|---|
| stats-block | 統計卡區 | stats-cards.js |
| list-block | 列表區 | data-table + data-card + view-toggle |
| filter-block | 篩選列區 | page-filter |
| detail-block | 明細展開區 | 各頁 renderDetail |
| form-block | 表單 Modal 區 | entity-modal + form-builder |

B19 起 block 加 renderInPlace（同 HTML 不重繪）。

═══════════════════════════════════════════════════════
【六、檔案結構變動】
═══════════════════════════════════════════════════════

■ 刪除

  - js/shared/* 部分（重組至 ui / layout / entity / lib）
  - js/pages/input-center/*（合併）
  - js/pages/database/*（合併）
  - js/pages/settlements/*（合併）
  - js/pages/insurance/*（合併）
  - js/core/app.js（改為 layout/app-shell.js）
  - functions/api/{admin,bank,family,insurance,personal,platform,summary}.js
    （改 _*.js + [[path]].js）

■ 新增

  - 5 個 Registry
  - 4 個 lib（dom / async / lifecycle / registry）
  - 3 個 engines
  - 5 個 blocks
  - 1 個 layout（app-shell）
  - 1 個 core（debug）
  - 1 個 entity（entity-resolvers，B18）
  - 3 個 lib（expense-modal / income-modal / filter-sort，B19）
  - functions/api/{_admin,_bank,_family,_insurance,_personal,_platform,_summary}.js
  - functions/api/[[path]].js

■ 修改（~50 檔）

  修正 import 路徑、修復邏輯錯誤、無補丁重構。

═══════════════════════════════════════════════════════
【七、舊資料相容策略】
═══════════════════════════════════════════════════════

詳見 compatibility.md。

核心：
  - 舊狀態名稱 → status.normalize() 轉換
  - 舊 banks 節點 → entity-registry 註冊
  - 舊 bank_balances → 不讀寫
  - 舊 fixed_expenses → summary.js 讀取
  - 舊 linked_xxx → merge.js 解析
  - 缺 paymentMode → fallback 'direct'
  - 缺 memberId → 3 層 fallback

═══════════════════════════════════════════════════════
【八、效能保證】
═══════════════════════════════════════════════════════

- Cloudflare Pages + Brotli 壓縮
- 引擎 ~700 行（~15KB gzip）
- modulepreload 並行載入
- Firebase 監聽器集中
- Functions Catch-all 路由（統一入口）
- B19 起 block 就地更新（不 destroy/create）

═══════════════════════════════════════════════════════
【九、重構成果】
═══════════════════════════════════════════════════════

| 項目 | v102 | v103.0.18 |
|---|---|---|
| 檔案數 | 104 | 約 111（含新增） |
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

關鍵成果：
  ✅ 頁面層精簡 82%
  ✅ 5 Registry SSOT 集中
  ✅ 3 引擎宣告式
  ✅ 5 Block 可重用
  ✅ 13 Page Schema
  ✅ 舊資料 100% 相容
  ✅ 操作邏輯不變
  ✅ 手機 vConsole 除錯
  ✅ 部署一次到位
  ✅ 無補丁重構

═══════════════════════════════════════════════════════
【十、重構期間挑戰（B12~B19）】
═══════════════════════════════════════════════════════

見 incident-log.md：

B12：阻斷級修復（B01~B07）
B13：SSOT 統一（H01~H11）
B14：中優先（M01~M18）
B15：低優先（L01~L07）
B16：問題清單修正（P16-01~P16-05）
B17：問題清單修正（P17-01~P17-06）
B18：entity-resolvers + portfolio
B18.1：page-engine onDataChange
B19：無補丁重構

═══════════════════════════════════════════════════════
【十一、教訓總結】
═══════════════════════════════════════════════════════

1. Cloudflare Pages Functions
   - 每個 URL 必須對應獨立實體檔案
   - 不支援 shim re-export
   - Catch-all + 底線前綴最穩定

2. 內部連結
   - 一律帶 .html
   - 不要對 / 加 _redirects

3. Page Engine
   - 必須支援 customMount
   - 必須支援 onDataChange
   - 事件 key 與依賴圖一致
   - derived 計算容忍 undefined

4. Import 路徑
   - esc → dom.js
   - format* → format.js
   - 搬移後全域搜尋舊路徑

5. Service Worker
   - 開發階段 network-first
   - 正式階段可改 stale
   - CACHE_NAME 有版本號

6. 除錯
   - 手機內嵌 vConsole
   - 非必要模組用動態 import

7. 部署驗證
   - 直接訪問檔案 URL
   - 不要只看頁面表現
   - GitHub 網頁編輯最安全

8. 無補丁原則（B19）
   - 能宣告就不手寫
   - 能就地更新就不 destroy/create
   - 更好就換，不為向後相容妥協

/* ═══════════════════════════════════════════
   END OF FILE
   File: docs/refactor-plan.md
   Version: v103.0.18
   Batch: B19
   ═══════════════════════════════════════════ */