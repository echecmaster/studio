// Mise en page et rendu du texte (Canvas 2D) : multi-lignes, tracking, crénage, dégradés, contour, ombre,
// extrusion 3D simulée, texte sur tracé et animateurs par caractère / mot / ligne.
import { getEasing } from '../catalog/easings.js';
import { mulberry32 } from '../core/util.js';
import { flattenPath, pointAt } from '../core/path.js';

export function fontString(p, size = p.fontSize) {
  const fam = /\s/.test(p.fontFamily) && !/^["']/.test(p.fontFamily) ? `"${p.fontFamily}"` : p.fontFamily;
  return `${p.italic ? 'italic ' : ''}${p.fontWeight || 400} ${size}px ${fam}, Inter, system-ui, sans-serif`;
}

function transformCase(s, tt) {
  if (tt === 'uppercase') return s.toUpperCase();
  if (tt === 'lowercase') return s.toLowerCase();
  if (tt === 'capitalize') return s.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
  return s;
}

export function layoutText(ctx, p) {
  ctx.font = fontString(p);
  if ('fontKerning' in ctx) ctx.fontKerning = p.kerning === false ? 'none' : 'normal';
  const ls = p.letterSpacing || 0;
  const raw = transformCase(String(p.text ?? ''), p.textTransform);
  const measure = (s) => ctx.measureText(s).width + Math.max(0, s.length - 1) * ls;
  const lines = [];
  for (const para of raw.split('\n')) {
    if (p.maxWidth > 0) {
      let cur = '';
      for (const word of para.split(/(\s+)/)) {
        const test = cur + word;
        if (cur && measure(test.trimEnd()) > p.maxWidth) { lines.push(cur.trimEnd()); cur = word.trimStart(); } else cur = test;
      }
      lines.push(cur);
    } else lines.push(para);
  }
  const lineH = p.fontSize * (p.lineHeight || 1.2);
  const out = lines.map((text) => {
    const chars = [];
    const glyphs = [...text];
    let prefix = '';
    for (let i = 0; i < glyphs.length; i++) {
      const x = ctx.measureText(prefix).width + i * ls;
      const w = ctx.measureText(glyphs[i]).width;
      chars.push({ ch: glyphs[i], x, w });
      prefix += glyphs[i];
    }
    return { text, width: measure(text), chars };
  });
  const w = Math.max(1, ...out.map((l) => l.width));
  return { lines: out, w, h: Math.max(lineH, lineH * out.length), lineH };
}

export function textPadding(p) {
  let pad = (p.stroke?.enabled ? p.stroke.width : 0) + p.fontSize * 0.25;
  if (p.shadow?.enabled) pad += p.shadow.blur + Math.max(Math.abs(p.shadow.x), Math.abs(p.shadow.y));
  if (p.extrude?.enabled) pad += p.extrude.depth;
  if (p.background?.enabled) pad += p.background.padding;
  if (p.animator) pad += p.fontSize * 1.2;
  return pad;
}

function makeFill(ctx, p, w, h) {
  const f = p.fill || {};
  if (f.type === 'linear' || f.type === 'radial') {
    const stops = f.stops?.length ? f.stops : [{ o: 0, c: p.color }, { o: 1, c: p.color }];
    let g;
    if (f.type === 'radial') g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) / 2);
    else {
      const a = ((f.angle ?? 90) * Math.PI) / 180;
      const dx = Math.cos(a) * w / 2, dy = Math.sin(a) * h / 2;
      g = ctx.createLinearGradient(w / 2 - dx, h / 2 - dy, w / 2 + dx, h / 2 + dy);
    }
    for (const s of stops) g.addColorStop(Math.max(0, Math.min(1, s.o)), s.c);
    return g;
  }
  return p.color;
}

// État d'animation d'une unité (caractère, mot ou ligne)
function unitState(anim, idx, count, t, seed) {
  if (!anim || !anim.type || anim.type === 'none') return null;
  const order = anim.random || anim.type === 'random' ? Math.floor(mulberry32(seed + idx * 7)() * count) : idx;
  const stagger = anim.stagger ?? 0.04;
  const unitDur = Math.max(0.05, (anim.duration ?? 1) - stagger * Math.max(0, count - 1));
  const local = (t - (anim.start ?? 0) - order * stagger) / unitDur;
  const raw = Math.max(0, Math.min(1, local));
  const e = getEasing(anim.easing || 'easeOutCubic')(raw);
  const out = anim.direction === 'out';
  return { p: out ? 1 - e : e, raw: out ? 1 - raw : raw, order };
}

