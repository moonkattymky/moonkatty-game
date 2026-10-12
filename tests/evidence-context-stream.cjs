'use strict';
// Source-only contract/transport doubles with real native WebCrypto. No browser,
// IndexedDB transaction, persistence, controller, award or lifecycle claim.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {webcrypto}=require('node:crypto');
const Field=require('../field-model.js'),Story=require('../story-plan.js'),Codec=require('../trace-codec.js');
const fixtures=require('./fixtures/finale-checkpoints-17-state.json');
const root=path.resolve(__dirname,'../prototypes/evidence-indexeddb');
const url=name=>pathToFileURL(path.join(root,name)).href;
const SESSION='1234567890abcdef1234567890abcdef',SCOPE='fixture:context-stream';
const clone=value=>JSON.parse(Codec.stringify(value));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
let checks=0;const groups=[],measurements=[];
const eq=(a,b,note)=>{assert.deepStrictEqual(a,b,note);checks++;};
const ok=(v,note)=>{assert(v,note);checks++;};
const throws=(fn,re=/context-(admission|limit)|transient-budget/)=>{assert.throws(fn,re);checks++;};
function plan(chapter=8){return {...Story.fresh(chapter,9000+chapter,2),createdAt:1,phase:'core',done:[0,1,2,3,4,5,6,7]};}
function contextBinding(chapter=8,baseSeed=0){return {version:1,session:SESSION,chapter,edition:2,baseSeed,
  storyKey:`mkty_story_plan_${chapter}_v1`,sourceKey:`mkty_field_finale_${chapter}_v1`,route:'spatial-finale'};}
