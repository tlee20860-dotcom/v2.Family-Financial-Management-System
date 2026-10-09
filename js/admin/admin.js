// ============================================
// admin.js — 平台管理入口（v101.10.0）
// 位置：js/admin/admin.js
// ============================================
// v101.10.0 修正：
//   ✅ [P2-3] 帳號總覽改為分批查詢（每批 3 個）
//       - 原本 Promise.all 一次打 N 個 API
//       - 家庭數多時可能觸發 Cloudflare rate limit
//   ✅ 保留 v101.8.4 全部功能
// ============================================

import { api } from '../core/api.js';
import { escapeHtml } from '../core/utils.js';
import { logout } from '../core/auth.js';
import { AppState } from '../core/state.js';
import { showToast } from '../shared/toast.js';
import { openConfirm, openModal, closeModal } from '../shared/modal.js';
import { buildForm } from '../shared/form-builder.js';
import { initTabPanel } from '../shared/tab-panel.js';
import { registerPageCleanup } from '../core/app.js';
import { initPlatformDefaults } from './platform-defaults.js';

/* ============================================
   Module 狀態
   ============================================ */
let _families = [];
let _familyInputApi = null;
let _tabPanel = null;
let _defaultsInstance = null;
let _accountsOverviewInstance = null;
let _logoutHandler = null;
let _familyListHandler = null;

let _accountModalFamilyId = '';
let _accountModalFamilyName = '';
let _accountModalFormApi = null;
let _accountEditFormApi = null;
let _accountRestoreFormApi = null;
let _accountListHandler = null;

const ACCOUNT_MODAL_ID = 'admin-account-modal';
const ACCOUNT_FORM_ROOT_ID = 'admin-account-form-root';
const ACCOUNT_EDIT_MODAL_ID = 'admin-account-edit-modal';
const ACCOUNT_EDIT_FORM_ROOT_ID = 'admin-account-edit-form-root';
const ACCOUNT_RESTORE_MODAL_ID = 'admin-account-restore-modal';
const ACCOUNT_RESTORE_FORM_ROOT_ID = 'admin-account-restore-form-root';

// v101.10.0：批次查詢大小（避免 Cloudflare rate limit）
const ACCOUNTS_BATCH_SIZE = 3;

/* ============================================
   主入口
   ============================================ */
export function initAdminPage() {
  if (!AppState.isSuperAdmin) {
    alert('您沒有權限存取此頁面');
    window.location.href = 'index.html';
    return;
  }

  _logoutHandler = async () => {
    const ok = await openConfirm('確定要登出嗎？', {
      title: '登出',
      okText: '登出',
      okClass: 'btn-danger',
    });
    if (ok) logout();
  };
  document.getElementById('admin-logout-btn')?.addEventListener('click', _logoutHandler);

  _tabPanel = initTabPanel({
    containerId: 'admin-tabs',
    tabs: [
      { key: 'families', label: '家庭管理', icon: 'home',     panelId: 'admin-panel-families' },
      { key: 'accounts', label: '帳號總覽', icon: 'users',    panelId: 'admin-panel-accounts' },
      { key: 'defaults', label: '預設資料庫', icon: 'database', panelId: 'admin-panel-defaults' },
    ],
    defaultKey: 'families',
    storageKey: 'admin-tab',
    onChange: (key) => _onTabChange(key),
  });

  _renderFamilyPanel();

  registerPageCleanup(_destroy);

  return { destroy: _destroy };
}

/* ============================================
   Tab 切換
   ============================================ */
function _onTabChange(key) {
  if (key === 'accounts' && !_accountsOverviewInstance) {
    _accountsOverviewInstance = initAccountsOverview();
  }
  if (key === 'defaults' && !_defaultsInstance) {
    _defaultsInstance = initPlatformDefaults('admin-defaults-root');
  }
}

/* ============================================
   家庭管理面板
   ============================================ */
