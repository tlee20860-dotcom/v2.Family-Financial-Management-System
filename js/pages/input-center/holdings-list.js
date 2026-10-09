// ============================================
// holdings-list.js — 輸入中心：保單 / 基金 / 銀行（v102.0.0）
// 位置：js/pages/input-center/holdings-list.js
// ============================================
// v102.0.0 修正：
//   ✅ 銀行 Tab 改用 bank_accounts（取代舊 banks）
//   ✅ 保留 v101.10.0 骨架只建立一次
// ============================================

import {
  listenInsurancePolicies, listenFunds, listenBanks, listenBankAccounts,
} from '../../core/db.js';
import { escapeHtml, formatHKD } from '../../core/utils.js';
import { ENTITY_KEYS } from '../../config/constants.js';
import { AppState } from '../../core/state.js';
import { showToast } from '../../shared/toast.js';
import { openConfirm } from '../../shared/modal.js';
import { openEntityModal } from '../../shared/entity-modal.js';
import { deleteEntity } from '../../shared/entity-helpers.js';
import { api } from '../../core/api.js';
import { createListenerGroup } from '../../shared/listener-group.js';
import { renderDataTable } from '../../shared/data-table.js';
import { initViewToggle } from '../../shared/view-toggle.js';

let _policies = [];
let _funds = [];
let _banks = [];         // 🔄 v102.0.0：改為 bank_accounts
let _legacyBanks = [];   // 保留舊 banks 相容

export function initHoldingsList(containerId, options = {}) {
  const root = document.getElementById(containerId);
  if (!root) {
    console.warn(`⚠️ initHoldingsList: 找不到容器 #${containerId}`);
    return null;
  }

  const types = options.types || ['policy', 'fund', 'bank'];
  const listenerGroup = createListenerGroup();
  const instances = {};

  delete root.dataset.initialized;
  root.innerHTML = '<div class="empty-state">載入中…</div>';

  if (types.includes('policy')) {
    listenerGroup.add(listenInsurancePolicies((list) => {
      _policies = list || [];
      _render(root, containerId, types, instances);
    }));
  }
  if (types.includes('fund')) {
    listenerGroup.add(listenFunds((list) => {
      _funds = list || [];
      _render(root, containerId, types, instances);
    }));
  }
  if (types.includes('bank')) {
    // 🆕 v102.0.0：監聽 bank_accounts
    listenerGroup.add(listenBankAccounts((list) => {
      _banks = list || [];
      _render(root, containerId, types, instances);
    }));
    // 相容：同時監聽舊 banks
    listenerGroup.add(listenBanks((list) => {
      _legacyBanks = list || [];
    }));
  }

  return {
    refresh: () => _render(root, containerId, types, instances),
    destroy: () => {
      listenerGroup.destroy();
      Object.values(instances).forEach((inst) => {
        if (inst?.viewToggle) { try { inst.viewToggle.destroy(); } catch (e) {} }
        if (inst?.tableApi) { try { inst.tableApi.destroy(); } catch (e) {} }
      });
      root.innerHTML = '';
      delete root.dataset.initialized;
    },
  };
}

function _render(root, containerId, types, instances) {
  if (!root) return;

  const sections = [];
  if (types.includes('policy')) sections.push('policy');
  if (types.includes('fund')) sections.push('fund');
  if (types.includes('bank')) sections.push('bank');

  if (!root.dataset.initialized) {
    const html = sections.map((key) => _renderSectionHtml(key, containerId)).join('');
    root.innerHTML = `<div style="padding:0 0 20px;">${html}</div>`;
    if (window.lucide) window.lucide.createIcons();
    sections.forEach((key) => _initSectionShell(key, containerId, instances));
    root.dataset.initialized = '1';
  }

  sections.forEach((key) => _updateSectionContent(key, containerId, instances));
}

function _initSectionShell(key, containerId, instances) {
  const toggleEl = document.getElementById(`${containerId}-${key}-view-toggle`);
  if (!toggleEl) return;

  if (instances[key]) {
    if (instances[key].viewToggle) { try { instances[key].viewToggle.destroy(); } catch (e) {} }
    if (instances[key].tableApi) { try { instances[key].tableApi.destroy(); } catch (e) {} }
  }

  const viewToggle = initViewToggle({
    containerId: `${containerId}-${key}-view-toggle`,
    storageKey: `holdings-${key}-view`,
    defaultView: 'table',
    cardText: '卡片',
    tableText: '表格',
    autoApply: false,
    onChange: () => _renderSectionContent(key, containerId, instances),
  });

  instances[key] = { viewToggle, tableApi: null };
}

