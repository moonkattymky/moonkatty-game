import {T,buildScene,MODULES,groundHeight,moveActor} from './scene.js?v=20261010-world-1';

const $=id=>document.getElementById(id),canvas=$('scene'),panel=$('panel');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const state={x:0,z:11,yaw:0,pitch:.29,distance:18,heading:0,inspected:[],quality:'auto'};
const storageKey='mkty_graphics_3d_preview_v1';
try{const saved=JSON.parse(sessionStorage.getItem(storageKey));if(saved&&saved.version===1){for(const k of ['x','z','yaw','pitch','distance','heading'])if(Number.isFinite(saved[k]))state[k]=saved[k];state.inspected=Array.isArray(saved.inspected)?saved.inspected.filter(id=>MODULES.some(m=>m.id===id)):[];state.quality=saved.quality==='economy'?'economy':'auto';}}catch{}
state.x=clamp(state.x,-60,60);state.z=clamp(state.z,-60,60);if(Math.hypot(state.x,state.z)>70){state.x=0;state.z=11;}state.pitch=clamp(state.pitch,.16,1.12);state.distance=clamp(state.distance,7,24);
let world,renderer,camera,ready=false,paused=false,lost=false,closed=false,frame=0,last=0,time=0,saveAt=0,noticeUntil=0,scanUntil=0,nearest=null,collisionCount=0,frameTimes=[],qualityScale=1.25,qualityAt=0,animationId=0;
const keyboard=new Set(),move={x:0,y:0},velocity={x:0,z:0},pointers=new Map();let joyId=null,lookId=null,lookLast=null,pinch=null;
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const cameraPose={yaw:state.yaw,pitch:state.pitch,distance:state.distance};
const labels=MODULES.map(m=>{const el=document.createElement('div');el.className='station-label';el.innerHTML=`<b>${m.number}</b><small>${m.name}</small>`;$('station-labels').append(el);return {module:m,el};});
function save(){if(!ready)return;state.x=world.cat.position.x;state.z=world.cat.position.z;state.heading=world.cat.rotation.y;try{sessionStorage.setItem(storageKey,JSON.stringify({version:1,...state}));}catch{/* A storage-disabled browser can still explore. */}}
function notice(message){$('notice').textContent=message;$('notice').classList.add('visible');noticeUntil=performance.now()+4800;}
function resetInput(){keyboard.clear();move.x=move.y=velocity.x=velocity.z=0;joyId=lookId=pinch=null;pointers.clear();$('stick').style.transform='translate(0,0)';}
function pause(kind='pause'){
  if(!ready||lost)return;paused=true;resetInput();save();
  $('panel-title').textContent=kind==='map'?'КАРТА БАЗЫ':kind==='tasks'?'ИССЛЕДОВАНИЕ БАЗЫ':'ПАУЗА';
  if(kind==='map'){$('panel-content').innerHTML='<canvas class="map-canvas" width="400" height="400" aria-label="Карта базы с положением кота"></canvas><p>Голубая стрелка — ваш кот. Золотые маркеры — модули. Вход в шлюз открыт.</p>';drawMap($('panel-content').querySelector('canvas'));}
  else if(kind==='tasks'){$('panel-content').innerHTML=`<p>Свободно исследуйте первую 3D-локацию. Подойдите к каждому модулю и нажмите «Осмотреть».</p><ul>${MODULES.map(m=>`<li>${state.inspected.includes(m.id)?'✓':'○'} ${m.name}</li>`).join('')}</ul><p>Левый джойстик — ходьба. Проведите пальцем по миру — обзор на 360°. Два пальца — приближение камеры. На компьютере: WASD, Q/E и мышь.</p><p>Это отдельный графический полигон. Достижения основной игры здесь не расходуются и не начисляются.</p>`;}
  else $('panel-content').innerHTML='<p>Исследование приостановлено. Положение кота и камеры сохранено для перезагрузки этой вкладки.</p><p>Проведите пальцем по миру, чтобы осмотреть базу. Двигайте джойстик и камеру одновременно.</p>';
  if(!panel.open)panel.showModal();$('resume').focus();
}
function resume(){if(lost||!ready)return;panel.close();paused=false;resetInput();last=performance.now();canvas.focus({preventScroll:true});}
function drawMap(el){const c=el.getContext('2d'),scale=5.8,to=(x,z)=>[200+x*scale,205+z*scale];c.fillStyle='#061722';c.fillRect(0,0,400,400);c.strokeStyle='#1c3b50';c.lineWidth=1;for(let i=26;i<400;i+=29){c.beginPath();c.moveTo(i,0);c.lineTo(i,400);c.moveTo(0,i);c.lineTo(400,i);c.stroke();}c.strokeStyle='#3c7189';c.strokeRect(...to(6,-4),8*scale,8*scale);c.fillStyle='#a5c4d4';c.font='16px Arial';c.fillText('ШЛЮЗ',...to(7,-7));for(const m of MODULES){const [x,z]=to(m.x,m.z);c.fillStyle=state.inspected.includes(m.id)?'#62efff':'#ffc665';c.beginPath();c.arc(x,z,12,0,Math.PI*2);c.fill();c.fillStyle='#e6f7ff';c.font='14px Arial';c.fillText(m.name,x+17,z+5);}const [x,z]=to(world.cat.position.x,world.cat.position.z);c.save();c.translate(x,z);c.rotate(-world.cat.rotation.y);c.fillStyle='#62efff';c.beginPath();c.moveTo(0,12);c.lineTo(-8,-8);c.lineTo(8,-8);c.closePath();c.fill();c.restore();}
function inspect(){if(paused||!nearest||!ready)return;if(!state.inspected.includes(nearest.id))state.inspected.push(nearest.id);notice(nearest.description);$('progress').textContent=state.inspected.length+' / 3';save();if(state.inspected.length===3)notice('Все три модуля осмотрены. Можно продолжить прогулку или войти в шлюз.');}
function resize(){
  const tg=window.Telegram?.WebApp;if(tg?.initData&&tg.viewportStableHeight>0)document.documentElement.style.setProperty('--world-height',tg.viewportStableHeight+'px');
  if(!renderer)return;const w=canvas.clientWidth,h=canvas.clientHeight;if(w<=0||h<=0)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
}
function setQuality(){const max=state.quality==='economy'?.85:qualityScale;renderer?.setPixelRatio(Math.min(devicePixelRatio||1,max));resize();$('quality').textContent='КАЧЕСТВО: '+(state.quality==='economy'?'ЭКОНОМНО':'АВТО');}
function snapshot(){return Object.freeze({ready,paused,contextLost:lost,position:world?{x:world.cat.position.x,y:world.cat.position.y,z:world.cat.position.z}:null,camera:{yaw:state.yaw,pitch:state.pitch,distance:state.distance,actualDistance:camera&&world?camera.position.distanceTo(world.cat.position.clone().add(new T.Vector3(0,1.8,0))):null},heading:world?.cat.rotation.y,inspected:[...state.inspected],nearest:nearest?.id||null,velocity:{...velocity},collisions:collisionCount,inputPointers:pointers.size,quality:state.quality,pixelRatio:renderer?.getPixelRatio(),drawCalls:renderer?.info.render.calls,triangles:renderer?.info.render.triangles,frames:frame,frameMs:frameTimes.slice(-240),engine:'Three.js r170 / WebGL2',persistenceKey:storageKey});}
window.MKTYOpenWorld=Object.freeze({snapshot});
function positionLabels(){const v=new T.Vector3();for(const {module:m,el}of labels){v.set(m.x,groundHeight(m.x,m.z)+(m.id==='relay'?8.8:5.25),m.z).project(camera);const x=(v.x*.5+.5)*canvas.clientWidth,y=(-v.y*.5+.5)*canvas.clientHeight;const upper=canvas.clientHeight>550?145:100,bottom=canvas.clientHeight>550?220:90;const visible=v.z>-1&&v.z<1&&x>26&&x<canvas.clientWidth-26&&y>upper&&y<canvas.clientHeight-bottom;el.style.display=visible?'block':'none';el.style.transform=`translate(${x-23}px,${y-23}px)`;el.classList.toggle('done',state.inspected.includes(m.id));el.querySelector('b').textContent=state.inspected.includes(m.id)?'✓':String(m.number);}}
function updateCamera(dt){
  const target=new T.Vector3(world.cat.position.x,world.cat.position.y+1.8,world.cat.position.z);
  const blend=reduceMotion?1:1-Math.exp(-12*dt);
  // Smooth angular coordinates on the orbit, rather than a chord through the cat.
  cameraPose.yaw+=Math.atan2(Math.sin(state.yaw-cameraPose.yaw),Math.cos(state.yaw-cameraPose.yaw))*blend;cameraPose.pitch+=(state.pitch-cameraPose.pitch)*blend;cameraPose.distance+=(state.distance-cameraPose.distance)*blend;
  const cp=Math.cos(cameraPose.pitch),desired=new T.Vector3(Math.sin(cameraPose.yaw)*cameraPose.distance*cp,Math.sin(cameraPose.pitch)*cameraPose.distance,Math.cos(cameraPose.yaw)*cameraPose.distance*cp).add(target);
  desired.y=Math.max(desired.y,groundHeight(desired.x,desired.z)+.8);
  function obstruction(end){const delta=end.clone().sub(target);for(let i=3;i<=36;i++){const p=target.clone().addScaledVector(delta,i/36);if(world.colliders.some(c=>p.y<groundHeight(c.x,c.z)+(c.height||3)+.3&&(c.type==='circle'?Math.hypot(p.x-c.x,p.z-c.z)<c.r+.3:Math.abs(p.x-c.x)<c.hx+.3&&Math.abs(p.z-c.z)<c.hz+.3)))return (i-2)/36;}return null;}
  const indoor=world.cat.position.x>7.1&&world.cat.position.x<12.9&&world.cat.position.z>-3.2&&world.cat.position.z<3.3;
  let hit=obstruction(desired);
  // Outside, look over close equipment instead of zooming into the mascot's face.
  if(!indoor&&hit!==null&&desired.distanceTo(target)*hit<7){for(let n=0;n<10&&hit!==null;n++){desired.y+=3.5;hit=obstruction(desired);}}
  if(hit!==null){const delta=desired.clone().sub(target);desired.copy(target).addScaledVector(delta,indoor?Math.max(.12,hit):Math.max(7/delta.length(),hit));}
  camera.position.copy(desired);camera.lookAt(target);
  // In confined interiors use a close view without an opaque helmet blocking it.
  world.cat.visible=!(indoor&&camera.position.distanceTo(target)<4);
}
function animate(now){
  if(closed)return;animationId=requestAnimationFrame(animate);if(!ready||lost)return;
  const ms=last?now-last:16.7;last=now;const dt=Math.min(ms/1000,.05);frame++;
  if(!paused){
    time+=dt;let ix=move.x+(keyboard.has('d')||keyboard.has('ArrowRight')?1:0)-(keyboard.has('a')||keyboard.has('ArrowLeft')?1:0),iy=move.y+(keyboard.has('s')||keyboard.has('ArrowDown')?1:0)-(keyboard.has('w')||keyboard.has('ArrowUp')?1:0);const length=Math.hypot(ix,iy);if(length>1){ix/=length;iy/=length;}
    if(keyboard.has('q'))state.yaw-=dt*1.5;if(keyboard.has('e'))state.yaw+=dt*1.5;
    const speed=4.5,dx=(Math.cos(state.yaw)*ix+Math.sin(state.yaw)*iy)*speed,dz=(-Math.sin(state.yaw)*ix+Math.cos(state.yaw)*iy)*speed,blend=1-Math.exp(-14*dt);
    velocity.x+=(dx-velocity.x)*blend;velocity.z+=(dz-velocity.z)*blend;
    const before=world.cat.position.clone();if(moveActor(world.cat.position,velocity.x*dt,velocity.z*dt,world.colliders))collisionCount++;
    const actual=world.cat.position.clone().sub(before),actualSpeed=actual.length()/Math.max(.001,dt);
    if(actualSpeed>.05){const heading=Math.atan2(actual.x,actual.z),delta=Math.atan2(Math.sin(heading-world.cat.rotation.y),Math.cos(heading-world.cat.rotation.y));world.cat.rotation.y+=delta*Math.min(1,dt*12);}
    world.animateCat(time,actualSpeed);updateCamera(dt);
    nearest=MODULES.filter(m=>Math.hypot(m.x-world.cat.position.x,m.z-world.cat.position.z)<m.r+2.9).sort((a,b)=>Math.hypot(a.x-world.cat.position.x,a.z-world.cat.position.z)-Math.hypot(b.x-world.cat.position.x,b.z-world.cat.position.z))[0]||null;
    $('inspect').disabled=!nearest;$('inspect-text').textContent=nearest?'ОСМОТРЕТЬ':'ПОДОЙДИТЕ';
    if(now-saveAt>1600){saveAt=now;save();}
    if(frame>12){frameTimes.push(ms);if(frameTimes.length>480)frameTimes.shift();}
    if(now-qualityAt>1500&&frameTimes.length>=12&&state.quality==='auto'){qualityAt=now;const sorted=frameTimes.slice(-45).sort((a,b)=>a-b),median=sorted[Math.floor(sorted.length/2)];if(median>28&&qualityScale>.85){qualityScale=Math.max(.85,qualityScale-.2);setQuality();}}
  }
  if(now>noticeUntil)$('notice').classList.remove('visible');if(now>scanUntil)$('scan').classList.remove('scanning');if(time>12)$('hint').classList.add('quiet');
  positionLabels();renderer.render(world.scene,camera);
}

