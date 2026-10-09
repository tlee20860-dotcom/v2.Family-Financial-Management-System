# API 契約 — v103.0.0

## 一、前端模組 API

### status-registry.js

```js
export const STATUS = { PENDING: 'pending', DONE: 'done', SKIPPED: 'skipped' };
export const IS_DONE = {...};
export const LABELS = { default: {...}, bySource: {...} };
export const LEGACY_MAP = {...};

export function normalize(raw);          // → 標準代碼
export function isDone(raw);             // → boolean
export function label(raw, { source });  // → 顯示文字
export function options({ source });     // → [{ value, label }]
export function badgeClass(raw);         // → 'badge-success' | 'badge-pending'
```

### entity-registry.js

```js
export function init();
export function destroy();
export function resolveName(type, id, fallback);
export function getList(type);
export function getNameMap(type);
export function isInitialized();
```

### label-registry.js

```js
export const LABELS = {...};
export function L(path, params);
```

### column-registry.js

```js
export const COLUMNS = {...};
export const RESOLVERS = {...};
export function getColumns(key);
export function getResolvers(key);
```

### constants.js

```js
export const APP_VERSION, SW_VERSION;
export const STORAGE_KEYS, STORAGE_PREFIXES, SESSION_KEYS;
export const LIMITS, RESERVED_IDS, ROLES, SOURCES;
export const BANK_TXN_TYPES, BANK_TXN_CATEGORIES;
export const BANK_ACCOUNT_TYPES, PAYMENT_MODES;
export const ENTITY_KEYS, SIDEBAR_GROUPS, ROUTES, SHOW_YEAR_MONTH_PAGES;
export const DEFAULT_STATUSES, DEFAULT_OPTIONS;
export const DEFAULT_YEAR_RANGE, DEFAULT_UI_CONSTANTS;
export function buildLinkedKey(policyId);
export function getPolicyEffectiveMemberId(policy);
export function buildColumnSettingsKey(tableId);
```

### page-engine.js

```js
export function createPage(schema);
// 回傳：{ ctx, destroy }
```

### data-engine.js

```js
export function subscribe(cfg, callback);
export function makeReactive(obj, onChange);
```

### render-engine.js

```js
export function mountBlock(block, ctx);
export function resolveExpr(expr, ctx);
```

### blocks/*.js

```js
export function mount(block, ctx);
// 回傳：{ onDepsChange, destroy }
```

### lib/dom.js

```js
export const qs(sel, root);
export const qsa(sel, root);
export const esc(v, fallback);
export const when(cond, fn);
export const unless(cond, fn);
export const el(tag, attrs, children);
```

### lib/async.js

```js
export async function withToast(successMsg, fn, opts);
export async function withConfirm(message, fn, opts);
export async function withAsyncState(container, fn, opts);
export async function safe(fn, fallback);
```

### lib/lifecycle.js

```js
export function createCleanupRegistry();
// 回傳：{ add, addAll, run }
```

### lib/registry.js

```js
export function initAllRegistries();
export function destroyAllRegistries();
```

## 二、後端 API 契約

### summary.js

```
GET /api/summary?familyId={uid}&year={yyyy}&month={mm}
GET /api/annual-summary?familyId={uid}&startYear=&endYear=
GET /api/settlements-year?familyId={uid}&year=
```

### insurance.js

```
POST /api/insurance-sync
body: { action: 'upsert' | 'delete', familyId, policyId, ... }
```

### admin.js

```
GET  /api/admin-families?action=list
POST /api/admin-families
POST /api/admin-init-family
```

### platform.js

```
GET  /api/platform-settings
POST /api/platform-settings
GET  /api/platform-defaults?action=list&resource={key}
POST /api/platform-defaults
```

### family.js

```
GET  /api/family-settings?familyId={uid}
POST /api/family-settings
POST /api/lookup-family
GET  /api/family-accounts?familyId={uid}&action=list
POST /api/family-accounts
```

### bank.js

```
GET  /api/bank-accounts?familyId={uid}&action=list
POST /api/bank-accounts
GET  /api/bank-transactions?familyId={uid}&bankId={id}&action=list
POST /api/bank-transactions
POST /api/clear-bank-balances
```

### personal.js

```
GET  /api/personal-income?familyId={uid}&memberId={id}&action=list
POST /api/personal-income
GET  /api/member-advances?familyId={uid}&memberId={id}&action=list
POST /api/member-advances
```

## 三、相容層保留

所有舊 URL 路徑保持不變，前端呼叫方式不變。
實作改為 `functions/api/{resource}.js` 內部 `?action=` 分派。
