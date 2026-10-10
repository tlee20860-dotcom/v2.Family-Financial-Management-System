# Firebase RTDB 資料結構

最後更新：B21
用途：資料節點參考

---

## 一、platform 節點

### families/{familyId}/

| 欄位 | 內容 |
|---|---|
| name | 家庭名稱 |
| ownerEmail | 擁有者 Email |
| createdAt | 建立時間戳 |

### families/{familyId}/memberAccounts/{uid}/

| 欄位 | 內容 |
|---|---|
| email | 完整 Email |
| account | 帳號（不含網域） |
| displayName | 顯示名稱 |
| role | owner / member |
| canInput | true / false |
| memberId | 對應成員 ID |
| createdAt | 建立時間 |

### platform 索引

| 路徑 | 內容 |
|---|---|
| uid_index/{uid} | familyId |
| email_index/{account} | { uid, familyId } |

### platform/defaults/

| 節點 | 內容 |
|---|---|
| members | 預設成員 |
| banks | 預設銀行 |
| insurance_companies | 預設保險公司 |
| payment_methods | 預設支付方式 |
| expense_categories | 預設類別 |
| expense_items | 預設項目 |
| statuses | 預設狀態 |
| options | 下拉選項 |
| year_range | 年份範圍 |
| ui_constants | UI 常數 |

---

## 二、families 節點

### 基礎資料

| 節點 | 欄位 |
|---|---|
| members/{id} | name / role / order / createdAt |
| banks/{id} | name / order / createdAt（舊） |
| expense_categories/{id} | name / order / createdAt |
| expense_items/{id} | name / categoryId / createdAt |
| payment_methods/{id} | name / order / createdAt |
| insurance_companies/{id} | name / createdAt |
| statuses/{id} | name / category / isDone / order / createdAt |

### 銀行系統

| 路徑 | 欄位 |
|---|---|
| bank_accounts/{bankId} | name / type / order / initialBalance / initialYear / initialMonth / createdAt |
| bank_accounts/{bankId}/transactions/{txnId} | type / category / amount / date / memberId / refId / note / createdAt |

**交易 type**：in / out / transfer

**交易 category**：contribution / expense / insurance / reimbursement / manual

### 個人財務

| 路徑 | 內容 |
|---|---|
| personal_income/{memberId}/{year}/{month} | 數字 |
| member_advances/{memberId}/{advanceId} | policyId / totalAmount / remainingAmount / startYear / startMonth / paidMonths / note / createdAt |

**paidMonths 格式**：`{ 'YYYY-MM': true }`

### 收入

| 路徑 | 內容 |
|---|---|
| income/{year}/{month}/{memberId} | 數字 |

**額外收入 memberId**：`extra`

### 支出

| 路徑 | 欄位 |
|---|---|
| expenses/{year}/{month}/member_expenses/{memberId}/{expenseId} | name / amount / status / date / categoryId / itemId / paymentMethodId / bankId / txnId / isAutoLinked / policyId / repaidDate / createdAt |

**特殊 memberId**：`shared`（家庭共用）

**特殊 expenseId**：`linked_{policyId}`（保險連動）

### 保險

| 路徑 | 欄位 |
|---|---|
| insurance_policies/{policyId} | type / memberId / policyHolderId / name / company / paymentType / paymentMode / advanceHolderId / advanceId / firstStartYear / firstStartMonth / totalPolicyYears / totalPolicyPeriods / totalPremium / currentPeriodIndex / monthlyPremium / annualPremium / account / periods / isCompleted / createdAt |
| insurance_payments/{policyId}/{year}/{month} | status / amount / date / bankId / txnId / paymentMode |

**periods 結構**：`{ '{N}': { periodIndex, startYear, startMonth, annualPremium, monthlyAverage } }`

### 基金

| 路徑 | 欄位 |
|---|---|
| funds/{fundId} | name / cost / currentValue / units / note / createdAt |

### 家庭設定

| 節點 | 內容 |
|---|---|
| settings/options | { memberRoles, policyTypes, ... } |
| settings/year_range | { startYear, futureYears } |
| settings/ui_constants | { nameMaxLenDesktop, ... } |

### 廢除節點（保留不讀寫）

| 節點 | 狀態 |
|---|---|
| bank_balances/{year}/{month}/ | 🗑 廢除 |
| fixed_expenses/{year}/{month}/ | 🗑 廢除 |

---

## 三、狀態代碼

### 新代碼

| 代碼 | isDone |
|---|---|
| pending | false |
| done | true |
| skipped | true |

### 舊名稱 → 新代碼

| 舊名稱 | 新代碼 |
|---|---|
| 未處理 / 未還款 / 未付款 / 未扣款 / 未轉入 | pending |
| 已處理 / 已還款 / 已付款 / 已扣款 / 已轉入 | done |
| 不適用 | skipped |

### 讀寫策略

| 情境 | 做法 |
|---|---|
| 讀取 | status.normalize(raw) 自動轉換 |
| 寫入 | 直接寫新代碼 |

---

## 四、顯示文字（依來源）

| 代碼 | 支出 | 保險 | 收入 |
|---|---|---|---|
| pending | 未付款 | 未扣款 | 未轉入 |
| done | 已付款 | 已扣款 | 已轉入 |

由 status.label(raw, { source }) 決定。

---

## 五、跨節點關聯

| 欄位 | 關聯 |
|---|---|
| expenses.*.bankId | bank_accounts/{bankId} |
| expenses.*.txnId | bank_accounts/{bankId}/transactions/{txnId} |
| expenses.*.categoryId | expense_categories/{id} |
| expenses.*.itemId | expense_items/{id} |
| expenses.*.paymentMethodId | payment_methods/{id} |
| expenses.*.policyId | insurance_policies/{policyId} |
| insurance_payments.*.bankId | bank_accounts/{bankId} |
| insurance_policies.advanceId | member_advances/{advanceHolderId}/{advanceId} |
| member_advances.policyId | insurance_policies/{policyId} |
| platform.uid_index.{uid} | familyId |
| platform.email_index.{account} | { uid, familyId } |

---

## 六、大小限制

| 節點 | 限制 |
|---|---|
| expenses/{y}/{m}/member_expenses/{memberId}/ | ≤ 100 筆 |
| bank_accounts/{bankId}/transactions/ | ≤ 1000 筆 |
| income/{y}/{m}/ | ≤ 20 成員 |
| member_advances/{memberId}/ | ≤ 20 筆 |

---

## 七、參考

| 主題 | 檔案 |
|---|---|
| 相容策略 | compatibility.md |
| API 契約 | api-contracts.md |
| 主錨點 | anchor.md |

---

/* ═══════════════════════════════════════════
   END OF FILE
   File: docs/data-structure.md
   Version: v103.0.19
   Batch: B21
   ═══════════════════════════════════════════ */