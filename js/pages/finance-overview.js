// ============================================
// finance-overview.js — 銀行交易（v103.0.14 Page Schema）
// 位置：js/pages/finance-overview.js
// ============================================
// v103.0.14 修正：
//   ✅ [問題9] 加 customMount 處理 tab 切換 + 銀行清單渲染
// ============================================

import { formatHKD } from '../lib/format.js';
import { esc } from '../lib/dom.js';
import { calcTotalBankBalance } from '../lib/bank.js';
import { renderDataTable } from '../shared/data-table.js';
import { renderDataCard } from '../shared/data-card.js';
import { renderStatsCards } from '../shared/stats-cards.js';
import { resolveName } from '../config/entity-registry.js';
import { AppState } from '../core/state.js';
import { ENTITY_KEYS } from '../config/constants.js';

export default {
  title: '銀行交易',

  data: {
    bankAccounts:     { type: 'list', path: 'bank_accounts' },
    bankTransactions: { type: 'raw',  path: 'bank_accounts', transform: _flattenTxns },
    members:          { type: 'list', path: 'members' },
  },

  state: {
    activeTab: 'banks',
    txFilters: { type: '', category: '', member: '' },
  },

  derived: {
    statsCards: {
      deps: ['data.bankAccounts', 'data.bankTransactions', 'state.currentYear', 'state.currentMonth'],
      compute: _buildStats,
    },
    filteredTxns: {
      deps: ['data.bankTransactions', 'state.txFilters', 'state.currentYear', 'state.currentMonth'],
      compute: _filterTxns,
    },
  },

  blocks: [],

  customMount: (ctx) => {
    let _statsApi = null;
    let _bankTableApi = null;
    let _txnTableApi = null;
    let _tabHandler = null;
    let _filterHandler = null;

    /* 1. Stats */
    const _renderStats = () => {
      if (_statsApi) { try { _statsApi.destroy(); } catch (e) {} _statsApi = null; }
      const cards = ctx.derived.statsCards || [];
      if (cards.length) {
        _statsApi = renderStatsCards({ container: 'finance-stats-root', cards, columns: 4 });
      }
    };

    /* 2. 銀行清單 */
    const _renderBanks = () => {
      const root = document.getElementById('finance-banks-root');
      if (!root) return;
      if (_bankTableApi) { try { _bankTableApi.destroy(); } catch (e) {} _bankTableApi = null; }

      const accounts = ctx.data.bankAccounts || [];
      const txns = ctx.data.bankTransactions || [];
      const { year, month } = AppState.getYearMonth();

      /* 加「當前餘額」欄位 */
      const rows = accounts.map((acc) => {
        const accTxns = txns.filter((t) => t.bankId === acc.id);
        const { calcBankBalance } = _getBankHelper();
        const balance = calcBankBalance(acc, accTxns, year, month === 'all' ? '12' : month);
        return { ...acc, _balance: balance, _txnCount: accTxns.length };
      });

      if (rows.length === 0) {
        root.innerHTML = '<div class="glass-card"><div class="empty-state">尚無銀行帳號</div></div>';
        return;
      }

      _bankTableApi = renderDataTable({
        container: root,
        entityKey: '__bank_account__',
        rows,
        tableId: 'finance-banks-table',
        options: {
          mobileCardMode: true,
          columns: [
            { id: 'name', label: '名稱', defaultVisible: true },
            { id: 'type', label: '類型', defaultVisible: true },
            { id: 'initialBalance', label: '初始餘額', defaultVisible: true, type: 'number' },
            { id: 'balance', label: '當前餘額', defaultVisible: true, type: 'number' },
            { id: 'txnCount', label: '交易筆數', defaultVisible: true, type: 'number' },
          ],
          resolvers: {
            name: (v) => esc(v || '—'),
            type: (v) => v === 'personal' ? '👤 個人' : '🏠 家庭',
            initialBalance: (v) => formatHKD(v),
            balance: (v) => `<span class="mono ${v >= 0 ? 'text-emerald' : 'text-red'}">${formatHKD(v)}</span>`,
            txnCount: (v) => `<span class="mono">${v || 0}</span>`,
          },
          storageKey: 'finance-banks-table',
        },
      });
    };

    /* 3. 交易記錄 */
    const _renderTransactions = () => {
      const root = document.getElementById('finance-txn-root');
      if (!root) return;
      if (_txnTableApi) { try { _txnTableApi.destroy(); } catch (e) {} _txnTableApi = null; }

      const rows = ctx.derived.filteredTxns || [];
      if (rows.length === 0) {
        root.innerHTML = '<div class="glass-card"><div class="empty-state">此條件下尚無交易記錄</div></div>';
        return;
      }

      _txnTableApi = renderDataTable({
        container: root,
        entityKey: '__bank_txn__',
        rows,
        tableId: 'finance-txn-table',
        options: {
          mobileCardMode: true,
          columns: [
            { id: 'date', label: '日期', defaultVisible: true },
            { id: 'bankName', label: '銀行', defaultVisible: true },
            { id: 'typeLabel', label: '類型', defaultVisible: true },
            { id: 'categoryLabel', label: '分類', defaultVisible: true },
            { id: 'memberName', label: '成員', defaultVisible: true },
            { id: 'amount', label: '金額', defaultVisible: true, type: 'number' },
            { id: 'note', label: '備註', defaultVisible: true },
          ],
          resolvers: {
            date: (v) => esc(v || '—'),
            bankName: (v) => esc(v || '—'),
            typeLabel: (v) => `<span class="badge ${_typeBadgeCls(v)}">${_typeLabel(v)}</span>`,
            categoryLabel: (v) => `<span class="badge badge-info">${_catLabel(v)}</span>`,
            memberName: (v) => v === 'shared' ? '🏠 家庭共用' : esc(resolveName('members', v) || v || '—'),
            amount: (v, r) => `<span class="mono ${r.type === 'in' ? 'text-emerald' : 'text-red'}">${formatHKD(v)}</span>`,
            note: (v) => esc(v || '—'),
          },
          storageKey: 'finance-txn-table',
        },
      });
    };

    /* 4. Tab 切換 */
    const _switchTab = (tabKey) => {
      ctx.state.activeTab = tabKey;
      document.querySelectorAll('#finance-tabs .tab-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.tab === tabKey);
      });
      document.getElementById('finance-panel-banks').style.display = tabKey === 'banks' ? 'block' : 'none';
      document.getElementById('finance-panel-transactions').style.display = tabKey === 'transactions' ? 'block' : 'none';
      if (tabKey === 'transactions') _renderTransactions();
    };

    /* 5. 篩選 */
    const _initFilter = () => {
      const filterRoot = document.getElementById('finance-txn-filter-root');
      if (!filterRoot) return;
      filterRoot.innerHTML = `
        <div class="page-filter-bar">
          <div class="filter-group">
            <label class="field-label">類型</label>
            <select class="select" data-filter="type">
              <option value="">全部</option>
              <option value="in">入帳</option>
              <option value="out">出帳</option>
              <option value="transfer">內部轉帳</option>
            </select>
          </div>
          <div class="filter-group">
            <label class="field-label">分類</label>
            <select class="select" data-filter="category">
              <option value="">全部</option>
              <option value="contribution">家用轉入</option>
              <option value="expense">支出</option>
              <option value="insurance">保險</option>
              <option value="reimbursement">代墊報銷</option>
              <option value="manual">手動</option>
            </select>
          </div>
        </div>
      `;
      _filterHandler = (e) => {
        const sel = e.target.closest('select[data-filter]');
        if (!sel) return;
        ctx.state.txFilters[sel.dataset.filter] = sel.value;
        _renderTransactions();
      };
      filterRoot.addEventListener('change', _filterHandler);
    };

    /* 初次渲染 */
    _renderStats();
    _renderBanks();
    _initFilter();

    /* Tab 事件 */
    const tabsRoot = document.getElementById('finance-tabs');
    if (tabsRoot) {
      _tabHandler = (e) => {
        const btn = e.target.closest('button[data-tab]');
        if (!btn) return;
        _switchTab(btn.dataset.tab);
      };
      tabsRoot.addEventListener('click', _tabHandler);
    }

    /* 監聽 derived 變化 */
    const _orig = ctx.invalidate;
    ctx.invalidate = (key) => {
      _orig(key);
      setTimeout(() => {
        _renderStats();
        if (ctx.state.activeTab === 'banks') _renderBanks();
        else _renderTransactions();
      }, 0);
    };

    return {
      destroy: () => {
        if (_statsApi) { try { _statsApi.destroy(); } catch (e) {} }
        if (_bankTableApi) { try { _bankTableApi.destroy(); } catch (e) {} }
        if (_txnTableApi) { try { _txnTableApi.destroy(); } catch (e) {} }
        if (_tabHandler && tabsRoot) tabsRoot.removeEventListener('click', _tabHandler);
        const filterRoot = document.getElementById('finance-txn-filter-root');
        if (_filterHandler && filterRoot) filterRoot.removeEventListener('change', _filterHandler);
      },
    };
  },
};

