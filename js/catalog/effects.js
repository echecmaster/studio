// Catalogue des effets / filtres (≥150). Chaque effet = un snippet GLSL `vec4 fx(vec2 uv)`
// exécuté dans le pipeline WebGL2 (voir js/render/shaders/common.js pour les helpers disponibles).
// Couleurs en sRGB non prémultiplié dans fx(), le renderer gère linéaire/prémultiplié.
import { BUILTIN_LUTS, lutGLSL } from './luts.js';

const f = (name, label, min, max, def, step) => ({ name, label, type: 'float', min, max, default: def, step: step ?? +((max - min) / 200).toPrecision(2) });
const c = (name, label, def) => ({ name, label, type: 'color', default: def });
const b = (name, label, def = false) => ({ name, label, type: 'bool', default: def });
const s = (name, label, options, def) => ({ name, label, type: 'select', options, default: def ?? options[0] });
const pt = (name, label, def = [0.5, 0.5]) => ({ name, label, type: 'point', default: def });
const asset = (name, label) => ({ name, label, type: 'asset', default: '' });

const E = [];
const add = (category, id, name, en, params, glsl, extra = {}) => E.push({ id, name, en, category, params, glsl, ...extra });

// ======================= COULEUR =======================
const C = 'couleur';
add(C, 'brightness', 'Luminosité', 'Brightness', [f('amount', 'Quantité', -1, 1, 0.1)], `vec4 fx(vec2 uv){ vec4 c=src(uv); c.rgb+=p_amount; return c; }`);
add(C, 'contrast', 'Contraste', 'Contrast', [f('amount', 'Quantité', 0, 3, 1.3)], `vec4 fx(vec2 uv){ vec4 c=src(uv); c.rgb=(c.rgb-0.5)*p_amount+0.5; return c; }`);
add(C, 'saturation', 'Saturation', 'Saturation', [f('amount', 'Quantité', 0, 3, 1.5)], `vec4 fx(vec2 uv){ vec4 c=src(uv); c.rgb=mix(vec3(luma(c.rgb)),c.rgb,p_amount); return c; }`);
add(C, 'vibrance', 'Vibrance', 'Vibrance', [f('amount', 'Quantité', -1, 2, 0.6)], `vec4 fx(vec2 uv){ vec4 c=src(uv); float mx=max(c.r,max(c.g,c.b)); float mn=min(c.r,min(c.g,c.b)); float sat=mx-mn; c.rgb=mix(vec3(luma(c.rgb)),c.rgb,1.0+p_amount*(1.0-sat)); return c; }`);
add(C, 'hue', 'Teinte (rotation)', 'Hue', [f('angle', 'Angle', -180, 180, 45, 1)], `vec4 fx(vec2 uv){ vec4 c=src(uv); vec3 h=rgb2hsv(c.rgb); h.x=fract(h.x+p_angle/360.0); c.rgb=hsv2rgb(h); return c; }`);
add(C, 'temperature', 'Température', 'Temperature', [f('amount', 'Chaud ↔ froid', -1, 1, 0.3)], `vec4 fx(vec2 uv){ vec4 c=src(uv); c.r+=p_amount*0.12; c.g+=p_amount*0.03; c.b-=p_amount*0.12; return c; }`);
add(C, 'tint', 'Tint (vert/magenta)', 'Tint', [f('amount', 'Quantité', -1, 1, 0.2)], `vec4 fx(vec2 uv){ vec4 c=src(uv); c.g-=p_amount*0.1; c.r+=p_amount*0.05; c.b+=p_amount*0.05; return c; }`);
add(C, 'exposure', 'Exposition', 'Exposure', [f('ev', 'IL', -4, 4, 0.5), f('offset', 'Décalage', -0.5, 0.5, 0)], `vec4 fx(vec2 uv){ vec4 c=src(uv); c.rgb=toSRGB(toLin(c.rgb)*pow(2.0,p_ev))+p_offset; return c; }`);
add(C, 'gamma', 'Gamma', 'Gamma', [f('gamma', 'Gamma', 0.2, 3, 1.2)], `vec4 fx(vec2 uv){ vec4 c=src(uv); c.rgb=pow(max(c.rgb,0.0),vec3(1.0/p_gamma)); return c; }`);
add(C, 'levels', 'Niveaux', 'Levels', [f('inBlack', 'Noir entrée', 0, 1, 0.05), f('inWhite', 'Blanc entrée', 0, 1, 0.95), f('gamma', 'Gamma', 0.1, 4, 1), f('outBlack', 'Noir sortie', 0, 1, 0), f('outWhite', 'Blanc sortie', 0, 1, 1)],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); vec3 v=clamp((c.rgb-p_inBlack)/max(p_inWhite-p_inBlack,0.001),0.0,1.0); v=pow(v,vec3(1.0/p_gamma)); c.rgb=mix(vec3(p_outBlack),vec3(p_outWhite),v); return c; }`);
add(C, 'curves', 'Courbes', 'Curves', [f('shadows', 'Maître : ombres (0.25)', 0, 0.5, 0.2), f('mids', 'Maître : tons moyens (0.5)', 0.2, 0.8, 0.5), f('highs', 'Maître : hautes lum. (0.75)', 0.5, 1, 0.8), f('red', 'Rouge (tons moyens)', -0.3, 0.3, 0), f('green', 'Vert (tons moyens)', -0.3, 0.3, 0), f('blue', 'Bleu (tons moyens)', -0.3, 0.3, 0)],
  `float crv(float x,float a,float m,float h){ if(x<0.25) return mix(0.0,a,x/0.25); if(x<0.5) return mix(a,m,(x-0.25)/0.25); if(x<0.75) return mix(m,h,(x-0.5)/0.25); return mix(h,1.0,(x-0.75)/0.25); }
vec4 fx(vec2 uv){ vec4 c=src(uv); c.r=crv(c.r,p_shadows,p_mids,p_highs); c.g=crv(c.g,p_shadows,p_mids,p_highs); c.b=crv(c.b,p_shadows,p_mids,p_highs); vec3 w=c.rgb*(1.0-c.rgb)*4.0; c.rgb+=vec3(p_red,p_green,p_blue)*w; return c; }`);
add(C, 'colorBalance', 'Balance des couleurs', 'Color balance', [c('shadows', 'Ombres', '#1a2a4a'), c('midtones', 'Tons moyens', '#808080'), c('highlights', 'Hautes lumières', '#ffd9a0'), f('amount', 'Intensité', 0, 1, 0.4)],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); float l=luma(c.rgb); vec3 sh=(p_shadows-0.5)*(1.0-smoothstep(0.0,0.5,l)); vec3 md=(p_midtones-0.5)*(1.0-abs(l-0.5)*2.0); vec3 hi=(p_highlights-0.5)*smoothstep(0.5,1.0,l); c.rgb+=(sh+md+hi)*p_amount; return c; }`);
add(C, 'colorWheels', 'Roues de couleur (lift/gamma/gain)', 'Color wheels', [c('lift', 'Lift', '#808080'), c('gamma', 'Gamma', '#808080'), c('gain', 'Gain', '#808080'), f('strength', 'Force', 0, 2, 1)],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); vec3 L=(p_lift-0.5)*0.5*p_strength; vec3 G=1.0+(p_gamma-0.5)*p_strength; vec3 N=1.0+(p_gain-0.5)*p_strength; vec3 v=c.rgb*N+L*(1.0-c.rgb); c.rgb=pow(max(v,0.0),1.0/max(G,vec3(0.05))); return c; }`);
add(C, 'lut', 'LUT intégrée', 'Built-in LUT', [s('look', 'Look', BUILTIN_LUTS.map((l) => l.name), BUILTIN_LUTS[0].name), f('mix', 'Intensité', 0, 1, 1)],
  `${lutGLSL()}
vec4 fx(vec2 uv){ vec4 c=src(uv); c.rgb=mix(c.rgb,lutGrade(c.rgb,int(p_look+0.5)),p_mix); return c; }`);
add(C, 'lut3d', 'LUT 3D importée (.cube/HALD)', 'Imported 3D LUT', [asset('lut', 'Fichier LUT'), f('mix', 'Intensité', 0, 1, 1)],
  `vec3 lut3(vec3 c){ float N=uAuxSize.y; if(N<2.0) return c; c=clamp(c,0.0,1.0); float b=c.b*(N-1.0); float b0=floor(b); float b1=min(b0+1.0,N-1.0);
  vec2 o=vec2(c.r*(N-1.0)+0.5, c.g*(N-1.0)+0.5); vec3 s0=texture(uAux,vec2((o.x+b0*N)/(N*N),o.y/N)).rgb; vec3 s1=texture(uAux,vec2((o.x+b1*N)/(N*N),o.y/N)).rgb; return mix(s0,s1,b-b0); }
