/* Expedition world v0.7. Offline sculpted solids, authored hard-surface meshes and surface materials. */
(function(root){'use strict';
const P={ivory:[.90,.875,.82],trim:[.23,.265,.28],dark:[.055,.085,.11],orange:[.78,.35,.12],gold:[.90,.65,.29],teal:[.21,.64,.68],glass:[.075,.15,.20],fur:[1,.91,.80],cream:[.93,.81,.63],pink:[.51,.28,.24]};
const unit=v=>{const d=Math.hypot(...v)||1;return v.map(x=>x/d);},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],sp=(x,p)=>Math.sign(x)*Math.pow(Math.abs(x),p);
function surface(fn,nu=32,nv=22,normalFn=null){const data=[];const vertex=(u,v)=>{const q=fn(u,v),a=fn(u+.0002,v),b=fn(u,v+.0002);let n=normalFn?normalFn(q,u,v):unit(cross(a.map((x,i)=>x-q[i]),b.map((x,i)=>x-q[i])));if(!normalFn&&n.reduce((s,x,i)=>s+x*q[i],0)<0)n=n.map(x=>-x);return [...q,...n];};for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const q=[vertex(i/nu,j/nv),vertex((i+1)/nu,j/nv),vertex((i+1)/nu,(j+1)/nv),vertex(i/nu,(j+1)/nv)];for(const k of[0,1,2,0,2,3])data.push(...q[k]);}return data;}
function ellipsoid(power=1){return surface((u,v)=>{u*=Math.PI*2;v*=Math.PI;return[sp(Math.sin(v)*Math.cos(u),power),sp(Math.cos(v),power),sp(Math.sin(v)*Math.sin(u),power)];},power===1?24:12,power===1?16:8,q=>unit(q.map(x=>sp(x,2/power-1))));}
function torus(){return surface((u,v)=>{u*=Math.PI*2;v*=Math.PI*2;return[(1+.065*Math.cos(v))*Math.cos(u),.065*Math.sin(v),(1+.065*Math.cos(v))*Math.sin(u)];},40,8,(q,u,v)=>[Math.cos(u*Math.PI*2)*Math.cos(v*Math.PI*2),Math.sin(v*Math.PI*2),Math.sin(u*Math.PI*2)*Math.cos(v*Math.PI*2)]);}
function tail(){return surface((u,v)=>{const a=u*Math.PI*2,r=.105*Math.sin(Math.PI*(.23+v*.75))*(1+.065*Math.sin(u*37+v*76)),x=Math.sin(v*3.4)*.49,z=.12+v*.72,y=-v*.53+v*v*.28;return[x+Math.cos(a)*r,y+Math.sin(a)*r,z];},18,32);}
function ear(){const verts=[[-.12,0,.035],[.13,-.025,.035],[.085,.30,.015],[-.075,.12,-.045],[.075,.05,-.080],[.08,.275,-.025]],faces=[[0,1,2],[0,3,5],[0,5,2],[1,2,5],[1,5,4],[0,1,4],[0,4,3],[3,4,5]],a=[];for(const f of faces){let n=unit(cross(verts[f[1]].map((x,i)=>x-verts[f[0]][i]),verts[f[2]].map((x,i)=>x-verts[f[0]][i])));for(const i of f)a.push(...verts[i],...n);}return a;}
// Layered, angular outcrop. Hard geological planes replace inflated spherical rocks.
function lathe(profile,segments=48){const a=[];for(let j=0;j<profile.length-1;j++)for(let i=0;i<segments;i++){let u=i/segments*Math.PI*2,v=(i+1)/segments*Math.PI*2;const [r,y]=profile[j],[r2,y2]=profile[j+1],p=[[Math.cos(u)*r,y,Math.sin(u)*r],[Math.cos(v)*r,y,Math.sin(v)*r],[Math.cos(v)*r2,y2,Math.sin(v)*r2],[Math.cos(u)*r2,y2,Math.sin(u)*r2]],normAt=t=>unit([Math.cos(t)*(y2-y),r-r2,Math.sin(t)*(y2-y)]);for(const k of[0,1,2,0,2,3])a.push(...p[k],...normAt(k===0||k===3?u:v));}return a;}
// Curved pressure-shell panel, with real gaps between sectors.
function shellPanel(profile){const out=[],span=Math.PI*2/18*.95;for(let j=0;j<profile.length-1;j++)for(let i=0;i<8;i++){const a=-span/2+span*i/8,b=a+span/8,[r,y]=profile[j],[rr,yy]=profile[j+1];const q=[[Math.sin(a)*r,y,Math.cos(a)*r],[Math.sin(b)*r,y,Math.cos(b)*r],[Math.sin(b)*rr,yy,Math.cos(b)*rr],[Math.sin(a)*rr,yy,Math.cos(a)*rr]],n=t=>unit([Math.sin(t)*(yy-y),r-rr,Math.cos(t)*(yy-y)]);for(const k of[0,1,2,0,2,3])out.push(...q[k],...n(k===0||k===3?a:b));}return out;}
const R=root.MoonRenderer.prototype;
R.ensureWorldModels=function(){if(this.meshes.round)return;for(const[k,data]of Object.entries(root.MoonSculptedModels))this.addMesh(k,data);this.addMesh('round',ellipsoid(.35));this.addMesh('smooth',ellipsoid());this.addMesh('torus',torus());this.addMesh('tail',tail());this.addMesh('catEar',ear());const pebble=[],pp=[[0,1,0],[1,.1,0],[0,-.6,0],[-1,0,0],[0,0,.8],[0,0,-.7]];for(const f of[[0,1,4],[0,4,3],[0,3,5],[0,5,1],[2,4,1],[2,3,4],[2,5,3],[2,1,5]]){const n=unit(cross(pp[f[1]].map((x,i)=>x-pp[f[0]][i]),pp[f[2]].map((x,i)=>x-pp[f[0]][i])));for(const i of f)pebble.push(...pp[i],...n);}this.addMesh('pebble',pebble);
 this.addMesh('habShell',lathe([[.0,0],[.95,0],[1,.10],[1,.56],[.92,.75],[.81,.89],[.60,.98],[0,1.03]]));
 this.addMesh('habPanelLower',shellPanel([[1.007,.113],[1.009,.31],[1.009,.507]]));this.addMesh('habPanelRoof',shellPanel([[.895,.808],[.826,.88],[.614,.983],[.04,1.038]]));this.addMesh('habWindows',lathe([[1,.515],[1,.56],[.9705,.63],[.92,.75],[.881,.80]]));
 this.addMesh('capsuleHull',lathe([[0,0],[.74,0],[.94,.14],[1,.38],[.85,.65],[.57,.86],[.32,.97],[0,1.03]]));
 // Keep wide approach corridors around every quest item and resource.
 this.rocks=this.rocks.filter((r,i)=>i%3!==0);for(const r of this.rocks){r.h=1.8+r.h*.5;r.s*=.85;}
 const authored=[[-2,14.8,.9,1.2],[2.5,13.5,1.3,1.3],[-2.8,18,1.9,1.4],[4.5,18,1.8,1.5],[-4,18,1.8,1.7],[-3.5,21,1.8,1.7],[4,23,2.2,1.8],[-7,15,2.8,3.1],[7,6,2.3,1.5],[-13,13,3.3,3.8],[10,10,3.0,2.0],[19,1,4.0,3.9],[-23,-3,4,4.5],[5,-15,2.4,1.8],[-23,-30,2.5,3.2],[10,-32,2.8,3.2],[24,-20,3.4,3.4],[-9,-21,2.3,2.5]];
 for(const[x,z,s,h]of authored){if(!Object.values(root.MoonCore.POINTS).some(p=>Math.hypot(x-p[0],z-p[1])<s*.7+2.0))this.rocks.push({x,z,s,h,r:x*.57});}
 const fragments=[[-8,13,2.6,2.1],[-8,9,2.3,2.0],[-5.5,12,1.4,1.3],[8,13,2.4,2.3],[8.5,8,1.5,1.4],[-18,7,2.6,1.8],[15,6,2.6,1.9],[20,-10,3.1,2.5],[-18,-23,2.1,1.8]];
 for(const[x,z,s,h]of fragments)if(!Object.values(root.MoonCore.POINTS).some(p=>Math.hypot(x-p[0],z-p[1])<s+2.0)&&!root.MoonCore.resources.some(p=>Math.hypot(x-p.x,z-p.z)<s+1.2))this.rocks.push({x,z,s,h,r:x*.73});
 this.pebbles=[];let seed=281;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};for(let i=0;i<1150;i++){const x=(rnd()-.5)*80,z=(rnd()-.5)*84-9;const path=Math.abs(x-Math.sin(z*.07)*5);this.pebbles.push({x,z,s:(.04+rnd()**3*.60)*(path<3?.38:1)});}
};
const originalScene=R.scene;R.scene=function(state,...args){this.ensureWorldModels();const out=originalScene.call(this,state,...args);if(state.chapter===1)this.habitat(4,-5,1);this.expeditionProps(state.chapter);this.put('geologicalHorizon',0,0,0,2.2,1.4,2.2,[.52,.51,.48],0,4);return out;};
R.cat=function(x,z,yaw,t,moving,alt,ch,accent=P.orange,hero=false,equipment={}){
 const ground=root.MoonCore.surfaceHeight(x,z,ch)+alt,bob=moving?Math.sin(t*8)*.018:Math.sin(t*1.8)*.006,c=Math.cos(yaw),s=Math.sin(yaw);
 const put=(shape,lx,y,lz,sx,sy,sz,col,kind=0,pitch=0,roll=0,glow=0)=>this.put(shape,x+c*lx+s*lz,ground+y+bob,z-s*lx+c*lz,sx,sy,sz,col,yaw,kind,glow,pitch,roll);
 // Connected shoulders, chest and pelvis, sculpted offline from a single solid.
 put('sculptTorso',0,1.27,0,1,.94,1,[1,1,1],10);
 put('torus',0,1.008,0,.271,.38,.224,P.trim);put('round',0,1.019,-.240,.075,.031,.014,P.gold);
 for(const side of[-1,1]){
  put('round',side*.245,1.40,-.10,.031,.235,.020,P.trim,0,0,side*-.12);
  put('round',side*.17,1.10,-.194,.060,.07,.018,P.ivory,7);
 }
 put('torus',0,1.762,0,.272,.90,.235,P.trim);put('torus',0,1.796,0,.285,.40,.250,P.ivory);
 // Life support: separate gasket, shell, inset service ports and protective rails.
 put('round',0,1.38,.255,.252,.356,.100,P.dark);put('round',0,1.39,.335,.225,.325,.071,P.ivory);
 put('round',0,1.39,.408,.173,.286,.009,[.73,.74,.70]);
 for(const yy of[1.205,1.53]){
  put('cylinder',0,yy,.421,.087,.013,.087,P.trim,0,Math.PI/2);
  put('torus',0,yy,.440,.070,.23,.070,yy>1.3?P.teal:P.dark,0,Math.PI/2,0,.07);
  put('smooth',0,yy,.432,.056,.056,.009,P.dark,5);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;put('smooth',Math.cos(a)*.079,yy+Math.sin(a)*.079,.442,.005,.005,.003,P.ivory);}
 }
 for(const side of[-1,1]){
  put('round',side*.201,1.38,.416,.012,.238,.010,accent);
  for(const yy of[1.095,1.665])put('round',side*.191,yy,.394,.040,.037,.022,P.trim);
  for(let j=0;j<4;j++)put('round',side*.130,1.382-j*.023,.423,.028,.003,.002,P.trim);
 }
 put('round',0,1.096,.426,.079,.019,.004,P.trim);
 const bag=equipment.backpack||0,jet=equipment.jetpack||0;
 if(bag)for(const side of[-1,1])put('round',side*.27,1.075,.22,.060+bag*.005,.11,.09,P.ivory,7);
 put('tail',0,.87,.17,1,1,1,P.fur,2,0,Math.sin(t*1.7)*.05);
 for(const side of[-1,1]){
  const step=moving?Math.sin(t*8)*.36*side:0,kneeZ=-Math.sin(step)*.22,handZ=Math.sin(step)*.20;
  put('sculptLeg',side*.165,.551,kneeZ*.7,1,1,1,[1,1,1],14,step*.35);put('torus',side*.165,.505,kneeZ,.126,.72,.132,[.15,.20,.23]);
  put('round',side*.165,.517,kneeZ-.124,.106,.070,.027,P.trim);
  put('round',side*.165,.517,kneeZ-.154,.077,.052,.010,P.ivory,7);
  put('sculptBoot',side*.174,.160,kneeZ,1,1,1,P.trim);
  put('round',side*.174,.050,kneeZ-.062,.139,.024,.205,P.dark);
  put('round',side*.174,.173,kneeZ-.164,.083,.045,.012,P.ivory,7);
  put('torus',side*.174,.302,kneeZ+.017,.117,.37,.121,accent);
  for(let i=0;i<3;i++)put('round',side*.174,.055,kneeZ-.193+i*.074,.140,.007,.011,P.trim);
  put('sculptArm',side*.356,1.338,handZ*.6,1,1.33,1,[1,1,1],11,-step*.5,side*.13);
  put('round',side*.444,1.562,handZ*.3,.028,.099,.073,[.13,.19,.23]);put('round',side*.472,1.568,handZ*.3,.010,.055,.045,accent);
  put('round',side*.375,1.243,handZ-.10,.08,.058,.020,P.trim);
  put('torus',side*.413,1.002,handZ,.095,.60,.095,P.trim);
  put('sculptGlove',side*.414,.915,handZ-.009,side,1,1,P.trim);
  if(jet){put('round',side*.255,1.34,.30,.059,.20,.067,P.trim);put('cylinder',side*.255,1.104,.30,.058,.09,.058,P.dark);for(let i=0;i<jet;i++)put('round',side*.255,1.29+i*.055,.37,.030,.006,.003,P.teal,0,0,0,.15);}
  if(alt>.15)put('cone',side*.255,.87,.30,.056,.36+Math.sin(t*32)*.025,.056,P.teal,0,Math.PI,0,.9);
 }
 const look=hero&&!moving?-1.05:0,hc=Math.cos(look),hs=Math.sin(look);
 const headPut=(shape,lx,y,lz,sx,sy,sz,col,kind=0,pitch=0,roll=0,glow=0)=>{const xx=hc*lx+hs*(lz+.007),zz=-hs*lx+hc*(lz+.007)-.007;this.put(shape,x+c*xx+s*zz,ground+y+bob,z-s*xx+c*zz,sx,sy,sz,col,yaw+look,kind,glow,pitch,roll);};
 // Four-view photographic color atlas follows the connected anatomical solid.
 headPut('sculptHead',0,2.105,-.007,1.12,1.08,1.08,[1,1,1],9);
 for(const side of[-1,1]){
  for(let i=0;i<3;i++)headPut('round',side*.263,1.968+i*.020,-.420,.086,.0010,.0010,[.70,.65,.56],0,0,side*(i-.6)*.19);
  headPut('smooth',side*.351,1.93,.042,.022,.061,.075,P.ivory);headPut('round',side*.367,1.93,.042,.010,.037,.042,P.trim);
 }
 put('smooth',0,2.145,.003,.478,.525,.529,[.32,.50,.60],6);
 put('torus',0,1.807,0,.304,.49,.265,P.ivory);
};
// Cache the rigid parts of idle crew members by material; keep fur and helmets separate.
const detailedCat=R.cat;
R.cat=function(x,z,yaw,t,moving,alt,ch,accent=P.orange,hero=false,equipment={}){
 if(hero||moving||alt)return detailedCat.call(this,x,z,yaw,t,moving,alt,ch,accent,hero,equipment);
 this.crewMeshes=this.crewMeshes||new Map();const key=[x,z,yaw,ch,...accent].join('_');let cached=this.crewMeshes.get(key);
 if(!cached){const current=this.queue;this.queue=[];detailedCat.call(this,x,z,yaw,0,false,0,ch,accent,false,equipment);const parts=this.queue;this.queue=current;const groups=new Map();const keep=[];const oy=this.terrain(x,z,ch);
 for(const part of parts){if(part.kind===2||part.kind===6||part.kind===8||part.kind===9||part.kind===10||part.kind===11||part.kind===14){keep.push(part);continue;}const material=[...part.color,part.kind,part.glow].join('/');let g=groups.get(material);if(!g){g={data:[],color:part.color,kind:part.kind,glow:part.glow};groups.set(material,g);}const m=part.m,data=this.meshes[part.shape].data,scale=[0,4,8].map(i=>m[i]**2+m[i+1]**2+m[i+2]**2);
 for(let i=0;i<data.length;i+=6){const p=data.slice(i,i+3),n=[data[i+3]/scale[0],data[i+4]/scale[1],data[i+5]/scale[2]],normal=unit([m[0]*n[0]+m[4]*n[1]+m[8]*n[2],m[1]*n[0]+m[5]*n[1]+m[9]*n[2],m[2]*n[0]+m[6]*n[1]+m[10]*n[2]]);g.data.push(m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12]-x,m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13]-oy,m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]-z,...normal.map(v=>v*Math.hypot(data[i+3],data[i+4],data[i+5])));}}
 cached={groups:[],keep,y:oy};let index=0;for(const g of groups.values()){const shape='crew_'+key+'_'+index++;this.addMesh(shape,g.data);cached.groups.push({shape,color:g.color,kind:g.kind,glow:g.glow});}this.crewMeshes.set(key,cached);}
 const breath=Math.sin(t*1.8)*.01;for(const g of cached.groups)this.put(g.shape,x,cached.y+breath,z,1,1,1,g.color,0,g.kind,g.glow);for(const part of cached.keep){const m=new Float32Array(part.m);m[13]+=breath;this.queue.push({...part,m});}
};
R.lander=function(x,z,ch){const y=this.terrain(x,z,ch),p=(shape,lx,ly,lz,sx,sy,sz,col,kind=0,pitch=0,roll=0,yaw=0,glow=0)=>this.put(shape,x+lx,y+ly,z+lz,sx,sy,sz,col,yaw,kind,glow,pitch,roll);
 // Tall survey lander, inset windows, heat shield and four articulated landing legs.
 p('cylinder',0,.07,0,3.6,.12,3.6,P.trim);p('ring',0,.145,0,3.4,1,3.4,P.ivory);
 p('capsuleHull',0,.66,0,1.12,3.5,1.03,P.ivory);p('cylinder',0,.69,0,.92,.18,.86,P.dark);

 p('round',0,3.43,.49,.32,.36,.065,P.trim,0,.35);p('round',0,3.43,.568,.25,.26,.022,P.glass,5,.35);
 p('round',0,2.66,1.026,.34,.48,.038,P.trim);p('round',0,2.67,1.07,.295,.41,.02,P.ivory);
 p('round',0,2.87,1.099,.19,.16,.014,P.glass,5);p('round',.245,2.46,1.099,.02,.085,.013,P.orange);
 for(const side of[-1,1]){p('round',side*.79,2.89,.56,.12,.16,.035,P.glass,5,0,0,side*.45);p('round',side*.56,1.6,.895,.067,.28,.02,P.orange);p('round',side*.93,1.87,.26,.06,.20,.15,P.trim);}
 for(let i=0;i<4;i++){const a=Math.PI*.25+i*Math.PI*.5,dx=Math.sin(a),dz=Math.cos(a);p('round',dx*1.08,.83,dz*1.08,.073,.77,.073,P.trim,0,0,-.43,a);p('round',dx*1.57,.235,dz*1.57,.38,.10,.26,P.ivory,0,0,0,-a);p('smooth',dx*.85,1.47,dz*.85,.12,.12,.12,P.trim);p('round',dx*1.21,.54,dz*1.21,.033,.55,.033,P.gold,0,0,-.55,a);}
 for(let i=0;i<5;i++)p('round',0,2.05-i*.32,1.13+i*.25,.38,.035,.12,P.trim);for(const side of[-1,1])p('round',side*.4,1.39,1.71,.025,1.08,.027,P.ivory,0,-.63);
 p('cylinder',0,4.28,0,.025,.49,.025,P.trim);p('smooth',0,4.51,0,.05,.06,.05,P.teal,0,0,0,0,.5);
};
R.habitat=function(x,z,ch){const y=this.terrain(x,z,ch),p=(shape,lx,ly,lz,sx,sy,sz,col,kind=0,pitch=0,roll=0,yaw=0,glow=0)=>this.put(shape,x+lx,y+ly,z+lz,sx,sy,sz,col,yaw,kind,glow,pitch,roll);
 const radius=ch===1?3.25:2.45,ys=ch===1?3.8:3.0;
 p('habShell',0,.15,0,radius,ys,radius,P.trim);p('habWindows',0,.165,0,radius*1.008,ys,radius*1.008,P.glass,5);
 for(let i=0;i<18;i++){const a=i*Math.PI*2/18,col=P.ivory.map(v=>v*(.95+(i%3)*.02));p('habPanelLower',0,.15,0,radius,ys,radius,col,0,0,0,a);p('habPanelRoof',0,.15,0,radius,ys,radius,col,0,0,0,a);
  for(const yy of[.19,.46])for(const side of[-1,1]){const t=a+side*.13;p('smooth',Math.sin(t)*radius*1.013,.15+ys*yy,Math.cos(t)*radius*1.013,.015,.015,.015,P.trim);}
  const r=radius*1.012;p('round',Math.sin(a)*r,.15+ys*.318,Math.cos(a)*r,.26,.007,.009,[.65,.64,.59],0,0,0,a);
 }
 p('torus',0,.15+ys*.106,0,radius*.965,.46,radius*.965,P.ivory);
 p('torus',0,.15+ys*.512,0,radius*1.008,.25,radius*1.008,P.orange);
 p('torus',0,.15+ys*.515,0,radius*.974,.65,radius*.974,P.trim);p('torus',0,.16+ys*.803,0,radius*.875,.5,radius*.875,P.trim);
 for(let i=0;i<20;i++){const a=i/20*Math.PI*2;const sections=[[1.012,.515],[1.012,.56],[.932,.75],[.893,.80]];for(let j=0;j<sections.length-1;j++){const[r1,y1]=sections[j],[r2,y2]=sections[j+1],rr=(r1+r2)*radius/2,yy=(y1+y2)*ys/2,dy=(y2-y1)*ys,dr=(r2-r1)*radius;p('round',Math.sin(a)*rr,.16+yy,Math.cos(a)*rr,.024,Math.hypot(dy,dr)/2,.022,P.ivory,0,Math.atan2(dr,dy),0,a);}}
 // Roof panel seams follow the dome rather than floating above it.
 for(let i=0;i<12;i++){let a=i/12*Math.PI*2;for(let j=0;j<4;j++){const yy=.82+j*.045,rr=radius*(.86-j*.085);p('round',Math.sin(a)*rr,.15+ys*yy,Math.cos(a)*rr,.012,.06,.14,P.trim,0,.5,0,a);}}
 p('cylinder',0,.145+ys*1.03,0,radius*.36,.06,radius*.36,P.trim);p('round',.38,ys+0.34,-.1,.40,.24,.24,P.ivory);
 // Circular protruding airlock and gasket, with a closed pressure door.
 const dz=radius*.94;p('cylinder',0,1.16,dz,.93,.48,.93,P.trim,0,Math.PI/2);p('torus',0,1.16,dz+.30,.86,1.45,.86,P.ivory,0,Math.PI/2);
 p('cylinder',0,1.16,dz+.32,.73,.055,.73,P.dark,0,Math.PI/2);p('cylinder',0,1.16,dz+.353,.665,.02,.665,P.ivory,0,Math.PI/2);
 p('round',0,1.16,dz+.373,.012,.59,.009,P.trim);p('round',0,1.40,dz+.39,.25,.21,.012,P.glass,5);p('round',.4,1.03,dz+.396,.035,.13,.014,P.orange);
 for(let i=0;i<12;i++){let a=i/12*Math.PI*2;p('smooth',Math.sin(a)*.82,1.16+Math.cos(a)*.82,dz+.41,.032,.032,.021,P.trim);}
 for(let i=0;i<4;i++)p('round',0,.32-i*.065,dz+.64+i*.25,.73,.045,.20,P.trim);
 for(const side of[-1,1]){p('round',side*.79,.59,dz+1.01,.025,.28,.024,P.trim);p('round',side*.79,.80,dz+.83,.025,.025,.46,P.ivory);
 p('round',side*radius*.67,.47,radius*.75,.13,.41,.13,P.trim);p('round',side*radius*.67,.12,radius*.75,.34,.09,.34,P.ivory);}
 // Pressure tanks and ribbed service pods connect to the station sides.
 for(const side of[-1,1]){const xx=side*(radius+.62),zz=-.60;
  p('cylinder',xx,.77,zz,.69,1.58,.69,P.ivory,0,Math.PI/2);
  p('cylinder',xx,.77,zz+.80,.68,.045,.68,P.trim,0,Math.PI/2);
  for(let j=0;j<4;j++)p('torus',xx,.77,zz-.55+j*.38,.70,.30,.70,P.trim,0,Math.PI/2);
  p('round',xx,.94,zz+.832,.28,.18,.010,P.glass,5);
  p('round',xx,.27,zz+.85,.29,.16,.018,P.trim);
  p('round',xx,.1,zz,.81,.08,1.0,P.trim);
 }
 // Exterior service panel and radiator banks.
 for(let i=0;i<5;i++)p('round',-radius*.88,.82,-.60+i*.28,.13,.40,.105,P.trim);
 p('round',radius*.91,.94,.3,.16,.48,.49,P.trim);p('round',radius*1.03,.99,.3,.025,.32,.35,P.ivory);for(let i=0;i<4;i++)p('round',radius*1.055,.80+i*.10,.3,.01,.01,.27,P.trim);
 const ax=radius*.63,az=-radius*.48;p('cylinder',ax,ys+.76,az,.037,1.7,.037,P.trim);
 for(let j=0;j<3;j++){p('round',ax,ys+.44+j*.38,az,.54,.018,.022,P.trim,0,0,.10);}
 p('smooth',ax+.20,ys+.62,az,.42,.42,.074,P.ivory,0,.3,0,-.3);p('cylinder',ax+.23,ys+.67,az+.12,.055,.18,.055,P.trim,0,Math.PI/2);p('smooth',ax,ys+1.64,az,.047,.047,.047,P.orange,0,0,0,0,.6);
};
R.terminal=function(x,z,ch,color=P.teal){const y=this.terrain(x,z,ch),put=this.put.bind(this);
 put('round',x,y+.10,z,.38,.07,.30,P.trim);put('round',x,y+.65,z,.20,.49,.18,P.ivory);put('round',x,y+1.16,z,.36,.27,.15,P.trim,0,0,0,-.14);
 put('round',x,y+1.18,z+.17,.29,.20,.016,P.glass,5,0,-.14);for(let i=0;i<4;i++)put('round',x-.1,y+1.27-i*.06,z+.20,.14-i*.015,.008,.003,color,0,0,.35,-.14);
 put('round',x,y+.79,z+.185,.16,.015,.012,P.orange);put('cylinder',x+.26,y+1.5,z,.015,.33,.015,P.trim);put('smooth',x+.26,y+1.68,z,.035,.035,.035,color,0,0,.6);
};
R.expeditionProps=function(ch){const x=ch===1?2.5:-15,z=ch===1?-7:-10,y=this.terrain(x,z,ch),p=(shape,lx,ly,lz,sx,sy,sz,col,kind=0,pitch=0,roll=0,yaw=0)=>this.put(shape,x+lx,y+ly,z+lz,sx,sy,sz,col,yaw,kind,0,pitch,roll);
 // Six-wheel survey rover, with real tyre tread and a compact instrument cabin.
 p('round',0,.50,0,.61,.095,1.15,P.trim);p('round',0,.86,-.22,.55,.34,.76,P.ivory);p('round',0,1.07,-.57,.48,.22,.44,P.trim);p('round',0,1.10,-.81,.41,.16,.055,P.glass,5,.15);
 for(const side of[-1,1]){for(let j=0;j<3;j++){const zz=-.82+j*.82;p('cylinder',side*.73,.34,zz,.30,.16,.30,P.dark,0,0,Math.PI/2);p('torus',side*.835,.34,zz,.21,.47,.21,P.trim,0,0,Math.PI/2);for(let k=0;k<12;k++){let a=k/12*Math.PI*2;p('round',side*.74,.34+Math.sin(a)*.294,zz+Math.cos(a)*.294,.10,.028,.042,P.trim,0,-a);}}p('round',side*.45,.66,.84,.036,.10,.036,P.orange);}
 p('round',0,.88,.79,.48,.08,.26,P.trim);p('round',0,1.02,.73,.25,.08,.18,P.ivory);p('cylinder',.32,1.60,.27,.018,1.4,.018,P.trim);p('smooth',.32,2.3,.27,.05,.05,.05,P.teal);
 // Survey cases and low maintenance conduits beside the camp.
 for(let j=0;j<3;j++){let xx=-2.3+(j%2)*.70,zz=1.2+Math.floor(j/2)*.65;p('round',xx,.28,zz,.32,.26,.25,P.ivory);p('round',xx,.54,zz,.33,.03,.26,P.trim);for(const side of[-1,1])p('round',xx+side*.22,.3,zz+.255,.025,.20,.012,P.trim);}
};
// Collision footprints follow the rebuilt world, including the new survey station.
R.blocked=function(x,z,state,alt=0){this.ensureWorldModels();for(const r of this.rocks)if(alt<r.h*.81&&Math.hypot(x-r.x,z-r.z)<r.s*.98+.25)return true;
 const ch=state.chapter,sx=-5,sz=-2;if(alt<4.35&&Math.hypot(x-sx,z-sz)<1.50)return true;
 const habitats=ch===1?[[4,-5,3.25,6.5]]:[[4,-5,2.45,6.5],...(state.buildings.includes('habitat')?[[-5,-7,2.45,3.35]]:[])];
 for(const[hx,hz,r,h]of habitats){if(alt<1.6&&Math.abs(z-(hz-.60))<1.52&&Math.abs(x-hx)<r+1.58)return true;if(alt<h&&Math.hypot(x-hx,z-hz)<r+.22)return true;if(alt<2.1&&Math.abs(x-hx)<1.05&&z>hz&&z<hz+r+.65)return true;}
 const rx=4,rz=4;if(alt<1.65&&Math.abs(x-rx)<1.10&&Math.abs(z-rz)<1.50)return true;return false;
};
R.safeSpawn=function(x,z,state){if(!this.blocked(x,z,state))return{x,z};for(let radius=.5;radius<=12;radius+=.5)for(let i=0;i<32;i++){const nx=x+Math.sin(i*Math.PI/16)*radius,nz=z+Math.cos(i*Math.PI/16)*radius;if(nx>=root.MoonCore.WORLD.minX&&nx<=root.MoonCore.WORLD.maxX&&nz>=root.MoonCore.WORLD.minZ&&nz<=root.MoonCore.WORLD.maxZ&&!this.blocked(nx,nz,state))return{x:nx,z:nz};}return{x:0,z:12};};
// Bake stationary assemblies once, per material. The runtime submits small batches.
function cached(fn,name){return function(...args){this.assemblies=this.assemblies||new Map();const key=name+'_'+args.join('_');let entry=this.assemblies.get(key);if(!entry){const old=this.queue;this.queue=[];fn.apply(this,args);const objects=this.queue;this.queue=old;const groups=new Map();for(const o of objects){const key=[...o.color,o.kind,o.glow].join('/');let g=groups.get(key);if(!g){g={data:[],color:o.color,kind:o.kind,glow:o.glow};groups.set(key,g);}const m=o.m,data=this.meshes[o.shape].data,scale=[0,4,8].map(i=>m[i]**2+m[i+1]**2+m[i+2]**2);for(let i=0;i<data.length;i+=6){const p=data.slice(i,i+3),n=[data[i+3]/scale[0],data[i+4]/scale[1],data[i+5]/scale[2]],normal=unit([m[0]*n[0]+m[4]*n[1]+m[8]*n[2],m[1]*n[0]+m[5]*n[1]+m[9]*n[2],m[2]*n[0]+m[6]*n[1]+m[10]*n[2]]);g.data.push(m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14],...normal.map(v=>v*Math.hypot(data[i+3],data[i+4],data[i+5])));}}entry=[];let i=0;for(const g of groups.values()){const shape=key+'_'+i++;this.addMesh(shape,g.data);entry.push({shape,...g});}this.assemblies.set(key,entry);}for(const g of entry)this.put(g.shape,0,0,0,1,1,1,g.color,0,g.kind,g.glow);};}
R.lander=cached(R.lander,'lander');R.habitat=cached(R.habitat,'habitat');R.expeditionProps=cached(R.expeditionProps,'equipment');
})(globalThis);
