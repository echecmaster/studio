// Presets d'animation (≥80) : entrées, sorties (dérivées automatiquement + spécifiques) et emphases.
// Chaque preset produit des keyframes relatives aux valeurs de base du clip, et éventuellement des effets / transitions.
import { uid } from '../core/util.js';
import { defaultEffectParams } from './effects.js';

// frames : [[tNormalisé, valeur(base)→valeur, easing]] ; valeur = fonction(base) ou nombre
const IN = [];
const def = (id, name, en, dur, tracks, extra = {}) => IN.push({ id, name, en, duration: dur, tracks, ...extra });

const W = 1920; // amplitude de référence (px) — mise à l'échelle selon la composition
def('fadeIn', 'Fondu', 'Fade', 0.6, { 'transform.opacity': [[0, () => 0, 'easeOutCubic'], [1, (b) => b]] });
def('slideInLeft', 'Glisser depuis la gauche', 'Slide from left', 0.7, { 'transform.x': [[0, (b, s) => b - s.w * 0.6, 'easeOutCubic'], [1, (b) => b]], 'transform.opacity': [[0, () => 0, 'easeOutQuad'], [0.4, (b) => b]] });
def('slideInRight', 'Glisser depuis la droite', 'Slide from right', 0.7, { 'transform.x': [[0, (b, s) => b + s.w * 0.6, 'easeOutCubic'], [1, (b) => b]], 'transform.opacity': [[0, () => 0, 'easeOutQuad'], [0.4, (b) => b]] });
def('slideInUp', 'Glisser vers le haut', 'Slide up', 0.7, { 'transform.y': [[0, (b, s) => b + s.h * 0.6, 'easeOutCubic'], [1, (b) => b]], 'transform.opacity': [[0, () => 0, 'easeOutQuad'], [0.4, (b) => b]] });
def('slideInDown', 'Glisser vers le bas', 'Slide down', 0.7, { 'transform.y': [[0, (b, s) => b - s.h * 0.6, 'easeOutCubic'], [1, (b) => b]], 'transform.opacity': [[0, () => 0, 'easeOutQuad'], [0.4, (b) => b]] });
def('fadeInUp', 'Fondu montant', 'Fade in up', 0.6, { 'transform.y': [[0, (b) => b + 60, 'easeOutCubic'], [1, (b) => b]], 'transform.opacity': [[0, () => 0, 'easeOutCubic'], [1, (b) => b]] });
def('fadeInDown', 'Fondu descendant', 'Fade in down', 0.6, { 'transform.y': [[0, (b) => b - 60, 'easeOutCubic'], [1, (b) => b]], 'transform.opacity': [[0, () => 0, 'easeOutCubic'], [1, (b) => b]] });
def('fadeInLeft', 'Fondu depuis la gauche', 'Fade in left', 0.6, { 'transform.x': [[0, (b) => b - 80, 'easeOutCubic'], [1, (b) => b]], 'transform.opacity': [[0, () => 0, 'easeOutCubic'], [1, (b) => b]] });
def('fadeInRight', 'Fondu depuis la droite', 'Fade in right', 0.6, { 'transform.x': [[0, (b) => b + 80, 'easeOutCubic'], [1, (b) => b]], 'transform.opacity': [[0, () => 0, 'easeOutCubic'], [1, (b) => b]] });
def('zoomIn', 'Zoom avant', 'Zoom in', 0.6, { 'transform.scale': [[0, (b) => b * 0.3, 'easeOutCubic'], [1, (b) => b]], 'transform.opacity': [[0, () => 0, 'easeOutQuad'], [0.5, (b) => b]] });
def('zoomInBig', 'Zoom depuis grand', 'Zoom from large', 0.6, { 'transform.scale': [[0, (b) => b * 2.5, 'easeOutCubic'], [1, (b) => b]], 'transform.opacity': [[0, () => 0, 'easeOutQuad'], [0.5, (b) => b]] });
def('popIn', 'Pop', 'Pop', 0.5, { 'transform.scale': [[0, () => 0, 'easeOutBack'], [1, (b) => b]], 'transform.opacity': [[0, () => 0, 'linear'], [0.2, (b) => b]] });
def('bounceIn', 'Rebond', 'Bounce in', 0.9, { 'transform.scale': [[0, () => 0, 'easeOutBounce'], [1, (b) => b]] });
def('elasticIn', 'Élastique', 'Elastic in', 1.1, { 'transform.scale': [[0, () => 0, 'easeOutElastic'], [1, (b) => b]] });
def('spinIn', 'Rotation entrante', 'Spin in', 0.8, { 'transform.rotation': [[0, (b) => b - 360, 'easeOutCubic'], [1, (b) => b]], 'transform.scale': [[0, () => 0, 'easeOutCubic'], [1, (b) => b]] });
def('flipInX', 'Flip 3D (X)', 'Flip in X', 0.8, { 'transform.rotationX': [[0, () => 90, 'easeOutBack'], [1, (b) => b]], 'transform.opacity': [[0, () => 0, 'linear'], [0.3, (b) => b]] });
def('flipInY', 'Flip 3D (Y)', 'Flip in Y', 0.8, { 'transform.rotationY': [[0, () => 90, 'easeOutBack'], [1, (b) => b]], 'transform.opacity': [[0, () => 0, 'linear'], [0.3, (b) => b]] });
def('dropIn', 'Chute', 'Drop in', 0.9, { 'transform.y': [[0, (b, s) => b - s.h * 0.7, 'easeOutBounce'], [1, (b) => b]] });
def('riseIn', 'Montée', 'Rise', 0.8, { 'transform.y': [[0, (b, s) => b + s.h * 0.4, 'easeOutExpo'], [1, (b) => b]], 'transform.scale': [[0, (b) => b * 0.9, 'easeOutExpo'], [1, (b) => b]], 'transform.opacity': [[0, () => 0, 'easeOutCubic'], [0.5, (b) => b]] });
def('swingIn', 'Balancier', 'Swing in', 1, { 'transform.rotation': [[0, (b) => b - 30, 'easeOutElastic'], [1, (b) => b]], 'transform.opacity': [[0, () => 0, 'linear'], [0.2, (b) => b]] });
def('rollIn', 'Roulade', 'Roll in', 0.8, { 'transform.x': [[0, (b) => b - 400, 'easeOutCubic'], [1, (b) => b]], 'transform.rotation': [[0, (b) => b - 120, 'easeOutCubic'], [1, (b) => b]], 'transform.opacity': [[0, () => 0, 'easeOutCubic'], [1, (b) => b]] });
def('lightSpeedIn', 'Vitesse lumière', 'Light speed', 0.6, { 'transform.x': [[0, (b) => b + 600, 'easeOutCubic'], [1, (b) => b]], 'transform.skewX': [[0, () => -30, 'easeOutBack'], [1, (b) => b]], 'transform.opacity': [[0, () => 0, 'easeOutCubic'], [0.6, (b) => b]] });
def('backInLeft', 'Retour depuis la gauche', 'Back in left', 0.9, { 'transform.x': [[0, (b, s) => b - s.w, 'easeOutCubic'], [0.7, (b) => b, 'easeOutBack'], [1, (b) => b]], 'transform.scale': [[0, (b) => b * 0.7, 'hold'], [0.7, (b) => b * 0.7, 'easeOutBack'], [1, (b) => b]] });
def('backInUp', 'Retour depuis le bas', 'Back in up', 0.9, { 'transform.y': [[0, (b, s) => b + s.h, 'easeOutCubic'], [0.7, (b) => b, 'linear'], [1, (b) => b]], 'transform.scale': [[0, (b) => b * 0.7, 'hold'], [0.7, (b) => b * 0.7, 'easeOutBack'], [1, (b) => b]] });
def('stretchIn', 'Étirement', 'Stretch in', 0.6, { 'transform.scaleX': [[0, () => 0, 'easeOutBack'], [1, (b) => b]], 'transform.opacity': [[0, () => 0, 'linear'], [0.3, (b) => b]] });
def('squeezeIn', 'Compression', 'Squeeze in', 0.6, { 'transform.scaleY': [[0, () => 0, 'easeOutBack'], [1, (b) => b]], 'transform.scaleX': [[0, (b) => b * 1.4, 'easeOutCubic'], [1, (b) => b]] });
def('rotateInCorner', 'Rotation depuis le coin', 'Rotate in corner', 0.8, { 'transform.rotation': [[0, (b) => b - 45, 'easeOutCubic'], [1, (b) => b]], 'transform.opacity': [[0, () => 0, 'easeOutCubic'], [1, (b) => b]] });
def('blurIn', 'Flou entrant', 'Blur in', 0.7, { 'transform.opacity': [[0, () => 0, 'easeOutCubic'], [0.6, (b) => b]] }, { effects: [{ type: 'gaussianBlur', param: 'radius', frames: [[0, 40, 'easeOutCubic'], [1, 0]] }] });
def('glitchIn', 'Glitch entrant', 'Glitch in', 0.6, { 'transform.opacity': [[0, () => 0, 'hold'], [0.15, (b) => b * 0.6, 'hold'], [0.3, () => 0, 'hold'], [0.45, (b) => b]] }, { effects: [{ type: 'rgbSplit', param: 'amount', frames: [[0, 60, 'easeOutQuad'], [1, 0]] }] });
def('zoomBlurIn', 'Zoom flou', 'Zoom blur in', 0.6, { 'transform.scale': [[0, (b) => b * 1.6, 'easeOutExpo'], [1, (b) => b]], 'transform.opacity': [[0, () => 0, 'easeOutCubic'], [0.5, (b) => b]] }, { effects: [{ type: 'zoomBlur', param: 'amount', frames: [[0, 0.5, 'easeOutCubic'], [1, 0]] }] });
def('flashIn', 'Flash', 'Flash in', 0.4, { 'transform.opacity': [[0, () => 0, 'linear'], [0.1, (b) => b]] }, { effects: [{ type: 'brightness', param: 'amount', frames: [[0, 1, 'easeOutCubic'], [1, 0]] }] });
def('wipeIn', 'Volet (gauche)', 'Wipe', 0.7, {}, { transition: 'wipe-right' });
def('maskRevealUp', 'Révélation par masque', 'Mask reveal', 0.7, {}, { transition: 'wipe-up' });
def('irisIn', 'Iris', 'Iris', 0.7, {}, { transition: 'iris' });
def('splitIn', 'Fente', 'Split', 0.7, {}, { transition: 'splitReveal' });
def('blindsIn', 'Stores', 'Blinds', 0.8, {}, { transition: 'blindsH' });
def('pixelIn', 'Pixels', 'Pixelate', 0.7, {}, { transition: 'pixelTr' });
def('typewriter', 'Machine à écrire', 'Typewriter', 1.2, {}, { textAnimator: 'typewriter', fallback: 'wipe-right' });
def('lettersRise', 'Lettres montantes', 'Letters rise', 1.0, {}, { textAnimator: 'slide', fallback: 'wipe-up' });
def('lettersWave', 'Lettres en vague', 'Letters wave', 1.2, {}, { textAnimator: 'wave', fallback: 'fade' });