vec4 fx(vec2 uv){ vec4 c=src(uv); c.rgb=mix(c.rgb,lut3(c.rgb),p_mix); return c; }`, { aux: 'lut' });
add(C, 'blackWhite', 'Noir & blanc', 'Black & white', [f('red', 'Rouges', -1, 2, 0.3), f('green', 'Verts', -1, 2, 0.59), f('blue', 'Bleus', -1, 2, 0.11), c('tint', 'Teinte', '#ffffff')],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); float l=dot(c.rgb,vec3(p_red,p_green,p_blue)); c.rgb=vec3(l)*p_tint; return c; }`);
add(C, 'sepia', 'Sépia', 'Sepia', [f('amount', 'Quantité', 0, 1, 1)], `vec4 fx(vec2 uv){ vec4 c=src(uv); vec3 s=vec3(dot(c.rgb,vec3(.393,.769,.189)),dot(c.rgb,vec3(.349,.686,.168)),dot(c.rgb,vec3(.272,.534,.131))); c.rgb=mix(c.rgb,s,p_amount); return c; }`);
add(C, 'invert', 'Négatif', 'Invert', [f('amount', 'Quantité', 0, 1, 1)], `vec4 fx(vec2 uv){ vec4 c=src(uv); c.rgb=mix(c.rgb,1.0-c.rgb,p_amount); return c; }`);
add(C, 'duotone', 'Duotone', 'Duotone', [c('dark', 'Sombre', '#0b1a3a'), c('light', 'Clair', '#24d26d'), f('contrast', 'Contraste', 0.2, 3, 1)], `vec4 fx(vec2 uv){ vec4 c=src(uv); float l=clamp((luma(c.rgb)-0.5)*p_contrast+0.5,0.0,1.0); c.rgb=mix(p_dark,p_light,l); return c; }`);
add(C, 'tritone', 'Tritone', 'Tritone', [c('shadows', 'Ombres', '#120024'), c('midtones', 'Tons moyens', '#d0306f'), c('highlights', 'Hautes lumières', '#ffe7a0')], `vec4 fx(vec2 uv){ vec4 c=src(uv); float l=luma(c.rgb); c.rgb= l<0.5? mix(p_shadows,p_midtones,l*2.0) : mix(p_midtones,p_highlights,(l-0.5)*2.0); return c; }`);
add(C, 'posterize', 'Postérisation', 'Posterize', [f('levels', 'Niveaux', 2, 32, 5, 1)], `vec4 fx(vec2 uv){ vec4 c=src(uv); c.rgb=floor(c.rgb*p_levels+0.5)/p_levels; return c; }`);
add(C, 'threshold', 'Seuil', 'Threshold', [f('level', 'Niveau', 0, 1, 0.5), f('softness', 'Douceur', 0, 0.5, 0.02), c('dark', 'Sombre', '#000000'), c('light', 'Clair', '#ffffff')], `vec4 fx(vec2 uv){ vec4 c=src(uv); float t=smoothstep(p_level-p_softness,p_level+p_softness+0.0001,luma(c.rgb)); c.rgb=mix(p_dark,p_light,t); return c; }`);
add(C, 'channelMixer', 'Mélangeur de canaux', 'Channel mixer', [f('rr', 'R←R', -2, 2, 1), f('rg', 'R←V', -2, 2, 0), f('rb', 'R←B', -2, 2, 0), f('gr', 'V←R', -2, 2, 0), f('gg', 'V←V', -2, 2, 1), f('gb', 'V←B', -2, 2, 0), f('br', 'B←R', -2, 2, 0), f('bg', 'B←V', -2, 2, 0), f('bb', 'B←B', -2, 2, 1)],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); vec3 o=vec3(dot(c.rgb,vec3(p_rr,p_rg,p_rb)),dot(c.rgb,vec3(p_gr,p_gg,p_gb)),dot(c.rgb,vec3(p_br,p_bg,p_bb))); c.rgb=o; return c; }`);
add(C, 'colorMatch', 'Correspondance de couleur', 'Color match', [c('target', 'Couleur cible', '#ff9a52'), f('amount', 'Force', 0, 1, 0.35), b('preserveLuma', 'Préserver la luminance', true)],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); float l=luma(c.rgb); vec3 t=p_target*(l/max(luma(p_target),0.01)); vec3 o=mix(c.rgb,p_preserveLuma>0.5?t:p_target*l*2.0,p_amount*(1.0-abs(l-0.5))); c.rgb=o; return c; }`);
add(C, 'chromaKey', 'Incrustation chroma (chroma key)', 'Chroma key', [c('key', 'Couleur clé', '#00ff00'), f('tolerance', 'Tolérance', 0, 1, 0.25), f('feather', 'Contour progressif', 0, 0.5, 0.08), f('spill', 'Suppression du débordement', 0, 1, 0.6)],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); vec3 a=rgb2hsv(c.rgb), k=rgb2hsv(p_key); float dh=abs(a.x-k.x); dh=min(dh,1.0-dh); float d=dh*2.0+abs(a.y-k.y)*0.5; d=mix(distance(c.rgb,p_key),d,step(0.15,a.y)); float m=smoothstep(p_tolerance,p_tolerance+p_feather+0.0001,d); c.a*=m;
  float ki=p_key.g>max(p_key.r,p_key.b)?1.0:(p_key.b>p_key.r?2.0:0.0); if(ki==1.0){ float lim=max(c.r,c.b); c.g=mix(c.g,min(c.g,lim),p_spill);} else if(ki==2.0){ float lim=max(c.r,c.g); c.b=mix(c.b,min(c.b,lim),p_spill);} else { float lim=max(c.g,c.b); c.r=mix(c.r,min(c.r,lim),p_spill);} return c; }`);
add(C, 'lumaKey', 'Incrustation luma (luma key)', 'Luma key', [f('threshold', 'Seuil', 0, 1, 0.15), f('feather', 'Contour', 0, 0.5, 0.1), b('invert', 'Clés lumineuses', false)],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); float l=luma(c.rgb); if(p_invert>0.5) l=1.0-l; c.a*=smoothstep(p_threshold,p_threshold+p_feather+0.0001,l); return c; }`);
add(C, 'colorReplace', 'Remplacement de couleur', 'Replace color', [c('from', 'Couleur source', '#ff0000'), c('to', 'Nouvelle couleur', '#24d26d'), f('tolerance', 'Tolérance', 0, 1, 0.2), f('feather', 'Douceur', 0, 0.5, 0.1)],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); vec3 h=rgb2hsv(c.rgb), f=rgb2hsv(p_from), t=rgb2hsv(p_to); float dh=abs(h.x-f.x); dh=min(dh,1.0-dh); float m=1.0-smoothstep(p_tolerance*0.5,p_tolerance*0.5+p_feather+0.0001,dh*2.0+abs(h.y-f.y)*0.3); vec3 n=hsv2rgb(vec3(t.x,h.y*mix(1.0,t.y/max(f.y,0.01),0.5),h.z)); c.rgb=mix(c.rgb,n,m*step(0.08,h.y)); return c; }`);
add(C, 'gradientMap', 'Mappage de dégradé', 'Gradient map', [c('c1', 'Noirs', '#050505'), c('c2', 'Tons moyens', '#1fb35c'), c('c3', 'Blancs', '#eaffef'), f('mix', 'Intensité', 0, 1, 1)],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); float l=luma(c.rgb); vec3 g=l<0.5?mix(p_c1,p_c2,l*2.0):mix(p_c2,p_c3,(l-0.5)*2.0); c.rgb=mix(c.rgb,g,p_mix); return c; }`);
add(C, 'hsl', 'Teinte / Saturation / Luminosité', 'Hue/Sat/Light', [f('hue', 'Teinte', -180, 180, 0, 1), f('saturation', 'Saturation', -1, 1, 0.2), f('lightness', 'Luminosité', -1, 1, 0)],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); vec3 h=rgb2hsv(c.rgb); h.x=fract(h.x+p_hue/360.0); h.y=clamp(h.y*(1.0+p_saturation),0.0,1.0); c.rgb=hsv2rgb(h); c.rgb=p_lightness>0.0?mix(c.rgb,vec3(1.0),p_lightness):c.rgb*(1.0+p_lightness); return c; }`);
add(C, 'colorize', 'Coloriser', 'Colorize', [f('hue', 'Teinte', 0, 360, 140, 1), f('saturation', 'Saturation', 0, 1, 0.6), f('mix', 'Intensité', 0, 1, 1)],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); vec3 n=hsv2rgb(vec3(p_hue/360.0,p_saturation,1.0))*luma(c.rgb)*1.6; c.rgb=mix(c.rgb,n,p_mix); return c; }`);
add(C, 'isolateColor', 'Isoler une couleur', 'Color pass', [c('keep', 'Couleur conservée', '#ff2a2a'), f('tolerance', 'Tolérance', 0, 0.5, 0.08), f('feather', 'Douceur', 0, 0.3, 0.06)],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); vec3 h=rgb2hsv(c.rgb), k=rgb2hsv(p_keep); float dh=abs(h.x-k.x); dh=min(dh,1.0-dh); float m=1.0-smoothstep(p_tolerance,p_tolerance+p_feather+0.0001,dh); m*=smoothstep(0.1,0.25,h.y); c.rgb=mix(vec3(luma(c.rgb)),c.rgb,m); return c; }`);
add(C, 'shadowsHighlights', 'Ombres / Hautes lumières', 'Shadows/Highlights', [f('shadows', 'Déboucher les ombres', 0, 1, 0.35), f('highlights', 'Récupérer les hautes lum.', 0, 1, 0.25)],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); vec3 bl=blur(uv,24.0).rgb; float l=luma(bl); c.rgb+=p_shadows*(1.0-smoothstep(0.0,0.5,l))*0.5*(1.0-c.rgb); c.rgb-=p_highlights*smoothstep(0.5,1.0,l)*0.5*c.rgb; return c; }`);
add(C, 'splitToning', 'Virage partiel (split toning)', 'Split toning', [c('shadows', 'Ombres', '#1d4e89'), c('highlights', 'Hautes lumières', '#ffb35c'), f('balance', 'Balance', -1, 1, 0), f('amount', 'Intensité', 0, 1, 0.35)],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); float l=luma(c.rgb); float t=smoothstep(0.0,1.0,l+p_balance*0.5); vec3 tone=mix(p_shadows,p_highlights,t); vec3 ov=mix(2.0*c.rgb*tone,1.0-2.0*(1.0-c.rgb)*(1.0-tone),step(0.5,c.rgb)); c.rgb=mix(c.rgb,ov,p_amount); return c; }`);
add(C, 'fade', 'Noirs délavés (fade)', 'Faded blacks', [f('amount', 'Quantité', 0, 0.5, 0.12), c('color', 'Teinte des noirs', '#1a1f2a')], `vec4 fx(vec2 uv){ vec4 c=src(uv); c.rgb=c.rgb+(p_color+0.08-c.rgb)*p_amount*2.0*(1.0-c.rgb); return c; }`);
add(C, 'crossProcess', 'Traitement croisé', 'Cross process', [f('amount', 'Intensité', 0, 1, 0.8)], `vec4 fx(vec2 uv){ vec4 c=src(uv); vec3 o=vec3(smoothstep(0.05,0.95,c.r), pow(c.g,0.85), c.b*0.75+0.12); c.rgb=mix(c.rgb,o,p_amount); return c; }`);
add(C, 'bleachBypass', 'Bleach bypass', 'Bleach bypass', [f('amount', 'Intensité', 0, 1, 0.7)], `vec4 fx(vec2 uv){ vec4 c=src(uv); float l=luma(c.rgb); vec3 bl=vec3(l); vec3 ov=mix(2.0*c.rgb*bl,1.0-2.0*(1.0-c.rgb)*(1.0-bl),step(0.5,bl)); c.rgb=mix(c.rgb,ov,p_amount); return c; }`);
add(C, 'technicolor', 'Technicolor', 'Technicolor', [f('amount', 'Intensité', 0, 1, 0.7)], `vec4 fx(vec2 uv){ vec4 c=src(uv); vec3 o=vec3(c.r-(c.g+c.b)*0.5+c.r*0.5, c.g-(c.r+c.b)*0.5+c.g*0.5, c.b-(c.r+c.g)*0.5+c.b*0.5)*0.5+c.rgb*0.5; c.rgb=mix(c.rgb,clamp(o*1.3,0.0,1.0),p_amount); return c; }`);
add(C, 'infrared', 'Infrarouge', 'Infrared', [f('amount', 'Intensité', 0, 1, 1)], `vec4 fx(vec2 uv){ vec4 c=src(uv); float ir=clamp(c.g*1.4-c.r*0.2,0.0,1.0); vec3 o=vec3(ir, ir*0.9+c.b*0.1, c.r*0.6+0.2); c.rgb=mix(c.rgb,o,p_amount); return c; }`);
add(C, 'channelSwap', 'Permutation de canaux', 'Channel swap', [s('order', 'Ordre', ['RBG', 'GRB', 'GBR', 'BRG', 'BGR'])],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); int o=int(p_order+0.5); if(o==0)c.rgb=c.rbg; else if(o==1)c.rgb=c.grb; else if(o==2)c.rgb=c.gbr; else if(o==3)c.rgb=c.brg; else c.rgb=c.bgr; return c; }`);
add(C, 'channelIsolate', 'Afficher un canal', 'Show channel', [s('channel', 'Canal', ['Rouge', 'Vert', 'Bleu', 'Alpha']), b('colored', 'En couleur', false)],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); int ch=int(p_channel+0.5); float v= ch==0?c.r: ch==1?c.g: ch==2?c.b: c.a; vec3 col= ch==0?vec3(v,0,0): ch==1?vec3(0,v,0): ch==2?vec3(0,0,v):vec3(v); c.rgb=p_colored>0.5?col:vec3(v); if(ch==3) c.a=1.0; return c; }`);
add(C, 'opacity', 'Opacité', 'Opacity', [f('amount', 'Opacité', 0, 1, 0.5)], `vec4 fx(vec2 uv){ vec4 c=src(uv); c.a*=p_amount; return c; }`);
add(C, 'fill', 'Remplissage couleur', 'Fill', [c('color', 'Couleur', '#24d26d'), f('mix', 'Intensité', 0, 1, 1)], `vec4 fx(vec2 uv){ vec4 c=src(uv); c.rgb=mix(c.rgb,p_color,p_mix); return c; }`);
add(C, 'gradientOverlay', 'Incrustation de dégradé', 'Gradient overlay', [c('c1', 'Couleur 1', '#24d26d'), c('c2', 'Couleur 2', '#0b3dff'), f('angle', 'Angle', 0, 360, 90, 1), f('mix', 'Intensité', 0, 1, 0.6)],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); vec2 d=vec2(cos(radians(p_angle)),sin(radians(p_angle))); float t=clamp(dot(uv-0.5,d)+0.5,0.0,1.0); c.rgb=mix(c.rgb,mix(p_c1,p_c2,t),p_mix); return c; }`);
add(C, 'solarize', 'Solarisation', 'Solarize', [f('threshold', 'Seuil', 0, 1, 0.5)], `vec4 fx(vec2 uv){ vec4 c=src(uv); c.rgb=mix(c.rgb,1.0-c.rgb,step(p_threshold,c.rgb)); return c; }`);
add(C, 'dehaze', 'Anti-brume', 'Dehaze', [f('amount', 'Quantité', -1, 1, 0.4)], `vec4 fx(vec2 uv){ vec4 c=src(uv); vec3 bl=blur(uv,30.0).rgb; c.rgb=c.rgb+(c.rgb-bl)*p_amount*0.8; c.rgb=mix(vec3(luma(c.rgb)),c.rgb,1.0+p_amount*0.3); c.rgb=(c.rgb-0.5)*(1.0+p_amount*0.25)+0.5; return c; }`);
add(C, 'autoTone', 'Ton clé (high/low key)', 'Key tone', [f('key', 'Bas ↔ haut', -1, 1, 0.3)], `vec4 fx(vec2 uv){ vec4 c=src(uv); c.rgb= p_key>0.0? 1.0-pow(1.0-c.rgb,vec3(1.0+p_key*1.5)) : pow(c.rgb,vec3(1.0-p_key*1.5)); return c; }`);
add(C, 'skinTone', 'Correction des teints', 'Skin tone', [f('amount', 'Quantité', 0, 1, 0.5), f('warmth', 'Chaleur', -1, 1, 0.2)],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); vec3 h=rgb2hsv(c.rgb); float skin=1.0-smoothstep(0.03,0.09,abs(h.x-0.06)); skin*=smoothstep(0.15,0.3,h.y); vec3 t=c.rgb+vec3(0.06,0.02,-0.03)*p_warmth; t=mix(t,blur(uv,6.0).rgb,0.5); c.rgb=mix(c.rgb,t,skin*p_amount); return c; }`);
add(C, 'cinematicGrade', 'Étalonnage cinéma', 'Cinematic grade', [f('contrast', 'Contraste', 0.5, 2, 1.15), f('teal', 'Ombres sarcelle', 0, 1, 0.4), f('orange', 'Peaux orangées', 0, 1, 0.4), f('vignette', 'Vignette', 0, 1, 0.3)],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); float l=luma(c.rgb); c.rgb+=vec3(-0.05,0.02,0.06)*p_teal*(1.0-l); c.rgb+=vec3(0.07,0.02,-0.05)*p_orange*l; c.rgb=(c.rgb-0.5)*p_contrast+0.5; vec2 d=(uv-0.5)*vec2(aspect(),1.0); c.rgb*=1.0-p_vignette*smoothstep(0.3,1.0,length(d)); return c; }`);

