/* v31 atmosphere: sun-cast soft shadow decals, additive crystal/lamp glow billboards and dust puffs.
   Two extra draw calls per frame (one shadow batch, one billboard batch); no framebuffers, no post-processing. */
(function(root){'use strict';
const R=root.MoonRenderer.prototype,Core=root.MoonCore,oldRender=R.render,oldDecals=R.drawGroundDecals;
const SUN=[.884,.468];// ground direction of cast shadows (away from key light vec3(-.85,.48,-.45))
const SV=`attribute vec3 position;attribute vec4 shape;uniform mat4 vp;varying vec4 s;void main(){s=shape;gl_Position=vp*vec4(position,1.);}`;
const SF=`precision mediump float;uniform vec3 tint;varying vec4 s;void main(){float L=s.w,t=clamp(s.x/max(L,.001),0.,1.);float rad=s.z*(1.-.30*t);float d=length(vec2(s.x-clamp(s.x,0.,L),s.y));float a=(1.-smoothstep(rad*.30,rad*1.28,d))*(1.-.55*t)*.92;if(a<.01)discard;gl_FragColor=vec4(tint,a*.80);}`;
const BV=`attribute vec3 position;attribute vec4 corner;attribute vec4 tone;uniform mat4 vp;uniform vec3 right;varying vec2 q;varying vec4 c;void main(){q=corner.xy;c=tone;vec3 w=position+right*corner.x*corner.z+vec3(0.,1.,0.)*corner.y*corner.z;gl_Position=vp*vec4(w,1.);}`;
// tone.a>0: soft dust (premultiplied alpha); tone.a<0: additive glow of strength -tone.a
const BF=`precision mediump float;varying vec2 q;varying vec4 c;void main(){float d=length(q);if(d>1.)discard;if(c.a<0.){float g=exp(-d*d*4.2)*(1.-smoothstep(.65,1.,d))+exp(-d*d*22.)*.6;gl_FragColor=vec4(c.rgb*g*-c.a,0.);}else{float a=(1.-smoothstep(.15,1.,d))*c.a;gl_FragColor=vec4(c.rgb*a,a);}}`;
function program(gl,vs,fs){const p=gl.createProgram();for(const[t,src]of[[gl.VERTEX_SHADER,vs],[gl.FRAGMENT_SHADER,fs]]){const sh=gl.createShader(t);gl.shaderSource(sh,src);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));gl.attachShader(p,sh);}gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;}
R.initAtmosphere=function(){if(this.atmo)return this.atmo;const gl=this.gl,a=this.atmo={ok:false,dust:[],shadowKey:'',last:null};try{
 a.sp=program(gl,SV,SF);a.spPos=gl.getAttribLocation(a.sp,'position');a.spShape=gl.getAttribLocation(a.sp,'shape');a.spVP=gl.getUniformLocation(a.sp,'vp');a.spTint=gl.getUniformLocation(a.sp,'tint');a.shadowBuffer=gl.createBuffer();
 a.bp=program(gl,BV,BF);a.bpPos=gl.getAttribLocation(a.bp,'position');a.bpCorner=gl.getAttribLocation(a.bp,'corner');a.bpTone=gl.getAttribLocation(a.bp,'tone');a.bpVP=gl.getUniformLocation(a.bp,'vp');a.bpRight=gl.getUniformLocation(a.bp,'right');a.billBuffer=gl.createBuffer();a.ok=true;
}catch(e){console.warn('MOONKATTY atmosphere fallback:',e.message);}return a;};
const SKIP=/^(terrain|scenery|contact_dust|camp_route|lab_route)/;
function casters(r,state){const groups=new Map(),ch=state.chapter;
 for(const o of r.queue){if(SKIP.test(o.shape)||o.kind===1||o.kind===3||o.kind===22||o.kind===28||o.kind===18||o.kind===12&&o.glow>.6)continue;const mesh=r.meshes[o.shape];if(!mesh?.center)continue;const m=o.m,c=mesh.center,e=mesh.extent;
  const center=[0,1,2].map(i=>m[i]*c[0]+m[4+i]*c[1]+m[8+i]*c[2]+m[12+i]),ext=[0,1,2].map(i=>Math.abs(m[i])*e[0]+Math.abs(m[4+i])*e[1]+Math.abs(m[8+i])*e[2]);
  const key=Math.round(m[12]*4)+','+Math.round(m[14]*4);let g=groups.get(key);if(!g)groups.set(key,g={x:m[12],z:m[14],lo:[1e9,1e9,1e9],hi:[-1e9,-1e9,-1e9]});for(let i=0;i<3;i++){g.lo[i]=Math.min(g.lo[i],center[i]-ext[i]);g.hi[i]=Math.max(g.hi[i],center[i]+ext[i]);}}
 const out=[];for(const g of groups.values()){const cx=(g.lo[0]+g.hi[0])/2,cz=(g.lo[2]+g.hi[2])/2,rad=Math.max(g.hi[0]-g.lo[0],g.hi[2]-g.lo[2])/2,ground=r.terrain(cx,cz,ch),h=g.hi[1]-ground;if(h<.22||rad>6.5||rad<.08)continue;out.push({x:cx,z:cz,r:rad*.82,h:Math.min(h,9),k:1});}
 for(const k of r.rocks)out.push({x:k.x,z:k.z,r:k.s*.75,h:k.h*.62,k:.9});
 return out;}
