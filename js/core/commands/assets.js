import { cmd, args, S } from './helpers.js';
import { uid } from '../util.js';
import { CommandError } from '../commandBus.js';
import { parseCube } from '../../catalog/luts.js';
import { FONTS } from '../../catalog/elements.js';

export function textAssetMeta(type, text) {
  if (type === 'lottie' || type === 'json') {
    let j;
    try { j = JSON.parse(text); } catch (e) { throw new CommandError(`JSON invalide : ${e.message}`); }
    if (type === 'lottie') {
      if (!j.layers || !j.fr) throw new CommandError('Ce JSON ne ressemble pas à une animation Lottie (layers/fr manquants).');
      return { width: j.w, height: j.h, fps: j.fr, duration: (j.op - j.ip) / j.fr, layers: j.layers.length };
    }
    return {};
  }
  if (type === 'svg') {
    if (!/<svg[\s>]/i.test(text)) throw new CommandError('Contenu SVG invalide (balise <svg> absente).');
    const w = text.match(/\bwidth="([\d.]+)/), h = text.match(/\bheight="([\d.]+)/), vb = text.match(/viewBox="[\d.\s-]*?([\d.]+)\s+([\d.]+)"/);
    return { width: +(w?.[1] || vb?.[1] || 512), height: +(h?.[1] || vb?.[2] || 512) };
  }
  if (type === 'lut') return { size: parseCube(text).size };
  if (type === 'csv') return { rows: text.trim().split(/\r?\n/).length };
  return {};
}

export const SFX_TYPES = ['whoosh', 'pop', 'click', 'riser', 'impact', 'swoosh', 'ding', 'glitch', 'beep', 'drum', 'bass', 'sparkle'];

function usage(project, id) {
  const used = [];
  const scan = (clips) => {
    for (const c of clips) {
      const p = c.props || {};
      if (p.assetId === id || p.spriteAssetId === id || (p.channels || []).includes(id)) used.push(c.id);
      for (const e of c.effects || []) if (Object.values(e.params || {}).includes(id)) used.push(c.id);
      for (const tr of [c.transitionIn, c.transitionOut]) if (tr && Object.values(tr.params || {}).includes(id)) used.push(c.id);
      if (c.kind === 'group') scan(p.clips || []);
    }
  };
  scan(project.clips);
  return [...new Set(used)];
}

