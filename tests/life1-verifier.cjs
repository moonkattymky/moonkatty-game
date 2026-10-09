'use strict';
/* Source-only Chapter 1 prototype admission/resource regressions.
 * No browser, production handler, database, or network is used. */
const assert=require('node:assert/strict');
const Model=require('../life1-model.js');
const {LIMITS,replayLife1,verifyLife1}=require('../server/rewards/life1-verifier.cjs');
const {DEFAULT_ROUTE:route,createTrace}=require('./fixtures/life1-playthrough.cjs');
const makeProof=(events=[],overrides={})=>({version:1,route:route.route,challenge:Model.routeKey(route),rules:Model.RULES,layout:Model.LAYOUT,initial:[360,360],events,...overrides});
const encode=proof=>JSON.stringify(proof);
const replay=(events=[],overrides={})=>replayLife1(route,encode(makeProof(events,overrides)));
const accepted=result=>{assert.equal(result.ok,true,JSON.stringify(result));return result;};
const rejected=(result,code)=>{assert.equal(result.ok,false,JSON.stringify(result));assert.equal(result.complete,false);if(code)assert.equal(result.error,code,JSON.stringify(result));assert.equal(result.state,undefined,'a rejected proof must not expose a candidate final state');return result;};
const rejectEvent=(event,code)=>rejected(replay([event]),code);
const repeat=(count,event)=>Array.from({length:count},()=>event.slice());
const cases=[];
const test=(name,run)=>cases.push({name,run});

test('empty replay is diagnostic only; incomplete verification fails',()=>{
 const r=accepted(replay());assert.equal(r.complete,false);assert.equal(r.state.stage,0);
 assert.deepEqual(r.work,{events:0,replayed:0,movement:0,semantic:0,layouts:1,bytes:Buffer.byteLength(encode(makeProof()))});
 rejected(verifyLife1(route,encode(makeProof())),'incomplete');
 const events=[['frame',1,0,0],['frame',41,1,0],['stop',41]];
 accepted(replay(events));rejected(verifyLife1(route,encode(makeProof(events))),'incomplete');
});

test('body must be a JSON string, with no codec or object shortcut',()=>{
 for(const body of [undefined,null,false,1,{},makeProof(),[],Buffer.from('{}'),new String(encode(makeProof()))])rejected(replayLife1(route,body),'body-must-be-json-string');
 for(const body of ['', 'not JSON','{"version":1,}','NaN','Infinity','undefined'])rejected(replayLife1(route,body),'invalid-json');
 for(const body of ['null','[]','true','1','"text"','{}'])rejected(replayLife1(route,body),'invalid-proof-shape');
});

test('exact envelope excludes claimed states, counts, checkpoints, and rectangles',()=>{
 for(const key of Object.keys(makeProof())){const proof=makeProof();delete proof[key];rejected(replayLife1(route,encode(proof)),'invalid-proof-shape');}
 for(const extra of [
  {checkpoint:{stage:3,collected:['1','2','3'],repairCells:4,holdProgress:100}},
  {state:{stage:3}}, {complete:true}, {won:true}, {score:500}, {count:0},
  {movement:0}, {semantic:0}, {layouts:1}, {seed:route.seed}, {edition:2},
  {obstacles:[]}, {boxes:[]}, {geometry:{obstacles:[]}}, {codec:'gzip'}, {decodedBytes:0},
 ])rejected(replay([],extra),'invalid-proof-shape');
 rejected(replayLife1(route,encode(makeProof()).replace('{','{"__proto__":{"stage":3},')),'invalid-proof-shape');
 rejected(replay([['checkpoint',0,{stage:3}]]),'invalid-event');
 rejected(replay([['state',0,{stage:3}]]),'invalid-event');
 rejected(replay([['layout',0,360,360,[]]]),'invalid-event');
 rejected(replay([['layout',0,{width:360,height:360,obstacles:[]},360]]),'invalid-layout-dimensions');
});

test('version, route, challenge, rules, and layout bind exactly',()=>{
 for(const [key,values] of Object.entries({version:[0,2,'1',true,null],route:['other-route',route.route+' ',null,1],challenge:['',Model.routeKey({...route,seed:572}),null,1],rules:['life1-unknown',null,1],layout:['life1-unknown',null,1]})){
  for(const value of values)rejected(replay([],{[key]:value}),'identity-mismatch');
 }
 for(const alternative of [{...route,route:'00000000-0000-4000-8000-000000000572'},{...route,seed:572}])rejected(replayLife1(alternative,encode(makeProof())),'identity-mismatch');
});

