// SOURCE ONLY. Canonical state for ONE fixed disposable guest chapter-9 phase-2
// command. Sealed dependencies share this adapter/database and are never deleted.
// This is not a mutable owner/run CAS, real account settlement, migration, or a
// production bootstrap. No legacy completion/award callback is accepted or run.
import * as C from './contract.mjs';
import * as FieldModule from '../../field-model.js';
import {freezeFinaleData,measureFinaleData,finaleSession,describeContext} from './finale-context-v1.mjs';
import {describeFinalePhaseDescriptor} from './finale-phase-v2.mjs';
import {requirePhaseBudget} from './phase-budget.mjs';
import {recoverFinaleContext,recoverFinaleContextAndPhase} from './context-reload.mjs';
import {ATOMIC_CONTRACT,ATOMIC_REWARD,projectAtomicTerminal,validateAtomicBaseline,validateAtomicTimestamps} from './atomic-terminal-projection.mjs';
export {ATOMIC_CONTRACT,ATOMIC_REWARD};
const Field=FieldModule.default||globalThis.FieldRules;
export const ATOMIC_LIMIT=Object.freeze({record:16384,retained:32768,recordWorkspace:65536});
const HEAD=['version','binding','ordinal','total','root','sealed','token'];
const MANIFEST=['version','contract','principal','scope','session','contextPin','source','gameContext','baseline','entry'];
const COMMAND=['version','contract','principal','scope','session','chapter','phase','adoptionPin','contextPin','phasePin','timestamps','result'];
const INPUTS=['version','contract','principal','scope','session','chapter','phase','adoptionPin','contextPin','phasePin'];
const RETRY=new Set(['busy','retry-pending','transaction-aborted','native-quota','logical-quota','open-blocked','open-timeout',
  'operation-timeout','terminal-unobserved','connection-closed','storage-unavailable','indexeddb-unavailable','webcrypto-unavailable',
  'webcrypto-sha256-unavailable','encoding-unavailable','insecure-context','unsupported-durability','allocation-refused']);
const fail=reason=>C.fail(reason||'atomic-admission');
// Exact ordinary-data comparison without serializing two whole records. Inputs
// are bounded/admitted before comparison; property order remains part of identity.
function equal(a,b){if(Object.is(a,b))return true;if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
  const ka=Object.keys(a),kb=Object.keys(b);return ka.length===kb.length&&ka.every((k,i)=>k===kb[i]&&equal(a[k],b[k]));}
const identity=(scope,session,principal)=>C.str(scope,128)&&scope.length>0&&finaleSession(session)&&
  typeof principal==='string'&&/^guest:[a-zA-Z0-9_-]{1,64}$/.test(principal);
const runFor=(kind,session)=>kind==='adoption'?`fown1:${session}`:`fcommit1:${session}:9:2`;
const modelFor=kind=>kind==='adoption'?'atomic-adoption-v1':'atomic-terminal-v1';
function bounded(value,bytes=ATOMIC_LIMIT.record-20){measureFinaleData([value],bytes,{restrictedKeys:true});return value;}
function frozenCopy(value,bytes=ATOMIC_LIMIT.record-20){bounded(value,bytes);return freezeFinaleData(JSON.parse(JSON.stringify(value)));}
function scaffold(budget,stage,values,limit=32768){
  // Fixed control/head-token scratch is4096; every variable descriptor/pin graph
  // and descriptor text listed here is conservatively counted independently.
  const bytes=measureFinaleData(values,limit-4096,{restrictedKeys:true})+4096;
  budget.allocate('metadata',limit);budget.event('atomic-scaffold',{stage,bytes,limit});
}
function pinShape(pin){
  if(!C.exact(pin,['descriptor','head'])||!C.exact(pin.head,HEAD))fail('atomic-pin');
  const d=C.describe(pin.descriptor),h=pin.head;
  if(h.version!==1||!C.hex(h.binding)||!C.hex(h.root)||h.sealed!==true||!C.int(h.ordinal)||h.total!==d.total||!C.str(h.token,2048))fail('atomic-pin');
  bounded(pin,4096);return pin;
}
function releaseOwned(budget,label,before){const n=budget.snapshot().reservations[label]-before;if(n>0)budget.release(label,n);}
function reserveAllocated(budget,label,n){const before=budget.snapshot().reservations[label];
  try{budget.reserve(label,n);budget.allocate(label,n);}catch(error){try{releaseOwned(budget,label,before);}catch{}throw error;}}
