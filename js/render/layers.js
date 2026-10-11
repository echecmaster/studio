// Dessin Canvas 2D des calques vectoriels / data viz / UI. Chaque type expose box(r, env) → {w,h,pad} et draw(ctx, r, env).
// Le contexte reçu est déjà mis à l'échelle : 1 unité = 1 px de la composition, origine = coin haut-gauche de la boîte.
import { layoutText, drawText, textPadding, fontString, roundRect } from './text.js';
import { shapePolyline, trimPolyline, morphPolylines, shapeToPoints, flattenPath } from '../core/path.js';
import { getEasing } from '../catalog/easings.js';
import { drawParticles } from './particles.js';
import { hexToRgb, lerp } from '../core/util.js';

let measureCanvas = null;
export function measureCtx() {
  if (!measureCanvas) measureCanvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(8, 8) : document.createElement('canvas');
  return measureCanvas.getContext('2d');
}

const ease = (name, x) => getEasing(name || 'easeOutCubic')(Math.max(0, Math.min(1, x)));

function fillStyle(ctx, f, w, h, fallback) {
  if (!f || f.type === 'solid' || !f.type) return f?.color || fallback;
  const stops = f.stops?.length ? f.stops : [{ o: 0, c: f.color }, { o: 1, c: f.color }];
  let g;
  if (f.type === 'radial') g = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(w, h) / 2);
  else if (f.type === 'conic' && ctx.createConicGradient) g = ctx.createConicGradient(((f.angle || 0) * Math.PI) / 180, 0, 0);
  else if (f.type === 'pattern') {
    const pc = new OffscreenCanvas(24, 24);
    const pg = pc.getContext('2d');
    pg.fillStyle = stops[0].c; pg.fillRect(0, 0, 24, 24);
    pg.fillStyle = stops[stops.length - 1].c; pg.fillRect(0, 0, 12, 12); pg.fillRect(12, 12, 12, 12);
    return ctx.createPattern(pc, 'repeat');
  } else {
    const a = ((f.angle ?? 90) * Math.PI) / 180;
    const dx = (Math.cos(a) * w) / 2, dy = (Math.sin(a) * h) / 2;
    g = ctx.createLinearGradient(-dx, -dy, dx, dy);
  }
  for (const s of stops) g.addColorStop(Math.max(0, Math.min(1, s.o)), s.c);
  return g;
}

function tracePolyline(ctx, pts, closed) {
  if (!pts.length) return;
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  if (closed) ctx.closePath();
}

// ------------------------------------------------------------------ formes
function shapeGeometry(p) {
  if (p.shape === 'compound' && p.compound?.shapes?.length) return null;
  let { closed, pts } = shapePolyline(p, 32);
  if (p.morphTo && p.morph > 0) {
    const tgt = shapePolyline({ ...p, ...p.morphTo }, 32);
    pts = morphPolylines(pts, tgt.pts, Math.min(1, p.morph));
    closed = closed || tgt.closed;
  }
  return { closed, pts };
}

const shape = {
  box(r) {
    const p = r.props;
    let w = p.width, h = p.height;
    if (p.shape === 'circle') h = w;
    if (p.shape === 'compound' && p.compound?.shapes?.length) {
      const xs = p.compound.shapes.flatMap((s) => [s.x - s.width / 2, s.x + s.width / 2]);
      const ys = p.compound.shapes.flatMap((s) => [s.y - s.height / 2, s.y + s.height / 2]);
      w = Math.max(...xs) - Math.min(...xs); h = Math.max(...ys) - Math.min(...ys);
    }
    if (p.shape === 'path' || p.shape === 'freehand') {
      const pts = flattenPath(p.path || [], p.closed, 16);
      if (pts.length) { w = Math.max(1, ...pts.map((q) => Math.abs(q.x)) ) * 2; h = Math.max(1, ...pts.map((q) => Math.abs(q.y))) * 2; }
    }
    return { w: Math.max(1, w), h: Math.max(1, h), pad: (p.stroke?.enabled ? p.stroke.width : 0) + 4 };
  },
  draw(ctx, r, env, box) {
    const p = r.props;
    ctx.translate(box.w / 2, box.h / 2);
    const doFill = p.fill?.enabled !== false && !['line'].includes(p.shape);
    if (p.shape === 'compound' && p.compound?.shapes?.length) {
      // opérations booléennes rasterisées via compositing
      const oc = new OffscreenCanvas(Math.ceil(box.w * env.scale) + 2, Math.ceil(box.h * env.scale) + 2);
      const o = oc.getContext('2d');
      o.scale(env.scale, env.scale);
      o.translate(box.w / 2, box.h / 2);
      p.compound.shapes.forEach((s, i) => {
        const g = shapePolyline({ radius: [0, 0, 0, 0], ...s }, 32);
        o.globalCompositeOperation = i === 0 ? 'source-over' : ({ union: 'source-over', subtract: 'destination-out', intersect: 'destination-in', exclude: 'xor' }[p.compound.op] || 'source-over');
        o.beginPath(); o.save(); o.translate(s.x || 0, s.y || 0); tracePolyline(o, g.pts, true); o.restore();
        o.fillStyle = '#fff'; o.fill();
      });
      ctx.save();
      ctx.fillStyle = fillStyle(ctx, p.fill, box.w, box.h, '#24D26D');
      ctx.fillRect(-box.w / 2, -box.h / 2, box.w, box.h);
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(oc, -box.w / 2, -box.h / 2, oc.width / env.scale, oc.height / env.scale);
      ctx.restore();
      return;
    }
    const g = shapeGeometry(p);
    const trimmed = (p.trimStart > 0 || p.trimEnd < 1 || p.trimOffset) ? trimPolyline(g.pts, p.trimStart || 0, p.trimEnd ?? 1, p.trimOffset || 0, g.closed) : null;
    if (doFill && !trimmed) {
      ctx.beginPath(); tracePolyline(ctx, g.pts, true);
      ctx.fillStyle = fillStyle(ctx, p.fill, box.w, box.h, '#24D26D');
      ctx.fill();
    }
    if (p.stroke?.enabled && p.stroke.width > 0) {
      ctx.lineWidth = p.stroke.width;
      ctx.strokeStyle = p.stroke.color;
      ctx.lineCap = p.stroke.cap || 'round';
      ctx.lineJoin = p.stroke.join || 'round';
      const dash = Array.isArray(p.stroke.dash) ? p.stroke.dash : String(p.stroke.dash || '').split(/[\s,]+/).map(Number).filter((n) => n > 0);
      ctx.setLineDash(dash);
      ctx.beginPath();
      if (trimmed) for (const seg of trimmed) tracePolyline(ctx, seg, false);
      else tracePolyline(ctx, g.pts, g.closed);
      ctx.stroke();
    } else if (trimmed && doFill) {
      ctx.beginPath(); for (const seg of trimmed) tracePolyline(ctx, seg, false);
      ctx.lineWidth = Math.max(4, Math.min(box.w, box.h) * 0.05); ctx.strokeStyle = p.fill.color; ctx.lineCap = 'round'; ctx.stroke();
    }
  },
};

