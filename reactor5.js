/* LIFE 5 — display-synchronized simulation with interruptible input and local checkpoints.
   Visual motion updates each animation frame; accessible readouts update at 10 Hz. */
const Reactor5 = (() => {
 const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
 const controls=[];
 const textCache=new Map();
 let state=null,frameId=null,lastTick=0,uiElapsed=0,saveElapsed=0,returnFocus=null,panelAnimation=null;
 const checkpointKey='mkty_reactor5_checkpoint_v2';
 const root=$('mission5');
 const cellButtons=[...root.querySelectorAll('[data-reactor-cell]')];
 const phasePanels={charge:$('reactorChargePanel5'),balance:$('reactorBalancePanel5'),ignite:$('reactorIgnitePanel5'),fault:$('reactorFaultPanel5')};
 const pulseCenters=[32,68,49];
 const effects=createReactor5Effects(root);
 const refs=Object.fromEntries(['reactorChargeArc5','reactorHeatFill5','reactorTempNeedle5','reactorFieldNeedle5','reactorHoldFill5','reactorPulseNeedle5'].map(id=>[id,$(id)]));
 const cellFills=cellButtons.map(b=>b.querySelector('.cell-vessel5 i'));
 const cellArcs=['A','B','C'].map(letter=>$('reactorCellArc'+letter+'5'));
 function saveCheckpoint(){
  if(!state||state.phase==='online')return;
  const data={version:2,phase:state.phase,cells:state.cells,selected:state.selected,temp:state.temp,field:state.field,fieldTarget:state.fieldTarget,flow:state.flow,trim:state.trim,pulses:state.pulses,elapsed:state.elapsed};
  try{localStorage.setItem(checkpointKey,JSON.stringify(data));}catch{/* A full storage quota must never interrupt play. */}
 }
 function restoreCheckpoint(){
  try{
   const v=JSON.parse(localStorage.getItem(checkpointKey)||'null');
   if(!v||v.version!==2||!['charge','balance','ignite','fault','startup'].includes(v.phase)||!Array.isArray(v.cells)||v.cells.length!==3)return false;
   if(!v.cells.every(x=>Number.isFinite(x)&&x>=0&&x<=100))return false;
   for(const k of ['selected','temp','field','fieldTarget','flow','trim','pulses','elapsed'])if(!Number.isFinite(v[k]))return false;
   if(v.selected<0||v.selected>2||!Number.isInteger(v.selected)||v.pulses<0||v.pulses>3||!Number.isInteger(v.pulses))return false;
   if(v.phase!=='charge'&&v.phase!=='fault'&&!v.cells.every(x=>x===100))return false;
   if(v.phase==='startup'&&v.pulses!==3)return false;
   if(v.phase==='ignite'&&v.pulses>2)return false;
   Object.assign(state,{phase:v.phase,cells:v.cells.slice(),selected:v.selected,temp:clamp(v.temp,15,96),field:clamp(v.field,0,100),fieldTarget:clamp(v.fieldTarget,42,66),flow:clamp(v.flow,0,100),trim:clamp(v.trim,0,100),pulses:Math.min(v.pulses,3),elapsed:Math.max(0,v.elapsed)});
   if(state.phase==='charge'&&state.cells[state.selected]===100)state.selected=Math.max(0,state.cells.findIndex(x=>x<100));
   return true;
  }catch{return false;}
 }
 function clearCheckpoint(){try{localStorage.removeItem(checkpointKey);}catch{}}
 function renderMotion(){
  if(!state)return;
  const total=state.cells.reduce((a,b)=>a+b,0)/3;
  root.style.setProperty('--core-dim',((1-total/100)*.72).toFixed(3));
  root.style.setProperty('--core-light',(state.phase==='startup'?.3+state.startup*.13:state.phase==='online'?.44:.07+total*.0017).toFixed(3));
  root.style.setProperty('--startup-progress',String(Math.min(1,state.startup/2.4)));
  refs.reactorChargeArc5.setAttribute('stroke-dasharray',total.toFixed(2)+' 100');
  state.cells.forEach((value,i)=>{cellFills[i].style.transform='scaleY('+(value/100).toFixed(4)+')';cellArcs[i].setAttribute('stroke-dasharray',(value*.89).toFixed(2)+' 300');});
  refs.reactorHeatFill5.style.transform='scaleX('+(state.temp/100).toFixed(4)+')';
  refs.reactorTempNeedle5.style.left=state.temp+'%';refs.reactorFieldNeedle5.style.left=state.field+'%';
  refs.reactorHoldFill5.style.transform='scaleX('+(state.hold/3).toFixed(4)+')';
  refs.reactorPulseNeedle5.style.left=state.pulsePosition+'%';
 }
 function text(id,value){const v=String(value);if(textCache.get(id)===v)return;textCache.set(id,v);$(id).textContent=v;}
 function active(){return root.classList.contains('active');}
 function setStatus(message){state.status=message;text('ignitionStatus',message);}
 function release(){controls.forEach(c=>c.release());if(state){state.chargeHeld=state.coolHeld=false;state.chargeTap=state.coolTap=0;}}
 function inWindow(){return state.temp>=45&&state.temp<=68&&state.field>=45&&state.field<=55;}
 function enter(phase,message){
  release();state.phase=phase;root.dataset.reactorPhase=phase;
  const shown=phase==='startup'?'ignite':phase;
  for(const [name,panel] of Object.entries(phasePanels)){panel.hidden=name!==shown;panel.inert=name!==shown;}
  panelAnimation?.cancel();
  const panel=phasePanels[shown];
  if(panel&&!effects.reduced)panelAnimation=panel.animate([{opacity:0,transform:'translateY(7px)'},{opacity:1,transform:'translateY(0)'}],{duration:260,easing:'cubic-bezier(.2,.7,.2,1)'});
  $('reactorConsole5').hidden=phase==='online';$('life5Complete').hidden=phase!=='online';$('ignitionStatus').hidden=phase==='online';
  const step=phase==='online'?3:phase==='balance'?1:(phase==='ignite'||phase==='startup')?2:0;
  text('reactorStageCount5',String(Math.min(3,step+1)).padStart(2,'0')+' / 03');
  root.querySelectorAll('[data-reactor-step]').forEach((el,i)=>{el.classList.toggle('current',i===step);el.classList.toggle('done',i<step);if(i===step)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');});
  if(message)setStatus(message);render();saveCheckpoint();
 }
 function frame(now){
  frameId=null;
  if(!active()||!state||state.paused||document.hidden)return;
  const dt=Math.min(.05,Math.max(0,(now-lastTick)/1000));lastTick=now;
  tick(dt);renderMotion();uiElapsed+=dt;saveElapsed+=dt;
  if(uiElapsed>=.1){render();uiElapsed=0;}
  effects.draw(state,dt);
  if(saveElapsed>=2){saveCheckpoint();saveElapsed=0;}
  frameId=requestAnimationFrame(frame);
 }
 function startClock(){cancelAnimationFrame(frameId);lastTick=performance.now();uiElapsed=saveElapsed=0;frameId=requestAnimationFrame(frame);}
 function open(){
  stop();textCache.clear();
  state={phase:'charge',cells:[0,0,0],selected:0,temp:22,field:15,fieldTarget:42+Math.random()*24,flow:25,trim:30,hold:0,elapsed:0,chargeHeld:false,coolHeld:false,chargeTap:0,coolTap:0,paused:false,pulses:0,pulseState:'ready',pulseTime:0,pulsePosition:0,pulseDelay:0,startup:0,status:''};
  const completed=localStorage.getItem('mkty_life5')==='complete'&&!window.MKTYOps?.isRun(5);
  const restored=!completed&&restoreCheckpoint();
  if(completed){clearCheckpoint();Object.assign(state,{phase:'online',cells:[100,100,100],temp:55,field:50,flow:50,trim:50,pulses:3,startup:2.4});text('reactorReward5','MISSION COMPLETE');}
  $('coolantFlow5').value=state.flow;$('fieldTrim5').value=state.trim;root.dataset.paused='false';root.dataset.pulseResult='';
  $('reactorOverlay5').hidden=true;$('reactorWorkspace5').inert=false;$('reactorHelp5').disabled=false;
  show('mission5');effects.start();
  const messages={charge:'Select a cell. Hold CHARGE to route power.',balance:'All cells online. Calibrate coolant and magnetic field.',ignite:'Core locked. Start the ignition sweep.',fault:'Thermal protection active. Completed cells are saved.',startup:'Three pulses accepted. Reactor coming online…'};
  enter(state.phase,messages[state.phase]);effects.draw(state,0);
  if(restored)pause('SAVED SESSION RESTORED');else startClock();
 }
 function stop(){saveCheckpoint();cancelAnimationFrame(frameId);frameId=null;panelAnimation?.cancel();effects.stop();release();if(state)state.paused=true;root.dataset.paused='true';$('reactorOverlay5').hidden=true;$('reactorWorkspace5').inert=false;}
 function tick(dt){
  state.elapsed+=dt;state.chargeTap=Math.max(0,state.chargeTap-dt);state.coolTap=Math.max(0,state.coolTap-dt);
  if(state.phase==='charge'){
   const cooling=state.coolHeld||state.coolTap>0,charging=(state.chargeHeld||state.chargeTap>0)&&!cooling;
   state.temp+=((charging?8:0)-(cooling?20:0)-(state.temp-22)*.07)*dt;state.temp=clamp(state.temp,15,100);
   if(state.temp>=96){effects.signal('fault');enter('fault','Thermal protection active. Completed cells are saved.');return;}
   if(charging){
    state.cells[state.selected]=Math.min(100,state.cells[state.selected]+12*dt);
    if(state.cells[state.selected]>=100){
     state.cells[state.selected]=100;effects.signal('cell');tg?.HapticFeedback?.impactOccurred?.('light');
     if(state.cells.every(v=>v===100)){state.field=15;state.hold=0;enter('balance','All cells online. Calibrate coolant and magnetic field.');}
     else{state.selected=state.cells.findIndex(v=>v<100);setStatus('Cell connected. Power routed to the next cell.');saveCheckpoint();}
    }
   }
  }else if(state.phase==='balance'){
   const thermalTarget=86-state.flow*.62;
   state.temp+=(thermalTarget-state.temp)*(1-Math.exp(-dt*1.15));
   const fieldTarget=50+(state.trim-state.fieldTarget)*.8+Math.sin(state.elapsed*.7)*1.2;
   state.field=clamp(state.field+(fieldTarget-state.field)*(1-Math.exp(-dt*2.3)),0,100);
   state.hold=inWindow()?Math.min(3,state.hold+dt):0;
  }else if(state.phase==='ignite'){
   if(state.pulseState==='running'){state.pulseTime+=dt;const sweep=(state.pulseTime*42)%200;state.pulsePosition=sweep<=100?sweep:200-sweep;}
   else if(state.pulseState==='settle'){state.pulseDelay-=dt;if(state.pulseDelay<=0)startPulse();}
  }else if(state.phase==='startup'){
   state.startup+=dt;if(state.startup>=2.4)finish();
  }
 }
 function render(){
  if(!state)return;
  const total=state.cells.reduce((a,b)=>a+b,0)/3,warning=state.temp>=78&&state.phase!=='online',ready=state.phase==='balance'&&inWindow()&&state.hold>=3;
  root.dataset.warning=String(warning);root.dataset.charging=String(state.phase==='charge'&&!state.paused&&(state.chargeHeld||state.chargeTap>0)&&!(state.coolHeld||state.coolTap>0));
  root.dataset.cooling=String(state.phase==='charge'&&!state.paused&&(state.coolHeld||state.coolTap>0));root.dataset.stable=String(state.phase==='online'||ready);
  renderMotion();
  text('reactorCoreOutput5',String(Math.round(total)).padStart(3,'0'));
  const labels={charge:'POWER ROUTING',balance:'CORE CALIBRATION',ignite:'CONTROLLED IGNITION',startup:'IGNITION IN PROGRESS',fault:'THERMAL PROTECTION',online:'REACTOR ONLINE'};
  text('reactorState5',labels[state.phase]);
  text('reactorLiveLabel5',state.phase==='online'?'ONLINE':state.phase==='fault'?'PROTECTION':state.paused?'PAUSED':root.dataset.cooling==='true'?'COOLING':state.phase==='charge'?(root.dataset.charging==='true'?'CHARGING':'STANDBY'):state.phase==='balance'?(ready?'STABLE':'CALIBRATING'):'IGNITION');
  root.dataset.pulseReady=String(state.phase==='ignite'&&state.pulseState==='running'&&Math.abs(state.pulsePosition-pulseCenters[state.pulses])<=10);
  cellButtons.forEach((button,i)=>{
   const full=state.cells[i]===100;button.disabled=state.phase!=='charge'||full||state.paused;button.classList.toggle('selected',state.selected===i&&!full);button.classList.toggle('charged',full);button.setAttribute('aria-pressed',String(state.selected===i&&!full));

   const value=Math.floor(state.cells[i])+'%';if(button.querySelector('output').textContent!==value)button.querySelector('output').textContent=value;
  });
  text('reactorSelectedCell5','ABC'[state.selected]);text('reactorChargeTemp5',Math.round(state.temp));
  text('reactorThermalState5',warning?'COOL NOW':root.dataset.cooling==='true'?'COOLING':'NOMINAL');
  root.querySelector('.reactor-thermal-track5').setAttribute('aria-valuenow',String(Math.round(state.temp)));
  $('chargeCore5').disabled=$('coolCore5').disabled=state.phase!=='charge'||state.paused;
  $('chargeCore5').classList.toggle('held',root.dataset.charging==='true');$('coolCore5').classList.toggle('held',root.dataset.cooling==='true');
  text('temp5',Math.round(state.temp));text('stabilityRead5',Math.round(state.field));
  text('reactorFlow5',state.flow+'%');text('reactorTrim5',state.trim+'%');

  $('reactorTempDial5').classList.toggle('safe',state.temp>=45&&state.temp<=68);$('reactorFieldDial5').classList.toggle('safe',state.field>=45&&state.field<=55);
  text('reactorHoldRead5',state.hold.toFixed(1)+' / 3.0 s');$('stabilizeBtn').disabled=!ready||state.paused;
  if(state.phase==='balance')text('ignitionStatus',ready?'Stable window confirmed. Lock the core.':inWindow()?'Both readings are green. Hold steady.':state.temp>68?'Too hot. Increase coolant flow and let the temperature settle.':state.temp<45?'Too cold. Reduce coolant flow and let the core warm up.':state.field<45?'Temperature is safe. Increase magnetic field trim.':'Temperature is safe. Reduce magnetic field trim.');
  else if(state.phase==='charge'&&warning)text('ignitionStatus','Temperature rising. Release CHARGE and hold COOL.');
  else text('ignitionStatus',state.status);
  const center=pulseCenters[Math.min(state.pulses,2)];$('reactorPulseWindow5').style.left=(center-10)+'%';$('reactorPulseWindow5').style.width='20%';
  $('reactorPulseTrack5').setAttribute('aria-valuenow',String(Math.round(state.pulsePosition)));
  text('reactorPulseCount5',String(Math.min(3,state.pulses+1)).padStart(2,'0')+' / 03');
  root.querySelectorAll('[data-reactor-pulse]').forEach((el,i)=>{el.classList.toggle('done',i<state.pulses);el.classList.toggle('current',i===state.pulses);});
  text('igniteBtn',state.phase==='startup'?'IGNITION IN PROGRESS':state.pulseState==='running'?'FIRE PULSE':state.pulseState==='miss'?'RETRY PULSE':state.pulseState==='settle'?'NEXT PULSE':'START IGNITION');
  $('igniteBtn').disabled=state.phase!=='ignite'||state.pulseState==='settle'||state.paused;
 }
 function startPulse(){state.pulseState='running';state.pulseTime=0;state.pulsePosition=0;root.dataset.pulseResult='';setStatus('Wait for the green window, then FIRE PULSE.');render();}
 function ignite(){
  if(!state||state.paused||state.phase!=='ignite')return;
  if(state.pulseState==='ready'||state.pulseState==='miss'){startPulse();render();return;}
  if(state.pulseState!=='running')return;
  if(Math.abs(state.pulsePosition-pulseCenters[state.pulses])>10){const forward=(state.pulseTime*42)%200<=100,early=forward?state.pulsePosition<pulseCenters[state.pulses]:state.pulsePosition>pulseCenters[state.pulses];state.pulseState='miss';root.dataset.pulseResult='miss';effects.signal('miss');setStatus(early?'Too early. Fire when the marker enters green. Previous pulses are saved.':'Too late. Fire before the marker leaves green. Previous pulses are saved.');tg?.HapticFeedback?.notificationOccurred?.('error');}
  // Save only restorable phases: enter('startup') owns the third-pulse write.
  else{state.pulses++;root.dataset.pulseResult='hit';effects.signal('pulse');if(state.pulses<3)saveCheckpoint();tg?.HapticFeedback?.impactOccurred?.('medium');if(state.pulses===3){state.startup=0;enter('startup','Three pulses accepted. Reactor coming online…');}else{state.pulseState='settle';state.pulseDelay=.65;setStatus('Pulse accepted. Prepare for the next green window.');}}
  render();
 }
 function finish(){
  clearCheckpoint();effects.signal('online');
  const rewarded=localStorage.getItem('mkty_life5_awarded')==='yes';awardLifePoints(5,1250);unlockLife6();
  text('reactorReward5',rewarded?'MISSION COMPLETE':'+1250 MOON POINTS');
  enter('online','Reactor online. Full power available for liftoff.');tg?.HapticFeedback?.notificationOccurred?.('success');
 }
 function pause(title='REACTOR PAUSED'){
  if(!state||!active()||state.paused)return;
  release();cancelAnimationFrame(frameId);frameId=null;state.paused=true;saveCheckpoint();panelAnimation?.pause();root.dataset.paused='true';returnFocus=document.activeElement;
  text('reactorOverlayTitle5',title);$('reactorOverlay5').hidden=false;$('reactorOverlay5').querySelector('.reactor-guide-copy5')?.scrollTo(0,0);$('reactorWorkspace5').inert=true;$('reactorHelp5').disabled=true;render();$('reactorResume5').focus({preventScroll:true});
 }
 function resume(){
  if(!state||!active())return;
  state.paused=false;root.dataset.paused='false';$('reactorOverlay5').hidden=true;$('reactorWorkspace5').inert=false;$('reactorHelp5').disabled=false;panelAnimation?.play();render();startClock();
  if(returnFocus?.isConnected&&!returnFocus.disabled&&returnFocus.getClientRects().length)returnFocus.focus({preventScroll:true});else $('reactorHelp5').focus({preventScroll:true});
 }
 function bindHold(id,name,tapName){
  const button=$(id),pointers=new Set(),keys=new Set();
  const sync=()=>{if(state)state[name]=active()&&state.phase==='charge'&&!state.paused&&(pointers.size>0||keys.size>0);};
  const release=()=>{pointers.clear();keys.clear();if(state)state[name]=false;button.classList.remove('held');};controls.push({release});
  button.addEventListener('pointerdown',e=>{if(e.button!==0||button.disabled||!active()||state?.paused)return;e.preventDefault();pointers.add(e.pointerId);button.setPointerCapture?.(e.pointerId);sync();render();});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,e=>{pointers.delete(e.pointerId);sync();render();});
  button.addEventListener('keydown',e=>{if(button.disabled||!active()||![' ','Enter'].includes(e.key))return;e.preventDefault();keys.add(e.key);sync();render();});
  button.addEventListener('keyup',e=>{if(![' ','Enter'].includes(e.key))return;e.preventDefault();keys.delete(e.key);sync();render();});
  button.addEventListener('blur',()=>{release();render();});
  // Assistive-technology clicks issue a short controllable charge/cool burst.
  button.addEventListener('click',e=>{if(e.detail===0&&active()&&state?.phase==='charge'&&!state.paused){state[tapName]=.7;render();}});
 }
 bindHold('chargeCore5','chargeHeld','chargeTap');bindHold('coolCore5','coolHeld','coolTap');
 cellButtons.forEach((button,i)=>button.addEventListener('click',()=>{if(!state||state.phase!=='charge'||state.paused||state.cells[i]===100)return;release();state.selected=i;setStatus('Cell selected. Hold CHARGE and monitor temperature.');render();}));
 for(const [id,key] of [['coolantFlow5','flow'],['fieldTrim5','trim']])$(id).addEventListener('input',()=>{if(!state||state.paused||state.phase!=='balance')return;state[key]=Number($(id).value);state.hold=0;render();});
 $('stabilizeBtn').onclick=()=>{if(!active()||!state||state.paused||state.phase!=='balance'||state.hold<3||!inWindow())return;state.pulses=0;state.pulseState='ready';effects.signal('lock');enter('ignite','Core locked. Start the ignition sweep.');};
 $('igniteBtn').onclick=ignite;
 $('reactorRetry5').onclick=()=>{if(!state||state.paused||state.phase!=='fault')return;state.cells=state.cells.map(v=>v===100?100:0);state.selected=state.cells.findIndex(v=>v<100);state.temp=22;effects.signal('cool');enter('charge','Chamber vented. Completed cells preserved. Continue charging.');};
 $('reactorHelp5').onclick=()=>pause('REACTOR GUIDE');$('reactorResume5').onclick=resume;
 $('reactorExit5').onclick=$('life5ReturnBtn').onclick=()=>show('home');
 $('reactorOverlay5').addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();resume();}else if(e.key==='Tab'){const focusable=[...$('reactorOverlay5').querySelectorAll('button:not(:disabled)')].filter(e=>e.getClientRects().length),first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
 window.addEventListener('blur',()=>{if(active()&&state?.phase!=='online'&&state?.phase!=='fault')pause();else release();});
 window.addEventListener('pagehide',()=>{if(active())pause();});
 document.addEventListener('visibilitychange',()=>{document.body.classList.toggle('mission-paused',document.hidden);if(document.hidden&&active())pause();});
 return {open,stop};
})();
function startLife5(){playLifeCinematic(5,openMission5);}
function openMission5(){Reactor5.open();}
function stopReactor5(){Reactor5.stop();}
