// ============================================
// [[path]].js — API Catch-all 路由器（v103.0.2）
// 位置：functions/api/[[path]].js
// ============================================
// 說明：
//   - CF Pages 支援 `[[path]]` 動態路由，捕獲 /api/* 全部請求
//   - 依 pathname 分派到各 lib 的 handler
// ============================================

import {
  handleLookupFamily,
  handleFamilySettingsGet, handleFamilySettingsPost,
  handleFamilyAccountsGet, handleFamilyAccountsPost,
} from './_family.js';

import {
  handleAdminFamiliesGet, handleAdminFamiliesPost,
  handleAdminInitFamily,
} from './_admin.js';

import {
  handleBankAccountsGet, handleBankAccountsPost,
  handleBankTransactionsGet, handleBankTransactionsPost,
  handleClearBankBalances,
} from './_bank.js';

import {
  handlePersonalIncomeGet, handlePersonalIncomePost,
  handleMemberAdvancesGet, handleMemberAdvancesPost,
} from './_personal.js';

import {
  handlePlatformSettingsGet, handlePlatformSettingsPost,
  handlePlatformDefaultsGet, handlePlatformDefaultsPost,
} from './_platform.js';

import {
  handleSummary,
  handleAnnualSummary,
  handleSettlementsYear,
} from './_summary.js';

import { handleInsuranceSync } from './_insurance.js';

/* ============================================
   OPTIONS preflight
   ============================================ */
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}

/* ============================================
   GET 分派
   ============================================ */
export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const path = url.pathname;

  /* 家庭相關 */
  if (path === '/api/family-settings') return handleFamilySettingsGet(request);
  if (path === '/api/family-accounts') return handleFamilyAccountsGet(request);

  /* Admin */
  if (path === '/api/admin-families') return handleAdminFamiliesGet(request);

  /* 摘要類 */
  if (path === '/api/summary')            return handleSummary(request);
  if (path === '/api/annual-summary')     return handleAnnualSummary(request);
  if (path === '/api/settlements-year')   return handleSettlementsYear(request);

  /* 平台設定 */
  if (path === '/api/platform-settings')  return handlePlatformSettingsGet(request);
  if (path === '/api/platform-defaults')  return handlePlatformDefaultsGet(request);

  /* 銀行 */
  if (path === '/api/bank-accounts')      return handleBankAccountsGet(request);
  if (path === '/api/bank-transactions')  return handleBankTransactionsGet(request);

  /* 個人財務 */
  if (path === '/api/personal-income')    return handlePersonalIncomeGet(request);
  if (path === '/api/member-advances')    return handleMemberAdvancesGet(request);

  /* 找不到 */
  return new Response(JSON.stringify({ ok: false, error: 'NOT_FOUND', message: `未知的 API：${path}` }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });
}

/* ============================================
   POST 分派
   ============================================ */
export async function onRequestPost({ request }) {
  const url = new URL(request.url);
  const path = url.pathname;

  /* 登入查詢 */
  if (path === '/api/lookup-family') return handleLookupFamily(request);

  /* 家庭相關 */
  if (path === '/api/family-settings') return handleFamilySettingsPost(request);
  if (path === '/api/family-accounts') return handleFamilyAccountsPost(request);

  /* Admin */
  if (path === '/api/admin-families')      return handleAdminFamiliesPost(request);
  if (path === '/api/admin-init-family')   return handleAdminInitFamily(request);

  /* 平台設定 */
  if (path === '/api/platform-settings')   return handlePlatformSettingsPost(request);
  if (path === '/api/platform-defaults')   return handlePlatformDefaultsPost(request);

  /* 銀行 */
  if (path === '/api/bank-accounts')       return handleBankAccountsPost(request);
  if (path === '/api/bank-transactions')   return handleBankTransactionsPost(request);
  if (path === '/api/clear-bank-balances') return handleClearBankBalances(request);

  /* 個人財務 */
  if (path === '/api/personal-income')     return handlePersonalIncomePost(request);
  if (path === '/api/member-advances')     return handleMemberAdvancesPost(request);

  /* 保險 */
  if (path === '/api/insurance-sync')      return handleInsuranceSync(request);

  /* 找不到 */
  return new Response(JSON.stringify({ ok: false, error: 'NOT_FOUND', message: `未知的 API：${path}` }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });
}