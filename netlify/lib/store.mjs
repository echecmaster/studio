// Stockage : Netlify Blobs (cohérence forte) avec repli mémoire pour le développement local et les tests.
let blobsMod = null;
const memory = new Map();

function memoryStore(name) {
  const k = (key) => `${name}:${key}`;
  return {
    kind: 'memory',
    async get(key, opts) { const v = memory.get(k(key)); return v === undefined ? null : opts?.type === 'json' ? JSON.parse(v) : v; },
    async setJSON(key, value) { memory.set(k(key), JSON.stringify(value)); },
    async set(key, value) { memory.set(k(key), String(value)); },
    async delete(key) { memory.delete(k(key)); },
    async list({ prefix = '' } = {}) {
      const blobs = [];
      for (const key of memory.keys()) if (key.startsWith(k(prefix))) blobs.push({ key: key.slice(name.length + 1) });
      return { blobs };
    },
  };
}

export async function getStoreSafe(name) {
  if (process.env.MOTION_MEMORY_STORE === '1') return memoryStore(name);
  try {
    blobsMod ||= await import('@netlify/blobs');
    const s = blobsMod.getStore({ name, consistency: 'strong' });
    return { kind: 'blobs', get: (key, o) => s.get(key, o), setJSON: (key, v) => s.setJSON(key, v), set: (key, v) => s.set(key, v), delete: (key) => s.delete(key), list: (o) => s.list(o) };
  } catch {
    return memoryStore(name);
  }
}

export function randomId(bytes = 16) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export function randomCode(len = 6) {
  const a = new Uint32Array(len);
  crypto.getRandomValues(a);
  return [...a].map((x) => x % 10).join('');
}
