'use strict';
// Deterministic gate/coordinator doubles. NO native IndexedDB, durability or
// browser behavior is established by this socket-free source suite.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'../prototypes/evidence-indexeddb');
const url=name=>pathToFileURL(path.join(root,name)).href;
let checks=0,serial=0;
const eq=(a,b,note)=>{assert.deepStrictEqual(a,b,note);checks++;};
const ok=(v,note)=>{assert(v,note);checks++;};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const groups=[];
(async()=>{
  const C=await import(url('contract.mjs'));
  const S=await import(url('synthetic-completion.mjs'));
  const {createCoordinator}=await import(url('coordinator.mjs'));
  const fresh=()=>import(url('unsaved-result-gate.mjs')+'?case='+ ++serial);
  function capture(totalBytes=196608,extra={}){
    return {...S.makeSyntheticCompletion({scope:'fixture:A',run:'result:1',totalBytes,
      summary:{version:1,resultId:'result:1',completedSteps:7,label:'Synthetic result 🐈'}}),
      context:{scope:'fixture:A',generation:1,sourceIdentity:'source:1'},...extra};
  }
  async function harness(options={}){
    const module=options.module||await fresh();
    let live={scope:'fixture:A',generation:1,sourceIdentity:'source:1'},lease=null,readerHook=null;
    const stored=new Map(),writes=[],retryWrites=[],reads=[],nav=[],hooks={append:null,retry:null,read:null};
    let active=0,maxActive=0,retainedOverride=null;
    const readContext=()=>readerHook?readerHook():live;
    async function commit(q,status='committed',mutate){
      const d=await C.descriptor(q.descriptor),rootHash=await C.chain(d,q,q.payload),end=q.offset+q.payload.length;
      const head=await C.makeHead(d,q.ordinal,end,rootHash,!!q.seal);
      if(!stored.has(q.ordinal))stored.set(q.ordinal,{ordinal:q.ordinal,offset:q.offset,length:q.payload.length,root:rootHash,payload:new Uint8Array(q.payload)});
      const result={status,receipt:{captureIdentity:{scope:q.descriptor.scope,run:q.descriptor.run},ordinal:q.ordinal,length:q.payload.length,
        root:rootHash,headToken:head.token,sealed:!!q.seal,acknowledgement:'idb-transaction-complete',durability:'strict'},currentHead:head};
      mutate?.(result);return result;
    }
    async function operation(q,retrying){
      active++;maxActive=Math.max(maxActive,active);
      try{
        (retrying?retryWrites:writes).push({ordinal:q?.ordinal,q});
        const hook=retrying?hooks.retry:hooks.append;
        const result=hook?await hook(q,{commit,retrying,setLease:v=>{lease=v;}}):await commit(q);
        if(result.status==='outcomeUnknown')lease=q;
        else if(retrying&&['committed','duplicate'].includes(result.status))lease=null;
        return result;
      }finally{active--;}
    }
    const adapter={appendSegment:q=>operation(q,false),retry:()=>lease?operation(lease,true):Promise.resolve({status:'refused',reason:'no-retry'}),
      async readSegments(request){
        reads.push({...request});
        const ordinal=(request.afterOrdinal??-1)+1,s=stored.get(ordinal),last=await C.headToken(request.throughHead);
        const page=s?{status:'page',segments:[{...s,payload:new Uint8Array(s.payload)}],payloadBytes:s.length,throughHead:request.throughHead,
          nextCursor:ordinal<last.ordinal?{captureIdentity:{...request.captureIdentity},throughHead:request.throughHead,afterOrdinal:ordinal}:null}:
          {status:'refused',reason:'segment-missing-or-format'};
        return hooks.read?hooks.read(page,request):page;
      },recover:async()=>({status:'heads',items:[]}),get retainedBytes(){return retainedOverride??(lease?lease.payload.length+512:0);}};
    const coordinator=createCoordinator(adapter,readContext);
    let gate;
    gate=module.createUnsavedResultGate({coordinator,readContext,onContinue(){nav.push('navigate');options.onContinue?.(gate);}});
    return {module,gate,adapter,coordinator,hooks,stored,writes,retryWrites,reads,nav,commit,
      setLive:value=>{live=value;},getLive:()=>live,setReader:value=>{readerHook=value;},
      setLease:value=>{lease=value;},setRetained:value=>{retainedOverride=value;},maxActive:()=>maxActive};
  }
  const group=async(name,fn)=>{await fn();groups.push(name);};
  await group('01 success one and three segments; explicit once-only Continue',async()=>{
    for(const n of [256,196608]){
      const h=await harness(),input=capture(n),v=await h.gate.accept(input);
      eq(v.state,'READY');eq(h.nav.length,0);eq(v.continueEnabled,true);eq(v.retryEnabled,false);
      eq(h.writes.map(x=>x.ordinal),n===256?[0]:[0,1,2]);eq(v.checkpoint.offset,n);eq(v.checkpoint.nextOrdinal,Math.ceil(n/65536));
      eq(h.reads.length,Math.ceil(n/65536));eq(v.diagnostics.admissions,2);eq(v.diagnostics.captureCount,1);
      eq(v.diagnostics.wholeArtifactCopies,1);eq(v.diagnostics.maxOutstanding,1);eq(h.maxActive(),1);
      eq(v.diagnostics.modeledEnvelopeBytes,2*n+65536+32768+132096+393216);
      ok(v.diagnostics.modeledPeakBytes<=v.diagnostics.modeledEnvelopeBytes);
      eq(v.diagnostics.helperHashLive,0);eq(v.diagnostics.readbackBytes,0);eq(v.diagnostics.pageReservationBytes,0);
      eq((await h.gate.retry()).state,'READY');eq(h.writes.length,Math.ceil(n/65536));
      eq(h.gate.continue().state,'CONTINUED');h.gate.continue();await h.gate.retry();await h.gate.accept(input);
      eq(h.nav.length,1);eq(h.gate.view().diagnostics.navigationCalls,1);eq(h.gate.view().retained,true);
    }
  });
  await group('02 immutable bounded capture; malformed ownership refusal; summary binding',async()=>{
    const h=await harness(),input=capture(),original=new Uint8Array(input.bytes),wait=deferred(),entered=deferred();
    h.hooks.append=async(q,{commit})=>{if(q.ordinal===0){entered.resolve();await wait.promise;}return commit(q);};
    const pending=h.gate.accept(input);await entered.promise;
    input.bytes.fill(0);input.descriptor.components[0].length=0;input.descriptor.scope='evil';input.context.sourceIdentity='evil';
    wait.resolve();eq((await pending).state,'READY');
    const reassembled=Buffer.concat([...h.stored.values()].map(s=>Buffer.from(s.payload)));eq(reassembled,Buffer.from(original));
    const view=h.gate.view();ok(Object.isFrozen(view.summary));assert.throws(()=>{view.summary.label='evil';});checks++;
    eq(view.diagnostics.modeledEnvelopeBytes,1016832);eq(view.summary.label,'Synthetic result 🐈');
    const second=h.module.createUnsavedResultGate({coordinator:h.coordinator,readContext:h.getLive,onContinue(){throw Error('never');}});
    eq((await second.accept(capture())).reason,'realm-capture-retained');eq(second.view().retained,false);
    const bads=[x=>({...x,extra:1}),x=>({...x,summary:{...x.summary,extra:true}}),x=>({...x,summary:{...x.summary,label:'\u0000'.repeat(2048)}}),
      x=>({...x,bytes:new Uint8Array(196609)}),x=>({...x,context:{...x.context,generation:-1}}),x=>({...x,context:{...x.context,extra:true}}),
      x=>{Object.defineProperty(x,'bytes',{enumerable:true,get(){throw Error('getter invoked');}});return x;},
      x=>{Object.defineProperty(x.summary={...x.summary},'label',{enumerable:true,get(){throw Error('getter invoked');}});return x;},
      x=>{const a=x.descriptor.components;delete a[0];return x;},
      x=>{x.descriptor.components[0]={...x.descriptor.components[0],encoding:'opaque'};return x;},
      x=>{x.bytes[0]^=1;return x;},x=>{x.bytes[20]^=1;return x;},x=>{x.bytes[x.bytes.length-1]=121;return x;},
      x=>({...x,summary:{...x.summary,completedSteps:8}}),
      x=>{const p=new Uint8Array(128);Object.defineProperty(p,'length',{value:1});return {...x,bytes:p};}];
    if(typeof SharedArrayBuffer==='function')bads.push(x=>({...x,bytes:new Uint8Array(new SharedArrayBuffer(256))}));
    bads.push(x=>{const b=new Uint8Array(256);structuredClone(b.buffer,{transfer:[b.buffer]});return {...x,bytes:b};});
    for(const bad of bads){const k=await harness();const v=await k.gate.accept(bad(capture(256)));eq(v.state,'EMPTY');eq(v.retained,false);
      eq(k.writes.length,0);eq(v.diagnostics.capturedBytes,0);eq((await k.gate.accept(capture(256))).state,'READY');}
    const stringify=JSON.stringify;let serializations=0;
    try{
      JSON.stringify=(...args)=>{serializations++;return stringify(...args);};
      assert.throws(()=>S.describeSyntheticSummary({version:1,resultId:'\u0000'.repeat(128),completedSteps:7,label:'\u0000'.repeat(2048)}),/summary-limit/);checks++;
      eq(serializations,0);
    }finally{JSON.stringify=stringify;}
    for(let i=0;i<64;i++){
      const summary={version:1,resultId:'id'+String.fromCharCode(i),completedSteps:Number.MAX_SAFE_INTEGER,label:'a😀'+String.fromCharCode(i,0xd800+i,0xdc00+i,0xd800)+'\\"'};
      const described=S.describeSyntheticSummary(summary);eq(described.length,Buffer.byteLength(JSON.stringify(summary)));
    }
    const source=fs.readFileSync(path.join(root,'synthetic-completion.mjs'),'utf8');
    ok(!/TextDecoder|unframe\s*\(|\.repeat\s*\(/.test(source));
    const bytes=capture().bytes,descriptor=capture().descriptor,s=C.utf8(S.describeSyntheticSummary(capture().summary).text);
    eq(S.admitSyntheticCompletion(bytes,descriptor,s),true);eq(bytes.length,196608);
  });
  await group('03 known refusal or observed abort at every ordinal preserves prefix',async()=>{
    for(const failure of ['transaction-aborted','native-quota','logical-quota','open-blocked','busy'])for(const ordinal of [0,1,2]){
      const h=await harness();let failed=false;
      h.hooks.append=async(q,{commit})=>{if(q.ordinal===ordinal&&!failed){failed=true;return {status:'refused',reason:failure};}return commit(q);};
      const v=await h.gate.accept(capture());eq(v.state,'UNSAVED');eq(v.reason,failure);eq(v.checkpoint.nextOrdinal,ordinal);
      eq(v.checkpoint.offset,ordinal*65536);eq(h.nav.length,0);eq(v.retained,true);eq(v.continueEnabled,false);
      eq(h.gate.continue().state,'UNSAVED');eq((await h.gate.retry()).state,'READY');
      eq(h.writes.map(x=>x.ordinal),[...Array(ordinal+1).keys(),...Array.from({length:3-ordinal},(_,i)=>i+ordinal)]);
      eq(h.writes[ordinal].q,h.writes[ordinal+1].q);eq(h.retryWrites.length,0);eq(h.nav.length,0);
    }
  });
  await group('04 owned unknown and late commit require exact duplicate retry',async()=>{
    const h=await harness();let unknown=true;
    h.hooks.append=async(q,{commit})=>{if(q.ordinal===1&&unknown){unknown=false;return {status:'outcomeUnknown',reason:'terminal-unobserved'};}return commit(q);};
    let v=await h.gate.accept(capture());eq(v.state,'UNSAVED');eq(v.ownedUnknown,true);eq(v.checkpoint.nextOrdinal,1);
    const q=h.writes[1].q;await h.commit(q);eq(h.gate.view().state,'UNSAVED');eq(h.nav.length,0);
    let physicalPending=true;h.hooks.retry=async(q,{commit})=>physicalPending?{status:'refused',reason:'busy'}:commit(q,'duplicate');
    v=await h.gate.retry();eq(v.reason,'busy');eq(v.ownedUnknown,true);eq(h.writes.length,2);
    physicalPending=false;v=await h.gate.retry();eq(v.state,'READY');eq(h.retryWrites.map(x=>x.ordinal),[1,1]);
    ok(h.retryWrites.every(x=>x.q===q));eq(h.writes.map(x=>x.ordinal),[0,1,2]);eq(h.nav.length,0);h.gate.continue();eq(h.nav.length,1);
  });
  await group('05 unknown abort release versus retained pretransaction refusal; capability mismatch',async()=>{
    for(const release of [false,true]){
      const h=await harness();let unknown=true;
      h.hooks.append=async(q,{commit})=>{if(unknown){unknown=false;return {status:'outcomeUnknown',reason:'terminal-unobserved'};}return commit(q);};
      eq((await h.gate.accept(capture(256))).ownedUnknown,true);
      let first=true;h.hooks.retry=async(q,{commit,setLease})=>{if(first){first=false;if(release)setLease(null);return {status:'refused',reason:release?'transaction-aborted':'open-blocked'};}return commit(q);};
      let v=await h.gate.retry();eq(v.state,'UNSAVED');eq(v.ownedUnknown,!release);eq(h.writes.length,1);eq(h.retryWrites.length,1);
      v=await h.gate.retry();eq(v.state,'READY');eq(h.writes.length,release?2:1);eq(h.retryWrites.length,release?1:2);eq(h.nav.length,0);
    }
    for(const reason of ['busy','open-blocked','operation-timeout','transaction-aborted','native-quota','logical-quota']){
      const h=await harness();h.hooks.append=async()=>({status:'outcomeUnknown',reason:'terminal-unobserved'});
      await h.gate.accept(capture(256));
      h.hooks.retry=async(_q,{setLease})=>{if(['busy','open-blocked','operation-timeout'].includes(reason))setLease(null);return {status:'refused',reason};};
      const v=await h.gate.retry();eq(v.state,'BLOCKED');eq(v.reason,'retry-capability');await h.gate.retry();eq(h.writes.length,1);
    }
    for(const mode of ['missing-lease','no-retry','retained-after-ack']){
      const h=await harness();h.hooks.append=async()=>({status:'outcomeUnknown',reason:'terminal-unobserved'});
      if(mode==='missing-lease')h.setRetained(0);
      let v=await h.gate.accept(capture(256));
      if(mode==='no-retry'){h.hooks.retry=async()=>({status:'refused',reason:'no-retry'});v=await h.gate.retry();}
      if(mode==='retained-after-ack'){h.hooks.retry=async(q,{commit})=>commit(q,'duplicate');h.setRetained(512);v=await h.gate.retry();}
      eq(v.state,'BLOCKED');eq(v.reason,'retry-capability');eq(v.retained,true);eq(h.nav.length,0);
    }
  });
  await group('06 duplicate controls and all context/navigation reentry boundaries',async()=>{
    const h=await harness({onContinue(gate){eq(gate.continue().reason,'busy');gate.retry();throw Error('x'.repeat(100000));}});
    const wait=deferred(),entered=deferred();h.hooks.append=async(q,{commit})=>{entered.resolve();await wait.promise;return commit(q);};
    const pending=h.gate.accept(capture(256));await entered.promise;
    eq((await h.gate.accept(capture(256))).reason,'busy');eq((await h.gate.retry()).reason,'busy');eq(h.gate.continue().reason,'busy');
    wait.resolve();eq((await pending).state,'READY');
    let nested=0;
    h.setReader(()=>{nested++;eq(h.gate.continue().reason,'busy');h.gate.view();h.gate.accept(capture(256)).then(v=>eq(v.reason,'busy'));return h.getLive();});
    const v=h.gate.continue();eq(v.state,'CONTINUED');eq(v.reason,'navigation-threw');eq(nested,1);eq(h.nav.length,1);
    h.setReader(null);h.gate.continue();eq(h.nav.length,1);eq(h.writes.length,1);
    for(const kind of ['accept','retry','view']){
      const k=await harness();let readCount=0,reentered=[];
      if(kind!=='accept'){k.hooks.append=async()=>({status:'refused',reason:'native-quota'});await k.gate.accept(capture(256));}
      k.setReader(()=>{readCount++;if(readCount===1){reentered.push(k.gate.accept(capture(256)),k.gate.retry());k.gate.view();}return k.getLive();});
      if(kind==='accept')await k.gate.accept(capture(256));else if(kind==='retry')await k.gate.retry();else k.gate.view();
      for(const promise of reentered)eq((await promise).reason,'busy');ok(readCount<30);eq(k.maxActive(),1);
    }
  });
  await group('07 irreversible scope/generation/source staleness at append and page settlement',async()=>{
    const changes=[{scope:'fixture:B',generation:2,sourceIdentity:'source:1'},
      {scope:'fixture:A',generation:2,sourceIdentity:'source:1'},
      {scope:'fixture:A',generation:1,sourceIdentity:'source:2'}];
    for(const next of changes){
      const h=await harness();h.hooks.append=async(q,{commit})=>{const r=await commit(q);h.setLive(next);return r;};
      const v=await h.gate.accept(capture());eq(v.state,'STALE');eq(v.checkpoint.offset,0);eq(h.writes.length,1);eq(h.reads.length,0);
      h.setLive({scope:'fixture:A',generation:1,sourceIdentity:'source:1'});eq((await h.gate.retry()).state,'STALE');eq(h.gate.continue().state,'STALE');eq(h.nav.length,0);
    }
    for(const throws of [false,true]){
      const h=await harness();h.hooks.read=async page=>{if(throws)h.setReader(()=>{throw Error('reader');});else h.setLive(changes[1]);return page;};
      const v=await h.gate.accept(capture());eq(v.state,'STALE');eq(h.reads.length,1);eq(v.diagnostics.readbackBytes,0);eq(h.nav.length,0);
    }
    const h=await harness();h.hooks.append=async()=>({status:'outcomeUnknown',reason:'terminal-unobserved'});
    eq((await h.gate.accept(capture(256))).ownedUnknown,true);h.setLive(changes[0]);eq(h.gate.view().state,'STALE');
    h.setLive({...changes[1],generation:3});eq((await h.gate.retry()).state,'STALE');eq(h.retryWrites.length,0);eq(h.gate.view().ownedUnknown,true);
    const staleUnknown=await harness();staleUnknown.hooks.append=async()=>{staleUnknown.setLive(changes[0]);return {status:'outcomeUnknown',reason:'terminal-unobserved'};};
    const unknownView=await staleUnknown.gate.accept(capture(256));eq(unknownView.state,'STALE');eq(unknownView.ownedUnknown,true);
    eq(unknownView.checkpoint.offset,0);await staleUnknown.gate.retry();eq(staleUnknown.retryWrites.length,0);
    const k=await harness();k.setLive(changes[0]);eq((await k.gate.accept(capture(256))).state,'STALE');eq(k.writes.length,0);
    const ready=await harness();await ready.gate.accept(capture(256));ready.setLive(changes[2]);eq(ready.gate.continue().state,'STALE');eq(ready.nav.length,0);
    const publish=await harness();await publish.gate.accept(capture(256));publish.setLive(changes[2]);
    const rejected=await publish.gate.accept(capture(256));eq(rejected.state,'STALE');eq(rejected.continueEnabled,false);
    // A-B-A can occur without any intervening read, provided the caller honors
    // the required non-reused monotonic generation contract.
    const aba=await harness(),wait=deferred(),entered=deferred();aba.hooks.append=async(q,{commit})=>{entered.resolve();await wait.promise;return commit(q);};
    const p=aba.gate.accept(capture(256));await entered.promise;aba.setLive(changes[0]);aba.setLive({...aba.getLive(),scope:'fixture:A',generation:3});wait.resolve();
    eq((await p).state,'STALE');eq(aba.nav.length,0);
  });
  await group('08 sealed acknowledgement and failed read retry only verification',async()=>{
    const h=await harness();let first=true;
    h.hooks.read=page=>{if(first){first=false;return {status:'refused',reason:'native-quota'};}return page;};
    const v=await h.gate.accept(capture());eq(v.state,'UNSAVED');eq(v.phase,'verify');eq(v.checkpoint.nextOrdinal,3);eq(v.continueEnabled,false);
    const writes=h.writes.length;eq((await h.gate.retry()).state,'READY');eq(h.writes.length,writes);eq(h.retryWrites.length,0);
    eq(h.reads.map(x=>x.afterOrdinal??-1),[-1,-1,0,1]);eq(h.nav.length,0);
  });
  await group('09 receipt head bytes framing and missing-pointer readback fail closed',async()=>{
    for(const mutate of [r=>{delete r.receipt;},r=>{delete r.currentHead;},r=>{r.receipt.acknowledgement='request-success';},
      r=>{r.receipt.durability='relaxed';},r=>{r.receipt.captureIdentity.run='different';},r=>{r.receipt.root=C.ZERO;},
      r=>{r.receipt.sealed=false;},r=>{r.currentHead.sealed=false;},r=>{r.currentHead.binding=C.ZERO;},
      r=>{r.currentHead.total++;},r=>{r.receipt.length--;},r=>{r.currentHead.extra=true;}]){
      const h=await harness();h.hooks.append=(q,{commit})=>commit(q,'committed',mutate);
      const v=await h.gate.accept(capture(256));eq(v.state,'BLOCKED');eq(v.reason,'acknowledgement-mismatch');eq(h.reads.length,0);eq(h.nav.length,0);
    }
    for(const mutate of [p=>{p.segments[0].payload[0]^=1;},p=>{p.segments[0].payload=p.segments[0].payload.subarray(1);},
      p=>{p.throughHead='bad';},p=>{p.nextCursor=null;},p=>{delete p.nextCursor;},p=>{p.nextCursor.afterOrdinal=-1;},
      p=>{p.nextCursor.captureIdentity.run='wrong';},p=>{p.payloadBytes--;},p=>{p.segments[0].offset++;},
      p=>{p.segments.push(p.segments[0]);},p=>{p.segments[0].root='invalid';}]){
      const h=await harness();h.hooks.read=p=>{if(h.reads.length===1)mutate(p);return p;};
      const v=await h.gate.accept(capture());eq(v.state,'BLOCKED');eq(v.reason,'readback-mismatch');eq(v.continueEnabled,false);eq(h.nav.length,0);
      if(v.diagnostics.readCalls===1)eq(h.reads.length,1);
      eq(v.diagnostics.readbackBytes,0);eq(v.diagnostics.pageReservationBytes,0);
    }
    const h=await harness();h.hooks.read=p=>{if(h.reads.length===3)p.nextCursor={captureIdentity:{scope:'fixture:A',run:'result:1'},throughHead:p.throughHead,afterOrdinal:2};return p;};
    eq((await h.gate.accept(capture())).reason,'readback-mismatch');eq(h.reads.length,3);
    // In-place helper itself independently rejects alternate summary/padding and
    // frame/descriptor mismatch. Gate always invokes it again after equality.
    const good=capture(256),encoded=C.utf8(S.describeSyntheticSummary(good.summary).text);
    for(const alter of [x=>x.bytes[20]^=1,x=>x.bytes[x.bytes.length-1]^=1,x=>x.descriptor.components[0].name='other',
      x=>new DataView(x.bytes.buffer).setUint32(8,1,true),x=>new DataView(x.bytes.buffer).setBigUint64(12,0n,true)]){
      const x=capture(256);alter(x);assert.throws(()=>S.admitSyntheticCompletion(x.bytes,x.descriptor,encoded),/synthetic-admission/);checks++;
    }
  });
  await group('10 competing newer head and unrelated owner never adopted or retried',async()=>{
    const h=await harness();h.hooks.append=(q,{commit})=>commit(q,'duplicate',r=>{r.currentHead.ordinal++;r.currentHead.total++;r.currentHead.token='newer';});
    eq((await h.gate.accept(capture())).state,'BLOCKED');eq(h.gate.view().checkpoint.offset,0);eq(h.writes.length,1);
    const k=await harness();k.setRetained(512);k.hooks.append=async()=>({status:'refused',reason:'retry-pending'});
    eq((await k.gate.accept(capture())).state,'UNSAVED');eq(k.gate.view().ownedUnknown,false);
    await k.gate.retry();eq(k.retryWrites.length,0);eq(k.writes.map(x=>x.ordinal),[0,0]);eq(k.nav.length,0);
  });
  await group('11 fresh reload realm is inspection only after prefix unknown or sealed',async()=>{
    for(const kind of ['prefix','unknown','sealed']){
      const h=await harness();
      if(kind==='prefix')h.hooks.append=async(q,{commit})=>q.ordinal===1?{status:'refused',reason:'native-quota'}:commit(q);
      if(kind==='unknown')h.hooks.append=async()=>({status:'outcomeUnknown',reason:'terminal-unobserved'});
      await h.gate.accept(capture());const writes=h.writes.length;
      const freshModule=await fresh(),navigations=[];
      const reload=freshModule.createUnsavedResultGate({coordinator:h.coordinator,readContext:h.getLive,onContinue(){navigations.push(1);}});
      eq(reload.view().state,'EMPTY');eq((await reload.retry()).state,'EMPTY');eq(reload.continue().state,'EMPTY');
      eq(reload.view().retained,false);eq(h.writes.length,writes);eq(navigations.length,0);
      eq(Object.keys(reload).sort(),['accept','continue','retry','view']);
    }
  });
  await group('12 bounded unavailable closed busy schema size refusal and no fallback',async()=>{
    for(const reason of ['indexeddb-unavailable','webcrypto-unavailable','unsupported-durability','open-blocked','operation-timeout','adapter-closed',
      'unsupported-version','schema-mismatch','storage-unavailable','insecure-context','x'.repeat(100000)]){
      const h=await harness();h.hooks.append=async()=>({status:'refused',reason});const v=await h.gate.accept(capture(256));
      ok(['UNSAVED','BLOCKED'].includes(v.state));eq(v.retained,true);eq(v.continueEnabled,false);eq(h.nav.length,0);eq(h.writes.length,1);
      ok(v.reason.length<=256);ok(Buffer.byteLength(JSON.stringify(v))<8192);ok(v.warning.includes('may lose it'));
    }
    const h=await harness();h.hooks.append=async()=>{throw Error('private '.repeat(100000));};const v=await h.gate.accept(capture(256));
    eq(v.reason,'storage-refused');eq(v.state,'BLOCKED');ok(!JSON.stringify(v).includes('private'));
    let getterCalls=0;const thrown={get message(){getterCalls++;throw Error('must never read');}};
    const unsafe=await harness();unsafe.hooks.append=async()=>{throw thrown;};
    const refused=await unsafe.gate.accept(capture(256));eq(refused.state,'BLOCKED');eq(refused.reason,'storage-refused');eq(getterCalls,0);
    const preownership=await harness();const proxy=new Proxy(capture(256),{ownKeys(){throw thrown;}});
    const invalid=await preownership.gate.accept(proxy);eq(invalid.state,'EMPTY');eq(invalid.reason,'capture-invalid');eq(getterCalls,0);
    eq((await preownership.gate.accept(capture(256))).state,'READY');
    // Reflection on a proxy can reenter synchronously even though ordinary
    // getters are refused. Realm admission is claimed before reflecting input.
    const owner=await harness(),competitor=await harness({module:owner.module});let competed=null;
    const reentry=new Proxy(capture(256),{ownKeys(target){if(!competed)competed=competitor.gate.accept(capture(256));return Reflect.ownKeys(target);}});
    eq((await owner.gate.accept(reentry)).state,'READY');eq((await competed).reason,'realm-capture-retained');eq(competitor.writes.length,0);
    for(const n of [65535,65536,65537,131072,131073,196608]){const k=await harness();const v=await k.gate.accept(capture(n));eq(v.state,'READY');
      eq(k.writes.length,Math.ceil(n/65536));ok(v.diagnostics.modeledPeakBytes<=1016832);eq(v.diagnostics.wholeArtifactCopies,1);}
    for(const name of ['unsaved-result-gate.mjs','synthetic-completion.mjs']){
      const source=fs.readFileSync(path.join(root,name),'utf8');
      ok(!/\b(?:localStorage|fetch\(|deleteDatabase\(|setInterval\(|TextDecoder|unframe\s*\(|archive\s*\()/.test(source),name);
    }
  });
  console.log(JSON.stringify({test:'evidence-unsaved-result',status:'pass',groups:groups.length,checks,groupNames:groups,
    nativeIndexedDB:'not-run',browserOrSocket:'not-used',gameplayCallbacks:0,rewardCallbacks:0,productionReady:false}));
})().catch(error=>{console.error(error);process.exitCode=1;});
