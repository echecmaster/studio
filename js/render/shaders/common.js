// Fragments GLSL partagés par tous les passes (effets, transitions, générateurs, composition)
export const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.0,1.0); }`;

// Quad placé avec une matrice 4×4 (perspective) : pour poser un calque dans la composition
export const VERT_PLACE = `#version 300 es
in vec2 aPos;
uniform mat4 uMVP;
uniform vec4 uRect; // x0,y0,x1,y1 en px (repère local du calque)
out vec2 vUv;
void main(){
  vUv = aPos*0.5+0.5;
  vec2 p = mix(uRect.xy, uRect.zw, vec2(vUv.x, 1.0-vUv.y));
  gl_Position = uMVP * vec4(p, 0.0, 1.0);
}`;

export const HEADER = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uTex;
uniform sampler2D uAux;
uniform vec2 uAuxSize;
uniform vec2 uRes;
uniform float uTime;
uniform float uScale;
uniform vec4 uBounds;
uniform float uSeed;
in vec2 vUv;
out vec4 outColor;
#define PI 3.14159265359
`;

export const HELPERS = `
vec3 toLin(vec3 c){ c=max(c,0.0); return mix(c/12.92, pow((c+0.055)/1.055, vec3(2.4)), step(0.04045, c)); }
vec3 toSRGB(vec3 c){ c=max(c,0.0); return mix(c*12.92, 1.055*pow(c, vec3(1.0/2.4))-0.055, step(0.0031308, c)); }
vec4 unpm(vec4 c){ return c.a>0.00001 ? vec4(toSRGB(c.rgb/c.a), c.a) : vec4(0.0); }
vec4 src(vec2 uv){ return unpm(texture(uTex, uv)); }
vec4 srcB(vec2 uv){ if(uv.x<0.0||uv.y<0.0||uv.x>1.0||uv.y>1.0) return vec4(0.0); return src(uv); }
vec4 srcW(vec2 uv){ return src(fract(uv)); }
float luma(vec3 c){ return dot(c, vec3(0.2126,0.7152,0.0722)); }
float hash12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*0.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec2 hash22(vec2 p){ vec3 p3=fract(vec3(p.xyx)*vec3(0.1031,0.1030,0.0973)); p3+=dot(p3,p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f); return mix(mix(hash12(i),hash12(i+vec2(1.0,0.0)),u.x), mix(hash12(i+vec2(0.0,1.0)),hash12(i+vec2(1.0,1.0)),u.x),u.y); }
float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<5;i++){ v+=a*vnoise(p); p=p*2.03+17.1; a*=0.5; } return v; }
vec3 rgb2hsv(vec3 c){ vec4 K=vec4(0.0,-1.0/3.0,2.0/3.0,-1.0); vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g)); vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r)); float d=q.x-min(q.w,q.y); float e=1.0e-10; return vec3(abs(q.z+(q.w-q.y)/(6.0*d+e)), d/(q.x+e), q.x); }
vec3 hsv2rgb(vec3 c){ vec4 K=vec4(1.0,2.0/3.0,1.0/3.0,3.0); vec3 p=abs(fract(c.xxx+K.xyz)*6.0-K.www); return c.z*mix(K.xxx, clamp(p-K.xxx,0.0,1.0), c.y); }
mat2 rot(float a){ float s=sin(a), c=cos(a); return mat2(c,-s,s,c); }
vec2 px(){ return 1.0/uRes; }
float aspect(){ return uRes.x/uRes.y; }
vec2 L(vec2 uv){ return (uv-uBounds.xy)/max(uBounds.zw-uBounds.xy, vec2(1e-5)); }
vec2 G(vec2 l){ return uBounds.xy + l*(uBounds.zw-uBounds.xy); }
float bAspect(){ vec2 s=(uBounds.zw-uBounds.xy)*uRes; return s.x/max(s.y,1.0); }
vec4 blur(vec2 uv, float r){
  if(r<0.5) return src(uv);
  vec4 acc=vec4(0.0); float w=0.0;
  for(int i=0;i<48;i++){ float fi=float(i)+0.5; float rr=sqrt(fi/48.0)*r; float a=fi*2.39996; float wt=exp(-rr*rr/(r*r*0.5)); acc+=texture(uTex, uv+vec2(cos(a),sin(a))*rr/uRes)*wt; w+=wt; }
  return unpm(acc/w);
}
vec4 blurDir(vec2 uv, vec2 d, float r){
  if(r<0.5) return src(uv);
  vec4 acc=vec4(0.0);
  for(int i=0;i<32;i++){ float t=float(i)/31.0-0.5; acc+=texture(uTex, uv+d*t*r/uRes); }
  return unpm(acc/32.0);
}
`;

// Sortie : sRGB non prémultiplié → linéaire prémultiplié
export const OUT = `vec4 finalize(vec4 c){ c=clamp(c,0.0,1.0); return vec4(toLin(c.rgb)*c.a, c.a); }`;
