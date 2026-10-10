/* Ordinary account/replay lifecycle races in a synthetic VM. No browser, socket,
   server, real credentials or player account. Production storage and callbacks run. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const test=require('node:test'),Codec=require('../trace-codec.js');
const root=path.join(__dirname,'..'),source=name=>fs.readFileSync(path.join(root,name),'utf8');
const nextTurn=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const store=()=>{const data=new Map();return {data,getItem:k=>data.get(String(k))??null,setItem:(k,v)=>data.set(String(k),String(v)),removeItem:k=>data.delete(String(k)),key:i=>[...data.keys()][i]??null,get length(){return data.size;}};};
const plan=(seed,edition=2)=>({n:1,seed,edition,phase:'complete',done:[0,1,2,3,4,5,6,7],tasks:Object.fromEntries(Array.from({length:8},(_,id)=>[id,{attempt:0,proof:{id}}]))});
const planKey='mkty_story_plan_1_v1',routeKey='mkty_proof_route_1';
function harness(){
 const native=store(),nodes=new Map(),calls=[],requests=[],timers=new Map(),effects=[];let timerId=0;
 const c={console,URLSearchParams,AbortController,queueMicrotask,localStorage:native,sessionStorage:store(),CustomEvent:class{constructor(type,opt){this.type=type;this.detail=opt?.detail;}},
  setTimeout:(fn,ms)=>(timers.set(++timerId,{fn,ms}),timerId),clearTimeout:id=>timers.delete(id),addEventListener(){},dispatchEvent(){},
  document:{body:{appendChild(el){nodes.set(el.id,el);}},getElementById:id=>nodes.get(id),createElement:()=>({setAttribute(){}}),addEventListener(){}},
  MKTYTraceCodec:Codec,Telegram:{WebApp:{initData:'user='+encodeURIComponent(JSON.stringify({id:101}))}},
  renderMissionArchive(){},moonPointsLocked:()=>false,$:id=>nodes.get(id),renderLife3Gate(){effects.push('life-gate');},renderGlobalLivesHome(){effects.push('home-lives');},MKTY_MAX_LIVES:9,MKTY_LIFE_RESTORE_MS:12*3600e3};
 c.window=c;c.tg=c.Telegram.WebApp;
 const owner=()=>String(JSON.parse(new URLSearchParams(c.Telegram.WebApp.initData).get('user')).id);
 const switchOwner=id=>{c.Telegram.WebApp.initData='user='+encodeURIComponent(JSON.stringify({id:Number(id)}));};
 c.MKTYStory={read:()=>{try{return JSON.parse(c.localStorage.getItem(planKey));}catch{return null;}},complete(){}};
 c.MKTYPace={onRecorded(){},refresh(){effects.push('pace-refresh');}};
 c.fetch=async(_url,opt)=>{
  const body=JSON.parse(opt.body);calls.push(body);let result;
  if(body.action==='session'){
   const id=String(JSON.parse(new URLSearchParams(body.initData).get('user')).id);
   result={ok:true,session:{token:'fixture-'+id,expires_at:Date.now()+3600000}};
  }else if(body.action==='player'){
   const id=Number(String(body.session).replace('fixture-',''));
   result={ok:true,player:{telegram_id:id,moon_points:0,lives:9,story_life:0}};
  }else{
   const response=deferred();requests.push({body,owner:owner(),respond:response.resolve});result=await response.promise;
  }
  return {ok:result.ok!==false,status:result.ok===false?400:200,json:async()=>result};
 };
 vm.createContext(c);vm.runInContext(source('storage.js'),c,{filename:'storage.js'});vm.runInContext(source('rewards-client.js'),c,{filename:'rewards-client.js'});
 // Execute the actual two app consumers, including their real .then callbacks.
 const app=source('app.js');
 for(const [first,next] of [['getLifeBank','spendGlobalLife'],['spendGlobalLife','ensureLife1MemoryCode'],['awardLifePoints','unlockLife2']]){
  const begin=app.indexOf('function '+first+'('),end=app.indexOf('\nfunction '+next+'(',begin);
  assert(begin>=0&&end>begin,'app callback source remains discoverable: '+first);vm.runInContext(app.slice(begin,end),c,{filename:'app.js:'+first});
 }
 for(const [id,seed,points,lives] of [[101,123,500,8],[202,456,2250,6]]){switchOwner(id);c.localStorage.setItem(planKey,JSON.stringify(plan(seed)));c.localStorage.setItem('mkty_points',String(points));c.localStorage.setItem('mkty_global_lives',String(lives));}
 switchOwner(101);
 return {c,native,calls,requests,timers,effects,owner:switchOwner,setPlan:(seed,edition)=>c.localStorage.setItem(planKey,JSON.stringify(plan(seed,edition))),
  read:key=>c.localStorage.getItem(key),write:(key,value)=>c.localStorage.setItem(key,value),queue:id=>JSON.parse(native.getItem('mkty_pending_v2_'+id)||'[]'),
  savedRoute:()=>JSON.parse(c.localStorage.getItem(routeKey)||'null'),
  routeRequest:(index=0)=>requests.filter(r=>r.body.action==='campaign.open')[index],
  routeReply(request,label){assert(request,'expected a route request');request.respond({ok:true,route:{life:1,telegram_id:Number(request.owner),seed:request.body.seed,edition:request.body.edition,route:label}});}};
}

test('new replay route survives an older out-of-order route response',async()=>{
 const h=harness(),old=h.c.MKTYRewards.prepareRoute(1);await nextTurn();
 h.setPlan(789);const newer=h.c.MKTYRewards.prepareRoute(1,true);await nextTurn();
 assert.equal(h.requests.length,2);h.routeReply(h.routeRequest(1),'new-route');await newer;assert.equal(h.savedRoute().seed,789);
 h.routeReply(h.routeRequest(0),'old-route');await old;
 assert.equal(h.savedRoute().route,'new-route','late route must not replace the currently selected replay');assert.equal(h.timers.size,0);
});

test('A to B to A route requests preserve the current plan and both account stores',async()=>{
 const h=harness(),firstA=h.c.MKTYRewards.prepareRoute(1);await nextTurn();
 h.owner(202);const accountB=h.c.MKTYRewards.prepareRoute(1);await nextTurn();
 h.owner(101);h.setPlan(789);const currentA=h.c.MKTYRewards.prepareRoute(1,true);await nextTurn();
 h.routeReply(h.routeRequest(2),'current-A');await currentA;
 h.routeReply(h.routeRequest(1),'inactive-B');await accountB;
 h.routeReply(h.routeRequest(0),'earlier-A');await firstA;
 assert.equal(h.savedRoute().route,'current-A');assert.equal(h.read('mkty_points'),'500');
 h.owner(202);assert.equal(h.savedRoute(),null,'B response arriving while A is active is not persisted');assert.equal(h.read('mkty_points'),'2250');assert.equal(h.timers.size,0);
});

test('route seed A to B to A keeps the newest same-key job after the oldest settles',async()=>{
 const h=harness(),firstA=h.c.MKTYRewards.prepareRoute(1);await nextTurn();
 h.setPlan(456);const routeB=h.c.MKTYRewards.prepareRoute(1);await nextTurn();
 h.setPlan(123);const currentA=h.c.MKTYRewards.prepareRoute(1);await nextTurn();
 assert.equal(h.requests.length,3,"returning to a seed must not adopt that seed's superseded request");
 h.routeReply(h.routeRequest(0),'superseded-A');await firstA;
 assert.equal(h.savedRoute(),null,'old same-key request must not persist while newer work is pending');
 const duplicateA=h.c.MKTYRewards.prepareRoute(1);await nextTurn();
 assert.equal(h.requests.length,3,'old cleanup must not delete the newer same-key job');
 h.routeReply(h.routeRequest(2),'current-A');await Promise.all([currentA,duplicateA]);
 h.routeReply(h.routeRequest(1),'superseded-B');await routeB;
 assert.equal(h.savedRoute().route,'current-A');assert.equal(h.timers.size,0);
});

test('a reset cannot reuse an in-flight ordinary open for the same saved seed',async()=>{
 const h=harness(),ordinary=h.c.MKTYRewards.prepareRoute(1);await nextTurn();
 const reset=h.c.MKTYRewards.prepareRoute(1,true);await nextTurn();
 assert.equal(h.requests.length,2,'reset must request a reset instead of inheriting reset:false work');
 assert.equal(h.routeRequest(0).body.reset,false);assert.equal(h.routeRequest(1).body.reset,true);
 h.routeReply(h.routeRequest(1),'reset-route');await reset;
 h.routeReply(h.routeRequest(0),'before-reset');await ordinary;
 assert.equal(h.savedRoute().route,'reset-route');assert.equal(h.timers.size,0);
});

test('in-flight route identity includes edition and identical opens still coalesce',async()=>{
 const h=harness();h.setPlan(123,1);const legacy=h.c.MKTYRewards.prepareRoute(1);await nextTurn();
 h.setPlan(123,2);const current=h.c.MKTYRewards.prepareRoute(1),duplicate=h.c.MKTYRewards.prepareRoute(1);await nextTurn();
 assert.equal(h.requests.length,2,'edition change needs its own request, and identical current requests coalesce');
 h.routeReply(h.routeRequest(1),'edition-2');await Promise.all([current,duplicate]);
 h.routeReply(h.routeRequest(0),'edition-1');await legacy;
 assert.equal(h.savedRoute().edition,2);assert.equal(h.savedRoute().route,'edition-2');
 const cached=await h.c.MKTYRewards.prepareRoute(1);assert.equal(cached.route,'edition-2');assert.equal(h.requests.length,2);assert.equal(h.timers.size,0);
});

test('completion interrupted during route lookup never returns another account a numeric balance',async()=>{
 const h=harness();let work;const complete=h.c.MKTYRewards.completeLife;
 h.c.MKTYRewards.completeLife=(...args)=>(work=complete(...args));h.c.awardLifePoints(1,500);await nextTurn();
 assert.equal(h.queue(101).length,1,'intent remains durable before network completes');h.owner(202);
 h.routeReply(h.routeRequest(0),'account-A-route');const result=await work;await nextTurn();
 assert.equal(h.read('mkty_points'),'2250','new account balance must survive the real app completion callback');
 assert.equal(typeof result?.pts==='number',false,'account-changed completion is not a zero-point balance update');
 assert.equal(h.read('mkty_life1'),null);assert.equal(h.read('mkty_life1_awarded'),null);assert.equal(h.queue(101).length,1);assert.equal(h.queue(202).length,0);assert.equal(h.timers.size,0);
});

test('completion interrupted during settlement keeps the original pending intent',async()=>{
 const h=harness();h.write(routeKey,JSON.stringify({life:1,seed:123,edition:2,route:'current-A'}));let work;
 const complete=h.c.MKTYRewards.completeLife;h.c.MKTYRewards.completeLife=(...args)=>(work=complete(...args));h.c.awardLifePoints(1,500);await nextTurn();
 const request=h.requests.find(r=>r.body.action==='life.complete');assert(request);h.owner(202);
 request.respond({ok:true,awarded:true,player:{telegram_id:101,moon_points:1000,lives:8,story_life:1}});const result=await work;await nextTurn();
 assert.equal(h.read('mkty_points'),'2250');assert.equal(h.read('mkty_life1_awarded'),null);assert.equal(h.queue(101).length,1);assert.equal(h.queue(202).length,0);
 assert.equal(typeof result?.pts==='number',false,'stale completion must not expose the current account balance to an old caller');assert.equal(h.timers.size,0);
});

test('life spend interrupted by an account switch does not change the new account',async()=>{
 for(const exhausted of [false,true]){
  const h=harness();let work;const spend=h.c.MKTYRewards.spendLife;h.c.MKTYRewards.spendLife=(...args)=>(work=spend(...args));
  assert.equal(h.c.spendGlobalLife('fixture-failure'),true);await nextTurn();h.owner(202);
  h.requests[0].respond(exhausted?{ok:false,error:'no_lives'}:{ok:true,spent:true,player:{telegram_id:101,moon_points:500,lives:7,story_life:0}});
  const result=await work;await nextTurn();assert.equal(h.read('mkty_global_lives'),'6');assert.equal(typeof result?.lives==='number',false);
  assert.equal(h.queue(101).length,1);assert.equal(h.queue(202).length,0);assert.equal(h.timers.size,0);
 }
});

test('app completion and spend consumers independently ignore stale resolved callbacks',async()=>{
 for(const kind of ['completion','spend']){
  const h=harness(),result=deferred();
  if(kind==='completion'){h.c.MKTYRewards.completeLife=()=>result.promise;h.c.awardLifePoints(1,500);}
  else{h.c.MKTYRewards.spendLife=()=>result.promise;h.c.spendGlobalLife('fixture-failure');}
  h.owner(202);h.effects.length=0;
  result.resolve(kind==='completion'?{pts:1000,source:'server'}:{ok:true,lives:7,source:'server'});await nextTurn();
  assert.equal(h.read('mkty_points'),'2250',kind);assert.equal(h.read('mkty_global_lives'),'6',kind);assert.equal(h.read('mkty_life1'),null,kind);
  assert.equal(h.effects.length,0,'stale callback must not refresh current-account UI: '+kind);
 }
});
