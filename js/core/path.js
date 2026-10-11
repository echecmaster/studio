// Géométrie de tracés (sans DOM) : Bézier cubiques, échantillonnage par abscisse curviligne, formes → polylignes.
// Format des points : {x, y, ix, iy, ox, oy} — poignées entrantes/sortantes relatives au point.

function cubic(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

export function flattenPath(points, closed = false, stepsPerSeg = 24) {
  const out = [];
  if (!points || points.length < 2) return points ? points.map((p) => ({ x: p.x, y: p.y })) : out;
  const n = closed ? points.length : points.length - 1;
  for (let i = 0; i < n; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const ax = a.x, ay = a.y, bx = b.x, by = b.y;
    const c1x = ax + (a.ox || 0), c1y = ay + (a.oy || 0), c2x = bx + (b.ix || 0), c2y = by + (b.iy || 0);
    const straight = !a.ox && !a.oy && !b.ix && !b.iy;
    const steps = straight ? 1 : stepsPerSeg;
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      out.push({ x: cubic(ax, c1x, c2x, bx, t), y: cubic(ay, c1y, c2y, by, t) });
    }
  }
  const last = closed ? points[0] : points[points.length - 1];
  out.push({ x: last.x, y: last.y });
  return out;
}

export function polylineLength(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return L;
}

// Point à la fraction u ∈ [0,1] de la longueur totale, avec angle de la tangente (degrés)
export function pointAt(pts, u) {
  if (!pts.length) return { x: 0, y: 0, angle: 0 };
  if (pts.length === 1) return { ...pts[0], angle: 0 };
  const total = polylineLength(pts);
  let target = Math.max(0, Math.min(1, u)) * total;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (target <= seg || i === pts.length - 1) {
      const k = seg > 0 ? Math.min(1, target / seg) : 0;
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI };
    }
    target -= seg;
  }
  const a = pts[pts.length - 2], b = pts[pts.length - 1];
  return { x: b.x, y: b.y, angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI };
}

export function resample(pts, n) {
  const out = [];
  for (let i = 0; i < n; i++) { const p = pointAt(pts, i / (n - 1)); out.push({ x: p.x, y: p.y }); }
  return out;
}

// Sous-tracé entre deux fractions (trim paths), gère le décalage circulaire
export function trimPolyline(pts, start, end, offset = 0, closed = false) {
  let s = start + offset, e = end + offset;
  if (e - s >= 1 - 1e-6) return [pts];
  if (e <= s) return [];
  const seg = (a, b) => {
    const out = [];
    const N = Math.max(2, Math.ceil(pts.length * (b - a)) + 2);
    for (let i = 0; i <= N; i++) { const p = pointAt(pts, a + ((b - a) * i) / N); out.push({ x: p.x, y: p.y }); }
    return out;
  };
  s = ((s % 1) + 1) % 1;
  e = s + (end - start);
  if (e <= 1) return [seg(s, e)];
  return closed ? [seg(s, 1).concat(seg(0, e - 1))] : [seg(s, 1), seg(0, e - 1)];
}

