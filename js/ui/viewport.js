// Viewport temps réel : rendu WebGL2, gizmos (déplacement, échelle, rotation, ancre, inclinaison, Bézier), outils,
// guides intelligents, règles, grille, zones de sécurité, zoom/pan, qualité adaptative, cache de pré-calcul.
import { h, iconBtn, contextMenu } from './dom.js';
import { icon } from './icons.js';
import { Renderer } from '../render/renderer.js';
import { mat4 } from '../render/gl.js';
import { resolveClip, visibleClipsAt } from '../core/evaluate.js';
import { formatTimecode } from '../core/util.js';

export class Viewport {
  constructor(app, root) {
    this.app = app;
    this.bus = app.bus;
    this.root = root;
    this.frameCache = new Map();
    this.cacheVersion = -1;
    this.slowFrames = new Set();
    this.fpsSamples = [];
    this.autoScale = 1;
    this.build();
    this.renderer = new Renderer(this.canvas, { media: app.media, audio: app.analysis, log: app.log });
    app.renderer = this.renderer;
    this.bus.project.subscribe(() => this.invalidate());
    this.bus.app.subscribe((s, p) => {
      if (s.time !== p.time || s.viewport !== p.viewport || s.quality !== p.quality || s.selection !== p.selection) this.requestRender();
      if (s.viewport !== p.viewport) this.layout();
      if (s.tool !== p.tool) this.updateToolCursor();
    });
    new ResizeObserver(() => { this.layout(); this.requestRender(); }).observe(this.vp);
    this.layout();
    this.updateToolCursor();
  }

  build() {
    const tools = [['select', 'cursor', 'Sélection (V)'], ['text', 'text', 'Texte (T)'], ['rect', 'rect', 'Rectangle (R)'], ['ellipse', 'ellipse', 'Ellipse (E)'], ['pen', 'pen', 'Plume (P)'], ['hand', 'hand', 'Main (H / Espace)']];
    this.toolBtns = {};
    const bar = h('div', { class: 'vp-toolbar', role: 'toolbar', 'aria-label': 'Outils du viewport' });
    for (const [id, ic, label] of tools) {
      const b = iconBtn(ic, label, () => this.bus.run('tool.set', { tool: id }), { class: 'ghost sm', cmd: 'tool.set' });
      this.toolBtns[id] = b;
      bar.append(b);
    }
    bar.append(h('span', { class: 'sep' }));
    const vopt = (key, ic, label) => {
      const b = iconBtn(ic, label, () => this.bus.run('view.set', { [key]: !this.bus.app.get().viewport[key] }), { class: 'ghost sm', cmd: 'view.set' });
      b.dataset.vkey = key;
      return b;
    };
    this.optBtns = [vopt('guides', 'guides', 'Guides'), vopt('safeZones', 'safe', 'Zones de sécurité'), vopt('grid', 'grid', 'Grille'), vopt('rulers', 'marker', 'Règles'), vopt('checker', 'layers', 'Damier de transparence'), vopt('clean', 'eye', 'Aperçu propre (sans gizmos)')];
    bar.append(...this.optBtns);
    bar.append(h('span', { class: 'sep' }));
    this.quality = h('select', { class: 'input', 'aria-label': 'Qualité de preview', title: 'Qualité de preview', onchange: (e) => this.bus.run('view.set', { quality: e.target.value }), dataset: { cmd: 'view.set' } },
      ...[['auto', 'Auto'], ['full', 'Pleine'], ['half', 'Demi'], ['quarter', 'Quart']].map(([v, l]) => h('option', { value: v }, l)));
    this.zoomSel = h('select', { class: 'input', 'aria-label': 'Zoom du viewport', onchange: (e) => this.bus.run('view.fit', { zoom: e.target.value === 'fit' ? undefined : +e.target.value }), dataset: { cmd: 'view.fit' } },
      ...[['fit', 'Ajuster'], ['0.25', '25 %'], ['0.5', '50 %'], ['1', '100 %'], ['2', '200 %']].map(([v, l]) => h('option', { value: v }, l)));
    this.viewSel = h('select', { class: 'input', 'aria-label': 'Vue', onchange: (e) => this.bus.run('view.set', { view: e.target.value }), dataset: { cmd: 'view.set' } },
      ...[['color', 'Couleur'], ['alpha', 'Alpha'], ['histogram', 'Histogramme'], ['waveform', 'Forme d\'onde'], ['vectorscope', 'Vectorscope']].map(([v, l]) => h('option', { value: v }, l)));
    this.safeSel = h('select', { class: 'input hide-small', 'aria-label': 'Type de zone de sécurité', onchange: (e) => this.bus.run('view.set', { safeZoneType: e.target.value, safeZones: true }), dataset: { cmd: 'view.set' } },
      ...[['title-action', 'Titre/action'], ['16:9', '16:9'], ['9:16', '9:16'], ['1:1', '1:1'], ['4:5', '4:5']].map(([v, l]) => h('option', { value: v }, l)));
    bar.append(this.quality, this.zoomSel, this.viewSel, this.safeSel);
    bar.append(h('span', { class: 'sep' }));
    this.compareBtn = iconBtn('compare', 'Avant / après (effets du calque sélectionné)', () => {
      const v = this.bus.app.get().viewport;
      const sel = this.bus.app.get().selection[0];
      this.bus.run('view.set', { compare: v.compare ? null : sel ? { clipId: sel, effectId: null, split: 0.5 } : null });
    }, { class: 'ghost sm', cmd: 'view.set' });
    this.isolateBtn = iconBtn('isolate', 'Isoler le calque sélectionné', () => {
      const v = this.bus.app.get().viewport;
      this.bus.run('view.set', { isolate: v.isolate ? null : this.bus.app.get().selection[0] || null });
    }, { class: 'ghost sm', cmd: 'view.set' });
    bar.append(this.compareBtn, this.isolateBtn, iconBtn('fit', 'Ajuster à l\'écran', () => this.bus.run('view.fit', {}), { class: 'ghost sm', cmd: 'view.fit' }),
      iconBtn('fullscreen', 'Plein écran du viewport', () => this.bus.run('view.fullscreen', {}), { class: 'ghost sm', cmd: 'view.fullscreen' }));
    this.vp = h('div', { id: 'viewport', tabindex: 0, 'aria-label': 'Viewport : aperçu temps réel' });
    this.stage = h('div', { class: 'stage' });
    this.canvas = h('canvas', { class: 'main', 'aria-label': 'Rendu de la composition' });
    this.cacheCanvas = h('canvas', { class: 'main', style: { display: 'none' } });
    this.stage.append(this.canvas, this.cacheCanvas);
    this.overlay = h('canvas', { class: 'overlay' });
    this.fpsChip = h('span', { class: 'chip' }, '— i/s');
    this.msChip = h('span', { class: 'chip' }, '— ms');
    this.resChip = h('span', { class: 'chip hide-small' }, '');
    this.hud = h('div', { class: 'hud' }, this.fpsChip, this.msChip, this.resChip);
    this.vp.append(this.stage, this.overlay, this.hud);
    this.root.append(bar, this.vp);
    this.bindPointer();
  }

