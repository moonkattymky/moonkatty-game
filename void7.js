/* LIFE 7. One clock owns motion, warnings, collisions and checkpoints. */
window.Void7=(()=>{
 const root=$('mission7'),world=$('voidWorld7'),field=$('asteroidField');
 const KEY='mkty_campaign_checkpoint_7',REPORT='mkty_void7_report_v2',DURATION=72;
 const lanes=[.22,.5,.78],panels={briefing:'v7Brief',flight:'v7Controls',abort:'v7Abort',approach:'v7Approach',complete:'life7Complete'};
 const fx=Void7FX.create({world,canvas:$('voidCanvas7'),ship:$('voidShip'),bubble:$('shieldBubble7')});
 const savedFields=['phase','lane','x','hull','shields','distance','shieldActive','nextWave','seed','lastSafe','elapsed','timeKnown','attempts','evaded','blocked','hits','phaseTime','grace'];
 const cache=new Map(),releases=[];let s=null,frame=0,last=0,paintAt=0,uiAt=0,saveAt=0,held=0,holdTime=0,repeat=0,swipe=null;
 const active=()=>root.classList.contains('active'),paused=()=>document.hidden||window.MKTYExperience?.paused;
 const finite=(v,a,b)=>Number.isFinite(v)&&v>=a&&v<=b,integer=(v,a,b)=>Number.isInteger(v)&&finite(v,a,b);
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),sector=d=>Math.min(2,Math.floor(d/(100/3))),canFly=()=>active()&&s?.phase==='flight'&&!paused();
 const text=(id,value)=>{value=String(value);if(cache.get(id)!==value){cache.set(id,value);$(id).textContent=value;}};
 function fresh(){return {phase:'briefing',lane:1,x:.5,hull:100,shields:3,distance:0,shieldActive:false,rocks:[],nextWave:1.4,seed:Math.floor(Math.random()*0xffffffff),lastSafe:1,elapsed:0,timeKnown:true,attempts:0,evaded:0,blocked:0,hits:0,phaseTime:0,grace:0,notice:'',noticeFor:0,checkpointFor:0,flash:0,flashKind:'shield',impact:null,report:null};}
 function random(){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
 function clearRocks(){field.replaceChildren();if(s)s.rocks=[];}
 function addRock(data){const el=document.createElement('span');el.className='asteroid7 '+(data.big?'big':'small');el.dataset.lane=data.lane;el.setAttribute('aria-hidden','true');field.append(el);s.rocks.push({...data,el});}
 function save(){
  if(!s||s.phase==='complete')return;
  const v={version:2};for(const k of savedFields)v[k]=s[k];
  v.rocks=s.rocks.map(({el,...r})=>r);
  try{localStorage.setItem(KEY,JSON.stringify(v));}catch{/* A full device must not interrupt the flight. */}
 }
 function restore(){
  try{
   const v=JSON.parse(localStorage.getItem(KEY)||'null');if(!v)return false;
   if(v.version===1){
    if(!integer(v.lane,0,2)||!finite(v.hull,1,100)||!integer(v.shields,0,3)||!finite(v.distance,0,99.999)||typeof v.shieldActive!=='boolean')return false;
    // Preserve legacy progress and supplies; the new trajectory begins with a safe warning window.
    Object.assign(s,{phase:'flight',lane:v.lane,x:lanes[v.lane],hull:v.hull,shields:v.shields,distance:v.distance,shieldActive:v.shieldActive,timeKnown:false,nextWave:2.2,grace:1.2});save();return true;
   }
   if(v.version!==2||!['briefing','flight','abort','approach'].includes(v.phase))return false;
   const ranges={x:[.22,.78],hull:[0,100],distance:[0,100],nextWave:[0,5],elapsed:[0,1e6],phaseTime:[0,3],grace:[0,2]};
   if(Object.entries(ranges).some(([k,[a,b]])=>!finite(v[k],a,b)))return false;
   if(!integer(v.lane,0,2)||!integer(v.shields,0,3)||!integer(v.seed,0,0xffffffff)||!integer(v.lastSafe,0,2)||!['attempts','evaded','blocked','hits'].every(k=>integer(v[k],0,1e6)))return false;
   if(typeof v.shieldActive!=='boolean'||typeof v.timeKnown!=='boolean')return false;
   if(v.phase==='flight'&&(v.hull<=0||v.distance>=100)||v.phase==='approach'&&(v.distance!==100||v.hull<=0)||v.phase==='abort'&&v.hull!==0||v.phase==='briefing'&&v.distance!==0)return false;
   if(!Array.isArray(v.rocks)||v.rocks.length>6||v.rocks.some(r=>!r||!integer(r.lane,0,2)||typeof r.big!=='boolean'||!finite(r.duration,2,5)||!finite(r.age,-1,5)||r.age>r.duration||!finite(r.rotation,0,360)||!finite(r.spin,-90,90)))return false;
   if(v.phase!=='flight'&&v.rocks.length)return false;
   for(const k of savedFields)s[k]=v[k];
   v.rocks.forEach(addRock);return true;
  }catch{return false;}
 }
 function release(){held=0;holdTime=repeat=0;swipe=null;releases.forEach(fn=>fn());}
 function notice(value){s.notice=value;s.noticeFor=3.2;text('voidStatus',value);}
 function feedback(kind){window.MKTYExperience?.signal(kind);tg?.HapticFeedback?.notificationOccurred?.(kind==='error'?'error':'success');}
 function enter(phase){release();s.phase=phase;s.phaseTime=0;render();fx.resize();render();fx.layout(s);fx.draw(s);save();}
 function begin(){if(!active()||!s||paused()||s.phase!=='briefing')return;enter('flight');notice('Watch the amber markers. Keep a clear lane.');startLoop();}
 function move(direction){if(!canFly())return;s.lane=clamp(s.lane+direction,0,2);render();}
 function shield(){if(!canFly()||s.shields===0||s.shieldActive)return;s.shields--;s.shieldActive=true;notice('Shield armed. One impact protected.');window.MKTYExperience?.signal('success');render();save();}
 function wave(){
  const n=sector(s.distance);let safe=Math.floor(random()*3);if(Math.abs(safe-s.lastSafe)>1)safe=1;s.lastSafe=safe;
  let occupied=[0,1,2].filter(l=>l!==safe);if(n===0&&random()<.55)occupied=occupied.slice(0,1);
  const duration=[3.5,3.25,3][n];for(const lane of occupied)addRock({lane,big:random()<.35,age:-.95,duration,rotation:random()*360,spin:(random()-.5)*70});
  s.nextWave=[4.5,4.25,4][n];
 }
 function checkpoint(){clearRocks();s.hull=Math.min(100,s.hull+12);s.shields=Math.min(3,s.shields+1);s.nextWave=2.1;s.checkpointFor=2;s.grace=.8;notice('Sector saved. Hull repaired; one shield charge restored.');feedback('success');save();}
 function fail(){window.MKTYPace?.fail(7,'core','c7:hull:'+Date.now());s.hull=0;clearRocks();s.shieldActive=false;notice('Flight interrupted. Your last sector is preserved.');feedback('error');enter('abort');}
 function retry(){if(!active()||!s||paused()||s.phase!=='abort')return;Object.assign(s,{distance:sector(s.distance)*100/3,lane:1,x:.5,hull:100,shields:3,shieldActive:false,nextWave:1.8,grace:1,attempts:s.attempts+1,checkpointFor:0,flash:0,noticeFor:0});clearRocks();enter('flight');notice('Supplies restored. Resume from the last sector.');startLoop();}
 function finish(){
  s.report={time:s.timeKnown?s.elapsed:null,hull:s.hull,shields:s.shields,evaded:s.evaded,blocked:s.blocked,attempts:s.attempts};
  try{localStorage.setItem(REPORT,JSON.stringify({version:2,...s.report}));}catch{}
  const rewarded=localStorage.getItem('mkty_life7_awarded')==='yes';awardLifePoints(7,1750);unlockLife8();try{localStorage.removeItem(KEY);}catch{}
  enter('complete');text('v7Reward',rewarded?'MISSION COMPLETE':'+1750 MOON POINTS');notice('Transmission gate reached. Follow the signal.');feedback('complete');
 }
 function tick(dt){
  s.noticeFor=Math.max(0,s.noticeFor-dt);s.checkpointFor=Math.max(0,s.checkpointFor-dt);s.flash=Math.max(0,s.flash-dt*2.2);
  if(s.phase==='approach'){s.phaseTime+=dt;if(s.phaseTime>=2.4)finish();return;}
  if(s.phase!=='flight')return;
  s.elapsed+=dt;s.grace=Math.max(0,s.grace-dt);
  if(held){holdTime+=dt;if(holdTime>=.3){repeat+=dt;if(repeat>=.22){move(held);repeat=0;}}}
  s.x+=(lanes[s.lane]-s.x)*(1-Math.exp(-dt*20));if(Math.abs(lanes[s.lane]-s.x)<.0001)s.x=lanes[s.lane];
  const oldSector=sector(s.distance);s.distance=Math.min(100,s.distance+dt*100/DURATION);
  if(s.distance>=100){clearRocks();s.shieldActive=false;enter('approach');notice('All three sectors crossed. Approaching the gate.');return;}
  if(sector(s.distance)!==oldSector)checkpoint();
  s.nextWave=Math.max(0,s.nextWave-dt);if(s.nextWave===0)wave();
  const g=fx.geometry(),shipX=s.x*g.w,shipY=g.shipY;
  for(const r of [...s.rocks]){
   const size=fx.rockSize(r),oldY=fx.rockY(r);r.age+=dt;const y=fx.rockY(r),radius=size*.33;
   const overlap=r.age>=0&&Math.abs(lanes[r.lane]*g.w-shipX)<radius+g.shipW*.28&&y+radius>=shipY-g.shipH*.23&&oldY-radius<=shipY+g.shipH*.23;
   if(overlap&&s.grace<=0){
    r.el.remove();s.rocks=s.rocks.filter(x=>x!==r);s.flash=1;s.impact={x:lanes[r.lane],y:clamp(y/g.h,0,1)};s.grace=.45;
    if(s.shieldActive){s.shieldActive=false;s.blocked++;s.flashKind='shield';notice('Impact absorbed. Shield charge spent.');feedback('success');}
    else{s.hull=Math.max(0,s.hull-(r.big?28:18));s.hits++;s.flashKind='hull';notice('Hull impact. Move to a clear lane or arm a shield.');feedback('error');}
    render();if(s.hull<=0){fail();return;}
   }else if(r.age>=r.duration){r.el.remove();s.rocks=s.rocks.filter(x=>x!==r);s.evaded++;}
  }
 }
 function render(){
  if(!s)return;root.dataset.phase=s.phase;root.dataset.damaged=String(s.hull<=35);root.dataset.shield=String(s.shieldActive);
  for(const [phase,id] of Object.entries(panels))$(id).hidden=s.phase!==phase;
  $('v7FlightNote').hidden=s.phase!=='flight';$('v7Checkpoint').hidden=s.checkpointFor<=0||s.phase!=='flight';
  text('hull7',Math.round(s.hull));text('distance7',Math.floor(s.distance+1e-6));text('shield7',s.shields);
  $('hullFill7').style.transform='scaleX('+s.hull/100+')';$('v7DistanceFill').style.transform='scaleX('+s.distance/100+')';
  $('shieldBtn').disabled=s.shields===0||s.shieldActive||s.phase!=='flight';$('shieldBtn').setAttribute('aria-pressed',String(s.shieldActive));
  text('v7ShieldState',s.shieldActive?'SHIELD ACTIVE':s.shields?'ARM SHIELD':'NO CHARGES');
  $('voidLeft').disabled=s.lane===0;$('voidRight').disabled=s.lane===2;
  [...$('v7Charges').children].forEach((e,i)=>e.classList.toggle('charged',i<s.shields));
  const n=sector(s.distance);root.dataset.sector=String(n);text('v7Sector',String(n+1).padStart(2,'0')+' / 03');
  root.querySelectorAll('.v7-route li').forEach((el,i)=>{el.classList.toggle('current',i===n&&s.distance<100);el.classList.toggle('done',i<n||s.distance>=100);el.style.setProperty('--sector-fill',clamp(s.distance/100*3-i,0,1));});
  const threats=fx.threats(s),currentThreat=threats[s.lane];root.dataset.alert=String(currentThreat.active&&currentThreat.critical&&!s.shieldActive);
  root.querySelectorAll('[data-v7-lane]').forEach((e,i)=>{e.classList.toggle('danger',threats[i].active);e.classList.toggle('critical',threats[i].active&&threats[i].critical&&s.lane===i);e.classList.toggle('selected',s.lane===i);});
  root.querySelectorAll('[data-v7-radar]').forEach((e,i)=>{e.classList.toggle('danger',threats[i].active);e.classList.toggle('selected',s.lane===i);e.style.setProperty('--contact',Math.min(.83,threats[i].progress));});
  text('v7LaneRead',['LEFT LANE','CENTER LANE','RIGHT LANE'][s.lane]);text('v7ThreatRead',s.shieldActive?'SHIELD ONLINE':currentThreat.active?(currentThreat.critical?'EVADE NOW':'INCOMING'):'LANE CLEAR');
  text('v7SceneTitle',s.phase==='briefing'?'TRAJECTORY PREVIEW':s.phase==='abort'?'EMERGENCY BEACON':s.distance>=100?'SIGNAL CORRIDOR':['OUTER BELT','DEBRIS FIELD','SIGNAL GATE'][n]);
  text('v7SceneState',s.shieldActive?'SHIELD ONLINE':s.phase==='flight'?'GUIDANCE ONLINE':s.phase==='abort'?'RECOVERY READY':s.phase==='complete'?'TRANSMISSION ACQUIRED':'GUIDANCE ONLINE');
  if(s.noticeFor<=0)text('voidStatus',s.phase==='briefing'?'The next signal lies beyond the belt.':s.phase==='flight'?'Amber means incoming debris. Keep a clear lane.':s.phase==='abort'?'Flight interrupted. Your last sector is preserved.':s.phase==='complete'?'Transmission gate reached. Follow the signal.':'All three sectors crossed. Approaching the gate.');
  $('v7Report').hidden=!s.report;if(s.report){const t=s.report.time===null?null:Math.round(s.report.time);text('v7ReportTime',t===null?'—':String(Math.floor(t/60)).padStart(2,'0')+':'+String(Math.floor(t%60)).padStart(2,'0'));text('v7ReportHull',Math.round(s.report.hull)+'%');text('v7ReportEvades',s.report.evaded);}
 }
 function loop(now){
  frame=0;if(!active()||!s)return;const dt=last?Math.min(.08,Math.max(0,(now-last)/1000)):0;last=now;
  if(!paused()){
   let remaining=dt;while(remaining>0){const step=Math.min(1/60,remaining);tick(step);remaining-=step;}
   fx.layout(s);if(now-paintAt>=33){fx.draw(s);paintAt=now;}if(now-uiAt>=100){render();uiAt=now;}if(now-saveAt>=1000){save();saveAt=now;}
  }else release();
  if(['flight','approach'].includes(s.phase)||s.flash>0)frame=requestAnimationFrame(loop);
 }
 function startLoop(){if(!frame){last=0;frame=requestAnimationFrame(loop);}}
 function stop(){if(s&&active())save();cancelAnimationFrame(frame);frame=0;last=0;release();clearRocks();s=null;}
 function open(){
  stop();show('mission7');s=fresh();clearRocks();cache.clear();
  const done=localStorage.getItem('mkty_life7')==='complete'&&!window.MKTYOps?.isRun(7);let restored=false;
  if(done){s.phase='complete';s.distance=100;try{const v=JSON.parse(localStorage.getItem(REPORT)||'null');if(v?.version===2&&(v.time===null||finite(v.time,0,1e6))&&finite(v.hull,1,100)&&integer(v.evaded,0,1e6)){s.report=v;s.hull=v.hull;if(integer(v.shields,0,3))s.shields=v.shields;}}catch{}text('v7Reward','MISSION COMPLETE');}
  else restored=restore();
  render();fx.resize();render();fx.layout(s);fx.draw(s);if(restored&&['flight','approach'].includes(s.phase))window.MKTYExperience?.pause();
  if(['flight','approach'].includes(s.phase))startLoop();else save();
 }
 function bindHold(id,direction){
  const el=$(id);let pressed=false;
  const off=()=>{if(pressed){pressed=false;held=0;holdTime=repeat=0;}};releases.push(off);
  el.addEventListener('pointerdown',e=>{if(!canFly()||e.button!==0)return;e.preventDefault();pressed=true;held=direction;holdTime=repeat=0;el.setPointerCapture?.(e.pointerId);move(direction);});
  for(const type of ['pointerup','pointercancel','lostpointercapture','blur'])el.addEventListener(type,off);
  el.addEventListener('click',e=>{if(e.detail===0)move(direction);});
 }
 bindHold('voidLeft',-1);bindHold('voidRight',1);$('shieldBtn').onclick=shield;$('v7Begin').onclick=begin;$('v7Retry').onclick=retry;
 document.addEventListener('keydown',e=>{if(!canFly()||e.altKey||e.ctrlKey||e.metaKey)return;if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();if(!e.repeat){held=e.key==='ArrowLeft'?-1:1;holdTime=repeat=0;move(held);}}else if(e.code==='Space'){e.preventDefault();if(!e.repeat)shield();}});
 document.addEventListener('keyup',e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){held=0;holdTime=repeat=0;}});
 world.addEventListener('pointerdown',e=>{if(canFly()){swipe={id:e.pointerId,x:e.clientX,y:e.clientY};world.setPointerCapture?.(e.pointerId);}});
 world.addEventListener('pointerup',e=>{if(swipe?.id===e.pointerId){const dx=e.clientX-swipe.x,dy=e.clientY-swipe.y;if(Math.abs(dx)>24&&Math.abs(dx)>Math.abs(dy))move(Math.sign(dx));swipe=null;}});
 world.addEventListener('pointercancel',()=>swipe=null);window.addEventListener('blur',release);
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&active()){release();save();}last=0;});window.addEventListener('pagehide',()=>{if(active())save();});
 new ResizeObserver(()=>{if(active()&&s){fx.resize();render();fx.layout(s);fx.draw(s);}}).observe(world);
 return {open,stop,save};
})();
