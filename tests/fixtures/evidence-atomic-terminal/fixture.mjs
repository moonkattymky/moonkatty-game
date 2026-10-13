// TEST ONLY. The unchanged field controller earns the final raw checkpoint.
import '/trace-codec.js';
import '/story-plan.js';
import '/field-model.js';
import {createTestAdapter,DB_NAME,STORES} from '/prototypes/evidence-indexeddb/adapter.mjs';
import {createCoordinator} from '/prototypes/evidence-indexeddb/coordinator.mjs';
import {exact} from '/prototypes/evidence-indexeddb/contract.mjs';
import {createPhaseBudget} from '/prototypes/evidence-indexeddb/phase-budget.mjs';
import {admitContext,measureFinaleData} from '/prototypes/evidence-indexeddb/finale-context-v1.mjs';
import {freezeFinalePhase,makeFinalePhase} from '/prototypes/evidence-indexeddb/finale-phase-v2.mjs';
import {createContextStream,createPhaseStream} from '/prototypes/evidence-indexeddb/context-stream.mjs';
import {createAtomicTerminalOwner,findAtomicCapture} from '/prototypes/evidence-indexeddb/atomic-terminal.mjs';
import {preparedOperationsText} from '/prototypes/evidence-indexeddb/prepared-operations.mjs';
import {installPhaseInputFence} from '/tests/fixtures/evidence-phase-session/input-fence.mjs';
const $=id=>document.getElementById(id),copy=v=>structuredClone(v),N=window.__nativeHarness;
const SOURCE='mkty_field_finale_9_v1',STORY='mkty_story_plan_9_v1';
const SESSION='a9a9a9a9a9a9a9a9a9a9a9a9a9a9a9a9',SCOPE='atomic-terminal-native:guest',PRINCIPAL='guest:atomic-terminal-native';
const IDENTITY=Object.freeze({scope:SCOPE,generation:1,sourceIdentity:PRINCIPAL});
const STARTED='atomic-terminal-started:'+SESSION;
const nativeStorage=window.localStorage,readNative=nativeStorage.getItem.bind(nativeStorage);
const nativeSet=nativeStorage.setItem.bind(nativeStorage),nativeRemove=nativeStorage.removeItem.bind(nativeStorage);
const events=[],transport=[],writes=[],trustedInputs=[],counters={opens:0,captures:0,saves:0,award:0,rewards:0,original:0,epilogues:0,home:0};
let derivedCacheBytes=0,cacheSuspended=false,blockedReads=0,freshScope=false,owner,adapter,base,budget,coordinator,fence,facadeCache=Object.freeze({}),loaded=false,play=false,phaseStream=null;
let phaseContextStream=null,phaseContext=null,phaseRaw=null,phaseArtifact=null,phaseSource=null,phasePin=null;
let savedCheckpoint=null,earnedText=null,lastCanonicalRequest=null,fault=null,pending=false,operationError=null;
let phaseWorkspace=false,phasePrivate=0,heldTerminal=null,lastSubmit=null,bootState=null,loadOrder=[];
const boundedPush=(list,row,max=256)=>{if(list.length>=max)throw Error('Fixture observation limit');list.push(row);};
const event=(type,detail={})=>boundedPush(events,{n:events.length,type,nativeIndex:N.log.length,...detail});
const physical=()=>({physicalBusy:adapter?.physicalBusy??false,retainedBytes:adapter?.retainedBytes??0,nativePhysical:N.physical});
const pendingQueue=()=>readNative('mkty_pending_v2_unrelated');
const requestSummary=q=>({run:q?.descriptor?.run??null,ordinal:q?.ordinal??null,length:q?.payload?.length??0,seal:!!q?.seal});
async function tracked(kind,q,work){
  const row={kind,...requestSummary(q),startNativeIndex:N.log.length};boundedPush(transport,row,256);
  try{const r=await work();row.result={status:r.status,reason:r.reason??null,receipt:r.receipt??null,currentHead:r.currentHead??null};return r;}
  finally{row.endNativeIndex=N.log.length;Object.assign(row,physical());}
}
function faulted(q){
  if(!q?.descriptor?.run.startsWith('fcommit1:'))return null;
  lastCanonicalRequest={...q,descriptor:copy(q.descriptor),payload:new Uint8Array(q.payload),...(q.seal?{seal:copy(q.seal)}:{})};
  if(!fault)return null;const kind=fault;fault=null;event('canonical-fault',{kind});
  if(kind==='stop')return {status:'refused',reason:'storage-unavailable'};
  if(kind==='abort')N.control.abortAt='first-add';
  if(kind==='hold'){heldTerminal={proof:null,promise:N.holdNextTerminal('complete'),needsTimer:true};heldTerminal.promise.then(p=>{heldTerminal.proof=p;event('native-commit-held',{tx:p.tx});});}
  return null;
}
function projectionCache(view){
  const p=view.projection,m=view.manifest;if(!p||!m)throw Error('No hydrated owner projection');
  // Owner story/values remain aliases covered by its live lease. Derived legacy
  // and synthetic precision strings use an explicit8KiB share of metadata.
  let history=null,derived=null,workspace=false;
  try{
    if(budget.snapshot().reservations['atomic-record-workspace'])throw Error('Cache workspace already held');
    workspace=true;budget.reserve('atomic-record-workspace',65536);
    budget.allocate('atomic-record-workspace',65536);history={tasks:{}};
    for(let i=0;i<m.gameContext.precision.total;i++)history.tasks[i]={performance:{precise:i<m.gameContext.precision.count}};
    measureFinaleData([history],8192);
    derived={mkty_lang:'en',mkty_control_sound:'no',mkty_current_chapter:'9',
      mkty_legacy_v1:JSON.stringify(m.gameContext.legacy),mkty_story_plan_1_v1:JSON.stringify(history),
      [SOURCE]:view.state==='READY'?null:JSON.stringify(m.source)};
    derivedCacheBytes=measureFinaleData([derived],8192);budget.allocate('metadata',8192);
    return Object.freeze({...p.values,[STORY]:p.storyText,...derived});
  }finally{history=null;derived=null;if(workspace){const held=budget.snapshot().reservations['atomic-record-workspace'];if(held)budget.release('atomic-record-workspace',held);}}
}
function refreshProjection(){
  const v=owner.view();
  if(v.projection&&['ADOPTED','READY'].includes(v.state)){
    facadeCache=Object.freeze({});derivedCacheBytes=0;cacheSuspended=true;
    facadeCache=projectionCache(v);cacheSuspended=false;
    event('projection-published',{state:v.state,storyBytes:facadeCache[STORY].length*2,derivedCacheBytes,derivedCacheSlot:'metadata:8192'});
  }return v;
}
function dropBorrowedProjection(label){
  if(play)throw Error('Controller must be quiescent before projection release');
  const storyBytes=facadeCache[STORY]?.length*2||0;facadeCache=Object.freeze({});derivedCacheBytes=0;cacheSuspended=true;
  event('projection-released',{label,storyBytes,keysAfterRelease:Object.keys(facadeCache).length,derivedCacheBytes,playEnabled:play});
}
function readOwned(key){if(cacheSuspended){blockedReads++;throw Error('atomic-owned-reads-quiesced');}return Object.hasOwn(facadeCache,String(key))?facadeCache[String(key)]:null;}
function installFacade(){
  if(loaded)throw Error('Duplicate facade install');
  const deny=(op,key,value)=>{
    key=String(key);value=value===undefined?null:String(value);const equal=(facadeCache[key]??null)===value;
    boundedPush(writes,{op,key,bytes:value?.length*2||0,equal,nativeIndex:N.log.length},64);
    if(equal&&op!=='clear')return;throw Error('atomic-owned-write-refused');
  };
  const facade=Object.freeze({getItem:readOwned,readItem:readOwned,
    setItem:(key,value)=>deny('set',key,value),removeItem:key=>deny('remove',key),clear:()=>deny('clear','*'),
    key:i=>Object.keys(facadeCache)[i]??null,get length(){return Object.keys(facadeCache).length;},
    retry:()=>{event('facade-retry');return true;},identity:()=> 'guest',get persistent(){return true;}});
  Object.defineProperty(window,'localStorage',{configurable:true,value:facade});window.MKTYStorage=facade;
  event('facade-installed',{ownerState:owner.view().state});
}
function show(id){
  document.querySelectorAll('.screen').forEach(el=>el.classList.toggle('active',el.id===id));
  window.MKTYField?.onScreen(id);
}
function render(){
  const v=owner?.view();if(!v)return;
  $('atomicRetry').disabled=pending||!(phaseStream?.view().retryEnabled||v.retryEnabled||(v.state==='ADOPTED'&&v.phasePin));
  $('atomicContinue').disabled=pending||v.state!=='READY'||!v.continueEnabled;
  $('atomicResultTitle').textContent=v.state==='READY'?'Gate complete':v.state==='BLOCKED'?'Recovery blocked':pending?'Saving your gate result':'Result is not saved yet';
  $('atomicStatus').textContent=v.state==='READY'?'Saved on this device. Your demo reward is included once.':v.reason?('Saving stopped: '+v.reason+'. Keep this page open and retry.'):'Keep this page open while the earned result is saved.';
  $('atomicBalance').textContent=v.state==='READY'?'Guest demo balance: '+facadeCache.mkty_points+' Moon Points':'';
  $('atomicHomeBalance').textContent=v.state==='READY'?'Final demo balance: '+facadeCache.mkty_final_moon_points+' Moon Points':'';
}
async function observe(label,operation){
  if(pending)return false;pending=true;operationError=null;render();
  try{return await operation();}catch(e){operationError=String(e.stack||e);event('operation-error',{label,error:String(e.message)});throw e;}
  finally{pending=false;refreshProjection();render();event('settled',{label,state:owner.view().state,...physical()});}
}
async function script(src){
  event('legacy-evaluation-start',{src,ownerState:owner.view().state});loadOrder.push(src);
  await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(Error('Script load failed: '+src));document.head.append(s);});
}
async function loadLegacy(){
  if(loaded)return;refreshProjection();installFacade();window.show=show;
  // These tripwires are not legacy implementations. No file defining a real
  // award/reward/original-final callback is loaded by this entry.
  window.awardLifePoints=()=>{counters.award++;throw Error('Forbidden original award');};
  window.openMission9=()=>{counters.original++;throw Error('Forbidden original mission opener');};
  window.MKTYRewards=Object.freeze({completeLife(){counters.rewards++;throw Error('Forbidden reward call');}});
  await script('/field-art.js');await script('/legacy.js');await script('/field-missions.js');
  loaded=true;
  document.addEventListener('click',e=>{
    if(!$('fieldMission').contains(e.target)||play)return;
    const row={isTrusted:e.isTrusted,target:e.target.id,prevented:null};boundedPush(trustedInputs,row,16);
    setTimeout(()=>{row.prevented=e.defaultPrevented;},0);
  },{capture:true});
  fence=installPhaseInputFence({document,readView:()=>({playEnabled:play})});
  const expected=owner.view().manifest.gameContext;
  if(JSON.stringify(MKTYLegacy.precise())!==JSON.stringify(expected.precision))throw Error('Pinned precision projection differs');
  if(JSON.stringify(FieldRules.cleanMods(MKTYLegacy.mods(9,11)))!==JSON.stringify(FieldRules.cleanMods(expected.modifiers)))throw Error('Pinned modifiers differ');
}
function timestamps(){const now=Date.now();return {storyAccumulated:now,report:now,pace:now,storyCompleted:now,lock:now};}
function manifest(contextPin){return {version:1,contract:'fixed-guest-chapter9-phase2-v1',principal:PRINCIPAL,scope:SCOPE,session:SESSION,contextPin,
  source:{version:1,n:9,phase:2,seed:731,seconds:12},
  gameContext:{legacy:{version:1,lead:'navigator',airlock:'crew',echo:'answer',decodeNoise:54,events:{1:'antenna',3:'record',5:'keep',6:'tow',7:'rescue',9:'wait'}},precision:{count:1,total:1},modifiers:{charges:1,stability:17,preview:1}},
  baseline:{points:2100,life:null,awarded:null,completedAt:null,finalPoints:null,lockedAt:null,operationsText:preparedOperationsText(9)},
  entry:{origin:'new-disposable-guest',accountScope:'guest',initData:'',pendingQueueText:null}};}
