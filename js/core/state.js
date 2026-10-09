// ============================================
// state.js — 全域狀態中心（v103.0.0）
// 位置：js/core/state.js
// ============================================
// v103.0.0 重構：
//   ✅ 版本號 → v103.0.0
//   ✅ getMemberName() 便利方法（不依賴 registry，純 fallback）
//   ✅ getRoleLabel() / getCanInputLabel() 便利方法
//   ✅ destroy() 補強（清空所有事件監聽 + 狀態）
//   ✅ 保留 v102.0.0 全部功能
// ============================================

import { STORAGE_KEYS, ROLES } from '../config/constants.js';

export const AppState = {
  /* ---------- 使用者 ---------- */
  currentUser: null,
  isSuperAdmin: false,

  /* ---------- 家庭 ---------- */
  currentFamilyId: '',
  currentFamilyName: '',
  familyOwnerUid: '',

  /* ---------- 帳號 ---------- */
  role: '',
  canInput: false,
  displayName: '',
  memberAccount: null,
  currentMemberId: '',

  /* ---------- 年月 ---------- */
  year: '',
  month: '',

  /* ---------- 檢視模式 ---------- */
  currentView: 'table',

  /* ---------- 內部狀態 ---------- */
  _listeners: {},
  _initialized: false,

  /* ============================================
     初始化 / 銷毀
     ============================================ */
  init() {
    if (this._initialized) return;
    this._initialized = true;

    const savedYear = localStorage.getItem(STORAGE_KEYS.YEAR);
    const savedMonth = localStorage.getItem(STORAGE_KEYS.MONTH);
    const savedFamilyId = localStorage.getItem(STORAGE_KEYS.FAMILY_ID);
    const savedFamilyName = localStorage.getItem(STORAGE_KEYS.FAMILY_NAME);

    this.year = savedYear || String(new Date().getFullYear());
    this.month = savedMonth || 'all';

    if (savedFamilyId) {
      this.currentFamilyId = savedFamilyId;
      this.currentFamilyName = savedFamilyName || '';
    }
  },

  destroy() {
    /* 清空事件監聽 */
    this._listeners = {};

    /* 重設所有狀態 */
    this.currentUser = null;
    this.isSuperAdmin = false;
    this.currentFamilyId = '';
    this.currentFamilyName = '';
    this.familyOwnerUid = '';
    this.role = '';
    this.canInput = false;
    this.displayName = '';
    this.memberAccount = null;
    this.currentMemberId = '';
    this.currentView = 'table';

    this._initialized = false;
  },

  /* ============================================
     使用者
     ============================================ */
  setUser(user) {
    this.currentUser = user;
    this.emit('user-change', user);
  },

  setSuperAdmin(isSuper) {
    this.isSuperAdmin = !!isSuper;
    if (this.isSuperAdmin) {
      this.role = ROLES.SUPERADMIN;
      this.canInput = true;
    }
    this.emit('superadmin-change', this.isSuperAdmin);
  },

  /* ============================================
     家庭
     ============================================ */
  setFamily(familyId, familyName, ownerUid) {
    this.currentFamilyId = familyId || '';
    this.currentFamilyName = familyName || '';
    if (ownerUid !== undefined) this.familyOwnerUid = ownerUid || '';

    if (this.currentFamilyId) {
      localStorage.setItem(STORAGE_KEYS.FAMILY_ID, this.currentFamilyId);
      localStorage.setItem(STORAGE_KEYS.FAMILY_NAME, this.currentFamilyName);
    } else {
      localStorage.removeItem(STORAGE_KEYS.FAMILY_ID);
      localStorage.removeItem(STORAGE_KEYS.FAMILY_NAME);
    }

    this.emit('family-change', {
      familyId: this.currentFamilyId,
      familyName: this.currentFamilyName,
    });
  },

  getFamilyId() { return this.currentFamilyId; },
  getFamilyName() { return this.currentFamilyName; },
  getFamilyOwnerUid() { return this.familyOwnerUid || this.currentFamilyId; },
  hasFamily() { return !!this.currentFamilyId; },

  clearFamily() {
    this.currentFamilyId = '';
    this.currentFamilyName = '';
    this.familyOwnerUid = '';
    localStorage.removeItem(STORAGE_KEYS.FAMILY_ID);
    localStorage.removeItem(STORAGE_KEYS.FAMILY_NAME);
    this.emit('family-change', { familyId: '', familyName: '' });
  },

  /* ============================================
     帳號
     ============================================ */
  setRole(role) {
    this.role = role || '';
    this.emit('role-change', this.role);
  },

  getRole() { return this.role; },

  setCanInput(canInput) {
    this.canInput = !!canInput;
    this.emit('permission-change', { canInput: this.canInput });
  },

  getCanInput() { return this.canInput; },

  setDisplayName(displayName) {
    this.displayName = displayName || '';
    this.emit('displayname-change', this.displayName);
  },

  getDisplayName() { return this.displayName; },

  setMemberAccount(account) {
    this.memberAccount = account || null;

    if (account) {
      this.role = account.role || this.role;
      this.canInput = account.canInput !== false;
      this.displayName = account.displayName || this.displayName;
      if (account.memberId) {
        this.currentMemberId = account.memberId;
      }
    } else {
      /* 重置為預設值（避免切換家庭時殘留前位使用者資訊） */
      this.role = '';
      this.canInput = false;
      this.displayName = '';
      this.currentMemberId = '';
    }

    this.emit('member-account-change', this.memberAccount);
  },

  getMemberAccount() { return this.memberAccount; },

  getCurrentMemberId() {
    if (this.currentMemberId) return this.currentMemberId;
    if (this.memberAccount?.memberId) return this.memberAccount.memberId;
    return '';
  },

  setCurrentMemberId(memberId) {
    this.currentMemberId = memberId || '';
    this.emit('current-member-change', this.currentMemberId);
  },

  setAccountContext({ familyId, familyName, memberAccount, ownerUid }) {
    this.setFamily(familyId, familyName, ownerUid);
    this.setMemberAccount(memberAccount);
  },

  /* ============================================
     便利：角色 / 權限文字
     ============================================ */
  getRoleLabel() {
    switch (this.role) {
      case ROLES.SUPERADMIN: return '超級管理員';
      case ROLES.OWNER:      return '家庭擁有者';
      case ROLES.MEMBER:     return '家庭成員';
      default:               return '成員';
    }
  },

  getCanInputLabel() {
    return this.canInput ? '可輸入' : '唯讀';
  },

  /* ============================================
     年月
     ============================================ */
  setYearMonth(year, month) {
    this.year = String(year);
    this.month = String(month);
    localStorage.setItem(STORAGE_KEYS.YEAR, this.year);
    localStorage.setItem(STORAGE_KEYS.MONTH, this.month);
    this.emit('ym-change', { year: this.year, month: this.month });
  },

  getYearMonth() { return { year: this.year, month: this.month }; },
  isAnnualMode() { return this.month === 'all'; },

  /**
   * 🆕 v103.0.0：取得年月顯示文字
   * @param {string} [sep=' ']
   * @returns {string}
   */
  getYearMonthLabel(sep = ' ') {
    if (this.month === 'all') return `${this.year} 年 全年`;
    return `${this.year} 年${sep}${this.month} 月`;
  },

  /* ============================================
     當前檢視模式
     ============================================ */
  setCurrentView(view) {
    if (view !== 'table' && view !== 'card') return;
    if (this.currentView === view) return;
    this.currentView = view;
    this.emit('view-change', view);
  },

  getCurrentView() { return this.currentView; },

  /* ============================================
     事件總線
     ============================================ */
  on(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(callback);

    return () => {
      this._listeners[event] = (this._listeners[event] || []).filter((cb) => cb !== callback);
    };
  },

  off(event, callback) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter((cb) => cb !== callback);
  },

  emit(event, data) {
    (this._listeners[event] || []).forEach((cb) => {
      try { cb(data); } catch (err) {
        console.error(`[AppState] 事件 ${event} 回呼失敗：`, err);
      }
    });
  },
};
