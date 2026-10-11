// Point d'entrée : assemble le CommandBus, les services navigateur, le rendu, l'interface et les adaptateurs MCP.
import { registry } from './core/commands/index.js';
import { CommandBus } from './core/commandBus.js';
import { createProject } from './core/schema.js';
import { setLang } from './core/i18n.js';
import { MediaManager } from './render/media.js';
import { AudioAnalysis } from './audio/analyzer.js';
import { Exporter } from './export/exporter.js';
import { createServices, assetTypeFor } from './app/services.js';
import { Playback } from './app/playback.js';
import { projectsStore } from './storage/projects.js';
import { readZip } from './export/zip.js';
import { putBlob } from './storage/opfs.js';
import { Shell } from './ui/shell.js';
import { Library } from './ui/library.js';
import { Viewport } from './ui/viewport.js';
import { RightPanel, Scopes } from './ui/panels.js';
import { Timeline } from './timeline/timelineUI.js';
import { installShortcuts } from './ui/actions.js';
import { toast } from './ui/toasts.js';
import { downloadBlob, h, openModal } from './ui/dom.js';
import { installMotionAPI } from './mcp/motionAPI.js';
import { installWebMCP } from './mcp/webmcp.js';
import { RemoteRelay } from './mcp/remoteRelay.js';
import { TEMPLATES } from './templates/templates.generated.js';
import { uid } from './core/util.js';

function fatal(msg) {
  document.body.innerHTML = '';
  document.body.append(h('div', { style: { padding: '48px', maxWidth: '640px', margin: 'auto', fontFamily: 'Inter, sans-serif', color: '#EDEDED' } }, h('h1', { style: { color: '#24D26D' } }, 'Motion Studio'), h('p', {}, msg), h('p', { style: { color: '#8A8A8A' } }, 'Navigateurs recommandés : Chrome ou Edge récents (Safari et Firefox récents pris en charge avec dégradation).')));
}