// ======================= FLOU =======================
const B = 'flou';
add(B, 'gaussianBlur', 'Flou gaussien', 'Gaussian blur', [f('radius', 'Rayon (px)', 0, 120, 12, 0.5)], `vec4 fx(vec2 uv){ return blur(uv,p_radius*uScale); }`);
add(B, 'directionalBlur', 'Flou directionnel', 'Directional blur', [f('angle', 'Angle', 0, 360, 0, 1), f('length', 'Longueur (px)', 0, 300, 40)], `vec4 fx(vec2 uv){ vec2 d=vec2(cos(radians(p_angle)),sin(radians(p_angle))); return blurDir(uv,d,p_length*uScale); }`);
add(B, 'radialBlur', 'Flou radial (rotation)', 'Radial blur', [pt('center', 'Centre'), f('angle', 'Angle (°)', 0, 90, 10)],
  `vec4 fx(vec2 uv){ vec2 cc=p_center; vec4 acc=vec4(0.0); for(int i=0;i<32;i++){ float t=(float(i)/31.0-0.5)*radians(p_angle); vec2 q=(uv-cc)*vec2(aspect(),1.0); q=rot(t)*q; q/=vec2(aspect(),1.0); acc+=texture(uTex,cc+q);} return unpm(acc/32.0); }`);
add(B, 'zoomBlur', 'Flou zoom', 'Zoom blur', [pt('center', 'Centre'), f('amount', 'Force', 0, 1, 0.2)],
  `vec4 fx(vec2 uv){ vec4 acc=vec4(0.0); for(int i=0;i<40;i++){ float t=float(i)/39.0; acc+=texture(uTex,p_center+(uv-p_center)*(1.0-p_amount*t)); } return unpm(acc/40.0); }`);
add(B, 'boxBlur', 'Flou boîte', 'Box blur', [f('radius', 'Rayon (px)', 0, 60, 8)],
  `vec4 fx(vec2 uv){ vec4 acc=vec4(0.0); float r=p_radius*uScale; for(int y=-4;y<=4;y++) for(int x=-4;x<=4;x++){ acc+=texture(uTex,uv+vec2(float(x),float(y))*r/4.0/uRes); } return unpm(acc/81.0); }`);
add(B, 'lensBlur', 'Flou objectif (bokeh)', 'Lens blur (bokeh)', [f('radius', 'Rayon (px)', 0, 60, 14), f('highlights', 'Accentuer les hautes lum.', 0, 5, 2), f('threshold', 'Seuil', 0, 1, 0.75)],
  `vec4 fx(vec2 uv){ vec4 acc=vec4(0.0); float w=0.0; float r=p_radius*uScale; for(int i=0;i<64;i++){ float fi=float(i)+0.5; float rr=sqrt(fi/64.0)*r; float a=fi*2.39996; vec4 s=texture(uTex,uv+vec2(cos(a),sin(a))*rr/uRes); float l=luma(s.rgb); float wt=1.0+p_highlights*smoothstep(p_threshold,1.0,l); acc+=s*wt; w+=wt; } return unpm(acc/w); }`);
add(B, 'depthBlur', 'Flou de profondeur', 'Depth blur', [f('focus', 'Profondeur nette', 0, 1, 0.5), f('range', 'Profondeur de champ', 0, 1, 0.2), f('radius', 'Flou max (px)', 0, 60, 18), s('depth', 'Carte de profondeur', ['Verticale', 'Luminance'])],
  `vec4 fx(vec2 uv){ float d = p_depth<0.5? uv.y : luma(src(uv).rgb); float k=smoothstep(p_range*0.5,p_range*0.5+0.2,abs(d-p_focus)); return blur(uv,k*p_radius*uScale); }`);
add(B, 'surfaceBlur', 'Flou de surface', 'Surface blur', [f('radius', 'Rayon (px)', 1, 20, 6), f('threshold', 'Seuil', 0.01, 0.5, 0.12)],
  `vec4 fx(vec2 uv){ vec4 c0=src(uv); vec3 acc=vec3(0.0); float w=0.0; float r=p_radius*uScale; for(int y=-4;y<=4;y++) for(int x=-4;x<=4;x++){ vec4 s=src(uv+vec2(float(x),float(y))*r/4.0/uRes); float wt=exp(-pow(distance(s.rgb,c0.rgb)/p_threshold,2.0)); acc+=s.rgb*wt; w+=wt; } return vec4(acc/w,c0.a); }`);
add(B, 'tiltShift', 'Tilt-shift', 'Tilt-shift', [f('position', 'Position', 0, 1, 0.5), f('width', 'Zone nette', 0, 1, 0.15), f('radius', 'Flou (px)', 0, 40, 14), f('saturation', 'Saturation', 0, 2, 1.25)],
  `vec4 fx(vec2 uv){ float d=abs(uv.y-(1.0-p_position)); float k=smoothstep(p_width*0.5,p_width*0.5+0.25,d); vec4 c=blur(uv,k*p_radius*uScale); c.rgb=mix(vec3(luma(c.rgb)),c.rgb,p_saturation); return c; }`);
add(B, 'selectiveBlur', 'Flou sélectif (masqué)', 'Selective blur', [pt('center', 'Centre'), f('size', 'Taille zone nette', 0, 1, 0.25), f('feather', 'Contour', 0, 1, 0.2), f('radius', 'Flou (px)', 0, 60, 16), b('invert', 'Inverser', false)],
  `vec4 fx(vec2 uv){ float d=length((uv-p_center)*vec2(aspect(),1.0)); float k=smoothstep(p_size,p_size+p_feather+0.0001,d); if(p_invert>0.5) k=1.0-k; return blur(uv,k*p_radius*uScale); }`);
add(B, 'channelBlur', 'Flou par canal', 'Channel blur', [f('red', 'Rouge (px)', 0, 40, 10), f('green', 'Vert (px)', 0, 40, 0), f('blue', 'Bleu (px)', 0, 40, 4)],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); c.r=blur(uv,p_red*uScale).r; c.g=blur(uv,p_green*uScale).g; c.b=blur(uv,p_blue*uScale).b; return c; }`);
add(B, 'velocityBlur', 'Flou de mouvement (vitesse)', 'Velocity motion blur', [f('shutter', 'Obturateur (°)', 0, 720, 180, 1), f('samples', 'Échantillons', 2, 16, 8, 1)],
  `vec4 fx(vec2 uv){ return src(uv); }`, { temporal: 'motionblur' });

// ======================= NETTETÉ / DÉTAILS =======================
const N = 'nettete';
add(N, 'sharpen', 'Netteté', 'Sharpen', [f('amount', 'Quantité', 0, 3, 0.8)], `vec4 fx(vec2 uv){ vec2 p=px(); vec4 c=src(uv); vec3 n=src(uv+vec2(p.x,0)).rgb+src(uv-vec2(p.x,0)).rgb+src(uv+vec2(0,p.y)).rgb+src(uv-vec2(0,p.y)).rgb; c.rgb+= (c.rgb*4.0-n)*p_amount; return c; }`);
add(N, 'unsharpMask', 'Accentuation (unsharp mask)', 'Unsharp mask', [f('amount', 'Quantité', 0, 3, 1), f('radius', 'Rayon (px)', 0.5, 20, 3), f('threshold', 'Seuil', 0, 0.5, 0.02)],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); vec3 bl=blur(uv,p_radius*uScale).rgb; vec3 d=c.rgb-bl; c.rgb+=d*p_amount*step(p_threshold,abs(luma(d))); return c; }`);
add(N, 'clarity', 'Clarté', 'Clarity', [f('amount', 'Quantité', -1, 2, 0.6)], `vec4 fx(vec2 uv){ vec4 c=src(uv); vec3 bl=blur(uv,20.0*uScale).rgb; float l=luma(c.rgb); c.rgb+=(c.rgb-bl)*p_amount*(1.0-abs(l-0.5)*2.0); return c; }`);
add(N, 'edgeDetect', 'Détection de contours', 'Find edges', [f('strength', 'Force', 0, 5, 1.5), b('invert', 'Inverser', false), c('color', 'Couleur', '#ffffff'), b('keepAlpha', 'Conserver l\'alpha', true)],
  `vec4 fx(vec2 uv){ vec2 p=px(); float tl=luma(src(uv+vec2(-p.x,p.y)).rgb), t=luma(src(uv+vec2(0,p.y)).rgb), tr=luma(src(uv+p).rgb), l=luma(src(uv-vec2(p.x,0)).rgb), r=luma(src(uv+vec2(p.x,0)).rgb), bl=luma(src(uv-p).rgb), bb=luma(src(uv-vec2(0,p.y)).rgb), br=luma(src(uv+vec2(p.x,-p.y)).rgb);
  float gx=-tl-2.0*l-bl+tr+2.0*r+br; float gy=-tl-2.0*t-tr+bl+2.0*bb+br; float e=clamp(length(vec2(gx,gy))*p_strength,0.0,1.0); if(p_invert>0.5) e=1.0-e; vec4 c=src(uv); return vec4(p_color*e, p_keepAlpha>0.5?c.a:1.0); }`);
add(N, 'emboss', 'Estampage', 'Emboss', [f('angle', 'Angle', 0, 360, 135, 1), f('strength', 'Force', 0, 10, 3), b('color', 'Conserver la couleur', false)],
  `vec4 fx(vec2 uv){ vec2 d=vec2(cos(radians(p_angle)),sin(radians(p_angle)))*px()*1.5; vec4 c=src(uv); float e=(luma(src(uv+d).rgb)-luma(src(uv-d).rgb))*p_strength+0.5; c.rgb= p_color>0.5? c.rgb*(e+0.5) : vec3(e); return c; }`);
add(N, 'highPass', 'Passe-haut', 'High pass', [f('radius', 'Rayon (px)', 1, 60, 8), f('gain', 'Gain', 0.5, 5, 1)], `vec4 fx(vec2 uv){ vec4 c=src(uv); c.rgb=(c.rgb-blur(uv,p_radius*uScale).rgb)*p_gain+0.5; return c; }`);
add(N, 'detailEnhance', 'Renforcer les détails', 'Detail enhance', [f('amount', 'Quantité', 0, 2, 0.7), f('radius', 'Rayon (px)', 1, 10, 2)], `vec4 fx(vec2 uv){ vec4 c=src(uv); vec3 d=c.rgb-blur(uv,p_radius*uScale).rgb; c.rgb+=d*p_amount*2.0; return c; }`);

// ======================= DISTORSION =======================
const D = 'distorsion';
add(D, 'wave', 'Onde', 'Wave', [f('amplitude', 'Amplitude', 0, 0.2, 0.02), f('frequency', 'Fréquence', 0, 60, 10), f('speed', 'Vitesse', -10, 10, 2), s('direction', 'Direction', ['Horizontale', 'Verticale', 'Les deux'])],
  `vec4 fx(vec2 uv){ int d=int(p_direction+0.5); vec2 o=vec2(0.0); if(d!=1) o.x=sin(uv.y*p_frequency+uTime*p_speed)*p_amplitude; if(d!=0) o.y=sin(uv.x*p_frequency+uTime*p_speed)*p_amplitude; return srcB(uv+o); }`);
add(D, 'ripple', 'Ondulation', 'Ripple', [pt('center', 'Centre'), f('amplitude', 'Amplitude', 0, 0.1, 0.015), f('frequency', 'Fréquence', 1, 120, 40), f('speed', 'Vitesse', -20, 20, 6), f('decay', 'Atténuation', 0, 10, 2)],
  `vec4 fx(vec2 uv){ vec2 d=(uv-p_center)*vec2(aspect(),1.0); float r=length(d); float w=sin(r*p_frequency-uTime*p_speed)*p_amplitude*exp(-r*p_decay); vec2 o=r>0.0? d/r*w : vec2(0.0); return srcB(uv+o/vec2(aspect(),1.0)); }`);
add(D, 'twirl', 'Torsion (twirl)', 'Twirl', [pt('center', 'Centre'), f('angle', 'Angle (°)', -720, 720, 180), f('radius', 'Rayon', 0, 1.5, 0.4)],
  `vec4 fx(vec2 uv){ vec2 d=(uv-p_center)*vec2(aspect(),1.0); float r=length(d); float k=max(0.0,1.0-r/p_radius); d=rot(radians(p_angle)*k*k)*d; return srcB(p_center+d/vec2(aspect(),1.0)); }`);
add(D, 'bulge', 'Renflement / pincement', 'Bulge / pinch', [pt('center', 'Centre'), f('radius', 'Rayon', 0, 1, 0.35), f('strength', 'Force (− = pincer)', -1, 1, 0.5)],
  `vec4 fx(vec2 uv){ vec2 d=(uv-p_center)*vec2(aspect(),1.0); float r=length(d); if(r<p_radius){ float k=max(r/p_radius,0.001); float f=pow(k,p_strength); d*=mix(f,1.0,smoothstep(0.0,1.0,k)); } return srcB(p_center+d/vec2(aspect(),1.0)); }`);
