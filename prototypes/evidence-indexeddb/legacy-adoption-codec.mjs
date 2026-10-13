// SOURCE ONLY. Lossless, bounded guest-fixture admission; never reward authority.
// Native getItem materialization, JS heap/GC and unrelated realms are not bounded.
import * as C from './contract.mjs';
import {requirePhaseBudget} from './phase-budget.mjs';

export const LEGACY_KEYS=Object.freeze(['mkty_story_plan_9_v1','mkty_field_finale_9_v1',
  'mkty_operations_9_v1','mkty_points','mkty_daily_demo','mkty_life9','mkty_life9_awarded',
  'mkty_life9_completed_at','mkty_final_moon_points','mkty_points_locked_at',
  'mkty_spatial_report_9','mkty_current_chapter']);
export const LEGACY_CLOUD_KEYS=Object.freeze(['mkty_cloud_dirty','mkty_cloud_revision',
  'mkty_cloud_restore_pending','mkty_cloud_restore_transaction','mkty_cloud_restore_retry_guard',
  'mkty_cloud_restore_outgoing','mkty_cloud_recovery']);
export const LEGACY_LIMIT=Object.freeze({bundle:65536,framing:622,envelope:16384,initial:7680,
  checkpoint:8192,nextFrame:8212,page:32768,depth:64,nodes:4096,bridge:32768,
  controller:32768,candidate:32768,workspace:327680,parse:393216});
const GUARDS=['version','origin','principal','epoch','identity','initData','durable','exclusive',
  'sourceClosed','overlay','legacyOwnerRaw','cloudRaw','unattributedPendingPresent'];
const J=['callback-scratch','callback-outer-story','callback-inner-story','context-restore','post-target','post-work-1'];
const COLD_W=J.filter(x=>x!=='post-target');
const capData=new WeakMap(),plain=x=>!!x&&Object.getPrototypeOf(x)===Object.prototype;
const fail=reason=>C.fail('legacy-'+reason),safe=n=>Number.isSafeInteger(n)&&n>=0;
const uint=n=>Number.isInteger(n)&&n>=0&&n<=0xffffffff;

export function validateLegacyGuards(g){
  if(!C.exact(g,GUARDS)||g.version!==1||g.origin!=='closed-original-field-guest-fixture'||
    typeof g.principal!=='string'||!/^guest:[A-Za-z0-9_-]{1,64}$/.test(g.principal)||
    !safe(g.epoch)||g.epoch<1||g.identity!=='guest'||g.initData!==''||g.durable!==true||
    g.exclusive!==true||g.sourceClosed!==true||g.overlay!==false||g.legacyOwnerRaw!==null||
    g.unattributedPendingPresent!==false||!C.exact(g.cloudRaw,LEGACY_CLOUD_KEYS)||
    LEGACY_CLOUD_KEYS.some(k=>g.cloudRaw[k]!==null))fail('guard');
  return Object.freeze({principal:g.principal,epoch:g.epoch});
}
function model(r){if(!r||typeof r.restore!=='function'||typeof r.act!=='function')fail('model');
  return Object.freeze({restore:r.restore,act:r.act});}
function sameModel(a,b){const r=model(b);if(a.restore!==r.restore||a.act!==r.act)fail('model');return a;}

// All reservations include the separately charged bridge G BEFORE mutating the
// frozen budget. Delta rollback also handles an observer throwing after reserve.
function lease(b,label,n){
  requirePhaseBudget(b);const before=b.snapshot().reservations[label];
  if(!safe(before)||b.snapshot().live+n+LEGACY_LIMIT.bridge>b.snapshot().ceiling)fail('joint-budget');
  try{b.reserve(label,n);b.allocate(label,n);}catch(e){
    const delta=b.snapshot().reservations[label]-before;if(delta>0){try{b.release(label,delta);}catch{}}throw e;}
  let live=true;return()=>{if(live){live=false;b.release(label,n);}};
}
function absent(b,labels){const h=b.snapshot().reservations;if(labels.some(k=>h[k]))fail('budget-lifetime');}
function work(b,labels,fn){const releases=[];let value,error,failed=false;
  try{for(const [k,n]of labels)releases.push(lease(b,k,n));value=fn();}catch(e){failed=true;error=e;}
  finally{for(const release of releases.reverse()){try{release();}catch(e){if(!failed){failed=true;error=e;}}}}
  if(failed)throw error;return value;}
