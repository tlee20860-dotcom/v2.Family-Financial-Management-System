// ============================================
// portfolio.js — 基金投資表（v103.0.15 Page Schema）
// 位置：js/pages/portfolio.js
// ============================================
// v103.0.15 修正：
//   ✅ [P17-02] table view 改用 block（page-engine 自動渲染）
// ============================================

import { formatHKD } from '../lib/format.js';
import { openEntityModal } from '../entity/entity-modal.js';
import { deleteEntity } from '../entity/entity-helpers.js';
import { openConfirm } from '../ui/modal.js';
import { showToast } from '../ui/toast.js';
import { initViewToggle } from '../ui/view-toggle.js';
import { renderDataCard } from '../shared/data-card.js';
import { ENTITY_KEYS } from '../config/constants.js';

export default {
  title: '基金投資表',
  data: { funds: { type: 'list', path: 'funds' } },
  state: { view: 'card' },
  derived: {
    statsCards: { deps: ['data.funds'], compute: _buildStats },
    rows: { deps: ['data.funds'], compute: _buildRows },
  },
  blocks: [
    { type: 'stats', container: 'portfolio-stats-root', cards: '$.statsCards' },
    {
      type: 'list',
      container: 'fund-table-view',
      rows: '$.rows',
      columns: 'funds',
      tableId: 'portfolio-table',
      view: 'table',
      emptyText: '尚無基金持倉',
      actions: (row, ctx) => _actions(row, ctx),
    },
  ],

  customMount: (ctx) => {
    let _cardApi = null, _toggle = null;

    const renderCard = () => {
      const cardEl = document.getElementById('fund-card-view');
      if (!cardEl) return;
      if (_cardApi) { try { _cardApi.destroy(); } catch (e) {} _cardApi = null; }
      const rows = ctx.derived.rows || [];
      if (rows.length === 0) {
        cardEl.innerHTML = '<div class="glass-card"><div class="empty-state">尚無基金持倉</div></div>';
        return;
      }
      _cardApi = renderDataCard({
        container: cardEl,
        entityKey: ENTITY_KEYS.FUND,
        rows,
        options: { gridClass: 'grid grid-3' },
        hooks: {
          onEdit: (row) => openEntityModal({ entity: ENTITY_KEYS.FUND, mode: 'edit', id: row.id, allRows: rows }),
          onDelete: (row) => _delete(row),
        },
      });
    };

    const renderView = (view) => {
      document.getElementById('fund-card-view').style.display = view === 'card' ? 'block' : 'none';
      document.getElementById('fund-table-view').style.display = view === 'table' ? 'block' : 'none';
      if (view === 'card') renderCard();
    };

    _toggle = initViewToggle({
      containerId: 'portfolio-view-toggle',
      storageKey: 'portfolio-view',
      defaultView: 'card',
      cardText: '卡片',
      tableText: '表格',
      onChange: (view) => { ctx.state.view = view; renderView(view); },
    });

    renderView(_toggle?.getView() || 'card');

    const _orig = ctx.invalidate;
    ctx.invalidate = (k) => { _orig(k); setTimeout(() => { if (ctx.state.view === 'card') renderCard(); }, 0); };

    return {
      destroy: () => {
        if (_cardApi) { try { _cardApi.destroy(); } catch (e) {} }
        if (_toggle) { try { _toggle.destroy(); } catch (e) {} }
      },
    };
  },
};

/* ============================================
   Helpers
   ============================================ */
function _buildStats(funds) {
  const list = funds || [];
  const cost = list.reduce((s, f) => s + (Number(f.cost) || 0), 0);
  const value = list.reduce((s, f) => s + (Number(f.currentValue) || 0), 0);
  const pnl = value - cost;
  const pct = cost > 0 ? ((pnl / cost) * 100).toFixed(2) : '0.00';
  const sign = pnl >= 0 ? '+' : '';
  return [
    { title: '總投入成本', value: formatHKD(cost), hint: `共 ${list.length} 筆持倉`, icon: 'wallet' },
    { title: '總現時價值', value: formatHKD(value), valueClass: 'emerald', hint: '最新現值加總', icon: 'line-chart' },
    { title: '總帳面盈虧', value: `${sign}${formatHKD(pnl)} (${pct}%)`, valueClass: pnl >= 0 ? 'emerald' : 'red', hint: pnl >= 0 ? '獲利中' : '虧損中', icon: pnl >= 0 ? 'trending-up' : 'trending-down' },
  ];
}

function _buildRows(funds) {
  return (funds || []).map((f) => ({ ...f, _pnl: (Number(f.currentValue) || 0) - (Number(f.cost) || 0) }));
}

function _actions(row, ctx) {
  const allRows = (ctx && ctx.derived && ctx.derived.rows) || [];
  return [
    { label: '編輯', icon: 'pencil', className: 'btn-ghost', action: 'edit', onClick: () => openEntityModal({ entity: ENTITY_KEYS.FUND, mode: 'edit', id: row.id, allRows }) },
    { label: '刪除', icon: 'trash-2', className: 'btn-danger', action: 'delete', onClick: () => _delete(row) },
  ];
}

async function _delete(row) {
  const ok = await openConfirm(`確定要刪除基金「${row.name}」嗎？`, { title: '刪除基金', okText: '刪除', okClass: 'btn-danger' });
  if (!ok) return;
  try {
    await deleteEntity(ENTITY_KEYS.FUND, row.id);
    showToast('✅ 已刪除基金', 'success');
  } catch (err) { showToast('刪除失敗：' + err.message, 'error'); }
}