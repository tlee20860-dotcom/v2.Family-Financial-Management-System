# 家庭財務 Web App — 重構文檔索引

最後更新：B19
當前版本：v103.0.18
最新批次：B19

本資料夾包含 v103 重構與部署修復所需的全部錨點檔案。
新對話時，將整個 docs/ 資料夾上傳給 AI。

═══════════════════════════════════════════════════════
【檔案清單】
═══════════════════════════════════════════════════════

| 檔案 | 用途 | 更新頻率 |
|---|---|---|
| README.md | 本檔案，索引 | 每次版本更新 |
| anchor.md | 主錨點，AI 首先讀取 | 每次交付後 |
| incident-log.md | 部署實戰紀錄（13 問題） | 遇到新問題時 |
| progress.md | 交付進度（B01~B19） | 每波交付後 |
| refactor-plan.md | 重構計畫（方案 F） | 版本更新 |
| delivery-rules.md | 交付規則 | 極少 |
| api-contracts.md | API 契約 | 介面變更時 |
| data-structure.md | Firebase 資料結構 | 資料結構變更時 |
| compatibility.md | 舊資料相容策略 | 極少 |

═══════════════════════════════════════════════════════
【AI 讀取順序】
═══════════════════════════════════════════════════════

當使用者說「請交付第 N 波」或「查看進度」時：

1. anchor.md（主錨點）
2. incident-log.md（部署實戰紀錄）
3. progress.md（交付進度）
4. refactor-plan.md（重構計畫）
5. delivery-rules.md（交付規則）
6. api-contracts.md（API 契約）
7. data-structure.md（資料結構）
8. compatibility.md（相容策略）

═══════════════════════════════════════════════════════
【新對話流程】
═══════════════════════════════════════════════════════

■ 情境 A：繼續開發

  1. 上傳 docs/ 資料夾全部 9 檔
  2. 說：「我已上傳 docs/，請讀取全部內容」
  3. AI 回報：「已讀取 9 份文件，當前版本 v103.0.18，最新批次 B19」
  4. 說：「我要修改 XXX」或「請修復 XXX」

■ 情境 B：修復 Bug

  1. 上傳 docs/ 資料夾全部 9 檔
  2. 說：「請讀取 docs/，[問題描述]」
  3. AI 讀取後回報

■ 情境 C：新增功能

  1. 上傳 docs/ 資料夾全部 9 檔
  2. 說：「請讀取 docs/，我要新增 XXX 功能」

■ 若 AI 回應「檔案內容不完整」

  表示 docs/ 上傳不完整，請重新上傳缺少的檔案。

═══════════════════════════════════════════════════════
【當前狀態】
═══════════════════════════════════════════════════════

| 項目 | 值 |
|---|---|
| 專案版本 | v103.0.18 |
| SW 版本 | family-fin-v139 |
| 最新批次 | B19 |
| 部署 URL | https://family-financial-management-system.pages.dev |
| 當前狀態 | B19 部署完成，待測試 |

完成度：
  ✅ 5 Registry
  ✅ 3 Engine（含 onDataChange hook）
  ✅ 5 Block（含 renderInPlace）
  ✅ 13 Page Schema
  ✅ Functions API（10 檔）
  ✅ 全站頁面可訪問
  ✅ 所有 API 正常
  ✅ 統計卡顯示
  ✅ 手機 vConsole 除錯
  ✅ Service Worker network-first
  ✅ 無補丁重構（B19）

═══════════════════════════════════════════════════════
【快速連結】
═══════════════════════════════════════════════════════

■ 專案資訊
  GitHub: family-fin-v2
  Firebase: family-fin-a6dd1
  Cloudflare: family-financial-management-system

■ 核心文檔
  - 架構總覽 → anchor.md
  - 部署問題 → incident-log.md
  - 重構計畫 → refactor-plan.md
  - 資料結構 → data-structure.md

■ 交付規則
  - 檔案交付 → delivery-rules.md
  - API 契約 → api-contracts.md
  - 相容策略 → compatibility.md

═══════════════════════════════════════════════════════
【待辦事項】
═══════════════════════════════════════════════════════

[ ] 效能優化：SW 改回 stale-while-revalidate
[ ] 補齊 js/shared/ 中未使用檔案的清理
[ ] 補 _headers（若 MIME type 有問題）
[ ] B20 起所有交付加 END OF FILE 標記

═══════════════════════════════════════════════════════
【結束】
═══════════════════════════════════════════════════════