async function boot() {
  const test = document.createElement('canvas').getContext('webgl2');
  if (!test) { fatal('WebGL2 est indisponible dans ce navigateur : le moteur de rendu ne peut pas démarrer.'); return; }

  const app = { mcp: { webmcpStatus: 'indisponible' }, fontsVersion: 0, toast };
  const bus = new CommandBus({ registry, project: createProject(), env: 'browser' });
  app.bus = bus;
  app.log = (level, msg) => bus._log(level, msg);
  app.download = (blob, name) => downloadBlob(blob, name);

  app.media = new MediaManager({
    log: app.log,
    onChange: (id) => { app.renderer?.invalidateMedia(id); app.viewport?.requestRender(); clearTimeout(app._mt); app._mt = setTimeout(() => app.timeline?.renderTracks(), 150); },
  });
  app.analysis = new AudioAnalysis(app.media);
  const exportListeners = new Set();
  app.onExport = (cb) => { exportListeners.add(cb); return () => exportListeners.delete(cb); };
  app.exporter = new Exporter({
    media: app.media, audio: app.analysis, log: app.log, download: app.download,
    emit: (ev, data) => { for (const cb of exportListeners) cb(data); app.onEvent?.(ev === 'export-done' ? 'export-done' : 'progress', data); if (ev === 'export-done' && data.status === 'done') toast(`Export terminé : ${data.filename}`); },
  });
  bus.services = createServices(app);
  app.services = bus.services;
  app.relay = new RemoteRelay(app);
  bus.services.mcp = { connect: () => app.relay.connect(), disconnect: () => app.relay.disconnect() };

  // ---------------------------------------------------------------- interface
  const shell = new Shell(app);
  app.ui = shell;
  shell.buildTopbar(document.getElementById('topbar'));
  app.library = new Library(app, document.getElementById('left'));
  app.viewport = new Viewport(app, document.getElementById('center'));
  app.right = new RightPanel(app, document.getElementById('right'));
  app.timeline = new Timeline(app, document.getElementById('timeline'));
  shell.buildTransport(document.getElementById('transport'));
  shell.bindSplitters();
  app.scopes = new Scopes(app);
  app.afterRender = (canvas) => app.scopes.sample(canvas);
  app.playback = new Playback(app);
  app.markSaved = () => shell.markSaved();

  // ---------------------------------------------------------------- actions / glisser-déposer / import
  app.runAction = (a) => {
    const s = bus.app.get();
    const sel = s.selection;
    if (a.id === 'shuttle-stop' && !s.playing && sel.length) return addPositionKeys(sel[0]);
    if (a.id === 'keyframe') return sel.length ? addPositionKeys(sel[0]) : toast('Sélectionnez un clip.', 'warn');
    if (a.id === 'easy-ease') {
      const ks = s.selectedKeyframes;
      if (!ks.length) { toast('Sélectionnez des keyframes (losanges de la timeline).', 'warn'); return null; }
      return bus.batch(ks.map((k) => ({ name: 'keyframe.set_easing', args: { clipId: k.clipId, path: k.path, indices: [k.index], easing: 'smooth' } })), { label: 'Easing doux' });
    }
    if (a.id === 'delete' && !sel.length && s.selectedKeyframes.length) {
      const ks = s.selectedKeyframes;
      return bus.batch(ks.sort((x, y) => y.index - x.index).map((k) => ({ name: 'keyframe.remove', args: { clipId: k.clipId, path: k.path, index: k.index } })), { label: 'Supprimer keyframes' });
    }
    if (a.id === 'deselect' && app.viewport.pen) { app.viewport.finishPen(false); return null; }
    const args = a.argsFn ? a.argsFn(app) : { ...(a.args || {}) };
    return bus.run(a.command, args).then((r) => { if (!r.ok && !['history.undo', 'history.redo'].includes(a.command)) toast(r.error, 'warn'); return r; });
  };
  const addPositionKeys = (id) => bus.batch([{ name: 'keyframe.add', args: { clipId: id, path: 'transform.x' } }, { name: 'keyframe.add', args: { clipId: id, path: 'transform.y' } }], { label: 'Keyframe de position' });

  app.registerFile = (file) => { const tok = uid('file'); bus.services.files.set(tok, file); return tok; };
  app.importFiles = async (files, { at, trackId, addToTimeline = true } = {}) => {
    let t = at ?? bus.app.get().time;
    for (const f of files) {
      if (/\.motion\.(json|zip)$/i.test(f.name) || (/\.zip$/i.test(f.name))) { await app.importProjectFile(f); continue; }
      if (!assetTypeFor(f.name, f.type)) { toast(`Format non pris en charge : ${f.name}`, 'warn'); continue; }
      const r = await bus.run('asset.import_file', { token: app.registerFile(f) });
      if (!r.ok) { toast(`${f.name} : ${r.error}`, 'error'); continue; }
      if (addToTimeline) {
        const c = await app.applyDrop({ type: 'asset', id: r.result.id }, { t, trackId });
        if (c?.ok) t += c.result.duration;
      }
    }
  };
  app.applyDrop = async (payload, { t, trackId, clipId }) => {
    switch (payload.type) {
      case 'element': return bus.run('clip.add', { library: payload.id, start: t, trackId: trackId && trackCompatible(trackId, payload) ? trackId : undefined });
      case 'effect': return clipId ? bus.run('effect.add', { clipId, type: payload.id }) : bus.run('clip.add', { kind: 'adjustment', start: t, effects: [{ type: payload.id }], name: `Ajustement (${payload.id})` });
      case 'effectPreset': return clipId ? bus.run('effect.apply_preset', { clipIds: [clipId], presetId: payload.id }) : toast('Déposez un preset d\'effets sur un clip.', 'warn');
      case 'transition': {
        if (!clipId) { toast('Déposez la transition sur un clip.', 'warn'); return null; }
        const c = bus.project.get().clips.find((x) => x.id === clipId);
        return bus.run('transition.add', { clipId, type: payload.id, edge: t - c.start > c.duration / 2 ? 'out' : 'in' });
      }
      case 'animPreset': return clipId ? bus.run('animation.apply_preset', { clipId, preset: payload.id }) : toast('Déposez l\'animation sur un clip.', 'warn');
      case 'template': return bus.run('template.apply', { id: payload.id });
      case 'asset': {
        const a = bus.project.get().assets.find((x) => x.id === payload.id);
        if (!a) return null;
        if (['image', 'video', 'audio', 'svg', 'lottie'].includes(a.type)) return bus.run('clip.add', { kind: a.type, props: { assetId: a.id }, start: t, name: a.name, trackId: trackId && trackCompatible(trackId, { kind: a.type }) ? trackId : undefined });
        if (a.type === 'csv' || a.type === 'json') return bus.run('clip.add', { kind: 'chart', props: { data: a.data }, start: t, name: a.name });
        if (a.type === 'lut') return clipId ? bus.run('effect.add', { clipId, type: 'lut3d', params: { lut: a.id } }) : bus.run('clip.add', { kind: 'adjustment', start: t, effects: [{ type: 'lut3d', params: { lut: a.id } }], name: `LUT ${a.name}` });
        if (a.type === 'font') { toast(`Police "${a.meta?.family || a.name}" disponible dans l'inspecteur des textes.`); return null; }
        return null;
      }
      default: return null;
    }
  };
  const trackCompatible = (trackId, payload) => {
    const tr = bus.project.get().tracks.find((x) => x.id === trackId);
    if (!tr) return false;
    const kind = payload.kind || (payload.id?.startsWith('text') ? 'text' : null);
    if (tr.type === 'audio') return kind === 'audio';
    return kind !== 'audio';
  };
  app.importProjectFile = async (file) => {
    try {
      if (/\.zip$/i.test(file.name)) {
        const entries = await readZip(file);
        const json = JSON.parse(new TextDecoder().decode(entries['project.motion.json']));
        for (const a of json.assets) if (a.zipPath && entries[a.zipPath]) { await putBlob(a.id, new Blob([entries[a.zipPath]], { type: a.mime })); a.ref = `idb://${a.id}`; delete a.zipPath; }
        const r = await bus.run('project.import_json', { project: json });
        if (!r.ok) toast(r.error, 'error'); else toast(`Projet « ${json.meta.name} » importé.`);
      } else {
        const r = await bus.run('project.import_json', { project: await file.text() });
        if (!r.ok) toast(r.error, 'error'); else toast('Projet importé.');
      }
    } catch (e) { toast(`Import impossible : ${e.message}`, 'error'); }
  };
  app.showResult = (name, r) => {
    if (!r.ok) { toast(r.error, 'error'); return; }
    const res = r.result;
    if (res && typeof res === 'object' && res.dataUrl) { openModal({ title: name, wide: true, body: h('img', { src: res.dataUrl, alt: name, style: { maxWidth: '100%' } }) }); return; }
    if (res === null || res === undefined || (typeof res === 'object' && Object.keys(res).length < 4 && !Array.isArray(res))) { toast(`${name} : ${JSON.stringify(res ?? 'ok').slice(0, 200)}`); return; }
    openModal({ title: name, wide: true, body: h('pre', { class: 'mono', style: { whiteSpace: 'pre-wrap', maxHeight: '70vh', overflow: 'auto' } }, JSON.stringify(res, null, 2).slice(0, 100000)) });
  };

  installShortcuts(app);
  // coller une image depuis le presse-papiers
  window.addEventListener('paste', (e) => {
    if (/INPUT|TEXTAREA/.test(document.activeElement?.tagName || '')) return;
    const files = [...(e.clipboardData?.files || [])];
    if (files.length) { e.preventDefault(); app.importFiles(files); }
  });
  // déposer des fichiers sur le viewport
  const vp = document.getElementById('viewport');
  vp.addEventListener('dragover', (e) => e.preventDefault());
  vp.addEventListener('drop', async (e) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length) { app.importFiles([...e.dataTransfer.files]); return; }
    let payload = app.dragPayload;
    try { payload = JSON.parse(e.dataTransfer.getData('application/x-motion') || 'null') || payload; } catch { /* */ }
    app.dragPayload = null;
    if (!payload) return;
    const r = await app.applyDrop(payload, { t: bus.app.get().time, clipId: payload.type !== 'element' && payload.type !== 'asset' ? bus.app.get().selection[0] : undefined });
    // placement à l'endroit du dépôt
    if (r?.ok && r.result?.id && (payload.type === 'element' || payload.type === 'asset')) {
      const rect = vp.getBoundingClientRect();
      const [cx, cy] = app.viewport.screenToComp(e.clientX - rect.left, e.clientY - rect.top);
      const m = bus.project.get().meta;
      if (cx >= 0 && cy >= 0 && cx <= m.width && cy <= m.height) bus.run('clip.set_transform', { id: r.result.id, x: Math.round(cx - m.width / 2), y: Math.round(cy - m.height / 2) });
    }
  });

  // ---------------------------------------------------------------- erreurs & thème
  bus.on('error', (e) => { if (!app.silentErrors) toast(e.error, 'error'); });
  window.addEventListener('error', (e) => app.log('error', `Erreur JS : ${e.message}`));
  window.addEventListener('unhandledrejection', (e) => app.log('error', `Promesse rejetée : ${e.reason?.message || e.reason}`));
  const applyTheme = (s) => {
    document.documentElement.style.setProperty('--accent', s.accent);
    document.documentElement.style.setProperty('--accent-halo', `${s.accent}33`);
    setLang(s.lang);
  };
  bus.app.subscribe((s, p) => { if (s.accent !== p.accent || s.lang !== p.lang) applyTheme(s); });
  document.fonts?.ready.then(() => { app.fontsVersion++; app.viewport.requestRender(); });
  document.fonts?.addEventListener?.('loadingdone', () => { app.fontsVersion++; app.viewport.requestRender(); });

  // ---------------------------------------------------------------- persistance (IndexedDB) : autosave 5 s + beforeunload
  let dirty = false;
  bus.on('change', () => { dirty = true; shell.markDirty(); });
  const save = async () => { if (!dirty) return; dirty = false; try { await bus.services.storage.save(bus.project.get()); } catch (e) { dirty = true; app.log('warn', `Autosauvegarde : ${e.message}`); } };
  setInterval(save, 5000);
  window.addEventListener('beforeunload', () => {
    if (!dirty) return;
    try { const json = JSON.stringify(bus.project.get()); if (json.length < 4e6) localStorage.setItem('motion-backup', json); } catch { /* quota */ }
    save();
  });
  // préférences d'interface mémorisées
  const prefs = await projectsStore.getSetting('ui-prefs');
  if (prefs) bus.app.patch({ ...prefs });
  bus.app.subscribe((s, p) => { if (s.shortcuts !== p.shortcuts || s.accent !== p.accent || s.lang !== p.lang || s.snap !== p.snap) projectsStore.setSetting('ui-prefs', { shortcuts: s.shortcuts, accent: s.accent, lang: s.lang, snap: s.snap }); });
  applyTheme(bus.app.get());

  // ---------------------------------------------------------------- chargement initial
  const params = new URLSearchParams(location.search);
  let loaded = false;
  if (params.get('share')) {
    const r = await bus.run('project.load_shared', { id: params.get('share') });
    if (r.ok) { loaded = true; toast(`Projet partagé « ${r.result.name} » chargé.`); history.replaceState(null, '', location.pathname); } else toast(r.error, 'error');
  }
  if (!loaded) {
    try {
      const lastId = await projectsStore.lastId();
      let backup = null;
      try { backup = JSON.parse(localStorage.getItem('motion-backup') || 'null'); } catch { /* */ }
      if (backup) {
        const stored = backup.id ? await projectsStore.load(backup.id) : null;
        localStorage.removeItem('motion-backup');
        if (!stored || JSON.stringify(stored) !== JSON.stringify(backup)) { const r = await bus.run('project.import_json', { project: backup }); loaded = r.ok; }
      }
      if (!loaded && lastId) { const r = await bus.run('project.open', { id: lastId }); loaded = r.ok; }
    } catch (e) { app.log('warn', `Stockage local indisponible : ${e.message}`); }
  }
  if (!loaded) {
    const demo = TEMPLATES.find((t) => t.id === 'intro-youtube') || TEMPLATES[0];
    if (demo) await bus.run('template.apply', { id: demo.id, name: 'Mon premier projet' });
  }
  bus.history.clear();
  dirty = false;
  shell.markSaved();
  await app.media.sync(bus.project.get());
  app.viewport.requestRender();
  app.timeline.renderTracks();
  app.timeline.body.scrollLeft = 0;

  // ---------------------------------------------------------------- MCP
  installMotionAPI(app);
  installWebMCP(app);
  const caps = await app.exporter.capabilities();
  app.log('info', `Motion Studio prêt — ${registry.list().length} commandes · rendu WebGL2${app.renderer.float ? ' (FBO flottants)' : ''} · export : ${caps.mp4Path}`);
  if (!caps.webcodecs) toast('WebCodecs indisponible : l\'export MP4 utilisera MediaRecorder (temps réel) ou ffmpeg.wasm.', 'warn', 8000);
  if (params.get('mcp') === '1') bus.run('mcp.relay_connect');
  window.__motionReady = true;
}

boot().catch((e) => { console.error(e); fatal(`Erreur au démarrage : ${e.message}`); });
