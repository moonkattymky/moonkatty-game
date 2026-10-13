'use strict';
// Portable synthetic archive transport. This is not IndexedDB/native durability.
const assert=require('node:assert/strict'),path=require('node:path'),{webcrypto}=require('node:crypto'),{pathToFileURL}=require('node:url');
const Codec=require('../trace-codec.js'),F=require('./evidence-finale-controller-fixture.cjs');
const SCOPE='fixture:shared-two-action',SESSION='0123456789abcdef0123456789abcdef',PRINCIPAL='guest:source-test',DAY='2026-10-12';
const url=name=>pathToFileURL(path.join(__dirname,'../prototypes/evidence-indexeddb',name)).href;
const clone=v=>JSON.parse(Codec.stringify(v)),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const timestamps=n=>({storyAccumulated:n,report:n+1,pace:n+2,storyCompleted:n+3,lock:n+4});
const baseline=()=>({points:2100,life:null,awarded:null,completedAt:null,finalPoints:null,lockedAt:null,operationsText:null});
const daily=()=>({cday:DAY,streak:0,attempts:2,solved:true,codes:['MOONTEST',17],cipher:{opaque:'signal'},opaque:{units:'界🌙\ud800'},shield_week:'2026-W01'});
function rawRecord(payload,ordinal){const start=ordinal===0?20:0,dv=new DataView(payload.buffer,payload.byteOffset,payload.byteLength),n=dv.getUint32(start+4,true);
  let text='';for(let i=0;i<n;i+=2)text+=String.fromCharCode(dv.getUint16(start+8+i,true));return JSON.parse(text);}
