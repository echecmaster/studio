// Transitions, timeline, marqueurs, lecture, magnétisme, viewport, outils
import { cmd, args, S, selectedOr } from './helpers.js';
import { CommandError } from '../commandBus.js';
import { TRANSITIONS, TRANSITION_MAP, TRANSITION_GROUPS, defaultTransitionParams } from '../../catalog/transitions.js';
import { uid, snapToFrame } from '../util.js';

const clampTime = (ctx, t) => Math.max(0, Math.min(ctx.project.meta.duration, t));

export default [
  // ---------------- Transitions ----------------
  cmd('transition.catalog', 'Catalogue des transitions (≥60) avec paramètres', 'Transitions catalog', args({ group: S.enm('Groupe', Object.keys(TRANSITION_GROUPS)), query: S.str('Recherche') }), (ctx, a) => {
    const q = (a.query || '').toLowerCase();
    const list = TRANSITIONS.filter((t) => (!a.group || t.group === a.group) && (!q || t.id.toLowerCase().includes(q) || t.name.toLowerCase().includes(q)));
    return { count: list.length, groups: TRANSITION_GROUPS, transitions: list.map((t) => ({ type: t.id, name: t.name, en: t.en, group: t.group, params: t.params })) };
  }),

  cmd('transition.add', 'Ajouter une transition sur le bord d\'entrée/sortie d\'un clip, ou entre deux clips (chevauchement)', 'Add transition', args({
    clipId: S.str('Clip'), edge: S.enm('Bord', ['in', 'out', 'both']), type: S.str('Type (voir transition.catalog)'), duration: S.num('Durée (s)', { exclusiveMinimum: 0 }), easing: S.str('Easing'), params: S.obj('Paramètres'),
    betweenClipId: S.str('Second clip : crée une transition A(sortie) → B(entrée)'), overlap: S.bool('Faire chevaucher les clips de la durée de la transition (défaut : oui si betweenClipId)'),
  }, ['type']), (ctx, a) => {
    if (!TRANSITION_MAP[a.type]) throw new CommandError(`Transition inconnue : ${a.type}. Voir transition.catalog.`);
    const c = ctx.findClip(a.clipId || selectedOr(ctx)[0]);
    const tr = (dur) => ({ type: a.type, duration: Math.min(dur, a.duration ?? 0.6), easing: a.easing || 'easeInOutCubic', params: { ...defaultTransitionParams(a.type), ...(a.params || {}) } });
    if (a.betweenClipId) {
      const b = ctx.findClip(a.betweenClipId);
      const [A, B] = c.start <= b.start ? [c, b] : [b, c];
      const d = Math.min(a.duration ?? 0.6, A.duration * 0.9, B.duration * 0.9);
      if (a.overlap !== false) {
        const aEnd = A.start + A.duration;
        if (B.start > aEnd - d) {
          const shift = B.start - (aEnd - d);
          for (const o of ctx.project.clips) if (o.trackId === B.trackId && o.start >= B.start - 1e-6) o.start = Math.max(0, o.start - shift);
        }
        // B doit être au-dessus de A pour un fondu enchaîné : déplacé sur une piste supérieure si même piste
      }
      // B (au-dessus) se révèle sur A ; pour un push, A sort aussi dans le même sens
      B.transitionIn = tr(d);
      if (a.type.startsWith('push-')) {
        const opp = { left: 'right', right: 'left', up: 'down', down: 'up' }[a.type.slice(5)];
        A.transitionOut = { ...tr(d), type: `slide-${opp}`, params: {} };
      }
      return { from: A.id, to: B.id, duration: d };
    }
    const edge = a.edge || 'in';
    if (edge === 'in' || edge === 'both') c.transitionIn = tr(c.duration / (edge === 'both' ? 2 : 1));
    if (edge === 'out' || edge === 'both') c.transitionOut = tr(c.duration / (edge === 'both' ? 2 : 1));
    return { clipId: c.id, in: c.transitionIn, out: c.transitionOut };
  }, { mutates: true }),

  cmd('transition.update', 'Modifier une transition (durée, easing, paramètres, type)', 'Update transition', args({ clipId: S.str('Clip'), edge: S.enm('Bord', ['in', 'out']), type: S.str('Type'), duration: S.num('Durée'), easing: S.str('Easing'), params: S.obj('Paramètres') }, ['clipId', 'edge']), (ctx, a) => {
    const c = ctx.findClip(a.clipId);
    const key = a.edge === 'in' ? 'transitionIn' : 'transitionOut';
    if (!c[key]) throw new CommandError('Aucune transition sur ce bord.');
    if (a.type) { if (!TRANSITION_MAP[a.type]) throw new CommandError(`Transition inconnue : ${a.type}`); c[key].type = a.type; c[key].params = { ...defaultTransitionParams(a.type), ...(a.params || {}) }; }
    if (a.duration !== undefined) c[key].duration = Math.max(0.01, Math.min(c.duration, a.duration));
    if (a.easing) c[key].easing = a.easing;
    if (a.params && !a.type) c[key].params = { ...c[key].params, ...a.params };
    return c[key];
  }, { mutates: true }),

  cmd('transition.remove', 'Retirer une transition', 'Remove transition', args({ clipId: S.str('Clip'), edge: S.enm('Bord', ['in', 'out', 'both']) }, ['clipId']), (ctx, a) => {
    const c = ctx.findClip(a.clipId);
    if (a.edge !== 'out') c.transitionIn = null;
    if (a.edge !== 'in') c.transitionOut = null;
    return { clipId: c.id };
  }, { mutates: true }),

  // ---------------- Timeline ----------------
  cmd('timeline.set_zoom', 'Zoom horizontal de la timeline (pixels par seconde)', 'Timeline zoom', args({ pxPerSecond: S.num('Pixels par seconde', { minimum: 2, maximum: 2000 }), factor: S.num('Facteur multiplicatif') }), (ctx, a) => {
    const z = Math.max(2, Math.min(2000, a.pxPerSecond ?? ctx.app.timelineZoom * (a.factor || 1)));
    ctx.setApp({ timelineZoom: z });
    return { zoom: z };
  }, { history: false, shortcut: '+ / -' }),

  cmd('timeline.fit', 'Ajuster la timeline à la largeur disponible', 'Fit timeline', args({ width: S.num('Largeur disponible (px)') }), (ctx, a) => {
    const w = a.width || ctx.services.ui?.timelineWidth?.() || 1000;
    ctx.setApp({ timelineZoom: Math.max(2, (w - 40) / ctx.project.meta.duration), timelineScroll: 0 });
    return { zoom: ctx.app.timelineZoom };
  }, { history: false, shortcut: '\\' }),

  cmd('timeline.scroll', 'Faire défiler la timeline', 'Scroll timeline', args({ seconds: S.num('Position de début visible (s)') }, ['seconds']), (ctx, a) => { ctx.setApp({ timelineScroll: Math.max(0, a.seconds) }); return { scroll: a.seconds }; }, { history: false }),

  cmd('timeline.set_work_area', 'Zone de travail (in/out) pour la lecture en boucle et l\'export partiel', 'Set work area', args({ in: S.num('Début (s)', { minimum: 0 }), out: S.num('Fin (s)', { minimum: 0 }), reset: S.bool('Réinitialiser à toute la durée') }), (ctx, a) => {
    const wa = ctx.project.workArea;
    if (a.reset) { wa.in = 0; wa.out = ctx.project.meta.duration; return wa; }
    if (a.in !== undefined) wa.in = clampTime(ctx, a.in);
    if (a.out !== undefined) wa.out = clampTime(ctx, a.out);
    if (wa.out < wa.in) [wa.in, wa.out] = [wa.out, wa.in];
    return { ...wa };
  }, { mutates: true, shortcut: 'I / O' }),

  cmd('marker.add', 'Ajouter un marqueur (nom, couleur)', 'Add marker', args({ t: S.num('Instant (s, défaut : tête de lecture)', { minimum: 0 }), label: S.str('Nom'), color: S.str('Couleur') }), (ctx, a) => {
    const m = { id: uid('mk'), t: clampTime(ctx, a.t ?? ctx.app.time), label: a.label || `M${ctx.project.markers.length + 1}`, color: a.color || '#24D26D' };
    ctx.project.markers.push(m);
    ctx.project.markers.sort((x, y) => x.t - y.t);
    return m;
  }, { mutates: true, shortcut: 'M' }),

  cmd('marker.update', 'Modifier un marqueur', 'Update marker', args({ id: S.str('Marqueur'), t: S.num('Instant'), label: S.str('Nom'), color: S.str('Couleur') }, ['id']), (ctx, a) => {
    const m = ctx.project.markers.find((x) => x.id === a.id);
    if (!m) throw new CommandError('Marqueur introuvable');
    if (a.t !== undefined) m.t = clampTime(ctx, a.t);
    if (a.label !== undefined) m.label = a.label;
    if (a.color !== undefined) m.color = a.color;
    ctx.project.markers.sort((x, y) => x.t - y.t);
    return m;
  }, { mutates: true }),

  cmd('marker.remove', 'Supprimer un ou tous les marqueurs', 'Remove marker', args({ id: S.str('Marqueur'), all: S.bool('Tous') }), (ctx, a) => {
    if (a.all) { const n = ctx.project.markers.length; ctx.project.markers = []; return { removed: n }; }
    const before = ctx.project.markers.length;
    ctx.project.markers = ctx.project.markers.filter((m) => m.id !== a.id);
    if (before === ctx.project.markers.length) throw new CommandError('Marqueur introuvable');
    return { removed: a.id };
  }, { mutates: true }),

  cmd('marker.list', 'Lister les marqueurs', 'List markers', args({}), (ctx) => ctx.project.markers),

  cmd('marker.goto', 'Aller au marqueur suivant / précédent', 'Go to marker', args({ direction: S.enm('Direction', ['next', 'prev']), id: S.str('Ou identifiant') }), (ctx, a) => {
    const ms = ctx.project.markers;
    let m;
    if (a.id) m = ms.find((x) => x.id === a.id);
    else if (a.direction === 'prev') m = [...ms].reverse().find((x) => x.t < ctx.app.time - 1e-3);
    else m = ms.find((x) => x.t > ctx.app.time + 1e-3);
    if (!m) throw new CommandError('Aucun marqueur dans cette direction.');
    ctx.setApp({ time: m.t });
    return m;
  }, { history: false }),

  // ---------------- Lecture ----------------
  cmd('playback.play', 'Lecture', 'Play', args({}), (ctx) => { ctx.setApp({ playing: true }); return { playing: true, time: ctx.app.time }; }, { history: false }),
  cmd('playback.pause', 'Pause', 'Pause', args({}), (ctx) => { ctx.setApp({ playing: false }); return { playing: false, time: ctx.app.time }; }, { history: false }),
  cmd('playback.toggle', 'Lecture / pause', 'Toggle playback', args({}), (ctx) => { ctx.setApp({ playing: !ctx.app.playing }); return { playing: ctx.app.playing }; }, { history: false, shortcut: 'Space' }),
  cmd('playback.seek', 'Positionner la tête de lecture (secondes, image, timecode ou décalage)', 'Seek', args({ t: S.num('Instant (s)'), frame: S.int('Numéro d\'image'), timecode: S.str('Timecode hh:mm:ss:ff'), delta: S.num('Décalage (s)'), deltaFrames: S.int('Décalage en images'), to: S.enm('Position spéciale', ['start', 'end', 'in', 'out']) }), (ctx, a) => {
    const fps = ctx.project.meta.fps;
    let t = ctx.app.time;
    if (a.t !== undefined) t = a.t;
    if (a.frame !== undefined) t = a.frame / fps;
    if (a.timecode) { const p = a.timecode.split(':').map(Number); while (p.length < 4) p.unshift(0); t = p[0] * 3600 + p[1] * 60 + p[2] + p[3] / fps; }
    if (a.delta) t += a.delta;
    if (a.deltaFrames) t += a.deltaFrames / fps;
    if (a.to === 'start') t = 0;
    if (a.to === 'end') t = ctx.project.meta.duration - 1 / fps;
    if (a.to === 'in') t = ctx.project.workArea.in;
    if (a.to === 'out') t = ctx.project.workArea.out - 1 / fps;
    t = snapToFrame(clampTime(ctx, t), fps);
    ctx.setApp({ time: Math.min(t, ctx.project.meta.duration - 1 / fps) });
    return { time: ctx.app.time, frame: Math.round(ctx.app.time * fps) };
  }, { history: false }),
  cmd('playback.shuttle', 'Lecture J/K/L : reculer, pause, avancer (vitesses cumulatives)', 'JKL shuttle', args({ direction: S.enm('Direction', ['back', 'stop', 'forward']) }, ['direction']), (ctx, a) => {
    if (a.direction === 'stop') { ctx.setApp({ playing: false, rate: 1 }); return { rate: 0 }; }
    const sign = a.direction === 'back' ? -1 : 1;
    const cur = ctx.app.playing ? ctx.app.rate : 0;
    const rate = Math.sign(cur) === sign ? Math.max(-8, Math.min(8, cur * 2)) : sign;
    ctx.setApp({ playing: true, rate });
    return { rate };
  }, { history: false, shortcut: 'J / K / L' }),
  cmd('playback.set_loop', 'Boucle de lecture (sur la zone de travail)', 'Set loop', args({ loop: S.bool('Boucle') }), (ctx, a) => { ctx.setApp({ loop: a.loop ?? !ctx.app.loop }); return { loop: ctx.app.loop }; }, { history: false }),
  cmd('playback.set_rate', 'Vitesse de lecture', 'Playback rate', args({ rate: S.num('Vitesse (-8..8)', { minimum: -8, maximum: 8 }) }, ['rate']), (ctx, a) => { ctx.setApp({ rate: a.rate || 1 }); return { rate: ctx.app.rate }; }, { history: false }),
  cmd('playback.get_state', 'État de la lecture', 'Playback state', args({}), (ctx) => ({ time: ctx.app.time, frame: Math.round(ctx.app.time * ctx.project.meta.fps), playing: ctx.app.playing, loop: ctx.app.loop, rate: ctx.app.rate, duration: ctx.project.meta.duration, workArea: ctx.project.workArea })),

  cmd('snap.set', 'Magnétisme : activer et choisir les cibles (tête de lecture, clips, marqueurs, grille, bornes)', 'Snapping', args({ enabled: S.bool('Activé'), playhead: S.bool('Tête de lecture'), clips: S.bool('Bords de clips'), markers: S.bool('Marqueurs'), grid: S.bool('Grille'), bounds: S.bool('Début / fin') }), (ctx, a) => {
    const snap = { ...ctx.app.snap };
    for (const k of Object.keys(snap)) if (a[k] !== undefined) snap[k] = a[k];
    ctx.setApp({ snap });
    return snap;
  }, { history: false }),

  // ---------------- Viewport / outils ----------------
  cmd('view.set', 'Options du viewport : zoom, guides, zones de sécurité, grille, règles, damier, mode propre, vue alpha, qualité, comparaison, isolation', 'Viewport options', args({
    zoom: { description: '"fit" ou facteur (1 = 100 %)' }, guides: S.bool('Guides'), safeZones: S.bool('Zones de sécurité'), safeZoneType: S.enm('Type de zone', ['title-action', '16:9', '9:16', '1:1', '4:5']), grid: S.bool('Grille'), rulers: S.bool('Règles'), checker: S.bool('Damier de transparence'), clean: S.bool('Aperçu propre (sans gizmos)'),
    view: S.enm('Vue', ['color', 'alpha', 'histogram', 'waveform', 'vectorscope']), graphEditor: S.bool('Afficher l\'éditeur de courbes de la timeline'), graphProperty: { description: 'Propriété affichée dans l\'éditeur de courbes : {clipId, path, mode: "value"|"speed"}' }, quality: S.enm('Qualité de preview', ['auto', 'full', 'half', 'quarter']), compare: { description: 'Comparaison avant/après : {clipId, effectId?, split} ou null' }, isolate: { type: ['string', 'null'], description: 'Isoler un clip' }, panX: S.num('Pan X'), panY: S.num('Pan Y'),
  }), (ctx, a) => {
    const v = { ...ctx.app.viewport };
    for (const k of ['zoom', 'guides', 'safeZones', 'safeZoneType', 'grid', 'rulers', 'checker', 'clean', 'view', 'compare', 'isolate', 'panX', 'panY']) if (a[k] !== undefined) v[k] = a[k];
    const patch = { viewport: v };
    if (a.quality) patch.quality = a.quality;
    if (a.graphEditor !== undefined) patch.graphEditor = a.graphEditor;
    if (a.graphProperty !== undefined) patch.graphProperty = a.graphProperty;
    ctx.setApp(patch);
    return { viewport: v, quality: ctx.app.quality };
  }, { history: false }),

  cmd('view.fit', 'Ajuster le viewport à l\'écran', 'Fit viewport', args({ zoom: S.num('Facteur (1 = 100 %, absent = ajuster)') }), (ctx, a) => { ctx.setApp({ viewport: { ...ctx.app.viewport, zoom: a.zoom ?? 'fit', panX: 0, panY: 0 } }); return { zoom: a.zoom ?? 'fit' }; }, { history: false }),
  cmd('view.fullscreen', 'Plein écran du viewport', 'Viewport fullscreen', args({ enabled: S.bool('Activer') }), async (ctx, a) => { await ctx.services.ui.fullscreen(a.enabled); return { fullscreen: a.enabled ?? true }; }, { history: false, env: 'browser' }),
  cmd('tool.set', 'Outil actif : sélection (V), texte (T), rectangle (R), ellipse (E), plume (P), main (H)', 'Set tool', args({ tool: S.enm('Outil', ['select', 'text', 'rect', 'ellipse', 'pen', 'hand']) }, ['tool']), (ctx, a) => { ctx.setApp({ tool: a.tool }); return { tool: a.tool }; }, { history: false, shortcut: 'V/T/R/E/P' }),
];
