// Schéma du projet (JSON Schema) + mini-validateur JSON Schema (sous-ensemble draft-07)
import { uid, isObj, deepClone } from './util.js';

export const CLIP_KINDS = [
  'shape', 'text', 'image', 'video', 'audio', 'svg', 'lottie', 'particles', 'generator', 'shader', 'group',
  'adjustment', 'null', 'camera', 'light', '3d', 'chart', 'code', 'counter', 'progress', 'clock', 'ui', 'audioviz', 'mockup',
];
export const TRACK_TYPES = ['video', 'audio', 'text', 'shape', 'effect', 'adjustment', 'camera'];
export const ASSET_TYPES = ['image', 'video', 'audio', 'font', 'svg', 'lottie', 'lut', '3d', 'json', 'csv'];

const transformSchema = {
  type: 'object',
  properties: {
    x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' },
    scale: { type: 'number' }, scaleX: { type: 'number' }, scaleY: { type: 'number' },
    rotation: { type: 'number' }, rotationX: { type: 'number' }, rotationY: { type: 'number' },
    skewX: { type: 'number' }, skewY: { type: 'number' },
    anchorX: { type: 'number' }, anchorY: { type: 'number' },
    opacity: { type: 'number', minimum: 0, maximum: 1 },
  },
};

const keyframeSchema = {
  type: 'object',
  required: ['t'],
  properties: {
    t: { type: 'number', minimum: 0 },
    v: {},
    easing: { type: 'string' },
    bezier: { type: 'array', items: { type: 'number' }, minItems: 4, maxItems: 4 },
    hold: { type: 'boolean' },
    spring: { type: 'object' },
  },
};

const transitionSchema = {
  type: ['object', 'null'],
  properties: { type: { type: 'string' }, duration: { type: 'number', minimum: 0 }, easing: { type: 'string' }, params: { type: 'object' } },
};

export const clipSchema = {
  type: 'object',
  required: ['id', 'trackId', 'kind', 'start', 'duration'],
  properties: {
    id: { type: 'string', minLength: 1 },
    trackId: { type: 'string', minLength: 1 },
    kind: { type: 'string', enum: CLIP_KINDS },
    name: { type: 'string' },
    start: { type: 'number', minimum: 0 },
    duration: { type: 'number', exclusiveMinimum: 0 },
    inPoint: { type: 'number', minimum: 0 },
    speed: { type: 'number', minimum: 0.01, maximum: 100 },
    reverse: { type: 'boolean' },
    transform: transformSchema,
    props: { type: 'object' },
    effects: { type: 'array', items: { type: 'object', required: ['id', 'type'], properties: { id: { type: 'string' }, type: { type: 'string' }, enabled: { type: 'boolean' }, params: { type: 'object' } } } },
    masks: { type: 'array', items: { type: 'object' } },
    matte: { type: ['object', 'null'] },
    blendMode: { type: 'string' },
    parentId: { type: ['string', 'null'] },
    keyframes: { type: 'object', additionalProperties: { type: 'array', items: keyframeSchema } },
    expressions: { type: 'object', additionalProperties: { type: 'string' } },
    audioLinks: { type: 'object' },
    timeRemap: { type: ['object', 'null'] },
    transitionIn: transitionSchema,
    transitionOut: transitionSchema,
    locked: { type: 'boolean' },
    color: { type: 'string' },
  },
};

