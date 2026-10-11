// Export : rendu image par image DÉTERMINISTE (indépendant du temps réel) → encodage → conteneur.
// Chaîne MP4 : (1) WebCodecs + mp4-muxer, (2) MediaRecorder MP4, (3) MediaRecorder WebM → ffmpeg.wasm → MP4.
import { Renderer } from '../render/renderer.js';
import { renderMix, projectHasAudio } from '../audio/mixer.js';
import { pickVideoCodec, pickAudioCodec, detectCapabilities } from './webcodecs.js';
import { createMp4Muxer, createWebmMuxer, validateMp4 } from './mp4mux.js';
import { recordWithMediaRecorder } from './fallbackMediaRecorder.js';
import { transcodeToMp4 } from './ffmpegFallback.js';
import { GifEncoder } from './gif.js';
import { ZipWriter } from './zip.js';
import { slug, uid } from '../core/util.js';

const QUALITY_BPP = { low: 0.05, medium: 0.1, high: 0.18 };

export class Exporter {
  constructor({ media, audio, log, emit, download }) {
    this.media = media; this.audio = audio; this.log = log; this.emit = emit; this.download = download;
    this.job = null;
    this.last = null;
    this.capsP = null;
  }

  capabilities() { this.capsP ||= detectCapabilities(); return this.capsP; }

  settings(project, o, app) {
    const fmt = o.format || 'mp4';
    let w = o.width || project.meta.width, h = o.height || project.meta.height;
    if (o.width && !o.height) h = Math.round((o.width * project.meta.height) / project.meta.width);
    if (o.height && !o.width) w = Math.round((o.height * project.meta.width) / project.meta.height);
    if (fmt === 'gif' && !o.width) { const s = Math.min(1, 640 / w); w = Math.round(w * s); h = Math.round(h * s); }
    if (fmt === 'mp4' || fmt === 'webm') { w -= w % 2; h -= h % 2; }
    const fps = o.fps || (fmt === 'gif' ? Math.min(20, project.meta.fps) : project.meta.fps);
    let start = 0, end = project.meta.duration;
    const range = o.range || 'all';
    if (range === 'workarea') { start = project.workArea.in; end = project.workArea.out; }
    if (range === 'selection') {
      const sel = project.clips.filter((c) => (app?.selection || []).includes(c.id));
      if (!sel.length) throw new Error('Plage "sélection" : aucun clip sélectionné.');
      start = Math.min(...sel.map((c) => c.start)); end = Math.max(...sel.map((c) => c.start + c.duration));
    }
    if (range === 'custom') { start = o.start ?? 0; end = o.end ?? project.meta.duration; }
    start = Math.max(0, start); end = Math.min(project.meta.duration, Math.max(start + 1 / fps, end));
    const bpp = o.quality === 'custom' ? null : QUALITY_BPP[o.quality || 'high'];
    const bitrate = o.bitrate && (o.quality === 'custom' || !o.quality) ? o.bitrate * 1e6 : Math.round(w * h * fps * (bpp || 0.18));
    const ext = { mp4: 'mp4', webm: 'webm', gif: 'gif', 'png-sequence': 'zip', png: 'png', jpg: 'jpg' }[fmt];
    const filename = `${slug(o.filename || project.meta.name)}.${ext}`.replace(/\.(mp4|webm|gif|zip|png|jpg)\.\1$/, '.$1');
    const mb = o.motionBlur ?? project.meta.motionBlur?.enabled;
    return { fmt, w, h, fps, start, end, frames: Math.max(1, Math.round((end - start) * fps)), bitrate, filename, includeAudio: o.includeAudio !== false, hardware: o.hardware || 'prefer-hardware', motionBlur: mb ? { samples: o.motionBlurSamples || project.meta.motionBlur?.samples || 8, shutter: project.meta.motionBlur?.shutter ?? 180 } : null, autoDownload: o.autoDownload !== false, stream: !!o.stream, t: o.t };
  }

  estimate(project, o) {
    const s = this.settings(project, o, {});
    const seconds = s.end - s.start;
    const bytes = s.fmt === 'gif' ? s.w * s.h * s.frames * 0.35 : s.fmt === 'png-sequence' ? s.w * s.h * 1.2 * s.frames : s.fmt === 'png' || s.fmt === 'jpg' ? s.w * s.h * (s.fmt === 'png' ? 1.5 : 0.3) : (s.bitrate * seconds) / 8 + (s.includeAudio ? 24000 * seconds : 0);
    const secPerFrame = 0.012 + (s.w * s.h) / 2.07e6 * 0.035 * (s.motionBlur ? s.motionBlur.samples : 1);
    return { ...s, seconds, bytes: Math.round(bytes), etaSeconds: Math.round(s.frames * secPerFrame) };
  }

