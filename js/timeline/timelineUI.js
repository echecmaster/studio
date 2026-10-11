// Timeline : règle timecode, pistes, clips (déplacement, trim, split, magnétisme, lasso), keyframes, transitions,
// marqueurs, zone de travail, forme d'onde, filmstrip, barre de cache, glisser-déposer depuis la bibliothèque.
import { h, iconBtn, contextMenu } from '../ui/dom.js';
import { icon, KIND_COLORS } from '../ui/icons.js';
import { formatTimecode } from '../core/util.js';
import { snapTargets, snapTime } from './snapping.js';
import { drawWaveform } from './waveform.js';
import { filmstrip, cachedFilmstrip } from './thumbnails.js';
import { GraphEditor } from './graphEditor.js';
import { BLEND_MODES } from '../catalog/blendModes.js';
import { TRANSITIONS } from '../catalog/transitions.js';
import { EASING_NAMES } from '../catalog/easings.js';

const TRACK_TYPES = [['video', 'Vidéo'], ['text', 'Texte'], ['shape', 'Formes'], ['audio', 'Audio'], ['effect', 'Effets'], ['adjustment', 'Ajustement'], ['camera', 'Caméra']];

export class Timeline {
  constructor(app, root) {
    this.app = app;
    this.bus = app.bus;
    this.root = root;
    this.build();
    this.bus.project.subscribe(() => this.renderTracks());
    this.bus.app.subscribe((s, p) => {
      if (s.timelineZoom !== p.timelineZoom) this.renderTracks();
      else if (s.selection !== p.selection || s.selectedKeyframes !== p.selectedKeyframes) this.updateSelection();
      if (s.time !== p.time) { this.updatePlayhead(); if (s.playing) this.autoScroll(); }
      if (s.snap !== p.snap) this.snapBtn.setAttribute('aria-pressed', String(s.snap.enabled));
      if (s.graphEditor !== p.graphEditor) this.graph.toggle(s.graphEditor);
      if (s.timelineScroll !== p.timelineScroll && Math.abs(this.body.scrollLeft - s.timelineScroll * s.timelineZoom) > 2) this.body.scrollLeft = s.timelineScroll * s.timelineZoom;
    });
    new ResizeObserver(() => { this.drawRuler(); this.drawCacheBar(); }).observe(this.ruler);
    this.renderTracks();
  }

  get pps() { return this.bus.app.get().timelineZoom; }
  tToX(t) { return t * this.pps; }
  xToT(x) { return x / this.pps; }
  bodyWidth() { return this.body.clientWidth; }

