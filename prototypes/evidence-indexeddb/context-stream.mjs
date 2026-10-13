// SOURCE ONLY. Exact local archive transport; no gameplay continuation or authority.
import * as C from './contract.mjs';
import {CONTEXT_LIMIT,describeContext,copyContextRange,compareContextRange,matchesContextText} from './finale-context-v1.mjs';
import {admitFinalePhase,describeFinalePhaseDescriptor} from './finale-phase-v2.mjs';
import {PHASE_BUDGET,requirePhaseBudget} from './phase-budget.mjs';
const pins=new WeakMap(),HEAD=['version','binding','ordinal','total','root','sealed','token'];
const RECEIPT=['captureIdentity','ordinal','length','root','headToken','sealed','acknowledgement','durability'];
const RETRY=new Set(['busy','retry-pending','transaction-aborted','native-quota','logical-quota','open-blocked','open-timeout',
  'operation-timeout','terminal-unobserved','connection-closed','storage-unavailable','indexeddb-unavailable','webcrypto-unavailable',
  'webcrypto-sha256-unavailable','encoding-unavailable','insecure-context','unsupported-durability','transient-budget','allocation-refused']);
const RELEASED_RETRY=new Set(['transaction-aborted','native-quota','logical-quota']);
const errorCode=e=>{try{const p=Object.getOwnPropertyDescriptor(e,'message');return p&&Object.hasOwn(p,'value')&&typeof p.value==='string'?p.value:'';}catch{return '';}};
const bump=(s,k)=>{s[k]=Math.min(Number.MAX_SAFE_INTEGER,s[k]+1);};
const identityShape=v=>C.exact(v,['scope','generation','sourceIdentity','sourceText'])&&C.str(v.scope,128)&&v.scope.length>0&&
  C.int(v.generation)&&C.str(v.sourceIdentity,4096)&&v.sourceIdentity.length>0&&typeof v.sourceText==='string'&&v.sourceText.length*2<=16384;
