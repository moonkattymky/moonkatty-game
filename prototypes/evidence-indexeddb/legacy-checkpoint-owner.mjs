// SOURCE ONLY. A closed disposable guest checkpoint, one native WAIT, two
// selecting owner revisions. No localStorage, rewards, queues or live entrypoint.
import * as C from './contract.mjs';
import {freezeFinaleData,measureFinaleData} from './finale-context-v1.mjs';
import {requirePhaseBudget} from './phase-budget.mjs';
import * as L from './legacy-adoption-codec.mjs';
export const LEGACY_OWNER_CONTRACT='legacy-checkpoint-owner-v1';
export const LEGACY_OWNER_LIMIT=Object.freeze({slot:16384,slots:2,record:4096,retained:32768,workspace:65536,page:32768,bridge:32768});
const M=LEGACY_OWNER_LIMIT,HEAD=['version','binding','ordinal','total','root','sealed','token'];
const COMMON=['version','contract','principal','revision'];
const RETRY=new Set(['busy','retry-pending','transaction-aborted','native-quota','logical-quota','open-blocked','open-timeout',
  'operation-timeout','terminal-unobserved','connection-closed','storage-unavailable','indexeddb-unavailable',
  'webcrypto-unavailable','webcrypto-sha256-unavailable','allocation-refused','legacy-owner-readback']);
const fail=reason=>C.fail(reason),equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function legacyOwnerRuns(principal){
  if(typeof principal!=='string'||!/^guest:[A-Za-z0-9_-]{1,64}$/.test(principal))fail('legacy-owner-principal');
  return Object.freeze({source:`lgc1:source:${principal}`,owner:`lgc1:owner:${principal}`,next:`lgc1:next:${principal}`});
}
function reserve(b,label,n){
  const before=b.snapshot().reservations[label];
  if(!Number.isSafeInteger(n)||n<1||b.snapshot().live+n+M.bridge>b.snapshot().ceiling)fail('transient-budget');
  try{b.reserve(label,n);b.allocate(label,n);}catch(error){const delta=b.snapshot().reservations[label]-before;if(delta>0)try{b.release(label,delta);}catch{}throw error;}
}
function makeDescriptor(scope,run,kind,bytes){return freezeFinaleData({format:C.FORMAT,scope,run,
  kind:`legacy-checkpoint-${kind}`,model:kind==='owner'?LEGACY_OWNER_CONTRACT:`legacy-${kind==='source'?'source':'wait'}-v1`,
  components:[{name:kind==='owner'?'owner-log':`legacy-${kind==='source'?'source':'wait'}-v1`,encoding:kind==='next'?'utf16le':'opaque',length:bytes-20}],note:''});}
