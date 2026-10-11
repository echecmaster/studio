// Bibliothèque d'éléments : valeurs par défaut de chaque "kind" de clip + schémas de propriétés pour l'inspecteur.
import { defaultGeneratorParams, GENERATORS } from './generators.js';
import { SHADER_PRESETS, parseShaderParams } from './shaders.js';

export const FONTS = ['Inter', 'JetBrains Mono', 'Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana', 'Trebuchet MS', 'Impact', 'system-ui', 'serif', 'sans-serif', 'monospace', 'cursive'];
export const TEXT_ANIMATORS = ['none', 'typewriter', 'fade', 'slide', 'bounce', 'wave', 'scramble', 'split', 'glitch', 'blurIn', 'maskReveal', 'rotate3d', 'random', 'pop'];
export const PARTICLE_PRESETS = ['custom', 'confetti', 'sparks', 'fire', 'smoke', 'snow', 'rain', 'bubbles', 'dust', 'explosion', 'trails', 'fireworks'];
export const UI_TEMPLATES = ['lowerThird', 'title', 'banner', 'subtitle', 'chatBubble', 'notification', 'button', 'badge', 'sticker', 'socialHandle', 'callout', 'quote'];
export const SHAPES = ['rect', 'ellipse', 'circle', 'triangle', 'polygon', 'star', 'line', 'arrow', 'path', 'freehand', 'heart', 'compound'];
export const CHART_TYPES = ['bar', 'line', 'pie', 'donut', 'radar', 'area', 'hbar'];
export const AUDIOVIZ_STYLES = ['bars', 'circle', 'line', 'particles', 'spectrum', 'waveform'];
export const MOCKUP_DEVICES = ['phone', 'laptop', 'browser', 'tablet'];
export const PRIMITIVES_3D = ['cube', 'sphere', 'torus', 'pyramid', 'cylinder', 'icosahedron'];

const ACCENT = '#24D26D';
const defaultData = [{ label: 'Jan', value: 32 }, { label: 'Fév', value: 48 }, { label: 'Mar', value: 41 }, { label: 'Avr', value: 67 }, { label: 'Mai', value: 85 }];

