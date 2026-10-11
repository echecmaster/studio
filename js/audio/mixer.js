// Mixage audio : lecture synchronisée en preview (AudioContext) et rendu hors-ligne pour l'export (OfflineAudioContext)
import { trackVisibility, evalKeys } from '../core/evaluate.js';

const reversedCache = new WeakMap();
function reversed(ctx, buf) {
  if (reversedCache.has(buf)) return reversedCache.get(buf);
  const r = ctx.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
  for (let c = 0; c < buf.numberOfChannels; c++) { const s = buf.getChannelData(c), d = r.getChannelData(c); for (let i = 0, n = s.length; i < n; i++) d[i] = s[n - 1 - i]; }
  reversedCache.set(buf, r);
  return r;
}

function gainAt(clip, lt) {
  const p = clip.props;
  let v = clip.keyframes?.['props.volume']?.length ? evalKeys(clip.keyframes['props.volume'], lt) : (p.volume ?? 1);
  if (p.fadeIn > 0 && lt < p.fadeIn) v *= lt / p.fadeIn;
  if (p.fadeOut > 0 && lt > clip.duration - p.fadeOut) v *= Math.max(0, (clip.duration - lt) / p.fadeOut);
  // fondus liés aux transitions vidéo (le son suit l'image)
  if (clip.transitionIn && lt < clip.transitionIn.duration) v *= lt / clip.transitionIn.duration;
  if (clip.transitionOut && lt > clip.duration - clip.transitionOut.duration) v *= Math.max(0, (clip.duration - lt) / clip.transitionOut.duration);
  return Math.max(0, v);
}

// Programme toutes les sources audio du projet entre fromT et toT (temps composition), démarrage à ctxTime
export function scheduleAudio(ctx, dest, project, media, fromT, toT, ctxTime, rate = 1) {
  const vis = trackVisibility(project);
  const nodes = [];
  for (const clip of project.clips) {
    if (clip.kind !== 'audio' && clip.kind !== 'video') continue;
    if (clip.props.muted || !vis[clip.trackId]?.audible) continue;
    let buf = media.getAudio(clip.props.assetId);
    if (!buf) continue;
    const c0 = Math.max(clip.start, fromT), c1 = Math.min(clip.start + clip.duration, toT);
    if (c1 <= c0) continue;
    const speed = (clip.speed || 1) * rate;
    if (clip.reverse) buf = reversed(ctx, buf);
    const lt0 = c0 - clip.start;
    let offset = clip.reverse ? buf.duration - ((clip.inPoint || 0) + (clip.duration - lt0) * (clip.speed || 1)) : (clip.inPoint || 0) + lt0 * (clip.speed || 1);
    if (clip.props.loop && buf.duration) offset %= buf.duration;
    if (offset < 0 || offset >= buf.duration) continue;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = speed;
    if (clip.props.loop) src.loop = true;
    const g = ctx.createGain();
    const when = ctxTime + (c0 - fromT) / rate;
    const dur = (c1 - c0) / rate;
    const N = Math.max(2, Math.ceil(dur * 100));
    const curve = new Float32Array(N);
    for (let i = 0; i < N; i++) curve[i] = gainAt(clip, lt0 + ((c1 - c0) * i) / (N - 1));
    try { g.gain.setValueCurveAtTime(curve, when, Math.max(0.001, dur)); } catch { g.gain.value = curve[0]; }
    let node = g;
    if (clip.props.pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = clip.props.pan; g.connect(p); node = p; }
    node.connect(dest);
    src.connect(g);
    src.start(when, offset, clip.props.loop ? undefined : Math.min(buf.duration - offset, (c1 - c0) * (clip.speed || 1)));
    if (clip.props.loop) src.stop(when + dur);
    nodes.push(src);
  }
  return nodes;
}

export class PreviewMixer {
  constructor(media) { this.media = media; this.nodes = []; this.master = null; }
  get ctx() { return this.media.getAudioContext(); }
  start(project, t, rate = 1) {
    this.stop();
    if (rate <= 0) return;
    const ctx = this.ctx;
    if (ctx.state === 'suspended') ctx.resume();
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.nodes = scheduleAudio(ctx, this.master, project, this.media, t, project.meta.duration, ctx.currentTime + 0.03, rate);
    this.startedAt = ctx.currentTime + 0.03;
    this.startT = t;
  }
  stop() {
    for (const n of this.nodes) { try { n.stop(); } catch { /* */ } n.disconnect(); }
    this.nodes = [];
    this.master?.disconnect();
    this.master = null;
  }
}

// Rendu hors-ligne de la plage [start, end] → AudioBuffer (export)
export async function renderMix(project, media, start, end, sampleRate = 48000) {
  const len = Math.max(1, Math.ceil((end - start) * sampleRate));
  const ctx = new OfflineAudioContext(2, len, sampleRate);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -1; comp.ratio.value = 20; comp.attack.value = 0.001; comp.release.value = 0.05;
  comp.connect(ctx.destination);
  const n = scheduleAudio(ctx, comp, project, media, start, end, 0, 1);
  if (!n.length) return null;
  return ctx.startRendering();
}

export function projectHasAudio(project, media) {
  return project.clips.some((c) => (c.kind === 'audio' || c.kind === 'video') && !c.props.muted && media.getAudio(c.props.assetId));
}
