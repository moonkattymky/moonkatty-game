// SOURCE ONLY: fixed raw checkpoint admission against an exact chapter-context pin.
// No owner, completion callback, runtime integration, or reward authority.
import * as C from './contract.mjs';
import * as FieldModule from '../../field-model.js';
import * as CodecModule from '../../trace-codec.js';
import {describeContext,finaleSession,freezeFinaleData,measureFinaleData,requireFinaleAccount} from './finale-context-v1.mjs';
const Field=FieldModule.default||globalThis.FieldRules,Codec=CodecModule.default||globalThis.MKTYTraceCodec;
export const PHASE_LIMIT=Object.freeze({bytes:16384,canonical:16384,workspace:327680,rawCapsule:65536,
  jsonBytes:8192,binding:4096,provenance:2048,reference:4096,depth:64,nodes:4096,keys:128,array:4096});
const capsules=new WeakMap(),PARTS=['checkpoint','source','binding','context-reference'],HEADER=[65,82,67,72,73,86,69,49];
const SEQUENCES=Object.freeze({8:Object.freeze([10,3]),9:Object.freeze([9,6,11])});
const BINDING=['version','chapter','edition','phase','mechanic','fieldStage','baseSeed','seed','sourceKey','storyKey','route','provenance'];
const REFERENCE=['version','scope','run','binding','throughHead'];
const SUMMARY=['version','chapter','edition','phase','mechanic','fieldStage','seed','modelVersion','attempt','seconds','traceRows','completed','authority'];
const fail=()=>C.fail('finale-phase-admission'),limit=()=>C.fail('finale-phase-limit');
const uint=n=>Number.isInteger(n)&&n>=0&&n<=0xffffffff;
const scope=s=>C.str(s,128)&&s.length>0;
const json=text=>{try{return JSON.parse(text);}catch{fail();}};
const lossless=value=>Codec.stringify(value,PHASE_LIMIT.jsonBytes,'finale-phase-limit');
function measure(values,max=PHASE_LIMIT.canonical){
  try{return measureFinaleData(values,max,{packed:false,nodes:PHASE_LIMIT.nodes,restrictedKeys:true});}
  catch(error){if(error.message==='finale-context-limit')limit();if(error.message==='finale-context-admission')fail();throw error;}
}
function textBound(text){if(typeof text!=='string')fail();if(text.length*2>PHASE_LIMIT.bytes)limit();}
function bindingShape(b){
  measure([b],PHASE_LIMIT.binding);
  if(!C.exact(b,BINDING)||b.version!==1||![8,9].includes(b.chapter)||b.edition!==2||
    !Number.isInteger(b.phase)||b.phase<0||b.phase>=SEQUENCES[b.chapter].length||b.mechanic!==SEQUENCES[b.chapter][b.phase]||
    b.fieldStage!==4||!uint(b.baseSeed)||b.seed!==((b.baseSeed+b.phase*7919)>>>0)||
    b.sourceKey!==`mkty_field_finale_${b.chapter}_v1`||b.storyKey!==`mkty_story_plan_${b.chapter}_v1`||b.route!=='spatial-finale'||
    !b.provenance||Object.getPrototypeOf(b.provenance)!==Object.prototype)fail();
  measure([b.provenance],PHASE_LIMIT.provenance);
}
function sourceShape(source,b,checkpoint){
  if(!C.exact(source,['version','n','phase','seed','seconds','checkpoint'])||source.version!==1||source.n!==b.chapter||
    source.phase!==b.phase||source.seed!==b.baseSeed||!Number.isFinite(source.seconds)||source.seconds<0)fail();
  if(!checkpoint||Object.getPrototypeOf(checkpoint)!==Object.prototype||checkpoint.version!==2||checkpoint.n!==b.mechanic||
    checkpoint.stage!==4||checkpoint.seed!==b.seed||checkpoint.complete!==true||!Array.isArray(checkpoint.trace)||checkpoint.trace.length<1||
    checkpoint.attempt!==undefined&&(!C.int(checkpoint.attempt)||checkpoint.attempt>10000)||
    checkpoint.failures!==undefined&&(!C.int(checkpoint.failures)||checkpoint.failures>10000)||
    checkpoint.impacts!==undefined&&(!C.int(checkpoint.impacts)||checkpoint.impacts>10000))fail();
}
function capsule(value){const data=capsules.get(value);if(!data)fail();return data;}
// Caller owns four explicit 16KiB raw slots. This synchronous private freeze is
// deliberately separate from full model admission; no context or packet is copied.
export function freezeFinalePhase(input,account){
  requireFinaleAccount(account);
  if(!C.exact(input,['scope','session','checkpoint','sourceText','binding']))fail();
  // Capture every primitive and input reference before an observer can reenter
  // and replace a previously bounded field. Never reread the caller wrapper.
  const {scope:scopeText,session,checkpoint,sourceText,binding}=input;
  if(!scope(scopeText)||!finaleSession(session))fail();
  textBound(sourceText);account.allocate('raw-capsule',PHASE_LIMIT.rawCapsule);
  measure([checkpoint,binding]);bindingShape(binding);
  let source=json(sourceText);measure([checkpoint,source,binding]);sourceShape(source,binding,checkpoint);
  // Raw whitespace also consumes the input representation slot, independently of
  // canonical expansion. There is deliberately no preliminary framed packet.
  if(measure([checkpoint,binding])+sourceText.length*2>PHASE_LIMIT.bytes)limit();
  source=null;
  const privateCheckpoint=freezeFinaleData(json(lossless(checkpoint)));
  const privateBinding=freezeFinaleData(json(lossless(binding)));
  const data=Object.freeze({scope:scopeText,session,run:`fp2:${session}:${binding.chapter}:${binding.phase}`,
    checkpoint:privateCheckpoint,sourceText,binding:privateBinding});
  const out=Object.freeze(Object.create(null));capsules.set(out,data);return out;
}
// Exposes only references to already charged, frozen small phase inputs. There is
// no context text/graph, no full packet allocation, and no authority in this view.
export const readFinalePhase=value=>capsule(value);
function contextMatches(data,context){
  const d=describeContext(context),b=data.binding,s=d.summary;
  if(data.scope!==d.descriptor.scope||data.session!==s.session||b.chapter!==s.chapter||b.edition!==s.edition||
    b.baseSeed!==s.baseSeed||b.sourceKey!==s.sourceKey||b.storyKey!==s.storyKey||b.route!==s.route)fail();return d;
}
function finite(...values){let n=0;for(const value of values){if(typeof value!=='number'||!Number.isFinite(value)||value<0||!Number.isFinite(n+value))fail();n+=value;}return n;}
function validate(data,context,reference=undefined){
  const {checkpoint,sourceText,binding:b}=data,contextInfo=contextMatches(data,context);
  textBound(sourceText);const source=json(sourceText);
  measure(reference===undefined?[checkpoint,source,b]:[checkpoint,source,b,reference]);bindingShape(b);sourceShape(source,b,checkpoint);
  const fresh=Field.create(b.mechanic,4,b.seed,checkpoint.mods),allowed=new Set([...Object.keys(fresh),'trace','attempt','failures','failed']);
  if(b.mechanic===11)allowed.add('impacts');if(Object.keys(checkpoint).some(key=>!allowed.has(key)))fail();
  const layout=Field.layout(fresh),layoutData=Object.fromEntries(Object.entries(layout).filter(([,value])=>typeof value!=='function'));
  measure([fresh,layoutData]);
  // Preserve the old source-writer equivalence: -0 is 0 only in JSON.stringify's
  // stored source. The raw callback is serialized losslessly and remains distinct.
  if(JSON.stringify(source.checkpoint)!==JSON.stringify(checkpoint))fail();
  Codec.unpackTrace(checkpoint.trace,{maxBytes:PHASE_LIMIT.jsonBytes});
  const checked=Field.restore(checkpoint,b.mechanic,4,b.seed);
  if(!checked||!checked.complete||!Field.won(checked)||!Field.won(checkpoint))fail();
  const finalSeconds=finite(source.seconds,checked.seconds),s=contextInfo.summary;
  finite(s.coreSeconds,finalSeconds);finite(s.coreSeconds,finalSeconds,s.taskSeconds);
  return Object.freeze({version:2,chapter:b.chapter,edition:2,phase:b.phase,mechanic:b.mechanic,fieldStage:4,
    seed:b.seed,modelVersion:checkpoint.version,attempt:checkpoint.attempt??0,seconds:checkpoint.seconds,
    traceRows:checkpoint.trace.length,completed:true,authority:'not-established'});
}
export function validateFinalePhase(value,context,account){
  requireFinaleAccount(account);account.allocate('phase-workspace',PHASE_LIMIT.workspace);return validate(capsule(value),context);
}
// SHA-256 descriptor/head authentication belongs to the async streamer. This
// synchronous fixed-format check is necessary but is not authentication. Readback
// additionally requires byte equality and exact equality with that verified pin.
function referenceShape(reference,context,account){
  account.allocate('metadata',PHASE_LIMIT.reference);measure([reference],PHASE_LIMIT.reference);
  const info=describeContext(context);
  if(!C.exact(reference,REFERENCE)||reference.version!==1||reference.scope!==info.descriptor.scope||
    reference.run!==info.descriptor.run||!C.hex(reference.binding)||!C.str(reference.throughHead,2048))fail();
  const parts=reference.throughHead.split('.');if(parts.length!==3||parts[0]!=='h'||!C.hex(parts[2]))fail();
  let h;try{h=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(C.unbase64url(parts[1])));}catch{fail();}
  if(!Array.isArray(h)||h.length!==5||h[0]!==reference.binding||!h.slice(1,3).every(v=>typeof v==='string'&&/^[a-f0-9]{14}$/.test(v))||
    !C.hex(h[3])||h[4]!==1||parseInt(h[1],16)!==Math.ceil(info.total/32768)-1||parseInt(h[2],16)!==info.total)fail();
}
export function describeFinalePhaseDescriptor(value){
  if(!C.exact(value,['format','scope','run','kind','model','components','note'])||value.format!==C.FORMAT||!scope(value.scope)||
    typeof value.run!=='string'||!/^fp2:[a-f0-9]{32}:(?:8:[01]|9:[012])$/.test(value.run)||value.kind!=='finale-phase-completion'||
    value.model!=='finale-phase-completion-v2'||value.note!=='')fail();
  const p=value.components;if(!Array.isArray(p)||Object.getPrototypeOf(p)!==Array.prototype||p.length!==4||Reflect.ownKeys(p).length!==5)fail();
  for(let i=0;i<4;i++){
    const slot=Object.getOwnPropertyDescriptor(p,String(i)),part=slot&&Object.hasOwn(slot,'value')?slot.value:null;
    if(!C.exact(part,['name','encoding','length'])||part.name!==PARTS[i]||part.encoding!=='utf16le'||!C.int(part.length)||
      part.length<2||part.length%2||part.length>PHASE_LIMIT.bytes||i>=2&&part.length>PHASE_LIMIT.binding)fail();
  }
  const d=C.describe(value);if(d.total>PHASE_LIMIT.bytes)limit();return d;
}
export function makeFinalePhase(value,context,reference,account){
  requireFinaleAccount(account);account.allocate('phase-workspace',PHASE_LIMIT.workspace);
  const data=capsule(value);referenceShape(reference,context,account);const summary=validate(data,context,reference);
  const texts=[lossless(data.checkpoint),data.sourceText,lossless(data.binding),lossless(reference)];
  const components=texts.map((text,i)=>({name:PARTS[i],encoding:'utf16le',length:text.length*2}));
  const descriptor=freezeFinaleData({format:C.FORMAT,scope:data.scope,run:data.run,kind:'finale-phase-completion',
    model:'finale-phase-completion-v2',components,note:''});
  const d=describeFinalePhaseDescriptor(descriptor);
  // Public caller output is an existing workspace slot. The streamer must make
  // its own reserve-before-copy private-phase snapshot before the first await.
  account.allocate('phase-workspace',d.total);const bytes=new Uint8Array(d.total),view=new DataView(bytes.buffer);
  bytes.set(HEADER);view.setUint32(8,4,true);let offset=12;
  for(let i=0;i<4;i++){view.setBigUint64(offset,BigInt(components[i].length),true);offset+=8;
    for(let j=0;j<texts[i].length;j++)view.setUint16(offset+j*2,texts[i].charCodeAt(j),true);offset+=components[i].length;}
  return {descriptor,bytes,summary};
}
function decode(bytes,descriptor){
  C.boundedBytes(bytes,PHASE_LIMIT.bytes);const d=describeFinalePhaseDescriptor(descriptor);
  if(bytes.length!==d.total||HEADER.some((v,i)=>bytes[i]!==v))fail();
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);if(view.getUint32(8,true)!==4)fail();
  let offset=12;const texts=[];
  for(const part of d.value.components){if(view.getBigUint64(offset,true)!==BigInt(part.length))fail();offset+=8;
    const chars=[];for(let i=0;i<part.length;i+=2)chars.push(String.fromCharCode(view.getUint16(offset+i,true)));
    texts.push(chars.join(''));offset+=part.length;}
  if(offset!==bytes.length)fail();return texts;
}
export function admitFinalePhase(bytes,descriptor,context,expectedReference,expectedSummary,account){
  requireFinaleAccount(account);account.allocate('phase-workspace',PHASE_LIMIT.workspace);referenceShape(expectedReference,context,account);
  const [checkpointText,sourceText,bindingText,referenceText]=decode(bytes,descriptor);
  const checkpoint=json(checkpointText),binding=json(bindingText),reference=json(referenceText);
  referenceShape(reference,context,account);
  if(REFERENCE.some(key=>reference[key]!==expectedReference[key]))fail();
  const s=describeContext(context).summary;
  const data={scope:descriptor.scope,session:s.session,run:descriptor.run,checkpoint,sourceText,binding};
  if(descriptor.run!==`fp2:${s.session}:${binding.chapter}:${binding.phase}`)fail();
  const summary=validate(data,context,reference);
  if(lossless(checkpoint)!==checkpointText||lossless(binding)!==bindingText||lossless(reference)!==referenceText)fail();
  if(expectedSummary!==undefined&&(!C.exact(expectedSummary,SUMMARY)||SUMMARY.some(k=>!Object.is(expectedSummary[k],summary[k]))))fail();
  return Object.freeze({checkpoint:freezeFinaleData(checkpoint),sourceText,binding:freezeFinaleData(binding),reference:freezeFinaleData(reference),summary});
}
