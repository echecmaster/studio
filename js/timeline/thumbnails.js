// Miniatures vidéo (filmstrip) mises en cache par asset
const cache = new Map(); // assetId -> {times:[], urls:[]}
const pending = new Map();

export async function filmstrip(media, assetId, count = 12) {
  if (cache.has(assetId)) return cache.get(assetId);
  if (pending.has(assetId)) return pending.get(assetId);
  const p = (async () => {
    const v = media.getVideo(assetId, 'thumbs');
    if (!v) return null;
    if (v.readyState < 1) await new Promise((r) => { v.onloadedmetadata = r; setTimeout(r, 3000); });
    const dur = v.duration || 1;
    const h = 54, w = Math.round((h * (v.videoWidth || 16)) / (v.videoHeight || 9));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    const out = { times: [], urls: [], aspect: w / h };
    for (let i = 0; i < count; i++) {
      const t = (dur * (i + 0.5)) / count;
      await media.seekVideo(v, t);
      ctx.drawImage(v, 0, 0, w, h);
      out.times.push(t);
      out.urls.push(c.toDataURL('image/jpeg', 0.6));
    }
    cache.set(assetId, out);
    pending.delete(assetId);
    return out;
  })();
  pending.set(assetId, p);
  return p;
}

export function cachedFilmstrip(assetId) { return cache.get(assetId) || null; }