function _renderFamilyPanel() {
  const panel = document.getElementById('admin-panel-families');
  if (!panel) return;

  panel.innerHTML = `
    <div id="admin-family-form-root" class="mb-16"></div>

    <div class="glass-card collapsible-card collapsible-card-flat" style="padding:0;">
      <div class="collapsible-header">
        <div class="collapsible-header-title">
          <i data-lucide="home" style="width:16px;height:16px;"></i>
          <span>家庭清單 <span class="text-muted" id="admin-family-count" style="font-size:12px; margin-left:6px;"></span></span>
        </div>
      </div>
      <div class="collapsible-body" style="display:block;">
        <div id="admin-family-list"></div>
      </div>
    </div>
  `;

  _familyInputApi = buildForm({
    containerId: 'admin-family-form-root',
    fields: [
      { type: 'text', id: 'adm-fam-uid', label: 'Firebase UID', required: true, placeholder: '在 Firebase Auth 建立後複製 UID', maxlength: 60, hint: '請先在 Firebase 控制台建立家庭帳號，再將 UID 貼上。' },
      { type: 'text', id: 'adm-fam-name', label: '家庭名稱', required: true, placeholder: '例如：陳家', maxlength: 30 },
      { type: 'text', id: 'adm-fam-email', label: '擁有者 Email（可選）', placeholder: '例如：chen@familyfin.local', maxlength: 60 },
    ],
    submitText: '新增家庭',
    showCancel: false,
    showReset: true,
    resetText: '重置',
    beforeSubmit: _validateAddFamily,
    onSubmit: _handleAddFamily,
  });

  _bindFamilyListEvents();
  _loadFamilies();
}

function _validateAddFamily(data) {
  const uid = (data['adm-fam-uid'] || '').trim();
  const name = (data['adm-fam-name'] || '').trim();

  if (!uid) return { field: 'adm-fam-uid', message: '請填寫 UID' };
  if (!name) return { field: 'adm-fam-name', message: '請填寫家庭名稱' };
  return true;
}

/* ============================================
   新增家庭
   ============================================ */
async function _handleAddFamily(data) {
  const uid = (data['adm-fam-uid'] || '').trim();
  const name = (data['adm-fam-name'] || '').trim();
  const email = (data['adm-fam-email'] || '').trim();

  try {
    await api.adminAddFamily(uid, name, email);
    showToast(`✅ 已新增家庭「${name}」`, 'success');
    _familyInputApi.reset();
    await _loadFamilies();
  } catch (err) {
    showToast('新增失敗：' + err.message, 'error');
  }
}

/* ============================================
   載入家庭清單
   ============================================ */
async function _loadFamilies() {
  const listEl = document.getElementById('admin-family-list');
  if (listEl) listEl.innerHTML = `<div class="empty-state">載入中…</div>`;

  try {
    const data = await api.adminListFamilies();
    _families = data.families || [];
    _renderFamilies();
  } catch (err) {
    console.error('載入家庭失敗：', err);
    if (listEl) {
      listEl.innerHTML = `<div class="empty-state text-red">載入失敗：${escapeHtml(err.message)}</div>`;
    }
  }
}

/* ============================================
   渲染家庭清單
   ============================================ */
function _renderFamilies() {
  const listEl = document.getElementById('admin-family-list');
  const countEl = document.getElementById('admin-family-count');
  if (!listEl) return;

  if (countEl) countEl.textContent = `（共 ${_families.length} 個）`;

  if (_families.length === 0) {
    listEl.innerHTML = `<div class="empty-state">尚無家庭，請從上方新增</div>`;
    return;
  }

  listEl.innerHTML = `
    <div style="overflow-x:auto;">
      <table class="data-table">
        <thead>
          <tr>
            <th>家庭名稱</th>
            <th>擁有者 Email</th>
            <th>UID</th>
            <th>建立時間</th>
            <th style="width:280px;">操作</th>
          </tr>
        </thead>
        <tbody>
          ${_families.map((f) => `
            <tr data-uid="${escapeHtml(f.uid)}">
              <td>${escapeHtml(f.name || '')}</td>
              <td style="font-size:12px;">${escapeHtml(f.ownerEmail || '—')}</td>
              <td style="font-size:11px; color:var(--text-muted); font-family:var(--font-mono); word-break:break-all;">${escapeHtml(f.uid)}</td>
              <td style="font-size:11px; color:var(--text-muted);">${f.createdAt > 0 ? new Date(f.createdAt).toLocaleString('zh-HK') : '—'}</td>
              <td>
                <button type="button" class="btn btn-sm btn-primary" data-action="enter" data-uid="${escapeHtml(f.uid)}">進入</button>
                <button type="button" class="btn btn-sm btn-ghost" data-action="accounts" data-uid="${escapeHtml(f.uid)}">
                  <i data-lucide="users" style="width:12px;height:12px;"></i> 帳號
                </button>
                <button type="button" class="btn btn-sm btn-ghost" data-action="init" data-uid="${escapeHtml(f.uid)}">初始化</button>
                <button type="button" class="btn btn-sm btn-danger" data-action="delete" data-uid="${escapeHtml(f.uid)}">刪除</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   清單事件
   ============================================ */
function _bindFamilyListEvents() {
  const listEl = document.getElementById('admin-family-list');
  if (!listEl) return;

  _familyListHandler = async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const uid = btn.dataset.uid;
    const action = btn.dataset.action;
    const family = _families.find((f) => f.uid === uid);

    switch (action) {
      case 'enter':
        if (family) {
          AppState.setFamily(uid, family.name || '');
          window.location.href = 'index.html';
        }
        break;
      case 'accounts':
        if (family) await _openAccountModal(uid, family.name || uid);
        break;
      case 'init':
        await _handleInit(uid, family);
        break;
      case 'delete':
        await _handleDelete(uid, family);
        break;
    }
  };

  listEl.addEventListener('click', _familyListHandler);
}

