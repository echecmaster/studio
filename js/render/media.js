// Gestionnaire de médias (navigateur) : décodage images/SVG/vidéos/audio/Lottie/polices/LUT, cache et seek déterministe.
import { getBlob } from '../storage/opfs.js';
import { parseCube } from '../catalog/luts.js';

export class MediaManager {
  constructor({ onChange, log } = {}) {
    this.entries = new Map(); // assetId -> {asset, url, blob, image, videos:{}, audio, lottie, lut, status}
    this.onChange = onChange || (() => {});
    this.log = log || ((l, m) => console[l === 'error' ? 'error' : 'log'](m));
    this.audioCtx = null;
    this.svgCache = new Map();
  }

  entry(id) { return this.entries.get(id); }

  // Associe un asset du projet à sa source (blob ou texte inline) et lance le décodage
  async register(asset, blob = null) {
    let e = this.entries.get(asset.id);
    if (e && e.asset.ref === asset.ref && e.status !== 'error' && !blob) { e.asset = asset; return e; }
    if (e) this.release(asset.id);
    e = { asset, status: 'loading', videos: {}, ready: null };
    this.entries.set(asset.id, e);
    e.ready = (async () => {
      try {
        if (asset.ref === 'inline') blob = new Blob([asset.data || ''], { type: asset.mime || 'text/plain' });
        if (!blob) blob = await getBlob(asset.id);
        if (!blob) throw new Error(`Média introuvable dans le stockage local : ${asset.name}`);
        e.blob = blob;
        e.url = URL.createObjectURL(blob);
        await this._decode(e);
        e.status = 'ready';
      } catch (err) {
        e.status = 'error';
        e.error = err.message;
        this.log('error', `Asset "${asset.name}" : ${err.message}`);
      }
      this.onChange(asset.id);
      return e;
    })();
    return e.ready;
  }