const BUSY=['phase-workspace','atomic-record-workspace','native-read','helper-framing','helper-hash',
  'stream-candidate','returned-page','reload-chunk','reload-decode','reload-story-work','private-phase'];
function parseWork(b,fn){absent(b,[...BUSY,'reload-phase-retained',...J]);
  return work(b,J.map(k=>[k,65536]),fn);}
function modelWork(b,fn){absent(b,BUSY.filter(x=>x!=='native-read'));
  if(b.snapshot().reservations['context-parse']){
    absent(b,['reload-phase-retained','native-read',...COLD_W]);
    return work(b,COLD_W.map(k=>[k,65536]),fn);
  }
  return work(b,[['phase-workspace',LEGACY_LIMIT.workspace]],fn);
}
function read(cap,kind){const d=capData.get(cap);if(!d||!d.live||kind&&d.kind!==kind)fail('capability');return d;}
export function assertLegacyBudget(cap,budget){if(read(cap).budget!==budget)fail('budget-capability');return budget;}
function capability(d){const cap=Object.freeze({});capData.set(cap,{...d,live:true});return cap;}
export function disposeLegacy(cap){const d=capData.get(cap);if(!d||!d.live)return;
  const release=d.release;d.live=false;d.release=null;d.raw=null;d.pieces=null;d.text=null;d.expected=null;d.source=null;d.next=null;
  release?.();}
export const legacyInfo=cap=>read(cap,'source').info;
export const nextInfo=cap=>read(cap,'next').info;
export function rawValue(cap,key){if(!LEGACY_KEYS.includes(key))fail('key');return read(cap,'source').raw[key];}

function keys(value){
  const array=Array.isArray(value);if(array?Object.getPrototypeOf(value)!==Array.prototype:!plain(value))fail('json-shape');
  const all=Reflect.ownKeys(value),out=all.filter(k=>!(array&&k==='length'));
  if(array&&out.length!==value.length||out.some((k,i)=>typeof k!=='string'||array&&k!==String(i)))fail('json-shape');
  for(const k of out){const d=Object.getOwnPropertyDescriptor(value,k);if(!d?.enumerable||!Object.hasOwn(d,'value'))fail('json-shape');}
  return out;
}
function stringUnits(s){let n=2;for(let i=0;i<s.length;i++){
  const c=s.charCodeAt(i);if(c===34||c===92||[8,9,10,12,13].includes(c))n+=2;
  else if(c<32)n+=6;
  else if(c>=0xd800&&c<=0xdbff){if(i+1<s.length&&s.charCodeAt(i+1)>=0xdc00&&s.charCodeAt(i+1)<=0xdfff){n+=2;i++;}else n+=6;}
  else n+=c>=0xdc00&&c<=0xdfff?6:1;
  }return n;}
function measure(value,max){let nodes=0;
  function visit(v,depth){if(++nodes>LEGACY_LIMIT.nodes||depth>LEGACY_LIMIT.depth)fail('json-limit');
    let n;if(v===null)n=4;else if(typeof v==='string')n=stringUnits(v);
    else if(typeof v==='boolean')n=v?4:5;
    else if(typeof v==='number'){if(!Number.isFinite(v))fail('json-shape');n=String(v).length;}
    else if(typeof v==='object'){
      const list=keys(v),array=Array.isArray(v);n=2+Math.max(0,list.length-1);
      for(const k of list){n+=(array?0:stringUnits(k)+1)+visit(v[k],depth+1);if(n*2>max)fail('json-limit');}
    }else fail('json-shape');if(n*2>max)fail('json-limit');return n;
  }return visit(value,0)*2;
}
export function sameLegacyValue(a,b){let nodes=0;
  function equal(x,y,depth){if(++nodes>LEGACY_LIMIT.nodes||depth>LEGACY_LIMIT.depth)return false;
    if(x===null||y===null||typeof x!=='object'||typeof y!=='object')return Object.is(x,y);
    if(Array.isArray(x)!==Array.isArray(y))return false;
    const xk=keys(x),yk=keys(y);return xk.length===yk.length&&xk.every(k=>Object.hasOwn(y,k)&&equal(x[k],y[k],depth+1));
  }try{return equal(a,b,0);}catch{return false;}
}
function freeze(v){if(v&&typeof v==='object'){for(const k of keys(v))freeze(v[k]);Object.freeze(v);}return v;}
function json(text,max){if(typeof text!=='string')fail('required');let value;
  try{value=JSON.parse(text);}catch{fail('json-invalid');}measure(value,max);return value;}
