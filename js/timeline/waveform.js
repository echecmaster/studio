// Forme d'onde audio dans les clips (pics calculés une fois par asset, mis en cache)
const cache = new Map();

export function drawWaveform(canvas, analysis, clip, pxPerSec, color = '#E0A526') {
  const buf = analysis.media?.getAudio(clip.props.assetId);
  if (!buf) return false;
  const key = clip.props.assetId;
  let peaks = cache.get(key);
  if (!peaks) { peaks = analysis.peaks(key, Math.min(20000, Math.ceil(buf.duration * 200))); cache.set(key, peaks); }
  const w = Math.max(1, Math.round(canvas.clientWidth || clip.duration * pxPerSec)), h = Math.max(1, canvas.clientHeight || 30);
  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.min(16000, w * dpr); canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(canvas.width / w, dpr);
  ctx.fillStyle = color;
  const perSec = peaks.length / buf.duration;
  const vol = clip.props.volume ?? 1;
  for (let x = 0; x < w; x++) {
    const lt = (x / w) * clip.duration;
    let src = (clip.inPoint || 0) + lt * (clip.speed || 1);
    if (clip.reverse) src = (clip.inPoint || 0) + (clip.duration - lt) * (clip.speed || 1);
    if (clip.props.loop) src %= buf.duration;
    const i = Math.floor(src * perSec);
    const v = Math.min(1, (peaks[i] || 0) * vol);
    const bh = Math.max(1, v * h * 0.9);
    ctx.fillRect(x, (h - bh) / 2, 1, bh);
  }
  return true;
}

export function clearWaveformCache(assetId) { if (assetId) cache.delete(assetId); else cache.clear(); }
