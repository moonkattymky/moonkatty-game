'use strict';
const assert=require('node:assert/strict');
const M=require('../prototypes/life1-capture/vnext/source-model.cjs');
const R=require('../prototypes/life1-capture/vnext/recorder.cjs');
const {DEFAULT_CONTEXT}=require('./fixtures/life1-recording-vnext-controller-helper.cjs');
const initial=[402,402,0,0],live=['live',...initial],cache=['cache',...initial];
const base=M.create({context:DEFAULT_CONTEXT,initial});let refusals=0;
function refuses(state,kind,steps){const before=R.encode(state);assert.throws(()=>M.transition(state,{kind,dispatchMs:120,steps}));assert.equal(R.encode(state),before);refusals++;}
for(const key of ['x','collected','geometry','timers','stage','sequence']){
 assert.throws(()=>M.create({context:DEFAULT_CONTEXT,initial,clock:{lastFrame:0,nearbyAt:0,clockResumedAt:0,[key]:999}}),/invalid-source-clock/);refusals++;
 const paused={...base,paused:true,stage:1,repairOpen:true,repairCells:1,repairInput:[base.sequence[0]]};
 const before=R.encode(paused);assert.throws(()=>M.beginDocument(paused,{dispatchMs:0,lastFrame:0,nearbyAt:0,clockResumedAt:0,[key]:999}),/invalid-source-clock/);assert.equal(R.encode(paused),before);refusals++;
}
refuses({...base,paused:true},'frame',[['frame',105,1,0]]);
refuses(base,'frame',[['frame',100,1,0],live,['nearby']]);
refuses(base,'frame',[['frame',100,1,0],['nearby-at',100],live,['nearby']]);
refuses(base,'frame',[['frame',10,0,0],['stop']]);
refuses(base,'refresh',[live,['cache',402,410,0,0]]);
refuses(base,'refresh',[live,cache,['stop'],live,['nearby']]);
refuses(base,'close',[['close','repair'],['stop'],live,['nearby']]);
refuses(base,'close',[['close','repair'],['timer-cancel',[]],['stop'],['sequence'],live,['nearby']]);
refuses(base,'leave',[['leave']]);
refuses(base,'dial',[['frame',100,0,0]]);
refuses(base,'nearby',[['finish'],['timer-start',1,'complete',300,120]]);
refuses(base,'delay',[['timer-tick',99,120],['card']]);
refuses(base,'show',[['show'],['timer-start',1,'repair',650,120],['cue']]);
refuses(base,'show',[['show'],['cue']]);
refuses(base,'pause',[['pause',false],['stop']]);
refuses(base,'resume',[['pause',true]]);
refuses(base,'hydrate',[]);
refuses(base,'scan',[live,live]);
refuses(base,'frame',[['input',1,0]]);
refuses(base,'stick',[['input',2,0]]);
refuses({...base,stage:2,paused:true,antennaOpen:true,holding:true,holdProgress:40},'hydrate',[['stop'],live,cache]);
refuses({...base,stage:1,paused:true,repairOpen:true,repairCells:2},'hydrate',[['stop'],live,cache,['hold-rearm']]);
const valid=M.transition(base,{kind:'refresh',dispatchMs:120,steps:[live,cache]});assert.equal(valid.geometry.height,402);
const paused=M.transition(base,{kind:'pause',dispatchMs:110,steps:[['pause',true],['stop']]});
const delivered=M.transition(paused,{kind:'frame',dispatchMs:115,steps:[['frame',105,1,0],['stop']]});assert.equal(delivered.lastFrame,105);assert.equal(delivered.moveX,0);
// Import/compile native fixture sources without starting browser or sockets.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),Module=require('node:module');
const root=path.resolve(__dirname,'..'),load=Module._load;let browser;
try{Module._load=function(id,...args){assert(!['http','node:http','net','node:net','child_process','node:child_process','playwright'].includes(id),'inert fixture import: '+id);return load.call(this,id,...args);};browser=require('./life1-recording-vnext-browser-fixture.cjs');}finally{Module._load=load;}
new vm.Script(browser.bundle());
const instrument=require('./fixtures/life1-recording-vnext-instrument.cjs').instrument;
for(const file of ['app.js','experience.js','campaign.js']){const original=fs.readFileSync(path.join(root,file),'utf8');new vm.Script(instrument(original,file));assert.throws(()=>instrument('',file));new vm.Script(browser.responseFor('/'+file).body.toString());}
assert.equal(browser.responseFor('/index.html').body.toString(),fs.readFileSync(path.join(root,'index.html'),'utf8'));
for(const url of ['/server/rewards/index.cjs','/tests/life1-recording-source.cjs','/.git/config','/api/rewards','/%00'])assert.notEqual(browser.responseFor(url).status,200);
assert.equal(browser.responseFor('/app.js','POST').status,405);assert.equal(browser.responseFor('/%xx').status,400);
const nativeText=fs.readFileSync(path.join(__dirname,'life1-recording-vnext-browser-fixture.cjs'),'utf8');
assert(!nativeText.includes('.clock.')&&!nativeText.includes('cancelAnimationFrame')&&!nativeText.includes('.fill('));
assert(nativeText.includes("dial.press('Home')")&&nativeText.includes("dial.press('ArrowRight')"));
assert(nativeText.includes('oldMixedClockGatePassed:false')&&nativeText.includes('authoritativeAdmission:false'));
console.log(JSON.stringify({test:'life1-recording-vnext-grammar',refusals,unchangedPriorStates:true,exactRefreshPair:true,inertNativeImport:true,nativeBundleAndInstrumentationCompile:true,earnedStateCannotBeReplacedByClockMetadata:true,authoritativeAdmission:false}));
