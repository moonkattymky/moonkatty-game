// SOURCE ONLY: fixed local admission, never server provenance or reward authority.
import * as C from './contract.mjs';
import * as FieldModule from '../../field-model.js';
import * as CodecModule from '../../trace-codec.js';
import * as StoryModule from '../../story-plan.js';
const Field=FieldModule.default||globalThis.FieldRules;
const Codec=CodecModule.default||globalThis.MKTYTraceCodec;
const Story=StoryModule.default||globalThis.StoryPlan;
export const FINALE_LIMIT=Object.freeze({bytes:16384,workspace:327680,canonical:16384,
  jsonBytes:8192,binding:4096,provenance:2048,depth:64,nodes:4096,keys:128,array:4096});
const PARTS=['checkpoint','source','story','binding'],HEADER=[65,82,67,72,73,86,69,49];
const SEQUENCES=Object.freeze({8:Object.freeze([10,3]),9:Object.freeze([9,6,11])});
const BINDING=['version','chapter','edition','phase','mechanic','fieldStage','baseSeed','seed','sourceKey','storyKey','route','provenance'];
const SUMMARY=['version','chapter','edition','phase','mechanic','fieldStage','seed','modelVersion','attempt','seconds','traceRows','completed','authority'];
const fail=()=>C.fail('finale-admission'),limit=()=>C.fail('finale-limit');
const uint=n=>Number.isInteger(n)&&n>=0&&n<=0xffffffff;
const frozen=value=>{if(value&&typeof value==='object'){for(const key of Object.keys(value))frozen(value[key]);Object.freeze(value);}return value;};