export const projectSchema = {
  $id: 'motion://docs/schema',
  title: 'Motion Studio Project',
  type: 'object',
  required: ['version', 'meta', 'assets', 'tracks', 'clips', 'markers', 'workArea'],
  properties: {
    version: { type: 'integer', const: 1 },
    id: { type: 'string' },
    meta: {
      type: 'object',
      required: ['name', 'width', 'height', 'fps', 'duration'],
      properties: {
        name: { type: 'string' },
        width: { type: 'integer', minimum: 16, maximum: 7680 },
        height: { type: 'integer', minimum: 16, maximum: 7680 },
        fps: { type: 'number', minimum: 1, maximum: 120 },
        duration: { type: 'number', exclusiveMinimum: 0, maximum: 3600 },
        background: { type: 'string' },
        sampleRate: { type: 'integer' },
        motionBlur: { type: 'object' },
      },
    },
    assets: {
      type: 'array',
      items: {
        type: 'object', required: ['id', 'type', 'name'],
        properties: { id: { type: 'string' }, type: { type: 'string', enum: ASSET_TYPES }, name: { type: 'string' }, ref: { type: 'string' }, mime: { type: 'string' }, size: { type: 'number' }, meta: { type: 'object' } },
      },
    },
    tracks: {
      type: 'array',
      items: {
        type: 'object', required: ['id', 'type', 'name'],
        properties: {
          id: { type: 'string' }, type: { type: 'string', enum: TRACK_TYPES }, name: { type: 'string' },
          locked: { type: 'boolean' }, muted: { type: 'boolean' }, solo: { type: 'boolean' }, hidden: { type: 'boolean' },
          order: { type: 'number' }, color: { type: 'string' }, height: { type: 'number' }, groupId: { type: ['string', 'null'] }, collapsed: { type: 'boolean' },
        },
      },
    },
    clips: { type: 'array', items: clipSchema },
    markers: { type: 'array', items: { type: 'object', required: ['t'], properties: { id: { type: 'string' }, t: { type: 'number' }, label: { type: 'string' }, color: { type: 'string' } } } },
    workArea: { type: 'object', required: ['in', 'out'], properties: { in: { type: 'number', minimum: 0 }, out: { type: 'number', minimum: 0 } } },
    presets: { type: 'array' },
    luts: { type: 'array' },
  },
};

// ---------- Validateur JSON Schema minimal ----------
function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v;
}
function typeMatches(v, t) {
  const actual = typeOf(v);
  if (t === 'number') return actual === 'number' || actual === 'integer';
  return actual === t;
}

export function validate(schema, value, path = '$', errors = []) {
  if (!schema || errors.length > 50) return errors;
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => typeMatches(value, t))) {
      errors.push(`${path} : type attendu ${types.join('|')}, reçu ${typeOf(value)}`);
      return errors;
    }
  }
  if (schema.const !== undefined && value !== schema.const) errors.push(`${path} : doit valoir ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path} : valeur "${value}" hors de [${schema.enum.slice(0, 12).join(', ')}${schema.enum.length > 12 ? '…' : ''}]`);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) errors.push(`${path} : nombre non fini`);
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${path} : doit être ≥ ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${path} : doit être ≤ ${schema.maximum}`);
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) errors.push(`${path} : doit être > ${schema.exclusiveMinimum}`);
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${path} : chaîne trop courte`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(`${path} : chaîne trop longue (max ${schema.maxLength})`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${path} : au moins ${schema.minItems} éléments`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${path} : au plus ${schema.maxItems} éléments`);
    if (schema.items) value.forEach((v, i) => validate(schema.items, v, `${path}[${i}]`, errors));
  }
  if (isObj(value)) {
    for (const r of schema.required || []) if (value[r] === undefined) errors.push(`${path}.${r} : requis`);
    for (const [k, v] of Object.entries(value)) {
      if (schema.properties && schema.properties[k]) validate(schema.properties[k], v, `${path}.${k}`, errors);
      else if (schema.additionalProperties === false) errors.push(`${path}.${k} : propriété inconnue`);
      else if (isObj(schema.additionalProperties)) validate(schema.additionalProperties, v, `${path}.${k}`, errors);
    }
  }
  if (schema.oneOf) {
    const ok = schema.oneOf.filter((s) => validate(s, value, path, []).length === 0).length;
    if (ok !== 1) errors.push(`${path} : ne correspond à aucune variante attendue`);
  }
  return errors;
}

