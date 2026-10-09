# 事故日誌 — v103.0.0 部署實戰紀錄

最後更新：2026-10-10
當前版本：v103.0.11
適用範圍：v103.0.0 首次部署 → v103.0.11 完成

本檔案記錄從部署到修復的**全部 13 個問題**。
每個問題包含：症狀、根本原因、解決方案、驗證方式、教訓。

═══════════════════════════════════════════════════════
【總覽】
═══════════════════════════════════════════════════════

| 編號 | 問題 | 嚴重度 | 影響範圍 | 狀態 |
|---|---|---|---|---|
| P01 | Cloudflare Functions 路由 500 | 🔴 阻斷 | 所有 API | ✅ 已修 |
| P02 | HTML 缺 .html 匹配到 .js | 🔴 阻斷 | 所有頁面 | ✅ 已修 |
| P03 | _redirects 造成重定向循環 | 🟠 高 | 全站 | ✅ 已修 |
| P04 | page-engine 缺 customMount | 🔴 阻斷 | 5 頁面 | ✅ 已修 |
| P05 | _onKeyChange 缺 data. 前綴 | 🟠 高 | 所有統計 | ✅ 已修 |
| P06 | esc 從錯誤檔導入 | 🔴 阻斷 | 2 頁面 | ✅ 已修 |
| P07 | derived 對 undefined 崩潰 | 🟠 高 | 有 derived 頁面 | ✅ 已修 |
| P08 | 手機無 Console 可看 | 🟡 中 | 除錯體驗 | ✅ 已修 |
| P09 | app-shell 靜態 import 崩潰 | 🔴 阻斷 | 全站 | ✅ 已修 |
| P10 | SW stale-while-revalidate | 🟡 中 | 部署體驗 | ✅ 已修 |
| P11 | GitHub 檔案未真正更新 | 🔴 阻斷 | 部署流程 | ⚠️ 流程提醒 |
| P12 | database.js 內容錯誤 | 🟠 高 | 1 頁面 | ✅ 已修 |
| P13 | js/shared/* 舊 import 路徑 | 🔴 阻斷 | 10 檔案 | ✅ 已修 |

═══════════════════════════════════════════════════════
【P01 — Cloudflare Functions 路由 500】
═══════════════════════════════════════════════════════

■ 嚴重度：🔴 阻斷級

■ 症狀

  Console 錯誤：
    GET /api/lookup-family  → 500 (Internal Server Error)
    GET /api/bank-accounts  → 500 (Internal Server Error)

    [auth-guard] lookupFamily 網路失敗，將使用 fallback：
      No such module "family.js"

■ 根本原因

  Cloudflare Pages Functions 以「檔案路徑」為路由基礎。
  每個 URL 必須對應一個獨立的實體檔案。

  v103 第 10 波採用「合併策略 + shim re-export」：

    // 舊做法（失敗）
    // functions/api/family.js（合併主檔）
    // functions/api/lookup-family.js（shim）
    export { onRequestPost } from './family.js';

  CF Pages 對跨檔 re-export 的支援不保證，
  部署時 shim 找不到目標檔 → 500。

■ 解決方案（方案 B：底線前綴 + Catch-all）

  Step 1：主檔改名為 _xxx.js

    family.js    → _family.js
    admin.js     → _admin.js
    bank.js      → _bank.js
    personal.js  → _personal.js
    platform.js  → _platform.js
    summary.js   → _summary.js
    insurance.js → _insurance.js

  Step 2：主檔改為具名 export

    每個 _xxx.js 導出多個 handleXxx() 函式，
    不再 export onRequestGet / onRequestPost。

    範例 _family.js：

      export async function handleLookupFamily(request) {
        try {
          const auth = await authenticate(request);
          if (auth instanceof Response) return auth;
          const { user, token } = auth;
          const result = await verifyFamilyAccessByUid(user.localId, token);
          if (!result) return errorResponse('NOT_FOUND', '此帳號不屬於任何家庭');
          return successResponse({ familyId: result.familyId, ... });
        } catch (err) {
          return handleError(err);
        }
      }

  Step 3：新增 functions/api/[[path]].js

    import { handleLookupFamily, handleFamilySettingsGet, ... }
      from './_family.js';
    import { handleAdminFamiliesGet, ... } from './_admin.js';
    import { handleBankAccountsGet, ... } from './_bank.js';
    import { handlePersonalIncomeGet, ... } from './_personal.js';
    import { handlePlatformSettingsGet, ... } from './_platform.js';
    import { handleSummary, ... } from './_summary.js';
    import { handleInsuranceSync } from './_insurance.js';

    export async function onRequestGet({ request }) {
      const url = new URL(request.url);
      const path = url.pathname;

      if (path === '/api/family-settings') return handleFamilySettingsGet(request);
      if (path === '/api/family-accounts') return handleFamilyAccountsGet(request);
      if (path === '/api/admin-families') return handleAdminFamiliesGet(request);
      if (path === '/api/summary') return handleSummary(request);
      if (path === '/api/annual-summary') return handleAnnualSummary(request);
      if (path === '/api/settlements-year') return handleSettlementsYear(request);
      if (path === '/api/platform-settings') return handlePlatformSettingsGet(request);
      if (path === '/api/platform-defaults') return handlePlatformDefaultsGet(request);
      if (path === '/api/bank-accounts') return handleBankAccountsGet(request);
      if (path === '/api/bank-transactions') return handleBankTransactionsGet(request);
      if (path === '/api/personal-income') return handlePersonalIncomeGet(request);
      if (path === '/api/member-advances') return handleMemberAdvancesGet(request);

      return new Response(JSON.stringify({ ok: false, error: 'NOT_FOUND' }),
        { status: 404 });
    }

    export async function onRequestPost({ request }) {
      const url = new URL(request.url);
      const path = url.pathname;

      if (path === '/api/lookup-family') return handleLookupFamily(request);
      if (path === '/api/family-settings') return handleFamilySettingsPost(request);
      if (path === '/api/family-accounts') return handleFamilyAccountsPost(request);
      if (path === '/api/admin-families') return handleAdminFamiliesPost(request);
      if (path === '/api/admin-init-family') return handleAdminInitFamily(request);
      if (path === '/api/platform-settings') return handlePlatformSettingsPost(request);
      if (path === '/api/platform-defaults') return handlePlatformDefaultsPost(request);
      if (path === '/api/bank-accounts') return handleBankAccountsPost(request);
      if (path === '/api/bank-transactions') return handleBankTransactionsPost(request);
      if (path === '/api/clear-bank-balances') return handleClearBankBalances(request);
      if (path === '/api/personal-income') return handlePersonalIncomePost(request);
      if (path === '/api/member-advances') return handleMemberAdvancesPost(request);
      if (path === '/api/insurance-sync') return handleInsuranceSync(request);

      return new Response(JSON.stringify({ ok: false, error: 'NOT_FOUND' }),
        { status: 404 });
    }

  Step 4：最終目錄結構

    functions/api/
    ├── [[path]].js       Catch-all 路由器
    ├── _config.js        Firebase REST 設定
    ├── _helpers.js       API 共用輔助
    ├── _family.js        3 個 handler
    ├── _admin.js         2 個 handler
    ├── _bank.js          3 個 handler
    ├── _personal.js      2 個 handler
    ├── _platform.js      2 個 handler
    ├── _summary.js       3 個 handler
    └── _insurance.js     1 個 handler

    共 10 檔（原 9 檔 → 淨增 1）

■ 驗證

  Console 應顯示：
    ✅ POST /api/lookup-family  → 200
    ✅ GET  /api/bank-accounts  → 200
    ✅ GET  /api/family-settings → 200
    ❌ 不再有 "No such module"

■ 教訓

  ⚠️ Cloudflare Pages Functions 不支援跨檔 re-export shim。
  ⚠️ 每個 URL 必須對應獨立實體檔案。
  ⚠️ 用「底線前綴 + Catch-all」是最穩定的方案。

═══════════════════════════════════════════════════════
【P02 — HTML 缺 .html 匹配到 .js】
═══════════════════════════════════════════════════════

■ 嚴重度：🔴 阻斷級

■ 症狀

  訪問 /database（無 .html）
  → 顯示 database.js 的原始碼（純文字）

  Console 無錯誤，但頁面顯示程式碼。

■ 根本原因

  CF Pages 路由優先序：

    1. /database  → 找 database.html
    2. 若無       → 找 database/index.html
    3. 若都無     → 嘗試匹配 database.js
                    → 回傳 .js 原始碼（Content-Type: text/plain）

  側邊欄 href="database"（無 .html）→ 觸發情況 3。

■ 解決方案

  修改 js/config/constants.js 的 SIDEBAR_GROUPS，
  所有 href 加上 .html。

  正確寫法：

    export const SIDEBAR_GROUPS = [
      { key: 'overview', label: '總覽', icon: 'home', defaultOpen: true,
        items: [
          { icon: 'home', label: '總覽儀表板', href: 'index.html' },
        ] },
      { key: 'record', label: '記錄中心', icon: 'pencil', defaultOpen: true,
        items: [
          { icon: 'pencil',   label: '綜合輸入中心', href: 'input-center.html' },
          { icon: 'database', label: '基礎資料庫',   href: 'database.html' },
        ] },
      { key: 'insurance-fund', label: '保險與基金', icon: 'shield', defaultOpen: false,
        items: [
          { icon: 'shield',     label: '保險清單表', href: 'insurance.html' },
          { icon: 'line-chart', label: '基金投資表', href: 'portfolio.html' },
        ] },
      { key: 'settle', label: '對帳', icon: 'clipboard-check', defaultOpen: false,
        items: [
          { icon: 'clipboard-check', label: '結算清單', href: 'settlements.html' },
        ] },
      { key: 'assets', label: '資產', icon: 'landmark', defaultOpen: false,
        items: [
          { icon: 'landmark', label: '銀行交易', href: 'finance-overview.html' },
        ] },
      { key: 'reports', label: '報表', icon: 'bar-chart-3', defaultOpen: false,
        items: [
          { icon: 'bar-chart-3', label: '年度報表', href: 'annual-report.html' },
          { icon: 'users', label: '成員與家庭收入與支出明細',
            href: 'member-report.html' },
        ] },
      { key: 'system', label: '系統', icon: 'settings', defaultOpen: false,
        items: [
          { icon: 'settings', label: '系統設定', href: 'settings.html' },
        ] },
    ];

■ 驗證

  點側邊欄任意項目
  → URL 應為 xxx/xxx.html（有 .html）
  → 頁面正常顯示

■ 教訓

  ⚠️ 所有內部連結一律帶 .html 副檔名。
  ⚠️ 不要依賴 CF Pages 的自動 .html 匹配。

═══════════════════════════════════════════════════════
【P03 — _redirects 造成重定向循環】
═══════════════════════════════════════════════════════

■ 嚴重度：🟠 高

■ 症狀

  ERR_TOO_MANY_REDIRECTS

  頁面完全無法載入。

■ 根本原因

  _redirects 檔案內容：

    /                     /index.html          200   ← 問題行

  CF Pages 對 / 已有預設處理（自動匹配 index.html），
  加上 200 內部改寫規則 → 無限迴圈。

■ 解決方案

  刪除 _redirects 檔案。

  P02 已修正側邊欄連結（href 帶 .html），
  不需要 _redirects 再做重定向。

  若未來真的需要 _redirects，規則設計：

    ✅ 只針對特定頁面
    ✅ 用 200（內部改寫）不用 301
    ❌ 不要動 /

  範例：

    /database          /database.html          200
    /settings          /settings.html          200

■ 驗證

  訪問任意 URL，不應再出現重定向循環。

■ 教訓

  ⚠️ 不要對 / 加 _redirects 規則。
  ⚠️ CF Pages 對 / 已有預設行為。

═══════════════════════════════════════════════════════
【P04 — page-engine 缺 customMount】
═══════════════════════════════════════════════════════

■ 嚴重度：🔴 阻斷級

■ 症狀

  5 個頁面完全空白（HTML 顯示標題但內容空）：

    input-center.html
    settings.html
    database.html
    settlements.html
    insurance.html

  這些頁面都使用 schema.customMount，
  但 createPage 沒呼叫它。

■ 根本原因

  v103 第 7 波交付的 page-engine.js 只處理 schema.blocks：

    // 舊版（缺 customMount）
    export async function createPage(schema) {
      // ...
      _buildDependencyGraph(ctx, schema);
      _subscribeAllData(ctx, schema);
      _computeAllDerived(ctx, schema);
      await _mountAllBlocks(ctx, schema);
      // ← 缺 customMount 呼叫
      return { ctx, destroy: () => _destroy(ctx) };
    }

■ 解決方案

  page-engine.js 的 createPage 加上：

    /* 掛載 blocks 之後 */
    if (typeof schema.customMount === 'function') {
      try {
        ctx._customMountInstance = await schema.customMount(ctx);
      } catch (err) {
        console.error('[page-engine] customMount 執行失敗：', err);
      }
    }

  _destroy 加上：

    if (ctx._customMountInstance
        && typeof ctx._customMountInstance.destroy === 'function') {
      try { ctx._customMountInstance.destroy(); } catch (err) {}
      ctx._customMountInstance = null;
    }

