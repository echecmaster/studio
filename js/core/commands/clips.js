import { cmd, args, S, makeClip, pickTrack, trackHasRoom, createTrack, requireUnlocked, selectedOr, estimateSize, shiftKeyframes, cloneClipWithNewIds, normalizeOrders } from './helpers.js';
import { CommandError } from '../commandBus.js';
import { CLIP_KINDS, normalizeClip } from '../schema.js';
import { deepClone, deepMerge, getPath, setPath, uid } from '../util.js';
import { evalKeys, resolveClip, isActiveAt } from '../evaluate.js';
import { LIBRARY, libraryProps } from '../../catalog/elements.js';
import { BLEND_MODES } from '../../catalog/blendModes.js';
import { EFFECT_MAP, defaultEffectParams } from '../../catalog/effects.js';

// Modifie une propriété animable : si elle a des keyframes, crée/met à jour la keyframe à l'instant courant.
export function setAnimatable(ctx, clip, path, value, { localT } = {}) {
  const keys = clip.keyframes?.[path];
  if (keys && keys.length) {
    const t = Math.max(0, Math.min(clip.duration, localT ?? (ctx.app.time - clip.start)));
    const tol = 0.5 / ctx.project.meta.fps;
    const k = keys.find((x) => Math.abs(x.t - t) < tol);
    if (k) k.v = value; else { keys.push({ t: +t.toFixed(5), v: value, easing: keys[0]?.easing || 'easeInOutCubic' }); keys.sort((a, b) => a.t - b.t); }
  } else setPath(clip, path, value);
}

function mediaDuration(project, clip) {
  const a = project.assets.find((x) => x.id === clip.props?.assetId);
  return a?.meta?.duration || null;
}

function splitClip(ctx, clip, t) {
  const cut = t - clip.start;
  if (cut <= 1e-4 || cut >= clip.duration - 1e-4) return null;
  const rightSrc = deepClone(clip);
  // keyframes : la partie gauche garde ses clés (+ valeur au point de coupe), la droite est décalée
  for (const [path, keys] of Object.entries(clip.keyframes)) {
    const v = evalKeys(keys, cut);
    const before = keys.filter((k) => k.t <= cut);
    const segEase = before.length ? before[before.length - 1].easing : 'linear';
    clip.keyframes[path] = [...keys.filter((k) => k.t < cut - 1e-5), { t: cut, v, easing: 'linear' }];
    rightSrc.keyframes[path] = [{ t: 0, v, easing: segEase || 'linear' }, ...keys.filter((k) => k.t > cut + 1e-5).map((k) => ({ ...k, t: +(k.t - cut).toFixed(5) }))];
  }
  const right = cloneClipWithNewIds(rightSrc);
  right.start = t;
  right.duration = clip.duration - cut;
  right.inPoint = (clip.inPoint || 0) + (clip.reverse ? 0 : cut * (clip.speed || 1));
  if (clip.reverse) clip.inPoint = (clip.inPoint || 0) + right.duration * (clip.speed || 1);
  if (clip.timeRemap?.keys) right.timeRemap = { ...clip.timeRemap, keys: clip.timeRemap.keys.filter((k) => k.t >= cut).map((k) => ({ ...k, t: k.t - cut })) };
  right.transitionIn = null;
  clip.transitionOut = null;
  clip.duration = cut;
  right.name = clip.name;
  ctx.project.clips.push(right);
  return right;
}

function bbox(ctx, clip) {
  const r = resolveClip(clip, Math.max(clip.start, Math.min(ctx.app.time, clip.start + clip.duration - 1e-3)), { comp: ctx.project.meta });
  const size = ctx.services.measure ? ctx.services.measure(r) : estimateSize(r, ctx.project);
  const w = size.w * Math.abs(r.transform.scale * r.transform.scaleX), h = size.h * Math.abs(r.transform.scale * r.transform.scaleY);
  const cx = r.transform.x + (0.5 - r.transform.anchorX) * w, cy = r.transform.y + (0.5 - r.transform.anchorY) * h;
  return { x0: cx - w / 2, x1: cx + w / 2, y0: cy - h / 2, y1: cy + h / 2, w, h, cx, cy };
}

const clipArgs = {
  kind: S.enm('Type d\'élément', CLIP_KINDS), library: S.str('Identifiant d\'un élément de la bibliothèque (alternative à kind)'),
  trackId: S.str('Piste (auto si absent)'), start: S.num('Début (s)', { minimum: 0 }), duration: S.num('Durée (s)', { exclusiveMinimum: 0 }),
  name: S.str('Nom'), props: S.obj('Propriétés spécifiques au type (voir clip.kinds)'), transform: S.obj('Transformation {x,y,scale,rotation,opacity,anchorX,anchorY,…} (x,y relatifs au centre)'),
  effects: S.arr('Effets [{type, params}]', { type: 'object' }), keyframes: S.obj('Keyframes {chemin: [{t,v,easing}]}'), expressions: S.obj('Expressions {chemin: code}'),
  blendMode: S.str('Mode de fusion'), transitionIn: S.obj('Transition d\'entrée {type,duration}'), transitionOut: S.obj('Transition de sortie {type,duration}'),
  parentId: S.str('Parent'), select: S.bool('Sélectionner le clip créé'), id: S.str('Identifiant imposé (optionnel)'),
};