  build() {
    const r = this.root;
    this.snapBtn = iconBtn('magnet', 'Magnétisme (snap)', () => this.bus.run('snap.set', { enabled: !this.bus.app.get().snap.enabled }), { class: 'ghost sm', cmd: 'snap.set' });
    this.snapBtn.setAttribute('aria-pressed', String(this.bus.app.get().snap.enabled));
    const addTrack = iconBtn('plus', 'Ajouter une piste', (e) => contextMenu(e.clientX, e.clientY, TRACK_TYPES.map(([t, l]) => ({ label: `Piste ${l}`, cmd: 'track.add', action: () => this.bus.run('track.add', { type: t }) }))), { class: 'ghost sm', cmd: 'track.add' });
    const graphBtn = iconBtn('graph', 'Éditeur de courbes (graph editor)', () => this.bus.run('view.set', { graphEditor: !this.bus.app.get().graphEditor }), { class: 'ghost sm', cmd: 'view.set' });
    const zoom = h('input', { type: 'range', class: 'tl-zoom', min: 0, max: 100, step: 0.5, 'aria-label': 'Zoom de la timeline', value: 50, dataset: { cmd: 'timeline.set_zoom' } });
    zoom.addEventListener('input', () => this.bus.run('timeline.set_zoom', { pxPerSecond: Math.round(Math.exp(1 + (zoom.value / 100) * 6.2)) }));
    this.zoomSlider = zoom;
    const fit = iconBtn('fit', 'Ajuster la timeline (\\)', () => this.bus.run('timeline.fit', { width: this.body.clientWidth }), { class: 'ghost sm', cmd: 'timeline.fit' });
    this.corner = h('div', { class: 'tl-corner' }, addTrack, this.snapBtn, graphBtn, fit, zoom);
    this.rulerCanvas = h('canvas');
    this.workEl = h('div', { class: 'tl-workarea', title: 'Zone de travail (glisser les bords)' });
    this.cacheBar = h('canvas', { class: 'tl-cachebar' });
    this.markersEl = h('div', { style: { position: 'absolute', inset: '0', pointerEvents: 'none' } });
    this.ruler = h('div', { class: 'tl-ruler', role: 'slider', 'aria-label': 'Règle temporelle : cliquer/glisser pour positionner la tête de lecture', tabindex: 0 }, this.rulerCanvas, this.workEl, this.cacheBar, this.markersEl);
    this.heads = h('div', { class: 'tl-heads' });
    this.content = h('div', { class: 'tl-content' });
    this.playhead = h('div', { id: 'playhead' });
    this.body = h('div', { class: 'tl-body', tabindex: 0, 'aria-label': 'Pistes et clips' }, this.content);
    this.graphRoot = h('div', { id: 'graph-editor' });
    r.append(this.corner, this.ruler, this.heads, this.body, this.graphRoot);
    this.graph = new GraphEditor(this.app, this.graphRoot);
    this.body.addEventListener('scroll', () => {
      this.heads.scrollTop = this.body.scrollTop;
      this.drawRuler();
      this.drawCacheBar();
      this.positionRulerOverlays();
      this.app.bus.app.state.timelineScroll = this.body.scrollLeft / this.pps; // état de vue (pas une modification de projet)
    });
    this.body.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const rect = this.body.getBoundingClientRect();
        const mx = e.clientX - rect.left + this.body.scrollLeft;
        const tAt = this.xToT(mx);
        const z = Math.max(2, Math.min(2000, this.pps * Math.exp(-e.deltaY * 0.002)));
        this.bus.run('timeline.set_zoom', { pxPerSecond: z }).then(() => { this.body.scrollLeft = tAt * z - (e.clientX - rect.left); });
      } else if (e.shiftKey) { e.preventDefault(); this.body.scrollLeft += e.deltaY; }
    }, { passive: false });
    // règle : scrub
    this.ruler.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.flag') || e.target === this.workEl) return;
      const seek = (ev) => {
        const rect = this.ruler.getBoundingClientRect();
        const t = this.xToT(ev.clientX - rect.left + this.body.scrollLeft);
        this.bus.run('playback.seek', { t: Math.max(0, t) });
      };
      if (this.bus.app.get().playing) this.bus.run('playback.pause');
      seek(e);
      const mv = (ev) => seek(ev);
      const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', mv);
      window.addEventListener('pointerup', up);
    });
    this.ruler.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); this.bus.run('playback.seek', { deltaFrames: e.shiftKey ? -10 : -1 }); }
      if (e.key === 'ArrowRight') { e.preventDefault(); this.bus.run('playback.seek', { deltaFrames: e.shiftKey ? 10 : 1 }); }
    });
    // zone de travail : glisser les bords ou le milieu
    this.workEl.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      const p = this.bus.project.get();
      const rect = this.workEl.getBoundingClientRect();
      const edge = e.clientX - rect.left < 8 ? 'in' : rect.right - e.clientX < 8 ? 'out' : 'move';
      const wa0 = { ...p.workArea };
      const sx = e.clientX;
      const key = `wa-${Date.now()}`;
      const mv = (ev) => {
        const dt = (ev.clientX - sx) / this.pps;
        const args = edge === 'in' ? { in: Math.max(0, wa0.in + dt) } : edge === 'out' ? { out: wa0.out + dt } : { in: Math.max(0, wa0.in + dt), out: wa0.out + dt };
        this.bus.run('timeline.set_work_area', args, { coalesce: key });
      };
      const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', mv);
      window.addEventListener('pointerup', up);
    });
    // lasso + clic dans le vide
    this.body.addEventListener('pointerdown', (e) => {
      if (e.target !== this.body && e.target !== this.content && !e.target.classList.contains('tl-track')) return;
      if (e.button !== 0) return;
      const rect = this.body.getBoundingClientRect();
      const x0 = e.clientX - rect.left + this.body.scrollLeft, y0 = e.clientY - rect.top + this.body.scrollTop;
      const lasso = h('div', { class: 'tl-lasso' });
      let started = false;
      const additive = e.shiftKey || e.ctrlKey || e.metaKey;
      const base = additive ? [...this.bus.app.get().selection] : [];
      const mv = (ev) => {
        const x1 = ev.clientX - rect.left + this.body.scrollLeft, y1 = ev.clientY - rect.top + this.body.scrollTop;
        if (!started && Math.hypot(x1 - x0, y1 - y0) < 4) return;
        if (!started) { started = true; this.content.append(lasso); }
        const L = Math.min(x0, x1), T = Math.min(y0, y1), R = Math.max(x0, x1), B = Math.max(y0, y1);
        Object.assign(lasso.style, { left: `${L}px`, top: `${T}px`, width: `${R - L}px`, height: `${B - T}px` });
        const ids = [...this.content.querySelectorAll('.tl-clip')].filter((el) => { const cr = { l: el.offsetLeft, t: el.parentElement.offsetTop + el.offsetTop, r: el.offsetLeft + el.offsetWidth }; cr.b = cr.t + el.offsetHeight; return cr.l < R && cr.r > L && cr.t < B && cr.b > T; }).map((el) => el.dataset.id);
        this.bus.run('clip.select', { ids: [...new Set([...base, ...ids])], mode: 'set' });
      };
      const up = (ev) => {
        window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
        lasso.remove();
        if (!started) {
          if (!additive) this.bus.run('clip.select', { mode: 'clear' });
          const t = this.xToT(ev.clientX - rect.left + this.body.scrollLeft);
          this.bus.run('playback.seek', { t: Math.max(0, t) });
        }
      };
      window.addEventListener('pointermove', mv);
      window.addEventListener('pointerup', up);
    });
    // déposer depuis la bibliothèque / fichiers
    this.body.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; const tr = e.target.closest('.tl-track'); this.content.querySelectorAll('.drop-hover').forEach((x) => x.classList.remove('drop-hover')); tr?.classList.add('drop-hover'); });
    this.body.addEventListener('dragleave', () => this.content.querySelectorAll('.drop-hover').forEach((x) => x.classList.remove('drop-hover')));
    this.body.addEventListener('drop', (e) => this.onDrop(e));
  }

  async onDrop(e) {
    e.preventDefault();
    this.content.querySelectorAll('.drop-hover').forEach((x) => x.classList.remove('drop-hover'));
    const rect = this.body.getBoundingClientRect();
    const t = Math.max(0, this.xToT(e.clientX - rect.left + this.body.scrollLeft));
    const trackEl = e.target.closest('.tl-track');
    const clipEl = e.target.closest('.tl-clip');
    const trackId = trackEl?.dataset.id;
    if (e.dataTransfer.files?.length) { await this.app.importFiles([...e.dataTransfer.files], { at: t, trackId }); return; }
    let payload = this.app.dragPayload;
    try { payload = JSON.parse(e.dataTransfer.getData('application/x-motion') || 'null') || payload; } catch { /* */ }
    this.app.dragPayload = null;
    if (!payload) return;
    await this.app.applyDrop(payload, { t, trackId, clipId: clipEl?.dataset.id });
  }

  // ------------------------------------------------------------------ rendu des pistes
  renderTracks() {
    const p = this.bus.project.get();
    const s = this.bus.app.get();
    const tracks = [...p.tracks].sort((a, b) => a.order - b.order);
    const W = Math.max(this.body.clientWidth, this.tToX(p.meta.duration) + 200);
    this.content.style.width = `${W}px`;
    this.heads.innerHTML = '';
    this.content.innerHTML = '';
    this.zoomSlider.value = String(((Math.log(s.timelineZoom) - 1) / 6.2) * 100);
    const audible = new Set(p.tracks.filter((t) => !t.muted).map((t) => t.id));
    void audible;
    for (const tr of tracks) {
      const hgt = tr.collapsed ? 22 : tr.height || 48;
      this.heads.append(this.trackHead(tr, hgt, tracks));
      const row = h('div', { class: `tl-track ${tr.locked ? 'locked' : ''}`, style: { height: `${hgt}px` }, dataset: { id: tr.id }, oncontextmenu: (e) => { if (e.target === row) { e.preventDefault(); this.trackMenu(e, tr); } } });
      for (const c of p.clips.filter((x) => x.trackId === tr.id)) row.append(this.clipEl(c, tr, hgt));
      this.content.append(row);
    }
    this.heads.append(h('div', { style: { height: '200px' } }));
    this.content.append(h('div', { style: { height: '200px' } }));
    this.content.append(this.playhead);
    this.updatePlayhead();
    this.drawRuler();
    this.drawCacheBar();
    this.positionRulerOverlays();
    this.graph.refresh();
  }

  trackHead(tr, hgt, tracks) {
    const name = h('span', { class: 'name', title: `${tr.name} — double-clic pour renommer, glisser pour réordonner` }, tr.name);
    name.addEventListener('dblclick', () => {
      const inp = h('input', { class: 'input', value: tr.name, 'aria-label': 'Nom de la piste' });
      name.replaceChildren(inp); inp.focus(); inp.select();
      const done = () => { if (inp.value.trim() && inp.value !== tr.name) this.bus.run('track.rename', { id: tr.id, name: inp.value.trim() }); else this.renderTracks(); };
      inp.addEventListener('blur', done);
      inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') inp.blur(); if (e.key === 'Escape') { inp.value = tr.name; inp.blur(); } });
    });
    // réordonnancement par glisser
    name.addEventListener('pointerdown', (e) => {
      if (e.detail > 1) return;
      const y0 = e.clientY;
      let target = null;
      const mv = (ev) => {
        if (Math.abs(ev.clientY - y0) < 5) return;
        const heads = [...this.heads.querySelectorAll('.tl-head')];
        heads.forEach((x) => x.classList.remove('drop-target'));
        target = heads.findIndex((x) => { const r = x.getBoundingClientRect(); return ev.clientY < r.top + r.height / 2; });
        if (target < 0) target = heads.length;
        heads[Math.min(target, heads.length - 1)]?.classList.add('drop-target');
      };
      const up = () => {
        window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
        this.heads.querySelectorAll('.drop-target').forEach((x) => x.classList.remove('drop-target'));
        if (target !== null) { const cur = tracks.findIndex((x) => x.id === tr.id); const idx = target > cur ? target - 1 : target; if (idx !== cur) this.bus.run('track.reorder', { id: tr.id, index: idx }); }
      };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    });
    const tog = (key, on, off, label) => {
      const b = iconBtn(tr[key] ? on : off, label, () => this.bus.run('track.set', { id: tr.id, [key]: !tr[key] }), { class: `ghost sm ${tr[key] ? 'on' : ''}`, cmd: 'track.set' });
      b.setAttribute('aria-pressed', String(!!tr[key]));
      return b;
    };
    const isAudio = tr.type === 'audio' || tr.type === 'video';
    const head = h('div', { class: 'tl-head', style: { height: `${hgt}px` }, dataset: { id: tr.id }, oncontextmenu: (e) => { e.preventDefault(); this.trackMenu(e, tr); } },
      h('span', { class: 'color', style: { background: tr.color } }),
      name,
      tog('hidden', 'eyeoff', 'eye', 'Masquer la piste'),
      tog('locked', 'lock', 'unlock', 'Verrouiller la piste'),
      isAudio ? tog('muted', 'mute', 'sound', 'Muet') : null,
      tog('solo', 'solo', 'solo', 'Solo'),
    );
    if (tr.groupId) head.title = `Groupe : ${tr.groupName}`;
    return head;
  }

  trackMenu(e, tr) {
    const colors = ['#24D26D', '#3D8BFF', '#E0A526', '#B05CFF', '#FF3D8B', '#3DD6D0', '#FF7A45', '#8A8A8A'];
    contextMenu(e.clientX, e.clientY, [
      { header: tr.name },
      { label: 'Renommer…', icon: 'text', cmd: 'track.rename', action: () => { const n = prompt('Nouveau nom de piste', tr.name); if (n) this.bus.run('track.rename', { id: tr.id, name: n }); } },
      { label: tr.collapsed ? 'Déplier' : 'Replier', icon: 'chevron', cmd: 'track.set', action: () => this.bus.run('track.set', { id: tr.id, collapsed: !tr.collapsed }) },
      { label: 'Hauteur : petite', cmd: 'track.set', action: () => this.bus.run('track.set', { id: tr.id, height: 32 }) },
      { label: 'Hauteur : normale', cmd: 'track.set', action: () => this.bus.run('track.set', { id: tr.id, height: 48 }) },
      { label: 'Hauteur : grande', cmd: 'track.set', action: () => this.bus.run('track.set', { id: tr.id, height: 80 }) },
      '-',
      ...colors.map((c) => ({ label: `Couleur ${c}`, cmd: 'track.set', action: () => this.bus.run('track.set', { id: tr.id, color: c }) })),
      '-',
      { label: 'Grouper avec la piste suivante', icon: 'layers', cmd: 'track.group', action: () => { const ts = [...this.bus.project.get().tracks].sort((a, b) => a.order - b.order); const i = ts.findIndex((x) => x.id === tr.id); if (ts[i + 1]) this.bus.run('track.group', { ids: [tr.id, ts[i + 1].id], name: 'Groupe' }); } },
      tr.groupId ? { label: 'Dégrouper', cmd: 'track.ungroup', action: () => this.bus.run('track.ungroup', { groupId: tr.groupId }) } : null,
      ...TRACK_TYPES.map(([t, l]) => ({ label: `Nouvelle piste ${l}`, icon: 'plus', cmd: 'track.add', action: () => this.bus.run('track.add', { type: t, index: tr.order }) })),
      '-',
      { label: 'Supprimer la piste', icon: 'trash', cmd: 'track.remove', action: () => this.bus.run('track.remove', { id: tr.id }) },
    ]);
  }

  clipEl(c, tr, hgt) {
    const s = this.bus.app.get();
    const x = this.tToX(c.start), w = Math.max(3, this.tToX(c.duration));
    const color = c.color || KIND_COLORS[c.kind] || tr.color;
    const sel = s.selection.includes(c.id);
    const el = h('div', { class: `tl-clip ${sel ? 'sel' : ''} ${c.locked ? 'locked' : ''}`, style: { left: `${x}px`, width: `${w}px`, '--clip-color': color }, dataset: { id: c.id }, title: `${c.name} (${c.kind}) — ${c.start.toFixed(2)}s → ${(c.start + c.duration).toFixed(2)}s` });
    el.style.setProperty('--clip-color', color);
    const badges = [];
    if (c.effects.length) badges.push(h('span', { class: 'badge accent' }, `fx ${c.effects.length}`));
    if (c.speed !== 1) badges.push(h('span', { class: 'badge' }, `${c.speed}×`));
    if (c.reverse) badges.push(h('span', { class: 'badge' }, '◀'));
    if (c.parentId) badges.push(h('span', { class: 'badge' }, '⛓'));
    if (c.matte) badges.push(h('span', { class: 'badge' }, 'matte'));
    if (Object.keys(c.expressions).length) badges.push(h('span', { class: 'badge' }, 'expr'));
    el.append(h('div', { class: 'label' }, c.name, ...badges));
    if (!tr.collapsed && hgt >= 40) {
      if (c.kind === 'audio' || (c.kind === 'video' && this.app.media.getAudio(c.props.assetId) && hgt >= 60)) {
        const cv = h('canvas', { class: 'wave' });
        el.append(cv);
        requestAnimationFrame(() => drawWaveform(cv, this.app.analysis, c, this.pps));
        // ligne de volume
        const vol = c.props.volume ?? 1;
        el.append(h('div', { class: 'vol', style: { top: `${14 + (1 - Math.min(2, vol) / 2) * (hgt - 20)}px` } }));
      } else if (c.kind === 'video') {
        const strip = h('div', { class: 'filmstrip' });
        el.append(strip);
        const fill = (fs) => {
          if (!fs) return;
          const cellW = (hgt - 20) * fs.aspect;
          const n = Math.ceil(w / cellW);
          for (let i = 0; i < n; i++) {
            const lt = ((i + 0.5) * cellW) / this.pps;
            const src = (c.inPoint || 0) + lt * (c.speed || 1);
            const k = Math.min(fs.urls.length - 1, Math.max(0, Math.round((src / (fs.times[fs.times.length - 1] + fs.times[0])) * fs.urls.length - 0.5)));
            strip.append(h('img', { src: fs.urls[k], alt: '' }));
          }
        };
        const fs = cachedFilmstrip(c.props.assetId);
        if (fs) fill(fs); else filmstrip(this.app.media, c.props.assetId).then(fill).catch(() => {});
      }
    }
    // transitions
    if (c.transitionIn) el.append(this.transEl(c, 'in'));
    if (c.transitionOut) el.append(this.transEl(c, 'out'));
    // keyframes (toutes propriétés, dédoublonnées par instant)
    if (!tr.collapsed) {
      const seen = new Map();
      for (const [path, keys] of Object.entries(c.keyframes)) keys.forEach((k, i) => { const kx = Math.round(this.tToX(k.t)); if (!seen.has(kx)) seen.set(kx, { k, path, i }); });
      for (const [kx, { k, path, i }] of seen) {
        const ksel = s.selectedKeyframes.some((x) => x.clipId === c.id && x.path === path && x.index === i);
        const d = h('div', { class: `kf ${ksel ? 'sel' : ''} ${k.hold ? 'hold' : ''} ${k.easing && k.easing !== 'linear' && !k.hold ? 'ease' : ''}`, style: { left: `${kx}px` }, title: `${path} @ ${k.t.toFixed(3)}s = ${JSON.stringify(k.v)} (${k.easing || 'linear'})`, dataset: { path, index: i } });
        d.addEventListener('pointerdown', (e) => this.dragKeyframe(e, c, path, i));
        d.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); this.keyframeMenu(e, c, path, i); });
        el.append(d);
      }
    }
    const hl = h('div', { class: 'handle l', title: 'Rogner le début' });
    const hr = h('div', { class: 'handle r', title: 'Rogner la fin' });
    hl.addEventListener('pointerdown', (e) => this.dragTrim(e, c, 'in'));
    hr.addEventListener('pointerdown', (e) => this.dragTrim(e, c, 'out'));
    el.append(hl, hr);
    el.addEventListener('pointerdown', (e) => this.dragClip(e, c));
    el.addEventListener('dblclick', () => this.app.ui.openPanel('inspector'));
    el.addEventListener('contextmenu', (e) => { e.preventDefault(); if (!this.bus.app.get().selection.includes(c.id)) this.bus.run('clip.select', { ids: [c.id] }); this.app.ui.clipMenu(e.clientX, e.clientY, c.id); });
    return el;
  }

  transEl(c, edge) {
    const tr = edge === 'in' ? c.transitionIn : c.transitionOut;
    const w = this.tToX(tr.duration);
    const el = h('div', { class: `trans ${edge}`, style: edge === 'in' ? { left: '0', width: `${w}px` } : { right: '0', width: `${w}px` }, title: `Transition ${edge === 'in' ? 'd\'entrée' : 'de sortie'} : ${tr.type} (${tr.duration.toFixed(2)}s) — glisser pour la durée` });
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      const sx = e.clientX, d0 = tr.duration;
      const key = `tr-${c.id}-${Date.now()}`;
      const mv = (ev) => this.bus.run('transition.update', { clipId: c.id, edge, duration: Math.max(0.04, d0 + ((edge === 'in' ? 1 : -1) * (ev.clientX - sx)) / this.pps) }, { coalesce: key });
      const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    });
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault(); e.stopPropagation();
      contextMenu(e.clientX, e.clientY, [
        { header: `Transition ${tr.type}` },
        ...TRANSITIONS.slice(0, 18).map((t) => ({ label: t.name, cmd: 'transition.update', action: () => this.bus.run('transition.update', { clipId: c.id, edge, type: t.id }) })),
        '-',
        { label: 'Supprimer la transition', icon: 'trash', cmd: 'transition.remove', action: () => this.bus.run('transition.remove', { clipId: c.id, edge }) },
      ]);
    });
    return el;
  }

  keyframeMenu(e, c, path, i) {
    const items = ['linear', 'easeInOutCubic', 'easeOutCubic', 'easeInCubic', 'easeOutBack', 'easeOutElastic', 'easeOutBounce', 'easeInOutSine', 'easeOutExpo', 'hold', 'spring'];
    contextMenu(e.clientX, e.clientY, [
      { header: `${path} #${i}` },
      ...items.map((ez) => ({ label: `Interpolation : ${ez}`, cmd: 'keyframe.set_easing', action: () => this.bus.run('keyframe.set_easing', { clipId: c.id, path, indices: [i], easing: ez }) })),
      { label: 'Courbe de Bézier…', icon: 'graph', cmd: 'keyframe.set_bezier', action: () => this.app.ui.bezierEditor(c.id, path, i) },
      { label: 'Plus d\'easings…', cmd: 'keyframe.set_easing', action: () => contextMenu(e.clientX + 20, e.clientY, EASING_NAMES.map((ez) => ({ label: ez, action: () => this.bus.run('keyframe.set_easing', { clipId: c.id, path, indices: [i], easing: ez }) }))) },
      '-',
      { label: 'Copier', icon: 'copy', cmd: 'keyframe.copy', action: () => this.bus.run('keyframe.copy', { clipId: c.id, path, indices: [i] }) },
      { label: 'Ouvrir dans l\'éditeur de courbes', icon: 'graph', cmd: 'view.set', action: () => this.bus.run('view.set', { graphEditor: true, graphProperty: { clipId: c.id, path, mode: 'value' } }) },
      { label: 'Supprimer la keyframe', icon: 'trash', cmd: 'keyframe.remove', action: () => this.bus.run('keyframe.remove', { clipId: c.id, path, indices: [i] }) },
    ]);
  }

  dragKeyframe(e, c, path, i) {
    e.stopPropagation();
    if (e.button !== 0) return;
    const sel = this.bus.app.get().selectedKeyframes;
    const already = sel.some((x) => x.clipId === c.id && x.path === path && x.index === i);
    // les keyframes au même instant sur d'autres propriétés bougent ensemble
    const k0 = c.keyframes[path][i];
    const group = Object.entries(c.keyframes).flatMap(([p, ks]) => ks.map((k, j) => ({ p, j, t: k.t })).filter((x) => Math.abs(x.t - k0.t) < 1e-4));
    if (!already) this.bus.run('keyframe.select', { items: group.map((g) => ({ clipId: c.id, path: g.p, index: g.j })), mode: e.shiftKey ? 'add' : 'set' });
    this.bus.run('playback.seek', { t: c.start + k0.t });
    const sx = e.clientX;
    let moved = false;
    const key = `kf-${Date.now()}`;
    const fps = this.bus.project.get().meta.fps;
    const mv = (ev) => {
      const dt = Math.round(((ev.clientX - sx) / this.pps) * fps) / fps;
      if (!moved && Math.abs(ev.clientX - sx) < 3) return;
      moved = true;
      const byPath = {};
      for (const g of group) (byPath[g.p] ||= []).push(g.j);
      this.bus.batch(Object.entries(byPath).map(([p, idx]) => ({ name: 'keyframe.update', args: { clipId: c.id, path: p, index: idx[0], t: Math.max(0, Math.min(c.duration, k0.t + dt)) } })), { coalesce: key, label: 'Déplacer keyframes' });
    };
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  }

  dragClip(e, c) {
    if (e.button !== 0 || e.target.classList.contains('handle') || e.target.classList.contains('kf') || e.target.classList.contains('trans')) return;
    e.stopPropagation();
    const st = this.bus.app.get();
    const p = this.bus.project.get();
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    if (additive) { this.bus.run('clip.select', { ids: [c.id], mode: 'toggle' }); return; }
    let ids = st.selection.includes(c.id) ? st.selection : [c.id];
    if (!st.selection.includes(c.id)) this.bus.run('clip.select', { ids: [c.id] });
    const clips = ids.map((id) => p.clips.find((x) => x.id === id)).filter(Boolean);
    const starts = clips.map((x) => x.start);
    const sx = e.clientX, sy = e.clientY;
    const tracks = [...p.tracks].sort((a, b) => a.order - b.order);
    const trackIdx0 = tracks.findIndex((t) => t.id === c.trackId);
    let moved = false, dup = false;
    const key = `move-${Date.now()}`;
    const targets = snapTargets(p, st, { exclude: ids });
    const fps = p.meta.fps;
    let snapLine = null;
    const mv = async (ev) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4) return;
      if (!moved) {
        moved = true;
        if (ev.altKey) { // Alt-glisser = dupliquer
          dup = true;
          const r = await this.bus.run('clip.duplicate', { ids, offset: 0 });
          if (r.ok) ids = r.result.created;
        }
      }
      let dt = (ev.clientX - sx) / this.pps;
      const minS = Math.min(...starts);
      if (minS + dt < 0) dt = -minS;
      // magnétisme
      const pts = clips.flatMap((x, i) => [starts[i] + dt, starts[i] + dt + x.duration]);
      const sn = !ev.altKey || dup ? snapTime(pts, targets, 8 / this.pps) : null;
      if (sn) dt += sn.d;
      dt = Math.round(dt * fps) / fps;
      snapLine?.remove();
      if (sn) { snapLine = h('div', { class: 'tl-snapline', style: { left: `${this.tToX(sn.target.t)}px` } }); this.content.append(snapLine); }
      // piste
      const rowH = (ev.clientY - sy);
      let trackDelta = 0;
      const rows = [...this.content.querySelectorAll('.tl-track')];
      const curRow = rows.findIndex((r) => { const b = r.getBoundingClientRect(); return ev.clientY >= b.top && ev.clientY < b.bottom; });
      if (curRow >= 0) trackDelta = curRow - trackIdx0;
      void rowH;
      this.bus.run('clip.move', { ids, start: Math.max(0, Math.min(...starts) + dt), trackDelta: 0, ...(trackDelta && tracks[trackIdx0 + trackDelta] ? { trackId: ids.length === 1 ? tracks[trackIdx0 + trackDelta].id : undefined } : {}) }, { coalesce: key });
    };
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); snapLine?.remove(); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  }

  dragTrim(e, c, edge) {
    e.stopPropagation();
    if (e.button !== 0) return;
    const p = this.bus.project.get();
    const st = this.bus.app.get();
    const targets = snapTargets(p, st, { exclude: [c.id] });
    const sx = e.clientX;
    const base = edge === 'in' ? c.start : c.start + c.duration;
    const key = `trim-${Date.now()}`;
    const fps = p.meta.fps;
    const mv = (ev) => {
      let t = base + (ev.clientX - sx) / this.pps;
      const sn = snapTime([t], targets, 8 / this.pps);
      if (sn) t += sn.d;
      t = Math.round(t * fps) / fps;
      this.bus.run('clip.trim', { id: c.id, edge, time: Math.max(0, t) }, { coalesce: key });
    };
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  }

  updateSelection() {
    const s = this.bus.app.get();
    for (const el of this.content.querySelectorAll('.tl-clip')) el.classList.toggle('sel', s.selection.includes(el.dataset.id));
    for (const el of this.content.querySelectorAll('.tl-clip .kf')) {
      const id = el.closest('.tl-clip').dataset.id;
      el.classList.toggle('sel', s.selectedKeyframes.some((x) => x.clipId === id && x.path === el.dataset.path && x.index === +el.dataset.index));
    }
    this.graph.refresh();
  }

  updatePlayhead() {
    const t = this.bus.app.get().time;
    this.playhead.style.left = `${this.tToX(t)}px`;
    this.drawRuler();
    this.graph.updatePlayhead?.();
  }

  autoScroll() {
    const x = this.tToX(this.bus.app.get().time);
    const b = this.body;
    if (x > b.scrollLeft + b.clientWidth - 40 || x < b.scrollLeft) b.scrollLeft = Math.max(0, x - 60);
  }

  // ------------------------------------------------------------------ règle
  drawRuler() {
    const c = this.rulerCanvas;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = this.ruler.clientWidth, hgt = this.ruler.clientHeight;
    if (!w) return;
    if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(hgt * dpr); }
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, hgt);
    const p = this.bus.project.get();
    const fps = p.meta.fps;
    const pps = this.pps;
    const sl = this.body.scrollLeft;
    const steps = [1 / fps, 2 / fps, 5 / fps, 10 / fps, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
    const major = steps.find((s) => s * pps >= 80) || 300;
    const minor = steps.slice().reverse().find((s) => s * pps >= 8 && s < major) || major / 5;
    ctx.strokeStyle = '#2A2A2A'; ctx.fillStyle = '#8A8A8A'; ctx.font = '10px "JetBrains Mono", monospace';
    ctx.beginPath();
    const t0 = Math.floor(sl / pps / minor) * minor;
    for (let t = t0; t <= (sl + w) / pps; t += minor) {
      const x = Math.round(t * pps - sl) + 0.5;
      const isMajor = Math.abs(t / major - Math.round(t / major)) < 1e-6;
      ctx.moveTo(x, isMajor ? 10 : 20); ctx.lineTo(x, hgt);
      if (isMajor) ctx.fillText(formatTimecode(t, fps).replace(/^00:/, ''), x + 3, 10);
    }
    ctx.stroke();
    // fin de composition
    const xe = p.meta.duration * pps - sl;
    ctx.fillStyle = '#00000088'; ctx.fillRect(xe, 0, w - xe, hgt);
    // tête de lecture
    const xp = this.bus.app.get().time * pps - sl;
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    ctx.fillStyle = accent;
    ctx.beginPath(); ctx.moveTo(xp - 6, 14); ctx.lineTo(xp + 6, 14); ctx.lineTo(xp, 26); ctx.closePath(); ctx.fill();
    ctx.fillRect(xp - 0.5, 0, 1, hgt);
  }

  positionRulerOverlays() {
    const p = this.bus.project.get();
    const sl = this.body.scrollLeft;
    Object.assign(this.workEl.style, { left: `${p.workArea.in * this.pps - sl}px`, width: `${Math.max(4, (p.workArea.out - p.workArea.in) * this.pps)}px` });
    this.markersEl.innerHTML = '';
    for (const m of p.markers) {
      const x = m.t * this.pps - sl;
      const flag = h('div', { class: 'flag', style: { background: m.color }, title: `${m.label} — ${m.t.toFixed(2)}s (clic : aller, glisser : déplacer, double-clic : renommer, clic droit : supprimer)`, tabindex: 0 });
      const mk = h('div', { class: 'tl-marker', style: { left: `${x}px` } }, flag);
      flag.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        const sx = e.clientX;
        let moved = false;
        const key = `mk-${Date.now()}`;
        const mv = (ev) => { if (Math.abs(ev.clientX - sx) > 3) moved = true; if (moved) this.bus.run('marker.update', { id: m.id, t: Math.max(0, m.t + (ev.clientX - sx) / this.pps) }, { coalesce: key }); };
        const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); if (!moved) this.bus.run('playback.seek', { t: m.t }); };
        window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
      });
      flag.addEventListener('dblclick', () => { const l = prompt('Nom du marqueur', m.label); if (l !== null) this.bus.run('marker.update', { id: m.id, label: l }); });
      flag.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); contextMenu(e.clientX, e.clientY, [{ header: m.label }, ...['#24D26D', '#3D8BFF', '#E0A526', '#FF3D8B', '#B05CFF'].map((c) => ({ label: `Couleur ${c}`, cmd: 'marker.update', action: () => this.bus.run('marker.update', { id: m.id, color: c }) })), '-', { label: 'Supprimer le marqueur', icon: 'trash', cmd: 'marker.remove', action: () => this.bus.run('marker.remove', { id: m.id }) }]); });
      this.markersEl.append(mk);
      // ligne dans le corps
    }
    for (const el of this.content.querySelectorAll('.tl-marker')) el.remove();
    for (const m of p.markers) this.content.append(h('div', { class: 'tl-marker', style: { left: `${m.t * this.pps}px` } }, h('div', { class: 'line', style: { background: m.color } })));
  }

  // barre de cache : vert = pré-calculé, orange = image lente non calculée
  drawCacheBar() {
    const vp = this.app.viewport;
    const c = this.cacheBar;
    const w = this.ruler.clientWidth;
    if (!w || !vp) return;
    c.width = w; c.height = 3;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, w, 3);
    const p = this.bus.project.get();
    const fps = p.meta.fps;
    const sl = this.body.scrollLeft;
    const fw = Math.max(1, this.pps / fps);
    ctx.fillStyle = '#E0A526';
    for (const f of vp.slowFrames) if (!vp.frameCache.has(f)) ctx.fillRect((f / fps) * this.pps - sl, 0, fw, 3);
    ctx.fillStyle = '#24D26D';
    for (const f of vp.frameCache.keys()) ctx.fillRect((f / fps) * this.pps - sl, 0, fw, 3);
  }
}

export { BLEND_MODES, icon };