■ 驗證

  訪問 input-center.html / settings.html / database.html
  → 應顯示對應 Tab 和內容

■ 教訓

  ⚠️ Page Schema 的 customMount 是重要逃生艙，
     引擎必須支援。

═══════════════════════════════════════════════════════
【P05 — _onKeyChange 缺 data. 前綴】
═══════════════════════════════════════════════════════

■ 嚴重度：🟠 高

■ 症狀

  統計卡顯示 0
  derived 不重算（Firebase 資料到達後不更新）

■ 根本原因

  依賴圖註冊的 key 帶前綴：

    deps: ['data.bankAccounts', 'state.filters']
    → _dependents['data.bankAccounts'] = ['totalBankBalance']

  但 _subscribeAllData callback 呼叫時缺前綴：

    // 錯誤
    _onKeyChange(ctx, schema, 'bankAccounts');  // ← 缺 'data.'

  結果：_dependents['bankAccounts'] 不存在
       → _markDirty 找不到 → derived 永不重算

■ 解決方案

  page-engine.js 的 _subscribeAllData：

    subscribe(cfg, ({ data, error }) => {
      if (error) {
        console.warn(`[page-engine] data.${key} 錯誤：`, error);
        return;
      }
      ctx.data[key] = data;
      _onKeyChange(ctx, schema, 'data.' + key);   // ✅ 加前綴
    });