function createStream({context,artifact,reference,coordinator,readContext,expectedContext,budget,crypto=globalThis.crypto},isPhase){
  budget=requirePhaseBudget(budget);
  if(!coordinator||!['appendSegment','retry','readSegments'].every(k=>typeof coordinator[k]==='function')||
    typeof readContext!=='function'||!identityShape(expectedContext)||budget.snapshot().reservations['phase-workspace']!==327680)C.fail('stream-capability');
  const description=describeContext(context),expected=Object.freeze({...expectedContext});
  if(description.descriptor.scope!==expected.scope)C.fail('scope-mismatch');
  let descriptor=description.descriptor,total=description.total,privateBytes=null,expectedSummary=null,admitted=null;
  if(isPhase){
    const pin=pins.get(reference);if(!pin||pin.context!==context||pin.scope!==expected.scope)C.fail('context-pin-unverified');
    if(!C.exact(artifact,['descriptor','bytes','summary']))C.fail('phase-artifact');
    C.boundedBytes(artifact.bytes,16384);const d=describeFinalePhaseDescriptor(artifact.descriptor);
    if(d.value.scope!==expected.scope||d.total!==artifact.bytes.length)C.fail('phase-artifact');
    budget.reserve('private-phase',d.total);
    try{
      budget.allocate('private-phase',d.total);privateBytes=new Uint8Array(d.total);Uint8Array.prototype.set.call(privateBytes,artifact.bytes);
      admitted=admitFinalePhase(privateBytes,d.value,context,reference,artifact.summary,budget);
      if(admitted.sourceText!==expected.sourceText)C.fail('phase-source-mismatch');
      descriptor=Object.freeze({...d.value,components:Object.freeze(d.value.components.map(p=>Object.freeze({...p})))});
      expectedSummary=admitted.summary;total=d.total;
    }catch(e){privateBytes=null;admitted=null;budget.release('private-phase',d.total);throw e;}
  }
  const segmentBytes=isPhase?16384:CONTEXT_LIMIT.page;
  let state='NEW',reason=null,phase='append',busy=false,reading=false,attempt=0,d=null,candidate=null,predicted=null,finalHead=null,ownedUnknown=false;
  let cursor={nextOrdinal:0,offset:0,previousRoot:C.ZERO,expectedHead:null},candidateReserved=0,verifiedPin=null;
  const stats={appendCalls:0,retryCalls:0,readCalls:0,hashCalls:0,candidateCopies:0,assemblies:0,admissions:isPhase?1:0,
    verifiedBytes:0,attempts:0,maxOutstanding:0};
  const helperBusy=()=>{const r=budget.snapshot().reservations;return !!(r['helper-framing']||r['helper-hash']);};
  function snapshot(override){return Object.freeze({state,reason:override||reason,phase,kind:isPhase?'phase':'context',
    busy:busy||reading||helperBusy(),retryEnabled:state==='UNSAVED'&&!busy&&!reading&&!helperBusy(),
    ready:state==='READY'&&!busy&&!reading&&!helperBusy(),ownedUnknown,cursor:Object.freeze({...cursor}),
    diagnostics:Object.freeze({...stats}),budget:budget.snapshot()});}
  function stale(){state='STALE';reason='stale-context';return false;}
  function current(){
    if(state==='STALE')return false;if(reading||helperBusy())C.fail('budget-lifetime');reading=true;
    let reserved=false;
    try{
      budget.reserve('context-compare-read',PHASE_BUDGET.helper);reserved=true;
      budget.allocate('context-compare-read',PHASE_BUDGET.helper);
      const live=readContext();
      if(!C.exact(live,['scope','generation','sourceIdentity','sourceText','storyText'])||live.scope!==expected.scope||
        live.generation!==expected.generation||live.sourceIdentity!==expected.sourceIdentity||
        typeof live.sourceText!=='string'||live.sourceText.length*2>16384||live.sourceText!==expected.sourceText||
        typeof live.storyText!=='string'||live.storyText.length*2>CONTEXT_LIMIT.story||!matchesContextText(context,live.storyText))return stale();
      return true;
    }catch(e){if(errorCode(e)==='budget-lifetime'||errorCode(e)==='transient-budget')throw e;return stale();}
    finally{if(reserved)budget.release('context-compare-read',PHASE_BUDGET.helper);reading=false;}
  }
  function view(){if(busy||reading||helperBusy())return snapshot('busy');if(state!=='NEW')current();return snapshot();}
  function block(code){if(state!=='STALE'){state='BLOCKED';reason=code;}return false;}
  function refuse(code){if(state==='STALE')return false;state=RETRY.has(code)?'UNSAVED':'BLOCKED';reason=code;return false;}
  const hashAccount={
    reserve(_name,n){budget.reserve('helper-framing',n);budget.allocate('helper-framing',n);},
    release(_name,n){budget.release('helper-framing',n);},
    reserveHash(n,text){const count=n*(text?2:1);budget.reserve('helper-hash',count);budget.allocate('helper-hash',count);},
    releaseHash(n,text){budget.release('helper-hash',n*(text?2:1));},hash(){bump(stats,'hashCalls');}
  };
  async function boundary(work,nonce,storage=false){
    if(nonce!==attempt||!current())C.fail('stale-context');
    try{const result=await work();if(storage&&result?.status==='outcomeUnknown')ownedUnknown=true;return result;}
    finally{if(nonce!==attempt||!current())C.fail('stale-context');}
  }
  function retained(){let n;try{n=coordinator.retainedBytes;}catch{C.fail('retry-capability');}
    if(!C.int(n)||n>C.LIMIT.request)C.fail('retry-capability');return n;}
  function ack(result){const r=result.receipt,h=result.currentHead,q=candidate;
    return result.contextCurrent===true&&C.exact(r,RECEIPT)&&C.exact(r.captureIdentity,['scope','run'])&&
      r.captureIdentity.scope===descriptor.scope&&r.captureIdentity.run===descriptor.run&&r.ordinal===q.ordinal&&
      r.length===q.payload.length&&r.root===predicted.root&&r.headToken===predicted.token&&r.sealed===predicted.sealed&&
      r.acknowledgement==='idb-transaction-complete'&&r.durability==='strict'&&C.exact(h,HEAD)&&HEAD.every(k=>h[k]===predicted[k]);}
  function releaseCandidate(){candidate=null;predicted=null;if(candidateReserved){budget.release('stream-candidate',candidateReserved);candidateReserved=0;}}
  async function prepare(nonce){
    if(candidate&&predicted)return;
    if(!candidate){
      const end=Math.min(total,cursor.offset+segmentBytes);let payload;
      if(isPhase)payload=Uint8Array.prototype.subarray.call(privateBytes,cursor.offset,end);
      else{payload=copyContextRange(context,cursor.offset,end-cursor.offset,budget);candidateReserved=payload.length;bump(stats,'candidateCopies');}
      candidate=Object.freeze({descriptor,expectedHead:cursor.expectedHead,ordinal:cursor.nextOrdinal,offset:cursor.offset,previousRoot:cursor.previousRoot,payload});
    }
    const root=await boundary(()=>C.chain(d,candidate,candidate.payload,crypto,hashAccount),nonce);
    const end=candidate.offset+candidate.payload.length;
    predicted=Object.freeze(await boundary(()=>C.makeHead(d,candidate.ordinal,end,root,end===total,crypto,hashAccount),nonce));
    if(end===total)candidate=Object.freeze({...candidate,seal:Object.freeze({totalBytes:end,root})});
  }
  async function verify(nonce){
    state='VERIFYING';phase='verify';reason=null;
    if(ownedUnknown||retained()!==0||!finalHead?.sealed||finalHead.total!==total||finalHead.binding!==d.binding||
      finalHead.ordinal+1!==Math.ceil(total/segmentBytes))return block('head-mismatch');
    const decoded=await boundary(()=>C.headToken(finalHead.token,crypto,hashAccount),nonce);
    if(!['binding','ordinal','total','root','sealed'].every(k=>decoded[k]===finalHead[k]))return block('head-mismatch');
    let ordinal=0,offset=0,root=C.ZERO,assembly=null,assemblyHeld=false;
    try{
      if(isPhase){budget.reserve('phase-assembly',total);assemblyHeld=true;budget.allocate('phase-assembly',total);assembly=new Uint8Array(total);bump(stats,'assemblies');}
      while(offset<total){
        const length=Math.min(segmentBytes,total-offset),query={captureIdentity:{scope:descriptor.scope,run:descriptor.run},throughHead:finalHead.token,afterOrdinal:ordinal-1,maxBytes:segmentBytes};
        budget.reserve('returned-page',segmentBytes);
        try{
          budget.allocate('returned-page',segmentBytes);bump(stats,'readCalls');
          const page=await boundary(()=>coordinator.readSegments(query),nonce);
          if(page?.status!=='page')return refuse(RETRY.has(page?.reason)?page.reason:'storage-refused');
          if(!C.exact(page,['status','segments','payloadBytes','throughHead','nextCursor'])||page.throughHead!==finalHead.token||
            !Array.isArray(page.segments)||Object.getPrototypeOf(page.segments)!==Array.prototype||page.segments.length!==1||
            Reflect.ownKeys(page.segments).length!==2||!Object.getOwnPropertyDescriptor(page.segments,'0')?.value) return block('readback-mismatch');
          const s=page.segments[0];if(!C.exact(s,['ordinal','offset','length','root','payload'])||s.ordinal!==ordinal||s.offset!==offset||
            s.length!==length||page.payloadBytes!==length||!C.hex(s.root))return block('readback-mismatch');
          C.boundedBytes(s.payload,segmentBytes);if(s.payload.length!==length)return block('readback-mismatch');
          const last=offset+length===total;
          if(last?page.nextCursor!==null:!C.exact(page.nextCursor,['captureIdentity','throughHead','afterOrdinal'])||
            !C.exact(page.nextCursor.captureIdentity,['scope','run'])||page.nextCursor.captureIdentity.scope!==descriptor.scope||
            page.nextCursor.captureIdentity.run!==descriptor.run||page.nextCursor.throughHead!==finalHead.token||page.nextCursor.afterOrdinal!==ordinal)return block('readback-mismatch');
          const computed=await boundary(()=>C.chain(d,{ordinal,offset,previousRoot:root},s.payload,crypto,hashAccount),nonce);
          if(computed!==s.root||last&&s.root!==finalHead.root)return block('readback-mismatch');
          if(isPhase){for(let i=0;i<length;i++)if(s.payload[i]!==privateBytes[offset+i])return block('readback-mismatch');assembly.set(s.payload,offset);}
          else if(!compareContextRange(context,offset,s.payload))return block('readback-mismatch');
          root=s.root;offset+=length;ordinal++;stats.verifiedBytes=offset;
        }finally{budget.release('returned-page',segmentBytes);}
      }
      if(offset!==total||ordinal!==finalHead.ordinal+1||root!==finalHead.root)return block('readback-mismatch');
      if(isPhase){admitted=admitFinalePhase(assembly,descriptor,context,reference,expectedSummary,budget);bump(stats,'admissions');}
      if(!current())return false;state='READY';reason=null;return true;
    }finally{assembly=null;if(assemblyHeld)budget.release('phase-assembly',total);}
  }
  async function run(nonce){
    try{
      if(!d)d=await boundary(()=>C.descriptor(descriptor,crypto,hashAccount),nonce);
      if(phase==='verify'){await verify(nonce);return;}
      while(cursor.offset<total){
        if(!current())return;state='SAVING';reason=null;await prepare(nonce);if(!current())return;
        const retrying=ownedUnknown;bump(stats,retrying?'retryCalls':'appendCalls');
        const result=await boundary(()=>retrying?coordinator.retry():coordinator.appendSegment(candidate,expected),nonce,true);
        if(!result||typeof result!=='object')return block('storage-result-invalid');
        if(result.contextCurrent===false||result.reason==='stale-context')return stale();
        if(result.status==='outcomeUnknown'){
          ownedUnknown=true;if(retained()===0)return block('retry-capability');state='UNSAVED';reason='terminal-unobserved';return;
        }
        if(result.status==='committed'||result.status==='duplicate'){
          if(!ack(result))return block('acknowledgement-mismatch');
          if(retained()!==0)return block('retry-capability');ownedUnknown=false;
          cursor={nextOrdinal:candidate.ordinal+1,offset:candidate.offset+candidate.payload.length,previousRoot:predicted.root,expectedHead:predicted.token};
          finalHead=predicted;releaseCandidate();
        }else{
          if(retrying){
            if(result.reason==='no-retry')return block('retry-capability');const retainedNow=retained()>0;
            if(result.status==='refused'&&RETRY.has(result.reason)&&retainedNow===RELEASED_RETRY.has(result.reason))return block('retry-capability');ownedUnknown=retainedNow;
          }
          if(result.status==='conflict')return block('storage-conflict');
          if(result.status!=='refused')return block('storage-result-invalid');return refuse(RETRY.has(result.reason)?result.reason:'storage-refused');
        }
      }
      phase='verify';await verify(nonce);
    }catch(e){if(state!=='STALE'){const code=errorCode(e);if(e instanceof RangeError)refuse('allocation-refused');else if(RETRY.has(code))refuse(code);else block(['budget-lifetime','allocation-unreserved','retry-capability','readback-mismatch','finale-phase-admission','finale-phase-limit'].includes(code)?code:'storage-refused');}}
    finally{busy=false;}
  }
  function start(){if(attempt===Number.MAX_SAFE_INTEGER){block('attempt-limit');return Promise.resolve(snapshot());}
    busy=true;attempt++;bump(stats,'attempts');stats.maxOutstanding=1;return run(attempt).then(()=>view());}
  function save(){if(busy||reading||helperBusy())return Promise.resolve(snapshot('busy'));if(state!=='NEW')return Promise.resolve(view());return start();}
  function retry(){if(busy||reading||helperBusy())return Promise.resolve(snapshot('busy'));if(state!=='UNSAVED')return Promise.resolve(view());return start();}
  function getReference(){if(isPhase)C.fail('context-pin-unavailable');const v=view();if(!v.ready)C.fail('context-pin-unavailable');
    if(!verifiedPin){verifiedPin=Object.freeze({version:1,scope:descriptor.scope,run:descriptor.run,binding:d.binding,throughHead:finalHead.token});pins.set(verifiedPin,{context,scope:descriptor.scope});}return verifiedPin;}
  return Object.freeze({save,retry,view,...(!isPhase?{reference:getReference}:{})});
}
export const createContextStream=options=>createStream(options,false);
export const createPhaseStream=options=>createStream(options,true);
