// ============================================
// member-report.js — 成員收支明細（v103.0.19）
// 位置：js/pages/member-report.js
// ============================================
// v103.0.19 修正：
//   ✅ 加 view toggle（卡片/表格切換）
//   ✅ 副標題改為顯示成員數 + 年度
// ============================================

import { formatHKD } from '../lib/format.js';
import { esc } from '../lib/dom.js';
import { AppState } from '../core/state.js';
import { RESERVED_IDS } from '../config/constants.js';
import { renderDataTable } from '../shared/data-table.js';
import { renderDataCard } from '../shared/data-card.js';
import { initViewToggle } from '../ui/view-toggle.js';

export default {
  title: '成員與家庭收入與支出明細',
  data: {
    members:           { type: 'list', path: 'members' },
    allIncome:         { type: 'raw', path: 'income' },
    allExpenses:       { type: 'raw', path: 'expenses' },
    allPersonalIncome: { type: 'raw', path: 'personal_income' },
  },
  state: {
    currentYear: String(AppState.year || new Date().getFullYear()),
    view: 'table',
  },
  derived: {
    rows: {
      deps: ['data.members', 'data.allIncome', 'data.allExpenses', 'data.allPersonalIncome', 'state.currentYear'],
      compute: _buildRows,
    },
    statsCards: {
      deps: ['rows', 'state.currentYear'],
      compute: _buildStats,
    },
  },
  blocks: [
    { type: 'stats', container: 'member-report-stats-root', cards: '$.statsCards' },
  ],

  customMount: (ctx) => {
    let _tableApi = null, _cardApi = null, _toggle = null;

    const syncSubtitle = () => {
      const el = document.getElementById('member-report-subtitle');
      if (!el) return;
      const { year } = AppState.getYearMonth();
      const memberCount = (ctx.data.members || []).length;
      el.textContent = `${year} 年 · ${memberCount} 位成員`;
    };

    const _columns = [
      { id: 'name', label: '成員', defaultVisible: true },
      { id: 'income', label: '家用轉入', defaultVisible: true, type: 'number' },
      { id: 'personalIncome', label: '個人收入', defaultVisible: true, type: 'number' },
      { id: 'expense', label: '支出', defaultVisible: true, type: 'number' },
      { id: 'insurance', label: '保險', defaultVisible: true, type: 'number' },
      { id: 'net', label: '淨額', defaultVisible: true, type: 'number' },
    ];

    const _resolvers = {
      name: (v, r) => esc(v) + (r.isShared ? ' <span class="badge badge-muted" style="font-size:10px;">🏠</span>' : ''),
      income: (_, r) => r.isShared ? '<span class="text-muted">—</span>' : `<span class="text-emerald">${formatHKD(r.income)}</span>`,
      personalIncome: (_, r) => (r.isShared || r.personalIncome === 0) ? '<span class="text-muted">—</span>' : `<span class="text-cyan">${formatHKD(r.personalIncome)}</span>`,
      expense: (_, r) => `<span class="text-red">${formatHKD(r.expense)}</span>`,
      insurance: (_, r) => r.insurance === 0 ? '<span class="text-muted">—</span>' : `<span class="text-magenta">${formatHKD(r.insurance)}</span>`,
      net: (_, r) => r.isShared ? '<span class="text-muted">—</span>' : `<span class="${r.net >= 0 ? 'text-emerald' : 'text-red'}">${formatHKD(r.net)}</span>`,
    };

    const paint = () => {
      const root = document.getElementById('member-list-root');
      if (!root) return;
      if (_tableApi) { try { _tableApi.destroy(); } catch (e) {} _tableApi = null; }
      if (_cardApi) { try { _cardApi.destroy(); } catch (e) {} _cardApi = null; }

      const rows = ctx.derived.rows || [];

      if (ctx.state.view === 'card') {
        _cardApi = renderDataCard({
          container: root,
          entityKey: '__member_report__',
          rows,
          options: { gridClass: 'grid grid-3', columns: _columns, resolvers: _resolvers },
        });
      } else {
        _tableApi = renderDataTable({
          container: root,
          entityKey: '__member_report__',
          rows,
          tableId: 'member-report-table',
          options: {
            mobileCardMode: true,
            columns: _columns,
            resolvers: _resolvers,
            storageKey: 'member-report-table',
          },
        });
      }
    };

    /* 🆕 view toggle */
    _toggle = initViewToggle({
      containerId: 'member-report-view-toggle',
      storageKey: 'member-report-view',
      defaultView: 'table',
      onChange: (view) => { ctx.state.view = view; paint(); },
    });
    ctx.state.view = _toggle?.getView() || 'table';

    syncSubtitle();
    paint();

    const unsub = ctx.onDataChange((key) => {
      if (key === '__APP__') {
        const y = String(AppState.year || new Date().getFullYear());
        if (ctx.state.currentYear !== y) ctx.state.currentYear = y;
      }
      syncSubtitle();
      paint();
    });

    return {
      destroy: () => {
        unsub();
        if (_tableApi) { try { _tableApi.destroy(); } catch (e) {} }
        if (_cardApi) { try { _cardApi.destroy(); } catch (e) {} }
        if (_toggle) { try { _toggle.destroy(); } catch (e) {} }
      },
    };
  },
};

