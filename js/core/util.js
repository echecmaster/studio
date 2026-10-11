// Utilitaires partagés (sans DOM : utilisables côté navigateur et côté Netlify Functions)

let _uidCounter = 0;
export function uid(prefix = 'id') {
  _uidCounter = (_uidCounter + 1) % 1e6;
  const r = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36).slice(-5)}${r}${_uidCounter.toString(36)}`;
}

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export function deepClone(v) {
  if (typeof structuredClone === 'function') return structuredClone(v);
  return JSON.parse(JSON.stringify(v));
}

export function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!deepEqual(a[k], b[k])) return false;
  return true;
}

export function deepMerge(target, src) {
  if (!isObj(src)) return src === undefined ? target : deepClone(src);
  const out = isObj(target) ? { ...target } : {};
  for (const [k, v] of Object.entries(src)) {
    if (isObj(v) && isObj(out[k])) out[k] = deepMerge(out[k], v);
    else out[k] = v === undefined ? out[k] : deepClone(v);
  }
  return out;
}

// Chemins de propriétés : "transform.x", "props.fill.color", "effects.<id>.params.amount"
// Un segment appliqué à un tableau cherche d'abord un élément avec cet id, puis un index numérique.
export function splitPath(path) {
  return Array.isArray(path) ? path : String(path).split('.').filter(Boolean);
}

function stepInto(cur, seg) {
  if (cur == null) return undefined;
  if (Array.isArray(cur)) {
    const byId = cur.find((e) => e && e.id === seg);
    if (byId) return byId;
    const i = Number(seg);
    return Number.isInteger(i) ? cur[i] : undefined;
  }
  return cur[seg];
}

export function getPath(obj, path) {
  let cur = obj;
  for (const seg of splitPath(path)) {
    cur = stepInto(cur, seg);
    if (cur === undefined) return undefined;
  }
  return cur;
}

export function setPath(obj, path, value) {
  const segs = splitPath(path);
  let cur = obj;
  for (let i = 0; i < segs.length - 1; i++) {
    const seg = segs[i];
    let next = stepInto(cur, seg);
    if (next === undefined || next === null || typeof next !== 'object') {
      if (Array.isArray(cur)) throw new Error(`Chemin invalide : ${segs.slice(0, i + 1).join('.')}`);
      next = /^\d+$/.test(segs[i + 1]) ? [] : {};
      cur[seg] = next;
    }
    cur = next;
  }
  const last = segs[segs.length - 1];
  if (Array.isArray(cur)) {
    const idx = cur.findIndex((e) => e && e.id === last);
    if (idx >= 0) cur[idx] = value;
    else cur[Number(last)] = value;
  } else cur[last] = value;
  return obj;
}

export function deletePath(obj, path) {
  const segs = splitPath(path);
  const parent = segs.length > 1 ? getPath(obj, segs.slice(0, -1)) : obj;
  if (parent == null) return;
  const last = segs[segs.length - 1];
  if (Array.isArray(parent)) {
    const idx = parent.findIndex((e) => e && e.id === last);
    parent.splice(idx >= 0 ? idx : Number(last), 1);
  } else delete parent[last];
}

// ---------- Couleurs ----------
export function hexToRgb(hex) {
  if (Array.isArray(hex)) return hex.slice(0, 3);
  let h = String(hex || '#000').trim();
  if (h.startsWith('rgb')) {
    const m = h.match(/[\d.]+/g) || [0, 0, 0];
    return [m[0] / 255, m[1] / 255, m[2] / 255];
  }
  h = h.replace('#', '');
  if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16) || 0;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
export function hexAlpha(hex) {
  const h = String(hex || '').replace('#', '');
  if (h.length === 8) return parseInt(h.slice(6, 8), 16) / 255;
  if (h.length === 4) return parseInt(h[3] + h[3], 16) / 255;
  return 1;
}
export function rgbToHex(r, g, b) {
  const c = (v) => clamp(Math.round(v * 255), 0, 255).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
export function isColor(v) {
  return typeof v === 'string' && /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v);
}
export function lerpColor(a, b, t) {
  const ca = hexToRgb(a), cb = hexToRgb(b);
  const aa = hexAlpha(a), ab = hexAlpha(b);
  const base = rgbToHex(lerp(ca[0], cb[0], t), lerp(ca[1], cb[1], t), lerp(ca[2], cb[2], t));
  if (aa === 1 && ab === 1) return base;
  return base + clamp(Math.round(lerp(aa, ab, t) * 255), 0, 255).toString(16).padStart(2, '0');
}
export function hsl(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  const f = (n) => {
    const k = (n + h * 12) % 12;
    return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return rgbToHex(f(0), f(8), f(4));
}

// ---------- Interpolation générique ----------
export function lerpValue(a, b, t) {
  if (typeof a === 'number' && typeof b === 'number') return lerp(a, b, t);
  if (isColor(a) && isColor(b)) return lerpColor(a, b, t);
  if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) return a.map((v, i) => lerpValue(v, b[i], t));
  if (isObj(a) && isObj(b)) {
    const out = {};
    for (const k of Object.keys(a)) out[k] = k in b ? lerpValue(a[k], b[k], t) : a[k];
    return out;
  }
  return t < 1 ? a : b;
}

// ---------- Temps ----------
export function formatTimecode(sec, fps = 30) {
  sec = Math.max(0, sec || 0);
  const totalFrames = Math.round(sec * fps);
  const f = totalFrames % fps;
  const s = Math.floor(totalFrames / fps);
  const p = (n, l = 2) => String(n).padStart(l, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}:${p(f)}`;
}
export function parseTimecode(str, fps = 30) {
  if (typeof str === 'number') return str;
  const s = String(str).trim();
  if (/^[\d.]+s?$/.test(s)) return parseFloat(s);
  const parts = s.split(':').map(Number);
  while (parts.length < 4) parts.unshift(0);
  const [h, m, sec, f] = parts;
  return h * 3600 + m * 60 + sec + f / fps;
}
export const snapToFrame = (t, fps) => Math.round(t * fps) / fps;