// Formes paramétriques → points de tracé (centrés sur 0,0)
export function shapeToPoints(p) {
  const w = p.width || 0, h = p.height || 0;
  const k = 0.5522847498;
  switch (p.shape) {
    case 'ellipse': case 'circle': {
      const rx = w / 2, ry = (p.shape === 'circle' ? w : h) / 2;
      return { closed: true, points: [
        { x: 0, y: -ry, ix: -rx * k, iy: 0, ox: rx * k, oy: 0 }, { x: rx, y: 0, ix: 0, iy: -ry * k, ox: 0, oy: ry * k },
        { x: 0, y: ry, ix: rx * k, iy: 0, ox: -rx * k, oy: 0 }, { x: -rx, y: 0, ix: 0, iy: ry * k, ox: 0, oy: -ry * k }] };
    }
    case 'triangle': return { closed: true, points: [{ x: 0, y: -h / 2 }, { x: w / 2, y: h / 2 }, { x: -w / 2, y: h / 2 }] };
    case 'polygon': {
      const n = Math.max(3, Math.round(p.sides || 6));
      return { closed: true, points: Array.from({ length: n }, (_, i) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; return { x: (Math.cos(a) * w) / 2, y: (Math.sin(a) * h) / 2 }; }) };
    }
    case 'star': {
      const n = Math.max(3, Math.round(p.points || 5));
      const ir = p.innerRadius ?? 0.45;
      return { closed: true, points: Array.from({ length: n * 2 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / n; const r = i % 2 ? ir : 1; return { x: (Math.cos(a) * w * r) / 2, y: (Math.sin(a) * h * r) / 2 }; }) };
    }
    case 'line': return { closed: false, points: [{ x: -w / 2, y: 0 }, { x: w / 2, y: 0 }] };
    case 'arrow': {
      const sh = h * 0.36, hw = Math.min(w * 0.35, h);
      return { closed: true, points: [{ x: -w / 2, y: -sh / 2 }, { x: w / 2 - hw, y: -sh / 2 }, { x: w / 2 - hw, y: -h / 2 }, { x: w / 2, y: 0 }, { x: w / 2 - hw, y: h / 2 }, { x: w / 2 - hw, y: sh / 2 }, { x: -w / 2, y: sh / 2 }] };
    }
    case 'heart': {
      const sx = w / 2, sy = h / 2;
      return { closed: true, points: [
        { x: 0, y: -0.45 * sy, ix: -0.1 * sx, iy: -0.5 * sy, ox: 0.1 * sx, oy: -0.5 * sy },
        { x: sx, y: -0.35 * sy, ix: 0, iy: -0.6 * sy, ox: 0, oy: 0.45 * sy },
        { x: 0, y: sy, ix: 0.45 * sx, iy: -0.3 * sy, ox: -0.45 * sx, oy: -0.3 * sy },
        { x: -sx, y: -0.35 * sy, ix: 0, iy: 0.45 * sy, ox: 0, oy: -0.6 * sy }] };
    }
    case 'path': case 'freehand': return { closed: !!p.closed, points: p.path || [] };
    default: { // rect avec coins arrondis
      const r = (p.radius || [0, 0, 0, 0]).map((v) => Math.max(0, Math.min(v || 0, w / 2, h / 2)));
      const x0 = -w / 2, y0 = -h / 2, x1 = w / 2, y1 = h / 2;
      const pts = [];
      const corner = (cx, cy, rad, a0) => {
        if (rad <= 0) { pts.push({ x: cx + Math.cos(a0 + Math.PI / 4) * 0, y: cy }); return; }
        for (let i = 0; i <= 6; i++) { const a = a0 + (i / 6) * (Math.PI / 2); pts.push({ x: cx + Math.cos(a) * rad, y: cy + Math.sin(a) * rad }); }
      };
      if (r.every((v) => v <= 0)) return { closed: true, points: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }] };
      corner(x0 + r[0], y0 + r[0], r[0], Math.PI);
      corner(x1 - r[1], y0 + r[1], r[1], -Math.PI / 2);
      corner(x1 - r[2], y1 - r[2], r[2], 0);
      corner(x0 + r[3], y1 - r[3], r[3], Math.PI / 2);
      if (r[0] <= 0) pts[0] = { x: x0, y: y0 };
      return { closed: true, points: pts.map((q) => ({ x: q.x, y: q.y })) };
    }
  }
}

export function shapePolyline(p, steps = 24) {
  const s = shapeToPoints(p);
  return { closed: s.closed, pts: flattenPath(s.points, s.closed, steps) };
}

// Morphing : interpolation entre deux formes rééchantillonnées
export function morphPolylines(a, b, t, n = 128) {
  const ra = resample(a, n), rb = resample(b, n);
  // aligne le point de départ pour minimiser la torsion
  let best = 0, bestD = Infinity;
  for (let s = 0; s < n; s += 4) {
    let d = 0;
    for (let i = 0; i < n; i += 8) { const q = rb[(i + s) % n]; d += (ra[i].x - q.x) ** 2 + (ra[i].y - q.y) ** 2; }
    if (d < bestD) { bestD = d; best = s; }
  }
  return ra.map((p, i) => { const q = rb[(i + best) % n]; return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t }; });
}
