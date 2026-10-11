// Éditeur de graphe : courbe de valeur ou de vitesse d'une propriété animée ; clés et poignées de Bézier déplaçables
import { h } from '../ui/dom.js';
import { evalKeys } from '../core/evaluate.js';
import { BEZIER_PRESETS } from '../catalog/easings.js';

export class GraphEditor {
  constructor(app, root) {
    this.app = app;
    this.bus = app.bus;
    this.root = root;
    this.canvas = h('canvas', { 'aria-label': 'Éditeur de courbes' });
    this.propSel = h('select', { class: 'input', 'aria-label': 'Propriété', onchange: () => this.setProp() });
    this.modeSel = h('select', { class: 'input', 'aria-label': 'Mode', onchange: () => this.setProp() }, h('option', { value: 'value' }, 'Graphe de valeur'), h('option', { value: 'speed' }, 'Graphe de vitesse'));
    this.presetSel = h('select', { class: 'input', 'aria-label': 'Courbe prédéfinie (clé sélectionnée)', onchange: (e) => this.applyPreset(e.target.value) }, h('option', { value: '' }, 'Bézier…'), ...Object.keys(BEZIER_PRESETS).map((k) => h('option', { value: k }, k)));
    this.presetSel.dataset.cmd = 'keyframe.set_bezier';
    root.append(h('div', { class: 'ge-bar' }, this.propSel, this.modeSel, this.presetSel, h('span', { class: 'hint' }, 'Glisser une clé : temps/valeur · glisser une poignée : courbe de Bézier')), this.canvas);
    this.canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    new ResizeObserver(() => this.draw()).observe(root);
  }

  toggle(open) { this.root.classList.toggle('open', !!open); this.refresh(); }

  setProp() {
    const [clipId, path] = (this.propSel.value || '|').split('|');
    this.bus.run('view.set', { graphProperty: { clipId, path, mode: this.modeSel.value } });
    setTimeout(() => this.draw(), 0);
  }

  current() {
    const s = this.bus.app.get();
    const p = this.bus.project.get();
    let gp = s.graphProperty;
    const clip = p.clips.find((c) => c.id === (gp?.clipId || s.selection[0]));
    if (!clip) return null;
    const paths = Object.keys(clip.keyframes).filter((k) => clip.keyframes[k].some((x) => typeof x.v === 'number'));
    const path = gp?.clipId === clip.id && paths.includes(gp.path) ? gp.path : paths[0];
    if (!path) return { clip, paths, path: null };
    return { clip, paths, path, keys: clip.keyframes[path], mode: gp?.mode || 'value' };
  }

  refresh() {
    if (!this.root.classList.contains('open')) return;
    const cur = this.current();
    this.propSel.innerHTML = '';
    if (cur) for (const p of cur.paths) this.propSel.append(h('option', { value: `${cur.clip.id}|${p}`, selected: p === cur.path }, `${cur.clip.name} › ${p}`));
    if (cur?.mode) this.modeSel.value = cur.mode;
    this.draw();
  }

  geom() {
    const cur = this.current();
    if (!cur?.path) return null;
    const { clip, keys, mode } = cur;
    const w = this.canvas.clientWidth, hgt = this.canvas.clientHeight;
    const pps = this.bus.app.get().timelineZoom;
    const sl = this.app.timeline.body.scrollLeft;
    const N = Math.max(2, Math.min(800, Math.round(clip.duration * 60)));
    const samples = [];
    for (let i = 0; i <= N; i++) {
      const lt = (clip.duration * i) / N;
      let v = evalKeys(keys, lt);
      if (mode === 'speed') { const dt = clip.duration / N; v = (evalKeys(keys, Math.min(clip.duration, lt + dt)) - evalKeys(keys, Math.max(0, lt - dt))) / (2 * dt); }
      samples.push([lt, v]);
    }
    const vals = samples.map((s) => s[1]).concat(mode === 'value' ? keys.map((k) => k.v) : [0]);
    let vmin = Math.min(...vals), vmax = Math.max(...vals);
    if (vmax - vmin < 1e-6) { vmin -= 1; vmax += 1; }
    const pad = (vmax - vmin) * 0.12;
    vmin -= pad; vmax += pad;
    const X = (lt) => (clip.start + lt) * pps - sl;
    const Y = (v) => hgt - 16 - ((v - vmin) / (vmax - vmin)) * (hgt - 48);
    const V = (y) => vmin + ((hgt - 16 - y) / (hgt - 48)) * (vmax - vmin);
    return { ...cur, w, hgt, pps, sl, samples, X, Y, V, vmin, vmax };
  }

