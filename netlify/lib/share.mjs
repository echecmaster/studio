// Partage de projets (JSON uniquement) dans Netlify Blobs
import { getStoreSafe, randomId } from './store.mjs';
import { normalizeProject, validateProject } from '../../js/core/schema.js';

export const SHARE_MAX = 4.5 * 1024 * 1024;
const TTL = 30 * 24 * 3600 * 1000;

export async function saveShared(project, origin = '') {
  const p = normalizeProject(project);
  const v = validateProject(p);
  if (!v.ok) throw new Error(`Projet invalide : ${v.errors.slice(0, 5).join(' ; ')}`);
  for (const a of p.assets) delete a.embedded;
  const json = JSON.stringify(p);
  if (json.length > SHARE_MAX) throw new Error('Projet trop volumineux pour le partage (> 4,5 Mo).');
  const id = randomId(6);
  const s = await getStoreSafe('motion-share');
  await s.setJSON(`p/${id}`, { project: p, createdAt: Date.now(), expiresAt: Date.now() + TTL });
  return { id, url: `${origin}/?share=${id}`, expiresAt: new Date(Date.now() + TTL).toISOString(), mediaNote: 'Les médias binaires importés ne sont pas inclus (seul le JSON est partagé).' };
}

export async function loadShared(id) {
  if (!/^[a-f0-9]{6,32}$/.test(String(id))) return null;
  const s = await getStoreSafe('motion-share');
  const r = await s.get(`p/${id}`, { type: 'json' });
  if (!r || r.expiresAt < Date.now()) return null;
  return r.project;
}
