/* Real reward/storage clients and app consumers; only transport, clock and DOM
   are synthetic. No browser, socket, server, credentials or live account. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),test=require('node:test');
const Codec=require('../trace-codec.js'),root=path.join(__dirname,'..');
const source=name=>fs.readFileSync(path.join(root,name),'utf8');
const turn=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const plain=value=>JSON.parse(JSON.stringify(value));
const player=(owner=101,extra={})=>({telegram_id:owner,moon_points:0,lives:9,story_life:0,...extra});
const pace=(locked=true)=>({next_life:2,unlock_at:locked?'2030-01-01T00:00:00Z':null,skips:locked?1:0,locked});
function fixture(handler){
 const data=new Map(),sessions=new Map(),nodes=new Map(),timers=new Map(),events=new Map(),calls=[],applied=[],paceApplied=[],appWork=[];let timerId=0;
 const storage=data=>({getItem:k=>data.get(String(k))??null,setItem:(k,v)=>data.set(String(k),String(v)),removeItem:k=>data.delete(String(k)),key:i=>[...data.keys()][i],get length(){return data.size;}});
 const on=(name,fn)=>events.set(name,[...(events.get(name)||[]),fn]);
 const node=()=>({children:[],style:{},dataset:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){},addEventListener(){},focus(){},contains(){return false;},querySelectorAll(){return [];},querySelector(){return null;},
  append(...items){this.children.push(...items);for(const item of items)if(item.id)nodes.set(item.id,item);},appendChild(item){this.append(item);},replaceChildren(...items){this.children=items;},remove(){nodes.delete(this.id);},showModal(){this.open=true;},close(){this.open=false;}});
 const c={console,URLSearchParams,AbortController,queueMicrotask,MKTYTraceCodec:Codec,localStorage:storage(data),sessionStorage:storage(sessions),Telegram:{WebApp:{}},
  CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},addEventListener:on,dispatchEvent:e=>{for(const fn of events.get(e.type)||[])fn(e);},
  setTimeout:(fn,ms)=>(timers.set(++timerId,{fn,ms}),timerId),clearTimeout:id=>timers.delete(id),setInterval:()=>++timerId,clearInterval(){},
  document:{readyState:'loading',body:node(),createElement:node,getElementById:id=>nodes.get(id),querySelectorAll:()=>[],addEventListener:(name,fn)=>on('document:'+name,fn)},
  moonPointsLocked:()=>c.localStorage.getItem('mkty_points_locked_at')!==null,renderMissionArchive(){},renderLife3Gate(){},renderGlobalLivesHome(){},MKTY_MAX_LIVES:9,MKTY_LIFE_RESTORE_MS:12*3600e3};
 c.window=c;c.tg=c.Telegram.WebApp;c.$=id=>nodes.get(id);
 const owner=id=>{c.Telegram.WebApp.initData=id===null?'':'user='+encodeURIComponent(JSON.stringify({id}));};owner(101);
 for(const id of ['points','dailyMissions','paceSkip','paceGo','paceInvite','paceCancel','paceKicker','paceTitle','paceClock','paceText','paceLives'])nodes.set(id,node());
 function abortable(work,signal){return new Promise((resolve,reject)=>{
  const abort=()=>reject(Object.assign(Error('request aborted'),{name:'AbortError'}));
  if(signal.aborted)return abort();signal.addEventListener('abort',abort,{once:true});
  Promise.resolve(work).then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));
 });}
 c.fetch=async(url,options)=>{
  assert.equal(url,c.MKTYRewards.endpoint,'transport stays inside the injected VM handler');
  const body=JSON.parse(options.body),id=body.session?Number(body.session.replace('fixture-','')):Number(JSON.parse(new URLSearchParams(body.initData).get('user')).id);
  const request={body,owner:id,signal:options.signal};calls.push(request);
  const value=body.action==='session'?{ok:true,session:{token:'fixture-'+id,expires_at:Date.now()+3600000}}:await abortable(handler(body,id,request),options.signal);
  return {ok:value.ok!==false,status:value.ok===false?503:200,json:async()=>{
   if(value.bodyGate)await abortable(value.bodyGate.promise,options.signal);
   if(value.jsonError)throw Error('interrupted JSON body');
   return value.body||value;
  }};
 };
 vm.createContext(c);
 for(const file of ['storage.js','rewards-client.js','pacing.js','social.js'])vm.runInContext(source(file),c,{filename:file});
 const app=source('app.js');
 for(const [first,next]of [['getLifeBank','spendGlobalLife'],['spendGlobalLife','ensureLife1MemoryCode'],['awardLifePoints','unlockLife2']]){
  const begin=app.indexOf('function '+first+'('),end=app.indexOf('\nfunction '+next+'(',begin);assert(begin>=0&&end>begin);vm.runInContext(app.slice(begin,end),c,{filename:'app.js:'+first});
 }
 for(const name of ['completeLife','spendLife']){const original=c.MKTYRewards[name];c.MKTYRewards[name]=(...args)=>{const job=original(...args);appWork.push(job);return job;};}
 const setServer=c.MKTYPace.setServer;c.MKTYPace.setServer=value=>{paceApplied.push(plain(value));setServer(value);};
 on('mkty:player',()=>applied.push({owner:c.MKTYRewards.accountScope(),points:c.localStorage.getItem('mkty_points'),lives:c.localStorage.getItem('mkty_global_lives')}));
 return {c,calls,data,nodes,timers,applied,paceApplied,appWork,owner,read:key=>c.localStorage.getItem(key),pending:(id=101)=>JSON.parse(data.get('mkty_pending_v2_'+id)||'[]'),
  requests:action=>calls.filter(r=>r.body.action===action),
  timeout(){const pending=[...timers].filter(([,timer])=>timer.ms===12000);assert.equal(pending.length,1,'only the active request owns a timeout');const [id,{fn}]=pending[0];timers.delete(id);fn();},
  clean(){assert.equal(timers.size,0,'all request timeouts are cleared');}};
}
const options={timeout:3000};

test('delayed refresh cannot overwrite an earned completion through the real app callback',options,async()=>{
 const state=player(),gate=deferred();let hold=false,awards=0;
 const h=fixture(async body=>{
  if(body.action==='player'){const result={ok:true,player:{...state},pace:pace(state.story_life===0)};if(hold){hold=false;return {body:result,bodyGate:gate};}return result;}
  assert.equal(body.action,'life.complete');const awarded=state.story_life<1;if(awarded){awards++;state.moon_points=500;state.story_life=1;}
  return {ok:true,awarded,player:{...state},pace:pace(false)};
 });
 await h.c.MKTYRewards.syncPlayer();hold=true;const refresh=h.c.MKTYRewards.syncPlayer();await turn();
 assert.equal(h.c.awardLifePoints(1,500),0,'Telegram reward is not optimistic');await turn();
 assert.equal(h.requests('life.complete').length,0,'completion waits until the refresh body has settled');
 assert.equal(h.pending().length,1,'earned completion is durable while waiting');assert.equal(h.read('mkty_life1'),'complete','local play remains responsive');
 gate.resolve();await Promise.all([refresh,...h.appWork]);await turn();
 assert.equal(awards,1);assert.equal(h.read('mkty_points'),'500');assert.equal(h.nodes.get('points').textContent,'500 ⭐');
 assert.equal(h.c.MKTYRewards.getLastPlayer().story_life,1);assert.equal(JSON.parse(h.read('mkty_pace_server')).locked,false);assert.deepEqual(h.pending(),[]);h.clean();
});

test('two ordinary failed attempts settle in order, without blocking local controls',options,async()=>{
 const state=player(),gate=deferred(),seen=new Set();
 const h=fixture(async body=>{
  assert.equal(body.action,'lives.spend');const duplicate=seen.has(body.event_key);if(!duplicate){seen.add(body.event_key);state.lives--;}
  const result={ok:true,spent:!duplicate,duplicate,player:{...state}};
  return seen.size===1?{body:result,bodyGate:gate}:result;
 });
 assert.equal(h.c.spendGlobalLife('ordinary-one'),true);await turn();
 assert.equal(h.c.spendGlobalLife('ordinary-two'),true);await turn();
 assert.equal(h.read('mkty_global_lives'),'7');assert.equal(h.requests('lives.spend').length,1);assert.equal(h.pending().length,2);
 gate.resolve();await Promise.all(h.appWork);await turn();
 assert.equal(state.lives,7);assert.equal(h.read('mkty_global_lives'),'7');assert.equal(h.c.MKTYRewards.getLastPlayer().lives,7);assert.equal(seen.size,2);assert.deepEqual(h.pending(),[]);h.clean();
});

test('all snapshot-bearing call actions wait through cache application, allowing decreases and restoration',options,async()=>{
 const held=[];const h=fixture((body,id)=>{const gate=deferred();held.push({body,id,gate,observed:plain(h.applied)});return gate.promise;});
 const actions=['player','chapter.status','chapter.skip','life.complete','lives.spend','referrals.stats','referrals.claim','daily.status','cipher.solve','streak.checkin','youtube.redeem','creator.status','creator.submit','social.status','social.telegram.verify','social.submit','social.youtube.verify','future.snapshot.action'];
 const jobs=actions.map(action=>h.c.MKTYRewards.call(action));await turn();assert.equal(held.length,1);
 for(let i=0;i<actions.length;i++){
  assert.equal(held.length,i+1,'only one same-account snapshot request is sent');assert.equal(held[i].body.action,actions[i]);
  if(i)assert.equal(held[i].observed.at(-1).points,String(i%2?500:100),'previous snapshot was applied before next transport started');
  held[i].gate.resolve({ok:true,player:player(101,{moon_points:i%2?100:500,lives:i%2?9:3}),pace:pace(i%2===0)});await jobs[i];await turn();
 }
 await Promise.all(jobs);assert.equal(h.read('mkty_points'),'100','lower confirmed balance is accepted');assert.equal(h.read('mkty_global_lives'),'9','restored lives are accepted');assert.equal(h.applied.length,actions.length);assert.equal(h.paceApplied.length,actions.length);h.clean();
});

test('pace skip and social callbacks consume the centrally applied snapshot',options,async()=>{
 const state=player(),gate=deferred();let holdSocial=true;
 const h=fixture(async body=>{
  if(body.action==='social.status'){const result={ok:true,player:{...state},code:'FIXTURE',submissions:[]};if(holdSocial){holdSocial=false;return {body:result,bodyGate:gate};}return result;}
  if(body.action==='chapter.skip'){state.moon_points=500;return {ok:true,player:{...state},pace:pace(false)};}
  throw Error('unexpected action '+body.action);
 });
 h.c.localStorage.setItem('mkty_life1','complete');h.c.MKTYPace.setServer(pace(true));h.c.MKTYPace.open('chapter',2);
 const social=h.c.MKTYSocial.load();await turn();const skip=h.nodes.get('paceSkip').onclick();await turn();assert.equal(h.requests('chapter.skip').length,0);
 gate.resolve();await Promise.all([social,skip]);await turn();
 assert.equal(h.read('mkty_points'),'500');assert.equal(h.nodes.get('points').textContent,'500 ⭐');assert.equal(JSON.parse(h.read('mkty_pace_server')).locked,false);assert.equal(h.paceApplied.length,2,'skip snapshot is applied once, centrally');
 // Existing toast is a UI timer, distinct from the network request timeout.
 for(const [id,timer]of h.timers)if(timer.ms===2600){h.timers.delete(id);timer.fn();}h.clean();
});

test('route and cloud requests remain independent and never apply player or pace snapshots',options,async()=>{
 const route=deferred(),cloud=deferred();const h=fixture(body=>body.action==='campaign.open'?route.promise:body.action==='campaign.cloud'?cloud.promise:{ok:true,spent:true,player:player(101,{moon_points:500,lives:8})});
 const open=h.c.MKTYRewards.call('campaign.open',{life:1}),save=h.c.MKTYRewards.authenticatedFetch(h.c.MKTYRewards.endpoint,{action:'campaign.cloud'});await turn();
 await h.c.MKTYRewards.spendLife('normal-attempt');assert.equal(h.read('mkty_points'),'500');
 const unexpected={ok:true,player:player(),pace:pace(true)};route.resolve({...unexpected,route:{life:1}});cloud.resolve({...unexpected,revision:1,snapshot:{}});await Promise.all([open,save]);
 assert.equal(h.read('mkty_points'),'500');assert.equal(h.read('mkty_global_lives'),'8');assert.equal(h.paceApplied.length,0);assert.deepEqual(h.pending(),[]);h.clean();
});

for(const stage of ['headers','body'])test('a '+stage+' timeout advances the lane and retries a committed spend idempotently',options,async()=>{
 const state=player(),gate=deferred(),seen=new Set();let hold=true;
 const h=fixture(async body=>{
  if(body.action==='player')return {ok:true,player:{...state}};
  assert.equal(body.action,'lives.spend');const duplicate=seen.has(body.event_key);if(!duplicate){seen.add(body.event_key);state.lives--;}
  const result={ok:true,spent:!duplicate,duplicate,player:{...state}};
  if(hold){hold=false;if(stage==='headers'){await gate.promise;return result;}return {body:result,bodyGate:gate};}return result;
 });
 const one=h.c.MKTYRewards.spendLife('unknown-result');await turn();const two=h.c.MKTYRewards.spendLife('next-attempt');await turn();
 assert.equal(h.requests('lives.spend').length,1);h.timeout();assert.equal((await one).source,'pending');await two;
 assert.equal(state.lives,7);assert.equal(h.read('mkty_global_lives'),'7');assert.deepEqual(h.pending().map(x=>x.id),['unknown-result']);
 gate.resolve();await turn();assert.equal(h.read('mkty_global_lives'),'7','aborted older response cannot apply after a newer result');
 await h.c.MKTYRewards.syncPlayer();assert.equal(seen.size,2);assert.equal(state.lives,7);assert.equal(h.requests('lives.spend').filter(r=>r.body.event_key==='unknown-result').length,2);assert.deepEqual(h.pending(),[]);h.clean();
});

test('JSON rejection, auth failure and exhausted lives all release the lane for recovery',options,async()=>{
 const outputs=[{jsonError:true},{ok:false,error:'auth'},{ok:false,error:'no_lives'},{ok:true,player:player(101,{lives:1})}];
 const h=fixture(()=>outputs.shift());const jobs=[h.c.MKTYRewards.call('daily.status'),h.c.MKTYRewards.call('daily.status'),h.c.MKTYRewards.spendLife('exhausted'),h.c.MKTYRewards.call('player')];
 const results=await Promise.all(jobs);assert.equal(results[0].error,'unavailable');assert.equal(results[1].error,'auth');assert.equal(results[2].lives,0);assert.equal(results[3].player.lives,1);
 assert.equal(h.read('mkty_global_lives'),'1');assert.deepEqual(h.pending(),[]);h.clean();
});

test('another account never waits for an old lane, and a stale failure cannot change its state',options,async()=>{
 const gate=deferred();const h=fixture((body,id)=>id===101?gate.promise:{ok:true,player:player(id,{moon_points:2250,lives:6}),pace:pace(false)});
 const old=h.c.MKTYRewards.spendLife('old-A');await turn();const waiting=h.c.MKTYRewards.spendLife('queued-A');h.owner(202);await h.c.MKTYRewards.call('player');
 assert.equal(h.read('mkty_points'),'2250');assert.equal(h.c.MKTYRewards.isServerReady(),true);gate.reject(Error('old connection failed'));
 assert.equal((await old).source,'account-changed');assert.equal((await waiting).source,'account-changed');
 assert.equal(h.read('mkty_points'),'2250');assert.equal(h.read('mkty_global_lives'),'6');assert.equal(h.c.MKTYRewards.isServerReady(),true);
 assert.equal(h.requests('lives.spend').length,1,'queued request cannot send as the new account');assert.deepEqual(h.pending(101).map(x=>x.id),['old-A','queued-A']);assert.deepEqual(h.pending(202),[]);h.clean();
});

test('A to B to A rejects old generation work and starts a fresh refresh instead of coalescing',options,async()=>{
 const gate=deferred();let old=true;const h=fixture((body,id)=>{if(id===101&&old){old=false;return gate.promise;}return {ok:true,player:player(id,{moon_points:id===101?500:2250,lives:7})};});
 const first=h.c.MKTYRewards.syncPlayer();await turn();const queued=h.c.MKTYRewards.call('daily.status');h.owner(202);await h.c.MKTYRewards.syncPlayer();h.owner(101);
 const current=h.c.MKTYRewards.syncPlayer();await turn();assert.equal(h.requests('player').length,2,'new A refresh waits for old A transport, not B');
 gate.resolve({ok:true,player:player(101,{moon_points:10,lives:8})});assert.equal(await first,null);assert.equal((await queued).error,'account_changed');const result=await current;
 assert.equal(result.moon_points,500);assert.equal(h.requests('daily.status').length,0);assert.equal(h.read('mkty_points'),'500');assert(!h.applied.some(x=>x.points==='10'),'old A generation was never applied');h.clean();
});

test('guest rewards stay synchronous locally without adding a network lane',options,async()=>{
 const h=fixture(()=>{throw Error('guest must not send');});h.owner(null);h.c.awardLifePoints(1,500);h.c.awardLifePoints(1,500);assert.equal(h.c.spendGlobalLife('guest-attempt'),true);await Promise.all(h.appWork);await turn();
 assert.equal(h.read('mkty_points'),'500');assert.equal(h.read('mkty_global_lives'),'8');assert.equal(h.calls.length,0);assert.deepEqual(h.pending(),[]);h.clean();
});

test('same-seed A to B to A route lookup starts fresh work and rejects the old generation',options,async()=>{
 const oldReply=deferred(),currentReply=deferred();let opens=0;
 const h=fixture((body,id)=>body.action==='campaign.open'?(++opens===1?oldReply.promise:currentReply.promise):{ok:true,player:player(id)});
 const saved={seed:123,edition:2};h.c.MKTYStory={read:()=>saved};
 const old=h.c.MKTYRewards.prepareRoute(1);await turn();assert.equal(h.requests('campaign.open').length,1);
 h.owner(202);await h.c.MKTYRewards.call('player');h.owner(101);
 const current=h.c.MKTYRewards.prepareRoute(1),duplicate=h.c.MKTYRewards.prepareRoute(1);await turn();
 assert.equal(h.requests('campaign.open').length,2,'same saved plan requires a fresh route request after returning to A');
 const reply=route=>({ok:true,route:{life:1,telegram_id:101,seed:123,edition:2,route}});
 currentReply.resolve(reply('current-A'));const [result,coalesced]=await Promise.all([current,duplicate]);
 assert.equal(result.route,'current-A');assert.equal(coalesced.route,'current-A');
 oldReply.resolve(reply('old-A'));assert.equal(await old,null,'the first generation must not persist its route');
 assert.equal(JSON.parse(h.read('mkty_proof_route_1')).route,'current-A');assert.equal(opens,2,'identical current-generation opens still coalesce');h.clean();
});
