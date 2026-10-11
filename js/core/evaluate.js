// Évaluation pure d'un projet à un instant t : keyframes, expressions, audio-réactivité, temps des clips.
import { getEasing } from '../catalog/easings.js';
import { lerpValue, getPath, setPath, deepClone } from './util.js';
import { runExpression, expressionSeed } from './expressions.js';
import { flattenPath, pointAt } from './path.js';

const pathCache = new Map();
function cachedFlatten(mp) {
  const key = JSON.stringify([mp.points, mp.closed]);
  if (!pathCache.has(key)) { pathCache.set(key, flattenPath(mp.points, mp.closed, 32)); if (pathCache.size > 200) pathCache.delete(pathCache.keys().next().value); }
  return pathCache.get(key);
}

export function evalKeys(keys, t) {
  if (!keys || !keys.length) return undefined;
  if (keys.length === 1 || t <= keys[0].t) return keys[0].v;
  const last = keys[keys.length - 1];
  if (t >= last.t) return last.v;
  let i = 0;
  // recherche binaire
  let lo = 0, hi = keys.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (keys[mid].t <= t) { i = mid; lo = mid + 1; } else hi = mid - 1;
  }
  const a = keys[i], b = keys[i + 1];
  if (a.hold || a.easing === 'hold') return a.v;
  const span = b.t - a.t || 1e-6;
  const u = (t - a.t) / span;
  const e = getEasing(a.easing || 'linear', a.bezier, a.spring, span)(u);
  return lerpValue(a.v, b.v, e);
}

