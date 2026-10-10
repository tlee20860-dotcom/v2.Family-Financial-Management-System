// ============================================
// input-center.js — 綜合輸入中心（v103.0.19）
// 位置：js/pages/input-center.js
// ============================================
// v103.0.19 修正：
//   ✅ 支出 Tab 加 view toggle
// ============================================

import { initTabPanel } from '../ui/tab-panel.js';
import { initEntityListPage } from '../shared/entity-list-page.js';
import { renderDataTable } from '../shared/data-table.js';
import { renderDataCard } from '../shared/data-card.js';
import { openExpenseModal } from '../lib/expense-modal.js';
import { openContributionModal, openPersonalIncomeModal } from '../lib/income-modal.js';
import { openEntityModal } from '../entity/entity-modal.js';
import { openConfirm } from '../ui/modal.js';
import { showToast } from '../ui/toast.js';
import { initViewToggle } from '../ui/view-toggle.js';
import { listenAllExpenses, removeExpense } from '../core/db.js';
import { resolveName } from '../config/entity-registry.js';
import { AppState } from '../core/state.js';
import { ENTITY_KEYS, RESERVED_IDS } from '../config/constants.js';
import { esc } from '../lib/dom.js';
import { formatHKD } from '../lib/format.js';

export default {
  title: '綜合輸入中心',
  data: {},
  state: { activeTab: 'expense', expenseView: 'table' },
  derived: {},
  blocks: [],

  customMount: (ctx) => {
    const TABS = [
      { key: 'expense', label: '支出', icon: 'receipt', panelId: 'ic-panel-expense' },
      { key: 'insurance', label: '保險', icon: 'shield', panelId: 'ic-panel-insurance' },
      { key: 'fund', label: '基金', icon: 'line-chart', panelId: 'ic-panel-fund' },
      { key: 'bank', label: '銀行', icon: 'landmark', panelId: 'ic-panel-bank' },
    ];
    const inst = {};
    let _btnH = null, _expUnsub = null, _expTableApi = null, _expCardApi = null;
    let _expToggle = null, _expRows = [];

    const loadTab = (key) => {
      if (inst[key]) { try { inst[key].refresh?.(); } catch (e) {} return; }
      const tabDef = TABS.find((t) => t.key === key);
      if (!tabDef) return;
      const panelEl = document.getElementById(tabDef.panelId);
      if (!panelEl) return;

      if (key === 'insurance') {
        inst[key] = initEntityListPage({ entity: ENTITY_KEYS.POLICY, containerId: tabDef.panelId, options: { defaultView: 'table', showViewToggle: true, storageKey: 'ic-insurance-view', mobileCardMode: true } });
      } else if (key === 'fund') {
        inst[key] = initEntityListPage({ entity: ENTITY_KEYS.FUND, containerId: tabDef.panelId, options: { defaultView: 'table', showViewToggle: true, storageKey: 'ic-fund-view', mobileCardMode: true } });
      } else if (key === 'bank') {
        inst[key] = initEntityListPage({ entity: ENTITY_KEYS.BANK, containerId: tabDef.panelId, options: { defaultView: 'table', showViewToggle: true, storageKey: 'ic-bank-view', mobileCardMode: true } });
      } else if (key === 'expense') {
        panelEl.innerHTML = `
          <div class="flex flex-between items-center mb-16 flex-wrap gap-12">
            <div class="banner" style="margin:0;flex:1;min-width:200px;">ℹ️ 以下為最近 50 筆支出。</div>
            <div id="ic-expense-view-toggle"></div>
          </div>
          <div id="ic-expense-table-root"></div>
        `;
        _initExpenseViewToggle();
        _loadExpenses();
        inst[key] = {
          refresh: _loadExpenses,
          destroy: () => {
            if (_expUnsub) { try { _expUnsub(); } catch (e) {} _expUnsub = null; }
            _destroyExpenseLists();
            if (_expToggle) { try { _expToggle.destroy(); } catch (e) {} _expToggle = null; }
            panelEl.innerHTML = '';
          },
        };
      }
    };

    const _initExpenseViewToggle = () => {
      _expToggle = initViewToggle({
        containerId: 'ic-expense-view-toggle',
        storageKey: 'ic-expense-view',
        defaultView: 'table',
        onChange: (view) => { ctx.state.expenseView = view; _paintExpenses(); },
      });
      ctx.state.expenseView = _expToggle?.getView() || 'table';
    };

    const _destroyExpenseLists = () => {
      if (_expTableApi) { try { _expTableApi.destroy(); } catch (e) {} _expTableApi = null; }
      if (_expCardApi) { try { _expCardApi.destroy(); } catch (e) {} _expCardApi = null; }
    };

    const _loadExpenses = () => {
      if (_expUnsub) { try { _expUnsub(); } catch (e) {} _expUnsub = null; }
      _expUnsub = listenAllExpenses((rows) => {
        const { year } = AppState.getYearMonth();
        _expRows = (rows || []).filter((r) => String(r.year) === String(year)).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 50);
        _paintExpenses();
      });
    };

    const _columns = [
      { id: 'date', label: '日期', defaultVisible: true },
      { id: 'memberName', label: '成員', defaultVisible: true },
      { id: 'name', label: '項目名稱', defaultVisible: true },
      { id: 'amount', label: '金額', defaultVisible: true, type: 'number' },
      { id: 'status', label: '狀態', defaultVisible: true },
    ];

    const _resolvers = {
      date: (v) => esc(v || '—'),
      memberName: (_, r) => r.memberId === RESERVED_IDS.SHARED_MEMBER ? '🏠 家庭共用' : esc(resolveName('members', r.memberId) || r.memberId || '—'),
      name: (v) => esc(v || '（未命名）'),
      amount: (v) => formatHKD(v),
      status: (v) => `<span class="badge ${v === 'done' ? 'badge-success' : 'badge-pending'}">${esc(v || '—')}</span>`,
    };

    const _hooks = (canInput) => ({
      customActions: canInput ? (row) => [
        { label: '編輯', icon: 'pencil', className: 'btn-ghost', action: 'edit', onClick: () => openExpenseModal({ row, onSuccess: _loadExpenses }) },
        { label: '刪除', icon: 'trash-2', className: 'btn-danger', action: 'del', onClick: async () => {
          const ok = await openConfirm(`確定要刪除「${row.name}」嗎？`, { okText: '刪除', okClass: 'btn-danger' });
          if (!ok) return;
          try { await removeExpense(row.year, row.month, row.memberId, row.id); showToast('✅ 已刪除', 'success'); }
          catch (err) { showToast('刪除失敗：' + err.message, 'error'); }
        }},
      ] : () => [],
    });

    const _paintExpenses = () => {
      const root = document.getElementById('ic-expense-table-root');
      if (!root) return;
      _destroyExpenseLists();

      if (_expRows.length === 0) {
        root.innerHTML = '<div class="glass-card"><div class="empty-state">尚無支出紀錄</div></div>';
        return;
      }
      const canInput = AppState.getCanInput();

      if (ctx.state.expenseView === 'card') {
        _expCardApi = renderDataCard({
          container: root,
          entityKey: '__recent_expense__',
          rows: _expRows,
          options: { gridClass: 'grid grid-3', columns: _columns, resolvers: _resolvers },
          hooks: _hooks(canInput),
        });
      } else {
        _expTableApi = renderDataTable({
          container: root,
          entityKey: '__recent_expense__',
          rows: _expRows,
          tableId: 'ic-recent-expense-table',
          options: {
            mobileCardMode: true,
            columns: _columns,
            resolvers: _resolvers,
            storageKey: 'ic-recent-expense-table',
          },
          hooks: _hooks(canInput),
        });
      }
    };

    const tabPanel = initTabPanel({
      containerId: 'ic-tab-bar-root',
      tabs: TABS,
      defaultKey: 'expense',
      storageKey: 'input-center-tab',
      onChange: (key) => { ctx.state.activeTab = key; loadTab(key); },
    });
    loadTab(tabPanel?.getCurrent() || 'expense');

    const btnRoot = document.getElementById('ic-buttons-root');
    if (btnRoot) {
      _btnH = (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        switch (btn.dataset.action) {
          case 'add-expense': openExpenseModal({ onSuccess: _loadExpenses }); break;
          case 'add-contribution': openContributionModal({ onSuccess: _loadExpenses }); break;
          case 'add-personal-income': openPersonalIncomeModal(); break;
          case 'add-policy': openEntityModal({ entity: ENTITY_KEYS.POLICY, mode: 'add' }); break;
          case 'add-fund': openEntityModal({ entity: ENTITY_KEYS.FUND, mode: 'add' }); break;
        }
      };
      btnRoot.addEventListener('click', _btnH);
    }

    return {
      destroy: () => {
        Object.values(inst).forEach((i) => { try { i?.destroy?.(); } catch (e) {} });
        try { tabPanel?.destroy(); } catch (e) {}
        if (_btnH && btnRoot) { try { btnRoot.removeEventListener('click', _btnH); } catch (e) {} }
      },
    };
  },
};

/* ═══════════════════════════════════════════
   END OF FILE
   File: js/pages/input-center.js
   Version: v103.0.19
   Batch: B20
   ═══════════════════════════════════════════ */