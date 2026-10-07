// ============================================
// tab-yearrange.js — 基礎資料庫：年份範圍 Tab（v101.6）
// 位置：js/pages/database/tab-yearrange.js
// ============================================
// v101.6 修正：
//   ✅ 使用 listener-group 統一管理訂閱
//   ✅ 使用 setText / escapeHtml（utils.js）
//   ✅ confirm 改用 openConfirm（已於 v101.5）
// ============================================

import { listenYearRange, saveYearRange } from '../../core/db.js';
import { getYearRange as getMergedYearRange } from '../../config/app-config.js';
import { LIMITS } from '../../config/constants.js';
import { escapeHtml } from '../../core/utils.js';
import { showToast } from '../../shared/toast.js';
import { openConfirm } from '../../shared/modal.js';
import { buildForm } from '../../shared/form-builder.js';
import { createListenerGroup } from '../../shared/listener-group.js';

/* ============================================
   Module 狀態
   ============================================ */
let _container = null;
let _formApi = null;
let _currentRange = { startYear: null, futureYears: LIMITS.YEAR_FUTURE_DEFAULT };
let _hasFamilyOverride = false;
let _resetBtnHandler = null;

const listenerGroup = createListenerGroup();

/* ============================================
   主入口
   ============================================ */
export function initYearRangeTab(containerId) {
  _container = document.getElementById(containerId);
  if (!_container) {
    console.warn(`⚠️ initYearRangeTab: 找不到容器 #${containerId}`);
    return null;
  }

  _container.innerHTML = _buildSkeleton();

  _renderForm();
  _bindEvents();

  listenerGroup.add(
    listenYearRange((data) => {
      if (data && (data.startYear != null || data.futureYears != null)) {
        _currentRange = {
          startYear: data.startYear != null ? Number(data.startYear) : null,
          futureYears: Number(data.futureYears) || LIMITS.YEAR_FUTURE_DEFAULT,
        };
        _hasFamilyOverride = true;
      } else {
        const merged = getMergedYearRange();
        _currentRange = {
          startYear: merged.startYear,
          futureYears: merged.endYear - new Date().getFullYear(),
        };
        _hasFamilyOverride = false;
      }

      if (_formApi) {
        _formApi.setData({
          'db-yr-start': _currentRange.startYear != null ? _currentRange.startYear : '',
          'db-yr-future': _currentRange.futureYears,
        });
      }
      _refreshPreview();
    })
  );

  return {
    refresh: _refreshPreview,
    destroy: _destroy,
  };
}

/* ============================================
   骨架
   ============================================ */
function _buildSkeleton() {
  return `
    <div class="banner" style="margin-bottom:16px;">
      ℹ️ 用於全站的年份下拉選單範圍。
      <strong>起始年份</strong>：往回至少顯示 3 年（自動調整）。
      <strong>往後顯示年數</strong>：當前年再往後顯示 N 年。
    </div>

    <div class="grid grid-2" style="gap:16px; align-items:start;">
      <div>
        <div class="glass-card">
          <div class="glass-card-title" style="display:flex; align-items:center; gap:8px; margin-bottom:16px;">
            <i data-lucide="calendar" style="width:16px;height:16px; color:var(--neon-cyan);"></i>
            <span>年份範圍設定</span>
          </div>

          <div id="db-yearrange-form-root"></div>

          <div style="margin-top:16px; padding-top:16px; border-top:1px dashed rgba(255,255,255,0.08); text-align:right;">
            <button class="btn btn-ghost btn-sm" id="db-yearrange-reset">
              <i data-lucide="rotate-ccw" style="width:14px;height:14px;"></i>
              重置為平台預設
            </button>
          </div>
        </div>
      </div>

      <div>
        <div class="glass-card">
          <div class="glass-card-title" style="display:flex; align-items:center; gap:8px; margin-bottom:16px;">
            <i data-lucide="eye" style="width:16px;height:16px; color:var(--neon-cyan);"></i>
            <span>實際範圍預覽</span>
          </div>

          <div id="db-yearrange-preview"></div>
        </div>
      </div>
    </div>
  `;
}

