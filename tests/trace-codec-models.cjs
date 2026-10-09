const assert=require('node:assert/strict'),fs=require('node:fs');
const C=require('../trace-codec.js'),Field=require('../field-model.js'),Flight=require('../expedition-model.js');
const fixture=JSON.parse(fs.readFileSync(require.resolve('./fixtures/chapter1-proof.json'),'utf8'));
assert.deepEqual(C.unpackProof(JSON.parse(C.stringify(C.packProof(fixture.proof)))),fixture.proof);
function replayField(rows,s){for(const row of rows){if(row[0]==='act')Field.act(s,row[1],row[2]);else for(let i=0;i<row[1];i++)Field.tick(s,1/60,{x:row[2],y:row[3]});}return s;}
function replayFlight(rows,p,r){for(const row of rows){if(row[0]==='act')Flight.action(r,p,row[1]);else for(let i=0;i<row[1];i++)Flight.step(r,p,{x:row[2],y:row[3],boost:row[4],action:row[5]},.02);}return {version:1,profile:p,run:r};}
const fieldRows=[],flightRows=[];
for(let i=0;i<12000;i++){
 const x=((i*13)%41-20)/1000,y=((i*17)%37-18)/1000;
 fieldRows.push(['tick',1,x,y]);flightRows.push(['tick',1,x,y,i%3===0,i%5===0]);
 if(i%997===0){fieldRows.push(['act','brake',null]);flightRows.push(['act',i%2?'scan':'emp']);}
}
const field=replayField(fieldRows,Field.create(6,1,123));assert(!field.failed&&!field.complete);assert.equal(fieldRows.filter(r=>r[0]==='tick').length,12000);
const flight=replayFlight(flightRows,Flight.profile(),Flight.create(456,'rescue',1,Flight.profile()));assert.equal(flight.run.phase,'flight');assert(flight.run.ship.hull>0);
const snapshot={mkty_field_finale_8_v1:C.stringify({...field,trace:fieldRows}),mkty_expeditions_v1:C.stringify({...flight,trace:flightRows})};
const packed=C.packSnapshot(snapshot);assert(C.utf8Bytes(snapshot.mkty_field_finale_8_v1)>180000);assert(C.utf8Bytes(snapshot.mkty_expeditions_v1)>180000);assert(C.utf8Bytes(packed.mkty_field_finale_8_v1)<180000);assert(C.utf8Bytes(packed.mkty_expeditions_v1)<180000);assert(C.utf8Bytes(C.stringify(packed))<=350000);
const transport=JSON.parse(C.stringify(packed)),restored=C.unpackSnapshot(transport);assert.deepEqual(restored,snapshot);
const oldField=JSON.parse(snapshot.mkty_field_finale_8_v1),newField=JSON.parse(restored.mkty_field_finale_8_v1),oldFlight=JSON.parse(snapshot.mkty_expeditions_v1),newFlight=JSON.parse(restored.mkty_expeditions_v1);
assert.deepEqual(replayField(newField.trace,Field.create(6,1,123)),field);
const replayed=replayFlight(newFlight.trace,Flight.profile(),Flight.create(456,'rescue',1,Flight.profile()));assert.deepEqual(replayed,flight);
// Resume with the actual model restore paths, then append fresh rows after download.
const a=Field.restore(oldField,6,1,123),b=Field.restore(newField,6,1,123);assert(a&&b);const fa=Flight.restore(oldFlight),fb=Flight.restore(newFlight);assert(fa.run&&fb.run);fa.trace=oldFlight.trace;fb.trace=newFlight.trace;
for(let i=0;i<600;i++){
 const x=(i%19-9)/1000,y=(i%23-11)/1000;
 const f=['tick',1,x,y],e=['tick',1,x,y,!!(i%2),!!(i%3)];a.trace.push(f);b.trace.push(f.slice());fa.trace.push(e);fb.trace.push(e.slice());replayField([f],a);replayField([f],b);replayFlight([e],fa.profile,fa.run);replayFlight([e],fb.profile,fb.run);
 if(i===301){const act=['act','brake',null];a.trace.push(act);b.trace.push(act.slice());replayField([act],a);replayField([act],b);}
}
assert.deepEqual(a,b);assert.deepEqual(fa,fb);
const second=C.unpackSnapshot(C.packSnapshot({field:C.stringify(a),flight:C.stringify(fa)}));assert.deepEqual(JSON.parse(second.field),a);assert.deepEqual(JSON.parse(second.flight),fa);
// A short raw trace stays raw; the actual HTTP serializer still preserves -0.
for(const trace of [[['tick',1,-0,0]],[['act','value',-0]],[['act','value',{negative:-0,normal:0}]]]){
 const proof={tasks:[{state:{trace}}]};const compact=C.packProof(proof);assert.equal(compact.tasks[0].state.trace[0][0],trace[0][0]);assert.deepEqual(C.unpackProof(JSON.parse(C.stringify(compact,400000))),proof);
}
let rand=91234;const rng=()=>{rand=(Math.imul(rand,1664525)+1013904223)>>>0;return rand/4294967296;};
for(let n=0;n<100;n++){
 const rows=[];for(let i=0;i<60;i++){const x=i%4===0?-0:i%4===1?(Math.floor(rng()*2001)-1000)/1000:rng()*2-1,y=i%5===0?Number.MIN_VALUE:rng()*2-1;rows.push(i%9===0?['act','value',{x,label:'🌙 '+i}]:i%2?['tick',1+i%4,x,y]:['tick',1+i%4,x,y,i%3===0,i%7===0]);}
 assert.deepEqual(C.unpackProof(JSON.parse(C.stringify(C.packProof({trace:rows})))),{trace:rows});
}
console.log(JSON.stringify({test:'trace-codec-models',varyingTickRowsPerModel:12000,fieldRaw:C.utf8Bytes(snapshot.mkty_field_finale_8_v1),fieldPacked:C.utf8Bytes(packed.mkty_field_finale_8_v1),flightRaw:C.utf8Bytes(snapshot.mkty_expeditions_v1),flightPacked:C.utf8Bytes(packed.mkty_expeditions_v1),continuationTicks:600,goldenProof:true,negativeZeroHTTP:true,randomizedRoundtrips:100}));
