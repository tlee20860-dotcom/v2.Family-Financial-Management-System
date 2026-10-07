// ============================================
// state.js — 全域狀態中心（v101）
// 位置：js/core/state.js
// ============================================
// v101 修正：
//   ✅ localStorage keys 改用 STORAGE_KEYS 常數
//   ✅ 提供 destroy() 清理事件總線
//   ✅ 新增 app-config 整合（選擇家庭時載入設定）
// ============================================

import { STORAGE_KEYS } from '../config/constants.js';

export const AppState = {
  // ---------- 使用者 ----------
  currentUser: null,
  isSuperAdmin: false,

  // ---------- 家庭 ----------
  currentFamilyId: '',
  currentFamilyName: '',

  // ---------- 年月 ----------
  year: '',
  month: '',

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

    if (savedYear) {
      this.year = savedYear;
    } else {
      const d = new Date();
      this.year = String(d.getFullYear());
    }

    if (savedMonth) {
      this.month = savedMonth;
    } else {
      this.month = 'all';
    }

    if (savedFamilyId) {
      this.currentFamilyId = savedFamilyId;
      this.currentFamilyName = savedFamilyName || '';
    }
  },

  /**
   * 銷毀所有事件監聽（用於 SPA 切換頁面時）
   */
  destroy() {
    this._listeners = {};
    this._initialized = false;
    this.currentUser = null;
    this.isSuperAdmin = false;
    this.currentFamilyId = '';
    this.currentFamilyName = '';
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
    this.emit('superadmin-change', this.isSuperAdmin);
  },

  /* ============================================
     家庭
     ============================================ */
  setFamily(familyId, familyName) {
    this.currentFamilyId = familyId || '';
    this.currentFamilyName = familyName || '';

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

  getFamilyId() {
    return this.currentFamilyId;
  },

  getFamilyName() {
    return this.currentFamilyName;
  },

  clearFamily() {
    this.currentFamilyId = '';
    this.currentFamilyName = '';
    localStorage.removeItem(STORAGE_KEYS.FAMILY_ID);
    localStorage.removeItem(STORAGE_KEYS.FAMILY_NAME);
    this.emit('family-change', { familyId: '', familyName: '' });
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

  getYearMonth() {
    return { year: this.year, month: this.month };
  },

  isAnnualMode() {
    return this.month === 'all';
  },

  /* ============================================
     事件總線
     ============================================ */
  on(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(callback);

    // 回傳取消訂閱函式
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
      try {
        cb(data);
      } catch (err) {
        console.error(`[AppState] 事件 ${event} 回呼失敗：`, err);
      }
    });
  },
};