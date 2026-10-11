// Bruitages synthétiques générés par Web Audio (OfflineAudioContext) — aucun fichier externe.
export async function synthSfx(type, duration) {
  const sr = 48000;
  const d = Math.max(0.05, duration || { whoosh: 0.8, pop: 0.15, click: 0.05, riser: 2.5, impact: 1.2, swoosh: 0.5, ding: 1.2, glitch: 0.6, beep: 0.3, drum: 0.5, bass: 1, sparkle: 1 }[type] || 0.5);
  const ctx = new OfflineAudioContext(2, Math.ceil(sr * d), sr);
  const out = ctx.createGain();
  out.connect(ctx.destination);
  const noise = () => {
    const b = ctx.createBuffer(1, Math.ceil(sr * d), sr);
    const data = b.getChannelData(0);
    let seed = 1234567;
    for (let i = 0; i < data.length; i++) { seed = (seed * 16807) % 2147483647; data[i] = (seed / 2147483647) * 2 - 1; }
    const s = ctx.createBufferSource(); s.buffer = b; return s;
  };
  const osc = (wave, f0) => { const o = ctx.createOscillator(); o.type = wave; o.frequency.value = f0; return o; };
  const env = (g, a, peak, rel) => { g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(peak, a); g.gain.exponentialRampToValueAtTime(0.0001, Math.max(a + 0.01, rel)); };
  switch (type) {
    case 'whoosh': case 'swoosh': {
      const n = noise(); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = type === 'whoosh' ? 1.2 : 3;
      f.frequency.setValueAtTime(300, 0); f.frequency.exponentialRampToValueAtTime(type === 'whoosh' ? 4000 : 6000, d * 0.6); f.frequency.exponentialRampToValueAtTime(500, d);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(0.9, d * 0.55); g.gain.linearRampToValueAtTime(0, d);
      const pan = ctx.createStereoPanner(); pan.pan.setValueAtTime(-0.8, 0); pan.pan.linearRampToValueAtTime(0.8, d);
      n.connect(f).connect(g).connect(pan).connect(out); n.start(); break;
    }
    case 'pop': { const o = osc('sine', 900); o.frequency.exponentialRampToValueAtTime(180, d); const g = ctx.createGain(); env(g, 0.003, 0.9, d); o.connect(g).connect(out); o.start(); break; }
    case 'click': { const n = noise(); const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2000; const g = ctx.createGain(); env(g, 0.001, 1, d); n.connect(f).connect(g).connect(out); n.start(); break; }
    case 'riser': {
      const o = osc('sawtooth', 120); o.frequency.exponentialRampToValueAtTime(1800, d);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(400, 0); f.frequency.exponentialRampToValueAtTime(9000, d);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.001, 0); g.gain.exponentialRampToValueAtTime(0.5, d * 0.95); g.gain.linearRampToValueAtTime(0, d);
      const n = noise(); const ng = ctx.createGain(); ng.gain.setValueAtTime(0, 0); ng.gain.linearRampToValueAtTime(0.25, d);
      o.connect(f).connect(g).connect(out); n.connect(ng).connect(out); o.start(); n.start(); break;
    }
    case 'impact': case 'drum': {
      const o = osc('sine', type === 'impact' ? 120 : 160); o.frequency.exponentialRampToValueAtTime(type === 'impact' ? 35 : 50, d * 0.5);
      const g = ctx.createGain(); env(g, 0.002, 1, d);
      const n = noise(); const nf = ctx.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = type === 'impact' ? 1500 : 4000; const ng = ctx.createGain(); env(ng, 0.001, 0.6, d * 0.4);
      const comp = ctx.createDynamicsCompressor();
      o.connect(g).connect(comp); n.connect(nf).connect(ng).connect(comp); comp.connect(out); o.start(); n.start(); break;
    }
    case 'ding': { [880, 1760, 2640].forEach((fq, i) => { const o = osc('sine', fq); const g = ctx.createGain(); env(g, 0.005, 0.5 / (i + 1), d); o.connect(g).connect(out); o.start(); }); break; }
    case 'glitch': {
      const o = osc('square', 220); const g = ctx.createGain(); g.gain.value = 0;
      for (let t = 0; t < d; t += 0.04) { g.gain.setValueAtTime(((Math.sin(t * 977) + 1) / 2) > 0.4 ? 0.4 : 0, t); o.frequency.setValueAtTime(100 + ((Math.sin(t * 431) + 1) / 2) * 1500, t); }
      o.connect(g).connect(out); o.start(); break;
    }
    case 'beep': { const o = osc('sine', 1000); const g = ctx.createGain(); g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(0.5, 0.01); g.gain.setValueAtTime(0.5, d - 0.02); g.gain.linearRampToValueAtTime(0, d); o.connect(g).connect(out); o.start(); break; }
    case 'bass': { const o = osc('sawtooth', 55); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(800, 0); f.frequency.exponentialRampToValueAtTime(120, d); const g = ctx.createGain(); env(g, 0.01, 0.7, d); o.connect(f).connect(g).connect(out); o.start(); break; }
    case 'sparkle': { for (let i = 0; i < 14; i++) { const t0 = (i / 14) * d * 0.8; const o = osc('sine', 2000 + ((i * 733) % 3000)); const g = ctx.createGain(); g.gain.setValueAtTime(0, 0); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.25, t0 + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25); o.connect(g).connect(out); o.start(); } break; }
    default: throw new Error(`Type de bruitage inconnu : ${type}`);
  }
  return ctx.startRendering();
}

export function audioBufferToWav(buf) {
  const ch = buf.numberOfChannels, sr = buf.sampleRate, len = buf.length;
  const data = new DataView(new ArrayBuffer(44 + len * ch * 2));
  const w = (o, s) => [...s].forEach((c, i) => data.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); data.setUint32(4, 36 + len * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, ch, true); data.setUint32(24, sr, true);
  data.setUint32(28, sr * ch * 2, true); data.setUint16(32, ch * 2, true); data.setUint16(34, 16, true); w(36, 'data'); data.setUint32(40, len * ch * 2, true);
  const chans = Array.from({ length: ch }, (_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, chans[c][i])); data.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2; }
  return new Blob([data.buffer], { type: 'audio/wav' });
}
