// Système de particules ANALYTIQUE et déterministe : la position de chaque particule est une fonction pure du temps.
// Aucun état de simulation → n'importe quelle image peut être rendue dans n'importe quel ordre (export déterministe).
import { mulberry32, hexToRgb, noise1, lerp } from '../core/util.js';

function particleColor(p, i, u, rnd) {
  if (p.colors && p.colors.length) return p.colors[Math.floor(rnd * p.colors.length) % p.colors.length];
  const a = hexToRgb(p.colorStart), b = hexToRgb(p.colorEnd);
  return `rgb(${Math.round(lerp(a[0], b[0], u) * 255)},${Math.round(lerp(a[1], b[1], u) * 255)},${Math.round(lerp(a[2], b[2], u) * 255)})`;
}

// Intégration analytique avec frottement linéaire k : v' = g - k v
function motion(v0, g, k, t) {
  if (k < 1e-4) return v0 * t + 0.5 * g * t * t;
  const e = Math.exp(-k * t);
  return (g / k) * t + ((v0 - g / k) * (1 - e)) / k;
}

export function computeParticles(p, t) {
  const out = [];
  if (t < 0) return out;
  const rate = Math.max(0, p.rate || 0);
  const life = Math.max(0.05, p.life || 1);
  const max = Math.min(p.maxParticles || 2000, 10000);
  const seed = p.seed || 1;
  const births = [];
  const burst = Math.max(0, p.burst || 0);
  if (burst) {
    const reps = p.repeat ? Math.floor(t / p.repeat) + 1 : 1;
    for (let r = 0; r < reps; r++) {
      const bt = r * (p.repeat || 0);
      for (let i = 0; i < burst; i++) births.push({ i: r * 100000 + i, t0: bt, burstIndex: r });
    }
  }
  if (rate > 0) {
    const firstAlive = Math.max(0, Math.floor((t - life * (1 + (p.lifeVar || 0))) * rate));
    const last = Math.floor(t * rate);
    for (let i = Math.max(firstAlive, last - max); i <= last; i++) births.push({ i: 1e7 + i, t0: i / rate });
  }
  for (const b of births) {
    const rnd = mulberry32((seed * 7919 + b.i * 104729) >>> 0);
    const r = [rnd(), rnd(), rnd(), rnd(), rnd(), rnd(), rnd(), rnd(), rnd()];
    const lf = life * (1 + (r[0] - 0.5) * 2 * (p.lifeVar || 0));
    const age = t - b.t0;
    if (age < 0 || age > lf) continue;
    const u = age / lf;
    // position d'émission
    let ex = 0, ey = 0;
    const W = p.emitterWidth || 0, H = p.emitterHeight || 0;
    switch (p.emitterShape) {
      case 'line': ex = (r[1] - 0.5) * W; break;
      case 'rect': ex = (r[1] - 0.5) * W; ey = (r[2] - 0.5) * H; break;
      case 'circle': { const a = r[1] * Math.PI * 2, rr = Math.sqrt(r[2]) * W / 2; ex = Math.cos(a) * rr; ey = Math.sin(a) * rr; break; }
      case 'orbit': { const a = b.t0 * 3; ex = Math.cos(a) * W / 2; ey = Math.sin(a) * W / 2 * 0.6; break; }
      default: break;
    }
    if (b.burstIndex !== undefined && p.repeat) { const br = mulberry32(seed + b.burstIndex * 31); ex += (br() - 0.5) * (p.width || 1000) * 0.6; ey += (br() - 0.5) * (p.height || 600) * 0.4; }
    const dir = ((p.direction || 0) + (r[3] - 0.5) * 2 * (p.spread || 0)) * Math.PI / 180;
    const sp = (p.speed || 0) * (1 + (r[4] - 0.5) * 2 * (p.speedVar || 0));
    const vx = Math.cos(dir) * sp, vy = Math.sin(dir) * sp;
    const k = p.drag || 0;
    let x = ex + motion(vx, 0, k, age);
    let y = ey + motion(vy, p.gravity || 0, k, age);
    if (p.turbulence) {
      const sc = p.turbulenceScale || 0.004;
      x += noise1(age * 1.3 + r[5] * 50, seed) * p.turbulence + noise1((x + 1000) * sc, seed + 3) * p.turbulence * 0.5;
      y += noise1(age * 1.1 + r[6] * 50, seed + 9) * p.turbulence;
    }
    for (const at of p.attractors || []) {
      const f = 1 - Math.exp(-(at.strength ?? 1) * age);
      x = lerp(x, at.x, f * 0.9);
      y = lerp(y, at.y, f * 0.9);
    }
    if (p.collideFloor) {
      const floor = p.floorY ?? 400;
      if (y > floor) { const over = y - floor; y = floor - over * (p.bounce ?? 0.5); }
    }
    const size = lerp(p.sizeStart, p.sizeEnd, u) * (1 + (r[7] - 0.5) * 2 * (p.sizeVar || 0));
    const alpha = lerp(p.opacityStart ?? 1, p.opacityEnd ?? 0, u);
    out.push({ x, y, size: Math.max(0, size), alpha: Math.max(0, Math.min(1, alpha)), color: particleColor(p, b.i, u, r[8]), rot: ((p.spin || 0) * age + r[5] * 360) * Math.PI / 180, vx, vy, u, r: r[2] });
    if (out.length >= max) break;
  }
  return out;
}

