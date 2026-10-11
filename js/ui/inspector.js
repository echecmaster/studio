// Inspecteur : propriétés générées depuis les schémas, keyframes (◆), expressions (ƒ), audio-réactivité, effets, masques,
// transitions, animation, temps, suivi, composition. Toute modification passe par une commande.
import { h, btn, iconBtn, contextMenu, section, openModal } from './dom.js';
import { icon, KIND_ICONS } from './icons.js';
import { PROP_SCHEMAS, FONTS, PARTICLE_PRESETS, UI_TEMPLATES, particlePreset, uiPreset, TEXT_ANIMATORS } from '../catalog/elements.js';
import { EFFECT_MAP, EFFECTS, EFFECT_CATEGORIES } from '../catalog/effects.js';
import { GENERATOR_MAP } from '../catalog/generators.js';
import { TRANSITIONS, TRANSITION_MAP } from '../catalog/transitions.js';
import { BLEND_MODES } from '../catalog/blendModes.js';
import { EASING_NAMES } from '../catalog/easings.js';
import { ANIMATION_PRESETS } from '../catalog/animPresets.js';
import { parseShaderParams, SHADER_PRESETS } from '../catalog/shaders.js';
import { resolveClip, makeLayerLookup, makeControlLookup } from '../core/evaluate.js';
import { getPath, deepClone } from '../core/util.js';
import { FORMAT_PRESETS } from '../core/commands/project.js';
import { toast } from './toasts.js';

const TRANSFORM_FIELDS = [
  ['x', 'Position X', -10000, 10000, 1], ['y', 'Position Y', -10000, 10000, 1], ['z', 'Profondeur Z', -5000, 5000, 1],
  ['scale', 'Échelle', 0, 50, 0.01], ['scaleX', 'Échelle X', -50, 50, 0.01], ['scaleY', 'Échelle Y', -50, 50, 0.01],
  ['rotation', 'Rotation', -3600, 3600, 0.1], ['rotationX', 'Rotation X (3D)', -360, 360, 0.5], ['rotationY', 'Rotation Y (3D)', -360, 360, 0.5],
  ['skewX', 'Inclinaison X', -80, 80, 0.5], ['skewY', 'Inclinaison Y', -80, 80, 0.5], ['anchorX', 'Ancre X', -2, 3, 0.01], ['anchorY', 'Ancre Y', -2, 3, 0.01], ['opacity', 'Opacité', 0, 1, 0.01],
];

export class Inspector {
  constructor(app, root) {
    this.app = app;
    this.bus = app.bus;
    this.root = root;
    this.updaters = [];
    this.structKey = null;
    this.collapsed = new Set(['Temps & vitesse', 'Suivi de mouvement', 'Expressions', 'Masques']);
    this.bus.project.subscribe(() => this.refresh());
    this.bus.app.subscribe((s, p) => { if (s.selection !== p.selection) this.refresh(true); else if (s.time !== p.time && !s.playing) this.update(); else if (s.time !== p.time) this.updateThrottled(); });
    this.refresh(true);
  }

  updateThrottled() { if (this._ut) return; this._ut = setTimeout(() => { this._ut = null; this.update(); }, 120); }

  clip() { const id = this.bus.app.get().selection[0]; return id ? this.bus.project.get().clips.find((c) => c.id === id) : null; }

  structureOf(c, sel) {
    if (!c) return `none|${sel.length}|${this.bus.project.get().meta.width}`;
    return JSON.stringify([sel, c.kind, c.effects.map((e) => [e.id, e.type, e.enabled, e.type === 'customShader' ? e.params.code?.length : 0, e.error || '']), c.masks.map((m) => [m.id, m.type, (m.points || []).length]), Object.keys(c.keyframes), Object.keys(c.expressions), Object.keys(c.audioLinks), !!c.transitionIn, !!c.transitionOut, c.transitionIn?.type, c.transitionOut?.type, c.props?.type, c.props?.preset, c.props?.template, c.props?.shape, c.props?.animator?.type, (c.props?.controls || []).map((x) => x.id), c.kind === 'shader' ? [c.props.code?.length, c.props.error || ''] : 0, c.parentId, c.matte?.sourceId, c.blendMode, this.bus.project.get().assets.length, this.bus.project.get().clips.length, c.motionPath ? 1 : 0, c.timeRemap?.enabled]);
  }

  refresh(force = false) {
    const sel = this.bus.app.get().selection;
    const c = this.clip();
    const key = this.structureOf(c, sel);
    if (!force && key === this.structKey) { this.update(); return; }
    this.structKey = key;
    const scroll = this.root.scrollTop;
    this.root.innerHTML = '';
    this.updaters = [];
    if (sel.length > 1) this.renderMulti(sel);
    else if (!c) this.renderComposition();
    else this.renderClip(c);
    this.root.scrollTop = scroll;
    this.update();
  }

  resolved() {
    const c = this.clip();
    if (!c) return null;
    const p = this.bus.project.get();
    const t = Math.max(c.start, Math.min(c.start + c.duration - 1e-4, this.bus.app.get().time));
    return resolveClip(c, t, { comp: p.meta, layer: makeLayerLookup(p, t), control: makeControlLookup(p, t) });
  }

  update() {
    const r = this.resolved();
    const c = this.clip();
    for (const u of this.updaters) { try { u(r, c); } catch { /* champ obsolète */ } }
  }

  sec(title, body, opts = {}) {
    const s = section(title, body, { ...opts, collapsed: this.collapsed.has(title) });
    s.querySelector('header').addEventListener('click', () => { if (s.classList.contains('collapsed')) this.collapsed.add(title); else this.collapsed.delete(title); });
    return s;
  }

