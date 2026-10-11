// portfolio.js — 基金投資表（v103.0.21）
import { formatHKD } from '../lib/format.js';
import { esc } from '../lib/dom.js';
import { openEntityModal } from '../entity/entity-modal.js';
import { deleteEntity } from '../entity/entity-helpers.js';
import { openConfirm, openModal, closeModal } from '../ui/modal.js';
import { buildForm } from '../ui/form-builder.js';
import { showToast } from '../ui/toast.js';
import { saveFundSnapshot } from '../core/db.js';
import { AppState } from '../core/state.js';
import { ENTITY_KEYS } from '../config/constants.js';

const SNAP_MODAL_ID = 'fund-snapshot-modal';

export default {
  title: '基金投資表',
  data: {
    funds: { type: 'list', path: 'funds' },
    policies: { type: 'list', path: 'insurance_policies' },
  },
  state: {},
  derived: {
    insuranceFunds: {
      deps: ['data.funds'],
      compute: (funds) => (funds || []).filter((f) => f.type === 'insurance'),
    },
    standaloneFunds: {
      deps: ['data.funds'],
      compute: (funds) => (funds || []).filter((f) => f.type !== 'insurance'),
    },
    statsCards: {
      deps: ['data.funds'],
      compute: _buildStats,
    },
  },
  blocks: [
    { type: 'stats', container: 'portfolio-stats-root', cards: '$.statsCards' },
  ],

  customMount: (ctx) => {
    const render = () => {
      _paintInsurance(ctx);
      _paintStandalone(ctx);
      if (window.lucide) window.lucide.createIcons();
    };

    const unsub = ctx.onDataChange((key) => {
      if (key.startsWith('data.funds') || key.startsWith('data.policies') || key === '__APP__') {
        setTimeout(render, 0);
      }
    });

    render();

    const addBtn = document.getElementById('add-fund-btn');
    const addFirstBtn = document.getElementById('add-first-fund-btn');
    const onAdd = () => openEntityModal({ entity: ENTITY_KEYS.FUND, mode: 'add', onSuccess: render });
    addBtn?.addEventListener('click', onAdd);
    addFirstBtn?.addEventListener('click', onAdd);

    const cardClickHandler = async (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const id = btn.dataset.id;
      if (!id) return;
      const funds = ctx.data.funds || [];
      const fund = funds.find((f) => f.id === id);
      if (!fund) return;

      if (btn.dataset.action === 'edit-fund') {
        openEntityModal({ entity: ENTITY_KEYS.FUND, mode: 'edit', id, allRows: funds, onSuccess: render });
      } else if (btn.dataset.action === 'delete-fund') {
        const ok = await openConfirm(`確定要刪除基金「${fund.name}」嗎？`, { title: '刪除基金', okText: '刪除', okClass: 'btn-danger' });
        if (!ok) return;
        try { await deleteEntity(ENTITY_KEYS.FUND, id); showToast('✅ 已刪除基金', 'success'); }
        catch (err) { showToast('刪除失敗：' + err.message, 'error'); }
      }
    };
    document.getElementById('insurance-funds-list')?.addEventListener('click', cardClickHandler);
    document.getElementById('standalone-funds-list')?.addEventListener('click', cardClickHandler);

    return {
      destroy: () => {
        unsub();
        addBtn?.removeEventListener('click', onAdd);
        addFirstBtn?.removeEventListener('click', onAdd);
        document.getElementById('insurance-funds-list')?.removeEventListener('click', cardClickHandler);
        document.getElementById('standalone-funds-list')?.removeEventListener('click', cardClickHandler);
      },
    };
  },
};

/* ============================================
   保險基金區
   ============================================ */
function _paintInsurance(ctx) {
  const root = document.getElementById('insurance-funds-list');
  if (!root) return;
  const list = ctx.derived.insuranceFunds || [];
  if (list.length === 0) {
    root.innerHTML = '<div class="glass-card"><div class="empty-state">尚無保險基金</div></div>';
    return;
  }
  const policies = ctx.data.policies || [];
  const rows = list.map((f) => {
    const policy = policies.find((p) => p.id === f.policyId);
    const alloc = (policy?.fundsAllocation || []).find((a) => a.fundId === f.id);
    const pct = alloc ? alloc.pct : 0;
    return { fund: f, policyName: policy?.name || '（未關聯）', pct };
  });
  const html = rows.map((r) => _cardHtml(r, true)).join('');
  if (root.__lastHtml === html) return;
  root.__lastHtml = html;
  root.innerHTML = html;
}