  async _decode(e) {
    const a = e.asset;
    switch (a.type) {
      case 'image': {
        const img = new Image();
        img.decoding = 'async';
        img.src = e.url;
        await img.decode();
        e.image = img;
        a.meta = { ...(a.meta || {}), width: img.naturalWidth, height: img.naturalHeight };
        break;
      }
      case 'svg': {
        e.svgText = await e.blob.text();
        const img = new Image();
        img.src = e.url;
        await img.decode();
        e.image = img;
        a.meta = { ...(a.meta || {}), width: a.meta?.width || img.naturalWidth || 512, height: a.meta?.height || img.naturalHeight || 512 };
        break;
      }
      case 'video': {
        const v = this._makeVideo(e.url);
        await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = () => rej(new Error('Format vidéo non pris en charge par ce navigateur')); });
        e.videos.preview = v;
        a.meta = { ...(a.meta || {}), width: v.videoWidth, height: v.videoHeight, duration: v.duration };
        // piste audio éventuelle
        try { e.audio = await this.decodeAudio(e.blob); a.meta.hasAudio = true; a.meta.peak = peakOf(e.audio); } catch { a.meta.hasAudio = false; }
        break;
      }
      case 'audio': {
        e.audio = await this.decodeAudio(e.blob);
        a.meta = { ...(a.meta || {}), duration: e.audio.duration, channels: e.audio.numberOfChannels, sampleRate: e.audio.sampleRate, peak: peakOf(e.audio) };
        break;
      }
      case 'lottie': case 'json': {
        e.json = JSON.parse(await e.blob.text());
        break;
      }
      case 'font': {
        const family = a.meta?.family || a.name.replace(/\.[^.]+$/, '');
        const ff = new FontFace(family, await e.blob.arrayBuffer());
        await ff.load();
        document.fonts.add(ff);
        a.meta = { ...(a.meta || {}), family };
        break;
      }
      case 'lut': e.lut = parseCube(await e.blob.text()); break;
      default: break;
    }
  }

  _makeVideo(url) {
    const v = document.createElement('video');
    v.src = url;
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.crossOrigin = 'anonymous';
    return v;
  }

  getAudioContext() {
    if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return this.audioCtx;
  }

  async decodeAudio(blob) {
    const buf = await blob.arrayBuffer();
    return this.getAudioContext().decodeAudioData(buf.slice(0));
  }

  getImage(id) { const e = this.entries.get(id); return e?.status === 'ready' ? e.image : null; }
  getAudio(id) { const e = this.entries.get(id); return e?.audio || null; }
  getLut(id) { const e = this.entries.get(id); return e?.lut || null; }
  isReady(id) { return this.entries.get(id)?.status === 'ready'; }
  status(id) { return this.entries.get(id)?.status || 'missing'; }

  // SVG rasterisé à l'échelle demandée (net à toute échelle)
  getSvgRaster(id, w, h) {
    const e = this.entries.get(id);
    if (!e?.image) return null;
    const W = Math.max(1, Math.min(8192, Math.round(w))), H = Math.max(1, Math.min(8192, Math.round(h)));
    const key = `${id}:${W}x${H}`;
    if (this.svgCache.has(key)) return this.svgCache.get(key);
    const c = new OffscreenCanvas(W, H);
    c.getContext('2d').drawImage(e.image, 0, 0, W, H);
    this.svgCache.set(key, c);
    if (this.svgCache.size > 40) this.svgCache.delete(this.svgCache.keys().next().value);
    return c;
  }

  // Vidéo dédiée à un rôle (preview / export / thumbs) pour ne pas perturber la lecture
  getVideo(id, role = 'preview') {
    const e = this.entries.get(id);
    if (!e || e.status !== 'ready' || e.asset.type !== 'video') return null;
    if (!e.videos[role]) e.videos[role] = this._makeVideo(e.url);
    return e.videos[role];
  }

  // Seek précis : résout quand l'image demandée est décodée
  seekVideo(v, time) {
    const target = Math.max(0, Math.min((v.duration || 0) - 0.001, time));
    if (v.readyState >= 2 && Math.abs(v.currentTime - target) < 0.002) return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => { v.removeEventListener('seeked', done); clearTimeout(to); resolve(); };
      const to = setTimeout(done, 3000);
      v.addEventListener('seeked', done);
      v.currentTime = target;
    });
  }

  // Image ou image vidéo courante (mockups)
  getImageLike(id, r) {
    const e = this.entries.get(id);
    if (!e || e.status !== 'ready') return null;
    if (e.asset.type === 'video') { const v = e.videos.preview; return v && v.readyState >= 2 ? Object.assign(v, { width: v.videoWidth, height: v.videoHeight }) : null; }
    return e.image || null;
  }

  // Instance Lottie (lottie-web, rendu canvas) : render(frame) déterministe
  getLottie(id, w, h) {
    const e = this.entries.get(id);
    if (!e?.json || !window.lottie) return null;
    const key = `${w}x${h}`;
    if (e.lottie?.key === key) return e.lottie;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    const anim = window.lottie.loadAnimation({ renderer: 'canvas', loop: false, autoplay: false, animationData: JSON.parse(JSON.stringify(e.json)), rendererSettings: { context: ctx, clearCanvas: true, preserveAspectRatio: 'xMidYMid meet' } });
    e.lottie?.anim?.destroy();
    e.lottie = { key, canvas, anim, render: (f) => { ctx.clearRect(0, 0, w, h); anim.goToAndStop(f, true); } };
    return e.lottie;
  }

  release(id) {
    const e = this.entries.get(id);
    if (!e) return;
    for (const v of Object.values(e.videos)) { v.pause(); v.removeAttribute('src'); v.load(); }
    e.lottie?.anim?.destroy();
    if (e.url) URL.revokeObjectURL(e.url);
    this.entries.delete(id);
    for (const k of [...this.svgCache.keys()]) if (k.startsWith(`${id}:`)) this.svgCache.delete(k);
  }

  // Synchronise avec la liste d'assets du projet
  async sync(project) {
    const ids = new Set(project.assets.map((a) => a.id));
    for (const id of [...this.entries.keys()]) if (!ids.has(id)) this.release(id);
    await Promise.all(project.assets.map((a) => (this.entries.has(a.id) && this.entries.get(a.id).asset.ref === a.ref ? (this.entries.get(a.id).asset = a, null) : this.register(a))));
  }

  async whenReady(ids) { await Promise.all(ids.map((id) => this.entries.get(id)?.ready).filter(Boolean)); }
}

function peakOf(buf) {
  let p = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i += 64) p = Math.max(p, Math.abs(d[i])); }
  return +p.toFixed(3);
}
