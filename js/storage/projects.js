// Projets locaux (IndexedDB) : sauvegarde, liste, chargement, suppression, autosauvegarde
import { idb } from './idb.js';
import { deleteBlob } from './opfs.js';

export const projectsStore = {
  async save(project, thumb = null) {
    const prev = await idb.get('projects', project.id).catch(() => null);
    await idb.put('projects', { id: project.id, name: project.meta.name, updatedAt: Date.now(), createdAt: prev?.createdAt || Date.now(), thumb: thumb || prev?.thumb || null, meta: { width: project.meta.width, height: project.meta.height, duration: project.meta.duration, fps: project.meta.fps, clips: project.clips.length }, project });
    await idb.put('settings', project.id, 'lastProject');
  },
  async load(id) { const r = await idb.get('projects', id); return r?.project || null; },
  async list() {
    const all = await idb.all('projects');
    return all.sort((a, b) => b.updatedAt - a.updatedAt).map(({ project, ...rest }) => rest);
  },
  async remove(id) {
    const r = await idb.get('projects', id);
    await idb.del('projects', id);
    // supprime les médias qui ne sont plus référencés par aucun projet
    if (r?.project) {
      const others = await idb.all('projects');
      const used = new Set(others.flatMap((p) => p.project.assets.map((a) => a.id)));
      for (const a of r.project.assets) if (!used.has(a.id)) await deleteBlob(a.id);
    }
  },
  lastId: () => idb.get('settings', 'lastProject').catch(() => null),
  getSetting: (k) => idb.get('settings', k).catch(() => null),
  setSetting: (k, v) => idb.put('settings', v, k).catch(() => null),
};
