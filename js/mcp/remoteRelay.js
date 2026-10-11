// Adaptateur C (côté onglet) : relais de session vers le serveur MCP Netlify.
// L'onglet s'enregistre, reçoit un sessionId + code d'appairage, puis interroge la file des appels (long-polling)
// et renvoie les résultats. Le rendu et l'export s'exécutent ici, dans le navigateur.
import { toMcpContent } from './format.js';

const API = '/api/session';

export class RemoteRelay {
  constructor(app) {
    this.app = app;
    this.bus = app.bus;
    this.session = null;
    this.running = false;
    this.log = [];
    this.backoff = 1000;
  }

  status() { return this.bus.app.get().mcp; }
  setStatus(patch) { this.bus.app.patch({ mcp: { ...this.bus.app.get().mcp, ...patch } }); }

  async connect() {
    if (this.running) return this.session;
    this.setStatus({ relay: 'connexion…' });
    let res;
    try { res = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'create', name: this.bus.project.get().meta.name }) }); }
    catch (e) { this.setStatus({ relay: 'hors ligne' }); throw new Error(`Relais MCP injoignable : ${e.message}`); }
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { this.setStatus({ relay: 'indisponible' }); throw new Error(j.error || `Relais MCP indisponible (HTTP ${res.status}). Il nécessite le déploiement Netlify (Functions + Blobs).`); }
    this.session = j;
    this.running = true;
    this.setStatus({ relay: 'connecté', sessionId: j.sessionId, pairCode: j.pairCode, mcpUrl: `${location.origin}/mcp?session=${j.sessionId}`, expiresAt: j.expiresAt });
    this.loop();
    return j;
  }

  disconnect() {
    this.running = false;
    if (this.session) fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'close', session: this.session.sessionId, token: this.session.token }) }).catch(() => {});
    this.session = null;
    this.setStatus({ relay: 'déconnecté', sessionId: null, pairCode: null, mcpUrl: null });
  }

  async loop() {
    while (this.running && this.session) {
      try {
        const { sessionId, token } = this.session;
        const res = await fetch(`${API}?op=poll&session=${encodeURIComponent(sessionId)}&token=${encodeURIComponent(token)}`, { cache: 'no-store' });
        if (res.status === 404 || res.status === 401) { this.app.log('warn', 'Session MCP expirée : reconnexion…'); this.running = false; this.session = null; await this.connect(); return; }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { calls = [] } = await res.json();
        this.backoff = 1000;
        for (const call of calls) await this.execute(call);
        if (!calls.length) await new Promise((r) => setTimeout(r, 500));
      } catch (e) {
        this.setStatus({ relay: 'reconnexion…' });
        await new Promise((r) => setTimeout(r, this.backoff));
        this.backoff = Math.min(15000, this.backoff * 2);
        if (this.running) this.setStatus({ relay: 'connecté' });
      }
    }
  }

  async execute(call) {
    const started = Date.now();
    const def = this.bus.registry.get(call.tool);
    let res;
    if (!def) res = { ok: false, error: `Outil inconnu : ${call.tool}` };
    else res = await this.bus.run(def.name, call.args || {});
    const content = toMcpContent(res);
    this.log.push({ time: started, tool: call.tool, ok: res.ok, error: res.error, ms: Date.now() - started });
    if (this.log.length > 200) this.log.shift();
    this.app.mcp.onLog?.();
    await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'result', session: this.session.sessionId, token: this.session.token, callId: call.callId, result: content }) }).catch((e) => this.app.log('error', `Relais MCP : envoi du résultat impossible (${e.message})`));
  }
}