export function validateProject(project) {
  const errors = validate(projectSchema, project);
  if (errors.length === 0) {
    const trackIds = new Set(project.tracks.map((t) => t.id));
    const clipIds = new Set();
    for (const c of project.clips) {
      if (clipIds.has(c.id)) errors.push(`clip ${c.id} : id dupliqué`);
      clipIds.add(c.id);
      if (!trackIds.has(c.trackId)) errors.push(`clip ${c.id} : piste ${c.trackId} introuvable`);
    }
    for (const c of project.clips) if (c.parentId && !clipIds.has(c.parentId)) errors.push(`clip ${c.id} : parent ${c.parentId} introuvable`);
    if (project.workArea.out < project.workArea.in) errors.push('workArea : out < in');
  }
  return { ok: errors.length === 0, errors };
}

// ---------- Fabriques ----------
export function defaultTransform() {
  return { x: 0, y: 0, z: 0, scale: 1, scaleX: 1, scaleY: 1, rotation: 0, rotationX: 0, rotationY: 0, skewX: 0, skewY: 0, anchorX: 0.5, anchorY: 0.5, opacity: 1 };
}

export function createProject(opts = {}) {
  const meta = { name: 'Sans titre', width: 1920, height: 1080, fps: 30, duration: 10, background: '#000000', sampleRate: 48000, ...(opts.meta || {}) };
  const p = {
    version: 1,
    id: opts.id || uid('prj'),
    meta,
    assets: [],
    tracks: [],
    clips: [],
    markers: [],
    workArea: { in: 0, out: meta.duration },
    presets: [],
    luts: [],
  };
  if (opts.withTracks !== false) {
    p.tracks.push({ id: uid('trk'), type: 'text', name: 'Texte 1', locked: false, muted: false, solo: false, hidden: false, order: 0, color: '#24D26D', height: 48 });
    p.tracks.push({ id: uid('trk'), type: 'video', name: 'Vidéo 1', locked: false, muted: false, solo: false, hidden: false, order: 1, color: '#3D8BFF', height: 48 });
    p.tracks.push({ id: uid('trk'), type: 'audio', name: 'Audio 1', locked: false, muted: false, solo: false, hidden: false, order: 2, color: '#E0A526', height: 48 });
  }
  return p;
}

// Complète les champs facultatifs d'un clip (tolérant pour les projets écrits à la main par une IA)
export function normalizeClip(c) {
  const out = deepClone(c);
  out.inPoint ??= 0;
  out.speed ??= 1;
  out.reverse ??= false;
  out.transform = { ...defaultTransform(), ...(out.transform || {}) };
  out.props ??= {};
  out.effects = (out.effects || []).map((e) => ({ id: e.id || uid('fx'), enabled: e.enabled !== false, params: {}, ...e }));
  out.masks = (out.masks || []).map((m) => ({ id: m.id || uid('msk'), ...m }));
  out.matte ??= null;
  out.blendMode ??= 'normal';
  out.parentId ??= null;
  out.keyframes ??= {};
  out.expressions ??= {};
  out.audioLinks ??= {};
  out.timeRemap ??= null;
  out.transitionIn ??= null;
  out.transitionOut ??= null;
  out.name ??= out.kind;
  return out;
}

export function normalizeProject(p) {
  const out = deepClone(p);
  out.version = 1;
  out.id ??= uid('prj');
  out.meta = { name: 'Sans titre', width: 1920, height: 1080, fps: 30, duration: 10, background: '#000000', sampleRate: 48000, ...(out.meta || {}) };
  out.assets ??= [];
  out.tracks = (out.tracks || []).map((t, i) => ({ locked: false, muted: false, solo: false, hidden: false, order: i, height: 48, color: '#24D26D', ...t, id: t.id || uid('trk'), name: t.name || `Piste ${i + 1}`, type: t.type || 'video' }));
  out.clips = (out.clips || []).map((c) => normalizeClip({ ...c, id: c.id || uid('clp') }));
  out.markers = (out.markers || []).map((m) => ({ id: m.id || uid('mk'), label: '', color: '#24D26D', ...m }));
  out.workArea ??= { in: 0, out: out.meta.duration };
  out.presets ??= [];
  out.luts ??= [];
  return out;
}
