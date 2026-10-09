'use strict';
/* Offline expected-value checks. Never starts a browser or socket and never
 * uses recorded object rectangles to construct model state or proof inputs. */
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const P=require('../life1-native-geometry.js');
const fixture=require('./fixtures/life1-native-observations.json');
const fields=['left','top','right','bottom','width','height'];
let groups=0,nativeFields=0,nativeDistances=0;
const test=(name,fn)=>{fn();groups++;console.log('PASS: '+name);};
const exactRect=(a,b)=>fields.forEach(k=>{assert(Object.is(a[k],b[k]),`${k}: ${a[k]} !== ${b[k]}`);nativeFields++;});
const next=(value,up=true)=>{const b=new ArrayBuffer(8),v=new DataView(b);v.setFloat64(0,value);let bits=v.getBigUint64(0);bits+=(value>0)===up?1n:-1n;v.setBigUint64(0,bits);return v.getFloat64(0);};

test('source and engine profile are explicit immutable research bindings',()=>{
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync('docs/prototypes/life1-source-manifest.json')).digest('hex'),'3b1f9f8bbf9b871e675d58449a9d6d91fb5fab20268bc4e260c3c151df228821');
 assert.equal(P.ID,'life1-css-3b1f9f8b-chromium145-settled-v2');
 assert.equal(fixture.provenance.browserVersion,'145.0.7632.6');
 assert(Object.isFrozen(P.BOUNDS));
});
test('retained independently recorded native fields and distances match exactly',()=>{
 assert.equal(fixture.rows.length,3);
 for(const row of fixture.rows){
  assert.equal(row.browserVersion,'145.0.7632.6');
  const w=row.world,g=P.layout(w.width,w.height,w.left,w.top);
  row.obstacles.forEach((o,i)=>{exactRect(g.rawObstacles[i],o.raw);assert.deepEqual(g.obstacles[i],o.cached);assert.deepEqual(g.obstacles[i],o.native);});
  exactRect(P.playerRect(g,...row.browserPosition),row.player);
  row.spots.forEach(s=>exactRect(P.spotRect(g,s.id),s));
  for(const query of row.proximity){
   exactRect(P.playerRect(g,query.x,query.y),query.player);exactRect(P.spotRect(g,'1'),query.spot);
   assert(Object.is(P.distance(g,query.x,query.y,'1'),query.browser));
   assert.equal(P.distance(g,query.x,query.y,'1')<.24,query.browserReach);nativeDistances++;
  }
  assert.equal(P.blocked(g,row.boundary.x,row.boundary.y),row.boundary.browser);
 }
 assert.equal(nativeDistances,9);
});
test('strict collision boundaries reject exact edges and admit next representable interiors',()=>{
 for(const row of fixture.rows){const w=row.world,g=P.layout(w.width,w.height,w.left,w.top);
  for(const r of g.obstacles){const x=(r.left+r.right)/2,y=(r.top+r.bottom)/2;
   assert(!P.blocked(g,r.left,y));assert(!P.blocked(g,r.right,y));assert(!P.blocked(g,x,r.top));assert(!P.blocked(g,x,r.bottom));
   assert(P.blocked(g,next(r.left),y));assert(P.blocked(g,next(r.right,false),y));assert(P.blocked(g,x,next(r.top)));assert(P.blocked(g,x,next(r.bottom,false)));
   assert(!P.blocked(g,next(r.left,false),y));assert(!P.blocked(g,next(r.right),y));assert(!P.blocked(g,x,next(r.top,false)));assert(!P.blocked(g,x,next(r.bottom)));
  }
 }
});
test('source float percentage, bottom anchor, and absolute expression order stay intact',()=>{
 assert.equal(P.percentageLayout(357.375,10.961),39.171875);
 assert.equal(Math.trunc(357.375*10.961/100*64)/64,39.15625);
 assert.equal(P.percentageFloat(78,-85),-66.30000305175781);
 assert(!Object.is(P.percentageLayout(64,-.0001),-0));
 const a=P.layout(300,231.21875,0,0),b=P.layout(300,231.21875,0,500);
 assert.equal(a.obstacles[0].top,58.873631571834025);assert.equal(b.obstacles[0].top,58.87363157183405);
 const g=P.layout(300,644.765625,0,0);assert.equal(g.localSpots[0].top,1+642.765625-P.percentageLayout(642.765625,20)-62);
 assert.notEqual(g.localSpots[0].top,1+P.percentageLayout(642.765625,80)-62);
});
test('four-number envelope rejects off-grid, unbounded, omitted and additional geometry',()=>{
 for(const value of [undefined,null,true,'300',[],{},NaN,Infinity,-Infinity,63.984375,4096.015625,300.001])for(const i of [0,1]){
  const a=[300,231.21875,0,0];a[i]=value;assert.throws(()=>P.layout(...a),/unsupported-layout-envelope/);
 }
 for(const value of [undefined,null,true,'0',[],{},NaN,Infinity,-Infinity,-4096.015625,4096.015625,.001])for(const i of [2,3]){
  const a=[300,231.21875,0,0];a[i]=value;assert.throws(()=>P.layout(...a),/unsupported-layout-envelope/);
 }
 for(const args of [[],[300,300],[300,300,0],[300,300,0,0,[]]])assert.throws(()=>P.layout(...args),/unsupported-layout-envelope/);
 for(const args of [[64,64,-4096,-4096],[4096,4096,4096,4096],[359.375,569.578125,35.3125,73.21875]])assert(Object.isFrozen(P.layout(...args).obstacles[0]));
});
test('nearby and collected target transforms derive from fixed source constants',()=>{
 const g=P.layout(359.375,569.578125,35.3125,73.21875);
 for(const id of ['1','2','3','repair','antenna']){
  const normal=P.spotRect(g,id),near=P.spotRect(g,id,id),collected=P.spotRect(g,id,id,true);
  assert(near.width>normal.width);assert.equal(collected.width,normal.width*.25);assert.equal(collected.height,normal.height*.25);
  assert.deepEqual(collected,P.spotRect(g,id,null,true));
  for(const x of [7,10.961,50,90])for(const y of [18,40.231,68,88])for(const n of [null,id])assert(Number.isFinite(P.distance(g,x,y,id,n)));
 }
});
console.log(JSON.stringify({suite:'life1-native-geometry',groups,nativeFields,nativeDistances,browserRun:false,completeNativeParityCertified:false}));
