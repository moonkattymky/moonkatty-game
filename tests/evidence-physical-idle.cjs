'use strict';
// Socket-free lifecycle tests of the real adapter and coordinator. Event/clock
// doubles control delivery; native WebCrypto computes the actual archive hashes.
// These checks do not claim native IndexedDB, browser durability or runtime wiring.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'../prototypes/evidence-indexeddb'),url=name=>pathToFileURL(path.join(root,name)).href;
const turn=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
let checks=0,serial=0;const groups=[];
const eq=(a,b,note)=>{assert.deepStrictEqual(a,b,note);checks++;};
const ok=(value,note)=>{assert(value,note);checks++;};
const throws=fn=>{assert.throws(fn,TypeError);checks++;};

function watchdogClock(){
  const nativeSet=global.setTimeout,nativeClear=global.clearTimeout,timers=new Map();let id=0;
  // A real outer deadline catches an accidentally unfulfilled test promise.
  const deadline=nativeSet(()=>{console.error('physical-idle test deadline exceeded');process.exit(1);},10000);
  global.setTimeout=(fn,ms)=>{const token=++id;timers.set(token,{fn,ms});return token;};
  global.clearTimeout=token=>timers.delete(token);
  return {expire(){eq(timers.size,1,'exactly one canonical operation watchdog');const [token,timer]=timers.entries().next().value;
      eq(timer.ms,15000);timers.delete(token);timer.fn();},
    get pending(){return timers.size;},restore(){global.setTimeout=nativeSet;global.clearTimeout=nativeClear;nativeClear(deadline);}};
}

function digestDouble(){
  let next=null;const control={calls:0,held:0};
  return {control,arm(){ok(next===null);const entered=deferred(),gate=deferred();
      const held={entered:entered.promise,release:()=>gate.resolve(),reject:()=>gate.reject(Error('delayed-digest-failed'))};
      next={entered,gate};return held;},
    crypto:{subtle:{digest(algorithm,input){control.calls++;const result=crypto.webcrypto.subtle.digest(algorithm,input);
      if(!next)return result;const held=next;next=null;control.held++;held.entered.resolve();
      return held.gate.promise.then(()=>result).finally(()=>{control.held--;});}}}};
}

function databaseDouble(A,C){
  const stores=new Map(A.STORES.map(name=>[name,new Map()]));
  stores.get('meta').set('global',{version:1,format:C.FORMAT,quota:C.LIMIT.quota,captureLimit:C.LIMIT.captures,
    bytes:C.LIMIT.counters,captures:0,segments:0});
  const control={openCalls:0,closes:0,transactions:[],log:[]};let nextOpen=null,nextTransaction=null;
  const clone=value=>value===undefined?undefined:structuredClone(value);
  class Transaction extends EventTarget{
    constructor(names,mode,options,fault){super();this.names=names;this.mode=mode;this.durability=options?.durability||'default';
      this.error=null;this.status='active';this.pending=0;this.fault=fault;
      this.data=mode==='readwrite'?new Map([...stores].map(([name,rows])=>[name,new Map([...rows].map(([key,value])=>[key,clone(value)]))])):stores;
      control.transactions.push(this);if(fault?.abort)setImmediate(()=>this.abort());
    }
    finish(type){if(this.terminal)return;this.terminal=type;
      if(type==='complete'&&this.mode==='readwrite')for(const [name,rows]of this.data)stores.set(name,rows);
      const deliver=()=>{control.log.push('terminal:'+type);this.dispatchEvent(new Event(type));};
      // Delivery follows already queued request events, including abort fallout.
      setImmediate(()=>{if(this.fault){this.fault.deliver=deliver;this.fault.ready.resolve(this);}else deliver();});
    }
    abort(){control.log.push('abort:'+this.status);if(this.status!=='active')throw new DOMException('already finished','InvalidStateError');
      this.status='aborted';this.finish('abort');
    }
    objectStore(name){
      if(this.status!=='active')throw new DOMException('inactive transaction','TransactionInactiveError');
      if(!this.names.includes(name))throw new DOMException('missing store','NotFoundError');
      const make=(method,key,value)=>{if(this.status!=='active')throw new DOMException('inactive transaction','TransactionInactiveError');
        const request=new EventTarget();this.pending++;control.log.push(method+':'+name);
        setImmediate(()=>{
          if(this.status!=='active'){request.error=new DOMException('aborted','AbortError');request.dispatchEvent(new Event('error'));this.pending--;return;}
          const rows=this.data.get(name);request.result=method==='get'?clone(rows.get(key)):key;
          if(method==='add'&&rows.has(key)){request.error=new DOMException('duplicate key','ConstraintError');
            request.dispatchEvent(new Event('error'));this.pending--;this.abort();return;}
          if(method!=='get')rows.set(key,clone(value));request.dispatchEvent(new Event('success'));this.pending--;
          if(this.status==='active'&&this.pending===0){this.status='complete';this.finish('complete');}
        });return request;
      };
      return {keyPath:null,autoIncrement:false,indexNames:[],get:key=>make('get',key),add:(value,key)=>make('add',key,value),put:(value,key)=>make('put',key,value)};
    }
  }
  const db=new EventTarget();Object.assign(db,{version:A.DB_VERSION,objectStoreNames:{length:A.STORES.length,contains:name=>stores.has(name)},
    close(){control.closes++;},transaction(names,mode,options){names=[...names];let fault=null;
      if(nextTransaction&&nextTransaction.match(names,mode)){fault=nextTransaction;nextTransaction=null;}
      return new Transaction(names,mode,options,fault);}});
  return {control,stores,indexedDB:{open(){control.openCalls++;const request=new EventTarget();request.result=db;
      if(nextOpen){const held=nextOpen;nextOpen=null;held.request=request;held.ready.resolve(request);}
      else setImmediate(()=>request.dispatchEvent(new Event('success')));return request;}},
    holdOpen(){ok(nextOpen===null);const held={ready:deferred(),request:null};nextOpen=held;
      return {ready:held.ready.promise,dispatch(type){if(type==='error')held.request.error=new DOMException('late open failure','UnknownError');
        held.request.dispatchEvent(new Event(type));}};},
    holdTransaction(match,{abort=false}={}){ok(nextTransaction===null);const held={match,abort,ready:deferred(),deliver:null};nextTransaction=held;
      return {ready:held.ready.promise,release(){const deliver=held.deliver;held.deliver=null;assert(deliver,'terminal delivery is one-shot');deliver();}};}};
}