export default [
  cmd('clip.add', 'Ajouter un élément / clip sur la timeline (tous les types : forme, texte, média, particules, générateur, shader, data viz, UI, 3D, caméra…)', 'Add a clip/element', args(clipArgs), (ctx, a) => {
    let kind = a.kind;
    let props = a.props;
    if (a.library) {
      const entry = LIBRARY.find((l) => l.id === a.library);
      if (!entry) throw new CommandError(`Élément de bibliothèque inconnu : ${a.library}`);
      kind = entry.kind;
      props = deepMerge(libraryProps(entry, ctx.project.meta), a.props || {});
    }
    if (!kind) throw new CommandError('Indiquez "kind" ou "library".');
    if (props && !a.library && kind === 'text' && typeof props.animator === 'string') props.animator = { type: props.animator, by: 'char', direction: 'in', start: 0, duration: 1.2, stagger: 0.04, easing: 'easeOutCubic', amount: 1 };
    const start = a.start ?? ctx.app.time ?? 0;
    const tmp = makeClip(ctx.project, { ...a, kind, props, start, opts: a.library ? undefined : props });
    if (['image', 'video', 'audio', 'svg', 'lottie'].includes(kind) && tmp.props.assetId) {
      const as = ctx.project.assets.find((x) => x.id === tmp.props.assetId);
      if (!as) throw new CommandError(`Asset introuvable : ${tmp.props.assetId}`);
      if (a.duration === undefined && as.meta?.duration) tmp.duration = as.meta.duration;
    }
    tmp.effects = tmp.effects.map((e) => {
      if (!EFFECT_MAP[e.type]) throw new CommandError(`Effet inconnu : ${e.type}`);
      return { ...e, id: e.id || uid('fx'), enabled: e.enabled !== false, params: { ...defaultEffectParams(e.type), ...(e.params || {}) } };
    });
    let track;
    if (a.trackId) { track = ctx.findTrack(a.trackId); if (track.locked) throw new CommandError(`Piste verrouillée : ${track.name}`); }
    else track = pickTrack(ctx.project, kind, tmp.start, tmp.duration);
    tmp.trackId = track.id;
    ctx.project.clips.push(tmp);
    if (a.select !== false) ctx.setApp({ selection: [tmp.id] });
    return { id: tmp.id, trackId: track.id, kind, start: tmp.start, duration: tmp.duration, name: tmp.name };
  }, { mutates: true }),

  cmd('clip.remove', 'Supprimer des clips', 'Remove clips', args({ ids: S.ids() }), (ctx, a) => {
    const ids = selectedOr(ctx, a.ids);
    for (const id of ids) requireUnlocked(ctx, ctx.findClip(id));
    ctx.project.clips = ctx.project.clips.filter((c) => !ids.includes(c.id));
    for (const c of ctx.project.clips) {
      if (ids.includes(c.parentId)) c.parentId = null;
      if (c.matte && ids.includes(c.matte.sourceId)) c.matte = null;
    }
    ctx.setApp({ selection: ctx.app.selection.filter((id) => !ids.includes(id)) });
    return { removed: ids };
  }, { mutates: true, shortcut: 'Delete' }),

  cmd('clip.ripple_delete', 'Suppression avec propagation (décale les clips suivants de la piste)', 'Ripple delete', args({ ids: S.ids() }), async (ctx, a) => {
    const ids = selectedOr(ctx, a.ids);
    const clips = ids.map((id) => ctx.findClip(id)).sort((x, y) => y.start - x.start);
    for (const c of clips) {
      requireUnlocked(ctx, c);
      for (const o of ctx.project.clips) if (o.trackId === c.trackId && o.start >= c.start + c.duration - 1e-6 && !ids.includes(o.id)) o.start = Math.max(0, o.start - c.duration);
    }
    await ctx.call('clip.remove', { ids });
    return { removed: ids };
  }, { mutates: true, shortcut: 'Shift+Delete' }),

  cmd('clip.update', 'Mettre à jour un clip par fusion profonde d\'un patch (props, transform, nom, timing…)', 'Update clip (deep merge)', args({ id: S.str('Clip'), patch: S.obj('Patch à fusionner') }, ['id', 'patch']), (ctx, a) => {
    const c = ctx.findClip(a.id);
    requireUnlocked(ctx, c);
    const { id, ...patch } = a.patch;
    const merged = normalizeClip(deepMerge(c, patch));
    Object.assign(c, merged, { id: c.id });
    if (patch.trackId) ctx.findTrack(patch.trackId);
    return { id: c.id };
  }, { mutates: true }),

  cmd('clip.set', 'Définir une propriété par chemin (ex. props.fontSize, transform.x, effects.<id>.params.amount) — crée une keyframe si la propriété est animée', 'Set a property by path', args({ id: S.str('Clip'), path: S.str('Chemin'), value: S.any('Valeur'), ids: S.ids('Plusieurs clips (optionnel)'), t: S.num('Instant local (s) pour la keyframe') }, ['path']), (ctx, a) => {
    const ids = a.ids?.length ? a.ids : [a.id || ctx.app.selection[0]];
    if (!ids[0]) throw new CommandError('Aucun clip.');
    for (const id of ids) {
      const c = ctx.findClip(id);
      requireUnlocked(ctx, c);
      if (['id', 'trackId', 'kind'].includes(a.path)) throw new CommandError(`Propriété non modifiable via clip.set : ${a.path}`);
      setAnimatable(ctx, c, a.path, a.value, { localT: a.t });
    }
    return { ids, path: a.path, value: a.value };
  }, { mutates: true }),

  cmd('clip.move', 'Déplacer des clips dans le temps et/ou vers une autre piste', 'Move clips', args({ ids: S.ids(), start: S.num('Nouveau début du 1er clip (s)', { minimum: 0 }), delta: S.num('Décalage (s)'), trackId: S.str('Piste cible'), trackDelta: S.int('Décalage de piste (+ = vers le bas)') }), (ctx, a) => {
    const ids = selectedOr(ctx, a.ids);
    const clips = ids.map((id) => ctx.findClip(id));
    clips.forEach((c) => requireUnlocked(ctx, c));
    const first = clips.reduce((m, c) => (c.start < m.start ? c : m), clips[0]);
    let delta = a.delta ?? (a.start !== undefined ? a.start - first.start : 0);
    const minStart = Math.min(...clips.map((c) => c.start));
    if (minStart + delta < 0) delta = -minStart;
    const tracks = [...ctx.project.tracks].sort((x, y) => x.order - y.order);
    for (const c of clips) {
      c.start = +(c.start + delta).toFixed(6);
      if (a.trackId) { const t = ctx.findTrack(a.trackId); if (t.locked) throw new CommandError('Piste cible verrouillée'); c.trackId = t.id; }
      else if (a.trackDelta) {
        const idx = tracks.findIndex((t) => t.id === c.trackId);
        const nt = tracks[Math.max(0, Math.min(tracks.length - 1, idx + a.trackDelta))];
        if (!nt.locked) c.trackId = nt.id;
      }
    }
    return { ids, delta };
  }, { mutates: true }),

  cmd('clip.trim', 'Rogner un clip par son bord d\'entrée (in) ou de sortie (out) à l\'instant donné', 'Trim clip edge', args({ id: S.str('Clip'), edge: S.enm('Bord', ['in', 'out']), time: S.num('Nouvel instant du bord (s, composition)', { minimum: 0 }) }, ['id', 'edge', 'time']), (ctx, a) => {
    const c = ctx.findClip(a.id);
    requireUnlocked(ctx, c);
    const fps = ctx.project.meta.fps;
    const minDur = 1 / fps;
    const srcDur = mediaDuration(ctx.project, c);
    const sp = c.speed || 1;
    if (a.edge === 'in') {
      const end = c.start + c.duration;
      let ns = Math.min(a.time, end - minDur);
      const maxBack = srcDur && !c.props.loop && !c.reverse ? (c.inPoint || 0) / sp : Infinity;
      ns = Math.max(ns, c.start - maxBack, 0);
      const d = ns - c.start;
      if (!c.reverse) c.inPoint = Math.max(0, (c.inPoint || 0) + d * sp);
      c.start = ns;
      c.duration = end - ns;
      shiftKeyframes(c, -d);
    } else {
      let nd = Math.max(minDur, a.time - c.start);
      if (srcDur && !c.props.loop && ['video', 'audio'].includes(c.kind)) nd = Math.min(nd, (srcDur - (c.inPoint || 0)) / sp);
      c.duration = nd;
      shiftKeyframes(c, 0);
    }
    return { id: c.id, start: c.start, duration: c.duration, inPoint: c.inPoint };
  }, { mutates: true }),

  cmd('clip.set_duration', 'Définir la durée d\'un clip', 'Set clip duration', args({ id: S.str('Clip'), duration: S.num('Durée (s)', { exclusiveMinimum: 0 }) }, ['id', 'duration']), (ctx, a) => ctx.call('clip.trim', { id: a.id, edge: 'out', time: ctx.findClip(a.id).start + a.duration }), { mutates: true }),

  cmd('clip.split', 'Couper les clips à la tête de lecture (ou à t)', 'Split clips at playhead', args({ ids: S.ids('Clips (défaut : sélection, sinon tous ceux sous la tête de lecture)'), t: S.num('Instant (s)', { minimum: 0 }) }), (ctx, a) => {
    const t = a.t ?? ctx.app.time;
    let ids = a.ids?.length ? a.ids : ctx.app.selection;
    if (!ids.length) ids = ctx.project.clips.filter((c) => isActiveAt(c, t)).map((c) => c.id);
    const created = [];
    for (const id of ids) {
      const c = ctx.findClip(id);
      if (!isActiveAt(c, t)) continue;
      requireUnlocked(ctx, c);
      const r = splitClip(ctx, c, t);
      if (r) created.push(r.id);
    }
    if (!created.length) throw new CommandError('Aucun clip à couper à cet instant.');
    return { t, created };
  }, { mutates: true, shortcut: 'S' }),

  cmd('clip.duplicate', 'Dupliquer des clips (placés juste après)', 'Duplicate clips', args({ ids: S.ids(), offset: S.num('Décalage temporel (défaut : durée du clip)') }), (ctx, a) => {
    const ids = selectedOr(ctx, a.ids);
    const created = [];
    for (const id of ids) {
      const c = ctx.findClip(id);
      const d = cloneClipWithNewIds(c);
      d.start = c.start + (a.offset ?? c.duration);
      d.name = `${c.name} (copie)`;
      if (!trackHasRoom(ctx.project, c.trackId, d.start, d.duration)) {
        const tr = ctx.project.tracks.find((t) => t.id === c.trackId);
        d.trackId = createTrack(ctx.project, tr.type, { index: tr.order }).id;
      }
      ctx.project.clips.push(d);
      created.push(d.id);
    }
    ctx.setApp({ selection: created });
    return { created };
  }, { mutates: true, shortcut: 'Ctrl+D' }),

  cmd('clip.copy', 'Copier des clips dans le presse-papiers (inter-projets)', 'Copy clips', args({ ids: S.ids() }), (ctx, a) => {
    const ids = selectedOr(ctx, a.ids);
    const clips = ids.map((id) => deepClone(ctx.findClip(id)));
    const t0 = Math.min(...clips.map((c) => c.start));
    const assets = ctx.project.assets.filter((as) => clips.some((c) => c.props?.assetId === as.id));
    const clipboard = { clips: clips.map((c) => ({ ...c, start: c.start - t0 })), assets, tracks: clips.map((c) => ctx.project.tracks.find((t) => t.id === c.trackId)?.type) };
    ctx.setApp({ clipboard });
    ctx.services.clipboard?.write?.(clipboard);
    return { copied: ids.length };
  }, { shortcut: 'Ctrl+C' }),

  cmd('clip.cut', 'Couper (copier puis supprimer) des clips', 'Cut clips', args({ ids: S.ids() }), async (ctx, a) => {
    const ids = selectedOr(ctx, a.ids);
    await ctx.call('clip.copy', { ids });
    await ctx.call('clip.remove', { ids });
    return { cut: ids.length };
  }, { mutates: true, shortcut: 'Ctrl+X' }),

  cmd('clip.paste', 'Coller les clips du presse-papiers à la tête de lecture (ou à t)', 'Paste clips', args({ t: S.num('Instant (s)', { minimum: 0 }), trackId: S.str('Piste cible'), data: S.obj('Contenu de presse-papiers explicite') }), (ctx, a) => {
    const cb = a.data || ctx.app.clipboard || ctx.services.clipboard?.read?.();
    if (!cb?.clips?.length) throw new CommandError('Presse-papiers vide.');
    const t = a.t ?? ctx.app.time;
    for (const as of cb.assets || []) if (!ctx.project.assets.find((x) => x.id === as.id)) ctx.project.assets.push(deepClone(as));
    const created = [];
    const idMap = {};
    cb.clips.forEach((src) => {
      const c = cloneClipWithNewIds(normalizeClip(src));
      idMap[src.id] = c.id;
      c.start = t + src.start;
      let tr = a.trackId ? ctx.findTrack(a.trackId) : ctx.project.tracks.find((x) => x.id === src.trackId);
      if (!tr || !trackHasRoom(ctx.project, tr.id, c.start, c.duration)) tr = pickTrack(ctx.project, c.kind, c.start, c.duration);
      c.trackId = tr.id;
      ctx.project.clips.push(c);
      created.push(c);
    });
    for (const c of created) { c.parentId = idMap[c.parentId] || null; if (c.matte) c.matte.sourceId = idMap[c.matte.sourceId] || null; }
    ctx.setApp({ selection: created.map((c) => c.id) });
    return { created: created.map((c) => c.id) };
  }, { mutates: true, shortcut: 'Ctrl+V' }),

  cmd('clip.set_speed', 'Vitesse constante du clip (0.1x – 10x)', 'Set clip speed', args({ id: S.str('Clip'), speed: S.num('Vitesse', { minimum: 0.1, maximum: 10 }), keepDuration: S.bool('Conserver la durée sur la timeline') }, ['id', 'speed']), (ctx, a) => {
    const c = ctx.findClip(a.id);
    requireUnlocked(ctx, c);
    const old = c.speed || 1;
    if (!a.keepDuration) {
      const nd = (c.duration * old) / a.speed;
      const k = nd / c.duration;
      for (const keys of Object.values(c.keyframes)) for (const kf of keys) kf.t *= k;
      c.duration = nd;
    }
    c.speed = a.speed;
    return { id: c.id, speed: c.speed, duration: c.duration };
  }, { mutates: true }),

  cmd('clip.reverse', 'Inverser la lecture du clip', 'Reverse clip', args({ id: S.str('Clip'), reverse: S.bool('Inversé') }, ['id']), (ctx, a) => {
    const c = ctx.findClip(a.id);
    c.reverse = a.reverse ?? !c.reverse;
    return { id: c.id, reverse: c.reverse };
  }, { mutates: true }),

  cmd('clip.time_remap', 'Time remap : courbe temps local → temps source [{t, v}]', 'Time remap curve', args({ id: S.str('Clip'), enabled: S.bool('Activé'), keys: S.arr('Clés {t (local), v (temps source), easing}', { type: 'object' }), preset: S.enm('Préset de courbe', ['slowmo-middle', 'speed-ramp', 'freeze-end', 'rewind']) }, ['id']), (ctx, a) => {
    const c = ctx.findClip(a.id);
    let keys = a.keys;
    const d = c.duration, s0 = c.inPoint || 0;
    if (a.preset === 'slowmo-middle') keys = [{ t: 0, v: s0, easing: 'easeOutCubic' }, { t: d * 0.4, v: s0 + d * 0.45, easing: 'linear' }, { t: d * 0.7, v: s0 + d * 0.52, easing: 'easeInCubic' }, { t: d, v: s0 + d }];
    if (a.preset === 'speed-ramp') keys = [{ t: 0, v: s0, easing: 'easeInExpo' }, { t: d, v: s0 + d * 1.5 }];
    if (a.preset === 'freeze-end') keys = [{ t: 0, v: s0, easing: 'linear' }, { t: d * 0.6, v: s0 + d * 0.6, easing: 'hold' }, { t: d, v: s0 + d * 0.6 }];
    if (a.preset === 'rewind') keys = [{ t: 0, v: s0, easing: 'linear' }, { t: d * 0.5, v: s0 + d * 0.5, easing: 'easeInOutCubic' }, { t: d, v: s0 }];
    c.timeRemap = { enabled: a.enabled ?? true, keys: (keys || c.timeRemap?.keys || [{ t: 0, v: s0 }, { t: d, v: s0 + d }]).map((k) => ({ easing: 'linear', ...k })).sort((x, y) => x.t - y.t) };
    return c.timeRemap;
  }, { mutates: true }),

  cmd('clip.set_blend_mode', 'Mode de fusion du clip (27 modes)', 'Set blend mode', args({ ids: S.ids(), mode: S.enm('Mode', BLEND_MODES.map((m) => m.id)) }, ['mode']), (ctx, a) => {
    const ids = selectedOr(ctx, a.ids);
    for (const id of ids) ctx.findClip(id).blendMode = a.mode;
    return { ids, mode: a.mode };
  }, { mutates: true }),

  cmd('clip.set_parent', 'Parentage : lier la transformation d\'un clip à un parent (ou null)', 'Set parent', args({ id: S.str('Clip enfant'), parentId: { type: ['string', 'null'], description: 'Parent (null pour délier)' } }, ['id']), (ctx, a) => {
    const c = ctx.findClip(a.id);
    if (a.parentId) {
      let p = ctx.findClip(a.parentId);
      const seen = new Set([c.id]);
      while (p) { if (seen.has(p.id)) throw new CommandError('Parentage cyclique interdit.'); seen.add(p.id); p = p.parentId ? ctx.findClip(p.parentId) : null; }
    }
    c.parentId = a.parentId || null;
    return { id: c.id, parentId: c.parentId };
  }, { mutates: true }),

  cmd('clip.precompose', 'Précomposer des clips dans un groupe (composition imbriquée)', 'Precompose clips', args({ ids: S.ids(), name: S.str('Nom de la précomposition') }), (ctx, a) => {
    const ids = selectedOr(ctx, a.ids);
    const clips = ids.map((id) => ctx.findClip(id));
    clips.forEach((c) => requireUnlocked(ctx, c));
    const t0 = Math.min(...clips.map((c) => c.start));
    const t1 = Math.max(...clips.map((c) => c.start + c.duration));
    const trackIds = [...new Set(clips.map((c) => c.trackId))];
    const tracks = trackIds.map((id) => deepClone(ctx.findTrack(id))).sort((x, y) => x.order - y.order).map((t, i) => ({ ...t, order: i }));
    const inner = clips.map((c) => ({ ...deepClone(c), start: c.start - t0, parentId: ids.includes(c.parentId) ? c.parentId : null }));
    const topTrack = [...ctx.project.tracks].sort((x, y) => x.order - y.order).find((t) => trackIds.includes(t.id));
    ctx.project.clips = ctx.project.clips.filter((c) => !ids.includes(c.id));
    const g = makeClip(ctx.project, { kind: 'group', start: t0, duration: t1 - t0, name: a.name || 'Précomposition', props: { tracks, clips: inner, width: ctx.project.meta.width, height: ctx.project.meta.height } });
    g.trackId = topTrack.id;
    ctx.project.clips.push(g);
    ctx.setApp({ selection: [g.id] });
    return { id: g.id, contains: ids };
  }, { mutates: true, shortcut: 'Ctrl+Shift+C' }),

  cmd('clip.group', 'Grouper des clips (crée une précomposition)', 'Group clips', args({ ids: S.ids(), name: S.str('Nom du groupe') }), (ctx, a) => ctx.call('clip.precompose', { ids: a.ids, name: a.name || 'Groupe' }), { mutates: true, shortcut: 'Ctrl+G' }),

  cmd('clip.ungroup', 'Dégrouper / extraire le contenu d\'une précomposition', 'Ungroup', args({ id: S.str('Clip groupe') }), (ctx, a) => {
    const g = ctx.findClip(a.id || ctx.app.selection[0]);
    if (g.kind !== 'group') throw new CommandError('Ce clip n\'est pas un groupe.');
    const gt = ctx.findTrack(g.trackId);
    const map = {};
    const innerTracks = [...(g.props.tracks || [])].sort((x, y) => x.order - y.order);
    innerTracks.forEach((t, i) => { const nt = createTrack(ctx.project, t.type, { name: t.name, index: gt.order + i }); map[t.id] = nt.id; });
    const out = [];
    for (const c of g.props.clips || []) {
      const nc = normalizeClip({ ...deepClone(c), start: c.start + g.start, trackId: map[c.trackId] || g.trackId });
      ctx.project.clips.push(nc);
      out.push(nc.id);
    }
    ctx.project.clips = ctx.project.clips.filter((c) => c.id !== g.id);
    normalizeOrders(ctx.project);
    ctx.setApp({ selection: out });
    return { extracted: out };
  }, { mutates: true, shortcut: 'Ctrl+Shift+G' }),

  cmd('clip.align', 'Aligner des clips dans le cadre (gauche, centre, droite, haut, milieu, bas)', 'Align clips', args({ ids: S.ids(), to: S.enm('Alignement', ['left', 'center', 'right', 'top', 'middle', 'bottom']), relative: S.enm('Référence', ['comp', 'selection']) }, ['to']), (ctx, a) => {
    const ids = selectedOr(ctx, a.ids);
    const clips = ids.map((id) => ctx.findClip(id));
    const W = ctx.project.meta.width, H = ctx.project.meta.height;
    const boxes = clips.map((c) => bbox(ctx, c));
    const rel = a.relative || (ids.length > 1 ? 'selection' : 'comp');
    const ref = rel === 'comp' ? { x0: -W / 2, x1: W / 2, y0: -H / 2, y1: H / 2 } : { x0: Math.min(...boxes.map((b) => b.x0)), x1: Math.max(...boxes.map((b) => b.x1)), y0: Math.min(...boxes.map((b) => b.y0)), y1: Math.max(...boxes.map((b) => b.y1)) };
    clips.forEach((c, i) => {
      const b = boxes[i];
      let dx = 0, dy = 0;
      if (a.to === 'left') dx = ref.x0 - b.x0;
      if (a.to === 'right') dx = ref.x1 - b.x1;
      if (a.to === 'center') dx = (ref.x0 + ref.x1) / 2 - b.cx;
      if (a.to === 'top') dy = ref.y0 - b.y0;
      if (a.to === 'bottom') dy = ref.y1 - b.y1;
      if (a.to === 'middle') dy = (ref.y0 + ref.y1) / 2 - b.cy;
      if (dx) setAnimatable(ctx, c, 'transform.x', c.transform.x + dx);
      if (dy) setAnimatable(ctx, c, 'transform.y', c.transform.y + dy);
    });
    return { ids, to: a.to };
  }, { mutates: true }),

  cmd('clip.distribute', 'Répartir des clips uniformément (x, y ou dans le temps)', 'Distribute clips', args({ ids: S.ids(), axis: S.enm('Axe', ['x', 'y', 'time']), gap: S.num('Écart fixe (optionnel)') }, ['axis']), (ctx, a) => {
    const ids = selectedOr(ctx, a.ids);
    if (ids.length < 2) throw new CommandError('Sélectionnez au moins 2 clips.');
    const clips = ids.map((id) => ctx.findClip(id));
    if (a.axis === 'time') {
      clips.sort((x, y) => x.start - y.start);
      let t = clips[0].start;
      const total = clips[clips.length - 1].start + clips[clips.length - 1].duration - t;
      const sum = clips.reduce((s, c) => s + c.duration, 0);
      const gap = a.gap ?? Math.max(0, (total - sum) / (clips.length - 1));
      for (const c of clips) { c.start = t; t += c.duration + gap; }
    } else {
      const key = a.axis === 'x' ? 'cx' : 'cy';
      const boxes = clips.map((c) => ({ c, b: bbox(ctx, c) })).sort((x, y) => x.b[key] - y.b[key]);
      const first = boxes[0].b[key], last = boxes[boxes.length - 1].b[key];
      boxes.forEach(({ c, b }, i) => {
        const target = a.gap !== undefined ? first + i * a.gap : first + ((last - first) * i) / (boxes.length - 1);
        setAnimatable(ctx, c, `transform.${a.axis}`, c.transform[a.axis] + (target - b[key]));
      });
    }
    return { ids, axis: a.axis };
  }, { mutates: true }),

  cmd('clip.set_transform', 'Transformation : x, y (relatifs au centre), z, échelle, rotation, rotations 3D, skew, ancre, opacité — crée des keyframes si animé', 'Set transform', args({
    id: S.str('Clip'), ids: S.ids('Plusieurs clips'), x: S.num('X (px depuis le centre)'), y: S.num('Y (px depuis le centre)'), z: S.num('Z (profondeur caméra)'), scale: S.num('Échelle'), scaleX: S.num('Échelle X'), scaleY: S.num('Échelle Y'),
    rotation: S.num('Rotation (°)'), rotationX: S.num('Rotation X 3D (°)'), rotationY: S.num('Rotation Y 3D (°)'), skewX: S.num('Inclinaison X (°)'), skewY: S.num('Inclinaison Y (°)'), anchorX: S.num('Ancre X (0-1)'), anchorY: S.num('Ancre Y (0-1)'), opacity: S.num('Opacité (0-1)', { minimum: 0, maximum: 1 }), relative: S.bool('Valeurs relatives (ajoutées)'),
  }), (ctx, a) => {
    const ids = a.ids?.length ? a.ids : [a.id || ctx.app.selection[0]];
    if (!ids[0]) throw new CommandError('Aucun clip.');
    for (const id of ids) {
      const c = ctx.findClip(id);
      requireUnlocked(ctx, c);
      for (const k of ['x', 'y', 'z', 'scale', 'scaleX', 'scaleY', 'rotation', 'rotationX', 'rotationY', 'skewX', 'skewY', 'anchorX', 'anchorY', 'opacity']) {
        if (a[k] === undefined) continue;
        const cur = c.keyframes[`transform.${k}`]?.length ? evalKeys(c.keyframes[`transform.${k}`], ctx.app.time - c.start) : c.transform[k];
        setAnimatable(ctx, c, `transform.${k}`, a.relative ? cur + a[k] : a[k]);
      }
    }
    return { ids };
  }, { mutates: true }),

  cmd('clip.nudge', 'Décaler la position de clips de quelques pixels', 'Nudge clips', args({ ids: S.ids(), dx: S.num('Δx'), dy: S.num('Δy') }), (ctx, a) => ctx.call('clip.set_transform', { ids: selectedOr(ctx, a.ids), x: a.dx || 0, y: a.dy || 0, relative: true }), { mutates: true }),

  cmd('clip.set_text', 'Modifier le texte (et éventuellement le style) d\'un clip texte', 'Set text', args({ id: S.str('Clip'), text: S.str('Texte'), style: S.obj('Style (fontFamily, fontSize, color…)') }, ['text']), (ctx, a) => {
    const c = ctx.findClip(a.id || ctx.app.selection[0]);
    if (!['text', 'ui', 'code'].includes(c.kind)) throw new CommandError('Ce clip n\'est pas un texte.');
    if (c.kind === 'text') c.props.text = a.text; else if (c.kind === 'ui') c.props.title = a.text; else c.props.code = a.text;
    if (a.style) c.props = deepMerge(c.props, a.style);
    if (c.kind === 'text') c.name = a.text.split('\n')[0].slice(0, 24) || c.name;
    return { id: c.id };
  }, { mutates: true }),

  cmd('clip.set_style', 'Fusionner un style dans les props (couleurs, police, remplissage, contour, ombre…)', 'Set style', args({ id: S.str('Clip'), ids: S.ids(), style: S.obj('Props à fusionner') }, ['style']), (ctx, a) => {
    const ids = a.ids?.length ? a.ids : [a.id || ctx.app.selection[0]];
    for (const id of ids) { const c = ctx.findClip(id); requireUnlocked(ctx, c); c.props = deepMerge(c.props, a.style); }
    return { ids };
  }, { mutates: true }),

  cmd('clip.set_audio', 'Audio du clip : volume, fondus, muet, panoramique', 'Set clip audio', args({ id: S.str('Clip'), volume: S.num('Volume (0-2)', { minimum: 0, maximum: 4 }), fadeIn: S.num('Fondu entrée (s)', { minimum: 0 }), fadeOut: S.num('Fondu sortie (s)', { minimum: 0 }), muted: S.bool('Muet'), pan: S.num('Panoramique (-1..1)', { minimum: -1, maximum: 1 }) }, ['id']), (ctx, a) => {
    const c = ctx.findClip(a.id);
    if (!['audio', 'video'].includes(c.kind)) throw new CommandError('Ce clip n\'a pas d\'audio.');
    if (a.volume !== undefined) setAnimatable(ctx, c, 'props.volume', a.volume);
    for (const k of ['fadeIn', 'fadeOut', 'muted', 'pan']) if (a[k] !== undefined) c.props[k] = a[k];
    return { id: c.id, volume: c.props.volume, fadeIn: c.props.fadeIn, fadeOut: c.props.fadeOut };
  }, { mutates: true }),

  cmd('clip.select', 'Sélectionner des clips (remplacer, ajouter, basculer, tout, aucun)', 'Select clips', args({ ids: S.ids(), mode: S.enm('Mode', ['set', 'add', 'toggle', 'remove', 'all', 'clear', 'at-playhead']) }), (ctx, a) => {
    let sel = [...ctx.app.selection];
    const ids = a.ids || [];
    for (const id of ids) ctx.findClip(id);
    switch (a.mode || 'set') {
      case 'add': sel = [...new Set([...sel, ...ids])]; break;
      case 'toggle': for (const id of ids) sel = sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]; break;
      case 'remove': sel = sel.filter((x) => !ids.includes(x)); break;
      case 'all': sel = ctx.project.clips.map((c) => c.id); break;
      case 'clear': sel = []; break;
      case 'at-playhead': sel = ctx.project.clips.filter((c) => isActiveAt(c, ctx.app.time)).map((c) => c.id); break;
      default: sel = ids;
    }
    ctx.setApp({ selection: sel, selectedKeyframes: [] });
    return { selection: sel };
  }, { history: false }),

  cmd('clip.list', 'Lister les clips (filtres : piste, instant, type)', 'List clips', args({ trackId: S.str('Piste'), at: S.num('Actifs à l\'instant t'), kind: S.str('Type') }), (ctx, a) => ctx.project.clips
    .filter((c) => (!a.trackId || c.trackId === a.trackId) && (a.at === undefined || isActiveAt(c, a.at)) && (!a.kind || c.kind === a.kind))
    .sort((x, y) => x.start - y.start)
    .map((c) => ({ id: c.id, name: c.name, kind: c.kind, trackId: c.trackId, start: c.start, duration: c.duration, effects: c.effects.map((e) => e.type), animated: Object.keys(c.keyframes), parentId: c.parentId, blendMode: c.blendMode }))),

  cmd('clip.get', 'Obtenir le JSON complet d\'un clip (option : valeurs résolues à t)', 'Get clip JSON', args({ id: S.str('Clip'), t: S.num('Résoudre les valeurs animées à cet instant') }, ['id']), (ctx, a) => {
    const c = ctx.findClip(a.id);
    if (a.t !== undefined) { const r = resolveClip(c, a.t, { comp: ctx.project.meta }); return { clip: deepClone(c), resolved: { transform: r.transform, props: r.props, effects: r.effects } }; }
    return deepClone(c);
  }),

  cmd('clip.lock', 'Verrouiller / déverrouiller des clips', 'Lock clips', args({ ids: S.ids(), locked: S.bool('Verrouillé') }), (ctx, a) => {
    const ids = selectedOr(ctx, a.ids);
    for (const id of ids) { const c = ctx.findClip(id); c.locked = a.locked ?? !c.locked; }
    return { ids };
  }, { mutates: true }),

  cmd('clip.rename', 'Renommer un clip', 'Rename clip', args({ id: S.str('Clip'), name: S.str('Nom', { minLength: 1 }) }, ['id', 'name']), (ctx, a) => { ctx.findClip(a.id).name = a.name; return { id: a.id, name: a.name }; }, { mutates: true }),

  cmd('clip.set_color', 'Couleur d\'étiquette d\'un clip dans la timeline', 'Set clip label color', args({ ids: S.ids(), color: S.str('Couleur') }, ['color']), (ctx, a) => { for (const id of selectedOr(ctx, a.ids)) ctx.findClip(id).color = a.color; return { color: a.color }; }, { mutates: true }),

  cmd('clip.kinds', 'Lister les types d\'éléments et la bibliothèque (avec propriétés par défaut)', 'List element kinds & library', args({ category: S.str('Catégorie') }), (ctx, a) => ({
    kinds: CLIP_KINDS,
    library: LIBRARY.filter((l) => !a.category || l.category === a.category).map((l) => ({ id: l.id, name: l.name, kind: l.kind, category: l.category })),
    defaults: Object.fromEntries(CLIP_KINDS.map((k) => [k, makeClip(ctx.project, { kind: k }).props])),
  })),
];
