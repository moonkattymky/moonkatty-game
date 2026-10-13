// CI-only full unchanged index. Synthetic prerequisites/won checkpoint are explicit.
// The original prepared-operations entry and final task closure are both exercised.
import * as Contract from '/prototypes/evidence-indexeddb/contract.mjs';
import {createTestAdapter} from '/prototypes/evidence-indexeddb/adapter.mjs';
import {createCoordinator} from '/prototypes/evidence-indexeddb/coordinator.mjs';
import {createPhaseBudget} from '/prototypes/evidence-indexeddb/phase-budget.mjs';
import {admitContext,measureFinaleData} from '/prototypes/evidence-indexeddb/finale-context-v1.mjs';
import {freezeFinalePhase,makeFinalePhase,readFinalePhase} from '/prototypes/evidence-indexeddb/finale-phase-v2.mjs';
import {createContextStream,createPhaseStream} from '/prototypes/evidence-indexeddb/context-stream.mjs';
import {createPhaseWriterContract} from '/prototypes/evidence-indexeddb/phase-writer-contract.mjs';
import {preparedOperationsText,PREPARED_OPERATIONS_CACHE_BYTES,PREPARED_OPERATIONS_SCRATCH_BYTES} from '/prototypes/evidence-indexeddb/prepared-operations.mjs';
import {createInvocationFence} from '/prototypes/evidence-indexeddb/invocation-fence.mjs';
import {audit,initialContext,identityFor,compact,SCOPE,SESSION,sourceKey,storyKey} from './shared.mjs';
const N=window.__nativeHarness,S=window.__fenceNative,copy=value=>structuredClone(value),$=id=>document.getElementById(id);
if(!N||!S||window.H)throw Error('One fresh full-index fixture required');
const events=[],transport=[],logical=[],counters={captures:0,original:0,award:0,open:0,entry:0,epilogue:0,pace:0,operations:0,story:0,rewards:0};
const context=initialContext();
const guardKeys=['mkty_cloud_restore_transaction','mkty_cloud_restore_pending','mkty_cloud_restore_retry_guard','mkty_cloud_dirty','mkty_cloud_restore_outgoing','mkty_cloud_recovery','mkty_pending_v2_telegram','mkty_test_no_pacing','mkty_pace_server'];
const guardPins=Object.fromEntries(guardKeys.map(key=>[key,null]));
const background=new Set(['mkty_global_lives','mkty_life_restore_at','mkty_expeditions_v1','mkty_daily_demo','mkty_campaign_checkpoint_8','mkty_campaign_checkpoint_9']);
let adapter,base,coordinator,budget,fence,writer,contextCapsule,raw,phase,heldOriginal,captured=false,invoking=false,invoked=false,invalid=false;
let capture,expected,protectedBefore,smallBefore,protocolFault=null,readLease=false,activeTransport=0,peakTransport=0;
const log=(type,detail={})=>{
  if(events.length>=512)throw Error('Fixture event bound');
  const row={n:events.length,type,nativeEventIndex:N.log.length,...detail};events.push(row);return row;
};
const physical=()=>({physicalBusy:adapter?.physicalBusy??false,retainedBytes:adapter?.retainedBytes??0,nativePhysical:N.physical});
const backgroundWrite=(op,key,value)=>
  key==='mkty_global_lives'&&op==='set'&&value==='9'||key==='mkty_life_restore_at'&&op==='remove'||
  ['mkty_expeditions_v1','mkty_daily_demo'].includes(key)&&op==='set'&&value===smallBefore?.[key]||
  ['mkty_campaign_checkpoint_8','mkty_campaign_checkpoint_9'].includes(key)&&op==='remove'&&smallBefore?.[key]===null;
