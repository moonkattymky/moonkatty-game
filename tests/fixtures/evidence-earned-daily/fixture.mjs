// TEST ONLY. Original field completion + original offline check-in, unchanged owner.
import '/trace-codec.js';
import '/story-plan.js';
import '/field-model.js';
import {createTestAdapter} from '/prototypes/evidence-indexeddb/adapter.mjs';
import * as C from '/prototypes/evidence-indexeddb/contract.mjs';
import {createCoordinator} from '/prototypes/evidence-indexeddb/coordinator.mjs';
import {createPhaseBudget} from '/prototypes/evidence-indexeddb/phase-budget.mjs';
import {admitContext,measureFinaleData} from '/prototypes/evidence-indexeddb/finale-context-v1.mjs';
import {freezeFinalePhase,makeFinalePhase} from '/prototypes/evidence-indexeddb/finale-phase-v2.mjs';
import {createContextStream,createPhaseStream} from '/prototypes/evidence-indexeddb/context-stream.mjs';
import {recoverFinaleContext,recoverFinaleContextAndPhase} from '/prototypes/evidence-indexeddb/context-reload.mjs';
import {createSharedGuestOwner} from '/prototypes/evidence-indexeddb/shared-guest-owner.mjs';
import {createSharedLog,runFor,SHARED_LOG_CONTRACT} from '/prototypes/evidence-indexeddb/shared-log.mjs';
import {preparedOperationsText} from '/prototypes/evidence-indexeddb/prepared-operations.mjs';
import {installPhaseInputFence} from '/tests/fixtures/evidence-phase-session/input-fence.mjs';
import {createDailyBridge} from './daily-bridge.mjs';
const $=id=>document.getElementById(id),copy=v=>structuredClone(v),N=window.__nativeHarness;
const SOURCE='mkty_field_finale_9_v1',STORY='mkty_story_plan_9_v1',SESSION='b9b9b9b9b9b9b9b9b9b9b9b9b9b9b9b9';
const SCOPE='fixture:earned-daily',PRINCIPAL='guest:earned-daily',IDENTITY=Object.freeze({scope:SCOPE,generation:1,sourceIdentity:PRINCIPAL});
const STARTED='earned-daily-started:'+SESSION,BRIDGE=32768,CAP=1016832,WATCHDOG=1000;
const nativeStorage=window.localStorage,query=new URLSearchParams(location.search),order=query.get('order')||'daily-first';
const events=[],transport=[],writes=[],trustedInputs=[],budgetEvents=[],loadOrder=[];
const counters={opens:0,captures:0,saves:0,award:0,rewards:0,original:0,epilogues:0,home:0};
let owner,base,adapter,coordinator,budget,daily,fence,loaded=false,pending=false,play=false,fresh=false,disposed=false;
let facadeCache=Object.freeze({}),cacheSuspended=false,blockedReads=0,derivedCacheBytes=0,jointPeak=0,T=0,P=0;
let phaseRaw=null,phaseStream=null,contextStream=null,phaseLease=null,phaseSource=null,expectedContext=null,readContext=null,phasePin=null;
let savedCheckpoint=null,earnedText=null,terminalIntent=null,bootState=null,operationError=null,fault=null,reserveFault=null,lastRequest=null,heldTerminal=null;
let stopAfterSeal=false,sealedPause=false,dayOverride=null,rolloverDay=null,dailyState=null,inspectionBudget=null,scheduledField=false,sealedReadback=null,mainInput=null,phaseFailure=null,phaseRetryReason=null;
const push=(list,row,max=512)=>{if(list.length>=max)throw Error('fixture-observation-limit');list.push(row);return row;};
const event=(type,data={})=>push(events,{n:events.length,type,nativeIndex:N.log.length,...data});
const physical=()=>({physicalBusy:base?.physicalBusy??false,retainedBytes:base?.retainedBytes??0,nativePhysical:N.physical});
const admissionDay=()=>dayOverride??new Date().toISOString().slice(0,10);
const isDailyPending=()=>dailyState?.pending===true;
function measureBridge(){
  // Shared owner's borrowed projection is already in post-target. Only derived
  // strings and this fixture's pin/tuple scaffold belong to its 8KiB suballowance.
  const bytes=measureFinaleData([phasePin,terminalIntent,mainInput,{derivedCacheBytes}],8192)+derivedCacheBytes;
  if(bytes>8192||bytes+(dailyState?.bridgeBytes||0)>BRIDGE)throw Error('fixture-bridge-limit');return bytes;
}
function jointBudget(){
  const raw=createPhaseBudget({observe:e=>{
    if(e.live+BRIDGE>CAP)throw Error('fixture-joint-budget');jointPeak=Math.max(jointPeak,e.live+BRIDGE);
    push(budgetEvents,{type:e.type,label:e.label,bytes:e.bytes,ceiling:e.ceiling,live:e.live,jointLive:e.live+BRIDGE,reservations:Object.fromEntries(['raw-capsule','phase-workspace','private-phase','context-retained','post-target'].map(k=>[k,e.reservations[k]]))},20000);
  }});
  // Check BEFORE reserve mutates raw. Existing stream cleanup does not always
  // release a reservation when an observer rejects inside reserve itself.
  return Object.freeze({...raw,reserve(label,n){
    if(reserveFault===label){reserveFault=null;throw Error('allocation-refused');}
    if(raw.snapshot().live+n+BRIDGE>CAP)throw Error('transient-budget');return raw.reserve(label,n);
  },preflightRawTransfer(){
    const s=raw.snapshot();if(s.reservations['raw-capsule']!==65536||s.reservations['phase-workspace'])throw Error('budget-lifetime');
    if(reserveFault==='phase-workspace'){reserveFault=null;throw Error('allocation-refused');}
    if(s.live-65536+327680+BRIDGE>CAP)throw Error('transient-budget');
  }});
}
function record(payload,ordinal){
  const start=ordinal===0?20:0,dv=new DataView(payload.buffer,payload.byteOffset,payload.byteLength),n=dv.getUint32(start+4,true);
  if(n<2||n%2||n>16356)throw Error('fixture-record-limit');let text='';
  for(let i=0;i<n;i+=2)text+=String.fromCharCode(dv.getUint16(start+8+i,true));return JSON.parse(text);
}
const digest=async payload=>Array.from(new Uint8Array(await N.native.digest('SHA-256',payload)),n=>n.toString(16).padStart(2,'0')).join('');
async function tracked(kind,summary,fn){
  const row=push(transport,{kind,...summary,startNativeIndex:N.log.length},2048);
  try{const r=await fn();row.result={status:r.status,reason:r.reason??null,receipt:copy(r.receipt??null),currentHead:copy(r.currentHead??null)};
    const d=base.diagnostics;row.diagnostics=Object.fromEntries(['op','transactions','terminal','requestBytes','inputCopyBytes','touchedWrites','duplicateReadBytes','peakAccountedBytes','liveAccountedBytes'].map(k=>[k,d[k]]));return r;
  }finally{row.endNativeIndex=N.log.length;Object.assign(row,physical());}
}
async function append(q,guard){
  const effect=q.descriptor.run===runFor(SESSION)&&q.ordinal>0;
  const command=effect?record(q.payload,q.ordinal).command:null;
  const summary={run:q.descriptor.run,ordinal:q.ordinal,offset:q.offset,length:q.payload.length,expectedHead:q.expectedHead,previousRoot:q.previousRoot,seal:q.seal?copy(q.seal):null,payloadDigest:await digest(q.payload),command};
  if(effect)lastRequest=summary; // Observation only: exact retry bytes stay in adapter.
  return tracked('append',summary,()=>{
    const mode=effect&&fault&&fault.target===command.kind?fault.kind:null;
    if(mode){fault=null;event('canonical-fault',{kind:mode,target:command.kind});}
    if(mode==='stop')return {status:'refused',reason:'storage-unavailable'};
    if(mode==='abort')N.control.abortAt='first-add';
    if(mode==='hold'){
      const hold={proof:null,promise:N.holdNextTerminal('complete')};heldTerminal=hold;
      hold.promise.then(p=>{hold.proof=p;event('native-commit-held',{tx:p.tx});});let result;
      hold.timer=N.gateWatchdogDuring(()=>{result=base.appendSegment(q,guard);},WATCHDOG);
      Promise.all([hold.promise,hold.timer.due]).then(()=>hold.timer.release());return result;
    }return base.appendSegment(q,guard);
  });
}
// A shared journal cannot pass findAtomicCapture; only these three runs exist.
async function catalog(){
  const rows=[],seen=new Set();let cursor=null,watermark=null;
  do{if(rows.length>=3||seen.has(cursor))throw Error('fixture-catalog-limit');seen.add(cursor);budget.reserve('returned-page',16384);
    try{const p=await adapter.recover({scope:SCOPE,cursor,maxHeads:1,maxBytes:16384});
      if(!C.exact(p,['status','heads','watermark','nextCursor'])||p.status!=='page'||p.watermark>3||p.heads.length>1)throw Error('fixture-catalog-shape');
      if(watermark===null)watermark=p.watermark;if(watermark!==p.watermark)throw Error('fixture-catalog-change');
      for(const row of p.heads){if(![`fc1:${SESSION}:9`,`fp2:${SESSION}:9:2`,runFor(SESSION)].includes(row.descriptor.run)||rows.some(r=>r.descriptor.run===row.descriptor.run))throw Error('fixture-scope-not-isolated');rows.push({descriptor:row.descriptor,head:row.head});}
      cursor=p.nextCursor;
    }finally{budget.release('returned-page',16384);}
  }while(cursor!==null);if(rows.length!==watermark)throw Error('fixture-catalog-count');return rows;
}
async function lookup(run){return (await catalog()).find(p=>p.descriptor.run===run)??null;}
function refreshProjection(){
  const v=owner.view();facadeCache=Object.freeze({});derivedCacheBytes=0;
  if(v.manifest&&['ACTIVE','READY'].includes(v.state)){
    const m=v.manifest,history={tasks:{}};for(let i=0;i<m.gameContext.precision.total;i++)history.tasks[i]={performance:{precise:i<m.gameContext.precision.count}};
    const derived={mkty_lang:'en',mkty_control_sound:'no',mkty_current_chapter:'9',mkty_legacy_v1:JSON.stringify(m.gameContext.legacy),mkty_story_plan_1_v1:JSON.stringify(history),[SOURCE]:v.state==='READY'?null:JSON.stringify(m.source)};
    derivedCacheBytes=measureFinaleData([derived],4096);facadeCache=Object.freeze({...v.values,...(v.projection?{[STORY]:v.projection.storyText}:{}),...derived});
    event('projection-published',{state:v.state,derivedCacheBytes,syntheticPrerequisites:v.state==='ACTIVE'});
  }cacheSuspended=false;measureBridge();return v;
}
function dropBorrowedProjection(label){
  if(play)throw Error('fixture-controller-active');facadeCache=Object.freeze({});derivedCacheBytes=0;cacheSuspended=true;
  event('projection-released',{label,keysAfterRelease:0,derivedCacheBytes:0,playEnabled:play});
}
function installFacade(){
  const read=key=>{if(cacheSuspended){blockedReads++;throw Error('fixture-owned-reads-quiesced');}return facadeCache[String(key)]??null;};
  const deny=(op,key,value)=>{key=String(key);value=value===undefined?null:String(value);const equal=(facadeCache[key]??null)===value;
    push(writes,{op,key,bytes:value?.length*2||0,equal,nativeIndex:N.log.length},64);if(equal&&op!=='clear')return;throw Error('fixture-owned-write-refused');};
  const storage=Object.freeze({getItem:read,readItem:read,setItem:(k,v)=>deny('set',k,v),removeItem:k=>deny('remove',k),clear:()=>deny('clear','*'),key:i=>Object.keys(facadeCache)[i]??null,get length(){return Object.keys(facadeCache).length;},retry:()=>true,identity:()=> 'guest',get persistent(){return true;}});
  Object.defineProperty(window,'localStorage',{configurable:false,value:storage});window.MKTYStorage=storage;
  window.awardLifePoints=()=>{counters.award++;throw Error('Forbidden original award');};window.openMission9=()=>{counters.original++;throw Error('Forbidden original mission opener');};
  window.MKTYRewards=Object.freeze({completeLife(){counters.rewards++;throw Error('Forbidden reward call');},call(){counters.rewards++;throw Error('Forbidden reward call');}});
  event('facade-installed',{ownerState:owner.view().state});
}
function show(id){document.querySelectorAll('.screen').forEach(el=>el.classList.toggle('active',el.id===id));window.MKTYField?.onScreen(id);}
function render(){
  const v=owner?.view();if(!v)return;const busy=pending||isDailyPending();
  $('atomicRetry').disabled=pending||!!phaseFailure||!(v.retryEnabled||phaseRetryReason||phaseStream?.view().retryEnabled||contextStream?.view().retryEnabled||sealedPause||v.state==='ACTIVE'&&phasePin);
  $('atomicContinue').disabled=busy||dailyState?.state==='BLOCKED'||v.state!=='READY'||!v.continueEnabled;
  $('atomicResultTitle').textContent=v.state==='READY'?'Gate complete':v.state==='BLOCKED'?'Recovery blocked':pending?'Saving your gate result':'Result is not saved yet';
  $('atomicStatus').textContent=phaseRetryReason?'Earned checkpoint retained. Retry saving the same result.':phaseFailure?'Earned save refused: '+phaseFailure:sealedPause?'Earned phase sealed. Retry commits its original captured intent.':v.state==='READY'?'Saved on this device. Your demo terminal reward is included once.':v.reason?'Saving stopped: '+v.reason:'The earned result must finish native readback before Continue.';
  $('atomicBalance').textContent=v.state==='READY'?'Guest demo balance: '+facadeCache.mkty_points+' Moon Points':'';
  $('atomicHomeBalance').textContent=v.state==='READY'?'Final demo balance: '+facadeCache.mkty_final_moon_points+' Moon Points':'';
  $('dailyStatus').textContent=dailyState?.state==='SAVED'?'Check-in saved and verified.':dailyState?.state==='UNSAVED'?'Check-in is not saved. Retry uses the same original click.':dailyState?.state==='BLOCKED'?'Check-in blocked.':'';
  $('dailyRetry').disabled=pending||dailyState?.state!=='UNSAVED';
}
async function observe(label,fn){
  if(pending||disposed)throw Error('fixture-operation-busy');pending=true;operationError=null;render();
  try{return await fn();}catch(e){operationError=String(e.stack||e);event('operation-error',{label,error:String(e.message)});throw e;}
  finally{pending=false;refreshProjection();render();event('settled',{label,state:owner.view().state,...physical()});}
}
async function ownerWork(label,fn){
  if(phaseLease||phaseRaw||phaseStream||contextStream)throw Error('fixture-phase-lease-held');
  if(phaseFailure&&['terminal','resubmit'].includes(label))throw Error('fixture-phase-blocked');
  const exposed=dailyState?.exposed===true;daily?.pause();dropBorrowedProjection(label);event('owner-dispatch',{label,reservations:budget.snapshot().reservations});
  try{return await fn();}finally{refreshProjection();if(exposed&&dailyState?.ready&&!play)exposeDaily(true);}
}
const runOwner=(label,fn)=>observe(label,()=>ownerWork(label,fn));
async function script(src){event('legacy-evaluation-start',{src,ownerState:owner.view().state});loadOrder.push(src);
  await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(Error('Script load failed: '+src));document.head.append(s);});}
