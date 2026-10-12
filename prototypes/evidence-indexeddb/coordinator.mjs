import * as C from './contract.mjs';
// A context reader is used only before/after async storage, never inside an IDB transaction.
// This module deliberately accepts no completion, navigation, reward or retirement callback.
export function createCoordinator(adapter,readContext){
  let busy=false,retryContext=null;
  const valid=c=>c&&C.str(c.scope,128)&&c.scope.length>0&&C.int(c.generation)&&C.str(c.sourceIdentity,4096)&&c.sourceIdentity.length>0;
  const same=(a,b)=>valid(a)&&valid(b)&&a.scope===b.scope&&a.generation===b.generation&&a.sourceIdentity===b.sourceIdentity;
  const current=context=>{try{return same(context,readContext());}catch{return false;}};
  async function send(request,context,retrying){
    if(busy)return {status:'refused',reason:'busy'};
    if(!current(context))return {status:'refused',reason:'stale-context'};
    busy=true;
    try{
      const result=await (retrying?adapter.retry(()=>current(context)):adapter.appendSegment(request,()=>current(context)));
      if(result.status==='outcomeUnknown')retryContext=context;
      else if(retrying&&adapter.retainedBytes===0)retryContext=null;
      return {...result,contextCurrent:current(context)};
    }finally{busy=false;}
  }
  return Object.freeze({
    appendSegment(request,context){
      if(busy||retryContext)return Promise.resolve({status:'refused',reason:busy?'busy':'retry-pending'});
      if(!current(context)||request?.descriptor?.scope!==context.scope)return Promise.resolve({status:'refused',reason:'stale-context'});
      return send(request,{scope:context.scope,generation:context.generation,sourceIdentity:context.sourceIdentity},false);
    },
    retry(){return retryContext?send(null,retryContext,true):Promise.resolve({status:'refused',reason:'no-retry'});},
    readSegments:request=>adapter.readSegments(request),recover:request=>adapter.recover(request),
    get retainedBytes(){return adapter.retainedBytes;},get inFlight(){return busy;},
  });
}
export async function archive({coordinator,descriptor,bytes,context,admit,segmentBytes=C.LIMIT.payload}){
  let d;try{d=C.describe(descriptor);C.boundedBytes(bytes,C.LIMIT.quota);}catch(e){return {status:'refused',reason:e.message};}
  if(bytes.length!==d.total||!C.int(segmentBytes)||segmentBytes<1||segmentBytes>C.LIMIT.payload)return {status:'refused',reason:'artifact-invalid'};
  // Whole-artifact assembly ownership is separate from the realm operation reservation.
  bytes=new Uint8Array(bytes);descriptor=d.value;context={...context};
  const checked=admit(bytes,descriptor);if(!checked?.ok)return {status:'refused',reason:checked?.error||'admission-refused'};
  d=await C.descriptor(descriptor);let head=null,root=C.ZERO,ordinal=0;
  for(let offset=0;offset<bytes.length;offset+=segmentBytes){
    const payload=bytes.subarray(offset,Math.min(bytes.length,offset+segmentBytes));
    const q={descriptor,expectedHead:head,ordinal,offset,previousRoot:root,payload};root=await C.chain(d,q,payload);
    if(offset+payload.length===bytes.length)q.seal={totalBytes:bytes.length,root};
    const result=await coordinator.appendSegment(q,context);
    if(!['committed','duplicate'].includes(result.status)||!result.contextCurrent)return result;
    head=result.currentHead.token;ordinal++;
  }
  return {status:'archived',head,segments:ordinal,assemblySnapshotBytes:bytes.length,acknowledgement:'idb-transaction-complete',durability:'strict'};
}
export async function assemble(adapter,item,maxBytes){
  const d=C.describe(item.descriptor),n=item.head.total;
  if(!item.head.sealed||!C.int(maxBytes)||maxBytes<1||maxBytes>C.LIMIT.quota||n!==d.total||n>maxBytes)C.fail('assembly-limit-or-incomplete');
  const out=new Uint8Array(n);let cursor={captureIdentity:{...item.captureIdentity},throughHead:item.head.token},offset=0,pages=0,peakPage=0;
  do{const page=await adapter.readSegments({...cursor,maxBytes:C.LIMIT.page});if(page.status!=='page')C.fail(page.reason);pages++;peakPage=Math.max(peakPage,page.payloadBytes);
    for(const segment of page.segments){if(segment.offset!==offset)C.fail('assembly-offset');out.set(segment.payload,offset);offset+=segment.length;}cursor=page.nextCursor;
  }while(cursor);
  if(offset!==n)C.fail('assembly-length');return {bytes:out,pages,assemblyAllocatedBytes:n,modeledAssemblyPeakBytes:C.add(n,peakPage)};
}