■ 驗證

  Firebase 資料到達時，vConsole 應顯示：
    [page-engine] data.bankAccounts 更新
    [page-engine] derived 全部計算完成：['totalBankBalance', 'statsCards']

  統計卡應顯示正確數字。

■ 教訓

  ⚠️ 依賴圖註冊與事件觸發的 key 必須完全一致。

═══════════════════════════════════════════════════════
【P06 — esc 從錯誤檔導入】
═══════════════════════════════════════════════════════

■ 嚴重度：🔴 阻斷級

■ 症狀

  Console 錯誤：
    The requested module '../lib/format.js'
    does not provide an export named 'esc'

    SyntaxError: The requested module '../lib/format.js'
    does not provide an export named 'esc'

  頁面完全崩潰。

■ 根本原因

  esc 函式在 js/lib/dom.js 導出。

  js/lib/format.js 導出的是：
    formatHKD / formatNumber / roundHKD / clampAmount
    formatPercent / formatCellValue
    formatTransactionType / formatTransactionCategory
    getCategoryBadgeClass

  ❌ 不含 esc。

■ 影響檔案

  js/pages/insurance.js
  js/pages/settlements.js

  兩者都有：

    // 錯誤
    import { formatHKD, esc } from '../lib/format.js';

■ 解決方案

  拆成兩行：

    import { formatHKD } from '../lib/format.js';
    import { esc } from '../lib/dom.js';

