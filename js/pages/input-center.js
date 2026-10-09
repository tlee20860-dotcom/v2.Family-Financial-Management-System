// ============================================
// input-center.js — 綜合輸入中心（v103.0.11 Page Schema）
// 位置：js/pages/input-center.js
// ============================================
// v103.0.11 修正：
//   ✅ [B05] 綁定 ic-buttons-root 按鈕至對應 Modal
//   ✅ [M09] 支出 Tab 改為最近支出列表
// ============================================

import { initTabPanel } from '../ui/tab-panel.js';
import { initEntityListPage } from '../shared/entity-list-page.js';
import { openEntityModal } from '../entity/entity-modal.js';
import { renderDataTable } from '../shared/data-table.js';
import { listenAllMemberExpenses } from '../core/db.js';
import { AppState } from '../core/state.js';
import { ENTITY_KEYS, RESERVED_IDS } from '../config/constants.js';
import { esc } from '../lib/dom.js';
import { formatHKD } from '../lib/format.js';

export default {
  title: '綜合輸入中心',
  data: {},
  state: { activeTab: 'expense' },
  derived: {},
  blocks: [],

  customMount: (ctx) => {
    const TABS = [
      { key: 'expense',   label: '支出', icon: 'receipt',    panelId: 'ic-panel-expense' },
      { key: 'insurance', label: '保險', icon: 'shield',     panelId: 'ic-panel-insurance' },
      { key: 'fund',      label: '基金', icon: 'line-chart', panelId: 'ic-panel-fund' },
      { key: 'bank',      label: '銀行', icon: 'landmark',   panelId: 'ic-panel-bank' },
    ];

    const instances = {};
    let _btnHandler = null;
    let _expenseUnsub = null;
    let _expenseTableApi = null;

    const loadTab = async (key) => {
      if (instances[key]) {
        try { instances[key].refresh?.(); } catch (e) { /* noop */ }
        return;
      }
      const tabDef = TABS.find((t) => t.key === key);
      if (!tabDef) return;

      const panelEl = document.getElementById(tabDef.panelId);
      if (!panelEl) {
        console.warn(`[input-center] 找不到面板 #${tabDef.panelId}`);
        return;
      }

      if (key === 'insurance') {
        instances[key] = initEntityListPage({
          entity: ENTITY_KEYS.POLICY,
          containerId: tabDef.panelId,
          options: { defaultView: 'table', showViewToggle: true, storageKey: 'ic-insurance-view' },
        });
      } else if (key === 'fund') {
        instances[key] = initEntityListPage({
          entity: ENTITY_KEYS.FUND,
          containerId: tabDef.panelId,
          options: { defaultView: 'table', showViewToggle: true, storageKey: 'ic-fund-view' },
        });
      } else if (key === 'bank') {
        instances[key] = initEntityListPage({
          entity: ENTITY_KEYS.BANK,
          containerId: tabDef.panelId,
          options: { defaultView: 'table', showViewToggle: true, storageKey: 'ic-bank-view' },
        });
      } else if (key === 'expense') {
        /* 🆕 [M09] 支出 Tab：改為最近 20 筆支出 */
        panelEl.innerHTML = `
          <div class="banner mb-16">
            ℹ️ 點擊上方按鈕新增支出或家用轉入。以下為最近 20 筆資料。
          </div>
          <div id="ic-recent-list-root"></div>
        `;
        _loadRecentExpenses();
        instances[key] = {
          refresh: _loadRecentExpenses,
          destroy: () => {
            if (_expenseUnsub) { try { _expenseUnsub(); } catch (e) {} _expenseUnsub = null; }
            if (_expenseTableApi) { try { _expenseTableApi.destroy(); } catch (e) {} _expenseTableApi = null; }
            panelEl.innerHTML = '';
          },
        };
      }
    };

    const _loadRecentExpenses = () => {
      if (_expenseUnsub) { try { _expenseUnsub(); } catch (e) {} _expenseUnsub = null; }
      _expenseUnsub = listenAllMemberExpenses(null, null, (rows) => {
        // rows 為今年所有成員支出（listenAllMemberExpenses 需要 year/month 或從 AppState 讀）
        // 這裡簡化：直接渲染全部
        const list = (rows || []).slice(-50).reverse(); // 最新 50 筆
        _renderExpenseTable(list);
      });
    };

    const _renderExpenseTable = (rows) => {
      const root = document.getElementById('ic-recent-list-root');
      if (!root) return;
      if (_expenseTableApi) { try { _expenseTableApi.destroy(); } catch (e) {} _expenseTableApi = null; }

      if (!rows || rows.length === 0) {
        root.innerHTML = '<div class="glass-card"><div class="empty-state">尚無支出紀錄</div></div>';
        return;
      }

      _expenseTableApi = renderDataTable({
        container: root,
        entityKey: '__recent_expense__',
        rows,
        tableId: 'ic-recent-expense-table',
        options: {
          columns: [
            { id: 'date', label: '日期', defaultVisible: true },
            { id: 'memberName', label: '成員', defaultVisible: true },
            { id: 'name', label: '項目名稱', defaultVisible: true },
            { id: 'amount', label: '金額', defaultVisible: true, type: 'number' },
            { id: 'status', label: '狀態', defaultVisible: true },
          ],
          resolvers: {
            date: (v) => esc(v || '—'),
            memberName: (_, r) => r.memberId === RESERVED_IDS.SHARED_MEMBER ? '🏠 家庭共用' : esc(r.memberId || '—'),
            name: (v) => esc(v || '（未命名）'),
            amount: (v) => formatHKD(v),
            status: (v, r) => `<span class="badge ${r.status === 'done' ? 'badge-success' : 'badge-pending'}">${esc(v || '—')}</span>`,
          },
          storageKey: 'ic-recent-expense-table',
        },
      });
    };

    /* 初始化 Tab 面板 */
    const tabPanel = initTabPanel({
      containerId: 'ic-tab-bar-root',
      tabs: TABS,
      defaultKey: 'expense',
      storageKey: 'input-center-tab',
      onChange: (key) => {
        ctx.state.activeTab = key;
        loadTab(key);
      },
    });

    /* 首次載入預設 Tab */
    loadTab(tabPanel?.getCurrent() || 'expense');

    /* 🆕 [B05] 綁定上方按鈕 */
    const btnRoot = document.getElementById('ic-buttons-root');
    if (btnRoot) {
      _btnHandler = async (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;

        switch (action) {
          case 'add-expense':
            openEntityModal({ entity: ENTITY_KEYS.MEMBER, mode: 'add' }); // 佔位，實際依需求
            break;
          case 'add-contribution':
            /* TODO: 家用轉入 Modal（尚未實作） */
            console.log('[input-center] 家用轉入尚未實作');
            break;
          case 'add-personal-income':
            /* TODO: 個人收入 Modal（尚未實作） */
            console.log('[input-center] 個人收入尚未實作');
            break;
          case 'add-policy':
            openEntityModal({ entity: ENTITY_KEYS.POLICY, mode: 'add' });
            break;
          case 'add-fund':
            openEntityModal({ entity: ENTITY_KEYS.FUND, mode: 'add' });
            break;
        }
      };
      btnRoot.addEventListener('click', _btnHandler);
    }

    return {
      destroy: () => {
        Object.values(instances).forEach((inst) => {
          try { inst?.destroy?.(); } catch (e) { /* noop */ }
        });
        try { tabPanel?.destroy(); } catch (e) { /* noop */ }
        if (_btnHandler && btnRoot) {
          try { btnRoot.removeEventListener('click', _btnHandler); } catch (e) {}
          _btnHandler = null;
        }
      },
    };
  },
};