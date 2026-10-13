// SOURCE ONLY. Not imported by the game. Fixed local formats, no server authority.
import * as C from './contract.mjs';
import {requirePhaseBudget} from './phase-budget.mjs';
import {admitContext,matchesContextText,finaleSession,measureFinaleData} from './finale-context-v1.mjs';
import {freezeFinalePhase,readFinalePhase,makeFinalePhase} from './finale-phase-v2.mjs';
import {createContextStream,createPhaseStream} from './context-stream.mjs';
import {createPhaseWriterContract} from './phase-writer-contract.mjs';
import {observePrecision} from './precision-observation.mjs';
import {deriveRetiredStoryWitness,verifyRetiredStoryWitness} from './retired-story-witness.mjs';
import {preparedOperationsPhase,PREPARED_OPERATIONS_CACHE_BYTES,PREPARED_OPERATIONS_SCRATCH_BYTES} from './prepared-operations.mjs';

import {assemble} from './coordinator.mjs';
import {SYNTHETIC_LIMIT,describeSyntheticSummary,describeSyntheticDescriptor,admitSyntheticCompletion} from './synthetic-completion.mjs';
import {FINALE_LIMIT,describeFinaleDescriptor,admitFinaleCompletion} from './finale-completion.mjs';
export const GATE_LIMIT=Object.freeze({bytes:SYNTHETIC_LIMIT.bytes,segmentBytes:C.LIMIT.payload,segments:3,
  metadata:32768,summary:4096,helperHash:2*C.LIMIT.hashInput,adapter:C.LIMIT.transient,
  combined:2*SYNTHETIC_LIMIT.bytes+C.LIMIT.page+32768+2*C.LIMIT.hashInput+C.LIMIT.transient});
// Never released: even CONTINUED/STALE/BLOCKED retains its one immutable capture.
// Another gate or a new database cannot provide an escape hatch in this realm.
let realmOwner=null,realmAccepting=null;
const RETRYABLE=new Set(['busy','retry-pending','transaction-aborted','native-quota','logical-quota','open-blocked','open-timeout',
  'operation-timeout','terminal-unobserved','connection-closed','storage-unavailable','indexeddb-unavailable','webcrypto-unavailable',
  'webcrypto-sha256-unavailable','encoding-unavailable','insecure-context','unsupported-durability','transient-budget','allocation-refused']);
const RELEASED_RETRY=new Set(['transaction-aborted','native-quota','logical-quota']);
const BLOCKING=new Set(['adapter-closed','unsupported-version','schema-mismatch','scope-mismatch','no-retry','stale-context']);
const INPUT_REASONS=new Set(['summary-invalid','summary-limit','synthetic-admission','payload-limit','payload-detached','payload-view-invalid',
  'descriptor-invalid','component-invalid','artifact-limit','metadata-limit','context-invalid','capture-invalid','counter-overflow','finale-admission','finale-limit']);
// Exceptions are untrusted values too. Never invoke a message/name accessor or
// stringify a thrown object when turning it into bounded status.
function errorCode(error){
  try{const p=Object.getOwnPropertyDescriptor(error,'message');return p&&Object.hasOwn(p,'value')&&typeof p.value==='string'?p.value:null;}catch{return null;}
}
function allocationError(error){try{return error instanceof RangeError;}catch{return false;}}
const reasonOf=(reason,fallback='storage-refused')=>typeof reason==='string'&&(RETRYABLE.has(reason)||BLOCKING.has(reason)||INPUT_REASONS.has(reason))?reason:fallback;
const frozenDescriptor=d=>{d.components.forEach(Object.freeze);Object.freeze(d.components);return Object.freeze(d);};
const contextShape=c=>C.exact(c,['scope','generation','sourceIdentity'])&&C.str(c.scope,128)&&c.scope.length>0&&
  C.int(c.generation)&&C.str(c.sourceIdentity,4096)&&c.sourceIdentity.length>0;
const copyContext=c=>{if(!contextShape(c))C.fail('context-invalid');return Object.freeze({scope:c.scope,generation:c.generation,sourceIdentity:c.sourceIdentity});};
const sameContext=(a,b)=>contextShape(b)&&a.scope===b.scope&&a.generation===b.generation&&a.sourceIdentity===b.sourceIdentity;
const HEAD_KEYS=['version','binding','ordinal','total','root','sealed','token'];
const RECEIPT_KEYS=['captureIdentity','ordinal','length','root','headToken','sealed','acknowledgement','durability'];
const bump=(o,k)=>{o[k]=Math.min(Number.MAX_SAFE_INTEGER,o[k]+1);};

