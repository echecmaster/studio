// Panneau droit : Inspecteur, Contrôles, Historique, MCP, Console, Scopes
import { h, btn, iconBtn, section, openModal } from './dom.js';
import { icon } from './icons.js';
import { Inspector } from './inspector.js';

import { toast } from './toasts.js';

const TABS = [['inspector', 'Inspecteur'], ['controls', 'Contrôles'], ['history', 'Historique'], ['mcp', 'MCP'], ['console', 'Console'], ['scopes', 'Scopes']];

export class RightPanel {
  constructor(app, root) {
    this.app = app;
    this.bus = app.bus;
    this.root = root;
    this.tab = 'inspector';
    this.tabsEl = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Panneaux' });
    this.bodies = {};
    for (const [id, label] of TABS) {
      this.tabsEl.append(h('button', { class: 'tab', role: 'tab', 'aria-selected': String(id === this.tab), dataset: { tab: id }, onclick: () => this.show(id) }, label));
      this.bodies[id] = h('div', { class: 'tab-body', role: 'tabpanel', style: { display: id === this.tab ? 'block' : 'none' } });
    }
    root.append(this.tabsEl, ...Object.values(this.bodies));
    this.inspector = new Inspector(app, this.bodies.inspector);
    this.bus.on('change', () => { if (this.tab === 'history') this.renderHistory(); if (this.tab === 'controls') this.renderControls(); });
    this.bus.on('log', (e) => this.appendLog(e));
    this.bus.app.subscribe((s, p) => { if (s.mcp !== p.mcp && this.tab === 'mcp') this.renderMcp(); });
    app.mcp.onLog = () => { if (this.tab === 'mcp') this.renderMcpLog(); };
    this.consoleFilter = '';
    this.renderConsole();
  }

  show(id) {
    this.tab = id;
    for (const b of this.tabsEl.children) b.setAttribute('aria-selected', String(b.dataset.tab === id));
    for (const [k, el] of Object.entries(this.bodies)) el.style.display = k === id ? 'block' : 'none';
    if (id === 'history') this.renderHistory();
    if (id === 'mcp') this.renderMcp();
    if (id === 'controls') this.renderControls();
    if (id === 'scopes') this.renderScopes();
  }

  renderHistory() {
    const el = this.bodies.history;
    el.innerHTML = '';
    const { undo, redo } = this.bus.history.list();
    el.append(h('div', { class: 'lib-search' }, btn('Annuler', () => this.bus.run('history.undo'), { iconName: 'undo', cmd: 'history.undo' }), btn('Rétablir', () => this.bus.run('history.redo'), { iconName: 'redo', cmd: 'history.redo' }), btn('Vider', () => this.bus.run('history.clear'), { iconName: 'trash', cmd: 'history.clear' })));
    const list = h('div', { class: 'list' });
    list.append(h('div', { class: 'list-item', onclick: () => this.bus.run('history.jump', { undoCount: undo.length }), dataset: { cmd: 'history.jump' } }, h('span', { html: icon('folder'), style: { width: '14px' } }), h('span', { class: 'grow muted' }, 'État initial')));
    undo.forEach((e, i) => list.append(h('div', { class: `list-item ${i === undo.length - 1 ? 'sel' : ''}`, title: e.commands.join(', '), onclick: () => this.bus.run('history.jump', { undoCount: undo.length - 1 - i }), dataset: { cmd: 'history.jump' } }, h('span', { html: icon('check'), style: { width: '14px', color: 'var(--accent)' } }), h('span', { class: 'grow' }, e.label), h('span', { class: 'hint mono' }, new Date(e.time).toLocaleTimeString('fr-FR')))));
    redo.forEach((e, i) => list.append(h('div', { class: 'list-item', style: { opacity: 0.45 }, onclick: () => this.bus.run('history.jump', { redoCount: i + 1 }), dataset: { cmd: 'history.jump' } }, h('span', { html: icon('redo'), style: { width: '14px' } }), h('span', { class: 'grow' }, e.label))));
    el.append(list, h('div', { class: 'hint', style: { padding: '10px' } }, `Historique illimité : ${undo.length} action(s) annulable(s), ${redo.length} rétablissable(s).`));
  }

