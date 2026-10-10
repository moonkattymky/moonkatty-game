/* Queue-format and ordinary sync failures against the actual client/storage adapter.
   Synthetic VM only: no browser, socket, real player, or API access. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),test=require('node:test');
const root=path.join(__dirname,'..'),source=name=>fs.readFileSync(path.join(root,name),'utf8'),Codec=require('../trace-codec.js');
const turn=()=>new Promise(resolve=>setImmediate(resolve)),key=id=>'mkty_pending_v2_'+id;
const proof={route:'original-route',tasks:[{id:0,state:{trace:[['tick',1,0,0]]}}]};
const completion=(life=1)=>({id:'life:'+life+':complete',action:'life.complete',payload:{life,event_key:'life:'+life+':complete',proof}});
const spend=id=>({id,action:'lives.spend',payload:{event_key:id}});
function harness(){
 const data=new Map(),nodes=new Map(),timers=new Map(),events=new Map(),calls=[],settled=new Set(),players=new Map();let timerId=0,offline=false;
 const native={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k),key:i=>[...data.keys()][i],get length(){return data.size;}};
 const on=(name,fn)=>events.set(name,[...(events.get(name)||[]),fn]);
 const create=()=>({children:[],style:{},setAttribute(){},replaceChildren(...x){this.children=x;},append(...x){this.children.push(...x);for(const el of x)if(el.id)nodes.set(el.id,el);},appendChild(x){this.append(x);},remove(){nodes.delete(this.id);}});
 const player=owner=>{if(!players.has(owner))players.set(owner,{telegram_id:owner,moon_points:0,lives:9,story_life:0});return players.get(owner);};
 const c={console,URLSearchParams,AbortController,MKTYTraceCodec:Codec,Telegram:{WebApp:{}},localStorage:native,sessionStorage:{length:0,getItem(){return null;},setItem(){},removeItem(){},key(){}},
  document:{body:create(),getElementById:id=>nodes.get(id),createElement:create,addEventListener:on},addEventListener:on,dispatchEvent(e){for(const fn of events.get(e.type)||[])fn(e);},
  setTimeout:(fn,ms)=>(timers.set(++timerId,{fn,ms}),timerId),clearTimeout:id=>timers.delete(id),queueMicrotask,CustomEvent:class{constructor(type,opt){this.type=type;this.detail=opt?.detail;}},
  fetch:async(_url,opt)=>{const body=JSON.parse(opt.body);calls.push(body);const owner=Number(body.session?.replace('fixture-','')||JSON.parse(new URLSearchParams(body.initData).get('user')).id);let result;
   if(body.action==='session')result={ok:true,session:{token:'fixture-'+owner,expires_at:Date.now()+3600000}};
   else if(body.action==='player')result={ok:true,player:{...player(owner)}};
   else if(offline)result={ok:false,error:'unavailable'};
   else if(body.action==='life.complete'||body.action==='lives.spend'){
    const event=owner+':'+body.event_key;if(!settled.has(event)){settled.add(event);if(body.action==='life.complete'){player(owner).story_life=body.life;player(owner).moon_points+=500;}else player(owner).lives--;}
    result={ok:true,awarded:true,spent:true,player:{...player(owner)}};
   }else result={ok:false,error:'unavailable'};
   return {ok:result.ok!==false,status:result.ok===false?503:200,json:async()=>result};}};
 const owner=id=>c.Telegram.WebApp.initData='user='+encodeURIComponent(JSON.stringify({id:Number(id)}));owner(101);
 c.window=c;vm.createContext(c);for(const file of ['storage.js','rewards-client.js'])vm.runInContext(source(file),c,{filename:file});
 return {c,data,calls,timers,owner,settled,offline:value=>offline=value,emit:name=>c.dispatchEvent({type:name}),
  seed:(items,id=101)=>data.set(key(id),JSON.stringify(items)),raw:(id=101)=>data.get(key(id)),disk:(id=101)=>JSON.parse(data.get(key(id))||'[]'),
  text:()=>nodes.get('rewardSyncStatus')?.textContent||'',status:()=>nodes.get('rewardSyncStatus'),
  mutations:()=>calls.filter(x=>!['session','player'].includes(x.action))};
}

test('malformed rows block the whole sync without changing raw data or valid adjacent intents',async()=>{
 const malformed=[null,17,[],{id:'broken',action:'unknown',payload:{}},{id:'broken',action:'life.complete'},
  ...[null,17,'payload',[],{}].map(payload=>({id:'broken',action:'life.complete',payload})),
  ...[0,10,1.5,'1'].map(life=>({id:'broken',action:'life.complete',payload:{life,event_key:'broken'}})),
  {id:'broken',action:'lives.spend',payload:null},{id:'broken',action:'lives.spend',payload:[]},
  ...[undefined,null,'',17].map(id=>({id,action:'lives.spend',payload:{event_key:'missing-id'}})),
  ...[undefined,null,'',17].map(event_key=>({id:'missing-key',action:'lives.spend',payload:{event_key}}))];
 for(const bad of malformed)for(const first of [true,false]){
  const h=harness(),valid=[spend('valid-attempt'),completion()];h.seed(first?[bad,...valid]:[...valid,bad]);const original=h.raw();
  for(let attempt=0;attempt<2;attempt++)await assert.doesNotReject(()=>h.c.MKTYRewards.syncPlayer());
  assert.equal(h.raw(),original,'all original bytes, including valid proof, must survive');assert.equal(h.mutations().length,0,'no partial replay before a later invalid row');
  assert.equal(h.c.MKTYRewards.pendingCompletion(1),null);assert.match(h.text(),/format/i);assert.match(h.text(),/keep the game data/i);
  assert.doesNotMatch(h.text(),/only in this open game/i);assert.equal(h.status().hidden,false);assert.equal(h.timers.size,0);
 }
});

test('JSON syntax and non-array queue failures have the same honest format warning in both languages',async()=>{
 for(const raw of ['{invalid','{}','null','"queue"']){
  const h=harness();h.data.set(key(101),raw);await h.c.MKTYRewards.syncPlayer();assert.equal(h.raw(),raw);assert.equal(h.mutations().length,0);assert.match(h.text(),/format/i);
  h.c.localStorage.setItem('mkty_lang','ru');h.emit('mkty:language');assert.match(h.text(),/формат/i);assert.match(h.text(),/не очищайте данные/i);
 }
});

test('online, visibility and status-button retries resolve cleanly while a malformed queue remains intact',async()=>{
 const h=harness();h.seed([{id:'broken',action:'life.complete'},completion()]);const original=h.raw();
 for(const event of ['online','visibilitychange']){h.emit(event);await turn();await turn();assert.equal(h.raw(),original);}
 await h.status().onclick();assert.equal(h.mutations().length,0);assert.match(h.text(),/format/i);assert.equal(h.timers.size,0);
});

test('new memory-only edits never rewrite an invalid base and merge after synthetic correction',async()=>{
 const h=harness();h.offline(true);h.seed([{id:'broken',action:'life.complete'},completion()]);const original=h.raw();
 await h.c.MKTYRewards.spendLife('new-attempt');assert.equal(h.raw(),original);assert.match(h.text(),/format/i);assert.match(h.text(),/only in this open game/i);
 const before=h.mutations().length;await h.c.MKTYRewards.syncPlayer();assert.equal(h.mutations().length,before);assert.equal(h.raw(),original);
 // Only the fixture changes its synthetic bad record. The client must never repair or drop it.
 h.seed([spend('corrected-fixture'),completion()]);h.offline(false);assert(h.c.MKTYStorage.retry());await turn();await turn();
 assert.deepEqual(h.disk(),[]);assert.deepEqual([...h.settled].sort(),['101:corrected-fixture','101:life:1:complete','101:new-attempt']);
 assert.equal(h.c.localStorage.getItem('mkty_points'),'500');assert.equal(h.status().hidden,true);assert.equal(h.timers.size,0);
});

test('unexpected cloud-load rejection preserves work and a later sync can settle normally',async()=>{
 const h=harness();h.seed([completion()]);const original=h.raw();h.c.MKTYCloud={load:async()=>{throw Error('temporary load failure');}};
 assert.equal((await h.c.MKTYRewards.syncPlayer()).telegram_id,101);assert.equal(h.raw(),original);assert.equal(h.mutations().length,0);
 assert.doesNotMatch(h.text(),/format/i);assert.equal(h.c.MKTYRewards.isServerReady(),false);
 h.c.MKTYCloud.load=async()=>{};await h.c.MKTYRewards.syncPlayer();assert.deepEqual(h.disk(),[]);assert.equal(h.settled.size,1);assert.equal(h.timers.size,0);
 const events=harness();events.seed([completion()]);const raw=events.raw();events.c.MKTYCloud={load:async()=>{throw Error('temporary event-triggered load failure');}};
 for(const name of ['online','visibilitychange']){events.emit(name);await turn();await turn();assert.equal(events.raw(),raw);assert.equal(events.mutations().length,0);}
 assert.doesNotMatch(events.text(),/format/i);events.c.MKTYCloud.load=async()=>{};await events.status().onclick();assert.deepEqual(events.disk(),[]);
});

test('a late cloud failure cannot apply errors or queue work to a newer account or generation',async()=>{
 for(const returnToOriginal of [false,true]){
  const h=harness();h.seed([completion()]);let rejectOld,loads=0;h.c.MKTYCloud={load:()=>++loads===1?new Promise((_,reject)=>rejectOld=reject):Promise.resolve()};
  const old=h.c.MKTYRewards.syncPlayer();await turn();h.owner(202);await h.c.MKTYRewards.syncPlayer();
  if(returnToOriginal){h.owner(101);await h.c.MKTYRewards.syncPlayer();}
  const current=h.c.MKTYRewards.getLastPlayer(),status=h.text(),mutations=h.mutations().length;rejectOld(Error('late old-account failure'));
  assert.equal(await old,null);assert.equal(h.c.MKTYRewards.getLastPlayer(),current);assert.equal(h.c.MKTYRewards.isServerReady(),true);
  assert.equal(h.text(),status);assert.equal(h.mutations().length,mutations);assert.equal(h.timers.size,0);
 }
});

test('format state stays account-scoped and a corrected fixture is retried without new edits',async()=>{
 const h=harness();h.seed([{id:'broken',action:'life.complete'}]);await h.c.MKTYRewards.syncPlayer();const original=h.raw();
 h.owner(202);h.seed([completion()],202);await h.c.MKTYRewards.syncPlayer();assert.deepEqual(h.disk(202),[]);assert.doesNotMatch(h.text(),/format/i);assert.equal(h.raw(101),original);
 h.owner(101);h.seed([completion()]);assert(h.c.MKTYStorage.retry());await turn();await turn();assert.deepEqual(h.disk(),[]);assert.equal(h.settled.size,2);assert.equal(h.status().hidden,true);
});

test('legacy optional-proof intents and transport/proof-read failures keep normal recovery behavior',async()=>{
 const h=harness(),legacy={id:'older-event',action:'life.complete',payload:{life:1,event_key:'older-event'}};
 h.seed([spend('older-attempt'),legacy]);h.offline(true);const original=h.raw();await h.c.MKTYRewards.syncPlayer();assert.equal(h.raw(),original);assert.doesNotMatch(h.text(),/format/i);
 h.offline(false);h.c.MKTYStory={read:()=>{throw Error('temporary proof read failure');}};await h.c.MKTYRewards.syncPlayer();
 assert.deepEqual(h.disk(),[]);assert.equal(h.settled.size,2);assert.equal(h.c.localStorage.getItem('mkty_points'),'500');assert.equal(h.timers.size,0);
 const saved=harness();saved.seed([completion()]);saved.c.MKTYStory={read:()=>{throw Error('temporary proof read failure');}};await saved.c.MKTYRewards.syncPlayer();
 assert.deepEqual(saved.mutations()[0].proof,proof);assert.deepEqual(saved.disk(),[]);
});
