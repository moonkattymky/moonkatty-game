'use strict';
// Saved synthetic CI output only. No browser, sockets, source-controller writes or live records.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {validateBaselineRefusal}=require('./life1-recording-baseline-refusal-fixture.cjs');
const dir=path.join(__dirname,'fixtures/life1-recording-refusal-evidence');
const fixtures=['historical.json','later-start.json'].map(name=>JSON.parse(fs.readFileSync(path.join(dir,name),'utf8')));
let checks=0;
for(const original of fixtures){
 const initial=validateBaselineRefusal(original);assert.equal(initial.ok,true);assert.equal(initial.evidence.oldReloadGatePassed,false);assert.equal(initial.evidence.wholePrefixByteEqualityVerified,false);checks+=3;
 const mutations=[
  d=>{const offset=Number.MAX_SAFE_INTEGER+1;for(const item of d.geometryObservations){item.snapshot.snapshotMs+=offset;const r=item.snapshot.recorded;if(r){if(r.now)r.now+=offset;if(r.lastFrame)r.lastFrame+=offset;}}const f=d.firstGeometryRefusal;f.wrapperDispatchMs+=offset;f.event[1]+=offset;f.snapshot.snapshotMs+=offset;f.snapshot.recorded.now+=offset;f.snapshot.recorded.lastFrame+=offset;for(const e of f.acceptedTail)e[1][1]+=offset;},
  d=>d.base='other' ,d=>d.lane='other',d=>d.runtimeReady=true,d=>d.authoritativeAdmission=true,
  d=>d.cases.push('unexpected pass'),d=>d.failures.push('unrelated failure'),d=>d.failures=[],
  d=>d.firstGeometryRefusal=null,d=>d.geometryObservations.pop(),
  d=>d.geometryObservations[2].snapshot.world.height+=1e-10,
  d=>d.geometryObservations[3].snapshot.sourceCache.height=495.84375,
  d=>d.firstGeometryRefusal.snapshot.recorded.now+=1,
  d=>d.firstGeometryRefusal.event[1]=d.geometryObservations[2].snapshot.snapshotMs,
  d=>d.firstGeometryRefusal.wrapperDispatchMs+=1,
  d=>d.geometryObservations[4].snapshot.snapshotMs+=1,
  d=>d.geometryObservations[1].snapshot.recorded.lastFrame=1,
  d=>d.firstGeometryRefusal.acceptedTail[0][1][2]=0,
  d=>d.firstGeometryRefusal.acceptedTail[1][1][1]+=1,
  d=>d.firstGeometryRefusal.acceptedTail[2][1][1]=d.firstGeometryRefusal.acceptedTail[0][1][1],
  d=>d.firstGeometryRefusal.acceptedTail[5][1][2]='2',
  d=>d.geometryObservations[3].snapshot.animation.active.push('animation'),
  d=>d.geometryObservations[3].snapshot.recorded.geometry.obstacles[0].left+=1e-10,
  d=>d.failures[0]=d.failures[0].replace('unsettled-live-size','different-error'),
  d=>d.failures[0]=d.failures[0].replace('"observations":122','"observations":123'),
  d=>d.failures[0]=d.failures[0].replace(/"bytes":\d+/, '"bytes":0'),
  d=>d.failures[0]=d.failures[0].replace(/"bytes":\d+/, '"bytes":196609'),
  d=>d.failures[0]=d.failures[0].replace(/"bytes":\d+/, '"bytes":3915.5'),
  d=>d.failures[0]=d.failures[0].replace(':55:11',':56:11')
 ];
 for(const mutate of mutations){const d=structuredClone(original);mutate(d);assert.equal(validateBaselineRefusal(d).ok,false);checks++;}
}
console.log(JSON.stringify({passed:true,checks,actualCIFixtures:2,rejectedMutations:58,
 fixtureSha256:['historical.json','later-start.json'].map(name=>({name,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,name))).digest('hex')})),
 browserExecuted:false,oldReloadGatePassed:false}));
