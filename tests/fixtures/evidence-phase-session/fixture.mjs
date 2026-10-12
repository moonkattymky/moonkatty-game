// Full-index CI fixture. No production import, controller/model edits, clock
// changes, reload, or post-setup seeding. All gameplay uses the original DOM.
import {createTestAdapter} from '/prototypes/evidence-indexeddb/adapter.mjs';
import {createCoordinator,assemble} from '/prototypes/evidence-indexeddb/coordinator.mjs';
import {createFinalePhaseSession} from '/prototypes/evidence-indexeddb/unsaved-result-gate.mjs';
import {createPhaseBudget} from '/prototypes/evidence-indexeddb/phase-budget.mjs';
import {installPhaseInputFence} from './input-fence.mjs';
import {createSeed,preState,backgroundKeys,targetKeys,sourceKey,storyKey} from './seed.mjs';
const $=id=>document.getElementById(id),copy=value=>structuredClone(value),N=window.__nativeHarness,S=window.__phaseNative;
if(!N||!S)throw Error('Native phase instrumentation must precede index');
window.__phaseFixtureImports=(window.__phaseFixtureImports||0)+1;if(window.__phaseFixtureImports!==1)throw Error('One fixture import only');
const identity=Object.freeze({scope:'phase-session-native:guest',generation:1,sourceIdentity:'disposable-guest:1'});
const events=[],transport=[],perPhase=[],logical=[],exactLogical=[],targets=[],trustedInputs=[];
const counters={captures:0,original:0,award:0,open:0,save:0,risk:0,epilogue:0,pace:0,storyComplete:0,rewards:0};
const saveAuthority={checks:0,violations:0,maxRetainedBytes:0};
let manager,adapter,base,budget,fence,input,configured=false,started=false,operationSerial=0,activeTransport=0,peakTransport=0;
let releaseFirst=null,firstAppend=true,pendingInputObservations=0;const gate={armed:false,held:false,released:false,probe:false};
const observeAfterDispatch=window.setTimeout.bind(window);
const packet=value=>MKTYTraceCodec.stringify(value,8192,'fixture-checkpoint-limit');
const state=()=>manager?.view().state||'SETUP';
const mode=()=>{const v=manager?.view(),i=v?.chapter===8?v.phase:2+(v?.phase||0);return ({OPENING:'open-'+i,DISPATCH:'dispatch-'+i,ENTRY_NAVIGATION:'entry-navigation',ENTRY_CONFIRM:'entry-confirm',EPILOGUE:'epilogue'})[v?.state]||state().toLowerCase();};
const log=(type,details={})=>{if(events.length>=256)throw Error('Fixture event limit');const v=manager?.view();const row={n:events.length,nativeEventIndex:N.log.length,type,chapter:v?.chapter??null,phase:v?.phase??null,...details};events.push(row);return row;};
const physical=()=>({physicalBusy:adapter?.physicalBusy??false,retainedBytes:adapter?.retainedBytes??0,nativePhysical:N.physical});
function authority(type,details={}){const row=log(type,{...physical(),...details});if(row.physicalBusy||row.retainedBytes||row.nativePhysical)throw Error('Authority while native storage active');return row;}
function snapshots(){return {logical:Object.fromEntries(targetKeys.map(key=>[key,MKTYStorage.readItem(key)])),native:Object.fromEntries(targetKeys.map(key=>[key,S.read(key)]))};}
function target(label){if(targets.length>=32)throw Error('Target observation limit');const row={label,mode:label,state:state(),nativeEventIndex:N.log.length,...physical(),...snapshots()};targets.push(row);return row;}
const panel=document.createElement('aside');panel.id='phaseControls';panel.innerHTML='<p>TEST-ONLY continuous phase session</p><p id="phaseStatus">Setup required</p>'+[
  ['phaseStart','Start synthetic prerequisite session'],['phaseContinue','Continue saved result'],['phaseOpen','Open staged field'],
  ['phaseEntry','Test story entry to chapter 9 (no cinematic)'],['phaseRetry','Retry pending evidence'],['phaseRelease','Release stale-control probe']
].map(([id,title])=>`<button id="${id}" type="button">${title}</button>`).join('');
const result=document.createElement('section');result.id='phaseResult';result.className='screen';result.innerHTML='<h1>Completed field result</h1><p>Test archive pending. Use the separate test controls to continue.</p>';$('app').append(result);
$('app').append(panel); // In the real scroll container, outside all gameplay screens.
const css=document.createElement('link');css.rel='stylesheet';css.href='/tests/fixtures/evidence-phase-session/fixture.css';document.head.append(css);
function render(){const v=manager?.view();$('phaseStatus').textContent=v?`${v.state}${v.reason?': '+v.reason:''}`:'Setup required';
  $('phaseStart').disabled=!configured||started;$('phaseContinue').disabled=!v?.continueEnabled;
  $('phaseOpen').disabled=!v||v.busy||!['INITIAL','OPEN_READY'].includes(v.state);$('phaseEntry').disabled=v?.state!=='WAIT_CHAPTER9'||v.busy;
  $('phaseRetry').disabled=!v?.retryEnabled;$('phaseRelease').disabled=!gate.held;return v;}