  draw() {
    if (!this.root.classList.contains('open')) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const c = this.canvas;
    c.width = Math.round(c.clientWidth * dpr); c.height = Math.round(c.clientHeight * dpr);
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    const g = this.geom();
    ctx.font = '11px Inter, sans-serif';
    if (!g) { ctx.fillStyle = '#8A8A8A'; ctx.fillText('Sélectionnez un clip ayant des keyframes numériques (bouton losange ◆ de l\'inspecteur).', 16, 60); return; }
    this.g = g;
    ctx.strokeStyle = '#1F1F1F'; ctx.lineWidth = 1; ctx.fillStyle = '#5A5A5A';
    for (let i = 0; i <= 4; i++) { const v = g.vmin + ((g.vmax - g.vmin) * i) / 4; const y = Math.round(g.Y(v)) + 0.5; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(g.w, y); ctx.stroke(); ctx.fillText(v.toFixed(2), 4, y - 3); }
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.beginPath();
    g.samples.forEach(([lt, v], i) => (i ? ctx.lineTo(g.X(lt), g.Y(v)) : ctx.moveTo(g.X(lt), g.Y(v))));
    ctx.stroke();
    if (g.mode === 'value') {
      const sel = this.bus.app.get().selectedKeyframes;
      g.keys.forEach((k, i) => {
        const x = g.X(k.t), y = g.Y(k.v);
        const isSel = sel.some((s) => s.clipId === g.clip.id && s.path === g.path && s.index === i);
        ctx.fillStyle = isSel ? accent : '#fff';
        ctx.fillRect(x - 4, y - 4, 8, 8);
        if (isSel && g.keys[i + 1]) {
          const hd = this.handlePos(g, i);
          ctx.strokeStyle = '#ffffff99'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(hd.h1[0], hd.h1[1]); ctx.moveTo(g.X(g.keys[i + 1].t), g.Y(g.keys[i + 1].v)); ctx.lineTo(hd.h2[0], hd.h2[1]); ctx.stroke();
          ctx.fillStyle = '#FFD23D';
          for (const p of [hd.h1, hd.h2]) { ctx.beginPath(); ctx.arc(p[0], p[1], 4, 0, 7); ctx.fill(); }
        }
      });
    }
    const t = this.bus.app.get().time;
    const xp = (t * g.pps) - g.sl;
    ctx.fillStyle = accent; ctx.fillRect(xp, 0, 1, g.hgt);
  }

  updatePlayhead() { this.draw(); }

  handlePos(g, i) {
    const a = g.keys[i], b = g.keys[i + 1];
    const bz = a.bezier || [0.33, 0, 0.67, 1];
    const x0 = g.X(a.t), y0 = g.Y(a.v), x1 = g.X(b.t), y1 = g.Y(b.v);
    return { h1: [x0 + (x1 - x0) * bz[0], y0 + (y1 - y0) * bz[1]], h2: [x0 + (x1 - x0) * bz[2], y0 + (y1 - y0) * bz[3]], x0, y0, x1, y1, bz };
  }

  applyPreset(name) {
    const sel = this.bus.app.get().selectedKeyframes.filter((s) => s.path === this.g?.path);
    if (!name || !sel.length) return;
    this.bus.run('keyframe.set_bezier', { clipId: sel[0].clipId, path: sel[0].path, indices: sel.map((s) => s.index), bezier: BEZIER_PRESETS[name] });
    this.presetSel.value = '';
  }

  onDown(e) {
    const g = this.g;
    if (!g || g.mode !== 'value') return;
    const r = this.canvas.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const sel = this.bus.app.get().selectedKeyframes;
    // poignées de Bézier de la clé sélectionnée
    for (const s of sel.filter((x) => x.clipId === g.clip.id && x.path === g.path)) {
      if (!g.keys[s.index + 1]) continue;
      const hd = this.handlePos(g, s.index);
      for (const [which, p] of [['h1', hd.h1], ['h2', hd.h2]]) {
        if (Math.hypot(p[0] - mx, p[1] - my) < 7) {
          const key = `bz-${Date.now()}`;
          const mv = (ev) => {
            const x = ev.clientX - r.left, y = ev.clientY - r.top;
            const u = Math.max(0, Math.min(1, (x - hd.x0) / ((hd.x1 - hd.x0) || 1)));
            const v = (y - hd.y0) / ((hd.y1 - hd.y0) || 1);
            const bz = [...hd.bz];
            if (which === 'h1') { bz[0] = +u.toFixed(3); bz[1] = +v.toFixed(3); } else { bz[2] = +u.toFixed(3); bz[3] = +v.toFixed(3); }
            this.bus.run('keyframe.set_bezier', { clipId: g.clip.id, path: g.path, index: s.index, bezier: bz }, { coalesce: key }).then(() => this.draw());
          };
          const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
          window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
          return;
        }
      }
    }
    const i = g.keys.findIndex((k) => Math.hypot(g.X(k.t) - mx, g.Y(k.v) - my) < 7);
    if (i < 0) return;
    this.bus.run('keyframe.select', { items: [{ clipId: g.clip.id, path: g.path, index: i }], mode: e.shiftKey ? 'add' : 'set' });
    const k0 = g.keys[i];
    const key = `ge-${Date.now()}`;
    const fps = this.bus.project.get().meta.fps;
    const mv = (ev) => {
      const x = ev.clientX - r.left, y = ev.clientY - r.top;
      const t = Math.round(((x + g.sl) / g.pps - g.clip.start) * fps) / fps;
      const v = ev.shiftKey ? k0.v : +g.V(y).toFixed(3);
      this.bus.run('keyframe.update', { clipId: g.clip.id, path: g.path, index: i, t: ev.altKey ? k0.t : Math.max(0, Math.min(g.clip.duration, t)), value: v }, { coalesce: key }).then(() => this.draw());
    };
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  }
}
