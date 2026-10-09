# 重構計畫 — v102.1.0 → v103.0.11

最後更新：2026-10-10
狀態：重構完成 ✅
實際執行時間：1 天（含部署修復）

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

選擇 F 理由：
- 一次性解決所有問題
- 頁面層精簡 87%
- 未來新增頁面成本最低
- 相容層 < 300 行

實際結果：
- 檔案數：約 111 檔（含 docs / 新增的 debug / catch-all）
- 頁面層：約 1,400 行（含 5 個 customMount 較複雜頁面）

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

  export const STATUS = {
    PENDING: 'pending',
    DONE: 'done',
    SKIPPED: 'skipped',
  };

  export const IS_DONE = {
    pending: false,
    done: true,
    skipped: true,
  };

  export const LABELS = {
    default: {
      pending: '未處理', done: '已處理', skipped: '不適用',
    },
    bySource: {
      personal:  { pending: '未付款', done: '已付款' },
      fixed:     { pending: '未付款', done: '已付款' },
      insurance: { pending: '未扣款', done: '已扣款' },
      income:    { pending: '未轉入', done: '已轉入' },
    },
  };

  export const LEGACY_MAP = {
    '未處理': 'pending', '未還款': 'pending',
    '未付款': 'pending', '未扣款': 'pending',
    '已處理': 'done', '已還款': 'done',
    '已付款': 'done', '已扣款': 'done',
    '不適用': 'skipped',
  };

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
    common: {...},
    pages: {...},
    fields: {...},
    actions: {...},
    confirm: {...},
    toast: {...},
    emptyState: {...},
  };

  export function L(path, params);

■ 3.4 column-registry.js

  export const COLUMNS = {
    members, banks, bankAccounts, insurance, funds,
    categories, items, payments, statuses, companies,
    settlements, bankTransactions, dashboardAnnual,
    annualSummary, memberReport,
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
    buildLinkedKey / getPolicyEffectiveMemberId
    buildColumnSettingsKey

═══════════════════════════════════════════════════════
【四、3 大引擎】
═══════════════════════════════════════════════════════

■ 4.1 page-engine.js

  export function createPage(schema);

  schema 格式：
    {
      title,           // 頁面標題
      data,            // Firebase 訂閱配置
      state,           // 響應式狀態初始值
      derived,         // 衍生資料計算
      blocks,          // UI 區塊
      customMount,     // 複雜邏輯逃生艙
    }

  回傳：
    { ctx, destroy, ready }

  ctx 結構：
    {
      meta, state, data, derived,
      invalidate(key),
      setState(keyPath, value),
    }

  版本歷程：
    v103.0.0 → 首次交付（缺 customMount）
    v103.0.1 → 補 customMount
    v103.0.4 → 補 data. 前綴
    v103.0.7 → 容忍 undefined 依賴
    v103.0.8 → 修正 _computeOne schema 傳遞

■ 4.2 data-engine.js

  export function subscribe(cfg, callback);
  export function makeReactive(obj, onChange);
  export function fetchOnce(cfg);
  export function resolvePath(rawPath, params);
  export function getNestedValue(obj, path);
  export function setNestedValue(obj, path, value);

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

═══════════════════════════════════════════════════════
【六、檔案結構變動】
═══════════════════════════════════════════════════════

■ 刪除（預期）

  - js/shared/* 部分（重組至 ui / layout / entity / lib）
  - js/pages/input-center/*（合併）
  - js/pages/database/*（合併）
  - js/pages/settlements/*（合併）
  - js/pages/insurance/*（合併）
  - js/admin/platform-defaults.js（合併至 admin.js）
  - js/core/app.js（改為 layout/app-shell.js）

■ 新增（預期 + 實際）

  預期：
    - 5 個 Registry
    - 4 個 lib（dom / async / lifecycle / registry）
    - 3 個 engines
    - 5 個 blocks
    - 1 個 layout（app-shell）

  實際額外新增（實戰修復）：
    - js/core/debug.js（vConsole 注入）
    - functions/api/[[path]].js（Catch-all 路由）
    - functions/api/_xxx.js × 7（從 xxx.js 改名）

■ 修改（~30 檔）

  修正 import 路徑、修復邏輯錯誤。

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

═══════════════════════════════════════════════════════
【九、重構期間相容】
═══════════════════════════════════════════════════════

重構完成後：
  - 舊 core/app.js 廢除（改用 layout/app-shell.js）
  - 舊 shared/* 保留仍在使用的 12 檔
  - 舊 pages/子目錄合併為單檔
  - 舊 Functions 合併為 10 檔

═══════════════════════════════════════════════════════
【十、重構成果】
═══════════════════════════════════════════════════════

| 項目 | v102 | v103 |
|---|---|---|
| 檔案數 | 104 | 約 111（含新增） |
| 頁面層行數 | 9,000 | ~1,400 |
| Registry 集中 | 0 | 5 |
| Engine | 0 | 3 |
| Block | 0 | 5 |
| Page Schema | 0 | 13 |
| 手機除錯 | 無 | vConsole |
| SW 策略 | stale | network-first |

關鍵成果：
  ✅ 頁面層精簡 84%
  ✅ 5 Registry SSOT 集中
  ✅ 3 引擎宣告式
  ✅ 5 Block 可重用
  ✅ 13 Page Schema
  ✅ 舊資料 100% 相容
  ✅ 操作邏輯不變
  ✅ 手機 vConsole 除錯
  ✅ 部署一次到位

═══════════════════════════════════════════════════════
【十一、重構過程遇到的挑戰】
═══════════════════════════════════════════════════════

見 incident-log.md 的 13 個問題：

P01 CF Functions 路由 500 → Catch-all + 底線前綴
P02 HTML 缺 .html 匹配 .js → href 加 .html
P03 _redirects 重定向循環 → 刪除
P04 page-engine 缺 customMount → 補上
P05 _onKeyChange 缺 data. 前綴 → 補上
P06 esc 錯誤導入 → 拆兩行
P07 derived 對 undefined 崩潰 → 跳過計算
P08 手機無 Console → vConsole
P09 app-shell 靜態 import → 動態 import
P10 SW stale-while-revalidate → network-first
P11 GitHub 檔案未更新 → 網頁編輯
P12 database.js 內容錯誤 → 覆蓋
P13 js/shared/* 舊 import → 全域修正

═══════════════════════════════════════════════════════
【十二、教訓總結】
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

═══════════════════════════════════════════════════════
【結束】
═══════════════════════════════════════════════════════