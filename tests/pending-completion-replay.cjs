/* Actual chapter/reward clients and recorded eight-stage proof, in a deterministic VM.
   No browser, sockets, external network, database or backend writes. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(process.env.MKTY_REPLAY_TEST_ROOT||path.join(__dirname,'..'));
const P=require(root+'/story-plan.js'),Field=require(root+'/field-model.js'),Board=require(root+'/mission-rules.js'),Flight=require(root+'/expedition-model.js'),Codec=require(root+'/trace-codec.js');
const golden=JSON.parse(fs.readFileSync(root+'/tests/fixtures/chapter1-proof.json','utf8'));
const source=file=>fs.readFileSync(path.join(root,file),'utf8');const plain=x=>JSON.parse(JSON.stringify(x));const turn=()=>new Promise(r=>setImmediate(r));
function client(handler,id=101){
 let owner=String(id),active='home',random=golden.route.seed,timerId=0,reloads=0,unreadable=false,unwritable=false,storageRetries=0;
 const stores=new Map(),sessions=new Map(),elements=new Map(),events=new Map(),timers=new Map(),pending=new Set(),calls=[],responses=[],launches=[];
 const data=()=>stores.get(owner)||stores.set(owner,new Map()).get(owner);
 const on=(name,fn)=>events.set(name,[...(events.get(name)||[]),fn]);
 const emit=(name,event={})=>{for(const fn of events.get(name)||[])fn(event);};
 class Element{
  constructor(id=''){this.id=id;this.dataset={};this.attributes={};this.children=[];this.classes=new Set();this.style={setProperty(){}};this.classList={contains:x=>this.classes.has(x),add:x=>this.classes.add(x),remove:x=>this.classes.delete(x),toggle(){}};}
  set innerHTML(value){this.html=value;for(const m of value.matchAll(/id="([^"]+)"/g))get(m[1]);this.mapNodes=[...value.matchAll(/data-map-step="(\d+)"/g)].map(m=>{const el=new Element();el.dataset.mapStep=m[1];return el;});}
  get innerHTML(){return this.html||'';}setAttribute(k,v){this.attributes[k]=String(v);}compareDocumentPosition(){return 0;}before(){}
  append(...nodes){this.children.push(...nodes);for(const n of nodes)if(n.id)elements.set(n.id,n);}appendChild(node){this.append(node);}replaceChildren(...nodes){this.children=nodes;}
  querySelectorAll(){return this.mapNodes||[];}click(){if(!this.disabled)this.onclick?.();}dispatchEvent(e){if(e.type==='click')this.onclick?.();}remove(){elements.delete(this.id);}
 }
 const get=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);};
 const document={getElementById:id=>elements.get(id)||null,createElement:()=>new Element(),createTextNode:text=>({textContent:text}),documentElement:get('html'),body:get('body'),hidden:false,querySelector:s=>s==='.screen.active'?get(active):null,addEventListener:(name,fn)=>on('document:'+name,fn)};
 // Static document IDs exist before the real scripts initialize.
 for(const id of ['app','expeditionEntry','enterBtn','chapterList','points',...Array.from({length:9},(_,i)=>'life'+(i+1)+'Complete')])get(id);
 const storage={getItem:k=>data().get(k)??null,setItem:(k,v)=>{if(unwritable&&k.startsWith('mkty_pending_v2_'))throw Error('test storage unavailable');const text=String(v),before=data().get(k);data().set(k,text);if(before!==text)emit('mkty:storage',{detail:{key:k}});},removeItem:k=>{if(data().delete(k))emit('mkty:storage',{detail:{key:k}});},key:i=>[...data().keys()][i],get length(){return data().size;}};
 const window={Telegram:{WebApp:{}},MKTYTraceCodec:Codec,MKTYStorage:{identity:()=>owner,keys:()=>[...data().keys()],snapshot:()=>Object.fromEntries(data()),readItem:k=>{if(unreadable&&k.startsWith('mkty_pending_v2_'))throw Error('test read unavailable');return storage.getItem(k);},retry:()=>{storageRetries++;return !unreadable&&!unwritable;},persistent:true},MKTYCampaign:{render(){}},addEventListener:on,dispatchEvent:e=>emit(e.type,e)};
 const setOwner=id=>{owner=String(id);window.Telegram.WebApp.initData='user='+encodeURIComponent(JSON.stringify({id:Number(owner)}));};setOwner(id);
 const show=id=>{window.MKTYStory?.onScreen(id);get(active).classes.delete('active');active=id;get(id).classes.add('active');};get(active).classes.add('active');
 const launch=(task,saved)=>{launches.push({task,saved});show(task.kind==='board'?'operationsDeck':task.kind==='field'?'fieldMission':'expeditionFlight');};
 window.MKTYPace={gate:()=>true,bypass:()=>true,risky:(_n,fn)=>fn()};
 const context={window,document,localStorage:storage,sessionStorage:{getItem:k=>sessions.get(k)||null,setItem:(k,v)=>sessions.set(k,v),removeItem:k=>sessions.delete(k)},console,URLSearchParams,AbortController,AbortSignal,URL,Blob,Node:{DOCUMENT_POSITION_FOLLOWING:4},MouseEvent:class{constructor(type){this.type=type;}},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},MutationObserver:class{observe(){}},
  crypto:{getRandomValues:a=>{a[0]=random++;return a;}},setTimeout:(fn,ms)=>(timers.set(++timerId,{fn,ms}),timerId),clearTimeout:id=>timers.delete(id),setInterval(){},queueMicrotask(){},location:{reload(){reloads++;}},
  StoryPlan:P,FieldRules:Field,MissionRules:Board,ExpeditionRules:Flight,MKTYPace:window.MKTYPace,FieldArt:{map:(_n,steps)=>steps.map(t=>`<g data-map-step="${t.id}"></g>`).join('')},show,remainingLife1CodeTime:()=>0,MKTYOps:{openTask:launch,pending:()=>false},MKTYField:{open:launch},MKTYExpedition:{openStory:launch},
  fetch:(url,opt)=>{assert.equal(url,window.MKTYRewards.endpoint,'only the injected in-process handler may be called');const body=JSON.parse(opt.body);calls.push({body,raw:opt.body,owner});const work=(async()=>{const r=await handler(new Request('https://in-process.test/rewards',{method:'POST',headers:opt.headers,body:opt.body}));const value=await r.json();responses.push({action:body.action,body:plain(value)});return {ok:r.ok,status:r.status,json:async()=>value};})();pending.add(work);return work.finally(()=>pending.delete(work));}
 };
 for(const [i,name]of ['openMission','openMission2','openLife3MemoryGate','openMission4','openMission5','openMission6','openMission7','openMission8','openMission9'].entries())window[name]=()=>show('mission'+(i+1));
 vm.createContext(context);for(const file of ['rewards-client.js','story.js'])vm.runInContext(source(file),context,{filename:file});
 const seed=s=>storage.setItem('mkty_story_plan_'+s.n+'_v1',JSON.stringify(s));
 const settle=async()=>{do{await Promise.all([...pending]);await turn();}while(pending.size);};
 return {window,storage,calls,responses,launches,get,seed,show,stores,settle,owner:setOwner,active:()=>active,reloads:()=>reloads,failRead:value=>unreadable=value,failWrite:value=>unwritable=value,storageRetries:()=>storageRetries,text:id=>get(id).children[0]?.textContent||get(id).textContent||''};
}

const deferred=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve:()=>resolve()};};
function backend(validateProof){
 const accounts=new Map(),holds=[];let failCompletion=true,completionError='unavailable',holdPlayer=false;
 const account=id=>{if(!accounts.has(id))accounts.set(id,{route:null,player:{telegram_id:Number(id),moon_points:0,lives:9,story_life:0},awards:0});return accounts.get(id);};
 const handler=async request=>{
  const b=await request.json(),id=b.session?b.session.slice('test-session-'.length):String(JSON.parse(new URLSearchParams(b.initData).get('user')).id),a=account(id);let out;
  if(b.action==='session')out={ok:true,session:{token:'test-session-'+id,expires_at:Date.now()+3600000}};
  else if(b.action==='player'){if(holdPlayer){const wait=deferred();holds.push(wait);await wait.promise;}out={ok:true,player:{...a.player}};}
  else if(b.action==='campaign.open'){
   if(!a.route||(b.reset||a.player.story_life>=b.life)&&(a.route.seed!==b.seed||a.route.edition!==b.edition))a.route={life:b.life,seed:b.seed,edition:b.edition,route:'route-'+id+'-'+b.seed,telegram_id:Number(id)};
   out={ok:true,route:{...a.route}};
  }else if(b.action==='life.complete'){
   if(failCompletion)out={ok:false,error:completionError};
   else try{validateProof(a.route,b.proof);const awarded=a.player.story_life===0;if(awarded){a.awards++;a.player.moon_points=500;a.player.story_life=1;}out={ok:true,awarded,player:{...a.player}};}catch(error){out={ok:false,error:error.message};}
  }else throw Error('unexpected synthetic action: '+b.action);
  return Response.json(out,{status:out.ok?200:503});
 };
 return {handler,accounts,account,holds,fail:value=>failCompletion=value,error:value=>completionError=value,hold:value=>holdPlayer=value};
}
async function completed(validateProof){
 const server=backend(validateProof),h=client(server.handler),R=h.window.MKTYRewards,S=h.window.MKTYStory;
 await S.open(1);await h.settle();assert.equal(S.read(1).seed,golden.route.seed);
 for(const item of golden.proof.tasks){h.get('storySteps').children.find(button=>Number(button.dataset.storyStep)===item.id).click();h.launches.at(-1).task.complete(plain(item.state));}
 S.complete(1);const result=await R.completeLife(1,500);assert(result.pending);S.menu(1);
 const queued=JSON.parse(h.storage.getItem('mkty_pending_v2_101'));assert.equal(queued.length,1);assert(validateProof(server.account('101').route,queued[0].payload.proof));
 return {server,h,R,S};
}
const resetCalls=h=>h.calls.filter(x=>x.body.action==='campaign.open'&&x.body.reset);
const queue=h=>JSON.parse(h.storage.getItem('mkty_pending_v2_'+h.window.MKTYRewards.accountScope())||'[]');
const deadline=setTimeout(()=>{console.error('FAIL: pending-completion replay test did not settle');process.exit(1);},30000);
(async()=>{
 const {validateProof}=await import(root+'/server/rewards/campaign.mjs');
 assert(validateProof(golden.route,golden.proof));
 const {server,h,R,S}=await completed(validateProof);
 h.storage.setItem('mkty_campaign_checkpoint_1','finale-checkpoint');h.storage.setItem('mkty_life9_coordinates','unchanged-coordinates');
 const preserved=Object.fromEntries(h.stores.get('101')),oldRoute=server.account('101').route.route;
 await S.replay(1);await h.settle();assert.equal(resetCalls(h).length,0,'replay must not reset a route while its reward completion is pending');
 assert.equal(R.pendingCompletion(1),true);assert.equal(R.pendingCompletion(2),false);
 assert.match(h.get('storyReplay').textContent,/RETRY REWARD SYNC/);assert.match(h.get('storySave').textContent,/current route is preserved/);
 assert.equal(await R.prepareRoute(1,true),null,'direct reset also refuses an unsettled completion');
 server.hold(true);const first=S.replay(1),again=S.replay(1);assert.equal(first,again,'repeated replay actions coalesce the same retry');
 h.get('life1Complete').children.at(-1).click();h.get('storyReplay').click();await turn();assert.equal(server.holds.length,1);assert.equal(h.get('storyReplay').disabled,true);
 assert.equal(resetCalls(h).length,0);assert.equal(h.storage.getItem('mkty_story_archive_latest_1'),null);
 server.hold(false);server.holds[0].resolve();await first;await h.settle();
 for(const key of ['mkty_story_plan_1_v1','mkty_proof_route_1','mkty_campaign_checkpoint_1','mkty_pending_v2_101'])assert.equal(h.storage.getItem(key),preserved[key],key+' survives failed retries exactly');
 assert.equal(server.account('101').route.route,oldRoute);assert.equal(S.read(1).done.length,8);assert.equal(R.pendingCompletion(1),true);
 server.fail(false);h.get('storyReplay').click();await h.settle();
 assert.equal(R.pendingCompletion(1),false);assert.equal(server.account('101').player.moon_points,500);assert.equal(queue(h).length,0);assert.equal(resetCalls(h).length,0,'successful retry never silently replaces the route');
 assert.match(h.get('storyReplay').textContent,/NEW CHAPTER ROUTE/);h.get('storyReplay').click();await h.settle();
 assert.equal(resetCalls(h).length,1);assert.notEqual(server.account('101').route.route,oldRoute);assert.equal(S.read(1).done.length,0);
 const archiveName=h.storage.getItem('mkty_story_archive_latest_1'),archive=JSON.parse(h.storage.getItem(archiveName));
 assert.equal(archive.snapshot.mkty_story_plan_1_v1,preserved.mkty_story_plan_1_v1);assert.equal(archive.snapshot.mkty_campaign_checkpoint_1,'finale-checkpoint');
 assert.equal(h.storage.getItem('mkty_campaign_checkpoint_1'),null);assert.equal(h.storage.getItem('mkty_life1_awarded'),'yes');assert.equal(h.storage.getItem('mkty_life9_coordinates'),'unchanged-coordinates');assert.equal(server.account('101').awards,1);
 S.replay(1);await h.settle();assert.equal(h.storage.getItem(archiveName),JSON.stringify(archive),'a later replay preserves the complete earlier archive');

 // Unreadable, malformed and semantically invalid queues fail closed without
 // treating a missing or unreadable completion as permission to archive/reset.
 for(const failure of ['read','json','shape','invalid-life','missing-action']){
  const f=await completed(validateProof),original=f.h.storage.getItem('mkty_story_plan_1_v1');
  const bad=failure==='json'?'{invalid':failure==='shape'?'{}':failure==='missing-action'?'[{"id":"life:1:complete","payload":{"life":1}}]':JSON.stringify([{id:'life:unknown',action:'life.complete',payload:{life:'broken'}}]);
  if(failure==='read')f.h.failRead(true);else f.h.storage.setItem('mkty_pending_v2_101',bad);
  assert.equal(f.R.pendingCompletion(1),null);assert.equal(f.R.pendingCompletion(2),null);assert.equal(await f.R.prepareRoute(1,true),null);
  await f.S.replay(1);await f.h.settle();assert.equal(f.h.storageRetries(),1);assert.equal(resetCalls(f.h).length,0);
  assert.equal(f.h.storage.getItem('mkty_story_plan_1_v1'),original);assert.equal(f.h.storage.getItem('mkty_story_archive_latest_1'),null);
  assert.match(f.h.get('storySave').textContent,/queue could not be read/);assert.equal(f.h.get('storyReplay').disabled,false);
  if(failure!=='read')assert.equal(f.h.storage.getItem('mkty_pending_v2_101'),bad,'retry must not discard unreadable data');
 }
 // Cached old reward assets still use actual account IDs and strict reads.
 const mixed=await completed(validateProof),mixedPlan=mixed.h.storage.getItem('mkty_story_plan_1_v1');delete mixed.R.pendingCompletion;
 await mixed.S.replay(1);assert.equal(resetCalls(mixed.h).length,0);assert.equal(mixed.h.storage.getItem('mkty_story_plan_1_v1'),mixedPlan);
 mixed.h.failRead(true);await mixed.S.replay(1);assert.equal(resetCalls(mixed.h).length,0);assert.match(mixed.h.get('storySave').textContent,/queue could not be read/);
 mixed.h.failRead(false);mixed.h.storage.setItem('mkty_pending_v2_101','[]');mixed.h.owner(202);await mixed.S.open(1);await mixed.h.settle();mixed.S.replay(1);await mixed.h.settle();assert.equal(resetCalls(mixed.h).length,1);
 mixed.h.owner(101);mixed.h.storage.setItem('mkty_pending_v2_101','[{"id":"life:1:complete","payload":{"life":1}}]');await mixed.S.replay(1);assert.equal(resetCalls(mixed.h).length,1,'malformed completion cannot clear the legacy guard');

 // In-memory completions also block replay when saving the queue fails.
 const memoryServer=backend(validateProof),m=client(memoryServer.handler),MR=m.window.MKTYRewards;
 await m.window.MKTYStory.open(1);await m.settle();m.failWrite(true);await MR.completeLife(1,500);
 assert.equal(m.storage.getItem('mkty_pending_v2_101'),null);assert.equal(MR.pendingCompletion(1),true);assert.equal(await MR.prepareRoute(1,true),null);
 m.failRead(true);assert.equal(MR.pendingCompletion(1),null);m.failRead(false);assert.equal(MR.pendingCompletion(1),true);

 // Acknowledged completion and failed durable queue removal are distinct:
 // the remembered removal is safe for replay even while the disk queue lags.
 const ack=await completed(validateProof);ack.server.fail(false);ack.h.failWrite(true);
 await ack.R.syncPlayer();assert.equal(queue(ack.h).length,1,'disk still has the acknowledged item');
 assert.equal(ack.R.pendingCompletion(1),false,'known server acknowledgement is not an unsettled completion');
 assert.equal(ack.server.account('101').awards,1);ack.S.replay(1);await ack.h.settle();assert.equal(resetCalls(ack.h).length,1);
 ack.h.failWrite(false);await ack.R.syncPlayer();assert.equal(queue(ack.h).length,0);assert.equal(ack.server.account('101').awards,1);

 // Proof errors must not tell players to invalidate the original receipt that
 // the pending completion still needs. Both existing language paths explain it.
 const proofError=await completed(validateProof);proofError.server.error('proof_required');
 for(const lang of ['en','ru']){
  proofError.h.storage.setItem('mkty_lang',lang);await proofError.R.syncPlayer();proofError.S.menu(1);
  assert.match(proofError.h.get('rewardSyncStatus').textContent,lang==='ru'?/Текущий маршрут сохранён/:/current route is preserved/);
  assert.doesNotMatch(proofError.h.get('rewardSyncStatus').textContent,/Replay the chapter route|Новый маршрут главы/);
  assert.match(proofError.h.get('storyReplay').textContent,lang==='ru'?/СИНХРОНИЗАЦИЮ/:/RETRY REWARD SYNC/);
 }
 proofError.R.requiresRoute=()=>true;proofError.R.routeReady=()=>true;
 await proofError.S.replay(1);assert.equal(resetCalls(proofError.h).length,0,'trusted-route UI branch cannot bypass the pending guard');

 // Other chapters and spend-only backlogs do not prevent a settled route replay.
 const other=client(backend(validateProof).handler),OR=other.window.MKTYRewards,OS=other.window.MKTYStory;
 await OS.open(1);await other.settle();assert.equal(OR.pendingCompletion(1),false);
 other.storage.setItem('mkty_pending_v2_101',JSON.stringify([{id:'life:2:complete',action:'life.complete',payload:{life:2,event_key:'life:2:complete'}},{id:'spend:1',action:'lives.spend',payload:{event_key:'spend:1'}}]));
 assert.equal(OR.pendingCompletion(1),false);assert.equal(OR.pendingCompletion(2),true);OS.replay(1);await other.settle();assert.equal(resetCalls(other).length,1);assert.equal(queue(other).length,2);
 other.window.Telegram.WebApp.initData='';other.failRead(true);assert.equal(OR.pendingCompletion(1),false,'guest replay keeps its existing local-demo behavior');

 // Account changes isolate status and make old retry completions unable to
 // alter the current plan screen or navigate away from the user's new screen.
 const switched=await completed(validateProof),a=switched.h;
 switched.server.hold(true);const retry=switched.S.replay(1);await turn();assert.equal(switched.server.holds.length,1);
 a.owner(202);assert.equal(switched.R.pendingCompletion(1),false);await switched.S.open(1);await turn();
 const accountB=a.storage.getItem('mkty_story_plan_1_v1');a.show('chapters');switched.server.hold(false);switched.server.holds[0].resolve();await retry;
 assert.equal(a.active(),'chapters');assert.equal(a.storage.getItem('mkty_story_plan_1_v1'),accountB);assert.equal(a.storage.getItem('mkty_story_archive_latest_1'),null);assert.equal(resetCalls(a).length,0);
 a.owner(101);assert.equal(switched.R.pendingCompletion(1),true);assert.equal(queue(a).length,1);

 // Returning to the same plan while a retry is held must not leave its
 // Checking button disabled after either an unsuccessful or successful reply.
 for(const settles of [false,true]){
  const returned=await completed(validateProof),rh=returned.h;returned.server.hold(true);
  const job=returned.S.replay(1);await turn();assert.equal(returned.server.holds.length,1);
  const saved=rh.storage.getItem('mkty_story_plan_1_v1'),receipt=rh.storage.getItem('mkty_proof_route_1');
  rh.show('chapters');returned.S.menu(1);assert.equal(rh.get('storyReplay').disabled,true);assert.match(rh.get('storyReplay').textContent,/CHECKING REWARD/);
  returned.server.fail(!settles);returned.server.hold(false);returned.server.holds[0].resolve();await job;await rh.settle();
  assert.equal(rh.active(),'storyPlan');assert.equal(rh.get('storyReplay').disabled,false,'leave-and-return retry must re-enable the visible button: settled='+settles);
  assert.match(rh.get('storyReplay').textContent,settles?/NEW CHAPTER ROUTE/:/RETRY REWARD SYNC/);assert.equal(returned.R.pendingCompletion(1),!settles);
  assert.equal(rh.storage.getItem('mkty_story_plan_1_v1'),saved);assert.equal(rh.storage.getItem('mkty_proof_route_1'),receipt);assert.equal(resetCalls(rh).length,0);
 }
 // Completing on another visible chapter must not repaint it or return users
 // to the pending chapter. Only the current retry job owns its final UI update.
 const another=await completed(validateProof);another.server.hold(true);const awayJob=another.S.replay(1);await turn();
 another.h.seed(P.fresh(2,123,2));another.h.show('chapters');another.S.menu(2);let otherRenders=0;another.h.get('storyPlan').style.setProperty=()=>{otherRenders++;};
 another.server.hold(false);another.server.holds[0].resolve();await awayJob;assert.equal(otherRenders,0);assert.equal(another.h.active(),'storyPlan');assert.match(another.h.get('storyCoverNumber').textContent,/02/);

 const stayedAway=await completed(validateProof);stayedAway.server.hold(true);const hiddenJob=stayedAway.S.replay(1);await turn();stayedAway.h.show('chapters');
 let hiddenRenders=0;stayedAway.h.get('storyPlan').style.setProperty=()=>{hiddenRenders++;};stayedAway.server.hold(false);stayedAway.server.holds[0].resolve();await hiddenJob;
 assert.equal(hiddenRenders,0);assert.equal(stayedAway.h.active(),'chapters');
 // Same-account reentry can refresh current UI even when its original transport
 // generation was invalidated. This cleanup never interprets a stale payload.
 const reentered=await completed(validateProof),reentryGate=deferred();reentered.R.syncPlayer=()=>reentryGate.promise;const reentryJob=reentered.S.replay(1);
 reentered.h.show('chapters');reentered.h.owner(202);reentered.h.seed(P.fresh(1,333,2));reentered.S.menu(1);
 reentered.h.show('chapters');reentered.h.owner(101);reentered.S.menu(1);assert.equal(reentered.h.get('storyReplay').disabled,true);
 reentryGate.resolve();await reentryJob;assert.equal(reentered.h.get('storyReplay').disabled,false);assert.equal(reentered.R.pendingCompletion(1),true);assert.equal(resetCalls(reentered.h).length,0);

 // Separate UI retry barriers exercise A -> B -> A supersession independently
 // of transport coalescing. An older job cannot repaint or clear the newer job.
 const roundtrip=await completed(validateProof),gates=[];roundtrip.R.syncPlayer=()=>{const gate=deferred();gates.push(gate);return gate.promise;};
 const originalA=roundtrip.S.replay(1);roundtrip.h.show('chapters');roundtrip.h.owner(202);
 roundtrip.h.seed(P.fresh(1,222,2));roundtrip.h.storage.setItem('mkty_pending_v2_202',JSON.stringify([{id:'life:1:complete',action:'life.complete',payload:{life:1,event_key:'life:1:complete'}}]));
 roundtrip.S.menu(1);const accountBJob=roundtrip.S.replay(1);roundtrip.h.show('chapters');roundtrip.h.owner(101);roundtrip.S.menu(1);const currentA=roundtrip.S.replay(1);
 assert.equal(gates.length,3);let currentRenders=0;roundtrip.h.get('storyPlan').style.setProperty=()=>{currentRenders++;};
 gates[0].resolve();await originalA;gates[1].resolve();await accountBJob;
 assert.equal(currentRenders,0,'superseded account jobs cannot repaint the current retry');assert.equal(roundtrip.h.get('storyReplay').disabled,true);
 gates[2].resolve();await currentA;assert.equal(currentRenders,1);assert.equal(roundtrip.h.get('storyReplay').disabled,false);assert.equal(resetCalls(roundtrip.h).length,0);

 // A stale "Retry" button remains non-destructive if another sync settled in
 // the background. A second explicit, freshly labelled replay is required.
 const stale=await completed(validateProof);stale.server.fail(false);await stale.R.syncPlayer();
 assert.equal(stale.R.pendingCompletion(1),false);assert.match(stale.h.get('storyReplay').textContent,/RETRY/);
 stale.h.get('storyReplay').click();await stale.h.settle();assert.equal(resetCalls(stale.h).length,0);assert.match(stale.h.get('storyReplay').textContent,/NEW CHAPTER ROUTE/);
 console.log('PASS: pending replay guard, settled explicit reset, intact proof/archive/rewards, unreadable queues, memory-only edits, account switches, repeated actions and non-destructive retry');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>clearTimeout(deadline));
