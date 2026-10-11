// Serveur MCP distant (Streamable HTTP, JSON-RPC 2.0) — POST /mcp
import { handleRpc, resolveMotionSession, PROTOCOL_VERSIONS } from '../lib/mcpServer.mjs';
import { json, preflight, rateLimit, readBody, CORS } from '../lib/http.mjs';
import { randomId } from '../lib/store.mjs';
import { getSession } from '../lib/sessions.mjs';

export default async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  const url = new URL(req.url);
  if (req.method === 'GET') {
    // pas de flux SSE serveur → 405 conformément à la spécification Streamable HTTP ; page d'info si navigateur
    if ((req.headers.get('accept') || '').includes('text/html')) return new Response(`<!doctype html><meta charset="utf-8"><title>Motion Studio MCP</title><body style="background:#050505;color:#EDEDED;font-family:system-ui;padding:40px"><h1 style="color:#24D26D">Motion Studio — serveur MCP</h1><p>Point d'accès MCP (Streamable HTTP) : <code>${url.origin}/mcp</code>${url.searchParams.get('session') ? ` · session <code>${url.searchParams.get('session')}</code>` : ''}.</p><p>Ajoutez cette URL comme connecteur MCP personnalisé dans votre client (Claude, Cursor…).</p>`, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', ...CORS } });
    return new Response('Flux SSE non proposé : utilisez POST.', { status: 405, headers: { allow: 'POST, OPTIONS, DELETE', ...CORS } });
  }
  if (req.method === 'DELETE') return new Response(null, { status: 200, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405);
  const wait = rateLimit(req, 'mcp', 240);
  if (wait) return json({ jsonrpc: '2.0', id: null, error: { code: -32000, message: `Trop de requêtes, réessayez dans ${wait}s` } }, 429, { 'retry-after': String(wait) });
  let body;
  try { body = await readBody(req, 6 * 1024 * 1024); } catch (e) { return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: e.message } }, e.status || 400); }
  let mcpSessionId = req.headers.get('mcp-session-id');
  const msgs = Array.isArray(body) ? body : [body];
  const isInit = msgs.some((m) => m?.method === 'initialize');
  if (isInit && !mcpSessionId) mcpSessionId = randomId(16);
  const explicit = url.searchParams.get('session') || req.headers.get('x-motion-session') || null;
  const ctx = { mcpSessionId, explicitSession: explicit, origin: url.origin };
  ctx.motionSession = await resolveMotionSession(ctx);
  if (ctx.motionSession && !(await getSession(ctx.motionSession))) ctx.motionSession = null;
  const out = [];
  for (const m of msgs) {
    if (!m || m.jsonrpc !== '2.0' || typeof m.method !== 'string') { if (m?.id !== undefined) out.push({ jsonrpc: '2.0', id: m.id ?? null, error: { code: -32600, message: 'Requête JSON-RPC invalide' } }); continue; }
    const r = await handleRpc(m, ctx);
    if (r && m.id !== undefined) out.push(r);
  }
  const headers = { 'mcp-protocol-version': req.headers.get('mcp-protocol-version') || PROTOCOL_VERSIONS[0] };
  if (mcpSessionId) headers['mcp-session-id'] = mcpSessionId;
  if (!out.length) return new Response(null, { status: 202, headers: { ...CORS, ...headers } });
  return json(Array.isArray(body) ? out : out[0], 200, headers);
};

export const config = { path: '/mcp' };