add(D, 'fisheye', 'Fisheye', 'Fisheye', [f('strength', 'Force', -1, 1, 0.5)],
  `vec4 fx(vec2 uv){ vec2 d=(uv-0.5)*2.0; float r=length(d); float f=p_strength>0.0? atan(r*p_strength*2.0)/(p_strength*2.0*max(r,0.0001))*(1.0+p_strength*0.5) : 1.0+p_strength*r*r; return srcB(0.5+d*f*0.5); }`);
add(D, 'lens', 'Lentille', 'Lens', [pt('center', 'Centre'), f('radius', 'Rayon', 0.01, 1, 0.25), f('refraction', 'Réfraction', 0, 2, 0.6), b('rim', 'Bord brillant', true)],
  `vec4 fx(vec2 uv){ vec2 d=(uv-p_center)*vec2(aspect(),1.0); float r=length(d)/p_radius; if(r>1.0) return src(uv); float z=sqrt(1.0-r*r); vec2 o=d*(1.0-p_refraction*(1.0-z)); vec4 c=srcB(p_center+o/vec2(aspect(),1.0)); if(p_rim>0.5) c.rgb+=pow(1.0-z,4.0)*0.6; return c; }`);
add(D, 'mirror', 'Miroir', 'Mirror', [s('axis', 'Axe', ['Vertical (gauche→droite)', 'Vertical (droite→gauche)', 'Horizontal (haut→bas)', 'Horizontal (bas→haut)', 'Quatre quadrants']), f('position', 'Position', 0, 1, 0.5)],
  `vec4 fx(vec2 uv){ int a=int(p_axis+0.5); vec2 q=uv; float p=p_position; if(a==0&&q.x>p) q.x=2.0*p-q.x; if(a==1&&q.x<p) q.x=2.0*p-q.x; if(a==2&&q.y<1.0-p) q.y=2.0*(1.0-p)-q.y; if(a==3&&q.y>1.0-p) q.y=2.0*(1.0-p)-q.y; if(a==4){ q=abs(q-0.5); q=0.5-q; } return srcB(q); }`);
add(D, 'kaleidoscope', 'Kaléidoscope', 'Kaleidoscope', [pt('center', 'Centre'), f('segments', 'Segments', 2, 24, 6, 1), f('angle', 'Rotation', 0, 360, 0, 1), f('zoom', 'Zoom', 0.2, 4, 1)],
  `vec4 fx(vec2 uv){ vec2 d=(uv-p_center)*vec2(aspect(),1.0); float a=atan(d.y,d.x)+radians(p_angle); float r=length(d)/p_zoom; float seg=PI*2.0/p_segments; a=mod(a,seg); a=abs(a-seg*0.5); vec2 q=vec2(cos(a),sin(a))*r; return srcW(0.5+q/vec2(aspect(),1.0)); }`);
add(D, 'pixelate', 'Mosaïque / Pixelisation', 'Pixelate', [f('size', 'Taille (px)', 1, 200, 16, 1)], `vec4 fx(vec2 uv){ vec2 s=max(p_size*uScale,1.0)/uRes; return src((floor(uv/s)+0.5)*s); }`);
add(D, 'displacementMap', 'Carte de déplacement', 'Displacement map', [asset('map', 'Image de carte (vide = bruit)'), f('amountX', 'Déplacement X', -0.3, 0.3, 0.04), f('amountY', 'Déplacement Y', -0.3, 0.3, 0.04), f('scale', 'Échelle du bruit', 0.5, 30, 4)],
  `vec4 fx(vec2 uv){ vec2 m = uAuxSize.x>0.0 ? texture(uAux,uv).rg : vec2(fbm(uv*p_scale+uTime*0.1), fbm(uv*p_scale+31.7)); return srcB(uv+(m-0.5)*vec2(p_amountX,p_amountY)*2.0); }`, { aux: 'map' });
add(D, 'meshWarp', 'Warp de maillage', 'Mesh warp', [f('top', 'Courbure haut', -0.3, 0.3, 0.05), f('bottom', 'Courbure bas', -0.3, 0.3, -0.05), f('left', 'Courbure gauche', -0.3, 0.3, 0), f('right', 'Courbure droite', -0.3, 0.3, 0), pt('pull', 'Point central', [0.5, 0.5])],
  `vec4 fx(vec2 uv){ vec2 q=uv; float bx=sin(uv.x*PI); float by=sin(uv.y*PI); q.y-= (p_top*uv.y + p_bottom*(1.0-uv.y))*bx; q.x-= (p_right*uv.x + p_left*(1.0-uv.x))*by; q-= (p_pull-0.5)*bx*by; return srcB(q); }`);
add(D, 'liquify', 'Liquéfier', 'Liquify', [pt('center', 'Centre'), f('radius', 'Rayon', 0.01, 1, 0.2), f('pushX', 'Poussée X', -0.5, 0.5, 0.1), f('pushY', 'Poussée Y', -0.5, 0.5, 0)],
  `vec4 fx(vec2 uv){ vec2 d=(uv-p_center)*vec2(aspect(),1.0); float k=exp(-dot(d,d)/(p_radius*p_radius)); return srcB(uv-vec2(p_pushX,-p_pushY)*k); }`);
add(D, 'swirl', 'Tourbillon animé', 'Swirl', [pt('center', 'Centre'), f('strength', 'Force', -20, 20, 5), f('radius', 'Rayon', 0.05, 1.5, 0.5), f('speed', 'Vitesse', -5, 5, 1)],
  `vec4 fx(vec2 uv){ vec2 d=(uv-p_center)*vec2(aspect(),1.0); float r=length(d); float k=max(0.0,1.0-r/p_radius); d=rot(p_strength*k*k*sin(uTime*p_speed))*d; return srcB(p_center+d/vec2(aspect(),1.0)); }`);
add(D, 'cornerPin', 'Perspective / Corner pin', 'Corner pin', [pt('tl', 'Haut gauche', [0.05, 0.05]), pt('tr', 'Haut droit', [0.95, 0.1]), pt('br', 'Bas droit', [0.9, 0.95]), pt('bl', 'Bas gauche', [0.1, 0.9])],
  `float cr2(vec2 a,vec2 b){ return a.x*b.y-a.y*b.x; }
vec2 invBilinear(vec2 p, vec2 a, vec2 b, vec2 c, vec2 d){ vec2 e=b-a, f=d-a, g=a-b+c-d, h=p-a; float k2=cr2(g,f), k1=cr2(e,f)+cr2(h,g), k0=cr2(h,e); if(abs(k2)<0.0001) { float v=-k0/k1; return vec2((h.x-f.x*v)/(e.x+g.x*v), v);} float w=k1*k1-4.0*k0*k2; if(w<0.0) return vec2(-1.0); w=sqrt(w); float v=(-k1-w)/(2.0*k2); if(v<0.0||v>1.0) v=(-k1+w)/(2.0*k2); float u=(h.x-f.x*v)/(e.x+g.x*v); return vec2(u,v); }
vec4 fx(vec2 uv){ vec2 q=invBilinear(uv,p_bl,p_br,p_tr,p_tl); if(q.x<0.0||q.y<0.0||q.x>1.0||q.y>1.0) return vec4(0.0); return src(q); }`);
add(D, 'turbulentDisplace', 'Déplacement turbulent', 'Turbulent displace', [f('amount', 'Quantité', 0, 0.3, 0.03), f('size', 'Taille', 0.5, 40, 6), f('evolution', 'Évolution (vitesse)', 0, 5, 0.5), f('complexity', 'Complexité', 1, 3, 2, 1)],
  `vec4 fx(vec2 uv){ vec2 p=uv*p_size; float t=uTime*p_evolution; vec2 o=vec2(fbm(p+vec2(t,0.0)),fbm(p+vec2(5.2,t)))-0.5; if(p_complexity>1.5) o+=0.5*(vec2(fbm(p*2.7+t),fbm(p*2.7-t+3.1))-0.5); return srcB(uv+o*p_amount*2.0); }`);
add(D, 'chromaticAberration', 'Aberration chromatique', 'Chromatic aberration', [f('amount', 'Quantité (px)', 0, 60, 6), b('radial', 'Radiale', true), f('angle', 'Angle (si linéaire)', 0, 360, 0, 1)],
  `vec4 fx(vec2 uv){ vec2 d= p_radial>0.5 ? (uv-0.5) : vec2(cos(radians(p_angle)),sin(radians(p_angle)))*0.5; vec2 o=d*p_amount*uScale/uRes*(p_radial>0.5?2.0:1.0); vec4 cr=srcB(uv+o), cg=srcB(uv), cb=srcB(uv-o); return vec4(cr.r,cg.g,cb.b,max(cg.a,max(cr.a,cb.a))); }`);
add(D, 'barrel', 'Distorsion en barillet', 'Barrel distortion', [f('k', 'Courbure', 0, 1, 0.25)], `vec4 fx(vec2 uv){ vec2 d=uv-0.5; float r2=dot(d,d); return srcB(0.5+d*(1.0+p_k*r2)/(1.0+p_k*0.25)); }`);
add(D, 'pincushion', 'Distorsion en coussinet', 'Pincushion', [f('k', 'Courbure', 0, 1, 0.25)], `vec4 fx(vec2 uv){ vec2 d=uv-0.5; float r2=dot(d,d); return srcB(0.5+d*(1.0-p_k*r2)); }`);
add(D, 'mirrorTiles', 'Miroir en tuiles', 'Mirror tiles', [f('tiles', 'Tuiles', 1, 12, 3, 1)], `vec4 fx(vec2 uv){ vec2 q=uv*p_tiles; vec2 m=mod(floor(q),2.0); q=fract(q); q=mix(q,1.0-q,m); return src(q); }`);
add(D, 'tile', 'Répétition (tiles)', 'Tile', [f('countX', 'Colonnes', 1, 12, 3, 1), f('countY', 'Lignes', 1, 12, 3, 1), f('offset', 'Décalage rangées', 0, 1, 0)],
  `vec4 fx(vec2 uv){ vec2 q=uv*vec2(p_countX,p_countY); q.x+=step(1.0,mod(floor(q.y),2.0))*p_offset; return src(fract(q)); }`);
add(D, 'polar', 'Coordonnées polaires', 'Polar coordinates', [s('mode', 'Mode', ['Rectangulaire → polaire', 'Polaire → rectangulaire']), f('mix', 'Interpolation', 0, 1, 1)],
  `vec4 fx(vec2 uv){ vec2 q; if(p_mode<0.5){ vec2 d=uv-0.5; q=vec2(atan(d.y,d.x)/(2.0*PI)+0.5, length(d)*2.0); } else { float a=(uv.x-0.5)*2.0*PI; q=0.5+vec2(cos(a),sin(a))*uv.y*0.5; } return srcB(mix(uv,q,p_mix)); }`);
add(D, 'spherize', 'Sphériser', 'Spherize', [pt('center', 'Centre'), f('radius', 'Rayon', 0.05, 1, 0.45), f('amount', 'Quantité', -1, 1, 0.6)],
  `vec4 fx(vec2 uv){ vec2 d=(uv-p_center)*vec2(aspect(),1.0); float r=length(d)/p_radius; if(r<1.0){ float nr= mix(r, asin(r)/(PI*0.5), p_amount); d*= nr/max(r,0.0001);} return srcB(p_center+d/vec2(aspect(),1.0)); }`);
add(D, 'offset', 'Décalage (scroll)', 'Offset', [f('x', 'Décalage X', -1, 1, 0.25), f('y', 'Décalage Y', -1, 1, 0), f('speedX', 'Vitesse X', -2, 2, 0), f('speedY', 'Vitesse Y', -2, 2, 0)], `vec4 fx(vec2 uv){ return srcW(uv-vec2(p_x+uTime*p_speedX,-(p_y+uTime*p_speedY))); }`);
add(D, 'heatHaze', 'Brume de chaleur', 'Heat haze', [f('amount', 'Quantité', 0, 0.05, 0.008), f('scale', 'Échelle', 1, 60, 20), f('speed', 'Vitesse', 0, 10, 3)],
  `vec4 fx(vec2 uv){ float n=vnoise(vec2(uv.x*p_scale, uv.y*p_scale*0.5-uTime*p_speed)); return srcB(uv+vec2(n-0.5,(n-0.5)*0.5)*p_amount*2.0); }`);
add(D, 'glassBlocks', 'Briques de verre', 'Glass blocks', [f('size', 'Taille des blocs (px)', 8, 200, 48), f('refraction', 'Réfraction', 0, 1, 0.4)],
  `vec4 fx(vec2 uv){ vec2 s=p_size*uScale/uRes; vec2 c=(floor(uv/s)+0.5)*s; vec2 l=(uv-c)/s; return srcB(uv-l*s*p_refraction); }`);
add(D, 'flip', 'Retourner', 'Flip', [b('horizontal', 'Horizontal', true), b('vertical', 'Vertical', false)], `vec4 fx(vec2 uv){ vec2 q=uv; if(p_horizontal>0.5) q.x=1.0-q.x; if(p_vertical>0.5) q.y=1.0-q.y; return src(q); }`);
add(D, 'transformFx', 'Transformation interne', 'Transform', [f('scale', 'Échelle', 0.1, 5, 1.2), f('rotation', 'Rotation', -180, 180, 0, 1), f('x', 'Position X', -1, 1, 0), f('y', 'Position Y', -1, 1, 0)],
  `vec4 fx(vec2 uv){ vec2 d=(uv-0.5-vec2(p_x,-p_y))*vec2(aspect(),1.0); d=rot(radians(-p_rotation))*d/p_scale; return srcB(0.5+d/vec2(aspect(),1.0)); }`);
