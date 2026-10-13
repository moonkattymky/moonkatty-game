'use strict';
// SOURCE ONLY. Unchanged legacy.precise parity and bounded read-observer tests.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const F=require('./evidence-finale-controller-fixture.cjs'),Field=require('../field-model.js'),Story=require('../story-plan.js'),Codec=require('../trace-codec.js');
const source=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const original=source('legacy.js').split('\n').find(line=>/^ function precise\(\)/.test(line));assert(original);
const precise=new Function('localStorage',`${original};return precise();`);
let checks=0;const groups=[],measurements=[];
const eq=(a,b)=>{assert.deepStrictEqual(a,b);checks++;},ok=value=>{assert(value);checks++;};
const bad=(fn,re=/precision-|finale-context-/)=>{assert.throws(fn,re);checks++;};
const key=n=>`mkty_story_plan_${n}_v1`;
function plans(count,total=count){const out={};for(let n=1;n<=8;n++){
  const p=F.plan(n);for(let i=0;i<8&&total>0;i++,total--){p.tasks[i]={performance:{precise:count>0}};if(count>0)count--;}
  out[key(n)]=JSON.stringify(p);
}return out;}
function realLongContext(){
 const full=F.plan(8);for(const task of Story.plan(8,2).steps)full.tasks[task.id]={kind:task.kind,attempt:0,seconds:3,hints:0,errors:0};
 const proof=Field.create(8,0,Story.seedFor(full,0));proof.trace=[];
 const act=(action,value)=>{proof.trace.push(['act',action,value??null]);Field.act(proof,action,value);};
 const layout=Field.layout(proof);for(let i=0;i<3;i++){act('station',i);act('angle',Math.round(layout.bearings[i]));act('sample');}act('pin',layout.source);act('locate');
 full.tasks[0]={...full.tasks[0],proof,performance:Field.performance(proof)};proof.trace=[...Array.from({length:900},()=>['act','station',0]),...proof.trace];
 const replay=Field.create(8,0,proof.seed);for(const row of proof.trace)Field.act(replay,row[1],row[2]);ok(replay.complete&&Field.won(replay));ok(Field.restore(proof,8,0,proof.seed));
 const text=JSON.stringify(full);eq(proof.trace.length,911);eq(text.length*2,38628);eq(full.tasks[0].performance.precise,true);return text;
}
(async()=>{
 const {observePrecision}=await import('../prototypes/evidence-indexeddb/precision-observation.mjs');
 const {createPhaseBudget}=await import('../prototypes/evidence-indexeddb/phase-budget.mjs');
 const held=['raw-capsule','context-retained','post-target','callback-scratch','callback-outer-story','callback-inner-story'];
 function setup(values,{read,observe,current}={}){
  const events=[],reads=[],budget=createPhaseBudget({observe(e){events.push(e);observe?.(e);}});
  for(const label of held)budget.reserve(label,65536);budget.reserve('original-read-workspace',196608);
  const invoke=()=>observePrecision({budget,current:current||(()=>true),readItem(k){reads.push(k);return read?read(k,reads.length):values[k]??null;}});
  function clean(){eq(budget.snapshot().reservations['original-read-workspace'],196608);
    for(const label of ['post-work-1','post-work-2','post-stringify','context-parse','context-restore','native-read'])eq(budget.snapshot().reservations[label],0);
    eq(budget.snapshot().ceiling,1016832);eq(budget.snapshot().peak,1015808);
    budget.release('original-read-workspace',196608);for(const label of held)budget.release(label,65536);eq(budget.snapshot().live,425984);}
  return {invoke,budget,events,reads,clean};
 }
 for(const count of [0,1,9,10,64])for(const total of new Set([count,64])){
   const values=plans(count,total),expected=precise({getItem:k=>values[k]??null}),t=setup(values),result=t.invoke();
   eq(result,expected);eq(result,{count,total});ok(Object.isFrozen(result));eq(Object.keys(result),['count','total']);
   eq(t.reads,Array.from({length:8},(_,i)=>key(i+1)));eq(t.events.filter(e=>e.type==='allocate'&&e.label==='original-read-workspace').length,8);t.clean();
 }
 {const values={};for(let n=1;n<=8;n++)values[key(n)]=JSON.stringify({tasks:Object.fromEntries(
     [{precise:true},{precise:1},true,1,'yes',[],null,false].map((performance,i)=>[i,{performance}]))});
   const t=setup(values);eq(t.invoke(),precise({getItem:k=>values[k]}));eq(t.invoke(),{count:8,total:48});t.clean();}
 {const t=setup({});eq(t.invoke(),{count:0,total:0});t.clean();}
 groups.push('exact unchanged legacy.precise parity for 0,1,9,10,64, mixed precision and truthy performance semantics');
 {const values=plans(0),raw=realLongContext();values[key(8)]=raw;const before={...values},t=setup(values);
   const restore=Story.restore,unpack=Codec.unpackTrace,stringify=JSON.stringify;
   let result;try{Story.restore=Codec.unpackTrace=JSON.stringify=()=>{throw Error('forbidden-rewrite-or-unpack');};result=t.invoke();}
   finally{Story.restore=restore;Codec.unpackTrace=unpack;JSON.stringify=stringify;}
   eq(result,{count:1,total:1});eq(values,before);eq(values[key(8)],raw);measurements.push({name:'unchanged-real-911-row-plan',bytes:raw.length*2,count:result.count,total:result.total,peak:t.budget.snapshot().peak});t.clean();}
 {const values=plans(1),p=JSON.parse(values[key(1)]);p.tasks[0].proof={trace:['mkty-trace','unknown-version',{opaque:true}]};
   values[key(1)]=JSON.stringify(p);const t=setup(values);eq(t.invoke(),{count:1,total:1});t.clean();}
 groups.push('unchanged real 911-row precise plan and opaque packed payloads observed without restore, stringify or unpack');
 {const values=plans(1),raw=values[key(1)];values[key(1)]=raw+' '.repeat(32768-raw.length);const t=setup(values);eq(t.invoke(),{count:1,total:1});t.clean();}
 for(const badValue of [' '.repeat(32769),'not json','',undefined,19,JSON.stringify({tasks:Array(1).fill({performance:{precise:true}})}),
   JSON.stringify({tasks:Object.fromEntries(Array.from({length:9},(_,i)=>[i,{performance:{precise:true}}]))})]){
   const values=plans(0),t=setup(values,{read:k=>k===key(1)?badValue:values[k]});bad(t.invoke);eq(t.reads,[key(1)]);t.clean();
 }
 {let base='{"tasks":{},"values":['+Array(4096).fill('1e99').join(',')+'],"padding":"';const text=base+'x'.repeat(32768-base.length-2)+'"}';
   eq(text.length*2,65536);const t=setup({[key(1)]:text});bad(t.invoke,/finale-context-limit/);t.clean();}
 {let nested=null;for(let i=0;i<66;i++)nested={value:nested};const t=setup({[key(1)]:JSON.stringify({tasks:{},opaque:nested})});bad(t.invoke,/finale-context-limit/);t.clean();}
 groups.push('raw UTF16, canonical expansion, task count/shape, parse and nesting caps refuse without trimming');
 {const t=setup(plans(1),{current:()=>false});bad(t.invoke,/precision-stale/);eq(t.reads,[]);t.clean();}
 for(const at of [1,4,8]){let current=true;const values=plans(64),t=setup(values,{current:()=>current,read(k,n){if(n===at)current=false;return values[k];}});
   bad(t.invoke,/precision-stale/);eq(t.reads.length,at);t.clean();}
 {const values=plans(1),t=setup(values,{read(){throw Error('native precision read failed');}});bad(t.invoke,/native precision read failed/);eq(t.reads.length,1);t.clean();}
 for(const kind of ['invalidate','throw']){let active=false,current=true;const t=setup(plans(1),{current:()=>current,observe(e){
     if(active&&e.label==='original-read-workspace'&&e.type==='allocate'){active=false;if(kind==='invalidate')current=false;else throw Error('precision-observer-failed');}}});
   active=true;bad(t.invoke,/precision-stale|precision-observer-failed/);ok(t.reads.length<=1);t.clean();}
 {const budget=createPhaseBudget();bad(()=>observePrecision({budget,readItem:()=>null,current:()=>true}),/precision-workspace/);
   budget.reserve('original-read-workspace',65536);bad(()=>observePrecision({budget,readItem:()=>null,current:()=>true}),/precision-workspace/);budget.release('original-read-workspace',65536);}
 groups.push('stale reads, observer/native failures and absent/partial workspace fail closed with caller-owned slot cleanup');
 console.log(JSON.stringify({status:'passed',checks,groups,measurements,qualification:'Source-only bounded observation and unchanged-source parity; synthetic fixture inputs. Precision is not proof of past or native play; no browser, archive, reward or runtime authority.'},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
