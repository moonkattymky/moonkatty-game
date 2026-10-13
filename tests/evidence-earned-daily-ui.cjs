'use strict';
/* Approved GitHub CI only. Fixed synthetic HTTPS interception, no listener.
 * Native field clicks earn 9.2; a trusted iframe click runs the original daily IIFE.
 */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {execFileSync}=require('node:child_process');
const F=require('./evidence-finale-controller-fixture.cjs'),R=require('../field-model.js'),Codec=require('../trace-codec.js');
const ROOT=F.root,DIR='tests/fixtures/evidence-earned-daily/',ORIGIN='https://earned-daily-fixture.test';
const OUT=process.env.MKTY_TEST_OUTPUT||path.join(os.tmpdir(),'mkty-evidence-earned-daily-native');
const REPORT=path.join(OUT,'native-earned-daily-results.json'),CAP=1016832,BRIDGE=32768;
const BASELINE={publicHead:'832a2284',tree:'5f5a5697006e88a50ab09fbfbcf45990c46bc779',
  sourceSetSha256:'1ae83c53ff49cc019b85f9c7039aebac84a40b8b446e20a8d934a7b90223a550'};
const report={status:'not-run',tests:[],input:[],network:{fulfilled:0,rejected:[],originalLoads:[]},pageErrors:[],consoleErrors:[],realms:0,reloads:0,
  qualifications:{baseline:BASELINE,sourceOnly:true,disposableGuest:true,
    input:'Trusted Playwright field and original iframe button clicks; read-only layout robot. Parent field Date, timers and RAF are real. No complete() call or injected won checkpoint.',
    prerequisites:'Declared synthetic prior chapter 9 tasks, operations, legacy and precision 1/1; starting guest points 2100. Only final phase 9.2 is actually earned.',
    originalDaily:'Exact hash-pinned daily-retention.js and original dailyOps DOM in a permanent private child realm. Child-only UTC Date is fixed to adoption day. First-day offline check-in only; original async helper return is not intercepted.',
    scheduling:'One serialized canonical shared owner. Daily speculation is quiesced and its private read map emptied before owner dispatch. No overlapping physical transaction or cross-page CAS claim.',
    rollover:'Actual UTC admission day by default. Explicit test-only parent admission-day seams model pre-click and post-capture rollover; the field clock is never changed.',
    durability:'Native strict-hint transaction completion/readback and graceful document reloads. No power-loss, process-kill, eviction or origin deletion guarantee.',
    resources:'Encoded owner representations plus distinct fixed 32768-byte fixture bridge allowance stay within 1016832. Original DOM/IIFE closure and bounded report/history observations are separately excluded; not heap/RSS measurement.',
    reportEvidence:'All returned budget and native events are asserted. Reports retain their count/hash, peaks, raw/workspace transitions, native receipt/readback ordering and named state snapshots; full event streams are executed-only evidence except on failure.',
    context:'Small legal chapter 9 context and measured phase packet. No general maximum 65536-byte context plus maximum-phase claim.',
    exclusions:'No fully earned preceding campaign, real player data, signed/server rewards, production UI integration, runtime activation, general reset/migration or physical-device acceptance.'}};