export function defaultProps(kind, opts = {}, comp = { width: 1920, height: 1080 }) {
  switch (kind) {
    case 'shape': return {
      shape: 'rect', width: 400, height: 250, radius: [16, 16, 16, 16], sides: 6, points: 5, innerRadius: 0.45,
      path: [], closed: true,
      fill: { type: 'solid', color: ACCENT, stops: [{ o: 0, c: ACCENT }, { o: 1, c: '#0B3DFF' }], angle: 90, enabled: true },
      stroke: { enabled: false, color: '#FFFFFF', width: 4, dash: [], cap: 'round', join: 'round', align: 'center' },
      trimStart: 0, trimEnd: 1, trimOffset: 0, compound: null, morphTo: null, morph: 0,
    };
    case 'text': return {
      text: 'Votre titre', fontFamily: 'Inter', fontSize: 120, fontWeight: 800, italic: false, lineHeight: 1.15, letterSpacing: 0, kerning: true,
      align: 'center', color: '#EDEDED', textTransform: 'none',
      fill: { type: 'solid', stops: [{ o: 0, c: ACCENT }, { o: 1, c: '#0B3DFF' }], angle: 90 },
      stroke: { enabled: false, color: '#050505', width: 6 },
      shadow: { enabled: false, color: '#000000AA', blur: 20, x: 0, y: 8 },
      extrude: { enabled: false, depth: 14, color: '#0F3D22', angle: 135 },
      maxWidth: 0, onPath: null, animator: null, background: { enabled: false, color: '#050505CC', padding: 24, radius: 12 },
    };
    case 'image': case 'svg': return { assetId: opts.assetId || '', fit: 'contain', width: 0, height: 0 };
    case 'video': return { assetId: opts.assetId || '', fit: 'contain', width: 0, height: 0, volume: 1, muted: false, fadeIn: 0, fadeOut: 0, loop: false };
    case 'audio': return { assetId: opts.assetId || '', volume: 1, muted: false, fadeIn: 0, fadeOut: 0, loop: false, pan: 0 };
    case 'lottie': return { assetId: opts.assetId || '', speed: 1, loop: true, width: 0, height: 0 };
    case 'particles': return particlePreset(opts.preset || 'confetti', comp);
    case 'generator': {
      const type = opts.type || 'gradient';
      return { type, params: defaultGeneratorParams(type), width: comp.width, height: comp.height };
    }
    case 'shader': {
      const preset = SHADER_PRESETS.find((s) => s.id === (opts.preset || 'tunnel')) || SHADER_PRESETS[0];
      return { code: preset.code, preset: preset.id, params: Object.fromEntries(parseShaderParams(preset.code).map((p) => [p.name, p.default])), width: comp.width, height: comp.height, channels: ['', '', '', ''], mouse: [0.5, 0.5] };
    }
    case 'group': return { tracks: [], clips: [], width: comp.width, height: comp.height, collapse: false };
    case 'adjustment': return {};
    case 'null': return { controls: [] };
    case 'camera': return { zoom: 1, focal: 1500, dof: { enabled: false, focus: 0, aperture: 12 }, shake: { preset: 'none', amplitude: 12, frequency: 2, rotation: 1 }, orbit: { enabled: false, radius: 200, speed: 20 } };
    case 'light': return { color: '#FFF2D0', intensity: 1, radius: 700, type: 'point', falloff: 1.5, mode: 'add' };
    case '3d': return { primitive: 'cube', size: 300, color: ACCENT, rotX: 20, rotY: 30, rotZ: 0, spinX: 10, spinY: 40, spinZ: 0, wireframe: false, shading: true, edgeColor: '#050505', fov: 60 };
    case 'chart': return { chartType: 'bar', data: defaultData, colors: [ACCENT, '#1FB35C', '#0B3DFF', '#FF3D8B', '#E0A526', '#8A8A8A'], progress: 1, autoAnimate: true, animDuration: 1.2, width: 1000, height: 560, showLabels: true, showValues: true, valuePrefix: '', valueSuffix: '', fontSize: 28, textColor: '#EDEDED', gridColor: '#1F1F1F', stagger: 0.08 };
    case 'counter': return { from: 0, to: 1000, decimals: 0, prefix: '', suffix: '', format: 'number', currency: 'EUR', separator: true, startAt: 0, duration: 2, easing: 'easeOutCubic', fontFamily: 'Inter', fontSize: 160, fontWeight: 800, color: '#EDEDED' };
    case 'progress': return { style: 'bar', value: 1, auto: true, duration: 2, easing: 'easeInOutCubic', width: 800, height: 24, thickness: 18, color: ACCENT, trackColor: '#1F1F1F', radius: 12, showLabel: true, labelColor: '#EDEDED', fontSize: 36 };
    case 'clock': return { mode: 'clock', style: 'analog', startSeconds: 10 * 3600 + 10 * 60, timerFrom: 60, size: 400, color: '#EDEDED', accent: ACCENT, fontFamily: 'JetBrains Mono', speed: 1 };
    case 'ui': return uiPreset(opts.template || 'lowerThird');
    case 'audioviz': return { style: 'bars', assetId: opts.assetId || '', bands: 48, color: ACCENT, color2: '#0B3DFF', width: 1200, height: 360, smoothing: 0.6, gain: 1.4, mirror: false, thickness: 6 };
    case 'mockup': return { device: opts.device || 'phone', assetId: opts.assetId || '', frameColor: '#141414', url: 'motion.studio', width: opts.device === 'laptop' || opts.device === 'browser' ? 1200 : 420, screenColor: '#0D0D0D', title: 'Motion Studio' };
    case 'code': return { code: "const motion = await motionAPI.run('clip.add', {\n  kind: 'text',\n  props: { text: 'Bonjour' }\n});\nconsole.log(motion.ok); // true", language: 'js', theme: 'dark', fontSize: 30, typing: true, speed: 35, startAt: 0, width: 1100, lineNumbers: true, title: 'script.js', cursor: true };
    default: return {};
  }
}

export function defaultDuration(kind) {
  return { audio: 10, video: 5, camera: 10, adjustment: 5, null: 10 }[kind] || 4;
}

