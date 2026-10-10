/* Echo completion takes priority over noise failure. Its earned checkpoints must
   survive the real finale controller's Continue and a complete document reload.
   Socket-free controller checks are not a browser/layout substitute. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const R=require('../field-model.js'),P=require('../story-plan.js');
const root=path.resolve(__dirname,'..'),clone=s=>JSON.parse(JSON.stringify(s));
const roundtrip=(rules,s)=>assert.deepEqual(rules.restore(clone(s),s.n,s.stage,s.seed),s);
const routes=[
 {seed:0,choice:'silent',noise:102,bands:[0,2,4,1,2,4,1,3,0,2],filters:[7]},
 {seed:0,choice:'answer',noise:105,bands:[4,1,3,0,2,4,2,4,1,2],filters:[]},
 {seed:7,choice:'silent',noise:105,bands:[1,4,2,0,3,1,4,3,1,4,1,4],filters:[]}
];
function play(rules,route,stage=4,bonus=0){
 const s=rules.create(10,stage,route.seed,{charges:bonus});s.trace=[];
 const act=(a,v)=>{s.trace.push(['act',a,v??null]);assert(rules.act(s,a,v));roundtrip(rules,s);};
 for(const [turn,band]of route.bands.entries()){
  act('tune',band);if(route.filters.includes(turn))act('filter');act('listen');
  if(s.event)act(route.choice);
 }
 assert.equal(s.noise,route.noise);assert.equal(s.fragments,6);assert(s.complete&&rules.won(s)&&!s.failed);
 const frozen=JSON.stringify(s);assert.equal(rules.act(s,'listen'),false);rules.tick(s,.05);assert.equal(JSON.stringify(s),frozen);
 return s;
}

function controller(seed,bonus=0,data){
 const storage=new Map(data||[]),nodes=new Map();
 const target=o=>Object.assign(o,{listeners:new Map(),addEventListener(type,fn){const a=this.listeners.get(type)||[];a.push(fn);this.listeners.set(type,a);},fire(type,event={}){event.target??=this;for(const fn of this.listeners.get(type)||[])fn(event);this['on'+type]?.(event);}});
 const create=()=>{const classes=new Set(),node=target({dataset:{},style:{},open:false,
  classList:{add:n=>classes.add(n),remove:n=>classes.delete(n),contains:n=>classes.has(n)},
  setAttribute(){},append(){},querySelector(){return null;},querySelectorAll(){return [];},getAnimations(){return [];},
  showModal(){this.open=true;},close(){this.open=false;}});
  Object.defineProperty(node,'id',{get(){return this._id;},set(id){this._id=id;nodes.set(id,this);}});return node;};
 const $=id=>{if(!nodes.has(id)){const node=create();node.id=id;}return nodes.get(id);};
 const document=target({body:create(),createElement:create,getElementById:$,hidden:false,activeElement:null});
 const localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
 const awards=[],original=[],failures=[];
 const c=target({console,document,localStorage,structuredClone,FieldRules:R,FieldArt:{scene:()=>'<svg></svg>'},
  setInterval(){},cancelAnimationFrame(){},requestAnimationFrame(){return 1;},matchMedia:()=>({matches:true}),
  openMission8:()=>original.push(8),openMission9:()=>original.push(9),
  MKTYStory:{read:n=>JSON.parse(localStorage.getItem('mkty_story_plan_'+n+'_v1'))},
  MKTYPace:{fail:(...args)=>failures.push(args)},awardLifePoints(n,points){awards.push([n,points]);localStorage.setItem('mkty_life'+n,'complete');const story=c.MKTYStory.read(n);story.phase='complete';localStorage.setItem('mkty_story_plan_'+n+'_v1',JSON.stringify(story));}});
 c.window=c;c.show=id=>{for(const node of nodes.values())node.classList.remove('active');$(id).classList.add('active');};
 vm.createContext(c);
 for(const file of ['legacy.js','field-missions.js','chapter-space.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c,{filename:file});
 if(!data){const story=P.fresh(8,seed,2);story.phase='core';story.done=[0,1,2,3,4,5,6,7];
  localStorage.setItem('mkty_story_plan_8_v1',JSON.stringify(story));
  localStorage.setItem('mkty_field_finale_8_v1',JSON.stringify({version:1,n:8,phase:0,seed,seconds:0}));
  // The two actual campaign bonuses are scout and the sheltered chapter-1 antenna.
  c.MKTYLegacy.set('lead',bonus>0?'scout':'navigator');c.MKTYLegacy.set('events',bonus>1?{1:'antenna'}:{});
 }
 return {c,storage,awards,original,failures,$,open:()=>c.openMission8(),resume:()=>$('fieldResume').fire('click'),
  snapshot:()=>clone(c.MKTYField.snapshot()),saved:()=>clone(c.MKTYSpatialFinale.read(8)),
  act:(a,v)=>$('fieldMission').fire('click',{target:{closest:selector=>selector==='[data-field-action]'?{dataset:{fieldAction:a,value:v??''}}:null}}),
  adjust:(a,v)=>$('fieldMission').fire('input',{target:{dataset:{fieldSlider:a,index:''},value:v}}),
  submit:()=>$('fieldSubmit').fire('click'),pause:()=>c.fire('blur'),hide:()=>c.fire('pagehide')};
}
function controllerRoundtrip(route,bonus,reload){
 let h=controller(route.seed,bonus);h.open();h.resume();assert.equal(h.snapshot().charges,2+bonus);
 for(const [turn,band]of route.bands.entries()){
  h.act('tune',band);if(route.filters.includes(turn))h.act('filter');h.submit();if(h.snapshot().event)h.act(route.choice);
 }
 const earned=h.snapshot();assert.equal(earned.noise,route.noise);assert(earned.complete);assert.deepEqual(h.saved().checkpoint,earned);
 h.pause();h.hide();assert.deepEqual(h.saved().checkpoint,earned);
 if(reload){h=controller(route.seed,bonus,h.storage);h.open();assert.deepEqual(h.snapshot(),earned,'fresh document restores the earned completion without overwriting it');assert.deepEqual(h.saved().checkpoint,earned);}
 h.resume();h.submit();assert.equal(h.saved().phase,1,'Continue advances the actual finale callback');assert.equal(h.snapshot().n,3);
 assert.equal(h.c.MKTYLegacy.read().echo,route.choice);assert.equal(h.c.MKTYLegacy.read().decodeNoise,route.noise);
 h.resume();while(!h.snapshot().complete){const t=R.layout(h.snapshot()).target;for(const a of ['angle','power','trim'])h.adjust(a,t[a]);h.submit();}
 h.submit();assert.deepEqual(h.awards,[[8,2000]]);assert.equal(h.c.MKTYSpatialFinale.read(8),null);assert.equal(h.original.length,1);
 assert(h.storage.get('mkty_life9_coordinates'));assert.equal(JSON.parse(h.storage.get('mkty_spatial_report_8')).phases,2);
 assert.deepEqual(h.failures,[],'completion does not become a failed attempt');h.open();assert.deepEqual(h.awards,[[8,2000]],'completed review does not duplicate rewards');assert.equal(h.original.length,2);
}

function boundaries(rules){
 const won=play(rules,routes[1]);
 // Preserve all previously accepted finite values, including fractional old checkpoints.
 for(const noise of [0,.5,98,99,99.5,100])for(const complete of [false,true]){
  const s=complete?{...won,noise}:{...rules.create(10,4,0),noise};roundtrip(rules,s);
 }
 for(const noise of [102,105])roundtrip(rules,{...won,noise});
 // Newly accepted overflow must be earned by the integer action rules. Keep
 // rejecting all other values, including the nearest floats to each exception.
 const ulp=Number.EPSILON*64;
 for(const noise of [-1,NaN,Infinity,100+ulp,100.5,101,102-ulp,102+ulp,103,104,105-ulp,105+ulp,106,107,1000])assert.equal(rules.restore({...won,noise},10,4,0),null);
 for(const failed of [undefined,false,true])for(const noise of [100.000001,102,105])assert.equal(rules.restore({...won,complete:false,failed,noise},10,4,0),null);
 roundtrip(rules,{...rules.create(10,4,0),noise:100,failed:true});
 assert.equal(rules.restore({...won,complete:false,failed:true,noise:99},10,4,0),null);
 for(const invalid of [{failed:true},{failed:'yes'},{fragments:5},{event:'echo'},{mods:{charges:4}},{charges:9},{noise:'105'},{complete:'yes'}])assert.equal(rules.restore({...won,...invalid},10,4,0),null);
 const legacy={...rules.create(8,4,0),version:1};roundtrip(rules,legacy);
}

// Every possible PRNG outcome for the five-band carrier/jammer pattern. Stage
// does not affect decode layout; start modifiers only change available filters.
function allLayouts(){
 const layouts=new Map();
 for(let seed=0;seed<=2568;seed++){const b=R.layout(R.create(10,0,seed)),key=[b.preamble[0],b.step,b.jam(0),b.jam(1)].join(',');if(!layouts.has(key))layouts.set(key,seed);}
 assert.equal(layouts.size,5*4*5*3);return [...layouts.values()];
}
function explore(seed,bonus,server){
 const first=R.create(10,4,seed,{charges:bonus}),queue=[first],seen=new Set();let states=0,complete=0,failed=0,max=0;
 for(let i=0;i<queue.length;i++){
  const s=queue[i],key=[s.turn,s.fragments,s.noise,s.charges,s.choice,s.event,s.complete,!!s.failed].join('/');if(seen.has(key))continue;seen.add(key);states++;
  roundtrip(R,s);roundtrip(server,s);
  if(s.complete){complete++;assert.equal(s.noise%3,0);max=Math.max(max,s.noise);assert(s.noise<=100||[102,105].includes(s.noise));continue;}
  if(s.failed){failed++;assert.equal(s.noise,100);continue;}
  assert(s.noise<100,'an unfinished normal-play state cannot exceed the failure threshold');
  const b=R.layout(s),carrier=b.carrier(s.turn);
  const actions=s.event?[['answer'],['silent']]:[carrier,(carrier+1)%5].flatMap(band=>[false,...(s.charges>0?[true]:[])].map(filter=>['listen',band,filter]));
  for(const [a,band,filter]of actions){
   const next=clone(s),mirror=clone(s);
   const act=(name,value)=>{assert.equal(R.act(next,name,value),server.act(mirror,name,value));assert.deepEqual(next,mirror);};
   if(a==='listen'){act('tune',band);if(filter)act('filter');}
   act(a);queue.push(next);
  }
 }
 return {states,complete,failed,max};
}

(async()=>{
 // Run the real controller first: the old model fails Continue at noise 102.
 for(const route of routes)for(const bonus of [0,1,2])for(const reload of [false,true])controllerRoundtrip(route,bonus,reload);
 const server=(await import('../server/rewards/models/field-model.mjs')).default;
 for(const rules of [R,server]){for(const route of routes)for(let stage=0;stage<5;stage++)for(const bonus of [0,1,2,3])play(rules,route,stage,bonus);boundaries(rules);}
 let states=0,complete=0,failed=0,max=0;
 for(const seed of allLayouts()){
  const base=R.layout(R.create(10,4,seed));
  for(let stage=0;stage<5;stage++){const b=R.layout(R.create(10,stage,seed));for(let turn=0;turn<5;turn++){assert.equal(b.carrier(turn),base.carrier(turn));assert.equal(b.jam(turn),base.jam(turn));}}
  for(const bonus of [0,1,2,3]){const r=explore(seed,bonus,server);states+=r.states;complete+=r.complete;failed+=r.failed;max=Math.max(max,r.max);}
 }
 assert.equal(max,105);
 console.log(JSON.stringify({echoLayouts:300,startingChargeModifiers:4,stageVariants:5,states,completedStates:complete,failedStates:failed,maxCompletedNoise:max,actualFinaleContinueAndReload:true,fullFinaleRoundtrip:true,invalidNoiseRejected:true,legacyEnvelopePreserved:true,serverParity:true}));
})().catch(e=>{console.error(e);process.exitCode=1;});