function copyRecord(value,budget,bytes=ATOMIC_LIMIT.record-20){
  reserveAllocated(budget,'atomic-record-workspace',ATOMIC_LIMIT.recordWorkspace);
  try{return frozenCopy(value,bytes);}finally{budget.release('atomic-record-workspace',ATOMIC_LIMIT.recordWorkspace);}
}
async function workspace(budget,label,n,work){const before=budget.snapshot().reservations[label];let error;
  try{reserveAllocated(budget,label,n);return await work();}catch(e){error=e;throw e;}
  finally{try{releaseOwned(budget,label,before);}catch(e){if(!error)throw e;}}}
function hashAccount(budget){return {
  reserve(_label,n){reserveAllocated(budget,'helper-framing',n);},
  release(_label,n){budget.release('helper-framing',n);},
  reserveHash(n,text){reserveAllocated(budget,'helper-hash',n*(text?2:1));},
  releaseHash(n,text){budget.release('helper-hash',n*(text?2:1));},hash(){}
};}
async function verifyPin(pin,budget,crypto){
  pinShape(pin);const account=hashAccount(budget);scaffold(budget,'pin-before-hash',[pin,pin.descriptor,pin.descriptor]);
  const d=await C.descriptor(pin.descriptor,crypto,account);scaffold(budget,'pin-authenticated',[pin,d,d]);
  const h=await C.headToken(pin.head.token,crypto,account);
  if(d.binding!==pin.head.binding||!['binding','ordinal','total','root','sealed'].every(k=>h[k]===pin.head[k]))fail('atomic-pin');return d;
}
function requireStorage(result,status){if(!result||result.status!==status)fail(result?.reason||'atomic-storage-result');return result;}
// Owner-specific four-run catalog admission; the adapter's128-capture ceiling
// is unchanged. Foreign captures are refused intact, never treated as empty.
// A missing capture is not proof of an empty/unowned legacy game.
export async function findAtomicCapture(adapter,scope,run,budget,crypto=globalThis.crypto){
  requirePhaseBudget(budget);
  const session=/^(?:fc1|fp2|fown1|fcommit1):([a-f0-9]{32})(?::9(?::2)?)?$/.exec(run)?.[1];
  if(!session)fail('atomic-capture-identity');
  const allowed=new Set([`fc1:${session}:9`,`fp2:${session}:9:2`,runFor('adoption',session),runFor('terminal',session)]);
  if(!allowed.has(run))fail('atomic-capture-identity');
  let cursor=null,found=null,pages=0,watermark=null,count=0;const seen=new Set(),cursors=new Set();
  do{
    if(++pages>4)fail('atomic-recovery-loop');reserveAllocated(budget,'returned-page',ATOMIC_LIMIT.record);
    try{
      const page=requireStorage(await adapter.recover({scope,cursor,maxHeads:1,maxBytes:ATOMIC_LIMIT.record}),'page');
      if(!C.exact(page,['status','heads','watermark','nextCursor'])||!Array.isArray(page.heads)||page.heads.length>1||!C.int(page.watermark)||page.watermark>C.LIMIT.captures||
        page.nextCursor!==null&&!C.str(page.nextCursor,2048))fail('atomic-recovery-page');
      if(page.watermark>4)fail('atomic-scope-not-isolated');
      if(watermark===null)watermark=page.watermark;else if(watermark!==page.watermark)fail('atomic-recovery-page');
      if(page.heads.length!==(watermark===0?0:1)||watermark===0&&(pages!==1||page.nextCursor!==null))fail('atomic-recovery-page');
      for(const item of page.heads){
        if(!C.exact(item,['captureIdentity','descriptor','head','sealed','acknowledgement','durability'])||
          !C.exact(item.captureIdentity,['scope','run'])||item.captureIdentity.scope!==scope||item.descriptor.scope!==scope||
          item.captureIdentity.run!==item.descriptor.run||item.sealed!==item.head.sealed||item.acknowledgement!=='idb-transaction-complete'||item.durability!=='strict')fail('atomic-recovery-page');
        if(!allowed.has(item.captureIdentity.run))fail('atomic-scope-not-isolated');
        if(seen.has(item.captureIdentity.run))fail('atomic-duplicate-identity');seen.add(item.captureIdentity.run);count++;
        if(count>watermark)fail('atomic-recovery-page');
        if(item.captureIdentity.run===run){if(found)fail('atomic-duplicate-identity');found=frozenCopy({descriptor:item.descriptor,head:item.head},4096);}
      }
      if(page.nextCursor!==null){if(cursors.has(page.nextCursor)||count>=watermark)fail('atomic-recovery-loop');cursors.add(page.nextCursor);}
      else if(count!==watermark)fail('atomic-recovery-page');
      scaffold(budget,'catalog',[{scope,run,cursor},[...seen],[...cursors],found,page.heads]);cursor=page.nextCursor;
    }finally{budget.release('returned-page',ATOMIC_LIMIT.record);}
  }while(cursor!==null);
  if(found)await verifyPin(found,budget,crypto);return found;
}
function recordDescriptor(kind,scope,session,length){return {format:C.FORMAT,scope,run:runFor(kind,session),kind:kind==='adoption'?'fixed-guest-adoption':'canonical-local-completion',
  model:modelFor(kind),components:[{name:kind,encoding:'utf16le',length}],note:''};}
