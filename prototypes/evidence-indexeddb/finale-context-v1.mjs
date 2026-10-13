// SOURCE ONLY: exact local archive data, never reward or continuation authority.
import * as C from './contract.mjs';
import {validateStoryRewrite} from './story-rewrite.mjs';
import * as StoryModule from '../../story-plan.js';
import * as CodecModule from '../../trace-codec.js';
const Story=StoryModule.default||globalThis.StoryPlan;
const Codec=CodecModule.default||globalThis.MKTYTraceCodec;
export const CONTEXT_LIMIT=Object.freeze({story:65536,canonical:65536,binding:4096,bytes:69660,page:32768,
  restoreAddition:4096,depth:64,nodes:16384,keys:128,array:4096});
const contexts=new WeakMap(),HEADER=[65,82,67,72,73,86,69,49];
const BINDING=['version','session','chapter','edition','baseSeed','storyKey','sourceKey','route'];
const fail=()=>C.fail('finale-context-admission'),limit=()=>C.fail('finale-context-limit');
export function requireFinaleAccount(account){
  if(!account||!['reserve','release','allocate','event','snapshot'].every(k=>typeof account[k]==='function'))C.fail('phase-account-required');
  return account;
}
export function freezeFinaleData(value){
  if(value&&typeof value==='object'){for(const key of Object.keys(value))freezeFinaleData(value[key]);Object.freeze(value);}return value;
}
// Representation measurement only. Context data remains opaque, including packed
// task proof/evidence. This never serializes, unpacks a trace, or calls a model.
export function measureFinaleData(values,max,{packed=true,nodes=CONTEXT_LIMIT.nodes,depth=64,keys=128,array=4096,restrictedKeys=false}={}){
  let units=0,count=0;const seen=new Set();
  const charge=n=>{units+=n;if(units*2>max)limit();};
  function string(s){charge(2);for(let i=0;i<s.length;i++){
    const c=s.charCodeAt(i);
    if(c===34||c===92||c===8||c===9||c===10||c===12||c===13)charge(2);
    else if(c<32)charge(6);
    else if(c>=0xd800&&c<=0xdbff&&s.charCodeAt(i+1)>=0xdc00&&s.charCodeAt(i+1)<=0xdfff){charge(2);i++;}
    else charge(c>=0xd800&&c<=0xdfff?6:1);
  }}
  function visit(v,d){
    if(++count>nodes||d>depth)limit();
    if(v===null){charge(4);return;}
    if(typeof v==='string'){string(v);return;}
    if(typeof v==='number'){if(!Number.isFinite(v))fail();charge(Object.is(v,-0)?2:String(v).length);return;}
    if(typeof v==='boolean'){charge(v?4:5);return;}
    if(!v||typeof v!=='object'||seen.has(v))fail();
    const a=Array.isArray(v);if(Object.getPrototypeOf(v)!==(a?Array.prototype:Object.prototype))fail();
    if(a&&v.length>array)limit();
    let n=0;for(const k in v){if(!Object.hasOwn(v,k))fail();if(++n>(a?array:keys))limit();
      const p=Object.getOwnPropertyDescriptor(v,k);if(!p||!p.enumerable||!Object.hasOwn(p,'value'))fail();}
    const own=Reflect.ownKeys(v);if(own.length!==n+(a?1:0)||a&&n!==v.length)fail();
    seen.add(v);charge(2);let i=0;
    for(const k of own){if(a&&k==='length')continue;
      if(typeof k!=='string'||a&&k!==String(i)||restrictedKeys&&['__proto__','constructor','prototype','toJSON'].includes(k))fail();
      if(i++)charge(1);if(!a){string(k);charge(1);}
      const p=Object.getOwnPropertyDescriptor(v,k);if(!p||!p.enumerable||!Object.hasOwn(p,'value'))fail();
      if(!packed&&a&&k==='0'&&p.value==='mkty-trace')fail();visit(p.value,d+1);
    }seen.delete(v);
  }
  for(const value of values)visit(value,0);return units*2;
}
const uint=x=>Number.isInteger(x)&&x>=0&&x<=0xffffffff;
export const finaleSession=s=>typeof s==='string'&&/^[a-f0-9]{32}$/.test(s);
const scope=s=>C.str(s,128)&&s.length>0;
function bindingShape(b,session){
  measureFinaleData([b],CONTEXT_LIMIT.binding);
  if(!C.exact(b,BINDING)||b.version!==1||b.session!==session||!finaleSession(session)||![8,9].includes(b.chapter)||
    b.edition!==2||!uint(b.baseSeed)||b.storyKey!==`mkty_story_plan_${b.chapter}_v1`||
    b.sourceKey!==`mkty_field_finale_${b.chapter}_v1`||b.route!=='spatial-finale')fail();
}
export function describeFinaleContextDescriptor(value){
  if(!C.exact(value,['format','scope','run','kind','model','components','note'])||value.format!==C.FORMAT||!scope(value.scope)||
    typeof value.run!=='string'||!/^fc1:[a-f0-9]{32}:[89]$/.test(value.run)||value.kind!=='finale-chapter-context'||
    value.model!=='finale-chapter-context-v1'||value.note!=='')fail();
  const p=value.components;if(!Array.isArray(p)||Object.getPrototypeOf(p)!==Array.prototype||p.length!==2||Reflect.ownKeys(p).length!==3)fail();
  for(let i=0;i<2;i++){
    const slot=Object.getOwnPropertyDescriptor(p,String(i)),part=slot&&Object.hasOwn(slot,'value')?slot.value:null;
    if(!C.exact(part,['name','encoding','length'])||part.name!==['story','binding'][i]||part.encoding!=='utf16le'||
      !C.int(part.length)||part.length<2||part.length%2||part.length>(i?CONTEXT_LIMIT.binding:CONTEXT_LIMIT.story))fail();
  }
  const d=C.describe(value);if(d.total>CONTEXT_LIMIT.bytes)limit();return d;
}
function finiteSum(...values){let n=0;for(const value of values){if(typeof value!=='number'||!Number.isFinite(value)||value<0||!Number.isFinite(n+value))fail();n+=value;}return n;}
function preflight(storyText,chapter,account){
  account.reserve('context-parse',CONTEXT_LIMIT.canonical);
  let parsed=null,restored=null,restoreReserved=false;
  try{
    account.allocate('context-parse',CONTEXT_LIMIT.canonical);account.event('context-json-parse',{bytes:storyText.length*2});
    try{parsed=JSON.parse(storyText);}catch{fail();}
    const canonicalBytes=measureFinaleData([parsed],CONTEXT_LIMIT.canonical);
    if(!parsed||parsed.n!==chapter||parsed.edition!==2||parsed.phase!=='core')fail();
    account.allocate('metadata',CONTEXT_LIMIT.restoreAddition);
    account.event('context-restore-additions',{bytes:CONTEXT_LIMIT.restoreAddition,coveredBy:'metadata'});
    account.reserve('context-restore',CONTEXT_LIMIT.story);restoreReserved=true;
    account.allocate('context-restore',CONTEXT_LIMIT.story);account.event('context-story-restore',{canonicalBytes});
    restored=Story.restore(parsed);if(!restored)fail();
    const restoredBytes=measureFinaleData([restored],CONTEXT_LIMIT.story+CONTEXT_LIMIT.restoreAddition);
    if(restoredBytes>canonicalBytes+CONTEXT_LIMIT.restoreAddition)limit();
    if(!Number.isSafeInteger(restored.createdAt)||restored.createdAt<0)fail();
    // Later unchanged original callbacks restore at a fresh Date.now(), add the
    // finite finale seconds, then restore again and change core -> complete.
    // 24 units cover every finite JS number spelling; 16 cover Date.now().
    const postStoryUpperBytes=restoredBytes+8+Math.max(0,24-String(restored.coreSeconds).length)*2+
      Math.max(0,16-String(restored.createdAt).length)*2;
    if(postStoryUpperBytes>CONTEXT_LIMIT.story)limit();
    let taskSeconds=0;
    for(const task of Object.values(restored.tasks))taskSeconds=finiteSum(taskSeconds,task.seconds||0,task.checkpoint?.seconds||task.checkpoint?.run?.time||0);
    finiteSum(restored.coreSeconds,taskSeconds);
    return Object.freeze({canonicalBytes,restoredBytes,postStoryUpperBytes,coreSeconds:restored.coreSeconds,taskSeconds});
  }finally{
    // Drop parsed/restored references before releasing slots or returning to any
    // caller that may reserve the full phase workspace or await native storage.
    parsed=null;restored=null;
    if(restoreReserved)account.release('context-restore',CONTEXT_LIMIT.story);
    account.release('context-parse',CONTEXT_LIMIT.canonical);
  }
}
// Caller reserves context-retained(raw UTF-16 bytes) and the four raw phase slots
// before entry. No whole context output exists; only the admitted original string.
export function admitContext(input,account){
  requireFinaleAccount(account);
  if(!C.exact(input,['scope','session','storyText','binding'])||!scope(input.scope)||typeof input.storyText!=='string')fail();
  // Capture immutable primitives before observer hooks can reenter the caller.
  const {scope:scopeText,session,storyText,binding:inputBinding}=input;
  const storyBytes=storyText.length*2;if(storyBytes<2||storyBytes>CONTEXT_LIMIT.story)limit();
  account.allocate('context-retained',storyBytes);account.allocate('metadata',CONTEXT_LIMIT.binding);
  bindingShape(inputBinding,session);
  const bindingText=Codec.stringify(inputBinding,CONTEXT_LIMIT.binding,'finale-context-limit');
  if(bindingText.length*2>CONTEXT_LIMIT.binding)limit();
  const binding=freezeFinaleData(JSON.parse(bindingText)),admission=preflight(storyText,binding.chapter,account);
  const descriptor=freezeFinaleData({format:C.FORMAT,scope:scopeText,run:`fc1:${session}:${binding.chapter}`,
    kind:'finale-chapter-context',model:'finale-chapter-context-v1',components:[
      {name:'story',encoding:'utf16le',length:storyBytes},{name:'binding',encoding:'utf16le',length:bindingText.length*2}],note:''});
  const total=describeFinaleContextDescriptor(descriptor).total;
  const summary=Object.freeze({...binding,...admission,storyBytes,authority:'not-established'});
  const capsule=Object.freeze(Object.create(null));
  contexts.set(capsule,{storyText,bindingText,description:Object.freeze({descriptor,summary,total})});
  return capsule;
}
function context(capsule){const c=contexts.get(capsule);if(!c)fail();return c;}
export const describeContext=capsule=>context(capsule).description;
export function validateContextRewrite(capsule,options,account){
  const c=context(capsule);return validateStoryRewrite(c.storyText,c.description.summary.chapter,options,account);
}
export const matchesContextText=(capsule,text)=>typeof text==='string'&&context(capsule).storyText===text;
function range(c,offset,length){if(!C.int(offset)||!C.int(length)||length<1||length>CONTEXT_LIMIT.page||offset+length>c.description.total)fail();}
function byteAt(c,offset){
  if(offset<8)return HEADER[offset];if(offset<12)return offset===8?2:0;
  const storyBytes=c.storyText.length*2;
  if(offset<20)return Math.floor(storyBytes/2**((offset-12)*8))&255;
  if(offset<20+storyBytes){const at=offset-20;return c.storyText.charCodeAt(at>>1)>>(at%2*8)&255;}
  const at=offset-20-storyBytes;
  if(at<8)return Math.floor(c.bindingText.length*2/2**(at*8))&255;
  return c.bindingText.charCodeAt((at-8)>>1)>>((at-8)%2*8)&255;
}
// Successful returned chunk transfers its one reservation to the caller, who must
// keep it through unknown append ownership and release it before any readback page.
export function copyContextRange(capsule,offset,length,account){
  requireFinaleAccount(account);const c=context(capsule);range(c,offset,length);
  account.reserve('stream-candidate',length);
  try{account.allocate('stream-candidate',length);const out=new Uint8Array(length);
    for(let i=0;i<length;i++)out[i]=byteAt(c,offset+i);return out;
  }catch(error){account.release('stream-candidate',length);throw error;}
}
export function compareContextRange(capsule,offset,bytes){
  const c=context(capsule);C.boundedBytes(bytes,CONTEXT_LIMIT.page);range(c,offset,bytes.length);
  for(let i=0;i<bytes.length;i++)if(bytes[i]!==byteAt(c,offset+i))return false;return true;
}
