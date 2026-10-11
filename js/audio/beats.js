// Détection de beats par flux spectral (onsets) + estimation du tempo
import { analyzeBuffer, BANDS } from './analyzer.js';

export function detectBeats(buffer, { sensitivity = 0.5, minInterval = 0.25 } = {}) {
  const a = analyzeBuffer(buffer);
  const flux = new Float32Array(a.frames);
  for (let f = 1; f < a.frames; f++) {
    let s = 0;
    for (let b = 0; b < 6; b++) { const d = a.bands[f * BANDS + b] - a.bands[(f - 1) * BANDS + b]; if (d > 0) s += d * (b < 3 ? 1.5 : 1); }
    flux[f] = s;
  }
  const win = Math.round(a.rate * 0.5);
  const k = 1.2 + (1 - sensitivity) * 1.5;
  const beats = [];
  let last = -Infinity;
  for (let f = 1; f < a.frames - 1; f++) {
    let mean = 0, n = 0;
    for (let i = Math.max(0, f - win); i < Math.min(a.frames, f + win); i++) { mean += flux[i]; n++; }
    mean /= n || 1;
    const t = f / a.rate;
    if (flux[f] > mean * k && flux[f] >= flux[f - 1] && flux[f] >= flux[f + 1] && flux[f] > 0.02 && t - last >= minInterval) { beats.push(+t.toFixed(4)); last = t; }
  }
  // tempo : histogramme des intervalles
  const hist = new Map();
  for (let i = 1; i < beats.length; i++) {
    let iv = beats[i] - beats[i - 1];
    while (iv < 0.3) iv *= 2;
    while (iv > 1) iv /= 2;
    const bpm = Math.round(60 / iv);
    hist.set(bpm, (hist.get(bpm) || 0) + 1);
  }
  const bpm = [...hist.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] || null;
  return { beats, bpm };
}