export function drawText(ctx, p, t, layout = null) {
  const L = layout || layoutText(ctx, p);
  const { lines, w, h, lineH } = L;
  const anim = p.animator && p.animator.type !== 'none' ? p.animator : null;
  const amount = anim?.amount ?? 1;
  const fill = makeFill(ctx, p, w, h);
  ctx.textBaseline = 'alphabetic';
  ctx.font = fontString(p);
  const ascent = p.fontSize * 0.8;

  if (p.background?.enabled) {
    const pd = p.background.padding || 0;
    ctx.save();
    ctx.fillStyle = p.background.color;
    roundRect(ctx, -pd, -pd, w + pd * 2, h + pd * 2, p.background.radius || 0);
    ctx.fill();
    ctx.restore();
  }

  // Texte sur tracé
  if (p.onPath?.points?.length > 1) {
    const pts = flattenPath(p.onPath.points.map((q) => ({ ...q, x: q.x + w / 2, y: q.y + h / 2 })), false, 24);
    const total = pts.reduce((s, q, i) => (i ? s + Math.hypot(q.x - pts[i - 1].x, q.y - pts[i - 1].y) : 0), 0);
    const text = lines.map((l) => l.text).join(' ');
    const chars = [...text];
    let d = (p.onPath.offset || 0) * total;
    ctx.fillStyle = fill;
    chars.forEach((ch, i) => {
      const cw = ctx.measureText(ch).width + (p.letterSpacing || 0);
      const st = unitState(anim, i, chars.length, t, 11);
      const pt = pointAt(pts, (d + cw / 2) / total);
      ctx.save();
      ctx.translate(pt.x, pt.y);
      ctx.rotate((pt.angle * Math.PI) / 180);
      if (st) ctx.globalAlpha *= st.p;
      if (p.stroke?.enabled) { ctx.lineWidth = p.stroke.width; ctx.strokeStyle = p.stroke.color; ctx.lineJoin = 'round'; ctx.strokeText(ch, -cw / 2, 0); }
      ctx.fillText(ch, -cw / 2, 0);
      ctx.restore();
      d += cw;
    });
    return;
  }

  // unités d'animation
  const by = anim?.by || 'char';
  const units = [];
  lines.forEach((line, li) => {
    const x0 = p.align === 'center' ? (w - line.width) / 2 : p.align === 'right' ? w - line.width : 0;
    const y = li * lineH + ascent + (lineH - p.fontSize) / 2;
    if (!anim || by === 'line') units.push({ li, parts: [{ text: line.text, x: x0, y, chars: line.chars }], cx: x0 + line.width / 2, cy: y - ascent / 2 });
    else if (by === 'word') {
      let cur = null;
      line.chars.forEach((c) => {
        if (/\s/.test(c.ch)) { cur = null; return; }
        if (!cur) { cur = { li, parts: [{ text: '', x: x0 + c.x, y, chars: [] }], cx: 0, cy: y - ascent / 2 }; units.push(cur); }
        cur.parts[0].text += c.ch;
        cur.parts[0].chars.push(c);
        cur.cx = x0 + (cur.parts[0].chars[0].x + c.x + c.w) / 2;
      });
    } else line.chars.forEach((c) => { if (!/\s/.test(c.ch)) units.push({ li, parts: [{ text: c.ch, x: x0 + c.x, y, chars: [c] }], cx: x0 + c.x + c.w / 2, cy: y - ascent / 2 }); });
  });

  const useCharLayout = (p.letterSpacing || 0) !== 0;
  const drawPart = (part, mode) => {
    if (useCharLayout && part.chars.length > 1) {
      for (const c of part.chars) { const dx = part.x + c.x - part.chars[0].x; if (mode === 'stroke') ctx.strokeText(c.ch, dx, part.y); else ctx.fillText(c.ch, dx, part.y); }
    } else if (mode === 'stroke') ctx.strokeText(part.text, part.x, part.y); else ctx.fillText(part.text, part.x, part.y);
  };
  const frame = Math.floor(t * 30);
  const SCR = '!<>-_\\/[]{}—=+*^?#ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  units.forEach((u, idx) => {
    const st = unitState(anim, idx, units.length, t, 3);
    ctx.save();
    let parts = u.parts;
    if (st) {
      const k = 1 - st.p;
      const type = anim.type;
      if (type === 'typewriter') { if (st.raw <= 0) { ctx.restore(); return; } }
      else if (type === 'fade') ctx.globalAlpha *= st.p;
      else if (type === 'slide') { ctx.translate(0, k * p.fontSize * 0.8 * amount); ctx.globalAlpha *= st.p; }
      else if (type === 'bounce') { const b = getEasing('easeOutBounce')(st.raw); ctx.translate(0, -(1 - b) * p.fontSize * 1.2 * amount); ctx.globalAlpha *= Math.min(1, st.raw * 4); }
      else if (type === 'wave') { ctx.translate(0, Math.sin(t * 5 - idx * 0.6) * p.fontSize * 0.15 * amount); ctx.globalAlpha *= st.p; }
      else if (type === 'scramble') {
        if (st.raw < 1) parts = parts.map((pt) => ({ ...pt, text: [...pt.text].map((ch, j) => (st.raw <= 0 ? '' : SCR[Math.floor(mulberry32(frame * 131 + idx * 17 + j)() * SCR.length)])).join(''), chars: [] }));
      } else if (type === 'split') { ctx.translate((idx < units.length / 2 ? -1 : 1) * k * 300 * amount, 0); ctx.globalAlpha *= st.p; }
      else if (type === 'glitch') {
        if (st.raw < 1 && st.raw > 0) { const r = mulberry32(frame * 97 + idx)(); ctx.translate((r - 0.5) * 30 * k * amount, (mulberry32(frame + idx * 3)() - 0.5) * 10 * k); ctx.globalAlpha *= r > 0.2 ? 1 : 0.3; }
        if (st.raw <= 0) { ctx.restore(); return; }
      } else if (type === 'blurIn') { if (k > 0.01 && 'filter' in ctx) ctx.filter = `blur(${(k * 16 * amount).toFixed(2)}px)`; ctx.globalAlpha *= st.p; }
      else if (type === 'maskReveal') {
        ctx.beginPath();
        ctx.rect(u.cx - 10000, u.cy - p.fontSize, 20000, p.fontSize * 1.6 * st.p + 0.01);
        ctx.clip();
        ctx.translate(0, k * p.fontSize);
      } else if (type === 'rotate3d') { ctx.translate(u.cx, u.cy); ctx.scale(1, Math.max(0.001, Math.cos(k * Math.PI / 2))); ctx.translate(-u.cx, -u.cy); ctx.globalAlpha *= st.p; }
      else if (type === 'random') { ctx.translate(u.cx, u.cy); const s = 0.3 + 0.7 * st.p; ctx.scale(s, s); ctx.translate(-u.cx, -u.cy); ctx.globalAlpha *= st.p; }
      else if (type === 'pop') { const s = getEasing('easeOutBack')(st.raw); ctx.translate(u.cx, u.cy); ctx.scale(Math.max(0.001, s), Math.max(0.001, s)); ctx.translate(-u.cx, -u.cy); ctx.globalAlpha *= Math.min(1, st.raw * 3); }
    }
    // extrusion 3D simulée
    if (p.extrude?.enabled && p.extrude.depth > 0) {
      const a = ((p.extrude.angle ?? 135) * Math.PI) / 180;
      ctx.fillStyle = p.extrude.color;
      for (let d = p.extrude.depth; d >= 1; d -= 1) {
        ctx.save(); ctx.translate(Math.cos(a) * d, Math.sin(a) * d);
        for (const part of parts) drawPart(part, 'fill');
        ctx.restore();
      }
    }
    if (p.shadow?.enabled) {
      ctx.shadowColor = p.shadow.color;
      ctx.shadowBlur = p.shadow.blur;
      ctx.shadowOffsetX = p.shadow.x;
      ctx.shadowOffsetY = p.shadow.y;
    }
    if (p.stroke?.enabled && p.stroke.width > 0) {
      ctx.lineWidth = p.stroke.width;
      ctx.strokeStyle = p.stroke.color;
      ctx.lineJoin = 'round';
      for (const part of parts) drawPart(part, 'stroke');
      ctx.shadowColor = 'transparent';
    }
    ctx.fillStyle = fill;
    for (const part of parts) drawPart(part, 'fill');
    if (st && anim.type === 'glitch' && st.raw > 0 && st.raw < 1) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha *= 0.6;
      ctx.fillStyle = '#ff0040'; ctx.translate(4, 0); for (const part of parts) drawPart(part, 'fill');
      ctx.fillStyle = '#00e0ff'; ctx.translate(-8, 0); for (const part of parts) drawPart(part, 'fill');
    }
    ctx.restore();
  });

  // curseur de machine à écrire
  if (anim?.type === 'typewriter' && units.length) {
    const visible = units.filter((u, i) => unitState(anim, i, units.length, t, 3).raw > 0);
    const last = visible[visible.length - 1] || units[0];
    const blink = Math.floor(t * 2) % 2 === 0;
    const done = visible.length === units.length && t > (anim.start || 0) + (anim.duration || 1) + 1.5;
    if (blink && !done) {
      const part = last.parts[0];
      const cx = visible.length ? part.x + ctx.measureText(part.text).width + 4 : part.x;
      ctx.fillStyle = typeof fill === 'string' ? fill : p.color;
      ctx.fillRect(cx, part.y - ascent, Math.max(2, p.fontSize * 0.06), p.fontSize * 0.95);
    }
  }
}

export function roundRect(ctx, x, y, w, h, r) {
  const rr = Array.isArray(r) ? r : [r, r, r, r];
  const m = Math.min(w, h) / 2;
  const [a, b, c, d] = rr.map((v) => Math.max(0, Math.min(v || 0, m)));
  ctx.beginPath();
  ctx.moveTo(x + a, y);
  ctx.lineTo(x + w - b, y); ctx.arcTo(x + w, y, x + w, y + b, b);
  ctx.lineTo(x + w, y + h - c); ctx.arcTo(x + w, y + h, x + w - c, y + h, c);
  ctx.lineTo(x + d, y + h); ctx.arcTo(x, y + h, x, y + h - d, d);
  ctx.lineTo(x, y + a); ctx.arcTo(x, y, x + a, y, a);
  ctx.closePath();
}
