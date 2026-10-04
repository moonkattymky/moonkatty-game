/* LIFE 6: deterministic flight physics, explicit stage transitions and resumable checkpoints. */
const Liftoff6=(()=>{
 const root=$('mission6'),scene=$('liftoffScene6'),canvas=$('liftoffCanvas6'),ctx=canvas.getContext('2d');
 const guide=$('liftoffGuide6'),ship=$('lfShip6'),environment=$('lfEnvironment6'),motionMedia=matchMedia('(prefers-reduced-motion: reduce)');
 const KEY='mkty_liftoff6_checkpoint_v1',systems=['NAV','FUEL','CREW','CORE'],phases=['briefing','preflight','ignition','countdown','flight','abort','orbit','complete'];
 const faults=[
  {title:'FUEL PRESSURE TOO HIGH',hint:'Pressure exceeds the limit. Open the relief valve to vent the line.',answer:'vent'},
  {title:'GUIDANCE COMPUTER DESYNC',hint:'Navigation data is out of sync. Reset the guidance computer.',answer:'reset'},
  {title:'BACKUP SENSOR REQUIRED',hint:'The primary sensor has failed. Bypass it to use the backup sensor.',answer:'bypass'}
 ];
 const panels={briefing:$('lfBrief6'),preflight:$('lfCheck6'),ignition:$('lfIgnition6'),flight:$('lfFlight6'),abort:$('lfAbort6'),orbit:$('lfOrbit6'),complete:$('life6Complete')};
 const cache=new Map(),controls=[];let s=null,frameId=0,last=0,uiTime=0,saveTime=0,paintTime=0,focusBefore=null;
 let width=1,height=1,dpr=1,shipSize=110,hudHeight=45,ignitionHeld=false,leftHeld=false,rightHeld=false;
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),active=()=>root.classList.contains('active');
 const target=alt=>50+Math.sin(alt/600)*20;
 function shuffle(a){const out=[...a];for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
 function text(id,value){value=String(value);if(cache.get(id)!==value){cache.set(id,value);$(id).textContent=value;}}
 function fresh(){return {phase:'briefing',phaseTime:0,order:shuffle(systems),armed:0,clock:45,fault:Math.floor(Math.random()*faults.length),faultActive:false,faultSolved:false,throttle:35,hold:0,alt:0,x:50,vx:0,speed:0,fuel:100,hull:100,temp:22,gates:0,offCourse:0,elapsed:0,failedStage:'preflight',reason:'',paused:false,notice:'',noticeFor:0,flash:0};}
 function save(){
  if(!s||s.phase==='complete')return;
  const data={version:1};
  for(const key of ['phase','phaseTime','order','armed','clock','fault','faultActive','faultSolved','throttle','alt','x','vx','speed','fuel','hull','temp','gates','offCourse','elapsed','failedStage','reason'])data[key]=s[key];
  try{localStorage.setItem(KEY,JSON.stringify(data));}catch{/* Storage failure must not stop flight. */}
 }
 function restore(){
  try{
   const v=JSON.parse(localStorage.getItem(KEY)||'null');if(!v||v.version!==1||!phases.slice(0,-1).includes(v.phase))return false;
   if(!Array.isArray(v.order)||v.order.length!==4||new Set(v.order).size!==4||!v.order.every(x=>systems.includes(x)))return false;
   const ranges={phaseTime:[0,4],armed:[0,4],clock:[0,45],fault:[0,2],throttle:[0,100],alt:[0,3000],x:[8,92],vx:[-25,25],speed:[0,200],fuel:[0,100],hull:[0,100],temp:[15,150],gates:[0,3],offCourse:[0,1000],elapsed:[0,100000]};
   for(const [k,[min,max]] of Object.entries(ranges))if(!Number.isFinite(v[k])||v[k]<min||v[k]>max)return false;
   if(!['armed','fault','gates'].every(k=>Number.isInteger(v[k]))||typeof v.faultActive!=='boolean'||typeof v.faultSolved!=='boolean')return false;
   if(!['preflight','flight'].includes(v.failedStage)||typeof v.reason!=='string')return false;
   if(['ignition','countdown','flight','orbit'].includes(v.phase)&&(v.armed!==4||!v.faultSolved))return false;
   if(v.phase==='orbit'&&(v.gates!==3||v.alt!==3000))return false;
   if(v.phase==='flight'&&(v.gates>2||v.alt<v.gates*1000||v.alt>=(v.gates+1)*1000))return false;
   Object.assign(s,v,{hold:0,paused:false,notice:'',noticeFor:0,flash:0});return true;
  }catch{return false;}
 }
 function release(){controls.forEach(c=>c());ignitionHeld=leftHeld=rightHeld=false;}
 function signal(kind){s.flash=kind==='error'?-1:1;window.MKTYExperience?.signal(kind);tg?.HapticFeedback?.notificationOccurred?.(kind==='error'?'error':'success');}
 function notice(message){s.notice=message;s.noticeFor=3;text('lfStatus6',message);}
 function enter(phase){release();s.phase=phase;s.phaseTime=0;s.hold=0;render();save();}
 function abort(reason){s.failedStage=s.phase==='preflight'?'preflight':'flight';s.reason=reason;signal('error');enter('abort');}
 function begin(){if(!s||s.paused||s.phase!=='briefing')return;enter('preflight');}
 function arm(system){
  if(!active()||!s||s.paused||s.phase!=='preflight'||s.faultActive||s.order.slice(0,s.armed).includes(system))return;
  if(system!==s.order[s.armed]){s.clock=Math.max(0,s.clock-4);notice('Wrong system. Four seconds lost. Follow the highlighted order.');signal('error');if(s.clock===0)abort('The pre-flight window expired.');render();save();return;}
  s.armed++;window.MKTYExperience?.signal('success');
  if(s.armed===2&&!s.faultSolved){s.faultActive=true;notice('Diagnose the fault. Select the matching repair.');}
  if(s.armed===4){s.throttle=35;enter('ignition');}else{render();save();}
 }
 function repair(answer){
  if(!active()||!s||s.paused||s.phase!=='preflight'||!s.faultActive)return;
  if(answer!==faults[s.fault].answer){s.clock=Math.max(0,s.clock-6);notice('Wrong repair. Six seconds lost. Read the fault diagnosis.');signal('error');if(s.clock===0)abort('The pre-flight window expired.');}
  else{s.faultActive=false;s.faultSolved=true;notice('Fault cleared. Arm the remaining two systems.');signal('success');}
  render();save();
 }
 function retry(){
  if(!s||s.paused||s.phase!=='abort')return;
  if(s.failedStage==='preflight'){Object.assign(s,{clock:45,armed:0,order:shuffle(systems),fault:Math.floor(Math.random()*faults.length),faultActive:false,faultSolved:false,noticeFor:0});enter('preflight');}
  else{Object.assign(s,{alt:s.gates*1000,x:target(s.gates*1000),vx:0,speed:s.gates?55:0,fuel:100,hull:100,temp:45,throttle:62,offCourse:0,noticeFor:0});enter('flight');}
 }
 function finish(){
  const rewarded=localStorage.getItem('mkty_life6_awarded')==='yes';awardLifePoints(6,1500);unlockLife7();
  try{localStorage.removeItem(KEY);}catch{}
  s.speed=0;s.throttle=0;enter('complete');text('lfReward6',rewarded?'MISSION COMPLETE':'+1500 MOON POINTS');signal('complete');
 }
 function tick(dt){
  s.elapsed+=dt;s.noticeFor=Math.max(0,s.noticeFor-dt);s.flash*=Math.exp(-dt*3);
  if(s.phase==='preflight'){s.clock=Math.max(0,s.clock-dt);if(s.clock===0)abort('The pre-flight window expired.');}
  else if(s.phase==='ignition'){
   s.hold=ignitionHeld&&s.throttle>=54&&s.throttle<=70?Math.min(3,s.hold+dt):0;
   if(s.hold>=3){signal('success');enter('countdown');}
  }else if(s.phase==='countdown'){
   s.phaseTime+=dt;if(s.phaseTime>=3){Object.assign(s,{alt:0,x:50,vx:0,speed:0,temp:45,throttle:62,fuel:100,hull:100,gates:0,offCourse:0});enter('flight');}
  }else if(s.phase==='flight'){
   s.vx+=(Number(rightHeld)-Number(leftHeld))*65*dt;s.vx*=Math.exp(-4*dt);s.x=clamp(s.x+s.vx*dt,8,92);
   s.speed=clamp(s.speed+((s.throttle-38)*.5-s.speed*.18)*dt,0,200);
   s.alt=Math.min(3000,s.alt+s.speed*1.4*dt);s.fuel=Math.max(0,s.fuel-(.2+s.throttle*.009)*dt);
   s.temp+=(22+s.throttle*.91-s.temp)*(1-Math.exp(-dt*.2));
   const aligned=Math.abs(s.x-target(s.alt))<=14;s.offCourse=aligned?0:s.offCourse+dt;
   if(s.offCourse>2)s.hull=Math.max(0,s.hull-dt*8);
   if(s.temp>98){abort('Engine temperature exceeded the safety limit.');return;}
   if(s.fuel===0){abort('Fuel exhausted before the final beacon.');return;}
   if(s.hull===0){abort('The ship stayed outside the protected corridor.');return;}
   if(s.alt>=(s.gates+1)*1000){
    if(Math.abs(s.x-target((s.gates+1)*1000))>14){abort('The ascent beacon was missed.');return;}
    if(s.speed<35||s.speed>110){abort('Beacon crossing speed was outside 35–110 m/s.');return;}
    if(s.temp>92){abort('The engine was too hot at the beacon.');return;}
    s.gates++;signal('gate');notice('Beacon confirmed. Retry checkpoint saved.');
    if(s.gates===3){s.alt=3000;enter('orbit');}else save();
   }
  }else if(s.phase==='orbit'){s.speed*=Math.exp(-dt*1.8);s.phaseTime+=dt;if(s.phaseTime>=3)finish();}
 }
 function status(){
  if(s.noticeFor>0)return s.notice;
  if(s.phase==='briefing')return 'Flight control is standing by.';
  if(s.phase==='preflight')return s.faultActive?'Diagnose the fault. Select the matching repair.':'Arm the highlighted system. Wrong inputs cost countdown time.';
  if(s.phase==='ignition')return s.throttle<54?'Increase thrust into the green zone.':s.throttle>70?'Reduce thrust into the green zone.':ignitionHeld?'Ignition stable. Keep holding.':'Thrust is ready. Hold IGNITION for three seconds.';
  if(s.phase==='countdown')return 'Ignition confirmed. Stand by for liftoff.';
  if(s.phase==='flight'){
   if(s.temp>86)return 'Engine hot. Reduce thrust into the green zone.';
   if(s.fuel<20)return 'Fuel reserve low. Maintain a steady climb.';
   if(Math.abs(s.x-target(s.alt))>12)return s.x>target(s.alt)?'Hold ◀ to return to the green corridor.':'Hold ▶ to return to the green corridor.';
   if(s.speed<35)return 'Building climb speed. Keep thrust in the green zone.';
   if(s.speed>110)return 'Climb too fast. Reduce thrust before the beacon.';
   return 'On course. Keep the gold marker inside the green zone.';
  }
  if(s.phase==='abort')return 'Flight safely interrupted. Your last beacon is preserved.';
  if(s.phase==='orbit')return 'All three beacons passed. Orbital insertion in progress.';
  return 'Orbit confirmed. Crew and ship are safe.';
 }
 function render(){
  if(!s)return;
  root.dataset.flightPhase=s.phase;root.dataset.paused=String(s.paused);root.dataset.warning=String(s.phase==='abort'||s.temp>86||s.offCourse>1||s.phase==='preflight'&&s.clock<10);root.dataset.urgent=String(s.clock<10);
  const stage=s.phase==='abort'?(s.failedStage==='flight'?2:0):['briefing','preflight'].includes(s.phase)?0:['ignition','countdown'].includes(s.phase)?1:2;
  root.querySelectorAll('[data-lf-step]').forEach((e,i)=>{e.classList.toggle('current',stage===i&&s.phase!=='complete');e.classList.toggle('done',i<stage||s.phase==='complete');if(i===stage)e.setAttribute('aria-current','step');else e.removeAttribute('aria-current');});
  const shown=s.phase==='countdown'?'ignition':s.phase;
  for(const [name,panel] of Object.entries(panels)){panel.hidden=name!==shown;panel.inert=name!==shown;}
  $('lfThrottlePanel6').hidden=!['ignition','flight'].includes(s.phase);$('lfThrottle6').disabled=s.paused||!['ignition','flight'].includes(s.phase);$('lfThrottle6').value=s.throttle;
  $('lfIgnite6').disabled=s.paused||s.phase!=='ignition';$('lfIgnite6').classList.toggle('held',ignitionHeld);
  text('lfState6',{briefing:'PAD ALPHA',preflight:'FLIGHT CHECK',ignition:'ENGINE START',countdown:'LIFTOFF',flight:'ASCENT',abort:'FLIGHT REVIEW',orbit:'ORBITAL INSERTION',complete:'ORBIT SECURED'}[s.phase]);
  text('lfSceneTag6',s.paused?'PAUSED':s.phase==='complete'?'CREW SAFE / FLIGHT COMPLETE':s.phase==='flight'?'ASCENT CORRIDOR':s.phase==='abort'?'FLIGHT HOLD':s.armed===4?'ALL SYSTEMS READY':'ALL SYSTEMS STANDBY');
  text('lfAltitude6',String(Math.floor(s.alt)).padStart(4,'0'));text('lfSpeed6',Math.round(s.speed));text('lfFuel6',Math.ceil(s.fuel));text('lfClock6',s.clock.toFixed(1));
  const order=$('lfOrder6');if(order.dataset.order!==s.order.join(',')){order.dataset.order=s.order.join(',');order.replaceChildren(...s.order.map(name=>{const e=document.createElement('span');e.textContent=name;return e;}));}
  [...order.children].forEach((e,i)=>{e.classList.toggle('current',i===s.armed);e.classList.toggle('done',i<s.armed);});
  root.querySelectorAll('[data-lf-system]').forEach(b=>{const armed=s.order.slice(0,s.armed).includes(b.dataset.lfSystem);b.classList.toggle('armed',armed);b.disabled=s.paused||s.phase!=='preflight'||armed||s.faultActive;});
  $('lfSystems6').hidden=s.faultActive;$('lfFault6').hidden=!s.faultActive;
  text('lfFaultTitle6',faults[s.fault].title);text('lfFaultHint6',faults[s.fault].hint);
  text('lfThrust6',s.throttle+'%');text('lfHold6',s.hold.toFixed(1)+' / 3.0 s');$('lfHoldFill6').style.transform='scaleX('+(s.hold/3)+')';
  text('lfBeacons6',s.gates+' / 3');text('lfHull6',Math.ceil(s.hull)+'%');text('lfHeat6',Math.round(s.temp)+'°');text('lfGateDistance6',Math.max(0,Math.ceil((s.gates+1)*1000-s.alt))+' m');
  $('lfPosition6').style.left=s.x+'%';$('lfTarget6').style.left=target(s.alt)+'%';
  $('lfCountdown6').hidden=s.phase!=='countdown';if(s.phase==='countdown')text('lfCountdown6',Math.max(1,Math.ceil(3-s.phaseTime)));
  text('lfAbortReason6',s.reason);text('lfAbortAdvice6',s.failedStage==='preflight'?'Read the system order and fault diagnosis. You have 45 seconds for the check.':'Use ◀ and ▶ to track the green zone. Keep thrust at 54–70%. Your ship is restored at the last beacon.');
  $('lfStatus6').hidden=s.phase==='complete';text('lfStatus6',status());
 }
 function resize(){width=scene.clientWidth;height=scene.clientHeight;if(!width||!height)return;dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);shipSize=Math.max(56,Math.min(135,width*.30,(height-65)*1.5));ship.style.width=shipSize+'px';hudHeight=scene.querySelector('.lf-telemetry').offsetHeight;if(s)draw();}
 new ResizeObserver(resize).observe(scene);
 const glowTexture=document.createElement('canvas');glowTexture.width=glowTexture.height=64;
 {const g=glowTexture.getContext('2d');if(g){const r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,'#ecffff');r.addColorStop(.15,'#99edffb0');r.addColorStop(.45,'#56bfff30');r.addColorStop(1,'#56bfff00');g.fillStyle=r;g.fillRect(0,0,64,64);}}
 function glow(x,y,r,a){ctx.globalAlpha=a;ctx.drawImage(glowTexture,x-r,y-r,r*2,r*2);}
 function draw(){
  if(!s||!width||!height)return;
  const flight=['flight','orbit','complete'].includes(s.phase)||s.phase==='abort'&&s.failedStage==='flight';
  const rise=clamp(s.alt/500,0,1),reduced=motionMedia.matches||window.MKTYExperience?.effectsReduced;
  const y=Math.min((flight?(.69-rise*.23):.71)*height,height-hudHeight-14-shipSize*.33),x=s.x/100*width,time=reduced?0:s.elapsed;
  const orbit=s.phase==='orbit'?s.phaseTime/3:s.phase==='complete'?1:0;
  ship.style.left=s.x+'%';ship.style.top=y+'px';ship.style.transform='translate(-50%,-50%) rotate('+clamp(s.vx*.45,-9,9)+'deg) scale('+(1-orbit*.25)+')';
  scene.style.setProperty('--engine',String(flight?s.throttle/80:s.phase==='ignition'?.2+s.hold/4:s.phase==='countdown'?.9:.12));scene.style.setProperty('--orbit',String(Math.min(.85,s.alt/4000)));
  environment.style.transform='translateY('+(rise*height*.06)+'px) scale('+(1.04+rise*.12)+')';environment.style.opacity=String(1-clamp((s.alt-600)/1800,0,1));
  if(!ctx)return;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
  if(flight&&s.phase!=='complete'){
   ctx.save();ctx.strokeStyle='#abf7d05c';ctx.lineWidth=1;ctx.setLineDash([4,7]);
   for(const side of [-14,14]){ctx.beginPath();for(let d=-120;d<650;d+=20){const px=(target(s.alt+d)+side)/100*width,py=y-d/600*height;if(d===-120)ctx.moveTo(px,py);else ctx.lineTo(px,py);}ctx.stroke();}ctx.setLineDash([]);
   const next=(s.gates+1)*1000,gy=y-(next-s.alt)/600*height,gx=target(next)/100*width;
   if(s.gates<3&&gy>-30&&gy<height){ctx.strokeStyle='#adffcd';ctx.lineWidth=2;ctx.shadowColor='#80eec7';ctx.shadowBlur=reduced?0:12;ctx.beginPath();ctx.ellipse(gx,gy,width*.145,Math.min(14,height*.05),0,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;ctx.fillStyle='#d6ffe7';ctx.font='bold 10px monospace';ctx.fillText(String(s.gates+1).padStart(2,'0'),gx+width*.15+4,gy+3);}
   ctx.restore();
  }
  ctx.globalCompositeOperation='screen';
  const power=flight?s.throttle/100:s.phase==='ignition'?s.hold/4:s.phase==='countdown'?.7:.07;
  const spread=shipSize,engineY=y+spread*.17;
  for(const side of [-1,1]){
   const engineX=x+side*spread*.21;glow(engineX,engineY,18+power*12,.12+power*.4);
   const count=reduced?3:16;
   for(let i=0;i<count;i++){const t=(time*1.8+i/count)%1;glow(engineX+Math.sin(i*3.7+time*7)*t*7,engineY+t*(20+power*60),4+t*9,(1-t)*power*.42);}
  }
  if(s.alt<400&&!reduced){const energy=power*(1-s.alt/400);for(let i=0;i<18;i++){const t=(time*.55+i/18)%1,sign=i%2?1:-1;glow(width*.5+sign*t*width*.4,height*.85-t*16,9+t*24,(1-t)*energy*.16);}}
  if(flight&&!reduced)for(let i=0;i<18;i++){const sx=(i*79.7)%width,sy=(i*43.9+time*s.speed*.22)%height;ctx.globalAlpha=.15;ctx.strokeStyle='#c0e6ff';ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(sx,sy+2+s.speed*.035);ctx.stroke();}
  if(s.flash>.05&&!reduced){ctx.globalAlpha=s.flash*.35;ctx.strokeStyle='#d7ffcf';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y,30+(1-s.flash)*70,15+(1-s.flash)*35,0,0,Math.PI*2);ctx.stroke();}
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
 }
 function frame(now){
  frameId=0;if(!s||s.paused||!active()||document.hidden)return;
  const dt=clamp((now-last)/1000,0,.04);last=now;tick(dt);uiTime+=dt;saveTime+=dt;
  if(uiTime>=.1){render();uiTime=0;}if(now-paintTime>=32){draw();paintTime=now;}if(saveTime>=1){save();saveTime=0;}
  frameId=requestAnimationFrame(frame);
 }
 function startClock(){cancelAnimationFrame(frameId);last=performance.now();uiTime=saveTime=0;frameId=requestAnimationFrame(frame);}
 function pause(title='FLIGHT PAUSED'){
  if(!s||!active()||s.paused)return;release();s.paused=true;cancelAnimationFrame(frameId);frameId=0;save();focusBefore=document.activeElement;render();
  text('lfGuideTitle6',title);if(!guide.open)guide.showModal();guide.querySelector('.lf-guide-copy').scrollTop=0;$('lfResume6').focus({preventScroll:true});
 }
 function resume(){if(!s||!active()||document.hidden)return;if(guide.open)guide.close();s.paused=false;render();startClock();if(focusBefore?.isConnected&&!focusBefore.disabled&&focusBefore.getClientRects().length)focusBefore.focus({preventScroll:true});else $('liftoffHelp6').focus({preventScroll:true});}
 function stop(){if(active())save();cancelAnimationFrame(frameId);frameId=0;release();if(s)s.paused=true;if(guide.open)guide.close();}
 function open(){
  if(localStorage.getItem('mkty_life5')!=='complete'){show('chapters');return;}
  stop();cache.clear();s=fresh();const complete=localStorage.getItem('mkty_life6')==='complete',restored=!complete&&restore();
  if(complete){Object.assign(s,{phase:'complete',armed:4,faultSolved:true,alt:3000,gates:3,throttle:0,speed:0,x:50});text('lfReward6','MISSION COMPLETE');try{localStorage.removeItem(KEY);}catch{}}
  show('mission6');resize();render();draw();if(restored)pause('SAVED SESSION RESTORED');else startClock();
 }
 function bindHold(id,set){
  const b=$(id),pointers=new Set(),keys=new Set();
  const release=()=>{pointers.clear();keys.clear();set(false);b.classList.remove('held');};controls.push(release);
  const allowed=()=>s&&!s.paused&&active()&&(id==='lfIgnite6'?s.phase==='ignition':s.phase==='flight');
  const sync=()=>{const held=allowed()&&(pointers.size>0||keys.size>0);set(held);b.classList.toggle('held',held);};
  b.addEventListener('pointerdown',e=>{if(e.button!==0||b.disabled||!allowed())return;e.preventDefault();pointers.add(e.pointerId);b.setPointerCapture?.(e.pointerId);sync();});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(type,e=>{pointers.delete(e.pointerId);sync();});
  b.addEventListener('keydown',e=>{if(![' ','Enter'].includes(e.key)||!allowed())return;e.preventDefault();keys.add(e.key);sync();});
  b.addEventListener('keyup',e=>{if(![' ','Enter'].includes(e.key))return;e.preventDefault();keys.delete(e.key);sync();});b.addEventListener('blur',release);
 }
 bindHold('lfIgnite6',v=>ignitionHeld=v);bindHold('lfLeft6',v=>leftHeld=v);bindHold('lfRight6',v=>rightHeld=v);
 $('lfBegin6').onclick=begin;root.querySelectorAll('[data-lf-system]').forEach(b=>b.onclick=()=>arm(b.dataset.lfSystem));root.querySelectorAll('[data-lf-response]').forEach(b=>b.onclick=()=>repair(b.dataset.lfResponse));
 function throttle(value){if(!s||s.paused||!active()||!['ignition','flight'].includes(s.phase))return;s.throttle=clamp(Math.round(value),0,100);render();save();}
 $('lfThrottle6').oninput=e=>throttle(Number(e.target.value));$('lfThrustDown6').onclick=()=>throttle(s.throttle-1);$('lfThrustUp6').onclick=()=>throttle(s.throttle+1);
 $('lfRetry6').onclick=retry;$('liftoffHelp6').onclick=()=>pause();$('lfResume6').onclick=resume;$('lfExit6').onclick=()=>show('chapters');$('life6ReturnBtn').onclick=()=>show('home');
 guide.addEventListener('cancel',e=>{e.preventDefault();resume();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&active())pause();});window.addEventListener('pagehide',()=>{if(active())pause();});window.addEventListener('blur',()=>{if(active())pause();else release();});
 return {open,stop};
})();
function startLife6(){playLifeCinematic(6,openMission6);}
function openMission6(){Liftoff6.open();}
function stopLiftoff6(){Liftoff6.stop();}
