// ============================================
// portfolio.js — 基金投資表（v103.0.14 Page Schema）
// 位置：js/pages/portfolio.js
// ============================================
// v103.0.14 修正：
//   ✅ [問題4] 加 customMount 處理 view toggle + 卡片渲染
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

  data: {
    funds: { type: 'list', path: 'funds' },
  },

  state: { view: 'card' },
  derived: {
    statsCards: {
      deps: ['data.funds'],
      compute: _buildStats,
    },
    rows: {
      deps: ['data.funds'],
      compute: _buildRows,
    },
  },
  blocks: [
    { type: 'stats', container: 'portfolio-stats-root', cards: '$.statsCards' },
  ],

  customMount: (ctx) => {
    let _cardApi = null;
    let _toggle = null;

    const renderView = (view) => {
      const cardEl = document.getElementById('fund-card-view');
      const tableEl = document.getElementById('fund-table-view');
      if (!cardEl || !tableEl) return;

      cardEl.style.display = view === 'card' ? 'block' : 'none';
      tableEl.style.display = view === 'table' ? 'block' : 'none';

      if (view === 'card') {
        if (_cardApi) { try { _cardApi.destroy(); } catch (e) {} _cardApi = null; }
        const rows = ctx.derived.rows || [];
        if (rows.length === 0) {
          cardEl.innerHTML = '<div class="glass-card"><div class="empty-state">尚無基金持倉</div></div>';
        } else {
          _cardApi = renderDataCard({
            container: cardEl,
            entityKey: ENTITY_KEYS.FUND,
            rows,
            options: { gridClass: 'grid grid-3' },
            hooks: {
              onEdit: (row) => openEntityModal({ entity: ENTITY_KEYS.FUND, mode: 'edit', id: row.id, allRows: rows }),
              onDelete: (row) => _handleDelete(row, rows),
            },
          });
        }
      }
    };

    _toggle = initViewToggle({
      containerId: 'portfolio-view-toggle',
      storageKey: 'portfolio-view',
      defaultView: 'card',
      cardText: '卡片',
      tableText: '表格',
      onChange: (view) => {
        ctx.state.view = view;
        renderView(view);
      },
    });

    const current = _toggle?.getView() || 'card';
    renderView(current);

    /* 監聽 funds 變化 → 重繪卡片 */
    const originalInvalidate = ctx.invalidate;
    ctx.invalidate = (key) => {
      originalInvalidate(key);
      if (key === 'data.funds' && (ctx.state.view === 'card')) {
        setTimeout(() => renderView('card'), 0);
      }
    };

    return {
      destroy: () => {
        if (_cardApi) { try { _cardApi.destroy(); } catch (e) {} _cardApi = null; }
        if (_toggle) { try { _toggle.destroy(); } catch (e) {} _toggle = null; }
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
    {
      title: '總帳面盈虧',
      value: `${sign}${formatHKD(pnl)} (${pct}%)`,
      valueClass: pnl >= 0 ? 'emerald' : 'red',
      hint: pnl >= 0 ? '獲利中' : '虧損中',
      icon: pnl >= 0 ? 'trending-up' : 'trending-down',
    },
  ];
}

function _buildRows(funds) {
  return (funds || []).map((f) => ({
    ...f,
    _pnl: (Number(f.currentValue) || 0) - (Number(f.cost) || 0),
    _pnlPct: Number(f.cost) > 0
      ? (((Number(f.currentValue) || 0) - Number(f.cost)) / Number(f.cost) * 100).toFixed(2)
      : '0.00',
  }));
}

async function _handleDelete(row, allRows) {
  const ok = await openConfirm(`確定要刪除基金「${row.name}」嗎？`, {
    title: '刪除基金',
    okText: '刪除',
    okClass: 'btn-danger',
  });
  if (!ok) return;
  try {
    await deleteEntity(ENTITY_KEYS.FUND, row.id);
    showToast('✅ 已刪除基金', 'success');
  } catch (err) {
    showToast('刪除失敗：' + err.message, 'error');
  }
}