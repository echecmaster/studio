// Détection des capacités d'encodage (WebCodecs) et choix du codec
const AVC = ['avc1.640034', 'avc1.640033', 'avc1.640028', 'avc1.4d0028', 'avc1.42e01f', 'avc1.42001f'];

export async function pickVideoCodec(width, height, fps, bitrate, hardware = 'no-preference', container = 'mp4') {
  if (typeof VideoEncoder === 'undefined') return null;
  const tries = container === 'webm'
    ? [['vp9', 'vp09.00.40.08'], ['vp9', 'vp09.00.10.08'], ['vp8', 'vp8']]
    : [...AVC.map((c) => ['avc', c]), ['vp9', 'vp09.00.40.08'], ['vp9', 'vp09.00.10.08'], ['av1', 'av01.0.08M.08']];
  for (const [kind, codec] of tries) {
    for (const hw of [hardware, 'no-preference']) {
      const config = { codec, width, height, bitrate, framerate: fps, hardwareAcceleration: hw, latencyMode: 'quality' };
      if (kind === 'avc') config.avc = { format: 'avc' };
      try {
        const s = await VideoEncoder.isConfigSupported(config);
        if (s.supported) return { kind, codec, config: s.config || config };
      } catch { /* configuration refusée */ }
    }
  }
  return null;
}

export async function pickAudioCodec(sampleRate, channels, container = 'mp4') {
  if (typeof AudioEncoder === 'undefined') return null;
  const tries = container === 'webm' ? [['opus', 'opus']] : [['aac', 'mp4a.40.2'], ['opus', 'opus']];
  for (const [kind, codec] of tries) {
    const config = { codec, sampleRate, numberOfChannels: channels, bitrate: 192000 };
    try { const s = await AudioEncoder.isConfigSupported(config); if (s.supported) return { kind, codec, config: s.config || config }; } catch { /* */ }
  }
  return null;
}

export async function detectCapabilities() {
  const caps = {
    webgl2: (() => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } })(),
    webcodecs: typeof VideoEncoder !== 'undefined',
    audioEncoder: typeof AudioEncoder !== 'undefined',
    offscreenCanvas: typeof OffscreenCanvas !== 'undefined',
    mediaRecorder: typeof MediaRecorder !== 'undefined',
    mediaRecorderMp4: typeof MediaRecorder !== 'undefined' && (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1') || MediaRecorder.isTypeSupported('video/mp4')),
    mediaRecorderWebm: typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/webm'),
    sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined' && self.crossOriginIsolated === true,
    fileSystemAccess: typeof window.showSaveFilePicker === 'function',
    opfs: !!navigator.storage?.getDirectory,
    webmcp: !!navigator.modelContext,
    codecs: {},
  };
  const v = await pickVideoCodec(1920, 1080, 30, 8e6, 'prefer-hardware');
  caps.codecs.video = v ? v.codec : null;
  caps.codecs.h264 = !!(v && v.kind === 'avc');
  const a = await pickAudioCodec(48000, 2);
  caps.codecs.audio = a ? a.codec : null;
  caps.codecs.aac = !!(a && a.kind === 'aac');
  const v4k = await pickVideoCodec(3840, 2160, 30, 30e6, 'prefer-hardware');
  caps.max4k = !!v4k;
  caps.mp4Path = caps.webcodecs && v ? `WebCodecs (${v.kind === 'avc' ? 'H.264' : v.kind.toUpperCase()}${a ? ` + ${a.kind === 'aac' ? 'AAC' : 'Opus'}` : ''}) → MP4` : caps.mediaRecorderMp4 ? 'MediaRecorder MP4 (temps réel)' : caps.mediaRecorderWebm ? 'MediaRecorder WebM → ffmpeg.wasm → MP4' : 'Aucun encodeur vidéo disponible';
  return caps;
}
