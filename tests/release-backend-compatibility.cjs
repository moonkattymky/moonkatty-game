/* Static-release contract against main 61b514c8e6f350dfb05304890d861f0bee089be0.
 * Actual story/reward/cloud clients and the pinned legacy rewards handler run
 * against a disposable PGlite database. No sockets, external requests, real
 * accounts, backend deployment, or production data are used. The small DOM
 * routes real task callbacks; browser layout is covered by separate suites. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {PGlite}=require('@electric-sql/pglite');
const root=path.resolve(__dirname,'..'),P=require('../story-plan.js'),Field=require('../field-model.js'),Board=require('../mission-rules.js'),Flight=require('../expedition-model.js'),Codec=require('../trace-codec.js');
const golden=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/chapter1-proof.json'),'utf8'));
const source=file=>fs.readFileSync(path.join(root,file),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
const turn=()=>new Promise(resolve=>setImmediate(resolve));
// Exact published legacy modules remain immutable compatibility fixtures.
const legacyCampaign=source('tests/fixtures/legacy-campaign-61b514c.mjs');
const legacyCore=source('tests/fixtures/legacy-core-61b514c.mjs');
function moduleURL(text,file,overrides={}){
 const {pathToFileURL}=require('node:url');
 const absolute=text.replace(/from\s+(['"])(\.\/[^'"]+)\1/g,(_match,_quote,relative)=>'from '+JSON.stringify(overrides[relative]||pathToFileURL(path.resolve(root,path.dirname(file),relative)).href));
 return 'data:text/javascript;base64,'+Buffer.from(absolute).toString('base64');
}

// An intentional backend rollout must update this release-specific contract.
// These are Git blob hashes, so this check also works in a shallow CI checkout.
const pinned={
 'server/rewards/core.mjs':'983bb2bb98bfde7f6e5d50f46996a46f0d6485cb',
 'server/rewards/campaign.mjs':'f01bde1d6e3e98c8fc8bd4e72fb0088b278d2372',
 'server/schema.sql':'f0ded769f0160bc4d0e81b88c4e7f793e2eeaa76',
 'server/migrations/20261007_social_verify.sql':'00969f82a67e1c49e28f77a5e7dc5a8a0f5e6e91',
 'supabase/migrations/20261007200800_reward_integrity_sessions.sql':'8fed546a14d081b82f818eb8b6c5c4ff5bffdc7f',
 'supabase/migrations/20261008201825_launch_campaign_integrity.sql':'0c4887e377bb53ea86358d2085a0661b191cfa95',
 'story-plan.js':'e0638e84b51fbd3419d47d3fb3fcd19da4cee2d3',
 'tests/fixtures/legacy-field-model-61b514c.mjs':'0c1b77acad5de10e8d66ee1cb114e6b038da7e54',
 'tests/fixtures/legacy-rewards-client-61b514c.js':'5f1c33d03b493f6902722cc483c3c1726cd1ca07',
 'tests/fixtures/legacy-cloud-save-61b514c.js':'904b5341e9656dfa8ad5714e18fea02472889521'
};
function checkReleaseSources(){
 for(const [file,sha]of Object.entries(pinned)){
  const bytes=file==='server/rewards/campaign.mjs'?Buffer.from(legacyCampaign):file==='server/rewards/core.mjs'?Buffer.from(legacyCore):fs.readFileSync(path.join(root,file));
  assert.equal(crypto.createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex'),sha,'legacy contract changed: '+file);
 }
 for(const file of ['20261009151834_trusted_campaign_routes.sql','20261009153246_atomic_submission_admission.sql'])assert(!fs.existsSync(path.join(root,'supabase/migrations',file)),'unapproved rollout migration is outside this client release');
 const deploy=source('.github/workflows/deploy-pages.yml');
 const exclusion=deploy.match(/^\s+(_site\|[^\n]+)\) continue ;;/m);assert(exclusion,'Pages must use its reviewed client-only artifact exclusions');
 const excluded=new Set(exclusion[1].split('|'));
 for(const item of ['server','supabase','admin.html','tests','tools','docs','.git','.github','node_modules'])assert(excluded.has(item),'not excluded from Pages: '+item);
 for(const item of ['index.html','trace-codec.js','storage.js','cloud-save.js','rewards-client.js','story.js','art','visual-preview.css'])assert(!excluded.has(item),'required client dependency excluded: '+item);
 for(const file of fs.readdirSync(path.join(root,'.github/workflows')).filter(x=>/\.ya?ml$/.test(x)))assert(!/supabase\s+(?:functions\s+deploy|db\s+push|migration\s+up)/.test(source('.github/workflows/'+file)),'backend deployment step appeared in '+file);
 assert.match(deploy,/needs: verify/);
 const html=source('index.html');assert(html.indexOf('trace-codec.js')<html.indexOf('rewards-client.js'));assert(html.indexOf('trace-codec.js')<html.indexOf('cloud-save.js'));
 assert.match(html,/name="mkty-release" content="20261009-prelaunch-1"/);
}

function browser(handler,id=101){
 let owner=String(id),active='home',random=golden.route.seed,timerId=0;
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
 const window={Telegram:{WebApp:{}},MKTYTraceCodec:Codec,MKTYStorage:{identity:()=>owner,keys:()=>[...data().keys()],snapshot:()=>Object.fromEntries(data()),readItem:k=>storage.getItem(k),persistent:true},MKTYCampaign:{render(){}},addEventListener:on,dispatchEvent:e=>emit(e.type,e)};
 const setOwner=id=>{owner=String(id);window.Telegram.WebApp.initData='user='+encodeURIComponent(JSON.stringify({id:Number(owner)}));};setOwner(id);
 const show=id=>{window.MKTYStory?.onScreen(id);get(active).classes.delete('active');active=id;get(id).classes.add('active');};get(active).classes.add('active');
 const launch=(task,saved)=>{launches.push({task,saved});show(task.kind==='board'?'operationsDeck':task.kind==='field'?'fieldMission':'expeditionFlight');};
 window.MKTYPace={gate:()=>true,bypass:()=>true,risky:(_n,fn)=>fn()};
 const context={window,document,localStorage:storage,sessionStorage:{getItem:k=>sessions.get(k)||null,setItem:(k,v)=>sessions.set(k,v),removeItem:k=>sessions.delete(k)},console,URLSearchParams,AbortController,URL,Blob,Node:{DOCUMENT_POSITION_FOLLOWING:4},MouseEvent:class{constructor(type){this.type=type;}},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},MutationObserver:class{observe(){}},
  crypto:{getRandomValues:a=>{a[0]=random++;return a;}},setTimeout:(fn,ms)=>(timers.set(++timerId,{fn,ms}),timerId),clearTimeout:id=>timers.delete(id),setInterval(){},queueMicrotask(){},location:{reload(){throw Error('not part of this compatibility flow');}},
  StoryPlan:P,FieldRules:Field,MissionRules:Board,ExpeditionRules:Flight,MKTYPace:window.MKTYPace,FieldArt:{map:(_n,steps)=>steps.map(t=>`<g data-map-step="${t.id}"></g>`).join('')},show,remainingLife1CodeTime:()=>0,MKTYOps:{openTask:launch,pending:()=>false},MKTYField:{open:launch},MKTYExpedition:{openStory:launch},
  fetch:(url,opt)=>{assert.equal(url,window.MKTYRewards.endpoint,'only the injected in-process handler may be called');const body=JSON.parse(opt.body);calls.push({body,raw:opt.body,owner});const work=(async()=>{const r=await handler(new Request('https://legacy.test/rewards',{method:'POST',headers:opt.headers,body:opt.body}));const value=await r.json();responses.push({action:body.action,body:plain(value)});return {ok:r.ok,status:r.status,json:async()=>value};})();pending.add(work);return work.finally(()=>pending.delete(work));}
 };
 for(const [i,name]of ['openMission','openMission2','openLife3MemoryGate','openMission4','openMission5','openMission6','openMission7','openMission8','openMission9'].entries())window[name]=()=>show('mission'+(i+1));
 vm.createContext(context);for(const file of ['rewards-client.js','cloud-save.js','story.js'])vm.runInContext(source(file),context,{filename:file});
 const seed=s=>storage.setItem('mkty_story_plan_'+s.n+'_v1',JSON.stringify(s));
 const settle=async()=>{do{await Promise.all([...pending]);await turn();}while(pending.size);};
 return {window,storage,calls,responses,launches,get,seed,show,stores,settle,owner:setOwner,active:()=>active,text:id=>get(id).children[0]?.textContent||get(id).textContent||''};
}

async function database(){
 const db=new PGlite();await db.exec('create role anon;create role authenticated;create role service_role;create function public.rls_auto_enable() returns event_trigger language plpgsql as $$begin end$$;');
 for(const file of Object.keys(pinned).filter(x=>x.endsWith('.sql')))await db.exec(source(file));
 let now=new Date();
 const fetcher=async(url,opt={})=>{
  const u=new URL(url),name=u.pathname.split('/').pop(),body=opt.body?JSON.parse(opt.body):null,method=opt.method||'GET';assert.equal(u.hostname,'db.test');
  try{
   if(u.pathname.includes('/rpc/')){assert.match(name,/^mkty_[a-z_]+$/);const entries=Object.entries(body),rows=(await db.query(`select public.${name}(${entries.map(([k],i)=>k+'=> $'+(i+1)).join(',')}) as result`,entries.map(([,v])=>v&&typeof v==='object'?JSON.stringify(v):v))).rows;return Response.json(rows[0].result);}
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
 const legacyFieldURL=moduleURL(source('tests/fixtures/legacy-field-model-61b514c.mjs'),'server/rewards/models/field-model.mjs');
 const campaignURL=moduleURL(legacyCampaign,'server/rewards/campaign.mjs',{'./models/field-model.mjs':legacyFieldURL});
 const {createHandler}=await import(moduleURL(legacyCore,'server/rewards/core.mjs',{'./campaign.mjs':campaignURL}));
 const noNetwork=()=>{throw Error('external network is forbidden in this fixture');};
 const handler=createHandler({url:'https://db.test',key:'synthetic-local-fixture-key',fetcher,tgFetcher:noNetwork,ytFetcher:noNetwork,verify:async initData=>({id:JSON.parse(new URLSearchParams(initData).get('user')).id}),clock:()=>now});
 return {db,handler,advance:ms=>{now=new Date(now.getTime()+ms);}};
}

(async()=>{
 checkReleaseSources();const fixture=await database();
 try{
  const h=browser(fixture.handler),R=h.window.MKTYRewards,S=h.window.MKTYStory;
  assert.equal(R.accountScope(),'101');assert.equal(R.requiresRoute,undefined);assert.equal(R.routeReady,undefined);
  await S.open(1);assert.equal(h.active(),'storyPlan');assert.equal(h.get('storyNext').disabled,false,'legacy routes must not disable signed-in gameplay');
  // Let only the actual story-open call initiate registration: an explicit test
  // prepareRoute call here would conceal a missing registration call in story.js.
  await h.settle();const route=JSON.parse(h.storage.getItem('mkty_proof_route_1'));assert(route);assert.equal(route.seed,golden.route.seed);assert.equal(route.edition,2);assert.equal(route.challenge_version,undefined);
  const registration=h.calls.filter(x=>x.body.action==='campaign.open');assert.equal(registration.length,1);assert.equal(registration[0].body.seed,golden.route.seed);assert.equal(registration[0].body.edition,2);assert.equal(registration[0].body.reset,false);assert.equal(registration[0].body.previous_route,undefined);
  assert.equal(await R.traceProtocol(),null,'old session/player replies do not advertise compact transport');
  for(const response of h.responses.filter(x=>['session','player'].includes(x.action)))assert.equal(response.body.capabilities,undefined);
  const serializedPlan=h.storage.getItem('mkty_story_plan_1_v1');await S.open(1);await R.prepareRoute(1);assert.equal(h.storage.getItem('mkty_story_plan_1_v1'),serializedPlan);assert.equal(h.calls.filter(x=>x.body.action==='campaign.open').length,1,'cached legacy receipt is reused');

  // Real story callbacks validate the recorded eight-stage UI transcript using
  // the real rule models. There are no forged completion flags in this flow.
  for(const item of golden.proof.tasks){
   h.get('storySteps').children.find(button=>Number(button.dataset.storyStep)===item.id).click();
   const {task}=h.launches.at(-1);assert.equal(task.id,item.id);assert.equal(task.seed,P.seedFor(S.read(1),item.id,item.attempt));
   if(item.id===0){const checkpoint=Field.create(1,0,task.seed);checkpoint.trace=[['act','scan',0]];assert(Field.act(checkpoint,'scan',0));assert.equal(task.save(checkpoint),true);assert.equal(S.read(1).tasks[0].checkpoint.scanned,true);}
   task.complete(plain(item.state));assert(S.read(1).done.includes(item.id),'recorded task callback must advance the actual story');assert.equal(h.active(),'storyPlan');
  }
  h.get('storyNext').click();assert.equal(h.active(),'mission1');assert.equal(S.read(1).phase,'core');
  fixture.advance(600000);
  const earned=await R.completeLife(1,500);assert.equal(earned.source,'server');assert.equal(earned.pts,500);assert.equal(earned.pending,undefined);
  const payout=h.calls.find(x=>x.body.action==='life.complete');assert(payout);assert.equal(payout.body.protocol,undefined);assert.equal(payout.body.proof.route,route.route);assert.deepEqual(payout.body.proof.tasks,golden.proof.tasks);
  assert.equal(JSON.parse(h.storage.getItem('mkty_pending_v2_101')).length,0);
  assert.equal((await fixture.db.query("select count(*)::int count from reward_events where telegram_id=101 and event_key='life:1:complete'")).rows[0].count,1);
  const retry=await R.completeLife(1,500);assert.equal(retry.pts,500);assert.equal(retry.source,'server-idempotent');

  // A completed chapter can explicitly replay using the old reset handshake.
  S.menu(1);h.get('storyReplay').click();await h.settle();const replay=JSON.parse(h.storage.getItem('mkty_proof_route_1'));
  assert(replay);assert.notEqual(replay.route,route.route);assert.notEqual(replay.seed,route.seed);assert.equal(replay.seed,S.read(1).seed);assert.equal(replay.challenge_version,undefined);
  const reset=h.calls.filter(x=>x.body.action==='campaign.open').at(-1).body;assert.equal(reset.reset,true);assert.equal(reset.seed,replay.seed);assert.equal(reset.edition,2);assert.equal(reset.previous_route,undefined);
  const archiveKey=h.storage.getItem('mkty_story_archive_latest_1');assert(archiveKey);const archive=JSON.parse(h.storage.getItem(archiveKey));assert.equal(JSON.parse(archive.snapshot.mkty_story_plan_1_v1).done.length,8);
  assert.deepEqual(plain(S.read(1).done),[]);assert.equal(h.get('storyNext').disabled,false);h.get('storyNext').click();assert.equal(h.launches.at(-1).task.id,0);
  const stale=h.launches.at(-1).task;h.owner(202);assert.equal(R.accountScope(),'202');assert.equal(stale.save({marker:'must-not-cross-account'}),false);assert.equal(h.storage.getItem('mkty_story_plan_1_v1'),null);await S.open(1);const second=await R.prepareRoute(1);assert.equal(Number(second.telegram_id),202);assert.equal(R.accountScope(),'202');

  const cloud=browser(fixture.handler,303),C=cloud.window.MKTYCloud;
  const saved=async()=>(await fixture.db.query('select revision,snapshot from mkty_cloud_saves where telegram_id=303')).rows[0];
  const writeCalls=()=>cloud.calls.filter(x=>x.body.action==='campaign.cloud'&&x.body.snapshot!==undefined);
  const key='mkty_story_plan_1_v1',small=JSON.stringify({trace:[['tick',1,.001,0]]});
  cloud.storage.setItem(key,small);await C.flush();assert.equal(cloud.storage.getItem('mkty_cloud_dirty'),null);assert.equal(writeCalls().length,1);assert.equal(writeCalls()[0].body.protocol,undefined);assert.equal((await saved()).snapshot[key],small);
  // The legacy server silently drops oversized entries; the client must refuse
  // before POST, retaining both the previous cloud snapshot and dirty local work.
  for(const entries of [
   {[key]:'x'.repeat(180000)},
   {[key]:'😀'.repeat(45000)},
   {[key]:'a'.repeat(175000),mkty_operations_1_v1:'b'.repeat(175000)},
   {[key]:JSON.stringify({trace:Array.from({length:12000},(_,i)=>['tick',1,i%2?.001:-.001,0,false,false])})}
  ]){
   cloud.storage.removeItem('mkty_operations_1_v1');for(const [k,v]of Object.entries(entries))cloud.storage.setItem(k,v);
   const before=plain(await saved()),sent=writeCalls().length;await C.flush();assert.equal(writeCalls().length,sent);assert.deepEqual(plain(await saved()),before);assert.equal(cloud.storage.getItem('mkty_cloud_dirty'),'yes');assert.match(cloud.text('cloudSaveStatus'),/too large/);for(const [k,v]of Object.entries(entries))assert.equal(cloud.storage.getItem(k),v);
  }
  cloud.storage.removeItem('mkty_operations_1_v1');cloud.storage.setItem(key,'x'.repeat(179999));await C.flush();assert.equal(cloud.storage.getItem('mkty_cloud_dirty'),null);assert.equal((await saved()).snapshot[key].length,179999,'strictly below the legacy entry boundary remains syncable');
  const count=cloud.calls.length;const oversized=await cloud.window.MKTYRewards.authenticatedFetch(cloud.window.MKTYRewards.endpoint,{action:'test',text:'😀'.repeat(100000)});assert.equal(oversized.error,'body_too_large');assert.equal(cloud.calls.length,count,'400000-byte full-body bound includes UTF-8 and authentication');
  const proof={route:'oversized-local-proof',tasks:[{id:0,state:{trace:Array.from({length:24000},(_,i)=>['tick',1,i%2?.001:-.001,0,false,false])}}]};
  const queued=[{id:'life:1:complete',action:'life.complete',payload:{life:1,event_key:'life:1:complete',proof}}];cloud.storage.setItem('mkty_pending_v2_303',JSON.stringify(queued));const claims=cloud.calls.filter(x=>x.body.action==='life.complete').length;await cloud.window.MKTYRewards.syncPlayer();assert.equal(cloud.calls.filter(x=>x.body.action==='life.complete').length,claims);assert.deepEqual(JSON.parse(cloud.storage.getItem('mkty_pending_v2_303')),queued);assert.match(cloud.text('rewardSyncStatus'),/evidence is saved/);
  await turn();
  for(const client of [h,cloud])for(const request of client.calls){assert(!request.body.action.endsWith('.v2'),'legacy backend must receive no v2 actions');assert.equal(request.body.protocol,undefined);assert(!request.raw.includes('mkty-trace'),'legacy endpoint must never receive a packed marker');assert(Buffer.byteLength(request.raw,'utf8')<=400000);}
  console.log('PASS: pinned legacy handler/SQL and unchanged plan; actual signed-in story registration, eight-stage recorded proof payout/retry, replay/archive and account guard; raw cloud/proof negotiation, retained oversize evidence, UTF-8 limits and client-only Pages exclusions (isolated DB, no network)');
 }finally{await fixture.db.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
