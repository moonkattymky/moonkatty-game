/* v40 "New Horizons" world pass: painted-art look for the open world.
   - layered far ridges (one draw), relief comes from MoonCore.height
   - boulder clusters (collide, batched into scenery) and loose rubble (one draw, high quality only)
   - glowing crystal fragments (one glass draw), larger collectible clusters, blue light pools (one additive draw)
   - camp life: solar farm, beacon tower, dish, crates, cables, marker lights, rover tracks
   - extra additive halos (windows, beacons, lamps, fragments) through the v31 billboard program
   No framebuffers, no post-processing. Low quality skips rubble, fragments and most halos. */
(function(root){'use strict';
const R=root.MoonRenderer.prototype,Core=root.MoonCore,B=root.MoonOutpostBuilder,M=root.MoonRenderMath;
const old={ensure:R.ensureWorldModels,scene:R.scene,render:R.render,put:R.put,blocked:R.blocked,camera:R.cameraBlocked,crystal:R.crystalDeposit};
const TAU=Math.PI*2,norm=v=>{const l=Math.hypot(v[0],v[1],v[2])||1;return[v[0]/l,v[1]/l,v[2]/l];},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function rng(seed){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}
function triPush(a,p,q,r,n){n=n||norm(cross([q[0]-p[0],q[1]-p[1],q[2]-p[2]],[r[0]-p[0],r[1]-p[1],r[2]-p[2]]));a.push(...p,...n,...q,...n,...r,...n);}
const clearOf=(x,z,pad)=>{for(const k in Core.POINTS){const p=Core.POINTS[k];if(Math.hypot(x-p[0],z-p[1])<pad+2.6)return false;}for(const r of Core.resources)if(Math.hypot(x-r.x,z-r.z)<pad+2.2)return false;return true;};
// ---------- far ridges: three hazy layers of jagged crests, centred on the camera ----------
function ridgeData(){const a=[],S=168;
 const layers=[[138,20,6,13,11],[168,26,10,20,23]];
 for(const[R0,span,hMin,hMax,seed]of layers){const rnd=rng(seed),ph=[rnd()*TAU,rnd()*TAU,rnd()*TAU,rnd()*TAU,rnd()*TAU];
  const crest=t=>{const s=Math.sin;let v=.5+.28*s(t*3+ph[0])+.18*s(t*7+ph[1])+.12*Math.abs(s(t*13+ph[2]))+.07*s(t*29+ph[3])+.04*s(t*61+ph[4]);return hMin+(hMax-hMin)*Math.max(0,Math.min(1.25,v));};
  const rows=[[-span,-7,0],[-span*.55,.30,.35],[-span*.22,.72,-.25],[0,1,0],[span*.45,.55,.2]];
  const grid=[];for(let i=0;i<=S;i++){const t=i/S*TAU,h=crest(t),col=[];for(const[dr,fy,wob]of rows){const r=R0+dr+wob*Math.sin(t*19+ph[1])*span*.25;const y=fy<0?fy:h*fy+(fy>0&&fy<1?Math.sin(t*23+ph[2]+fy*5)*h*.08:0);col.push([Math.sin(t)*r,y,Math.cos(t)*r]);}grid.push(col);}
  const nrm=grid.map(c=>c.map(()=>[0,0,0]));
  const faces=[];for(let i=0;i<S;i++)for(let j=0;j<rows.length-1;j++){const q=[[i,j],[i+1,j],[i+1,j+1],[i,j+1]];for(const f of[[0,2,1],[0,3,2]]){const v=f.map(k=>q[k]);const P=v.map(([u,w])=>grid[u][w]);const n=cross([P[1][0]-P[0][0],P[1][1]-P[0][1],P[1][2]-P[0][2]],[P[2][0]-P[0][0],P[2][1]-P[0][1],P[2][2]-P[0][2]]);for(const[u,w]of v){const m=nrm[u][w];m[0]+=n[0];m[1]+=n[1];m[2]+=n[2];}faces.push(v);}}
  for(const f of faces)for(const[u,w]of f){const p=grid[u][w],n=norm(nrm[u][w]);if(n[1]<0){n[0]=-n[0];n[1]=-n[1];n[2]=-n[2];}a.push(...p,...n);}}
 return a;}
// ---------- low-poly rocks for rubble ----------
function rockVariant(seed,sub){const t=(1+Math.sqrt(5))/2;let V=[[-1,t,0],[1,t,0],[-1,-t,0],[1,-t,0],[0,-1,t],[0,1,t],[0,-1,-t],[0,1,-t],[t,0,-1],[t,0,1],[-t,0,-1],[-t,0,1]].map(norm),F=[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];
 for(let s=0;s<sub;s++){const nf=[],mid=new Map(),m=(i,j)=>{const k=i<j?i+'_'+j:j+'_'+i;if(!mid.has(k)){V.push(norm(V[i].map((v,q)=>(v+V[j][q])/2)));mid.set(k,V.length-1);}return mid.get(k);};for(const[a,b,c]of F){const ab=m(a,b),bc=m(b,c),ca=m(c,a);nf.push([a,ab,ca],[b,bc,ab],[c,ca,bc],[ab,bc,ca]);}F=nf;}
 const r=rng(seed),planes=[];for(let i=0;i<7;i++)planes.push([norm([r()-.5,r()*.8-.3,r()-.5]),.62+r()*.3]);
 const P=V.map(v=>{let k=1;for(const[n,d]of planes){const dd=v[0]*n[0]+v[1]*n[1]+v[2]*n[2];if(dd>d)k=Math.min(k,d/dd);}return[v[0]*k,Math.max(v[1]*k*.62,-.18),v[2]*k];});
 const a=[];for(const[i,j,k]of F)triPush(a,P[i],P[j],P[k]);return a;}
function appendXform(dst,data,x,y,z,sx,sy,sz,yaw){const c=Math.cos(yaw),s=Math.sin(yaw);for(let i=0;i<data.length;i+=6){const px=data[i]*sx,py=data[i+1]*sy,pz=data[i+2]*sz;let nx=data[i+3]/sx,ny=data[i+4]/sy,nz=data[i+5]/sz;const l=Math.hypot(nx,ny,nz)||1;nx/=l;ny/=l;nz/=l;dst.push(x+c*px+s*pz,y+py,z-s*px+c*pz,c*nx+s*nz,ny,-s*nx+c*nz);}}
// ---------- crystal shard (hex prism + pointed tip), local height 1 ----------
function shardData(){const a=[],k=6,P=(i,y,r)=>{const t=i/k*TAU;return[Math.cos(t)*r,y,Math.sin(t)*r];};for(let i=0;i<k;i++){const b0=P(i,0,.5),b1=P(i+1,0,.5),m0=P(i,.72,.46),m1=P(i+1,.72,.46),tip=[.04,1,.03];triPush(a,b0,m1,m0);triPush(a,b0,b1,m1);triPush(a,m0,m1,tip);}return a;}
// ---------- layout ----------
const CLUSTERS=[[-30,22,2.3],[-44,28,1.9],[34,16,2.2],[46,4,1.8],[-36,-8,2.0],[-46,-20,2.4],[36,-56,2.2],[24,-66,1.8],[-18,52,2.4],[-32,60,2.0],[52,24,2.0],[66,36,1.7],[-64,4,2.0],[-76,18,1.8],[-4,-66,2.2],[-16,-56,1.8],[62,-62,2.0],[-58,46,2.2],[-38,-70,1.9],[18,-80,1.8],[22,30,1.6],[-26,36,1.5],[28,-44,1.5],[-50,14,1.6],[56,52,1.4],[74,-8,1.8],[-72,-40,2.0],[8,40,1.5]];
function camp(){// world-space props around the base (all chapters), with authored collision footprints
 const solar=[[10.5,-5.6],[13.1,-5.6],[15.7,-5.6]],crates=[[6.4,8.3,0],[7.15,8.95,.4],[6.6,9.25,.9],[-8.4,1.6,.3],[-8.9,2.35,1.1],[10.4,2.6,.2],[11.1,3.3,1.0],[-1.6,4.4,.5],[-10.6,-9.6,.8],[-11.3,-10.2,.1],[14.6,-9.2,.6]];
 return{solar,crates,tower:[-10.6,-1.4],dish:[8.6,-9.6],cables:[[[6.9,-5.1],[8.2,-5.3],[9.2,-5.6]],[[-7.4,-1.5],[-9.0,-1.4],[-10.2,-1.4]],[[3.6,-1.6],[3.4,1.0],[3.7,2.7]]],
  lights:[...Array.from({length:10},(_,i)=>{const a=i/10*TAU;return[-5+Math.sin(a)*3.9,-2+Math.cos(a)*3.9];}),[9.3,-4.0],[17.0,-4.0],[9.3,-7.2],[17.0,-7.2],[1.2,2.4],[6.8,2.4],[1.0,9.6],[-1.0,15.5],[8.6,12.8],[11.6,17.4]],
  posts:[[-9,3,0],[-2.2,5.6,1],[9.6,1.4,2],[12.2,-3.6,0],[2.2,-15.2,1],[-9.2,-11.2,2],[-12.2,1.0,1],[16.2,-8.4,0]],
  windows:[[4,-5]]};}
function towerModel(){const b=new B();b.box('steel',0,.12,0,1.2,.24,1.2);for(const[sx,sz]of[[-1,-1],[1,-1],[1,1],[-1,1]])b.tube('gold',[sx*.48,.2,sz*.48],[sx*.16,4.6,sz*.16],.045,8);b.tube('ivory',[0,.2,0],[0,5.4,0],.16,16);for(let j=0;j<6;j++)b.tube('gold',[0,.8+j*.8,0],[0,.86+j*.8,0],.2,16);b.tube('ivory',[0,5.4,0],[0,5.7,0],.34,20);b.ring('gold',0,5.72,0,.36,.36,.25,.08,16);b.tube('blue',[0,5.75,0],[0,6.25,0],.24,20);b.tube('gold',[0,6.25,0],[0,6.35,0],.32,20);b.tube('ivory',[0,6.35,0],[0,6.7,0],.26,20,.04);b.tube('steel',[0,6.7,0],[0,7.4,0],.025,6);return b;}
function dishModel(){const b=new B();b.box('steel',0,.1,0,.9,.2,.9);b.tube('ivory',[0,.2,0],[0,1.5,0],.09,12);b.box('gold',0,1.55,0,.32,.18,.32);const c=[0,2.05,-.25],ax=norm([0,.55,-.84]);const u=norm(cross(ax,[1,0,0])),v=cross(ax,u);const ring=(rad,dep)=>Array.from({length:17},(_,i)=>{const t=i/16*TAU;return[c[0]+(u[0]*Math.cos(t)+v[0]*Math.sin(t))*rad+ax[0]*dep,c[1]+(u[1]*Math.cos(t)+v[1]*Math.sin(t))*rad+ax[1]*dep,c[2]+(u[2]*Math.cos(t)+v[2]*Math.sin(t))*rad+ax[2]*dep];});
 const r0=[c.map((q,i)=>q-ax[i]*.0)],r1=ring(.42,.06),r2=ring(.86,.24);for(let i=0;i<16;i++){b.tri('ivory',c,r1[i],r1[i+1]);b.tri('ivory',c,r1[i+1],r1[i]);b.quad('ivory',r1[i],r2[i],r2[i+1],r1[i+1]);b.quad('ivory',r1[i+1],r2[i+1],r2[i],r1[i]);}
 for(let i=0;i<16;i+=2)b.tube('gold',r2[i],r2[i+2]||r2[0],.03,6);for(const k of[0,5,11])b.tube('steel',r2[k],c.map((q,i)=>q+ax[i]*.75),.014,5);b.tube('blue',c.map((q,i)=>q+ax[i]*.72),c.map((q,i)=>q+ax[i]*.84),.05,10);return b;}
function solarModel(){const b=new B();b.box('steel',0,.08,0,.5,.16,.5);b.tube('ivory',[0,.16,0],[0,1.0,0],.07,10);b.box('gold',0,1.02,0,.2,.12,.2);const tilt=.42,co=Math.cos(tilt),si=Math.sin(tilt),w=2.3,d=1.35,y=1.12;
 const pt=(x,z,dy)=>[x,y+z*si+dy,z*co];b.quad('gold',pt(-w/2-.05,-d/2-.05,-.03),pt(w/2+.05,-d/2-.05,-.03),pt(w/2+.05,d/2+.05,-.03),pt(-w/2-.05,d/2+.05,-.03));b.quad('steel',pt(-w/2-.05,d/2+.05,-.05),pt(w/2+.05,d/2+.05,-.05),pt(w/2+.05,-d/2-.05,-.05),pt(-w/2-.05,-d/2-.05,-.05));
 for(let i=0;i<3;i++)for(let j=0;j<2;j++){const x0=-w/2+i*w/3+.025,x1=-w/2+(i+1)*w/3-.025,z0=-d/2+j*d/2+.025,z1=-d/2+(j+1)*d/2-.025;b.quad('solar',pt(x0,z0,0),pt(x1,z0,0),pt(x1,z1,0),pt(x0,z1,0),norm([0,co,-si]));}return b;}
function crateModel(){const b=new B();b.box('steel',0,.27,0,.78,.54,.56);b.box('dark',0,.27,.285,.6,.36,.02);b.box('gold',0,.55,0,.8,.03,.58);for(const s of[-1,1]){b.box('gold',s*.4,.27,0,.03,.56,.58);b.box('ivory',s*.2,.27,.3,.1,.42,.02);}b.box('amber',.26,.44,.292,.06,.03,.01);return b;}
function postModel(m){const b=new B();b.box('steel',0,.05,0,.34,.1,.34);b.tube('ivory',[0,.1,0],[0,1.72,0],.045,8);b.tube('gold',[0,1.0,0],[0,1.06,0],.07,8);b.tube('gold',[0,1.72,0],[0,1.78,0],.085,8);b.tube(m,[0,1.78,0],[0,1.98,0],.065,10);b.tube('gold',[0,1.98,0],[0,2.02,0],.07,8);return b;}
function lampModel(){const b=new B();b.tube('steel',[0,0,0],[0,.16,0],.07,8);b.tube('amber',[0,.16,0],[0,.24,0],.055,8);b.tube('gold',[0,.24,0],[0,.27,0],.07,8);return b;}
const MATS={ivory:[17,[.88,.89,.87]],gold:[16,[.92,.63,.25]],steel:[0,[.23,.28,.31]],dark:[0,[.045,.065,.085]],solar:[15,[.035,.10,.20]],amber:[12,[1,.57,.14]],blue:[12,[.10,.62,1.0]]};
function bake(groups,builder,x,y,z,yaw){const c=Math.cos(yaw),s=Math.sin(yaw);for(const[mat,data]of builder.groups){let g=groups.get(mat);if(!g)groups.set(mat,g=[]);for(let i=0;i<data.length;i+=6){const px=data[i],py=data[i+1],pz=data[i+2],nx=data[i+3],ny=data[i+4],nz=data[i+5];g.push(x+c*px+s*pz,y+py,z-s*px+c*pz,c*nx+s*nz,ny,-s*nx+c*nz);}}}
R.ensureWorldModels=function(){old.ensure.call(this);if(this.v40Ready)return;this.v40Ready=true;
 // Boulder clusters: one large block with satellites; they collide like every other rock and share the static scenery batch.
 const r=rng(4040);for(const[cx,cz,s]of CLUSTERS){if(!clearOf(cx,cz,s+2.5))continue;this.rocks.push({x:cx,z:cz,s,h:s*1.25,r:r()*TAU,v40:1});for(let i=0;i<3;i++){const a=r()*TAU,d=s*(1.05+r()*.6),x=cx+Math.cos(a)*d,z=cz+Math.sin(a)*d,ss=.48+r()*.2;if(clearOf(x,z,ss+2))this.rocks.push({x,z,s:ss,h:ss*1.3,r:r()*TAU,v40:1});}}
 this.v40Camp=camp();};
R.put=function(shape,...a){if(shape==='geologicalHorizon')return;return old.put.call(this,shape,...a);};
function inside(o,x,z,state){const c=o.v40Camp||(o.v40Camp=camp());for(const[sx,sz]of c.solar)if(Math.abs(x-sx)<1.32&&Math.abs(z-sz)<.82)return true;for(const[cx,cz]of c.crates)if(Math.hypot(x-cx,z-cz)<.55)return true;if(Math.hypot(x-c.tower[0],z-c.tower[1])<.85)return true;if(Math.hypot(x-c.dish[0],z-c.dish[1])<.62)return true;for(const[px,pz]of c.posts)if(Math.hypot(x-px,z-pz)<.32)return true;return false;}
R.blocked=function(x,z,state,alt=0){if(alt<2.2&&inside(this,x,z,state))return true;return old.blocked.call(this,x,z,state,alt);};
if(old.camera)R.cameraBlocked=function(x,z,state,alt=0){if(alt<1.6&&inside(this,x,z,state))return true;return old.camera.call(this,x,z,state,alt);};
// Tall faceted crystal clusters (flat-shaded prisms with bevelled tips) and an emissive inner core per big shard.
function shardPrism(dst,core,x,y,z,r,h,yaw,pitch,roll,rnd,withCore){const k=7,rad=[];for(let i=0;i<k;i++)rad.push(r*(.78+rnd()*.38));const tip=h*(.22+rnd()*.12),bev=h-tip,ax=(rnd()-.5)*r*.5,az=(rnd()-.5)*r*.5;
 const m=M.model(x,y,z,1,1,1,yaw,pitch,roll),T=p=>[m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];
 const ring=(yy,sc)=>rad.map((rr,i)=>{const t=i/k*TAU;return T([Math.cos(t)*rr*sc,yy,Math.sin(t)*rr*sc]);});
 const b=ring(-.12,1.02),mid=ring(bev*.55,1.0),top=ring(bev,.9),apex=T([ax,h,az]);
 for(let i=0;i<k;i++){const n=(i+1)%k;triPush(dst,b[i],mid[n],mid[i]);triPush(dst,b[i],b[n],mid[n]);triPush(dst,mid[i],top[n],top[i]);triPush(dst,mid[i],mid[n],top[n]);triPush(dst,top[i],top[n],apex);}
 if(withCore){const cr=rad.map(v=>v*.42),cring=(yy)=>cr.map((rr,i)=>{const t=i/k*TAU;return T([Math.cos(t)*rr,yy,Math.sin(t)*rr]);}),c0=cring(.02),c1=cring(bev*.82),ca=T([ax*.6,bev+tip*.55,az*.6]);for(let i=0;i<k;i++){const n=(i+1)%k;triPush(core,c0[i],c1[n],c1[i]);triPush(core,c0[i],c0[n],c1[n]);triPush(core,c1[i],c1[n],ca);}}}
function clusterData(seed,scale=1){const rnd=rng(seed),a=[],core=[];
 shardPrism(a,core,0,0,0,.24*scale,(1.75+rnd()*.45)*scale,rnd()*TAU,(rnd()-.5)*.12,(rnd()-.5)*.12,rnd,true);
 const n2=5;for(let i=0;i<n2;i++){const t=i/n2*TAU+rnd()*.6,d=(.20+rnd()*.12)*scale,tilt=.28+rnd()*.26;shardPrism(a,core,Math.cos(t)*d,0,Math.sin(t)*d,(.13+rnd()*.05)*scale,(.85+rnd()*.6)*scale,rnd()*TAU,Math.sin(t)*tilt,-Math.cos(t)*tilt,rnd,true);}
 const n3=8;for(let i=0;i<n3;i++){const t=i/n3*TAU+rnd()*.5,d=(.42+rnd()*.25)*scale,tilt=.45+rnd()*.4;shardPrism(a,core,Math.cos(t)*d,0,Math.sin(t)*d,(.06+rnd()*.05)*scale,(.30+rnd()*.42)*scale,rnd()*TAU,Math.sin(t)*tilt,-Math.cos(t)*tilt,rnd,false);}
 return{a,core};}
R.crystalDeposit=function(res,ch,t){this.ensureWorldModels();const id=Number(String(res.id).replace(/\D/g,''))||0,v=id%4,key='v40_cluster_'+v;if(!this.meshes[key]){const d=clusterData(900+v*37,.95+v*.05);this.addMesh(key,d.a);this.addMesh(key+'_core',d.core);}
 const x=res.x,z=res.z,y=this.terrain(x,z,ch),yaw=id*.71,pulse=Math.sin(t*1.7+x);
 this.put('mineralGlow',x,y+.03,z,1.35,1,1.2,[.12,.42,1.0],0,22,.22+.04*pulse);
 this.put(key+'_core',x,y,z,1,1,1,[.35,.80,1.0],yaw,12,.85+.15*pulse);
 this.put(key,x,y,z,1,1,1,[.06,.34,1.0],yaw,13,.24+.06*pulse);};
R.v40Static=function(ch){const key='v40_'+ch;if(this.v40Built===key)return;this.v40Built=key;const h=(x,z)=>this.terrain(x,z,ch),rnd=rng(77+ch);
 if(!this.meshes.v40_ridges)this.addMesh('v40_ridges',ridgeData());
 // loose rubble around boulders, crater rims and along the plains
 const variants=[rockVariant(3,1),rockVariant(8,0),rockVariant(13,0),rockVariant(21,0)],rub=[];
 const stone=(x,z,s)=>{if(!clearOf(x,z,.6)||Math.abs(x)>80||z<-82||z>74)return;const v=variants[s>.3?(rnd()<.5?0:1):s>.16?(rnd()<.5?1:2):(rnd()<.5?2:3)];appendXform(rub,v,x,h(x,z)-s*.12,z,s*(.8+rnd()*.5),s*(.55+rnd()*.4),s*(.8+rnd()*.5),rnd()*TAU);};
 for(const k of this.rocks){const n=k.v40?6:2;for(let i=0;i<n;i++){const a=rnd()*TAU,d=k.s*(1.0+rnd()*1.6);stone(k.x+Math.cos(a)*d,k.z+Math.sin(a)*d,.08+rnd()*rnd()*.42);}}
 for(let i=0;i<420;i++){const a=rnd()*TAU,d=6+Math.sqrt(rnd())*70;stone(Math.sin(a)*d,Math.cos(a)*d-6,.05+rnd()*rnd()*.26);}
 this.addMesh('v40_rubble_'+ch,rub);
 // decorative glowing fragments (small, low, clearly not collectible clusters)
 const shard=shardData(),frag=[],fragPts=[];const cr=Core.resources.filter(q=>q.type==='crystals');
 const addFrag=(x,z,s)=>{if(Math.abs(x)>80||z<-82||z>74)return;for(const k of this.rocks)if(Math.hypot(x-k.x,z-k.z)<k.s*.9)return;const y=h(x,z),n=1+(rnd()*3|0);for(let i=0;i<n;i++){const a=rnd()*TAU,d=i?s*.9:0,px=x+Math.cos(a)*d,pz=z+Math.sin(a)*d,ss=s*(i?.6:1)*(.7+rnd()*.5);shardPrism(frag,null,px,y-ss*.1,pz,ss*.2,ss*1.5,rnd()*TAU,(rnd()-.5)*.9,(rnd()-.5)*.9,rnd,false);}fragPts.push([x,y,z,s]);};
 for(const q of cr)for(let i=0;i<3;i++){const a=rnd()*TAU,d=1.9+rnd()*2.2;addFrag(q.x+Math.cos(a)*d,q.z+Math.sin(a)*d,.10+rnd()*.10);}
 for(const k of this.rocks)if(rnd()<.45){const a=rnd()*TAU,d=k.s*(1.0+rnd()*.3);addFrag(k.x+Math.cos(a)*d,k.z+Math.sin(a)*d,.12+rnd()*.12);}
 for(let i=0;i<46;i++){const a=rnd()*TAU,d=8+Math.sqrt(rnd())*66;addFrag(Math.sin(a)*d,Math.cos(a)*d-6,.08+rnd()*.10);}
 this.addMesh('v40_frag_'+ch,frag);this.v40Frag=fragPts;
 // camp dressing assemblies (world space)
 const c=this.v40Camp||(this.v40Camp=camp()),groups=new Map();
 for(const[x,z]of c.solar)bake(groups,solarModel(),x,h(x,z),z,0);
 bake(groups,towerModel(),c.tower[0],h(...c.tower),c.tower[1],0);bake(groups,dishModel(),c.dish[0],h(...c.dish),c.dish[1],-2.4);
 for(const[x,z,yaw]of c.crates)bake(groups,crateModel(),x,h(x,z)-.02,z,yaw);for(const[x,z]of c.lights)bake(groups,lampModel(),x,h(x,z)-.02,z,0);for(const[x,z,k]of c.posts)bake(groups,postModel(k===1?'blue':'amber'),x,h(x,z)-.03,z,0);
 const cb=new B();for(const line of c.cables){const pts=[];for(let i=0;i<line.length-1;i++)for(let k=0;k<6;k++){const t=k/6,x=line[i][0]+(line[i+1][0]-line[i][0])*t,z=line[i][1]+(line[i+1][1]-line[i][1])*t;pts.push([x,h(x,z)+.035,z]);}const L=line[line.length-1];pts.push([L[0],h(L[0],L[1])+.035,L[1]]);for(let i=0;i<pts.length-1;i++)cb.tube('dark',pts[i],pts[i+1],.035,6);}bake(groups,cb,0,0,0,0);
 this.v40CampShapes=[];for(const[mat,data]of groups){const shape='v40_camp_'+ch+'_'+mat;this.addMesh(shape,data);this.v40CampShapes.push([shape,mat]);}
 // rover tracks: paired treaded ruts curving out of the camp toward each district
 const tr=[],berm=[],rut=(pts)=>{let run=0;for(let i=0;i<pts.length-1;i++){const[a,b]=[pts[i],pts[i+1]],dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz),nx=-dz/L,nz=dx/L,steps=Math.ceil(L/.32);for(let j=0;j<steps;j++){const t0=j/steps,t1=(j+.62)/steps,s=run+L*t0,fade=Math.min(1,s/4)*(.8+.2*Math.sin(s*.21));for(const off of[-.62,.62]){const v=(t,w)=>{const x=a[0]+dx*t+nx*(off+w),z=a[1]+dz*t+nz*(off+w);return[x,h(x,z)+.018,z];};const al=.70*fade,A=v(t0,-.15),Bq=v(t1,-.15),Cq=v(t1,.15),D=v(t0,.15);for(const p of[A,Cq,Bq,A,D,Cq])tr.push(...p,0,Math.max(al,.0001),0);}
  for(const off of[-.86,-.38,.38,.86]){const v=(t,w)=>{const x=a[0]+dx*t+nx*(off+w),z=a[1]+dz*t+nz*(off+w);return[x,h(x,z)+.016,z];};const al=.34*fade,A=v(0,-.07),Bq=v(1,-.07),Cq=v(1,.07),D=v(0,.07);for(const p of[A,Cq,Bq,A,D,Cq])berm.push(...p,0,Math.max(al,.0001),0);}}run+=L;}};
 const curve=(pts,n=10)=>{const out=[];for(let i=0;i<pts.length-1;i++){const p0=pts[Math.max(0,i-1)],p1=pts[i],p2=pts[i+1],p3=pts[Math.min(pts.length-1,i+2)];for(let k=0;k<n;k++){const t=k/n,t2=t*t,t3=t2*t;out.push([0,1].map(q=>.5*((2*p1[q])+(-p0[q]+p2[q])*t+(2*p0[q]-5*p1[q]+4*p2[q]-p3[q])*t2+(-p0[q]+3*p1[q]-3*p2[q]+p3[q])*t3)));}}out.push(pts[pts.length-1]);return out;};
 rut(curve([[5.5,6.5],[9,12],[16,16],[26,10],[40,-6],[50,-18],[54,-26]]));rut(curve([[2.5,6.5],[-4,20],[-14,28],[-30,10],[-44,-24],[-50,-40]]));rut(curve([[6,7],[12,22],[20,38],[30,48]]));rut(curve([[3,2],[-6,-10],[-12,-18],[-22,-30],[-24,-36]]));rut(curve([[2.2,7.0],[1.4,12],[-1.2,18],[-3.5,26],[-2,36]]));
 this.addMesh('v40_tracks_'+ch,tr);this.addMesh('v42_berms_'+ch,berm);
 // light pools (static): every crystal deposit, fragments, camp lamps and the station door
 this.v40PoolKey='';};
// ---------- shaders: additive ground pools ----------
const PV=`attribute vec3 position;attribute vec4 info;attribute vec3 tint;uniform mat4 vp;uniform float time;varying vec4 i;varying vec3 c;void main(){i=info;c=tint*(.86+.14*sin(time*1.9+info.z));gl_Position=vp*vec4(position,1.);}`;
const PF=`precision mediump float;varying vec4 i;varying vec3 c;void main(){float r=length(i.xy);if(r>1.)discard;float g=exp(-r*r*3.6)*(1.-smoothstep(.7,1.,r));gl_FragColor=vec4(c*g*i.w,0.);}`;
// ---------- v42 painted far ridge strip (assets/ridges-v42.jpg: top half colour, bottom half alpha) ----------
const RING={r:212,yb:-6,yt:41,reps:7,seg:112};
const RV=`attribute vec3 p;attribute vec2 uv;uniform mat4 vp;uniform vec3 ctr;varying vec2 T;void main(){T=uv;gl_Position=vp*vec4(p+ctr,1.);}`;
const RF=`precision mediump float;uniform sampler2D tex;uniform vec3 tint;uniform vec3 hazeC;uniform float hazeK;varying vec2 T;void main(){float t=clamp(T.y,.004,.996);vec3 col=texture2D(tex,vec2(T.x,t*.5)).rgb;float a=texture2D(tex,vec2(T.x,.5+t*.5)).r*smoothstep(.05,.26,t);if(a<.01)discard;vec3 lin=pow(col,vec3(2.2))*tint;lin=mix(lin,hazeC,clamp(hazeK*(.55+.45*(1.-t))+.80*(1.-smoothstep(.05,.30,t)),0.,.95));vec3 x=lin*1.18;vec3 f=clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);gl_FragColor=vec4(pow(f,vec3(1./2.2)),a);}`;
function ringData(){const a=[],{r,yb,yt,reps,seg}=RING;for(let i=0;i<seg;i++){const u0=i/seg,u1=(i+1)/seg,P=(u,y)=>[Math.sin(u*TAU)*r,y,Math.cos(u*TAU)*r];const A=[...P(u0,yt),u0*reps,0],Bv=[...P(u1,yt),u1*reps,0],C=[...P(u1,yb),u1*reps,1],D=[...P(u0,yb),u0*reps,1];a.push(...A,...C,...Bv,...A,...D,...C);}return new Float32Array(a);}
function prog(gl,vs,fs){const p=gl.createProgram();for(const[t,src]of[[gl.VERTEX_SHADER,vs],[gl.FRAGMENT_SHADER,fs]]){const sh=gl.createShader(t);gl.shaderSource(sh,src);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));gl.attachShader(p,sh);}gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;}
R.initHorizons=function(){if(this.v40)return this.v40;const gl=this.gl,v=this.v40={ok:false};try{v.p=prog(gl,PV,PF);v.pos=gl.getAttribLocation(v.p,'position');v.info=gl.getAttribLocation(v.p,'info');v.tint=gl.getAttribLocation(v.p,'tint');v.vp=gl.getUniformLocation(v.p,'vp');v.time=gl.getUniformLocation(v.p,'time');v.buf=gl.createBuffer();v.bill=gl.createBuffer();v.ok=true;}catch(e){console.warn('MOONKATTY v40 pools fallback:',e.message);}
 try{const g=v.ring={};g.p=prog(gl,RV,RF);for(const k of['p','uv'])g[k+'L']=gl.getAttribLocation(g.p,k);for(const k of['vp','ctr','tint','hazeC','hazeK'])g[k]=gl.getUniformLocation(g.p,k);g.texU=gl.getUniformLocation(g.p,'tex');g.buf=gl.createBuffer();g.data=ringData();gl.bindBuffer(gl.ARRAY_BUFFER,g.buf);gl.bufferData(gl.ARRAY_BUFFER,g.data,gl.STATIC_DRAW);g.tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,g.tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]));
  if(typeof Image!=='undefined'){const im=new Image();im.onload=()=>{gl.bindTexture(gl.TEXTURE_2D,g.tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,im);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.bindTexture(gl.TEXTURE_2D,null);g.ready=true;};im.src='assets/ridges-v42.jpg';}
  gl.bindTexture(gl.TEXTURE_2D,null);g.ok=true;}catch(e){console.warn('MOONKATTY v42 ridge strip fallback:',e.message);v.ring={ok:false};}
 return v;};