export function createUnsavedResultGate({coordinator,readContext,onContinue}){
  if(!coordinator||!['appendSegment','retry','readSegments'].every(k=>typeof coordinator[k]==='function')||
    typeof readContext!=='function'||typeof onContinue!=='function')C.fail('gate-capability');
  const owner={};
  let state='EMPTY',reason=null,phase='capture',busy=false,readingContext=false,continuing=false,consumed=false;
  let captured=null,descriptor=null,context=null,summary=null,summaryBytes=null,d=null,candidate=null,predicted=null,finalHead=null;
  let finale=null,isFinale=false;
  let ownedUnknown=false,attempt=0,checkpoint={nextOrdinal:0,offset:0,previousRoot:C.ZERO,expectedHead:null};
  const stats={captureCount:0,attempts:0,appendCalls:0,retryCalls:0,readCalls:0,admissions:0,navigationCalls:0,
    maxOutstanding:0,capturedBytes:0,readbackBytes:0,pageReservationBytes:0,metadataSlots:0,helperHashLive:0,helperHashPeak:0,
    finaleWorkspaceBytes:0,liveModeledBytes:0,modeledPeakBytes:0,modeledEnvelopeBytes:0,wholeArtifactCopies:0,summaryEncodedBytes:0};
  function account(){
    const n=C.add(stats.capturedBytes,stats.readbackBytes,stats.pageReservationBytes,stats.metadataSlots,stats.helperHashLive,stats.finaleWorkspaceBytes,
      captured?GATE_LIMIT.adapter:0);
    if(n>GATE_LIMIT.combined)C.fail('transient-budget');stats.liveModeledBytes=n;stats.modeledPeakBytes=Math.max(stats.modeledPeakBytes,n);
  }
  // The helpers reserve framing and the native digest copy before allocation.
  const hashAccount={reserve(_name,n){if(C.add(stats.helperHashLive,n)>GATE_LIMIT.helperHash)C.fail('transient-budget');
    stats.helperHashLive+=n;stats.helperHashPeak=Math.max(stats.helperHashPeak,stats.helperHashLive);account();},
    release(_name,n){stats.helperHashLive-=n;account();},reserveHash(n,text){this.reserve('hash',n*(text?2:1));},
    releaseHash(n,text){this.release('hash',n*(text?2:1));},hash(){}};
  function stale(){if(state!=='CONTINUED'){state='STALE';reason='stale-context';}return false;}
  function current(){
    if(!context)return false;if(state==='STALE')return false;
    if(readingContext)return false;
    readingContext=true;
    try{return sameContext(context,readContext())||stale();}catch{return stale();}finally{readingContext=false;}
  }
  function snapshot(override){
    return Object.freeze({state,reason:override||reason,phase,retained:!!captured,summary,
      retryEnabled:state==='UNSAVED'&&!busy&&!continuing&&!readingContext,
      continueEnabled:state==='READY'&&!busy&&!continuing&&!readingContext&&!consumed,
      message:state==='READY'?'Result saved. Continue when ready.':state==='CONTINUED'?'Continued.':captured?'Result not saved yet.':'',
      warning:captured&&state!=='READY'&&state!=='CONTINUED'?'Closing this page before the result is saved may lose it.':'',
      checkpoint:Object.freeze({...checkpoint}),ownedUnknown,diagnostics:Object.freeze({...stats})});
  }
  function publish(override){if(context&&state!=='CONTINUED'&&!readingContext)current();return snapshot(override);}
  function view(){return publish();}
  function block(code){if(state!=='STALE'){state='BLOCKED';reason=code;}return false;}
  function refuse(code){if(state==='STALE')return false;state=RETRYABLE.has(code)?'UNSAVED':'BLOCKED';reason=code;return false;}
  async function boundary(work,nonce,storage=false){
    if(nonce!==attempt||!current())C.fail('stale-context');
    try{
      const result=await work();
      // Ownership bookkeeping survives a stale settlement, without advancing
      // its cursor or authorizing retry under another account/source.
      if(storage&&result?.status==='outcomeUnknown')ownedUnknown=true;
      return result;
    }finally{if(nonce!==attempt||!current())C.fail('stale-context');}
  }
  function retainedLease(){
    try{const n=coordinator.retainedBytes;if(!C.int(n)||n>C.LIMIT.request)C.fail('retry-capability');return n;}
    catch{C.fail('retry-capability');}
  }
  function validateAcknowledgement(result){
    const r=result.receipt,h=result.currentHead,q=candidate;
    return result.contextCurrent===true&&C.exact(r,RECEIPT_KEYS)&&C.exact(r.captureIdentity,['scope','run'])&&
      r.captureIdentity.scope===descriptor.scope&&r.captureIdentity.run===descriptor.run&&r.ordinal===q.ordinal&&
      r.length===q.payload.length&&r.root===predicted.root&&r.headToken===predicted.token&&r.sealed===predicted.sealed&&
      r.acknowledgement==='idb-transaction-complete'&&r.durability==='strict'&&C.exact(h,HEAD_KEYS)&&
      HEAD_KEYS.every(k=>h[k]===predicted[k]);
  }
  async function prepareCandidate(nonce){
    if(candidate)return;
    const offset=checkpoint.offset,end=Math.min(captured.length,offset+GATE_LIMIT.segmentBytes);
    const q={descriptor,expectedHead:checkpoint.expectedHead,ordinal:checkpoint.nextOrdinal,offset,
      previousRoot:checkpoint.previousRoot,payload:captured.subarray(offset,end)};
    const root=await boundary(()=>C.chain(d,q,q.payload,globalThis.crypto,hashAccount),nonce);
    const head=await boundary(()=>C.makeHead(d,q.ordinal,end,root,end===captured.length,globalThis.crypto,hashAccount),nonce);
    if(end===captured.length)q.seal=Object.freeze({totalBytes:end,root});
    candidate=Object.freeze(q);predicted=Object.freeze(head);
  }
  async function verify(nonce){
    state='VERIFYING';phase='verify';reason=null;
    if(!finalHead||!finalHead.sealed||finalHead.total!==captured.length||finalHead.binding!==d.binding||
      finalHead.ordinal+1!==Math.ceil(captured.length/GATE_LIMIT.segmentBytes))return block('head-mismatch');
    let expectedOrdinal=0,expectedOffset=0;
    const facade=Object.freeze({async readSegments(request){
      if(request.throughHead!==finalHead.token||request.captureIdentity?.scope!==descriptor.scope||request.captureIdentity?.run!==descriptor.run||
        (request.afterOrdinal??-1)!==expectedOrdinal-1||request.maxBytes!==C.LIMIT.page)C.fail('readback-mismatch');
      bump(stats,'readCalls');
      const page=await boundary(()=>coordinator.readSegments(request),nonce);
      if(page?.status!=='page')C.fail(reasonOf(page?.reason));
      // Strict one-segment pages follow fixed 65536-byte segmentation. Missing or
      // forged continuation pointers cannot silently truncate or trigger a loop.
      if(!C.exact(page,['status','segments','payloadBytes','throughHead','nextCursor'])||page.throughHead!==finalHead.token||
        !Array.isArray(page.segments)||Object.getPrototypeOf(page.segments)!==Array.prototype||page.segments.length!==1||
        !Object.getOwnPropertyDescriptor(page.segments,'0')?.value||Reflect.ownKeys(page.segments).length!==2)C.fail('readback-mismatch');
      const s=page.segments[0],length=Math.min(GATE_LIMIT.segmentBytes,captured.length-expectedOffset);
      if(!C.exact(s,['ordinal','offset','length','root','payload'])||s.ordinal!==expectedOrdinal||s.offset!==expectedOffset||
        s.length!==length||page.payloadBytes!==length||!C.hex(s.root))C.fail('readback-mismatch');
      C.boundedBytes(s.payload,C.LIMIT.page);if(s.payload.length!==length)C.fail('readback-mismatch');
      const last=expectedOffset+length===captured.length;
      if(last?(page.nextCursor!==null||s.root!==finalHead.root):
        (!C.exact(page.nextCursor,['captureIdentity','throughHead','afterOrdinal'])||
          !C.exact(page.nextCursor.captureIdentity,['scope','run'])||page.nextCursor.captureIdentity.scope!==descriptor.scope||
          page.nextCursor.captureIdentity.run!==descriptor.run||page.nextCursor.throughHead!==finalHead.token||
          page.nextCursor.afterOrdinal!==expectedOrdinal))C.fail('readback-mismatch');
      expectedOrdinal++;expectedOffset+=length;return page;
    }});
    // Reserve before assemble allocates its one output. One adapter-returned page
    // is conservatively counted in addition to its unchanged adapter reservation.
    stats.readbackBytes=captured.length;stats.pageReservationBytes=C.LIMIT.page;account();
    try{
      const result=await boundary(()=>assemble(facade,{descriptor,captureIdentity:{scope:descriptor.scope,run:descriptor.run},head:finalHead},GATE_LIMIT.bytes),nonce);
      if(expectedOrdinal!==finalHead.ordinal+1||result.bytes.length!==captured.length||!C.equalBytes(result.bytes,captured))return block('readback-mismatch');
      bump(stats,'admissions');
      if(isFinale)admitFinaleCompletion(result.bytes,descriptor,summary);
      else admitSyntheticCompletion(result.bytes,descriptor,summaryBytes);
      if(!current())return false;state='READY';reason=null;return true;
    }finally{stats.readbackBytes=0;stats.pageReservationBytes=0;account();}
  }
  async function run(nonce){
    try{
      if(!d)d=await boundary(()=>C.descriptor(descriptor,globalThis.crypto,hashAccount),nonce);
      if(phase==='verify'){await verify(nonce);return;}
      while(checkpoint.offset<captured.length){
        if(!current())return;state='SAVING';phase='append';reason=null;
        await prepareCandidate(nonce);if(!current())return;
        const retrying=ownedUnknown;
        bump(stats,retrying?'retryCalls':'appendCalls');
        const result=await boundary(()=>retrying?coordinator.retry():coordinator.appendSegment(candidate,context),nonce,true);
        if(!result||typeof result!=='object')return block('storage-result-invalid');
        if(result.contextCurrent===false||result.reason==='stale-context')return stale();
        if(result.status==='outcomeUnknown'){
          ownedUnknown=true;
          if(retainedLease()===0)return block('retry-capability');
          state='UNSAVED';reason='terminal-unobserved';return;
        }
        if(result.status==='committed'||result.status==='duplicate'){
          if(!validateAcknowledgement(result))return block('acknowledgement-mismatch');
          if(retrying&&retainedLease()!==0)return block('retry-capability');
          ownedUnknown=false;
          checkpoint={nextOrdinal:candidate.ordinal+1,offset:candidate.offset+candidate.payload.length,
            previousRoot:predicted.root,expectedHead:predicted.token};
          finalHead=predicted;candidate=null;predicted=null;
          if(!current())return;
        }else{
          if(retrying){
            if(result.reason==='no-retry')return block('retry-capability');
            const retained=retainedLease()>0;
            if(result.status==='refused'&&RETRYABLE.has(result.reason)&&retained===RELEASED_RETRY.has(result.reason))return block('retry-capability');
            ownedUnknown=retained;
          }
          if(result.status==='conflict')return block('storage-conflict');
          if(result.status!=='refused')return block('storage-result-invalid');
          return refuse(reasonOf(result.reason));
        }
      }
      phase='verify';await verify(nonce);
    }catch(error){
      if(state==='STALE')return;
      if(errorCode(error)==='readback-mismatch')block('readback-mismatch');
      else if(errorCode(error)==='retry-capability')block('retry-capability');
      else if(errorCode(error)==='synthetic-admission')block('synthetic-admission');
      else if(allocationError(error))refuse('allocation-refused');
      else refuse(reasonOf(errorCode(error)));
    }finally{busy=false;}
  }
  function start(){
    if(attempt===Number.MAX_SAFE_INTEGER){block('attempt-limit');return Promise.resolve(snapshot());}
    busy=true;attempt++;bump(stats,'attempts');stats.maxOutstanding=1;
    return run(attempt).then(()=>publish());
  }
  function accept(input){
    if(busy||continuing||readingContext)return Promise.resolve(snapshot('busy'));
    if(captured||consumed)return Promise.resolve(publish('capture-retained'));
    if(realmOwner||realmAccepting)return Promise.resolve(snapshot('realm-capture-retained'));
    busy=true;realmAccepting=owner;
    let validated,s,ctx;
    try{
      if(!C.exact(input,['descriptor','bytes','context','summary']))C.fail('capture-invalid');
      C.boundedBytes(input.bytes,GATE_LIMIT.bytes);
      // Reservation precedes metadata canonicalization and every owned buffer.
      stats.capturedBytes=input.bytes.length;stats.metadataSlots=GATE_LIMIT.metadata;account();
      isFinale=Object.getOwnPropertyDescriptor(input.descriptor,'kind')?.value==='finale-phase-completion';
      if(isFinale){stats.finaleWorkspaceBytes=FINALE_LIMIT.workspace;account();validated=describeFinaleDescriptor(input.descriptor);}
      else{validated=describeSyntheticDescriptor(input.descriptor);s=describeSyntheticSummary(input.summary);}
      ctx=copyContext(input.context);
      if(input.bytes.length!==validated.total||input.descriptor.scope!==ctx.scope)C.fail('capture-invalid');
      stats.modeledEnvelopeBytes=C.add(2*input.bytes.length,C.LIMIT.page,GATE_LIMIT.metadata,GATE_LIMIT.helperHash,GATE_LIMIT.adapter,stats.finaleWorkspaceBytes);
      account();
      const encoded=isFinale?null:C.utf8(s.text);
      if(isFinale)finale=admitFinaleCompletion(input.bytes,validated.value,input.summary);
      else admitSyntheticCompletion(input.bytes,validated.value,encoded);
      // Native typed-array copy: ignore overridden iterators/subarray methods.
      const bytes=new Uint8Array(input.bytes.length);Uint8Array.prototype.set.call(bytes,input.bytes);
      captured=bytes;summaryBytes=encoded;descriptor=frozenDescriptor(validated.value);context=ctx;summary=isFinale?finale.summary:s.summary;
      realmOwner=owner;realmAccepting=null;stats.captureCount=1;stats.wholeArtifactCopies=1;stats.summaryEncodedBytes=encoded?.length||0;bump(stats,'admissions');account();
    }catch(error){
      finale=null;isFinale=false;stats.finaleWorkspaceBytes=0;stats.capturedBytes=0;stats.metadataSlots=0;stats.modeledEnvelopeBytes=0;account();busy=false;if(realmAccepting===owner)realmAccepting=null;
      reason=allocationError(error)?'allocation-refused':reasonOf(errorCode(error),'capture-invalid');return Promise.resolve(snapshot());
    }
    state='SAVING';phase='append';reason=null;
    if(!current()){busy=false;return Promise.resolve(snapshot());}
    return start();
  }
  function retry(){
    if(busy||continuing||readingContext)return Promise.resolve(snapshot('busy'));
    if(!captured||state!=='UNSAVED')return Promise.resolve(view());
    // Claim synchronously, before the reader can reenter Retry.
    busy=true;if(!current()){busy=false;return Promise.resolve(snapshot());}
    return start();
  }
  function continueResult(){
    if(continuing||busy||readingContext)return snapshot('busy');
    if(state!=='READY'||consumed)return view();
    continuing=true;
    try{
      if(!current())return snapshot();
      consumed=true;state='CONTINUED';phase='continue';reason=null;bump(stats,'navigationCalls');
      try{if(isFinale)onContinue(finale.checkpoint);else onContinue();}catch{reason='navigation-threw';}
      return snapshot();
    }finally{continuing=false;}
  }
  return Object.freeze({accept,retry,continue:continueResult,view});
}

