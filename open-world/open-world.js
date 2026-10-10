/* Solid lunar landmarks and distinct districts, sharing authored collision bounds. */
(function(root){'use strict';const R=root.MoonRenderer.prototype,Core=root.MoonCore,B=root.MoonOutpostBuilder,draw=root.MoonOutpostAssembly,ensure=R.ensureWorldModels,scene=R.scene,blocked=R.blocked;
const ARCH={x:-55,z:-58,width:11,height:7.8,opening:2.5,pier:3.7,depth:1.0,clearance:4.7};
function arch(renderer){const b=new B(),segments=40,point=(i,inner,side)=>{const a=i*Math.PI/segments,r=inner?2.5+.045*Math.sin(i*1.7):5.42+.15*Math.sin(i*.8)+.13*Math.cos(i*1.9),xx=Math.cos(a)*r,yy=2.2+Math.sin(a)*r,zz=side*(.88+.10*Math.sin(i*.73)+(inner?0:.12*Math.sin(i*1.1)));return[xx,yy,zz];};
 for(let i=0;i<segments;i++){const a=point(i,false,1),bb=point(i+1,false,1),c=point(i+1,true,1),d=point(i,true,1),aa=point(i,false,-1),bbb=point(i+1,false,-1),cc=point(i+1,true,-1),dd=point(i,true,-1);b.quad('stone',a,bb,c,d,[0,0,1]);b.quad('stone',dd,cc,bbb,aa,[0,0,-1]);b.quad('stone',aa,bbb,bb,a);b.quad('stone',d,c,cc,dd);}
 const stone=b.groups.get('stone');for(const side of[-1,1])for(let j=0;j<3;j++){const m=root.MoonRenderMath.model(side*(4.02+(j%2)*.17),.71+j*.38,(j-1)*.18,1.47-j*.05,1.18-j*.12,1.11,side*.17+j*.23);root.MoonPremiumWorld.appendMesh(stone,renderer.meshes['geology'+(j%3)].data,m);}
 return b;
}
function track(renderer,key,points,ch){if(!renderer.meshes[key]){const data=[],lanes=[[-1.30,0],[-.62,1],[.62,1],[1.30,0]],total=points.slice(1).reduce((s,p,i)=>s+Math.hypot(p[0]-points[i][0],p[1]-points[i][1]),0);let run=0;for(let i=0;i<points.length-1;i++){const[a,b]=[points[i],points[i+1]],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),nx=-dz/length*.78,nz=dx/length*.78,steps=Math.ceil(length/.8);for(let j=0;j<steps;j++){const t0=j/steps,t1=(j+1)/steps,s0=run+length*t0,s1=run+length*t1,fade=s=>Math.min(1,s/2.5,(total-s)/2.5)*(.72+.28*Math.sin(s*.9+Math.sin(s*.37)*2.)),v=(t,lane,s)=>{const x=a[0]+dx*t+nx*lane[0],z=a[1]+dz*t+nz*lane[0],al=Math.max(0,lane[1]*fade(s)*.62);return[x,Core.height(x,z,ch)+.02,z,0,Math.max(al,.0001),0];};for(let l=0;l<3;l++){const q=[v(t0,lanes[l],s0),v(t1,lanes[l],s1),v(t1,lanes[l+1],s1),v(t0,lanes[l+1],s0)];for(const k of[0,2,1,0,3,2])data.push(...q[k]);}}run+=length;}renderer.addMesh(key,data);}renderer.put(key,0,0,0,1,1,1,[.17,.16,.15],0,28);}
R.ensureWorldModels=function(){ensure.call(this);if(this.outerRegionsReady)return;this.outerRegionsReady=true;for(const region of Core.REGIONS)for(let i=0;i<14;i++){const a=i*Math.PI*2/14,x=region.x+Math.sin(a)*17,z=region.z+Math.cos(a)*17,s=1.1+(i%3)*.45;if(Object.values(Core.POINTS).some(p=>Math.hypot(x-p[0],z-p[1])<s+3.3))continue;this.rocks.push({x,z,s,h:1.4+(i%4)*.45,r:i*.73});}this.rocks=this.rocks.filter(r=>r.x>3||r.x<-56||Math.abs(r.z+5-(r.x-4)*.898)>r.s+3);};
R.scene=function(state,p,t,...args){const out=scene.call(this,state,p,t,...args),ch=state.chapter;
 draw(this,'lunar_arch_v27',()=>arch(this),ARCH.x,this.terrain(ARCH.x,ARCH.z,ch),ARCH.z);
 // Pressed regolith paths make the camp's work areas legible without covering the landscape.
 track(this,'camp_route_'+ch,[[0,13],[0,4],[-1,0],[-2,-8],[-5,-13],[-5,-20]],ch);
 track(this,'lab_route_'+ch,[[1,4],[3,1],[7,-1],[7,-6]],ch);
 if(ch===3){this.terminal(35,50,3,[.1,.8,1]);this.terminal(40,52,3,state.vaultOpen?[.9,.7,.3]:[.1,.8,1]);}
 for(const region of Core.REGIONS){if(Math.hypot(p.x-region.x,p.z-region.z)>72)continue;this.supplyContainer(region.x-3,region.z+2,ch);this.solarArray(region.x+4,region.z-3,ch);
  if(region.id==='research'){this.scienceAntenna(region.x,region.z-6,ch,true);this.habitat(44,48,ch);for(const[x,z]of[[32,57],[38,57]])this.beaconMast(x,z,ch,[.10,.55,.72],true);}
  else this.terminal(region.x,region.z-5,ch,[.1,.8,1]);
  if(region.id==='crater'){for(const[x,z]of[[-60,-48],[-50,-48]])this.supplyContainer(x,z,ch);this.powerCell(-60,-52,ch);}
  if(region.id==='valley')for(const r of Core.resources.filter(q=>q.type==='crystals'&&Math.hypot(q.x-region.x,q.z-region.z)<8).slice(0,3))this.put('geology2',r.x,this.terrain(r.x,r.z,ch)-.10,r.z,.95,.26,.8,[.30,.34,.36],r.x,4);
 }
 if(Core.contractMarkers)for(const marker of Core.contractMarkers(state)){const h=this.terrain(marker.x,marker.z,ch);if(marker.type==='sample'){this.put('crystal2',marker.x,h+.76,marker.z,.27,1.44,.22,[.05,.30,1.0],marker.x*.2,13,.17);this.put('geology1',marker.x,h+.10,marker.z,.48,.23,.46,[.32,.34,.36],0,4);}else if(marker.type==='cache')this.supplyContainer(marker.x,marker.z,ch);else if(marker.type==='relay')this.terminal(marker.x,marker.z,ch,[.05,.75,.90]);else if(marker.type==='checkpoint'){if(marker.id==='flight2')this.put('ring',marker.x,h+2.20,marker.z,1.40,1,1.40,[.12,.72,.85],0,12,.28,Math.PI/2);else this.put('ring',marker.x,h+.04,marker.z,1.65,1,1.65,[.12,.72,.85],0,12,.28);this.beaconMast(marker.x,marker.z,ch,[.1,.62,.85],true);}}
 return out;};
function archBlocked(renderer,x,z,state,alt,bodyHeight){const dx=Math.abs(x-ARCH.x),dz=Math.abs(z-ARCH.z);if(dz>=ARCH.depth+.22||dx>=ARCH.width/2+.22)return false;const y=renderer.terrain(x,z,state.chapter)+alt-renderer.terrain(ARCH.x,ARCH.z,state.chapter),outer=2.2+Math.sqrt(Math.max(0,(5.5+.22)**2-dx*dx))+.10,inner=dx<ARCH.opening-.22?2.2+Math.sqrt(Math.max(0,(ARCH.opening-.22)**2-dx*dx)):0;return y<outer&&y+bodyHeight>=inner;}
R.blocked=function(x,z,state,alt=0){if(alt<3.2&&Math.abs(x-44)<1.97&&Math.abs(z-48)<1.48)return true;return archBlocked(this,x,z,state,alt,2.35)||blocked.call(this,x,z,state,alt);};
R.cameraBlocked=function(x,z,state,alt=0){if(alt<3.2&&Math.abs(x-44)<1.97&&Math.abs(z-48)<1.48)return true;return archBlocked(this,x,z,state,alt,0)||blocked.call(this,x,z,state,alt);};
root.MoonWorldLandmarks={ARCH};
})(globalThis);