R.drawRidgeStrip=function(){const v=this.v40,g=v&&v.ring;if(!g||!g.ok||!g.ready)return false;const gl=this.gl;gl.useProgram(g.p);gl.uniformMatrix4fv(g.vp,false,this.vp);gl.uniform3f(g.ctr,this.eye[0],0,this.eye[2]);gl.uniform3fv(g.tint,[.42,.40,.38]);gl.uniform3fv(g.hazeC,[.058,.062,.098]);gl.uniform1f(g.hazeK,.36);
 gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,g.tex);gl.uniform1i(g.texU,0);gl.enable(gl.DEPTH_TEST);gl.depthMask(false);gl.disable(gl.CULL_FACE);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
 gl.bindBuffer(gl.ARRAY_BUFFER,g.buf);gl.enableVertexAttribArray(g.pL);gl.vertexAttribPointer(g.pL,3,gl.FLOAT,false,20,0);gl.enableVertexAttribArray(g.uvL);gl.vertexAttribPointer(g.uvL,2,gl.FLOAT,false,20,12);gl.drawArrays(gl.TRIANGLES,0,g.data.length/5);gl.disableVertexAttribArray(g.pL);gl.disableVertexAttribArray(g.uvL);gl.bindTexture(gl.TEXTURE_2D,null);if(this.stats)this.stats.ridgeStrip=1;return true;};
