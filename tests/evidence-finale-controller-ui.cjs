'use strict';
/* GitHub CI only: unchanged full index at synthetic HTTPS; no local browser/listener. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const F=require('./evidence-finale-controller-fixture.cjs');
const EXPECTED_CASES=80,ORIGIN='https://finale-controller-fixture.test',out=process.env.MKTY_TEST_OUTPUT||path.join(os.tmpdir(),'mkty-finale-controller-native');
const report={status:'not-run',tests:[],network:{fulfilled:0,rejected:[]},pageErrors:[],consoleErrors:[],nativeCutpoints:0};
let browser,context,current,currentPage,pageSerial=0;
function save(){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'native-finale-controller-results.json'),JSON.stringify(report,null,2)+'\n');}
async function bounded(promise,label,ms=15000){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Node fixture deadline: '+label)),ms);})]);}finally{clearTimeout(timer);}}
const evaluate=(p,fn,arg)=>bounded(p.evaluate(fn,arg),'browser evaluation');
const wait=(p,fn)=>bounded(p.waitForFunction(fn,null,{timeout:12000}),'browser condition');
const facts=p=>evaluate(p,()=>H.facts());
const view=p=>evaluate(p,()=>H.view());
const sig=row=>row.kind+':'+row.key;
const mapEqual=(a,b)=>assert.deepEqual(Object.fromEntries(Object.entries(a).sort()),Object.fromEntries(Object.entries(b).sort()));
const phaseKey=p=>p.chapter+'/'+p.index;
let routeFiles,cache;
async function importFixture(p){await wait(p,()=>!!window.MKTYSpatialFinale&&!!window.MKTYStory&&!!window.MKTYContinuation);await evaluate(p,()=>import('/tests/fixtures/evidence-finale-controller/fixture.mjs'));await wait(p,()=>window.finaleFixtureReady===true);}
async function fresh(phase=F.phases[0],config={}){
 if(context)await bounded(context.close(),'close prior isolated context');
 assert(pageSerial<EXPECTED_CASES,'bounded fresh-context count');
 context=await bounded(browser.newContext({viewport:{width:600,height:900},serviceWorkers:'block',reducedMotion:'reduce'}),'fresh BrowserContext');
 await context.addInitScript({content:fs.readFileSync(path.join(F.root,F.directory,'native-storage.js'),'utf8')+'\n'+fs.readFileSync(path.join(F.root,'tests/fixtures/evidence-indexeddb/native-harness.js'),'utf8')});
 await context.route('**/*',async route=>{const url=new URL(route.request().url()),file=url.origin===ORIGIN&&routeFiles.get(url.pathname);if(!file){report.network.rejected.push({test:current,url:url.origin+url.pathname,method:route.request().method(),expected:url.origin==='https://telegram.org'&&url.pathname==='/js/telegram-web-app.js'&&route.request().method()==='GET'});return route.abort('blockedbyclient');}assert.equal(route.request().method(),'GET','no synthetic-origin writes');report.network.fulfilled++;return route.fulfill({body:cache.get(file),contentType:({'.html':'text/html','.css':'text/css','.js':'application/javascript','.mjs':'application/javascript','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.mp4':'video/mp4'})[path.extname(file)]||'application/octet-stream'});});
 await context.routeWebSocket('**/*',socket=>{report.network.rejected.push({test:current,url:socket.url(),kind:'websocket',expected:false});socket.close();});
 const p=await bounded(context.newPage(),'new page');const id=++pageSerial;p.setDefaultTimeout(12000);
 p.on('pageerror',error=>report.pageErrors.push({test:current,page:id,message:error.message}));
 p.on('console',message=>{if(message.type()==='error'){const location=message.location(),body=message.text(),expectedBlockedResource=/Failed to load resource.*(?:ERR_BLOCKED_BY_CLIENT|ERR_FAILED)/.test(body)&&location.url.startsWith('https://telegram.org/');report.consoleErrors.push({test:current,page:id,message:body,url:location.url,expectedBlockedResource});}});currentPage=p;
 // Fix Date only, not timers: original controller seconds and IDB watchdog timers still run.
 await p.clock.setFixedTime(new Date('2026-10-12T12:00:00Z'));
 await bounded(p.goto(ORIGIN+'/'),'unchanged index load');await importFixture(p);
 await evaluate(p,options=>H.setup(options),{phase,seed:F.seed(phase,{earned:!!config.earned}),...config});return p;
}
async function open(p){await evaluate(p,()=>H.open());await p.locator('#fieldResume').click();}
async function finish(p){await p.locator('#fieldSubmit').click();await wait(p,()=>H.settled===true);const f=await facts(p);assert.equal(f.captureError,null);return f;}
async function restored(phase=F.phases[0],config={}){const p=await fresh(phase,config);await open(p);const f=await finish(p);return {p,f};}
async function go(p,phase){await p.locator('#finaleContinue').click();if(phase.chapter===9&&phase.index===2)await p.locator('[data-legacy-choice="done"]').click();return facts(p);}
function untouched(f){assert.equal(f.counters.original,0);for(const key of ['award','pace','storyComplete','rewards','campaignRestore','review'])assert.equal(f.counters[key],0,key);mapEqual(f.logicalSnapshot,f.capture.before);assert.equal(f.active,'evidenceFinaleResult');}
function ready(f){assert.equal(f.view.state,'READY');assert.equal(f.view.diagnostics.captureCount,1);assert.equal(f.view.diagnostics.admissions,2);assert.equal(f.view.checkpoint.nextOrdinal,1);assert.equal(f.calls.filter(r=>r.kind==='append').length,1);assert.equal(f.calls.find(r=>r.kind==='append').ordinal,0);assert(f.peakCalls<=1);assert(f.view.diagnostics.modeledPeakBytes<=1016832);untouched(f);}
function completed(f,phase){
 assert.equal(f.view.state,'CONTINUED');assert.equal(f.counters.original,1);assert.equal(f.originalArgumentText,f.capture.rawCheckpointText,'Original receives exactly the immutable raw checkpoint');assert.deepEqual(f.logical.map(sig),F.WRITE_MATRIX[phaseKey(phase)]);
 const final=phase.index===(phase.chapter===8?1:2),award=final?phase.chapter===8?2000:3000:0;
 assert.equal(f.counters.award,Number(final));assert.equal(Number(f.logicalSnapshot.mkty_points)-100,award);
 for(const key of ['pace','storyComplete','rewards','campaignRestore','review'])assert.equal(f.counters[key],Number(final),key);
 if(final){assert.equal(f.active,'mission'+phase.chapter);assert.equal(f.chapterStage,'complete');assert.equal(f.logicalSnapshot['mkty_life'+phase.chapter],'complete');assert.equal(f.logicalSnapshot['mkty_life'+phase.chapter+'_awarded'],'yes');assert.equal(f.logicalSnapshot[F.sourceKey(phase.chapter)],undefined);assert.equal(JSON.parse(f.logicalSnapshot[F.storyKey(phase.chapter)]).phase,'complete');assert(f.logicalSnapshot['mkty_spatial_report_'+phase.chapter]);}
 else{assert.equal(f.active,'fieldMission');assert.equal(JSON.parse(f.logicalSnapshot[F.sourceKey(phase.chapter)]).phase,phase.index+1);}
 const order=f.events.map(r=>r.type),capture=order.indexOf('raw-callback'),read=order.lastIndexOf('read-settled'),continued=order.indexOf('explicit-continue'),original=order.indexOf('original-start');assert(capture<read&&read<continued&&continued<original);
 if(final)assert(f.events.findIndex(e=>e.type==='award')>original);
 if(phase.chapter===9&&final)assert(f.events.findIndex(e=>e.type==='epilogue-click')>f.events.findIndex(e=>e.type==='award'));
}
function nativeEvidence(f){
 const active=new Set();let peak=0;
 for(const row of f.nativeEvents){
  if(row.type==='transaction'&&!row.fixture){active.add(row.tx);peak=Math.max(peak,active.size);if(row.mode==='readwrite')assert.equal(row.durability,'strict');}
  if(['complete','abort'].includes(row.type))active.delete(row.tx);
  if(row.type==='digest'){assert(row.bytes<=66048);assert.equal(row.activeTransactions.length,0);}
  if(row.type==='request'&&!row.fixture)assert(!['getAll','getAllKeys','openCursor','openKeyCursor','count'].includes(row.kind));
 }
 assert(peak<=1,'one actual physical transaction per realm');
 if(f.view.state==='CONTINUED'&&f.view.reason!=='navigation-threw'){
  const accepted=f.calls.filter(r=>r.kind==='append'||r.kind==='exact-retry').findLast(r=>['committed','duplicate'].includes(r.result?.status));assert(accepted);
  const complete=accepted.native.find(r=>r.type==='complete');assert(complete,'native acknowledgement has actual completion');
  const verified=f.calls.filter(r=>r.kind==='read'&&r.result?.status==='page').at(-1);assert(verified);
  const read=verified.native.find(r=>r.type==='transaction'&&r.mode==='readonly');assert(read&&complete.n<read.n,'native write completion precedes checked native readback');
  const readComplete=verified.native.find(r=>r.type==='complete');assert(readComplete);
  const continued=f.events.find(r=>r.type==='explicit-continue'),started=f.events.find(r=>r.type==='original-start');assert(readComplete.n<continued.nativeEventCount&&continued.n<started.n);
 }
 return {peakPhysicalTransactions:peak};
}
async function duplicates(p){const before=(await facts(p)).counters;await evaluate(p,()=>{H.continue();H.continue();return H.retry();});assert.deepEqual((await facts(p)).counters,before);}
async function test(name,run){
 current=name;const row={name,status:'running'};report.tests.push(row);save();const errors=report.pageErrors.length,start=Date.now(),firstPage=pageSerial;
 try{
  row.details=await bounded(run(),name,100000);const observed=await facts(currentPage);row.nativeEvidence=nativeEvidence(observed);row.nativeEvents=observed.nativeEvents;row.backgroundNativeWrites=observed.outsideNative;row.backgroundLogicalWrites=observed.outsideLogical;row.setupProof=observed.setupProof;
  assert.equal(report.network.rejected.filter(r=>r.test===name&&!r.expected).length,0,JSON.stringify(report.network.rejected.filter(r=>r.test===name)));assert.equal(report.consoleErrors.filter(r=>r.test===name&&!r.expectedBlockedResource).length,0,JSON.stringify(report.consoleErrors.filter(r=>r.test===name)));assert.equal(report.pageErrors.length,errors,JSON.stringify(report.pageErrors.slice(errors)));
  row.status='passed';row.milliseconds=Date.now()-start;console.log('PASS finale-controller: '+name);
 }catch(error){
  row.status='failed';row.error=error.stack;
  if(currentPage&&pageSerial>firstPage)try{row.failureFacts=await facts(currentPage);}catch(observationError){row.observationError=String(observationError.message);throw error;}
  // A settled AssertionError has no remaining run() continuation. Timeouts and
  // browser/infrastructure failures stay terminal: Promise.race cannot cancel work.
  if(error.code!=='ERR_ASSERTION'||report.pageErrors.length!==errors)throw error;
  try{if(context)await bounded(context.close(),'close failed assertion context');}
  catch(cleanupError){row.cleanupError=String(cleanupError.message);throw cleanupError;}
  context=null;currentPage=null;row.failureCollected=true;row.milliseconds=Date.now()-start;console.error('FAIL finale-controller (collected): '+name);
 }finally{save();}
}
async function earned(p,phase){
 await open(p);const trace=phase.state.trace;
 for(const [kind,action,value]of trace){assert.equal(kind,'act','only instantaneous input fixtures, no invented native docking timing');
  if(['angle','power','trim'].includes(action)){const input=p.locator('[data-field-slider="'+action+'"]'),before=Number(await input.inputValue());await input.focus();const direction=value>=before?'ArrowRight':'ArrowLeft';for(let i=0;i<Math.abs(value-before);i++)await input.press(direction);assert.equal(Number(await input.inputValue()),value);
  }else if(['burn','listen','launch'].includes(action))await p.locator('#fieldSubmit').click();
  else{const selector='[data-field-action="'+action+'"]'+(['tune','select'].includes(action)?'[data-value="'+value+'"]':'');await p.locator(selector).click();}
 }
 const state=await evaluate(p,()=>MKTYField.snapshot());assert(state.complete);assert.equal(state.failed,undefined);return finish(p);
}
async function unknown(p,terminal){
 const setup=(await facts(p)).setupProof;assert(setup);assert.equal(setup.opened.status,'open');assert.equal(setup.captured,1);assert(setup.cancelled>0);assert(setup.setTimeoutRestored&&setup.clearTimeoutRestored);assert.equal(setup.physical,0);assert.equal(setup.retainedBytes,0);assert.equal(setup.diagnostics.terminal,'complete');assert(!setup.diagnostics.events.includes('watchdog'));const schema=setup.nativeEvents.filter(r=>r.type==='transaction'&&!r.fixture);assert.equal(schema.length,1);assert.equal(schema[0].mode,'readonly');assert(setup.nativeEvents.some(r=>r.tx===schema[0].tx&&r.type==='complete'));assert(!setup.nativeEvents.some(r=>r.type==='watchdog-delivered'));
 await wait(p,()=>!!H.controlled);const proof=await evaluate(p,async()=>{const {barrier,timer,operationId}=H.controlled;const [native,due]=await Promise.all([barrier,timer.due]);return {native,due,operationId,settled:H.settled,captured:timer.captured};});
 assert.equal(proof.native.terminal,terminal);assert.equal(proof.native.queued,1);assert.equal(proof.settled,false);assert.equal(proof.captured,1);assert.equal(proof.due.delay,100);
 await evaluate(p,()=>H.controlled.timer.release());await wait(p,()=>H.settled);assert.equal((await view(p)).state,'UNSAVED');return proof;
}
(async()=>{
 if(process.env.GITHUB_ACTIONS!=='true'||process.env.CI!=='true')throw Error('Native finale fixture runs only in authorized GitHub CI; no local browser or listener.');
 const prepared=F.prepare();Object.assign(report,prepared);report.sizes=await F.packetMeasurements();report.commit=process.env.GITHUB_SHA;assert.match(report.commit||'',/^[a-f0-9]{40}$/);
 const {chromium}=require('playwright');assert.equal(require('playwright/package.json').version,'1.58.2');routeFiles=F.resources();cache=new Map([...new Set(routeFiles.values())].map(file=>[file,fs.readFileSync(path.join(F.root,file))]));
 report.resourceCache={files:cache.size,bytes:[...cache.values()].reduce((n,b)=>n+b.length,0)};assert(report.resourceCache.files<=200&&report.resourceCache.bytes<=32*1024*1024,'finite first-party resource cache');
 browser=await bounded(chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']}),'launch pinned Chromium',30000);report.versions={node:process.version,playwright:'1.58.2',chromium:browser.version()};report.status='running';report.nativeCutpoints=0;report.nativeCutpointsAttempted=0;
 for(const phase of F.checkpoints.phases)await test('restored valid fixture, actual resume/finish '+phase.label+' '+phaseKey(phase),async()=>{
  const {p,f}=await restored(phase);ready(f);assert.deepEqual(JSON.parse(f.capture.rawCheckpointText),phase.state,'Actual restored controller callback preserves original fixture');const archive=await evaluate(p,()=>H.inspect());assert.equal(archive.items.length,1);assert(archive.items[0].head.sealed);assert(archive.items[0].equalsInput);assert.equal(archive.items[0].sha256,f.calls.find(r=>r.kind==='append').payloadSha256);
  await evaluate(p,()=>{window.dispatchEvent(new Event('blur'));window.dispatchEvent(new Event('pagehide'));});untouched(await facts(p));
  const end=await go(p,phase);completed(end,phase);await duplicates(p);return {input:'restored completed model fixture; actual field resume and finish',packetBytes:f.view.diagnostics.capturedBytes,archive:archive.items[0],mutationSequence:end.logical.map(sig),counters:end.counters};
 });
 for(const phase of [F.checkpoints.phases.find(p=>p.label==='earned-echo-noise-105'),F.phases[1],F.checkpoints.phases.find(p=>p.label==='earned-gate-minus-one')])await test('earned through actual controls '+phaseKey(phase),async()=>{
  const p=await fresh(phase,{earned:true}),f=await earned(p,phase);ready(f);if(phase.mechanic===10)assert.equal(JSON.parse(f.capture.rawCheckpointText).noise,105);if(phase.mechanic===11)assert.equal(JSON.parse(f.capture.rawCheckpointText).stability,-1);const end=await go(p,phase);completed(end,phase);return {mechanic:phase.mechanic,traceRows:JSON.parse(f.capture.rawCheckpointText).trace.length,controllerSeconds:JSON.parse(f.capture.rawCheckpointText).seconds,input:'actual click/native range keys; real controller timers; no checkpoint replacement'};
 });
 await test('oversized actual source refuses before gate ownership and safely leaves field',async()=>{
  const phase=F.phases[0],data=F.seed(phase),raw=JSON.parse(data[F.sourceKey(phase.chapter)]);raw.oversized='x'.repeat(9000);data[F.sourceKey(phase.chapter)]=JSON.stringify(raw);
  const p=await fresh(phase,{seed:data});await open(p);const before=await evaluate(p,()=>MKTYStorage.snapshot());await p.locator('#fieldSubmit').click();await wait(p,()=>H.settled);const f=await facts(p);assert.equal(f.captureError,'finale-limit');assert.equal(f.active,'evidenceFinaleResult');assert.equal(f.view.state,'EMPTY');assert.equal(f.counters.original,0);assert.equal(f.counters.award,0);mapEqual(f.logicalSnapshot,before);await evaluate(p,()=>window.dispatchEvent(new Event('blur')));const other=await evaluate(p,()=>H.secondCapture('synthetic'));assert.equal(other.state,'READY');return {sourceBytes:before[F.sourceKey(phase.chapter)].length*2,ownerReserved:false,originalCalls:0};
 });
 await test('immutable callback argument and mixed-format second capture refusal',async()=>{const {p}=await restored();await evaluate(p,()=>H.mutateCaller());const second=await evaluate(p,()=>H.secondCapture('synthetic'));assert.equal(second.reason,'realm-capture-retained');const end=await go(p,F.phases[0]);completed(end,F.phases[0]);await duplicates(p);return {second:second.reason,original:end.counters.original};});
 await test('synthetic first owner refuses real finale capture in same realm',async()=>{
  const p=await fresh(F.phases[0],{syntheticFirst:true}),before=await facts(p);assert.equal(before.priorSynthetic.state,'READY','Prior owner must be committed and verified before actual field open');assert.equal(before.priorSynthetic.diagnostics.captureCount,1);assert.equal(before.priorSynthetic.retained,true);assert.equal(before.calls.filter(r=>r.kind==='append').length,1);assert.equal(before.calls.filter(r=>r.kind==='read').length,1);
  await open(p);const f=await finish(p),refusal=f.lastOperationResult;assert.equal(refusal.reason,'realm-capture-retained','Assert the accept return value, not a later unowned-gate view');assert.equal(refusal.state,'EMPTY');assert.equal(refusal.retained,false);assert.equal(f.view.state,'EMPTY');assert.equal(f.view.diagnostics.captureCount,0);assert.equal(f.view.retained,false);assert.deepEqual(f.calls,before.calls,'Refused second capture dispatches no adapter operation');untouched(f);return {priorOwner:before.priorSynthetic,acceptResult:refusal,unownedView:f.view,adapterCallsUnchanged:true};
 });
 await test('actual native append abort at the actual ordinal zero, exact retry',async()=>{const {p,f}=await restored(F.phases[0],{abortOrdinal:0});assert.equal(f.view.state,'UNSAVED');untouched(f);assert.equal(f.view.checkpoint.nextOrdinal,0);await p.locator('#finaleRetry').click();await wait(p,()=>H.settled);const retry=await facts(p);assert.equal(retry.view.state,'READY');assert.deepEqual(retry.calls.filter(r=>r.kind==='append').map(r=>r.ordinal),[0,0]);assert.equal(retry.calls[0].payloadSha256,retry.calls[1].payloadSha256);completed(await go(p,F.phases[0]),F.phases[0]);return {ordinals:[0,0],terminal:'abort'};});
 for(const terminal of ['complete','abort'])await test('held native '+terminal+', real watchdog, no implicit continuation',async()=>{const p=await fresh(F.phases[0],{unknown:terminal});await open(p);await p.locator('#fieldSubmit').click();const proof=await unknown(p,terminal);untouched(await facts(p));await evaluate(p,()=>H.retry());assert.equal((await view(p)).state,'UNSAVED');await evaluate(p,tx=>H.N.releaseTerminals(tx),proof.native.tx);await wait(p,()=>H.adapter.diagnostics.terminal!==null);assert.equal((await view(p)).state,'UNSAVED');await evaluate(p,()=>H.retry());assert.equal((await view(p)).state,'READY');completed(await go(p,F.phases[0]),F.phases[0]);return proof;});
 await test('late held acknowledgement after account ABA remains stale without exact retry',async()=>{const p=await fresh(F.phases[0],{unknown:'complete'});await open(p);await p.locator('#fieldSubmit').click();const proof=await unknown(p,'complete');await evaluate(p,()=>H.change('account-aba'));await evaluate(p,tx=>H.N.releaseTerminals(tx),proof.native.tx);await wait(p,()=>H.adapter.diagnostics.terminal!==null);await evaluate(p,()=>H.retry());await evaluate(p,()=>H.continue());const f=await facts(p);assert.equal(f.view.state,'STALE');assert.equal(f.counters.original,0);assert.equal(f.calls.filter(r=>r.kind==='exact-retry').length,0);return {proof,bridge:'test-only account ABA',ownedUnknown:f.view.ownedUnknown};});
 for(const mode of ['nativeReadAbort','readFailure'])await test(mode+' holds original and retries sealed readback',async()=>{const {p,f}=await restored(F.phases[0],{[mode]:true});assert.equal(f.view.state,'UNSAVED');untouched(f);assert.equal(f.view.checkpoint.nextOrdinal,1);await evaluate(p,()=>H.retry());assert.equal((await view(p)).state,'READY');assert.equal((await facts(p)).calls.filter(r=>r.kind==='append').length,1);completed(await go(p,F.phases[0]),F.phases[0]);return {mode,native:mode==='nativeReadAbort',appendCalls:1};});
 for(const kind of ['source','story','source-aba','account-aba','clear-restore','navigation','reopen','reader-failure'])await test('actual mutation / explicit fixture bridge '+kind+' invalidates irreversibly',async()=>{const {p}=await restored();const before=await evaluate(p,()=>H.inspect());await evaluate(p,kind=>H.change(kind),kind);await evaluate(p,()=>H.continue());await evaluate(p,()=>H.retry());const f=await facts(p);assert.equal(f.view.state,'STALE');assert.equal(f.counters.original,0);assert.equal(f.counters.award,0);const after=await evaluate(p,()=>H.inspect());assert.equal(after.items[0].sha256,before.items[0].sha256);return {kind,reason:f.view.reason,bridge:kind==='account-aba'?'test-only account label; no production account epoch':'actual original operation/native fault'};});
 for(const mode of ['switchAfterAppend','switchAfterRead','throwAfterRead','changedRead'])await test('settlement boundary '+mode+' never continues',async()=>{const {p,f}=await restored(F.phases[0],{[mode]:true});assert(['STALE','BLOCKED'].includes(f.view.state));assert.equal(f.counters.original,0);await evaluate(p,()=>H.continue());assert.equal((await facts(p)).counters.original,0);return {mode,state:f.view.state,reason:f.view.reason};});
 await test('cloud startup restore reload is inspection-only and new gate EMPTY',async()=>{const {p}=await restored();const before=await evaluate(p,()=>H.inspect());const staged=await evaluate(p,()=>H.stageStartupRestore());assert.equal(staged.view.state,'STALE');await bounded(p.reload(),'legitimate reload');await importFixture(p);const after=await evaluate(p,()=>H.setupInspection());assert.equal(after.gate.state,'EMPTY');assert.equal(after.original,0);assert.equal(after.items[0].sha256,before.items[0].sha256);assert.equal(await evaluate(p,()=>MKTYStorage.getItem('mkty_cloud_revision')),'41');assert.equal(await evaluate(p,()=>MKTYStorage.getItem('mkty_cloud_restore_pending')),null);return {selection:staged.selection,reloadedGate:'EMPTY',archiveRetained:true,resumed:false};});
 for(const phase of F.phases)for(let cut=0;cut<F.WRITE_MATRIX[phaseKey(phase)].length;cut++)await test('below-facade continuation fault '+phaseKey(phase)+' native write '+cut,async()=>{
  report.nativeCutpointsAttempted++;const {p,f}=await restored(phase);ready(f);await evaluate(p,cut=>H.armNative(cut),cut);const end=await go(p,phase);completed(end,phase);assert.equal(end.persistent,false);assert.equal(end.storageWarning,true);const rows=end.native.filter(r=>r.mode==='continuation');assert.equal(rows.length,cut+1);assert(rows.at(-1).injected);assert(rows.slice(0,-1).every(r=>r.success));assert.deepEqual(rows.map(sig),F.WRITE_MATRIX[phaseKey(phase)].slice(0,cut+1));
  const target=end.logicalSnapshot,prefix={...f.nativeSnapshot};for(const row of rows.filter(r=>r.success))row.kind==='set'?prefix[row.key]=row.value:delete prefix[row.key];mapEqual(end.nativeSnapshot,prefix);const different=Object.keys({...target,...prefix}).filter(k=>target[k]!==prefix[k]);// A failed idempotent write may leave an overlay even when all native values already match.
  if(cut===0){const failed=await evaluate(p,()=>H.retrySaving(3));assert.equal(failed.persistent,false);const again=await facts(p);assert.equal(again.counters.original,1);assert.equal(again.counters.award,end.counters.award);assert(again.native.filter(r=>r.mode===failed.mode&&r.success&&r.key!=='mkty_storage_probe').length>=1,'actual first overlay key flushed before retry fault');mapEqual(again.logicalSnapshot,target);}
  const recovery=await evaluate(p,()=>H.retrySaving());assert.equal(recovery.persistent,true);mapEqual(recovery.native,recovery.logical);mapEqual(recovery.logical,target);const saved=await facts(p);for(const row of saved.cutOutsideLogical)assert(['mkty_global_lives','mkty_life_restore_at','mkty_campaign_checkpoint_'+phase.chapter].includes(row.key),'Unexpected asynchronous logical write during recovery: '+row.key);assert.equal(saved.storageWarning,false);assert.deepEqual(saved.counters,end.counters);await duplicates(p);report.nativeCutpoints++;return {phase:phaseKey(phase),cut,logicalMutationCount:end.logical.length,nativeSuccessfulPrefix:cut,differingKeys:different,originalCalls:1,awardCalls:end.counters.award,pointDelta:Number(target.mkty_points)-100,midflushFailure:cut===0,exactNativeTargetAfterRetry:true,persistentAfterFault:end.persistent,destination:{active:end.active,chapterStage:end.chapterStage},nativePrefix:rows,overlayDifferences:different.map(key=>({key,native:prefix[key]??null,logical:target[key]??null})),effects:Object.fromEntries([F.sourceKey(phase.chapter),F.storyKey(phase.chapter),'mkty_spatial_report_'+phase.chapter,'mkty_life'+phase.chapter,'mkty_life'+phase.chapter+'_awarded','mkty_points'].map(key=>[key,target[key]??null])),logicalMutationSequence:end.logical,backgroundDuringRecovery:saved.cutOutsideLogical};
 });
 await test('caught callback throw consumes gate without replay; remainder excluded',async()=>{const {p}=await restored(F.phases[1],{throwOriginal:true});await p.locator('#finaleContinue').click();const f=await facts(p);assert.equal(f.view.state,'CONTINUED');assert.equal(f.view.reason,'navigation-threw');assert.equal(f.counters.original,1);assert.equal(f.counters.award,0);await duplicates(p);return {originalWrapperCalls:1,remainder:'intentionally excluded by injected throw; no settlement or replay claim'};});
 assert.equal(report.tests.length,EXPECTED_CASES,'all finite native cases run');assert.equal(pageSerial,EXPECTED_CASES,'one fresh context per native case');report.freshContexts=pageSerial;assert.equal(report.nativeCutpointsAttempted,37,'all native cutpoint cases attempted');report.failedCases=report.tests.filter(row=>row.status!=='passed').map(row=>row.name);assert.equal(report.failedCases.length,0,'Native case failures: '+report.failedCases.join('; '));assert.equal(report.nativeCutpoints,37,'finite matrix must run every pinned cutpoint');assert.equal(report.pageErrors.length,0);report.status='passed';save();
})().catch(error=>{report.status='failed';report.error=error.stack;save();console.error(error);process.exitCode=1;}).finally(async()=>{for(const [target,label]of [[context,'final context close'],[browser,'browser close']])if(target)try{await bounded(target.close(),label);}catch(error){report.status='failed';(report.cleanupErrors??=[]).push({label,error:String(error.message)});process.exitCode=1;}if(report.pageErrors.length||report.consoleErrors.some(r=>!r.expectedBlockedResource)||report.network.rejected.some(r=>!r.expected)){report.status='failed';report.lateDiagnosticFailure='Unexpected page/console/network diagnostics, including final cleanup';process.exitCode=1;}save();if(report.status==='passed')console.log('PASS native finale controller: '+report.tests.length+' cases; 37 exact native write cutpoints.');});
