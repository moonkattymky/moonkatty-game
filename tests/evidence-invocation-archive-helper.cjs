'use strict';
// Immutable archive transport double. Real framing/SHA-256/head encoding, Map-backed
// persistence, explicitly no native IDB durability claim. Original game keys are absent.
const assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{webcrypto}=require('node:crypto');
const F=require('./evidence-finale-controller-fixture.cjs');
const H=require('./evidence-invocation-original-helper.cjs');
const Codec=require('../trace-codec.js');
const SESSION='1234567890abcdef1234567890abcdef',SCOPE='fixture:invocation';
const clone=x=>JSON.parse(JSON.stringify(x));
const url=file=>pathToFileURL(path.resolve(__dirname,'../prototypes/evidence-indexeddb',file)).href;
async function createArchiveFixture({chapter=8,operations='prepared',seedReferences=true,shared}={}) {
 globalThis.crypto??=webcrypto;
 const C=await import(url('contract.mjs')),B=await import(url('phase-budget.mjs'));
 const {createCoordinator}=await import(url('coordinator.mjs'));
 const store=shared||new Map(),requests=[],events=[],hooks={append:null,read:null,recover:null,retry:null};
 let physical=false,lease=null,live={scope:SCOPE,generation:1,sourceIdentity:'disposable-guest:1'};
 const expectedContext=clone(live),phase=chapter===8?1:2;
 const identity=await C.hash(JSON.stringify(['invocation-fence-identity-v1',SCOPE,1,live.sourceIdentity,SESSION,chapter,phase]),webcrypto);
 async function commit(q,status='committed') {
  const d=await C.descriptor(q.descriptor,webcrypto),root=await C.chain(d,q,q.payload,webcrypto);
  const head=await C.makeHead(d,q.ordinal,q.offset+q.payload.length,root,!!q.seal,webcrypto);
  let current=store.get(q.descriptor.run);
  if(current?.segments.has(q.ordinal)) {
   const prior=current.segments.get(q.ordinal);
   if(JSON.stringify(current.descriptor)!==JSON.stringify(q.descriptor)||prior.root!==root||!C.equalBytes(prior.payload,q.payload))return {status:'refused',reason:'immutable-conflict'};
   status='duplicate';
  } else {
   if(current&&q.expectedHead!==current.head.token)return {status:'refused',reason:'head-conflict'};
   if(!current){assert.equal(q.ordinal,0);assert.equal(q.expectedHead,null);current={descriptor:clone(q.descriptor),head:null,segments:new Map()};store.set(q.descriptor.run,current);}
   current.segments.set(q.ordinal,{ordinal:q.ordinal,offset:q.offset,length:q.payload.length,root,payload:new Uint8Array(q.payload)});current.head=head;
  }
  events.push({kind:status,run:q.descriptor.run});
  return {status,receipt:{captureIdentity:{scope:q.descriptor.scope,run:q.descriptor.run},ordinal:q.ordinal,length:q.payload.length,root,
   headToken:head.token,sealed:!!q.seal,acknowledgement:'idb-transaction-complete',durability:'strict'},currentHead:head};
 }
 const item=entry=>({captureIdentity:{scope:entry.descriptor.scope,run:entry.descriptor.run},descriptor:clone(entry.descriptor),head:clone(entry.head),sealed:entry.head.sealed,acknowledgement:'idb-transaction-complete',durability:'strict'});
 const adapter={
  get physicalBusy(){return physical;},get retainedBytes(){return lease?lease.payload.length+512:0;},
  async appendSegment(q){requests.push({kind:'append',q});const r=hooks.append?await hooks.append(q,commit):await commit(q);if(r.status==='outcomeUnknown')lease=q;return r;},
  async retry(){requests.push({kind:'retry',q:lease});if(!lease)return {status:'refused',reason:'no-retry'};const r=hooks.retry?await hooks.retry(lease,commit):await commit(lease);if(['committed','duplicate'].includes(r.status)||r.status==='refused'&&r.reason==='transaction-aborted')lease=null;return r;},
  async readSegments(q){requests.push({kind:'read',q});const current=store.get(q.captureIdentity.run),ordinal=(q.afterOrdinal??-1)+1;
   const entry=current?.segments.get(ordinal),head=await C.headToken(q.throughHead,webcrypto);
   const page=entry?{status:'page',segments:[{...entry,payload:new Uint8Array(entry.payload)}],payloadBytes:entry.length,throughHead:q.throughHead,
    nextCursor:ordinal<head.ordinal?{captureIdentity:clone(q.captureIdentity),throughHead:q.throughHead,afterOrdinal:ordinal}:null}:{status:'refused',reason:'read-failure'};
   events.push({kind:'read',run:q.captureIdentity.run});return hooks.read?hooks.read(page,q):page;
  },
  async recover(q){requests.push({kind:'recover',q});const cursor=q.cursor?await C.untoken('r',q.cursor,webcrypto):{scope:SCOPE,W:store.size,next:1};
   const entries=[...store.values()],limit=Math.min(q.maxHeads||16,16),rows=entries.slice(cursor.next-1,Math.min(cursor.W,cursor.next-1+limit));
   const next=cursor.next+rows.length,page={status:'page',heads:rows.map(item),watermark:cursor.W,nextCursor:next<=cursor.W?await C.token('r',{scope:SCOPE,W:cursor.W,next},webcrypto):null};
   return hooks.recover?hooks.recover(page,q):page;
  }
 };
 const coordinator=createCoordinator(adapter,()=>live);
 async function addArtifact(descriptor,bytes,{sealed=true}={}) {
  let root=C.ZERO,token=null,ordinal=0;
  for(let offset=0;offset<bytes.length;offset+=32768){const payload=bytes.slice(offset,offset+32768),q={descriptor,expectedHead:token,ordinal,offset,previousRoot:root,payload};
   const d=await C.descriptor(descriptor,webcrypto);root=await C.chain(d,q,payload,webcrypto);if(sealed&&offset+payload.length===bytes.length)q.seal={totalBytes:bytes.length,root};
   const r=await commit(q);assert.equal(r.status,'committed');token=r.currentHead.token;ordinal++;
  }
  const head=store.get(descriptor.run).head;return Object.fromEntries(['binding','root','ordinal','total'].map(key=>[key,head[key]]));
 }
 let contextPin={binding:'a'.repeat(64),root:'b'.repeat(64),ordinal:0,total:200},phasePin={binding:'c'.repeat(64),root:'d'.repeat(64),ordinal:0,total:400};
 if(seedReferences&&!shared) {
  const p=F.phases[chapter===8?1:4],seed=H.seedFinal(chapter,operations),baseSeed=(p.seed-p.index*7919)>>>0;
  const binding={version:1,session:SESSION,chapter,edition:2,baseSeed,storyKey:F.storyKey(chapter),sourceKey:F.sourceKey(chapter),route:'spatial-finale'};
  const context=C.frame([{name:'story',encoding:'utf16le',text:seed[F.storyKey(chapter)]},{name:'binding',encoding:'utf16le',text:Codec.stringify(binding)}]);
  const contextDescriptor={format:C.FORMAT,scope:SCOPE,run:`fc1:${SESSION}:${chapter}`,kind:'finale-chapter-context',model:'finale-chapter-context-v1',components:context.components,note:''};
  contextPin=await addArtifact(contextDescriptor,context.bytes);
  const reference={version:1,scope:SCOPE,run:contextDescriptor.run,binding:contextPin.binding,throughHead:store.get(contextDescriptor.run).head.token};
  const packet=C.frame([{name:'checkpoint',encoding:'utf16le',text:Codec.stringify(p.state)},
   {name:'source',encoding:'utf16le',text:seed[F.sourceKey(chapter)]},{name:'binding',encoding:'utf16le',text:Codec.stringify(F.binding(p))},
   {name:'context-reference',encoding:'utf16le',text:Codec.stringify(reference)}]);
  phasePin=await addArtifact({format:C.FORMAT,scope:SCOPE,run:`fp2:${SESSION}:${chapter}:${phase}`,kind:'finale-phase-completion',model:'finale-phase-completion-v2',components:packet.components,note:''},packet.bytes);
 } else if(shared) {
  for(const [run,entry] of store)if(run===`fc1:${SESSION}:${chapter}`)contextPin=Object.fromEntries(['binding','root','ordinal','total'].map(key=>[key,entry.head[key]]));else if(run===`fp2:${SESSION}:${chapter}:${phase}`)phasePin=Object.fromEntries(['binding','root','ordinal','total'].map(key=>[key,entry.head[key]]));
 }
 const budget=B.createPhaseBudget({observe:e=>events.push({kind:'budget',event:e})});
 const options={coordinator,budget,scope:SCOPE,session:SESSION,chapter,phase,identity,expectedContext,contextPin,phasePin,isCurrent:()=>true,sessionMetadataBytes:()=>26384,crypto:webcrypto};
 const snapshot=()=>JSON.stringify([...store].map(([run,entry])=>[run,{descriptor:entry.descriptor,head:entry.head,segments:[...entry.segments].map(([n,s])=>[n,{...s,payload:Array.from(s.payload)}])}]));
 requests.length=0;events.length=0;
 return {C,B,store,requests,events,hooks,adapter,coordinator,options,budget,commit,addArtifact,item,snapshot,
  physical:value=>{physical=value;},setIdentity:value=>{live=value;},live:()=>live,lease:()=>lease,
  fresh:()=>createArchiveFixture({chapter,operations,shared:store})};
}
module.exports={createArchiveFixture,SESSION,SCOPE,url,clone};