/* ============================================
   Helpers
   ============================================ */
function _buildRows(members, allIncome, allExpenses, allPersonalIncome, year) {
  const yk = String(year || '');
  const yi = (allIncome || {})[yk] || {};
  const ye = (allExpenses || {})[yk] || {};
  const list = (members || []).map((m) => ({ id: m.id, name: m.name, isShared: false }));
  list.push({ id: RESERVED_IDS.SHARED_MEMBER, name: '家庭共用', isShared: true });

  return list.map((m) => {
    let income = 0, personalIncome = 0, expense = 0, insurance = 0;
    if (!m.isShared) {
      Object.values(yi).forEach((md) => { income += Number(md && md[m.id]) || 0; });
      const mp = ((allPersonalIncome || {})[m.id] || {})[yk] || {};
      Object.values(mp).forEach((v) => { personalIncome += Number(v) || 0; });
    }
    Object.values(ye).forEach((md) => {
      const me = (md && md.member_expenses && md.member_expenses[m.id]) || {};
      Object.values(me).forEach((e) => {
        const amt = Number(e && e.amount) || 0;
        if (e && e.isAutoLinked) insurance += amt; else expense += amt;
      });
    });
    return {
      ...m,
      income: Math.round(income),
      expense: Math.round(expense),
      insurance: Math.round(insurance),
      personalIncome: Math.round(personalIncome),
      net: Math.round(income + personalIncome - expense - insurance),
    };
  });
}

function _buildStats(rows, year) {
  const list = rows || [];
  const tI = list.reduce((s, r) => s + r.income, 0);
  const tPI = list.reduce((s, r) => s + r.personalIncome, 0);
  const tE = list.reduce((s, r) => s + r.expense, 0);
  const tIns = list.reduce((s, r) => s + r.insurance, 0);
  const net = tI + tPI - tE - tIns;
  return [
    { title: `${year} 家庭收入`, value: formatHKD(tI), valueClass: 'emerald', hint: '家用轉入加總', icon: 'trending-up' },
    { title: `${year} 個人收入`, value: formatHKD(tPI), valueClass: 'cyan', hint: '成員個人收入加總', icon: 'wallet' },
    { title: `${year} 年度總支出`, value: formatHKD(tE), valueClass: 'red', hint: '含家庭共用支出', icon: 'trending-down' },
    { title: `${year} 年度保險平攤`, value: formatHKD(tIns), valueClass: 'magenta', hint: '保險自動分攤加總', icon: 'shield' },
    { title: `${year} 年度淨餘額`, value: formatHKD(net), valueClass: net >= 0 ? 'emerald' : 'red', hint: '收入 + 個人 − 支出 − 保險', icon: 'calculator' },
  ];
}

/* ═══════════════════════════════════════════
   END OF FILE
   File: js/pages/member-report.js
   Version: v103.0.19
   Batch: B20
   ═══════════════════════════════════════════ */