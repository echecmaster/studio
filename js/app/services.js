// Services navigateur injectés dans le CommandBus (stockage, médias, rendu "vision", export, partage, audio, suivi, scripts, UI)
import { uid, formatTimecode, bytesToHuman } from '../core/util.js';
import { putBlob, getBlob } from '../storage/opfs.js';
import { projectsStore } from '../storage/projects.js';
import { Renderer } from '../render/renderer.js';
import { measureResolved } from '../render/layers.js';
import { synthSfx, audioBufferToWav } from '../audio/sfx.js';
import { detectBeats } from '../audio/beats.js';
import { trackPoints } from './tracking.js';
import { collectScript } from './scriptSandbox.js';
import { canvasBlob } from '../export/exporter.js';
import { ZipWriter } from '../export/zip.js';
import { textAssetMeta } from '../core/commands/assets.js';

const MAX_ASSET = 2 * 1024 * 1024 * 1024;

export function assetTypeFor(name, mime = '') {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (mime === 'image/svg+xml' || ext === 'svg') return 'svg';
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'bmp'].includes(ext)) return 'image';
  if (mime.startsWith('video/') || ['mp4', 'webm', 'mov', 'm4v', 'mkv', 'ogv'].includes(ext)) return 'video';
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac', 'opus'].includes(ext)) return 'audio';
  if (['ttf', 'otf', 'woff', 'woff2'].includes(ext) || mime.startsWith('font/')) return 'font';
  if (ext === 'cube') return 'lut';
  if (ext === 'csv') return 'csv';
  if (ext === 'json' || mime === 'application/json') return 'json';
  return null;
}

function dataUrlToBlob(data, mime) {
  let b64 = data, type = mime;
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(data);
  if (m) { type = type || m[1]; b64 = m[2] ? m[3] : btoa(decodeURIComponent(m[3])); }
  const bin = atob(b64.replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: type || 'application/octet-stream' });
}

async function blobToDataUrl(blob) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
}

