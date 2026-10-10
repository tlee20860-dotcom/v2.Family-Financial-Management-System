# API 契約

最後更新：B21
用途：前後端介面參考

---

## 一、前端模組 API

### status-registry.js

| API | 說明 |
|---|---|
| normalize(raw) | 任意輸入 → 標準代碼 |
| isDone(raw) | 是否完成 |
| label(raw, opts) | 顯示文字（依 source） |
| options(opts) | 下拉選項陣列 |
| badgeClass(raw) | badge class |
| toLegacyName(code, source) | 新代碼 → 舊名稱 |
| isPending(raw) | 是否 pending |
| isSkipped(raw) | 是否 skipped |

**常數**：

| 常數 | 說明 |
|---|---|
| STATUS | PENDING / DONE / SKIPPED |
| IS_DONE | 判定表 |
| LABELS | default + bySource |
| LEGACY_MAP | 舊名稱 → 新代碼 |

---

### entity-registry.js

| API | 說明 |
|---|---|
| init() | 初始化訂閱 |
| destroy() | 清理 |
| resolveName(type, id, fallback) | ID → 名稱 |
| getList(type) | 列表 |
| getNameMap(type) | { id: name } |
| isInitialized() | 是否已初始化 |
| resolveNames(type, ids) | 批次解析 |
| resolveEntityName(key, id, fallback) | 依 ENTITY_KEYS 解析 |

---

### label-registry.js

| API | 說明 |
|---|---|
| L(path, params) | 依路徑取得文字 |
| has(path) | 是否存在 |
| getGroup(name) | 取得整個分類 |

**LABELS 分類**：common / pages / fields / actions / confirm / toast / emptyState / nav / roles

---

### column-registry.js

| API | 說明 |
|---|---|
| getColumns(key) | 欄位定義（複本） |
| getResolvers(key) | 值轉換函式（複本） |
| getColumnsWith(key, extra) | 追加欄位 |

**COLUMNS key**：members / banks / bankAccounts / categories / items / payments / statuses / companies / funds / insurance / settlements / bankTransactions / dashboardAnnual / annualSummary / annualMonthly / memberReport

---

### entity-resolvers.js（B18 新增）

| API | 說明 |
|---|---|
| getEntityResolvers(entityKey) | 取得該 entity 的 resolvers |

**RESOLVERS key**：member / bank / policy / fund / category / item / payment / status

---

### constants.js

| 類別 | 常數 |
|---|---|
| 版本 | APP_VERSION / SW_VERSION |
| Storage | STORAGE_KEYS / STORAGE_PREFIXES / SESSION_KEYS |
| TTL | AUTH_CONTEXT_TTL_MS / APP_CONFIG_TTL_MS / BANK_CACHE_TTL_MS |
| 限制 | LIMITS |
| ID | RESERVED_IDS |
| 角色 | ROLES / SOURCES |
| 前綴 | LINKED_PREFIX |
| 銀行 | BANK_TXN_TYPES / BANK_TXN_CATEGORIES / BANK_ACCOUNT_TYPES |
| 支付 | PAYMENT_MODES |
| 實體 | ENTITY_KEYS |
| 狀態 | STATUS_BADGE_CLASS / STATUS_CATEGORIES |
| 導覽 | SIDEBAR_GROUPS / ROUTES / SHOW_YEAR_MONTH_PAGES |
| 預設 | DEFAULT_STATUSES / DEFAULT_OPTIONS / DEFAULT_YEAR_RANGE / DEFAULT_UI_CONSTANTS |
| 平台 | PLATFORM_RESOURCES / SUPERADMIN_DOMAIN / SUPERADMIN_EMAIL |

| 函式 | 說明 |
|---|---|
| buildLinkedKey(policyId) | linked_ 前綴 |
| isLinkedKey(key) | 判定 |
| getPolicyEffectiveMemberId(policy) | 保單持有人 fallback |
| buildColumnSettingsKey(tableId) | 欄位設定 key |
| getStatusBadgeClass(isDone, isSkipped) | badge class |

---

### page-engine.js

| API | 說明 |
|---|---|
| createPage(schema) | 建立頁面 → { ctx, destroy, ready } |

**ctx 提供**：

| 方法 | 說明 |
|---|---|
| ctx.onDataChange(fn) | 訂閱資料變更 |
| ctx.setState(keyPath, val) | 設 state |
| ctx.invalidate(key) | 觸發重算 |

**schema 支援**：

| 欄位 | 說明 |
|---|---|
| title | 標題 |
| data | Firebase 訂閱 |
| state | 響應式狀態 |
| derived | 衍生資料 |
| blocks | UI 區塊 |
| onYearMonthChange(ctx) | 年月變更 hook |
| customMount(ctx) | 逃生艙 |

---

### data-engine.js

| API | 說明 |
|---|---|
| subscribe(cfg, cb) | 訂閱 |
| fetchOnce(cfg) | 一次性讀取 |
| makeReactive(obj, cb) | 響應式代理 |
| resolvePath(raw, params) | 路徑解析 |
| getNestedValue(obj, path) | 深層取值 |
| setNestedValue(obj, path, val) | 深層設值 |