  updateToolCursor() {
    const tool = this.bus.app.get().tool;
    this.vp.className = `tool-${tool}`;
    for (const [id, b] of Object.entries(this.toolBtns)) b.setAttribute('aria-pressed', String(id === tool));
  }

  // ---------------------------------------------------------------- géométrie écran
  layout() {
    const p = this.bus.project.get();
    const v = this.bus.app.get().viewport;
    const W = p.meta.width, H = p.meta.height;
    const rect = this.vp.getBoundingClientRect();
    const fit = Math.min((rect.width - 40) / W, (rect.height - 40) / H);
    this.zoom = v.zoom === 'fit' || !v.zoom ? Math.max(0.02, fit) : +v.zoom;
    this.ox = (rect.width - W * this.zoom) / 2 + (v.panX || 0);
    this.oy = (rect.height - H * this.zoom) / 2 + (v.panY || 0);
    Object.assign(this.stage.style, { left: `${this.ox}px`, top: `${this.oy}px`, width: `${W * this.zoom}px`, height: `${H * this.zoom}px` });
    this.stage.classList.toggle('checker', !!v.checker);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.overlay.width = Math.round(rect.width * dpr);
    this.overlay.height = Math.round(rect.height * dpr);
    this.dpr = dpr;
    this.zoomSel.value = v.zoom === 'fit' ? 'fit' : String(v.zoom);
    for (const b of this.optBtns) b.setAttribute('aria-pressed', String(!!v[b.dataset.vkey]));
    this.compareBtn.setAttribute('aria-pressed', String(!!v.compare));
    this.isolateBtn.setAttribute('aria-pressed', String(!!v.isolate));
    this.viewSel.value = v.view || 'color';
    this.safeSel.value = v.safeZoneType || 'title-action';
    this.quality.value = this.bus.app.get().quality;
  }

  compToScreen(x, y) { return [this.ox + x * this.zoom, this.oy + y * this.zoom]; }
  screenToComp(sx, sy) { return [(sx - this.ox) / this.zoom, (sy - this.oy) / this.zoom]; }

  previewScale() {
    const q = this.bus.app.get().quality;
    const base = Math.min(1, this.zoom * this.dpr);
    if (q === 'full') return Math.min(1, this.zoom * this.dpr * 1.0) || 1;
    if (q === 'half') return base * 0.5;
    if (q === 'quarter') return base * 0.25;
    return base * this.autoScale;
  }

  // ---------------------------------------------------------------- rendu
  invalidate() { this.frameCache.clear(); this.slowFrames.clear(); this.app.timeline?.drawCacheBar?.(); this.requestRender(); }
  requestRender() {
    if (this.pending) return;
    this.pending = true;
    requestAnimationFrame(() => { this.pending = false; this.draw(); });
  }

