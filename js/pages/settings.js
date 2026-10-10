// ============================================
// settings.js — 系統設定（v103.0.14 Page Schema）
// 位置：js/pages/settings.js
// ============================================
// v103.0.14 修正：
//   ✅ [問題2] 實作個人化 Tab（帳號資訊 / 登出 / 統計卡模式 / 成員列表）
//   ✅ [問題8] vConsole 持久化（跨頁保持）
//   ✅ 保留除錯工具卡（v103.0.13）
// ============================================

import { initTabPanel } from '../ui/tab-panel.js';
import { initBankAccountManager } from '../shared/bank-account-manager.js';
import { initEntityListPage } from '../shared/entity-list-page.js';
import { AppState } from '../core/state.js';
import { logout } from '../core/auth.js';
import { STORAGE_KEYS, ENTITY_KEYS } from '../config/constants.js';
import { showToast } from '../ui/toast.js';
import { openConfirm } from '../ui/modal.js';

export default {
  title: '系統設定',
  data: {},
  state: { activeTab: AppState.isSuperAdmin ? 'platform' : 'banks' },
  derived: {},
  blocks: [],

  customMount: (ctx) => {
    const isSuper = AppState.isSuperAdmin;
    const tabs = [];

    if (isSuper) {
      tabs.push({ key: 'platform', label: '平台設定', icon: 'settings', panelId: 'settings-panel-platform' });
    }
    tabs.push({ key: 'banks', label: '銀行帳號', icon: 'landmark', panelId: 'settings-panel-banks' });
    tabs.push({ key: 'personal', label: '個人化', icon: 'user', panelId: 'settings-panel-personal' });

    ctx._bankMgr = null;
    ctx._memberList = null;
    ctx._debugCleanup = null;
    ctx._personalCleanup = null;

    const tabPanel = initTabPanel({
      containerId: 'settings-tabs',
      tabs,
      defaultKey: isSuper ? 'platform' : 'banks',
      storageKey: 'settings-tab',
      onChange: (key) => {
        if (key === 'banks') {
          if (!ctx._bankMgr) {
            ctx._bankMgr = initBankAccountManager('bank-account-manager-root', {
              canInput: AppState.getCanInput(),
            });
          } else {
            try { ctx._bankMgr.refresh?.(); } catch (e) {}
          }
        }
        if (key === 'personal') {
          _initPersonalTab(ctx);
        }
      },
    });

    ctx._tabPanel = tabPanel;

    const initialKey = tabPanel?.getCurrent?.();
    if (initialKey === 'personal') _initPersonalTab(ctx);

    return {
      destroy: () => {
        try { tabPanel?.destroy(); } catch (e) {}
        if (ctx._bankMgr) { try { ctx._bankMgr.destroy?.(); } catch (e) {} ctx._bankMgr = null; }
        if (ctx._memberList) { try { ctx._memberList.destroy?.(); } catch (e) {} ctx._memberList = null; }
        if (ctx._personalCleanup) { try { ctx._personalCleanup(); } catch (e) {} ctx._personalCleanup = null; }
        if (ctx._debugCleanup) { try { ctx._debugCleanup(); } catch (e) {} ctx._debugCleanup = null; }
      },
    };
  },
};

/* ============================================
   個人化 Tab
   ============================================ */