function _updateSectionContent(key, containerId, instances) {
  const config = _getSectionConfig(key);
  const contentEl = document.getElementById(`${containerId}-${key}-content`);
  const countEl = document.getElementById(`${containerId}-${key}-count`);
  if (!contentEl) return;

  const rows = config.getRows();
  if (countEl) countEl.textContent = `（${rows.length}）`;

  if (!rows.length) {
    if (instances[key]?.tableApi) {
      try { instances[key].tableApi.destroy(); } catch (e) {}
      instances[key].tableApi = null;
    }
    contentEl.innerHTML = `<div class="glass-card"><div class="empty-state">尚無${escapeHtml(config.title)}</div></div>`;
    return;
  }

  _renderSectionContent(key, containerId, instances);
}

function _renderSectionHtml(key, containerId) {
  const config = _getSectionConfig(key);
  return `
    <div style="margin-bottom:16px;">
      <div class="flex items-center justify-between gap-8" style="margin-bottom:8px; flex-wrap:wrap;">
        <div class="flex items-center gap-8">
          <i data-lucide="${config.icon}" style="width:16px;height:16px; color:var(--neon-cyan);"></i>
          <span style="font-weight:600; font-size:14px;">${escapeHtml(config.title)}</span>
          <span class="text-muted" style="font-size:12px;" id="${containerId}-${key}-count"></span>
        </div>
        <div id="${containerId}-${key}-view-toggle"></div>
      </div>
      <div id="${containerId}-${key}-content"></div>
    </div>
  `;
}

function _getSectionConfig(key) {
  switch (key) {
    case 'policy': return {
      title: '保單', icon: 'shield',
      getRows: () => _policies,
      columns: [
        { id: 'name', label: '保單名稱', defaultVisible: true, defaultWidth: 200 },
        { id: 'company', label: '保險公司', defaultVisible: true, defaultWidth: 120 },
        { id: 'amount', label: '本期年繳', defaultVisible: true, defaultWidth: 120 },
      ],
      resolvers: {
        name: (_, row) => escapeHtml(row.name || '—'),
        company: (_, row) => escapeHtml(row.company || '—'),
        amount: (_, row) => {
          const cur = (row.periods || {})[String(row.currentPeriodIndex || 1)];
          return `<span class="text-emerald">${formatHKD(cur ? cur.annualPremium : 0)}</span>`;
        },
      },
      renderDetail: (row) => {
        const cur = (row.periods || {})[String(row.currentPeriodIndex || 1)];
        return `<div style="font-size:13px; display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:8px 20px;">
          <div><div style="color:var(--text-muted); font-size:11px; margin-bottom:2px;">保單名稱</div><div>${escapeHtml(row.name || '—')}</div></div>
          <div><div style="color:var(--text-muted); font-size:11px; margin-bottom:2px;">保險公司</div><div>${escapeHtml(row.company || '—')}</div></div>
          <div><div style="color:var(--text-muted); font-size:11px; margin-bottom:2px;">本期年繳</div><div class="mono text-emerald">${formatHKD(cur ? cur.annualPremium : 0)}</div></div>
          <div><div style="color:var(--text-muted); font-size:11px; margin-bottom:2px;">保單開始</div><div>${row.firstStartYear}-${row.firstStartMonth}</div></div>
        </div>`;
      },
      entityKey: ENTITY_KEYS.POLICY,
      cardAmount: (row) => {
        const cur = (row.periods || {})[String(row.currentPeriodIndex || 1)];
        return formatHKD(cur ? cur.annualPremium : 0);
      },
      cardSubtitle: (row) => row.company || '—',
      cardFields: (row) => [
        { label: '開始', value: `${row.firstStartYear}-${row.firstStartMonth}` },
      ],
    };
    case 'fund': return {
      title: '基金', icon: 'line-chart',
      getRows: () => _funds,
      columns: [
        { id: 'name', label: '基金名稱', defaultVisible: true, defaultWidth: 200 },
        { id: 'units', label: '單位數', defaultVisible: true, defaultWidth: 100 },
        { id: 'currentValue', label: '現值', defaultVisible: true, defaultWidth: 140 },
      ],
      resolvers: {
        name: (_, row) => escapeHtml(row.name || '—'),
        units: (_, row) => escapeHtml(String(row.units || '—')),
        currentValue: (val) => `<span class="text-emerald">${formatHKD(val)}</span>`,
      },
      renderDetail: (row) => `<div style="font-size:13px; display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:8px 20px;">
        <div><div style="color:var(--text-muted); font-size:11px; margin-bottom:2px;">基金名稱</div><div>${escapeHtml(row.name || '—')}</div></div>
        <div><div style="color:var(--text-muted); font-size:11px; margin-bottom:2px;">單位數</div><div class="mono">${escapeHtml(String(row.units || '—'))}</div></div>
        <div><div style="color:var(--text-muted); font-size:11px; margin-bottom:2px;">現值</div><div class="mono text-emerald">${formatHKD(row.currentValue)}</div></div>
      </div>`,
      entityKey: ENTITY_KEYS.FUND,
      cardAmount: (row) => formatHKD(row.currentValue),
      cardSubtitle: (row) => row.units ? `單位數 ${row.units}` : '',
      cardFields: () => [],
    };
    case 'bank': return {
      // 🆕 v102.0.0：改為銀行帳號
      title: '銀行帳號', icon: 'landmark',
      getRows: () => _banks,
      columns: [
        { id: 'name', label: '銀行名稱', defaultVisible: true, defaultWidth: 200 },
        { id: 'typeLabel', label: '類型', defaultVisible: true, defaultWidth: 100 },
        { id: 'initialBalance', label: '初始餘額', defaultVisible: true, defaultWidth: 140 },
        { id: 'initialYM', label: '初始年月', defaultVisible: true, defaultWidth: 100 },
      ],
      resolvers: {
        name: (_, row) => escapeHtml(row.name || '—'),
        typeLabel: (_, row) => row.type === 'personal'
          ? '<span class="badge badge-muted">個人</span>'
          : '<span class="badge badge-info">家庭</span>',
        initialBalance: (val) => `<span class="mono">${formatHKD(val)}</span>`,
        initialYM: (_, row) => `<span class="mono" style="font-size:12px; color:var(--text-muted);">${row.initialYear || '—'}-${row.initialMonth || '—'}</span>`,
      },
      renderDetail: (row) => `<div style="font-size:13px; display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:8px 20px;">
        <div><div style="color:var(--text-muted); font-size:11px; margin-bottom:2px;">銀行</div><div>${escapeHtml(row.name || '—')}</div></div>
        <div><div style="color:var(--text-muted); font-size:11px; margin-bottom:2px;">類型</div><div>${row.type === 'personal' ? '個人' : '家庭'}</div></div>
        <div><div style="color:var(--text-muted); font-size:11px; margin-bottom:2px;">初始餘額</div><div class="mono">${formatHKD(row.initialBalance)}</div></div>
        <div><div style="color:var(--text-muted); font-size:11px; margin-bottom:2px;">初始年月</div><div class="mono">${row.initialYear || '—'}-${row.initialMonth || '—'}</div></div>
      </div>`,
      entityKey: '__bank_account__',
      cardAmount: (row) => formatHKD(row.initialBalance),
      cardSubtitle: (row) => row.type === 'personal' ? '個人帳號' : '家庭帳號',
      cardFields: (row) => [
        { label: '初始年月', value: `${row.initialYear || '—'}-${row.initialMonth || '—'}` },
      ],
    };
  }
}