■ 全站 esc 導入對照

  | 檔案                        | 導入來源     | 狀態 |
  |----------------------------|-------------|------|
  | database-dropdowns.js      | dom.js      | ✅ |
  | database-yearrange.js      | dom.js      | ✅ |
  | insurance.js               | dom.js      | ✅（修正後） |
  | settlements.js             | dom.js      | ✅（修正後） |
  | 其他 9 個 page             | 無需 esc    | ✅ |

■ 驗證

  訪問 insurance.html 和 settlements.html
  → 應正常顯示（vConsole 無紅色錯誤）

■ 教訓

  ⚠️ 導入前先確認函式在哪個檔案 export。
  ⚠️ esc → dom.js；format* → format.js。

═══════════════════════════════════════════════════════
【P07 — derived 對 undefined 崩潰】
═══════════════════════════════════════════════════════

■ 嚴重度：🟠 高

■ 症狀

  Console 錯誤：
    [page-engine] derived.statsCards 計算失敗：
      Cannot read properties of undefined (reading 'reduce')

    [page-engine] derived.rows 計算失敗：
      Cannot read properties of undefined (reading 'map')

■ 根本原因

  時序問題：

    Step 1：createPage 呼叫 _computeAllDerived
    Step 2：此時 Firebase 監聽器還沒回呼
    Step 3：ctx.data.members = undefined
    Step 4：compute(undefined) 拋錯

  在 member-report.js 中：

    derived: {
      rows: {
        deps: ['data.members', 'data.allIncome', 'data.allExpenses',
               'state.currentYear'],
        compute: _buildRows,
      },
      statsCards: {
        deps: ['rows', 'state.currentYear'],
        compute: _buildStats,
      },
    }

  首次計算時 members / allIncome / allExpenses 都是 undefined
  → _buildRows(undefined, undefined, undefined, year)
  → .map 崩潰

■ 解決方案

  page-engine.js 的 _computeOne 加上 undefined 檢查：

    function _computeOne(ctx, schema, name, cfg) {
      const deps = cfg.deps || [];
      const derivedDef = schema.derived || {};

      try {
        const args = deps.map((dep) => _resolveDep(ctx, dep));

        // 檢查是否有 undefined 依賴
        const hasUndefinedDep = deps.some((dep, i) => {
          if (dep.startsWith('data.')) return args[i] === undefined;
          if (dep in derivedDef) return args[i] === undefined;
          return false;
        });

        if (hasUndefinedDep) {
          ctx.derived[name] = undefined;
          return;  // 跳過，等回呼觸發重算
        }

        ctx.derived[name] = cfg.compute(...args);
      } catch (err) {
        console.error(`[page-engine] derived.${name} 計算失敗：`, err);
        ctx.derived[name] = undefined;
      }
    }

■ 用戶體驗

  首次進入頁面時，統計卡短暫空白（~300ms），
  資料到達後自動出現。這是正常行為。

  vConsole 應顯示：
    [page-engine] createPage 開始
    [page-engine] derived 全部計算完成：[]（空，因為依賴未到）
    [page-engine] createPage 完成
    [page-engine] data.members 更新
    [page-engine] data.allIncome 更新
    [page-engine] data.allExpenses 更新
    [page-engine] derived 全部計算完成：['rows', 'statsCards']
    （統計卡出現）

■ 教訓

  ⚠️ 非同步資料訂閱有「初始未到」階段，
     所有 derived 計算必須容忍 undefined。

═══════════════════════════════════════════════════════
【P08 — 手機無 Console 可看】
═══════════════════════════════════════════════════════

■ 嚴重度：🟡 中

■ 症狀

  手機瀏覽器無內建 Console。
  無法看到錯誤訊息，除錯困難。

  常見誤區：
    以為「頁面空白」= 沒錯誤
    其實錯誤在 Console 中不可見。