export function createLegacyCheckpointOwner({adapter,scope,principal,epoch,readContext,admissionGuards,FieldRules,budget,crypto=globalThis.crypto}){
  requirePhaseBudget(budget);const runs=legacyOwnerRuns(principal),observation=L.validateLegacyGuards(admissionGuards);
  if(!C.str(scope,128)||!scope||!C.int(epoch)||epoch<1||observation.principal!==principal||observation.epoch!==epoch||
    typeof readContext!=='function'||adapter?.scope!==scope||!['appendSegment','retry','readSegments','recover'].every(k=>typeof adapter[k]==='function')||
    !FieldRules||typeof FieldRules.restore!=='function'||typeof FieldRules.act!=='function')fail('legacy-owner-capability');
  const guards=freezeFinaleData({...admissionGuards,cloudRaw:{...admissionGuards.cloudRaw}}),identity=Object.freeze({scope,principal,epoch});
  const ownerDescriptor=makeDescriptor(scope,runs.owner,'owner',M.slot*M.slots);
  reserve(budget,'atomic-retained',M.retained);
  let state='NEW',reason=null,busy=false,disposed=false,invalidated=false,head=null,sourcePin=null,nextPin=null;
  let sourceCap=null,nextCap=null,preflight=null,intent=null,lastDispatch=null,unknown=false,reconciliation=null,incoming=null;
  const retainedFrames=new Map(),metadataFrames=new Map();
  function account(...extra){
    const bytes=measureFinaleData([identity,guards,runs,ownerDescriptor,head,sourcePin,nextPin,intent,lastDispatch,reconciliation,incoming,...retainedFrames.values(),...extra],M.retained,{restrictedKeys:true});
    budget.allocate('atomic-retained',M.retained);budget.event('legacy-owner-retained',{bytes,limit:M.retained});
  }
  function hold(name,value){retainedFrames.set(name,value);account();}
  function metadata(name,value){
    metadataFrames.set(name,value);const bytes=measureFinaleData([...metadataFrames.values()],16384,{restrictedKeys:true})+16384;
    // The remaining 16KiB covers fixed descriptor/head validation, two small
    // descriptor JSON comparison strings and synchronous token/record scaffolds.
    budget.allocate('metadata',32768);budget.event('legacy-owner-metadata',{bytes,limit:32768});
  }
  function current(){
    if(disposed||invalidated)return false;
    // No external read may run inside the codec's synchronous six-slab parse.
    if(budget.snapshot().reservations['callback-scratch'])fail('legacy-owner-guard-during-parse');
    let c;try{c=readContext(sourceCap);}catch{invalidated=true;return false;}
    if(!C.exact(c,['scope','principal','epoch','sourceUnchanged'])||c.scope!==scope||c.principal!==principal||c.epoch!==epoch||c.sourceUnchanged!==true)invalidated=true;
    return !invalidated;
  }
  function ensure(){if(!current())fail('stale-context');}
  async function checked(work,readOnly=false){if(!readOnly)ensure();const result=await work();if(!readOnly)ensure();return result;}
  function hashAccount(){return {
    reserve(_label,n){if(n>M.page+512)fail('legacy-owner-hash-limit');reserve(budget,'helper-framing',n);},
    release(_label,n){budget.release('helper-framing',n);},
    reserveHash(n,text){if(n>(text?4096:M.page+512))fail('legacy-owner-hash-limit');reserve(budget,'helper-hash',n*(text?2:1));},
    releaseHash(n,text){budget.release('helper-hash',n*(text?2:1));},hash(){},
  };}
  const hashes=hashAccount();
  const descriptor=(kind,bytes)=>kind==='owner'?ownerDescriptor:makeDescriptor(scope,runs[kind],kind,bytes);
  function info(cap,kind){L.assertLegacyBudget(cap,budget);const i=kind==='source'?L.legacyInfo(cap):L.nextInfo(cap);
    if(i.principal!==principal||i.epoch!==epoch||!C.int(i.byteLength)||i.byteLength<20||i.byteLength>(kind==='source'?65536:8212))fail('legacy-owner-capsule');return i;}
  function pinShape(pin,kind){
    if(!C.exact(pin,['descriptor','head'])||!C.exact(pin.head,HEAD))fail('legacy-owner-pin');
    const d=C.describe(pin.descriptor),h=pin.head,bytes=d.total;
    if(!equal(pin.descriptor,descriptor(kind,bytes))||h.version!==1||!C.hex(h.binding)||!C.hex(h.root)||!C.str(h.token,2048)||
      !C.int(h.ordinal)||!C.int(h.total)||typeof h.sealed!=='boolean')fail('legacy-owner-pin');
    if(kind==='owner'){
      if(h.ordinal>=2||h.total!==(h.ordinal+1)*M.slot||h.sealed!==(h.ordinal===1))fail('legacy-owner-pin');
    }else{
      const max=kind==='source'?65536:8212;
      if(bytes<20||bytes>max||h.ordinal>=Math.ceil(bytes/M.page)||h.total!==Math.min((h.ordinal+1)*M.page,bytes)||h.sealed!==(h.total===bytes))fail('legacy-owner-pin');
    }
    return freezeFinaleData({descriptor:d.value,head:{...h}});
  }
  async function authenticate(pin,kind,readOnly=false){
    pinShape(pin,kind);const d=await checked(()=>C.descriptor(pin.descriptor,crypto,hashes),readOnly);
    const h=await checked(()=>C.headToken(pin.head.token,crypto,hashes),readOnly);
    if(d.binding!==pin.head.binding||['binding','ordinal','total','root','sealed'].some(k=>h[k]!==pin.head[k]))fail('legacy-owner-pin');return d;
  }
  const compact=pin=>freezeFinaleData({bytes:C.describe(pin.descriptor).total,headToken:pin.head.token});
  async function expand(value,kind,readOnly=false){
    if(!C.exact(value,['bytes','headToken'])||!C.int(value.bytes)||!C.str(value.headToken,2048))fail('legacy-owner-compact-pin');
    const h=await checked(()=>C.headToken(value.headToken,crypto,hashes),readOnly);
    const pin=pinShape({descriptor:descriptor(kind,value.bytes),head:{version:1,...h,token:value.headToken}},kind);
    if(!pin.head.sealed)fail('legacy-owner-unsealed-dependency');await authenticate(pin,kind,readOnly);return pin;
  }
  function view(){return Object.freeze({state,reason,busy,revision:head?.head.ordinal??null,head,
    retryEnabled:state==='UNSAVED'&&!busy&&!invalidated,resumeEnabled:(state==='ACTIVE'||state==='SAVED')&&!busy&&!invalidated,
    invalidated,reconciliation,budget:budget.snapshot(),jointPeak:budget.snapshot().peak+M.bridge});}
  async function catalog(readOnly=false){
    const found={},seen=new Set(),cursors=new Set();let cursor=null,watermark=null,count=0;
    hold('catalog',found);try{do{
      metadata('catalog',{cursor,watermark,count,cursors:[...cursors],seen:[...seen]});
      reserve(budget,'returned-page',M.page);
      try{
        const page=await checked(()=>adapter.recover({scope,cursor,maxHeads:1,maxBytes:M.page}),readOnly);
        if(page?.status!=='page')fail(page?.reason||'legacy-owner-catalog');
        if(!C.exact(page,['status','heads','watermark','nextCursor'])||!Array.isArray(page.heads)||page.heads.length>1||!C.int(page.watermark)||page.watermark>3||
          page.nextCursor!==null&&!C.str(page.nextCursor,2048))fail('legacy-owner-catalog');
        if(watermark===null)watermark=page.watermark;else if(watermark!==page.watermark)fail('legacy-owner-catalog');
        if(page.heads.length!==(watermark===0?0:1)||watermark===0&&(count!==0||page.nextCursor!==null))fail('legacy-owner-catalog');
        for(const item of page.heads){
          if(!C.exact(item,['captureIdentity','descriptor','head','sealed','acknowledgement','durability'])||!C.exact(item.captureIdentity,['scope','run'])||
            item.captureIdentity.scope!==scope||item.captureIdentity.run!==item.descriptor?.run||item.sealed!==item.head?.sealed||
            item.acknowledgement!=='idb-transaction-complete'||item.durability!=='strict')fail('legacy-owner-catalog');
          const kind=Object.keys(runs).find(k=>runs[k]===item.captureIdentity.run);
          if(!kind||seen.has(kind))fail('legacy-owner-scope-not-isolated');seen.add(kind);count++;
          found[kind]=pinShape({descriptor:item.descriptor,head:item.head},kind);
        }
        if(page.nextCursor!==null){if(cursors.has(page.nextCursor)||count>=watermark)fail('legacy-owner-catalog');cursors.add(page.nextCursor);}
        else if(count!==watermark)fail('legacy-owner-catalog');cursor=page.nextCursor;account();
      }finally{budget.release('returned-page',M.page);}
    }while(cursor!==null);
    return found;
    }finally{retainedFrames.delete('catalog');metadataFrames.delete('catalog');}
  }
  async function readPages(pin,kind,onPart,readOnly=false){
    const d=await authenticate(pin,kind,readOnly),size=kind==='owner'?M.slot:M.page;let root=C.ZERO,offset=0;
    metadata('reader',{descriptor:d,page:null});try{for(let ordinal=0;ordinal<=pin.head.ordinal;ordinal++){
      reserve(budget,'returned-page',size);
      try{
        const page=await checked(()=>adapter.readSegments({captureIdentity:{scope,run:runs[kind]},throughHead:pin.head.token,afterOrdinal:ordinal-1,maxBytes:size}),readOnly);
        if(page?.status!=='page')fail(page?.reason||'legacy-owner-readback');
        if(!C.exact(page,['status','segments','payloadBytes','throughHead','nextCursor'])||page.throughHead!==pin.head.token||!Array.isArray(page.segments)||page.segments.length!==1)fail('legacy-owner-readback');
        const p=page.segments[0],n=Math.min(size,pin.head.total-offset);
        if(!C.exact(p,['ordinal','offset','length','root','payload'])||p.ordinal!==ordinal||p.offset!==offset||p.length!==n||page.payloadBytes!==n||!C.hex(p.root))fail('legacy-owner-readback');
        C.boundedBytes(p.payload,size);if(p.payload.length!==n)fail('legacy-owner-readback');
        if(ordinal===pin.head.ordinal?page.nextCursor!==null:!C.exact(page.nextCursor,['captureIdentity','throughHead','afterOrdinal'])||
          !C.exact(page.nextCursor.captureIdentity,['scope','run'])||page.nextCursor.captureIdentity.scope!==scope||page.nextCursor.captureIdentity.run!==runs[kind]||
          page.nextCursor.throughHead!==pin.head.token||page.nextCursor.afterOrdinal!==ordinal)fail('legacy-owner-readback');
        metadata('reader',{descriptor:d,page:{throughHead:page.throughHead,nextCursor:page.nextCursor,payloadBytes:page.payloadBytes,ordinal:p.ordinal,offset:p.offset,length:p.length,root:p.root}});
        // Keep this returned native page charged across its final digest await.
        const next=await checked(()=>C.chain(d,{ordinal,offset,previousRoot:root},p.payload,crypto,hashes),readOnly);
        if(next!==p.root)fail('legacy-owner-chain');root=next;onPart(p.payload,offset,ordinal);offset+=n;
      }finally{budget.release('returned-page',size);}
    }
    if(offset!==pin.head.total||root!==pin.head.root)fail('legacy-owner-chain');
    }finally{metadataFrames.delete('reader');}
  }
  function recordShape(record,revision){
    measureFinaleData([record],M.record,{restrictedKeys:true});
    const keys=revision===0?[...COMMON,'origin','source']:[...COMMON,'command','sourceHead','checkpoint','previousHead'];
    if(!C.exact(record,keys)||record.version!==1||record.contract!==LEGACY_OWNER_CONTRACT||record.principal!==principal||record.revision!==revision||
      (revision===0?record.origin!=='closed-original-field-guest-fixture':record.command!=='native-wait'||!C.str(record.sourceHead,2048)||!C.str(record.previousHead,2048)))fail('legacy-owner-record');
    const pin=revision===0?record.source:record.checkpoint;
    if(!C.exact(pin,['bytes','headToken'])||!C.int(pin.bytes)||!C.str(pin.headToken,2048))fail('legacy-owner-record');return record;
  }
  function encodeRecord(record,ordinal){
    recordShape(record,ordinal);budget.allocate('atomic-record-workspace',M.workspace);
    const text=JSON.stringify(record),start=ordinal===0?20:0,payload=new Uint8Array(M.slot),dv=new DataView(payload.buffer);
    if(text.length*2>M.record)fail('legacy-owner-record-limit');
    if(ordinal===0){payload.set(C.utf8('ARCHIVE1'));dv.setUint32(8,1,true);dv.setBigUint64(12,BigInt(M.slot*2-20),true);}
    payload.set([76,71,79,49],start);dv.setUint32(start+4,text.length*2,true);
    for(let i=0;i<text.length;i++)dv.setUint16(start+8+i*2,text.charCodeAt(i),true);
    budget.event('legacy-owner-record-encoded',{revision:ordinal,bytes:text.length*2,slot:M.slot});return payload;
  }
  function decodeRecord(payload,ordinal){
    const start=ordinal===0?20:0,dv=new DataView(payload.buffer,payload.byteOffset,payload.byteLength);
    if(payload.length!==M.slot||ordinal===0&&(!C.equalBytes(payload.subarray(0,8),C.utf8('ARCHIVE1'))||dv.getUint32(8,true)!==1||dv.getBigUint64(12,true)!==BigInt(M.slot*2-20))||
      [76,71,79,49].some((v,i)=>payload[start+i]!==v))fail('legacy-owner-record-frame');
    const n=dv.getUint32(start+4,true);if(n<2||n%2||n>M.record)fail('legacy-owner-record-limit');
    for(let i=start+8+n;i<payload.length;i++)if(payload[i]!==0)fail('legacy-owner-record-padding');
    let text='';for(let i=0;i<n;i+=2)text+=String.fromCharCode(dv.getUint16(start+8+i,true));
    let record;try{record=JSON.parse(text);}catch{fail('legacy-owner-record-json');}
    recordShape(record,ordinal);if(JSON.stringify(record)!==text)fail('legacy-owner-record-noncanonical');return freezeFinaleData(record);
  }
  async function readRecords(pin,readOnly=false){
    reserve(budget,'atomic-record-workspace',M.workspace);
    try{const records=[];await readPages(pin,'owner',(payload,_offset,ordinal)=>{records.push(decodeRecord(payload,ordinal));},readOnly);incoming=records;account();return records;}
    finally{budget.release('atomic-record-workspace',M.workspace);}
  }
  async function verifyArchive(pin,kind,cap,readOnly=false){
    const expected=info(cap,kind);if(C.describe(pin.descriptor).total!==expected.byteLength)fail('legacy-owner-source-conflict');
    await readPages(pin,kind,(payload,offset)=>{if(!(kind==='source'?L.compareLegacyRange(cap,offset,payload):L.compareNextRange(cap,offset,payload)))fail('legacy-owner-source-conflict');},readOnly);
  }
  async function decodeArchive(pin,kind){
    if(budget.snapshot().reservations['reload-phase-retained'])fail('legacy-owner-cold-recovery-with-controller');
    const bytes=C.describe(pin.descriptor).total;reserve(budget,'context-parse',bytes);let frame=null,cap=null,error,failed=false;
    try{
      frame=new Uint8Array(bytes);await readPages(pin,kind,(payload,offset)=>frame.set(payload,offset));
      ensure();
      // Do not publish a new B/N capability through a potentially throwing frame
      // release. Until cleanup succeeds, this function still owns the output.
      cap=kind==='source'?L.decodeLegacyBundle(frame,guards,FieldRules,budget):L.decodeLegacyWait(frame,sourceCap,FieldRules,budget);
    }catch(e){error=e;failed=true;}
    finally{frame=null;try{budget.release('context-parse',bytes);}catch(e){if(!failed){error=e;failed=true;}}}
    if(failed){if(cap)try{L.disposeLegacy(cap);}catch{}throw error;}return cap;
  }
  async function refresh(){
    incoming=null;try{
    const found=await catalog(),frame={found,initial:null,selected:null};hold('refresh',frame);if(!found.owner){if(head||found.next||intent?.kind==='wait')fail('legacy-owner-missing-owner');head=null;sourcePin=null;nextPin=null;state='NEW';return false;}
    if(head&&(found.owner.head.ordinal<head.head.ordinal||found.owner.head.ordinal===head.head.ordinal&&found.owner.head.token!==head.head.token))fail('legacy-owner-head-regression');
    const records=await readRecords(found.owner),first=records[0],initial=await expand(first.source,'source');frame.initial=initial;account();
    if(!found.source||found.source.head.token!==initial.head.token||!equal(found.source.descriptor,initial.descriptor))fail('legacy-owner-missing-source');
    delete found.source;account();
    if(sourceCap)await verifyArchive(initial,'source',sourceCap);else sourceCap=await decodeArchive(initial,'source');
    // The archived source is now available to the host's native equality guard.
    ensure();let selected=null;
    if(found.owner.head.ordinal===1){
      const second=records[1];
      const d=await checked(()=>C.descriptor(ownerDescriptor,crypto,hashes));metadata('refresh-descriptor',d);
      const firstPayloadRoot=await ownerFirstRoot(first,d);
      const prior=await checked(()=>C.makeHead(d,0,M.slot,firstPayloadRoot,false,crypto,hashes));metadataFrames.delete('refresh-descriptor');
      if(second.sourceHead!==initial.head.token||second.previousHead!==prior.token)fail('legacy-owner-revision-binding');
      selected=await expand(second.checkpoint,'next');frame.selected=selected;account();
      if(!found.next||found.next.head.token!==selected.head.token||!equal(found.next.descriptor,selected.descriptor))fail('legacy-owner-missing-next');
      delete found.next;account();
      if(nextCap)await verifyArchive(selected,'next',nextCap);else{if(preflight){const prior=preflight;preflight=null;L.disposeLegacy(prior);}nextCap=await decodeArchive(selected,'next');}ensure();
    }
    head=found.owner;sourcePin=initial;nextPin=selected;delete found.owner;frame.initial=null;frame.selected=null;state=selected?'SAVED':'ACTIVE';reason=null;account();return true;
    }finally{incoming=null;retainedFrames.delete('refresh');metadataFrames.delete('refresh-descriptor');}
  }
  async function ownerFirstRoot(record,d){
    reserve(budget,'atomic-record-workspace',M.workspace);
    try{const payload=encodeRecord(record,0);return await checked(()=>C.chain(d,{ordinal:0,offset:0,previousRoot:C.ZERO},payload,crypto,hashes));}
    finally{budget.release('atomic-record-workspace',M.workspace);}
  }
  function receiptMatches(result,pin,kind,length){
    const r=result.receipt,h=result.currentHead;
    try{pinShape({descriptor:pin.descriptor,head:h},kind);}catch{return false;}
    return C.exact(r,['captureIdentity','ordinal','length','root','headToken','sealed','acknowledgement','durability'])&&
      C.exact(r.captureIdentity,['scope','run'])&&r.captureIdentity.scope===scope&&r.captureIdentity.run===runs[kind]&&r.ordinal===pin.head.ordinal&&r.length===length&&
      r.root===pin.head.root&&r.headToken===pin.head.token&&r.sealed===pin.head.sealed&&r.acknowledgement==='idb-transaction-complete'&&r.durability==='strict'&&
      C.exact(h,HEAD)&&h.binding===pin.head.binding&&C.int(h.ordinal)&&h.ordinal>=pin.head.ordinal&&h.ordinal<(kind==='next'?1:2)&&
      (h.ordinal!==pin.head.ordinal||h.token===pin.head.token);
  }
  async function dispatch(q,pin,kind,record=null){
    ensure();lastDispatch=freezeFinaleData({kind,pin,length:q.payload.length,record});account();
    const result=await adapter.appendSegment(q,current);unknown=result?.status==='outcomeUnknown'||adapter.retainedBytes>0;
    if(!current())fail('stale-context');
    if(result?.status==='outcomeUnknown'){if(!adapter.retainedBytes)fail('legacy-owner-retry-capability');fail('terminal-unobserved');}
    if(['committed','duplicate'].includes(result?.status)){
      if(adapter.retainedBytes||!receiptMatches(result,pin,kind,q.payload.length))fail('legacy-owner-acknowledgement');lastDispatch=null;account();return result;
    }
    if(result?.status==='conflict')fail('legacy-owner-contention');fail(result?.reason||'legacy-owner-storage-result');
  }
  async function writeArchive(kind,cap){
    const bytes=info(cap,kind).byteLength,desc=descriptor(kind,bytes),d=await checked(()=>C.descriptor(desc,crypto,hashes));
    let pin=null,root=C.ZERO;metadata('archive-writer',{descriptor:d,request:null});try{
    for(let offset=0,ordinal=0;offset<bytes;ordinal++){
      const n=Math.min(M.page,bytes-offset);reserve(budget,'stream-candidate',n);
      try{
        const payload=kind==='source'?L.copyLegacyRange(cap,offset,n,budget):L.copyNextRange(cap,offset,n,budget);
        const q={descriptor:desc,expectedHead:pin?.head.token??null,ordinal,offset,previousRoot:root,payload};
        metadata('archive-writer',{descriptor:d,request:{expectedHead:q.expectedHead,ordinal,offset,previousRoot:root}});
        root=await checked(()=>C.chain(d,q,payload,crypto,hashes));const sealed=offset+n===bytes;
        const h=await checked(()=>C.makeHead(d,ordinal,offset+n,root,sealed,crypto,hashes));pin=freezeFinaleData({descriptor:desc,head:h});
        if(sealed)q.seal={totalBytes:bytes,root};await dispatch(q,pin,kind);offset+=n;
      }finally{budget.release('stream-candidate',n);}
    }
    metadataFrames.delete('archive-writer');await verifyArchive(pin,kind,cap);return pin;
    }finally{metadataFrames.delete('archive-writer');}
  }
  async function appendRecord(record,prior){
    const ordinal=prior?1:0;reserve(budget,'atomic-record-workspace',M.workspace);
    try{
      const payload=encodeRecord(record,ordinal),d=await checked(()=>C.descriptor(ownerDescriptor,crypto,hashes));
      const q={descriptor:ownerDescriptor,expectedHead:prior?.head.token??null,ordinal,offset:ordinal*M.slot,previousRoot:prior?.head.root??C.ZERO,payload};
      metadata('record-writer',{descriptor:d,request:{expectedHead:q.expectedHead,ordinal,offset:q.offset,previousRoot:q.previousRoot}});
      const root=await checked(()=>C.chain(d,q,payload,crypto,hashes)),h=await checked(()=>C.makeHead(d,ordinal,(ordinal+1)*M.slot,root,ordinal===1,crypto,hashes));
      if(ordinal===1)q.seal={totalBytes:M.slot*2,root};await dispatch(q,freezeFinaleData({descriptor:ownerDescriptor,head:h}),'owner',record);
    }finally{metadataFrames.delete('record-writer');budget.release('atomic-record-workspace',M.workspace);}
  }
  const base=revision=>({version:1,contract:LEGACY_OWNER_CONTRACT,principal,revision});
  function completed(){intent=null;unknown=false;reason=null;lastDispatch=null;account();}
  async function persist(){
    const existing=await refresh();
    if(intent.kind==='adopt'){
      if(existing){completed();return;}
      sourcePin=await writeArchive('source',sourceCap);
      let record=freezeFinaleData({...base(0),origin:'closed-original-field-guest-fixture',source:compact(sourcePin)});
      await appendRecord(record,null);record=null;await refresh();if(!head)fail('legacy-owner-readback');completed();return;
    }
    if(!existing)fail('legacy-owner-not-adopted');
    if(head.head.ordinal===1){completed();return;}
    if(head.head.token!==intent.previousHead)fail('legacy-owner-contention');
    nextPin=await writeArchive('next',nextCap);
    let record=freezeFinaleData({...base(1),command:'native-wait',sourceHead:sourcePin.head.token,checkpoint:compact(nextPin),previousHead:head.head.token});
    await appendRecord(record,head);record=null;await refresh();if(head?.head.ordinal!==1)fail('legacy-owner-readback');completed();
  }
  async function reconcile(){
    state='QUARANTINED';reason='stale-context';reconciliation={status:'pending',proposal:null,revision:null};
    if(adapter.physicalBusy){reconciliation={...reconciliation,status:'draining'};return;}
    try{
      const found=await catalog(true);hold('reconcile',found);reconciliation={status:'observed',proposal:lastDispatch?'absent':null,revision:found.owner?.head.ordinal??null};
      if(lastDispatch){const {kind,pin,record}=lastDispatch,visible=found[kind];
        if(visible&&visible.head.binding===pin.head.binding&&visible.head.ordinal>=pin.head.ordinal){
          if(kind==='owner'){
            const records=await readRecords(pin,true);if(!equal(records[pin.head.ordinal],record))fail('legacy-owner-proposal-mismatch');
          }else await verifyArchive(pin,kind,kind==='source'?sourceCap:nextCap,true);
          reconciliation={...reconciliation,proposal:'committed'};
        }
      }
    }catch(error){reconciliation={...reconciliation,status:'unresolved',reason:error?.message||'legacy-owner-reconcile'};}
    incoming=null;retainedFrames.delete('reconcile');account();
  }
  async function execute(work){
    if(disposed||busy)return view();busy=true;reason=null;
    try{ensure();await work();ensure();}
    catch(error){reason=error instanceof RangeError?'allocation-refused':error?.message||'legacy-owner-storage-result';
      if(invalidated)await reconcile();else state=RETRY.has(reason)?'UNSAVED':'BLOCKED';}
    finally{busy=false;}return view();
  }
  function adopt(cap){
    if(disposed||busy)return Promise.resolve(view());
    try{info(cap,'source');if(sourceCap&&sourceCap!==cap)fail('legacy-owner-candidate-pending');if(!sourceCap)sourceCap=cap;
      if(intent&&intent.kind!=='adopt')fail('legacy-owner-candidate-pending');intent??=freezeFinaleData({kind:'adopt'});account();}
    catch(error){reason=error?.message||'legacy-owner-failure';state='BLOCKED';return Promise.resolve(view());}
    return execute(persist);
  }
  function prepareWait(){
    if(disposed||busy||state!=='ACTIVE'||head?.head.ordinal!==0||intent)fail('legacy-owner-not-active');ensure();
    if(!preflight)preflight=L.prepareLegacyWait(sourceCap,FieldRules,budget);ensure();return Object.freeze({ready:true,revision:0,head:head.head.token});
  }
  function commitWait(actual){
    if(disposed||busy)return Promise.resolve(view());
    if(intent)return Promise.resolve(view());
    try{
      ensure();if(state==='SAVED'&&head?.head.ordinal===1){if(!L.compareNextCheckpoint(nextCap,actual,budget))fail('legacy-owner-candidate-conflict');return Promise.resolve(view());}
      if(state!=='ACTIVE'||head?.head.ordinal!==0)fail('legacy-owner-not-active');if(!preflight)fail('legacy-owner-wait-not-prepared');
      // This immutable capture happens synchronously, before the first await.
      nextCap=L.matchLegacyWait(preflight,actual,budget);L.disposeLegacy(preflight);preflight=null;
      intent=freezeFinaleData({kind:'wait',previousHead:head.head.token});account();
    }catch(error){reason=error?.message||'legacy-owner-failure';state=invalidated?'QUARANTINED':'BLOCKED';return Promise.resolve(view());}
    return execute(persist);
  }
  function retry(){return execute(async()=>{
    if(adapter.physicalBusy)fail('busy');
    if(unknown||adapter.retainedBytes){
      if(!lastDispatch)fail('legacy-owner-retry-identity');ensure();
      const result=await adapter.retry(current);unknown=result?.status==='outcomeUnknown'||adapter.retainedBytes>0;if(!current())fail('stale-context');
      if(result?.status==='outcomeUnknown')fail('terminal-unobserved');
      if(!['committed','duplicate'].includes(result?.status))fail(result?.reason||'legacy-owner-storage-result');
      if(adapter.retainedBytes||!receiptMatches(result,lastDispatch.pin,lastDispatch.kind,lastDispatch.length))fail('legacy-owner-acknowledgement');lastDispatch=null;account();
    }
    if(intent)await persist();else await refresh();
  });}
  function recover(){return execute(async()=>{
    if(adapter.physicalBusy)fail('busy');
    // Read-only even if an exact unknown request remains in the adapter.
    await refresh();if(intent){if(intent.kind==='adopt'&&head||intent.kind==='wait'&&head?.head.ordinal===1){if(!adapter.retainedBytes)completed();else fail('retry-pending');}else fail('retry-pending');}
  });}
  function checkpoint(){if(disposed||busy||!['ACTIVE','SAVED'].includes(state))fail('legacy-owner-not-readable');ensure();return L.controllerCheckpoint(nextPin?nextCap:sourceCap,budget);}
  function rawValue(key){if(disposed||busy||!['ACTIVE','SAVED'].includes(state))fail('legacy-owner-not-readable');ensure();return L.rawValue(sourceCap,key);}
  function dispose(){
    if(busy||adapter.physicalBusy||adapter.retainedBytes)fail('legacy-owner-busy');if(disposed)return;
    let error,failed=false;for(const cap of [preflight,nextCap,sourceCap])if(cap)try{L.disposeLegacy(cap);}catch(e){if(!failed){error=e;failed=true;}}
    preflight=null;nextCap=null;sourceCap=null;intent=null;lastDispatch=null;head=null;sourcePin=null;nextPin=null;reconciliation=null;incoming=null;retainedFrames.clear();metadataFrames.clear();disposed=true;state='DISPOSED';
    try{budget.release('atomic-retained',M.retained);}catch(e){if(!failed){error=e;failed=true;}}if(failed)throw error;
  }
  try{account();}catch(error){try{budget.release('atomic-retained',M.retained);}catch{}throw error;}
  return Object.freeze({adopt,prepareWait,commitWait,retry,recover,view,checkpoint,rawValue,dispose});
}