export function createServices(app) {
  const { media, analysis } = app;
  const files = new Map(); // jetons de fichiers choisis par l'utilisateur
  let capture = null;
  const getCapture = () => {
    if (!capture) {
      const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(960, 540) : Object.assign(document.createElement('canvas'), { width: 960, height: 540 });
      capture = new Renderer(c, { media, audio: analysis, log: app.log, offscreen: true });
    }
    return capture;
  };

  async function registerBlob(blob, name, forcedType, extraMeta = {}) {
    if (blob.size > MAX_ASSET) throw new Error(`Fichier trop volumineux (${bytesToHuman(blob.size)}).`);
    let type = forcedType || assetTypeFor(name, blob.type);
    if (!type) throw new Error(`Type de fichier non pris en charge : ${name}`);
    if (type === 'json' || type === 'csv' || type === 'lut' || type === 'svg') {
      const text = await blob.text();
      if (type === 'json') { try { const j = JSON.parse(text); if (j.layers && j.fr) type = 'lottie'; } catch (e) { throw new Error(`JSON invalide : ${e.message}`); } }
      // les assets texte sont stockés inline dans le projet (portables, partageables)
      const asset = { id: uid('ast'), type, name, ref: 'inline', mime: blob.type || ({ svg: 'image/svg+xml', lut: 'text/plain', csv: 'text/csv' }[type] || 'application/json'), size: text.length, data: text, meta: textAssetMeta(type, text) };
      await media.register(asset);
      if (media.status(asset.id) === 'error') throw new Error(media.entry(asset.id)?.error || 'Décodage impossible');
      return asset;
    }
    const asset = { id: uid('ast'), type, name, ref: '', mime: blob.type, size: blob.size, meta: { ...extraMeta } };
    asset.ref = `${await putBlob(asset.id, blob)}://${asset.id}`;
    await media.register(asset, blob);
    const e = media.entry(asset.id);
    if (e?.status === 'error') throw new Error(e.error);
    asset.meta = { ...asset.meta, ...(e?.asset.meta || {}) };
    return asset;
  }

  const services = {
    files,
    storage: {
      save: async (project) => { await projectsStore.save(project, app.viewport?.thumbnail?.()); app.markSaved?.(); },
      load: (id) => projectsStore.load(id),
      list: () => projectsStore.list(),
      remove: (id) => projectsStore.remove(id),
    },

    assets: {
      importFile: async (token) => {
        const f = files.get(token);
        if (!f) throw new Error('Jeton de fichier inconnu ou expiré.');
        files.delete(token);
        return registerBlob(f, f.name);
      },
      importUrl: async (url, { name, type, family } = {}) => {
        let res;
        try { res = await fetch(url, { mode: 'cors' }); } catch (e) { throw new Error(`Téléchargement impossible (CORS ou réseau) : ${e.message}`); }
        if (!res.ok) throw new Error(`HTTP ${res.status} pour ${url}`);
        const blob = await res.blob();
        const n = name || decodeURIComponent(new URL(url, location.href).pathname.split('/').pop() || 'media');
        return registerBlob(blob, n, type, family ? { family } : {});
      },
      importBase64: async (data, name, mime) => registerBlob(dataUrlToBlob(data, mime), name),
      registerInline: async (asset) => { await media.register(asset); },
      generateSfx: async (type, duration, name) => {
        const buf = await synthSfx(type, duration);
        return registerBlob(audioBufferToWav(buf), `${name || type}.wav`, 'audio');
      },
      recordVoice: async (seconds) => {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Micro indisponible dans ce navigateur.');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((m) => MediaRecorder.isTypeSupported(m));
        const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
        const chunks = [];
        rec.ondataavailable = (e) => chunks.push(e.data);
        const stopped = new Promise((r) => { rec.onstop = r; });
        rec.start();
        app.ui?.recording?.(seconds, () => rec.state === 'recording' && rec.stop());
        setTimeout(() => rec.state === 'recording' && rec.stop(), seconds * 1000);
        await stopped;
        stream.getTracks().forEach((t) => t.stop());
        return registerBlob(new Blob(chunks, { type: rec.mimeType }), `voix-off-${new Date().toISOString().slice(11, 19).replace(/:/g, '')}.${rec.mimeType.includes('mp4') ? 'm4a' : 'webm'}`, 'audio');
      },
      hydrate: async (project) => {
        // médias embarqués en base64 (export JSON "assets embarqués")
        for (const a of project.assets) {
          if (a.embedded) {
            const blob = dataUrlToBlob(a.embedded, a.mime);
            delete a.embedded;
            a.ref = `${await putBlob(a.id, blob)}://${a.id}`;
          }
        }
        await media.sync(project);
        const missing = project.assets.filter((a) => media.status(a.id) === 'error');
        if (missing.length) app.toast?.(`${missing.length} média(s) introuvable(s) localement : ${missing.map((a) => a.name).join(', ')}. Utilisez asset.replace.`, 'warn');
      },
      embed: async (project) => {
        for (const a of project.assets) {
          if (a.ref === 'inline') continue;
          const blob = await getBlob(a.id);
          if (blob) a.embedded = await blobToDataUrl(blob);
        }
        return project;
      },
      rebind: async (id, src) => {
        const blob = src.ref === 'inline' ? null : await getBlob(src.id);
        if (blob) await putBlob(id, blob);
        media.release(id);
        app.renderer?.invalidateMedia(id);
        const asset = app.bus.project.get().assets.find((a) => a.id === id) || { ...src, id };
        await media.register({ ...asset, ...src, id }, blob);
      },
    },

    renderer: {
      frame: async (t, { format = 'jpeg', width = 960, quality = 0.85 } = {}) => {
        const project = app.bus.project.get();
        const r = getCapture();
        const w = Math.max(16, Math.round(width)), h = Math.max(16, Math.round((width * project.meta.height) / project.meta.width));
        r.resize(w, h);
        await media.whenReady(project.assets.map((a) => a.id));
        await r.prepare(project, t, 'capture');
        r.render(project, t, { videoRole: 'capture' });
        const blob = await canvasBlob(r.canvas, `image/${format}`, quality);
        return { t, width: w, height: h, mime: blob.type, dataUrl: await blobToDataUrl(blob), timecode: formatTimecode(t, project.meta.fps) };
      },
      contactSheet: async (times, { columns = 4, width = 1600, format = 'jpeg' } = {}) => {
        const project = app.bus.project.get();
        const rows = Math.ceil(times.length / columns);
        const cellW = Math.floor(width / columns), cellH = Math.round((cellW * project.meta.height) / project.meta.width);
        const sheet = new OffscreenCanvas(cellW * columns, (cellH + 22) * rows);
        const ctx = sheet.getContext('2d');
        ctx.fillStyle = '#050505'; ctx.fillRect(0, 0, sheet.width, sheet.height);
        const r = getCapture();
        r.resize(cellW, cellH);
        await media.whenReady(project.assets.map((a) => a.id));
        for (let i = 0; i < times.length; i++) {
          await r.prepare(project, times[i], 'capture');
          r.render(project, times[i], { videoRole: 'capture' });
          const x = (i % columns) * cellW, y = Math.floor(i / columns) * (cellH + 22);
          ctx.drawImage(r.canvas, x, y, cellW, cellH);
          ctx.fillStyle = '#24D26D'; ctx.font = '600 13px "JetBrains Mono", monospace';
          ctx.fillText(`${formatTimecode(times[i], project.meta.fps)}  (${times[i].toFixed(2)}s)`, x + 6, y + cellH + 16);
        }
        const blob = await canvasBlob(sheet, `image/${format}`, 0.85);
        return { times, columns, width: sheet.width, height: sheet.height, mime: blob.type, dataUrl: await blobToDataUrl(blob) };
      },
      compare: async (clipId, effectId, t, { width = 1280 } = {}) => {
        const project = app.bus.project.get();
        const half = Math.round(width / 2);
        const h = Math.round((half * project.meta.height) / project.meta.width);
        const r = getCapture();
        r.resize(half, h);
        const out = new OffscreenCanvas(half * 2 + 4, h + 24);
        const ctx = out.getContext('2d');
        ctx.fillStyle = '#050505'; ctx.fillRect(0, 0, out.width, out.height);
        await r.prepare(project, t, 'capture');
        r.render(project, t, { videoRole: 'capture', compareDisable: { clipId, effectId } });
        ctx.drawImage(r.canvas, 0, 0);
        r.render(project, t, { videoRole: 'capture' });
        ctx.drawImage(r.canvas, half + 4, 0);
        ctx.fillStyle = '#8A8A8A'; ctx.font = '600 13px Inter, sans-serif';
        ctx.fillText('AVANT', 8, h + 17);
        ctx.fillStyle = '#24D26D'; ctx.fillText('APRÈS', half + 12, h + 17);
        const blob = await canvasBlob(out, 'image/jpeg', 0.85);
        return { t, clipId, effectId: effectId || null, dataUrl: await blobToDataUrl(blob) };
      },
      stats: () => ({ ...app.viewport.stats(), errors: [...(app.renderer?.errors.values() || [])] }),
      precache: (start, end) => app.viewport.precache(start, end),
      clearCache: () => { app.viewport.clearCache(); return { cleared: true }; },
      validateShader: async (code) => getCapture().validateShader(code),
    },

    exporter: {
      capabilities: () => app.exporter.capabilities(),
      start: async (project, opts, appState) => {
        await media.whenReady(project.assets.map((a) => a.id));
        const r = await app.exporter.start(project, opts, appState);
        app.ui?.showExportProgress?.();
        return r;
      },
      status: () => app.exporter.status(),
      cancel: () => app.exporter.cancel(),
      result: (o) => app.exporter.result(o),
      download: () => app.exporter.download(),
    },

    share: {
      save: async (project) => {
        const json = JSON.stringify(project);
        if (json.length > 4.5 * 1024 * 1024) throw new Error('Projet trop volumineux pour le partage (> 4,5 Mo). Les médias binaires ne sont pas inclus : retirez les assets inline volumineux.');
        const res = await fetch('/api/share', { method: 'POST', headers: { 'content-type': 'application/json' }, body: json });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error || `Partage indisponible (HTTP ${res.status}). Le partage nécessite le déploiement Netlify (Functions + Blobs).`);
        return { id: j.id, url: `${location.origin}/?share=${j.id}`, expiresAt: j.expiresAt, note: 'Seul le JSON du projet est partagé : les médias binaires (images, vidéos, audio importés) restent sur cet appareil.' };
      },
      load: async (id) => {
        const res = await fetch(`/api/share?id=${encodeURIComponent(id)}`);
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error || `Projet partagé introuvable (HTTP ${res.status})`);
        return j.project;
      },
    },

    audio: {
      detectBeats: async (assetId, opts) => {
        const buf = media.getAudio(assetId);
        if (!buf) throw new Error('Audio non chargé.');
        return detectBeats(buf, opts);
      },
    },

    tracking: { track: (project, clip, a) => trackPoints(media, project, clip, a) },
    script: { collect: (code) => collectScript(code) },
    measure: (r) => measureResolved(r, { project: app.bus.project.get(), media }) || app.renderer?.layerBox(r, { project: app.bus.project.get(), W: app.bus.project.get().meta.width, H: app.bus.project.get().meta.height }),
    clipboard: {
      write: (cb) => { try { localStorage.setItem('motion-clipboard', JSON.stringify(cb)); } catch { /* quota */ } },
      read: () => { try { return JSON.parse(localStorage.getItem('motion-clipboard') || 'null'); } catch { return null; } },
    },
    capabilities: async () => ({ env: 'browser', ...(await app.exporter.capabilities()), webmcp: app.mcp?.webmcpStatus || 'indisponible', relay: app.bus.app.get().mcp.relay, userAgent: navigator.userAgent }),
    ui: {
      openPanel: (p) => app.ui.openPanel(p),
      togglePanel: (p) => app.ui.togglePanel(p),
      fullscreen: (on) => app.ui.fullscreen(on),
      timelineWidth: () => app.timeline?.bodyWidth?.() || 1000,
      downloadProject: async (json, { zip }) => {
        const name = `${(json.meta.name || 'projet').replace(/[^\w\- ]+/g, '').trim() || 'projet'}`;
        if (zip) {
          const z = new ZipWriter();
          const copy = JSON.parse(JSON.stringify(json));
          for (const a of copy.assets) {
            if (a.ref === 'inline') continue;
            const blob = await getBlob(a.id);
            if (blob) { await z.add(`media/${a.id}_${a.name}`, blob); a.zipPath = `media/${a.id}_${a.name}`; }
            delete a.embedded;
          }
          await z.add('project.motion.json', JSON.stringify(copy, null, 2));
          app.download(z.blob(), `${name}.motion.zip`);
        } else app.download(new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' }), `${name}.motion.json`);
      },
    },
  };
  return services;
}