(async()=>{
  const C=await import(url('contract.mjs')),{createCoordinator}=await import(url('coordinator.mjs'));
  const scope='fixture:physical-idle',context={scope,generation:1,sourceIdentity:'fixture:exact-source'};
  const frame=C.frame([{name:'sample',encoding:'utf8',text:'physical-idle archive'}]);
  const descriptor={format:C.FORMAT,scope,run:'physical-idle',kind:'synthetic',model:'v1',components:frame.components,note:''};
  const d=await C.descriptor(descriptor,crypto.webcrypto);
  const request={descriptor,expectedHead:null,ordinal:0,offset:0,previousRoot:C.ZERO,payload:frame.bytes};
  request.seal={totalBytes:frame.bytes.length,root:await C.chain(d,request,request.payload,crypto.webcrypto)};
  const readMatch=(names,mode)=>mode==='readonly'&&names.length===3&&names.includes('payloads');
  const recoverMatch=(names,mode)=>mode==='readonly'&&names.length===3&&names.includes('indices');
  const writeMatch=(_names,mode)=>mode==='readwrite';
  const clock=watchdogClock();
  async function idle(h){while(h.adapter.physicalBusy)await turn();eq(h.digest.control.held,0);eq(clock.pending,0);}
  async function harness({open=true,seed=false}={}){
    // Each case has a new module realm; all observers within it share the same
    // imported factory, so same-scope and foreign-scope instances share one slot.
    const A=await import(url('adapter.mjs')+'?physical-idle='+ ++serial),fake=databaseDouble(A,C),digest=digestDouble();let contextReads=0;
    const options={indexedDB:fake.indexedDB,crypto:digest.crypto,secureContext:true};
    const adapter=A.createTestAdapter({scope,...options}),peer=A.createTestAdapter({scope,...options}),foreign=A.createTestAdapter({scope:scope+':other',...options});
    const coordinator=createCoordinator(adapter,()=>{contextReads++;return context;});
    const h={A,adapter,peer,foreign,coordinator,fake,digest,get contextReads(){return contextReads;}};
    if(open){eq(await adapter.open(),{status:'open',createdNew:false});await idle(h);}
    if(seed){h.saved=await coordinator.appendSegment(request,context);eq(h.saved.status,'committed');await idle(h);
      h.read={captureIdentity:{scope,run:descriptor.run},throughHead:h.saved.currentHead.token};}
    return h;
  }
  function observe(h,busy){for(const observer of [h.adapter,h.peer,h.foreign,h.coordinator])eq(observer.physicalBusy,busy);}
  const group=async(name,fn)=>{await fn();eq(clock.pending,0);groups.push(name);};
  try{
    await group('read-only canonical observation spans scopes and never performs work',async()=>{
      const h=await harness({open:false});observe(h,false);
      eq(Object.getOwnPropertyNames(h.adapter).sort(),['open','appendSegment','retry','readSegments','recover','close','diagnostics','physicalBusy','retainedBytes','state','createdNew','scope'].sort());
      eq(Object.getOwnPropertyNames(h.coordinator).sort(),['appendSegment','retry','readSegments','recover','retainedBytes','inFlight','physicalBusy'].sort());
      for(const target of [h.adapter,h.coordinator]){ok(Object.isFrozen(target));const property=Object.getOwnPropertyDescriptor(target,'physicalBusy');
        eq(typeof property.get,'function');eq(property.set,undefined);eq(property.configurable,false);
        throws(()=>{target.physicalBusy=false;});throws(()=>{delete target.physicalBusy;});throws(()=>Object.defineProperty(target,'physicalBusy',{value:false}));}
      const held=h.fake.holdOpen(),pending=h.adapter.open();await held.ready;observe(h,true);eq(h.coordinator.inFlight,false);eq(h.adapter.retainedBytes,0);
      const before={diagnostics:h.adapter.diagnostics,contextReads:h.contextReads,log:[...h.fake.control.log],opens:h.fake.control.openCalls,digests:h.digest.control.calls};
      for(let i=0;i<8;i++)observe(h,true);
      eq({diagnostics:h.adapter.diagnostics,contextReads:h.contextReads,log:h.fake.control.log,opens:h.fake.control.openCalls,digests:h.digest.control.calls},before);
      eq(await h.peer.open(),{status:'refused',reason:'busy'});eq(await h.foreign.recover({scope:scope+':other'}),{status:'refused',reason:'busy'});
      eq(await h.coordinator.appendSegment(request,context),{status:'refused',reason:'busy',contextCurrent:true});
      h.foreign.close();eq(h.foreign.state,'draining');observe(h,true);eq(h.fake.control.openCalls,1);
      held.dispatch('success');observe(h,true);eq((await pending).status,'open');observe(h,false);
      eq(h.fake.control.transactions.length,1);eq(h.adapter.retainedBytes,0);
    });
    await group('abandoned opens remain physical until late success or error',async()=>{
      for(const reason of ['open-timeout','open-blocked','adapter-closed'])for(const terminal of ['success','error']){
        const h=await harness({open:false}),held=h.fake.holdOpen();let settlements=0;
        const pending=h.adapter.open().then(result=>{settlements++;return result;});await held.ready;observe(h,true);
        if(reason==='open-timeout')clock.expire();else if(reason==='open-blocked')held.dispatch('blocked');else h.adapter.close();
        eq(await pending,{status:'refused',reason});observe(h,true);eq(h.coordinator.inFlight,false);eq(h.adapter.retainedBytes,0);
        eq(await h.peer.open(),{status:'refused',reason:'busy'});held.dispatch(terminal);observe(h,true);await idle(h);observe(h,false);
        eq(settlements,1);eq(h.fake.control.closes,terminal==='success'?1:0);eq(h.fake.control.transactions.length,0);
      }
    });
    await group('append watchdog settlement does not cancel a native-like pending digest',async()=>{
      for(const terminal of ['resolve','reject']){
        const h=await harness(),held=h.digest.arm(),transactions=h.fake.control.transactions.length;let settlements=0;
        const pending=h.coordinator.appendSegment(request,context).then(result=>{settlements++;return result;});await held.entered;
        observe(h,true);eq(h.coordinator.inFlight,true);eq(h.adapter.retainedBytes,0);clock.expire();
        eq(await pending,{status:'refused',reason:'operation-timeout',contextCurrent:true});eq(h.coordinator.inFlight,false);observe(h,true);
        eq(await h.peer.open(),{status:'refused',reason:'busy'});eq(await h.coordinator.retry(),{status:'refused',reason:'no-retry'});observe(h,true);
        if(terminal==='resolve')held.release();else held.reject();observe(h,true);await idle(h);observe(h,false);
        eq(settlements,1);eq(h.fake.control.transactions.length,transactions);eq(h.adapter.retainedBytes,0);eq(h.adapter.diagnostics.liveAccountedBytes,0);
      }
    });
    await group('read and recovery remain busy through late terminal and post-transaction hashing',async()=>{
      for(const kind of ['read','recover']){
        const h=await harness({seed:true}),held=h.fake.holdTransaction(kind==='read'?readMatch:recoverMatch);let settlements=0;
        const invoke=()=>kind==='read'?h.coordinator.readSegments(h.read):h.coordinator.recover({scope,maxHeads:1,maxBytes:8192});
        const pending=invoke().then(result=>{settlements++;return result;});await held.ready;observe(h,true);
        eq(h.coordinator.inFlight,false);eq(h.adapter.retainedBytes,0);eq(h.adapter.diagnostics.terminal,null);clock.expire();
        eq(await pending,{status:'outcomeUnknown',reason:'terminal-unobserved'});observe(h,true);eq(h.adapter.retainedBytes,0);
        eq(await h.peer.open(),{status:'refused',reason:'busy'});
        const digest=h.digest.arm();held.release();observe(h,true);await digest.entered;
        eq(h.adapter.diagnostics.terminal,'complete');observe(h,true);eq(h.coordinator.inFlight,false);eq(h.adapter.retainedBytes,0);
        eq(await h.foreign.open(),{status:'refused',reason:'busy'});digest.release();await idle(h);observe(h,false);eq(settlements,1);
        const result=await invoke();eq(result.status,'page');eq(result.nextCursor,null);
        if(kind==='read'){eq(result.payloadBytes,frame.bytes.length);eq(result.segments[0].payload,frame.bytes);}
        else{eq(result.watermark,1);eq(result.heads.length,1);eq(result.heads[0].head.token,h.saved.currentHead.token);}
        eq(h.adapter.diagnostics.touchedWrites,0);observe(h,false);eq(h.adapter.retainedBytes,0);
      }
    });
    await group('unknown append lease remains separate from physical idle and exact retry',async()=>{
      for(const abort of [false,true]){
        const h=await harness(),held=h.fake.holdTransaction(writeMatch,{abort});let settlements=0;
        const pending=h.coordinator.appendSegment(request,context).then(result=>{settlements++;return result;});await held.ready;
        observe(h,true);eq(h.coordinator.inFlight,true);eq(h.adapter.retainedBytes,0);clock.expire();
        eq(await pending,{status:'outcomeUnknown',reason:'terminal-unobserved',contextCurrent:true});observe(h,true);eq(h.coordinator.inFlight,false);
        const retained=C.snapshotRequest(request).requestBytes;eq(h.adapter.retainedBytes,retained);eq(h.coordinator.retainedBytes,retained);
        eq(await h.coordinator.retry(),{status:'refused',reason:'busy',contextCurrent:true});observe(h,true);
        held.release();observe(h,true);await idle(h);observe(h,false);eq(settlements,1);eq(h.adapter.diagnostics.terminal,abort?'abort':'complete');
        eq(h.adapter.retainedBytes,retained);eq(h.adapter.diagnostics.liveAccountedBytes,retained);
        eq(await h.peer.retry(),{status:'refused',reason:'no-retry'});eq(await h.peer.appendSegment(request),{status:'refused',reason:'retry-pending'});
        const page=await h.coordinator.recover({scope,maxHeads:1,maxBytes:8192});eq(page.status,'page');eq(page.watermark,abort?0:1);
        observe(h,false);eq(h.adapter.retainedBytes,retained);
        const digest=h.digest.arm(),retry=h.coordinator.retry();await digest.entered;observe(h,true);eq(h.coordinator.inFlight,true);eq(h.adapter.retainedBytes,retained);
        digest.release();const retried=await retry;eq(retried.status,abort?'committed':'duplicate');eq(retried.contextCurrent,true);observe(h,false);
        eq(h.adapter.retainedBytes,0);eq(h.coordinator.retainedBytes,0);eq(h.coordinator.inFlight,false);eq(await h.coordinator.retry(),{status:'refused',reason:'no-retry'});
        const read=await h.coordinator.readSegments({captureIdentity:{scope,run:descriptor.run},throughHead:retried.currentHead.token});
        eq(read.status,'page');eq(read.segments[0].payload,frame.bytes);observe(h,false);
      }
    });
    await group('ordinary success and refusal keep existing caller classifications and release only their work',async()=>{
      const h=await harness({seed:true});observe(h,false);
      eq(await h.adapter.recover({scope:'unrelated'}),{status:'refused',reason:'scope-mismatch'});observe(h,false);
      eq(await h.adapter.readSegments({...h.read,maxBytes:0}),{status:'refused',reason:'read-invalid'});observe(h,false);
      eq(await h.adapter.recover({scope,maxHeads:0}),{status:'refused',reason:'recover-invalid'});observe(h,false);
      const held=h.fake.holdTransaction(readMatch),pending=h.coordinator.readSegments(h.read);await held.ready;observe(h,true);
      const diagnostics=h.adapter.diagnostics;eq(await h.peer.recover({scope}),{status:'refused',reason:'busy'});eq(h.adapter.diagnostics,diagnostics);observe(h,true);
      held.release();eq((await pending).status,'page');observe(h,false);eq(h.coordinator.inFlight,false);eq(h.adapter.retainedBytes,0);
      h.adapter.close();observe(h,false);eq(await h.adapter.open(),{status:'refused',reason:'adapter-closed'});observe(h,false);
    });
    console.log(JSON.stringify({test:'evidence-physical-idle',status:'pass',checks,groups,nativeIndexedDB:'not-run',browserOrSocket:'not-used',productionReady:false}));
  }finally{clock.restore();}
})().catch(error=>{console.error(error);process.exitCode=1;});
