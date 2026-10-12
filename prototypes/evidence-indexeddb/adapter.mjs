import * as C from './contract.mjs';
const {LIMIT,FORMAT,ZERO,own,int,add,exact,str,hex,fail,keyOf,segmentKey,metadataCharges,utf8Size}=C;
export const DB_NAME='mkty_evidence_idb_prototype_20261012', DB_VERSION=1;
export const STORES=Object.freeze(['heads','segments','payloads','indices','scopes','meta']);
// This is a module-realm gate, deliberately NOT an origin-wide memory governor.
const realm={pending:null,retained:null,serial:0};
const marker=()=>({version:1,format:FORMAT,quota:LIMIT.quota,captureLimit:LIMIT.captures,bytes:LIMIT.counters,captures:0,segments:0});
const refusal=reason=>({status:'refused',reason});
function errorReason(e){return e?.name==='QuotaExceededError'?'native-quota':e?.name==='SecurityError'?'storage-unavailable':e?.name==='VersionError'?'unsupported-version':e?.name==='NotSupportedError'?'webcrypto-sha256-unavailable':e?.message||e?.name||'storage-error';}
function stats(op,id){return {op,id,transactions:0,headReads:0,segmentPositions:0,payloadReads:0,indexPositions:0,counterReads:0,
  hashes:0,chainHashes:0,hashInputBytes:0,maxHashInputBytes:0,webCryptoCopyBytes:0,comparisons:0,comparisonBytes:0,
  duplicateReadBytes:0,metadataReadBytes:0,requestBytes:0,inputCopyBytes:0,outputCopyBytes:0,outputBytes:0,
  stagingBytes:0,requiredPeakBytes:0,peakAccountedBytes:0,liveAccountedBytes:0,touchedWrites:0,
  enumerations:0,historicalPayloadReads:0,terminal:null,requestErrors:[],events:[],createdNew:false};}
function checkMarker(m){if(!exact(m,['version','format','quota','captureLimit','bytes','captures','segments'])||m.version!==1||m.format!==FORMAT||
  m.quota!==LIMIT.quota||m.captureLimit!==LIMIT.captures||!int(m.bytes)||m.bytes<LIMIT.counters||m.bytes>LIMIT.quota||
  !int(m.captures)||m.captures>LIMIT.captures||!int(m.segments)||m.segments<m.captures||m.segments>LIMIT.quota||
  (m.captures===0&&m.segments!==0))fail('global-marker-invalid');return m;}
function checkScope(x){if(!exact(x,['highWater'])||!int(x.highWater)||x.highWater<1||x.highWater>LIMIT.captures)fail('scope-counter-invalid');return x;}
function headShape(h){
  if(!exact(h,['version','d','head','charge','sequence'])||h.version!==1||!exact(h.d,['text','value','bytes','total','binding'])||
    !exact(h.head,['version','binding','ordinal','total','root','sealed','token'])||h.head.version!==1)fail('head-missing-or-format');
  const d=C.describe(h.d.value),x=h.head;
  if(d.text!==h.d.text||d.bytes!==h.d.bytes||d.total!==h.d.total||!hex(h.d.binding)||x.binding!==h.d.binding||
    !hex(x.root)||typeof x.sealed!=='boolean'||!int(x.ordinal)||x.ordinal>=LIMIT.quota||!int(x.total)||
    x.total<x.ordinal+1||x.total>d.total||(x.sealed&&x.total!==d.total)||!str(x.token,2048)||
    !int(h.sequence)||h.sequence<1||h.sequence>LIMIT.captures||h.charge!==metadataCharges(d,h.sequence).head)fail('head-corrupt');return h;
}
async function checkHead(h,crypto,op){headShape(h);const d=await C.descriptor(h.d.value,crypto,op);
  if(d.binding!==h.d.binding||(await C.makeHead(d,h.head.ordinal,h.head.total,h.head.root,h.head.sealed,crypto,op)).token!==h.head.token)fail('head-corrupt');return h;}
function compareExpected(h,d,pin,expected){headShape(h);if(h.d.text!==d.text||h.d.binding!==d.binding||h.d.bytes!==d.bytes||h.d.total!==d.total)fail('head-corrupt');
  if(h.head.token!==expected||!pin||['binding','ordinal','total','root','sealed'].some(k=>h.head[k]!==pin[k]))fail('head-corrupt');}