export function sortedTracks(project) {
  return [...project.tracks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

// temps local du clip (base des keyframes) : 0 au début du clip
export const clipLocalTime = (clip, t) => t - clip.start;

// temps "source" (médias, générateurs, animateurs) avec vitesse, inversion, time remap
export function clipSourceTime(clip, localT) {
  if (clip.timeRemap && clip.timeRemap.enabled && clip.timeRemap.keys?.length) {
    return Math.max(0, evalKeys(clip.timeRemap.keys, localT));
  }
  let s = localT * (clip.speed || 1);
  if (clip.reverse) s = clip.duration * (clip.speed || 1) - s;
  return (clip.inPoint || 0) + Math.max(0, s);
}

export function isActiveAt(clip, t) {
  return t >= clip.start - 1e-9 && t < clip.start + clip.duration - 1e-9;
}

export function trackVisibility(project) {
  const anySolo = project.tracks.some((t) => t.solo);
  const vis = {};
  for (const t of project.tracks) vis[t.id] = { visible: !t.hidden && (!anySolo || t.solo), audible: !t.muted && (!anySolo || t.solo) };
  return vis;
}

// Liste des clips visibles à t, du plus bas au plus haut (ordre de composition)
export function visibleClipsAt(project, t, { includeHidden = false } = {}) {
  const vis = trackVisibility(project);
  const order = sortedTracks(project);
  const out = [];
  for (let ti = order.length - 1; ti >= 0; ti--) {
    const tr = order[ti];
    if (!includeHidden && !vis[tr.id]?.visible) continue;
    const clips = project.clips.filter((c) => c.trackId === tr.id && isActiveAt(c, t)).sort((a, b) => a.start - b.start);
    out.push(...clips);
  }
  return out;
}

// Résout toutes les valeurs animées d'un clip à l'instant t (composition)
export function resolveClip(clip, t, env = {}) {
  const localT = clipLocalTime(clip, t);
  const r = deepClone(clip);
  r.localTime = localT;
  r.sourceTime = clipSourceTime(clip, localT);
  for (const [path, keys] of Object.entries(clip.keyframes || {})) {
    if (!keys?.length) continue;
    try { setPath(r, path, evalKeys(keys, localT)); } catch { /* chemin devenu invalide (effet supprimé) */ }
  }
  if (clip.motionPath && clip.motionPath.points?.length > 1) {
    const mp = clip.motionPath;
    const t0 = mp.start ?? 0, t1 = mp.end ?? clip.duration;
    const u = getEasing(mp.easing || 'easeInOutCubic')(Math.max(0, Math.min(1, (localT - t0) / ((t1 - t0) || 1))));
    const pt = pointAt(cachedFlatten(mp), u);
    r.transform.x = pt.x;
    r.transform.y = pt.y;
    if (mp.autoOrient) r.transform.rotation = (r.transform.rotation || 0) + pt.angle + (mp.rotationOffset || 0);
  }
  for (const [path, link] of Object.entries(clip.audioLinks || {})) {
    if (!env.audio) break;
    const base = getPath(r, path);
    if (typeof base !== 'number') continue;
    const v = env.audio.sample(link.assetId || null, t, link.band ?? 'amplitude', link.smoothing ?? 0.5);
    const amount = v * (link.gain ?? 1);
    setPath(r, path, link.mode === 'multiply' ? base * (1 + amount) : base + amount * (link.range ?? 100));
  }
  for (const [path, code] of Object.entries(clip.expressions || {})) {
    if (!code) continue;
    try {
      const value = getPath(r, path);
      const keys = clip.keyframes?.[path];
      const out = runExpression(code, {
        value,
        time: localT,
        keys,
        valueAtTime: (tt) => (keys?.length ? evalKeys(keys, tt) : value),
        index: env.index ?? 0,
        seed: expressionSeed(clip.id, path),
        comp: env.comp,
        thisLayer: { name: clip.name, transform: r.transform, props: r.props, start: clip.start, duration: clip.duration },
        layer: env.layer,
        control: env.control,
        audio: env.audio ? { amplitude: env.audio.sample(null, t, 'amplitude', 0.5), band: (i) => env.audio.sample(null, t, i, 0.5) } : undefined,
      });
      setPath(r, path, out);
      if (r.expressionErrors) delete r.expressionErrors[path];
    } catch (e) {
      r.expressionErrors = { ...(r.expressionErrors || {}), [path]: e.message };
      env.onExpressionError?.(clip, path, e);
    }
  }
  return r;
}

// Valeurs résolues (sans expressions) d'un clip par nom — utilisé par thisComp.layer("Nom") (pas de récursion)
export function makeLayerLookup(project, t) {
  return (name) => {
    const c = project.clips.find((x) => x.name === name || x.id === name);
    if (!c) return null;
    const r = deepClone(c);
    for (const [path, keys] of Object.entries(c.keyframes || {})) { try { setPath(r, path, evalKeys(keys, t - c.start)); } catch { /* */ } }
    return { name: r.name, transform: r.transform, props: r.props, start: r.start, duration: r.duration };
  };
}

// Résumé textuel d'une scène à l'instant t (pour project.describe / IA)
export function describeAt(project, t) {
  const clips = visibleClipsAt(project, t);
  const lines = [`Composition ${project.meta.width}×${project.meta.height} @${project.meta.fps} i/s, durée ${project.meta.duration}s, fond ${project.meta.background}. Instant t=${t.toFixed(2)}s.`];
  if (!clips.length) lines.push('Aucun calque visible à cet instant.');
  const env = { comp: project.meta };
  clips.slice().reverse().forEach((c, i) => {
    const r = resolveClip(c, t, env);
    const tr = r.transform;
    let what = c.kind;
    if (c.kind === 'text') what = `texte « ${String(r.props.text).slice(0, 60)} » (${r.props.fontFamily} ${r.props.fontSize}px, ${r.props.color})`;
    else if (c.kind === 'shape') what = `forme ${r.props.shape} ${r.props.width}×${r.props.height} (${r.props.fill?.enabled === false ? 'sans remplissage' : r.props.fill?.color})`;
    else if (c.kind === 'generator') what = `générateur ${r.props.type}`;
    else if (c.kind === 'particles') what = `particules ${r.props.preset}`;
    else if (['image', 'video', 'audio', 'svg', 'lottie'].includes(c.kind)) what = `${c.kind} (${project.assets.find((a) => a.id === r.props.assetId)?.name || 'asset manquant'})`;
    const fx = (c.effects || []).filter((e) => e.enabled).map((e) => e.type);
    lines.push(`${i + 1}. [${c.id}] "${c.name}" : ${what} — position (${Math.round(tr.x)}, ${Math.round(tr.y)}), échelle ${(+tr.scale).toFixed(2)}, rotation ${Math.round(tr.rotation)}°, opacité ${(+tr.opacity).toFixed(2)}${c.blendMode !== 'normal' ? `, fusion ${c.blendMode}` : ''}${fx.length ? `, effets : ${fx.join(', ')}` : ''}${c.transitionIn ? `, transition entrée ${c.transitionIn.type}` : ''}${c.transitionOut ? `, transition sortie ${c.transitionOut.type}` : ''} — clip ${c.start.toFixed(2)}s → ${(c.start + c.duration).toFixed(2)}s`);
  });
  return lines.join('\n');
}

// Valeur d'un contrôle exposé par un calque nul (panneau "Contrôles") : control("Nom")
export function makeControlLookup(project, t) {
  return (name) => {
    for (const c of project.clips) {
      if (c.kind !== 'null') continue;
      const ctl = (c.props.controls || []).find((x) => x.name === name || x.id === name);
      if (ctl) {
        const keys = c.keyframes?.[`props.controls.${ctl.id}.value`];
        return keys?.length ? evalKeys(keys, t - c.start) : ctl.value;
      }
    }
    return 0;
  };
}
