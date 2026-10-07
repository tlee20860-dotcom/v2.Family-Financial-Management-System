// ============================================
// family-settings.js — 家庭設定 API（v101.5）
// 位置：functions/api/family-settings.js
// ============================================
// v101.5 修正：
//   ✅ GET / POST 的 authenticate 使用 URL query（不再手動建構 body）
//   ✅ _sanitizeOptions 白名單與 app-config.js 的 getOptions 對齊
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

    // 🆕 v101.5：needFamily 會自動從 URL query 讀取
    const auth = await authenticate(request, { needFamily: true });
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

    const auth = await authenticate(request, { needFamily: true, body });
    if (auth instanceof Response) return auth;
    const { token } = auth;

    const basePath = `families/${familyId}`;

    /* ============================================
       UPDATE
       ============================================ */
    if (action === 'update') {
      if (!data || typeof data !== 'object') {
        return errorResponse('MISSING_FIELDS', '缺少 data');
      }

      const results = {};

      if (data.options !== undefined) {
        const ok = await dbPut(`${basePath}/settings/options`, _sanitizeOptions(data.options), token);
        results.options = ok;
      }

      if (data.yearRange !== undefined) {
        const ok = await dbPut(`${basePath}/settings/year_range`, _sanitizeYearRange(data.yearRange), token);
        results.yearRange = ok;
      }

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
       PUT-STATUS
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
       DELETE-STATUS
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