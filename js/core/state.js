// ============================================
// state.js — 全域狀態中心（v102.0.0）
// 位置：js/core/state.js
// ============================================
// v102.0.0 新增：
//   ✅ getCurrentMemberId()（判斷當前登入者的成員 ID）
//   ✅ currentMemberId（從 memberAccount 或 fallback UID）
//   ✅ 保留 v101.8.0 全部功能
// ============================================

import { STORAGE_KEYS } from '../config/constants.js';

export const AppState = {
  // ---------- 使用者 ----------
  currentUser: null,
  isSuperAdmin: false,

  // ---------- 家庭 ----------
  currentFamilyId: '',
  currentFamilyName: '',
  familyOwnerUid: '',

  // ---------- 帳號資訊 ----------
  role: '',                 // 'owner' | 'member' | 'superadmin'
  canInput: false,          // 是否可以輸入 / 編輯
  displayName: '',          // 顯示名稱
  memberAccount: null,      // 完整帳號物件 { email, displayName, role, canInput }
  currentMemberId: '',      // 🆕 v102.0.0：當前登入者對應的成員 ID

  // ---------- 年月 ----------
  year: '',
  month: '',

  // ---------- 檢視模式 ----------
  currentView: 'table',

  // ---------- 事件總線 ----------
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

    if (savedYear) this.year = savedYear;
    else this.year = String(new Date().getFullYear());

    if (savedMonth) this.month = savedMonth;
    else this.month = 'all';

    if (savedFamilyId) {
      this.currentFamilyId = savedFamilyId;
      this.currentFamilyName = savedFamilyName || '';
    }
  },

  destroy() {
    this._listeners = {};
    this._initialized = false;
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
      this.role = 'superadmin';
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
     帳號資訊
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
      // 🆕 v102.0.0：若 memberAccount 有 memberId，設定之
      if (account.memberId) {
        this.currentMemberId = account.memberId;
      }
    }
    this.emit('member-account-change', this.memberAccount);
  },

  getMemberAccount() { return this.memberAccount; },

  /**
   * 🆕 v102.0.0：取得當前登入者對應的成員 ID
   * 優先順序：
   *   1. memberAccount.memberId
   *   2. currentMemberId
   *   3. fallback：若 displayName 與某成員名稱相同則使用該成員（由呼叫端處理）
   */
  getCurrentMemberId() {
    if (this.currentMemberId) return this.currentMemberId;
    if (this.memberAccount?.memberId) return this.memberAccount.memberId;
    return '';
  },

  /**
   * 🆕 v102.0.0：手動設定當前成員 ID
   */
  setCurrentMemberId(memberId) {
    this.currentMemberId = memberId || '';
    this.emit('current-member-change', this.currentMemberId);
  },

  /**
   * 一鍵設定所有帳號相關資訊
   */
  setAccountContext({ familyId, familyName, memberAccount, ownerUid }) {
    this.setFamily(familyId, familyName, ownerUid);
    this.setMemberAccount(memberAccount);
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