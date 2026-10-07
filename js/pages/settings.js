// ============================================
// settings.js — 系統設定（v101，2 分頁）
// 位置：js/pages/settings.js
// ============================================
// 分頁 1：平台設定（僅 superadmin 可見）
//   - UI 常數（名稱截斷長度 / Toast 時間）
// 分頁 2：個人化（所有人可見）
//   - 帳號資訊 / 登出 / 側邊欄排序
//
// 註：平台預設資料庫（成員/類別/項目...）已移至 admin.html
// ============================================

import {
  ALL_MENU_ITEMS,
  DEFAULT_ORDER,
  watchSidebarOrder,
  persistSidebarOrder,
  resetSidebarOrder,
  moveOrderItem,
  sortByOrder,
} from '../shared/sidebar-order.js';
import { showToast } from '../shared/toast.js';
import { escapeHtml, formatHKD } from '../core/utils.js';
import { getDisplayName, logout } from '../core/auth.js';
import { AppState } from '../core/state.js';
import { getUIConstants, initAppConfig } from '../config/app-config.js';
import { api } from '../core/api.js';
import { buildForm } from '../shared/form-builder.js';
import { initTabPanel } from '../shared/tab-panel.js';
import { openConfirm } from '../shared/modal.js';

/* ============================================
   Module 狀態
   ============================================ */
let _tabPanel = null;
let _uiFormApi = null;
let _currentOrder = [...DEFAULT_ORDER];
let _unsubOrder = null;

/* ============================================
   主入口
   ============================================ */
export function initSettingsPage() {
  const isSuper = AppState.isSuperAdmin;

  // 建立分頁（superadmin 才顯示「平台設定」）
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

  // 帳號資訊
  _renderAccountInfo();

  // 平台設定（superadmin）
  if (isSuper) {
    _renderPlatformPanel();
  } else {
    // 非 superadmin 隱藏 panel
    const panel = document.getElementById('settings-panel-platform');
    if (panel) panel.style.display = 'none';
  }

  // 個人化（側邊欄排序）
  _renderPersonalPanel();

  return {
    destroy: _destroy,
  };
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

  // 登出按鈕
  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    const ok = await openConfirm('確定要登出嗎？', {
      title: '登出',
      okText: '登出',
      okClass: 'btn-danger',
    });
    if (ok) logout();
  });
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
      {
        type: 'number',
        id: 'st-name-desktop',
        label: '名稱截斷長度（桌面）',
        required: true,
        min: 4,
        max: 40,
        step: 1,
        hint: '桌面版表格中的名稱最多顯示幾個字元',
      },
      {
        type: 'number',
        id: 'st-name-mobile',
        label: '名稱截斷長度（手機）',
        required: true,
        min: 2,
        max: 20,
        step: 1,
        hint: '手機版表格中的名稱最多顯示幾個字元',
      },
      {
        type: 'number',
        id: 'st-toast-duration',
        label: 'Toast 顯示時間（毫秒）',
        required: true,
        min: 500,
        max: 10000,
        step: 100,
        hint: '提示訊息的顯示時間',
      },
    ],
    submitText: '儲存平台設定',
    showCancel: false,
    showReset: false,
    onSubmit: _handlePlatformSave,
  });

  // 載入目前值
  _reloadUIConstants();
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

  // 基本驗證
  if (payload.nameMaxLenDesktop < 4 || payload.nameMaxLenDesktop > 40) {
    return { field: 'st-name-desktop', message: '請填寫 4 ~ 40 之間的數字' };
  }
  if (payload.nameMaxLenMobile < 2 || payload.nameMaxLenMobile > 20) {
    return { field: 'st-name-mobile', message: '請填寫 2 ~ 20 之間的數字' };
  }
  if (payload.toastDuration < 500 || payload.toastDuration > 10000) {
    return { field: 'st-toast-duration', message: '請填寫 500 ~ 10000 之間的數字' };
  }

  try {
    await api.platformSettings.update(payload);
    showToast('✅ 平台設定已儲存', 'success');

    // 重新載入 app-config 快取
    try {
      await initAppConfig(AppState.getFamilyId());
    } catch (e) { /* noop */ }
  } catch (err) {
    showToast('儲存失敗：' + err.message, 'error');
  }
}

/* ============================================
   個人化
   ============================================ */
function _renderPersonalPanel() {
  const listEl = document.getElementById('sidebar-order-list');
  if (!listEl) return;

  // 監聽排序
  _unsubOrder = watchSidebarOrder((order) => {
    _currentOrder = order;
    _renderOrderList();
  });

  // 重置按鈕
  document.getElementById('reset-sidebar-order-btn')?.addEventListener('click', async () => {
    const ok = await openConfirm('確定要重置為預設順序嗎？', {
      title: '重置側邊欄順序',
      okText: '重置',
      okClass: 'btn-danger',
    });
    if (!ok) return;

    try {
      await resetSidebarOrder();
      showToast('✅ 已重置為預設順序', 'success');
    } catch (err) {
      showToast('重置失敗：' + err.message, 'error');
    }
  });
}

function _renderOrderList() {
  const listEl = document.getElementById('sidebar-order-list');
  if (!listEl) return;

  const sorted = sortByOrder(ALL_MENU_ITEMS, _currentOrder);

  listEl.innerHTML = `
    <div style="border:1px solid var(--glass-border); border-radius:var(--radius-md); overflow:hidden;">
      ${sorted.map((item, i) => {
        const isFirst = i === 0;
        const isLast = i === sorted.length - 1;
        return `
          <div class="sidebar-order-row" style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; border-bottom:${isLast ? 'none' : '1px solid rgba(255,255,255,0.05)'};">
            <div style="display:flex; align-items:center; gap:10px;">
              <span class="mono" style="font-size:11px; color:var(--text-muted); min-width:20px;">${i + 1}.</span>
              <i data-lucide="${item.icon}" style="width:16px;height:16px;color:var(--neon-cyan);"></i>
              <span style="font-size:14px;">${escapeHtml(item.label)}</span>
            </div>
            <div style="display:flex; gap:4px;">
              <button class="btn btn-sm btn-ghost" data-action="up" data-href="${item.href}"
                ${isFirst ? 'disabled' : ''} title="上移" style="padding:4px 8px; line-height:1;">
                <i data-lucide="chevron-up" style="width:14px;height:14px;"></i>
              </button>
              <button class="btn btn-sm btn-ghost" data-action="down" data-href="${item.href}"
                ${isLast ? 'disabled' : ''} title="下移" style="padding:4px 8px; line-height:1;">
                <i data-lucide="chevron-down" style="width:14px;height:14px;"></i>
              </button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  // 綁定上下移動
  listEl.querySelectorAll('button[data-action]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const href = btn.dataset.href;
      const action = btn.dataset.action;
      await _handleMove(href, action);
    });
  });
}

async function _handleMove(href, direction) {
  const newOrder = moveOrderItem(_currentOrder, href, direction);
  if (newOrder.join(',') === _currentOrder.join(',')) return;

  try {
    await persistSidebarOrder(newOrder);
    _currentOrder = newOrder;
    _renderOrderList();
    showToast('✅ 已更新排序', 'success');
  } catch (err) {
    showToast('更新失敗：' + err.message, 'error');
    console.error('[settings] 排序儲存失敗：', err);
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
  if (_uiFormApi) {
    try { _uiFormApi.destroy(); } catch (e) { /* noop */ }
    _uiFormApi = null;
  }
  if (_unsubOrder) {
    try { _unsubOrder(); } catch (e) { /* noop */ }
    _unsubOrder = null;
  }
}