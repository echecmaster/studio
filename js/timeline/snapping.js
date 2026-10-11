// Magnétisme de la timeline : tête de lecture, bords de clips, marqueurs, grille, début/fin
export function snapTargets(project, app, { exclude = [] } = {}) {
  const s = app.snap;
  const out = [];
  if (!s.enabled) return out;
  if (s.playhead) out.push({ t: app.time, kind: 'playhead' });
  if (s.bounds) out.push({ t: 0, kind: 'bounds' }, { t: project.meta.duration, kind: 'bounds' }, { t: project.workArea.in, kind: 'bounds' }, { t: project.workArea.out, kind: 'bounds' });
  if (s.clips) for (const c of project.clips) if (!exclude.includes(c.id)) out.push({ t: c.start, kind: 'clip' }, { t: c.start + c.duration, kind: 'clip' });
  if (s.markers) for (const m of project.markers) out.push({ t: m.t, kind: 'marker' });
  if (s.grid) { const step = 1; for (let t = 0; t <= project.meta.duration; t += step) out.push({ t, kind: 'grid' }); }
  return out;
}

// Renvoie {t, target} : t aimanté si une cible est à moins de thresholdSec d'un des points candidats (début/fin)
export function snapTime(points, targets, thresholdSec) {
  let best = null;
  for (const p of points) for (const tg of targets) {
    const d = tg.t - p;
    if (Math.abs(d) <= thresholdSec && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, target: tg };
  }
  return best;
}

export function snapFrame(t, fps) { return Math.round(t * fps) / fps; }