/* ============================================
   獨立基金區
   ============================================ */
function _paintStandalone(ctx) {
  const root = document.getElementById('standalone-funds-list');
  if (!root) return;
  const list = ctx.derived.standaloneFunds || [];
  const empty = document.getElementById('fund-empty-state');
  if (list.length === 0) {
    if (empty) empty.style.display = 'block';
    root.innerHTML = '';
    return;
  }
  if (empty) empty.style.display = 'none';
  const html = `<div class="data-cards-grid">${list.map((f) => _cardHtml({ fund: f }, false)).join('')}</div>`;
  if (root.__lastHtml === html) return;
  root.__lastHtml = html;
  root.innerHTML = html;
}

/* ============================================
   卡片 HTML
   ============================================ */
function _cardHtml({ fund, policyName, pct }, isInsurance) {
  const cost = Number(fund.cost) || 0;
  const value = Number(fund.currentValue) || 0;
  const pnl = value - cost;
  const pnlCls = pnl >= 0 ? 'text-emerald' : 'text-red';
  const pnlSign = pnl >= 0 ? '+' : '';
  const pnlPct = cost > 0 ? ((pnl / cost) * 100).toFixed(2) : '0.00';

  const meta = isInsurance
    ? `<div class="policy-company">${esc(policyName)} · 比例 ${pct}%</div>`
    : '';

  return `
    <div class="glass-card policy-card">
      <div class="policy-header">
        <div style="min-width:0;">
          <div class="policy-name">${esc(fund.name || '（未命名）')}</div>
          ${meta}
        </div>
      </div>
      <div class="policy-info-grid">
        <div class="policy-info-item"><span class="policy-info-label">投入成本</span><span class="policy-info-value">${formatHKD(cost)}</span></div>
        <div class="policy-info-item"><span class="policy-info-label">現時價值</span><span class="policy-info-value text-emerald">${formatHKD(value)}</span></div>
      </div>
      <div class="policy-info-grid" style="margin-top:10px;padding-top:10px;border-top:1px dashed rgba(255,255,255,0.08);">
        <div class="policy-info-item"><span class="policy-info-label">盈虧</span><span class="policy-info-value ${pnlCls}">${pnlSign}${formatHKD(pnl)} (${pnlPct}%)</span></div>
        <div class="policy-info-item"><span class="policy-info-label">單位數</span><span class="policy-info-value">${fund.units || '—'}</span></div>
      </div>
      <div class="policy-actions">
        <button type="button" class="btn btn-sm btn-primary" data-action="snapshot" data-id="${fund.id}" data-name="${esc(fund.name)}">
          <i data-lucide="camera" style="width:14px;height:14px;"></i> 輸入本月快照
        </button>
        <button type="button" class="btn btn-sm btn-ghost" data-action="edit-fund" data-id="${fund.id}">
          <i data-lucide="pencil" style="width:14px;height:14px;"></i> 編輯
        </button>
        <button type="button" class="btn btn-sm btn-danger" data-action="delete-fund" data-id="${fund.id}">
          <i data-lucide="trash-2" style="width:14px;height:14px;"></i> 刪除
        </button>
      </div>
    </div>
  `;
}

/* ============================================
   快照輸入 Modal
   ============================================ */
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action="snapshot"]');
  if (!btn) return;
  const fundId = btn.dataset.id;
  const fundName = btn.dataset.name || '';
  await _openSnapshotModal(fundId, fundName);
});

