// ============================================
// [[path]].js — 兼容層 catch-all 路由（v103.0.0）
// 位置：functions/api/[[path]].js
// ============================================
// 用途：
//   v103 合併 API 後，舊 URL 路徑（如 /api/lookup-family）需保持相容。
//   Cloudflare Pages Functions 優先匹配精確檔案名稱，
//   此 catch-all 只會攔截「無對應檔案」的路徑。
// ============================================

export async function onRequest(ctx) {
  const url = new URL(ctx.request.url);
  const path = url.pathname.replace(/^\/api\//, '').replace(/\/$/, '');
  const method = ctx.request.method;

  /* 分派對照表：舊路徑 → (模組, handler, 允許方法) */
  const ROUTES = {
    /* 專用 handler */
    'lookup-family':        { mod: 'family',    fn: 'handleLookup',          methods: ['POST'] },
    'annual-summary':       { mod: 'summary',   fn: 'handleAnnual',          methods: ['GET']  },
    'settlements-year':     { mod: 'summary',   fn: 'handleSettlementsYear', methods: ['GET']  },

    /* 走模組預設 onRequestGet / onRequestPost */
    'family-settings':      { mod: 'family',    fn: null, methods: ['GET', 'POST'] },
    'family-accounts':      { mod: 'family',    fn: null, methods: ['GET', 'POST'] },
    'admin-families':       { mod: 'admin',     fn: null, methods: ['GET', 'POST'] },
    'admin-init-family':    { mod: 'admin',     fn: null, methods: ['POST'] },
    'platform-settings':    { mod: 'platform',  fn: null, methods: ['GET', 'POST'] },
    'platform-defaults':    { mod: 'platform',  fn: null, methods: ['GET', 'POST'] },
    'bank-accounts':        { mod: 'bank',      fn: null, methods: ['GET', 'POST'] },
    'bank-transactions':    { mod: 'bank',      fn: null, methods: ['GET', 'POST'] },
    'clear-bank-balances':  { mod: 'bank',      fn: null, methods: ['POST'] },
    'personal-income':      { mod: 'personal',  fn: null, methods: ['GET', 'POST'] },
    'member-advances':      { mod: 'personal',  fn: null, methods: ['GET', 'POST'] },
    'insurance-sync':       { mod: 'insurance', fn: null, methods: ['POST'] },
  };

  const route = ROUTES[path];

  /* 未列入兼容清單 → 回 404（通常不會走到這，因為精確檔案優先） */
  if (!route) {
    return _json({ ok: false, error: 'NOT_FOUND' }, 404);
  }

  /* OPTIONS preflight */
  if (method === 'OPTIONS') {
    try {
      const mod = await import(`./${route.mod}.js`);
      if (typeof mod.onRequestOptions === 'function') return mod.onRequestOptions();
    } catch (e) { /* noop */ }
    return _cors204();
  }

  /* 檢查方法 */
  if (!route.methods.includes(method)) {
    return _json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405);
  }

  /* 動態 import + 呼叫 */
  try {
    const mod = await import(`./${route.mod}.js`);

    /* 專用 handler */
    if (route.fn) {
      const handler = mod[route.fn];
      if (typeof handler !== 'function') {
        console.error(`[[path]] handler not found: ${route.fn} in ${route.mod}.js`);
        return _json({ ok: false, error: 'HANDLER_NOT_FOUND' }, 500);
      }
      return handler(ctx.request);
    }

    /* 分派到 mod.onRequestGet / mod.onRequestPost */
    const methodHandler = method === 'GET' ? mod.onRequestGet : mod.onRequestPost;
    if (typeof methodHandler !== 'function') {
      return _json({ ok: false, error: 'METHOD_NOT_FOUND' }, 405);
    }
    return methodHandler(ctx);
  } catch (err) {
    console.error('[[path]] router error:', err);
    return _json({ ok: false, error: 'INTERNAL', message: String(err?.message || err) }, 500);
  }
}

/* ============================================
   內部工具
   ============================================ */
function _json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function _cors204() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