  // ---------------------------------------------------------------- champs
  // path : chemin dans le clip ; set(value) : commande à appeler ; animatable : bouton keyframe
  field(def, { set, animatable = true, clipId } = {}) {
    const row = h('div', { class: 'row' });
    const label = h('label', { title: `${def.label} (${def.path || def.name})` }, def.label);
    row.append(label);
    let input;
    const path = def.path;
    const commit = (v) => set ? set(v) : this.bus.run('clip.set', { id: clipId, path, value: v }, { coalesce: `f-${clipId}-${path}` });
    switch (def.type) {
      case 'number': case 'float': {
        input = h('input', { class: 'input num grow', type: 'number', step: def.step ?? 'any', min: def.min, max: def.max, 'aria-label': def.label });
        const range = def.min !== undefined && def.max !== undefined && def.max - def.min <= 10000 ? h('input', { type: 'range', min: def.min, max: def.max, step: def.step || (def.max - def.min) / 200, 'aria-label': `${def.label} (curseur)`, tabindex: -1 }) : null;
        input.addEventListener('change', () => { if (input.value !== '') commit(+input.value); });
        range?.addEventListener('input', () => { input.value = range.value; commit(+range.value); });
        // glisser sur le libellé pour ajuster
        label.style.cursor = 'ew-resize';
        label.addEventListener('pointerdown', (e) => {
          const x0 = e.clientX, v0 = +input.value || 0;
          const step = def.step || ((def.max ?? 100) - (def.min ?? 0)) / 400 || 1;
          const mv = (ev) => { let v = v0 + (ev.clientX - x0) * step * (ev.shiftKey ? 10 : 1); if (def.min !== undefined) v = Math.max(def.min, v); if (def.max !== undefined) v = Math.min(def.max, v); v = +v.toFixed(4); input.value = v; if (range) range.value = v; commit(v); };
          const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
          window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
        });
        if (range) row.append(range);
        row.append(input);
        this.updaters.push((r) => { const v = def.get ? def.get(r) : getPath(r, path); if (document.activeElement !== input && v !== undefined) { input.value = typeof v === 'number' ? +v.toFixed(4) : v; if (range && document.activeElement !== range) range.value = v; } });
        break;
      }
      case 'color': {
        input = h('input', { class: 'input', type: 'color', 'aria-label': def.label });
        const hex = h('input', { class: 'input mono grow', 'aria-label': `${def.label} (hex)`, maxlength: 9 });
        input.addEventListener('input', () => { hex.value = input.value; commit(input.value); });
        hex.addEventListener('change', () => { if (/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex.value)) commit(hex.value); });
        row.append(input, hex);
        this.updaters.push((r) => { const v = def.get ? def.get(r) : getPath(r, path); if (typeof v === 'string') { if (document.activeElement !== hex) hex.value = v; input.value = v.slice(0, 7).length === 7 ? v.slice(0, 7) : '#000000'; } });
        break;
      }
      case 'select': {
        input = h('select', { class: 'input grow', 'aria-label': def.label }, ...def.options.map((o) => (Array.isArray(o) ? h('option', { value: o[0] }, o[1]) : h('option', { value: o }, o))));
        input.addEventListener('change', () => commit(def.numeric ? +input.value : input.value));
        row.append(input);
        this.updaters.push((r) => { const v = def.get ? def.get(r) : getPath(r, path); if (v !== undefined && document.activeElement !== input) input.value = v; });
        animatable = false;
        break;
      }
      case 'bool': {
        input = h('input', { type: 'checkbox', 'aria-label': def.label });
        input.addEventListener('change', () => commit(input.checked));
        row.append(h('span', { class: 'grow' }), input);
        this.updaters.push((r) => { input.checked = !!(def.get ? def.get(r) : getPath(r, path)); });
        animatable = false;
        break;
      }
      case 'text': case 'textarea': case 'dash': {
        input = def.type === 'textarea' ? h('textarea', { class: 'input grow', rows: 3, 'aria-label': def.label }) : h('input', { class: 'input grow', 'aria-label': def.label });
        input.addEventListener('input', () => commit(def.type === 'dash' ? input.value.split(/[\s,]+/).map(Number).filter((n) => n > 0) : input.value));
        input.addEventListener('keydown', (e) => e.stopPropagation());
        if (def.type === 'textarea') { row.style.alignItems = 'flex-start'; }
        row.append(input);
        this.updaters.push((r) => { const v = getPath(r, path); if (document.activeElement !== input) input.value = Array.isArray(v) ? v.join(' ') : v ?? ''; });
        animatable = false;
        break;
      }
      case 'font': {
        const fonts = [...FONTS, ...this.bus.project.get().assets.filter((a) => a.type === 'font').map((a) => a.meta?.family || a.name)];
        input = h('select', { class: 'input grow', 'aria-label': def.label }, ...fonts.map((f) => h('option', { value: f, style: { fontFamily: f } }, f)));
        input.addEventListener('change', () => commit(input.value));
        row.append(input);
        this.updaters.push((r) => { if (document.activeElement !== input) input.value = getPath(r, path); });
        animatable = false;
        break;
      }
      case 'easing': {
        input = h('select', { class: 'input grow', 'aria-label': def.label }, ...EASING_NAMES.map((e) => h('option', { value: e }, e)));
        input.addEventListener('change', () => commit(input.value));
        row.append(input);
        this.updaters.push((r) => { if (document.activeElement !== input) input.value = getPath(r, path); });
        animatable = false;
        break;
      }
      case 'asset': {
        const assets = this.bus.project.get().assets.filter((a) => !def.assetType || a.type === def.assetType || (def.assetType === 'image' && ['image', 'svg', 'video'].includes(a.type)) || (def.assetType === 'lut' && a.type === 'lut'));
        input = h('select', { class: 'input grow', 'aria-label': def.label }, h('option', { value: '' }, '— aucun —'), ...assets.map((a) => h('option', { value: a.id }, a.name)));
        input.addEventListener('change', () => commit(input.value));
        row.append(input);
        this.updaters.push((r) => { if (document.activeElement !== input) input.value = getPath(r, path) || ''; });
        animatable = false;
        break;
      }
      case 'point': {
        const ix = h('input', { class: 'input num', type: 'number', step: 0.01, 'aria-label': `${def.label} X` });
        const iy = h('input', { class: 'input num', type: 'number', step: 0.01, 'aria-label': `${def.label} Y` });
        const go = () => commit([+ix.value, +iy.value]);
        ix.addEventListener('change', go); iy.addEventListener('change', go);
        row.append(h('span', { class: 'grow' }), ix, iy);
        this.updaters.push((r) => { const v = getPath(r, path) || [0.5, 0.5]; if (document.activeElement !== ix) ix.value = v[0]; if (document.activeElement !== iy) iy.value = v[1]; });
        break;
      }
      case 'data': {
        input = h('textarea', { class: 'input grow', rows: 5, 'aria-label': def.label, placeholder: 'label,valeur\nJan,32\nFév,48' });
        input.addEventListener('keydown', (e) => e.stopPropagation());
        const apply = btn('Appliquer', () => {
          let v = input.value.trim();
          try { if (v.startsWith('[') || v.startsWith('{')) v = JSON.parse(v); } catch (e) { toast(`JSON invalide : ${e.message}`, 'error'); return; }
          commit(v);
        }, { cls: 'sm' });
        row.style.flexDirection = 'column'; row.style.alignItems = 'stretch';
        row.append(input, apply);
        this.updaters.push((r) => { if (document.activeElement !== input) { const v = getPath(r, path); input.value = typeof v === 'string' ? v : (v || []).map((d) => `${d.label},${d.value}`).join('\n'); } });
        animatable = false;
        break;
      }
      case 'code': {
        row.append(btn('Éditer le code…', () => this.app.ui.shaderEditor(clipId, def.effectId), { iconName: 'code', cls: 'sm grow' }));
        animatable = false;
        break;
      }
      default: break;
    }
    if (animatable && clipId && path) row.append(this.kfButton(clipId, path));
    if (clipId && path && (def.type === 'number' || def.type === 'float' || def.type === 'color')) {
      row.addEventListener('contextmenu', (e) => { e.preventDefault(); this.propMenu(e, clipId, path, def); });
    }
    return row;
  }

  kfButton(clipId, path) {
    const b = h('button', { class: 'kf-btn', 'aria-label': `Keyframe sur ${path}`, title: 'Keyframe : clic = ajouter/retirer à la tête de lecture · Alt+clic = supprimer toutes · clic droit = plus d\'options', dataset: { cmd: 'keyframe.add' } });
    b.innerHTML = icon('diamondo');
    b.addEventListener('click', async (e) => {
      const c = this.bus.project.get().clips.find((x) => x.id === clipId);
      const keys = c.keyframes[path] || [];
      const lt = this.bus.app.get().time - c.start;
      if (e.altKey && keys.length) { this.bus.run('keyframe.remove', { clipId, path, all: true }); return; }
      const idx = keys.findIndex((k) => Math.abs(k.t - lt) < 0.5 / this.bus.project.get().meta.fps);
      if (idx >= 0) this.bus.run('keyframe.remove', { clipId, path, index: idx });
      else this.bus.run('keyframe.add', { clipId, path });
    });
    this.updaters.push((r, c) => {
      const keys = c?.keyframes[path] || [];
      const lt = this.bus.app.get().time - (c?.start || 0);
      const at = keys.some((k) => Math.abs(k.t - lt) < 0.5 / this.bus.project.get().meta.fps);
      b.className = `kf-btn ${keys.length ? 'on' : ''} ${at ? 'at' : ''}`;
      b.innerHTML = icon(keys.length ? 'diamond' : 'diamondo');
      const expr = c?.expressions?.[path];
      b.parentElement?.querySelector('label')?.classList.toggle('err', !!r?.expressionErrors?.[path]);
      if (expr) b.title = `Expression : ${expr}`;
    });
    return b;
  }

  propMenu(e, clipId, path, def) {
    const c = this.bus.project.get().clips.find((x) => x.id === clipId);
    contextMenu(e.clientX, e.clientY, [
      { header: path },
      { label: 'Ajouter une keyframe', icon: 'diamond', cmd: 'keyframe.add', action: () => this.bus.run('keyframe.add', { clipId, path }) },
      c.keyframes[path] ? { label: 'Supprimer toutes les keyframes', icon: 'trash', cmd: 'keyframe.remove', action: () => this.bus.run('keyframe.remove', { clipId, path, all: true }) } : null,
      c.keyframes[path] ? { label: 'Ouvrir dans l\'éditeur de courbes', icon: 'graph', cmd: 'view.set', action: () => this.bus.run('view.set', { graphEditor: true, graphProperty: { clipId, path, mode: 'value' } }) } : null,
      { label: c.expressions[path] ? 'Modifier l\'expression…' : 'Ajouter une expression…', icon: 'code', cmd: 'expression.set', action: () => this.expressionDialog(clipId, path) },
      c.expressions[path] ? { label: 'Retirer l\'expression', icon: 'x', cmd: 'expression.clear', action: () => this.bus.run('expression.clear', { clipId, path }) } : null,
      def.type !== 'color' ? { label: c.audioLinks[path] ? 'Modifier le lien audio…' : 'Lier à l\'audio (audio-réactivité)…', icon: 'wave', cmd: 'audio.link_property', action: () => this.audioLinkDialog(clipId, path) } : null,
      c.audioLinks[path] ? { label: 'Délier de l\'audio', icon: 'x', cmd: 'audio.unlink_property', action: () => this.bus.run('audio.unlink_property', { clipId, path }) } : null,
      { label: 'Pickwhip : lier à une autre propriété…', icon: 'link', cmd: 'expression.set', action: () => this.pickwhipDialog(clipId, path) },
    ]);
  }

  expressionDialog(clipId, path) {
    const c = this.bus.project.get().clips.find((x) => x.id === clipId);
    const ta = h('textarea', { class: 'input', rows: 6, value: c.expressions[path] || 'wiggle(2, 30)', 'aria-label': 'Expression', style: { fontFamily: 'var(--mono)' } });
    const err = h('div', { class: 'err' });
    const help = h('div', { class: 'hint' }, 'Variables : value, time, index · fonctions : wiggle(f,a), loopOut("cycle"|"pingpong"), loopIn(), linear(t,t0,t1,v0,v1), ease(...), random(a,b), noise(x), clamp(), sin/cos/abs… · thisLayer, thisComp.layer("Nom").transform.x, control("Nom"), audio.amplitude, audio.band(i)');
    const m = openModal({ title: `Expression — ${path}`, iconName: 'code', body: [help, ta, err], footer: [btn('Annuler', () => m.close()), btn('Appliquer', async () => { const r = await this.bus.run('expression.set', { clipId, path, code: ta.value }); if (r.ok) m.close(); else err.textContent = r.error; }, { cls: 'primary', cmd: 'expression.set' })] });
  }

  pickwhipDialog(clipId, path) {
    const p = this.bus.project.get();
    const others = p.clips.filter((c) => c.id !== clipId);
    const selClip = h('select', { class: 'input' }, ...others.map((c) => h('option', { value: c.name }, c.name)));
    const selProp = h('select', { class: 'input' }, ...['transform.x', 'transform.y', 'transform.scale', 'transform.rotation', 'transform.opacity'].map((x) => h('option', { value: x }, x)));
    const mult = h('input', { class: 'input', type: 'number', value: 1, step: 0.1 });
    const m = openModal({ title: `Lier ${path} à…`, iconName: 'link', body: [h('div', { class: 'grid3' }, h('label', { class: 'field' }, h('span', {}, 'Calque'), selClip), h('label', { class: 'field' }, h('span', {}, 'Propriété'), selProp), h('label', { class: 'field' }, h('span', {}, 'Multiplicateur'), mult))], footer: [btn('Annuler', () => m.close()), btn('Lier', async () => { const [g, k] = selProp.value.split('.'); const r = await this.bus.run('expression.set', { clipId, path, code: `thisComp.layer("${selClip.value.replace(/"/g, '\\"')}").${g}.${k} * ${+mult.value || 1}` }); if (r.ok) m.close(); else toast(r.error, 'error'); }, { cls: 'primary', cmd: 'expression.set' })] });
  }

  audioLinkDialog(clipId, path) {
    const p = this.bus.project.get();
    const c = p.clips.find((x) => x.id === clipId);
    const cur = c.audioLinks[path] || {};
    const src = h('select', { class: 'input' }, h('option', { value: '' }, 'Mixage (premier audio actif)'), ...p.assets.filter((a) => a.type === 'audio' || a.type === 'video').map((a) => h('option', { value: a.id, selected: cur.assetId === a.id }, a.name)));
    const band = h('select', { class: 'input' }, h('option', { value: 'amplitude' }, 'Amplitude'), ...Array.from({ length: 16 }, (_, i) => h('option', { value: i, selected: cur.band === i }, `Bande ${i} ${i < 4 ? '(graves)' : i > 11 ? '(aigus)' : ''}`)));
    const mode = h('select', { class: 'input' }, h('option', { value: 'multiply' }, 'Multiplier'), h('option', { value: 'add', selected: cur.mode === 'add' }, 'Ajouter'));
    const gain = h('input', { class: 'input', type: 'number', step: 0.1, value: cur.gain ?? 1 });
    const smooth = h('input', { class: 'input', type: 'number', step: 0.05, min: 0, max: 0.99, value: cur.smoothing ?? 0.5 });
    const range = h('input', { class: 'input', type: 'number', step: 1, value: cur.range ?? 100 });
    const F = (l, el) => h('label', { class: 'field' }, h('span', {}, l), el);
    const m = openModal({ title: `Audio-réactivité — ${path}`, iconName: 'wave', body: [h('div', { class: 'grid3' }, F('Source', src), F('Bande', band), F('Mode', mode), F('Gain', gain), F('Lissage', smooth), F('Amplitude (mode ajout)', range))], footer: [btn('Annuler', () => m.close()), btn('Lier', async () => { const r = await this.bus.run('audio.link_property', { clipId, path, assetId: src.value || undefined, band: band.value === 'amplitude' ? 'amplitude' : +band.value, gain: +gain.value, smoothing: +smooth.value, mode: mode.value, range: +range.value }); if (r.ok) m.close(); else toast(r.error, 'error'); }, { cls: 'primary', cmd: 'audio.link_property' })] });
  }

  // ---------------------------------------------------------------- vues
  renderComposition() {
    const p = this.bus.project.get();
    const set = (k) => (v) => this.bus.run('project.set_format', { [k]: v }, { coalesce: `fmt-${k}` });
    const body = [
      h('div', { class: 'empty', style: { padding: '12px' }, html: `${icon('layers')}<div>Aucun calque sélectionné — propriétés de la composition.</div>` }),
      this.field({ type: 'select', label: 'Préset de format', options: [['', '—'], ...Object.entries(FORMAT_PRESETS).map(([k, [w, hh]]) => [k, `${k} (${w}×${hh})`])], get: () => '' }, { set: (v) => v && this.bus.run('project.set_format', { preset: v }), animatable: false }),
      this.field({ type: 'number', label: 'Largeur', min: 16, max: 7680, step: 2, get: () => this.bus.project.get().meta.width }, { set: set('width'), animatable: false }),
      this.field({ type: 'number', label: 'Hauteur', min: 16, max: 7680, step: 2, get: () => this.bus.project.get().meta.height }, { set: set('height'), animatable: false }),
      this.field({ type: 'select', label: 'Images/s', options: ['24', '25', '30', '50', '60'], numeric: true, get: () => String(p.meta.fps) }, { set: set('fps'), animatable: false }),
      this.field({ type: 'number', label: 'Durée (s)', min: 0.1, max: 3600, step: 0.1, get: () => this.bus.project.get().meta.duration }, { set: set('duration'), animatable: false }),
      this.field({ type: 'color', label: 'Fond', get: () => this.bus.project.get().meta.background }, { set: set('background'), animatable: false }),
      this.field({ type: 'bool', label: 'Flou de mouvement à l\'export', get: () => this.bus.project.get().meta.motionBlur?.enabled }, { set: (v) => this.bus.run('project.set_motion_blur', { enabled: v }), animatable: false }),
      this.field({ type: 'number', label: 'Échantillons de flou', min: 2, max: 16, step: 1, get: () => this.bus.project.get().meta.motionBlur?.samples ?? 8 }, { set: (v) => this.bus.run('project.set_motion_blur', { enabled: true, samples: v }), animatable: false }),
      this.field({ type: 'number', label: 'Obturateur (°)', min: 0, max: 720, step: 15, get: () => this.bus.project.get().meta.motionBlur?.shutter ?? 180 }, { set: (v) => this.bus.run('project.set_motion_blur', { enabled: true, shutter: v }), animatable: false }),
      h('div', { class: 'row' }, btn('Analyser le projet (lint)', () => this.app.ui.lintDialog(), { iconName: 'alert', cmd: 'project.lint' }), btn('Décrire la scène', async () => { const r = await this.bus.run('project.describe', {}); if (r.ok) openModal({ title: 'Description de la scène', body: h('pre', { class: 'mono', style: { whiteSpace: 'pre-wrap' } }, r.result.text) }); }, { iconName: 'info', cmd: 'project.describe' })),
    ];
    this.root.append(this.sec('Composition', body));
  }

  renderMulti(sel) {
    const p = this.bus.project.get();
    const ids = sel;
    const al = (to, ic) => iconBtn(ic, `Aligner : ${to}`, () => this.bus.run('clip.align', { ids, to }), { class: 'sm', cmd: 'clip.align' });
    this.root.append(this.sec(`${sel.length} clips sélectionnés`, [
      h('div', { class: 'hint' }, sel.map((id) => p.clips.find((c) => c.id === id)?.name).join(', ')),
      h('div', { class: 'row' }, h('span', { class: 'lbl' }, 'Aligner'), al('left', 'panelL'), al('center', 'split'), al('right', 'panelR'), al('top', 'chevron'), al('middle', 'minus'), al('bottom', 'panelB')),
      h('div', { class: 'row' }, h('span', { class: 'lbl' }, 'Répartir'), btn('X', () => this.bus.run('clip.distribute', { ids, axis: 'x' }), { cls: 'sm', cmd: 'clip.distribute' }), btn('Y', () => this.bus.run('clip.distribute', { ids, axis: 'y' }), { cls: 'sm', cmd: 'clip.distribute' }), btn('Temps', () => this.bus.run('clip.distribute', { ids, axis: 'time' }), { cls: 'sm', cmd: 'clip.distribute' })),
      h('div', { class: 'row' }, btn('Précomposer', () => this.bus.run('clip.precompose', { ids }), { iconName: 'layers', cmd: 'clip.precompose' }), btn('Transition entre', () => this.bus.run('transition.add', { clipId: ids[0], betweenClipId: ids[1], type: 'dissolve' }), { iconName: 'transition', cmd: 'transition.add' })),
      h('div', { class: 'row' }, btn('Dupliquer', () => this.bus.run('clip.duplicate', { ids }), { iconName: 'dup', cmd: 'clip.duplicate' }), btn('Supprimer', () => this.bus.run('clip.remove', { ids }), { iconName: 'trash', cls: 'danger', cmd: 'clip.remove' })),
      this.field({ type: 'select', label: 'Mode de fusion', options: BLEND_MODES.map((m) => [m.id, m.name]), get: () => p.clips.find((c) => c.id === ids[0])?.blendMode }, { set: (v) => this.bus.run('clip.set_blend_mode', { ids, mode: v }), animatable: false }),
      this.field({ type: 'number', label: 'Opacité (toutes)', min: 0, max: 1, step: 0.01, get: () => p.clips.find((c) => c.id === ids[0])?.transform.opacity }, { set: (v) => this.bus.run('clip.set_transform', { ids, opacity: v }, { coalesce: 'multi-op' }), animatable: false }),
    ]));
  }

  renderClip(c) {
    const p = this.bus.project.get();
    const id = c.id;
    const head = h('div', { class: 'row', style: { padding: '10px', gap: '8px', borderBottom: '1px solid var(--border)' } });
    head.innerHTML = icon(KIND_ICONS[c.kind] || 'layers');
    head.firstChild.style.cssText = 'width:18px;height:18px;color:var(--accent);flex:none';
    const nameIn = h('input', { class: 'input grow', value: c.name, 'aria-label': 'Nom du clip' });
    nameIn.addEventListener('change', () => this.bus.run('clip.rename', { id, name: nameIn.value || c.name }));
    nameIn.addEventListener('keydown', (e) => e.stopPropagation());
    head.append(nameIn, h('span', { class: 'badge accent' }, c.kind),
      iconBtn(c.locked ? 'lock' : 'unlock', 'Verrouiller', () => this.bus.run('clip.lock', { ids: [id] }), { class: 'ghost sm', cmd: 'clip.lock' }),
      iconBtn('trash', 'Supprimer', () => this.bus.run('clip.remove', { ids: [id] }), { class: 'ghost sm danger', cmd: 'clip.remove' }));
    this.root.append(head);

    // --- Transformation
    if (!['audio', 'adjustment'].includes(c.kind)) {
      const tf = TRANSFORM_FIELDS.map(([k, label, min, max, step]) => this.field({ type: 'number', label, min, max, step, path: `transform.${k}` }, { clipId: id, set: (v) => this.bus.run('clip.set_transform', { id, [k]: v }, { coalesce: `tf-${id}-${k}` }) }));
      tf.push(h('div', { class: 'row' }, btn('Réinitialiser', () => this.bus.run('clip.set_transform', { id, x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1, rotation: 0, rotationX: 0, rotationY: 0, skewX: 0, skewY: 0, anchorX: 0.5, anchorY: 0.5, opacity: 1 }), { cls: 'sm', cmd: 'clip.set_transform' }), btn('Centrer', () => this.bus.run('clip.align', { ids: [id], to: 'center', relative: 'comp' }).then(() => this.bus.run('clip.align', { ids: [id], to: 'middle', relative: 'comp' })), { cls: 'sm', cmd: 'clip.align' })));
      this.root.append(this.sec('Transformation', tf));
    } else if (c.kind === 'adjustment') {
      this.root.append(this.sec('Transformation', [this.field({ type: 'number', label: 'Opacité', min: 0, max: 1, step: 0.01, path: 'transform.opacity' }, { clipId: id, set: (v) => this.bus.run('clip.set_transform', { id, opacity: v }, { coalesce: `tf-${id}-op` }) })]));
    }

    // --- Propriétés spécifiques
    const props = [];
    if (c.kind === 'particles') props.push(this.field({ type: 'select', label: 'Appliquer un preset', options: PARTICLE_PRESETS, path: 'props.preset' }, { set: (v) => this.bus.run('clip.set_style', { id, style: particlePreset(v, p.meta) }), animatable: false }));
    if (c.kind === 'ui') props.push(this.field({ type: 'select', label: 'Changer de modèle', options: UI_TEMPLATES, path: 'props.template' }, { set: (v) => this.bus.run('clip.set_style', { id, style: uiPreset(v) }), animatable: false }));
    for (const def of PROP_SCHEMAS[c.kind] || []) {
      if (c.kind === 'particles' && def.path === 'props.preset') continue;
      if (c.kind === 'ui' && def.path === 'props.template') continue;
      if (c.kind === 'generator' && def.path === 'props.type') { props.push(this.field(def, { clipId: id, set: (v) => this.bus.run('clip.update', { id, patch: { props: { type: v, params: Object.fromEntries(GENERATOR_MAP[v].params.map((x) => [x.name, x.default])) } } }), animatable: false })); continue; }
      const animatable = ['number', 'color'].includes(def.type) && !/^props\.(shape|sides|points|preset|seed|maxParticles|bands|decimals)$/.test(def.path);
      props.push(this.field(def, { clipId: id, animatable }));
    }
    if (c.kind === 'generator') {
      const g = GENERATOR_MAP[c.props.type];
      for (const prm of g?.params || []) props.push(this.field({ ...prm, path: `props.params.${prm.name}`, numeric: false }, { clipId: id, animatable: prm.type !== 'select' }));
    }
    if (c.kind === 'shader') {
      props.unshift(this.field({ type: 'select', label: 'Shader prêt à l\'emploi', options: SHADER_PRESETS.map((s) => [s.id, s.name]), path: 'props.preset' }, { set: (v) => { const s = SHADER_PRESETS.find((x) => x.id === v); this.bus.run('shader.set_code', { clipId: id, code: s.code }).then(() => this.bus.run('clip.set', { id, path: 'props.preset', value: v })); }, animatable: false }));
      if (c.props.error) props.unshift(h('div', { class: 'shader-errors' }, c.props.error));
      for (const prm of parseShaderParams(c.props.code || '')) props.push(this.field({ ...prm, path: `props.params.${prm.name}` }, { clipId: id }));
    }
    if (c.kind === 'null') props.push(...this.controlsEditor(c));
    if (c.kind === 'camera') props.push(h('div', { class: 'row' }, ...['dolly-in', 'dolly-out', 'pan-left', 'pan-right', 'orbit', 'zoom-punch', 'handheld', 'earthquake'].map((t) => btn(t, () => this.bus.run('camera.preset_move', { type: t }), { cls: 'sm', cmd: 'camera.preset_move' }))));
    if (c.kind === 'audio' || c.kind === 'video') props.push(h('div', { class: 'row' }, btn('Détecter les beats', () => this.bus.run('audio.detect_beats', { clipId: id }), { iconName: 'marker', cls: 'sm', cmd: 'audio.detect_beats' })));
    if (props.length) this.root.append(this.sec('Propriétés', props));

    if (c.kind === 'text') this.root.append(this.sec('Animateur de texte', this.textAnimatorEditor(c)));

    // --- Calque : fusion, parent, matte
    if (!['audio'].includes(c.kind)) {
      const others = p.clips.filter((x) => x.id !== id);
      this.root.append(this.sec('Calque', [
        this.field({ type: 'select', label: 'Mode de fusion', options: BLEND_MODES.map((m) => [m.id, m.name]), path: 'blendMode' }, { set: (v) => this.bus.run('clip.set_blend_mode', { ids: [id], mode: v }), animatable: false }),
        this.field({ type: 'select', label: 'Parent', options: [['', '— aucun —'], ...others.map((x) => [x.id, x.name])], get: (r) => r?.parentId || '' }, { set: (v) => this.bus.run('clip.set_parent', { id, parentId: v || null }), animatable: false }),
        this.field({ type: 'select', label: 'Track matte (source)', options: [['', '— aucun —'], ...others.map((x) => [x.id, x.name])], get: (r) => r?.matte?.sourceId || '' }, { set: (v) => this.bus.run('matte.set', { clipId: id, sourceId: v || null, type: c.matte?.type || 'alpha' }), animatable: false }),
        c.matte ? this.field({ type: 'select', label: 'Type de matte', options: [['alpha', 'Alpha'], ['alphaInverted', 'Alpha inversé'], ['luma', 'Luma'], ['lumaInverted', 'Luma inversé']], get: () => c.matte.type }, { set: (v) => this.bus.run('matte.set', { clipId: id, sourceId: c.matte.sourceId, type: v }), animatable: false }) : null,
      ]));
    }

    // --- Effets
    if (!['audio', 'camera', 'null'].includes(c.kind)) this.root.append(this.sec(`Effets (${c.effects.length})`, this.effectsEditor(c), { actions: [iconBtn('plus', 'Ajouter un effet', (e) => this.effectPicker(e, id), { class: 'ghost sm', cmd: 'effect.add' })] }));

    // --- Masques
    if (!['audio', 'camera', 'null'].includes(c.kind)) this.root.append(this.sec('Masques', this.masksEditor(c)));

    // --- Transitions & animation
    if (!['camera', 'null'].includes(c.kind)) this.root.append(this.sec('Transitions', this.transitionsEditor(c)));
    if (!['audio'].includes(c.kind)) this.root.append(this.sec('Animation', this.animationEditor(c)));

    // --- Keyframes, expressions, audio
    const kpaths = Object.keys(c.keyframes);
    if (kpaths.length) this.root.append(this.sec(`Keyframes (${kpaths.length} propriétés)`, kpaths.map((path) => h('div', { class: 'row' },
      h('span', { class: 'lbl mono', title: path }, path), h('span', { class: 'hint grow' }, `${c.keyframes[path].length} clés`),
      h('select', { class: 'input', 'aria-label': `Easing de ${path}`, onchange: (e) => this.bus.run('keyframe.set_easing', { clipId: id, path, easing: e.target.value }), dataset: { cmd: 'keyframe.set_easing' } }, h('option', { value: '' }, 'easing…'), ...EASING_NAMES.concat(['hold', 'spring']).map((e) => h('option', { value: e }, e))),
      iconBtn('graph', 'Éditeur de courbes', () => this.bus.run('view.set', { graphEditor: true, graphProperty: { clipId: id, path, mode: 'value' } }), { class: 'ghost sm', cmd: 'view.set' }),
      iconBtn('trash', 'Supprimer les keyframes', () => this.bus.run('keyframe.remove', { clipId: id, path, all: true }), { class: 'ghost sm', cmd: 'keyframe.remove' })))));
    const exprs = Object.entries(c.expressions);
    this.root.append(this.sec('Expressions', [
      ...exprs.map(([path, code]) => h('div', { class: 'row' }, h('span', { class: 'lbl mono' }, path), h('code', { class: 'grow mono hint', style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, code), iconBtn('code', 'Modifier', () => this.expressionDialog(id, path), { class: 'ghost sm', cmd: 'expression.set' }), iconBtn('x', 'Retirer', () => this.bus.run('expression.clear', { clipId: id, path }), { class: 'ghost sm', cmd: 'expression.clear' }))),
      h('div', { class: 'hint' }, 'Clic droit sur une propriété numérique → expression, pickwhip, audio-réactivité.'),
      btn('Ajouter une expression (wiggle sur la rotation)', () => this.expressionDialog(id, 'transform.rotation'), { cls: 'sm', cmd: 'expression.set' }),
    ]));
    const links = Object.entries(c.audioLinks);
    if (links.length) this.root.append(this.sec('Audio-réactivité', links.map(([path, l]) => h('div', { class: 'row' }, h('span', { class: 'lbl mono' }, path), h('span', { class: 'hint grow' }, `${l.band} · gain ${l.gain} · ${l.mode}`), iconBtn('wave', 'Modifier', () => this.audioLinkDialog(id, path), { class: 'ghost sm' }), iconBtn('x', 'Délier', () => this.bus.run('audio.unlink_property', { clipId: id, path }), { class: 'ghost sm', cmd: 'audio.unlink_property' })))));

    // --- Temps
    this.root.append(this.sec('Temps & vitesse', [
      this.field({ type: 'number', label: 'Début (s)', min: 0, max: 3600, step: 1 / p.meta.fps, path: 'start' }, { set: (v) => this.bus.run('clip.move', { ids: [id], start: v }, { coalesce: `st-${id}` }), animatable: false }),
      this.field({ type: 'number', label: 'Durée (s)', min: 0.01, max: 3600, step: 1 / p.meta.fps, path: 'duration' }, { set: (v) => this.bus.run('clip.set_duration', { id, duration: v }, { coalesce: `du-${id}` }), animatable: false }),
      this.field({ type: 'number', label: 'Point d\'entrée source (s)', min: 0, max: 3600, step: 0.01, path: 'inPoint' }, { clipId: id, animatable: false }),
      this.field({ type: 'number', label: 'Vitesse', min: 0.1, max: 10, step: 0.05, path: 'speed' }, { set: (v) => this.bus.run('clip.set_speed', { id, speed: v }, { coalesce: `sp-${id}` }), animatable: false }),
      this.field({ type: 'bool', label: 'Lecture inversée', path: 'reverse' }, { set: (v) => this.bus.run('clip.reverse', { id, reverse: v }), animatable: false }),
      this.field({ type: 'select', label: 'Time remap', options: [['', '—'], ['slowmo-middle', 'Ralenti au milieu'], ['speed-ramp', 'Rampe d\'accélération'], ['freeze-end', 'Figer la fin'], ['rewind', 'Rembobinage'], ['off', 'Désactiver']], get: () => '' }, { set: (v) => v === 'off' ? this.bus.run('clip.time_remap', { id, enabled: false }) : v && this.bus.run('clip.time_remap', { id, preset: v }), animatable: false }),
      h('div', { class: 'row' }, ...[['posterizeTime', 'Basse cadence'], ['echo', 'Écho'], ['trails', 'Traînées'], ['freezeFrame', 'Figer'], ['pingPong', 'Ping-pong'], ['frameBlend', 'Interpolation']].map(([t, l]) => btn(l, () => this.bus.run('effect.add', { clipId: id, type: t }), { cls: 'sm', cmd: 'effect.add' }))),
    ]));

    if (c.kind === 'video') {
      const tx = h('input', { class: 'input num', type: 'number', value: 0, 'aria-label': 'X du point' }), ty = h('input', { class: 'input num', type: 'number', value: 0, 'aria-label': 'Y du point' });
      const target = h('select', { class: 'input grow', 'aria-label': 'Clip cible' }, ...p.clips.filter((x) => x.id !== id).map((x) => h('option', { value: x.id }, x.name)));
      const trData = (p.trackingData || []).filter((t) => t.clipId === id);
      this.root.append(this.sec('Suivi de mouvement', [
        h('div', { class: 'row' }, h('span', { class: 'lbl' }, 'Point (px, centre = 0)'), tx, ty),
        btn('Suivre ce point', () => this.bus.run('tracking.track_point', { clipId: id, x: +tx.value, y: +ty.value }), { iconName: 'isolate', cls: 'sm', cmd: 'tracking.track_point' }),
        ...trData.map((t) => h('div', { class: 'row' }, h('span', { class: 'grow' }, `${t.name} (${t.samples.length} images)`), btn('Stabiliser', () => this.bus.run('tracking.stabilize', { trackingId: t.id }), { cls: 'sm', cmd: 'tracking.stabilize' }))),
        trData.length ? h('div', { class: 'row' }, target, btn('Appliquer', () => this.bus.run('tracking.apply', { trackingId: trData[trData.length - 1].id, targetClipId: target.value }), { cls: 'sm', cmd: 'tracking.apply' })) : null,
      ]));
    }
  }

  textAnimatorEditor(c) {
    const id = c.id;
    const a = c.props.animator || {};
    const set = (k) => (v) => this.bus.run('animation.text_animator', { clipId: id, type: k === 'type' ? v : a.type || 'fade', [k]: v }, { coalesce: `ta-${id}-${k}` });
    return [
      this.field({ type: 'select', label: 'Type', options: TEXT_ANIMATORS, get: () => a.type || 'none' }, { set: (v) => this.bus.run('animation.text_animator', { clipId: id, type: v }), animatable: false }),
      a.type ? this.field({ type: 'select', label: 'Par', options: [['char', 'Caractère'], ['word', 'Mot'], ['line', 'Ligne']], get: () => a.by }, { set: set('by'), animatable: false }) : null,
      a.type ? this.field({ type: 'select', label: 'Sens', options: [['in', 'Entrée'], ['out', 'Sortie']], get: () => a.direction }, { set: set('direction'), animatable: false }) : null,
      a.type ? this.field({ type: 'number', label: 'Début (s)', min: 0, max: 600, step: 0.05, get: () => a.start }, { set: set('start'), animatable: false }) : null,
      a.type ? this.field({ type: 'number', label: 'Durée (s)', min: 0.05, max: 60, step: 0.05, get: () => a.duration }, { set: set('duration'), animatable: false }) : null,
      a.type ? this.field({ type: 'number', label: 'Décalage (stagger)', min: 0, max: 1, step: 0.005, get: () => a.stagger }, { set: set('stagger'), animatable: false }) : null,
      a.type ? this.field({ type: 'number', label: 'Intensité', min: 0, max: 3, step: 0.05, get: () => a.amount }, { set: set('amount'), animatable: false }) : null,
      a.type ? this.field({ type: 'easing', label: 'Easing', get: () => a.easing, path: 'props.animator.easing' }, { set: set('easing'), animatable: false }) : null,
      a.type ? this.field({ type: 'bool', label: 'Ordre aléatoire', get: () => a.random }, { set: set('random'), animatable: false }) : null,
    ];
  }

  controlsEditor(c) {
    const id = c.id;
    const out = (c.props.controls || []).map((ctl) => {
      const path = `props.controls.${ctl.id}.value`;
      const def = ctl.type === 'color' ? { type: 'color', label: ctl.name, path } : ctl.type === 'checkbox' ? { type: 'bool', label: ctl.name, path } : { type: 'number', label: ctl.name, min: ctl.type === 'angle' ? -360 : ctl.min, max: ctl.type === 'angle' ? 360 : ctl.max, step: 0.1, path };
      const row = this.field(def, { clipId: id, set: (v) => this.bus.run('control.update', { clipId: id, controlId: ctl.id, value: v }, { coalesce: `ctl-${ctl.id}` }), animatable: ctl.type !== 'checkbox' });
      row.append(iconBtn('x', 'Supprimer le contrôle', () => this.bus.run('control.remove', { clipId: id, controlId: ctl.id }), { class: 'ghost sm', cmd: 'control.remove' }));
      return row;
    });
    out.push(h('div', { class: 'row' }, ...[['slider', 'Curseur'], ['color', 'Couleur'], ['checkbox', 'Case'], ['angle', 'Angle']].map(([t, l]) => btn(`+ ${l}`, () => { const n = prompt('Nom du contrôle', l); if (n) this.bus.run('control.add', { clipId: id, type: t, name: n }); }, { cls: 'sm', cmd: 'control.add' }))));
    out.push(h('div', { class: 'hint' }, 'Utilisez control("Nom") dans une expression pour lire un contrôle.'));
    return out;
  }

  effectPicker(e, clipId) {
    const groups = Object.entries(EFFECT_CATEGORIES).map(([cat, label]) => ({ header: label, items: EFFECTS.filter((x) => x.category === cat) }));
    const inp = h('input', { class: 'input', placeholder: 'Rechercher un effet…', 'aria-label': 'Rechercher un effet' });
    const list = h('div', { class: 'palette-list' });
    const draw = () => {
      list.innerHTML = '';
      const q = inp.value.toLowerCase();
      for (const g of groups) {
        const its = g.items.filter((x) => !q || x.name.toLowerCase().includes(q) || x.id.toLowerCase().includes(q) || x.en.toLowerCase().includes(q));
        if (!its.length) continue;
        list.append(h('div', { class: 'lib-group-title' }, g.header));
        for (const it of its) list.append(h('div', { class: 'palette-item', tabindex: 0, onclick: () => { this.bus.run('effect.add', { clipId, type: it.id }); m.close(); }, onkeydown: (ev) => { if (ev.key === 'Enter') ev.target.click(); } }, h('span', { class: 'title' }, it.name), h('span', { class: 'name' }, it.id)));
      }
    };
    inp.addEventListener('input', draw);
    const m = openModal({ title: `Ajouter un effet (${EFFECTS.length})`, iconName: 'fx', body: [inp, list], className: 'palette' });
    draw();
    void e;
  }

  effectsEditor(c) {
    const id = c.id;
    const wrap = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } });
    c.effects.forEach((e, idx) => {
      const def = EFFECT_MAP[e.type];
      const card = h('div', { class: `fx-card ${e.enabled ? '' : 'disabled'}`, draggable: 'true', dataset: { id: e.id } });
      const toggle = h('input', { type: 'checkbox', checked: e.enabled, 'aria-label': 'Activer l\'effet', onchange: () => this.bus.run('effect.toggle', { clipId: id, effectId: e.id }), dataset: { cmd: 'effect.toggle' } });
      const head = h('div', { class: 'fx-head' }, h('span', { html: icon('drag'), style: { width: '12px', color: 'var(--text-3)' } }), toggle, h('span', { class: 'title' }, def?.name || e.type),
        e.error ? h('span', { class: 'badge', style: { color: 'var(--danger)' }, title: e.error }, 'erreur') : null,
        iconBtn('compare', 'Comparer avant/après', () => this.bus.run('view.set', { compare: { clipId: id, effectId: e.id, split: 0.5 } }), { class: 'ghost sm', cmd: 'view.set' }),
        iconBtn('dup', 'Dupliquer', () => this.bus.run('effect.duplicate', { clipId: id, effectId: e.id }), { class: 'ghost sm', cmd: 'effect.duplicate' }),
        iconBtn('x', 'Retirer', () => this.bus.run('effect.remove', { clipId: id, effectId: e.id }), { class: 'ghost sm', cmd: 'effect.remove' }));
      const body = h('div', { class: 'fx-body' });
      for (const prm of def?.params || []) {
        const path = `effects.${e.id}.params.${prm.name}`;
        if (prm.type === 'code') { body.append(this.field({ ...prm, type: 'code', effectId: e.id, path }, { clipId: id })); continue; }
        const fdef = { ...prm, path, type: prm.type === 'float' ? 'number' : prm.type === 'asset' ? 'asset' : prm.type, assetType: prm.name === 'lut' ? 'lut' : 'image', options: prm.options };
        body.append(this.field(fdef, { clipId: id, animatable: ['float', 'color', 'point'].includes(prm.type), set: (v) => this.bus.run('effect.update', { clipId: id, effectId: e.id, params: { [prm.name]: v } }, { coalesce: `fx-${e.id}-${prm.name}` }) }));
      }
      if (!def?.params.length) body.append(h('div', { class: 'hint' }, def?.temporal ? 'Effet temporel (sans paramètre).' : 'Aucun paramètre.'));
      card.append(head, body);
      head.addEventListener('dblclick', () => card.classList.toggle('collapsed'));
      card.addEventListener('dragstart', (ev) => { ev.dataTransfer.setData('text/fx', e.id); ev.stopPropagation(); });
      card.addEventListener('dragover', (ev) => { ev.preventDefault(); card.classList.add('drop-before'); });
      card.addEventListener('dragleave', () => card.classList.remove('drop-before'));
      card.addEventListener('drop', (ev) => { ev.preventDefault(); card.classList.remove('drop-before'); const fid = ev.dataTransfer.getData('text/fx'); if (fid && fid !== e.id) this.bus.run('effect.reorder', { clipId: id, effectId: fid, index: idx }); });
      wrap.append(card);
    });
    wrap.append(h('div', { class: 'row', style: { flexWrap: 'wrap' } },
      btn('Ajouter un effet', (ev) => this.effectPicker(ev, id), { iconName: 'plus', cls: 'sm primary', cmd: 'effect.add' }),
      btn('Copier la pile', () => this.bus.run('effect.copy_stack', { clipId: id }), { cls: 'sm', cmd: 'effect.copy_stack' }),
      btn('Coller', () => this.bus.run('effect.paste_stack', { clipIds: [id] }), { cls: 'sm', cmd: 'effect.paste_stack' }),
      btn('Enregistrer comme preset', () => { const n = prompt('Nom du preset d\'effets'); if (n) this.bus.run('effect.save_preset', { clipId: id, name: n }); }, { cls: 'sm', cmd: 'effect.save_preset' }),
      btn('Importer preset…', () => { const t = prompt('Collez le JSON du preset {name, effects:[…]}'); if (t) this.bus.run('effect.import_preset', { preset: t }); }, { cls: 'sm', cmd: 'effect.import_preset' }),
      btn('Exporter presets', async () => { const r = await this.bus.run('effect.list_presets', {}); const user = (r.result || []).filter((x) => !x.builtin); if (!user.length) { toast('Aucun preset utilisateur.', 'warn'); return; } const ex = await this.bus.run('effect.export_preset', { presetId: user[user.length - 1].id }); this.app.download(new Blob([JSON.stringify(ex.result, null, 2)], { type: 'application/json' }), `${ex.result.name}.preset.json`); }, { cls: 'sm', cmd: 'effect.export_preset' })));
    return wrap;
  }

  masksEditor(c) {
    const id = c.id;
    const out = c.masks.map((m) => {
      const upd = (patch) => this.bus.run('mask.update', { clipId: id, maskId: m.id, patch }, { coalesce: `msk-${m.id}-${Object.keys(patch)[0]}` });
      const num = (k, label, min, max, step = 1) => this.field({ type: 'number', label, min, max, step, path: `masks.${m.id}.${k}` }, { clipId: id, set: (v) => upd({ [k]: v }), animatable: ['x', 'y', 'width', 'height', 'feather', 'expansion', 'opacity'].includes(k) });
      return h('div', { class: 'fx-card' },
        h('div', { class: 'fx-head' }, h('input', { type: 'checkbox', checked: m.enabled !== false, 'aria-label': 'Activer le masque', onchange: (e) => upd({ enabled: e.target.checked }) }), h('span', { class: 'title' }, `Masque ${m.type}`), iconBtn('x', 'Supprimer le masque', () => this.bus.run('mask.remove', { clipId: id, maskId: m.id }), { class: 'ghost sm', cmd: 'mask.remove' })),
        h('div', { class: 'fx-body' },
          this.field({ type: 'select', label: 'Mode', options: ['add', 'subtract', 'intersect', 'difference'], path: `masks.${m.id}.mode` }, { set: (v) => upd({ mode: v }), animatable: false }),
          ...(m.type === 'rect' || m.type === 'ellipse' ? [num('x', 'Centre X', -5000, 5000), num('y', 'Centre Y', -5000, 5000), num('width', 'Largeur', 0, 8000), num('height', 'Hauteur', 0, 8000)] : [h('div', { class: 'hint' }, `${(m.points || []).length} points (modifiables via mask.update)`)]),
          num('feather', 'Contour progressif', 0, 500), num('expansion', 'Expansion', -500, 500), num('opacity', 'Opacité', 0, 1, 0.01),
          this.field({ type: 'bool', label: 'Inverser', path: `masks.${m.id}.invert` }, { set: (v) => upd({ invert: v }), animatable: false })));
    });
    out.push(h('div', { class: 'row', style: { flexWrap: 'wrap' } }, ...[['rect', 'Rectangle'], ['ellipse', 'Ellipse'], ['polygon', 'Polygone'], ['bezier', 'Bézier']].map(([t, l]) => btn(`+ ${l}`, () => this.bus.run('mask.add', { clipId: id, type: t }), { cls: 'sm', cmd: 'mask.add' }))));
    return out;
  }

  transitionsEditor(c) {
    const id = c.id;
    const edge = (key, label, e) => {
      const tr = c[key];
      const rows = [this.field({ type: 'select', label, options: [['', '— aucune —'], ...TRANSITIONS.map((t) => [t.id, t.name])], get: () => tr?.type || '' }, { set: (v) => v ? (tr ? this.bus.run('transition.update', { clipId: id, edge: e, type: v }) : this.bus.run('transition.add', { clipId: id, edge: e, type: v })) : this.bus.run('transition.remove', { clipId: id, edge: e }), animatable: false })];
      if (tr) {
        rows.push(this.field({ type: 'number', label: 'Durée (s)', min: 0.02, max: c.duration, step: 0.05, get: () => tr.duration }, { set: (v) => this.bus.run('transition.update', { clipId: id, edge: e, duration: v }, { coalesce: `tr-${id}-${e}` }), animatable: false }));
        rows.push(this.field({ type: 'easing', label: 'Easing', get: () => tr.easing, path: `${key}.easing` }, { set: (v) => this.bus.run('transition.update', { clipId: id, edge: e, easing: v }), animatable: false }));
        for (const prm of TRANSITION_MAP[tr.type]?.params || []) rows.push(this.field({ ...prm, type: prm.type === 'float' ? 'number' : prm.type, path: `${key}.params.${prm.name}` }, { set: (v) => this.bus.run('transition.update', { clipId: id, edge: e, params: { [prm.name]: v } }, { coalesce: `trp-${id}-${prm.name}` }), animatable: false }));
      }
      return rows;
    };
    return [...edge('transitionIn', 'Entrée', 'in'), ...edge('transitionOut', 'Sortie', 'out')];
  }

  animationEditor(c) {
    const id = c.id;
    const opt = (type) => [['', '—'], ...ANIMATION_PRESETS.filter((p) => p.type === type).map((p) => [p.id, p.name])];
    const p = this.bus.project.get();
    return [
      this.field({ type: 'select', label: 'Preset d\'entrée', options: opt('in'), get: () => '' }, { set: (v) => v && this.bus.run('animation.apply_preset', { clipId: id, preset: v }), animatable: false }),
      this.field({ type: 'select', label: 'Preset de sortie', options: opt('out'), get: () => '' }, { set: (v) => v && this.bus.run('animation.apply_preset', { clipId: id, preset: v }), animatable: false }),
      this.field({ type: 'select', label: 'Emphase (à la tête de lecture)', options: opt('emphasis'), get: () => '' }, { set: (v) => v && this.bus.run('animation.apply_preset', { clipId: id, preset: v }), animatable: false }),
      this.field({ type: 'select', label: 'Suivre le tracé de…', options: [['', '—'], ...p.clips.filter((x) => x.kind === 'shape' && x.id !== id).map((x) => [x.id, x.name]), ...(c.motionPath ? [['__remove', 'Retirer le suivi']] : [])], get: () => '' }, { set: (v) => v === '__remove' ? this.bus.run('path.follow', { clipId: id, remove: true }) : v && this.bus.run('path.follow', { clipId: id, sourceClipId: v, autoOrient: true }), animatable: false }),
      c.kind === 'shape' ? this.field({ type: 'select', label: 'Morphing vers…', options: [['', '—'], ['circle', 'Cercle'], ['star', 'Étoile'], ['triangle', 'Triangle'], ['heart', 'Cœur'], ['polygon', 'Polygone'], ['rect', 'Rectangle'], ...p.clips.filter((x) => x.kind === 'shape' && x.id !== id).map((x) => [`clip:${x.id}`, `Forme : ${x.name}`])], get: () => '' }, { set: (v) => v && (v.startsWith('clip:') ? this.bus.run('path.morph', { clipId: id, toClipId: v.slice(5) }) : this.bus.run('path.morph', { clipId: id, to: { shape: v } })), animatable: false }) : null,
      h('div', { class: 'row' }, btn('Tout effacer', () => this.bus.run('animation.clear', { clipId: id }), { iconName: 'trash', cls: 'sm', cmd: 'animation.clear' }), btn('Coller keyframes', () => this.bus.run('keyframe.paste', { clipId: id }), { cls: 'sm', cmd: 'keyframe.paste' })),
    ];
  }
}

export { deepClone };
