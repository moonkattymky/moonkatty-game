// SOURCE ONLY. Three immutable, transaction-complete revisions for one isolated
// guest owner. A valid prefix is canonical even when this archive is unsealed.
// No mutation of the accepted adapter/schema, live storage, or reward protocol.
import * as C from './contract.mjs';
import {freezeFinaleData,measureFinaleData,finaleSession} from './finale-context-v1.mjs';
import {requirePhaseBudget} from './phase-budget.mjs';
export const SHARED_LOG_CONTRACT='guest-two-action-owner-v1';
export const SHARED_LOG_LIMIT=Object.freeze({slot:16384,slots:3,total:49152,recordWorkspace:65536});
export const runFor=session=>`fshared1:${session}`;
const H=['version','binding','ordinal','total','root','sealed','token'];
const bad=reason=>C.fail(reason||'shared-log-invalid');
const MAX=SHARED_LOG_LIMIT;
function deepFrozen(v){if(!v||typeof v!=='object')return true;if(!Object.isFrozen(v))return false;return Object.values(v).every(deepFrozen);}
function reserve(b,label,n){const before=b.snapshot().reservations[label];try{b.reserve(label,n);b.allocate(label,n);}catch(e){const held=b.snapshot().reservations[label]-before;if(held>0)try{b.release(label,held);}catch{}throw e;}}
function hashes(b){return {reserve:(_l,n)=>reserve(b,'helper-framing',n),release:(_l,n)=>b.release('helper-framing',n),
  reserveHash:(n,text)=>reserve(b,'helper-hash',n*(text?2:1)),releaseHash:(n,text)=>b.release('helper-hash',n*(text?2:1)),hash(){}};}
function descriptor(scope,session){return freezeFinaleData({format:C.FORMAT,scope,run:runFor(session),kind:'guest-shared-state',model:SHARED_LOG_CONTRACT,
  components:[{name:'owner-log',encoding:'opaque',length:MAX.total-20}],note:''});}
