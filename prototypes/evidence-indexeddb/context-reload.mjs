// SOURCE ONLY. Re-admit immutable archive dependencies in a fresh module realm.
// This is a bounded evidence reader, not mutable-owner/reward authority. The
// caller must pin both records from the SAME adapter/database as its adoption.
import * as C from './contract.mjs';
import * as CodecModule from '../../trace-codec.js';
import {admitContext,describeContext,describeFinaleContextDescriptor,measureFinaleData,CONTEXT_LIMIT} from './finale-context-v1.mjs';
import {admitFinalePhase,describeFinalePhaseDescriptor,PHASE_LIMIT} from './finale-phase-v2.mjs';
import {requirePhaseBudget} from './phase-budget.mjs';
const Codec=CodecModule.default||globalThis.MKTYTraceCodec;
const HEAD=['version','binding','ordinal','total','root','sealed','token'];
const active=new WeakSet(),HEADER=[65,82,67,72,73,86,69,49,2,0,0,0];
const OWN=['context-retained','context-parse','context-restore','phase-workspace',
  'helper-framing','helper-hash','reload-page','reload-chunk','reload-story-work',
  'reload-binding','reload-decode','reload-phase-retained'];
const bad=()=>C.fail('context-reload-correspondence');
// Of the pre-reserved metadata32768, this reader owns at most24576 and leaves
// 8192 for its caller's control scaffold. Caller-owned adoption/terminal graphs
// require their own reservation. Count internal pins/descriptors/summary/reference
// conservatively as independent representations even when fields alias. Another
// 6144 covers the fixed context binding (raw/canonical/frozen), the transient
// 2048-byte head-token text/data and one descriptor-copy scaffold. Raw story and
// phase bodies are NEVER charged here. Escaped 128-byte scope strings are tested.
function metadata(budget,stage,values){
  const bytes=measureFinaleData(values,18432)+6144;
  budget.allocate('metadata',24576);budget.event('reload-metadata',{stage,bytes,limit:24576});
}
const descriptorCopy=pin=>({text:pin.text,value:pin.descriptor,bytes:C.utf8Size(pin.text),total:pin.total,binding:pin.head.binding});
const plainArray=(a,n)=>Array.isArray(a)&&Object.getPrototypeOf(a)===Array.prototype&&a.length===n&&
  Reflect.ownKeys(a).length===n+1&&Array.from({length:n},(_,i)=>Object.getOwnPropertyDescriptor(a,String(i))).every(p=>p&&Object.hasOwn(p,'value'));

function snapshotPin(input,isPhase){
  if(!C.exact(input,['descriptor','head']))bad();
  const description=(isPhase?describeFinalePhaseDescriptor:describeFinaleContextDescriptor)(input.descriptor),h=input.head;
  if(!C.exact(h,HEAD)||h.version!==1||!C.hex(h.binding)||!C.hex(h.root)||h.sealed!==true||
    h.total!==description.total||h.ordinal!==Math.ceil(h.total/(isPhase?PHASE_LIMIT.bytes:CONTEXT_LIMIT.page))-1||
    typeof h.token!=='string'||h.token.length!==295||!/^h\.[A-Za-z0-9_-]{228}\.[a-f0-9]{64}$/.test(h.token))bad();
  // makeHead's two 64-char digests, two 14-char counters and seal digit produce
  // exactly171 JSON bytes /228 base64 chars. Bound before untoken's decode/parse.
  const descriptor=Object.freeze({...description.value,components:Object.freeze(description.value.components.map(p=>Object.freeze(p)))});
  return Object.freeze({descriptor,head:Object.freeze({...h}),total:description.total,text:description.text});
}

