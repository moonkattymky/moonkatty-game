'use strict';
/* Approved GitHub CI only. Synthetic HTTPS interception, no listening server.
 * Preparation mode hashes/parses local files and never starts a browser.
 */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createHash}=require('node:crypto');
const ROOT=path.resolve(__dirname,'..'),DIR='tests/fixtures/evidence-legacy-adoption/',ORIGIN='https://legacy-adoption-fixture.test';
const OUT=process.env.MKTY_TEST_OUTPUT||path.join(os.tmpdir(),'mkty-evidence-legacy-adoption-native');
const REPORT=path.join(OUT,'native-legacy-adoption-results.json'),CAP=1016832,G=32768;
const SOURCE='mkty_field_finale_9_v1',FOREIGN=['mkty_account_v3_314159:mkty_points','mkty_pending_v2_314159'];
const EXPECTED={
 'trace-codec.js':'baba00a4cc9a4ab309382220d3e37b7b35ddc925a582012d8d4d622c124ea865',
 'field-model.js':'94ab25d49258d5ca64cdf391eccdaadd3b3f10370b363295a4c3bd3a58aea7a8',
 'field-missions.js':'4c7f573cc0fef7d7bb8c27b599791134b0d55354c135205928ddba8aa0cae1c2',
 'field-art.js':'7d292278537c8b58ad85f47b212470f1767d66c6449134584d45224ac135827e',
 'chapter-space.js':'e8c38ea4db0db9d5054f73ce69655fb33c1af11d2a6a67418ac3250c9d905af0',
 'story-plan.js':'82d891847f5db366ec0accd8f132f1b9b0198e660054c4ea18f30932704913a6'};
const report={status:'not-run',tests:[],versions:{},sourceHashes:{},network:{fulfilled:0,rejected:[],originalLoads:[]},pageErrors:[],realms:0,reloads:0,
 qualifications:{sourceOnly:true,disposableGuest:true,
  provenance:'Original Field controller and original chapter-space save closure produce partial phase 9.2 with a trusted WAIT. Initial phase2 and completed earlier story tasks are synthetic. The old realm closes before final native localStorage bytes are read in the cold realm.',
  continuation:'One original Field restore and one trusted native WAIT. Current chapter is an exact no-op. Original source12 raw strings and absence remain unchanged. Two fresh realms restore owner revision1, with native source read only as a drift guard.',
  modifiers:'Native old realm uses genuine empty saved mods without legacy.js. Nonempty fixed-point modifiers are portable codec coverage only.',
  lifecycle:'Test-only entry fence coalesces paused blur, visibilitychange, pagehide and native interval callbacks during storage work. Deferred callbacks are invoked only after all asynchronous leases and retained/physical adapter work drain, in the same realm/epoch. This changes callback timing; it is not an unchanged production lifecycle claim.',
  instrumentation:'Separately excluded bounded observations: events4096, compact budget rows20000, transport2048, native event rows32768, native storage rows12000, input64. Actual JSON-UTF16 bytes per retained observation array and a separate64MiB aggregate/snapshot-copy cap are checked before full snapshots. Held-state immutable capture/diagnostic observations are explicitly excluded instrumentation; original snapshot code runs only after async drain. These are never included in the1016832 component ledger; no whole-fixture memory claim.',
  resources:'Fixed encoded representation ledger plus separately charged 32768-byte bridge; not JS heap/RSS, DOM, static script, engine materialization or arbitrary native localStorage allocation. Test-runner snapshots and held-state immutable diagnostic observations are separately bounded and excluded from the component ledger.',
  durability:'Native IDB completion/readback and graceful realm reload only. No power-loss, process-kill, OS eviction, site-data deletion or cross-device guarantee.',
  exclusions:'No full campaign, signed player adoption, server reward authority, cloud merge, live activation, global reset, uncooperative old-client protection or lossless rollback to old JavaScript.'}};
