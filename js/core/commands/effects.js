import { cmd, args, S, requireUnlocked, selectedOr } from './helpers.js';
import { CommandError } from '../commandBus.js';
import { EFFECTS, EFFECT_MAP, EFFECT_CATEGORIES, defaultEffectParams, describeEffect } from '../../catalog/effects.js';
import { EFFECT_PRESETS, EFFECT_PRESET_MAP } from '../../catalog/effectPresets.js';
import { uid, deepClone } from '../util.js';
import { parseShaderParams } from '../../catalog/shaders.js';

function findEffect(clip, id) {
  const e = clip.effects.find((x) => x.id === id) || (Number.isInteger(+id) ? clip.effects[+id] : null);
  if (!e) throw new CommandError(`Effet introuvable : ${id}`);
  return e;
}

function coerceParams(type, params = {}) {
  const def = EFFECT_MAP[type];
  const out = {};
  for (const [k, v] of Object.entries(params)) {
    const p = def.params.find((x) => x.name === k);
    if (!p) throw new CommandError(`Paramètre inconnu pour ${type} : ${k}. Paramètres : ${def.params.map((x) => x.name).join(', ')}`);
    if (p.type === 'select' && typeof v === 'number') out[k] = p.options[v] ?? p.default;
    else if (p.type === 'select' && !p.options.includes(v)) throw new CommandError(`${k} : valeur "${v}" invalide (${p.options.join(' | ')})`);
    else out[k] = v;
  }
  return out;
}

