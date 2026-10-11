// Rendu / vision, historique, export, méta-application
import { cmd, args, S } from './helpers.js';
import { CommandError } from '../commandBus.js';

const EXPORT_FORMATS = ['mp4', 'webm', 'gif', 'png-sequence', 'png', 'jpg'];

export default [
  // ---------------- Vision / contrôle qualité ----------------
  cmd('render.frame', 'Rendre l\'image à l\'instant t (PNG/JPEG base64) — pour « voir » le résultat', 'Render a frame (base64 image)', args({ t: S.num('Instant (s)', { minimum: 0 }), format: S.enm('Format', ['png', 'jpeg', 'webp']), width: S.int('Largeur de sortie (px)', { minimum: 16, maximum: 7680 }), quality: S.num('Qualité JPEG 0-1') }), (ctx, a) => ctx.services.renderer.frame(a.t ?? ctx.app.time, { format: a.format || 'jpeg', width: a.width || 960, quality: a.quality ?? 0.85 }), { env: 'browser' }),

  cmd('render.contact_sheet', 'Planche contact : N images réparties sur la durée (ou une plage) en une seule image', 'Contact sheet of N frames', args({ count: S.int('Nombre d\'images', { minimum: 1, maximum: 64 }), columns: S.int('Colonnes', { minimum: 1, maximum: 12 }), start: S.num('Début (s)'), end: S.num('Fin (s)'), width: S.int('Largeur totale (px)', { minimum: 64, maximum: 4096 }), times: S.arr('Instants explicites', { type: 'number' }), format: S.enm('Format', ['png', 'jpeg']) }), (ctx, a) => {
    const start = a.start ?? 0, end = a.end ?? ctx.project.meta.duration;
    const n = a.count || 12;
    const times = a.times || Array.from({ length: n }, (_, i) => +(start + ((end - start) * (i + 0.5)) / n).toFixed(3));
    return ctx.services.renderer.contactSheet(times, { columns: a.columns || Math.min(4, times.length), width: a.width || 1600, format: a.format || 'jpeg' });
  }, { env: 'browser' }),

  cmd('render.stats', 'Statistiques de rendu : fps, temps par image, qualité de preview, cache', 'Render stats', args({}), (ctx) => ctx.services.renderer.stats(), { env: 'browser' }),

  cmd('render.compare', 'Comparaison avant/après d\'un effet (ou de tous les effets d\'un clip) à l\'instant t : image côte à côte', 'Before/after comparison', args({ clipId: S.str('Clip'), effectId: S.str('Effet (défaut : tous)'), t: S.num('Instant'), width: S.int('Largeur (px)'), live: S.bool('Activer aussi la vue partagée dans le viewport') }, ['clipId']), (ctx, a) => {
    ctx.findClip(a.clipId);
    if (a.live) ctx.setApp({ viewport: { ...ctx.app.viewport, compare: { clipId: a.clipId, effectId: a.effectId || null, split: 0.5 } } });
    return ctx.services.renderer.compare(a.clipId, a.effectId, a.t ?? ctx.app.time, { width: a.width || 1280 });
  }, { env: 'browser' }),

  cmd('render.precache', 'Pré-calculer le rendu d\'une plage (barre de cache verte) pour une lecture fluide', 'Precache render', args({ start: S.num('Début'), end: S.num('Fin') }), (ctx, a) => ctx.services.renderer.precache(a.start ?? ctx.project.workArea.in, a.end ?? ctx.project.workArea.out), { env: 'browser' }),
  cmd('render.clear_cache', 'Vider le cache de rendu', 'Clear render cache', args({}), (ctx) => ctx.services.renderer.clearCache(), { env: 'browser' }),

  // ---------------- Historique ----------------
  cmd('history.undo', 'Annuler', 'Undo', args({}), (ctx) => {
    if (ctx.bus.history.group) throw new CommandError('Terminez le lot en cours (history.batch_end) avant d\'annuler.');
    const label = ctx.bus.undo();
    if (!label) throw new CommandError('Rien à annuler.');
    return { undone: label };
  }, { history: false, shortcut: 'Ctrl+Z' }),
  cmd('history.redo', 'Rétablir', 'Redo', args({}), (ctx) => {
    const label = ctx.bus.redo();
    if (!label) throw new CommandError('Rien à rétablir.');
    return { redone: label };
  }, { history: false, shortcut: 'Ctrl+Shift+Z' }),
  cmd('history.list', 'Historique des actions (annulables / rétablissables)', 'History list', args({}), (ctx) => ctx.bus.history.list()),
  cmd('history.jump', 'Revenir à un point de l\'historique (nombre d\'annulations/rétablissements)', 'Jump in history', args({ undoCount: S.int('Annulations à effectuer', { minimum: 0 }), redoCount: S.int('Rétablissements à effectuer', { minimum: 0 }) }), (ctx, a) => {
    let n = 0;
    for (let i = 0; i < (a.undoCount || 0); i++) if (ctx.bus.undo()) n++;
    for (let i = 0; i < (a.redoCount || 0); i++) if (ctx.bus.redo()) n++;
    return { steps: n };
  }, { history: false }),
  cmd('history.batch_begin', 'Ouvrir une transaction : les commandes suivantes forment un seul undo', 'Begin batch (single undo)', args({ label: S.str('Libellé') }), (ctx, a) => { ctx.bus.history.begin(a.label || 'Lot'); return { depth: ctx.bus.history.groupDepth }; }, { history: false }),
  cmd('history.batch_end', 'Fermer la transaction ouverte', 'End batch', args({}), (ctx) => { if (!ctx.bus.history.end()) throw new CommandError('Aucune transaction ouverte.'); return { depth: ctx.bus.history.groupDepth }; }, { history: false }),
  cmd('history.clear', 'Vider l\'historique', 'Clear history', args({}), (ctx) => { ctx.bus.history.clear(); return { cleared: true }; }, { history: false }),

  // ---------------- Export ----------------
  cmd('export.capabilities', 'Capacités d\'export du navigateur (codecs, WebCodecs, MediaRecorder, ffmpeg.wasm)', 'Export capabilities', args({}), (ctx) => ctx.services.exporter.capabilities(), { env: 'browser' }),
  cmd('export.start', 'Lancer l\'export (MP4 H.264+AAC, WebM, GIF, séquence PNG, image) — le rendu se fait dans le navigateur, l\'onglet doit rester ouvert', 'Start export (rendered in the browser tab)', args({
    format: S.enm('Format', EXPORT_FORMATS), width: S.int('Largeur', { minimum: 16, maximum: 7680 }), height: S.int('Hauteur', { minimum: 16, maximum: 7680 }), fps: S.num('FPS', { minimum: 1, maximum: 120 }),
    quality: S.enm('Qualité', ['low', 'medium', 'high', 'custom']), bitrate: S.num('Débit vidéo (Mbps, qualité custom)', { minimum: 0.1, maximum: 200 }), range: S.enm('Plage', ['all', 'workarea', 'selection', 'custom']), start: S.num('Début (plage custom)'), end: S.num('Fin (plage custom)'),
    includeAudio: S.bool('Inclure l\'audio'), filename: S.str('Nom du fichier'), hardware: S.enm('Accélération matérielle', ['prefer-hardware', 'prefer-software', 'no-preference']), motionBlur: S.bool('Flou de mouvement'), motionBlurSamples: S.int('Échantillons de flou', { minimum: 2, maximum: 16 }), stream: S.bool('Écrire en streaming sur disque (sélecteur de fichier)'), autoDownload: S.bool('Téléchargement automatique (défaut : oui)'), t: S.num('Instant (format image)'),
  }), async (ctx, a) => {
    const job = await ctx.services.exporter.start(ctx.project, { format: 'mp4', ...a }, ctx.app);
    return job;
  }, { env: 'browser', shortcut: 'Ctrl+E' }),
  cmd('export.status', 'Progression de l\'export (progression, image courante, temps restant)', 'Export status', args({}), (ctx) => ctx.services.exporter.status(), { env: 'browser' }),
  cmd('export.cancel', 'Annuler l\'export en cours', 'Cancel export', args({}), (ctx) => ctx.services.exporter.cancel(), { env: 'browser' }),
  cmd('export.get_result', 'Résultat du dernier export (nom, taille, durée, lien blob, validation MP4) — option base64', 'Get export result', args({ base64: S.bool('Inclure le fichier en base64 (≤ 25 Mo)') }), (ctx, a) => ctx.services.exporter.result({ base64: !!a.base64 }), { env: 'browser' }),
  cmd('export.download', 'Télécharger à nouveau le dernier export', 'Download last export', args({}), (ctx) => ctx.services.exporter.download(), { env: 'browser' }),
  cmd('export.download_link', 'Lien de téléchargement du dernier export (URL blob locale à l\'onglet)', 'Download link for last export', args({}), async (ctx) => { const r = await ctx.services.exporter.result({}); return { url: r.blobUrl, filename: r.filename, size: r.size }; }, { env: 'browser' }),

  // ---------------- Méta ----------------
  cmd('app.get_state', 'État de l\'application (sélection, temps, outil, viewport, statut MCP…)', 'App state', args({}), (ctx) => {
    const { clipboard, effectClipboard, keyClipboard, ...rest } = ctx.app;
    return { ...rest, project: { id: ctx.project.id, name: ctx.project.meta.name, clips: ctx.project.clips.length, tracks: ctx.project.tracks.length, assets: ctx.project.assets.length }, history: { undo: ctx.bus.history.undoStack.length, redo: ctx.bus.history.redoStack.length } };
  }),
  cmd('app.get_capabilities', 'Capacités : WebGL2, WebCodecs, codecs, OPFS, WebMCP, relais distant, environnement', 'Capabilities', args({}), (ctx) => (ctx.services.capabilities ? ctx.services.capabilities() : { env: ctx.env, rendering: false, export: false, note: 'Environnement serveur : construction de projets JSON uniquement. Rendu et export dans l\'onglet navigateur.' })),
  cmd('app.set_theme_accent', 'Couleur d\'accent de l\'interface (défaut #24D26D)', 'Set accent color', args({ color: S.str('Couleur hex') }, ['color']), (ctx, a) => {
    if (!/^#[0-9a-f]{6}$/i.test(a.color)) throw new CommandError('Couleur hex #RRGGBB attendue.');
    ctx.setApp({ accent: a.color });
    return { accent: a.color };
  }, { history: false }),
  cmd('app.set_lang', 'Langue de l\'interface (fr / en)', 'Set UI language', args({ lang: S.enm('Langue', ['fr', 'en']) }, ['lang']), (ctx, a) => { ctx.setApp({ lang: a.lang }); return { lang: a.lang }; }, { history: false }),
  cmd('app.help', 'Documentation des commandes (toutes ou une seule)', 'Commands help', args({ command: S.str('Nom de commande'), category: S.str('Catégorie') }), (ctx, a) => {
    if (a.command) { const d = ctx.bus.registry.get(a.command); if (!d) throw new CommandError(`Commande inconnue : ${a.command}`); return { name: d.name, title: d.title, description: d.description, args: d.args, env: d.env, shortcut: d.shortcut || null }; }
    return ctx.bus.registry.list({ category: a.category }).map((c) => ({ name: c.name, description: c.description.fr, env: c.env }));
  }),
  cmd('app.run_script', 'Exécuter un script de commandes enchaînées dans un sandbox (JSON [{name,args}] ou JS avec run(name,args))', 'Run a command script in a sandbox', args({ script: S.any('Tableau [{name,args}] ou code JS (sandbox Worker, fonction run)'), atomic: S.bool('Un seul undo pour tout le script (défaut : oui)') }, ['script']), async (ctx, a) => {
    let steps = a.script;
    if (typeof steps === 'string') {
      const trimmed = steps.trim();
      if (trimmed.startsWith('[')) steps = JSON.parse(trimmed);
      else {
        if (!ctx.services.script) throw new CommandError('Les scripts JS nécessitent le navigateur ; envoyez un tableau JSON [{name,args}].');
        steps = await ctx.services.script.collect(trimmed); // exécute le JS dans un Worker sandbox et collecte les appels run()
      }
    }
    if (!Array.isArray(steps)) throw new CommandError('Script invalide.');
    if (steps.length > 500) throw new CommandError('Script trop long (max 500 commandes).');
    const results = [];
    for (const s of steps) {
      if (s.name === 'app.run_script') throw new CommandError('Récursion de scripts interdite.');
      results.push(await ctx.call(s.name, s.args || {}));
    }
    return { count: results.length, results };
  }, { mutates: true }),
  cmd('app.open_panel', 'Ouvrir un panneau ou une fenêtre de l\'interface (export, palette, raccourcis, MCP, console, historique, assets, projets, paramètres, parité, aide)', 'Open UI panel', args({ panel: S.enm('Panneau', ['export', 'palette', 'shortcuts', 'mcp', 'console', 'history', 'assets', 'projects', 'settings', 'parity', 'help', 'templates', 'shader', 'share', 'controls', 'scopes', 'inspector', 'library']) }, ['panel']), (ctx, a) => { ctx.services.ui.openPanel(a.panel); return { opened: a.panel }; }, { history: false, env: 'browser' }),
  cmd('app.toggle_panel', 'Replier / déplier un panneau (bibliothèque, inspecteur, timeline)', 'Toggle panel', args({ panel: S.enm('Panneau', ['left', 'right', 'timeline']) }, ['panel']), (ctx, a) => { ctx.services.ui.togglePanel(a.panel); return { toggled: a.panel }; }, { history: false, env: 'browser' }),
  cmd('app.set_shortcut', 'Personnaliser un raccourci clavier', 'Set shortcut', args({ command: S.str('Commande ou action'), keys: S.str('Touches (ex. Ctrl+Shift+K), vide = défaut') }, ['command', 'keys']), (ctx, a) => {
    const sc = { ...ctx.app.shortcuts };
    if (a.keys) sc[a.command] = a.keys; else delete sc[a.command];
    ctx.setApp({ shortcuts: sc });
    return sc;
  }, { history: false }),
  cmd('app.reset_shortcuts', 'Réinitialiser les raccourcis', 'Reset shortcuts', args({}), (ctx) => { ctx.setApp({ shortcuts: {} }); return { reset: true }; }, { history: false }),
  cmd('app.log', 'Lire le journal (console) de l\'application', 'Read app log', args({ level: S.enm('Niveau', ['info', 'warn', 'error']), limit: S.int('Nombre', { minimum: 1, maximum: 500 }) }), (ctx, a) => ctx.bus.log.filter((l) => !a.level || l.level === a.level).slice(-(a.limit || 100))),
];
