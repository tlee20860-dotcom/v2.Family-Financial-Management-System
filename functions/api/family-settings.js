// ============================================
// family-settings.js — 家庭設定 API（v101 新增）
// 位置：functions/api/family-settings.js
// ============================================
// 端點：
//   GET  /api/family-settings?familyId=xxx
//         → 回傳 statuses / options / year_range / ui_constants
//
//   POST /api/family-settings
//         { familyId, action: 'update',       data }
//         { familyId, action: 'put-status',   id, data }
//         { familyId, action: 'delete-status', id }
//
// 權限：
//   family 成員（uid === familyId）或 superadmin
//
// 用途：
//   家庭自訂「狀態清單 / 下拉選項 / 年份範圍 / UI 常數」
//   於 database.html 或 settings.html 編輯
// ============================================

import { dbGet, dbPut, dbPush, dbDelete } from './_config.js';
import {
  authenticate,
  errorResponse,
  handleError,
  handleOptions,
  successResponse,
  objToList,
} from './_helpers.js';

/* ============================================
   GET — 讀取家庭所有設定
   ============================================ */
export async function onRequestGet({ request }) {
  try {
    const url = new URL(request.url);
    const familyId = url.searchParams.get('familyId');

    if (!familyId) return errorResponse('MISSING_FIELDS', '缺少 familyId');

    // 權限檢查
    const auth = await authenticate(request, {
      needFamily: true,
      body: { familyId },
    });
    if (auth instanceof Response) return auth;
    const { token } = auth;

    const basePath = `families/${familyId}`;

    const [statuses, options, yearRange, uiConstants] = await Promise.all([
      dbGet(`${basePath}/statuses`, token),
      dbGet(`${basePath}/settings/options`, token),
      dbGet(`${basePath}/settings/year_range`, token),
      dbGet(`${basePath}/settings/ui_constants`, token),
    ]);

    return successResponse({
      familyId,
      statuses: objToList(statuses || {}, _byOrder),
      options: options || null,
      yearRange: yearRange || null,
      uiConstants: uiConstants || null,
    });
  } catch (err) {
    return handleError(err);
  }
}

/* ============================================
   POST — update / put-status / delete-status
   ============================================ */
export async function onRequestPost({ request }) {
  try {
    const body = await request.json();
    const { familyId, action, id, data } = body || {};

    if (!familyId) return errorResponse('MISSING_FIELDS', '缺少 familyId');

    // 權限檢查
    const auth = await authenticate(request, {
      needFamily: true,
      body: { familyId },
    });
    if (auth instanceof Response) return auth;
    const { token, isSuper } = auth;

    const basePath = `families/${familyId}`;

    /* ============================================
       UPDATE — 更新 options / year_range / ui_constants
       ============================================ */
    if (action === 'update') {
      if (!data || typeof data !== 'object') {
        return errorResponse('MISSING_FIELDS', '缺少 data');
      }

      const results = {};

      // options（可部分更新）
      if (data.options !== undefined) {
        const ok = await dbPut(`${basePath}/settings/options`, _sanitizeOptions(data.options), token);
        results.options = ok;
      }

      // year_range
      if (data.yearRange !== undefined) {
        const ok = await dbPut(`${basePath}/settings/year_range`, _sanitizeYearRange(data.yearRange), token);
        results.yearRange = ok;
      }

      // ui_constants
      if (data.uiConstants !== undefined) {
        const ok = await dbPut(`${basePath}/settings/ui_constants`, _sanitizeUIConstants(data.uiConstants), token);
        results.uiConstants = ok;
      }

      const anyFailed = Object.values(results).some((v) => v === false);
      if (anyFailed) {
        return errorResponse('INTERNAL', '部分寫入失敗');
      }

      return successResponse({ results });
    }

    /* ============================================
       PUT-STATUS — 新增 / 更新單一狀態
       ============================================ */
    if (action === 'put-status') {
      if (!data || typeof data !== 'object') {
        return errorResponse('MISSING_FIELDS', '缺少 data');
      }
      if (!data.name) {
        return errorResponse('MISSING_FIELDS', '缺少 data.name');
      }

      const clean = {
        name: String(data.name).trim(),
        category: ['personal', 'fixed', 'insurance'].includes(data.category)
          ? data.category
          : 'personal',
        isDone: !!data.isDone,
        order: Number(data.order) || 0,
        createdAt: data.createdAt || Date.now(),
      };

      let savedId = id;
      if (id) {
        const ok = await dbPut(`${basePath}/statuses/${id}`, clean, token);
        if (!ok) return errorResponse('INTERNAL', '寫入失敗');
      } else {
        savedId = await dbPush(`${basePath}/statuses`, clean, token);
        if (!savedId) return errorResponse('INTERNAL', '寫入失敗');
      }

      return successResponse({ id: savedId, data: clean });
    }

    /* ============================================
       DELETE-STATUS — 刪除狀態
       ============================================ */
    if (action === 'delete-status') {
      if (!id) return errorResponse('MISSING_FIELDS', '缺少 id');

      const ok = await dbDelete(`${basePath}/statuses/${id}`, token);
      if (!ok) return errorResponse('INTERNAL', '刪除失敗');

      return successResponse({ deletedId: id });
    }

    return errorResponse('BAD_REQUEST', `未知的 action：${action || '(空)'}`);
  } catch (err) {
    return handleError(err);
  }
}

/* ============================================
   OPTIONS preflight
   ============================================ */
export async function onRequestOptions() {
  return handleOptions();
}

/* ============================================
   內部工具
   ============================================ */

const _byOrder = (a, b) => (a.order || 0) - (b.order || 0);

function _sanitizeOptions(options) {
  if (!options || typeof options !== 'object') return {};
  const clean = {};

  ['memberRoles', 'cycles', 'policyTypes', 'insurancePaymentTypes', 'categoryOrder'].forEach((key) => {
    if (Array.isArray(options[key])) {
      clean[key] = options[key];
    }
  });

  return clean;
}

function _sanitizeYearRange(data) {
  if (!data || typeof data !== 'object') {
    return { startYear: null, futureYears: 5 };
  }
  return {
    startYear: data.startYear != null && data.startYear !== ''
      ? Number(data.startYear)
      : null,
    futureYears: Number(data.futureYears) || 5,
  };
}

function _sanitizeUIConstants(data) {
  if (!data || typeof data !== 'object') return {};
  const clean = {};
  if (data.nameMaxLenDesktop != null) {
    clean.nameMaxLenDesktop = _toInt(data.nameMaxLenDesktop, 12);
  }
  if (data.nameMaxLenMobile != null) {
    clean.nameMaxLenMobile = _toInt(data.nameMaxLenMobile, 6);
  }
  if (data.toastDuration != null) {
    clean.toastDuration = _toInt(data.toastDuration, 2000);
  }
  return clean;
}

function _toInt(v, fallback) {
  const n = Number(v);
  if (isNaN(n) || n < 0) return fallback;
  return Math.floor(n);
}