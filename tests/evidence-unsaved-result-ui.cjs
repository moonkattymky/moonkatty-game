'use strict';
/* Native Chromium, GitHub CI only. All resources are intercepted at a synthetic
 * HTTPS origin. No listener, gameplay controller execution, account data, archive deletion, runtime
 * activation, production navigation, cloud call or reward action is involved.
 * Native storage outcomes and injected boundary controls are labelled separately.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {chromium} = require('playwright');
const F = require('./evidence-unsaved-result-fixture.cjs');
const ORIGIN = 'https://unsaved-result-fixture.test';
const out = process.env.MKTY_TEST_OUTPUT || path.join(os.tmpdir(),'mkty-unsaved-result-native');
const report = {status:'not-run',tests:[],events:[],network:{fulfilled:0,rejected:[]},
  boundary:{syntheticOnly:true,realIndexedDB:true,gameplay:false,rewards:false,sourceOnly:true,noRuntimeActivation:true,
    contexts:'fresh synthetic BrowserContext per case; quota uses a fresh disposable persistent profile; reload explicitly reuses its existing origin',
    strictDurability:'native request hint, not a power-loss guarantee',reload:'inspection only; no resume or navigation',
    nativeAllocation:'excluded from modeled ownership',legacyNotifications:'synthetic; no production clear/restore policy inferred'}};
let browser, context, current, pageSerial = 0;
const temporaryProfiles = [];
function save() {fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'native-unsaved-result-results.json'),JSON.stringify(report,null,2)+'\n');}
// Node owns every barrier deadline, including when the browser delays timer delivery.
async function bounded(promise,label,milliseconds=15000) {
  let timer;
  try {return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Node fixture deadline: '+label)),milliseconds);})]);}
  finally {clearTimeout(timer);}
}
const evaluate = (p,fn,arg) => bounded(p.evaluate(fn,arg),'browser evaluation');
const wait = (p,fn) => bounded(p.waitForFunction(fn,null,{timeout:12000}),'browser condition');
const routeFiles = new Map([
  ['/','tests/fixtures/evidence-unsaved-result/index.html'],
  ...['fixture.css','fixture.mjs','copy.json'].map(file=>['/fixture/'+file,'tests/fixtures/evidence-unsaved-result/'+file]),
  ['/fixture/native-harness.js','tests/fixtures/evidence-indexeddb/native-harness.js'],
  ...F.moduleFiles.map(file=>['/'+file,file]),
  ...['field-model','trace-codec','story-plan'].map(name=>['/'+name+'.js',name+'.js'])
]);
async function page() {
  const p = await bounded(context.newPage(),'new page'), id = ++pageSerial;
  p.setDefaultTimeout(12000);
  await p.exposeFunction('nativeEvidence',event=>{report.events.push({test:current,page:id,...event});});
  p.on('pageerror',error=>{report.events.push({test:current,page:id,type:'pageerror',message:error.message});});
  await bounded(p.goto(ORIGIN+'/'),'fixture document');await wait(p,()=>window.fixtureReady===true);return p;
}
async function closeContext(target,label) {
  await bounded(target.close(),label);
  const profile=temporaryProfiles.find(record=>record.context===target);if(profile)profile.closed=true;
}
async function fresh(config={},device={},persistent=false) {
  if(context)await closeContext(context,'close prior synthetic context');
  const options={viewport:{width:390,height:844},serviceWorkers:'block',...device};
  if(persistent){
    const profile={path:fs.mkdtempSync(path.join(os.tmpdir(),'mkty-unsaved-result-quota-')),context:null,closed:false};temporaryProfiles.push(profile);
    const launch=chromium.launchPersistentContext(profile.path,{...options,headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox'],timeout:25000})
      .then(value=>{profile.context=value;return value;});
    context=await bounded(launch,'fresh disposable persistent quota profile',30000);
  }else context=await bounded(browser.newContext(options),'fresh context');
  await context.route('**/*',async route=>{
    const url=new URL(route.request().url()),file=url.origin===ORIGIN&&routeFiles.get(url.pathname);
    if(!file){report.network.rejected.push(url.origin+url.pathname);return route.abort('blockedbyclient');}
    const ext=path.extname(file),contentType=ext==='.html'?'text/html':ext==='.css'?'text/css':ext==='.json'?'application/json':'application/javascript';
    report.network.fulfilled++;return route.fulfill({contentType,body:fs.readFileSync(path.join(F.root,file))});
  });
  const p=await page();await evaluate(p,config=>H.setup(config),config);return p;
}
const facts=p=>evaluate(p,()=>H.facts());
const snapshot=p=>evaluate(p,()=>H.snapshot());
const accept=p=>evaluate(p,()=>H.accept());
const retry=p=>evaluate(p,()=>H.retry());
const go=p=>evaluate(p,()=>H.continue());
function retained(f,state) {
  assert.equal(f.view.state,state);assert.equal(f.view.retained,true);assert.deepEqual(f.view.summary,f.original.summary);
  assert.deepEqual(f.counters,{captures:1,navigation:0,gameplay:0,rewards:0});
  assert(f.peakCalls<=1);assert.equal(f.view.diagnostics.captureCount,1);assert.equal(f.view.diagnostics.maxOutstanding,1);
  assert(f.view.diagnostics.modeledPeakBytes<=1016832);assert(f.view.diagnostics.modeledEnvelopeBytes<=1016832);
}
function disabled(v) {assert.equal(v.continueEnabled,false);}
function ordinalCalls(f) {return f.calls.filter(row=>row.kind==='append').map(row=>row.ordinal);}
function nativeEvents(events) {
  const active=new Set();let peak=0;
  for(const row of events) {
    if(row.type==='transaction'&&!row.fixture){active.add(row.tx);peak=Math.max(peak,active.size);if(row.mode==='readwrite')assert.equal(row.durability,'strict');}
    if(['complete','abort'].includes(row.type))active.delete(row.tx);
    if(row.type==='digest'){assert(row.bytes<=66048);assert.equal(row.activeTransactions.length,0);}
    if(row.type==='request'&&!row.fixture)assert(!['getAll','getAllKeys','openCursor','openKeyCursor','count'].includes(row.kind));
  }
  assert(peak<=1,'one physical nonfixture transaction at a time per page');return {peakPhysicalTransactions:peak};
}
async function exactArchive(p) {
  const inspection=await evaluate(p,()=>H.inspect());
  const item=inspection.items.find(row=>row.descriptor.run==='synthetic-run-1');
  assert(item?.head.sealed);assert.equal(item.sha256,(await facts(p)).original.sha256);return item;
}
async function test(name,fn) {
  current=name;const row={name,status:'running'};report.tests.push(row);save();const start=Date.now();
  try {row.details=await bounded(fn(),name,180000);row.status='passed';row.milliseconds=Date.now()-start;console.log('PASS unsaved-result: '+name);}
  catch(error){row.status='failed';row.error=error.stack;throw error;}
  finally{save();}
}
async function controlledUnknown(p,terminal) {
  await evaluate(p,()=>{void H.accept();});
  await wait(p,()=>!!H.controlled);
  const proof=await bounded(p.evaluate(async()=>{
    const {barrier,timer,operationId}=H.controlled;
    const [native,due]=await Promise.all([barrier,timer.due]);
    return {native,due,operationId,captured:timer.captured,settled:H.settled,diagnostics:H.adapter.diagnostics,view:H.view()};
  }),'actual native terminal plus actual watchdog deadline');
  assert.equal(proof.native.terminal,terminal);assert.equal(proof.native.mode,'readwrite');assert.equal(proof.native.fixture,false);
  assert.equal(proof.native.queued,1);assert.equal(proof.captured,1);assert.equal(proof.due.delay,100);assert.equal(proof.settled,false);
  assert(proof.native.createdEvent<proof.native.nativeEvent&&proof.native.nativeEvent<proof.native.heldEvent);
  assert.equal(proof.diagnostics.id,proof.operationId);assert.equal(proof.diagnostics.terminal,null);
  assert(!proof.diagnostics.events.includes('watchdog'));disabled(proof.view);
  await evaluate(p,()=>H.controlled.timer.release());
  const v=await bounded(p.evaluate(()=>H.pending),'original gate outcomeUnknown');assert.equal(v.state,'UNSAVED');assert.equal(v.reason,'terminal-unobserved');
  assert.equal(v.checkpoint.nextOrdinal,1);assert.equal(v.ownedUnknown,true);disabled(v);
  const timerEvents=await evaluate(p,id=>H.N.log.filter(row=>row.timerId===id),proof.due.timerId);
  for(const type of ['watchdog-captured','watchdog-native-due','watchdog-delivered'])assert.equal(timerEvents.filter(row=>row.type===type).length,1);
  const dueEvent=timerEvents.find(row=>row.type==='watchdog-native-due').n,deliveredEvent=timerEvents.find(row=>row.type==='watchdog-delivered').n;
  assert(dueEvent<deliveredEvent&&proof.native.heldEvent<deliveredEvent);
  return {tx:proof.native.tx,terminal,operationId:proof.operationId,createdEvent:proof.native.createdEvent,nativeEvent:proof.native.nativeEvent,
    heldEvent:proof.native.heldEvent,timerId:proof.due.timerId,dueEvent,deliveredEvent,
    method:'reviewed terminal harness; original watchdog delivered only after actual native terminal and actual timer deadline'};
}