function poolData(r,state){const ch=state.chapter,out=[],disc=(x,z,rad,col,k,ph)=>{const N=4,y0=(a,b)=>r.terrain(a,b,ch)+.035;for(let j=0;j<N;j++)for(let i=0;i<N;i++){const q=[[i,j],[i+1,j],[i+1,j+1],[i,j+1]].map(([a,b])=>{const u=a/N*2-1,w=b/N*2-1,px=x+u*rad,pz=z+w*rad;return[px,y0(px,pz),pz,u,w,ph,k];});for(const t of[0,1,2,0,2,3])out.push(...q[t],...col);}};
 for(const q of Core.resources)if(q.type==='crystals'&&!state.collected.includes(q.id))disc(q.x,q.z,2.5,[.16,.42,1.0],.42,q.x);
 if(r.quality!=='low')for(const[x,y,z,s]of r.v40Frag||[])disc(x,z,.55+s*3,[.14,.40,1.0],.55,x+z);
 const c=r.v40Camp;if(c)for(const[x,z]of c.lights)disc(x,z,1.0,[1.0,.58,.22],.55,x);
 const sr=ch===1?3.25:2.45;disc(4,-5+sr+1.6,2.4,[1.0,.60,.25],.75,0);disc(4,-5+sr+3.6,3.4,[1.0,.58,.24],.22,2);disc(-5,-2,4.6,[.9,.55,.25],.18,1);
 if(c){for(let i=1;i<10;i++){const a=i/10*TAU;disc(4+Math.sin(a)*(sr+2.0),-5+Math.cos(a)*(sr+2.0),1.9,[1.0,.62,.28],.42,i);}for(const[x,z,k]of c.posts)disc(x,z,1.15,k===1?[.2,.5,1.0]:[1.0,.6,.25],.42,x);disc(44,48.4+3.2,2.2,[1.0,.62,.28],.42,3);disc(44-3.1,48.4,1.6,[1.0,.62,.28],.25,4);disc(44+3.1,48.4,1.6,[1.0,.62,.28],.25,5);}
 if(Core.contractMarkers)for(const m of Core.contractMarkers(state))if(m.type==='sample')disc(m.x,m.z,2.2,[.16,.42,1.0],.8,m.x);
 return new Float32Array(out);}