function rawSize(raw){if(!C.exact(raw,LEGACY_KEYS))fail('raw-shape');let n=LEGACY_LIMIT.framing;
  for(const k of LEGACY_KEYS){const v=raw[k];if(v!==null&&typeof v!=='string')fail('raw-value');if(v!==null)n+=v.length*2;if(n>LEGACY_LIMIT.bundle)fail('bundle-limit');}return n;}
function validateStory(text){const s=json(text,LEGACY_LIMIT.parse);
  if(!plain(s)||s.version!==1||s.n!==9||s.edition!==2||s.phase!=='core'||!uint(s.seed)||
    !Array.isArray(s.done)||s.done.length!==8||new Set(s.done).size!==8||s.done.some(n=>!Number.isInteger(n)||n<0||n>7))fail('story');
}
function validateOperations(text){if(text===null)return;const s=json(text,LEGACY_LIMIT.parse);
  if(!plain(s)||s.version!==1||s.n!==9||!uint(s.seed)||s.round!==3||s.phase!=='core'||
    typeof s.confirmed!=='boolean'||['actions','hints','errors','seconds'].some(k=>!Number.isFinite(s[k])||s[k]<0||s[k]>1e8))fail('operations');
}
function restore(cp,seed,r,initial){
  const bytes=measure(cp,initial?LEGACY_LIMIT.initial:LEGACY_LIMIT.checkpoint);
  if(!plain(cp)||cp.version!==2||cp.n!==11||cp.stage!==4||cp.seed!==seed||cp.complete!==false||
    Object.hasOwn(cp,'failed')&&cp.failed!==false||!Array.isArray(cp.trace)||
    !safe(cp.moves)||initial&&cp.moves===Number.MAX_SAFE_INTEGER||!safe(cp.errors)||
    !Number.isInteger(cp.home)||cp.home<0||cp.home>=3||!Number.isInteger(cp.turn)||cp.turn<0||
    cp.turn>(initial?999:1000)||!Number.isFinite(cp.stability)||cp.stability<=(initial?5:0))fail('checkpoint');
  let restored;try{restored=r.restore(cp,11,4,seed);}catch{fail('restore');}
  if(!restored||!sameLegacyValue(cp,restored))fail('fixed-point');return {value:restored,bytes};
}
function envelope(text,r){if(typeof text!=='string'||text.length*2>LEGACY_LIMIT.envelope)fail('envelope-limit');
  const s=json(text,LEGACY_LIMIT.envelope);
  if(!plain(s)||s.version!==1||s.n!==9||s.phase!==2||!uint(s.seed)||!Number.isFinite(s.seconds)||s.seconds<0)fail('envelope');
  const seed=(s.seed+2*7919)>>>0,cp=restore(s.checkpoint,seed,r,true);return {baseSeed:s.seed,seed,checkpoint:cp.value,bytes:cp.bytes};}
function waitOracle(cp,seed,r){cp.trace.push(['act','wait',0]);
  if(r.act(cp,'wait',0)!==true)fail('wait');const checked=restore(cp,seed,r,false);
  return checked;
}
function sourceSemantics(raw,r){validateStory(raw[LEGACY_KEYS[0]]);validateOperations(raw[LEGACY_KEYS[2]]);
  // Each large parse above has returned without retaining its graph.
  const s=envelope(raw[LEGACY_KEYS[1]],r),initialBytes=s.bytes;
  waitOracle(s.checkpoint,s.seed,r);return {baseSeed:s.baseSeed,seed:s.seed,checkpointBytes:initialBytes};
}

