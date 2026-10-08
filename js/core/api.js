// ============================================
// api.js — Cloudflare Functions 呼叫封裝（v101.8.0）
// 位置：js/core/api.js
// ============================================
// v101.8.0 新增：
//   ✅ lookupFamily() — 登入後查詢所屬家庭
//   ✅ familyAccounts.list(familyId)
//   ✅ familyAccounts.create(familyId, data)
//   ✅ familyAccounts.update(familyId, uid, data)
//   ✅ familyAccounts.remove(familyId, uid)
// ============================================

import { AppState } from './state.js';
import { auth } from '../config/firebase-config.js';
import { STORAGE_KEYS } from '../config/constants.js';

/* ============================================
   基礎呼叫
   ============================================ */

export async function callApi(path, options = {}) {
  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : '';

  const headers = {
    ...(options.headers || {}),
    'Authorization': `Bearer ${token}`,
  };

  let res;
  try {
    res = await fetch(path, { ...options, headers });
  } catch (err) {
    throw new Error(`網路錯誤（${path}）：${err.message}`);
  }

  if (res.status === 401) {
    localStorage.removeItem(STORAGE_KEYS.FAMILY_ID);
    localStorage.removeItem(STORAGE_KEYS.FAMILY_NAME);
    window.location.href = 'login.html';
    throw new Error('登入已過期，請重新登入');
  }

  if (res.status === 403) {
    const text = await res.text().catch(() => '');
    throw new Error(`無權限存取（${res.status}）：${text || 'FORBIDDEN'}`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let parsed = null;
    try { parsed = JSON.parse(text); } catch (e) { /* noop */ }
    const msg = parsed?.message || parsed?.error || text || '未知錯誤';
    throw new Error(`API 失敗（${res.status}）：${msg}`);
  }

  return res.json();
}

function getFamilyId() {
  const id = AppState.getFamilyId();
  if (!id) throw new Error('尚未選擇家庭');
  return id;
}

/* ============================================
   業務 API
   ============================================ */

export const api = {
  /* ---------- 🆕 v101.8.0：家庭查詢 ---------- */
  /**
   * 登入後查詢所屬家庭
   * @returns {Promise<{ familyId, familyName, memberAccount, isLegacy }>}
   */
  lookupFamily: () =>
    callApi('/api/lookup-family', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }),

  /* ---------- 摘要 ---------- */
  summary: (year, month) =>
    callApi(`/api/summary?familyId=${getFamilyId()}&year=${year}&month=${month}`),

  fetchAnnualSummary: async (year) => {
    const familyId = getFamilyId();
    const promises = [];
    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, '0');
      promises.push(callApi(`/api/summary?familyId=${familyId}&year=${year}&month=${mm}`));
    }
    const results = await Promise.all(promises);

    const monthly = results.map((d, i) => ({
      monthNum: i + 1,
      month: String(i + 1).padStart(2, '0'),
      totalIncome: d.totalIncome || 0,
      totalExpense: d.totalExpense || 0,
      netBalance: d.netBalance || 0,
      perMember: d.perMember || {},
      fixedList: d.fixedList || [],
      incomeBreakdown: d.incomeBreakdown || {},
      paymentBreakdown: d.paymentBreakdown || {},
      monthlyInsuranceAverage: d.monthlyInsuranceAverage || 0,
      totalAssets: d.totalAssets || 0,
      bankBalance: d.bankBalance || 0,
      fundValue: d.fundValue || 0,
      yearlyInsuranceTotal: d.yearlyInsuranceTotal || 0,
    }));

    const totalIncome = monthly.reduce((s, m) => s + m.totalIncome, 0);
    const totalExpense = monthly.reduce((s, m) => s + m.totalExpense, 0);
    const netBalance = totalIncome - totalExpense;

    return {
      year, monthly,
      totalIncome, totalExpense, netBalance,
      yearlyInsuranceTotal: results[0]?.yearlyInsuranceTotal || 0,
      totalAssets: results[11]?.totalAssets || results[0]?.totalAssets || 0,
      bankBalance: results[11]?.bankBalance || 0,
      fundValue: results[11]?.fundValue || 0,
    };
  },

  /* ---------- 保險同步 ---------- */
  insuranceSync: (payload) =>
    callApi('/api/insurance-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, familyId: getFamilyId(), action: 'upsert' }),
    }),

  insuranceUnsync: (payload) =>
    callApi('/api/insurance-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, familyId: getFamilyId(), action: 'delete' }),
    }),

  /* ---------- 平台家庭管理 ---------- */
  adminListFamilies: () =>
    callApi('/api/admin-families?action=list'),

  adminAddFamily: (uid, name, email) =>
    callApi('/api/admin-families', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add', uid, name, email }),
    }),

  adminRemoveFamily: (uid) =>
    callApi('/api/admin-families', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'remove', uid }),
    }),

  adminInitFamily: (uid) =>
    callApi('/api/admin-init-family', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid }),
    }),

  /* ---------- 🆕 v101.8.0：家庭成員帳號管理 ---------- */
  familyAccounts: {
    /**
     * 列出家庭所有成員帳號
     * @param {string} familyId
     */
    list: (familyId) =>
      callApi(`/api/family-accounts?familyId=${familyId}&action=list`),

    /**
     * 建立新成員帳號
     * @param {string} familyId
     * @param {Object} data - { account, password, displayName, role, canInput }
     */
    create: (familyId, data) =>
      callApi('/api/family-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', familyId, ...data }),
      }),

    /**
     * 更新成員帳號
     * @param {string} familyId
     * @param {string} uid
     * @param {Object} data - { displayName?, role?, canInput? }
     */
    update: (familyId, uid, data) =>
      callApi('/api/family-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', familyId, uid, ...data }),
      }),

    /**
     * 移除成員帳號
     * @param {string} familyId
     * @param {string} uid
     */
    remove: (familyId, uid) =>
      callApi('/api/family-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', familyId, uid }),
      }),
  },

  /* ---------- 平台設定 ---------- */
  platformSettings: {
    get: () => callApi('/api/platform-settings'),

    update: (data) =>
      callApi('/api/platform-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', data }),
      }),
  },

  /* ---------- 平台預設資料庫 ---------- */
  platformDefaults: {
    list: (resource) =>
      callApi(`/api/platform-defaults?action=list&resource=${resource}`),

    put: (resource, id, data) =>
      callApi('/api/platform-defaults', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'put', resource, id, data }),
      }),

    remove: (resource, id) =>
      callApi('/api/platform-defaults', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', resource, id }),
      }),

    set: (resource, data) =>
      callApi('/api/platform-defaults', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set', resource, data }),
      }),
  },

  /* ---------- 家庭設定 ---------- */
  familySettings: {
    get: () =>
      callApi(`/api/family-settings?familyId=${getFamilyId()}`),

    update: (data) =>
      callApi('/api/family-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyId: getFamilyId(), action: 'update', data }),
      }),

    putStatus: (id, data) =>
      callApi('/api/family-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyId: getFamilyId(), action: 'put-status', id, data }),
      }),

    removeStatus: (id) =>
      callApi('/api/family-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyId: getFamilyId(), action: 'delete-status', id }),
      }),
  },
};