function _renderSectionContent(key, containerId, instances) {
  const config = _getSectionConfig(key);
  const contentEl = document.getElementById(`${containerId}-${key}-content`);
  if (!contentEl) return;

  const rows = config.getRows();
  const view = instances[key]?.viewToggle?.getView() || 'table';

  if (instances[key]?.tableApi) { try { instances[key].tableApi.destroy(); } catch (e) {} instances[key].tableApi = null; }

  if (view === 'card') {
    _renderSectionCards(contentEl, rows, config);
  } else {
    _renderSectionTable(contentEl, rows, config, key, instances);
  }
}

function _renderSectionTable(contentEl, rows, config, key, instances) {
  contentEl.innerHTML = `<div id="holdings-${key}-table-root"></div>`;

  const userCanInput = AppState.getCanInput();
  // 銀行帳號為特殊實體，操作需導向設定頁
  const isBankAccount = key === 'bank';

  instances[key].tableApi = renderDataTable({
    container: `holdings-${key}-table-root`,
    entityKey: `__holdings_${key}__`,
    rows,
    tableId: `holdings-${key}-table`,
    options: {
      columns: config.columns,
      resolvers: config.resolvers,
      mobileCardMode: false,
      collapsible: true,
      defaultCollapsed: false,
      expandable: true,
      storageKey: `holdings-${key}-table`,
      renderDetail: config.renderDetail,
    },
    hooks: {
      customActions: userCanInput && !isBankAccount
        ? (row) => [
            { label: '編輯', icon: 'pencil', className: 'btn-ghost', action: 'edit-item', onClick: (r) => _handleEdit(key, config.entityKey, r) },
            { label: '刪除', icon: 'trash-2', className: 'btn-danger', action: 'delete-item', onClick: (r) => _handleDelete(key, config.entityKey, r) },
          ]
        : () => [],
    },
  });

  if (window.lucide) window.lucide.createIcons();
}