**cfg 支援**：

| 欄位 | 說明 |
|---|---|
| type | list / object / value / raw |
| path | 相對路徑（含 {key} / {__all__}） |
| transform | 資料轉換 |
| params | 佔位符對應 |

---

### render-engine.js

| API | 說明 |
|---|---|
| resolveExpr(expr, ctx) | 解析單一表達式 |
| resolveDeep(obj, ctx) | 遞迴解析 |
| mountBlock(block, ctx) | 掛載 block |
| collectBlockDeps(block) | 掃描依賴 |

---

### blocks/*.js

| API | 說明 |
|---|---|
| mount(block, ctx) | 回傳 { onDepsChange, destroy } |

---

### lib/expense-modal.js（B19）

| API | 說明 |
|---|---|
| openExpenseModal({ row, onSuccess }) | row 省略 = 新增；有值 = 編輯 |

---

### lib/income-modal.js（B19）

| API | 說明 |
|---|---|
| openContributionModal({ onSuccess }) | 家用轉入 |
| openPersonalIncomeModal({ onSuccess }) | 個人收入 |

---

### lib/filter-sort.js（B19）

| API | 說明 |
|---|---|
| applyFilters(list, filters, opts) | 篩選 |
| applySort(list, mode, modes) | 排序 |

---

### lib/dom.js

| API | 說明 |
|---|---|
| qs(sel, root) | querySelector |
| qsa(sel, root) | querySelectorAll |
| esc(v, fallback) | HTML 逸出（SSOT） |
| when(cond, fn) | 條件執行 |
| unless(cond, fn) | 反向條件 |
| el(tag, attrs, children) | 建立元素 |

---

### lib/async.js

| API | 說明 |
|---|---|
| withToast(msg, fn, opts) | Toast 包裝 |
| withConfirm(msg, fn, opts) | Confirm 包裝 |
| withAsyncState(container, fn, opts) | 載入狀態 |
| safe(fn, fallback) | 例外安全 |

---

### lib/lifecycle.js

| API | 說明 |
|---|---|
| createCleanupRegistry() | 回傳 { add, addAll, remove, size, run, isDestroyed } |

---

### lib/format.js

| API | 說明 |
|---|---|
| formatHKD(amount) | HK$ 格式 |
| formatNumber(amount) | 千分位 |
| roundHKD(value) | 四捨五入 |
| clampAmount(value) | 限制範圍 |
| formatPercent(value, digits) | 百分比 |
| formatCellValue(val, type) | 通用格式化 |
| formatTransactionType(type) | 交易類型 |
| formatTransactionCategory(cat) | 交易分類 |
| getCategoryBadgeClass(cat) | badge class |

---

### lib/registry.js

| API | 說明 |
|---|---|
| initAllRegistries() | 初始化全部 |
| destroyAllRegistries() | 銷毀全部 |
| isAllRegistriesReady() | 查詢狀態 |

---

### lib/merge.js

| API | 說明 |
|---|---|
| mergeSettlementData({ memberExpenses, insuranceRows, year, month }) | 結算合併 |
| resetInsuranceStatusCache() | 重置快取 |

---

### lib/insurance.js

| API | 說明 |
|---|---|
| getPolicyHolderId(policy) | 保單持有人（fallback） |
| getPeriodRange(policy, idx) | 期間範圍 |
| getPeriodInfo(policy, y, m) | 期間資訊 |
| getPolicyAnnualPremium(policy, y) | 年繳 |
| resolveMonthlyAmount(policy, y, m, pd) | 月攤 |
| getPolicyTotalPremium(policy) | 總供款 |
| getPolicyPaidTotal(payments) | 已供款 |
| countCompletedPeriods(payments) | 完成期數 |
| isPolicyCompleted(policy) | 是否供滿 |
| calcProgress(policy) | 進度 |
| computeEnrichedPolicies(policies, cache, y) | 批次計算 |
| countCompletedPolicies(enriched) | 統計 |
| calcYearTotalPremium(enriched, y) | 年度總額 |
| calcMonthlyTotalAverage(enriched, y, m) | 月平均 |

---

### lib/bank.js

| API | 說明 |
|---|---|
| calcBankBalance(acc, txns, y, m) | 單一銀行餘額 |
| calcTotalBankBalance(accs, txns, y, m) | 總餘額 |
| getBankTransactions(txns, bankId) | 交易篩選 |
| createTransactionForExpense(...) | 支出交易 |
| createTransactionForInsurance(...) | 保險交易 |
| createTransactionForReimbursement(...) | 代墊交易 |
| createTransactionForContribution(...) | 家用轉入 |
| syncExpenseToBank(...) | 支出同步 |
| cleanupExpenseBankTransaction(bankId, txnId) | 清理 |
| createTransactionForInsurancePayment(...) | 保險付款 |
| checkBankSufficiency(bankId, amt, y, m) | 餘額檢查 |
| groupTransactionsByCategory(txns) | 分類統計 |
| filterTransactionsByMonth(txns, y, m) | 月份篩選 |

