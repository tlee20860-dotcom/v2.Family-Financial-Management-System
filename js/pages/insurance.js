// ============================================
// insurance.js — 保險清單表（v103.0.6 Page Schema）
// 位置：js/pages/insurance.js
// ============================================
// v103.0.6 修正：
//   ✅ esc 從 '../lib/format.js' 改為 '../lib/dom.js'
// ============================================

import { formatHKD } from '../lib/format.js';
import { esc } from '../lib/dom.js';
import {
  computeEnrichedPolicies, calcProgress, getPolicyHolderId,
} from '../lib/insurance.js';
import {
  listenInsurancePolicies, listenMembers, getInsurancePaymentsOnce,
} from '../core/db.js';
import { AppState } from '../core/state.js';
import { openEntityModal } from '../entity/entity-modal.js';
import { deleteEntity } from '../entity/entity-helpers.js';
import { openConfirm } from '../ui/modal.js';
import { showToast } from '../ui/toast.js';
import { renderStatsCards } from '../shared/stats-cards.js';
import { ENTITY_KEYS } from '../config/constants.js';

export default {
  title: '保險清單表',
  data: {},
  state: { view: 'card' },
  derived: {},
  blocks: [],

  customMount: (ctx) => {
    let _policies = [];
    let _members = [];
    let _paymentsCache = {};
    let _enriched = [];
    let _statsApi = null;
    let _unsubPolicies = null;
    let _unsubMembers = null;
    let _clickHandler = null;

    const render = () => {
      const { year } = AppState.getYearMonth();
      const targetYear = Number(year) || new Date().getFullYear();
      _enriched = computeEnrichedPolicies(_policies, _paymentsCache, targetYear);

      _renderStats(targetYear);

      const completed = _enriched.filter((p) => p._isCompleted);
      const active = _enriched.filter((p) => !p._isCompleted);

      _renderCompletedSection(completed);
      _renderActiveList(active);
      if (window.lucide) window.lucide.createIcons();
    };

    const _renderStats = (year) => {
      const yearTotal = _enriched.reduce((s, p) => s + (p._currentAnnualPremium || 0), 0);
      const activeCount = _enriched.filter((p) => !p._isCompleted).length;
      const completedCount = _enriched.filter((p) => p._isCompleted).length;
      if (_statsApi) { try { _statsApi.destroy(); } catch (e) { /* noop */ } }
      _statsApi = renderStatsCards({
        container: 'insurance-stats-root',
        cards: [
          { title: `${year} 年度保單總供款`, value: formatHKD(yearTotal), valueClass: 'cyan', hint: `共 ${_enriched.length} 張保單`, icon: 'wallet' },
          { title: '供款中保單', value: `${activeCount} 張`, valueClass: 'emerald', hint: '未供滿的保單數量', icon: 'shield' },
          { title: '已供滿保單', value: `${completedCount} 張`, valueClass: 'emerald', hint: '已完成供款年期', icon: 'check-circle' },
        ],
        columns: 3,
      });
    };

    const _renderCompletedSection = (completed) => {
      const section = document.getElementById('completed-section');
      const grid = document.getElementById('completed-grid');
      const countEl = document.getElementById('completed-count');
      if (!section || !grid) return;
      if (completed.length === 0) { section.style.display = 'none'; return; }
      section.style.display = 'block';
      if (countEl) countEl.textContent = String(completed.length);
      grid.innerHTML = completed.map((p) => _renderCardHtml(p, true)).join('');
    };

    const _renderActiveList = (active) => {
      const cardEl = document.getElementById('insurance-card-view');
      const tableEl = document.getElementById('insurance-table-view');
      const emptyEl = document.getElementById('insurance-empty-state');
      if (!cardEl || !tableEl) return;
      if (_enriched.length === 0) {
        if (emptyEl) emptyEl.style.display = 'block';
        cardEl.style.display = 'none';
        tableEl.style.display = 'none';
        return;
      }
      if (emptyEl) emptyEl.style.display = 'none';
      cardEl.style.display = 'block';
      tableEl.style.display = 'none';
      cardEl.innerHTML = active.length === 0
        ? '<div class="glass-card" style="text-align:center; padding:40px 20px;"><p style="color:var(--neon-emerald);">🎉 所有保單均已供滿</p></div>'
        : `<div class="grid grid-3">${active.map((p) => `<div class="glass-card policy-card">${_renderCardHtml(p, false)}</div>`).join('')}</div>`;
    };

    const _renderCardHtml = (p, isCompleted) => {
      const holder = _members.find((m) => m.id === getPolicyHolderId(p));
      const insured = _members.find((m) => m.id === p.memberId);
      const isFund = p.type === 'fund_insurance';
      const totalPeriods = p.totalPolicyPeriods || 0;
      const done = p.completedPeriods || 0;
      const pct = calcProgress(p);
      const userCanInput = AppState.getCanInput();
      const actions = userCanInput ? `
        <div class="policy-actions">
          <button type="button" class="btn btn-sm btn-ghost" data-action="edit-policy" data-id="${p.id}"><i data-lucide="pencil" style="width:14px;height:14px;"></i> 編輯</button>
          <button type="button" class="btn btn-sm btn-danger" data-action="delete-policy" data-id="${p.id}"><i data-lucide="trash-2" style="width:14px;height:14px;"></i> 刪除</button>
        </div>
      ` : '';
      const progressHtml = isFund ? '' : `
        <div class="policy-progress" style="margin-top:12px;">
          <div class="policy-progress-text"><span>整體供款進度</span><span>${done} / ${totalPeriods} 期 (${pct}%)</span></div>
          <div class="progress"><div class="progress-bar" style="width:${pct}%;"></div></div>
        </div>
      `;
      return `
        <div class="policy-header">
          <div>
            <div class="policy-name">${esc(p.name || '')}</div>
            <div class="policy-company">${esc(p.company || '')} · ${isFund ? '基金保險' : '普通保險'}</div>
          </div>
        </div>
        <div class="policy-info-grid">
          <div class="policy-info-item"><span class="policy-info-label">保單持有人</span><span class="policy-info-value">${esc(holder?.name || '—')}</span></div>
          <div class="policy-info-item"><span class="policy-info-label">受保人</span><span class="policy-info-value">${esc(insured?.name || '—')}</span></div>
        </div>
        <div class="policy-info-grid" style="margin-top:10px; padding-top:10px; border-top:1px dashed rgba(255,255,255,0.08);">
          <div class="policy-info-item"><span class="policy-info-label">本期年繳</span><span class="policy-info-value text-cyan">${formatHKD(p._currentAnnualPremium)}</span></div>
          <div class="policy-info-item"><span class="policy-info-label">保單總供款</span><span class="policy-info-value text-magenta">${formatHKD(p._totalPremium)}</span></div>
        </div>
        ${progressHtml}
        ${actions}
      `;
    };

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

    _unsubPolicies = listenInsurancePolicies(async (list) => {
      _policies = list || [];
      try {
        const snap = await Promise.all(_policies.map((p) => getInsurancePaymentsOnce(p.id)));
        _paymentsCache = {};
        _policies.forEach((p, i) => { _paymentsCache[p.id] = snap[i]; });
      } catch (e) { _paymentsCache = {}; }
      render();
    });

    _unsubMembers = listenMembers((list) => { _members = list || []; render(); });

    /* 🆕 立即渲染一次 */
    render();

    return {
      destroy: () => {
        if (_unsubPolicies) { try { _unsubPolicies(); } catch (e) { /* noop */ } }
        if (_unsubMembers) { try { _unsubMembers(); } catch (e) { /* noop */ } }
        if (_statsApi) { try { _statsApi.destroy(); } catch (e) { /* noop */ } }
        if (_clickHandler) document.getElementById('insurance-card-view')?.removeEventListener('click', _clickHandler);
      },
    };
  },
};