// ---------- Aléatoire déterministe ----------
export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function rand1(seed, i) {
  // hash rapide 1D déterministe -> [0,1)
  let x = Math.sin((seed * 12.9898 + i * 78.233) % 6283.185) * 43758.5453;
  return x - Math.floor(x);
}
// bruit de valeur 1D lissé (déterministe)
export function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(rand1(seed, i), rand1(seed, i + 1), u) * 2 - 1;
}
export function fbm1(x, seed = 0, oct = 3) {
  let v = 0, a = 0.5, fr = 1;
  for (let o = 0; o < oct; o++) { v += a * noise1(x * fr, seed + o * 17); fr *= 2; a *= 0.5; }
  return v;
}

export function debounce(fn, ms) {
  let id;
  return (...a) => { clearTimeout(id); id = setTimeout(() => fn(...a), ms); };
}

export function bytesToHuman(n) {
  if (!n && n !== 0) return '?';
  const u = ['o', 'Ko', 'Mo', 'Go'];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(i ? 1 : 0)} ${u[i]}`;
}

export function slug(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'projet';
}

// Diff / patch JSON (utilisé pour l'historique : chaque commande stocke son patch et son inverse)
export function diff(a, b, path = [], out = []) {
  if (a === b) return out;
  if (isObj(a) && isObj(b)) {
    for (const k of Object.keys(a)) {
      if (!(k in b)) out.push({ op: 'del', path: [...path, k] });
      else diff(a[k], b[k], [...path, k], out);
    }
    for (const k of Object.keys(b)) if (!(k in a)) out.push({ op: 'set', path: [...path, k], value: deepClone(b[k]) });
    return out;
  }
  if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) {
    for (let i = 0; i < a.length; i++) diff(a[i], b[i], [...path, i], out);
    return out;
  }
  if (!deepEqual(a, b)) out.push({ op: 'set', path, value: deepClone(b) });
  return out;
}
export function applyPatch(obj, patches) {
  let root = obj;
  for (const p of patches) {
    if (p.path.length === 0) { root = p.op === 'del' ? undefined : deepClone(p.value); continue; }
    let cur = root;
    for (let i = 0; i < p.path.length - 1; i++) {
      if (cur[p.path[i]] === undefined) cur[p.path[i]] = typeof p.path[i + 1] === 'number' ? [] : {};
      cur = cur[p.path[i]];
    }
    const last = p.path[p.path.length - 1];
    if (p.op === 'del') { if (Array.isArray(cur)) cur.splice(last, 1); else delete cur[last]; }
    else cur[last] = deepClone(p.value);
  }
  return root;
}
