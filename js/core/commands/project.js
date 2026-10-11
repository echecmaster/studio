import { cmd, args, S, estimateSize } from './helpers.js';
import { createProject, normalizeProject, validateProject, projectSchema } from '../schema.js';
import { deepClone, uid, diff } from '../util.js';
import { CommandError } from '../commandBus.js';
import { TEMPLATES } from '../../templates/templates.generated.js';
import { describeAt, visibleClipsAt, resolveClip } from '../evaluate.js';
import { checkExpression } from '../expressions.js';
import { EFFECT_MAP } from '../../catalog/effects.js';
import { TRANSITION_MAP } from '../../catalog/transitions.js';

export const FORMAT_PRESETS = {
  '1080p': [1920, 1080], '4k': [3840, 2160], '720p': [1280, 720], 'vertical': [1080, 1920], 'square': [1080, 1080], '4:5': [1080, 1350], '21:9': [2560, 1080], '1440p': [2560, 1440],
};

function parseProjectArg(p) {
  if (typeof p === 'string') {
    try { p = JSON.parse(p); } catch (e) { throw new CommandError(`JSON invalide : ${e.message}`); }
  }
  if (p && p.project && p.version === undefined) p = p.project;
  const n = normalizeProject(p);
  const v = validateProject(n);
  if (!v.ok) throw new CommandError(`Projet invalide : ${v.errors.slice(0, 8).join(' ; ')}`);
  return n;
}

export function lintProject(project, { measure } = {}) {
  const issues = [];
  const { width: W, height: H, duration: D, fps } = project.meta;
  const push = (level, code, message, clipId) => issues.push({ level, code, message, clipId });
  if (project.workArea.out > D + 1e-6) push('warning', 'workarea', `La zone de travail (${project.workArea.out}s) dépasse la durée (${D}s).`);
  const end = project.clips.reduce((m, c) => Math.max(m, c.start + c.duration), 0);
  if (end > D + 1e-6) push('warning', 'duration', `Des clips se terminent à ${end.toFixed(2)}s, après la fin de la composition (${D}s).`);
  if (end < D * 0.5 && project.clips.length) push('info', 'duration', `Le contenu se termine à ${end.toFixed(2)}s alors que la composition dure ${D}s (fin vide).`);
  if (!project.clips.length) push('warning', 'empty', 'Le projet ne contient aucun clip.');
  for (const c of project.clips) {
    if (c.start >= D) push('warning', 'out-of-range', `"${c.name}" commence après la fin de la composition.`, c.id);
    if (['image', 'video', 'audio', 'svg', 'lottie'].includes(c.kind) && !project.assets.find((a) => a.id === c.props.assetId)) push('error', 'missing-asset', `"${c.name}" référence un asset manquant (${c.props.assetId || 'aucun'}).`, c.id);
    if (c.kind === 'audioviz' && c.props.assetId && !project.assets.find((a) => a.id === c.props.assetId)) push('error', 'missing-asset', `"${c.name}" : source audio manquante.`, c.id);
    for (const e of c.effects || []) {
      if (!EFFECT_MAP[e.type]) push('error', 'unknown-effect', `"${c.name}" : effet inconnu "${e.type}".`, c.id);
      if (e.error) push('error', 'shader-error', `"${c.name}" : shader en erreur (${e.error}).`, c.id);
    }
    if (c.kind === 'shader' && c.props.error) push('error', 'shader-error', `"${c.name}" : erreur de compilation du shader (${c.props.error}).`, c.id);
    for (const tr of [c.transitionIn, c.transitionOut]) if (tr && !TRANSITION_MAP[tr.type]) push('error', 'unknown-transition', `"${c.name}" : transition inconnue "${tr.type}".`, c.id);
    if ((c.transitionIn?.duration || 0) + (c.transitionOut?.duration || 0) > c.duration + 1e-6) push('warning', 'transition-overlap', `"${c.name}" : les transitions d'entrée et de sortie se chevauchent.`, c.id);
    for (const [path, code] of Object.entries(c.expressions || {})) { const err = checkExpression(code); if (err) push('error', 'expression', `"${c.name}" : expression ${path} → ${err}`, c.id); }
    if (c.parentId && !project.clips.find((x) => x.id === c.parentId)) push('error', 'parent', `"${c.name}" : parent introuvable.`, c.id);
    // lisibilité et cadrage : on vérifie au milieu du clip
    const t = c.start + c.duration / 2;
    if (['text', 'shape', 'image', 'counter', 'ui', 'chart'].includes(c.kind)) {
      const r = resolveClip(c, t, { comp: project.meta });
      const size = measure ? measure(r) : estimateSize(r, project);
      const s = Math.abs(r.transform.scale * r.transform.scaleX);
      const hw = (size.w * s) / 2, hh = (size.h * Math.abs(r.transform.scale * r.transform.scaleY)) / 2;
      const x0 = W / 2 + r.transform.x - hw, x1 = W / 2 + r.transform.x + hw, y0 = H / 2 + r.transform.y - hh, y1 = H / 2 + r.transform.y + hh;
      if (x1 < 0 || x0 > W || y1 < 0 || y0 > H) push('warning', 'offscreen', `"${c.name}" est entièrement hors cadre à t=${t.toFixed(2)}s.`, c.id);
      else if (c.kind === 'text' && (x0 < -2 || x1 > W + 2 || y0 < -2 || y1 > H + 2)) push('warning', 'text-cropped', `Le texte "${c.name}" dépasse du cadre à t=${t.toFixed(2)}s.`, c.id);
      if (c.kind === 'text') {
        const px = r.props.fontSize * s;
        if (px < Math.min(W, H) * 0.018) push('warning', 'text-small', `Le texte "${c.name}" est très petit (${Math.round(px)} px) : risque d'illisibilité.`, c.id);
        if (r.transform.opacity < 0.25) push('info', 'text-faint', `Le texte "${c.name}" est presque transparent à mi-parcours.`, c.id);
        const lum = (hex) => { const h = String(hex).replace('#', ''); const n = parseInt(h.slice(0, 6), 16); const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]; };
        const below = visibleClipsAt(project, t).filter((x) => x.id !== c.id);
        if (!below.length) {
          const l1 = lum(r.props.color), l2 = lum(project.meta.background);
          const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
          if (ratio < 3) push('warning', 'contrast', `Le texte "${c.name}" a un contraste faible avec le fond (${ratio.toFixed(1)}:1).`, c.id);
        }
      }
    }
    if (c.kind === 'audio' || c.kind === 'video') {
      const vol = Math.max(c.props.volume ?? 1, ...(c.keyframes['props.volume'] || []).map((k) => k.v));
      const peak = project.assets.find((a) => a.id === c.props.assetId)?.meta?.peak ?? 0.9;
      if (vol * peak > 1.0) push('warning', 'audio-clip', `"${c.name}" : l'audio risque de saturer (crête ${(vol * peak).toFixed(2)} > 1.0). Baissez le volume.`, c.id);
    }
  }
  // audio global : somme des pistes simultanées
  const audioClips = project.clips.filter((c) => (c.kind === 'audio' || c.kind === 'video') && !c.props.muted);
  for (let i = 0; i < audioClips.length; i++) {
    for (let j = i + 1; j < audioClips.length; j++) {
      const a = audioClips[i], b = audioClips[j];
      if (a.start < b.start + b.duration && b.start < a.start + a.duration && (a.props.volume ?? 1) + (b.props.volume ?? 1) > 1.8) {
        push('info', 'audio-sum', `"${a.name}" et "${b.name}" jouent en même temps à fort volume : risque de saturation du mixage.`, a.id);
      }
    }
  }
  if (fps > 60) push('info', 'fps', 'Les cadences > 60 i/s sont peu supportées par les lecteurs.');
  return { ok: !issues.some((i) => i.level === 'error'), count: issues.length, issues };
}