■ 解決方案（內嵌 vConsole）

  Step 1：新增 js/core/debug.js

    let _initialized = false;

    export function initDebug() {
      if (_initialized) return;
      _initialized = true;
      if (window.__vconsole_loaded__) return;

      const params = new URLSearchParams(location.search);
      const debugParam = params.get('debug');

      // 開發階段預設啟用
      if (debugParam === '0') return;

      // 正式上線時改用：
      // if (debugParam !== '1') return;

      window.__vconsole_loaded__ = true;

      // 全域錯誤捕獲
      window.addEventListener('error', (e) => {
        console.error('[GLOBAL ERROR]', e.message, e.filename, e.lineno);
      });
      window.addEventListener('unhandledrejection', (e) => {
        console.error('[UNHANDLED]', e.reason);
      });

      // 動態載入 vConsole
      const script = document.createElement('script');
      script.src =
        'https://cdn.jsdelivr.net/npm/vconsole@3.15.0/dist/vconsole.min.js';
      script.onload = () => {
        if (window.VConsole) {
          window.vConsole = new window.VConsole({ maxLogNumber: 2000 });
        }
      };
      document.head.appendChild(script);
    }

    export function disableDebug() {
      try {
        localStorage.setItem('__debug_off__', '1');
        if (window.vConsole && window.vConsole.destroy) {
          window.vConsole.destroy();
        }
        window.__vconsole_loaded__ = false;
      } catch (e) {}
    }

    export function enableDebug() {
      try {
        localStorage.removeItem('__debug_off__');
        location.reload();
      } catch (e) {}
    }

  Step 2：js/layout/app-shell.js 呼叫（見 P09 動態 import）

    export async function initApp({ ... } = {}) {
      // ...

      /* Debug 安全載入 */
      try {
        const mod = await import('../core/debug.js');
        if (mod && typeof mod.initDebug === 'function') {
          mod.initDebug();
        }
      } catch (err) {
        console.warn('[app-shell] debug 載入失敗（可忽略）：', err.message);
      }

      // ...
    }

■ 控制方式

  | URL         | 行為       |
  |-------------|-----------|
  | ?debug=1    | 強制啟用   |
  | ?debug=0    | 關閉（當次） |
  | 無參數      | 預設啟用   |

■ 手機使用方式

  1. 打開頁面
  2. 點右下角「綠色按鈕」（vConsole 圖示）
  3. 展開 Console 面板
  4. 查看：
     - Log 分頁（執行日誌）
     - Error 分頁（紅色錯誤）
     - Network 分頁（API 請求）

■ ⚠️ 正式上線前必做

  修改 js/core/debug.js，改為預設關閉：

    // 開發階段
    if (debugParam === '0') return;

    // 改成正式階段
    if (debugParam !== '1') return;

  這樣正式用戶不會看到 vConsole 綠點。

■ 教訓

  ⚠️ 手機除錯必須依賴 vConsole 或電腦遠端偵錯。
  ⚠️ 全域 error / unhandledrejection 監聽必須在 vConsole
     載入前註冊，才能捕獲所有錯誤。

═══════════════════════════════════════════════════════
【P09 — app-shell 靜態 import 崩潰】
═══════════════════════════════════════════════════════

■ 嚴重度：🔴 阻斷級

■ 症狀

  側邊欄完全空白
  所有頁面受影響（因為 app-shell.js 被所有頁面載入）

■ 根本原因

  js/layout/app-shell.js 頂部有：

    import { initDebug } from '../core/debug.js';  // ❌ 靜態 import

  若 debug.js 不存在（未部署）：
    → app-shell.js 載入失敗
    → initApp 從未執行
    → 側邊欄空
    → Navbar 空
    → 整站崩潰

■ 解決方案

  改為動態 import + try-catch：

    export async function initApp({ ... } = {}) {
      if (_initialized) { ... }

      /* ---------- 0. Debug 安全載入 ---------- */
      try {
        const mod = await import('../core/debug.js');
        if (mod && typeof mod.initDebug === 'function') {
          mod.initDebug();
        }
      } catch (err) {
        console.warn('[app-shell] debug 載入失敗（可忽略）：', err.message);
      }

      /* ---------- 1. PWA ---------- */
      try { initPWA(); } catch (err) { ... }

      /* ... 其他初始化 ... */
    }

■ 對照：其他 import 也應考慮

  以下 import 是「必要」的，保留靜態：

    import { renderSidebar } from './sidebar.js';
    import { renderNavbar } from './navbar.js';
    import { requireLogin } from '../core/auth-guard.js';
    import { initPWA } from '../core/pwa.js';
    import { AppState } from '../core/state.js';
    import { initAppConfig } from '../config/app-config.js';
    import { initAllRegistries } from '../lib/registry.js';

  以下 import 是「選用」的，應改動態：

    debug.js（vConsole）
    → 不影響核心功能，缺失時可忽略

