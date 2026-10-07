// ============================================
// admin.js — 平台管理入口（v101.3）
// 位置：js/admin/admin.js
// ============================================
// v101.3 修正：
//   ✅ 移除未使用的 openModal / closeModal import
//   ✅ 移除未使用的 FAMILY_MODAL_ID 變數
// ============================================

import { api } from '../core/api.js';
import { escapeHtml } from '../core/utils.js';
import { logout } from '../core/auth.js';
import { AppState } from '../core/state.js';
import { showToast } from '../shared/toast.js';
import { openConfirm } from '../shared/modal.js';
import { buildForm } from '../shared/form-builder.js';
import { initTabPanel } from '../shared/tab-panel.js';
import { initPlatformDefaults } from './platform-defaults.js';

/* ============================================
   Module 狀態
   ============================================ */
let _families = [];
let _familyInputApi = null;
let _tabPanel = null;
let _defaultsInstance = null;

/* ============================================
   主入口
   ============================================ */
export function initAdminPage() {
  // 權限檢查
  if (!AppState.isSuperAdmin) {
    alert('您沒有權限存取此頁面');
    window.location.href = 'index.html';
    return;
  }

  // 登出按鈕
  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    const ok = await openConfirm('確定要登出嗎？', {
      title: '登出',
      okText: '登出',
      okClass: 'btn-danger',
    });
    if (ok) logout();
  });

  // 建立 2 層 Tab
  _tabPanel = initTabPanel({
    containerId: 'admin-tabs',
    tabs: [
      { key: 'families', label: '家庭管理', icon: 'home',   panelId: 'admin-panel-families' },
      { key: 'defaults', label: '預設資料庫', icon: 'database', panelId: 'admin-panel-defaults' },
    ],
    defaultKey: 'families',
    storageKey: 'admin-tab',
    onChange: (key) => _onTabChange(key),
  });

  // 初始化家庭管理面板
  _renderFamilyPanel();

  return {
    destroy: _destroy,
  };
}

/* ============================================
   Tab 切換
   ============================================ */
function _onTabChange(key) {
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

  // 新增家庭表單
  _familyInputApi = buildForm({
    containerId: 'admin-family-form-root',
    fields: [
      {
        type: 'text',
        id: 'adm-fam-uid',
        label: 'Firebase UID',
        required: true,
        placeholder: '在 Firebase Auth 建立後複製 UID',
        maxlength: 60,
        hint: '請先在 Firebase 控制台建立家庭帳號，再將 UID 貼上。',
      },
      {
        type: 'text',
        id: 'adm-fam-name',
        label: '家庭名稱',
        required: true,
        placeholder: '例如：陳家',
        maxlength: 30,
      },
      {
        type: 'text',
        id: 'adm-fam-email',
        label: '擁有者 Email（可選）',
        placeholder: '例如：chen@familyfin.local',
        maxlength: 60,
      },
    ],
    submitText: '新增家庭',
    showCancel: false,
    showReset: true,
    resetText: '重置',
    onSubmit: _handleAddFamily,
  });

  // 清單事件
  _bindFamilyListEvents();

  // 載入清單
  _loadFamilies();
}

/* ============================================
   新增家庭
   ============================================ */
async function _handleAddFamily(data) {
  const uid = (data['adm-fam-uid'] || '').trim();
  const name = (data['adm-fam-name'] || '').trim();
  const email = (data['adm-fam-email'] || '').trim();

  if (!uid || !name) {
    return { field: 'adm-fam-uid', message: '請填寫 UID 與家庭名稱' };
  }

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
      <table class="data-table mobile-cards">
        <thead>
          <tr>
            <th>家庭名稱</th>
            <th class="hide-mobile">擁有者 Email</th>
            <th class="hide-mobile">UID</th>
            <th class="hide-mobile">建立時間</th>
            <th style="width:220px;">操作</th>
          </tr>
        </thead>
        <tbody>
          ${_families.map((f) => `
            <tr data-uid="${escapeHtml(f.uid)}">
              <td data-primary="1">${escapeHtml(f.name || '')}</td>
              <td class="hide-mobile" data-label="Email" style="font-size:12px;">
                ${escapeHtml(f.ownerEmail || '—')}
              </td>
              <td class="hide-mobile" data-label="UID" style="font-size:11px; color:var(--text-muted); font-family:var(--font-mono); word-break:break-all;">
                ${escapeHtml(f.uid)}
              </td>
              <td class="hide-mobile" data-label="建立時間" style="font-size:11px; color:var(--text-muted);">
                ${f.createdAt ? new Date(f.createdAt).toLocaleString('zh-HK') : '—'}
              </td>
              <td data-label="操作">
                <button class="btn btn-sm btn-primary" data-action="enter" data-uid="${escapeHtml(f.uid)}">進入</button>
                <button class="btn btn-sm btn-ghost" data-action="init" data-uid="${escapeHtml(f.uid)}">初始化</button>
                <button class="btn btn-sm btn-danger" data-action="delete" data-uid="${escapeHtml(f.uid)}">刪除</button>
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

  listEl.addEventListener('click', async (e) => {
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
      case 'init':
        await _handleInit(uid, family);
        break;
      case 'delete':
        await _handleDelete(uid, family);
        break;
    }
  });
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
    if (result.skipped) {
      showToast('此家庭已有資料，略過初始化', 'warning');
    } else {
      showToast('✅ 已初始化預設資料', 'success');
    }
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
  } catch (err) {
    showToast('刪除失敗：' + err.message, 'error');
  }
}

/* ============================================
   銷毀
   ============================================ */
function _destroy() {
  if (_tabPanel) {
    try { _tabPanel.destroy(); } catch (e) { /* noop */ }
    _tabPanel = null;
  }
  if (_familyInputApi) {
    try { _familyInputApi.destroy(); } catch (e) { /* noop */ }
    _familyInputApi = null;
  }
  if (_defaultsInstance) {
    try { _defaultsInstance.destroy?.(); } catch (e) { /* noop */ }
    _defaultsInstance = null;
  }
}
