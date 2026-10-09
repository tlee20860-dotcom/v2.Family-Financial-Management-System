# 家庭財務 Web App — 重構文檔索引

此資料夾包含 v103.0.0 重構所需的錨點檔案。
新對話時，將整個 `docs/` 資料夾上傳給 AI。

## 檔案清單

| 檔案 | 用途 |
|---|---|
| `README.md` | 本檔案，索引 |
| `anchor.md` | 主錨點，AI 首先讀取 |
| `refactor-plan.md` | 重構計畫（方案 F） |
| `progress.md` | 交付進度（10 波） |
| `delivery-rules.md` | 交付規則 |
| `api-contracts.md` | API 契約 |
| `data-structure.md` | Firebase 資料結構 |
| `compatibility.md` | 舊資料相容策略 |

## 新對話流程

1. 上傳 `docs/` 資料夾全部 8 檔
2. 說：「我已上傳 docs/，請交付第 N 波」
3. AI 自動讀取並依規則產出檔案

## 當前狀態

- 專案版本：v102.1.0
- 重構目標：v103.0.0
- 當前波次：第 1 波（已完成）
- 下一波次：第 2 波（Core 基礎，7 檔）