export function particlePreset(preset, comp = { width: 1920, height: 1080 }) {
  const base = {
    preset, rate: 60, life: 2.5, lifeVar: 0.3, speed: 300, speedVar: 0.4, direction: -90, spread: 40, gravity: 400, drag: 0.2,
    turbulence: 0, turbulenceScale: 0.004, attractors: [], collideFloor: false, floorY: comp.height / 2, bounce: 0.5,
    sizeStart: 14, sizeEnd: 4, sizeVar: 0.4, colorStart: ACCENT, colorEnd: '#0B3DFF', colors: [], opacityStart: 1, opacityEnd: 0,
    sprite: 'circle', spriteAssetId: '', additive: false, spin: 0, emitterShape: 'point', emitterWidth: 0, emitterHeight: 0, seed: 7, burst: 0, maxParticles: 2000,
    width: comp.width, height: comp.height,
  };
  const P = {
    custom: {},
    confetti: { rate: 80, speed: 700, direction: -90, spread: 70, gravity: 900, drag: 0.6, sprite: 'confetti', sizeStart: 16, sizeEnd: 16, colors: [ACCENT, '#FF3D8B', '#3D8BFF', '#FFD23D', '#FFFFFF'], spin: 720, opacityEnd: 1, life: 3, emitterShape: 'line', emitterWidth: 600 },
    sparks: { rate: 160, speed: 600, spread: 180, gravity: 600, life: 1.2, sizeStart: 5, sizeEnd: 1, colorStart: '#FFE08A', colorEnd: '#FF4D00', additive: true, sprite: 'spark' },
    fire: { rate: 220, speed: 160, spread: 25, gravity: -250, life: 1.3, sizeStart: 60, sizeEnd: 8, colorStart: '#FFC93D', colorEnd: '#FF2A00', additive: true, turbulence: 60, emitterShape: 'line', emitterWidth: 180 },
    smoke: { rate: 40, speed: 80, spread: 30, gravity: -60, life: 4, sizeStart: 80, sizeEnd: 260, colorStart: '#9A9A9A', colorEnd: '#3A3A3A', opacityStart: 0.35, opacityEnd: 0, turbulence: 40 },
    snow: { rate: 70, speed: 60, direction: 90, spread: 30, gravity: 40, life: 8, sizeStart: 6, sizeEnd: 6, colorStart: '#FFFFFF', colorEnd: '#DDEEFF', opacityEnd: 0.8, turbulence: 30, emitterShape: 'line', emitterWidth: comp.width * 1.2 },
    rain: { rate: 400, speed: 1400, direction: 100, spread: 2, gravity: 400, life: 1.2, sizeStart: 3, sizeEnd: 3, colorStart: '#9EC9FF', colorEnd: '#9EC9FF', opacityStart: 0.6, opacityEnd: 0.6, sprite: 'line', emitterShape: 'line', emitterWidth: comp.width * 1.3 },
    bubbles: { rate: 18, speed: 120, direction: -90, spread: 20, gravity: -40, life: 6, sizeStart: 20, sizeEnd: 40, colorStart: '#9FE8FF', colorEnd: '#FFFFFF', opacityStart: 0.7, opacityEnd: 0.1, sprite: 'ring', turbulence: 50, emitterShape: 'line', emitterWidth: 800 },
    dust: { rate: 30, speed: 15, spread: 180, gravity: 0, life: 7, sizeStart: 3, sizeEnd: 3, colorStart: '#FFF4D6', colorEnd: '#FFF4D6', opacityStart: 0.5, opacityEnd: 0, turbulence: 20, emitterShape: 'rect', emitterWidth: comp.width, emitterHeight: comp.height, additive: true },
    explosion: { rate: 0, burst: 400, speed: 900, speedVar: 0.8, spread: 180, gravity: 300, drag: 1.2, life: 1.8, sizeStart: 10, sizeEnd: 0, colorStart: '#FFF2A8', colorEnd: '#FF3D00', additive: true },
    trails: { rate: 120, speed: 40, spread: 180, gravity: 0, life: 1, sizeStart: 18, sizeEnd: 0, colorStart: ACCENT, colorEnd: '#0B3DFF', additive: true, emitterShape: 'orbit', emitterWidth: 300 },
    fireworks: { rate: 0, burst: 250, speed: 520, speedVar: 0.15, spread: 180, gravity: 220, drag: 0.6, life: 2.2, sizeStart: 6, sizeEnd: 1, colorStart: '#FFFFFF', colors: ['#FF3D8B', ACCENT, '#3D8BFF', '#FFD23D'], additive: true, sprite: 'spark', repeat: 1.2 },
  };
  return { ...base, ...(P[preset] || {}) };
}

export function uiPreset(template) {
  const base = { template, title: 'Jeanne Dupont', subtitle: 'Directrice artistique', accent: ACCENT, textColor: '#EDEDED', background: '#0D0D0DE6', width: 760, fontFamily: 'Inter', icon: '★', animate: true, animDuration: 0.6 };
  const P = {
    lowerThird: {},
    title: { title: 'GRAND TITRE', subtitle: 'Sous-titre élégant', width: 1400, background: '#00000000' },
    banner: { title: 'NOUVEAU', subtitle: 'Offre limitée — jusqu\'à -50 %', width: 1920, background: ACCENT, textColor: '#050505' },
    subtitle: { title: 'Ceci est un sous-titre lisible sur deux lignes maximum.', subtitle: '', width: 1400, background: '#000000B3' },
    chatBubble: { title: 'Salut ! Tu as vu la nouvelle vidéo ? 🔥', subtitle: 'Alex · 12:04', width: 640, background: '#141414' },
    notification: { title: 'Motion Studio', subtitle: 'Votre export MP4 est prêt ✅', width: 680, background: '#141414F2' },
    button: { title: 'S\'abonner', subtitle: '', width: 360, background: ACCENT, textColor: '#050505' },
    badge: { title: 'PRO', subtitle: '', width: 180, background: ACCENT, textColor: '#050505' },
    sticker: { title: 'WOW!', subtitle: '', width: 320, background: '#FFD23D', textColor: '#050505' },
    socialHandle: { title: '@motionstudio', subtitle: 'youtube · instagram · tiktok', width: 760 },
    callout: { title: 'Point clé', subtitle: 'Une info importante à retenir', width: 560 },
    quote: { title: '« La simplicité est la sophistication suprême. »', subtitle: '— Léonard de Vinci', width: 1300, background: '#00000000' },
  };
  return { ...base, ...(P[template] || {}) };
}

