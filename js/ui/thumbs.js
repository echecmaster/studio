// Miniatures animées de la bibliothèque, rendues par le VRAI moteur (mêmes shaders que la composition)
import { Renderer } from '../render/renderer.js';
import { createProject, normalizeClip, defaultTransform } from '../core/schema.js';
import { defaultEffectParams } from '../catalog/effects.js';
import { defaultTransitionParams } from '../catalog/transitions.js';
import { applyAnimationPreset } from '../catalog/animPresets.js';
import { libraryProps } from '../catalog/elements.js';
import { canvasBlob } from '../export/exporter.js';

const W = 320, H = 180;
let renderer = null;
const cache = new Map();
const queue = [];
let busy = false;

function base(meta = {}) {
  const p = createProject({ meta: { width: W * 2, height: H * 2, fps: 30, duration: 4, background: '#0b0f0d', ...meta } });
  return p;
}
const clip = (p, kind, props = {}, extra = {}) => {
  const c = normalizeClip({ id: `th_${p.clips.length}`, trackId: p.tracks[0].id, kind, start: 0, duration: 4, transform: { ...defaultTransform(), ...(extra.transform || {}) }, props, ...extra });
  p.clips.push(c);
  return c;
};
function sampleBackground(p) {
  clip(p, 'generator', { type: 'meshGradient', params: { c1: '#24d26d', c2: '#0b3dff', c3: '#ff3d8b', c4: '#050505', speed: 0.4, softness: 1 }, width: W * 2, height: H * 2 }, { trackId: p.tracks[1].id });
  clip(p, 'text', { text: 'Aa', fontFamily: 'Inter', fontSize: 190, fontWeight: 900, color: '#ffffff', lineHeight: 1.1, letterSpacing: 0, align: 'center', fill: { type: 'solid' }, stroke: { enabled: false }, shadow: { enabled: false }, extrude: { enabled: false }, background: { enabled: false } });
}

export function buildThumbProject(kind, id, opts = {}) {
  const p = base();
  if (kind === 'effect') {
    sampleBackground(p);
    p.tracks.unshift({ id: 'adj', type: 'adjustment', name: 'adj', order: -1, locked: false, muted: false, solo: false, hidden: false });
    clip(p, 'adjustment', {}, { trackId: 'adj', effects: [{ id: 'fx1', type: id, enabled: true, params: defaultEffectParams(id) }] });
    p.tracks.forEach((t, i) => { t.order = i; });
  } else if (kind === 'transition') {
    p.meta.background = '#050505';
    clip(p, 'shape', { shape: 'rect', width: W * 2, height: H * 2, radius: [0, 0, 0, 0], fill: { type: 'linear', enabled: true, color: '#24d26d', stops: [{ o: 0, c: '#24d26d' }, { o: 1, c: '#0b3dff' }], angle: 30 }, stroke: { enabled: false } }, { transitionIn: { type: id, duration: 2, easing: 'linear', params: defaultTransitionParams(id) } });
  } else if (kind === 'preset') {
    p.meta.background = '#0b0f0d';
    const c = clip(p, 'shape', { shape: 'rect', width: 220, height: 160, radius: [24, 24, 24, 24], fill: { type: 'solid', enabled: true, color: '#24d26d', stops: [] }, stroke: { enabled: false } }, { duration: 2.2 });
    applyAnimationPreset(c, id, { compWidth: W * 2, compHeight: H * 2, duration: 1.2 });
    if (c.props.animator || c.kind === 'text') { /* */ }
  } else if (kind === 'element') {
    const entry = opts.entry;
    const props = libraryProps(entry, { width: W * 2, height: H * 2 });
    if (entry.kind === 'text') { props.fontSize = 110; if (props.animator) props.animator.duration = 1.4; }
    const c = clip(p, entry.kind, props);
    // ajuste l'échelle pour faire tenir l'élément
    const size = opts.measure?.(c) || null;
    if (size && size.w > 0) c.transform.scale = Math.min(1.2, (W * 1.6) / size.w, (H * 1.6) / Math.max(1, size.h));
  }
  return p;
}

function getRenderer(media) {
  if (!renderer) {
    const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(W, H) : Object.assign(document.createElement('canvas'), { width: W, height: H });
    renderer = new Renderer(c, { media, offscreen: true, log: () => {} });
  }
  return renderer;
}

export function renderThumbFrame(project, t, media, target) {
  const r = getRenderer(media);
  r.render(project, t, {});
  if (target) {
    const ctx = target.getContext('2d');
    ctx.clearRect(0, 0, target.width, target.height);
    ctx.drawImage(r.canvas, 0, 0, target.width, target.height);
  }
  return r.canvas;
}

export function thumbTime(kind, id) {
  if (kind === 'transition') return 1.1;
  if (kind === 'preset') return id.includes('Out') || /out|fall|hinge|shrink/i.test(id) ? 1.6 : 0.6;
  return 1.2;
}

// Miniature statique (mise en file, rendu asynchrone)
export function thumbnail(key, build, t, media) {
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  return new Promise((resolve) => { queue.push({ key, build, t, media, resolve }); pump(); });
}

async function pump() {
  if (busy) return;
  busy = true;
  while (queue.length) {
    const job = queue.shift();
    if (cache.has(job.key)) { job.resolve(cache.get(job.key)); continue; }
    try {
      const p = job.build();
      const cv = renderThumbFrame(p, job.t, job.media);
      const blob = await canvasBlob(cv, 'image/jpeg', 0.8);
      const url = URL.createObjectURL(blob);
      cache.set(job.key, url);
      job.resolve(url);
    } catch (e) { job.resolve(null); }
    await new Promise((r) => setTimeout(r, 0));
  }
  busy = false;
}

// Animation au survol : rend en boucle dans un canvas posé sur la vignette
export function animateOnHover(el, build, media, duration = 2.4) {
  let raf = 0, cv = null, project = null, t0 = 0;
  el.addEventListener('pointerenter', () => {
    project ||= build();
    const thumb = el.querySelector('.thumb');
    cv = document.createElement('canvas');
    cv.width = W / 2; cv.height = H / 2;
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
    thumb.style.position = 'relative';
    thumb.append(cv);
    t0 = performance.now();
    const loop = () => { const t = ((performance.now() - t0) / 1000) % duration; renderThumbFrame(project, t, media, cv); raf = requestAnimationFrame(loop); };
    loop();
  });
  el.addEventListener('pointerleave', () => { cancelAnimationFrame(raf); cv?.remove(); cv = null; });
}