let browser,context,page,current='',routes,cache,originalSource,oldProof,timer,chromium;const temporaryProfiles=[];
const sha=x=>createHash('sha256').update(x).digest('hex');
function save(){fs.mkdirSync(OUT,{recursive:true});const text=JSON.stringify(report,null,2)+'\n';assert(Buffer.byteLength(text)<=16*1024*1024,'Bounded report');fs.writeFileSync(REPORT,text);}
function prepare(){
  const prototypes=fs.readdirSync(path.join(ROOT,'prototypes/evidence-indexeddb')).filter(x=>x.endsWith('.mjs')).map(x=>'prototypes/evidence-indexeddb/'+x);
  const fixtures=fs.readdirSync(path.join(ROOT,DIR)).filter(x=>/\.(?:html|mjs|js|css)$/.test(x)).map(x=>DIR+x);
  const originals=Object.keys(EXPECTED),assets=['styles.css','field-missions.css','favicon.png','art/life7-asteroid-v2.webp','art/station-details-v2.webp','moonkatty-life4-ship.webp'];
  const files=[...new Set([...prototypes,...fixtures,...originals,...assets,'tests/fixtures/evidence-indexeddb/native-harness.js'])];
  cache=new Map(files.map(file=>[file,fs.readFileSync(path.join(ROOT,file))]));routes=new Map(files.map(file=>['/'+file,file]));routes.set('/',DIR+'index.html');routes.set('/old',DIR+'old.html');
  for(const[file,hash]of Object.entries(EXPECTED))assert.equal(sha(cache.get(file)),hash,'Frozen original '+file);
  for(const[file,data]of cache)report.sourceHashes[file]=sha(data);
  report.sourceHashes['tests/evidence-legacy-adoption-ui.cjs']=sha(fs.readFileSync(__filename));
  assert(!fs.readFileSync(path.join(ROOT,'index.html'),'utf8').includes('evidence-legacy-adoption'));
  const source=cache.get(DIR+'fixture.mjs').toString();
  // Exercise the actual instrumentation statement, including its property flags.
  const nativeLogInstrumentation=source.match(/const nativePush=N\.log\.push;[^\n]+/);assert(nativeLogInstrumentation);
  const observedLog=[];require('node:vm').runInNewContext(nativeLogInstrumentation[0],{N:{log:observedLog}});
  observedLog.push({type:'portable-clone-probe'});assert.equal(Object.getOwnPropertyDescriptor(observedLog,'push').enumerable,false);
  assert.deepEqual(structuredClone(observedLog),[{type:'portable-clone-probe'}]);
  observedLog.length=32768;assert.throws(()=>observedLog.push({type:'overflow'}),/legacy-native-event-limit/);assert.equal(observedLog.length,32768);
  for(const denied of ['legacy.js','chapter-space.js','app.js','rewards-client.js','daily-retention.js','cloud-save.js','storage.js'])assert(!source.includes("script('/"+denied+"')"));
  assert(cache.get(DIR+'old.mjs').toString().includes("script('/chapter-space.js')"));
  assert(!cache.get(DIR+'old.mjs').toString().includes('.checkpoint='));assert(!cache.get(DIR+'old.mjs').toString().includes('FieldRules.create('));
  report.resources={files:cache.size,bytes:[...cache.values()].reduce((n,x)=>n+x.length,0)};assert(report.resources.bytes<4*1024*1024);
}
async function bounded(work,label,ms=60000){let t;try{return await Promise.race([work,new Promise((_,reject)=>{t=setTimeout(()=>reject(Error('Deadline: '+label)),ms);})]);}finally{clearTimeout(t);}}
async function newPage(old=false){
  const p=await context.newPage();report.realms++;p.setDefaultTimeout(15000);
  p.on('pageerror',e=>report.pageErrors.push({test:current,message:e.message}));
  await p.goto(ORIGIN+(old?'/old':'/?closed=1'));
  await p.waitForFunction(old=>old?window.legacyOldReady===true:window.legacyFixtureReady===true,old);
  assert.equal(await p.evaluate(old=>old?window.legacyOldError||null:window.legacyBootstrapError||null,old),null);
  return p;
}
async function closeContext(){if(!context)return;const target=context;await bounded(target.close(),'context close',20000);for(const profile of temporaryProfiles)if(profile.context===target)profile.closed=true;context=null;}
async function fresh(persistent=false){
  await closeContext();
  const options={viewport:{width:900,height:1000},serviceWorkers:'block'};
  if(persistent){const profile={path:fs.mkdtempSync(path.join(os.tmpdir(),'mkty-legacy-adoption-quota-')),context:null,closed:false};temporaryProfiles.push(profile);context=await bounded(chromium.launchPersistentContext(profile.path,{...options,headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--disable-back-forward-cache'],timeout:25000}),'persistent quota context',30000);profile.context=context;}
  else context=await browser.newContext(options);
  await context.route('**/*',route=>{
    const u=new URL(route.request().url()),file=u.origin===ORIGIN&&route.request().method()==='GET'?routes.get(u.pathname):null;
    if(!file){report.network.rejected.push({test:current,url:u.href,method:route.request().method()});return route.abort('blockedbyclient');}
    report.network.fulfilled++;if(Object.hasOwn(EXPECTED,file))report.network.originalLoads.push({test:current,path:file,sha256:sha(cache.get(file))});
    return route.fulfill({body:cache.get(file),contentType:({'.html':'text/html','.mjs':'application/javascript','.js':'application/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream'});
  });
  await context.routeWebSocket('**/*',socket=>{report.network.rejected.push({test:current,url:socket.url(),kind:'websocket'});socket.close();});
  const old=await newPage(true);await old.locator('#oldStart').click();await old.locator('#fieldResume').click();await old.locator('[data-field-action="wait"]').click();await old.locator('#fieldPause').click();
  oldProof=await old.evaluate(()=>H.facts());
  assert.equal(oldProof.partialCheckpointInjected,false);assert.equal(oldProof.legacyLoaded,false);assert.equal(oldProof.checkpoint.complete,false);
  assert.deepEqual(oldProof.checkpoint.trace,[['act','wait',0]]);assert.equal(oldProof.checkpoint.turn,1);assert.equal(oldProof.checkpoint.home,0);
  assert(oldProof.inputs.some(x=>x.trusted&&x.action==='wait'));assert(oldProof.storage.some(x=>x.kind==='set'&&x.key===SOURCE&&x.chapterSave));
  assert(oldProof.loads.includes('/chapter-space.js'));assert.deepEqual(Object.values(oldProof.counters),[0,0,0,0]);
  await old.close();assert(old.isClosed(),'Old writer realm actually closed before cold capture');
  page=await newPage();originalSource=await page.evaluate(()=>H.rawSource());
  assert.equal(originalSource.find(([key])=>key===SOURCE)[1],oldProof.source,'Final post-close bytes agree with paused original save');
  assert.equal((await facts()).view.state,'NEW');return facts();
}
const facts=(p=page)=>p.evaluate(()=>H.facts(true));
async function settled(state,p=page){await p.waitForFunction(()=>H.settled);const f=await facts(p);if(state)assert.equal(f.view.state,state,JSON.stringify({view:f.view,error:f.error}));assert.equal(f.workspaceDepth,0);return f;}
async function adopt(){await page.locator('#adoptionStart').click();return settled('ACTIVE');}
async function open(p=page){await p.locator('#adoptionOpen').click();await p.waitForFunction(()=>H.facts().counters.open===1);return facts(p);}
async function nativeWait(allowBlocked=false){
  // Observe native elapsed time only, then click inside a fresh real interval.
  const delay=await page.evaluate(()=>{const at=H.facts().fieldIntervalAt;return 1020-((performance.now()-at)%1000);});
  await page.waitForTimeout(delay);await page.locator('#fieldResume').click();await page.locator('[data-field-action="wait"]').click();
  await page.waitForFunction(()=>H.facts().counters.capture===1||H.facts().blocking!==null);
  const f=await settled();if(!allowBlocked)assert.equal(f.blocking,null,'Real timer preempted single-WAIT fixture');return f;
}
function check(f){
  assert.deepEqual(f.source,originalSource,'All12 exact native source values/absence preserved');
  assert.deepEqual([f.counters.award,f.counters.reward,f.counters.complete,f.counters.original],[0,0,0,0]);
  assert.equal(f.legacyLoaded,false);assert(!f.loads.includes('/legacy.js'));assert(f.jointPeak<=CAP);
  assert(f.instrumentation.total<=f.instrumentation.aggregateLimit);assert.equal(f.instrumentation.excludedFromComponentLedger,true);assert.equal(f.budget.reservations.metadata,32768);assert.equal(f.budget.reservations.adapter,393216);
  for(const e of f.budgetEvents){assert(e.jointLive<=CAP);if(e.reservations['phase-workspace']){
    for(const k of ['helper-framing','helper-hash','returned-page','stream-candidate','reload-chunk','atomic-record-workspace'])assert.equal(e.reservations[k]||0,0,'No '+k+' under original W');
  }}
  for(const r of f.facadeWrites)assert.deepEqual(r,{key:'mkty_current_chapter',bytes:2,equal:true});
  assert(!f.storageRows.some(row=>FOREIGN.includes(row.key)),'Foreign values never read by operation/controller');assert.deepEqual(f.foreignSentinels,[[FOREIGN[0],'foreign account sentinel'],[FOREIGN[1],'foreign queue sentinel']],'Independent verifier confirms exact foreign sentinel bytes');
  assert(!f.storageRows.some(row=>['set','remove'].includes(row.kind)),'Cold realm never writes native localStorage');
  assert(f.events.filter(x=>x.type==='scene-sized').every(x=>x.bytes<=20480));assert(f.counters.render<=4);
  return f;
}
function evidence(f){check(f);return {state:f.view.state,revision:f.view.revision,reason:f.view.reason,invalidated:f.view.invalidated,reconciliation:f.view.reconciliation,
  sourceHash:sha(JSON.stringify(f.source)),checkpoint:f.current,candidate:f.candidate,checkpointObservation:f.checkpointObservation,counters:f.counters,facadeWrites:f.facadeWrites,
  nativeEvents:{count:f.nativeEvents.length,sha256:sha(JSON.stringify(f.nativeEvents)),aborts:f.nativeEvents.filter(x=>x.type==='abort'),held:f.held},
  budget:{peak:f.jointPeak,live:f.budget.live+G,reservations:f.budget.reservations,events:f.budgetEvents.length,sha256:sha(JSON.stringify(f.budgetEvents))},
  instrumentation:f.instrumentation,events:f.events,transport:f.transport,inputs:f.inputs,deferred:f.deferred,quiescent:f.quiescent,physicalBusy:f.physicalBusy,retainedBytes:f.retainedBytes};}
async function retry(state='SAVED'){await page.locator('#adoptionRetry').click();return settled(state);}
async function inspectRevision(revision){const p=await newPage();const f=await settled(revision===null?'NEW':revision===0?'ACTIVE':'SAVED',p);check(f);assert.equal(f.view.revision,revision);await p.close();return {revision,head:f.view.head};}
async function test(name,fn){current=name;const row={name,status:'running'};report.tests.push(row);save();const start=Date.now();try{row.evidence=await fn();row.status='passed';row.ms=Date.now()-start;console.log('PASS legacy adoption: '+name);}catch(e){row.status='failed';row.error=e.stack;try{const f=await facts();row.failureFacts={view:f.view,error:f.error,blocking:f.blocking,counters:f.counters,events:f.events.slice(-40),transport:f.transport.slice(-12),budget:f.budget};}catch{}throw e;}finally{save();}}
async function main(){
  prepare();if(process.argv.includes('--prepare-only')){report.status='prepared';save();console.log('PASS native legacy-adoption local preparation; no browser launched');return;}
  if(process.env.GITHUB_ACTIONS!=='true'||process.env.CI!=='true')throw Error('Native legacy adoption is approved GitHub CI only; local browser/server execution is not authorized. Use --prepare-only.');
  ({chromium}=require('playwright'));assert.equal(require('playwright/package.json').version,'1.58.2');
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--disable-back-forward-cache']});
  report.versions={node:process.version,playwright:'1.58.2',chromium:browser.version()};report.status='running';
  await test('original close, lossless archive, actual WAIT, two fresh reloads',async()=>{
    await fresh();const initial=await adopt();check(initial);assert.equal(initial.view.revision,0);
    assert.equal(initial.source.find(([k])=>k==='mkty_points')[1],'004237.500');assert.notEqual(JSON.parse(initial.source.find(([k])=>k==='mkty_operations_9_v1')[1]).seed,731);
    const restored=await open();assert.deepEqual(restored.current,JSON.parse(oldProof.source).checkpoint);assert(restored.counters.bootSave>=2);
    const saved=await nativeWait();assert.equal(saved.view.state,'SAVED');assert.equal(saved.view.revision,1);assert.equal(saved.counters.capture,1);
    assert.equal(saved.current.turn,restored.current.turn+1);assert.equal(saved.current.moves,restored.current.moves+1);assert.equal(saved.current.stability,restored.current.stability-5);
    assert.deepEqual(saved.current.trace,[...restored.current.trace,['act','wait',0]]);assert.equal(saved.current.home,restored.current.home);
    const reloads=[];for(let i=0;i<2;i++){await page.close();page=await newPage();report.reloads++;const recovered=await settled('SAVED');assert.equal(recovered.view.head.head.token,saved.view.head.head.token);const opened=await open();check(opened);assert.deepEqual(opened.current,saved.current);assert.equal(opened.counters.capture,0);reloads.push(evidence(opened));}
    return {old:{controller:oldProof.checkpoint,originalSaveWrites:oldProof.storage.filter(x=>x.chapterSave).length,syntheticPrerequisites:true},initial:evidence(initial),saved:evidence(saved),reloads};
  });
  for(const target of [{stage:'source',method:'append',ordinal:0},{stage:'source',method:'read'},{stage:'owner',method:'append',ordinal:0}])await test('initial cut '+JSON.stringify(target),async()=>{
    await fresh();await page.evaluate(f=>H.fault({...f,kind:'stop'}),target);await page.locator('#adoptionStart').click();const stopped=await settled('UNSAVED');check(stopped);const visible=await inspectRevision(null);const recovered=await retry('ACTIVE');return {cut:target,prior:evidence(stopped),visible,recovered:evidence(recovered)};
  });
  for(const target of [{stage:'next',method:'append',ordinal:0},{stage:'next',method:'read'},{stage:'owner',method:'append',ordinal:1}])await test('WAIT cut '+JSON.stringify(target),async()=>{
    await fresh();await adopt();await open();await page.evaluate(f=>H.fault({...f,kind:'stop'}),target);const stopped=await nativeWait();assert.equal(stopped.view.state,'UNSAVED');assert.equal(stopped.counters.capture,1);check(stopped);const visible=await inspectRevision(0),recovered=await retry();assert.equal(recovered.counters.capture,1);assert.deepEqual(recovered.current,stopped.current);return {cut:target,prior:evidence(stopped),visible,recovered:evidence(recovered)};
  });
  await test('actual native abort preserves owner0 and retries one captured WAIT',async()=>{
    await fresh();await adopt();await open();await page.evaluate(()=>H.fault({stage:'owner',method:'append',ordinal:1,kind:'abort'}));
    const stopped=await nativeWait();assert.equal(stopped.view.state,'UNSAVED');assert(stopped.nativeEvents.some(x=>x.type==='abort-requested-after-success'));assert(stopped.nativeEvents.some(x=>x.type==='abort'));
    const visible=await inspectRevision(0),saved=await retry();return {stopped:evidence(stopped),visible,saved:evidence(saved)};
  });
  await test('held native commit, unknown result, deferred lifecycle and exact retry',async()=>{
    await fresh();await adopt();await open();await page.evaluate(()=>H.fault({stage:'owner',method:'append',ordinal:1,kind:'hold'}));
    const unknown=await nativeWait();assert.equal(unknown.view.state,'UNSAVED');assert(unknown.held?.proof?.terminal==='complete');assert(unknown.retainedBytes>0);
    const deferred=await page.evaluate(()=>H.lifecycle());assert(deferred.deferred.includes('blur')&&deferred.deferred.includes('pagehide'));assert.equal(deferred.counters.save,unknown.counters.save);assert.equal(deferred.workspaceDepth,0);
    const mark=unknown.events.length;await page.evaluate(()=>H.release());const saved=await retry();assert.equal(saved.counters.capture,1);assert.equal(saved.retainedBytes,0);assert(saved.events.slice(mark).some(x=>x.type==='lifecycle-drained'));assert.deepEqual(saved.current,unknown.current);
    return {unknown:evidence(unknown),deferredSummary:deferred,saved:evidence(saved)};
  });
  await test('timer before WAIT retains exact timer candidate and blocks input',async()=>{
    await fresh();await adopt();await open();const before=await facts();await page.locator('#fieldResume').click();await page.waitForFunction(()=>H.facts().blocking==='timer-before-WAIT');
    const blocked=await facts();check(blocked);assert.equal(blocked.counters.capture,0);assert.equal(blocked.counters.timerRejected,1);assert.equal(blocked.candidate.seconds,before.current.seconds+1);assert.deepEqual(blocked.candidate.trace,before.current.trace);assert.equal(blocked.view.revision,0);
    return {before:evidence(before),blocked:evidence(blocked)};
  });
  await test('synthetic boot mismatch quarantines before any WAIT publication',async()=>{
    await fresh();await adopt();await page.evaluate(()=>H.saveFault('boot-mismatch'));await page.locator('#adoptionOpen').click();await page.waitForFunction(()=>H.facts().blocking==='legacy-boot-normalization');const blocked=await facts();check(blocked);
    assert.equal(blocked.view.revision,0);assert.equal(blocked.counters.capture,0);assert(blocked.failureCandidate);assert.equal(blocked.quiescent,true);assert(!blocked.transport.some(x=>x.stage==='next'));
    return {syntheticCallbackFault:true,blocked:evidence(blocked)};
  });
  await test('synthetic distinct recursive save retains actual candidate and cancels publication',async()=>{
    await fresh();await adopt();await open();await page.evaluate(()=>H.saveFault('recursive-mismatch'));const blocked=await nativeWait(true);check(blocked);
    assert.equal(blocked.blocking,'legacy-reentrant-distinct-save');assert.equal(blocked.view.revision,0);assert.equal(blocked.counters.capture,1);assert(blocked.failureCandidate);assert.equal(blocked.failureCandidate.seconds,blocked.candidate.seconds+1);assert.equal(blocked.quiescent,true);assert(!blocked.transport.some(x=>x.stage==='next'));
    return {syntheticCallbackFault:true,blocked:evidence(blocked)};
  });
  await test('same principal cold contenders share one fixed owner head',async()=>{
    await fresh();const other=await newPage();await Promise.all([page.evaluate(()=>H.adopt()),other.evaluate(()=>H.adopt())]);const a=await settled(),b=await settled(undefined,other);
    assert(['ACTIVE','UNSAVED','BLOCKED'].includes(a.view.state));assert(['ACTIVE','UNSAVED','BLOCKED'].includes(b.view.state));
    const visible=await inspectRevision(0);assert(a.view.state==='ACTIVE'||b.view.state==='ACTIVE');check(a);check(b);
    await other.close();return {a:evidence(a),b:evidence(b),visible};
  });
  await test('lost acknowledgement plus source drift reconciles read-only',async()=>{
    await fresh();await adopt();await open();await page.evaluate(()=>H.fault({stage:'owner',method:'append',ordinal:1,kind:'hold'}));
    const unknown=await nativeWait();assert.equal(unknown.view.state,'UNSAVED');const before=unknown.nativeEvents.filter(x=>x.type==='transaction'&&x.mode==='readwrite').length;
    await page.evaluate(()=>{H.drift('mkty_points','drifted opaque points');H.advanceEpoch();H.release();});await page.evaluate(()=>H.retry());const blocked=await settled('QUARANTINED');
    assert.equal(blocked.nativeEvents.filter(x=>x.type==='transaction'&&x.mode==='readwrite').length,before);assert.equal(blocked.view.invalidated,true);assert(blocked.retainedBytes>0);assert.equal(blocked.checkpointObservation,'immutable-capture-only');assert.equal(blocked.counters.capture,1);
    await page.evaluate(()=>H.drift('mkty_points','004237.500'));const restored=await facts();check(restored);assert.equal(restored.view.state,'QUARANTINED');return {unknown:evidence(unknown),afterDrift:{state:blocked.view.state,reason:blocked.view.reason,reconciliation:blocked.view.reconciliation,writes:before},restored:evidence(restored)};
  });
  await test('missing selected archive dependency blocks fresh recovery',async()=>{
    await fresh();await adopt();await open();const saved=await nativeWait();assert.equal(saved.view.state,'SAVED');await page.evaluate(()=>H.mutateDependency());await page.close();page=await newPage();const blocked=await settled('BLOCKED');assert(blocked.view.reason);check(blocked);return {saved:evidence(saved),blocked:evidence(blocked)};
  });
  await test('reserve refusal retains source and leaves no controller workspace',async()=>{
    await fresh();await page.evaluate(()=>H.reserveFault('context-retained'));await page.locator('#adoptionStart').click();await page.waitForFunction(()=>H.settled);const refused=await facts();check(refused);
    assert.equal(refused.counters.open,0);assert.equal(refused.budget.reservations['phase-workspace'],0);assert.equal(refused.budget.reservations['context-retained'],0);assert.equal(refused.budget.reservations['native-read'],0);return evidence(refused);
  });
  await test('native QuotaExceededError preserves captured WAIT and owner0',async()=>{
    await fresh(true);await adopt();await open();const cdp=await context.newCDPSession(page);let quota;const quotaEvidence={status:'unverified',storageMode:'fresh disposable persistent profile',protocol:'Storage.overrideQuotaForOrigin',prior:await cdp.send('Storage.getUsageAndQuota',{origin:ORIGIN})};report.nativeQuota=quotaEvidence;
    try{
      await cdp.send('Storage.overrideQuotaForOrigin',{origin:ORIGIN,quotaSize:1});const before=await cdp.send('Storage.getUsageAndQuota',{origin:ORIGIN});quotaEvidence.override=before;assert.equal(before.overrideActive,true);save();
      const writesBefore=(await facts()).nativeEvents.filter(x=>x.type==='transaction'&&x.mode==='readwrite').length;
      const start=process.hrtime.bigint();await bounded(new Promise(resolve=>setTimeout(resolve,31000)),'real quota-cache expiry',35000);
      assert(Number(process.hrtime.bigint()-start)/1e6>30000);assert.equal((await facts()).nativeEvents.filter(x=>x.type==='transaction'&&x.mode==='readwrite').length,writesBefore);
      const stopped=await nativeWait();quota=stopped.nativeEvents.find(x=>(x.type==='request-error'||x.type==='abort')&&x.error==='QuotaExceededError');
      assert(quota,'Actual browser QuotaExceededError required; logical refusal/injected abort is insufficient');assert.equal(stopped.view.state,'UNSAVED');assert.equal(stopped.view.revision,0);check(stopped);
      await cdp.send('Storage.overrideQuotaForOrigin',{origin:ORIGIN});quotaEvidence.afterReset=await cdp.send('Storage.getUsageAndQuota',{origin:ORIGIN});assert.equal(quotaEvidence.afterReset.overrideActive,false);const saved=await retry();assert.equal(saved.counters.capture,1);Object.assign(quotaEvidence,{status:'verified',nativeError:quota});return {...quotaEvidence,stopped:evidence(stopped),saved:evidence(saved)};
    }finally{await bounded(cdp.send('Storage.overrideQuotaForOrigin',{origin:ORIGIN}),'reset quota override');await cdp.detach();}
  });
  assert.deepEqual(report.network.rejected,[]);assert(report.pageErrors.every(e=>e.test==='synthetic distinct recursive save retains actual candidate and cancels publication'&&e.message==='legacy-reentrant-distinct-save'),'Only the explicit synthetic callback exception is expected');
  assert(report.network.originalLoads.some(x=>x.path==='chapter-space.js'));assert(report.network.originalLoads.some(x=>x.path==='field-missions.js'));
  report.status='passed';save();console.log('PASS native legacy checkpoint handoff and failure matrix');
}
timer=setTimeout(()=>{report.status='failed';report.deadline='Native legacy adoption exceeded 12 minutes';save();void browser?.close();process.exitCode=1;},720000);
main().catch(e=>{report.status='failed';report.error=e.stack;console.error(e.stack);process.exitCode=1;}).finally(async()=>{clearTimeout(timer);try{await closeContext();}finally{await browser?.close();for(const profile of temporaryProfiles){if(profile.closed)fs.rmSync(profile.path,{recursive:true,force:true});else(report.cleanupBlockers||=[]).push({profile:profile.path,reason:'Closure unconfirmed; profile retained'});}save();}});
