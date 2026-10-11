// 20 LUTs intégrées, définies paramétriquement (lift/gamma/gain/saturation/contraste/split-toning).
// Elles sont compilées en GLSL pour l'effet "lut" et peuvent être exportées en .cube.
export const BUILTIN_LUTS = [
  { id: 'cinema-chaud', name: 'Cinéma chaud', lift: [0.02, 0.0, -0.02], gamma: [1.02, 1.0, 0.96], gain: [1.08, 1.0, 0.9], sat: 1.05, con: 1.08, sh: [0.0, 0.0, 0.0], hi: [0.05, 0.02, -0.03] },
  { id: 'teal-orange', name: 'Teal & Orange', lift: [-0.02, 0.02, 0.05], gamma: [1.0, 1.0, 1.0], gain: [1.1, 1.0, 0.88], sat: 1.15, con: 1.1, sh: [-0.04, 0.03, 0.08], hi: [0.08, 0.03, -0.06] },
  { id: 'vintage-70', name: 'Vintage 70s', lift: [0.08, 0.05, 0.02], gamma: [1.05, 1.0, 0.92], gain: [0.98, 0.95, 0.8], sat: 0.8, con: 0.9, sh: [0.03, 0.02, 0.0], hi: [0.04, 0.03, -0.02] },
  { id: 'nb-contraste', name: 'N&B contrasté', lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1], sat: 0.0, con: 1.35, sh: [0, 0, 0], hi: [0, 0, 0] },
  { id: 'bleach', name: 'Bleach bypass', lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1.02, 1.02, 1.02], sat: 0.45, con: 1.3, sh: [0, 0, 0.01], hi: [0, 0, 0] },
  { id: 'film-2383', name: 'Film 2383', lift: [0.01, 0.01, 0.03], gamma: [1.0, 0.98, 0.95], gain: [1.05, 1.0, 0.92], sat: 1.0, con: 1.15, sh: [0.0, 0.02, 0.05], hi: [0.04, 0.01, -0.04] },
  { id: 'fuji', name: 'Fuji doux', lift: [0.0, 0.02, 0.02], gamma: [0.98, 1.02, 1.0], gain: [0.98, 1.03, 1.0], sat: 0.95, con: 1.02, sh: [0.0, 0.03, 0.02], hi: [0.0, 0.02, 0.0] },
  { id: 'polaroid', name: 'Polaroid', lift: [0.1, 0.08, 0.06], gamma: [1.0, 1.0, 1.05], gain: [0.95, 0.95, 0.9], sat: 0.75, con: 0.85, sh: [0.02, 0.0, 0.04], hi: [0.05, 0.04, 0.0] },
  { id: 'matin-froid', name: 'Matin froid', lift: [0.0, 0.02, 0.06], gamma: [0.97, 1.0, 1.05], gain: [0.92, 1.0, 1.08], sat: 0.9, con: 1.0, sh: [0, 0.01, 0.05], hi: [-0.02, 0.0, 0.04] },
  { id: 'coucher-soleil', name: 'Coucher de soleil', lift: [0.05, 0.0, 0.03], gamma: [1.06, 1.0, 0.94], gain: [1.12, 0.98, 0.85], sat: 1.2, con: 1.05, sh: [0.04, 0.0, 0.05], hi: [0.1, 0.04, -0.05] },
  { id: 'cyberpunk', name: 'Cyberpunk', lift: [0.04, -0.02, 0.08], gamma: [1.05, 0.95, 1.08], gain: [1.1, 0.9, 1.15], sat: 1.3, con: 1.15, sh: [0.06, 0.0, 0.1], hi: [0.08, -0.02, 0.06] },
  { id: 'matrix', name: 'Matrix', lift: [-0.02, 0.03, -0.02], gamma: [0.95, 1.08, 0.95], gain: [0.88, 1.08, 0.88], sat: 0.85, con: 1.15, sh: [0.0, 0.05, 0.0], hi: [-0.02, 0.05, -0.02] },
  { id: 'desature', name: 'Désaturé', lift: [0.01, 0.01, 0.01], gamma: [1, 1, 1], gain: [1, 1, 1], sat: 0.55, con: 1.05, sh: [0, 0, 0], hi: [0, 0, 0] },
  { id: 'sepia-doux', name: 'Sépia doux', lift: [0.04, 0.02, 0.0], gamma: [1.02, 1.0, 0.95], gain: [1.05, 0.98, 0.85], sat: 0.35, con: 1.0, sh: [0.03, 0.01, -0.01], hi: [0.05, 0.03, 0.0] },
  { id: 'cross', name: 'Cross process', lift: [0.0, 0.0, 0.08], gamma: [1.05, 0.95, 1.1], gain: [1.05, 1.08, 0.85], sat: 1.25, con: 1.2, sh: [0.0, 0.0, 0.08], hi: [0.04, 0.06, -0.08] },
  { id: 'nuit-americaine', name: 'Nuit américaine', lift: [-0.03, -0.01, 0.04], gamma: [0.8, 0.85, 1.0], gain: [0.55, 0.65, 0.9], sat: 0.6, con: 1.1, sh: [0, 0, 0.06], hi: [0, 0.02, 0.06] },
  { id: 'pastel', name: 'Pastel', lift: [0.1, 0.1, 0.12], gamma: [1.05, 1.05, 1.05], gain: [0.95, 0.95, 0.97], sat: 0.7, con: 0.8, sh: [0.02, 0.0, 0.04], hi: [0.03, 0.02, 0.02] },
  { id: 'blockbuster', name: 'Blockbuster', lift: [-0.03, 0.0, 0.03], gamma: [1.0, 1.0, 1.0], gain: [1.12, 1.02, 0.9], sat: 1.1, con: 1.25, sh: [-0.03, 0.02, 0.07], hi: [0.07, 0.02, -0.05] },
  { id: 'western', name: 'Western', lift: [0.06, 0.03, -0.02], gamma: [1.08, 1.0, 0.88], gain: [1.1, 0.98, 0.75], sat: 0.85, con: 1.12, sh: [0.03, 0.01, -0.02], hi: [0.06, 0.03, -0.04] },
  { id: 'neo-noir', name: 'Néo-noir', lift: [0.0, 0.0, 0.03], gamma: [0.95, 0.95, 1.0], gain: [0.95, 0.98, 1.05], sat: 0.25, con: 1.4, sh: [0, 0, 0.04], hi: [0.02, 0.0, -0.02] },
];

