'use strict';
// Socket-free event/database doubles run the real adapter, coordinator and gate.
// They verify classification and ownership, not native IDB/browser durability.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'../prototypes/evidence-indexeddb'),url=name=>pathToFileURL(path.join(root,name)).href;
const turn=()=>new Promise(resolve=>setImmediate(resolve));
let checks=0,serial=0;const groups=[];
const eq=(a,b,note)=>{assert.deepStrictEqual(a,b,note);checks++;};
const ok=(value,note)=>{assert(value,note);checks++;};
const dom=(name='InvalidStateError',message='localized native transaction message')=>new DOMException(message,name);

function databaseDouble(A,C){
  const stores=new Map(A.STORES.map(name=>[name,new Map()]));
  stores.get('meta').set('global',{version:1,format:C.FORMAT,quota:C.LIMIT.quota,captureLimit:C.LIMIT.captures,bytes:C.LIMIT.counters,captures:0,segments:0});
  const control={next:null,transactions:[],log:[],held:[],active:0,peak:0};
  const clone=value=>value===undefined?undefined:structuredClone(value);
  class Transaction extends EventTarget{
    constructor(names,mode,options,fault){
      super();this.names=names;this.mode=mode;this.durability=options?.durability||'default';this.error=null;
      this.status='active';this.pending=0;this.fault=fault||{};this.seen=0;
      this.data=mode==='readwrite'?new Map([...stores].map(([name,rows])=>[name,new Map([...rows].map(([key,value])=>[key,clone(value)]))])):stores;
      control.transactions.push(this);control.active++;control.peak=Math.max(control.peak,control.active);
    }
    finish(type){
      if(this.terminal)return;this.terminal=type;control.active--;
      if(type==='complete'&&this.mode==='readwrite')for(const [name,rows]of this.data)stores.set(name,rows);
      const deliver=()=>{control.log.push('terminal:'+type);this.dispatchEvent(new Event(type));};
      if(this.fault.holdTerminal)control.held.push(deliver);else setImmediate(deliver);
    }
    abort(){
      control.log.push('abort-call:'+this.status);
      if(this.status!=='active')throw dom('InvalidStateError','abort() on finished transaction');
      this.status='aborted';this.error=this.fault.terminalError||null;this.finish('abort');
    }
    objectStore(name){
      if(this.status!=='active')throw this.fault.livenessError||dom();
      if(!this.names.includes(name))throw dom('NotFoundError','store missing');
      const make=(method,key,value)=>{
        if(this.status!=='active')throw this.fault.livenessError||dom();
        if(this.fault.creationError&&name===this.fault.creationStore)throw this.fault.creationError;
        const request=new EventTarget();this.pending++;control.log.push(method+':'+name);
        setImmediate(()=>{
          if(this.status!=='active'){request.error=dom('AbortError');request.dispatchEvent(new Event('error'));this.pending--;return;}
          const rows=this.data.get(name);
          request.result=method==='get'?clone(rows.get(key)):key;
          if(method!=='get')rows.set(key,clone(value));
          this.seen++;this.fault.beforeSuccess?.({tx:this,request,store:name,method,count:this.seen});
          // A previous success listener can abort before the adapter listener runs.
          request.dispatchEvent(new Event('success'));this.pending--;
          if(this.status==='active'&&this.pending===0){this.status='complete';this.finish('complete');}
        });
        return request;
      };
      return {keyPath:null,autoIncrement:false,indexNames:[],get:key=>make('get',key),add:(value,key)=>make('add',key,value),put:(value,key)=>make('put',key,value)};
    }
  }
  const db=new EventTarget();Object.assign(db,{version:A.DB_VERSION,objectStoreNames:{length:A.STORES.length,contains:name=>stores.has(name)},close(){},
    transaction(names,mode,options){
      names=[...names];let fault;
      if(control.next&&(!control.next.match||control.next.match(names,mode))){fault=control.next;control.next=null;}
      return new Transaction(names,mode,options,fault);
    }});
  const indexedDB={open(){const request=new EventTarget();request.result=db;setImmediate(()=>request.dispatchEvent(new Event('success')));return request;}};
  return {indexedDB,stores,control,arm:fault=>{control.next=fault;},release(){for(const deliver of control.held.splice(0))deliver();}};
}

