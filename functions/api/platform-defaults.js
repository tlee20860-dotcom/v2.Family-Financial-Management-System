// ============================================
// platform-defaults.js — 平台預設資料庫 API（v101 新增）
// 位置：functions/api/platform-defaults.js
// ============================================
// 端點：
//   GET  /api/platform-defaults?action=list&resource=members
//   POST /api/platform-defaults
//         { action: 'put',    resource, id, data }
//         { action: 'delete', resource, id }
//         { action: 'set',    resource, data }
//
// 支援的 resource（前端短名 → 實際路徑）：
//   members      → members
//   banks        → banks
//   companies    → insurance_companies
//   payments     → payment_methods
//   categories   → expense_categories
//   items        → expense_items
//   statuses     → statuses
//   options      → options           （單物件）
//   yearRange    → year_range        （單物件）
//   uiConstants  → ui_constants      （單物件）
//
// 權限：全部需 superadmin
// ============================================

import { dbGet, dbPut, dbPush, dbDelete } from './_config.js';
import {
  authenticate,
  errorResponse,
  handleError,
  handleOptions,
  successResponse,
  objToList,
  roundInt,
} from './_helpers.js';

/* ============================================
   resource 對照表
   ============================================ */
const RESOURCE_MAP = {
  members:     { path: 'members',               type: 'list' },
  banks:       { path: 'banks',                 type: 'list' },
  companies:   { path: 'insurance_companies',   type: 'list' },
  payments:    { path: 'payment_methods',       type: 'list' },
  categories:  { path: 'expense_categories',    type: 'list' },
  items:       { path: 'expense_items',         type: 'list' },
  statuses:    { path: 'statuses',              type: 'list' },
  options:     { path: 'options',               type: 'object' },
  yearRange:   { path: 'year_range',            type: 'object' },
  uiConstants: { path: 'ui_constants',          type: 'object' },
};

/* 各資源允許的欄位（白名單，防止寫入垃圾欄位） */
const FIELD_WHITELIST = {
  members:    ['name', 'role', 'order'],
  banks:      ['name', 'order'],
  companies:  ['name', 'order'],
  payments:   ['name', 'order'],
  categories: ['name', 'order'],
  items:      ['name', 'categoryKey', 'categoryId'],
  statuses:   ['name', 'category', 'isDone', 'order'],
  options:    null,  // 全物件
  yearRange:  ['startYear', 'futureYears'],
  uiConstants:['nameMaxLenDesktop', 'nameMaxLenMobile', 'toastDuration'],
};

/* 排序函式 */
const byOrderThenCreated = (a, b) => {
  const oa = a.order != null ? a.order : Number.MAX_SAFE_INTEGER;
  const ob = b.order != null ? b.order : Number.MAX_SAFE_INTEGER;
  if (oa !== ob) return oa - ob;
  return (a.createdAt || 0) - (b.createdAt || 0);
};

/* ============================================
   GET — 列出某資源
   ============================================ */
export async function onRequestGet({ request }) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'list';
    const resource = url.searchParams.get('resource');

    // 權限檢查
    const auth = await authenticate(request, { needSuperAdmin: true });
    if (auth instanceof Response) return auth;
    const { token } = auth;

    if (action !== 'list') {
      return errorResponse('BAD_REQUEST', 'GET 僅支援 action=list');
    }

    const config = RESOURCE_MAP[resource];
    if (!config) {
      return errorResponse('BAD_REQUEST', `未知的 resource：${resource || '(空)'}`);
    }

    const data = await dbGet(`platform/defaults/${config.path}`, token);

    if (config.type === 'object') {
      // 單物件：直接回傳
      return successResponse({ resource, type: 'object', data: data || {} });
    }

    // 清單：轉陣列 + 排序
    const list = objToList(data || {}, byOrderThenCreated);
    return successResponse({ resource, type: 'list', list });
  } catch (err) {
    return handleError(err);
  }
}

/* ============================================
   POST — put / delete / set
   ============================================ */
export async function onRequestPost({ request }) {
  try {
    const body = await request.json();
    const { action, resource, id, data } = body || {};

    // 權限檢查
    const auth = await authenticate(request, { needSuperAdmin: true });
    if (auth instanceof Response) return auth;
    const { token } = auth;

    const config = RESOURCE_MAP[resource];
    if (!config) {
      return errorResponse('BAD_REQUEST', `未知的 resource：${resource || '(空)'}`);
    }

    const basePath = `platform/defaults/${config.path}`;

    /* ============================================
       PUT — 新增 / 更新單筆（僅 list 類型）
       ============================================ */
    if (action === 'put') {
      if (config.type !== 'list') {
        return errorResponse('BAD_REQUEST', `${resource} 不支援 put，請用 set`);
      }
      if (!data || typeof data !== 'object') {
        return errorResponse('MISSING_FIELDS', '缺少 data');
      }

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

    /* ============================================
       DELETE — 刪除單筆（僅 list 類型）
       ============================================ */
    if (action === 'delete') {
      if (config.type !== 'list') {
        return errorResponse('BAD_REQUEST', `${resource} 不支援 delete`);
      }
      if (!id) return errorResponse('MISSING_FIELDS', '缺少 id');

      const ok = await dbDelete(`${basePath}/${id}`, token);
      if (!ok) return errorResponse('INTERNAL', '刪除失敗');

      return successResponse({ deletedId: id });
    }

    /* ============================================
       SET — 覆寫整個物件（僅 object 類型）
       ============================================ */
    if (action === 'set') {
      if (config.type !== 'object') {
        return errorResponse('BAD_REQUEST', `${resource} 不支援 set，請用 put`);
      }
      if (data == null) {
        return errorResponse('MISSING_FIELDS', '缺少 data');
      }

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

/* ============================================
   OPTIONS preflight
   ============================================ */
export async function onRequestOptions() {
  return handleOptions();
}

/* ============================================
   內部工具
   ============================================ */

/**
 * 白名單過濾欄位
 */
function _whitelist(data, allowed) {
  if (!allowed) return { ...data };
  const clean = {};
  allowed.forEach((key) => {
    if (data[key] !== undefined) clean[key] = data[key];
  });
  return clean;
}

/**
 * 特殊物件的清理 / 型別轉換
 */
function _sanitizeObjectResource(resource, data) {
  if (resource === 'yearRange') {
    return {
      startYear: data.startYear != null && data.startYear !== ''
        ? Number(data.startYear)
        : null,
      futureYears: Number(data.futureYears) || 5,
    };
  }

  if (resource === 'uiConstants') {
    return {
      nameMaxLenDesktop: _toInt(data.nameMaxLenDesktop, 12),
      nameMaxLenMobile: _toInt(data.nameMaxLenMobile, 6),
      toastDuration: _toInt(data.toastDuration, 2000),
    };
  }

  if (resource === 'options') {
    // options 保留原結構（含 memberRoles / cycles / ...）
    return {
      memberRoles:            Array.isArray(data.memberRoles)            ? data.memberRoles            : [],
      cycles:                 Array.isArray(data.cycles)                 ? data.cycles                 : [],
      policyTypes:            Array.isArray(data.policyTypes)            ? data.policyTypes            : [],
      insurancePaymentTypes:  Array.isArray(data.insurancePaymentTypes)  ? data.insurancePaymentTypes  : [],
      categoryOrder:          Array.isArray(data.categoryOrder)          ? data.categoryOrder          : [],
    };
  }

  return data;
}

function _toInt(v, fallback) {
  const n = Number(v);
  if (isNaN(n) || n < 0) return fallback;
  return Math.floor(n);
}