function current() {
  if(invalid||context.generation!==1||MKTYStorage.identity()!=='guest'||window.Telegram?.WebApp?.initData)return false;
  if(!captured||invoking||invoked)return true;
  if(!MKTYStorage.persistent)return false;
  // This is the cooperating fixture's live prerequisite check. The journal
  // helper itself has no native operations reader and does not supply this fact.
  const operationsKey=`mkty_operations_${phase.chapter}_v1`,operationsCore=preparedOperationsText(phase.chapter);
  if(MKTYStorage.readItem(operationsKey)!==operationsCore||S.read(operationsKey)!==operationsCore)return false;
  return Object.entries(protectedBefore).every(([key,value])=>MKTYStorage.readItem(key)===value&&S.read(key)===value);
}
function authority(type) {
  const row=log(type,physical());if(row.physicalBusy||row.retainedBytes||row.nativePhysical)throw Error('Original authority while native operation pending');
}
for(const [method,op]of [['setItem','set'],['removeItem','remove'],['clear','clear'],['retry','retry']]) {
  const original=MKTYStorage[method];MKTYStorage[method]=function(key,value) {
    const operation={op,...(key===undefined?{}:{key:String(key)}),...(op==='set'?{value:String(value)}:{})};
    const row={kind:'logical-write',n:logical.length,mode:S.mode,...operation};
    if(logical.length>=4096)throw Error('Logical observation bound');logical.push(row);S.emit(row);
    if(captured&&!invoking&&Object.hasOwn(protectedBefore,operation.key)&&!backgroundWrite(op,operation.key,operation.value))invalid=true;
    const forward=()=>original.apply(this,arguments);
    return invoking&&!backgroundWrite(op,operation.key,operation.value)?writer.handleWrite(operation,forward):forward();
  };
}
function spy(object,key,count){const fn=object[key];object[key]=function(...args){counters[count]++;log(count);return fn.apply(this,args);};}
const award=window.awardLifePoints;window.awardLifePoints=function(...args){counters.award++;authority('award');return award.apply(this,args);};
for(const [object,key,count]of [[MKTYPace,'onRecorded','pace'],[MKTYOps,'complete','operations'],[MKTYStory,'complete','story'],[MKTYRewards,'completeLife','rewards'],[MKTYLegacy,'epilogue','epilogue']])spy(object,key,count);
const result=document.createElement('section');result.id='invocationFenceResult';result.className='screen';
result.innerHTML='<h1>Test-only invocation fence</h1><p>The final checkpoint is synthetic. Inspection never resumes gameplay.</p>';$('app').append(result);
const originalOpen=MKTYField.open;
MKTYField.open=function(task,saved) {
  if(!phase||task.chapter!==phase.chapter||task.id!==phase.index||!task.core||counters.open)throw Error('Unexpected original final task');
  counters.open++;heldOriginal=task.complete;
  return originalOpen.call(this,{...task,complete(cp) {
    if(captured)throw Error('Second raw final callback');
    const sourceText=MKTYStorage.readItem(sourceKey(task.chapter)),storyText=MKTYStorage.readItem(storyKey(task.chapter));
    // The real field controller has relinquished its task before calling this closure.
    show('invocationFenceResult');
    const binding={version:1,chapter:task.chapter,edition:2,phase:task.id,mechanic:task.mechanic,fieldStage:4,
      baseSeed:(task.seed-task.id*7919)>>>0,seed:task.seed,sourceKey:sourceKey(task.chapter),storyKey:storyKey(task.chapter),
      route:'spatial-finale',provenance:{legacyAtCapture:MKTYLegacy.read(),precisionAtCapture:MKTYLegacy.precise(),authority:'synthetic local observations; not trusted server provenance'}};
    capture={sourceText,storyText,binding,checkpointText:MKTYTraceCodec.stringify(cp,8192),beforeNative:S.snapshot(),beforeLogical:MKTYStorage.snapshot()};
    smallBefore=Object.fromEntries(H.smallKeys.map(key=>[key,MKTYStorage.readItem(key)]));
    protectedBefore={...smallBefore,...guardPins,[sourceKey(task.chapter)]:sourceText,[storyKey(task.chapter)]:storyText};
    for(const key of background)delete protectedBefore[key];
    counters.captures++;captured=true;log('raw-callback');
    budget.reserve('raw-capsule',65536);
    raw=freezeFinalePhase({scope:SCOPE,session:SESSION,checkpoint:cp,sourceText,binding},budget);
    return H.run(()=>archiveCapture());
  }},saved);
};
function streamCurrent(){return {...context,sourceText:MKTYStorage.readItem(sourceKey(phase.chapter)),storyText:MKTYStorage.readItem(storyKey(phase.chapter))};}
async function tracked(kind,q,operation) {
  if(transport.length>=128)throw Error('Transport diagnostic bound');activeTransport++;peakTransport=Math.max(peakTransport,activeTransport);
  const row={kind,run:q?.descriptor?.run||q?.captureIdentity?.run||null,ordinal:q?.ordinal??null,throughHead:q?.throughHead??null,
    length:q?.payload?.length??null,start:N.log.length};transport.push(row);
  try{const r=await operation();row.result=copy({status:r.status,reason:r.reason??null,receipt:r.receipt??null,currentHead:r.currentHead??null,contextCurrent:r.contextCurrent??null});return r;}
  finally{row.end=N.log.length;row.native=copy(N.log.slice(row.start).filter(e=>['transaction','complete','abort','abort-requested-after-success'].includes(e.type)));activeTransport--;}
}
function takeFault(q,kind) {
  if(!protocolFault||!q?.[kind]?.run?.endsWith(':'+protocolFault.event))return null;
  if((kind==='descriptor')!==['abort','hold-complete','hold-abort'].includes(protocolFault.mode))return null;
  const value=protocolFault;protocolFault=null;return value;
}
async function append(q,ctx) {
  const fault=takeFault(q,'descriptor');
  if(fault?.mode==='abort')N.control.abortAt='first-add';
  let operation;
  if(fault?.mode==='hold-complete'||fault?.mode==='hold-abort') {
    const terminal=fault.mode==='hold-complete'?'complete':'abort';
    const barrier=N.holdNextTerminal(terminal);if(terminal==='abort')N.control.abortAt='first-add';
    const timer=N.gateWatchdogDuring(()=>{operation=base.appendSegment(q,ctx);},1000);H.controlled={barrier,timer};
  }
  return tracked('append',q,()=>operation||base.appendSegment(q,ctx));
}
async function read(q) {
  const fault=takeFault(q,'captureIdentity');
  if(fault?.mode==='read-abort') {
    const get=IDBObjectStore.prototype.get;IDBObjectStore.prototype.get=function(...args) {
      const request=get.apply(this,args);if(this.transaction.mode==='readonly') {
        IDBObjectStore.prototype.get=get;const tx=this.transaction;N.native.addEventListener.call(request,'success',()=>tx.abort(),{once:true});
      }return request;
    };
  }
  const result=await tracked('read',q,()=>base.readSegments(q));
  if(fault?.mode==='change-after-read'){context.generation++;invalid=true;log('identity-changed-after-read');}
  return result;
}
async function archiveCapture() {
  const n=phase.chapter,binding={version:1,session:SESSION,chapter:n,edition:2,baseSeed:capture.binding.baseSeed,
    storyKey:storyKey(n),sourceKey:sourceKey(n),route:'spatial-finale'};
  budget.reserve('context-retained',capture.storyText.length*2);
  contextCapsule=admitContext({scope:SCOPE,session:SESSION,storyText:capture.storyText,binding},budget);
  budget.release('raw-capsule',65536);budget.reserve('phase-workspace',327680);
  const options={context:contextCapsule,coordinator,readContext:streamCurrent,expectedContext:{...context,sourceText:capture.sourceText},budget,crypto};
  let contextStream=createContextStream(options);const contextSaved=await contextStream.save();if(!contextSaved.ready)throw Error('Context archive '+contextSaved.reason);
  const reference=contextStream.reference();contextStream=null;
  let artifact=makeFinalePhase(raw,contextCapsule,reference,budget),phaseStream=createPhaseStream({...options,artifact,reference});
  const privateBytes=artifact.bytes.length;artifact=null;
  const phaseSaved=await phaseStream.save();if(!phaseSaved.ready)throw Error('Phase archive '+phaseSaved.reason);
  phaseStream=null;budget.release('private-phase',privateBytes);budget.release('phase-workspace',327680);budget.reserve('raw-capsule',65536);
  // These read-only diagnostic head objects are accepted only after both streamers verified exact bytes.
  const archives=await audit(base),contextItem=archives.find(item=>item.descriptor.run===`fc1:${SESSION}:${n}`),phaseItem=archives.find(item=>item.descriptor.run===`fp2:${SESSION}:${n}:${phase.index}`);
  expected={chapter:n,phase:phase.index,identity:await identityFor(context,n,phase.index),contextPin:compact(contextItem.head),phasePin:compact(phaseItem.head)};
  H.archiveBaseline=archives;H.sessionMetadata=measureFinaleData([context,expected,smallBefore,{...smallBefore,...guardPins},capture.binding,guardKeys],32768)+PREPARED_OPERATIONS_CACHE_BYTES+PREPARED_OPERATIONS_SCRATCH_BYTES+1408;
  fence=createInvocationFence(fenceOptions());log('archive-ready');return fence.view();
}
function fenceOptions(){return {coordinator,budget,scope:SCOPE,session:SESSION,...expected,expectedContext:initialContext(),
  isCurrent:current,sessionMetadataBytes:()=>H.sessionMetadata+(writer?.view().metadataBytes||0),crypto};}
