# 舊資料相容策略

最後更新：B21
用途：舊資料相容處理參考

---

## 一、相容原則

| 原則 | 說明 |
|---|---|
| 不刪除舊資料 | 所有節點保留 |
| 不破壞讀寫 | 舊資料可正常讀取 |
| 寫入新格式 | 新資料一律寫新代碼 |
| 讀取時映射 | 舊名稱 → 新代碼 |
| 使用者零感知 | 操作邏輯完全不變 |

---

## 二、相容清單

| 舊資料 | 相容策略 | 實作位置 |
|---|---|---|
| 狀態：未處理 / 已扣款 | status.normalize(raw) | status-registry.js |
| banks/ 節點 | entity-registry 註冊 | entity-registry.js |
| bank_balances/ | 不讀寫，UI 清除按鈕 | bank-account-manager |
| fixed_expenses/ | summary.js 仍讀取 | functions/api/_summary.js |
| linked_xxx 支出 | merge.js 仍解析 | lib/merge.js |
| 保險無 paymentMode | fallback = 'direct' | entity-definitions.js |
| 帳號無 memberId | 3 層 fallback | functions/api/_personal.js |
| 保單無 advanceHolderId | fallback = '' | entity-definitions.js |
| 保單無 advanceId | fallback = '' | entity-definitions.js |
| 舊版帳號（無 memberAccount） | verifyFamilyAccess 收緊 | functions/api/_helpers.js |

---

## 三、狀態正規化流程

### 讀取

| 步驟 | 動作 |
|---|---|
| 1 | Firebase 資料 |
| 2 | status.normalize(raw) |
| 3 | 標準代碼（pending / done / skipped） |
| 4 | status.label(code, { source }) |
| 5 | 顯示文字 |

### 寫入

| 步驟 | 動作 |
|---|---|
| 1 | 使用者輸入 |
| 2 | status.options({ source }) |
| 3 | 選擇代碼（pending / done） |
| 4 | 寫入 Firebase |

---

## 四、舊狀態名稱映射

| 舊名稱 | 新代碼 |
|---|---|
| 未處理 | pending |
| 未還款 | pending |
| 未付款 | pending |
| 未扣款 | pending |
| 未轉入 | pending |
| 已處理 | done |
| 已還款 | done |
| 已付款 | done |
| 已扣款 | done |
| 已轉入 | done |
| 不適用 | skipped |

---

## 五、舊節點處理

| 節點 | 狀態 | 處理 |
|---|---|---|
| bank_balances/ | 廢除 | 不讀寫；UI 提供清除按鈕 |
| fixed_expenses/ | 廢除 | 保留 summary.js 讀取 |
| banks/ | 部分廢除 | entity-registry 一併註冊 |

---

## 六、實作細節

### 6.1 status.normalize()

| 情況 | 回傳 |
|---|---|
| null / undefined / 空字串 | pending |
| 已是新代碼 | 原樣 |
| 舊名稱在 LEGACY_MAP | 對應新代碼 |
| 未知 | pending |

### 6.2 entity-registry 舊 banks 註冊

| 節點 | 對應 |
|---|---|
| members | members |
| banks | banks（舊資料相容） |
| bank_accounts | bank_accounts |
| categories | expense_categories |
| items | expense_items |
| companies | insurance_companies |
| payments | payment_methods |

### 6.3 merge.js 舊 linked 解析

| 步驟 | 動作 |
|---|---|
| 1 | 過濾 memberExpenses 的 isAutoLinked |
| 2 | 取 policyId 或 _extractPolicyId(e.id) |
| 3 | 存入 linkedMap[policyId] |
| 4 | 與 insuranceRows 合併 |

### 6.4 entity-definitions 保單 toForm

| 欄位 | fallback |
|---|---|
| annualPremium | 從 periods[currentPeriodIndex] 取，否則 row.annualPremium |
| monthlyPremium | row.monthlyPremium 或 0 |
| paymentMode | row.paymentMode 或 'direct' |
| advanceHolderId | row.advanceHolderId 或 '' |

### 6.5 functions/api/_personal.js 3 層 fallback

| 層級 | 邏輯 |
|---|---|
| 1 | memberAccount.memberId 存在 → 使用 |
| 2 | displayName 匹配 members → 使用 |
| 3 | 家庭只有 1 個成員 → 自動使用 |
| 4 | 皆無 → 回傳空字串 |

### 6.6 verifyFamilyAccess 收緊

| 情境 | 處理 |
|---|---|
| Super admin | 直接通過 |
| 舊版帳號（user.localId === familyId） | 允許，但 memberAccount 為 null |
| 新版帳號（memberAccounts 有記錄） | 允許 |
| 找不到 | 拒絕 |

---

## 七、舊資料保留策略

### 不刪除的節點

| 節點 | 說明 |
|---|---|
| bank_balances/ | 保留但 UI 不再寫入 |
| fixed_expenses/ | 保留但 UI 不再寫入 |
| banks/ | 保留，向後相容 |

### UI 提供清除按鈕

| 位置 | 用途 |
|---|---|
| 系統設定 → 銀行帳號 → 危險區域 | 清除 bank_balances/ |

### 未來可選遷移

若需完全遷移，可加一次性端點：

| 項目 | 內容 |
|---|---|
| 端點 | POST /api/admin-migrate |
| body | { familyId, confirm: 'MIGRATE_ALL' } |
| 必要性 | 非必要，讀取時映射已足夠 |

---

## 八、相容層設計原則

| 原則 | 說明 |
|---|---|
| 讀取時映射 | 不在 Firebase 端批次轉換 |
| 寫入一律新格式 | 不寫舊名稱 / 舊節點 |
| 舊資料只讀不寫 | bank_balances / fixed_expenses |
| entity-registry 註冊舊節點 | banks/ 保留 |
| 顯示層統一走 registry | 任何顯示都經 label / resolveName |

---

## 九、測試清單

| # | 情境 | 預期 |
|---|---|---|
| 1 | 舊資料（狀態「未付款」） | 顯示「未付款」 |
| 2 | 舊資料（狀態「已扣款」） | 顯示「已扣款」 |
| 3 | 新資料（狀態 pending） | 顯示「未付款」 |
| 4 | 新資料（狀態 done） | 顯示「已付款」 |
| 5 | 舊 banks/ 節點 | 正常顯示 |
| 6 | bank_balances/ 存在 | UI 顯示清除按鈕 |
| 7 | fixed_expenses/ 存在 | summary 仍讀取 |
| 8 | 保險無 paymentMode | 當作 direct 處理 |
| 9 | 帳號無 memberId | fallback 生效 |

---

## 十、相容層版本歷史

| 版本 | 變更 |
|---|---|
| v103.0.0 | 建立相容層，status-registry 集中 |
| v103.0.11 | db.js 移除 updateFixedExpenseCompat |
| v103.0.18 | B19 無補丁重構（不影響相容層） |

---

## 十一、參考

| 主題 | 檔案 |
|---|---|
| 資料結構 | data-structure.md |
| API 契約 | api-contracts.md |
| 主錨點 | anchor.md |

---

/* ═══════════════════════════════════════════
   END OF FILE
   File: docs/compatibility.md
   Version: v103.0.19
   Batch: B21
   ═══════════════════════════════════════════ */