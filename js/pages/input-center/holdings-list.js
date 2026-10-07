// ============================================
// holdings-list.js — 輸入中心：保單 / 基金 / 銀行（v101.6.4）
// 位置：js/pages/input-center/holdings-list.js
// ============================================
// v101.6.4 修正：
//   ✅ 表格外層加 .input-center-table-wrapper（可橫向滑動）
//   ✅ 長文字不再被截斷（移除 overflow: hidden）
// ============================================

import {
  listenInsurancePolicies, listenFunds, listenBanks,
} from '../../core/db.js';
import { escapeHtml, formatHKD } from '../../core/utils.js';
import { ENTITY_KEYS } from '../../config/constants.js';
import { showToast } from '../../shared/toast.js';
import { openConfirm } from '../../shared/modal.js';
import { openEntityModal } from '../../shared/entity-modal.js';
import { deleteEntity } from '../../shared/entity-helpers.js';
import { createListenerGroup } from '../../shared/listener-group.js';

let _policies = [];
let _funds = [];
let _banks = [];

export function initHoldingsList(containerId, options = {}) {
  const root = document.getElementById(containerId);
  if (!root) {
    console.warn(`⚠️ initHoldingsList: 找不到容器 #${containerId}`);
    return null;
  }

  const listenerGroup = createListenerGroup();
  root.innerHTML = '<div class="empty-state">載入中…</div>';

  listenerGroup.add(listenInsurancePolicies((list) => {
    _policies = list || [];
    _render(root);
  }));

  listenerGroup.add(listenFunds((list) => {
    _funds = list || [];
    _render(root);
  }));

  listenerGroup.add(listenBanks((list) => {
    _banks = list || [];
    _render(root);
  }));

  const clickHandler = (e) => _handleClick(e, root);
  root.addEventListener('click', clickHandler);

  return {
    refresh: () => _render(root),
    destroy: () => {
      listenerGroup.destroy();
      root.removeEventListener('click', clickHandler);
      root.innerHTML = '';
    },
  };
}

function _render(root) {
  if (!root) return;

  const sections = [];

  sections.push(_renderSection({
    key: 'policy',
    title: '保單',
    icon: 'shield',
    rows: _policies,
    columns: [
      { key: 'name', label: '保單名稱' },
      { key: 'company', label: '保險公司' },
    ],
    amountFn: (p) => {
      const cur = (p.periods || {})[String(p.currentPeriodIndex || 1)];
      return cur ? cur.annualPremium : 0;
    },
    amountLabel: '本期年繳',
  }));

  sections.push(_renderSection({
    key: 'fund',
    title: '基金',
    icon: 'line-chart',
    rows: _funds,
    columns: [
      { key: 'name', label: '基金名稱' },
      { key: 'units', label: '單位數' },
    ],
    amountFn: (f) => f.currentValue,
    amountLabel: '現值',
  }));

  sections.push(_renderSection({
    key: 'bank',
    title: '銀行',
    icon: 'landmark',
    rows: _banks,
    columns: [
      { key: 'name', label: '銀行名稱' },
    ],
    amountFn: null,
    amountLabel: '',
  }));

  root.innerHTML = `<div style="padding:0 20px 20px;">${sections.join('')}</div>`;

  if (window.lucide) window.lucide.createIcons();
}

