// Bibliothèque d'easings : Penner complet + Bézier cubique + ressort physique
const PI = Math.PI;
const c1 = 1.70158, c2 = c1 * 1.525, c3 = c1 + 1, c4 = (2 * PI) / 3, c5 = (2 * PI) / 4.5;

function bounceOut(x) {
  const n1 = 7.5625, d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
  return n1 * (x -= 2.625 / d1) * x + 0.984375;
}

const base = {
  sine: [(x) => 1 - Math.cos((x * PI) / 2), (x) => Math.sin((x * PI) / 2), (x) => -(Math.cos(PI * x) - 1) / 2],
  quad: [(x) => x * x, (x) => 1 - (1 - x) * (1 - x), (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2)],
  cubic: [(x) => x * x * x, (x) => 1 - Math.pow(1 - x, 3), (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)],
  quart: [(x) => x ** 4, (x) => 1 - Math.pow(1 - x, 4), (x) => (x < 0.5 ? 8 * x ** 4 : 1 - Math.pow(-2 * x + 2, 4) / 2)],
  quint: [(x) => x ** 5, (x) => 1 - Math.pow(1 - x, 5), (x) => (x < 0.5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2)],
  expo: [
    (x) => (x === 0 ? 0 : Math.pow(2, 10 * x - 10)),
    (x) => (x === 1 ? 1 : 1 - Math.pow(2, -10 * x)),
    (x) => (x === 0 ? 0 : x === 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2),
  ],
  circ: [
    (x) => 1 - Math.sqrt(1 - x * x),
    (x) => Math.sqrt(1 - Math.pow(x - 1, 2)),
    (x) => (x < 0.5 ? (1 - Math.sqrt(1 - Math.pow(2 * x, 2))) / 2 : (Math.sqrt(1 - Math.pow(-2 * x + 2, 2)) + 1) / 2),
  ],
  back: [
    (x) => c3 * x * x * x - c1 * x * x,
    (x) => 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2),
    (x) => (x < 0.5 ? (Math.pow(2 * x, 2) * ((c2 + 1) * 2 * x - c2)) / 2 : (Math.pow(2 * x - 2, 2) * ((c2 + 1) * (x * 2 - 2) + c2) + 2) / 2),
  ],
  elastic: [
    (x) => (x === 0 ? 0 : x === 1 ? 1 : -Math.pow(2, 10 * x - 10) * Math.sin((x * 10 - 10.75) * c4)),
    (x) => (x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1),
    (x) => (x === 0 ? 0 : x === 1 ? 1 : x < 0.5 ? -(Math.pow(2, 20 * x - 10) * Math.sin((20 * x - 11.125) * c5)) / 2 : (Math.pow(2, -20 * x + 10) * Math.sin((20 * x - 11.125) * c5)) / 2 + 1),
  ],
  bounce: [(x) => 1 - bounceOut(1 - x), bounceOut, (x) => (x < 0.5 ? (1 - bounceOut(1 - 2 * x)) / 2 : (1 + bounceOut(2 * x - 1)) / 2)],
};

export const EASINGS = { linear: (x) => x, hold: (x) => (x < 1 ? 0 : 1) };
for (const [name, [i, o, io]] of Object.entries(base)) {
  const cap = name[0].toUpperCase() + name.slice(1);
  EASINGS[`easeIn${cap}`] = i;
  EASINGS[`easeOut${cap}`] = o;
  EASINGS[`easeInOut${cap}`] = io;
}
// alias pratiques
EASINGS.ease = EASINGS.easeInOutCubic;
EASINGS.easeIn = EASINGS.easeInCubic;
EASINGS.easeOut = EASINGS.easeOutCubic;
EASINGS.easeInOut = EASINGS.easeInOutCubic;
EASINGS.smooth = EASINGS.easeInOutSine; // F9 "easing doux"

export const EASING_NAMES = Object.keys(EASINGS);

// Bézier cubique CSS (x1,y1,x2,y2) avec résolution de Newton + bissection
export function cubicBezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t;
  const sy = (t) => ((ay * t + by) * t + cy) * t;
  const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = sx(t) - x;
      if (Math.abs(e) < 1e-6) return sy(t);
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let lo = 0, hi = 1;
    t = x;
    for (let i = 0; i < 30; i++) {
      const v = sx(t);
      if (Math.abs(v - x) < 1e-6) break;
      if (x > v) lo = t; else hi = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
}

// Ressort amorti (raideur, amortissement, masse) normalisé sur [0,1]
export function springEasing({ stiffness = 170, damping = 26, mass = 1, velocity = 0 } = {}, duration = 1) {
  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  return (x) => {
    const t = x * duration * 1.0;
    if (x >= 1) return 1;
    let v;
    if (zeta < 1) {
      const wd = w0 * Math.sqrt(1 - zeta * zeta);
      v = 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0 - velocity) / wd) * Math.sin(wd * t));
    } else {
      v = 1 - Math.exp(-w0 * t) * (1 + (w0 - velocity) * t);
    }
    return v;
  };
}

export const BEZIER_PRESETS = {
  linear: [0, 0, 1, 1], ease: [0.25, 0.1, 0.25, 1], easeIn: [0.42, 0, 1, 1], easeOut: [0, 0, 0.58, 1], easeInOut: [0.42, 0, 0.58, 1],
  smooth: [0.4, 0, 0.2, 1], snappy: [0.2, 0, 0, 1], anticipate: [0.36, 0, 0.66, -0.56], overshoot: [0.34, 1.56, 0.64, 1], expoOut: [0.16, 1, 0.3, 1],
};

export function getEasing(name, bezier, spring, duration) {
  if (Array.isArray(bezier) && bezier.length === 4) return cubicBezier(...bezier);
  if (name === 'spring') return springEasing(spring || {}, duration || 1);
  if (name && name.startsWith('cubic-bezier(')) {
    const n = name.match(/-?[\d.]+/g).map(Number);
    if (n.length === 4) return cubicBezier(...n);
  }
  return EASINGS[name] || EASINGS.linear;
}