/* ============================================
   Helpers
   ============================================ */
function _flattenTxns(rawAccounts) {
  const flat = [];
  Object.entries(rawAccounts || {}).forEach(([bankId, bank]) => {
    Object.entries(bank?.transactions || {}).forEach(([txnId, txn]) => {
      flat.push({ id: txnId, bankId, bankName: bank?.name || '', ...txn });
    });
  });
  return flat;
}

function _buildStats(accounts, txns, year, month) {
  const list = accounts || [];
  const txnList = txns || [];
  const tM = month === 'all' ? '12' : (month || '12');
  const y = year || String(new Date().getFullYear());

  const total = calcTotalBankBalance(list, txnList, y, tM);
  const prefix = `${y}-${String(tM).padStart(2, '0')}`;
  const monthTxns = txnList.filter((t) => (t.date || '').startsWith(prefix));
  const inTotal = monthTxns.filter((t) => t.type === 'in').reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const outTotal = monthTxns.filter((t) => t.type !== 'in').reduce((s, t) => s + (Number(t.amount) || 0), 0);

  return [
    { title: '家庭總餘額', value: formatHKD(total), valueClass: total >= 0 ? 'emerald' : 'red', hint: `共 ${list.length} 個銀行帳號`, icon: 'landmark' },
    { title: '本月入帳', value: formatHKD(inTotal), valueClass: 'emerald', hint: `${monthTxns.filter((t) => t.type === 'in').length} 筆`, icon: 'arrow-down-circle' },
    { title: '本月出帳', value: formatHKD(outTotal), valueClass: 'red', hint: `${monthTxns.filter((t) => t.type !== 'in').length} 筆`, icon: 'arrow-up-circle' },
    { title: '本月淨變動', value: formatHKD(inTotal - outTotal), valueClass: (inTotal - outTotal) >= 0 ? 'emerald' : 'red', hint: '入帳 − 出帳', icon: 'trending-up' },
  ];
}

