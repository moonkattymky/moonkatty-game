// TEST ONLY. Frozen synthetic prerequisites, unchanged native adapter and owner.
// No earned-game claim, old completion implementation or original reward loader.
import {createTestAdapter} from '/prototypes/evidence-indexeddb/adapter.mjs';
import * as C from '/prototypes/evidence-indexeddb/contract.mjs';
import {createPhaseBudget} from '/prototypes/evidence-indexeddb/phase-budget.mjs';
import {createSharedGuestOwner} from '/prototypes/evidence-indexeddb/shared-guest-owner.mjs';
import {createSharedLog,runFor} from '/prototypes/evidence-indexeddb/shared-log.mjs';
const SCOPE='fixture:shared-two-action',SESSION='0123456789abcdef0123456789abcdef';
const PRINCIPAL='guest:source-test',DAY='2026-10-12',WATCHDOG=1000;
const LIMITS=Object.freeze({nativeEvents:20000,transport:512,events:128,writes:64,seedJsonBytes:524288,seedPayloadBytes:131072,reportJsonBytes:8388608});
const $=id=>document.getElementById(id),copy=v=>structuredClone(v),N=window.__nativeHarness;
const nativeStorage=window.localStorage,mirrorKeys=['mkty_points','mkty_daily_demo','mkty_story_plan_9_v1'];
const events=[],transport=[],writes=[],counters={award:0,rewards:0,original:0};
let base,adapter,owner,budget,inspectionBudget,phasePin=null,bootState=null,error=null,pending=false,fresh=false;
let fault=null,appendHold=null,heldTerminal=null,lastRequest=null,admitted=null,day=DAY,preparation=null;
function push(list,row,max){if(list.length>=max)throw Error('fixture-observation-limit');list.push(row);return row;}
const event=(type,data={})=>push(events,{type,nativeIndex:N.log.length,...data},LIMITS.events);
const physical=()=>({physicalBusy:base?.physicalBusy??false,retainedBytes:base?.retainedBytes??0,nativePhysical:N.physical});
const digest=async bytes=>Array.from(new Uint8Array(await N.native.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
function record(payload,ordinal){
  const start=ordinal===0?20:0,dv=new DataView(payload.buffer,payload.byteOffset,payload.byteLength),n=dv.getUint32(start+4,true);
  if(n<2||n%2||n>16356)throw Error('fixture-record-limit');let text='';
  for(let i=0;i<n;i+=2)text+=String.fromCharCode(dv.getUint16(start+8+i,true));return JSON.parse(text);
}
async function requestSummary(q){
  const command=q.descriptor.run===runFor(SESSION)&&q.ordinal>0?record(q.payload,q.ordinal).command:null;
  return {run:q.descriptor.run,ordinal:q.ordinal,offset:q.offset,length:q.payload.length,expectedHead:q.expectedHead,
    previousRoot:q.previousRoot,seal:q.seal?copy(q.seal):null,payloadDigest:await digest(q.payload),command};
}
async function tracked(kind,summary,work){
  const row=push(transport,{kind,...summary,startNativeIndex:N.log.length},LIMITS.transport);
  try{const r=await work();const d=base.diagnostics;row.diagnostics=Object.fromEntries(['op','transactions','terminal','requestBytes','inputCopyBytes','touchedWrites','duplicateReadBytes','peakAccountedBytes','liveAccountedBytes'].map(key=>[key,d[key]]));row.result={status:r.status,reason:r.reason??null,receipt:copy(r.receipt??null),currentHead:copy(r.currentHead??null)};return r;}
  finally{row.endNativeIndex=N.log.length;Object.assign(row,physical());}
}
async function append(q,guard){
  const summary=await requestSummary(q),effect=q.descriptor.run===runFor(SESSION)&&q.ordinal>0;
  if(effect)lastRequest=summary; // Metadata only. Exact retry bytes remain owned by the native adapter.
  return tracked('append',summary,async()=>{
    if(effect&&appendHold?.kind===summary.command.kind){
      const hold=appendHold;hold.summary=summary;event('proposal-held',{kind:hold.kind,ordinal:q.ordinal,expectedHead:q.expectedHead});
      await hold.promise; // Borrow q under the caller's live record workspace; never clone/rewrite it.
    }
    const mode=effect?fault:null;if(mode){fault=null;event('native-fault-armed',{mode});}
    if(mode==='abort'||mode==='hold-abort')N.control.abortAt='first-add';
    if(mode==='hold-complete'||mode==='hold-abort'){
      const terminal=mode==='hold-abort'?'abort':'complete',hold={proof:null,promise:N.holdNextTerminal(terminal)};heldTerminal=hold;
      hold.promise.then(proof=>{hold.proof=proof;event('native-terminal-held',{terminal:proof.terminal,tx:proof.tx});});
      let result;hold.timer=N.gateWatchdogDuring(()=>{result=base.appendSegment(q,guard);},WATCHDOG);
      // Real elapsed watchdog deadline plus observed native terminal, with only
      // callback delivery controlled. No fabricated adapter status or receipt.
      Promise.all([hold.promise,hold.timer.due]).then(()=>hold.timer.release());
      return result;
    }
    return base.appendSegment(q,guard);
  });
}
function render(){
  const v=owner?.view();if(!v)return;
  $('sharedStatus').textContent=error?'Fixture error: '+error:v.reason?'Owner '+v.state+': '+v.reason:'Owner '+v.state+' · revision '+(v.revision??'none');
  $('sharedBalance').textContent=v.values?'Canonical guest points: '+v.values.mkty_points:'';
  $('sharedDaily').disabled=pending||v.state!=='ACTIVE';
  $('sharedTerminal').disabled=pending||!['ACTIVE','READY'].includes(v.state)||!phasePin;
  $('sharedRetry').disabled=pending||!v.retryEnabled;
}
async function observe(label,fn){
  if(pending)throw Error('fixture-operation-busy');pending=true;error=null;render();
  try{return await fn();}catch(e){error=String(e.stack||e);event('operation-error',{label,message:String(e.message)});throw e;}
  finally{pending=false;render();event('settled',{label,state:owner.view().state,...physical()});}
}
// Only three named captures are accepted. Every lookup comes from native IDB.
async function catalog(account=budget){
  const rows=[],cursors=new Set();let cursor=null,watermark=null;
  do{
    if(rows.length>=3||cursors.has(cursor))throw Error('fixture-catalog-limit');cursors.add(cursor);
    account.reserve('returned-page',16384);
    try{
      const p=await adapter.recover({scope:SCOPE,cursor,maxHeads:1,maxBytes:16384});
      if(p.status!=='page')throw Error(p.reason||'fixture-catalog');
      if(watermark===null)watermark=p.watermark;
      if(watermark!==p.watermark||watermark>3||p.heads.length>1)throw Error('fixture-catalog-shape');
      for(const row of p.heads){
        if(![`fc1:${SESSION}:9`,`fp2:${SESSION}:9:2`,runFor(SESSION)].includes(row.descriptor.run)||rows.some(x=>x.descriptor.run===row.descriptor.run))throw Error('fixture-scope-not-isolated');
        rows.push(copy({descriptor:row.descriptor,head:row.head}));
      }
      cursor=p.nextCursor;
    }finally{account.release('returned-page',16384);}
  }while(cursor!==null);
  if(rows.length!==watermark)throw Error('fixture-catalog-count');return rows;
}
async function prepare(seed){return observe('prepare',async()=>{
  if(!fresh||owner.view().state!=='NEW')throw Error('fixture-not-fresh');fresh=false;
  if(JSON.stringify(seed).length*2>LIMITS.seedJsonBytes||seed.archives?.length!==2)throw Error('fixture-seed-limit');
  if(seed.manifest?.scope!==SCOPE||seed.manifest?.session!==SESSION||seed.manifest?.principal!==PRINCIPAL)throw Error('fixture-seed-identity');
  const runs=new Set();let total=0,segments=0;
  for(const archive of seed.archives){
    if(![`fc1:${SESSION}:9`,`fp2:${SESSION}:9:2`].includes(archive.run)||runs.has(archive.run)||archive.pin?.descriptor?.run!==archive.run)throw Error('fixture-seed-run');
    runs.add(archive.run);if(!archive.segments.length||archive.segments.length>5)throw Error('fixture-seed-segments');
    let head=null;
    for(const part of archive.segments){
      if(typeof part.payload!=='string'||part.payload.length>65536||part.payload.length%2||!/^[0-9a-f]+$/.test(part.payload))throw Error('fixture-seed-payload');
      const payload=Uint8Array.from(part.payload.match(/../g),x=>parseInt(x,16));total+=payload.length;segments++;
      if(total>LIMITS.seedPayloadBytes)throw Error('fixture-seed-limit');
      const q={descriptor:archive.pin.descriptor,ordinal:part.ordinal,offset:part.offset,previousRoot:head?.root??C.ZERO,expectedHead:head?.token??null,payload,
        ...(part.sealed?{seal:{totalBytes:part.offset+payload.length,root:part.root}}:{})};
      const r=await adapter.appendSegment(q);if(r.status!=='committed')throw Error('fixture-seed-append:'+r.reason);head=r.currentHead;
      if(head.root!==part.root)throw Error('fixture-seed-root');
    }
    if(JSON.stringify(head)!==JSON.stringify(archive.pin.head))throw Error('fixture-seed-pin');
  }
  phasePin=(await catalog()).find(p=>p.descriptor.run===`fp2:${SESSION}:9:2`)??null;
  if(JSON.stringify(phasePin)!==JSON.stringify(seed.phasePin))throw Error('fixture-phase-pin');
  preparation={payloadBytes:total,segments,synthetic:true};
  const result=await owner.adopt(seed.manifest);if(result.state!=='ACTIVE')throw Error('fixture-adoption:'+result.reason);
  bootState='ACTIVE';event('synthetic-prerequisites-adopted',preparation);return result;
});}
// These at-most-three decoded records/prefixes are bounded test observation
// copies outside the owner's runtime representation ledger, never an input cache.
async function history(){
  if(pending||base.physicalBusy||base.retainedBytes)throw Error('fixture-inspection-busy');
  inspectionBudget=createPhaseBudget();const log=createSharedLog({adapter,scope:SCOPE,session:SESSION,principal:PRINCIPAL,budget:inspectionBudget,crypto});
  const pin=await log.head(),records=[],prefixes=[],payloadDigests=[];let root=C.ZERO;
  if(pin){
    const desc=await C.descriptor(pin.descriptor);
    for(let ordinal=0;ordinal<=pin.head.ordinal;ordinal++){
      const lease=await log.readRecord(pin,ordinal);try{records.push(copy(lease.record));}finally{lease.dispose();}
      inspectionBudget.reserve('returned-page',16384);
      try{
        const p=await adapter.readSegments({captureIdentity:{scope:SCOPE,run:runFor(SESSION)},throughHead:pin.head.token,afterOrdinal:ordinal-1,maxBytes:16384});
        if(p.status!=='page'||p.segments.length!==1)throw Error('fixture-history-read');const part=p.segments[0];
        root=await C.chain(desc,{ordinal,offset:ordinal*16384,previousRoot:root},part.payload);
        if(root!==part.root)throw Error('fixture-history-root');payloadDigests.push(await digest(part.payload));
        prefixes.push({descriptor:copy(pin.descriptor),head:await C.makeHead(desc,ordinal,(ordinal+1)*16384,root,ordinal===2)});
      }finally{inspectionBudget.release('returned-page',16384);}
    }
  }
  return {pin,records,prefixes,payloadDigests,budget:inspectionBudget.snapshot()};
}
function installTripwires(){
  const deny=(op,key,value)=>{push(writes,{op,key:String(key),bytes:value===undefined?0:String(value).length*2},LIMITS.writes);throw Error('fixture-legacy-write-forbidden');};
  const storage=Object.freeze({getItem:key=>owner.view().values?.[String(key)]??null,setItem:(k,v)=>deny('set',k,v),removeItem:k=>deny('remove',k),clear:()=>deny('clear','*')});
  Object.defineProperty(window,'localStorage',{value:storage,configurable:false,writable:false});window.MKTYStorage=storage;
  window.awardLifePoints=()=>{counters.award++;throw Error('fixture-old-award');};
  window.openMission9=()=>{counters.original++;throw Error('fixture-old-completion');};
  window.MKTYRewards=Object.freeze({completeLife(){counters.rewards++;throw Error('fixture-old-reward');},call(){counters.rewards++;throw Error('fixture-old-reward');}});
}
function nativeMirror(){
  const values=Object.fromEntries(mirrorKeys.map(key=>[key,nativeStorage.getItem(key)]));
  if(JSON.stringify(values).length*2>4096)throw Error('fixture-mirror-limit');return values;
}
function facts(){
  const value={view:copy(owner.view()),bootState,settled:!pending,error,phasePin:copy(phasePin),events:copy(events),transport:copy(transport),nativeEvents:copy(N.log),
    counters:copy(counters),writes:copy(writes),budget:budget.snapshot(),inspectionBudget:inspectionBudget?.snapshot()??null,...physical(),
    pendingAppend:appendHold?.summary?copy(appendHold.summary):null,heldTerminal:heldTerminal?.proof??null,limits:LIMITS,preparation,nativeMirror:nativeMirror()};
  if(JSON.stringify(value).length*2>LIMITS.reportJsonBytes)throw Error('fixture-report-limit');return value;
}
export async function bootSharedFixture(){
  if(!N)throw Error('native-instrumentation-missing');if(window.Telegram?.WebApp?.initData)throw Error('fixture-guest-only');
  // The accepted instrumentation remains unchanged; cap this fixture's own log.
  Object.defineProperty(N.log,'push',{value:function(...rows){if(this.length+rows.length>LIMITS.nativeEvents)throw Error('fixture-native-log-limit');return Array.prototype.push.apply(this,rows);}});
  budget=createPhaseBudget();base=createTestAdapter({scope:SCOPE,watchdogMs:WATCHDOG});
  adapter={scope:SCOPE,appendSegment:append,retry:guard=>tracked('exact-retry',lastRequest??{},()=>base.retry(guard)),
    readSegments:q=>tracked('read',{run:q.captureIdentity.run,afterOrdinal:q.afterOrdinal,maxBytes:q.maxBytes,throughHead:q.throughHead},()=>base.readSegments(q)),
    recover:q=>tracked('recover',{cursor:q.cursor??null,maxBytes:q.maxBytes},()=>base.recover(q)),
    get physicalBusy(){return base.physicalBusy;},get retainedBytes(){return base.retainedBytes;}};
  owner=createSharedGuestOwner({adapter,scope:SCOPE,session:SESSION,principal:PRINCIPAL,budget,crypto,admissionDay:()=>day});installTripwires();
  const admitDaily=()=>observe('admit-daily',async()=>{admitted=await owner.admitDaily();return admitted;});
  const checkin=ticket=>observe('daily',()=>owner.checkin(ticket??admitted));
  const terminal=()=>observe('terminal',()=>owner.submitTerminal(phasePin));
  const retry=()=>observe('retry',()=>owner.retry());
  window.H={get ready(){return window.sharedFixtureReady===true;},get settled(){return !pending;},get pendingAppend(){return appendHold?.summary?copy(appendHold.summary):null;},
    get heldTerminal(){return heldTerminal?.proof??null;},prepare,admitDaily,checkin,terminal,retry,history,facts,
    recover:()=>observe('recover',async()=>{const r=await owner.recover();phasePin=(await catalog()).find(p=>p.descriptor.run===`fp2:${SESSION}:9:2`)??null;return r;}),
    holdNextAppend(kind){if(appendHold||!['daily','terminal'].includes(kind))throw Error('fixture-hold-kind');let release;const promise=new Promise(resolve=>{release=resolve;});appendHold={kind,promise,release,summary:null};},
    releaseAppend(){if(!appendHold?.summary)throw Error('fixture-no-held-proposal');const hold=appendHold;appendHold=null;event('proposal-released',{kind:hold.kind,ordinal:hold.summary.ordinal});hold.release();return true;},
    arm(kind){if(fault||!['abort','hold-complete','hold-abort'].includes(kind))throw Error('fixture-fault-kind');fault=kind;},
    releaseHeld(){if(!heldTerminal?.proof)throw Error('fixture-terminal-not-observed');return N.releaseTerminals(heldTerminal.proof.tx);},
    setDay(value){if(!/^2026-10-(12|13)$/.test(value))throw Error('fixture-day');day=value;},
    writeStaleMirror(){
      nativeStorage.setItem('mkty_points','99999');nativeStorage.setItem('mkty_daily_demo','{"cday":"2026-10-12","streak":99,"last_day":"2026-10-12"}');
      nativeStorage.setItem('mkty_story_plan_9_v1','corrupt disposable legacy mirror');event('native-mirror-overwritten');return nativeMirror();
    },
    staleWrites(){return [()=>localStorage.setItem('mkty_points','99999'),()=>localStorage.removeItem('mkty_daily_demo'),()=>localStorage.clear()].map(fn=>{try{fn();return null;}catch(e){return e.message;}});},
    dispose(){if(pending)throw Error('fixture-operation-busy');owner.dispose();phasePin=null;admitted=null;lastRequest=null;base.close();return budget.snapshot();}};
  $('sharedDaily').onclick=()=>{void (async()=>{const ticket=admitted??await admitDaily();if(ticket)await checkin(ticket);})().catch(()=>{});};
  $('sharedTerminal').onclick=()=>{void terminal().catch(()=>{});};$('sharedRetry').onclick=()=>{void retry().catch(()=>{});};
  const opened=await base.open();event('adapter-open',{status:opened.status,reason:opened.reason??null});
  if(opened.status!=='open')throw Error(opened.reason);
  await owner.recover();const heads=await catalog();phasePin=heads.find(p=>p.descriptor.run===`fp2:${SESSION}:9:2`)??null;
  bootState=owner.view().state;fresh=bootState==='NEW'&&heads.length===0;
  if(bootState==='NEW'&&!fresh)bootState='INCOMPLETE';event('native-recovered',{state:bootState,phaseFound:!!phasePin});render();window.sharedFixtureReady=true;
}
