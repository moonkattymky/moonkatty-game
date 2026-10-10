/* Convoy energy bonuses and charger visits must survive saving and completion. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const R=require('../field-model.js');
const clone=s=>JSON.parse(JSON.stringify(s));
const roundtrip=(rules,s)=>assert.deepEqual(rules.restore(clone(s),s.n,s.stage,s.seed),s);
// Stage 4 is the chapter-9 finale. Stage 0 has the same layout and is a story assignment.
// Every movement is accepted by the ordinary model, including scouting for the cargo ship.
const route=[
 [0,3,5,7,5,4,6], // Scout visits POWER twice; only the first visit adds a cell.
 [1,3,5,3,1],
 [2,4,5],        // All three have collected POWER before opening the gate.
 [0,4,2],
 [1,4,6],
 ['gate'],['gate'], // Opening the already-open gate cannot spend another cell.
 [1,8],[0,4,6,8],[2,7,8]
];
// Stage 1 opens the gate before the scout/cargo pickups (reported art-audit route).
const earlyGateRoute=[[0,3],[1,4,5,7],['gate'],[0,5],[1,8],[0,7,8],[2,3,5,7,8]];
function play(rules,bonus,stage,legacy=false){
 const s=rules.create(9,stage,stage===1?0:5,bonus?{cells:bonus}:undefined);
 if(legacy){s.version=1;delete s.mods;delete s.detections;delete s.surveyed;}
 s.trace=[];
 let expected=3+bonus;
 const check=()=>{assert.equal(s.cells,expected);roundtrip(rules,s);};
 const act=(a,v)=>{
  const pickups=s.evacuated.length,gate=s.gate;
  s.trace.push(['act',a,v??null]);assert.equal(rules.act(s,a,v),true);
  if(s.evacuated.length>pickups)expected++;
  if(s.gate&&!gate)expected--;
  check();
 };
 check();let peak=s.cells;
 for(const [ship,...nodes] of stage===1?earlyGateRoute:route){
  if(ship==='gate')act('gate');
  else{act('select',ship);for(const node of nodes){act('move',node);peak=Math.max(peak,s.cells);}}
 }
 if(stage!==1){assert.equal(peak,3+bonus+1+1+1);assert.equal(s.cells,peak-1);}
 if(Number.isInteger(bonus))assert.equal(s.cells,5+bonus);
 assert.equal(s.errors,0);assert(s.complete&&rules.won(s));
 const fixed=JSON.stringify(s);assert.equal(rules.act(s,'gate'),false);assert.equal(JSON.stringify(s),fixed);
 return s;
}
function boundaries(rules){
 const nextUp=value=>{const view=new DataView(new ArrayBuffer(8));view.setFloat64(0,value);view.setBigUint64(0,view.getBigUint64(0)+1n);return view.getFloat64(0);};
 for(const bonus of [0,1,2,.00008,.00022,.00036,1.00008,1.99999]){
  const fresh=rules.create(9,4,5,bonus?{cells:bonus}:undefined);
  const ceiling=3+bonus+1+1+1;
  for(const cells of [-1,NaN,Infinity,nextUp(ceiling),7+bonus])assert.equal(rules.restore({...fresh,cells},9,4,5),null);
  // Keep the existing broad envelope; this change does not add conservation validation.
  assert(rules.restore({...fresh,cells:ceiling},9,4,5));
  assert(rules.restore({...fresh,gate:true,cells:ceiling},9,4,5));
  assert.equal(rules.restore({...fresh,evacuated:[0,0]},9,4,5),null);
 }
 for(const cells of [-1,3,Infinity]){
  const fresh=rules.create(9,4,5);
  assert.equal(rules.restore({...fresh,mods:{cells}},9,4,5),null);
 }
 const legacy={...rules.create(9,4,5),version:1};
 assert.equal(rules.restore({...legacy,cells:7,mods:{cells:2}},9,4,5),null);
}
// The real campaign modifier provider can produce +2 from ordinary named choices.
const storage=new Map(),context={window:{},document:{createElement:()=>({setAttribute(){},addEventListener(){}}),body:{append(){}}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}};
vm.runInNewContext(fs.readFileSync(require.resolve('../legacy.js'),'utf8'),context);
const L=context.window.MKTYLegacy;
for(const [airlock,events] of [['crew',{6:'tow'}],['crew',{9:'go'}],['cargo',{6:'tow',9:'go'}],['crew',{6:'tow',9:'go'}]]){
 L.set('airlock',airlock);L.set('events',events);assert.equal(L.mods(9,9).cells,2);
}
(async()=>{
 const server=(await import('../server/rewards/models/field-model.mjs')).default;
 let runs=0;
 for(const rules of [R,server]){
  for(const stage of [0,1,4])for(const bonus of [0,1,2]){play(rules,bonus,stage);runs++;}
  // Fractional modifiers are already accepted. 0.00008 exposes rounding above 6 + bonus.
  // Exercise subtraction both before and after the final pickups.
  for(const bonus of [.5,.00008,.00022,.00036,1.00008,1.99999])for(const stage of [1,4])play(rules,bonus,stage);
  play(rules,0,4,true);boundaries(rules);
 }
 for(const stage of [0,1,4])for(const bonus of [0,1,2])assert.deepEqual(play(R,bonus,stage),play(server,bonus,stage));
 console.log(JSON.stringify({convoyBonusRuns:runs,perActionRoundtrip:true,chargerOncePerShip:true,gateCostOnce:true,completedRoundtrip:true,legacyCapUnchanged:true,invalidCellsRejected:true,campaignBonusVerified:true,serverParity:true}));
})().catch(e=>{console.error(e);process.exitCode=1;});