(async()=>{
  const C=await import(url('contract.mjs')),F=await import(url('finale-completion.mjs'));
  const {createCoordinator}=await import(url('coordinator.mjs'));
  const fixture=require('./evidence-finale-controller-fixture.cjs'),phase=fixture.phases[0],seed=fixture.seed(phase);
  const scope='fixture:read-abort',context={scope,generation:1,sourceIdentity:'fixture:source'};
  const artifact=F.makeFinaleCompletion({scope,run:'read-abort',checkpoint:phase.state,sourceText:seed[fixture.sourceKey(phase.chapter)],
    storyText:seed[fixture.storyKey(phase.chapter)],binding:fixture.binding(phase)});
  const descriptor=await C.descriptor(artifact.descriptor,crypto.webcrypto);
  const request={descriptor:artifact.descriptor,expectedHead:null,ordinal:0,offset:0,previousRoot:C.ZERO,payload:artifact.bytes};
  request.seal={totalBytes:artifact.bytes.length,root:await C.chain(descriptor,request,request.payload,crypto.webcrypto)};
  const readFault=extra=>({match:(names,mode)=>mode==='readonly'&&names.length===3&&names.includes('payloads'),
    beforeSuccess({tx,count}){if(count===1)tx.abort();},...extra});
  async function harness({append=true,watchdogMs=1000}={}){
    const A=await import(url('adapter.mjs')+'?read-abort='+ ++serial),fake=databaseDouble(A,C);
    const adapter=A.createTestAdapter({scope,indexedDB:fake.indexedDB,crypto:crypto.webcrypto,secureContext:true,watchdogMs});
    eq((await adapter.open()).status,'open');await turn();
    const h={A,adapter,fake,read:null};
    if(append){const saved=await adapter.appendSegment(request);eq(saved.status,'committed');await turn();
      h.read={captureIdentity:{scope,run:artifact.descriptor.run},throughHead:saved.currentHead.token};}
    return h;
  }
  const group=async(name,fn)=>{await fn();groups.push(name);};
  await group('observed readonly native abort fallout normalizes after terminal and retries exact sealed bytes',async()=>{
    for(const name of ['InvalidStateError','TransactionInactiveError','AbortError']){
      const h=await harness();h.fake.arm(readFault({livenessError:dom(name),holdTerminal:true}));
      let settled=false;const pending=h.adapter.readSegments(h.read).then(value=>{settled=true;return value;});
      while(h.fake.control.held.length===0)await turn();
      await turn();eq(settled,false);eq(h.adapter.diagnostics.terminal,null);eq(h.adapter.retainedBytes,0);
      eq((await h.adapter.recover({scope})).reason,'busy');h.fake.release();
      eq(await pending,{status:'refused',reason:'transaction-aborted',errorName:null});await turn();
      eq(h.adapter.diagnostics.terminal,'abort');ok(h.adapter.diagnostics.events.includes('abort-threw:InvalidStateError'));
      const page=await h.adapter.readSegments(h.read);eq(page.status,'page');eq(page.nextCursor,null);eq(page.segments[0].payload,artifact.bytes);
      eq(h.adapter.retainedBytes,0);eq(h.fake.control.peak,1);eq(h.adapter.diagnostics.touchedWrites,0);
    }
  });
  await group('real finale gate retains sealed checkpoint and Retry only reruns full readback',async()=>{
    const h=await harness({append:false});
    const {createUnsavedResultGate}=await import(url('unsaved-result-gate.mjs')+'?read-abort='+ ++serial);
    const continued=[],coordinator=createCoordinator(h.adapter,()=>context);
    const gate=createUnsavedResultGate({coordinator,readContext:()=>context,onContinue:value=>continued.push(value)});
    h.fake.arm(readFault());
    const first=await gate.accept({...artifact,context});eq(first.state,'UNSAVED');eq(first.reason,'transaction-aborted');
    eq(first.retryEnabled,true);eq(first.continueEnabled,false);eq(first.checkpoint.offset,artifact.bytes.length);eq(h.adapter.retainedBytes,0);
    const writes=h.fake.control.transactions.filter(tx=>tx.mode==='readwrite').length;eq(writes,1);
    gate.continue();eq(continued.length,0);
    const retried=await gate.retry();eq(retried.state,'READY');eq(retried.diagnostics.admissions,2);
    eq(h.fake.control.transactions.filter(tx=>tx.mode==='readwrite').length,writes);
    eq(h.adapter.diagnostics.chainHashes,1);eq(h.adapter.diagnostics.outputBytes>artifact.bytes.length,true);
    gate.continue();gate.continue();eq(continued,[phase.state]);eq(h.fake.control.peak,1);
  });
  await group('validation and corruption remain precise blocking failures, including during external abort',async()=>{
    for(const [store,mutate,reason]of [
      ['heads',value=>{value.charge++;},'head-corrupt'],
      ['segments',value=>{value.version=2;},'segment-missing-or-format'],
      ['payloads',value=>new Uint8Array(value.length-1),'segment-bytes-corrupt']]){
      for(const externalAbort of [false,true]){
        const h=await harness();h.fake.arm(readFault({beforeSuccess({tx,request,store:name}){
          if(name===store){request.result=mutate(request.result)||request.result;if(externalAbort)tx.abort();}
        }}));
        const result=await h.adapter.readSegments(h.read);eq(result.reason,reason);eq(h.adapter.diagnostics.terminal,'abort');eq(h.adapter.retainedBytes,0);
      }
    }
    const h=await harness({append:false});const {createUnsavedResultGate}=await import(url('unsaved-result-gate.mjs')+'?read-corrupt='+ ++serial);
    h.fake.arm(readFault({beforeSuccess({tx,request,store}){if(store==='heads'){request.result.charge++;tx.abort();}}}));
    const gate=createUnsavedResultGate({coordinator:createCoordinator(h.adapter,()=>context),readContext:()=>context,onContinue(){throw Error('must not continue');}});
    const view=await gate.accept({...artifact,context});eq(view.state,'BLOCKED');eq(view.reason,'storage-refused');eq(view.retryEnabled,false);
  });
  await group('non-native, non-aborted and conflicting terminal errors never gain abort classification',async()=>{
    const named=Object.assign(Error('ordinary error with native-looking name'),{name:'InvalidStateError'});
    for(const error of [named,dom('NotFoundError','missing store')]){
      const h=await harness();h.fake.arm(readFault({livenessError:error}));
      eq((await h.adapter.readSegments(h.read)).reason,error.message);
    }
    const h=await harness();h.fake.arm(readFault({beforeSuccess:null,creationStore:'segments',creationError:dom('InvalidStateError','unrelated active-store exception')}));
    eq((await h.adapter.readSegments(h.read)).reason,'unrelated active-store exception');
    for(const [name,expected]of [['QuotaExceededError','native-quota'],['SecurityError','storage-unavailable'],['UnknownError','native terminal problem']]){
      const other=await harness();other.fake.arm(readFault({terminalError:dom(name,'native terminal problem')}));
      const result=await other.adapter.readSegments(other.read);eq(result.reason,expected);eq(result.errorName,name);
    }
    const aborted=await harness();aborted.fake.arm(readFault({terminalError:dom('AbortError','browser-localized abort text')}));
    eq((await aborted.adapter.readSegments(aborted.read)).reason,'transaction-aborted');
  });
  await group('terminal-only AbortError canonicalizes for readonly recovery, without request fallout',async()=>{
    const h=await harness({append:false});h.fake.arm({match:(_names,mode)=>mode==='readonly',terminalError:dom('AbortError','localized recovery abort'),
      beforeSuccess({tx}){tx.abort();}});
    eq(await h.adapter.recover({scope}),{status:'refused',reason:'transaction-aborted',errorName:'AbortError'});
  });
  await group('watchdog remains unknown until late terminal and retains physical ownership',async()=>{
    const h=await harness({watchdogMs:50});h.fake.arm(readFault({holdTerminal:true}));
    eq(await h.adapter.readSegments(h.read),{status:'outcomeUnknown',reason:'terminal-unobserved'});
    eq(h.adapter.diagnostics.terminal,null);eq(h.adapter.retainedBytes,0);eq((await h.adapter.readSegments(h.read)).reason,'busy');
    h.fake.release();await turn();await turn();eq((await h.adapter.readSegments(h.read)).status,'page');
  });
  await group('readwrite native reason and unknown-outcome retry lease are unchanged',async()=>{
    const cascade=await harness({append:false});cascade.fake.arm({match:(_names,mode)=>mode==='readwrite',
      creationStore:'heads',creationError:dom('QuotaExceededError','write request construction failed')});
    eq((await cascade.adapter.appendSegment(request)).reason,'localized native transaction message');
    eq(cascade.adapter.retainedBytes,0);
    const h=await harness({append:false});h.fake.arm({match:(_names,mode)=>mode==='readwrite',terminalError:dom('AbortError','existing write abort reason'),
      beforeSuccess({tx,count}){if(count===1)tx.abort();}});
    eq((await h.adapter.appendSegment(request)).reason,'existing write abort reason');eq(h.adapter.retainedBytes,0);await turn();
    eq((await h.adapter.appendSegment(request)).status,'committed');
    const unknown=await harness({append:false,watchdogMs:50});unknown.fake.arm({match:(_names,mode)=>mode==='readwrite',holdTerminal:true});
    eq(await unknown.adapter.appendSegment(request),{status:'outcomeUnknown',reason:'terminal-unobserved'});
    ok(unknown.adapter.retainedBytes>0);eq((await unknown.adapter.retry()).reason,'busy');
    const foreign=unknown.A.createTestAdapter({scope,indexedDB:unknown.fake.indexedDB,crypto:crypto.webcrypto,secureContext:true});
    unknown.fake.release();await turn();await turn();eq((await foreign.retry()).reason,'no-retry');
    eq((await unknown.adapter.retry()).status,'duplicate');await turn();eq(unknown.adapter.retainedBytes,0);eq(unknown.fake.control.peak,1);
  });
  await group('actual abortWith function preserves first explicit failure across later abort fallout',async()=>{
    // Extract the exact internal function for otherwise unreachable hostile
    // callback-order controls; no source rewriting or production seam is needed.
    const source=fs.readFileSync(path.join(root,'adapter.mjs'),'utf8');
    const body=source.match(/  function abortWith\([\s\S]+?\n  }\n  function transaction/)[0].replace(/\n  function transaction$/,'');
    const classify=source.match(/function errorReason\(e\)\{[^\n]+\}/)[0];
    const abortWith=vm.runInNewContext(classify+'\n'+body+'\nabortWith',{DOMException,event:()=>{}});
    const tx={mode:'readonly',abort(){throw dom('InvalidStateError');}};
    const op={};abortWith(op,tx,Error('head-corrupt'));abortWith(op,tx,dom(),true);abortWith(op,tx,Error('segment-chain-corrupt'));
    eq(op.failure,'head-corrupt');eq(op.nativeAbortFailure,false);
    const candidate={};abortWith(candidate,tx,dom(),true);eq(candidate.nativeAbortFailure,true);
    abortWith(candidate,tx,Error('segment-chain-corrupt'));abortWith(candidate,tx,dom(),true);
    eq(candidate.failure,'segment-chain-corrupt');eq(candidate.nativeAbortFailure,false);
    const callback={};abortWith(callback,tx,dom());eq(callback.nativeAbortFailure,false);
  });
  console.log(JSON.stringify({test:'evidence-read-abort',status:'pass',checks,groups,nativeIndexedDB:'not-run',browserOrSocket:'not-used',productionReady:false}));
})().catch(error=>{console.error(error);process.exitCode=1;});
