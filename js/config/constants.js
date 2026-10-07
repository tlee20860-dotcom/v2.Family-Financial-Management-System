// ============================================
// constants.js — 全站常數集中管理（v101.5）
// ============================================
// v101.5 修正：
//   ✅ 新增 LINKED_PREFIX（保險連動支出 key 前綴，與後端統一）
//   ✅ 新增 PLATFORM_RESOURCES（前端/後端共用的資源對照表）
//   ✅ 新增 ENTITY_KEYS（entity-definitions.js 的實體識別碼）
//   ✅ 新增 STATUS_BADGE_CLASS（狀態 badge class 對照）
//   ✅ 新增 UI_PREFIX_FULL（完整前綴，避免各模組重複拼字串）
//   ✅ 新增 POLICY_HOLDER_FALLBACK（policyHolderId fallback 規則說明）
// ============================================

/* ============================================
   1. localStorage Keys
   ============================================ */
export const STORAGE_KEYS = {
  // 核心狀態
  YEAR: 'fin_year',
  MONTH: 'fin_month',
  FAMILY_ID: 'fin_family_id',
  FAMILY_NAME: 'fin_family_name',

  // 側邊欄
  SIDEBAR_ORDER: 'fin_sidebar_order',
  SIDEBAR_COLLAPSED: 'fin_ui_sidebar_collapsed',
  SIDEBAR_GROUPS: 'fin_ui_sidebar_groups',
  MEMBERS_GROUP_OPEN: 'fin_ui_members_group_open',

  // UI 動態 key 前綴（{PREFIX}{page}-input-open / {PREFIX}{page}-table-open）
  UI_PREFIX: 'fin_ui_',
};

/* ============================================
   2. 數值限制
   ============================================ */
export const LIMITS = {
  NAME_MAX_LEN_DESKTOP: 12,       // 桌面名稱截斷字元數
  NAME_MAX_LEN_MOBILE: 6,         // 手機名稱截斷字元數
  NAME_INPUT_MAX: 60,             // 名稱輸入最大長度
  NOTE_MAX: 200,                  // 備註最大長度
  AMOUNT_MAX: 1_000_000_000,      // 金額上限（十億）
  YEAR_PAST_DEFAULT: 3,           // 年份往回至少顯示 N 年
  YEAR_FUTURE_DEFAULT: 5,         // 年份往後顯示 N 年
  TOAST_DURATION_DEFAULT: 2000,   // Toast 顯示毫秒
  PAGE_FILTER_MONTH_DEFAULT: 'all', // 頁面篩選月預設值
};

/* ============================================
   3. 保留 ID（避免與使用者資料衝突）
   ============================================ */
export const RESERVED_IDS = {
  EXTRA_INCOME: 'extra',      // 額外收入（成員維度特殊鍵）
  SHARED_MEMBER: 'shared',    // 家庭共用支出
};

/* ============================================
   4. 🆕 v101.5：保險連動前綴
   -------------------------------------------------
   保險同步時，會在成員支出下建立一筆 linked_{policyId} 的紀錄。
   前端（db.js）與後端（insurance-sync.js）必須使用同一個前綴。
   ============================================ */
export const LINKED_PREFIX = 'linked_';

/**
 * 產生保險連動的支出 key
 * @param {string} policyId
 * @returns {string} `linked_{policyId}`
 */
export function buildLinkedKey(policyId) {
  return `${LINKED_PREFIX}${policyId}`;
}

/**
 * 判斷是否為保險連動的支出 key
 * @param {string} key
 * @returns {boolean}
 */
export function isLinkedKey(key) {
  return typeof key === 'string' && key.startsWith(LINKED_PREFIX);
}

/* ============================================
   5. 🆕 v101.5：平台資源對照表
   -------------------------------------------------
   前端短名 → 實際 RTDB 路徑
   前端（db.js）與後端（platform-defaults.js）共用。
   ============================================ */
export const PLATFORM_RESOURCES = {
  members:     { path: 'members',             type: 'list' },
  banks:       { path: 'banks',               type: 'list' },
  companies:   { path: 'insurance_companies', type: 'list' },
  payments:    { path: 'payment_methods',     type: 'list' },
  categories:  { path: 'expense_categories',  type: 'list' },
  items:       { path: 'expense_items',       type: 'list' },
  statuses:    { path: 'statuses',            type: 'list' },
  options:     { path: 'options',             type: 'object' },
  yearRange:   { path: 'year_range',          type: 'object' },
  uiConstants: { path: 'ui_constants',        type: 'object' },
};

/* ============================================
   6. 🆕 v101.5：實體識別碼
   -------------------------------------------------
   對應 entity-definitions.js 的 entityKey。
   ============================================ */
export const ENTITY_KEYS = {
  MEMBER:         'member',
  BANK:           'bank',
  POLICY:         'policy',
  FUND:           'fund',
  CATEGORY:       'category',
  ITEM:           'item',
  PAYMENT:        'payment',
  STATUS:         'status',
  FIXED_TEMPLATE: 'fixedTemplate',
};