R.scene=function(state,p,t,...args){const out=old.scene.call(this,state,p,t,...args),ch=state.chapter;this.ensureWorldModels();this.v40Static(ch);const low=this.quality==='low';
 this.put('v40_ridges',this.eye[0],0,this.eye[2],1,1,1,[.46,.47,.50],0,29);
 this.put('v40_tracks_'+ch,0,0,0,1,1,1,[.065,.065,.07],0,28);this.put('v42_berms_'+ch,0,0,0,1,1,1,[.66,.64,.60],0,28);
 if(!low)this.put('v40_rubble_'+ch,0,0,0,1,1,1,[.56,.56,.575],0,4);
 for(const[shape,mat]of this.v40CampShapes){const[kind,col]=MATS[mat]||[0,[.5,.5,.5]];const blink=mat==='blue'?.55+.45*Math.max(0,Math.sin(t*2.2)):mat==='amber'?.48:0;this.put(shape,0,0,0,1,1,1,col,0,kind,blink);}
 if(!low)this.put('v40_frag_'+ch,0,0,0,1,1,1,[.10,.42,1.0],0,13,.30+.08*Math.sin(t*1.3));
 return out;};
R.render=function(state,p,t,dt,yaw,pitch,scan){old.render.call(this,state,p,t,dt,yaw,pitch,scan);const v=this.initHorizons();if(!v.ok||!this.vp)return;const gl=this.gl,low=this.quality==='low';
 this.drawRidgeStrip();const key=state.chapter+':'+state.collected.length+':'+this.quality+':'+(Core.contractMarkers?Core.contractMarkers(state).length:0);if(key!==v.key){v.key=key;v.data=poolData(this,state);gl.bindBuffer(gl.ARRAY_BUFFER,v.buf);gl.bufferData(gl.ARRAY_BUFFER,v.data,gl.STATIC_DRAW);}
 gl.useProgram(v.p);gl.uniformMatrix4fv(v.vp,false,this.vp);gl.uniform1f(v.time,t);gl.bindBuffer(gl.ARRAY_BUFFER,v.buf);gl.enable(gl.DEPTH_TEST);gl.depthMask(false);gl.disable(gl.CULL_FACE);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(-2,-8);
 gl.enableVertexAttribArray(v.pos);gl.vertexAttribPointer(v.pos,3,gl.FLOAT,false,40,0);gl.enableVertexAttribArray(v.info);gl.vertexAttribPointer(v.info,4,gl.FLOAT,false,40,12);gl.enableVertexAttribArray(v.tint);gl.vertexAttribPointer(v.tint,3,gl.FLOAT,false,40,28);gl.drawArrays(gl.TRIANGLES,0,v.data.length/10);gl.disableVertexAttribArray(v.pos);gl.disableVertexAttribArray(v.info);gl.disableVertexAttribArray(v.tint);gl.disable(gl.POLYGON_OFFSET_FILL);
 // extra halos through the v31 billboard program (premultiplied additive)
 const a=this.atmo;if(a&&a.ok){const Bq=[],quad=(x,y,z,size,r,g,b,w)=>{for(const[u,q]of[[-1,-1],[1,-1],[1,1],[-1,-1],[1,1],[-1,1]])Bq.push(x,y,z,u,q,size,0,r,g,b,w);},ch=state.chapter,h=(x,z)=>this.terrain(x,z,ch),pulse=.85+.15*Math.sin(t*2.1);
  for(const q of Core.resources){if(q.type!=='crystals'||state.collected.includes(q.id))continue;if(Math.hypot(q.x-this.eye[0],q.z-this.eye[2])>70)continue;quad(q.x,h(q.x,q.z)+.95,q.z,3.8,.20,.45,1.0,-.30*pulse);}
  const c=this.v40Camp;if(c){const tb=.55+.45*Math.max(0,Math.sin(t*2.2));quad(c.tower[0],h(...c.tower)+6.0,c.tower[1],2.6,.25,.6,1.0,-.75*tb);quad(c.tower[0],h(...c.tower)+6.0,c.tower[1],.9,.7,.9,1.0,-.9*tb);
   if(!low)for(const[x,z]of c.lights)quad(x,h(x,z)+.24,z,.55,1.0,.62,.25,-.55);quad(c.dish[0]-.5,h(...c.dish)+2.5,c.dish[1]-.5,.5,.4,.8,1.0,-.5*(.5+.5*Math.sin(t*3.1)));
   c.posts.forEach(([x,z,k],i)=>{const bl=.45+.55*Math.max(0,Math.sin(t*2.6+i*1.7)),y=h(x,z)+1.88;if(k===1){quad(x,y,z,1.5,.25,.6,1.0,-.65*bl);quad(x,y,z,.42,.7,.9,1.0,-.9*bl);}else{quad(x,y,z,1.4,1.0,.6,.25,-.6*bl);quad(x,y,z,.40,1.0,.85,.6,-.9*bl);}});
   if(!low)for(const line of c.cables)for(let i=0;i<line.length-1;i++){const[a0,a1]=[line[i],line[i+1]],L=Math.hypot(a1[0]-a0[0],a1[1]-a0[1]);for(let d=.45;d<L;d+=.9){const x=a0[0]+(a1[0]-a0[0])*d/L,z=a0[1]+(a1[1]-a0[1])*d/L;quad(x,h(x,z)+.09,z,.32,1.0,.62,.25,-.55*pulse);}}}
  const sr=state.chapter===1?3.25:2.45;quad(4,h(4,-5)+1.9,-5+sr+.5,3.4,1.0,.62,.25,-.16);
  if(!low){for(const[x,y,z,s]of this.v40Frag||[])if(Math.hypot(x-this.eye[0],z-this.eye[2])<45)quad(x,y+s*.6,z,.55+s*4,.18,.45,1.0,-.45*pulse);
   if(ch>=2)for(const id of['beacon1','beacon2','beacon3'])if(state.beacons.includes(id)){const[x,z]=Core.POINTS[id];quad(x,h(x,z)+3.45,z,1.8,.3,.65,1.0,-.6*pulse);}}
  if(Bq.length){const data=new Float32Array(Bq);gl.useProgram(a.bp);gl.uniformMatrix4fv(a.bpVP,false,this.vp);gl.uniform3fv(a.bpRight,[Math.cos(yaw),0,-Math.sin(yaw)]);gl.bindBuffer(gl.ARRAY_BUFFER,v.bill);gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
   gl.enableVertexAttribArray(a.bpPos);gl.vertexAttribPointer(a.bpPos,3,gl.FLOAT,false,44,0);gl.enableVertexAttribArray(a.bpCorner);gl.vertexAttribPointer(a.bpCorner,4,gl.FLOAT,false,44,12);gl.enableVertexAttribArray(a.bpTone);gl.vertexAttribPointer(a.bpTone,4,gl.FLOAT,false,44,28);gl.drawArrays(gl.TRIANGLES,0,data.length/11);gl.disableVertexAttribArray(a.bpPos);gl.disableVertexAttribArray(a.bpCorner);gl.disableVertexAttribArray(a.bpTone);}}
 gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(true);gl.disable(gl.BLEND);};
root.MoonHorizons={CLUSTERS,camp,ridgeData,rockVariant};
})(globalThis);