async function archive(scope=SCOPE,shared){
  const C=await import(url('contract.mjs')),state=shared||{entries:new Map(),events:[],serial:Promise.resolve(),race:null};
  let held=null,mode=null,readMode=null,busy=false,beforeInsert=null;
  const snap=q=>({...q,descriptor:clone(q.descriptor),payload:new Uint8Array(q.payload),...(q.seal?{seal:clone(q.seal)}:{})});
  const enqueue=fn=>{const p=state.serial.then(fn);state.serial=p.catch(()=>{});return p;};
  function receipt(q,h){return {captureIdentity:{scope,run:q.descriptor.run},ordinal:q.ordinal,length:q.payload.length,root:h.root,headToken:h.token,
    sealed:h.sealed,acknowledgement:'idb-transaction-complete',durability:'strict'};}
  async function append(q,retrying=false,guard=null){
    if(guard&&!guard())return {status:'refused',reason:'stale-context'};
    const failure=mode;mode=null;if(!retrying&&['abort','quota'].includes(failure))return {status:'refused',reason:failure==='abort'?'transaction-aborted':'native-quota'};
    if(!retrying&&failure==='unknown-abort'){held=snap(q);return {status:'outcomeUnknown',reason:'terminal-unobserved'};}
    const d=await C.descriptor(q.descriptor,webcrypto),root=await C.chain(d,q,q.payload,webcrypto),sealed=!!q.seal;
    if(q.seal&&(q.seal.totalBytes!==q.offset+q.payload.length||q.seal.totalBytes!==d.total||q.seal.root!==root))return {status:'refused',reason:'seal-mismatch'};
    const head=await C.makeHead(d,q.ordinal,q.offset+q.payload.length,root,sealed,webcrypto);
    if(beforeInsert){const hook=beforeInsert;beforeInsert=null;hook();}if(guard&&!guard())return {status:'refused',reason:'stale-context'};
    const old=state.entries.get(q.descriptor.run),segment=old?.segments[q.ordinal];
    let result;
    if(segment){
      if(!same(old.pin.descriptor,q.descriptor)||!C.equalBytes(segment.payload,q.payload)||segment.root!==root||segment.offset!==q.offset||segment.sealed!==sealed)result={status:'conflict',reason:'immutable-segment'};
      else result={status:'duplicate',receipt:receipt(q,head),currentHead:clone(old.pin.head)};
    }else if((old?.pin.head.token??null)!==q.expectedHead)result={status:'conflict',reason:'expected-head'};
    else if(old?.pin.head.sealed||q.ordinal!==(old?old.pin.head.ordinal+1:0)||q.offset!==(old?.pin.head.total??0)||q.previousRoot!==(old?.pin.head.root??C.ZERO))result={status:'conflict',reason:'position'};
    else{
      const entry=old||{pin:null,segments:[],history:new Map()};
      entry.pin={descriptor:clone(q.descriptor),head};entry.segments.push({ordinal:q.ordinal,offset:q.offset,length:q.payload.length,root,payload:new Uint8Array(q.payload),sealed});
      entry.history.set(head.token,clone(head));state.entries.set(q.descriptor.run,entry);
      result={status:'committed',receipt:receipt(q,head),currentHead:clone(head)};
    }
    state.events.push({type:'result',run:q.descriptor.run,ordinal:q.ordinal,status:result.status});
    if(!retrying&&failure==='unknown-commit'&&['committed','duplicate'].includes(result.status)){held=snap(q);return {status:'outcomeUnknown',reason:'terminal-unobserved'};}
    return result;
  }
  const api={scope,entries:state.entries,events:state.events,get retainedBytes(){return held?.payload.length||0;},get physicalBusy(){return busy;},
    async fork(){return archive(scope,state);},setMode(value){mode=value;},setReadMode(value){readMode=value;},setBusy(value){busy=value;},beforeInsert(fn){beforeInsert=fn;},
    retained(){return held?snap(held):null;},snapshot(){return [...state.entries].map(([run,e])=>({run,pin:clone(e.pin),segments:e.segments.map(s=>({...s,payload:Buffer.from(s.payload).toString('hex')}))}));},
    raceNext(order){assert(!state.race);state.race={order,waiting:[]};},
    async rehash(run){ // Explicitly adversarial test repair; ordinary append cannot mutate old bytes.
      const e=state.entries.get(run),d=await C.descriptor(e.pin.descriptor,webcrypto);e.history.clear();let root=C.ZERO;
      for(const s of e.segments){root=await C.chain(d,{ordinal:s.ordinal,offset:s.offset,previousRoot:root},s.payload,webcrypto);s.root=root;
        const head=await C.makeHead(d,s.ordinal,s.offset+s.length,root,s.sealed,webcrypto);e.history.set(head.token,clone(head));e.pin={descriptor:e.pin.descriptor,head};}
      return clone(e.pin);
    },
    async rewrite(run,ordinal,mutate){const e=state.entries.get(run),s=e.segments[ordinal],r=rawRecord(s.payload,ordinal);mutate(r);
      const start=ordinal===0?20:0,text=JSON.stringify(r),dv=new DataView(s.payload.buffer);assert(text.length*2<=s.length-start-8);
      s.payload.fill(0,start+8);dv.setUint32(start+4,text.length*2,true);for(let i=0;i<text.length;i++)dv.setUint16(start+8+i*2,text.charCodeAt(i),true);return api.rehash(run);
    },

    async seal(descriptor,bytes,size=16384){
      const d=await C.descriptor(descriptor,webcrypto),entry={pin:null,segments:[],history:new Map()};let previousRoot=C.ZERO,offset=0,ordinal=0;
      while(offset<bytes.length){const payload=bytes.slice(offset,Math.min(offset+size,bytes.length)),root=await C.chain(d,{ordinal,offset,previousRoot},payload,webcrypto),sealed=offset+payload.length===bytes.length;
        const head=await C.makeHead(d,ordinal,offset+payload.length,root,sealed,webcrypto);entry.segments.push({ordinal,offset,length:payload.length,root,payload,sealed});
        entry.pin={descriptor:clone(descriptor),head};entry.history.set(head.token,clone(head));previousRoot=root;offset+=payload.length;ordinal++;}
      state.entries.set(descriptor.run,entry);return clone(entry.pin);
    },
    async recover({cursor}){
      state.events.push({type:'catalog'});if(held||busy)return {status:'refused',reason:held?'retry-pending':'busy'};
      const rows=[...state.entries.values()],index=cursor===null?0:Number(cursor||0),e=rows[index];
      return {status:'page',heads:e?[{captureIdentity:{scope,run:e.pin.descriptor.run},...clone(e.pin),sealed:e.pin.head.sealed,acknowledgement:'idb-transaction-complete',durability:'strict'}]:[],
        watermark:rows.length,nextCursor:index+1<rows.length?String(index+1):null};
    },
    async readSegments(q){
      state.events.push({type:'read',run:q.captureIdentity.run,afterOrdinal:q.afterOrdinal,maxBytes:q.maxBytes});
      if(held||busy)return {status:'refused',reason:held?'retry-pending':'busy'};
      if(readMode&&q.captureIdentity.run.startsWith('fshared1:')){const m=readMode;readMode=null;if(m==='refuse')return {status:'refused',reason:'transaction-aborted'};}
      const e=state.entries.get(q.captureIdentity.run),h=e?.history.get(q.throughHead),s=e?.segments[q.afterOrdinal+1];
      if(!h||!s||s.ordinal>h.ordinal)return {status:'refused',reason:'missing'};
      if(s.length>q.maxBytes)return {status:'refused',reason:'page-limit'};
      const {sealed,...part}=s;
      return {status:'page',segments:[{...part,payload:new Uint8Array(s.payload)}],payloadBytes:s.length,throughHead:q.throughHead,
        nextCursor:s.ordinal<h.ordinal?{captureIdentity:{...q.captureIdentity},throughHead:q.throughHead,afterOrdinal:s.ordinal}:null};
    },
    async appendSegment(input,guard=null){
      state.events.push({type:'append',run:input.descriptor.run,ordinal:input.ordinal,expectedHead:input.expectedHead,guard:typeof guard==='function'});
      if(held||busy)return {status:'refused',reason:held?'retry-pending':'busy'};if(guard&&!guard())return {status:'refused',reason:'stale-context'};C.snapshotRequest(input);const q=snap(input),race=state.race;
      if(race&&q.descriptor.run.startsWith('fshared1:')&&q.ordinal>0)return new Promise((resolve,reject)=>{
        race.waiting.push({q,kind:rawRecord(q.payload,q.ordinal).command.kind,run:()=>append(q,false,guard),resolve,reject});
        if(race.waiting.length===race.order.length){state.race=null;for(const item of race.waiting.sort((a,b)=>race.order.indexOf(a.kind)-race.order.indexOf(b.kind)))enqueue(item.run).then(item.resolve,item.reject);}
      });
      return enqueue(()=>append(q,false,guard));
    },
    async retry(guard=null){state.events.push({type:'retry',guard:typeof guard==='function'});if(busy)return {status:'refused',reason:'busy'};if(!held)return {status:'refused',reason:'no-retry'};
      const q=held;return enqueue(async()=>{const result=await append(q,true,guard);if(result.status!=='outcomeUnknown'&&result.reason!=='stale-context')held=null;return result;});}
  };
  return api;
}
async function fixture({scope=SCOPE,storyText=JSON.stringify(F.plan(9)),mutateManifest,phaseInput,intent=timestamps(10000)}={}){
  const [C,X,P,B,O]=await Promise.all(['contract.mjs','finale-context-v1.mjs','finale-phase-v2.mjs','phase-budget.mjs','shared-guest-owner.mjs'].map(n=>import(url(n))));
  const adapter=await archive(scope),budget=B.createPhaseBudget(),p=F.phases[4],baseSeed=(p.seed-p.index*7919)>>>0;
  const binding={version:1,session:SESSION,chapter:9,edition:2,baseSeed,storyKey:F.storyKey(9),sourceKey:F.sourceKey(9),route:'spatial-finale'};
  budget.reserve('context-retained',storyText.length*2);const context=X.admitContext({scope,session:SESSION,storyText,binding},budget);
  const contextPin=await adapter.seal(X.describeContext(context).descriptor,C.frame([{name:'story',encoding:'utf16le',text:storyText},{name:'binding',encoding:'utf16le',text:Codec.stringify(binding)}]).bytes,32768);
  const reference={version:1,scope,run:contextPin.descriptor.run,binding:contextPin.head.binding,throughHead:contextPin.head.token},source={version:1,n:9,phase:2,seed:baseSeed,seconds:7};
  const input={scope,session:SESSION,checkpoint:clone(p.state),sourceText:JSON.stringify({...source,checkpoint:p.state}),binding:F.binding(p,{...clone(p.provenance),terminalIntent:clone(intent)})};phaseInput?.(input);
  budget.reserve('raw-capsule',65536);const raw=P.freezeFinalePhase(input,budget);budget.release('raw-capsule',65536);budget.reserve('phase-workspace',327680);
  const artifact=P.makeFinalePhase(raw,context,reference,budget),phasePin=await adapter.seal(artifact.descriptor,artifact.bytes);
  budget.release('phase-workspace',327680);budget.release('context-retained',storyText.length*2);
  const manifest={version:1,contract:'guest-two-action-owner-v1',principal:PRINCIPAL,scope,session:SESSION,contextPin,source,
    gameContext:{legacy:clone(p.provenance.legacyAtCapture),precision:clone(p.provenance.precisionAtCapture),modifiers:clone(p.state.mods)},baseline:baseline(),
    entry:{origin:'new-disposable-guest',accountScope:'guest',initData:'',pendingQueueText:null},dailyDay:DAY,dailyText:JSON.stringify(daily())};mutateManifest?.(manifest);
  function owner({module=O,transport=adapter,observe,day=()=>DAY,crypto=webcrypto}={}){const budget=B.createPhaseBudget({observe}),owner=module.createSharedGuestOwner({adapter:transport,scope,session:SESSION,principal:PRINCIPAL,budget,crypto,admissionDay:day});return {owner,budget};}
  return {adapter,manifest,phasePin,storyText,intent,owner};
}
function clean(budget){for(const [label,n]of Object.entries(budget.snapshot().reservations))if(!['adapter','metadata'].includes(label))assert.equal(n,0,label);}
module.exports={archive,fixture,clean,clone,rawRecord,url,F,SCOPE,SESSION,PRINCIPAL,DAY,daily,timestamps,webcrypto};
