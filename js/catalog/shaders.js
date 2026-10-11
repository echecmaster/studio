// 30+ shaders prêts à l'emploi (style ShaderToy) pour les clips "shader" et l'effet "Shader GLSL personnalisé".
// Paramètres personnalisés : `uniform float nom; // @param min max défaut "Libellé"` → sliders automatiques.
// Couleurs : `uniform vec3 nom; // @color #rrggbb "Libellé"`.
export const SHADER_PRESETS = [];
const add = (id, name, code) => SHADER_PRESETS.push({ id, name, code: code.trim() });

add('tunnel', 'Tunnel néon', `
uniform float speed; // @param 0 4 1 "Vitesse"
uniform vec3 tint; // @color #24d26d "Teinte"
void mainImage(out vec4 fragColor, in vec2 fragCoord){
  vec2 p=(2.0*fragCoord-iResolution.xy)/iResolution.y;
  float a=atan(p.y,p.x), r=length(p);
  vec2 uv=vec2(0.3/r+iTime*speed, a/3.14159);
  float f=smoothstep(0.45,0.5,abs(fract(uv.x*2.0)-0.5))+smoothstep(0.45,0.5,abs(fract(uv.y*4.0)-0.5));
  fragColor=vec4(tint*f*r*1.5,1.0);
}`);
add('plasma', 'Plasma psychédélique', `
uniform float speed; // @param 0 4 1 "Vitesse"
void mainImage(out vec4 fragColor, in vec2 fragCoord){
  vec2 uv=fragCoord/iResolution.y; float t=iTime*speed;
  float v=sin(uv.x*10.0+t)+sin(uv.y*10.0+t)+sin((uv.x+uv.y)*10.0+t)+sin(length(uv-0.5)*12.0-t);
  fragColor=vec4(0.5+0.5*cos(v+vec3(0,2,4)),1.0);
}`);
add('sphere', 'Sphère raymarchée', `
uniform vec3 color; // @color #24d26d "Couleur"
float map(vec3 p){ return length(p)-1.0+0.1*sin(5.0*p.x+iTime)*sin(5.0*p.y)*sin(5.0*p.z); }
void mainImage(out vec4 fragColor, in vec2 fragCoord){
  vec2 uv=(2.0*fragCoord-iResolution.xy)/iResolution.y;
  vec3 ro=vec3(0,0,-3), rd=normalize(vec3(uv,1.5)); float t=0.0;
  for(int i=0;i<80;i++){ float d=map(ro+rd*t); if(d<0.001||t>10.0) break; t+=d*0.7; }
  vec3 col=vec3(0.02);
  if(t<10.0){ vec3 p=ro+rd*t; vec2 e=vec2(0.001,0); vec3 n=normalize(vec3(map(p+e.xyy)-map(p-e.xyy),map(p+e.yxy)-map(p-e.yxy),map(p+e.yyx)-map(p-e.yyx)));
    float dif=max(dot(n,normalize(vec3(1,1,-1))),0.0); float rim=pow(1.0-max(dot(n,-rd),0.0),3.0); col=color*dif+rim*vec3(1.0); }
  fragColor=vec4(col,1.0);
}`);
add('mandelbrot', 'Mandelbrot (zoom)', `
uniform float zoomSpeed; // @param 0 1 0.25 "Vitesse de zoom"
void mainImage(out vec4 fragColor, in vec2 fragCoord){
  vec2 uv=(2.0*fragCoord-iResolution.xy)/iResolution.y;
  float z=pow(1.5, -mod(iTime*zoomSpeed*4.0, 30.0));
  vec2 c=vec2(-0.743643887,0.131825904)+uv*z; vec2 w=vec2(0); float n=0.0;
  for(int i=0;i<256;i++){ w=vec2(w.x*w.x-w.y*w.y,2.0*w.x*w.y)+c; if(dot(w,w)>16.0) break; n+=1.0; }
  float s=n/256.0; fragColor=vec4(0.5+0.5*cos(3.0+s*20.0+vec3(0.0,0.6,1.0)),1.0)*step(s,0.999);
}`);
add('julia', 'Ensemble de Julia', `
void mainImage(out vec4 fragColor, in vec2 fragCoord){
  vec2 z=(2.0*fragCoord-iResolution.xy)/iResolution.y*1.3; vec2 c=0.7885*vec2(cos(iTime*0.3),sin(iTime*0.3)); float n=0.0;
  for(int i=0;i<128;i++){ z=vec2(z.x*z.x-z.y*z.y,2.0*z.x*z.y)+c; if(dot(z,z)>4.0) break; n+=1.0; }
  fragColor=vec4(vec3(0.14,0.82,0.43)*pow(n/128.0,0.5)*1.4,1.0);
}`);
add('warp', 'Domaine déformé (fbm)', `
float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
float fb(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<6;i++){ v+=a*n(p); p*=2.0; a*=0.5; } return v; }
void mainImage(out vec4 fragColor, in vec2 fragCoord){
  vec2 p=fragCoord/iResolution.y*3.0; vec2 q=vec2(fb(p+iTime*0.1),fb(p+5.2)); vec2 r=vec2(fb(p+4.0*q+1.7+iTime*0.15),fb(p+4.0*q+9.2)); float f=fb(p+4.0*r);
  vec3 col=mix(vec3(0.02,0.05,0.04),vec3(0.14,0.82,0.43),f*f*2.0); col=mix(col,vec3(0.9,0.95,1.0),dot(r,r)*0.3); fragColor=vec4(col,1.0);
}`);
add('hexgrid', 'Grille hexagonale', `
uniform vec3 color; // @color #24d26d "Couleur"
void mainImage(out vec4 fragColor, in vec2 fragCoord){
  vec2 u=fragCoord/iResolution.y*10.0; vec2 r=vec2(1.0,1.732), h=r*0.5; vec2 a=mod(u,r)-h, b=mod(u-h,r)-h; vec2 g=dot(a,a)<dot(b,b)?a:b; vec2 id=u-g;
  float d=max(abs(g.x)*0.866+abs(g.y)*0.5, abs(g.y)); float pulse=0.5+0.5*sin(iTime*2.0-length(id)*0.5);
  fragColor=vec4(color*smoothstep(0.45,0.5,d)*pulse+color*0.1,1.0);
}`);
add('rings', 'Anneaux néon', `
void mainImage(out vec4 fragColor, in vec2 fragCoord){
  vec2 p=(2.0*fragCoord-iResolution.xy)/iResolution.y; vec3 col=vec3(0);
  for(int i=0;i<6;i++){ float fi=float(i); float r=0.2+fi*0.13+0.03*sin(iTime*2.0+fi); col+=0.006/abs(length(p)-r)*(0.5+0.5*cos(fi+iTime+vec3(0,2,4))); }
  fragColor=vec4(col,1.0);
}`);
add('sinelines', 'Lignes sinusoïdales', `
void mainImage(out vec4 fragColor, in vec2 fragCoord){
  vec2 uv=fragCoord/iResolution.xy; vec3 col=vec3(0.0);
  for(int i=0;i<12;i++){ float fi=float(i); float y=0.5+0.25*sin(uv.x*6.0+iTime*(1.0+fi*0.1)+fi)*sin(iTime*0.3+fi); col+=vec3(0.14,0.82,0.43)*0.002/abs(uv.y-y)*(0.4+fi/12.0); }
  fragColor=vec4(col,1.0);
}`);
add('kaleido', 'Motif kaléidoscopique', `
void mainImage(out vec4 fragColor, in vec2 fragCoord){
  vec2 p=(2.0*fragCoord-iResolution.xy)/iResolution.y; float a=atan(p.y,p.x), r=length(p); float s=6.2831/8.0; a=abs(mod(a,s)-s*0.5); p=vec2(cos(a),sin(a))*r;
  vec3 col=0.5+0.5*cos(iTime+p.xyx*6.0+vec3(0,2,4)); col*=smoothstep(1.5,0.0,r); fragColor=vec4(col,1.0);
}`);
add('warpstars', 'Hyperespace', `
float hh(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
void mainImage(out vec4 fragColor, in vec2 fragCoord){
  vec2 p=(2.0*fragCoord-iResolution.xy)/iResolution.y; float a=atan(p.y,p.x); float r=length(p); float id=floor(a*60.0); float h=hh(vec2(id,1.0));
  float z=fract(h+iTime*(0.3+h)); float d=abs(r-z*1.5); float streak=smoothstep(0.15*z,0.0,d)*smoothstep(0.02,0.0,abs(fract(a*60.0)-0.5)*0.05);
  fragColor=vec4(vec3(0.8,0.9,1.0)*streak*z*3.0,1.0);
}`);
add('fire', 'Feu', `
float h2(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float n2(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h2(i),h2(i+vec2(1,0)),f.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x),f.y); }
void mainImage(out vec4 fragColor, in vec2 fragCoord){
  vec2 uv=fragCoord/iResolution.xy; vec2 q=uv*vec2(4.0,3.0); float n=0.0,a=0.5; vec2 p=q-vec2(0.0,iTime*1.5); for(int i=0;i<5;i++){ n+=a*n2(p); p*=2.0; a*=0.5; }
  float f=clamp(n*1.8-uv.y*1.6-abs(uv.x-0.5)*1.2+0.3,0.0,1.0); vec3 col=mix(vec3(0.0),vec3(1.0,0.3,0.0),f); col=mix(col,vec3(1.0,0.9,0.4),f*f); fragColor=vec4(col,1.0);
}`);
add('caustics', 'Caustiques', `
void mainImage(out vec4 fragColor, in vec2 fragCoord){
  vec2 p=mod(fragCoord/iResolution.y*6.2831*1.5,6.2831)-250.0; vec2 i=p; float c=1.0; float t=iTime*0.5;
  for(int n=0;n<5;n++){ float tt=t*(1.0-(3.5/float(n+1))); i=p+vec2(cos(tt-i.x)+sin(tt+i.y),sin(tt-i.y)+cos(tt+i.x)); c+=1.0/length(vec2(p.x/(sin(i.x+tt)/0.005),p.y/(cos(i.y+tt)/0.005))); }
  c/=5.0; c=1.17-pow(c,1.4); vec3 col=vec3(pow(abs(c),8.0)); fragColor=vec4(clamp(col+vec3(0.0,0.25,0.35),0.0,1.0),1.0);
}`);
add('clouds', 'Nuages', `
float h3(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float n3(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h3(i),h3(i+vec2(1,0)),f.x),mix(h3(i+vec2(0,1)),h3(i+vec2(1,1)),f.x),f.y); }
void mainImage(out vec4 fragColor, in vec2 fragCoord){
  vec2 uv=fragCoord/iResolution.y; float v=0.0,a=0.5; vec2 p=uv*3.0+vec2(iTime*0.05,0.0); for(int i=0;i<6;i++){ v+=a*n3(p); p*=2.1; a*=0.5; }
  vec3 sky=mix(vec3(0.3,0.55,0.9),vec3(0.75,0.85,1.0),fragCoord.y/iResolution.y*-1.0+1.0); fragColor=vec4(mix(sky,vec3(1.0),smoothstep(0.45,0.8,v)),1.0);
}`);
add('pulsering', 'Onde de choc', `
void mainImage(out vec4 fragColor, in vec2 fragCoord){
  vec2 p=(2.0*fragCoord-iResolution.xy)/iResolution.y; float r=length(p); float t=fract(iTime*0.5)*2.0; float w=exp(-pow((r-t)*12.0,2.0))*(1.0-t*0.5);
  fragColor=vec4(vec3(0.14,0.82,0.43)*w*2.0+vec3(0.02),1.0);
}`);
add('sunset', 'Coucher de soleil rétro', `
void mainImage(out vec4 fragColor, in vec2 fragCoord){
  vec2 uv=fragCoord/iResolution.xy; vec3 sky=mix(vec3(1.0,0.4,0.3),vec3(0.2,0.0,0.35),uv.y); vec2 p=(fragCoord-vec2(0.5*iResolution.x,0.45*iResolution.y))/iResolution.y;
  float sun=smoothstep(0.26,0.25,length(p)); float stripes=step(0.5,fract(p.y*20.0+iTime*0.5))+step(0.0,p.y); sun*=clamp(stripes,0.0,1.0);
  vec3 col=mix(sky,mix(vec3(1.0,0.9,0.2),vec3(1.0,0.2,0.5),0.5-p.y*2.0),sun); fragColor=vec4(col,1.0);
}`);
add('synthwave', 'Grille synthwave', `
void mainImage(out vec4 fragColor, in vec2 fragCoord){
  vec2 uv=fragCoord/iResolution.xy; vec3 col=mix(vec3(0.05,0.0,0.1),vec3(0.4,0.0,0.4),uv.y);
  if(uv.y<0.45){ float z=0.45/(0.45-uv.y+0.001); vec2 g=vec2((uv.x-0.5)*z,z*0.5+iTime); vec2 l=abs(fract(g*2.0)-0.5); float line=smoothstep(0.05*z*0.2+0.02,0.0,min(l.x,l.y)); col=mix(vec3(0.02,0.0,0.05),vec3(1.0,0.2,0.8),line*min(1.0,4.0/z)); }
  fragColor=vec4(col,1.0);
}`);
add('dotwave', 'Vague de points', `
void mainImage(out vec4 fragColor, in vec2 fragCoord){
  vec2 g=fragCoord/24.0; vec2 id=floor(g); vec2 f=fract(g)-0.5; float r=0.15+0.15*sin(iTime*2.0-length(id-iResolution.xy/48.0)*0.3);
  fragColor=vec4(vec3(0.14,0.82,0.43)*smoothstep(r,r-0.05,length(f)),1.0);
}`);
add('liquidmetal', 'Métal liquide', `
void mainImage(out vec4 fragColor, in vec2 fragCoord){
  vec2 p=(2.0*fragCoord-iResolution.xy)/iResolution.y; for(int i=1;i<8;i++){ float fi=float(i); p+=vec2(0.6/fi*sin(fi*p.y+iTime+0.3*fi)+1.0, 0.6/fi*sin(fi*p.x+iTime+0.3*fi)-1.0); }
  float v=0.5+0.5*sin(p.x+p.y); fragColor=vec4(vec3(v*0.9+0.1)*vec3(0.85,0.9,1.0),1.0);
}`);
add('voronoiglow', 'Voronoï lumineux', `
vec2 hh2(vec2 p){ return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453); }
void mainImage(out vec4 fragColor, in vec2 fragCoord){
  vec2 p=fragCoord/iResolution.y*6.0; vec2 i=floor(p); float md=8.0;
  for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ vec2 n=i+vec2(x,y); vec2 o=0.5+0.5*sin(iTime+6.2831*hh2(n)); md=min(md,length(n+o-p)); }
  fragColor=vec4(vec3(0.14,0.82,0.43)*(0.05/md)+vec3(0.0,0.05,0.02),1.0);
}`);
add('truchet', 'Tuiles de Truchet', `
float hh3(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
void mainImage(out vec4 fragColor, in vec2 fragCoord){
  vec2 u=fragCoord/iResolution.y*10.0+iTime*0.2; vec2 id=floor(u), f=fract(u); if(hh3(id)>0.5) f.x=1.0-f.x;
  float d=min(abs(length(f)-0.5),abs(length(f-1.0)-0.5)); fragColor=vec4(vec3(0.14,0.82,0.43)*smoothstep(0.08,0.04,d),1.0);
}`);
add('spiral', 'Spirale hypnotique', `
void mainImage(out vec4 fragColor, in vec2 fragCoord){
  vec2 p=(2.0*fragCoord-iResolution.xy)/iResolution.y; float a=atan(p.y,p.x), r=length(p); float v=sin(a*3.0+log(r)*8.0-iTime*4.0);
  fragColor=vec4(mix(vec3(0.02),vec3(0.14,0.82,0.43),smoothstep(-0.1,0.1,v)),1.0);
}`);
add('galaxy', 'Galaxie', `
float hh4(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
void mainImage(out vec4 fragColor, in vec2 fragCoord){
  vec2 p=(2.0*fragCoord-iResolution.xy)/iResolution.y; float r=length(p), a=atan(p.y,p.x); float arms=sin(a*2.0-log(r+0.01)*4.0+iTime*0.3);
  vec3 col=vec3(0.6,0.4,1.0)*pow(max(arms,0.0),3.0)*exp(-r*2.0)+vec3(1.0,0.9,0.7)*exp(-r*8.0); col+=vec3(step(0.996,hh4(floor(fragCoord/2.0))));
  fragColor=vec4(col,1.0);
}`);
add('lightning', 'Éclair', `
float hh5(float x){ return fract(sin(x*127.1)*43758.5453); }
void mainImage(out vec4 fragColor, in vec2 fragCoord){
  vec2 uv=fragCoord/iResolution.xy; float t=floor(iTime*8.0); float x=0.5; float y=1.0-uv.y;
  for(int i=0;i<6;i++){ float fi=float(i); x+=(hh5(t+fi+floor(y*pow(2.0,fi+1.0)))-0.5)*0.15/(fi+1.0); }
  float d=abs(uv.x-x); float flash=step(0.3,hh5(t*3.1)); vec3 col=vec3(0.7,0.8,1.0)*(0.002/d)*flash+vec3(0.05,0.05,0.1)*flash*0.5;
  fragColor=vec4(col,1.0);
}`);
add('raindrops', 'Gouttes de pluie', `
float hh6(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
void mainImage(out vec4 fragColor, in vec2 fragCoord){
  vec2 uv=fragCoord/iResolution.y*8.0; vec2 id=floor(uv); vec2 f=fract(uv)-0.5; float h=hh6(id); float t=fract(iTime*0.7+h);
  float ring=exp(-pow((length(f)-t*0.5)*25.0,2.0))*(1.0-t); fragColor=vec4(vec3(0.6,0.8,1.0)*ring+vec3(0.02,0.04,0.08),1.0);
}`);
add('ocean', 'Océan', `
void mainImage(out vec4 fragColor, in vec2 fragCoord){
  vec2 uv=fragCoord/iResolution.xy; float h=0.0; for(int i=1;i<6;i++){ float fi=float(i); h+=sin(uv.x*fi*7.0+iTime*fi*0.7+fi)*0.02/fi; }
  vec3 sky=mix(vec3(0.9,0.6,0.4),vec3(0.3,0.5,0.8),uv.y); vec3 sea=mix(vec3(0.0,0.15,0.3),vec3(0.1,0.5,0.6),uv.y*2.0);
  float line=0.45+h; vec3 col=uv.y>line?sky:sea+vec3(1.0,0.8,0.5)*pow(max(0.0,1.0-abs(uv.x-0.5)*3.0),4.0)*(0.5+0.5*sin(uv.y*200.0+iTime*3.0))*0.3; fragColor=vec4(col,1.0);
}`);
add('terrain', 'Relief en fil de fer', `
float hh7(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float nn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hh7(i),hh7(i+vec2(1,0)),f.x),mix(hh7(i+vec2(0,1)),hh7(i+vec2(1,1)),f.x),f.y); }
void mainImage(out vec4 fragColor, in vec2 fragCoord){
  vec2 uv=fragCoord/iResolution.xy; vec3 col=vec3(0.0);
  for(int i=0;i<30;i++){ float fi=float(i); float z=fi/30.0; float y=0.15+z*0.6+nn(vec2(uv.x*6.0,fi*0.5+iTime*0.5))*0.15*(1.0-z); col+=vec3(0.14,0.82,0.43)*smoothstep(0.004,0.0,abs(uv.y-y))*(1.0-z); }
  fragColor=vec4(col,1.0);
}`);
add('squares', 'Carrés rotatifs', `
void mainImage(out vec4 fragColor, in vec2 fragCoord){
  vec2 p=(2.0*fragCoord-iResolution.xy)/iResolution.y; vec3 col=vec3(0.0);
  for(int i=0;i<10;i++){ float fi=float(i); float a=iTime*0.5+fi*0.2; mat2 m=mat2(cos(a),-sin(a),sin(a),cos(a)); vec2 q=abs(m*p); float d=abs(max(q.x,q.y)-fi*0.1-0.05); col+=0.003/d*(0.5+0.5*cos(fi*0.6+vec3(0,2,4))); }
  fragColor=vec4(col,1.0);
}`);
add('testcard', 'Mire de test (barres)', `
void mainImage(out vec4 fragColor, in vec2 fragCoord){
  vec2 uv=fragCoord/iResolution.xy; int i=min(int(uv.x*7.0),6); vec3 c[7]=vec3[7](vec3(0.75),vec3(0.75,0.75,0),vec3(0,0.75,0.75),vec3(0,0.75,0),vec3(0.75,0,0.75),vec3(0.75,0,0),vec3(0,0,0.75));
  vec3 col=c[i]; if(uv.y<0.25) col=vec3(uv.x); fragColor=vec4(col,1.0);
}`);
add('chroma', 'Cercles chromatiques', `
void mainImage(out vec4 fragColor, in vec2 fragCoord){
  vec2 p=(2.0*fragCoord-iResolution.xy)/iResolution.y; vec3 col=vec3(0.0);
  for(int i=0;i<3;i++){ float fi=float(i); vec2 o=0.3*vec2(cos(iTime+fi*2.094),sin(iTime*1.3+fi*2.094)); vec3 c=vec3(0.0); c[i]=1.0; col+=c*smoothstep(0.42,0.4,length(p-o)); }
  fragColor=vec4(col,1.0);
}`);
add('glitchbars', 'Barres glitch', `
float hh8(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
void mainImage(out vec4 fragColor, in vec2 fragCoord){
  vec2 uv=fragCoord/iResolution.xy; float t=floor(iTime*12.0); float row=floor(uv.y*30.0); float h=hh8(vec2(row,t));
  vec3 col=step(0.7,h)*0.5+0.5*cos(6.2831*(h+vec3(0.0,0.33,0.67))); col*=step(0.3,hh8(vec2(floor(uv.x*20.0+h*10.0),t))); fragColor=vec4(col*0.8,1.0);
}`);
add('noisegrad', 'Dégradé granuleux', `
uniform vec3 c1; // @color #24d26d "Couleur 1"
uniform vec3 c2; // @color #0b3dff "Couleur 2"
float hh9(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
void mainImage(out vec4 fragColor, in vec2 fragCoord){
  vec2 uv=fragCoord/iResolution.xy; float t=0.5+0.5*sin(uv.x*3.0+uv.y*2.0+iTime*0.5); vec3 col=mix(c1,c2,t)+(hh9(fragCoord+fract(iTime))-0.5)*0.08; fragColor=vec4(col,1.0);
}`);
add('channel', 'Effet sur iChannel0 (ondulation)', `
uniform float amount; // @param 0 0.1 0.02 "Amplitude"
void mainImage(out vec4 fragColor, in vec2 fragCoord){
  vec2 uv=fragCoord/iResolution.xy; uv.x+=sin(uv.y*30.0+iTime*4.0)*amount; fragColor=texture(iChannel0,uv);
}`);

export const SHADER_MAP = Object.fromEntries(SHADER_PRESETS.map((s) => [s.id, s]));

// Analyse les annotations @param / @color d'un code de shader
export function parseShaderParams(code) {
  const params = [];
  const re = /uniform\s+(float|vec3)\s+(\w+)\s*;\s*\/\/\s*@(param|color)\s+([^\n]*)/g;
  let m;
  while ((m = re.exec(code))) {
    const [, type, name, kind, rest] = m;
    const label = (rest.match(/"([^"]*)"/) || [])[1] || name;
    if (kind === 'param' && type === 'float') {
      const nums = rest.replace(/"[^"]*"/, '').trim().split(/\s+/).map(Number);
      params.push({ name, label, type: 'float', min: nums[0] ?? 0, max: nums[1] ?? 1, default: nums[2] ?? nums[0] ?? 0, step: ((nums[1] ?? 1) - (nums[0] ?? 0)) / 200 });
    } else if (kind === 'color' && type === 'vec3') {
      const col = (rest.match(/#[0-9a-fA-F]{6}/) || ['#ffffff'])[0];
      params.push({ name, label, type: 'color', default: col });
    }
  }
  return params;
}