  draw() {
    const p = this.bus.project.get();
    const s = this.bus.app.get();
    const v = s.viewport;
    const sc = this.previewScale();
    const w = Math.max(16, Math.round(p.meta.width * sc)), hh = Math.max(16, Math.round(p.meta.height * sc));
    const fi = Math.round(s.time * p.meta.fps);
    const cached = s.playing && this.frameCache.get(fi);
    if (cached) {
      this.cacheCanvas.style.display = 'block';
      if (this.cacheCanvas.width !== cached.width) { this.cacheCanvas.width = cached.width; this.cacheCanvas.height = cached.height; }
      this.cacheCanvas.getContext('2d').drawImage(cached, 0, 0);
    } else {
      this.cacheCanvas.style.display = 'none';
      this.renderer.resize(w, hh);
      try {
        this.renderer.render(p, s.time, { playing: s.playing, view: v.view === 'alpha' ? 'alpha' : 'color', compare: v.compare, isolate: v.isolate, fontsVersion: this.app.fontsVersion });
      } catch (e) { this.app.log('error', `Rendu : ${e.message}`); }
      const ms = this.renderer.stats.lastMs;
      if (ms > 1000 / p.meta.fps) this.slowFrames.add(fi);
      this.app.afterRender?.(this.canvas);
      // qualité adaptative (mode Auto) : vise 60 i/s pendant la lecture
      if (s.quality === 'auto' && s.playing) {
        if (this.renderer.stats.frameMs > 22 && this.autoScale > 0.26) this.autoScale *= 0.85;
        else if (this.renderer.stats.frameMs < 9 && this.autoScale < 1) this.autoScale = Math.min(1, this.autoScale * 1.1);
      } else if (!s.playing && this.autoScale < 1 && s.quality === 'auto') { this.autoScale = 1; this.requestRender(); }
    }
    const now = performance.now();
    this.fpsSamples.push(now);
    while (this.fpsSamples.length && now - this.fpsSamples[0] > 1000) this.fpsSamples.shift();
    if (s.playing) this.fpsChip.textContent = `${this.fpsSamples.length} i/s`;
    this.msChip.textContent = `${(this.renderer.stats.lastMs || 0).toFixed(1)} ms`;
    this.resChip.textContent = `${w}×${hh} · ${formatTimecode(s.time, p.meta.fps)}`;
    this.drawOverlay();
  }

  stats() {
    return { fps: this.fpsSamples.length, frameMs: +(this.renderer.stats.frameMs || 0).toFixed(2), lastMs: +(this.renderer.stats.lastMs || 0).toFixed(2), passes: this.renderer.stats.passes, layers: this.renderer.stats.layers, previewScale: +this.previewScale().toFixed(3), quality: this.bus.app.get().quality, cachedFrames: this.frameCache.size, slowFrames: this.slowFrames.size, float: this.renderer.float };
  }

  thumbnail() {
    try { this.draw(); const c = document.createElement('canvas'); c.width = 240; c.height = Math.round((240 * this.canvas.height) / this.canvas.width); c.getContext('2d').drawImage(this.canvas, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.7); } catch { return null; }
  }

  async precache(start, end) {
    const p = this.bus.project.get();
    const fps = p.meta.fps;
    const sc = this.previewScale();
    this.renderer.resize(Math.round(p.meta.width * sc), Math.round(p.meta.height * sc));
    let n = 0;
    const f0 = Math.round(start * fps), f1 = Math.round(end * fps);
    if (f1 - f0 > 1800) throw new Error('Plage trop longue pour le cache (max 1800 images).');
    for (let f = f0; f < f1; f++) {
      await this.renderer.prepare(p, f / fps, 'preview');
      this.renderer.render(p, f / fps, {});
      this.frameCache.set(f, await createImageBitmap(this.canvas));
      n++;
      if (n % 10 === 0) { this.app.timeline?.drawCacheBar?.(); await new Promise((r) => setTimeout(r, 0)); }
    }
    this.app.timeline?.drawCacheBar?.();
    this.requestRender();
    return { cached: n, from: start, to: end };
  }
  clearCache() { for (const b of this.frameCache.values()) b.close?.(); this.frameCache.clear(); this.app.timeline?.drawCacheBar?.(); }

  // ---------------------------------------------------------------- géométrie des calques
  layerQuad(clipId) {
    const env = this.renderer.lastEnv;
    if (!env) return null;
    const r = env.resolved.get(clipId);
    const box = env.boxes.get(clipId);
    if (!r || !box) return null;
    const world = this.renderer.worldMatrix(r, box, env);
    const M = mat4.mul(env.cam.P, mat4.mul(env.cam.V, world));
    const toComp = ([nx, ny]) => [((nx + 1) / 2) * env.W, ((1 - ny) / 2) * env.H];
    const pts = [[0, 0], [box.w, 0], [box.w, box.h], [0, box.h]].map(([x, y]) => toComp(mat4.apply(M, x, y)));
    const anchor = toComp(mat4.apply(M, (r.transform.anchorX ?? 0.5) * box.w, (r.transform.anchorY ?? 0.5) * box.h));
    return { pts, anchor, r, box, M, env };
  }

  hitTest(cx, cy) {
    const p = this.bus.project.get();
    const t = this.bus.app.get().time;
    const clips = visibleClipsAt(p, t).filter((c) => !['audio', 'camera', 'null', 'adjustment'].includes(c.kind)).reverse();
    for (const c of clips) {
      const q = this.layerQuad(c.id);
      if (q && pointInPoly(cx, cy, q.pts)) return c;
    }
    return null;
  }