function header(length){const a=new Uint8Array(20),v=new DataView(a.buffer);
  for(let i=0;i<8;i++)a[i]='ARCHIVE1'.charCodeAt(i);v.setUint32(8,1,true);v.setUint32(12,length-20,true);return a;}
function sourcePieces(raw,total){const pieces=[header(total)],h=new Uint8Array(12),v=new DataView(h.buffer);
  for(let i=0;i<8;i++)h[i]='LGCYRAW1'.charCodeAt(i);v.setUint32(8,12,true);pieces.push(h);
  LEGACY_KEYS.forEach((k,i)=>{const s=raw[k],h=new Uint8Array(12),v=new DataView(h.buffer);
    v.setUint16(0,i,true);v.setUint16(2,k.length,true);v.setUint32(4,s===null?0:1,true);v.setUint32(8,s===null?0:s.length,true);
    pieces.push(h,k);if(s!==null)pieces.push(s);});return pieces;}
function admit(raw,guards,r,budget,owned){const observation=validateLegacyGuards(guards),total=rawSize(raw);
  if(LEGACY_KEYS.slice(5,11).some(k=>raw[k]!==null)||raw.mkty_current_chapter!=='9')fail('prestate');
  const release=owned||lease(budget,'context-retained',total);
  try{const summary=parseWork(budget,()=>sourceSemantics(raw,r));
    const values=Object.freeze(Object.fromEntries(LEGACY_KEYS.map(k=>[k,raw[k]])));
    return capability({kind:'source',budget,release,raw:values,rules:r,pieces:sourcePieces(values,total),
      info:Object.freeze({version:1,...observation,byteLength:total,...summary,phase:2})});
  }catch(e){release();throw e;}}
export function admitLegacyBundle(raw,guards,FieldRules,budget){return admit(raw,guards,model(FieldRules),requirePhaseBudget(budget));}
// readOne(key,accept) owns R, invokes accept(value) while R is still held, then
// drops its borrowed value before releasing R. This includes rejection: a full
// B prefix plus an over-remaining-budget value must never escape R together.
// Native getItem itself cannot be size-limited beforehand.
export function captureLegacyBundle(readOne,guards,FieldRules,budget){
  validateLegacyGuards(guards);const r=model(FieldRules);if(typeof readOne!=='function')fail('reader');
  const release=lease(budget,'context-retained',LEGACY_LIMIT.bundle);let handed=false;
  try{const raw={};let size=LEGACY_LIMIT.framing;
    for(const key of LEGACY_KEYS){let accepted=false;
      const result=readOne(key,value=>{
        if(accepted||budget.snapshot().reservations['native-read']!==65536)fail('reader-lease');accepted=true;
        if(value!==null&&typeof value!=='string')fail('raw-value');
        const next=size+(value===null?0:value.length*2);if(next>LEGACY_LIMIT.bundle)fail('bundle-limit');
        raw[key]=value;size=next;
      });if(!accepted||result!==undefined)fail('reader');
    }
    const cap=admit(raw,guards,r,budget,release);handed=true;return cap;
  }finally{if(!handed)release();}
}

function range(cap,offset,length){const d=read(cap);if(!['source','next'].includes(d.kind)||!safe(offset)||
    !safe(length)||length<1||length>LEGACY_LIMIT.page||offset+length>d.info.byteLength)fail('range');return d;}
function visitRange(d,offset,length,accept){let at=0,out=0;for(const part of d.pieces){
    const n=typeof part==='string'?part.length*2:part.length,lo=Math.max(offset,at),hi=Math.min(offset+length,at+n);
    for(let i=lo;i<hi;i++){const p=i-at,c=typeof part==='string'?part.charCodeAt(p>>1):part[p];
      if(accept(out++,typeof part==='string'?(p%2?c>>>8:c&255):c)===false)return false;}at+=n;if(at>=offset+length)break;
  }return out===length;}
