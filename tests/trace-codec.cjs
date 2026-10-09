const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('../trace-codec.js');
const clone=v=>structuredClone(v),bytes=v=>Buffer.byteLength(typeof v==='string'?v:JSON.stringify(v));
const big=Array.from({length:12000},(_,i)=>['tick',1,(i%2001-1000)/1000,(i*13%2001-1000)/1000,i%2===0,i%3===0]);
const p=C.packTrace(big);assert.equal(p[0][0],'mkty-trace');assert.equal(p[0][1],1);assert.equal(p[0][2],12000);assert.equal(p[0][3],12000);assert(bytes(p)<bytes(big)/3);assert.deepEqual(C.unpackTrace(p),big);assert.deepEqual(C.packTrace(p),p);
const prefix=C.packTrace(big.slice(0,1000)),tail=big.slice(1000);assert.deepEqual(C.unpackTrace([...prefix,...tail]),big);assert.deepEqual(C.packTrace([...prefix,...tail]),p);
assert.deepEqual(C.packTrace([]),[]);assert.deepEqual(C.packTrace([['act','scan']]),[['act','scan']]);
const exact=[['act','move',17],['tick',2,0.123,0.456],['act','valve',[1,0.12345678912345678]],['tick',1,-0,0.10000000000000002,true,false],['tick',3,Number.MIN_VALUE,Number.MAX_VALUE,false,true],['tick',1,-32.768,32.767],['tick',1,-32.769,32.768],['act','opaque',{z:-0,a:['ü','🌙','\\\"\n',null]}],['tick',1,0,0,true],['act','extra',true,'preserve'],['act','__proto__'],['unknown',1]];
const mixed=[...big.slice(0,100),...exact,...big.slice(100,200)];assert.deepEqual(C.unpackTrace(C.packTrace(mixed)),mixed);assert(Object.is(C.unpackTrace(C.packTrace(mixed))[103][2],-0));
const unusual=JSON.parse('{"trace":[],"__proto__":{"polluted":true},"value":"🌙"}');unusual.trace=mixed;const snap={mkty_story_plan_1_v1:JSON.stringify(unusual),plain:'00123',bad:'{bad',primitive:'"a"',formatted:' { "x" : "\\u00e9", "blank" : true } ',nullish:'null'};
const compact=C.packSnapshot(snap),expanded=C.unpackSnapshot(compact);assert.deepEqual(JSON.parse(expanded.mkty_story_plan_1_v1),JSON.parse(snap.mkty_story_plan_1_v1));for(const k of ['plain','bad','primitive','formatted','nullish'])assert.equal(compact[k],snap[k]);assert.equal({}.polluted,undefined);
const nested={outer:[{trace:big,unchanged:{trace:'not an array'}}],trace:42,other:-0};const proof=C.packProof(nested);assert.deepEqual(C.unpackProof(proof),nested);assert(Object.is(C.unpackProof(proof).other,-0));
for(const s of ['a','ü','🌙','\ud800','\udc00','\ud800x','𝄞x'])assert.equal(C.utf8Bytes(s),bytes(s));assert.equal(C.PROTOCOL,'mkty-trace-v1');
const browser={};vm.createContext(browser);vm.runInContext(fs.readFileSync(require.resolve('../trace-codec.js'),'utf8'),browser);assert.equal(browser.MKTYTraceCodec.PROTOCOL,C.PROTOCOL);assert.deepEqual(JSON.parse(JSON.stringify(browser.MKTYTraceCodec.unpackTrace(browser.MKTYTraceCodec.packTrace(big)))),big);assert.deepEqual(JSON.parse(JSON.stringify(browser.MKTYTraceCodec.unpackProof(proof))),JSON.parse(JSON.stringify(nested)));
function fails(fn,pattern=/invalid|too_large|snapshot/){assert.throws(fn,pattern);}
const modify=fn=>{const t=clone(p);fn(t[0]);return t;};
for(const bad of [modify(h=>h[1]=2),modify(h=>h.push(0)),modify(h=>h[2]++),modify(h=>h[3]++),modify(h=>h[2]=25001),modify(h=>h[3]=200001),modify(h=>h[4]+='='),modify(h=>h[4]=h[4].slice(1)),modify(h=>h[4]='!'+h[4].slice(1)),modify(h=>h[4]=h[4].slice(0,-4))])fails(()=>C.unpackTrace(bad));
for(const bad of [[['act','scan'],...p],[...p,...p],[['act','x',p]],[["mkty-trace",99,1,1,'AAAA']],[["tick",200001,0,0]],[["tick",0,0,0]],[["tick",1.5,0,0]],[["tick",1,NaN,0]],[['act','x',undefined]],[['act','x',Infinity]]])fails(()=>C.packTrace(bad));
function framed(data,rows=1,ticks=1){return [['mkty-trace',1,rows,ticks,Buffer.from(data).toString('base64')]];}
for(const data of [[1,4,1,0,0,0,0],[2,16,1,0,0,0,0],[3,0,1,0,0,0,0],[1,0,0,0,0,0,0],[1,0,129,0,0,0,0,0],[1,0,128,128,128,128,0,0,0,0],[0,255,255,127],[0,3,255,255,255],[0,3,192,128,48]])fails(()=>C.unpackTrace(framed(data)));
const nan=Buffer.alloc(11);nan[0]=1;nan[1]=1;nan[2]=1;nan.writeDoubleLE(NaN,3);fails(()=>C.unpackTrace(framed([...nan,0,0])));
const overlong=Buffer.from([0,2,48,32]);fails(()=>C.unpackTrace(framed(overlong,1,1))); // Literal says zero ticks; header cannot invent one.
for(const s of ['AA=A','A===','AB==','AAB=','====','AA==\n'])fails(()=>C.unpackTrace([['mkty-trace',1,1,0,s]]));
fails(()=>C.packTrace(big,{maxRows:100}));fails(()=>C.unpackTrace(p,{maxTicks:100}));fails(()=>C.unpackTrace(p,{maxBytes:1000}));fails(()=>C.packTrace(big,{maxRows:25001}));
assert.deepEqual(C.packTrace([0],{maxBytes:3}),[0]);
fails(()=>C.packTrace(Array.from({length:25001},()=>['act','scan'])));
fails(()=>C.packTrace([['act','x','z'.repeat(65536)]]));
let deep=0;for(let i=0;i<70;i++)deep=[deep];fails(()=>C.packTrace([['act','x',deep]]));const cyclic=[];cyclic.push(cyclic);fails(()=>C.packTrace(cyclic));
const invalidLiteral=Buffer.from(JSON.stringify(['act','x',['mkty-trace',1,1,1,'AAAA']]));fails(()=>C.unpackTrace(framed([0,invalidLiteral.length,...invalidLiteral],1,0)));
// One entry has an exclusive encoded cap; aggregate is JSON escaped UTF-8.
assert.equal(C.packSnapshot({x:'a'.repeat(179999)}).x.length,179999);fails(()=>C.packSnapshot({x:'a'.repeat(180000)}),/snapshot_too_large/);fails(()=>C.packSnapshot({x:'ü'.repeat(90000)}),/snapshot_too_large/);fails(()=>C.packSnapshot({a:'"'.repeat(100000),b:'"'.repeat(100000)}),/snapshot_too_large/);
assert.equal(C.unpackSnapshot({x:'a'.repeat(1000000)}).x.length,1000000);fails(()=>C.unpackSnapshot({x:'a'.repeat(1000001)}),/snapshot_too_large/);
const large={x:JSON.stringify({trace:big})};assert(bytes(large.x)>180000);assert(bytes(C.packSnapshot(large).x)<180000);assert.deepEqual(C.unpackSnapshot(large),large);assert.deepEqual(C.unpackSnapshot(C.packSnapshot(large)),large);
const tooMany=[...big,...big];const hugeProof={tasks:[{trace:C.packTrace(tooMany)},{trace:C.packTrace(tooMany)}]};assert(bytes(hugeProof)<1000000);fails(()=>C.unpackProof(hugeProof),/proof_too_large/);fails(()=>C.packProof({trace:tooMany,other:'x'.repeat(200000)}),/proof_too_large/);
const crowded={a:JSON.stringify({trace:C.packTrace(tooMany)}),b:JSON.stringify({trace:C.packTrace(tooMany)}),c:JSON.stringify({trace:C.packTrace(tooMany)})};assert(bytes(crowded)<1000000);fails(()=>C.unpackSnapshot(crowded),/snapshot_too_large/);
// Inclusive aggregate/decoded limits and pre-allocation escaping bounds.
const exactAggregate={a:'a'.repeat(174992),b:'b'.repeat(174993)};assert.equal(bytes(exactAggregate),350000);assert.deepEqual(C.packSnapshot(exactAggregate),exactAggregate);fails(()=>C.packSnapshot({...exactAggregate,b:exactAggregate.b+'b'}),/snapshot_too_large/);
const exactDecoded={a:'a'.repeat(999992),b:'b'.repeat(999993)};assert.equal(bytes(exactDecoded),2000000);assert.deepEqual(C.unpackSnapshot(exactDecoded),exactDecoded);fails(()=>C.unpackSnapshot({...exactDecoded,b:exactDecoded.b+'b'}),/snapshot_too_large/);
const exactProof={x:'a'.repeat(999992)};assert.equal(bytes(exactProof),1000000);assert.deepEqual(C.unpackProof(exactProof),exactProof);fails(()=>C.unpackProof({x:exactProof.x+'a'}),/proof_too_large/);
assert.equal(C.stringify(C.packProof({x:'a'.repeat(399992)})).length,400000);fails(()=>C.packProof({x:'a'.repeat(399993)}),/proof_too_large/);
fails(()=>C.stringify({x:'\u0000'.repeat(100000)},400000),/trace_too_large/);fails(()=>C.packSnapshot({x:'\u0000'.repeat(179999),y:'\u0000'.repeat(179999)}),/snapshot_too_large/);
const frozenRows=Object.freeze(big.slice(0,100).map(row=>Object.freeze(row.slice())));assert.deepEqual(C.unpackTrace(C.packTrace(frozenRows)),frozenRows);
(async()=>{const esm=(await import('../server/rewards/models/trace-codec.mjs')).default;assert.equal(esm.PROTOCOL,C.PROTOCOL);assert.deepEqual(esm.packTrace(mixed),C.packTrace(mixed));assert.deepEqual(esm.unpackTrace(p),big);console.log(JSON.stringify({test:'trace-codec',rawBytes:bytes(big),packedBytes:bytes(p),rows:12000,exactNumbers:true,hostileFramesRejected:true,runningBudgets:true}));})().catch(e=>{console.error(e);process.exitCode=1;});