// Cleanup measures actual slot changes. A budget observer is allowed to throw
// AFTER reserve/release mutates the account, including inside reused admission.
// The reader has exclusive ownership of OWN until its returned lease is disposed.
function cleanup(budget,keep=[],labels=OWN){
  let first;
  for(const label of labels){
    if(keep.includes(label))continue;
    const n=budget.snapshot().reservations[label];
    if(n)try{budget.release(label,n);}catch(error){first??=error;}
  }
  if(labels.some(label=>!keep.includes(label)&&budget.snapshot().reservations[label]))C.fail('context-reload-cleanup');
  if(first)throw first;
}
function reserve(budget,label,n){budget.reserve(label,n);budget.allocate(label,n);}
function hashAccount(budget){return {
  reserve(_name,n){reserve(budget,'helper-framing',n);},
  release(_name,n){budget.release('helper-framing',n);},
  reserveHash(n,text){reserve(budget,'helper-hash',n*(text?2:1));},
  releaseHash(n,text){budget.release('helper-hash',n*(text?2:1));},
  hash(){budget.event('reload-hash');}
};}
async function authenticate(pin,crypto,account){
  const d=await C.descriptor(pin.descriptor,crypto,account);
  if(d.binding!==pin.head.binding||d.text!==pin.text)bad();
  const h=await C.headToken(pin.head.token,crypto,account);
  if(['binding','ordinal','total','root','sealed'].some(k=>h[k]!==pin.head[k]))bad();
  return d;
}

// Only the owned chunk survives this function. In particular page, segment and
// payload aliases are cleared synchronously before any subsequent hashing await.
async function takeChunk(adapter,pin,ordinal,offset,max,budget){
  reserve(budget,'reload-page',max);
  let page=null,segment=null,payload=null,chunk=null;
  try{
    page=await adapter.readSegments({captureIdentity:{scope:pin.descriptor.scope,run:pin.descriptor.run},
      throughHead:pin.head.token,afterOrdinal:ordinal-1,maxBytes:max});
    if(page?.status!=='page')C.fail('context-reload-read-refused');
    if(!C.exact(page,['status','segments','payloadBytes','throughHead','nextCursor'])||
      page.throughHead!==pin.head.token||!plainArray(page.segments,1))bad();
    segment=page.segments[0];const length=Math.min(max,pin.total-offset),last=offset+length===pin.total;
    if(!C.exact(segment,['ordinal','offset','length','root','payload'])||segment.ordinal!==ordinal||
      segment.offset!==offset||segment.length!==length||page.payloadBytes!==length||!C.hex(segment.root))bad();
    if(last?page.nextCursor!==null:!C.exact(page.nextCursor,['captureIdentity','throughHead','afterOrdinal'])||
      !C.exact(page.nextCursor.captureIdentity,['scope','run'])||page.nextCursor.captureIdentity.scope!==pin.descriptor.scope||
      page.nextCursor.captureIdentity.run!==pin.descriptor.run||page.nextCursor.throughHead!==pin.head.token||page.nextCursor.afterOrdinal!==ordinal)bad();
    payload=C.boundedBytes(segment.payload,max);if(payload.length!==length)bad();
    reserve(budget,'reload-chunk',length);chunk=new Uint8Array(length);
    Uint8Array.prototype.set.call(chunk,payload);
    return {bytes:chunk,root:segment.root};
  }finally{
    page=null;segment=null;payload=null;chunk=null;
    budget.release('reload-page',max);
  }
}