function buildShadows(r,state,list){const data=[],ch=state.chapter;
 for(const c of list){const L=Math.min(c.h*1.55,10),r0=c.r,a0=-r0*1.35,a1=L+r0*1.35,b0=-r0*1.35,b1=r0*1.35,na=Math.max(2,Math.min(9,Math.ceil((a1-a0)/1.4))),nb=Math.max(2,Math.min(4,Math.ceil((b1-b0)/1.6)));
  const vert=(a,b)=>{const x=c.x+SUN[0]*a-SUN[1]*b,z=c.z+SUN[1]*a+SUN[0]*b;return[x,r.terrain(x,z,ch)+.03,z,a,b,r0,L];};
  for(let j=0;j<nb;j++)for(let i=0;i<na;i++){const A=a0+(a1-a0)*i/na,AA=a0+(a1-a0)*(i+1)/na,Bv=b0+(b1-b0)*j/nb,BB=b0+(b1-b0)*(j+1)/nb,p=[vert(A,Bv),vert(AA,Bv),vert(AA,BB),vert(A,BB)];for(const k of[0,1,2,0,2,3])data.push(...p[k]);}}
 return new Float32Array(data);}
R.drawGroundDecals=function(vp,p,state){if(oldDecals)oldDecals.call(this,vp,p,state);const a=this.initAtmosphere();if(!a.ok)return;const gl=this.gl;
 const list=casters(this,state),key=state.chapter+':'+list.map(c=>(c.x*10|0)+'/'+(c.z*10|0)+'/'+(c.h*10|0)).join(',');
 if(key!==a.shadowKey){a.shadowData=buildShadows(this,state,list);a.shadowKey=key;gl.bindBuffer(gl.ARRAY_BUFFER,a.shadowBuffer);gl.bufferData(gl.ARRAY_BUFFER,a.shadowData,gl.STATIC_DRAW);a.casters=list.length;}
 gl.useProgram(a.sp);gl.uniformMatrix4fv(a.spVP,false,vp);gl.uniform3f(a.spTint,.025,.032,.06);gl.bindBuffer(gl.ARRAY_BUFFER,a.shadowBuffer);gl.enable(gl.DEPTH_TEST);gl.depthMask(false);gl.disable(gl.CULL_FACE);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(-2,-6);
 gl.enableVertexAttribArray(a.spPos);gl.vertexAttribPointer(a.spPos,3,gl.FLOAT,false,28,0);gl.enableVertexAttribArray(a.spShape);gl.vertexAttribPointer(a.spShape,4,gl.FLOAT,false,28,12);gl.drawArrays(gl.TRIANGLES,0,a.shadowData.length/7);gl.disableVertexAttribArray(a.spPos);gl.disableVertexAttribArray(a.spShape);
 gl.disable(gl.POLYGON_OFFSET_FILL);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(true);gl.disable(gl.BLEND);};
