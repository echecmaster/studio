// Moteur de rendu WebGL2 : renderFrame(project, t) est une fonction pure de (projet, temps) → image.
// Pipeline (espace linéaire, alpha prémultiplié) : source du calque → placement 2.5D/3D → effets → masques → transition
// → track matte → profondeur de champ → fusion (27 modes) avec le fond → calques d'ajustement → sortie sRGB.
import { VERT, VERT_PLACE, HEADER, HELPERS, OUT } from './shaders/common.js';
import { createProgram, FBOPool, createTexture, uploadSource, mat4, GLError } from './gl.js';
import { EFFECT_MAP } from '../catalog/effects.js';
import { TRANSITION_MAP } from '../catalog/transitions.js';
import { GENERATOR_MAP } from '../catalog/generators.js';
import { BLEND_GLSL, BLEND_INDEX } from '../catalog/blendModes.js';
import { parseShaderParams } from '../catalog/shaders.js';
import { visibleClipsAt, resolveClip, makeLayerLookup, makeControlLookup, isActiveAt } from '../core/evaluate.js';
import { hexToRgb, hashString, noise1, mulberry32 } from '../core/util.js';
import { getEasing } from '../catalog/easings.js';
import { DRAWERS } from './layers.js';
import { flattenPath } from '../core/path.js';

const MEDIA_KINDS = new Set(['image', 'video', 'svg']);
const NON_VISUAL = new Set(['audio', 'null', 'camera']);
const TIME_STATIC = new Set(['shape']);

const BLEND_FS = `${HEADER}${HELPERS}${BLEND_GLSL}
uniform sampler2D uLayer;
uniform float uOpacity;
uniform int uMode;
void main(){
  vec4 b = texture(uTex, vUv);
  vec4 s = texture(uLayer, vUv) * uOpacity;
  if(uMode==1){ float h=hash12(gl_FragCoord.xy+uSeed); float a=step(h, s.a/max(uOpacity,1e-4)*uOpacity); s = s.a>0.0 ? vec4(s.rgb/s.a, 1.0)*a : vec4(0.0); }
  if(uMode<=1){ outColor = s + b*(1.0-s.a); return; }
  vec3 cb = b.a>1e-5 ? toSRGB(b.rgb/b.a) : vec3(0.0);
  vec3 cs = s.a>1e-5 ? toSRGB(s.rgb/s.a) : vec3(0.0);
  vec3 B = toLin(clamp(blendRGB(cb, cs, uMode),0.0,1.0));
  vec3 co = s.rgb*(1.0-b.a) + b.rgb*(1.0-s.a) + s.a*b.a*B;
  outColor = vec4(co, s.a + b.a*(1.0-s.a));
}`;

const COPY_FS = `${HEADER}${HELPERS}
uniform float uMul;
void main(){ outColor = texture(uTex, vUv) * uMul; }`;

const ADD_FS = `${HEADER}${HELPERS}
uniform sampler2D uLayer; uniform float uW;
void main(){ outColor = texture(uTex, vUv) + texture(uLayer, vUv) * uW; }`;

const MASK_FS = `${HEADER}${HELPERS}
uniform sampler2D uLayer; uniform int uMatte; uniform float uMix;
void main(){
  vec4 c = texture(uTex, vUv);
  vec4 m = texture(uLayer, vUv);
  float k;
  if(uMatte==0) k = m.a;
  else if(uMatte==1) k = 1.0-m.a;
  else if(uMatte==2) k = luma(m.a>1e-5? toSRGB(m.rgb/m.a):vec3(0.0))*m.a;
  else k = 1.0 - luma(m.a>1e-5? toSRGB(m.rgb/m.a):vec3(0.0))*m.a;
  outColor = c * mix(1.0, k, uMix);
}`;

const ADJ_FS = `${HEADER}${HELPERS}
uniform sampler2D uLayer; uniform sampler2D uMaskTex; uniform float uOpacity; uniform float uUseMask;
void main(){
  vec4 b = texture(uTex, vUv);
  vec4 a = texture(uLayer, vUv);
  float m = uUseMask>0.5 ? texture(uMaskTex, vUv).a : 1.0;
  outColor = mix(b, a, uOpacity*m);
}`;

const PLACE_FS = `#version 300 es
precision highp float;
uniform sampler2D uTex; uniform float uFlip; uniform vec4 uCrop;
in vec2 vUv; out vec4 outColor;
void main(){
  vec2 uv = mix(uCrop.xy, uCrop.zw, vUv);
  vec4 c = texture(uTex, uv);
  if(uFlip>0.5){ c.rgb = mix(c.rgb/12.92, pow((c.rgb/max(c.a,1e-5)+0.055)/1.055, vec3(2.4))*c.a, step(0.04045*c.a, c.rgb)); }
  outColor = c;
}`;

// Sortie écran : linéaire prémultiplié → sRGB, vues alpha / comparaison
const OUT_FS = `${HEADER}${HELPERS}
uniform sampler2D uLayer; uniform int uView; uniform float uSplit; uniform float uHasCompare;
void main(){
  vec4 c = texture(uTex, vUv);
  if(uHasCompare>0.5 && vUv.x > uSplit) c = texture(uLayer, vUv);
  if(uView==1){ outColor = vec4(vec3(c.a),1.0); return; }
  vec3 s = c.a>1e-5 ? toSRGB(c.rgb/c.a) : vec3(0.0);
  if(uHasCompare>0.5 && abs(vUv.x-uSplit) < 0.0015){ outColor = vec4(0.14,0.82,0.43,1.0); return; }
  outColor = vec4(s*c.a, c.a);
}`;

function paramDecl(params) {
  return params.map((p) => {
    if (p.type === 'color') return `uniform vec3 p_${p.name};`;
    if (p.type === 'point') return `uniform vec2 p_${p.name};`;
    if (p.type === 'asset' || p.type === 'code') return '';
    return `uniform float p_${p.name};`;
  }).join('\n');
}

const SHADERTOY_HEADER = `#version 300 es
precision highp float;
precision highp int;
uniform vec3 iResolution; uniform float iTime; uniform float iTimeDelta; uniform int iFrame; uniform vec4 iMouse; uniform vec4 iDate;
uniform sampler2D iChannel0; uniform sampler2D iChannel1; uniform sampler2D iChannel2; uniform sampler2D iChannel3;
uniform vec3 iChannelResolution[4];
uniform float uForceAlpha;
out vec4 ms_out;
`;
const SHADERTOY_FOOTER = `
vec3 ms_toLin(vec3 c){ c=clamp(c,0.0,1.0); return mix(c/12.92, pow((c+0.055)/1.055, vec3(2.4)), step(0.04045, c)); }
void main(){ vec4 c=vec4(0.0,0.0,0.0,1.0); mainImage(c, gl_FragCoord.xy); float a = uForceAlpha>0.5 ? 1.0 : clamp(c.a,0.0,1.0); ms_out = vec4(ms_toLin(c.rgb)*a, a); }`;
const SHADERTOY_LINES = SHADERTOY_HEADER.split('\n').length - 1;

