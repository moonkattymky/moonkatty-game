'use strict';
// Socket-free source/vector checks only. These do NOT prove native IndexedDB behavior.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'../prototypes/evidence-indexeddb');
const url=name=>pathToFileURL(path.join(root,name)).href;
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const turn=()=>new Promise(r=>setImmediate(r));
let checks=0;
const eq=(a,b)=>{assert.deepStrictEqual(a,b);checks++;};
(async()=>{
  const C=await import(url('contract.mjs'));
  const native=crypto.webcrypto;
  const oracleToken=(type,value)=>{const text=JSON.stringify(value);return type+'.'+Buffer.from(text).toString('base64url')+'.'+sha(type+'\0'+text);};
  for(let i=0;i<64;i++){
    const source=' \ufeffraw:-0,1.000,'+String.fromCharCode(i,0xd800+i)+'\u2028😀'+ 'x'.repeat(i);
    const components=[{name:'wire',encoding:'utf8',text:source},{name:'raw',encoding:'utf16le',text:source}];
    const parts=components.map(c=>({name:c.name,encoding:c.encoding,length:Buffer.byteLength(c.text,c.encoding)}));
    const expected=Buffer.alloc(12+parts.reduce((n,c)=>n+8+c.length,0));expected.write('ARCHIVE1');expected.writeUInt32LE(2,8);let pos=12;
    for(let j=0;j<2;j++){expected.writeBigUInt64LE(BigInt(parts[j].length),pos);pos+=8;expected.write(components[j].text,pos,parts[j].length,parts[j].encoding);pos+=parts[j].length;}
    const framed=C.frame(components);eq(Buffer.from(framed.bytes),expected);eq(framed.components,parts);
    const descriptor={format:C.FORMAT,scope:'fixture:A',run:'vector:'+i,kind:'synthetic',model:'v1',components:parts,note:'\\"\u0000'.repeat(i)};
    const d=await C.descriptor(descriptor,native);eq(d.binding,sha(JSON.stringify(descriptor)));eq(d.bytes,Buffer.byteLength(JSON.stringify(descriptor)));eq(C.unframe(framed.bytes,descriptor),components.map((c,j)=>({...parts[j],text:j===0?Buffer.from(c.text,'utf8').toString('utf8'):c.text})));
    const q={descriptor,expectedHead:null,ordinal:0,offset:0,previousRoot:C.ZERO,payload:framed.bytes};
    const prefix='segment\0'+JSON.stringify([C.FORMAT,d.binding,0,0,C.ZERO,expected.length])+'\0';
    const rootHash=sha(Buffer.concat([Buffer.from(prefix),expected]));eq(await C.chain(d,q,q.payload,native),rootHash);
    const head=await C.makeHead(d,0,expected.length,rootHash,true,native);
    const expectedToken=oracleToken('h',[d.binding,'00000000000000',expected.length.toString(16).padStart(14,'0'),rootHash,1]);eq(head.token,expectedToken);
    eq(await C.headToken(expectedToken,native),{binding:d.binding,ordinal:0,total:expected.length,root:rootHash,sealed:true});
    const cursor={scope:'fixture:A',W:i,next:i+1};eq(await C.token('r',cursor,native),oracleToken('r',cursor));eq(await C.untoken('r',oracleToken('r',cursor),native),cursor);
    const q2={...q,seal:{totalBytes:expected.length,root:rootHash}};eq(C.snapshotRequest(q2).end,expected.length);
    for(const seal of [undefined,null,{}, {totalBytes:expected.length,root:rootHash,extra:true}]){assert.throws(()=>C.snapshotRequest({...q,seal}),/seal-invalid/);checks++;}
  }
  for(let n=0;n<512;n++){const bytes=crypto.createHash('sha512').update(String(n)).digest().subarray(0,n%65);eq(C.base64url(bytes),bytes.toString('base64url'));eq(Buffer.from(C.unbase64url(C.base64url(bytes))),bytes);}
  const descriptor={format:C.FORMAT,scope:'fixture:A',run:'test',kind:'synthetic',model:'v1',components:[{name:'x',encoding:'opaque',length:65516}],note:''};
  const q={descriptor,expectedHead:null,ordinal:0,offset:0,previousRoot:C.ZERO,payload:new Uint8Array(65536)};
  eq(C.snapshotRequest(q).end,65536);assert.throws(()=>C.snapshotRequest({...q,payload:new Uint8Array(65537)}),/payload-limit/);checks++;
  if(typeof SharedArrayBuffer==='function'){assert.throws(()=>C.snapshotRequest({...q,payload:new Uint8Array(new SharedArrayBuffer(1))}),/payload-limit/);checks++;}
  const detached=new Uint8Array(1);structuredClone(detached.buffer,{transfer:[detached.buffer]});assert.throws(()=>C.snapshotRequest({...q,payload:detached}),/payload-limit|payload-detached/);checks++;
  for(const name of ['contract.mjs','adapter.mjs','coordinator.mjs']){
    const source=fs.readFileSync(path.join(root,name),'utf8');assert(!/\b(?:require\(|Buffer\b|localStorage\b|fetch\(|getAll\(|openCursor\(|\.commit\(|deleteDatabase\(|setInterval\(|preventDefault\()/.test(source),name);checks++;
  }
  const accessor={...q};Object.defineProperty(accessor,'payload',{enumerable:true,get(){return new Uint8Array(65537);}});assert.throws(()=>C.snapshotRequest(accessor),/request-invalid/);checks++;
  const nonenum={...descriptor};Object.defineProperty(nonenum,'note',{value:'',enumerable:false});assert.throws(()=>C.describe(nonenum),/descriptor-invalid/);checks++;
  const shadowed=new Uint8Array(65537);Object.defineProperty(shadowed,'length',{value:1});assert.throws(()=>C.snapshotRequest({...q,payload:shadowed}),/payload-limit/);checks++;
  const smallShadow=new Uint8Array(32);Object.defineProperty(smallShadow,'length',{value:1});assert.throws(()=>C.snapshotRequest({...q,payload:smallShadow}),/payload-view-invalid/);checks++;
  const escaped={...descriptor,scope:'\u0000'.repeat(128),run:'\u0001'.repeat(128)};const ed=C.describe(escaped);eq(C.utf8Size(C.keyOf(escaped.scope,escaped.run)),1543);assert(C.metadataCharges(ed,1).index>=2048);checks++;
  const A=await import(url('adapter.mjs'));
  const unavailable=A.createTestAdapter({scope:'fixture:A',secureContext:true,indexedDB:null,crypto:native});
  eq(await unavailable.open(),{status:'refused',reason:'indexeddb-unavailable'});await turn();
  eq(await unavailable.appendSegment({...q,descriptor:{...descriptor,scope:'fixture:B'}}),{status:'refused',reason:'scope-mismatch'});
  eq(A.DB_NAME,'mkty_evidence_idb_prototype_20261012');eq(A.DB_VERSION,1);eq(A.STORES,['heads','segments','payloads','indices','scopes','meta']);
  // Real EventTarget events test wrapper bookkeeping only, without a database simulation.
  const pending=new EventTarget();let lateCloses=0,lateAborts=0;
  pending.result={close(){lateCloses++;}};pending.transaction={abort(){lateAborts++;}};
  const blocked=A.createTestAdapter({scope:'fixture:A',secureContext:true,indexedDB:{open(){}},crypto:native,openRequestFactory(){return pending;}});
  const b=blocked.open();pending.dispatchEvent(new Event('blocked'));eq(await b,{status:'refused',reason:'open-blocked'});
  const other=A.createTestAdapter({scope:'fixture:B',secureContext:true,indexedDB:{open(){}},crypto:native});eq(await other.open(),{status:'refused',reason:'busy'});
  pending.dispatchEvent(new Event('upgradeneeded'));eq(lateAborts,1);pending.dispatchEvent(new Event('success'));await turn();eq(lateCloses,1);
  let gateResolve,enteredResolve;const entered=new Promise(r=>enteredResolve=r),gate=new Promise(r=>gateResolve=r);let once=true,opened=0;
  const seen=[];const delaying={subtle:{async digest(algorithm,input){const own=new Uint8Array(input);seen.push(own);if(once){once=false;enteredResolve();await gate;}return native.subtle.digest(algorithm,own);}}};
  const delayed=A.createTestAdapter({scope:'fixture:A',secureContext:true,indexedDB:{open(){opened++;throw new DOMException('denied','SecurityError');}},crypto:delaying});
  const payload=new Uint8Array(32).fill(7),small={...q,descriptor:{...descriptor,components:[{name:'x',encoding:'opaque',length:12}]},payload};
  const app=delayed.appendSegment(small);await entered;payload.fill(9);eq(await other.open(),{status:'refused',reason:'busy'});gateResolve();
  eq((await app).reason,'storage-unavailable');eq(opened,1);
  const chainInput=seen.find(x=>Buffer.from(x.subarray(0,8)).toString()==='segment\0');eq(Buffer.from(chainInput.subarray(-32)),Buffer.alloc(32,7));
  eq(delayed.diagnostics.chainHashes,1);assert(delayed.diagnostics.peakAccountedBytes<=C.LIMIT.transient);checks++;await turn();
  const mutating={...small,descriptor:{...small.descriptor}};const scoped=A.createTestAdapter({scope:'fixture:A',secureContext:true,indexedDB:{open(){throw Error('must-not-open');}},crypto:native});
  eq(await scoped.appendSegment(mutating,()=>{mutating.descriptor.scope='fixture:B';return true;}),{status:'refused',reason:'scope-mismatch'});await turn();
  // Stale context after asynchronous preparation must stop before any storage access.
  let current=true;const stale=A.createTestAdapter({scope:'fixture:A',secureContext:true,indexedDB:{open(){throw Error('must-not-open');}},crypto:{subtle:{async digest(...args){current=false;return native.subtle.digest(...args);}}}});
  eq(await stale.appendSegment(small,()=>current),{status:'refused',reason:'stale-context'});await turn();
  console.log(JSON.stringify({test:'evidence-indexeddb',checks,status:'pass',nativeIndexedDB:'not-run',browserOrSocket:'not-used',productionReady:false}));
})().catch(error=>{console.error(error);process.exitCode=1;});
