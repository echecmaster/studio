// Manifeste des actions de l'interface : chaque action déclenche une commande du registre (parité UI ⇄ MCP).
// Utilisé par les raccourcis clavier, la palette de commandes et le test de parité (tests/parity.test.mjs).
export const UI_ACTIONS = [
  { id: 'play-toggle', label: 'Lecture / pause', keys: 'Space', command: 'playback.toggle' },
  { id: 'shuttle-back', label: 'Reculer (J)', keys: 'J', command: 'playback.shuttle', args: { direction: 'back' } },
  { id: 'shuttle-stop', label: 'Pause / keyframe (K)', keys: 'K', command: 'playback.shuttle', args: { direction: 'stop' } },
  { id: 'shuttle-fwd', label: 'Avancer (L)', keys: 'L', command: 'playback.shuttle', args: { direction: 'forward' } },
  { id: 'frame-prev', label: 'Image précédente', keys: 'ArrowLeft', command: 'playback.seek', args: { deltaFrames: -1 } },
  { id: 'frame-next', label: 'Image suivante', keys: 'ArrowRight', command: 'playback.seek', args: { deltaFrames: 1 } },
  { id: 'frame-prev10', label: '−10 images', keys: 'Shift+ArrowLeft', command: 'playback.seek', args: { deltaFrames: -10 } },
  { id: 'frame-next10', label: '+10 images', keys: 'Shift+ArrowRight', command: 'playback.seek', args: { deltaFrames: 10 } },
  { id: 'go-start', label: 'Aller au début', keys: 'Home', command: 'playback.seek', args: { to: 'start' } },
  { id: 'go-end', label: 'Aller à la fin', keys: 'End', command: 'playback.seek', args: { to: 'end' } },
  { id: 'split', label: 'Couper à la tête de lecture', keys: 'S', command: 'clip.split' },
  { id: 'delete', label: 'Supprimer', keys: 'Delete', command: 'clip.remove', alt: 'Backspace' },
  { id: 'ripple-delete', label: 'Supprimer avec propagation', keys: 'Shift+Delete', command: 'clip.ripple_delete' },
  { id: 'duplicate', label: 'Dupliquer', keys: 'Ctrl+D', command: 'clip.duplicate' },
  { id: 'copy', label: 'Copier', keys: 'Ctrl+C', command: 'clip.copy' },
  { id: 'paste', label: 'Coller', keys: 'Ctrl+V', command: 'clip.paste' },
  { id: 'cut', label: 'Couper (presse-papiers)', keys: 'Ctrl+X', command: 'clip.cut' },
  { id: 'undo', label: 'Annuler', keys: 'Ctrl+Z', command: 'history.undo' },
  { id: 'redo', label: 'Rétablir', keys: 'Ctrl+Shift+Z', command: 'history.redo', alt: 'Ctrl+Y' },
  { id: 'palette', label: 'Palette de commandes', keys: 'Ctrl+K', command: 'app.open_panel', args: { panel: 'palette' } },
  { id: 'save', label: 'Enregistrer', keys: 'Ctrl+S', command: 'project.save' },
  { id: 'export', label: 'Exporter', keys: 'Ctrl+E', command: 'app.open_panel', args: { panel: 'export' } },
  { id: 'marker', label: 'Ajouter un marqueur', keys: 'M', command: 'marker.add' },
  { id: 'marker-next', label: 'Marqueur suivant', keys: 'Shift+M', command: 'marker.goto', args: { direction: 'next' } },
  { id: 'wa-in', label: 'Début de zone de travail', keys: 'I', command: 'timeline.set_work_area', argsFn: (app) => ({ in: app.bus.app.get().time }) },
  { id: 'wa-out', label: 'Fin de zone de travail', keys: 'O', command: 'timeline.set_work_area', argsFn: (app) => ({ out: app.bus.app.get().time }) },
  { id: 'zoom-in', label: 'Zoom timeline +', keys: '+', command: 'timeline.set_zoom', args: { factor: 1.25 }, alt: '=' },
  { id: 'zoom-out', label: 'Zoom timeline −', keys: '-', command: 'timeline.set_zoom', args: { factor: 0.8 } },
  { id: 'fit', label: 'Ajuster la timeline', keys: '\\', command: 'timeline.fit' },
  { id: 'tool-select', label: 'Outil sélection', keys: 'V', command: 'tool.set', args: { tool: 'select' } },
  { id: 'tool-text', label: 'Outil texte', keys: 'T', command: 'tool.set', args: { tool: 'text' } },
  { id: 'tool-rect', label: 'Outil rectangle', keys: 'R', command: 'tool.set', args: { tool: 'rect' } },
  { id: 'tool-ellipse', label: 'Outil ellipse', keys: 'E', command: 'tool.set', args: { tool: 'ellipse' } },
  { id: 'tool-pen', label: 'Outil plume', keys: 'P', command: 'tool.set', args: { tool: 'pen' } },
  { id: 'tool-hand', label: 'Outil main', keys: 'H', command: 'tool.set', args: { tool: 'hand' } },
  { id: 'keyframe', label: 'Ajouter une keyframe (position)', keys: 'Alt+K', command: 'keyframe.add' },
  { id: 'easy-ease', label: 'Easing doux sur les keyframes', keys: 'F9', command: 'keyframe.set_easing' },
  { id: 'group', label: 'Grouper', keys: 'Ctrl+G', command: 'clip.group' },
  { id: 'ungroup', label: 'Dégrouper', keys: 'Ctrl+Shift+G', command: 'clip.ungroup' },
  { id: 'precompose', label: 'Précomposer', keys: 'Ctrl+Shift+C', command: 'clip.precompose' },
  { id: 'select-all', label: 'Tout sélectionner', keys: 'Ctrl+A', command: 'clip.select', args: { mode: 'all' } },
  { id: 'deselect', label: 'Désélectionner', keys: 'Escape', command: 'clip.select', args: { mode: 'clear' } },
  { id: 'view-fit', label: 'Ajuster le viewport', keys: 'F', command: 'view.fit' },
  { id: 'loop', label: 'Boucle de lecture', keys: 'Ctrl+L', command: 'playback.set_loop' },
  { id: 'nudge-left', label: 'Décaler à gauche', keys: 'Alt+ArrowLeft', command: 'clip.nudge', args: { dx: -1 } },
  { id: 'nudge-right', label: 'Décaler à droite', keys: 'Alt+ArrowRight', command: 'clip.nudge', args: { dx: 1 } },
  { id: 'nudge-up', label: 'Décaler vers le haut', keys: 'Alt+ArrowUp', command: 'clip.nudge', args: { dy: -1 } },
  { id: 'nudge-down', label: 'Décaler vers le bas', keys: 'Alt+ArrowDown', command: 'clip.nudge', args: { dy: 1 } },
  { id: 'fullscreen', label: 'Plein écran du viewport', keys: 'Ctrl+Shift+F', command: 'view.fullscreen' },
  { id: 'toggle-left', label: 'Replier la bibliothèque', keys: 'Ctrl+1', command: 'app.toggle_panel', args: { panel: 'left' } },
  { id: 'toggle-right', label: 'Replier l\'inspecteur', keys: 'Ctrl+2', command: 'app.toggle_panel', args: { panel: 'right' } },
  { id: 'toggle-timeline', label: 'Replier la timeline', keys: 'Ctrl+3', command: 'app.toggle_panel', args: { panel: 'timeline' } },
  { id: 'shortcuts', label: 'Raccourcis clavier', keys: 'Ctrl+/', command: 'app.open_panel', args: { panel: 'shortcuts' } },
  { id: 'help', label: 'Aide', keys: 'F1', command: 'app.open_panel', args: { panel: 'help' } },
];

export function normalizeCombo(e) {
  const parts = [];
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey && !(e.key.length === 1 && !/[a-z0-9]/i.test(e.key) && e.key !== ' ')) parts.push('Shift');
  let k = e.key === ' ' ? 'Space' : e.key;
  if (k.length === 1) k = k.toUpperCase();
  if (k === 'Del') k = 'Delete';
  parts.push(k);
  return parts.join('+');
}

export function keysFor(action, overrides) { return overrides[action.id] || action.keys; }

export function installShortcuts(app) {
  window.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) {
      if (!(e.ctrlKey || e.metaKey) || !['s', 'k', 'e'].includes(e.key.toLowerCase())) return;
    }
    if (app.ui.modalOpen() && e.key !== 'Escape') return;
    const combo = normalizeCombo(e);
    const overrides = app.bus.app.get().shortcuts || {};
    const action = UI_ACTIONS.find((a) => keysFor(a, overrides) === combo || (!overrides[a.id] && a.alt === combo));
    if (!action) return;
    e.preventDefault();
    app.runAction(action);
  });
}
