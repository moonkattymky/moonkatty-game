/* v32 model detail pass: extra bevels, seams, rivets, struts, frames and lights for the white-ceramic / gold / amber outpost set.
   Detail is merged into the existing per-material meshes of each assembly, so it adds triangles but no draw calls. */
(function(root){'use strict';
const B=root.MoonOutpostBuilder,R=root.MoonRenderer.prototype,TAU=Math.PI*2;
// Copy every material group of src into dst; tf(p,n) may move a vertex (normals keep their baked AO length).
function merge(dst,src,tf){for(const[mat,data]of src.groups){let g=dst.groups.get(mat);if(!g)dst.groups.set(mat,g=[]);for(let i=0;i<data.length;i+=6){let p=[data[i],data[i+1],data[i+2]],n=[data[i+3],data[i+4],data[i+5]];if(tf)[p,n]=tf(p,n);g.push(p[0],p[1],p[2],n[0],n[1],n[2]);}}}
const place=(x,y,z,tilt=0)=>(p,n)=>{const c=Math.cos(tilt),s=Math.sin(tilt),rot=v=>[v[0],v[1]*c-v[2]*s,v[1]*s+v[2]*c],q=rot(p);return[[q[0]+x,q[1]+y,q[2]+z],rot(n)];};
const polar=(a,rr)=>[Math.sin(a)*rr,Math.cos(a)*rr];
function station(b,ch){const d=new B(),r=ch===1?3.25:2.45,h=ch===1?5.20:4.70,rx=ch===1?1.45:1.28,z=r+.27,Y=p=>.15+p*h;
 // Vertical pressure-panel seams with gold rivet rows between the window bays.
 for(let i=0;i<12;i++){const a=i*TAU/12;if(Math.cos(a)>.66)continue;const rr=r*1.012,[x,zz]=polar(a,rr),[xo,zo]=polar(a,rr+.016);d.box('steel',x,(Y(.07)+Y(.77))/2,zz,.035,Y(.77)-Y(.07),.022,a);for(let k=0;k<9;k++)d.box('gold',xo,Y(.09)+k*(Y(.75)-Y(.09))/8,zo,.05,.05,.02,a);}
 // Horizontal panel seams.
 for(const p of[.30,.55])d.shell('steel',[[1.006,p],[1.006,p+.007]],r,h,true);
 // Warm eave light strip under the dome band.
 for(let i=0;i<36;i++){const a=(i+.5)*TAU/36;if(Math.cos(a)>.80)continue;const[x,zz]=polar(a,r*1.02+.02);d.box('amber',x,Y(.765),zz,.20,.035,.03,a);}
 // Foundation feet with gold caps and dark anchor plates.
 for(let i=0;i<10;i++){const a=(i+.5)*TAU/10;if(Math.cos(a)>.75)continue;const rr=r+.16,[x,zz]=polar(a,rr),[xa,za]=polar(a,rr+.235);d.box('steel',x,.12,zz,.42,.24,.46,a);d.box('gold',x,.255,zz,.44,.035,.48,a);d.box('dark',xa,.12,za,.30,.10,.012,a);}
 // Airlock warning lamps above the gold door pillars.
 for(const s of[-1,1]){const x=s*(rx+.15);d.tube('steel',[x,2.86,z-.10],[x,2.86,z+.06],.085,12);d.tube('amber',[x,2.86,z+.06],[x,2.86,z+.12],.068,12);d.box('gold',x,2.70,z-.02,.20,.035,.20);}
 // Roof communications dish on a short mast.
 {const a=-.94,[x,zz]=polar(a,r*.77),base=Y(1.0)-.06,dish=new B();d.tube('steel',[x,base,zz],[x,base+.62,zz],.035,10);d.tube('gold',[x,base,zz],[x,base+.08,zz],.09,14);
  dish.shell('ivory',[[0,-.15],[.45,-.11],[.8,-.03],[1,.05]],.46,1);dish.shell('gold',[[1,.05],[1.04,.075]],.46,1);dish.tube('steel',[0,0,0],[0,.36,0],.014,8);dish.tube('amber',[0,.36,0],[0,.42,0],.032,10);merge(d,dish,place(x,base+.60,zz,.42));}
 merge(b,d);}
function rocket(b){const d=new B(),h=8.7,r=1.05,P=y=>(y-.15)/h;
 for(const y of[4.40,5.55])d.shell('steel',[[1.006,P(y)],[1.006,P(y+.045)]],r,h);
 // RCS thruster pods (sides and back) with tangential nozzles.
 for(const a of[Math.PI/2,Math.PI,-Math.PI/2]){const[x,zz]=polar(a,r+.07),t=[Math.cos(a),0,-Math.sin(a)];d.box('ivory',x,5.95,zz,.24,.30,.16,a);d.box('gold',x,6.12,zz,.26,.035,.18,a);for(const s of[-1,1])d.tube('dark',[x+t[0]*s*.11,5.95,zz+t[2]*s*.11],[x+t[0]*s*.19,5.95,zz+t[2]*s*.19],.045,10,.06);}
 // Side crew hatch with gold frame, handle light and a boarding ladder.
 {const a=-1.31,[x,zz]=polar(a,r+.015),[xi,zi]=polar(a,r+.04),[xl,zl]=polar(a,r+.07);d.box('gold',x,3.12,zz,.64,1.0,.04,a);d.box('dark',xi,3.12,zi,.50,.84,.03,a);d.box('amber',xl,3.12,zl,.035,.20,.02,a);
  const t=[Math.cos(a),0,-Math.sin(a)],top=polar(a,1.13),foot=polar(a,1.72),pt=(f,s,y)=>[foot[0]+(top[0]-foot[0])*f+t[0]*s,y,foot[1]+(top[1]-foot[1])*f+t[2]*s];
  for(const s of[-.2,.2])d.tube('steel',pt(0,s,.18),pt(1,s,2.58),.028,8);for(let k=1;k<=8;k++){const f=k/9;d.tube('gold',pt(f,-.2,.18+f*2.40),pt(f,.2,.18+f*2.40),.02,6);}}
 // Gold reinforcement rings on the engine bell.
 for(const y of[.62,.95]){const rr=.36-(y-.39)/.92*.12+.012;d.tube('gold',[0,y,0],[0,y+.035,0],rr,32);}
 // Navigation lights at the leg roots and nose tip.
 for(let i=0;i<4;i++){const a=Math.PI/4+i*TAU/4,dx=Math.sin(a),dz=Math.cos(a);d.tube('amber',[dx*1.0,2.95,dz*1.0],[dx*1.07,2.95,dz*1.07],.05,10);}
 d.tube('amber',[0,9.72,0],[0,9.84,0],.04,10);
 merge(b,d,(p,n)=>{const ny=n[1]/.78,len=Math.hypot(n[0],n[1],n[2]),k=len/(Math.hypot(n[0],ny,n[2])||1);return[[p[0],p[1]*.78,p[2]],[n[0]*k,ny*k,n[2]*k]];});}
function rover(b){const d=new B();
 // Front bumper with fog lights and a tow hook.
 d.box('dark',0,.47,1.08,1.40,.10,.08);for(const s of[-1,1]){d.box('steel',s*.36,.47,1.115,.18,.075,.02);d.box('amber',s*.36,.47,1.128,.13,.045,.01);}d.tube('gold',[0,.43,1.12],[0,.43,1.20],.03,8);
 // Roof light bar.
 d.box('steel',0,1.40,.48,.96,.07,.12);for(let i=0;i<5;i++)d.box('amber',-.36+i*.18,1.40,.545,.12,.045,.02);for(const s of[-1,1])d.box('steel',s*.40,1.36,.48,.04,.06,.04);
 // Wheel fenders and side tool lockers with gold latches.
 for(const s of[-1,1]){for(const zz of[-.77,.01,.79])d.box('ivory',s*.80,.735,zz,.28,.05,.70);d.box('steel',s*.70,.80,-.70,.06,.22,.42);d.box('gold',s*.735,.80,-.70,.02,.05,.08);}
 // Rear bumper and tail lights.
 d.box('dark',0,.47,-1.08,1.40,.10,.08);for(const s of[-1,1])d.box('amber',s*.55,.62,-1.035,.14,.07,.02);
 merge(b,d,(p,n)=>[[p[0]*1.10,p[1]*1.10,p[2]*1.10],n]);}
function cargo(b){const d=new B();
 for(const s of[-1,1]){for(const y of[.30,.46,.62])d.box('steel',s*.49,y,0,.012,.025,.62);d.box('dark',s*.492,.68,0,.008,.08,.30);for(const zz of[-.435,.435])for(let k=0;k<4;k++)d.box('steel',s*.34,.25+k*.147,zz+Math.sign(zz)*.006,.03,.03,.012);}
 for(const sx of[-1,1])for(const sz of[-1,1])d.tube('gold',[sx*.38,.83,sz*.28],[sx*.38,.875,sz*.28],.035,10);
 d.box('blue',.36,.835,.33,.07,.03,.07);
 merge(b,d);}
function terminal(b){const d=new B();
 d.box('ivory',0,1.30,.43,.74,.05,.20);for(const sx of[-1,1])for(const y of[.76,1.18])d.box('steel',sx*.30,y,.40,.03,.03,.015);
 for(const sx of[-1,1])for(const sz of[-1,1]){d.box('steel',sx*.40,.03,sz*.33,.14,.06,.14);d.box('gold',sx*.40,.065,sz*.33,.10,.012,.10);}
 d.tube('amber',[-.25,1.29,.20],[-.25,1.36,.20],.04,10);
 for(const sx of[-1,1])for(let k=0;k<5;k++)d.box('dark',sx*.395,.55+k*.05,0,.012,.02,.36);
 merge(b,d);}
function antenna(b){const d=new B(),prof=[[0,6.44],[.32,6.50],[.70,6.56],[1,6.66]],dy=f=>{for(let i=1;i<prof.length;i++)if(f<=prof[i][0]){const[a,ya]=prof[i-1],[c,yc]=prof[i];return .15+ya+(yc-ya)*(f-a)/(c-a);}return .15+6.66;};
 for(let i=0;i<8;i++){const a=i*TAU/8,[x0,z0]=polar(a,.32*1.16),[x1,z1]=polar(a,1.16);d.tube('gold',[x0,dy(.32)+.02,z0],[x1,dy(1)+.02,z1],.016,6);}
 d.tube('gold',[0,7.40,0],[0,7.62,0],.07,14,.04);d.tube('amber',[0,7.62,0],[0,7.70,0],.05,10);
 for(const a of[Math.PI/2,Math.PI*7/6,Math.PI*11/6]){const[x,zz]=polar(a,1.12);d.tube('steel',[x,dy(1),zz],[0,7.45,0],.014,6);}
 for(let i=0;i<5;i++){const y1=1.30+i*.79,y2=y1+.79,s=i%2?1:-1;d.tube('steel',[s*(.7-y1*.075),y1,0],[-s*(.7-y2*.075),y2,0],.02,8);}
 for(const sx of[-1,1]){d.box('amber',sx*.5,.85,.583,.08,.05,.02);for(const sz of[-1,1])d.tube('steel',[sx*.92,.32,sz*.72],[sx*.92,.36,sz*.72],.04,8);}
 merge(b,d);}
const table={concept_habitat_1:b=>station(b,1),concept_habitat_2:b=>station(b,2),concept_rocket:rocket,concept_rover:rover,concept_cargo:cargo,terminal,solid_antenna:antenna};
root.MoonModelDetail={apply(key,b){const f=table[key];if(f&&b&&b.groups)f(b);return b;},keys:Object.keys(table)};
// Faceted hexagonal crystals (growth step + pyramidal tip) replace the 5-sided cones, same unit bounds.
function crystalMesh(tipX=0,tipZ=0,body=.40,top=.85){const a=[],ring=(y,s)=>Array.from({length:6},(_,i)=>{const t=i*TAU/6+.26;return[Math.cos(t)*s,y,Math.sin(t)*s];}),tri=(p,q,r)=>{const u=q.map((v,i)=>v-p[i]),v=r.map((x,i)=>x-p[i]);let n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];const c=[0,1,2].map(i=>(p[i]+q[i]+r[i])/3);if(n[0]*c[0]+n[1]*c[1]+n[2]*c[2]<0){[q,r]=[r,q];n=n.map(x=>-x);}const l=Math.hypot(...n)||1;for(const w of[p,q,r])a.push(...w,n[0]/l,n[1]/l,n[2]/l);};
 const r0=ring(-.5,.90),r1=ring(-.12,.97),r1i=ring(-.08,.91),r2=ring(body,1.0),r3=ring(body+(top-body)*.45,.62).map(p=>[p[0]+tipX*.45,p[1],p[2]+tipZ*.45]),apex=[tipX,top,tipZ];
 for(let i=0;i<6;i++){const j=(i+1)%6;for(const[lo,hi]of[[r0,r1],[r1,r1i],[r1i,r2]]){tri(lo[i],hi[j],lo[j]);tri(lo[i],hi[i],hi[j]);}tri(r2[i],r3[j],r2[j]);tri(r2[i],r3[i],r3[j]);tri(r3[i],apex,r3[j]);tri([0,-.5,0],r0[i],r0[j]);}
 return a;}
// Chiselled boulders: clamp the sculpted rock meshes against a few seeded planes so they gain flat fractured faces and crisp
// edges that catch the low sun (same triangle count, normals follow the new facets).
function chisel(data,seed){const out=data.slice(),rnd=k=>{const x=Math.sin(seed*127.1+k*311.7)*43758.5453;return x-Math.floor(x);},planes=[];
 for(let k=0;k<7;k++){const th=rnd(k)*Math.PI*2,y=k===0?.92:(rnd(k+20)*1.3-.45),r=Math.sqrt(Math.max(0,1-y*y)),d=[Math.cos(th)*r,y,Math.sin(th)*r];let mx=0;for(let i=0;i<data.length;i+=6)mx=Math.max(mx,data[i]*d[0]+data[i+1]*d[1]+data[i+2]*d[2]);planes.push({d,o:mx*(.70+rnd(k+40)*.16)});}
 for(let i=0;i<out.length;i+=6){let p=[out[i],out[i+1],out[i+2]],hit=null;for(const q of planes){const e=p[0]*q.d[0]+p[1]*q.d[1]+p[2]*q.d[2]-q.o;if(e>0){p=p.map((v,j)=>v-e*q.d[j]);hit=q;}}if(hit){out[i]=p[0];out[i+1]=p[1];out[i+2]=p[2];const l=Math.hypot(out[i+3],out[i+4],out[i+5])||1;out[i+3]=hit.d[0]*l;out[i+4]=hit.d[1]*l;out[i+5]=hit.d[2]*l;}}
 return out;}
const ROCKS={geology0:1,geology1:2,geology2:3,geology3:4,regolithStone:5};
const CRYSTALS={crystal:()=>crystalMesh(),crystal1:()=>crystalMesh(.16,.08,.36,.84),crystal2:()=>crystalMesh(-.05,.12,.28,.73)},addMesh=R.addMesh;
R.addMesh=function(key,data,...rest){if(CRYSTALS[key])data=CRYSTALS[key]();else if(ROCKS[key]&&data&&data.length)data=chisel(Array.from(data),ROCKS[key]);return addMesh.call(this,key,data,...rest);};
})(globalThis);
