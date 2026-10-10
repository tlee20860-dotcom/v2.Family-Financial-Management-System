# 舊資料相容策略 — v103.0.18

最後更新：B19

## 一、相容原則

1. 不刪除舊資料：所有節點保留
2. 不破壞讀寫：舊資料可正常讀取
3. 寫入新格式：新資料一律寫新代碼
4. 讀取時映射：舊名稱 → 新代碼
5. 使用者零感知：操作邏輯完全不變

## 二、相容清單

| 舊資料 | 相容策略 | 實作位置 |
|---|---|---|
| 狀態：'未處理' / '已扣款' | `status.normalize(raw)` | status-registry.js |
| `banks/` 節點 | entity-registry 註冊 | entity-registry.js |
| `bank_balances/` | 不讀寫，UI 清除按鈕 | bank-account-manager |
| `fixed_expenses/` | summary.js 仍讀取 | functions/api/_summary.js |
| `linked_xxx` 支出 | merge.js 仍解析 | lib/merge.js |
| 保險無 `paymentMode` | fallback = `'direct'` | entity-definitions.js |
| 帳號無 `memberId` | 3 層 fallback | functions/api/_personal.js |
| 保單無 `advanceHolderId` | fallback = `''` | entity-definitions.js |
| 保單無 `advanceId` | fallback = `''` | entity-definitions.js |
| 舊版帳號（無 memberAccount） | verifyFamilyAccess 收緊 | functions/api/_helpers.js |

## 三、狀態正規化流程

### 讀取

```
Firebase 資料
  ↓
status.normalize(raw)
  ↓
標準代碼（pending / done / skipped）
  ↓
status.label(code, { source })
  ↓
顯示文字（未付款 / 已扣款 / ...）
```

### 寫入

```
使用者輸入
  ↓
status.options({ source })
  ↓
選擇代碼（pending / done）
  ↓
寫入 Firebase
```

## 四、舊狀態名稱完整映射

| 舊名稱 | 新代碼 | 說明 |
|---|---|---|
| 未處理 | pending | 個人支出 |
| 未還款 | pending | 個人支出（還款語意） |
| 未付款 | pending | 固定支出 / 保險 |
| 未扣款 | pending | 保險 |
| 未轉入 | pending | 收入 |
| 已處理 | done | 個人支出 |
| 已還款 | done | 個人支出 |
| 已付款 | done | 固定支出 / 保險 |
| 已扣款 | done | 保險 |
| 已轉入 | done | 收入 |
| 不適用 | skipped | 通用 |

## 五、舊節點處理

| 節點 | 狀態 | 處理 |
|---|---|---|
| `bank_balances/` | 廢除 | 不讀寫；UI 提供清除按鈕 |
| `fixed_expenses/` | 廢除 | 保留 summary.js 讀取 |
| `banks/` | 部分廢除 | entity-registry 一併註冊 |

## 六、實作細節

### 6.1 status.normalize()

```js
export function normalize(raw) {
  if (raw == null || raw === '') return STATUS.PENDING;
  if (raw === STATUS.PENDING || raw === STATUS.DONE || raw === STATUS.SKIPPED) {
    return raw;
  }
  return LEGACY_MAP[raw] || STATUS.PENDING;
}
```

### 6.2 entity-registry 舊 banks 註冊

```js
const PATHS = {
  members:       'members',
  banks:         'banks',              // 舊資料相容
  bank_accounts: 'bank_accounts',
  categories:    'expense_categories',
  items:         'expense_items',
  companies:     'insurance_companies',
  payments:      'payment_methods',
};
```

### 6.3 merge.js 舊 linked 解析

```js
const linkedMap = {};
memberExpenses
  .filter((e) => e.isAutoLinked)
  .forEach((e) => {
    const policyId = e.policyId || _extractPolicyId(e.id);
    if (!policyId) return;
    linkedMap[policyId] = e;
  });
```

### 6.4 entity-definitions.js 保單 toForm

