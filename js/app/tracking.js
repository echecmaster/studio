// Suivi de point par correspondance de motif (SAD) sur les images d'une vidéo importée
export async function trackPoints(media, project, clip, a) {
  const v = media.getVideo(clip.props.assetId, 'tracking');
  if (!v) throw new Error('Vidéo non chargée.');
  const fps = project.meta.fps;
  const W = project.meta.width, H = project.meta.height;
  // repère composition → repère vidéo (on suppose la vidéo ajustée par "contain" centrée, sans transformation)
  const vw = v.videoWidth, vh = v.videoHeight;
  const fit = Math.min(W / vw, H / vh) * (clip.transform.scale || 1);
  const toVid = (x, y) => [(x - clip.transform.x) / fit + vw / 2, (y - clip.transform.y) / fit + vh / 2];
  const toComp = (x, y) => [(x - vw / 2) * fit + clip.transform.x, (y - vh / 2) * fit + clip.transform.y];
  const work = 480 / Math.max(vw, vh);
  const cw = Math.round(vw * work), ch = Math.round(vh * work);
  const cnv = new OffscreenCanvas(cw, ch);
  const ctx = cnv.getContext('2d', { willReadFrequently: true });
  const size = Math.max(6, Math.round(((a.size || 40) / fit) * work));
  const search = Math.max(size, Math.round(((a.search || 80) / fit) * work));
  const start = Math.max(clip.start, a.start ?? clip.start), end = Math.min(clip.start + clip.duration, a.end ?? clip.start + clip.duration);
  const pts = [[a.x, a.y]];
  if (a.x2 !== undefined && a.y2 !== undefined) pts.push([a.x2, a.y2]);
  let cur = pts.map(([x, y]) => toVid(x, y).map((c) => c * work));
  const gray = (img) => { const g = new Float32Array(cw * ch); for (let i = 0; i < g.length; i++) g[i] = img[i * 4] * 0.3 + img[i * 4 + 1] * 0.59 + img[i * 4 + 2] * 0.11; return g; };
  const patch = (g, cx, cy) => { const p = new Float32Array(size * size); const x0 = Math.round(cx - size / 2), y0 = Math.round(cy - size / 2); for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const xx = Math.min(cw - 1, Math.max(0, x0 + x)), yy = Math.min(ch - 1, Math.max(0, y0 + y)); p[y * size + x] = g[yy * cw + xx]; } return p; };
  const samples = [];
  let templates = null;
  let conf = 0, n = 0;
  for (let t = start; t < end; t += 1 / fps) {
    const src = (clip.inPoint || 0) + (t - clip.start) * (clip.speed || 1);
    await media.seekVideo(v, src);
    ctx.drawImage(v, 0, 0, cw, ch);
    const g = gray(ctx.getImageData(0, 0, cw, ch).data);
    if (!templates) templates = cur.map(([x, y]) => patch(g, x, y));
    else {
      cur = cur.map(([px, py], k) => {
        let best = Infinity, bx = px, by = py;
        const tpl = templates[k];
        for (let dy = -search / 2; dy <= search / 2; dy += 2) for (let dx = -search / 2; dx <= search / 2; dx += 2) {
          const cx = px + dx, cy = py + dy;
          let sad = 0;
          const x0 = Math.round(cx - size / 2), y0 = Math.round(cy - size / 2);
          for (let y = 0; y < size && sad < best; y += 2) for (let x = 0; x < size; x += 2) { const xx = Math.min(cw - 1, Math.max(0, x0 + x)), yy = Math.min(ch - 1, Math.max(0, y0 + y)); sad += Math.abs(g[yy * cw + xx] - tpl[y * size + x]); }
          if (sad < best) { best = sad; bx = cx; by = cy; }
        }
        // affinage ±1 px
        conf += 1 / (1 + best / (size * size)); n++;
        return [bx, by];
      });
      // mise à jour lente du motif (robustesse aux variations)
      templates = templates.map((tpl, k) => { const np = patch(g, cur[k][0], cur[k][1]); return tpl.map((v0, i) => v0 * 0.85 + np[i] * 0.15); });
    }
    const [c0x, c0y] = toComp(cur[0][0] / work, cur[0][1] / work);
    const s = { t: +t.toFixed(4), x: +c0x.toFixed(2), y: +c0y.toFixed(2) };
    if (cur[1]) {
      const [c1x, c1y] = toComp(cur[1][0] / work, cur[1][1] / work);
      s.scale = Math.hypot(c1x - c0x, c1y - c0y);
      s.rotation = (Math.atan2(c1y - c0y, c1x - c0x) * 180) / Math.PI;
    }
    samples.push(s);
    if (samples.length > 3000) break;
  }
  return { samples, confidence: n ? +(conf / n).toFixed(3) : 1 };
}
