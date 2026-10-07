const R=require('../field-model.js'),assert=require('assert/strict');
function route(s,target){const b=R.layout(s),q=[[s.pos]],seen=new Set([s.pos]);while(q.length){const path=q.shift(),p=path.at(-1);if(p===target)return path.slice(1);for(const v of [p-6,p+6,p-1,p+1])if(v>=0&&v<36&&!b.walls.includes(v)&&!seen.has(v)&&Math.abs(v%6-p%6)+Math.abs(Math.floor(v/6)-Math.floor(p/6))===1){seen.add(v);q.push([...path,v]);}}throw Error('Disconnected mission');}
function crewOrder(s){const jobs=R.layout(s).jobs,done=s.jobs.slice(),order=[];while(done.length<6){const i=jobs.findIndex((j,i)=>!done.includes(i)&&j.requires.every(k=>done.includes(k)));assert(i>=0);done.push(i);order.push(i);}return order;}
const convoyCache=new Map();
function convoyPlan(s){const key=x=>x.ships.join(',')+'/'+x.gate+'/'+[...(x.surveyed||[])].sort().join(','),cacheKey=s.version+'/'+s.stage+'/'+key(s);if(convoyCache.has(cacheKey))return convoyCache.get(cacheKey);const q=[[structuredClone(s),[]]],seen=new Set([key(s)]);for(let at=0;at<q.length;at++){const [cur,route]=q[at];if(cur.complete){convoyCache.set(cacheKey,route);return route;}const b=R.layout(cur),candidates=[];if(!cur.gate&&cur.ships[1]===b.gateNode)candidates.push(['gate']);for(let i=0;i<3;i++)if(cur.ships[i]!==8)for(const [a,z]of b.edges){if(a===cur.ships[i])candidates.push(['move',i,z]);if(z===cur.ships[i])candidates.push(['move',i,a]);}for(const a of candidates){const next=structuredClone(cur);if(a[0]==='gate')R.act(next,'gate');else{R.act(next,'select',a[1]);if(!R.act(next,'move',a[2]))continue;}const k=key(next);if(!seen.has(k)){seen.add(k);q.push([next,[...route,a]]);}}}throw Error('Convoy has no solution');}
function solve(s){let b=R.layout(s);
 if(s.n===1||s.n===7){R.act(s,'scan');for(const target of [...b.targets,b.exit]){let safety=0;while(s.pos!==target&&safety++<100){const next=route(s,target)[0];if(s.n===7){let waits=0;while(R.watched({...s,turn:s.turn+1},next)&&waits++<4)R.act(s,'wait');}R.act(s,'move',next);}assert(safety<100);}}
 if(s.n===2)for(const i of crewOrder(s)){R.act(s,'select',i);R.act(s,'role',b.jobs[i].role);R.act(s,'assign');}
 if(s.n===3)while(!s.complete){b=R.layout(s);R.act(s,'angle',b.target.angle);R.act(s,'power',b.target.power);if(s.version===2)R.act(s,'trim',b.target.trim);R.act(s,'burn');}
 if(s.n===4)for(const site of s.version===2&&b.requiredSites===2?[b.safe,b.backup]:[b.safe]){R.act(s,'select',site);R.act(s,'scan');R.act(s,'sample');R.act(s,'land');}
 if(s.n===5)while(!s.complete){b=R.layout(s);if(s.version===2){R.act(s,'diagnose');R.act(s,'isolate',b.fault);}b.target.forEach((v,i)=>R.act(s,'valve',[i,v]));R.act(s,'stabilize');}
 if(s.n===6){for(const target of b.bays){s.ship.x=target.x;s.ship.y=target.y;s.ship.vx=s.ship.vy=0;R.act(s,'dock');}}
 if(s.n===8){for(let i=0;i<3;i++){R.act(s,'station',i);R.act(s,'angle',Math.round(b.bearings[i]));R.act(s,'sample');}R.act(s,'pin',b.source);R.act(s,'locate');}
 if(s.n===9)for(const a of convoyPlan(s)){if(a[0]==='gate')R.act(s,'gate');else{R.act(s,'select',a[1]);R.act(s,'move',a[2]);}}
 assert(s.complete&&R.won(s),'Unsolved chapter '+s.n);assert(R.restore(s,s.n,s.stage,s.seed));return s;
}
if(require.main===module){let runs=0;for(let n=1;n<=9;n++)for(let stage=0;stage<5;stage++)for(let seed=1;seed<=40;seed++){const s=R.create(n,stage,seed);assert(!s.complete);assert(R.restore(s,n,stage,seed));const forged={...s,complete:true};assert.equal(R.restore(forged,n,stage,seed),null);solve(s);runs++;}
 const dock=R.create(6,3,7);R.act(dock,'dock');assert.equal(dock.docked,0);for(let i=0;i<300;i++)R.tick(dock,.016,{x:1,y:0});assert(dock.ship.x>80&&dock.integrity>=0);const bad=R.create(8,2,9);R.act(bad,'locate');assert(!bad.complete);bad.angles=[NaN,2,3];assert.equal(R.restore(bad,8,2,9),null);console.log(JSON.stringify({solvedSpatialMissions:runs,forgedCompletionsRejected:true,dockingPhysics:true}));}
