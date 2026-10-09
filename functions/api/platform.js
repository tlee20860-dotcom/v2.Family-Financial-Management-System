// ============================================
// platform.js — 平台設定 + 預設資料庫（v103.0.0）
// 位置：functions/api/platform.js
// ============================================
// v103.0.0 合併：
//   ✅ 合併 platform-settings.js + platform-defaults.js
//   ✅ 內部透過 ?action= 分派
//   ✅ 舊 URL 路徑保持不變
// ============================================

import { dbGet, dbPut, dbPush, dbDelete } from './_config.js';
import {
  authenticate, errorResponse, handleError, handleOptions,
  successResponse, objToList, PLATFORM_RESOURCES,
} from './_helpers.js';

/* ============================================
   欄位白名單
   ============================================ */
const FIELD_WHITELIST = {
  members:     ['name', 'role', 'order'],
  banks:       ['name', 'order'],
  companies:   ['name', 'order'],
  payments:    ['name', 'order'],
  categories:  ['name', 'order'],
  items:       ['name', 'categoryKey', 'categoryId'],
  statuses:    ['name', 'category', 'isDone', 'order'],
  options:     null,
  yearRange:   ['startYear', 'futureYears'],
  uiConstants: ['nameMaxLenDesktop', 'nameMaxLenMobile', 'toastDuration'],
};

const byOrderThenCreated = (a, b) => {
  const oa = a.order != null ? a.order : Number.MAX_SAFE_INTEGER;
  const ob = b.order != null ? b.order : Number.MAX_SAFE_INTEGER;
  if (oa !== ob) return oa - ob;
  return (a.createdAt || 0) - (b.createdAt || 0);
};

/* ============================================
   GET
   ============================================ */
export async function onRequestGet({ request }) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'list';
    const resource = url.searchParams.get('resource');

    const auth = await authenticate(request, { needSuperAdmin: true });
    if (auth instanceof Response) return auth;
    const { token } = auth;

    /* 分派：settings vs defaults */
    if (resource === 'uiConstants' && !action.startsWith('set')) {
      /* 平台設定（單一 uiConstants） */
      const data = await dbGet('platform/defaults/ui_constants', token);
      return successResponse({ data: data || {} });
    }

    if (action !== 'list') {
      return errorResponse('BAD_REQUEST', 'GET 僅支援 action=list');
    }

    const config = PLATFORM_RESOURCES[resource];
    if (!config) return errorResponse('BAD_REQUEST', `未知的 resource：${resource || '(空)'}`);

    const data = await dbGet(`platform/defaults/${config.path}`, token);

    if (config.type === 'object') {
      return successResponse({ resource, type: 'object', data: data || {} });
    }
    const list = objToList(data || {}, byOrderThenCreated);
    return successResponse({ resource, type: 'list', list });
  } catch (err) {
    return handleError(err);
  }
}

/* ============================================
   POST
   ============================================ */
export async function onRequestPost({ request }) {
  try {
    const body = await request.json();
    const { action, resource, id, data } = body || {};

    const auth = await authenticate(request, { needSuperAdmin: true });
    if (auth instanceof Response) return auth;
    const { token } = auth;

    /* 平台設定 update（uiConstants 快捷路徑） */
    if (action === 'update' && resource === undefined) {
      return await _handlePlatformSettingsUpdate(body, token);
    }

    const config = PLATFORM_RESOURCES[resource];
    if (!config) return errorResponse('BAD_REQUEST', `未知的 resource：${resource || '(空)'}`);

    const basePath = `platform/defaults/${config.path}`;

    /* PUT */
    if (action === 'put') {
      if (config.type !== 'list') return errorResponse('BAD_REQUEST', `${resource} 不支援 put`);
      if (!data || typeof data !== 'object') return errorResponse('MISSING_FIELDS', '缺少 data');

      const clean = _whitelist(data, FIELD_WHITELIST[resource]);
      clean.createdAt = data.createdAt || Date.now();

      let savedId = id;
      if (id) {
        const ok = await dbPut(`${basePath}/${id}`, clean, token);
        if (!ok) return errorResponse('INTERNAL', '寫入失敗');
      } else {
        savedId = await dbPush(basePath, clean, token);
        if (!savedId) return errorResponse('INTERNAL', '寫入失敗');
      }
      return successResponse({ id: savedId, data: clean });
    }

    /* DELETE */
    if (action === 'delete') {
      if (config.type !== 'list') return errorResponse('BAD_REQUEST', `${resource} 不支援 delete`);
      if (!id) return errorResponse('MISSING_FIELDS', '缺少 id');
      const ok = await dbDelete(`${basePath}/${id}`, token);
      if (!ok) return errorResponse('INTERNAL', '刪除失敗');
      return successResponse({ deletedId: id });
    }

    /* SET */
    if (action === 'set') {
      if (config.type !== 'object') return errorResponse('BAD_REQUEST', `${resource} 不支援 set`);
      if (data == null) return errorResponse('MISSING_FIELDS', '缺少 data');
      const clean = _sanitizeObjectResource(resource, data);
      const ok = await dbPut(basePath, clean, token);
      if (!ok) return errorResponse('INTERNAL', '寫入失敗');
      return successResponse({ data: clean });
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
   平台設定 update（uiConstants）
   ============================================ */
async function _handlePlatformSettingsUpdate(body, token) {
  const { action, data } = body;
  if (action !== 'update') return errorResponse('BAD_REQUEST', '未知的 action');
  if (!data || typeof data !== 'object') return errorResponse('MISSING_FIELDS', '缺少 data');

  const clean = {
    nameMaxLenDesktop: _toInt(data.nameMaxLenDesktop, 12),
    nameMaxLenMobile:  _toInt(data.nameMaxLenMobile, 6),
    toastDuration:     _toInt(data.toastDuration, 2000),
  };

  const ok = await dbPut('platform/defaults/ui_constants', clean, token);
  if (!ok) return errorResponse('INTERNAL', '寫入失敗');
  return successResponse({ data: clean });
}

/* ============================================
   內部工具
   ============================================ */
function _whitelist(data, allowed) {
  if (!allowed) return { ...data };
  const clean = {};
  allowed.forEach((key) => { if (data[key] !== undefined) clean[key] = data[key]; });
  return clean;
}

function _sanitizeObjectResource(resource, data) {
  if (resource === 'yearRange') {
    return {
      startYear: data.startYear != null && data.startYear !== '' ? Number(data.startYear) : null,
      futureYears: Number(data.futureYears) || 5,
    };
  }
  if (resource === 'uiConstants') {
    return {
      nameMaxLenDesktop: _toInt(data.nameMaxLenDesktop, 12),
      nameMaxLenMobile:  _toInt(data.nameMaxLenMobile, 6),
      toastDuration:     _toInt(data.toastDuration, 2000),
    };
  }
  if (resource === 'options') {
    return {
      memberRoles:           Array.isArray(data.memberRoles)           ? data.memberRoles           : [],
      cycles:                Array.isArray(data.cycles)                ? data.cycles                : [],
      policyTypes:           Array.isArray(data.policyTypes)           ? data.policyTypes           : [],
      insurancePaymentTypes: Array.isArray(data.insurancePaymentTypes) ? data.insurancePaymentTypes : [],
      categoryOrder:         Array.isArray(data.categoryOrder)         ? data.categoryOrder         : [],
    };
  }
  return data;
}

function _toInt(v, fallback) {
  const n = Number(v);
  if (isNaN(n) || n < 0) return fallback;
  return Math.floor(n);
}
