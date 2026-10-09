// ============================================
// portfolio.js — 基金投資表（v103.0.0 Page Schema）
// 位置：js/pages/portfolio.js
// ============================================
import { createPage } from '../engines/page-engine.js';
import { formatHKD } from '../lib/format.js';
import { openEntityModal } from '../entity/entity-modal.js';
import { deleteEntity } from '../entity/entity-helpers.js';
import { openConfirm } from '../ui/modal.js';
import { showToast } from '../ui/toast.js';
import { ENTITY_KEYS } from '../config/constants.js';

export default {
  title: '基金投資表',

  data: {
    funds: { type: 'list', path: 'funds' },
  },

  state: {
    view: 'card',
  },

  derived: {
    statsCards: {
      deps: ['data.funds'],
      compute: (funds) => {
        const cost = funds.reduce((s, f) => s + (Number(f.cost) || 0), 0);
        const value = funds.reduce((s, f) => s + (Number(f.currentValue) || 0), 0);
        const pnl = value - cost;
        const pct = cost > 0 ? ((pnl / cost) * 100).toFixed(2) : '0.00';
        const sign = pnl >= 0 ? '+' : '';
        return [
          { title: '總投入成本', value: formatHKD(cost), hint: `共 ${funds.length} 筆持倉`, icon: 'wallet' },
          { title: '總現時價值', value: formatHKD(value), valueClass: 'emerald', hint: '最新現值加總', icon: 'line-chart' },
          { title: '總帳面盈虧', value: `${sign}${formatHKD(pnl)} (${pct}%)`,
            valueClass: pnl >= 0 ? 'emerald' : 'red',
            hint: pnl >= 0 ? '獲利中' : '虧損中', icon: pnl >= 0 ? 'trending-up' : 'trending-down' },
        ];
      },
    },
    rows: {
      deps: ['data.funds'],
      compute: (funds) => funds.map((f) => ({
        ...f,
        _pnl: (Number(f.currentValue) || 0) - (Number(f.cost) || 0),
        _pnlPct: Number(f.cost) > 0 ? (((Number(f.currentValue) || 0) - Number(f.cost)) / Number(f.cost) * 100).toFixed(2) : '0.00',
      })),
    },
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
      actions: _fundActions,
    },
  ],
};

/* ============================================
   Custom Actions
   ============================================ */
function _fundActions(row) {
  return [
    {
      label: '編輯', icon: 'pencil', className: 'btn-ghost', action: 'edit',
      onClick: () => openEntityModal({ entity: ENTITY_KEYS.FUND, mode: 'edit', id: row.id }),
    },
    {
      label: '刪除', icon: 'trash-2', className: 'btn-danger', action: 'delete',
      onClick: async () => {
        const ok = await openConfirm(`確定要刪除基金「${row.name}」嗎？`, {
          title: '刪除基金', okText: '刪除', okClass: 'btn-danger',
        });
        if (!ok) return;
        try {
          await deleteEntity(ENTITY_KEYS.FUND, row.id);
          showToast('✅ 已刪除基金', 'success');
        } catch (err) {
          showToast('刪除失敗：' + err.message, 'error');
        }
      },
    },
  ];
}
