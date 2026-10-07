// ============================================
// api.js — Cloudflare Functions 呼叫封裝（v101）
// 位置：js/core/api.js
// ============================================
// v101 修正：
//   ✅ 加入 401 處理（自動登出 + 導向 login）
//   ✅ 統一錯誤物件
//   ✅ 新增 3 個 API：platformSettings / platformDefaults / familySettings
//   ✅ 匯出 callApi 供其他模組使用
// ============================================

import { AppState } from './state.js';
import { auth } from '../config/firebase-config.js';

/* ============================================
   基礎呼叫
   ============================================ */

/**
 * 呼叫後端 API
 * @param {string} path
 * @param {Object} options
 * @returns {Promise<Object>}
 */
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

  // 401 → 未授權，強制登出
  if (res.status === 401) {
    localStorage.removeItem('fin_family_id');
    localStorage.removeItem('fin_family_name');
    window.location.href = 'login.html';
    throw new Error('登入已過期，請重新登入');
  }

  // 403 → 無權限
  if (res.status === 403) {
    const text = await res.text().catch(() => '');
    throw new Error(`無權限存取（${res.status}）：${text || 'FORBIDDEN'}`);
  }

  // 其他錯誤
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let parsed = null;
    try { parsed = JSON.parse(text); } catch (e) { /* noop */ }
    const msg = parsed?.error || parsed?.message || text || '未知錯誤';
    throw new Error(`API 失敗（${res.status}）：${msg}`);
  }

  return res.json();
}

/**
 * 取得當前家庭 ID（若無則拋錯）
 */
function getFamilyId() {
  const id = AppState.getFamilyId();
  if (!id) throw new Error('尚未選擇家庭');
  return id;
}

/* ============================================
   業務 API
   ============================================ */

export const api = {
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

  /* ---------- 平台家庭管理（superadmin） ---------- */
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

  /* ============================================
     🆕 v101：平台設定（UI 常數）
     ============================================ */
  platformSettings: {
    get: () => callApi('/api/platform-settings'),

    update: (data) =>
      callApi('/api/platform-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', data }),
      }),
  },

  /* ============================================
     🆕 v101：平台預設資料庫
     ============================================ */
  platformDefaults: {
    /**
     * 列出某個資源
     * @param {'members'|'banks'|'companies'|'payments'|'categories'|'items'|'statuses'|'options'|'year_range'|'ui_constants'} resource
     */
    list: (resource) =>
      callApi(`/api/platform-defaults?action=list&resource=${resource}`),

    /**
     * 新增 / 更新一筆
     */
    put: (resource, id, data) =>
      callApi('/api/platform-defaults', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'put', resource, id, data }),
      }),

    /**
     * 刪除一筆
     */
    remove: (resource, id) =>
      callApi('/api/platform-defaults', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', resource, id }),
      }),

    /**
     * 批次儲存（用於 options / year_range / ui_constants 這種單物件）
     */
    set: (resource, data) =>
      callApi('/api/platform-defaults', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set', resource, data }),
      }),
  },

  /* ============================================
     🆕 v101：家庭設定
     ============================================ */
  familySettings: {
    /**
     * 取得家庭的所有設定（options / year_range / ui_constants / statuses）
     */
    get: () =>
      callApi(`/api/family-settings?familyId=${getFamilyId()}`),

    /**
     * 更新家庭設定
     */
    update: (data) =>
      callApi('/api/family-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyId: getFamilyId(), action: 'update', data }),
      }),

    /**
     * 新增 / 更新狀態
     */
    putStatus: (id, data) =>
      callApi('/api/family-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyId: getFamilyId(), action: 'put-status', id, data }),
      }),

    /**
     * 刪除狀態
     */
    removeStatus: (id) =>
      callApi('/api/family-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyId: getFamilyId(), action: 'delete-status', id }),
      }),
  },
};