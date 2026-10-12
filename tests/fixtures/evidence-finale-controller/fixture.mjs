// Full-index, isolated CI fixture. Original controller/storage/reward functions run unchanged.
import * as A from '/prototypes/evidence-indexeddb/adapter.mjs';
import * as C from '/prototypes/evidence-indexeddb/coordinator.mjs';
import {createUnsavedResultGate,GATE_LIMIT} from '/prototypes/evidence-indexeddb/unsaved-result-gate.mjs';
import {makeFinaleCompletion,FINALE_LIMIT} from '/prototypes/evidence-indexeddb/finale-completion.mjs';
import {makeSyntheticCompletion} from '/prototypes/evidence-indexeddb/synthetic-completion.mjs';
const $=id=>document.getElementById(id),N=window.__nativeHarness,S=window.__finaleNative;
const codec=window.MKTYTraceCodec,copy=v=>structuredClone(v);
const state={generation:1,scope:'finale-fixture:guest',sourceIdentity:'spatial-finale:1',accountLabel:'guest'};
const events=[],calls=[],logical=[],outsideLogical=[],counters={captures:0,original:0,award:0,pace:0,storyComplete:0,rewards:0,campaignRestore:0,review:0};
let adapter,base,gate,input,config,phase,capture,heldComplete,pendingCapture=false,continuing=false,readCount=0,activeCalls=0,peakCalls=0;
const log=(type,details={})=>{const row={n:events.length,nativeEventCount:N.log.length,type,...details};events.push(row);return row;};
const sourceKey=n=>'mkty_field_finale_'+n+'_v1',storyKey=n=>'mkty_story_plan_'+n+'_v1';
const sha=async bytes=>[...new Uint8Array(await N.native.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
function invalidate(why){if(pendingCapture&&!continuing){state.generation++;log('context-invalidated',{why,generation:state.generation});}}
function readContext(){
 if(config?.throwContext)throw Error('CI context bridge unavailable');
 if(capture&&!continuing){
  const source=MKTYStorage.readItem(sourceKey(phase.chapter)),story=MKTYStorage.readItem(storyKey(phase.chapter));
  if(source!==capture.sourceText||story!==capture.storyText)invalidate('exact-source-comparison');
  if(MKTYStorage.identity()!==capture.storageIdentity||state.accountLabel!==capture.accountLabel)invalidate('identity-label');
 }
 return {scope:state.scope,generation:state.generation,sourceIdentity:state.sourceIdentity};
}
const screen=document.createElement('section');screen.id='evidenceFinaleResult';screen.className='screen';screen.innerHTML='<p>TEST-ONLY SPATIAL FINALE EVIDENCE</p><h1>Completed field result</h1><p id="finaleGateStatus" role="status" aria-live="polite"></p><p id="finaleWarning">The checkpoint is kept in this page until saved. Closing before Retry saving succeeds may lose later game progress.</p><button id="finaleRetry" type="button">Retry evidence save</button><button id="finaleContinue" type="button">Continue original operation</button><pre id="finaleSummary"></pre>';$('app').append(screen);
const css=document.createElement('link');css.rel='stylesheet';css.href='/tests/fixtures/evidence-finale-controller/fixture.css';document.head.append(css);
function render(){const view=gate?.view();$('finaleGateStatus').textContent=view?.state||'EMPTY';$('finaleSummary').textContent=JSON.stringify(view?.summary||{});$('finaleRetry').disabled=!view?.retryEnabled;$('finaleContinue').disabled=!view?.continueEnabled;return view;}
function begin(operation){H.settled=false;H.pending=Promise.resolve(operation()).then(value=>{H.lastOperationResult=value;H.settled=true;render();return value;});render();return H.pending;}
function spy(object,name,count){const original=object?.[name];if(typeof original!=='function')throw Error('Missing real capability '+name);object[name]=function(...args){counters[count]++;log(count,{args:args.filter(v=>typeof v!=='function')});return original.apply(this,args);};}
const originalShow=window.show;
window.show=function(id){if(pendingCapture&&!continuing&&id!=='evidenceFinaleResult')invalidate('navigation:'+id);log('show',{id});return originalShow.call(this,id);};
const originalAward=window.awardLifePoints;
window.awardLifePoints=function(...args){counters.award++;log('award',{chapter:args[0],amount:args[1]});return originalAward.apply(this,args);};
spy(MKTYPace,'onRecorded','pace');spy(MKTYStory,'complete','storyComplete');spy(MKTYRewards,'completeLife','rewards');spy(MKTYCampaign,'restore','campaignRestore');spy(MKTYContinuation,'review','review');
for(const [method,kind]of [['setItem','set'],['removeItem','remove']]){
 const original=MKTYStorage[method];MKTYStorage[method]=function(key,value){
  if(S.mode==='continuation'){if(logical.length>=40)throw Error('Logical finite write bound exceeded');logical.push({kind,key:String(key),value:kind==='set'?String(value):null});}
  else{outsideLogical.push({kind,key:String(key),value:kind==='set'?String(value):null,mode:S.mode});if(outsideLogical.length>2000)throw Error('Unexpected logical background mutation volume');}
  if(pendingCapture&&!continuing&&[sourceKey(phase.chapter),storyKey(phase.chapter)].includes(String(key)))invalidate('actual-storage:'+key);
  return original.call(this,key,value);
 };
}
const originalClear=MKTYStorage.clear;MKTYStorage.clear=function(){invalidate('actual-clear');return originalClear.call(this);};
const originalOpen=MKTYField.open;
MKTYField.open=function(task,saved){
 if(pendingCapture&&!continuing)invalidate('descriptor-reopen');
 if(!task.core||![8,9].includes(task.chapter))return originalOpen.call(this,task,saved);
 const originalComplete=task.complete;
 const wrapped={...task,complete(checkpoint){
  counters.captures++;log('raw-callback',{chapter:task.chapter,phase:task.id});
  // All raw data is captured synchronously, before gate/helper promises or awaits.
  let sourceText,storyText,readError;
  try{sourceText=MKTYStorage.readItem(sourceKey(task.chapter));storyText=MKTYStorage.readItem(storyKey(task.chapter));}catch(error){readError=error;}
  // The field private task is already null: leave before parsing/serialization can throw.
  show('evidenceFinaleResult');
  if(readError){H.captureError='source-read-failed';H.settled=true;return;}
  if(typeof sourceText!=='string'||typeof storyText!=='string'||sourceText.length*2>FINALE_LIMIT.bytes||storyText.length*2>FINALE_LIMIT.bytes){H.captureError='finale-limit';H.settled=true;return;}
  const baseSeed=(task.seed-task.id*7919)>>>0;
  const provenance={legacyAtCapture:MKTYLegacy.read(),precisionAtCapture:MKTYLegacy.precise(),authority:'synthetic local observations; not trusted server provenance'};
  const binding={version:1,chapter:task.chapter,edition:2,phase:task.id,mechanic:task.mechanic,fieldStage:4,baseSeed,seed:task.seed,sourceKey:sourceKey(task.chapter),storyKey:storyKey(task.chapter),route:'spatial-finale',provenance};
  if(pendingCapture){H.secondCapture=gate.accept(input);return;}
  capture={sourceText,storyText,binding,storageIdentity:MKTYStorage.identity(),accountLabel:state.accountLabel,before:MKTYStorage.snapshot()};
  H.callerCheckpoint=checkpoint;heldComplete=rawCheckpoint=>originalComplete(rawCheckpoint);pendingCapture=true;
  try{input={...makeFinaleCompletion({scope:state.scope,run:'real-finale-'+task.chapter+'-'+task.id,checkpoint,sourceText,storyText,binding}),context:readContext()};}
  catch(error){H.captureError=String(error.message);H.settled=true;log('capture-refused',{reason:H.captureError});return;}
  // Bounded post-admission observation only; never used to authorize continuation.
  capture.rawCheckpointText=codec.stringify(checkpoint,FINALE_LIMIT.jsonBytes,'finale-limit');
  log('capture-prepared',{bytes:input.bytes.length,components:input.descriptor.components});
  H.beforeGate=copy(counters);begin(()=>gate.accept(input));
 }};
 H.lastDescriptor={chapter:task.chapter,phase:task.id,mechanic:task.mechanic,seed:task.seed};
 return originalOpen.call(this,wrapped,saved);
};
async function tracked(kind,operation,extra={}){
 activeCalls++;peakCalls=Math.max(peakCalls,activeCalls);const start=N.log.length,row={kind,...extra};calls.push(row);
 try{const result=await operation();row.result={status:result.status,reason:result.reason,receipt:result.receipt};return result;}
 finally{activeCalls--;row.native=N.log.slice(start).filter(e=>['transaction','complete','abort'].includes(e.type));}
}
function completeOriginal(rawCheckpoint){
 H.originalArgumentText=codec.stringify(rawCheckpoint,FINALE_LIMIT.jsonBytes,'finale-limit');
 if(counters.original!==0)throw Error('Original callback replay');
 log('original-start');counters.original++;continuing=true;S.mode='continuation';
 try{if(config.throwOriginal)throw Error('CI caught callback throw; original remainder intentionally excluded');heldComplete(rawCheckpoint);}
 finally{S.mode=null;continuing=false;H.afterCallback={logical:MKTYStorage.snapshot(),native:S.snapshot(),persistent:MKTYStorage.persistent};log('original-return');}
}
// Only actual epilogue-button dispatch is included in the same finite sequence.
// Timer-driven writes are visible in outsideLogical and S.outside (native only).
// persistent=false overlay writes remain visible in outsideLogical; never silently counted.
document.addEventListener('click',event=>{if(event.target.closest('[data-legacy-choice="done"]')&&counters.original===1){continuing=true;S.mode='continuation';log('epilogue-click');}},true);
document.addEventListener('click',event=>{if(event.target.closest('[data-legacy-choice="done"]')&&counters.original===1){S.mode=null;continuing=false;log('epilogue-return');}});
window.H={N,S,events,calls,counters,logical,GATE_LIMIT,FINALE_LIMIT,
 get gate(){return gate;},get adapter(){return adapter;},get input(){return input;},get captured(){return capture;},
 async setup(options){
  if(gate)throw Error('Use a fresh BrowserContext for each phase');config={...options};phase=copy(config.phase);
  if(window.Telegram?.WebApp?.initData||MKTYStorage.identity()!=='guest'||window.localStorage!==MKTYStorage||S.object===MKTYStorage)throw Error('Disposable guest/native facade capability mismatch');
  for(const [key,value]of Object.entries(config.seed))MKTYStorage.setItem(key,value);
  // The unchanged expedition pagehide handler saves even an unopened idle profile.
  // Establish its exact existing state before capture; never exempt it from equality.
  if(MKTYStorage.getItem('mkty_expeditions_v1')!==JSON.stringify(MKTYExpedition.snapshot()))throw Error('Idle expedition baseline differs from actual controller state');
  if(MKTYStorage.persistent!==true)throw Error('Initial disposable storage unavailable');
  adapter=A.createTestAdapter({scope:state.scope,watchdogMs:config.unknown?100:10000});let opened;
  if(config.unknown){
   // Setup-only watchdog delivery barrier, copied from the reviewed adapter UI
   // fixture. The genuine 100ms append deadline below remains unchanged.
   const originalSet=window.setTimeout,originalClear=window.clearTimeout,mark=N.log.length,setup={timer:null,cancelled:0};H.heldSetup=setup;
   window.clearTimeout=function(id){if(id===setup.timer?.timerId)setup.cancelled++;return originalClear.apply(this,arguments);};
   try{setup.timer=N.gateWatchdogDuring(()=>{setup.pending=adapter.open();},100);opened=await setup.pending;}
   finally{window.clearTimeout=originalClear;}
   H.setupProof={opened,diagnostics:copy(adapter.diagnostics),physical:N.physical,retainedBytes:adapter.retainedBytes,cancelled:setup.cancelled,captured:setup.timer.captured,timerId:setup.timer.timerId,setTimeoutRestored:window.setTimeout===originalSet,clearTimeoutRestored:window.clearTimeout===originalClear,nativeEvents:copy(N.log.slice(mark))};
  }else opened=await adapter.open();
  if(opened.status!=='open')throw Error('Native adapter open '+opened.reason);
  base=C.createCoordinator(adapter,readContext);
  const coordinator={
   async appendSegment(q,context){
    const signature={ordinal:q.ordinal,offset:q.offset,expectedHead:q.expectedHead,previousRoot:q.previousRoot,length:q.payload.length,payloadSha256:await sha(q.payload)};
    if(config.abortOrdinal===q.ordinal){N.control.abortAt='first-add';config.abortOrdinal=null;}
    let operation;
    if(config.unknown&&q.ordinal===0){const terminal=config.unknown;config.unknown=null;const barrier=N.holdNextTerminal(terminal);if(terminal==='abort')N.control.abortAt='first-add';const timer=N.gateWatchdogDuring(()=>{operation=base.appendSegment(q,context);},100);H.controlled={barrier,timer,operationId:adapter.diagnostics.id};}
    else operation=base.appendSegment(q,context);
    const result=await tracked('append',()=>operation,signature);log('append-settled',{status:result.status,ordinal:q.ordinal});if(config.switchAfterAppend){config.switchAfterAppend=false;invalidate('append-settlement');}return result;
   },
   retry:()=>tracked('exact-retry',()=>base.retry()),
   async readSegments(q){
    const count=++readCount;if(config.nativeReadAbort){config.nativeReadAbort=false;const get=IDBObjectStore.prototype.get;IDBObjectStore.prototype.get=function(...args){const request=get.apply(this,args);if(this.transaction.mode==='readonly'){IDBObjectStore.prototype.get=get;const tx=this.transaction;N.native.addEventListener.call(request,'success',()=>{log('native-read-abort');tx.abort();},{once:true});}return request;};}if(config.readFailure){config.readFailure=false;calls.push({kind:'read-refusal',count});return {status:'refused',reason:'operation-timeout'};}
    const result=await tracked('read',()=>base.readSegments(q),{count});
    if(config.changedRead&&result.status==='page'&&result.segments?.length){config.changedRead=false;const segment=result.segments[0];segment.payload[segment.payload.length-1]^=1;}
    if(config.switchAfterRead){config.switchAfterRead=false;invalidate('read-settlement');}
    if(config.throwAfterRead){config.throwAfterRead=false;config.throwContext=true;}
    log('read-settled',{status:result.status});return result;
   },
   recover:q=>base.recover(q),get retainedBytes(){return base.retainedBytes;},get inFlight(){return base.inFlight;}
  };
  gate=createUnsavedResultGate({coordinator,readContext,onContinue:completeOriginal});H.coordinator=coordinator;
  if(config.syntheticFirst){const synthetic=makeSyntheticCompletion({scope:state.scope,run:'first-synthetic',summary:{version:1,resultId:'first',completedSteps:1,label:'Synthetic first realm owner'},totalBytes:1024});const prior=createUnsavedResultGate({coordinator,readContext,onContinue(){throw Error('Synthetic must not continue');}});H.priorSynthetic=await prior.accept({...synthetic,context:readContext()});}
  render();return {opened,guest:MKTYStorage.identity(),snapshot:MKTYStorage.snapshot()};
 },
 open(){MKTYSpatialFinale.open(phase.chapter);return {descriptor:H.lastDescriptor,state:MKTYField.snapshot()};},
 retry(){return begin(()=>gate.retry());},
 continue(){log('explicit-continue');const result=gate.continue();render();return result;},
 view:()=>gate.view(),
 facts(){return {view:gate.view(),counters:copy(counters),calls:copy(calls),events:copy(events),nativeEvents:copy(N.log),logical:copy(logical),native:copy(S.rows),outsideNative:copy(S.outside),outsideLogical:copy(outsideLogical),cutOutsideLogical:copy(outsideLogical.slice(H.cutOutsideStart??outsideLogical.length)),setupProof:H.setupProof||null,priorSynthetic:H.priorSynthetic||null,lastOperationResult:H.lastOperationResult||null,persistent:MKTYStorage.persistent,logicalSnapshot:MKTYStorage.snapshot(),nativeSnapshot:S.snapshot(),capture:copy(capture),readCount,peakCalls,active:document.querySelector('.screen.active')?.id,chapterStage:$('mission'+phase.chapter).dataset.stage,epilogue:$('legacyDialog').open,storageWarning:!!$('storageRecovery'),captureError:H.captureError||null,originalArgumentText:H.originalArgumentText||null};},
 async inspect(){const result=await base.recover({scope:state.scope});if(result.status!=='page')throw Error('Inspection failed '+result.reason);const items=[];for(const item of result.heads){const restored=await C.assemble(base,item,FINALE_LIMIT.bytes);items.push({descriptor:item.descriptor,head:item.head,sha256:await sha(restored.bytes),equalsInput:input?restored.bytes.length===input.bytes.length&&restored.bytes.every((v,i)=>v===input.bytes[i]):null});}return {items,gate:gate.view(),original:counters.original};},
 secondCapture(kind='finale'){const artifact=kind==='synthetic'?makeSyntheticCompletion({scope:state.scope,run:'refused-second',summary:{version:1,resultId:'second',completedSteps:1,label:'Second capture must refuse'},totalBytes:1024}):input;const other=createUnsavedResultGate({coordinator:H.coordinator,readContext,onContinue(){throw Error('Second gate callback forbidden');}});return other.accept({...artifact,context:readContext()});},
 mutateCaller(){H.callerCheckpoint.trace.length=0;H.callerCheckpoint.seconds=777;input.bytes.fill(0);},
 armNative(ordinal){H.cutOutsideStart=outsideLogical.length;S.arm(ordinal);},
 retrySaving(failAt=null){const mode='retry-'+(++S.serial);S.mode=mode;if(failAt!==null)S.arm(failAt,mode);try{$('storageRecovery').querySelector('button').click();}finally{S.mode=null;}return {mode,persistent:MKTYStorage.persistent,logical:MKTYStorage.snapshot(),native:S.snapshot()};},
 change(kind){
  if(kind==='source'||kind==='source-aba'){const key=sourceKey(phase.chapter),value=MKTYStorage.getItem(key);MKTYStorage.setItem(key,value+' ');if(kind==='source-aba')MKTYStorage.setItem(key,value);}
  else if(kind==='story'){const key=storyKey(phase.chapter);MKTYStorage.setItem(key,MKTYStorage.getItem(key)+' ');}
  else if(kind==='account-aba'){state.accountLabel='test-account-B';invalidate('account-label');state.accountLabel='guest';invalidate('account-label');}
  else if(kind==='clear-restore'){const before=MKTYStorage.snapshot();MKTYStorage.clear();for(const [key,value]of Object.entries(before))MKTYStorage.setItem(key,value);}
  else if(kind==='navigation')show('chapters');
  else if(kind==='reopen')MKTYSpatialFinale.open(phase.chapter);
  else if(kind==='reader-failure')S.readFault=sourceKey(phase.chapter);
  else throw Error('Unknown explicit fixture context bridge');return render();
 },
 stageStartupRestore(){invalidate('bounded-startup-cloud-selection');const snapshot={};for(const key of [sourceKey(phase.chapter),storyKey(phase.chapter),'mkty_legacy_v1'])snapshot[key]=MKTYStorage.getItem(key);MKTYStorage.setItem('mkty_cloud_restore_pending',JSON.stringify({revision:41,snapshot}));return {selection:'test-only staging of validated startup restore; real cloud-save apply runs on reload',view:gate.view()};},
 async setupInspection(){
  config={};phase={chapter:8};adapter=A.createTestAdapter({scope:state.scope});const opened=await adapter.open();if(opened.status!=='open')throw Error('Inspection open');base=C.createCoordinator(adapter,()=>({...state}));gate=createUnsavedResultGate({coordinator:base,readContext:()=>({...state}),onContinue(){throw Error('Reload must never continue');}});return H.inspect();
 }
};
$('finaleRetry').onclick=()=>H.retry();$('finaleContinue').onclick=()=>H.continue();
window.finaleFixtureReady=true;
