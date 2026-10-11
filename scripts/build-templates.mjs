// Génère les 15 templates de projet en utilisant UNIQUEMENT la couche de commandes (comme le ferait une IA via MCP).
// Usage : node scripts/build-templates.mjs  → écrit js/templates/*.json et js/templates/templates.generated.js
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRegistry } from '../js/core/commands/index.js';
import { CommandBus } from '../js/core/commandBus.js';
import { createProject, validateProject } from '../js/core/schema.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'js/templates');
mkdirSync(outDir, { recursive: true });

async function build(id, name, description, meta, steps, thumbTime) {
  const registry = createRegistry();
  const bus = new CommandBus({ registry, project: createProject({ id: `tpl_${id}`, meta: { name, ...meta } }), env: 'node' });
  const ids = {};
  const run = async (n, a, key) => {
    const r = await bus.run(n, a);
    if (!r.ok) throw new Error(`[${id}] ${n} : ${r.error}`);
    if (key) ids[key] = r.result.id;
    return r.result;
  };
  await steps(run, ids, bus);
  const project = bus.project.get();
  const v = validateProject(project);
  if (!v.ok) throw new Error(`[${id}] projet invalide : ${v.errors.join(' ; ')}`);
  return { id, name, description, thumbTime, project };
}

const G = '#24D26D';
const T = [];

T.push(await build('intro-youtube', 'Intro YouTube', 'Fond mesh animé, titre en pop, sous-titre, particules et whoosh visuel.', { duration: 6, background: '#050505' }, async (run, ids) => {
  await run('clip.add', { kind: 'generator', props: { type: 'meshGradient', params: { c1: G, c2: '#0B3DFF', c3: '#FF3D8B', c4: '#050505', speed: 0.5 } }, start: 0, duration: 6, name: 'Fond' });
  await run('clip.add', { kind: 'particles', props: { preset: 'dust' }, start: 0, duration: 6, name: 'Poussière' });
  await run('clip.add', { kind: 'text', props: { text: 'MA CHAÎNE', fontSize: 190, fontWeight: 900, letterSpacing: 6, color: '#FFFFFF' }, start: 0.3, duration: 5.4, transform: { y: -40 }, name: 'Titre' }, 'title');
  await run('animation.apply_preset', { clipId: ids.title, preset: 'popIn', duration: 0.7 });
  await run('animation.apply_preset', { clipId: ids.title, preset: 'zoomBlurOut', duration: 0.5 });
  await run('effect.add', { clipId: ids.title, type: 'glow', params: { threshold: 0.75, radius: 24, intensity: 0.45 } });
  await run('clip.add', { kind: 'text', props: { text: 'Nouvelle vidéo chaque semaine', fontSize: 54, fontWeight: 500, color: G }, start: 0.9, duration: 4.8, transform: { y: 110 }, name: 'Sous-titre' }, 'sub');
  await run('animation.text_animator', { clipId: ids.sub, type: 'slide', by: 'word', stagger: 0.08, duration: 0.9 });
  await run('animation.apply_preset', { clipId: ids.sub, preset: 'fadeOut', duration: 0.4 });
  await run('clip.add', { kind: 'shape', props: { shape: 'line', width: 600, stroke: { enabled: true, width: 6, color: G }, fill: { enabled: false } }, start: 0.6, duration: 5, transform: { y: 60 }, name: 'Ligne' }, 'line');
  await run('keyframe.add', { clipId: ids.line, path: 'props.trimEnd', t: 0, value: 0, easing: 'easeOutExpo' });
  await run('keyframe.add', { clipId: ids.line, path: 'props.trimEnd', t: 0.8, value: 1 });
  await run('camera.preset_move', { type: 'dolly-in', start: 0, duration: 6, intensity: 0.4 });
}, 1.6));

