'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {create}=require('./fixtures/life1-recording-vnext-controller-helper.cjs');
const M=require('../prototypes/life1-capture/pr47/life1-model.js');
const out=process.env.MKTY_TEST_OUTPUT||'/tmp/mkty-life1-recording-vnext-controller';fs.mkdirSync(out,{recursive:true});
let compared=0;
const local=x=>JSON.parse(JSON.stringify(x));
function check(c){const status=c.capture().status();assert.equal(status.fault,null,JSON.stringify(status));const v=c.capture().compare();assert.equal(v.ok,true,JSON.stringify(v));compared++;}
function navigate(c,id){
 c.frame({now:c.snapshot().now+1,x:0,y:0});check(c);
 const s=c.capture().state(),start={x:s.x,y:s.y,parent:null},q=[start],seen=new Set([s.x+','+s.y]);let goal;
 for(let i=0;i<q.length;i++){const p=q[i];if(M.distance({...s,x:p.x,y:p.y},id)<.22){goal=p;break;}
  for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1]]){const x=p.x+dx,y=p.y+dy,k=x+','+y;if(x<7||x>90||y<18||y>88||seen.has(k)||M.blocked(s,x,y))continue;seen.add(k);q.push({x,y,parent:p});}}
 assert(goal,'normal path exists');const points=[];while(goal.parent){points.push(goal);goal=goal.parent;}
 for(const p of points.reverse()){const state=c.capture().state(),dx=(p.x-state.x)*state.geometry.width/100,dy=(p.y-state.y)*state.geometry.height/100,d=Math.hypot(dx,dy),parts=Math.ceil(d/3.4),dt=d/parts/88*1000;
  for(let i=0;i<parts;i++){c.frame({now:c.snapshot().now+dt,x:dx/d,y:dy/d});check(c);}}
}
function repairedPrefix(c){
 check(c);for(const id of ['1','2','3']){navigate(c,id);c.collect(Number(id)-1);check(c);}
 navigate(c,'repair');c.openRepair();check(c);c.showSequence();check(c);
 let i=0;while(c.snapshot().repairShowing){assert(i<100);c.delayCallback(c.snapshot().now+(i++%2?35:65));check(c);}
 const seq=c.snapshot().repairSequence;c.cell(seq[0]);check(c);c.cell(seq[1]);check(c);return seq;
}
const first=create(),seq=repairedPrefix(first);first.setPaused(true);check(first);
const repairPrefix=first.capture().wire(),repairSave=first.storage();
const repairReload=create({storageSeed:repairSave,initialNow:50000});repairReload.setPaused(true);
assert.equal(repairReload.capture().restore().ok,true,JSON.stringify(repairReload.capture().status()));check(repairReload);
assert.equal(repairReload.snapshot().repairCells,2);
assert.deepEqual(JSON.parse(repairReload.capture().wire()).entries.slice(0,JSON.parse(repairPrefix).entries.length),JSON.parse(repairPrefix).entries);
repairReload.setPaused(false);check(repairReload);repairReload.cell(seq[2]);check(repairReload);repairReload.cell(seq[3]);check(repairReload);
navigate(repairReload,'antenna');repairReload.openAntenna();check(repairReload);repairReload.dial(repairReload.snapshot().target);check(repairReload);repairReload.tune();check(repairReload);
for(let i=0;i<10;i++){repairReload.holdTick(repairReload.snapshot().now+(i%2?105:135));check(repairReload);}
assert.equal(repairReload.snapshot().holdProgress,40);repairReload.setPaused(true);check(repairReload);
const holdPrefix=repairReload.capture().wire(),holdReload=create({storageSeed:repairReload.storage(),initialNow:.125});holdReload.setPaused(true);
const restored=holdReload.capture().restore();assert.equal(restored.ok,true,JSON.stringify(holdReload.capture().status()));check(holdReload);
assert.equal(holdReload.snapshot().holdProgress,40);assert.equal(holdReload.snapshot().holdActive,true);assert.equal(holdReload.snapshot().paused,true);
assert.deepEqual(JSON.parse(holdReload.capture().wire()).entries.slice(0,JSON.parse(holdPrefix).entries.length),JSON.parse(holdPrefix).entries);
holdReload.nearby();check(holdReload);
holdReload.holdTick(135.125);check(holdReload);assert.equal(holdReload.snapshot().holdProgress,40);
holdReload.setPaused(false);check(holdReload);
for(let i=0;i<15;i++){holdReload.holdTick(holdReload.snapshot().now+(i%2?105:135));check(holdReload);}
assert.equal(holdReload.snapshot().holdProgress,100);assert.equal(holdReload.snapshot().stage,3);
let timer=0;while(!holdReload.snapshot().completeVisible){assert(timer<20);holdReload.delayCallback(holdReload.snapshot().now+(timer++%2?35:65));check(holdReload);}
assert.equal(holdReload.snapshot().memoryCodeShows,1);
const dual=create();dual.frame({now:100,x:0,y:0});dual.setClock(110);dual.setPaused(true);dual.dualFrame(105,115,0,0);check(dual);
assert.equal(dual.capture().state().lastFrame,105);assert.equal(dual.capture().state().dispatchMs,115);
// Native measured layout change captured automatically at original source reads.
const gap=create({width:362,height:483.96875,left:14,top:83.15625,statusResize:true});
navigate(gap,'2');gap.frame({now:1289,x:0,y:0});gap.collect(1);check(gap);
assert.equal(gap.capture().state().geometry.height,483.96875);assert.equal(gap.capture().state().liveGeometry.world.height,495.84375);
gap.frame({now:1296,x:0,y:1});check(gap);gap.setClock(1321);gap.refresh();check(gap);
assert.equal(gap.capture().state().geometry.height,495.84375);
// Pause's nested campaign save publishes only after its source stop is recorded.
const pauseWire=JSON.parse(repairSave[first.capture().KEY]);
assert.deepEqual(pauseWire.entries.at(-1).slice(4),['pause',[['pause',true],['stop']]]);
// Count capacity refusal retains the preceding whole callback while source runs.
const limited=create({limits:{maxEntries:3,maxBytes:4096}});limited.frame({now:100,x:1,y:0});limited.frame({now:116,x:1,y:0});
const retained=limited.capture().wire(),oldX=limited.snapshot().x;limited.frame({now:132,x:1,y:0});
assert.equal(limited.capture().status().fault.error,'capacity-refused');assert.equal(limited.capture().wire(),retained);assert(limited.snapshot().x>oldX);
// Draft overflow and source throw are whole-callback refusals, never partial saves.
const overflow=create(),overflowWire=overflow.capture().wire();
overflow.capture().wrap('nearby',()=>{for(let i=0;i<129;i++)overflow.capture().step(['live',402,402,0,0]);overflow.capture().save();})();
assert.equal(overflow.capture().status().fault.error,'callback-draft-capacity-refused');assert.equal(overflow.capture().wire(),overflowWire);assert.equal(overflow.storage()[overflow.capture().KEY],undefined);
const aborted=create(),abortedWire=aborted.capture().wire();
assert.throws(()=>aborted.capture().wrap('nearby',()=>{aborted.capture().step(['live',402,402,0,0]);throw Error('fixture-source-throw');})(),/fixture-source-throw/);
assert.equal(aborted.capture().status().fault.error,'source-callback-aborted');assert.equal(aborted.capture().wire(),abortedWire);
// Storage quota failure preserves the old durable prefix and latest memory prefix.
first.refuseStorage(true);const durable=first.storage()[first.capture().KEY];first.frame({now:first.snapshot().now+16,x:0,y:0});first.save();check(first);
assert.equal(first.capture().status().lastSave.error,'checkpoint-storage-refused');assert.equal(first.storage()[first.capture().KEY],durable);
first.refuseStorage(false);first.save();assert.equal(first.capture().status().lastSave.ok,true);
// Real budget refusal after hydration writes: minimum epoch metadata fits, but
// complete source refresh/rearm envelope does not. Keep old prefix and disarm.
const R=require('../prototypes/life1-capture/vnext/recorder.cjs');
let capped=JSON.parse(holdPrefix);capped.capacity.maxBytes=Buffer.byteLength(R.encode(capped))+90;
let cappedBody=R.encode(capped),cappedParsed=R.inspect(cappedBody);assert(cappedParsed.ok);
const failed=create({storageSeed:{[first.capture().KEY]:cappedBody},initialNow:900000});failed.setPaused(true);
const raw={dispatchMs:900000,lastFrame:0,nearbyAt:0,clockResumedAt:0};assert.equal(R.preflightDocument(cappedParsed.recording,raw).ok,true);
const mutationCount=failed.statusMutations().length,result=failed.capture().restore();
assert.equal(result.error,'hydration-refused',JSON.stringify(failed.capture().status()));
assert.equal(failed.capture().status().fault.detail.reason,'capacity-refused');assert(failed.statusMutations().length>mutationCount);
assert.equal(failed.snapshot().paused,true);assert.equal(failed.snapshot().holdActive,false);assert.equal(failed.capture().wire(),cappedBody);assert.equal(failed.storage()[failed.capture().KEY],cappedBody);
assert.equal(failed.capture().restore().error,'already-recording-or-faulted');
assert.equal(R.inspect(holdReload.capture().wire()).ok,true);
const held=R.inspect(holdPrefix).recording,heldBytes=R.serialize(held),incomplete=R.beginDocument(held,{dispatchMs:0,lastFrame:0,nearbyAt:0,clockResumedAt:0},[['stop'],['live',402,402,0,0],['cache',402,402,0,0]]);
assert.equal(incomplete.error,'hydrate-rearm-required');assert.equal(incomplete.recording,held);assert.equal(R.serialize(held),heldBytes);
const departed=create();departed.frame({now:100,x:1,y:0});departed.setPaused(true);departed.leave();check(departed);assert.equal(departed.snapshot().active,false);assert.equal(departed.snapshot().paused,false);
const sameScreen=create();sameScreen.frame({now:100,x:1,y:0});sameScreen.setPaused(true);sameScreen.enter();check(sameScreen);assert.equal(sameScreen.snapshot().active,true);assert.equal(sameScreen.snapshot().paused,false);assert.equal(sameScreen.snapshot().lastFrame,0);
// A resize/visibility callback may arrive after input but before the next RAF.
const inputOrder=create();inputOrder.stick(60,38);check(inputOrder);assert(inputOrder.capture().state().moveX>0);inputOrder.refresh();check(inputOrder);inputOrder.setHidden(true);check(inputOrder);assert.equal(inputOrder.capture().state().moveX,0);
const centered=create();centered.stick(38,38);check(centered);assert(Object.is(centered.capture().state().moveX,0));centered.stick(37,38);check(centered);assert(Object.is(centered.capture().state().moveX,-0));assert(Object.is(centered.snapshot().moveX,-0));centered.refresh();check(centered);centered.setPaused(true);check(centered);assert(Object.is(centered.capture().state().moveX,0));
// The fresh document's own status writes can resize it after preflight.
let hydrationStatusWrites=0;const layoutReload=create({storageSeed:repairSave,statusTextHook:({text})=>text==='Energy restored. Repair the terminal 🔧'?{height:++hydrationStatusWrites===1?450:470}:null});
layoutReload.setPaused(true);assert.equal(layoutReload.snapshot().rectangles.world.height,450);assert.equal(layoutReload.capture().restore().ok,true);check(layoutReload);assert.equal(layoutReload.snapshot().rectangles.world.height,470);assert.equal(layoutReload.capture().state().geometry.height,470);assert.equal(layoutReload.capture().state().liveGeometry.world.height,470);
const scanner=create({statusTextHook:({text})=>text.startsWith('Scanner:')?{height:450}:null});scanner.scan();check(scanner);assert.equal(scanner.snapshot().rectangles.world.height,450);assert.equal(scanner.capture().state().liveGeometry.world.height,402);scanner.nearby();check(scanner);assert.equal(scanner.capture().state().liveGeometry.world.height,450);assert.equal(scanner.capture().state().geometry.height,402);
const report={test:'life1-recording-vnext-controller',exactComparedStates:compared,pausedRepairReload:true,pausedFortyPercentHoldReload:true,rawDocumentEpochs:true,originalAcceptedPrefixesRetained:true,originalCallbackJitter:[135,105],originalDelayJitter:[65,35],mixedClockReplay:true,stickBeforeFrameOrdering:true,centeredAndSignedZeroInput:true,measuredAutomaticCapture:true,atomicCapacityRefusal:true,postStageHydrationRefusal:true,hydrationStatusResizeObserved:true,scannerSourceReadsRetained:true,storageQuotaRetainsPrefix:true,usage:holdReload.capture().status().usage,browserExecuted:false,nativeGeometryCertified:false,authoritativeAdmission:false};
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