(async()=>{
  if(process.env.GITHUB_ACTIONS!=='true'||process.env.CI!=='true')throw Error('Native fixture runs only in authorized GitHub CI; no local browser or listener is allowed.');
  const prepared=F.prepare();report.copy=prepared.qualifications;report.sourceHashes=prepared.sourceHashes;
  report.commit=process.env.GITHUB_SHA;assert.match(report.commit||'',/^[a-f0-9]{40}$/);
  report.versions={node:process.version,playwright:require('playwright/package.json').version};assert.equal(report.versions.playwright,'1.58.2');
  report.sourceHashes['tests/evidence-unsaved-result-ui.cjs']=F.sha(fs.readFileSync(__filename));
  browser=await bounded(chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']}),'launch pinned Chromium',30000);
  report.versions.chromium=browser.version();report.status='running';

  for(const totalBytes of [1024,196608])await test('actual commit and exact readback: '+totalBytes+' bytes, explicit Continue only',async()=>{
    const p=await fresh({totalBytes});disabled(await go(p));assert.equal((await accept(p)).state,'READY');
    const f=await facts(p);retained(f,'READY');const count=Math.ceil(totalBytes/65536);assert.deepEqual(ordinalCalls(f),Array.from({length:count},(_,i)=>i));
    assert.equal(f.view.checkpoint.nextOrdinal,count);assert.equal(f.view.checkpoint.offset,totalBytes);assert.equal(f.view.diagnostics.admissions,2);
    assert.equal(f.view.diagnostics.wholeArtifactCopies,1);assert.equal(f.readCount,count);assert.equal(f.view.phase,'verify');
    const archived=await exactArchive(p);assert.equal(archived.head.token,f.view.checkpoint.expectedHead);
    for(const row of f.calls.filter(row=>row.kind==='append')){assert.equal(row.result.status,'committed');assert.equal(row.result.receipt.acknowledgement,'idb-transaction-complete');assert.equal(row.result.receipt.durability,'strict');assert.equal(row.nativeTransactions.length,1);const tx=row.nativeTransactions[0];assert.equal(tx.mode,'readwrite');assert.equal(tx.durability,'strict');assert.equal(tx.terminal,'complete');assert(tx.createdEvent<tx.terminalEvent);}
    const before=await snapshot(p);assert.equal((await retry(p)).state,'READY');assert.deepEqual(await snapshot(p),before);
    assert.equal((await go(p)).state,'CONTINUED');await go(p);await retry(p);
    const end=await facts(p);assert.deepEqual(end.counters,{captures:1,navigation:1,gameplay:0,rewards:0});assert.deepEqual(ordinalCalls(end),ordinalCalls(f));
    return {segments:count,sha256:archived.sha256,checkpoint:f.view.checkpoint,modeled:f.view.diagnostics,...nativeEvents(await evaluate(p,()=>H.N.log))};
  });
  await test('caller mutation cannot change private result, summary or archived bytes',async()=>{
    const p=await fresh();await evaluate(p,()=>{void H.accept();H.mutateCaller();});await wait(p,()=>H.settled);
    const f=await facts(p);retained(f,'READY');const item=await exactArchive(p);assert.equal(item.sha256,f.original.sha256);
    return {sha256:item.sha256,summary:f.view.summary,capturedBytes:f.view.diagnostics.capturedBytes};
  });
  for(const ordinal of [0,1,2])await test('observed native abort at ordinal '+ordinal+' preserves prefix and retries exact candidate',async()=>{
    const p=await fresh({abortOrdinal:ordinal});assert.equal((await accept(p)).state,'UNSAVED');const failed=await facts(p);retained(failed,'UNSAVED');
    assert.equal(failed.view.checkpoint.nextOrdinal,ordinal);assert.equal(failed.view.checkpoint.offset,ordinal*65536);disabled(failed.view);
    assert.deepEqual(ordinalCalls(failed),Array.from({length:ordinal+1},(_,i)=>i));
    const events=await evaluate(p,()=>H.N.log);const requested=events.find(row=>row.type==='abort-requested-after-success');assert(requested);
    assert(events.some(row=>row.tx===requested.tx&&row.type==='abort'));assert(!events.some(row=>row.tx===requested.tx&&row.type==='complete'));
    await go(p);assert.deepEqual((await facts(p)).counters,failed.counters);
    const before=await snapshot(p);assert.equal(before.segments.length,ordinal);
    assert.equal((await retry(p)).state,'READY');const after=await facts(p);retained(after,'READY');
    assert.deepEqual(ordinalCalls(after),[...Array.from({length:ordinal+1},(_,i)=>i),...Array.from({length:3-ordinal},(_,i)=>ordinal+i)]);
    const attempts=after.calls.filter(row=>row.kind==='append'&&row.ordinal===ordinal);assert.equal(attempts.length,2);
    const withoutResult=({result,operationId,nativeTransactions,...rest})=>rest;assert.deepEqual(withoutResult(attempts[0]),withoutResult(attempts[1]));
    const final=await snapshot(p);for(const [key,value] of before.segments)assert.deepEqual(final.segments.find(row=>row[0]===key)?.[1],value);
    const item=await exactArchive(p);await go(p);assert.equal((await facts(p)).counters.navigation,1);
    return {nativeAbortTransaction:requested.tx,failedOrdinal:ordinal,appendOrdinals:ordinalCalls(after),sha256:item.sha256};
  });
  for(const terminal of ['complete','abort'])await test('controlled unknown, late native '+terminal+', explicit exact retry',async()=>{
    const p=await fresh({unknown:{ordinal:1,terminal}}),proof=await controlledUnknown(p,terminal);
    const failed=await facts(p);retained(failed,'UNSAVED');assert(failed.retainedBytes>0);const checkpoint=failed.view.checkpoint;
    assert.equal((await retry(p)).state,'UNSAVED');assert.deepEqual((await facts(p)).view.checkpoint,checkpoint);disabled(await go(p));
    assert.equal(await evaluate(p,tx=>H.N.releaseTerminals(tx),proof.tx),1);await wait(p,()=>H.adapter.diagnostics.terminal!==null);
    const late=await facts(p);retained(late,'UNSAVED');assert.deepEqual(late.view.checkpoint,checkpoint);assert.deepEqual(ordinalCalls(late),[0,1]);
    assert.equal((await retry(p)).state,'READY');const resolved=await facts(p);retained(resolved,'READY');assert.deepEqual(ordinalCalls(resolved),[0,1,2]);
    const exact=resolved.calls.filter(row=>row.kind==='exact-retry');assert.equal(exact.length,2);assert.equal(exact[0].result.reason,'busy');
    assert.equal(exact[1].result.status,terminal==='complete'?'duplicate':'committed');assert.equal(exact[1].result.receipt.ordinal,1);
    assert.equal(exact[1].result.receipt.acknowledgement,'idb-transaction-complete');assert.equal(exact[0].nativeTransactions.length,0);assert.equal(exact[1].nativeTransactions.length,1);assert.equal(exact[1].nativeTransactions[0].terminal,'complete');assert.notEqual(exact[1].nativeTransactions[0].tx,proof.tx);assert.equal(resolved.retainedBytes,0);
    const item=await exactArchive(p);await go(p);assert.equal((await facts(p)).counters.navigation,1);
    return {proof,retryOutcome:exact[1].result.status,exactRetryTransaction:exact[1].nativeTransactions[0],appendOrdinals:ordinalCalls(resolved),sha256:item.sha256};
  });
  await test('interrupted readback retries verification only with the same sealed head',async()=>{
    const p=await fresh({refuseRead:2});assert.equal((await accept(p)).state,'UNSAVED');const failed=await facts(p);retained(failed,'UNSAVED');
    assert.equal(failed.view.phase,'verify');assert.equal(failed.view.checkpoint.nextOrdinal,3);assert.deepEqual(ordinalCalls(failed),[0,1,2]);
    const before=await snapshot(p);assert.equal((await retry(p)).state,'READY');const after=await facts(p);retained(after,'READY');
    assert.deepEqual(ordinalCalls(after),[0,1,2]);assert.deepEqual(after.view.checkpoint,failed.view.checkpoint);assert.deepEqual(await snapshot(p),before);
    const reads=after.calls.filter(row=>row.kind==='read');assert.equal(reads.length,4);assert.equal(reads[1].request.afterOrdinal,undefined);
    assert(reads.every(row=>row.request.throughHead===failed.view.checkpoint.expectedHead));await exactArchive(p);
    return {injectedBoundary:'operation-timeout before second page dispatch; not a native read failure',readCalls:after.readCount,appendOrdinals:ordinalCalls(after),checkpoint:after.view.checkpoint};
  });
  await test('duplicate Retry and Continue with reentrant throwing navigation invoke once',async()=>{
    const p=await fresh({abortOrdinal:0,pauseRead:1,continueReentry:true,continueThrow:true});await accept(p);
    await evaluate(p,()=>{document.getElementById('retry').click();document.getElementById('retry').click();H.duplicateRetry=H.gate.retry();});
    await wait(p,()=>!!H.readBarrier);const pending=await facts(p);assert.equal(pending.view.state,'VERIFYING');disabled(pending.view);
    assert.equal((await evaluate(p,()=>H.duplicateRetry)).reason,'busy');assert.equal(pending.counters.navigation,0);
    await evaluate(p,()=>H.releaseRead());await wait(p,()=>H.settled);retained(await facts(p),'READY');
    await evaluate(p,()=>{H.armReaderReentry();H.continue();H.continue();document.getElementById('continue').click();});
    const f=await facts(p);assert.equal(f.view.state,'CONTINUED');assert.equal(f.view.reason,'navigation-threw');assert.equal(f.counters.navigation,1);
    assert.equal((await evaluate(p,()=>H.nestedContinue)).reason,'busy');assert.equal((await evaluate(p,()=>H.callbackReentry)).reason,'busy');
    assert.deepEqual(ordinalCalls(f),[0,0,1,2]);return {navigationCalls:1,gameplay:0,rewards:0,appendOrdinals:ordinalCalls(f),peakCalls:f.peakCalls};
  });
  for(const kind of ['A-B-A','source'])await test('source invalidation '+kind+' before Continue is irreversible',async()=>{
    const p=await fresh();await accept(p);const before=await snapshot(p),original=(await facts(p)).view.checkpoint;
    assert.equal((await evaluate(p,kind=>H.switch(kind),kind)).state,'STALE');disabled(await go(p));await retry(p);const f=await facts(p);retained(f,'STALE');
    assert.deepEqual(f.view.checkpoint,original);assert.deepEqual(await snapshot(p),before);return {kind,generation:f.live.generation,sourceIdentity:f.live.sourceIdentity};
  });
  await test('context switch after native append prevents checkpoint advance',async()=>{
    const p=await fresh({switchAfterAppend:0});assert.equal((await accept(p)).state,'STALE');const f=await facts(p);retained(f,'STALE');
    assert.equal(f.view.checkpoint.nextOrdinal,0);assert.deepEqual(ordinalCalls(f),[0]);assert.equal(f.readCount,0);
    assert.equal((await snapshot(p)).segments.length,1);disabled(await go(p));return {storedOldScopeSegments:1,gateCheckpoint:f.view.checkpoint};
  });
  for(const mode of ['switchAfterRead','throwAfterRead'])await test(mode+' at first native page settlement requests no second page',async()=>{
    const p=await fresh({[mode]:1});assert.equal((await accept(p)).state,'STALE');const f=await facts(p);retained(f,'STALE');
    assert.equal(f.readCount,1);assert.equal(f.view.checkpoint.nextOrdinal,3);assert.deepEqual(ordinalCalls(f),[0,1,2]);disabled(await go(p));
    assert.equal(f.view.diagnostics.readbackBytes,0);return {boundary:mode,readCalls:1,retainedCapturedBytes:f.view.diagnostics.capturedBytes};
  });
  await test('stale unknown keeps exact ownership blocked with no rebind or new write',async()=>{
    const p=await fresh({unknown:{ordinal:1,terminal:'complete'}}),proof=await controlledUnknown(p,'complete');
    await evaluate(p,()=>H.switch('A-B-A'));await evaluate(p,tx=>H.N.releaseTerminals(tx),proof.tx);await wait(p,()=>H.adapter.diagnostics.terminal==='complete');
    await retry(p);disabled(await go(p));const f=await facts(p);retained(f,'STALE');assert(f.retainedBytes>0);assert.deepEqual(ordinalCalls(f),[0,1]);
    assert.equal(f.calls.filter(row=>row.kind==='exact-retry').length,0);return {proof,retainedUnknownBytes:f.retainedBytes,checkpoint:f.view.checkpoint};
  });
  await test('unrelated synthetic legacy old-write/clear/restore preserve gate and archive',async()=>{
    const p=await fresh();await accept(p);const original=await facts(p),before=await snapshot(p);
    for(const kind of ['old-writer','clear','restore']){const v=await evaluate(p,kind=>H.notifyLegacy(kind,false),kind);assert.equal(v.state,'READY');assert.deepEqual(v.checkpoint,original.view.checkpoint);assert.deepEqual(v.summary,original.view.summary);assert.deepEqual(await snapshot(p),before);}
    retained(await facts(p),'READY');return {notifications:['old-writer','clear','restore'],synthetic:true,noProductionEventIntegration:true,archiveUnchanged:true};
  });
  for(const kind of ['old-writer','clear','restore'])await test('synthetic '+kind+' source invalidation disables Continue without deleting archive',async()=>{
    const p=await fresh();await accept(p);const before=await snapshot(p);assert.equal((await evaluate(p,kind=>H.notifyLegacy(kind,true),kind)).state,'STALE');
    disabled(await go(p));const f=await facts(p);retained(f,'STALE');assert.deepEqual(await snapshot(p),before);return {notification:kind,explicitSyntheticGenerationChange:true,archiveUnchanged:true};
  });
  for(const state of ['prefix','unknown','sealed'])await test('reload after '+state+' is read-only inspection, never automatic resume',async()=>{
    const p=await fresh(state==='prefix'?{abortOrdinal:1}:state==='unknown'?{unknown:{ordinal:1,terminal:'complete'}}:{});
    let proof;if(state==='unknown'){proof=await controlledUnknown(p,'complete');await evaluate(p,tx=>H.N.releaseTerminals(tx),proof.tx);await wait(p,()=>H.adapter.diagnostics.terminal==='complete');}else await accept(p);
    const before=await snapshot(p);await bounded(p.reload(),'actual page reload');await wait(p,()=>window.fixtureReady===true);await evaluate(p,()=>H.setup());
    const empty=await facts(p);assert.equal(empty.view.state,'EMPTY');assert.equal(empty.view.retained,false);assert.equal(empty.counters.captures,0);disabled(empty.view);
    const inspection=await evaluate(p,()=>H.inspect());assert.equal(inspection.gate.state,'EMPTY');assert.equal(inspection.items.length,1);
    assert.equal(inspection.items[0].head.sealed,state==='sealed');if(state==='sealed')assert.equal(inspection.items[0].sha256,empty.original.sha256);
    assert.deepEqual(await snapshot(p),before);await retry(p);disabled(await go(p));const after=await facts(p);
    assert.deepEqual(after.calls,[]);assert.deepEqual(after.counters,{captures:0,navigation:0,gameplay:0,rewards:0});
    return {prior:state,inspection,proof:proof||null,gracefulReload:true};
  });
  await test('native quota refusal preserves result and exact candidate until explicit retry',async()=>{
    // Match the accepted adapter quota fixture: a real disk-backed temporary
    // profile and an acknowledged archive already present before the override.
    // Incognito completion is not evidence of disk-quota enforcement.
    let p=await fresh({run:'quota-prior',totalBytes:1024},{},true);
    const cdp=await context.newCDPSession(p),evidence={status:'unverified',protocol:'Storage.overrideQuotaForOrigin',
      storageMode:'fresh disposable persistent profile',profile:{persistent:true,freshTemporaryDirectory:true,origin:ORIGIN},seededPriorArchive:false,attempts:[]};
    report.nativeQuota=evidence;report.tests.at(-1).details=evidence;save();
    try {
      evidence.profile.browserVersion=await bounded(cdp.send('Browser.getVersion'),'persistent quota browser version');save();
      assert.match(evidence.profile.browserVersion.product,/Chrome|Chromium/);
      const empty=await snapshot(p);evidence.profile.initialStoreCounts=Object.fromEntries(Object.entries(empty).map(([name,rows])=>[name,rows.length]));
      assert.equal(empty.heads.length,0);assert.equal(empty.segments.length,0);save();
      assert.equal((await accept(p)).state,'READY');const seeded=await facts(p);retained(seeded,'READY');
      evidence.seededPriorArchive=true;evidence.priorCheckpoint=seeded.view.checkpoint;evidence.priorSha256=seeded.original.sha256;
      evidence.prior=await bounded(cdp.send('Storage.getUsageAndQuota',{origin:ORIGIN}),'native quota prior usage');save();
      await bounded(cdp.send('Storage.overrideQuotaForOrigin',{origin:ORIGIN,quotaSize:1}),'native quota override');
      evidence.override=await bounded(cdp.send('Storage.getUsageAndQuota',{origin:ORIGIN}),'native quota override status');save();assert.equal(evidence.override.overrideActive,true);
      // Chromium can temporarily approve writes from cached bucket authority.
      // The cited public revision expires that authority after 30 seconds; the
      // tested binary revision was unavailable for source inspection. This is
      // bounded no-write preparation, never evidence that native quota failed.
      evidence.cachePreparation={requestedMs:31000,sourceCacheLimitMs:30000,
        sourceRevision:'1c9524c5d3627044b0cf0a0b679978e82b702279',
        sourceHeader:'https://chromium.googlesource.com/chromium/src/+/1c9524c5d3627044b0cf0a0b679978e82b702279/content/browser/indexed_db/instance/bucket_context.h',
        sourceImplementation:'https://chromium.googlesource.com/chromium/src/+/1c9524c5d3627044b0cf0a0b679978e82b702279/content/browser/indexed_db/instance/bucket_context.cc',
        qualification:'Source revision differs from tested Chromium; actual native QuotaExceededError remains mandatory.',
        before:await evaluate(p,()=>({writes:H.N.log.filter(row=>row.type==='transaction'&&row.mode==='readwrite').length,physical:H.N.physical}))};
      assert.equal(evidence.cachePreparation.before.physical,0);save();
      const preparationStart=process.hrtime.bigint();
      await bounded(new Promise(resolve=>setTimeout(resolve,31000)),'quota cache no-write preparation',35000);
      evidence.cachePreparation.elapsedMs=Number(process.hrtime.bigint()-preparationStart)/1e6;save();
      assert(evidence.cachePreparation.elapsedMs>30000,'measured Node monotonic interval must exceed the source cache lifetime');
      evidence.cachePreparation.after=await evaluate(p,()=>({writes:H.N.log.filter(row=>row.type==='transaction'&&row.mode==='readwrite').length,physical:H.N.physical}));
      evidence.cachePreparation.usageAfter=await bounded(cdp.send('Storage.getUsageAndQuota',{origin:ORIGIN}),'quota preparation usage');save();
      assert.deepEqual(evidence.cachePreparation.after,evidence.cachePreparation.before,'no native write or active transaction during cache preparation');
      assert.equal(evidence.cachePreparation.usageAfter.overrideActive,true);assert.equal(evidence.cachePreparation.usageAfter.quota,1);
      let observed=false;
      for(let attempt=0;attempt<16;attempt++) {
        p=await page();await evaluate(p,run=>H.setup({run}),'quota-run-'+attempt);
        const before=await snapshot(p),v=await accept(p),f=await facts(p),events=await evaluate(p,()=>H.N.log);
        const nativeError=events.find(row=>['request-error','abort'].includes(row.type)&&row.error==='QuotaExceededError');
        const observation={attempt,state:v.state,reason:v.reason,phase:v.phase,checkpoint:v.checkpoint,appendOrdinals:ordinalCalls(f),
          appendTransactions:f.calls.filter(row=>row.kind==='append').map(row=>({ordinal:row.ordinal,result:row.result.status,reason:row.result.reason||null,nativeTransactions:row.nativeTransactions})),
          nativeError:nativeError||null};evidence.attempts.push(observation);save();
        observation.usage=await bounded(cdp.send('Storage.getUsageAndQuota',{origin:ORIGIN}),'quota attempt usage');save();
        if(!nativeError){assert.equal(v.state,'READY','a logical/injected failure is not native quota evidence');continue;}
        observed=true;retained(f,'UNSAVED');disabled(v);assert.equal(v.reason,'native-quota');assert.equal(v.phase,'append');
        const failedOrdinal=v.checkpoint.nextOrdinal;assert.deepEqual(ordinalCalls(f),Array.from({length:failedOrdinal+1},(_,i)=>i));
        const failedCall=f.calls.find(row=>row.kind==='append'&&row.ordinal===failedOrdinal);assert(failedCall);
        assert.equal(failedCall.result.reason,'native-quota');assert.equal(failedCall.nativeTransactions.length,1);
        assert.equal(failedCall.nativeTransactions[0].tx,nativeError.tx);assert.equal(failedCall.nativeTransactions[0].terminal,'abort');
        const failureTx=events.find(row=>row.tx===nativeError.tx&&row.type==='abort');assert(failureTx);
        const after=await snapshot(p);for(const name of Object.keys(before))if(name!=='meta'&&name!=='scopes')for(const [key,value]of before[name])assert.deepEqual(after[name].find(row=>row[0]===key)?.[1],value);
        assert.equal(await evaluate(p,()=>H.counters.navigation),0);await bounded(cdp.send('Storage.overrideQuotaForOrigin',{origin:ORIGIN}),'remove override before explicit retry');
        evidence.afterRemoval=await bounded(cdp.send('Storage.getUsageAndQuota',{origin:ORIGIN}),'quota removal status');save();assert.equal(evidence.afterRemoval.overrideActive,false);
        assert.equal((await retry(p)).state,'READY');const resolved=await facts(p);retained(resolved,'READY');
        assert.deepEqual(ordinalCalls(resolved),[...Array.from({length:failedOrdinal+1},(_,i)=>i),...Array.from({length:3-failedOrdinal},(_,i)=>failedOrdinal+i)]);
        const attempts=resolved.calls.filter(row=>row.kind==='append'&&row.ordinal===failedOrdinal);assert.equal(attempts.length,2);
        const candidate=({result,operationId,nativeTransactions,...rest})=>rest;assert.deepEqual(candidate(attempts[0]),candidate(attempts[1]));
        const final=await snapshot(p);for(const name of ['segments','payloads'])for(const [key,value]of after[name])assert.deepEqual(final[name].find(row=>row[0]===key)?.[1],value);
        const inspection=await evaluate(p,()=>H.inspect()),saved=inspection.items.find(item=>item.descriptor.run==='quota-run-'+attempt);
        assert.equal(saved?.sha256,resolved.original.sha256);evidence.sha256=saved.sha256;evidence.failedTransaction=failedCall.nativeTransactions[0];
        evidence.status='verified';evidence.nativeError=nativeError;evidence.failedCheckpoint=v.checkpoint;evidence.resolvedCheckpoint=resolved.view.checkpoint;
        evidence.preservedArchives=before.heads.length;break;
      }
      assert(observed,'Native quota remains unverified: no actual QuotaExceededError within bounded fixture attempts');save();return evidence;
    }catch(error){evidence.reason=error.message;save();throw error;}
    finally{
      try{await bounded(cdp.send('Storage.overrideQuotaForOrigin',{origin:ORIGIN}),'remove quota test override');}
      catch(error){evidence.overrideCleanupError=error.message;throw error;}
      finally{await cdp.detach();save();}
    }
  });
  await test('13 languages at 320/390 px preserve complete warning and immutable result',async()=>{
    const p=await fresh({abortOrdinal:0});await accept(p);const initial=await facts(p),before=await snapshot(p),layouts=[];
    for(const width of [320,390])for(const language of F.LANGUAGES){
      await p.setViewportSize({width,height:844});await p.selectOption('#language',language);
      const result=await evaluate(p,()=>{
        const warning=document.getElementById('warning'),range=document.createRange();range.selectNodeContents(warning);
        const bounds=warning.getBoundingClientRect(),textBounds=range.getBoundingClientRect();
        return {lang:document.documentElement.lang,dir:document.documentElement.dir,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
          warning:warning.textContent,warningHidden:warning.hidden,warningHeight:bounds.height,textHeight:textBounds.height,
          warningStyle:{overflow:getComputedStyle(warning).overflow,textOverflow:getComputedStyle(warning).textOverflow,lineClamp:getComputedStyle(warning).webkitLineClamp},
          targets:['language','retry','continue'].map(id=>{const el=document.getElementById(id),r=el.getBoundingClientRect();return{id,width:r.width,height:r.height,disabled:el.disabled,text:el.textContent};}),
          state:H.view(),summary:document.getElementById('summary').textContent};
      });
      assert.equal(result.lang,language);assert.equal(result.dir,['ar','he'].includes(language)?'rtl':'ltr');assert(result.scrollWidth<=width);
      assert.equal(result.warning,prepared.copy[language].warning);assert.equal(result.warningHidden,false);assert(result.warningHeight>=result.textHeight-1);
      assert.equal(result.warningStyle.overflow,'visible');assert.equal(result.warningStyle.textOverflow,'clip');assert.equal(result.warningStyle.lineClamp,'none');
      for(const target of result.targets){assert(target.width>=44&&target.height>=44);assert(target.width<=width-32);}
      assert.equal(result.targets[1].disabled,false);assert.equal(result.targets[2].disabled,true);assert.deepEqual(result.state.checkpoint,initial.view.checkpoint);
      assert.deepEqual(result.state.summary,initial.view.summary);assert.equal(result.summary,initial.summaryText);
      const file='unsaved-'+language+'-'+width+'.png';await bounded(p.screenshot({path:path.join(out,file),fullPage:true}),'locale screenshot');
      layouts.push({language,width,direction:result.dir,warningHeight:result.warningHeight,screenshot:file});
    }
    assert.deepEqual(await snapshot(p),before);assert.deepEqual(ordinalCalls(await facts(p)),[0]);return {layouts,captureAndCursorUnchanged:true};
  });
  for(const inputMode of ['keyboard','touch'])await test(inputMode+' explicit Retry then Continue is usable at 320 px',async()=>{
    const p=await fresh({abortOrdinal:0},{viewport:{width:320,height:844},hasTouch:inputMode==='touch'});await accept(p);
    if(inputMode==='keyboard'){
      await p.focus('#language');await p.keyboard.press('Tab');assert.equal(await evaluate(p,()=>document.activeElement.id),'retry');
      assert.notEqual(await p.locator('#retry').evaluate(el=>getComputedStyle(el).outlineStyle),'none');await p.keyboard.press('Enter');
    }else await p.locator('#retry').tap();
    await wait(p,()=>H.settled&&H.view().state==='READY');retained(await facts(p),'READY');
    if(inputMode==='keyboard'){await p.focus('#language');await p.keyboard.press('Tab');assert.equal(await evaluate(p,()=>document.activeElement.id),'continue');await p.keyboard.press('Enter');}
    else await p.locator('#continue').tap();
    const f=await facts(p);assert.equal(f.view.state,'CONTINUED');assert.deepEqual(f.counters,{captures:1,navigation:1,gameplay:0,rewards:0});
    return {inputMode,width:320,counters:f.counters,appendOrdinals:ordinalCalls(f)};
  });
  const pageGroups=new Map();for(const event of report.events){if(!pageGroups.has(event.page))pageGroups.set(event.page,[]);pageGroups.get(event.page).push(event);}
  for(const events of pageGroups.values())nativeEvents(events);
  assert.deepEqual(report.events.filter(row=>row.type==='pageerror'),[]);assert.deepEqual(report.network.rejected,[]);
  assert.equal(report.tests.length,27,'all native gate acceptance cases ran');report.status='passed';report.finishedAt=new Date().toISOString();report.passed=report.tests.length;save();
  console.log('PASS: '+report.passed+' native unsaved-result groups; fixture only, 26 locale layouts, zero game/reward actions.');
})().catch(error=>{report.status='failed';report.error=error.stack;save();console.error(error.stack);process.exitCode=1;}).finally(async()=>{
  const openContexts=new Set([context,...temporaryProfiles.filter(record=>!record.closed).map(record=>record.context)].filter(Boolean));
  for(const target of openContexts)await closeContext(target,'final context cleanup').catch(error=>{(report.cleanupErrors||=[]).push(error.message);});
  if(browser)await bounded(browser.close(),'final browser cleanup').catch(error=>{(report.cleanupErrors||=[]).push(error.message);});
  for(const profile of temporaryProfiles){
    if(profile.closed)fs.rmSync(profile.path,{recursive:true,force:true});
    else (report.cleanupBlockers||=[]).push({profile:profile.path,reason:'Persistent context closure is unconfirmed; temporary profile retained.'});
  }
  save();
});
