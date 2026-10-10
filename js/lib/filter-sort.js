// filter-sort.js — 通用篩選 / 排序（v103.0.18）

/**
 * 篩選 list
 * @param {Array} list
 * @param {Object} filters - { field: value }，空值忽略
 * @param {Object} [opts]
 * @param {string} [opts.startsWithField] - 前綴比對欄位（例如 year）
 */
export function applyFilters(list, filters, opts = {}) {
  if (!filters || Object.keys(filters).length === 0) return [...list];
  return list.filter((r) => {
    for (const [k, v] of Object.entries(filters)) {
      if (v == null || v === '') continue;
      if (k.endsWith('StartsWith')) {
        const f = k.slice(0, -10);
        if (!String(r[f] || '').startsWith(v)) return false;
      } else {
        if (r[k] !== v) return false;
      }
    }
    return true;
  });
}

/**
 * 排序 list
 * @param {Array} list
 * @param {string} mode - 排序模式
 * @param {Object} [modes] - 自訂模式
 */
export function applySort(list, mode, modes = {}) {
  const arr = [...list];
  const builtin = {
    'date-desc': (a, b) => (b.date || '').localeCompare(a.date || ''),
    'date-asc': (a, b) => (a.date || '').localeCompare(b.date || ''),
    'amount-desc': (a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0),
    'amount-asc': (a, b) => (Number(a.amount) || 0) - (Number(b.amount) || 0),
    'name-asc': (a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'zh-HK'),
    'pending-first': (a, b) => {
      if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;
      return (b.date || '').localeCompare(a.date || '');
    },
  };
  const fn = modes[mode] || builtin[mode];
  if (fn) arr.sort(fn);
  return arr;
}