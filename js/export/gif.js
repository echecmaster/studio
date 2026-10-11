// Encodeur GIF animé (palette 6×7×6 + tramage ordonné, compression LZW) — sans dépendance
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16 - 0.5);
const PAL = [];
for (let r = 0; r < 6; r++) for (let g = 0; g < 7; g++) for (let b = 0; b < 6; b++) PAL.push([Math.round((r * 255) / 5), Math.round((g * 255) / 6), Math.round((b * 255) / 5)]);
while (PAL.length < 256) PAL.push([0, 0, 0]);

class ByteWriter {
  constructor() { this.chunks = []; this.buf = new Uint8Array(1 << 16); this.pos = 0; }
  byte(b) { if (this.pos >= this.buf.length) this.flush(); this.buf[this.pos++] = b; }
  bytes(arr) { for (const b of arr) this.byte(b); }
  u16(v) { this.byte(v & 255); this.byte((v >> 8) & 255); }
  str(s) { for (const c of s) this.byte(c.charCodeAt(0)); }
  flush() { this.chunks.push(this.buf.slice(0, this.pos)); this.pos = 0; }
  blob() { this.flush(); return new Blob(this.chunks, { type: 'image/gif' }); }
}

function lzw(indices, minCode, out) {
  const clear = 1 << minCode, eoi = clear + 1;
  let codeSize = minCode + 1, next = eoi + 1;
  let dict = new Map();
  let cur = 0, bits = 0;
  const block = [];
  const write = (code) => {
    cur |= code << bits; bits += codeSize;
    while (bits >= 8) { block.push(cur & 255); cur >>>= 8; bits -= 8; if (block.length === 255) { out.byte(255); out.bytes(block); block.length = 0; } }
  };
  const emit = (code) => {
    write(code);
    if (next > (1 << codeSize) - 1 && codeSize < 12) codeSize++;
  };
  write(clear);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = prefix * 256 + k;
    const found = dict.get(key);
    if (found !== undefined) { prefix = found; continue; }
    emit(prefix);
    if (next < 4096) dict.set(key, next++);
    else { write(clear); dict = new Map(); codeSize = minCode + 1; next = eoi + 1; }
    prefix = k;
  }
  emit(prefix);
  write(eoi);
  if (bits > 0) block.push(cur & 255);
  if (block.length) { out.byte(block.length); out.bytes(block); }
  out.byte(0);
}

export class GifEncoder {
  constructor(width, height, fps) {
    this.w = width; this.h = height; this.delay = Math.max(2, Math.round(100 / fps));
    this.out = new ByteWriter();
    const o = this.out;
    o.str('GIF89a'); o.u16(width); o.u16(height);
    o.byte(0xf7); o.byte(0); o.byte(0);
    for (const c of PAL) o.bytes(c);
    o.byte(0x21); o.byte(0xff); o.byte(11); o.str('NETSCAPE2.0'); o.byte(3); o.byte(1); o.u16(0); o.byte(0);
  }
  addFrame(rgba) {
    const { w, h, out: o } = this;
    const idx = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const d = BAYER[(y & 3) * 4 + (x & 3)];
      const r = Math.max(0, Math.min(5, Math.round((rgba[i] / 255) * 5 + d)));
      const g = Math.max(0, Math.min(6, Math.round((rgba[i + 1] / 255) * 6 + d)));
      const b = Math.max(0, Math.min(5, Math.round((rgba[i + 2] / 255) * 5 + d)));
      idx[y * w + x] = r * 42 + g * 6 + b;
    }
    o.byte(0x21); o.byte(0xf9); o.byte(4); o.byte(0); o.u16(this.delay); o.byte(0); o.byte(0);
    o.byte(0x2c); o.u16(0); o.u16(0); o.u16(w); o.u16(h); o.byte(0);
    o.byte(8);
    lzw(idx, 8, o);
  }
  finish() { this.out.byte(0x3b); return this.out.blob(); }
}
