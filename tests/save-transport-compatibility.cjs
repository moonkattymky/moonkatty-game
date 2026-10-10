/* Optional save/proof transport contract. Actual current and pre-codec clients
 * call actual current and pinned legacy handlers through an in-process fetch.
 * Only a disposable PGlite database and synthetic/golden model data are used.
 * No sockets, browser launch, real accounts, deployment, or external requests. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {PGlite}=require('@electric-sql/pglite');
const root=path.resolve(__dirname,'..'),P=require('../story-plan.js'),Field=require('../field-model.js'),Board=require('../mission-rules.js'),Flight=require('../expedition-model.js'),Codec=require('../trace-codec.js');
const golden=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/chapter1-proof.json'),'utf8'));
const source=file=>fs.readFileSync(path.join(root,file),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
const turn=()=>new Promise(resolve=>setImmediate(resolve));
const sqlFiles=['server/schema.sql','server/migrations/20261007_social_verify.sql','supabase/migrations/20261007200800_reward_integrity_sessions.sql','supabase/migrations/20261008201825_launch_campaign_integrity.sql'];
function moduleURL(text,file,overrides={}){
 const {pathToFileURL}=require('node:url');
 const absolute=text.replace(/from\s+(['"])(\.\/[^'"]+)\1/g,(_match,_quote,relative)=>'from '+JSON.stringify(overrides[relative]||pathToFileURL(path.resolve(root,path.dirname(file),relative)).href));
 return 'data:text/javascript;base64,'+Buffer.from(absolute).toString('base64');
}

function client(handler,id=101,{legacy=false}={}){
 let owner=String(id),active='home',random=golden.route.seed,timerId=0,reloads=0;
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
 const storage={getItem:k=>data().get(k)??null,setItem:(k,v)=>{const text=String(v),before=data().get(k);data().set(k,text);if(before!==text)emit('mkty:storage',{detail:{key:k}});},removeItem:k=>{if(data().delete(k))emit('mkty:storage',{detail:{key:k}});},key:i=>[...data().keys()][i],get length(){return data().size;}};
 const window={Telegram:{WebApp:{}},...(legacy?{}:{MKTYTraceCodec:Codec}),MKTYStorage:{identity:()=>owner,keys:()=>[...data().keys()],snapshot:()=>Object.fromEntries(data()),readItem:k=>storage.getItem(k),persistent:true},MKTYCampaign:{render(){}},addEventListener:on,dispatchEvent:e=>emit(e.type,e)};
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
 vm.createContext(context);for(const file of ['rewards-client.js','cloud-save.js','story.js']){const input=legacy&&file!=='story.js'?'tests/fixtures/legacy-'+file.replace('.js','-61b514c.js'):file;vm.runInContext(source(input),context,{filename:input});}
 const seed=s=>storage.setItem('mkty_story_plan_'+s.n+'_v1',JSON.stringify(s));
 const settle=async()=>{do{await Promise.all([...pending]);await turn();}while(pending.size);};
 return {window,storage,calls,responses,launches,get,seed,show,stores,settle,owner:setOwner,active:()=>active,reloads:()=>reloads,text:id=>get(id).children[0]?.textContent||get(id).textContent||''};
}


async function database(){
 const db=new PGlite();await db.exec('create role anon;create role authenticated;create role service_role;create function public.rls_auto_enable() returns event_trigger language plpgsql as $$begin end$$;');
 for(const file of sqlFiles)await db.exec(source(file));
 let now=new Date();const writes=[];
 const fetcher=async(url,opt={})=>{
  const u=new URL(url),name=u.pathname.split('/').pop(),body=opt.body?JSON.parse(opt.body):null,method=opt.method||'GET';assert.equal(u.hostname,'db.test');
  try{
   if(u.pathname.includes('/rpc/')){if(name==='mkty_cloud'&&body.p_snapshot!==undefined)writes.push(plain(body));assert.match(name,/^mkty_[a-z_]+$/);const entries=Object.entries(body),rows=(await db.query(`select public.${name}(${entries.map(([k],i)=>k+'=> $'+(i+1)).join(',')}) as result`,entries.map(([,v])=>v&&typeof v==='object'?JSON.stringify(v):v))).rows;return Response.json(rows[0].result);}
   assert(['players','reward_events','referral_events'].includes(name));
   const values=[],param=v=>{values.push(v);return '$'+values.length;};
   const conditions=[...u.searchParams].filter(([k])=>!['select','limit','on_conflict','order'].includes(k)).map(([k,v])=>{assert.match(k,/^[a-z_]+$/);if(v==='is.null')return k+' is null';const [op,...r]=v.split('.');assert(['eq','gte','gt'].includes(op));return k+({eq:'=',gte:'>=',gt:'>'}[op])+param(r.join('.'));});
   const where=conditions.length?' where '+conditions.join(' and '):'';let sql;
   if(method==='GET')sql=`select * from public.${name}${where}`;
   if(method==='PATCH')sql=`update public.${name} set ${Object.entries(body).map(([k,v])=>k+'='+param(v)).join(',')}${where} returning *`;
   if(method==='POST'){const entries=Object.entries(body);sql=`insert into public.${name}(${entries.map(([k])=>k).join(',')}) values(${entries.map(([,v])=>param(v)).join(',')}) on conflict do nothing returning *`;}
   assert(sql);return Response.json((await db.query(sql,values)).rows);
  }catch(error){return Response.json({error:error.message},{status:500});}
 };
 const {createHandler}=await import('../server/rewards/core.mjs');
 const legacyFieldURL=moduleURL(source('tests/fixtures/legacy-field-model-61b514c.mjs'),'server/rewards/models/field-model.mjs');
 const campaignURL=moduleURL(source('tests/fixtures/legacy-campaign-61b514c.mjs'),'server/rewards/campaign.mjs',{'./models/field-model.mjs':legacyFieldURL});
 const {createHandler:createLegacyHandler}=await import(moduleURL(source('tests/fixtures/legacy-core-61b514c.mjs'),'server/rewards/core.mjs',{'./campaign.mjs':campaignURL}));
 const noNetwork=()=>{throw Error('external network is forbidden in this fixture');};
 const options={url:'https://db.test',key:'synthetic-local-fixture-key',fetcher,tgFetcher:noNetwork,ytFetcher:noNetwork,verify:async initData=>({id:JSON.parse(new URLSearchParams(initData).get('user')).id}),clock:()=>now};
 const handler=createHandler({...options,traceTransport:true}),decoderHandler=createHandler(options),legacyHandler=createLegacyHandler(options);
 return {db,handler,decoderHandler,legacyHandler,writes,advance:ms=>{now=new Date(now.getTime()+ms);}};
}

async function goldenFlow(fixture,h,compact){
 const R=h.window.MKTYRewards,S=h.window.MKTYStory,account=h.window.MKTYStorage.identity();
 assert.equal(R.requiresRoute,undefined);assert.equal(R.routeReady,undefined);
 await S.open(1);await h.settle();
 const route=JSON.parse(h.storage.getItem('mkty_proof_route_1'));
 assert(route,JSON.stringify({owner:account,calls:h.calls.map(x=>x.body.action),responses:h.responses}));assert.equal(route.seed,golden.route.seed);assert.equal(route.edition,2);
 assert.deepEqual(Object.keys(route).sort(),['telegram_id','life','route','seed','edition','started_at','verified_at'].sort(),'transport adds no route fields');
 const open=h.calls.filter(x=>x.body.action==='campaign.open');assert.equal(open.length,1);
 assert.deepEqual({life:open[0].body.life,seed:open[0].body.seed,edition:open[0].body.edition,reset:open[0].body.reset},{life:1,seed:golden.route.seed,edition:2,reset:false});
 assert.equal(open[0].body.previous_route,undefined);assert.equal(open[0].body.protocol,undefined);
 await R.prepareRoute(1);assert.equal(h.calls.filter(x=>x.body.action==='campaign.open').length,1,'the unchanged receipt remains reusable');
 for(const item of golden.proof.tasks){
  h.get('storySteps').children.find(button=>Number(button.dataset.storyStep)===item.id).click();
  const {task}=h.launches.at(-1);assert.equal(task.id,item.id);assert.equal(task.seed,P.seedFor(S.read(1),item.id,item.attempt));
  task.complete(plain(item.state));assert(S.read(1).done.includes(item.id));
 }
 h.get('storyNext').click();assert.equal(S.read(1).phase,'core');
 fixture.advance(600000);
 const first=await R.completeLife(1,500);assert.equal(first.source,'server');assert.equal(first.pts,500);
 const payout=h.calls.find(x=>x.body.action.startsWith('life.complete'));
 assert.equal(payout.body.action,compact?'life.complete.v2':'life.complete');
 assert.equal(payout.body.protocol,compact?Codec.PROTOCOL:undefined);
 const decoded=Codec.unpackProof(payout.body.proof);assert.equal(decoded.route,route.route);assert.deepEqual(decoded.tasks,golden.proof.tasks,'all recorded proof values replay unchanged');
 if(compact)assert(payout.raw.includes('mkty-trace'),'golden proof actually exercises the compact path');
 const paid=h.responses.find(x=>x.action===payout.body.action);assert.equal(paid.body.protocol,compact?Codec.PROTOCOL:undefined);
 const retry=await R.completeLife(1,500);assert.equal(retry.source,'server-idempotent');assert.equal(retry.pts,500);
 assert.equal((await fixture.db.query("select count(*)::int count from reward_events where telegram_id=$1 and event_key='life:1:complete'",[Number(account)])).rows[0].count,1);
 assert.equal(h.storage.getItem('mkty_pending_v2_'+account),'[]');
 // Explicit replay continues to use precisely seed / edition / reset.
 S.menu(1);h.get('storyReplay').click();await h.settle();
 const next=JSON.parse(h.storage.getItem('mkty_proof_route_1')),reset=h.calls.filter(x=>x.body.action==='campaign.open').at(-1).body;
 assert.notEqual(next.route,route.route);assert.equal(next.seed,S.read(1).seed);assert.notEqual(next.seed,route.seed);
 assert.equal(reset.reset,true);assert.equal(reset.edition,2);assert.equal(reset.seed,next.seed);assert.equal(reset.previous_route,undefined);assert.equal(next.challenge_version,undefined);
 assert.deepEqual(plain(S.read(1).done),[]);
 return decoded.tasks;
}

function replayFlight(trace){
 const profile=Flight.profile(),run=Flight.create(456,'rescue',1,profile);
 for(const row of trace)for(let i=0;i<row[1];i++)Flight.step(run,profile,{x:row[2],y:row[3],boost:row[4],action:row[5]},.02);
 return {version:1,profile,run,trace};
}

(async()=>{
 assert.deepEqual(Codec.LIMITS,{maxRows:25000,maxTicks:200000,snapshotEntryBytes:180000,snapshotBytes:350000,decodedEntryBytes:1000000,decodedSnapshotBytes:2000000,proofBytes:1000000,transportBytes:400000,maxDepth:64,maxLiteralBytes:65536},'compatibility must not increase any codec budget');
 const fixture=await database();
 try{
  const current=client(fixture.handler,101),old=client(fixture.handler,102,{legacy:true}),fallback=client(fixture.legacyHandler,103),decoderProof=client(fixture.decoderHandler,104);
  assert.equal(await current.window.MKTYRewards.traceProtocol(),Codec.PROTOCOL);
  await current.window.MKTYRewards.call('player');
  for(const action of ['session','player'])assert.equal(current.responses.find(r=>r.action===action).body.capabilities.trace_codec,Codec.PROTOCOL);
  assert.equal(old.window.MKTYTraceCodec,undefined,'historical clients must work without loading the codec');
  const proofs=[];
  for(const [h,compact]of [[current,true],[old,false],[fallback,false],[decoderProof,false]])proofs.push(await goldenFlow(fixture,h,compact));
  for(const proof of proofs.slice(1))assert.deepEqual(proofs[0],proof);
  assert.equal(await fallback.window.MKTYRewards.traceProtocol(),null);
  for(const r of fallback.responses.filter(x=>['session','player'].includes(x.action)))assert.equal(r.body.capabilities,undefined);
  for(const h of [old,fallback,decoderProof])for(const call of h.calls){assert(!call.body.action.endsWith('.v2'));assert.equal(call.body.protocol,undefined);assert(!call.raw.includes('mkty-trace'));}

  // Four model minutes of tiny alternating input keep this real flight active.
  // Every 20 ms tick is retained; no coalescing, reward flags, or fabricated state.
  const trace=Array.from({length:12000},(_,i)=>['tick',1,i%2?.001:-.001,0,false,false]);
  const flight=replayFlight(trace),key='mkty_expeditions_v1',raw=Codec.stringify(flight);
  assert.equal(flight.run.phase,'flight');assert(flight.run.ship.hull>0);assert.equal(trace.length*.02,240);
  assert(Codec.utf8Bytes(raw)>180000);
  const cloud=client(fixture.handler,201),C=cloud.window.MKTYCloud;
  cloud.storage.setItem(key,raw);await C.flush();
  const sent=cloud.calls.find(x=>x.body.snapshot),saved=async id=>(await fixture.db.query('select revision,snapshot from mkty_cloud_saves where telegram_id=$1',[id])).rows[0];
  assert.equal(sent.body.action,'campaign.cloud.v2');assert.equal(sent.body.protocol,Codec.PROTOCOL);assert(Codec.utf8Bytes(sent.body.snapshot[key])<180000);assert(Codec.utf8Bytes(sent.raw)<=400000);
  assert.equal(cloud.storage.getItem(key),raw);assert.equal(cloud.storage.getItem('mkty_cloud_dirty'),null);assert.equal(cloud.storage.getItem('mkty_cloud_revision'),'1');
  let stored=await saved(201);assert.deepEqual(stored.snapshot,Codec.packSnapshot({[key]:raw}));assert.equal(Codec.unpackSnapshot(stored.snapshot)[key],raw);
  const reopened=client(fixture.handler,201);await reopened.window.MKTYCloud.load();
  assert.equal(reopened.storage.getItem(key),raw);assert.equal(reopened.storage.getItem('mkty_cloud_revision'),'1');
  const downloaded=JSON.parse(reopened.storage.getItem(key));assert.deepEqual(replayFlight(downloaded.trace),flight,'downloaded rows replay the identical model state');
  const resumed=Flight.restore(downloaded),baseline=Flight.restore(flight);assert(resumed.run&&baseline.run);
  for(let i=0;i<600;i++){const input={x:(i%9-4)/1000,y:(i%7-3)/1000,boost:false,action:false};Flight.step(resumed.run,resumed.profile,input,.02);Flight.step(baseline.run,baseline.profile,input,.02);}
  assert.deepEqual(resumed,baseline,'restored checkpoint continuation is identical');

  // A truly pre-codec client receives expanded snapshots, including CAS conflicts.
  const oldCloud=client(fixture.handler,201,{legacy:true});await oldCloud.window.MKTYCloud.load();
  assert.equal(oldCloud.storage.getItem(key),raw);assert.equal(oldCloud.storage.getItem('mkty_cloud_revision'),'1');
  let legacyRead=oldCloud.responses.find(x=>x.action==='campaign.cloud').body;
  assert.equal(legacyRead.protocol,undefined);assert.equal(legacyRead.snapshot[key],raw);assert(!JSON.stringify(legacyRead.snapshot).includes('mkty-trace'));
  const localBefore=JSON.stringify({run:{seed:456},trace:trace.slice(0,2)});oldCloud.storage.setItem(key,localBefore);
  // A compact prefix plus fresh raw rows is canonicalized to one packed frame.
  const tail=Array.from({length:10},()=>['tick',1,.001,0,false,false]);
  const nextFlight=replayFlight([...trace,...tail]),nextRaw=Codec.stringify(nextFlight),mixed={...nextFlight,trace:[...Codec.packTrace(trace),...tail]};
  const uploaded=await cloud.window.MKTYRewards.authenticatedFetch(cloud.window.MKTYRewards.endpoint,{action:'campaign.cloud.v2',protocol:Codec.PROTOCOL,revision:1,snapshot:{[key]:Codec.stringify(mixed)}});
  assert.equal(uploaded.ok,true);assert.equal(uploaded.protocol,Codec.PROTOCOL);assert.equal(uploaded.revision,2);
  stored=await saved(201);assert.deepEqual(stored.snapshot,Codec.packSnapshot({[key]:nextRaw}));assert.equal(JSON.parse(stored.snapshot[key]).trace.length,1);
  await oldCloud.window.MKTYCloud.flush();
  const conflicted=oldCloud.responses.filter(x=>x.action==='campaign.cloud').at(-1).body;
  assert.equal(conflicted.conflict,true);assert.equal(conflicted.revision,2);assert.equal(conflicted.protocol,undefined);assert.equal(conflicted.snapshot[key],nextRaw);
  assert.equal(oldCloud.storage.getItem(key),localBefore);assert.equal(oldCloud.storage.getItem('mkty_cloud_dirty'),'yes');assert.deepEqual(await saved(201),stored);
  const choose=oldCloud.get('cloudSaveStatus').children.find(x=>x.onclick);assert(choose);choose.onclick();
  assert.equal(oldCloud.reloads(),1);assert.equal(oldCloud.storage.getItem(key),nextRaw);assert.equal(JSON.parse(oldCloud.storage.getItem('mkty_cloud_recovery'))[key],localBefore);
  assert.deepEqual(Flight.restore(JSON.parse(oldCloud.storage.getItem(key))),Flight.restore(nextFlight));
  for(const call of oldCloud.calls){assert.equal(call.body.protocol,undefined);assert(!call.raw.includes('mkty-trace'));}

  // Old raw uploads still work, while the server stores a canonical compact copy.
  const rawWriter=client(fixture.handler,202,{legacy:true}),smallFlight=replayFlight(trace.slice(0,100)),smallRaw=Codec.stringify(smallFlight);
  rawWriter.storage.setItem(key,smallRaw);await rawWriter.window.MKTYCloud.flush();
  assert.equal(rawWriter.storage.getItem('mkty_cloud_dirty'),null);assert.equal(rawWriter.calls.find(x=>x.body.snapshot).body.action,'campaign.cloud');
  assert.deepEqual((await saved(202)).snapshot,Codec.packSnapshot({[key]:smallRaw}));
  const rawReader=client(fixture.handler,202,{legacy:true});await rawReader.window.MKTYCloud.load();assert.equal(rawReader.storage.getItem(key),smallRaw);

  // The new client continues to refuse oversized raw uploads to a legacy server.
  const legacyCloud=client(fixture.legacyHandler,203);legacyCloud.storage.setItem(key,smallRaw);await legacyCloud.window.MKTYCloud.flush();
  const legacyStored=await saved(203),legacyWrites=legacyCloud.calls.filter(x=>x.body.snapshot).length;
  assert.equal(legacyStored.snapshot[key],smallRaw);
  legacyCloud.storage.setItem(key,raw);await legacyCloud.window.MKTYCloud.flush();
  assert.equal(legacyCloud.calls.filter(x=>x.body.snapshot).length,legacyWrites);assert.equal(legacyCloud.storage.getItem(key),raw);assert.equal(legacyCloud.storage.getItem('mkty_cloud_dirty'),'yes');assert.deepEqual(await saved(203),legacyStored);
  for(const call of legacyCloud.calls){assert(!call.body.action.endsWith('.v2'));assert.equal(call.body.protocol,undefined);assert(!call.raw.includes('mkty-trace'));}

  // Ordinary size/corruption failures reject the entire save before the write RPC.
  const valid='mkty_current_chapter',badFrame=JSON.parse(stored.snapshot[key]);badFrame.trace[0][4]=badFrame.trace[0][4].slice(0,-4);
  const excessiveRows=JSON.parse(stored.snapshot[key]);excessiveRows.trace[0][2]=Codec.LIMITS.maxRows+1;
  const cases=[
   {[valid]:'2',[key]:'x'.repeat(180000)},
   {[valid]:'2',[key]:'ü'.repeat(90000)},
   {[valid]:'2',[key]:'a'.repeat(175000),mkty_operations_1_v1:'b'.repeat(175000)},
   {[valid]:'2',[key]:null},
   {[valid]:'2',[key]:Codec.stringify(badFrame)},
   {[valid]:'2',[key]:Codec.stringify(excessiveRows)}
  ];
  for(const action of ['campaign.cloud','campaign.cloud.v2'])for(const snapshot of cases){
   const before=plain(await saved(201)),writes=fixture.writes.length;
   const r=await cloud.window.MKTYRewards.authenticatedFetch(cloud.window.MKTYRewards.endpoint,{action,...(action.endsWith('.v2')?{protocol:Codec.PROTOCOL}:{}),revision:2,snapshot});
   assert.equal(r.ok,false);assert.match(r.error,/^snapshot(?:_too_large|_transport_invalid)?$/);assert.equal(fixture.writes.length,writes,'no partial write RPC');assert.deepEqual(plain(await saved(201)),before);
  }
  const before=plain(await saved(201)),writes=fixture.writes.length;
  const missingProtocol=await fixture.handler(new Request('https://in-process.test/rewards',{method:'POST',body:JSON.stringify({action:'campaign.cloud.v2',initData:'user='+encodeURIComponent(JSON.stringify({id:201})),revision:2,snapshot:{[valid]:'2'}})}));
  assert.equal(missingProtocol.status,400);assert.equal((await missingProtocol.json()).error,'protocol');assert.equal(fixture.writes.length,writes);assert.deepEqual(plain(await saved(201)),before);
  // The same 400000-byte request envelope remains strict for UTF-8 input.
  const oversizedBody=JSON.stringify({action:'campaign.cloud.v2',protocol:Codec.PROTOCOL,initData:'user='+encodeURIComponent(JSON.stringify({id:201})),revision:2,snapshot:{[key]:'ü'.repeat(200000)}});
  assert(oversizedBody.length<400000&&Buffer.byteLength(oversizedBody)>400000);
  const oversized=await fixture.handler(new Request('https://in-process.test/rewards',{method:'POST',body:oversizedBody}));
  assert.equal(oversized.status,413);assert.equal((await oversized.json()).error,'body');assert.equal(fixture.writes.length,writes);assert.deepEqual(plain(await saved(201)),before);
  // A default deployment decodes existing compact saves but cannot write new
  // compact records or advertise the feature until its explicit rollout flag.
  const decoder=client(fixture.decoderHandler,201),D=decoder.window.MKTYRewards;
  assert.equal(await D.traceProtocol(),null);await D.call('player');
  for(const response of decoder.responses.filter(x=>['session','player'].includes(x.action)))assert.equal(response.body.capabilities,undefined);
  await decoder.window.MKTYCloud.load();assert.equal(decoder.storage.getItem(key),nextRaw);assert.equal(decoder.storage.getItem('mkty_cloud_revision'),'2');
  const decodedRead=decoder.responses.find(x=>x.action==='campaign.cloud').body;
  assert.equal(decodedRead.protocol,undefined);assert.equal(decodedRead.snapshot[key],nextRaw);assert(!JSON.stringify(decodedRead.snapshot).includes('mkty-trace'));
  decoder.storage.setItem(key,smallRaw);
  const newer=await cloud.window.MKTYRewards.authenticatedFetch(cloud.window.MKTYRewards.endpoint,{action:'campaign.cloud.v2',protocol:Codec.PROTOCOL,revision:2,snapshot:stored.snapshot});
  assert.equal(newer.ok,true);assert.equal(newer.revision,3);const packedBefore=plain(await saved(201));
  await decoder.window.MKTYCloud.flush();
  const decoderConflict=decoder.responses.filter(x=>x.action==='campaign.cloud').at(-1).body;
  assert.equal(decoderConflict.conflict,true);assert.equal(decoderConflict.revision,3);assert.equal(decoderConflict.snapshot[key],nextRaw);assert.equal(decoderConflict.protocol,undefined);
  assert.equal(decoder.storage.getItem(key),smallRaw);assert.equal(decoder.storage.getItem('mkty_cloud_dirty'),'yes');assert.deepEqual(plain(await saved(201)),packedBefore);
  const decoderOld=client(fixture.decoderHandler,201,{legacy:true});await decoderOld.window.MKTYCloud.load();assert.equal(decoderOld.storage.getItem(key),nextRaw);
  const decoderWriter=client(fixture.decoderHandler,204),W=decoderWriter.window.MKTYRewards;
  decoderWriter.storage.setItem(key,smallRaw);await decoderWriter.window.MKTYCloud.flush();
  assert.equal(decoderWriter.storage.getItem('mkty_cloud_dirty'),null);assert.equal(decoderWriter.calls.find(x=>x.body.snapshot).body.action,'campaign.cloud');
  const rawBefore=plain(await saved(204));assert.equal(rawBefore.snapshot[key],smallRaw);assert(!rawBefore.snapshot[key].includes('mkty-trace'));
  for(const snapshot of [{mkty_current_chapter:'2',[key]:'x'.repeat(180000)},stored.snapshot]){
   const writeCount=fixture.writes.length;
   const rejected=await W.authenticatedFetch(W.endpoint,{action:'campaign.cloud',revision:1,snapshot});
   assert.equal(rejected.ok,false);assert.equal(rejected.error,'snapshot_too_large');assert.equal(fixture.writes.length,writeCount);assert.deepEqual(plain(await saved(204)),rawBefore);
  }
  const rawRequests=decoderWriter.calls.filter(x=>x.body.snapshot).length;
  decoderWriter.storage.setItem(key,raw);await decoderWriter.window.MKTYCloud.flush();
  assert.equal(decoderWriter.calls.filter(x=>x.body.snapshot).length,rawRequests);assert.equal(decoderWriter.storage.getItem('mkty_cloud_dirty'),'yes');assert.equal(decoderWriter.storage.getItem(key),raw);assert.deepEqual(plain(await saved(204)),rawBefore);
  for(const action of ['campaign.cloud.v2','life.complete.v2']){
   const writeCount=fixture.writes.length;
   const disabled=await fixture.decoderHandler(new Request('https://in-process.test/rewards',{method:'POST',body:JSON.stringify({action,protocol:Codec.PROTOCOL,initData:'user='+encodeURIComponent(JSON.stringify({id:204})),revision:1,snapshot:{mkty_current_chapter:'2'},life:1,proof:golden.proof})}));
   assert.equal(disabled.status,400);const result=await disabled.json();assert.equal(result.ok,false);assert.equal(result.error,'action');assert.equal(result.protocol,undefined);assert.equal(fixture.writes.length,writeCount);assert.deepEqual(plain(await saved(204)),rawBefore);
  }
  assert.equal((await fixture.db.query('select count(*)::int count from reward_events where telegram_id=204')).rows[0].count,0);
  for(const h of [decoder,decoderOld,decoderWriter])for(const call of h.calls){assert(!call.body.action.endsWith('.v2'));assert.equal(call.body.protocol,undefined);}
  console.log(JSON.stringify({test:'save-transport-compatibility',clientServerMatrix:['current/opt-in','precodec/opt-in','current/legacy','current/default'],goldenProofs:4,rewardPoints:500,idempotent:true,routeHandshake:'seed/edition/reset unchanged',flightSeconds:240,traceRows:trace.length,rawBytes:Codec.utf8Bytes(raw),packedBytes:Codec.utf8Bytes(sent.body.snapshot[key]),continuationTicks:600,legacyRawReadsAndConflicts:true,canonicalPrefixAndTail:true,allOrNothingRejections:cases.length*2,utf8RequestLimit:true,defaultDecoderOnly:true,isolatedDatabase:true,externalRequests:0}));
 }finally{await fixture.db.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