■ 驗證

  訪問任意頁面：
    ✅ 側邊欄正常
    ✅ Navbar 正常
    ✅ vConsole 綠點出現（若 debug.js 存在）

  若 debug.js 不存在：
    ✅ 側邊欄仍正常（只是無 vConsole）

■ 教訓

  ⚠️ 非必要的模組一律用動態 import。
  ⚠️ 核心流程不能因為「附加功能缺失」而崩潰。

═══════════════════════════════════════════════════════
【P10 — SW stale-while-revalidate】
═══════════════════════════════════════════════════════

■ 嚴重度：🟡 中

■ 症狀

  部署新檔後：
    - 訪問頁面仍是舊版
    - 需訪問兩次才看到新版
    - 或需清快取
    - 或需無痕模式

  開發體驗極差。

■ 根本原因

  sw.js 對 JS / CSS 使用 _staleWhileRevalidate：

    if (url.pathname.endsWith('.js')
        || url.pathname.endsWith('.css')) {
      e.respondWith(_staleWhileRevalidate(e.request));
      return;
    }

  _staleWhileRevalidate 行為：
    1. 先回傳「舊快取」
    2. 背景非同步更新快取
    3. 下次訪問才是新版

  所以每次部署都需要訪問兩次。

■ 解決方案

  全部改為 network-first：

    self.addEventListener('fetch', (e) => {
      if (e.request.method !== 'GET') return;

      const url = new URL(e.request.url);
      if (url.origin !== self.location.origin) return;
      if (url.pathname.startsWith('/api/')) return;

      // 全部 network-first
      e.respondWith(_networkFirst(e.request));
    });

    async function _networkFirst(request) {
      const url = new URL(request.url);
      const isHtml = request.mode === 'navigate'
        || url.pathname.endsWith('.html')
        || url.pathname === '/'
        || url.pathname.endsWith('/');

      try {
        const res = await fetch(request);

        if (res && res.status === 200 && res.type === 'basic') {
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, res.clone());
        }
        return res;
      } catch (err) {
        const cached = await caches.match(request);
        if (cached) return cached;

        if (isHtml) {
          const fallback = await caches.match('./index.html');
          if (fallback) return fallback;
        }

        return new Response('離線中，請稍後再試', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }
    }

  CACHE_NAME 升至 v139。

■ 效能權衡

  | 項目         | 舊版（stale）      | 新版（network-first） |
  |-------------|------------------|---------------------|
  | 首次訪問     | 從網路拿（+100ms） | 從網路拿（+100ms）   |
  | 第二次訪問   | 從快取（快）       | 仍從網路拿（不用快取） |
  | 離線訪問     | 從快取             | 從快取              |
  | 頻寬消耗     | 略低               | 略增                |
  | 部署新檔後   | 需訪問兩次         | 一次即生效          |

  對開發階段完全值得。

■ 正式上線建議

  可改回 staleWhileRevalidate（效能優先），
  但需確保 CACHE_NAME 有版本號更新。

■ 教訓

  ⚠️ 開發階段用 network-first，正式階段可改 stale。

═══════════════════════════════════════════════════════
【P11 — GitHub 檔案未真正更新】
═══════════════════════════════════════════════════════

■ 嚴重度：🔴 阻斷級

■ 症狀

  本機改了 → 但線上仍是舊版 → 錯誤持續。

  以為「已經部署成功」，但實際沒有。

■ 根本原因（多種可能）

  1. push 到錯誤分支
     - 本機在 main，但 push 到 feature
     - CF 指向 main

  2. Cloudflare 指向舊分支
     - CF 設定 Production branch 為舊分支

  3. 本機檔案路徑不對
     - 編輯了 /js/pages/settlements.js
     - 但專案實際在 /my-project/js/pages/settlements.js

  4. Git 未 push
     - 只 commit，沒 push
     - 或用了 IDE 的「儲存」但沒 Git 操作

■ 解決方案（最保險）

  Step 1：直接在 GitHub 網頁編輯

    1. 登入 GitHub
    2. 進入專案（family-fin-v2）
    3. 按 . 鍵（進入線上 VS Code）
    4. 直接編輯所有檔案
    5. 一次 commit + push

    這方法不用本機 Git，最不容易出錯。

  Step 2：驗證部署

    訪問實際部署的 JS 檔案：

      https://xxx.pages.dev/js/pages/settlements.js?v=2

    ?v=2 是「快取破壞參數」，
    強制瀏覽器抓最新版本。

    看第一行：
      ❌ import { formatHKD, esc } from '../lib/format.js';
         → 舊版還在

      ✅ import { formatHKD } from '../lib/format.js';
         import { esc } from '../lib/dom.js';
         → 新版已部署

  Step 3：檢查 Cloudflare Deployments

    1. CF Dashboard → Pages 專案
    2. Deployments 分頁
    3. 看最新一次：
       - 狀態：Success / Failed
       - Commit SHA：與 GitHub 一致？

    若 Failed：
      → 點進去看 Build log
      → 截圖給 AI

