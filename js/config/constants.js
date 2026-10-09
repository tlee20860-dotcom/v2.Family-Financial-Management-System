// ============================================
// constants.js — 全站常數集中管理（v103.0.3）
// 位置：js/config/constants.js
// ============================================
// v103.0.3 修正：
//   ✅ SIDEBAR_GROUPS 所有 href 加上 .html（避免 CF Pages 匹配 .js）
// ============================================

/* ============================================
   0. 版本號
   ============================================ */
export const APP_VERSION = 'v103.0.3';
export const SW_VERSION = 'family-fin-v137';

/* ============================================
   1. localStorage Keys
   ============================================ */
export const STORAGE_KEYS = {
  YEAR: 'fin_year',
  MONTH: 'fin_month',
  FAMILY_ID: 'fin_family_id',
  FAMILY_NAME: 'fin_family_name',

  SIDEBAR_ORDER: 'fin_sidebar_order',
  SIDEBAR_COLLAPSED: 'fin_ui_sidebar_collapsed',
  SIDEBAR_GROUPS: 'fin_ui_sidebar_groups',
  MEMBERS_GROUP_OPEN: 'fin_ui_members_group_open',

  STATS_MODE: 'fin_ui_stats_mode',

  UI_PREFIX: 'fin_ui_',
};

export const STORAGE_PREFIXES = {
  UI: 'fin_ui_',
  COLUMN_SETTINGS: 'fin_ui_columns_',
  COLLAPSE: 'fin_ui_collapse_',
  VIEW: 'fin_ui_view_',
  AUTH_CONTEXT: 'fin_auth_context_',
  APP_CONFIG: 'fin_app_config_cache_',
  BANK_CACHE: 'fin_bank_cache_',
};

/* ============================================
   2. sessionStorage Keys
   ============================================ */
export const SESSION_KEYS = {
  AUTH_CONTEXT_PREFIX: 'fin_auth_context_',
  APP_CONFIG_PREFIX: 'fin_app_config_cache_',
  BANK_CACHE_PREFIX: 'fin_bank_cache_',
};

export const AUTH_CONTEXT_TTL_MS = 5 * 60 * 1000;
export const APP_CONFIG_TTL_MS   = 5 * 60 * 1000;
export const BANK_CACHE_TTL_MS   = 2 * 60 * 1000;

/* ============================================
   3. 數值限制
   ============================================ */
export const LIMITS = {
  NAME_MAX_LEN_DESKTOP: 12,
  NAME_MAX_LEN_MOBILE: 6,
  NAME_INPUT_MAX: 60,
  NOTE_MAX: 200,
  AMOUNT_MAX: 1_000_000_000,
  YEAR_PAST_DEFAULT: 3,
  YEAR_FUTURE_DEFAULT: 5,
  TOAST_DURATION_DEFAULT: 2000,
  PAGE_FILTER_MONTH_DEFAULT: 'all',
  DEFAULT_TABLE_PAGE_SIZE: 20,
  RECENT_LIST_LIMIT: 20,
};

/* ============================================
   4. 保留 ID
   ============================================ */
export const RESERVED_IDS = {
  EXTRA_INCOME: 'extra',
  SHARED_MEMBER: 'shared',
};

/* ============================================
   5. 角色 / 來源
   ============================================ */
export const ROLES = {
  SUPERADMIN: 'superadmin',
  OWNER: 'owner',
  MEMBER: 'member',
};

export const SOURCES = {
  PERSONAL: 'personal',
  FIXED: 'fixed',
  INSURANCE: 'insurance',
  INCOME: 'income',
};

/* ============================================
   6. 保險連動前綴
   ============================================ */
export const LINKED_PREFIX = 'linked_';

export function buildLinkedKey(policyId) {
  return `${LINKED_PREFIX}${policyId}`;
}

export function isLinkedKey(key) {
  return typeof key === 'string' && key.startsWith(LINKED_PREFIX);
}

/* ============================================
   7. 銀行交易類型
   ============================================ */
export const BANK_TXN_TYPES = {
  IN: 'in',
  OUT: 'out',
  TRANSFER: 'transfer',
};

export const BANK_TXN_TYPE_LABELS = {
  in: '入帳',
  out: '出帳',
  transfer: '內部轉帳',
};

/* ============================================
   8. 銀行交易分類
   ============================================ */
export const BANK_TXN_CATEGORIES = {
  CONTRIBUTION: 'contribution',
  EXPENSE: 'expense',
  INSURANCE: 'insurance',
  REIMBURSEMENT: 'reimbursement',
  MANUAL: 'manual',
};

export const BANK_TXN_CATEGORY_LABELS = {
  contribution: '家用轉入',
  expense: '支出',
  insurance: '保險',
  reimbursement: '代墊報銷',
  manual: '手動',
};

export const BANK_TXN_CATEGORY_BADGES = {
  contribution: 'badge-success',
  expense: 'badge-pending',
  insurance: 'badge-magenta',
  reimbursement: 'badge-info',
  manual: 'badge-muted',
};

/* ============================================
   9. 銀行帳號類型
   ============================================ */
export const BANK_ACCOUNT_TYPES = {
  FAMILY: 'family',
  PERSONAL: 'personal',
};

export const BANK_ACCOUNT_TYPE_LABELS = {
  family: '家庭帳號',
  personal: '個人帳號',
};

/* ============================================
   10. 保單付款模式
   ============================================ */