// Measure lossless JSON's UTF-16 representation BEFORE recursive serializers.
// Reflection arrays/object headers are NOT bounded-heap accounting: see the doc.
// Accessor-backed ordinary objects are refused without reading their values.
// Proxies may run reflection traps and are outside the ordinary-data contract.
function stringUnits(s){
  let n=2;
  for(let i=0;i<s.length;i++){
    const c=s.charCodeAt(i);
    if(c===34||c===92||[8,9,10,12,13].includes(c))n+=2;
    else if(c<32)n+=6;
    else if(c>=0xd800&&c<=0xdbff&&s.charCodeAt(i+1)>=0xdc00&&s.charCodeAt(i+1)<=0xdfff){n+=2;i++;}
    else n+=c>=0xd800&&c<=0xdfff?6:1;
    if(n*2>FINALE_LIMIT.canonical)limit();
  }
  return n;
}
function measure(values,max=FINALE_LIMIT.canonical){
  let units=0,nodes=0;const seen=new Set();
  const charge=n=>{units+=n;if(units*2>max)limit();};
  function visit(v,depth){
    if(++nodes>FINALE_LIMIT.nodes||depth>FINALE_LIMIT.depth)limit();
    if(v===null){charge(4);return;}
    if(typeof v==='string'){charge(stringUnits(v));return;}
    if(typeof v==='number'){if(!Number.isFinite(v))fail();charge(Object.is(v,-0)?2:String(v).length);return;}
    if(typeof v==='boolean'){charge(v?4:5);return;}
    if(!v||typeof v!=='object'||seen.has(v))fail();
    const array=Array.isArray(v),proto=Object.getPrototypeOf(v);
    if(proto!==(array?Array.prototype:Object.prototype))fail();
    if(array&&v.length>FINALE_LIMIT.array)limit();
    // Stop ordinary enumerable traversal before allocating a key-name list.
    let count=0;
    for(const key in v){
      if(!Object.hasOwn(v,key))fail();
      if(++count>(array?FINALE_LIMIT.array:FINALE_LIMIT.keys))limit();
      const p=Object.getOwnPropertyDescriptor(v,key);
      if(!p||!p.enumerable||!Object.hasOwn(p,'value'))fail();
    }
    const keys=Reflect.ownKeys(v);
    if(keys.length!==count+(array?1:0))fail();
    if(array&&count!==v.length)fail();
    seen.add(v);charge(2);
    let i=0;
    for(const key of keys){
      if(array&&key==='length')continue;
      if(typeof key!=='string'||array&&key!==String(i))fail();
      if(key==='__proto__'||key==='constructor'||key==='prototype'||key==='toJSON')fail();
      if(i++)charge(1);
      if(!array)charge(stringUnits(key)+1);
      const p=Object.getOwnPropertyDescriptor(v,key);
      if(!p||!p.enumerable||!Object.hasOwn(p,'value'))fail();
      // Packed traces can expand far beyond the source-only raw format's cap.
      if(array&&key==='0'&&p.value==='mkty-trace')fail();
      visit(p.value,depth+1);
    }
    seen.delete(v);
  }
  for(const value of values)visit(value,0);
  return units*2;
}
const textBound=s=>{if(typeof s!=='string')fail();if(s.length*2>FINALE_LIMIT.bytes)limit();};
const json=s=>{try{return JSON.parse(s);}catch{fail();}};
const lossless=v=>Codec.stringify(v,FINALE_LIMIT.jsonBytes,'finale-limit');
function bindingShape(b){
  if(!C.exact(b,BINDING)||b.version!==1||![8,9].includes(b.chapter)||b.edition!==2||
    !Number.isInteger(b.phase)||b.phase<0||b.phase>=SEQUENCES[b.chapter].length||
    b.mechanic!==SEQUENCES[b.chapter][b.phase]||b.fieldStage!==4||!uint(b.baseSeed)||
    b.seed!==((b.baseSeed+b.phase*7919)>>>0)||b.sourceKey!==`mkty_field_finale_${b.chapter}_v1`||
    b.storyKey!==`mkty_story_plan_${b.chapter}_v1`||b.route!=='spatial-finale'||
    !b.provenance||Object.getPrototypeOf(b.provenance)!==Object.prototype)fail();
  measure([b.provenance],FINALE_LIMIT.provenance);measure([b],FINALE_LIMIT.binding);
}
function validate(checkpoint,sourceText,storyText,binding){
  textBound(sourceText);textBound(storyText);
  const source=json(sourceText),story=json(storyText);
  // This aggregate bound also catches compact exponent strings that expand when
  // the model uses JSON.stringify. A per-component bound would not be sufficient.
  measure([checkpoint,source,story,binding]);bindingShape(binding);
  const b=binding;
  if(!C.exact(source,['version','n','phase','seed','seconds','checkpoint'])||source.version!==1||
    source.n!==b.chapter||source.phase!==b.phase||source.seed!==b.baseSeed||
    !Number.isFinite(source.seconds)||source.seconds<0)fail();
  if(!story||story.n!==b.chapter||story.edition!==2||story.phase!=='core'||!Story.restore(story))fail();
  if(!checkpoint||Object.getPrototypeOf(checkpoint)!==Object.prototype||checkpoint.version!==2||
    checkpoint.n!==b.mechanic||checkpoint.stage!==4||checkpoint.seed!==b.seed||checkpoint.complete!==true||
    !Array.isArray(checkpoint.trace)||checkpoint.trace.length<1||
    checkpoint.attempt!==undefined&&(!C.int(checkpoint.attempt)||checkpoint.attempt>10000)||
    checkpoint.failures!==undefined&&(!C.int(checkpoint.failures)||checkpoint.failures>10000)||
    checkpoint.impacts!==undefined&&(!C.int(checkpoint.impacts)||checkpoint.impacts>10000))fail();
  // Only the five fixed model schemas, plus the controller's trace/attempt/failures and
  // terminal failed flag. Defaults/layouts are small fixed stage-4 structures.
  const fresh=Field.create(b.mechanic,4,b.seed,checkpoint.mods),allowed=new Set([...Object.keys(fresh),'trace','attempt','failures','failed']);
  // A misaligned gate launch adds impacts lazily; docking has it from create.
  if(b.mechanic===11)allowed.add('impacts');
  if(Object.keys(checkpoint).some(key=>!allowed.has(key)))fail();
  const layout=Field.layout(fresh);
  // Fixed model layouts expose pure function helpers; only their fixed data
  // projection has a JSON representation. Closures are engine-object overhead.
  const layoutData=Object.fromEntries(Object.entries(layout).filter(([,value])=>typeof value!=='function'));
  measure([fresh,layoutData],FINALE_LIMIT.bytes);
  // The real source writer is JSON.stringify: -0 becomes 0 there. Every other
  // finite ordinary value must correspond exactly; no omitted-data equivalence.
  if(JSON.stringify(source.checkpoint)!==JSON.stringify(checkpoint))fail();
  Codec.unpackTrace(checkpoint.trace,{maxBytes:FINALE_LIMIT.jsonBytes});
  const checked=Field.restore(checkpoint,b.mechanic,4,b.seed);
  if(!checked||!checked.complete||!Field.won(checked)||!Field.won(checkpoint))fail();
  return Object.freeze({version:1,chapter:b.chapter,edition:2,phase:b.phase,mechanic:b.mechanic,fieldStage:4,
    seed:b.seed,modelVersion:checkpoint.version,attempt:checkpoint.attempt??0,seconds:checkpoint.seconds,
    traceRows:checkpoint.trace.length,completed:true,authority:'not-established'});
}
export function describeFinaleDescriptor(value){
  if(!C.exact(value,['format','scope','run','kind','model','components','note'])||value.format!==C.FORMAT||
    !C.str(value.scope,128)||!value.scope.length||!C.str(value.run,128)||!value.run.length||
    value.kind!=='finale-phase-completion'||value.model!=='finale-phase-completion-v1'||value.note!=='')fail();
  const p=value.components;
  if(!Array.isArray(p)||Object.getPrototypeOf(p)!==Array.prototype||p.length!==4||Reflect.ownKeys(p).length!==5)fail();
  for(let i=0;i<4;i++){
    const slot=Object.getOwnPropertyDescriptor(p,String(i));
    if(!slot||!Object.hasOwn(slot,'value'))fail();const part=slot.value;
    if(!C.exact(part,['name','encoding','length'])||part.name!==PARTS[i]||part.encoding!=='utf16le'||
      !C.int(part.length)||part.length<2||part.length%2||part.length>FINALE_LIMIT.bytes)fail();
  }
  const d=C.describe(value);if(d.total>FINALE_LIMIT.bytes)limit();return d;
}
function decode(bytes,descriptor){
  C.boundedBytes(bytes,FINALE_LIMIT.bytes);
  const d=describeFinaleDescriptor(descriptor),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(bytes.length!==d.total||HEADER.some((n,i)=>bytes[i]!==n)||view.getUint32(8,true)!==4)fail();
  let offset=12;const texts=[];
  for(const part of d.value.components){
    if(view.getBigUint64(offset,true)!==BigInt(part.length))fail();offset+=8;
    const chars=[];for(let i=0;i<part.length;i+=2)chars.push(String.fromCharCode(view.getUint16(offset+i,true)));
    texts.push(chars.join(''));offset+=part.length;
  }
  if(offset!==bytes.length)fail();return texts;
}
// The gate reserves FINALE_LIMIT.workspace before calling this function. Direct
// helper callers own the same fixed synchronous workspace; no async retention.
export function admitFinaleCompletion(bytes,descriptor,expectedSummary){
  const [checkpointText,sourceText,storyText,bindingText]=decode(bytes,descriptor);
  const checkpoint=json(checkpointText),binding=json(bindingText);
  const summary=validate(checkpoint,sourceText,storyText,binding);
  if(lossless(checkpoint)!==checkpointText||lossless(binding)!==bindingText)fail();
  if(expectedSummary!==undefined&&(!C.exact(expectedSummary,SUMMARY)||SUMMARY.some(k=>!Object.is(expectedSummary[k],summary[k]))))fail();
  return Object.freeze({checkpoint:frozen(checkpoint),sourceText,storyText,binding:frozen(binding),summary});
}
// Caller-owned synchronous builder: <=327680 workspace plus one <=16384 output.
// It does not persist, own a gate realm, or authorize continuation.
export function makeFinaleCompletion(input){
  if(!C.exact(input,['scope','run','checkpoint','sourceText','storyText','binding']))fail();
  const {scope,run,checkpoint,sourceText,storyText,binding}=input;
  if(!C.str(scope,128)||!scope.length||!C.str(run,128)||!run.length)fail();
  const summary=validate(checkpoint,sourceText,storyText,binding);
  const texts=[lossless(checkpoint),sourceText,storyText,lossless(binding)];
  const components=texts.map((text,i)=>({name:PARTS[i],encoding:'utf16le',length:text.length*2}));
  const descriptor={format:C.FORMAT,scope,run,kind:'finale-phase-completion',model:'finale-phase-completion-v1',components,note:''};
  const d=describeFinaleDescriptor(descriptor),bytes=new Uint8Array(d.total),view=new DataView(bytes.buffer);
  bytes.set(HEADER);view.setUint32(8,4,true);let offset=12;
  for(let i=0;i<4;i++){
    view.setBigUint64(offset,BigInt(components[i].length),true);offset+=8;
    for(let j=0;j<texts[i].length;j++)view.setUint16(offset+j*2,texts[i].charCodeAt(j),true);
    offset+=components[i].length;
  }
  return {descriptor,bytes,summary};
}
