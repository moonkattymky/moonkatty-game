'use strict';
// Portable Map transport + WebCrypto evidence only. Native durability, original
// trusted events and realm lifecycle are covered by the separate native fixture.
const assert=require('node:assert/strict'),Field=require('../field-model.js'),Story=require('../story-plan.js');
const H=require('./evidence-shared-owner-helper.cjs'),{url,webcrypto}=H;
const SCOPE='fixture:legacy-checkpoint',PRINCIPAL='guest:legacy-existing',groups=[];let checks=0,maxRetained=0,maxMetadata=0,jointPeak=0;
const eq=(a,b,m)=>{assert.deepStrictEqual(a,b,m);checks++;},ok=(a,m)=>{assert(a,m);checks++;};
const clone=v=>structuredClone(v);
(async()=>{
  const [O,L,B,C]=await Promise.all(['legacy-checkpoint-owner.mjs','legacy-adoption-codec.mjs','phase-budget.mjs','contract.mjs'].map(x=>import(url(x))));
  const runs=O.legacyOwnerRuns(PRINCIPAL);
  function raw({padding=0,points='00123',baseSeed=100,mutate}={}){
    const checkpoint=Field.create(11,4,(baseSeed+2*7919)>>>0,{});checkpoint.trace=[];
    checkpoint.trace.push(['act','wait',0]);Field.act(checkpoint,'wait',0);
    const values=Object.fromEntries(L.LEGACY_KEYS.map(k=>[k,null]));
    values.mkty_story_plan_9_v1=JSON.stringify({...Story.fresh(9,9009,2),createdAt:1,phase:'core',done:[0,1,2,3,4,5,6,7],tasks:{}});
    values.mkty_field_finale_9_v1=' \n'+JSON.stringify({version:1,n:9,phase:2,seed:baseSeed,seconds:7,checkpoint,opaque:'界🌙\ud800'})+'\n';
    values.mkty_points=points+'x'.repeat(padding);values.mkty_daily_demo=' { "opaque": "\\ud800", "attempts": 9 }\n';values.mkty_current_chapter='9';mutate?.(values);return values;
  }
  function guards(epoch=1){return {version:1,origin:'closed-original-field-guest-fixture',principal:PRINCIPAL,epoch,identity:'guest',initData:'',durable:true,
    exclusive:true,sourceClosed:true,overlay:false,legacyOwnerRaw:null,cloudRaw:Object.fromEntries(L.LEGACY_CLOUD_KEYS.map(k=>[k,null])),unattributedPendingPresent:false};}
  async function fixture(options={}){
    const scope=options.scope||SCOPE,epoch=options.epoch||1,adapter=options.adapter||await H.archive(scope),reader=await adapter.fork();
    // The frozen real adapter permits scoped readonly reads while a retained
    // unknown request exists. This transport uses the shared Map reader to model
    // that behavior instead of the older helper's deliberately stricter guard.
    const transport={scope,appendSegment:(...a)=>adapter.appendSegment(...a),retry:(...a)=>adapter.retry(...a),
      recover:q=>reader.recover(q),readSegments:q=>reader.readSegments(q),get retainedBytes(){return adapter.retainedBytes;},get physicalBusy(){return adapter.physicalBusy;}};
    const budget=B.createPhaseBudget({observe:options.observe});let context={scope,principal:PRINCIPAL,epoch,sourceUnchanged:true},guardCalls=0;
    const values=options.raw||raw(options),original=clone(values);
    const readContext=cap=>{guardCalls++;if(cap&&L.LEGACY_KEYS.some(k=>L.rawValue(cap,k)!==values[k]))context.sourceUnchanged=false;return {...context};};
    const owner=O.createLegacyCheckpointOwner({adapter:transport,scope,principal:PRINCIPAL,epoch,readContext,admissionGuards:guards(epoch),FieldRules:Field,budget,crypto:options.crypto||webcrypto});
    let cap=null;
    function capture(){return cap??=L.admitLegacyBundle(values,guards(epoch),Field,budget);}
    function actual(){const lease=owner.checkpoint(),cp=clone(lease.value);lease.release();owner.prepareWait();cp.trace.push(['act','wait',0]);Field.act(cp,'wait',0);return cp;}
    function close(){owner.dispose();H.clean(budget);ok(budget.snapshot().peak+32768<=1016832);}
    return {adapter,transport,budget,owner,values,original,capture,actual,close,setContext:v=>Object.assign(context,v),get guardCalls(){return guardCalls;}};
  }
  async function adopted(options){const h=await fixture(options),v=await h.owner.adopt(h.capture());eq([v.state,v.reason,v.revision],['ACTIVE',null,0]);return h;}
  async function group(name,fn){await fn();groups.push(name);}
  const protectedGlobals=['fetch','XMLHttpRequest','WebSocket','localStorage'],saved=Object.fromEntries(protectedGlobals.map(k=>[k,globalThis[k]]));
  for(const k of protectedGlobals)globalThis[k]=k==='localStorage'?{getItem(){throw Error('ambient-read-forbidden');},setItem(){throw Error('ambient-write-forbidden');}}:()=>{throw Error('network-forbidden');};
  try{
  await group('01 exact source archive before rev0, actual WAIT before rev1, two fresh recoveries',async()=>{
    const h=await adopted({padding:20000}),before=clone(h.values),actual=h.actual(),v=await h.owner.commitWait(actual);
    eq([v.state,v.reason,v.revision],['SAVED',null,1]);eq(h.adapter.entries.size,3);eq(h.adapter.entries.get(runs.owner).segments.length,2);
    eq(h.adapter.entries.get(runs.owner).pin.head.sealed,true);eq(h.values,before);const lease=h.owner.checkpoint();eq(lease.value,actual);lease.release();
    for(const k of L.LEGACY_KEYS)eq(h.owner.rawValue(k),before[k]);
    const events=h.adapter.events.filter(x=>x.type==='append');ok(events.findIndex(e=>e.run===runs.source)<events.findIndex(e=>e.run===runs.owner));
    ok(events.findIndex(e=>e.run===runs.next)<events.findIndex(e=>e.run===runs.owner&&e.ordinal===1));const snapshot=h.adapter.snapshot();h.close();
    for(let i=0;i<2;i++){const next=await fixture({adapter:await h.adapter.fork(),raw:before}),r=await next.owner.recover();eq([r.state,r.reason,r.revision],['SAVED',null,1]);
      const cp=next.owner.checkpoint();eq(cp.value,actual);cp.release();eq(next.adapter.snapshot(),snapshot);next.close();}
  });
  await group('02 deterministic same principal contenders and same candidate converge once',async()=>{
    const a=await fixture(),b=await fixture({adapter:await a.adapter.fork(),raw:clone(a.values)});
    const vs=await Promise.all([a.owner.adopt(a.capture()),b.owner.adopt(b.capture())]);ok(vs.every(v=>v.state==='ACTIVE'));eq(a.adapter.entries.size,2);
    const cp=a.actual(),other=b.actual(),saved=await Promise.all([a.owner.commitWait(cp),b.owner.commitWait(other)]);ok(saved.every(v=>v.state==='SAVED'));
    eq(a.adapter.entries.size,3);eq(a.adapter.entries.get(runs.owner).segments.length,2);a.close();b.close();
  });
  await group('03 different same-principal source refuses without a new capture suffix',async()=>{
    const a=await adopted(),snapshot=a.adapter.snapshot(),b=await fixture({adapter:await a.adapter.fork(),raw:raw({points:'99999'})});
    const v=await b.owner.adopt(b.capture());eq(v.state,'BLOCKED');eq(a.adapter.snapshot(),snapshot);eq([...a.adapter.entries.keys()].sort(),[runs.source,runs.owner].sort());a.close();b.close();
  });
  await group('04 source archive/seal/readback and owner append abort cutpoints preserve valid prefix',async()=>{
    for(const kind of ['source-append','source-read','owner-append','owner-read'])for(const failure of ['transaction-aborted','native-quota']){
      const h=await fixture({padding:20000});let fired=false;
      if(kind.endsWith('append')){const original=h.transport.appendSegment;h.transport.appendSegment=async(q,g)=>{
        if(!fired&&q.descriptor.run===runs[kind.startsWith('source')?'source':'owner']){fired=true;return {status:'refused',reason:failure};}return original(q,g);};}
      else{const original=h.transport.readSegments;h.transport.readSegments=async q=>{
        if(!fired&&q.captureIdentity.run===runs[kind.startsWith('source')?'source':'owner']){fired=true;return {status:'refused',reason:failure};}return original(q);};}
      eq((await h.owner.adopt(h.capture())).state,'UNSAVED');ok(fired);eq(h.values,h.original);
      const r=await h.owner.retry();eq([r.state,r.revision],['ACTIVE',0]);eq(h.adapter.entries.size,2);h.close();
    }
  });
  await group('05 next archive/owner failures retain exact candidate; retry does not rerun WAIT',async()=>{
    for(const kind of ['next-append','next-read','owner-append','owner-read']){
      const h=await adopted(),actual=h.actual();let fired=false;
      if(kind.endsWith('append')){const original=h.transport.appendSegment;h.transport.appendSegment=async(q,g)=>{
        if(!fired&&q.descriptor.run===runs[kind.startsWith('next')?'next':'owner']&&(kind.startsWith('next')||q.ordinal===1)){fired=true;return {status:'refused',reason:'native-quota'};}return original(q,g);};}
      else{const original=h.transport.readSegments;h.transport.readSegments=async q=>{
        if(!fired&&q.captureIdentity.run===runs[kind.startsWith('next')?'next':'owner']&&(kind.startsWith('next')||q.afterOrdinal===0)){fired=true;return {status:'refused',reason:'transaction-aborted'};}return original(q);};}
      eq((await h.owner.commitWait(actual)).state,'UNSAVED');ok(fired);actual.turn+=100;actual.trace.push(['forbidden','replay']);
      const v=await h.owner.retry();eq([v.state,v.revision],['SAVED',1]);eq(h.adapter.entries.get(runs.owner).segments.length,2);eq(h.values,h.original);h.close();
    }
  });
  await group('06 source and owner lost acknowledgements retry identical requests',async()=>{
    for(const target of ['source','owner','next','owner-next'])for(const mode of ['unknown-abort','unknown-commit']){
      const h=target==='source'||target==='owner'?await fixture():await adopted();let armed=true;
      const original=h.transport.appendSegment;h.transport.appendSegment=(q,g)=>{
        if(armed&&q.descriptor.run===runs[target==='owner-next'?'owner':target]&&(target!=='owner-next'||q.ordinal===1)){armed=false;h.adapter.setMode(mode);}return original(q,g);};
      const v=target==='source'||target==='owner'?await h.owner.adopt(h.capture()):await h.owner.commitWait(h.actual());eq(v.state,'UNSAVED');ok(h.adapter.retainedBytes>0);
      const held=h.adapter.retained(),r=await h.owner.retry();eq(r.state,target==='source'||target==='owner'?'ACTIVE':'SAVED');eq(h.adapter.retainedBytes,0);
      ok(h.adapter.events.some(e=>e.type==='retry'));const entry=h.adapter.entries.get(held.descriptor.run);ok(C.equalBytes(entry.segments[held.ordinal].payload,held.payload));h.close();
    }
  });
  await group('07 stale before dispatch and observed A-B-A remain permanently invalid',async()=>{
    const h=await fixture();h.setContext({epoch:2});const mark=h.adapter.events.length,v=await h.owner.adopt(h.capture());eq(v.state,'QUARANTINED');
    ok(!h.adapter.events.slice(mark).some(e=>e.type==='append'||e.type==='retry'));h.setContext({epoch:1});eq((await h.owner.retry()).state,'QUARANTINED');eq(h.adapter.entries.size,0);h.close();
    const a=await adopted(),actual=a.actual(),before=a.adapter.snapshot();a.values.mkty_points='changed';eq((await a.owner.commitWait(actual)).state,'QUARANTINED');a.values.mkty_points=a.original.mkty_points;
    eq((await a.owner.retry()).state,'QUARANTINED');eq(a.adapter.snapshot(),before);a.close();
  });
  await group('08 late old-scope committed receipt is read-only reconciled and quarantined',async()=>{
    const h=await fixture(),original=h.transport.appendSegment;let switched=false;
    h.transport.appendSegment=async(q,g)=>{const result=await original(q,g);if(!switched&&q.descriptor.run===runs.owner){switched=true;h.setContext({epoch:2});}return result;};
    const v=await h.owner.adopt(h.capture());eq(v.state,'QUARANTINED');eq(v.reconciliation.proposal,'committed');eq(v.reconciliation.revision,0);eq(h.adapter.entries.get(runs.owner).segments.length,1);
    const mark=h.adapter.events.length;await h.owner.retry();ok(!h.adapter.events.slice(mark).some(e=>e.type==='append'||e.type==='retry'));assert.throws(()=>h.owner.checkpoint(),/not-readable/);checks++;h.close();
  });
  await group('09 lostack plus drift never calls insertion retry and retains old request',async()=>{
    for(const mode of ['unknown-abort','unknown-commit']){
      const h=await fixture();h.adapter.setMode(mode);eq((await h.owner.adopt(h.capture())).state,'UNSAVED');const retained=h.adapter.retained(),before=h.adapter.snapshot();h.setContext({principal:'guest:other',epoch:2});
      const mark=h.adapter.events.length,v=await h.owner.retry();eq(v.state,'QUARANTINED');eq(h.adapter.retained(),retained);eq(h.adapter.snapshot(),before);
      ok(!h.adapter.events.slice(mark).some(e=>e.type==='append'||e.type==='retry'));eq(v.reconciliation.proposal,mode==='unknown-commit'?'committed':'absent');
      assert.throws(()=>h.owner.dispose(),/busy/);checks++;
      // The deliberate unresolved lease is retained, not garbage-collected,
      // rekeyed, cleared or insertion-retried by the owner in test teardown.
      ok(h.budget.snapshot().reservations['context-retained']>0);ok(h.budget.snapshot().peak+32768<=1016832);
    }
  });
  await group('10 missing/corrupt dependencies block rather than falling back to old mirrors',async()=>{
    for(const kind of ['source','next']){
      const h=await adopted(),actual=h.actual();await h.owner.commitWait(actual);h.close();h.adapter.entries.delete(runs[kind]);const before=h.adapter.snapshot();
      const r=await fixture({adapter:await h.adapter.fork(),raw:clone(h.original)});eq((await r.owner.recover()).state,'BLOCKED');eq(r.adapter.snapshot(),before);r.close();
    }
    const h=await adopted();h.close();h.adapter.entries.get(runs.source).segments[0].payload[40]^=1;const before=h.adapter.snapshot(),r=await fixture({adapter:await h.adapter.fork(),raw:clone(h.original)});
    eq((await r.owner.recover()).state,'BLOCKED');eq(r.adapter.snapshot(),before);r.close();
  });
  await group('11 corrupt owner padding or semantic record never becomes NEW',async()=>{
    for(const semantic of [false,true]){
      const h=await adopted();h.close();const entry=h.adapter.entries.get(runs.owner),bytes=entry.segments[0].payload;
      if(semantic){await h.adapter.rewrite(runs.owner,0,r=>{r.revision=1;});}else{bytes[16383]=1;await h.adapter.rehash(runs.owner);}
      const r=await fixture({adapter:await h.adapter.fork(),raw:clone(h.original)}),before=r.adapter.snapshot();eq((await r.owner.recover()).state,'BLOCKED');eq(r.adapter.snapshot(),before);r.close();
    }
  });
  await group('12 timer/different candidate rejected before next archive and no second command',async()=>{
    const h=await adopted(),actual=h.actual(),before=h.adapter.snapshot();actual.seconds+=1;eq((await h.owner.commitWait(actual)).state,'BLOCKED');eq(h.adapter.snapshot(),before);h.close();
    const a=await adopted(),candidate=a.actual();await a.owner.commitWait(candidate);const snapshot=a.adapter.snapshot();eq((await a.owner.commitWait(candidate)).state,'SAVED');eq(a.adapter.snapshot(),snapshot);candidate.turn++;eq((await a.owner.commitWait(candidate)).state,'BLOCKED');eq(a.adapter.snapshot(),snapshot);a.close();
  });
  await group('13 archive read bounds, compact records and reservation failures clean owned workspace',async()=>{
    const events=[],h=await adopted({padding:20000,observe:e=>events.push(e)});await h.owner.commitWait(h.actual());h.close();
    ok(events.filter(e=>e.label==='legacy-owner-record-encoded').every(e=>e.detail.bytes<=4096));ok(events.filter(e=>e.label==='legacy-owner-retained').every(e=>e.detail.bytes<=32768));
    ok(h.adapter.events.filter(e=>e.type==='read').every(e=>e.maxBytes<=32768));
    for(const [type,label]of [['reserve','stream-candidate'],['allocate','stream-candidate'],['reserve','returned-page'],['reserve','atomic-record-workspace'],['reserve','helper-framing'],['reserve','helper-hash']]){
      let armed=false,fired=false;const a=await fixture({observe:e=>{if(armed&&!fired&&e.type===type&&e.label===label){fired=true;throw Error('injected-allocation');}}});a.capture();armed=true;
      const v=await a.owner.adopt(a.capture());armed=false;ok(fired);eq(v.state,'BLOCKED');a.close();
    }
  });
  await group('14 cold reload detects source drift against archive, not self-compared current snapshot',async()=>{
    const h=await adopted();h.close();const changed=clone(h.original);changed.mkty_points='111';const a=await fixture({adapter:await h.adapter.fork(),raw:changed});
    const before=a.adapter.snapshot(),v=await a.owner.recover();eq(v.state,'QUARANTINED');eq(a.adapter.snapshot(),before);a.close();
  });
  await group('15 exact maximum source, escaped scope and cold recovery stay inside joint ceiling',async()=>{
    const values=raw(),bytes=622+Object.values(values).reduce((n,v)=>n+(v===null?0:v.length*2),0);
    values.mkty_points+='x'.repeat((65536-bytes)/2);const scope='\0'.repeat(128),events=[];
    const h=await adopted({scope,raw:values,observe:e=>events.push(e)}),actual=h.actual();eq(L.legacyInfo(h.capture()).byteLength,65536);
    const v=await h.owner.commitWait(actual);eq([v.state,v.reason],['SAVED',null]);h.close();
    const a=await fixture({scope,adapter:await h.adapter.fork(),raw:clone(values),observe:e=>events.push(e)}),r=await a.owner.recover();eq([r.state,r.reason],['SAVED',null]);a.close();
    ok(events.every(e=>e.live+32768<=1016832));jointPeak=Math.max(...events.map(e=>e.live+32768));eq(jointPeak,1015808);
    maxRetained=Math.max(...events.filter(e=>e.label==='legacy-owner-retained').map(e=>e.detail.bytes));maxMetadata=Math.max(...events.filter(e=>e.label==='legacy-owner-metadata').map(e=>e.detail.bytes));
  });
  await group('16 drift during hashing refuses dispatch and no return to original epoch revives it',async()=>{
    let armed=false,h;const crypto={subtle:{async digest(...args){if(armed){armed=false;h.setContext({epoch:2});}return webcrypto.subtle.digest(...args);}}};
    h=await fixture({crypto});h.capture();armed=true;const mark=h.adapter.events.length,v=await h.owner.adopt(h.capture());eq(v.state,'QUARANTINED');
    ok(!h.adapter.events.slice(mark).some(e=>e.type==='append'||e.type==='retry'));h.setContext({epoch:1});eq((await h.owner.retry()).state,'QUARANTINED');h.close();
  });
  await group('17 cold decode reserve failure releases frame and raw ownership',async()=>{
    const h=await adopted();h.close();let armed=true,fired=false;
    const a=await fixture({adapter:await h.adapter.fork(),raw:clone(h.original),observe:e=>{if(armed&&!fired&&e.type==='reserve'&&e.label==='callback-inner-story'){fired=true;throw Error('cold-reserve-failure');}}});
    const before=a.adapter.snapshot(),v=await a.owner.recover();armed=false;ok(fired);eq(v.state,'BLOCKED');eq(a.adapter.snapshot(),before);a.close();
  });
  await group('18 new live epoch recovers the same deterministic principal owner',async()=>{
    const h=await adopted(),actual=h.actual();await h.owner.commitWait(actual);h.close();const before=h.adapter.snapshot();
    const a=await fixture({adapter:await h.adapter.fork(),raw:clone(h.original),epoch:2}),v=await a.owner.recover();eq([v.state,v.reason,v.revision],['SAVED',null,1]);
    const cp=a.owner.checkpoint();eq(cp.value,actual);cp.release();eq(a.adapter.snapshot(),before);eq((await a.owner.commitWait(actual)).state,'SAVED');eq(a.adapter.snapshot(),before);a.close();
  });
  await group('19 a missing known owner or orphan next never appears as a new canonical owner',async()=>{
    const h=await adopted();h.adapter.entries.delete(runs.owner);const before=h.adapter.snapshot(),v=await h.owner.recover();eq([v.state,v.reason],['BLOCKED','legacy-owner-missing-owner']);eq(h.adapter.snapshot(),before);h.close();
    const a=await adopted(),actual=a.actual();await a.owner.commitWait(actual);a.close();a.adapter.entries.delete(runs.owner);const b=await fixture({adapter:await a.adapter.fork(),raw:clone(a.original)});
    const snap=b.adapter.snapshot(),r=await b.owner.recover();eq([r.state,r.reason],['BLOCKED','legacy-owner-missing-owner']);eq(b.adapter.snapshot(),snap);b.close();
  });
  await group('20 preflight-only contender can cold-recover the other completed WAIT',async()=>{
    const a=await adopted(),b=await fixture({adapter:await a.adapter.fork(),raw:clone(a.original)});eq((await b.owner.recover()).state,'ACTIVE');b.owner.prepareWait();
    const actual=a.actual();await a.owner.commitWait(actual);const before=a.adapter.snapshot(),r=await b.owner.recover();eq([r.state,r.reason],['SAVED',null]);
    const cp=b.owner.checkpoint();eq(cp.value,actual);cp.release();eq(a.adapter.snapshot(),before);a.close();b.close();
  });
  await group('21 source and next frame-release observer failures dispose unpublished output caps',async()=>{
    for(const cut of [1,2]){
      const h=await adopted();await h.owner.commitWait(h.actual());h.close();let calls=0,fired=false;
      const a=await fixture({adapter:await h.adapter.fork(),raw:clone(h.original),observe:e=>{if(e.type==='release'&&e.label==='context-parse'&&++calls===cut){fired=true;throw Error('frame-release-observer');}}});
      const before=a.adapter.snapshot(),v=await a.owner.recover();ok(fired);eq(v.state,'BLOCKED');eq(a.adapter.snapshot(),before);a.close();
    }
  });
  await group('22 falsy cleanup exceptions remain failures and do not strand leases',async()=>{
    for(const thrown of [0,null,undefined]){
      const h=await adopted();h.close();let fired=false;
      const a=await fixture({adapter:await h.adapter.fork(),raw:clone(h.original),observe:e=>{if(!fired&&e.type==='release'&&e.label==='context-parse'){fired=true;throw thrown;}}});
      eq((await a.owner.recover()).state,'BLOCKED');ok(fired);a.close();
      let armed=false,disposeFired=false;const b=await adopted({observe:e=>{if(armed&&!disposeFired&&e.type==='release'&&e.label==='context-retained'){disposeFired=true;throw thrown;}}});armed=true;
      let caught=false,value;try{b.owner.dispose();}catch(e){caught=true;value=e;}ok(caught);eq(value,thrown);ok(disposeFired);H.clean(b.budget);checks++;
    }
  });
  }finally{for(const k of protectedGlobals){if(saved[k]===undefined)delete globalThis[k];else globalThis[k]=saved[k];}}
  console.log(JSON.stringify({ok:true,groups:groups.length,checks,names:groups,contract:O.LEGACY_OWNER_CONTRACT,
    measurements:{jointPeak,maxRetained,maxMetadata},qualifications:{transport:'portable Map, not native IndexedDB',fixture:'synthetic model-valid old checkpoint; native controller evidence separate',network:false,productionWrites:false}},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
