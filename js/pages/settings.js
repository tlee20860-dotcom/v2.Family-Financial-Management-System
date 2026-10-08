// ============================================
// settings.js — 系統設定（v101.7.5）
// 位置：js/pages/settings.js
// ============================================
// v101.7.5 修正：
//   ✅ [廢除] 移除「側邊欄排序」功能
//       - 移除 sidebar-order.js 相關 import
//       - 移除 _renderPersonalPanel / _renderOrderList / _handleMove
//       - 移除 _currentOrder / _unsubOrder
//   ✅ 保留：平台設定 / 統計卡顯示模式 / 帳號資訊 / 登出
// ============================================

import { showToast } from '../shared/toast.js';
import { escapeHtml } from '../core/utils.js';
import { getDisplayName, logout } from '../core/auth.js';
import { AppState } from '../core/state.js';
import { getUIConstants, initAppConfig } from '../config/app-config.js';
import { api } from '../core/api.js';
import { buildForm } from '../shared/form-builder.js';
import { initTabPanel } from '../shared/tab-panel.js';
import { openConfirm } from '../shared/modal.js';
import { registerPageCleanup } from '../core/app.js';
import { STORAGE_KEYS } from '../config/constants.js';

/* ============================================
   Module 狀態
   ============================================ */
let _tabPanel = null;
let _uiFormApi = null;
let _logoutHandler = null;
let _saveStatsModeHandler = null;

/* ============================================
   主入口
   ============================================ */
export function initSettingsPage() {
  const isSuper = AppState.isSuperAdmin;

  const tabs = [];
  if (isSuper) {
    tabs.push({
      key: 'platform',
      label: '平台設定',
      icon: 'settings',
      panelId: 'settings-panel-platform',
    });
  }
  tabs.push({
    key: 'personal',
    label: '個人化',
    icon: 'user',
    panelId: 'settings-panel-personal',
  });

  _tabPanel = initTabPanel({
    containerId: 'settings-tabs',
    tabs,
    defaultKey: isSuper ? 'platform' : 'personal',
    storageKey: 'settings-tab',
    onChange: (key) => _onTabChange(key),
  });

  _renderAccountInfo();

  if (isSuper) {
    _renderPlatformPanel();
  } else {
    const panel = document.getElementById('settings-panel-platform');
    if (panel) panel.style.display = 'none';
  }

  _renderStatsModePanel();

  registerPageCleanup(_destroy);

  return { destroy: _destroy };
}

/* ============================================
   Tab 切換
   ============================================ */
function _onTabChange(key) {
  if (key === 'platform' && AppState.isSuperAdmin) {
    _reloadUIConstants();
  }
}

/* ============================================
   帳號資訊
   ============================================ */
function _renderAccountInfo() {
  const user = AppState.currentUser;
  if (!user) return;

  const accountEl = document.getElementById('settings-account');
  if (accountEl) accountEl.value = getDisplayName(user);

  const roleEl = document.getElementById('settings-role');
  if (roleEl) {
    roleEl.value = AppState.isSuperAdmin ? '超級管理員' : '家庭成員';
  }

  const familyEl = document.getElementById('settings-family');
  if (familyEl) {
    familyEl.value = AppState.getFamilyName() || '—';
  }

  _logoutHandler = async () => {
    const ok = await openConfirm('確定要登出嗎？', {
      title: '登出',
      okText: '登出',
      okClass: 'btn-danger',
    });
    if (ok) logout();
  };
  document.getElementById('settings-logout-btn')?.addEventListener('click', _logoutHandler);
}

/* ============================================
   平台設定（superadmin）
   ============================================ */
function _renderPlatformPanel() {
  const formRoot = document.getElementById('settings-platform-form-root');
  if (!formRoot) return;

  formRoot.innerHTML = '';
  _uiFormApi = buildForm({
    containerId: 'settings-platform-form-root',
    fields: [
      { type: 'number', id: 'st-name-desktop', label: '名稱截斷長度（桌面）', required: true, min: 4, max: 40, step: 1, hint: '桌面版表格中的名稱最多顯示幾個字元' },
      { type: 'number', id: 'st-name-mobile', label: '名稱截斷長度（手機）', required: true, min: 2, max: 20, step: 1, hint: '手機版表格中的名稱最多顯示幾個字元' },
      { type: 'number', id: 'st-toast-duration', label: 'Toast 顯示時間（毫秒）', required: true, min: 500, max: 10000, step: 100, hint: '提示訊息的顯示時間' },
    ],
    submitText: '儲存平台設定',
    showCancel: false,
    showReset: false,
    beforeSubmit: _validatePlatformSettings,
    onSubmit: _handlePlatformSave,
  });

  _reloadUIConstants();
}

