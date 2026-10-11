// Horloge de lecture : temps piloté par requestAnimationFrame (synchronisé sur l'horloge audio quand du son joue)
import { PreviewMixer } from '../audio/mixer.js';

export class Playback {
  constructor(app) {
    this.app = app;
    this.mixer = new PreviewMixer(app.media);
    this.raf = 0;
    app.bus.app.subscribe((s, prev) => {
      if (s.playing !== prev.playing || (s.playing && s.rate !== prev.rate)) { if (s.playing) this.start(); else this.stop(); }
      else if (s.playing && Math.abs(s.time - this.expected) > 0.05) this.start(); // seek pendant la lecture
    });
    app.bus.on('change', () => { if (this.app.bus.app.get().playing) this.restartAudioSoon(); });
  }

  range() {
    const p = this.app.bus.project.get();
    const s = this.app.bus.app.get();
    const wa = p.workArea;
    const useWA = s.loop && wa.out - wa.in > 0.05 && !(wa.in === 0 && wa.out >= p.meta.duration);
    return useWA ? [wa.in, wa.out] : [0, p.meta.duration];
  }

  start() {
    cancelAnimationFrame(this.raf);
    const st = this.app.bus.app.get();
    const [a, b] = this.range();
    let t = st.time;
    if (st.rate > 0 && t >= b - 1e-3) t = a;
    if (st.rate < 0 && t <= a + 1e-3) t = b;
    this.t0 = t;
    this.wall = performance.now();
    this.rate = st.rate || 1;
    this.expected = t;
    this.mixer.start(this.app.bus.project.get(), t, this.rate);
    const tick = () => {
      const s = this.app.bus.app.get();
      if (!s.playing) return;
      const [ra, rb] = this.range();
      let tt = this.t0 + ((performance.now() - this.wall) / 1000) * this.rate;
      if (this.rate > 0 && tt >= rb) {
        if (s.loop) { this.t0 = ra; this.wall = performance.now(); tt = ra; this.mixer.start(this.app.bus.project.get(), ra, this.rate); }
        else { tt = rb - 1 / this.app.bus.project.get().meta.fps; this.expected = tt; this.app.bus.app.patch({ time: tt, playing: false }); return; }
      }
      if (this.rate < 0 && tt <= ra) {
        if (s.loop) { this.t0 = rb; this.wall = performance.now(); tt = rb; } else { this.expected = ra; this.app.bus.app.patch({ time: ra, playing: false }); return; }
      }
      this.expected = tt;
      this.app.bus.app.patch({ time: tt }, { playback: true });
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  restartAudioSoon() {
    clearTimeout(this._rs);
    this._rs = setTimeout(() => { if (this.app.bus.app.get().playing) { this.t0 = this.expected; this.wall = performance.now(); this.mixer.start(this.app.bus.project.get(), this.expected, this.rate); } }, 120);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.mixer.stop();
  }
}