function observe(label,operation){
  const serial=++operationSerial;H.settled=false;H.operationError=null;let promise;
  try{promise=typeof operation==='function'?operation():operation;}catch(error){promise=Promise.reject(error);}
  H.pending=Promise.resolve(promise).then(value=>{H.lastOperationResult=value;return value;},error=>{H.operationError=String(error.stack||error);log('operation-error',{label,error:String(error.message)});return null;}).finally(()=>{
    if(serial===operationSerial){H.settled=true;render();target(label);log('operation-settled',{label,state:state(),...physical()});}
  });render();return H.pending;
}
for(const [method,op]of [['setItem','set'],['removeItem','remove'],['clear','clear'],['retry','retry']]){
  const original=MKTYStorage[method];MKTYStorage[method]=function(key,value){
    const operation={op,...(key===undefined?{}:{key:String(key)}),...(op==='set'?{value:String(value)}:{})};
    const forward=()=>{
      if(logical.length>=12000)throw Error('Logical observation row limit');
      const row={n:logical.length,state:state(),mode:mode(),kind:op,key:operation.key??null,bytes:operation.value?.length*2||0,exact:S.finite.has(state())&&!S.background.has(operation.key)};logical.push(row);
      if(row.exact){if(exactLogical.length>=160)throw Error('Finite logical observation limit');row.value=operation.value??null;exactLogical.push(row);}
      return original.apply(this,arguments);
    };
    return manager&&started?manager.write(operation,forward):forward();
  };
}
S.state=state;S.mode=mode;S.targetKeys=new Set(targetKeys);
function spy(object,name,count){const original=object[name];object[name]=function(...args){counters[count]++;log(count,{chapter:args[0]});return original.apply(this,args);};}
const award=window.awardLifePoints;window.awardLifePoints=function(n,amount){counters.award++;authority('award',{chapter:n,amount});return award.apply(this,arguments);};
spy(MKTYPace,'onRecorded','pace');spy(MKTYStory,'complete','storyComplete');spy(MKTYRewards,'completeLife','rewards');
const fieldOpen=MKTYField.open;
MKTYField.open=function(task,saved){
  if(!manager||!task.core||![8,9].includes(task.chapter))throw Error('Outside owned finale descriptor');
  const original=task.complete,save=task.save;
  const row={chapter:task.chapter,phase:task.id,mechanic:task.mechanic,seed:task.seed,capturedText:null,originalArgumentText:null};
  if(perPhase.length>=5)throw Error('Extra descriptor');perPhase.push(row);
  return manager.stageTask({...task,save(cp){
    const p=physical();saveAuthority.checks++;saveAuthority.maxRetainedBytes=Math.max(saveAuthority.maxRetainedBytes,p.retainedBytes);
    if(p.physicalBusy||p.retainedBytes||p.nativePhysical){saveAuthority.violations++;throw Error('Original save while native storage active');}
    counters.save++;return save(cp);
  },complete(cp){
    row.originalArgumentText=packet(cp);counters.original++;authority('original-start',{chapter:task.chapter,phase:task.id});return original(cp);
  }},saved);
};
function openField(task,saved){
  counters.open++;authority('original-open',{chapter:task.chapter,phase:task.id});
  const complete=task.complete;
  return fieldOpen({...task,complete(cp){
    const row=perPhase.find(p=>p.chapter===task.chapter&&p.phase===task.id);log('raw-callback',{chapter:task.chapter,phase:task.id});
    // The manager synchronously leaves/revokes and captures before observation.
    const operation=complete(cp);row.capturedText=packet(cp);row.captureNativeEventIndex=N.log.length;counters.captures++;
    return observe('capture-'+task.chapter+'-'+task.id,operation);
  }},saved);
}
const epilogue=MKTYLegacy.epilogue;
MKTYLegacy.epilogue=function(done){const finish=manager.stageEpilogue(()=>{counters.epilogue++;authority('original-epilogue-done');return done();});return epilogue(()=>observe('epilogue',()=>finish()));};
const risky=MKTYPace.risky,paceGo=$('paceGo').onclick,paceCancel=$('paceCancel').onclick;
MKTYPace.risky=function(...args){counters.risk++;const result=risky.apply(this,args);
  if($('paceDialog').open){const handle=manager.stageRisk({chapter:9,confirm:()=>{authority('original-risk-confirm');return paceGo();},cancel:paceCancel});
    if(!handle)throw Error('Risk staging failed');$('paceGo').onclick=()=>observe('entry-confirm',handle.confirm);$('paceCancel').onclick=()=>observe('entry-cancel',handle.cancel);}
  return result;
};
// Registered BEFORE the unchanged fence, so trusted blocked input is observable.
for(const type of ['click','keydown','keyup','input','change','pointerdown','pointerup'])document.addEventListener(type,event=>{
  if(!gate.probe||!$('fieldMission').contains(event.target))return;
  if(trustedInputs.length>=64)throw Error('Trusted input observation limit');
  const row={type,isTrusted:event.isTrusted,target:event.target.id||event.target.dataset.fieldAction||event.target.tagName,
    key:event.key??null,nativeEventIndex:N.log.length,playEnabled:manager.view().playEnabled,beforeFenceBlocked:fence.diagnostics().blocked};trustedInputs.push(row);
  // Native dispatch can run a microtask checkpoint between listeners. Observe
  // cancellation in the next real task, after the unchanged fence has returned.
  pendingInputObservations++;
  observeAfterDispatch(()=>{try{row.defaultPrevented=event.defaultPrevented;row.eventPhase=event.eventPhase;row.fenceBlocked=fence.diagnostics().blocked;}finally{pendingInputObservations--;}} ,0);
},{capture:true,passive:false});
async function tracked(kind,q,operation){
  if(transport.length>=64)throw Error('Transport observation limit');activeTransport++;peakTransport=Math.max(peakTransport,activeTransport);
  const row={kind,run:q?.descriptor?.run||q?.captureIdentity?.run||null,ordinal:q?.ordinal??null,
    seal:!!q?.seal,length:q?.payload?.length??null,throughHead:q?.throughHead??null,startNativeEventIndex:N.log.length};transport.push(row);
  try{const value=await operation();row.result={status:value.status,reason:value.reason??null,receipt:value.receipt??null,currentHead:value.currentHead??null,nextCursor:value.nextCursor??null};return value;}
  finally{row.endNativeEventIndex=N.log.length;row.native=N.log.slice(row.startNativeEventIndex).filter(e=>['transaction','complete','abort'].includes(e.type));Object.assign(row,physical());activeTransport--;log('transport-settled',{kind,run:row.run,status:row.result?.status,...physical()});}
}
async function append(q,context){
  if(firstAppend){firstAppend=false;if(gate.armed){gate.held=gate.probe=true;document.body.dataset.phaseInputProbe='true';log('input-probe-exposed');render();await new Promise(resolve=>{releaseFirst=resolve;});}}
  return tracked('append',q,()=>base.appendSegment(q,context));
}
function components(bytes,descriptor){const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.length),out={};let offset=12;
  for(const part of descriptor.components){if(view.getBigUint64(offset,true)!==BigInt(part.length))throw Error('Inspection framing');offset+=8;
    if(part.encoding!=='utf16le')throw Error('Inspection encoding');let text='';for(let i=0;i<part.length;i+=2)text+=String.fromCharCode(view.getUint16(offset+i,true));out[part.name]=text;offset+=part.length;}
  if(offset!==bytes.length)throw Error('Inspection length');return out;}