const OUT_EXTRA = [];
const defOut = (id, name, en, dur, tracks, extra = {}) => OUT_EXTRA.push({ id, name, en, duration: dur, tracks, ...extra, type: 'out' });
defOut('shrinkOut', 'Rétrécissement', 'Shrink out', 0.5, { 'transform.scale': [[0, (b) => b, 'easeInBack'], [1, () => 0]] });
defOut('fallOut', 'Chute (gravité)', 'Fall out', 0.9, { 'transform.y': [[0, (b) => b, 'easeInQuad'], [1, (b, s) => b + s.h]], 'transform.rotation': [[0, (b) => b, 'easeInQuad'], [1, (b) => b + 25]] });
defOut('hingeOut', 'Charnière', 'Hinge', 1.4, { 'transform.rotation': [[0, (b) => b, 'easeInOutSine'], [0.3, (b) => b + 80, 'easeInOutSine'], [0.5, (b) => b + 60, 'easeInOutSine'], [0.7, (b) => b + 80, 'easeInQuad'], [1, (b) => b + 70]], 'transform.y': [[0.7, (b) => b, 'easeInQuad'], [1, (b, s) => b + s.h]] });

// ---- Emphases (ancrées à un instant) ----
const EMPH = [];
const defE = (id, name, en, dur, tracks, extra = {}) => EMPH.push({ id, name, en, duration: dur, tracks, ...extra, type: 'emphasis' });
const osc = (path, amps, ease = 'easeInOutSine') => ({ [path]: amps.map((a, i) => [i / (amps.length - 1), typeof a === 'function' ? a : (b) => b + a, ease]) });
const oscMul = (path, mults, ease = 'easeInOutSine') => ({ [path]: mults.map((m, i) => [i / (mults.length - 1), (b) => b * m, ease]) });
defE('pulse', 'Pulsation', 'Pulse', 0.8, oscMul('transform.scale', [1, 1.08, 1]));
defE('heartbeat', 'Battement de cœur', 'Heartbeat', 1.2, oscMul('transform.scale', [1, 1.15, 1, 1.15, 1, 1], 'easeInOutQuad'));
defE('shake', 'Secousse', 'Shake', 0.8, osc('transform.x', [0, -18, 18, -18, 18, -10, 10, 0], 'easeInOutQuad'));
defE('headShake', 'Non de la tête', 'Head shake', 1, { ...osc('transform.x', [0, -6, 5, -3, 2, 0]), ...osc('transform.rotation', [0, -9, 7, -5, 3, 0]) });
defE('wobble', 'Oscillation', 'Wobble', 1, { ...osc('transform.x', [0, -40, 30, -25, 15, -8, 0]), ...osc('transform.rotation', [0, -5, 3, -3, 2, -1, 0]) });
defE('jello', 'Gelée', 'Jello', 0.9, { ...osc('transform.skewX', [0, -12.5, 6.25, -3.1, 1.6, -0.8, 0]), ...osc('transform.skewY', [0, -12.5, 6.25, -3.1, 1.6, -0.8, 0]) });
defE('rubberBand', 'Élastique', 'Rubber band', 1, { ...oscMul('transform.scaleX', [1, 1.25, 0.75, 1.15, 0.95, 1.05, 1]), ...oscMul('transform.scaleY', [1, 0.75, 1.25, 0.85, 1.05, 0.95, 1]) });
defE('swing', 'Balancement', 'Swing', 1, osc('transform.rotation', [0, 15, -10, 5, -5, 0]));
defE('tada', 'Tada', 'Tada', 1, { ...oscMul('transform.scale', [1, 0.9, 0.9, 1.1, 1.1, 1.1, 1.1, 1.1, 1.1, 1]), ...osc('transform.rotation', [0, -3, -3, 3, -3, 3, -3, 3, -3, 0]) });
defE('bounce', 'Rebond sur place', 'Bounce', 1, osc('transform.y', [0, 0, -30, -30, 0, -15, 0, -4, 0], 'easeOutQuad'));
defE('flash', 'Clignotement', 'Flash', 1, { 'transform.opacity': [[0, (b) => b, 'linear'], [0.25, () => 0, 'linear'], [0.5, (b) => b, 'linear'], [0.75, () => 0, 'linear'], [1, (b) => b]] });
defE('float', 'Flottement', 'Float', 2, osc('transform.y', [0, -14, 0, 14, 0]));
defE('spinOnce', 'Tour complet', 'Spin', 0.8, { 'transform.rotation': [[0, (b) => b, 'easeInOutCubic'], [1, (b) => b + 360]] });
defE('breathe', 'Respiration', 'Breathe', 2, { ...oscMul('transform.scale', [1, 1.04, 1]), ...osc('transform.opacity', [0, -0.15, 0]) });
defE('zoomPunch', 'Coup de zoom', 'Zoom punch', 0.4, oscMul('transform.scale', [1, 1.25, 1], 'easeOutQuad'));
defE('tilt', 'Inclinaison', 'Tilt', 0.8, osc('transform.rotation', [0, -8, 0]));
defE('nod', 'Hochement', 'Nod', 0.8, osc('transform.y', [0, 10, -4, 0]));
defE('glitchPulse', 'Glitch ponctuel', 'Glitch pulse', 0.5, {}, { effects: [{ type: 'rgbSplit', param: 'amount', frames: [[0, 0, 'linear'], [0.2, 50, 'linear'], [0.4, 0, 'linear'], [0.6, 30, 'linear'], [1, 0]] }] });
defE('blurPulse', 'Flou ponctuel', 'Blur pulse', 0.6, {}, { effects: [{ type: 'gaussianBlur', param: 'radius', frames: [[0, 0, 'easeOutCubic'], [0.3, 20, 'easeInCubic'], [1, 0]] }] });
defE('colorFlash', 'Flash de couleur', 'Color flash', 0.5, {}, { effects: [{ type: 'fill', param: 'mix', frames: [[0, 0, 'easeOutCubic'], [0.3, 0.9, 'easeInCubic'], [1, 0]] }] });
defE('wiggleExpr', 'Wiggle (expression)', 'Wiggle', 1, {}, { expression: { path: 'transform.x', code: 'value + wiggle(4, 12)' } });