const v3 = (a) => `vec3(${a.map((x) => x.toFixed(4)).join(',')})`;

// GLSL : vec3 lutGrade(vec3 c, int look)
export function lutGLSL() {
  const branches = BUILTIN_LUTS.map((l, i) => `  if(look==${i}){ L=${v3(l.lift)}; G=${v3(l.gamma)}; N=${v3(l.gain)}; sat=${l.sat.toFixed(3)}; con=${l.con.toFixed(3)}; sh=${v3(l.sh)}; hi=${v3(l.hi)}; }`).join('\n');
  return `
vec3 lutGrade(vec3 c, int look){
  vec3 L=vec3(0.), G=vec3(1.), N=vec3(1.), sh=vec3(0.), hi=vec3(0.); float sat=1., con=1.;
${branches}
  c = c*N + L*(1.-c);
  c = pow(max(c,0.), 1./G);
  float l = luma(c);
  c = c + sh*(1.-smoothstep(0.,0.5,l)) + hi*smoothstep(0.5,1.,l);
  c = (c-0.5)*con+0.5;
  c = mix(vec3(luma(c)), c, sat);
  return clamp(c,0.,1.);
}`;
}

// Évaluation JS d'une LUT (pour l'export .cube et les tests)
export function lutGradeJS(c, look) {
  const l = BUILTIN_LUTS[look];
  const luma = (v) => 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  let v = c.map((x, i) => x * l.gain[i] + l.lift[i] * (1 - x));
  v = v.map((x, i) => Math.pow(Math.max(x, 0), 1 / l.gamma[i]));
  const lu = luma(v);
  v = v.map((x, i) => x + l.sh[i] * (1 - ss(0, 0.5, lu)) + l.hi[i] * ss(0.5, 1, lu));
  v = v.map((x) => (x - 0.5) * l.con + 0.5);
  const lu2 = luma(v);
  return v.map((x) => Math.min(1, Math.max(0, lu2 + (x - lu2) * l.sat)));
}

export function lutToCube(look, size = 33) {
  const l = BUILTIN_LUTS[look];
  let out = `TITLE "${l.name}"\nLUT_3D_SIZE ${size}\n`;
  for (let b = 0; b < size; b++) for (let g = 0; g < size; g++) for (let r = 0; r < size; r++) {
    const v = lutGradeJS([r / (size - 1), g / (size - 1), b / (size - 1)], look);
    out += `${v[0].toFixed(5)} ${v[1].toFixed(5)} ${v[2].toFixed(5)}\n`;
  }
  return out;
}

// Parse d'un fichier .cube → {size, data: Float32Array(size^3*3)}
export function parseCube(text) {
  let size = 0;
  const data = [];
  let domainMin = [0, 0, 0], domainMax = [1, 1, 1];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('TITLE')) continue;
    if (line.startsWith('LUT_3D_SIZE')) { size = parseInt(line.split(/\s+/)[1], 10); continue; }
    if (line.startsWith('LUT_1D_SIZE')) throw new Error('Les LUT 1D ne sont pas prises en charge (utilisez une LUT 3D .cube).');
    if (line.startsWith('DOMAIN_MIN')) { domainMin = line.split(/\s+/).slice(1).map(Number); continue; }
    if (line.startsWith('DOMAIN_MAX')) { domainMax = line.split(/\s+/).slice(1).map(Number); continue; }
    const nums = line.split(/\s+/).map(Number);
    if (nums.length >= 3 && nums.every(Number.isFinite)) data.push(nums[0], nums[1], nums[2]);
  }
  if (!size || data.length !== size * size * size * 3) throw new Error(`Fichier .cube invalide (taille ${size}, ${data.length / 3} entrées)`);
  for (let i = 0; i < data.length; i++) {
    const ch = i % 3;
    data[i] = (data[i] - domainMin[ch]) / ((domainMax[ch] - domainMin[ch]) || 1);
  }
  return { size, data: Float32Array.from(data) };
}