function _initPersonalTab(ctx) {
  if (ctx._personalCleanup) {
    /* 已初始化過 */
    _renderDebugStatus();
    return;
  }

  /* 1. 帳號資訊 */
  const accEl = document.getElementById('settings-account');
  const roleEl = document.getElementById('settings-role');
  const famEl = document.getElementById('settings-family');
  const memberAcc = AppState.getMemberAccount() || {};

  if (accEl) accEl.value = memberAcc.account || AppState.currentUser?.email?.split('@')[0] || '—';
  if (roleEl) roleEl.value = AppState.getRoleLabel();
  if (famEl) famEl.value = AppState.getFamilyName() || '—';

  /* 2. 登出按鈕 */
  const logoutBtn = document.getElementById('settings-logout-btn');
  const onLogout = async () => {
    const ok = await openConfirm('確定要登出嗎？', { title: '登出', okText: '登出', okClass: 'btn-danger' });
    if (ok) logout();
  };
  if (logoutBtn) logoutBtn.addEventListener('click', onLogout);

  /* 3. 統計卡顯示模式 */
  _renderStatsModeOptions();

  const saveBtn = document.getElementById('save-stats-mode-btn');
  const onSaveMode = () => {
    const selected = document.querySelector('input[name="stats-mode"]:checked');
    if (!selected) return;
    try {
      localStorage.setItem(STORAGE_KEYS.STATS_MODE, selected.value);
      showToast('✅ 已儲存顯示模式', 'success');
    } catch (e) {
      showToast('儲存失敗', 'error');
    }
  };
  if (saveBtn) saveBtn.addEventListener('click', onSaveMode);

  /* 4. 家庭成員列表 */
  const memberRoot = document.getElementById('family-members-root');
  if (memberRoot && !ctx._memberList) {
    ctx._memberList = initEntityListPage({
      entity: ENTITY_KEYS.MEMBER,
      containerId: 'family-members-root',
      options: {
        defaultView: 'table',
        showViewToggle: false,
        storageKey: 'settings-members-view',
        mobileCardMode: true,
      },
    });
  }

  /* 5. 除錯工具卡 */
  _injectDebugCard(ctx);

  ctx._personalCleanup = () => {
    if (logoutBtn) logoutBtn.removeEventListener('click', onLogout);
    if (saveBtn) saveBtn.removeEventListener('click', onSaveMode);
  };

  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   統計卡顯示模式
   ============================================ */
function _renderStatsModeOptions() {
  const root = document.getElementById('stats-mode-options');
  if (!root) return;

  let current = 'auto';
  try {
    current = localStorage.getItem(STORAGE_KEYS.STATS_MODE) || 'auto';
  } catch (e) {}

  const options = [
    { value: 'auto',        label: '自動（依裝置 / 檢視模式）' },
    { value: 'integrated',  label: '整合卡（單一大卡）' },
    { value: 'compact',     label: '緊湊卡（多個小卡）' },
  ];

  root.innerHTML = options.map((o) => `
    <label style="display:flex; align-items:center; gap:8px; cursor:pointer; padding:8px; border-radius:6px; background:rgba(255,255,255,0.03);">
      <input type="radio" name="stats-mode" value="${o.value}" ${o.value === current ? 'checked' : ''} style="width:auto; cursor:pointer;">
      <span style="font-size:13px;">${o.label}</span>
    </label>
  `).join('');
}

/* ============================================
   除錯工具卡
   ============================================ */
function _injectDebugCard(ctx) {
  const grid = document.querySelector('#settings-panel-personal .settings-personal-grid');
  if (!grid) return;

  if (document.getElementById('settings-debug-card')) {
    _renderDebugStatus();
    return;
  }

  const card = document.createElement('div');
  card.className = 'glass-card';
  card.id = 'settings-debug-card';
  card.style.gridColumn = '1 / -1';
  card.innerHTML = `
    <div class="glass-card-title" style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
      <i data-lucide="bug" style="width:16px;height:16px;color:var(--neon-cyan);"></i>
      <span>除錯工具（開發者用）</span>
    </div>
    <p class="glass-card-hint mb-12">
      手機若無 DevTools，可手動開啟 vConsole 檢視日誌。開啟後會**跨頁保持**，
      直到你手動關閉。
    </p>
    <div id="settings-debug-status" style="margin-bottom:12px; font-size:13px;"></div>
    <div style="display:flex; gap:8px; flex-wrap:wrap;">
      <button type="button" class="btn btn-primary" id="settings-debug-enable">
        <i data-lucide="play" style="width:14px;height:14px;"></i> 開啟 vConsole
      </button>
      <button type="button" class="btn btn-ghost" id="settings-debug-disable">
        <i data-lucide="square" style="width:14px;height:14px;"></i> 關閉 vConsole
      </button>
    </div>
  `;
  grid.appendChild(card);

  if (window.lucide) window.lucide.createIcons();

  _renderDebugStatus();
  _bindDebugButtons(ctx);
}

async function _renderDebugStatus() {
  const statusEl = document.getElementById('settings-debug-status');
  if (!statusEl) return;

  try {
    const mod = await import('../core/debug.js');
    const enabled = mod.isDebugEnabled();

    statusEl.innerHTML = enabled
      ? '<span class="badge badge-success">● 已開啟</span> <span class="text-muted" style="font-size:12px; margin-left:6px;">vConsole 正在運行（右下角綠點）</span>'
      : '<span class="badge badge-muted">● 已關閉</span> <span class="text-muted" style="font-size:12px; margin-left:6px;">點擊「開啟 vConsole」以啟用</span>';
  } catch (err) {
    statusEl.innerHTML = '<span class="badge badge-pending">載入失敗</span>';
  }
}

function _bindDebugButtons(ctx) {
  const enableBtn = document.getElementById('settings-debug-enable');
  const disableBtn = document.getElementById('settings-debug-disable');

  const onEnable = async () => {
    if (enableBtn.disabled) return;
    enableBtn.disabled = true;
    const originalText = enableBtn.innerHTML;
    enableBtn.innerHTML = '<i data-lucide="loader" style="width:14px;height:14px;"></i> 載入中…';
    if (window.lucide) window.lucide.createIcons();

    try {
      const mod = await import('../core/debug.js');
      const ok = await mod.forceEnableDebug();
      if (ok) showToast('✅ vConsole 已開啟（跨頁保持）', 'success', 3000);
      else showToast('❌ 載入失敗，請檢查網路', 'error', 4000);
    } catch (err) {
      console.error('[settings] vConsole 開啟失敗：', err);
    } finally {
      enableBtn.disabled = false;
      enableBtn.innerHTML = originalText;
      if (window.lucide) window.lucide.createIcons();
      _renderDebugStatus();
    }
  };

  const onDisable = async () => {
    try {
      const mod = await import('../core/debug.js');
      mod.forceDisableDebug();
      showToast('vConsole 已關閉', 'info', 2000);
    } catch (err) {}
    _renderDebugStatus();
  };

  if (enableBtn) enableBtn.addEventListener('click', onEnable);
  if (disableBtn) disableBtn.addEventListener('click', onDisable);

  ctx._debugCleanup = () => {
    if (enableBtn) enableBtn.removeEventListener('click', onEnable);
    if (disableBtn) disableBtn.removeEventListener('click', onDisable);
  };
}