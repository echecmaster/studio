import { cmd, args, S, requireUnlocked, selectedOr, makeClip, pickTrack } from './helpers.js';
import { CommandError } from '../commandBus.js';
import { getPath, uid, deepClone } from '../util.js';
import { evalKeys, resolveClip, makeLayerLookup, makeControlLookup } from '../evaluate.js';
import { checkExpression } from '../expressions.js';
import { EASING_NAMES } from '../../catalog/easings.js';
import { ANIM_PRESET_MAP, applyAnimationPreset, listAnimationPresets } from '../../catalog/animPresets.js';
import { TEXT_ANIMATORS } from '../../catalog/elements.js';
import { shapeToPoints } from '../path.js';

const easingSchema = S.str(`Easing : ${EASING_NAMES.slice(0, 8).join(', ')}… | spring | cubic-bezier(x1,y1,x2,y2) | hold`);

function keysOf(clip, path, create = false) {
  if (!clip.keyframes[path]) {
    if (!create) throw new CommandError(`Aucune keyframe sur ${path}`);
    clip.keyframes[path] = [];
  }
  return clip.keyframes[path];
}

function checkEasing(e) {
  if (!e) return;
  if (e === 'spring' || e === 'hold' || EASING_NAMES.includes(e) || /^cubic-bezier\(/.test(e)) return;
  throw new CommandError(`Easing inconnu : ${e}`);
}

function currentValue(ctx, clip, path, localT) {
  const r = resolveClip(clip, clip.start + localT, { comp: ctx.project.meta, layer: makeLayerLookup(ctx.project, clip.start + localT), control: makeControlLookup(ctx.project, clip.start + localT) });
  return getPath(r, path);
}

function cameraClip(ctx, create = true) {
  let cam = ctx.project.clips.find((c) => c.kind === 'camera');
  if (!cam && create) {
    cam = makeClip(ctx.project, { kind: 'camera', start: 0, duration: ctx.project.meta.duration, name: 'Caméra' });
    cam.trackId = pickTrack(ctx.project, 'camera', 0, cam.duration).id;
    ctx.project.clips.push(cam);
  }
  return cam;
}

export default [
  cmd('keyframe.add', 'Ajouter une keyframe sur une propriété (valeur courante par défaut)', 'Add keyframe', args({ clipId: S.str('Clip'), path: S.str('Chemin (ex. transform.x, props.color, effects.<id>.params.amount)'), t: S.num('Instant local au clip (s) — défaut : tête de lecture'), value: S.any('Valeur'), easing: easingSchema, hold: S.bool('Maintien (pas d\'interpolation)'), spring: S.obj('Ressort {stiffness, damping, mass}') }, ['path']), (ctx, a) => {
    const c = ctx.findClip(a.clipId || selectedOr(ctx)[0]);
    requireUnlocked(ctx, c);
    checkEasing(a.easing);
    const t = Math.max(0, Math.min(c.duration, a.t ?? (ctx.app.time - c.start)));
    const v = a.value !== undefined ? a.value : currentValue(ctx, c, a.path, t);
    if (v === undefined) throw new CommandError(`Propriété introuvable : ${a.path}`);
    const keys = keysOf(c, a.path, true);
    const tol = 0.5 / ctx.project.meta.fps;
    const existing = keys.find((k) => Math.abs(k.t - t) < tol);
    const k = { t: +t.toFixed(5), v: deepClone(v), easing: a.easing || existing?.easing || 'easeInOutCubic' };
    if (a.hold) k.hold = true;
    if (a.spring) k.spring = a.spring;
    if (existing) Object.assign(existing, k); else keys.push(k);
    keys.sort((x, y) => x.t - y.t);
    return { clipId: c.id, path: a.path, index: keys.indexOf(existing || k), t: k.t, value: k.v };
  }, { mutates: true, shortcut: 'K' }),

  cmd('keyframe.update', 'Modifier une keyframe (temps, valeur, easing, maintien)', 'Update keyframe', args({ clipId: S.str('Clip'), path: S.str('Chemin'), index: S.int('Index', { minimum: 0 }), t: S.num('Nouvel instant local'), value: S.any('Valeur'), easing: easingSchema, hold: S.bool('Maintien'), bezier: S.arr('Bézier [x1,y1,x2,y2]', { type: 'number' }), spring: S.obj('Ressort') }, ['clipId', 'path', 'index']), (ctx, a) => {
    const c = ctx.findClip(a.clipId);
    const keys = keysOf(c, a.path);
    const k = keys[a.index];
    if (!k) throw new CommandError('Index de keyframe invalide');
    checkEasing(a.easing);
    if (a.t !== undefined) k.t = Math.max(0, Math.min(c.duration, a.t));
    if (a.value !== undefined) k.v = a.value;
    if (a.easing !== undefined) { k.easing = a.easing; if (a.easing !== 'hold') delete k.hold; delete k.bezier; }
    if (a.hold !== undefined) k.hold = a.hold;
    if (a.bezier) k.bezier = a.bezier;
    if (a.spring) k.spring = a.spring;
    keys.sort((x, y) => x.t - y.t);
    return { index: keys.indexOf(k), key: k };
  }, { mutates: true }),

  cmd('keyframe.remove', 'Supprimer des keyframes (par index, ou toutes sur le chemin)', 'Remove keyframes', args({ clipId: S.str('Clip'), path: S.str('Chemin'), index: S.int('Index'), indices: S.arr('Indices', { type: 'integer' }), all: S.bool('Toutes (la valeur courante devient statique)') }, ['clipId', 'path']), (ctx, a) => {
    const c = ctx.findClip(a.clipId);
    const keys = keysOf(c, a.path);
    if (a.all) {
      const v = evalKeys(keys, Math.max(0, ctx.app.time - c.start));
      delete c.keyframes[a.path];
      try { const segs = a.path.split('.'); let o = c; for (let i = 0; i < segs.length - 1; i++) o = Array.isArray(o) ? o.find((x) => x.id === segs[i]) || o[+segs[i]] : o[segs[i]]; o[segs[segs.length - 1]] = v; } catch { /* */ }
      return { removed: 'all' };
    }
    const idx = new Set(a.indices || [a.index]);
    c.keyframes[a.path] = keys.filter((_, i) => !idx.has(i));
    if (!c.keyframes[a.path].length) delete c.keyframes[a.path];
    ctx.setApp({ selectedKeyframes: [] });
    return { removed: [...idx] };
  }, { mutates: true }),

  cmd('keyframe.move', 'Déplacer des keyframes dans le temps', 'Move keyframes', args({ clipId: S.str('Clip'), path: S.str('Chemin'), indices: S.arr('Indices', { type: 'integer' }), delta: S.num('Décalage (s)'), t: S.num('Nouvel instant (1 seule keyframe)') }, ['clipId', 'path', 'indices']), (ctx, a) => {
    const c = ctx.findClip(a.clipId);
    const keys = keysOf(c, a.path);
    const moved = a.indices.map((i) => keys[i]).filter(Boolean);
    for (const k of moved) k.t = Math.max(0, Math.min(c.duration, a.t !== undefined && moved.length === 1 ? a.t : k.t + (a.delta || 0)));
    keys.sort((x, y) => x.t - y.t);
    // dédoublonnage des instants identiques
    c.keyframes[a.path] = keys.filter((k, i) => i === 0 || Math.abs(k.t - keys[i - 1].t) > 1e-5 || moved.includes(k));
    return { indices: moved.map((k) => c.keyframes[a.path].indexOf(k)) };
  }, { mutates: true }),

  cmd('keyframe.set_easing', 'Changer l\'interpolation de keyframes (linéaire, Bézier, maintien, ressort, Penner…)', 'Set keyframe easing', args({ clipId: S.str('Clip'), path: S.str('Chemin'), indices: S.arr('Indices (défaut : toutes)', { type: 'integer' }), easing: easingSchema, spring: S.obj('Ressort {stiffness, damping, mass}') }, ['clipId', 'path', 'easing']), (ctx, a) => {
    const c = ctx.findClip(a.clipId);
    checkEasing(a.easing);
    const keys = keysOf(c, a.path);
    const list = a.indices ? a.indices.map((i) => keys[i]).filter(Boolean) : keys;
    for (const k of list) { k.easing = a.easing; delete k.bezier; k.hold = a.easing === 'hold'; if (a.spring) k.spring = a.spring; }
    return { count: list.length };
  }, { mutates: true, shortcut: 'F9' }),

  cmd('keyframe.set_bezier', 'Définir une courbe de Bézier personnalisée [x1,y1,x2,y2] sur des keyframes', 'Set keyframe bezier', args({ clipId: S.str('Clip'), path: S.str('Chemin'), indices: S.arr('Indices', { type: 'integer' }), index: S.int('Index'), bezier: S.arr('[x1,y1,x2,y2]', { type: 'number' }, { minItems: 4, maxItems: 4 }) }, ['clipId', 'path', 'bezier']), (ctx, a) => {
    const c = ctx.findClip(a.clipId);
    const keys = keysOf(c, a.path);
    const list = (a.indices || [a.index ?? 0]).map((i) => keys[i]).filter(Boolean);
    for (const k of list) { k.bezier = a.bezier; k.easing = `cubic-bezier(${a.bezier.join(',')})`; k.hold = false; }
    return { count: list.length, bezier: a.bezier };
  }, { mutates: true }),

  cmd('keyframe.list', 'Lister les keyframes d\'un clip', 'List keyframes', args({ clipId: S.str('Clip'), path: S.str('Chemin (optionnel)') }, ['clipId']), (ctx, a) => {
    const c = ctx.findClip(a.clipId);
    return Object.fromEntries(Object.entries(c.keyframes).filter(([p]) => !a.path || p === a.path).map(([p, k]) => [p, k]));
  }),

  cmd('keyframe.select', 'Sélectionner des keyframes (graph editor / timeline)', 'Select keyframes', args({ items: S.arr('[{clipId, path, index}]', { type: 'object' }), mode: S.enm('Mode', ['set', 'add', 'toggle', 'clear']) }), (ctx, a) => {
    let sel = a.mode === 'clear' ? [] : a.mode === 'set' || !a.mode ? [] : [...ctx.app.selectedKeyframes];
    for (const it of a.items || []) {
      const key = (x) => `${x.clipId}|${x.path}|${x.index}`;
      const exists = sel.find((x) => key(x) === key(it));
      if (a.mode === 'toggle' && exists) sel = sel.filter((x) => x !== exists); else if (!exists) sel.push(it);
    }
    ctx.setApp({ selectedKeyframes: sel });
    return { selected: sel.length };
  }, { history: false }),

  cmd('keyframe.copy', 'Copier des keyframes', 'Copy keyframes', args({ clipId: S.str('Clip'), path: S.str('Chemin'), indices: S.arr('Indices', { type: 'integer' }) }, ['clipId', 'path']), (ctx, a) => {
    const keys = keysOf(ctx.findClip(a.clipId), a.path);
    const list = (a.indices || keys.map((_, i) => i)).map((i) => keys[i]).filter(Boolean);
    const t0 = Math.min(...list.map((k) => k.t));
    ctx.setApp({ keyClipboard: { path: a.path, keys: list.map((k) => ({ ...k, t: k.t - t0 })) } });
    return { copied: list.length };
  }),

  cmd('keyframe.paste', 'Coller des keyframes à la tête de lecture', 'Paste keyframes', args({ clipId: S.str('Clip'), path: S.str('Chemin cible (défaut : chemin copié)'), t: S.num('Instant local (défaut : tête de lecture)') }), (ctx, a) => {
    const cb = ctx.app.keyClipboard;
    if (!cb) throw new CommandError('Aucune keyframe copiée.');
    const c = ctx.findClip(a.clipId || selectedOr(ctx)[0]);
    const path = a.path || cb.path;
    const t = a.t ?? (ctx.app.time - c.start);
    const keys = keysOf(c, path, true);
    for (const k of cb.keys) {
      const nt = Math.max(0, Math.min(c.duration, k.t + t));
      const ex = keys.find((x) => Math.abs(x.t - nt) < 1e-4);
      if (ex) Object.assign(ex, { ...k, t: nt }); else keys.push({ ...deepClone(k), t: nt });
    }
    keys.sort((x, y) => x.t - y.t);
    return { pasted: cb.keys.length, path };
  }, { mutates: true }),

  cmd('animation.list_presets', 'Lister les presets d\'animation (entrée, sortie, emphase)', 'List animation presets', args({ type: S.enm('Type', ['in', 'out', 'emphasis']) }), (ctx, a) => listAnimationPresets(a.type)),

  cmd('animation.apply_preset', 'Appliquer un preset d\'animation (entrée/sortie/emphase) avec durée et easing', 'Apply animation preset', args({ clipIds: S.ids(), clipId: S.str('Clip'), preset: S.str('Identifiant du preset (voir animation.list_presets)'), duration: S.num('Durée (s)', { exclusiveMinimum: 0 }), easing: easingSchema, at: S.num('Instant local pour une emphase (s)') }, ['preset']), (ctx, a) => {
    if (!ANIM_PRESET_MAP[a.preset]) throw new CommandError(`Preset inconnu : ${a.preset}`);
    checkEasing(a.easing);
    const ids = a.clipId ? [a.clipId] : selectedOr(ctx, a.clipIds);
    const out = [];
    for (const id of ids) {
      const c = ctx.findClip(id);
      requireUnlocked(ctx, c);
      const at = a.at ?? (ANIM_PRESET_MAP[a.preset].type === 'emphasis' && ctx.app.time >= c.start && ctx.app.time < c.start + c.duration ? ctx.app.time - c.start : undefined);
      out.push({ clipId: id, ...applyAnimationPreset(c, a.preset, { duration: a.duration, easing: a.easing, at, compWidth: ctx.project.meta.width, compHeight: ctx.project.meta.height }) });
    }
    return out;
  }, { mutates: true }),

  cmd('animation.text_animator', 'Animateur de texte par caractère / mot / ligne (typewriter, fade, slide, bounce, wave, scramble, split, glitch, blurIn, maskReveal, rotate3d, random, pop)', 'Text animator', args({
    clipId: S.str('Clip texte'), type: S.enm('Type', TEXT_ANIMATORS), by: S.enm('Unité', ['char', 'word', 'line']), direction: S.enm('Sens', ['in', 'out']), start: S.num('Début local (s)'), duration: S.num('Durée (s)'), stagger: S.num('Décalage entre unités (s)'), easing: easingSchema, amount: S.num('Intensité'), random: S.bool('Ordre aléatoire'),
  }, ['type']), (ctx, a) => {
    const c = ctx.findClip(a.clipId || selectedOr(ctx)[0]);
    if (c.kind !== 'text') throw new CommandError('Ce clip n\'est pas un texte.');
    if (a.type === 'none') { c.props.animator = null; return { animator: null }; }
    const prev = c.props.animator || {};
    c.props.animator = { by: 'char', direction: 'in', start: 0, duration: 1.2, stagger: 0.04, easing: 'easeOutCubic', amount: 1, random: false, ...prev, ...Object.fromEntries(Object.entries(a).filter(([k, v]) => k !== 'clipId' && v !== undefined)) };
    if (c.props.animator.direction === 'out' && a.start === undefined) c.props.animator.start = Math.max(0, c.duration - c.props.animator.duration);
    return { animator: c.props.animator };
  }, { mutates: true }),

  cmd('animation.clear', 'Supprimer toutes les animations (keyframes, transitions, expressions) d\'un clip', 'Clear animation', args({ clipId: S.str('Clip'), paths: S.arr('Chemins (défaut : tous)', { type: 'string' }), keepTransitions: S.bool('Conserver les transitions') }), (ctx, a) => {
    const c = ctx.findClip(a.clipId || selectedOr(ctx)[0]);
    const paths = a.paths || Object.keys(c.keyframes);
    for (const p of paths) delete c.keyframes[p];
    if (!a.paths) {
      c.expressions = {};
      c.effects = c.effects.filter((e) => !e.presetOwner);
      if (!a.keepTransitions) { c.transitionIn = null; c.transitionOut = null; }
      if (c.kind === 'text') c.props.animator = null;
      c.motionPath = null;
    }
    return { cleared: paths };
  }, { mutates: true }),

  cmd('expression.set', 'Définir une expression JS sandboxée sur une propriété (time, value, wiggle(), loopOut(), linear(), ease(), random(), noise(), thisLayer, thisComp.layer("Nom"), control("Nom"), audio.amplitude, audio.band(i))', 'Set expression', args({ clipId: S.str('Clip'), path: S.str('Chemin'), code: S.str('Expression', { maxLength: 2000 }) }, ['path', 'code']), (ctx, a) => {
    const c = ctx.findClip(a.clipId || selectedOr(ctx)[0]);
    const err = checkExpression(a.code);
    if (err) throw new CommandError(err);
    if (getPath(c, a.path) === undefined && !c.keyframes[a.path]) throw new CommandError(`Propriété introuvable : ${a.path}`);
    c.expressions[a.path] = a.code;
    const r = resolveClip(c, Math.max(c.start, ctx.app.time), { comp: ctx.project.meta, layer: makeLayerLookup(ctx.project, ctx.app.time), control: makeControlLookup(ctx.project, ctx.app.time) });
    if (r.expressionErrors?.[a.path]) throw new CommandError(`Erreur d'exécution : ${r.expressionErrors[a.path]}`);
    return { path: a.path, preview: getPath(r, a.path) };
  }, { mutates: true }),

  cmd('expression.clear', 'Retirer une expression', 'Clear expression', args({ clipId: S.str('Clip'), path: S.str('Chemin') }, ['clipId', 'path']), (ctx, a) => { delete ctx.findClip(a.clipId).expressions[a.path]; return { cleared: a.path }; }, { mutates: true }),

  cmd('expression.list', 'Lister les expressions d\'un clip', 'List expressions', args({ clipId: S.str('Clip') }, ['clipId']), (ctx, a) => ctx.findClip(a.clipId).expressions),

  cmd('audio.link_property', 'Audio-réactivité : lier une propriété à l\'amplitude ou à une bande de fréquences (lissage, gain)', 'Link property to audio', args({ clipId: S.str('Clip'), path: S.str('Chemin numérique'), assetId: S.str('Source audio (défaut : mixage global)'), band: { description: '"amplitude" ou index de bande 0-15 (graves → aigus)' }, gain: S.num('Gain'), smoothing: S.num('Lissage 0-0.99', { minimum: 0, maximum: 0.99 }), mode: S.enm('Mode', ['add', 'multiply']), range: S.num('Amplitude ajoutée (mode add)') }, ['path']), (ctx, a) => {
    const c = ctx.findClip(a.clipId || selectedOr(ctx)[0]);
    if (typeof getPath(c, a.path) !== 'number') throw new CommandError(`${a.path} n'est pas une propriété numérique.`);
    c.audioLinks[a.path] = { assetId: a.assetId || null, band: a.band ?? 'amplitude', gain: a.gain ?? 1, smoothing: a.smoothing ?? 0.5, mode: a.mode || 'multiply', range: a.range ?? 100 };
    return { path: a.path, link: c.audioLinks[a.path] };
  }, { mutates: true }),

  cmd('audio.unlink_property', 'Retirer un lien audio-réactif', 'Unlink audio property', args({ clipId: S.str('Clip'), path: S.str('Chemin') }, ['clipId', 'path']), (ctx, a) => { delete ctx.findClip(a.clipId).audioLinks[a.path]; return { unlinked: a.path }; }, { mutates: true }),

  cmd('audio.detect_beats', 'Détecter les beats d\'un audio et créer des marqueurs', 'Detect beats → markers', args({ assetId: S.str('Asset audio'), clipId: S.str('Clip audio (décalage = début du clip)'), sensitivity: S.num('Sensibilité 0-1', { minimum: 0, maximum: 1 }), minInterval: S.num('Intervalle min (s)'), addMarkers: S.bool('Créer des marqueurs (défaut : oui)'), color: S.str('Couleur des marqueurs') }), async (ctx, a) => {
    let assetId = a.assetId, offset = 0, inPoint = 0, dur = Infinity;
    if (a.clipId) { const c = ctx.findClip(a.clipId); assetId = c.props.assetId; offset = c.start; inPoint = c.inPoint || 0; dur = c.duration; }
    if (!assetId) { const c = ctx.project.clips.find((x) => x.kind === 'audio'); if (!c) throw new CommandError('Aucun audio dans le projet.'); assetId = c.props.assetId; offset = c.start; inPoint = c.inPoint || 0; dur = c.duration; }
    const r = await ctx.services.audio.detectBeats(assetId, { sensitivity: a.sensitivity ?? 0.5, minInterval: a.minInterval ?? 0.25 });
    const beats = r.beats.filter((b) => b >= inPoint && b < inPoint + dur).map((b) => +(offset + b - inPoint).toFixed(4));
    if (a.addMarkers !== false) for (const b of beats) ctx.project.markers.push({ id: uid('mk'), t: b, label: 'Beat', color: a.color || '#24D26D' });
    return { bpm: r.bpm, count: beats.length, beats };
  }, { mutates: true, env: 'browser' }),

  cmd('path.follow', 'Faire suivre un tracé à un calque (auto-orientation, timing, easing)', 'Follow path', args({ clipId: S.str('Clip à animer'), points: S.arr('Points du tracé [{x,y,ix,iy,ox,oy}] (repère composition, 0 = centre)', { type: 'object' }), sourceClipId: S.str('Clip forme dont le tracé est utilisé'), closed: S.bool('Tracé fermé'), start: S.num('Début local (s)'), end: S.num('Fin locale (s)'), easing: easingSchema, autoOrient: S.bool('Orientation automatique'), rotationOffset: S.num('Décalage de rotation (°)'), remove: S.bool('Retirer le suivi') }, ['clipId']), (ctx, a) => {
    const c = ctx.findClip(a.clipId);
    if (a.remove) { c.motionPath = null; return { removed: true }; }
    let points = a.points, closed = !!a.closed;
    if (a.sourceClipId) {
      const s = ctx.findClip(a.sourceClipId);
      if (s.kind !== 'shape') throw new CommandError('Le clip source doit être une forme.');
      const sp = shapeToPoints(s.props);
      const sc = s.transform.scale;
      points = sp.points.map((p) => ({ x: s.transform.x + p.x * sc * s.transform.scaleX, y: s.transform.y + p.y * sc * s.transform.scaleY, ix: (p.ix || 0) * sc, iy: (p.iy || 0) * sc, ox: (p.ox || 0) * sc, oy: (p.oy || 0) * sc }));
      closed = sp.closed;
    }
    if (!points || points.length < 2) throw new CommandError('Au moins 2 points sont nécessaires.');
    checkEasing(a.easing);
    c.motionPath = { points, closed, start: a.start ?? 0, end: a.end ?? c.duration, easing: a.easing || 'easeInOutCubic', autoOrient: !!a.autoOrient, rotationOffset: a.rotationOffset || 0 };
    return c.motionPath;
  }, { mutates: true }),

  cmd('path.morph', 'Morphing de forme : interpole la forme d\'un clip vers une autre forme', 'Shape morph', args({ clipId: S.str('Clip forme'), to: S.obj('Forme cible {shape, width, height, sides, points, path…}'), toClipId: S.str('Ou clip forme cible'), start: S.num('Début local (s)'), duration: S.num('Durée (s)'), easing: easingSchema }, ['clipId']), (ctx, a) => {
    const c = ctx.findClip(a.clipId);
    if (c.kind !== 'shape') throw new CommandError('Le morphing s\'applique aux formes.');
    const target = a.toClipId ? deepClone(ctx.findClip(a.toClipId).props) : { ...c.props, ...(a.to || {}) };
    if (!a.to && !a.toClipId) throw new CommandError('Indiquez "to" ou "toClipId".');
    c.props.morphTo = { shape: target.shape, width: target.width, height: target.height, sides: target.sides, points: target.points, innerRadius: target.innerRadius, radius: target.radius, path: target.path, closed: target.closed };
    const t0 = a.start ?? 0, d = a.duration ?? Math.min(1, c.duration);
    c.keyframes['props.morph'] = [{ t: t0, v: 0, easing: a.easing || 'easeInOutCubic' }, { t: Math.min(c.duration, t0 + d), v: 1 }];
    return { morphTo: c.props.morphTo };
  }, { mutates: true }),

  cmd('camera.set', 'Régler la caméra 2.5D (crée un calque caméra si besoin) : position, zoom, focale, profondeur de champ, tremblement', 'Set camera', args({ clipId: S.str('Clip caméra'), x: S.num('X'), y: S.num('Y'), z: S.num('Z'), rotation: S.num('Rotation'), zoom: S.num('Zoom'), focal: S.num('Focale'), dof: S.obj('Profondeur de champ {enabled, focus, aperture}'), shake: S.obj('Tremblement {preset, amplitude, frequency, rotation}'), orbit: S.obj('Orbite {enabled, radius, speed}') }), (ctx, a) => {
    const cam = a.clipId ? ctx.findClip(a.clipId) : cameraClip(ctx);
    if (cam.kind !== 'camera') throw new CommandError('Ce clip n\'est pas une caméra.');
    const lt = Math.max(0, ctx.app.time - cam.start);
    const setA = (path, v) => {
      const keys = cam.keyframes[path];
      if (keys?.length) { const k = keys.find((x) => Math.abs(x.t - lt) < 1e-3); if (k) k.v = v; else { keys.push({ t: lt, v, easing: 'easeInOutCubic' }); keys.sort((p, q) => p.t - q.t); } } else { const segs = path.split('.'); cam[segs[0]][segs[1]] = v; }
    };
    for (const k of ['x', 'y', 'z', 'rotation']) if (a[k] !== undefined) setA(`transform.${k}`, a[k]);
    for (const k of ['zoom', 'focal']) if (a[k] !== undefined) setA(`props.${k}`, a[k]);
    for (const k of ['dof', 'shake', 'orbit']) if (a[k]) cam.props[k] = { ...cam.props[k], ...a[k] };
    return { clipId: cam.id };
  }, { mutates: true }),

  cmd('camera.preset_move', 'Mouvement de caméra préréglé : dolly, pan, tilt, orbite, grue, zoom punch, tremblements (handheld, séisme)', 'Camera preset move', args({ type: S.enm('Mouvement', ['dolly-in', 'dolly-out', 'pan-left', 'pan-right', 'tilt-up', 'tilt-down', 'crane-up', 'orbit', 'zoom-punch', 'push-rotate', 'handheld', 'tremor', 'earthquake']), start: S.num('Début (s, composition)'), duration: S.num('Durée (s)'), intensity: S.num('Intensité (1 = normal)'), easing: easingSchema }, ['type']), (ctx, a) => {
    const cam = cameraClip(ctx);
    const t0 = Math.max(0, (a.start ?? ctx.app.time) - cam.start), d = a.duration ?? 2, k = a.intensity ?? 1, e = a.easing || 'easeInOutCubic';
    const t1 = Math.min(cam.duration, t0 + d);
    const kf = (path, v0, v1, ease = e) => { const keys = (cam.keyframes[path] || []).filter((x) => x.t < t0 - 1e-4 || x.t > t1 + 1e-4); keys.push({ t: t0, v: v0, easing: ease }, { t: t1, v: v1 }); cam.keyframes[path] = keys.sort((p, q) => p.t - q.t); };
    const base = (path) => getPath(resolveClip(cam, cam.start + t0, { comp: ctx.project.meta }), path);
    const X = base('transform.x'), Y = base('transform.y'), Z = base('props.zoom'), R = base('transform.rotation');
    switch (a.type) {
      case 'dolly-in': kf('props.zoom', Z, Z * (1 + 0.3 * k)); break;
      case 'dolly-out': kf('props.zoom', Z, Z / (1 + 0.3 * k)); break;
      case 'pan-left': kf('transform.x', X, X - 400 * k); break;
      case 'pan-right': kf('transform.x', X, X + 400 * k); break;
      case 'tilt-up': kf('transform.y', Y, Y - 300 * k); break;
      case 'tilt-down': kf('transform.y', Y, Y + 300 * k); break;
      case 'crane-up': kf('transform.y', Y, Y - 350 * k); kf('props.zoom', Z, Z * (1 + 0.15 * k)); break;
      case 'zoom-punch': cam.keyframes['props.zoom'] = [...(cam.keyframes['props.zoom'] || []).filter((x) => x.t < t0 || x.t > t1), { t: t0, v: Z, easing: 'easeOutExpo' }, { t: t0 + d * 0.25, v: Z * (1 + 0.2 * k), easing: 'easeInOutCubic' }, { t: t1, v: Z }].sort((p, q) => p.t - q.t); break;
      case 'push-rotate': kf('props.zoom', Z, Z * (1 + 0.25 * k)); kf('transform.rotation', R, R + 8 * k); break;
      case 'orbit': cam.props.orbit = { enabled: true, radius: 200 * k, speed: 360 / d }; break;
      case 'handheld': cam.props.shake = { preset: 'handheld', amplitude: 10 * k, frequency: 1.2, rotation: 0.6 * k }; break;
      case 'tremor': cam.props.shake = { preset: 'tremor', amplitude: 6 * k, frequency: 9, rotation: 0.3 * k }; break;
      case 'earthquake': cam.props.shake = { preset: 'earthquake', amplitude: 40 * k, frequency: 7, rotation: 2 * k }; break;
      default: break;
    }
    return { clipId: cam.id, type: a.type };
  }, { mutates: true }),

  cmd('tracking.track_point', 'Suivi de point (template matching) sur un clip vidéo ; 2 points = échelle + rotation', 'Track point', args({ clipId: S.str('Clip vidéo'), x: S.num('X du point (px, repère composition centré)'), y: S.num('Y du point'), x2: S.num('X du 2e point (optionnel)'), y2: S.num('Y du 2e point'), size: S.num('Taille du motif (px)'), search: S.num('Zone de recherche (px)'), start: S.num('Début (s, composition)'), end: S.num('Fin (s)'), name: S.str('Nom du suivi') }, ['clipId', 'x', 'y']), async (ctx, a) => {
    const c = ctx.findClip(a.clipId);
    if (c.kind !== 'video') throw new CommandError('Le suivi nécessite un clip vidéo.');
    const data = await ctx.services.tracking.track(ctx.project, c, a);
    const tr = { id: uid('tkd'), name: a.name || `Suivi ${((ctx.project.trackingData || []).length) + 1}`, clipId: c.id, samples: data.samples };
    ctx.project.trackingData = [...(ctx.project.trackingData || []), tr];
    return { trackingId: tr.id, samples: tr.samples.length, confidence: data.confidence };
  }, { mutates: true, env: 'browser' }),

  cmd('tracking.apply', 'Appliquer un suivi à un calque (position, échelle, rotation)', 'Apply tracking', args({ trackingId: S.str('Suivi'), targetClipId: S.str('Clip cible'), position: S.bool('Position (défaut oui)'), scale: S.bool('Échelle'), rotation: S.bool('Rotation'), offsetX: S.num('Décalage X'), offsetY: S.num('Décalage Y') }, ['trackingId', 'targetClipId']), (ctx, a) => {
    const tr = (ctx.project.trackingData || []).find((x) => x.id === a.trackingId);
    if (!tr) throw new CommandError('Suivi introuvable');
    const c = ctx.findClip(a.targetClipId);
    const s0 = tr.samples[0];
    const step = Math.max(1, Math.floor(tr.samples.length / 120));
    const sel = tr.samples.filter((_, i) => i % step === 0 || i === tr.samples.length - 1);
    const lt = (t) => Math.max(0, Math.min(c.duration, t - c.start));
    if (a.position !== false) {
      c.keyframes['transform.x'] = sel.map((s) => ({ t: lt(s.t), v: s.x + (a.offsetX || 0), easing: 'linear' }));
      c.keyframes['transform.y'] = sel.map((s) => ({ t: lt(s.t), v: s.y + (a.offsetY || 0), easing: 'linear' }));
    }
    if (a.scale && s0.scale) c.keyframes['transform.scale'] = sel.map((s) => ({ t: lt(s.t), v: c.transform.scale * (s.scale / s0.scale), easing: 'linear' }));
    if (a.rotation && s0.rotation !== undefined) c.keyframes['transform.rotation'] = sel.map((s) => ({ t: lt(s.t), v: c.transform.rotation + (s.rotation - s0.rotation), easing: 'linear' }));
    return { applied: sel.length };
  }, { mutates: true }),

  cmd('tracking.stabilize', 'Stabilisation basique : compense le mouvement suivi sur le clip vidéo lui-même', 'Stabilize', args({ trackingId: S.str('Suivi'), zoom: S.num('Zoom de compensation (ex. 1.1)') }, ['trackingId']), (ctx, a) => {
    const tr = (ctx.project.trackingData || []).find((x) => x.id === a.trackingId);
    if (!tr) throw new CommandError('Suivi introuvable');
    const c = ctx.findClip(tr.clipId);
    const s0 = tr.samples[0];
    const lt = (t) => Math.max(0, Math.min(c.duration, t - c.start));
    c.keyframes['transform.x'] = tr.samples.map((s) => ({ t: lt(s.t), v: c.transform.x - (s.x - s0.x), easing: 'linear' }));
    c.keyframes['transform.y'] = tr.samples.map((s) => ({ t: lt(s.t), v: c.transform.y - (s.y - s0.y), easing: 'linear' }));
    c.transform.scale *= a.zoom ?? 1.08;
    return { stabilized: c.id };
  }, { mutates: true }),

  cmd('tracking.list', 'Lister les données de suivi', 'List tracking data', args({}), (ctx) => (ctx.project.trackingData || []).map((t) => ({ id: t.id, name: t.name, clipId: t.clipId, samples: t.samples.length }))),

  cmd('control.add', 'Ajouter un contrôle (curseur, couleur, case à cocher, angle) à un calque nul — accessible via control("Nom")', 'Add control', args({ clipId: S.str('Calque nul'), type: S.enm('Type', ['slider', 'color', 'checkbox', 'angle']), name: S.str('Nom'), value: S.any('Valeur'), min: S.num('Min'), max: S.num('Max') }, ['type', 'name']), (ctx, a) => {
    let c = a.clipId ? ctx.findClip(a.clipId) : ctx.project.clips.find((x) => x.kind === 'null');
    if (!c) {
      c = makeClip(ctx.project, { kind: 'null', start: 0, duration: ctx.project.meta.duration, name: 'Contrôleur' });
      c.trackId = pickTrack(ctx.project, 'null', 0, c.duration).id;
      ctx.project.clips.push(c);
    }
    if (c.kind !== 'null') throw new CommandError('Les contrôles s\'ajoutent sur un calque nul.');
    const def = { slider: 0, color: '#24D26D', checkbox: false, angle: 0 }[a.type];
    const ctl = { id: uid('ctl'), type: a.type, name: a.name, value: a.value ?? def, min: a.min ?? 0, max: a.max ?? 100 };
    c.props.controls = [...(c.props.controls || []), ctl];
    return { clipId: c.id, controlId: ctl.id };
  }, { mutates: true }),

  cmd('control.update', 'Modifier un contrôle', 'Update control', args({ clipId: S.str('Calque nul'), controlId: S.str('Contrôle'), value: S.any('Valeur'), name: S.str('Nom'), min: S.num('Min'), max: S.num('Max') }, ['clipId', 'controlId']), (ctx, a) => {
    const c = ctx.findClip(a.clipId);
    const ctl = (c.props.controls || []).find((x) => x.id === a.controlId);
    if (!ctl) throw new CommandError('Contrôle introuvable');
    for (const k of ['name', 'min', 'max']) if (a[k] !== undefined) ctl[k] = a[k];
    if (a.value !== undefined) {
      const path = `props.controls.${ctl.id}.value`;
      const keys = c.keyframes[path];
      if (keys?.length) { const lt = ctx.app.time - c.start; const k = keys.find((x) => Math.abs(x.t - lt) < 1e-3); if (k) k.v = a.value; else { keys.push({ t: lt, v: a.value, easing: 'linear' }); keys.sort((p, q) => p.t - q.t); } } else ctl.value = a.value;
    }
    return ctl;
  }, { mutates: true }),

  cmd('control.remove', 'Supprimer un contrôle', 'Remove control', args({ clipId: S.str('Calque nul'), controlId: S.str('Contrôle') }, ['clipId', 'controlId']), (ctx, a) => {
    const c = ctx.findClip(a.clipId);
    c.props.controls = (c.props.controls || []).filter((x) => x.id !== a.controlId);
    delete c.keyframes[`props.controls.${a.controlId}.value`];
    return { removed: a.controlId };
  }, { mutates: true }),
];
