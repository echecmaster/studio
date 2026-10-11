// Aides partagées par les commandes (schémas d'arguments, fabrication de clips, pistes…)
import { uid, deepClone, deepMerge } from '../util.js';
import { normalizeClip, defaultTransform } from '../schema.js';
import { defaultProps, defaultDuration } from '../../catalog/elements.js';
import { CommandError } from '../commandBus.js';

// ---- mini-DSL de schémas d'arguments ----
export const S = {
  str: (description, extra = {}) => ({ type: 'string', description, ...extra }),
  num: (description, extra = {}) => ({ type: 'number', description, ...extra }),
  int: (description, extra = {}) => ({ type: 'integer', description, ...extra }),
  bool: (description) => ({ type: 'boolean', description }),
  obj: (description, properties = {}, extra = {}) => ({ type: 'object', description, properties, ...extra }),
  arr: (description, items = {}, extra = {}) => ({ type: 'array', description, items, ...extra }),
  any: (description) => ({ description }),
  enm: (description, values) => ({ type: 'string', enum: values, description }),
  ids: (description = 'Identifiants de clips') => ({ type: 'array', items: { type: 'string' }, description }),
};
export const args = (properties, required = []) => ({ type: 'object', properties, required });

export const cmd = (name, fr, en, a, run, extra = {}) => ({
  name,
  title: { fr: fr.split(/ — | : | \(/)[0], en: en.split(/ — | : | \(/)[0] },
  description: { fr, en },
  args: a || args({}),
  run,
  ...extra,
});

export function trackTypeForKind(kind) {
  if (kind === 'text') return 'text';
  if (kind === 'audio') return 'audio';
  if (kind === 'adjustment') return 'adjustment';
  if (kind === 'camera') return 'camera';
  if (['null', 'light'].includes(kind)) return 'effect';
  if (['shape', 'ui', 'chart', 'counter', 'progress', 'clock', 'code', '3d', 'mockup'].includes(kind)) return 'shape';
  return 'video';
}

const TRACK_COLORS = { video: '#3D8BFF', audio: '#E0A526', text: '#24D26D', shape: '#B05CFF', effect: '#FF7A45', adjustment: '#8A8A8A', camera: '#3DD6D0' };
const TRACK_NAMES = { video: 'Vidéo', audio: 'Audio', text: 'Texte', shape: 'Formes', effect: 'Effets', adjustment: 'Ajustement', camera: 'Caméra' };

export function normalizeOrders(project) {
  project.tracks.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).forEach((t, i) => { t.order = i; });
}

export function createTrack(project, type, { name, index } = {}) {
  const count = project.tracks.filter((t) => t.type === type).length + 1;
  const tr = { id: uid('trk'), type, name: name || `${TRACK_NAMES[type] || 'Piste'} ${count}`, locked: false, muted: false, solo: false, hidden: false, order: 0, color: TRACK_COLORS[type] || '#24D26D', height: 48, groupId: null, collapsed: false };
  normalizeOrders(project);
  // les pistes audio vont en bas par défaut, les autres en haut
  const idx = index ?? (type === 'audio' ? project.tracks.length : 0);
  for (const t of project.tracks) if (t.order >= idx) t.order++;
  tr.order = idx;
  project.tracks.push(tr);
  normalizeOrders(project);
  return tr;
}

export function trackHasRoom(project, trackId, start, duration, ignoreIds = []) {
  return !project.clips.some((c) => c.trackId === trackId && !ignoreIds.includes(c.id) && c.start < start + duration - 1e-6 && c.start + c.duration > start + 1e-6);
}

export function pickTrack(project, kind, start, duration) {
  const type = trackTypeForKind(kind);
  const candidates = project.tracks.filter((t) => t.type === type && !t.locked).sort((a, b) => a.order - b.order);
  for (const t of candidates) if (trackHasRoom(project, t.id, start, duration)) return t;
  return createTrack(project, type);
}

export function makeClip(project, a) {
  const comp = project.meta;
  const kind = a.kind;
  let props = defaultProps(kind, a.opts || a.props || {}, comp);
  if (a.props) props = deepMerge(props, a.props);
  const duration = a.duration ?? Math.min(defaultDuration(kind), Math.max(0.1, comp.duration - (a.start ?? 0)) || defaultDuration(kind));
  const clip = normalizeClip({
    id: a.id || uid('clp'),
    trackId: a.trackId,
    kind,
    name: a.name || defaultName(kind, props),
    start: Math.max(0, a.start ?? 0),
    duration: Math.max(1 / comp.fps, duration),
    transform: { ...defaultTransform(), ...(a.transform || {}) },
    props,
    effects: a.effects || [],
    blendMode: a.blendMode || 'normal',
    keyframes: a.keyframes || {},
    expressions: a.expressions || {},
    transitionIn: a.transitionIn || null,
    transitionOut: a.transitionOut || null,
    parentId: a.parentId || null,
    masks: a.masks || [],
  });
  return clip;
}

export function defaultName(kind, props) {
  if (kind === 'text') return String(props.text || 'Texte').split('\n')[0].slice(0, 24);
  const map = { shape: `Forme (${props.shape})`, generator: `Générateur (${props.type})`, particles: `Particules (${props.preset})`, ui: `UI (${props.template})`, chart: `Graphique (${props.chartType})`, '3d': `3D (${props.primitive})`, shader: 'Shader', adjustment: 'Ajustement', null: 'Nul', camera: 'Caméra', light: 'Lumière', counter: 'Compteur', progress: 'Progression', clock: 'Horloge', code: 'Code', audioviz: 'Visualiseur audio', mockup: `Mockup (${props.device})`, group: 'Groupe' };
  return map[kind] || kind;
}

export function requireUnlocked(ctx, clip) {
  const tr = ctx.project.tracks.find((t) => t.id === clip.trackId);
  if (clip.locked) throw new CommandError(`Le clip "${clip.name}" est verrouillé.`);
  if (tr?.locked) throw new CommandError(`La piste "${tr.name}" est verrouillée.`);
}

export function selectedOr(ctx, ids) {
  const list = ids && ids.length ? ids : ctx.app.selection;
  if (!list || !list.length) throw new CommandError('Aucun clip spécifié ni sélectionné.');
  return list;
}

export function extendDurationIfNeeded(project) {
  const end = project.clips.reduce((m, c) => Math.max(m, c.start + c.duration), 0);
  return end;
}

// estimation de la taille d'un clip (sans DOM) : utilisée par l'alignement et le lint côté serveur
export function estimateSize(clip, project) {
  const p = clip.props || {};
  switch (clip.kind) {
    case 'text': {
      const lines = String(p.text || '').split('\n');
      const w = Math.max(...lines.map((l) => l.length)) * p.fontSize * 0.56 + (lines[0]?.length || 0) * (p.letterSpacing || 0);
      return { w: p.maxWidth ? Math.min(w, p.maxWidth) : w, h: lines.length * p.fontSize * (p.lineHeight || 1.2) };
    }
    case 'shape': return { w: p.width || 1, h: Math.max(p.height || 1, p.stroke?.width || 1) };
    case 'image': case 'video': case 'svg': case 'lottie': {
      const a = project.assets.find((x) => x.id === p.assetId);
      const nw = p.width || a?.meta?.width || project.meta.width;
      const nh = p.height || a?.meta?.height || project.meta.height;
      return { w: nw, h: nh };
    }
    case 'counter': return { w: String(p.to).length * p.fontSize * 0.62, h: p.fontSize * 1.2 };
    case 'progress': return p.style === 'ring' ? { w: p.width / 3, h: p.width / 3 } : { w: p.width, h: p.height + (p.showLabel ? p.fontSize * 1.6 : 0) };
    case 'clock': return { w: p.size, h: p.style === 'digital' ? p.size * 0.35 : p.size };
    case 'ui': return { w: p.width, h: p.template === 'banner' ? 140 : p.template === 'title' ? 300 : 160 };
    case '3d': return { w: p.size * 1.8, h: p.size * 1.8 };
    case 'mockup': return { w: p.width, h: p.device === 'phone' ? p.width * 2.05 : p.width * 0.66 };
    case 'code': return { w: p.width, h: (String(p.code).split('\n').length + 2) * p.fontSize * 1.5 };
    case 'chart': case 'audioviz': return { w: p.width, h: p.height };
    case 'light': return { w: p.radius * 2, h: p.radius * 2 };
    default: return { w: p.width || project.meta.width, h: p.height || project.meta.height };
  }
}

export function shiftKeyframes(clip, dt) {
  for (const [path, keys] of Object.entries(clip.keyframes || {})) {
    clip.keyframes[path] = keys.map((k) => ({ ...k, t: +(k.t + dt).toFixed(5) })).filter((k) => k.t >= -1e-6 && k.t <= clip.duration + 1e-6);
    if (!clip.keyframes[path].length) delete clip.keyframes[path];
  }
}

export function cloneClipWithNewIds(clip) {
  const c = deepClone(clip);
  c.id = uid('clp');
  const idMap = {};
  c.effects = (c.effects || []).map((e) => { const nid = uid('fx'); idMap[e.id] = nid; return { ...e, id: nid }; });
  const kf = {};
  for (const [path, keys] of Object.entries(c.keyframes || {})) {
    let p = path;
    for (const [o, nn] of Object.entries(idMap)) p = p.replace(`effects.${o}.`, `effects.${nn}.`);
    kf[p] = keys;
  }
  c.keyframes = kf;
  c.masks = (c.masks || []).map((m) => ({ ...m, id: uid('msk') }));
  if (c.kind === 'group' && c.props?.clips) c.props.clips = c.props.clips.map(cloneClipWithNewIds);
  return c;
}
