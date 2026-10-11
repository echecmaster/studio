// Partage de projets via Netlify Blobs — POST /api/share (JSON du projet) · GET /api/share?id=…
import { saveShared, loadShared, SHARE_MAX } from '../lib/share.mjs';
import { json, preflight, rateLimit, readBody } from '../lib/http.mjs';

export default async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  const url = new URL(req.url);
  if (req.method === 'GET') {
    const p = await loadShared(url.searchParams.get('id'));
    return p ? json({ project: p }) : json({ error: 'Projet partagé introuvable ou expiré' }, 404);
  }
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405);
  const wait = rateLimit(req, 'share', 30);
  if (wait) return json({ error: `Trop de partages, réessayez dans ${wait}s` }, 429);
  try {
    const body = await readBody(req, SHARE_MAX);
    return json(await saveShared(body.project || body, url.origin));
  } catch (e) { return json({ error: e.message }, e.status || 400); }
};

export const config = { path: '/api/share' };