test('trusted-route validation is strict and uint32 seed endpoints are admitted',()=>{
 for(const badRoute of [null,undefined,{}, {...route,route:''},{...route,route:'a'.repeat(129)},{...route,route:'bad/route'},{...route,route:'é'}, {...route,route:42}, {...route,life:'1'}, {...route,life:2}, {...route,edition:'2'}, {...route,edition:1}, {...route,seed:'571'}, {...route,seed:-1}, {...route,seed:0x100000000}, {...route,seed:0.5}, {...route,seed:NaN}, {...route,seed:Infinity}])rejected(replayLife1(badRoute,encode(makeProof())),'invalid-trusted-route');
 for(const seed of [0,0xffffffff]){
  const boundRoute={...route,seed};accepted(replayLife1(boundRoute,encode(makeProof([],{challenge:Model.routeKey(boundRoute)}))));
 }
 for(const id of ['test-route','a'.repeat(128),'00000000-0000-4000-8000-00000000057','00000000-0000-4000-8000-0000000005710'])rejected(replayLife1({...route,route:id},encode(makeProof())),'invalid-trusted-route');
 for(const challenge_version of [undefined,null,0,1,'2',true])rejected(replayLife1({...route,challenge_version},encode(makeProof())),'invalid-trusted-route');
});

test('initial layout is a strict finite numeric pair with no caller geometry',()=>{
 for(const initial of [null,{},'360,360',[],[360],[360,360,0],{width:360,height:360,obstacles:[]}])rejected(replay([],{initial}),'invalid-initial-layout');
 for(const value of ['360',true,false,null,{},[],NaN,Infinity,-Infinity,0,63.99,4096.01])for(const initial of [[value,360],[360,value]])rejected(replay([],{initial}),'invalid-layout-dimensions');
 for(const initial of [[64,64],[4096,4096],[360.25,640.5]]){
  const r=accepted(replay([],{initial}));assert.equal(r.state.geometry.width,initial[0]);assert.equal(r.state.geometry.height,initial[1]);assert.equal(r.state.geometry.obstacles.length,3);
 }
});

test('event opcodes are strings with exact arity, never coercible keys',()=>{
 for(const event of [null,{},'stop',[],['unknown',0],['__proto__',0],['constructor',0],[['stop'],0],[[['stop']],0],[['frame'],0,'invalid','invalid'],[{toString:'stop'},0]])rejectEvent(event,'invalid-event');
 const validShapes={frame:['frame',0,0,0],collect:['collect',0,'1'],open:['open',0,'repair'],cell:['cell',0,1],dial:['dial',0,20],tune:['tune',0],hold:['hold',0],pause:['pause',0,true],hidden:['hidden',0,true],close:['close',0,'repair'],layout:['layout',0,360,360],leave:['leave',0],'screen-enter':['screen-enter',0],show:['show',0],delay:['delay',0],stop:['stop',0]};
 assert.deepEqual(Object.keys(validShapes).sort(),Object.keys(Model.ARITY).sort(),'cover every opcode');
 for(const event of Object.values(validShapes)){
  assert.doesNotThrow(()=>Model.validateEvent(event));
  rejectEvent(event.slice(0,-1),'invalid-event');rejectEvent([...event,0],'invalid-event');
 }
});

test('times and frame inputs reject nonnumbers, infinities, bounds and coercion',()=>{
 for(const time of [-1,Number.MAX_SAFE_INTEGER+1,null,false,true,'0',[],{},NaN,Infinity,-Infinity])rejectEvent(['stop',time],'invalid-event');
 for(const time of [0,0.25,Number.MAX_SAFE_INTEGER])accepted(replay([['stop',time]]));
 for(const value of [-1.001,1.001,null,true,false,'1',[],{},NaN,Infinity,-Infinity]){
  rejectEvent(['frame',0,value,0],'invalid-frame-input');rejectEvent(['frame',0,0,value],'invalid-frame-input');
 }
 for(const x of [-1,-0.08,0,0.08,1])for(const y of [-1,0,1])accepted(replay([['frame',1,x,y]]));
 rejected(replayLife1(route,encode(makeProof([['frame',0,0,0]])).replace('["frame",0,0,0]','["frame",0,1e309,0]')),'invalid-frame-input');
 rejected(replay([['frame',100,0,0],['stop',99]]),'time-reordered');
});

