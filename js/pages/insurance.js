// ============================================
// insurance.js — 保險清單表（v103.0.19）
// 位置：js/pages/insurance.js
// ============================================
// v103.0.19 修正：
//   ✅ 已供滿保單區塊加展開 / 收合
// ============================================

import { formatHKD } from '../lib/format.js';
import { esc } from '../lib/dom.js';
import { computeEnrichedPolicies, calcProgress, getPolicyHolderId } from '../lib/insurance.js';
import { getInsurancePaymentsOnce } from '../core/db.js';
import { resolveName } from '../config/entity-registry.js';
import { AppState } from '../core/state.js';
import { openEntityModal } from '../entity/entity-modal.js';
import { deleteEntity } from '../entity/entity-helpers.js';
import { openConfirm } from '../ui/modal.js';
import { showToast } from '../ui/toast.js';
import { renderStatsCards } from '../shared/stats-cards.js';
import { ENTITY_KEYS } from '../config/constants.js';

export default {
  title: '保險清單表',
  data: {
    policies: { type: 'list', path: 'insurance_policies' },
  },
  state: {},
  derived: {},
  blocks: [],

  customMount: (ctx) => {
    let _payments = {};
    let _statsApi = null;
    let _clickHandler = null;
    let _toggleHandler = null;
    let _lastIds = '';

    const render = () => {
      const policies = ctx.data.policies || [];
      const { year } = AppState.getYearMonth();
      const targetYear = Number(year) || new Date().getFullYear();
      const enriched = computeEnrichedPolicies(policies, _payments, targetYear);

      const statsRoot = document.getElementById('insurance-stats-root');
      if (statsRoot) {
        if (_statsApi) { try { _statsApi.destroy(); } catch (e) {} }
        statsRoot.innerHTML = '';
        _statsApi = renderStatsCards({
          container: 'insurance-stats-root',
          cards: [
            { title: `${targetYear} 年度保單總供款`, value: formatHKD(enriched.reduce((s, p) => s + (p._currentAnnualPremium || 0), 0)), valueClass: 'cyan', hint: `共 ${enriched.length} 張保單`, icon: 'wallet' },
            { title: '供款中保單', value: `${enriched.filter((p) => !p._isCompleted).length} 張`, valueClass: 'emerald', hint: '未供滿的保單數量', icon: 'shield' },
            { title: '已供滿保單', value: `${enriched.filter((p) => p._isCompleted).length} 張`, valueClass: 'emerald', hint: '已完成供款年期', icon: 'check-circle' },
          ],
          columns: 3,
        });
      }

      _paintSection(enriched.filter((p) => p._isCompleted));
      _paintActive(enriched.filter((p) => !p._isCompleted), policies.length);
      if (window.lucide) window.lucide.createIcons();
    };

    const _paintSection = (list) => {
      const s = document.getElementById('completed-section');
      const g = document.getElementById('completed-grid');
      const c = document.getElementById('completed-count');
      if (!s || !g) return;
      if (list.length === 0) { s.style.display = 'none'; return; }
      s.style.display = 'block';
      if (c) c.textContent = String(list.length);
      const html = list.map(_cardHtml).join('');
      if (g.__lastHtml === html) return;
      g.__lastHtml = html;
      g.innerHTML = html;
    };

    const _paintActive = (active, total) => {
      const cardEl = document.getElementById('insurance-card-view');
      const tableEl = document.getElementById('insurance-table-view');
      const emptyEl = document.getElementById('insurance-empty-state');
      if (!cardEl || !tableEl) return;
      if (total === 0) {
        if (emptyEl) emptyEl.style.display = 'block';
        cardEl.style.display = 'none';
        tableEl.style.display = 'none';
        return;
      }
      if (emptyEl) emptyEl.style.display = 'none';
      cardEl.style.display = 'block';
      tableEl.style.display = 'none';
      const html = active.length === 0
        ? '<div class="glass-card" style="text-align:center;padding:40px 20px;"><p style="color:var(--neon-emerald);">🎉 所有保單均已供滿</p></div>'
        : `<div class="grid grid-3">${active.map((p) => `<div class="glass-card policy-card">${_cardHtml(p)}</div>`).join('')}</div>`;
      if (cardEl.__lastHtml === html) return;
      cardEl.__lastHtml = html;
      cardEl.innerHTML = html;
    };

    const _cardHtml = (p) => {
      const holderId = getPolicyHolderId(p);
      const holder = resolveName('members', holderId) || holderId || '—';
      const insured = resolveName('members', p.memberId) || p.memberId || '—';
      const isFund = p.type === 'fund_insurance';
      const total = p.totalPolicyPeriods || 0;
      const done = p.completedPeriods || 0;
      const pct = calcProgress(p);
      const canInput = AppState.getCanInput();
      const actions = canInput ? `<div class="policy-actions"><button type="button" class="btn btn-sm btn-ghost" data-action="edit-policy" data-id="${p.id}"><i data-lucide="pencil" style="width:14px;height:14px;"></i> 編輯</button><button type="button" class="btn btn-sm btn-danger" data-action="delete-policy" data-id="${p.id}"><i data-lucide="trash-2" style="width:14px;height:14px;"></i> 刪除</button></div>` : '';
      const progressHtml = isFund ? '' : `<div class="policy-progress" style="margin-top:12px;"><div class="policy-progress-text"><span>整體供款進度</span><span>${done} / ${total} 期 (${pct}%)</span></div><div class="progress"><div class="progress-bar" style="width:${pct}%;"></div></div></div>`;
      return `<div class="policy-header"><div><div class="policy-name">${esc(p.name || '')}</div><div class="policy-company">${esc(p.company || '')} · ${isFund ? '基金保險' : '普通保險'}</div></div></div>
        <div class="policy-info-grid">
          <div class="policy-info-item"><span class="policy-info-label">保單持有人</span><span class="policy-info-value">${esc(holder)}</span></div>
          <div class="policy-info-item"><span class="policy-info-label">受保人</span><span class="policy-info-value">${esc(insured)}</span></div>
        </div>
        <div class="policy-info-grid" style="margin-top:10px;padding-top:10px;border-top:1px dashed rgba(255,255,255,0.08);">
          <div class="policy-info-item"><span class="policy-info-label">本期年繳</span><span class="policy-info-value text-cyan">${formatHKD(p._currentAnnualPremium)}</span></div>
          <div class="policy-info-item"><span class="policy-info-label">保單總供款</span><span class="policy-info-value text-magenta">${formatHKD(p._totalPremium)}</span></div>
        </div>${progressHtml}${actions}`;
    };

    const _loadPayments = async () => {
      const policies = ctx.data.policies || [];
      const ids = policies.map((p) => p.id).sort().join(',');
      if (ids === _lastIds) return;
      _lastIds = ids;
      if (policies.length === 0) { _payments = {}; return; }
      try {
        const snaps = await Promise.all(policies.map((p) => getInsurancePaymentsOnce(p.id)));
        _payments = {};
        policies.forEach((p, i) => { _payments[p.id] = snaps[i]; });
      } catch (e) { _payments = {}; }
    };

    _clickHandler = async (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn || !AppState.getCanInput()) return;
      const policies = ctx.data.policies || [];
      const policy = policies.find((p) => p.id === btn.dataset.id);
      if (!policy) return;
      if (btn.dataset.action === 'edit-policy') {
        openEntityModal({ entity: ENTITY_KEYS.POLICY, mode: 'edit', id: policy.id, allRows: policies });
      } else if (btn.dataset.action === 'delete-policy') {
        const ok = await openConfirm(`⚠️ 確定要刪除保單「${policy.name}」嗎？`, { title: '刪除保單', okText: '刪除', okClass: 'btn-danger' });
        if (!ok) return;
        try { await deleteEntity(ENTITY_KEYS.POLICY, policy.id, getPolicyHolderId(policy)); showToast('✅ 已刪除保單', 'success'); }
        catch (err) { showToast('刪除失敗：' + err.message, 'error'); }
      }
    };
    document.getElementById('insurance-card-view')?.addEventListener('click', _clickHandler);
    document.getElementById('completed-grid')?.addEventListener('click', _clickHandler);

    /* 🆕 已供滿區塊展開 / 收合 */
    const headerEl = document.getElementById('completed-header');
    const bodyEl = document.getElementById('completed-body');
    const sectionEl = document.getElementById('completed-section');
    _toggleHandler = () => {
      if (!bodyEl || !sectionEl) return;
      const open = bodyEl.style.display === 'block';
      bodyEl.style.display = open ? 'none' : 'block';
      sectionEl.classList.toggle('open', !open);
    };
    if (headerEl) headerEl.addEventListener('click', _toggleHandler);

    const unsub = ctx.onDataChange(async (key) => {
      if (key.startsWith('data.policies') || key === '__APP__') await _loadPayments();
      render();
    });

    _loadPayments().then(render);

    return {
      destroy: () => {
        unsub();
        if (_statsApi) { try { _statsApi.destroy(); } catch (e) {} }
        if (_clickHandler) {
          document.getElementById('insurance-card-view')?.removeEventListener('click', _clickHandler);
          document.getElementById('completed-grid')?.removeEventListener('click', _clickHandler);
        }
        if (_toggleHandler && headerEl) headerEl.removeEventListener('click', _toggleHandler);
      },
    };
  },
};

/* ═══════════════════════════════════════════
   END OF FILE
   File: js/pages/insurance.js
   Version: v103.0.19
   Batch: B20
   ═══════════════════════════════════════════ */