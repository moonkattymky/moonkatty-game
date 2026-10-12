'use strict';
// SOURCE-ONLY VM. Preparation/progress/checkpoints are synthetic fixtures, not earned
// gameplay or a real account. Original game source is read unchanged, never rewritten.
// DOM, timers and native storage are doubles. Observers forward original calls intact.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createHash} = require('node:crypto');
const F = require('./evidence-finale-controller-fixture.cjs');
const root = path.resolve(__dirname, '..');
const source = file => fs.readFileSync(path.join(root, file), 'utf8');
const slice = (file, start, end) => source(file).split('\n').slice(start - 1, end).join('\n');
const clone = value => JSON.parse(JSON.stringify(value));
const opKey = n => 'mkty_operations_' + n + '_v1';
const opText = (n, phase = 'core') => JSON.stringify({version:1,n,seed:731,round:3,phase,input:null,confirmed:false,actions:0,hints:0,errors:0,seconds:0});
const SOURCE_PINS = Object.freeze({
 'app.js':'3932e005cd7ebb26db7d954dac13f4c9a7bfe695f556e36d4a95c490a2a3896f',
 'storage.js':'c8a4becffdff791e36ce0a709a8cd8dba2cfa5a4f4e8cde4732ab2565a9261c9',
 'chapter-space.js':'e8c38ea4db0db9d5054f73ce69655fb33c1af11d2a6a67418ac3250c9d905af0',
 'operations.js':'1eb8d1d813c6b6ac79085d1d05e1bc0b49c8ca504a8bcff8248b1275d7706033',
 'story.js':'fe567d0983f0243e931053972d338ebad9bc72ea1628bfcf30b3c3b6b09b4249',
 'pacing.js':'e58234c5914d2f56e5a0539a3d93da3f855c15858df36543f2d1c65d64956677',
 'rewards-client.js':'e4444f4248d6389a650833dbd5a77c60985ba2ca64a37f342ca5dd340536758c',
 'campaign.js':'54d5deea269bbc09e7a22c7a5b3c2e44da810e1daabebf80a193d307b67f35ad',
 'continuation.js':'98c6a522a182fab3b60a321b8c1b86c60271f6149892776438bf27648a0c263e',
 'legacy.js':'457dee47eff741c9a608a82f285d72b5babc24bcb8d5c10ac2c78b19864ecefa',
 'field-model.js':'94ab25d49258d5ca64cdf391eccdaadd3b3f10370b363295a4c3bd3a58aea7a8',
 'story-plan.js':'82d891847f5db366ec0accd8f132f1b9b0198e660054c4ea18f30932704913a6'
});
function verifySources() {
 for (const [file, digest] of Object.entries(SOURCE_PINS)) {
  assert.equal(createHash('sha256').update(source(file)).digest('hex'), digest, file + ' unchanged frozen source');
 }
 return Object.keys(SOURCE_PINS).length;
}
function seedFinal(chapter, operations = 'prepared') {
 const p = F.phases[chapter === 8 ? 1 : 4];
 const seed = F.seed(p);
 seed.mkty_current_chapter = String(chapter);
 seed.mkty_points = chapter === 8 ? '100' : '2100';
 seed.mkty_life7 = 'complete';
 // Chapter 9 begins after a synthetic, explicit chapter-8 prior result.
 if (chapter === 9) Object.assign(seed, {mkty_life8:'complete',mkty_life8_awarded:'yes',mkty_life8_completed_at:'1791806400000'});
 if (operations === 'prepared') seed[opKey(chapter)] = opText(chapter);
 return seed;
}
function originalFinalVM({chapter = 8, operations = 'prepared', diskImage} = {}) {
 assert([8, 9].includes(chapter));
 const phase = F.phases[chapter === 8 ? 1 : 4];
 const disk = new Map(Object.entries(diskImage || seedFinal(chapter, operations)));
 const logical = [], native = [], images = [], nodes = new Map();
 let clock = Date.parse('2026-10-12T12:00:00Z'), fault = null, task = null, callbacks = 0, awards = 0, opens = 0;
 class El {
  constructor(id = '') { Object.assign(this, {id,dataset:{},style:{setProperty(){}},children:[],open:false,textContent:'',classes:new Set()});this.classList={add:(...a)=>a.forEach(x=>this.classes.add(x)),remove:(...a)=>a.forEach(x=>this.classes.delete(x)),contains:x=>this.classes.has(x),toggle(){}}; }
  set innerHTML(value) {this.html=value;for(const m of value.matchAll(/id="([^"]+)"/g))get(m[1]);this.buttons=[...value.matchAll(/data-legacy-choice="([^"]+)"/g)].map(m=>Object.assign(new El(),{dataset:{legacyChoice:m[1]}}));}
  get innerHTML(){return this.html||'';} setAttribute(){} removeAttribute(){} getAttribute(){} before(){} remove(){} focus(){}
  append(...values){this.children.push(...values);for(const value of values)if(value.id)nodes.set(value.id,value);}
  replaceChildren(...values){this.children=values;} addEventListener(){} getAnimations(){return [];} compareDocumentPosition(){return 0;}
  querySelector(selector){return get(this.id+' '+selector);} querySelectorAll(selector){return selector==='button'?(this.buttons||[]):[];}
  showModal(){this.open=true;} close(){this.open=false;}
 }
 const get=id=>{if(!nodes.has(id))nodes.set(id,new El(id));return nodes.get(id);};
 const document={getElementById:get,createElement:()=>new El(),body:get('body'),documentElement:get('html'),hidden:false,addEventListener(){},querySelector:selector=>selector==='.screen.active'?[...nodes.values()].find(e=>e.classes.has('active')):get('selector '+selector),querySelectorAll:selector=>selector==='.screen'?[...nodes.values()]:[]};
 const image=()=>Object.fromEntries([...disk].sort(([a],[b])=>a.localeCompare(b)));
 function io(op,key,value) {
  const row={op,key:String(key),value:op==='set'?String(value):null};native.push(row);
  if(fault!==null&&native.length-1===fault){fault=null;throw Error('synthetic native write failure before operation');}
  if(op==='set')disk.set(row.key,row.value);else disk.delete(row.key);images.push(image());
 }
 const nativeStorage={getItem:key=>disk.get(String(key))??null,setItem:(key,value)=>io('set',key,value),removeItem:key=>io('remove',key),key:i=>[...disk.keys()][i]??null,get length(){return disk.size;}};
 class ClockDate extends Date {static now(){return clock++;}}
 const c={console,document,localStorage:nativeStorage,sessionStorage:{length:0},Date:ClockDate,structuredClone,URLSearchParams,Uint32Array,Math,Set,Map,JSON,Node:{DOCUMENT_POSITION_FOLLOWING:4},MutationObserver:class{observe(){}},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},queueMicrotask(){},setTimeout(){},clearTimeout(){},setInterval(){},clearInterval(){},requestAnimationFrame(){},cancelAnimationFrame(){},addEventListener(){},dispatchEvent(){},scrollTo(){},crypto:{getRandomValues:array=>{array[0]=731;return array;}},Telegram:{WebApp:{initData:''}},activeCinematic:null,leaveMission(){},clearMissionDelays(){},renderMissionArchive(){},renderCrewNetwork(){},renderDailyMissions(){},tg:null};
 c.window=c;c.globalThis=c;vm.createContext(c,{microtaskMode:'afterEvaluate'});
 const run=(text,file)=>vm.runInContext(text,c,{filename:file});
 for(const file of ['storage.js','field-model.js','story-plan.js'])run(source(file),file);
 for(const [method,op] of [['setItem','set'],['removeItem','remove']]) {
  const original=c.MKTYStorage[method];
  c.MKTYStorage[method]=function(key,value){logical.push({op,key:String(key),value:op==='set'?String(value):null});return original.apply(this,arguments);};
 }
 run('const $=id=>document.getElementById(id);','fixture DOM binding');
 for(const [a,b] of [[94,106],[840,847],[850,850],[869,876],[972,986],[473,491]])run(slice('app.js',a,b),'app.js:'+a+'-'+b);
 const originalAward=c.awardLifePoints;c.awardLifePoints=(...args)=>{awards++;return originalAward(...args);};
 run(`window.MKTYPace=(()=>{const ls=localStorage;${slice('pacing.js',33,33)}return {onRecorded,refresh(){}};})();`,'original pacing recording');
 run(`window.MKTYRewards=(()=>{const initData=()=>'',accountContext=()=>({account:'fixture-guest'});${slice('rewards-client.js',227,243)}return {completeLife,accountScope:()=> 'guest'};})();`,'original guest reward');
 for(const name of ['openMission','openMission2','openLife3MemoryGate','openMission4','openMission5','openMission6','openMission7'])c[name]=()=>{};
 run(source('continuation.js'),'continuation.js');
 run(source('campaign.js'),'campaign.js');
 c.MKTYField={open(next){opens++;task=next;},onScreen(){}};
 for(const file of ['legacy.js','chapter-space.js','mission-rules.js','operations-art.js','operations.js','story.js'])run(source(file),file);
 const ready=()=>{c.MKTYSpatialFinale.open(chapter);assert(task,'original final task captured');assert.equal(task.id,phase.index);};
 const clear=()=>{logical.length=0;native.length=0;images.length=0;};
 clear();
 return {chapter,operations,phase,c,disk,logical,native,images,image,ready,clear,
  invoke(){assert(task,'call ready before original invocation');callbacks++;const result=task.complete(clone(phase.state));run('void 0','settle original guest-reward microtasks');return result;},
  cut(index){fault=index;},readNative:key=>disk.get(key)??null,
  retry(){return c.MKTYStorage.retry();},snapshot:()=>clone(c.MKTYStorage.snapshot()),persistent:()=>c.MKTYStorage.persistent,
  counts:()=>({callbacks,awards,opens}),
  discard(){task=null;for(const key of Object.keys(c))delete c[key];}
 };
}
function prefixImages(before, writes) {
 const disk=new Map(Object.entries(before)), images=[before];
 for(const row of writes){if(row.op==='set')disk.set(row.key,row.value);else disk.delete(row.key);images.push(Object.fromEntries([...disk].sort(([a],[b])=>a.localeCompare(b))));}
 return images;
}
function compatibleCuts(images, observed) {
 const text=JSON.stringify(observed);return images.flatMap((image,index)=>JSON.stringify(image)===text?[index]:[]);
}
module.exports={originalFinalVM,seedFinal,prefixImages,compatibleCuts,verifySources,SOURCE_PINS,opKey,opText,source,root};