// ------------------------------------------------------------------ texte
const text = {
  box(r) {
    const L = layoutText(measureCtx(), r.props);
    return { w: L.w, h: L.h, pad: textPadding(r.props), layout: L };
  },
  draw(ctx, r, env, box) { drawText(ctx, r.props, r.sourceTime - (r.inPoint || 0) + (r.inPoint || 0), box.layout); },
};

// ------------------------------------------------------------------ compteur
function formatNumber(v, p) {
  const n = Number(v.toFixed(p.decimals || 0));
  let s;
  if (p.format === 'currency') {
    try { s = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: p.currency || 'EUR', minimumFractionDigits: p.decimals || 0, maximumFractionDigits: p.decimals || 0, useGrouping: p.separator !== false }).format(n); } catch { s = `${n} ${p.currency}`; }
  } else {
    s = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: p.decimals || 0, maximumFractionDigits: p.decimals || 0, useGrouping: p.separator !== false }).format(n);
    if (p.format === 'percent') s += ' %';
  }
  return `${p.prefix || ''}${s}${p.suffix || ''}`;
}
const counterText = (r) => {
  const p = r.props;
  const u = ease(p.easing, (r.sourceTime - (p.startAt || 0)) / (p.duration || 1));
  return formatNumber(lerp(p.from, p.to, u), p);
};
const counter = {
  box(r) {
    const p = r.props;
    const c = measureCtx(); c.font = fontString(p);
    const w = Math.max(c.measureText(formatNumber(p.to, p)).width, c.measureText(formatNumber(p.from, p)).width);
    return { w: w * 1.05, h: p.fontSize * 1.2, pad: 8 };
  },
  draw(ctx, r, env, box) {
    const p = r.props;
    ctx.font = fontString(p); ctx.fillStyle = p.color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if ('fontVariantNumeric' in ctx) ctx.fontVariantNumeric = 'tabular-nums';
    ctx.fillText(counterText(r), box.w / 2, box.h / 2);
  },
};