/* ============================================
   表單
   ============================================ */
function _renderForm() {
  const currentYear = new Date().getFullYear();

  _formApi = buildForm({
    containerId: 'db-yearrange-form-root',
    fields: [
      {
        type: 'number',
        id: 'db-yr-start',
        label: '起始年份',
        min: 1900,
        max: 2200,
        step: 1,
        placeholder: `例如：${currentYear - 3}（留空 = 當前年 - 3）`,
        hint: `若填寫的年份大於「當前年 - ${LIMITS.YEAR_PAST_DEFAULT}」，會自動調整為「當前年 - ${LIMITS.YEAR_PAST_DEFAULT}」`,
      },
      {
        type: 'number',
        id: 'db-yr-future',
        label: '往後顯示年數',
        required: true,
        min: 0,
        max: 20,
        step: 1,
        placeholder: String(LIMITS.YEAR_FUTURE_DEFAULT),
      },
    ],
    submitText: '儲存設定',
    showCancel: false,
    showReset: false,
    beforeSubmit: _validateYearRange,
    onSubmit: _handleSubmit,
  });

  _formApi.setData({
    'db-yr-start': '',
    'db-yr-future': LIMITS.YEAR_FUTURE_DEFAULT,
  });

  _formApi.onFieldChange('db-yr-start', _refreshPreview);
  _formApi.onFieldChange('db-yr-future', _refreshPreview);
}

function _validateYearRange(data) {
  const { startYear, futureYears } = _parseFormValues(data);

  if (startYear != null && (isNaN(startYear) || startYear < 1900 || startYear > 2200)) {
    return { field: 'db-yr-start', message: '請填寫合理的年份（1900 ~ 2200）' };
  }
  if (isNaN(futureYears) || futureYears < 0 || futureYears > 20) {
    return { field: 'db-yr-future', message: '請填寫 0 ~ 20 之間的數字' };
  }
  return true;
}

async function _handleSubmit(data) {
  const { startYear, futureYears } = _parseFormValues(data);

  try {
    await saveYearRange({ startYear, futureYears });
    _hasFamilyOverride = true;
    showToast('✅ 年份範圍已儲存', 'success');
    _refreshPreview();
  } catch (err) {
    showToast('儲存失敗：' + err.message, 'error');
  }
}

/* ============================================
   事件
   ============================================ */
function _bindEvents() {
  _resetBtnHandler = async () => {
    if (!_hasFamilyOverride) {
      showToast('目前已是平台預設', 'info');
      return;
    }

    const ok = await openConfirm('確定要清除家庭自訂，改回使用平台預設嗎？', {
      title: '重置年份範圍',
      okText: '重置',
      okClass: 'btn-danger',
    });
    if (!ok) return;

    try {
      await saveYearRange({ startYear: null, futureYears: LIMITS.YEAR_FUTURE_DEFAULT });
      _hasFamilyOverride = false;
      showToast('✅ 已重置為平台預設', 'success');
    } catch (err) {
      showToast('重置失敗：' + err.message, 'error');
    }
  };

  _container.querySelector('#db-yearrange-reset')?.addEventListener('click', _resetBtnHandler);
}

/* ============================================
   預覽
   ============================================ */
