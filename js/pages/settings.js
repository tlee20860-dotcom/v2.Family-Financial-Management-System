// ============================================
// settings.js — 系統設定（v103.0.13 Page Schema）
// 位置：js/pages/settings.js
// ============================================
// v103.0.13 修正：
//   ✅ 個人化 Tab 加入「除錯工具」卡（vConsole 開啟/關閉）
//   ✅ 銀行帳號 Tab 切回時呼叫 refresh()
// ============================================

import { initTabPanel } from '../ui/tab-panel.js';
import { initBankAccountManager } from '../shared/bank-account-manager.js';
import { AppState } from '../core/state.js';

export default {
  title: '系統設定',

  data: {},

  state: {
    activeTab: AppState.isSuperAdmin ? 'platform' : 'banks',
  },

  derived: {},

  blocks: [],

  customMount: (ctx) => {
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
      key: 'banks',
      label: '銀行帳號',
      icon: 'landmark',
      panelId: 'settings-panel-banks',
    });

    tabs.push({
      key: 'personal',
      label: '個人化',
      icon: 'user',
      panelId: 'settings-panel-personal',
    });

    ctx._bankMgr = null;
    ctx._debugCleanup = null;

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
            try { ctx._bankMgr.refresh?.(); } catch (e) { /* noop */ }
          }
        }
        if (key === 'personal') {
          _injectDebugCard(ctx);
        }
      },
    });

    ctx._tabPanel = tabPanel;

    /* 初始若預設 Tab 是 personal，也注入 */
    const initialKey = tabPanel?.getCurrent?.();
    if (initialKey === 'personal') {
      _injectDebugCard(ctx);
    }

    return {
      destroy: () => {
        try { tabPanel?.destroy(); } catch (e) { /* noop */ }
        if (ctx._bankMgr) {
          try { ctx._bankMgr.destroy?.(); } catch (e) { /* noop */ }
          ctx._bankMgr = null;
        }
        if (ctx._debugCleanup) {
          try { ctx._debugCleanup(); } catch (e) { /* noop */ }
          ctx._debugCleanup = null;
        }
      },
    };
  },
};

/* ============================================
   除錯工具卡（動態注入至個人化 Tab）
   ============================================ */
function _injectDebugCard(ctx) {
  const grid = document.querySelector('#settings-panel-personal .settings-personal-grid');
  if (!grid) {
    console.warn('[settings] 找不到個人化 grid');
    return;
  }

  // 已注入 → 只更新狀態
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
      手機若無 DevTools，可手動開啟 vConsole 檢視日誌與錯誤訊息。
      開啟後頁面右下角會出現綠色按鈕，點擊即可展開 Console。
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
      const { showToast } = await import('../ui/toast.js');

      if (ok) {
        showToast('✅ vConsole 已開啟（右下角綠點）', 'success', 3000);
      } else {
        showToast('❌ 載入失敗，請檢查網路', 'error', 4000);
      }
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
      const { showToast } = await import('../ui/toast.js');
      showToast('vConsole 已關閉', 'info', 2000);
    } catch (err) {
      console.error('[settings] vConsole 關閉失敗：', err);
    } finally {
      _renderDebugStatus();
    }
  };

  if (enableBtn) enableBtn.addEventListener('click', onEnable);
  if (disableBtn) disableBtn.addEventListener('click', onDisable);

  /* 儲存清理函式到 ctx，供 destroy 時移除 */
  ctx._debugCleanup = () => {
    if (enableBtn) enableBtn.removeEventListener('click', onEnable);
    if (disableBtn) disableBtn.removeEventListener('click', onDisable);
  };
}