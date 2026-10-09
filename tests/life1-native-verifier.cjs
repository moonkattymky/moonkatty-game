'use strict';
/* Pure defensive schema/admission/resource regressions. No production handler,
 * database, browser, local socket, or external service is used. */
const assert=require('node:assert/strict');
const M=require('../life1-model.js');
const {LIMITS,replayLife1,verifyLife1}=require('../server/rewards/life1-verifier.cjs');
const {DEFAULT_ROUTE:route,createTrace}=require('./fixtures/life1-native-playthrough.cjs');
const {DEFAULT_ROUTE:legacy,createTrace:createLegacy}=require('./fixtures/life1-playthrough.cjs');
const initial=[300,231.21875,10,92.1875];
const proof=(events=[],extra={})=>({version:2,route:route.route,challenge:M.routeKey(route),rules:M.NATIVE_RULES,layout:M.NATIVE_PROFILE,initial,events,...extra});
const encode=JSON.stringify,replay=(events=[],extra={})=>replayLife1(route,encode(proof(events,extra)));
const accept=r=>{assert.equal(r.ok,true,JSON.stringify(r));return r;};
const reject=(r,error,preflight=false)=>{assert.equal(r.ok,false,JSON.stringify(r));assert.equal(r.complete,false);assert.equal(r.state,undefined);if(error)assert.equal(r.error,error);if(preflight)assert.equal(r.work.replayed,0);return r;};
const repeated=(n,e)=>Array.from({length:n},()=>e.slice());
let groups=0;const test=(name,fn)=>{fn();groups++;console.log('PASS: '+name);};