  status() {
    const j = this.job || this.last;
    if (!j) return { status: 'idle' };
    const { canvas, cancel, ...rest } = j;
    return rest;
  }

  cancel() {
    if (!this.job || this.job.status !== 'running') return { cancelled: false, reason: 'Aucun export en cours.' };
    this.job.cancelRequested = true;
    return { cancelled: true };
  }

  async result({ base64 } = {}) {
    if (!this.last?.result) throw new Error('Aucun export terminé.');
    const r = { ...this.last.result };
    delete r.blob;
    if (base64) {
      if (this.last.result.size > 25 * 1024 * 1024) throw new Error('Fichier > 25 Mo : utilisez le lien de téléchargement.');
      const buf = new Uint8Array(await this.last.result.blob.arrayBuffer());
      let s = '';
      for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      r.base64 = btoa(s);
    }
    return r;
  }

  download() {
    if (!this.last?.result) throw new Error('Aucun export terminé.');
    this.download(this.last.result.blob, this.last.result.filename);
    return { downloaded: this.last.result.filename };
  }

  // Lance l'export ; retourne immédiatement le job (suivi par export.status / événements "progress")
  async start(project, o, app) {
    if (this.job?.status === 'running') throw new Error('Un export est déjà en cours.');
    const s = this.settings(project, o, app);
    let stream = null;
    if (s.stream && window.showSaveFilePicker && ['mp4', 'webm'].includes(s.fmt)) {
      try {
        const fh = await window.showSaveFilePicker({ suggestedName: s.filename, types: [{ description: s.fmt.toUpperCase(), accept: { [s.fmt === 'mp4' ? 'video/mp4' : 'video/webm']: [`.${s.fmt}`] } }] });
        stream = await fh.createWritable();
      } catch (e) { this.log('warn', `Écriture en streaming annulée (${e.message}) : export en mémoire.`); }
    }
    const job = { id: uid('exp'), status: 'running', format: s.fmt, filename: s.filename, width: s.w, height: s.h, fps: s.fps, frame: 0, total: s.frames, progress: 0, startedAt: Date.now(), eta: null, method: null, preview: null, error: null };
    this.job = job;
    const snapshot = JSON.parse(JSON.stringify(project));
    this._run(snapshot, s, job, stream).catch((e) => {
      job.status = job.cancelRequested ? 'cancelled' : 'error';
      job.error = job.cancelRequested ? null : e.message;
      this.log(job.cancelRequested ? 'warn' : 'error', job.cancelRequested ? 'Export annulé.' : `Export échoué : ${e.message}`);
      this.emit('progress', this.status());
      this.emit('export-done', this.status());
      this.last = job; this.job = null;
    });
    return { jobId: job.id, status: 'running', filename: s.filename, frames: s.frames, width: s.w, height: s.h, fps: s.fps, format: s.fmt, note: 'Le rendu se fait dans cet onglet : gardez-le ouvert. Suivez la progression avec export.status.' };
  }

  makeRenderer(w, h) {
    let canvas = null;
    if (typeof OffscreenCanvas !== 'undefined') {
      try { const c = new OffscreenCanvas(w, h); if (c.getContext('webgl2')) canvas = new OffscreenCanvas(w, h); } catch { canvas = null; }
    }
    if (!canvas) { canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h; }
    return new Renderer(canvas, { media: this.media, audio: this.audio, log: this.log, offscreen: true });
  }

  progress(job, i) {
    job.frame = i;
    job.progress = Math.min(1, i / job.total);
    const el = (Date.now() - job.startedAt) / 1000;
    job.eta = i > 0 ? Math.round((el / i) * (job.total - i)) : null;
    if (i % 3 === 0 || i === job.total) this.emit('progress', this.status());
  }

  async renderAt(r, project, s, i) {
    const t = s.start + i / s.fps;
    await r.prepare(project, t, 'export');
    r.render(project, t, { videoRole: 'export', motionBlur: s.motionBlur });
  }