let browser,context,page,current='',routes,cache,timer,expired=false;
const git=(...args)=>execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();
const sourceHashes=files=>Object.fromEntries([...new Set(files)].sort().map(file=>[file,F.sha(fs.readFileSync(path.join(ROOT,file)))]));
function save(){fs.mkdirSync(OUT,{recursive:true});const text=JSON.stringify(report,null,2)+'\n';assert(Buffer.byteLength(text)<=16*1024*1024,'Bounded native report');fs.writeFileSync(REPORT,text);}
function prepare(){
  const prototype=fs.readdirSync(path.join(ROOT,'prototypes/evidence-indexeddb')).filter(x=>x.endsWith('.mjs')).map(x=>'prototypes/evidence-indexeddb/'+x);
  const runtime=JSON.parse(fs.readFileSync(path.join(ROOT,'tests/fixtures/evidence-finale-controller/runtime-hashes.json')));
  const frozen=[...Object.keys(runtime.hashes),...prototype,'tests/fixtures/evidence-indexeddb/native-harness.js',
    'tests/evidence-finale-controller-fixture.cjs','tests/evidence-shared-owner-helper.cjs','tests/fixtures/finale-checkpoints-17-state.json'];
  const hashes=sourceHashes(frozen);assert.equal(F.sha(JSON.stringify(hashes)),BASELINE.sourceSetSha256,'Frozen 141 prototype and runtime');
  for(const [file,expected]of Object.entries(runtime.hashes))assert.equal(hashes[file],expected,'Frozen runtime '+file);
  routes=F.resources();routes.set('/',DIR+'index.html');
  const added=fs.readdirSync(path.join(ROOT,DIR)).map(x=>DIR+x);
  for(const file of added)routes.set('/'+file,file);
  routes.set('/tests/fixtures/evidence-phase-session/input-fence.mjs','tests/fixtures/evidence-phase-session/input-fence.mjs');
  cache=new Map([...new Set(routes.values())].map(file=>[file,fs.readFileSync(path.join(ROOT,file))]));
  const tests=fs.readdirSync(path.join(ROOT,'tests')).filter(x=>x.startsWith('evidence-earned-daily')).map(x=>'tests/'+x);
  report.sourceHashes=sourceHashes([...cache.keys(),...frozen,...added,...tests,
    'prototypes/evidence-indexeddb/EARNED-DAILY-INTEGRATION-CONTRACT.txt','.github/workflows/evidence-indexeddb-tests.yml','.github/workflows/model-tests.yml','package-lock.json']);
  report.resourceCache={files:cache.size,bytes:[...cache.values()].reduce((n,b)=>n+b.length,0)};
  assert(report.resourceCache.files<=220&&report.resourceCache.bytes<=32*1024*1024);
  const source=fs.readFileSync(path.join(ROOT,DIR+'fixture.mjs'),'utf8'),child=fs.readFileSync(path.join(ROOT,DIR+'daily.mjs'),'utf8');
  assert(!/page\.clock|setFixedTime|setSystemTime/.test(source));assert(!/originalComplete\(|awardLifePoints\(9|MKTYRewards\.completeLife\(/.test(source));
  assert(!/owner\.context\(/.test(source),'Shared owner has no context capability');
  assert(source.includes('createSharedGuestOwner')&&source.includes('terminalIntent')&&source.includes('recoverFinaleContext'));
  assert(child.includes('/daily-retention.js'),'Original IIFE is loaded rather than reimplemented');
  for(const name of ['app.js','chapter-space.js','rewards-client.js','cloud-save.js','storage.js'])assert(!source.includes("script('/"+name+"')"));
  const index=fs.readFileSync(path.join(ROOT,'index.html'),'utf8'),html=fs.readFileSync(path.join(ROOT,DIR+'daily.html'),'utf8');
  assert(!index.includes('evidence-earned-daily'));
  const originalDaily=index.match(/<section id="dailyOps"[\s\S]*?<\/section>/)?.[0];
  assert(originalDaily);assert.equal(html.match(/<section id="dailyOps"[\s\S]*?<\/section>/)?.[0],originalDaily,'Byte-exact original dailyOps DOM');
  report.originalDailyDom={sha256:F.sha(originalDaily),bytes:Buffer.byteLength(originalDaily)};
}
async function bounded(promise,label,ms=60000){let t;try{return await Promise.race([promise,new Promise((_,reject)=>{t=setTimeout(()=>reject(Error('Deadline: '+label)),ms);})]);}finally{clearTimeout(t);}}
async function ready(p=page){await p.waitForFunction(()=>window.atomicFixtureReady===true);assert.equal(await p.evaluate(()=>window.atomicBootstrapError||null),null);}
async function fresh(order='daily-first'){
  if(context)await context.close();context=await browser.newContext({viewport:{width:900,height:900},serviceWorkers:'block'});
  await context.addInitScript(()=>{if(window===window.top&&!sessionStorage.getItem('native-sentinel-initialized')){localStorage.setItem('mkty_pending_v2_unrelated','unrelated-pending-sentinel');sessionStorage.setItem('native-sentinel-initialized','yes');}});
  await context.route('**/*',route=>{
    const u=new URL(route.request().url()),file=u.origin===ORIGIN?routes.get(u.pathname):null;
    if(!file||route.request().method()!=='GET'){assert(report.network.rejected.length<64);report.network.rejected.push({test:current,url:u.href,method:route.request().method()});return route.abort('blockedbyclient');}
    report.network.fulfilled++;if(['/daily-retention.js','/field-missions.js','/legacy.js'].includes(u.pathname))report.network.originalLoads.push({test:current,path:u.pathname,sha256:F.sha(cache.get(file))});
    return route.fulfill({body:cache.get(file),contentType:({'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.mp4':'video/mp4'})[path.extname(file)]||'application/octet-stream'});
  });
  await context.routeWebSocket('**/*',socket=>{assert(report.network.rejected.length<64);report.network.rejected.push({test:current,url:socket.url(),kind:'websocket'});socket.close();});
  page=await context.newPage();report.realms++;page.setDefaultTimeout(15000);
  page.on('pageerror',e=>{assert(report.pageErrors.length<64);report.pageErrors.push({test:current,error:e.message});});
  page.on('console',m=>{if(m.type()==='error'){assert(report.consoleErrors.length<64);report.consoleErrors.push({test:current,text:m.text(),url:m.location().url});}});
  await page.goto(ORIGIN+'/?order='+order);await ready();return facts();
}
const facts=()=>page.evaluate(()=>H.facts());
function input(kind,target){assert(!expired);assert(report.input.length<2048);report.input.push({test:current,n:report.input.length,at:Date.now(),kind,target});}
async function click(selector){input('click',selector);await page.locator(selector).click();}
function operationErrorProof(f,expectedError=null){
  assert(expectedError===null||typeof expectedError==='string');
  assert.equal(f.operationError===null?null:f.operationError.split('\n',1)[0],expectedError);
}
async function settled(state,expectedError=null){await page.waitForFunction(()=>H.settled);const f=await facts();operationErrorProof(f,expectedError);if(state)assert.equal(f.view.state,state,JSON.stringify(f.view));return f;}
const sharedRows=f=>f.transport.filter(x=>x.run?.startsWith('fshared1:')&&['append','exact-retry'].includes(x.kind));
const writes=f=>f.nativeEvents.filter(x=>x.type==='transaction'&&x.mode==='readwrite'&&!x.fixture).length;
function noOldEffects(f){assert.deepEqual([f.counters.award,f.counters.rewards,f.counters.original],[0,0,0]);assert.equal(f.pendingQueueText,'unrelated-pending-sentinel');assert(!f.transport.some(x=>x.run?.startsWith('fcommit1:')));}
function ledger(f){
  const b=f.budget,j=f.jointBudget;assert.equal(b.ceiling,CAP);assert(b.live<=b.peak&&b.peak+BRIDGE<=CAP);assert.equal(j.allowance,BRIDGE);assert(j.peak<=CAP);
  assert(j.budgetEvents.length>0&&j.budgetEvents.length<=20000);assert(j.bridgeBytes<=BRIDGE);
  for(const e of j.budgetEvents){assert.equal(e.ceiling,CAP);assert(e.live+BRIDGE<=CAP);if(e.reservations['phase-workspace'])assert.equal(e.reservations['raw-capsule'],0);}
  assert.equal(b.reservations['raw-capsule'],f.phaseRetryReason?65536:0,'Raw input is retained only for its pending exact retry');
  for(const name of ['phase-workspace','private-phase','context-retained','context-parse','context-restore','reload-phase-retained'])assert.equal(b.reservations[name],0,'Released '+name);
  if(j.P){assert(j.P<=16384);assert(j.T>0&&j.T<=16384);assert(967680+j.T+2*j.P<=CAP);}
  if(f.daily){assert(f.daily.bridgePeakBytes<=BRIDGE);assert(f.daily.bridgeBytes<=BRIDGE);if(['SAVED','UNSAVED','BLOCKED'].includes(f.daily.state)){assert(f.daily.privateBytes<=4);assert.equal(f.daily.privateEntries,0);assert.equal(f.daily.quiesced,true);}}
}
function canonical(f,points,revision=2){
  noOldEffects(f);ledger(f);assert.equal(f.view.state,'READY');assert.equal(f.view.continueEnabled,true);assert.equal(f.view.revision,revision);
  assert.equal(f.view.values.mkty_points,String(points));assert.equal(f.cache.mkty_points,String(points));assert.equal(f.cache.mkty_final_moon_points,String(points));
  assert.equal(f.cache.mkty_life9,'complete');assert.equal(f.cache.mkty_life9_awarded,'yes');assert.equal(f.cache.mkty_field_finale_9_v1,null);
  assert.equal(JSON.parse(f.cache.mkty_story_plan_9_v1).phase,'complete');assert.equal(f.playEnabled,false);assert.equal(f.physicalBusy,false);assert.equal(f.retainedBytes,0);
  assert.equal(f.blockedReads,0);assert.equal(f.cacheSuspended,false);assert(f.derivedCacheBytes>0&&f.derivedCacheBytes<=8192);
}
function bootstrap(f){
  const hydrated=f.events.find(e=>e.type==='canonical-hydrated'&&['ACTIVE','READY'].includes(e.state)),facade=f.events.find(e=>e.type==='facade-installed'),first=f.events.find(e=>e.type==='legacy-evaluation-start');
  assert(hydrated&&facade&&first);assert(hydrated.n<facade.n&&facade.n<first.n);assert(['ACTIVE','READY'].includes(facade.ownerState));
  assert.deepEqual(f.loadOrder,['/field-art.js','/legacy.js','/field-missions.js']);
}
function nativeProof(f){
  const active=new Set(),receipts=[];let peak=0,digests=0;
  assert(f.nativeEvents.length<=20000&&f.transport.length<=1024);
  for(const e of f.nativeEvents){
    if(e.type==='transaction'&&!e.fixture){active.add(e.tx);peak=Math.max(peak,active.size);if(e.mode==='readwrite')assert.equal(e.durability,'strict');}
    if(['complete','abort'].includes(e.type))active.delete(e.tx);
    if(e.type==='digest'){digests++;assert(e.bytes<=66048);assert.deepEqual(e.activeTransactions,[]);}
    if(e.type==='request'&&!e.fixture)assert(!['getAll','getAllKeys','openCursor','openKeyCursor','count'].includes(e.kind));
  }
  assert(peak<=1);assert.equal(active.size,f.nativePhysical);assert.equal(active.size,0);assert(digests>0);
  for(const row of f.transport.filter(x=>x.result&&!['refused'].includes(x.result.status))){assert(row.diagnostics);assert(row.diagnostics.peakAccountedBytes<=393216);}
  for(const row of sharedRows(f).filter(x=>['committed','duplicate'].includes(x.result?.status))){
    const r=row.result.receipt,h=row.result.currentHead;assert(h&&h.ordinal>=r.ordinal);if(h.ordinal===r.ordinal){assert.equal(h.token,r.headToken);assert.equal(h.root,r.root);}
    assert(row.diagnostics.requestBytes>16384&&row.diagnostics.requestBytes<=20480);assert.equal(row.diagnostics.inputCopyBytes,row.kind==='exact-retry'?0:16384);
    assert.equal(r.acknowledgement,'idb-transaction-complete');assert.equal(r.durability,'strict');assert.equal(r.ordinal,row.ordinal);assert.equal(r.length,16384);assert.equal(r.sealed,row.ordinal===2);
    assert.equal(r.captureIdentity.run,row.run);assert.equal(r.captureIdentity.scope,f.view.manifest.scope);
    const ev=f.nativeEvents.slice(row.startNativeIndex,row.endNativeIndex),tx=ev.find(x=>x.type==='transaction'&&x.mode==='readwrite'&&!x.fixture);assert(tx);
    const completed=ev.find(x=>x.type==='complete'&&x.tx===tx.tx);assert(completed,'Native completion precedes acknowledgement');
    const settledEvent=f.events.find(e=>e.type==='settled'&&e.nativeIndex>=row.endNativeIndex&&['ACTIVE','READY'].includes(e.state));assert(settledEvent);
    const daily=row.command?.kind==='daily',dailyEvents=daily?f.events.filter(e=>e.frameGeneration===f.daily.frameGeneration):[];
    const acknowledged=daily?dailyEvents.find(e=>e.type==='daily-readback'):settledEvent;
    const published=daily?dailyEvents.find(e=>e.type==='daily-saved'):settledEvent;
    assert(acknowledged&&published,'Daily source success must have its own readback/publication barrier');
    const read=f.transport.find(x=>x.kind==='read'&&x.run===row.run&&x.afterOrdinal>=row.ordinal-1&&x.throughHead===h.token&&x.startNativeIndex>=row.endNativeIndex&&x.endNativeIndex<=acknowledged.nativeIndex&&x.result?.status==='page');assert(read,'Native readback before publication');
    const re=f.nativeEvents.slice(read.startNativeIndex,read.endNativeIndex),rt=re.find(x=>x.type==='transaction'&&x.mode==='readonly'&&!x.fixture);assert(rt);
    const readComplete=re.find(x=>x.type==='complete'&&x.tx===rt.tx);assert(readComplete);
    let dailyOrder=null;
    if(daily){
      assert.equal(acknowledged.revision,r.ordinal);assert.equal(published.revision,r.ordinal);
      const capture=dailyEvents.find(e=>e.type==='daily-capture'),drain=dailyEvents.find(e=>e.type==='daily-drain'),quiesce=dailyEvents.find(e=>e.type==='daily-quiesce');
      const dispatch=dailyEvents.filter(e=>e.type==='daily-dispatch'&&e.nativeIndex<=row.startNativeIndex).at(-1);
      assert(capture&&drain&&quiesce&&dispatch);assert(capture.n<drain.n&&drain.n<quiesce.n&&quiesce.n<dispatch.n&&dispatch.n<acknowledged.n&&acknowledged.n<published.n&&published.n<settledEvent.n);
      for(const boundary of [acknowledged,published])assert(boundary.nativeIndex>=completed.n&&boundary.nativeIndex>=readComplete.n);
      dailyOrder=[capture,drain,quiesce,dispatch,acknowledged,published].map(e=>({type:e.type,event:e.n,nativeIndex:e.nativeIndex}));
    }
    receipts.push({ordinal:r.ordinal,status:row.result.status,writeComplete:completed.n,readComplete:readComplete.n,publishedAt:published.nativeIndex,publication:published.type,...(dailyOrder?{dailyOrder}: {})});
  }
  return {peakPhysicalTransactions:peak,physicalAtSnapshot:f.nativePhysical,adapterBusyAtSnapshot:f.physicalBusy,retainedBytesAtSnapshot:f.retainedBytes,digests,eventCount:f.nativeEvents.length,eventSha256:F.sha(JSON.stringify(f.nativeEvents)),receipts};
}
function evidence(f){const transfers=f.jointBudget.budgetEvents.filter(x=>['reserve','release'].includes(x.type)&&['raw-capsule','phase-workspace'].includes(x.label));assert(transfers.length<=256);return {view:f.view,counters:f.counters,daily:f.daily,phasePin:f.phasePin,terminalIntent:f.terminalIntent,earnedText:f.earnedText,
  budget:f.budget,phaseRetryReason:f.phaseRetryReason,rawPending:f.rawPending,jointBudget:{...f.jointBudget,budgetEvents:undefined,eventCount:f.jointBudget.budgetEvents.length,eventSha256:F.sha(JSON.stringify(f.jointBudget.budgetEvents)),retainedTransitions:transfers},
  events:f.events,sealedReadback:f.sealedReadback,trustedInputs:f.trustedInputs,transport:sharedRows(f),native:nativeProof(f)};}
async function start(order){
  await fresh(order);const before=await facts();assert.equal(before.active,'atomicSetup');assert.deepEqual(before.loadOrder,[]);await click('#atomicStart');
  const f=await settled('ACTIVE');assert.equal(f.view.values.mkty_points,'2100');assert.equal(f.daily.originalClicks,0);assert.equal(f.view.revision,0);
  assert.equal(f.daily.state,order==='terminal-first'?'PAUSED':'PREPARED');assert.equal(f.counters.opens,order==='terminal-first'?1:0);assert.equal(await page.locator('#dailyFrame').isVisible(),order==='daily-first');return f;
}
async function dailyClick(expectedError=null){
  const frame=page.frameLocator('#dailyFrame');await frame.locator('#streakBtn').waitFor({state:'visible'});assert.equal(await frame.locator('#streakBtn').isEnabled(),true);
  input('trusted-child-click','#dailyFrame #streakBtn');await frame.locator('#streakBtn').click();return settled(undefined,expectedError);
}
function dailyProof(f,delta){
  const d=f.daily;assert.equal(d.state,'SAVED');assert.equal(d.committed,true);assert.equal(d.originalClicks,1);assert.equal(d.expected.delta,delta);
  assert.equal(d.expected.nominalFlash,'Check-in +3 ⭐');assert.equal(d.receipt.delta,delta);assert.equal(d.receipt.legacyResult.points,3);
  assert.equal(d.expected.dailyText,f.view.values.mkty_daily_demo);assert.equal(d.sourceHash,report.sourceHashes['daily-retention.js']);assert.deepEqual(d.errors,[]);
  assert.equal(d.lastInput?.isTrusted,true);assert.equal(d.lastInput.target,'streakBtn');assert.equal(d.lastInput.prevented,false);assert(d.privateBytes<=4);assert.equal(d.privateEntries,0);assert.equal(d.quiesced,true);
  assert.equal(d.expected.taskFence,'next-task');assert.equal(d.expected.buttonDisabled,true);assert.equal(d.expected.buttonText,delta===3?'CHECKED IN ✓':'BALANCE LOCKED');
  assert.deepEqual(d.expected.writes.map(x=>x.key),delta===3?['mkty_daily_demo','mkty_points']:['mkty_daily_demo']);
  for(const row of d.expected.writes)assert.equal(row.value,row.key==='mkty_daily_demo'?d.expected.dailyText:d.expected.pointsText);
  assert.equal(d.expected.pointsText,f.view.values.mkty_points);ledger(f);
}
async function earn({fault,reserveFault,waitClock=false}={}){
  let f=await facts();assert.equal(f.counters.opens,1);assert.equal(f.active,'fieldMission');assert.equal(f.fieldDialogOpen,true);assert.equal(f.model.complete,false);assert.equal(f.model.trace.length,0);
  bootstrap(f);await click('#fieldResume');if(reserveFault)await page.evaluate(label=>H.failReserve(label),reserveFault);if(fault)await page.evaluate(kind=>H.arm(kind),fault);
  const initial=(await facts()).model;assert.equal(initial.seed,16569);assert.equal(initial.stability,87);assert.deepEqual(initial.mods,{charges:1,stability:17,preview:1});
  if(waitClock){await page.waitForFunction(()=>MKTYField.snapshot().seconds>=1,{},{timeout:5000});assert((await facts()).model.seconds>=1);}
  let steps=0;while(true){f=await facts();const s=f.model;assert(f.playEnabled);assert.equal(f.active,'fieldMission');assert.equal(f.fieldDialogOpen,false);assert(!s.failed);assert.equal(s.errors,0);assert.equal(s.attempt??0,0);assert.equal(s.failures??0,0);if(s.complete)break;assert(++steps<=20);
    const decision=R.layout(s).aligned(s.turn)?'launch':s.charges>0?'boost':'wait';await click(decision==='launch'?'#fieldSubmit':'[data-field-action="'+decision+'"]');
  }
  const won=(await facts()).model;assert.equal(won.home,3);assert.equal(won.stability,51);assert(R.won(won));assert(R.restore(won,11,4,16569));assert(won.trace.length>0);
  const clock=await page.evaluate(()=>({now:Date.now(),name:Date.name}));assert.equal(clock.name,'Date');assert(Math.abs(clock.now-Date.now())<2000);
  await click('#fieldSubmit');await page.waitForFunction(()=>H.facts().counters.captures===1);f=await settled();assert.equal(f.counters.captures,1);assert.equal(f.counters.opens,1);
  const captured=JSON.parse(f.earnedText);assert.equal(f.earnedText,Codec.stringify(won,8192,'earned-limit'));assert.deepEqual(captured.trace,won.trace);assert.equal(captured.seconds,won.seconds);assert(R.restore(captured,11,4,16569)&&R.won(captured));
  assert.equal(f.earnedText,Codec.stringify(captured,8192,'earned-limit'));assert(f.terminalIntent);assert(f.terminalIntent.storyAccumulated>=clock.now&&f.terminalIntent.lock<=await page.evaluate(()=>Date.now()));
  assert(f.trustedInputs.filter(x=>x.playEnabled).length>=steps+1);assert(f.trustedInputs.every(x=>x.isTrusted));assert(f.trustedInputs.some(x=>x.target==='fieldSubmit'&&x.playEnabled));
  if(!reserveFault)phaseProof(f);noOldEffects(f);ledger(f);return {steps,raw:f.earnedText,seconds:captured.seconds,facts:f};
}
function phaseProof(f){
  const proof=f.sealedReadback;assert(proof,'Authenticated sealed phase readback');
  assert.equal(proof.checkpointText,f.earnedText);assert.deepEqual(JSON.parse(proof.sourceText).checkpoint,JSON.parse(f.earnedText));
  assert.deepEqual(proof.terminalIntent,f.terminalIntent);assert.deepEqual(proof.phasePin,f.phasePin);assert.equal(f.phasePin.head.sealed,true);
  assert.deepEqual(Object.keys(f.terminalIntent).sort(),['lock','pace','report','storyAccumulated','storyCompleted']);
  const times=Object.values(f.terminalIntent);assert(times.every(x=>Number.isSafeInteger(x)&&x>0));
  const callback=f.events.find(x=>x.type==='earned-controller-callback'),verified=f.events.find(x=>x.type==='phase-readback-verified');assert(callback&&verified);assert(callback.n<verified.n);
  const rows=f.transport.filter(x=>x.run===f.phasePin.descriptor.run),write=rows.find(x=>x.kind==='append'&&x.result?.status==='committed');assert(write);
  assert.equal(write.result.receipt.acknowledgement,'idb-transaction-complete');assert.equal(write.result.receipt.durability,'strict');assert.equal(write.result.receipt.length,f.jointBudget.P);
  assert(callback.nativeIndex<=write.startNativeIndex);const ev=f.nativeEvents.slice(write.startNativeIndex,write.endNativeIndex),tx=ev.find(x=>x.type==='transaction'&&x.mode==='readwrite');assert(tx&&ev.some(x=>x.type==='complete'&&x.tx===tx.tx));
  const read=rows.find(x=>x.kind==='read'&&x.throughHead===f.phasePin.head.token&&x.startNativeIndex>=write.endNativeIndex&&x.endNativeIndex<=proof.nativeIndex&&x.result?.status==='page');assert(read,'Sealed phase readback before terminal dispatch');
  for(const row of sharedRows(f).filter(x=>x.command?.kind==='terminal')){assert.deepEqual(row.command.phasePin,f.phasePin);assert.deepEqual(row.command.timestamps,f.terminalIntent);assert(row.startNativeIndex>=proof.nativeIndex);}
  for(const e of f.events.filter(x=>x.type==='owner-dispatch'&&x.label==='terminal'))for(const slot of ['raw-capsule','phase-workspace','private-phase','context-retained','context-parse','context-restore','reload-phase-retained'])assert.equal(e.reservations[slot],0,'Released before terminal '+slot);
}
async function history(){return page.evaluate(()=>H.history());}
function historyCheck(h,order,points,intent){
  assert.equal(h.records.length,3);assert.deepEqual(h.records.map(x=>x.revision),[0,1,2]);assert.deepEqual(h.records.slice(1).map(x=>x.command.kind),order);
  const m=h.records[0].manifest,d=h.records.find(x=>x.command?.kind==='daily'),t=h.records.find(x=>x.command?.kind==='terminal'),end=h.records[2].stateAfter;
  assert.equal(m.baseline.points,2100);assert.equal(t.receipt.delta,3000);assert.equal(d.receipt.delta,order[0]==='daily'?3:0);assert.equal(d.receipt.legacyResult.points,3);
  assert.equal(d.command.ticket.revision,0);assert.equal(d.command.ticket.day,m.dailyDay);assert.deepEqual(t.command.timestamps,intent);
  assert.deepEqual([end.points,end.locked],[points,true]);const daily=JSON.parse(end.dailyText),original=JSON.parse(m.dailyText);
  assert.deepEqual([daily.streak,daily.last_day],[1,m.dailyDay]);for(const key of ['attempts','solved','cipher','opaque','shield_week','cday'])assert.deepEqual(daily[key],original[key]);
  assert.deepEqual(daily.codes,(Array.isArray(original.codes)?original.codes:[]).filter(x=>typeof x==='string'));
  assert.deepEqual(h.prefixes.map(x=>[x.head.ordinal,x.head.total,x.head.sealed]),[[0,16384,false],[1,32768,false],[2,49152,true]]);
}
async function reload(){report.reloads++;await page.reload();await ready();const f=await settled();assert.equal(f.counters.captures,0);assert.equal(f.counters.opens,0);assert.equal(f.daily?.originalClicks??0,0);assert(!['PREPARED','SAVING'].includes(f.daily?.state));noOldEffects(f);return f;}
async function epilogue(points){
  await click('#atomicContinue');let f=await facts();assert.equal(f.epilogueOpen,true);assert.match(f.epilogueText,/Moonkatty is home/);assert.match(f.epilogueText,/1 \/ 1/);assert.match(f.epilogueText,/answered and shielded/);
  await click('[data-legacy-choice="done"]');f=await facts();assert.equal(f.active,'atomicHome');assert.equal(f.epilogueOpen,false);canonical(f,points);await click('#atomicReview');assert.equal((await facts()).active,'atomicResult');return f;
}
async function test(name,run,ms=90000){
  current=name;const row={name,status:'running'};report.tests.push(row);save();const t=Date.now();
  try{row.details=await bounded(run(),name,ms);row.status='passed';console.log('PASS earned-daily: '+name);}
  catch(e){row.status='failed';row.error=e.stack;try{row.failure=await facts();}catch{}throw e;}finally{row.ms=Date.now()-t;save();}
}
async function main(){
  if(process.env.GITHUB_ACTIONS!=='true'||process.env.CI!=='true')throw Error('Native earned-daily fixture is approved GitHub CI only; local browser/listener execution is not authorized.');
  prepare();report.commit=git('rev-parse','HEAD');report.tree=git('rev-parse','HEAD^{tree}');report.workflowSha=process.env.GITHUB_SHA;
  assert.equal(report.commit,report.workflowSha);
  assert.equal(git('status','--porcelain'),'');
  const {chromium}=require('playwright');
  assert.equal(require('playwright/package.json').version,'1.58.2');browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--disable-back-forward-cache']});
  report.versions={node:process.version,playwright:'1.58.2',chromium:browser.version()};report.status='running';
  for(const order of ['daily-first','terminal-first'])await test(order+' genuinely earned 9.2, original daily click, two reloads and epilogue',async()=>{
    const adopted=await start(order);let daily,played;
    if(order==='daily-first'){daily=await dailyClick();dailyProof(daily,3);
    assert.equal(daily.view.values.mkty_points,'2103');played=await earn({waitClock:true});}
    else{played=await earn({waitClock:true});canonical(played.facts,5100,1);daily=await dailyClick();dailyProof(daily,0);}
    const result=await facts(),points=order==='daily-first'?5103:5100;canonical(result,points);const h=await history(),sequence=order==='daily-first'?['daily','terminal']:['terminal','daily'];historyCheck(h,sequence,points,played.facts.terminalIntent);
    const writeCount=writes(await facts());await page.evaluate(()=>H.resubmit());const repeated=await settled('READY');canonical(repeated,points);
    assert.equal(writes(repeated),writeCount);
    assert.equal(repeated.counters.captures,1);
    assert.equal(repeated.daily.originalClicks,1);
    assert.deepEqual(repeated.view.values,result.view.values);
    assert.deepEqual((await history()).records,h.records);
    const stale=await page.evaluate(()=>H.staleWrites());
    assert.deepEqual(stale,Array.from({length:3},()=>({error:'fixture-owned-write-refused'})));canonical(await facts(),points);
    await page.evaluate(()=>H.changeNative());const first=await reload();canonical(first,points);bootstrap(first);
    assert.deepEqual(first.cache,result.cache);
    assert.equal(writes(first),0);
    await page.evaluate(()=>H.clearNative());const second=await reload();canonical(second,points);
    assert.deepEqual(second.cache,result.cache);
    assert.equal(writes(second),0);
    assert.deepEqual((await history()).records,h.records);
    await epilogue(points);const home=await epilogue(points);
    assert.equal(home.counters.epilogues,2);
    assert.equal(home.counters.home,2);
    assert.equal(writes(home),0);
    assert.deepEqual((await history()).records,h.records);return {admissionDay:adopted.view.manifest.dailyDay,played:{steps:played.steps,seconds:played.seconds,raw:played.raw},daily:evidence(daily),final:evidence(result),history:h,reloads:[evidence(first),evidence(second)],homeCounters:home.counters};
  });
  await test('original daily native abort and retry invokes original handler once',async()=>{
    await start('daily-first');await page.evaluate(()=>H.arm({kind:'abort',target:'daily'}));const failed=await dailyClick();
    assert.equal(failed.view.state,'UNSAVED');
    assert.equal(failed.daily.state,'UNSAVED');
    assert.equal(await page.locator('#dailyFrame').isVisible(),false);
    assert.equal(failed.daily.originalClicks,1);
    assert.equal(failed.counters.opens,0);
    assert(failed.nativeEvents.some(e=>e.type==='abort-requested-after-success'));
    assert.equal(failed.view.continueEnabled,false);
    assert.equal(failed.retainedBytes,0);ledger(failed);const staged=failed.daily.expected,writeCount=writes(failed);
    await page.waitForFunction(n=>H.facts().daily.timerSuppressed>n,failed.daily.timerSuppressed,{timeout:4000});
    const suppressed=await facts();
    assert.equal(suppressed.daily.state,'UNSAVED');
    assert.equal(suppressed.daily.originalClicks,1);
    assert.equal(suppressed.daily.privateEntries,0);
    assert.deepEqual(suppressed.daily.expected,staged);
    assert.equal(writes(suppressed),writeCount);
    await click('#dailyRetry');const retried=await settled('ACTIVE');dailyProof(retried,3);
    assert.equal(retried.daily.retries,1);
    assert.deepEqual(retried.daily.expected,staged);
    const attempts=sharedRows(retried).filter(x=>x.ordinal===1);
    assert.equal(attempts.length,2);
    assert.equal(attempts[0].payloadDigest,attempts[1].payloadDigest);
    assert.deepEqual(attempts[0].command,attempts[1].command);
    return {failure:evidence(failed),suppressedTimer:{before:failed.daily.timerSuppressed,after:suppressed.daily.timerSuppressed},retried:evidence(retried)};
  });
  for(const fault of ['abort','hold'])await test('earned terminal native '+fault+' retries immutable command with one callback',async()=>{
    await start('daily-first');await dailyClick();const played=await earn({fault});const failed=played.facts;
    assert.equal(failed.view.state,'UNSAVED');
    assert.equal(failed.counters.captures,1);
    assert.equal(failed.playEnabled,false);
    assert.equal(await page.locator('#atomicContinue').isDisabled(),true);
    if(fault==='abort')assert(failed.nativeEvents.some(e=>e.type==='abort-requested-after-success'));
    else{assert(failed.retainedBytes>0);
    assert(failed.nativeEvents.some(e=>e.type==='watchdog-native-due'));
    assert(failed.nativeEvents.some(e=>e.type==='watchdog-delivered'));const held=await page.evaluate(()=>H.heldTerminal);
    assert.equal(held.terminal,'complete');await page.evaluate(()=>H.releaseHeld());await page.waitForFunction(()=>!H.facts().physicalBusy);}
    await click('#atomicRetry');const result=await settled('READY');canonical(result,5103);
    assert.equal(result.counters.captures,1);
    assert.equal(result.earnedText,played.raw);
    assert.deepEqual(result.terminalIntent,failed.terminalIntent);
    const attempts=sharedRows(result).filter(x=>x.ordinal===2);
    assert.equal(attempts.length,2);
    assert.equal(attempts[0].payloadDigest,attempts[1].payloadDigest);
    assert.deepEqual(attempts[0].command,attempts[1].command);
    if(fault==='hold'){assert.equal(attempts[1].kind,'exact-retry');
    assert.equal(attempts[1].result.status,'duplicate');
    assert.equal(attempts[1].diagnostics.inputCopyBytes,0);
    assert.equal(attempts[1].diagnostics.touchedWrites,0);
    assert.equal(attempts[1].diagnostics.duplicateReadBytes,16384);}
    return {failure:evidence(failed),result:evidence(result)};
  });
  await test('reload from genuinely earned seal retries original five timestamps without reopening field',async()=>{
    await start('daily-first');await dailyClick();const played=await earn({fault:'seal-stop'}),sealed=played.facts;
    assert.equal(sealed.view.state,'ACTIVE');
    assert(sealed.phasePin?.head.sealed);
    assert.equal(sealed.playEnabled,false);
    assert.equal(sharedRows(sealed).filter(x=>x.ordinal===2).length,0);
    const intent=sealed.terminalIntent;
    assert.equal(Object.keys(intent).length,5);const before=await history();
    assert.equal(before.records.length,2);
    const restored=await reload();
    assert.equal(restored.view.state,'ACTIVE');
    assert.equal(restored.active,'atomicResult');
    assert.equal(restored.counters.opens,0);
    assert.deepEqual(restored.phasePin,sealed.phasePin);
    assert.deepEqual(restored.terminalIntent,intent);
    await click('#atomicRetry');const result=await settled('READY');canonical(result,5103);
    assert.equal(result.counters.captures,0);
    assert.deepEqual(result.terminalIntent,intent);historyCheck(await history(),['daily','terminal'],5103,intent);
    return {sealed:evidence(sealed),recovered:evidence(restored),result:evidence(result)};
  });
  await test('phase-workspace reservation refusal retains original capture for exact retry',async()=>{
    await start('daily-first');await dailyClick();const played=await earn({reserveFault:'phase-workspace'}),failed=played.facts;
    assert.equal(failed.operationError,null);
    assert.equal(failed.phaseRetryReason,'allocation-refused');
    assert.equal(failed.rawPending,true);
    assert.equal(failed.view.state,'ACTIVE');
    assert.equal(failed.view.values.mkty_points,'2103');
    assert.equal(failed.counters.captures,1);
    assert.equal(failed.phasePin,null);
    assert.equal(failed.sealedReadback,null);
    assert.equal(failed.playEnabled,false);
    assert.equal(failed.retainedBytes,0);
    assert.equal(failed.physicalBusy,false);
    assert.equal(sharedRows(failed).filter(x=>x.command?.kind==='terminal').length,0);
    assert.equal(failed.budget.reservations['raw-capsule'],65536);ledger(failed);
    const disposeRefusal=await page.evaluate(()=>{try{H.dispose();return null;}catch(e){return e.message;}});
    assert.equal(disposeRefusal,'fixture-dispose-busy');const retained=await facts();
    assert.equal(retained.rawPending,true);
    assert.equal(retained.budget.reservations['raw-capsule'],65536);
    assert.equal(retained.earnedText,played.raw);
    assert.deepEqual(retained.terminalIntent,failed.terminalIntent);
    assert.equal(await page.locator('#atomicRetry').isEnabled(),true);await click('#atomicRetry');const result=await settled('READY');canonical(result,5103);
    assert.equal(result.phaseRetryReason,null);
    assert.equal(result.rawPending,false);
    assert.equal(result.counters.captures,1);
    assert.equal(result.counters.opens,1);
    assert.equal(result.earnedText,played.raw);
    assert.deepEqual(result.terminalIntent,failed.terminalIntent);phaseProof(result);
    const h=await history();historyCheck(h,['daily','terminal'],5103,failed.terminalIntent);return {refused:evidence(failed),result:evidence(result),history:h};
  });
  await test('UTC rollover before trusted click prevents original writes and canonical insertion',async()=>{
    const initial=await start('daily-first'),mark=writes(initial),tomorrow=new Date(Date.parse(initial.view.manifest.dailyDay+'T00:00:00Z')+864e5).toISOString().slice(0,10);
    await page.evaluate(day=>H.setDay(day),tomorrow);const refused=await dailyClick();
    assert.equal(refused.daily.state,'BLOCKED');
    assert.equal(await page.locator('#dailyFrame').isVisible(),false);
    assert.match(refused.daily.reason,/day|rollover/);
    assert.equal(refused.daily.originalClicks,0);
    assert.equal(refused.daily.lastInput?.isTrusted,true);
    assert.equal(refused.daily.lastInput.prevented,true);
    assert.equal(refused.daily.committed,false);
    assert.equal(refused.daily.receipt,null);
    assert.equal(refused.daily.expected,null);
    assert.equal(refused.counters.opens,0);
    assert.equal(writes(refused),mark);
    assert.deepEqual(refused.view.head,initial.view.head);const h=await history();
    assert.equal(h.records.length,1);
    assert.deepEqual(h.records[0].manifest,initial.view.manifest);ledger(refused);
    return {admitted:initial.view.manifest.dailyDay,syntheticAdmissionDay:tomorrow,result:evidence(refused)};
  });
  await test('UTC rollover after original capture retains staged result but refuses insertion',async()=>{
    const initial=await start('daily-first'),mark=writes(initial),tomorrow=new Date(Date.parse(initial.view.manifest.dailyDay+'T00:00:00Z')+864e5).toISOString().slice(0,10);
    await page.evaluate(day=>H.rolloverAfterCapture(day),tomorrow);const refused=await dailyClick('Error: daily-bridge-shared-day-rollover');
    assert.equal(refused.view.state,'BLOCKED');
    assert.equal(refused.view.reason,'shared-day-rollover');
    assert.equal(refused.daily.reason,'daily-bridge-shared-day-rollover');
    assert.deepEqual(refused.daily.errors,['daily-bridge-shared-day-rollover']);
    assert.equal(refused.events.some(e=>['daily-readback','daily-saved'].includes(e.type)),false);
    const captured=refused.events.find(e=>e.type==='daily-capture');assert(captured);
    assert.equal(refused.nativeEvents.slice(captured.nativeIndex).some(e=>e.type==='transaction'&&e.mode==='readwrite'),false);
    assert.equal(sharedRows(refused).filter(row=>row.ordinal>0).length,0);
    assert.equal(refused.daily.state,'BLOCKED');
    assert.equal(await page.locator('#dailyFrame').isVisible(),false);
    assert.equal(refused.daily.originalClicks,1);
    assert.equal(refused.daily.lastInput?.isTrusted,true);
    assert.equal(refused.daily.lastInput.prevented,false);
    assert.equal(refused.daily.committed,false);
    assert.equal(refused.daily.receipt,null);
    assert.equal(refused.daily.expected.taskFence,'next-task');
    assert.equal(refused.daily.expected.delta,3);
    assert.equal(refused.daily.expected.nominalFlash,'Check-in +3 ⭐');
    assert.equal(refused.counters.opens,0);
    assert.equal(writes(refused),mark);
    assert.deepEqual(refused.view.head,initial.view.head);const h=await history();
    assert.equal(h.records.length,1);
    assert.deepEqual(h.records[0].manifest,initial.view.manifest);ledger(refused);
    return {admitted:initial.view.manifest.dailyDay,syntheticAdmissionDay:tomorrow,expectedOperationError:refused.operationError.split('\n',1)[0],result:evidence(refused)};
  });
  assert.deepEqual(report.network.rejected,[]);
  assert.deepEqual(report.pageErrors,[]);
  assert.deepEqual(report.consoleErrors,[]);
  assert(report.network.originalLoads.some(x=>x.path==='/daily-retention.js'));
  assert(report.network.originalLoads.some(x=>x.path==='/field-missions.js'));report.status='passed';save();
}
timer=setTimeout(()=>{expired=true;report.status='failed';report.deadline='Native earned-daily fixture exceeded 8 minutes';save();void browser?.close();process.exitCode=1;},480000);
main().catch(e=>{report.status='failed';report.error=e.stack;console.error(e.stack);process.exitCode=1;}).finally(async()=>{clearTimeout(timer);await browser?.close();save();});
