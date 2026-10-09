'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const M=require('../life1-model.js'),P=require('../life1-native-geometry.js'),V=require('../server/rewards/life1-verifier.cjs');
const {DEFAULT_ROUTE:R,createTrace}=require('./fixtures/life1-native-playthrough.cjs');
const {DEFAULT_ROUTE:LEGACY,createTrace:createLegacy}=require('./fixtures/life1-playthrough.cjs');
let groups=0,playthroughs=0;const test=(name,fn)=>{fn();groups++;console.log('PASS: '+name);};
const envelope=[300,231.21875,10,92.1875];
test('trusted explicit selection binds schema/rules/profile and preserves legacy identity',()=>{
 assert.deepEqual(M.profileForRoute(LEGACY),{version:1,rules:M.RULES,layout:M.LAYOUT});
 assert.deepEqual(M.profileForRoute(R),{version:2,rules:M.NATIVE_RULES,layout:M.NATIVE_PROFILE});
 assert.equal(M.routeKey(LEGACY),'life1-variable-dt-prototype-1|life1-css-f3ec07d7-prototype-1|00000000-0000-4000-8000-000000000571|1|2|2|571');
 assert.notEqual(M.challengeSeed(R),M.challengeSeed(LEGACY));
 for(const life1_profile of [undefined,null,'',M.LAYOUT,'unknown',2,{},[]])assert.throws(()=>M.profileForRoute({...R,life1_profile}),/unsupported-trusted-profile/);
 assert.throws(()=>M.profileForRoute(Object.assign(Object.create({life1_profile:M.NATIVE_PROFILE}),LEGACY)),/unsupported-trusted-profile/);
 assert.throws(()=>M.createNative(LEGACY,...envelope),/native-profile-required/);
 for(const args of [[],envelope.slice(0,2),[...envelope,[]],[undefined,...envelope.slice(1)]])assert.throws(()=>M.createNative(R,...args));
 assert.throws(()=>M.create(R,undefined,...envelope.slice(1)),/unsupported-layout-envelope/);
 assert.deepEqual(M.create(R,...envelope),M.createNative(R,...envelope));
});
test('native construction exposes stable cached and live geometry without caller boxes',()=>{
 const route=Object.freeze({...R}),state=M.createNative(route,...envelope),g=state.geometry;
 assert.equal(state.rules,M.NATIVE_RULES);assert.equal(state.layout,P.ID);
 assert.deepEqual([g.width,g.height,g.left,g.top],envelope);
 assert.deepEqual(state.view,{left:envelope[2],top:envelope[3]});
 assert.strictEqual(state.liveGeometry,g.native);assert(Object.isFrozen(state.view));assert(Object.isFrozen(g));assert(Object.isFrozen(g.spots[0]));
 assert.deepEqual(g.spots.map(p=>p.id),['1','2','3','repair','antenna']);
 for(const p of g.spots)assert.equal(M.distance(state,p.id),P.distance(state.liveGeometry,state.x,state.y,p.id,state.highlightedNear,state.collected.includes(p.id)));
 assert.equal(M.distance(state,'not-a-target'),999);
});
test('view-only updates preserve exact collision cache, motion, near, and player state',()=>{
 const initial=M.createNative(R,300,231.21875,0,0),before=JSON.stringify(initial),next=M.transition(initial,['view',0,0,500]);
 assert.strictEqual(next.geometry,initial.geometry);assert.deepEqual(next.view,{left:0,top:500});
 for(const key of ['x','y','near','highlightedNear','nearbyAt','walking','walkDistance','moveX','moveY'])assert.equal(next[key],initial[key]);
 assert.equal(next.liveGeometry.world.top,500);assert.equal(next.geometry.top,0);
 assert.equal(next.geometry.obstacles[0].top,58.873631571834025);
 assert.equal(next.liveGeometry.obstacles[0].top,58.87363157183405);
 assert.equal(JSON.stringify(initial),before);
 const id='1';assert.equal(M.distance(next,id),P.distance(P.layout(300,231.21875,0,500),next.x,next.y,id,next.highlightedNear));
 const refreshed=M.transition(next,['layout',0,300,231.21875,0,500]);
 assert.notStrictEqual(refreshed.geometry,next.geometry);assert.equal(refreshed.geometry.obstacles[0].top,58.87363157183405);
 assert.strictEqual(refreshed.liveGeometry,refreshed.geometry.native);assert.equal(refreshed.geometry.top,500);
});
test('native refresh performs exact same walkable correction policy and no gratuitous nearby update',()=>{
 const initial=M.createNative(R,...envelope),stale={...initial,near:null,x:7,y:18};
 assert.equal(M.transition(stale,['view',0,10,200]).near,null);
 assert.equal(M.transition(stale,['layout',0,...envelope]).near,null);
 const obstacle=initial.geometry.obstacles[0],blocked={...initial,x:(obstacle.left+obstacle.right)/2,y:(obstacle.top+obstacle.bottom)/2};
 assert(M.blocked(blocked,blocked.x,blocked.y));
 const view=M.transition(blocked,['view',0,10,200]);assert.equal(view.x,blocked.x);assert.equal(view.y,blocked.y);
 const refresh=M.transition(blocked,['layout',0,...envelope]);assert(!M.blocked(refresh,refresh.x,refresh.y));assert.equal(refresh.walkDistance,0);
});
test('native target transforms derive only from modeled near and collected state',()=>{
 const original=M.createNative(R,359.375,569.578125,35.3125,73.21875);
 for(const id of ['1','2','3','repair','antenna'])for(const near of [null,id])for(const collected of [[],[id]]){
  const state={...original,near,highlightedNear:near,collected};assert.equal(M.distance(state,id),P.distance(state.liveGeometry,state.x,state.y,id,near,collected.includes(id)));
 }
 const other={...original,near:'1',highlightedNear:'1',collected:['1']};
 assert.equal(M.distance(other,'1'),P.distance(other.liveGeometry,other.x,other.y,'1',null,true),'collected selector overrides nearby');
});
test('initial reset preserves logical near while clearing the energy transform',()=>{
 for(const [size,want] of [[200,'2'],[64,'1']]){
  const initial=M.createNative(R,size,size,0,0);
  assert.equal(initial.near,want);assert.equal(initial.highlightedNear,null);
  assert.equal(M.distance(initial,want),P.distance(initial.liveGeometry,initial.x,initial.y,want,null,false));
  const same=M.transition(initial,['frame',100,.1,0]);
  assert.equal(same.near,want);assert.equal(same.highlightedNear,null,'same nearest target does not re-add the cleared class');
 }
 const initial=M.createNative(R,200,200,0,0);
 const changed=M.transition({...initial,x:7,y:18},['frame',100,.1,0]);
 assert.notEqual(changed.near,initial.near);assert.equal(changed.highlightedNear,changed.near);
 assert(!Object.hasOwn(M.create(LEGACY,200,200),'highlightedNear'),'frozen v1 shape remains unchanged');
});
test('native events have a disjoint exact geometry ABI and reject every extra field',()=>{
 assert.deepEqual(M.NATIVE_ARITY,{...M.ARITY,layout:6,view:4});
 for(const e of [['layout',0,...envelope],['view',0,10,92.1875]]){
  M.validateEvent(e,M.NATIVE_PROFILE);assert.throws(()=>M.validateEvent(e),/invalid-event/);
  assert.throws(()=>M.validateEvent(e.slice(0,-1),M.NATIVE_PROFILE),/invalid-event/);
  assert.throws(()=>M.validateEvent([...e,[]],M.NATIVE_PROFILE),/invalid-event/);
 }
 assert.throws(()=>M.validateEvent(['layout',0,300,300],M.NATIVE_PROFILE),/invalid-event/);
 assert.throws(()=>M.validateEvent(['view',0,0,0],M.LAYOUT),/invalid-event/);
 assert.throws(()=>M.validateEvent(['stop',0],'unknown'),/unsupported-layout-profile/);
 for(const e of [['view',0,.001,0],['view',0,0,4097],['layout',0,300,300,0,.001]])assert.throws(()=>M.transition(M.createNative(R,...envelope),e));
});
test('browser standalone dependency is lazy for v1 and fail-closed for v2',()=>{
 const context=vm.createContext({}),source=fs.readFileSync('life1-model.js','utf8');vm.runInContext(source,context);
 assert.equal(context.Life1Prototype.create(LEGACY).layout,M.LAYOUT);
 assert.throws(()=>context.Life1Prototype.createNative(R,...envelope),/native-profile-unavailable/);
 vm.runInContext(fs.readFileSync('life1-native-geometry.js','utf8'),context);
 assert.equal(context.Life1Prototype.createNative(R,...envelope).layout,M.NATIVE_PROFILE);
});
test('native full playthroughs and origin/layout epochs replay exactly without v1 reinterpretation',()=>{
 for(const dims of [envelope,[492,644.765625,14,73.21875],[359.375,569.578125,35.3125,73.21875],[387.0625,451.109375,-13.125,321.046875]])for(const seed of [0,571,0xffffffff]){
  const route={...R,seed},trace=createTrace(route,...dims);trace.emit('view',dims[2]+.015625,dims[3]+.015625);trace.emit('layout',...dims);
  const played=trace.finish(),result=V.verifyLife1(route,played.body);assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.complete,true);assert.deepEqual(result.state,played.state);playthroughs++;
  const legacy={...route};delete legacy.life1_profile;assert.equal(V.verifyLife1(legacy,played.body).error,'identity-mismatch');
 }
 const legacy=createLegacy().finish();assert.equal(V.verifyLife1(LEGACY,legacy.body).ok,true);assert.equal(V.verifyLife1(R,legacy.body).error,'identity-mismatch');
});
console.log(JSON.stringify({suite:'life1-native-model',groups,playthroughs,browserRun:false,completeNativeParityCertified:false}));