  renderControls() {
    const el = this.bodies.controls;
    el.innerHTML = '';
    const nulls = this.bus.project.get().clips.filter((c) => c.kind === 'null');
    if (!nulls.length) {
      el.append(h('div', { class: 'empty', html: `${icon('sliders')}<div>Aucun calque nul avec contrôles. Les contrôles (curseurs, couleurs, cases, angles) se lisent dans les expressions via control("Nom").</div>` }),
        h('div', { class: 'lib-search' }, btn('Créer un contrôleur', () => this.bus.run('control.add', { type: 'slider', name: 'Intensité', value: 50 }), { iconName: 'plus', cls: 'primary', cmd: 'control.add' })));
      return;
    }
    for (const n of nulls) {
      const rows = (n.props.controls || []).map((ctl) => {
        const set = (v) => this.bus.run('control.update', { clipId: n.id, controlId: ctl.id, value: v }, { coalesce: `ctlp-${ctl.id}` });
        let input;
        if (ctl.type === 'color') { input = h('input', { type: 'color', class: 'input', value: String(ctl.value).slice(0, 7), 'aria-label': ctl.name }); input.addEventListener('input', () => set(input.value)); }
        else if (ctl.type === 'checkbox') { input = h('input', { type: 'checkbox', checked: !!ctl.value, 'aria-label': ctl.name }); input.addEventListener('change', () => set(input.checked)); }
        else {
          const min = ctl.type === 'angle' ? -360 : ctl.min ?? 0, max = ctl.type === 'angle' ? 360 : ctl.max ?? 100;
          input = h('input', { type: 'range', min, max, step: (max - min) / 400, value: ctl.value, 'aria-label': ctl.name });
          const num = h('span', { class: 'mono hint', style: { width: '48px', textAlign: 'right' } }, String(ctl.value));
          input.addEventListener('input', () => { num.textContent = input.value; set(+input.value); });
          return h('div', { class: 'row' }, h('label', {}, ctl.name), input, num);
        }
        return h('div', { class: 'row' }, h('label', {}, ctl.name), h('span', { class: 'grow' }), input);
      });
      rows.push(h('div', { class: 'row' }, ...[['slider', 'Curseur'], ['color', 'Couleur'], ['checkbox', 'Case'], ['angle', 'Angle']].map(([t, l]) => btn(`+ ${l}`, () => { const nm = prompt('Nom du contrôle', l); if (nm) this.bus.run('control.add', { clipId: n.id, type: t, name: nm }); }, { cls: 'sm', cmd: 'control.add' }))));
      el.append(section(n.name, rows));
    }
  }

  renderMcp() {
    const el = this.bodies.mcp;
    el.innerHTML = '';
    const st = this.bus.app.get().mcp;
    const webOk = st.webmcp === 'actif';
    const relayOk = st.relay === 'connecté';
    el.append(section('État', [
      h('div', { class: 'row' }, h('span', { class: `chip ${webOk ? 'on' : ''}` }, h('span', { class: 'dot' }), `WebMCP : ${st.webmcp}`)),
      h('div', { class: 'row' }, h('span', { class: `chip ${relayOk ? 'on' : st.relay === 'reconnexion…' ? 'warn' : ''}` }, h('span', { class: 'dot' }), `Relais distant : ${st.relay}`)),
      h('div', { class: 'row' }, h('span', { class: 'chip on' }, h('span', { class: 'dot' }), `window.motionAPI : actif (${this.bus.registry.list().length} commandes)`)),
    ]));
    const relayBody = [
      h('div', { class: 'hint' }, 'Le relais permet à un client MCP externe (Claude Desktop, connecteur Claude.ai, Cursor…) de piloter CET onglet via le serveur MCP Netlify. Le rendu et l\'export MP4 se font dans le navigateur : l\'onglet doit rester ouvert pendant l\'export.'),
      relayOk ? btn('Fermer la session', () => this.bus.run('mcp.relay_disconnect'), { iconName: 'power', cmd: 'mcp.relay_disconnect' }) : btn('Ouvrir une session MCP', () => this.bus.run('mcp.relay_connect'), { iconName: 'robot', cls: 'primary', cmd: 'mcp.relay_connect' }),
    ];
    if (relayOk) {
      const url = st.mcpUrl;
      relayBody.push(
        h('div', { class: 'field' }, h('span', {}, 'URL du serveur MCP (Streamable HTTP)'), h('div', { class: 'row' }, h('input', { class: 'input mono grow', readonly: true, value: url, 'aria-label': 'URL MCP' }), iconBtn('copy', 'Copier', () => { navigator.clipboard.writeText(url); toast('URL copiée.'); }, { class: 'sm' }))),
        h('div', { class: 'field' }, h('span', {}, 'Code d\'appairage (outil session_attach)'), h('div', { class: 'mono', style: { fontSize: '22px', color: 'var(--accent)', letterSpacing: '0.2em' } }, st.pairCode || '—')),
        h('div', { class: 'hint' }, `Session ${st.sessionId} — expire ${st.expiresAt ? new Date(st.expiresAt).toLocaleString('fr-FR') : ''}.`),
      );
    }
    el.append(section('Relais MCP distant (Netlify)', relayBody));
    // outils
    const q = h('input', { class: 'input', placeholder: 'Filtrer les outils…', 'aria-label': 'Filtrer les outils MCP' });
    const list = h('div', { class: 'list' });
    const draw = () => {
      list.innerHTML = '';
      for (const c of this.bus.registry.list({ query: q.value })) {
        list.append(h('div', { class: 'list-item' }, h('span', { class: 'grow' }, h('span', { class: 'mono' }, c.tool), h('div', { class: 'hint' }, c.description.fr)), c.env === 'browser' ? h('span', { class: 'badge' }, 'onglet') : h('span', { class: 'badge accent' }, 'partout'), btn('Tester', () => this.testTool(c), { cls: 'sm' })));
      }
    };
    q.addEventListener('input', draw);
    el.append(section(`Outils exposés (${this.bus.registry.list().length})`, [q, list], { collapsed: true }));
    draw();
    this.mcpLogEl = h('div', { class: 'list' });
    el.append(section('Journal des appels', this.mcpLogEl));
    this.renderMcpLog();
  }