T.push(await build('logo-reveal', 'Logo reveal', 'Révélation de logo par masque circulaire, lueur et lens flare.', { duration: 5, background: '#020403' }, async (run, ids) => {
  await run('clip.add', { kind: 'generator', props: { type: 'glowOrb', params: { color: G, size: 0.35, pulse: 0.4, speed: 1 } }, start: 0, duration: 5, name: 'Lueur' });
  await run('clip.add', { kind: 'shape', props: { shape: 'star', width: 300, height: 300, points: 6, innerRadius: 0.55, fill: { type: 'linear', color: G, stops: [{ o: 0, c: G }, { o: 1, c: '#0B3DFF' }], angle: 45 } }, start: 0.2, duration: 4.8, transform: { y: -60 }, name: 'Logo' }, 'logo');
  await run('animation.apply_preset', { clipId: ids.logo, preset: 'spinIn', duration: 1.2 });
  await run('effect.add', { clipId: ids.logo, type: 'lensFlare', params: { position: [0.3, 0.3], intensity: 0.7 } });
  await run('clip.add', { kind: 'text', props: { text: 'MARQUE', fontSize: 120, fontWeight: 900, letterSpacing: 24 }, start: 1.2, duration: 3.8, transform: { y: 170 }, name: 'Nom' }, 'name');
  await run('transition.add', { clipId: ids.name, type: 'iris', edge: 'in', duration: 0.8 });
  await run('animation.apply_preset', { clipId: ids.name, preset: 'pulse', at: 2.2 });
}, 2.4));

T.push(await build('titre-cinematique', 'Titre cinématique', 'Lettres qui apparaissent une à une, grain, bandes letterbox et étalonnage.', { duration: 7, background: '#000000' }, async (run, ids) => {
  await run('clip.add', { kind: 'generator', props: { type: 'noise', params: { type: 'fBm', scale: 3, speed: 0.08, c1: '#020202', c2: '#2a1d10', contrast: 1.3 } }, start: 0, duration: 7, name: 'Fond' });
  await run('clip.add', { kind: 'text', props: { text: 'L\'HORIZON', fontSize: 170, fontWeight: 300, letterSpacing: 40, fontFamily: 'Georgia', color: '#F3E7D0' }, start: 0.5, duration: 6, name: 'Titre' }, 'title');
  await run('animation.text_animator', { clipId: ids.title, type: 'blurIn', by: 'char', stagger: 0.12, duration: 2.6, easing: 'easeOutCubic' });
  await run('animation.apply_preset', { clipId: ids.title, preset: 'fadeOut', duration: 1 });
  await run('keyframe.add', { clipId: ids.title, path: 'transform.scale', t: 0, value: 1, easing: 'linear' });
  await run('keyframe.add', { clipId: ids.title, path: 'transform.scale', t: 6, value: 1.08 });
  await run('clip.add', { kind: 'adjustment', start: 0, duration: 7, name: 'Étalonnage', effects: [{ type: 'lut', params: { look: 'Film 2383' } }, { type: 'filmGrain', params: { amount: 0.22 } }, { type: 'vignette', params: { amount: 0.55 } }] });
  for (const y of [-470, 470]) await run('clip.add', { kind: 'shape', props: { shape: 'rect', width: 1920, height: 140, radius: [0, 0, 0, 0], fill: { color: '#000000' } }, start: 0, duration: 7, transform: { y }, name: 'Letterbox' });
}, 3.2));

T.push(await build('lower-third', 'Lower third', 'Bandeau nom/fonction animé sur fond vidéo (remplaçable).', { duration: 6, background: '#1a1f24' }, async (run, ids) => {
  await run('clip.add', { kind: 'generator', props: { type: 'gradient', params: { c1: '#2b3a4a', c2: '#101418', c3: '#1a1f24', angle: 120, speed: 0.1, type: 'Linéaire' } }, start: 0, duration: 6, name: 'Fond (remplacer par votre vidéo)' });
  await run('clip.add', { kind: 'ui', props: { template: 'lowerThird', title: 'Camille Martin', subtitle: 'Fondatrice · Studio Nova' }, start: 0.5, duration: 5, transform: { x: -480, y: 330 }, name: 'Lower third' }, 'lt');
  await run('animation.apply_preset', { clipId: ids.lt, preset: 'slideOutLeft', duration: 0.5 });
}, 1.5));