// Exact code-unit decoder, including BOM, unpaired surrogates and -0 spelling in
// the raw JSON. No TextDecoder('utf-16') replacement, array of all characters, or
// whole encoded context is allocated. At most 256 code units form a block. The
// 4096-byte scratch covers old/new block strings and one-character intermediates;
// context-retained + reload-story-work cover old/new concatenated story strings.
function decoder(pin,budget){
  const storyBytes=pin.descriptor.components[0].length,bindingBytes=pin.descriptor.components[1].length;
  const storyStart=20,storyEnd=20+storyBytes,bindingStart=storyEnd+8;
  let storyText='',bindingText='',position=0;
  function accept(bytes,offset){
    if(offset!==position||bytes.length%2)bad();
    let block='',kind=null;
    const flush=()=>{if(!block)return;if(kind==='story')storyText=storyText+block;else bindingText=bindingText+block;block='';};
    for(let i=0;i<bytes.length;){
      const at=offset+i;
      if(at<12){flush();if(bytes[i]!==HEADER[at])bad();i++;continue;}
      if(at<20||at>=storyEnd&&at<bindingStart){
        flush();const start=at<20?12:storyEnd,length=at<20?storyBytes:bindingBytes;
        if(bytes[i]!==Math.floor(length/2**((at-start)*8))%256)bad();i++;continue;
      }
      const nextKind=at<storyEnd?'story':'binding';
      if(at>=pin.total||i+1>=bytes.length||(nextKind==='story'?at<storyStart:at<bindingStart))bad();
      if(kind!==nextKind){flush();kind=nextKind;}
      block+=String.fromCharCode(bytes[i]|bytes[i+1]<<8);i+=2;
      if(block.length===256)flush();
    }
    flush();position+=bytes.length;
    budget.event('reload-context-decoded',{bytes:position,storyUtf16:storyText.length*2,bindingUtf16:bindingText.length*2});
  }
  return {accept,finish(){if(position!==pin.total||storyText.length*2!==storyBytes||bindingText.length*2!==bindingBytes)bad();
    return {storyText,bindingText};},clear(){storyText='';bindingText='';}};
}