add(D, 'waterRefraction', 'Réfraction d\'eau', 'Water refraction', [f('amount', 'Quantité', 0, 0.06, 0.012), f('scale', 'Échelle', 1, 40, 10), f('speed', 'Vitesse', 0, 5, 1)],
  `vec4 fx(vec2 uv){ float t=uTime*p_speed; vec2 p=uv*p_scale; vec2 o=vec2(sin(p.y*1.3+t)+sin(p.x*0.7+t*1.7), cos(p.x*1.1-t)+cos(p.y*0.9+t*1.3))*0.25; return srcB(uv+o*p_amount); }`);
add(D, 'shear', 'Cisaillement', 'Shear', [f('x', 'Cisaillement X', -1, 1, 0.2), f('y', 'Cisaillement Y', -1, 1, 0)], `vec4 fx(vec2 uv){ vec2 d=uv-0.5; d=vec2(d.x+d.y*p_x, d.y+d.x*p_y); return srcB(0.5+d); }`);

// ======================= STYLISATION =======================
const S = 'stylisation';
add(S, 'rgbSplit', 'Glitch RGB split', 'RGB split', [f('amount', 'Décalage (px)', 0, 80, 12), f('speed', 'Vitesse du jitter', 0, 30, 8), f('jitter', 'Jitter', 0, 1, 0.5)],
  `vec4 fx(vec2 uv){ float j=(hash12(vec2(floor(uTime*p_speed),3.0))-0.5)*p_jitter; vec2 o=vec2(p_amount*(1.0+j),0.0)*uScale/uRes; vec4 r=srcB(uv+o), g=srcB(uv), b2=srcB(uv-o); return vec4(r.r,g.g,b2.b,max(g.a,max(r.a,b2.a))); }`);
add(S, 'glitchBlocks', 'Glitch blocs', 'Glitch blocks', [f('amount', 'Intensité', 0, 1, 0.5), f('blockSize', 'Taille des blocs', 4, 100, 30), f('speed', 'Vitesse', 0, 30, 10)],
  `vec4 fx(vec2 uv){ float t=floor(uTime*p_speed); vec2 b0=floor(uv*uRes/(p_blockSize*uScale)*vec2(0.3,1.0)); float h=hash12(b0+t); vec2 q=uv; vec4 c; if(h<p_amount*0.4){ q.x+= (hash12(b0+t+7.0)-0.5)*0.2; c=srcB(q); c.rgb=mix(c.rgb, c.gbr, step(0.5,hash12(b0+t+2.0))); } else c=src(uv); return c; }`);
add(S, 'scanlines', 'Lignes de balayage', 'Scanlines', [f('density', 'Densité (lignes)', 50, 1200, 400), f('intensity', 'Intensité', 0, 1, 0.35), f('speed', 'Défilement', -5, 5, 0)],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); float s=sin((uv.y+uTime*p_speed*0.05)*p_density*PI)*0.5+0.5; c.rgb*=1.0-p_intensity*s; return c; }`);
add(S, 'datamosh', 'Datamosh simulé', 'Datamosh', [f('amount', 'Intensité', 0, 1, 0.6), f('blockSize', 'Taille des blocs (px)', 8, 64, 16), f('speed', 'Vitesse', 0, 20, 6)],
  `vec4 fx(vec2 uv){ vec2 bs=p_blockSize*uScale/uRes; vec2 b0=floor(uv/bs); float t=floor(uTime*p_speed); float h=hash12(b0*0.37+t); vec2 mv=(hash22(b0+t*1.3)-0.5)*bs*8.0*p_amount; vec4 c=src(uv); if(h<p_amount*0.6){ c=srcB(uv+mv); c.rgb+=vec3(0.05,-0.03,0.06)*p_amount; } return c; }`);
add(S, 'sliceShift', 'Glitch tranches', 'Slice shift', [f('slices', 'Tranches', 2, 80, 20, 1), f('amount', 'Décalage', 0, 0.3, 0.05), f('speed', 'Vitesse', 0, 30, 12)],
  `vec4 fx(vec2 uv){ float s=floor(uv.y*p_slices); float h=hash12(vec2(s,floor(uTime*p_speed))); float o=(h-0.5)*2.0*p_amount*step(0.6,hash12(vec2(s*1.7,floor(uTime*p_speed)+3.0))); return srcB(uv+vec2(o,0.0)); }`);
add(S, 'vhs', 'VHS', 'VHS', [f('noise', 'Bruit', 0, 1, 0.3), f('tracking', 'Tracking', 0, 1, 0.3), f('bleed', 'Bavure chroma (px)', 0, 20, 4), f('saturation', 'Saturation', 0, 2, 0.8)],
  `vec4 fx(vec2 uv){ float t=uTime; float band=smoothstep(0.0,0.02,abs(fract(uv.y*0.7-t*0.15)-0.5)-0.47+p_tracking*0.05); vec2 q=uv; q.x+= (1.0-band)*0.02*p_tracking*sin(uv.y*400.0+t*30.0); q.x+= (hash12(vec2(floor(uv.y*240.0),floor(t*24.0)))-0.5)*0.003*p_tracking; vec2 bo=vec2(p_bleed*uScale/uRes.x,0.0);
  vec4 c=src(q); float y=luma(c.rgb); vec3 cb=(src(q+bo).rgb+src(q+bo*2.0).rgb)*0.5; vec3 ch=cb-vec3(luma(cb)); c.rgb=vec3(y)+ch*p_saturation; c.rgb+= (hash12(uv*uRes+floor(t*30.0))-0.5)*p_noise*0.35; c.rgb+= (1.0-band)*0.25*p_tracking; return c; }`);
add(S, 'crt', 'CRT', 'CRT', [f('curvature', 'Courbure', 0, 0.5, 0.15), f('scanlines', 'Lignes', 0, 1, 0.4), f('mask', 'Masque RVB', 0, 1, 0.3), f('glow', 'Phosphore (glow)', 0, 1, 0.3), f('vignette', 'Vignette', 0, 1, 0.4)],
  `vec4 fx(vec2 uv){ vec2 d=uv-0.5; d*=1.0+p_curvature*dot(d,d)*2.0; vec2 q=0.5+d; if(q.x<0.0||q.y<0.0||q.x>1.0||q.y>1.0) return vec4(0.0,0.0,0.0,1.0); vec4 c=src(q); c.rgb+=blur(q,6.0*uScale).rgb*p_glow*0.6; float sl=sin(q.y*uRes.y*PI/max(2.0*uScale,1.0))*0.5+0.5; c.rgb*=1.0-p_scanlines*sl*0.6; float m=mod(floor(gl_FragCoord.x/max(uScale,1.0)),3.0); vec3 mk=m<1.0?vec3(1.0,0.7,0.7):m<2.0?vec3(0.7,1.0,0.7):vec3(0.7,0.7,1.0); c.rgb*=mix(vec3(1.0),mk,p_mask); c.rgb*=1.0-p_vignette*smoothstep(0.25,0.75,length(d)); c.a=1.0; return c; }`);
add(S, 'halftoneDots', 'Trame de points (halftone)', 'Halftone dots', [f('size', 'Taille (px)', 3, 60, 10), f('angle', 'Angle', 0, 90, 45, 1), b('color', 'En couleur', false), c('ink', 'Encre', '#050505'), c('paper', 'Papier', '#f5f1e6')],
  `vec4 fx(vec2 uv){ vec2 p=rot(radians(p_angle))*(uv*uRes)/(p_size*uScale); vec2 cell=fract(p)-0.5; vec2 cid=floor(p)+0.5; vec2 cuv=(transpose(rot(radians(p_angle)))*(cid*p_size*uScale))/uRes; vec4 s=src(cuv); float l=luma(s.rgb); float r=sqrt(1.0-l)*0.7; float dt=1.0-smoothstep(r-0.06,r+0.06,length(cell)); vec3 o= p_color>0.5 ? mix(p_paper, s.rgb*0.9, dt) : mix(p_paper,p_ink,dt); return vec4(o, src(uv).a); }`);
add(S, 'halftoneLines', 'Trame de lignes', 'Halftone lines', [f('size', 'Espacement (px)', 3, 40, 8), f('angle', 'Angle', 0, 180, 30, 1), c('ink', 'Encre', '#050505'), c('paper', 'Papier', '#f5f1e6')],
  `vec4 fx(vec2 uv){ vec2 p=rot(radians(p_angle))*(uv*uRes)/(p_size*uScale); vec4 s=src(uv); float l=luma(s.rgb); float d=abs(fract(p.y)-0.5); float w=(1.0-l)*0.5; float m=1.0-smoothstep(w-0.05,w+0.05,d); return vec4(mix(p_paper,p_ink,m), s.a); }`);
add(S, 'pixelArt', 'Pixel art', 'Pixel art', [f('size', 'Taille des pixels', 2, 40, 8, 1), f('levels', 'Couleurs par canal', 2, 16, 5, 1), b('outline', 'Contour', true)],
  `vec4 fx(vec2 uv){ vec2 s=p_size*uScale/uRes; vec2 cuv=(floor(uv/s)+0.5)*s; vec4 c=src(cuv); c.rgb=floor(c.rgb*(p_levels-1.0)+0.5)/(p_levels-1.0); if(p_outline>0.5){ float a1=src(cuv+vec2(s.x,0.0)).a, a2=src(cuv-vec2(s.x,0.0)).a, a3=src(cuv+vec2(0.0,s.y)).a, a4=src(cuv-vec2(0.0,s.y)).a; if(c.a<0.5 && max(max(a1,a2),max(a3,a4))>0.5) c=vec4(0.0,0.0,0.0,1.0);} c.a=step(0.5,c.a); return c; }`);
add(S, 'ascii', 'Art ASCII', 'ASCII art', [f('size', 'Taille des caractères (px)', 4, 40, 10, 1), c('color', 'Couleur', '#24d26d'), b('useSource', 'Couleur source', false), c('background', 'Fond', '#050505')],
  `float glyph(float n, vec2 p){ p=floor(p*vec2(-4.0,4.0)+2.5); if(clamp(p.x,0.0,4.0)==p.x && clamp(p.y,0.0,4.0)==p.y){ float k=p.x+5.0*p.y; if(int(mod(n/exp2(k),2.0))==1) return 1.0; } return 0.0; }
