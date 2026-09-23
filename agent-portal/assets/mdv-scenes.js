/* Realistic animated backdrops for the Galaxy, Christmas, Earth and Waterfall color waves.
   GPU shaders only (no image assets). Renders behind the portal, only while one of those four themes is active. */
(function(){'use strict';
if(window.__MDV_SCENES__)return;window.__MDV_SCENES__=true;
var KEYS={galaxy:1,christmas:1,earth:1,waterfall:1};

var COMMON=[
'#ifdef GL_FRAGMENT_PRECISION_HIGH','precision highp float;','#else','precision mediump float;','#endif',
'uniform vec2 uRes;uniform float uTime;',
'float hash11(float p){p=fract(p*.1031);p*=p+33.33;p*=p+p;return fract(p);}',
'float hash21(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}',
'float hash31(vec3 p){p=fract(p*.1031);p+=dot(p,p.zyx+31.32);return fract((p.x+p.y)*p.z);}',
'float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash21(i),hash21(i+vec2(1.,0.)),f.x),mix(hash21(i+vec2(0.,1.)),hash21(i+vec2(1.,1.)),f.x),f.y);}',
'float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash31(i),hash31(i+vec3(1.,0.,0.)),f.x),mix(hash31(i+vec3(0.,1.,0.)),hash31(i+vec3(1.,1.,0.)),f.x),f.y),mix(mix(hash31(i+vec3(0.,0.,1.)),hash31(i+vec3(1.,0.,1.)),f.x),mix(hash31(i+vec3(0.,1.,1.)),hash31(i+vec3(1.,1.,1.)),f.x),f.y),f.z);}',
'float fbm(vec2 p){float v=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<5;i++){v+=a*noise(p);p=m*p;a*=.5;}return v;}',
'float fbm3(vec3 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise3(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=.5;}return v;}',
'vec3 starLayer(vec2 uv,float scale,float dens,float t,float seed){vec2 g=uv*scale;vec2 id=floor(g);vec2 f=fract(g)-.5;float h=hash21(id+seed);vec3 c=vec3(0.);if(h<dens){vec2 o=(vec2(hash21(id+seed+1.7),hash21(id+seed+9.2))-.5)*.7;float d=length(f-o);float tw=.65+.35*sin(t*(1.+hash21(id)*3.)+h*40.);float s=smoothstep(.09,.0,d)*tw;float glow=exp(-d*26.)*.35*tw;float k=hash21(id+3.3);vec3 tint=mix(vec3(.75,.85,1.),vec3(1.,.86,.7),k);c=tint*(s+glow)*(.5+hash21(id+5.5));}return c;}',
'vec3 tonemap(vec3 c){c=c/(1.+c*.25);return pow(c,vec3(.94));}'
].join('\n');

var GALAXY=COMMON+'\n'+[
'void main(){',
' vec2 uv=(gl_FragCoord.xy-.5*uRes)/uRes.y;float t=uTime;',
' vec3 col=mix(vec3(.004,.006,.018),vec3(.012,.008,.03),uv.y+.5);',
' float n1=fbm(uv*1.3+vec2(t*.006,0.)+3.);float n2=fbm(uv*2.4-vec2(0.,t*.005)+11.);float n3=fbm(uv*.8+vec2(-t*.004,t*.003)+21.);',
' col+=vec3(.22,.05,.34)*pow(n1,2.8)*1.1+vec3(.02,.10,.30)*pow(n2,2.3)*1.0+vec3(.30,.06,.16)*pow(n3,3.2)*.7;',
' col+=starLayer(uv,38.,.10,t,0.)*.8+starLayer(uv,70.,.16,t,7.)*.7+starLayer(uv,130.,.24,t,13.)*.55;',
' vec2 g=uv-vec2(.22,.06);float ca=cos(-.62),sa=sin(-.62);g=mat2(ca,-sa,sa,ca)*g;g.y*=2.7;',
' float r=length(g);float th=atan(g.y,g.x);',
' float arm=.5+.5*cos(2.*(th-3.6*log(r+.03)+t*.04));',
' float arms=pow(arm,2.4)*exp(-r*2.6);',
' vec2 cu=vec2(cos(th),sin(th));float clump=fbm(cu*3.+vec2(r*9.,r*7.)+t*.02);',
' float th2=th-3.6*log(r+.03)*.55;float dust=smoothstep(.42,.72,fbm(vec2(cos(th2),sin(th2))*3.2+vec2(r*20.,r*9.)+8.));',
' vec3 armCol=mix(vec3(.42,.52,1.),vec3(1.,.45,.78),smoothstep(.35,.75,clump));',
' float body=arms*(.35+1.3*clump);',
' col+=armCol*body*1.25*(1.-dust*.65*smoothstep(.02,.5,r));',
' col+=vec3(1.,.8,.55)*exp(-r*r*70.)*1.9+vec3(1.,.72,.45)*exp(-r*7.)*.34;',
' col+=starLayer(g*1.7,90.,.5,t,31.)*exp(-r*2.5)*1.4;',
' float st=floor(t/8.);float k=fract(t/8.)/.16;',
' if(k<1.){vec2 p0=vec2(hash11(st)*1.5-.75,.42);vec2 dir=normalize(vec2(-1.,-.5));vec2 head=p0+dir*k*.8;vec2 pa=uv-head;float along=dot(pa,-dir);float perp=length(pa+dir*along);float tr=smoothstep(.005,.0,perp)*step(0.,along)*smoothstep(.28,0.,along)*(1.-k);col+=vec3(.85,.92,1.)*tr*1.6;}',
' float vig=smoothstep(1.35,.25,length(uv*vec2(.8,1.)));col*=.55+.6*vig;',
' gl_FragColor=vec4(tonemap(col),1.);}'
].join('\n');

var EARTH=COMMON+'\n'+[
'mat3 rotY(float a){float c=cos(a),s=sin(a);return mat3(c,0.,-s,0.,1.,0.,s,0.,c);}',
'mat3 rotX(float a){float c=cos(a),s=sin(a);return mat3(1.,0.,0.,0.,c,s,0.,-s,c);}',
'void main(){',
' vec2 uv=(gl_FragCoord.xy-.5*uRes)/uRes.y;float t=uTime;',
' vec3 sun=normalize(vec3(-.72,.38,.58));',
' vec3 col=vec3(.003,.005,.014);',
' float neb=fbm(uv*1.6+4.)*fbm(uv*.9-2.);col+=vec3(.05,.07,.16)*pow(neb,2.2)*1.4;',
' col+=starLayer(uv,42.,.11,t,2.)*.9+starLayer(uv,85.,.18,t,5.)*.75+starLayer(uv,150.,.26,t,9.)*.55;',
' vec2 c=vec2(.30,-.30);float R=.78;vec2 p=(uv-c)/R;float d=dot(p,p);',
' if(d<1.){',
'  vec3 n=vec3(p,sqrt(1.-d));',
'  mat3 spin=rotX(.42)*rotY(t*.035);vec3 q=spin*n;',
'  float h=fbm3(q*2.1+vec3(3.,1.,7.));float h2=fbm3(q*6.+vec3(1.,5.,2.));float hh=h*.85+h2*.15;',
'  float land=smoothstep(.505,.53,hh);',
'  float lat=abs(q.y);',
'  vec3 ocean=mix(vec3(.004,.03,.11),vec3(.02,.20,.38),smoothstep(.28,.5,hh));',
'  vec3 grass=mix(vec3(.06,.20,.06),vec3(.30,.36,.14),smoothstep(.5,.66,fbm3(q*4.+2.)));',
'  vec3 desert=vec3(.55,.42,.24);float dry=smoothstep(.35,.75,fbm3(q*3.2+9.))*smoothstep(.55,.15,lat);',
'  vec3 lc=mix(grass,desert,dry);lc=mix(lc,vec3(.36,.30,.24),smoothstep(.66,.8,hh));',
'  float ice=smoothstep(.80,.9,lat+fbm3(q*5.)*.12);',
'  vec3 surf=mix(ocean,lc,land);surf=mix(surf,vec3(.9,.94,1.),ice);',
'  float diff=dot(n,sun);float lit=smoothstep(-.06,.32,diff);',
'  float cl=fbm3(rotY(t*.012)*q*3.1+vec3(0.,t*.006,4.));float cov=smoothstep(.50,.72,cl);',
'  float shade=max(diff,0.);',
'  vec3 day=surf*(shade*1.15+.02);',
'  vec3 rv=reflect(-sun,n);float spec=pow(max(dot(rv,vec3(0.,0.,1.)),0.),46.)*(1.-land)*(1.-ice);day+=vec3(.9,.95,1.)*spec*.42;',
'  day=mix(day,vec3(1.)*(shade*1.05+.04),cov*.86);',
'  float night=1.-smoothstep(-.12,.14,diff);',
'  float city=pow(fbm3(q*17.+5.),4.2)*land*(1.-cov*.85)*night*(1.-ice);',
'  vec3 nightCol=surf*.012+vec3(1.,.72,.36)*city*3.2;',
'  vec3 planet=mix(nightCol,day,lit);',
'  float term=exp(-pow(diff*5.,2.))*.12;planet+=vec3(1.,.5,.25)*term*(.4+cov);',
'  float rim=pow(1.-n.z,3.2)*(.28+.9*clamp(diff+.35,0.,1.));planet+=vec3(.25,.55,1.)*rim*1.05;',
'  col=planet;',
'}else{',
' float e=sqrt(d)-1.;float sf=clamp(dot(normalize(p),sun.xy)*.5+.62,0.,1.);',
' col+=vec3(.20,.48,1.)*exp(-e*13.)*(.16+.9*sf)+vec3(.35,.7,1.)*exp(-e*42.)*.6*sf;',
'}',
' float vig=smoothstep(1.5,.3,length(uv));col*=.6+.5*vig;',
' gl_FragColor=vec4(tonemap(col),1.);}'
].join('\n');

var WATERFALL=COMMON+'\n'+[
'float ridge(float x,float s,float a){return a*fbm(vec2(x*s,3.))+a*.35*noise(vec2(x*s*3.7,9.));}',
'void main(){',
' vec2 uv=gl_FragCoord.xy/uRes;float asp=uRes.x/uRes.y;vec2 p=vec2((uv.x-.5)*asp,uv.y);float t=uTime;',
' vec3 col=mix(vec3(.02,.12,.14),vec3(.05,.22,.25),smoothstep(.0,1.,uv.y));',
' col+=vec3(.45,.75,.8)*exp(-length(p-vec2(-.18*asp,.95))*2.2)*.24;',
' float back=.42+.10*fbm(vec2(p.x*2.6,2.))+.05*sin(p.x*4.);col=mix(col,vec3(.02,.09,.10),smoothstep(back+.01,back-.02,uv.y)*.75);',
' float w=.10+.022*(1.-uv.y)+.012*sin(uv.y*7.+t*.3);',
' float lw=.30+.07*fbm(vec2(uv.y*3.2,1.))+.09*(1.-uv.y)*.8;',
' float rw=.30+.07*fbm(vec2(uv.y*3.2+7.,4.))+.09*(1.-uv.y)*.8;',
' float lx=-lw*asp*.62-.02,rx=rw*asp*.62+.02;',
' float rockL=smoothstep(lx+.03,lx-.03,p.x);float rockR=smoothstep(rx-.03,rx+.03,p.x);float rock=max(rockL,rockR);',
' float tex=fbm(vec2(p.x*9.,uv.y*7.));float tex2=fbm(vec2(p.x*24.+3.,uv.y*20.));',
' vec3 rockCol=mix(vec3(.02,.05,.06),vec3(.10,.15,.16),tex)*(.6+.8*tex2);',
' float moss=smoothstep(.55,.75,fbm(vec2(p.x*14.,uv.y*11.)+4.));rockCol=mix(rockCol,vec3(.05,.20,.08)*(.5+tex2),moss*.7);',
' float edgeLit=smoothstep(.06,.0,abs(p.x-mix(lx,rx,step(0.,p.x))))*.5;rockCol+=vec3(.25,.5,.5)*edgeLit*.2;',
' col=mix(col,rockCol,rock);',
' float lipY=.9;float inWater=smoothstep(w,w-.03,abs(p.x-.0))*smoothstep(.15,.24,uv.y);',
' float sx=p.x*52.;',
' float s1=fbm(vec2(sx,uv.y*2.4+t*1.9));float s2=fbm(vec2(sx*.55+7.,uv.y*5.+t*2.7));float s3=noise(vec2(sx*2.3,uv.y*14.+t*5.));',
' float streak=smoothstep(.22,.72,s1*.75+s2*.5+s3*.25);',
' vec3 wcol=mix(vec3(.10,.30,.36),vec3(.74,.93,.97),streak);wcol+=vec3(.6,.9,1.)*pow(streak,3.)*.18;',
' float fade=smoothstep(1.02,.86,uv.y);',
' col=mix(col,wcol,inWater*(.62+.3*streak)*max(fade,.25));',
' float pool=smoothstep(.215,.165,uv.y);',
' float rip=sin((p.x*38.)+t*1.4+fbm(vec2(p.x*7.,uv.y*20.-t*.3))*8.)*.5+.5;',
' vec3 poolCol=mix(vec3(.02,.13,.16),vec3(.10,.42,.48),rip*.4+.18);poolCol+=vec3(.75,.95,1.)*exp(-abs(p.x)*5.)*(.35+.4*rip)*smoothstep(.02,.18,uv.y)*.55;',
' col=mix(col,poolCol,pool*(1.-rock*.85));',
' float impact=exp(-abs(p.x)*3.4)*smoothstep(.46,.12,uv.y);float foam=smoothstep(.30,.17,uv.y)*smoothstep(.13,.20,uv.y)*exp(-abs(p.x)*6.5)*fbm(vec2(p.x*14.,uv.y*30.-t*.8));col=mix(col,vec3(.9,.98,1.),clamp(foam*1.6,0.,.85));',
' float m1=fbm(vec2(p.x*3.2,uv.y*2.2-t*.14));float m2=fbm(vec2(p.x*6.5+3.,uv.y*3.6-t*.2));',
' float mist=impact*(m1*.8+m2*.5);',
' col+=vec3(.75,.95,1.)*mist*1.25;',
' float mistWide=smoothstep(.55,.0,uv.y)*fbm(vec2(p.x*1.8+t*.03,uv.y*2.5-t*.05))*.28;col+=vec3(.55,.85,.9)*mistWide;',
' vec2 g=vec2(p.x*36.,uv.y*22.-t*.9);vec2 id=floor(g);vec2 f=fract(g)-.5;float dh=hash21(id);if(dh<.16){vec2 o=(vec2(hash21(id+1.3),hash21(id+8.1))-.5)*.6;float dd=length(f-o);col+=vec3(.9,1.,1.)*smoothstep(.14,.0,dd)*impact*1.3;}',
' float beam=pow(max(0.,sin((p.x*asp*.0+p.x*10.+uv.y*5.-.2))),8.)*smoothstep(1.,.35,uv.y)*.16*(1.-rock*.9);col+=vec3(.6,.95,1.)*beam;',
' float leaf=smoothstep(.55,.7,fbm(vec2(p.x*5.,uv.y*5.-1.)+2.))*smoothstep(.55,1.,uv.y+abs(p.x)*.55)*max(rockL,rockR);col=mix(col,vec3(.01,.07,.04),leaf*.85);',
' float vig=smoothstep(1.4,.2,length((uv-.5)*vec2(1.1,1.)));col*=.55+.6*vig;',
' gl_FragColor=vec4(tonemap(col),1.);}'
].join('\n');

var CHRISTMAS=COMMON+'\n'+[
'float treeShape(vec2 q){float y=q.y;if(y<0.||y>1.)return 0.;float tier=fract(y*4.6);float wd=(1.-y)*.5*(.62+.38*(1.-tier));return smoothstep(wd,wd-.03,abs(q.x));}',
'vec3 bulb(vec2 p,vec2 c,vec3 col,float ph){float d=length(p-c);float tw=.6+.4*sin(uTime*2.+ph*6.);return col*(exp(-d*d*8000.)*1.6+exp(-d*60.)*.22)*tw;}',
'float flake(vec2 uv,float scale,float speed,float size,float seed){uv.y+=uTime*speed;uv.x+=sin(uv.y*3.+seed)*.05;vec2 g=uv*scale;vec2 id=floor(g);vec2 f=fract(g)-.5;float h=hash21(id+seed);vec2 o=(vec2(hash21(id+seed+2.1),hash21(id+seed+7.7))-.5)*.6;float d=length(f-o);return smoothstep(size,size*.2,d)*step(.35,h);}',
'void main(){',
' vec2 uv=gl_FragCoord.xy/uRes;float asp=uRes.x/uRes.y;vec2 p=vec2(uv.x*asp,uv.y);float t=uTime;',
' vec3 col=mix(vec3(.04,.11,.09),vec3(.005,.014,.05),smoothstep(.15,.95,uv.y));',
' col+=vec3(.02,.08,.03)*smoothstep(.5,.15,uv.y);',
' col+=starLayer(vec2(uv.x*asp,uv.y),60.,.12,t,1.)*smoothstep(.4,.9,uv.y)*.9;',
' float au=fbm(vec2(p.x*1.6+t*.02,uv.y*3.))*smoothstep(.45,.75,uv.y)*smoothstep(1.02,.7,uv.y);',
' col+=mix(vec3(.05,.55,.30),vec3(.35,.20,.60),uv.y)*pow(au,2.)*.55;',
' vec2 mp=vec2(.16*asp,.84);float md=length(p-mp);col+=vec3(.75,.85,1.)*(smoothstep(.034,.030,md)*1.2+exp(-md*9.)*.34);',
' float h1=.34+.05*fbm(vec2(p.x*2.2,1.))+.02*sin(p.x*3.);float h2=.25+.05*fbm(vec2(p.x*3.4,5.));float h3=.15+.035*fbm(vec2(p.x*4.5,9.));',
' col=mix(col,vec3(.06,.13,.17),smoothstep(h1+.004,h1-.004,uv.y));',
' float tf=step(h1-.2,uv.y)*step(uv.y,h1+.06);',
' for(int i=0;i<3;i++){float fi=float(i);float sc=13.+fi*6.;vec2 g=vec2(p.x*sc+fi*3.7,(uv.y-(h2-.03+.02*fi))*sc*.85);float id=floor(g.x);float jit=hash21(vec2(id,fi))*.5;vec2 q=vec2(fract(g.x)-.5+(jit-.25)*.3,g.y/(1.4+hash21(vec2(id,fi+4.))*1.2));float tr=treeShape(q)*step(-.02,uv.y-h2+.02*(3.-fi))*(1.-step(h1+.05,uv.y));col=mix(col,vec3(.008,.03,.03)*(1.-fi*.12),tr*.9);float top=treeShape(q+vec2(0.,-.03))*(1.-treeShape(q));col+=vec3(.5,.6,.7)*top*tr*.03;}',
' col=mix(col,vec3(.17,.27,.33),smoothstep(h2+.004,h2-.004,uv.y));',
' float ridgeSnow=smoothstep(.006,.0,abs(uv.y-h2))*.5;col+=vec3(.55,.7,.8)*ridgeSnow*.4;',
' vec3 gcol=mix(vec3(.40,.50,.58),vec3(.22,.30,.38),smoothstep(0.,h3,uv.y));gcol+=vec3(.5,.35,.25)*exp(-abs(uv.y-.10)*9.)*.06;col=mix(col,gcol,smoothstep(h3+.004,h3-.004,uv.y));',
' float glint=pow(hash21(floor(vec2(p.x*220.,uv.y*140.))),34.)*smoothstep(h3,0.,uv.y)*(.5+.5*sin(t*3.+p.x*50.));col+=vec3(.9,.95,1.)*glint*1.6;',
' for(int s=0;s<2;s++){float fs=float(s);float y0=.87-fs*.16;float sag=.05+fs*.02;float seg=asp*.5*(1.+fs*.35);float x=mod(p.x+fs*.31,seg);float u=x/seg;float yy=y0-sag*(1.-pow(2.*u-1.,2.));float wire=smoothstep(.0018,.0,abs(uv.y-yy));col=mix(col,vec3(.01,.02,.02),wire*.8);',
'  for(int k=0;k<9;k++){float fk=float(k);float bu=(fk+.5)/9.;float bx=bu*seg;float by=y0-sag*(1.-pow(2.*bu-1.,2.))-.008;vec2 bp=vec2(bx-x+p.x,by);vec3 bc=k-4*(k/4)==0?vec3(1.,.15,.12):(k-4*(k/4)==1?vec3(1.,.75,.28):(k-4*(k/4)==2?vec3(.2,.9,.4):vec3(1.,.95,.85)));col+=bulb(p,bp,bc,fk+fs*3.);}}',
' float trL=treeShape(vec2((p.x-.05)/.42,(uv.y-.02)/1.05));float trR=treeShape(vec2((p.x-(asp-.05))/.42,(uv.y-.02)/1.05));float tr2=max(trL,trR);col=mix(col,vec3(.004,.02,.016),tr2*.96);col+=vec3(.55,.65,.75)*pow(fract((uv.y-.02)*4.8),6.)*tr2*.05;',
' float f1=flake(uv*vec2(asp,1.),7.,.05,.22,1.);float f2=flake(uv*vec2(asp,1.)+vec2(.3,0.),14.,.11,.20,4.);float f3=flake(uv*vec2(asp,1.)+vec2(.7,0.),28.,.19,.17,9.);float f4=flake(uv*vec2(asp,1.)+vec2(.1,.4),4.,.03,.33,13.);',
' col+=vec3(.9,.95,1.)*(f1*.30+f2*.50+f3*.65+f4*.10);',
' float vig=smoothstep(1.4,.25,length((uv-.5)*vec2(1.1,1.)));col*=.6+.5*vig;',
' gl_FragColor=vec4(tonemap(col),1.);}'
].join('\n');


var SNOW=COMMON+'\n'+[
'float flake(vec2 uv,float scale,float speed,float size,float seed){uv.y+=uTime*speed;uv.x+=sin(uv.y*3.+seed)*.05;vec2 g=uv*scale;vec2 id=floor(g);vec2 f=fract(g)-.5;float h=hash21(id+seed);vec2 o=(vec2(hash21(id+seed+2.1),hash21(id+seed+7.7))-.5)*.6;float d=length(f-o);return smoothstep(size,size*.15,d)*step(.30,h);}',
'void main(){',
' vec2 uv=gl_FragCoord.xy/uRes;float asp=uRes.x/uRes.y;vec2 q=uv*vec2(asp,1.);',
' float a=flake(q,9.,.06,.20,1.)*.55+flake(q+vec2(.3,0.),17.,.12,.19,4.)*.7+flake(q+vec2(.7,0.),34.,.21,.16,9.)*.85+flake(q+vec2(.1,.4),5.,.035,.30,13.)*.28;',
' a=clamp(a,0.,1.);gl_FragColor=vec4(vec3(.93,.97,1.)*a,a);}'
].join('\n');

var FRAG={galaxy:GALAXY,earth:EARTH,waterfall:WATERFALL,christmas:CHRISTMAS,snow:SNOW};
var VERT='attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
var BASE=(window.__VEUX_AGENT_MOUNT__||'')+'/assets/backdrops/';
var CACHE_V='3';function assetURL(name){return BASE+name+'?v='+CACHE_V;}
/* Real footage (public domain / CC0) for Earth, Waterfall and Christmas; procedural GPU render for Galaxy. */
var CFG={
 galaxy:{gl:'galaxy'},
 earth:{video:['earth-1.mp4','earth-2.mp4'],poster:'earth.jpg',fallback:'earth'},
 waterfall:{video:['waterfall.mp4'],poster:'waterfall.jpg',fallback:'waterfall'},
 christmas:{video:['christmas.mp4'],poster:'christmas.jpg',fallback:'christmas',snow:true,filter:'brightness(.58) saturate(.92) contrast(1.05)'}
};
function reduced(){try{return window.matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(e){return false;}}
function saveData(){try{return !!(navigator.connection&&navigator.connection.saveData);}catch(e){return false;}}
function stage(){return document.getElementById('cavyre-environment-stage');}
var t0=performance.now();

function GLView(id,alpha,scale){this.id=id;this.alpha=alpha;this.scale=scale;this.gl=null;this.canvas=null;this.progs={};this.key='';this.failed={};this.buf=null;}
GLView.prototype.mount=function(){var st=stage();if(!st)return false;var c=this.canvas;if(c&&c.isConnected&&c.parentNode===st)return true;c=document.getElementById(this.id);if(!c){c=document.createElement('canvas');c.id=this.id;c.setAttribute('aria-hidden','true');}st.appendChild(c);this.canvas=c;this.gl=null;this.progs={};return true;};
GLView.prototype.ensure=function(){if(this.gl&&!this.gl.isContextLost())return true;var g=null;try{var o={alpha:this.alpha,antialias:false,depth:false,stencil:false,powerPreference:'low-power',premultipliedAlpha:true,preserveDrawingBuffer:false};g=this.canvas.getContext('webgl',o)||this.canvas.getContext('experimental-webgl',o);}catch(e){g=null;}if(!g)return false;this.gl=g;this.buf=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,this.buf);g.bufferData(g.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),g.STATIC_DRAW);this.progs={};return true;};
GLView.prototype.prog=function(key){if(this.progs[key])return this.progs[key];var g=this.gl;function mk(t,src){var sh=g.createShader(t);g.shaderSource(sh,src);g.compileShader(sh);if(!g.getShaderParameter(sh,g.COMPILE_STATUS))throw new Error(g.getShaderInfoLog(sh));return sh;}var p=g.createProgram();g.attachShader(p,mk(g.VERTEX_SHADER,VERT));g.attachShader(p,mk(g.FRAGMENT_SHADER,FRAG[key]));g.bindAttribLocation(p,0,'a');g.linkProgram(p);if(!g.getProgramParameter(p,g.LINK_STATUS))throw new Error(g.getProgramInfoLog(p));return this.progs[key]={p:p,res:g.getUniformLocation(p,'uRes'),time:g.getUniformLocation(p,'uTime')};};
GLView.prototype.resize=function(){var c=this.canvas,s=Math.min(window.devicePixelRatio||1,1)*this.scale,w=Math.max(2,Math.round(innerWidth*s)),h=Math.max(2,Math.round(innerHeight*s));if(c.width!==w||c.height!==h){c.width=w;c.height=h;}};
GLView.prototype.draw=function(now){if(!this.gl||!this.key)return;var g=this.gl,pr=this.prog(this.key);this.resize();g.viewport(0,0,this.canvas.width,this.canvas.height);if(this.alpha){g.clearColor(0,0,0,0);g.clear(g.COLOR_BUFFER_BIT);}g.useProgram(pr.p);g.bindBuffer(g.ARRAY_BUFFER,this.buf);g.enableVertexAttribArray(0);g.vertexAttribPointer(0,2,g.FLOAT,false,0,0);g.uniform2f(pr.res,this.canvas.width,this.canvas.height);g.uniform1f(pr.time,reduced()?12:(now-t0)/1000+30);g.drawArrays(g.TRIANGLES,0,3);};
GLView.prototype.start=function(key){if(!this.mount())return false;if(this.failed[key]||!this.ensure())return false;try{this.prog(key);}catch(e){console.warn('[MDV scenes] '+key+' shader failed',e&&e.message||e);this.failed[key]=1;return false;}this.key=key;this.canvas.style.display='block';return true;};
GLView.prototype.stop=function(){this.key='';var c=document.getElementById(this.id);if(c)c.style.display='none';};
var gv=new GLView('mdv-scene-canvas',false,.62),sv=new GLView('mdv-snow-canvas',true,.55);

/* ---- video backdrop with poster still and seamless crossfaded looping ---- */
var vs=null,FADE=1.6;
function stopVideo(){if(!vs)return;clearInterval(vs.timer);var w=document.getElementById('mdv-scene-video');if(w)w.remove();vs=null;}
function startVideo(key,cfg,onFail){stopVideo();var st=stage();if(!st)return false;var w=document.createElement('div');w.id='mdv-scene-video';w.setAttribute('aria-hidden','true');var img=document.createElement('img');img.className='mdv-poster';img.alt='';img.src=assetURL(cfg.poster);w.appendChild(img);
 if(cfg.filter)w.style.filter=cfg.filter;var still=reduced()||saveData();
 if(!still){var vids=[0,1].map(function(){var v=document.createElement('video');v.muted=true;v.defaultMuted=true;v.playsInline=true;v.setAttribute('playsinline','');v.setAttribute('muted','');v.preload='auto';v.disablePictureInPicture=true;v.className='mdv-vid';v.style.opacity='0';w.appendChild(v);return v;});
  var n=cfg.video.length,s={key:key,v:vids,i:0,idx:0,switching:false,n:n,timer:0,ok:false};vs=s;
  vids[0].src=assetURL(cfg.video[0]);vids[1].src=assetURL(cfg.video[1%n]);
  vids[0].addEventListener('loadeddata',function(){s.ok=true;vids[0].style.opacity='1';setTimeout(function(){img.style.opacity='0';},900);var p=vids[0].play();if(p&&p.catch)p.catch(function(){});});
  vids[0].addEventListener('error',function(){if(vs===s)onFail();});
  var first=vids[0].play();if(first&&first.catch)first.catch(function(){});
  s.timer=setInterval(function(){if(document.hidden)return;var cur=s.v[s.i];if(!cur.duration||!isFinite(cur.duration))return;if(cur.paused&&s.ok&&!s.switching){var pp=cur.play();if(pp&&pp.catch)pp.catch(function(){});}if(!s.switching&&cur.duration-cur.currentTime<FADE){s.switching=true;var nx=s.v[1-s.i];nx.currentTime=0;var q=nx.play();if(q&&q.catch)q.catch(function(){});nx.style.opacity='1';cur.style.opacity='0';setTimeout(function(){try{cur.pause();}catch(e){}s.idx=(s.idx+1)%s.n;var follow=cfg.video[(s.idx+1)%s.n];var followUrl=assetURL(follow);if(cur.getAttribute('src')!==followUrl){cur.src=followUrl;}cur.currentTime=0;s.i=1-s.i;s.switching=false;},FADE*1000+150);}},250);}
 var shade=document.createElement('div');shade.className='mdv-shade';w.appendChild(shade);st.appendChild(w);return true;}

/* ---- orchestration ---- */
var cur='',raf=0,last=0;
function anyGL(){return !!(gv.key||sv.key);}
function frame(now){raf=0;if(!anyGL()||document.hidden)return;if(!last||now-last>=33){last=now;try{gv.draw(now);sv.draw(now);}catch(e){console.warn('[MDV scenes] draw failed',e&&e.message||e);gv.stop();sv.stop();return;}}if(!reduced())raf=requestAnimationFrame(frame);}
function kick(){if(!raf&&anyGL())raf=requestAnimationFrame(frame);}
function html(on){document.documentElement.classList.toggle('mdv-gl',!!on);}
function showGL(key){stopVideo();sv.stop();var ok=gv.start(key);html(ok);if(ok){last=0;kick();}return ok;}
function stopAll(){cur='';stopVideo();gv.stop();sv.stop();html(false);if(raf){cancelAnimationFrame(raf);raf=0;}}
function start(key){var c=CFG[key];if(!c)return;cur=key;
 if(c.gl){showGL(c.gl);return;}
 gv.stop();
 var ok=startVideo(key,c,function(){if(cur===key){console.warn('[MDV scenes] video failed, using GPU render for',key);showGL(c.fallback);}});
 if(!ok){showGL(c.fallback);return;}
 html(true);
 if(c.snow&&!reduced()&&sv.start('snow')){last=0;kick();}else sv.stop();}
function sync(){var k=String(document.documentElement.getAttribute('data-veux-wave')||'').toLowerCase();if(CFG[k]){var missing=!document.getElementById(CFG[k].gl?'mdv-scene-canvas':'mdv-scene-video');if(cur!==k||(missing&&!CFG[k].gl&&!(gv.key)))start(k);else if(anyGL())kick();}else if(cur||document.documentElement.classList.contains('mdv-gl'))stopAll();}
var q=0;function queue(){if(q)return;q=1;setTimeout(function(){q=0;try{sync();}catch(e){console.warn('[MDV scenes]',e);}},60);}
new MutationObserver(queue).observe(document.documentElement,{attributes:true,attributeFilter:['data-veux-wave']});
['cavyre:appearance-wave-change','veux:color-wave-change','veux:shell-ready','veux:assets-ready','pageshow'].forEach(function(n){window.addEventListener(n,queue);});
document.addEventListener('visibilitychange',function(){if(document.hidden){if(vs)vs.v.forEach(function(v){try{v.pause();}catch(e){}});}else{if(vs){var c=vs.v[vs.i];var p=c.play();if(p&&p.catch)p.catch(function(){});}queue();kick();}});
window.addEventListener('resize',function(){if(gv.key)gv.resize();if(sv.key)sv.resize();},{passive:true});
setInterval(queue,2500);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',queue,{once:true});else queue();
function snap(key,t,w,h){var c=document.createElement('canvas');c.width=w||960;c.height=h||540;var g=c.getContext('webgl',{preserveDrawingBuffer:true,antialias:false});if(!g)return null;function mk(ty,src){var sh=g.createShader(ty);g.shaderSource(sh,src);g.compileShader(sh);if(!g.getShaderParameter(sh,g.COMPILE_STATUS))throw new Error(key+': '+g.getShaderInfoLog(sh));return sh;}var p=g.createProgram();g.attachShader(p,mk(g.VERTEX_SHADER,VERT));g.attachShader(p,mk(g.FRAGMENT_SHADER,FRAG[key]));g.bindAttribLocation(p,0,'a');g.linkProgram(p);var b=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,b);g.bufferData(g.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),g.STATIC_DRAW);g.viewport(0,0,c.width,c.height);g.useProgram(p);g.enableVertexAttribArray(0);g.vertexAttribPointer(0,2,g.FLOAT,false,0,0);g.uniform2f(g.getUniformLocation(p,'uRes'),c.width,c.height);g.uniform1f(g.getUniformLocation(p,'uTime'),t||30);g.drawArrays(g.TRIANGLES,0,3);return c.toDataURL('image/png');}
window.MDV_SCENES={sync:sync,snap:snap,current:function(){return cur;},state:function(){return{cur:cur,gl:gv.key,snow:sv.key,video:!!vs};}};
})();