/* ============================================
   初始化家庭預設資料
   ============================================ */
async function _handleInit(uid, family) {
  const name = family?.name || uid;

  const ok = await openConfirm(
    `確定要為家庭「${name}」初始化預設資料嗎？\n\n將套用平台預設資料庫的內容（成員、類別、項目、支付方式、狀態、下拉選項等）。`,
    { title: '初始化家庭', okText: '初始化', okClass: 'btn-primary' }
  );
  if (!ok) return;

  try {
    const result = await api.adminInitFamily(uid);
    if (result.skipped) showToast('此家庭已有資料，略過初始化', 'warning');
    else showToast('✅ 已初始化預設資料', 'success');
  } catch (err) {
    showToast('初始化失敗：' + err.message, 'error');
  }
}

/* ============================================
   刪除家庭
   ============================================ */
async function _handleDelete(uid, family) {
  const name = family?.name || uid;

  const ok = await openConfirm(
    `⚠️ 確定要刪除家庭「${name}」嗎？\n\n這將會一併刪除該家庭的所有資料（成員、支出、收入、保單、基金等），此操作無法復原。\n\n注意：不會刪除 Firebase Auth 帳號。`,
    { title: '刪除家庭', okText: '刪除', okClass: 'btn-danger' }
  );
  if (!ok) return;

  try {
    await api.adminRemoveFamily(uid);
    showToast('✅ 已刪除家庭', 'success');
    await _loadFamilies();
    if (_accountsOverviewInstance) {
      _accountsOverviewInstance.refresh?.();
    }
  } catch (err) {
    showToast('刪除失敗：' + err.message, 'error');
  }
}

/* ============================================
   帳號總覽 Tab
   ============================================ */
function initAccountsOverview() {
  const panel = document.getElementById('admin-panel-accounts');
  if (!panel) return null;

  panel.innerHTML = `
    <div class="banner mb-16">
      ℹ️ 跨家庭成員帳號總覽。點擊「管理」可跳轉至該家庭的帳號管理。
    </div>

    <div id="admin-accounts-stats" class="mb-16"></div>
    <div id="admin-accounts-list"></div>
  `;

  _loadAccountsOverview();

  return {
    refresh: () => _loadAccountsOverview(),
    destroy: () => {
      const panel = document.getElementById('admin-panel-accounts');
      if (panel) panel.innerHTML = '';
    },
  };
}

/**
 * v101.10.0：分批查詢帳號（每批 3 個家庭）
 * 避免一次 Promise.all N 個 API 觸發 rate limit
 */
