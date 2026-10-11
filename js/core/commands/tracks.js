import { cmd, args, S, createTrack, normalizeOrders } from './helpers.js';
import { CommandError } from '../commandBus.js';
import { TRACK_TYPES } from '../schema.js';
import { uid } from '../util.js';

export default [
  cmd('track.add', 'Ajouter une piste (vidéo, audio, texte, formes, effets, ajustement, caméra)', 'Add track', args({ type: S.enm('Type de piste', TRACK_TYPES), name: S.str('Nom'), index: S.int('Position (0 = haut)', { minimum: 0 }) }, ['type']), (ctx, a) => {
    const t = createTrack(ctx.project, a.type, { name: a.name, index: a.index });
    return { id: t.id, name: t.name, order: t.order };
  }, { mutates: true }),

  cmd('track.remove', 'Supprimer une piste et ses clips', 'Remove track', args({ id: S.str('Piste') }, ['id']), (ctx, a) => {
    ctx.findTrack(a.id);
    const removed = ctx.project.clips.filter((c) => c.trackId === a.id).map((c) => c.id);
    ctx.project.clips = ctx.project.clips.filter((c) => c.trackId !== a.id);
    ctx.project.tracks = ctx.project.tracks.filter((t) => t.id !== a.id);
    normalizeOrders(ctx.project);
    ctx.setApp({ selection: ctx.app.selection.filter((id) => !removed.includes(id)) });
    return { removed: a.id, clipsRemoved: removed.length };
  }, { mutates: true }),

  cmd('track.rename', 'Renommer une piste', 'Rename track', args({ id: S.str('Piste'), name: S.str('Nom', { minLength: 1 }) }, ['id', 'name']), (ctx, a) => { ctx.findTrack(a.id).name = a.name; return { id: a.id, name: a.name }; }, { mutates: true }),

  cmd('track.reorder', 'Déplacer une piste à un nouvel index (0 = haut, rendu au-dessus)', 'Reorder track', args({ id: S.str('Piste'), index: S.int('Nouvel index', { minimum: 0 }) }, ['id', 'index']), (ctx, a) => {
    const t = ctx.findTrack(a.id);
    normalizeOrders(ctx.project);
    const list = [...ctx.project.tracks].sort((x, y) => x.order - y.order).filter((x) => x.id !== a.id);
    list.splice(Math.min(a.index, list.length), 0, t);
    list.forEach((x, i) => { x.order = i; });
    return { id: a.id, order: t.order };
  }, { mutates: true }),

  cmd('track.set', 'Propriétés de piste : muet, solo, verrou, masquée, couleur, hauteur, repliée', 'Set track properties', args({
    id: S.str('Piste'), muted: S.bool('Muet'), solo: S.bool('Solo'), locked: S.bool('Verrouillée'), hidden: S.bool('Masquée'), color: S.str('Couleur'), height: S.num('Hauteur (px)', { minimum: 24, maximum: 200 }), collapsed: S.bool('Repliée'),
  }, ['id']), (ctx, a) => {
    const t = ctx.findTrack(a.id);
    for (const k of ['muted', 'solo', 'locked', 'hidden', 'color', 'height', 'collapsed']) if (a[k] !== undefined) t[k] = a[k];
    return { ...t };
  }, { mutates: true }),

  cmd('track.group', 'Grouper des pistes (repli commun)', 'Group tracks', args({ ids: S.arr('Pistes', { type: 'string' }), name: S.str('Nom du groupe') }, ['ids']), (ctx, a) => {
    const gid = uid('tgrp');
    for (const id of a.ids) { const t = ctx.findTrack(id); t.groupId = gid; t.groupName = a.name || 'Groupe'; }
    return { groupId: gid };
  }, { mutates: true }),

  cmd('track.ungroup', 'Dégrouper des pistes', 'Ungroup tracks', args({ groupId: S.str('Groupe') }, ['groupId']), (ctx, a) => {
    let n = 0;
    for (const t of ctx.project.tracks) if (t.groupId === a.groupId) { t.groupId = null; delete t.groupName; n++; }
    if (!n) throw new CommandError('Groupe introuvable');
    return { ungrouped: n };
  }, { mutates: true }),

  cmd('track.list', 'Lister les pistes', 'List tracks', args({}), (ctx) => [...ctx.project.tracks].sort((a, b) => a.order - b.order).map((t) => ({ ...t, clips: ctx.project.clips.filter((c) => c.trackId === t.id).length }))),
];