  async _run(project, s, job, stream) {
    await this.media.sync(project);
    await document.fonts?.ready;
    const r = this.makeRenderer(s.w, s.h);
    this.currentCanvas = r.canvas;
    const preview = () => { try { job.preview = r.canvas instanceof OffscreenCanvas ? null : r.canvas.toDataURL('image/jpeg', 0.5); } catch { /* */ } };
    let blob, method, validation = null;
    try {
      if (s.fmt === 'png' || s.fmt === 'jpg') {
        const t = s.t ?? 0;
        await r.prepare(project, t, 'export');
        r.render(project, t, { videoRole: 'export', motionBlur: s.motionBlur });
        blob = await canvasBlob(r.canvas, s.fmt === 'png' ? 'image/png' : 'image/jpeg', 0.92);
        method = 'Image unique';
        this.progress(job, 1);
      } else if (s.fmt === 'png-sequence') {
        const zip = new ZipWriter();
        for (let i = 0; i < s.frames; i++) {
          if (job.cancelRequested) throw new Error('Annulé');
          await this.renderAt(r, project, s, i);
          await zip.add(`frame_${String(i).padStart(5, '0')}.png`, await canvasBlob(r.canvas, 'image/png'));
          this.progress(job, i + 1);
          if (i % 5 === 0) await yieldUI();
        }
        blob = zip.blob();
        method = 'Séquence PNG (zip)';
      } else if (s.fmt === 'gif') {
        const gif = new GifEncoder(s.w, s.h, s.fps);
        const rd = new OffscreenCanvas(s.w, s.h).getContext('2d', { willReadFrequently: true });
        for (let i = 0; i < s.frames; i++) {
          if (job.cancelRequested) throw new Error('Annulé');
          await this.renderAt(r, project, s, i);
          rd.clearRect(0, 0, s.w, s.h);
          rd.drawImage(r.canvas, 0, 0);
          gif.addFrame(rd.getImageData(0, 0, s.w, s.h).data);
          this.progress(job, i + 1);
          await yieldUI();
        }
        blob = gif.finish();
        method = 'GIF animé';
      } else {
        const res = await this.encodeVideo(project, s, job, r, stream);
        blob = res.blob; method = res.method; validation = res.validation;
      }
    } finally {
      this.currentCanvas = null;
      r.dispose();
    }
    if (job.cancelRequested) throw new Error('Annulé');
    const blobUrl = blob ? URL.createObjectURL(blob) : null;
    if (this.last?.result?.blobUrl) URL.revokeObjectURL(this.last.result.blobUrl);
    job.status = 'done';
    job.progress = 1;
    job.method = method;
    job.finishedAt = Date.now();
    job.result = { filename: s.filename, size: blob?.size ?? 0, blobUrl, durationSec: +(s.end - s.start).toFixed(3), mime: blob?.type, method, validation, blob, streamed: !blob };
    this.last = job;
    this.job = null;
    this.log('info', `Export terminé : ${s.filename} (${((blob?.size || 0) / 1048576).toFixed(2)} Mo, ${method})`);
    if (blob && s.autoDownload) this.download(blob, s.filename);
    this.emit('progress', this.status());
    this.emit('export-done', this.status());
    preview();
  }

  async encodeVideo(project, s, job, r, stream) {
    const container = s.fmt;
    const caps = await this.capabilities();
    const hasAudio = s.includeAudio && projectHasAudio(project, this.media);
    let audioBuffer = null;
    if (hasAudio) audioBuffer = await renderMix(project, this.media, s.start, s.end, project.meta.sampleRate || 48000);
    const vc = caps.webcodecs ? await pickVideoCodec(s.w, s.h, s.fps, s.bitrate, s.hardware, container) : null;
    if (vc) {
      try { return await this.encodeWebCodecs(project, s, job, r, vc, audioBuffer, container, stream); } catch (e) {
        if (job.cancelRequested) throw e;
        this.log('warn', `WebCodecs a échoué (${e.message}) → repli MediaRecorder.`);
      }
    } else this.log('warn', 'WebCodecs indisponible pour ces réglages → repli MediaRecorder.');
    // Replis : MediaRecorder (temps réel) puis ffmpeg.wasm si WebM
    const canvas = r.canvas instanceof OffscreenCanvas ? null : r.canvas;
    let recCanvas = canvas;
    let ctx2d = null;
    if (!recCanvas) { recCanvas = document.createElement('canvas'); recCanvas.width = s.w; recCanvas.height = s.h; ctx2d = recCanvas.getContext('2d'); }
    const { blob, mime } = await recordWithMediaRecorder({
      canvas: recCanvas, frames: s.frames, fps: s.fps, audioBuffer, audioContext: this.media.getAudioContext(), preferMp4: container === 'mp4',
      renderFrame: async (i) => { await this.renderAt(r, project, s, i); if (ctx2d) { ctx2d.clearRect(0, 0, s.w, s.h); ctx2d.drawImage(r.canvas, 0, 0); } },
      onProgress: (i) => this.progress(job, i), isCancelled: () => job.cancelRequested,
    });
    if (container === 'mp4' && !mime.includes('mp4')) {
      this.log('info', 'Conversion WebM → MP4 avec ffmpeg.wasm…');
      job.phase = 'ffmpeg';
      const mp4 = await transcodeToMp4(blob, { bitrateMbps: Math.max(1, Math.round(s.bitrate / 1e6)), onProgress: (p) => { job.progress = 0.9 + p * 0.1; this.emit('progress', this.status()); } });
      const validation = validateMp4(await mp4.arrayBuffer());
      return { blob: mp4, method: 'MediaRecorder WebM → ffmpeg.wasm → MP4', validation };
    }
    const validation = mime.includes('mp4') ? validateMp4(await blob.arrayBuffer()) : null;
    return { blob, method: `MediaRecorder (${mime})`, validation };
  }