function _renderSectionCards(contentEl, rows, config) {
  contentEl.innerHTML = `
    <div class="data-cards-grid" data-section-key="${config.entityKey}">
      ${rows.map((row) => _renderSectionCard(row, config)).join('')}
    </div>
  `;
  if (window.lucide) window.lucide.createIcons();

  const cardsGrid = contentEl.querySelector('.data-cards-grid');
  if (cardsGrid) {
    cardsGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const id = btn.dataset.id;
      const row = rows.find((r) => r.id === id);
      if (!row) return;
      const action = btn.dataset.action;
      if (action === 'edit-item') _handleEdit(null, config.entityKey, row);
      else if (action === 'delete-item') _handleDelete(null, config.entityKey, row);
    });
  }
}

function _renderSectionCard(row, config) {
  const amount = config.cardAmount(row);
  const subtitle = config.cardSubtitle(row);
  const fields = config.cardFields(row);
  const userCanInput = AppState.getCanInput();
  const isBankAccount = config.entityKey === '__bank_account__';

  const actionsHtml = userCanInput && !isBankAccount ? `
    <div style="margin-top:12px; padding-top:12px; border-top:1px dashed rgba(255,255,255,0.08); display:flex; gap:8px; justify-content:flex-end;">
      <button type="button" class="btn btn-sm btn-ghost" data-action="edit-item" data-id="${escapeHtml(row.id)}">
        <i data-lucide="pencil" style="width:14px;height:14px;"></i> 編輯
      </button>
      <button type="button" class="btn btn-sm btn-danger" data-action="delete-item" data-id="${escapeHtml(row.id)}">
        <i data-lucide="trash-2" style="width:14px;height:14px;"></i> 刪除
      </button>
    </div>
  ` : '';

  return `
    <div class="glass-card" style="padding:14px;">
      <div style="font-size:14px; font-weight:600; word-break:break-word; margin-bottom:4px;">${escapeHtml(row.name || '（未命名）')}</div>
      ${subtitle ? `<div style="font-size:11px; color:var(--text-muted); margin-bottom:8px;">${escapeHtml(subtitle)}</div>` : ''}
      ${amount ? `<div class="mono text-emerald" style="font-size:16px; font-weight:700; margin-bottom:8px;">${amount}</div>` : ''}
      ${fields.length ? `
        <div style="display:flex; flex-direction:column; gap:4px; font-size:12px;">
          ${fields.map((f) => `<div style="display:flex; justify-content:space-between;"><span class="text-muted">${escapeHtml(f.label)}</span><span>${escapeHtml(String(f.value))}</span></div>`).join('')}
        </div>
      ` : ''}
      ${actionsHtml}
    </div>
  `;
}

function _handleEdit(sectionKey, entityKey, row) {
  if (!AppState.getCanInput()) return;
  if (entityKey === '__bank_account__') {
    showToast('請至「系統設定 → 銀行帳號」編輯', 'info');
    return;
  }
  openEntityModal({ entity: entityKey, mode: 'edit', id: row.id, allRows: _getRowsByEntityKey(entityKey) });
}

function _getRowsByEntityKey(entityKey) {
  if (entityKey === ENTITY_KEYS.POLICY) return _policies;
  if (entityKey === ENTITY_KEYS.FUND) return _funds;
  if (entityKey === '__bank_account__') return _banks;
  return [];
}

async function _handleDelete(sectionKey, entityKey, row) {
  if (!AppState.getCanInput()) return;
  if (entityKey === '__bank_account__') {
    showToast('請至「系統設定 → 銀行帳號」刪除', 'info');
    return;
  }

  let confirmText = `確定要刪除「${row.name || row.id}」嗎？`;
  if (entityKey === ENTITY_KEYS.POLICY) confirmText = `⚠️ 確定要刪除保單「${row.name}」嗎？\n\n這將會一併刪除所有相關的扣款紀錄與成員支出，此操作無法復原。`;

  const ok = await openConfirm(confirmText, { title: '刪除', okText: '刪除', okClass: 'btn-danger' });
  if (!ok) return;

  try {
    const args = entityKey === ENTITY_KEYS.POLICY ? [row.memberId] : [];
    await deleteEntity(entityKey, row.id, ...args);
    showToast('✅ 已刪除', 'success');
  } catch (err) {
    showToast('刪除失敗：' + err.message, 'error');
  }
}