export class Renderer {
  constructor(canvas, { media, audio, log, offscreen = false } = {}) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, alpha: true, antialias: false, preserveDrawingBuffer: offscreen, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL2 indisponible dans ce navigateur.');
    this.gl = gl;
    this.media = media;
    this.audio = audio;
    this.log = log || (() => {});
    this.float = !!gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('OES_texture_float_linear');
    this.pool = new FBOPool(gl, this.float);
    this.programs = new Map();
    this.layerCache = new Map(); // clipId -> {tex, key, w, h}
    this.mediaTex = new Map();   // assetId/role -> tex
    this.auxTex = new Map();
    this.errors = new Map();     // clipId/effectId -> message
    this.stats = { frameMs: 0, layers: 0, passes: 0, fps: 0 };
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    this.scratch = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(16, 16) : document.createElement('canvas');
    this.scratchCtx = this.scratch.getContext('2d');
    this.lost = false;
    canvas.addEventListener?.('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; if (!this.disposed) this.log('error', 'Contexte WebGL perdu — rechargement des ressources…'); });
    canvas.addEventListener?.('webglcontextrestored', () => { this.lost = false; this.programs.clear(); this.layerCache.clear(); this.mediaTex.clear(); this.pool = new FBOPool(gl, this.float); });
  }

  // ---------------------------------------------------------------- programmes
  program(key, fsBuilder, vs = VERT, lineOffset = 0) {
    let p = this.programs.get(key);
    if (p) return p;
    try {
      p = createProgram(this.gl, vs, fsBuilder(), lineOffset);
    } catch (e) {
      p = { error: e };
    }
    this.programs.set(key, p);
    return p;
  }

  effectProgram(def) {
    return this.program(`fx:${def.id}`, () => `${HEADER}${HELPERS}${paramDecl(def.params)}\n${def.glsl}\n${OUT}\nvoid main(){ outColor = finalize(fx(vUv)); }`);
  }
  transitionProgram(def) {
    return this.program(`tr:${def.id}`, () => `${HEADER}${HELPERS}uniform float uP;\n${paramDecl(def.params)}\n${def.glsl}\n${OUT}\nvoid main(){ outColor = finalize(tr(vUv, uP)); }`);
  }
  generatorProgram(def) {
    return this.program(`gen:${def.id}`, () => `${HEADER}${HELPERS}${paramDecl(def.params)}\n${def.glsl}\n${OUT}\nvoid main(){ outColor = finalize(gen(vUv)); }`);
  }
  shadertoyProgram(code) {
    const key = `st:${hashString(code)}:${code.length}`;
    return this.program(key, () => `${SHADERTOY_HEADER}${code}\n${SHADERTOY_FOOTER}`, VERT, SHADERTOY_LINES);
  }

  // Compile un shader utilisateur et renvoie les erreurs ligne par ligne
  validateShader(code) {
    try {
      createProgram(this.gl, VERT, `${SHADERTOY_HEADER}${code}\n${SHADERTOY_FOOTER}`, SHADERTOY_LINES);
      return [];
    } catch (e) {
      return e instanceof GLError ? e.errors : [{ line: 0, message: e.message }];
    }
  }

  // Compile tous les effets / transitions / générateurs (test d'acceptation)
  compileAll() {
    const failures = [];
    const check = (kind, id, p) => { if (p.error) failures.push({ kind, id, error: p.error.message }); };
    for (const def of Object.values(EFFECT_MAP)) if (def.glsl) check('effect', def.id, this.effectProgram(def));
    for (const def of Object.values(TRANSITION_MAP)) check('transition', def.id, this.transitionProgram(def));
    for (const def of Object.values(GENERATOR_MAP)) check('generator', def.id, this.generatorProgram(def));
    for (const k of ['blend', 'copy', 'add', 'mask', 'adj', 'out']) check('core', k, this.coreProgram(k));
    check('core', 'place', this.program('place', () => PLACE_FS, VERT_PLACE));
    return failures;
  }

  coreProgram(k) {
    const src = { blend: BLEND_FS, copy: COPY_FS, add: ADD_FS, mask: MASK_FS, adj: ADJ_FS, out: OUT_FS }[k];
    return this.program(`core:${k}`, () => src);
  }