// ------------------------------------------------------------------ progression
const progressValue = (r) => (r.props.auto ? ease(r.props.easing || 'easeInOutCubic', r.sourceTime / (r.props.duration || 1)) * r.props.value : r.props.value);
const progress = {
  box(r) { const p = r.props; return p.style === 'ring' ? { w: p.width / 3, h: p.width / 3, pad: p.thickness } : { w: p.width, h: p.height + (p.showLabel ? p.fontSize * 1.6 : 0), pad: 4 }; },
  draw(ctx, r, env, box) {
    const p = r.props, v = Math.max(0, Math.min(1, progressValue(r)));
    if (p.style === 'ring') {
      const cx = box.w / 2, cy = box.h / 2, rad = box.w / 2 - p.thickness / 2;
      ctx.lineWidth = p.thickness; ctx.lineCap = 'round';
      ctx.strokeStyle = p.trackColor; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = p.color; ctx.beginPath(); ctx.arc(cx, cy, rad, -Math.PI / 2, -Math.PI / 2 + v * Math.PI * 2); if (v > 0.001) ctx.stroke();
      if (p.showLabel) { ctx.fillStyle = p.labelColor; ctx.font = `700 ${p.fontSize}px Inter, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`${Math.round(v * 100)} %`, cx, cy); }
    } else {
      const y = p.showLabel ? p.fontSize * 1.6 : 0;
      ctx.fillStyle = p.trackColor; roundRect(ctx, 0, y, p.width, p.height, p.radius); ctx.fill();
      ctx.fillStyle = p.color; if (v > 0.001) { roundRect(ctx, 0, y, Math.max(p.height, p.width * v), p.height, p.radius); ctx.fill(); }
      if (p.showLabel) { ctx.fillStyle = p.labelColor; ctx.font = `700 ${p.fontSize}px Inter, sans-serif`; ctx.textBaseline = 'top'; ctx.textAlign = 'left'; ctx.fillText(`${Math.round(v * 100)} %`, Math.min(p.width * v, p.width - p.fontSize * 2), 0); }
    }
  },
};

// ------------------------------------------------------------------ horloge / chronomètre / minuteur
const clock = {
  box(r) { const p = r.props; return { w: p.style === 'digital' ? p.size * 1.6 : p.size, h: p.style === 'digital' ? p.size * 0.4 : p.size, pad: 6 }; },
  draw(ctx, r, env, box) {
    const p = r.props;
    const lt = r.sourceTime * (p.speed ?? 1);
    let secs = p.mode === 'clock' ? p.startSeconds + lt : p.mode === 'stopwatch' ? lt : Math.max(0, p.timerFrom - lt);
    if (p.style === 'digital') {
      const h = Math.floor(secs / 3600), m = Math.floor(secs / 60) % 60, s = Math.floor(secs) % 60, cs = Math.floor((secs % 1) * 100);
      const str = p.mode === 'clock' ? `${String(h % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${h ? `${h}:` : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
      ctx.font = `700 ${p.size * 0.3}px ${p.fontFamily}, monospace`; ctx.fillStyle = p.color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(str, box.w / 2, box.h / 2);
      return;
    }
    const R = p.size / 2, cx = R, cy = R;
    ctx.strokeStyle = p.color; ctx.lineWidth = p.size * 0.02;
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.96, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2; const l = i % 5 ? 0.04 : 0.1;
      ctx.lineWidth = i % 5 ? p.size * 0.005 : p.size * 0.015;
      ctx.beginPath(); ctx.moveTo(cx + Math.sin(a) * R * 0.88, cy - Math.cos(a) * R * 0.88); ctx.lineTo(cx + Math.sin(a) * R * (0.88 - l), cy - Math.cos(a) * R * (0.88 - l)); ctx.stroke();
    }
    const hand = (ang, len, w, col) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.sin(ang) * len, cy - Math.cos(ang) * len); ctx.stroke(); };
    if (p.mode === 'clock') {
      hand(((secs / 3600) % 12) / 12 * Math.PI * 2, R * 0.5, p.size * 0.03, p.color);
      hand(((secs / 60) % 60) / 60 * Math.PI * 2, R * 0.72, p.size * 0.02, p.color);
    } else hand(((secs / 60) % 60) / 60 * Math.PI * 2, R * 0.5, p.size * 0.025, p.color);
    hand((secs % 60) / 60 * Math.PI * 2, R * 0.8, p.size * 0.008, p.accent);
    ctx.fillStyle = p.accent; ctx.beginPath(); ctx.arc(cx, cy, p.size * 0.025, 0, Math.PI * 2); ctx.fill();
  },
};

// ------------------------------------------------------------------ éléments UI / social
const UI_H = { lowerThird: 150, title: 300, banner: 140, subtitle: 130, chatBubble: 170, notification: 150, button: 110, badge: 80, sticker: 200, socialHandle: 170, callout: 170, quote: 260 };
const ui = {
  box(r) { const p = r.props; const w = p.template === 'sticker' ? p.width : p.width; return { w, h: UI_H[p.template] || 160, pad: 30 }; },
  draw(ctx, r, env, box) {
    const p = r.props, W = box.w, H = box.h;
    const a = p.animate ? ease('easeOutCubic', r.sourceTime / (p.animDuration || 0.6)) : 1;
    const a2 = p.animate ? ease('easeOutCubic', (r.sourceTime - (p.animDuration || 0.6) * 0.4) / (p.animDuration || 0.6)) : 1;
    const font = (w, s) => `${w} ${s}px ${p.fontFamily || 'Inter'}, Inter, sans-serif`;
    ctx.textBaseline = 'middle';
    switch (p.template) {
      case 'lowerThird': {
        ctx.fillStyle = p.background; roundRect(ctx, 0, 0, W * a, H, 10); ctx.fill();
        ctx.fillStyle = p.accent; ctx.fillRect(0, 0, 10, H * a);
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W * a, H); ctx.clip();
        ctx.globalAlpha = a2; ctx.fillStyle = p.textColor; ctx.font = font(800, 56); ctx.fillText(p.title, 40, H * 0.36);
        ctx.fillStyle = p.accent; ctx.font = font(500, 34); ctx.fillText(p.subtitle, 40, H * 0.72); ctx.restore(); break;
      }
      case 'title': {
        ctx.textAlign = 'center'; ctx.globalAlpha = a; ctx.fillStyle = p.textColor; ctx.font = font(900, 130); ctx.fillText(p.title, W / 2, H * 0.4);
        ctx.fillStyle = p.accent; ctx.fillRect(W / 2 - (W * 0.3 * a) / 2, H * 0.66, W * 0.3 * a, 8);
        ctx.globalAlpha = a2; ctx.fillStyle = p.textColor; ctx.font = font(400, 46); ctx.fillText(p.subtitle, W / 2, H * 0.86); break;
      }
      case 'banner': {
        ctx.fillStyle = p.background; ctx.fillRect(0, H * (1 - a) / 2, W, H * a);
        ctx.globalAlpha = a2; ctx.fillStyle = p.textColor; ctx.font = font(900, 64); ctx.textAlign = 'left'; ctx.fillText(p.title, 60, H / 2);
        ctx.font = font(600, 40); ctx.textAlign = 'right'; ctx.fillText(p.subtitle, W - 60, H / 2); break;
      }
      case 'subtitle': {
        ctx.font = font(600, 46); ctx.textAlign = 'center';
        const tw = Math.min(W, ctx.measureText(p.title).width + 60);
        ctx.globalAlpha = a; ctx.fillStyle = p.background; roundRect(ctx, (W - tw) / 2, 10, tw, H - 20, 12); ctx.fill();
        ctx.fillStyle = p.textColor; ctx.fillText(p.title, W / 2, H / 2, W - 40); break;
      }
      case 'chatBubble': {
        const s = getEasing('easeOutBack')(Math.min(1, r.sourceTime / (p.animDuration || 0.6)));
        ctx.translate(30, H); ctx.scale(p.animate ? s : 1, p.animate ? s : 1); ctx.translate(-30, -H);
        ctx.fillStyle = p.background; roundRect(ctx, 0, 0, W, H - 30, 36); ctx.fill();
        ctx.beginPath(); ctx.moveTo(30, H - 34); ctx.lineTo(20, H); ctx.lineTo(80, H - 34); ctx.fill();
        ctx.fillStyle = p.textColor; ctx.font = font(500, 38); ctx.textAlign = 'left'; ctx.fillText(p.title, 36, (H - 30) * 0.42, W - 60);
        ctx.fillStyle = p.accent; ctx.font = font(500, 24); ctx.fillText(p.subtitle, 36, (H - 30) * 0.78); break;
      }
      case 'notification': {
        ctx.translate(0, -(1 - a) * 200); ctx.globalAlpha = a;
        ctx.fillStyle = p.background; roundRect(ctx, 0, 0, W, H, 28); ctx.fill();
        ctx.fillStyle = p.accent; roundRect(ctx, 26, 26, H - 52, H - 52, 20); ctx.fill();
        ctx.fillStyle = '#050505'; ctx.font = font(900, 44); ctx.textAlign = 'center'; ctx.fillText(p.icon || '★', 26 + (H - 52) / 2, H / 2);
        ctx.textAlign = 'left'; ctx.fillStyle = p.textColor; ctx.font = font(700, 34); ctx.fillText(p.title, H + 10, H * 0.36);
        ctx.fillStyle = '#8A8A8A'; ctx.font = font(400, 30); ctx.fillText(p.subtitle, H + 10, H * 0.68, W - H - 30); break;
      }
      case 'button': case 'badge': {
        const s = getEasing('easeOutBack')(Math.min(1, r.sourceTime / (p.animDuration || 0.6)));
        const pulse = 1 + 0.03 * Math.sin(r.sourceTime * 6);
        ctx.translate(W / 2, H / 2); ctx.scale((p.animate ? s : 1) * pulse, (p.animate ? s : 1) * pulse); ctx.translate(-W / 2, -H / 2);
        ctx.fillStyle = p.background; roundRect(ctx, 0, 0, W, H, H / 2); ctx.fill();
        ctx.fillStyle = p.textColor; ctx.font = font(800, H * 0.4); ctx.textAlign = 'center'; ctx.fillText(p.title, W / 2, H / 2); break;
      }
      case 'sticker': {
        const s = getEasing('easeOutElastic')(Math.min(1, r.sourceTime / (p.animDuration || 0.6) / 1.5));
        ctx.translate(W / 2, H / 2); ctx.rotate(-0.12); ctx.scale(p.animate ? s : 1, p.animate ? s : 1);
        ctx.beginPath();
        for (let i = 0; i < 24; i++) { const ang = (i / 24) * Math.PI * 2; const rr = (i % 2 ? 0.86 : 1) * Math.min(W, H) / 2; ctx.lineTo(Math.cos(ang) * rr * (W / H), Math.sin(ang) * rr); }
        ctx.closePath(); ctx.fillStyle = p.background; ctx.fill(); ctx.lineWidth = 8; ctx.strokeStyle = '#050505'; ctx.stroke();
        ctx.fillStyle = p.textColor; ctx.font = font(900, H * 0.3); ctx.textAlign = 'center'; ctx.fillText(p.title, 0, 0); break;
      }
      case 'socialHandle': {
        ctx.globalAlpha = a; ctx.fillStyle = p.background; roundRect(ctx, 0, 0, W, H, H / 2); ctx.fill();
        ctx.fillStyle = p.accent; ctx.beginPath(); ctx.arc(H / 2, H / 2, H * 0.36, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#050505'; ctx.font = font(900, H * 0.36); ctx.textAlign = 'center'; ctx.fillText('@', H / 2, H / 2);
        ctx.textAlign = 'left'; ctx.globalAlpha = a2; ctx.fillStyle = p.textColor; ctx.font = font(800, 48); ctx.fillText(p.title, H + 10, H * 0.4);
        ctx.fillStyle = '#8A8A8A'; ctx.font = font(500, 28); ctx.fillText(p.subtitle, H + 10, H * 0.72); break;
      }
      case 'callout': {
        ctx.globalAlpha = a; ctx.strokeStyle = p.accent; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(60 * a, H - 60 * a); ctx.lineTo(60 + (W - 60) * a, H - 60 * a); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, H, 10, 0, Math.PI * 2); ctx.fillStyle = p.accent; ctx.fill();
        ctx.globalAlpha = a2; ctx.fillStyle = p.textColor; ctx.font = font(800, 40); ctx.fillText(p.title, 70, H - 100);
        ctx.fillStyle = '#8A8A8A'; ctx.font = font(400, 28); ctx.fillText(p.subtitle, 70, H - 30 - 60 * 0 - 10); break;
      }
      case 'quote': {
        ctx.globalAlpha = a; ctx.fillStyle = p.accent; ctx.font = font(900, 200); ctx.fillText('“', 0, 80);
        ctx.fillStyle = p.textColor; ctx.font = font(600, 64); ctx.textAlign = 'center'; ctx.fillText(p.title, W / 2, H * 0.45, W - 40);
        ctx.globalAlpha = a2; ctx.fillStyle = p.accent; ctx.font = font(500, 36); ctx.fillText(p.subtitle, W / 2, H * 0.82); break;
      }
      default: break;
    }
  },
};