function _filterTxns(txns, filters, year, month) {
  const list = txns || [];
  const y = year || String(new Date().getFullYear());
  const tM = month === 'all' ? null : (month || null);
  let out = list;

  if (tM) {
    const prefix = `${y}-${String(tM).padStart(2, '0')}`;
    out = out.filter((t) => (t.date || '').startsWith(prefix));
  } else {
    out = out.filter((t) => (t.date || '').startsWith(y));
  }
  if (filters.type)     out = out.filter((t) => t.type === filters.type);
  if (filters.category) out = out.filter((t) => t.category === filters.category);
  if (filters.member)   out = out.filter((t) => t.memberId === filters.member);

  return [...out].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

let _bankHelperCache = null;
function _getBankHelper() {
  if (!_bankHelperCache) {
    /* 同步 import 不好，改用動態 —— 但已在檔案頂部 import calcTotalBankBalance
       這裡直接簡化：用簡單實作 */
    _bankHelperCache = {
      calcBankBalance: (acc, txns, y, m) => {
        const init = Number(acc.initialBalance) || 0;
        const initY = Number(acc.initialYear) || 0;
        const initM = Number(acc.initialMonth) || 0;
        if (!initY || !initM) return init;
        const tY = Number(y), tM = Number(m);
        if (tY < initY || (tY === initY && tM < initM)) return init;
        let balance = init;
        (txns || []).forEach((txn) => {
          const date = txn.date || '';
          if (!date || date.length < 7) return;
          const [yy, mm] = date.split('-').map(Number);
          const afterInit = yy > initY || (yy === initY && mm > initM);
          const beforeTarget = yy < tY || (yy === tY && mm <= tM);
          if (!afterInit || !beforeTarget) return;
          const amt = Number(txn.amount) || 0;
          if (txn.type === 'in') balance += amt;
          else if (txn.type === 'out' || txn.type === 'transfer') balance -= amt;
        });
        return balance;
      },
    };
  }
  return _bankHelperCache;
}

function _typeLabel(v) {
  return { in: '入帳', out: '出帳', transfer: '內部轉帳' }[v] || v || '—';
}
function _typeBadgeCls(v) {
  return v === 'in' ? 'badge-success' : (v === 'transfer' ? 'badge-info' : 'badge-pending');
}
function _catLabel(v) {
  return {
    contribution: '家用轉入', expense: '支出', insurance: '保險',
    reimbursement: '代墊報銷', manual: '手動',
  }[v] || v || '未分類';
}