  renderMcpLog() {
    if (!this.mcpLogEl) return;
    const all = [...(this.app.mcp.webmcpLog || []).map((x) => ({ ...x, via: 'WebMCP' })), ...(this.app.relay?.log || []).map((x) => ({ ...x, via: 'Relais' })), ...(this.app.mcp.apiLog || []).map((x) => ({ ...x, via: 'Test' }))].sort((a, b) => b.time - a.time).slice(0, 60);
    this.mcpLogEl.innerHTML = '';
    if (!all.length) this.mcpLogEl.append(h('div', { class: 'empty' }, 'Aucun appel MCP pour le moment.'));
    for (const l of all) this.mcpLogEl.append(h('div', { class: 'console-line', title: l.args ? JSON.stringify(l.args) : '' }, h('span', { class: 'time' }, new Date(l.time).toLocaleTimeString('fr-FR')), `[${l.via}] ${l.tool} ${l.ok ? '✓' : `✗ ${l.error}`} (${l.ms} ms)`));
  }

  testTool(c) {
    const props = c.inputSchema?.properties || {};
    const example = {};
    for (const [k, v] of Object.entries(props)) if ((c.inputSchema.required || []).includes(k)) example[k] = v.type === 'number' || v.type === 'integer' ? 0 : v.type === 'boolean' ? true : v.enum ? v.enum[0] : v.type === 'array' ? [] : v.type === 'object' ? {} : '';
    const sel = this.bus.app.get().selection[0];
    if (sel && 'clipId' in props) example.clipId = sel;
    if (sel && 'id' in props && !example.id) example.id = sel;
    const ta = h('textarea', { class: 'input', rows: 8, value: JSON.stringify(example, null, 2), 'aria-label': 'Arguments JSON' });
    const out = h('pre', { class: 'mono', style: { whiteSpace: 'pre-wrap', maxHeight: '260px', overflow: 'auto' } });
    const img = h('div');
    const m = openModal({ title: `Tester ${c.tool}`, iconName: 'robot', wide: true, body: [h('div', { class: 'hint' }, c.description.fr), h('pre', { class: 'mono hint', style: { whiteSpace: 'pre-wrap', maxHeight: '160px', overflow: 'auto' } }, JSON.stringify(c.inputSchema, null, 1)), ta, img, out], footer: [btn('Fermer', () => m.close()), btn('Exécuter', async () => {
      let args;
      try { args = JSON.parse(ta.value || '{}'); } catch (e) { out.textContent = `JSON invalide : ${e.message}`; return; }
      const t0 = Date.now();
      const r = await this.bus.run(c.name, args);
      (this.app.mcp.apiLog ||= []).push({ time: t0, tool: c.tool, args, ok: r.ok, error: r.error, ms: Date.now() - t0 });
      img.innerHTML = '';
      if (r.ok && r.result?.dataUrl) img.append(h('img', { src: r.result.dataUrl, alt: 'Résultat', style: { maxWidth: '100%', borderRadius: '6px' } }));
      const show = r.ok && r.result?.dataUrl ? { ...r, result: { ...r.result, dataUrl: `${r.result.dataUrl.slice(0, 60)}…` } } : r;
      out.textContent = JSON.stringify(show, null, 2).slice(0, 20000);
    }, { cls: 'primary' })] });
  }

  appendLog(e) {
    this.logs ||= [];
    this.logs.push(e);
    if (this.logs.length > 1000) this.logs.shift();
    if (this.consoleList) {
      this.consoleList.prepend(this.logLine(e));
      while (this.consoleList.children.length > 400) this.consoleList.lastChild.remove();
    }
    if (e.level === 'error') this.app.ui?.flagConsole?.();
  }

  logLine(e) { return h('div', { class: `console-line ${e.level}` }, h('span', { class: 'time' }, new Date(e.time).toLocaleTimeString('fr-FR')), e.msg); }