// ------------------------------------------------------------------ graphiques
export function parseChartData(d) {
  if (Array.isArray(d)) return d.map((x, i) => (typeof x === 'number' ? { label: String(i + 1), value: x } : { label: String(x.label ?? i + 1), value: +x.value || 0 }));
  if (typeof d === 'string') {
    const s = d.trim();
    if (s.startsWith('[') || s.startsWith('{')) { try { const j = JSON.parse(s); return parseChartData(Array.isArray(j) ? j : Object.entries(j).map(([label, value]) => ({ label, value }))); } catch { return []; } }
    return s.split(/\r?\n/).map((l) => l.split(/[,;\t]/)).filter((c) => c.length >= 2 && !Number.isNaN(parseFloat(c[1]))).map((c) => ({ label: c[0].trim(), value: parseFloat(c[1]) }));
  }
  return [];
}
const chart = {
  box(r) { return { w: r.props.width, h: r.props.height, pad: 10 }; },
  draw(ctx, r, env, box) {
    const p = r.props, data = parseChartData(p.data);
    if (!data.length) return;
    const W = box.w, H = box.h, n = data.length;
    const maxV = Math.max(...data.map((d) => d.value), 1e-9), minV = Math.min(0, ...data.map((d) => d.value));
    const prog = (i) => {
      const base = p.autoAnimate ? (r.sourceTime - i * (p.stagger || 0)) / (p.animDuration || 1) : 1;
      return ease('easeOutCubic', base) * (p.progress ?? 1);
    };
    const col = (i) => p.colors[i % p.colors.length];
    const fs = p.fontSize || 24;
    ctx.font = `600 ${fs}px Inter, sans-serif`;
    ctx.fillStyle = p.textColor; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const fmt = (v) => `${p.valuePrefix || ''}${Number.isInteger(v) ? v : v.toFixed(1)}${p.valueSuffix || ''}`;
    const labelH = p.showLabels ? fs * 1.6 : 0, valH = p.showValues ? fs * 1.4 : 0;
    if (p.chartType === 'bar' || p.chartType === 'hbar') {
      const horiz = p.chartType === 'hbar';
      ctx.strokeStyle = p.gridColor; ctx.lineWidth = 1;
      for (let g = 0; g <= 4; g++) { ctx.beginPath(); if (horiz) { const x = 120 + (W - 140) * g / 4; ctx.moveTo(x, 0); ctx.lineTo(x, H); } else { const y = valH + (H - labelH - valH) * g / 4; ctx.moveTo(0, y); ctx.lineTo(W, y); } ctx.stroke(); }
      data.forEach((d, i) => {
        const v = d.value * prog(i);
        ctx.fillStyle = col(i);
        if (horiz) {
          const bh = (H / n) * 0.7, y = (H / n) * i + (H / n) * 0.15, bw = ((W - 140 - 80) * v) / maxV;
          roundRect(ctx, 120, y, Math.max(0, bw), bh, 6); ctx.fill();
          ctx.fillStyle = p.textColor; ctx.textAlign = 'right'; if (p.showLabels) ctx.fillText(d.label, 110, y + bh / 2);
          ctx.textAlign = 'left'; if (p.showValues) ctx.fillText(fmt(v), 130 + bw, y + bh / 2);
        } else {
          const bw = (W / n) * 0.62, x = (W / n) * i + (W / n) * 0.19, ch = H - labelH - valH, bh = (ch * v) / maxV;
          roundRect(ctx, x, valH + ch - bh, bw, Math.max(0, bh), [8, 8, 0, 0]); ctx.fill();
          ctx.fillStyle = p.textColor;
          if (p.showLabels) ctx.fillText(d.label, x + bw / 2, H - labelH / 2);
          if (p.showValues && prog(i) > 0.02) ctx.fillText(fmt(v), x + bw / 2, valH + ch - bh - fs * 0.7);
        }
      });
    } else if (p.chartType === 'line' || p.chartType === 'area') {
      const ch = H - labelH - valH, pts = data.map((d, i) => ({ x: (W * (i + 0.5)) / n, y: valH + ch - ((d.value - minV) / (maxV - minV)) * ch }));
      const pr = prog(0);
      const total = (n - 1) * pr;
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, pts[0].x + (pts[n - 1].x - pts[0].x) * pr + 2, H); ctx.clip();
      if (p.chartType === 'area') {
        const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, col(0) + '99'); g.addColorStop(1, col(0) + '00');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(pts[0].x, valH + ch); pts.forEach((q) => ctx.lineTo(q.x, q.y)); ctx.lineTo(pts[n - 1].x, valH + ch); ctx.closePath(); ctx.fill();
      }
      ctx.strokeStyle = col(0); ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke();
      ctx.restore();
      pts.forEach((q, i) => {
        if (i > total + 1e-6) return;
        ctx.fillStyle = col(1 % p.colors.length); ctx.beginPath(); ctx.arc(q.x, q.y, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = p.textColor;
        if (p.showValues) ctx.fillText(fmt(data[i].value), q.x, q.y - fs);
        if (p.showLabels) ctx.fillText(data[i].label, q.x, H - labelH / 2);
      });
    } else if (p.chartType === 'pie' || p.chartType === 'donut') {
      const total = data.reduce((s, d) => s + Math.max(0, d.value), 0) || 1;
      const R = Math.min(W * 0.5, H) / 2 - 10, cx = R + 10, cy = H / 2;
      let a0 = -Math.PI / 2;
      const pr = prog(0);
      data.forEach((d, i) => {
        const a1 = a0 + (Math.max(0, d.value) / total) * Math.PI * 2 * pr;
        ctx.fillStyle = col(i); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, a0, a1); ctx.closePath(); ctx.fill();
        a0 = a1;
        const ly = 30 + i * fs * 1.6;
        if (p.showLabels) { ctx.fillStyle = col(i); ctx.fillRect(cx + R + 40, ly - fs / 3, fs * 0.7, fs * 0.7); ctx.fillStyle = p.textColor; ctx.textAlign = 'left'; ctx.fillText(`${d.label}${p.showValues ? ` — ${fmt(d.value)}` : ''}`, cx + R + 40 + fs, ly); }
      });
      if (p.chartType === 'donut') { ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(cx, cy, R * 0.55, 0, Math.PI * 2); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
    } else if (p.chartType === 'radar') {
      const R = Math.min(W, H) / 2 - fs * 2, cx = W / 2, cy = H / 2;
      ctx.strokeStyle = p.gridColor; ctx.lineWidth = 2;
      for (let g = 1; g <= 4; g++) { ctx.beginPath(); for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2 - Math.PI / 2; ctx.lineTo(cx + Math.cos(a) * R * g / 4, cy + Math.sin(a) * R * g / 4); } ctx.stroke(); }
      const pr = prog(0);
      ctx.beginPath();
      data.forEach((d, i) => { const a = (i / n) * Math.PI * 2 - Math.PI / 2; const rr = (R * d.value * pr) / maxV; ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); });
      ctx.closePath(); ctx.fillStyle = col(0) + '66'; ctx.fill(); ctx.strokeStyle = col(0); ctx.lineWidth = 4; ctx.stroke();
      ctx.fillStyle = p.textColor;
      if (p.showLabels) data.forEach((d, i) => { const a = (i / n) * Math.PI * 2 - Math.PI / 2; ctx.fillText(d.label, cx + Math.cos(a) * (R + fs), cy + Math.sin(a) * (R + fs)); });
    }
  },
};

