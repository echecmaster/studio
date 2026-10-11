// Adaptateur A : API JavaScript globale window.motionAPI (pour agents de navigation / exécution JS)
export function installMotionAPI(app) {
  const bus = app.bus;
  const listeners = new Map();
  const on = (ev, cb) => { if (!listeners.has(ev)) listeners.set(ev, new Set()); listeners.get(ev).add(cb); return () => listeners.get(ev)?.delete(cb); };
  const emit = (ev, data) => { for (const cb of listeners.get(ev) || []) { try { cb(data); } catch (e) { console.error(e); } } };
  bus.on('change', (d) => emit('change', d));
  bus.on('error', (d) => emit('error', d));
  bus.on('command', (d) => emit('command', d));
  app.onEvent = emit;

  const unwrap = (r) => r; // les commandes renvoient déjà {ok, result, error}

  const api = {
    version: '1.0.0',
    /** Liste de toutes les commandes avec schémas JSON */
    listCommands: async (filter = {}) => bus.registry.list(filter),
    /** Exécute une commande nommée — renvoie {ok, result, error} */
    run: async (name, args = {}) => unwrap(await bus.run(name, args)),
    /** Transaction atomique (un seul undo) */
    batch: async (list, opts) => unwrap(await bus.batch(list.map((x) => (Array.isArray(x) ? { name: x[0], args: x[1] } : x)), opts)),
    getProject: async () => JSON.parse(JSON.stringify(bus.project.get())),
    setProject: async (json) => unwrap(await bus.run('project.import_json', { project: json })),
    getState: async () => unwrap(await bus.run('app.get_state')),
    /** Image d'une frame (dataURL) à l'instant t */
    getFrame: async (t, opts = {}) => {
      const r = await bus.run('render.frame', { t, format: opts.format || 'png', width: opts.width || 960, quality: opts.quality });
      return r.ok ? r.result.dataUrl : Promise.reject(new Error(r.error));
    },
    /** Planche de plusieurs frames (une image) — ou tableau de dataURL si {separate:true} */
    getFrames: async (times, opts = {}) => {
      if (opts.separate) { const out = []; for (const t of times) out.push(await api.getFrame(t, opts)); return out; }
      const r = await bus.run('render.contact_sheet', { times, columns: opts.columns, width: opts.width || 1600, format: opts.format || 'jpeg' });
      return r.ok ? r.result.dataUrl : Promise.reject(new Error(r.error));
    },
    play: () => bus.run('playback.play'),
    pause: () => bus.run('playback.pause'),
    seek: (t) => bus.run('playback.seek', { t }),
    undo: () => bus.run('history.undo'),
    redo: () => bus.run('history.redo'),
    /** Lance l'export et attend le fichier : {ok, filename, size, blobUrl, durationSec, validation} */
    export: async (opts = {}) => {
      const s = await bus.run('export.start', { autoDownload: false, ...opts });
      if (!s.ok) return { ok: false, error: s.error };
      while (true) {
        await new Promise((r) => setTimeout(r, 250));
        const st = await bus.run('export.status');
        if (st.result.status === 'done') { const r = await bus.run('export.get_result', {}); return { ok: true, ...r.result }; }
        if (st.result.status === 'error' || st.result.status === 'cancelled') return { ok: false, error: st.result.error || st.result.status };
      }
    },
    on,
    off: (ev, cb) => listeners.get(ev)?.delete(cb),
    help: () => 'motionAPI : listCommands(), run(name,args), batch([{name,args}]), getProject(), setProject(json), getFrame(t,{format,width}), getFrames([t…]), play(), pause(), seek(t), export({format:"mp4",…}), on("progress"|"change"|"error", cb). Voir app.help / listCommands() pour les ~190 commandes.',
  };
  Object.defineProperty(window, 'motionAPI', { value: Object.freeze(api), configurable: false, writable: false });
  return api;
}