async function loadLegacy(){
  if(loaded)return;refreshProjection();installFacade();window.show=show;
  await script('/field-art.js');await script('/legacy.js');await script('/field-missions.js');loaded=true;
  document.addEventListener('click',e=>{if(!$('fieldMission').contains(e.target))return;const row=push(trustedInputs,{isTrusted:e.isTrusted,target:e.target.id,playEnabled:play,prevented:null},128);setTimeout(()=>{row.prevented=e.defaultPrevented;},0);},{capture:true});
  fence=installPhaseInputFence({document,readView:()=>({playEnabled:play})});
  const g=owner.view().manifest.gameContext;
  if(JSON.stringify(MKTYLegacy.precise())!==JSON.stringify(g.precision)||JSON.stringify(FieldRules.cleanMods(MKTYLegacy.mods(9,11)))!==JSON.stringify(g.modifiers))throw Error('fixture-pinned-modifiers');
}
function mountDaily(ticket){
  const day=owner.view().manifest.dailyDay;
  daily=createDailyBridge({frame:$('dailyFrame'),day,session:SESSION,owner,readCanonical:()=>owner.view(),admissionDay,
    captureAllowed:()=>!disposed&&!pending&&!play&&!phaseLease&&!sealedPause&&['ACTIVE','READY'].includes(owner.view().state),runOwner,
    onEvent:row=>{const {type,...detail}=row;event('daily-'+type,detail);if(rolloverDay&&type==='capture'){dayOverride=rolloverDay;rolloverDay=null;event('admission-clock-overridden',{day:dayOverride,afterCapture:true});}},
    onChange:value=>{dailyState=value;measureBridge();render();if(value.state==='SAVED'&&order==='daily-first'&&!play&&!phasePin&&!scheduledField){scheduledField=true;setTimeout(()=>{scheduledField=false;if(!pending&&!play&&!phasePin&&owner.view().state==='ACTIVE')openField();},0);}}});
  return daily.mount({ticket,values:owner.view().values});
}
function exposeDaily(value){$('dailyPanel').hidden=!value;daily?.expose(value);}
const contextBinding=()=>({version:1,session:SESSION,chapter:9,edition:2,baseSeed:731,storyKey:STORY,sourceKey:SOURCE,route:'spatial-finale'});
function manifest(contextPin){const day=admissionDay();return {version:1,contract:SHARED_LOG_CONTRACT,principal:PRINCIPAL,scope:SCOPE,session:SESSION,contextPin,
  source:{version:1,n:9,phase:2,seed:731,seconds:12},gameContext:{legacy:{version:1,lead:'navigator',airlock:'crew',echo:'answer',decodeNoise:54,events:{1:'antenna',3:'record',5:'keep',6:'tow',7:'rescue',9:'wait'}},precision:{count:1,total:1},modifiers:{charges:1,stability:17,preview:1}},
  baseline:{points:2100,life:null,awarded:null,completedAt:null,finalPoints:null,lockedAt:null,operationsText:preparedOperationsText(9)},entry:{origin:'new-disposable-guest',accountScope:'guest',initData:'',pendingQueueText:null},dailyDay:day,
  dailyText:JSON.stringify({cday:day,streak:0,attempts:2,solved:true,codes:['MOONTEST'],cipher:{opaque:'signal'},opaque:{units:'界🌙\ud800'},shield_week:'2026-W01'})};}
