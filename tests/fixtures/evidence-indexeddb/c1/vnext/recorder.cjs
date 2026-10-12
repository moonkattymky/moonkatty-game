'use strict';
// Pure, bounded, self-contained callback journal. No I/O or gameplay control.
const M=require('./source-model.cjs');
const FORMAT='mkty-life1-source-callbacks-vnext-1';
const DEFAULT=Object.freeze({maxEntries:4096,maxBytes:196608}),HARD=Object.freeze({maxEntries:16384,maxBytes:524288});
const DRAFT=Object.freeze({maxSteps:128,maxBytes:32768});
const clone=x=>structuredClone(x),bytes=s=>new TextEncoder().encode(s).length;
const fail=code=>{const e=Error(code);e.code=code;throw e;};
function encode(x){if(typeof x==='number'){if(!Number.isFinite(x))fail('invalid-number');return Object.is(x,-0)?'-0':String(x);}if(x===null||typeof x==='string'||typeof x==='boolean')return JSON.stringify(x);if(Array.isArray(x))return '['+x.map(encode).join(',')+']';if(x&&typeof x==='object')return '{'+Object.keys(x).map(k=>JSON.stringify(k)+':'+encode(x[k])).join(',')+'}';fail('invalid-value');}
function exact(x,keys){return x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));}
function freeze(x){if(x&&typeof x==='object'&&!Object.isFrozen(x)){for(const y of Object.values(x))freeze(y);Object.freeze(x);}return x;}
function capacity(x=DEFAULT){if(!exact(x,['maxEntries','maxBytes'])||!Number.isSafeInteger(x.maxEntries)||x.maxEntries<1||x.maxEntries>HARD.maxEntries||!Number.isSafeInteger(x.maxBytes)||x.maxBytes<512||x.maxBytes>HARD.maxBytes)fail('invalid-capacity');return {...x};}
const usage=wire=>({entries:wire.entries.length,bytes:bytes(encode(wire))});
const accepted=(wire,state,measured=usage(wire))=>({ok:true,recording:freeze({wire,state,usage:measured})});
const refused=(recording,error,extra={})=>({ok:false,error,recording,...extra});
function finiteTime(n){return typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=Number.MAX_SAFE_INTEGER;}
function clock(raw){if(!exact(raw,['dispatchMs','lastFrame','nearbyAt','clockResumedAt'])||!Object.values(raw).every(finiteTime))fail('invalid-source-clock');return {...raw};}
function checkDraft(callback){if(!exact(callback,['kind','dispatchMs','steps'])||!Array.isArray(callback.steps)||callback.steps.length>DRAFT.maxSteps)fail('callback-draft-capacity-refused');if(bytes(encode(callback))>DRAFT.maxBytes)fail('callback-draft-capacity-refused');return callback;}
function initialRecording({context,initial,clock:raw={dispatchMs:0,lastFrame:0,nearbyAt:0,clockResumedAt:0},limits=DEFAULT}={}){
 if(!exact(context,['life1_profile','route','life','edition','challenge_version','seed']))fail('invalid-context');const c=clock(raw);
 const state=M.create({context,initial,clock:c});state.dispatchMs=c.dispatchMs;state.now=c.dispatchMs;
 const wire={format:FORMAT,transition:M.ID,context:clone(context),initial:clone(initial),capacity:capacity(limits),entries:[['document',0,0,c.dispatchMs,c.lastFrame,c.nearbyAt,c.clockResumedAt]]};
 return {wire,state};
}
function create(options){
 try{
  const {wire,state}=initialRecording(options),required=usage(wire);
  if(required.bytes>wire.capacity.maxBytes)return refused(null,'capacity-refused',{required});
  return accepted(wire,state,required);
 }catch(e){return refused(null,e.code||e.message);}
}
function commit(recording,entry,transition){
 const wire={...recording.wire,entries:[...recording.wire.entries,clone(entry)]},required=usage(wire);
 if(required.entries>wire.capacity.maxEntries||required.bytes>wire.capacity.maxBytes)return refused(recording,'capacity-refused',{required,retained:recording.usage});
 return accepted(wire,transition(),required);
}
function appendCallback(recording,callback){
 try{checkDraft(callback);return commit(recording,['callback',recording.state.document,recording.wire.entries.length,callback.dispatchMs,callback.kind,callback.steps],()=>M.transition(recording.state,callback));}
 catch(e){return refused(recording,e.code||e.message);}
}
function preflightDocument(recording,raw){
 try{
  const c=clock(raw);M.beginDocument(recording.state,c);
  // Reserve the exact minimum envelope before any source writes. This is not a
  // committed hydrate callback: the real bounded steps must pass beginDocument.
  const wire={...recording.wire,entries:[...recording.wire.entries,['document',recording.state.document+1,recording.wire.entries.length,c.dispatchMs,c.lastFrame,c.nearbyAt,c.clockResumedAt,[]]]},required=usage(wire);
  if(required.entries>wire.capacity.maxEntries||required.bytes>wire.capacity.maxBytes)return refused(recording,'capacity-refused',{required,retained:recording.usage});
  return {ok:true};
 }catch(e){return refused(recording,e.code||e.message);}
}
function beginDocument(recording,raw,steps){
 try{const c=clock(raw),callback=checkDraft({kind:'hydrate',dispatchMs:c.dispatchMs,steps});
  return commit(recording,['document',recording.state.document+1,recording.wire.entries.length,c.dispatchMs,c.lastFrame,c.nearbyAt,c.clockResumedAt,steps],()=>M.transition(M.beginDocument(recording.state,c),callback));
 }catch(e){return refused(recording,e.code||e.message);}
}
function serialize(recording){return encode(recording.wire);}
function inspect(body){
 try{
  if(typeof body!=='string'||body.length>HARD.maxBytes||bytes(body)>HARD.maxBytes)fail('recording-byte-limit');
  const input=JSON.parse(body);
  if(!exact(input,['format','transition','context','initial','capacity','entries'])||input.format!==FORMAT||input.transition!==M.ID||!Array.isArray(input.entries)||input.entries.length<1||input.entries.length>HARD.maxEntries)fail('recording-format');
  const first=input.entries[0];if(!Array.isArray(first)||first.length!==7||first[0]!=='document'||first[1]!==0||first[2]!==0)fail('initial-document');
  const initial=initialRecording({context:input.context,initial:input.initial,limits:input.capacity,clock:{dispatchMs:first[3],lastFrame:first[4],nearbyAt:first[5],clockResumedAt:first[6]}});
  const wire=initial.wire;let state=initial.state,measured=usage(wire);
  if(measured.bytes>wire.capacity.maxBytes)return refused(null,'capacity-refused',{required:measured});
  // Replay directly, without appendCallback's immutable copies or repeated
  // whole-prefix serialization. Measure the envelope once, then each accepted
  // entry plus its comma exactly once. Draft checks remain separately bounded.
  const prefix=()=>accepted(wire,state,measured).recording;
  for(let i=1;i<input.entries.length;i++){
   const e=input.entries[i];if(!Array.isArray(e)||e[2]!==i)fail('journal-sequence');
   let callback,c,entry;
   if(e[0]==='callback'&&e.length===6&&e[1]===state.document){
    callback={kind:e[4],dispatchMs:e[3],steps:e[5]};
    entry=['callback',state.document,i,e[3],e[4],e[5]];
   }else if(e[0]==='document'&&e.length===8&&e[1]===state.document+1){
    c={dispatchMs:e[3],lastFrame:e[4],nearbyAt:e[5],clockResumedAt:e[6]};
    callback={kind:'hydrate',dispatchMs:e[3],steps:e[7]};
    entry=['document',state.document+1,i,e[3],e[4],e[5],e[6],e[7]];
   }else fail('document-sequence');
   try{
    if(c)c=clock(c);checkDraft(callback);
    const required={entries:i+1,bytes:measured.bytes+1+bytes(encode(entry))};
    if(required.entries>wire.capacity.maxEntries||required.bytes>wire.capacity.maxBytes)return refused(prefix(),'capacity-refused',{required,retained:measured});
    const next=M.transition(c?M.beginDocument(state,c):state,callback);
    wire.entries.push(entry);state=next;measured=required;
   }catch(e){return refused(prefix(),e.code||e.message);}
  }
  return accepted(wire,state,measured);
 }catch(e){return refused(null,e.code||e.message);}
}
function recover(body,raw,steps){const checked=inspect(body);return checked.ok?beginDocument(checked.recording,raw,steps):checked;}
module.exports=Object.freeze({FORMAT,DEFAULT,HARD,DRAFT,create,appendCallback,preflightDocument,beginDocument,recover,inspect,serialize,encode,checkDraft});
