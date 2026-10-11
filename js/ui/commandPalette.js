// Palette de commandes (Ctrl/Cmd+K) : toutes les actions UI + TOUTES les commandes du registre (vitrine de la couche MCP)
import { h, openModal } from './dom.js';
import { UI_ACTIONS, keysFor } from './actions.js';

export function openPalette(app) {
  const bus = app.bus;
  const overrides = bus.app.get().shortcuts || {};
  const items = [
    ...UI_ACTIONS.map((a) => ({ kind: 'action', title: a.label, name: a.command, keys: keysFor(a, overrides), run: () => app.runAction(a) })),
    ...bus.registry.list().map((c) => ({ kind: 'command', title: c.title.fr, desc: c.description.fr, name: c.name, env: c.env, schema: c.inputSchema, run: () => runWithArgs(app, c) })),
  ];
  const input = h('input', { class: 'input', placeholder: `Rechercher parmi ${items.length} actions et commandes…`, 'aria-label': 'Rechercher une commande', autofocus: true });
  const list = h('div', { class: 'palette-list', role: 'listbox' });
  let sel = 0, shown = [];
  const draw = () => {
    const q = input.value.toLowerCase().trim();
    const words = q.split(/\s+/).filter(Boolean);
    shown = items.filter((it) => words.every((w) => `${it.title} ${it.name} ${it.desc || ''}`.toLowerCase().includes(w))).slice(0, 120);
    sel = Math.min(sel, Math.max(0, shown.length - 1));
    list.innerHTML = '';
    shown.forEach((it, i) => {
      const el = h('div', { class: `palette-item ${i === sel ? 'sel' : ''}`, role: 'option', 'aria-selected': String(i === sel), onclick: () => { m.close(); it.run(); }, onmousemove: () => { if (sel !== i) { sel = i; mark(); } } },
        h('span', { class: `badge ${it.kind === 'action' ? 'accent' : ''}` }, it.kind === 'action' ? 'action' : it.env === 'browser' ? 'cmd·onglet' : 'cmd'),
        h('span', { class: 'title' }, it.title), h('span', { class: 'name' }, it.name), it.keys ? h('kbd', {}, it.keys) : null);
      list.append(el);
    });
  };
  const mark = () => [...list.children].forEach((c, i) => { c.classList.toggle('sel', i === sel); c.setAttribute('aria-selected', String(i === sel)); if (i === sel) c.scrollIntoView({ block: 'nearest' }); });
  input.addEventListener('input', () => { sel = 0; draw(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(shown.length - 1, sel + 1); mark(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); mark(); }
    if (e.key === 'Enter' && shown[sel]) { e.preventDefault(); m.close(); shown[sel].run(); }
  });
  const m = openModal({ title: null, body: [input, list], className: 'palette' });
  draw();
}

// Commandes nécessitant des arguments : formulaire JSON pré-rempli
export function runWithArgs(app, c) {
  const req = c.inputSchema?.required || [];
  const props = c.inputSchema?.properties || {};
  if (!req.length) { app.bus.run(c.name, {}).then((r) => app.showResult(c.name, r)); return; }
  const example = {};
  const selId = app.bus.app.get().selection[0];
  for (const k of req) {
    const v = props[k] || {};
    if ((k === 'clipId' || k === 'id') && selId) example[k] = selId;
    else example[k] = v.enum ? v.enum[0] : v.type === 'number' || v.type === 'integer' ? 0 : v.type === 'boolean' ? true : v.type === 'array' ? [] : v.type === 'object' ? {} : '';
  }
  const ta = h('textarea', { class: 'input', rows: 8, value: JSON.stringify(example, null, 2), 'aria-label': 'Arguments' });
  const err = h('div', { class: 'err' });
  const m = openModal({
    title: c.title.fr, iconName: 'command',
    body: [h('div', { class: 'hint' }, c.description.fr), h('details', {}, h('summary', { class: 'hint' }, 'Schéma des arguments'), h('pre', { class: 'mono hint', style: { whiteSpace: 'pre-wrap' } }, JSON.stringify(c.inputSchema, null, 1))), ta, err],
    footer: [h('button', { class: 'btn', onclick: () => m.close() }, 'Annuler'), h('button', { class: 'btn primary', onclick: async () => { let a; try { a = JSON.parse(ta.value); } catch (e) { err.textContent = e.message; return; } const r = await app.bus.run(c.name, a); if (r.ok) { m.close(); app.showResult(c.name, r); } else err.textContent = r.error; } }, 'Exécuter')],
  });
}
