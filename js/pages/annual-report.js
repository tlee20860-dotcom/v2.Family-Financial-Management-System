// ============================================
// annual-report.js — 年度報表（v103.0.0 Page Schema）
// 位置：js/pages/annual-report.js
// ============================================
import { createPage } from '../engines/page-engine.js';
import { formatHKD, formatNumber } from '../lib/format.js';
import { AppState } from '../core/state.js';
import { getOptions } from '../config/app-config.js';

export default {
  title: '年度報表',

  data: {
    members: { type: 'list', path: 'members' },
  },

  state: {
    year: String(AppState.year || new Date().getFullYear()),
    displayMonth: '01',
    view: 'summary',
  },

  derived: {
    categoryOrder: {
      deps: [],
      compute: () => getOptions('categoryOrder') || ['其他'],
    },
    membersRows: {
      deps: ['data.members'],
      compute: (members) => members,
    },
  },

  blocks: [
    {
      type: 'list',
      container: 'summary-table-root',
      rows: '$.membersRows',
      columns: 'annualSummary',
      tableId: 'annual-summary-table',
      view: 'table',
      emptyText: '載入中…',
    },
  ],
};