T.push(await build('story-instagram', 'Story Instagram', 'Format 9:16 : titre accrocheur, sticker, barre de progression et CTA.', { width: 1080, height: 1920, duration: 8, background: '#0b0b12' }, async (run, ids) => {
  await run('clip.add', { kind: 'generator', props: { type: 'aurora', params: { c1: G, c2: '#7a3dff', background: '#020814', speed: 0.5, intensity: 1.3 } }, start: 0, duration: 8, width: 1080, name: 'Aurore' });
  await run('clip.add', { kind: 'progress', props: { style: 'bar', width: 960, height: 10, duration: 8, showLabel: false, color: '#FFFFFF', trackColor: '#FFFFFF33' }, start: 0, duration: 8, transform: { y: -900 }, name: 'Progression' });
  await run('clip.add', { kind: 'text', props: { text: '3 ASTUCES\nPOUR CRÉER\nPLUS VITE', fontSize: 130, fontWeight: 900, lineHeight: 1.05 }, start: 0.2, duration: 7.8, transform: { y: -260 }, name: 'Accroche' }, 'h');
  await run('animation.text_animator', { clipId: ids.h, type: 'pop', by: 'word', stagger: 0.12, duration: 1 });
  await run('clip.add', { kind: 'ui', props: { template: 'sticker', title: 'NEW', width: 300 }, start: 1.2, duration: 6.8, transform: { x: 300, y: 180 }, name: 'Sticker' }, 'st');
  await run('animation.apply_preset', { clipId: ids.st, preset: 'wiggleExpr' });
  await run('clip.add', { kind: 'ui', props: { template: 'button', title: 'Swipe up ↑', width: 520 }, start: 2, duration: 6, transform: { y: 700 }, name: 'CTA' }, 'cta');
  await run('animation.apply_preset', { clipId: ids.cta, preset: 'bounceIn' });
}, 2.5));

T.push(await build('pub-produit', 'Publicité produit', 'Mockup téléphone, prix compté, bannière promo et étalonnage dynamique.', { duration: 8, background: '#06100a' }, async (run, ids) => {
  await run('clip.add', { kind: 'generator', props: { type: 'grid', params: { color: '#24D26D33', background: '#06100a', cells: 20, width: 0.02, speed: 0.15, style: 'Perspective rétro' } }, start: 0, duration: 8, name: 'Grille' });
  await run('clip.add', { kind: 'mockup', props: { device: 'phone', title: 'APP', width: 380 }, start: 0, duration: 8, transform: { x: -420, y: 40, scale: 0.9 }, name: 'Téléphone' }, 'ph');
  await run('animation.apply_preset', { clipId: ids.ph, preset: 'riseIn', duration: 1 });
  await run('animation.apply_preset', { clipId: ids.ph, preset: 'float', at: 2 });
  await run('clip.add', { kind: 'text', props: { text: 'La nouvelle façon\nde créer.', fontSize: 92, fontWeight: 800, align: 'left' }, start: 0.6, duration: 7.4, transform: { x: 320, y: -200 }, name: 'Accroche' }, 'tx');
  await run('animation.apply_preset', { clipId: ids.tx, preset: 'fadeInRight' });
  await run('clip.add', { kind: 'counter', props: { from: 0, to: 9.99, decimals: 2, format: 'currency', currency: 'EUR', duration: 1.5, startAt: 0.5, fontSize: 150, color: G }, start: 1.5, duration: 6.5, transform: { x: 320, y: 80 }, name: 'Prix' }, 'price');
  await run('animation.apply_preset', { clipId: ids.price, preset: 'zoomPunch', at: 2.2 });
  await run('clip.add', { kind: 'ui', props: { template: 'banner', title: '-30 % AUJOURD\'HUI', subtitle: 'Code : MOTION30' }, start: 4, duration: 4, transform: { y: 420 }, name: 'Bannière' }, 'ban');
  await run('transition.add', { clipId: ids.ban, type: 'wipe-right', edge: 'in', duration: 0.5 });
}, 4.5));

T.push(await build('lyric-video', 'Lyric video', 'Paroles synchronisées mot par mot sur un fond plasma réactif.', { duration: 10, background: '#0a0014' }, async (run, ids) => {
  await run('clip.add', { kind: 'generator', props: { type: 'plasma', params: { scale: 3, speed: 0.6, saturation: 0.35 } }, start: 0, duration: 10, name: 'Plasma' }, 'bg');
  await run('effect.add', { clipId: ids.bg, type: 'brightness', params: { amount: -0.45 } });
  await run('effect.add', { clipId: ids.bg, type: 'gaussianBlur', params: { radius: 30 } });
  const lines = ['On danse sous la pluie', 'les néons au-dessus de nous', 'rien ne peut nous arrêter'];
  for (let i = 0; i < lines.length; i++) {
    const r = await run('clip.add', { kind: 'text', props: { text: lines[i], fontSize: 96, fontWeight: 800, shadow: { enabled: true, color: '#000000AA', blur: 24, x: 0, y: 6 } }, start: i * 3.2, duration: 3.2, name: `Paroles ${i + 1}` });
    await run('animation.text_animator', { clipId: r.id, type: 'wave', by: 'word', stagger: 0.25, duration: 1.6 });
    await run('transition.add', { clipId: r.id, type: 'blurFade', edge: 'out', duration: 0.4 });
    await run('marker.add', { t: i * 3.2, label: `Couplet ${i + 1}` });
  }
}, 1.8));

