'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {create}=require('./fixtures/life1-recording-controller-helper.cjs');
const M=require('../prototypes/life1-capture/pr47/life1-model.js');
const out=process.env.MKTY_TEST_OUTPUT||'/tmp/mkty-life1-recording-controller';fs.mkdirSync(out,{recursive:true});
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
const beforeRepair=first.capture().wire(),repairSave=first.storage();assert(repairSave[first.capture().KEY]);
const repairJournal=local(first.capture().clockJournal());assert.deepEqual(JSON.parse(repairSave[first.capture().KEY]).clockObservations,repairJournal);
const sentinel=create({storageSeed:repairSave});sentinel.setClock(first.capture().state().now-first.capture().state().lastFrame);
const beforeSentinel=JSON.stringify(sentinel.snapshot());assert.equal(sentinel.capture().restore().error,'clock-rebase-sentinel');
assert.equal(sentinel.capture().wire(),null);assert.equal(JSON.stringify(sentinel.snapshot()),beforeSentinel);assert.equal(sentinel.storage()[sentinel.capture().KEY],repairSave[first.capture().KEY]);
const repairReload=create({storageSeed:repairSave});repairReload.setClock(5000);
assert.equal(repairReload.capture().restore().ok,true,JSON.stringify(repairReload.capture().status()));check(repairReload);
assert.equal(repairReload.snapshot().repairCells,2);assert.equal(repairReload.snapshot().paused,true);
assert.deepEqual(JSON.parse(repairReload.capture().wire()).entries.slice(0,JSON.parse(beforeRepair).entries.length),JSON.parse(beforeRepair).entries);
assert.deepEqual(local(repairReload.capture().clockJournal()).slice(0,repairJournal.length),repairJournal);
assert.equal(repairReload.capture().restore().error,'already-recording','duplicate hydration cannot rearm the same document');
repairReload.setPaused(false);check(repairReload);repairReload.cell(seq[2]);check(repairReload);repairReload.cell(seq[3]);check(repairReload);
navigate(repairReload,'antenna');repairReload.openAntenna();check(repairReload);repairReload.dial(repairReload.snapshot().target);check(repairReload);repairReload.tune();check(repairReload);
for(let i=0;i<10;i++){repairReload.holdTick(repairReload.snapshot().now+(i%2?105:135));check(repairReload);}
assert.equal(repairReload.snapshot().holdProgress,40);repairReload.setPaused(true);check(repairReload);
const holdPrefix=repairReload.capture().wire(),holdReload=create({storageSeed:repairReload.storage()});holdReload.setClock(200);
const restored=holdReload.capture().restore();assert.equal(restored.ok,true,JSON.stringify(restored));check(holdReload);
assert.equal(holdReload.snapshot().holdProgress,40);assert.equal(holdReload.snapshot().holdActive,true);assert.equal(holdReload.snapshot().paused,true);
assert.deepEqual(JSON.parse(holdReload.capture().wire()).entries.slice(0,JSON.parse(holdPrefix).entries.length),JSON.parse(holdPrefix).entries);
holdReload.holdTick(335);check(holdReload);assert.equal(holdReload.snapshot().holdProgress,40);
holdReload.setPaused(false);check(holdReload);
for(let i=0;i<15;i++){holdReload.holdTick(holdReload.snapshot().now+(i%2?105:135));check(holdReload);}
assert.equal(holdReload.snapshot().holdProgress,100);assert.equal(holdReload.snapshot().stage,3);
let timer=0;while(!holdReload.snapshot().completeVisible){assert(timer<20);holdReload.delayCallback(holdReload.snapshot().now+(timer++%2?35:65));check(holdReload);}
assert.equal(holdReload.snapshot().memoryCodeShows,1,'original completion card callback ran once');
// Failed local persistence retains the complete in-memory prefix and old durable prefix.
first.refuseStorage(true);const old=first.storage()[first.capture().KEY];first.frame({now:first.snapshot().now+16,x:0,y:0});first.save();check(first);
assert.equal(first.capture().status().lastSave.error,'checkpoint-storage-refused');assert.equal(first.storage()[first.capture().KEY],old);
first.refuseStorage(false);first.save();assert.equal(first.capture().status().lastSave.ok,true);assert.notEqual(first.storage()[first.capture().KEY],old);
// Small observer capacity refuses capture without changing actual movement behavior.
const limited=create({limits:{maxEntries:3,maxBytes:4096}});limited.frame({now:100,x:1,y:0});limited.frame({now:116,x:1,y:0});
const retained=limited.capture().wire(),x=limited.snapshot().x;limited.frame({now:132,x:1,y:0});
assert.equal(limited.capture().status().fault.error,'capacity-refused');assert.equal(limited.capture().wire(),retained);assert(limited.snapshot().x>x);
// The dispatch journal is part of the storage budget, not uncounted overhead.
const wrapperLimited=create({limits:{maxEntries:100,maxBytes:4096}});let priorWire,priorJournal;
for(let i=0;i<100&&!wrapperLimited.capture().status().fault;i++){
 priorWire=wrapperLimited.capture().wire();priorJournal=wrapperLimited.capture().clockJournal();wrapperLimited.frame({now:100+i*16,x:0,y:0});
}
assert.equal(wrapperLimited.capture().status().fault.error,'checkpoint-capacity-refused');
assert.equal(wrapperLimited.capture().wire(),priorWire);assert.deepEqual(wrapperLimited.capture().clockJournal(),priorJournal);
assert.equal(Buffer.byteLength(JSON.stringify({format:wrapperLimited.capture().FORMAT,recording:priorWire,clockObservations:priorJournal}))<=4096,true);
// An active source is not silently changed into a resumable paused checkpoint.
const active=create();active.save();assert.equal(active.capture().status().lastSave.error,'checkpoint-not-paused');assert.equal(active.storage()[active.capture().KEY],undefined);
const otherOrder=create();for(const id of ['2','1']){navigate(otherOrder,id);otherOrder.collect(Number(id)-1);check(otherOrder);}
assert.deepEqual(local(otherOrder.capture().state().collected),['2','1'],'capture retains actual collection order');
// Legitimate dispatch order can have an older RAF physics timestamp. Preserve
// both clocks and report the frozen model's exact blocker; do not sort/round it.
const dual=create();dual.frame({now:100,x:0,y:0});dual.setClock(110);dual.setPaused(true);
const acceptedBeforeDual=dual.capture().wire();dual.dualFrame(105,115,0,0);
assert.equal(dual.capture().status().fault.error,'local-time-reordered');assert.equal(dual.capture().wire(),acceptedBeforeDual);
assert.equal(dual.capture().status().fault.detail.clockObservation.dispatchMs,115);
assert.equal(dual.capture().status().fault.detail.clockObservation.frameTimestamp,105);
const report={test:'life1-recording-controller',exactComparedStates:compared,pausedRepairReload:true,pausedFortyPercentHoldReload:true,nonDomCollectionOrderPreserved:true,sentinelRebaseRefusedBeforeMutation:true,
 originalAcceptedPrefixesRetained:true,originalCallbackJitter:[135,105],originalDelayJitter:[65,35],storageRetryRetainsLatestMemoryPrefix:true,
 capacityRefusalDoesNotStopGameplay:true,checkpointJournalIncludedInBudget:true,duplicateHydrationRefused:true,activeCheckpointRefused:true,separateDispatchAndPhysicsClocksRetained:true,nativeMixedClockReplay:'explicitly blocked by frozen single-time model',browserExecuted:false,nativeGeometryCertified:false,authoritativeAdmission:false};
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
