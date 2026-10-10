# Firebase RTDB 資料結構 — v103.0.18

最後更新：B19

## 一、platform 節點

```
platform/
├── families/{familyId}/
│   ├── name / ownerEmail / createdAt
│   └── memberAccounts/{uid}/
│       ├── email / account / displayName
│       ├── role: 'owner' | 'member'
│       ├── canInput: true | false
│       ├── memberId: string
│       └── createdAt
│
├── uid_index/{uid} = familyId
├── email_index/{account} = { uid, familyId }
└── defaults/
    ├── members / banks / insurance_companies
    ├── payment_methods / expense_categories / expense_items
    ├── statuses / options / year_range / ui_constants
```

## 二、families 節點

```
families/{familyId}/

【基礎資料】
├── members/{memberId}/              → { name, role, order, createdAt }
├── banks/{bankId}/                  → { name, order, createdAt }（舊）
├── expense_categories/{id}/         → { name, order, createdAt }
├── expense_items/{id}/              → { name, categoryId, createdAt }
├── payment_methods/{id}/            → { name, order, createdAt }
├── insurance_companies/{id}/        → { name, createdAt }
└── statuses/{id}/                   → { name, category, isDone, order, createdAt }

【銀行系統】
└── bank_accounts/{bankId}/
    ├── name / type / order
    ├── initialBalance / initialYear / initialMonth
    ├── createdAt
    └── transactions/{txnId}/
        ├── type: 'in' | 'out' | 'transfer'
        ├── category: 'contribution' | 'expense' | 'insurance' | 'reimbursement' | 'manual'
        ├── amount / date
        ├── memberId / refId / note
        └── createdAt

【個人財務】
├── personal_income/{memberId}/{year}/{month}/ = 數字
└── member_advances/{memberId}/{advanceId}/
    ├── policyId / totalAmount / remainingAmount
    ├── startYear / startMonth
    ├── paidMonths: { 'YYYY-MM': true }
    └── note / createdAt

【家庭財務】
├── income/{year}/{month}/{memberId}/ = 數字
│   （額外收入：memberId = 'extra'）
│
├── expenses/{year}/{month}/member_expenses/{memberId}/{expenseId}/
│   → { name, amount, status, date
│       categoryId, itemId, paymentMethodId
│       bankId, txnId
│       isAutoLinked, policyId, repaidDate
│       createdAt }
│   （家庭共用：memberId = 'shared'）
│   （保險連動：expenseId = 'linked_{policyId}'）
│
├── insurance_policies/{policyId}/
│   → { type, memberId, policyHolderId, name, company, paymentType
│       paymentMode, advanceHolderId, advanceId
│       firstStartYear, firstStartMonth, totalPolicyYears
│       totalPolicyPeriods, totalPremium, currentPeriodIndex
│       monthlyPremium, annualPremium, account, periods
│       isCompleted, createdAt }
│
├── insurance_payments/{policyId}/{year}/{month}/
│   → { status, amount, date
│       bankId, txnId, paymentMode }
│
├── funds/{fundId}/                  → { name, cost, currentValue, units, note, createdAt }
│
├── settings/
│   ├── options → { memberRoles, policyTypes, ... }
│   ├── year_range → { startYear, futureYears }
│   └── ui_constants → { nameMaxLenDesktop, ... }
│
└── bank_balances/{year}/{month}/    → 🗑 廢除（不讀寫）

【舊資料（保留但不讀寫）】
└── fixed_expenses/{year}/{month}/   → 🗑 廢除
```

## 三、狀態代碼映射

### 新代碼

| 代碼 | isDone |
|---|---|
| `'pending'` | false |
| `'done'` | true |
| `'skipped'` | true |

### 舊名稱 → 新代碼

| 舊名稱 | 新代碼 |
|---|---|
| 未處理 / 未還款 / 未付款 / 未扣款 / 未轉入 | pending |
| 已處理 / 已還款 / 已付款 / 已扣款 / 已轉入 | done |
| 不適用 | skipped |

### 讀寫策略

- 讀取時：`status.normalize(raw)` 自動轉換
- 寫入時：直接寫新代碼

## 四、顯示文字（依來源）

| 代碼 | 支出 | 保險 | 收入 |
|---|---|---|---|
| pending | 未付款 | 未扣款 | 未轉入 |
| done | 已付款 | 已扣款 | 已轉入 |

由 `status.label(raw, { source })` 決定。

## 五、欄位細節

### insurance_policies.periods

```
periods: {
  "1": { periodIndex: 1, startYear, startMonth, annualPremium, monthlyAverage },
  "2": { ... },
  ...
}
```