■ 教訓

  ⚠️ 每次部署後，直接訪問檔案 URL 驗證。
  ⚠️ 不要只看頁面表現（快取會誤導）。
  ⚠️ GitHub 網頁編輯是最安全的部署方式。

═══════════════════════════════════════════════════════
【P12 — database.js 內容錯誤】
═══════════════════════════════════════════════════════

■ 嚴重度：🟠 高

■ 症狀

  訪問「基礎資料庫」頁面
  → 顯示「總覽儀表板」的內容

  URL 正確（database.html），但內容錯。

■ 根本原因

  js/pages/database.js 內容被誤覆蓋為 dashboard.js 的程式碼：

    // 檔案名稱：database.js
    // 內容：dashboard.js 的內容（錯誤）

    export default {
      title: '總覽儀表板',   // ← 錯誤
      data: { bankAccounts: ..., bankTransactions: ... },
      // ...
    };

■ 解決方案

  完全覆蓋 js/pages/database.js 為正確的「基礎資料庫 Schema」：

    export default {
      title: '基礎資料庫',
      data: {},
      state: { activeTab: 'members' },
      derived: {},
      blocks: [],

      customMount: (ctx) => {
        const TABS = [
          { key: 'members',    label: '成員',      icon: 'users',
            panelId: 'db-panel-members' },
          { key: 'banks',      label: '銀行',      icon: 'landmark',
            panelId: 'db-panel-banks' },
          { key: 'categories', label: '支出結構',  icon: 'tags',
            panelId: 'db-panel-categories' },
          { key: 'options',    label: '支付/狀態', icon: 'credit-card',
            panelId: 'db-panel-options' },
          { key: 'dropdowns',  label: '下拉選項',  icon: 'list-ordered',
            panelId: 'db-panel-dropdowns' },
          { key: 'yearrange',  label: '年份範圍',  icon: 'calendar',
            panelId: 'db-panel-yearrange' },
        ];

        const instances = {};

        const loadTab = async (key) => {
          // 依 key 載入對應 Tab
        };

        const tabPanel = initTabPanel({
          containerId: 'db-tab-bar-root',
          tabs: TABS,
          defaultKey: 'members',
          storageKey: 'database-tab',
          wrap: true,
          onChange: (key) => { ctx.state.activeTab = key; loadTab(key); },
        });

        loadTab(tabPanel?.getCurrent() || 'members');

        return {
          destroy: () => {
            Object.values(instances).forEach((inst) => {
              try { inst?.destroy?.(); } catch (e) {}
            });
            try { tabPanel?.destroy(); } catch (e) {}
          },
        };
      },
    };

■ 驗證

  訪問 database.html
  → 應顯示 6 個 Tab（成員 / 銀行 / 支出結構 / 支付狀態 / 下拉選項 / 年份範圍）

■ 教訓

  ⚠️ 複製貼上時務必確認目標檔案。
  ⚠️ 每次交付後，用 vConsole 看頁面 log 確認載入正確的 Schema。