// basic checks GLSL côté serveur (la compilation réelle a lieu dans le navigateur)
export function staticShaderCheck(code) {
  const errors = [];
  if (!/void\s+mainImage\s*\(/.test(code)) errors.push('Fonction "void mainImage(out vec4 fragColor, in vec2 fragCoord)" manquante.');
  let depth = 0;
  for (const ch of code) { if (ch === '{') depth++; if (ch === '}') depth--; if (depth < 0) break; }
  if (depth !== 0) errors.push('Accolades non équilibrées.');
  if (/#version/.test(code)) errors.push('Ne pas inclure #version : l\'en-tête est ajouté automatiquement.');
  return errors;
}

const MASK_TYPES = ['rect', 'ellipse', 'polygon', 'bezier'];
const MASK_MODES = ['add', 'subtract', 'intersect', 'difference'];

export default [
  cmd('effect.catalog', 'Catalogue des effets/filtres (filtrable) avec paramètres, plages et valeurs par défaut', 'Effects catalog', args({ category: S.enm('Catégorie', Object.keys(EFFECT_CATEGORIES)), query: S.str('Recherche texte'), compact: S.bool('Liste compacte (sans paramètres)') }), (ctx, a) => {
    const q = (a.query || '').toLowerCase();
    const list = EFFECTS.filter((e) => (!a.category || e.category === a.category) && (!q || e.id.toLowerCase().includes(q) || e.name.toLowerCase().includes(q) || e.en.toLowerCase().includes(q)));
    return { count: list.length, categories: EFFECT_CATEGORIES, effects: a.compact ? list.map((e) => ({ type: e.id, name: e.name, category: e.category })) : list.map(describeEffect) };
  }),

  cmd('effect.add', 'Ajouter un effet à un clip (paramètres optionnels)', 'Add effect', args({ clipId: S.str('Clip (défaut : sélection)'), type: S.str('Type d\'effet (voir effect.catalog)'), params: S.obj('Paramètres'), index: S.int('Position dans la pile', { minimum: 0 }) }, ['type']), (ctx, a) => {
    const c = ctx.findClip(a.clipId || selectedOr(ctx)[0]);
    requireUnlocked(ctx, c);
    if (!EFFECT_MAP[a.type]) throw new CommandError(`Effet inconnu : ${a.type}. Utilisez effect.catalog.`);
    const e = { id: uid('fx'), type: a.type, enabled: true, params: { ...defaultEffectParams(a.type), ...coerceParams(a.type, a.params) } };
    if (a.index !== undefined) c.effects.splice(a.index, 0, e); else c.effects.push(e);
    ctx.setApp({ selectedEffect: e.id });
    return { clipId: c.id, effectId: e.id, type: e.type, params: e.params };
  }, { mutates: true }),

  cmd('effect.remove', 'Retirer un effet d\'un clip', 'Remove effect', args({ clipId: S.str('Clip'), effectId: S.str('Effet') }, ['clipId', 'effectId']), (ctx, a) => {
    const c = ctx.findClip(a.clipId);
    const e = findEffect(c, a.effectId);
    c.effects = c.effects.filter((x) => x !== e);
    for (const path of Object.keys(c.keyframes)) if (path.startsWith(`effects.${e.id}.`)) delete c.keyframes[path];
    for (const path of Object.keys(c.expressions)) if (path.startsWith(`effects.${e.id}.`)) delete c.expressions[path];
    return { removed: e.id };
  }, { mutates: true }),

  cmd('effect.update', 'Modifier les paramètres d\'un effet', 'Update effect params', args({ clipId: S.str('Clip'), effectId: S.str('Effet'), params: S.obj('Paramètres'), enabled: S.bool('Activé') }, ['clipId', 'effectId']), (ctx, a) => {
    const c = ctx.findClip(a.clipId);
    requireUnlocked(ctx, c);
    const e = findEffect(c, a.effectId);
    const p = coerceParams(e.type, a.params || {});
    for (const [k, v] of Object.entries(p)) {
      const path = `effects.${e.id}.params.${k}`;
      const keys = c.keyframes[path];
      if (keys?.length) {
        const t = Math.max(0, Math.min(c.duration, ctx.app.time - c.start));
        const kf = keys.find((x) => Math.abs(x.t - t) < 0.5 / ctx.project.meta.fps);
        if (kf) kf.v = v; else { keys.push({ t, v, easing: 'easeInOutCubic' }); keys.sort((x, y) => x.t - y.t); }
      } else e.params[k] = v;
    }
    if (a.enabled !== undefined) e.enabled = a.enabled;
    if (e.type === 'customShader' && p.code) delete e.error;
    return { effectId: e.id, params: e.params };
  }, { mutates: true }),

  cmd('effect.reorder', 'Réordonner un effet dans la pile', 'Reorder effect', args({ clipId: S.str('Clip'), effectId: S.str('Effet'), index: S.int('Nouvelle position', { minimum: 0 }) }, ['clipId', 'effectId', 'index']), (ctx, a) => {
    const c = ctx.findClip(a.clipId);
    const e = findEffect(c, a.effectId);
    c.effects = c.effects.filter((x) => x !== e);
    c.effects.splice(Math.min(a.index, c.effects.length), 0, e);
    return { order: c.effects.map((x) => x.id) };
  }, { mutates: true }),

  cmd('effect.toggle', 'Activer / désactiver un effet', 'Toggle effect', args({ clipId: S.str('Clip'), effectId: S.str('Effet'), enabled: S.bool('Activé') }, ['clipId', 'effectId']), (ctx, a) => {
    const e = findEffect(ctx.findClip(a.clipId), a.effectId);
    e.enabled = a.enabled ?? !e.enabled;
    return { effectId: e.id, enabled: e.enabled };
  }, { mutates: true }),

  cmd('effect.duplicate', 'Dupliquer un effet', 'Duplicate effect', args({ clipId: S.str('Clip'), effectId: S.str('Effet') }, ['clipId', 'effectId']), (ctx, a) => {
    const c = ctx.findClip(a.clipId);
    const e = findEffect(c, a.effectId);
    const d = { ...deepClone(e), id: uid('fx') };
    c.effects.splice(c.effects.indexOf(e) + 1, 0, d);
    return { effectId: d.id };
  }, { mutates: true }),

  cmd('effect.copy_stack', 'Copier la pile d\'effets d\'un clip', 'Copy effect stack', args({ clipId: S.str('Clip') }), (ctx, a) => {
    const c = ctx.findClip(a.clipId || selectedOr(ctx)[0]);
    const stack = c.effects.map((e) => ({ type: e.type, enabled: e.enabled, params: deepClone(e.params) }));
    ctx.setApp({ effectClipboard: stack });
    return { count: stack.length, stack };
  }),

  cmd('effect.paste_stack', 'Coller une pile d\'effets sur des clips (remplacer ou ajouter)', 'Paste effect stack', args({ clipIds: S.ids(), mode: S.enm('Mode', ['append', 'replace']), stack: S.arr('Pile explicite [{type, params}]', { type: 'object' }) }), (ctx, a) => {
    const stack = a.stack || ctx.app.effectClipboard;
    if (!stack?.length) throw new CommandError('Aucune pile d\'effets copiée.');
    const ids = selectedOr(ctx, a.clipIds);
    for (const id of ids) {
      const c = ctx.findClip(id);
      if (a.mode === 'replace') c.effects = [];
      for (const s of stack) {
        if (!EFFECT_MAP[s.type]) throw new CommandError(`Effet inconnu : ${s.type}`);
        c.effects.push({ id: uid('fx'), type: s.type, enabled: s.enabled !== false, params: { ...defaultEffectParams(s.type), ...coerceParams(s.type, s.params) } });
      }
    }
    return { clips: ids.length, effects: stack.length };
  }, { mutates: true }),

  cmd('effect.list_presets', 'Lister les presets d\'effets (intégrés + utilisateur)', 'List effect presets', args({}), (ctx) => [...EFFECT_PRESETS.map((p) => ({ id: p.id, name: p.name, builtin: true, effects: p.effects.map((e) => e.type) })), ...(ctx.project.presets || []).map((p) => ({ id: p.id, name: p.name, builtin: false, effects: p.effects.map((e) => e.type) }))]),

  cmd('effect.apply_preset', 'Appliquer un preset de pile d\'effets (ex. Cinéma chaud, Cyberpunk, Rétro VHS)', 'Apply effect preset', args({ clipIds: S.ids(), presetId: S.str('Preset'), mode: S.enm('Mode', ['append', 'replace']) }, ['presetId']), (ctx, a) => {
    const p = EFFECT_PRESET_MAP[a.presetId] || (ctx.project.presets || []).find((x) => x.id === a.presetId || x.name === a.presetId);
    if (!p) throw new CommandError(`Preset inconnu : ${a.presetId}`);
    return ctx.call('effect.paste_stack', { clipIds: a.clipIds, mode: a.mode || 'append', stack: p.effects });
  }, { mutates: true }),

  cmd('effect.save_preset', 'Enregistrer la pile d\'effets d\'un clip comme preset nommé (dans le projet)', 'Save effect preset', args({ clipId: S.str('Clip'), name: S.str('Nom', { minLength: 1 }) }, ['name']), (ctx, a) => {
    const c = ctx.findClip(a.clipId || selectedOr(ctx)[0]);
    const preset = { id: uid('pre'), name: a.name, effects: c.effects.map((e) => ({ type: e.type, enabled: e.enabled, params: deepClone(e.params) })) };
    ctx.project.presets = [...(ctx.project.presets || []), preset];
    return preset;
  }, { mutates: true }),

  cmd('effect.import_preset', 'Importer un preset d\'effets (JSON)', 'Import effect preset', args({ preset: S.any('Objet {name, effects:[{type,params}]} ou JSON') }, ['preset']), (ctx, a) => {
    const p = typeof a.preset === 'string' ? JSON.parse(a.preset) : a.preset;
    if (!p?.name || !Array.isArray(p.effects)) throw new CommandError('Preset invalide : {name, effects:[…]} attendu.');
    for (const e of p.effects) if (!EFFECT_MAP[e.type]) throw new CommandError(`Effet inconnu : ${e.type}`);
    const preset = { id: uid('pre'), name: p.name, effects: p.effects };
    ctx.project.presets = [...(ctx.project.presets || []), preset];
    return preset;
  }, { mutates: true }),

  cmd('effect.export_preset', 'Exporter un preset d\'effets en JSON', 'Export effect preset', args({ presetId: S.str('Preset') }, ['presetId']), (ctx, a) => {
    const p = EFFECT_PRESET_MAP[a.presetId] || (ctx.project.presets || []).find((x) => x.id === a.presetId);
    if (!p) throw new CommandError('Preset introuvable');
    return { name: p.name, effects: p.effects };
  }),

  cmd('effect.delete_preset', 'Supprimer un preset utilisateur', 'Delete user preset', args({ presetId: S.str('Preset') }, ['presetId']), (ctx, a) => {
    const before = (ctx.project.presets || []).length;
    ctx.project.presets = (ctx.project.presets || []).filter((p) => p.id !== a.presetId);
    if (before === ctx.project.presets.length) throw new CommandError('Preset utilisateur introuvable');
    return { deleted: a.presetId };
  }, { mutates: true }),

  cmd('shader.set_code', 'Définir le code GLSL d\'un clip shader ou d\'un effet "Shader personnalisé" (mainImage, iTime, iResolution, iMouse, iChannel0..3)', 'Set GLSL shader code', args({ clipId: S.str('Clip'), effectId: S.str('Effet customShader (sinon : clip shader)'), code: S.str('Code GLSL', { maxLength: 100000 }) }, ['clipId', 'code']), async (ctx, a) => {
    const c = ctx.findClip(a.clipId);
    const errs = staticShaderCheck(a.code);
    if (errs.length) throw new CommandError(errs.join(' '));
    let compileErrors = [];
    if (ctx.services.renderer?.validateShader) compileErrors = await ctx.services.renderer.validateShader(a.code, a.effectId ? 'effect' : 'clip');
    if (a.effectId) {
      const e = findEffect(c, a.effectId);
      e.params.code = a.code;
      if (compileErrors.length) e.error = compileErrors[0].message; else delete e.error;
    } else {
      if (c.kind !== 'shader') throw new CommandError('Ce clip n\'est pas un clip shader (précisez effectId pour un effet).');
      c.props.code = a.code;
      const params = parseShaderParams(a.code);
      c.props.params = Object.fromEntries(params.map((p) => [p.name, c.props.params?.[p.name] ?? p.default]));
      if (compileErrors.length) c.props.error = compileErrors[0].message; else delete c.props.error;
    }
    return { ok: compileErrors.length === 0, errors: compileErrors, params: parseShaderParams(a.code) };
  }, { mutates: true }),

  cmd('shader.validate', 'Compiler un shader GLSL et renvoyer les erreurs ligne par ligne', 'Validate GLSL shader', args({ code: S.str('Code GLSL'), target: S.enm('Contexte', ['clip', 'effect']) }, ['code']), async (ctx, a) => {
    const errs = staticShaderCheck(a.code).map((m) => ({ line: 0, message: m }));
    if (errs.length) return { ok: false, errors: errs, compiled: false };
    if (!ctx.services.renderer?.validateShader) return { ok: true, errors: [], compiled: false, note: 'Vérification statique uniquement (compilation WebGL dans le navigateur).' };
    const ce = await ctx.services.renderer.validateShader(a.code, a.target || 'clip');
    return { ok: ce.length === 0, errors: ce, compiled: true, params: parseShaderParams(a.code) };
  }),

  cmd('mask.add', 'Ajouter un masque (rectangle, ellipse, polygone, Bézier) avec contour progressif, expansion, inversion, mode', 'Add mask', args({
    clipId: S.str('Clip'), type: S.enm('Type', MASK_TYPES), x: S.num('Centre X (px, repère du calque, 0 = centre)'), y: S.num('Centre Y'), width: S.num('Largeur'), height: S.num('Hauteur'),
    points: S.arr('Points [{x,y,ix,iy,ox,oy}] (polygone / Bézier, repère calque centré)', { type: 'object' }), feather: S.num('Contour progressif (px)', { minimum: 0 }), expansion: S.num('Expansion (px)'), invert: S.bool('Inverser'), opacity: S.num('Opacité', { minimum: 0, maximum: 1 }), mode: S.enm('Mode', MASK_MODES),
  }, ['clipId', 'type']), (ctx, a) => {
    const c = ctx.findClip(a.clipId);
    const m = { id: uid('msk'), type: a.type, x: a.x ?? 0, y: a.y ?? 0, width: a.width ?? 400, height: a.height ?? 300, points: a.points || [], feather: a.feather ?? 0, expansion: a.expansion ?? 0, invert: !!a.invert, opacity: a.opacity ?? 1, mode: a.mode || 'add', enabled: true };
    if ((a.type === 'polygon' || a.type === 'bezier') && !m.points.length) m.points = [{ x: -200, y: -150 }, { x: 200, y: -150 }, { x: 250, y: 150 }, { x: -250, y: 150 }];
    c.masks.push(m);
    return { maskId: m.id };
  }, { mutates: true }),

  cmd('mask.update', 'Modifier un masque', 'Update mask', args({ clipId: S.str('Clip'), maskId: S.str('Masque'), patch: S.obj('Champs à modifier (x, y, width, height, points, feather, expansion, invert, opacity, mode, enabled)') }, ['clipId', 'maskId', 'patch']), (ctx, a) => {
    const c = ctx.findClip(a.clipId);
    const m = c.masks.find((x) => x.id === a.maskId);
    if (!m) throw new CommandError('Masque introuvable');
    if (a.patch.mode && !MASK_MODES.includes(a.patch.mode)) throw new CommandError('Mode de masque invalide');
    Object.assign(m, a.patch, { id: m.id });
    return { maskId: m.id };
  }, { mutates: true }),

  cmd('mask.remove', 'Supprimer un masque', 'Remove mask', args({ clipId: S.str('Clip'), maskId: S.str('Masque') }, ['clipId', 'maskId']), (ctx, a) => {
    const c = ctx.findClip(a.clipId);
    c.masks = c.masks.filter((x) => x.id !== a.maskId);
    for (const p of Object.keys(c.keyframes)) if (p.startsWith(`masks.${a.maskId}.`)) delete c.keyframes[p];
    return { removed: a.maskId };
  }, { mutates: true }),

  cmd('matte.set', 'Track matte : utiliser un autre clip comme cache (alpha, alpha inversé, luma, luma inversé) ou null', 'Set track matte', args({ clipId: S.str('Clip'), sourceId: { type: ['string', 'null'], description: 'Clip source du cache (null pour retirer)' }, type: S.enm('Type', ['alpha', 'alphaInverted', 'luma', 'lumaInverted']), hideSource: S.bool('Masquer le clip source (défaut : oui)') }, ['clipId']), (ctx, a) => {
    const c = ctx.findClip(a.clipId);
    if (!a.sourceId) { c.matte = null; return { clipId: c.id, matte: null }; }
    if (a.sourceId === c.id) throw new CommandError('Un clip ne peut pas être son propre cache.');
    ctx.findClip(a.sourceId);
    c.matte = { sourceId: a.sourceId, type: a.type || 'alpha', hideSource: a.hideSource !== false };
    return { clipId: c.id, matte: c.matte };
  }, { mutates: true }),
];
