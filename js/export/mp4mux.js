// Muxers (mp4-muxer / webm-muxer embarqués) + validation d'un fichier MP4 (boîtes ISO-BMFF)
import * as MP4 from '../../vendor/mp4-muxer.mjs';
import * as WEBM from '../../vendor/webm-muxer.mjs';

export { MP4, WEBM };

export function createMp4Muxer({ width, height, fps, videoCodec, audio, stream }) {
  const target = stream ? new MP4.FileSystemWritableFileStreamTarget(stream) : new MP4.ArrayBufferTarget();
  const muxer = new MP4.Muxer({
    target,
    video: { codec: videoCodec, width, height, frameRate: fps },
    audio: audio ? { codec: audio.codec, numberOfChannels: audio.channels, sampleRate: audio.sampleRate } : undefined,
    fastStart: stream ? false : 'in-memory',
    firstTimestampBehavior: 'offset',
  });
  return { muxer, target };
}

export function createWebmMuxer({ width, height, fps, videoCodec, audio, stream }) {
  const target = stream ? new WEBM.FileSystemWritableFileStreamTarget(stream) : new WEBM.ArrayBufferTarget();
  const muxer = new WEBM.Muxer({
    target,
    video: { codec: videoCodec === 'vp9' ? 'V_VP9' : videoCodec === 'av1' ? 'V_AV1' : 'V_VP8', width, height, frameRate: fps },
    audio: audio ? { codec: 'A_OPUS', numberOfChannels: audio.channels, sampleRate: audio.sampleRate } : undefined,
    firstTimestampBehavior: 'offset',
  });
  return { muxer, target };
}

// Analyse des boîtes MP4 : durée, pistes vidéo/audio, présence de données
export function validateMp4(buffer) {
  const dv = new DataView(buffer);
  const res = { valid: false, brand: null, duration: 0, tracks: [], mdatBytes: 0, errors: [] };
  const type = (o) => String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3));
  const walk = (start, end, depth, ctx) => {
    let o = start;
    while (o + 8 <= end) {
      let size = dv.getUint32(o);
      const t = type(o + 4);
      let header = 8;
      if (size === 1) { size = Number(dv.getBigUint64(o + 8)); header = 16; }
      if (size === 0) size = end - o;
      if (size < header || o + size > end) { res.errors.push(`Boîte ${t} tronquée`); return; }
      if (t === 'ftyp') res.brand = type(o + 8);
      else if (t === 'mdat') res.mdatBytes += size - header;
      else if (t === 'mvhd') {
        const v = dv.getUint8(o + header);
        const ts = v === 1 ? dv.getUint32(o + header + 20) : dv.getUint32(o + header + 12);
        const du = v === 1 ? Number(dv.getBigUint64(o + header + 24)) : dv.getUint32(o + header + 16);
        res.timescale = ts;
        res.duration = ts ? du / ts : 0;
      } else if (t === 'trak') { const tr = {}; res.tracks.push(tr); walk(o + header, o + size, depth + 1, tr); }
      else if (t === 'hdlr' && ctx) ctx.handler = type(o + header + 8);
      else if (t === 'mdhd' && ctx) { const v = dv.getUint8(o + header); const ts = v === 1 ? dv.getUint32(o + header + 20) : dv.getUint32(o + header + 12); const du = v === 1 ? Number(dv.getBigUint64(o + header + 24)) : dv.getUint32(o + header + 16); ctx.duration = ts ? du / ts : 0; }
      else if (t === 'stsd' && ctx) ctx.codec = type(o + header + 12);
      if (['moov', 'mdia', 'minf', 'stbl', 'moof', 'traf', 'mvex'].includes(t)) walk(o + header, o + size, depth + 1, ctx);
      o += size;
    }
  };
  try { walk(0, buffer.byteLength, 0, null); } catch (e) { res.errors.push(e.message); }
  res.video = res.tracks.find((x) => x.handler === 'vide') || null;
  res.audio = res.tracks.find((x) => x.handler === 'soun') || null;
  if (!res.duration && res.video?.duration) res.duration = res.video.duration;
  res.valid = !!(res.brand && res.video && res.mdatBytes > 0 && res.duration > 0 && !res.errors.length);
  return res;
}
