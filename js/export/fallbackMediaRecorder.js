// Repli n°2 : MediaRecorder (MP4 si supporté, sinon WebM). Chaque image est rendue de façon déterministe puis
// poussée dans un flux canvas.captureStream(0) au rythme réel ; l'audio est le mixage hors-ligne rejoué en direct.
export async function recordWithMediaRecorder({ canvas, frames, fps, renderFrame, audioBuffer, audioContext, onProgress, isCancelled, preferMp4 = true }) {
  const types = preferMp4 ? ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'] : ['video/webm;codecs=vp9,opus', 'video/webm'];
  const mime = types.find((t) => MediaRecorder.isTypeSupported(t));
  if (!mime) throw new Error('MediaRecorder ne prend en charge aucun format vidéo dans ce navigateur.');
  const stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0];
  let audioSrc = null;
  if (audioBuffer && audioContext) {
    const dest = audioContext.createMediaStreamDestination();
    audioSrc = audioContext.createBufferSource();
    audioSrc.buffer = audioBuffer;
    audioSrc.connect(dest);
    for (const t of dest.stream.getAudioTracks()) stream.addTrack(t);
  }
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12e6 });
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const done = new Promise((res) => { rec.onstop = res; });
  rec.start(250);
  if (audioSrc) audioSrc.start();
  const t0 = performance.now();
  for (let i = 0; i < frames; i++) {
    if (isCancelled()) break;
    await renderFrame(i);
    track.requestFrame?.();
    onProgress(i + 1);
    const due = t0 + ((i + 1) * 1000) / fps;
    const wait = due - performance.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  }
  rec.stop();
  audioSrc?.stop();
  await done;
  for (const t of stream.getTracks()) t.stop();
  return { blob: new Blob(chunks, { type: mime.split(';')[0] }), mime };
}
