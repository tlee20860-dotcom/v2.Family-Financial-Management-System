# 家庭財務 Web App — 文檔索引

最後更新：B24
當前批次：B23
用途：新對話時，將整個 docs/ 上傳給 AI

---

## 檔案清單（14 份）

| # | 檔案 | 用途 |
|---|---|---|
| 1 | README.md | 本檔案，索引 |
| 2 | anchor.md | 主錨點：規則 + 架構 + 關鍵字索引 |
| 3 | ai-guide.md | AI 操作指南：決策樹 + 錯誤 + 模板 |
| 4 | file-manifest.md | 檔案清單：版本 + 批次 |
| 5 | progress.md | 交付進度 + 批次歷史 |
| 6 | sop.md | 常見任務 SOP |
| 7 | adr.md | 關鍵決策記錄（ADR） |
| 8 | page-map.md | 頁面 → 檔案對照 |
| 9 | delivery-rules.md | 交付規則（詳細版） |
| 10 | refactor-plan.md | 重構計畫 |
| 11 | api-contracts.md | API 契約 |
| 12 | data-structure.md | Firebase 資料結構 |
| 13 | compatibility.md | 舊資料相容策略 |
| 14 | incident-log.md | 事故日誌（P01~P19 + B23） |

---

## AI 讀取順序

**必讀**（每次對話）：

| 順序 | 檔案 | 用途 |
|---|---|---|
| 1 | anchor.md | 規則 + 架構 |
| 2 | ai-guide.md | 決策樹 |
| 3 | file-manifest.md | 檔案清單 |
| 4 | progress.md | 當前批次 |

**依情境讀**：

| 情境 | 讀此檔 |
|---|---|
| 交付 | delivery-rules.md |
| 修 Bug | incident-log.md |
| 新增功能 | sop.md |
| 理解決策 | adr.md |
| 改頁面 | page-map.md |
| 改 API | api-contracts.md |
| 改資料 | data-structure.md + compatibility.md |
| 理解重構 | refactor-plan.md |

---

## 新對話流程

### 情境 A：繼續開發

| 步驟 | 動作 |
|---|---|
| 1 | 上傳 docs/ 全部 14 檔 |
| 2 | 說：「我已上傳 docs/，請讀取全部內容」 |
| 3 | AI 回報：「已讀取，當前批次 B{nn}」 |
| 4 | 說：「我要修改 XXX」或「請修復 XXX」 |

### 情境 B：修復 Bug

| 步驟 | 動作 |
|---|---|
| 1 | 上傳 docs/ 全部 14 檔 |
| 2 | 說：「請讀取 docs/，[問題描述]」 |
| 3 | AI 診斷後提供方案 |
| 4 | 確認後交付 |

### 情境 C：新增功能

| 步驟 | 動作 |
|---|---|
| 1 | 上傳 docs/ 全部 14 檔 |
| 2 | 說：「請讀取 docs/，我要新增 XXX 功能」 |
| 3 | AI 提供方案（含是否新增檔案） |
| 4 | 確認後交付 |

### 若 AI 回應「檔案內容不完整」

表示 docs/ 上傳不完整，請重新上傳缺少的檔案。

---

## 當前狀態

| 項目 | 值 |
|---|---|
| 當前批次 | B23（程式碼） |
| docs 批次 | B24（更新中） |
| SW 版本 | family-fin-v139 |
| 部署 URL | family-financial-management-system.pages.dev |
| 測試狀態 | B23 已部署，待測試 |

---

## 完成度

| 項目 | 狀態 |
|---|---|
| 5 Registry | ✅ |
| 3 Engine | ✅ |
| 5 Block | ✅ |
| 13 Page Schema | ✅ |
| Functions API（10 檔） | ✅ |
| 全站頁面可訪問 | ✅ |
| 所有 API 正常 | ✅ |
| 統計卡顯示 | ✅ |
| 手機 vConsole 除錯 | ✅ |
| Service Worker network-first | ✅ |
| 無補丁重構（B19） | ✅ |
| 統一自動更新（onDataChange） | ✅ |
| 共用 Modal | ✅ |
| 共用 filter-sort | ✅ |
| 基金保險分支（B23） | ✅ |
| 基金快照（B23） | ✅ |

---

## 快速連結

### 專案資訊

| 項目 | 值 |
|---|---|
| GitHub | family-fin-v2 |
| Firebase | family-fin-a6dd1 |
| Cloudflare | family-financial-management-system |

### 核心文檔

| 主題 | 檔案 |
|---|---|
| 架構總覽 | anchor.md |
| AI 指南 | ai-guide.md |
| 部署問題 | incident-log.md |
| 重構計畫 | refactor-plan.md |
| 資料結構 | data-structure.md |
| 關鍵決策 | adr.md |

### 交付規則

| 主題 | 檔案 |
|---|---|
| 檔案交付 | delivery-rules.md + anchor.md 0.13 |
| API 契約 | api-contracts.md |
| 相容策略 | compatibility.md |

---

## 待辦事項

| 項目 | 狀態 |
|---|---|
| 效能優化：SW 改回 stale-while-revalidate | 未做 |
| 補齊 js/shared/ 未使用檔案清理 | 未做 |
| 補 _headers（若 MIME type 有問題） | 未做 |
| B24 docs 更新 | 🔄 進行中 |
| B23 測試 | ⏳ 待回報 |

---

## docs 更新歷史

| 批次 | 更新 |
|---|---|
| B24 | 全盤更新（14 檔） |
| B21 | 全盤重構（9 檔 → 14 檔） |

---

/* ═══════════════════════════════════════════
   END OF FILE
   File: docs/README.md
   Version: v103.0.21
   Batch: B24
   ═══════════════════════════════════════════ */