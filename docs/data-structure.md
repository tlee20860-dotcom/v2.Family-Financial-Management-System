# Firebase RTDB 資料結構 — v103.0.0

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
│       monthlyPremium, annualPremium, account, periods }
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
| 未處理 / 未還款 / 未付款 / 未扣款 | pending |
| 已處理 / 已還款 / 已付款 / 已扣款 | done |
| 不適用 | skipped |

### 讀寫策略

- **讀取時**：`status.normalize(raw)` 自動轉換
- **寫入時**：直接寫新代碼

## 四、顯示文字（依來源）

| 代碼 | 支出 | 保險 | 收入 |
|---|---|---|---|
| pending | 未付款 | 未扣款 | 未轉入 |
| done | 已付款 | 已扣款 | 已轉入 |

由 `status.label(raw, { source })` 決定。

## 五、參考

- 相容策略：`compatibility.md`
- API 契約：`api-contracts.md`
