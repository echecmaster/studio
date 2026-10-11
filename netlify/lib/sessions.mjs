// Sessions de relais : un onglet Motion Studio ouvert ↔ un ou plusieurs clients MCP
import { getStoreSafe, randomId, randomCode } from './store.mjs';
import { sleep } from './http.mjs';

const TTL = 12 * 3600 * 1000;
export const store = () => getStoreSafe('motion-mcp');

export async function createSession(name = '') {
  const s = await store();
  const id = randomId(12);
  const session = { id, token: randomId(24), pairCode: randomCode(6), name: String(name).slice(0, 80), createdAt: Date.now(), expiresAt: Date.now() + TTL, lastSeen: Date.now() };
  await s.setJSON(`sess/${id}`, session);
  await s.setJSON(`pair/${session.pairCode}`, { id, expiresAt: session.expiresAt });
  return session;
}

export async function getSession(id) {
  if (!id || !/^[a-f0-9]{8,64}$/.test(id)) return null;
  const s = await store();
  const sess = await s.get(`sess/${id}`, { type: 'json' });
  if (!sess) return null;
  if (sess.expiresAt < Date.now()) { await s.delete(`sess/${id}`); return null; }
  return sess;
}

export async function checkToken(id, token) {
  const sess = await getSession(id);
  if (!sess || sess.token !== token) return null;
  return sess;
}

export async function touch(sess) {
  const s = await store();
  sess.lastSeen = Date.now();
  await s.setJSON(`sess/${sess.id}`, sess);
}

export async function closeSession(id) {
  const s = await store();
  const sess = await s.get(`sess/${id}`, { type: 'json' });
  if (sess) await s.delete(`pair/${sess.pairCode}`);
  await s.delete(`sess/${id}`);
}

export async function resolvePair(code) {
  const s = await store();
  const p = await s.get(`pair/${String(code).replace(/\D/g, '')}`, { type: 'json' });
  if (!p || p.expiresAt < Date.now()) return null;
  return p.id;
}

export async function bindMcpSession(mcpSid, motionSid) { const s = await store(); await s.setJSON(`bind/${mcpSid}`, { id: motionSid, at: Date.now() }); }
export async function boundSession(mcpSid) { if (!mcpSid) return null; const s = await store(); const b = await s.get(`bind/${mcpSid}`, { type: 'json' }); return b?.id || null; }

// File d'appels (MCP → onglet)
export async function enqueue(sid, tool, args) {
  const s = await store();
  const callId = `${Date.now().toString(36)}${randomId(4)}`;
  await s.setJSON(`q/${sid}/${callId}`, { callId, tool, args, createdAt: Date.now() });
  return callId;
}

export async function takeCalls(sid, waitMs = 8000) {
  const s = await store();
  const deadline = Date.now() + waitMs;
  do {
    const { blobs } = await s.list({ prefix: `q/${sid}/` });
    if (blobs.length) {
      const calls = [];
      for (const b of blobs.sort((a, c) => (a.key < c.key ? -1 : 1))) {
        const c = await s.get(b.key, { type: 'json' });
        await s.delete(b.key);
        if (c && Date.now() - c.createdAt < 120000) calls.push(c);
      }
      if (calls.length) return calls;
    }
    await sleep(400);
  } while (Date.now() < deadline);
  return [];
}

export async function putResult(sid, callId, result) {
  const s = await store();
  await s.setJSON(`r/${sid}/${callId}`, { result, at: Date.now() });
}

export async function waitResult(sid, callId, waitMs = 8500) {
  const s = await store();
  const deadline = Date.now() + waitMs;
  do {
    const r = await s.get(`r/${sid}/${callId}`, { type: 'json' });
    if (r) { await s.delete(`r/${sid}/${callId}`); return r.result; }
    await sleep(300);
  } while (Date.now() < deadline);
  return null;
}

export async function peekResult(sid, callId) {
  const s = await store();
  const r = await s.get(`r/${sid}/${callId}`, { type: 'json' });
  if (r) await s.delete(`r/${sid}/${callId}`);
  return r?.result || null;
}