// ---- Dérivation automatique des sorties ----
const swapEase = (e) => (e && e.includes('In') && !e.includes('InOut') ? e.replace('In', 'Out') : e && e.includes('Out') && !e.includes('InOut') ? e.replace('Out', 'In') : e);
function reverseFrames(frames) {
  const n = frames.length - 1;
  return frames.map((_, j) => {
    const [t, v] = frames[n - j];
    return [1 - t, v, j < n ? swapEase(frames[n - j - 1][2] || 'linear') : undefined];
  });
}
const OUT = IN.map((p) => {
  const tracks = {};
  for (const [path, frames] of Object.entries(p.tracks)) tracks[path] = reverseFrames(frames);
  const effects = (p.effects || []).map((e) => ({ ...e, frames: reverseFrames(e.frames) }));
  return {
    ...p, id: p.id.replace(/In(?=[A-Z]|$)/, 'Out').replace(/^typewriter$/, 'typewriterOut').replace(/^lettersRise$/, 'lettersFall').replace(/^lettersWave$/, 'lettersWaveOut'),
    name: `${p.name} (sortie)`, en: `${p.en} out`, tracks, effects, type: 'out',
  };
});
// garantit des ids uniques
const seen = new Set();
for (const p of OUT) { while (seen.has(p.id) || IN.some((i) => i.id === p.id)) p.id += 'Out'; seen.add(p.id); }

