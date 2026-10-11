// Relais de session côté onglet : création, long-polling des appels MCP, retour des résultats — /api/session
import { createSession, checkToken, touch, takeCalls, putResult, closeSession } from '../lib/sessions.mjs';
import { json, preflight, rateLimit, readBody } from '../lib/http.mjs';

export default async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  const url = new URL(req.url);
  const wait = rateLimit(req, 'session', 900);
  if (wait) return json({ error: `Trop de requêtes (réessayez dans ${wait}s)` }, 429);
  if (req.method === 'GET' && url.searchParams.get('op') === 'poll') {
    const sess = await checkToken(url.searchParams.get('session'), url.searchParams.get('token'));
    if (!sess) return json({ error: 'Session inconnue ou jeton invalide' }, 401);
    await touch(sess);
    const calls = await takeCalls(sess.id, 7000);
    return json({ calls });
  }
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405);
  let body;
  try { body = await readBody(req, 8 * 1024 * 1024); } catch (e) { return json({ error: e.message }, e.status || 400); }
  if (body.op === 'create') {
    const s = await createSession(body.name);
    return json({ sessionId: s.id, token: s.token, pairCode: s.pairCode, expiresAt: new Date(s.expiresAt).toISOString(), mcpUrl: `${url.origin}/mcp?session=${s.id}` });
  }
  const sess = await checkToken(body.session, body.token);
  if (!sess) return json({ error: 'Session inconnue ou jeton invalide' }, 401);
  if (body.op === 'result') {
    if (!body.callId) return json({ error: 'callId manquant' }, 400);
    await putResult(sess.id, String(body.callId), body.result);
    await touch(sess);
    return json({ ok: true });
  }
  if (body.op === 'close') { await closeSession(sess.id); return json({ ok: true }); }
  return json({ error: `Opération inconnue : ${body.op}` }, 400);
};

export const config = { path: '/api/session' };
