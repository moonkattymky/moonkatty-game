'use strict';
// Portable source-only reader evidence with archive doubles + native WebCrypto.
// This does not claim a browser/IndexedDB transaction or earned gameplay run.
const assert=require('node:assert/strict'),{webcrypto}=require('node:crypto');
const {pathToFileURL}=require('node:url'),path=require('node:path');
const Story=require('../story-plan.js'),Field=require('../field-model.js'),Codec=require('../trace-codec.js');
const fixtures=require('./fixtures/finale-checkpoints-17-state.json');
const SCOPE='fixture:context-reload',SESSION='1234567890abcdef1234567890abcdef';
const url=name=>pathToFileURL(path.join(__dirname,'../prototypes/evidence-indexeddb',name)).href;
const clone=x=>JSON.parse(Codec.stringify(x)),deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
let checks=0;const groups=[],measurements=[];
const eq=(a,b,n)=>{assert.deepStrictEqual(a,b,n);checks++;},ok=(v,n)=>{assert(v,n);checks++;};
const rejects=async(fn,re=/context-reload|finale-|token-|trace_|probe-/)=>{await assert.rejects(fn,re);checks++;};
const plan=n=>({...Story.fresh(n,9000+n,2),createdAt:1,phase:'core',done:[0,1,2,3,4,5,6,7]});
function longStory(){
  const full=plan(8);for(const task of Story.plan(8,2).steps)full.tasks[task.id]={kind:task.kind,attempt:0,seconds:3,hints:0,errors:0};
  const proof=Field.create(8,0,Story.seedFor(full,0));proof.trace=[];
  const act=(action,value)=>{proof.trace.push(['act',action,value??null]);Field.act(proof,action,value);};
  const layout=Field.layout(proof);for(let i=0;i<3;i++){act('station',i);act('angle',Math.round(layout.bearings[i]));act('sample');}
  act('pin',layout.source);act('locate');full.tasks[0]={...full.tasks[0],proof,performance:Field.performance(proof)};
  proof.trace=[...Array.from({length:900},()=>['act','station',0]),...proof.trace];
  ok(Field.restore(proof,8,0,proof.seed));eq(proof.trace.length,911);
  const text=JSON.stringify(full);eq(text.length*2,38628);return text;
}
(async()=>{
  const C=await import(url('contract.mjs')),X=await import(url('finale-context-v1.mjs')),
    P=await import(url('finale-phase-v2.mjs')),B=await import(url('phase-budget.mjs')),R=await import(url('context-reload.mjs'));
  const group=async(name,work)=>{await work();groups.push(name);};
  const baseline=B.createPhaseBudget().snapshot().reservations;
  function clean(budget){eq(budget.snapshot().reservations,baseline,'all temporary and retained leases released');}
  async function fixture({p=fixtures.phases[4],storyText=JSON.stringify(plan(p.chapter)),scope=SCOPE,phaseMutate,contextMutate}={}){
    const b=B.createPhaseBudget(),baseSeed=(p.seed-p.index*7919)>>>0;
    const binding={version:1,session:SESSION,chapter:p.chapter,edition:2,baseSeed,
      storyKey:`mkty_story_plan_${p.chapter}_v1`,sourceKey:`mkty_field_finale_${p.chapter}_v1`,route:'spatial-finale'};
    b.reserve('context-retained',storyText.length*2);const context=X.admitContext({scope,session:SESSION,storyText,binding},b);
    const entries=new Map(),requests=[],state={readHook:null,latestPage:null};
    async function seal(descriptor,bytes,size){
      const d=await C.descriptor(descriptor,webcrypto),segments=[];let root=C.ZERO,offset=0,ordinal=0;
      while(offset<bytes.length){const payload=bytes.slice(offset,Math.min(offset+size,bytes.length));
        root=await C.chain(d,{ordinal,offset,previousRoot:root},payload,webcrypto);
        segments.push({ordinal,offset,length:payload.length,root,payload});offset+=payload.length;ordinal++;}
      const head=await C.makeHead(d,ordinal-1,bytes.length,root,true,webcrypto),pin={descriptor:clone(descriptor),head};
      entries.set(descriptor.run,{pin,segments});return pin;
    }
    const contextBytes=C.frame([{name:'story',encoding:'utf16le',text:storyText},{name:'binding',encoding:'utf16le',text:Codec.stringify(binding)}]).bytes;
    contextMutate?.(contextBytes);
    const contextPin=await seal(X.describeContext(context).descriptor,contextBytes,32768);
    const contextReference={version:1,scope,run:contextPin.descriptor.run,binding:contextPin.head.binding,throughHead:contextPin.head.token};
    const input={scope,session:SESSION,checkpoint:clone(p.state),sourceText:JSON.stringify({version:1,n:p.chapter,phase:p.index,seed:baseSeed,seconds:7,checkpoint:p.state}),
      binding:{version:1,chapter:p.chapter,edition:2,phase:p.index,mechanic:p.mechanic,fieldStage:4,baseSeed,seed:p.seed,
        sourceKey:binding.sourceKey,storyKey:binding.storyKey,route:binding.route,provenance:clone(p.provenance)}};
    phaseMutate?.(input);
    b.reserve('raw-capsule',65536);const raw=P.freezeFinalePhase(input,b);b.release('raw-capsule',65536);b.reserve('phase-workspace',327680);
    const packet=P.makeFinalePhase(raw,context,contextReference,b),phasePin=await seal(packet.descriptor,packet.bytes,16384);
    b.release('phase-workspace',327680);b.release('context-retained',storyText.length*2);
    const adapter={async readSegments(q){requests.push(clone(q));const entry=entries.get(q.captureIdentity.run),ordinal=q.afterOrdinal+1;
      if(!entry||entry.pin.head.token!==q.throughHead)return {status:'refused',reason:'missing'};
      const segment=entry.segments[ordinal];if(!segment)return {status:'refused',reason:'missing'};
      const page={status:'page',segments:[{...segment,payload:new Uint8Array(segment.payload)}],payloadBytes:segment.length,throughHead:q.throughHead,
        nextCursor:ordinal<entry.pin.head.ordinal?{captureIdentity:{...q.captureIdentity},throughHead:q.throughHead,afterOrdinal:ordinal}:null};
      state.latestPage=page;return state.readHook?state.readHook(page,q):page;
    }};
    return {adapter,entries,contextPin,phasePin,storyText,input,contextReference,requests,state,seal,packet};
  }
  async function recovered(h,{observe,crypto=webcrypto,module=R,withPhase=true,budget=B.createPhaseBudget({observe})}={}){
    const lease=await module[withPhase?'recoverFinaleContextAndPhase':'recoverFinaleContext']({adapter:h.adapter,
      contextPin:h.contextPin,phasePin:h.phasePin,budget,crypto});return {lease,budget};
  }
  await group('01 all 17 model-valid phases re-admit after a new reader realm',async()=>{
    for(const p of fixtures.phases){const h=await fixture({p}),module=await import(url('context-reload.mjs')+'?fresh='+groups.length+'-'+p.label);
      const {lease,budget}=await recovered(h,{module});eq(lease.storyText,h.storyText);ok(X.matchesContextText(lease.context,h.storyText));
      eq(lease.phase.checkpoint,p.state);eq(lease.phase.sourceText,h.input.sourceText);eq(lease.phase.binding,h.input.binding);eq(lease.phase.reference,h.contextReference);
      eq(lease.phase.summary.authority,'not-established');eq(budget.snapshot().reservations['phase-workspace'],0);
      eq(budget.snapshot().reservations['reload-phase-retained'],65536);ok(Object.isFrozen(lease.phase.checkpoint));
      measurements.push({phase:p.label,peak:budget.snapshot().peak});lease.dispose();clean(budget);
      for(const key of ['storyText','context','contextReference','phase'])assert.throws(()=>lease[key],/disposed/);checks+=4;lease.dispose();clean(budget);
    }
  });
  await group('02 real 911-action story stays exact through multi-page recovery',async()=>{
    const storyText=longStory(),h=await fixture({p:fixtures.phases[0],storyText});
    const {lease,budget}=await recovered(h);eq(lease.storyText,storyText);eq(h.requests.filter(q=>q.captureIdentity.run===h.contextPin.descriptor.run).length,2);
    eq(JSON.parse(lease.storyText).tasks[0].proof.trace.length,911);ok(budget.snapshot().peak<=1016832);
    measurements.push({storyUtf16:storyText.length*2,storyUtf8:C.utf8Size(storyText),peak:budget.snapshot().peak});lease.dispose();clean(budget);
  });
  await group('03 exact raw UTF16 limit, page boundaries, unusual code units and phase -0',async()=>{
    const story={...plan(9),opaque:{zero:-0,number:100,units:'\ud800x\udfff😀\ufeff\u0000\n\t\\"'}};
    let text='\n '+JSON.stringify(story).replace('"zero":0','"zero":-0.0').replace('"number":100','"number":1e2')
      .replace('\\ud800','\ud800').replace('\\udfff','\udfff')+'\r\n';
    const weird=await fixture({storyText:text,phaseMutate(x){x.checkpoint.seconds=-0;x.binding.provenance.negativeZero=-0;x.binding.provenance.units='\udfff';
      x.sourceText='\n '+JSON.stringify({...JSON.parse(x.sourceText),checkpoint:x.checkpoint})+'\n';}});
    const w=await recovered(weird);eq(w.lease.storyText,text);ok(Object.is(w.lease.phase.checkpoint.seconds,-0));
    ok(Object.is(w.lease.phase.binding.provenance.negativeZero,-0));eq(w.lease.phase.binding.provenance.units,'\udfff');
    ok(C.utf8Size(text)!==text.length*2);w.lease.dispose();clean(w.budget);
    text=JSON.stringify(plan(9));text+=' '.repeat(32768-text.length);
    const h=await fixture({storyText:text}),v=await recovered(h);eq(v.lease.storyText,text);eq(text.length*2,65536);
    eq(h.requests.filter(q=>q.captureIdentity.run===h.contextPin.descriptor.run).length,3);v.lease.dispose();clean(v.budget);
  });
  await group('04 opaque context is never trace-unpacked and no complete context frame is allocated',async()=>{
    const story={...plan(9),opaque:['mkty-trace',999,900000000,0,'opaque']};let text=JSON.stringify(story);text+=' '.repeat(32768-text.length);
    const h=await fixture({storyText:text}),budget=B.createPhaseBudget(),Old=globalThis.Uint8Array,unpack=Codec.unpackTrace;
    let forbidden=0;globalThis.Uint8Array=new Proxy(Old,{construct(target,args){if(typeof args[0]==='number'&&args[0]>32768&&budget.snapshot().reservations['helper-framing']<args[0]){forbidden++;throw Error('whole-context-allocation');}return Reflect.construct(target,args,target);}});
    Codec.unpackTrace=()=>{throw Error('unexpected-context-unpack');};
    try{const {lease}=await recovered(h,{budget,withPhase:false});eq(lease.storyText,text);eq(lease.phase,null);lease.dispose();eq(forbidden,0);clean(budget);}
    finally{globalThis.Uint8Array=Old;Codec.unpackTrace=unpack;}
  });
  await group('05 full descriptor/head correspondence and same-scope dependency pinning refuse tampering',async()=>{
    const mutations=[h=>h.contextPin.head.sealed=false,h=>h.contextPin.head.binding=C.ZERO,h=>h.contextPin.head.root=C.ZERO,
      h=>h.contextPin.head.ordinal++,h=>h.contextPin.head.total+=2,h=>h.contextPin.head.token=h.contextPin.head.token.slice(0,-1)+'x',
      h=>h.contextPin.descriptor.note='new',h=>h.contextPin.descriptor.run=`fc1:${'f'.repeat(32)}:9`,
      h=>h.phasePin.descriptor.scope='elsewhere',h=>h.phasePin.descriptor.run=`fp2:${'f'.repeat(32)}:9:2`,
      h=>h.phasePin.head.root=C.ZERO,h=>h.phasePin.head.sealed=false,h=>h.phasePin.head.ordinal=1,
      h=>h.contextPin.extra=true,h=>Object.defineProperty(h.contextPin,'head',{get(){throw Error('getter-called');},enumerable:true})];
    for(const mutate of mutations){const h=await fixture(),budget=B.createPhaseBudget();mutate(h);await rejects(()=>recovered(h,{budget}));clean(budget);}
  });
  await group('06 every page field, missing record, chain byte and framing failure refuses',async()=>{
    const changes=[p=>({...p,status:'refused'}),p=>({...p,throughHead:'bad'}),p=>({...p,payloadBytes:p.payloadBytes+1}),
      p=>({...p,nextCursor:{}}),p=>({...p,segments:[]}),p=>({...p,extra:true}),
      p=>{p.segments[0].ordinal++;return p;},p=>{p.segments[0].offset++;return p;},p=>{p.segments[0].length--;return p;},
      p=>{p.segments[0].root=C.ZERO;return p;},p=>{p.segments[0].payload[0]^=1;return p;},p=>{p.segments[0].payload=new Uint8Array(1);return p;}];
    for(const change of changes){const h=await fixture(),budget=B.createPhaseBudget();h.state.readHook=change;await rejects(()=>recovered(h,{budget}));clean(budget);}
    for(const kind of ['contextPin','phasePin']){const h=await fixture(),budget=B.createPhaseBudget();h.entries.delete(h[kind].descriptor.run);await rejects(()=>recovered(h,{budget}));clean(budget);}
    const h=await fixture({contextMutate(bytes){bytes[0]^=1;}}),budget=B.createPhaseBudget();await rejects(()=>recovered(h,{budget}));clean(budget);
  });
  await group('07 SHA failures and thrown reads release all leases on every await',async()=>{
    const reference=await fixture();let calls=0;
    const probe={subtle:{async digest(...args){calls++;return webcrypto.subtle.digest(...args);}}};
    const normal=await recovered(reference,{crypto:probe});normal.lease.dispose();
    for(let cut=1;cut<=calls;cut++){const h=await fixture(),budget=B.createPhaseBudget();let seen=0;
      await rejects(()=>recovered(h,{budget,crypto:{subtle:{async digest(...args){if(++seen===cut)throw Error('probe-hash');return webcrypto.subtle.digest(...args);}}}}));clean(budget);}
    for(const nth of [1,2]){const h=await fixture(),budget=B.createPhaseBudget();let reads=0;h.state.readHook=p=>{if(++reads===nth)throw Error('probe-read');return p;};
      await rejects(()=>recovered(h,{budget}));clean(budget);}
    measurements.push({hashFailureCuts:calls,readFailureCuts:2});
  });
  await group('08 returned page payloads cannot survive as async hash input aliases',async()=>{
    const h=await fixture(),budget=B.createPhaseBudget();let invalidations=0;
    const crypto={subtle:{async digest(...args){eq(budget.snapshot().reservations['reload-page'],0,'returned pages gone before digest');
      if(h.state.latestPage){h.state.latestPage.segments[0].payload.fill(0);h.state.latestPage=null;invalidations++;}return webcrypto.subtle.digest(...args);}}};
    const {lease}=await recovered(h,{budget,crypto});eq(lease.storyText,h.storyText);eq(lease.phase.checkpoint,h.input.checkpoint);eq(invalidations,2);lease.dispose();clean(budget);
  });
  await group('09 suspended page and digest retain explicit leases and reject overlapping reader',async()=>{
    for(const point of ['read','hash']){const h=await fixture(),budget=B.createPhaseBudget(),entered=deferred(),release=deferred();let stopped=false;
      if(point==='read')h.state.readHook=async p=>{if(!stopped){stopped=true;entered.resolve();await release.promise;}return p;};
      const crypto={subtle:{async digest(...args){if(point==='hash'&&!stopped&&budget.snapshot().reservations['reload-chunk']){
        stopped=true;entered.resolve();await release.promise;}return webcrypto.subtle.digest(...args);}}};
      const pending=recovered(h,{budget,crypto});await entered.promise;
      ok(budget.snapshot().reservations[point==='read'?'reload-page':'reload-chunk']>0);
      await rejects(()=>recovered(h,{budget}),/context-reload-busy/);release.resolve();const {lease}=await pending;lease.dispose();clean(budget);
    }
  });
  await group('10 mutable caller pins are snapshotted before observer and async reentry',async()=>{
    const h=await fixture();let changed=false;
    const {lease,budget}=await recovered(h,{observe(){if(changed)return;changed=true;h.contextPin.head.root=C.ZERO;h.phasePin.descriptor.run='bad';}});
    eq(lease.storyText,h.storyText);eq(lease.phase.checkpoint,h.input.checkpoint);lease.dispose();clean(budget);
  });
  await group('11 every reader and reused admission observer event may throw without leakage',async()=>{
    const reference=await fixture(),events=[];const first=await recovered(reference,{observe:e=>events.push([e.type,e.label])});first.lease.dispose();
    for(let cut=0;cut<events.length;cut++){
      const h=await fixture();let seen=0,thrown=false,lease;
      const budget=B.createPhaseBudget({observe(){if(seen++===cut){thrown=true;throw Error('probe-observer-'+cut);}}});
      try{lease=(await recovered(h,{budget})).lease;lease.dispose();}catch(error){assert.match(error.message,/probe-observer/);checks++;}
      ok(thrown,'every reference event reached');if(lease)assert.throws(()=>lease.storyText,/disposed/);clean(budget);
    }
    measurements.push({observerFailureCuts:events.length});
  });
  await group('12 new recovery reservations preserve maxima, singleton and global ceiling guards',async()=>{
    const slots={'reload-page':32768,'reload-chunk':32768,'reload-story-work':65536,'reload-binding':12288,'reload-decode':4096,'reload-phase-retained':65536,
      'atomic-retained':32768,'atomic-record-workspace':65536};
    for(const [label,max]of Object.entries(slots)){const b=B.createPhaseBudget();assert.throws(()=>b.reserve(label,max+1),/transient-budget/);checks++;
      b.reserve(label,max);assert.throws(()=>b.reserve(label,1),/budget-lifetime/);checks++;b.release(label,max);clean(b);}
    const b=B.createPhaseBudget();b.reserve('phase-workspace',327680);b.reserve('context-retained',65536);b.reserve('reload-phase-retained',65536);
    b.reserve('reload-story-work',65536);b.reserve('reload-page',32768);b.reserve('reload-chunk',32768);
    assert.throws(()=>b.reserve('reload-binding',12288),/transient-budget/);checks++;
    for(const [label,n]of Object.entries(b.snapshot().reservations))if(!['metadata','adapter'].includes(label)&&n)b.release(label,n);clean(b);
    const old=B.createPhaseBudget();old.reserve('phase-workspace',327680);assert.throws(()=>old.reserve('context-parse',65536),/budget-lifetime/);checks++;
    old.release('phase-workspace',327680);old.reserve('stream-candidate',1);assert.throws(()=>old.reserve('returned-page',1),/budget-lifetime/);checks++;
    old.release('stream-candidate',1);clean(old);
    for(const projection of ['callback-scratch','callback-outer-story','callback-inner-story','post-work-1','post-work-2','post-stringify','original-read-workspace']){
      for(const order of [[projection,'atomic-record-workspace'],['atomic-record-workspace',projection]]){const guard=B.createPhaseBudget();guard.reserve(order[0],1);
        assert.throws(()=>guard.reserve(order[1],1),/budget-lifetime/);checks++;guard.release(order[0],1);clean(guard);}
    }
  });
  await group('13 reader metadata partition includes maximally escaped legal scope strings',async()=>{
    for(const scope of ['\0'.repeat(128),'"'.repeat(128),'\ud800'.repeat(42),'😀'.repeat(32)]){
      const h=await fixture({scope}),stages=[];
      const {lease,budget}=await recovered(h,{observe(e){if(e.type==='event'&&e.label==='reload-metadata')stages.push(e.detail);}});
      eq(lease.contextReference.scope,scope);eq(lease.phase.reference.scope,scope);
      ok(stages.length>=4);for(const s of stages){eq(s.limit,24576);ok(s.bytes<=24576);}
      measurements.push({scopeUtf8:C.utf8Size(scope),scopeUtf16:scope.length*2,metadataPeak:Math.max(...stages.map(s=>s.bytes))});
      lease.dispose();clean(budget);
    }
  });
  await group('14 parsed context and model calls are charged before execution, never full-story serialized',async()=>{
    const h=await fixture(),budget=B.createPhaseBudget(),parse=JSON.parse,restore=Story.restore,fieldRestore=Field.restore,stringify=JSON.stringify;
    let parses=0,restores=0,fieldRestores=0,serializations=0;
    JSON.parse=function(text,...args){if(text===h.storyText){parses++;eq(budget.snapshot().reservations['context-parse'],65536);eq(budget.snapshot().reservations['phase-workspace'],0);}return parse.call(this,text,...args);};
    Story.restore=function(value,...args){restores++;eq(budget.snapshot().reservations['context-restore'],65536);return restore.call(this,value,...args);};
    Field.restore=function(value,...args){fieldRestores++;eq(budget.snapshot().reservations['phase-workspace'],327680);return fieldRestore.call(this,value,...args);};
    JSON.stringify=function(value,...args){if(value?.n===9&&value?.phase==='core')serializations++;return stringify.call(this,value,...args);};
    try{const {lease}=await recovered(h,{budget});eq(parses,1);eq(restores,1);eq(fieldRestores,1);eq(serializations,0);lease.dispose();clean(budget);}
    finally{JSON.parse=parse;Story.restore=restore;Field.restore=fieldRestore;JSON.stringify=stringify;}
  });
  await group('15 correctly rehashed phase still needs exact context reference and model admission',async()=>{
    for(const mutate of [parts=>{const cp=JSON.parse(parts[0].text);cp.complete=false;parts[0].text=Codec.stringify(cp);},
      parts=>{const ref=JSON.parse(parts[3].text);ref.scope='other';parts[3].text=Codec.stringify(ref);},
      parts=>{const binding=JSON.parse(parts[2].text);binding.seed++;parts[2].text=Codec.stringify(binding);}]){
      const h=await fixture(),parts=C.unframe(h.packet.bytes,h.packet.descriptor);mutate(parts);
      const frame=C.frame(parts),descriptor={...h.packet.descriptor,components:frame.components};h.phasePin=await h.seal(descriptor,frame.bytes,16384);
      const budget=B.createPhaseBudget();await rejects(()=>recovered(h,{budget}));clean(budget);
    }
    const a=await fixture(),b=await fixture({storyText:JSON.stringify(plan(9))+' '});
    a.phasePin=b.phasePin;a.entries.set(b.phasePin.descriptor.run,b.entries.get(b.phasePin.descriptor.run));
    const budget=B.createPhaseBudget();await rejects(()=>recovered(a,{budget}));clean(budget);
  });
  await group('16 disposing a reader lease never releases later caller work reservations',async()=>{
    const h=await fixture(),{lease,budget}=await recovered(h);
    budget.reserve('helper-hash',8);budget.reserve('atomic-retained',32768);budget.reserve('post-target',65536);
    lease.dispose();eq(budget.snapshot().reservations['helper-hash'],8);eq(budget.snapshot().reservations['atomic-retained'],32768);
    eq(budget.snapshot().reservations['post-target'],65536);budget.release('helper-hash',8);budget.release('atomic-retained',32768);budget.release('post-target',65536);clean(budget);
  });
  await group('17 oversized or noncanonical sealed head tokens refuse before hashing or decoding',async()=>{
    for(const token of ['h.'+'A'.repeat(1000)+'.'+'a'.repeat(64),'h.'+'A'.repeat(227)+'.'+'a'.repeat(64),'h.'+'A'.repeat(228)+'.'+'A'.repeat(64)]){
      const h=await fixture(),budget=B.createPhaseBudget();h.contextPin.head.token=token;let digests=0;
      await rejects(()=>recovered(h,{budget,crypto:{subtle:{digest(){digests++;throw Error('digest-should-not-run');}}}}));eq(digests,0);clean(budget);
    }
  });
  await group('18 observers that keep throwing cannot interrupt independent lease cleanup',async()=>{
    for(const trigger of ['context-parse','context-restore','reload-chunk','phase-workspace','reload-phase-retained']){
      const h=await fixture();let failed=false;
      const budget=B.createPhaseBudget({observe(e){if(e.type==='reserve'&&e.label===trigger)failed=true;if(failed)throw Error('probe-observer-persistent');}});
      await rejects(()=>recovered(h,{budget}));clean(budget);
    }
  });
  console.log(JSON.stringify({status:'passed',checks,groups,measurements,qualifications:['Source-only archive doubles; no native IDB or earned gameplay claim.',
    'Fresh reader re-admission; local immutable dependencies, not authentication or mutable-owner CAS.',
    'Representation reservations preserve the existing 1016832 ceiling; no universal JavaScript heap claim.']},null,2));
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
