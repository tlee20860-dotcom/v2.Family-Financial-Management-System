// ============================================
// constants.js — 全站常數集中管理（v101.7.2）
// ============================================
// v101.7.2 新增：
//   ✅ STORAGE_KEYS.STATS_MODE（統計卡顯示模式）
// ============================================

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

  // 🆕 v101.7.2：統計卡顯示模式（auto / integrated / compact）
  STATS_MODE: 'fin_ui_stats_mode',

  UI_PREFIX: 'fin_ui_',
};

/* ============================================
   2. 數值限制
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
   3. 保留 ID
   ============================================ */
export const RESERVED_IDS = {
  EXTRA_INCOME: 'extra',
  SHARED_MEMBER: 'shared',
};

/* ============================================
   4. 保險連動前綴
   ============================================ */
export const LINKED_PREFIX = 'linked_';

export function buildLinkedKey(policyId) {
  return `${LINKED_PREFIX}${policyId}`;
}

export function isLinkedKey(key) {
  return typeof key === 'string' && key.startsWith(LINKED_PREFIX);
}

/* ============================================
   5. 平台資源對照表
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
   6. 實體識別碼
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
   7. 狀態 badge class 對照
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
   8. policyHolderId fallback 規則
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
   9. 表格欄位設定前綴
   ============================================ */
export const COLUMN_SETTINGS_PREFIX = 'fin_ui_columns_';

export function buildColumnSettingsKey(tableId) {
  return `${COLUMN_SETTINGS_PREFIX}${tableId}`;
}

/* ============================================
   10. 帳號網域
   ============================================ */
export const SUPERADMIN_DOMAIN = '@familyfin.local';
export const SUPERADMIN_EMAIL = `superadmin${SUPERADMIN_DOMAIN}`;

/* ============================================
   11. 預設狀態清單
   ============================================ */
export const DEFAULT_STATUSES = [
  { key: 'status_untreated', name: '未處理', category: 'personal',  isDone: false, order: 1 },
  { key: 'status_done',      name: '已處理', category: 'personal',  isDone: true,  order: 2 },
  { key: 'status_unrepaid',  name: '未還款', category: 'personal',  isDone: false, order: 3 },
  { key: 'status_repaid',    name: '已還款', category: 'personal',  isDone: true,  order: 4 },
  // legacy
  { key: 'status_unpaid',    name: '未付款', category: 'fixed',     isDone: false, order: 5 },
  { key: 'status_paid',      name: '已付款', category: 'fixed',     isDone: true,  order: 6 },
  { key: 'status_na',        name: '不適用', category: 'fixed',     isDone: true,  order: 7 },
  // insurance
  { key: 'status_unbilled',  name: '未扣款', category: 'insurance', isDone: false, order: 8 },
  { key: 'status_billed',    name: '已扣款', category: 'insurance', isDone: true,  order: 9 },
];

/* ============================================
   12. 預設下拉選項
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

export const DEFAULT_YEAR_RANGE = {
  startYear: null,
  futureYears: LIMITS.YEAR_FUTURE_DEFAULT,
};

export const DEFAULT_UI_CONSTANTS = {
  nameMaxLenDesktop: LIMITS.NAME_MAX_LEN_DESKTOP,
  nameMaxLenMobile: LIMITS.NAME_MAX_LEN_MOBILE,
  toastDuration: LIMITS.TOAST_DURATION_DEFAULT,
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
   13. 側邊欄分類群組
   ============================================ */
export const SIDEBAR_GROUPS = [
  { key: 'overview', label: '總覽', icon: 'home', defaultOpen: true,
    items: [{ icon: 'home', label: '總覽儀表板', href: 'index.html' }] },
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
    items: [{ icon: 'clipboard-check', label: '結算清單', href: 'settlements.html' }] },
  { key: 'assets', label: '資產', icon: 'landmark', defaultOpen: false,
    items: [{ icon: 'landmark', label: '財務總覽', href: 'finance-overview.html' }] },
  { key: 'reports', label: '報表', icon: 'bar-chart-3', defaultOpen: false,
    items: [
      { icon: 'bar-chart-3', label: '年度報表', href: 'annual-report.html' },
      { icon: 'users',       label: '成員與家庭收入與支出明細', href: 'member-report.html' },
    ] },
  { key: 'system', label: '系統', icon: 'settings', defaultOpen: false,
    items: [{ icon: 'settings', label: '系統設定', href: 'settings.html' }] },
];

/* ============================================
   14. 快速摘要卡類型
   ============================================ */
export const QUICK_SUMMARY_TYPES = {
  TOP_CATEGORIES: 'top-categories',
  RECENT_ACTIVITY: 'recent-activity',
  MEMBER_TREND: 'member-trend',
  PENDING_FIXED: 'pending-fixed',
  ASSET_PIE: 'asset-pie',
};

/* ============================================
   15. 狀態分類
   ============================================ */
export const STATUS_CATEGORIES = {
  PERSONAL: 'personal',
  FIXED: 'fixed',        // ⚠️ legacy
  INSURANCE: 'insurance',
};