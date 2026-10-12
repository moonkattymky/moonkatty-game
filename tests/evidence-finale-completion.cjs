'use strict';
// Socket-free deterministic local admission. No browser, IDB or reward claims.
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const Field=require('../field-model.js'),Codec=require('../trace-codec.js'),Story=require('../story-plan.js');
const fixtures=require('./fixtures/finale-checkpoints-17-state.json');
const root=path.resolve(__dirname,'../prototypes/evidence-indexeddb');
const url=name=>pathToFileURL(path.join(root,name)).href;
const clone=v=>JSON.parse(Codec.stringify(v));
let serial=0,checks=0;const groups=[],measurements=[];
const eq=(a,b)=>{assert.deepStrictEqual(a,b);checks++;},ok=v=>{assert(v);checks++;};
const throws=(fn,re=/finale-(admission|limit)/)=>{assert.throws(fn,re);checks++;};
(async()=>{
  const C=await import(url('contract.mjs')),F=await import(url('finale-completion.mjs')),S=await import(url('synthetic-completion.mjs'));
  const fresh=()=>import(url('unsaved-result-gate.mjs')+'?finale-unit='+ ++serial);
  const live=()=>({scope:'fixture:A',generation:1,sourceIdentity:'source:1'});
  function input(p=fixtures.phases[0]){
    const checkpoint=clone(p.state),baseSeed=(p.seed-p.index*7919)>>>0;
    return {scope:'fixture:A',run:'phase:1',checkpoint,
      sourceText:JSON.stringify({version:1,n:p.chapter,phase:p.index,seed:baseSeed,seconds:0,checkpoint}),
      storyText:JSON.stringify({...Story.fresh(p.chapter,9000+p.chapter,2),createdAt:1,phase:'core',done:[0,1,2,3,4,5,6,7]}),
      binding:{version:1,chapter:p.chapter,edition:2,phase:p.index,mechanic:p.mechanic,fieldStage:4,baseSeed,seed:p.seed,
        sourceKey:`mkty_field_finale_${p.chapter}_v1`,storyKey:`mkty_story_plan_${p.chapter}_v1`,route:'spatial-finale',provenance:clone(p.provenance)}};
  }
  const packet=x=>({...F.makeFinaleCompletion(x),context:live()});
  const synthetic=()=>({...S.makeSyntheticCompletion({scope:'fixture:A',run:'synthetic:1',totalBytes:256,
    summary:{version:1,resultId:'synthetic:1',completedSteps:1,label:'Synthetic'}}),context:live()});
  async function harness(module=undefined){
    module=module||await fresh();let context=live(),release=null;
    const calls=[],stored=new Map(),hooks={append:null,read:null};
    const coordinator={retainedBytes:0,retry:async()=>({status:'refused',reason:'no-retry'}),
      async appendSegment(q){
        calls.push(q);if(hooks.append){const r=await hooks.append(q);if(r)return r;}
        const d=await C.descriptor(q.descriptor),root=await C.chain(d,q,q.payload),head=await C.makeHead(d,q.ordinal,q.offset+q.payload.length,root,!!q.seal);
        stored.set(q.ordinal,{ordinal:q.ordinal,offset:q.offset,length:q.payload.length,root,payload:new Uint8Array(q.payload)});
        return {status:'committed',contextCurrent:true,currentHead:head,receipt:{captureIdentity:{scope:q.descriptor.scope,run:q.descriptor.run},
          ordinal:q.ordinal,length:q.payload.length,root,headToken:head.token,sealed:head.sealed,acknowledgement:'idb-transaction-complete',durability:'strict'}};
      },
      async readSegments(request){const s=stored.get((request.afterOrdinal??-1)+1),page={status:'page',segments:[{...s,payload:new Uint8Array(s.payload)}],payloadBytes:s.length,throughHead:request.throughHead,nextCursor:null};return hooks.read?hooks.read(page):page;}};
    const continued=[];let gate;
    gate=module.createUnsavedResultGate({coordinator,readContext:()=>context,onContinue(...args){continued.push(args);release?.(gate);}});
    return {gate,module,calls,stored,hooks,continued,coordinator,setContext:x=>{context=x;},onContinue:fn=>{release=fn;}};
  }
  const group=async(name,fn)=>{await fn();groups.push(name);};
  await group('all 17 original raw checkpoints, local model completion, exact byte readback and private continuation',async()=>{
    for(const p of fixtures.phases){
      const x=input(p),artifact=packet(x),admitted=F.admitFinaleCompletion(artifact.bytes,artifact.descriptor,artifact.summary);
      eq(admitted.checkpoint,p.state);eq(admitted.sourceText,x.sourceText);eq(admitted.storyText,x.storyText);eq(admitted.binding,x.binding);
      ok(Object.isFrozen(admitted.checkpoint));eq(admitted.summary.authority,'not-established');
      const h=await harness(),v=await h.gate.accept(artifact);eq(v.state,'READY');eq(h.continued.length,0);
      eq(v.diagnostics.admissions,2);eq(v.diagnostics.finaleWorkspaceBytes,327680);eq(v.diagnostics.wholeArtifactCopies,1);
      eq(v.diagnostics.modeledEnvelopeBytes,623616+2*artifact.bytes.length+327680);ok(v.diagnostics.modeledPeakBytes<=v.diagnostics.modeledEnvelopeBytes);
      ok(v.diagnostics.modeledEnvelopeBytes<=h.module.GATE_LIMIT.combined);eq(h.calls.length,1);
      eq(h.gate.continue().state,'CONTINUED');eq(h.continued.length,1);eq(h.continued[0],[p.state]);
      h.gate.continue();await h.gate.retry();eq(h.continued.length,1);ok(Object.isFrozen(h.continued[0][0].trace));
      measurements.push({label:p.label,chapter:p.chapter,phase:p.index,bytes:artifact.bytes.length,sourceUtf16:x.sourceText.length*2,storyUtf16:x.storyText.length*2});
    }
    eq(fixtures.phases.length,17);
    eq(fixtures.phases.find(p=>p.label==='earned-echo-noise-105').state.noise,105);
    eq(fixtures.phases.find(p=>p.label==='earned-gate-minus-one').state.stability,-1);
  });
  await group('negative zero, controller seconds, raw whitespace and raw UTF16 code units survive',async()=>{
    const x=input();x.checkpoint.selected=-0;x.checkpoint.seconds=-0;x.checkpoint.trace[0][2]=-0;x.checkpoint.notice='raw\ud800value';
    x.binding.provenance.raw='\udfff';x.binding.provenance.negativeZero=-0;
    const src=JSON.parse(x.sourceText);src.checkpoint=x.checkpoint;
    x.sourceText='\n '+JSON.stringify(src).replace('raw\\ud800value','raw\ud800value')+' \n';
    x.storyText=x.storyText.replace('"coreSeconds":0','"coreSeconds":-0.0');
    const a=packet(x),r=F.admitFinaleCompletion(a.bytes,a.descriptor,a.summary);
    ok(Object.is(r.checkpoint.selected,-0));ok(Object.is(r.checkpoint.seconds,-0));ok(Object.is(r.checkpoint.trace[0][2],-0));
    ok(Object.is(r.binding.provenance.negativeZero,-0));eq(r.sourceText,x.sourceText);eq(r.storyText,x.storyText);eq(r.checkpoint.notice,'raw\ud800value');
    eq(JSON.parse(r.sourceText).checkpoint.selected,0);
    const h=await harness();eq((await h.gate.accept(a)).state,'READY');h.gate.continue();ok(Object.is(h.continued[0][0].selected,-0));
  });
  await group('recognized controller retry metadata preserves the full raw callback',async()=>{
    const x=input(fixtures.phases.find(p=>p.mechanic===6));x.checkpoint.attempt=2;x.checkpoint.failures=2;
    const source=JSON.parse(x.sourceText);source.checkpoint=x.checkpoint;x.sourceText=JSON.stringify(source);
    const a=packet(x),h=await harness();eq((await h.gate.accept(a)).state,'READY');h.gate.continue();
    eq(h.continued[0][0],x.checkpoint);eq(h.continued[0][0].failures,2);eq(h.gate.view().summary.attempt,2);
    for(const bad of [-1,0.5,10001,Number.MAX_SAFE_INTEGER,Infinity]){const v=input();v.checkpoint.failures=bad;throws(()=>packet(v));}
  });
  await group('earned closing-gate recovery after an impact keeps dynamically added state',async()=>{
    const x=input(fixtures.phases.find(p=>p.label==='earned-gate-minus-one'));
    const state=Field.create(11,4,0,{stability:40});state.trace=[];
    const act=action=>{state.trace.push(['act',action,null]);Field.act(state,action,null);};
    act('launch');for(let i=0;!state.complete&&!state.failed&&i<100;i++)act(Field.layout(state).aligned(state.turn)?'launch':'wait');
    ok(state.complete&&Field.won(state));eq(state.impacts,1);eq(state.errors,1);
    x.checkpoint=state;const source=JSON.parse(x.sourceText);source.checkpoint=state;x.sourceText=JSON.stringify(source);
    const a=packet(x),h=await harness();eq((await h.gate.accept(a)).state,'READY');h.gate.continue();eq(h.continued[0][0],state);
    for(const bad of [-1,0.5,10001]){state.impacts=bad;throws(()=>packet(x));}
  });
  await group('capture ownership is shared in both format directions and early refusal leaves owner free',async()=>{
    for(const first of ['synthetic','finale']){
      const h=await harness(),other=await harness(h.module);
      eq((await h.gate.accept(first==='finale'?packet(input()):synthetic())).state,'READY');
      eq((await other.gate.accept(first==='finale'?synthetic():packet(input()))).reason,'realm-capture-retained');eq(other.calls.length,0);
      h.gate.continue();eq((await other.gate.accept(packet(input()))).reason,'realm-capture-retained');
      eq(h.continued[0].length,first==='finale'?1:0);
    }
    const h=await harness(),a=packet(input());a.summary={...a.summary,seed:999};
    const v=await h.gate.accept(a);eq(v.state,'EMPTY');eq(v.retained,false);eq(v.diagnostics.finaleWorkspaceBytes,0);eq(h.calls.length,0);
    eq((await h.gate.accept(synthetic())).state,'READY');
  });
  await group('incomplete, wrong phase seed source route plan and unknown data refuse before ownership',async()=>{
    const bads=[x=>{x.checkpoint.complete=false;},x=>{x.checkpoint.seed++;},x=>{x.binding.seed++;},x=>{x.binding.phase=2;},
      x=>{x.binding.mechanic=6;},x=>{x.binding.edition=1;},x=>{x.binding.sourceKey='other';},x=>{x.binding.route='legacy';},
      x=>{x.sourceText=x.sourceText.replace('"phase":0','"phase":1');},x=>{x.sourceText=x.sourceText.replace('"seconds":3','"seconds":4');},
      x=>{x.storyText=x.storyText.replace('"core"','"complete"');},x=>{x.storyText=x.storyText.replace('"edition":2','"edition":1');},
      x=>{x.checkpoint.extra='unrecognized';},x=>{x.binding.extra=true;},x=>{x.checkpoint.version=99;},x=>{x.checkpoint.trace=[];},
      x=>{x.checkpoint.trace=[['mkty-trace',1,1,0,'AAAA']];},x=>{x.checkpoint.trace=[['tick',200001,0,0]];},
      x=>{x.checkpoint.trace=[['tick',1,NaN,0]];},x=>{x.checkpoint.attempt=10001;},x=>{x.sourceText='malformed';},
      x=>{x.checkpoint.notice=undefined;},x=>{x.checkpoint.notice=()=>{};},x=>{x.checkpoint.notice=Symbol('x');},
      x=>{x.checkpoint.self=x.checkpoint;},x=>{x.checkpoint.trace.length=5000;},x=>{x.checkpoint.notice='x'.repeat(17000);},
      x=>{x.sourceText+=' '.repeat(16384);},x=>{x.storyText+=' '.repeat(16384);},x=>{x.binding.provenance.text='x'.repeat(2048);},
      x=>{Object.defineProperty(x.checkpoint,'hidden',{value:true});},x=>{x.checkpoint[Symbol('hidden')]=true;},
      x=>{Object.defineProperty(x.checkpoint,'notice',{enumerable:true,get(){throw Error('getter ran');}});},
      x=>{Object.defineProperty(x.binding,'chapter',{enumerable:true,get(){throw Error('getter ran');}});}];
    for(const change of bads){const x=input();change(x);throws(()=>packet(x),/finale-(admission|limit)|trace_(invalid|too_large)/);}
    let deep={};for(let i=0;i<66;i++)deep={next:deep};const x=input();x.binding.provenance=deep;throws(()=>packet(x));
    const wide=input();wide.binding.provenance=Object.fromEntries(Array.from({length:129},(_,i)=>['k'+i,0]));throws(()=>packet(wide));
  });
  await group('malformed framing, noncanonical checkpoint, descriptor and readback changes fail closed',async()=>{
    for(const change of [a=>{a.bytes[0]^=1;},a=>{a.bytes[8]=3;},a=>{a.bytes[12]^=1;},
      a=>{a.descriptor.components[0].encoding='utf8';},a=>{a.descriptor.components[0].name='other';},
      a=>{a.descriptor.model='future-v2';},a=>{a.descriptor.note='unknown';},a=>{a.bytes=new Uint8Array(16385);}]){
      const h=await harness(),a=packet(input());change(a);const v=await h.gate.accept(a);eq(v.state,'EMPTY');eq(v.retained,false);eq(h.calls.length,0);
      eq((await h.gate.accept(packet(input()))).state,'READY');
    }
    const x=input(),a=packet(x),parts=C.unframe(a.bytes,a.descriptor);parts[0].text=' '+parts[0].text;
    const framed=C.frame(parts);throws(()=>F.admitFinaleCompletion(framed.bytes,{...a.descriptor,components:framed.components}));
    const h=await harness();h.hooks.read=page=>{page.segments[0].payload[20]^=1;return page;};
    eq((await h.gate.accept(packet(input()))).state,'BLOCKED');eq(h.gate.view().reason,'readback-mismatch');h.gate.continue();eq(h.continued.length,0);
  });
  await group('caller mutation and stale context cannot change or repeat private continuation',async()=>{
    const h=await harness(),x=input(),expected=clone(x.checkpoint),a=packet(x);
    let release,entered;const started=new Promise(r=>{entered=r;}),wait=new Promise(r=>{release=r;});
    h.hooks.append=async()=>{entered();await wait;};const pending=h.gate.accept(a);await started;
    x.checkpoint.trace.length=0;x.checkpoint.seconds=999;a.bytes.fill(0);a.descriptor.components[0].length=2;a.summary={};
    release();eq((await pending).state,'READY');h.onContinue(g=>{g.continue();throw Error('navigation threw');});
    eq(h.gate.continue().reason,'navigation-threw');eq(h.continued,[ [expected] ]);h.gate.continue();eq(h.continued.length,1);
    const stale=await harness();eq((await stale.gate.accept(packet(input()))).state,'READY');
    stale.setContext({...live(),generation:2});eq(stale.gate.continue().state,'STALE');eq(stale.continued.length,0);
    stale.setContext(live());eq(stale.gate.continue().state,'STALE');
  });
  await group('fixed slot limits, compact number expansion, synthetic populated plan and earned long trace refuse without trimming',async()=>{
    eq(F.FINALE_LIMIT.bytes,16384);eq(F.FINALE_LIMIT.workspace,327680);eq((await fresh()).GATE_LIMIT.bytes,196608);eq((await fresh()).GATE_LIMIT.combined,1016832);
    ok(623616+2*F.FINALE_LIMIT.bytes+F.FINALE_LIMIT.workspace<=1016832);
    const exact=input(),original=packet(exact);exact.storyText+=' '.repeat((16384-original.bytes.length)/2);
    const full=packet(exact);eq(full.bytes.length,16384);
    const h=await harness(),v=await h.gate.accept(full);eq(v.state,'READY');eq(v.diagnostics.modeledEnvelopeBytes,984064);
    ok(v.diagnostics.modeledPeakBytes<=984064);h.gate.continue();eq(h.continued.length,1);
    exact.storyText+=' ';throws(()=>packet(exact),/finale-limit/);
    const x=input(),story=JSON.parse(x.storyText);story.tasks={};
    for(let i=0;i<8;i++)story.tasks[i]={kind:'field',attempt:0,proof:{...clone(x.checkpoint),trace:Array.from({length:250},()=>['tick',1,0,0])}};
    ok(!!Story.restore(story));x.storyText=Codec.stringify(story);const before=x.storyText;throws(()=>packet(x));eq(x.storyText,before);
    const echo=fixtures.phases.find(p=>p.label==='earned-echo-noise-105'),long=input(echo),state=Field.create(10,4,0,{});state.trace=[];
    const play=row=>{state.trace.push(clone(row));Field.act(state,row[1],row[2]);};
    for(let i=0;i<1000;i++)play(['act','tune',2]);for(const row of echo.state.trace)play(row);
    ok(state.complete&&Field.won(state));ok(!!Field.restore(state,10,4,0));eq(Codec.unpackTrace(state.trace),state.trace);
    long.checkpoint=state;const session=JSON.parse(long.sourceText);session.checkpoint=state;long.sourceText=JSON.stringify(session);
    const retained=long.sourceText;throws(()=>packet(long),/finale-limit/);eq(long.sourceText,retained);
    const exponent=input();exponent.storyText=exponent.storyText.slice(0,-1)+',"data":['+Array(1200).fill('1e20').join(',')+']}';
    ok(exponent.storyText.length*2<=16384);throws(()=>packet(exponent));
    const maxima=[];
    for(const n of [10,3,9,6,11])for(const seed of [0,1,0xffffffff]){
      const value=Field.create(n,4,seed,{charges:3,stability:40,repair:10,cells:2,preview:1});
      const data=Object.fromEntries(Object.entries(Field.layout(value)).filter(([,v])=>typeof v!=='function'));
      maxima.push(2*Codec.stringify([value,data]).length);
    }
    ok(Math.max(...maxima)<4096);
  });
  const report={test:'evidence-finale-completion',status:'pass',groups:groups.length,checks,groupNames:groups,
    measurements,finaleArtifactLimit:F.FINALE_LIMIT.bytes,finaleMaximumModeledEnvelope:984064,
    nativeIndexedDB:'not-run',browserOrSocket:'not-used',serverAuthority:false,productionReady:false,
    limitations:['version2 raw checkpoints only','16KiB test-format cap can refuse legitimate populated StoryPlans and long sessions','no packed trace expansion','no JS heap/native allocator bound']};
  if(process.env.MKTY_FINALE_COMPLETION_REPORT)fs.writeFileSync(process.env.MKTY_FINALE_COMPLETION_REPORT,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
})().catch(error=>{console.error(error);process.exitCode=1;});
