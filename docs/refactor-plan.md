# 重構計畫 — v102.1.0 → v103.0.0

方案代號：F（終極宣告式）
重構時間：預估 2.5~3 週（10 波交付）

## 一、方案選擇理由

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

## 二、目標架構

```
L1 頁面層：純 Schema（~30~80 行）
     ↓ Page Engine 解讀
L2 引擎層：page-engine / data-engine / render-engine
     ↓ 呼叫 Registry 與 Block
L3 核心層：Registry × 5 / Block × 5 / State / API
```

## 三、5 大 Registry 設計

### 3.1 status-registry.js

```js
export const STATUS = { PENDING: 'pending', DONE: 'done', SKIPPED: 'skipped' };
export const IS_DONE = { pending: false, done: true, skipped: true };
export const LABELS = {
  default: { pending: '未處理', done: '已處理', skipped: '不適用' },
  bySource: {
    personal:  { pending: '未付款', done: '已付款' },
    fixed:     { pending: '未付款', done: '已付款' },
    insurance: { pending: '未扣款', done: '已扣款' },
    income:    { pending: '未轉入', done: '已轉入' },
  },
};
export const LEGACY_MAP = {
  '未處理': 'pending', '未還款': 'pending', '未付款': 'pending', '未扣款': 'pending',
  '已處理': 'done', '已還款': 'done', '已付款': 'done', '已扣款': 'done',
  '不適用': 'skipped',
};
export function normalize(raw);
export function isDone(raw);
export function label(raw, { source });
export function options({ source });
export function badgeClass(raw);
```

### 3.2 entity-registry.js

註冊 7 種實體：members / banks / bank_accounts / categories / items / companies / payments

```js
export function init();
export function destroy();
export function resolveName(type, id, fallback);
export function getList(type);
export function getNameMap(type);
export function isInitialized();
```

### 3.3 label-registry.js

```js
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
```

### 3.4 column-registry.js

```js
export const COLUMNS = {
  members, banks, bankAccounts, insurance, funds,
  categories, items, payments, statuses, companies,
  settlements, bankTransactions, dashboardAnnual,
  annualSummary, memberReport,
};
export const RESOLVERS = {...};
export function getColumns(key);
export function getResolvers(key);
```

### 3.5 constants.js

擴充內容：
- APP_VERSION / SW_VERSION
- STORAGE_KEYS / STORAGE_PREFIXES / SESSION_KEYS
- LIMITS / RESERVED_IDS / ROLES / SOURCES
- BANK_TXN_TYPES / BANK_TXN_CATEGORIES / BANK_ACCOUNT_TYPES / PAYMENT_MODES
- ENTITY_KEYS / SIDEBAR_GROUPS / ROUTES / SHOW_YEAR_MONTH_PAGES
- DEFAULT_STATUSES / DEFAULT_OPTIONS / DEFAULT_YEAR_RANGE / DEFAULT_UI_CONSTANTS
- buildLinkedKey / getPolicyEffectiveMemberId / buildColumnSettingsKey

## 四、3 大引擎

### 4.1 page-engine.js

```js
export function createPage(schema);
// schema 格式：
// { title, data, state, derived, blocks }
// 回傳：{ ctx, destroy }
```

### 4.2 data-engine.js

```js
export function subscribe(cfg, callback);
export function makeReactive(obj, onChange);
```

### 4.3 render-engine.js

```js
export function mountBlock(block, ctx);
export function resolveExpr(expr, ctx);
```

## 五、5 大 Block

每個 Block 公開 API：

```js
export function mount(block, ctx);
// 回傳：{ onDepsChange, destroy }
```

| Block | 職責 | 對應舊元件 |
|---|---|---|
| stats-block | 統計卡區 | stats-cards.js |
| list-block | 列表區 | data-table + data-card + view-toggle |
| filter-block | 篩選列區 | page-filter |
| detail-block | 明細展開區 | 各頁 renderDetail |
| form-block | 表單 Modal 區 | entity-modal + form-builder |

## 六、檔案結構變動

### 刪除（26 檔）
- js/shared/*（重組至 ui / layout / entity / lib）
- js/pages/input-center/*（合併為 input-center.js）
- js/pages/database/*（合併為 database*.js）
- js/pages/settlements/*（合併）
- js/pages/insurance/*（合併）
- js/admin/platform-defaults.js（合併至 admin.js）

### 新增（21 檔）
- 5 個 Registry
- 4 個 lib（dom / async / lifecycle / registry）
- 3 個 engines
- 5 個 blocks
- 1 個 layout（app-shell）
- 3 個 docs MD

### 修改（~30 檔）

檔案數淨變化：104 → 95（-9）

## 七、舊資料相容策略

詳見 `compatibility.md`。

核心：
- 舊狀態名稱 → `status.normalize()` 轉換
- 舊 `banks` 節點 → `entity-registry` 註冊
- 舊 `bank_balances` → 不讀寫
- 舊 `fixed_expenses` → `summary.js` 讀取
- 舊 `linked_xxx` → `merge.js` 解析
- 缺 `paymentMode` → fallback `'direct'`
- 缺 `memberId` → 3 層 fallback

## 八、效能保證

- Cloudflare Pages + Brotli 壓縮
- 引擎 ~700 行（~15KB gzip）
- modulepreload 並行載入
- Firebase 監聽器集中
- Functions 合併（減少冷啟動）

## 九、重構期間相容

新舊模組並存：
- 已重構頁面用新架構
- 未重構頁面仍用舊架構
- 共用 state.js / api.js / db.js

重構完成後移除舊架構。
