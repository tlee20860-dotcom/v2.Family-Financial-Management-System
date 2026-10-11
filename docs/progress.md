# 交付進度

最後更新：B24
當前批次：B23
狀態：B23 已部署，待測試

---

## 總覽

| 批次 | 主題 | 檔案數 | 狀態 |
|---|---|---|---|
| B01 ~ B19 | 重構階段 | 見 incident-log | ✅ |
| B20 | 第二輪測試修復 | 10 | ✅ |
| B21 | docs 重構 | 14 | ✅ |
| B22 | 第三輪測試修復 | 9 | ✅ |
| B23 | 基金保險分支 | 8 | ⏳ 待測 |
| B24 | docs 更新 | 6 | 🔄 進行中 |

---

## B20：第二輪測試修復

**主題**：B19 部署後 5 個問題（P18-01~05）

| # | 檔案 | 問題 |
|---|---|---|
| 1 | js/ui/view-toggle.js | 加 cardValue / tableValue |
| 2 | css/layout.css | .sidebar-nav min-height: 0 |
| 3 | settlements.html | 加 toggle 容器 |
| 4 | member-report.html | 加 toggle 容器 |
| 5 | js/pages/settlements.js | 加 toggle |
| 6 | js/pages/member-report.js | 加 toggle + 副標題 |
| 7 | js/pages/input-center.js | 支出 Tab 加 toggle |
| 8 | js/pages/annual-report.js | 用 cardValue / tableValue |
| 9 | js/pages/insurance.js | 已供滿展開 |
| 10 | js/pages/finance-overview.js | 副標題更新 |

---

## B21：docs 重構

**主題**：docs 全盤重構（9 → 14 檔）

| # | 檔案 |
|---|---|
| 1 | README.md |
| 2 | anchor.md |
| 3 | ai-guide.md（新） |
| 4 | file-manifest.md（新） |
| 5 | progress.md |
| 6 | sop.md（新） |
| 7 | adr.md（新） |
| 8 | page-map.md（新） |
| 9 | delivery-rules.md |
| 10 | refactor-plan.md |
| 11 | api-contracts.md |
| 12 | data-structure.md |
| 13 | compatibility.md |
| 14 | incident-log.md |

---

## B22：第三輪測試修復

**主題**：B20 部署後 5 個問題（P19-01~03）

| # | 檔案 | 問題 |
|---|---|---|
| 1 | js/shared/data-card.js | 支援 columns |
| 2 | js/pages/settlements.js | 移除 mobileCardMode |
| 3 | js/pages/member-report.js | 移除 mobileCardMode |
| 4 | js/pages/input-center.js | 移除 mobileCardMode |
| 5 | insurance.html | 加 toggle 容器 |
| 6 | finance-overview.html | 加 toggle 容器 |
| 7 | js/pages/insurance.js | 加 toggle + table |
| 8 | js/pages/finance-overview.js | 加 toggle + card |
| 9 | js/pages/annual-report.js | statsCards 隨 view |

---

## B23：基金保險分支

**主題**：基金分兩類 + 自動累積 + 快照

### A 組（4 檔）

| # | 檔案 | 變更 |
|---|---|---|
| 1 | js/entity/entity-definitions.js | POLICY 加 fundsAllocation；FUND 加 type / initialYear / initialMonth |
| 2 | js/entity/entity-modal.js | 支援 custom 欄位 |
| 3 | js/entity/entity-funds-allocation.js | 🆕 關聯基金編輯元件 |
| 4 | functions/api/_insurance.js | 扣款時累積基金 / 撤銷時回退 |

### B 組（2 檔）

| # | 檔案 | 變更 |
|---|---|---|
| 5 | js/core/db.js | FUND 加欄位；snapshot CRUD |
| 6 | js/config/column-registry.js | 基金欄位 + fundSnapshots |

### C 組（2 檔）

| # | 檔案 | 變更 |
|---|---|---|
| 7 | js/pages/portfolio.js | 完全重寫（分區 + 快照 + 對比） |
| 8 | portfolio.html | 加容器 |

---

## B24：docs 更新（進行中）

| # | 檔案 | 狀態 |
|---|---|---|
| 1 | file-manifest.md | ✅ |
| 2 | progress.md | 🔄 本檔 |
| 3 | anchor.md | 待交付 |
| 4 | incident-log.md | 待交付 |
| 5 | page-map.md | 待交付 |
| 6 | api-contracts.md | 待交付 |
| 7 | data-structure.md | 待交付 |
| 8 | compatibility.md | 待交付 |
| 9 | README.md | 待交付 |
| 10 | adr.md | 待交付 |

---

## 下一步

| 項目 | 狀態 |
|---|---|
| B23 部署 | ✅ 完成 |
| B23 測試 | ⏳ 待回報 |
| B24 docs | 🔄 進行中 |

**待測試完成**：
- 若無誤 → 進入下一階段功能
- 若有誤 → 交付 B25 修復

---

/* ═══════════════════════════════════════════
   END OF FILE
   File: docs/progress.md
   Version: v103.0.21
   Batch: B24
   ═══════════════════════════════════════════ */