vec4 fx(vec2 uv){ vec2 cs=p_size*uScale/uRes; vec2 cuv=(floor(uv/cs)+0.5)*cs; vec4 s=src(cuv); float g=luma(s.rgb); float n=4096.0; if(g>0.2) n=65600.0; if(g>0.3) n=332772.0; if(g>0.4) n=15255086.0; if(g>0.5) n=23385164.0; if(g>0.6) n=15252014.0; if(g>0.7) n=13199452.0; if(g>0.8) n=11512810.0; vec2 p=mod(uv/cs,1.0)-0.5; float m=glyph(n,p*1.2); vec3 col=p_useSource>0.5?s.rgb:p_color; return vec4(mix(p_background,col,m), max(s.a, 1.0)); }`);
add(S, 'lineDrawing', 'Dessin au trait', 'Line drawing', [f('strength', 'Force du trait', 0, 10, 3), c('ink', 'Encre', '#111111'), c('paper', 'Papier', '#fbfaf5')],
  `vec4 fx(vec2 uv){ vec2 p=px()*1.2; float e=0.0; for(int i=0;i<4;i++){ vec2 d= i==0?vec2(p.x,0.0): i==1?vec2(0.0,p.y): i==2?p: vec2(p.x,-p.y); e+=abs(luma(src(uv+d).rgb)-luma(src(uv-d).rgb)); } e=clamp(e*p_strength,0.0,1.0); return vec4(mix(p_paper,p_ink,e), src(uv).a); }`);
add(S, 'watercolor', 'Aquarelle', 'Watercolor', [f('bleed', 'Diffusion (px)', 1, 20, 6), f('paper', 'Texture papier', 0, 1, 0.5), f('levels', 'Niveaux', 3, 16, 7, 1)],
  `vec4 fx(vec2 uv){ vec2 o=(vec2(fbm(uv*30.0),fbm(uv*30.0+5.0))-0.5)*p_bleed*uScale/uRes*4.0; vec4 c=blur(uv+o,p_bleed*uScale); c.rgb=floor(c.rgb*p_levels+0.5)/p_levels; float g=fbm(uv*uRes/6.0); c.rgb*= 1.0-p_paper*0.25*g; c.rgb=mix(c.rgb,vec3(1.0),0.08); return c; }`);
add(S, 'oilPaint', 'Peinture à l\'huile', 'Oil paint', [f('radius', 'Rayon (px)', 1, 12, 4)],
  `vec4 fx(vec2 uv){ vec3 m[4]; vec3 s2[4]; for(int k=0;k<4;k++){m[k]=vec3(0.0); s2[k]=vec3(0.0);} float r=p_radius*uScale; for(int j=-3;j<=3;j++) for(int i=-3;i<=3;i++){ vec3 c=src(uv+vec2(float(i),float(j))*r/3.0/uRes).rgb; if(i<=0&&j<=0){m[0]+=c;s2[0]+=c*c;} if(i>=0&&j<=0){m[1]+=c;s2[1]+=c*c;} if(i<=0&&j>=0){m[2]+=c;s2[2]+=c*c;} if(i>=0&&j>=0){m[3]+=c;s2[3]+=c*c;} }
  float best=1e9; vec3 res=vec3(0.0); for(int k=0;k<4;k++){ vec3 mu=m[k]/16.0; vec3 v=abs(s2[k]/16.0-mu*mu); float sg=v.r+v.g+v.b; if(sg<best){best=sg;res=mu;} } return vec4(res,src(uv).a); }`);
add(S, 'toon', 'Cartoon (toon)', 'Toon', [f('levels', 'Niveaux', 2, 10, 4, 1), f('edges', 'Contours', 0, 5, 1.5), f('saturation', 'Saturation', 0, 2, 1.3)],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); vec3 h=rgb2hsv(c.rgb); h.z=floor(h.z*p_levels+0.5)/p_levels; h.y=clamp(h.y*p_saturation,0.0,1.0); c.rgb=hsv2rgb(h); vec2 p=px(); float e=abs(luma(src(uv+vec2(p.x,0)).rgb)-luma(src(uv-vec2(p.x,0)).rgb))+abs(luma(src(uv+vec2(0,p.y)).rgb)-luma(src(uv-vec2(0,p.y)).rgb)); c.rgb*=1.0-smoothstep(0.1,0.3,e*p_edges); return c; }`);
add(S, 'comic', 'Bande dessinée', 'Comic', [f('dots', 'Taille trame (px)', 3, 20, 6), f('edges', 'Contours', 0, 5, 2), f('levels', 'Niveaux', 2, 8, 4, 1)],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); c.rgb=floor(c.rgb*p_levels+0.5)/p_levels; vec2 g=fract(uv*uRes/(p_dots*uScale))-0.5; float l=luma(c.rgb); float dot1=1.0-smoothstep(0.3*(1.0-l),0.3*(1.0-l)+0.08,length(g)); c.rgb*=1.0-dot1*0.35; vec2 p=px(); float e=abs(luma(src(uv+vec2(p.x,0)).rgb)-luma(src(uv-vec2(p.x,0)).rgb))+abs(luma(src(uv+vec2(0,p.y)).rgb)-luma(src(uv-vec2(0,p.y)).rgb)); c.rgb*=1.0-smoothstep(0.1,0.25,e*p_edges); return c; }`);
add(S, 'crystallize', 'Cristalliser (mosaïque)', 'Crystallize', [f('size', 'Taille des cellules (px)', 4, 120, 24)],
  `vec4 fx(vec2 uv){ vec2 p=uv*uRes/(p_size*uScale); vec2 i=floor(p); float md=9.0; vec2 best=vec2(0.0); for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ vec2 n=i+vec2(float(x),float(y)); vec2 pt=n+hash22(n); float d=length(pt-p); if(d<md){md=d;best=pt;} } return src(best*p_size*uScale/uRes); }`);
add(S, 'stainedGlass', 'Vitrail', 'Stained glass', [f('size', 'Taille des cellules (px)', 8, 160, 40), f('border', 'Épaisseur des plombs', 0, 0.3, 0.06), f('saturation', 'Saturation', 0, 3, 1.6)],
  `vec4 fx(vec2 uv){ vec2 p=uv*uRes/(p_size*uScale); vec2 i=floor(p); float d1=9.0,d2=9.0; vec2 best=vec2(0.0); for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ vec2 n=i+vec2(float(x),float(y)); vec2 pt=n+hash22(n); float d=length(pt-p); if(d<d1){d2=d1;d1=d;best=pt;} else if(d<d2){d2=d;} } vec4 c=src(best*p_size*uScale/uRes); c.rgb=mix(vec3(luma(c.rgb)),c.rgb,p_saturation)*1.1; c.rgb*=smoothstep(p_border,p_border+0.03,d2-d1); return c; }`);
add(S, 'thermal', 'Caméra thermique', 'Thermal', [f('contrast', 'Contraste', 0.5, 3, 1.2)],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); float l=clamp((luma(c.rgb)-0.5)*p_contrast+0.5,0.0,1.0); vec3 a=vec3(0.0,0.0,0.3), b1=vec3(0.5,0.0,0.6), b2=vec3(1.0,0.2,0.0), b3=vec3(1.0,0.85,0.0), b4=vec3(1.0); vec3 o= l<0.25?mix(a,b1,l*4.0): l<0.5?mix(b1,b2,(l-0.25)*4.0): l<0.75?mix(b2,b3,(l-0.5)*4.0): mix(b3,b4,(l-0.75)*4.0); return vec4(o,c.a); }`);
add(S, 'nightVision', 'Vision nocturne', 'Night vision', [f('gain', 'Gain', 0.5, 4, 1.8), f('noise', 'Bruit', 0, 1, 0.35), b('scope', 'Lunette', true)],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); float l=luma(c.rgb)*p_gain; l+= (hash12(uv*uRes+fract(uTime)*100.0)-0.5)*p_noise*0.4; vec3 o=vec3(0.1,1.0,0.2)*l; o*=0.9+0.1*sin(uv.y*uRes.y*1.5); if(p_scope>0.5){ vec2 d=(uv-0.5)*vec2(aspect(),1.0); o*=1.0-smoothstep(0.42,0.48,length(d)); } return vec4(o,1.0); }`);
add(S, 'hologram', 'Hologramme', 'Hologram', [c('color', 'Couleur', '#24d2ff'), f('lines', 'Lignes', 50, 800, 300), f('flicker', 'Scintillement', 0, 1, 0.3), f('glitch', 'Glitch', 0, 1, 0.2)],
  `vec4 fx(vec2 uv){ float g=step(1.0-p_glitch*0.15,hash12(vec2(floor(uv.y*40.0),floor(uTime*12.0)))); vec4 c=src(uv+vec2(g*0.02,0.0)); float l=luma(c.rgb); float sl=0.6+0.4*sin((uv.y+uTime*0.1)*p_lines); float fl=1.0-p_flicker*0.5*hash12(vec2(floor(uTime*20.0),1.0)); vec3 o=p_color*(l*1.4+0.15)*sl*fl; return vec4(o, c.a*(0.55+0.45*sl)); }`);
add(S, 'neon', 'Néon', 'Neon', [c('color', 'Couleur', '#24d26d'), f('width', 'Épaisseur', 0.5, 6, 1.5), f('glow', 'Halo', 0, 3, 1.2), b('useSource', 'Couleur source', false)],
  `vec4 fx(vec2 uv){ vec2 p=px()*p_width*uScale; float e=0.0; for(int i=0;i<8;i++){ float a=float(i)*PI/4.0; vec2 d=vec2(cos(a),sin(a))*p; e+=abs(src(uv+d).a-src(uv-d).a)+abs(luma(src(uv+d).rgb)-luma(src(uv-d).rgb))*0.5; } e=clamp(e*0.6,0.0,1.0); vec4 bl=blur(uv,12.0*uScale); float h=bl.a*0.5; vec3 col=p_useSource>0.5? src(uv).rgb*1.5 : p_color; return vec4(col*(e+h*p_glow)+vec3(1.0)*e*0.4, clamp(e+h*p_glow,0.0,1.0)); }`);
add(S, 'glow', 'Lueur (glow)', 'Glow', [f('threshold', 'Seuil', 0, 1, 0.6), f('radius', 'Rayon (px)', 1, 120, 24), f('intensity', 'Intensité', 0, 5, 1.2), c('tint', 'Teinte', '#ffffff')],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); vec3 acc=vec3(0.0); float w=0.0; float r=p_radius*uScale; for(int i=0;i<48;i++){ float fi=float(i)+0.5; float rr=sqrt(fi/48.0)*r; float a=fi*2.39996; vec4 s=src(uv+vec2(cos(a),sin(a))*rr/uRes); float wt=exp(-rr*rr/(r*r*0.5)); acc+=s.rgb*s.a*smoothstep(p_threshold,1.0,luma(s.rgb))*wt; w+=wt; } vec3 g=acc/w*p_intensity*p_tint*3.0; float na=clamp(c.a+luma(g),0.0,1.0); return vec4((c.rgb*c.a+g)/max(na,0.001), na); }`);
add(S, 'bloom', 'Bloom', 'Bloom', [f('threshold', 'Seuil', 0, 1, 0.7), f('radius', 'Rayon (px)', 1, 200, 40), f('intensity', 'Intensité', 0, 4, 0.9)],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); vec3 acc=vec3(0.0); float w=0.0; float r=p_radius*uScale; for(int i=0;i<64;i++){ float fi=float(i)+0.5; float rr=sqrt(fi/64.0)*r; float a=fi*2.39996; vec4 s=src(uv+vec2(cos(a),sin(a))*rr/uRes); float wt=1.0/(1.0+rr*rr/(r*r)*8.0); acc+=s.rgb*s.a*max(luma(s.rgb)-p_threshold,0.0)/(1.0-p_threshold+0.001)*wt; w+=wt; } vec3 g=acc/w*p_intensity*2.0; float na=clamp(c.a+luma(g),0.0,1.0); return vec4((c.rgb*c.a+g)/max(na,0.001), na); }`);
add(S, 'dropShadow', 'Ombre portée', 'Drop shadow', [c('color', 'Couleur', '#000000'), f('opacity', 'Opacité', 0, 1, 0.6), f('angle', 'Angle', 0, 360, 135, 1), f('distance', 'Distance (px)', 0, 200, 14), f('softness', 'Douceur (px)', 0, 100, 16)],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); vec2 o=vec2(cos(radians(p_angle)),-sin(radians(p_angle)))*p_distance*uScale/uRes*vec2(-1.0,1.0); float sa=blur(uv+o,p_softness*uScale).a*p_opacity; float na=c.a+sa*(1.0-c.a); vec3 col=(c.rgb*c.a+p_color*sa*(1.0-c.a))/max(na,0.001); return vec4(col,na); }`);
add(S, 'innerShadow', 'Ombre interne', 'Inner shadow', [c('color', 'Couleur', '#000000'), f('opacity', 'Opacité', 0, 1, 0.6), f('angle', 'Angle', 0, 360, 135, 1), f('distance', 'Distance (px)', 0, 100, 8), f('softness', 'Douceur (px)', 0, 60, 10)],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); vec2 o=vec2(cos(radians(p_angle)),-sin(radians(p_angle)))*p_distance*uScale/uRes*vec2(-1.0,1.0); float sa=(1.0-blur(uv+o,p_softness*uScale).a)*p_opacity; c.rgb=mix(c.rgb,p_color,sa); return c; }`);
add(S, 'stroke', 'Contour externe', 'Outer stroke', [c('color', 'Couleur', '#24d26d'), f('width', 'Épaisseur (px)', 0, 40, 4), f('opacity', 'Opacité', 0, 1, 1)],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); float m=0.0; float w=p_width*uScale; for(int i=0;i<24;i++){ float a=float(i)/24.0*2.0*PI; m=max(m,src(uv+vec2(cos(a),sin(a))*w/uRes).a); m=max(m,src(uv+vec2(cos(a),sin(a))*w*0.5/uRes).a);} float sa=m*p_opacity; float na=c.a+sa*(1.0-c.a); return vec4((c.rgb*c.a+p_color*sa*(1.0-c.a))/max(na,0.001),na); }`);
add(S, 'extrude', 'Extrusion 3D simulée', '3D extrude', [f('depth', 'Profondeur (px)', 0, 80, 20), f('angle', 'Angle', 0, 360, 225, 1), c('color', 'Couleur des flancs', '#0f3d22'), f('shade', 'Ombrage', 0, 1, 0.5)],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); if(c.a>0.99) return c; vec2 d=vec2(cos(radians(p_angle)),sin(radians(p_angle)))/uRes*uScale; float hit=0.0; float k=0.0; for(int i=1;i<=40;i++){ float fi=float(i)/40.0*p_depth; float a=src(uv-d*fi).a; if(a>0.5 && hit<0.5){ hit=1.0; k=fi/max(p_depth,0.001);} } vec3 side=p_color*(1.0-p_shade*k); float na=c.a+hit*(1.0-c.a); return vec4((c.rgb*c.a+side*hit*(1.0-c.a))/max(na,0.001),na); }`);
add(S, 'strobe', 'Stroboscope', 'Strobe', [f('frequency', 'Fréquence (Hz)', 0.5, 30, 6), c('color', 'Couleur', '#ffffff'), f('duty', 'Durée du flash', 0.05, 0.9, 0.3), s('mode', 'Mode', ['Couleur', 'Transparent'])],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); float on=step(fract(uTime*p_frequency),p_duty); if(p_mode<0.5) c.rgb=mix(c.rgb,p_color,on); else c.a*=1.0-on; return c; }`);
add(S, 'flicker', 'Scintillement', 'Flicker', [f('amount', 'Intensité', 0, 1, 0.3), f('speed', 'Vitesse', 1, 60, 18)], `vec4 fx(vec2 uv){ vec4 c=src(uv); float n=vnoise(vec2(uTime*p_speed,0.0)); c.rgb*=1.0-p_amount*n; return c; }`);
add(S, 'vignette', 'Vignette', 'Vignette', [f('amount', 'Quantité', 0, 1, 0.5), f('size', 'Taille', 0, 1.5, 0.6), f('softness', 'Douceur', 0.01, 1, 0.5), f('roundness', 'Rondeur', 0, 1, 1), c('color', 'Couleur', '#000000')],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); vec2 d=(uv-0.5)*mix(vec2(1.0),vec2(aspect(),1.0),p_roundness)*1.4; float v=smoothstep(p_size,p_size+p_softness,length(d)); c.rgb=mix(c.rgb,p_color,v*p_amount); return c; }`);
add(S, 'halation', 'Halation', 'Halation', [f('threshold', 'Seuil', 0, 1, 0.75), f('radius', 'Rayon (px)', 2, 80, 20), f('intensity', 'Intensité', 0, 3, 1), c('color', 'Couleur', '#ff3a1a')],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); vec4 bl=blur(uv,p_radius*uScale); float h=smoothstep(p_threshold,1.0,luma(bl.rgb))*bl.a; c.rgb+=p_color*h*p_intensity*(1.0-smoothstep(p_threshold,1.0,luma(c.rgb))*0.5); return c; }`);
add(S, 'lensFlare', 'Lens flare', 'Lens flare', [pt('position', 'Position source', [0.3, 0.25]), f('intensity', 'Intensité', 0, 3, 1), c('color', 'Couleur', '#ffd9a0'), s('type', 'Type', ['Classique', 'Anamorphique', 'Étoile'])],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); vec2 a=vec2(aspect(),1.0); vec2 d=(uv-p_position)*a; float r=length(d); int t=int(p_type+0.5); vec3 f=vec3(0.0); f+=p_color*0.06/(r+0.02); if(t==1) f+=p_color*vec3(0.6,0.8,1.0)*0.02/(abs(d.y)+0.003)*exp(-abs(d.x)*1.5); if(t==2){ float an=atan(d.y,d.x); f+=p_color*pow(abs(cos(an*3.0)),40.0)*0.15/(r+0.05);} vec2 axis=(vec2(0.5)-p_position); for(int i=1;i<6;i++){ float fi=float(i); vec2 gp=p_position+axis*fi*0.45; float gr=length((uv-gp)*a); f+=mix(p_color,vec3(0.3,0.6,1.0),fi/6.0)*smoothstep(0.03+fi*0.012,0.0,gr)*0.25; } f+=p_color*smoothstep(0.32,0.3,abs(length((uv-0.5)*a)-0.3))*0.0; c.rgb+=f*p_intensity; c.a=max(c.a,clamp(luma(f*p_intensity),0.0,1.0)); return c; }`);
add(S, 'lightLeaks', 'Fuites de lumière', 'Light leaks', [f('intensity', 'Intensité', 0, 2, 0.8), f('speed', 'Vitesse', 0, 3, 0.4), c('c1', 'Couleur 1', '#ff6a00'), c('c2', 'Couleur 2', '#ff2a7a')],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); float t=uTime*p_speed; float n1=fbm(uv*1.5+vec2(t,0.3*t)); float n2=fbm(uv*2.0-vec2(0.4*t,t)+7.0); vec3 l=p_c1*smoothstep(0.45,0.85,n1)*smoothstep(0.6,0.0,uv.x)+p_c2*smoothstep(0.5,0.9,n2)*smoothstep(0.3,1.0,uv.y); vec3 sc=1.0-(1.0-c.rgb)*(1.0-l*p_intensity); c.rgb=sc; return c; }`);
add(S, 'lightRays', 'Rayons lumineux', 'Light rays', [pt('center', 'Source', [0.5, 0.15]), f('intensity', 'Intensité', 0, 3, 1), f('decay', 'Atténuation', 0.8, 1, 0.96), f('threshold', 'Seuil', 0, 1, 0.5)],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); vec2 d=(uv-p_center)/48.0; vec2 q=uv; vec3 acc=vec3(0.0); float w=1.0; for(int i=0;i<48;i++){ q-=d; vec4 s=src(q); acc+=s.rgb*s.a*smoothstep(p_threshold,1.0,luma(s.rgb))*w; w*=p_decay; } c.rgb+=acc/48.0*p_intensity*4.0; return c; }`);
add(S, 'haze', 'Brume', 'Haze', [f('amount', 'Densité', 0, 1, 0.35), c('color', 'Couleur', '#c8d4e0'), f('height', 'Hauteur', 0, 1, 0.6), f('speed', 'Mouvement', 0, 2, 0.2)],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); float n=fbm(uv*vec2(3.0,6.0)+vec2(uTime*p_speed,0.0)); float h=smoothstep(p_height,0.0,uv.y)*0.5+0.5; c.rgb=mix(c.rgb,p_color,p_amount*n*h*1.4); return c; }`);
add(S, 'rainGlass', 'Pluie sur vitre', 'Rain on glass', [f('amount', 'Quantité', 0, 1, 0.6), f('speed', 'Vitesse', 0, 3, 1), f('blur', 'Flou du fond (px)', 0, 30, 8)],
  `vec4 fx(vec2 uv){ vec2 g=vec2(24.0,12.0); vec2 p=uv*g; p.y+=uTime*p_speed*0.6; vec2 id=floor(p); vec2 f=fract(p)-0.5; float h=hash12(id); vec2 ofs=vec2((h-0.5)*0.6, fract(-uTime*p_speed*(0.3+h)+h)-0.5); float d=length((f-ofs)*vec2(1.0,0.7)); float drop=smoothstep(0.12,0.05,d)*step(h,p_amount); vec2 n=(f-ofs)*drop*0.08; vec4 bg=blur(uv,p_blur*uScale*(1.0-drop)); vec4 sharp=src(uv+n); return mix(bg,sharp,drop); }`);