function spawnDust(a,x,y,z,n,spread,up,t){for(let i=0;i<n;i++){const ang=Math.random()*6.283,sp=spread*(.4+Math.random()*.6);a.dust.push({x:x+Math.cos(ang)*.12,y:y+.05,z:z+Math.sin(ang)*.12,vx:Math.cos(ang)*sp,vy:up*(.5+Math.random()*.5),vz:Math.sin(ang)*sp,age:0,life:.85+Math.random()*.6,s:.22+Math.random()*.14});}if(a.dust.length>72)a.dust.splice(0,a.dust.length-72);}
R.render=function(state,p,t,dt,yaw,pitch,scan){oldRender.call(this,state,p,t,dt,yaw,pitch,scan);const a=this.initAtmosphere();if(!a.ok||!this.vp)return;const gl=this.gl,ch=state.chapter,step=Math.min(dt||.016,.1);
 // dust: footfalls and landings
 const ground=this.terrain(p.x,p.z,ch);if(!a.last)a.last={x:p.x,z:p.z,alt:p.alt,side:1};const L=a.last;
 const startMove=p.speed>.12&&!L.moving;L.moving=p.speed>.12;if(p.alt<.12&&p.speed>.12&&(startMove||Math.hypot(p.x-L.x,p.z-L.z)>.55)){const side=L.side;spawnDust(a,p.x+Math.cos(p.yaw)*side*.16,ground,p.z-Math.sin(p.yaw)*side*.16,4,.6,.55,t);L.x=p.x;L.z=p.z;L.side=-side;}
 if(L.alt>.35&&p.alt<.12)spawnDust(a,p.x,ground,p.z,14,1.5,.45,t);L.alt=p.alt;
 const B=[],quad=(x,y,z,size,r,g,b,w)=>{for(const[u,v]of[[-1,-1],[1,-1],[1,1],[-1,-1],[1,1],[-1,1]])B.push(x,y,z,u,v,size,0,r,g,b,w);};
 for(const d of a.dust){d.age+=step;d.vx*=.94;d.vz*=.94;d.vy-=.35*step;d.x+=d.vx*step;d.y+=Math.max(d.vy,-.05)*step;d.z+=d.vz*step;}
 a.dust=a.dust.filter(d=>d.age<d.life);
 for(const d of a.dust){const k=d.age/d.life,alpha=Math.sin(Math.min(1,k*3)*1.57)*(1-k)*.55;quad(d.x,d.y+d.s*(.6+k*1.6),d.z,d.s*(1+k*2.4),.66,.61,.54,alpha*1.15);}
 // glow halos: crystals (bright blue), lamps (amber)
 const pulse=.88+.12*Math.sin(t*2.1);
 for(const r of Core.resources){if(r.type!=='crystals'||state.collected.includes(r.id))continue;if(Math.hypot(r.x-this.eye[0],r.z-this.eye[2])>75)continue;const y=this.terrain(r.x,r.z,ch);quad(r.x,y+.62,r.z,2.1,.22,.48,1.0,-.62*pulse);quad(r.x,y+.18,r.z,1.25,.30,.58,1.0,-.45*pulse);}
 if(Core.contractMarkers)for(const m of Core.contractMarkers(state))if(m.type==='sample'){const y=this.terrain(m.x,m.z,ch);quad(m.x,y+.8,m.z,1.9,.22,.48,1.0,-.55*pulse);}
 const lp=this.lampPositions,lc=this.lampColors;if(lp)for(let i=0;i<4;i++){const m=Math.max(lc[i*3],lc[i*3+1],lc[i*3+2]);quad(lp[i*3],lp[i*3+1],lp[i*3+2],1.5,lc[i*3]/m,lc[i*3+1]/m,lc[i*3+2]/m,-.22);}
 if(!B.length)return;const data=new Float32Array(B),right=[Math.cos(yaw),0,-Math.sin(yaw)];
 gl.useProgram(a.bp);gl.uniformMatrix4fv(a.bpVP,false,this.vp);gl.uniform3fv(a.bpRight,right);gl.bindBuffer(gl.ARRAY_BUFFER,a.billBuffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);
 gl.enable(gl.DEPTH_TEST);gl.depthMask(false);gl.disable(gl.CULL_FACE);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
 gl.enableVertexAttribArray(a.bpPos);gl.vertexAttribPointer(a.bpPos,3,gl.FLOAT,false,44,0);gl.enableVertexAttribArray(a.bpCorner);gl.vertexAttribPointer(a.bpCorner,4,gl.FLOAT,false,44,12);gl.enableVertexAttribArray(a.bpTone);gl.vertexAttribPointer(a.bpTone,4,gl.FLOAT,false,44,28);
 gl.drawArrays(gl.TRIANGLES,0,data.length/11);gl.disableVertexAttribArray(a.bpPos);gl.disableVertexAttribArray(a.bpCorner);gl.disableVertexAttribArray(a.bpTone);
 gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(true);gl.disable(gl.BLEND);this.stats&&(this.stats.fxShadowCasters=a.casters,this.stats.fxBillboards=data.length/66);};
})(globalThis);
