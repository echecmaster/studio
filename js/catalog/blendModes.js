// 27 modes de fusion (Photoshop/After Effects). Formules appliquées en sRGB (b = fond, s = calque), composées en linéaire.
export const BLEND_MODES = [
  ['normal', 'Normal'], ['dissolve', 'Fondu (dissolve)'],
  ['darken', 'Obscurcir'], ['multiply', 'Produit'], ['colorBurn', 'Densité couleur +'], ['linearBurn', 'Densité linéaire +'], ['darkerColor', 'Couleur plus foncée'],
  ['lighten', 'Éclaircir'], ['screen', 'Superposition (écran)'], ['colorDodge', 'Densité couleur −'], ['add', 'Densité linéaire − (ajout)'], ['lighterColor', 'Couleur plus claire'],
  ['overlay', 'Incrustation'], ['softLight', 'Lumière tamisée'], ['hardLight', 'Lumière crue'], ['vividLight', 'Lumière vive'], ['linearLight', 'Lumière linéaire'], ['pinLight', 'Lumière ponctuelle'], ['hardMix', 'Mélange maximal'],
  ['difference', 'Différence'], ['exclusion', 'Exclusion'], ['subtract', 'Soustraction'], ['divide', 'Division'],
  ['hue', 'Teinte'], ['saturation', 'Saturation'], ['color', 'Couleur'], ['luminosity', 'Luminosité'],
].map(([id, name], index) => ({ id, name, index }));

export const BLEND_INDEX = Object.fromEntries(BLEND_MODES.map((m) => [m.id, m.index]));

export const BLEND_GLSL = `
float lumB(vec3 c){ return dot(c, vec3(0.3,0.59,0.11)); }
vec3 clipColor(vec3 c){ float l=lumB(c); float n=min(c.r,min(c.g,c.b)); float x=max(c.r,max(c.g,c.b)); if(n<0.0) c=l+(c-l)*l/max(l-n,1e-5); if(x>1.0) c=l+(c-l)*(1.0-l)/max(x-l,1e-5); return c; }
vec3 setLum(vec3 c, float l){ return clipColor(c+(l-lumB(c))); }
float satB(vec3 c){ return max(c.r,max(c.g,c.b))-min(c.r,min(c.g,c.b)); }
vec3 setSat(vec3 c, float s){ float mx=max(c.r,max(c.g,c.b)); float mn=min(c.r,min(c.g,c.b)); float r=mx-mn; if(r<1e-5) return vec3(0.0); return (c-mn)*s/r; }
float cburn(float b,float s){ return b>=1.0?1.0: s<=0.0?0.0: 1.0-min(1.0,(1.0-b)/s); }
float cdodge(float b,float s){ return b<=0.0?0.0: s>=1.0?1.0: min(1.0,b/(1.0-s)); }
float softL(float b,float s){ float d= b<=0.25? ((16.0*b-12.0)*b+4.0)*b : sqrt(b); return s<=0.5? b-(1.0-2.0*s)*b*(1.0-b) : b+(2.0*s-1.0)*(d-b); }
float vivid(float b,float s){ return s<0.5? cburn(b,2.0*s) : cdodge(b,2.0*(s-0.5)); }
float pinL(float b,float s){ return s<0.5? min(b,2.0*s) : max(b,2.0*(s-0.5)); }
vec3 blendRGB(vec3 b, vec3 s, int m){
  if(m==2) return min(b,s);
  if(m==3) return b*s;
  if(m==4) return vec3(cburn(b.r,s.r),cburn(b.g,s.g),cburn(b.b,s.b));
  if(m==5) return max(b+s-1.0,0.0);
  if(m==6) return lumB(s)<lumB(b)? s : b;
  if(m==7) return max(b,s);
  if(m==8) return b+s-b*s;
  if(m==9) return vec3(cdodge(b.r,s.r),cdodge(b.g,s.g),cdodge(b.b,s.b));
  if(m==10) return min(b+s,1.0);
  if(m==11) return lumB(s)>lumB(b)? s : b;
  if(m==12) return mix(2.0*b*s, 1.0-2.0*(1.0-b)*(1.0-s), step(0.5,b));
  if(m==13) return vec3(softL(b.r,s.r),softL(b.g,s.g),softL(b.b,s.b));
  if(m==14) return mix(2.0*b*s, 1.0-2.0*(1.0-b)*(1.0-s), step(0.5,s));
  if(m==15) return vec3(vivid(b.r,s.r),vivid(b.g,s.g),vivid(b.b,s.b));
  if(m==16) return clamp(b+2.0*s-1.0,0.0,1.0);
  if(m==17) return vec3(pinL(b.r,s.r),pinL(b.g,s.g),pinL(b.b,s.b));
  if(m==18) return step(1.0, b+s);
  if(m==19) return abs(b-s);
  if(m==20) return b+s-2.0*b*s;
  if(m==21) return max(b-s,0.0);
  if(m==22) return min(b/max(s,1e-4),1.0);
  if(m==23) return setLum(setSat(s,satB(b)),lumB(b));
  if(m==24) return setLum(setSat(b,satB(s)),lumB(b));
  if(m==25) return setLum(s,lumB(b));
  if(m==26) return setLum(b,lumB(s));
  return s;
}`;
