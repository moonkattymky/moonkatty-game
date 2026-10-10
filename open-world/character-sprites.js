(function(root){'use strict';
const atlas=root.MoonCharacterAtlas,R=root.MoonRenderer.prototype,originalCat=R.cat,originalScene=R.scene;
R.scene=function(...args){this.crewSprites=[];return originalScene.apply(this,args);};
const VERT=`attribute vec3 position;attribute vec2 texcoord;uniform mat4 vp;varying vec2 uv;varying vec3 W;void main(){uv=texcoord;W=position;gl_Position=vp*vec4(position,1.);}`;
const FRAG=`precision mediump float;uniform sampler2D spriteMap;uniform vec4 frameUV;uniform vec3 spriteRight;uniform vec3 eye;varying vec2 uv;varying vec3 W;void main(){vec4 c=texture2D(spriteMap,uv);if(c.a<.04)discard;vec2 q=(uv-frameUV.xy)/frameUV.zw*2.-1.;q.y=-q.y;vec3 front=vec3(-spriteRight.z,0.,spriteRight.x);vec3 n=normalize(spriteRight*q.x*.65+vec3(0.,q.y*.25,0.)+front*sqrt(max(.08,1.-q.x*q.x*.42-q.y*q.y*.12)));vec3 l=normalize(vec3(-.85,.48,-.45)),key=vec3(1.22,.98,.70);vec3 lit=pow(c.rgb,vec3(2.2));lit*=pow(max(dot(lit,vec3(.2126,.7152,.0722)),.04),-.12);vec3 fillDir=vec3(.66,.30,.69);lit*=vec3(.20,.24,.32)+vec3(.16,.22,.34)*max(dot(n,fillDir),0.)+key*max(dot(n,l),0.)*1.55;float sunSide=dot(l,spriteRight)>0.?1.:-1.;float edge=1.-texture2D(spriteMap,uv+frameUV.zw*vec2(sunSide*.018,-.008)).a;float edge2=1.-texture2D(spriteMap,uv+frameUV.zw*vec2(-sunSide*.012,-.004)).a;lit+=key*pow(c.rgb,vec3(1.4))*edge*(.55+.45*q.y*.5+.25)*.95+vec3(.10,.16,.28)*edge2*.18;float fog=1.-exp(-max(distance(eye,W)-15.,0.)*.021);lit=mix(lit,vec3(.060,.078,.118),fog*.80);lit*=1.18;lit=clamp((lit*(2.51*lit+.03))/(lit*(2.43*lit+.59)+.14),0.,1.);gl_FragColor=vec4(pow(lit,vec3(1./2.2)),c.a);}`;
const SHADOW=`precision mediump float;uniform float opacity;varying vec2 uv;void main(){float a=mix(-.62,2.35,uv.x),b=mix(-.62,.62,uv.y);float contact=exp(-(a*a+b*b)/.11);float sc=exp(-(pow(a-.95,2.)/.70+b*b/.10))*smoothstep(-.35,.25,a);float alpha=(contact*.90+sc*.85)*opacity*2.6;alpha=min(alpha,.88);if(alpha<.005)discard;gl_FragColor=vec4(.012,.016,.03,alpha);}`;
const CYCLES={down:[0,2,4,1,3,5],up:[0,2,3,5,1,4,1,4],left:[0,1,2,3,4,5],right:[0,1,2,3,4,5]};
function directionFor(playerYaw,cameraYaw,previous){const a=playerYaw-cameraYaw,centers={up:0,down:Math.PI,left:Math.PI/2,right:-Math.PI/2};if(previous in centers){const d=a-centers[previous];if(Math.abs(Math.atan2(Math.sin(d),Math.cos(d)))<Math.PI/4+.12)return previous;}const c=Math.cos(a),s=Math.sin(a);return Math.abs(c)>=Math.abs(s)?(c>0?'up':'down'):(s>0?'left':'right');}
R.initCharacterSprites=function(){
 if(this.characterSprite)return this.characterSprite;
 const gl=this.gl,s={ready:false,idleReady:false,failed:false,time:0,direction:'up',frame:0,mode:'idle',directionTextures:{}};this.characterSprite=s;
 try{
  const shader=(type,source)=>{const sh=gl.createShader(type);gl.shaderSource(sh,source);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));return sh;};
  s.program=gl.createProgram();gl.attachShader(s.program,shader(gl.VERTEX_SHADER,VERT));gl.attachShader(s.program,shader(gl.FRAGMENT_SHADER,FRAG));gl.linkProgram(s.program);if(!gl.getProgramParameter(s.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(s.program));
  s.position=gl.getAttribLocation(s.program,'position');s.uv=gl.getAttribLocation(s.program,'texcoord');s.vp=gl.getUniformLocation(s.program,'vp');s.map=gl.getUniformLocation(s.program,'spriteMap');s.frameUV=gl.getUniformLocation(s.program,'frameUV');s.right=gl.getUniformLocation(s.program,'spriteRight');s.eye=gl.getUniformLocation(s.program,'eye');s.buffer=gl.createBuffer();s.texture=gl.createTexture();
  s.shadowProgram=gl.createProgram();gl.attachShader(s.shadowProgram,shader(gl.VERTEX_SHADER,VERT));gl.attachShader(s.shadowProgram,shader(gl.FRAGMENT_SHADER,SHADOW));gl.linkProgram(s.shadowProgram);if(!gl.getProgramParameter(s.shadowProgram,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(s.shadowProgram));s.shadowPosition=gl.getAttribLocation(s.shadowProgram,'position');s.shadowUV=gl.getAttribLocation(s.shadowProgram,'texcoord');s.shadowVP=gl.getUniformLocation(s.shadowProgram,'vp');s.shadowOpacity=gl.getUniformLocation(s.shadowProgram,'opacity');s.shadowBuffer=gl.createBuffer();s.idleTexture=gl.createTexture();
  if(typeof Image==='undefined')return s;
  const upload=(texture,image)=>{
   let source=image;const reported=gl.getParameter(gl.MAX_TEXTURE_SIZE),limit=Math.min(Number.isFinite(reported)&&reported>0?reported:1024,1024);
   if(image.width>limit&&typeof document!=='undefined'){const canvas=document.createElement('canvas');canvas.width=limit;canvas.height=Math.round(image.height*limit/image.width);const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,canvas.width,canvas.height);source=canvas;}
   gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
   for(const key of[gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,key,gl.LINEAR);
   for(const key of[gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,key,gl.CLAMP_TO_EDGE);
  };
  const image=new Image();image.onload=()=>{try{upload(s.texture,image);s.ready=true;}catch(e){s.failed=true;}};image.onerror=()=>{s.failed=true;};image.src=atlas.image;s.image=image;
  const idle=new Image();idle.onload=()=>{try{upload(s.idleTexture,idle);s.idleReady=true;}catch(e){s.idleReady=false;}};idle.onerror=()=>{s.idleReady=false;};idle.src=atlas.idle.image;s.idleImage=idle;
  for(const [direction,row]of Object.entries(root.MoonCharacterWalkAtlas||{})){const item={texture:gl.createTexture(),ready:false};s.directionTextures[direction]=item;const frameImage=new Image();frameImage.onload=()=>{try{upload(item.texture,frameImage);item.ready=true;}catch(e){item.ready=false;}};frameImage.onerror=()=>{item.ready=false;};frameImage.src=row.image;item.image=frameImage;}
 }catch(e){s.failed=true;console.warn('MOONKATTY character sprite fallback:',e.message);}
 return s;
};
R.cat=function(x,z,yaw,t,moving,alt,ch,accent,hero,equipment){
 const sprite=this.initCharacterSprites();if(!sprite.ready||(!hero&&!sprite.idleReady))return originalCat.call(this,x,z,yaw,t,moving,alt,ch,accent,hero,equipment);
 if(!hero){(this.crewSprites||(this.crewSprites=[])).push({x,z,yaw,alt:alt||0,speed:0});return;}
 const ground=this.terrain(x,z,ch);
 if(alt>.15){const camera=Math.atan2(this.eye[0]-x,this.eye[2]-z);for(const side of[-1,1])this.put('cone',x+Math.cos(camera)*side*.20,ground+alt+.10,z-Math.sin(camera)*side*.20,.055,.38+Math.sin(t*35)*.04,.055,[.04,.7,1],0,0,1,Math.PI);}
};
R.drawCharacterShadow=function(vp,p,state,camera){
 const s=this.characterSprite,gl=this.gl,k=(.62+p.alt*.10)*(p.shadowScale||1),dx=.884,dz=.468;
 const point=(along,across,u,v)=>{const xx=p.x+dx*along*k-dz*across*k,zz=p.z+dz*along*k+dx*across*k;return[xx,this.terrain(xx,zz,state.chapter)+.075,zz,u,v];};
 const a=point(-.62,-.62,0,0),b=point(-.62,.62,0,1),c=point(2.35,.62,1,1),d=point(2.35,-.62,1,0);
 const shadowVertices=[...a,...b,...c,...a,...c,...d];if(root.MoonExportCapture)this.lastShadowVertices=shadowVertices;
 gl.useProgram(s.shadowProgram);gl.uniformMatrix4fv(s.shadowVP,false,vp);gl.uniform1f(s.shadowOpacity,.35/(1+p.alt*.55));gl.bindBuffer(gl.ARRAY_BUFFER,s.shadowBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(shadowVertices),gl.DYNAMIC_DRAW);
 gl.enable(gl.DEPTH_TEST);gl.depthMask(false);gl.disable(gl.CULL_FACE);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.enableVertexAttribArray(s.shadowPosition);gl.vertexAttribPointer(s.shadowPosition,3,gl.FLOAT,false,20,0);gl.enableVertexAttribArray(s.shadowUV);gl.vertexAttribPointer(s.shadowUV,2,gl.FLOAT,false,20,12);gl.drawArrays(gl.TRIANGLES,0,6);gl.disableVertexAttribArray(s.shadowPosition);gl.disableVertexAttribArray(s.shadowUV);gl.depthMask(true);gl.disable(gl.BLEND);
};
R.drawCrewSprites=function(vp,state){
 const s=this.characterSprite,gl=this.gl;if(!s||!s.idleReady)return;
 if(root.MoonExportCapture)this.crewSpriteFrames=[];
 for(const actor of this.crewSprites||[]){const camera=Math.atan2(this.eye[0]-actor.x,this.eye[2]-actor.z),direction=directionFor(actor.yaw,camera),f=atlas.idle.directions[direction],scale=2.35/f.bodyHeight,right=[Math.cos(camera),-Math.sin(camera)],base=this.terrain(actor.x,actor.z,state.chapter)+actor.alt+.025,left=-f.anchorX*scale,bottom=(f.anchorY-f.h)*scale,top=f.anchorY*scale,width=f.w*scale;
 const point=(x,y,u,v)=>[actor.x+right[0]*x,base+y,actor.z+right[1]*x,u,v],u0=f.x/atlas.idle.imageWidth,u1=(f.x+f.w)/atlas.idle.imageWidth,v0=f.y/atlas.idle.imageHeight,v1=(f.y+f.h)/atlas.idle.imageHeight;
 const a=point(left,top,u0,v0),b=point(left,bottom,u0,v1),c=point(left+width,bottom,u1,v1),d=point(left+width,top,u1,v0),vertices=[...a,...b,...c,...a,...c,...d];
 this.drawCharacterShadow(vp,actor,state,camera);
 if(root.MoonExportCapture)this.crewSpriteFrames.push({vertices,shadowVertices:this.lastShadowVertices,opacity:.35,frameUV:[u0,v0,u1-u0,v1-v0],spriteRight:[right[0],0,right[1]],shaders:root.MoonCharacterSpriteMath,image:atlas.idle.image});
 gl.useProgram(s.program);gl.uniformMatrix4fv(s.vp,false,vp);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,s.idleTexture);gl.uniform1i(s.map,0);gl.uniform4f(s.frameUV,u0,v0,u1-u0,v1-v0);gl.uniform3fv(s.right,[right[0],0,right[1]]);gl.uniform3fv(s.eye,this.eye);gl.bindBuffer(gl.ARRAY_BUFFER,s.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.DYNAMIC_DRAW);
 gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.disable(gl.CULL_FACE);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.enableVertexAttribArray(s.position);gl.vertexAttribPointer(s.position,3,gl.FLOAT,false,20,0);gl.enableVertexAttribArray(s.uv);gl.vertexAttribPointer(s.uv,2,gl.FLOAT,false,20,12);gl.drawArrays(gl.TRIANGLES,0,6);gl.disableVertexAttribArray(s.position);gl.disableVertexAttribArray(s.uv);gl.disable(gl.BLEND);
 }
};
R.drawCharacterSprites=function(vp,p,state,t,dt){
 const s=this.characterSprite;if(!s||!s.ready)return;this.drawCrewSprites(vp,state);
 const camera=Math.atan2(this.eye[0]-p.x,this.eye[2]-p.z),direction=directionFor(p.yaw,camera,s.direction);
 s.direction=direction;
 const walking=p.speed>.08&&p.alt<.15;
 s.time=walking?s.time+Math.min(dt,.2)*Math.min(p.speed,1):0;
 const detailed=s.directionTextures[direction]?.ready,row=detailed?root.MoonCharacterWalkAtlas[direction]:atlas.directions[direction],cycle=detailed?[0,1,2,3,4,5]:CYCLES[direction],useIdle=!walking&&s.idleReady;
 s.frame=walking?cycle[Math.floor(s.time*cycle.length)%cycle.length]:0;s.mode=useIdle?'idle':'walk';
 const f=useIdle?atlas.idle.directions[direction]:row.frames[s.frame],scale=2.35/(useIdle?f.bodyHeight:row.referenceHeight),right=[Math.cos(camera),-Math.sin(camera)],base=this.terrain(p.x,p.z,state.chapter)+p.alt+.025;
 const left=-f.anchorX*scale,bottom=(f.anchorY-f.h)*scale,top=f.anchorY*scale,width=f.w*scale;
 const point=(x,y,u,v)=>[p.x+right[0]*x,base+y,p.z+right[1]*x,u,v];
 const source=useIdle?atlas.idle:detailed?row:atlas; s.currentImage=source.image; const u0=f.x/source.imageWidth,u1=(f.x+f.w)/source.imageWidth,v0=f.y/source.imageHeight,v1=(f.y+f.h)/source.imageHeight;
 const a=point(left,top,u0,v0),b=point(left,bottom,u0,v1),c=point(left+width,bottom,u1,v1),d=point(left+width,top,u1,v0);this.spriteLight={frameUV:[u0,v0,u1-u0,v1-v0],spriteRight:[right[0],0,right[1]]};
 this.drawCharacterShadow(vp,p,state,camera);
 const gl=this.gl;gl.useProgram(s.program);gl.uniformMatrix4fv(s.vp,false,vp);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,useIdle?s.idleTexture:detailed?s.directionTextures[direction].texture:s.texture);gl.uniform1i(s.map,0);gl.uniform4f(s.frameUV,u0,v0,u1-u0,v1-v0);gl.uniform3fv(s.right,[right[0],0,right[1]]);gl.uniform3fv(s.eye,this.eye);gl.bindBuffer(gl.ARRAY_BUFFER,s.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([...a,...b,...c,...a,...c,...d]),gl.DYNAMIC_DRAW);
 gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.disable(gl.CULL_FACE);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
 gl.enableVertexAttribArray(s.position);gl.vertexAttribPointer(s.position,3,gl.FLOAT,false,20,0);gl.enableVertexAttribArray(s.uv);gl.vertexAttribPointer(s.uv,2,gl.FLOAT,false,20,12);gl.drawArrays(gl.TRIANGLES,0,6);gl.disableVertexAttribArray(s.position);gl.disableVertexAttribArray(s.uv);gl.disable(gl.BLEND);
};
root.MoonCharacterSpriteMath={directionFor,VERT,FRAG,SHADOW,CYCLES};
})(globalThis);