  // ---------------------------------------------------------------- overlay
  drawOverlay() {
    const ctx = this.overlay.getContext('2d');
    const dpr = this.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const s = this.bus.app.get();
    const v = s.viewport;
    const p = this.bus.project.get();
    const W = p.meta.width, H = p.meta.height;
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#24D26D';
    const [x0, y0] = this.compToScreen(0, 0), [x1, y1] = this.compToScreen(W, H);
    if (v.view === 'histogram' || v.view === 'waveform' || v.view === 'vectorscope') this.app.scopes?.drawInto?.(ctx, v.view, x0, y0, x1 - x0, y1 - y0);
    if (v.grid) {
      ctx.strokeStyle = '#ffffff1a'; ctx.lineWidth = 1; ctx.beginPath();
      const step = W / 16;
      for (let gx = step; gx < W; gx += step) { const [sx] = this.compToScreen(gx, 0); ctx.moveTo(sx + 0.5, y0); ctx.lineTo(sx + 0.5, y1); }
      for (let gy = step; gy < H; gy += step) { const [, sy] = this.compToScreen(0, gy); ctx.moveTo(x0, sy + 0.5); ctx.lineTo(x1, sy + 0.5); }
      ctx.stroke();
    }
    if (v.guides) {
      ctx.strokeStyle = `${accent}55`; ctx.setLineDash([4, 4]); ctx.beginPath();
      const [cx, cy] = this.compToScreen(W / 2, H / 2);
      ctx.moveTo(cx + 0.5, y0); ctx.lineTo(cx + 0.5, y1); ctx.moveTo(x0, cy + 0.5); ctx.lineTo(x1, cy + 0.5); ctx.stroke(); ctx.setLineDash([]);
    }
    if (v.safeZones) {
      ctx.strokeStyle = '#ffffff66'; ctx.lineWidth = 1;
      const zone = (fx, fy, label) => { const [a, b] = this.compToScreen(W * (1 - fx) / 2, H * (1 - fy) / 2); const [c, d] = this.compToScreen(W * (1 + fx) / 2, H * (1 + fy) / 2); ctx.strokeRect(a + 0.5, b + 0.5, c - a, d - b); ctx.fillStyle = '#ffffff88'; ctx.font = '10px Inter'; ctx.fillText(label, a + 4, b + 12); };
      const type = v.safeZoneType || 'title-action';
      if (type === 'title-action') { zone(0.9, 0.9, 'Action 90 %'); zone(0.8, 0.8, 'Titre 80 %'); }
      else {
        const [rw, rh] = type.split(':').map(Number);
        const ar = rw / rh;
        let fw = 1, fh = 1;
        if (W / H > ar) fw = (H * ar) / W; else fh = W / ar / H;
        zone(fw, fh, `Recadrage ${type}`);
      }
    }
    if (v.rulers) {
      ctx.fillStyle = '#0D0D0DDD'; ctx.fillRect(0, 0, this.overlay.width / dpr, 16); ctx.fillRect(0, 0, 16, this.overlay.height / dpr);
      ctx.strokeStyle = '#5A5A5A'; ctx.fillStyle = '#8A8A8A'; ctx.font = '9px "JetBrains Mono"'; ctx.beginPath();
      const step = [10, 20, 50, 100, 200, 500, 1000].find((st) => st * this.zoom > 50) || 1000;
      for (let gx = 0; gx <= W; gx += step) { const [sx] = this.compToScreen(gx, 0); ctx.moveTo(sx + 0.5, 8); ctx.lineTo(sx + 0.5, 16); ctx.fillText(String(gx), sx + 2, 9); }
      for (let gy = 0; gy <= H; gy += step) { const [, sy] = this.compToScreen(0, gy); ctx.moveTo(8, sy + 0.5); ctx.lineTo(16, sy + 0.5); }
      ctx.stroke();
    }
    if (v.clean) return;
    // sélection + gizmos
    const sel = s.selection;
    for (const id of sel) {
      const q = this.layerQuad(id);
      if (!q) continue;
      const sp = q.pts.map(([x, y]) => this.compToScreen(x, y));
      ctx.strokeStyle = accent; ctx.lineWidth = 1.5; ctx.shadowColor = accent; ctx.shadowBlur = 6;
      ctx.beginPath(); sp.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.stroke();
      ctx.shadowBlur = 0;
      if (sel.length === 1) {
        const handles = this.handles(q);
        for (const hd of handles) {
          ctx.fillStyle = hd.type === 'rotate' ? accent : '#050505';
          ctx.strokeStyle = accent; ctx.lineWidth = 1.5;
          ctx.beginPath();
          if (hd.type === 'rotate' || hd.type === 'anchor') ctx.arc(hd.x, hd.y, hd.type === 'anchor' ? 5 : 4.5, 0, Math.PI * 2);
          else ctx.rect(hd.x - 4, hd.y - 4, 8, 8);
          ctx.fill(); ctx.stroke();
          if (hd.type === 'anchor') { ctx.beginPath(); ctx.moveTo(hd.x - 9, hd.y); ctx.lineTo(hd.x + 9, hd.y); ctx.moveTo(hd.x, hd.y - 9); ctx.lineTo(hd.x, hd.y + 9); ctx.stroke(); }
        }
        // points de tracé (formes "path") et masques
        const r = q.r;
        if (r.kind === 'shape' && (r.props.shape === 'path' || r.props.shape === 'freehand')) {
          for (const pt of this.pathHandles(q)) {
            ctx.strokeStyle = '#ffffffaa'; ctx.lineWidth = 1;
            if (pt.hin) { ctx.beginPath(); ctx.moveTo(pt.x, pt.y); ctx.lineTo(pt.hin[0], pt.hin[1]); ctx.stroke(); ctx.beginPath(); ctx.arc(pt.hin[0], pt.hin[1], 3, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); }
            if (pt.hout) { ctx.beginPath(); ctx.moveTo(pt.x, pt.y); ctx.lineTo(pt.hout[0], pt.hout[1]); ctx.stroke(); ctx.beginPath(); ctx.arc(pt.hout[0], pt.hout[1], 3, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); }
            ctx.fillStyle = accent; ctx.fillRect(pt.x - 3.5, pt.y - 3.5, 7, 7);
          }
        }
        for (const m of r.masks || []) {
          if (m.enabled === false) continue;
          ctx.strokeStyle = '#FFD23D'; ctx.setLineDash([3, 3]); ctx.beginPath();
          const lp = (x, y) => { const [cx, cy] = ((pp) => [((pp[0] + 1) / 2) * q.env.W, ((1 - pp[1]) / 2) * q.env.H])(mat4.apply(q.M, q.box.w / 2 + x, q.box.h / 2 + y)); return this.compToScreen(cx, cy); };
          if (m.type === 'rect' || m.type === 'ellipse') {
            const n = m.type === 'ellipse' ? 32 : 4;
            for (let i = 0; i <= n; i++) {
              const [x, y] = m.type === 'ellipse' ? [m.x + Math.cos((i / n) * Math.PI * 2) * m.width / 2, m.y + Math.sin((i / n) * Math.PI * 2) * m.height / 2] : [[m.x - m.width / 2, m.y - m.height / 2], [m.x + m.width / 2, m.y - m.height / 2], [m.x + m.width / 2, m.y + m.height / 2], [m.x - m.width / 2, m.y + m.height / 2], [m.x - m.width / 2, m.y - m.height / 2]][i];
              const [sx, sy] = lp(x, y); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy);
            }
          } else (m.points || []).forEach((pt, i) => { const [sx, sy] = lp(pt.x, pt.y); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); });
          ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
        }
        if (r.motionPath?.points?.length) {
          ctx.strokeStyle = '#3DD6D0aa'; ctx.setLineDash([2, 4]); ctx.beginPath();
          r.motionPath.points.forEach((pt, i) => { const [sx, sy] = this.compToScreen(W / 2 + pt.x, H / 2 + pt.y); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); });
          ctx.stroke(); ctx.setLineDash([]);
        }
      }
    }
    // guides intelligents pendant un déplacement
    if (this.snapLines?.length) {
      ctx.strokeStyle = '#FF3D8B'; ctx.lineWidth = 1; ctx.beginPath();
      for (const l of this.snapLines) {
        if (l.x !== undefined) { const [sx] = this.compToScreen(l.x, 0); ctx.moveTo(sx + 0.5, y0); ctx.lineTo(sx + 0.5, y1); }
        else { const [, sy] = this.compToScreen(0, l.y); ctx.moveTo(x0, sy + 0.5); ctx.lineTo(x1, sy + 0.5); }
      }
      ctx.stroke();
    }
    if (this.creating) {
      ctx.strokeStyle = accent; ctx.setLineDash([4, 3]);
      const { sx, sy, ex, ey, kind } = this.creating;
      ctx.beginPath();
      if (kind === 'ellipse') ctx.ellipse((sx + ex) / 2, (sy + ey) / 2, Math.abs(ex - sx) / 2, Math.abs(ey - sy) / 2, 0, 0, Math.PI * 2);
      else ctx.rect(Math.min(sx, ex), Math.min(sy, ey), Math.abs(ex - sx), Math.abs(ey - sy));
      ctx.stroke(); ctx.setLineDash([]);
    }
  }

  handles(q) {
    const sp = q.pts.map(([x, y]) => this.compToScreen(x, y));
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const out = [];
    sp.forEach(([x, y], i) => out.push({ type: 'corner', i, x, y }));
    [[0, 1], [1, 2], [2, 3], [3, 0]].forEach(([a, b], i) => { const [x, y] = mid(sp[a], sp[b]); out.push({ type: 'side', i, x, y }); });
    const top = mid(sp[0], sp[1]);
    const c = mid(sp[0], sp[2]);
    const dx = top[0] - c[0], dy = top[1] - c[1], L = Math.hypot(dx, dy) || 1;
    out.push({ type: 'rotate', x: top[0] + (dx / L) * 26, y: top[1] + (dy / L) * 26 });
    const [ax, ay] = this.compToScreen(...q.anchor);
    out.push({ type: 'anchor', x: ax, y: ay });
    return out;
  }

  pathHandles(q) {
    const pts = q.r.props.path || [];
    const tp = (x, y) => { const n = mat4.apply(q.M, q.box.w / 2 + x, q.box.h / 2 + y); return this.compToScreen(((n[0] + 1) / 2) * q.env.W, ((1 - n[1]) / 2) * q.env.H); };
    return pts.map((p, i) => {
      const [x, y] = tp(p.x, p.y);
      return { i, x, y, hin: p.ix || p.iy ? tp(p.x + (p.ix || 0), p.y + (p.iy || 0)) : null, hout: p.ox || p.oy ? tp(p.x + (p.ox || 0), p.y + (p.oy || 0)) : null };
    });
  }

  // conversion écran → repère local du calque (pour les outils de tracé)
  screenToLocal(q, sx, sy) {
    const [cx, cy] = this.screenToComp(sx, sy);
    const nx = (cx / q.env.W) * 2 - 1, ny = 1 - (cy / q.env.H) * 2;
    // inversion 2D de la matrice (approximation affine)
    const M = q.M;
    const a = M[0], b = M[1], c = M[4], d = M[5], e = M[12], f = M[13];
    const det = a * d - b * c || 1e-9;
    const lx = (d * (nx - e) - c * (ny - f)) / det, ly = (-b * (nx - e) + a * (ny - f)) / det;
    return [lx - q.box.w / 2, ly - q.box.h / 2];
  }

  // ---------------------------------------------------------------- interactions
  bindPointer() {
    const vp = this.vp;
    let spaceDown = false;
    window.addEventListener('keydown', (e) => { if (e.code === 'Space' && document.activeElement === vp) spaceDown = true; });
    window.addEventListener('keyup', (e) => { if (e.code === 'Space') spaceDown = false; });
    vp.addEventListener('wheel', (e) => {
      e.preventDefault();
      const v = this.bus.app.get().viewport;
      if (e.ctrlKey || e.metaKey || true) {
        const rect = vp.getBoundingClientRect();
        const mx = e.clientX - rect.left, my = e.clientY - rect.top;
        const [cx, cy] = this.screenToComp(mx, my);
        const z = Math.max(0.05, Math.min(8, this.zoom * Math.exp(-e.deltaY * 0.0015)));
        const p = this.bus.project.get();
        const panX = mx - cx * z - (rect.width - p.meta.width * z) / 2;
        const panY = my - cy * z - (rect.height - p.meta.height * z) / 2;
        this.bus.run('view.set', { zoom: +z.toFixed(4), panX, panY });
      }
      void v;
    }, { passive: false });
    vp.addEventListener('dblclick', (e) => {
      const rect = vp.getBoundingClientRect();
      const [cx, cy] = this.screenToComp(e.clientX - rect.left, e.clientY - rect.top);
      if (this.pen) { this.finishPen(false); return; }
      const c = this.hitTest(cx, cy);
      if (c?.kind === 'text') this.editText(c);
    });
    vp.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const rect = vp.getBoundingClientRect();
      const [cx, cy] = this.screenToComp(e.clientX - rect.left, e.clientY - rect.top);
      const c = this.hitTest(cx, cy);
      if (c) { this.bus.run('clip.select', { ids: [c.id] }); this.app.ui.clipMenu(e.clientX, e.clientY, c.id); }
    });
    vp.addEventListener('pointerdown', (e) => {
      vp.focus();
      const rect = vp.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      const [cx, cy] = this.screenToComp(sx, sy);
      const st = this.bus.app.get();
      const p = this.bus.project.get();
      const tool = spaceDown || e.button === 1 ? 'hand' : st.tool;
      if (tool === 'hand') {
        const v0 = st.viewport;
        const z = this.zoom;
        this.drag(e, (dx, dy) => this.bus.run('view.set', { zoom: z, panX: (v0.panX || 0) + dx, panY: (v0.panY || 0) + dy }));
        return;
      }
      const relX = cx - p.meta.width / 2, relY = cy - p.meta.height / 2;
      if (tool === 'text') {
        this.bus.run('clip.add', { kind: 'text', start: st.time, transform: { x: Math.round(relX), y: Math.round(relY) }, props: { text: 'Texte' } }).then((r) => { if (r.ok) { this.bus.run('tool.set', { tool: 'select' }); setTimeout(() => this.editText(this.bus.project.get().clips.find((c) => c.id === r.result.id)), 60); } });
        return;
      }
      if (tool === 'rect' || tool === 'ellipse') {
        this.creating = { sx, sy, ex: sx, ey: sy, kind: tool };
        this.drag(e, (dx, dy) => { this.creating.ex = sx + dx; this.creating.ey = sy + dy; this.drawOverlay(); }, async () => {
          const c = this.creating; this.creating = null;
          const [ax, ay] = this.screenToComp(Math.min(c.sx, c.ex), Math.min(c.sy, c.ey));
          const [bx, by] = this.screenToComp(Math.max(c.sx, c.ex), Math.max(c.sy, c.ey));
          const w = Math.max(20, bx - ax), hh = Math.max(20, by - ay);
          await this.bus.run('clip.add', { kind: 'shape', start: st.time, transform: { x: Math.round((ax + bx) / 2 - p.meta.width / 2), y: Math.round((ay + by) / 2 - p.meta.height / 2) }, props: { shape: tool === 'rect' ? 'rect' : 'ellipse', width: Math.round(w), height: Math.round(hh) } });
          this.drawOverlay();
        });
        return;
      }
      if (tool === 'pen') { this.penClick(e, cx, cy, sx, sy); return; }
      // --- sélection
      const sel = st.selection;
      if (sel.length === 1) {
        const q = this.layerQuad(sel[0]);
        if (q) {
          const clip = p.clips.find((c) => c.id === sel[0]);
          // points de tracé
          if (clip?.kind === 'shape' && ['path', 'freehand'].includes(clip.props.shape)) {
            for (const ph of this.pathHandles(q)) {
              for (const [key, pos] of [['out', ph.hout], ['in', ph.hin], ['pt', [ph.x, ph.y]]]) {
                if (pos && Math.hypot(pos[0] - sx, pos[1] - sy) < 7) { this.dragPathPoint(e, clip, q, ph.i, key); return; }
              }
            }
          }
          for (const hd of this.handles(q)) {
            if (Math.hypot(hd.x - sx, hd.y - sy) < 8) { this.dragHandle(e, hd, q, clip); return; }
          }
          if (pointInPoly(cx, cy, q.pts) && !e.shiftKey) { this.dragMove(e, sel, cx, cy); return; }
        }
      }
      const hit = this.hitTest(cx, cy);
      if (hit) {
        const mode = e.shiftKey || e.ctrlKey || e.metaKey ? 'toggle' : 'set';
        this.bus.run('clip.select', { ids: [hit.id], mode }).then(() => { if (mode === 'set') this.dragMove(e, [hit.id], cx, cy); });
      } else if (sel.length) this.bus.run('clip.select', { mode: 'clear' });
    });
  }

  drag(e, move, end) {
    const sx = e.clientX, sy = e.clientY;
    const mv = (ev) => move(ev.clientX - sx, ev.clientY - sy, ev);
    const up = (ev) => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); end?.(ev); };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
  }

  dragMove(e, ids, cx0, cy0) {
    const p = this.bus.project.get();
    const clips = ids.map((id) => p.clips.find((c) => c.id === id)).filter((c) => c && !c.locked);
    if (!clips.length) return;
    const t = this.bus.app.get().time;
    const starts = clips.map((c) => { const r = resolveClip(c, t, { comp: p.meta }); return { id: c.id, x: r.transform.x, y: r.transform.y }; });
    const quads = clips.map((c) => this.layerQuad(c.id)).filter(Boolean);
    const others = visibleClipsAt(p, t).filter((c) => !ids.includes(c.id)).map((c) => this.layerQuad(c.id)).filter(Boolean);
    const camZoom = this.renderer.lastEnv?.camera?.props?.zoom || 1;
    const key = `move-${ids.join(',')}-${Date.now()}`;
    let moved = false;
    this.drag(e, (dx, dy, ev) => {
      let ddx = dx / this.zoom / camZoom, ddy = dy / this.zoom / camZoom;
      if (ev.shiftKey) { if (Math.abs(ddx) > Math.abs(ddy)) ddy = 0; else ddx = 0; }
      if (!moved && Math.hypot(dx, dy) < 3) return;
      moved = true;
      // guides intelligents : centre/bords vers centre/bords de la composition et des autres calques
      this.snapLines = [];
      if (this.bus.app.get().snap.enabled && quads[0] && !ev.altKey) {
        const W = p.meta.width, H = p.meta.height;
        const bb = bbox(quads[0].pts.map(([x, y]) => [x + ddx, y + ddy]));
        const tx = [0, W / 2, W, ...others.flatMap((o) => { const b = bbox(o.pts); return [b.x0, (b.x0 + b.x1) / 2, b.x1]; })];
        const ty = [0, H / 2, H, ...others.flatMap((o) => { const b = bbox(o.pts); return [b.y0, (b.y0 + b.y1) / 2, b.y1]; })];
        const th = 6 / this.zoom;
        let bestX = null, bestY = null;
        for (const cand of [bb.x0, (bb.x0 + bb.x1) / 2, bb.x1]) for (const tg of tx) if (Math.abs(cand - tg) < th && (!bestX || Math.abs(cand - tg) < Math.abs(bestX.d))) bestX = { d: tg - cand, x: tg };
        for (const cand of [bb.y0, (bb.y0 + bb.y1) / 2, bb.y1]) for (const tg of ty) if (Math.abs(cand - tg) < th && (!bestY || Math.abs(cand - tg) < Math.abs(bestY.d))) bestY = { d: tg - cand, y: tg };
        if (bestX) { ddx += bestX.d; this.snapLines.push({ x: bestX.x }); }
        if (bestY) { ddy += bestY.d; this.snapLines.push({ y: bestY.y }); }
      }
      this.bus.batch(starts.map((s) => ({ name: 'clip.set_transform', args: { id: s.id, x: Math.round((s.x + ddx) * 10) / 10, y: Math.round((s.y + ddy) * 10) / 10 } })), { coalesce: key, label: 'Déplacer' });
    }, () => { this.snapLines = []; this.drawOverlay(); });
  }

  dragHandle(e, hd, q, clip) {
    const t = this.bus.app.get().time;
    const r0 = resolveClip(clip, t, { comp: this.bus.project.get().meta });
    const tr = r0.transform;
    const [ax, ay] = this.compToScreen(...q.anchor);
    const rect = this.vp.getBoundingClientRect();
    const sx0 = e.clientX - rect.left, sy0 = e.clientY - rect.top;
    const key = `handle-${clip.id}-${Date.now()}`;
    const run = (args) => this.bus.run('clip.set_transform', { id: clip.id, ...args }, { coalesce: key });
    if (hd.type === 'rotate') {
      const a0 = Math.atan2(sy0 - ay, sx0 - ax);
      this.drag(e, (dx, dy, ev) => {
        let ang = tr.rotation + ((Math.atan2(sy0 + dy - ay, sx0 + dx - ax) - a0) * 180) / Math.PI;
        if (ev.shiftKey) ang = Math.round(ang / 15) * 15;
        run({ rotation: Math.round(ang * 10) / 10 });
      });
    } else if (hd.type === 'corner') {
      const d0 = Math.hypot(sx0 - ax, sy0 - ay) || 1;
      this.drag(e, (dx, dy, ev) => {
        const k = Math.hypot(sx0 + dx - ax, sy0 + dy - ay) / d0;
        if (ev.altKey) run({ scaleX: +(tr.scaleX * k).toFixed(4), scaleY: +(tr.scaleY * k).toFixed(4) });
        else run({ scale: +(tr.scale * k).toFixed(4) });
      });
    } else if (hd.type === 'side') {
      const horizontal = hd.i === 1 || hd.i === 3;
      const d0 = Math.hypot(sx0 - ax, sy0 - ay) || 1;
      this.drag(e, (dx, dy, ev) => {
        if (ev.ctrlKey || ev.metaKey) {
          if (horizontal) run({ skewY: Math.round(tr.skewY + dy / 3) }); else run({ skewX: Math.round(tr.skewX + dx / 3) });
          return;
        }
        const k = Math.hypot(sx0 + dx - ax, sy0 + dy - ay) / d0;
        if (horizontal) run({ scaleX: +(tr.scaleX * k).toFixed(4) }); else run({ scaleY: +(tr.scaleY * k).toFixed(4) });
      });
    } else if (hd.type === 'anchor') {
      // déplace l'ancre en compensant la position (le calque ne bouge pas visuellement)
      const box = q.box;
      const s = tr.scale;
      const rad = (tr.rotation * Math.PI) / 180;
      this.drag(e, (dx, dy) => {
        const cdx = dx / this.zoom, cdy = dy / this.zoom;
        const lx = (Math.cos(-rad) * cdx - Math.sin(-rad) * cdy) / (s * tr.scaleX || 1);
        const ly = (Math.sin(-rad) * cdx + Math.cos(-rad) * cdy) / (s * tr.scaleY || 1);
        run({ anchorX: +(tr.anchorX + lx / box.w).toFixed(4), anchorY: +(tr.anchorY + ly / box.h).toFixed(4), x: +(tr.x + cdx).toFixed(2), y: +(tr.y + cdy).toFixed(2) });
      });
    }
  }

  dragPathPoint(e, clip, q, i, key) {
    const pts0 = JSON.parse(JSON.stringify(clip.props.path));
    const rect = this.vp.getBoundingClientRect();
    const ck = `path-${clip.id}-${Date.now()}`;
    this.drag(e, (dx, dy, ev) => {
      const [lx, ly] = this.screenToLocal(q, ev.clientX - rect.left, ev.clientY - rect.top);
      const pts = JSON.parse(JSON.stringify(pts0));
      const p = pts[i];
      if (key === 'pt') { p.x = Math.round(lx); p.y = Math.round(ly); }
      else if (key === 'out') { p.ox = Math.round(lx - p.x); p.oy = Math.round(ly - p.y); if (!ev.altKey) { p.ix = -p.ox; p.iy = -p.oy; } }
      else { p.ix = Math.round(lx - p.x); p.iy = Math.round(ly - p.y); if (!ev.altKey) { p.ox = -p.ix; p.oy = -p.iy; } }
      this.bus.run('clip.set', { id: clip.id, path: 'props.path', value: pts }, { coalesce: ck });
    });
  }

  // outil Plume : clic = point, clic-glisser = poignées, double-clic / Entrée = terminer, clic sur le 1er point = fermer
  async penClick(e, cx, cy, sx, sy) {
    const p = this.bus.project.get();
    const st = this.bus.app.get();
    if (!this.pen) {
      const r = await this.bus.run('clip.add', { kind: 'shape', start: st.time, name: 'Tracé', transform: { x: 0, y: 0 }, props: { shape: 'path', path: [{ x: Math.round(cx - p.meta.width / 2), y: Math.round(cy - p.meta.height / 2) }], closed: false, width: p.meta.width, height: p.meta.height, fill: { enabled: false }, stroke: { enabled: true, width: 6, color: '#24D26D' } } });
      if (!r.ok) return;
      this.pen = { id: r.result.id, key: `pen-${r.result.id}` };
      return;
    }
    const clip = p.clips.find((c) => c.id === this.pen.id);
    if (!clip) { this.pen = null; return; }
    const lx = Math.round(cx - p.meta.width / 2), ly = Math.round(cy - p.meta.height / 2);
    const first = clip.props.path[0];
    const [fx, fy] = this.compToScreen(p.meta.width / 2 + first.x, p.meta.height / 2 + first.y);
    if (clip.props.path.length > 2 && Math.hypot(fx - sx, fy - sy) < 9) { this.finishPen(true); return; }
    const pts = [...clip.props.path, { x: lx, y: ly }];
    await this.bus.run('clip.set', { id: clip.id, path: 'props.path', value: pts }, { coalesce: this.pen.key });
    this.drag(e, (dx, dy) => {
      const pp = JSON.parse(JSON.stringify(pts));
      const last = pp[pp.length - 1];
      last.ox = Math.round(dx / this.zoom); last.oy = Math.round(dy / this.zoom); last.ix = -last.ox; last.iy = -last.oy;
      this.bus.run('clip.set', { id: clip.id, path: 'props.path', value: pp }, { coalesce: this.pen.key });
    });
  }

  finishPen(close) {
    if (!this.pen) return;
    const id = this.pen.id;
    this.pen = null;
    if (close) this.bus.run('clip.set', { id, path: 'props.closed', value: true });
    this.bus.run('tool.set', { tool: 'select' });
  }

  editText(clip) {
    if (!clip) return;
    const q = this.layerQuad(clip.id);
    if (!q) return;
    const b = bbox(q.pts.map(([x, y]) => this.compToScreen(x, y)));
    const ta = h('textarea', { class: 'text-edit', 'aria-label': 'Modifier le texte', value: clip.props.text });
    Object.assign(ta.style, { left: `${b.x0}px`, top: `${b.y0}px`, width: `${Math.max(160, b.x1 - b.x0)}px`, height: `${Math.max(40, b.y1 - b.y0)}px`, fontSize: `${Math.max(12, Math.min(48, clip.props.fontSize * this.zoom))}px` });
    this.vp.append(ta);
    ta.focus(); ta.select();
    const commit = () => { const v = ta.value; ta.remove(); if (v !== clip.props.text) this.bus.run('clip.set_text', { id: clip.id, text: v }); };
    ta.addEventListener('blur', commit);
    ta.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') { ta.value = clip.props.text; ta.blur(); } if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) ta.blur(); });
  }
}

export function pointInPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi) inside = !inside;
  }
  return inside;
}

function bbox(pts) {
  return { x0: Math.min(...pts.map((p) => p[0])), x1: Math.max(...pts.map((p) => p[0])), y0: Math.min(...pts.map((p) => p[1])), y1: Math.max(...pts.map((p) => p[1])) };
}

export { icon, contextMenu };
