// CommandBus : point d'entrée UNIQUE de toutes les modifications (UI, raccourcis, palette, motionAPI, WebMCP, relais MCP).
import { Store, Emitter } from './store.js';
import { History } from './history.js';
import { validate } from './schema.js';
import { deepClone, diff } from './util.js';

export class CommandError extends Error {}

export function defaultAppState() {
  return {
    time: 0,
    playing: false,
    loop: true,
    rate: 1,
    selection: [],          // ids de clips sélectionnés
    selectedKeyframes: [],  // [{clipId, path, index}]
    selectedEffect: null,
    timelineZoom: 80,       // px par seconde
    timelineScroll: 0,
    snap: { enabled: true, playhead: true, clips: true, markers: true, grid: false, bounds: true },
    tool: 'select',
    quality: 'auto',
    viewport: { zoom: 'fit', panX: 0, panY: 0, guides: true, safeZones: false, safeZoneType: 'title-action', rulers: true, grid: false, checker: true, clean: false, view: 'color', compare: null, isolate: null },
    clipboard: null,
    effectClipboard: null,
    lang: 'fr',
    accent: '#24D26D',
    graphEditor: false,
    graphProperty: null,
    exportJob: null,
    lastExport: null,
    shortcuts: {},
    mcp: { webmcp: 'indisponible', relay: 'déconnecté', sessionId: null },
  };
}

export class CommandBus extends Emitter {
  constructor({ registry, project, app, services = {}, env = 'browser' }) {
    super();
    this.registry = registry;
    this.project = new Store(project);
    this.app = new Store({ ...defaultAppState(), ...(app || {}) });
    this.history = new History();
    this.services = services;
    this.env = env;
    this._queue = Promise.resolve();
    this.log = [];
  }

  // Exécution sérialisée (une commande à la fois)
  run(name, args = {}, opts = {}) {
    const p = this._queue.then(() => this._execute([{ name, args }], opts, false));
    this._queue = p.catch(() => {});
    return p;
  }

  batch(list, opts = {}) {
    const p = this._queue.then(() => this._execute(list, { label: opts.label || `Lot (${list.length})`, ...opts }, true));
    this._queue = p.catch(() => {});
    return p;
  }

  _makeCtx(tx) {
    const bus = this;
    const ctx = {
      get project() { return tx.draft; },
      set project(v) { tx.draft = v; },
      get app() { return tx.app; },
      setApp(partial) { tx.app = { ...tx.app, ...partial }; tx.appDirty = true; },
      services: this.services,
      env: this.env,
      bus,
      emit: (ev, data) => tx.events.push([ev, data]),
      log: (level, msg) => tx.events.push(['log', { level, msg }]),
      findClip(id, list = tx.draft.clips) {
        for (const c of list) {
          if (c.id === id) return c;
          if (c.kind === 'group' && Array.isArray(c.props?.clips)) {
            const inner = ctx.findClip(id, c.props.clips);
            if (inner) return inner;
          }
        }
        if (list === tx.draft.clips) throw new CommandError(`Clip introuvable : ${id}`);
        return null;
      },
      findTrack(id) {
        const t = tx.draft.tracks.find((x) => x.id === id);
        if (!t) throw new CommandError(`Piste introuvable : ${id}`);
        return t;
      },
      // appel imbriqué : partage la même transaction (pas de file d'attente → pas d'interblocage)
      async call(name, args = {}) {
        const def = bus.registry.get(name);
        if (!def) throw new CommandError(`Commande inconnue : ${name}`);
        bus._check(def, args);
        tx.names.push(def.name);
        return def.run(ctx, args);
      },
    };
    return ctx;
  }

  _check(def, args) {
    const errs = validate(def.args, args, 'args');
    if (errs.length) throw new CommandError(`Arguments invalides pour ${def.name} : ${errs.slice(0, 5).join(' ; ')}`);
    if (def.env === 'browser' && this.env !== 'browser') throw new CommandError(`${def.name} nécessite une session navigateur (onglet Motion Studio ouvert).`);
  }

  async _execute(list, opts, isBatch) {
    const before = this.project.get();
    const tx = { draft: deepClone(before), app: this.app.get(), appDirty: false, events: [], names: [] };
    const ctx = this._makeCtx(tx);
    const results = [];
    let current = null;
    try {
      for (let i = 0; i < list.length; i++) {
        current = list[i];
        const def = this.registry.get(current.name);
        if (!def) throw new CommandError(`Commande inconnue : ${current.name}`);
        const args = current.args || {};
        this._check(def, args);
        tx.names.push(def.name);
        const r = await def.run(ctx, args);
        results.push(r === undefined ? null : r);
        if (def.history === false) opts = { history: false, ...opts };
      }
    } catch (err) {
      const message = err?.message || String(err);
      const res = { ok: false, error: message, command: current?.name, index: isBatch ? results.length : undefined };
      this._log('error', `${current?.name} : ${message}`);
      this.emit('error', res);
      return res;
    }

    const patches = diff(before, tx.draft);
    if (patches.length) {
      const inverse = diff(tx.draft, before);
      if (opts.history !== false) {
        const def0 = this.registry.get(list[0].name);
        this.history.push({ name: isBatch ? 'batch' : list[0].name, label: opts.label || def0?.title?.fr || list[0].name, patches, inverse }, { coalesce: opts.coalesce });
      }
      this.project.set(tx.draft, { commands: tx.names });
    }
    if (tx.appDirty) this.app.set(tx.app, { commands: tx.names });
    for (const [ev, data] of tx.events) {
      if (ev === 'log') this._log(data.level, data.msg); else this.emit(ev, data);
    }
    const result = isBatch ? results : results[0];
    this.emit('command', { names: tx.names, args: isBatch ? list : list[0].args, result, changed: patches.length > 0 });
    if (patches.length) this.emit('change', { names: tx.names });
    return { ok: true, result };
  }

  // Undo/redo appelés par les commandes history.*
  undo() {
    const r = this.history.undo(this.project.get());
    if (!r) return null;
    this.project.set(r.state, { undo: true });
    this.emit('change', { names: ['history.undo'] });
    return r.entry.label;
  }
  redo() {
    const r = this.history.redo(this.project.get());
    if (!r) return null;
    this.project.set(r.state, { redo: true });
    this.emit('change', { names: ['history.redo'] });
    return r.entry.label;
  }

  replaceProject(project, { keepHistory = false } = {}) {
    if (!keepHistory) this.history.clear();
    this.project.set(project, { replaced: true });
    this.emit('change', { names: ['project.replace'] });
  }

  _log(level, msg) {
    const entry = { level, msg, time: Date.now() };
    this.log.push(entry);
    if (this.log.length > 2000) this.log.shift();
    this.emit('log', entry);
  }
}
