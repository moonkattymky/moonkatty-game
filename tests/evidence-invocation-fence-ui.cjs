'use strict';
/* Native execution is restricted to approved GitHub CI. No local listener/browser. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {execFileSync}=require('node:child_process');
const F=require('./evidence-finale-controller-fixture.cjs');
const Original=require('./evidence-invocation-original-helper.cjs');
const ROOT=F.root,DIR='tests/fixtures/evidence-invocation-fence/',ORIGIN='https://invocation-fence-fixture.test';
const EXPECTED_CASES=44,BASELINE={commit:'9b072131e3161533fdf9688f7c922b662577b212',tree:'f21589b2fde25aceeeb4c0d22d7d5d0930e57b30',acceptedNativePR:76};
const out=process.env.MKTY_TEST_OUTPUT||path.join(os.tmpdir(),'mkty-invocation-fence-native');
const ORDER={
  8:['set:mkty_story_plan_8_v1','set:mkty_life9_coordinates','set:mkty_spatial_report_8','remove:mkty_field_finale_8_v1','set:mkty_life8_completed_at','set:mkty_operations_8_v1','set:mkty_story_plan_8_v1','set:mkty_points','set:mkty_life8_awarded','set:mkty_life8','set:mkty_life8','set:mkty_current_chapter'],
  9:['set:mkty_story_plan_9_v1','set:mkty_spatial_report_9','remove:mkty_field_finale_9_v1','set:mkty_life9_completed_at','set:mkty_operations_9_v1','set:mkty_story_plan_9_v1','set:mkty_points','set:mkty_life9_awarded','set:mkty_life9','set:mkty_life9','set:mkty_final_moon_points','set:mkty_points_locked_at']
};
const report={status:'not-run',baseline:BASELINE,tests:[],network:{fulfilled:0,rejected:[]},pageErrors:[],consoleErrors:[],nativeFaultCuts:0,successfulEnds:0,
  qualifications:{source:'Full unchanged index/runtime; original prepared-operations entry and original final closures. No runtime integration.',
    inputs:'Two isolated synthetic disposable guest prerequisites and already-won checkpoints; prior progress and field wins are not earned here.',
    time:'Date.now is fixed at 2026-10-12T12:00:00Z by page.clock.setFixedTime. Native IDB execution and watchdog timers remain real; this fixture provides no general gameplay or wall-clock timing proof.',
    transition:'Native localStorage failures are swallowed by the original facade; callbacks finish in RAM. Actual navigation to a same-origin source-only inspection document discards that facade and all closures. No synthetic prefix restoration and no abrupt-JavaScript-crash claim.',
    lifecycle:'Real old-document pagehide/visibility/blur handlers remain active. All native/logical transition writes are logged and compared to retained values; no gameplay-write suppression.',
    scopeAdmission:'Source-only probe of the prior 29-character invocation-fence-native:guest scope with disposable-guest:1: PREPARED succeeded at metadataPeak5054; ISSUED refused before append because prospective journal overlap5166 exceeded unchanged5120. No original invocation. This is source-probe evidence, not a native case; native fixture uses native:fence.',
    authority:'Only newly committed, verified ISSUED may invoke once in its current realm. Recovered observations and exact retry are inspection-only. RETURNED is not durable DONE.',
    exclusions:'No account/server rewards, gameplay resume, epilogue continuation, native quota repetition, arbitrary old-writer exclusion, process/power crash, eviction, or heap/RSS claim.',
    memory:'Candidate representation limits remain fixed. Bounded fixture observations and report copies are separate test memory.'}};
let browser,context,page,current,routes,cache,sourceHashes,serial=0,emitted=[];
const git=(...args)=>execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();
const sig=r=>r.op+':'+r.key;
const ordered=value=>Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)));
const equal=(a,b,message)=>assert.deepEqual(ordered(a),ordered(b),message);
function save(){fs.mkdirSync(out,{recursive:true});const text=JSON.stringify(report,null,2)+'\n';assert(Buffer.byteLength(text)<=24*1024*1024,'Bounded native report');fs.writeFileSync(path.join(out,'native-invocation-fence-results.json'),text);}
async function bounded(promise,label,ms=20000){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Native fixture deadline: '+label)),ms);})]);}finally{clearTimeout(timer);}}
const evaluate=(fn,arg)=>bounded(page.evaluate(fn,arg),'browser evaluation');
const wait=fn=>bounded(page.waitForFunction(fn,null,{timeout:15000}),'browser condition');
const facts=()=>evaluate(()=>H.facts());
function prepare(){
  F.prepare();Original.verifySources();const manifest=F.resources();
  for(const name of fs.readdirSync(path.join(ROOT,DIR)))if(/\.(?:html|js|mjs)$/.test(name))manifest.set('/'+DIR+name,DIR+name);
  const files=[...new Set([...manifest.values(),'tests/evidence-invocation-fence-ui.cjs','tests/evidence-invocation-original-helper.cjs'])];
  const hashes=Object.fromEntries(files.sort().map(file=>[file,F.sha(fs.readFileSync(path.join(ROOT,file)))]));
  const runtime=JSON.parse(fs.readFileSync(path.join(ROOT,'tests/fixtures/evidence-finale-controller/runtime-hashes.json'),'utf8'));
  for(const [file,expected]of Object.entries(runtime.hashes))assert.equal(hashes[file],expected,'Frozen original source '+file);
  assert(!fs.readFileSync(path.join(ROOT,'index.html'),'utf8').includes('invocation-fence'));
  const loaded=new Map([...new Set(manifest.values())].map(file=>[file,fs.readFileSync(path.join(ROOT,file))]));
  const resourceCache={files:loaded.size,bytes:[...loaded.values()].reduce((n,b)=>n+b.length,0)};
  assert(resourceCache.files<=200&&resourceCache.bytes<=32*1024*1024,'Finite first-party route/cache allowlist');
  return {routes:manifest,cache:loaded,sourceHashes:hashes,resourceCache};
}
async function fresh(chapter=8,{capture=true}={}) {
  if(context)await bounded(context.close(),'close prior context');
  assert(serial<EXPECTED_CASES,'Finite native case count');emitted=[];
  context=await bounded(browser.newContext({viewport:{width:600,height:900},serviceWorkers:'block',reducedMotion:'reduce'}),'fresh BrowserContext');
  await context.exposeBinding('fenceEvidence',(_source,row)=>{if(emitted.length>=8192)throw Error('Native IPC diagnostic bound');emitted.push(row);});
  await context.addInitScript({content:fs.readFileSync(path.join(ROOT,DIR,'native-storage.js'),'utf8')+'\n'+fs.readFileSync(path.join(ROOT,'tests/fixtures/evidence-indexeddb/native-harness.js'),'utf8')});
  await context.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url()),file=url.origin===ORIGIN&&routes.get(url.pathname);
    if(!file){report.network.rejected.push({test:current,url:url.origin+url.pathname,method:request.method(),expected:url.origin==='https://telegram.org'&&url.pathname==='/js/telegram-web-app.js'&&request.method()==='GET'});return route.abort('blockedbyclient');}
    assert.equal(request.method(),'GET','No fixture network writes');report.network.fulfilled++;
    return route.fulfill({body:cache.get(file),contentType:({'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.mp4':'video/mp4'})[path.extname(file)]||'application/octet-stream'});
  });
  await context.routeWebSocket('**/*',socket=>{report.network.rejected.push({test:current,url:socket.url(),kind:'websocket',expected:false});socket.close();});
  page=await bounded(context.newPage(),'new page');serial++;page.setDefaultTimeout(15000);
  page.on('pageerror',error=>report.pageErrors.push({test:current,message:error.message}));
  page.on('console',message=>{if(message.type()==='error'){const url=message.location().url,text=message.text();report.consoleErrors.push({test:current,url,text,expected:/Failed to load resource.*(?:ERR_BLOCKED_BY_CLIENT|ERR_FAILED)/.test(text)&&url.startsWith('https://telegram.org/')});}});
  await page.clock.setFixedTime(new Date('2026-10-12T12:00:00Z'));
  await bounded(page.goto(ORIGIN+'/'),'load unchanged full index');await wait(()=>!!window.MKTYSpatialFinale&&!!window.MKTYOps&&!!window.MKTYStory);
  await evaluate(()=>import('/tests/fixtures/evidence-invocation-fence/fixture.mjs'));await wait(()=>window.invocationFixtureReady===true);
  const phase=F.phases[chapter===8?1:4],seed=Original.seedFinal(chapter);
  seed.mkty_daily_demo=JSON.stringify({attempts:0,streak:0,solved:false,codes:[],cday:'2026-10-12'});
  await evaluate(options=>H.setup(options),{phase,seed});
  if(capture){await evaluate(()=>H.open());await page.locator('#fieldResume').click();await page.locator('#fieldSubmit').click();await wait(()=>H.settled===true);const f=await facts();assert.equal(f.error,null);assert.equal(f.counters.entry,1);assert.equal(f.counters.open,1);assert.equal(f.counters.captures,1);assert.equal(f.counters.original,0);assert.equal(f.view.state,'NEW');assert(f.budget.peak<=1016832);}
  return phase;
}
async function prepared(){await evaluate(()=>H.prepare());const f=await facts();assert.equal(f.view.state,'PREPARED',JSON.stringify(f.view));assert.equal(f.counters.original,0);return f;}
async function armed(){await prepared();await evaluate(()=>H.issue());const f=await facts();assert.equal(f.view.state,'ARMED',JSON.stringify(f.view));assert.equal(f.view.invocationAllowed,true);return f;}
function completed(f,chapter){
  assert.deepEqual(Object.fromEntries(['original','award','pace','operations','story','rewards'].map(key=>[key,f.counters[key]])),{original:1,award:1,pace:1,operations:1,story:1,rewards:1});
  assert.equal(f.counters.epilogue,chapter===9?1:0);assert.equal(f.originalArgumentText,f.capture.checkpointText);
  assert.equal(f.writer.state,'finished');assert.equal(f.writer.cursor,12);assert.equal(f.writer.expectedOperations,12);
  assert.deepEqual(f.logicalWrites.filter(r=>r.mode==='original').map(sig),ORDER[chapter]);
  assert.equal(f.logicalSnapshot.mkty_points,chapter===8?'2100':'5100');assert.equal(f.logicalSnapshot['mkty_life'+chapter+'_awarded'],'yes');
  assert.equal(f.logicalSnapshot[Original.opKey(chapter)],Original.opText(chapter,'complete'));assert.equal(f.logicalSnapshot[F.sourceKey(chapter)],undefined);
  assert.equal(f.view.returnedObserved,true);assert.equal(f.view.invocationAllowed,false);assert.equal(f.physicalBusy,false);assert.equal(f.retainedBytes,0);
  if(chapter===9)assert.equal(f.epilogueOpen,true,'Separate epilogue continuation remains uninvoked');
}
function nativeProof(f,{invoked=false}={}) {
  const active=new Set();let peak=0;
  for(const row of f.nativeEvents){
    if(row.type==='transaction'&&!row.fixture){active.add(row.tx);peak=Math.max(peak,active.size);if(row.mode==='readwrite')assert.equal(row.durability,'strict');}
    if(['complete','abort'].includes(row.type))active.delete(row.tx);
    if(row.type==='digest'){assert(row.bytes<=66048);assert.deepEqual(row.activeTransactions,[]);}
    if(row.type==='request'&&!row.fixture)assert(!['getAll','getAllKeys','openCursor','openKeyCursor','count'].includes(row.kind));
  }
  assert(peak<=1);assert.equal(active.size,0);assert(f.peakTransport<=1);assert(f.budget.peak<=1016832);
  if(invoked){
    const issued=f.transport.findLast(r=>r.kind==='append'&&r.run?.endsWith(':ISSUED'));
    const checked=f.transport.findLast(r=>r.kind==='read'&&r.run?.endsWith(':ISSUED'));
    assert.equal(issued.result.status,'committed');assert.equal(issued.result.receipt.acknowledgement,'idb-transaction-complete');
    const committed=issued.native.find(r=>r.type==='complete'),read=checked.native.find(r=>r.type==='transaction'),readDone=checked.native.find(r=>r.type==='complete');
    assert(committed&&read&&readDone);assert(committed.n<read.n);assert(readDone.n<f.events.find(e=>e.type==='original-start').nativeEventIndex);
  }
  return {peakPhysicalTransactions:peak};
}
async function noReplay(){const before=(await facts()).counters;await evaluate(()=>{H.invoke();H.invoke();return H.retry();});assert.deepEqual((await facts()).counters,before);}
async function inspectTransition(classification,{empty=false}={}) {
  const before=await facts(),archives=await evaluate(()=>H.audit()),expected=await evaluate(empty?()=>H.emptyExpected():()=>H.expected());
  const emittedStart=emitted.length;
  await bounded(page.goto(ORIGIN+'/'+DIR+'inspect.html'),'actual source-only realm transition');
  await wait(()=>window.invocationInspectionReady===true);await evaluate(value=>I.setup(value),expected);
  const first=await evaluate(()=>I.inspect()),second=await evaluate(()=>I.inspect()),after=await evaluate(()=>I.facts()),retained=await evaluate(()=>I.audit());
  assert.equal(first.classification,classification,JSON.stringify(first));assert.deepEqual(second,first,'Read-only reinspection is idempotent');
  for(const result of [first,second])for(const flag of ['invocationAllowed','playEnabled','continueEnabled'])assert.equal(result[flag],false);
  assert.equal(first.inspectionOnly,true);assert(after.noFacade&&after.noOriginal&&after.noClosure);assert.equal(after.nativeWrites.length,0);assert.deepEqual(after.errors,[]);assert.equal(after.physicalBusy,false);assert.equal(after.retainedBytes,0);
  assert.deepEqual(retained,archives,'All actual retained archive descriptors, heads and payload digests unchanged');
  // Binding calls are emitted from old pagehide listeners, including after all
  // unchanged handlers. Do not infer their absence from the new realm's log.
  await bounded((async()=>{const deadline=Date.now()+2500;while(!emitted.slice(emittedStart).some(r=>r.kind==='pagehide-end'&&r.realm==='/')){if(Date.now()>=deadline)throw Error('Missing real old-document pagehide evidence');await new Promise(resolve=>setTimeout(resolve,10));}})(),'old-document pagehide evidence',3000);
  const transition=emitted.filter(r=>r.realm==='/'&&(r.kind==='native-write'&&r.n>=before.nativeWrites.length||r.kind==='logical-write'&&r.n>=before.logicalWrites.length||r.kind.startsWith('pagehide-')));
  const allowed=new Set(['mkty_global_lives','mkty_life_restore_at','mkty_expeditions_v1','mkty_daily_demo','mkty_campaign_checkpoint_8','mkty_campaign_checkpoint_9',Original.opKey(expected.chapter)]);
  const transitionWrites=transition.filter(r=>r.kind==='native-write'||r.kind==='logical-write');assert(transitionWrites.length<=32,'Bounded known lifecycle writes');
  for(const row of transitionWrites) {
    assert(allowed.has(row.key),'Unexpected real transition write '+row.key);
    if(row.key===Original.opKey(expected.chapter)){assert.equal(row.op,'set');assert.equal(row.value,Original.opText(expected.chapter,before.counters.original?'complete':'core'),'Real operations pagehide cache rewrite');}
    else if(row.key==='mkty_global_lives'){assert.equal(row.op,'set');assert.equal(row.value,'9');}
    else if(['mkty_life_restore_at','mkty_campaign_checkpoint_8','mkty_campaign_checkpoint_9'].includes(row.key)){assert.equal(row.op,'remove');assert.equal(before.logicalSnapshot[row.key],undefined,'Only idempotent absent background removal');}
    else {assert.equal(row.op,'set');assert.equal(row.value,before.logicalSnapshot[row.key],'Idle expedition/daily rewrite preserves exact original bytes');}
  }
  const image={...before.native};for(const row of transition.filter(r=>r.kind==='native-write'&&r.success))row.op==='set'?image[row.key]=row.value:delete image[row.key];
  equal(after.native,image,'Fresh native bytes equal the original prefix plus every observed successful old-document write');
  const hide=transition.find(r=>r.kind==='pagehide-start');assert(hide);assert.equal(hide.persisted,false,'Old realm is discarded, never retained in BFCache');
  const last=transition.filter(r=>r.kind==='pagehide-end').at(-1);assert(last);assert.deepEqual(last.counters,before.counters,'Lifecycle cannot replay original final callback');equal(last.native,after.native);
  assert(!after.nativeEvents.some(r=>r.type==='transaction'&&r.mode==='readwrite'),'Existing-database inspection has no native write transaction');
  return {classification:first,sourceBeforeTransition:before,nativeAfterTransition:after.native,transition,archiveFingerprints:retained,inspectionNativeEvents:after.nativeEvents,
    inspectionOriginalCallbacks:0,inspectionLocalStorageWrites:0,sourceRealmDiscarded:true};
}
async function test(name,run){current=name;const row={name,status:'running'};report.tests.push(row);save();const started=Date.now();try{row.details=await bounded(run(),name,90000);row.status='passed';row.milliseconds=Date.now()-started;console.log('PASS invocation-fence: '+name);}catch(error){row.status='failed';row.error=error.stack;try{row.failure=await page.evaluate(()=>window.H?H.facts():window.I?I.facts():null);}catch{}throw error;}finally{save();}}
async function heldIssue(event='ISSUED') {
  await evaluate(event=>{H.armProtocol(event,'hold-complete');void(event==='ISSUED'?H.issue():H.recordReturned());},event);
  await wait(()=>H.controlled!==null);
  const proof=await evaluate(async()=>{const [native,due]=await Promise.all([H.controlled.barrier,H.controlled.timer.due]);return {native,due,settled:H.settled};});
  assert.equal(proof.native.terminal,'complete');assert.equal(proof.settled,false);assert.equal(proof.due.delay,1000);
  await evaluate(()=>H.controlled.timer.release());await wait(()=>H.settled===true);assert.equal((await facts()).view.state,'UNRESOLVED');
  await evaluate(()=>H.retry());assert.equal((await facts()).view.invocationAllowed,false);
  await evaluate(tx=>__nativeHarness.releaseTerminals(tx),proof.native.tx);await wait(()=>H.facts().physicalBusy===false);
  await evaluate(()=>H.retry());const final=await facts();assert.equal(final.view.invocationAllowed,false);assert.equal(final.view.state,'BLOCKED');assert.equal(final.retainedBytes,0);
  assert.equal(final.transport.findLast(r=>r.kind==='exact-retry').result.status,'duplicate');return proof;
}
async function main(){
  if(process.env.GITHUB_ACTIONS!=='true'||process.env.CI!=='true')throw Error('Native invocation fence is CI-only; local browser/listener execution is not authorized.');
  const resources=prepare();({routes,cache,sourceHashes}=resources);report.sourceHashes=sourceHashes;report.resourceCache=resources.resourceCache;
  report.commit=git('rev-parse','HEAD');report.tree=git('rev-parse','HEAD^{tree}');report.workflowSha=process.env.GITHUB_SHA;assert.equal(report.commit,report.workflowSha,'Execute exact CI commit');assert.equal(git('status','--porcelain'),'','No runtime fixture rewriting');
  const {chromium}=require('playwright');assert.equal(require('playwright/package.json').version,'1.58.2');
  browser=await bounded(chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--disable-back-forward-cache']}),'launch pinned Chromium',30000);
  report.versions={node:process.version,playwright:'1.58.2',chromium:browser.version()};report.status='running';
  for(const chapter of [8,9])for(let cut=0;cut<=12;cut++)await test(`chapter ${chapter} original native ${cut===12?'successful end':'failure before write '+cut}`,async()=>{
    await fresh(chapter);await armed();const before=await facts();if(cut<12)await evaluate(cut=>H.armNative(cut),cut);
    assert.equal(await evaluate(()=>H.invoke()),true);const invoked=await facts();completed(invoked,chapter);const rows=invoked.nativeWrites.filter(r=>r.mode==='original');
    assert.equal(rows.length,cut<12?cut+1:12);assert.deepEqual(rows.map(sig),ORDER[chapter].slice(0,rows.length));
    if(cut<12){assert(rows.at(-1).injected);assert.equal(invoked.persistent,false);assert(rows.slice(0,-1).every(r=>r.success));report.nativeFaultCuts++;}
    else{assert(rows.every(r=>r.success));assert.equal(invoked.persistent,true);report.successfulEnds++;}
    const prefix={...before.native};for(const row of rows.filter(r=>r.success))row.op==='set'?prefix[row.key]=row.value:delete prefix[row.key];equal(invoked.native,prefix);
    if(cut===(chapter===8?4:3)){assert.equal(invoked.native[F.sourceKey(chapter)],undefined);assert.equal(invoked.native.mkty_points,chapter===8?'100':'2100');}
    if(cut===(chapter===8?8:7)){assert.equal(invoked.native.mkty_points,chapter===8?'2100':'5100');assert.equal(invoked.native['mkty_life'+chapter+'_awarded'],undefined);}
    await evaluate(()=>H.recordReturned());assert.equal((await facts()).view.state,'RETURNED');await noReplay();const f=await facts();nativeProof(f,{invoked:true});
    const recovery=await inspectTransition('returned-observation');return {chapter,cut,cutMeaning:cut===12?'successful original end':'native failure before exact operation; original then finishes in volatile RAM',nativePrefix:rows,pointSourceMarkerBoundary:cut===(chapter===8?4:3)?'source removed before award':cut===(chapter===8?8:7)?'points written before marker':null,...recovery};
  });
  await test('empty database is absent and never first-use authority',async()=>{await fresh(8,{capture:false});return inspectTransition('absent/legacy-unattributed',{empty:true});});
  await test('old unjournaled current context and phase remain inspection-only',async()=>{await fresh();return inspectTransition('absent/legacy-unattributed');});
  await test('PREPARED committed/read back without ISSUED',async()=>{await fresh();await prepared();return inspectTransition('prepared-only');});
  for(const chapter of [8,9])await test(`chapter ${chapter} ISSUED committed before original invocation`,async()=>{await fresh(chapter);await armed();assert.equal((await facts()).counters.original,0);return inspectTransition('issued/no-return-observed');});
  for(const chapter of [8,9])await test(`chapter ${chapter} original returned with no RETURNED receipt`,async()=>{await fresh(chapter);await armed();await evaluate(()=>H.invoke());completed(await facts(),chapter);await noReplay();return inspectTransition('issued/no-return-observed');});
  await test('PREPARED real native abort never arms',async()=>{await fresh();await evaluate(()=>{H.armProtocol('PREPARED','abort');return H.prepare();});const f=await facts();assert.equal(f.view.invocationAllowed,false);assert.equal(f.counters.original,0);assert(f.nativeEvents.some(r=>r.type==='abort-requested-after-success'));return inspectTransition('absent/legacy-unattributed');});
  await test('ISSUED real native abort and retry never arms',async()=>{await fresh();await prepared();await evaluate(()=>{H.armProtocol('ISSUED','abort');return H.issue();});await noReplay();assert.equal((await facts()).counters.original,0);return inspectTransition('prepared-only');});
  await test('ISSUED actual commit with held acknowledgment exact duplicate retry stays blocked',async()=>{await fresh();await prepared();const held=await heldIssue();await noReplay();assert.equal((await facts()).counters.original,0);return {held,...await inspectTransition('issued/no-return-observed')};});
  await test('ISSUED committed but native readback abort never arms',async()=>{await fresh();await prepared();await evaluate(()=>{H.armProtocol('ISSUED','read-abort');return H.issue();});await noReplay();const f=await facts();assert.equal(f.counters.original,0);assert(f.transport.some(r=>r.kind==='read'&&r.run?.endsWith(':ISSUED')&&r.native.some(n=>n.type==='abort')));return inspectTransition('issued/no-return-observed');});
  await test('current identity changes after ISSUED readback and permanently blocks',async()=>{await fresh();await prepared();await evaluate(()=>{H.armProtocol('ISSUED','change-after-read');return H.issue();});await noReplay();const f=await facts();assert.equal(f.counters.original,0);assert.equal(f.invalid,true);return inspectTransition('issued/no-return-observed');});
  await test('actual old-writer operations prerequisite change blocks ISSUED',async()=>{await fresh();await prepared();await evaluate(()=>H.changeOperations());await evaluate(()=>H.issue());await noReplay();const f=await facts();assert.equal(f.counters.original,0);assert.equal(f.view.invocationAllowed,false);assert.equal(f.invalid,true);assert.equal(f.operationsGuard.logical,Original.opText(8,'complete'));assert.equal(f.operationsGuard.native,Original.opText(8,'complete'));assert(!f.transport.some(r=>r.kind==='append'&&r.run?.endsWith(':ISSUED')));return inspectTransition('prepared-only');});
  await test('duplicate immutable PREPARED in same realm grants no callback',async()=>{await fresh();await prepared();const duplicate=await evaluate(()=>H.duplicatePrepare());assert.equal(duplicate.view.invocationAllowed,false);assert.equal((await facts()).counters.original,0);return {duplicate,...await inspectTransition('prepared-only')};});
  await test('later-only valid RETURNED blocks a fresh attempt without new writes',async()=>{
    await fresh();const seed=await evaluate(()=>H.seedLaterOnlyReturned()),before=await facts(),archives=await evaluate(()=>H.audit());
    assert.equal(seed.acknowledgement,'idb-transaction-complete');assert.equal(archives.length,3);assert(archives.some(r=>r.descriptor.run.endsWith(':RETURNED')));assert(!archives.some(r=>/:PREPARED$|:ISSUED$/.test(r.descriptor.run)));
    await evaluate(()=>H.prepare());await noReplay();const after=await facts();assert.equal(after.view.state,'BLOCKED');assert.equal(after.view.reason,'invocation-fence-existing-journal-inspection-only');assert.equal(after.counters.original,0);
    assert.equal(after.transport.filter(r=>r.kind==='append').length,before.transport.filter(r=>r.kind==='append').length,'Preflight writes no new journal record');
    assert(after.transport.filter(r=>r.kind==='recover').length>before.transport.filter(r=>r.kind==='recover').length,'Actual retained journal discovery');
    equal(after.native,before.native);assert.deepEqual(after.logicalWrites,before.logicalWrites);return {seed,...await inspectTransition('incomplete/unverified')};
  });
  await test('RETURNED actual commit with held acknowledgment remains observation-only',async()=>{await fresh();await armed();await evaluate(()=>H.invoke());const held=await heldIssue('RETURNED');completed(await facts(),8);await noReplay();return {held,...await inspectTransition('returned-observation')};});
  for(const chapter of [8,9])await test(`chapter ${chapter} failed midflush retains a non-prefix native image`,async()=>{
    await fresh(chapter);await armed();await evaluate(()=>H.armNative(0));await evaluate(()=>H.invoke());const before=await facts();completed(before,chapter);
    const retry=await evaluate(()=>H.retrySaving(3)),after=await facts();assert.equal(retry.persistent,false);assert.deepEqual(after.counters,before.counters);
    const rows=after.nativeWrites.filter(row=>row.mode==='retry-saving');assert.equal(rows.length,4);assert(rows.at(-1).injected);assert.equal(rows[2].key,F.storyKey(chapter));
    assert.equal(JSON.parse(after.native[F.storyKey(chapter)]).phase,'complete');assert.equal(after.native.mkty_points,chapter===8?'100':'2100');
    const originals=before.logicalWrites.filter(row=>row.mode==='original'),images=Original.prefixImages(before.capture.beforeNative,originals);
    assert.equal(Original.compatibleCuts(images,ordered(after.native)).length,0,'Latest-value RAM map flush is not a callback-prefix replay');
    await evaluate(()=>H.recordReturned());await noReplay();return {midflush:rows,...await inspectTransition('returned-observation')};
  });
  assert.equal(report.tests.length,EXPECTED_CASES);assert.equal(serial,EXPECTED_CASES);assert.equal(report.nativeFaultCuts,24);assert.equal(report.successfulEnds,2);
  report.freshContexts=serial;assert.equal(report.pageErrors.length,0);assert.equal(report.consoleErrors.filter(r=>!r.expected).length,0,JSON.stringify(report.consoleErrors));assert.equal(report.network.rejected.filter(r=>!r.expected).length,0,JSON.stringify(report.network.rejected));
  for(const [file,hash]of Object.entries(sourceHashes))assert.equal(F.sha(fs.readFileSync(path.join(ROOT,file))),hash,'Unchanged source after native evidence '+file);
  report.status='passed';save();
}
module.exports={prepare,ORDER,EXPECTED_CASES};
if(require.main===module)main().catch(error=>{report.status='failed';report.error=error.stack;save();console.error(error);process.exitCode=1;}).finally(async()=>{
  for(const target of [context,browser])if(target)try{await bounded(target.close(),'final native cleanup');}catch(error){report.status='failed';(report.cleanupErrors??=[]).push(String(error));process.exitCode=1;}
  if(report.pageErrors.length||report.consoleErrors.some(r=>!r.expected)||report.network.rejected.some(r=>!r.expected)){report.status='failed';process.exitCode=1;}save();
  if(report.status==='passed')console.log(`PASS native invocation fence: ${report.tests.length} cases; 24 original native write fault cuts; 2 successful ends.`);
});
