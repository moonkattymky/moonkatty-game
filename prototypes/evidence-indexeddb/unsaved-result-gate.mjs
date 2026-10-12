// SOURCE ONLY. Not imported by the game. Fixed local formats, no server authority.
import * as C from './contract.mjs';
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