  // ---------------------------------------------------------------- passes
  pass(prog, target, uniforms = {}, textures = {}) {
    const gl = this.gl;
    if (prog.error) throw prog.error;
    gl.useProgram(prog.program);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null);
    const w = target ? target.w : this.canvas.width, h = target ? target.h : this.canvas.height;
    gl.viewport(0, 0, w, h);
    let unit = 0;
    for (const [name, tex] of Object.entries(textures)) {
      const loc = prog.uniforms[name];
      if (loc === undefined) continue;
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(loc, unit);
      unit++;
    }
    for (const [name, v] of Object.entries(uniforms)) {
      const loc = prog.uniforms[name];
      if (loc === undefined || loc === null) continue;
      if (typeof v === 'number') { if (name === 'uMode' || name === 'uView' || name === 'uMatte' || name === 'iFrame') gl.uniform1i(loc, v); else gl.uniform1f(loc, v); }
      else if (v.length === 2) gl.uniform2fv(loc, v);
      else if (v.length === 3) gl.uniform3fv(loc, v);
      else if (v.length === 4) gl.uniform4fv(loc, v);
      else if (v.length === 16) gl.uniformMatrix4fv(loc, false, v);
      else if (v.length === 12) gl.uniform3fv(loc, v);
    }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    this.stats.passes++;
  }

  clear(fbo, rgba = [0, 0, 0, 0]) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo ? fbo.fb : null);
    gl.viewport(0, 0, fbo ? fbo.w : this.canvas.width, fbo ? fbo.h : this.canvas.height);
    gl.clearColor(...rgba);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  setParamUniforms(params, values, bounds, out) {
    for (const p of params) {
      let v = values?.[p.name] ?? p.default;
      if (p.type === 'color') out[`p_${p.name}`] = hexToRgb(v);
      else if (p.type === 'point') {
        const x = Array.isArray(v) ? v[0] : 0.5, y = Array.isArray(v) ? v[1] : 0.5;
        out[`p_${p.name}`] = [bounds[0] + x * (bounds[2] - bounds[0]), bounds[3] - y * (bounds[3] - bounds[1])];
      } else if (p.type === 'select') { const i = p.options.indexOf(v); out[`p_${p.name}`] = i >= 0 ? i : (typeof v === 'number' ? v : 0); }
      else if (p.type === 'bool') out[`p_${p.name}`] = v ? 1 : 0;
      else if (p.type === 'asset' || p.type === 'code') continue;
      else out[`p_${p.name}`] = Number(v) || 0;
    }
    return out;
  }

  // ---------------------------------------------------------------- textures auxiliaires (LUT, cartes)
  auxTexture(assetId, kind) {
    if (!assetId || !this.media) return null;
    const key = `${kind}:${assetId}`;
    if (this.auxTex.has(key)) return this.auxTex.get(key);
    const gl = this.gl;
    if (kind === 'lut') {
      const lut = this.media.getLut(assetId);
      if (!lut) return null;
      const N = lut.size;
      const data = new Uint8Array(N * N * N * 4);
      for (let b = 0; b < N; b++) for (let g = 0; g < N; g++) for (let r = 0; r < N; r++) {
        const src = (b * N * N + g * N + r) * 3, x = r + b * N, y = g, dst = (y * N * N + x) * 4;
        data[dst] = Math.round(Math.min(1, Math.max(0, lut.data[src])) * 255);
        data[dst + 1] = Math.round(Math.min(1, Math.max(0, lut.data[src + 1])) * 255);
        data[dst + 2] = Math.round(Math.min(1, Math.max(0, lut.data[src + 2])) * 255);
        data[dst + 3] = 255;
      }
      const tex = createTexture(gl);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, N * N, N, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
      const o = { tex, size: [N * N, N] };
      this.auxTex.set(key, o);
      return o;
    }
    const img = this.media.getImage(assetId);
    if (!img) return null;
    const tex = createTexture(gl);
    uploadSource(gl, tex, img);
    const o = { tex, size: [img.naturalWidth || img.width, img.naturalHeight || img.height] };
    this.auxTex.set(key, o);
    return o;
  }

  // ---------------------------------------------------------------- géométrie / matrices
  // Boîte naturelle d'un clip résolu (px) + marge
  layerBox(r, env) {
    const d = DRAWERS[r.kind];
    if (d) return d.box(r, env);
    const p = r.props;
    const W = env.W, H = env.H;
    if (MEDIA_KINDS.has(r.kind)) {
      const a = env.project.assets.find((x) => x.id === p.assetId);
      let nw = a?.meta?.width || 640, nh = a?.meta?.height || 360;
      if (p.width > 0 && p.height > 0) return { w: p.width, h: p.height, pad: 0 };
      if (p.width > 0) return { w: p.width, h: (p.width * nh) / nw, pad: 0 };
      if (p.height > 0) return { w: (p.height * nw) / nh, h: p.height, pad: 0 };
      const fit = p.fit || 'contain';
      if (fit === 'stretch') return { w: W, h: H, pad: 0 };
      if (fit === 'none') return { w: nw, h: nh, pad: 0 };
      const s = fit === 'cover' ? Math.max(W / nw, H / nh) : Math.min(W / nw, H / nh);
      return { w: nw * s, h: nh * s, pad: 0 };
    }
    return { w: p.width || W, h: p.height || H, pad: 0 };
  }

  localMatrix(r, box, parentAnchor) {
    const tr = r.transform;
    const rad = Math.PI / 180;
    const ax = (tr.anchorX ?? 0.5) * box.w, ay = (tr.anchorY ?? 0.5) * box.h;
    let m = mat4.translate(parentAnchor[0] + tr.x, parentAnchor[1] + tr.y, tr.z || 0);
    m = mat4.mul(m, mat4.rotZ((tr.rotation || 0) * rad));
    if (tr.rotationY) m = mat4.mul(m, mat4.rotY(tr.rotationY * rad));
    if (tr.rotationX) m = mat4.mul(m, mat4.rotX(tr.rotationX * rad));
    if (tr.skewX || tr.skewY) m = mat4.mul(m, mat4.skew((tr.skewX || 0) * rad, (tr.skewY || 0) * rad));
    m = mat4.mul(m, mat4.scale((tr.scale ?? 1) * (tr.scaleX ?? 1), (tr.scale ?? 1) * (tr.scaleY ?? 1), 1));
    m = mat4.mul(m, mat4.translate(-ax, -ay, 0));
    return m;
  }

  worldMatrix(r, box, env, depth = 0) {
    if (!r.parentId || depth > 16) return this.localMatrix(r, box, [env.W / 2, env.H / 2]);
    const parent = env.project.clips.find((c) => c.id === r.parentId);
    if (!parent) return this.localMatrix(r, box, [env.W / 2, env.H / 2]);
    const pr = env.resolved.get(parent.id) || resolveClip(parent, env.t, env.resolveEnv);
    env.resolved.set(parent.id, pr);
    const pbox = env.boxes.get(parent.id) || (NON_VISUAL.has(parent.kind) ? { w: 0, h: 0, pad: 0 } : this.layerBox(pr, env));
    env.boxes.set(parent.id, pbox);
    const pm = this.worldMatrix(pr, pbox, env, depth + 1);
    const panchor = [(pr.transform.anchorX ?? 0.5) * pbox.w, (pr.transform.anchorY ?? 0.5) * pbox.h];
    return mat4.mul(pm, this.localMatrix(r, box, panchor));
  }

  cameraMatrices(env) {
    const W = env.W, H = env.H;
    const cam = env.camera;
    const focal = cam?.props?.focal || 1500;
    let V = mat4.identity();
    if (cam) {
      const tr = cam.transform;
      let cx = tr.x || 0, cy = tr.y || 0, rot = tr.rotation || 0;
      const sh = cam.props.shake || {};
      if (sh.preset && sh.preset !== 'none') {
        const f = sh.frequency || 2, a = sh.amplitude || 10, t = env.t;
        cx += noise1(t * f, 11) * a + noise1(t * f * 2.7, 13) * a * 0.3;
        cy += noise1(t * f, 17) * a + noise1(t * f * 2.3, 19) * a * 0.3;
        rot += noise1(t * f * 0.8, 23) * (sh.rotation || 0);
      }
      if (cam.props.orbit?.enabled) {
        const ang = ((cam.props.orbit.speed || 20) * cam.localTime * Math.PI) / 180;
        cx += Math.sin(ang) * (cam.props.orbit.radius || 200);
        cy += (Math.cos(ang) - 1) * (cam.props.orbit.radius || 200) * 0.25;
      }
      const z = cam.props.zoom ?? 1;
      V = mat4.mul(mat4.translate(W / 2, H / 2, -(tr.z || 0)), mat4.mul(mat4.scale(z, z, 1), mat4.mul(mat4.rotZ((-rot * Math.PI) / 180), mat4.translate(-W / 2 - cx, -H / 2 - cy, 0))));
    }
    // projection perspective centrée : w = 1 + z / focale
    const P = [2 / W, 0, 0, 0, 0, -2 / H, 0, 0, 0, 0, 0, 1 / focal, -1, 1, 0, 1];
    return { V, P, focal };
  }

  // ---------------------------------------------------------------- sources de calques
  canvasSource(r, env, box, s) {
    const gl = this.gl;
    const d = DRAWERS[r.kind];
    const pad = box.pad || 0;
    const cw = Math.max(1, Math.min(4096, Math.ceil((box.w + 2 * pad) * s)));
    const ch = Math.max(1, Math.min(4096, Math.ceil((box.h + 2 * pad) * s)));
    const sx = cw / (box.w + 2 * pad), sy = ch / (box.h + 2 * pad);
    const timeDep = !TIME_STATIC.has(r.kind) && !(r.kind === 'text' && !r.props.animator);
    const key = `${cw}x${ch}|${JSON.stringify(r.props)}|${timeDep ? r.sourceTime.toFixed(4) + '|' + env.t.toFixed(4) : ''}|${env.fontsVersion || 0}`;
    let c = this.layerCache.get(env.cachePrefix + r.id);
    if (c && c.key === key) return { tex: c.tex, rect: [-pad, -pad, box.w + pad, box.h + pad] };
    if (!c) { c = { tex: createTexture(gl, { mipmap: true }) }; this.layerCache.set(env.cachePrefix + r.id, c); }
    const cv = this.scratch;
    if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; } else this.scratchCtx.clearRect(0, 0, cw, ch);
    const ctx = this.scratchCtx;
    ctx.save();
    ctx.setTransform(sx, 0, 0, sy, pad * sx, pad * sy);
    try { d.draw(ctx, r, { ...env, scale: Math.max(sx, sy) }, box); } catch (e) { this.reportError(r.id, `Dessin ${r.kind} : ${e.message}`); }
    ctx.restore();
    uploadSource(gl, c.tex, cv, { mipmap: true });
    c.key = key;
    return { tex: c.tex, rect: [-pad, -pad, box.w + pad, box.h + pad] };
  }

  mediaSource(r, env, box, s) {
    const gl = this.gl;
    const p = r.props;
    const id = p.assetId;
    if (!id || !this.media) return null;
    if (r.kind === 'svg') {
      const ras = this.media.getSvgRaster(id, Math.min(4096, box.w * s), Math.min(4096, box.h * s));
      if (!ras) return null;
      const key = `svg:${id}:${ras.width}x${ras.height}`;
      let t = this.mediaTex.get(env.cachePrefix + r.id);
      if (!t || t.key !== key) { t ||= { tex: createTexture(gl, { mipmap: true }) }; uploadSource(gl, t.tex, ras, { mipmap: true }); t.key = key; this.mediaTex.set(env.cachePrefix + r.id, t); }
      return { tex: t.tex, rect: [0, 0, box.w, box.h] };
    }
    if (r.kind === 'image') {
      const img = this.media.getImage(id);
      if (!img) return null;
      let t = this.mediaTex.get(`img:${id}`);
      if (!t) { t = { tex: createTexture(gl, { mipmap: true }) }; uploadSource(gl, t.tex, img, { mipmap: true }); this.mediaTex.set(`img:${id}`, t); }
      return { tex: t.tex, rect: [0, 0, box.w, box.h], ...this.coverCrop(p, img.naturalWidth, img.naturalHeight, box) };
    }
    if (r.kind === 'video') {
      const v = this.media.getVideo(id, env.videoRole);
      if (!v || v.readyState < 2) return null;
      if (env.videoRole === 'preview' && !env.playing) {
        const target = this.videoTime(r, v);
        if (Math.abs(v.currentTime - target) > 0.04 && !v.seeking) v.currentTime = target;
      }
      const k = `vid:${env.videoRole}:${id}`;
      let t = this.mediaTex.get(k);
      if (!t) { t = { tex: createTexture(gl) }; this.mediaTex.set(k, t); }
      uploadSource(gl, t.tex, v);
      return { tex: t.tex, rect: [0, 0, box.w, box.h], ...this.coverCrop(p, v.videoWidth, v.videoHeight, box) };
    }
    return null;
  }

  coverCrop(p, nw, nh, box) {
    if (p.fit !== 'cover' || p.width || p.height) return {};
    return {};
  }

  videoTime(r, v) {
    let s = r.sourceTime;
    if (r.props.loop && v.duration) s %= v.duration;
    return Math.max(0, Math.min((v.duration || 1e9) - 0.001, s));
  }

  glSource(r, env, box, s) {
    const gl = this.gl;
    const w = Math.max(1, Math.min(4096, Math.round(box.w * s))), h = Math.max(1, Math.min(4096, Math.round(box.h * s)));
    const fbo = this.pool.get(w, h);
    env.temp.push(fbo);
    if (r.kind === 'generator') {
      const def = GENERATOR_MAP[r.props.type];
      if (!def) { this.reportError(r.id, `Générateur inconnu : ${r.props.type}`); return null; }
      const prog = this.generatorProgram(def);
      if (prog.error) { this.reportError(r.id, prog.error.message); return null; }
      const u = this.setParamUniforms(def.params, r.props.params, [0, 0, 1, 1], { uRes: [box.w, box.h], uTime: r.sourceTime, uScale: s, uBounds: [0, 0, 1, 1], uSeed: 0 });
      this.pass(prog, fbo, u, {});
    } else if (r.kind === 'shader') {
      const prog = this.shadertoyProgram(r.props.code || '');
      if (prog.error) { this.reportError(r.id, prog.error.message); this.clear(fbo); return { tex: fbo.tex, rect: [0, 0, box.w, box.h], fbo: true }; }
      this.clearError(r.id);
      const u = { iResolution: [w, h, 1], iTime: r.sourceTime, iTimeDelta: 1 / env.fps, iFrame: Math.round(r.sourceTime * env.fps), iMouse: [(r.props.mouse?.[0] ?? 0.5) * w, (1 - (r.props.mouse?.[1] ?? 0.5)) * h, 0, 0], iDate: [2026, 0, 1, r.sourceTime], uForceAlpha: /@alpha/.test(r.props.code) ? 0 : 1 };
      const tex = {};
      const res = [];
      for (let i = 0; i < 4; i++) {
        const a = this.auxTexture(r.props.channels?.[i], 'image');
        tex[`iChannel${i}`] = a?.tex || this.blankTex();
        res.push(...(a ? [a.size[0], a.size[1], 1] : [1, 1, 1]));
      }
      u.iChannelResolution = res;
      for (const pp of parseShaderParams(r.props.code || '')) {
        const v = r.props.params?.[pp.name] ?? pp.default;
        u[pp.name] = pp.type === 'color' ? hexToRgb(v) : Number(v);
      }
      this.pass(prog, fbo, u, tex);
    } else if (r.kind === 'group') {
      const sub = { ...env.project, meta: { ...env.project.meta, width: r.props.width || env.W, height: r.props.height || env.H, background: 'transparent' }, tracks: r.props.tracks || [], clips: r.props.clips || [] };
      const inner = this.composite(sub, r.sourceTime, w, h, { ...env.opts, transparent: true, cachePrefix: `${env.cachePrefix}${r.id}/` });
      this.blit(inner, fbo);
      this.pool.release(inner);
    }
    return { tex: fbo.tex, rect: [0, 0, box.w, box.h], fbo: true };
  }

  blankTex() {
    if (!this._blank) {
      const gl = this.gl;
      this._blank = createTexture(gl);
      gl.bindTexture(gl.TEXTURE_2D, this._blank);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
    }
    return this._blank;
  }

  blit(src, dst, mul = 1) { this.pass(this.coreProgram('copy'), dst, { uMul: mul }, { uTex: src.tex }); }

  reportError(id, msg) { if (this.errors.get(id) !== msg) { this.errors.set(id, msg); this.log('error', msg); } }
  clearError(id) { this.errors.delete(id); }

  // ---------------------------------------------------------------- rendu d'un calque à un instant donné (comp space)
  renderLayer(clip, t, env) {
    const r = resolveClip(clip, t, env.resolveEnv);
    env.resolved.set(clip.id, r);
    const box = this.layerBox(r, env);
    env.boxes.set(clip.id, box);
    let world = this.worldMatrix(r, box, env);
    const { V, P } = env.cam;
    const MVP = mat4.mul(P, mat4.mul(V, world));
    // échelle effective pour rasteriser net
    const det = Math.abs(world[0] * world[5] - world[1] * world[4]);
    const camZoom = env.camera?.props?.zoom ?? 1;
    const persp = 1 / Math.max(0.05, 1 + (r.transform.z || 0) / env.cam.focal);
    const s = Math.max(0.02, Math.min(8, Math.sqrt(det) * env.scale * camZoom * persp));
    let src = null;
    if (DRAWERS[r.kind]) src = this.canvasSource(r, env, box, s);
    else if (MEDIA_KINDS.has(r.kind)) src = this.mediaSource(r, env, box, s);
    else if (['generator', 'shader', 'group'].includes(r.kind)) src = this.glSource(r, env, box, s);
    if (!src) return null;
    const fbo = this.pool.get(env.w, env.h);
    this.clear(fbo);
    // 1) placement
    const place = this.program('place', () => PLACE_FS, VERT_PLACE);
    this.pass(place, fbo, { uMVP: MVP, uRect: src.rect, uFlip: src.fbo ? 0 : 1, uCrop: [0, 0, 1, 1] }, { uTex: src.tex });
    // limites du calque en uv (pour les effets centrés et les transitions)
    const corners = [[src.rect[0], src.rect[1]], [src.rect[2], src.rect[1]], [src.rect[0], src.rect[3]], [src.rect[2], src.rect[3]]].map(([x, y]) => mat4.apply(MVP, x, y));
    const bx0 = Math.max(0, (Math.min(...corners.map((c) => c[0])) + 1) / 2), bx1 = Math.min(1, (Math.max(...corners.map((c) => c[0])) + 1) / 2);
    const by0 = Math.max(0, (Math.min(...corners.map((c) => c[1])) + 1) / 2), by1 = Math.min(1, (Math.max(...corners.map((c) => c[1])) + 1) / 2);
    const bounds = [bx0, by0, Math.max(bx0 + 1e-3, bx1), Math.max(by0 + 1e-3, by1)];
    let cur = fbo;
    // 2) effets
    cur = this.applyEffects(r, cur, bounds, env);
    // 3) masques
    if (r.masks?.some((m) => m.enabled !== false)) cur = this.applyMasks(r, cur, world, box, env);
    // 4) transitions
    cur = this.applyTransition(r, cur, bounds, env);
    // 5) profondeur de champ caméra
    const cam = env.camera;
    if (cam?.props?.dof?.enabled) {
      const rad = (cam.props.dof.aperture || 0) * Math.abs((r.transform.z || 0) - (cam.props.dof.focus || 0)) / 500;
      if (rad > 0.5) cur = this.runEffect(EFFECT_MAP.gaussianBlur, { radius: rad }, cur, bounds, env, r.sourceTime);
    }
    return { fbo: cur, r, bounds, world };
  }

  runEffect(def, params, input, bounds, env, time) {
    const prog = this.effectProgram(def);
    if (prog.error) { this.reportError(def.id, `Effet ${def.id} : ${prog.error.message}`); return input; }
    const out = this.pool.get(env.w, env.h);
    const aux = def.aux ? this.auxTexture(params[def.aux], def.aux === 'lut' ? 'lut' : 'image') : null;
    const u = this.setParamUniforms(def.params, params, bounds, { uRes: [env.w, env.h], uTime: time, uScale: env.scale, uBounds: bounds, uSeed: 0, uAuxSize: aux ? aux.size : [0, 0] });
    this.pass(prog, out, u, { uTex: input.tex, uAux: aux?.tex || this.blankTex() });
    this.pool.release(input);
    return out;
  }

  applyEffects(r, input, bounds, env) {
    let cur = input;
    for (const e of r.effects || []) {
      if (!e.enabled) continue;
      if (env.opts.compareDisable && env.opts.compareDisable.clipId === r.id && (!env.opts.compareDisable.effectId || env.opts.compareDisable.effectId === e.id)) continue;
      const def = EFFECT_MAP[e.type];
      if (!def || def.temporal) continue;
      if (def.custom) { cur = this.customEffect(r, e, cur, env); continue; }
      cur = this.runEffect(def, e.params, cur, bounds, env, r.sourceTime);
    }
    return cur;
  }

  customEffect(r, e, input, env) {
    const prog = this.shadertoyProgram(e.params.code || '');
    if (prog.error) { this.reportError(e.id, `Shader personnalisé : ${prog.error.message}`); return input; }
    this.clearError(e.id);
    const out = this.pool.get(env.w, env.h);
    // iChannel0 attend des couleurs sRGB non prémultipliées : conversion via la passe "brightness 0"
    const decoded = this.pool.get(env.w, env.h);
    const dec = this.program('decode', () => `${HEADER}${HELPERS}void main(){ vec4 c=src(vUv); outColor=vec4(c.rgb*c.a,c.a); }`);
    this.pass(dec, decoded, { uRes: [env.w, env.h] }, { uTex: input.tex });
    this.pass(prog, out, { iResolution: [env.w, env.h, 1], iTime: r.sourceTime, iTimeDelta: 1 / env.fps, iFrame: Math.round(r.sourceTime * env.fps), iMouse: [0, 0, 0, 0], iDate: [2026, 0, 1, 0], uForceAlpha: 0, iChannelResolution: [env.w, env.h, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] }, { iChannel0: decoded.tex, iChannel1: this.blankTex(), iChannel2: this.blankTex(), iChannel3: this.blankTex() });
    this.pool.release(decoded);
    this.pool.release(input);
    return out;
  }

  applyTransition(r, input, bounds, env) {
    const lt = r.localTime;
    let tr = null, p = 1;
    const ti = r.transitionIn, to = r.transitionOut;
    if (ti && TRANSITION_MAP[ti.type] && lt < ti.duration) { tr = ti; p = lt / Math.max(1e-4, ti.duration); }
    else if (to && TRANSITION_MAP[to.type] && lt > r.duration - to.duration) { tr = to; p = (r.duration - lt) / Math.max(1e-4, to.duration); }
    if (!tr) return input;
    p = getEasing(tr.easing || 'easeInOutCubic')(Math.max(0, Math.min(1, p)));
    const def = TRANSITION_MAP[tr.type];
    const prog = this.transitionProgram(def);
    if (prog.error) { this.reportError(def.id, `Transition ${def.id} : ${prog.error.message}`); return input; }
    const out = this.pool.get(env.w, env.h);
    const aux = def.params.find((x) => x.type === 'asset') ? this.auxTexture(tr.params?.map, 'image') : null;
    const u = this.setParamUniforms(def.params, tr.params, bounds, { uP: p, uRes: [env.w, env.h], uTime: r.sourceTime, uScale: env.scale, uBounds: bounds, uSeed: 0, uAuxSize: aux ? aux.size : [0, 0] });
    this.pass(prog, out, u, { uTex: input.tex, uAux: aux?.tex || this.blankTex() });
    this.pool.release(input);
    return out;
  }

  maskTexture(r, world, box, env) {
    const { V, P } = env.cam;
    const M = mat4.mul(V, world);
    const c = new OffscreenCanvas(env.w, env.h);
    const ctx = c.getContext('2d');
    const k = env.scale;
    const first = r.masks.find((m) => m.enabled !== false);
    if (first && first.mode !== 'add') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, env.w, env.h); }
    for (const m of r.masks) {
      if (m.enabled === false) continue;
      const mc = new OffscreenCanvas(env.w, env.h);
      const mx = mc.getContext('2d');
      mx.setTransform(M[0] * k, M[1] * k, M[4] * k, M[5] * k, M[12] * k, M[13] * k);
      mx.translate(box.w / 2, box.h / 2);
      mx.beginPath();
      if (m.type === 'ellipse') mx.ellipse(m.x || 0, m.y || 0, Math.max(0.5, (m.width || 0) / 2), Math.max(0.5, (m.height || 0) / 2), 0, 0, Math.PI * 2);
      else if (m.type === 'polygon' || m.type === 'bezier') {
        const pts = m.type === 'bezier' ? flattenPath(m.points, true, 20) : m.points;
        pts.forEach((q, i) => (i ? mx.lineTo(q.x, q.y) : mx.moveTo(q.x, q.y)));
        mx.closePath();
      } else mx.rect((m.x || 0) - (m.width || 0) / 2, (m.y || 0) - (m.height || 0) / 2, m.width || 0, m.height || 0);
      mx.fillStyle = '#fff';
      mx.fill();
      if (m.expansion > 0) { mx.lineWidth = m.expansion * 2; mx.strokeStyle = '#fff'; mx.lineJoin = 'round'; mx.stroke(); }
      if (m.expansion < 0) { mx.globalCompositeOperation = 'destination-out'; mx.lineWidth = -m.expansion * 2; mx.stroke(); mx.globalCompositeOperation = 'source-over'; }
      let layer = mc;
      if (m.feather > 0) {
        const fc = new OffscreenCanvas(env.w, env.h);
        const fx = fc.getContext('2d');
        fx.filter = `blur(${(m.feather * k) / 2}px)`;
        fx.drawImage(mc, 0, 0);
        layer = fc;
      }
      if (m.invert) {
        const ic = new OffscreenCanvas(env.w, env.h);
        const ix = ic.getContext('2d');
        ix.fillStyle = '#fff'; ix.fillRect(0, 0, env.w, env.h);
        ix.globalCompositeOperation = 'destination-out'; ix.drawImage(layer, 0, 0);
        layer = ic;
      }
      ctx.globalAlpha = m.opacity ?? 1;
      ctx.globalCompositeOperation = { add: 'source-over', subtract: 'destination-out', intersect: 'destination-in', difference: 'xor' }[m.mode || 'add'];
      ctx.drawImage(layer, 0, 0);
      ctx.globalAlpha = 1;
    }
    let t = this.mediaTex.get(`mask:${env.cachePrefix}${r.id}`);
    if (!t) { t = { tex: createTexture(this.gl) }; this.mediaTex.set(`mask:${env.cachePrefix}${r.id}`, t); }
    uploadSource(this.gl, t.tex, c);
    return t.tex;
  }

  applyMasks(r, input, world, box, env) {
    const mtex = this.maskTexture(r, world, box, env);
    const out = this.pool.get(env.w, env.h);
    this.pass(this.coreProgram('mask'), out, { uMatte: 0, uMix: 1 }, { uTex: input.tex, uLayer: mtex });
    this.pool.release(input);
    return out;
  }

  // Applique les effets temporels (écho, traînées, flou de mouvement, basse cadence…) autour de renderLayer
  renderLayerTemporal(clip, t, env) {
    const temporal = (clip.effects || []).filter((e) => e.enabled && EFFECT_MAP[e.type]?.temporal);
    if (!temporal.length) return this.renderLayer(clip, t, env);
    let lt = t - clip.start;
    const multi = [];
    for (const e of temporal) {
      const kind = EFFECT_MAP[e.type].temporal, p = e.params;
      if (kind === 'posterize') lt = Math.floor(lt * p.fps) / p.fps;
      else if (kind === 'freeze') lt = Math.min(lt, p.at);
      else if (kind === 'loop') lt = lt % Math.max(0.01, p.period);
      else if (kind === 'pingpong') { const ph = lt % (2 * p.period); lt = ph < p.period ? ph : 2 * p.period - ph; }
      else if (kind === 'offset') lt = Math.max(0, lt + p.offset);
      else if (kind === 'reverse') lt = Math.max(0, clip.duration - lt - 1e-3);
      else if (kind === 'stutter') { const ph = lt % p.period; if (ph < p.hold) lt -= ph; }
      else multi.push(e);
    }
    const base = clip.start + lt;
    if (!multi.length) return this.renderLayer(clip, base, env);
    const e = multi[0], p = e.params, kind = EFFECT_MAP[e.type].temporal;
    const main = this.renderLayer(clip, base, env);
    if (!main) return null;
    if (kind === 'echo' || kind === 'trails') {
      const n = kind === 'echo' ? Math.round(p.count) : Math.round(p.frames);
      const step = kind === 'echo' ? p.delay : (p.spacing || 1) / env.fps;
      let acc = null;
      for (let k = n; k >= 1; k--) {
        const tt = base - k * step;
        if (tt < clip.start) continue;
        const ghost = this.renderLayer(clip, tt, env);
        if (!ghost) continue;
        let g = ghost.fbo;
        if (kind === 'trails') g = this.runEffect(EFFECT_MAP.fill, { color: p.tint, mix: 0.5 }, g, ghost.bounds, env, 0);
        const out = this.pool.get(env.w, env.h);
        this.pass(this.coreProgram('blend'), out, { uOpacity: Math.pow(p.decay, k), uMode: 0, uSeed: 0 }, { uTex: acc ? acc.tex : this.emptyFbo(env).tex, uLayer: g.tex });
        if (acc) this.pool.release(acc);
        this.pool.release(g);
        acc = out;
      }
      if (!acc) return main;
      const out = this.pool.get(env.w, env.h);
      this.pass(this.coreProgram('blend'), out, { uOpacity: 1, uMode: 0, uSeed: 0 }, { uTex: acc.tex, uLayer: main.fbo.tex });
      this.pool.release(acc);
      this.pool.release(main.fbo);
      main.fbo = out;
      return main;
    }
    // flou de mouvement par vitesse / interpolation de frames : moyenne de sous-échantillons
    const times = [];
    if (kind === 'motionblur') { const N = Math.round(p.samples), sh = (p.shutter / 360) / env.fps; for (let i = 0; i < N; i++) times.push(base - sh / 2 + (sh * (i + 0.5)) / N); }
    if (kind === 'frameblend') { const f = base * p.sourceFps; const f0 = Math.floor(f); times.push(f0 / p.sourceFps, (f0 + 1) / p.sourceFps); }
    const weights = kind === 'frameblend' ? [1 - (base * p.sourceFps - Math.floor(base * p.sourceFps)), base * p.sourceFps - Math.floor(base * p.sourceFps)] : times.map(() => 1 / times.length);
    let sum = this.emptyFbo(env, true);
    times.forEach((tt, i) => {
      const L = this.renderLayer(clip, Math.max(clip.start, Math.min(clip.start + clip.duration - 1e-4, tt)), env);
      if (!L) return;
      const out = this.pool.get(env.w, env.h);
      this.pass(this.coreProgram('add'), out, { uW: weights[i] }, { uTex: sum.tex, uLayer: L.fbo.tex });
      this.pool.release(sum); this.pool.release(L.fbo);
      sum = out;
    });
    this.pool.release(main.fbo);
    main.fbo = sum;
    return main;
  }

  emptyFbo(env, owned = false) {
    const f = this.pool.get(env.w, env.h);
    this.clear(f);
    if (!owned) env.temp.push(f);
    return f;
  }

  // ---------------------------------------------------------------- composition complète → FBO
  composite(project, t, w, h, opts = {}) {
    const W = project.meta.width, H = project.meta.height;
    const env = {
      project, t, W, H, w, h, scale: w / W, fps: project.meta.fps, opts,
      media: this.media, audio: this.audio, compTime: t,
      videoRole: opts.videoRole || 'preview', playing: !!opts.playing,
      resolved: new Map(), boxes: new Map(), temp: [],
      cachePrefix: opts.cachePrefix || '', fontsVersion: opts.fontsVersion || 0,
    };
    env.resolveEnv = { comp: project.meta, layer: makeLayerLookup(project, t), control: makeControlLookup(project, t), audio: this.audio?.forProject?.(project) || null, onExpressionError: (c, path, e) => this.reportError(`${c.id}:${path}`, `Expression ${c.name}.${path} : ${e.message}`) };
    const camClip = project.clips.find((c) => c.kind === 'camera' && isActiveAt(c, t) && !project.tracks.find((tr) => tr.id === c.trackId)?.hidden);
    env.camera = camClip ? resolveClip(camClip, t, env.resolveEnv) : null;
    env.cam = this.cameraMatrices(env);
    let clips = visibleClipsAt(project, t);
    const matteSources = new Set(project.clips.filter((c) => c.matte?.sourceId && c.matte.hideSource !== false).map((c) => c.matte.sourceId));
    if (opts.isolate) clips = clips.filter((c) => c.id === opts.isolate);
    let accum = this.pool.get(w, h);
    const bg = project.meta.background;
    if (opts.transparent || !bg || bg === 'transparent') this.clear(accum);
    else { const c = hexToRgb(bg).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); this.clear(accum, [c[0], c[1], c[2], 1]); }
    let layers = 0;
    for (const clip of clips) {
      if (NON_VISUAL.has(clip.kind)) continue;
      if (matteSources.has(clip.id) && opts.isolate !== clip.id) continue;
      if (clip.kind === 'adjustment') {
        const r = resolveClip(clip, t, env.resolveEnv);
        if (r.transform.opacity <= 0.001) continue;
        let copy = this.pool.get(w, h);
        this.blit(accum, copy);
        copy = this.applyEffects(r, copy, [0, 0, 1, 1], env);
        let maskTex = null;
        if (r.masks?.some((m) => m.enabled !== false)) maskTex = this.maskTexture(r, mat4.translate(0, 0, 0), { w: W, h: H }, env);
        let tp = 1;
        const lt = r.localTime;
        if (r.transitionIn && lt < r.transitionIn.duration) tp = lt / r.transitionIn.duration;
        if (r.transitionOut && lt > r.duration - r.transitionOut.duration) tp = Math.min(tp, (r.duration - lt) / r.transitionOut.duration);
        const out = this.pool.get(w, h);
        this.pass(this.coreProgram('adj'), out, { uOpacity: r.transform.opacity * tp, uUseMask: maskTex ? 1 : 0 }, { uTex: accum.tex, uLayer: copy.tex, uMaskTex: maskTex || this.blankTex() });
        this.pool.release(copy); this.pool.release(accum);
        accum = out;
        layers++;
        continue;
      }
      let L;
      try { L = this.renderLayerTemporal(clip, t, env); } catch (e) { this.reportError(clip.id, `Rendu de "${clip.name}" : ${e.message}`); continue; }
      if (!L) continue;
      let layerFbo = L.fbo;
      // track matte
      if (clip.matte?.sourceId) {
        const src = project.clips.find((c) => c.id === clip.matte.sourceId);
        if (src && isActiveAt(src, t)) {
          const M = this.renderLayer(src, t, env);
          if (M) {
            const out = this.pool.get(w, h);
            this.pass(this.coreProgram('mask'), out, { uMatte: ['alpha', 'alphaInverted', 'luma', 'lumaInverted'].indexOf(clip.matte.type || 'alpha'), uMix: 1 }, { uTex: layerFbo.tex, uLayer: M.fbo.tex });
            this.pool.release(M.fbo); this.pool.release(layerFbo);
            layerFbo = out;
          }
        } else if (src) { this.pool.release(layerFbo); continue; }
      }
      const r = L.r;
      const mode = clip.kind === 'light' && r.props.mode !== 'spot' && (clip.blendMode || 'normal') === 'normal' ? BLEND_INDEX[r.props.mode === 'screen' ? 'screen' : 'add'] : (BLEND_INDEX[clip.blendMode] ?? 0);
      const out = this.pool.get(w, h);
      this.pass(this.coreProgram('blend'), out, { uOpacity: Math.max(0, Math.min(1, r.transform.opacity ?? 1)), uMode: mode, uSeed: (hashString(clip.id) % 1000) + Math.floor(t * env.fps) * 0 }, { uTex: accum.tex, uLayer: layerFbo.tex });
      this.pool.release(layerFbo); this.pool.release(accum);
      accum = out;
      layers++;
    }
    for (const f of env.temp) this.pool.release(f);
    this.stats.layers = layers;
    this.lastEnv = env;
    return accum;
  }

  // ---------------------------------------------------------------- API publique
  // Rendu d'une image à l'instant t sur le canvas (taille courante du canvas)
  render(project, t, opts = {}) {
    if (this.lost) return;
    const t0 = performance.now();
    this.stats.passes = 0;
    const w = this.canvas.width, h = this.canvas.height;
    let final;
    const mb = opts.motionBlur;
    if (mb && mb.samples > 1) {
      const N = mb.samples, sh = ((mb.shutter ?? 180) / 360) / project.meta.fps;
      let sum = this.pool.get(w, h); this.clear(sum);
      for (let i = 0; i < N; i++) {
        const tt = Math.max(0, t - sh / 2 + (sh * (i + 0.5)) / N);
        const f = this.composite(project, tt, w, h, opts);
        const out = this.pool.get(w, h);
        this.pass(this.coreProgram('add'), out, { uW: 1 / N }, { uTex: sum.tex, uLayer: f.tex });
        this.pool.release(sum); this.pool.release(f);
        sum = out;
      }
      final = sum;
    } else final = this.composite(project, t, w, h, opts);
    let compare = null;
    if (opts.compare?.clipId) {
      compare = this.composite(project, t, w, h, { ...opts, compareDisable: opts.compare });
    }
    // sortie
    const viewIdx = opts.view === 'alpha' ? 1 : 0;
    this.pass(this.coreProgram('out'), null, { uView: viewIdx, uSplit: opts.compare?.split ?? 0.5, uHasCompare: compare ? 1 : 0 }, { uTex: final.tex, uLayer: compare ? compare.tex : final.tex });
    this.pool.release(final);
    if (compare) this.pool.release(compare);
    this.pool.trim(10);
    const dt = performance.now() - t0;
    this.stats.frameMs = this.stats.frameMs ? this.stats.frameMs * 0.85 + dt * 0.15 : dt;
    this.stats.lastMs = dt;
  }

  // Prépare les médias pour un rendu déterministe (seek exact des vidéos)
  async prepare(project, t, role = 'export') {
    if (!this.media) return;
    const clips = visibleClipsAt(project, t);
    const waits = [];
    const visit = (list, tt) => {
      for (const c of list) {
        if (c.kind === 'video' && isActiveAt(c, tt)) {
          const v = this.media.getVideo(c.props.assetId, role);
          if (v) { const r = resolveClip(c, tt, {}); waits.push(this.media.seekVideo(v, this.videoTime(r, v))); }
        }
        if (c.kind === 'group' && isActiveAt(c, tt)) visit(c.props.clips || [], tt - c.start + (c.inPoint || 0));
      }
    };
    visit(clips, t);
    await Promise.all(waits);
  }

  resize(w, h) {
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; this.pool.dispose(); this.pool = new FBOPool(this.gl, this.float); }
  }

  purge(keepIds) {
    for (const k of [...this.layerCache.keys()]) if (!keepIds.has(k.split('/').pop())) { this.gl.deleteTexture(this.layerCache.get(k).tex); this.layerCache.delete(k); }
  }

  invalidateMedia(assetId) {
    for (const k of [...this.mediaTex.keys()]) if (k.includes(assetId)) { this.gl.deleteTexture(this.mediaTex.get(k).tex); this.mediaTex.delete(k); }
    for (const k of [...this.auxTex.keys()]) if (k.includes(assetId)) { this.gl.deleteTexture(this.auxTex.get(k).tex); this.auxTex.delete(k); }
  }

  dispose() {
    this.disposed = true;
    this.pool.dispose();
    for (const c of this.layerCache.values()) this.gl.deleteTexture(c.tex);
    for (const c of this.mediaTex.values()) this.gl.deleteTexture(c.tex);
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}

export { mulberry32 };