export default [
  cmd('project.new', 'Nouveau projet — crée un projet vide (format, fps, durée, fond)', 'New project', args({
    name: S.str('Nom du projet'), width: S.int('Largeur', { minimum: 16, maximum: 7680 }), height: S.int('Hauteur', { minimum: 16, maximum: 7680 }),
    fps: S.num('Images par seconde', { minimum: 1, maximum: 120 }), duration: S.num('Durée (s)', { exclusiveMinimum: 0, maximum: 3600 }), background: S.str('Couleur de fond'),
    preset: S.enm('Préset de format', Object.keys(FORMAT_PRESETS)), template: S.str('Identifiant de template à appliquer'),
  }), async (ctx, a) => {
    const [pw, ph] = a.preset ? FORMAT_PRESETS[a.preset] : [];
    ctx.project = createProject({ meta: { name: a.name || 'Sans titre', width: a.width || pw || 1920, height: a.height || ph || 1080, fps: a.fps || 30, duration: a.duration || 10, background: a.background || '#000000' } });
    ctx.setApp({ selection: [], time: 0, playing: false });
    if (a.template) await ctx.call('template.apply', { id: a.template, keepFormat: !!(a.width || a.preset) });
    return { id: ctx.project.id, meta: ctx.project.meta };
  }, { mutates: true, shortcut: 'Ctrl+Alt+N' }),

  cmd('project.open', 'Ouvrir un projet enregistré localement (IndexedDB)', 'Open a locally saved project', args({ id: S.str('Identifiant du projet') }, ['id']), async (ctx, a) => {
    const p = await ctx.services.storage.load(a.id);
    if (!p) throw new CommandError(`Projet ${a.id} introuvable`);
    ctx.project = parseProjectArg(p);
    ctx.setApp({ selection: [], time: 0, playing: false });
    await ctx.services.assets?.hydrate?.(ctx.project);
    return { id: ctx.project.id, name: ctx.project.meta.name };
  }, { mutates: true, env: 'browser', history: false }),

  cmd('project.save', 'Enregistrer le projet (IndexedDB/OPFS)', 'Save project', args({}), async (ctx) => {
    await ctx.services.storage.save(ctx.project);
    return { id: ctx.project.id, savedAt: new Date().toISOString() };
  }, { env: 'browser', shortcut: 'Ctrl+S' }),

  cmd('project.duplicate', 'Dupliquer le projet courant (nouvel identifiant)', 'Duplicate project', args({ name: S.str('Nom de la copie') }), async (ctx, a) => {
    const copy = deepClone(ctx.project);
    copy.id = uid('prj');
    copy.meta.name = a.name || `${ctx.project.meta.name} (copie)`;
    if (ctx.services.storage) await ctx.services.storage.save(copy);
    return { id: copy.id, name: copy.meta.name, project: ctx.services.storage ? undefined : copy };
  }),

  cmd('project.rename', 'Renommer le projet', 'Rename project', args({ name: S.str('Nouveau nom', { minLength: 1 }) }, ['name']), (ctx, a) => { ctx.project.meta.name = a.name; return { name: a.name }; }, { mutates: true }),

  cmd('project.set_format', 'Format du projet — largeur, hauteur, fps, durée, fond, préset', 'Set project format', args({
    width: S.int('Largeur', { minimum: 16, maximum: 7680 }), height: S.int('Hauteur', { minimum: 16, maximum: 7680 }), fps: S.num('FPS', { minimum: 1, maximum: 120 }),
    duration: S.num('Durée (s)', { exclusiveMinimum: 0, maximum: 3600 }), background: S.str('Couleur de fond'), preset: S.enm('Préset', Object.keys(FORMAT_PRESETS)), sampleRate: S.int('Fréquence audio'),
  }), (ctx, a) => {
    const m = ctx.project.meta;
    if (a.preset) [m.width, m.height] = FORMAT_PRESETS[a.preset];
    for (const k of ['width', 'height', 'fps', 'background', 'sampleRate']) if (a[k] !== undefined) m[k] = a[k];
    if (a.duration !== undefined) {
      const wasFull = Math.abs(ctx.project.workArea.out - m.duration) < 1e-6;
      m.duration = a.duration;
      if (wasFull || ctx.project.workArea.out > a.duration) ctx.project.workArea.out = a.duration;
      ctx.project.workArea.in = Math.min(ctx.project.workArea.in, ctx.project.workArea.out);
    }
    return { meta: m };
  }, { mutates: true }),

  cmd('project.set_motion_blur', 'Flou de mouvement réel à l\'export (sous-échantillonnage temporel)', 'Export motion blur', args({ enabled: S.bool('Activer'), samples: S.int('Échantillons (4-16)', { minimum: 2, maximum: 16 }), shutter: S.num('Angle d\'obturateur (°)', { minimum: 0, maximum: 720 }) }), (ctx, a) => {
    ctx.project.meta.motionBlur = { enabled: a.enabled ?? true, samples: a.samples ?? 8, shutter: a.shutter ?? 180 };
    return ctx.project.meta.motionBlur;
  }, { mutates: true }),

  cmd('project.import_json', 'Importer un projet complet depuis du JSON (.motion.json)', 'Import project JSON', args({ project: S.any('Objet projet ou chaîne JSON') }, ['project']), async (ctx, a) => {
    ctx.project = parseProjectArg(a.project);
    ctx.setApp({ selection: [], time: 0, playing: false });
    await ctx.services.assets?.hydrate?.(ctx.project);
    return { id: ctx.project.id, clips: ctx.project.clips.length };
  }, { mutates: true }),

  cmd('project.export_json', 'Exporter le projet en JSON (option : assets embarqués en base64, téléchargement)', 'Export project JSON', args({ embedAssets: S.bool('Embarquer les médias en base64'), download: S.bool('Déclencher un téléchargement (navigateur)'), zip: S.bool('Archive .zip (projet + médias)') }), async (ctx, a) => {
    let json = deepClone(ctx.project);
    if (a.embedAssets && ctx.services.assets) json = await ctx.services.assets.embed(json);
    if (a.download && ctx.services.ui) await ctx.services.ui.downloadProject(json, { zip: !!a.zip });
    return a.download ? { downloaded: true, name: json.meta.name } : json;
  }),

  cmd('project.list', 'Lister les projets enregistrés localement', 'List saved projects', args({}), (ctx) => ctx.services.storage.list(), { env: 'browser' }),
  cmd('project.delete', 'Supprimer un projet enregistré', 'Delete saved project', args({ id: S.str('Identifiant') }, ['id']), async (ctx, a) => {
    if (a.id === ctx.project.id) throw new CommandError('Impossible de supprimer le projet ouvert. Ouvrez-en un autre d\'abord.');
    await ctx.services.storage.remove(a.id);
    return { deleted: a.id };
  }, { env: 'browser' }),

  cmd('project.validate', 'Valider le projet contre le JSON Schema', 'Validate project against JSON Schema', args({ project: S.any('Projet à valider (défaut : projet courant)') }), (ctx, a) => {
    const p = a.project ? (typeof a.project === 'string' ? JSON.parse(a.project) : a.project) : ctx.project;
    return validateProject(p);
  }),

  cmd('project.schema', 'Obtenir le JSON Schema du projet', 'Get project JSON Schema', args({}), () => projectSchema),

  cmd('project.diff', 'Différences JSON entre deux projets (ou avec le projet courant)', 'Diff two projects', args({ a: S.any('Projet A (défaut : courant)'), b: S.any('Projet B') }, ['b']), (ctx, a) => {
    const pa = a.a ? (typeof a.a === 'string' ? JSON.parse(a.a) : a.a) : ctx.project;
    const pb = typeof a.b === 'string' ? JSON.parse(a.b) : a.b;
    const d = diff(pa, pb);
    return { count: d.length, changes: d.slice(0, 500).map((p) => ({ op: p.op, path: p.path.join('.'), value: p.value })) };
  }),

  cmd('project.describe', 'Décrire la scène en texte à l\'instant t (pour une IA)', 'Describe the scene at time t', args({ t: S.num('Instant (s)', { minimum: 0 }) }), (ctx, a) => ({ t: a.t ?? ctx.app.time, text: describeAt(ctx.project, a.t ?? ctx.app.time) })),

  cmd('project.lint', 'Analyser le projet : hors cadre, texte illisible, audio saturé, assets manquants, durée, shaders', 'Lint project', args({}), (ctx) => lintProject(ctx.project, { measure: ctx.services.measure })),

  cmd('project.get', 'Obtenir le JSON complet du projet courant', 'Get current project JSON', args({}), (ctx) => deepClone(ctx.project)),

  cmd('project.save_shared', 'Partager : stocker le projet dans Netlify Blobs et obtenir un lien', 'Share project via Netlify Blobs', args({ project: S.any('Projet (défaut : courant)') }), async (ctx, a) => {
    if (!ctx.services.share) throw new CommandError('Service de partage indisponible.');
    const p = a.project ? parseProjectArg(a.project) : ctx.project;
    return ctx.services.share.save(p);
  }),
  cmd('project.load_shared', 'Charger un projet partagé (Netlify Blobs) par identifiant', 'Load shared project', args({ id: S.str('Identifiant de partage') }, ['id']), async (ctx, a) => {
    if (!ctx.services.share) throw new CommandError('Service de partage indisponible.');
    const p = await ctx.services.share.load(a.id);
    ctx.project = parseProjectArg(p);
    await ctx.services.assets?.hydrate?.(ctx.project);
    return { id: ctx.project.id, name: ctx.project.meta.name, clips: ctx.project.clips.length };
  }, { mutates: true }),

  cmd('template.list', 'Lister les templates de projet', 'List project templates', args({}), () => TEMPLATES.map((t) => ({ id: t.id, name: t.name, description: t.description, format: `${t.project.meta.width}×${t.project.meta.height}`, duration: t.project.meta.duration }))),

  cmd('template.apply', 'Appliquer un template (remplace le projet courant)', 'Apply a template', args({ id: S.str('Identifiant du template'), keepFormat: S.bool('Conserver le format actuel'), name: S.str('Nom du projet') }, ['id']), (ctx, a) => {
    const t = TEMPLATES.find((x) => x.id === a.id);
    if (!t) throw new CommandError(`Template inconnu : ${a.id}. Disponibles : ${TEMPLATES.map((x) => x.id).join(', ')}`);
    const fmt = a.keepFormat ? { width: ctx.project.meta.width, height: ctx.project.meta.height, fps: ctx.project.meta.fps } : null;
    const p = normalizeProject(deepClone(t.project));
    p.id = ctx.project.id;
    if (a.name) p.meta.name = a.name;
    if (fmt) {
      const sx = fmt.width / p.meta.width, sy = fmt.height / p.meta.height, s = Math.min(sx, sy);
      for (const c of p.clips) { c.transform.x *= sx; c.transform.y *= sy; c.transform.scale *= s; }
      Object.assign(p.meta, fmt);
    }
    ctx.project = p;
    ctx.setApp({ selection: [], time: 0 });
    return { template: t.id, clips: p.clips.length };
  }, { mutates: true }),
];