function copy(cap,offset,length,budget,kind){const d=range(cap,offset,length);if(d.kind!==kind)fail('capability');assertLegacyBudget(cap,budget);
  if(budget.snapshot().live+LEGACY_LIMIT.bridge>budget.snapshot().ceiling)fail('joint-budget');
  budget.allocate('stream-candidate',length);const bytes=new Uint8Array(length);visitRange(d,offset,length,(i,v)=>{bytes[i]=v;});return bytes;}
function compare(cap,offset,bytes,kind){C.boundedBytes(bytes,LEGACY_LIMIT.page);const d=range(cap,offset,bytes.length);
  if(d.kind!==kind)fail('capability');return visitRange(d,offset,bytes.length,(i,v)=>bytes[i]===v);}
export const copyLegacyRange=(cap,offset,length,budget)=>copy(cap,offset,length,budget,'source');
export const compareLegacyRange=(cap,offset,bytes)=>compare(cap,offset,bytes,'source');
export const copyNextRange=(cap,offset,length,budget)=>copy(cap,offset,length,budget,'next');
export const compareNextRange=(cap,offset,bytes)=>compare(cap,offset,bytes,'next');
function unheader(bytes,max){C.boundedBytes(bytes,max);const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(bytes.length<20||Array.from('ARCHIVE1').some((c,i)=>bytes[i]!==c.charCodeAt(0))||v.getUint32(8,true)!==1||
    v.getUint32(12,true)!==bytes.length-20||v.getUint32(16,true)!==0)fail('frame');return v;}
function borrowedFrame(bytes,budget,max){requirePhaseBudget(budget);C.boundedBytes(bytes,max);
  if(budget.snapshot().reservations['context-parse']<bytes.length)fail('frame-lease');
  absent(budget,['reload-phase-retained','post-target']);return unheader(bytes,max);}
function textFrom(v,start,units){let result='';for(let i=0;i<units;i+=512){const chars=[];
  for(let j=i;j<Math.min(units,i+512);j++)chars.push(v.getUint16(start+j*2,true));result+=String.fromCharCode(...chars);}return result;}
export function decodeLegacyBundle(bytes,guards,FieldRules,budget){validateLegacyGuards(guards);const r=model(FieldRules),v=borrowedFrame(bytes,budget,LEGACY_LIMIT.bundle);
  if(bytes.length<LEGACY_LIMIT.framing)fail('frame');const release=lease(budget,'context-retained',bytes.length);let handed=false;
  try{const raw=work(budget,[['reload-story-work',65536],['reload-decode',4096]],()=>{
    if(Array.from('LGCYRAW1').some((c,i)=>bytes[20+i]!==c.charCodeAt(0))||v.getUint32(28,true)!==12)fail('frame');
    const out={};let offset=32;LEGACY_KEYS.forEach((k,i)=>{
      if(offset+12>bytes.length||v.getUint16(offset,true)!==i||v.getUint16(offset+2,true)!==k.length)fail('frame');
      const present=v.getUint32(offset+4,true),units=v.getUint32(offset+8,true);offset+=12;
      if(present>1||!present&&units!==0||offset+(k.length+units)*2>bytes.length)fail('frame');
      for(let j=0;j<k.length;j++)if(v.getUint16(offset+j*2,true)!==k.charCodeAt(j))fail('frame');offset+=k.length*2;
      out[k]=present?textFrom(v,offset,units):null;offset+=units*2;
    });if(offset!==bytes.length)fail('frame');return out;
  });const cap=admit(raw,guards,r,budget,release);handed=true;return cap;
  }finally{if(!handed)release();}}

export function controllerCheckpoint(cap,budget){const d=read(cap);assertLegacyBudget(cap,budget);
  if(!['source','next'].includes(d.kind))fail('capability');absent(budget,['context-parse']);
  const release=lease(budget,'reload-phase-retained',LEGACY_LIMIT.controller);
  try{let value=modelWork(budget,()=>freeze(d.kind==='source'?envelope(d.raw[LEGACY_KEYS[1]],d.rules).checkpoint:
    restore(json(d.text,LEGACY_LIMIT.checkpoint),d.info.seed,d.rules,false).value));
    return Object.freeze({get value(){if(value===null)fail('released-checkpoint');return value;},release(){value=null;release();}});
  }catch(e){release();throw e;}}
