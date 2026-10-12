'use strict';
// Source-only transactional model. No I/O, real persistence, authentication, or gameplay.
const crypto = require('node:crypto');
const LIMIT = Object.freeze({payload:65536, metadata:4096, page:65536, positions:16,
  quota:8*1024*1024, captures:128, head:4096, segment:4096, index:2048, counters:384});
const ZERO = '0'.repeat(64), FORMAT = 'archive-bytes-v1';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const utf8 = text => Buffer.byteLength(text, 'utf8');
const own = (x,k) => Object.hasOwn(x,k);
const int = x => Number.isSafeInteger(x) && x >= 0;
const add = (...values) => { let n=0; for(const x of values) {
  if(!int(x) || !Number.isSafeInteger(n+x)) throw Error('counter-overflow'); n+=x;
} return n; };
const exact = (x,keys) => x && Object.getPrototypeOf(x)===Object.prototype &&
  Object.keys(x).length===keys.length && keys.every(k=>own(x,k));
const fail = reason => { throw Error(reason); };
const str = (s,max=4096) => typeof s==='string' && s.length<=max && utf8(s)<=max;
function descriptor(d) {
  if(!exact(d,['format','scope','run','kind','model','components','note']) || d.format!==FORMAT ||
    !['scope','run','kind','model'].every(k=>str(d[k],128)&&d[k].length) || !str(d.note) ||
    !Array.isArray(d.components) || d.components.length<1 || d.components.length>8) fail('descriptor-invalid');
  let total=12;
  for(const c of d.components) {
    if(!exact(c,['name','encoding','length']) || !str(c.name,128) || !c.name.length ||
      !['utf8','utf16le','opaque'].includes(c.encoding) || !int(c.length)) fail('component-invalid');
    total=add(total,8,c.length);
  }
  if(total>LIMIT.quota) fail('artifact-limit');
  const text=JSON.stringify(d); if(utf8(text)>LIMIT.metadata) fail('metadata-limit');
  return {text, value:JSON.parse(text), binding:hash(text), bytes:utf8(text), total};
}
function token(type,value) {
  const text=JSON.stringify(value); return type+'.'+Buffer.from(text).toString('base64url')+'.'+hash(type+'\0'+text);
}
function untoken(type,t,max=2048) {
  if(!str(t,max)) fail('token-invalid'); const parts=t.split('.');
  if(parts.length!==3||parts[0]!==type) fail('token-invalid');
  const text=Buffer.from(parts[1],'base64url').toString('utf8');
  if(hash(type+'\0'+text)!==parts[2]) fail('token-invalid');
  return JSON.parse(text);
}
const numberToken = n => { if(!int(n)) fail('counter-overflow'); return n.toString(16).padStart(14,'0'); };
function makeHead(d,ordinal,total,root,sealed) {
  const value={version:1,binding:d.binding,ordinal,total,root,sealed};
  return {...value, token:token('h',[d.binding,numberToken(ordinal),numberToken(total),root,sealed?1:0])};
}
function headToken(t) {
  const a=untoken('h',t); if(!Array.isArray(a)||a.length!==5||
    !/^[a-f0-9]{64}$/.test(a[0])||!a.slice(1,3).every(x=>typeof x==='string'&&/^[a-f0-9]{14}$/.test(x))||
    !/^[a-f0-9]{64}$/.test(a[3])||![0,1].includes(a[4])) fail('head-invalid');
  const ordinal=parseInt(a[1],16), total=parseInt(a[2],16);
  if(!int(ordinal)||!int(total)) fail('head-invalid');
  return {binding:a[0],ordinal,total,root:a[3],sealed:!!a[4]};
}
function chain(d,q,payload) {
  const prefix=JSON.stringify([FORMAT,d.binding,q.ordinal,q.offset,q.previousRoot,payload.length]);
  return crypto.createHash('sha256').update('segment\0').update(prefix).update('\0').update(payload).digest('hex');
}
function validate(q) {
  const keys=['descriptor','expectedHead','ordinal','offset','previousRoot','payload'];
  if(!exact(q,own(q||{},'seal')?[...keys,'seal']:keys)) fail('request-invalid');
  if(!(q.payload instanceof Uint8Array)||q.payload.length<1||q.payload.length>LIMIT.payload) fail('payload-limit');
  if(!int(q.ordinal)||!int(q.offset)||q.ordinal>=Number.MAX_SAFE_INTEGER||
    typeof q.previousRoot!=='string'||!/^[a-f0-9]{64}$/.test(q.previousRoot)) fail('position-invalid');
  const end=add(q.offset,q.payload.length),d=descriptor(q.descriptor);
  if(end>d.total) fail('declared-length');
  if(q.expectedHead!==null) { const h=headToken(q.expectedHead); if(h.binding!==d.binding) fail('head-binding'); }
  if(own(q,'seal')&&(!exact(q.seal,['totalBytes','root'])||!int(q.seal.totalBytes)||
    typeof q.seal.root!=='string'||!/^[a-f0-9]{64}$/.test(q.seal.root))) fail('seal-invalid');
  const meta=JSON.stringify({...q,payload:undefined}); const metadataBytes=utf8(meta);
  if(metadataBytes>LIMIT.metadata) fail('metadata-limit');
  return {d,end,metadataBytes,requestBytes:add(metadataBytes,q.payload.length)};
}
function prepare(q) {
  const v=validate(q);
  return {request:{...q,descriptor:v.d.value,payload:Buffer.from(q.payload),
    ...(own(q,'seal')?{seal:{...q.seal}}:{})},...v};
}
const keyOf = (scope,run) => JSON.stringify([scope,run]);
const segmentKey = (key,ordinal) => key+'#'+ordinal;
function metadataCharges(d,sequence) {
  const {scope,run}=d.value,key=keyOf(scope,run);
  const indexBytes=add(utf8(JSON.stringify(keyOf(scope,String(sequence)))),utf8(JSON.stringify({version:1,key,sequence})));
  return {head:add(d.bytes,d.bytes,d.bytes,LIMIT.head),index:Math.max(LIMIT.index,indexBytes),
    counters:add(LIMIT.counters,utf8(JSON.stringify(scope)))};
}
// No enumeration, iteration, clone, size, or sorting interface exists on a table.
class DirectTable {
  #data=new Map();
  constructor(name,observe){this.name=name;this.observe=observe;}
  get(k) {this.observe(this.name,k,'read');return this.#data.get(k);}
  set(k,v) {this.observe(this.name,k,'write');this.#data.set(k,v);}
  delete(k) {return this.#data.delete(k);} // Test fault injection only.
  [Symbol.iterator]() { fail('enumeration-forbidden'); }
  entries() { fail('enumeration-forbidden'); }
  keys() { fail('enumeration-forbidden'); }
  values() { fail('enumeration-forbidden'); }
}
function createImage(options={}) {
  const quota=options.quota??LIMIT.quota,captures=options.captures??LIMIT.captures;
  if(!int(quota)||quota>LIMIT.quota||!int(captures)||captures>LIMIT.captures) fail('configuration-invalid');
  const image={counter:{bytes:0,captures:0,segments:0},quota,captures,fault:null,volatile:{bytes:0,leases:new WeakMap()}};
  for(const table of ['heads','segments','payloads','indices','scopes'])image[table]=new DirectTable(table,(...args)=>image.observe?.(...args));
  return image;
}
function reset(image) {image.volatile={bytes:0,leases:new WeakMap()};image.fault=null;}
function stats(op) { return {op,transactions:0,headReads:0,segmentPositions:0,payloadReads:0,indexPositions:0,
  counterReads:0,hashes:0,comparisons:0,comparisonBytes:0,duplicateReadBytes:0,metadataReadBytes:0,
  requestBytes:0,inputCopyBytes:0,stagedCopyBytes:0,outputCopyBytes:0,outputBytes:0,
  stagingBytes:0,peakAccountedBytes:0,requiredStagingBytes:0,requiredPeakBytes:0,
  touchedWrites:0,enumerations:0,historicalPayloadReads:0}; }
function makeAdapter(image,{onOperation=null}={}) {
  let last=stats('none');const epoch=image.volatile;
  const live=()=>{if(image.volatile!==epoch)fail('adapter-reset');};
  const start=op=>{last=stats(op);if(onOperation){last.accesses=[];image.observe=(table,key,mode)=>last.accesses.push({table,key,mode});onOperation(last);}return last;};
  function copyRequest(q) {
    live();
    const checked=validate(q),state=image.volatile;
    if(add(image.counter.bytes,state.bytes,checked.requestBytes)>image.quota) fail('quota');
    const saved=prepare(q);state.bytes=add(state.bytes,saved.requestBytes);
    let released=false;state.leases.set(saved.request,true);
    return {...saved,release() {if(!released){released=true;state.leases.delete(saved.request);state.bytes-=saved.requestBytes;}}};
  }
  const readHead=(key,s)=>{s.headReads++;const h=image.heads.get(key);if(h)s.metadataReadBytes+=h.charge;return h;};
  function checkHead(h) {
    if(!h||h.version!==1||!h.d||!exact(h.head,['version','binding','ordinal','total','root','sealed','token'])||h.head.version!==1) fail('head-missing-or-format');
    const d=descriptor(h.d.value);
    if(typeof h.head.root!=='string'||!/^[a-f0-9]{64}$/.test(h.head.root)||typeof h.head.sealed!=='boolean'||
      !int(h.head.total)||h.head.total>d.total||(h.head.sealed&&h.head.total!==d.total)||!int(h.sequence)||h.sequence<1||
      d.text!==h.d.text||d.binding!==h.d.binding||h.head.binding!==d.binding ||
      h.head.token!==makeHead(d,h.head.ordinal,h.head.total,h.head.root,h.head.sealed).token ||
      h.charge!==3*d.bytes+LIMIT.head) fail('head-corrupt');
    return h;
  }
  const readMeta=(key,ordinal,s)=>{s.segmentPositions++;const m=image.segments.get(segmentKey(key,ordinal));
    if(!m||m.version!==1||m.ordinal!==ordinal||!int(m.length)||m.length<1||m.length>LIMIT.payload) fail('segment-missing-or-format');
    if(typeof m.hasSeal!=='boolean'||own(m,'seal')!==m.hasSeal||
      (m.hasSeal&&(!exact(m.seal,['totalBytes','root'])||!int(m.seal.totalBytes)||
        typeof m.seal.root!=='string'||!/^[a-f0-9]{64}$/.test(m.seal.root)))) fail('segment-seal-format');
    s.metadataReadBytes+=LIMIT.segment;return m;};
  function receipt(m) { return {captureIdentity:{scope:m.scope,run:m.run},ordinal:m.ordinal,
    length:m.length,root:m.root,headToken:m.headToken,sealed:m.hasSeal,acknowledgement:'simulated-commit'}; }
  async function appendSegment(q) {
    const s=start('append'); let v,owned;
    try {
      live();
      if(!image.volatile.leases.has(q)) {owned=copyRequest(q);q=owned.request;}
      v=validate(q); const {d,end,metadataBytes,requestBytes}=v;
      s.requestBytes=requestBytes;s.inputCopyBytes=q.payload.length; // Coordinator-owned retained copy.
      s.peakAccountedBytes=add(image.counter.bytes,image.volatile.bytes);
      const key=keyOf(d.value.scope,d.value.run),sk=segmentKey(key,q.ordinal);
      s.transactions=1;s.counterReads=2;
      const h=readHead(key,s),existing=image.segments.get(sk);s.segmentPositions++;
      const existingScope=image.scopes.get(d.value.scope),scope=existingScope||{highWater:0};
      if(h) checkHead(h);
      // Immutable identity comparison occurs BEFORE the concurrency guard.
      if(existing) {
        s.metadataReadBytes+=LIMIT.segment;
        const bytes=image.payloads.get(sk);s.payloadReads++;s.comparisons++;
        if(!(bytes instanceof Uint8Array)||bytes.length>LIMIT.payload) fail('segment-corrupt');
        s.comparisonBytes=q.payload.length+bytes.length;s.duplicateReadBytes=bytes.length;
        s.peakAccountedBytes=add(image.counter.bytes,image.volatile.bytes);
        if(s.peakAccountedBytes>image.quota) return {status:'refused',reason:'quota'};
        const same=existing.version===1&&h&&h.d.text===d.text&&existing.binding===d.binding&&
          existing.ordinal===q.ordinal&&existing.offset===q.offset&&existing.previousRoot===q.previousRoot&&
          existing.hasSeal===own(q,'seal')&&own(existing,'seal')===own(q,'seal')&&
          (!existing.hasSeal||(exact(existing.seal,['totalBytes','root'])&&
            existing.seal.totalBytes===q.seal.totalBytes&&existing.seal.root===q.seal.root))&&
          bytes.length===q.payload.length&&Buffer.compare(bytes,q.payload)===0;
        if(!same) return {status:'conflict',reason:'immutable-segment'};
        s.hashes++; if(chain(d,q,bytes)!==existing.root) fail('segment-corrupt');
        if(existing.length!==bytes.length||existing.scope!==d.value.scope||existing.run!==d.value.run||
          existing.headToken!==makeHead(d,q.ordinal,end,existing.root,existing.hasSeal).token||
          (existing.hasSeal&&(q.seal.totalBytes!==end||end!==d.total||q.seal.root!==existing.root))) fail('segment-corrupt');
        return {status:'duplicate',receipt:receipt(existing),currentHead:{...h.head}};
      }
      if(h&&h.d.text!==d.text) return {status:'conflict',reason:'descriptor'};
      if((h?h.head.token:null)!==q.expectedHead) return {status:'conflict',reason:'expected-head'};
      if(h?.head.sealed) return {status:'conflict',reason:'sealed'};
      if(q.ordinal!==(h?add(h.head.ordinal,1):0)||q.offset!==(h?h.head.total:0)||
        q.previousRoot!==(h?h.head.root:ZERO)) return {status:'conflict',reason:'position'};
      s.hashes++; const root=chain(d,q,q.payload),sealed=own(q,'seal');
      if(sealed&&(q.seal.totalBytes!==end||end!==d.total||q.seal.root!==root)) return {status:'refused',reason:'seal-mismatch'};
      // Conservative fixed encoded-record slots include keys, escaping, and receipt tokens.
      const sequence=h?h.sequence:add(scope.highWater,1),charges=metadataCharges(d,sequence);
      const nextHead=makeHead(d,q.ordinal,end,root,sealed),headCharge=charges.head;
      const indexCharge=h?0:charges.index,scopeCharge=existingScope?0:charges.counters;
      const delta=add(q.payload.length,LIMIT.segment,h?0:headCharge,indexCharge,scopeCharge);
      const nextBytes=add(image.counter.bytes,delta),nextCaptures=add(image.counter.captures,h?0:1);
      const nextSegments=add(image.counter.segments,1);
      s.requiredStagingBytes=add(q.payload.length,LIMIT.segment,headCharge,indexCharge,charges.counters,image.volatile.bytes);
      s.requiredPeakBytes=add(image.counter.bytes,s.requiredStagingBytes);
      if(nextCaptures>image.captures||s.requiredPeakBytes>image.quota||nextBytes>image.quota)
        return {status:'refused',reason:'quota'};
      s.stagingBytes=s.requiredStagingBytes;s.peakAccountedBytes=s.requiredPeakBytes;
      const fault=image.fault;image.fault=null;
      if(['before-stage','memory'].includes(fault)) return {status:'refused',reason:fault};
      // Only touched records are staged; publish is one synchronous modeled commit.
      const payload=Buffer.from(q.payload);s.stagedCopyBytes=payload.length;
      const m={version:1,binding:d.binding,scope:d.value.scope,run:d.value.run,ordinal:q.ordinal,
        offset:q.offset,previousRoot:q.previousRoot,length:payload.length,root,hasSeal:sealed,
        ...(sealed?{seal:{...q.seal}}:{}),headToken:nextHead.token};
      const next={version:1,d,head:nextHead,charge:headCharge,sequence};
      if(['before-commit','abort','discard'].includes(fault)) return {status:'refused',reason:fault};
      image.segments.set(sk,m);image.payloads.set(sk,payload);image.heads.set(key,next);
      if(!h) image.indices.set(keyOf(d.value.scope,String(sequence)),{version:1,key,sequence});
      image.scopes.set(d.value.scope,{highWater:h?scope.highWater:sequence});
      image.counter={bytes:nextBytes,captures:nextCaptures,segments:nextSegments};s.touchedWrites=h?5:6;
      if(fault==='lost-ack') return {status:'outcomeUnknown',reason:'acknowledgement-lost'};
      return {status:'committed',receipt:receipt(m),currentHead:{...nextHead}};
    } catch(e) {return {status:'refused',reason:e.message};}
    finally {owned?.release();image.observe=null;}
  }
  async function readSegments({captureIdentity,throughHead,afterOrdinal=-1,maxBytes=LIMIT.page}) {
    const s=start('read');
    try {
      live();
      if(!exact(captureIdentity,['scope','run'])||!str(captureIdentity.scope,128)||!str(captureIdentity.run,128)||
        !int(maxBytes)||maxBytes<1||maxBytes>LIMIT.page||!Number.isSafeInteger(afterOrdinal)||afterOrdinal< -1) fail('read-invalid');
      if(image.fault==='fresh-read') {image.fault=null;fail('fresh-read-failed');}
      const key=keyOf(captureIdentity.scope,captureIdentity.run),h=checkHead(readHead(key,s)),pin=headToken(throughHead);
      if(pin.binding!==h.d.binding||pin.ordinal>h.head.ordinal||afterOrdinal>pin.ordinal) fail('pinned-head-inaccessible');
      const pinned=readMeta(key,pin.ordinal,s);
      if(pinned.headToken!==throughHead||pinned.root!==pin.root||add(pinned.offset,pinned.length)!==pin.total||pinned.hasSeal!==pin.sealed) fail('pinned-head-corrupt');
      let previous=ZERO,offset=0;
      if(afterOrdinal>=0) {const m=afterOrdinal===pin.ordinal?pinned:readMeta(key,afterOrdinal,s);previous=m.root;offset=add(m.offset,m.length);}
      const segments=[];let ordinal=afterOrdinal+1,total=0;
      while(ordinal<=pin.ordinal && (ordinal===pin.ordinal||s.segmentPositions<LIMIT.positions)) {
        const m=ordinal===pin.ordinal?pinned:readMeta(key,ordinal,s);
        if(m.length>maxBytes-total) {
          if(!segments.length) return {status:'refused',reason:'page-budget-too-small',required:m.length};
          break;
        }
        if(m.binding!==h.d.binding||m.offset!==offset||m.previousRoot!==previous||
          (m.hasSeal&&(ordinal!==pin.ordinal||!pin.sealed))||
          makeHead(h.d,ordinal,add(offset,m.length),m.root,m.hasSeal).token!==m.headToken) fail('segment-chain-corrupt');
        const bytes=image.payloads.get(segmentKey(key,ordinal));s.payloadReads++;
        if(!(bytes instanceof Uint8Array)||bytes.length!==m.length) fail('segment-bytes-corrupt');
        s.hashes++;if(chain(h.d,m,bytes)!==m.root) fail('segment-root-corrupt');
        if(m.hasSeal&&(!exact(m.seal,['totalBytes','root'])||m.seal.totalBytes!==pin.total||m.seal.root!==pin.root)) fail('seal-corrupt');
        const payload=Buffer.from(bytes);s.outputCopyBytes+=payload.length;
        segments.push({ordinal,offset,length:m.length,root:m.root,payload});
        total=add(total,m.length);offset=add(offset,m.length);previous=m.root;ordinal++;
      }
      if(ordinal>pin.ordinal&&(previous!==pin.root||offset!==pin.total)) fail('pinned-root-mismatch');
      s.outputBytes=add(total,utf8(JSON.stringify(segments.map(({payload,...m})=>m))),256);
      return {status:'page',segments,payloadBytes:total,throughHead,
        nextCursor:ordinal<=pin.ordinal?{captureIdentity:{...captureIdentity},throughHead,afterOrdinal:ordinal-1}:null};
    } catch(e) {return {status:'refused',reason:e.message};}
    finally {image.observe=null;}
  }
  async function recover({scope,cursor=null,maxHeads=16,maxBytes=LIMIT.page}) {
    const s=start('recover');
    try {
      live();
      if(!str(scope,128)||!scope.length||!int(maxHeads)||maxHeads<1||!int(maxBytes)||maxBytes<1||maxBytes>LIMIT.page) fail('recover-invalid');
      if(image.fault==='fresh-read') {image.fault=null;fail('fresh-read-failed');}
      s.counterReads++;const high=image.scopes.get(scope)?.highWater??0;
      if(!int(high)) fail('counter-overflow');
      let next=1,W=high;
      if(cursor!==null) {
        const c=untoken('r',cursor);
        if(!exact(c,['scope','W','next'])||c.scope!==scope||!int(c.W)||!int(c.next)||c.next<1||c.W>high||c.next>add(c.W,1)) fail('cursor-invalid');
        ({W,next}=c);
      }
      const heads=[];let headBytes=0;
      const response=position=>({status:'page',heads,watermark:W,nextCursor:position<=W?token('r',{scope,W,next:position}):null});
      const responseBytes=(position,bytes)=>add(utf8(JSON.stringify({...response(position),heads:[]})),bytes);
      while(next<=W&&s.indexPositions<Math.min(maxHeads,LIMIT.positions)) {
        s.indexPositions++;const ix=image.indices.get(keyOf(scope,String(next)));
        if(!ix||ix.version!==1||ix.sequence!==next) fail('index-missing-or-corrupt');
        const h=checkHead(readHead(ix.key,s));
        if(h.d.value.scope!==scope||h.sequence!==next||keyOf(scope,h.d.value.run)!==ix.key) fail('index-binding');
        const item={captureIdentity:{scope,run:h.d.value.run},descriptor:JSON.parse(h.d.text),head:{...h.head},
          sealed:h.head.sealed,acknowledgement:'simulated-commit'};
        const size=utf8(JSON.stringify(item));
        const candidateBytes=add(headBytes,size,heads.length?1:0),required=responseBytes(next+1,candidateBytes);
        if(required>maxBytes) {
          if(!heads.length) return {status:'refused',reason:'page-budget-too-small',required};
          break;
        }
        heads.push(item);headBytes=candidateBytes;next++;
      }
      const result=response(next);
      s.outputBytes=utf8(JSON.stringify(result));s.outputCopyBytes=s.outputBytes;
      if(s.outputBytes>maxBytes)return {status:'refused',reason:'page-budget-too-small',required:s.outputBytes};return result;
    } catch(e) {return {status:'refused',reason:e.message};}
    finally {image.observe=null;}
  }
  return {appendSegment,readSegments,recover,copyRequest,get last(){return last;}};
}
module.exports={LIMIT,ZERO,FORMAT,hash,add,descriptor,chain,validate,prepare,createImage,reset,makeAdapter,keyOf,segmentKey,metadataCharges};