test('semantic event arguments reject coercion and out-of-domain values',()=>{
 for(const id of [1,2,3,'0','4','repair',null,true,[],{}])rejectEvent(['collect',0,id],'invalid-energy');
 for(const panel of ['Repair','energy',1,null,[],{}])for(const op of ['open','close'])rejectEvent([op,0,panel],'invalid-panel');
 for(const cell of [-1,3,0.5,'1',true,null,[],{},NaN,Infinity])rejectEvent(['cell',0,cell],'invalid-cell');
 for(const dial of [-1,101,10.5,'20',true,null,[],{},NaN,Infinity])rejectEvent(['dial',0,dial],'invalid-dial');
 for(const value of [0,1,'false',null,[],{}])for(const op of ['pause','hidden'])rejectEvent([op,0,value],'invalid-pause');
 for(const value of [63.9,4096.1,'360',true,null,[],{},NaN,Infinity])for(const event of [['layout',0,value,360],['layout',0,360,value]])rejectEvent(event,'invalid-layout-dimensions');
 accepted(replay([['layout',0,64,64],['layout',1,4096,4096],['layout',2,360.25,640.5]]));
});

test('admission rejects impossible UI actions and disabled or inactive controls',()=>{
 const initial=Model.create(route);
 for(const id of ['1','2','3'])if(Model.distance(initial,id)>=.24)rejectEvent(['collect',0,id],'energy-unreachable');
 for(const panel of ['repair','antenna']){rejectEvent(['open',0,panel],'station-unreachable');rejectEvent(['close',0,panel],'panel-not-open');}
 for(const op of ['cell','show'])rejectEvent(op==='cell'?[op,0,0]:[op,0],'repair-unavailable');
 rejectEvent(['dial',0,58],'antenna-unavailable');rejectEvent(['tune',0],'antenna-unavailable');
 rejectEvent(['hold',0],'hold-not-started');rejectEvent(['delay',0],'delay-not-scheduled');rejectEvent(['screen-enter',0],'already-active');
 for(const flag of ['pause','hidden']){
  for(const action of [['collect',1,'1'],['open',1,'repair'],['cell',1,0],['dial',1,58],['show',1],['tune',1]])rejected(replay([[flag,0,true],action]),'ui-inactive');
  accepted(replay([[flag,0,true],['frame',1,1,1],[flag,2,false],['stop',2]]));
 }
 for(const action of [['collect',1,'1'],['pause',1,true],['show',1],['hold',1],['delay',1]])rejected(replay([['leave',0],action]),'mission-inactive');
 accepted(replay([['leave',0],['frame',1,1,1],['layout',1,400,400],['hidden',1,true],['stop',1],['screen-enter',2],['hidden',3,false]]));
});

test('8192 movement and 1024 semantic caps accept exact limits and reject +1',()=>{
 const movement=repeat(LIMITS.movement,['frame',0,0,0]);
 const maxMove=accepted(replay(movement));assert.equal(maxMove.work.movement,8192);assert.equal(maxMove.work.events,8192);assert.equal(maxMove.state.x,50);
 assert.equal(rejected(replay([...movement,['frame',0,0,0]]),'movement-limit').work.replayed,0);
 const semantic=repeat(LIMITS.semantic,['stop',0]);
 const maxSemantic=accepted(replay(semantic));assert.equal(maxSemantic.work.semantic,1024);assert.equal(maxSemantic.work.events,1024);
 rejected(replay([...semantic,['stop',0]]),'semantic-limit');
 // Every semantic opcode, including UI/timer events, is charged before admission.
 for(const event of [['hold',0],['delay',0],['screen-enter',0]])rejected(replay([...semantic,event]),'semantic-limit');
});

