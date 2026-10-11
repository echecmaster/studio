// OPFS (Origin Private File System) : stockage des gros médias quand disponible, sinon repli IndexedDB
import { idb } from './idb.js';

let rootP = null;
export async function opfsAvailable() {
  try {
    if (!navigator.storage?.getDirectory) return false;
    rootP ||= navigator.storage.getDirectory().then((r) => r.getDirectoryHandle('media', { create: true }));
    await rootP;
    return true;
  } catch { return false; }
}

export async function putBlob(id, blob) {
  if (await opfsAvailable()) {
    try {
      const dir = await rootP;
      const fh = await dir.getFileHandle(id, { create: true });
      if (fh.createWritable) {
        const w = await fh.createWritable();
        await w.write(blob);
        await w.close();
        return 'opfs';
      }
    } catch (e) { console.warn('[opfs] repli IndexedDB', e); }
  }
  await idb.put('blobs', blob, id);
  return 'idb';
}

export async function getBlob(id) {
  if (await opfsAvailable()) {
    try {
      const dir = await rootP;
      const fh = await dir.getFileHandle(id);
      return await fh.getFile();
    } catch { /* pas dans OPFS */ }
  }
  return (await idb.get('blobs', id)) || null;
}

export async function deleteBlob(id) {
  if (await opfsAvailable()) { try { const dir = await rootP; await dir.removeEntry(id); } catch { /* */ } }
  try { await idb.del('blobs', id); } catch { /* */ }
}
