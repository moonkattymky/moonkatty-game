/* Isolated stage-1 shell. No account, campaign, currency or persistent save access. */
(function(root){'use strict';
const $=id=>document.getElementById(id),i18n=root.OpenWorldI18n,t=i18n.t;
document.documentElement.lang=i18n.lang;document.documentElement.dir=['ar','he'].includes(i18n.lang)?'rtl':'ltr';
document.querySelectorAll('[data-i18n]').forEach(el=>el.textContent=t(el.dataset.i18n));document.querySelectorAll('[data-i18n-title]').forEach(el=>{el.title=t(el.dataset.i18nTitle);el.setAttribute('aria-label',el.title);});
for(const lang of i18n.langs){const option=document.createElement('option');option.value=lang;try{option.textContent=new Intl.DisplayNames([lang],{type:'language'}).of(lang);}catch{option.textContent=lang.toUpperCase();}$('language').append(option);}$('language').value=i18n.lang;$('language').onchange=()=>{const url=new URL(location.href);url.searchParams.set('lang',$('language').value);location.href=url.href;};
const state={chapter:1,collected:[],cells:[],tools:[],beacons:[],buildings:[],cards:{},recorder:false,signal:false,supply:false,artifact:false};
const player={x:0,z:12,yaw:0,speed:0,alt:0};let yaw=0,pitch=.04,velocityY=0,paused=false,ready=false,last=performance.now(),simTime=0,renderer;
let groundSafe={x:player.x,z:player.z};
const keys=new Set(),input={x:0,z:0,run:false},stats={version:'open-world-stage1.1',frames:0,readyMs:null,quality:'auto',fps:0,frameMs:[],maxAltitude:0,distance:0,actionCount:0};
let fatal=false;
function showFailure(key){fatal=true;clearInput();$('pausePanel').hidden=true;$('loading').hidden=false;$('loading').querySelector('p').textContent=t(key);$('retry').hidden=false;document.body.dataset.error=key;}
$('retry').onclick=()=>location.reload();
const loadDeadline=setTimeout(()=>{if(!ready&&!fatal)showFailure('loadError');},45000);
let qualityMode='auto',qualityTimer=0,sampleSeconds=0,sampleFrames=0,toastTimer;
function toast(key){$('toast').textContent=t(key);$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,2800);}
function clearInput(){keys.clear();input.x=input.z=0;input.run=false;player.speed=0;joyPointer=null;cameraPointer=null;$('stick').style.transform='';$('run').classList.remove('held');}
function setPause(value){if(fatal)return;paused=value;clearInput();$('pausePanel').hidden=!value;if(value)$('resume').focus();else $('view').focus();}
$('pause').onclick=()=>setPause(!paused);$('resume').onclick=()=>setPause(false);
function jump(){if(ready&&!paused&&player.alt<=.005){velocityY=4.1;player.alt=.006;}}
function action(){if(ready&&!paused){stats.actionCount++;toast('notice');}}
$('jump').onpointerdown=e=>{e.preventDefault();jump();};$('action').onclick=action;
$('run').onpointerdown=e=>{if(paused)return;e.preventDefault();$('run').setPointerCapture(e.pointerId);input.run=true;$('run').classList.add('held');};
for(const name of ['pointerup','pointercancel','lostpointercapture'])$('run').addEventListener(name,()=>{input.run=false;$('run').classList.remove('held');});
$('quality').onchange=()=>{qualityMode=$('quality').value;stats.quality=qualityMode;if(renderer)renderer.quality=qualityMode==='low'?'low':'high';qualityTimer=0;};
let joyPointer=null;
const joy=$('joystick');function moveJoy(e){if(paused||e.pointerId!==joyPointer)return;const b=joy.getBoundingClientRect(),dx=e.clientX-(b.left+b.width/2),dy=e.clientY-(b.top+b.height/2),max=b.width*.32,len=Math.hypot(dx,dy),scale=Math.min(1,max/(len||1));input.x=dx*scale/max;input.z=dy*scale/max;$('stick').style.transform=`translate(${dx*scale}px,${dy*scale}px)`;}
joy.onpointerdown=e=>{if(paused)return;e.preventDefault();joyPointer=e.pointerId;joy.setPointerCapture(e.pointerId);moveJoy(e);};joy.onpointermove=moveJoy;for(const name of ['pointerup','pointercancel','lostpointercapture'])joy.addEventListener(name,e=>{if(e.pointerId===joyPointer){joyPointer=null;input.x=input.z=0;$('stick').style.transform='';}});
let cameraPointer=null,cameraX=0,cameraY=0;
$('view').onpointerdown=e=>{if(paused)return;cameraPointer=e.pointerId;cameraX=e.clientX;cameraY=e.clientY;$('view').setPointerCapture(e.pointerId);$('view').focus();};
$('view').onpointermove=e=>{if(cameraPointer!==e.pointerId||paused)return;yaw-=(e.clientX-cameraX)*.006;pitch=Math.max(-.4,Math.min(.85,pitch+(e.clientY-cameraY)*.003));cameraX=e.clientX;cameraY=e.clientY;};
for(const name of ['pointerup','pointercancel','lostpointercapture'])$('view').addEventListener(name,e=>{if(e.pointerId===cameraPointer)cameraPointer=null;});
$('view').ondblclick=()=>{yaw=player.yaw;pitch=.04;toast('centered');};
addEventListener('keydown',e=>{if(e.target.matches('select,input,textarea'))return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();if(e.code==='Escape'&&!e.repeat){setPause(!paused);return;}if(paused)return;keys.add(e.code);if(e.code==='Space'&&!e.repeat)jump();if(e.code==='KeyE'&&!e.repeat)action();if(e.code==='KeyC'&&!e.repeat){yaw=player.yaw;pitch=.04;}});
addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>{if(ready)setPause(true);});document.addEventListener('visibilitychange',()=>{if(document.hidden&&ready)setPause(true);});
$('view').addEventListener('webglcontextlost',e=>{e.preventDefault();paused=true;showFailure('contextLost');});
function advance(dt){let ix=input.x+(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0),iz=input.z+(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0),len=Math.hypot(ix,iz);if(len>1){ix/=len;iz/=len;}const speed=input.run||keys.has('ShiftLeft')||keys.has('ShiftRight')?6.1:3.5,dx=(ix*Math.cos(yaw)+iz*Math.sin(yaw))*speed*dt,dz=(-ix*Math.sin(yaw)+iz*Math.cos(yaw))*speed*dt,oldX=player.x,oldZ=player.z;
 if(len>.03){const nx=Math.max(MoonCore.WORLD.minX+.4,Math.min(MoonCore.WORLD.maxX-.4,player.x+dx)),nz=Math.max(MoonCore.WORLD.minZ+.4,Math.min(MoonCore.WORLD.maxZ-.4,player.z+dz));if(!renderer.blocked(nx,player.z,state,player.alt))player.x=nx;if(!renderer.blocked(player.x,nz,state,player.alt))player.z=nz;const target=Math.atan2(-dx,-dz),diff=Math.atan2(Math.sin(target-player.yaw),Math.cos(target-player.yaw));player.yaw+=diff*Math.min(1,dt*14);}
 player.speed=Math.hypot(player.x-oldX,player.z-oldZ)/dt;stats.distance+=player.speed*dt;
 if(!renderer.blocked(player.x,player.z,state,0))groundSafe={x:player.x,z:player.z};
 if(player.alt>0||velocityY>0){velocityY-=5.2*dt;player.alt=Math.max(0,player.alt+velocityY*dt);if(!player.alt){velocityY=0;if(renderer.blocked(player.x,player.z,state,0)){player.x=groundSafe.x;player.z=groundSafe.z;player.speed=0;}}}stats.maxAltitude=Math.max(stats.maxAltitude,player.alt);
}
function frame(now){requestAnimationFrame(frame);const elapsed=Math.max(.001,(now-last)/1000);last=now;if(fatal||paused||document.hidden)return;const dt=Math.min(elapsed,.04);simTime+=dt;const start=performance.now();try{if(ready)advance(dt);renderer.render(state,player,simTime,dt,yaw,pitch,false);}catch(error){showFailure('webgl');console.error(error);return;}const renderMs=performance.now()-start;stats.frames++;sampleSeconds+=elapsed;sampleFrames++;if(stats.frameMs.length<1800)stats.frameMs.push(renderMs);
 if(!ready&&renderer.envReady&&renderer.characterSprite?.ready&&renderer.characterSprite?.idleReady&&Object.values(renderer.characterSprite.directionTextures).every(x=>x.ready)){ready=true;clearTimeout(loadDeadline);stats.readyMs=performance.now();$('loading').hidden=true;document.body.dataset.ready='true';}
 if(sampleSeconds>=1){stats.fps=Math.round(sampleFrames/sampleSeconds);$('status').textContent=`WebGL 1 · ${stats.fps} FPS · ${renderer.quality}`;if(qualityMode==='auto'){qualityTimer=stats.fps<28?qualityTimer+sampleSeconds:Math.max(0,qualityTimer-sampleSeconds);if(qualityTimer>3)renderer.quality='low';}sampleSeconds=sampleFrames=0;}
}
try{renderer=new MoonRenderer($('view'));const spawn=renderer.safeSpawn(player.x,player.z,state);player.x=spawn.x;player.z=spawn.z;groundSafe={...spawn};requestAnimationFrame(frame);}catch(error){clearTimeout(loadDeadline);showFailure('webgl');console.error(error);}
Object.defineProperty(root,'OpenWorldPreview',{value:Object.freeze({snapshot:()=>({ready,paused,player:{...player},camera:{yaw,pitch,eye:renderer?.eye?.slice()},sprite:renderer?.characterSprite?{direction:renderer.characterSprite.direction,frame:renderer.characterSprite.frame,mode:renderer.characterSprite.mode}:null,stats:{...stats,frameMs:stats.frameMs.slice()},rendererStats:renderer?.stats,capabilities:Object.keys(MoonCore)}),pause:setPause}),writable:false});
})(globalThis);
