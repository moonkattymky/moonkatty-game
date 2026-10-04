/* LIFE 5 — one simulation, three explicit phases, no delayed work after exit. */
const Reactor5 = (() => {
 const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
 const controls=[];
 const textCache=new Map();
 let state=null,timer=null,lastTick=0,returnFocus=null;
 const root=$('mission5');
 const cellButtons=[...root.querySelectorAll('[data-reactor-cell]')];
 const phasePanels={charge:$('reactorChargePanel5'),balance:$('reactorBalancePanel5'),ignite:$('reactorIgnitePanel5'),fault:$('reactorFaultPanel5')};
 const pulseCenters=[32,68,49];
 function text(id,value){const v=String(value);if(textCache.get(id)===v)return;textCache.set(id,v);$(id).textContent=v;}
 function active(){return root.classList.contains('active');}
 function setStatus(message){state.status=message;text('ignitionStatus',message);}
 function release(){controls.forEach(c=>c.release());if(state){state.chargeHeld=state.coolHeld=false;state.chargeTap=state.coolTap=0;}}
 function inWindow(){return state.temp>=45&&state.temp<=68&&state.field>=45&&state.field<=55;}
 function enter(phase,message){
  release();state.phase=phase;root.dataset.reactorPhase=phase;
  const shown=phase==='startup'?'ignite':phase;
  for(const [name,panel] of Object.entries(phasePanels))panel.hidden=name!==shown;
  $('reactorConsole5').hidden=phase==='online';$('life5Complete').hidden=phase!=='online';$('ignitionStatus').hidden=phase==='online';
  const step=phase==='online'?3:phase==='balance'?1:(phase==='ignite'||phase==='startup')?2:0;
  text('reactorStageCount5',String(Math.min(3,step+1)).padStart(2,'0')+' / 03');
  root.querySelectorAll('[data-reactor-step]').forEach((el,i)=>{el.classList.toggle('current',i===step);el.classList.toggle('done',i<step);if(i===step)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');});
  if(message)setStatus(message);render();
 }
 function startClock(){clearInterval(timer);lastTick=performance.now();timer=setInterval(()=>{const now=performance.now(),dt=Math.min(.1,Math.max(0,(now-lastTick)/1000));lastTick=now;if(!active()||!state||state.paused||document.hidden)return;tick(dt);render();},50);}
 function open(){
  stop();textCache.clear();
  state={phase:'charge',cells:[0,0,0],selected:0,temp:22,field:15,fieldTarget:42+Math.random()*24,flow:25,trim:30,hold:0,elapsed:0,chargeHeld:false,coolHeld:false,chargeTap:0,coolTap:0,paused:false,pulses:0,pulseState:'ready',pulseTime:0,pulsePosition:0,pulseDelay:0,startup:0,status:''};
  $('coolantFlow5').value=25;$('fieldTrim5').value=30;root.dataset.paused='false';root.dataset.pulseResult='';
  $('reactorOverlay5').hidden=true;$('reactorWorkspace5').inert=false;$('reactorHelp5').disabled=false;
  show('mission5');enter('charge','Select a cell. Hold CHARGE to route power.');startClock();
 }
 function stop(){clearInterval(timer);timer=null;release();if(state)state.paused=true;root.dataset.paused='true';$('reactorOverlay5').hidden=true;$('reactorWorkspace5').inert=false;}
 function tick(dt){
  state.elapsed+=dt;state.chargeTap=Math.max(0,state.chargeTap-dt);state.coolTap=Math.max(0,state.coolTap-dt);
  if(state.phase==='charge'){
   const cooling=state.coolHeld||state.coolTap>0,charging=(state.chargeHeld||state.chargeTap>0)&&!cooling;
   state.temp+=((charging?8:0)-(cooling?20:0)-(state.temp-22)*.07)*dt;state.temp=clamp(state.temp,15,100);
   if(state.temp>=96){enter('fault','Thermal protection active. Completed cells are saved.');return;}
   if(charging){
    state.cells[state.selected]=Math.min(100,state.cells[state.selected]+12*dt);
    if(state.cells[state.selected]>=100){
     state.cells[state.selected]=100;tg?.HapticFeedback?.impactOccurred?.('light');
     if(state.cells.every(v=>v===100)){state.field=15;state.hold=0;enter('balance','All cells online. Calibrate coolant and magnetic field.');}
     else{release();state.selected=state.cells.findIndex(v=>v<100);setStatus('Cell connected. Select the next cell or hold CHARGE.');}
    }
   }
  }else if(state.phase==='balance'){
   const thermalTarget=86-state.flow*.62;
   state.temp+=(thermalTarget-state.temp)*Math.min(1,dt*1.15);
   const fieldTarget=50+(state.trim-state.fieldTarget)*.8+Math.sin(state.elapsed*.7)*1.2;
   state.field=clamp(state.field+(fieldTarget-state.field)*Math.min(1,dt*2.3),0,100);
   state.hold=inWindow()?Math.min(3,state.hold+dt):0;
  }else if(state.phase==='ignite'){
   if(state.pulseState==='running'){state.pulseTime+=dt;const sweep=(state.pulseTime*42)%200;state.pulsePosition=sweep<=100?sweep:200-sweep;}
   else if(state.pulseState==='settle'){state.pulseDelay-=dt;if(state.pulseDelay<=0)startPulse();}
  }else if(state.phase==='startup'){
   state.startup+=dt;if(state.startup>=1.6)finish();
  }
 }
 function render(){
  if(!state)return;
  const total=state.cells.reduce((a,b)=>a+b,0)/3,warning=state.temp>=78&&state.phase!=='online',ready=state.phase==='balance'&&inWindow()&&state.hold>=3;
  root.dataset.warning=String(warning);root.dataset.charging=String(state.phase==='charge'&&!state.paused&&(state.chargeHeld||state.chargeTap>0)&&!(state.coolHeld||state.coolTap>0));
  root.dataset.cooling=String(state.phase==='charge'&&!state.paused&&(state.coolHeld||state.coolTap>0));root.dataset.stable=String(state.phase==='online'||ready);
  root.style.setProperty('--core-dim',String((1-total/100)*.72));
  root.style.setProperty('--core-light',String(state.phase==='startup'?.3+state.startup*.25:state.phase==='online'?.44:.07+total*.0017));
  $('reactorChargeArc5').setAttribute('stroke-dasharray',total.toFixed(1)+' 100');
  text('reactorCoreOutput5',String(Math.round(total)).padStart(3,'0'));
  const labels={charge:'POWER ROUTING',balance:'CORE CALIBRATION',ignite:'CONTROLLED IGNITION',startup:'IGNITION IN PROGRESS',fault:'THERMAL PROTECTION',online:'REACTOR ONLINE'};
  text('reactorState5',labels[state.phase]);
  cellButtons.forEach((button,i)=>{
   const full=state.cells[i]===100;button.disabled=state.phase!=='charge'||full||state.paused;button.classList.toggle('selected',state.selected===i&&!full);button.classList.toggle('charged',full);button.setAttribute('aria-pressed',String(state.selected===i&&!full));
   button.querySelector('.cell-vessel5 i').style.height=state.cells[i]+'%';
   const value=Math.floor(state.cells[i])+'%';if(button.querySelector('output').textContent!==value)button.querySelector('output').textContent=value;
  });
  text('reactorSelectedCell5','ABC'[state.selected]);text('reactorChargeTemp5',Math.round(state.temp));
  text('reactorThermalState5',warning?'COOL NOW':root.dataset.cooling==='true'?'COOLING':'NOMINAL');
  $('reactorHeatFill5').style.width=state.temp+'%';root.querySelector('.reactor-thermal-track5').setAttribute('aria-valuenow',String(Math.round(state.temp)));
  $('chargeCore5').disabled=$('coolCore5').disabled=state.phase!=='charge'||state.paused;
  $('chargeCore5').classList.toggle('held',root.dataset.charging==='true');$('coolCore5').classList.toggle('held',root.dataset.cooling==='true');
  text('temp5',Math.round(state.temp));text('stabilityRead5',Math.round(state.field));
  text('reactorFlow5',state.flow+'%');text('reactorTrim5',state.trim+'%');
  $('reactorTempNeedle5').style.left=state.temp+'%';$('reactorFieldNeedle5').style.left=state.field+'%';
  $('reactorTempDial5').classList.toggle('safe',state.temp>=45&&state.temp<=68);$('reactorFieldDial5').classList.toggle('safe',state.field>=45&&state.field<=55);
  $('reactorHoldFill5').style.width=(state.hold/3*100)+'%';text('reactorHoldRead5',state.hold.toFixed(1)+' / 3.0 s');$('stabilizeBtn').disabled=!ready||state.paused;
  if(state.phase==='balance')text('ignitionStatus',ready?'Stable window confirmed. Lock the core.':inWindow()?'Both readings are green. Hold steady.':state.status);
  else if(state.phase==='charge'&&warning)text('ignitionStatus','Temperature rising. Release CHARGE and hold COOL.');
  else text('ignitionStatus',state.status);
  const center=pulseCenters[Math.min(state.pulses,2)];$('reactorPulseWindow5').style.left=(center-10)+'%';$('reactorPulseWindow5').style.width='20%';
  $('reactorPulseNeedle5').style.left=state.pulsePosition+'%';$('reactorPulseTrack5').setAttribute('aria-valuenow',String(Math.round(state.pulsePosition)));
  text('reactorPulseCount5',String(Math.min(3,state.pulses+1)).padStart(2,'0')+' / 03');
  root.querySelectorAll('[data-reactor-pulse]').forEach((el,i)=>{el.classList.toggle('done',i<state.pulses);el.classList.toggle('current',i===state.pulses);});
  text('igniteBtn',state.phase==='startup'?'IGNITION IN PROGRESS':state.pulseState==='running'?'FIRE PULSE':state.pulseState==='miss'?'RETRY PULSE':'START IGNITION');
  $('igniteBtn').disabled=state.phase!=='ignite'||state.pulseState==='settle'||state.paused;
 }
 function startPulse(){state.pulseState='running';state.pulseTime=0;state.pulsePosition=0;root.dataset.pulseResult='';setStatus('Wait for the green window, then FIRE PULSE.');}
 function ignite(){
  if(!state||state.paused||state.phase!=='ignite')return;
  if(state.pulseState==='ready'||state.pulseState==='miss'){startPulse();render();return;}
  if(state.pulseState!=='running')return;
  if(Math.abs(state.pulsePosition-pulseCenters[state.pulses])>10){state.pulseState='miss';root.dataset.pulseResult='miss';setStatus('Pulse missed. Previous pulses are saved. Retry this pulse.');tg?.HapticFeedback?.notificationOccurred?.('error');}
  else{state.pulses++;root.dataset.pulseResult='hit';tg?.HapticFeedback?.impactOccurred?.('medium');if(state.pulses===3){state.startup=0;enter('startup','Three pulses accepted. Reactor coming online…');}else{state.pulseState='settle';state.pulseDelay=.65;setStatus('Pulse accepted. Prepare for the next green window.');}}
  render();
 }
 function finish(){
  clearInterval(timer);timer=null;
  const rewarded=localStorage.getItem('mkty_life5_awarded')==='yes';awardLifePoints(5,1250);unlockLife6();
  text('reactorReward5',rewarded?'MISSION COMPLETE':'+1250 MOON POINTS');
  enter('online','Reactor online. Full power available for liftoff.');tg?.HapticFeedback?.notificationOccurred?.('success');
 }
 function pause(title='REACTOR PAUSED'){
  if(!state||!active()||state.paused)return;
  release();state.paused=true;root.dataset.paused='true';returnFocus=document.activeElement;
  text('reactorOverlayTitle5',title);$('reactorOverlay5').hidden=false;$('reactorWorkspace5').inert=true;$('reactorHelp5').disabled=true;render();$('reactorResume5').focus({preventScroll:true});
 }
 function resume(){
  if(!state||!active())return;
  state.paused=false;root.dataset.paused='false';$('reactorOverlay5').hidden=true;$('reactorWorkspace5').inert=false;$('reactorHelp5').disabled=false;lastTick=performance.now();render();
  if(returnFocus?.isConnected&&!returnFocus.disabled)returnFocus.focus({preventScroll:true});else $('reactorHelp5').focus({preventScroll:true});
 }
 function bindHold(id,name,tapName){
  const button=$(id),pointers=new Set(),keys=new Set();
  const sync=()=>{if(state)state[name]=state.phase==='charge'&&!state.paused&&(pointers.size>0||keys.size>0);};
  const release=()=>{pointers.clear();keys.clear();if(state)state[name]=false;button.classList.remove('held');};controls.push({release});
  button.addEventListener('pointerdown',e=>{if(e.button!==0||button.disabled)return;e.preventDefault();pointers.add(e.pointerId);button.setPointerCapture?.(e.pointerId);sync();render();});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,e=>{pointers.delete(e.pointerId);sync();render();});
  button.addEventListener('keydown',e=>{if(![' ','Enter'].includes(e.key))return;e.preventDefault();keys.add(e.key);sync();render();});
  button.addEventListener('keyup',e=>{if(![' ','Enter'].includes(e.key))return;e.preventDefault();keys.delete(e.key);sync();render();});
  button.addEventListener('blur',()=>{release();render();});
  // Assistive-technology clicks issue a short controllable charge/cool burst.
  button.addEventListener('click',e=>{if(e.detail===0&&state?.phase==='charge'&&!state.paused){state[tapName]=.7;render();}});
 }
 bindHold('chargeCore5','chargeHeld','chargeTap');bindHold('coolCore5','coolHeld','coolTap');
 cellButtons.forEach((button,i)=>button.addEventListener('click',()=>{if(!state||state.phase!=='charge'||state.paused||state.cells[i]===100)return;release();state.selected=i;setStatus('Cell selected. Hold CHARGE and monitor temperature.');render();}));
 for(const [id,key] of [['coolantFlow5','flow'],['fieldTrim5','trim']])$(id).addEventListener('input',()=>{if(!state||state.paused||state.phase!=='balance')return;state[key]=Number($(id).value);state.hold=0;render();});
 $('stabilizeBtn').onclick=()=>{if(!state||state.paused||state.phase!=='balance'||state.hold<3||!inWindow())return;state.pulses=0;state.pulseState='ready';enter('ignite','Core locked. Start the ignition sweep.');};
 $('igniteBtn').onclick=ignite;
 $('reactorRetry5').onclick=()=>{if(!state||state.paused||state.phase!=='fault')return;state.cells=state.cells.map(v=>v===100?100:0);state.selected=state.cells.findIndex(v=>v<100);state.temp=22;enter('charge','Chamber vented. Completed cells preserved. Continue charging.');};
 $('reactorHelp5').onclick=()=>pause('REACTOR GUIDE');$('reactorResume5').onclick=resume;
 $('reactorExit5').onclick=$('life5ReturnBtn').onclick=()=>show('home');
 $('reactorOverlay5').addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();resume();}else if(e.key==='Tab'){const first=$('reactorResume5'),last=$('reactorExit5');if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
 window.addEventListener('blur',()=>{if(active()&&state?.phase!=='online'&&state?.phase!=='fault')pause();else release();});
 document.addEventListener('visibilitychange',()=>{document.body.classList.toggle('mission-paused',document.hidden);if(document.hidden&&active())pause();});
 return {open,stop};
})();
function startLife5(){playLifeCinematic(5,openMission5);}
function openMission5(){Reactor5.open();}
function stopReactor5(){Reactor5.stop();}
