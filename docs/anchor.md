# 主錨點 — 家庭財務 Web App v103.0.0 重構

最後更新：2026-10-09
當前版本：v102.1.0
重構目標：v103.0.0（方案 F：終極宣告式）
SW 快取版本：family-fin-v135

## AI 讀取順序

當使用者說「請交付第 N 波」時：

1. `anchor.md`（本檔案）
2. `refactor-plan.md`
3. `progress.md`
4. `delivery-rules.md`
5. `api-contracts.md`
6. `data-structure.md`
7. `compatibility.md`

## 一、專案身份

| 項目 | 內容 |
|---|---|
| 專案 | 家庭財務與固定供款管理 Web App |
| GitHub | family-fin-v2 |
| 部署 | Cloudflare Pages |
| 資料庫 | Firebase RTDB (asia-southeast1) |
| 登入 | Firebase Auth（自訂帳號 @familyfin.local） |
| 前端 | 純 HTML + CSS + ES Module JS |
| 後端 | Cloudflare Pages Functions |
| 視覺 | 深色科幻霓虹（Cyan / Magenta / Emerald） |
| 金額 | 四捨五入至整數 |

## 二、重構目標（4 大問題）

| 問題 | 現況 | 目標 |
|---|---|---|
| 修改動全身 | 狀態文字散落 15+ 檔 | 5 大 Registry 集中 |
| 檔案太多 | 104 檔 | 95 檔 |
| 程式碼太多 | 28,100 行 | 19,300 行（-31%） |
| 頁面重複 | 9,000 行 | 1,200 行（-87%） |

## 三、核心架構原則

1. **SSOT 極大化**：任何知識只存在一處
2. **宣告式 > 命令式**：頁面只描述「要什麼」
3. **舊資料 100% 相容**：讀取時 normalize
4. **操作邏輯不變**：只改實作方式

## 四、5 大 Registry

| Registry | 職責 |
|---|---|
| `status-registry.js` | 狀態系統 |
| `entity-registry.js` | 名稱解析 |
| `label-registry.js` | 顯示文字 |
| `column-registry.js` | 表格欄位 |
| `constants.js` | 全站常數 |

## 五、3 大引擎

| 引擎 | 職責 | 行數 |
|---|---|---|
| `page-engine.js` | 解讀 Schema、生命週期 | ~250 |
| `data-engine.js` | Firebase 訂閱 + 衍生 | ~200 |
| `render-engine.js` | 掛載 UI 區塊 | ~250 |

## 六、5 大 Block

| Block | 職責 |
|---|---|
| `stats-block.js` | 統計卡區 |
| `list-block.js` | 列表區 |
| `filter-block.js` | 篩選列區 |
| `detail-block.js` | 明細展開區 |
| `form-block.js` | 表單 Modal 區 |

## 七、Page Schema 格式

```js
export default {
  title: L('pages.settlements'),
  data: {
    members:  { type: 'list', path: 'members' },
    expenses: { type: 'list', path: 'expenses:ym' },
  },
  state: {
    filters: { year: '', month: '' },
    sortMode: 'pending-first',
  },
  derived: {
    rows:     { deps: ['expenses'], compute: (d) => mergeData(d) },
    filtered: { deps: ['rows', 'state.filters'], compute: (r, s) => applyFilters(r, s) },
    stats:    { deps: ['filtered'], compute: (f) => buildStats(f) },
  },
  blocks: [
    { type: 'stats',  container: 'xxx-stats',  cards: '$.stats' },
    { type: 'filter', container: 'xxx-filter', fields: ['year', 'month'], bind: 'state.filters' },
    { type: 'list',   container: 'xxx-list',   rows: '$.filtered', columns: COLUMNS.xxx },
  ],
};
```

## 八、目標檔案結構

```
js/
├── config/（6）constants / firebase-config / 4 Registry
├── core/（7）state / api / db / auth / auth-guard / utils / pwa
├── lib/（8）dom / async / lifecycle / registry / merge / insurance / bank / format
├── engines/（3）page / data / render
├── blocks/（5）stats / list / filter / detail / form
├── ui/（6）toast / modal / form-builder / tab-panel / view-toggle / collapsible
├── layout/（3）navbar / sidebar / app-shell
├── entity/（3）entity-modal / entity-helpers / entity-definitions
├── admin/（1）admin
└── pages/（13）純 Schema

functions/api/（8）_config / _helpers / summary / insurance / admin / platform / family / bank / personal
docs/（8）README / anchor / refactor-plan / progress / delivery-rules / api-contracts / data-structure / compatibility
```

## 九、下一步

回覆：
- 「請交付第 N 波」→ AI 依 `progress.md` 交付
- 「查看進度」→ AI 讀取 `progress.md` 回報
