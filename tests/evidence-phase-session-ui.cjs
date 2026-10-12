'use strict';
/* CI-only, one continuous disposable guest realm. Model-informed native input,
   real controller time/physics; no listener, checkpoint replacement or reload. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {execFileSync}=require('node:child_process');
const F=require('./evidence-finale-controller-fixture.cjs'),R=require('../field-model.js'),Codec=require('../trace-codec.js');
const ROOT=F.root,DIR='tests/fixtures/evidence-phase-session/',ORIGIN='https://phase-session-fixture.test';
const BASELINE={head:'a8253c8af4e8023e2f8ffadbf01819b00b7a07be',tree:'454dee15a78bfe8b1804916bb0b6dec6227ff6bb'};
// Reviewed B byte pins plus the narrow prepared-operations compatibility fix.
// CI does not need the local baseline commit; the manifest pins original runtime.
const SOURCE_PINS=Object.freeze({
 'tests/fixtures/evidence-finale-controller/runtime-hashes.json':'318b5fc42c05fbfde5375ebdf50c5aa7e6c9ee81d912eeee37d4ab4a2eb71d88',
 'tests/fixtures/evidence-indexeddb/native-harness.js':'9d22a89077d380c3701b6fd5d4fca2eb282a8a61c28494555c6968d07b989df2',
 'tests/fixtures/evidence-phase-session/input-fence.mjs':'5355469e13dac0f05a5ab0533bce2ceab9c12aa2c1c9c7fd9f8fbcd81f3bd504',
 'prototypes/evidence-indexeddb/adapter.mjs':'53c3b21262aec6477a8faa1f17e17204656f5b1069c1b15ff6e029c84d1fc318',
 'prototypes/evidence-indexeddb/context-stream.mjs':'1276fae67c710b4719de9757d16bfe6d781caff13199241962a310fa9bdff700',
 'prototypes/evidence-indexeddb/contract.mjs':'71dba721f871cc3183468b931846e0f967b4a8a3bbf2285b73fae4c34a4b1ee5',
 'prototypes/evidence-indexeddb/coordinator.mjs':'7375a44920f6a4efdc2819c1738e0938389cb344cdab6014fadc0590785185f7',
 'prototypes/evidence-indexeddb/finale-completion.mjs':'5ba429f2994cc0ee013338235d3c09d2f5848eb2f2fd4e972220e616fcd0ccb3',
 'prototypes/evidence-indexeddb/finale-context-v1.mjs':'18754428cd56a3289ccc259bcf6890dd1eca8e95244ea19298a255383af32386',
 'prototypes/evidence-indexeddb/finale-phase-v2.mjs':'61f493e3e21d55c0bc103ca05fa1697f2ca65ecb4921034e299e70a2ce12cdbb',
 'prototypes/evidence-indexeddb/phase-budget.mjs':'a2276e0d0b3cc05c93f89d805a2a1f5d3c87ceff7beca2837d8656ad7c953be1',
 'prototypes/evidence-indexeddb/phase-writer-contract.mjs':'9d254b2f4e5daf28e37aaa7dea8a5c49529436f738e44de13c24f36c104a8bb8',
 'prototypes/evidence-indexeddb/prepared-operations.mjs':'f3237a0ffcef8ffa11ea7df8c1cbdba5dba9d085832784c06065065e7670b899',
 'prototypes/evidence-indexeddb/precision-observation.mjs':'89da70f192f1b3023089083df7a30a6428df67a3ba2397dafdd1a407959e8606',
 'prototypes/evidence-indexeddb/retired-story-witness.mjs':'e749027a900455c62466a49c72eb80c381d3d3738b62b7e428c59aa7a016ff8a',
 'prototypes/evidence-indexeddb/story-rewrite.mjs':'d634cdce6dc0544dda2bde9e45722c5dc1a3c0228269c30292232e5c3e3851b4',
 'prototypes/evidence-indexeddb/synthetic-completion.mjs':'95865216343e99261f72601c18d044147397352eb5774cd18d8e630ae145c63f',
 'prototypes/evidence-indexeddb/unsaved-result-gate.mjs':'c86ebe4af961a3fd1b544a5bb44233d5989704c330baf9e5b190075134121332'
});
const ORDER=[[8,0,10],[8,1,3],[9,0,9],[9,1,6],[9,2,11]],KEYS=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
const out=process.env.MKTY_TEST_OUTPUT||path.join(os.tmpdir(),'mkty-evidence-phase-session-native');
const report={status:'not-run',phases:[],input:[],network:{fulfilled:0,rejected:[]},pageErrors:[],consoleErrors:[],counts:{contexts:0,pages:0,imports:0,navigations:0,setups:0},qualifications:{
 input:'Model-informed robot using actual DOM controls and read-only model/layout observations; not human playtime evidence.',
 setup:'One synthetic prerequisite seed, including one prior 911-row field proof, two already-prepared legacy operations core records and a pre-existing same-day chapter-9 pacing skip; neither preparation rounds, other prerequisites nor unlock are earned here.',
 entry:'Test-only Chapter 8 entry calls unchanged MKTYOps.open with synthetic chapter7 completion and prepared core records. Chapter 9 calls unchanged public openMission9 through the original operations wrapper. Unlock/cinematic wrappers are excluded; original risk confirmation is exercised.',
 fence:'Test-only CSS exposes existing inactive Field and closed dialog during one pre-append hold. Trusted stale-control events are prevented and blocked diagnostics checked. The old board is already complete/inactive, so unchanged state alone is not a mutation counterfactual. Native pending-new-board OPEN_DRAIN recovery, hidden defaults and active-play fencing remain untested here; OPEN_DRAIN faults have separate source/VM coverage.',
 exclusions:'No authenticated/server rewards, alternate choices, failures/retries, reload authority, power-loss/eviction, physical devices, security certification or continuous native fault matrix.',
 memory:'Fixed encoded-representation ledger only; observer/report copies are separate, not a measured JavaScript heap bound.'}};
let browser,context,page,timer,terminal=false,held=new Set(),started=0;
function save(){fs.mkdirSync(out,{recursive:true});const text=JSON.stringify(report,null,2)+'\n';assert(Buffer.byteLength(text)<=16*1024*1024,'bounded evidence report');fs.writeFileSync(path.join(out,'native-phase-session-results.json'),text);}
const git=(...args)=>execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();
function prepare(){
 F.prepare();const routes=F.resources();
 for(const name of ['fixture.mjs','seed.mjs','fixture.css','input-fence.mjs','native-storage.js'])routes.set('/'+DIR+name,DIR+name);
 const cache=new Map([...new Set(routes.values())].map(file=>[file,fs.readFileSync(path.join(ROOT,file))]));
 const files=[...cache.keys(),...Object.keys(SOURCE_PINS),'tests/evidence-phase-session-ui.cjs','.github/workflows/evidence-indexeddb-tests.yml'];
 const sourceHashes=Object.fromEntries([...new Set(files)].sort().map(file=>[file,F.sha(fs.readFileSync(path.join(ROOT,file)))]));
 for(const [file,hash]of Object.entries(SOURCE_PINS))assert.equal(sourceHashes[file],hash,'Reviewed prototype source byte pin '+file);
 const runtime=JSON.parse(fs.readFileSync(path.join(ROOT,'tests/fixtures/evidence-finale-controller/runtime-hashes.json'),'utf8'));
 for(const [file,hash]of Object.entries(runtime.hashes))assert.equal(sourceHashes[file],hash,'Frozen reviewed runtime '+file);
 const resourceCache={files:cache.size,bytes:[...cache.values()].reduce((n,b)=>n+b.length,0)};
 assert(resourceCache.files<=200&&resourceCache.bytes<=32*1024*1024,'finite first-party resource cache');
 return {routes,cache,evidence:{baseline:BASELINE,head:git('rev-parse','HEAD'),tree:git('rev-parse','HEAD^{tree}'),workflowSha:process.env.GITHUB_SHA||null,workingTreeStatus:git('status','--porcelain'),sourceHashes,resourceCache}};
}
function input(kind,target,value){assert(!terminal,'terminal deadline');assert(report.input.length<4096,'finite native input count');report.input.push({n:report.input.length,wallMs:Date.now()-started,kind,target,...(value===undefined?{}:{value})});}
async function click(selector){input('click',selector);await page.locator(selector).click();}
const action=(name,value)=>click('[data-field-action="'+name+'"]'+(value===undefined?'':'[data-value="'+value+'"]'));
const facts=()=>page.evaluate(()=>H.facts());
async function settled(state){await page.waitForFunction(()=>H.settled===true);const f=await facts();assert.equal(f.operationError,null);assert.equal(f.captureError,null);assert.equal(f.view.state,state,JSON.stringify(f.view));assert.equal(f.physicalBusy,false);assert.equal(f.retainedBytes,0);report.lastFacts=f;save();return f;}
function healthy(s){assert(s&&!s.failed,'No failed attempt or missing model');assert.equal(s.attempt??0,0);assert.equal(s.failures??0,0);assert.equal(s.errors,0);assert(!s.trace?.some(r=>r[0]==='mkty-trace'),'No packed/trimmed controller trace');Codec.stringify(s,8192,'earned-checkpoint-limit');}
async function snapshot(){
 diagnostics();const v=await page.evaluate(()=>({model:MKTYField.snapshot(),view:H.view(),active:document.querySelector('.screen.active')?.id,dialog:document.getElementById('fieldDialog').open,focusTag:document.activeElement?.tagName}));
 assert.equal(v.view.state,'PLAYING',JSON.stringify(v.view));assert.equal(v.view.playEnabled,true);assert.equal(v.active,'fieldMission');assert.equal(v.dialog,false,'Unexpected pause is terminal');healthy(v.model);report.lastModel=v.model;return v;
}
async function steer(x,y){
 const next=new Set([...(x>.25?['ArrowRight']:x<-.25?['ArrowLeft']:[]),...(y>.25?['ArrowDown']:y<-.25?['ArrowUp']:[])]);
 for(const key of held)if(!next.has(key)){input('keyup',key);await page.keyboard.up(key);}
 for(const key of next)if(!held.has(key)){input('keydown',key);await page.keyboard.down(key);}
 held=next;
}
async function releaseKeys(){if(page&&!page.isClosed())for(const key of KEYS)try{await page.keyboard.up(key);report.safetyKeyReleases=(report.safetyKeyReleases||0)+1;}catch{}held.clear();}
async function nativeRange(name,target){
 const selector='[data-field-slider="'+name+'"]',el=page.locator(selector),before=Number(await el.inputValue());
 assert(Number.isInteger(target)&&Math.abs(target-before)<=100);await el.focus();
 for(let i=0;i<Math.abs(target-before);i++){const key=target>before?'ArrowRight':'ArrowLeft';input('range-key',selector,key);await el.press(key);}
 assert.equal(Number(await el.inputValue()),target);
 const observed=await page.evaluate(()=>({model:MKTYField.snapshot(),saved:H.facts().savedCheckpoint}));
 assert.equal(observed.model[name],target);assert.equal(observed.saved[name],target,'Native range/model/original saved source agree');
}
async function echo(){
 for(const [i,band]of [2,1,0,4,3,2].entries()){
  await action('tune',band);if(i===2)await action('filter');await click('#fieldSubmit');
  const s=(await snapshot()).model;assert.equal(s.fragments,i+1);if(i===2){assert.equal(s.event,'echo');await action('answer');}
 }
 const s=(await snapshot()).model;assert.equal(s.noise,54);assert.equal(s.choice,'answer');assert.equal(s.fragments,6);
}
async function trajectory(){
 for(let burn=0;burn<3;burn++){
  const s=(await snapshot()).model,target=R.layout(s).target;assert.equal(s.burn,burn);
  assert.deepEqual([target.angle,target.power,target.trim],[[42,47,0],[47,49,7],[64,56,-11]][burn]);
  for(const name of ['angle','power','trim'])await nativeRange(name,target[name]);
  await click('#fieldSubmit');assert.equal((await snapshot()).model.burn,burn+1,'Exactly one accepted native burn');
 }
}
async function convoy(){
 for(const [ship,cells]of [[0,[3,5,4,5,7]],[1,[4,6]],[-1,[]],[0,[8]],[1,[8]],[2,[4,5,7,8]]]){
  if(ship===-1){await action('gate');continue;}await action('select',ship);
  for(const cell of cells){await click('[data-field-cell="'+cell+'"]');const s=(await snapshot()).model;assert.equal(s.ships[ship],cell);}
 }
 const s=(await snapshot()).model;assert.deepEqual(s.ships,[8,8,8]);assert.equal(s.moves,13);assert.equal(s.gate,true);
}
async function docking(){
 const start=Date.now(),first=(await snapshot()).model,bays=R.layout(first).bays;assert.deepEqual(bays,[{x:470,y:345},{x:435,y:90},{x:115,y:100}]);
 let polls=0;
 try{
  for(let index=0;index<3;index++)while(true){
   assert(Date.now()-start<120000,'Real docking deadline; no retry/reset');const v=await snapshot(),s=v.model;polls++;
   assert(!['INPUT','TEXTAREA'].includes(v.focusTag),'Steering must reach original keyboard handler');
   if(s.docked===index+1)break;assert.equal(s.docked,index);assert.equal(s.impacts,0,'The prescribed route must clear the central wall');
   const bay=bays[index],distance=R.distance(s.ship,bay),speed=Math.hypot(s.ship.vx,s.ship.vy);
   if(distance<24){
    await steer(0,0);await action('brake');await page.waitForTimeout(100);const checked=(await snapshot()).model;
    if(R.distance(checked.ship,bay)<=30&&Math.hypot(checked.ship.vx,checked.ship.vy)<=12){await click('#fieldSubmit');assert.equal((await snapshot()).model.docked,index+1);}
   }else{
    const dx=bay.x-s.ship.x,dy=bay.y-s.ship.y,div=Math.max(Math.abs(dx),Math.abs(dy),1);await steer(dx/div,dy/div);
    if(distance<65&&speed>32)await action('brake');await page.waitForTimeout(100);
   }
  }
 }finally{await releaseKeys();}
 report.docking={polls,wallMs:Date.now()-start,inputChanges:report.input.filter(r=>['keydown','keyup'].includes(r.kind)).length,pollIntervalMs:100};
}
async function gate(){
 const before=(await snapshot()).model,startStability=before.stability;assert.equal(before.mods.stability,17,'Original modifiers retain the seeded precision-one bonus');assert.equal(startStability,87);assert.equal(startStability,70+(before.mods.stability||0));
 let steps=0;while(true){const s=(await snapshot()).model;if(s.complete)break;assert(++steps<=20,'Finite gate control sequence');
  const decision=R.layout(s).aligned(s.turn)?'launch':s.charges>0?'boost':'wait';if(decision==='launch')await click('#fieldSubmit');else await action(decision);
 }
 const s=(await snapshot()).model;assert.equal(s.home,3);assert.equal(s.stability,startStability-36);report.gate={mods:s.mods,startingStability:startStability,finalStability:s.stability,steps};
}
async function fenceProbe(){
 await page.waitForFunction(()=>H.gate.held===true);const before=await facts();assert.equal(before.view.playEnabled,false);assert.equal(before.settled,false);
 await click('#fieldResume');await click('#fieldSubmit');await page.locator('[data-field-action="tune"]').first().focus();
 input('probe-key','ArrowRight');await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>H.pendingInputObservations===0);const after=await facts();assert.equal(after.pendingInputObservations,0);
 assert.deepEqual(after.model,before.model);assert.deepEqual(after.counters,before.counters);assert.deepEqual(after.logical,before.logical);assert.deepEqual(after.native,before.native);
 assert(after.inputFence.blocked>before.inputFence.blocked);assert(after.trustedInputs.some(r=>r.isTrusted&&r.type==='click'));
 for(const event of after.trustedInputs.filter(r=>['click','keydown','keyup'].includes(r.type))){assert.equal(event.eventPhase,0,'Cancellation observed after native dispatch completes');assert.equal(event.isTrusted,true);assert.equal(event.defaultPrevented,true);assert.equal(event.playEnabled,false);}
 report.fenceProbe={before:before.inputFence,after:after.inputFence,trustedInputs:after.trustedInputs,modelUnchanged:true,originalCountersUnchanged:true};
 await click('#phaseRelease');const released=await page.evaluate(()=>({gate:H.gate,attribute:document.body.hasAttribute('data-phase-input-probe')}));assert.equal(released.gate.probe,false);assert.equal(released.gate.released,true);assert.equal(released.attribute,false);
}
function nativeEvidence(f){
 const active=new Set();let peak=0,digests=0;
 for(const row of f.nativeEvents){
  if(row.type==='transaction'&&!row.fixture){active.add(row.tx);peak=Math.max(peak,active.size);if(row.mode==='readwrite')assert.equal(row.durability,'strict');}
  if(['complete','abort'].includes(row.type))active.delete(row.tx);
  if(['abort','transaction-error','request-error'].includes(row.type)&&!row.fixture)assert.fail('Unexpected native failure '+JSON.stringify(row));
  if(row.type==='digest'){digests++;assert(row.bytes<=66048);assert.deepEqual(row.activeTransactions,[],'No digest during a physical transaction');}
  if(row.type==='request'&&!row.fixture)assert(!['getAll','getAllKeys','openCursor','openKeyCursor','count'].includes(row.kind),'No unbounded scans');
 }
 assert.equal(active.size,0);assert.equal(peak,1);assert(digests>0);
 const runs=[...new Set(f.transport.filter(r=>r.kind==='append').map(r=>r.run))];assert.equal(runs.length,7);
 const ordering=[];
 for(const run of runs){
  const writes=f.transport.filter(r=>r.kind==='append'&&r.run===run),reads=f.transport.filter(r=>r.kind==='read'&&r.run===run);
  assert(writes.length>0&&reads.length>0);assert.equal(writes.at(-1).seal,true);
  for(const write of writes){assert.equal(write.result.status,'committed');assert.equal(write.result.receipt.acknowledgement,'idb-transaction-complete');assert.equal(write.result.receipt.durability,'strict');assert(write.length<=32768);assert(write.native.some(r=>r.type==='complete'));}
  const complete=Math.max(...writes.flatMap(r=>r.native.filter(n=>n.type==='complete').map(n=>n.n)));
  for(const read of reads){assert.equal(read.result.status,'page');assert.equal(read.throughHead,writes.at(-1).result.receipt.headToken,'Readback pins the sealed native head');assert(read.native.some(r=>r.type==='transaction'&&r.mode==='readonly'));assert(read.native.some(r=>r.type==='complete'));assert(read.native.find(r=>r.type==='transaction').n>complete,'Native readback follows all run commits');}
  const readComplete=Math.max(...reads.flatMap(r=>r.native.filter(n=>n.type==='complete').map(n=>n.n)));
  const parts=run.split(':'),chapter=Number(parts[2]),phase=run.startsWith('fc1:')?0:Number(parts[3]);
  const original=f.events.find(r=>r.type==='original-start'&&r.chapter===chapter&&r.phase===phase),continued=f.events.find(r=>r.type==='explicit-continue'&&r.chapter===chapter&&r.phase===phase);
  assert(original&&continued);assert(readComplete<continued.nativeEventIndex&&continued.n<original.n,'Every context/phase readback precedes explicit continuation/original callback');
  ordering.push({run,writeComplete:complete,readComplete,continueEvent:continued.n,originalEvent:original.n});
 }
 for(const [type,want]of [['original-start',5],['original-open',5],['original-risk-confirm',1],['original-epilogue-done',1],['explicit-continue',5]])assert.equal(f.events.filter(r=>r.type===type).length,want,type);
 for(const e of f.events.filter(r=>r.type.startsWith('original-')||r.type==='explicit-continue'||r.type==='award')){assert.equal(e.physicalBusy,false);assert.equal(e.retainedBytes,0);}
 return {peakPhysicalTransactions:peak,digests,ordering};
}
function finalEvidence(f,archive){
 assert.deepEqual(f.rejectedWrites,[],'No hidden original write rejection');
 assert.equal(f.view.state,'DONE');assert.equal(f.saveAuthority.checks,f.counters.save);assert.equal(f.saveAuthority.violations,0);assert.equal(f.saveAuthority.maxRetainedBytes,0);assert.equal(f.activeTransport,0);assert(f.peakTransport<=1);assert.deepEqual(f.nativeObservationErrors,[]);assert.deepEqual([f.counters.captures,f.counters.original,f.counters.open,f.counters.award,f.counters.risk,f.counters.epilogue],[5,5,5,2,1,1]);
 assert.deepEqual([f.view.counters.begins,f.view.counters.contexts,f.view.counters.phases,f.view.counters.done,f.view.counters.retries],[1,2,5,1,0]);
 assert.equal(f.logicalSnapshot.mkty_points,'5100');assert.equal(f.logicalSnapshot.mkty_final_moon_points,'5100');
 assert.equal(f.logicalSnapshot.mkty_life7,'complete');assert.equal(f.nativeSnapshot.mkty_life7,'complete');
 assert.equal(f.active,'mission9');assert.equal(f.chapterStage,'complete');assert.equal(f.logicalSnapshot.mkty_pace_ack_9,'yes');assert.equal(f.logicalSnapshot.mkty_pace_ack_8,null);
 for(const n of [8,9]){assert.equal(f.logicalSnapshot['mkty_life'+n],'complete');assert.equal(f.logicalSnapshot['mkty_life'+n+'_awarded'],'yes');assert.equal(f.logicalSnapshot[F.sourceKey(n)],null);assert.equal(JSON.parse(f.logicalSnapshot[F.storyKey(n)]).phase,'complete');}
 assert.equal(f.perPhase.length,5);for(const [i,p]of f.perPhase.entries()){assert.deepEqual([p.chapter,p.phase,p.mechanic],ORDER[i]);assert.equal(p.originalArgumentText,p.capturedText,'Original callback receives identical lossless capture');assert.equal(p.capturedText,report.phases[i].checkpointText);}
 const equal=(a,b)=>assert.deepEqual(Object.fromEntries(Object.entries(a).sort()),Object.fromEntries(Object.entries(b).sort()));
 equal(f.logicalSnapshot,f.nativeSnapshot);assert(f.targets.length>=13);for(const target of f.targets){equal(target.logical,target.native);assert.equal(target.physicalBusy,false);assert.equal(target.retainedBytes,0);}
 const writerRow=r=>({mode:r.mode,kind:r.kind,key:r.key,value:r.value});assert.deepEqual(f.native.map(writerRow),f.logical.map(writerRow),'Every exact finite native writer record agrees with facade record');
 const counts=prefix=>ORDER.map((_,i)=>f.logical.filter(r=>r.mode===prefix+i).length);
 assert.deepEqual(counts('dispatch-'),[3,12,1,1,12]);assert.deepEqual(counts('open-'),[3,3,3,3,3]);
 // Completed prior-chapter checkpoint removal is independently observed in the
 // background ledger; it is deliberately excluded from exact writer rows.
 for(const rows of [f.allLogical,f.allNative])assert.deepEqual(rows.filter(r=>r.mode==='open-2').map(r=>({kind:r.kind,key:r.key,exact:r.exact})),[
  {kind:'remove',key:'mkty_campaign_checkpoint_8',exact:false},
  {kind:'set',key:'mkty_current_chapter',exact:true},
  {kind:'set',key:'mkty_field_finale_9_v1',exact:true},{kind:'set',key:'mkty_field_finale_9_v1',exact:true}
 ]);
 for(const n of [8,9]){
  const initial=f.setupProof.preparedOperations[n],expected=JSON.stringify({...JSON.parse(initial),phase:'complete'}),key=`mkty_operations_${n}_v1`;
  assert.equal(f.logicalSnapshot[key],expected,'Original operations completion preserves every prerequisite field');
  const rows=f.logical.filter(r=>r.key===key);assert.equal(rows.length,1,'Exactly one original operations completion write');assert.equal(rows[0].value,expected);
  assert.equal(rows[0].mode,'dispatch-'+(n===8?1:4));
 }
 for(const [mode,want]of [['entry-navigation',1],['entry-confirm',2],['epilogue',1]])assert.equal(f.logical.filter(r=>r.mode===mode).length,want);
 for(const row of f.allNative)assert.equal(row.success,true);assert.equal(f.persistent,true);assert(f.budget.peak<=1016832);
 assert.equal(archive.items.length,7);const contexts=archive.items.filter(x=>x.descriptor.run.startsWith('fc1:')),phases=archive.items.filter(x=>x.descriptor.run.startsWith('fp2:'));
 assert.equal(contexts.length,2);assert.equal(phases.length,5);for(const item of contexts)assert.equal(item.equalsCapturedContext,true,'Archive context equals the exact original chapter string');const initialContext=contexts.find(c=>c.descriptor.run.endsWith(':8'));assert.equal(initialContext.traceRows,911);assert.equal(initialContext.storyBytes,38628);assert.equal(initialContext.precision,1);
 for(const item of archive.items){assert.equal(item.head.sealed,true);assert(item.bytes<=(item.descriptor.run.startsWith('fc1:')?69660:16384));assert.match(item.sha256,/^[a-f0-9]{64}$/);}
 for(const item of phases){const parts=item.descriptor.run.split(':'),ctx=contexts.find(c=>c.descriptor.run.endsWith(':'+parts[2]));assert(ctx);assert.equal(item.reference.run,ctx.descriptor.run);assert.equal(item.reference.throughHead,ctx.head.token);assert.equal(item.equalsCaptured,true);}
 return {native:nativeEvidence(f),archive,dispatchCounts:counts('dispatch-'),openCounts:counts('open-'),targets:f.targets,budget:f.budget};
}
function diagnostics(){assert.equal(report.pageErrors.length,0,JSON.stringify(report.pageErrors));assert.equal(report.consoleErrors.filter(r=>!r.expected).length,0,JSON.stringify(report.consoleErrors));assert.equal(report.network.rejected.filter(r=>!r.expected).length,0,JSON.stringify(report.network.rejected));}
async function run(){
 assert.equal(process.env.GITHUB_ACTIONS,'true','Native session allowed only in authorized GitHub CI; no local browser/listener');assert.equal(process.env.CI,'true');
 const prepared=prepare();Object.assign(report,prepared.evidence);assert.match(report.workflowSha||'',/^[a-f0-9]{40}$/);assert.equal(report.head,report.workflowSha,'Executed checkout matches workflow SHA');
 const {chromium}=require('playwright');assert.equal(require('playwright/package.json').version,'1.58.2');started=Date.now();report.startedAt=new Date(started).toISOString();report.status='running';save();
 // Terminal watchdog: closes the only browser/context, then exits. No timed-out
 // solver is permitted to continue alongside another case or produce a pass.
 timer=setTimeout(()=>{terminal=true;report.status='failed';report.error='Terminal 300-second native session deadline';save();const kill=setTimeout(()=>process.exit(1),5000);void (async()=>{await releaseKeys();if(context)await context.close();if(browser)await browser.close();})().finally(()=>{clearTimeout(kill);process.exit(1);});},300000);
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox'],timeout:30000});report.versions={node:process.version,playwright:'1.58.2',chromium:browser.version()};
 context=await browser.newContext({viewport:{width:600,height:900},serviceWorkers:'block',reducedMotion:'reduce'});report.counts.contexts++;
 context.on('page',extra=>{report.counts.pages++;if(report.counts.pages!==1){report.pageErrors.push('Unexpected extra page');void extra.close();}});
 await context.addInitScript({content:fs.readFileSync(path.join(ROOT,DIR,'native-storage.js'),'utf8')+'\n'+fs.readFileSync(path.join(ROOT,'tests/fixtures/evidence-indexeddb/native-harness.js'),'utf8')});
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url()),file=url.origin===ORIGIN&&req.method()==='GET'&&prepared.routes.get(url.pathname);
  if(!file){report.network.rejected.push({url:url.origin+url.pathname,method:req.method(),expected:req.method()==='GET'&&url.origin==='https://telegram.org'&&url.pathname==='/js/telegram-web-app.js'});return route.abort('blockedbyclient');}
  report.network.fulfilled++;if(report.network.fulfilled>400){report.network.rejected.push({url:url.origin+url.pathname,kind:'resource-count-overflow',expected:false});return route.abort('blockedbyclient');}return route.fulfill({body:prepared.cache.get(file),contentType:({'.html':'text/html','.css':'text/css','.js':'application/javascript','.mjs':'application/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.mp4':'video/mp4'})[path.extname(file)]||'application/octet-stream'});
 });
 await context.routeWebSocket('**/*',socket=>{report.network.rejected.push({url:socket.url(),kind:'websocket',expected:false});socket.close();});
 page=await context.newPage();page.setDefaultTimeout(12000);page.setDefaultNavigationTimeout(30000);
 page.on('framenavigated',frame=>{if(frame===page.mainFrame()){report.counts.navigations++;if(report.counts.navigations!==1)report.pageErrors.push('Unexpected reload or later navigation');}});
 page.on('pageerror',error=>report.pageErrors.push(error.message));
 page.on('console',message=>{if(message.type()==='error'){const url=message.location().url,text=message.text();report.consoleErrors.push({text,url,expected:url==='https://telegram.org/js/telegram-web-app.js'&&/Failed to load resource.*(?:ERR_BLOCKED_BY_CLIENT|ERR_FAILED)/.test(text)});}});
 await page.goto(ORIGIN+'/');await page.waitForFunction(()=>!!window.MKTYSpatialFinale&&!!window.MKTYStory&&!!window.MKTYContinuation);
 await page.evaluate(()=>import('/tests/fixtures/evidence-phase-session/fixture.mjs'));report.counts.imports++;
 await page.waitForFunction(()=>window.H?.ready===true);await page.evaluate(()=>H.setup({holdFirstAppend:true}));report.counts.setups++;
 await click('#phaseStart');await settled('PLAYING');
 const solvers=[echo,trajectory,convoy,docking,gate];
 for(let i=0;i<ORDER.length;i++){
  const [chapter,phase,mechanic]=ORDER[i],phaseStart=Date.now(),inputStart=report.input.length;
  await click('#fieldResume');const initial=(await snapshot()).model;assert.deepEqual([initial.n,initial.stage,initial.seed],[mechanic,4,731+phase*7919]);assert.equal(initial.complete,false);
  await solvers[i]();const earned=(await snapshot()).model;assert(earned.complete&&R.won(earned));
  const checkpointText=Codec.stringify(earned,8192,'earned-checkpoint-limit');
  report.phases.push({chapter,phase,mechanic,wallMs:Date.now()-phaseStart,controllerSeconds:earned.seconds,traceRows:earned.trace.length,traceJsonBytes:Buffer.byteLength(Codec.stringify(earned.trace,8192)),checkpointBytes:Buffer.byteLength(checkpointText),nativeInputs:report.input.length-inputStart,checkpointText});save();
  await click('#fieldSubmit');if(i===0)await fenceProbe();const captured=await settled('READY');assert.equal(captured.counters.original,i);assert.equal(captured.counters.captures,i+1);
  await click('#phaseContinue');const state=i===1?'WAIT_CHAPTER9':i===4?'EPILOGUE_READY':'OPEN_READY',continued=await settled(state);assert.equal(continued.counters.original,i+1);
  if(i===1){assert.equal(continued.active,'mission8');assert.equal(continued.chapterStage,'complete');await click('#phaseEntry');await settled('WAIT_CONFIRM');await click('#paceGo');await settled('OPEN_READY');}
  if(i<4){await click('#phaseOpen');await settled('PLAYING');}
 }
 await click('[data-legacy-choice="done"]');let f=await settled('DONE');const archive=await page.evaluate(()=>H.inspect());f=await facts();
 report.archiveObserved=archive;report.lastFacts=f;save();
 report.evidence=finalEvidence(f,archive);report.setupProof=f.setupProof;
 assert.equal(f.setupProof.seedCount,1);assert.equal(f.setupProof.importCount,1);assert.equal(f.setupProof.context911.traceRows,911);assert.equal(f.setupProof.precision.count,1);assert.equal(f.setupProof.precision.total,1);assert.equal(f.setupProof.facadeEqualsNative,true);assert.equal(f.setupProof.persistent,true);assert.equal(f.setupProof.initialSourceCheckpoints,0);
 for(const n of [8,9]){
  assert.deepEqual(f.setupProof.initialSources[n],{version:1,n,phase:0,seed:731,seconds:0});
  assert.deepEqual(JSON.parse(f.setupProof.preparedOperations[n]),{version:1,n,seed:731,round:3,phase:'core',input:null,confirmed:false,actions:0,hints:0,errors:0,seconds:0});
 }
 assert.equal(f.setupProof.preparationRoundsEarnedHere,false);
 assert.deepEqual(report.counts,{contexts:1,pages:1,imports:1,navigations:1,setups:1});diagnostics();assert(!terminal);report.wallMs=Date.now()-started;report.status='passed';save();
}
if(require.main===module){
 if(process.argv.includes('--prepare')){const {evidence}=prepare();console.log(JSON.stringify({status:'source-prepared',nativeRun:false,...evidence},null,2));}
 else run().catch(async error=>{report.status='failed';report.error=error.stack;process.exitCode=1;if(page&&!page.isClosed())try{report.lastFacts=await facts();}catch{}save();console.error(error);}).finally(async()=>{
  await releaseKeys();for(const target of [context,browser])if(target)try{await target.close();}catch(error){report.status='failed';(report.cleanupErrors??=[]).push(error.message);process.exitCode=1;}
  clearTimeout(timer);try{diagnostics();}catch(error){report.status='failed';report.lateDiagnosticFailure=error.message;process.exitCode=1;}save();if(report.status==='passed')console.log('PASS: one continuous native guest 8→9 session; five earned phases, two context heads, five phase heads.');
 });
}
module.exports={prepare};
