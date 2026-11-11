/* TEST-INJECTED ONLY. Never referenced by index.html. Observes unchanged game
 * statements instrumented by the fixture; hydration is explicitly requested.
 * This is supplied-event consistency, not authoritative timing/route admission. */
(function(){
 'use strict';
 const R=window.LocalLife1Recorder;
 if(!R||window.__C1Capture)throw Error('capture-dependency-or-duplicate');
 const KEY='mkty_test_life1_recording_v1',FORMAT='life1-controller-checkpoint-test-2';
 let recording=null,armed=null,hydrating=false,fault=null,lastSave=null,observations=0,refusedObservations=0,clockObservations=[],epoch=0;
 // JSON number syntax accepts -0; retain it rather than JSON.stringify's 0.
 const encode=x=>typeof x==='number'&&Object.is(x,-0)?'-0':Array.isArray(x)?'['+x.map(encode).join(',')+']':x&&typeof x==='object'?'{'+Object.keys(x).map(k=>JSON.stringify(k)+':'+encode(x[k])).join(',')+'}':JSON.stringify(x);
 const clone=x=>JSON.parse(encode(x));
 const rect=()=>{const r=$('life1World').getBoundingClientRect();return [r.width,r.height,r.left,r.top];};
 function failed(error,detail){if(!fault)fault={error,detail:detail||null};return {ok:false,error};}
 const checkpoint=(rec,journal)=>encode({format:FORMAT,recording:R.serialize(rec),clockObservations:journal});
 function validJournal(wire,journal){
  let order=0,epoch=-1,last=-Infinity;
  for(let index=0;index<wire.entries.length;index++){
   const entry=wire.entries[index];if(entry[0]==='epoch'){epoch++;last=-Infinity;continue;}
   const observed=journal[order];
   if(!observed||observed.order!==order||observed.epoch!==epoch||observed.eventIndex!==index||!Number.isFinite(observed.dispatchMs)||observed.dispatchMs<0||observed.dispatchMs<last||!Object.is(observed.frameTimestamp,entry[1][0]==='frame'?entry[1][1]:null))return false;
   last=observed.dispatchMs;order++;
  }
  return order===journal.length;
 }
 function push(e){
  const observed={order:clockObservations.length,epoch,dispatchMs:performance.now(),eventIndex:recording.wire.entries.length,frameTimestamp:e[0]==='frame'?e[1]:null};
  const next=R.append(recording,e);observations++;
  if(!next.ok){refusedObservations++;return failed(next.error,{required:next.required||null,firstRefusedEvent:e.slice(),clockObservation:observed});}
  const journal=[...clockObservations,observed],bytes=new TextEncoder().encode(checkpoint(next.recording,journal)).length;
  if(bytes>recording.wire.capacity.maxBytes){refusedObservations++;return failed('checkpoint-capacity-refused',{requiredBytes:bytes,firstRefusedEvent:e.slice(),clockObservation:observed});}
  recording=next.recording;clockObservations=journal;return {ok:true};
 }
 function syncView(time){
  const [w,h,left,top]=rect(),g=recording.state.geometry,v=recording.state.view;
  if(w!==g.width||h!==g.height)return failed('unsettled-live-size');
  if(left!==v.left||top!==v.top)return push(['view',time,left,top]);
  return {ok:true};
 }
 function observe(op,time,...args){
  if(!recording||hydrating)return;
  if(fault){refusedObservations++;return;}
  const s=recording.state;
  // These original paths can repeat without a semantic transition.
  if(op==='open'&&s[args[0]+'Open'])return;
  if(op==='pause'&&(!s.active||s.paused===args[0]))return;
  if(op==='delay'&&!s.repairShowing&&s.completeDue===null)return;
  if(op==='hold'&&!s.holding)return;
  // Pause/open transitions already perform the same stop. Capture meaningful
  // pointer release, but omit the following idempotent source stop callback.
  if(op==='stop'&&s.moveX===0&&s.moveY===0&&!s.walking&&s.walkDistance===0)return;
  if(op!=='hidden'&&op!=='leave'&&!syncView(time).ok)return;
  push([op,time,...args]);
 }
 function geometry(){
  if(!recording||hydrating||fault)return;
  push(['layout',performance.now(),...rect()]);
 }
 function sourceState(){
  return {x:l1PX,y:l1PY,stage:life1Stage,energy:energyCollected,repairCells,
   frequency:targetFrequency,dial:Number($('frequencyDial').value),sequence:[...repairSequence],input:[...repairInput],
   repairShowing,repairOpen:!$('repairPanel').hidden,antennaOpen:!$('antennaPanel').hidden,
   holdProgress:signalHoldProgress,holding:signalHoldTimer!==null,paused:!!window.MKTYExperience?.paused,moveX:l1MoveX,moveY:l1MoveY,walking:l1Walking,walkDistance:l1WalkDistance,direction:l1Direction,
   completeVisible:!$('life1Complete').hidden,geometry:clone(l1Geometry),
   collected:[...document.querySelectorAll('.energy.collected')].map(e=>e.dataset.energy)};
 }
 function compare(){
  if(!recording)return {ok:false,error:'not-recording'};
  const a=sourceState(),b=recording.state,errors=[];
  for(const k of ['x','y','stage','repairCells','frequency','dial','repairShowing','repairOpen','antennaOpen','holdProgress','holding','paused','completeVisible','moveX','moveY','walking','walkDistance','direction'])
   if(!Object.is(a[k],b[k]))errors.push(k);
  for(const [k,other] of [['sequence','sequence'],['input','repairInput']])
   if(JSON.stringify(a[k])!==JSON.stringify(b[other]))errors.push(k);
  // DOM traversal is layout order, while the recorder retains collection order.
  // Compare membership here without sorting or rewriting the captured history.
  if(a.collected.length!==b.collected.length||a.collected.some(id=>!b.collected.includes(id)))errors.push('collected');
  for(const k of ['width','height'])if(!Object.is(a.geometry[k],b.geometry[k]))errors.push('geometry.'+k);
  for(let i=0;i<3;i++)for(const k of ['left','right','top','bottom'])if(!Object.is(a.geometry.obstacles[i][k],b.geometry.obstacles[i][k]))errors.push('obstacle.'+i+'.'+k);
  return {ok:!errors.length,errors};
 }
 function armFresh(context,limits){if(recording)return {ok:false,error:'already-recording'};armed={context,limits};return {ok:true};}
 function resetFinished(){
  if(!armed||hydrating)return;
  const result=R.create({context:armed.context,initial:rect(),...(armed.limits?{limits:armed.limits}:{})});
  armed=null;if(!result.ok){failed(result.error);return;}
  recording=result.recording;
  const check=compare();if(!check.ok)failed('initial-controller-mismatch',check.errors);
 }
 function save(){
  if(!recording||hydrating)return {ok:false,error:'not-ready'};
  if(fault)return {ok:false,error:fault.error};
  if(!recording.state.paused)return lastSave={ok:false,error:'checkpoint-not-paused',oldCheckpointRetained:true};
  const body=checkpoint(recording,clockObservations);
  try{localStorage.setItem(KEY,body);return lastSave={ok:true,bytes:new TextEncoder().encode(body).length};}
  catch{return lastSave={ok:false,error:'checkpoint-storage-refused',memoryPrefixRetained:true};}
 }
 function restore(){
  if(fault)return {ok:false,error:fault.error};
  if(recording)return {ok:false,error:'already-recording'};
  let stored;try{stored=JSON.parse(localStorage.getItem(KEY)||'null');}catch{return {ok:false,error:'checkpoint-invalid'};}
  if(stored?.format!==FORMAT||typeof stored.recording!=='string'||!Array.isArray(stored.clockObservations))return {ok:false,error:'checkpoint-format'};
  const checked=R.inspect(stored.recording);if(!checked.ok)return {ok:false,error:checked.error};
  if(!validJournal(checked.recording.wire,stored.clockObservations))return {ok:false,error:'checkpoint-clock-journal'};
  const previous=checked.recording.state;
  const repair=previous.stage===1&&previous.repairOpen&&!previous.repairShowing&&previous.repairCells>0&&previous.repairCells<4;
  const hold=previous.stage===2&&previous.antennaOpen&&previous.holding&&previous.holdProgress>0&&previous.holdProgress<100;
  if(!previous.paused||previous.hidden||!(repair||hold))return {ok:false,error:'unsupported-hydration-phase',acceptedPrefixRetained:true};
  const now=performance.now();
  // Source uses zero as a first-frame sentinel. Do not turn an earned nonzero
  // frame clock into that sentinel by affine rebasing across document clocks.
  if(previous.lastFrame!==0&&now+(previous.lastFrame-previous.now)===0)return {ok:false,error:'clock-rebase-sentinel',acceptedPrefixRetained:true};
  const opened=R.recover(stored.recording,{localOriginMs:now});
  if(!opened.ok)return {ok:false,error:opened.error,acceptedPrefixRetained:true};
  // Validate this document's primitive geometry before changing controller fields.
  const layout=R.append(opened.recording,['layout',now,...rect()]);
  if(!layout.ok)return {ok:false,error:layout.error,acceptedPrefixRetained:true};
  const nextEpoch=checked.recording.wire.entries.filter(e=>e[0]==='epoch').length;
  const nextJournal=[...stored.clockObservations,{order:stored.clockObservations.length,epoch:nextEpoch,dispatchMs:now,eventIndex:layout.recording.wire.entries.length-1,frameTimestamp:null}];
  if(new TextEncoder().encode(checkpoint(layout.recording,nextJournal)).length>layout.recording.wire.capacity.maxBytes)return {ok:false,error:'checkpoint-capacity-refused',acceptedPrefixRetained:true};
  recording=layout.recording;clockObservations=nextJournal;epoch=nextEpoch;const s=recording.state;
  hydrating=true;
  try{
   clearMissionDelays(1);clearInterval(signalHoldTimer);signalHoldTimer=null;stopLife1Stick(null);
   life1Stage=s.stage;energyCollected=s.collected.length;repairCells=s.repairCells;l1PX=s.x;l1PY=s.y;
   targetFrequency=s.frequency;repairSequence=s.sequence.slice();repairInput=s.repairInput.slice();repairShowing=false;
   $('frequencyDial').value=String(s.dial);signalHoldProgress=s.holdProgress;
   document.querySelectorAll('.energy').forEach(e=>{e.disabled=s.collected.includes(e.dataset.energy);e.classList.toggle('collected',e.disabled);});
   $('energyCount').textContent=energyCollected+'/3';$('repairCount').textContent=(s.stage===2?'1':'0')+'/1';$('antennaCount').textContent='0/1';
   ['qEnergy','qRepair','qAntenna'].forEach((id,i)=>$(id).className=i<s.stage?'done':i===s.stage?'active':'');
   $('repairTerminal').disabled=s.stage!==1;$('antennaHotspot').disabled=s.stage!==2;
   $('repairPanel').hidden=!s.repairOpen;$('antennaPanel').hidden=!s.antennaOpen;$('life1Complete').hidden=true;
   document.querySelectorAll('.repair-cells button').forEach(e=>e.disabled=s.repairDisabled);
   $('repairFill').style.width=(s.repairCells/4*100)+'%';
   $('repairSequence').textContent=s.repairInput.map(n=>['A','B','C'][n]).concat(Array(4-s.repairInput.length).fill('·')).join(' ');
   $('missionStatus').textContent=s.stage===1?'Energy restored. Repair the terminal 🔧':'Terminal online. Reach COMMS and calibrate the antenna 📡';
   l1Direction=s.direction;l1WalkDistance=s.walkDistance;l1Walking=s.walking;l1MoveX=s.moveX;l1MoveY=s.moveY;
   const local=value=>now+(value-s.now);l1LastFrame=s.lastFrame===0?0:local(s.lastFrame);l1NearbyAt=local(s.nearbyAt);missionClockResumedAt=local(s.clockResumedAt);
   refreshLife1Geometry();renderLife1Player();
   const target=id=>id==='repair'?$('repairTerminal'):id==='antenna'?$('antennaHotspot'):document.querySelector('.energy[data-energy="'+id+'"]');
   l1Near=s.near?target(s.near):null;document.querySelectorAll('.l1-hotspot').forEach(e=>e.classList.remove('nearby'));
   if(s.highlightedNear)target(s.highlightedNear).classList.add('nearby');
   window.MKTYExperience.pause();
   if(hold){
    // Reuse the original registration/callback. A new document starts a fresh
    // 120 ms interval; remaining earned callback count is retained, not deadline.
    $('tuneBtn').onclick();signalHoldProgress=s.holdProgress;
    $('signalHoldFill').style.width=s.holdProgress+'%';$('signalHoldText').textContent=s.holdProgress+'%';
   }
   updateSignalStrength();
  }finally{hydrating=false;}
  const match=compare();if(!match.ok)return failed('hydration-controller-mismatch',match.errors);
  save();return {ok:true,phase:repair?'repair-input':'antenna-hold',paused:true,retainedOriginalEntries:checked.recording.wire.entries.length};
 }
 window.__C1Capture=Object.freeze({KEY,FORMAT,armFresh,resetFinished,observe,geometry,save,restore,compare,
  state:()=>recording?.state||null,wire:()=>recording?R.serialize(recording):null,clockJournal:()=>clone(clockObservations),source:sourceState,
  status:()=>({recording:!!recording,fault:clone(fault),lastSave:clone(lastSave),observations,refusedObservations,usage:recording?clone(recording.usage):null})});
})();