function validateRecordDescriptor(pin,kind,scope,session){
  pinShape(pin);const d=pin.descriptor,part=d.components[0];
  if(d.run!==runFor(kind,session)||d.scope!==scope||d.kind!==(kind==='adoption'?'fixed-guest-adoption':'canonical-local-completion')||d.model!==modelFor(kind)||d.note!==''||
    d.components.length!==1||part.name!==kind||part.encoding!=='utf16le'||part.length<2||part.length%2||pin.head.ordinal!==0||pin.head.total>ATOMIC_LIMIT.record)fail('atomic-record-format');
}
async function readRecord(adapter,pin,kind,scope,session,budget,crypto,accept=()=>{}){
  validateRecordDescriptor(pin,kind,scope,session);const d=await verifyPin(pin,budget,crypto);scaffold(budget,'record-read',[pin,d,d]);
  return workspace(budget,'atomic-record-workspace',ATOMIC_LIMIT.recordWorkspace,async()=>{
    let bytes=null;
    await workspace(budget,'returned-page',ATOMIC_LIMIT.record,async()=>{
      let page=requireStorage(await adapter.readSegments({captureIdentity:{scope,run:pin.descriptor.run},throughHead:pin.head.token,afterOrdinal:-1,maxBytes:ATOMIC_LIMIT.record}),'page');
      if(!C.exact(page,['status','segments','payloadBytes','throughHead','nextCursor'])||page.throughHead!==pin.head.token||page.nextCursor!==null||
        !Array.isArray(page.segments)||page.segments.length!==1)fail('atomic-record-readback');
      let s=page.segments[0];if(!C.exact(s,['ordinal','offset','length','root','payload'])||s.ordinal!==0||s.offset!==0||s.length!==d.total||page.payloadBytes!==d.total||s.root!==pin.head.root)fail('atomic-record-readback');
      C.boundedBytes(s.payload,ATOMIC_LIMIT.record);if(s.payload.length!==d.total)fail('atomic-record-readback');
      bytes=new Uint8Array(s.payload.length);bytes.set(s.payload);s=null;page=null;
    });
    // No returned-page object, segment or payload alias crosses the digest await.
    if(await C.chain(d,{ordinal:0,offset:0,previousRoot:C.ZERO},bytes,crypto,hashAccount(budget))!==pin.head.root)fail('atomic-record-readback');
    const parts=C.unframe(bytes,pin.descriptor);let record;
    try{record=JSON.parse(parts[0].text);}catch{fail('atomic-record-json');}bounded(record);
    if(JSON.stringify(record)!==parts[0].text)fail('atomic-record-noncanonical');
    freezeFinaleData(record);return accept(record)||record;
  });
}
function validateGameContext(value){
  bounded(value,4096);
  if(!C.exact(value,['legacy','precision','modifiers'])||!C.exact(value.legacy,['version','lead','airlock','echo','decodeNoise','events'])||
    !C.exact(value.precision,['count','total']))fail('atomic-game-context');
  const l=value.legacy,p=value.precision;
  if(l.version!==1||![null,'navigator','engineer','scout'].includes(l.lead)||![null,'crew','cargo'].includes(l.airlock)||
    ![null,'answer','silent'].includes(l.echo)||l.decodeNoise!==null&&!Number.isFinite(l.decodeNoise)||!l.events||Object.getPrototypeOf(l.events)!==Object.prototype||
    !C.int(p.count)||!C.int(p.total)||p.count>p.total||p.total>64)fail('atomic-game-context');
  const allowed={1:['scan','antenna'],3:['shield','record'],4:['north','south'],5:['vent','keep'],6:['clear','tow'],7:['rescue','hide'],9:['wait','go']};
  if(Object.entries(l.events).some(([n,c])=>!allowed[n]?.includes(c)))fail('atomic-game-context');
  const m={};if(l.lead==='navigator')m.preview=1;
  let stability=Math.min(20,p.count*2);if(l.airlock==='cargo')stability+=10;if(stability)m.stability=stability;
  if(l.echo==='answer')m.charges=1;
  const add=(k,n,max)=>{m[k]=Math.min(max,(m[k]||0)+n);};
  if(l.events[3]==='record')add('stability',5,40);if(l.events[7]==='rescue')add('stability',5,40);if(l.events[9]==='wait')add('stability',5,40);if(l.events[7]==='hide')add('charges',1,3);
  if(!equal(Field.cleanMods(value.modifiers),value.modifiers)||!equal(Field.cleanMods(m),value.modifiers))fail('atomic-modifier-mismatch');
}
function validateManifest(value,scope,session,principal){
  bounded(value);if(!C.exact(value,MANIFEST)||value.version!==1||value.contract!==ATOMIC_CONTRACT||value.scope!==scope||value.session!==session||value.principal!==principal)fail('atomic-manifest');
  const e=value.entry;
  if(!C.exact(e,['origin','accountScope','initData','pendingQueueText'])||e.origin!=='new-disposable-guest'||e.accountScope!=='guest'||e.initData!==''||e.pendingQueueText!==null)fail('atomic-adoption-refused');
  pinShape(value.contextPin);const d=value.contextPin.descriptor;
  if(d.scope!==scope||d.run!==`fc1:${session}:9`||d.model!=='finale-chapter-context-v1')fail('atomic-context-mismatch');
  const s=value.source;if(!C.exact(s,['version','n','phase','seed','seconds'])||s.version!==1||s.n!==9||s.phase!==2||
    !Number.isInteger(s.seed)||s.seed<0||s.seed>0xffffffff||!Number.isFinite(s.seconds)||s.seconds<0||Object.is(s.seconds,-0))fail('atomic-source');
  validateAtomicBaseline(value.baseline);if(value.baseline.completedAt!==null)fail('atomic-adoption-refused');validateGameContext(value.gameContext);return value;
}
function validatePhasePin(pin,scope,session){pinShape(pin);describeFinalePhaseDescriptor(pin.descriptor);
  if(pin.descriptor.scope!==scope||pin.descriptor.run!==`fp2:${session}:9:2`)fail('atomic-phase-mismatch');}
