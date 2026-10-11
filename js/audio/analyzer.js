// Analyse audio hors-ligne (déterministe) : amplitude RMS et 16 bandes de fréquences, 60 trames/s.
// Utilisée par l'audio-réactivité, les expressions audio.* et le visualiseur — identique en preview et à l'export.
import { visibleClipsAt, isActiveAt, clipSourceTime } from '../core/evaluate.js';

const RATE = 60;
const FFT = 1024;
export const BANDS = 16;

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
        const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
}

export function analyzeBuffer(buf) {
  const sr = buf.sampleRate;
  const ch = buf.numberOfChannels;
  const len = buf.length;
  const mono = new Float32Array(len);
  for (let c = 0; c < ch; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) mono[i] += d[i] / ch; }
  const frames = Math.ceil((len / sr) * RATE);
  const amp = new Float32Array(frames);
  const bands = new Float32Array(frames * BANDS);
  const wave = mono;
  const re = new Float64Array(FFT), im = new Float64Array(FFT);
  const win = new Float64Array(FFT).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FFT - 1)));
  // bornes de bandes logarithmiques 40 Hz → 16 kHz
  const edges = Array.from({ length: BANDS + 1 }, (_, i) => Math.round((40 * Math.pow(16000 / 40, i / BANDS) * FFT) / sr));
  let maxAmp = 1e-6;
  const maxBand = new Float32Array(BANDS).fill(1e-6);
  for (let f = 0; f < frames; f++) {
    const center = Math.floor((f / RATE) * sr);
    let sum = 0;
    for (let i = 0; i < FFT; i++) {
      const idx = center - FFT / 2 + i;
      const v = idx >= 0 && idx < len ? mono[idx] : 0;
      sum += v * v;
      re[i] = v * win[i]; im[i] = 0;
    }
    amp[f] = Math.sqrt(sum / FFT);
    maxAmp = Math.max(maxAmp, amp[f]);
    fft(re, im);
    for (let b = 0; b < BANDS; b++) {
      let s = 0;
      const lo = Math.max(1, edges[b]), hi = Math.max(lo + 1, edges[b + 1]);
      for (let k = lo; k < hi && k < FFT / 2; k++) s += Math.hypot(re[k], im[k]);
      const v = Math.log10(1 + s / (hi - lo));
      bands[f * BANDS + b] = v;
      maxBand[b] = Math.max(maxBand[b], v);
    }
  }
  for (let f = 0; f < frames; f++) {
    amp[f] /= maxAmp;
    for (let b = 0; b < BANDS; b++) bands[f * BANDS + b] /= maxBand[b];
  }
  return { rate: RATE, frames, amp, bands, wave, sampleRate: sr, duration: len / sr };
}

export class AudioAnalysis {
  constructor(media) { this.media = media; this.cache = new Map(); this.project = null; }

  get(assetId) {
    if (this.cache.has(assetId)) return this.cache.get(assetId);
    const buf = this.media?.getAudio(assetId);
    if (!buf) return null;
    const a = analyzeBuffer(buf);
    this.cache.set(assetId, a);
    return a;
  }

  // valeur lissée (moyenne pondérée exponentielle sur les trames passées → sans état)
  value(a, srcT, band, smoothing = 0.5) {
    const f = Math.floor(srcT * a.rate);
    const k = Math.max(1, Math.round(1 + smoothing * 12));
    let s = 0, w = 0;
    for (let i = 0; i < k; i++) {
      const fi = f - i;
      if (fi < 0 || fi >= a.frames) continue;
      const wt = Math.pow(smoothing, i);
      s += (band === 'amplitude' || band === undefined || band === null ? a.amp[fi] : a.bands[fi * BANDS + Math.max(0, Math.min(BANDS - 1, Math.round(band)))]) * wt;
      w += wt;
    }
    return w ? s / w : 0;
  }

  // Source audio active à t : asset donné, ou premier clip audio audible
  locate(assetId, t) {
    const p = this.project;
    if (!p) return null;
    const candidates = p.clips.filter((c) => (c.kind === 'audio' || c.kind === 'video') && isActiveAt(c, t) && (!assetId || c.props.assetId === assetId));
    const c = candidates[0];
    if (c) return { a: this.get(c.props.assetId), srcT: clipSourceTime(c, t - c.start) };
    if (assetId) { const a = this.get(assetId); return a ? { a, srcT: t } : null; }
    return null;
  }

  forProject(project) {
    this.project = project;
    return this;
  }

  sample(assetId, t, band, smoothing) {
    const L = this.locate(assetId, t);
    if (!L?.a) return 0;
    return this.value(L.a, L.srcT, band, smoothing);
  }

  spectrum(assetId, t, n, smoothing = 0.5) {
    const L = this.locate(assetId, t);
    if (!L?.a) return new Array(n).fill(0);
    const out = [];
    for (let i = 0; i < n; i++) {
      const pos = (i / Math.max(1, n - 1)) * (BANDS - 1);
      const b0 = Math.floor(pos), b1 = Math.min(BANDS - 1, b0 + 1);
      const v0 = this.value(L.a, L.srcT, b0, smoothing), v1 = this.value(L.a, L.srcT, b1, smoothing);
      out.push(v0 + (v1 - v0) * (pos - b0));
    }
    return out;
  }

  waveform(assetId, t, n) {
    const L = this.locate(assetId, t);
    if (!L?.a) return new Array(n).fill(0);
    const sr = L.a.sampleRate, start = Math.floor(L.srcT * sr), span = Math.floor(sr / 30);
    const out = [];
    for (let i = 0; i < n; i++) { const idx = start + Math.floor((i / n) * span); out.push(L.a.wave[idx] || 0); }
    return out;
  }

  // Pics pour l'affichage de forme d'onde dans la timeline
  peaks(assetId, buckets) {
    const buf = this.media?.getAudio(assetId);
    if (!buf) return null;
    const d = buf.getChannelData(0);
    const per = Math.max(1, Math.floor(d.length / buckets));
    const out = new Float32Array(buckets);
    for (let b = 0; b < buckets; b++) { let m = 0; for (let i = b * per; i < (b + 1) * per && i < d.length; i += 8) m = Math.max(m, Math.abs(d[i])); out[b] = m; }
    return out;
  }
}

export { visibleClipsAt };
