// 本物の Postgres を Supabase（PostgREST）のふりをして出す小さなサーバー。
// 点検のときだけ使う。アプリのコードは一切変えずに、本物のSQLに当てられる。
const http = require('http');
const { Client, types } = require('pg');
// date(1082) は本物の PostgREST と同じく「2026-11-21」の文字で返す
types.setTypeParser(1082, (v) => v);

const DB = process.env.WATCH_DB || 'mogu22';
const AS_USER = process.env.WATCH_USER || '88888888-8888-8888-8888-888888888888';
const PORT = Number(process.env.WATCH_PORT || 54330);

const client = new Client({ host: '127.0.0.1', port: 5433, database: DB, user: 'postgres' });

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'Access-Control-Expose-Headers': 'content-range',
};

// 呼ばれたものを全部記録する（監視役が後で読む）
const calls = [];

async function asUser(run) {
  await client.query('begin');
  try {
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [AS_USER]);
    const out = await run();
    await client.query('commit');
    return out;
  } catch (e) {
    await client.query('rollback').catch(() => {});
    throw e;
  }
}

// 関数の形（何行返すか・引数の型）を1回だけ調べて覚える
const fnCache = new Map();
async function fnInfo(fn) {
  if (fnCache.has(fn)) return fnCache.get(fn);
  const r = await client.query(
    `select p.proretset,
            coalesce(p.proargnames, '{}') as names,
            (select array_agg(format_type(t, null) order by i)
               from unnest(coalesce(p.proallargtypes, p.proargtypes::oid[])) with ordinality as a(t, i)) as types
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = $1
      order by p.pronargs desc limit 1`, [fn]);
  const row = r.rows[0] || {};
  const types = {};
  (row.names || []).forEach((n, i) => { if (n) types[n] = (row.types || [])[i] || 'text'; });
  const info = { setOf: !!row.proretset, types };
  fnCache.set(fn, info);
  return info;
}

// PostgREST のしぼりこみ（使っているぶんだけ）
function whereFrom(params) {
  const skip = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);
  const parts = [];
  const vals = [];
  for (const [k, raw] of params) {
    if (skip.has(k)) continue;
    const m = /^(eq|neq|gt|gte|lt|lte|in|is|like|ilike)\.(.*)$/s.exec(raw);
    if (!m) continue;
    const [, op, v] = m;
    const col = `"${k.replace(/"/g, '')}"`;
    if (op === 'is') { parts.push(`${col} is ${v === 'null' ? 'null' : v}`); continue; }
    if (op === 'in') {
      const list = v.replace(/^\(|\)$/g, '').split(',').map((x) => x.replace(/^"|"$/g, ''));
      if (list.length === 0) { parts.push('false'); continue; }
      vals.push(list); parts.push(`${col} = any($${vals.length})`);
      continue;
    }
    const sqlop = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', like: 'like', ilike: 'ilike' }[op];
    vals.push(v === 'true' ? true : v === 'false' ? false : v);
    parts.push(`${col} ${sqlop} $${vals.length}`);
  }
  return { sql: parts.length ? ' where ' + parts.join(' and ') : '', vals };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }

  let body = '';
  for await (const c of req) body += c;

  const send = (code, obj, extra = {}) => {
    res.writeHead(code, { 'content-type': 'application/json', ...CORS, ...extra });
    res.end(JSON.stringify(obj));
  };

  try {
    const mRpc = /^\/rest\/v1\/rpc\/([a-z0-9_]+)$/i.exec(url.pathname);
    if (mRpc) {
      const fn = mRpc[1];
      const args = body ? JSON.parse(body) : {};
      const keys = Object.keys(args);
      const { setOf, types } = await fnInfo(fn);
      const argSql = keys.map((k, i) => `${k} => $${i + 1}::${types[k] || 'text'}`).join(', ');
      const vals = keys.map((k) => {
        const v = args[k];
        // jsonb・配列はそのまま文字にして渡す
        if (v !== null && typeof v === 'object') return JSON.stringify(v);
        return v;
      });
      const out = await asUser(async () => {
        if (setOf) {
          const r = await client.query(`select * from public.${fn}(${argSql})`, vals);
          return r.rows;
        }
        const r = await client.query({ text: `select public.${fn}(${argSql})`, values: vals, rowMode: 'array' });
        return r.rows.length === 0 ? null : r.rows[0][0];
      });
      calls.push({ kind: 'rpc', name: fn, ok: true });
      return send(200, out === undefined ? null : out);
    }

    const mTable = /^\/rest\/v1\/([a-z0-9_]+)$/i.exec(url.pathname);
    if (mTable) {
      const table = mTable[1];
      const params = [...url.searchParams.entries()];
      const { sql: where, vals } = whereFrom(params);
      if (req.method === 'GET') {
        const sel = url.searchParams.get('select') || '';
        // 「*, restaurants(*)」のような、くっつけた読みに応える
        const embed = /([a-z0-9_]+)\(\*\)/i.exec(sel);
        let cols = /^[a-z0-9_,]+$/i.test(sel) && sel ? sel.split(',').map((c) => `"${c}"`).join(', ') : '*';
        let joinSql = '';
        if (embed) {
          const child = embed[1];
          const fk = `${child.replace(/s$/, '')}_id`; // swipes.restaurant_id → restaurants
          cols = `t.*, to_jsonb(c.*) as "${child}"`;
          joinSql = ` left join public."${child}" c on c.id = t."${fk}"`;
        }
        const ord = url.searchParams.get('order');
        let orderSql = '';
        if (ord && /^[a-z0-9_]+(\.(asc|desc))?(\.nullslast|\.nullsfirst)?$/i.test(ord)) {
          const [c, d] = ord.split('.');
          orderSql = ` order by "${c}" ${/desc/i.test(d || '') ? 'desc' : 'asc'}`;
        }
        const lim = url.searchParams.get('limit');
        const limSql = lim && /^\d+$/.test(lim) ? ` limit ${lim}` : '';
        const w = embed ? where.replace(/ "/g, ' t."') : where;
        const o = embed ? orderSql.replace(/ "/g, ' t."') : orderSql;
        const rows = await asUser(async () => {
          const r = await client.query(`select ${cols} from public."${table}"${embed ? ' t' : ''}${joinSql}${w}${o}${limSql}`, vals);
          return r.rows;
        });
        calls.push({ kind: 'select', name: table, ok: true, rows: rows.length });
        const single = /vnd\.pgrst\.object/.test(req.headers.accept || '');
        return send(200, single ? (rows[0] ?? null) : rows);
      }
      if (req.method === 'POST' || req.method === 'PATCH' || req.method === 'DELETE') {
        // 書き込みは「受け取った」とだけ返す（点検では中身を壊さない）
        calls.push({ kind: req.method.toLowerCase(), name: table, ok: true });
        return send(200, []);
      }
    }

    if (url.pathname === '/__calls') return send(200, calls);
    if (url.pathname === '/__reset') { calls.length = 0; return send(200, { ok: true }); }

    return send(404, { message: 'not found: ' + url.pathname });
  } catch (e) {
    const name = (/rpc\/([a-z0-9_]+)/i.exec(url.pathname) || [, url.pathname])[1];
    calls.push({ kind: 'error', name, ok: false, message: e.message });
    return send(400, { message: e.message, code: e.code || 'ERR', details: e.detail || null, hint: e.hint || null });
  }
});

client.connect().then(() => {
  server.listen(PORT, '127.0.0.1', () => console.log('pgrest on ' + PORT + ' db=' + DB));
});