T.push(await build('countdown', 'Compte à rebours', 'Décompte 5→0 avec anneau de progression et flash final.', { duration: 6, background: '#050505' }, async (run, ids) => {
  await run('clip.add', { kind: 'generator', props: { type: 'tunnel', params: { c1: '#0F3D22', c2: '#050505', speed: 1.2, rings: 12 } }, start: 0, duration: 6, name: 'Tunnel' });
  await run('clip.add', { kind: 'progress', props: { style: 'ring', width: 1500, thickness: 26, duration: 5, showLabel: false, easing: 'linear' }, start: 0, duration: 5, name: 'Anneau' });
  await run('clip.add', { kind: 'counter', props: { from: 5, to: 0, decimals: 0, duration: 5, easing: 'linear', fontSize: 300, fontWeight: 900, color: '#FFFFFF' }, start: 0, duration: 5, name: 'Décompte' }, 'c');
  await run('expression.set', { clipId: ids.c, path: 'transform.scale', code: '1 + 0.12 * Math.exp(-((time % 1) * 6))' });
  await run('clip.add', { kind: 'text', props: { text: 'C\'EST PARTI !', fontSize: 170, fontWeight: 900, color: G }, start: 5, duration: 1, name: 'Fin' }, 'go');
  await run('transition.add', { clipId: ids.go, type: 'flashWhite', edge: 'in', duration: 0.4 });
}, 2.3));

T.push(await build('slideshow-photo', 'Diaporama photo', 'Cinq diapositives avec Ken Burns et fondus enchaînés (remplacez les visuels par vos photos).', { duration: 12.5, background: '#000000' }, async (run, ids) => {
  const gens = [['meshGradient', {}], ['aurora', {}], ['bokehLights', {}], ['voronoi', {}], ['lavaLamp', {}]];
  let prev = null;
  for (let i = 0; i < gens.length; i++) {
    const r = await run('clip.add', { kind: 'generator', props: { type: gens[i][0] }, start: i * 2.4, duration: 3, trackId: undefined, name: `Photo ${i + 1} (à remplacer)` });
    await run('keyframe.add', { clipId: r.id, path: 'transform.scale', t: 0, value: 1, easing: 'linear' });
    await run('keyframe.add', { clipId: r.id, path: 'transform.scale', t: 3, value: 1.15 });
    if (prev) await run('transition.add', { clipId: prev, betweenClipId: r.id, type: 'dissolve', duration: 0.6, overlap: false });
    prev = r.id;
  }
  await run('clip.add', { kind: 'text', props: { text: 'Souvenirs d\'été', fontSize: 120, fontWeight: 700, fontFamily: 'Georgia', italic: true, shadow: { enabled: true, color: '#000000CC', blur: 30, x: 0, y: 8 } }, start: 0.5, duration: 3, name: 'Titre' }, 't');
  await run('animation.apply_preset', { clipId: ids.t, preset: 'fadeInUp' });
  await run('animation.apply_preset', { clipId: ids.t, preset: 'fadeOut' });
}, 1.2));

T.push(await build('generique-fin', 'Générique de fin', 'Défilement vertical des crédits sur fond sombre.', { duration: 12, background: '#050505' }, async (run, ids) => {
  const credits = 'RÉALISATION\nAlex Moreau\n\nMONTAGE\nSam Petit\n\nMUSIQUE\nLes Ondes\n\nMOTION DESIGN\nMotion Studio\n\nMERCI D\'AVOIR REGARDÉ';
  await run('clip.add', { kind: 'text', props: { text: credits, fontSize: 64, fontWeight: 600, lineHeight: 1.5, color: '#EDEDED' }, start: 0, duration: 12, name: 'Crédits' }, 'cr');
  await run('keyframe.add', { clipId: ids.cr, path: 'transform.y', t: 0, value: 1300, easing: 'linear' });
  await run('keyframe.add', { clipId: ids.cr, path: 'transform.y', t: 12, value: -1300 });
  await run('clip.add', { kind: 'adjustment', start: 0, duration: 12, name: 'Fondu haut/bas', effects: [{ type: 'gradientWipe', params: { angle: 90, position: 0.12, softness: 0.2 } }, { type: 'gradientWipe', params: { angle: 270, position: 0.12, softness: 0.2 } }] });
}, 4));