export default [
  cmd('asset.import_url', 'Importer un média depuis une URL (CORS requis)', 'Import media from URL', args({ url: S.str('URL'), name: S.str('Nom'), type: S.enm('Type forcé', ['image', 'video', 'audio', 'svg', 'lottie', 'font', 'lut']) }, ['url']), async (ctx, a) => {
    const asset = await ctx.services.assets.importUrl(a.url, { name: a.name, type: a.type });
    ctx.project.assets.push(asset);
    return asset;
  }, { mutates: true, env: 'browser' }),

  cmd('asset.import_base64', 'Importer un média encodé en base64 (data URL ou base64 brut + mime)', 'Import base64 media', args({ data: S.str('Base64 ou data URL'), name: S.str('Nom du fichier'), mime: S.str('Type MIME (ex. image/png)') }, ['data', 'name']), async (ctx, a) => {
    const asset = await ctx.services.assets.importBase64(a.data, a.name, a.mime);
    ctx.project.assets.push(asset);
    return asset;
  }, { mutates: true, env: 'browser' }),

  cmd('asset.import_file', 'Importer un fichier choisi/déposé par l\'utilisateur (jeton de fichier)', 'Import a user-picked file', args({ token: S.str('Jeton du fichier (fourni par l\'UI)') }, ['token']), async (ctx, a) => {
    const asset = await ctx.services.assets.importFile(a.token);
    ctx.project.assets.push(asset);
    return asset;
  }, { mutates: true, env: 'browser' }),

  cmd('asset.import_text', 'Importer un asset texte : SVG, Lottie JSON, JSON, CSV ou LUT .cube', 'Import text asset (svg/lottie/json/csv/cube)', args({ text: S.str('Contenu', { maxLength: 4000000 }), name: S.str('Nom'), type: S.enm('Type', ['svg', 'lottie', 'json', 'csv', 'lut']) }, ['text', 'type']), async (ctx, a) => {
    const asset = { id: uid('ast'), type: a.type, name: a.name || `${a.type}-${ctx.project.assets.length + 1}`, ref: 'inline', mime: { svg: 'image/svg+xml', lottie: 'application/json', json: 'application/json', csv: 'text/csv', lut: 'text/plain' }[a.type], size: a.text.length, data: a.text, meta: textAssetMeta(a.type, a.text) };
    await ctx.services.assets?.registerInline?.(asset);
    ctx.project.assets.push(asset);
    return { id: asset.id, type: asset.type, name: asset.name, meta: asset.meta };
  }, { mutates: true }),

  cmd('asset.list', 'Lister les assets du projet (avec usage)', 'List project assets', args({ type: S.str('Filtrer par type') }), (ctx, a) => ctx.project.assets.filter((x) => !a.type || x.type === a.type).map((x) => ({ id: x.id, type: x.type, name: x.name, mime: x.mime, size: x.size, meta: x.meta, usedBy: usage(ctx.project, x.id) }))),

  cmd('asset.rename', 'Renommer un asset', 'Rename asset', args({ id: S.str('Asset'), name: S.str('Nom', { minLength: 1 }) }, ['id', 'name']), (ctx, a) => {
    const as = ctx.project.assets.find((x) => x.id === a.id);
    if (!as) throw new CommandError(`Asset introuvable : ${a.id}`);
    as.name = a.name;
    return { id: as.id, name: as.name };
  }, { mutates: true }),

  cmd('asset.delete', 'Supprimer un asset (refusé s\'il est utilisé, sauf force)', 'Delete asset', args({ id: S.str('Asset'), force: S.bool('Supprimer aussi les clips qui l\'utilisent') }, ['id']), async (ctx, a) => {
    const idx = ctx.project.assets.findIndex((x) => x.id === a.id);
    if (idx < 0) throw new CommandError(`Asset introuvable : ${a.id}`);
    const used = usage(ctx.project, a.id);
    if (used.length && !a.force) throw new CommandError(`Asset utilisé par ${used.length} clip(s) : ${used.join(', ')}. Utilisez force: true.`);
    if (a.force) ctx.project.clips = ctx.project.clips.filter((c) => !used.includes(c.id));
    ctx.project.assets.splice(idx, 1);
    return { deleted: a.id, removedClips: a.force ? used : [] };
  }, { mutates: true }),

  cmd('asset.replace', 'Remplacer le média d\'un asset sans casser les liens (par un autre asset, une URL ou du base64)', 'Replace asset media', args({ id: S.str('Asset à remplacer'), withId: S.str('Asset source'), url: S.str('URL'), data: S.str('Base64'), name: S.str('Nom'), mime: S.str('MIME') }, ['id']), async (ctx, a) => {
    const target = ctx.project.assets.find((x) => x.id === a.id);
    if (!target) throw new CommandError(`Asset introuvable : ${a.id}`);
    let src;
    if (a.withId) {
      const i = ctx.project.assets.findIndex((x) => x.id === a.withId);
      if (i < 0) throw new CommandError(`Asset source introuvable : ${a.withId}`);
      src = ctx.project.assets.splice(i, 1)[0];
    } else if (a.url) src = await ctx.services.assets.importUrl(a.url, {});
    else if (a.data) src = await ctx.services.assets.importBase64(a.data, a.name || target.name, a.mime);
    else throw new CommandError('Indiquez withId, url ou data.');
    const keepId = target.id;
    Object.assign(target, { ...src, id: keepId, name: a.name || src.name });
    await ctx.services.assets?.rebind?.(keepId, src);
    return { id: keepId, name: target.name, type: target.type };
  }, { mutates: true }),

  cmd('asset.usage', 'Voir quels clips utilisent un asset', 'Asset usage', args({ id: S.str('Asset') }, ['id']), (ctx, a) => ({ id: a.id, usedBy: usage(ctx.project, a.id) })),

  cmd('asset.generate_sfx', 'Générer un bruitage synthétique (Web Audio) : whoosh, pop, click, riser, impact…', 'Generate a synthesized SFX', args({ type: S.enm('Type de son', SFX_TYPES), duration: S.num('Durée (s)', { minimum: 0.05, maximum: 10 }), name: S.str('Nom'), addToTimeline: S.bool('Ajouter aussi un clip audio'), at: S.num('Instant d\'insertion (s)', { minimum: 0 }) }, ['type']), async (ctx, a) => {
    const asset = await ctx.services.assets.generateSfx(a.type, a.duration, a.name);
    ctx.project.assets.push(asset);
    let clipId = null;
    if (a.addToTimeline) {
      const r = await ctx.call('clip.add', { kind: 'audio', start: a.at ?? ctx.app.time, duration: asset.meta.duration, props: { assetId: asset.id }, name: asset.name });
      clipId = r.id;
    }
    return { asset, clipId };
  }, { mutates: true, env: 'browser' }),

  cmd('asset.record_voice', 'Enregistrer une voix off au micro (getUserMedia)', 'Record voice-over', args({ seconds: S.num('Durée max (s)', { minimum: 1, maximum: 600 }), addToTimeline: S.bool('Ajouter à la timeline'), at: S.num('Instant (s)') }), async (ctx, a) => {
    const asset = await ctx.services.assets.recordVoice(a.seconds || 10);
    ctx.project.assets.push(asset);
    let clipId = null;
    if (a.addToTimeline !== false) clipId = (await ctx.call('clip.add', { kind: 'audio', start: a.at ?? ctx.app.time, duration: asset.meta.duration, props: { assetId: asset.id }, name: 'Voix off' })).id;
    return { asset, clipId };
  }, { mutates: true, env: 'browser' }),

  cmd('font.list', 'Lister les polices disponibles (système + importées)', 'List fonts', args({}), (ctx) => [...FONTS, ...ctx.project.assets.filter((a) => a.type === 'font').map((a) => a.meta?.family || a.name)]),

  cmd('font.load_url', 'Charger une police depuis une URL (.ttf/.otf/.woff2)', 'Load font from URL', args({ url: S.str('URL'), family: S.str('Nom de famille') }, ['url', 'family']), async (ctx, a) => {
    const asset = await ctx.services.assets.importUrl(a.url, { type: 'font', name: a.family, family: a.family });
    ctx.project.assets.push(asset);
    return asset;
  }, { mutates: true, env: 'browser' }),

  cmd('lut.import', 'Importer une LUT 3D (.cube) en texte — utilisable via l\'effet "LUT 3D importée"', 'Import 3D LUT (.cube)', args({ text: S.str('Contenu .cube', { maxLength: 8000000 }), name: S.str('Nom'), applyTo: S.str('Clip auquel ajouter l\'effet') }, ['text']), async (ctx, a) => {
    const r = await ctx.call('asset.import_text', { text: a.text, name: a.name || 'LUT', type: 'lut' });
    if (a.applyTo) await ctx.call('effect.add', { clipId: a.applyTo, type: 'lut3d', params: { lut: r.id } });
    return r;
  }, { mutates: true }),
];