// ---------- Entrées de la bibliothèque ----------
export const LIBRARY = [];
const L = (category, id, name, kind, opts = {}, extra = {}) => LIBRARY.push({ category, id, name, kind, opts, ...extra });
// formes
for (const [s, n] of [['rect', 'Rectangle'], ['ellipse', 'Ellipse'], ['circle', 'Cercle'], ['triangle', 'Triangle'], ['polygon', 'Polygone'], ['star', 'Étoile'], ['line', 'Ligne'], ['arrow', 'Flèche'], ['heart', 'Cœur'], ['path', 'Courbe de Bézier']]) L('formes', `shape-${s}`, n, 'shape', { shape: s });
L('formes', 'shape-compound', 'Forme composée', 'shape', { shape: 'compound' });
L('formes', 'shape-gradient', 'Rectangle dégradé', 'shape', { shape: 'rect', gradient: true });
// texte
L('texte', 'text-title', 'Titre', 'text', {});
L('texte', 'text-subtitle', 'Sous-titre', 'text', { fontSize: 56, fontWeight: 500, text: 'Sous-titre' });
L('texte', 'text-paragraph', 'Paragraphe', 'text', { fontSize: 40, fontWeight: 400, text: 'Un paragraphe de texte sur\nplusieurs lignes, aligné à gauche.', align: 'left' });
for (const a of TEXT_ANIMATORS.filter((x) => x !== 'none')) L('texte', `text-anim-${a}`, `Texte animé : ${a}`, 'text', { animator: a });
L('texte', 'text-3d', 'Texte 3D simulé', 'text', { extrude: true });
L('texte', 'text-gradient', 'Texte dégradé', 'text', { gradient: true });
L('texte', 'text-path', 'Texte sur tracé', 'text', { onPath: true });
// générateurs
for (const g of GENERATORS) L('generateurs', `gen-${g.id}`, g.name, 'generator', { type: g.id });
// shaders
for (const s of SHADER_PRESETS) L('shaders', `shader-${s.id}`, s.name, 'shader', { preset: s.id });
// particules
for (const p of PARTICLE_PRESETS.filter((x) => x !== 'custom')) L('particules', `particles-${p}`, `Particules : ${p}`, 'particles', { preset: p });
L('particules', 'particles-custom', 'Émetteur personnalisé', 'particles', { preset: 'custom' });
// data viz
for (const t of CHART_TYPES) L('dataviz', `chart-${t}`, `Graphique ${t}`, 'chart', { chartType: t });
L('dataviz', 'counter-number', 'Compteur', 'counter', {});
L('dataviz', 'counter-currency', 'Compteur devise', 'counter', { format: 'currency' });
L('dataviz', 'counter-percent', 'Compteur pourcentage', 'counter', { format: 'percent' });
L('dataviz', 'progress-bar', 'Barre de progression', 'progress', { style: 'bar' });
L('dataviz', 'progress-ring', 'Anneau de progression', 'progress', { style: 'ring' });
L('dataviz', 'clock-analog', 'Horloge', 'clock', { mode: 'clock' });
L('dataviz', 'clock-stopwatch', 'Chronomètre', 'clock', { mode: 'stopwatch', style: 'digital' });
L('dataviz', 'clock-timer', 'Minuteur', 'clock', { mode: 'timer', style: 'digital' });
// UI / social
for (const t of UI_TEMPLATES) L('ui', `ui-${t}`, `UI : ${t}`, 'ui', { template: t });
for (const d of MOCKUP_DEVICES) L('ui', `mockup-${d}`, `Mockup ${d}`, 'mockup', { device: d });
// spéciaux
L('speciaux', 'adjustment', 'Calque d\'ajustement', 'adjustment');
L('speciaux', 'null', 'Calque nul (contrôleur)', 'null');
L('speciaux', 'camera', 'Caméra 2.5D', 'camera');
L('speciaux', 'light', 'Lumière', 'light');
L('speciaux', 'group', 'Groupe / précomposition', 'group');
for (const p of PRIMITIVES_3D) L('speciaux', `3d-${p}`, `3D : ${p}`, '3d', { primitive: p });
L('speciaux', 'code', 'Bloc de code', 'code');
// audio
for (const s of AUDIOVIZ_STYLES) L('audio', `audioviz-${s}`, `Visualiseur : ${s}`, 'audioviz', { style: s });

