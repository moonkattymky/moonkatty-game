/* Ordinary storage/read/quota interruptions against the actual storage adapter and
   reward client. Synthetic VM only: no browser, socket, account or API access. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),test=require('node:test');
const root=path.join(__dirname,'..'),source=name=>fs.readFileSync(path.join(root,name),'utf8'),Codec=require('../trace-codec.js');
const turn=()=>new Promise(resolve=>setImmediate(resolve));
const pendingKey=id=>'mkty_pending_v2_'+id;
const completion=(life=1)=>({id:'life:'+life+':complete',action:'life.complete',payload:{life,event_key:'life:'+life+':complete'}});
const spend=id=>({id,action:'lives.spend',payload:{event_key:id}});
function harness(server=async()=>({ok:false,error:'unavailable'})){
 const data=new Map(),nodes=new Map(),timers=new Map(),events=new Map(),calls=[];let readFault='',writeFault='',readAfterWrite='',timerId=0;
 const native={getItem(k){if(k===readFault)throw Error('temporary device read failure');return data.get(k)??null;},setItem(k,v){if(k===writeFault)throw Error('QuotaExceededError');data.set(k,String(v));if(k===readAfterWrite){readAfterWrite='';readFault=k;}},removeItem:k=>data.delete(k),key:i=>[...data.keys()][i],get length(){return data.size;}};
 const on=(name,fn)=>events.set(name,[...(events.get(name)||[]),fn]);
 const create=()=>({children:[],style:{},setAttribute(){},replaceChildren(...x){this.children=x;},append(...x){this.children.push(...x);for(const el of x)if(el.id)nodes.set(el.id,el);},appendChild(x){this.append(x);},remove(){nodes.delete(this.id);}});
 const c={console,URLSearchParams,AbortController,MKTYTraceCodec:Codec,Telegram:{WebApp:{}},localStorage:native,sessionStorage:{length:0,getItem(){return null;},setItem(){},removeItem(){},key(){}},
  document:{body:create(),getElementById:id=>nodes.get(id),createElement:create,addEventListener:on},addEventListener:on,dispatchEvent(e){for(const fn of events.get(e.type)||[])fn(e);},
  setTimeout:(fn,ms)=>(timers.set(++timerId,{fn,ms}),timerId),clearTimeout:id=>timers.delete(id),queueMicrotask,CustomEvent:class{constructor(type,opt){this.type=type;this.detail=opt?.detail;}},
  fetch:async(_url,opt)=>{const body=JSON.parse(opt.body);calls.push(body);const owner=Number(body.session?.replace('fixture-','')||JSON.parse(new URLSearchParams(body.initData).get('user')).id);
   const result=body.action==='session'?{ok:true,session:{token:'fixture-'+owner,expires_at:Date.now()+3600000}}:body.action==='player'?{ok:true,player:{telegram_id:owner,moon_points:0,lives:9,story_life:0}}:await server(body,owner);
   return {ok:result.ok!==false,status:result.ok===false?503:200,json:async()=>result};}};
 const owner=id=>{c.Telegram.WebApp.initData='user='+encodeURIComponent(JSON.stringify({id:Number(id)}));};owner(101);
 c.window=c;vm.createContext(c);for(const file of ['storage.js','rewards-client.js'])vm.runInContext(source(file),c,{filename:file});
 return {c,data,nodes,calls,timers,owner,readFault:key=>readFault=key,writeFault:key=>writeFault=key,readAfterWrite:key=>readAfterWrite=key,
  seed:(items,id=101)=>data.set(pendingKey(id),JSON.stringify(items)),disk:(id=101)=>JSON.parse(data.get(pendingKey(id))||'[]'),
  text:()=>nodes.get('rewardSyncStatus')?.textContent||''};
}

test('unreadable prior queue survives a new intent and merges only after saving recovers',async()=>{
 const h=harness(),old=completion();h.seed([old]);const original=h.data.get(pendingKey(101));
 h.readFault(pendingKey(101));await h.c.MKTYRewards.spendLife('new-attempt');await turn();
 assert.equal(h.data.get(pendingKey(101)),original,'unreadable original bytes must remain intact');
 assert.equal(h.c.MKTYStorage.persistent,false);assert.match(h.text(),/only in this open game/i);assert.doesNotMatch(h.text(),/progress saved|reopen the game/i);
 h.readFault('');await h.c.MKTYRewards.spendLife('second-attempt');assert.equal(h.data.get(pendingKey(101)),original,'memory-only work waits for Retry saving');
 assert(h.c.MKTYStorage.retry());await turn();
 assert.deepEqual(h.disk().map(x=>x.id),[old.id,'new-attempt','second-attempt']);assert.equal(h.timers.size,0);
});

test('completion proof updates survive an unreadable queue without replacing old work',async()=>{
 const h=harness(),old=spend('older-attempt');h.seed([old]);
 const plan={seed:123,edition:2,done:[0,1,2,3,4,5,6,7],tasks:Object.fromEntries(Array.from({length:8},(_,id)=>[id,{proof:{id}}]))};
 h.c.MKTYStory={read:()=>plan};h.c.localStorage.setItem('mkty_proof_route_1',JSON.stringify({seed:123,edition:2,route:'saved-route'}));
 h.readFault(pendingKey(101));assert((await h.c.MKTYRewards.completeLife(1,500)).pending);await turn();
 assert.deepEqual(h.disk(),[old]);h.readFault('');assert(h.c.MKTYStorage.retry());await turn();
 const queued=h.disk();assert.equal(queued.length,2);assert.equal(queued[1].payload.proof.route,'saved-route');assert.equal(queued[1].payload.proof.tasks.length,8);
 assert.equal(queued[0].id,old.id);assert.equal(h.timers.size,0);
});

test('a settled removal while unreadable is merged without resurrecting or losing other entries',async()=>{
 const h=harness(async body=>body.event_key==='already-sent'?{ok:true,spent:true,player:{telegram_id:101,moon_points:0,lives:8,story_life:0}}:{ok:false,error:'unavailable'});
 const keep=completion();h.seed([keep,spend('already-sent')]);h.readFault(pendingKey(101));
 assert.equal((await h.c.MKTYRewards.spendLife('already-sent')).source,'server');await turn();
 assert.equal(h.disk().length,2);h.readFault('');assert(h.c.MKTYStorage.retry());await turn();
 assert.deepEqual(h.disk(),[keep]);assert.equal(h.calls.filter(x=>x.event_key==='already-sent').length,1);assert.equal(h.timers.size,0);
});

test('account-scoped memory intents merge into their own queues when another account is active',async()=>{
 const h=harness();h.seed([completion()],101);h.seed([spend('B-old')],202);
 h.readFault(pendingKey(101));await h.c.MKTYRewards.spendLife('A-new');await turn();
 h.owner(202);await h.c.MKTYRewards.spendLife('B-new');h.readFault('');
 const before=h.calls.length;assert(h.c.MKTYStorage.retry());await turn();
 assert.deepEqual(h.disk(101).map(x=>x.id),['life:1:complete','A-new']);assert.deepEqual(h.disk(202).map(x=>x.id),['B-old','B-new']);
 assert(h.calls.slice(before).every(x=>x.session==='fixture-202'),'automatic retry must only send as the active account');assert.equal(h.timers.size,0);
});

test('quota during the recovery merge retains the complete base and new intents for a second retry',async()=>{
 const h=harness(),old=completion();h.seed([old]);h.readFault(pendingKey(101));await h.c.MKTYRewards.spendLife('new-attempt');await turn();
 h.readFault('');h.writeFault(pendingKey(101));h.c.MKTYStorage.retry();await turn();
 assert.equal(h.c.MKTYStorage.persistent,false);assert.deepEqual(h.disk(),[old]);assert.match(h.text(),/only in this open game/i);
 await h.c.MKTYRewards.spendLife('later-attempt');h.writeFault('');assert(h.c.MKTYStorage.retry());await turn();
 assert.deepEqual(h.disk().map(x=>x.id),[old.id,'new-attempt','later-attempt']);assert.equal(h.timers.size,0);
});

test('a quota-only failure preserves both known records and avoids a false durable-save message',async()=>{
 const h=harness();h.seed([completion()]);h.writeFault(pendingKey(101));await h.c.MKTYRewards.spendLife('quota-attempt');await turn();
 assert.equal(h.disk().length,1);assert.match(h.text(),/only in this open game/i);h.writeFault('');assert(h.c.MKTYStorage.retry());await turn();
 assert.deepEqual(h.disk().map(x=>x.id),['life:1:complete','quota-attempt']);assert.equal(h.timers.size,0);
});

test('read failure after a successful merge write leaves retryable edits without duplicating records',async()=>{
 const h=harness();h.seed([completion()]);h.readFault(pendingKey(101));await h.c.MKTYRewards.spendLife('new-attempt');await turn();
 h.readFault('');h.readAfterWrite(pendingKey(101));h.c.MKTYStorage.retry();await turn();
 assert.equal(h.c.MKTYStorage.persistent,false);assert.deepEqual(h.disk().map(x=>x.id),['life:1:complete','new-attempt']);assert.match(h.text(),/only in this open game/i);
 h.readFault('');assert(h.c.MKTYStorage.retry());await turn();assert.deepEqual(h.disk().map(x=>x.id),['life:1:complete','new-attempt']);assert.equal(h.timers.size,0);
});

test('repeated memory-only completion calls merge one complete proof that survives reload',async()=>{
 const h=harness();h.seed([spend('older-attempt')]);
 const plan={seed:123,edition:2,done:[0,1,2,3,4,5,6,7],tasks:Object.fromEntries(Array.from({length:8},(_,id)=>[id,{proof:{id}}]))};
 h.c.MKTYStory={read:()=>plan};h.c.localStorage.setItem('mkty_proof_route_1',JSON.stringify({seed:123,edition:2,route:'saved-route'}));
 h.readFault(pendingKey(101));await h.c.MKTYRewards.completeLife(1,500);await h.c.MKTYRewards.completeLife(1,500);await turn();
 h.readFault('');assert(h.c.MKTYStorage.retry());await turn();assert.equal(h.disk().length,2);
 let completed=0;const reopened=harness(async body=>{if(body.action==='lives.spend')return {ok:false,error:'no_lives'};
  assert.equal(body.proof.route,'saved-route');assert.equal(body.proof.tasks.length,8);completed++;return {ok:true,player:{telegram_id:101,moon_points:500,lives:0,story_life:1}};});
 for(const [key,value]of h.data)reopened.data.set(key,value);
 await reopened.c.MKTYRewards.syncPlayer();assert.equal(completed,1);assert.deepEqual(reopened.disk(),[]);assert.equal(reopened.c.localStorage.getItem('mkty_points'),'500');assert.equal(h.timers.size+reopened.timers.size,0);
});

test('rewriting a legitimate long backlog never truncates the completion after record 100',async()=>{
 let settled=0;const h=harness(async body=>{if(body.action==='lives.spend')return {ok:false,error:'no_lives'};settled++;return {ok:true,player:{telegram_id:101,moon_points:500,lives:0,story_life:1}};});
 h.seed([...Array.from({length:100},(_,i)=>spend('older-attempt-'+i)),completion()]);
 await h.c.MKTYRewards.syncPlayer();assert.equal(settled,1,'earned completion must actually reach settlement');assert.deepEqual(h.disk(),[]);assert.equal(h.timers.size,0);
});