$('pause').addEventListener('click',()=>pause());$('map').addEventListener('click',()=>pause('map'));$('tasks').addEventListener('click',()=>pause('tasks'));$('resume').addEventListener('click',resume);
panel.addEventListener('cancel',e=>{e.preventDefault();resume();});$('inspect').addEventListener('click',inspect);
$('scan').addEventListener('click',()=>{if(paused||!ready)return;$('scan').classList.add('scanning');scanUntil=performance.now()+1700;const n=MODULES.filter(m=>!state.inspected.includes(m.id)).sort((a,b)=>Math.hypot(a.x-world.cat.position.x,a.z-world.cat.position.z)-Math.hypot(b.x-world.cat.position.x,b.z-world.cat.position.z))[0];notice(n?`${n.name}: ${Math.round(Math.hypot(n.x-world.cat.position.x,n.z-world.cat.position.z))} м. Подойдите к модулю для осмотра.`:'База исследована. Шлюз открыт для прогулки.');});
$('camera-reset').addEventListener('click',()=>{if(paused||!ready)return;state.yaw=world.cat.rotation.y-Math.PI;state.pitch=.29;state.distance=18;save();notice('Камера снова следует за котом.');});
$('quality').addEventListener('click',()=>{state.quality=state.quality==='auto'?'economy':'auto';setQuality();save();});
const keys=['w','a','s','d','q','e','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
window.addEventListener('keydown',e=>{const k=e.key.length===1?e.key.toLowerCase():e.key;if(k==='Escape'){e.preventDefault();if(panel.open)resume();else pause();return;}if(keys.includes(k)){if(paused||!ready||e.target.closest('input,textarea,select'))return;e.preventDefault();keyboard.add(k);}});
window.addEventListener('keyup',e=>keyboard.delete(e.key.length===1?e.key.toLowerCase():e.key));
const joy=$('joystick');
function joyMove(e){const r=joy.getBoundingClientRect(),max=r.width*.31,dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2),d=Math.hypot(dx,dy),scale=d>max?max/d:1;move.x=dx*scale/max;move.y=dy*scale/max;if(Math.hypot(move.x,move.y)<.13)move.x=move.y=0;$('stick').style.transform=`translate(${dx*scale}px,${dy*scale}px)`;}
joy.addEventListener('pointerdown',e=>{if(paused||!ready||joyId!==null)return;e.preventDefault();joyId=e.pointerId;joy.setPointerCapture(e.pointerId);joyMove(e);});
joy.addEventListener('pointermove',e=>{if(e.pointerId===joyId&&!paused){e.preventDefault();joyMove(e);}});
function joyEnd(e){if(e.pointerId!==joyId)return;joyId=null;move.x=move.y=0;$('stick').style.transform='translate(0,0)';}
joy.addEventListener('pointerup',joyEnd);joy.addEventListener('pointercancel',joyEnd);joy.addEventListener('lostpointercapture',joyEnd);
// Direction buttons remain useful with keyboard/accessibility activation; pointer gestures use the whole pad.
joy.querySelectorAll('button').forEach(b=>b.addEventListener('click',e=>{if(e.detail!==0||paused||!ready)return;const d=b.dataset.move,v={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]}[d];moveActor(world.cat.position,v[0]*.65,v[1]*.65,world.colliders);save();}));
canvas.addEventListener('pointerdown',e=>{if(paused||!ready)return;e.preventDefault();canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===1){lookId=e.pointerId;lookLast={x:e.clientX,y:e.clientY};}else{const [a,b]=[...pointers.values()];pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),zoom:state.distance};lookId=null;}});
canvas.addEventListener('pointermove',e=>{if(paused||!pointers.has(e.pointerId))return;e.preventDefault();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size>=2&&pinch){const [a,b]=[...pointers.values()];state.distance=clamp(pinch.zoom*pinch.distance/Math.max(20,Math.hypot(a.x-b.x,a.y-b.y)),7,24);}else if(e.pointerId===lookId&&lookLast){state.yaw-=(e.clientX-lookLast.x)*.009;state.pitch=clamp(state.pitch+(e.clientY-lookLast.y)*.004,.16,1.12);lookLast={x:e.clientX,y:e.clientY};}});
function lookEnd(e){pointers.delete(e.pointerId);pinch=null;if(pointers.size===1){const [id,p]=[...pointers][0];lookId=id;lookLast=p;}else{lookId=null;lookLast=null;}save();}
canvas.addEventListener('pointerup',lookEnd);canvas.addEventListener('pointercancel',lookEnd);canvas.addEventListener('lostpointercapture',lookEnd);
canvas.addEventListener('wheel',e=>{e.preventDefault();if(!paused)state.distance=clamp(state.distance+e.deltaY*.013,7,24);},{passive:false});
window.addEventListener('resize',resize);new ResizeObserver(resize).observe($('world'));
window.addEventListener('blur',()=>{if(ready&&!paused&&!lost)pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&ready&&!paused&&!lost)pause();});window.addEventListener('pagehide',()=>{save();resetInput();closed=true;cancelAnimationFrame(animationId);});
window.addEventListener('pageshow',e=>{if(e.persisted){cancelAnimationFrame(animationId);closed=false;last=performance.now();pause();animationId=requestAnimationFrame(animate);}});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();save();lost=paused=true;resetInput();panel.close();$('loading').hidden=false;$('load-status').textContent='Графический контекст прерван. Вернитесь в приложение или перезагрузите страницу — положение кота сохранено.';$('fallback').hidden=false;});
canvas.addEventListener('webglcontextrestored',()=>location.reload());
async function start(){
  try{
    renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',alpha:false});renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
    // Contact decals and vertex-baked terrain AO avoid full-scene shadow sampling in WebViews.
    renderer.shadowMap.enabled=false;
    camera=new T.PerspectiveCamera(64,1,.12,650);setQuality();world=await buildScene(renderer);world.cat.position.set(state.x,groundHeight(state.x,state.z),state.z);
    // Reject stale/out-of-bounds demo positions inside current solid geometry.
    const overlaps=world.colliders.some(c=>c.type==='circle'?Math.hypot(state.x-c.x,state.z-c.z)<c.r+.47:Math.abs(state.x-c.x)<c.hx+.47&&Math.abs(state.z-c.z)<c.hz+.47);
    if(overlaps)world.cat.position.set(0,0,11);moveActor(world.cat.position,0,0,world.colliders);world.cat.rotation.y=state.heading;world.animateCat(0,0);updateCamera(1);renderer.render(world.scene,camera);ready=true;last=performance.now();$('progress').textContent=state.inspected.length+' / 3';$('loading').hidden=true;canvas.focus({preventScroll:true});
    const tg=window.Telegram?.WebApp;if(tg?.initData){tg.ready?.();tg.expand?.();if(tg.isVersionAtLeast?.('7.7'))tg.disableVerticalSwipes?.();tg.onEvent?.('viewportChanged',resize);tg.onEvent?.('deactivated',()=>pause());tg.BackButton?.show();tg.BackButton?.onClick(()=>{if(panel.open)resume();else pause();});resize();}
    animationId=requestAnimationFrame(animate);
  }catch(e){console.error('MOONKATTY 3D:',e);$('load-status').textContent='3D-локация не загрузилась. Проверьте соединение и поддержку WebGL2. Основная игра доступна по кнопке ниже.';$('fallback').hidden=false;}
}
start();