async function recover(options,withPhase){
  if(!options||Object.getPrototypeOf(options)!==Object.prototype)C.fail('context-reload-options');
  // Capture caller references before observer callbacks or the first await.
  const {adapter,budget:inputBudget,crypto=globalThis.crypto,contextPin:contextInput,phasePin:phaseInput}=options;
  const budget=requirePhaseBudget(inputBudget);
  if(!adapter||typeof adapter.readSegments!=='function'||!crypto?.subtle?.digest)C.fail('context-reload-capability');
  if(active.has(budget)||OWN.some(label=>budget.snapshot().reservations[label]))C.fail('context-reload-busy');
  active.add(budget);
  let context=null,storyText=null,phase=null,contextReference=null,decode=null,parts=null,binding=null,chunk=null,disposed=false,succeeded=false;
  try{
    let contextPin=snapshotPin(contextInput,false),phasePin=withPhase?snapshotPin(phaseInput,true):null;
    // The metadata slot is permanently reserved before entry. Snapshot both
    // mutable caller pins before invoking its observer for the first time.
    metadata(budget,'pins',[contextPin,phasePin]);
    if(phasePin&&phasePin.descriptor.scope!==contextPin.descriptor.scope)bad();
    const account=hashAccount(budget);
    metadata(budget,'context-authentication',[contextPin,phasePin,descriptorCopy(contextPin)]);
    let d=await authenticate(contextPin,crypto,account);
    reserve(budget,'context-retained',contextPin.descriptor.components[0].length);
    reserve(budget,'reload-story-work',contextPin.descriptor.components[0].length);
    reserve(budget,'reload-binding',12288);reserve(budget,'reload-decode',4096);
    decode=decoder(contextPin,budget);
    let offset=0,ordinal=0,root=C.ZERO;
    while(offset<contextPin.total){
      chunk=await takeChunk(adapter,contextPin,ordinal,offset,CONTEXT_LIMIT.page,budget);
      const computed=await C.chain(d,{ordinal,offset,previousRoot:root},chunk.bytes,crypto,account);
      if(computed!==chunk.root)bad();
      decode.accept(chunk.bytes,offset);offset+=chunk.bytes.length;ordinal++;root=chunk.root;
      const length=chunk.bytes.length;chunk=null;budget.release('reload-chunk',length);
    }
    if(root!==contextPin.head.root||ordinal!==contextPin.head.ordinal+1)bad();
    parts=decode.finish();storyText=parts.storyText;decode.clear();decode=null;
    budget.release('reload-story-work',contextPin.descriptor.components[0].length);budget.release('reload-decode',4096);
    try{binding=JSON.parse(parts.bindingText);}catch{bad();}
    // Existing context writer uses one canonical lossless binding spelling.
    if(Codec.stringify(binding,CONTEXT_LIMIT.binding,'finale-context-limit')!==parts.bindingText)bad();
    context=admitContext({scope:contextPin.descriptor.scope,session:binding.session,storyText,binding},budget);
    if(C.describe(describeContext(context).descriptor).text!==contextPin.text)bad();
    contextReference=Object.freeze({version:1,scope:contextPin.descriptor.scope,run:contextPin.descriptor.run,
      binding:contextPin.head.binding,throughHead:contextPin.head.token});
    // The authenticated context descriptor copy and read pin are no longer used;
    // explicitly drop them before allocating a second authenticated descriptor.
    d=null;contextPin=null;
    metadata(budget,'context-admitted',[phasePin,describeContext(context),contextReference]);
    parts=null;binding=null;budget.release('reload-binding',12288);
    if(withPhase){
      metadata(budget,'phase-authentication',[phasePin,descriptorCopy(phasePin),describeContext(context),contextReference]);
      const pd=await authenticate(phasePin,crypto,account);
      chunk=await takeChunk(adapter,phasePin,0,0,PHASE_LIMIT.bytes,budget);
      const computed=await C.chain(pd,{ordinal:0,offset:0,previousRoot:C.ZERO},chunk.bytes,crypto,account);
      if(computed!==chunk.root||computed!==phasePin.head.root)bad();
      reserve(budget,'phase-workspace',PHASE_LIMIT.workspace);
      // Charge the returned graph independently while the parser/model workspace
      // is still live, rather than pretending release makes that graph disappear.
      reserve(budget,'reload-phase-retained',PHASE_LIMIT.rawCapsule);
      phase=admitFinalePhase(chunk.bytes,phasePin.descriptor,context,contextReference,undefined,budget);
      budget.event('reload-phase-retained',{bytes:measureFinaleData([phase],PHASE_LIMIT.rawCapsule),limit:PHASE_LIMIT.rawCapsule});
      const length=chunk.bytes.length;chunk=null;budget.release('reload-chunk',length);
      budget.release('phase-workspace',PHASE_LIMIT.workspace);
    }
    phasePin=null;
    metadata(budget,'retained',[describeContext(context),contextReference]);
    cleanup(budget,['context-retained',...(withPhase?['reload-phase-retained']:[])]);
    const alive=()=>{if(disposed)C.fail('context-reload-disposed');};
    const result=Object.freeze({
      get context(){alive();return context;},get storyText(){alive();return storyText;},
      get contextReference(){alive();return contextReference;},get phase(){alive();return phase;},
      dispose(){if(disposed)return;disposed=true;context=null;storyText=null;phase=null;contextReference=null;
        try{cleanup(budget,[],['context-retained',...(withPhase?['reload-phase-retained']:[])]);}finally{active.delete(budget);}}
    });
    succeeded=true;return result;
  }finally{
    if(!succeeded){context=null;storyText=null;phase=null;contextReference=null;binding=null;parts=null;chunk=null;
      decode?.clear();decode=null;try{cleanup(budget);}finally{active.delete(budget);}}
  }
}

// Returned values are borrowed until dispose(). Callers must drop any aliases
// before disposal; getters are revoked and this reader drops all its references
// BEFORE releasing their reservations. No WeakMap brand is serialized or copied.
// Worst phase admission: 425984 base + 65536 context + 16384 chunk + 327680
// workspace + 65536 retained phase = 901120 representation bytes. This is not a
// JavaScript heap claim. Adapter/native copies retain their existing 393216 slot.
export const recoverFinaleContext=options=>recover(options,false);
export const recoverFinaleContextAndPhase=options=>recover(options,true);