function metaShape(m,ordinal){const keys=['version','binding','scope','run','ordinal','offset','previousRoot','length','root','hasSeal','headToken'];
  if(!m||typeof m.hasSeal!=='boolean'||own(m,'seal')!==m.hasSeal||!exact(m,m.hasSeal?[...keys,'seal']:keys))fail('segment-seal-format');
  if(m.version!==1||m.ordinal!==ordinal||!int(m.ordinal)||m.ordinal>=LIMIT.quota||!int(m.offset)||!int(m.length)||m.length<1||m.length>LIMIT.payload||
    !hex(m.binding)||!hex(m.previousRoot)||!hex(m.root)||!str(m.scope,128)||!m.scope.length||!str(m.run,128)||!m.run.length||!str(m.headToken,2048))fail('segment-missing-or-format');
  if(m.hasSeal&&(!exact(m.seal,['totalBytes','root'])||!int(m.seal.totalBytes)||!hex(m.seal.root)))fail('segment-seal-format');return m;
}
const receipt=m=>({captureIdentity:{scope:m.scope,run:m.run},ordinal:m.ordinal,length:m.length,root:m.root,headToken:m.headToken,
  sealed:m.hasSeal,acknowledgement:'idb-transaction-complete',durability:'strict'});
const sameMeta=(a,b)=>['version','binding','scope','run','ordinal','offset','previousRoot','length','root','hasSeal','headToken'].every(k=>a[k]===b[k])&&
  (!b.hasSeal||(a.seal.totalBytes===b.seal.totalBytes&&a.seal.root===b.seal.root));
export function createAdapter({scope}={}){return build({scope,indexedDB:globalThis.indexedDB,crypto:globalThis.crypto,secureContext:globalThis.isSecureContext,watchdogMs:15000});}
// Test-only seams are not imported by runtime code. Name/version remain fixed at call site.
export function createTestAdapter({scope,indexedDB=globalThis.indexedDB,crypto=globalThis.crypto,secureContext=globalThis.isSecureContext,
  openRequestFactory,watchdogMs=15000}={}){return build({scope,indexedDB,crypto,secureContext,openRequestFactory,watchdogMs});}