═══════════════════════════════════════════════════════
【P13 — js/shared/* 舊 import 路徑】
═══════════════════════════════════════════════════════

■ 嚴重度：🔴 阻斷級

■ 症狀

  多個模組載入失敗：
    - entity-list-page.js 無法載入
    - data-table.js 無法載入
    - data-card.js 無法載入
    - bank-account-manager.js 無法載入

  Console 錯誤：
    Failed to resolve module specifier

■ 根本原因

  v103 重構後，檔案從 shared/ 移到 ui/ / entity/ / lib/：

    shared/toast.js         → ui/toast.js
    shared/modal.js         → ui/modal.js
    shared/form-builder.js  → ui/form-builder.js
    shared/tab-panel.js     → ui/tab-panel.js
    shared/view-toggle.js   → ui/view-toggle.js
    shared/collapsible-card.js → ui/collapsible.js
    shared/entity-modal.js  → entity/entity-modal.js
    shared/entity-helpers.js → entity/entity-helpers.js
    config/entity-definitions.js → entity/entity-definitions.js
    core/app.js             → layout/app-shell.js

  但 js/shared/* 的舊檔仍 import 舊路徑。

■ 影響檔案（9 個）

  | 檔案 | 舊 import | 新 import |
  |---|---|---|
  | js/shared/bank-account-manager.js | ./toast.js | ../ui/toast.js |
  |                                   | ./modal.js | ../ui/modal.js |
  |                                   | ./form-builder.js | ../ui/form-builder.js |
  | js/shared/data-card.js | ../config/entity-definitions.js | ../entity/entity-definitions.js |
  | js/shared/data-table.js | ../config/entity-definitions.js | ../entity/entity-definitions.js |
  | js/shared/entity-list-page.js | ../config/entity-definitions.js | ../entity/entity-definitions.js |
  |                                | ./entity-modal.js | ../entity/entity-modal.js |
  |                                | ./modal.js | ../ui/modal.js |
  |                                | ./toast.js | ../ui/toast.js |
  |                                | ./entity-helpers.js | ../entity/entity-helpers.js |
  |                                | ./view-toggle.js | ../ui/view-toggle.js |
  | js/shared/form-handler.js | ./toast.js | ../ui/toast.js |
  | js/ui/form-builder.js | ../shared/entity-helpers.js | ../entity/entity-helpers.js |
  | js/lib/async.js | ../shared/toast.js | ../ui/toast.js |
  |                 | ../shared/modal.js | ../ui/modal.js |
  | js/admin/admin.js | ../shared/toast.js | ../ui/toast.js |
  |                   | ../shared/modal.js | ../ui/modal.js |
  |                   | ../shared/form-builder.js | ../ui/form-builder.js |
  |                   | ../shared/tab-panel.js | ../ui/tab-panel.js |
  |                   | ../core/app.js | ../layout/app-shell.js |
  | js/admin/platform-defaults.js | ../shared/toast.js | ../ui/toast.js |
  |                               | ../shared/tab-panel.js | ../ui/tab-panel.js |
  |                               | ../shared/form-builder.js | ../ui/form-builder.js |
  |                               | ../shared/modal.js | ../ui/modal.js |

■ 解決方案

  全部按 v103 交付紀錄覆蓋。

  範例 bank-account-manager.js：

    // 舊
    import { showToast } from './toast.js';
    import { openModal, closeModal, openConfirm } from './modal.js';
    import { buildForm } from './form-builder.js';

    // 新
    import { showToast } from '../ui/toast.js';
    import { openModal, closeModal, openConfirm } from '../ui/modal.js';
    import { buildForm } from '../ui/form-builder.js';

  範例 entity-list-page.js：

    // 舊
    import { getEntityDef, getEntityUi } from '../config/entity-definitions.js';
    import { openEntityModal } from './entity-modal.js';
    import { openConfirm } from './modal.js';
    import { showToast } from './toast.js';
    import { deleteEntity, listenEntity } from './entity-helpers.js';
    import { initViewToggle } from './view-toggle.js';

    // 新
    import { getEntityDef, getEntityUi } from '../entity/entity-definitions.js';
    import { openEntityModal } from '../entity/entity-modal.js';
    import { openConfirm } from '../ui/modal.js';
    import { showToast } from '../ui/toast.js';
    import { deleteEntity, listenEntity } from '../entity/entity-helpers.js';
    import { initViewToggle } from '../ui/view-toggle.js';

■ 驗證

  訪問 database.html → 成員 Tab
  → 應正常顯示成員列表
  → vConsole 無 Failed to resolve module specifier

■ 教訓

  ⚠️ 檔案搬移後，所有 import 路徑必須同步更新。
  ⚠️ 用「全域搜尋」找出所有舊路徑：
       grep -r "shared/toast" js/
       grep -r "shared/modal" js/
       grep -r "shared/form-builder" js/
       grep -r "config/entity-definitions" js/
       grep -r "core/app" js/

═══════════════════════════════════════════════════════
【開發流程（從此以後）】
═══════════════════════════════════════════════════════

■ 修改程式

  1. 修改檔案
  2. 直接編輯：
     - GitHub 網頁（按 . 進 VS Code）← 推薦
     - 或本機 Git
  3. Commit + Push
  4. 等 Cloudflare 部署（~1 分鐘）
  5. 刷新頁面（不需清快取）

■ 除錯（手機）

  1. 手機開啟頁面
  2. 點右下角「綠色 vConsole 按鈕」
  3. 查看：
     - Log 分頁（執行日誌）
     - Error 分頁（紅色錯誤）
     - Network 分頁（API 請求）
  4. 截圖給 AI

■ 驗證部署

  訪問：
    https://xxx.pages.dev/js/pages/xxx.js?v=123

  直接看檔案內容，確認是否為最新版。

═══════════════════════════════════════════════════════
【關鍵教訓總結】
═══════════════════════════════════════════════════════

1. CF Pages Functions 路由：
   - 每個 URL 必須對應獨立實體檔案
   - 不支援跨檔 re-export shim
   - 用「底線前綴 + Catch-all」最穩定

2. CF Pages 靜態檔案：
   - 所有內部連結帶 .html
   - 不要對 / 加 _redirects
   - 檢查 Content-Type（必要時加 _headers）

3. Page Engine：
   - 必須支援 customMount
   - 事件 key 必須與依賴圖一致
   - derived 計算必須容忍 undefined

4. Import 路徑：
   - esc → dom.js
   - format* → format.js
   - 檔案搬移後全域搜尋舊路徑

5. Service Worker：
   - 開發階段用 network-first
   - 正式階段可改 stale-while-revalidate
   - CACHE_NAME 要有版本號

6. 除錯：
   - 手機必須內嵌 vConsole
   - 非必要模組用動態 import
   - 全域 error / unhandledrejection 監聽

7. 部署驗證：
   - 直接訪問檔案 URL 驗證
   - 不要只看頁面表現
   - GitHub 網頁編輯最安全

═══════════════════════════════════════════════════════
【結束】
═══════════════════════════════════════════════════════