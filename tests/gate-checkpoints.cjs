/* Final aligned gate launch wins before collapse. Preserve the earned raw result. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const R=require('../field-model.js'),P=require('../story-plan.js');
const root=path.resolve(__dirname,'..'),clone=s=>JSON.parse(JSON.stringify(s));
const roundtrip=(rules,s)=>assert.deepEqual(rules.restore(clone(s),s.n,s.stage,s.seed),s);
const ordinary=[...Array(3).fill('wait'),'launch',...Array(3).fill('wait'),'launch',...Array(7).fill('wait'),'launch'];
const fractional=[...Array(3).fill('wait'),'launch',...Array(3).fill('wait'),'launch',...Array(2).fill('wait'),'launch','launch','boost','launch'];
function play(rules,bonus=0,stage=4){
 const s=rules.create(11,stage,0,{stability:bonus});s.trace=[];roundtrip(rules,s);
 for(const a of bonus===0?ordinary:fractional){s.trace.push(['act',a,null]);assert(rules.act(s,a));roundtrip(rules,s);}
 assert(s.complete&&rules.won(s)&&!s.failed);assert(s.stability<0&&s.stability>-2);
 const fixed=JSON.stringify(s);for(const a of ['wait','boost','launch'])assert.equal(rules.act(s,a),false);rules.tick(s,.04);assert.equal(JSON.stringify(s),fixed);
 return s;
}
function boundaries(rules){
 const s=play(rules),ulp=Number.EPSILON;
 // All old finite 0..110 values remain accepted; this is not a conservation proof.
 for(const stability of [0,.5,70,109.5,110])for(const complete of [false,true])roundtrip(rules,complete?{...s,stability}:{...rules.create(11,4,0),stability});
 roundtrip(rules,{...s,stability:-1});
 for(const bonus of [0,.00001,4.01,4.5,5.99999,40]){
  const start=70+bonus,below=start-Math.ceil(start),mods=rules.cleanMods({stability:bonus});
  const allowed=[below,below-1].filter(x=>x<0);
  for(const stability of allowed)roundtrip(rules,{...s,mods,stability});
  for(const stability of [-1.99,-1.5,-.99,-.5,-Number.MIN_VALUE,...allowed.flatMap(x=>[x-ulp,x+ulp])])if(!allowed.includes(stability))assert.equal(rules.restore({...s,mods,stability},11,4,0),null);
 }
 for(const stability of [-Infinity,-3,-2,-2-ulp,110+Number.EPSILON*128,Infinity,NaN,'-1'])assert.equal(rules.restore({...s,stability},11,4,0),null);
 for(const stability of [-2+ulp,-1,-Number.MIN_VALUE])for(const failed of [undefined,false,true])assert.equal(rules.restore({...s,complete:false,failed,stability},11,4,0),null);
 for(const invalid of [{home:2},{failed:true},{complete:'yes'},{mods:{stability:41}},{charges:9},{stability:undefined}])assert.equal(rules.restore({...s,...invalid},11,4,0),null);
 roundtrip(rules,{...rules.create(11,4,0),stability:0,failed:true});
 assert.equal(rules.restore({...rules.create(11,4,0),stability:.1,failed:true},11,4,0),null);
}
function explore(seed,bonus,charges,server){
 const queue=[R.create(11,4,seed,{stability:bonus,charges})],seen=new Set();let states=0,completed=0,failed=0,negative=0,min=Infinity;
 for(let i=0;i<queue.length;i++){
  const s=queue[i],key=[s.turn,s.home,s.stability,s.charges,s.complete,!!s.failed].join('/');if(seen.has(key))continue;seen.add(key);states++;
  roundtrip(R,s);roundtrip(server,s);
  if(s.complete){assert(s.stability>-2);completed++;if(s.stability<0)negative++;min=Math.min(min,s.stability);continue;}
  if(s.failed){failed++;assert.equal(s.stability,0);continue;}
  assert(s.stability>0);
  for(const a of ['wait','boost','launch']){
   const next=clone(s),mirror=clone(s),ok=R.act(next,a);assert.equal(ok,server.act(mirror,a));assert.deepEqual(next,mirror);if(ok)queue.push(next);
  }
 }
 return {states,completed,failed,negative,min};
}
function controller(seed,bonus=0,data){
 const storage=new Map(data||[]),nodes=new Map();
 const target=o=>Object.assign(o,{listeners:new Map(),addEventListener(type,fn){const a=this.listeners.get(type)||[];a.push(fn);this.listeners.set(type,a);},fire(type,event={}){event.target??=this;for(const fn of this.listeners.get(type)||[])fn(event);this['on'+type]?.(event);}});
 const create=()=>{const classes=new Set(),node=target({dataset:{},style:{},open:false,
  classList:{add:n=>classes.add(n),remove:n=>classes.delete(n),contains:n=>classes.has(n)},
  setAttribute(){},append(){},before(){},remove(){},querySelector(){return {style:{}};},querySelectorAll(){return [];},getAnimations(){return [];},
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
 if(!data){const story=P.fresh(9,seed,2);story.phase='core';story.done=[0,1,2,3,4,5,6,7];
  localStorage.setItem('mkty_story_plan_9_v1',JSON.stringify(story));
  localStorage.setItem('mkty_field_finale_9_v1',JSON.stringify({version:1,n:9,phase:2,seed:(seed-2*7919)>>>0,seconds:0}));
  c.MKTYLegacy.set('lead','navigator');
 }
 return {c,storage,awards,original,failures,$,open:()=>c.openMission9(),resume:()=>$('fieldResume').fire('click'),
  snapshot:()=>clone(c.MKTYField.snapshot()),saved:()=>clone(c.MKTYSpatialFinale.read(9)),
  act:(a,v)=>$('fieldMission').fire('click',{target:{closest:selector=>selector==='[data-field-action]'?{dataset:{fieldAction:a,value:v??''}}:null}}),
  adjust:(a,v)=>$('fieldMission').fire('input',{target:{dataset:{fieldSlider:a,index:''},value:v}}),
  submit:()=>$('fieldSubmit').fire('click'),pause:()=>c.fire('blur'),hide:()=>c.fire('pagehide')};
}

function controllerRoundtrip(reload){
 let h=controller(0);h.open();h.resume();assert.equal(h.snapshot().stability,70);
 for(const a of ordinary){if(a==='launch')h.submit();else h.act(a);}
 const earned=h.snapshot();assert(earned.complete);assert.equal(earned.stability,-1);assert.deepEqual(h.saved().checkpoint,earned);
 h.pause();h.hide();assert.deepEqual(h.saved().checkpoint,earned);
 if(reload){h=controller(0,0,h.storage);h.open();assert.deepEqual(h.snapshot(),earned,'reload retains raw negative completion');assert.deepEqual(h.saved().checkpoint,earned);}
 h.resume();h.submit();assert.equal(h.saved(),null);assert.deepEqual(h.awards,[[9,3000]]);assert.equal(h.storage.get('mkty_life9'),'complete');
 assert.equal(JSON.parse(h.storage.get('mkty_spatial_report_9')).phases,3);assert.deepEqual(h.failures,[]);h.open();assert.deepEqual(h.awards,[[9,3000]],'review does not award twice');
}
(async()=>{
 for(const reload of [false,true])controllerRoundtrip(reload);
 const server=(await import('../server/rewards/models/field-model.mjs')).default;
 for(const rules of [R,server]){boundaries(rules);for(let stage=0;stage<5;stage++)for(const bonus of [0,4.00001,4.01,4.5,5,5.99999])play(rules,bonus,stage);}
 const seeds=new Map();for(let seed=0;seed<100;seed++){const b=R.layout(R.create(11,4,seed));seeds.set([b.offset(0),b.rot].join('/'),seed);}assert.equal(seeds.size,6);
 const totals={states:0,completed:0,failed:0,negative:0,min:0};
 for(const seed of seeds.values())for(const bonus of [...Array(41).keys(),4.00001,4.01,4.5,5.99999])for(const charges of [0,1,2,3]){
  const r=explore(seed,bonus,charges,server);for(const k of ['states','completed','failed','negative'])totals[k]+=r[k];totals.min=Math.min(totals.min,r.min);
 }
 assert(totals.negative>0);assert(totals.min>-2&&totals.min<-1.99);
 console.log(JSON.stringify({gateLayouts:6,integerStartingBonuses:41,fractionalStartingBonuses:4,chargeModifiers:4,...totals,actualFinaleContinueAndReload:true,completedRawStatePreserved:true,serverParity:true,activeFailureEnvelopeUnchanged:true}));
})().catch(e=>{console.error(e);process.exitCode=1;});