T.push(await build('annonce-evenement', 'Annonce d\'événement', 'Date, lieu, compteur et confettis pour annoncer un événement.', { duration: 8, background: '#0b0716' }, async (run, ids) => {
  await run('clip.add', { kind: 'generator', props: { type: 'speedLines', params: { color: '#FFFFFF', count: 160, speed: 3, inner: 0.3, style: 'Radiales (manga)' } }, start: 0, duration: 8, name: 'Lignes' }, 'sl');
  await run('clip.set', { id: ids.sl, path: 'transform.opacity', value: 0.25 });
  await run('clip.add', { kind: 'text', props: { text: 'SAVE THE DATE', fontSize: 70, fontWeight: 800, letterSpacing: 16, color: G }, start: 0.2, duration: 7.8, transform: { y: -260 }, name: 'Sur-titre' }, 'a');
  await run('animation.apply_preset', { clipId: ids.a, preset: 'fadeInDown' });
  await run('clip.add', { kind: 'text', props: { text: '24 · 10 · 2026', fontSize: 200, fontWeight: 900 }, start: 0.6, duration: 7.4, transform: { y: -60 }, name: 'Date' }, 'd');
  await run('animation.text_animator', { clipId: ids.d, type: 'scramble', by: 'char', stagger: 0.05, duration: 1.2 });
  await run('clip.add', { kind: 'text', props: { text: 'Paris · La Gaîté Lyrique', fontSize: 60, fontWeight: 500, color: '#8A8A8A' }, start: 1.4, duration: 6.6, transform: { y: 120 }, name: 'Lieu' }, 'l');
  await run('animation.apply_preset', { clipId: ids.l, preset: 'fadeInUp' });
  await run('clip.add', { kind: 'particles', props: { preset: 'confetti' }, start: 2, duration: 6, transform: { y: -600 }, name: 'Confettis' });
}, 3));

T.push(await build('recap-data', 'Récap data', 'Chiffres clés animés : barres, donut et compteur.', { duration: 9, background: '#070a08' }, async (run, ids) => {
  await run('clip.add', { kind: 'text', props: { text: 'Bilan 2026', fontSize: 110, fontWeight: 900 }, start: 0, duration: 9, transform: { y: -430 }, name: 'Titre' }, 't');
  await run('animation.apply_preset', { clipId: ids.t, preset: 'fadeInDown' });
  await run('clip.add', { kind: 'chart', props: { chartType: 'bar', data: 'T1,42\nT2,58\nT3,71\nT4,96', width: 900, height: 520, valueSuffix: ' k' }, start: 0.4, duration: 8.6, transform: { x: -440, y: 80 }, name: 'Ventes' });
  await run('clip.add', { kind: 'chart', props: { chartType: 'donut', data: [{ label: 'Web', value: 55 }, { label: 'Mobile', value: 30 }, { label: 'Autre', value: 15 }], width: 820, height: 420, valueSuffix: ' %' }, start: 1, duration: 8, transform: { x: 480, y: -40 }, name: 'Répartition' });
  await run('clip.add', { kind: 'counter', props: { from: 0, to: 128450, separator: true, prefix: '', suffix: ' utilisateurs', fontSize: 80, duration: 2.5, color: G }, start: 1.5, duration: 7.5, transform: { x: 480, y: 330 }, name: 'Compteur' });
}, 3.5));