由 `entity-definitions.js` 的 `fromForm()` 產生，依 `currentPeriodIndex` 建立對應年度的期間。

### member_advances.paidMonths

```
paidMonths: {
  "2026-01": true,
  "2026-02": true,
  ...
}
```

每次保險扣款，由 `functions/api/_insurance.js` 寫入；取消扣款時刪除。

### expenses.member_expenses 保留鍵

| memberId | 說明 |
|---|---|
| `'shared'` | 家庭共用支出 |
| 實際 memberId | 個人支出 |

### expenseId 特殊前綴

| 前綴 | 說明 |
|---|---|
| `'linked_'` | 保險連動，後接 policyId |

## 六、跨節點關聯

| 欄位 | 關聯 |
|---|---|
| `expenses.*.bankId` | → `bank_accounts/{bankId}` |
| `expenses.*.txnId` | → `bank_accounts/{bankId}/transactions/{txnId}` |
| `expenses.*.categoryId` | → `expense_categories/{id}` |
| `expenses.*.itemId` | → `expense_items/{id}` |
| `expenses.*.paymentMethodId` | → `payment_methods/{id}` |
| `expenses.*.policyId` | → `insurance_policies/{policyId}` |
| `insurance_payments.*.bankId` | → `bank_accounts/{bankId}` |
| `insurance_payments.*.txnId` | → `bank_accounts/{bankId}/transactions/{txnId}` |
| `insurance_policies.advanceId` | → `member_advances/{advanceHolderId}/{advanceId}` |
| `member_advances.policyId` | → `insurance_policies/{policyId}` |
| `platform.uid_index.{uid}` | → `familyId` |
| `platform.email_index.{account}` | → `{ uid, familyId }` |

## 七、函式 API 對應

| 操作 | 前端 (lib/db.js) | 後端 (functions/api) |
|---|---|---|
| 讀 members | `listenMembers` | `_family.js` |
| 寫 members | `addMember` / `updateMember` | `_family.js` |
| 讀 expenses | `listenAllExpenses` | `_summary.js` |
| 寫 expenses | `addExpense` / `updateExpense` | — |
| 讀 insurance_policies | `listenInsurancePolicies` | — |
| 寫 insurance_policies | `addInsurancePolicy` | — |
| 讀 insurance_payments | `getInsurancePaymentsOnce` | `_summary.js` |
| 寫 insurance_payments | `saveInsurancePaymentBatch` | `_insurance.js` |
| 讀 bank_accounts | `listenBankAccounts` | `_bank.js` |
| 寫 bank_accounts | `addBankAccount` | `_bank.js` |
| 讀 bank_transactions | `listenAllBankTransactions` | `_bank.js` |
| 寫 bank_transactions | `addBankTransaction` | `_bank.js` |
| 讀 personal_income | `listenPersonalIncome` | `_personal.js` |
| 寫 personal_income | `savePersonalIncome` | `_personal.js` |
| 讀 member_advances | `listenMemberAdvances` | `_personal.js` |
| 寫 member_advances | `addMemberAdvance` | `_personal.js` |

## 八、相容處理

| 舊節點 | 處理 |
|---|---|
| `banks/` | entity-registry 一併註冊（向後相容） |
| `bank_balances/` | 不讀寫；UI 提供清除按鈕 |
| `fixed_expenses/` | 保留 summary.js 讀取 |
| `expenses.*.linked_*` | merge.js 解析 |
| 保險無 `paymentMode` | fallback `'direct'` |
| 帳號無 `memberId` | 3 層 fallback |
| 保單無 `advanceHolderId` | fallback `''` |
| 保單無 `advanceId` | fallback `''` |
| 舊版帳號（無 memberAccount） | verifyFamilyAccess 收緊 |

## 九、資料大小限制

| 節點 | 限制 |
|---|---|
| `expenses/{year}/{month}/member_expenses/{memberId}/` | 每月每成員 ≤ 100 筆 |
| `bank_accounts/{bankId}/transactions/` | 每帳號 ≤ 1000 筆 |
| `income/{year}/{month}/` | 每月份 ≤ 20 個成員 |
| `member_advances/{memberId}/` | 每成員 ≤ 20 筆 |

## 十、參考

- 相容策略：`compatibility.md`
- API 契約：`api-contracts.md`
- 主錨點：`anchor.md`

/* ═══════════════════════════════════════════
   END OF FILE
   File: docs/data-structure.md
   Version: v103.0.18
   Batch: B19
   ═══════════════════════════════════════════ */