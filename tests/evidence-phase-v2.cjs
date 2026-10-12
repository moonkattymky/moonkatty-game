'use strict';
// Socket-free fixed-format/local-model evidence only. No native storage, controller,
// replay authority, rewards, or continuous-handoff acceptance is implied.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {webcrypto}=require('node:crypto');
const Story=require('../story-plan.js'),Codec=require('../trace-codec.js');
const fixtures=require('./fixtures/finale-checkpoints-17-state.json');
const SESSION='0123456789abcdef0123456789abcdef',SCOPE='fixture:phase-v2';
let checks=0;const groups=[],measurements=[];
const eq=(a,b)=>{assert.deepStrictEqual(a,b);checks++;},ok=x=>{assert(x);checks++;};
const throws=(fn,re=/finale-(?:phase|context)-(?:admission|limit)|trace_(?:invalid|too_large)|allocation-unreserved|phase-account-required/)=>{assert.throws(fn,re);checks++;};
const clone=value=>JSON.parse(Codec.stringify(value));
function input(p=fixtures.phases[0]){
  const checkpoint=clone(p.state),baseSeed=(p.seed-p.index*7919)>>>0;
  return {scope:SCOPE,session:SESSION,checkpoint,sourceText:JSON.stringify({version:1,n:p.chapter,phase:p.index,seed:baseSeed,seconds:0,checkpoint}),
    binding:{version:1,chapter:p.chapter,edition:2,phase:p.index,mechanic:p.mechanic,fieldStage:4,baseSeed,seed:p.seed,
      sourceKey:`mkty_field_finale_${p.chapter}_v1`,storyKey:`mkty_story_plan_${p.chapter}_v1`,route:'spatial-finale',provenance:clone(p.provenance)}};
}
function story(n){return {...Story.fresh(n,9000+n,2),createdAt:1,phase:'core',done:[0,1,2,3,4,5,6,7]};}
(async()=>{
  const C=await import('../prototypes/evidence-indexeddb/contract.mjs'),X=await import('../prototypes/evidence-indexeddb/finale-context-v1.mjs');
  const F=await import('../prototypes/evidence-indexeddb/finale-phase-v2.mjs'),B=await import('../prototypes/evidence-indexeddb/phase-budget.mjs');
  const group=async(name,fn)=>{await fn();groups.push(name);};
  async function prepare(x=input(),storyText=JSON.stringify(story(x.binding.chapter))){
    const account=B.createPhaseBudget();account.reserve('raw-capsule',65536);const capsule=F.freezeFinalePhase(x,account);
    account.reserve('context-retained',storyText.length*2);
    const b=x.binding,context=X.admitContext({scope:x.scope,session:x.session,storyText,binding:{version:1,session:x.session,chapter:b.chapter,edition:2,
      baseSeed:b.baseSeed,storyKey:b.storyKey,sourceKey:b.sourceKey,route:b.route}},account);
    account.release('raw-capsule',65536);account.reserve('phase-workspace',327680);
    const info=X.describeContext(context),descriptor=await C.descriptor(info.descriptor,webcrypto),head=await C.makeHead(descriptor,Math.ceil(info.total/32768)-1,info.total,C.ZERO,true,webcrypto);
    // Deliberately a source unit pin: valid SHA structure, no claim it was stored.
    // Actual transport admission requires the streamer's private verified-pin brand.
    const reference={version:1,scope:x.scope,run:info.descriptor.run,binding:descriptor.binding,throughHead:head.token};
    return {x,capsule,context,reference,account,storyText};
  }
  const make=h=>F.makeFinalePhase(h.capsule,h.context,h.reference,h.account);
  const read=(h,a)=>F.admitFinalePhase(a.bytes,a.descriptor,h.context,h.reference,a.summary,h.account);
  await group('all 17 old raw model checkpoints survive exact v2 four-part format without context reparse',async()=>{
    for(const p of fixtures.phases){const h=await prepare(input(p)),oldParse=JSON.parse,oldRestore=Story.restore;
      JSON.parse=function(text,...args){if(text===h.storyText)throw Error('context-reparsed');return oldParse(text,...args);};
      Story.restore=()=>{throw Error('context-restored-again');};
      try{
        const summary=F.validateFinalePhase(h.capsule,h.context,h.account),a=make(h),r=read(h,a);
        eq(r.checkpoint,p.state);eq(r.sourceText,h.x.sourceText);eq(r.binding,h.x.binding);eq(r.reference,h.reference);eq(r.summary,summary);
        eq(r.summary.authority,'not-established');eq(a.descriptor.run,`fp2:${SESSION}:${p.chapter}:${p.index}`);
        eq(a.descriptor.components.map(p=>p.name),['checkpoint','source','binding','context-reference']);ok(Object.isFrozen(r.checkpoint.trace));
        const oracle=C.frame([{name:'checkpoint',encoding:'utf16le',text:Codec.stringify(h.x.checkpoint)},
          {name:'source',encoding:'utf16le',text:h.x.sourceText},{name:'binding',encoding:'utf16le',text:Codec.stringify(h.x.binding)},
          {name:'context-reference',encoding:'utf16le',text:Codec.stringify(h.reference)}]);eq(a.bytes,oracle.bytes);
        eq(h.account.snapshot().reservations['private-phase'],0);ok(h.account.snapshot().peak<=1016832);
        measurements.push({label:p.label,chapter:p.chapter,phase:p.index,bytes:a.bytes.length});
      }finally{JSON.parse=oldParse;Story.restore=oldRestore;}
    }eq(measurements.length,17);
  });
  await group('raw private freeze, negative zero, lone UTF16 units, exact source spelling',async()=>{
    const x=input();x.checkpoint.selected=-0;x.checkpoint.seconds=-0;x.checkpoint.trace[0][2]=-0;x.checkpoint.notice='raw\ud800value';
    x.binding.provenance.units='\udfff';x.binding.provenance.negativeZero=-0;
    const source=JSON.parse(x.sourceText);source.checkpoint=x.checkpoint;x.sourceText='\n '+JSON.stringify(source).replace('raw\\ud800value','raw\ud800value')+' \n';
    const h=await prepare(x),before=Codec.stringify(x.checkpoint);x.checkpoint.trace.length=0;x.checkpoint.seconds=888;x.binding.provenance.units='replaced';
    const r=read(h,make(h));eq(Codec.stringify(r.checkpoint),before);ok(Object.is(r.checkpoint.seconds,-0));ok(Object.is(r.checkpoint.selected,-0));
    ok(Object.is(r.binding.provenance.negativeZero,-0));eq(r.binding.provenance.units,'\udfff');eq(r.sourceText,h.x.sourceText);
  });
  await group('observer mutation cannot replace preflighted source or late-read identity and input references',async()=>{
    for(const replaceReferences of [false,true]){
      const x=input(),original={scope:x.scope,session:x.session,sourceText:x.sourceText,checkpoint:clone(x.checkpoint),binding:clone(x.binding)},
        checkpoint=x.checkpoint,binding=x.binding,oversized=' '.repeat(99998)+'null';
      eq(oversized.length*2,200004);let hookCalls=0,oversizedParses=0,frozen,error;
      const account=B.createPhaseBudget({observe(event){if(event.type!=='allocate'||event.label!=='raw-capsule')return;hookCalls++;
        x.scope='replaced:scope';x.session='f'.repeat(32);x.sourceText=replaceReferences?'null':oversized;
        if(replaceReferences){x.checkpoint={};x.binding={};}
      }});
      account.reserve('raw-capsule',65536);const parse=JSON.parse;
      JSON.parse=function(text,...args){if(text===oversized)oversizedParses++;return parse(text,...args);};
      try{frozen=F.freezeFinalePhase(x,account);}catch(caught){error=caught;}finally{JSON.parse=parse;}
      assert.equal(oversizedParses,0,'observer replacement of 200,004 UTF-16 bytes must never reach JSON.parse');checks++;
      assert.equal(error,undefined,'the originally captured ordinary input remains admissible');checks++;eq(hookCalls,1);
      const raw=F.readFinalePhase(frozen);eq(raw.scope,original.scope);eq(raw.session,original.session);eq(raw.sourceText,original.sourceText);
      eq(raw.run,`fp2:${original.session}:${original.binding.chapter}:${original.binding.phase}`);eq(raw.checkpoint,original.checkpoint);eq(raw.binding,original.binding);
      checkpoint.seconds=999;binding.route='mutated-after-freeze';eq(raw.checkpoint,original.checkpoint);eq(raw.binding,original.binding);
    }
  });
  await group('16,384 full artifact boundary and next-code-unit refusal',async()=>{
    const base=await prepare(),small=make(base),x=input();x.sourceText+=' '.repeat((16384-small.bytes.length)/2);
    const h=await prepare(x),a=make(h);eq(a.bytes.length,16384);eq(read(h,a).sourceText,x.sourceText);
    const overflow=input();overflow.sourceText+=' '.repeat((16384-small.bytes.length)/2+1);
    const over=await prepare(overflow);throws(()=>make(over),/finale-phase-limit/);
  });
  await group('full reference tampering, malformed framing and noncanonical packet data fail closed',async()=>{
    const h=await prepare(),a=make(h);
    const reframe=change=>{const parts=C.unframe(a.bytes,a.descriptor);change(parts);const framed=C.frame(parts);return {bytes:framed.bytes,descriptor:{...a.descriptor,components:framed.components},summary:a.summary};};
    for(const key of ['version','scope','run','binding','throughHead']){
      const bad=reframe(parts=>{const r=JSON.parse(parts[3].text);r[key]=key==='version'?2:key==='binding'?'f'.repeat(64):r[key]+'x';parts[3].text=Codec.stringify(r);});throws(()=>read(h,bad));
    }
    // A structurally valid different root or head checksum is still rejected by
    // exact comparison with the known expected reference, before model admission.
    for(const root of [C.ZERO,'a'.repeat(64)]){
      const d=await C.descriptor(X.describeContext(h.context).descriptor,webcrypto),head=await C.makeHead(d,0,X.describeContext(h.context).total,root,true,webcrypto);
      const r={...h.reference,throughHead:root===C.ZERO?head.token.slice(0,-1)+(head.token.endsWith('0')?'1':'0'):head.token};
      throws(()=>read(h,reframe(parts=>{parts[3].text=Codec.stringify(r);})));
    }
    for(const change of [p=>{p[0].text=' '+p[0].text;},p=>{p[2].text=' '+p[2].text;},p=>{p[3].text=' '+p[3].text;}])throws(()=>read(h,reframe(change)));
    for(const change of [v=>{v.bytes[0]^=1;},v=>{v.bytes[8]=3;},v=>{v.bytes[12]^=1;},v=>{v.descriptor.model='unknown';},
      v=>{v.descriptor.run=`fp2:${SESSION}:9:0`;},v=>{v.descriptor.components[0].encoding='utf8';},v=>{v.summary.seconds++;}]){
      const bad={bytes:new Uint8Array(a.bytes),descriptor:clone(a.descriptor),summary:{...a.summary}};change(bad);throws(()=>read(h,bad));
    }
    for(const patch of [{version:2},{scope:'other'},{run:`fc1:${SESSION}:9`},{binding:'nothex'},{throughHead:'missing'}])throws(()=>F.makeFinalePhase(h.capsule,h.context,{...h.reference,...patch},h.account));
    const d=await C.descriptor(X.describeContext(h.context).descriptor,webcrypto);
    for(const [ordinal,total,sealed]of [[1,X.describeContext(h.context).total,true],[0,1,true],[0,X.describeContext(h.context).total,false]]){
      const head=await C.makeHead(d,ordinal,total,C.ZERO,sealed,webcrypto);throws(()=>F.makeFinalePhase(h.capsule,h.context,{...h.reference,throughHead:head.token},h.account));
    }
  });
  await group('existing full-raw restrictions, source correspondence, finite sums and bounded traversal',async()=>{
    const bads=[x=>{x.checkpoint.complete=false;},x=>{x.checkpoint.version=1;},x=>{x.checkpoint.extra=true;},x=>{x.checkpoint.trace=[];},
      x=>{x.checkpoint.trace=[['mkty-trace',1,1,0,'AAAA']];},x=>{x.checkpoint.trace=[['tick',200001,0,0]];},
      x=>{x.checkpoint.trace=[['tick',1,NaN,0]];},x=>{x.checkpoint.attempt=10001;},x=>{x.binding.phase=2;},x=>{x.binding.seed++;},
      x=>{x.binding.route='legacy';},x=>{x.checkpoint.seconds=999;},x=>{x.sourceText=x.sourceText.replace('"phase":0','"phase":1');},
      x=>{x.sourceText='bad';},x=>{x.binding.provenance.big='x'.repeat(2048);},x=>{x.checkpoint.self=x.checkpoint;},
      x=>{Object.defineProperty(x.checkpoint,'notice',{enumerable:true,get(){throw Error('getter-invoked');}});},
      x=>{Object.defineProperty(x.binding,'seed',{enumerable:true,get(){throw Error('getter-invoked');}});}];
    for(const bad of bads){const x=input();bad(x);let h;try{h=await prepare(x);}catch(error){ok(/finale-phase|trace_/.test(error.message));continue;}throws(()=>make(h));}
    const huge=input();huge.checkpoint.seconds=Number.MAX_VALUE;const source=JSON.parse(huge.sourceText);source.seconds=Number.MAX_VALUE;source.checkpoint=huge.checkpoint;huge.sourceText=JSON.stringify(source);
    const h=await prepare(huge);throws(()=>F.validateFinalePhase(h.capsule,h.context,h.account));
    const summed=story(8);summed.tasks={0:{checkpoint:{seconds:Number.MAX_VALUE}},1:{checkpoint:{seconds:Number.MAX_VALUE}}};
    await assert.rejects(prepare(input(),JSON.stringify(summed)),/finale-context-admission/);checks++;
    const withTask=story(8);withTask.tasks={0:{checkpoint:{seconds:Number.MAX_VALUE}}};
    const x=input(),s=JSON.parse(x.sourceText);s.seconds=Number.MAX_VALUE;x.sourceText=JSON.stringify(s);const final=await prepare(x,JSON.stringify(withTask));throws(()=>make(final));
    const unreserved=B.createPhaseBudget();throws(()=>F.freezeFinalePhase(input(),unreserved));throws(()=>F.freezeFinalePhase(input()));
  });
  const report={test:'evidence-phase-v2',status:'pass',groups:groups.length,checks,groupNames:groups,measurements,
    phaseCap:16384,contextCap:65536,sharedCeiling:1016832,nativeIndexedDB:'not-run',browserOrSocket:'not-used',serverAuthority:false,productionReady:false,
    limitations:['Source-only local format and model admission','No context full parse during phase validation','No SHA pin authority in synchronous helpers: streamers must authenticate and brand pins','Encoded representation slots are not JavaScript heap/RSS']};
  if(process.env.MKTY_PHASE_V2_REPORT)fs.writeFileSync(process.env.MKTY_PHASE_V2_REPORT,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
})().catch(error=>{console.error(error);process.exitCode=1;});