export function prepareLegacyWait(sourceCap,FieldRules,budget){const source=read(sourceCap,'source');assertLegacyBudget(sourceCap,budget);sameModel(source.rules,FieldRules);
  const release=lease(budget,'post-target',LEGACY_LIMIT.candidate),shared={refs:1,release};
  try{const result=modelWork(budget,()=>{const s=envelope(source.raw[LEGACY_KEYS[1]],source.rules),next=waitOracle(s.checkpoint,s.seed,source.rules);
    return {expected:JSON.stringify(next.value),bytes:next.bytes};});
    return capability({kind:'preflight',budget,source:sourceCap,expected:result.expected,bytes:result.bytes,shared,
      release:()=>{if(--shared.refs===0)shared.release();}});
  }catch(e){release();throw e;}}
export function matchLegacyWait(preflight,actualCheckpoint,budget){const p=read(preflight,'preflight'),source=read(p.source,'source');budget??=p.budget;
  assertLegacyBudget(preflight,budget);
  const text=modelWork(budget,()=>{const bytes=measure(actualCheckpoint,LEGACY_LIMIT.checkpoint),expected=json(p.expected,LEGACY_LIMIT.checkpoint);
    if(bytes!==p.bytes||!sameLegacyValue(expected,actualCheckpoint))fail('wait-mismatch');
    return p.next?null:JSON.stringify(actualCheckpoint);
  });if(p.next){read(p.next,'next');return p.next;}
  // Publish the capability/refcount only after every workspace release succeeds.
  p.shared.refs++;const next=capability({kind:'next',budget,source:p.source,text,rules:source.rules,shared:p.shared,
    release:()=>{if(--p.shared.refs===0)p.shared.release();},pieces:[header(20+text.length*2),text],
    info:Object.freeze({version:1,principal:source.info.principal,epoch:source.info.epoch,byteLength:20+text.length*2,
      checkpointBytes:p.bytes,seed:source.info.seed})});p.next=next;return next;}
export function compareNextCheckpoint(nextCap,actualCheckpoint,budget){const d=read(nextCap,'next');assertLegacyBudget(nextCap,budget);
  return modelWork(budget,()=>measure(actualCheckpoint,LEGACY_LIMIT.checkpoint)===d.info.checkpointBytes&&
    sameLegacyValue(json(d.text,LEGACY_LIMIT.checkpoint),actualCheckpoint)&&JSON.stringify(actualCheckpoint)===d.text);
}
export function decodeLegacyWait(bytes,sourceCap,FieldRules,budget){const v=borrowedFrame(bytes,budget,LEGACY_LIMIT.nextFrame);
  if((bytes.length-20)%2)fail('frame');const preflight=prepareLegacyWait(sourceCap,FieldRules,budget);let next;
  try{const text=work(budget,[['reload-story-work',65536],['reload-decode',4096]],()=>textFrom(v,20,(bytes.length-20)/2));
    // The decoded graph and serialization are charged by modelWork; no controller
    // action is replayed here. The source oracle is only a read-only verifier.
    modelWork(budget,()=>{
      const p=read(preflight,'preflight'),actual=json(text,LEGACY_LIMIT.checkpoint),expected=json(p.expected,LEGACY_LIMIT.checkpoint);
      if(!sameLegacyValue(actual,expected)||JSON.stringify(actual)!==text)fail('wait-mismatch');
    });const p=read(preflight,'preflight'),source=read(sourceCap,'source');p.shared.refs++;
    next=capability({kind:'next',budget,source:sourceCap,text,rules:source.rules,
      release:()=>{if(--p.shared.refs===0)p.shared.release();},pieces:[header(bytes.length),text],
      info:Object.freeze({version:1,principal:source.info.principal,epoch:source.info.epoch,byteLength:bytes.length,
        checkpointBytes:text.length*2,seed:source.info.seed})});return next;
  }finally{disposeLegacy(preflight);}}
