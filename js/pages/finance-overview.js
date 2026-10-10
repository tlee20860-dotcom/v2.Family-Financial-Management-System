// ============================================
// finance-overview.js — 銀行交易（v103.0.19）
// 位置：js/pages/finance-overview.js
// ============================================
// v103.0.19 修正：
//   ✅ 副標題改為顯示年月
// ============================================

import { formatHKD } from '../lib/format.js';
import { esc } from '../lib/dom.js';
import { calcTotalBankBalance, calcBankBalance } from '../lib/bank.js';
import { renderDataTable } from '../shared/data-table.js';
import { renderStatsCards } from '../shared/stats-cards.js';
import { resolveName } from '../config/entity-registry.js';
import { AppState } from '../core/state.js';

export default {
  title: '銀行交易',
  data: {
    bankAccounts:     { type: 'list', path: 'bank_accounts' },
    bankTransactions: { type: 'raw', path: 'bank_accounts', transform: _flatten },
  },
  state: {
    activeTab: 'banks',
    currentYear: String(AppState.year || new Date().getFullYear()),
    currentMonth: String(AppState.month || '12'),
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
    let _statsApi = null, _tabH = null, _filterH = null;

    const syncState = () => {
      const y = String(AppState.year || new Date().getFullYear());
      const m = String(AppState.month || '12');
      if (ctx.state.currentYear !== y) ctx.state.currentYear = y;
      if (ctx.state.currentMonth !== m) ctx.state.currentMonth = m;
    };

    const syncSubtitle = () => {
      const el = document.getElementById('finance-month-label');
      if (el) el.textContent = AppState.getYearMonthLabel();
    };

    const render = () => {
      const statsRoot = document.getElementById('finance-stats-root');
      if (statsRoot) {
        if (_statsApi) { try { _statsApi.destroy(); } catch (e) {} }
        statsRoot.innerHTML = '';
        _statsApi = renderStatsCards({ container: 'finance-stats-root', cards: ctx.derived.statsCards || [], columns: 4 });
      }

      document.querySelectorAll('#finance-tabs .tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === ctx.state.activeTab));
      const bp = document.getElementById('finance-panel-banks');
      const tp = document.getElementById('finance-panel-transactions');
      if (bp) bp.style.display = ctx.state.activeTab === 'banks' ? 'block' : 'none';
      if (tp) tp.style.display = ctx.state.activeTab === 'transactions' ? 'block' : 'none';

      if (ctx.state.activeTab === 'banks') _paintBanks(ctx);
      else _paintTxns(ctx);
    };

    const tabsRoot = document.getElementById('finance-tabs');
    _tabH = (e) => {
      const btn = e.target.closest('button[data-tab]');
      if (!btn) return;
      ctx.state.activeTab = btn.dataset.tab;
      render();
    };
    tabsRoot?.addEventListener('click', _tabH);

    const filterRoot = document.getElementById('finance-txn-filter-root');
    if (filterRoot) {
      filterRoot.innerHTML = `<div class="page-filter-bar"><div class="filter-group"><label class="field-label">類型</label><select class="select" data-filter="type"><option value="">全部</option><option value="in">入帳</option><option value="out">出帳</option><option value="transfer">內部轉帳</option></select></div><div class="filter-group"><label class="field-label">分類</label><select class="select" data-filter="category"><option value="">全部</option><option value="contribution">家用轉入</option><option value="expense">支出</option><option value="insurance">保險</option><option value="reimbursement">代墊報銷</option><option value="manual">手動</option></select></div></div>`;
      _filterH = (e) => {
        const sel = e.target.closest('select[data-filter]');
        if (!sel) return;
        ctx.state.txFilters[sel.dataset.filter] = sel.value;
        render();
      };
      filterRoot.addEventListener('change', _filterH);
    }

    syncState();
    syncSubtitle();
    render();

    const unsub = ctx.onDataChange((key) => {
      if (key === '__APP__') { syncState(); syncSubtitle(); }
      render();
    });

    return {
      destroy: () => {
        unsub();
        if (_statsApi) { try { _statsApi.destroy(); } catch (e) {} }
        if (_tabH) tabsRoot?.removeEventListener('click', _tabH);
        if (_filterH) filterRoot?.removeEventListener('change', _filterH);
      },
    };
  },
};

function _paintBanks(ctx) {
  const root = document.getElementById('finance-banks-root');
  if (!root) return;
  const accounts = ctx.data.bankAccounts || [];
  const txns = ctx.data.bankTransactions || [];
  const { year, month } = AppState.getYearMonth();
  const rows = accounts.map((acc) => {
    const accTxns = txns.filter((t) => t.bankId === acc.id);
    return { ...acc, _balance: calcBankBalance(acc, accTxns, year, month === 'all' ? '12' : month), _txnCount: accTxns.length };
  });
  if (rows.length === 0) {
    if (root.__lastHtml === '<empty>') return;
    root.__lastHtml = '<empty>';
    root.innerHTML = '<div class="glass-card"><div class="empty-state">尚無銀行帳號</div></div>';
    return;
  }
  root.__lastHtml = '';
  renderDataTable({
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
}

function _paintTxns(ctx) {
  const root = document.getElementById('finance-txn-root');
  if (!root) return;
  const rows = ctx.derived.filteredTxns || [];
  if (rows.length === 0) {
    if (root.__lastHtml === '<empty>') return;
    root.__lastHtml = '<empty>';
    root.innerHTML = '<div class="glass-card"><div class="empty-state">此條件下尚無交易記錄</div></div>';
    return;
  }
  root.__lastHtml = '';
  renderDataTable({
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
        typeLabel: (v) => `<span class="badge ${v === 'in' ? 'badge-success' : (v === 'transfer' ? 'badge-info' : 'badge-pending')}">${{in:'入帳',out:'出帳',transfer:'內部轉帳'}[v] || v || '—'}</span>`,
        categoryLabel: (v) => `<span class="badge badge-info">${esc(v || '未分類')}</span>`,
        memberName: (v) => v === 'shared' ? '🏠 家庭共用' : esc(resolveName('members', v) || v || '—'),
        amount: (v, r) => `<span class="mono ${r.type === 'in' ? 'text-emerald' : 'text-red'}">${formatHKD(v)}</span>`,
        note: (v) => esc(v || '—'),
      },
      storageKey: 'finance-txn-table',
    },
  });
}

function _flatten(raw) {
  const flat = [];
  Object.entries(raw || {}).forEach(([bankId, bank]) => {
    Object.entries(bank?.transactions || {}).forEach(([txnId, txn]) => {
      flat.push({ id: txnId, bankId, bankName: bank?.name || '', ...txn });
    });
  });
  return flat;
}

function _buildStats(accounts, txns, year, month) {
  const list = accounts || [], txnList = txns || [];
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
  if (filters.type) out = out.filter((t) => t.type === filters.type);
  if (filters.category) out = out.filter((t) => t.category === filters.category);
  if (filters.member) out = out.filter((t) => t.memberId === filters.member);
  return [...out].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

/* ═══════════════════════════════════════════
   END OF FILE
   File: js/pages/finance-overview.js
   Version: v103.0.19
   Batch: B20
   ═══════════════════════════════════════════ */