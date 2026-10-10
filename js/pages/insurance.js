// ============================================
// insurance.js — 保險清單表（v103.0.15 Page Schema）
// 位置：js/pages/insurance.js
// ============================================
// v103.0.15 修正：
//   ✅ [P17-03] 加 onYearMonthChange hook
//   ✅ [P17-06] 卡片渲染改用 resolveName
// ============================================

import { formatHKD } from '../lib/format.js';
import { esc } from '../lib/dom.js';
import { computeEnrichedPolicies, calcProgress, getPolicyHolderId } from '../lib/insurance.js';
import { listenInsurancePolicies, listenMembers, getInsurancePaymentsOnce } from '../core/db.js';
import { resolveName } from '../config/entity-registry.js';
import { AppState } from '../core/state.js';
import { openEntityModal } from '../entity/entity-modal.js';
import { deleteEntity } from '../entity/entity-helpers.js';
import { openConfirm } from '../ui/modal.js';
import { showToast } from '../ui/toast.js';
import { renderStatsCards } from '../shared/stats-cards.js';
import { ENTITY_KEYS } from '../config/constants.js';

let _ctx = null;

export default {
  title: '保險清單表',
  data: {},
  state: { view: 'card' },
  derived: {},
  blocks: [],

  /* 🆕 [P17-03] 年月變更 hook */
  onYearMonthChange: () => { if (_ctx) _render(_ctx); },

  customMount: (ctx) => {
    _ctx = ctx;
    let _policies = [], _members = [], _paymentsCache = {}, _enriched = [];
    let _statsApi = null, _unsubP = null, _unsubM = null, _clickHandler = null;

    const render = () => _render(ctx);
    _ctx._render = render;

    _clickHandler = async (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn || !AppState.getCanInput()) return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if (!id) return;
      const policy = _policies.find((p) => p.id === id);
      if (!policy) return;
      if (action === 'edit-policy') {
        openEntityModal({ entity: ENTITY_KEYS.POLICY, mode: 'edit', id, allRows: _policies });
      } else if (action === 'delete-policy') {
        const ok = await openConfirm(`⚠️ 確定要刪除保單「${policy.name}」嗎？`, { title: '刪除保單', okText: '刪除', okClass: 'btn-danger' });
        if (!ok) return;
        try {
          await deleteEntity(ENTITY_KEYS.POLICY, id, getPolicyHolderId(policy));
          showToast('✅ 已刪除保單', 'success');
        } catch (err) { showToast('刪除失敗：' + err.message, 'error'); }
      }
    };
    document.getElementById('insurance-card-view')?.addEventListener('click', _clickHandler);

    _unsubP = listenInsurancePolicies(async (list) => {
      _policies = list || [];
      try {
        const snap = await Promise.all(_policies.map((p) => getInsurancePaymentsOnce(p.id)));
        _paymentsCache = {};
        _policies.forEach((p, i) => { _paymentsCache[p.id] = snap[i]; });
      } catch (e) { _paymentsCache = {}; }
      ctx._policies = _policies;
      ctx._paymentsCache = _paymentsCache;
      render();
    });
    _unsubM = listenMembers((list) => {
      _members = list || [];
      ctx._members = _members;
      render();
    });

    ctx._render = render;
    ctx._getMembers = () => _members;

    return {
      destroy: () => {
        if (_unsubP) { try { _unsubP(); } catch (e) {} }
        if (_unsubM) { try { _unsubM(); } catch (e) {} }
        if (_statsApi) { try { _statsApi.destroy(); } catch (e) {} }
        if (_clickHandler) document.getElementById('insurance-card-view')?.removeEventListener('click', _clickHandler);
        _ctx = null;
      },
    };
  },
};

/* ============================================
   Render
   ============================================ */
function _render(ctx) {
  const policies = ctx._policies || [];
  const members = ctx._members || [];
  const paymentsCache = ctx._paymentsCache || {};
  const { year } = AppState.getYearMonth();
  const targetYear = Number(year) || new Date().getFullYear();
  const enriched = computeEnrichedPolicies(policies, paymentsCache, targetYear);

  const yearTotal = enriched.reduce((s, p) => s + (p._currentAnnualPremium || 0), 0);
  const activeCount = enriched.filter((p) => !p._isCompleted).length;
  const completedCount = enriched.filter((p) => p._isCompleted).length;

  /* Stats */
  const statsRoot = document.getElementById('insurance-stats-root');
  if (statsRoot) {
    statsRoot.innerHTML = '';
    const cards = [
      { title: `${targetYear} 年度保單總供款`, value: formatHKD(yearTotal), valueClass: 'cyan', hint: `共 ${enriched.length} 張保單`, icon: 'wallet' },
      { title: '供款中保單', value: `${activeCount} 張`, valueClass: 'emerald', hint: '未供滿的保單數量', icon: 'shield' },
      { title: '已供滿保單', value: `${completedCount} 張`, valueClass: 'emerald', hint: '已完成供款年期', icon: 'check-circle' },
    ];
    renderStatsCards({ container: 'insurance-stats-root', cards, columns: 3 });
  }

  /* 已供滿 */
  const completed = enriched.filter((p) => p._isCompleted);
  const active = enriched.filter((p) => !p._isCompleted);
  _renderCompletedSection(completed, members);
  _renderActiveList(active, members);
  if (window.lucide) window.lucide.createIcons();
}