T.push(await build('split-screen', 'Écran partagé', 'Comparaison avant/après en deux colonnes avec séparateur animé.', { duration: 6, background: '#000000' }, async (run, ids) => {
  await run('clip.add', { kind: 'generator', props: { type: 'noise', params: { c1: '#202020', c2: '#5a5a5a' } }, start: 0, duration: 6, name: 'Gauche (avant)' }, 'l');
  await run('mask.add', { clipId: ids.l, type: 'rect', x: -480, y: 0, width: 960, height: 1080 });
  await run('effect.add', { clipId: ids.l, type: 'blackWhite', params: {} });
  await run('clip.add', { kind: 'generator', props: { type: 'meshGradient' }, start: 0, duration: 6, name: 'Droite (après)' }, 'r');
  await run('mask.add', { clipId: ids.r, type: 'rect', x: 480, y: 0, width: 960, height: 1080 });
  await run('clip.add', { kind: 'shape', props: { shape: 'rect', width: 10, height: 1080, radius: [0, 0, 0, 0], fill: { color: G } }, start: 0, duration: 6, name: 'Séparateur' }, 's');
  await run('animation.apply_preset', { clipId: ids.s, preset: 'squeezeIn' });
  for (const [x, txt] of [[-480, 'AVANT'], [480, 'APRÈS']]) { const r = await run('clip.add', { kind: 'text', props: { text: txt, fontSize: 100, fontWeight: 900 }, start: 0.5, duration: 5.5, transform: { x, y: -400 }, name: txt }); await run('animation.apply_preset', { clipId: r.id, preset: 'fadeInUp' }); }
}, 2));

T.push(await build('tutoriel', 'Tutoriel', 'Écran de tutoriel : bloc de code animé, étapes et callout.', { duration: 10, background: '#0a0d0b' }, async (run, ids) => {
  await run('clip.add', { kind: 'text', props: { text: 'Étape 1 — Ajouter un clip', fontSize: 64, fontWeight: 800, align: 'left' }, start: 0, duration: 10, transform: { x: -420, y: -440 }, name: 'Étape' }, 'st');
  await run('animation.apply_preset', { clipId: ids.st, preset: 'fadeInLeft' });
  await run('clip.add', { kind: 'code', props: {}, start: 0.5, duration: 9.5, transform: { x: -200, y: 40 }, name: 'Code' });
  await run('clip.add', { kind: 'ui', props: { template: 'callout', title: 'Astuce', subtitle: 'Tout est aussi faisable par MCP' }, start: 4, duration: 6, transform: { x: 620, y: 260 }, name: 'Callout' });
  await run('clip.add', { kind: 'progress', props: { style: 'bar', width: 1700, height: 8, duration: 10, showLabel: false }, start: 0, duration: 10, transform: { y: 500 }, name: 'Avancement' });
}, 5));

T.push(await build('outro-reseaux', 'Outro réseaux sociaux', 'Fin de vidéo : abonnez-vous, pseudo, icônes et notification.', { duration: 7, background: '#050505' }, async (run, ids) => {
  await run('clip.add', { kind: 'generator', props: { type: 'bokehLights', params: { c1: G, c2: '#3D8BFF', count: 30, speed: 0.3 } }, start: 0, duration: 7, name: 'Bokeh' });
  await run('clip.add', { kind: 'ui', props: { template: 'socialHandle', title: '@motionstudio', subtitle: 'youtube · instagram · tiktok' }, start: 0.4, duration: 6.6, transform: { y: -60 }, name: 'Réseaux' }, 's');
  await run('animation.apply_preset', { clipId: ids.s, preset: 'backInUp' });
  await run('clip.add', { kind: 'ui', props: { template: 'button', title: 'S\'abonner', background: '#FF0033', textColor: '#FFFFFF' }, start: 1.2, duration: 5.8, transform: { y: 160 }, name: 'Bouton' }, 'b');
  await run('animation.apply_preset', { clipId: ids.b, preset: 'heartbeat', at: 2.5 });
  await run('clip.add', { kind: 'ui', props: { template: 'notification', title: 'Motion Studio', subtitle: 'Nouvelle vidéo publiée 🔔' }, start: 2.5, duration: 4.5, transform: { x: 560, y: -400 }, name: 'Notification' });
  await run('clip.add', { kind: 'particles', props: { preset: 'sparks', rate: 40 }, start: 1.2, duration: 2, transform: { y: 160 }, name: 'Étincelles' });
}, 3.2));

if (T.length !== 15) throw new Error(`15 templates attendus, ${T.length} générés`);
for (const t of T) writeFileSync(join(outDir, `${t.id}.json`), JSON.stringify(t, null, 2));
writeFileSync(join(outDir, 'templates.generated.js'), `// Fichier généré par scripts/build-templates.mjs — ne pas modifier à la main.\n// ${T.length} templates construits exclusivement via la couche de commandes.\nexport const TEMPLATES = ${JSON.stringify(T)};\n`);
console.log(`✓ ${T.length} templates générés : ${T.map((t) => t.id).join(', ')}`);