function _renderSection(config) {
  const { key, title, icon, rows, columns, amountFn, amountLabel } = config;

  if (!rows || rows.length === 0) {
    return `
      <div style="margin-bottom:16px;">
        <div class="flex items-center gap-8" style="margin-bottom:8px;">
          <i data-lucide="${icon}" style="width:16px;height:16px; color:var(--neon-cyan);"></i>
          <span style="font-weight:600; font-size:14px;">${escapeHtml(title)}</span>
          <span class="text-muted" style="font-size:12px;">（0）</span>
        </div>
        <div class="glass-card" style="padding:16px;">
          <div class="empty-state" style="padding:12px;">尚無${escapeHtml(title)}</div>
        </div>
      </div>
    `;
  }

  const hasAmount = typeof amountFn === 'function';

  return `
    <div style="margin-bottom:16px;">
      <div class="flex items-center gap-8" style="margin-bottom:8px;">
        <i data-lucide="${icon}" style="width:16px;height:16px; color:var(--neon-cyan);"></i>
        <span style="font-weight:600; font-size:14px;">${escapeHtml(title)}</span>
        <span class="text-muted" style="font-size:12px;">（${rows.length}）</span>
      </div>
      <div class="glass-card" style="padding:0; overflow:hidden;">
        <div class="input-center-table-wrapper">
          <table class="input-center-table">
            <thead>
              <tr>
                ${columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join('')}
                ${hasAmount ? `<th class="num" style="width:110px;">${escapeHtml(amountLabel)}</th>` : ''}
                <th style="width:130px;">操作</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((row) => _renderRow(key, row, columns, amountFn, hasAmount)).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function _renderRow(entityKey, row, columns, amountFn, hasAmount) {
  return `
    <tr data-entity="${entityKey}" data-id="${escapeHtml(row.id)}">
      ${columns.map((c) => {
        const val = row[c.key];
        return `<td>${val != null && val !== '' ? escapeHtml(String(val)) : '<span class="text-muted">—</span>'}</td>`;
      }).join('')}
      ${hasAmount ? `
        <td class="num text-emerald">${formatHKD(amountFn(row))}</td>
      ` : ''}
      <td>
        <button class="btn btn-sm btn-ghost" data-action="edit" data-id="${escapeHtml(row.id)}">編輯</button>
        <button class="btn btn-sm btn-danger" data-action="delete" data-id="${escapeHtml(row.id)}">刪除</button>
      </td>
    </tr>
  `;
}

function _handleClick(e, root) {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;

  const action = btn.dataset.action;
  const id = btn.dataset.id;
  const tr = btn.closest('tr');
  if (!tr) return;

  const entityType = tr.dataset.entity;
  const entityKey = _mapEntityKey(entityType);

  if (action === 'edit') {
    _handleEdit(entityKey, id);
  } else if (action === 'delete') {
    _handleDelete(entityKey, id);
  }
}

function _mapEntityKey(type) {
  switch (type) {
    case 'policy': return ENTITY_KEYS.POLICY;
    case 'fund':   return ENTITY_KEYS.FUND;
    case 'bank':   return ENTITY_KEYS.BANK;
    default:       return type;
  }
}

function _handleEdit(entityKey, id) {
  const rows = _getRowsByEntityKey(entityKey);
  openEntityModal({
    entity: entityKey,
    mode: 'edit',
    id,
    allRows: rows,
  });
}

function _getRowsByEntityKey(entityKey) {
  switch (entityKey) {
    case ENTITY_KEYS.POLICY: return _policies;
    case ENTITY_KEYS.FUND:   return _funds;
    case ENTITY_KEYS.BANK:   return _banks;
    default:                 return [];
  }
}

async function _handleDelete(entityKey, id) {
  const rows = _getRowsByEntityKey(entityKey);
  const row = rows.find((r) => r.id === id);
  if (!row) return;

  const label = _getEntityLabel(entityKey);
  let confirmText = `確定要刪除「${row.name || id}」嗎？`;

  if (entityKey === ENTITY_KEYS.POLICY) {
    confirmText = `⚠️ 確定要刪除保單「${row.name}」嗎？\n\n這將會一併刪除所有相關的扣款紀錄與成員支出，此操作無法復原。`;
  } else if (entityKey === ENTITY_KEYS.BANK) {
    confirmText = `⚠️ 確定要刪除「${row.name}」嗎？\n\n這將會一併刪除該銀行在所有月份的結餘紀錄，此操作無法復原。`;
  }

  const ok = await openConfirm(confirmText, {
    title: `刪除${label}`,
    okText: '刪除',
    okClass: 'btn-danger',
  });
  if (!ok) return;

  try {
    let args = [];
    if (entityKey === ENTITY_KEYS.POLICY) {
      args = [row.memberId];
    }
    await deleteEntity(entityKey, id, ...args);
    showToast(`✅ 已刪除${label}`, 'success');
  } catch (err) {
    console.error('[holdings-list] 刪除失敗：', err);
    showToast('刪除失敗：' + err.message, 'error');
  }
}

function _getEntityLabel(entityKey) {
  switch (entityKey) {
    case ENTITY_KEYS.POLICY: return '保單';
    case ENTITY_KEYS.FUND:   return '基金';
    case ENTITY_KEYS.BANK:   return '銀行';
    default:                 return '項目';
  }
}