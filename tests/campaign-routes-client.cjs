/* Production story/reward clients, deterministic network interruptions, no browser or real accounts. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),P=require('../story-plan.js');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function harness(){
 const elements=new Map(),data=new Map(),sessions=new Map(),calls=[],pending=[],launches=[],risk=[];
 let active='home',offline=false,owner='101',sequence=10;
 class Element{
  constructor(id=''){this.id=id;this.dataset={};this.children=[];this.style={setProperty(){}};this.classes=new Set();this.classList={contains:x=>this.classes.has(x),add:x=>this.classes.add(x),remove:x=>this.classes.delete(x),toggle(){}};}
  set innerHTML(s){this.html=s;for(const m of s.matchAll(/id="([^"]+)"/g))get(m[1]);}
  get innerHTML(){return this.html||'';}setAttribute(){}compareDocumentPosition(){return 0;}before(){}append(...x){this.children.push(...x);for(const el of x)if(el.id)elements.set(el.id,el);}appendChild(x){this.append(x);}replaceChildren(...x){this.children=x;}querySelectorAll(){return [];}click(){if(!this.disabled)this.onclick?.();}remove(){}
 }
 const get=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);};
 const document={getElementById:get,createElement:()=>new Element(),documentElement:get('html'),body:get('body'),hidden:false,addEventListener(){},querySelector:sel=>sel==='.screen.active'?get(active):null,querySelectorAll:()=>[]};
 const storage={getItem:k=>data.get(owner+':'+k)??null,setItem:(k,v)=>data.set(owner+':'+k,String(v)),removeItem:k=>data.delete(owner+':'+k)};
 const sessionStorage={getItem:k=>sessions.get(k)||null,setItem:(k,v)=>sessions.set(k,String(v)),removeItem:k=>sessions.delete(k)};
 const window={Telegram:{WebApp:{initData:'user='+encodeURIComponent(JSON.stringify({id:101}))}},addEventListener(){},dispatchEvent(){},MKTYStorage:{persistent:true},MKTYCampaign:{render(){}},MKTYPace:{gate:()=>true,bypass:()=>true,risky:(_n,fn)=>risk.push(fn)}};
 const show=id=>{window.MKTYStory?.onScreen(id);get(active).classes.delete('active');active=id;get(id).classes.add('active');};get(active).classes.add('active');
 const fetch=async(_url,opt)=>{const body=JSON.parse(opt.body);calls.push(body);if(body.action==='session')return response({ok:true,session:{token:'account:'+owner,expires_at:Date.now()+3600000}});
  if(body.action==='campaign.open'){if(offline)return response({ok:false,error:'unavailable'});return new Promise(resolve=>pending.push({body,owner,resolve:x=>resolve(response(x))}));}return response({ok:true});};
 const context={window,document,localStorage:storage,sessionStorage,console,URL,URLSearchParams,AbortController,crypto:require('node:crypto').webcrypto,CustomEvent:class{},Blob,Node:{DOCUMENT_POSITION_FOLLOWING:4},StoryPlan:P,FieldArt:{map:()=>''},MutationObserver:class{observe(){}},setTimeout,clearTimeout,setInterval(){},queueMicrotask(){},show,remainingLife1CodeTime:()=>0,MKTYPace:window.MKTYPace,
  MKTYOps:{openTask:(task,saved)=>launches.push({task,saved})},MKTYField:{open:(task,saved)=>launches.push({task,saved})},MKTYExpedition:{openStory:(task,saved)=>launches.push({task,saved})},fetch};
 for(const name of ['openMission','openMission2','openLife3MemoryGate','openMission4','openMission5','openMission6','openMission7','openMission8','openMission9'])window[name]=()=>show(name==='openMission'?'mission1':name);
 vm.createContext(context);for(const file of ['rewards-client.js','story.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context,{filename:file});
 const issue=(request,extra={})=>{const route={route:'00000000-0000-4000-8000-'+String(++sequence).padStart(12,'0'),telegram_id:Number(request.owner),life:request.body.life,seed:sequence*991,edition:2,challenge_version:2,...extra};request.resolve({ok:true,route});return route;};
 return {window,get,storage,calls,pending,launches,risk,show,issue,active:()=>active,offline:x=>offline=x,setOwner(id){owner=String(id);window.Telegram.WebApp.initData='user='+encodeURIComponent(JSON.stringify({id:Number(id)}));}};
}
const response=body=>({ok:true,status:200,json:async()=>body});
(async()=>{
 let h=harness();const first=h.window.MKTYStory.open(1);await tick();assert.equal(h.pending.length,1);h.get('storySteps').children[0].click();assert.equal(h.launches.length,0);assert.equal(h.storage.getItem('mkty_story_plan_1_v1'),null,'no local challenge/checkpoint before server issuance');
 h.window.MKTYStory.open(1);await tick();assert.equal(h.pending.length,1,'repeated opens share a request');const route=h.issue(h.pending.shift());await first;
 assert.equal(h.window.MKTYStory.read(1).seed,route.seed);assert.equal(JSON.parse(h.storage.getItem('mkty_proof_route_1')).route,route.route);h.get('storySteps').children[0].click();assert.equal(h.risk.length,1);h.risk.shift()();assert.equal(h.launches.length,1);h.launches[0].task.save({seconds:2});assert.equal(h.window.MKTYStory.read(1).tasks[0].checkpoint.seconds,2);
 // Delayed navigation/confirmation can never reopen a dismissed screen.
 h=harness();const abandoned=h.window.MKTYStory.open(1);await tick();h.show('chapters');h.issue(h.pending.shift());await abandoned;assert.equal(h.active(),'chapters');assert.equal(h.window.MKTYStory.read(1),null);
 h=harness();h.storage.setItem('mkty_life1','complete');const old=h.window.MKTYStory.open(1);await tick();const newer=h.window.MKTYStory.open(2);await tick();h.issue(h.pending[1]);await newer;h.issue(h.pending[0]);await old;assert.equal(h.window.MKTYStory.read(1),null);assert(h.window.MKTYStory.read(2));assert.match(h.get('storyEyebrow').textContent,/02/);
 h.get('storySteps').children[0].click();h.show('chapters');h.risk.shift()();assert.equal(h.launches.length,0,'a late risk confirmation cannot hijack navigation');
 // Account changes discard old responses even if session negotiation succeeded.
 h=harness();const changing=h.window.MKTYStory.open(1);await tick();h.setOwner(202);h.issue(h.pending.shift());await changing;assert.equal(h.window.MKTYStory.read(1),null);assert.equal(h.storage.getItem('mkty_proof_route_1'),null);
 // Offline starts are explicit retry states; there is no unverified fallback run.
 h=harness();h.offline(true);await h.window.MKTYStory.open(1);assert.equal(h.window.MKTYStory.read(1),null);assert(h.get('storyCore').disabled);assert.match(h.get('storyHint').textContent,/connection/);h.offline(false);const reconnect=h.window.MKTYStory.open(1);await tick();h.issue(h.pending.shift());await reconnect;assert(h.window.MKTYStory.read(1));
 // Legacy progress stays intact and downloadable until the player explicitly restarts.
 h=harness();const legacy=P.fresh(1,123,2);legacy.tasks[0]={checkpoint:{seconds:9}};h.storage.setItem('mkty_story_plan_1_v1',JSON.stringify(legacy));h.storage.setItem('mkty_campaign_checkpoint_1','{"version":1,"stage":2}');h.storage.setItem('mkty_points','750');
 const blocked=h.window.MKTYStory.open(1);await tick();const oldRoute=h.issue(h.pending.shift(),{seed:123,challenge_version:1});await blocked;
 assert.equal(h.window.MKTYStory.read(1).seed,123);assert(h.get('storySteps').children[0].disabled);assert.equal(h.get('storyArchive').hidden,false);assert.match(h.get('storyHint').textContent,/archived/);
 const replay=h.window.MKTYStory.replay(1);h.window.MKTYStory.replay(1);await tick();assert.equal(h.pending.length,1);h.issue(h.pending.shift(),oldRoute);await tick();assert.equal(h.pending.length,1);assert.equal(h.pending[0].body.previous_route,oldRoute.route);assert.equal(h.window.MKTYStory.read(1).seed,123,'old run stays active while reset is pending');const fresh=h.issue(h.pending.shift());await replay;
 assert.equal(h.window.MKTYStory.read(1).seed,fresh.seed);assert.equal(h.window.MKTYStory.read(1).done.length,0);assert.equal(h.storage.getItem('mkty_points'),'750');const archive=JSON.parse(h.storage.getItem(h.storage.getItem('mkty_story_archive_latest_1')));assert.equal(JSON.parse(archive.snapshot.mkty_story_plan_1_v1).tasks[0].checkpoint.seconds,9);assert.equal(archive.snapshot.mkty_campaign_checkpoint_1,'{"version":1,"stage":2}');assert.equal(h.storage.getItem('mkty_campaign_checkpoint_1'),null);
 // A lost reset reply keeps its expected UUID and retries exactly that operation.
 const lost=h.window.MKTYStory.replay(1);await tick();h.issue(h.pending.shift(),fresh);await tick();const lostUuid=h.pending[0].body.previous_route;h.pending.shift().resolve({ok:false,error:'unavailable'});await lost;assert.equal(h.storage.getItem('mkty_route_restart_1'),lostUuid);assert.equal(h.window.MKTYStory.read(1).seed,fresh.seed);
 const resumedReset=h.window.MKTYStory.replay(1);await tick();assert.equal(h.pending.length,1);assert.equal(h.pending[0].body.previous_route,lostUuid);h.issue(h.pending.shift());await resumedReset;assert.equal(h.storage.getItem('mkty_route_restart_1'),null);
 // A stale restart UUID is cleared, refreshed, and stopped before any new reset.
 const preserved=h.window.MKTYStory.read(1);h.storage.setItem('mkty_route_restart_1','00000000-0000-4000-8000-000000000001');
 const stale=h.window.MKTYStory.replay(1);await tick();assert.equal(h.pending[0].body.reset,true);h.pending.shift().resolve({ok:false,error:'route_changed'});await tick();assert.equal(h.storage.getItem('mkty_route_restart_1'),null);assert.equal(h.pending[0].body.reset,undefined,'refresh must not reset another device route');h.issue(h.pending.shift());await stale;assert.equal(h.window.MKTYStory.read(1).seed,preserved.seed);assert.match(h.get('storyHint').textContent,/archived/);
 // Pending writes are not durable when the shared storage adapter reports failure.
 h=harness();h.window.MKTYStorage.persistent=false;const full=h.window.MKTYStory.open(1);await tick();h.issue(h.pending.shift());await full;assert.equal(h.window.MKTYStory.read(1),null);assert(h.get('storySteps').children[0].disabled);
 console.log('PASS: trusted challenge before first checkpoint; repeated open/restart, navigation, delayed confirmation, account change, offline and storage failure guards; legacy archive and explicit restart preserve progress/balances');
})().catch(error=>{console.error(error);process.exit(1);});