// Versioned, SOURCE-ONLY continuous disposable-guest session. The canonical
// realmOwner above is shared with v1. No reset, reload authority, or live import.
export function createFinalePhaseSession(options){
  const {coordinator,readIdentity,readItem,readNative,isPersistent,retryStorage,leaveField,openField,
    budget,crypto=globalThis.crypto,now=Date.now}=options||{};
  if(!coordinator||!['recover','appendSegment','retry','readSegments'].every(k=>typeof coordinator[k]==='function')||
    ![readIdentity,readItem,readNative,isPersistent,retryStorage,leaveField,openField,now].every(f=>typeof f==='function'))C.fail('session-capability');
  requirePhaseBudget(budget);
  const owner={},order=[[8,0,10],[8,1,3],[9,0,9],[9,1,6],[9,2,11]],sourceKey=n=>`mkty_field_finale_${n}_v1`,storyKey=n=>`mkty_story_plan_${n}_v1`;
  let state='EMPTY',reason=null,invalidated=false,busy=false,readingIdentity=false,checkingStorage=false,epoch=0,index=0,config=null,identity=null,small=null,expectedSource=null;
  let task=null,staged=null,raw=null,context=null,pin=null,stream=null,writer=null,retiredWriter=null,witness=null,witnessPending=null,epilogue=null,risk=null,riskSerial=0,precision=null;
  let pinnedStory=null,streamKind=null,rawHeld=false,contextHeld=0,workHeld=false,privateHeld=0,writerActive=false,saveActive=null,retrying=false;
  const stats={begins:0,captures:0,callbacks:0,opens:0,done:0,retries:0,contexts:0,phases:0,backgroundRemovals:0};
  const bump=k=>{stats[k]=Math.min(Number.MAX_SAFE_INTEGER,stats[k]+1);};
  const fail=code=>{invalidated=true;state='BLOCKED';reason=code;epoch++;return false;};
  const shape=x=>C.exact(x,['scope','generation','sourceIdentity'])&&C.str(x.scope,128)&&x.scope.length>0&&C.int(x.generation)&&C.str(x.sourceIdentity,4096)&&x.sourceIdentity.length>0;
  function current(){
    if(invalidated||readingIdentity||['BLOCKED','INSPECTION'].includes(state))return false;readingIdentity=true;const before=epoch;
    try{const v=readIdentity();return !invalidated&&before===epoch&&shape(v)&&identity&&['scope','generation','sourceIdentity'].every(k=>v[k]===identity[k])||fail('stale-context');}
    catch{return fail('stale-context');}finally{readingIdentity=false;}
  }
  function idle(){if(invalidated||checkingStorage)return false;checkingStorage=true;const before=epoch;
    try{return coordinator.physicalBusy===false&&coordinator.retainedBytes===0&&!invalidated&&before===epoch;}catch{return false;}finally{checkingStorage=false;}}
  function view(){return Object.freeze({version:2,state:invalidated?'BLOCKED':state,reason,busy:busy||readingIdentity||checkingStorage,chapter:order[index]?.[0]??9,phase:order[index]?.[1]??2,
    retryEnabled:!busy&&!readingIdentity&&!checkingStorage&&['UNSAVED','DRAIN','OPEN_DRAIN','ENTRY_NAV_DRAIN','ENTRY_DRAIN','EPILOGUE_DRAIN','WITNESS_RETRY'].includes(state),
    continueEnabled:!busy&&!readingIdentity&&!checkingStorage&&state==='READY'&&idle(),playEnabled:!busy&&!readingIdentity&&!checkingStorage&&state==='PLAYING',
    counters:Object.freeze({...stats}),budget:budget.snapshot(),authority:'not-established'});}
  function reserveRaw(){if(!rawHeld){budget.reserve('raw-capsule',65536);rawHeld=true;}}
  function releaseRaw(){raw=null;if(rawHeld){rawHeld=false;budget.release('raw-capsule',65536);}}
  function releaseStream(){stream=null;streamKind=null;if(privateHeld){budget.release('private-phase',privateHeld);privateHeld=0;}
    if(workHeld){workHeld=false;budget.release('phase-workspace',327680);}}
  function releaseContext(){pin=null;context=null;pinnedStory=null;if(contextHeld){budget.release('context-retained',contextHeld);contextHeld=0;}}
  function streamIdentity(){return {...identity,sourceText:expectedSource};}
  function streamCurrent(){if(!current())C.fail('stale-context');const at=epoch;
    const sourceText=readItem(sourceKey(order[index][0])),storyText=readItem(storyKey(order[index][0]));
    if(at!==epoch||!current())C.fail('stale-context');return {...identity,sourceText,storyText};}
  function contextInput(n,text){return {scope:identity.scope,session:config.session,storyText:text,binding:{version:1,session:config.session,
    chapter:n,edition:2,baseSeed:config.baseSeeds[n],storyKey:storyKey(n),sourceKey:sourceKey(n),route:'spatial-finale'}};}
  function admitChapter(n){
    if(context)return;
    if(!contextHeld){contextHeld=65536;budget.reserve('context-retained',contextHeld);}
    let text;
    if(pinnedStory!==null){budget.reserve('context-compare-read',132096);
      try{budget.allocate('context-compare-read',132096);text=readItem(storyKey(n));if(text!==pinnedStory)C.fail('stale-story');}
      finally{text=null;budget.release('context-compare-read',132096);}text=pinnedStory;
    }else text=readItem(storyKey(n));
    if(typeof text!=='string'||text.length*2>65536)C.fail('finale-context-limit');
    context=admitContext(contextInput(n,text),budget);pinnedStory=null;
  }

  function metadata(){
    const bytes=measureFinaleData([small,identity,config,stats,witness,precision],24576,{nodes:4096})+(writer?.view().metadataBytes||0)+(retiredWriter?.view().metadataBytes||0)+8192+
      PREPARED_OPERATIONS_CACHE_BYTES+PREPARED_OPERATIONS_SCRATCH_BYTES;
    if(bytes>32768)C.fail('metadata-limit');budget.allocate('metadata',bytes);
    // 8KiB of the 32KiB metadata envelope remains reserved for local handles,
    // context bindings, digest/reference strings, cursor and fixed descriptors.
    // Original operations cache graphs (540) and asynchronous save scratch (540)
    // are separately charged for the entire session, including between writers.
  }
  function backgroundPins(input){
    const keys=['mkty_lang','mkty_control_sound','mkty_light_fx','mkty_expeditions_v1','mkty_daily_demo','mkty_pace_skip_9'];
    if(!C.exact(input,keys)||input.mkty_lang!=='en'||input.mkty_control_sound!=='no'||input.mkty_light_fx!=='yes'||
      ![null,'yes'].includes(input.mkty_pace_skip_9))C.fail('background-preconditions');
    measureFinaleData([input],8192,{nodes:4096});
    const idle=JSON.parse(input.mkty_expeditions_v1),daily=JSON.parse(input.mkty_daily_demo);
    if(!C.exact(idle,['version','profile','run'])||idle.version!==1||idle.run!==null||!idle.profile||
      !C.exact(daily,['attempts','streak','solved','codes','cday'])||daily.attempts!==0||daily.streak!==0||daily.solved!==false||
      !Array.isArray(daily.codes)||daily.codes.length!==0||daily.cday!==new Date(now()).toISOString().slice(0,10))C.fail('background-preconditions');
    return Object.freeze({...input});
  }
  function fixedPrestate(values){
    if(!values||Object.getPrototypeOf(values)!==Object.prototype)C.fail('session-preconditions');
    const required={mkty_points:'100',mkty_global_lives:'9',mkty_life8:null,mkty_life9:null,mkty_life8_awarded:null,mkty_life9_awarded:null,
      mkty_life8_completed_at:null,mkty_life9_completed_at:null,mkty_spatial_report_8:null,mkty_spatial_report_9:null,
      mkty_final_moon_points:null,mkty_points_locked_at:null,mkty_pace_ack_8:null,mkty_pace_ack_9:null,mkty_life9_coordinates:null};
    const keys=['mkty_operations_8_v1','mkty_operations_9_v1'],explicit=keys.some(k=>Object.hasOwn(values,k));
    if(!C.exact(values,[...Object.keys(required),...(explicit?keys:[])])||Object.keys(required).some(k=>values[k]!==required[k]))C.fail('session-preconditions');
    const operations=Object.fromEntries(keys.map(key=>[key,explicit?values[key]:null]));
    const phases=keys.map((key,i)=>preparedOperationsPhase(operations[key],i+8));
    if(phases[0]!==phases[1]||![null,'core'].includes(phases[0]))C.fail('session-preconditions');
    return Object.freeze({...required,mkty_campaign_checkpoint_8:null,mkty_campaign_checkpoint_9:null,...operations,mkty_life_restore_at:null});
  }
  function operationsCurrent(){for(const n of [8,9]){const key=`mkty_operations_${n}_v1`;
    if(readItem(key)!==small[key]||readNative(key)!==small[key])C.fail('operations-precondition-mismatch');}}
  function nativeSmall(){budget.reserve('native-read',65536);try{budget.allocate('native-read',65536);operationsCurrent();for(const [key,value]of Object.entries(small)){budget.allocate('native-read',65536);if(readNative(key)!==value)return fail('native-precondition-mismatch');}return isPersistent()===true;}finally{budget.release('native-read',65536);}}
  function quiet(){
    const keys=['mkty_cloud_restore_transaction','mkty_cloud_restore_pending','mkty_cloud_restore_retry_guard',
      'mkty_cloud_dirty','mkty_cloud_restore_outgoing','mkty_cloud_recovery','mkty_pending_v2_telegram','mkty_test_no_pacing','mkty_pace_server'];
    budget.reserve('native-read',65536);
    try{for(const key of keys){budget.allocate('native-read',65536);if(readItem(key)!==null||readNative(key)!==null)return fail('excluded-recovery-state');}return true;}
    catch{return fail('recovery-state-unreadable');}finally{budget.release('native-read',65536);}
  }
  async function begin(input){
    if(busy||readingIdentity||checkingStorage||state!=='EMPTY'||realmOwner||realmAccepting)return view();
    busy=true;realmAccepting=owner;let admitted;
    try{if(!C.exact(input,['mode','session','identity','baseSeeds','preState','background'])||!['fresh-fixture','inspection'].includes(input.mode)||
      !finaleSession(input.session)||!shape(input.identity)||!C.exact(input.baseSeeds,['8','9'])||
      Object.values(input.baseSeeds).some(v=>!Number.isInteger(v)||v<0||v>0xffffffff))C.fail('session-input');
      admitted={mode:input.mode,session:input.session,baseSeeds:Object.freeze({...input.baseSeeds})};
      const id=Object.freeze({...input.identity}),pre=Object.freeze({...fixedPrestate(input.preState),...backgroundPins(input.background)});identity=id;small=pre;config=Object.freeze(admitted);
    }catch{reason='session-input';identity=null;small=null;config=null;busy=false;if(realmAccepting===owner)realmAccepting=null;return view();}
    bump('begins');
    // A valid begin owns this realm even when recovery is inconclusive. Only a
    // syntactically invalid begin above leaves v1 available.
    realmOwner=owner;
    try{
      metadata();if(!current())return view();budget.reserve('recovery-page',16384);let page=null;
      try{budget.allocate('recovery-page',16384);page=await coordinator.recover({scope:identity.scope,maxHeads:1,maxBytes:8192});
        if(!current())return view();
        if(config.mode==='inspection'){state='INSPECTION';reason='reload-inspection-only';return view();}
        if(!C.exact(page,['status','heads','watermark','nextCursor'])||page.status!=='page'||!Array.isArray(page.heads)||
          page.heads.length!==0||Reflect.ownKeys(page.heads).length!==1||page.watermark!==0||page.nextCursor!==null){state='INSPECTION';reason='archive-not-proven-empty';return view();}
      }finally{page=null;budget.release('recovery-page',16384);}
      if(!nativeSmall()||!quiet()||!current()||!idle())return fail('initial-storage-not-idle'),view();reserveRaw();admitChapter(8);const lease=originalReadLease();
      try{lease.acquire();precision=observePrecision({readItem,budget,current});metadata();}finally{lease.release();}
      if(!current()||!idle())return view();state='INITIAL';reason=null;
    }catch{fail('initial-storage-unverified');}
    finally{if(realmAccepting===owner)realmAccepting=null;busy=false;}
    return view();
  }
  function descriptor(t,at){const [n,p,m]=order[at]||[];return t&&t.chapter===n&&t.id===p&&t.mechanic===m&&t.fieldStage===4&&
    t.core===true&&t.phaseCount===(n===8?2:3)&&t.seed===((config.baseSeeds[n]+p*7919)>>>0)&&
    ['save','complete','exit'].every(k=>typeof t[k]==='function')&&Array.isArray(t.title)&&t.title.length===2&&t.title.every(v=>typeof v==='string'&&v.length<=256);}
  function stageTask(t,saved){
    const next=state==='DISPATCH'?index+1:index;
    if(!config||!['INITIAL_ENTRY','DISPATCH','ENTRY_CONFIRM'].includes(state)||staged||!descriptor(t,next)||!current())return fail('unexpected-descriptor');
    // This disposable sequence starts each stage fresh; no second mutable saved
    // checkpoint or arbitrary task property is retained by an old UI closure.
    if(saved!==undefined&&saved!==null)return fail('unexpected-saved-descriptor');
    const fields=['chapter','id','mechanic','fieldStage','core','phaseCount','seed','save','complete','exit'];
    const fixed={};for(const key of fields){const p=Object.getOwnPropertyDescriptor(t,key);if(!p||!Object.hasOwn(p,'value'))return fail('descriptor-accessor');fixed[key]=p.value;}
    fixed.title=Object.freeze([t.title[0],t.title[1]]);reserveRaw();if(!current())return false;
    staged={task:Object.freeze(fixed),saved:undefined,at:next};return true;
  }
  function initialEntry(original){
    if(busy||readingIdentity||checkingStorage||state!=='INITIAL'||staged||typeof original!=='function'||!current()||!idle())return view();
    busy=true;let held=0,incoming=null;const slots=['callback-scratch','callback-outer-story','callback-inner-story'],lease=originalReadLease();
    try{incoming=readItem(sourceKey(8));
      if(typeof incoming!=='string'||incoming.length*2>16384)C.fail('initial-source-limit');
      let initial=JSON.parse(incoming);
      if(!C.exact(initial,['version','n','phase','seed','seconds'])||initial.version!==1||initial.n!==8||initial.phase!==0||initial.seed!==config.baseSeeds[8]||initial.seconds!==0)C.fail('initial-source-invalid');
      initial=null;expectedSource=incoming;incoming=null;budget.reserve('context-compare-read',132096);
      try{budget.allocate('context-compare-read',132096);if(!matchesContextText(context,readItem(storyKey(8))))C.fail('initial-story-changed');}
      finally{budget.release('context-compare-read',132096);}
      for(const label of slots){held++;budget.reserve(label,65536);budget.allocate(label,65536);}
      lease.acquire();operationsCurrent();if(!current()||!idle())return view();state='INITIAL_ENTRY';original();
      if(!current()||!staged)C.fail('initial-descriptor-missing');state='INITIAL';
    }catch{fail('initial-entry-unverified');}
    finally{incoming=null;try{lease.release();}catch{fail('initial-read-release');}while(held){const label=slots[--held];try{const n=budget.snapshot().reservations[label];if(n)budget.release(label,n);}catch{fail('initial-entry-budget');}}busy=false;}
    return view();
  }
  function makeWriter(stage,extra={},projectAfterRead){
    if(writer)C.fail('writer-retained');const n=order[index][0];
    let created;created=createPhaseWriterContract({stage,chapter:n,phase:order[index][1],baseSeed:config.baseSeeds[n],sourceText:expectedSource,
      checkpoint:raw?readFinalePhase(raw).checkpoint:undefined,legacyText:readItem('mkty_legacy_v1'),precisionCount:precision.count,
      context,budget,now,projectAfterRead,isCurrent:()=>!!current()&&(writer===created||retiredWriter===created&&index===4&&['EPILOGUE_READY','EPILOGUE','EPILOGUE_DRAIN'].includes(state))&&state!=='BLOCKED',preState:small,...extra});writer=created;metadata();
  }
  // The read workspace is an encoded-representation stencil for unchanged
  // storage read/parse/restore work. It is exchanged only after forward() and
  // its listeners return; no await or original callback runs during projection.
  function originalReadLease(){
    let held=false,projecting=false;
    function acquire(){if(held)C.fail('read-workspace-overlap');held=true;budget.reserve('original-read-workspace',196608);budget.allocate('original-read-workspace',196608);}
    function release(){if(!held)return;held=false;const bytes=budget.snapshot().reservations['original-read-workspace'];if(bytes)budget.release('original-read-workspace',bytes);}
    return {acquire,release,project(callback){
      if(!held||projecting||!current())C.fail('read-workspace-owner');projecting=true;
      try{release();if(!current())C.fail('stale-context');const result=callback();if(!current())C.fail('stale-context');return result;}
      finally{try{acquire();}finally{projecting=false;}}
    }};
  }
  function execute(stage,callback,extra={}){
    const slots=['callback-scratch','callback-outer-story','callback-inner-story'];let held=0;
    const lease=originalReadLease();
    try{
      if(!current()||!idle())C.fail('physical-storage-busy');makeWriter(stage,extra,fn=>lease.project(fn));writerActive=true;
      for(const label of slots){held++;budget.reserve(label,65536);budget.allocate(label,65536);}
      lease.acquire();operationsCurrent();
      if(stage==='epilogue'||stage==='dispatch'&&index===4||stage==='open'&&order[index][2]===11){
        const seen=observePrecision({readItem,budget,current});if(seen.count!==precision.count||seen.total!==precision.total)C.fail('precision-changed');
      }
      writer.begin();if(!current()||!idle())C.fail('physical-storage-busy');callback();
      if(invalidated)C.fail('session-blocked');const finished=writer.finish();
      if(finished.nextSourceText!==null)expectedSource=finished.nextSourceText;
    }catch{fail('original-handler-incomplete');}
    finally{writerActive=false;try{lease.release();}catch{fail('read-workspace-release');}
      while(held){const label=slots[--held];try{const n=budget.snapshot().reservations[label];if(n)budget.release(label,n);}catch{fail('callback-budget-failed');}}}
  }
  function writes(operation,forward){
    if(typeof forward!=='function')C.fail('writer-capability');
    if(config&&operation.op==='set'&&['mkty_expeditions_v1','mkty_daily_demo'].includes(operation.key)&&
      operation.value===small[operation.key]&&current()){bump('backgroundRemovals');return forward();}
    // These two unchanged life-bank observations are idempotent in the fixed
    // nine-life guest setup. They are still counted and included in native drain.
    if(config&&current()&&((operation.op==='set'&&operation.key==='mkty_global_lives'&&operation.value==='9'&&small.mkty_global_lives==='9')||
      (operation.op==='remove'&&operation.key==='mkty_life_restore_at'&&small.mkty_life_restore_at===null))){bump('backgroundRemovals');return forward();}
    // Unchanged campaign save removes its completed prior checkpoint when show()
    // leaves the chapter-8 review. It is observed, bounded, and still read back.
    const completedKey=operation.key==='mkty_campaign_checkpoint_8'?8:operation.key==='mkty_campaign_checkpoint_9'?9:0;
    if(config&&completedKey&&operation.op==='remove'&&small[operation.key]===null&&small[`mkty_life${completedKey}`]==='complete'&&current()){
      bump('backgroundRemovals');return forward();
    }
    if(writerActive)return writer.handleWrite(operation,forward);
    if(retrying&&operation.op==='retry')return forward();
    if(saveActive){
      if(saveActive.used||saveActive.forwarding||operation.op!=='set'||operation.key!==sourceKey(order[index][0])||
        operation.value!==saveActive.value||!current()){fail('unexpected-save-write');C.fail('unexpected-save-write');}
      saveActive.used=true;saveActive.forwarding=true;
      try{const result=forward();if(!current())C.fail('stale-save');expectedSource=operation.value;return result;}
      finally{if(saveActive)saveActive.forwarding=false;}
    }
    fail('outside-writer-observed');C.fail('outside-writer-observed');
  }
  function capture(checkpoint,id){
    if(busy||readingIdentity||checkingStorage||state!=='PLAYING'||!task||task.id!==id||!current())return Promise.resolve(view());
    // Revoke active callbacks and leave the board before bridge-owned reads,
    // parse, clone, model admission, serialization, digest or storage awaits.
    busy=true;epoch++;state='CAPTURING';const held=task;task={...held,consumed:true};
    try{leaveField();reserveRaw();const n=order[index][0],sourceText=readItem(sourceKey(n));
      if(sourceText!==expectedSource)C.fail('stale-source');
      if(context){budget.reserve('context-compare-read',132096);try{budget.allocate('context-compare-read',132096);if(!matchesContextText(context,readItem(storyKey(n))))C.fail('stale-story');}finally{budget.release('context-compare-read',132096);}}
      const binding={version:1,chapter:n,edition:2,phase:order[index][1],mechanic:order[index][2],fieldStage:4,
        baseSeed:config.baseSeeds[n],seed:held.original.seed,sourceKey:sourceKey(n),storyKey:storyKey(n),route:'spatial-finale',
        provenance:{authority:'synthetic local observations; not trusted server provenance'}};
      raw=freezeFinalePhase({scope:identity.scope,session:config.session,checkpoint,sourceText,binding},budget);bump('captures');admitChapter(n);
      rawHeld=false;budget.release('raw-capsule',65536);budget.reserve('phase-workspace',327680);workHeld=true;
    }catch{fail('capture-refused');busy=false;return Promise.resolve(view());}
    return archivePhase();
  }
  async function archivePhase(){
    try{
      if(!pin){if(!stream){streamKind='context';stream=createContextStream({context,coordinator,readContext:streamCurrent,expectedContext:streamIdentity(),budget,crypto});}
        const v=await (stream.view().state==='NEW'?stream.save():stream.retry());if(!current())return view();
        if(!v.ready){state=v.state==='UNSAVED'?'UNSAVED':'BLOCKED';reason=v.reason;return view();}
        pin=stream.reference();stream=null;bump('contexts');}
      if(!stream){const artifact=makeFinalePhase(raw,context,pin,budget);streamKind='phase';
        stream=createPhaseStream({context,artifact,reference:pin,coordinator,readContext:streamCurrent,expectedContext:streamIdentity(),budget,crypto});
        privateHeld=artifact.bytes.length;}
      const v=await (stream.view().state==='NEW'?stream.save():stream.retry());if(!current())return view();
      if(!v.ready){state=v.state==='UNSAVED'?'UNSAVED':'BLOCKED';reason=v.reason;return view();}
      releaseStream();reserveRaw();if(!current()||!idle())return fail('archive-not-idle'),view();bump('phases');state='READY';reason=null;
    }catch{fail('archive-unverified');}finally{busy=false;}return view();
  }
  function taskHandles(id){return {
    save(cp){if(!task||task.id!==id||task.consumed||!['PLAYING','OPENING'].includes(state)||saveActive||!current())return false;
      if(state==='OPENING')return task.original.save(cp);
      if(busy||readingIdentity||checkingStorage)return false;
      busy=true;const lease=originalReadLease(),slots=['callback-scratch','callback-outer-story','callback-inner-story'];let held=0;
      try{
        for(const label of slots){held++;budget.reserve(label,65536);budget.allocate(label,65536);}lease.acquire();
        if(!current()||!idle())C.fail('physical-storage-busy');
        if(readItem(sourceKey(order[index][0]))!==expectedSource){fail('stale-source');return false;}
        measureFinaleData([cp],16384,{packed:false,nodes:4096,restrictedKeys:true});
        let projected=JSON.parse(expectedSource);projected.checkpoint=cp;
        const value=JSON.stringify(projected);projected=null;if(value.length*2>16384)C.fail('save-limit');
        saveActive={value,used:false,forwarding:false};const result=task.original.save(cp);
        if(!saveActive.used||!current())fail('save-incomplete');return result;
      }catch{fail('save-refused');return false;}finally{saveActive=null;try{lease.release();}catch{fail('save-read-release');}
        while(held){const label=slots[--held];try{const n=budget.snapshot().reservations[label];if(n)budget.release(label,n);}catch{fail('save-budget-release');}}busy=false;}
    },
    complete(cp){return capture(cp,id);},
    // Terminal user navigation leaves this successful finite-session resource
    // contract; show/render allocations after exit are not covered by its ledger.
    exit(){if(!task||task.id!==id||state!=='PLAYING'||!current())return false;const exit=task.original.exit;fail('navigation-exit');return exit();}};}
  // Only an uninvoked fixed continuation is retained across read-only retry.
  // Consumed award/save callbacks never enter this queue.
  function deferWitness(action,why){
    witnessPending={...action,state};state='WITNESS_RETRY';reason=why;return false;
  }
  async function beforeWitness(action){
    if(!current()||!idle())return false;
    if(witness){const checked=await verifyRetiredStoryWitness({witness,readNative,budget,crypto,current});
      if(checked.status!=='verified'){
        if(checked.status==='retry')return deferWitness(action,checked.reason);
        return fail('retired-story-mismatch');
      }
    }
    if(!current()||!idle())return false;witnessPending=null;return true;
  }
  async function openStaged(){
    if(busy||readingIdentity||checkingStorage||!staged||!['INITIAL','OPEN_READY'].includes(state)||!current()||!idle())return view();
    busy=true;let next=null;
    try{if(!await beforeWitness({kind:"open"}))return view();next=staged;staged=null;index=next.at;reserveRaw();
      const liveSource=readItem(sourceKey(order[index][0]));if(expectedSource!==null&&expectedSource!==liveSource)C.fail('stale-source');expectedSource=liveSource;
      const id=++epoch;task={id,original:next.task,consumed:false};state='OPENING';
      execute('open',()=>openField({...next.task,...taskHandles(id)},next.saved));
      if(!invalidated)state='OPEN_DRAIN';
    }catch{fail('open-preparation-failed');}finally{next=null;busy=false;}return drain();
  }
  async function continueResult(){
    if(busy||readingIdentity||checkingStorage||state!=='READY'||!task||!current()||!idle())return view();busy=true;
    let invoke=null,cp=null,comparison=false;
    try{
      if(!await beforeWitness({kind:'continue'}))return view();
      if(!current()||!idle())return view();
      comparison=true;budget.reserve('context-compare-read',132096);budget.allocate('context-compare-read',132096);
      if(readItem(sourceKey(order[index][0]))!==expectedSource||!matchesContextText(context,readItem(storyKey(order[index][0]))))C.fail('stale-source');
      budget.release('context-compare-read',132096);comparison=false;
      if(!current()||!idle())return view();
      invoke=task.original.complete;cp=readFinalePhase(raw).checkpoint;task.original=null;state='DISPATCH';
      execute('dispatch',()=>{bump('callbacks');invoke(cp);});invoke=null;cp=null;
      if(!invalidated&&((index===0||index===2||index===3)?!staged:index===4?!epilogue:!!staged))fail('handoff-cardinality');
      if(!invalidated)state='DRAIN';
    }catch{fail('continuation-preparation-failed');}
    finally{invoke=null;cp=null;if(comparison){try{const n=budget.snapshot().reservations['context-compare-read'];if(n)budget.release('context-compare-read',n);}catch{fail('comparison-budget-failed');}}busy=false;}
    return drain();
  }
  async function drain(){
    if(busy||readingIdentity||checkingStorage||!writer||!['DRAIN','OPEN_DRAIN','ENTRY_NAV_DRAIN','ENTRY_DRAIN','EPILOGUE_DRAIN'].includes(state)||!current()||!idle())return view();
    busy=true;const before=state;
    try{const result=writer.drain(readNative,isPersistent);if(!result?.ok){reason='result-not-persistent';return view();}
      small=Object.freeze({...small,...writer.smallTargets()});metadata();
      if(before==='DRAIN'&&index===1){const w=await writer.withStoryTarget(text=>deriveRetiredStoryWitness({key:storyKey(8),text,budget,crypto,current}));
        if(!w?.digest){reason='witness-not-ready';return view();}witness=w;metadata();}
      if(!current()||!idle())return view();
      if(before==='ENTRY_DRAIN'){writer.withStoryTarget(text=>{pinnedStory=text;});context=null;pin=null;}
      if(before==='EPILOGUE_DRAIN'){const prior=retiredWriter?.drain(readNative,isPersistent);if(!prior?.ok){reason='final-story-not-persistent';return view();}}
      if(before==='DRAIN'&&index===4){retiredWriter=writer;writer=null;metadata();}
      else{writer.release();writer=null;}reason=null;if(!current()||!idle())return view();
      if(before==='OPEN_DRAIN'){state='PLAYING';bump('opens');}
      else if(before==='ENTRY_NAV_DRAIN')state='WAIT_CONFIRM';
      else if(before==='ENTRY_DRAIN'){state='OPEN_READY';}
      else if(before==='EPILOGUE_DRAIN'){retiredWriter.release();retiredWriter=null;releaseRaw();releaseContext();expectedSource=null;epilogue=null;if(!current())return view();state='DONE';}
      else{if(index===1)releaseRaw();else if(index!==4)raw=null;if(!current())return view();if(index===1){releaseContext();expectedSource=null;task=null;if(!current())return view();state='WAIT_CHAPTER9';}
        else if(index===4)state='EPILOGUE_READY';else{task=null;state='OPEN_READY';}}
    }catch{fail('drain-unverified');}finally{busy=false;}return view();
  }
  function stageEpilogue(done){if(state!=='DISPATCH'||index!==4||epilogue||typeof done!=='function')return fail('unexpected-epilogue');
    epilogue={id:++epoch,done};const id=epilogue.id;return ()=>finishEpilogue(id);}
  async function finishEpilogue(id){
    if(busy||readingIdentity||checkingStorage||state!=='EPILOGUE_READY'||epilogue?.id!==id||!current()||!idle())return view();
    busy=true;let done=null;
    try{
      if(!await beforeWitness({kind:'epilogue',id}))return view();
      const prior=retiredWriter?.drain(readNative,isPersistent);
      if(!prior?.ok){deferWitness({kind:'epilogue',id,needsStorage:prior?.reason==='persistence'},'final-story-not-persistent');return view();}
      if(!current()||!idle())return view();done=epilogue.done;epilogue.done=null;state='EPILOGUE';execute('epilogue',()=>{bump('done');done();});
      if(!invalidated)state='EPILOGUE_DRAIN';
    }catch{fail('epilogue-preparation-failed');}finally{done=null;busy=false;}return drain();
  }
  async function entryNavigation(original){
    if(busy||readingIdentity||checkingStorage||state!=='WAIT_CHAPTER9'||typeof original!=='function'||!current()||!idle())return view();
    busy=true;let incoming=null;
    try{if(!await beforeWitness({kind:"entry",original}))return view();index=2;reserveRaw();incoming=readItem(sourceKey(9));
      if(typeof incoming!=='string'||incoming.length*2>16384)C.fail('entry-source-limit');
      let initial=JSON.parse(incoming);
      if(!C.exact(initial,['version','n','phase','seed','seconds'])||initial.version!==1||initial.n!==9||initial.phase!==0||initial.seed!==config.baseSeeds[9]||initial.seconds!==0)C.fail('entry-source-invalid');
      initial=null;expectedSource=incoming;incoming=null;admitChapter(9);if(!current()||!idle())return view();
      risk=null;state='ENTRY_NAVIGATION';execute('entry-navigation',original);
      if(!invalidated&&!risk)fail('risk-dialog-missing');if(!invalidated)state='ENTRY_NAV_DRAIN';
    }catch{fail('entry-preparation-failed');}finally{incoming=null;busy=false;}return drain();
  }
  function stageRisk(input){
    if(!writerActive||state!=='ENTRY_NAVIGATION'||risk||!C.exact(input,['chapter','confirm','cancel'])||
      input.chapter!==9||typeof input.confirm!=='function'||typeof input.cancel!=='function'||!current())return fail('unexpected-risk-dialog');
    const id=++riskSerial;risk={id,confirm:input.confirm,cancel:input.cancel};
    return Object.freeze({confirm:()=>confirmEntry(id),cancel:()=>cancelEntry(id)});
  }
  async function confirmEntry(id){
    if(busy||readingIdentity||checkingStorage||state!=='WAIT_CONFIRM'||risk?.id!==id||!current()||!idle())return view();
    busy=true;let original=null;try{
      if(!await beforeWitness({kind:"confirm",id}))return view();original=risk.confirm;risk=null;
      budget.reserve('context-compare-read',132096);
      try{budget.allocate('context-compare-read',132096);if(readItem(sourceKey(9))!==expectedSource||!matchesContextText(context,readItem(storyKey(9))))C.fail('stale-entry');}
      finally{budget.release('context-compare-read',132096);}if(!current()||!idle())return view();state='ENTRY_CONFIRM';execute('entry-confirm',original);
      if(state!=='BLOCKED'&&!staged)fail('entry-descriptor-missing');if(state!=='BLOCKED')state='ENTRY_DRAIN';
    }catch{fail('entry-unverified');}finally{original=null;busy=false;}return drain();
  }
  function cancelEntry(id){
    const pendingConfirm=state==='WITNESS_RETRY'&&witnessPending?.kind==='confirm'&&witnessPending.id===id;
    if(busy||readingIdentity||checkingStorage||!(state==='WAIT_CONFIRM'||pendingConfirm)||risk?.id!==id||!current()||!idle())return view();
    busy=true;if(pendingConfirm){witnessPending=null;state='WAIT_CONFIRM';reason=null;}let original=risk.cancel;risk=null;
    try{original();if(!current()||!idle())return view();state='WAIT_CHAPTER9';index=1;releaseRaw();releaseContext();expectedSource=null;}catch{fail('risk-cancel-failed');}
    finally{original=null;busy=false;}return view();
  }
  async function retry(){if(busy||readingIdentity||checkingStorage)return view();bump('retries');
    if(state==='UNSAVED'){busy=true;return archivePhase();}
    if(state==='WITNESS_RETRY'){
      if(!current()||!idle()||!witnessPending)return view();const pending=witnessPending;
      if(pending.needsStorage){
        if(!quiet())return view();busy=true;retrying=true;
        try{retryStorage();}catch{reason='retry-storage-failed';}finally{retrying=false;busy=false;}
        if(!current()||!idle())return view();
      }
      witnessPending=null;state=pending.state;reason=null;
      if(pending.kind==='continue')return continueResult();if(pending.kind==='open')return openStaged();
      if(pending.kind==='entry')return entryNavigation(pending.original);if(pending.kind==='confirm')return confirmEntry(pending.id);
      if(pending.kind==='epilogue')return finishEpilogue(pending.id);return fail('unknown-pending-action'),view();
    }
    if(['DRAIN','OPEN_DRAIN','ENTRY_NAV_DRAIN','ENTRY_DRAIN','EPILOGUE_DRAIN'].includes(state)){
      if(!current()||!idle()||!quiet())return view();busy=true;retrying=true;
      try{retryStorage();}catch{reason='retry-storage-failed';}finally{retrying=false;busy=false;}return drain();}return view();}
  return Object.freeze({begin,view,initialEntry,stageTask,openStaged,write:writes,continue:continueResult,retry,drain,stageEpilogue,
    entryNavigation,stageRisk,invalidate:()=>{fail('observed-invalidation');return view();}});
}