// ------------------------------------------------------------------ bloc de code
const KW = /\b(const|let|var|function|return|await|async|if|else|for|while|import|from|export|class|new|def|fn|pub|struct|impl|true|false|null|None|self|this|void|float|vec2|vec3|vec4|uniform|in|out)\b/g;
const THEMES = { dark: { bg: '#0D0D0D', fg: '#EDEDED', kw: '#24D26D', str: '#E0A526', com: '#5C6370', num: '#3DD6D0', bar: '#141414' }, light: { bg: '#FAFAFA', fg: '#1A1A1A', kw: '#0B7A3B', str: '#B35C00', com: '#999999', num: '#0066CC', bar: '#EAEAEA' }, green: { bg: '#020A05', fg: '#9CFFC1', kw: '#24D26D', str: '#E6FF80', com: '#2E6B43', num: '#7DFFB0', bar: '#06140B' } };
function tokenize(line) {
  const out = [];
  const re = /(\/\/.*$|#.*$)|("[^"]*"|'[^']*'|`[^`]*`)|(\b\d+(?:\.\d+)?\b)|(\b[A-Za-z_]\w*\b)|(\s+|.)/g;
  let m;
  while ((m = re.exec(line))) {
    if (m[1]) out.push(['com', m[1]]);
    else if (m[2]) out.push(['str', m[2]]);
    else if (m[3]) out.push(['num', m[3]]);
    else if (m[4]) out.push([KW.test(m[4]) ? 'kw' : 'fg', m[4]]), (KW.lastIndex = 0);
    else out.push(['fg', m[5]]);
  }
  return out;
}
const code = {
  box(r) { const p = r.props; const lines = String(p.code).split('\n').length; return { w: p.width, h: (lines + 2.2) * p.fontSize * 1.5, pad: 24 }; },
  draw(ctx, r, env, box) {
    const p = r.props, th = THEMES[p.theme] || THEMES.dark, fs = p.fontSize, lh = fs * 1.5;
    ctx.save(); ctx.shadowColor = '#00000088'; ctx.shadowBlur = 30; ctx.fillStyle = th.bg; roundRect(ctx, 0, 0, box.w, box.h, 14); ctx.fill(); ctx.restore();
    ctx.fillStyle = th.bar; roundRect(ctx, 0, 0, box.w, lh * 1.2, [14, 14, 0, 0]); ctx.fill();
    ['#FF5F57', '#FEBC2E', '#28C840'].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(24 + i * 26, lh * 0.6, 8, 0, Math.PI * 2); ctx.fill(); });
    ctx.fillStyle = th.com; ctx.font = `500 ${fs * 0.7}px "JetBrains Mono", monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.title || '', box.w / 2, lh * 0.6);
    ctx.textAlign = 'left'; ctx.font = `400 ${fs}px "JetBrains Mono", monospace`;
    const all = String(p.code);
    const shown = p.typing ? Math.floor(Math.max(0, r.sourceTime - (p.startAt || 0)) * (p.speed || 30)) : all.length;
    const visible = all.slice(0, shown);
    const lines = visible.split('\n');
    const gutter = p.lineNumbers ? fs * 2.6 : fs;
    const cw = ctx.measureText('M').width;
    lines.forEach((line, i) => {
      const y = lh * 1.2 + lh * (i + 0.8);
      if (p.lineNumbers) { ctx.fillStyle = th.com; ctx.fillText(String(i + 1).padStart(2, ' '), fs * 0.6, y); }
      let x = gutter;
      for (const [k, s] of tokenize(line)) { ctx.fillStyle = th[k]; ctx.fillText(s, x, y); x += cw * s.length; }
      if (p.cursor && i === lines.length - 1 && Math.floor(r.sourceTime * 2) % 2 === 0) { ctx.fillStyle = th.kw; ctx.fillRect(x + 2, y - fs * 0.55, cw * 0.6, fs * 1.1); }
    });
  },
};

// ------------------------------------------------------------------ mockups
const mockup = {
  box(r) { const p = r.props; const h = p.device === 'phone' ? p.width * 2.05 : p.device === 'tablet' ? p.width * 1.33 : p.width * 0.66; return { w: p.width, h, pad: 40 }; },
  draw(ctx, r, env, box) {
    const p = r.props, W = box.w, H = box.h;
    const img = p.assetId ? env.media?.getImageLike(p.assetId, r) : null;
    let sx = 0, sy = 0, sw = W, sh = H, rad = 0;
    ctx.save(); ctx.shadowColor = '#000000AA'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 20;
    ctx.fillStyle = p.frameColor;
    if (p.device === 'phone' || p.device === 'tablet') { rad = W * 0.13; roundRect(ctx, 0, 0, W, H, rad); ctx.fill(); ctx.restore(); const m = W * 0.045; sx = m; sy = m; sw = W - 2 * m; sh = H - 2 * m; rad = W * 0.1; }
    else if (p.device === 'laptop') { roundRect(ctx, W * 0.08, 0, W * 0.84, H * 0.9, 18); ctx.fill(); ctx.fillStyle = '#2A2A2A'; roundRect(ctx, 0, H * 0.9, W, H * 0.06, [0, 0, 20, 20]); ctx.fill(); ctx.restore(); sx = W * 0.1; sy = H * 0.03; sw = W * 0.8; sh = H * 0.84; rad = 6; }
    else { roundRect(ctx, 0, 0, W, H, 16); ctx.fill(); ctx.restore(); ctx.fillStyle = '#1F1F1F'; roundRect(ctx, 0, 0, W, 56, [16, 16, 0, 0]); ctx.fill(); ['#FF5F57', '#FEBC2E', '#28C840'].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(28 + i * 26, 28, 8, 0, Math.PI * 2); ctx.fill(); }); ctx.fillStyle = '#0D0D0D'; roundRect(ctx, 120, 12, W - 240, 32, 16); ctx.fill(); ctx.fillStyle = '#8A8A8A'; ctx.font = '500 18px Inter, sans-serif'; ctx.textBaseline = 'middle'; ctx.fillText(p.url || '', 140, 28); sx = 0; sy = 56; sw = W; sh = H - 56; rad = 0; }
    ctx.save(); roundRect(ctx, sx, sy, sw, sh, rad); ctx.clip();
    ctx.fillStyle = p.screenColor; ctx.fillRect(sx, sy, sw, sh);
    if (img && img.width) { const s = Math.max(sw / img.width, sh / img.height); ctx.drawImage(img, sx + (sw - img.width * s) / 2, sy + (sh - img.height * s) / 2, img.width * s, img.height * s); }
    else { ctx.fillStyle = '#24D26D'; ctx.font = `800 ${Math.round(sw * 0.08)}px Inter, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.title || '', sx + sw / 2, sy + sh / 2); }
    ctx.restore();
    if (p.device === 'phone') { ctx.fillStyle = p.frameColor; roundRect(ctx, W * 0.36, sy + 14, W * 0.28, W * 0.07, W * 0.035); ctx.fill(); }
  },
};

