'use strict';
/* Source-only preparation. No browser, listener, player data or source rewriting. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),directory='tests/fixtures/evidence-finale-controller/';
const P=require('../story-plan.js'),R=require('../field-model.js'),Codec=require('../trace-codec.js');
const checkpoints=require('./fixtures/finale-checkpoints-17-state.json');
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
const performance={errors:0,impacts:0,detections:0,moves:0,seconds:0,precise:true};
const sourceKey=n=>'mkty_field_finale_'+n+'_v1',storyKey=n=>'mkty_story_plan_'+n+'_v1';
const phases=checkpoints.phases.slice(0,5);
const WRITE_MATRIX=Object.freeze({
 '8/0':['set:mkty_legacy_v1','set:mkty_legacy_v1','set:mkty_field_finale_8_v1','set:mkty_current_chapter','set:mkty_field_finale_8_v1','set:mkty_field_finale_8_v1'],
 '8/1':['set:mkty_story_plan_8_v1','set:mkty_life9_coordinates','set:mkty_spatial_report_8','remove:mkty_field_finale_8_v1','set:mkty_life8_completed_at','set:mkty_story_plan_8_v1','set:mkty_points','set:mkty_life8_awarded','set:mkty_life8','set:mkty_life8','set:mkty_current_chapter'],
 '9/0':['set:mkty_field_finale_9_v1','set:mkty_current_chapter','set:mkty_field_finale_9_v1','set:mkty_field_finale_9_v1'],
 '9/1':['set:mkty_field_finale_9_v1','set:mkty_current_chapter','set:mkty_field_finale_9_v1','set:mkty_field_finale_9_v1'],
 '9/2':['set:mkty_story_plan_9_v1','set:mkty_spatial_report_9','remove:mkty_field_finale_9_v1','set:mkty_life9_completed_at','set:mkty_story_plan_9_v1','set:mkty_points','set:mkty_life9_awarded','set:mkty_life9','set:mkty_life9','set:mkty_final_moon_points','set:mkty_points_locked_at','set:mkty_current_chapter']
});
function plan(n,precise=0){return {...P.fresh(n,9000+n,2),createdAt:1,phase:'core',done:[0,1,2,3,4,5,6,7],tasks:Object.fromEntries(Array.from({length:precise},(_,i)=>[i,{performance:{...performance}}]))};}
function seed(p,{earned=false}={}){
 const data={mkty_lang:'en',mkty_points:'100',mkty_global_lives:'9',mkty_control_sound:'no',mkty_light_fx:'yes',mkty_legacy_v1:JSON.stringify(p.provenance.legacyAtCapture)};
 const precision=p.provenance.precisionAtCapture;
 assert.equal(precision.count,precision.total);assert([0,16].includes(precision.count));
 for(let n=1;n<=8;n++)data[storyKey(n)]=JSON.stringify(plan(n,precision.count?2:0));
 if(p.chapter===9)data[storyKey(9)]=JSON.stringify(plan(9));
 data[sourceKey(p.chapter)]=JSON.stringify({version:1,n:p.chapter,phase:p.index,seed:(p.seed-p.index*7919)>>>0,seconds:0,...(earned?{}:{checkpoint:p.state})});
 return data;
}
function binding(p,provenance=p.provenance){return {version:1,chapter:p.chapter,edition:2,phase:p.index,mechanic:p.mechanic,fieldStage:4,baseSeed:(p.seed-p.index*7919)>>>0,seed:p.seed,sourceKey:sourceKey(p.chapter),storyKey:storyKey(p.chapter),route:'spatial-finale',provenance};}
function measurement(p){const data=seed(p),source=data[sourceKey(p.chapter)],story=data[storyKey(p.chapter)];return {label:p.label,chapter:p.chapter,phase:p.index,checkpointUtf8:Buffer.byteLength(Codec.stringify(p.state)),sourceUtf16:source.length*2,storyUtf16:story.length*2,bindingUtf8:Buffer.byteLength(Codec.stringify(binding(p)))};}
function resources(){
 const map=new Map([['/','index.html']]);
 for(const file of fs.readdirSync(root))if(/\.(?:js|css|png|ico|webp|svg|mp4|webmanifest)$/.test(file))map.set('/'+file,file);
 for(const folder of ['art','locales','prototypes/evidence-indexeddb',directory.replace(/\/$/,'')]){
  function walk(base){for(const ent of fs.readdirSync(path.join(root,base),{withFileTypes:true})){const file=base+'/'+ent.name;if(ent.isDirectory())walk(file);else if(/\.(?:js|mjs|css|json|png|webp|svg|jpg|jpeg|gif|woff2?|mp4)$/.test(file))map.set('/'+file,file);}}
  walk(folder);
 }
 map.set('/tests/fixtures/evidence-indexeddb/native-harness.js','tests/fixtures/evidence-indexeddb/native-harness.js');
 map.set('/tests/fixtures/finale-checkpoints-17-state.json','tests/fixtures/finale-checkpoints-17-state.json');
 return map;
}
function prepare(){
 assert.equal(checkpoints.phases.length,17);assert.equal(phases.length,5);
 assert.deepEqual(Object.values(WRITE_MATRIX).map(a=>a.length),[6,11,4,4,12]);
 const legacy=require('./evidence-indexeddb-fixture.cjs'),original=legacy.prepareInputs();
 for(const artifact of original.artifacts)legacy.verifyRecovered(artifact,artifact.bytes);
 const manifest=resources(),sourceHashes={};
 for(const file of new Set(manifest.values()))sourceHashes[file]=sha(fs.readFileSync(path.join(root,file)));
 assert.equal(sourceHashes['tests/fixtures/evidence-indexeddb/native-harness.js'],'9d22a89077d380c3701b6fd5d4fca2eb282a8a61c28494555c6968d07b989df2');
 const frozen=JSON.parse(fs.readFileSync(path.join(root,directory,'runtime-hashes.json'),'utf8'));
 for(const [file,expected]of Object.entries(frozen.hashes))assert.equal(sourceHashes[file],expected,'Unchanged reviewed runtime '+file);
 const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
 for(const match of index.matchAll(/(?:src|href)="([^"?#]+)(?:\?[^"#]*)?"/g))if(/\.(?:js|css)$/.test(match[1])&&!/^https:/.test(match[1]))assert(manifest.has('/'+match[1]),match[1]);
 for(const p of checkpoints.phases){assert(R.restore(p.state,p.mechanic,4,p.seed));assert(p.state.complete&&R.won(p.state));assert(P.restore(JSON.parse(seed(p)[storyKey(p.chapter)])));}
 const driver=fs.readFileSync(path.join(root,directory,'fixture.mjs'),'utf8');
 assert(driver.includes('originalOpen.call'));assert(driver.includes('originalComplete(rawCheckpoint)'));
 assert(driver.includes("show('evidenceFinaleResult')"));assert(!/deleteDatabase|clearDataForOrigin/.test(driver));
 assert(!index.includes('evidence-finale-controller'));assert(!index.includes('finale-completion.mjs'));
 return {sourceHashes,measurements:checkpoints.phases.map(measurement),writeMatrix:WRITE_MATRIX,nativeCutpoints:37,
  qualifications:{sourceOnly:true,unchangedIndex:true,actualGuestAwards:true,authenticatedRewards:false,originalFixtureReplay:original.qualifications,
   observedControllerSeconds:'The original 17 checkpoint fixtures preserve controller time. Trace-only replay is qualified separately; no wall-clock/timing proof is inferred.',
   boundaries:'One phase per fresh BrowserContext; no continuous handoff, no legacy pulse/final-input puzzles, no post-reload continuation.',
   observerMemory:'Fixture diagnostics and expected-value strings are test observation copies, excluded from the gate modeled slot claim; no native JavaScript heap bound.'}};
}
async function packetMeasurements(){
 const {makeFinaleCompletion,FINALE_LIMIT}=await import('../prototypes/evidence-indexeddb/finale-completion.mjs');
 const packets=checkpoints.phases.map(p=>{const data=seed(p),artifact=makeFinaleCompletion({scope:'finale-fixture:guest',run:'real-finale-'+p.chapter+'-'+p.index,checkpoint:p.state,sourceText:data[sourceKey(p.chapter)],storyText:data[storyKey(p.chapter)],binding:binding(p)});return {label:p.label,chapter:p.chapter,phase:p.index,bytes:artifact.bytes.length,components:artifact.descriptor.components};});
 assert.equal(packets.length,17);assert(packets.every(p=>p.bytes<=FINALE_LIMIT.bytes));
 // Honest scope: all eight populated task records and a real model-valid traced
 // chapter-8 field proof. Other records are metadata fixtures, not earned proofs.
 const p=phases[1],full=plan(8);for(const task of P.plan(8,2).steps)full.tasks[task.id]={kind:task.kind,attempt:0,seconds:3,hints:0,errors:0};
 const proof=R.create(8,0,P.seedFor(full,0));proof.trace=[];const act=(action,value)=>{proof.trace.push(['act',action,value??null]);R.act(proof,action,value);};
 const layout=R.layout(proof);for(let i=0;i<3;i++){act('station',i);act('angle',Math.round(layout.bearings[i]));act('sample');}act('pin',layout.source);act('locate');assert(R.restore(proof,8,0,proof.seed)?.complete);
 full.tasks[0]={...full.tasks[0],proof,performance:R.performance(proof)};
 const data=seed(p),storyText=JSON.stringify(full),normal=makeFinaleCompletion({scope:'finale-fixture:guest',run:'eight-record-shape',checkpoint:p.state,sourceText:data[sourceKey(8)],storyText,binding:binding(p)});
 const heavy=structuredClone(full);heavy.tasks[0].proof.trace=[...Array.from({length:900},()=>['act','station',0]),...heavy.tasks[0].proof.trace];
 const replay=R.create(8,0,proof.seed);for(const row of heavy.tasks[0].proof.trace)R.act(replay,row[1],row[2]);assert(replay.complete&&R.won(replay));assert(R.restore(heavy.tasks[0].proof,8,0,proof.seed));
 const heavyText=JSON.stringify(heavy);assert(P.restore(heavy));Codec.packSnapshot({[storyKey(8)]:heavyText});
 assert.throws(()=>makeFinaleCompletion({scope:'finale-fixture:guest',run:'legitimate-long-field-trace',checkpoint:p.state,sourceText:data[sourceKey(8)],storyText:heavyText,binding:binding(p)}),/finale-limit/);
 return {packets,cap:FINALE_LIMIT.bytes,populatedTaskShape:{records:8,storyUtf16:storyText.length*2,packetBytes:normal.bytes.length,qualification:'Eight populated metadata records, one real model-valid field proof; not eight natively earned task proofs.'},longFieldProof:{traceRows:heavy.tasks[0].proof.trace.length,storyUtf16:heavyText.length*2,existingCodecAccepts:true,finaleTestFormat:'refused without trimming',qualification:'Real repeatable no-op station inputs followed by winning actions; source-only replay, not native gameplay.'}};
}
module.exports={root,directory,prepare,resources,sha,seed,binding,plan,sourceKey,storyKey,checkpoints,phases,WRITE_MATRIX,packetMeasurements};
if(require.main===module)packetMeasurements().then(sizes=>console.log(JSON.stringify({...prepare(),sizes},null,2))).catch(error=>{console.error(error);process.exitCode=1;});
