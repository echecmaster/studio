// Repli n°3 : transcodage WebM → MP4 (H.264/AAC) avec ffmpeg.wasm embarqué dans /vendor (≈31 Mo, chargé à la demande)
let ffmpegP = null;

async function load(onLog) {
  if (ffmpegP) return ffmpegP;
  ffmpegP = (async () => {
    const { FFmpeg } = await import('../../vendor/ffmpeg/index.js');
    const ff = new FFmpeg();
    if (onLog) ff.on('log', ({ message }) => onLog(message));
    const base = new URL('../../vendor/ffmpeg-core/', import.meta.url).href;
    await ff.load({ coreURL: `${base}ffmpeg-core.js`, wasmURL: `${base}ffmpeg-core.wasm` });
    return ff;
  })();
  ffmpegP.catch(() => { ffmpegP = null; });
  return ffmpegP;
}

export async function transcodeToMp4(webmBlob, { onProgress, onLog, bitrateMbps = 8 } = {}) {
  const ff = await load(onLog);
  const handler = ({ progress }) => onProgress?.(Math.max(0, Math.min(1, progress)));
  ff.on('progress', handler);
  try {
    await ff.writeFile('in.webm', new Uint8Array(await webmBlob.arrayBuffer()));
    const code = await ff.exec(['-i', 'in.webm', '-c:v', 'libx264', '-preset', 'veryfast', '-b:v', `${bitrateMbps}M`, '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', 'out.mp4']);
    if (code !== 0) throw new Error(`ffmpeg a échoué (code ${code})`);
    const data = await ff.readFile('out.mp4');
    await ff.deleteFile('in.webm');
    await ff.deleteFile('out.mp4');
    return new Blob([data], { type: 'video/mp4' });
  } finally {
    ff.off('progress', handler);
  }
}