// ------------------------------------------------------------------ visualiseur audio
const audioviz = {
  box(r) { const p = r.props; return { w: p.width, h: p.style === 'circle' ? p.width : p.height, pad: 20 }; },
  draw(ctx, r, env, box) {
    const p = r.props, W = box.w, H = box.h;
    const t = env.compTime;
    const bands = Math.max(4, Math.round(p.bands));
    const spec = env.audio ? env.audio.spectrum(p.assetId || null, t, bands, p.smoothing) : new Array(bands).fill(0);
    const vals = spec.map((v) => Math.min(1, v * p.gain));
    const g = ctx.createLinearGradient(0, H, 0, 0); g.addColorStop(0, p.color); g.addColorStop(1, p.color2);
    ctx.fillStyle = g; ctx.strokeStyle = g; ctx.lineWidth = p.thickness; ctx.lineCap = 'round';
    if (p.style === 'circle') {
      const R = W * 0.25;
      vals.forEach((v, i) => { const a = (i / bands) * Math.PI * 2 - Math.PI / 2; const l = R + v * W * 0.22; ctx.beginPath(); ctx.moveTo(W / 2 + Math.cos(a) * R, H / 2 + Math.sin(a) * R); ctx.lineTo(W / 2 + Math.cos(a) * l, H / 2 + Math.sin(a) * l); ctx.stroke(); });
      ctx.beginPath(); ctx.arc(W / 2, H / 2, R * (0.9 + (vals[0] || 0) * 0.1), 0, Math.PI * 2); ctx.lineWidth = p.thickness / 2; ctx.stroke();
    } else if (p.style === 'line' || p.style === 'waveform') {
      const wave = p.style === 'waveform' && env.audio ? env.audio.waveform(p.assetId || null, t, 256) : null;
      ctx.beginPath();
      const arr = wave || vals;
      arr.forEach((v, i) => { const x = (i / (arr.length - 1)) * W; const y = wave ? H / 2 + v * H * 0.45 * p.gain : H - v * H; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.stroke();
    } else if (p.style === 'particles') {
      const amp = vals.reduce((s, v) => s + v, 0) / bands;
      for (let i = 0; i < 120; i++) { const a = i * 2.39996; const rr = (Math.sqrt(i / 120) * W) / 2 * (0.4 + amp * 0.8); ctx.globalAlpha = 0.4 + 0.6 * (vals[i % bands] || 0); ctx.beginPath(); ctx.arc(W / 2 + Math.cos(a + t) * rr, H / 2 + Math.sin(a + t) * rr * (H / W), 2 + (vals[i % bands] || 0) * 10, 0, Math.PI * 2); ctx.fill(); }
    } else {
      const bw = W / bands;
      vals.forEach((v, i) => {
        const h = Math.max(p.thickness, v * (p.mirror ? H / 2 : H));
        if (p.style === 'spectrum') { ctx.globalAlpha = 0.85; ctx.fillStyle = `hsl(${140 + (i / bands) * 120},80%,55%)`; }
        roundRect(ctx, i * bw + bw * 0.15, p.mirror ? H / 2 - h : H - h, bw * 0.7, p.mirror ? h * 2 : h, Math.min(bw * 0.35, 6)); ctx.fill();
      });
    }
  },
};

// ------------------------------------------------------------------ 3D (projection perspective, peintre)
function mesh(prim) {
  const V = [], F = [];
  if (prim === 'cube') {
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) V.push([x, y, z]);
    F.push([0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]);
  } else if (prim === 'pyramid') {
    V.push([-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1], [0, -1.2, 0]);
    F.push([0, 1, 2, 3], [0, 4, 1], [1, 4, 2], [2, 4, 3], [3, 4, 0]);
  } else if (prim === 'icosahedron') {
    const t = (1 + Math.sqrt(5)) / 2;
    [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].forEach((v) => V.push(v.map((c) => c / 1.7)));
    F.push([0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]);
  } else {
    const seg = 24, ring = prim === 'torus' ? 12 : 12;
    for (let i = 0; i <= ring; i++) for (let j = 0; j < seg; j++) {
      const u = (j / seg) * Math.PI * 2;
      if (prim === 'torus') { const v = (i / ring) * Math.PI * 2; V.push([(1 + 0.4 * Math.cos(v)) * Math.cos(u), 0.4 * Math.sin(v), (1 + 0.4 * Math.cos(v)) * Math.sin(u)]); }
      else if (prim === 'cylinder') { const y = (i / ring) * 2 - 1; V.push([Math.cos(u), y, Math.sin(u)]); }
      else { const v = (i / ring) * Math.PI; V.push([Math.sin(v) * Math.cos(u), Math.cos(v), Math.sin(v) * Math.sin(u)]); }
    }
    const rows = prim === 'torus' ? ring : ring;
    for (let i = 0; i < rows; i++) for (let j = 0; j < seg; j++) { const a = i * seg + j, b = i * seg + ((j + 1) % seg), c = (i + 1) * seg + ((j + 1) % seg), d = (i + 1) * seg + j; F.push([a, b, c, d]); }
  }
  return { V, F };
}
const meshCache = {};
const three = {
  box(r) { return { w: r.props.size * 1.8, h: r.props.size * 1.8, pad: 10 }; },
  draw(ctx, r, env, box) {
    const p = r.props;
    const m = meshCache[p.primitive] || (meshCache[p.primitive] = mesh(p.primitive));
    const t = r.sourceTime;
    const ax = ((p.rotX + p.spinX * t) * Math.PI) / 180, ay = ((p.rotY + p.spinY * t) * Math.PI) / 180, az = ((p.rotZ + p.spinZ * t) * Math.PI) / 180;
    const rotate = ([x, y, z]) => {
      let y1 = y * Math.cos(ax) - z * Math.sin(ax), z1 = y * Math.sin(ax) + z * Math.cos(ax);
      let x2 = x * Math.cos(ay) + z1 * Math.sin(ay), z2 = -x * Math.sin(ay) + z1 * Math.cos(ay);
      return [x2 * Math.cos(az) - y1 * Math.sin(az), x2 * Math.sin(az) + y1 * Math.cos(az), z2];
    };
    const R = m.V.map(rotate);
    const f = 1 / Math.tan(((p.fov || 60) * Math.PI) / 360);
    const S = p.size / 2;
    const proj = ([x, y, z]) => { const d = 3.5 + z; return [box.w / 2 + (x * f * S * 1.5) / d, box.h / 2 + (y * f * S * 1.5) / d]; };
    const base = hexToRgb(p.color);
    const light = [-0.4, -0.6, -0.7].map((v) => v / Math.hypot(0.4, 0.6, 0.7));
    const faces = m.F.map((face) => {
      const pts = face.map((i) => R[i]);
      const [a, b, c] = pts;
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const nl = Math.hypot(...n) || 1;
      const z = pts.reduce((s, q) => s + q[2], 0) / pts.length;
      return { pts, z, n: n.map((x) => x / nl) };
    }).sort((x, y) => y.z - x.z);
    ctx.lineJoin = 'round';
    for (const fc of faces) {
      const nrm = fc.n[2] > 0 ? fc.n.map((v) => -v) : fc.n;
      ctx.beginPath(); fc.pts.forEach((q, i) => { const [x, y] = proj(q); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath();
      if (p.wireframe) { ctx.strokeStyle = p.color; ctx.lineWidth = 2; ctx.stroke(); continue; }
      const lam = p.shading ? 0.3 + 0.7 * Math.max(0, nrm[0] * light[0] + nrm[1] * light[1] + nrm[2] * light[2]) : 1;
      ctx.fillStyle = `rgb(${Math.round(base[0] * 255 * lam)},${Math.round(base[1] * 255 * lam)},${Math.round(base[2] * 255 * lam)})`;
      ctx.fill();
      if (p.edgeColor && ['cube', 'pyramid', 'icosahedron'].includes(p.primitive)) { ctx.strokeStyle = p.edgeColor; ctx.lineWidth = 2; ctx.stroke(); }
    }
  },
};

// ------------------------------------------------------------------ lumière
const light = {
  box(r) { return { w: r.props.radius * 2, h: r.props.radius * 2, pad: 0 }; },
  draw(ctx, r, env, box) {
    const p = r.props;
    const g = ctx.createRadialGradient(box.w / 2, box.h / 2, 0, box.w / 2, box.h / 2, box.w / 2);
    const [cr, cg, cb] = hexToRgb(p.color).map((x) => Math.round(x * 255));
    for (let i = 0; i <= 8; i++) { const u = i / 8; g.addColorStop(u, `rgba(${cr},${cg},${cb},${Math.min(1, p.intensity * Math.pow(1 - u, p.falloff || 1.5))})`); }
    ctx.fillStyle = g; ctx.fillRect(0, 0, box.w, box.h);
  },
};

// ------------------------------------------------------------------ particules
const particles = {
  box(r) { return { w: r.props.width, h: r.props.height, pad: 0 }; },
  draw(ctx, r, env, box) {
    const sprite = r.props.sprite === 'asset' && r.props.spriteAssetId ? env.media?.getImageLike(r.props.spriteAssetId, r) : null;
    drawParticles(ctx, r.props, r.sourceTime, box.w / 2, box.h / 2, sprite);
  },
};

// ------------------------------------------------------------------ Lottie (lottie-web, rendu canvas déterministe via goToAndStop)
const lottie = {
  box(r, env) {
    const a = env.project.assets.find((x) => x.id === r.props.assetId);
    return { w: r.props.width || a?.meta?.width || 512, h: r.props.height || a?.meta?.height || 512, pad: 0 };
  },
  draw(ctx, r, env, box) {
    const inst = env.media?.getLottie(r.props.assetId, Math.ceil(box.w * env.scale), Math.ceil(box.h * env.scale));
    if (!inst) return;
    const a = env.project.assets.find((x) => x.id === r.props.assetId);
    const fps = a?.meta?.fps || 30, total = Math.max(1, Math.round((a?.meta?.duration || 1) * fps));
    let f = r.sourceTime * (r.props.speed || 1) * fps;
    f = r.props.loop ? f % total : Math.min(f, total - 1);
    inst.render(f);
    ctx.drawImage(inst.canvas, 0, 0, box.w, box.h);
  },
};

export const DRAWERS = { shape, text, counter, progress, clock, ui, chart, code, mockup, audioviz, '3d': three, light, particles, lottie };

export function isCanvasKind(kind) { return !!DRAWERS[kind]; }

// Taille "naturelle" d'un clip résolu (utilisée par les gizmos, l'alignement et le lint)
export function measureResolved(r, env) {
  const d = DRAWERS[r.kind];
  if (d) { const b = d.box(r, env || {}); return { w: b.w, h: b.h }; }
  return null;
}
