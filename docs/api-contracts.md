# API 契約 — v103.0.18

最後更新：B19

## 一、前端模組 API

### status-registry.js

```js
export const STATUS = { PENDING: 'pending', DONE: 'done', SKIPPED: 'skipped' };
export const IS_DONE = {...};
export const LABELS = { default: {...}, bySource: {...} };
export const LEGACY_MAP = {...};

export function normalize(raw);
export function isDone(raw);
export function label(raw, { source });
export function options({ source });
export function badgeClass(raw);
export function toLegacyName(code, source);
export function isPending(raw);
export function isSkipped(raw);
```

### entity-registry.js

```js
export function init();
export function destroy();
export function resolveName(type, id, fallback);
export function getList(type);
export function getNameMap(type);
export function isInitialized();
export function resolveNames(type, ids);
export function resolveEntityName(entityKey, id, fallback);
```

### label-registry.js

```js
export const LABELS = {...};
export function L(path, params);
export function has(path);
export function getGroup(groupName);
```

### column-registry.js

```js
export const COLUMNS = {...};
export const RESOLVERS = {...};
export function getColumns(key);
export function getResolvers(key);
export function getColumnsWith(key, extraColumns);
```

### entity-resolvers.js（B18 新增）

```js
export const RESOLVERS = {
  member, bank, policy, fund, category, item, payment, status
};
export function getEntityResolvers(entityKey);
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
export const PLATFORM_RESOURCES;
export function buildLinkedKey(policyId);
export function getPolicyEffectiveMemberId(policy);
export function buildColumnSettingsKey(tableId);
export function getStatusBadgeClass(isDone, isSkipped);
```

### page-engine.js

```js
export async function createPage(schema);
// 回傳：{ ctx, destroy, ready }

// ctx 結構：
// {
//   meta, state, data, derived,
//   invalidate(key),
//   setState(keyPath, value),
//   onDataChange(fn),   // B18.1 新增
// }

// schema 支援：
// {
//   title, data, state, derived, blocks,
//   onYearMonthChange(ctx),  // B17 新增
//   customMount(ctx),
// }
```

### data-engine.js

```js
export function subscribe(cfg, callback);
export function fetchOnce(cfg);
export function makeReactive(obj, onChange);
export function resolvePath(rawPath, params);
export function getNestedValue(obj, path);
export function setNestedValue(obj, path, value);

// cfg 支援：
// { path, type: 'list'|'object'|'value'|'raw', transform, params }
// path 支援 {key} 與 {__all__}
```

### render-engine.js

```js
export function resolveExpr(expr, ctx);
export function resolveDeep(obj, ctx);
export function mountBlock(block, ctx);
export function collectBlockDeps(block);
```

### blocks/*.js

```js
export function mount(block, ctx);
// 回傳：{ onDepsChange, destroy }
```

### lib/expense-modal.js（B19 新增）

```js
export async function openExpenseModal({ row, onSuccess });
// row 省略 = 新增；有值 = 編輯
```

### lib/income-modal.js（B19 新增）

```js
export async function openContributionModal({ onSuccess });
export async function openPersonalIncomeModal({ onSuccess });
```

### lib/filter-sort.js（B19 新增）

```js
export function applyFilters(list, filters, opts);
export function applySort(list, mode, modes);
```

### lib/dom.js

```js
export const qs, qsa, esc, when, unless, el;
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
// 回傳：{ add, addAll, remove, size, run, isDestroyed }
```

### lib/format.js

```js
export function formatHKD(amount);
export function formatNumber(amount);
export function roundHKD(value);
export function clampAmount(value);
export function formatPercent(value, digits);
export function formatCellValue(val, type);
export function formatTransactionType(type);
export function formatTransactionCategory(category);
export function getCategoryBadgeClass(category);
```

### lib/registry.js

```js
export function initAllRegistries();
export function destroyAllRegistries();
export function isAllRegistriesReady();
```

### lib/merge.js

```js
export function mergeSettlementData({ memberExpenses, insuranceRows, year, month });
export function resetInsuranceStatusCache();
```

### lib/insurance.js

```js
export function getPolicyHolderId(policy);
export function getPeriodRange(policy, periodIndex);
export function getPeriodInfo(policy, year, month);
export function getPolicyAnnualPremium(policy, targetYear);
export function resolveMonthlyAmount(policy, year, month, paymentData);
export function getPolicyTotalPremium(policy);
export function getPolicyPaidTotal(payments);
export function countCompletedPeriods(payments);
export function isPolicyCompleted(policy);
export function calcProgress(policy);
export function computeEnrichedPolicies(policies, paymentsCache, targetYear);
export function countCompletedPolicies(enriched);
export function calcYearTotalPremium(enriched, year);
export function calcMonthlyTotalAverage(enriched, year, month);
```

### lib/bank.js

```js
export function calcBankBalance(bankAccount, transactions, targetYear, targetMonth);
export function calcTotalBankBalance(bankAccounts, allTransactions, targetYear, targetMonth);
export function getBankTransactions(allTransactions, bankId);
export async function createTransactionForExpense(...);
export async function createTransactionForInsurance(...);
export async function createTransactionForReimbursement(...);
export async function createTransactionForContribution(...);
export async function syncExpenseToBank(...);
export async function cleanupExpenseBankTransaction(bankId, txnId);
export async function createTransactionForInsurancePayment(...);
export async function checkBankSufficiency(bankId, amount, year, month);
export function groupTransactionsByCategory(transactions);
export function filterTransactionsByMonth(transactions, year, month);
```

### core/utils.js（過渡期轉接層）