function _refreshPreview() {
  const previewEl = _container?.querySelector('#db-yearrange-preview');
  if (!previewEl) return;

  const { startYear, futureYears } = _parseFormValues();

  const curY = new Date().getFullYear();

  let actualStart;
  let wasAdjusted = false;

  if (startYear != null && !isNaN(startYear)) {
    const minStart = curY - LIMITS.YEAR_PAST_DEFAULT;
    actualStart = Math.min(startYear, minStart);
    if (startYear > minStart) wasAdjusted = true;
  } else {
    actualStart = curY - LIMITS.YEAR_PAST_DEFAULT;
  }

  const actualEnd = curY + futureYears;

  const years = [];
  for (let y = actualStart; y <= actualEnd && years.length < 30; y++) {
    years.push(y);
  }
  const totalYears = actualEnd - actualStart + 1;

  const curYStr = String(curY);

  previewEl.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:14px;">

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div class="stat-item" style="padding:12px; border:1px solid var(--glass-border); border-radius:var(--radius-md); background:rgba(8,11,17,0.4);">
          <div style="font-size:11px; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">起始年</div>
          <div class="mono" style="font-size:20px; font-weight:700; color:var(--neon-cyan);">${actualStart}</div>
        </div>
        <div class="stat-item" style="padding:12px; border:1px solid var(--glass-border); border-radius:var(--radius-md); background:rgba(8,11,17,0.4);">
          <div style="font-size:11px; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">結束年</div>
          <div class="mono" style="font-size:20px; font-weight:700; color:var(--neon-cyan);">${actualEnd}</div>
        </div>
      </div>

      <div style="padding:10px 12px; border-radius:var(--radius-md); background:rgba(0,240,255,0.04); border:1px solid var(--glass-border); font-size:12px; color:var(--text-secondary);">
        共 <span class="mono text-cyan" style="font-weight:700;">${totalYears}</span> 個年份
        ${wasAdjusted ? `<br><span style="color:var(--neon-orange);">⚠️ 起始年已自動調整為 ${actualStart}（當前年 - ${LIMITS.YEAR_PAST_DEFAULT}）</span>` : ''}
      </div>

      <div>
        <div style="font-size:11px; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px; margin-bottom:8px;">年份清單</div>
        <div style="display:flex; flex-wrap:wrap; gap:6px;">
          ${years.map((y) => {
            const isCurrent = String(y) === curYStr;
            const bg = isCurrent ? 'rgba(0,240,255,0.2)' : 'rgba(8,11,17,0.4)';
            const border = isCurrent ? 'rgba(0,240,255,0.5)' : 'var(--glass-border)';
            const color = isCurrent ? 'var(--neon-cyan)' : 'var(--text-secondary)';
            return `<span class="mono" style="padding:4px 10px; border-radius:var(--radius-sm); border:1px solid ${border}; background:${bg}; color:${color}; font-size:12px; font-weight:${isCurrent ? '700' : '400'};">${y}</span>`;
          }).join('')}
          ${totalYears > 30 ? `<span class="text-muted" style="padding:4px 10px; font-size:12px;">…還有 ${totalYears - 30} 年</span>` : ''}
        </div>
      </div>

      <div style="font-size:11px; color:var(--text-muted); padding-top:10px; border-top:1px dashed rgba(255,255,255,0.08);">
        目前來源：
        ${_hasFamilyOverride
          ? '<span class="badge badge-info" style="margin-left:4px;">家庭自訂</span>'
          : '<span class="badge badge-muted" style="margin-left:4px;">平台預設</span>'}
      </div>

    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
}

/* ============================================
   工具
   ============================================ */
function _parseFormValues(data) {
  let rawStart;
  let rawFuture;

  if (data) {
    rawStart = data['db-yr-start'];
    rawFuture = data['db-yr-future'];
  } else if (_formApi) {
    rawStart = _formApi.getFieldValue('db-yr-start');
    rawFuture = _formApi.getFieldValue('db-yr-future');
  }

  const startYear = (rawStart === '' || rawStart == null) ? null : Number(rawStart);
  let futureYears = Number(rawFuture);
  if (isNaN(futureYears)) futureYears = LIMITS.YEAR_FUTURE_DEFAULT;

  return { startYear, futureYears };
}

/* ============================================
   銷毀
   ============================================ */
function _destroy() {
  listenerGroup.destroy();

  if (_formApi) {
    try { _formApi.destroy(); } catch (e) { /* noop */ }
    _formApi = null;
  }
  if (_resetBtnHandler && _container) {
    _container.querySelector('#db-yearrange-reset')?.removeEventListener('click', _resetBtnHandler);
    _resetBtnHandler = null;
  }
  _container = null;
}