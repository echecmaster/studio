// Aides HTTP : CORS, JSON, limite de débit simple (par instance), limite de taille des corps
export const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
  'access-control-allow-headers': 'content-type, authorization, mcp-session-id, mcp-protocol-version, x-motion-session, last-event-id',
  'access-control-expose-headers': 'mcp-session-id, mcp-protocol-version',
  'access-control-max-age': '86400',
  // ressources partageables malgré COEP require-corp sur le site
  'cross-origin-resource-policy': 'cross-origin',
};

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS, ...headers } });
}

export function preflight() { return new Response(null, { status: 204, headers: CORS }); }

const buckets = new Map();
export function rateLimit(req, key, max, windowMs = 60000) {
  const ip = req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const k = `${key}:${ip}`;
  const now = Date.now();
  const b = buckets.get(k) || { n: 0, reset: now + windowMs };
  if (now > b.reset) { b.n = 0; b.reset = now + windowMs; }
  b.n++;
  buckets.set(k, b);
  if (buckets.size > 5000) for (const [kk, v] of buckets) if (now > v.reset) buckets.delete(kk);
  return b.n > max ? Math.ceil((b.reset - now) / 1000) : 0;
}

export async function readBody(req, maxBytes) {
  const len = +(req.headers.get('content-length') || 0);
  if (len > maxBytes) throw Object.assign(new Error(`Corps de requête trop volumineux (max ${(maxBytes / 1048576).toFixed(1)} Mo)`), { status: 413 });
  const text = await req.text();
  if (text.length > maxBytes) throw Object.assign(new Error(`Corps de requête trop volumineux (max ${(maxBytes / 1048576).toFixed(1)} Mo)`), { status: 413 });
  try { return text ? JSON.parse(text) : {}; } catch { throw Object.assign(new Error('JSON invalide'), { status: 400 }); }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