  async encodeWebCodecs(project, s, job, r, vc, audioBuffer, container, stream) {
    let ac = null;
    if (audioBuffer) ac = await pickAudioCodec(audioBuffer.sampleRate, 2, container);
    if (audioBuffer && !ac) this.log('warn', 'Aucun encodeur audio WebCodecs : export sans audio.');
    const audio = ac ? { codec: ac.kind, channels: 2, sampleRate: audioBuffer.sampleRate } : null;
    const { muxer, target } = container === 'webm'
      ? createWebmMuxer({ width: s.w, height: s.h, fps: s.fps, videoCodec: vc.kind, audio, stream })
      : createMp4Muxer({ width: s.w, height: s.h, fps: s.fps, videoCodec: vc.kind, audio, stream });
    let encError = null;
    const venc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => { encError = e; } });
    venc.configure(vc.config);
    const keyEvery = Math.max(1, Math.round(s.fps * 2));
    const dur = Math.round(1e6 / s.fps);
    for (let i = 0; i < s.frames; i++) {
      if (job.cancelRequested) { venc.close(); throw new Error('Annulé'); }
      if (encError) throw encError;
      await this.renderAt(r, project, s, i);
      const frame = new VideoFrame(r.canvas, { timestamp: i * dur, duration: dur });
      venc.encode(frame, { keyFrame: i % keyEvery === 0 });
      frame.close();
      while (venc.encodeQueueSize > 6) await new Promise((res) => setTimeout(res, 1));
      this.progress(job, i + 1);
      await yieldUI();
    }
    await venc.flush();
    venc.close();
    if (encError) throw encError;
    if (ac) {
      const aenc = new AudioEncoder({ output: (chunk, meta) => muxer.addAudioChunk(chunk, meta), error: (e) => { encError = e; } });
      aenc.configure(ac.config);
      const sr = audioBuffer.sampleRate, n = audioBuffer.length, block = 4096;
      const L = audioBuffer.getChannelData(0), R = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : L;
      for (let o = 0; o < n; o += block) {
        const len = Math.min(block, n - o);
        const data = new Float32Array(len * 2);
        data.set(L.subarray(o, o + len), 0);
        data.set(R.subarray(o, o + len), len);
        const ad = new AudioData({ format: 'f32-planar', sampleRate: sr, numberOfFrames: len, numberOfChannels: 2, timestamp: Math.round((o / sr) * 1e6), data });
        aenc.encode(ad);
        ad.close();
      }
      await aenc.flush();
      aenc.close();
      if (encError) throw encError;
    }
    muxer.finalize();
    let blob = null, validation = null;
    if (stream) { await stream.close(); }
    else {
      const buf = target.buffer;
      blob = new Blob([buf], { type: container === 'webm' ? 'video/webm' : 'video/mp4' });
      if (container === 'mp4') {
        validation = validateMp4(buf);
        if (!validation.valid) throw new Error(`MP4 invalide après encodage : ${validation.errors.join(', ') || 'pistes manquantes'}`);
        if (audio && !validation.audio) this.log('warn', 'La piste audio est absente du MP4.');
      }
    }
    return { blob, method: `WebCodecs ${vc.kind === 'avc' ? 'H.264' : vc.kind.toUpperCase()} (${vc.codec})${ac ? ` + ${ac.kind === 'aac' ? 'AAC' : 'Opus'}` : ''} → ${container.toUpperCase()}`, validation };
  }
}

function yieldUI() { return new Promise((r) => setTimeout(r, 0)); }

export async function canvasBlob(canvas, type, quality) {
  if (canvas.convertToBlob) return canvas.convertToBlob({ type, quality });
  return new Promise((res) => canvas.toBlob(res, type, quality));
}
