/* Authored 360-degree equipment, architecture and material batches. */
(function(root){'use strict';
const R=root.MoonRenderer.prototype,B=root.MoonOutpostBuilder,C=root.MoonOutpostColors,draw=root.MoonOutpostAssembly;
const nativeHabitat=R.habitat,nativeCrystal=R.crystalDeposit;
C.gold=[.80,.56,.27];C.ivory=[.84,.865,.87];C.panel=[.89,.915,.92];C.stone=[.49,.49,.47];C.ore=[.46,.43,.36];
function residence(){const b=new B();
 b.box('steel',0,.12,0,3.72,.24,2.82);b.box('panel',0,1.44,0,3.48,2.48,2.60);b.box('ivory',0,2.76,0,3.56,.22,2.68);
 for(const side of[-1,1]){b.box('gold',side*1.69,1.49,1.30,.065,2.35,.066);b.box('gold',side*1.69,1.49,-1.30,.065,2.35,.066);b.box('gold',0,2.70,side*1.30,3.46,.045,.065);b.box('steel',0,.30,side*1.32,3.46,.065,.055);}
 // Layered airlock and a real recessed warm corridor.
 for(let i=0;i<3;i++){const z=1.55-i*.18;b.ring(i?'steel':'ivory',0,1.38,z,.64,1.08,.13,.15,8);b.ring('gold',0,1.38,z+.09,.57,.96,.060,.025,8);b.ring('amber',0,1.38,z+.11,.535,.915,.018,.019,8);}
 b.box('dark',0,1.38,1.32,1.10,1.85,.035);b.box('gold',-.42,1.35,1.06,.021,1.60,.014);b.box('blue',-.38,1.35,1.072,.038,.39,.011);
 for(const side of[-1,1]){b.box('gold',side*1.08,1.67,1.328,.74,.74,.07);b.box('dark',side*1.08,1.67,1.370,.65,.64,.015);b.box('glass',side*1.08,1.67,1.389,.58,.56,.012);b.box('steel',side*1.08,1.67,1.399,.022,.56,.012);b.box('amber',side*1.08,1.39,1.399,.56,.022,.012);for(let j=0;j<4;j++)b.tube('steel',[side*1.46,.61+j*.48,1.329],[side*1.46,.61+j*.48,1.346],.019,8);}
 // Rear service hatch and side windows make every approach deliberate.
 b.box('gold',0,1.37,-1.324,.93,1.45,.043);b.box('dark',0,1.37,-1.356,.85,1.36,.024);b.box('panel',0,1.37,-1.372,.74,1.25,.015);b.box('steel',.29,1.37,-1.389,.08,.13,.02);
 for(const side of[-1,1])for(const z of[-.64,.54]){b.box('gold',side*1.76,1.65,z,.058,.69,.81);b.box('glass',side*1.797,1.65,z,.019,.58,.71);b.box('steel',side*1.813,1.65,z,.016,.58,.019);}
 for(let j=0;j<4;j++){b.box('steel',0,.26-j*.052,1.50+j*.16,1.46,.07,.22);b.box('gold',0,.304-j*.052,1.59+j*.16,1.44,.018,.023);}
 for(const side of[-1,1]){b.tube('gold',[side*.73,.14,2.04],[side*.73,.61,2.04],.025,12);b.tube('gold',[side*.73,.62,2.04],[side*.73,.86,1.37],.029,16);b.tube('ivory',[side*1.59,2.80,-.92],[side*1.59,3.26,-.92],.07,20);b.tube('gold',[side*1.59,3.10,-.92],[side*1.59,3.15,-.92],.085,20);}
 for(let i=0;i<8;i++)b.box('steel',0,2.88,-1.04+i*.30,3.20,.015,.018);b.paw(0,2.52,1.345,.60,'gold');b.text('HABITAT',0,2.27,1.348,.13,'dark');
 return b;
}
R.habitat=function(x,z,ch){if(x===4)return nativeHabitat.call(this,x,z,ch);this.ensureWorldModels();const y=this.terrain(x,z,ch);draw(this,'residence_v27',residence,x,y,z);this.put('cube',x,y+1.38,z+1.346,1.03,1.76,.011,[1,1,1],0,25);for(const side of[-1,1])this.put('cube',x+side*1.08,y+1.67,z+1.398,.57,.54,.008,[1,1,1],0,24);for(const side of[-1,1])for(const dz of[-.64,.54])this.put('cube',x+side*1.812,y+1.65,z+dz,.65,.53,.011,[1,1,1],side*Math.PI/2,24);};
function workshop(){const b=new B();b.box('steel',0,.15,0,2.42,.28,1.74);b.box('panel',0,.79,-.24,2.12,1.12,.92);b.box('gold',0,1.38,-.24,2.16,.065,.96);b.box('steel',0,.96,.54,2.19,.14,1.31);b.box('dark',0,1.042,.56,2.07,.025,1.13);for(const side of[-1,1]){b.box('gold',side*1.04,.70,.48,.07,.57,1.10);b.box('glass',side*.67,.77,-.724,.46,.42,.019);b.box('steel',side*.72,.72,-.742,.018,.41,.025);for(let i=0;i<6;i++)b.box('steel',side*.67,.36+i*.043,.233,.44,.014,.025);}b.tube('ivory',[.65,1.41,-.32],[.65,2.25,-.32],.052,20);b.tube('gold',[.65,2.24,-.32],[.04,2.24,.17],.043,16);b.tube('steel',[.04,2.24,.17],[.04,1.40,.17],.021,16);b.tube('gold',[.04,1.54,.17],[.04,1.48,.17],.043,16,.016);b.paw(0,.70,-.751,.64,'gold');b.text('LAB',0,1.68,-.753,.16,'dark');return b;}
R.workshopBench=function(x,z,ch,level){draw(this,'workshop_v27',workshop,x,this.terrain(x,z,ch),z);for(let i=0;i<level;i++)this.put('crystal',x-.70+i*.45,this.terrain(x,z,ch)+1.22,z+.56,.08,.21,.07,[.10,.40,1.0],0,13,.15);};
function beacon(){const b=new B();b.box('steel',0,.10,0,.84,.20,.76);for(const side of[-1,1]){b.tube('gold',[side*.32,.19,.23],[0,1.17,0],.032,12);b.tube('gold',[side*.32,.19,-.23],[0,1.17,0],.032,12);}b.tube('ivory',[0,.20,0],[0,3.22,0],.093,24);for(let j=0;j<5;j++)b.tube('gold',[0,.55+j*.52,0],[0,.61+j*.52,0],.12,24);b.tube('steel',[0,3.18,0],[0,3.29,0],.25,24);b.tube('blue',[0,3.31,0],[0,3.54,0],.205,32);b.tube('gold',[0,3.55,0],[0,3.65,0],.25,24,.03);for(const side of[-1,1]){b.box('gold',side*.36,2.97,0,.52,.055,.31);b.box('solar',side*.36,3.002,0,.47,.013,.27);}return b;}
R.beaconMast=function(x,z,ch,color,on){draw(this,'beacon_v27',beacon,x,this.terrain(x,z,ch),z,color.map(v=>v*(on?1:.32)));};
R.metalDeposit=function(resource,ch){this.ensureWorldModels();const id=Number(resource.id.slice(3)),shape='ore_v27_'+id,y=this.terrain(resource.x,resource.z,ch);if(!this.meshes[shape]){const data=[];for(let i=0;i<5;i++){const mesh=this.meshes['geology'+i%4].data,scale=.13+(i%3)*.052,m=root.MoonRenderMath.model(Math.sin(i*2.4)*.25,.11+i*.017,Math.cos(i*2.4)*.22,scale,.12+scale*.45,scale,id*.73+i);appendMesh(data,mesh,m);}this.addMesh(shape,data);}this.put(shape,resource.x,y,resource.z,1,1,1,[.47,.46,.40],0,23);};
function appendMesh(dst,data,m){const sc=[0,4,8].map(i=>m[i]**2+m[i+1]**2+m[i+2]**2);for(let i=0;i<data.length;i+=6){const p=data.slice(i,i+3),v=[data[i+3]/sc[0],data[i+4]/sc[1],data[i+5]/sc[2]],n=[m[0]*v[0]+m[4]*v[1]+m[8]*v[2],m[1]*v[0]+m[5]*v[1]+m[9]*v[2],m[2]*v[0]+m[6]*v[1]+m[10]*v[2]],len=Math.hypot(...n)||1;dst.push(m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14],...n.map(x=>x/len));}}
// Eight distinct crystal shards remain geometry, submitted as one transparent deposit.
R.crystalDeposit=function(resource,ch,t){this.ensureWorldModels();const before=this.queue.length;nativeCrystal.call(this,resource,ch,t);const all=this.queue.splice(before),shards=all.filter(o=>o.kind===13),base=all.filter(o=>o.kind!==13),shape='mineral_v27_'+ch+'_'+resource.id,x=resource.x,z=resource.z,y=this.terrain(x,z,ch);if(!this.meshes[shape]){const data=[];for(const o of shards){const m=Array.from(o.m);m[12]-=x;m[13]-=y;m[14]-=z;appendMesh(data,this.meshes[o.shape].data,m);}this.addMesh(shape,data);}this.queue.push(...base);this.put(shape,x,y,z,1,1,1,[.05,.30,1.0],0,13,.10);};
// Match the smaller authored residence and mechanical equipment footprints.
const oldBlocked=R.blocked;R.blocked=function(x,z,state,alt=0){
 if(state.chapter>=2&&state.buildings.includes('habitat')&&Math.abs(x+5)<1.98&&Math.abs(z+7)<1.56&&alt<3.35)return true;
 if(state.chapter>=2&&state.buildings.includes('workshop')&&Math.abs(x+10)<1.38&&Math.abs(z+6)<1.08&&alt<2.40)return true;
 if(state.chapter>=2&&state.buildings.includes('solar'))for(let i=0;i<1+(state.cards?.solar||1);i++)if(Math.abs(x+5)<1.72&&Math.abs(z+14+i*2)<1.05&&alt<2.20)return true;
 const smallResidence=state.chapter>=2&&state.buildings.includes('habitat')&&Math.hypot(x+5,z+7)<6,collisionState=smallResidence?{...state,buildings:state.buildings.filter(id=>id!=='habitat')}:state;
 return oldBlocked.call(this,x,z,collisionState,alt);
};
const baseScene=R.scene;
R.scene=function(state,p,...args){const out=baseScene.call(this,state,p,...args),ch=state.chapter,key='contact_dust_'+ch;if(!this.meshes[key]){const data=[],stamp=(x,z,rx,rz,alpha)=>{for(let i=0;i<16;i++){const a=i*Math.PI/8,b=(i+1)*Math.PI/8;for(const [xx,zz,ao]of[[x,z,alpha],[x+Math.cos(b)*rx,z+Math.sin(b)*rz,.005],[x+Math.cos(a)*rx,z+Math.sin(a)*rz,.005]])data.push(xx,this.terrain(xx,zz,ch)+.024,zz,0,ao,0);}};stamp(-5,-2,1.85,1.8,.85);stamp(4,4,1.12,1.32,.85);stamp(4,-5,2.65,2.75,.85);stamp(4,-1.9,1.25,.85,.75);stamp(-5,-7,2.12,1.70,.65);for(const z of[-14,-16,-18])stamp(-5,z,1.72,1.05,.48);for(let z=5;z<17;z+=.8)for(const x of[3.18,4.82])stamp(x,z,.13,.64,.28);this.addMesh(key,data);}this.put(key,0,0,0,1,1,1,[.09,.105,.13],0,28);return out;};
root.MoonPremiumWorld={appendMesh};
})(globalThis);