export const LIBRARY_CATEGORIES = { formes: 'Formes', texte: 'Texte', generateurs: 'Générateurs', shaders: 'Shaders', particules: 'Particules', dataviz: 'Data viz', ui: 'UI / Social', speciaux: 'Calques spéciaux', audio: 'Audio' };

// Applique les options d'une entrée de bibliothèque aux props par défaut
export function libraryProps(entry, comp) {
  const props = defaultProps(entry.kind, entry.opts, comp);
  const o = entry.opts || {};
  if (entry.kind === 'shape') {
    props.shape = o.shape === 'compound' ? 'compound' : o.shape;
    if (o.shape === 'circle') { props.width = 280; props.height = 280; }
    if (o.shape === 'line') { props.width = 600; props.height = 0; props.stroke.enabled = true; props.stroke.width = 8; props.stroke.color = ACCENT; props.fill.enabled = false; }
    if (o.shape === 'arrow') { props.width = 500; props.height = 120; }
    if (o.shape === 'path') { props.path = [{ x: -200, y: 60, ix: 0, iy: 0, ox: 80, oy: -200 }, { x: 200, y: 60, ix: -80, iy: -200, ox: 0, oy: 0 }]; props.closed = false; props.stroke.enabled = true; props.stroke.width = 10; props.stroke.color = ACCENT; props.fill.enabled = false; }
    if (o.shape === 'compound') props.compound = { op: 'subtract', shapes: [{ shape: 'rect', width: 400, height: 400, x: 0, y: 0 }, { shape: 'ellipse', width: 220, height: 220, x: 0, y: 0 }] };
    if (o.gradient) props.fill.type = 'linear';
  }
  if (entry.kind === 'text') {
    Object.assign(props, Object.fromEntries(Object.entries(o).filter(([k]) => ['fontSize', 'fontWeight', 'text', 'align'].includes(k))));
    if (o.animator) props.animator = { type: o.animator, by: 'char', direction: 'in', start: 0, duration: 1.2, stagger: 0.04, easing: 'easeOutCubic', amount: 1, random: false };
    if (o.extrude) { props.extrude.enabled = true; props.color = ACCENT; }
    if (o.gradient) props.fill.type = 'linear';
    if (o.onPath) { props.onPath = { points: [{ x: -600, y: 100 }, { x: -300, y: -150 }, { x: 300, y: -150 }, { x: 600, y: 100 }], offset: 0 }; props.fontSize = 72; }
  }
  if (entry.kind === 'chart') props.chartType = o.chartType;
  if (entry.kind === 'counter' && o.format) { props.format = o.format; if (o.format === 'percent') { props.to = 100; props.decimals = 0; } if (o.format === 'currency') props.to = 25000; }
  if (entry.kind === 'progress') props.style = o.style;
  if (entry.kind === 'clock') { props.mode = o.mode; if (o.style) props.style = o.style; }
  if (entry.kind === '3d') props.primitive = o.primitive;
  if (entry.kind === 'audioviz') props.style = o.style;
  return props;
}

// ---------- Schémas de propriétés pour l'inspecteur (générés automatiquement en UI) ----------
const n = (path, label, min, max, step = 1) => ({ path, label, type: 'number', min, max, step });
const col = (path, label) => ({ path, label, type: 'color' });
const sel = (path, label, options) => ({ path, label, type: 'select', options });
const bool = (path, label) => ({ path, label, type: 'bool' });
const txt = (path, label, multiline = false) => ({ path, label, type: multiline ? 'textarea' : 'text' });
const asset = (path, label, assetType) => ({ path, label, type: 'asset', assetType });

