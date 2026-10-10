# 事故日誌 — v103.0.18

最後更新：B19
當前版本：v103.0.18
適用範圍：v103.0.0 首次部署 → v103.0.18（B19）

本檔案記錄從部署到修復的全部問題。
每個問題包含：症狀、根本原因、解決方案、驗證方式、教訓。

═══════════════════════════════════════════════════════
【總覽】
═══════════════════════════════════════════════════════

| 批次 | 編號 | 問題 | 嚴重度 | 狀態 |
|---|---|---|---|---|
| B11 | P01 | Cloudflare Functions 路由 500 | 🔴 | ✅ 已修 |
| B11 | P02 | HTML 缺 .html 匹配到 .js | 🔴 | ✅ 已修 |
| B11 | P03 | _redirects 造成重定向循環 | 🟠 | ✅ 已修 |
| B11 | P04 | page-engine 缺 customMount | 🔴 | ✅ 已修 |
| B11 | P05 | _onKeyChange 缺 data. 前綴 | 🟠 | ✅ 已修 |
| B11 | P06 | esc 從錯誤檔導入 | 🔴 | ✅ 已修 |
| B11 | P07 | derived 對 undefined 崩潰 | 🟠 | ✅ 已修 |
| B11 | P08 | 手機無 Console 可看 | 🟡 | ✅ 已修 |
| B11 | P09 | app-shell 靜態 import 崩潰 | 🔴 | ✅ 已修 |
| B11 | P10 | SW stale-while-revalidate | 🟡 | ✅ 已修 |
| B11 | P11 | GitHub 檔案未真正更新 | 🔴 | ⚠️ 流程 |
| B11 | P12 | database.js 內容錯誤 | 🟠 | ✅ 已修 |
| B11 | P13 | js/shared/* 舊 import 路徑 | 🔴 | ✅ 已修 |
| B12 | B01~B07 | 阻斷級（前後端） | 🔴 | ✅ 已修 |
| B13 | H01~H11 | SSOT 統一 | 🟠 | ✅ 已修 |
| B14 | M01~M18 | 中優先 | 🟡 | ✅ 已修 |
| B15 | L01~L07 | 低優先 | 🟢 | ✅ 已修 |
| B16 | P16-01~P16-05 | 第二輪問題 | 🟠 | ✅ 已修 |
| B17 | P17-01~P17-06 | 第三輪問題 | 🟠 | ✅ 已修 |
| B18 | — | entity-resolvers + portfolio | 🟡 | ✅ 已修 |
| B18.1 | — | page-engine onDataChange | 🟡 | ✅ 已修 |
| B19 | — | 無補丁重構 | 🟡 | ✅ 已修 |

═══════════════════════════════════════════════════════
【B11 階段 — P01~P13（13 問題）】
═══════════════════════════════════════════════════════

■ P01 — Cloudflare Functions 路由 500（🔴 阻斷）

  症狀：
    GET /api/lookup-family  → 500
    No such module "family.js"

  根本原因：
    CF Pages Functions 以「檔案路徑」為路由基礎。
    每個 URL 必須對應一個獨立的實體檔案。
    跨檔 re-export shim 不保證支援。

  解決方案（方案 B：底線前綴 + Catch-all）：
    1. 主檔改名為 _xxx.js
    2. 主檔改為具名 export（handleXxx）
    3. 新增 functions/api/[[path]].js 做路由分派
    4. 最終目錄：[[path]].js + _config + _helpers + 7 個 _xxx.js

  教訓：
    ⚠️ CF Pages Functions 不支援跨檔 re-export shim
    ⚠️ 每個 URL 必須對應獨立實體檔案
    ⚠️ 用「底線前綴 + Catch-all」最穩定

■ P02 — HTML 缺 .html 匹配到 .js（🔴 阻斷）

  症狀：
    訪問 /database（無 .html）→ 顯示 database.js 原始碼

  根本原因：
    CF Pages 路由優先序：/database → database.html → database/index.html → database.js
    找不到前兩者時，回傳 .js 原始碼（text/plain）

  解決方案：
    SIDEBAR_GROUPS 所有 href 加 .html

  教訓：
    ⚠️ 所有內部連結一律帶 .html 副檔名

■ P03 — _redirects 造成重定向循環（🟠 高）

  症狀：
    ERR_TOO_MANY_REDIRECTS

  根本原因：
    _redirects 對 / 加 200 內部改寫規則，CF Pages 已預設處理 → 無限迴圈

  解決方案：
    刪除 _redirects

  教訓：
    ⚠️ 不要對 / 加 _redirects 規則

■ P04 — page-engine 缺 customMount（🔴 阻斷）

  症狀：
    input-center / settings / database / settlements / insurance 5 頁空白

  根本原因：
    v103 第 7 波 page-engine.js 只處理 schema.blocks，沒呼叫 schema.customMount

  解決方案：
    createPage 加：
      if (typeof schema.customMount === 'function') {
        ctx._customMountInstance = await schema.customMount(ctx);
      }
    _destroy 加對應清理

  教訓：
    ⚠️ Page Schema 的 customMount 是重要逃生艙

■ P05 — _onKeyChange 缺 data. 前綴（🟠 高）

  症狀：
    統計卡顯示 0，derived 不重算

  根本原因：
    依賴圖註冊 key 帶前綴，但 _subscribeAllData callback 呼叫時缺前綴

  解決方案：
    _onKeyChange(ctx, schema, 'data.' + key)

  教訓：
    ⚠️ 依賴圖註冊與事件觸發的 key 必須完全一致

■ P06 — esc 從錯誤檔導入（🔴 阻斷）

  症狀：
    SyntaxError: The requested module '../lib/format.js'
    does not provide an export named 'esc'

  根本原因：
    esc 在 lib/dom.js；lib/format.js 沒有

  解決方案：
    import { formatHKD } from '../lib/format.js';
    import { esc } from '../lib/dom.js';

  教訓：
    ⚠️ esc → dom.js；format* → format.js

■ P07 — derived 對 undefined 崩潰（🟠 高）

  症狀：
    derived.statsCards 計算失敗：Cannot read properties of undefined

  根本原因：
    非同步資料訂閱初始未到，derived 計算時 data 為 undefined

  解決方案：
    _computeOne 加 undefined 檢查，跳過計算

  教訓：
    ⚠️ 所有 derived 計算必須容忍 undefined

■ P08 — 手機無 Console（🟡 中）

  解決方案：
    內嵌 vConsole（js/core/debug.js）

■ P09 — app-shell 靜態 import 崩潰（🔴 阻斷）

  症狀：
    側邊欄空白，全站崩潰

  根本原因：
    app-shell.js 頂部靜態 import debug.js，缺失時整檔失敗

  解決方案：
    改動態 import + try-catch

  教訓：
    ⚠️ 非必要模組一律用動態 import

■ P10 — SW stale-while-revalidate（🟡 中）

  症狀：
    部署新檔後需訪問兩次才生效

  解決方案：
    全部改 network-first

■ P11 — GitHub 檔案未真正更新（🔴 阻斷）

  症狀：
    本機改了但線上仍是舊版

  解決方案：
    GitHub 網頁編輯（按 .）最安全
    部署後直接訪問檔案 URL 驗證

  教訓：
    ⚠️ 不要只看頁面表現

■ P12 — database.js 內容錯誤（🟠 高）

  症狀：
    database.html 顯示 dashboard 內容

  根本原因：
    複製貼上時誤覆蓋

  解決方案：
    完全覆蓋為正確 Schema

  教訓：
    ⚠️ 複製貼上時務必確認目標檔案

■ P13 — js/shared/* 舊 import 路徑（🔴 阻斷）

  症狀：
    Failed to resolve module specifier

  根本原因：
    檔案從 shared/ 移到 ui/ / entity/ / lib/，但舊檔仍 import 舊路徑

  解決方案：
    全部按 v103 交付紀錄覆蓋

  教訓：
    ⚠️ 檔案搬移後全域搜尋舊路徑

═══════════════════════════════════════════════════════
【B12 階段 — 阻斷級修復（B01~B07）】
═══════════════════════════════════════════════════════

■ B01 — settings.js 內容錯誤（🔴 阻斷）

  症狀：
    settings.html 顯示 settlements 邏輯

  根本原因：
    複製貼上時誤覆蓋，與 P12 相同問題再發

  解決方案：
    完全重寫 js/pages/settings.js

  ⚠️ 歷史重演：P12 已教訓，B01 又犯。

■ B02 — 舊合併版 Functions 衝突（🔴 阻斷）

  症狀：
    /api/admin-families 可能被舊 admin.js 或新 [[path]].js 攔截

  根本原因：
    同時存在舊版（admin.js / bank.js / family.js 等）與新版 Catch-all

  解決方案：
    刪除 7 個舊合併版檔案

■ B03 — {__all__} 佔位符（🟠 高）

  症狀：
    finance-overview / member-report 讀整年結構錯誤

  根本原因：
    data-engine.resolvePath 未支援 {__all__}

  解決方案：
    resolvePath 加 {__all__} 處理；新增 type: 'raw'

■ B04 — page-engine 缺 undefined 檢查（🔴 阻斷）

  症狀：
    portfolio / member-report derived 崩潰

  根本原因：
    第 7 波交付 page-engine v103.0.4，缺 P07 修正

  解決方案：
    補 _computeOne 的 hasUndefinedDep 檢查

  ⚠️ 歷史重演：P07 已教訓，B04 又犯。

■ B05 — input-center.html 缺 ic-buttons-root（🔴 阻斷）

  症狀：
    輸入中心上方按鈕無效

  根本原因：
    HTML 缺容器，JS 綁定永遠不執行

  解決方案：
    HTML 加 ic-buttons-root

■ B06 — settlements.js 死代碼（🟠 中）

  症狀：
    .settlement-status-select 監聽器永不觸發

  根本原因：
    表格用 badge 顯示，非 select，監聽器為死代碼

  解決方案：
    移除死代碼

■ B07 — settlements.js 重複版本（🔴 阻斷）

  症狀：
    有 v103.0.6 和 v103.0.11 兩份

  解決方案：
    保留 v103.0.11

═══════════════════════════════════════════════════════
【B13 階段 — SSOT 統一（H01~H11）】
═══════════════════════════════════════════════════════

■ H01 — 版本號不一致

  現況：
    constants.js = v103.0.3
    sw.js = v103.0.10
    README = v103.0.11
    page-engine = v103.0.4

  解決方案：
    全部統一至 v103.0.11

■ H02 — core/utils.js 格式化重複

  現況：
    formatHKD / formatNumber / roundHKD 等 9 個函式
    同時存在 core/utils.js 與 lib/format.js

  解決方案：
    core/utils.js 改為 re-export from lib/format.js

■ H03 — escapeHtml vs esc 雙 SSOT

  解決方案：
    core/utils.js 的 escapeHtml 改 re-export lib/dom.js 的 esc

■ H04 — js/shared/* 12 檔未重構

  解決方案：
    全部改 import from lib/dom.js + lib/format.js

■ H05 — column-settings.js 未走 ui/modal

  解決方案：
    改用 openModal / closeModal

■ H06 — listener-group.js 功能重疊 lib/lifecycle

  解決方案：
    標記 @deprecated，內部改走 createCleanupRegistry

■ H07 — form-handler.js 功能重疊 lib/async

  解決方案：
    標記 @deprecated，內部改走 withToast

■ H08 — column-registry.js 導入路徑錯

  解決方案：
    format* → lib/format.js；escapeHtml → lib/dom.js

■ H09 — db.js 廢除節點仍在寫

  解決方案：
    移除 updateFixedExpenseCompat；fixed 分支明確拋錯

■ H10 — auth-guard.js fallback 安全風險

  症狀：
    網路錯誤時 canInput = true，任何人都能輸入

  解決方案：
    fallback 改為唯讀（canInput = false）+ toast 提示

■ H11 — db.js PLATFORM_PATHS 重複

  解決方案：
    從 constants.js 導入 PLATFORM_RESOURCES

═══════════════════════════════════════════════════════
【B14 階段 — 中優先（M01~M18）】
═══════════════════════════════════════════════════════

■ M01 — listenPlatformResource 對 object 型強制轉 list

■ M02 — dashboard 3 張卡片永遠 HK$ 0

■ M03 — portfolio _fundActions 未傳 allRows

■ M04 — form-builder onSubmit 簽名混亂

■ M05 — tab-panel / view-toggle 直接讀寫 localStorage

■ M06 — db.js saveIncome 用 set() 而非 update()

■ M07 — utils getMemberDisplayName 回傳「（未知）」

■ M08 — state getRoleLabel 硬編碼中文

■ M09 — input-center 支出 Tab 未實作

■ M10 — annual-report membersRows 只是原樣返回

■ M11 — annual-report export-excel-btn 未綁定

■ M12 — member-report personalIncome 硬編碼 0

■ M13 — insurance / settlements 用 shared/stats-cards

■ M14 — login.html 硬編碼 AUTH_CONTEXT_CACHE_PREFIX

■ M15 — inline vConsole 只在 2 頁

■ M16 — debug.js 預設啟用 vConsole

■ M17 — entity-definitions 從 db.js 導入大量函式

■ M18 — 保單建立後 updateInsurancePolicy 再次寫入 advanceId

全部已修，詳見 B14A / B14B / B14C 交付。

═══════════════════════════════════════════════════════
【B15 階段 — 低優先（L01~L07）】
═══════════════════════════════════════════════════════

■ L01 — navbar _bindGlobalEvents 空 return 分支

■ L02 — sidebar renderSidebar 多餘 async

■ L03 — quick-summary _renderAssetPie 命名不符

■ L04 — page-filter 導入 escapeHtml 未使用

■ L05 — form-block 導入 esc 未使用

■ L06 — annual-report / member-report / finance-overview 導入 createPage 未使用

■ L07 — utils.uid 用 Math.random()（可接受）

全部已修，詳見 B15 交付。

═══════════════════════════════════════════════════════
【B16 階段 — 第二輪問題（P16-01~P16-05）】
═══════════════════════════════════════════════════════

■ P16-01 — 新增支出開錯 Modal（🔴）

  症狀：
    輸入中心點「新增支出」→ 跳出「新增成員」Modal

  根本原因：
    v103.0.11 交付 input-center.js 時：
      case 'add-expense':
        openEntityModal({ entity: ENTITY_KEYS.MEMBER, mode: 'add' });  // 複製殘留

  解決方案：
    寫新的「新增支出 Modal」（成員 / 名稱 / 金額 / 日期 / 類別 / 項目 / 支付 / 銀行 / 狀態）

■ P16-02 — 年度報表缺月度明細切換（🟠）

  症狀：
    只有「全年總合」表格

  解決方案：
    加年份切換 + 月份切換 + 月度明細視圖

■ P16-03 — 成員名稱顯示不正確（🟠）

  症狀：
    輸入中心與結算清單的成員欄顯示 Firebase push key

  根本原因：
    column-registry.resolvers.settlements.member 只是 escapeHtml(val)
    資料欄位是 memberId，val 是 undefined

  解決方案：
    resolveName('members', row.memberId)

■ P16-04 — 系統設定缺成員資料（🟠）

  症狀：
    個人化 Tab 只顯示帳號資訊 / 統計卡模式

  根本原因：
    settings.js 重寫為 Schema 後，customMount 只保留 Tab 切換邏輯

  解決方案：
    補 _initPersonalTab(ctx)：帳號資訊 / 登出 / 統計卡模式 / 成員列表 / 除錯卡

■ P16-05 — 基金版面沒資料（🔴）

  症狀：
    fund-table-view 被 display:none，卡片容器又沒 block

  解決方案：
    改用 blocks（card + table 兩個 block），加 view toggle

═══════════════════════════════════════════════════════
【B17 階段 — 第三輪問題（P17-01~P17-06）】
═══════════════════════════════════════════════════════

■ P17-01 — 年度報表所有資料沒顯示（🔴）

  症狀：
    年份按鈕、view toggle 都在，下方完全空白

  根本原因：
    membersRows derived 依賴 data.allIncome（非同步），初始 undefined
    page-engine._computeOne 跳過
    ctx.invalidate 猴子補丁不會被 page-engine 呼叫
    blocks: [] 空 → 沒有任何 block 被通知

  解決方案：
    annual-report.js 改用 blocks（page-engine 自動通知）
    月度明細改為分組樣式（【收入】【成員】【家庭共用】）

■ P17-02 — 基金表格沒資料（🟠）

  症狀：
    卡片有資料，表格完全空白

  根本原因：
    portfolio.js blocks: [stats] 只有 stats，table view 完全沒渲染邏輯

  解決方案：
    blocks 加 table block

■ P17-03 — 年月選項沒連動（🔴）

  症狀：
    切 navbar 年月，保險頁不重算；需手動重整才生效

  根本原因：
    insurance.js customMount 沒訂閱 ym-change

  解決方案：
    page-engine 加 onYearMonthChange hook
    各頁訂閱 ctx.onDataChange

■ P17-04 — 項目所屬類別顯示 ID（🟠）

  症狀：
    基礎資料庫顯示 cat_medical

  根本原因：
    resolvers.items.categoryId 只是 escapeHtml(val)

  解決方案：
    resolveName('categories', val)

■ P17-05 — 輸入中心沒支出紀錄（🔴）

  症狀：
    支出 Tab 完全空白

  根本原因：
    listenAllMemberExpenses(null, null, ...)
    AppState.month === 'all' → 路徑 expenses/2026/all/member_expenses 不存在

  解決方案：
    改用 listenAllExpenses（讀全年）

■ P17-06 — 保險持單人 / 受保人顯示 ID（🟠）

  症狀：
    卡片顯示 Firebase push key

  根本原因：
    entity-list-page 呼叫 renderDataTable 時沒傳 resolvers

  解決方案：
    新建 entity-resolvers.js，entity-list-page 傳 def.resolvers

═══════════════════════════════════════════════════════
【B18 階段 — entity-resolvers + portfolio】
═══════════════════════════════════════════════════════

■ B18 — 新增 entity-resolvers.js

  目的：
    集中 entity 欄位的顯示邏輯（8 個 entity）

  影響：
    entity-list-page.js 傳 resolvers 給 renderDataTable
    portfolio.js 改 blocks 機制
    portfolio.html 加 view toggle 容器

═══════════════════════════════════════════════════════
【B18.1 階段 — page-engine onDataChange】
═══════════════════════════════════════════════════════

■ B18.1 — 統一自動更新機制

  症狀：
    customMount 頁面資料到達時不自動更新，需手動重整

  根本原因：
    page-engine 只通知 blocks，不通知 customMount
    各頁用猴子補丁覆寫 ctx.invalidate（脆弱）

  解決方案：
    page-engine 加 ctx.onDataChange(fn)
    各頁用 unsub = ctx.onDataChange(render)
    destroy 時 unsub()

  影響：
    insurance / annual-report / finance-overview / dashboard 改訂閱
    廢除猴子補丁

═══════════════════════════════════════════════════════
【B19 階段 — 無補丁重構】
═══════════════════════════════════════════════════════

■ B19 — 全面無補丁重構

  動機：
    用戶要求「不要補丁的做法」
    發現 B17/B18 仍有補丁思維

  識別出的補丁：
    1. insurance.js：_lastPolicyIds 快取判斷
    2. annual-report.js：每次 view 切換 destroy/create
    3. finance-overview.js：每次 render destroy/create
    4. 所有頁面：手寫 render + destroy 舊 + create 新

  解決方案：
    1. block 加 renderInPlace（同 HTML 不重繪）
    2. 抽 lib/expense-modal.js（共用支出 Modal）
    3. 抽 lib/income-modal.js（家用轉入 + 個人收入）
    4. 抽 lib/filter-sort.js（篩選 + 排序）
    5. 頁面重構（insurance / annual-report / finance-overview / input-center / settlements）

  影響：
    input-center.js：-420 行
    settlements.js：-100 行
    data-table / list-block / stats-block：加 renderInPlace

═══════════════════════════════════════════════════════
【關鍵教訓總結】
═══════════════════════════════════════════════════════

1. Cloudflare Pages Functions
   - 每個 URL 必須對應獨立實體檔案
   - 不支援跨檔 re-export shim
   - 用「底線前綴 + Catch-all」最穩定

2. CF Pages 靜態檔案
   - 所有內部連結帶 .html
   - 不要對 / 加 _redirects
   - 檢查 Content-Type（必要時加 _headers）

3. Page Engine
   - 必須支援 customMount
   - 必須支援 onYearMonthChange
   - 必須支援 onDataChange（統一通知）
   - 事件 key 與依賴圖一致
   - derived 計算容忍 undefined

4. Import 路徑
   - esc → dom.js
   - format* → format.js
   - 檔案搬移後全域搜尋舊路徑

5. Service Worker
   - 開發階段 network-first
   - 正式階段可改 stale
   - CACHE_NAME 有版本號

6. 除錯
   - 手機必須內嵌 vConsole
   - 非必要模組用動態 import
   - 全域 error / unhandledrejection 監聽

7. 部署驗證
   - 直接訪問檔案 URL 驗證
   - 不要只看頁面表現
   - GitHub 網頁編輯最安全

8. 無補丁原則（B19）
   - 能宣告就不手寫
   - 能就地更新就不 destroy/create
   - 更好就換，不為向後相容妥協
   - 不加快取變數判斷「資料有沒有變」
   - 不猴子補丁覆寫引擎

9. 共用元件化
   - 同一功能在多頁出現 → 抽共用模組
   - 判斷準則：「這功能未來會不會改？」
   - 會 → 抽共用；不會 → 可留在原檔

10. 檔案交付
    - 單檔 ≤ 500 行
    - 每個檔案最後加 END OF FILE 標記（B20 起）
    - 交付格式統一（檔案路徑 + 檔案內容）

═══════════════════════════════════════════════════════
【歷史重演警告】
═══════════════════════════════════════════════════════

以下問題重複發生，需特別注意：

⚠️ 複製貼上錯誤（內容誤覆蓋）
   - P12：database.js 被 dashboard.js 覆蓋
   - B01：settings.js 被 settlements.js 覆蓋

⚠️ page-engine 修正遺漏
   - P07：v103.0.0 缺 undefined 檢查
   - B04：v103.0.4 又缺 P07 修正

⚠️ 舊 import 路徑殘留
   - P13：js/shared/* 舊 import 路徑
   - B02：舊合併版 Functions 未刪

═══════════════════════════════════════════════════════
【流程改善建議】
═══════════════════════════════════════════════════════

1. 部署前自我檢查
   - 訪問所有頁面
   - vConsole 檢查 Error 分頁
   - 檢查 API 回應

2. 部署後驗證
   - 直接訪問檔案 URL（帶 ?v= 參數）
   - 對照 GitHub 與 CF Pages Commit SHA

3. 交付前檢查（見 anchor.md 0.14）
   - 所有 button 有 type="button"
   - 狀態走 status-registry
   - 名稱走 entity-registry
   - 檔案最後有 END OF FILE（B20 起）

4. AI 必須遵循
   - 先提供方案，待確認後交付
   - 發現衝突立即提醒
   - 主動提出更好方案

═══════════════════════════════════════════════════════
【結束】
═══════════════════════════════════════════════════════

/* ═══════════════════════════════════════════
   END OF FILE
   File: docs/incident-log.md
   Version: v103.0.18
   Batch: B19
   ═══════════════════════════════════════════ */