test('128 layout budget includes initial geometry and composes with all other caps',()=>{
 assert.deepEqual(LIMITS,{movement:8192,semantic:1024,layouts:128,encodedBytes:192*1024,decodedBytes:512*1024});
 const layouts=repeat(LIMITS.layouts-1,['layout',0,360,360]);
 const maxLayout=accepted(replay(layouts));assert.equal(maxLayout.work.layouts,128);assert.equal(maxLayout.work.events,127);
 rejected(replay([...layouts,['layout',0,360,360]]),'layout-limit');
 const events=[...repeat(LIMITS.movement,['frame',0,0,0]),...repeat(LIMITS.semantic,['stop',0]),...layouts];
 const result=accepted(replay(events));assert.deepEqual({...result.work,bytes:0},{events:9343,replayed:9343,movement:8192,semantic:1024,layouts:128,bytes:0});
 assert(result.work.bytes<LIMITS.encodedBytes,'all exact event budgets fit the byte ceiling');
 for(const [event,error] of [[['frame',0,0,0],'movement-limit'],[['stop',0],'semantic-limit'],[['layout',0,360,360],'layout-limit']])rejected(replay([...events,event]),error);
 const overCount=rejected(replay(repeat(LIMITS.movement+LIMITS.semantic+LIMITS.layouts+1,['stop',0])),'event-limit');
 assert.equal(overCount.work.events,0,'coarse event cap applies before per-event validation/replay');
 for(const invalid of [null,{},'[]',0])rejected(replay([],{events:invalid}),'event-limit');
});

test('the complete trace is validated and charged before replay; tails never truncate',()=>{
 const badAdmission=['open',0,'antenna'];
 rejected(replay([badAdmission,...repeat(LIMITS.movement+1,['frame',0,0,0])]),'movement-limit');
 rejected(replay([badAdmission,['frame',1,'bad',0]]),'invalid-frame-input');
 rejected(replay([badAdmission,['invented',1]]),'invalid-event');
 const exact=repeat(LIMITS.movement,['frame',0,0,0]);
 rejected(replay([...exact,['checkpoint',0,{stage:3}]]),'invalid-event');
 rejected(replay([...exact,['open',0,'antenna']]),'station-unreachable');
 const almost=repeat(LIMITS.semantic-1,['stop',2]);
 rejected(replay([...almost,['stop',1]]),'time-reordered');
});

test('UTF-8 byte limits apply before JSON.parse, including large nested junk',()=>{
 const body=encode(makeProof()),exact=body+' '.repeat(LIMITS.encodedBytes-Buffer.byteLength(body));
 const atBoundary=accepted(replayLife1(route,exact));assert.equal(atBoundary.work.bytes,LIMITS.encodedBytes);
 rejected(verifyLife1(route,exact),'incomplete');
 const realParse=JSON.parse;let parses=0;
 JSON.parse=(...args)=>{parses++;return realParse(...args);};
 try{
  rejected(replayLife1(route,exact+' '),'encoded-byte-limit');
  rejected(replayLife1(route,'['.repeat(LIMITS.encodedBytes+1)),'encoded-byte-limit');
  rejected(replayLife1(route,'😀'.repeat(LIMITS.encodedBytes/4+1)),'encoded-byte-limit');
  rejected(replayLife1(route,'é'.repeat(LIMITS.encodedBytes/2+1)),'encoded-byte-limit');
  assert.equal(parses,0,'nothing larger than 192 KiB reaches JSON.parse');
  rejected(replayLife1(route,'😀'.repeat(LIMITS.encodedBytes/4)),'invalid-json');
  assert.equal(parses,1,'exactly 192 KiB is not truncated before parsing');
  const tooLong=rejected(replayLife1(route,' '.repeat(LIMITS.decodedBytes+1)),'decoded-byte-limit');assert.equal(tooLong.work.bytes,0,'cheap UTF-16 length screen precedes UTF-8 allocation');
  rejected(replayLife1(route,'😀'.repeat(LIMITS.decodedBytes/4+1)),'decoded-byte-limit');assert.equal(parses,1);
 }finally{JSON.parse=realParse;}
 // In uncompressed prototype v1, encoded bytes equal decoded bytes, so the
 // 192 KiB cap dominates the secondary 512 KiB decoded bound by design.
});