  renderConsole() {
    const el = this.bodies.console;
    el.innerHTML = '';
    this.consoleList = h('div');
    el.append(h('div', { class: 'lib-search' }, btn('Vider', () => { this.logs = []; this.bus.log.length = 0; this.consoleList.innerHTML = ''; }, { iconName: 'trash' }), btn('Copier', () => navigator.clipboard.writeText((this.bus.log || []).map((l) => `[${l.level}] ${l.msg}`).join('\n')), { iconName: 'copy' }), btn('Exécuter un script…', () => this.app.ui.scriptDialog(), { iconName: 'terminal', cmd: 'app.run_script' })), this.consoleList);
    for (const e of [...this.bus.log].reverse()) this.consoleList.append(this.logLine(e));
  }

  renderScopes() {
    const el = this.bodies.scopes;
    el.innerHTML = '';
    const mk = (title) => { const c = h('canvas', { width: 512, height: 280, 'aria-label': title }); el.append(section(title, h('div', { class: 'scopes' }, c))); return c; };
    this.scopeCanvases = { histogram: mk('Histogramme'), waveform: mk('Forme d\'onde (luma)'), vectorscope: mk('Vectorscope') };
    el.append(h('div', { class: 'hint', style: { padding: '10px' } }, 'Les scopes analysent l\'image du viewport à chaque rendu.'));
    this.app.scopes.sampleNow();
  }
}

// Analyse d'image : histogramme, forme d'onde, vectorscope (échantillonnage du canvas de preview)
export class Scopes {
  constructor(app) { this.app = app; this.small = document.createElement('canvas'); this.small.width = 192; this.small.height = 108; this.data = null; }
  sample(canvas) {
    const panel = this.app.right;
    const v = this.app.bus.app.get().viewport.view;
    const wantOverlay = ['histogram', 'waveform', 'vectorscope'].includes(v);
    if (!wantOverlay && !(panel?.tab === 'scopes')) return;
    const ctx = this.small.getContext('2d', { willReadFrequently: true });
    ctx.clearRect(0, 0, 192, 108);
    ctx.drawImage(canvas, 0, 0, 192, 108);
    this.data = ctx.getImageData(0, 0, 192, 108).data;
    if (panel?.tab === 'scopes' && panel.scopeCanvases) for (const [k, c] of Object.entries(panel.scopeCanvases)) { const cx = c.getContext('2d'); cx.fillStyle = '#000'; cx.fillRect(0, 0, c.width, c.height); this.draw(cx, k, 0, 0, c.width, c.height); }
  }
  sampleNow() { this.app.viewport?.requestRender(); }
  drawInto(ctx, kind, x, y, w, hgt) { if (!this.data) return; ctx.save(); ctx.fillStyle = '#000000CC'; ctx.fillRect(x, y, w, hgt); this.draw(ctx, kind, x, y, w, hgt); ctx.restore(); }
  draw(ctx, kind, x, y, w, hgt) {
    const d = this.data;
    if (!d) return;
    if (kind === 'histogram') {
      const bins = [new Float32Array(256), new Float32Array(256), new Float32Array(256)];
      for (let i = 0; i < d.length; i += 4) { bins[0][d[i]]++; bins[1][d[i + 1]]++; bins[2][d[i + 2]]++; }
      const max = Math.max(...bins.map((b) => Math.max(...b.slice(2, 254)))) || 1;
      ctx.globalCompositeOperation = 'lighter';
      ['#ff4040', '#40ff70', '#4080ff'].forEach((col, ch) => { ctx.fillStyle = `${col}aa`; for (let i = 0; i < 256; i++) { const bh = Math.min(1, bins[ch][i] / max) * hgt; ctx.fillRect(x + (i / 256) * w, y + hgt - bh, w / 256 + 0.5, bh); } });
      ctx.globalCompositeOperation = 'source-over';
    } else if (kind === 'waveform') {
      ctx.fillStyle = '#24D26D30';
      for (let px = 0; px < 192; px++) for (let py = 0; py < 108; py += 1) { const i = (py * 192 + px) * 4; const l = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255; ctx.fillRect(x + (px / 192) * w, y + hgt - l * hgt, w / 192 + 0.5, 1.5); }
      ctx.strokeStyle = '#ffffff22'; for (const g of [0.25, 0.5, 0.75]) { ctx.beginPath(); ctx.moveTo(x, y + hgt * g); ctx.lineTo(x + w, y + hgt * g); ctx.stroke(); }
    } else {
      const cx = x + w / 2, cy = y + hgt / 2, R = Math.min(w, hgt) / 2 - 6;
      ctx.strokeStyle = '#ffffff30'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#24D26D50';
      for (let i = 0; i < d.length; i += 8) { const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255; const yv = 0.2126 * r + 0.7152 * g + 0.0722 * b; const u = (b - yv) * 0.5389, v = (r - yv) * 0.635; ctx.fillRect(cx + u * R * 2, cy - v * R * 2, 1.5, 1.5); }
    }
  }
}