/* ============================================
   7. 🆕 v101.5：狀態 badge class 對照
   -------------------------------------------------
   統一全站 badge 樣式，避免各頁硬編碼。
   ============================================ */
export const STATUS_BADGE_CLASS = {
  done:    'badge-success',
  pending: 'badge-pending',
  skipped: 'badge-muted',
  info:    'badge-info',
};

/**
 * 依狀態名稱與 isDone 取得 badge class
 * @param {boolean} isDone
 * @param {boolean} [isSkipped]
 * @returns {string}
 */
export function getStatusBadgeClass(isDone, isSkipped = false) {
  if (isSkipped) return STATUS_BADGE_CLASS.skipped;
  return isDone ? STATUS_BADGE_CLASS.done : STATUS_BADGE_CLASS.pending;
}

/* ============================================
   8. 🆕 v101.5：policyHolderId fallback 規則
   -------------------------------------------------
   保單的「有效成員 ID」= policyHolderId || memberId
   全站統一使用這個函式，避免三處不一致。
   ============================================ */
export const POLICY_HOLDER_FALLBACK = {
  primary: 'policyHolderId',
  fallback: 'memberId',
};

/**
 * 取得保單的有效成員 ID
 * @param {Object} policy
 * @returns {string}
 */
export function getPolicyEffectiveMemberId(policy) {
  if (!policy) return '';
  return policy.policyHolderId || policy.memberId || '';
}

/* ============================================
   9. 帳號網域
   ============================================ */
export const SUPERADMIN_DOMAIN = '@familyfin.local';
export const SUPERADMIN_EMAIL = `superadmin${SUPERADMIN_DOMAIN}`;

/* ============================================
   10. 預設狀態清單（fallback）
   ============================================ */
export const DEFAULT_STATUSES = [
  { key: 'status_untreated', name: '未處理', category: 'personal',  isDone: false, order: 1 },
  { key: 'status_done',      name: '已處理', category: 'personal',  isDone: true,  order: 2 },
  { key: 'status_unrepaid',  name: '未還款', category: 'personal',  isDone: false, order: 3 },
  { key: 'status_repaid',    name: '已還款', category: 'personal',  isDone: true,  order: 4 },
  { key: 'status_unpaid',    name: '未付款', category: 'fixed',     isDone: false, order: 5 },
  { key: 'status_paid',      name: '已付款', category: 'fixed',     isDone: true,  order: 6 },
  { key: 'status_na',        name: '不適用', category: 'fixed',     isDone: true,  order: 7 },
  { key: 'status_unbilled',  name: '未扣款', category: 'insurance', isDone: false, order: 8 },
  { key: 'status_billed',    name: '已扣款', category: 'insurance', isDone: true,  order: 9 },
];

/* ============================================
   11. 預設下拉選項（fallback）
   ============================================ */
export const DEFAULT_OPTIONS = {
  memberRoles: [
    { value: 'husband', label: '老公 / 丈夫' },
    { value: 'wife',    label: '老婆 / 妻子' },
    { value: 'child',   label: '子女' },
    { value: 'other',   label: '其他' },
  ],
  cycles: [
    { value: '每月',    label: '每月' },
    { value: '每2個月', label: '每2個月' },
    { value: '每季',    label: '每季' },
    { value: '每年',    label: '每年' },
    { value: '一次性',  label: '一次性' },
  ],
  policyTypes: [
    { value: 'normal',         label: '普通保險（住院 / 人壽 / 意外）' },
    { value: 'fund_insurance', label: '基金保險（投資型，月供）' },
  ],
  insurancePaymentTypes: [
    { value: '年繳',     label: '年繳' },
    { value: '月繳',     label: '月繳' },
    { value: '一次付款', label: '一次付款' },
  ],
  categoryOrder: ['銀行類', '醫療類', '學校類', '保險類', '固定費用類', '交通類', '其他'],
};

/* ============================================
   12. 預設年份範圍（fallback）
   ============================================ */
export const DEFAULT_YEAR_RANGE = {
  startYear: null,                              // null → 動態計算（當前年 - 3）
  futureYears: LIMITS.YEAR_FUTURE_DEFAULT,
};

/* ============================================
   13. 預設 UI 常數（fallback）
   ============================================ */
export const DEFAULT_UI_CONSTANTS = {
  nameMaxLenDesktop: LIMITS.NAME_MAX_LEN_DESKTOP,
  nameMaxLenMobile: LIMITS.NAME_MAX_LEN_MOBILE,
  toastDuration: LIMITS.TOAST_DURATION_DEFAULT,
};

/* ============================================
   14. 預設保險公司（fallback）
   ============================================ */
export const DEFAULT_COMPANIES = ['富通', '保誠', 'FWD', 'AIA', '宏利', 'AXA'];

/* ============================================
   15. 新家庭初始化預設值（fallback）
   ============================================ */