async function start(){return observe('adopt',async()=>{
  if(!fresh||owner.view().state!=='NEW')throw Error('fixture-not-fresh');fresh=false;sessionStorage.setItem(STARTED,'yes');
  let storyText=JSON.stringify({...StoryPlan.fresh(9,9009,2),createdAt:1,phase:'core',done:[0,1,2,3,4,5,6,7],tasks:{}}),context=null,stream=null;
  T=storyText.length*2;if(T>16384)throw Error('fixture-small-context-limit');budget.reserve('context-retained',T);
  try{context=admitContext({scope:SCOPE,session:SESSION,storyText,binding:contextBinding()},budget);budget.reserve('phase-workspace',327680);
    const expected={...IDENTITY,sourceText:JSON.stringify({version:1,n:9,phase:2,seed:731,seconds:12})};
    stream=createContextStream({context,coordinator,readContext:()=>({...expected,storyText}),expectedContext:expected,budget,crypto});
    if(!(await stream.save()).ready)throw Error('fixture-prepared-context:'+stream.view().reason);
  }finally{stream=null;context=null;storyText=null;for(const label of ['phase-workspace','context-retained']){const n=budget.snapshot().reservations[label];if(n)budget.release(label,n);}}
  let pin=await lookup(`fc1:${SESSION}:9`);mainInput=manifest(pin);pin=null;measureBridge();
  try{await ownerWork('adopt',()=>owner.adopt(mainInput));}finally{mainInput=null;}
  if(owner.view().state!=='ACTIVE')throw Error('fixture-adoption:'+owner.view().reason);event('canonical-hydrated',{state:'ACTIVE'});
  let ticket=await ownerWork('admit-daily',()=>owner.admitDaily());if(!ticket)throw Error('fixture-daily-admission');mainInput=ticket;measureBridge();
  try{await loadLegacy();await mountDaily(ticket);}finally{ticket=null;mainInput=null;}if(dailyState?.state!=='PREPARED')throw Error('fixture-daily-mount');
  if(order==='terminal-first'){daily.pause();exposeDaily(false);openField();}else{show('atomicDaily');exposeDaily(true);}
});}
function openField(){
  if(disposed||play||phasePin||phaseRaw||phaseLease||phaseFailure||owner.view().state!=='ACTIVE'||isDailyPending())throw Error('fixture-cannot-open-field');
  if(order==='daily-first'&&JSON.parse(owner.view().values.mkty_daily_demo).last_day!==owner.view().manifest.dailyDay)throw Error('fixture-daily-first-pending');
  daily?.pause();exposeDaily(false);play=true;counters.opens++;event('controller-open');
  MKTYField.open({chapter:9,id:2,fieldStage:4,mechanic:11,title:['Пройти закрывающийся шлюз','Through the closing gate'],core:true,phaseCount:3,seed:16569,
    save(cp){counters.saves++;if(play)savedCheckpoint=copy(cp);},
    complete(cp){
      // Only unchanged field-missions finish reaches here. Capture tuple/source/
      // checkpoint synchronously BEFORE observe(), its first await, or IDB work.
      play=false;counters.captures++;daily?.pause();const m=owner.view().manifest,now=Date.now();
      terminalIntent=Object.freeze({storyAccumulated:now,report:now,pace:now,storyCompleted:now,lock:now});
      try{budget.reserve('raw-capsule',65536);phaseSource=JSON.stringify({...m.source,checkpoint:cp});
        phaseRaw=freezeFinalePhase({scope:SCOPE,session:SESSION,checkpoint:cp,sourceText:phaseSource,
          binding:{version:1,chapter:9,edition:2,phase:2,mechanic:11,fieldStage:4,baseSeed:731,seed:16569,sourceKey:SOURCE,storyKey:STORY,route:'spatial-finale',provenance:{legacyAtCapture:copy(m.gameContext.legacy),precisionAtCapture:copy(m.gameContext.precision),terminalIntent}}},budget);
        earnedText=MKTYTraceCodec.stringify(cp,8192,'fixture-earned-limit');event('earned-controller-callback',{traceRows:cp.trace.length,seconds:cp.seconds,terminalIntent});cp=null;
      }catch(e){phaseFailure=String(e.message);operationError=String(e.stack||e);releasePhase();show('atomicResult');render();return;}
      show('atomicResult');void observe('earned-seal',sealEarned).catch(()=>{});
    },exit(){play=false;show('atomicResult');}},undefined);
}
function releasePhase(){
  phaseRaw=null;phaseStream=null;contextStream=null;phaseSource=null;expectedContext=null;readContext=null;phaseRetryReason=null;
  for(const label of ['private-phase','phase-workspace','raw-capsule']){const n=budget.snapshot().reservations[label];if(n)budget.release(label,n);}
  const lease=phaseLease;phaseLease=null;lease?.dispose();event('phase-leases-released',{reservations:budget.snapshot().reservations});
}
async function sealEarned(){
  dropBorrowedProjection('earned-context-recovery');
  try{
    phaseLease=await recoverFinaleContext({adapter,contextPin:owner.view().manifest.contextPin,budget,crypto});T=phaseLease.storyText.length*2;
    if(T>16384)throw Error('fixture-small-context-limit');
    // Transfer coverage synchronously: no raw/workspace overlap and no await.
    budget.preflightRawTransfer();budget.release('raw-capsule',65536);budget.reserve('phase-workspace',327680);phaseRetryReason=null;
    expectedContext={...IDENTITY,sourceText:phaseSource};readContext=()=>({...expectedContext,storyText:phaseLease.storyText});
    contextStream=createContextStream({context:phaseLease.context,coordinator,readContext,expectedContext,budget,crypto});
    if(!(await contextStream.save()).ready)return contextStream.view();return sealPhase();
  }catch(e){
    if(phaseRaw&&budget.snapshot().reservations['raw-capsule']===65536&&['allocation-refused','transient-budget'].includes(e.message)){
      // Admission/reserve refusal cannot discard the earned callback capsule.
      // Context is independently released; raw/source remain covered for Retry.
      expectedContext=null;readContext=null;contextStream=null;const lease=phaseLease;phaseLease=null;lease?.dispose();
      phaseRetryReason=e.message;event('earned-raw-retained',{reason:phaseRetryReason,reservations:budget.snapshot().reservations});
      return {state:'UNSAVED',ready:false,retryEnabled:true,reason:phaseRetryReason};
    }phaseFailure=String(e.message);releasePhase();throw e;
  }
}
async function sealPhase(){
  let artifact=null;
  try{artifact=makeFinalePhase(phaseRaw,phaseLease.context,contextStream.reference(),budget);P=artifact.bytes.length;
    if(P>16384||967680+T+2*P>CAP)throw Error('fixture-phase-bound');
    phaseStream=createPhaseStream({context:phaseLease.context,artifact,reference:contextStream.reference(),coordinator,readContext,expectedContext,budget,crypto});
    artifact=null;phaseRaw=null;const result=await phaseStream.save();if(!result.ready)return result;return afterSealed();
  }catch(e){artifact=null;phaseFailure=String(e.message);releasePhase();throw e;}
}
async function afterSealed(){
  releasePhase();phasePin=await lookup(`fp2:${SESSION}:9:2`);if(!phasePin)throw Error('fixture-earned-pin-missing');measureBridge();
  try{await inspectSeal();}catch(e){phaseFailure=String(e.message);throw e;}event('earned-phase-sealed',{phasePin,T,P,terminalIntent});
  if(stopAfterSeal){stopAfterSeal=false;sealedPause=true;event('seal-before-append-paused');return owner.view();}return submitSealed();
}
async function submitSealed(){
  sealedPause=false;const result=await ownerWork('terminal',()=>owner.submitTerminal(phasePin));
  if(result.state==='READY'&&order==='terminal-first'){if(!daily){await mountDaily(null);daily.pause();}if(dailyState?.ready)exposeDaily(true);}return result;
}
async function retry(){
  if(phaseFailure)throw Error('fixture-phase-blocked');
  if(dailyState?.state==='UNSAVED')return daily.retry();
  return observe('retry',async()=>{
    if(phaseRaw&&phaseRetryReason)return sealEarned();
    if(contextStream&&!phaseStream){const r=await contextStream.retry();return r.ready?sealPhase():r;}
    if(phaseStream){const r=await phaseStream.retry();return r.ready?afterSealed():r;}
    if(owner.view().state==='ACTIVE'&&phasePin)return submitSealed();
    const r=await ownerWork('retry',()=>owner.retry());if(r.state==='READY'&&order==='terminal-first'&&dailyState?.ready)exposeDaily(true);return r;
  });
}
function continueResult(){
  const v=owner.view();if(disposed||pending||isDailyPending()||dailyState?.state==='BLOCKED'||v.state!=='READY'||!v.continueEnabled||$('legacyDialog').open)return false;
  counters.epilogues++;event('epilogue-open');MKTYLegacy.epilogue(()=>{counters.home++;event('home-navigation');show('atomicHome');});return true;
}
async function history(){return observe('history',()=>ownerWork('history',async()=>{
  if(base.physicalBusy||base.retainedBytes||phaseLease)throw Error('fixture-inspection-busy');
  // Bounded observations are not reused as owner input or retry byte ownership.
  const log=createSharedLog({adapter,scope:SCOPE,session:SESSION,principal:PRINCIPAL,budget,crypto}),pin=await log.head(),records=[],prefixes=[],payloadDigests=[];let root=C.ZERO;
  if(pin){const desc=await C.descriptor(pin.descriptor);for(let ordinal=0;ordinal<=pin.head.ordinal;ordinal++){
    const lease=await log.readRecord(pin,ordinal);try{records.push(copy(lease.record));}finally{lease.dispose();}
    budget.reserve('returned-page',16384);try{const p=await adapter.readSegments({captureIdentity:{scope:SCOPE,run:runFor(SESSION)},throughHead:pin.head.token,afterOrdinal:ordinal-1,maxBytes:16384});
      if(p.status!=='page'||p.segments.length!==1)throw Error('fixture-history-read');const part=p.segments[0];root=await C.chain(desc,{ordinal,offset:ordinal*16384,previousRoot:root},part.payload);
      if(root!==part.root)throw Error('fixture-history-root');payloadDigests.push(await digest(part.payload));prefixes.push({descriptor:pin.descriptor,head:await C.makeHead(desc,ordinal,(ordinal+1)*16384,root,ordinal===2)});
    }finally{budget.release('returned-page',16384);}
  }}inspectionBudget=budget.snapshot();return {pin,records,prefixes,payloadDigests,budget:inspectionBudget};
}));}
async function inspectSeal(){
  const lease=await recoverFinaleContextAndPhase({adapter,contextPin:owner.view().manifest.contextPin,phasePin,budget,crypto});
  try{T=lease.storyText.length*2;P=phasePin.head.total;terminalIntent=copy(lease.phase.binding.provenance.terminalIntent);
    // Bounded parity observation only, never fed back into owner commands.
    const checkpointText=MKTYTraceCodec.stringify(lease.phase.checkpoint,8192,'fixture-earned-limit');
    sealedReadback=Object.freeze({checkpointText,sourceText:lease.phase.sourceText,terminalIntent:copy(terminalIntent),phasePin:copy(phasePin),nativeIndex:N.log.length});
    measureFinaleData([sealedReadback],32768);event('phase-readback-verified',{phasePin,checkpointBytes:checkpointText.length*2});
    if(earnedText!==null&&checkpointText!==earnedText)throw Error('fixture-earned-readback-mismatch');return sealedReadback;
  }finally{lease.dispose();}
}
function arm(value){
  if(value==='seal-stop'){stopAfterSeal=true;return;}
  const next=typeof value==='string'?{kind:value,target:'terminal'}:value;
  if(fault||!['stop','abort','hold'].includes(next?.kind)||!['terminal','daily'].includes(next?.target))throw Error('fixture-fault-kind');fault=next;
}
function setDay(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)throw Error('fixture-day');dayOverride=value;}
function facts(){
  const result={view:copy(owner.view()),bootState,order,counters:copy(counters),events:copy(events),transport:copy(transport),nativeEvents:copy(N.log),writes:copy(writes),trustedInputs:copy(trustedInputs),loadOrder:[...loadOrder],
    ...physical(),budget:budget.snapshot(),inspectionBudget,jointBudget:{allowance:BRIDGE,peak:jointPeak,bridgeBytes:measureBridge()+(dailyState?.bridgeBytes||0),T,P,budgetEvents:copy(budgetEvents)},daily:daily?.facts()??null,
    cache:copy(facadeCache),cacheSuspended,blockedReads,derivedCacheBytes,playEnabled:play,model:window.MKTYField?.snapshot()??null,savedCheckpoint:copy(savedCheckpoint),earnedText,terminalIntent:copy(terminalIntent),phasePin:copy(phasePin),sealedReadback:copy(sealedReadback),sealedPause,phaseFailure,phaseRetryReason,rawPending:!!phaseRaw,
    active:document.querySelector('.screen.active')?.id,fieldDialogOpen:!!$('fieldDialog')?.open,epilogueOpen:!!$('legacyDialog')?.open,epilogueText:$('legacyDialog')?.textContent??null,
    pendingQueueText:nativeStorage.getItem('mkty_pending_v2_unrelated'),nativePoints:nativeStorage.getItem('mkty_points'),operationError,settled:!pending,phaseStream:phaseStream?.view()??null,inputFence:fence?.diagnostics()??null,admissionDay:admissionDay(),knownStarted:sessionStorage.getItem(STARTED)==='yes'};
  if(JSON.stringify(result).length*2>16777216)throw Error('fixture-report-limit');return result;
}
export async function bootEarnedDailyFixture(){
  if(!N||window.Telegram?.WebApp?.initData||!['daily-first','terminal-first'].includes(order))throw Error('fixture-entry');
  Object.defineProperty(N.log,'push',{value:function(...rows){if(this.length+rows.length>20000)throw Error('fixture-native-log-limit');return Array.prototype.push.apply(this,rows);}});
  budget=jointBudget();base=createTestAdapter({scope:SCOPE,watchdogMs:WATCHDOG,...(query.get('storage')==='unavailable'?{indexedDB:null}:{})});
  adapter={scope:SCOPE,appendSegment:append,retry:guard=>tracked('exact-retry',lastRequest??{},()=>base.retry(guard)),readSegments:q=>tracked('read',{run:q.captureIdentity.run,afterOrdinal:q.afterOrdinal,maxBytes:q.maxBytes,throughHead:q.throughHead},()=>base.readSegments(q)),recover:q=>tracked('recover',{cursor:q.cursor??null,maxBytes:q.maxBytes},()=>base.recover(q)),get physicalBusy(){return base.physicalBusy;},get retainedBytes(){return base.retainedBytes;}};
  coordinator=createCoordinator(adapter,()=>IDENTITY);owner=createSharedGuestOwner({adapter,scope:SCOPE,session:SESSION,principal:PRINCIPAL,budget,crypto,admissionDay});
  window.H={get ready(){return window.atomicFixtureReady===true;},get settled(){return !pending&&!scheduledField&&!['DRAINING','SAVING','MOUNTING'].includes(dailyState?.state);},get heldTerminal(){return heldTerminal?.proof??null;},facts,history,retry,arm,armDaily:kind=>arm({kind,target:'daily'}),setDay,
    rolloverAfterCapture(day){const prior=dayOverride;setDay(day);rolloverDay=day;dayOverride=prior;},pauseAfterSeal(value=true){stopAfterSeal=!!value;},releaseHeld(){return N.releaseTerminals(heldTerminal?.proof?.tx??null);},
    failReserve(label){if(typeof label!=='string'||!Object.hasOwn(budget.snapshot().reservations,label))throw Error('fixture-budget-label');reserveFault=label;},
    exposeStale(value){if(play)throw Error('Cannot expose active board');$('fieldMission').style.display=value?'block':'';},
    staleWrites(){return [()=>localStorage.setItem('mkty_points','99999'),()=>localStorage.removeItem(STORY),()=>localStorage.clear()].map(fn=>{try{return {returned:fn()??null};}catch(e){return {error:e.message};}});},
    changeNative(){nativeStorage.setItem('mkty_points','99999');nativeStorage.setItem(STORY,'corrupt old mirror');nativeStorage.setItem('mkty_daily_demo','{"streak":99}');return true;},
    clearNative(){for(let i=nativeStorage.length-1;i>=0;i--){const key=nativeStorage.key(i);if(key!=='mkty_pending_v2_unrelated')nativeStorage.removeItem(key);}return true;},
    resubmit:()=>runOwner('resubmit',()=>owner.submitTerminal(phasePin)),
    async evidence(){return observe('evidence',()=>ownerWork('evidence',inspectSeal));},
    dispose(){if(pending||play||phaseLease||phaseRaw||contextStream||phaseStream||phaseRetryReason||base.physicalBusy||base.retainedBytes)throw Error('fixture-dispose-busy');daily?.dispose();disposed=true;dropBorrowedProjection('dispose');owner.dispose();phasePin=null;terminalIntent=null;base.close();return budget.snapshot();}
  };
  $('atomicStart').onclick=()=>{void start().catch(()=>{});};$('atomicRetry').onclick=()=>{void retry().catch(()=>{});};$('dailyRetry').onclick=()=>{void daily.retry().catch(()=>{});};
  $('atomicContinue').onclick=continueResult;$('atomicReview').onclick=()=>show('atomicResult');
  const opened=await base.open();event('adapter-open',{status:opened.status,reason:opened.reason??null});if(opened.status!=='open')throw Error(opened.reason);
  await owner.recover();const heads=await catalog();phasePin=heads.find(p=>p.descriptor.run===`fp2:${SESSION}:9:2`)??null;bootState=owner.view().state;
  event('canonical-hydrated',{state:bootState});fresh=bootState==='NEW'&&heads.length===0&&sessionStorage.getItem(STARTED)!=='yes'&&!query.has('existing');
  if(fresh){bootState='SETUP';show('atomicSetup');}
  else if(['ACTIVE','READY'].includes(bootState)){
    if(phasePin)await inspectSeal();await loadLegacy();
    if(phasePin||bootState==='READY'){sealedPause=bootState==='ACTIVE';show('atomicResult');
      // A stale ticket is intentionally volatile. An ACTIVE unclaimed seal has
      // no original daily realm until the terminal is committed and locked.
      if(bootState==='READY'||JSON.parse(owner.view().values.mkty_daily_demo).last_day===owner.view().manifest.dailyDay){await mountDaily(null);daily.pause();exposeDaily(bootState==='READY');}}
    else{let ticket=null;const claimed=JSON.parse(owner.view().values.mkty_daily_demo).last_day===owner.view().manifest.dailyDay;
      if(!claimed)ticket=await ownerWork('admit-daily',()=>owner.admitDaily());mainInput=ticket;measureBridge();
      try{await mountDaily(ticket);}finally{ticket=null;mainInput=null;}
      if(order==='daily-first'&&!claimed){show('atomicDaily');exposeDaily(true);}else{daily.pause();openField();}}
  }else $('atomicLoadingStatus').textContent='Recovery blocked: '+(owner.view().reason||'Incomplete disposable adoption');
  render();window.atomicFixtureReady=true;
}