async function inspect(){
  if(state()!=='DONE'||adapter.physicalBusy||adapter.retainedBytes)throw Error('Inspection requires completed idle session');
  const page=await base.recover({scope:identity.scope,maxHeads:8,maxBytes:32768});if(page.status!=='page'||page.nextCursor||page.heads.length!==7)throw Error('Expected exact seven sealed captures');
  const items=[];for(const item of page.heads){const restored=await assemble(base,item,65536),parts=components(restored.bytes,item.descriptor);
    const entry={descriptor:item.descriptor,head:item.head,bytes:restored.bytes.length,sha256:[...new Uint8Array(await N.native.digest('SHA-256',restored.bytes))].map(b=>b.toString(16).padStart(2,'0')).join('')};
    if(parts.checkpoint){const binding=JSON.parse(parts.binding),row=perPhase.find(p=>p.chapter===binding.chapter&&p.phase===binding.phase);Object.assign(entry,{reference:JSON.parse(parts['context-reference']),checkpointText:parts.checkpoint,equalsCaptured:parts.checkpoint===row?.capturedText});}
    else{const story=JSON.parse(parts.story),captured=targets.find(t=>t.label===(story.n===8?'setup':'entry-confirm'));
      Object.assign(entry,{storyBytes:parts.story.length*2,traceRows:story.tasks[0]?.proof?.trace?.length??0,precision:Object.values(story.tasks).filter(t=>t.performance?.precise===true).length,
        equalsCapturedContext:parts.story===captured?.logical[storyKey(story.n)]});}items.push(entry);
  }return {items,view:manager.view()};
}
window.H={ready:true,settled:true,pending:null,operationError:null,captureError:null,
  async setup(options={}){
    if(configured)throw Error('One setup only; fresh BrowserContext required');configured=true;
    if(window.Telegram?.WebApp?.initData||MKTYStorage.identity()!=='guest'||window.localStorage!==MKTYStorage||S.object===MKTYStorage)throw Error('Disposable guest/native facade mismatch');
    const seed=createSeed(window);for(const [key,value]of Object.entries(seed))MKTYStorage.setItem(key,value);
    for(const key of targetKeys)if(!Object.hasOwn(seed,key)&&MKTYStorage.readItem(key)!==null)MKTYStorage.removeItem(key);
    if(MKTYStorage.getItem('mkty_expeditions_v1')!==JSON.stringify(MKTYExpedition.snapshot()))throw Error('Idle expedition baseline mismatch');
    const precision=MKTYLegacy.precise();if(precision.count!==1||precision.total!==1)throw Error('Natural precision changed');
    H.setupEvidence={seedCalls:1,story8Bytes:seed[storyKey(8)].length*2,traceRows:911,precision,skip9:seed.mkty_pace_skip_9,runDate:new Date().toISOString(),syntheticPrerequisites:true};
    H.setupProof={seedCount:1,importCount:window.__phaseFixtureImports,session:'1234567890abcdef1234567890abcdef',context911:{traceRows:911,storyBytes:38628},precision,...H.setupEvidence,
      facadeEqualsNative:targetKeys.every(key=>MKTYStorage.readItem(key)===S.read(key)),persistent:MKTYStorage.persistent,
      initialSources:Object.fromEntries([8,9].map(n=>[n,JSON.parse(seed[sourceKey(n)])])),initialSourceCheckpoints:0};
    gate.armed=options.holdFirstAppend===true;adapter=createTestAdapter({scope:identity.scope});const opened=await adapter.open();if(opened.status!=='open')throw Error('Native adapter open failed');
    base=createCoordinator(adapter,()=>identity);budget=createPhaseBudget();
    const coordinator={appendSegment:append,retry:()=>tracked('retry',null,()=>base.retry()),readSegments:q=>tracked('read',q,()=>base.readSegments(q)),recover:q=>tracked('recover',q,()=>base.recover(q)),
      get retainedBytes(){return base.retainedBytes;},get physicalBusy(){return base.physicalBusy;},get inFlight(){return base.inFlight;}};
    manager=createFinalePhaseSession({coordinator,readIdentity:()=>identity,readItem:key=>MKTYStorage.readItem(key),readNative:S.read,
      isPersistent:()=>MKTYStorage.persistent,retryStorage:()=>MKTYStorage.retry(),leaveField:()=>show('phaseResult'),openField,budget,crypto,now:Date.now});
    fence=installPhaseInputFence({document,readView:()=>manager.view()});
    input={mode:'fresh-fixture',session:'1234567890abcdef1234567890abcdef',identity:{...identity},baseSeeds:{8:731,9:731},preState:preState(),background:Object.fromEntries(backgroundKeys.map(key=>[key,seed[key]]))};
    target('setup');render();return copy(H.setupEvidence);
  },
  start(){if(started)throw Error('One start only');started=true;return observe('start',async()=>{await manager.begin(input);manager.initialEntry(()=>{authority('original-initial-entry');return MKTYSpatialFinale.open(8);});return manager.openStaged();});},
  continue(){authority('explicit-continue',{chapter:manager.view().chapter,phase:manager.view().phase});return observe('continue',()=>manager.continue());},
  open(){return observe('open',()=>manager.openStaged());},
  entry(){return observe('entry',()=>manager.entryNavigation(()=>{authority('original-entry');return openMission9();}));},
  retry(){return observe('retry',()=>manager.retry());},
  release(){if(!gate.held||!releaseFirst)throw Error('No held append');delete document.body.dataset.phaseInputProbe;gate.probe=false;log('input-probe-removed');gate.held=false;gate.released=true;const release=releaseFirst;releaseFirst=null;render();release();},
  view:()=>manager?.view()||null,get model(){return MKTYField.snapshot();},get gate(){return {...gate};},get pendingInputObservations(){return pendingInputObservations;},inspect,
  facts(){const model=MKTYField.snapshot(),view=manager?.view(),source=view?MKTYStorage.readItem(sourceKey(view.chapter)):null,current=snapshots();
    return {view,counters:copy(counters),saveAuthority:copy(saveAuthority),perPhase:copy(perPhase),events:copy(events),transport:copy(transport),nativeEvents:copy(N.log),
      logical:copy(exactLogical),native:copy(S.exactRows),outsideLogical:copy(logical.filter(row=>!row.exact)),outsideNative:copy(S.rows.filter(row=>!row.exact)),allLogical:copy(logical),allNative:copy(S.rows),nativeObservationErrors:copy(S.errors),
      targets:copy(targets),lastTargets:copy(S.lastTargets),logicalSnapshot:current.logical,nativeSnapshot:current.native,...physical(),activeTransport,peakTransport,budget:budget?.snapshot(),
      setupEvidence:copy(H.setupEvidence),setupProof:copy(H.setupProof),gate:{...gate},inputFence:fence?.diagnostics(),trustedInputs:copy(trustedInputs),pendingInputObservations,
      model,savedCheckpoint:source?JSON.parse(source).checkpoint??null:null,active:document.querySelector('.screen.active')?.id,
      fieldDialogOpen:$('fieldDialog').open,focusTag:document.activeElement?.tagName,paceDialogOpen:$('paceDialog').open,epilogueOpen:$('legacyDialog').open,chapterStage:$('mission'+(view?.chapter||8)).dataset.stage,
      settled:H.settled,operationError:H.operationError,captureError:H.captureError,persistent:MKTYStorage.persistent,
      observationAllocation:'Bounded fixture diagnostics, exact writer values and target snapshots are separate test observations, excluded from component ledger; no heap/RSS claim.'};}
};
for(const [id,method]of [['phaseStart','start'],['phaseContinue','continue'],['phaseOpen','open'],['phaseEntry','entry'],['phaseRetry','retry'],['phaseRelease','release']])$(id).onclick=()=>H[method]();
render();window.phaseFixtureReady=true;