function boundedCopy(v,max=8192){measureFinaleData([v],max,{restrictedKeys:true});return freezeFinaleData(JSON.parse(JSON.stringify(v)));}
export function createSharedLog({adapter,scope,session,principal,budget,crypto=globalThis.crypto}){
  requirePhaseBudget(budget);
  if(!C.str(scope,128)||!scope||!finaleSession(session)||typeof principal!=='string'||!/^guest:[a-zA-Z0-9_-]{1,64}$/.test(principal)||
    adapter?.scope!==scope||!['appendSegment','retry','readSegments','recover'].every(k=>typeof adapter[k]==='function'))bad('shared-log-capability');
  const desc=descriptor(scope,session),descText=JSON.stringify(desc),run=runFor(session),account=hashes(budget);
  let active=false,leased=false,lastProposal=null;
  function scaffold(stage,...values){const n=measureFinaleData([desc,scope,session,principal,...values],28672,{restrictedKeys:true})+4096;
    budget.allocate('metadata',32768);budget.event('shared-log-scaffold',{stage,bytes:n,limit:32768});}
  function pinShape(pin){
    measureFinaleData([pin],8192,{restrictedKeys:true});
    if(!C.exact(pin,['descriptor','head'])||JSON.stringify(pin.descriptor)!==descText||!C.exact(pin.head,H))bad('shared-log-pin');
    const h=pin.head;if(h.version!==1||!C.hex(h.binding)||!C.hex(h.root)||!Number.isInteger(h.ordinal)||h.ordinal<0||h.ordinal>=MAX.slots||
      h.total!==(h.ordinal+1)*MAX.slot||h.sealed!==(h.ordinal===MAX.slots-1)||!C.str(h.token,2048))bad('shared-log-pin');
    return boundedCopy(pin);
  }
  async function authenticate(pin){
    const d=await C.descriptor(desc,crypto,account),h=await C.headToken(pin.head.token,crypto,account);
    if(d.binding!==pin.head.binding||['binding','ordinal','total','root','sealed'].some(k=>h[k]!==pin.head[k]))bad('shared-log-pin');return d;
  }
  async function exclusive(work){if(active||leased)bad('shared-log-busy');active=true;try{return await work();}finally{active=false;}}
  async function head(){return exclusive(async()=>{
    const allowed=new Set([`fc1:${session}:9`,`fp2:${session}:9:2`,run]),seen=new Set(),cursors=new Set();
    let cursor=null,watermark=null,found=null,count=0,pages=0;
    do{
      if(++pages>MAX.slots)bad('shared-log-catalog');reserve(budget,'returned-page',MAX.slot);
      try{
        const page=await adapter.recover({scope,cursor,maxHeads:1,maxBytes:MAX.slot});
        if(page?.status!=='page')bad(page?.reason||'shared-log-catalog');
        if(!C.exact(page,['status','heads','watermark','nextCursor'])||!Array.isArray(page.heads)||page.heads.length>1||!C.int(page.watermark)||page.watermark>3||
          page.nextCursor!==null&&!C.str(page.nextCursor,2048))bad('shared-log-catalog');
        if(watermark===null)watermark=page.watermark;else if(watermark!==page.watermark)bad('shared-log-catalog');
        if(page.heads.length!==(watermark===0?0:1)||watermark===0&&(pages!==1||page.nextCursor!==null))bad('shared-log-catalog');
        for(const item of page.heads){
          if(!C.exact(item,['captureIdentity','descriptor','head','sealed','acknowledgement','durability'])||!C.exact(item.captureIdentity,['scope','run'])||
            item.captureIdentity.scope!==scope||item.descriptor?.scope!==scope||item.captureIdentity.run!==item.descriptor.run||
            item.sealed!==item.head?.sealed||item.acknowledgement!=='idb-transaction-complete'||item.durability!=='strict')bad('shared-log-catalog');
          if(!allowed.has(item.captureIdentity.run)||seen.has(item.captureIdentity.run))bad('shared-log-scope-not-isolated');
          seen.add(item.captureIdentity.run);if(++count>watermark)bad('shared-log-catalog');
          if(item.captureIdentity.run===run)found=pinShape({descriptor:item.descriptor,head:item.head});
        }
        if(page.nextCursor!==null){if(cursors.has(page.nextCursor)||count>=watermark)bad('shared-log-catalog');cursors.add(page.nextCursor);}
        else if(count!==watermark)bad('shared-log-catalog');
        scaffold('catalog',found,page.heads,[...seen],[...cursors]);cursor=page.nextCursor;
      }finally{budget.release('returned-page',MAX.slot);}
    }while(cursor!==null);
    if(found)await authenticate(found);return found;
  });}
  function encode(record,ordinal){
    measureFinaleData([record],MAX.slot-28,{restrictedKeys:true});if(!deepFrozen(record))bad('shared-log-record-not-frozen');
    const text=JSON.stringify(record),start=ordinal===0?20:0,n=text.length*2;
    if(n>MAX.slot-start-8)bad('shared-log-record-limit');
    budget.allocate('atomic-record-workspace',MAX.recordWorkspace);const bytes=new Uint8Array(MAX.slot),dv=new DataView(bytes.buffer);
    if(ordinal===0){bytes.set(C.utf8('ARCHIVE1'));dv.setUint32(8,1,true);dv.setBigUint64(12,BigInt(MAX.total-20),true);}
    bytes.set([83,76,79,49],start);dv.setUint32(start+4,n,true);
    for(let i=0;i<text.length;i++)dv.setUint16(start+8+i*2,text.charCodeAt(i),true);
    budget.event('shared-log-record-encoded',{ordinal,jsonUtf16:n,payload:MAX.slot});return bytes;
  }
  function decode(bytes,ordinal){
    const start=ordinal===0?20:0,dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    if(bytes.length!==MAX.slot)bad('shared-log-slot');
    if(ordinal===0&&(!C.equalBytes(bytes.subarray(0,8),C.utf8('ARCHIVE1'))||dv.getUint32(8,true)!==1||dv.getBigUint64(12,true)!==BigInt(MAX.total-20)))bad('shared-log-header');
    if([83,76,79,49].some((v,i)=>bytes[start+i]!==v))bad('shared-log-header');
    const n=dv.getUint32(start+4,true);if(n<2||n%2||n>MAX.slot-start-8)bad('shared-log-record-limit');
    for(let i=start+8+n;i<bytes.length;i++)if(bytes[i]!==0)bad('shared-log-padding');
    let text='';for(let i=0;i<n;i+=2)text+=String.fromCharCode(dv.getUint16(start+8+i,true));
    let record;try{record=JSON.parse(text);}catch{bad('shared-log-json');}
    measureFinaleData([record],MAX.slot-28,{restrictedKeys:true});if(JSON.stringify(record)!==text)bad('shared-log-noncanonical');
    budget.event('shared-log-record-decoded',{ordinal,jsonUtf16:n,recordBytes:measureFinaleData([record],MAX.slot-28,{restrictedKeys:true})});
    return freezeFinaleData(record);
  }
  async function readRecord(input,ordinal){return exclusive(async()=>{
    const pin=pinShape(input);if(!Number.isInteger(ordinal)||ordinal<0||ordinal>pin.head.ordinal)bad('shared-log-revision');
    let workspace=false,record=null,bytes=null;
    try{
      reserve(budget,'atomic-record-workspace',MAX.recordWorkspace);workspace=true;
      const d=await authenticate(pin);let root=C.ZERO;
      // Authenticate the short historical prefix, releasing every native page
      // before the digest await. Never assemble or retain all three records.
      for(let i=0;i<=pin.head.ordinal;i++){
        let claimed=null;
        reserve(budget,'returned-page',MAX.slot);
        try{
          let page=await adapter.readSegments({captureIdentity:{scope,run},throughHead:pin.head.token,afterOrdinal:i-1,maxBytes:MAX.slot});
          if(page?.status!=='page')bad(page?.reason||'shared-log-read');
          if(!C.exact(page,['status','segments','payloadBytes','throughHead','nextCursor'])||page.throughHead!==pin.head.token||!Array.isArray(page.segments)||page.segments.length!==1||page.payloadBytes!==MAX.slot)bad('shared-log-read');
          let part=page.segments[0];if(!C.exact(part,['ordinal','offset','length','root','payload'])||part.ordinal!==i||part.offset!==i*MAX.slot||part.length!==MAX.slot||!C.hex(part.root))bad('shared-log-read');
          C.boundedBytes(part.payload,MAX.slot);if(part.payload.length!==MAX.slot)bad('shared-log-read');
          if(i===pin.head.ordinal?page.nextCursor!==null:!C.exact(page.nextCursor,['captureIdentity','throughHead','afterOrdinal'])||
            !C.exact(page.nextCursor.captureIdentity,['scope','run'])||page.nextCursor.captureIdentity.scope!==scope||page.nextCursor.captureIdentity.run!==run||
            page.nextCursor.throughHead!==pin.head.token||page.nextCursor.afterOrdinal!==i)bad('shared-log-read');
          bytes=new Uint8Array(MAX.slot);bytes.set(part.payload);claimed=part.root;part=null;page=null;
          // Save only the small digest string, never the page graph.
        }finally{budget.release('returned-page',MAX.slot);}
        const next=await C.chain(d,{ordinal:i,offset:i*MAX.slot,previousRoot:root},bytes,crypto,account);
        if(next!==claimed)bad('shared-log-chain');root=next;
        if(i===ordinal)record=decode(bytes,i);bytes=null;
      }
      if(root!==pin.head.root)bad('shared-log-chain');
      leased=true;let disposed=false;
      return Object.freeze({get record(){if(disposed)bad('shared-log-lease-disposed');return record;},dispose(){if(disposed)return;disposed=true;record=null;leased=false;workspace=false;budget.release('atomic-record-workspace',MAX.recordWorkspace);}});
    }finally{bytes=null;if(!leased){record=null;if(workspace)budget.release('atomic-record-workspace',MAX.recordWorkspace);}}
  });}
  async function append(record,expected,guard=null){return exclusive(async()=>{
    if(guard&&typeof guard!=='function')bad('shared-log-guard');
    if(guard&&!guard())return {status:'refused',reason:'stale-context',proposalPin:null};
    if(adapter.retainedBytes)return {status:'refused',reason:'retry-pending',proposalPin:null};
    if(adapter.physicalBusy)return {status:'refused',reason:'busy',proposalPin:null};
    const prior=expected===null?null:pinShape(expected),ordinal=prior?prior.head.ordinal+1:0;
    if(ordinal>=MAX.slots)bad('shared-log-full');
    let workspace=false,payload=null;
    try{
      reserve(budget,'atomic-record-workspace',MAX.recordWorkspace);workspace=true;
      payload=encode(record,ordinal);const d=prior?await authenticate(prior):await C.descriptor(desc,crypto,account);
      const q={descriptor:desc,expectedHead:prior?.head.token??null,ordinal,offset:ordinal*MAX.slot,previousRoot:prior?.head.root??C.ZERO,payload};
      const root=await C.chain(d,q,payload,crypto,account),sealed=ordinal===MAX.slots-1;
      const h=await C.makeHead(d,ordinal,(ordinal+1)*MAX.slot,root,sealed,crypto,account);
      const proposalPin=boundedCopy({descriptor:desc,head:h});
      if(sealed)q.seal={totalBytes:MAX.total,root};scaffold('append',prior,proposalPin);
      if(guard&&!guard())return {status:'refused',reason:'stale-context',proposalPin};
      const result=await adapter.appendSegment(q,guard);
      if(result?.status==='outcomeUnknown')lastProposal=proposalPin;
      return {...result,proposalPin};
    }finally{payload=null;if(workspace)budget.release('atomic-record-workspace',MAX.recordWorkspace);}
  });}
  async function retry(guard=null){return exclusive(async()=>{
    if(guard&&typeof guard!=='function')bad('shared-log-guard');
    if(guard&&!guard())return {status:'refused',reason:'stale-context',proposalPin:lastProposal};
    if(!lastProposal)return {status:'refused',reason:'shared-log-retry-identity',proposalPin:null};
    const proposalPin=lastProposal,result=await adapter.retry(guard);
    if(result?.status!=='outcomeUnknown'&&!adapter.retainedBytes)lastProposal=null;
    return {...result,proposalPin};});}
  return Object.freeze({head,readRecord,append,retry,descriptor:desc});
}