function matchDependencies(manifest,lease,budget){
  const s=describeContext(lease.context).summary,m=manifest.source;
  if(s.chapter!==9||s.baseSeed!==m.seed||s.session!==manifest.session||s.route!=='spatial-finale')fail('atomic-context-mismatch');
  if(!lease.phase)return;
  reserveAllocated(budget,'atomic-record-workspace',ATOMIC_LIMIT.recordWorkspace);
  try{
  const p=lease.phase,b=p.binding,source=JSON.parse(p.sourceText),g=manifest.gameContext;bounded(source,16384);
  if(!['version','n','phase','seed','seconds'].every(k=>Object.is(source[k],m[k]))||b.chapter!==9||b.phase!==2||b.mechanic!==11||
    b.baseSeed!==m.seed||b.seed!==((m.seed+2*7919)>>>0)||!equal(p.checkpoint.mods,g.modifiers)||
    !equal(b.provenance.legacyAtCapture,g.legacy)||!equal(b.provenance.precisionAtCapture,g.precision))fail('atomic-command-mismatch');
  }finally{budget.release('atomic-record-workspace',ATOMIC_LIMIT.recordWorkspace);}
}
function resultSummary(projection){return {coreSeconds:projection.coreSeconds,addedSeconds:projection.addedSeconds,reward:projection.reward,presentation:projection.presentation};}
function immutableMatch(a,b){return INPUTS.every(k=>equal(a[k],b[k]));}
function validateCommand(value,manifest,adoptionPin,scope,session,principal){
  bounded(value);if(!C.exact(value,COMMAND)||value.version!==1||value.contract!==ATOMIC_CONTRACT||value.principal!==principal||value.scope!==scope||value.session!==session||
    value.chapter!==9||value.phase!==2||!equal(value.adoptionPin,adoptionPin)||!equal(value.contextPin,manifest.contextPin))fail('atomic-command-mismatch');
  validatePhasePin(value.phasePin,scope,session);validateAtomicTimestamps(value.timestamps);bounded(value.result,4096);return value;
}
export function createAtomicTerminalOwner({adapter,scope,session,principal,budget,crypto=globalThis.crypto}){
  requirePhaseBudget(budget);if(!identity(scope,session,principal))fail('atomic-principal');
  if(!adapter||!['appendSegment','retry','readSegments','recover'].every(k=>typeof adapter[k]==='function')||adapter.scope!==scope)fail('atomic-adapter');
  reserveAllocated(budget,'atomic-retained',ATOMIC_LIMIT.retained);
  let state='NEW',reason=null,busy=false,disposed=false,manifest=null,adoptionPin=null,phasePin=null,terminalPin=null,projection=null,lease=null;
  let pending=null,pendingKind=null,unknown=false,committedPin=null,proposalPin=null,incomingRecord=null,projectionHeld=false;
  function account(...incoming){
    const small=projection?{...('reward' in projection?resultSummary(projection):{}),gameContext:projection.gameContext,
      values:Object.fromEntries(Object.entries(projection.values).filter(([k])=>k!=='mkty_story_plan_9_v1'))}:null;
    measureFinaleData([manifest,adoptionPin,phasePin,terminalPin,pending,committedPin,proposalPin,incomingRecord,small,...incoming],ATOMIC_LIMIT.retained,{restrictedKeys:true});
    budget.allocate('atomic-retained',ATOMIC_LIMIT.retained);budget.event('atomic-retained-state',{bytes:measureFinaleData([manifest,adoptionPin,phasePin,terminalPin,pending,committedPin,proposalPin,incomingRecord,small,...incoming],ATOMIC_LIMIT.retained,{restrictedKeys:true}),limit:ATOMIC_LIMIT.retained});
  }
  function acceptRecord(record){incomingRecord=record===pending||record===manifest?null:record;account();return record;}
  function acceptWinner(kind,record){
    if(kind==='adoption'){if(!equal(record,manifest))fail('atomic-command-conflict');incomingRecord=null;account();return manifest;}
    validateCommand(record,manifest,adoptionPin,scope,session,principal);
    if(!pending||!immutableMatch(record,pending))fail('atomic-command-conflict');
    // The losing proposal is reachable only through pending at this boundary.
    // Replace it while the decoded winner is still covered by record-workspace.
    pending=record;incomingRecord=null;account();return record;
  }
  function view(){return Object.freeze({state,reason,busy,retryEnabled:state==='UNSAVED'&&!busy,continueEnabled:state==='READY'&&!busy,
    manifest,phasePin,terminalPin,projection,budget:budget.snapshot()});}
  function releaseProjection(){projection=null;let error;const old=lease;lease=null;
    try{old?.dispose();}catch(e){error=e;}
    if(projectionHeld){projectionHeld=false;try{budget.release('post-target',65536);}catch(e){error??=e;}}if(error)throw error;}
  function project(dependencies,record){
    if(projectionHeld){projection=null;budget.release('post-target',65536);projectionHeld=false;}
    reserveAllocated(budget,'post-target',65536);projectionHeld=true;
    const p=projectAtomicTerminal({storyText:dependencies.storyText,sourceSeconds:manifest.source.seconds,phaseSeconds:dependencies.phase.summary.seconds,
      baseline:manifest.baseline,timestamps:record.timestamps},budget);
    projection=freezeFinaleData({...p,gameContext:manifest.gameContext});account();return projection;
  }
  async function dependencies(pin=null){
    scaffold(budget,'dependency-caller',[{scope,session,principal,state,pendingKind,unknown}],8192);
    const d=pin?await recoverFinaleContextAndPhase({adapter,contextPin:manifest.contextPin,phasePin:pin,budget,crypto}):
      await recoverFinaleContext({adapter,contextPin:manifest.contextPin,budget,crypto});
    try{matchDependencies(manifest,d,budget);return d;}catch(error){d.dispose();throw error;}
  }
  async function hydrate(record=null){
    releaseProjection();lease=await dependencies(record?.phasePin||phasePin);
    if(record){
      validateCommand(record,manifest,adoptionPin,scope,session,principal);
      try{project(lease,record);if(!equal(resultSummary(projection),record.result))fail('atomic-projection-mismatch');}
      finally{lease.dispose();lease=null;}
      state='READY';reason=null;pending=null;pendingKind=null;incomingRecord=null;account();return;
    }
    const b=manifest.baseline;
    projection=freezeFinaleData({storyText:lease.storyText,values:{mkty_story_plan_9_v1:lease.storyText,mkty_field_finale_9_v1:JSON.stringify(manifest.source),
      mkty_operations_9_v1:b.operationsText,mkty_points:String(b.points),mkty_life9:b.life,mkty_life9_awarded:b.awarded,
      mkty_life9_completed_at:b.completedAt===null?null:String(b.completedAt),mkty_final_moon_points:b.finalPoints,mkty_points_locked_at:b.lockedAt},gameContext:manifest.gameContext});
    state='ADOPTED';reason=null;pending=null;pendingKind=null;incomingRecord=null;account();
  }
  async function stored(kind,accept=acceptRecord){const pin=await findAtomicCapture(adapter,scope,runFor(kind,session),budget,crypto);
    return pin?{pin,value:await readRecord(adapter,pin,kind,scope,session,budget,crypto,accept)}:null;}
  function receiptMatches(result,pin){const r=result.receipt,h=result.currentHead;
    return r?.acknowledgement==='idb-transaction-complete'&&r.durability==='strict'&&r.captureIdentity?.scope===scope&&r.captureIdentity.run===pin.descriptor.run&&
      r.ordinal===0&&r.length===pin.head.total&&r.root===pin.head.root&&r.headToken===pin.head.token&&r.sealed===true&&C.exact(h,HEAD)&&HEAD.every(k=>h[k]===pin.head[k]);}
  async function persist(kind){
    const accept=record=>acceptWinner(kind,record);
    if(!unknown&&!committedPin){const previous=await stored(kind,accept);if(previous)return previous;}
    let proposed=proposalPin||committedPin,result;
    if(!committedPin){
      if(unknown){result=await adapter.retry();}
      else{
        if(adapter.retainedBytes)fail('retry-pending');
        reserveAllocated(budget,'atomic-record-workspace',ATOMIC_LIMIT.recordWorkspace);
        try{
          bounded(kind==='adoption'?manifest:pending);const text=JSON.stringify(kind==='adoption'?manifest:pending);
          const artifact=C.frame([{name:kind,encoding:'utf16le',text}]);if(artifact.bytes.length>ATOMIC_LIMIT.record)fail('atomic-record-limit');
          const descriptor=recordDescriptor(kind,scope,session,text.length*2),d=await C.descriptor(descriptor,crypto,hashAccount(budget));
          const q={descriptor,expectedHead:null,ordinal:0,offset:0,previousRoot:C.ZERO,payload:artifact.bytes};
          const root=await C.chain(d,q,q.payload,crypto,hashAccount(budget)),head=await C.makeHead(d,0,q.payload.length,root,true,crypto,hashAccount(budget));
          proposed=frozenCopy({descriptor,head},4096);proposalPin=proposed;account();scaffold(budget,'append',[descriptor,d,proposed]);
          result=await adapter.appendSegment({...q,seal:{totalBytes:q.payload.length,root}});
        }finally{budget.release('atomic-record-workspace',ATOMIC_LIMIT.recordWorkspace);}
      }
      if(result?.status==='outcomeUnknown'){
        if(!adapter.retainedBytes)fail('atomic-retry-capability');unknown=true;proposalPin=proposed;committedPin=null;fail('terminal-unobserved');
      }
      if(result?.status==='committed'||result?.status==='duplicate'){
        proposed=proposed||proposalPin;if(!receiptMatches(result,proposed)||adapter.retainedBytes)fail('atomic-acknowledgement');unknown=false;committedPin=proposed;proposalPin=null;
      }else if(result?.status==='conflict'){
        unknown=false;committedPin=null;proposalPin=null;const winner=await stored(kind,accept);if(!winner)fail('atomic-command-conflict');return winner;
      }else{
        if(unknown){unknown=adapter.retainedBytes>0;if(!unknown){committedPin=null;proposalPin=null;}}else {committedPin=null;proposalPin=null;}
        fail(result?.reason||'atomic-storage-result');
      }
    }
    const valueRead=await readRecord(adapter,committedPin,kind,scope,session,budget,crypto,accept);
    const pin=committedPin;committedPin=null;return {pin,value:valueRead};
  }
  async function adoption(value){
    releaseProjection();manifest=validateManifest(value,scope,session,principal);account();
    lease=await dependencies();lease.dispose();lease=null;
    const saved=await persist('adoption');manifest=saved.value;adoptionPin=saved.pin;incomingRecord=null;validateManifest(manifest,scope,session,principal);account();
    const terminal=await stored('terminal');if(terminal){terminalPin=terminal.pin;phasePin=terminal.value.phasePin;await hydrate(terminal.value);}
    else{phasePin=await findAtomicCapture(adapter,scope,`fp2:${session}:9:2`,budget,crypto);await hydrate();}
  }
  async function submission(){
    if(!manifest||!adoptionPin)fail('atomic-not-adopted');releaseProjection();
    validateCommand(pending,manifest,adoptionPin,scope,session,principal);phasePin=pending.phasePin;account();
    lease=await dependencies(phasePin);
    try{const p=project(lease,pending);if(!equal(resultSummary(p),pending.result))fail('atomic-projection-mismatch');}
    finally{lease.dispose();lease=null;}
    const saved=await persist('terminal');terminalPin=saved.pin;validateCommand(saved.value,manifest,adoptionPin,scope,session,principal);
    await hydrate(saved.value);
  }
  async function execute(work){
    if(disposed)return view();if(busy)return view();busy=true;state='SAVING';reason=null;
    try{await work();}catch(error){incomingRecord=null;reason=error instanceof RangeError?'allocation-refused':error?.message||'atomic-storage-result';state=RETRY.has(reason)?'UNSAVED':'BLOCKED';}
    finally{
      if(state!=='ADOPTED'&&lease){if(!projectionHeld)projection=null;const old=lease;lease=null;try{old.dispose();}catch(e){reason??=e?.message||'atomic-cleanup';state='BLOCKED';}}
      if(projectionHeld&&!projection){projectionHeld=false;try{budget.release('post-target',65536);}catch(e){reason??=e?.message||'atomic-cleanup';state='BLOCKED';}}
      busy=false;
    }return view();
  }
  function adopt(value){if(busy||disposed||unknown)return Promise.resolve(view());return execute(async()=>{pending=copyRecord(value,budget);pendingKind='adoption';account();await adoption(pending);});}
  function submit(input){
    if(busy||disposed||unknown)return Promise.resolve(view());
    return execute(async()=>{
      if(!C.exact(input,['phasePin','timestamps'])||!manifest||!adoptionPin)fail('atomic-not-adopted');
      const pin=copyRecord(input.phasePin,budget,4096);let timestamps=validateAtomicTimestamps(input.timestamps);validatePhasePin(pin,scope,session);
      if(pendingKind==='terminal'&&pending){if(!equal(pin,pending.phasePin))fail('atomic-command-conflict');timestamps=pending.timestamps;}
      // Freeze the command before any await; no current native keys are imported.
      releaseProjection();phasePin=pin;account(timestamps);lease=await dependencies(pin);
      let command={version:1,contract:ATOMIC_CONTRACT,principal,scope,session,chapter:9,phase:2,adoptionPin,contextPin:manifest.contextPin,phasePin:pin,timestamps,result:null};
      account(command);
      try{command.result=resultSummary(project(lease,command));}finally{lease.dispose();lease=null;}
      bounded(command);pending=freezeFinaleData(command);command=null;pendingKind='terminal';account();await submission();
    });
  }
  function retry(){if(busy||disposed||state!=='UNSAVED'||!pending)return Promise.resolve(view());
    return execute(async()=>{
      if(unknown){
        const kind=pendingKind,saved=await persist(kind);
        if(kind==='adoption'){manifest=saved.value;adoptionPin=saved.pin;incomingRecord=null;validateManifest(manifest,scope,session,principal);
          const terminal=await stored('terminal');if(terminal){terminalPin=terminal.pin;phasePin=terminal.value.phasePin;await hydrate(terminal.value);}
          else{phasePin=await findAtomicCapture(adapter,scope,`fp2:${session}:9:2`,budget,crypto);await hydrate();}}
        else{terminalPin=saved.pin;validateCommand(saved.value,manifest,adoptionPin,scope,session,principal);await hydrate(saved.value);}
      }else await (pendingKind==='adoption'?adoption(pending):submission());
    });}
  function recover(){if(busy||disposed)return Promise.resolve(view());if(unknown)return Promise.resolve(view());
    return execute(async()=>{
      releaseProjection();pending=null;pendingKind=null;const a=await stored('adoption');if(!a)fail('atomic-manifest-missing');
      manifest=a.value;adoptionPin=a.pin;incomingRecord=null;validateManifest(manifest,scope,session,principal);account();
      const t=await stored('terminal');if(t){terminalPin=t.pin;phasePin=t.value.phasePin;await hydrate(t.value);}
      else{phasePin=await findAtomicCapture(adapter,scope,`fp2:${session}:9:2`,budget,crypto);await hydrate();}
    });}
  function context(){if(state!=='ADOPTED'||busy||!lease)fail('atomic-context-unavailable');return Object.freeze({context:lease.context,storyText:lease.storyText,contextReference:lease.contextReference});}
  function dispose(){if(busy||unknown)fail('atomic-owner-busy');if(disposed)return;let error;try{releaseProjection();}catch(e){error=e;}
    manifest=null;adoptionPin=null;phasePin=null;terminalPin=null;pending=null;proposalPin=null;committedPin=null;incomingRecord=null;disposed=true;state='DISPOSED';
    try{budget.release('atomic-retained',ATOMIC_LIMIT.retained);}catch(e){error??=e;}if(error)throw error;}
  return Object.freeze({adopt,submit,retry,recover,view,context,dispose});
}
