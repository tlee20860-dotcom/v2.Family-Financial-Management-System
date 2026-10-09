# 舊資料相容策略 — v103.0.0

## 一、相容原則

1. **不刪除舊資料**：所有節點保留
2. **不破壞讀寫**：舊資料可正常讀取
3. **寫入新格式**：新資料一律寫新代碼
4. **讀取時映射**：舊名稱 → 新代碼
5. **使用者零感知**：操作邏輯完全不變

## 二、相容清單

| 舊資料 | 相容策略 | 實作位置 |
|---|---|---|
| 狀態：'未處理' / '已扣款' | `status.normalize(raw)` | status-registry.js |
| `banks/` 節點 | entity-registry 註冊 | entity-registry.js |
| `bank_balances/` | 不讀寫，UI 清除按鈕 | bank-account-manager |
| `fixed_expenses/` | summary.js 仍讀取 | functions/api/summary.js |
| `linked_xxx` 支出 | merge.js 仍解析 | lib/merge.js |
| 保險無 `paymentMode` | fallback = `'direct'` | entity-definitions.js |
| 帳號無 `memberId` | 3 層 fallback | personal-income.js |
| 保單無 `advanceHolderId` | fallback = `''` | entity-definitions.js |
| 保單無 `advanceId` | fallback = `''` | entity-definitions.js |
| 舊版帳號（無 memberAccount） | verifyFamilyAccess 收緊 | _helpers.js |

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
| 已處理 | done | 個人支出 |
| 已還款 | done | 個人支出 |
| 已付款 | done | 固定支出 / 保險 |
| 已扣款 | done | 保險 |
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
  if (!raw) return STATUS.PENDING;
  return LEGACY_MAP[raw] || STATUS.PENDING;
}
```

### 6.2 entity-registry 舊 banks 註冊

```js
const PATHS = {
  members: 'members',
  banks: 'banks',              // 舊資料相容
  bank_accounts: 'bank_accounts',
  categories: 'expense_categories',
  items: 'expense_items',
  companies: 'insurance_companies',
  payments: 'payment_methods',
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

### 6.5 personal-income.js 3 層 fallback

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

## 七、可選遷移

若未來要完全遷移舊資料，可加入一次性遷移端點：

```
POST /api/admin-migrate
body: { familyId, confirm: 'MIGRATE_ALL' }
```

非必要，讀取時映射已足夠。