add(S, 'tear', 'Déchirure', 'Tear', [f('position', 'Position', 0, 1, 0.5), f('angle', 'Angle', -60, 60, 10, 1), f('gap', 'Écart', 0, 0.3, 0.04), f('roughness', 'Rugosité', 0, 1, 0.5), c('edge', 'Bord du papier', '#f4f1ea')],
  `vec4 fx(vec2 uv){ vec2 n=vec2(sin(radians(p_angle)),cos(radians(p_angle))); float d=dot(uv-vec2(0.5,1.0-p_position),n); d+=(fbm(uv*40.0)-0.5)*0.04*p_roughness; float side=d<0.0?-1.0:1.0; float e=abs(d); if(e<p_gap*0.5) return vec4(0.0); vec4 c=srcB(uv-n*side*p_gap*0.5); if(e<p_gap*0.5+0.006) return vec4(p_edge,1.0); return c; }`);
add(S, 'burnEdges', 'Bords brûlés', 'Burned edges', [f('amount', 'Quantité', 0, 1, 0.5), c('color', 'Couleur brûlure', '#3a1a05'), f('scale', 'Échelle', 1, 20, 6)],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); vec2 d=abs(uv-0.5)*2.0; float e=max(d.x,d.y); float n=fbm(uv*p_scale); float k=smoothstep(1.0-p_amount*0.6,1.0,e+n*0.3); c.rgb=mix(c.rgb,p_color,k); c.rgb*=1.0-smoothstep(0.85,1.0,e+n*0.3)*p_amount; return c; }`);
add(S, 'sketch', 'Croquis au crayon', 'Pencil sketch', [f('strength', 'Force', 0, 4, 1.5), f('hatch', 'Hachures', 0, 1, 0.5)],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); float l=luma(c.rgb); vec2 p=px(); float e=abs(luma(src(uv+vec2(p.x,0)).rgb)-luma(src(uv-vec2(p.x,0)).rgb))+abs(luma(src(uv+vec2(0,p.y)).rgb)-luma(src(uv-vec2(0,p.y)).rgb)); float h=step(0.5,fract((uv.x+uv.y)*uRes.y/6.0))*step(l,0.5)*p_hatch*0.4; float g=1.0-clamp(e*p_strength*3.0,0.0,1.0)-h; return vec4(vec3(g*0.95+0.03),c.a); }`);
add(S, 'dither', 'Tramage (dither)', 'Dither', [f('levels', 'Niveaux', 2, 8, 2, 1), f('scale', 'Échelle', 1, 8, 2, 1), b('color', 'En couleur', true)],
  `float bayer4(vec2 p){ ivec2 i=ivec2(mod(p,4.0)); int m[16]=int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5); return float(m[i.y*4+i.x])/16.0; }
vec4 fx(vec2 uv){ vec4 c=src(uv); vec2 cp=floor(gl_FragCoord.xy/(p_scale*max(uScale,0.5))); float t=bayer4(cp)-0.5; vec3 v= p_color>0.5 ? c.rgb : vec3(luma(c.rgb)); v=floor(v*(p_levels-1.0)+t+0.5)/(p_levels-1.0); return vec4(v,c.a); }`);
add(S, 'prism', 'Prisme (dispersion)', 'Prism', [f('amount', 'Dispersion (px)', 0, 40, 10), f('angle', 'Angle', 0, 360, 0, 1)],
  `vec4 fx(vec2 uv){ vec2 d=vec2(cos(radians(p_angle)),sin(radians(p_angle)))*p_amount*uScale/uRes; vec3 acc=vec3(0.0); float a=0.0; for(int i=0;i<7;i++){ float t=float(i)/6.0; vec4 s=srcB(uv+d*(t-0.5)*2.0); vec3 w=hsv2rgb(vec3(t*0.8,1.0,1.0)); acc+=s.rgb*w; a+=s.a; } return vec4(acc/2.3, a/7.0); }`);
add(S, 'edgeGlow', 'Contours lumineux', 'Edge glow', [c('color', 'Couleur', '#24d26d'), f('strength', 'Force', 0, 6, 2), f('mix', 'Mélange avec source', 0, 1, 0.3)],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); vec2 p=px()*1.5; float e=abs(luma(src(uv+vec2(p.x,0)).rgb)-luma(src(uv-vec2(p.x,0)).rgb))+abs(luma(src(uv+vec2(0,p.y)).rgb)-luma(src(uv-vec2(0,p.y)).rgb)); e=clamp(e*p_strength,0.0,1.0); return vec4(c.rgb*p_mix+p_color*e,c.a); }`);
add(S, 'posterEdges', 'Contours postérisés', 'Poster edges', [f('levels', 'Niveaux', 2, 12, 6, 1), f('edges', 'Épaisseur contours', 0, 4, 1)],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); c.rgb=floor(c.rgb*p_levels+0.5)/p_levels; vec2 p=px()*(1.0+p_edges); float e=abs(luma(src(uv+vec2(p.x,0)).rgb)-luma(src(uv-vec2(p.x,0)).rgb))+abs(luma(src(uv+vec2(0,p.y)).rgb)-luma(src(uv-vec2(0,p.y)).rgb)); c.rgb*=1.0-smoothstep(0.08,0.2,e); return c; }`);
add(S, 'chromeFx', 'Chrome métallique', 'Chrome', [f('amount', 'Intensité', 0, 1, 0.8), f('frequency', 'Reflets', 1, 10, 3)],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); float l=luma(c.rgb); float m=0.5+0.5*sin(l*p_frequency*PI*2.0+uv.y*4.0); vec3 ch=mix(vec3(0.15,0.17,0.2),vec3(0.95,0.97,1.0),m); c.rgb=mix(c.rgb,ch,p_amount); return c; }`);
add(S, 'kaleidoGlow', 'Ombre longue', 'Long shadow', [f('length', 'Longueur (px)', 0, 400, 120), f('angle', 'Angle', 0, 360, 315, 1), c('color', 'Couleur', '#000000'), f('opacity', 'Opacité', 0, 1, 0.35)],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); vec2 d=vec2(cos(radians(p_angle)),sin(radians(p_angle)))/uRes*uScale; float sh=0.0; for(int i=1;i<=48;i++){ float fi=float(i)/48.0*p_length; sh=max(sh,src(uv-d*fi).a*(1.0-float(i)/60.0)); } float sa=sh*p_opacity; float na=c.a+sa*(1.0-c.a); return vec4((c.rgb*c.a+p_color*sa*(1.0-c.a))/max(na,0.001),na); }`);

