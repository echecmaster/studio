// Tests du serveur MCP (fonction Netlify) en mémoire : initialize, tools/list, outils serveur, relais de session
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.MOTION_MEMORY_STORE = '1';
const mcp = (await import('../netlify/functions/mcp.mjs')).default;
const session = (await import('../netlify/functions/session.mjs')).default;
const share = (await import('../netlify/functions/share.mjs')).default;

let n = 0;
async function rpc(method, params, { query = '', sid } = {}) {
  const res = await mcp(new Request(`http://localhost/mcp${query}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(sid ? { 'mcp-session-id': sid } : {}) }, body: JSON.stringify({ jsonrpc: '2.0', id: ++n, method, params }) }));
  return { status: res.status, sid: res.headers.get('mcp-session-id'), body: res.status === 202 ? null : await res.json() };
}

test('initialize renvoie la version de protocole et un Mcp-Session-Id', async () => {
  const r = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } });
  assert.equal(r.body.result.protocolVersion, '2025-06-18');
  assert.ok(r.sid);
  const notif = await mcp(new Request('http://localhost/mcp', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) }));
  assert.equal(notif.status, 202);
});

test('tools/list expose toutes les commandes + outils serveur', async () => {
  const r = await rpc('tools/list');
  const names = r.body.result.tools.map((t) => t.name);
  for (const t of ['clip_add', 'render_frame', 'render_contact_sheet', 'export_start', 'project_lint', 'project_apply_commands', 'catalog_search', 'session_attach']) assert.ok(names.includes(t), t);
  for (const t of r.body.result.tools) assert.match(t.name, /^[a-zA-Z0-9_-]{1,64}$/);
});

test('project_apply_commands construit un projet sans navigateur', async () => {
  const r = await rpc('tools/call', { name: 'project_apply_commands', arguments: { commands: [{ name: 'clip.add', args: { kind: 'text', props: { text: 'Bonjour' } } }, { name: 'animation_apply_preset', args: { preset: 'popIn' } }] } });
  const data = JSON.parse(r.body.result.content[0].text);
  assert.equal(data.valid, true);
  assert.equal(data.project.clips.length, 1);
  assert.ok(data.project.clips[0].keyframes['transform.scale']);
});

test('outil "onglet" sans session → message explicite', async () => {
  const r = await rpc('tools/call', { name: 'render_frame', arguments: { t: 1 } });
  assert.equal(r.body.result.isError, true);
  assert.match(r.body.result.content[0].text, /onglet/);
});

test('catalogues, ressources et prompts', async () => {
  const s = await rpc('tools/call', { name: 'catalog_search', arguments: { query: 'glitch' } });
  assert.ok(JSON.parse(s.body.result.content[0].text).count > 3);
  const res = await rpc('resources/read', { uri: 'motion://catalog/effects' });
  assert.ok(JSON.parse(res.body.result.contents[0].text).length >= 150);
  const pl = await rpc('prompts/list');
  assert.equal(pl.body.result.prompts.length, 7);
  const pg = await rpc('prompts/get', { name: 'create_intro', arguments: { brand: 'X' } });
  assert.match(pg.body.result.messages[0].content.text, /X/);
});

test('relais de session : file d\'appels → onglet → résultat', async () => {
  const c = await session(new Request('http://localhost/api/session', { method: 'POST', body: JSON.stringify({ op: 'create' }) }));
  const s = await c.json();
  assert.ok(s.sessionId && s.token && /^\d{6}$/.test(s.pairCode));
  // un "onglet" simulé répond aux appels
  const tab = (async () => {
    for (let i = 0; i < 30; i++) {
      const p = await session(new Request(`http://localhost/api/session?op=poll&session=${s.sessionId}&token=${s.token}`));
      const { calls } = await p.json();
      for (const call of calls) await session(new Request('http://localhost/api/session', { method: 'POST', body: JSON.stringify({ op: 'result', session: s.sessionId, token: s.token, callId: call.callId, result: { content: [{ type: 'text', text: JSON.stringify({ echo: call.tool }) }] } }) }));
      if (calls.length) return;
    }
  })();
  const init = await rpc('initialize', { protocolVersion: '2025-06-18' });
  const att = await rpc('tools/call', { name: 'session_attach', arguments: { code: s.pairCode } }, { sid: init.sid });
  assert.match(att.body.result.content[0].text, /attached/);
  const r = await rpc('tools/call', { name: 'playback_get_state', arguments: {} }, { sid: init.sid });
  await tab;
  assert.match(r.body.result.content[0].text, /playback\.get_state/);
});

test('partage : enregistrement puis chargement', async () => {
  const proj = JSON.parse((await rpc('tools/call', { name: 'project_create_from_template', arguments: { template: 'countdown' } })).body.result.content[0].text);
  const p = await share(new Request('http://localhost/api/share', { method: 'POST', body: JSON.stringify(proj) }));
  const { id } = await p.json();
  const g = await share(new Request(`http://localhost/api/share?id=${id}`));
  const back = await g.json();
  assert.equal(back.project.meta.name, proj.meta.name);
});
