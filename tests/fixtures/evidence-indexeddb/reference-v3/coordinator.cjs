'use strict';
const S=require('./store.cjs');
// The coordinator accepts a storage adapter and a live context reader, never a controller callback.
function createCoordinator(adapter,readContext) {
  let busy=false,retry=null,retainedBytes=0;
  const valid=c=>c&&typeof c.scope==='string'&&c.scope.length>0&&c.scope.length<=128&&Number.isSafeInteger(c.generation)&&
    c.generation>=0&&typeof c.sourceIdentity==='string'&&c.sourceIdentity.length>0&&c.sourceIdentity.length<=4096;
  const same=(a,b)=>valid(a)&&valid(b)&&a.scope===b.scope&&a.generation===b.generation&&a.sourceIdentity===b.sourceIdentity;
  async function send(saved) {
    if(busy)return {status:'refused',reason:'busy'};
    if(!same(saved.context,readContext())){if(saved!==retry){saved.release();retainedBytes=0;}return {status:'refused',reason:'stale-context'};}
    busy=true;
    try {
      const result=await adapter.appendSegment(saved.request);
      if(result.status==='outcomeUnknown')retry=saved;
      else {retry=null;saved.release();}
      retainedBytes=retry?saved.requestBytes:0;
      return {...result,contextCurrent:same(saved.context,readContext())};
    } catch(e) {retry=saved;retainedBytes=saved.requestBytes;return {status:'outcomeUnknown',reason:'adapter-threw',contextCurrent:same(saved.context,readContext())};}
    finally {busy=false;}
  }
  return {
    async appendSegment(request,context) {
      if(busy||retry)return {status:'refused',reason:busy?'busy':'retry-pending'};
      if(!same(context,readContext())||request.descriptor?.scope!==context?.scope)return {status:'refused',reason:'stale-context'};
      let saved;try {saved=adapter.copyRequest(request);}catch(e){return {status:'refused',reason:e.message};}
      saved.context={...context};retainedBytes=saved.requestBytes;
      return send(saved);
    },
    retry() {return retry?send(retry):Promise.resolve({status:'refused',reason:'no-retry'});},
    readSegments:request=>adapter.readSegments(request),recover:request=>adapter.recover(request),
    get retainedBytes(){return retainedBytes;},get inFlight(){return busy;}
  };
}
function frame(components) {
  if(!Array.isArray(components)||components.length<1||components.length>8)throw Error('components-invalid');
  let size=12;const parts=[];
  for(const c of components) {
    if(typeof c.text!=='string'||!['utf8','utf16le'].includes(c.encoding))throw Error('encoding-invalid');
    const length=Buffer.byteLength(c.text,c.encoding);size=S.add(size,8,length);
    if(size>S.LIMIT.quota)throw Error('artifact-limit');parts.push({name:c.name,encoding:c.encoding,length});
  }
  if(parts.every(c=>c.length===0))throw Error('empty-artifact');
  const out=Buffer.alloc(size);out.write('ARCHIVE1');out.writeUInt32LE(parts.length,8);let offset=12;
  for(let i=0;i<parts.length;i++) {out.writeBigUInt64LE(BigInt(parts[i].length),offset);offset+=8;
    out.write(components[i].text,offset,parts[i].length,parts[i].encoding);offset+=parts[i].length;}
  return {bytes:out,components:parts,assemblyAllocatedBytes:size};
}
function unframe(bytes,descriptor) {
  const d=S.descriptor(descriptor);if(bytes.length!==d.total||bytes.length<12||bytes.subarray(0,8).toString()!=='ARCHIVE1'||
    bytes.readUInt32LE(8)!==d.value.components.length)throw Error('frame-invalid');
  let offset=12;const components=[];
  for(const c of d.value.components) {
    if(offset+8>bytes.length||bytes.readBigUInt64LE(offset)!==BigInt(c.length))throw Error('frame-length');offset+=8;
    if(offset+c.length>bytes.length||!['utf8','utf16le'].includes(c.encoding)||(c.encoding==='utf16le'&&c.length%2))throw Error('encoding-unsupported');
    const part=bytes.subarray(offset,offset+c.length),text=part.toString(c.encoding);
    if(!Buffer.from(text,c.encoding).equals(part))throw Error('encoding-not-reversible');
    components.push({...c,text});offset+=c.length;
  }
  if(offset!==bytes.length)throw Error('frame-length');return components;
}
async function archive({coordinator,descriptor,bytes,context,admit,segmentBytes=S.LIMIT.payload}) {
  const d=S.descriptor(descriptor);
  if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length!==d.total||!Number.isSafeInteger(segmentBytes)||segmentBytes<1||segmentBytes>S.LIMIT.payload)
    return {status:'refused',reason:'artifact-invalid'};
  // Whole-artifact ownership belongs to bounded assembly/admission, not append I/O.
  bytes=Buffer.from(bytes);descriptor=d.value;context={...context};
  const checked=admit(bytes,descriptor);
  if(!checked?.ok)return {status:'refused',reason:checked?.error||'admission-refused'};
  let head=null,root=S.ZERO,ordinal=0;
  for(let offset=0;offset<bytes.length;offset+=segmentBytes) {
    const payload=bytes.subarray(offset,Math.min(bytes.length,offset+segmentBytes));
    const q={descriptor,expectedHead:head,ordinal,offset,previousRoot:root,payload};root=S.chain(d,q,payload);
    if(offset+payload.length===bytes.length)q.seal={totalBytes:bytes.length,root};
    const result=await coordinator.appendSegment(q,context);
    if(!['committed','duplicate'].includes(result.status)||!result.contextCurrent)return result;
    head=result.currentHead.token;ordinal++;
  }
  return {status:'archived',head,segments:ordinal,assemblySnapshotBytes:bytes.length,acknowledgement:'simulated-commit'};
}
async function assemble(adapter,item,maxBytes) {
  const d=S.descriptor(item.descriptor),n=item.head.total;
  if(!item.head.sealed||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>S.LIMIT.quota||n!==d.total||n>maxBytes)throw Error('assembly-limit-or-incomplete');
  const out=Buffer.alloc(n);let cursor={captureIdentity:item.captureIdentity,throughHead:item.head.token},offset=0,pages=0,peakPage=0;
  do {const page=await adapter.readSegments({...cursor,maxBytes:S.LIMIT.page});
    if(page.status!=='page')throw Error(page.reason);pages++;peakPage=Math.max(peakPage,page.payloadBytes);
    for(const segment of page.segments){out.set(segment.payload,offset);offset+=segment.length;}cursor=page.nextCursor;
  } while(cursor);
  if(offset!==n)throw Error('assembly-length');
  return {bytes:out,pages,assemblyAllocatedBytes:n,modeledAssemblyPeakBytes:S.add(n,peakPage)};
}
module.exports={createCoordinator,frame,unframe,archive,assemble};
