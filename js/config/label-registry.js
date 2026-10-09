// ============================================
// label-registry.js — 顯示文字 SSOT（v103.0.0）
// 位置：js/config/label-registry.js
// ============================================
// 職責：
//   1. 集中管理全站顯示文字（中文）
//   2. 提供 L(path, params) 取用 API
//   3. 支援參數替換（{name} / {n} 等）
//
// 設計原則：
//   - 任何 UI 文字只存在此處
//   - 依用途分類（common / pages / fields / actions / ...）
//   - 支援巢狀路徑（'pages.settlements'）
// ============================================

/* ============================================
   1. 文字表
   ============================================ */
export const LABELS = {

  /* ---------- 通用 ---------- */
  common: {
    yes:        '是',
    no:         '否',
    ok:         '確定',
    cancel:     '取消',
    save:       '儲存',
    delete:     '刪除',
    edit:       '編輯',
    add:        '新增',
    reset:      '重置',
    close:      '關閉',
    back:       '返回',
    confirm:    '確認',
    loading:    '載入中…',
    submitting: '處理中…',
    noData:     '尚無資料',
    unknown:    '未知',
    unnamed:    '（未命名）',
    all:        '全部',
    none:       '—',
  },

  /* ---------- 頁面標題 ---------- */
  pages: {
    dashboard:        '總覽儀表板',
    portfolio:        '基金投資表',
    annualReport:     '年度報表',
    settings:         '系統設定',
    financeOverview:  '銀行交易',
    memberReport:     '成員與家庭收入與支出明細',
    inputCenter:      '綜合輸入中心',
    database:         '基礎資料庫',
    settlements:      '結算清單',
    insurance:        '保險清單表',
    admin:            '平台管理',
    login:            '登入',
    register:         '註冊',
  },

  /* ---------- 欄位 ---------- */
  fields: {
    name:            '名稱',
    member:          '成員',
    year:            '年份',
    month:           '月份',
    date:            '日期',
    amount:          '金額',
    status:          '狀態',
    category:        '類別',
    item:            '項目',
    paymentMethod:   '支付方式',
    bank:            '銀行',
    bankAccount:     '銀行帳號',
    policy:          '保單',
    fund:            '基金',
    company:         '保險公司',
    note:            '備註',
    order:           '排序',
    role:            '角色',
    displayName:     '顯示名稱',
    account:         '帳號',
    password:        '密碼',
    createdAt:       '建立時間',
    updatedAt:       '更新時間',
    source:          '來源',
    type:            '類型',
    progress:        '進度',
  },

  /* ---------- 動作 ---------- */
  actions: {
    addMember:           '新增成員',
    addBank:             '新增銀行',
    addPolicy:           '新增保單',
    addFund:             '新增基金',
    addExpense:          '新增支出',
    addContribution:     '家用轉入',
    addPersonalIncome:   '個人收入',
    addTransaction:      '新增交易',
    addBankAccount:      '新增銀行帳號',
    syncAll:             '同步所有支出',
    exportExcel:         '匯出 Excel',
    logout:              '登出',
    manageAccounts:      '管理帳號',
    initFamily:          '初始化',
    deleteFamily:        '刪除',
    clearOldBalances:    '清除舊銀行結餘資料',
  },

  /* ---------- 確認對話框 ---------- */
  confirm: {
    logoutTitle:        '登出',
    logoutMessage:      '確定要登出嗎？',
    deleteTitle:        '刪除',
    deleteMemberTitle:  '刪除成員',
    deletePolicyTitle:  '刪除保單',
    deleteFundTitle:    '刪除基金',
    initFamilyTitle:    '初始化家庭',
    deleteFamilyTitle:  '刪除家庭',
    clearOldBalancesTitle: '清除舊銀行結餘',
  },

  /* ---------- Toast 訊息 ---------- */
  toast: {
    saved:           '✅ 已儲存',
    updated:         '✅ 已更新',
    added:           '✅ 已新增',
    deleted:         '✅ 已刪除',
    saveFailed:      '儲存失敗',
    updateFailed:    '更新失敗',
    addFailed:       '新增失敗',
    deleteFailed:    '刪除失敗',
    loadFailed:      '載入失敗',
    noChanges:       '沒有變更',
    networkError:    '網路錯誤',
    loginExpired:    '登入已過期，請重新登入',
  },

  /* ---------- 空狀態 ---------- */
  emptyState: {
    noMembers:       '尚無成員',
    noBanks:         '尚無銀行',
    noPolicies:      '尚無保單資料',
    noFunds:         '尚無基金持倉',
    noExpenses:      '尚無支出紀錄',
    noTransactions:  '尚無交易記錄',
    noData:          '尚無資料',
    noResults:       '此條件下無結果',
  },

  /* ---------- 側邊欄 / 導覽 ---------- */
  nav: {
    brand:           '◈ FAMILY.FIN',
    menuToggle:      '切換選單',
    yearLabel:       '年份',
    monthLabel:      '月份',
  },

  /* ---------- 角色 / 權限 ---------- */
  roles: {
    superadmin:      '超級管理員',
    owner:           '家庭擁有者',
    member:          '家庭成員',
    readonly:        '唯讀',
  },
};

/* ============================================
   2. 取用 API
   ============================================ */

/**
 * 依路徑取得文字，支援參數替換
 *
 * 用法：
 *   L('common.yes')                          → '是'
 *   L('pages.dashboard')                     → '總覽儀表板'
 *   L('toast.loadFailed', { name: '成員' })  → '載入失敗：成員'
 *
 * @param {string} path - 點分隔路徑，例如 'pages.dashboard'
 * @param {Object} [params] - 參數替換（{key} → value）
 * @returns {string}
 */
export function L(path, params) {
  if (!path) return '';

  const parts = String(path).split('.');
  let node = LABELS;

  for (const part of parts) {
    if (node == null) break;
    node = node[part];
  }

  // 找不到 → 回傳路徑本身（方便除錯）
  if (typeof node !== 'string') {
    console.warn(`[label-registry] 找不到文字路徑：${path}`);
    return path;
  }

  // 參數替換
  if (params && typeof params === 'object') {
    return node.replace(/\{(\w+)\}/g, (match, key) => {
      return params[key] != null ? String(params[key]) : match;
    });
  }

  return node;
}

/**
 * 是否存在指定路徑
 */
export function has(path) {
  const parts = String(path || '').split('.');
  let node = LABELS;
  for (const part of parts) {
    if (node == null || typeof node !== 'object') return false;
    node = node[part];
  }
  return typeof node === 'string';
}

/**
 * 取得整個分類（回傳複本）
 */
export function getGroup(groupName) {
  const group = LABELS[groupName];
  if (!group || typeof group !== 'object') return {};
  return { ...group };
}
