/* Network-interruption recovery against the production client, without an API or player account. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../rewards-client.js'),'utf8');
const store=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};};
function client(fetcher,storage=store()){
 const elements=new Map(),sessionStorage=store(),timers=new Set();
 const document={getElementById:id=>elements.get(id),createElement:()=>({setAttribute(){}}),body:{appendChild(el){elements.set(el.id,el);}},addEventListener(){}};
 const window={Telegram:{WebApp:{initData:'user='+encodeURIComponent(JSON.stringify({id:101}))}},addEventListener(){},dispatchEvent(){}};
 const context={window,document,localStorage:storage,sessionStorage,URLSearchParams,AbortController,AbortSignal:{},CustomEvent:class{},fetch:fetcher,console,
  setTimeout(fn,ms){const timer=setTimeout(fn,ms);timers.add(timer);return timer;},clearTimeout(timer){timers.delete(timer);clearTimeout(timer);}};
 vm.runInNewContext(source,context,{filename:'rewards-client.js'});
 return {api:window.MKTYRewards,window,storage,timers};
}
const response=body=>({ok:true,status:200,json:async()=>body}),pending=s=>JSON.parse(s.getItem('mkty_pending_v2_101')||'[]');
const player={telegram_id:101,moon_points:0,lives:9,story_life:0};
const session={ok:true,session:{token:'test-session',expires_at:Date.now()+43200000}};
const plan={seed:123,edition:2,done:[0,1,2,3,4,5,6,7],tasks:Object.fromEntries(Array.from({length:8},(_,id)=>[id,{proof:{id}}]))};
(async()=>{
 // No AbortSignal.timeout is exposed: a compatible WebView must still reach the API.
 let requests=0;
 const compatible=client(async(_url,opt)=>{requests++;assert(opt.signal instanceof AbortSignal);return response(JSON.parse(opt.body).action==='session'?session:{ok:true,player});});
 assert.equal((await compatible.api.syncPlayer()).telegram_id,101);assert.equal(requests,2);assert.equal(compatible.timers.size,0);
 // A caller-owned cancellation signal is preserved and no orphan timeout is left.
 const controller=new AbortController();await compatible.api.authenticatedFetch('https://test.invalid',{action:'player'},controller.signal);assert.equal(compatible.timers.size,0);
 // Save completion before the route request returns; simulate closing and reopening
 // using only the durable local store, never the abandoned promise's in-memory data.
 let releaseRoute,routeStarted;
 const started=new Promise(resolve=>routeStarted=resolve);
 const first=client(async(_url,opt)=>{const b=JSON.parse(opt.body);if(b.action==='session')return response(session);if(b.action==='campaign.open'){routeStarted();await new Promise(resolve=>releaseRoute=resolve);return response({ok:false,error:'unavailable'});}return response({ok:false,error:'unavailable'});});
 first.window.MKTYStory={read:()=>plan};const completing=first.api.completeLife(1,500);
 assert.equal(pending(first.storage)[0]?.payload.life,1,'completion must be durable before any await');
 await started;assert.equal(pending(first.storage).length,1);releaseRoute();await completing;assert.equal(first.timers.size,0);
 let settlements=0;
 const reopened=client(async(_url,opt)=>{const b=JSON.parse(opt.body);if(b.action==='session')return response(session);if(b.action==='campaign.open')return response({ok:true,route:{seed:123,edition:2,route:'route-101'}});if(b.action==='life.complete'){assert.equal(b.proof.tasks.length,8);settlements++;return response({ok:true,awarded:true,player:{...player,story_life:1,moon_points:500}});}return response({ok:true,player});},first.storage);
 reopened.window.MKTYStory={read:()=>plan};await reopened.api.syncPlayer();assert.equal(settlements,1);assert.equal(pending(first.storage).length,0);assert.equal(first.storage.getItem('mkty_points'),'500');
 // A rejected offline life charge must not trap an earned reward behind it.
 const stored=store(),proof={route:'saved-route',tasks:[{id:0,state:{trace:[]}}]};
 stored.setItem('mkty_pending_v2_101',JSON.stringify([{id:'spend:old',action:'lives.spend',payload:{event_key:'spend:old'}},{id:'life:1:complete',action:'life.complete',payload:{life:1,event_key:'life:1:complete',proof}}]));
 const actions=[];
 const recovered=client(async(_url,opt)=>{const b=JSON.parse(opt.body);actions.push(b.action);if(b.action==='session')return response(session);if(b.action==='lives.spend')return response({ok:false,error:'no_lives'});if(b.action==='life.complete'){assert.deepEqual(b.proof,proof,'saved evidence survives a temporarily unavailable chapter snapshot');return response({ok:true,player:{...player,lives:0,story_life:1,moon_points:500}});}return response({ok:true,player:{...player,lives:0}});},stored);
 await recovered.api.syncPlayer();assert(actions.includes('life.complete'));assert.equal(pending(stored).length,0);assert.equal(stored.getItem('mkty_points'),'500');assert.equal(recovered.timers.size,0);
 console.log('PASS: compatible request timeout, durable pre-network completion, reopen settlement, saved proof recovery and non-blocking exhausted-life charge');
})().catch(e=>{console.error(e);process.exit(1);});