```js
// 格式化 re-export from lib/format.js
// escapeHtml re-export from lib/dom.js（別名 esc）

export function todayISO();
export function currentYearMonth();
export function dateToStr(date);
export function parseDate(str);
export function truncate(name, maxLen);
export function safeParseInt(value, fallback);
export function safeParseFloat(value, fallback);
export function qs(sel, parent);
export function qsa(sel, parent);
export function setText(target, text);
export function renderEmptyState(container, message, options);
export function sortMembers(members);
export function isExtraIncome(memberId);
export function isSharedMember(memberId);
export function getMemberDisplayName(memberId, members);
export function debounce(fn, wait);
export function throttle(fn, wait);
export function deepClone(obj);
export function uid(prefix);
export function arrayToMap(arr, keyField);
export function makeSortFn(sortKey, order);
```

### core/debug.js

```js
export function initDebug();
export async function forceEnableDebug();
export function forceDisableDebug();
export function isDebugEnabled();
export const enableDebug, disableDebug;
```

### core/state.js

```js
export const AppState = {
  // 使用者
  currentUser, isSuperAdmin,
  setUser, setSuperAdmin,
  // 家庭
  currentFamilyId, currentFamilyName, familyOwnerUid,
  setFamily, getFamilyId, getFamilyName, getFamilyOwnerUid,
  hasFamily, clearFamily,
  // 帳號
  role, canInput, displayName, memberAccount, currentMemberId,
  setRole, getRole,
  setCanInput, getCanInput,
  setDisplayName, getDisplayName,
  setMemberAccount, getMemberAccount,
  getCurrentMemberId, setCurrentMemberId,
  setAccountContext,
  getRoleLabel, getCanInputLabel,
  // 年月
  year, month,
  setYearMonth, getYearMonth, isAnnualMode, getYearMonthLabel,
  // 檢視
  currentView, setCurrentView, getCurrentView,
  // 事件
  on, off, emit,
  // 生命週期
  init, destroy,
};
```

## 二、後端 API 契約

所有 URL 路徑保持不變，實作改為 `functions/api/[[path]].js` Catch-all 分派。

### GET 端點

| 路徑 | 說明 |
|---|---|
| `/api/family-settings?familyId=` | 家庭設定 |
| `/api/family-accounts?familyId=&action=list` | 家庭成員帳號列表 |
| `/api/admin-families?action=list` | 平台家庭列表 |
| `/api/summary?familyId=&year=&month=` | 單月摘要 |
| `/api/annual-summary?familyId=&startYear=&endYear=` | 年度聚合 |
| `/api/settlements-year?familyId=&year=` | 結算年度 |
| `/api/platform-settings` | 平台設定 |
| `/api/platform-defaults?action=list&resource=` | 平台預設資料庫 |
| `/api/bank-accounts?familyId=&action=list` | 銀行帳號列表 |
| `/api/bank-transactions?familyId=&bankId=&action=list` | 銀行交易列表 |
| `/api/bank-transactions?familyId=&action=listAll` | 全部交易 |
| `/api/personal-income?familyId=&memberId=&action=list` | 個人收入列表 |
| `/api/member-advances?familyId=&memberId=&action=list` | 成員代墊列表 |

### POST 端點

| 路徑 | action | 說明 |
|---|---|---|
| `/api/lookup-family` | — | 查詢所屬家庭 |
| `/api/family-settings` | update / put-status / delete-status | 家庭設定 |
| `/api/family-accounts` | create / restore / update / remove | 帳號 CRUD |
| `/api/admin-families` | add / remove | 家庭 CRUD |
| `/api/admin-init-family` | — | 初始化家庭預設資料 |
| `/api/platform-settings` | update | 平台設定 |
| `/api/platform-defaults` | put / delete / set | 平台預設 CRUD |
| `/api/bank-accounts` | create / update / remove | 銀行帳號 CRUD |
| `/api/bank-transactions` | create / update / remove | 銀行交易 CRUD |
| `/api/clear-bank-balances` | — | 清除舊銀行結餘 |
| `/api/personal-income` | save / remove | 個人收入 |
| `/api/member-advances` | create / update / remove | 成員代墊 CRUD |
| `/api/insurance-sync` | upsert / delete | 保險同步 |

### Functions 檔案結構

```
functions/api/
├── [[path]].js       Catch-all 路由器
├── _config.js        Firebase REST 設定
├── _helpers.js       API 共用輔助
├── _admin.js         2 handler
├── _bank.js          3 handler
├── _family.js        3 handler
├── _insurance.js     1 handler
├── _personal.js      2 handler
├── _platform.js      2 handler
└── _summary.js       3 handler
```

## 三、相容層

所有舊 URL 路徑保持不變，前端呼叫方式不變。
實作改為 `functions/api/{resource}.js` 內部 `?action=` 分派。

## 四、錯誤回應格式

```json
{
  "ok": false,
  "error": "ERROR_CODE",
  "message": "錯誤訊息"
}
```

ERROR_CODE 對照：

| Code | HTTP | 說明 |
|---|---|---|
| UNAUTHORIZED | 401 | 未登入 |
| FORBIDDEN | 403 | 無權限 |
| MISSING_FIELDS | 400 | 缺少欄位 |
| INVALID_BODY | 400 | 無效 body |
| BAD_REQUEST | 400 | 請求錯誤 |
| NOT_FOUND | 404 | 找不到 |
| CONFLICT | 409 | 衝突（重複） |
| INTERNAL | 500 | 內部錯誤 |

## 五、成功回應格式

```json
{
  "ok": true,
  "...": "資料"
}
```

/* ═══════════════════════════════════════════
   END OF FILE
   File: docs/api-contracts.md
   Version: v103.0.18
   Batch: B19
   ═══════════════════════════════════════════ */