export const PAYMENT_MODES = {
  DIRECT: 'direct',
  ADVANCE: 'advance',
};

export const PAYMENT_MODE_LABELS = {
  direct: '直接付款',
  advance: '代墊模式',
};

/* ============================================
   11. 平台資源對照表
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
   12. 實體識別碼
   ============================================ */
export const ENTITY_KEYS = {
  MEMBER:   'member',
  BANK:     'bank',
  POLICY:   'policy',
  FUND:     'fund',
  CATEGORY: 'category',
  ITEM:     'item',
  PAYMENT:  'payment',
  STATUS:   'status',
};

/* ============================================
   13. 狀態 badge class 對照
   ============================================ */
export const STATUS_BADGE_CLASS = {
  done:    'badge-success',
  pending: 'badge-pending',
  skipped: 'badge-muted',
  info:    'badge-info',
};

export function getStatusBadgeClass(isDone, isSkipped = false) {
  if (isSkipped) return STATUS_BADGE_CLASS.skipped;
  return isDone ? STATUS_BADGE_CLASS.done : STATUS_BADGE_CLASS.pending;
}

/* ============================================
   14. policyHolderId fallback 規則
   ============================================ */
export const POLICY_HOLDER_FALLBACK = {
  primary: 'policyHolderId',
  fallback: 'memberId',
};

export function getPolicyEffectiveMemberId(policy) {
  if (!policy) return '';
  return policy.policyHolderId || policy.memberId || '';
}

/* ============================================
   15. 表格欄位設定前綴
   ============================================ */
export const COLUMN_SETTINGS_PREFIX = 'fin_ui_columns_';

export function buildColumnSettingsKey(tableId) {
  return `${COLUMN_SETTINGS_PREFIX}${tableId}`;
}

/* ============================================
   16. 帳號網域
   ============================================ */
export const SUPERADMIN_DOMAIN = '@familyfin.local';
export const SUPERADMIN_EMAIL  = `superadmin${SUPERADMIN_DOMAIN}`;

/* ============================================
   17. 預設狀態清單
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
   18. 預設下拉選項
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
  paymentModes: [
    { value: 'direct',  label: '直接付款（家庭帳號扣款）' },
    { value: 'advance', label: '代墊模式（成員墊付，家庭月攤）' },
  ],
  categoryOrder: ['銀行類', '醫療類', '學校類', '保險類', '固定費用類', '交通類', '其他'],
};

export const DEFAULT_YEAR_RANGE = {
  startYear: null,
  futureYears: LIMITS.YEAR_FUTURE_DEFAULT,
};

export const DEFAULT_UI_CONSTANTS = {
  nameMaxLenDesktop: LIMITS.NAME_MAX_LEN_DESKTOP,
  nameMaxLenMobile:  LIMITS.NAME_MAX_LEN_MOBILE,
  toastDuration:     LIMITS.TOAST_DURATION_DEFAULT,
};

export const DEFAULT_COMPANIES = ['富通', '保誠', 'FWD', 'AIA', '宏利', 'AXA'];

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
   19. 側邊欄分類群組
   -------------------------------------------------
   🔧 v103.0.3：所有 href 加上 .html
       避免 CF Pages 路由匹配到 .js 檔案
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
    key: 'insurance-fund',
    label: '保險與基金',
    icon: 'shield',
    defaultOpen: false,
    items: [
      { icon: 'shield',     label: '保險清單表', href: 'insurance.html' },
      { icon: 'line-chart', label: '基金投資表', href: 'portfolio.html' },
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
      { icon: 'landmark', label: '銀行交易', href: 'finance-overview.html' },
    ],
  },
  {
    key: 'reports',
    label: '報表',
    icon: 'bar-chart-3',
    defaultOpen: false,
    items: [
      { icon: 'bar-chart-3', label: '年度報表', href: 'annual-report.html' },
      { icon: 'users',       label: '成員與家庭收入與支出明細', href: 'member-report.html' },
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
   20. 路由 / 頁面清單
   ============================================ */
export const ROUTES = {
  LOGIN:            'login.html',
  REGISTER:         'register.html',
  DASHBOARD:        'index.html',
  ADMIN:            'admin.html',
  INPUT_CENTER:     'input-center.html',
  DATABASE:         'database.html',
  INSURANCE:        'insurance.html',
  PORTFOLIO:        'portfolio.html',
  SETTLEMENTS:      'settlements.html',
  FINANCE_OVERVIEW: 'finance-overview.html',
  ANNUAL_REPORT:    'annual-report.html',
  MEMBER_REPORT:    'member-report.html',
  SETTINGS:         'settings.html',
};

export const SHOW_YEAR_MONTH_PAGES = [
  ROUTES.INSURANCE,
  ROUTES.PORTFOLIO,
  ROUTES.SETTLEMENTS,
  ROUTES.FINANCE_OVERVIEW,
  ROUTES.MEMBER_REPORT,
];

/* ============================================
   21. 快速摘要卡類型
   ============================================ */
export const QUICK_SUMMARY_TYPES = {
  TOP_CATEGORIES:   'top-categories',
  RECENT_ACTIVITY:  'recent-activity',
  MEMBER_TREND:     'member-trend',
  PENDING_FIXED:    'pending-fixed',
  ASSET_PIE:        'asset-pie',
};

/* ============================================
   22. 狀態分類
   ============================================ */
export const STATUS_CATEGORIES = {
  PERSONAL:  'personal',
  FIXED:     'fixed',
  INSURANCE: 'insurance',
};