async function _loadAccountsOverview() {
  const listEl = document.getElementById('admin-accounts-list');
  const statsEl = document.getElementById('admin-accounts-stats');
  if (!listEl) return;

  listEl.innerHTML = '<div class="empty-state">載入中…</div>';

  try {
    // 1. 取得所有家庭
    const familiesData = await api.adminListFamilies();
    const families = familiesData.families || [];

    // 同步至 _families（供 _openAccountModal 使用）
    _families = families;

    if (families.length === 0) {
      listEl.innerHTML = '<div class="empty-state">尚無家庭</div>';
      if (statsEl) statsEl.innerHTML = '';
      return;
    }

    // 2. 分批查詢各家庭帳號
    const results = [];
    for (let i = 0; i < families.length; i += ACCOUNTS_BATCH_SIZE) {
      const batch = families.slice(i, i + ACCOUNTS_BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (f) => {
          try {
            const r = await api.familyAccounts.list(f.uid);
            return { family: f, accounts: r.accounts || [] };
          } catch (err) {
            console.warn(`載入家庭 ${f.uid} 帳號失敗：`, err);
            return { family: f, accounts: [] };
          }
        })
      );
      results.push(...batchResults);
    }

    const totalAccounts = results.reduce((s, r) => s + r.accounts.length, 0);

    // 3. 統計
    if (statsEl) {
      statsEl.innerHTML = `
        <div class="grid grid-2" style="gap:12px;">
          <div class="glass-card">
            <div class="glass-card-title">家庭總數</div>
            <div class="glass-card-value cyan mono">${families.length}</div>
          </div>
          <div class="glass-card">
            <div class="glass-card-title">帳號總數</div>
            <div class="glass-card-value emerald mono">${totalAccounts}</div>
          </div>
        </div>
      `;
    }

    // 4. 渲染
    listEl.innerHTML = results.map((r) => _renderFamilyAccountsSection(r)).join('');

    // 5. 綁定「跳轉管理」事件
    listEl.querySelectorAll('button[data-acc-jump]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const uid = btn.dataset.accJump;
        const family = _families.find((f) => f.uid === uid);
        if (family) _openAccountModal(uid, family.name || uid);
      });
    });

    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    console.error('[admin] 載入帳號總覽失敗：', err);
    listEl.innerHTML = `<div class="empty-state text-red">載入失敗：${escapeHtml(err.message)}</div>`;
  }
}

