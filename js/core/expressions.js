// Moteur d'expressions JS sandboxé (synchrone, déterministe).
// Sandbox : portée fermée via Proxy (aucun accès aux globales), filtrage lexical des échappements connus
// (constructor, prototype, crochets, boucles, this, import…), résultats restreints à number/string/boolean/array de nombres.
import { noise1, fbm1, rand1, clamp, hashString } from './util.js';
import { getEasing } from '../catalog/easings.js';

const FORBIDDEN = /\b(constructor|__proto__|prototype|Function|eval|import|globalThis|window|self|document|fetch|XMLHttpRequest|setTimeout|setInterval|while|for|do|this|new|class|async|await|yield|Reflect|Proxy|Symbol|arguments|caller|callee|with|delete)\b|[[\]`\\]|=>|\bfunction\b/;

const cache = new Map();

export function checkExpression(code) {
  if (typeof code !== 'string' || !code.trim()) return 'Expression vide';
  if (code.length > 2000) return 'Expression trop longue (max 2000 caractères)';
  const m = code.match(FORBIDDEN);
  if (m) return `Jeton interdit dans l'expression : "${m[0]}"`;
  try { compile(code); } catch (e) { return `Erreur de syntaxe : ${e.message}`; }
  return null;
}

function compile(code) {
  if (cache.has(code)) return cache.get(code);
  const body = /\breturn\b/.test(code) ? code : `return (${code});`;
  // eslint-disable-next-line no-new-func
  const fn = new Function('__scope', `with(__scope){ ${body} }`);
  cache.set(code, fn);
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  return fn;
}

const MATH = {};
for (const k of ['abs', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2', 'sqrt', 'pow', 'exp', 'log', 'floor', 'ceil', 'round', 'min', 'max', 'sign', 'hypot', 'trunc']) MATH[k] = Math[k];
MATH.PI = Math.PI;
MATH.E = Math.E;

// ctx : { value, time, index, clip, comp:{width,height,duration,fps}, keys, layer(name), audio:{amplitude, band(i)} , seed }
export function runExpression(code, ctx) {
  const err = checkExpression(code);
  if (err) throw new Error(err);
  const fn = compile(code);
  const seed = ctx.seed ?? 1;
  const t = ctx.time;
  const keyAt = (tt) => (ctx.valueAtTime ? ctx.valueAtTime(tt) : ctx.value);
  const firstKey = ctx.keys?.[0]?.t ?? 0;
  const lastKey = ctx.keys?.[ctx.keys.length - 1]?.t ?? 0;
  const lib = {
    ...MATH,
    Math: MATH,
    value: ctx.value,
    time: t,
    index: ctx.index ?? 0,
    clamp,
    wiggle: (freq = 2, amp = 20, octaves = 1, octMult = 0.5, tt = t) => {
      let v = 0, a = 1, f = freq;
      for (let o = 0; o < octaves; o++) { v += noise1(tt * f, seed + o * 13) * a; a *= octMult; f *= 2; }
      if (Array.isArray(ctx.value)) return ctx.value.map((x, i) => x + noise1(tt * freq, seed + i * 31) * amp);
      return (typeof ctx.value === 'number' ? ctx.value : 0) + v * amp;
    },
    noise: (x) => fbm1(x, seed),
    random: (a, b) => {
      const r = rand1(seed, Math.floor(t * (ctx.comp?.fps || 30)));
      if (a === undefined) return r;
      if (b === undefined) return r * a;
      return a + r * (b - a);
    },
    seedRandom: () => 0,
    linear: (x, x0, x1, v0, v1) => {
      if (v0 === undefined) { v0 = x0; v1 = x1; x0 = 0; x1 = 1; }
      const u = clamp((x - x0) / ((x1 - x0) || 1), 0, 1);
      return v0 + (v1 - v0) * u;
    },
    ease: (x, x0, x1, v0, v1) => {
      const u = clamp((x - x0) / ((x1 - x0) || 1), 0, 1);
      return v0 + (v1 - v0) * getEasing('easeInOutSine')(u);
    },
    easeIn: (x, x0, x1, v0, v1) => v0 + (v1 - v0) * getEasing('easeInQuad')(clamp((x - x0) / ((x1 - x0) || 1), 0, 1)),
    easeOut: (x, x0, x1, v0, v1) => v0 + (v1 - v0) * getEasing('easeOutQuad')(clamp((x - x0) / ((x1 - x0) || 1), 0, 1)),
    valueAtTime: keyAt,
    loopOut: (type = 'cycle') => {
      const dur = lastKey - firstKey;
      if (!ctx.keys || ctx.keys.length < 2 || t <= lastKey || dur <= 0) return ctx.value;
      const k = (t - firstKey) / dur;
      if (type === 'pingpong') { const ph = k % 2; return keyAt(firstKey + (ph < 1 ? ph : 2 - ph) * dur); }
      if (type === 'continue') return keyAt(lastKey);
      return keyAt(firstKey + (k % 1) * dur);
    },
    loopIn: (type = 'cycle') => {
      const dur = lastKey - firstKey;
      if (!ctx.keys || ctx.keys.length < 2 || t >= firstKey || dur <= 0) return ctx.value;
      const k = (lastKey - t) / dur;
      if (type === 'pingpong') { const ph = k % 2; return keyAt(lastKey - (ph < 1 ? ph : 2 - ph) * dur); }
      return keyAt(lastKey - (k % 1) * dur);
    },
    degreesToRadians: (d) => (d * Math.PI) / 180,
    radiansToDegrees: (r) => (r * 180) / Math.PI,
    thisLayer: ctx.thisLayer || {},
    thisComp: { ...(ctx.comp || {}), layer: (name) => (ctx.layer ? ctx.layer(name) : null) },
    comp: () => ({ ...(ctx.comp || {}), layer: (name) => (ctx.layer ? ctx.layer(name) : null) }),
    audio: ctx.audio || { amplitude: 0, band: () => 0 },
    control: (name) => (ctx.control ? ctx.control(name) : 0),
    toFixed: (v, d = 0) => Number(v).toFixed(d),
    String: (v) => String(v),
    Number: (v) => Number(v),
  };
  const scope = new Proxy(lib, {
    has: () => true,
    get: (target, key) => (key === Symbol.unscopables ? undefined : target[key]),
    set: (target, key, v) => { target[key] = v; return true; }, // variables locales (x = …)
  });
  const out = fn(scope);
  if (typeof out === 'number') return Number.isFinite(out) ? out : ctx.value;
  if (typeof out === 'string' || typeof out === 'boolean') return out;
  if (Array.isArray(out) && out.every((v) => typeof v === 'number')) return out;
  if (out === undefined) return ctx.value;
  throw new Error('Une expression doit retourner un nombre, une chaîne ou un tableau de nombres');
}

export function expressionSeed(clipId, path) { return hashString(`${clipId}:${path}`) % 100000; }
