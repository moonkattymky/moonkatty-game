/* The actual storage adapter must never turn a partial native read into a cloud overwrite. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),Codec=require('../trace-codec.js');
const full={mkty_story_plan_1_v1:'{"checkpoint":"first"}',mkty_story_plan_2_v1:'{"checkpoint":"disk-only-second"}'};
function fixture(){
 const data=new Map(Object.entries({...full,mkty_cloud_revision:'1',mkty_cloud_dirty:'yes'})),events=new Map(),nodes=new Map(),timers=[];let fail='',uploads=0,revision=1,cloud={...full},uploadHook=async()=>{},failAfterDirtyRemoval=false;
 const native={getItem(k){if((fail==='get'&&k==='mkty_story_plan_2_v1')||(fail==='dirty'&&k==='mkty_cloud_dirty'))throw Error('native read denied');return data.get(k)??null;},setItem:(k,v)=>data.set(k,String(v)),removeItem(k){data.delete(k);if(failAfterDirtyRemoval&&k==='mkty_cloud_dirty'){failAfterDirtyRemoval=false;fail='dirty';}},key(i){if(fail==='keys')throw Error('native enumeration denied');return [...data.keys()][i];},get length(){return data.size;}};
 const on=(type,fn)=>events.set(type,[...(events.get(type)||[]),fn]);
 const emit=e=>{for(const fn of events.get(e.type)||[])fn(e);};
 const create=tag=>({tagName:String(tag).toUpperCase(),children:[],style:{},setAttribute(){},replaceChildren(...xs){this.children=xs;},append(...xs){this.children.push(...xs);for(const x of xs)if(x.id)nodes.set(x.id,x);},remove(){nodes.delete(this.id);}});
 const c={console,localStorage:native,sessionStorage:{length:0,key(){},getItem(){}},URLSearchParams,MKTYTraceCodec:Codec,Telegram:{WebApp:{initData:'test-only'}},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},addEventListener:on,dispatchEvent:emit,setTimeout(fn){timers.push(fn);return timers.length;},clearTimeout(){},queueMicrotask(fn){fn();},location:{reload(){throw Error('unexpected reload');}}};
 c.document={body:create('body'),hidden:false,createElement:create,createTextNode:text=>({textContent:text}),getElementById:k=>nodes.get(k),querySelector:()=>({id:'home'}),addEventListener:(type,fn)=>on('doc:'+type,fn)};
 c.MKTYRewards={endpoint:'local-only',traceProtocol:async()=>Codec.PROTOCOL,authenticatedFetch:async(_url,body)=>{if(body.snapshot){uploads++;await uploadHook();cloud=body.snapshot;revision++;return {ok:true,revision,protocol:Codec.PROTOCOL};}return {ok:true,revision,snapshot:cloud,protocol:Codec.PROTOCOL};}};
 c.window=c;c.globalThis=c;vm.createContext(c);
 for(const file of ['storage.js','cloud-save.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),c,{filename:file});
 return {c,nodes,data,timers,fail:kind=>fail=kind,failAfterDirtyRemoval:()=>failAfterDirtyRemoval=true,uploads:()=>uploads,cloud:()=>cloud,holdUpload(){let start,resolve,reject;const started=new Promise(r=>start=r),pending=new Promise((r,j)=>{resolve=r;reject=j;});uploadHook=()=>{start();return pending;};return {started,resolve,reject};}};
}
(async()=>{
 for(const kind of ['get','keys']){
  const f=fixture();await f.c.MKTYCloud.load();f.fail(kind);
  await f.c.MKTYCloud.flush();assert.equal(f.uploads(),0,kind+': capture failure cannot upload partial data');assert.equal(f.c.MKTYStorage.persistent,false);assert.equal(f.c.localStorage.getItem('mkty_cloud_dirty'),'yes');assert.deepEqual(f.cloud(),full);
  assert.match(f.nodes.get('cloudSaveStatus').children[0].textContent,/Restore device saving/);
  assert(f.nodes.get('storageRecovery'),'existing memory-only recovery warning remains');
  await f.c.MKTYCloud.flush();assert.equal(f.uploads(),0,kind+': already-incomplete storage remains blocked');
  f.fail('');assert.equal(f.c.MKTYStorage.retry(),true);await f.c.MKTYCloud.flush();assert.equal(f.uploads(),1);assert.deepEqual(Codec.unpackSnapshot(f.cloud()),full,'only a complete later capture is acknowledged');assert.equal(f.c.localStorage.getItem('mkty_cloud_dirty'),null);
 }
 // Timer-triggered flushes have no caller awaiting their promise. Checked dirty
 // metadata reads must be fenced both before capture and after the upload await.
 const unhandled=[],onUnhandled=error=>unhandled.push(error),settle=()=>new Promise(resolve=>setImmediate(resolve));
 process.on('unhandledRejection',onUnhandled);
 try{
  const early=fixture();await early.c.MKTYCloud.load();early.fail('dirty');early.timers.shift()();await settle();
  assert.equal(early.uploads(),0);assert.equal(early.data.get('mkty_cloud_dirty'),'yes');assert.equal(early.c.MKTYStorage.persistent,false);assert.equal(early.timers.length,0);
  assert.match(early.nodes.get('cloudSaveStatus').children[0].textContent,/Restore device saving/);
  for(const succeeded of [false,true]){
   const f=fixture();await f.c.MKTYCloud.load();const pending=f.holdUpload();f.timers.shift()();await pending.started;
   if(succeeded){f.failAfterDirtyRemoval();pending.resolve();}else{f.fail('dirty');pending.reject(Error('offline'));}await settle();
   assert.equal(f.uploads(),1);assert.equal(f.c.MKTYStorage.persistent,false);assert.equal(f.timers.length,0);
   assert.match(f.nodes.get('cloudSaveStatus').children[0].textContent,/Restore device saving/);
   if(!succeeded){assert.equal(f.data.get('mkty_cloud_dirty'),'yes');assert.deepEqual(f.cloud(),full);}
   f.fail('');assert.equal(f.c.MKTYStorage.retry(),true);await assert.doesNotReject(f.c.MKTYCloud.flush());
  }
  assert.deepEqual(unhandled,[],'automatic flush must not leak checked metadata read failures');
 }finally{process.removeListener('unhandledRejection',onUnhandled);}
 console.log('PASS: native read/enumeration/dirty metadata failures preserve warnings and evidence without partial cloud uploads or unhandled automatic flush rejections');
})().catch(error=>{console.error(error);process.exitCode=1;});
