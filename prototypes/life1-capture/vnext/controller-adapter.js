/* Test-injected vNext observer/hydrator only. No production loader or authority. */
(function(){
 'use strict';const R=window.LocalLife1VNextRecorder;if(!R||window.__C1VNext)throw Error('vnext-dependency-or-duplicate');
 const KEY='mkty_test_life1_vnext_v1';let recording=null,armed=null,batch=null,depth=0,fault=null,lastSave=null,savePending=false,rearming=false,hydrating=false;
 const copy=x=>JSON.parse(R.encode(x)),rect=()=>{const r=$('life1World').getBoundingClientRect();return [r.width,r.height,r.left,r.top];};
 const clocks=()=>({dispatchMs:performance.now(),lastFrame:l1LastFrame,nearbyAt:l1NearbyAt,clockResumedAt:missionClockResumedAt});
 function fail(error,detail){if(!fault)fault={error,detail:detail||null};return {ok:false,error};}
 function step(value){
  if(!batch||!recording||batch.error||fault||rearming)return;
  const candidate={...batch.callback,steps:[...batch.callback.steps,copy(value)]};
  try{R.checkDraft(candidate);batch.callback=candidate;}catch(e){batch.error=e.code||e.message;}
 }
 function live(r){step(['live',r.width,r.height,r.left,r.top]);}
 function source(){return {x:l1PX,y:l1PY,stage:life1Stage,repairCells,frequency:targetFrequency,dial:Number($('frequencyDial').value),
  sequence:[...repairSequence],repairInput:[...repairInput],repairShowing,repairDisabled:[...document.querySelectorAll('.repair-cells button')].every(e=>e.disabled),
  repairOpen:!$('repairPanel').hidden,antennaOpen:!$('antennaPanel').hidden,holdProgress:signalHoldProgress,holding:signalHoldTimer!==null,
  paused:!!window.MKTYExperience?.paused,hidden:document.hidden,active:$('mission1').classList.contains('active'),
  moveX:l1MoveX,moveY:l1MoveY,walking:l1Walking,walkDistance:l1WalkDistance,direction:l1Direction,lastFrame:l1LastFrame,nearbyAt:l1NearbyAt,clockResumedAt:missionClockResumedAt,
  completeVisible:!$('life1Complete').hidden,geometry:copy(l1Geometry),collected:[...document.querySelectorAll('.energy.collected')].map(e=>e.dataset.energy),
  near:l1Near?(l1Near.dataset.energy||(l1Near.id==='repairTerminal'?'repair':'antenna')):null,
  highlightedNear:[...document.querySelectorAll('.l1-hotspot.nearby')].map(e=>e.dataset.energy||(e.id==='repairTerminal'?'repair':'antenna'))[0]||null,
  timerIds:[...(missionDelays.get(1)||[])],holdHandle:signalHoldTimer};}
 function compare(candidate=recording){
  if(!candidate)return {ok:false,error:'not-recording'};const a=source(),b=candidate.state,errors=[];
  for(const k of ['x','y','stage','repairCells','frequency','dial','repairShowing','repairDisabled','repairOpen','antennaOpen','holdProgress','holding','paused','hidden','active','moveX','moveY','walking','walkDistance','direction','lastFrame','nearbyAt','clockResumedAt','completeVisible','near','highlightedNear'])if(!Object.is(a[k],b[k]))errors.push(k);
  for(const k of ['sequence','repairInput'])if(R.encode(a[k])!==R.encode(b[k]))errors.push(k);
  if(a.collected.length!==b.collected.length||a.collected.some(id=>!b.collected.includes(id)))errors.push('collected');
  for(const k of ['width','height'])if(!Object.is(a.geometry[k],b.geometry[k]))errors.push('geometry.'+k);
  for(let i=0;i<3;i++)for(const k of ['left','right','top','bottom'])if(!Object.is(a.geometry.obstacles[i][k],b.geometry.obstacles[i][k]))errors.push('obstacle.'+i+'.'+k);
  const timers=Object.keys(b.timers).map(Number);if(a.timerIds.length!==timers.length||a.timerIds.some(id=>!timers.includes(id)))errors.push('timerIds');
  return {ok:!errors.length,errors};
 }
 function createFresh(){
  const pending=armed;armed=null;const result=R.create({context:pending.context,initial:rect(),clock:clocks(),...(pending.limits?{limits:pending.limits}:{})});
  if(!result.ok)return fail(result.error);const check=compare(result.recording);if(!check.ok)return fail('initial-controller-mismatch',check.errors);recording=result.recording;return {ok:true};
 }
 function finish(){
  const draft=batch;batch=null;if(!draft)return;
  if(!draft.callback.steps.length&&draft.callback.kind==='delay'){savePending=false;return;}
  if(draft.error){fail(draft.error,{kind:draft.callback.kind,retained:recording.usage});savePending=false;return;}
  const result=R.appendCallback(recording,draft.callback);
  if(!result.ok){fail(result.error,{callback:draft.callback,required:result.required||null});savePending=false;return;}
  const check=compare(result.recording);if(!check.ok){fail('source-callback-mismatch',{errors:check.errors,callback:draft.callback});savePending=false;return;}
  recording=result.recording;if(savePending){savePending=false;save();}
 }
 function wrap(kind,fn){return function(...args){
  const outer=depth===0;if(outer&&recording&&!fault&&!hydrating){
   if(kind==='reset')fail('reset-requires-new-recording');
   else batch={callback:{kind,dispatchMs:performance.now(),steps:[]},error:null};
  }
  depth++;try{return fn.apply(this,args);}catch(e){if(batch)batch.error='source-callback-aborted';throw e;}finally{depth--;if(outer){if(armed&&kind==='reset')createFresh();else if(!hydrating)finish();}}
 };}
 function armFresh(context,limits){if(recording||armed)return {ok:false,error:'already-recording'};armed={context,limits};return {ok:true};}
 function save(){
  if(batch){savePending=true;return {ok:true,deferred:true};}
  if(!recording||fault)return lastSave={ok:false,error:fault?.error||'not-recording'};
  if(!recording.state.paused)return lastSave={ok:false,error:'checkpoint-not-paused',oldCheckpointRetained:true};
  const body=R.serialize(recording);try{localStorage.setItem(KEY,body);return lastSave={ok:true,bytes:new TextEncoder().encode(body).length};}
  catch{return lastSave={ok:false,error:'checkpoint-storage-refused',memoryPrefixRetained:true};}
 }
 function restore(){
  if(recording||fault||batch)return {ok:false,error:'already-recording-or-faulted'};
  let body;try{body=localStorage.getItem(KEY);}catch{return {ok:false,error:'checkpoint-read-refused'};}
  const checked=R.inspect(body);if(!checked.ok)return {ok:false,error:checked.error};
  const old=checked.recording,s=old.state;
  if(!s.paused||s.hidden||Object.keys(s.timers).length||!((s.stage===1&&s.repairOpen&&!s.repairShowing&&s.repairCells>0&&s.repairCells<4)||(s.stage===2&&s.antennaOpen&&s.holding&&s.holdProgress>0&&s.holdProgress<100)))return {ok:false,error:'unsupported-recovery-phase'};
  if(!window.MKTYExperience.paused||document.hidden||repairShowing||signalHoldTimer!==null||(missionDelays.get(1)?.size||0))return {ok:false,error:'fresh-paused-source-required'};
  const raw=clocks(),preflight=R.preflightDocument(old,raw);if(!preflight.ok)return {ok:false,error:preflight.error,acceptedPrefixRetained:true};
  recording=old;hydrating=true;depth=1;batch={callback:{kind:'hydrate',dispatchMs:raw.dispatchMs,steps:[]},error:null};let createdHold=null;
  try{
   stopLife1Stick(null);life1Stage=s.stage;energyCollected=s.collected.length;repairCells=s.repairCells;l1PX=s.x;l1PY=s.y;
   targetFrequency=s.frequency;repairSequence=s.sequence.slice();repairInput=s.repairInput.slice();repairShowing=false;
   $('frequencyDial').value=String(s.dial);signalHoldProgress=s.holdProgress;
   document.querySelectorAll('.energy').forEach(e=>{e.disabled=s.collected.includes(e.dataset.energy);e.classList.toggle('collected',e.disabled);});
   $('energyCount').textContent=energyCollected+'/3';$('repairCount').textContent=(s.stage===2?'1':'0')+'/1';$('antennaCount').textContent='0/1';
   ['qEnergy','qRepair','qAntenna'].forEach((id,i)=>$(id).className=i<s.stage?'done':i===s.stage?'active':'');
   $('repairTerminal').disabled=s.stage<1;$('antennaHotspot').disabled=s.stage!==2;$('repairPanel').hidden=!s.repairOpen;$('antennaPanel').hidden=!s.antennaOpen;$('life1Complete').hidden=true;
   document.querySelectorAll('.repair-cells button').forEach(e=>e.disabled=s.repairDisabled);$('repairFill').style.width=(s.repairCells/4*100)+'%';
   $('repairSequence').textContent=s.repairInput.map(n=>['A','B','C'][n]).concat(Array(4-s.repairInput.length).fill('·')).join(' ');
   $('missionStatus').textContent=s.stage===1?'Energy restored. Repair the terminal 🔧':'Terminal online. Reach COMMS and calibrate the antenna 📡';
   l1Direction=s.direction;l1Walking=s.walking;l1WalkDistance=s.walkDistance;l1MoveX=s.moveX;l1MoveY=s.moveY;
   const target=id=>id==='repair'?$('repairTerminal'):id==='antenna'?$('antennaHotspot'):document.querySelector('.energy[data-energy="'+id+'"]');
   l1Near=s.near?target(s.near):null;document.querySelectorAll('.l1-hotspot').forEach(e=>e.classList.remove('nearby'));if(s.highlightedNear)target(s.highlightedNear).classList.add('nearby');
   renderLife1Player();refreshLife1Geometry();renderLife1Player();
   if(s.holding){rearming=true;try{$('tuneBtn').onclick();createdHold=signalHoldTimer;}finally{rearming=false;}signalHoldProgress=s.holdProgress;$('signalHoldFill').style.width=s.holdProgress+'%';$('signalHoldText').textContent=s.holdProgress+'%';step(['hold-rearm']);}
   updateSignalStrength();
   if(batch.error)throw Error(batch.error);
   const candidate=R.beginDocument(old,raw,batch.callback.steps);if(!candidate.ok)throw Error(candidate.error);
   const match=compare(candidate.recording);if(!match.ok)throw Error('source-mismatch:'+match.errors.join(','));
   recording=candidate.recording;batch=null;hydrating=false;depth=0;savePending=false;save();return {ok:true,paused:true,document:recording.state.document};
  }catch(e){const hydrationHold=createdHold??signalHoldTimer;if(hydrationHold!==null){clearInterval(hydrationHold);signalHoldTimer=null;}recording=old;batch=null;hydrating=false;depth=0;savePending=false;return fail('hydration-refused',{reason:e.message,acceptedPrefixRetained:true,newFreshDocumentRequired:true});}
 }
 window.__C1VNext=Object.freeze({KEY,wrap,step,live,armFresh,save,restore,compare,source,state:()=>recording?.state||null,wire:()=>recording?R.serialize(recording):null,
  status:()=>({recording:!!recording,fault:copy(fault),lastSave:copy(lastSave),usage:recording?copy(recording.usage):null,pendingCallback:!!batch})});
})();