function _renderCompletedSection(completed, members) {
  const section = document.getElementById('completed-section');
  const grid = document.getElementById('completed-grid');
  const countEl = document.getElementById('completed-count');
  if (!section || !grid) return;
  if (completed.length === 0) { section.style.display = 'none'; return; }
  section.style.display = 'block';
  if (countEl) countEl.textContent = String(completed.length);
  grid.innerHTML = completed.map((p) => _renderCardHtml(p, members)).join('');
}

function _renderActiveList(active, members) {
  const cardEl = document.getElementById('insurance-card-view');
  const tableEl = document.getElementById('insurance-table-view');
  const emptyEl = document.getElementById('insurance-empty-state');
  if (!cardEl || !tableEl) return;
  if ((active.length + (members || []).length) === 0) {
    if (emptyEl) emptyEl.style.display = 'block';
    cardEl.style.display = 'none';
    tableEl.style.display = 'none';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';
  cardEl.style.display = 'block';
  tableEl.style.display = 'none';
  cardEl.innerHTML = active.length === 0
    ? '<div class="glass-card" style="text-align:center;padding:40px 20px;"><p style="color:var(--neon-emerald);">🎉 所有保單均已供滿</p></div>'
    : `<div class="grid grid-3">${active.map((p) => `<div class="glass-card policy-card">${_renderCardHtml(p, members)}</div>`).join('')}</div>`;
}

function _renderCardHtml(p, members) {
  const holderId = getPolicyHolderId(p);
  const holderName = resolveName('members', holderId) || (members.find((m) => m.id === holderId)?.name) || holderId;
  const insuredName = resolveName('members', p.memberId) || (members.find((m) => m.id === p.memberId)?.name) || p.memberId;
  const isFund = p.type === 'fund_insurance';
  const totalPeriods = p.totalPolicyPeriods || 0;
  const done = p.completedPeriods || 0;
  const pct = calcProgress(p);
  const userCanInput = AppState.getCanInput();
  const actions = userCanInput ? `
    <div class="policy-actions">
      <button type="button" class="btn btn-sm btn-ghost" data-action="edit-policy" data-id="${p.id}"><i data-lucide="pencil" style="width:14px;height:14px;"></i> 編輯</button>
      <button type="button" class="btn btn-sm btn-danger" data-action="delete-policy" data-id="${p.id}"><i data-lucide="trash-2" style="width:14px;height:14px;"></i> 刪除</button>
    </div>` : '';
  const progressHtml = isFund ? '' : `
    <div class="policy-progress" style="margin-top:12px;">
      <div class="policy-progress-text"><span>整體供款進度</span><span>${done} / ${totalPeriods} 期 (${pct}%)</span></div>
      <div class="progress"><div class="progress-bar" style="width:${pct}%;"></div></div>
    </div>`;
  return `
    <div class="policy-header"><div><div class="policy-name">${esc(p.name || '')}</div><div class="policy-company">${esc(p.company || '')} · ${isFund ? '基金保險' : '普通保險'}</div></div></div>
    <div class="policy-info-grid">
      <div class="policy-info-item"><span class="policy-info-label">保單持有人</span><span class="policy-info-value">${esc(holderName || '—')}</span></div>
      <div class="policy-info-item"><span class="policy-info-label">受保人</span><span class="policy-info-value">${esc(insuredName || '—')}</span></div>
    </div>
    <div class="policy-info-grid" style="margin-top:10px;padding-top:10px;border-top:1px dashed rgba(255,255,255,0.08);">
      <div class="policy-info-item"><span class="policy-info-label">本期年繳</span><span class="policy-info-value text-cyan">${formatHKD(p._currentAnnualPremium)}</span></div>
      <div class="policy-info-item"><span class="policy-info-label">保單總供款</span><span class="policy-info-value text-magenta">${formatHKD(p._totalPremium)}</span></div>
    </div>
    ${progressHtml}${actions}`;
}