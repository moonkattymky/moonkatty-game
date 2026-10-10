/* Real transport clients in a deterministic document: no network or player account. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Codec=require('../trace-codec.js'),PROTOCOL=Codec.PROTOCOL;
const turn=()=>new Promise(resolve=>setImmediate(resolve));
const rows=(n=12000)=>Array.from({length:n},(_,i)=>['tick',1,i%2?.001:-.001,0,false,false]);
const saved=trace=>JSON.stringify({run:{seed:123},trace});
const key='mkty_story_plan_1_v1';
function harness(seed={},server){
 const stores=new Map([['101',new Map(Object.entries(seed))]]),sessions=new Map(),nodes=new Map(),events=new Map(),timers=new Map(),calls=[];let owner='101',timerId=0,active='home',reloads=0;
 const data=()=>stores.get(owner)||stores.set(owner,new Map()).get(owner);
 const emit=(name,event={})=>{for(const fn of events.get(name)||[])fn(event);};
 const on=(name,fn)=>events.set(name,[...(events.get(name)||[]),fn]);
 const create=tag=>({tagName:String(tag).toUpperCase(),children:[],style:{},hidden:false,setAttribute(){},replaceChildren(...x){this.children=x;},append(...x){this.children.push(...x);for(const el of x)if(el.id)nodes.set(el.id,el);},appendChild(x){this.append(x);},remove(){nodes.delete(this.id);}});
 const document={hidden:false,body:create('body'),createElement:create,createTextNode:text=>({textContent:text}),getElementById:id=>nodes.get(id),querySelector:()=>({id:active}),addEventListener:(name,fn)=>on('document:'+name,fn)};
 const storage={getItem:k=>data().get(k)??null,setItem:(k,v)=>{const old=data().get(k);data().set(k,String(v));if(old!==String(v))emit('mkty:storage',{detail:{key:k}});},removeItem:k=>{const had=data().delete(k);if(had)emit('mkty:storage',{detail:{key:k}});},key:i=>[...data().keys()][i],get length(){return data().size;}};
 const window={MKTYTraceCodec:Codec,Telegram:{WebApp:{initData:'user='+encodeURIComponent(JSON.stringify({id:101}))}},MKTYStorage:{identity:()=>owner,keys:()=>[...data().keys()],persistent:true},addEventListener:on,dispatchEvent:e=>emit(e.type,e)};
 const context={window,document,localStorage:storage,sessionStorage:{getItem:k=>sessions.get(k)??null,setItem:(k,v)=>sessions.set(k,v),removeItem:k=>sessions.delete(k)},location:{reload(){reloads++;emit('pagehide');}},console,URLSearchParams,AbortController,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},setTimeout:(fn,ms)=>(timers.set(++timerId,{fn,ms}),timerId),clearTimeout:id=>timers.delete(id),fetch:async(_url,opt)=>{const body=JSON.parse(opt.body);calls.push(body);const response=await server(body);return {ok:response?.ok!==false,status:response?.ok===false?400:200,json:async()=>response};}};
 vm.createContext(context);
 const run=file=>vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context,{filename:file});
 run('rewards-client.js');run('cloud-save.js');
 return {window,storage,stores,calls,nodes,timers,run,emit,active:id=>active=id,reloads:()=>reloads,owner(id){owner=String(id);window.Telegram.WebApp.initData='user='+encodeURIComponent(JSON.stringify({id:Number(id)}));},text:id=>nodes.get(id)?.children?.[0]?.textContent||nodes.get(id)?.textContent||''};
}
function mock(){
 const state={modern:true,revision:0,snapshot:{},ack:true,writeRevision:true,offline:false,intercept:null};
 const player={telegram_id:101,moon_points:0,lives:9,story_life:0};
 state.handle=async body=>{
  if(state.intercept){const value=await state.intercept(body);if(value!==undefined)return value;}
  if(state.offline)return {ok:false,error:'unavailable'};
  const caps=state.modern?{capabilities:{trace_codec:PROTOCOL}}:{};
  if(body.action==='session')return {ok:true,session:{token:'test-session',expires_at:Date.now()+3600000},...caps};
  if(body.action==='player')return {ok:true,player:{...player},...caps};
  const v2=body.action.endsWith('.v2'),protocol=v2&&state.ack?{protocol:PROTOCOL}:{};
  if(v2&&!state.modern)return {ok:false,error:'action'};
  if(body.action.startsWith('campaign.cloud')){
   if(body.snapshot){if(body.revision!==state.revision)return {ok:true,conflict:true,revision:state.revision,snapshot:state.snapshot,...protocol};state.snapshot=body.snapshot;state.revision++;return {ok:true,...(state.writeRevision?{revision:state.revision}:{}),...protocol};}
   return {ok:true,revision:state.revision,snapshot:state.snapshot,...protocol};
  }
  if(body.action.startsWith('life.complete'))return {ok:true,player:{...player,moon_points:500,story_life:1},awarded:true,...protocol};
  return {ok:true};
 };
 return state;
}
(async()=>{
 const raw=saved(rows()),seed={[key]:raw,mkty_cloud_dirty:'yes'};assert(Codec.utf8Bytes(raw)>180000);
 let server=mock(),h=harness(seed,server.handle);await h.window.MKTYCloud.flush();
 const upload=h.calls.find(b=>b.snapshot);assert.equal(upload.action,'campaign.cloud.v2');assert.equal(upload.protocol,PROTOCOL);assert(Codec.utf8Bytes(upload.snapshot[key])<180000);assert.equal(h.storage.getItem(key),raw);assert.equal(h.storage.getItem('mkty_cloud_dirty'),null);assert.equal(h.storage.getItem('mkty_cloud_revision'),'1');assert.equal(Codec.unpackSnapshot(server.snapshot)[key],raw,'full evidence survives upload');
 server=mock();server.modern=false;h=harness(seed,server.handle);await h.window.MKTYCloud.flush();assert.equal(h.calls.filter(b=>b.snapshot).length,0);assert.equal(h.storage.getItem('mkty_cloud_dirty'),'yes');assert.match(h.text('cloudSaveStatus'),/too large/);
 h.storage.setItem(key,saved(rows(5)));await h.window.MKTYCloud.flush();assert.equal(h.calls.find(b=>b.snapshot).action,'campaign.cloud');assert.equal(h.storage.getItem('mkty_cloud_dirty'),null);
 // Cached capability followed by rollback never sends a marker to a legacy action.
 server=mock();h=harness(seed,server.handle);await h.window.MKTYCloud.load();server.modern=false;await h.window.MKTYCloud.flush();assert.equal(h.calls.filter(b=>b.snapshot).length,1);assert.equal(h.calls.find(b=>b.snapshot).action,'campaign.cloud.v2');assert.equal(h.storage.getItem('mkty_cloud_dirty'),'yes');assert.match(h.text('cloudSaveStatus'),/could not be verified/);await h.window.MKTYCloud.flush();assert.equal(h.calls.filter(b=>b.snapshot).length,1);
 for(const broken of ['ack','writeRevision']){server=mock();h=harness(seed,server.handle);await h.window.MKTYCloud.load();server[broken]=false;await h.window.MKTYCloud.flush();assert.equal(h.storage.getItem('mkty_cloud_dirty'),'yes',broken);assert.equal(h.storage.getItem('mkty_cloud_revision'),null,broken);}
 // Complete decode precedes every restore write, including staged reload restores.
 const malformed={mkty_current_chapter:'2',[key]:JSON.stringify({trace:[['mkty-trace',9,1,1,'AA==']]})};
 server=mock();server.revision=2;server.snapshot=malformed;h=harness({mkty_current_chapter:'1',[key]:'original'},server.handle);await h.window.MKTYCloud.load();assert.equal(h.storage.getItem(key),'original');assert.equal(h.storage.getItem('mkty_current_chapter'),'1');assert.equal(h.storage.getItem('mkty_cloud_recovery'),null);
 h=harness({[key]:'original',mkty_cloud_restore_pending:JSON.stringify({revision:2,snapshot:malformed})},mock().handle);assert.equal(h.storage.getItem(key),'original');assert(h.storage.getItem('mkty_cloud_restore_pending'));
 // Conflict selection stages expanded data. Outgoing pagehide cannot clobber it.
 server=mock();server.revision=2;server.snapshot=Codec.packSnapshot({[key]:raw});h=harness({[key]:'old',mkty_cloud_revision:'1',mkty_cloud_dirty:'yes'},server.handle);h.active('expedition');await h.window.MKTYCloud.load();h.emit('pagehide');const button=h.nodes.get('cloudSaveStatus').children.find(x=>x.tagName==='BUTTON');h.window.addEventListener('pagehide',()=>h.storage.setItem(key,'outgoing'));button.onclick();assert.equal(h.reloads(),1);assert.equal(h.storage.getItem(key),'outgoing');const staged=JSON.parse(h.storage.getItem('mkty_cloud_restore_pending'));assert.equal(Codec.unpackSnapshot(staged.snapshot)[key],raw);
 const reopened=harness(Object.fromEntries(h.stores.get('101')),server.handle);assert.equal(reopened.storage.getItem(key),raw);assert.equal(JSON.parse(reopened.storage.getItem('mkty_cloud_recovery'))[key],'outgoing');assert.equal(reopened.storage.getItem('mkty_cloud_restore_pending'),null);
 // A quota failure before staging or backup never replaces device evidence.
 h.window.MKTYStorage.persistent=false;h.storage.removeItem('mkty_cloud_restore_pending');button.onclick();assert.equal(h.reloads(),1);assert.equal(h.storage.getItem('mkty_cloud_restore_pending'),null);
 // New edits while a request is pending retain dirty, and late account replies are ignored.
 for(const changeAccount of [false,true]){server=mock();h=harness(seed,server.handle);await h.window.MKTYCloud.load();let release,started;const awaiting=new Promise(r=>started=r);server.intercept=async b=>{if(b.snapshot){started();return new Promise(r=>release=r);}};const work=h.window.MKTYCloud.flush();await awaiting;if(changeAccount){h.owner(202);h.storage.setItem(key,'new-account');}else h.storage.setItem(key,'newer-local');release({ok:true,protocol:PROTOCOL,revision:1});await work;if(changeAccount){assert.equal(h.storage.getItem('mkty_cloud_revision'),null);assert.equal(h.storage.getItem(key),'new-account');assert.equal(h.stores.get('101').get('mkty_cloud_dirty'),'yes');}else{assert.equal(h.storage.getItem(key),'newer-local');assert.equal(h.storage.getItem('mkty_cloud_dirty'),'yes');assert.equal(h.storage.getItem('mkty_cloud_revision'),'1');}}
 server=mock();h=harness(seed,server.handle);await h.window.MKTYCloud.load();server.offline=true;await h.window.MKTYCloud.flush();assert.equal(h.storage.getItem('mkty_cloud_dirty'),'yes');assert.match(h.text('cloudSaveStatus'),/retry/);
 // Actual HTTP JSON retains negative zero even when the short trace stays raw.
 for(const modern of [false,true]){server=mock();server.modern=modern;h=harness({},server.handle);const proof={route:'short',tasks:[{state:{trace:[['tick',1,-0,0],['act','trim',-0]]}}]};await h.window.MKTYRewards.call('life.complete',{life:1,proof});const sent=h.calls.find(b=>b.action.startsWith('life.complete'));const decoded=Codec.unpackProof(sent.proof);assert(Object.is(decoded.tasks[0].state.trace[0][2],-0));assert(Object.is(decoded.tasks[0].state.trace[1][2],-0));}
 // The durable intent keeps the original proof, independently of transport format.
 const evidence={route:'recorded-route',tasks:[{id:0,state:{trace:rows()}}]},pending=[{id:'life:1:complete',action:'life.complete',payload:{life:1,event_key:'life:1:complete',proof:evidence}}];
 server=mock();h=harness({mkty_pending_v2_101:JSON.stringify(pending)},server.handle);await h.window.MKTYRewards.syncPlayer();const proofCall=h.calls.find(b=>b.action==='life.complete.v2');assert(proofCall);assert.deepEqual(Codec.unpackProof(proofCall.proof),evidence);assert.equal(h.storage.getItem('mkty_pending_v2_101'),'[]');assert.equal(evidence.tasks[0].state.trace.length,12000);
 for(const failure of ['rollback','ack']){server=mock();h=harness({mkty_pending_v2_101:JSON.stringify(pending)},server.handle);await h.window.MKTYRewards.traceProtocol();h.window.MKTYCloud.load=async()=>{};server.intercept=async b=>{if(b.action==='player')return {ok:true,player:{telegram_id:101,moon_points:0,lives:9,story_life:0},capabilities:{trace_codec:PROTOCOL}};};if(failure==='rollback')server.modern=false;else server.ack=false;await h.window.MKTYRewards.syncPlayer();assert.equal(JSON.parse(h.storage.getItem('mkty_pending_v2_101')).length,1);assert.equal(h.storage.getItem('mkty_points'),'0');assert.equal(h.calls.filter(b=>b.action==='life.complete').length,0);assert.match(h.text('rewardSyncStatus'),/evidence is saved/);}
 server=mock();server.modern=false;const largeProof={route:'large',tasks:[{id:0,state:{trace:rows(24000)}}]};h=harness({mkty_pending_v2_101:JSON.stringify([{...pending[0],payload:{...pending[0].payload,proof:largeProof}}])},server.handle);await h.window.MKTYRewards.syncPlayer();assert.equal(h.calls.filter(b=>b.action.startsWith('life.complete')).length,0);assert.equal(JSON.parse(h.storage.getItem('mkty_pending_v2_101')).length,1);assert.match(h.text('rewardSyncStatus'),/evidence is saved/);
 const count=h.calls.length;const tooLarge=await h.window.MKTYRewards.authenticatedFetch(h.window.MKTYRewards.endpoint,{action:'test',text:'😀'.repeat(100000)});assert.equal(tooLarge.error,'body_too_large');assert.equal(h.calls.length,count,'HTTP envelope is checked in UTF-8, including authentication');
 console.log('PASS: compact/legacy/cached-rollback matrix, protocol/revision acknowledgement, no partial restore, conflict/pagehide/quota, account/generation/offline guards, retained queued proofs and UTF-8 request cap');
})().catch(error=>{console.error(error);process.exit(1);});
