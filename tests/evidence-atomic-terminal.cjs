'use strict';
// Portable source-only evidence: synthetic prerequisite history + previously
// captured model-valid phase fixture, Map archive double, native WebCrypto.
// No browser, IndexedDB durability, actual earned campaign, server or player data.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const {pathToFileURL}=require('node:url');
const Story=require('../story-plan.js'),Field=require('../field-model.js'),Codec=require('../trace-codec.js');
const F=require('./evidence-finale-controller-fixture.cjs');
const p=F.phases[4],SCOPE='fixture:atomic-terminal',SESSION='0123456789abcdef0123456789abcdef',PRINCIPAL='guest:source-test';
const url=name=>pathToFileURL(path.join(__dirname,'../prototypes/evidence-indexeddb',name)).href;
const clone=v=>JSON.parse(Codec.stringify(v));
let checks=0;const groups=[],measurements=[],resource={retained:0,scaffold:{}};
const eq=(a,b,msg)=>{assert.deepStrictEqual(a,b,msg);checks++;},ok=(v,msg)=>{assert(v,msg);checks++;};
const timestamps=n=>({storyAccumulated:n,report:n+1,pace:n+2,storyCompleted:n+3,lock:n+4});
const baseline=()=>({points:2100,life:null,awarded:null,completedAt:null,finalPoints:null,lockedAt:null,operationsText:null});
(async()=>{
  const C=await import(url('contract.mjs')),X=await import(url('finale-context-v1.mjs')),P=await import(url('finale-phase-v2.mjs')),
    B=await import(url('phase-budget.mjs')),A=await import(url('atomic-terminal.mjs')),R=await import(url('atomic-terminal-projection.mjs'));
  const group=async(name,fn)=>{await fn();groups.push(name);};
  function archive(scope=SCOPE){
    const entries=new Map(),events=[];let held=null,mode=null,readMode=null,serial=Promise.resolve();
    async function seal(descriptor,bytes,size=16384){
      const d=await C.descriptor(descriptor,webcrypto),segments=[];let previousRoot=C.ZERO,offset=0,ordinal=0;
      while(offset<bytes.length){const payload=bytes.slice(offset,Math.min(offset+size,bytes.length)),root=await C.chain(d,{ordinal,offset,previousRoot},payload,webcrypto);
        segments.push({ordinal,offset,length:payload.length,root,payload});previousRoot=root;offset+=payload.length;ordinal++;}
      const head=await C.makeHead(d,ordinal-1,bytes.length,previousRoot,true,webcrypto),pin={descriptor:clone(descriptor),head};
      entries.set(descriptor.run,{pin,segments});return clone(pin);
    }
    const api={scope,get retainedBytes(){return held?held.payload.length:0;},get physicalBusy(){return false;},
      async recover({cursor,maxHeads,maxBytes}){
        if(held)return {status:'refused',reason:'retry-pending'};const rows=[...entries.values()],index=cursor===null?0:Number(cursor||0),entry=rows[index];
        return {status:'page',heads:entry?[{captureIdentity:{scope,run:entry.pin.descriptor.run},...clone(entry.pin),sealed:true,acknowledgement:'idb-transaction-complete',durability:'strict'}]:[],
          watermark:rows.length,nextCursor:index+1<rows.length?String(index+1):null};
      },
      async readSegments(q){
        events.push('read:'+q.captureIdentity.run);if(held)return {status:'refused',reason:'retry-pending'};
        if(readMode&&q.captureIdentity.run.startsWith('fcommit1:')){const m=readMode;readMode=null;if(m==='refuse')return {status:'refused',reason:'transaction-aborted'};}
        const e=entries.get(q.captureIdentity.run),s=e?.segments[q.afterOrdinal+1];if(!e||!s||e.pin.head.token!==q.throughHead)return {status:'refused',reason:'missing'};
        return {status:'page',segments:[{...s,payload:new Uint8Array(s.payload)}],payloadBytes:s.length,throughHead:q.throughHead,
          nextCursor:s.ordinal<e.pin.head.ordinal?{captureIdentity:{...q.captureIdentity},throughHead:q.throughHead,afterOrdinal:s.ordinal}:null};
      },
      async appendSegment(q){events.push('append:'+q.descriptor.run);if(held)return {status:'refused',reason:'retry-pending'};const result=serial.then(()=>append(q,false));serial=result.then(()=>{});return result;},
      async retry(){events.push('retry');if(!held)return {status:'refused',reason:'no-retry'};const q=held;held=null;return append(q,true);},
      setMode(m){mode=m;},setReadMode(m){readMode=m;},entries,events,seal};
    async function append(q,retry){
      const m=mode;mode=null;
      if(!retry&&m==='abort')return {status:'refused',reason:'transaction-aborted'};
      if(!retry&&m==='quota')return {status:'refused',reason:'native-quota'};
      if(!retry&&m==='unknown-abort'){held={...q,descriptor:clone(q.descriptor),payload:new Uint8Array(q.payload)};return {status:'outcomeUnknown',reason:'terminal-unobserved'};}
      const old=entries.get(q.descriptor.run);let pin;
      if(old){if(!C.equalBytes(old.segments[0].payload,q.payload)||!equal(old.pin.descriptor,q.descriptor))return {status:'conflict',reason:'immutable-segment'};pin=old.pin;}
      else pin=await seal(q.descriptor,q.payload);
      if(!retry&&m==='unknown-commit'){held={...q,descriptor:clone(q.descriptor),payload:new Uint8Array(q.payload)};return {status:'outcomeUnknown',reason:'terminal-unobserved'};}
      return {status:old?'duplicate':'committed',receipt:{captureIdentity:{scope,run:q.descriptor.run},ordinal:0,length:q.payload.length,root:pin.head.root,headToken:pin.head.token,sealed:true,acknowledgement:'idb-transaction-complete',durability:'strict'},currentHead:clone(pin.head)};
    }
    return api;
  }
  const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  async function fixture({scope=SCOPE,storyText=JSON.stringify(F.plan(9)),prior=7,phaseInput,mutateManifest}={}){
    const adapter=archive(scope),budget=B.createPhaseBudget(),baseSeed=(p.seed-p.index*7919)>>>0;
    const binding={version:1,session:SESSION,chapter:9,edition:2,baseSeed,storyKey:F.storyKey(9),sourceKey:F.sourceKey(9),route:'spatial-finale'};
    budget.reserve('context-retained',storyText.length*2);const context=X.admitContext({scope,session:SESSION,storyText,binding},budget);
    const contextPin=await adapter.seal(X.describeContext(context).descriptor,C.frame([{name:'story',encoding:'utf16le',text:storyText},{name:'binding',encoding:'utf16le',text:Codec.stringify(binding)}]).bytes,32768);
    const reference={version:1,scope,run:contextPin.descriptor.run,binding:contextPin.head.binding,throughHead:contextPin.head.token};
    const source={version:1,n:9,phase:2,seed:baseSeed,seconds:prior};
    const input={scope,session:SESSION,checkpoint:clone(p.state),sourceText:JSON.stringify({...source,checkpoint:p.state}),binding:F.binding(p)};phaseInput?.(input);
    budget.reserve('raw-capsule',65536);const raw=P.freezeFinalePhase(input,budget);budget.release('raw-capsule',65536);budget.reserve('phase-workspace',327680);
    const artifact=P.makeFinalePhase(raw,context,reference,budget),phasePin=await adapter.seal(artifact.descriptor,artifact.bytes);
    budget.release('phase-workspace',327680);budget.release('context-retained',storyText.length*2);
    const manifest={version:1,contract:A.ATOMIC_CONTRACT,principal:PRINCIPAL,scope,session:SESSION,contextPin,source,
      gameContext:{legacy:clone(p.provenance.legacyAtCapture),precision:clone(p.provenance.precisionAtCapture),modifiers:clone(p.state.mods)},baseline:baseline(),
      entry:{origin:'new-disposable-guest',accountScope:'guest',initData:'',pendingQueueText:null}};
    mutateManifest?.(manifest);
    function owner({module=A,observe}={}){const budget=B.createPhaseBudget({observe(e){if(e.type==='event'&&e.label==='atomic-retained-state')resource.retained=Math.max(resource.retained,e.detail.bytes);
        if(e.type==='event'&&e.label==='atomic-scaffold')resource.scaffold[e.detail.stage]=Math.max(resource.scaffold[e.detail.stage]||0,e.detail.bytes);observe?.(e);}}),owner=module.createAtomicTerminalOwner({adapter,scope,session:SESSION,principal:PRINCIPAL,budget,crypto:webcrypto});return {owner,budget};}
    return {adapter,manifest,phasePin,storyText,owner};
  }
  async function adopted(h){const o=h.owner();const v=await o.owner.adopt(h.manifest);eq([v.state,v.reason],['ADOPTED',null]);return o;}
  function clean(b){const held=b.snapshot().reservations;for(const [label,n]of Object.entries(held))if(!['adapter','metadata'].includes(label))eq(n,0,label);}
  await group('01 canonical commit, exact duplicate, fresh module recovery twice, callback count zero',async()=>{
    const h=await fixture(),a=await adopted(h);let oldCallbacks=0;globalThis.awardLifePoints=()=>oldCallbacks++;
    const v=await a.owner.submit({phasePin:h.phasePin,timestamps:timestamps(1000)});eq([v.state,v.reason],['READY',null]);eq(v.projection.reward.balance,5100);eq(v.projection.reward.entitlement,'life:9:complete');
    eq(v.projection.values.mkty_field_finale_9_v1,null);eq(JSON.parse(v.projection.storyText).phase,'complete');eq(v.projection.addedSeconds,10);
    const original=clone(v.projection),pin=clone(v.terminalPin);eq(v.continueEnabled,true);
    eq((await a.owner.submit({phasePin:h.phasePin,timestamps:timestamps(2000)})).projection,original,'competing timestamp proposal adopts stored winner');
    eq(a.owner.view().terminalPin,pin);eq(oldCallbacks,0);a.owner.dispose();clean(a.budget);
    for(let i=0;i<2;i++){const module=await import(url('atomic-terminal.mjs')+'?reload='+i),b=h.owner({module});
      const r=await b.owner.recover();eq([r.state,r.reason],['READY',null]);eq(r.projection,original);eq(r.terminalPin,pin);eq(oldCallbacks,0);b.owner.dispose();clean(b.budget);}
    delete globalThis.awardLifePoints;measurements.push({case:'normal',peak:a.budget.snapshot().peak,terminalBytes:pin.head.total});
  });
  await group('02 abort/quota then exact retry preserves result and grants once',async()=>{
    for(const failure of ['abort','quota']){const h=await fixture(),a=await adopted(h);h.adapter.setMode(failure);
      const v=await a.owner.submit({phasePin:h.phasePin,timestamps:timestamps(3000)});eq(v.state,'UNSAVED');eq(v.continueEnabled,false);eq(v.projection.reward.balance,5100);
      ok(!h.adapter.entries.has(`fcommit1:${SESSION}:9:2`));const result=clone(v.projection);eq((await a.owner.retry()).projection,result);eq(a.owner.view().state,'READY');
      eq(h.adapter.entries.size,4);a.owner.dispose();clean(a.budget);}
  });
  await group('03 lost acknowledgment committed/aborted resolves adapter exact retry before reads',async()=>{
    for(const failure of ['unknown-commit','unknown-abort']){const h=await fixture(),a=await adopted(h);h.adapter.setMode(failure);
      const v=await a.owner.submit({phasePin:h.phasePin,timestamps:timestamps(4000)});eq(v.state,'UNSAVED');ok(h.adapter.retainedBytes>0);const before=h.adapter.events.length;
      eq((await a.owner.submit({phasePin:h.phasePin,timestamps:timestamps(5000)})).state,'UNSAVED');eq(h.adapter.events.length,before);
      const r=await a.owner.retry();eq([r.state,r.reason],['READY',null]);eq(h.adapter.events[before],'retry');eq(h.adapter.retainedBytes,0);eq(JSON.parse(r.projection.storyText).createdAt,4003);
      a.owner.dispose();clean(a.budget);}
  });
  await group('04 readback failure after commit never reenacts or creates second command',async()=>{
    const h=await fixture(),a=await adopted(h);h.adapter.setReadMode('refuse');const first=await a.owner.submit({phasePin:h.phasePin,timestamps:timestamps(6000)});
    eq(first.state,'UNSAVED');ok(h.adapter.entries.has(`fcommit1:${SESSION}:9:2`));const appends=h.adapter.events.filter(e=>e.startsWith('append:fcommit1')).length;
    const r=await a.owner.retry();eq([r.state,r.reason],['READY',null]);eq(h.adapter.events.filter(e=>e.startsWith('append:fcommit1')).length,appends);a.owner.dispose();clean(a.budget);
  });
  await group('05 fixed principal, initial source/modifiers, legacy/account/pending and old receipts refuse',async()=>{
    for(const mutate of [m=>m.entry.initData='account-token',m=>m.entry.accountScope='telegram:123',m=>m.entry.pendingQueueText='[]',m=>m.entry.origin='legacy',
      m=>m.baseline.awarded='yes',m=>m.baseline.life='complete',m=>m.baseline.completedAt=42,m=>m.baseline.finalPoints='99',m=>m.baseline.lockedAt='1',m=>m.source.phase=1,
      m=>m.gameContext.modifiers.stability++,m=>m.principal='telegram:123']){
      const h=await fixture({mutateManifest:mutate}),a=h.owner(),v=await a.owner.adopt(h.manifest);eq(v.state,'BLOCKED');ok(!h.adapter.entries.has(`fown1:${SESSION}`));a.owner.dispose();clean(a.budget);
    }
    const h=await fixture({phaseInput(i){i.sourceText=JSON.stringify({...JSON.parse(i.sourceText),seconds:8});}}),a=h.owner();
    const v=await a.owner.adopt(h.manifest);eq(v.state,'BLOCKED');eq(v.reason,'atomic-command-mismatch');ok(!h.adapter.entries.has(`fcommit1:${SESSION}:9:2`));a.owner.dispose();clean(a.budget);
    assert.throws(()=>A.createAtomicTerminalOwner({adapter:h.adapter,scope:SCOPE,session:SESSION,principal:'telegram:123',budget:B.createPhaseBudget(),crypto:webcrypto}),/atomic-principal/);checks++;
  });
  await group('06 independent owners converge timestamps, changed immutable manifest conflicts',async()=>{
    const h=await fixture(),a=await adopted(h),b=h.owner();eq((await b.owner.recover()).state,'ADOPTED');
    const results=await Promise.all([a.owner.submit({phasePin:h.phasePin,timestamps:timestamps(7000)}),b.owner.submit({phasePin:h.phasePin,timestamps:timestamps(8000)})]);
    eq(results.map(r=>[r.state,r.reason]),[['READY',null],['READY',null]]);eq(results[0].projection,results[1].projection);a.owner.dispose();b.owner.dispose();clean(a.budget);clean(b.budget);
    const c=h.owner(),different=clone(h.manifest);different.baseline.points++;
    const v=await c.owner.adopt(different);eq(v.state,'BLOCKED');eq(v.reason,'atomic-command-conflict');c.owner.dispose();clean(c.budget);
  });
  await group('07 missing/corrupt dependencies and unreadable canonical database fail closed',async()=>{
    const h=await fixture(),a=await adopted(h);await a.owner.submit({phasePin:h.phasePin,timestamps:timestamps(9000)});a.owner.dispose();
    const context=h.adapter.entries.get(h.manifest.contextPin.descriptor.run);context.segments[0].payload[40]^=1;
    const b=h.owner(),v=await b.owner.recover();eq(v.state,'BLOCKED');eq(v.continueEnabled,false);b.owner.dispose();clean(b.budget);
    const orphan=await fixture(),c=orphan.owner(),r=await c.owner.recover();eq(r.state,'BLOCKED');eq(r.reason,'atomic-manifest-missing');c.owner.dispose();clean(c.budget);
  });
  await group('08 pure projection preserves two restores, clamp, opaque data, JSON normalization and frozen time',async()=>{
    for(const prior of [0,17.25,1e7+1,Number.MAX_VALUE]){
      const b=B.createPhaseBudget();b.reserve('post-target',65536);const input=F.plan(9);input.coreSeconds=1e7;
      input.tasks[0]={proof:{zero:-0,opaque:'界🌙\ud800'},performance:{errors:-0,impacts:0,detections:0,moves:0,seconds:0,precise:true,opaque:'kept'}};
      input.finaleEvidence={version:99,units:'\udfff'};input.ignored='drop';
      const text=JSON.stringify(input).replace('"zero":0','"zero":-0').replace('"errors":0','"errors":-0'),t=timestamps(10000);
      let count=0;const restore=Story.restore;Story.restore=function(v){count++;return restore(v);};let output;
      try{output=R.projectAtomicTerminal({storyText:text,sourceSeconds:prior,phaseSeconds:3,baseline:baseline(),timestamps:t},b);}finally{Story.restore=restore;}
      const first=Story.restore(JSON.parse(text));first.coreSeconds+=prior+3;first.createdAt=t.storyAccumulated;
      const expected=Story.restore(JSON.parse(JSON.stringify(first)));expected.phase='complete';expected.createdAt=t.storyCompleted;
      eq(count,2);eq(output.storyText,JSON.stringify(expected));eq(output.coreSeconds,1e7);eq(JSON.parse(output.storyText).tasks[0].proof.zero,0);eq(output.values.mkty_points_locked_at,'10004');
      b.release('post-target',65536);clean(b);
    }
  });
  await group('09 long legal context survives commit and reload without truncation',async()=>{
    const story=F.plan(9),proof=Field.create(8,0,731);proof.trace=[];const act=(a,v)=>{proof.trace.push(['act',a,v??null]);Field.act(proof,a,v);};
    const layout=Field.layout(proof);for(let i=0;i<3;i++){act('station',i);act('angle',Math.round(layout.bearings[i]));act('sample');}act('pin',layout.source);act('locate');
    proof.trace=[...Array.from({length:900},()=>['act','station',0]),...proof.trace];ok(Field.restore(proof,8,0,proof.seed));eq(proof.trace.length,911);
    story.tasks[0]={proof};story.finaleEvidence={opaque:'界🌙\ud800'};const text=JSON.stringify(story),h=await fixture({storyText:text}),a=await adopted(h);
    const v=await a.owner.submit({phasePin:h.phasePin,timestamps:timestamps(11000)});eq([v.state,v.reason],['READY',null]);eq(JSON.parse(v.projection.storyText).tasks[0].proof.trace.length,911);
    const expected=v.projection.storyText;measurements.push({case:'long-911-actions',contextUtf16:text.length*2,contextUtf8:C.utf8Size(text),resultUtf16:expected.length*2,peak:a.budget.snapshot().peak,terminalBytes:v.terminalPin.head.total});
    ok(a.budget.snapshot().peak<=1016832);a.owner.dispose();clean(a.budget);const b=h.owner();eq((await b.owner.recover()).projection.storyText,expected);b.owner.dispose();clean(b.budget);
  });
  await group('10 prepared operations parity and original unchanged story writers in isolated VM',async()=>{
    const prepared=await import(url('prepared-operations.mjs'));
    const h=await fixture({mutateManifest(m){m.baseline.operationsText=prepared.preparedOperationsText(9);}}),a=await adopted(h);
    const result=await a.owner.submit({phasePin:h.phasePin,timestamps:timestamps(12000)});
    eq(result.projection.values.mkty_operations_9_v1,prepared.preparedOperationsText(9,'complete'));a.owner.dispose();clean(a.budget);
    const text=JSON.stringify({...F.plan(9),coreSeconds:9999999,finaleEvidence:{unknown:['opaque','界🌙\ud800']}}),t=timestamps(13000),disk=new Map([[F.storyKey(9),text]]);
    let reads=0,oldCallbackCount=0;class Clock extends Date{static now(){return [t.storyAccumulated,t.storyCompleted][reads++];}}
    const c={Date:Clock,localStorage:{getItem:k=>disk.get(k)??null,setItem:(k,v)=>disk.set(k,String(v))},awardLifePoints(){oldCallbackCount++;}};c.window=c;c.globalThis=c;vm.createContext(c);
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../story-plan.js'),'utf8'),c);
    const originalFunctions=fs.readFileSync(path.join(__dirname,'../story.js'),'utf8').split('\n').filter(l=>/^ function (read|write|complete)\(/.test(l)).join('\n');
    vm.runInContext(`MKTYStory=(()=>{const P=StoryPlan,key=n=>'mkty_story_plan_'+n+'_v1';let storageOK=true;${originalFunctions};return {read,complete};})();`,c);
    vm.runInContext("const accumulated=MKTYStory.read(9);accumulated.coreSeconds+=17.25;localStorage.setItem('mkty_story_plan_9_v1',JSON.stringify(accumulated));MKTYStory.complete(9);",c);
    const b=B.createPhaseBudget();b.reserve('post-target',65536);const pure=R.projectAtomicTerminal({storyText:text,sourceSeconds:14.25,phaseSeconds:3,baseline:{...baseline(),completedAt:42},timestamps:t},b);
    eq(pure.storyText,disk.get(F.storyKey(9)));eq(reads,2);eq(oldCallbackCount,0);eq(pure.values.mkty_life9_completed_at,'42');b.release('post-target',65536);clean(b);
  });
  await group('11 observer exceptions release owned work slots and original callback stays unreachable',async()=>{
    const cases=[['reserve','atomic-record-workspace'],['allocate','atomic-record-workspace'],['release','atomic-record-workspace'],
      ['reserve','returned-page'],['allocate','returned-page'],['release','returned-page'],['reserve','helper-hash'],['allocate','helper-hash'],['release','helper-hash'],
      ['reserve','helper-framing'],['allocate','helper-framing'],['release','helper-framing'],['reserve','post-target'],['allocate','post-target'],
      ['reserve','post-work-1'],['allocate','post-work-2'],['release','post-stringify'],['event','atomic-story-second-restore'],['allocate','atomic-retained']];
    for(const [type,label]of cases){const h=await fixture();let armed=false,fired=false;const a=h.owner({observe(e){if(armed&&!fired&&e.type===type&&e.label===label){fired=true;throw Error('probe-observer');}}});
      eq((await a.owner.adopt(h.manifest)).state,'ADOPTED');armed=true;const v=await a.owner.submit({phasePin:h.phasePin,timestamps:timestamps(14000)});armed=false;
      ok(fired,type+':'+label);eq(v.state,'BLOCKED');eq(v.continueEnabled,false);a.owner.dispose();clean(a.budget);
    }
    for(const label of ['post-target','atomic-retained']){const h=await fixture();let armed=false;const a=h.owner({observe(e){if(armed&&e.type==='release'&&e.label===label)throw Error('probe-dispose');}});
      await a.owner.adopt(h.manifest);await a.owner.submit({phasePin:h.phasePin,timestamps:timestamps(15000)});armed=true;assert.throws(()=>a.owner.dispose(),/probe-dispose/);checks++;armed=false;clean(a.budget);}
    for(const type of ['reserve','allocate']){const b=B.createPhaseBudget({observe(e){if(e.type===type&&e.label==='atomic-retained')throw Error('probe-constructor');}}),h=await fixture();
      assert.throws(()=>A.createAtomicTerminalOwner({adapter:h.adapter,scope:SCOPE,session:SESSION,principal:PRINCIPAL,budget:b,crypto:webcrypto}),/probe-constructor/);checks++;clean(b);}
  });
  await group('12 changed terminal evidence pin and corrupted recipe refuse without another grant',async()=>{
    const h=await fixture(),a=await adopted(h);const original=await a.owner.submit({phasePin:h.phasePin,timestamps:timestamps(16000)}),expected=clone(original.projection);
    const changed=await fixture({phaseInput(i){i.checkpoint.seconds+=1;i.sourceText=JSON.stringify({...JSON.parse(i.sourceText),checkpoint:i.checkpoint});}});
    const phaseRun=h.phasePin.descriptor.run,old=h.adapter.entries.get(phaseRun);
    // An explicitly adversarial archive double substitutes coherent changed bytes;
    // accepted immutable append cannot do this. Correspondence still refuses.
    h.adapter.entries.set(phaseRun,changed.adapter.entries.get(phaseRun));
    const refusal=await a.owner.submit({phasePin:changed.phasePin,timestamps:timestamps(17000)});eq(refusal.state,'BLOCKED');eq(refusal.reason,'atomic-command-conflict');
    h.adapter.entries.set(phaseRun,old);eq((await a.owner.recover()).projection,expected);a.owner.dispose();clean(a.budget);
    const terminal=h.adapter.entries.get(`fcommit1:${SESSION}:9:2`),parts=C.unframe(terminal.segments[0].payload,terminal.pin.descriptor),record=JSON.parse(parts[0].text);record.result.reward.amount++;
    const text=JSON.stringify(record),frame=C.frame([{name:'terminal',encoding:'utf16le',text}]),descriptor={...terminal.pin.descriptor,components:frame.components};
    await h.adapter.seal(descriptor,frame.bytes);const b=h.owner(),v=await b.owner.recover();eq(v.state,'BLOCKED');eq(v.reason,'atomic-projection-mismatch');b.owner.dispose();clean(b.budget);
  });
  await group('13 catalog truncation, changing watermark, holes and duplicates never mean empty',async()=>{
    const mutations=[(page,i)=>i===0?{...page,nextCursor:null}:page,(page,i)=>i===1?{...page,watermark:3}:page,
      (page,i)=>i===0?{...page,heads:[]}:page,(page,i,first)=>i===1?{...page,heads:first.heads}:page,
      (page,i)=>i===1?{...page,nextCursor:'1'}:page,(page)=>({...page,watermark:5})];
    for(const mutate of mutations){const h=await fixture(),read=h.adapter.recover;let calls=0,first;
      h.adapter.recover=async q=>{const page=await read(q);first??=page;return mutate(page,calls++,first);};
      const a=h.owner(),v=await a.owner.recover();eq(v.state,'BLOCKED');ok(v.reason!=='atomic-manifest-missing');eq(v.continueEnabled,false);a.owner.dispose();clean(a.budget);
    }
    const h=await fixture(),copy=clone(h.manifest.contextPin),old=h.adapter.entries.get(copy.descriptor.run);copy.descriptor.run='foreign-unowned-capture';
    h.adapter.entries.set(copy.descriptor.run,{pin:copy,segments:old.segments});const a=h.owner(),v=await a.owner.recover();eq(v.reason,'atomic-scope-not-isolated');a.owner.dispose();clean(a.budget);
    const empty=archive(),b=B.createPhaseBudget();eq(await A.findAtomicCapture(empty,SCOPE,`fown1:${SESSION}`,b,webcrypto),null);clean(b);
  });
  await group('14 exact raw story cap and escaped-scope metadata stay bounded',async()=>{
    let text=JSON.stringify(F.plan(9));text+=' '.repeat(32768-text.length);
    for(const storyText of [text,JSON.stringify({...F.plan(9),finaleEvidence:{opaque:'界'.repeat(31000)}})]){
      const h=await fixture({storyText}),a=await adopted(h),v=await a.owner.submit({phasePin:h.phasePin,timestamps:timestamps(18000)});
      eq([v.state,v.reason],['READY',null]);if(storyText!==text)eq(JSON.parse(v.projection.storyText).finaleEvidence.opaque,'界'.repeat(31000));
      measurements.push({case:'source-cap',contextUtf16:storyText.length*2,resultUtf16:v.projection.storyText.length*2,peak:a.budget.snapshot().peak});ok(a.budget.snapshot().peak<=1016832);a.owner.dispose();clean(a.budget);
    }
    const h=await fixture({scope:'\0'.repeat(128)}),a=await adopted(h),v=await a.owner.submit({phasePin:h.phasePin,timestamps:timestamps(19000)});
    eq([v.state,v.reason],['READY',null]);const expected=clone(v.projection);eq((await a.owner.submit({phasePin:h.phasePin,timestamps:timestamps(20000)})).projection,expected);ok(resource.retained<=32768);ok(Object.values(resource.scaffold).every(n=>n<=32768));ok(resource.scaffold['dependency-caller']<=8192);
    measurements.push({case:'escaped-scope',terminalBytes:v.terminalPin.head.total,peak:a.budget.snapshot().peak});a.owner.dispose();clean(a.budget);
  });
  const report={suite:'evidence-atomic-terminal',status:'passed',groups:groups.length,checks,groupNames:groups,measurements,resource,
    qualification:'Synthetic prerequisites/model-valid archived checkpoint + Map transport doubles/native WebCrypto; no native IndexedDB, browser, earned full campaign, server or actual old callback invocation'};
  console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;});