function leaseAcquire(){if(readLease)throw Error('Original read lease overlap');budget.reserve('original-read-workspace',196608);budget.allocate('original-read-workspace',196608);readLease=true;}
function leaseRelease(){if(readLease){readLease=false;budget.release('original-read-workspace',196608);}}
function completeOriginal() {
  if(counters.original)throw Error('Original callback replay');authority('original-start');
  const slots=['callback-scratch','callback-outer-story','callback-inner-story'];let held=0;
  writer=createPhaseWriterContract({stage:'dispatch',chapter:phase.chapter,phase:phase.index,baseSeed:capture.binding.baseSeed,
    sourceText:capture.sourceText,checkpoint:readFinalePhase(raw).checkpoint,legacyText:smallBefore.mkty_legacy_v1,
    precisionCount:capture.binding.provenance.precisionAtCapture.count,context:contextCapsule,budget,now:Date.now,isCurrent:current,preState:smallBefore,
    projectAfterRead(callback){leaseRelease();try{return callback();}finally{leaseAcquire();}}});
  invoking=true;invoked=true;S.mode='original';counters.original++;
  try {
    for(const name of slots){budget.reserve(name,65536);budget.allocate(name,65536);held++;}leaseAcquire();writer.begin();
    const callback=heldOriginal;heldOriginal=null;
    H.originalArgumentText=MKTYTraceCodec.stringify(readFinalePhase(raw).checkpoint,8192);
    callback(readFinalePhase(raw).checkpoint);H.writerFinished=writer.finish();
    if(counters.epilogue!==(phase.chapter===9?1:0)||counters.open!==1)throw Error('Original handoff cardinality');
    log('original-return',{writer:H.writerFinished,...physical()});
  }finally {
    invoking=false;S.mode='after-original';leaseRelease();while(held){const name=slots[--held];budget.release(name,65536);}
  }
}
window.addEventListener('pagehide',()=>S.emit({kind:'pagehide-end',native:S.snapshot(),logical:MKTYStorage.snapshot(),counters:copy(counters)}));
window.H={settled:true,error:null,controlled:null,smallKeys:[
  'mkty_points','mkty_global_lives','mkty_life_restore_at','mkty_current_chapter','mkty_legacy_v1','mkty_life9_coordinates',
  'mkty_final_moon_points','mkty_points_locked_at','mkty_lang','mkty_control_sound','mkty_light_fx','mkty_expeditions_v1','mkty_daily_demo','mkty_pace_skip_9',
  ...[8,9].flatMap(n=>[`mkty_life${n}`,`mkty_life${n}_awarded`,`mkty_life${n}_completed_at`,`mkty_spatial_report_${n}`,`mkty_pace_ack_${n}`,`mkty_operations_${n}_v1`,`mkty_campaign_checkpoint_${n}`])],
  run(operation){H.settled=false;H.error=null;H.pending=Promise.resolve().then(operation).then(value=>{H.last=value;return value;},error=>{H.error=String(error.stack||error);throw error;}).finally(()=>{H.settled=true;});return H.pending;},
  async setup(options) {
    if(adapter)throw Error('One source setup');phase=options.phase;
    if(window.Telegram?.WebApp?.initData||MKTYStorage.identity()!=='guest'||window.localStorage!==MKTYStorage||S.object===MKTYStorage)throw Error('Synthetic guest required');
    for(const key of guardKeys)if(MKTYStorage.readItem(key)!==null||S.read(key)!==null)throw Error('Excluded recovery guard '+key);
    if(Object.keys(S.snapshot()).some(key=>key.startsWith('mkty_account_v3_')))throw Error('Foreign account namespace in disposable context');
    S.mode='setup';for(const [key,value]of Object.entries(options.seed))MKTYStorage.setItem(key,value);
    for(const key of H.smallKeys)if(!Object.hasOwn(options.seed,key)&&MKTYStorage.readItem(key)!==null)MKTYStorage.removeItem(key);
    if(MKTYStorage.readItem(`mkty_operations_${phase.chapter}_v1`)!==preparedOperationsText(phase.chapter)||!MKTYOps.isRun(phase.chapter))throw Error('Prepared original operations prerequisite');
    adapter=createTestAdapter({scope:SCOPE,watchdogMs:1000});const opened=await adapter.open();if(opened.status!=='open')throw Error('Native adapter '+opened.reason);
    base=createCoordinator(adapter,()=>context);coordinator={appendSegment:append,retry:()=>tracked('exact-retry',null,()=>base.retry()),readSegments:read,
      recover:q=>tracked('recover',null,()=>base.recover(q)),get physicalBusy(){return base.physicalBusy;},get retainedBytes(){return base.retainedBytes;},get inFlight(){return base.inFlight;}};
    budget=createPhaseBudget();S.mode='before-entry';H.setupProof={syntheticPrerequisites:true,checkpointEarnedHere:false,actualEntry:'MKTYOps.open',preparedOperations:options.seed[`mkty_operations_${phase.chapter}_v1`],
      excludedGuards:copy(guardPins),priorPoints:options.seed.mkty_points,priorChapter:options.seed['mkty_life'+(phase.chapter-1)],guest:MKTYStorage.identity()};return H.setupProof;
  },
  open(){counters.entry++;log('prepared-operations-entry');MKTYOps.open(phase.chapter);return {model:MKTYField.snapshot(),counters:copy(counters)};},
  prepare:()=>H.run(()=>fence.prepare()),issue:()=>H.run(()=>fence.issue()),recordReturned:()=>H.run(()=>fence.recordReturned()),retry:()=>H.run(()=>fence.retry()),
  invoke(){return fence.invoke(completeOriginal);},
  duplicatePrepare(){const other=createInvocationFence(fenceOptions());return H.run(async()=>{const prepared=await other.prepare();const issued=await other.issue();other.invoke(()=>{throw Error('Duplicate callback was armed');});return {prepared,issued,view:other.view()};});},
  seedLaterOnlyReturned(){return H.run(async()=>{
    if(fence.view().state!=='NEW'||invoked)throw Error('Incomplete receipt fixture requires untouched fence');
    const record={version:1,session:SESSION,stage:`${phase.chapter}:${phase.index}`,event:'RETURNED',writer:'final-prepared-operations-v1',
      identity:expected.identity,phase:{...expected.phasePin},context:{...expected.contextPin},previous:'f'.repeat(64)};
    const framed=Contract.frame([{name:'observation',encoding:'utf8',text:JSON.stringify(record)}]);
    if(framed.bytes.length>692)throw Error('Incomplete receipt fixture frame limit');
    const descriptor={format:Contract.FORMAT,scope:SCOPE,run:`fr1:${SESSION}:${phase.chapter}:${phase.index}:RETURNED`,kind:'finale-recovery-observation',
      model:'finale-recovery-observation-v1',components:framed.components,note:''};
    const q={descriptor,expectedHead:null,ordinal:0,offset:0,previousRoot:Contract.ZERO,payload:framed.bytes};
    const root=await Contract.chain(await Contract.descriptor(descriptor),q,q.payload);q.seal={totalBytes:q.payload.length,root};
    const saved=await coordinator.appendSegment(q,initialContext());if(saved.status!=='committed'||saved.contextCurrent!==true)throw Error('Incomplete receipt fixture native append failed');
    // Explicit historical fixture seeding, not a normal protocol receipt or a
    // successful original invocation. No actual record is removed or rewritten.
    fence=createInvocationFence(fenceOptions());log('seeded-later-only-returned',{frameBytes:q.payload.length});
    return {run:descriptor.run,frameBytes:q.payload.length,acknowledgement:saved.receipt.acknowledgement,qualification:'Structurally valid standalone RETURNED with absent PREPARED and ISSUED dependencies'};
  });},
  armProtocol(event,mode){if(protocolFault)throw Error('One protocol fault');protocolFault={event,mode};},
  armNative:cut=>S.arm(cut),
  changeOperations(){if(invoking||invoked)throw Error('Prerequisite mutation requires uninvoked fixture');S.mode='old-writer';MKTYStorage.setItem(`mkty_operations_${phase.chapter}_v1`,preparedOperationsText(phase.chapter,'complete'));S.mode='after-old-writer';log('old-writer-prerequisite-change');},
  retrySaving(cut=null){S.mode='retry-saving';if(cut!==null)S.arm(cut,'retry-saving');const persistent=MKTYStorage.retry();S.mode='after-retry';return {persistent,native:S.snapshot(),logical:MKTYStorage.snapshot()};},
  audit:()=>audit(base),
  expected:()=>copy(expected||{chapter:phase.chapter,phase:phase.index,identity:null,contextPin:null,phasePin:null}),
  async emptyExpected(){return {chapter:phase.chapter,phase:phase.index,identity:await identityFor(initialContext(),phase.chapter,phase.index),contextPin:{binding:'0'.repeat(64),root:'0'.repeat(64),ordinal:0,total:21},phasePin:{binding:'0'.repeat(64),root:'0'.repeat(64),ordinal:0,total:21}};},
  facts:()=>({view:fence?.view()??null,expected:copy(expected),counters:copy(counters),events:copy(events),transport:copy(transport),nativeEvents:copy(N.log),
    native:S.snapshot(),logicalSnapshot:MKTYStorage.snapshot(),nativeWrites:copy(S.rows),logicalWrites:copy(logical),capture:copy(capture),
    writer:H.writerFinished??null,originalArgumentText:H.originalArgumentText??null,setupProof:H.setupProof,budget:budget?.snapshot(),
    sessionMetadataBytes:H.sessionMetadata??null,...physical(),activeTransport,peakTransport,persistent:MKTYStorage.persistent,epilogueOpen:$('legacyDialog').open,
    operationsGuard:phase?{requiredBeforeInvocation:preparedOperationsText(phase.chapter),logical:MKTYStorage.readItem(`mkty_operations_${phase.chapter}_v1`),native:S.read(`mkty_operations_${phase.chapter}_v1`),invoking,invoked}:null,
    error:H.error,settled:H.settled,observationErrors:copy(S.errors),invalid,qualification:'Native write failures are swallowed into the original RAM overlay; original callback returns. Fresh source-only document discards all game closures/overlay; this is not an abrupt mid-JavaScript crash.'})
};
window.invocationFixtureReady=true;
