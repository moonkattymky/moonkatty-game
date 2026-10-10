/* Exact production reactor transitions + storage wrapper with inert visual stubs.
 * Every native checkpoint write must restore, including a cut between writes.
 * This is deterministic fault injection, not browser/device coverage. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'reactor5.js'),'utf8'),KEY='mkty_reactor5_checkpoint_v2';
function fn(name){
 const start=source.indexOf(' function '+name+'('),open=source.indexOf('{',start);assert(start>=0);let depth=1,quote='',escape=false;
 for(let i=open+1;i<source.length;i++){const ch=source[i];if(quote){if(escape)escape=false;else if(ch==='\\')escape=true;else if(ch===quote)quote='';continue;}if(['\'', '"','`'].includes(ch)){quote=ch;continue;}if(ch==='{')depth++;if(ch==='}'&&!--depth)return source.slice(start,i+1);}throw Error('Missing function '+name);
}
const fresh=source.match(/  state=\{phase:'charge'.+?\};/)[0].trim();
// Run the controller's real restore function independently for every persisted prefix.
function validator(){
 const c={raw:null,Math,localStorage:{getItem:()=>c.raw}};vm.createContext(c);
 vm.runInContext(`let state;const checkpointKey='${KEY}',clamp=(v,a,b)=>Math.max(a,Math.min(b,v));${fn('restoreCheckpoint')}this.check=raw=>{this.raw=raw;${fresh}return restoreCheckpoint();};`,c);
 return c.check;
}
function fixture({data=new Map(),random=.5,quota=Infinity}={}){
 const log=[],validate=validator();let cap=quota;
 const native={getItem:k=>data.get(k)??null,setItem(k,v){v=String(v);if(k===KEY){const parsed=JSON.parse(v),row={raw:v,phase:parsed.phase,pulses:parsed.pulses,bytes:v.length,accepted:v.length<=cap,restorable:validate(v)};log.push(row);if(!row.accepted)throw new Error('QuotaExceededError');}data.set(k,v);},removeItem:k=>data.delete(k),key:i=>[...data.keys()][i]??null,get length(){return data.size;}};
 const nodes=new Map(),$=id=>{if(!nodes.has(id))nodes.set(id,{id,style:{},dataset:{},classList:{toggle(){}},addEventListener(){},querySelectorAll:()=>[],setAttribute(){},append(){},replaceChildren(){}});return nodes.get(id);};
 const math=Object.create(Math);math.random=()=>random;
 const c={console,Math:math,structuredClone,URLSearchParams,CustomEvent:class{constructor(type,o){this.type=type;this.detail=o?.detail;}},queueMicrotask:()=>{},tg:null,$,localStorage:native,sessionStorage:{length:0},document:{body:$('body'),getElementById:id=>nodes.get(id)||null,createElement:()=>$('made'),addEventListener(){}},addEventListener(){},dispatchEvent(){}};
 c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(root,'storage.js'),'utf8'),c,{filename:'storage.js'});
 vm.runInContext(`let state=null,panelAnimation=null;const controls=[],root=$('root'),phasePanels={charge:$('charge'),balance:$('balance'),ignite:$('ignite'),fault:$('fault')},effects={reduced:true,signal(){}},checkpointKey='${KEY}',pulseCenters=[32,68,49];const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),render=()=>{},text=()=>{},active=()=>true;
 ${['saveCheckpoint','restoreCheckpoint','setStatus','release','inWindow','enter','tick','startPulse','ignite'].map(fn).join('\n')}
 const finish=()=>{state.phase='online';};
 ${source.split('\n').find(l=>l.includes("$('stabilizeBtn').onclick="))}
 ${source.split('\n').find(l=>l.includes("$('reactorRetry5').onclick="))}
 this.api={fresh(){${fresh}},snap:()=>structuredClone(state),input(charge,cool){state.chargeHeld=charge;state.coolHeld=cool;},knobs(flow,trim){state.flow=flow;state.trim=trim;state.hold=0;},tick,ignite,lock:()=>$('stabilizeBtn').onclick(),retry:()=>$('reactorRetry5').onclick(),save:saveCheckpoint,restore:restoreCheckpoint};`,c,{filename:'reactor5-exact-functions.js'});
 c.api.fresh();return {c,data,log,api:c.api,native,cap:value=>cap=value,validate};
}
function reachLastPulse(f){
 const a=f.api;
 for(let i=0;i<10000&&a.snap().phase==='charge';i++){const s=a.snap();a.input(s.temp<75,s.temp>=75);a.tick(.04);}
 assert.equal(a.snap().phase,'balance');a.knobs(50,Math.round(a.snap().fieldTarget));
 for(let i=0;i<500&&a.snap().hold<3;i++)a.tick(.04);a.lock();assert.equal(a.snap().phase,'ignite');
 while(a.snap().pulses<2){const s=a.snap();if(['ready','miss'].includes(s.pulseState))a.ignite();else if(s.pulseState==='running'&&Math.abs(s.pulsePosition-[32,68,49][s.pulses])<.9)a.ignite();else a.tick(.01);}
 while(!(a.snap().pulseState==='running'&&Math.abs(a.snap().pulsePosition-49)<.9))a.tick(.01);
 a.save();assert.equal(a.snap().pulses,2);assert.deepEqual(Array.from(a.snap().cells),[100,100,100]);
}
function assertWrites(f){for(const row of f.log)assert(row.restorable,`Every emitted checkpoint must restore: ${row.phase}/${row.pulses}`);}
let scenarios=0,writes=0,prefixReboots=0;
for(const random of [0,.125,.5,.875,.999]){
 const healthy=fixture({random});reachLastPulse(healthy);
 const validTwo=JSON.parse(healthy.data.get(KEY));
 assert.equal(healthy.validate(JSON.stringify({...validTwo,pulses:3})),false,'strict restore still rejects ignite/3');
 assert.equal(healthy.validate(JSON.stringify({...validTwo,phase:'startup'})),false,'strict restore still rejects startup/2');
 healthy.api.ignite();assertWrites(healthy);
 assert.equal(healthy.api.snap().phase,'startup');assert.equal(healthy.api.snap().pulses,3);
 const startup=healthy.data.get(KEY);assert.equal(JSON.parse(startup).phase,'startup');
 // Reboot after every successfully emitted checkpoint, not only settled phases.
 for(const row of healthy.log){const reboot=fixture({data:new Map([[KEY,row.raw]]),random});assert(reboot.api.restore());assert.equal(reboot.api.snap().phase,row.phase);assert.equal(reboot.api.snap().pulses,row.pulses);prefixReboots++;}
 const reboot=fixture({data:new Map(healthy.data),random});assert(reboot.api.restore());for(let i=0;i<61;i++)reboot.api.tick(.04);assert.equal(reboot.api.snap().phase,'online');writes+=healthy.log.length;scenarios++;
 for(const recoverBeforeReload of [false,true]){
  const f=fixture({random});reachLastPulse(f);const previous=f.data.get(KEY),before=JSON.parse(previous),n=f.log.length;
  // This quota fits the old invalid ignite/3 write but not the valid startup/3.
  f.cap(JSON.stringify({...before,pulses:3}).length);f.api.ignite();assertWrites(f);
  assert.equal(f.log.length,n+1,'third pulse emits only the valid startup checkpoint');assert.equal(f.log.at(-1).phase,'startup');assert.equal(f.log.at(-1).accepted,false);
  assert.equal(f.data.get(KEY),previous,'failed startup write preserves last good durable two-pulse checkpoint');
  assert.equal(JSON.parse(f.c.localStorage.getItem(KEY)).phase,'startup','memory overlay preserves live progress');
  if(recoverBeforeReload){f.cap(Infinity);assert.equal(f.c.MKTYStorage.retry(),true);assert.equal(JSON.parse(f.data.get(KEY)).phase,'startup');}
  const reloaded=fixture({data:new Map(f.data),random});assert(reloaded.api.restore());assert.deepEqual(Array.from(reloaded.api.snap().cells),[100,100,100]);assert.equal(reloaded.api.snap().pulses,recoverBeforeReload?3:2);
  if(!recoverBeforeReload){reloaded.api.ignite();while(Math.abs(reloaded.api.snap().pulsePosition-49)>=.9)reloaded.api.tick(.01);reloaded.api.ignite();assert.equal(reloaded.api.snap().phase,'startup');}
  for(let i=0;i<61;i++)reloaded.api.tick(.04);assert.equal(reloaded.api.snap().phase,'online');assertWrites(reloaded);writes+=f.log.length+reloaded.log.length;scenarios++;
 }
}
console.log(JSON.stringify({scenarios,randomFieldTargets:5,emittedCheckpointWrites:writes,prefixReboots,invalidIntermediateWrites:0,quotaPreservesPriorCheckpoint:true,retryPersistsLiveStartup:true,reloadCanFinish:true,strictRestoreUnchanged:true,browserCoverage:false}));