export function drawParticles(ctx, p, t, ox, oy, sprite) {
  const list = computeParticles(p, t);
  ctx.save();
  if (p.additive) ctx.globalCompositeOperation = 'lighter';
  for (const q of list) {
    if (q.size <= 0.05 || q.alpha <= 0.003) continue;
    ctx.globalAlpha = q.alpha;
    ctx.fillStyle = q.color;
    ctx.strokeStyle = q.color;
    const x = ox + q.x, y = oy + q.y, s = q.size;
    switch (p.sprite) {
      case 'square': ctx.save(); ctx.translate(x, y); ctx.rotate(q.rot); ctx.fillRect(-s / 2, -s / 2, s, s); ctx.restore(); break;
      case 'confetti': ctx.save(); ctx.translate(x, y); ctx.rotate(q.rot); ctx.scale(1, Math.cos(q.rot * 1.7)); ctx.fillRect(-s / 2, -s / 4, s, s / 2); ctx.restore(); break;
      case 'star': {
        ctx.save(); ctx.translate(x, y); ctx.rotate(q.rot); ctx.beginPath();
        for (let i = 0; i < 10; i++) { const a = (i * Math.PI) / 5 - Math.PI / 2; const rr = i % 2 ? s * 0.22 : s / 2; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        ctx.closePath(); ctx.fill(); ctx.restore(); break;
      }
      case 'spark': case 'line': {
        const sp = Math.hypot(q.vx, q.vy) || 1;
        const len = p.sprite === 'line' ? s * 8 : s * 4;
        ctx.lineWidth = p.sprite === 'line' ? Math.max(1, s / 2) : s;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - (q.vx / sp) * len, y - (q.vy / sp) * len); ctx.stroke(); break;
      }
      case 'ring': ctx.lineWidth = Math.max(1, s * 0.12); ctx.beginPath(); ctx.arc(x, y, s / 2, 0, Math.PI * 2); ctx.stroke(); break;
      case 'asset': if (sprite) ctx.drawImage(sprite, x - s / 2, y - s / 2, s, s); break;
      default: {
        if (p.additive && s > 8) {
          const g = ctx.createRadialGradient(x, y, 0, x, y, s / 2);
          g.addColorStop(0, q.color); g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
        }
        ctx.beginPath(); ctx.arc(x, y, s / 2, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  ctx.restore();
  return list.length;
}
