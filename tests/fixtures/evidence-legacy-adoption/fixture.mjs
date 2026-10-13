// CI ONLY. Cooperative cold-start handoff, never a production migration boundary.
import '/field-model.js';
import {createTestAdapter,DB_NAME,STORES} from '/prototypes/evidence-indexeddb/adapter.mjs';
import {createPhaseBudget} from '/prototypes/evidence-indexeddb/phase-budget.mjs';
import * as C from '/prototypes/evidence-indexeddb/contract.mjs';
import * as L from '/prototypes/evidence-indexeddb/legacy-adoption-codec.mjs';
import {createLegacyCheckpointOwner,legacyOwnerRuns} from '/prototypes/evidence-indexeddb/legacy-checkpoint-owner.mjs';
const $=id=>document.getElementById(id),S=window.__legacyNative,N=window.__nativeHarness;
const SCOPE='fixture:legacy-adoption',PRINCIPAL='guest:legacy-adoption',CAP=1016832,G=32768,W=327680,R=65536;
const KEYS=Object.freeze(['mkty_story_plan_9_v1','mkty_field_finale_9_v1','mkty_points','mkty_daily_demo','mkty_life9','mkty_life9_awarded','mkty_life9_completed_at','mkty_final_moon_points','mkty_points_locked_at','mkty_spatial_report_9','mkty_operations_9_v1','mkty_current_chapter']);
const CLOUD=Object.freeze(['mkty_cloud_dirty','mkty_cloud_revision','mkty_cloud_restore_pending','mkty_cloud_restore_transaction','mkty_cloud_restore_retry_guard','mkty_cloud_restore_outgoing','mkty_cloud_recovery']);
const DEFERRED=new Set(['blur','pagehide','visibilitychange','interval']);
const events=[],transport=[],budgetEvents=[],facadeWrites=[],inputs=[],loads=[],deferred=new Map();
const counters={open:0,save:0,bootSave:0,duplicates:0,capture:0,timerRejected:0,award:0,reward:0,complete:0,original:0,render:0};
let owner,base,adapter,budget,checkpointLease,baseline,candidate=null,failureCandidate=null,saveFault=null,phase='COLD',epoch=1,pending=false,quiescent=true,loaded=false,workspaceDepth=0;
let fault=null,reserveFault=null,held=null,error=null,blocking=null,latched=false,outerReturned=false,outerSucceeded=false,fieldIntervalAt=null,readFailures=0,outerKind=null;
const push=(a,row,max=512)=>{if(a.length>=max)throw Error('legacy-observation-limit');a.push(row);return row;};
const event=(type,detail={})=>push(events,{n:events.length,type,nativeIndex:N.log.length,...detail},4096);
const runs=()=>legacyOwnerRuns(PRINCIPAL);
function assertNoWork(){const s=budget.snapshot().reservations;for(const key of ['phase-workspace','helper-framing','helper-hash','returned-page','stream-candidate','reload-chunk','atomic-record-workspace'])if(s[key])throw Error('legacy-await-live:'+key);}
function reserve(label,bytes){if(budget.snapshot().live+bytes+G>CAP)throw Error('legacy-joint-budget');budget.reserve(label,bytes);budget.allocate(label,bytes);}
function nativeRead(key,visit=value=>value){
  const s=budget.snapshot().reservations;if(s['callback-scratch']||s['callback-outer-story']||s['callback-inner-story'])throw Error('legacy-guard-during-parse');
  reserve('native-read',R);try{const value=S.read(key);if(value!==null&&value.length*2>65536)throw Error('legacy-native-value-limit');return visit(value);}
  catch(e){readFailures++;throw e;}finally{budget.release('native-read',R);}
}
function guardMetadata(){
  const cloudRaw={};for(const key of CLOUD)cloudRaw[key]=nativeRead(key,value=>{if(value!==null)throw Error('legacy-cloud-metadata-present');return null;});
  nativeRead('mkty_legacy_owner_v3',value=>{if(value!==null)throw Error('legacy-attribution-present');});
  for(let i=0;i<S.length;i++){const key=S.key(i);if(key?.startsWith('mkty_pending_')&&!/^mkty_pending_v2_[0-9]+$/.test(key))throw Error('legacy-pending-ambiguous');}
  if((window.Telegram?.WebApp?.initData||'')!=='')throw Error('legacy-initdata-present');
  return {version:1,origin:'closed-original-field-guest-fixture',principal:PRINCIPAL,epoch,
    identity:window.MKTYStorage?.identity?.()||'guest',initData:'',durable:true,
    exclusive:true,sourceClosed:new URLSearchParams(location.search).get('closed')==='1',overlay:false,
    legacyOwnerRaw:null,cloudRaw,unattributedPendingPresent:false};
}
function metadataValid(g){return g.identity==='guest'&&g.initData===''&&g.sourceClosed&&g.legacyOwnerRaw===null&&Object.values(g.cloudRaw).every(x=>x===null)&&!g.unattributedPendingPresent;}
function readContext(sourceCap){
  const guards=guardMetadata();let unchanged=metadataValid(guards);
  if(sourceCap)for(const key of KEYS)if(!nativeRead(key,value=>value===L.rawValue(sourceCap,key)))unchanged=false;
  return {scope:SCOPE,principal:PRINCIPAL,epoch,sourceUnchanged:unchanged};
}
function controllerWork(kind,fn,self,args){
  if(workspaceDepth)return Reflect.apply(fn,self,args);
  if(quiescent&&loaded){
    if(!DEFERRED.has(kind))throw Error('legacy-original-entry-quiesced:'+kind);
    if(!deferred.has(kind))deferred.set(kind,{fn,self,args,epoch});
    event('lifecycle-deferred',{kind,pendingTypes:[...deferred.keys()]});return;
  }
  assertNoWork();reserve('phase-workspace',W);workspaceDepth=1;outerKind=kind;outerReturned=false;outerSucceeded=false;event('original-enter',{kind});
  try{const value=Reflect.apply(fn,self,args);outerSucceeded=true;return value;}
  catch(e){blocking||='original-callback-threw';phase='BLOCKED';quiescent=true;event('original-threw',{kind,reason:String(e.message)});throw e;}
  finally{workspaceDepth=0;outerKind=null;outerReturned=true;budget.release('phase-workspace',W);event('original-return',{kind});}
}
function drainLifecycle(){
  if(base.physicalBusy||base.retainedBytes||workspaceDepth||owner.view().invalidated||blocking)return;
  assertNoWork();quiescent=false;
  for(const [kind,row]of deferred){deferred.delete(kind);if(row.epoch!==epoch){event('lifecycle-discard-old-epoch',{kind});continue;}
    controllerWork(kind,row.fn,row.self,row.args);event('lifecycle-drained',{kind});}
}
function render(){
  const v=owner?.view();if(!v)return;
  $('adoptionStart').disabled=pending||v.state!=='NEW';
  $('adoptionOpen').disabled=pending||loaded||!['ACTIVE','SAVED'].includes(v.state)||!!blocking;
  $('adoptionRetry').disabled=pending||!v.retryEnabled;
  $('adoptionStatus').textContent=blocking?'Checkpoint retained; experiment blocked: '+blocking:pending?'Saving and independently reading back the same checkpoint…':
    v.state==='SAVED'?'Saved owner revision 1. Original source bytes remain unchanged.':v.state==='ACTIVE'?'Archived owner revision 0. Ready for exactly one native WAIT.':v.reason?'Stopped: '+v.reason:'Original partial checkpoint is ready for isolated adoption.';
}
function show(id){document.querySelectorAll('.screen').forEach(el=>el.classList.toggle('active',el.id===id));}
const tripwire=kind=>()=>{counters[kind]++;throw Error('Forbidden '+kind);};
function installFacade(){
  const get=key=>{key=String(key);if(key==='mkty_lang')return 'en';if(key==='mkty_control_sound')return 'no';if(!KEYS.includes(key))throw Error('legacy-facade-read:'+key);return owner.rawValue(key);};
  const set=(key,value)=>{key=String(key);value=String(value);const equal=key==='mkty_current_chapter'&&value==='9'&&owner.rawValue(key)==='9';push(facadeWrites,{key,bytes:value.length*2,equal},16);if(!equal)throw Error('legacy-facade-write:'+key);};
  const facade=Object.freeze({getItem:get,readItem:get,setItem:set,removeItem(){throw Error('legacy-facade-remove');},clear(){throw Error('legacy-facade-clear');},identity:()=> 'guest',get persistent(){return true;}});
  Object.defineProperty(window,'localStorage',{configurable:false,value:facade});window.MKTYStorage=facade;
  window.awardLifePoints=tripwire('award');window.openMission8=tripwire('original');window.openMission9=tripwire('original');
  window.MKTYRewards=Object.freeze({completeLife:tripwire('reward'),call:tripwire('reward')});window.show=show;
}
async function script(src){loads.push(src);await new Promise((resolve,reject)=>{const el=document.createElement('script');el.src=src;el.onload=resolve;el.onerror=()=>reject(Error('legacy-script-load:'+src));document.head.append(el);});}
function installOriginalRegistrationWrappers(){
  const add=EventTarget.prototype.addEventListener,interval=window.setInterval;
  EventTarget.prototype.addEventListener=function(type,fn,options){
    const originalTarget=this,field=this?.id==='fieldMission'||this?.id==='fieldDialog';
    const lifecycle=this===window&&['blur','pagehide'].includes(type)||this===document&&type==='visibilitychange';
    if(typeof fn==='function'&&(field||lifecycle)){
      const original=fn;fn=function(...args){return controllerWork(lifecycle?type:'field-'+type,original,this,args);};
    }
    return add.call(originalTarget,type,fn,options);
  };
  window.setInterval=function(fn,delay,...args){
    if(delay===1000&&typeof fn==='function'){
      fieldIntervalAt=performance.now();const original=fn;
      return interval.call(this,function(...values){return controllerWork('interval',original,this,values);},delay,...args);
    }
    return interval.apply(this,arguments);
  };
  return ()=>{EventTarget.prototype.addEventListener=add;window.setInterval=interval;};
}
function installInputFence(){
  document.addEventListener('click',e=>{
    if(!e.target.closest('#fieldMission'))return;
    const action=e.target.closest('[data-field-action]')?.dataset.fieldAction||null;
    const allowed=e.isTrusted&&!quiescent&&!pending&&!blocking&&phase==='READY'&&(e.target.id==='fieldResume'||action==='wait'||e.target.id==='fieldPause');
    push(inputs,{trusted:e.isTrusted,target:e.target.id,action,allowed},64);
    if(!allowed){e.preventDefault();e.stopImmediatePropagation();return;}
    if(action==='wait')phase='WAIT';
  },{capture:true,passive:false});
  for(const type of ['keydown','input','change','pointerdown'])document.addEventListener(type,e=>{
    if(!e.target.closest('#fieldMission'))return;
    if(type==='pointerdown'&&e.isTrusted&&!quiescent&&!pending&&!blocking&&phase==='READY')return;
    e.preventDefault();e.stopImmediatePropagation();
  },{capture:true,passive:false});
}
function freezeCheckpoint(value){let nodes=0;const visit=(v,depth)=>{if(++nodes>4096||depth>64)throw Error('legacy-capture-limit');if(v&&typeof v==='object'){for(const child of Object.values(v))visit(child,depth+1);Object.freeze(v);}return v;};return visit(value,0);}
function quarantine(reason,cp){
  blocking=reason;phase='BLOCKED';quiescent=true;if(cp&&!failureCandidate)failureCandidate=freezeCheckpoint(cp);
  event('candidate-quarantined',{reason});render();
}
function onSave(cp){
  counters.save++;if(!workspaceDepth)throw Error('legacy-save-without-workspace');
  if(saveFault==='boot-mismatch'&&phase==='BOOT'||saveFault==='recursive-mismatch'&&latched){saveFault=null;cp={...cp,seconds:cp.seconds+1};event('synthetic-save-fault');}
  if(phase==='BOOT'){
    if(!L.sameLegacyValue(cp,baseline)){quarantine('legacy-boot-normalization',cp);throw Error('legacy-boot-normalization');}counters.bootSave++;return;
  }
  if(latched){if(!L.sameLegacyValue(cp,candidate||baseline)){quarantine('legacy-reentrant-distinct-save',cp);throw Error('legacy-reentrant-distinct-save');}counters.duplicates++;return;}
  if(outerKind!=='interval'&&L.sameLegacyValue(cp,baseline)){counters.duplicates++;return;}
  latched=true;candidate=freezeCheckpoint(cp);
  if(phase!=='WAIT'){blocking='timer-before-WAIT';counters.timerRejected++;phase='BLOCKED';}
  else{phase='CAPTURED';counters.capture++;}
  // Install the latch before stop() recursively invokes task.save once.
  MKTYField.onScreen('adoptionPanel');show('adoptionPanel');quiescent=true;
  event(blocking?'timer-candidate-retained':'native-WAIT-captured',{turn:cp.turn,seconds:cp.seconds,traceRows:cp.trace.length});
  if(!blocking)queueMicrotask(()=>{
    if(!outerReturned||workspaceDepth)throw Error('legacy-persist-before-original-return');
    if(blocking||!outerSucceeded){blocking||='original-callback-threw';phase='BLOCKED';quiescent=true;event('candidate-quarantined',{reason:blocking});render();return;}
    void runOwner('commitWait',()=>owner.commitWait(candidate)).catch(()=>{});
  });
  render();
}
async function openController(){
  if(loaded||pending||blocking)throw Error('legacy-controller-already-open');
  if(owner.view().state==='ACTIVE')owner.prepareWait();
  checkpointLease=owner.checkpoint();baseline=checkpointLease.value;
  installFacade();await script('/field-art.js');
  const originalScene=FieldArt.scene;FieldArt.scene=function(...args){
    if(!workspaceDepth)throw Error('legacy-render-without-workspace');const text=Reflect.apply(originalScene,this,args);
    counters.render++;if(counters.render>4||text.length*2>20480)throw Error('legacy-pinned-render-limit');event('scene-sized',{bytes:text.length*2});return text;
  };
  const restore=installOriginalRegistrationWrappers();try{await script('/field-missions.js');}finally{restore();}
  for(const id of ['fieldResume','fieldPause','fieldSubmit','fieldExit']){const node=$(id),fn=node.onclick;node.onclick=function(...args){return controllerWork('button-'+id,fn,this,args);};}
  installInputFence();loaded=true;quiescent=false;phase='BOOT';counters.open++;
  controllerWork('open',MKTYField.open,MKTYField,[{chapter:9,id:2,fieldStage:4,mechanic:11,title:['Пройти закрывающийся шлюз','Through the closing gate'],core:true,phaseCount:3,seed:baseline.seed,save:onSave,complete:tripwire('complete'),exit:tripwire('original')},baseline]);
  if(owner.view().state==='SAVED'){phase='RELOADED';quiescent=true;}else phase='READY';render();
}
function stage(q){const run=q.descriptor?.run||q.captureIdentity?.run||'';return run.includes(':source:')?'source':run.includes(':next:')?'next':run.includes(':owner:')?'owner':'other';}
function takeFault(method,q){if(!fault||fault.method!==method||fault.stage!==stage(q)||fault.ordinal!==undefined&&fault.ordinal!==q.ordinal||fault.seal!==undefined&&fault.seal!==!!q.seal)return null;const value=fault;fault=null;event('fault-fired',value);return value;}
async function tracked(method,q,fn){
  if(workspaceDepth||budget.snapshot().reservations['phase-workspace'])throw Error('legacy-IDB-during-original');
  const row=push(transport,{method,stage:stage(q),run:q.descriptor?.run||null,ordinal:q.ordinal??null,seal:!!q.seal,expectedHead:q.expectedHead??null,nativeStart:N.log.length},2048);
  try{const result=await fn();row.status=result.status;row.reason=result.reason||null;row.head=result.currentHead?.token||result.receipt?.head?.token||null;return result;}
  finally{row.nativeEnd=N.log.length;row.physicalBusy=base.physicalBusy;row.retainedBytes=base.retainedBytes;}
}
function makeAdapter(){
  return Object.freeze({scope:SCOPE,
    get state(){return base.state;},get physicalBusy(){return base.physicalBusy;},get retainedBytes(){return base.retainedBytes;},get diagnostics(){return base.diagnostics;},
    open:()=>base.open(),close:()=>base.close(),recover:q=>tracked('recover',q,()=>base.recover(q)),
    readSegments:q=>tracked('read',q,async()=>{const f=takeFault('read',q);if(f?.kind==='stop')return {status:'refused',reason:'storage-unavailable'};return base.readSegments(q);}),
    appendSegment:(q,guard)=>tracked('append',q,async()=>{
      const f=takeFault('append',q);if(f?.kind==='stop')return {status:'refused',reason:'storage-unavailable'};
      if(f?.kind==='abort')N.control.abortAt='first-add';
      if(f?.kind==='hold'){
        held={proof:null,released:false};const barrier=N.holdNextTerminal('complete');let promise;
        held.timer=N.gateWatchdogDuring(()=>{promise=base.appendSegment(q,guard);},1000);
        barrier.then(proof=>{held.proof=proof;event('native-commit-held',{tx:proof.tx});});
        Promise.all([barrier,held.timer.due]).then(()=>held.timer.release());return promise;
      }
      const result=await base.appendSegment(q,guard);
      if(f?.kind==='after-commit'&&result.status==='committed')return {status:'outcomeUnknown',reason:'injected-ack-cut'};
      return result;
    }),
    retry:(...args)=>tracked('retry',{},()=>base.retry(...args))
  });
}
async function runOwner(label,fn){
  if(pending)throw Error('legacy-owner-busy');assertNoWork();pending=true;quiescent=true;error=null;event('owner-start',{label});render();
  try{return await fn();}catch(e){error=String(e.stack||e);event('operation-error',{label,error:String(e.message)});throw e;}
  finally{pending=false;event('owner-settled',{label,state:owner.view().state,physicalBusy:base.physicalBusy,retainedBytes:base.retainedBytes});if(!base.physicalBusy&&!base.retainedBytes)drainLifecycle();render();}
}
async function adopt(){return runOwner('adopt',()=>{
  const guards=guardMetadata();const cap=L.captureLegacyBundle(nativeRead,guards,FieldRules,budget);return owner.adopt(cap);
});}
const done=tx=>new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||Error('fixture-abort'));});
async function mutateDependency(){return N.fixture(async()=>{const db=await new Promise((resolve,reject)=>{const q=indexedDB.open(DB_NAME);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});const tx=db.transaction(['payloads'],'readwrite'),p=done(tx);tx.objectStore('payloads').delete(C.segmentKey(C.keyOf(SCOPE,runs().source),0));await p;db.close();});}
function observeCheckpoint(){
  if(!window.MKTYField)return null;if(pending||base.physicalBusy||base.retainedBytes>0)throw Error('legacy-inspection-before-drain');
  assertNoWork();reserve('phase-workspace',W);try{return MKTYField.snapshot();}finally{budget.release('phase-workspace',W);}
}
function measureInstrumentation(){
  const arrays={events,budgetEvents,transport,nativeEvents:N.log,storageRows:S.rows,inputs,facadeWrites},bytes={};let total=0;
  for(const [name,rows]of Object.entries(arrays)){bytes[name]=JSON.stringify(rows).length*2;total+=bytes[name];if(total>67108864)throw Error('legacy-instrumentation-byte-limit');}
  return {excludedFromComponentLedger:true,encoding:'JSON UTF16 code units',bytes,total,aggregateLimit:67108864,snapshotCopyLimit:67108864,heldStateObservation:pending||base.physicalBusy||base.retainedBytes>0};
}
function facts(inspect=false){
  const current=inspect?(pending||base.physicalBusy||base.retainedBytes>0?(candidate?structuredClone(candidate):null):observeCheckpoint()):null;
  const instrumentation=inspect?measureInstrumentation():null;
  const v=owner.view(),small=Object.fromEntries(Object.entries(v).filter(([k])=>!['sourceCap','nextCap','checkpoint'].includes(k)));
  return {view:small,phase,pending,quiescent,workspaceDepth,blocking,error,epoch,readFailures,counters:{...counters},baseline:inspect&&baseline?structuredClone(baseline):null,
    current,instrumentation,checkpointObservation:pending||base.physicalBusy||base.retainedBytes>0?'immutable-capture-only':'original-snapshot-after-drain',candidate:inspect&&candidate?structuredClone(candidate):null,failureCandidate:inspect&&failureCandidate?structuredClone(failureCandidate):null,
    events:inspect?structuredClone(events):[],transport:inspect?structuredClone(transport):[],budget:budget.snapshot(),jointPeak:budget.snapshot().peak+G,
    budgetEvents:inspect?structuredClone(budgetEvents):[],nativeEvents:inspect?structuredClone(N.log):[],storageRows:inspect?structuredClone(S.rows):[],facadeWrites:inspect?structuredClone(facadeWrites):[],inputs:inspect?structuredClone(inputs):[],loads:[...loads],
    deferred:[...deferred.keys()],held:held?{proof:held.proof,released:held.released}:null,physicalBusy:base.physicalBusy,retainedBytes:base.retainedBytes,fieldIntervalAt,
    foreignSentinels:inspect?['mkty_account_v3_314159:mkty_points','mkty_pending_v2_314159'].map(key=>[key,S.inspect(key)]):null,legacyLoaded:!!window.MKTYLegacy,source:inspect?KEYS.map(key=>[key,S.inspect(key)]):null};
}
export async function bootLegacyAdoptionFixture(){
  window.Telegram={WebApp:{initData:''}};
  const nativePush=N.log.push;Object.defineProperty(N.log,'push',{value:function(...rows){if(this.length+rows.length>32768)throw Error('legacy-native-event-limit');return Reflect.apply(nativePush,this,rows);}});
  const raw=createPhaseBudget({observe:e=>{push(budgetEvents,{type:e.type,label:e.label,bytes:e.bytes,live:e.live,jointLive:e.live+G,reservations:Object.fromEntries(Object.entries(e.reservations).filter(([,n])=>n))},20000);}});
  budget=Object.freeze({...raw,reserve(label,bytes){if(reserveFault===label){reserveFault=null;throw Error('allocation-refused');}if(raw.snapshot().live+bytes+G>CAP)throw Error('legacy-joint-budget');return raw.reserve(label,bytes);}});
  base=createTestAdapter({scope:SCOPE,watchdogMs:1000});adapter=makeAdapter();await adapter.open();
  owner=createLegacyCheckpointOwner({adapter,scope:SCOPE,principal:PRINCIPAL,epoch,readContext,admissionGuards:guardMetadata(),FieldRules,budget,crypto});
  window.H={facts,get settled(){return !pending;},adopt,open:openController,retry:()=>runOwner('retry',()=>owner.retry()),recover:()=>runOwner('recover',()=>owner.recover()),
    saveFault(value){saveFault=value;},fault(value){fault={...value};},reserveFault(label){reserveFault=label;},
    release(){if(!held?.proof)throw Error('no-held-native-terminal');held.released=true;return N.releaseTerminals(held.proof.tx);},
    lifecycle(){window.dispatchEvent(new Event('blur'));window.dispatchEvent(new Event('pagehide'));document.dispatchEvent(new Event('visibilitychange'));return {deferred:[...deferred.keys()],counters:{...counters},quiescent,workspaceDepth,physicalBusy:base.physicalBusy,retainedBytes:base.retainedBytes};},
    advanceEpoch(){epoch++;},drift(key,value){if(!KEYS.includes(key)&&!key.startsWith('mkty_cloud_')&&!key.startsWith('mkty_pending_'))throw Error('fixture-drift-key');S.mutate(key,value);},
    inspect:key=>S.inspect(key),mutateDependency,
    rawSource(){return KEYS.map(key=>[key,S.inspect(key)]);},
    recordOriginal(){return {checkpoint:observeCheckpoint(),counters:{...counters}};}
  };
  $('adoptionStart').onclick=()=>void adopt().catch(()=>{});$('adoptionOpen').onclick=()=>void openController().catch(e=>{error=String(e.stack||e);render();});$('adoptionRetry').onclick=()=>void H.retry().catch(()=>{});
  await runOwner('recover',()=>owner.recover());render();window.legacyFixtureReady=true;
}