const binding=()=>({version:1,session:SESSION,chapter:9,edition:2,baseSeed:731,storyKey:STORY,sourceKey:SOURCE,route:'spatial-finale'});
async function lookup(run){return findAtomicCapture(adapter,SCOPE,run,budget,crypto);}
async function start(){return observe('adopt',async()=>{
  if(!freshScope)throw Error('Only an explicitly checked empty scope may adopt');freshScope=false;
  if(window.Telegram?.WebApp?.initData)throw Error('Authenticated entry forbidden');
  sessionStorage.setItem(STARTED,'yes');
  let storyText=JSON.stringify({...StoryPlan.fresh(9,9009,2),createdAt:1,phase:'core',done:[0,1,2,3,4,5,6,7],tasks:{}});
  let context,stream;const sourceText=JSON.stringify({version:1,n:9,phase:2,seed:731,seconds:12});
  budget.reserve('context-retained',storyText.length*2);
  try{
    context=admitContext({scope:SCOPE,session:SESSION,storyText,binding:binding()},budget);budget.reserve('phase-workspace',327680);
    const expectedContext={...IDENTITY,sourceText};stream=createContextStream({context,coordinator,readContext:()=>({...expectedContext,storyText}),expectedContext,budget,crypto});
    if(!(await stream.save()).ready)throw Error('Prepared context failed to seal: '+stream.view().reason);
  }finally{stream=null;context=null;budget.release('phase-workspace',327680);budget.release('context-retained',storyText.length*2);storyText=null;}
  const pin=await lookup('fc1:'+SESSION+':9');await owner.adopt(manifest(pin));
  if(owner.view().state!=='ADOPTED')throw Error('Adoption refused: '+owner.view().reason);event('canonical-hydrated',{state:'ADOPTED'});
  await loadLegacy();openField();
});}
function openField(){
  const v=owner.view();if(v.state!=='ADOPTED'||v.phasePin)throw Error('Cannot reopen accepted terminal phase');
  play=true;counters.opens++;event('controller-open');
  MKTYField.open({chapter:9,id:2,fieldStage:4,mechanic:11,title:['Пройти закрывающийся шлюз','Through the closing gate'],core:true,phaseCount:3,seed:16569,
    save(cp){counters.saves++;if(play)savedCheckpoint=copy(cp);},
    complete(cp){
      // This function is reachable only through the original controller's final
      // finish action. No test helper exposes it or invokes it directly.
      play=false;counters.captures++;earnedText=MKTYTraceCodec.stringify(cp,8192,'fixture-earned-limit');
      event('earned-controller-callback',{traceRows:cp.trace.length,seconds:cp.seconds});show('atomicResult');
      void observe('earned-submit',()=>sealEarned(cp)).catch(()=>{});
    },exit(){play=false;show('atomicResult');}},undefined);
}
function releasePhase(){
  phaseRaw=null;phaseArtifact=null;phaseStream=null;phaseContextStream=null;phaseContext=null;phaseSource=null;
  if(phasePrivate){budget.release('private-phase',phasePrivate);phasePrivate=0;}
  if(phaseWorkspace){budget.release('phase-workspace',327680);phaseWorkspace=false;}
}
async function sealEarned(cp){
  const m=owner.view().manifest;let lease=owner.context();phaseContext=lease.context;
  phaseSource=JSON.stringify({...m.source,checkpoint:cp});
  let expectedContext={...IDENTITY,sourceText:phaseSource},readContext=()=>({...expectedContext,storyText:lease.storyText});
  let phaseBinding={version:1,chapter:9,edition:2,phase:2,mechanic:11,fieldStage:4,baseSeed:731,seed:16569,sourceKey:SOURCE,storyKey:STORY,route:'spatial-finale',provenance:{legacyAtCapture:copy(m.gameContext.legacy),precisionAtCapture:copy(m.gameContext.precision)}};
  budget.reserve('raw-capsule',65536);
  try{phaseRaw=freezeFinalePhase({scope:SCOPE,session:SESSION,checkpoint:cp,sourceText:phaseSource,binding:phaseBinding},budget);}
  finally{budget.release('raw-capsule',65536);}
  budget.reserve('phase-workspace',327680);phaseWorkspace=true;
  phaseContextStream=createContextStream({context:phaseContext,coordinator,readContext,expectedContext,budget,crypto});
  if(!(await phaseContextStream.save()).ready)throw Error('Context verification refused');
  phaseArtifact=makeFinalePhase(phaseRaw,phaseContext,phaseContextStream.reference(),budget);
  phaseStream=createPhaseStream({context:phaseContext,artifact:phaseArtifact,reference:phaseContextStream.reference(),coordinator,readContext,expectedContext,budget,crypto});
  phasePrivate=budget.snapshot().reservations['private-phase'];phaseRaw=null;phaseArtifact=null;
  const result=await phaseStream.save();if(!result.ready)return result;
  lease=null;expectedContext=null;readContext=null;phaseBinding=null;return submitSealed();
}
async function submitSealed(){
  releasePhase();phasePin=await lookup('fp2:'+SESSION+':9:2');
  lastSubmit={phasePin,timestamps:timestamps()};dropBorrowedProjection('submit');const result=await owner.submit(lastSubmit);refreshProjection();return result;
}
async function retry(){return observe('retry',async()=>{
  if(phaseStream){const result=await phaseStream.retry();if(!result.ready)return result;return submitSealed();}
  if(owner.view().state==='ADOPTED'&&owner.view().phasePin){phasePin=owner.view().phasePin;lastSubmit={phasePin,timestamps:timestamps()};dropBorrowedProjection('recovered-submit');return owner.submit(lastSubmit);}
  dropBorrowedProjection('retry');return owner.retry();
});}
function continueResult(){
  const v=owner.view();if(pending||v.state!=='READY'||!v.continueEnabled)return false;
  if($('legacyDialog').open)return false;
  counters.epilogues++;event('epilogue-open');MKTYLegacy.epilogue(()=>{counters.home++;event('home-navigation');show('atomicHome');});return true;
}
async function corrupt(kind){
  if(!['missing-context','corrupt-phase'].includes(kind))throw Error('Unknown disposable corruption case');
  const run=(kind==='missing-context'?'fc1:':'fp2:')+SESSION+(kind==='missing-context'?':9':':9:2');
  return N.fixture(async()=>{const db=await new Promise((resolve,reject)=>{const q=N.native.open(DB_NAME,1);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
    const tx=db.transaction(['payloads'],'readwrite'),done=new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
    const store=tx.objectStore('payloads'),keys=store.getAllKeys();keys.onsuccess=()=>{const key=keys.result.find(k=>String(k).includes(run));if(!key)throw Error('Dependency payload key not found');
      if(kind==='missing-context')store.delete(key);else{const r=store.get(key);r.onsuccess=()=>{const b=new Uint8Array(r.result);b[b.length-1]^=1;store.put(b,key);};}};await done;db.close();});
}
export async function bootAtomicFixture(){
  if(!N)throw Error('Native instrumentation missing');if(window.Telegram?.WebApp?.initData)throw Error('Guest fixture only');
  budget=createPhaseBudget();const query=new URLSearchParams(location.search);
  base=createTestAdapter({scope:SCOPE,watchdogMs:1000,...(query.get('storage')==='unavailable'?{indexedDB:null}:{})});
  adapter={scope:SCOPE,appendSegment:(q,...rest)=>tracked('append',q,()=>{
      const refused=faulted(q);if(refused)return refused;
      if(heldTerminal?.needsTimer){
        heldTerminal.needsTimer=false;
        heldTerminal.timer=N.gateWatchdogDuring(()=>{heldTerminal.pending=base.appendSegment(q,...rest);},1000);
        // The real timer must expire AND the native transaction must finish
        // before its one watchdog callback is delivered. Game time is unchanged.
        Promise.all([heldTerminal.promise,heldTerminal.timer.due]).then(()=>heldTerminal.timer.release());
        return heldTerminal.pending;
      }return base.appendSegment(q,...rest);
    }),
    retry:()=>tracked('exact-retry',lastCanonicalRequest,()=>base.retry()),readSegments:q=>tracked('read',q,()=>base.readSegments(q)),recover:q=>tracked('recover',q,()=>base.recover(q)),
    get retainedBytes(){return base.retainedBytes;},get physicalBusy(){return base.physicalBusy;}};
  coordinator=createCoordinator(adapter,()=>IDENTITY);
  owner=createAtomicTerminalOwner({adapter,scope:SCOPE,session:SESSION,principal:PRINCIPAL,budget,crypto});
  window.H={get ready(){return window.atomicFixtureReady===true;},get settled(){return !pending;},get heldTerminal(){return heldTerminal?.proof??null;},
    facts(){return {view:copy(owner.view()),bootState,counters:copy(counters),events:copy(events),transport:copy(transport),nativeEvents:copy(N.log),writes:copy(writes),loadOrder:[...loadOrder],trustedInputs:copy(trustedInputs),
      ...physical(),budget:budget.snapshot(),cacheSuspended,blockedReads,derivedCacheBytes,playEnabled:play,model:window.MKTYField?.snapshot()??null,savedCheckpoint:copy(savedCheckpoint),earnedText,
      active:document.querySelector('.screen.active')?.id,fieldDialogOpen:!!$('fieldDialog')?.open,epilogueOpen:!!$('legacyDialog')?.open,
      epilogueText:$('legacyDialog')?.textContent??null,cache:copy(facadeCache),pendingQueueText:pendingQueue(),operationError,settled:!pending,
      lastSubmit:copy(lastSubmit),phaseStream:phaseStream?.view()??null,inputFence:fence?.diagnostics()??null,
      nativePoints:readNative('mkty_points'),knownStarted:sessionStorage.getItem(STARTED)==='yes'};},
    arm(kind){if(!['stop','abort','hold'].includes(kind))throw Error('Unknown fixture fault');fault=kind;},
    releaseHeld(){return N.releaseTerminals(heldTerminal?.proof?.tx??null);},retry,
    exposeStale(value){if(play)throw Error('Cannot expose active board');$('fieldMission').style.display=value?'block':'';},
    staleWrites(){const results=[];for(const run of [()=>localStorage.setItem('mkty_points','99999'),()=>localStorage.removeItem(STORY),()=>localStorage.clear(),()=>MKTYStorage.retry()])try{results.push({returned:run()??null});}catch(e){results.push({error:e.message});}return results;},
    changeNative(){nativeSet('mkty_points','99999');nativeSet(STORY,'corrupt old mirror');nativeSet('mkty_legacy_v1','{}');return true;},
    clearNative(){for(let i=nativeStorage.length-1;i>=0;i--){const key=nativeStorage.key(i);if(key!=='mkty_pending_v2_unrelated')nativeRemove(key);}return true;},
    resubmit(){return observe('resubmit',async()=>{if(!lastSubmit)throw Error('No earned command');dropBorrowedProjection('resubmit');return owner.submit(lastSubmit);});},
    conflictAdoption(){return observe('conflicting-adoption',async()=>{const changed=copy(owner.view().manifest);changed.baseline.points++;dropBorrowedProjection('conflicting-adoption');return owner.adopt(changed);});},
    repeatAppend(){if(!lastCanonicalRequest)throw Error('No request');return tracked('diagnostic-duplicate',lastCanonicalRequest,()=>base.appendSegment(lastCanonicalRequest));},
    async conflictingAppend(){if(!lastCanonicalRequest)throw Error('No request');const C=await import('/prototypes/evidence-indexeddb/contract.mjs');
      const q={...lastCanonicalRequest,payload:new Uint8Array(lastCanonicalRequest.payload)};q.payload[q.payload.length-1]^=1;const d=await C.descriptor(q.descriptor);q.seal={totalBytes:q.payload.length,root:await C.chain(d,q,q.payload)};return tracked('diagnostic-conflict',q,()=>base.appendSegment(q));},
    corrupt,async closeAdapter(){base.close();},
    async upgrade(){base.close();return N.fixture(()=>new Promise((resolve,reject)=>{const q=N.native.open(DB_NAME,2);q.onsuccess=()=>{q.result.close();resolve(true);};q.onerror=()=>reject(q.error);}));}
  };
  $('atomicStart').onclick=()=>{void start().catch(()=>{});};$('atomicRetry').onclick=()=>{void retry().catch(()=>{});};
  $('atomicContinue').onclick=continueResult;$('atomicReview').onclick=()=>show('atomicResult');
  const opened=await base.open();event('adapter-open',{status:opened.status,reason:opened.reason??null});
  if(opened.status!=='open'){$('atomicLoadingStatus').textContent='Recovery blocked: '+opened.reason;bootState='BLOCKED';window.atomicFixtureReady=true;return;}
  await owner.recover();bootState=owner.view().state;event('canonical-hydrated',{state:bootState});
  if(bootState==='BLOCKED'&&owner.view().reason==='atomic-manifest-missing'){
    budget.reserve('returned-page',16384);
    let catalog;try{catalog=await adapter.recover({scope:SCOPE,maxHeads:1,maxBytes:16384});}finally{budget.release('returned-page',16384);}
    freshScope=exact(catalog,['status','heads','watermark','nextCursor'])&&catalog.status==='page'&&catalog.watermark===0&&Array.isArray(catalog.heads)&&catalog.heads.length===0&&catalog.nextCursor===null&&sessionStorage.getItem(STARTED)!=='yes'&&!query.has('existing');
    if(freshScope){bootState='SETUP';show('atomicSetup');}
    else $('atomicLoadingStatus').textContent='Recovery blocked: this run has no adoption record.';
  }else if(bootState==='ADOPTED'||bootState==='READY'){
    await loadLegacy();if(bootState==='READY'||owner.view().phasePin)show('atomicResult');else openField();
  }else $('atomicLoadingStatus').textContent='Recovery blocked: '+(owner.view().reason||bootState);
  render();window.atomicFixtureReady=true;
}
