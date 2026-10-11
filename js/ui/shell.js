// Coque de l'application : barre du haut, transport, séparateurs redimensionnables, menus de clip, ouverture de panneaux
import { h, btn, iconBtn, contextMenu, anyModalOpen } from './dom.js';
import { icon } from './icons.js';
import { formatTimecode } from '../core/util.js';
import { BLEND_MODES } from '../catalog/blendModes.js';
import { ANIMATION_PRESETS } from '../catalog/animPresets.js';
import { TRANSITIONS } from '../catalog/transitions.js';
import { openPalette } from './commandPalette.js';
import { exportDialog, exportProgress, newProjectDialog, shaderEditor, shortcutsDialog, bezierEditor, lintDialog, shareDialog, scriptDialog, helpDialog, settingsDialog } from './modals.js';
import { t } from '../core/i18n.js';

export class Shell {
  constructor(app) {
    this.app = app;
    this.bus = app.bus;
    this.root = document.getElementById('app');
  }

  modalOpen() { return anyModalOpen(); }

  buildTopbar(el) {
    const bus = this.bus;
    const logo = h('div', { class: 'logo', html: `${icon('logo')}<span>MOTION <b>STUDIO</b></span>` });
    const name = h('input', { id: 'project-name', class: 'input', 'aria-label': 'Nom du projet', value: bus.project.get().meta.name });
    name.addEventListener('change', () => bus.run('project.rename', { name: name.value || 'Sans titre' }));
    name.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') name.blur(); });
    bus.project.subscribe((p) => { if (document.activeElement !== name) name.value = p.meta.name; });
    this.undoBtn = iconBtn('undo', `${t('undo')} (Ctrl+Z)`, () => bus.run('history.undo'), { class: 'ghost', cmd: 'history.undo' });
    this.redoBtn = iconBtn('redo', `${t('redo')} (Ctrl+Shift+Z)`, () => bus.run('history.redo'), { class: 'ghost', cmd: 'history.redo' });
    const fmt = h('button', { class: 'btn ghost mono hide-mobile', title: 'Format de la composition (cliquer pour modifier)', onclick: () => { bus.run('clip.select', { mode: 'clear' }); this.openPanel('inspector'); }, dataset: { cmd: 'project.set_format' } });
    const updFmt = () => { const m = bus.project.get().meta; fmt.textContent = `${m.width}×${m.height} · ${m.fps} i/s · ${m.duration}s`; };
    updFmt();
    bus.project.subscribe(updFmt);
    this.mcpChip = h('button', { class: 'chip hide-small', title: 'Statut MCP — cliquer pour ouvrir le panneau MCP', onclick: () => this.openPanel('mcp') }, h('span', { class: 'dot' }), 'MCP');
    const updMcp = () => {
      const s = bus.app.get().mcp;
      const on = s.webmcp === 'actif' || s.relay === 'connecté';
      this.mcpChip.className = `chip hide-small ${on ? 'on' : ''}`;
      this.mcpChip.lastChild.textContent = ` Mode MCP : ${on ? 'actif' : 'motionAPI'}${s.relay === 'connecté' ? ' · relais' : ''}${s.webmcp === 'actif' ? ' · WebMCP' : ''}`;
    };
    bus.app.subscribe((s, p) => { if (s.mcp !== p.mcp) updMcp(); });
    updMcp();
    this.saveChip = h('span', { class: 'chip hide-small', title: 'Autosauvegarde locale toutes les 5 s' }, h('span', { class: 'dot' }), 'Enregistré');
    const exportBtn = h('button', { id: 'export-btn', class: 'btn primary', onclick: () => this.openPanel('export'), title: 'Exporter (Ctrl+E)', dataset: { cmd: 'export.start' } });
    exportBtn.innerHTML = `${icon('export')}<span>${t('export')}</span>`;
    el.append(
      iconBtn('menu', 'Bibliothèque', () => this.togglePanel('left'), { class: 'ghost', cmd: 'app.toggle_panel' }),
      logo, name, h('span', { class: 'topbar-sep' }), this.undoBtn, this.redoBtn, h('span', { class: 'topbar-sep hide-mobile' }), fmt,
      iconBtn('command', `${t('palette')} (Ctrl+K)`, () => openPalette(this.app), { class: 'ghost', cmd: 'app.open_panel' }),
      iconBtn('save', `${t('save')} (Ctrl+S)`, () => bus.run('project.save'), { class: 'ghost', cmd: 'project.save' }),
      iconBtn('share', t('share'), () => shareDialog(this.app), { class: 'ghost hide-small', cmd: 'project.save_shared' }),
      iconBtn('settings', 'Paramètres', () => settingsDialog(this.app), { class: 'ghost hide-small', cmd: 'app.set_theme_accent' }),
      iconBtn('help', 'Aide (F1)', () => helpDialog(this.app), { class: 'ghost hide-small', cmd: 'app.help' }),
      h('span', { class: 'spacer' }), this.saveChip, this.mcpChip,
      iconBtn('sliders', 'Inspecteur', () => this.togglePanel('right'), { class: 'ghost', cmd: 'app.toggle_panel' }),
      exportBtn);
    const updHist = () => { this.undoBtn.disabled = !this.bus.history.undoStack.length; this.redoBtn.disabled = !this.bus.history.redoStack.length; };
    bus.on('change', updHist);
    bus.on('command', updHist);
    updHist();
  }

