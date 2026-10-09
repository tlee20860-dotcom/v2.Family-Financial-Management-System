// ============================================
// state.js — 全域狀態中心（v102.0.0）
// 位置：js/core/state.js
// ============================================
// v102.0.0 修正：
//   ✅ [P2-5] setMemberAccount(null) 重置 role / canInput / displayName / currentMemberId
//   ✅ getCurrentMemberId()（判斷當前登入者的成員 ID）
//   ✅ 保留 v101.8.0 全部功能
// ============================================

import { STORAGE_KEYS } from '../config/constants.js';

export const AppState = {
  currentUser: null,
  isSuperAdmin: false,

  currentFamilyId: '',
  currentFamilyName: '',
  familyOwnerUid: '',

  role: '',
  canInput: false,
  displayName: '',
  memberAccount: null,
  currentMemberId: '',

  year: '',
  month: '',

  currentView: 'table',

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

  /**
   * 🆕 P2-5：setMemberAccount 支援 null 重置
   */
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
      // 🆕 P2-5：重置為預設值（避免切換家庭時殘留前位使用者資訊）
      this.role = '';
      this.canInput = false;
      this.displayName = '';
      this.currentMemberId = '';
    }

    this.emit('member-account-change', this.memberAccount);
  },

  getMemberAccount() { return this.memberAccount; },

  /**
   * 取得當前登入者對應的成員 ID
   */
  getCurrentMemberId() {
    if (this.currentMemberId) return this.currentMemberId;
    if (this.memberAccount?.memberId) return this.memberAccount.memberId;
    return '';
  },

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
