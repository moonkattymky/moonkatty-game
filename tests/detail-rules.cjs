/* Regression checks for the format-2 decisions and existing checkpoints. */
const assert=require('assert/strict'),R=require('../field-model.js'),P=require('../story-plan.js'),{solve}=require('./field-rules.cjs');
const roundtrip=s=>{const restored=R.restore(JSON.parse(JSON.stringify(s)),s.n,s.stage,s.seed);assert.deepEqual(restored,s);return restored;};
let legacy=0;
for(let n=1;n<=9;n++)for(let stage=0;stage<5;stage++){
 const s=R.create(n,stage,53);s.version=1;for(const k of ['detections','trim','sites','load','diagnosed','isolated','surveyed'])delete s[k];
 roundtrip(s);solve(s);roundtrip(s);legacy++;
}
const geo=R.create(4,3,21),g=R.layout(geo);
assert.equal(g.requiredSites,2);R.act(geo,'select',g.safe);assert.equal(R.act(geo,'sample'),false);assert.equal(R.act(geo,'land'),false);
R.act(geo,'scan');assert.equal(geo.scans.length,4);R.act(geo,'sample');R.act(geo,'land');assert(!geo.complete);roundtrip(geo);
assert.equal(R.act(geo,'land'),false);assert.equal(geo.notice,'separate-pad');assert.equal(R.restore({...geo,complete:true},4,3,21),null);
R.act(geo,'select',35);assert.equal(R.act(geo,'scan'),false);assert.equal(geo.notice,'footprint-edge');
R.act(geo,'select',g.backup);R.act(geo,'scan');R.act(geo,'sample');R.act(geo,'land');assert(R.won(geo));roundtrip(geo);
assert.equal(R.restore({...geo,pad:35},4,3,21),null);
const thermal=R.create(5,2,21);assert.equal(R.act(thermal,'stabilize'),false);assert.equal(R.act(thermal,'isolate',R.layout(thermal).fault),false);
const targets=[];
for(let mode=0;mode<3;mode++){
 const b=R.layout(thermal);targets.push(b.target);R.act(thermal,'diagnose');assert.equal(R.act(thermal,'isolate',(b.fault+1)%3),false);R.act(thermal,'isolate',b.fault);
 b.target.forEach((v,i)=>R.act(thermal,'valve',[i,v]));assert(R.readouts(thermal).every((v,i)=>Math.abs(v-b.desired[i])<=b.tolerance));R.act(thermal,'stabilize');assert.equal(thermal.load,mode+1);roundtrip(thermal);
 if(mode<2){assert(!thermal.diagnosed);assert.equal(thermal.isolated,-1);assert(!thermal.complete);}
}
assert.notDeepEqual(targets[0],targets[1]);assert(R.won(thermal));
const orbit=R.create(3,2,1),o=R.layout(orbit);
R.act(orbit,'angle',o.target.angle);R.act(orbit,'power',o.target.power);R.act(orbit,'trim',o.target.trim>0?-20:20);
assert(R.distance(R.flightPoint(orbit.angle,orbit.power,2,R.condition(orbit),orbit.trim),o.target.relay)<.01);
assert.equal(R.act(orbit,'burn'),false);assert.equal(orbit.burn,0);roundtrip(orbit);solve(orbit);
const convoy=R.create(9,0,5);R.act(convoy,'select',2);assert.equal(R.act(convoy,'move',4),false);assert.equal(convoy.notice,'scout-first');
R.act(convoy,'select',0);for(const i of [3,5,4,6])assert(R.act(convoy,'move',i));roundtrip(convoy);
R.act(convoy,'select',2);assert(R.act(convoy,'move',4));assert.equal(convoy.ships[2],4);solve(convoy);
const stealth=R.create(7,0,4),b=R.layout(stealth);let found=false;
for(let at=0;at<36&&!found;at++)for(const to of [at-6,at+6,at-1,at+1]){
 if(to<0||to>=36||b.walls.includes(at)||b.walls.includes(to)||Math.abs(at%6-to%6)+Math.abs(Math.floor(at/6)-Math.floor(to/6))!==1||!R.watched({...stealth,turn:1},to))continue;
 stealth.pos=at;stealth.alert=2;assert(R.act(stealth,'move',to));assert.equal(stealth.detections,1);assert.equal(stealth.errors,1);assert.equal(stealth.pos,b.start);found=true;break;
}assert(found);
const plan=P.fresh(5,1,2);plan.tasks[0]={performance:R.performance(thermal)};assert.deepEqual(P.restore(plan).tasks[0].performance,R.performance(thermal));
assert.equal(R.restore({...R.create(5,0,1),complete:'yes'},5,0,1),null);
console.log(JSON.stringify({legacyMissions:legacy,partialCheckpoints:'preserved',landingFootprintAndBackup:true,threeThermalLoads:true,independentTrajectoryTrim:true,scoutRequired:true,checkpointDetectionCount:true,performanceRecord:true}));