function contextInput(storyText=JSON.stringify(plan()),chapter=8){return {scope:SCOPE,session:SESSION,storyText,binding:contextBinding(chapter)};}
function realLongPlan(){
  const full=plan();for(const task of Story.plan(8,2).steps)full.tasks[task.id]={kind:task.kind,attempt:0,seconds:3,hints:0,errors:0};
  const proof=Field.create(8,0,Story.seedFor(full,0));proof.trace=[];
  const act=(action,value)=>{proof.trace.push(['act',action,value??null]);Field.act(proof,action,value);};
  const layout=Field.layout(proof);for(let i=0;i<3;i++){act('station',i);act('angle',Math.round(layout.bearings[i]));act('sample');}
  act('pin',layout.source);act('locate');full.tasks[0]={...full.tasks[0],proof,performance:Field.performance(proof)};
  proof.trace=[...Array.from({length:900},()=>['act','station',0]),...proof.trace];
  const replay=Field.create(8,0,proof.seed);for(const row of proof.trace)Field.act(replay,row[1],row[2]);
  ok(replay.complete&&Field.won(replay));ok(Field.restore(proof,8,0,proof.seed));
  const text=JSON.stringify(full);eq(proof.trace.length,911);eq(text.length*2,38628);
  ok(Story.restore(full));ok(Codec.packSnapshot({mkty_story_plan_8_v1:text}));return text;
}
// Independent test oracle: hand-written framing and LE code units. It is an
// observer buffer, never a production expected buffer or resource-model input.
function frameOracle(storyText,binding){
  const parts=[storyText,Codec.stringify(binding)],size=28+2*parts.reduce((n,s)=>n+s.length,0),out=Buffer.alloc(size);
  out.write('ARCHIVE1',0,'ascii');out.writeUInt32LE(2,8);let at=12;
  for(const text of parts){out.writeBigUInt64LE(BigInt(2*text.length),at);at+=8;for(let i=0;i<text.length;i++){out[at++]=text.charCodeAt(i)&255;out[at++]=text.charCodeAt(i)>>>8;}}
  eq(at,size);return out;
}
function ledger(){
  const live=Object.create(null),events=[];let peak=0;
  const get=name=>live[name]||0;
  function check(){
    const total=Object.values(live).reduce((a,b)=>a+b,0);peak=Math.max(peak,total);
    ok(total<=1016832,'unchanged shared ceiling');
    ok(!(get('phase-workspace')&&(get('context-parse')||get('context-restore'))),'context parsing cannot overlap phase workspace');
    ok(!(get('stream-candidate')&&get('returned-page')),'candidate and page cannot overlap');
    ok(!(get('context-compare-read')&&(get('hash')||get('framing')||get('helper-framing')||get('helper-hash'))),'fresh context read cannot overlap hash scratch');
    return total;
  }
  return {live,events,get,get peak(){return peak;},reserve(name,bytes){assert(Number.isSafeInteger(bytes)&&bytes>=0);if(['stream-candidate','returned-page','phase-assembly'].includes(name))eq(get(name),0,`second live ${name}`);live[name]=get(name)+bytes;events.push({type:'reserve',name,bytes});check();},
    release(name,bytes){assert(get(name)>=bytes,`unbalanced ${name} release`);live[name]-=bytes;events.push({type:'release',name,bytes});check();},
    reserveHash(bytes,text){this.reserve('hash',bytes*(text?2:1));},releaseHash(bytes,text){this.release('hash',bytes*(text?2:1));},hash(){},
    allocate(name,bytes){ok(get(name)>=bytes,`${name} must reserve before allocation`);events.push({type:'allocate',name,bytes});},event(name,details){events.push({type:'event',name,details});},snapshot(){return Object.freeze({...live});},check};
}
// Watch actual parse/model calls, not only nominal counters. These patches are
// synchronous and restored before any independent test starts.
function watchContextAdmission(a,storyText,work){
  const parse=JSON.parse,restore=Story.restore,stringify=JSON.stringify;let parses=0,restores=0,fullSerializations=0;
  JSON.parse=function(text,...rest){if(text===storyText){parses++;ok(a.get('context-parse')>=65536,'parse reserved before JSON.parse');eq(a.get('phase-workspace'),0);}return parse.call(this,text,...rest);};
  Story.restore=function(value,...rest){if(value?.n===8&&value?.phase==='core'){restores++;ok(a.get('context-restore')>=65536,'restore reserved before model');eq(a.get('phase-workspace'),0);}return restore.call(this,value,...rest);};
  JSON.stringify=function(value,...rest){if(value?.n===8&&value?.phase==='core')fullSerializations++;return stringify.call(this,value,...rest);};
  try{const result=work();eq(parses,1);eq(restores,1);eq(fullSerializations,0,'no full context serialization');return result;}
  finally{JSON.parse=parse;Story.restore=restore;JSON.stringify=stringify;}
}
(async()=>{
  const C=await import(url('contract.mjs')),F=await import(url('finale-context-v1.mjs'));
  const group=async(name,fn)=>{await fn();groups.push(name);};
  const admitted=(input,a=ledger())=>{a.reserve('metadata',32768);a.reserve('context-retained',65536);return {capsule:F.admitContext(input,a),a};};
  await group('01 independent virtual frame oracle preserves exact UTF-16 units at every framing boundary',async()=>{
    const weird={...plan(),unknown:{negativeZero:-0,exponent:100,units:'\ud800x\udfff😀\u0000\n\t\\\"'},finaleEvidence:{version:999,payload:['mkty-trace',99,1,0,'opaque']}};
    const text='\n '+JSON.stringify(weird).replace('"negativeZero":0','"negativeZero":-0.0').replace('"exponent":100','"exponent":1e2').replace('\\ud800','\ud800').replace('\\udfff','\udfff')+'\r\n';
    const input=contextInput(text),{capsule,a}=admitted(input),d=F.describeContext(capsule),expected=frameOracle(text,input.binding);
    eq(d.total,expected.length);eq(d.descriptor.kind,'finale-chapter-context');eq(d.descriptor.model,'finale-chapter-context-v1');
    eq(d.descriptor.scope,SCOPE);eq(d.descriptor.run,`fc1:${SESSION}:8`);eq(d.descriptor.note,'');
    eq(d.descriptor.components,[{name:'story',encoding:'utf16le',length:text.length*2},{name:'binding',encoding:'utf16le',length:Codec.stringify(input.binding).length*2}]);
    const before=JSON.stringify(d);input.binding.chapter=9;input.storyText='replaced';eq(JSON.stringify(F.describeContext(capsule)),before);ok(Object.isFrozen(d.descriptor));
    const boundaries=[0,1,7,8,11,12,13,19,20,21,20+text.length*2-1,20+text.length*2,27+text.length*2,expected.length-1];
    for(const offset of boundaries)for(const count of [1,2,7,31,32768]){
      const length=Math.min(count,expected.length-offset);if(length<1)continue;
      const bytes=F.copyContextRange(capsule,offset,length,a);eq(Buffer.from(bytes),expected.subarray(offset,offset+length));
      ok(F.compareContextRange(capsule,offset,bytes));bytes[0]^=1;ok(!F.compareContextRange(capsule,offset,bytes));a.release('stream-candidate',length);
    }
    ok(F.matchesContextText(capsule,text));ok(!F.matchesContextText(capsule,text+' '));eq(a.get('context-parse'),0);eq(a.get('context-restore'),0);
  });
  await group('02 real 911-row 38,628-byte proof and opaque packed context retain original bytes',async()=>{
    const text=realLongPlan(),input=contextInput(text),a=ledger();a.reserve('metadata',32768);a.reserve('context-retained',65536);
    const capsule=watchContextAdmission(a,text,()=>F.admitContext(input,a)),d=F.describeContext(capsule),expected=frameOracle(text,input.binding);
    let offset=0;while(offset<d.total){const n=Math.min(32768,d.total-offset),bytes=F.copyContextRange(capsule,offset,n,a);eq(Buffer.from(bytes),expected.subarray(offset,offset+n));ok(F.compareContextRange(capsule,offset,bytes));a.release('stream-candidate',n);offset+=n;}
    eq(offset,d.total);measurements.push({name:'real-long-proof',storyUtf16:38628,traceRows:911,artifactBytes:d.total});
    const packed=JSON.parse(text);packed.tasks[0].proof.trace=Codec.packTrace(packed.tasks[0].proof.trace);packed.finaleEvidence={version:700,unknown:'\ud800',opaque:[['mkty-trace',71,99999999,0,'unparsed']]};
    const packedText=JSON.stringify(packed),originalUnpack=Codec.unpackTrace;let unpackCalls=0;Codec.unpackTrace=()=>{unpackCalls++;throw Error('unexpected-context-expansion');};
    try{const c=admitted(contextInput(packedText));ok(F.matchesContextText(c.capsule,packedText));eq(unpackCalls,0);}finally{Codec.unpackTrace=originalUnpack;}
  });
  await group('03 raw 65,536 boundary, next unit refusal before parse, canonical and restored growth refusal',async()=>{
    const compact=JSON.stringify(plan()),exact=compact+' '.repeat(32768-compact.length),input=contextInput(exact),a=ledger();a.reserve('metadata',32768);a.reserve('context-retained',65536);
    const capsule=watchContextAdmission(a,exact,()=>F.admitContext(input,a));ok(F.matchesContextText(capsule,exact));eq(F.describeContext(capsule).descriptor.components[0].length,65536);
    const parse=JSON.parse;let calls=0;JSON.parse=(...args)=>{calls++;return parse(...args);};
    try{throws(()=>F.admitContext(contextInput(exact+' '),a));eq(calls,0,'raw overflow refused before parse');}finally{JSON.parse=parse;}
    eq(input.storyText,exact);
    const exponent=compact.slice(0,-1)+',"extra":['+Array(2000).fill('1e20').join(',')+']}';ok(exponent.length*2<65536);const restore=Story.restore;let overflowRestores=0;Story.restore=(...args)=>{overflowRestores++;return restore(...args);};try{throws(()=>admitted(contextInput(exponent)));eq(overflowRestores,0,'canonical overflow before Story.restore');}finally{Story.restore=restore;}
    const deep=compact.slice(0,-1)+',"extra":'+('{"x":'.repeat(66))+'0'+('}'.repeat(66))+'}';throws(()=>admitted(contextInput(deep)));
    const wide=compact.slice(0,-1)+',"extra":{'+Array.from({length:129},(_,i)=>`"k${i}":0`).join(',')+'}}';throws(()=>admitted(contextInput(wide)));
    const overflowing={...plan(),finaleEvidence:{payload:''}};let prefix=JSON.stringify(overflowing);overflowing.finaleEvidence.payload='x'.repeat(32768-prefix.length);const near=JSON.stringify(overflowing);eq(near.length*2,65536);
    // restore replaces the single-digit createdAt with its native timestamp and
    // final-rewrite spelling also needs headroom. Raw-boundary validity is not enough.
    throws(()=>admitted(contextInput(near)));
    for(const value of ['malformed',compact.replace('"edition":2','"edition":1'),compact.replace('"core"','"complete"'),compact.slice(0,-1)+',"x":1e309}'])throws(()=>admitted(contextInput(value)));
  });
  await group('04 bounded direct candidate allocation and virtual range refusal',async()=>{
    const {capsule,a}=admitted(contextInput(JSON.stringify(plan())+' '.repeat(20000))),size=F.describeContext(capsule).total;
    const Original=globalThis.Uint8Array;let allocations=0;
    globalThis.Uint8Array=new Proxy(Original,{construct(target,args){allocations++;const n=typeof args[0]==='number'?args[0]:args[0]?.byteLength;ok(n<=32768,'never allocate full context frame');ok(a.get('stream-candidate')>=n,'candidate reserved before typed allocation');return Reflect.construct(target,args,target);}});
    try{const bytes=F.copyContextRange(capsule,1,32768,a);eq(bytes.length,32768);eq(allocations,1);a.release('stream-candidate',32768);}finally{globalThis.Uint8Array=Original;}
    for(const [offset,n]of [[-1,1],[0,32769],[size,1],[0,0],[0,1.5],[NaN,1],[size-1,2]])throws(()=>F.copyContextRange(capsule,offset,n,a));
    eq(a.get('stream-candidate'),0);
  });
  const B=await import(url('phase-budget.mjs')),T=await import(url('context-stream.mjs')),P=await import(url('finale-phase-v2.mjs'));
  const {createCoordinator}=await import(url('coordinator.mjs'));
  function observedBudget(){
    const audit=ledger(),observed=[];audit.reserve('metadata',32768);audit.reserve('adapter',393216);
    const budget=B.createPhaseBudget({observe(e){observed.push(e);const name=e.name??e.label;
      if(e.type==='reserve')audit.reserve(name,e.bytes);else if(e.type==='release')audit.release(name,e.bytes);
      else if(e.type==='allocate')audit.allocate(name,e.bytes);
    }});return {budget,audit,observed};
  }
  async function harness({text,crypto=webcrypto,identity,reader,phase}={}){
    text??=JSON.stringify(plan())+' '.repeat(32768-JSON.stringify(plan()).length);
    const x=contextInput(text),{budget,audit,observed}=observedBudget();let rawPhase=null,phaseSource=null;
    if(phase){x.binding.baseSeed=(phase.seed-phase.index*7919)>>>0;phaseSource=JSON.stringify({version:1,n:phase.chapter,phase:phase.index,seed:x.binding.baseSeed,seconds:0,checkpoint:phase.state});}
    budget.reserve('raw-capsule',65536);budget.reserve('context-retained',text.length*2);
    if(phase){const b={version:1,chapter:phase.chapter,edition:2,phase:phase.index,mechanic:phase.mechanic,fieldStage:4,baseSeed:x.binding.baseSeed,seed:phase.seed,sourceKey:x.binding.sourceKey,storyKey:x.binding.storyKey,route:'spatial-finale',provenance:clone(phase.provenance)};rawPhase=P.freezeFinalePhase({scope:SCOPE,session:SESSION,checkpoint:clone(phase.state),sourceText:phaseSource,binding:b},budget);}
    const context=F.admitContext(x,budget);budget.release('raw-capsule',65536);budget.reserve('phase-workspace',327680);
    const original={scope:SCOPE,generation:1,sourceIdentity:'source:1',sourceText:phaseSource??'{"phase":0}'};
    let live={...original,storyText:text,...identity},lease=null,readerHook=reader,stream,active=0,maxActive=0,readContextCalls=0,retainedOverride=null;
    const stored=new Map(),writes=[],retryWrites=[],reads=[],hooks={append:null,retry:null,read:null};
    const currentIdentity=()=>({scope:live.scope,generation:live.generation,sourceIdentity:live.sourceIdentity});
    async function commit(q,status='committed',mutate){
      const d=await C.descriptor(q.descriptor,webcrypto),rootHash=await C.chain(d,q,q.payload,webcrypto),head=await C.makeHead(d,q.ordinal,q.offset+q.payload.length,rootHash,!!q.seal,webcrypto);
      const key=q.descriptor.run+'#'+q.ordinal;if(!stored.has(key))stored.set(key,{ordinal:q.ordinal,offset:q.offset,length:q.payload.length,root:rootHash,payload:new Uint8Array(q.payload)});
      const result={status,receipt:{captureIdentity:{scope:q.descriptor.scope,run:q.descriptor.run},ordinal:q.ordinal,length:q.payload.length,root:rootHash,headToken:head.token,sealed:!!q.seal,acknowledgement:'idb-transaction-complete',durability:'strict'},currentHead:head};mutate?.(result);return result;
    }
    async function operation(q,retrying){
      active++;maxActive=Math.max(maxActive,active);(retrying?retryWrites:writes).push(q);
      try{const hook=retrying?hooks.retry:hooks.append,result=hook?await hook(q,{commit,setLease:x=>{lease=x;}}):await commit(q);
        if(result.status==='outcomeUnknown')lease=q;else if(retrying&&['committed','duplicate'].includes(result.status))lease=null;return result;
      }finally{active--;}
    }
    const adapter={appendSegment:q=>operation(q,false),retry:()=>lease?operation(lease,true):Promise.resolve({status:'refused',reason:'no-retry'}),
      get retainedBytes(){return retainedOverride??(lease?lease.payload.length+512:0);},async readSegments(request){
        reads.push({...request});eq(audit.get('stream-candidate'),0,'no candidate at storage read');ok(audit.get('returned-page')>=request.maxBytes,'page reserved before adapter allocation');
        const ordinal=(request.afterOrdinal??-1)+1,s=stored.get(request.captureIdentity.run+'#'+ordinal),head=await C.headToken(request.throughHead,webcrypto);
        const page=s?{status:'page',segments:[{...s,payload:new Uint8Array(s.payload)}],payloadBytes:s.length,throughHead:request.throughHead,
          nextCursor:ordinal<head.ordinal?{captureIdentity:{...request.captureIdentity},throughHead:request.throughHead,afterOrdinal:ordinal}:null}:{status:'refused',reason:'segment-missing-or-format'};
        return hooks.read?hooks.read(page,request):page;
      }};
    const coordinator=createCoordinator(adapter,currentIdentity);
    const readContext=()=>{readContextCalls++;eq(audit.get('hash'),0,'hash released before actual context reader');eq(audit.get('framing'),0,'framing released before reader');eq(audit.get('helper-hash'),0);eq(audit.get('helper-framing'),0);
      ok(audit.get('context-compare-read')>=65536,'reserve fresh story read before callback');return readerHook?readerHook(live):live;};
    stream=T.createContextStream({context,coordinator,readContext,expectedContext:original,budget,crypto});
    return {stream,context,budget,audit,observed,writes,retryWrites,reads,stored,hooks,commit,coordinator,original,text,
      createPhase({referenceOverride,expectedOverride,verifiedReference}={}){const reference=verifiedReference??stream.reference();P.validateFinalePhase(rawPhase,context,budget);const artifact=P.makeFinalePhase(rawPhase,context,reference,budget);const phaseStream=T.createPhaseStream({artifact,context,reference:referenceOverride??reference,coordinator,readContext,expectedContext:expectedOverride??original,budget,crypto});return {artifact,stream:phaseStream};},
      setRetained:x=>{retainedOverride=x;},setLease:x=>{lease=x;},setLive:x=>{live=x;},getLive:()=>live,setReader:x=>{readerHook=x;},readCount:()=>readContextCalls,maxActive:()=>maxActive};
  }
  await group('05 exact streaming source transport, sealed pin and unchanged modeled ceiling',async()=>{
    const h=await harness(),v=await h.stream.save(),expected=frameOracle(h.text,contextBinding());eq(v.state,'READY');
    eq(h.writes.map(q=>q.ordinal),[0,1,2]);eq(h.writes.map(q=>q.offset),[0,32768,65536]);eq(h.reads.map(q=>q.maxBytes),[32768,32768,32768]);
    eq(Buffer.concat([...h.stored.values()].map(s=>Buffer.from(s.payload))),expected);
    const reference=h.stream.reference();ok(Object.isFrozen(reference));eq(Object.keys(reference).sort(),['binding','run','scope','throughHead','version']);
    eq(reference.version,1);eq(reference.scope,SCOPE);eq(reference.run,`fc1:${SESSION}:8`);
    const head=await C.headToken(reference.throughHead,webcrypto);eq(head.binding,reference.binding);eq(head.sealed,true);eq(head.total,expected.length);eq(head.ordinal,2);
    const count=h.writes.length;eq((await h.stream.save()).state,'READY');eq((await h.stream.retry()).state,'READY');eq(h.writes.length,count);eq(h.stream.reference(),reference);
    eq(h.audit.get('stream-candidate'),0);eq(h.audit.get('returned-page'),0);eq(h.audit.get('context-parse'),0);eq(h.audit.get('context-restore'),0);
    ok(h.audit.peak<=1000448);eq(h.maxActive(),1);measurements.push({name:'maximum-raw-context-stream',peakReservedBytes:h.audit.peak,artifactBytes:expected.length,segments:3});
  });
  await group('06 exact immutable candidate and cursor retry at every context segment',async()=>{
    for(const reason of ['transaction-aborted','native-quota','logical-quota','open-blocked','busy'])for(const ordinal of [0,1,2]){
      const h=await harness();let failed=false;h.hooks.append=async(q,{commit})=>{if(q.ordinal===ordinal&&!failed){failed=true;return {status:'refused',reason};}return commit(q);};
      const v=await h.stream.save();eq(v.state,'UNSAVED');eq(v.reason,reason);eq(h.writes.length,ordinal+1);eq(h.reads.length,0);
      const candidate=h.writes.at(-1),bytes=Buffer.from(candidate.payload),cursor=v.cursor;ok(Object.isFrozen(candidate));
      eq((await h.stream.retry()).state,'READY');const retried=h.writes[ordinal+1];eq(retried,candidate);ok(retried===candidate,'same immutable request object');eq(Buffer.from(retried.payload),bytes);
      eq(candidate.ordinal,ordinal);eq(candidate.offset,ordinal*32768);if(cursor){eq(cursor.nextOrdinal,ordinal);eq(cursor.offset,ordinal*32768);}
      eq(h.retryWrites.length,0);eq(h.maxActive(),1);eq(h.audit.get('stream-candidate'),0);
    }
  });
  await group('07 unknown physical outcome retains one candidate until exact duplicate retry',async()=>{
    for(const ordinal of [0,1,2]){
      const h=await harness();let first=true;h.hooks.append=async(q,{commit})=>q.ordinal===ordinal&&first?(first=false,{status:'outcomeUnknown',reason:'terminal-unobserved'}):commit(q);
      const v=await h.stream.save();eq(v.state,'UNSAVED');eq(v.ownedUnknown,true);eq(h.reads.length,0);const candidate=h.writes.at(-1),before=Buffer.from(candidate.payload);
      eq(h.audit.get('stream-candidate'),candidate.payload.length);await h.commit(candidate);eq(h.stream.view().state,'UNSAVED');
      let pending=true;h.hooks.retry=async(q,{commit})=>pending?{status:'refused',reason:'busy'}:commit(q,'duplicate');
      eq((await h.stream.retry()).ownedUnknown,true);eq(h.writes.length,ordinal+1);eq(h.reads.length,0);eq(h.audit.get('returned-page'),0);
      pending=false;eq((await h.stream.retry()).state,'READY');eq(h.retryWrites.length,2);ok(h.retryWrites.every(q=>q===candidate));eq(Buffer.from(candidate.payload),before);eq(h.audit.get('stream-candidate'),0);
    }
  });
  await group('08 exact receipts reject relaxed, forged, newer, partial and unexpected terminal outcomes',async()=>{
    const changes=[r=>{delete r.receipt;},r=>{delete r.currentHead;},r=>{r.receipt.acknowledgement='request-success';},r=>{r.receipt.durability='relaxed';},
      r=>{r.receipt.captureIdentity.run='different';},r=>{r.receipt.ordinal++;},r=>{r.receipt.length--;},r=>{r.receipt.root=C.ZERO;},r=>{r.receipt.headToken='forged';},r=>{r.receipt.sealed=!r.receipt.sealed;},
      r=>{r.currentHead.binding=C.ZERO;},r=>{r.currentHead.total++;},r=>{r.currentHead.ordinal++;},r=>{r.currentHead.sealed=!r.currentHead.sealed;},r=>{r.currentHead.extra=true;}];
    for(const mutate of changes){const h=await harness();h.hooks.append=(q,{commit})=>commit(q,'committed',mutate);const v=await h.stream.save();eq(v.state,'BLOCKED');eq(h.reads.length,0);eq(h.writes.length,1);await h.stream.retry();eq(h.writes.length,1);}
    for(const status of ['future-success','pending','aborted']){const h=await harness();h.hooks.append=async()=>({status});eq((await h.stream.save()).state,'BLOCKED');eq(h.reads.length,0);}
  });
  await group('09 malformed pages and immutable pinned cursor cannot be adopted',async()=>{
    const changes=[p=>{p.segments[0].payload[0]^=1;},p=>{p.segments[0].payload=p.segments[0].payload.subarray(1);},p=>{p.throughHead='forged';},p=>{p.nextCursor=null;},p=>{delete p.nextCursor;},
      p=>{p.nextCursor.afterOrdinal=-1;},p=>{p.nextCursor.captureIdentity.run='other';},p=>{p.nextCursor.throughHead='newer';},p=>{p.payloadBytes--;},p=>{p.segments[0].offset++;},p=>{p.segments[0].ordinal++;},
      p=>{p.segments.push(p.segments[0]);},p=>{p.segments[0].root='malformed';},p=>{p.segments[0].root=C.ZERO;},p=>{p.extra=true;}];
    for(const mutate of changes){const h=await harness();h.hooks.read=p=>{if(h.reads.length===1)mutate(p);return p;};eq((await h.stream.save()).state,'BLOCKED');eq(h.reads.length,1);eq(h.audit.get('returned-page'),0);eq(h.audit.get('stream-candidate'),0);}
    const terminal=await harness();terminal.hooks.read=p=>{if(terminal.reads.length===3)p.nextCursor={captureIdentity:{scope:SCOPE,run:`fc1:${SESSION}:8`},throughHead:p.throughHead,afterOrdinal:2};return p;};eq((await terminal.stream.save()).state,'BLOCKED');eq(terminal.reads.length,3);
    const retry=await harness();let failed=false;retry.hooks.read=p=>{if(!failed){failed=true;return {status:'refused',reason:'native-quota'};}return p;};eq((await retry.stream.save()).state,'UNSAVED');const writes=retry.writes.length;eq((await retry.stream.retry()).state,'READY');eq(retry.writes.length,writes);eq(retry.reads.map(q=>q.afterOrdinal??-1),[-1,-1,0,1]);
  });
  await group('10 exact context/source replacement and generation bridge make staleness irreversible',async()=>{
    for(const change of [x=>({...x,storyText:x.storyText+' '}),x=>({...x,sourceText:'{"phase":1}'}),x=>({...x,sourceIdentity:'source:2'}),x=>({...x,generation:2}),x=>({...x,scope:'other'})]){
      const h=await harness();h.hooks.append=async(q,{commit})=>{const result=await commit(q);h.setLive(change(h.getLive()));return result;};eq((await h.stream.save()).state,'STALE');eq(h.writes.length,1);eq(h.reads.length,0);
      h.setLive({...h.original,storyText:h.text});eq((await h.stream.retry()).state,'STALE');eq(h.writes.length,1);
    }
    const aba=await harness(),entered=deferred(),release=deferred();aba.hooks.append=async(q,{commit})=>{entered.resolve();await release.promise;return commit(q);};
    const pending=aba.stream.save();await entered.promise;const original=aba.getLive();aba.setLive({...original,generation:2,storyText:'replacement'});aba.setLive({...original,generation:3});release.resolve();eq((await pending).state,'STALE');eq(aba.reads.length,0);
    const ready=await harness();eq((await ready.stream.save()).state,'READY');ready.setLive({...ready.getLive(),storyText:'replacement'});eq(ready.stream.view().state,'STALE');
  });
  await group('11 every delayed native WebCrypto await excludes reader from repeated busy controls',async()=>{
    const waiting=[];let wake=null,finished=false,hashes=0;
    const crypto={subtle:{async digest(...args){const pause=deferred();waiting.push(pause);wake?.();await pause.promise;return webcrypto.subtle.digest(...args);}}};
    const h=await harness({crypto}),pending=h.stream.save().finally(()=>{finished=true;wake?.();});
    while(!finished){
      if(!waiting.length)await new Promise(resolve=>{wake=resolve;});wake=null;const pause=waiting.shift();if(!pause)continue;
      hashes++;const reads=h.readCount();ok(h.audit.get('hash')>0||h.audit.get('helper-hash')>0);
      for(let i=0;i<4;i++){const v=h.stream.view();eq(v.reason,'busy');eq(v.ready,false);eq((await h.stream.retry()).reason,'busy');eq((await h.stream.save()).reason,'busy');eq(h.readCount(),reads);}
      pause.resolve();
    }
    eq((await pending).state,'READY');ok(hashes>=7,'descriptor, all three chains and all three heads delayed');ok(h.readCount()>0);eq(h.maxActive(),1);eq(h.audit.get('context-compare-read'),0);
    measurements.push({name:'delayed-native-sha256',delayedHashAwaits:hashes});
  });
  await group('12 storage single-flight and reader reentry are bounded',async()=>{
    const h=await harness(),entered=deferred(),release=deferred();h.hooks.append=async(q,{commit})=>{entered.resolve();await release.promise;return commit(q);};
    const p=h.stream.save();await entered.promise;for(let i=0;i<8;i++){eq((await h.stream.save()).reason,'busy');eq((await h.stream.retry()).reason,'busy');h.stream.view();}eq(h.writes.length,1);release.resolve();eq((await p).state,'READY');eq(h.maxActive(),1);
    const r=await harness();let calls=0;const reentered=[];r.setReader(live=>{calls++;if(calls===1){eq(r.stream.view().reason,'busy');reentered.push(r.stream.save(),r.stream.retry());}return live;});
    eq((await r.stream.save()).state,'READY');for(const operation of reentered)eq((await operation).reason,'busy');ok(calls<100);eq(r.maxActive(),1);
  });
  await group('13 reservation rejection is atomic and catches forbidden lifetime overlap',async()=>{
    eq(B.PHASE_BUDGET.ceiling,1016832);const {budget:b,audit}=observedBudget();eq(b.snapshot().live,425984);
    const fails=(label,n,re=/transient-budget|budget-lifetime|allocation-unreserved/)=>{const before=b.snapshot();assert.throws(()=>b.reserve(label,n),re);checks++;eq(b.snapshot(),before);};
    fails('untracked-context-copy',1);fails('context-retained',65537);assert.throws(()=>b.allocate('stream-candidate',1),/allocation-unreserved/);checks++;
    b.reserve('context-parse',65536);fails('phase-workspace',327680);b.release('context-parse',65536);
    b.reserve('phase-workspace',327680);fails('context-parse',65536);fails('context-restore',65536);fails('raw-capsule',65536);
    b.reserve('context-retained',65536);b.reserve('private-phase',16384);b.reserve('stream-candidate',32768);
    fails('stream-candidate',1);fails('returned-page',32768);fails('phase-assembly',16384);
    b.reserve('helper-framing',66048);b.reserve('helper-hash',66048);eq(b.snapshot().live,1000448);eq(audit.peak,1000448);fails('helper-hash',1);fails('context-compare-read',65536);
    b.release('helper-hash',66048);b.release('helper-framing',66048);b.reserve('context-compare-read',65536);fails('helper-hash',1);b.release('context-compare-read',65536);
    b.release('stream-candidate',32768);b.reserve('phase-assembly',16384);fails('returned-page',32768);b.reserve('returned-page',16384);fails('returned-page',1);
    const before=b.snapshot();assert.throws(()=>b.release('phase-assembly',16385),/transient-budget|budget-lifetime/);checks++;eq(b.snapshot(),before);
    eq(audit.check(),b.snapshot().live);eq(audit.peak,b.snapshot().peak);
  });
  await group('14 phase private snapshot, exact retry and bounded assembly/page overlap',async()=>{
    for(const failure of ['transaction-aborted','outcomeUnknown','read-failure']){
      const h=await harness({text:JSON.stringify(plan()),phase:fixtures.phases[0]});eq((await h.stream.save()).state,'READY');
      const {artifact,stream}=h.createPhase(),expected=Buffer.from(artifact.bytes),contextWrites=h.writes.length;artifact.bytes.fill(0);
      let first=true;
      h.hooks.append=async(q,{commit})=>{if(first&&failure!=='read-failure'){first=false;return failure==='outcomeUnknown'?{status:'outcomeUnknown',reason:'terminal-unobserved'}:{status:'refused',reason:failure};}return commit(q);};
      h.hooks.read=page=>{if(first&&failure==='read-failure'){first=false;return {status:'refused',reason:'native-quota'};}return page;};
      eq((await stream.save()).state,'UNSAVED');const candidate=h.writes.at(-1);eq(Buffer.from(candidate.payload),expected);eq(h.audit.get('private-phase'),expected.length);
      if(failure==='outcomeUnknown')h.hooks.retry=(q,{commit})=>commit(q,'duplicate');
      eq((await stream.retry()).state,'READY');eq(h.reads.at(-1).maxBytes,16384);eq(h.audit.get('phase-assembly'),0);eq(h.audit.get('returned-page'),0);
      if(failure==='transaction-aborted')ok(h.writes[contextWrites]===h.writes[contextWrites+1]);
      if(failure==='outcomeUnknown')ok(h.retryWrites[0]===candidate);
      if(failure==='read-failure')eq(h.writes.length,contextWrites+1);
      const stored=[...h.stored.values()].filter(s=>s.payload.length===expected.length);ok(stored.some(s=>Buffer.from(s.payload).equals(expected)));eq(h.maxActive(),1);ok(h.audit.peak<=1000448);
    }
  });
  await group('15 unknown capability loss, settled abort and stale unknown never invent a replacement',async()=>{
    for(const mode of ['missing-lease','retained-after-ack','no-retry']){
      const h=await harness();h.hooks.append=async()=>({status:'outcomeUnknown',reason:'terminal-unobserved'});
      if(mode==='missing-lease')h.setRetained(0);let v=await h.stream.save();
      if(mode==='retained-after-ack'){h.setRetained(512);h.hooks.retry=(q,{commit})=>commit(q,'duplicate');v=await h.stream.retry();}
      if(mode==='no-retry'){h.hooks.retry=async()=>({status:'refused',reason:'no-retry'});v=await h.stream.retry();}
      eq(v.state,'BLOCKED');eq(v.reason,'retry-capability');eq(h.writes.length,1);eq(h.reads.length,0);
    }
    const aborted=await harness();let unknown=true;aborted.hooks.append=async(q,{commit})=>unknown?(unknown=false,{status:'outcomeUnknown',reason:'terminal-unobserved'}):commit(q);
    eq((await aborted.stream.save()).ownedUnknown,true);const candidate=aborted.writes[0];aborted.hooks.retry=async(_q,{setLease})=>{setLease(null);return {status:'refused',reason:'transaction-aborted'};};
    eq((await aborted.stream.retry()).ownedUnknown,false);eq((await aborted.stream.retry()).state,'READY');ok(aborted.writes[1]===candidate);eq(aborted.retryWrites.length,1);
    const stale=await harness();stale.hooks.append=async()=>({status:'outcomeUnknown',reason:'terminal-unobserved'});eq((await stale.stream.save()).ownedUnknown,true);
    const original=stale.getLive();stale.setLive({...original,generation:2});eq(stale.stream.view().state,'STALE');stale.setLive({...original,generation:3});
    eq((await stale.stream.retry()).state,'STALE');eq(stale.retryWrites.length,0);eq(stale.reads.length,0);eq(stale.audit.get('stream-candidate'),32768);
  });
  await group('16 stream readback never assembles, UTF-8 encodes or reparses a full context',async()=>{
    const text=realLongPlan(),h=await harness({text}),total=F.describeContext(h.context).total;
    const parse=JSON.parse,restore=Story.restore,encode=TextEncoder.prototype.encode,Original=globalThis.Uint8Array;let fullParses=0,fullRestores=0;
    JSON.parse=function(value,...args){if(value===text)fullParses++;return parse.call(this,value,...args);};
    Story.restore=function(value,...args){if(value?.n===8&&value?.phase==='core')fullRestores++;return restore.call(this,value,...args);};
    TextEncoder.prototype.encode=function(value){ok(!(typeof value==='string'&&value.includes(text)),'no full UTF-8 context expansion');return encode.call(this,value);};
    globalThis.Uint8Array=new Proxy(Original,{construct(target,args){const n=typeof args[0]==='number'?args[0]:args[0]?.byteLength;ok(!(n>=total),'no full context typed-array allocation');return Reflect.construct(target,args,target);}});
    try{eq((await h.stream.save()).state,'READY');eq(fullParses,0);eq(fullRestores,0);}finally{JSON.parse=parse;Story.restore=restore;TextEncoder.prototype.encode=encode;globalThis.Uint8Array=Original;}
    const expected=frameOracle(text,contextBinding());eq(Buffer.concat([...h.stored.values()].map(s=>Buffer.from(s.payload))),expected);
    for(const file of ['finale-context-v1.mjs','context-stream.mjs']){const source=fs.readFileSync(path.join(root,file),'utf8');ok(!/\bC\.(?:frame|unframe)\s*\(|\bassemble\s*\(|\barchive\s*\(/.test(source),'no forbidden full-frame helper in '+file);}
  });
  await group('17 observer reentry cannot change admitted context and copied pins are not verified capabilities',async()=>{
    const input=contextInput(),before=clone(input),a=ledger();a.reserve('metadata',32768);a.reserve('context-retained',65536);
    const record=a.event.bind(a);let changed=false;a.event=(name,detail)=>{record(name,detail);if(name==='context-story-restore'){changed=true;input.storyText='replacement';input.scope='other';input.session='f'.repeat(32);input.binding.chapter=9;}};
    const capsule=F.admitContext(input,a);ok(changed);ok(F.matchesContextText(capsule,before.storyText));eq(F.describeContext(capsule).descriptor.scope,before.scope);eq(F.describeContext(capsule).summary.chapter,8);
    const expected=frameOracle(before.storyText,before.binding),bytes=F.copyContextRange(capsule,0,expected.length,a);eq(Buffer.from(bytes),expected);a.release('stream-candidate',bytes.length);
    const h=await harness({text:JSON.stringify(plan()),phase:fixtures.phases[0]});eq((await h.stream.save()).state,'READY');const reference=h.stream.reference();
    assert.throws(()=>h.createPhase({referenceOverride:{...reference}}),/context-pin-unverified/);checks++;eq(h.audit.get('private-phase'),0);
    assert.throws(()=>h.createPhase({referenceOverride:Object.freeze({...reference,throughHead:'forged'})}),/context-pin-unverified/);checks++;eq(h.audit.get('private-phase'),0);
    const phaseStream=h.createPhase().stream;eq((await phaseStream.save()).state,'READY');ok(!('continue' in h.stream));ok(!('continue' in phaseStream));
  });
  await group('18 phase artifact source must equal the source used by current-context checks',async()=>{
    for(const replacement of ['raw-whitespace','accumulated-seconds']){
      const h=await harness({text:JSON.stringify(plan()),phase:fixtures.phases[0]});eq((await h.stream.save()).state,'READY');
      const verifiedReference=h.stream.reference(),before=h.writes.length,sourceText=replacement==='raw-whitespace'?h.original.sourceText+' ':JSON.stringify({...JSON.parse(h.original.sourceText),seconds:1});
      const expectedOverride={...h.original,sourceText};h.setLive({...h.getLive(),sourceText});
      assert.throws(()=>h.createPhase({expectedOverride,verifiedReference}),/phase-source-mismatch/,'valid artifact cannot be archived against a different exact current source');checks++;
      eq(h.writes.length,before);eq(h.audit.get('private-phase'),0,'failed constructor releases private snapshot');
    }
  });
  await group('19 delayed read holds one charged page and checks freshness again after settlement',async()=>{
    for(const mode of ['unchanged','story-replaced','source-replaced','reader-throws']){
      const h=await harness(),entered=deferred(),release=deferred();let paused=false;
      h.hooks.read=async page=>{if(!paused){paused=true;entered.resolve();await release.promise;}return page;};
      const pending=h.stream.save();await entered.promise;eq(h.audit.get('returned-page'),32768);eq(h.audit.get('stream-candidate'),0);eq(h.audit.get('phase-workspace'),327680);eq(h.audit.get('context-parse'),0);
      const reads=h.readCount();for(let i=0;i<4;i++){eq(h.stream.view().ready,false);eq((await h.stream.retry()).reason,'busy');}eq(h.readCount(),reads);
      assert.throws(()=>h.stream.reference(),/context-pin-unavailable/);checks++;
      if(mode==='story-replaced')h.setLive({...h.getLive(),storyText:'replacement'});
      if(mode==='source-replaced')h.setLive({...h.getLive(),sourceText:'replacement'});
      if(mode==='reader-throws')h.setReader(()=>{throw Error('unavailable source');});
      release.resolve();eq((await pending).state,mode==='unchanged'?'READY':'STALE');eq(h.audit.get('returned-page'),0);
      if(mode!=='unchanged'){eq(h.reads.length,1);eq((await h.stream.retry()).state,'STALE');}
    }
  });
  const report={test:'evidence-context-stream',status:'pass',groups:groups.length,checks,groupNames:groups,measurements,
    sharedCeiling:1016832,transport:'deterministic mocked source transport',crypto:'native WebCrypto SHA-256',nativeIndexedDB:'not-run',browserOrSocket:'not-used',serverAuthority:false,productionReady:false,
    baseline:{suite:'unchanged v1 makeFinaleCompletion',storyUtf16:38628,traceRows:911,newBehaviorAssertion:'assert.doesNotThrow',result:'failed as expected: finale-limit; exit 1'},
    limitations:['encoded representation reservations, not JavaScript heap/RSS','source-only transport doubles do not establish native commit or persistence','no lifecycle/controller/continuation or publication evidence']};
  if(process.env.MKTY_CONTEXT_STREAM_REPORT)fs.writeFileSync(process.env.MKTY_CONTEXT_STREAM_REPORT,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
})().catch(error=>{console.error(error);process.exitCode=1;});