---

### core/utils.js（過渡期轉接層）

| 類別 | 說明 |
|---|---|
| re-export | format* 從 lib/format.js |
| re-export | escapeHtml 從 lib/dom.js |
| 日期 | todayISO / currentYearMonth / dateToStr / parseDate |
| 字串 | truncate / safeParseInt / safeParseFloat |
| DOM | qs / qsa / setText / renderEmptyState |
| 成員 | sortMembers / isExtraIncome / isSharedMember / getMemberDisplayName |
| 效能 | debounce / throttle |
| 雜項 | deepClone / uid / arrayToMap / makeSortFn |

---

### core/debug.js

| API | 說明 |
|---|---|
| initDebug() | 初始化（由 app-shell 呼叫） |
| forceEnableDebug() | 手動開啟 |
| forceDisableDebug() | 手動關閉 |
| isDebugEnabled() | 查詢狀態 |

---

### core/state.js（AppState）

| 分類 | 方法 |
|---|---|
| 使用者 | currentUser / isSuperAdmin / setUser / setSuperAdmin |
| 家庭 | setFamily / getFamilyId / getFamilyName / hasFamily / clearFamily |
| 帳號 | setRole / setCanInput / setDisplayName / setMemberAccount |
| 便利 | getRoleLabel / getCanInputLabel |
| 年月 | setYearMonth / getYearMonth / getYearMonthLabel |
| 檢視 | setCurrentView / getCurrentView |
| 事件 | on / off / emit |
| 生命週期 | init / destroy |

---

## 二、後端 API 契約

所有 URL 路徑保持不變；實作改為 `functions/api/[[path]].js` Catch-all 分派。

### GET 端點

| 路徑 | 說明 |
|---|---|
| /api/family-settings | 家庭設定 |
| /api/family-accounts | 家庭成員帳號 |
| /api/admin-families | 平台家庭列表 |
| /api/summary | 單月摘要 |
| /api/annual-summary | 年度聚合 |
| /api/settlements-year | 結算年度 |
| /api/platform-settings | 平台設定 |
| /api/platform-defaults | 平台預設資料庫 |
| /api/bank-accounts | 銀行帳號列表 |
| /api/bank-transactions | 銀行交易列表 |
| /api/personal-income | 個人收入列表 |
| /api/member-advances | 成員代墊列表 |

### POST 端點

| 路徑 | action | 說明 |
|---|---|---|
| /api/lookup-family | — | 查詢所屬家庭 |
| /api/family-settings | update / put-status / delete-status | 家庭設定 |
| /api/family-accounts | create / restore / update / remove | 帳號 CRUD |
| /api/admin-families | add / remove | 家庭 CRUD |
| /api/admin-init-family | — | 初始化家庭 |
| /api/platform-settings | update | 平台設定 |
| /api/platform-defaults | put / delete / set | 平台預設 CRUD |
| /api/bank-accounts | create / update / remove | 銀行帳號 CRUD |
| /api/bank-transactions | create / update / remove | 銀行交易 CRUD |
| /api/clear-bank-balances | — | 清除舊結餘 |
| /api/personal-income | save / remove | 個人收入 |
| /api/member-advances | create / update / remove | 成員代墊 |
| /api/insurance-sync | upsert / delete | 保險同步 |

### Functions 檔案結構

| 檔案 | Handler 數 |
|---|---|
| [[path]].js | Catch-all 路由器 |
| _config.js | Firebase REST 設定 |
| _helpers.js | API 共用輔助 |
| _admin.js | 2 |
| _bank.js | 3 |
| _family.js | 3 |
| _insurance.js | 1 |
| _personal.js | 2 |
| _platform.js | 2 |
| _summary.js | 3 |

---

## 三、錯誤回應格式

| 欄位 | 說明 |
|---|---|
| ok | false |
| error | ERROR_CODE |
| message | 錯誤訊息 |

### ERROR_CODE 對照

| Code | HTTP | 說明 |
|---|---|---|
| UNAUTHORIZED | 401 | 未登入 |
| FORBIDDEN | 403 | 無權限 |
| MISSING_FIELDS | 400 | 缺少欄位 |
| INVALID_BODY | 400 | 無效 body |
| BAD_REQUEST | 400 | 請求錯誤 |
| NOT_FOUND | 404 | 找不到 |
| CONFLICT | 409 | 衝突 |
| INTERNAL | 500 | 內部錯誤 |

---

## 四、成功回應格式

| 欄位 | 說明 |
|---|---|
| ok | true |
| ... | 資料欄位 |

---

## 五、相容層

所有舊 URL 路徑保持不變，前端呼叫方式不變。

實作改為 `functions/api/{resource}.js` 內部 `?action=` 分派。

---

/* ═══════════════════════════════════════════
   END OF FILE
   File: docs/api-contracts.md
   Version: v103.0.19
   Batch: B21
   ═══════════════════════════════════════════ */