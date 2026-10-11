// Écriture d'archives ZIP (méthode "stored", CRC32) — séquences PNG et projets .motion.zip
const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
export function crc32(bytes) { let c = 0xffffffff; for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

export class ZipWriter {
  constructor() { this.files = []; }
  async add(name, data) {
    const bytes = data instanceof Uint8Array ? data : typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(await data.arrayBuffer());
    this.files.push({ name: new TextEncoder().encode(name), bytes, crc: crc32(bytes) });
  }
  blob() {
    const parts = [];
    const central = [];
    let offset = 0;
    for (const f of this.files) {
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint32(14, f.crc, true); lh.setUint32(18, f.bytes.length, true); lh.setUint32(22, f.bytes.length, true); lh.setUint16(26, f.name.length, true);
      parts.push(lh.buffer, f.name, f.bytes);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
      ch.setUint32(16, f.crc, true); ch.setUint32(20, f.bytes.length, true); ch.setUint32(24, f.bytes.length, true); ch.setUint16(28, f.name.length, true); ch.setUint32(42, offset, true);
      central.push(ch.buffer, f.name);
      offset += 30 + f.name.length + f.bytes.length;
    }
    const csize = central.reduce((s, p) => s + (p.byteLength ?? p.length), 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, this.files.length, true); end.setUint16(10, this.files.length, true); end.setUint32(12, csize, true); end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' });
  }
}

// Lecture minimale d'un zip "stored" (import .motion.zip produit par l'application)
export async function readZip(blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  const dv = new DataView(buf.buffer);
  const out = {};
  let o = 0;
  while (o + 30 <= buf.length && dv.getUint32(o, true) === 0x04034b50) {
    const method = dv.getUint16(o + 8, true), size = dv.getUint32(o + 18, true), nlen = dv.getUint16(o + 26, true), xlen = dv.getUint16(o + 28, true);
    const name = new TextDecoder().decode(buf.subarray(o + 30, o + 30 + nlen));
    const start = o + 30 + nlen + xlen;
    if (method !== 0) throw new Error('Archive compressée non prise en charge (utilisez l\'export .motion.zip de Motion Studio).');
    out[name] = buf.slice(start, start + size);
    o = start + size;
  }
  return out;
}
