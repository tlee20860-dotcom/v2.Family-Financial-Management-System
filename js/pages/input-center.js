// input-center.js — 綜合輸入中心（v103.0.18）
import { initTabPanel } from '../ui/tab-panel.js';
import { initEntityListPage } from '../shared/entity-list-page.js';
import { renderDataTable } from '../shared/data-table.js';
import { openExpenseModal } from '../lib/expense-modal.js';
import { openContributionModal, openPersonalIncomeModal } from '../lib/income-modal.js';
import { openEntityModal } from '../entity/entity-modal.js';
import { openConfirm } from '../ui/modal.js';
import { showToast } from '../ui/toast.js';
import { listenAllExpenses, removeExpense } from '../core/db.js';
import { resolveName } from '../config/entity-registry.js';
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
      { key: 'expense', label: '支出', icon: 'receipt', panelId: 'ic-panel-expense' },
      { key: 'insurance', label: '保險', icon: 'shield', panelId: 'ic-panel-insurance' },
      { key: 'fund', label: '基金', icon: 'line-chart', panelId: 'ic-panel-fund' },
      { key: 'bank', label: '銀行', icon: 'landmark', panelId: 'ic-panel-bank' },
    ];
    const inst = {};
    let _btnH = null, _expUnsub = null, _expTableApi = null;

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
        panelEl.innerHTML = '<div class="banner mb-16">ℹ️ 以下為最近 50 筆支出。</div><div id="ic-expense-table-root"></div>';
        _loadExpenses();
        inst[key] = {
          refresh: _loadExpenses,
          destroy: () => {
            if (_expUnsub) { try { _expUnsub(); } catch (e) {} _expUnsub = null; }
            if (_expTableApi) { try { _expTableApi.destroy(); } catch (e) {} _expTableApi = null; }
            panelEl.innerHTML = '';
          },
        };
      }
    };

    const _loadExpenses = () => {
      if (_expUnsub) { try { _expUnsub(); } catch (e) {} _expUnsub = null; }
      _expUnsub = listenAllExpenses((rows) => {
        const { year } = AppState.getYearMonth();
        const list = (rows || []).filter((r) => String(r.year) === String(year)).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 50);
        _paintExpenses(list);
      });
    };

    const _paintExpenses = (rows) => {
      const root = document.getElementById('ic-expense-table-root');
      if (!root) return;
      if (_expTableApi) { try { _expTableApi.destroy(); } catch (e) {} _expTableApi = null; }
      if (rows.length === 0) {
        root.innerHTML = '<div class="glass-card"><div class="empty-state">尚無支出紀錄</div></div>';
        return;
      }
      const canInput = AppState.getCanInput();
      _expTableApi = renderDataTable({
        container: root,
        entityKey: '__recent_expense__',
        rows,
        tableId: 'ic-recent-expense-table',
        options: {
          mobileCardMode: true,
          columns: [
            { id: 'date', label: '日期', defaultVisible: true },
            { id: 'memberName', label: '成員', defaultVisible: true },
            { id: 'name', label: '項目名稱', defaultVisible: true },
            { id: 'amount', label: '金額', defaultVisible: true, type: 'number' },
            { id: 'status', label: '狀態', defaultVisible: true },
          ],
          resolvers: {
            date: (v) => esc(v || '—'),
            memberName: (_, r) => r.memberId === RESERVED_IDS.SHARED_MEMBER ? '🏠 家庭共用' : esc(resolveName('members', r.memberId) || r.memberId || '—'),
            name: (v) => esc(v || '（未命名）'),
            amount: (v) => formatHKD(v),
            status: (v) => `<span class="badge ${v === 'done' ? 'badge-success' : 'badge-pending'}">${esc(v || '—')}</span>`,
          },
          storageKey: 'ic-recent-expense-table',
        },
        hooks: {
          customActions: canInput ? (row) => [
            { label: '編輯', icon: 'pencil', className: 'btn-ghost', action: 'edit', onClick: () => openExpenseModal({ row, onSuccess: _loadExpenses }) },
            { label: '刪除', icon: 'trash-2', className: 'btn-danger', action: 'del', onClick: async () => {
              const ok = await openConfirm(`確定要刪除「${row.name}」嗎？`, { okText: '刪除', okClass: 'btn-danger' });
              if (!ok) return;
              try { await removeExpense(row.year, row.month, row.memberId, row.id); showToast('✅ 已刪除', 'success'); }
              catch (err) { showToast('刪除失敗：' + err.message, 'error'); }
            }},
          ] : () => [],
        },
      });
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
        if (_btnH && btnRoot) _btnRootRemove();
      },
    };
    function _btnRootRemove() { try { btnRoot.removeEventListener('click', _btnH); } catch (e) {} }
  },
};