export const PROP_SCHEMAS = {
  shape: [sel('props.shape', 'Forme', SHAPES), n('props.width', 'Largeur', 0, 8000), n('props.height', 'Hauteur', 0, 8000), n('props.radius.0', 'Rayon HG', 0, 2000), n('props.radius.1', 'Rayon HD', 0, 2000), n('props.radius.2', 'Rayon BD', 0, 2000), n('props.radius.3', 'Rayon BG', 0, 2000),
    n('props.sides', 'Côtés', 3, 24), n('props.points', 'Branches', 3, 24), n('props.innerRadius', 'Rayon intérieur', 0.05, 1, 0.01),
    bool('props.fill.enabled', 'Remplissage'), sel('props.fill.type', 'Type de remplissage', ['solid', 'linear', 'radial', 'conic', 'pattern']), col('props.fill.color', 'Couleur'), col('props.fill.stops.0.c', 'Dégradé : couleur 1'), col('props.fill.stops.1.c', 'Dégradé : couleur 2'), n('props.fill.angle', 'Angle du dégradé', 0, 360),
    bool('props.stroke.enabled', 'Contour'), col('props.stroke.color', 'Couleur du contour'), n('props.stroke.width', 'Épaisseur', 0, 200, 0.5), { path: 'props.stroke.dash', label: 'Tirets (ex. 20 10)', type: 'dash' }, sel('props.stroke.cap', 'Extrémités', ['butt', 'round', 'square']), sel('props.stroke.join', 'Jointures', ['miter', 'round', 'bevel']),
    n('props.trimStart', 'Trim début', 0, 1, 0.01), n('props.trimEnd', 'Trim fin', 0, 1, 0.01), n('props.trimOffset', 'Trim décalage', -1, 1, 0.01), n('props.morph', 'Morphing (0→1)', 0, 1, 0.01)],
  text: [txt('props.text', 'Texte', true), { path: 'props.fontFamily', label: 'Police', type: 'font' }, n('props.fontSize', 'Taille', 4, 1000), n('props.fontWeight', 'Graisse', 100, 900, 100), bool('props.italic', 'Italique'), n('props.lineHeight', 'Interligne', 0.5, 3, 0.01), n('props.letterSpacing', 'Tracking (px)', -50, 200, 0.5), bool('props.kerning', 'Crénage'),
    sel('props.align', 'Alignement', ['left', 'center', 'right']), sel('props.textTransform', 'Casse', ['none', 'uppercase', 'lowercase', 'capitalize']), n('props.maxWidth', 'Largeur max (0 = libre)', 0, 8000), col('props.color', 'Couleur'),
    sel('props.fill.type', 'Remplissage', ['solid', 'linear', 'radial']), col('props.fill.stops.0.c', 'Dégradé : couleur 1'), col('props.fill.stops.1.c', 'Dégradé : couleur 2'), n('props.fill.angle', 'Angle du dégradé', 0, 360),
    bool('props.stroke.enabled', 'Contour'), col('props.stroke.color', 'Couleur du contour'), n('props.stroke.width', 'Épaisseur du contour', 0, 60, 0.5),
    bool('props.shadow.enabled', 'Ombre'), col('props.shadow.color', 'Couleur de l\'ombre'), n('props.shadow.blur', 'Flou de l\'ombre', 0, 200), n('props.shadow.x', 'Ombre X', -200, 200), n('props.shadow.y', 'Ombre Y', -200, 200),
    bool('props.extrude.enabled', 'Texte 3D (extrusion)'), n('props.extrude.depth', 'Profondeur', 0, 100), col('props.extrude.color', 'Couleur des flancs'), n('props.extrude.angle', 'Angle', 0, 360),
    bool('props.background.enabled', 'Fond'), col('props.background.color', 'Couleur du fond'), n('props.background.padding', 'Marge du fond', 0, 200), n('props.background.radius', 'Arrondi du fond', 0, 200)],
  image: [asset('props.assetId', 'Média', 'image'), sel('props.fit', 'Ajustement', ['contain', 'cover', 'stretch', 'none']), n('props.width', 'Largeur (0 = auto)', 0, 8000), n('props.height', 'Hauteur (0 = auto)', 0, 8000)],
  svg: [asset('props.assetId', 'SVG', 'svg'), sel('props.fit', 'Ajustement', ['contain', 'cover', 'stretch', 'none']), n('props.width', 'Largeur (0 = auto)', 0, 8000), n('props.height', 'Hauteur (0 = auto)', 0, 8000)],
  video: [asset('props.assetId', 'Vidéo', 'video'), sel('props.fit', 'Ajustement', ['contain', 'cover', 'stretch', 'none']), n('props.width', 'Largeur (0 = auto)', 0, 8000), n('props.height', 'Hauteur (0 = auto)', 0, 8000), n('props.volume', 'Volume', 0, 2, 0.01), bool('props.muted', 'Muet'), n('props.fadeIn', 'Fondu audio entrée (s)', 0, 10, 0.05), n('props.fadeOut', 'Fondu audio sortie (s)', 0, 10, 0.05), bool('props.loop', 'Boucle')],
  audio: [asset('props.assetId', 'Audio', 'audio'), n('props.volume', 'Volume', 0, 2, 0.01), bool('props.muted', 'Muet'), n('props.pan', 'Panoramique', -1, 1, 0.01), n('props.fadeIn', 'Fondu entrée (s)', 0, 10, 0.05), n('props.fadeOut', 'Fondu sortie (s)', 0, 10, 0.05), bool('props.loop', 'Boucle')],
  lottie: [asset('props.assetId', 'Lottie JSON', 'lottie'), n('props.speed', 'Vitesse', 0.1, 5, 0.05), bool('props.loop', 'Boucle'), n('props.width', 'Largeur (0 = auto)', 0, 8000), n('props.height', 'Hauteur (0 = auto)', 0, 8000)],
  particles: [sel('props.preset', 'Preset', PARTICLE_PRESETS), n('props.rate', 'Taux (/s)', 0, 2000), n('props.burst', 'Rafale initiale', 0, 3000), n('props.life', 'Durée de vie (s)', 0.05, 20, 0.05), n('props.speed', 'Vitesse', 0, 4000), n('props.speedVar', 'Variation vitesse', 0, 1, 0.01), n('props.direction', 'Direction (°)', -360, 360), n('props.spread', 'Dispersion (°)', 0, 180),
    n('props.gravity', 'Gravité', -3000, 3000), n('props.drag', 'Frottement', 0, 5, 0.01), n('props.turbulence', 'Turbulence', 0, 500), bool('props.collideFloor', 'Collision sol'), n('props.floorY', 'Sol (Y)', -4000, 4000), n('props.bounce', 'Rebond', 0, 1, 0.01),
    n('props.sizeStart', 'Taille début', 0, 500), n('props.sizeEnd', 'Taille fin', 0, 500), col('props.colorStart', 'Couleur début'), col('props.colorEnd', 'Couleur fin'), n('props.opacityStart', 'Opacité début', 0, 1, 0.01), n('props.opacityEnd', 'Opacité fin', 0, 1, 0.01),
    sel('props.sprite', 'Sprite', ['circle', 'square', 'star', 'spark', 'confetti', 'ring', 'line', 'asset']), asset('props.spriteAssetId', 'Sprite personnalisé', 'image'), bool('props.additive', 'Fusion additive'), n('props.spin', 'Rotation (°/s)', -2000, 2000),
    sel('props.emitterShape', 'Émetteur', ['point', 'line', 'rect', 'circle', 'orbit']), n('props.emitterWidth', 'Largeur émetteur', 0, 8000), n('props.emitterHeight', 'Hauteur émetteur', 0, 8000), n('props.seed', 'Graine', 0, 9999), n('props.maxParticles', 'Particules max', 10, 10000)],
  generator: [sel('props.type', 'Générateur', GENERATORS.map((g) => g.id)), n('props.width', 'Largeur', 16, 8000), n('props.height', 'Hauteur', 16, 8000)],
  shader: [{ path: 'props.code', label: 'Code GLSL', type: 'code' }, n('props.width', 'Largeur', 16, 8000), n('props.height', 'Hauteur', 16, 8000), asset('props.channels.0', 'iChannel0', 'image'), asset('props.channels.1', 'iChannel1', 'image'), n('props.mouse.0', 'iMouse X', 0, 1, 0.01), n('props.mouse.1', 'iMouse Y', 0, 1, 0.01)],
  group: [n('props.width', 'Largeur', 16, 8000), n('props.height', 'Hauteur', 16, 8000)],
  adjustment: [],
  null: [],
  camera: [n('props.zoom', 'Zoom', 0.05, 20, 0.01), n('props.focal', 'Focale (px)', 100, 10000), bool('props.dof.enabled', 'Profondeur de champ'), n('props.dof.focus', 'Distance de mise au point (Z)', -5000, 5000), n('props.dof.aperture', 'Ouverture (flou)', 0, 80),
    sel('props.shake.preset', 'Tremblement', ['none', 'handheld', 'tremor', 'earthquake', 'custom']), n('props.shake.amplitude', 'Amplitude', 0, 200), n('props.shake.frequency', 'Fréquence', 0, 20, 0.1), n('props.shake.rotation', 'Rotation du tremblement', 0, 20, 0.1), bool('props.orbit.enabled', 'Orbite'), n('props.orbit.radius', 'Rayon orbite', 0, 2000), n('props.orbit.speed', 'Vitesse orbite (°/s)', -360, 360)],
  light: [col('props.color', 'Couleur'), n('props.intensity', 'Intensité', 0, 5, 0.01), n('props.radius', 'Rayon', 10, 5000), n('props.falloff', 'Atténuation', 0.2, 5, 0.05), sel('props.mode', 'Mode', ['add', 'screen', 'spot'])],
  '3d': [sel('props.primitive', 'Primitive', PRIMITIVES_3D), n('props.size', 'Taille', 10, 3000), col('props.color', 'Couleur'), n('props.rotX', 'Rotation X', -360, 360), n('props.rotY', 'Rotation Y', -360, 360), n('props.rotZ', 'Rotation Z', -360, 360), n('props.spinX', 'Rotation auto X (°/s)', -720, 720), n('props.spinY', 'Rotation auto Y (°/s)', -720, 720), n('props.spinZ', 'Rotation auto Z (°/s)', -720, 720), bool('props.wireframe', 'Fil de fer'), bool('props.shading', 'Ombrage'), col('props.edgeColor', 'Arêtes'), n('props.fov', 'Champ de vision', 10, 120)],
  chart: [sel('props.chartType', 'Type', CHART_TYPES), { path: 'props.data', label: 'Données (JSON ou CSV label,valeur)', type: 'data' }, n('props.progress', 'Progression', 0, 1, 0.01), bool('props.autoAnimate', 'Animation automatique'), n('props.animDuration', 'Durée animation (s)', 0.1, 10, 0.1), n('props.stagger', 'Décalage (s)', 0, 1, 0.01), n('props.width', 'Largeur', 100, 4000), n('props.height', 'Hauteur', 100, 4000), bool('props.showLabels', 'Libellés'), bool('props.showValues', 'Valeurs'), txt('props.valuePrefix', 'Préfixe'), txt('props.valueSuffix', 'Suffixe'), n('props.fontSize', 'Taille du texte', 8, 120), col('props.textColor', 'Couleur du texte'), col('props.colors.0', 'Couleur 1'), col('props.colors.1', 'Couleur 2'), col('props.colors.2', 'Couleur 3')],
  counter: [n('props.from', 'De', -1e9, 1e9), n('props.to', 'À', -1e9, 1e9), n('props.decimals', 'Décimales', 0, 6), sel('props.format', 'Format', ['number', 'currency', 'percent']), txt('props.currency', 'Devise (ISO)'), bool('props.separator', 'Séparateur de milliers'), txt('props.prefix', 'Préfixe'), txt('props.suffix', 'Suffixe'), n('props.startAt', 'Début (s)', 0, 600, 0.05), n('props.duration', 'Durée (s)', 0.05, 600, 0.05), { path: 'props.easing', label: 'Easing', type: 'easing' }, { path: 'props.fontFamily', label: 'Police', type: 'font' }, n('props.fontSize', 'Taille', 8, 1000), n('props.fontWeight', 'Graisse', 100, 900, 100), col('props.color', 'Couleur')],
  progress: [sel('props.style', 'Style', ['bar', 'ring']), n('props.value', 'Valeur (0-1)', 0, 1, 0.01), bool('props.auto', 'Animation automatique'), n('props.duration', 'Durée (s)', 0.1, 60, 0.1), n('props.width', 'Largeur', 10, 4000), n('props.height', 'Hauteur', 2, 400), n('props.thickness', 'Épaisseur (anneau)', 1, 200), col('props.color', 'Couleur'), col('props.trackColor', 'Fond'), bool('props.showLabel', 'Pourcentage'), n('props.fontSize', 'Taille du texte', 8, 300)],
  clock: [sel('props.mode', 'Mode', ['clock', 'stopwatch', 'timer']), sel('props.style', 'Style', ['analog', 'digital']), n('props.startSeconds', 'Heure de départ (s)', 0, 86400), n('props.timerFrom', 'Minuteur depuis (s)', 0, 86400), n('props.speed', 'Vitesse', -100, 100, 0.1), n('props.size', 'Taille', 20, 3000), col('props.color', 'Couleur'), col('props.accent', 'Accent')],
  ui: [sel('props.template', 'Modèle', UI_TEMPLATES), txt('props.title', 'Titre', true), txt('props.subtitle', 'Sous-titre'), txt('props.icon', 'Icône'), col('props.accent', 'Accent'), col('props.textColor', 'Texte'), col('props.background', 'Fond'), n('props.width', 'Largeur', 50, 4000), { path: 'props.fontFamily', label: 'Police', type: 'font' }, bool('props.animate', 'Animation intégrée'), n('props.animDuration', 'Durée animation (s)', 0.05, 5, 0.05)],
  audioviz: [sel('props.style', 'Style', AUDIOVIZ_STYLES), asset('props.assetId', 'Source audio', 'audio'), n('props.bands', 'Bandes', 4, 128), col('props.color', 'Couleur'), col('props.color2', 'Couleur 2'), n('props.width', 'Largeur', 50, 4000), n('props.height', 'Hauteur', 20, 4000), n('props.gain', 'Gain', 0, 10, 0.05), n('props.smoothing', 'Lissage', 0, 0.99, 0.01), bool('props.mirror', 'Miroir'), n('props.thickness', 'Épaisseur', 1, 60)],
  mockup: [sel('props.device', 'Appareil', MOCKUP_DEVICES), asset('props.assetId', 'Contenu (image/vidéo)', 'image'), col('props.frameColor', 'Cadre'), col('props.screenColor', 'Écran'), txt('props.url', 'URL (navigateur)'), txt('props.title', 'Titre'), n('props.width', 'Largeur', 100, 4000)],
  code: [txt('props.code', 'Code', true), sel('props.language', 'Langage', ['js', 'ts', 'python', 'html', 'css', 'json', 'bash', 'glsl', 'rust', 'go']), sel('props.theme', 'Thème', ['dark', 'light', 'green']), n('props.fontSize', 'Taille', 8, 120), bool('props.typing', 'Animation de frappe'), n('props.speed', 'Vitesse (car./s)', 1, 500), n('props.startAt', 'Début (s)', 0, 600, 0.05), n('props.width', 'Largeur', 100, 4000), bool('props.lineNumbers', 'Numéros de ligne'), txt('props.title', 'Titre de fenêtre'), bool('props.cursor', 'Curseur')],
};