test('solved proofs bind the full trusted identity and never ignore appended events',()=>{
 const solved=createTrace(route).finish(),verified=accepted(verifyLife1(route,solved.body));
 assert.equal(verified.complete,true);assert.equal(Model.won(verified.state),true);
 for(const seed of [0,1,route.seed+1,0xffffffff])rejected(verifyLife1({...route,seed},solved.body),'identity-mismatch');
 const rebound={...route,seed:route.seed+1};
 rejected(verifyLife1(rebound,encode({...solved.proof,challenge:Model.routeKey(rebound)})),'station-unreachable');
 const wrongRoute={...route,route:'00000000-0000-4000-8000-000000000572'};
 rejected(verifyLife1(wrongRoute,solved.body),'identity-mismatch');
 for(const field of ['state','checkpoint','obstacles'])rejected(verifyLife1(route,encode({...solved.proof,[field]:field==='obstacles'?[]:solved.state})),'invalid-proof-shape');
 const lastTime=solved.proof.events.at(-1)[1];
 for(const [tail,error] of [[['checkpoint',lastTime,{stage:3}],'invalid-event'],[['frame',lastTime,'1',0],'invalid-frame-input'],[['stop',lastTime-1],'time-reordered'],[['open',lastTime,'repair'],'station-unreachable']]){
  rejected(verifyLife1(route,encode({...solved.proof,events:[...solved.proof.events,tail]})),error);
 }
 // Zero-time idle prefix preserves the playthrough and keeps all exact-count
 // fixtures below the independent 192 KiB byte budget.
 const atLimit=[...repeat(LIMITS.movement-verified.work.movement,['frame',0,0,0]),...solved.proof.events];
 assert.equal(accepted(verifyLife1(route,encode({...solved.proof,events:atLimit}))).work.movement,LIMITS.movement);
 rejected(verifyLife1(route,encode({...solved.proof,events:[['frame',0,0,0],...atLimit]})),'movement-limit');
});

test('leaving during playback does not re-enable disabled repair cells',()=>{
 const solved=createTrace(route).finish(),events=solved.proof.events.slice(),i=events.findIndex(e=>e[0]==='open'&&e[2]==='repair'),time=events[i][1];
 events.splice(i+1,0,['show',time],['leave',time],['screen-enter',time]);
 rejected(verifyLife1(route,encode({...solved.proof,events})),'repair-unavailable');
});

test('late callbacks cannot consume a same-timestamp hold backlog',()=>{
 const solved=createTrace(route).finish(),t=solved.proof.events.find(e=>e[0]==='tune')[1],events=solved.proof.events.map(e=>e[0]==='hold'?['hold',t+3000]:e);
 rejected(verifyLife1(route,encode({...solved.proof,events})),'hold-callback-early');
 let late=0;const spaced=solved.proof.events.map(e=>e[0]==='hold'?['hold',t+3000+(late++)*120]:e);
 assert(verifyLife1(route,encode({...solved.proof,events:spaced})).ok,'late-but-spaced callbacks remain valid');
});

test('backgrounding opens the guide and visibility alone never resumes a hold',()=>{
 const solved=createTrace(route).finish(),events=solved.proof.events.slice(),i=events.findIndex(e=>e[0]==='tune'),t=events[i][1];
 events.splice(i+1,0,['hidden',t,true],['hidden',t,false]);
 rejected(verifyLife1(route,encode({...solved.proof,events})),'incomplete');
 events.splice(i+3,0,['pause',t,false]);assert(verifyLife1(route,encode({...solved.proof,events})).ok);
 const left=accepted(replay([['pause',0,true],['leave',0],['screen-enter',1]]));assert.equal(left.state.paused,false);
});

test('bounded deterministic malformed-input fuzz never throws or accepts bad opcodes',()=>{
 let seed=0x51f00d;const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
 const badValues=[null,false,true,'0',[],{},-1,Number.MAX_SAFE_INTEGER+1];
 for(let i=0;i<300;i++){
  const event=next()%2?['stop',badValues[next()%badValues.length]]:[['stop'],next()%1000];
  const result=replay([event]);rejected(result,'invalid-event');
 }
 for(let i=0;i<120;i++){
  const length=next()%80;let body='';for(let j=0;j<length;j++)body+=String.fromCharCode(32+next()%95);
  assert.doesNotThrow(()=>replayLife1(route,body));rejected(replayLife1(route,body));
 }
});

let failed=0;
for(const {name,run} of cases){try{run();console.log('PASS: '+name);}catch(error){failed++;console.error('FAIL: '+name+'\n'+error.stack);}}
if(failed)process.exitCode=1;
else console.log(`PASS: ${cases.length} pure Chapter 1 verifier admission/resource groups`);