function build({scope,indexedDB,crypto,secureContext,openRequestFactory,watchdogMs}){
  if(!str(scope,128)||!scope.length)fail('scope-invalid');if(!int(watchdogMs)||watchdogMs<1||watchdogMs>60000)fail('watchdog-invalid');
  let db=null,state='new',last=stats('none',0),createdNew=false,instance={};
  const supported=()=>{if(secureContext!==true)fail('insecure-context');if(!indexedDB?.open)fail('indexeddb-unavailable');
    if(!crypto?.subtle?.digest)fail('webcrypto-unavailable');if(typeof TextEncoder!=='function'||typeof TextDecoder!=='function')fail('encoding-unavailable');};
  const live=op=>{if(state==='draining'||state==='closed')fail('adapter-closed');if(op?.settled)fail('operation-abandoned');};
  function event(op,value){if(op.s.events.length<64)op.s.events.push(value);}
  function newOperation(kind,work){
    if(realm.pending)return Promise.resolve(refusal('busy'));
    if(state==='draining'||state==='closed')return Promise.resolve(refusal('adapter-closed'));
    const op={id:++realm.serial,owner:instance,kind,s:stats(kind,realm.serial),settled:false,tx:null,openAbandon:null,lease:null,slots:new Map(),bytes:0};
    if(realm.retained){op.bytes=realm.retained.requestBytes;op.slots.set('retained',op.bytes);}
    op.reserve=(name,n)=>{const next=add(op.bytes,n);if(next>LIMIT.transient)fail('transient-budget');op.bytes=next;op.slots.set(name,add(op.slots.get(name)||0,n));op.s.liveAccountedBytes=next;op.s.peakAccountedBytes=Math.max(op.s.peakAccountedBytes,next);};
    op.release=(name,n)=>{if(!int(n)||(op.slots.get(name)||0)<n)throw Error('reservation-identity');op.slots.set(name,op.slots.get(name)-n);op.bytes-=n;op.s.liveAccountedBytes=op.bytes;};
    op.reserveHash=(n,text)=>op.reserve('hash',n*(text?2:1));op.releaseHash=(n,text)=>op.release('hash',n*(text?2:1));
    op.hash=n=>{op.s.hashes++;op.s.hashInputBytes+=n;op.s.webCryptoCopyBytes+=n;op.s.maxHashInputBytes=Math.max(op.s.maxHashInputBytes,n);};
    realm.pending=op;last=op.s;
    return new Promise(resolve=>{
      op.finish=result=>{if(op.settled)return;op.settled=true;clearTimeout(op.timer);event(op,'caller:'+result.status);
        if(result.status==='outcomeUnknown'&&op.lease)realm.retained=op.lease;resolve(result);};
      op.timer=setTimeout(()=>{event(op,'watchdog');if(op.openAbandon){op.openAbandon('open-timeout');return;}
        if(op.tx){try{op.tx.abort();event(op,'abort-requested');}catch(e){event(op,'abort-threw:'+e.name);}
          op.finish({status:'outcomeUnknown',reason:'terminal-unobserved'});
        }else op.finish(refusal('operation-timeout'));
      },watchdogMs);
      // The one realm slot covers all pending promises/digests, not just a transaction.
      (async()=>{try{supported();op.reserve('operation-slots',16384);const result=await work(op);op.finish(result);}
        catch(e){op.finish(refusal(errorReason(e)));}
        finally{clearTimeout(op.timer);
          // Only this exact operation can release its own lease and physical slot.
          if(op.lease&&realm.retained!==op.lease)op.lease=null;
          if(realm.pending===op)realm.pending=null;op.s.liveAccountedBytes=realm.retained?.requestBytes||0;
        }})();
    });
  }
  function request(op,tx,store,method,key,value,success){
    let r;try{r=method==='get'?tx.objectStore(store).get(key):tx.objectStore(store)[method](value,key);
      if(method!=='get')op.s.touchedWrites++;event(op,method+':'+store);
    }catch(e){abortWith(op,tx,e,true);return;}
    r.addEventListener('error',()=>{if(op.s.requestErrors.length<16)op.s.requestErrors.push({name:r.error?.name||'Error',message:(r.error?.message||'').slice(0,256)});});
    r.addEventListener('success',()=>{try{success?.(r.result);}catch(e){abortWith(op,tx,e);}});
  }
  function abortWith(op,tx,e,requestFailure=false){
    let nativeAbortFailure=false;
    try{tx.abort();}catch(error){event(op,'abort-threw:'+error.name);
      // A native request issued after an external abort can fail before its
      // terminal event arrives. Callback validation errors never qualify.
      nativeAbortFailure=requestFailure&&tx.mode==='readonly'&&typeof DOMException==='function'&&e instanceof DOMException&&
        ['AbortError','InvalidStateError','TransactionInactiveError'].includes(e.name)&&error instanceof DOMException&&error.name==='InvalidStateError';
    }
    // In readonly work, later abort fallout must not hide the first explicit
    // failure. Readwrite classification keeps its existing behavior.
    if(tx.mode!=='readonly'||!op.failure||op.nativeAbortFailure&&!nativeAbortFailure){op.failure=errorReason(e);op.nativeAbortFailure=nativeAbortFailure;}
  }
  function transaction(op,names,mode,start){
    live(op);return new Promise((resolve,reject)=>{
      let tx;try{tx=db.transaction(names,mode,mode==='readwrite'?{durability:'strict'}:undefined);}catch(e){reject(e);return;}
      op.tx=tx;op.s.transactions++;event(op,'transaction:'+mode);op.failure=null;op.nativeAbortFailure=false;
      tx.addEventListener('complete',()=>{op.tx=null;op.s.terminal='complete';event(op,'complete');resolve({complete:true,result:op.result});});
      tx.addEventListener('abort',()=>{op.tx=null;op.s.terminal='abort';event(op,'abort');
        const nativeAbort=mode==='readonly'&&(!tx.error||typeof DOMException==='function'&&tx.error instanceof DOMException&&tx.error.name==='AbortError');
        const reason=nativeAbort&&(!op.failure||op.nativeAbortFailure)?'transaction-aborted':
          op.nativeAbortFailure&&tx.error?errorReason(tx.error):op.failure||errorReason(tx.error||{name:'AbortError',message:'transaction-aborted'});
        resolve({complete:false,reason,errorName:tx.error?.name||null});});
      tx.addEventListener('error',()=>event(op,'transaction-error'));
      if(mode==='readwrite'&&tx.durability!=='strict'){abortWith(op,tx,Error('unsupported-durability'));return;}
      try{start(tx);}catch(e){abortWith(op,tx,e);}
    });
  }
  async function ensureOpen(op){
    live(op);if(db)return;let connection;
    await new Promise((resolve,reject)=>{
      let r,abandoned=false,upgrade=null,finished=false;
      const terminal=(e)=>{if(finished)return;finished=true;op.openAbandon=null;e?reject(e):resolve();};
      const abandon=reason=>{if(abandoned)return;abandoned=true;op.finish(refusal(reason));if(upgrade){try{upgrade.abort();}catch(e){event(op,'upgrade-abort-threw:'+e.name);}}};
      op.openAbandon=abandon;state='opening';
      try{r=openRequestFactory?openRequestFactory(DB_NAME,DB_VERSION):indexedDB.open(DB_NAME,DB_VERSION);}catch(e){terminal(e);return;}
      r.addEventListener('blocked',()=>{event(op,'open-blocked');abandon('open-blocked');});
      r.addEventListener('upgradeneeded',e=>{upgrade=r.transaction;
        if(abandoned||state==='closed'||state==='draining'){try{upgrade.abort();}catch{}return;}
        if(e.oldVersion!==0||r.result.version!==DB_VERSION){op.failure='unsupported-version';upgrade.abort();return;}
        try{for(const name of STORES)r.result.createObjectStore(name);upgrade.objectStore('meta').add(marker(),'global');createdNew=true;op.s.createdNew=true;}
        catch(error){op.failure=errorReason(error);upgrade.abort();}
      });
      r.addEventListener('error',()=>{state=state==='closed'||state==='draining'?state:'new';terminal(Error(op.failure||errorReason(r.error)));});
      r.addEventListener('success',()=>{connection=r.result;if(abandoned||state==='closed'||state==='draining'){connection.close();terminal(Error('open-abandoned'));return;}terminal();});
    });
    try{
      live(op);if(!connection)fail('open-unavailable');
      if(connection.version!==DB_VERSION||connection.objectStoreNames.length!==STORES.length||!STORES.every(n=>connection.objectStoreNames.contains(n)))fail('schema-mismatch');
      db=connection;
      db.addEventListener('versionchange',()=>{state='draining';db.close();event(op,'versionchange');});
      db.addEventListener('close',()=>{state='closed';if(realm.pending?.owner===instance&&realm.pending.tx)realm.pending.finish({status:'outcomeUnknown',reason:'connection-closed'});});
      const terminal=await transaction(op,STORES,'readonly',tx=>{
        for(const name of STORES){const store=tx.objectStore(name);if(store.keyPath!==null||store.autoIncrement||store.indexNames.length!==0)fail('schema-mismatch');}
        request(op,tx,'meta','get','global',undefined,value=>{checkMarker(value);op.result={status:'open',createdNew};});
      });
      if(!terminal.complete)fail(terminal.reason);live(op);state='open';
    }catch(e){connection?.close();db=null;if(state!=='closed'&&state!=='draining')state='new';throw e;}
  }
  const scopeMatch=s=>s===scope;
  async function prepare(lease,op){
    const q=lease.request,d=lease.d;d.binding=await C.hash(d.text,crypto,op);live(op);const pin=q.expectedHead===null?null:await C.headToken(q.expectedHead,crypto,op);
    live(op);if(pin&&pin.binding!==d.binding)fail('head-binding');op.s.chainHashes++;
    const root=await C.chain(d,q,q.payload,crypto,op),sealed=own(q,'seal');live(op);
    if(sealed&&(q.seal.totalBytes!==lease.end||lease.end!==d.total||q.seal.root!==root))fail('seal-mismatch');
    const head=await C.makeHead(d,q.ordinal,lease.end,root,sealed,crypto,op);
    const m={version:1,binding:d.binding,scope:d.value.scope,run:d.value.run,ordinal:q.ordinal,offset:q.offset,previousRoot:q.previousRoot,
      length:q.payload.length,root,hasSeal:sealed,...(sealed?{seal:{...q.seal}}:{}),headToken:head.token};
    return {q,d,pin,root,head,m,receipt:receipt(m)};
  }
  function append(leaseOrRequest,retrying,guard){
    if(!retrying&&!scopeMatch(leaseOrRequest?.descriptor?.scope))return Promise.resolve(refusal('scope-mismatch'));
    if(realm.pending)return Promise.resolve(refusal('busy'));
    if(retrying&&(!realm.retained||realm.retained.owner!==instance))return Promise.resolve(refusal('no-retry'));
    if(!retrying&&realm.retained)return Promise.resolve(refusal('retry-pending'));
    return newOperation('append',async op=>{
      if(guard&&!guard())return refusal('stale-context');let lease;
      if(retrying){lease=realm.retained;op.lease=lease;}
      else{const v=C.snapshotRequest(leaseOrRequest);if(!scopeMatch(v.d.value.scope))return refusal('scope-mismatch');op.reserve('request',v.requestBytes);lease={...v,owner:instance,request:{...v.request,payload:new Uint8Array(v.request.payload)}};op.lease=lease;}
      op.s.requestBytes=lease.requestBytes;op.s.inputCopyBytes=retrying?0:lease.request.payload.length;
      const p=await prepare(lease,op);live(op);if(guard&&!guard())return refusal('stale-context');await ensureOpen(op);live(op);if(guard&&!guard())return refusal('stale-context');
      const {q,d,pin,head,m}=p,key=keyOf(scope,d.value.run),sk=segmentKey(key,q.ordinal);
      const done=await transaction(op,STORES,'readwrite',tx=>{
        let h,existing,sc,global,left=4;
        const ready=()=>{if(--left!==0)return;checkMarker(global);if(sc)checkScope(sc);
          if(sc&&sc.highWater>global.captures)fail('scope-counter-invalid');
          if(existing){metaShape(existing,q.ordinal);op.s.metadataReadBytes+=LIMIT.segment;op.reserve('duplicate-payload',LIMIT.payload);
            op.s.payloadReads++;request(op,tx,'payloads','get',sk,undefined,bytes=>{
              C.boundedBytes(bytes);op.s.duplicateReadBytes=bytes.length;op.s.comparisons++;op.s.comparisonBytes=bytes.length+q.payload.length;
              if(!h||h.d?.text!==d.text||!sameMeta(existing,m)||!C.equalBytes(bytes,q.payload)){op.result={status:'conflict',reason:'immutable-segment'};return;}
              // Full current-head hashing happens only after this read-only outcome completes.
              headShape(h);if(h.d.value.scope!==scope||h.d.value.run!==d.value.run||!sc||h.sequence>sc.highWater||
                h.head.ordinal<m.ordinal||h.head.total<lease.end||
                (h.head.ordinal===m.ordinal&&h.head.token!==m.headToken)||
                (m.hasSeal&&(h.head.ordinal!==m.ordinal||!h.head.sealed)))fail('head-corrupt');
              op.result={status:'duplicate',receipt:p.receipt,currentHead:{...h.head},verifyHead:h};
            });return;}
          if(h?.d?.text!==undefined&&h.d.text!==d.text){op.result={status:'conflict',reason:'descriptor'};return;}
          if((h?h.head?.token:null)!==q.expectedHead){op.result={status:'conflict',reason:'expected-head'};return;}
          if(h){compareExpected(h,d,pin,q.expectedHead);if(!sc||h.sequence>sc.highWater)fail('scope-counter-invalid');}
          if(h?.head.sealed){op.result={status:'conflict',reason:'sealed'};return;}
          if(q.ordinal!==(h?add(h.head.ordinal,1):0)||q.offset!==(h?h.head.total:0)||q.previousRoot!==(h?h.head.root:ZERO)){op.result={status:'conflict',reason:'position'};return;}
          const sequence=h?h.sequence:add(sc?.highWater||0,1);if(sequence>LIMIT.captures)fail('logical-quota');const charges=metadataCharges(d,sequence);
          const delta=add(q.payload.length,LIMIT.segment,h?0:charges.head,h?0:charges.index,sc?0:charges.counters);
          const bytes=add(global.bytes,delta),captures=add(global.captures,h?0:1),segments=add(global.segments,1),R=lease.requestBytes;
          op.s.stagingBytes=add(q.payload.length,LIMIT.segment,charges.head,h?0:charges.index,charges.counters,LIMIT.counters,R);
          op.s.requiredPeakBytes=add(global.bytes,op.s.stagingBytes);
          if(bytes>LIMIT.quota||captures>LIMIT.captures||op.s.requiredPeakBytes>LIMIT.quota){op.result=refusal('logical-quota');return;}
          const next={version:1,d,head,charge:charges.head,sequence};
          request(op,tx,'segments','add',sk,m);request(op,tx,'payloads','add',sk,q.payload);request(op,tx,'heads',h?'put':'add',key,next);
          if(!h)request(op,tx,'indices','add',keyOf(scope,String(sequence)),{version:1,key,sequence});
          request(op,tx,'scopes',sc?'put':'add',scope,{highWater:h?sc.highWater:sequence});
          request(op,tx,'meta','put','global',{...global,bytes,captures,segments});
          op.result={status:'committed',receipt:p.receipt,currentHead:{...head}};
        };
        op.s.headReads++;request(op,tx,'heads','get',key,undefined,v=>{h=v;if(v){op.reserve('head-slot',LIMIT.head+3*LIMIT.metadata);op.s.metadataReadBytes+=int(v.charge)&&v.charge<=LIMIT.head+3*LIMIT.metadata?v.charge:LIMIT.head+3*LIMIT.metadata;}ready();});
        op.s.segmentPositions++;request(op,tx,'segments','get',sk,undefined,v=>{existing=v;ready();});
        op.s.counterReads+=2;request(op,tx,'scopes','get',scope,undefined,v=>{sc=v;ready();});request(op,tx,'meta','get','global',undefined,v=>{global=v;ready();});
      });
      if(!done.complete){if(realm.retained===lease&&!op.settled)realm.retained=null;return {...refusal(done.reason),errorName:done.errorName};}
      let result=done.result;if(!result)fail('transaction-no-result');
      if(result.status==='duplicate'){await checkHead(result.verifyHead,crypto,op);delete result.verifyHead;}
      if(realm.retained===lease&&!op.settled)realm.retained=null;
      return result;
    });
  }
  async function checkMeta(m,h,op){metaShape(m,m.ordinal);const end=add(m.offset,m.length);
    if(m.scope!==scope||m.run!==h.d.value.run||m.binding!==h.d.binding||m.offset<m.ordinal||end>h.d.total||
      (await C.makeHead(h.d,m.ordinal,end,m.root,m.hasSeal,crypto,op)).token!==m.headToken)fail('segment-chain-corrupt');
    if(m.hasSeal&&(end!==h.d.total||m.seal.totalBytes!==end||m.seal.root!==m.root))fail('seal-corrupt');
  }
  function readSegments(input={}){
    if(!scopeMatch(input.captureIdentity?.scope))return Promise.resolve(refusal('scope-mismatch'));
    return newOperation('read',async op=>{
      const {captureIdentity,throughHead,afterOrdinal=-1,maxBytes=LIMIT.page}=input;
      if(!exact(captureIdentity,['scope','run'])||!str(captureIdentity.run,128)||!captureIdentity.run.length||!int(maxBytes)||maxBytes<1||maxBytes>LIMIT.page||
        !Number.isSafeInteger(afterOrdinal)||afterOrdinal< -1||!str(throughHead,2048))fail('read-invalid');
      const identity={scope,run:captureIdentity.run},pin=await C.headToken(throughHead,crypto,op);live(op);await ensureOpen(op);
      const key=keyOf(scope,identity.run);let h,pinned,prior,ordinal=afterOrdinal+1,total=0;const records=[];
      const done=await transaction(op,['heads','segments','payloads'],'readonly',tx=>{
        const getMeta=(position,fn)=>{if(op.s.segmentPositions>=LIMIT.positions)fail('position-budget');op.s.segmentPositions++;op.reserve('segment-slots',LIMIT.segment);
          request(op,tx,'segments','get',segmentKey(key,position),undefined,value=>{metaShape(value,position);op.s.metadataReadBytes+=LIMIT.segment;fn(value);});};
        const next=()=>{
          if(ordinal>pin.ordinal|| (ordinal!==pin.ordinal&&op.s.segmentPositions>=LIMIT.positions)){op.result={status:'collected'};return;}
          const consume=m=>{if(m.length>maxBytes-total){op.result=records.length?{status:'collected'}:{...refusal('page-budget-too-small'),required:m.length};return;}
            op.reserve('read-payload',m.length);op.s.payloadReads++;
            request(op,tx,'payloads','get',segmentKey(key,ordinal),undefined,payload=>{C.boundedBytes(payload);if(payload.length!==m.length)fail('segment-bytes-corrupt');
              records.push({m,payload});total=add(total,m.length);ordinal++;next();});};
          if(ordinal===pin.ordinal)consume(pinned);else getMeta(ordinal,consume);
        };
        op.s.headReads++;op.reserve('head-slot',LIMIT.head+3*LIMIT.metadata);
        request(op,tx,'heads','get',key,undefined,value=>{h=headShape(value);op.s.metadataReadBytes+=h.charge;
          if(h.d.value.scope!==scope||h.d.value.run!==identity.run||pin.binding!==h.d.binding||pin.ordinal>h.head.ordinal||afterOrdinal>pin.ordinal)fail('pinned-head-inaccessible');
          getMeta(pin.ordinal,m=>{pinned=m;if(afterOrdinal>=0){if(afterOrdinal===pin.ordinal){prior=pinned;next();}else getMeta(afterOrdinal,p=>{prior=p;next();});}else next();});
        });
      });
      if(!done.complete)return {...refusal(done.reason),errorName:done.errorName};
      await checkHead(h,crypto,op);await checkMeta(pinned,h,op);
      if(pinned.headToken!==throughHead||pinned.root!==pin.root||add(pinned.offset,pinned.length)!==pin.total||pinned.hasSeal!==pin.sealed)fail('pinned-head-corrupt');
      let previous=ZERO,offset=0;if(prior){if(prior!==pinned)await checkMeta(prior,h,op);previous=prior.root;offset=add(prior.offset,prior.length);}
      if(done.result?.status==='refused')return done.result;
      for(const {m,payload} of records){await checkMeta(m,h,op);
        if(m.offset!==offset||m.previousRoot!==previous||(m.hasSeal&&(m.ordinal!==pin.ordinal||!pin.sealed)))fail('segment-chain-corrupt');
        op.s.chainHashes++;if(await C.chain(h.d,m,payload,crypto,op)!==m.root)fail('segment-root-corrupt');
        offset=add(offset,m.length);previous=m.root;
      }
      if(ordinal>pin.ordinal&&(previous!==pin.root||offset!==pin.total))fail('pinned-root-mismatch');
      op.reserve('response-slots',LIMIT.metadata*2);
      const segments=records.map(({m,payload})=>({ordinal:m.ordinal,offset:m.offset,length:m.length,root:m.root,payload}));
      op.s.outputBytes=add(total,utf8Size(JSON.stringify(segments.map(({payload,...m})=>m))),256);
      return {status:'page',segments,payloadBytes:total,throughHead,nextCursor:ordinal<=pin.ordinal?{captureIdentity:identity,throughHead,afterOrdinal:ordinal-1}:null};
    });
  }
  function recover(input={}){
    if(!scopeMatch(input.scope))return Promise.resolve(refusal('scope-mismatch'));
    return newOperation('recover',async op=>{
      const {cursor=null,maxHeads=16,maxBytes=LIMIT.page}=input;
      if(!int(maxHeads)||maxHeads<1||!int(maxBytes)||maxBytes<1||maxBytes>LIMIT.page)fail('recover-invalid');
      let parsed=null;if(cursor!==null){parsed=await C.untoken('r',cursor,crypto,op);
        if(!exact(parsed,['scope','W','next'])||parsed.scope!==scope||!int(parsed.W)||parsed.W>LIMIT.captures||!int(parsed.next)||parsed.next<1||parsed.next>add(parsed.W,1))fail('cursor-invalid');}
      live(op);await ensureOpen(op);let next=1,W=0,headBytes=0;const collected=[],heads=[];
      const response=position=>({status:'page',heads,watermark:W,nextCursor:position<=W?C.tokenPlaceholder('r',{scope,W,next:position}):null});
      const responseBytes=(position,bytes)=>add(utf8Size(JSON.stringify({...response(position),heads:[]})),bytes);
      const done=await transaction(op,['scopes','indices','heads'],'readonly',tx=>{
        const visit=()=>{if(next>W||op.s.indexPositions>=Math.min(maxHeads,LIMIT.positions)){op.result={status:'collected'};return;}
          const position=next;op.s.indexPositions++;op.reserve('index-slots',LIMIT.index);
          request(op,tx,'indices','get',keyOf(scope,String(position)),undefined,ix=>{
            if(!exact(ix,['version','key','sequence'])||ix.version!==1||ix.sequence!==position||!str(ix.key,2*128*6+7))fail('index-missing-or-corrupt');
            op.s.headReads++;request(op,tx,'heads','get',ix.key,undefined,value=>{
              const h=headShape(value);op.s.metadataReadBytes+=h.charge;op.reserve('head-slots',add(h.d.bytes,h.d.bytes,LIMIT.head));
              if(h.d.value.scope!==scope||h.sequence!==position||keyOf(scope,h.d.value.run)!==ix.key)fail('index-binding');
              const item={captureIdentity:{scope,run:h.d.value.run},descriptor:h.d.value,head:{...h.head},sealed:h.head.sealed,acknowledgement:'idb-transaction-complete',durability:'strict'};
              const size=utf8Size(JSON.stringify(item)),candidate=add(headBytes,size,heads.length?1:0),required=responseBytes(position+1,candidate);
              // Include even the next inspected head in post-transaction integrity checks.
              collected.push(h);
              if(required>maxBytes){op.result=heads.length?{status:'collected'}:{...refusal('page-budget-too-small'),required};return;}
              op.reserve('response-slots',size+(heads.length?1:0));heads.push(item);headBytes=candidate;next++;visit();
            });
          });
        };
        op.s.counterReads++;request(op,tx,'scopes','get',scope,undefined,value=>{const high=value===undefined?0:checkScope(value).highWater;
          W=parsed?parsed.W:high;next=parsed?parsed.next:1;if(W>high)fail('cursor-invalid');visit();});
      });
      if(!done.complete)return {...refusal(done.reason),errorName:done.errorName};
      for(const h of collected)await checkHead(h,crypto,op);
      if(done.result?.status==='refused')return done.result;
      const result={status:'page',heads,watermark:W,nextCursor:next<=W?await C.token('r',{scope,W,next},crypto,op):null};
      op.reserve('response-envelope',2048);op.s.outputBytes=utf8Size(JSON.stringify(result));
      if(op.s.outputBytes>maxBytes)return {...refusal('page-budget-too-small'),required:op.s.outputBytes};return result;
    });
  }
  Object.assign(instance,{
    open:()=>newOperation('open',async op=>{await ensureOpen(op);return {status:'open',createdNew};}),
    appendSegment:(q,guard=null)=>append(q,false,guard),retry:(guard=null)=>append(null,true,guard),readSegments,recover,
    close(){if(state==='closed'||state==='draining')return;state='draining';db?.close();const op=realm.pending;
      if(op?.owner===instance&&op.openAbandon)op.openAbandon('adapter-closed');},
  });
  Object.defineProperties(instance,{
    diagnostics:{get:()=>({...last,requestErrors:last.requestErrors.map(x=>({...x})),events:[...last.events]})},
    retainedBytes:{get:()=>realm.retained?.requestBytes||0},state:{get:()=>state},createdNew:{get:()=>createdNew},scope:{value:scope},
  });
  return Object.freeze(instance);
}