async function _openSnapshotModal(fundId, fundName) {
  const { getFundSnapshotsOnce } = await import('../core/db.js');
  document.getElementById(SNAP_MODAL_ID)?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = SNAP_MODAL_ID;
  overlay.innerHTML = `<div class="modal" style="max-width:560px;max-height:90vh;overflow-y:auto;"><h2 class="modal-title">輸入快照 — ${esc(fundName)}</h2><div id="${SNAP_MODAL_ID}-form-root"></div></div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(SNAP_MODAL_ID); });

  const { year, month } = AppState.getYearMonth();
  const y = year || String(new Date().getFullYear());
  const m = month === 'all' ? String(new Date().getMonth() + 1).padStart(2, '0') : month;

  let snaps = {};
  try { snaps = await getFundSnapshotsOnce(fundId); } catch (e) {}

  const yearsOpts = [];
  const curY = new Date().getFullYear();
  for (let yy = curY - 5; yy <= curY + 1; yy++) yearsOpts.push({ value: String(yy), label: `${yy} 年` });
  const monthsOpts = [];
  for (let mm = 1; mm <= 12; mm++) monthsOpts.push({ value: String(mm).padStart(2, '0'), label: `${mm} 月` });

  buildForm({
    containerId: `${SNAP_MODAL_ID}-form-root`,
    fields: [
      { type: 'select', id: 'snap-year', label: '年度', required: true, includeEmpty: false, options: yearsOpts, defaultValue: y },
      { type: 'select', id: 'snap-month', label: '月份', required: true, includeEmpty: false, options: monthsOpts, defaultValue: m },
      { type: 'number', id: 'snap-shares', label: '股數', required: true, min: 0, step: 0.0001, defaultValue: 0 },
      { type: 'number', id: 'snap-nav', label: '股價（淨值）', required: true, min: 0, step: 0.0001, defaultValue: 0 },
      { type: 'number', id: 'snap-value', label: '現值（自動計算）', required: false, disabled: true, defaultValue: 0 },
    ],
    submitText: '儲存快照',
    showCancel: true,
    cancelText: '取消',
    onSubmit: async (data) => {
      try {
        const sy = data['snap-year'];
        const sm = data['snap-month'];
        const shares = Number(data['snap-shares']) || 0;
        const nav = Number(data['snap-nav']) || 0;
        await saveFundSnapshot(fundId, sy, sm, { shares, nav });
        showToast(`✅ 已儲存 ${sy}-${sm} 快照`, 'success');
        closeModal(SNAP_MODAL_ID);
      } catch (err) { showToast('儲存失敗：' + err.message, 'error'); }
    },
    onCancel: () => closeModal(SNAP_MODAL_ID),
  });

  /* 即時計算現值 + 載入既有快照 */
  const sharesEl = document.getElementById('snap-shares');
  const navEl = document.getElementById('snap-nav');
  const valueEl = document.getElementById('snap-value');
  const yearEl = document.getElementById('snap-year');
  const monthEl = document.getElementById('snap-month');

  const calcValue = () => {
    const s = Number(sharesEl?.value) || 0;
    const n = Number(navEl?.value) || 0;
    if (valueEl) valueEl.value = Math.round(s * n);
  };
  const loadExisting = () => {
    const sy = yearEl?.value || '';
    const sm = monthEl?.value || '';
    const snap = snaps?.[sy]?.[sm];
    if (snap) {
      if (sharesEl) sharesEl.value = snap.shares || 0;
      if (navEl) navEl.value = snap.nav || 0;
      calcValue();
    } else {
      if (sharesEl) sharesEl.value = 0;
      if (navEl) navEl.value = 0;
      if (valueEl) valueEl.value = 0;
    }
  };
  sharesEl?.addEventListener('input', calcValue);
  navEl?.addEventListener('input', calcValue);
  yearEl?.addEventListener('change', loadExisting);
  monthEl?.addEventListener('change', loadExisting);

  openModal(SNAP_MODAL_ID);
  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   Stats
   ============================================ */
function _buildStats(funds) {
  const list = funds || [];
  const cost = list.reduce((s, f) => s + (Number(f.cost) || 0), 0);
  const value = list.reduce((s, f) => s + (Number(f.currentValue) || 0), 0);
  const pnl = value - cost;
  const pct = cost > 0 ? ((pnl / cost) * 100).toFixed(2) : '0.00';
  const sign = pnl >= 0 ? '+' : '';
  const insCount = list.filter((f) => f.type === 'insurance').length;
  const standaloneCount = list.filter((f) => f.type !== 'insurance').length;
  return [
    { title: '總投入成本', value: formatHKD(cost), hint: `共 ${list.length} 筆（保險 ${insCount} / 獨立 ${standaloneCount}）`, icon: 'wallet' },
    { title: '總現時價值', value: formatHKD(value), valueClass: 'emerald', hint: '最新現值加總', icon: 'line-chart' },
    { title: '總帳面盈虧', value: `${sign}${formatHKD(pnl)} (${pct}%)`, valueClass: pnl >= 0 ? 'emerald' : 'red', hint: pnl >= 0 ? '獲利中' : '虧損中', icon: pnl >= 0 ? 'trending-up' : 'trending-down' },
  ];
}

/* ═══════════════════════════════════════════
   END OF FILE
   File: js/pages/portfolio.js
   Version: v103.0.21
   Batch: B23
   ═══════════════════════════════════════════ */