  markDirty() { this.saveChip.className = 'chip hide-small warn'; this.saveChip.lastChild.textContent = 'Modifié'; }
  markSaved() { this.saveChip.className = 'chip hide-small on'; this.saveChip.lastChild.textContent = `Enregistré ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`; }

  buildTransport(el) {
    const bus = this.bus;
    const play = iconBtn('play', `${t('play')} (Espace)`, () => bus.run('playback.toggle'), { class: 'play', cmd: 'playback.toggle' });
    const tc = h('div', { id: 'timecode', role: 'timer', 'aria-live': 'off', tabindex: 0, title: 'Timecode (double-clic pour saisir)' }, '00:00:00:00');
    tc.addEventListener('dblclick', () => {
      const inp = h('input', { class: 'input mono', value: tc.textContent, style: { width: '110px' } });
      tc.replaceChildren(inp); inp.focus(); inp.select();
      inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { bus.run('playback.seek', { timecode: inp.value }); inp.blur(); } if (e.key === 'Escape') inp.blur(); });
      inp.addEventListener('blur', () => updTime());
    });
    const dur = h('span', { class: 'transport-dur hide-small' });
    const loop = iconBtn('loop', `${t('loop')} (Ctrl+L)`, () => bus.run('playback.set_loop', {}), { class: 'ghost', cmd: 'playback.set_loop' });
    const rate = h('select', { class: 'input', 'aria-label': 'Vitesse de lecture', onchange: (e) => bus.run('playback.set_rate', { rate: +e.target.value }), dataset: { cmd: 'playback.set_rate' } }, ...[0.25, 0.5, 1, 1.5, 2].map((r) => h('option', { value: r, selected: r === 1 }, `${r}×`)));
    const split = iconBtn('scissors', 'Couper (S)', () => bus.run('clip.split', {}), { class: 'ghost', cmd: 'clip.split' });
    const marker = iconBtn('marker', 'Marqueur (M)', () => bus.run('marker.add', {}), { class: 'ghost', cmd: 'marker.add' });
    const kf = iconBtn('diamond', 'Keyframe de position (Alt+K)', () => this.app.runAction({ id: 'keyframe', command: 'keyframe.add' }), { class: 'ghost', cmd: 'keyframe.add' });
    const cache = iconBtn('refresh', 'Pré-calculer la zone de travail (barre verte)', () => bus.run('render.precache', {}), { class: 'ghost hide-small', cmd: 'render.precache' });
    el.append(
      iconBtn('start', 'Début (Origine)', () => bus.run('playback.seek', { to: 'start' }), { class: 'ghost', cmd: 'playback.seek' }),
      iconBtn('back', 'Reculer (J)', () => bus.run('playback.shuttle', { direction: 'back' }), { class: 'ghost', cmd: 'playback.shuttle' }),
      iconBtn('prevf', 'Image précédente (←)', () => bus.run('playback.seek', { deltaFrames: -1 }), { class: 'ghost', cmd: 'playback.seek' }),
      play,
      iconBtn('nextf', 'Image suivante (→)', () => bus.run('playback.seek', { deltaFrames: 1 }), { class: 'ghost', cmd: 'playback.seek' }),
      iconBtn('fwd', 'Avancer (L)', () => bus.run('playback.shuttle', { direction: 'forward' }), { class: 'ghost', cmd: 'playback.shuttle' }),
      iconBtn('end', 'Fin (Fin)', () => bus.run('playback.seek', { to: 'end' }), { class: 'ghost', cmd: 'playback.seek' }),
      tc, dur, loop, rate, h('span', { class: 'spacer' }), split, marker, kf, cache,
      iconBtn('panelB', 'Replier la timeline (Ctrl+3)', () => this.togglePanel('timeline'), { class: 'ghost hide-small', cmd: 'app.toggle_panel' }));
    const updTime = () => {
      const s = bus.app.get(), p = bus.project.get();
      if (!tc.querySelector('input')) tc.textContent = formatTimecode(s.time, p.meta.fps);
      dur.textContent = `/ ${formatTimecode(p.meta.duration, p.meta.fps)}`;
      play.innerHTML = icon(s.playing ? 'pause' : 'play');
      play.classList.toggle('active', s.playing);
      play.setAttribute('aria-label', s.playing ? t('pause') : t('play'));
      loop.setAttribute('aria-pressed', String(s.loop));
      if (document.activeElement !== rate) rate.value = String(Math.abs(s.rate) || 1);
    };
    bus.app.subscribe(updTime);
    bus.project.subscribe(updTime);
    updTime();
  }

  // séparateurs redimensionnables (disposition mémorisée)
  bindSplitters() {
    const root = this.root;
    const saved = JSON.parse(localStorage.getItem('motion-layout') || '{}');
    for (const [k, v] of Object.entries(saved)) root.style.setProperty(k, v);
    const save = () => { const out = {}; for (const k of ['--left-w', '--right-w', '--timeline-h', '--heads-w']) { const v = root.style.getPropertyValue(k); if (v) out[k] = v; } try { localStorage.setItem('motion-layout', JSON.stringify(out)); } catch { /* */ } };
    const bind = (el, onMove) => el.addEventListener('pointerdown', (e) => {
      el.classList.add('dragging');
      const mv = (ev) => onMove(ev);
      const up = () => { el.classList.remove('dragging'); window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); save(); window.dispatchEvent(new Event('resize')); };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    });
    bind(document.getElementById('split-left'), (e) => root.style.setProperty('--left-w', `${Math.max(200, Math.min(600, e.clientX))}px`));
    bind(document.getElementById('split-right'), (e) => root.style.setProperty('--right-w', `${Math.max(240, Math.min(700, innerWidth - e.clientX))}px`));
    bind(document.getElementById('hsplit'), (e) => root.style.setProperty('--timeline-h', `${Math.max(120, Math.min(innerHeight - 260, innerHeight - e.clientY - 40))}px`));
    const collapsed = JSON.parse(localStorage.getItem('motion-collapsed') || '[]');
    for (const c of collapsed) root.classList.add(c);
  }

  togglePanel(which) {
    const mobile = innerWidth < 1100;
    const cls = mobile && which !== 'timeline' ? `show-${which}` : `${which}-collapsed`;
    this.root.classList.toggle(cls);
    if (!mobile) try { localStorage.setItem('motion-collapsed', JSON.stringify(['left-collapsed', 'right-collapsed', 'timeline-collapsed'].filter((c) => this.root.classList.contains(c)))); } catch { /* */ }
    setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
  }

  async fullscreen(on) {
    const want = on ?? !this.root.classList.contains('viewport-only');
    this.root.classList.toggle('viewport-only', want);
    try { if (want && !document.fullscreenElement) await document.documentElement.requestFullscreen?.(); else if (!want && document.fullscreenElement) await document.exitFullscreen(); } catch { /* le mode "viewport seul" reste actif */ }
    setTimeout(() => window.dispatchEvent(new Event('resize')), 60);
  }

  openPanel(p) {
    const app = this.app;
    const right = { inspector: 'inspector', controls: 'controls', history: 'history', mcp: 'mcp', console: 'console', scopes: 'scopes' };
    const left = { library: 'elements', assets: 'media', projects: 'projects', templates: 'templates' };
    if (right[p]) { this.root.classList.remove('right-collapsed'); if (innerWidth < 1100) this.root.classList.add('show-right'); app.right.show(right[p]); return; }
    if (left[p]) { this.root.classList.remove('left-collapsed'); if (innerWidth < 1100) this.root.classList.add('show-left'); app.library.show(left[p]); return; }
    const map = { export: () => exportDialog(app), palette: () => openPalette(app), shortcuts: () => shortcutsDialog(app), help: () => helpDialog(app), settings: () => settingsDialog(app), share: () => shareDialog(app), parity: () => window.open('/parity.html', '_blank'), shader: () => { const id = app.bus.app.get().selection[0]; if (id) shaderEditor(app, id); } };
    map[p]?.();
  }

  showExportProgress() { exportProgress(this.app); }
  newProjectDialog() { newProjectDialog(this.app); }
  shaderEditor(clipId, effectId) { shaderEditor(this.app, clipId, effectId); }
  bezierEditor(clipId, path, i) { bezierEditor(this.app, clipId, path, i); }
  lintDialog() { lintDialog(this.app); }
  scriptDialog() { scriptDialog(this.app); }
  flagConsole() { const tab = this.app.right.tabsEl.querySelector('[data-tab="console"]'); tab?.classList.add('err'); setTimeout(() => tab?.classList.remove('err'), 3000); }
  recording(seconds, stop) { this.app.toast(`Enregistrement micro en cours (max ${seconds}s)… cliquez pour arrêter.`, 'warn', seconds * 1000); document.addEventListener('click', stop, { once: true, capture: true }); }

  clipMenu(x, y, id) {
    const bus = this.bus;
    const c = bus.project.get().clips.find((cl) => cl.id === id);
    if (!c) return;
    const sel = bus.app.get().selection;
    const ids = sel.includes(id) ? sel : [id];
    contextMenu(x, y, [
      { header: `${c.name} (${c.kind})` },
      { label: 'Couper à la tête de lecture', icon: 'scissors', kbd: 'S', cmd: 'clip.split', action: () => bus.run('clip.split', { ids }) },
      { label: 'Dupliquer', icon: 'dup', kbd: 'Ctrl+D', cmd: 'clip.duplicate', action: () => bus.run('clip.duplicate', { ids }) },
      { label: 'Copier', icon: 'copy', kbd: 'Ctrl+C', cmd: 'clip.copy', action: () => bus.run('clip.copy', { ids }) },
      { label: 'Coller à la tête de lecture', icon: 'paste', kbd: 'Ctrl+V', cmd: 'clip.paste', action: () => bus.run('clip.paste', {}) },
      { label: 'Couper (presse-papiers)', icon: 'scissors', kbd: 'Ctrl+X', cmd: 'clip.cut', action: () => bus.run('clip.cut', { ids }) },
      '-',
      { label: 'Entrée : fondu', icon: 'anim', cmd: 'animation.apply_preset', action: () => bus.run('animation.apply_preset', { clipIds: ids, preset: 'fadeIn' }) },
      { label: 'Sortie : fondu', icon: 'anim', cmd: 'animation.apply_preset', action: () => bus.run('animation.apply_preset', { clipIds: ids, preset: 'fadeOut' }) },
      { label: 'Autres animations…', icon: 'anim', cmd: 'animation.apply_preset', action: () => contextMenu(x + 30, y, ANIMATION_PRESETS.slice(0, 40).map((p) => ({ label: `${p.name}`, action: () => bus.run('animation.apply_preset', { clipIds: ids, preset: p.id }) }))) },
      { label: 'Transition d\'entrée…', icon: 'transition', cmd: 'transition.add', action: () => contextMenu(x + 30, y, TRANSITIONS.slice(0, 40).map((tr) => ({ label: tr.name, action: () => bus.run('transition.add', { clipId: id, type: tr.id, edge: 'in' }) }))) },
      { label: 'Transition de sortie…', icon: 'transition', cmd: 'transition.add', action: () => contextMenu(x + 30, y, TRANSITIONS.slice(0, 40).map((tr) => ({ label: tr.name, action: () => bus.run('transition.add', { clipId: id, type: tr.id, edge: 'out' }) }))) },
      { label: 'Mode de fusion…', icon: 'layers', cmd: 'clip.set_blend_mode', action: () => contextMenu(x + 30, y, BLEND_MODES.map((m) => ({ label: m.name, action: () => bus.run('clip.set_blend_mode', { ids, mode: m.id }) }))) },
      { label: 'Vitesse…', icon: 'fwd', cmd: 'clip.set_speed', action: () => contextMenu(x + 30, y, [0.25, 0.5, 0.75, 1, 1.5, 2, 4].map((s) => ({ label: `${s}×`, action: () => bus.run('clip.set_speed', { id, speed: s }) }))) },
      { label: c.reverse ? 'Lecture normale' : 'Lecture inversée', icon: 'back', cmd: 'clip.reverse', action: () => bus.run('clip.reverse', { id }) },
      { label: 'Figer l\'image (freeze)', icon: 'pause', cmd: 'clip.time_remap', action: () => bus.run('clip.time_remap', { id, preset: 'freeze-end' }) },
      '-',
      ids.length > 1 ? { label: 'Précomposer', icon: 'layers', kbd: 'Ctrl+Shift+C', cmd: 'clip.precompose', action: () => bus.run('clip.precompose', { ids }) } : null,
      c.kind === 'group' ? { label: 'Dégrouper', icon: 'layers', cmd: 'clip.ungroup', action: () => bus.run('clip.ungroup', { id }) } : null,
      { label: c.locked ? 'Déverrouiller' : 'Verrouiller', icon: 'lock', cmd: 'clip.lock', action: () => bus.run('clip.lock', { ids }) },
      { label: 'Couleur d\'étiquette…', icon: 'sparkles', cmd: 'clip.set_color', action: () => contextMenu(x + 30, y, ['#24D26D', '#3D8BFF', '#E0A526', '#B05CFF', '#FF3D8B', '#3DD6D0', '#FF7A45'].map((col) => ({ label: col, action: () => bus.run('clip.set_color', { ids, color: col }) }))) },
      { label: 'Isoler dans le viewport', icon: 'isolate', cmd: 'view.set', action: () => bus.run('view.set', { isolate: id }) },
      c.kind === 'shader' ? { label: 'Éditer le shader…', icon: 'shader', cmd: 'shader.set_code', action: () => this.shaderEditor(id) } : null,
      '-',
      { label: 'Supprimer', icon: 'trash', kbd: 'Suppr', cmd: 'clip.remove', action: () => bus.run('clip.remove', { ids }) },
      { label: 'Supprimer avec propagation', icon: 'trash', kbd: 'Maj+Suppr', cmd: 'clip.ripple_delete', action: () => bus.run('clip.ripple_delete', { ids }) },
    ]);
  }
}

export { btn };