function _validatePlatformSettings(data) {
  const desktop = Number(data['st-name-desktop']);
  const mobile = Number(data['st-name-mobile']);
  const toast = Number(data['st-toast-duration']);

  if (isNaN(desktop) || desktop < 4 || desktop > 40) {
    return { field: 'st-name-desktop', message: '請填寫 4 ~ 40 之間的數字' };
  }
  if (isNaN(mobile) || mobile < 2 || mobile > 20) {
    return { field: 'st-name-mobile', message: '請填寫 2 ~ 20 之間的數字' };
  }
  if (isNaN(toast) || toast < 500 || toast > 10000) {
    return { field: 'st-toast-duration', message: '請填寫 500 ~ 10000 之間的數字' };
  }
  return true;
}

function _reloadUIConstants() {
  if (!_uiFormApi) return;
  const cfg = getUIConstants();
  _uiFormApi.setData({
    'st-name-desktop': cfg.nameMaxLenDesktop,
    'st-name-mobile': cfg.nameMaxLenMobile,
    'st-toast-duration': cfg.toastDuration,
  });
}

async function _handlePlatformSave(data) {
  const payload = {
    nameMaxLenDesktop: Number(data['st-name-desktop']),
    nameMaxLenMobile: Number(data['st-name-mobile']),
    toastDuration: Number(data['st-toast-duration']),
  };

  try {
    await api.platformSettings.update(payload);
    showToast('✅ 平台設定已儲存', 'success');
    try { await initAppConfig(AppState.getFamilyId()); } catch (e) { /* noop */ }
  } catch (err) {
    showToast('儲存失敗：' + err.message, 'error');
  }
}

/* ============================================
   統計卡顯示模式
   ============================================ */
function _renderStatsModePanel() {
  const optionsRoot = document.getElementById('stats-mode-options');
  if (!optionsRoot) return;

  // 讀取當前模式
  let currentMode = 'auto';
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.STATS_MODE);
    if (saved === 'auto' || saved === 'integrated' || saved === 'compact') {
      currentMode = saved;
    }
  } catch (e) { /* noop */ }

  // 套用選中狀態
  optionsRoot.querySelectorAll('input[name="stats-mode"]').forEach((radio) => {
    radio.checked = (radio.value === currentMode);
  });

  // 點擊整個 label 也能選中
  optionsRoot.querySelectorAll('.stats-mode-option').forEach((label) => {
    label.addEventListener('click', (e) => {
      const radio = label.querySelector('input[type="radio"]');
      if (radio && e.target !== radio) {
        radio.checked = true;
      }
      _updateStatsModeSelection(optionsRoot);
    });
  });

  _updateStatsModeSelection(optionsRoot);

  // 儲存按鈕
  _saveStatsModeHandler = async () => {
    const selected = optionsRoot.querySelector('input[name="stats-mode"]:checked');
    if (!selected) return;

    const newMode = selected.value;
    const oldMode = currentMode;

    try {
      localStorage.setItem(STORAGE_KEYS.STATS_MODE, newMode);
    } catch (e) {
      showToast('儲存失敗', 'error');
      return;
    }

    if (newMode === oldMode) {
      showToast('顯示模式未變更', 'info');
      return;
    }

    _showReloadPrompt();
  };

  document.getElementById('save-stats-mode-btn')?.addEventListener('click', _saveStatsModeHandler);
}

function _updateStatsModeSelection(optionsRoot) {
  optionsRoot.querySelectorAll('.stats-mode-option').forEach((label) => {
    const radio = label.querySelector('input[type="radio"]');
    if (!radio) return;
    const isChecked = radio.checked;
    label.style.borderColor = isChecked ? 'var(--neon-cyan)' : 'var(--glass-border)';
    label.style.background = isChecked ? 'rgba(0, 240, 255, 0.05)' : 'transparent';
  });
}

function _showReloadPrompt() {
  const MODAL_ID = 'stats-mode-reload-modal';
  document.getElementById(MODAL_ID)?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay active';
  overlay.id = MODAL_ID;
  overlay.innerHTML = `
    <div class="modal" style="max-width:400px;">
      <h2 class="modal-title">✅ 已儲存顯示模式</h2>
      <div style="font-size:14px; line-height:1.6; color:var(--text-secondary);">
        統計卡顯示模式已更新。請重新整理頁面以套用變更。
      </div>
      <div class="modal-actions" style="margin-top:20px;">
        <button type="button" class="btn btn-primary" data-action="reload">
          <i data-lucide="refresh-cw" style="width:14px;height:14px;"></i>
          立即重新整理
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action="reload"]');
    if (btn) {
      window.location.reload();
    }
  });

  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   銷毀
   ============================================ */
function _destroy() {
  if (_tabPanel) { try { _tabPanel.destroy(); } catch (e) {} _tabPanel = null; }
  if (_uiFormApi) { try { _uiFormApi.destroy(); } catch (e) {} _uiFormApi = null; }
  if (_logoutHandler) {
    document.getElementById('settings-logout-btn')?.removeEventListener('click', _logoutHandler);
    _logoutHandler = null;
  }
  if (_saveStatsModeHandler) {
    document.getElementById('save-stats-mode-btn')?.removeEventListener('click', _saveStatsModeHandler);
    _saveStatsModeHandler = null;
  }
}