export const ANIMATION_PRESETS = [
  ...IN.map((p) => ({ ...p, type: 'in' })),
  ...OUT,
  ...OUT_EXTRA,
  ...EMPH,
];
export const ANIM_PRESET_MAP = Object.fromEntries(ANIMATION_PRESETS.map((p) => [p.id, p]));

// Applique un preset sur un clip (mutation du brouillon). Retourne un résumé.
export function applyAnimationPreset(clip, presetId, { duration, easing, at, compWidth = 1920, compHeight = 1080 } = {}) {
  const p = ANIM_PRESET_MAP[presetId];
  if (!p) throw new Error(`Preset d'animation inconnu : ${presetId}`);
  const d = Math.min(duration || p.duration, clip.duration);
  let t0 = 0;
  if (p.type === 'out') t0 = Math.max(0, clip.duration - d);
  if (p.type === 'emphasis') t0 = Math.max(0, Math.min(clip.duration - d, at ?? (clip.duration - d) / 2));
  const size = { w: compWidth, h: compHeight };
  const summary = { preset: p.id, type: p.type, start: t0, duration: d, keyframes: [], effects: [] };

  const baseOf = (path) => {
    const [grp, key] = path.split('.');
    const kfs = clip.keyframes[path];
    if (kfs && kfs.length) {
      // la valeur de base est la dernière valeur de keyframe hors de la fenêtre du preset
      const outside = kfs.filter((k) => k.t < t0 - 1e-4 || k.t > t0 + d + 1e-4);
      if (outside.length) return outside[outside.length - 1].v;
      return kfs[kfs.length - 1].v;
    }
    return clip[grp]?.[key] ?? 0;
  };

  for (const [path, frames] of Object.entries(p.tracks || {})) {
    const base = baseOf(path);
    const keys = (clip.keyframes[path] || []).filter((k) => k.t < t0 - 1e-4 || k.t > t0 + d + 1e-4);
    // si aucune keyframe hors fenêtre : on ancre la valeur de base aux extrémités pour préserver le reste du clip
    for (const [tn, vf, ease] of frames) {
      const v = typeof vf === 'function' ? vf(base, size) : vf;
      keys.push({ t: +(t0 + tn * d).toFixed(4), v, easing: easing && ease && ease !== 'hold' && ease !== 'linear' ? easing : (ease || 'linear'), hold: ease === 'hold' });
    }
    keys.sort((a, b) => a.t - b.t);
    clip.keyframes[path] = dedupeKeys(keys);
    summary.keyframes.push(path);
  }

  for (const fx of p.effects || []) {
    let eff = clip.effects.find((e) => e.type === fx.type && e.presetOwner === p.id);
    if (!eff) {
      eff = { id: uid('fx'), type: fx.type, enabled: true, params: defaultEffectParams(fx.type), presetOwner: p.id };
      if (fx.type === 'fill') eff.params.color = '#ffffff';
      clip.effects.push(eff);
    }
    const path = `effects.${eff.id}.params.${fx.param}`;
    clip.keyframes[path] = dedupeKeys(fx.frames.map(([tn, v, e]) => ({ t: +(t0 + tn * d).toFixed(4), v: typeof v === 'function' ? v() : v, easing: e || 'linear' })));
    summary.effects.push(eff.id);
  }

  if (p.transition || (p.textAnimator && clip.kind !== 'text')) {
    const type = p.transition || p.fallback;
    const tr = { type, duration: d, easing: easing || 'easeOutCubic', params: {} };
    if (p.type === 'out') clip.transitionOut = tr; else clip.transitionIn = tr;
    summary.transition = type;
  } else if (p.textAnimator) {
    clip.props.animator = {
      type: p.textAnimator, by: p.textAnimator === 'typewriter' ? 'char' : 'char', direction: p.type === 'out' ? 'out' : 'in',
      start: t0, duration: d, stagger: 0.05, easing: easing || 'easeOutCubic', amount: 1, random: false,
    };
    summary.textAnimator = p.textAnimator;
  }
  if (p.expression) {
    clip.expressions[p.expression.path] = p.expression.code;
    summary.expression = p.expression.path;
  }
  return summary;
}

function dedupeKeys(keys) {
  const out = [];
  for (const k of keys) {
    const prev = out[out.length - 1];
    if (prev && Math.abs(prev.t - k.t) < 1e-4) out[out.length - 1] = k; else out.push(k);
  }
  return out;
}

export function listAnimationPresets(type) {
  return ANIMATION_PRESETS.filter((p) => !type || p.type === type).map((p) => ({ id: p.id, name: p.name, en: p.en, type: p.type, duration: p.duration }));
}