export const DEFAULT_MEMBERS = [
  { name: '成員1', role: 'husband', order: 0 },
  { name: '成員2', role: 'wife',    order: 1 },
  { name: '成員3', role: 'child',   order: 2 },
  { name: '成員4', role: 'child',   order: 3 },
];

export const DEFAULT_CATEGORIES = [
  { key: 'cat_medical',   name: '醫療類',     order: 1 },
  { key: 'cat_school',    name: '學校類',     order: 2 },
  { key: 'cat_insurance', name: '保險類',     order: 3 },
  { key: 'cat_fixed',     name: '固定費用類', order: 4 },
  { key: 'cat_other',     name: '其他',       order: 5 },
];

export const DEFAULT_ITEMS = [
  { categoryKey: 'cat_medical',   name: '看病-一般' },
  { categoryKey: 'cat_medical',   name: '看病-專科' },
  { categoryKey: 'cat_medical',   name: '牙醫' },
  { categoryKey: 'cat_medical',   name: '藥費' },
  { categoryKey: 'cat_school',    name: '學費' },
  { categoryKey: 'cat_school',    name: '功課輔導班' },
  { categoryKey: 'cat_school',    name: '興趣班' },
  { categoryKey: 'cat_school',    name: '書本費' },
  { categoryKey: 'cat_school',    name: '校車費' },
  { categoryKey: 'cat_insurance', name: '住院保險' },
  { categoryKey: 'cat_insurance', name: '人壽保險' },
  { categoryKey: 'cat_insurance', name: '意外保險' },
  { categoryKey: 'cat_fixed',     name: '水費' },
  { categoryKey: 'cat_fixed',     name: '電費' },
  { categoryKey: 'cat_fixed',     name: '煤氣費' },
  { categoryKey: 'cat_fixed',     name: '管理費' },
  { categoryKey: 'cat_fixed',     name: '房租' },
  { categoryKey: 'cat_other',     name: '其他' },
];

export const DEFAULT_PAYMENTS = [
  { name: '現金',   order: 1 },
  { name: '中銀',   order: 2 },
  { name: '匯豐',   order: 3 },
  { name: '恆生',   order: 4 },
  { name: '信用卡', order: 5 },
];

/* ============================================
   16. 側邊欄分類群組（工作流）
   ============================================ */
export const SIDEBAR_GROUPS = [
  {
    key: 'overview',
    label: '總覽',
    icon: 'home',
    defaultOpen: true,
    items: [
      { icon: 'home', label: '總覽儀表板', href: 'index.html' },
    ],
  },
  {
    key: 'record',
    label: '記錄中心',
    icon: 'pencil',
    defaultOpen: true,
    items: [
      { icon: 'pencil',   label: '綜合輸入中心', href: 'input-center.html' },
      { icon: 'database', label: '基礎資料庫',   href: 'database.html' },
    ],
  },
  {
    key: 'members',
    label: '成員與收入',
    icon: 'users',
    defaultOpen: true,
    hasMembersSub: true,   // 標記需插入「成員版面」子群組
    items: [
      { icon: 'dollar-sign', label: '每月收入', href: 'income.html' },
    ],
  },
  {
    key: 'expenses',
    label: '支出',
    icon: 'file-text',
    defaultOpen: false,
    items: [
      { icon: 'user',      label: '個人支出', href: 'personal-expenses.html' },
      { icon: 'file-text', label: '固定支出', href: 'fixed-expenses.html' },
      { icon: 'shield',    label: '保險付款', href: 'insurance.html' },
    ],
  },
  {
    key: 'settle',
    label: '對帳',
    icon: 'clipboard-check',
    defaultOpen: false,
    items: [
      { icon: 'clipboard-check', label: '結算清單', href: 'settlements.html' },
    ],
  },
  {
    key: 'assets',
    label: '資產',
    icon: 'landmark',
    defaultOpen: false,
    items: [
      { icon: 'landmark',   label: '銀行管理', href: 'banks.html' },
      { icon: 'line-chart', label: '基金投資', href: 'portfolio.html' },
    ],
  },
  {
    key: 'reports',
    label: '報表',
    icon: 'bar-chart-3',
    defaultOpen: false,
    items: [
      { icon: 'bar-chart-3', label: '年度報表', href: 'annual-report.html' },
    ],
  },
  {
    key: 'system',
    label: '系統',
    icon: 'settings',
    defaultOpen: false,
    items: [
      { icon: 'settings', label: '系統設定', href: 'settings.html' },
    ],
  },
];

/* ============================================
   17. 快速摘要卡類型
   ============================================ */
export const QUICK_SUMMARY_TYPES = {
  TOP_CATEGORIES: 'top-categories',
  RECENT_ACTIVITY: 'recent-activity',
  MEMBER_TREND: 'member-trend',
  PENDING_FIXED: 'pending-fixed',
  ASSET_PIE: 'asset-pie',
};

/* ============================================
   18. 狀態分類
   ============================================ */
export const STATUS_CATEGORIES = {
  PERSONAL: 'personal',
  FIXED: 'fixed',
  INSURANCE: 'insurance',
};