// ======================= BRUIT & TEXTURE =======================
const T = 'texture';
add(T, 'filmGrain', 'Grain de film', 'Film grain', [f('amount', 'Quantité', 0, 1, 0.25), f('size', 'Taille', 0.5, 4, 1.2), b('animated', 'Animé', true), b('color', 'Grain coloré', false)],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); float t=p_animated>0.5?floor(uTime*24.0):0.0; vec2 g=floor(gl_FragCoord.xy/(p_size*max(uScale,0.5))); vec3 n= p_color>0.5 ? vec3(hash12(g+t),hash12(g+t+31.0),hash12(g+t+67.0)) : vec3(hash12(g+t)); float l=luma(c.rgb); c.rgb+= (n-0.5)*p_amount*(1.0-abs(l-0.5)); return c; }`);
add(T, 'digitalNoise', 'Bruit numérique', 'Digital noise', [f('amount', 'Quantité', 0, 1, 0.2), f('chroma', 'Chrominance', 0, 1, 0.6)],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); float t=floor(uTime*30.0); vec2 g=gl_FragCoord.xy; float y=hash12(g+t)-0.5; vec3 ch=vec3(hash12(g+t+11.0),hash12(g+t+23.0),hash12(g+t+37.0))-0.5; c.rgb+= (vec3(y)+ch*p_chroma)*p_amount*0.5; return c; }`);
add(T, 'animatedNoise', 'Bruit animé', 'Animated noise', [f('amount', 'Quantité', 0, 1, 0.3), f('scale', 'Échelle', 1, 100, 12), f('speed', 'Vitesse', 0, 5, 1), s('blend', 'Mode', ['Superposition', 'Ajout', 'Multiplier'])],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); float n=fbm(uv*p_scale+vec2(uTime*p_speed, uTime*p_speed*0.7)); int m=int(p_blend+0.5); vec3 nv=vec3(n); vec3 o= m==0 ? mix(2.0*c.rgb*nv,1.0-2.0*(1.0-c.rgb)*(1.0-nv),step(0.5,c.rgb)) : m==1 ? c.rgb+nv-0.5 : c.rgb*nv*2.0; c.rgb=mix(c.rgb,o,p_amount); return c; }`);
add(T, 'dustScratches', 'Poussière & rayures', 'Dust & scratches', [f('dust', 'Poussière', 0, 1, 0.5), f('scratches', 'Rayures', 0, 1, 0.5), f('jitter', 'Saut d\'image', 0, 1, 0.2)],
  `vec4 fx(vec2 uv){ float t=floor(uTime*18.0); vec2 q=uv+vec2(0.0,(hash12(vec2(t,5.0))-0.5)*0.01*p_jitter); vec4 c=src(q); float d=step(1.0-p_dust*0.004,hash12(floor(uv*uRes/3.0)+t*13.0)); c.rgb=mix(c.rgb,vec3(hash12(vec2(t,2.0))>0.5?0.0:1.0),d); float sx=hash12(vec2(t,1.0)); float s=step(0.5,hash12(vec2(t,9.0)))*(1.0-smoothstep(0.0,0.0015,abs(uv.x-sx)))*p_scratches; c.rgb=mix(c.rgb,vec3(0.9),s*0.7); c.rgb*=1.0-0.06*p_jitter*hash12(vec2(t,4.0)); return c; }`);
add(T, 'paper', 'Texture papier', 'Paper texture', [f('amount', 'Intensité', 0, 1, 0.4), f('scale', 'Grain', 1, 10, 3), c('tint', 'Teinte', '#f2ead8')],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); vec2 p=uv*uRes/(p_scale*20.0*max(uScale,0.5)); float n=fbm(p)*0.6+vnoise(p*8.0)*0.4; vec3 pap=p_tint*(0.85+n*0.25); c.rgb=mix(c.rgb,c.rgb*pap*1.15,p_amount); return c; }`);
add(T, 'canvasTexture', 'Texture de toile', 'Canvas texture', [f('amount', 'Intensité', 0, 1, 0.35), f('scale', 'Trame (px)', 2, 20, 5)],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); vec2 p=gl_FragCoord.xy/(p_scale*max(uScale,0.5)); float w=sin(p.x*PI)*sin(p.y*PI*0.5+step(0.5,fract(p.x*0.5))*PI); float n=vnoise(p*0.7); c.rgb*=1.0+(w*0.5+n-0.5)*p_amount*0.4; return c; }`);
add(T, 'overlayPattern', 'Motif en surimpression', 'Pattern overlay', [s('pattern', 'Motif', ['Rayures', 'Points', 'Grille', 'Diagonales']), f('scale', 'Taille (px)', 2, 80, 12), c('color', 'Couleur', '#ffffff'), f('opacity', 'Opacité', 0, 1, 0.15)],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); vec2 p=uv*uRes/(p_scale*uScale); int m=int(p_pattern+0.5); float v=0.0; if(m==0) v=step(0.5,fract(p.y)); else if(m==1) v=1.0-step(0.25,length(fract(p)-0.5)); else if(m==2) v=max(step(0.9,fract(p.x)),step(0.9,fract(p.y))); else v=step(0.5,fract(p.x+p.y)); c.rgb=mix(c.rgb,p_color,v*p_opacity); return c; }`);
add(T, 'noiseColor', 'Bruit coloré (fractal)', 'Fractal noise', [f('amount', 'Opacité', 0, 1, 0.5), f('scale', 'Échelle', 0.5, 30, 4), f('speed', 'Évolution', 0, 3, 0.3), c('c1', 'Couleur 1', '#24d26d'), c('c2', 'Couleur 2', '#050505')],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); float n=fbm(uv*p_scale+uTime*p_speed); c.rgb=mix(c.rgb,mix(p_c2,p_c1,n),p_amount); return c; }`);

// ======================= TEMPS =======================
const TM = 'temps';
const passthrough = `vec4 fx(vec2 uv){ return src(uv); }`;
add(TM, 'echo', 'Écho', 'Echo', [f('delay', 'Délai (s)', 0.01, 1, 0.08), f('count', 'Échos', 1, 8, 4, 1), f('decay', 'Atténuation', 0, 1, 0.6)], passthrough, { temporal: 'echo' });
add(TM, 'trails', 'Traînées (onion skin)', 'Trails', [f('frames', 'Images', 1, 12, 6, 1), f('spacing', 'Espacement (images)', 1, 10, 2, 1), f('decay', 'Atténuation', 0, 1, 0.7), c('tint', 'Teinte des fantômes', '#24d26d')], passthrough, { temporal: 'trails' });
add(TM, 'posterizeTime', 'Basse cadence (posterize time)', 'Posterize time', [f('fps', 'Images/s', 1, 30, 8, 1)], passthrough, { temporal: 'posterize' });
add(TM, 'frameBlend', 'Interpolation de frames', 'Frame blending', [f('sourceFps', 'Cadence source', 4, 60, 12, 1)], passthrough, { temporal: 'frameblend' });
add(TM, 'freezeFrame', 'Image figée', 'Freeze frame', [f('at', 'Instant figé (s, local)', 0, 60, 0.5)], passthrough, { temporal: 'freeze' });
add(TM, 'timeLoop', 'Boucle', 'Loop', [f('period', 'Période (s)', 0.1, 20, 1)], passthrough, { temporal: 'loop' });
add(TM, 'pingPong', 'Ping-pong', 'Ping-pong', [f('period', 'Période (s)', 0.1, 20, 1)], passthrough, { temporal: 'pingpong' });
add(TM, 'timeOffset', 'Décalage temporel', 'Time offset', [f('offset', 'Décalage (s)', -10, 10, 0.5)], passthrough, { temporal: 'offset' });
add(TM, 'timeReverse', 'Lecture inversée', 'Time reverse', [], passthrough, { temporal: 'reverse' });
add(TM, 'stutter', 'Bégaiement (stutter)', 'Stutter', [f('period', 'Période (s)', 0.05, 2, 0.4), f('hold', 'Maintien (s)', 0.02, 1, 0.15)], passthrough, { temporal: 'stutter' });

// ======================= MATTES & ALPHA =======================
const M = 'mattes';
add(M, 'choke', 'Rétrécir / étendre le cache', 'Matte choker', [f('amount', 'Quantité (px, − = étendre)', -20, 20, 2)],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); float m=c.a; float r=abs(p_amount)*uScale; for(int i=0;i<12;i++){ float a=float(i)/12.0*2.0*PI; float s=src(uv+vec2(cos(a),sin(a))*r/uRes).a; m= p_amount>0.0? min(m,s) : max(m,s);} if(p_amount<0.0 && c.a<0.01){ vec4 b2=blur(uv,r); c.rgb=b2.rgb; } c.a=m; return c; }`);
add(M, 'alphaThreshold', 'Seuil alpha', 'Alpha threshold', [f('threshold', 'Seuil', 0, 1, 0.5)], `vec4 fx(vec2 uv){ vec4 c=src(uv); c.a=step(p_threshold,c.a); return c; }`);
add(M, 'featherEdges', 'Contour progressif', 'Feather edges', [f('radius', 'Rayon (px)', 0, 60, 8)], `vec4 fx(vec2 uv){ vec4 c=src(uv); c.a=min(c.a,blur(uv,p_radius*uScale).a*1.2); return c; }`);
add(M, 'invertAlpha', 'Inverser l\'alpha', 'Invert alpha', [c('fill', 'Couleur de remplissage', '#000000')], `vec4 fx(vec2 uv){ vec4 c=src(uv); return vec4(c.a>0.5?c.rgb:p_fill,1.0-c.a); }`);
add(M, 'lumaToAlpha', 'Luminance → alpha', 'Luma to alpha', [b('invert', 'Inverser', false)], `vec4 fx(vec2 uv){ vec4 c=src(uv); float l=luma(c.rgb); c.a*= p_invert>0.5?1.0-l:l; return c; }`);
add(M, 'removeBackground', 'Suppression d\'arrière-plan simple', 'Simple background removal', [f('tolerance', 'Tolérance', 0, 1, 0.18), f('feather', 'Douceur', 0, 0.5, 0.08), s('sample', 'Échantillon de fond', ['Coins', 'Bord haut', 'Bord bas'])],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); int s=int(p_sample+0.5); vec3 bg= s==0 ? (src(vec2(0.02,0.02)).rgb+src(vec2(0.98,0.02)).rgb+src(vec2(0.02,0.98)).rgb+src(vec2(0.98,0.98)).rgb)*0.25 : s==1 ? (src(vec2(0.2,0.98)).rgb+src(vec2(0.5,0.98)).rgb+src(vec2(0.8,0.98)).rgb)/3.0 : (src(vec2(0.2,0.02)).rgb+src(vec2(0.5,0.02)).rgb+src(vec2(0.8,0.02)).rgb)/3.0; float d=distance(c.rgb,bg); c.a*=smoothstep(p_tolerance,p_tolerance+p_feather+0.0001,d); return c; }`);
add(M, 'gradientWipe', 'Masque en dégradé', 'Gradient mask', [f('angle', 'Angle', 0, 360, 90, 1), f('position', 'Position', 0, 1, 0.5), f('softness', 'Douceur', 0, 1, 0.3), b('invert', 'Inverser', false)],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); vec2 d=vec2(cos(radians(p_angle)),sin(radians(p_angle))); float t=dot(uv-0.5,d)+0.5; float m=smoothstep(p_position-p_softness*0.5,p_position+p_softness*0.5+0.0001,t); if(p_invert>0.5) m=1.0-m; c.a*=m; return c; }`);
add(M, 'shapeMask', 'Masque de forme (effet)', 'Shape mask', [s('shape', 'Forme', ['Cercle', 'Rectangle arrondi', 'Losange']), pt('center', 'Centre'), f('size', 'Taille', 0, 1.5, 0.4), f('feather', 'Contour', 0, 0.5, 0.02), b('invert', 'Inverser', false)],
  `vec4 fx(vec2 uv){ vec4 c=src(uv); vec2 d=(uv-p_center)*vec2(aspect(),1.0); int s=int(p_shape+0.5); float dist= s==0? length(d) : s==1? length(max(abs(d)-vec2(p_size*0.7,p_size*0.4),0.0))+p_size*0.0 : abs(d.x)+abs(d.y); float r= s==1? 0.05 : p_size; float m=1.0-smoothstep(r,r+p_feather+0.0001,dist); if(p_invert>0.5) m=1.0-m; c.a*=m; return c; }`);

// ======================= SHADER PERSONNALISÉ =======================
add('shader', 'customShader', 'Shader GLSL personnalisé', 'Custom GLSL shader', [{ name: 'code', label: 'Code GLSL (mainImage)', type: 'code', default: 'void mainImage(out vec4 fragColor, in vec2 fragCoord){\n  vec2 uv = fragCoord/iResolution.xy;\n  vec4 c = texture(iChannel0, uv);\n  c.rgb = mix(c.rgb, c.gbr, 0.5+0.5*sin(iTime));\n  fragColor = c;\n}' }],
  null, { custom: true });

export const EFFECTS = E;
export const EFFECT_MAP = Object.fromEntries(E.map((e) => [e.id, e]));
export const EFFECT_CATEGORIES = {
  couleur: 'Couleur', flou: 'Flou', nettete: 'Netteté / détails', distorsion: 'Distorsion', stylisation: 'Stylisation', texture: 'Bruit & texture', temps: 'Temps', mattes: 'Mattes & alpha', shader: 'Shader',
};

export function defaultEffectParams(type) {
  const def = EFFECT_MAP[type];
  if (!def) throw new Error(`Effet inconnu : ${type}`);
  const p = {};
  for (const prm of def.params) p[prm.name] = Array.isArray(prm.default) ? [...prm.default] : prm.default;
  return p;
}

export function describeEffect(e) {
  return {
    type: e.id, name: e.name, en: e.en, category: e.category, temporal: e.temporal || null,
    params: e.params.map((p) => ({ name: p.name, label: p.label, type: p.type, min: p.min, max: p.max, default: p.default, options: p.options })),
  };
}
