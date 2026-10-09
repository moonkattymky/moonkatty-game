#!/usr/bin/env node
'use strict';
/* Local, pure, no sockets. Usage: node tools/bench-life1-prototype.cjs */
const os=require('node:os'),{performance}=require('node:perf_hooks');
const M=require('../life1-model.js'),V=require('../server/rewards/life1-verifier.cjs'),{DEFAULT_ROUTE:R,createTrace}=require('../tests/fixtures/life1-playthrough.cjs');
const encode=events=>JSON.stringify({version:1,route:R.route,challenge:M.routeKey(R),rules:M.RULES,layout:M.LAYOUT,initial:[360,360],events});
const complete=createTrace().finish().body;
const nearEvents=[...Array.from({length:V.LIMITS.movement},(_,i)=>['frame',i,1,1]),...Array.from({length:V.LIMITS.semantic},()=>['stop',8191]),...Array.from({length:V.LIMITS.layouts-1},(_,i)=>['layout',8191,...(i%2?[492,180]:[292,620])])];
const worst=encode(nearEvents),overMovement=encode([...Array.from({length:8193},()=>['frame',0,0,0])]);
const overBytes=' '.repeat(V.LIMITS.encodedBytes+1),unknown=encode([...nearEvents.slice(0,-1),['unknown',8191]]);
const cases=[{name:'successful-proof',body:complete,iterations:1000,expect:true,complete:true},{name:'all-work-budgets-exact',body:worst,iterations:200,expect:true,complete:false},{name:'movement-over-limit',body:overMovement,iterations:200,expect:false,error:'movement-limit'},{name:'encoded-byte-over-limit',body:overBytes,iterations:1000,expect:false,error:'encoded-byte-limit'},{name:'unknown-tail-before-replay',body:unknown,iterations:200,expect:false,error:'invalid-event'}];
const report={environment:{node:process.version,v8:process.versions.v8,platform:process.platform,arch:process.arch,cpu:os.cpus()[0]?.model,logicalCpus:os.cpus().length},clock:'performance.now monotonic milliseconds',method:'One process; 20 warmup calls per workload; JSON parsing, full validation and replay included; no browser/network; timestamps are claimed input, not measured playtime',limits:V.LIMITS,workloads:[]};
for(const item of cases){
 const checked=V.replayLife1(R,item.body);if(checked.ok!==item.expect||item.error&&checked.error!==item.error||item.complete!==undefined&&checked.complete!==item.complete)throw Error(item.name+': '+JSON.stringify(checked));
 for(let i=0;i<20;i++)V.replayLife1(R,item.body);
 const before=process.memoryUsage(),samples=[],start=performance.now();
 for(let i=0;i<item.iterations;i++){const at=performance.now();V.replayLife1(R,item.body);samples.push(performance.now()-at);}
 const elapsedMs=performance.now()-start,after=process.memoryUsage();samples.sort((a,b)=>a-b);
 const percentile=q=>samples[Math.min(samples.length-1,Math.ceil(samples.length*q)-1)];
 report.workloads.push({name:item.name,iterations:item.iterations,bytes:Buffer.byteLength(item.body),work:checked.work,result:checked.ok?'accepted '+(checked.complete?'complete':'incomplete'):checked.error,elapsedMs,meanMs:elapsedMs/item.iterations,p50Ms:percentile(.5),p95Ms:percentile(.95),maxMs:samples[samples.length-1],heapUsedDelta:after.heapUsed-before.heapUsed,rssDelta:after.rss-before.rss});
}
console.log(JSON.stringify(report,null,2));