test('v2 empty diagnostic replay is never completion and preserves exact epoch accounting',()=>{
 const r=accept(replay());assert.equal(r.complete,false);assert.equal(r.state.layout,M.NATIVE_PROFILE);
 assert.deepEqual(r.work,{events:0,replayed:0,movement:0,semantic:0,layouts:1,bytes:Buffer.byteLength(encode(proof()))});
 reject(verifyLife1(route,encode(proof())),'incomplete');
 const updated=accept(replay([['view',0,10,500],['layout',0,...initial],['frame',1,0,0]]));
 assert.equal(updated.work.layouts,3);assert.equal(updated.work.semantic,0);assert.equal(updated.work.movement,1);
});
test('only trusted route context selects v2; unknown contexts and downgrade attempts fail closed',()=>{
 for(const selector of [undefined,null,'',M.LAYOUT,'chromium145','unknown',true,2,{},[]])reject(replayLife1({...route,life1_profile:selector},encode(proof())),'unsupported-trusted-profile',true);
 reject(replayLife1(legacy,encode(proof())),'identity-mismatch',true);
 reject(replayLife1(route,createLegacy().finish().body),'identity-mismatch',true);
 for(const [key,values]of Object.entries({version:[1,0,'2',null],rules:[M.RULES,'unknown',null],layout:[M.LAYOUT,'unknown',null],challenge:[M.routeKey(legacy),'',null],route:[legacy.route+' ',null,'other']}))for(const value of values)reject(replay([],{[key]:value}),'identity-mismatch',true);
 for(const r of [{...route,seed:route.seed+1},{...route,route:'00000000-0000-4000-8000-000000000572'}])reject(replayLife1(r,encode(proof())),'identity-mismatch',true);
 reject(replay([],{version:1,rules:M.RULES,layout:M.LAYOUT,challenge:M.routeKey(legacy),initial:[300,300]}),'identity-mismatch',true);
});
test('exact proof shape excludes all measurements, transforms, claimed states and overrides',()=>{
 for(const key of Object.keys(proof())){const p=proof();delete p[key];reject(replayLife1(route,encode(p)),'invalid-proof-shape',true);}
 for(const extra of [{boxes:[]},{obstacles:[]},{player:{}},{targets:[]},{near:'1'},{collected:[]},{transforms:[]},{zoom:1},{profile:M.NATIVE_PROFILE},{engine:'145.0.7632.6'},{state:{stage:3}},{complete:true},{checkpoint:{}},{codec:'gzip'},{count:0}])reject(replay([],extra),'invalid-proof-shape',true);
 reject(replayLife1(route,encode(proof()).replace('{','{"__proto__":{"stage":3},')),'invalid-proof-shape',true);
});
test('initial ABI is exactly four finite bounded grid values; v1 remains an exact pair',()=>{
 for(const value of [null,{},false,'300,300,0,0',[],[300,300],[300,300,0],[...initial,[]]])reject(replay([],{initial:value}),'invalid-initial-layout',true);
 for(const value of [null,true,false,'300',[],{},NaN,Infinity,-Infinity,63.99,4096.015625,300.001])for(const index of [0,1]){
  const a=initial.slice();a[index]=value;reject(replay([],{initial:a}),'unsupported-layout-envelope',true);
 }
 for(const value of [null,true,false,'0',[],{},NaN,Infinity,-Infinity,-4096.015625,4096.015625,.001])for(const index of [2,3]){
  const a=initial.slice();a[index]=value;reject(replay([],{initial:a}),'unsupported-layout-envelope',true);
 }
 for(const initial of [[64,64,-4096,-4096],[4096,4096,4096,4096],[359.375,569.578125,35.3125,73.21875]])accept(replay([],{initial}));
 const p={...proof(),version:1,rules:M.RULES,layout:M.LAYOUT,challenge:M.routeKey(legacy)};
 reject(replayLife1(legacy,encode(p)),'invalid-initial-layout',true);
});
test('native layout/view arities reject dimensions, transforms, off-grid inputs and old tuples',()=>{
 for(const event of [['layout',0,300,300],['layout',0,...initial,[]],['view',0,0],['view',0,300,300,0,0],['view',0,0,0,{}],['geometry',0,[]],['transform',0,1],['checkpoint',0,{stage:3}]])reject(replay([event]),'invalid-event',true);
 for(const value of [null,'0',true,{},[],NaN,Infinity,-Infinity,-4097,4097,.001])for(const index of [2,3]){
  const event=['view',0,0,0];event[index]=value;reject(replay([event]),'unsupported-view-origin',true);
 }
 for(const value of [null,'300',true,{},[],NaN,Infinity,-Infinity,63,4097,.001])for(const index of [2,3]){
  const event=['layout',0,...initial];event[index]=value;reject(replay([event]),'unsupported-layout-envelope',true);
 }
 for(const value of [null,'0',true,{},[],NaN,Infinity,-Infinity,-4097,4097,.001])for(const index of [4,5]){
  const event=['layout',0,...initial];event[index]=value;reject(replay([event]),'unsupported-layout-envelope',true);
 }
 const p={version:1,route:legacy.route,challenge:M.routeKey(legacy),rules:M.RULES,layout:M.LAYOUT,initial:[300,300],events:[['view',0,0,0]]};
 reject(replayLife1(legacy,encode(p)),'invalid-event',true);
});
test('every nongeometry event keeps strict v1 argument admission and exact arity',()=>{
 for(const event of [null,{},[],['__proto__',0],[['stop'],0],['stop',null],['stop',-1],['stop',Number.MAX_SAFE_INTEGER+1]])reject(replay([event]),'invalid-event',true);
 for(const value of [null,true,'1',[],{},-1.1,1.1])for(const index of [2,3]){const e=['frame',0,0,0];e[index]=value;reject(replay([e]),'invalid-frame-input',true);}
 for(const e of [['collect',0,1],['cell',0,3],['dial',0,.5],['pause',0,'false'],['hidden',0,0],['open',0,'other']])reject(replay([e]),undefined,true);
 for(const time of [0,.25,Number.MAX_SAFE_INTEGER])accept(replay([['stop',time]]));
});
test('view cannot move or teleport a player, unlock quests, or clear cache collisions',()=>{
 const r=accept(replay([['view',0,4096,-4096]]));assert.equal(r.state.x,50);assert.equal(r.state.y,68);assert.equal(r.state.stage,0);
 assert.deepEqual(r.state.geometry.obstacles,M.createNative(route,...initial).geometry.obstacles);
 reject(replay([['view',0,4096,-4096],['open',0,'antenna']]),'station-unreachable');
 reject(replay([['pause',0,true],['collect',0,'1']]),'ui-inactive');
 reject(replay([['leave',0],['view',0,10,0],['collect',0,'1']]),'mission-inactive');
 accept(replay([['leave',0],['view',0,10,0],['layout',0,...initial],['screen-enter',1]]));
});
test('both origin-only and refresh epochs share exact 128 cap including initial',()=>{
 for(const kind of ['view','layout','mixed']){
  const events=Array.from({length:127},(_,i)=>kind==='view'||kind==='mixed'&&i%2?['view',0,10,i]:['layout',0,...initial]);
  const r=accept(replay(events));assert.equal(r.work.layouts,128);assert.equal(r.work.semantic,0);assert.equal(r.work.events,127);
  for(const extra of [['view',0,0,0],['layout',0,...initial]])reject(replay([...events,extra]),'layout-limit',true);
 }
});
test('all legacy event caps stay fixed, compose with native epochs, and never truncate',()=>{
 assert.deepEqual(LIMITS,{movement:8192,semantic:1024,layouts:128,encodedBytes:192*1024,decodedBytes:512*1024});
 const frames=repeated(LIMITS.movement,['frame',0,0,0]),semantic=repeated(LIMITS.semantic,['stop',0]),layouts=repeated(127,['layout',0,...initial]);
 const events=[...frames,...semantic,...layouts],r=accept(replay(events));assert.equal(r.work.events,9343);assert.equal(r.work.replayed,9343);assert(r.work.bytes<LIMITS.encodedBytes);
 for(const [extra,error]of [[['frame',0,0,0],'movement-limit'],[['stop',0],'semantic-limit'],[['view',0,0,0],'layout-limit'],[['layout',0,...initial],'layout-limit']])reject(replay([...events,extra]),error,true);
 reject(replay(repeated(9345,['stop',0])),'event-limit',true);
 for(const events of [null,{},'[]',1])reject(replayLife1(route,encode(proof(events))),'event-limit',true);
});
test('full structural, chronological and budget preflight precedes any semantic replay',()=>{
 const impossible=['open',0,'antenna'];
 for(const [tail,error]of [[['view',1,.001,0],'unsupported-view-origin'],[['layout',1,300,300],'invalid-event'],[['frame',1,'bad',0],'invalid-frame-input'],[['invented',1],'invalid-event']])reject(replay([impossible,tail]),error,true);
 reject(replay([impossible,['stop',2],['stop',1]]),'time-reordered',true);
 reject(replay([impossible,...repeated(128,['view',0,0,0])]),'layout-limit',true);
 reject(replay([impossible,...repeated(8193,['frame',0,0,0])]),'movement-limit',true);
 const solved=createTrace().finish(),time=solved.proof.events.at(-1)[1];
 for(const [tail,error]of [[['view',time,0,.001],'unsupported-view-origin'],[['checkpoint',time,{}],'invalid-event'],[['stop',time-1],'time-reordered']])reject(verifyLife1(route,encode({...solved.proof,events:[...solved.proof.events,tail]})),error,true);
 const extended=accept(verifyLife1(route,encode({...solved.proof,events:[...solved.proof.events,['view',time,0,0]]})));assert.equal(extended.work.events,solved.proof.events.length+1);
});
test('unchanged UTF-8 caps apply before parsing and reject bytes rather than clipping',()=>{
 const body=encode(proof()),exact=body+' '.repeat(LIMITS.encodedBytes-Buffer.byteLength(body));assert.equal(accept(replayLife1(route,exact)).work.bytes,LIMITS.encodedBytes);
 const parse=JSON.parse;let calls=0;JSON.parse=(...a)=>{calls++;return parse(...a);};
 try{
  reject(replayLife1(route,exact+' '),'encoded-byte-limit',true);
  reject(replayLife1(route,'😀'.repeat(LIMITS.encodedBytes/4+1)),'encoded-byte-limit',true);
  reject(replayLife1(route,' '.repeat(LIMITS.decodedBytes+1)),'decoded-byte-limit',true);
  assert.equal(calls,0);
 }finally{JSON.parse=parse;}
 for(const body of [proof(),Buffer.from('{}'),null,new String(encode(proof()))])reject(replayLife1(route,body),'body-must-be-json-string',true);
});
test('valid completion keeps route, seed, source profile and objective evidence bound',()=>{
 const played=createTrace().finish();assert.equal(accept(verifyLife1(route,played.body)).complete,true);
 for(const r of [{...route,seed:0},{...route,seed:0xffffffff},{...route,route:'00000000-0000-4000-8000-000000000572'},legacy])reject(verifyLife1(r,played.body),'identity-mismatch',true);
 const noEnergy={...played.proof,events:played.proof.events.filter(e=>e[0]!=='collect')};reject(verifyLife1(route,encode(noEnergy)));
 const noHolds={...played.proof,events:played.proof.events.filter(e=>e[0]!=='hold')};reject(verifyLife1(route,encode(noHolds)),'incomplete');
});
test('bounded malformed native fuzz never throws or accepts caller geometry',()=>{
 let seed=0x713ad;const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
 const bad=[null,false,true,'0',{},[],-4097,4097,.001];
 for(let n=0;n<300;n++){const e=['view',0,0,0];e[2+next()%2]=bad[next()%bad.length];reject(replay([e]),'unsupported-view-origin',true);}
 for(let n=0;n<100;n++){const p=proof();p.initial=[...initial,{obstacles:[]}];reject(replayLife1(route,encode(p)),'invalid-initial-layout',true);}
});
console.log(JSON.stringify({suite:'life1-native-verifier',groups,browserRun:false,liveSettlementWired:false}));