```js
toForm: (row) => {
  const curPeriod = (row.periods || {})[String(row.currentPeriodIndex || 1)];
  return {
    ...row,
    annualPremium: curPeriod ? curPeriod.annualPremium : (row.annualPremium || 0),
    monthlyPremium: row.monthlyPremium || 0,
    paymentMode: row.paymentMode || 'direct',
    advanceHolderId: row.advanceHolderId || '',
  };
}
```

### 6.5 functions/api/_personal.js 3 層 fallback

```js
async function _resolveOwnMemberId(familyId, uid, token) {
  // 1. memberAccount.memberId
  if (memberAccount?.memberId) return memberAccount.memberId;

  // 2. displayName 匹配 members
  if (memberAccount?.displayName) {
    const matched = Object.entries(members).find(([id, m]) =>
      m.name === memberAccount.displayName
    );
    if (matched) return matched[0];
  }

  // 3. 家庭只有 1 個成員 → 自動使用
  if (Object.keys(members).length === 1) {
    return Object.keys(members)[0];
  }

  return '';
}
```

### 6.6 functions/api/_helpers.js verifyFamilyAccess 收緊

```js
async function verifyFamilyAccess(token, familyId) {
  // 1. Super admin 直接通過
  // 2. 舊版帳號：user.localId === familyId（無 memberAccounts 記錄）
  // 3. 新版帳號：需在 memberAccounts/{uid} 有記錄
  // 4. 找不到 → 拒絕
}
```

## 七、舊資料保留策略

### 不刪除的節點

- `bank_balances/`（保留但 UI 不再寫入）
- `fixed_expenses/`（保留但 UI 不再寫入）
- `banks/`（保留，向後相容）

### UI 提供清除按鈕

- 系統設定 → 銀行帳號 → 危險區域
- 一鍵清除 `bank_balances/`（`functions/api/_bank.js` 的 `handleClearBankBalances`）

### 未來可選遷移

若未來要完全遷移舊資料，可加入一次性遷移端點：

```
POST /api/admin-migrate
body: { familyId, confirm: 'MIGRATE_ALL' }
```

非必要，讀取時映射已足夠。

## 八、相容層設計原則

1. **讀取時映射，不預處理**
   - 不在 Firebase 端批次轉換
   - 讀取時即時 normalize

2. **寫入一律新格式**
   - 不寫舊名稱
   - 不寫舊節點

3. **舊資料節點只讀不寫**
   - `bank_balances` / `fixed_expenses` 不再寫入

4. **entity-registry 一併註冊舊節點**
   - `banks/` 保留供舊頁面使用

5. **顯示層統一走 registry**
   - 任何顯示文字都經過 `label` / `resolveName`

## 九、測試清單

部署後驗證：

| # | 情境 | 預期 |
|---|---|---|
| 1 | 舊資料（狀態「未付款」） | 顯示「未付款」 |
| 2 | 舊資料（狀態「已扣款」） | 顯示「已扣款」 |
| 3 | 新資料（狀態 `pending`） | 顯示「未付款」 |
| 4 | 新資料（狀態 `done`） | 顯示「已付款」 |
| 5 | 舊 `banks/` 節點 | 正常顯示 |
| 6 | `bank_balances/` 存在 | UI 顯示清除按鈕 |
| 7 | `fixed_expenses/` 存在 | summary 仍讀取 |
| 8 | 保險無 `paymentMode` | 當作 `direct` 處理 |
| 9 | 帳號無 `memberId` | fallback 生效 |

## 十、相容層版本歷史

| 版本 | 變更 |
|---|---|
| v103.0.0 | 建立相容層，status-registry 集中 |
| v103.0.11 | db.js 移除 `updateFixedExpenseCompat` |
| v103.0.18 | B19 無補丁重構（不影響相容層） |

## 十一、參考

- 資料結構：`data-structure.md`
- API 契約：`api-contracts.md`
- 主錨點：`anchor.md`

/* ═══════════════════════════════════════════
   END OF FILE
   File: docs/compatibility.md
   Version: v103.0.18
   Batch: B19
   ═══════════════════════════════════════════ */