function _renderFamilyAccountsSection({ family, accounts }) {
  if (accounts.length === 0) {
    return `
      <div class="glass-card mb-16">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="font-size:15px; font-weight:700; color:var(--neon-cyan);">
            🏠 ${escapeHtml(family.name || family.uid)}
          </div>
          <div style="display:flex; align-items:center; gap:10px;">
            <span class="badge badge-muted">尚無帳號</span>
            <button type="button" class="btn btn-sm btn-ghost" data-acc-jump="${escapeHtml(family.uid)}">
              <i data-lucide="external-link" style="width:12px;height:12px;"></i> 管理
            </button>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="glass-card mb-16" style="padding:0;">
      <div style="display:flex; justify-content:space-between; align-items:center; padding:14px 20px; border-bottom:1px solid rgba(255,255,255,0.05);">
        <div style="font-size:15px; font-weight:700; color:var(--neon-cyan);">
          🏠 ${escapeHtml(family.name || family.uid)}
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
          <span class="text-muted" style="font-size:12px;">共 ${accounts.length} 個帳號</span>
          <button type="button" class="btn btn-sm btn-ghost" data-acc-jump="${escapeHtml(family.uid)}">
            <i data-lucide="external-link" style="width:12px;height:12px;"></i> 管理
          </button>
        </div>
      </div>
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>顯示名稱</th>
              <th>帳號</th>
              <th>角色</th>
              <th>可輸入</th>
              <th>建立時間</th>
            </tr>
          </thead>
          <tbody>
            ${accounts.map((a) => `
              <tr>
                <td style="font-weight:500;">${escapeHtml(a.displayName || '—')}</td>
                <td class="mono" style="font-size:12px;">${escapeHtml(a.account || '—')}</td>
                <td style="font-size:12px;">${a.role === 'owner' ? '👑 擁有者' : '一般成員'}</td>
                <td>${a.canInput
                  ? '<span class="badge badge-success">可輸入</span>'
                  : '<span class="badge badge-muted">唯讀</span>'}</td>
                <td style="font-size:11px; color:var(--text-muted);">
                  ${a.createdAt > 0 ? new Date(a.createdAt).toLocaleDateString('zh-HK') : '—'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/* ============================================
   帳號管理 Modal
   ============================================ */
async function _openAccountModal(familyId, familyName) {
  _accountModalFamilyId = familyId;
  _accountModalFamilyName = familyName;

  document.getElementById(ACCOUNT_MODAL_ID)?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay active';
  overlay.id = ACCOUNT_MODAL_ID;
  overlay.innerHTML = `
    <div class="modal" style="max-width:720px; max-height:90vh; overflow-y:auto;">
      <h2 class="modal-title">
        <i data-lucide="users" style="width:18px;height:18px;"></i>
        家庭成員帳號 — ${escapeHtml(familyName)}
      </h2>

      <div class="banner" style="margin-bottom:16px;">
        ℹ️ 每個帳號可獨立登入，共用同一份家庭資料。
        「可輸入」控制該帳號是否能新增 / 編輯 / 刪除資料。
      </div>

      <div class="glass-card" style="margin-bottom:16px; padding:16px;">
        <div style="font-size:13px; font-weight:600; color:var(--neon-cyan); margin-bottom:12px;">
          <i data-lucide="user-plus" style="width:14px;height:14px;"></i>
          新增成員帳號
        </div>
        <div id="${ACCOUNT_FORM_ROOT_ID}"></div>
      </div>

      <div class="glass-card" style="padding:0;">
        <div class="collapsible-header" style="padding:12px 16px;">
          <div class="collapsible-header-title">
            <i data-lucide="list" style="width:14px;height:14px;"></i>
            <span>帳號清單 <span class="text-muted" id="admin-account-count" style="font-size:12px;"></span></span>
          </div>
        </div>
        <div id="admin-account-list" style="padding:0;"></div>
      </div>

      <div class="modal-actions" style="margin-top:16px;">
        <button type="button" class="btn btn-ghost" data-action="close">關閉</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(ACCOUNT_MODAL_ID);
    const closeBtn = e.target.closest('button[data-action="close"]');
    if (closeBtn) closeModal(ACCOUNT_MODAL_ID);
  });

  _renderAccountForm();
  await _loadFamilyAccounts();

  if (window.lucide) window.lucide.createIcons();
}

function _renderAccountForm() {
  const formRoot = document.getElementById(ACCOUNT_FORM_ROOT_ID);
  if (!formRoot) return;

  formRoot.innerHTML = '';

  _accountModalFormApi = buildForm({
    containerId: ACCOUNT_FORM_ROOT_ID,
    fields: [
      { type: 'text', id: 'acc-account', label: '帳號（英文 / 數字）', required: true, maxlength: 30, placeholder: '例如：wife', hint: '系統會自動補 @familyfin.local' },
      { type: 'text', id: 'acc-password', label: '密碼', required: true, maxlength: 60, placeholder: '至少 6 位' },
      { type: 'text', id: 'acc-displayname', label: '顯示名稱', required: true, maxlength: 30, placeholder: '例如：媽媽' },
      {
        type: 'select', id: 'acc-role', label: '角色', required: true, includeEmpty: false,
        options: [
          { value: 'member', label: '成員（一般）' },
          { value: 'owner',  label: '擁有者（owner）' },
        ],
        defaultValue: 'member',
      },
      {
        type: 'select', id: 'acc-caninput', label: '可輸入', required: true, includeEmpty: false,
        options: [
          { value: 'true',  label: '可輸入（可新增 / 編輯 / 刪除）' },
          { value: 'false', label: '唯讀（僅可查看）' },
        ],
        defaultValue: 'true',
      },
    ],
    submitText: '新增帳號',
    showCancel: false,
    showReset: true,
    resetText: '重置',
    beforeSubmit: _validateAccountForm,
    onSubmit: _handleCreateAccount,
  });
}

function _validateAccountForm(data) {
  const account = (data['acc-account'] || '').trim().toLowerCase();
  const password = (data['acc-password'] || '');
  const displayName = (data['acc-displayname'] || '').trim();

  if (!account) return { field: 'acc-account', message: '請填寫帳號' };
  if (!/^[a-z0-9._-]+$/.test(account)) {
    return { field: 'acc-account', message: '帳號只能包含小寫英數字、點、底線、連字號' };
  }
  if (!password || password.length < 6) {
    return { field: 'acc-password', message: '密碼至少 6 位' };
  }
  if (!displayName) return { field: 'acc-displayname', message: '請填寫顯示名稱' };

  return true;
}

/* ============================================
   建立帳號（EMAIL_EXISTS → 復原 Modal）
   ============================================ */
async function _handleCreateAccount(data) {
  const account = (data['acc-account'] || '').trim().toLowerCase();
  const password = data['acc-password'] || '';
  const displayName = (data['acc-displayname'] || '').trim();
  const role = data['acc-role'] || 'member';
  const canInput = data['acc-caninput'] === 'true';

  try {
    await api.familyAccounts.create(_accountModalFamilyId, {
      account, password, displayName, role, canInput,
    });

    showToast(`✅ 已建立帳號「${account}」`, 'success');
    _accountModalFormApi?.reset();
    await _loadFamilyAccounts();
    if (_accountsOverviewInstance) _accountsOverviewInstance.refresh?.();
  } catch (err) {
    const isEmailExists =
      err.code === 'EMAIL_EXISTS' ||
      err.message.includes('已存在於 Firebase') ||
      err.message.includes('EMAIL_EXISTS');

    if (isEmailExists) {
      await _showRestoreModal({
        account,
        defaultPassword: password,
        displayName,
        role,
        canInput,
      });
    } else {
      showToast('建立失敗：' + err.message, 'error');
    }
  }
}

/* ============================================
   復原 Modal（可編輯密碼）
   ============================================ */
async function _showRestoreModal({ account, defaultPassword, displayName, role, canInput }) {
  document.getElementById(ACCOUNT_RESTORE_MODAL_ID)?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay active';
  overlay.id = ACCOUNT_RESTORE_MODAL_ID;
  overlay.style.zIndex = '1200';
  overlay.innerHTML = `
    <div class="modal" style="max-width:480px;">
      <h2 class="modal-title">
        <i data-lucide="alert-triangle" style="width:18px;height:18px;color:var(--neon-orange);"></i>
        帳號已存在
      </h2>

      <div class="banner" style="border-color:rgba(251,146,60,0.3); background:rgba(251,146,60,0.06); color:var(--neon-orange); margin-bottom:16px;">
        帳號「${escapeHtml(account)}」在 Firebase 系統中已存在，
        可能是先前建立時未完成初始化。
      </div>

      <div style="font-size:13px; color:var(--text-secondary); line-height:1.6; margin-bottom:16px;">
        若您知道此帳號的<b>舊密碼</b>，可以嘗試「復原」，
        系統會將此帳號重新綁定到當前家庭。
      </div>

      <div id="${ACCOUNT_RESTORE_FORM_ROOT_ID}"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(ACCOUNT_RESTORE_MODAL_ID);
  });

  _accountRestoreFormApi = buildForm({
    containerId: ACCOUNT_RESTORE_FORM_ROOT_ID,
    fields: [
      {
        type: 'text',
        id: 'restore-password',
        label: '舊密碼',
        required: true,
        maxlength: 60,
        placeholder: '請輸入此帳號的舊密碼',
        hint: '若與剛才輸入的不同，請在此修改為舊密碼',
      },
    ],
    submitText: '嘗試復原',
    showCancel: true,
    cancelText: '取消',
    initialData: {
      'restore-password': defaultPassword || '',
    },
    beforeSubmit: (data) => {
      const pwd = (data['restore-password'] || '').trim();
      if (!pwd) return { field: 'restore-password', message: '請輸入舊密碼' };
      if (pwd.length < 6) return { field: 'restore-password', message: '密碼至少 6 位' };
      return true;
    },
    onSubmit: async (data) => {
      const pwd = data['restore-password'] || '';
      await _handleRestoreAccount({
        account,
        password: pwd,
        displayName,
        role,
        canInput,
      });
    },
    onCancel: () => closeModal(ACCOUNT_RESTORE_MODAL_ID),
  });

  if (window.lucide) window.lucide.createIcons();
}

async function _handleRestoreAccount({ account, password, displayName, role, canInput }) {
  try {
    await api.familyAccounts.restore(_accountModalFamilyId, {
      account, password, displayName, role, canInput,
    });
    showToast(`✅ 已復原帳號「${account}」`, 'success');
    closeModal(ACCOUNT_RESTORE_MODAL_ID);
    _accountModalFormApi?.reset();
    await _loadFamilyAccounts();
    if (_accountsOverviewInstance) _accountsOverviewInstance.refresh?.();
  } catch (err) {
    if (err.message.includes('舊密碼錯誤')) {
      showToast('❌ 舊密碼錯誤，請確認後重試', 'error', 4000);
    } else if (err.message.includes('不存在')) {
      showToast('此帳號在 Firebase 系統中不存在，請改用「新增帳號」', 'warning', 4000);
    } else if (err.message.includes('已屬於')) {
      showToast('此帳號已屬於其他家庭，無法復原', 'warning', 4000);
    } else {
      showToast('復原失敗：' + err.message, 'error');
    }
  }
}

/* ============================================
   載入帳號清單
   ============================================ */
async function _loadFamilyAccounts() {
  const listEl = document.getElementById('admin-account-list');
  const countEl = document.getElementById('admin-account-count');
  if (!listEl) return;

  listEl.innerHTML = '<div class="empty-state">載入中…</div>';

  try {
    const result = await api.familyAccounts.list(_accountModalFamilyId);
    const accounts = result.accounts || [];

    if (countEl) countEl.textContent = `（共 ${accounts.length} 個）`;

    if (accounts.length === 0) {
      listEl.innerHTML = '<div class="empty-state" style="padding:20px;">尚無成員帳號</div>';
      return;
    }

    listEl.innerHTML = `
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>顯示名稱</th>
              <th>帳號</th>
              <th>角色</th>
              <th>可輸入</th>
              <th style="width:160px;">操作</th>
            </tr>
          </thead>
          <tbody>
            ${accounts.map((a) => _renderAccountRow(a)).join('')}
          </tbody>
        </table>
      </div>
    `;

    _bindAccountListEvents();
    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    console.error('[admin] 載入帳號清單失敗：', err);
    listEl.innerHTML = `<div class="empty-state text-red">載入失敗：${escapeHtml(err.message)}</div>`;
  }
}

function _renderAccountRow(a) {
  const roleLabel = a.role === 'owner' ? '👑 擁有者' : '一般成員';
  const canInputBadge = a.canInput
    ? '<span class="badge badge-success">可輸入</span>'
    : '<span class="badge badge-muted">唯讀</span>';
  const isOwner = a.role === 'owner';

  return `
    <tr data-uid="${escapeHtml(a.id)}">
      <td style="font-weight:500;">${escapeHtml(a.displayName || '—')}</td>
      <td class="mono" style="font-size:12px;">${escapeHtml(a.account || '—')}</td>
      <td style="font-size:12px;">${roleLabel}</td>
      <td>${canInputBadge}</td>
      <td>
        <button type="button" class="btn btn-sm btn-ghost" data-acc-action="edit" data-uid="${escapeHtml(a.id)}">
          <i data-lucide="pencil" style="width:12px;height:12px;"></i> 編輯
        </button>
        ${isOwner ? '' : `
          <button type="button" class="btn btn-sm btn-danger" data-acc-action="delete" data-uid="${escapeHtml(a.id)}">
            <i data-lucide="trash-2" style="width:12px;height:12px;"></i> 移除
          </button>
        `}
      </td>
    </tr>
  `;
}

function _bindAccountListEvents() {
  const listEl = document.getElementById('admin-account-list');
  if (!listEl) return;

  if (_accountListHandler) {
    listEl.removeEventListener('click', _accountListHandler);
  }

  _accountListHandler = async (e) => {
    const btn = e.target.closest('button[data-acc-action]');
    if (!btn) return;

    const uid = btn.dataset.uid;
    const action = btn.dataset.accAction;

    if (action === 'edit') await _openEditAccountModal(uid);
    else if (action === 'delete') await _handleRemoveAccount(uid);
  };

  listEl.addEventListener('click', _accountListHandler);
}

/* ============================================
   編輯帳號 Modal
   ============================================ */
async function _openEditAccountModal(uid) {
  let accounts = [];
  try {
    const result = await api.familyAccounts.list(_accountModalFamilyId);
    accounts = result.accounts || [];
  } catch (err) {
    showToast('載入帳號失敗：' + err.message, 'error');
    return;
  }

  const account = accounts.find((a) => a.id === uid);
  if (!account) {
    showToast('找不到此帳號', 'error');
    return;
  }

  document.getElementById(ACCOUNT_EDIT_MODAL_ID)?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay active';
  overlay.id = ACCOUNT_EDIT_MODAL_ID;
  overlay.style.zIndex = '1100';
  overlay.innerHTML = `
    <div class="modal" style="max-width:480px;">
      <h2 class="modal-title">編輯成員帳號</h2>
      <div id="${ACCOUNT_EDIT_FORM_ROOT_ID}"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(ACCOUNT_EDIT_MODAL_ID);
  });

  const isOwner = account.role === 'owner';

  _accountEditFormApi = buildForm({
    containerId: ACCOUNT_EDIT_FORM_ROOT_ID,
    fields: [
      {
        type: 'custom',
        id: 'info',
        html: `
          <div class="glass-card-hint" style="margin-bottom:12px;">
            帳號：<b class="mono">${escapeHtml(account.account)}</b>
            ${isOwner ? '<br><span style="color:var(--neon-orange);">⚠️ 擁有者帳號不可降級或移除</span>' : ''}
          </div>
        `,
      },
      { type: 'text', id: 'edit-displayname', label: '顯示名稱', required: true, maxlength: 30 },
      {
        type: 'select', id: 'edit-role', label: '角色', required: true, includeEmpty: false,
        options: isOwner
          ? [{ value: 'owner', label: '擁有者（不可變更）' }]
          : [{ value: 'member', label: '成員（一般）' }],
        defaultValue: account.role,
      },
      {
        type: 'select', id: 'edit-caninput', label: '可輸入', required: true, includeEmpty: false,
        options: [
          { value: 'true',  label: '可輸入（可新增 / 編輯 / 刪除）' },
          { value: 'false', label: '唯讀（僅可查看）' },
        ],
        defaultValue: account.canInput ? 'true' : 'false',
      },
    ],
    submitText: '儲存',
    showCancel: true,
    cancelText: '取消',
    onSubmit: async (data) => {
      try {
        await api.familyAccounts.update(_accountModalFamilyId, uid, {
          displayName: data['edit-displayname'],
          role: data['edit-role'],
          canInput: data['edit-caninput'] === 'true',
        });
        showToast('✅ 已更新帳號', 'success');
        closeModal(ACCOUNT_EDIT_MODAL_ID);
        await _loadFamilyAccounts();
        if (_accountsOverviewInstance) _accountsOverviewInstance.refresh?.();
      } catch (err) {
        showToast('更新失敗：' + err.message, 'error');
      }
    },
    onCancel: () => closeModal(ACCOUNT_EDIT_MODAL_ID),
  });

  openModal(ACCOUNT_EDIT_MODAL_ID);
  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   移除帳號
   ============================================ */
async function _handleRemoveAccount(uid) {
  const ok = await openConfirm(
    `⚠️ 確定要移除此成員帳號嗎？\n\n注意：\n• 只會移除「登入帳號」\n• 不會刪除該成員的財務資料\n• 不會刪除 Firebase Auth 帳號\n• 該成員將無法再登入系統\n• 若需重建同名帳號，需使用「復原」或至 Firebase Console 手動刪除`,
    { title: '移除帳號', okText: '移除', okClass: 'btn-danger' }
  );
  if (!ok) return;

  try {
    await api.familyAccounts.remove(_accountModalFamilyId, uid);
    showToast('✅ 已移除帳號', 'success');
    await _loadFamilyAccounts();
    if (_accountsOverviewInstance) _accountsOverviewInstance.refresh?.();
  } catch (err) {
    showToast('移除失敗：' + err.message, 'error');
  }
}

/* ============================================
   銷毀
   ============================================ */
function _destroy() {
  if (_tabPanel) { try { _tabPanel.destroy(); } catch (e) {} _tabPanel = null; }
  if (_familyInputApi) { try { _familyInputApi.destroy(); } catch (e) {} _familyInputApi = null; }
  if (_defaultsInstance) { try { _defaultsInstance.destroy?.(); } catch (e) {} _defaultsInstance = null; }
  if (_accountsOverviewInstance) { try { _accountsOverviewInstance.destroy?.(); } catch (e) {} _accountsOverviewInstance = null; }

  if (_logoutHandler) {
    document.getElementById('admin-logout-btn')?.removeEventListener('click', _logoutHandler);
    _logoutHandler = null;
  }
  if (_familyListHandler) {
    document.getElementById('admin-family-list')?.removeEventListener('click', _familyListHandler);
    _familyListHandler = null;
  }
  if (_accountListHandler) {
    document.getElementById('admin-account-list')?.removeEventListener('click', _accountListHandler);
    _accountListHandler = null;
  }
  if (_accountModalFormApi) { try { _accountModalFormApi.destroy(); } catch (e) {} _accountModalFormApi = null; }
  if (_accountEditFormApi) { try { _accountEditFormApi.destroy(); } catch (e) {} _accountEditFormApi = null; }
  if (_accountRestoreFormApi) { try { _accountRestoreFormApi.destroy(); } catch (e) {} _accountRestoreFormApi = null; }

  document.getElementById(ACCOUNT_MODAL_ID)?.remove();
  document.getElementById(ACCOUNT_EDIT_MODAL_ID)?.remove();
  document.getElementById(ACCOUNT_RESTORE_MODAL_ID)?.remove();
}