if(require.main===module){ // Chapter 6: the hull can reach 0 and the attempt fails (no 25% floor).
 assert.equal(R.hullDamage(0),6);assert.equal(R.hullDamage(500),18);
 const ram=R.create(6,1,11);ram.ship={x:200,y:225,vx:0,vy:0};let ticks=0;while(!ram.failed&&ticks<20000){R.tick(ram,.04,{x:1,y:0});ticks++;if(ram.ship.x<225)continue;ram.ship.x=150;}
 assert(ram.failed&&ram.integrity===0&&ram.impacts>=6&&ram.impacts<=17,'hull breach '+ram.impacts);assert.equal(ram.notice,'hull-breach');
 const frozen=JSON.stringify(ram);R.tick(ram,.04,{x:1,y:0});assert.equal(R.act(ram,'brake'),false);assert.equal(JSON.stringify(ram),frozen);
 assert(R.restore(JSON.parse(frozen),6,1,11)?.failed);assert.equal(R.restore({...JSON.parse(frozen),integrity:40},6,1,11),null);assert.equal(R.restore({...JSON.parse(frozen),integrity:-1},6,1,11),null);
 // A careful pilot (gentle scrape each port) still finishes: three slow contacts cost 18% and docking repairs it.
 const careful=R.create(6,2,5);for(let i=0;i<3;i++){careful.ship={x:228,y:200,vx:5,vy:0};R.tick(careful,.02,{});}assert(!careful.failed&&careful.integrity>=75);
 console.log('docking failure OK: breach after '+ram.impacts+' rams');}
// Finale 8 (decode) and finale 9 climax (gate): deterministic optimal play and fairness margins.
function decodeStep(s){const b=R.layout(s);if(s.event)return ['answer'];const c=b.carrier(s.turn),j=b.jam(s.turn);if(c===j&&s.charges>0&&!s.filter)return ['tune',c,'filter'];return ['tune',c];}
function playDecode(s,choice='answer'){let guard=0;while(!s.complete&&!s.failed&&guard++<100){if(s.event){assert(R.act(s,choice));continue;}const [,c,f]=decodeStep(s);R.act(s,'tune',c);if(f)R.act(s,'filter');assert(R.act(s,'listen'));}return s;}
function gateStep(s){const b=R.layout(s);return b.aligned(s.turn)?'launch':s.charges>0?'boost':'wait';}
function playGate(s){let guard=0;while(!s.complete&&!s.failed&&guard++<100)assert(R.act(s,gateStep(s)));return s;}
if(require.main===module){let minNoise=0,minStab=999;for(let seed=1;seed<=400;seed++){for(const choice of ['answer','silent']){const d=playDecode(R.create(10,4,seed),choice);assert(d.complete&&R.won(d)&&!d.failed,'decode '+seed);assert.equal(d.choice,choice);minNoise=Math.max(minNoise,d.noise);assert(R.restore(JSON.parse(JSON.stringify(d)),10,4,seed));}
  const g=playGate(R.create(11,4,seed));assert(g.complete&&R.won(g),'gate '+seed);minStab=Math.min(minStab,g.stability);assert(R.restore(JSON.parse(JSON.stringify(g)),11,4,seed));
  // Blind play (always listening in the middle band / launching immediately) must fail: the mechanics are not free wins.
  const blind=R.create(10,4,seed);let k=0;while(!blind.complete&&!blind.failed&&k++<200){if(blind.event)R.act(blind,'silent');R.act(blind,'listen');}assert(blind.failed&&!R.won(blind),'blind decoding must lose the signal '+seed);
  const rush=R.create(11,4,seed);k=0;while(!rush.complete&&!rush.failed&&k++<200)R.act(rush,'launch');assert(rush.failed&&!R.won(rush),'rushing the gate must collapse it '+seed);}
 assert(minNoise<=85,'decode margin '+minNoise);assert(minStab>=10,'gate margin '+minStab);
 const e=R.create(10,4,7);assert.equal(R.act(e,'answer'),false);const forged={...playDecode(R.create(10,4,9)),fragments:2};assert.equal(R.restore(forged,10,4,9),null);
 // Legacy modifiers are bounded and survive checkpoints; forged modifiers are rejected.
 const m=R.create(11,4,3,{stability:25,charges:2,bogus:9});assert.deepEqual(m.mods,{stability:25,charges:2});assert.equal(m.stability,R.GATE_BASE+25);assert.equal(R.restore({...m,mods:{stability:99}},11,4,3),null);
 const crew=R.create(2,1,4,{role:1});assert(R.layout(crew).jobs.filter(j=>j.role===1).every((j,i)=>j.cost<=R.layout(R.create(2,1,4)).jobs.filter(x=>x.role===1)[i].cost));
 const conv=R.create(9,2,4,{cells:1});assert.equal(conv.cells,4);const dk=R.create(6,1,2,{repair:6});assert.equal(dk.mods.repair,6);
 console.log('finale mechanics OK: decode worst noise '+minNoise+'%, gate worst remaining stability '+minStab);}
module.exports={route,solve,crewOrder,convoyPlan,decodeStep,gateStep};
