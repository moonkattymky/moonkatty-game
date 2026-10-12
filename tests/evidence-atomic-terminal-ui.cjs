'use strict';
/* Approved GitHub CI only. Synthetic HTTPS routing, no listener; unchanged gate
 * controls/model and real controller clock. Every terminal run is actually played.
 */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {execFileSync}=require('node:child_process');
const F=require('./evidence-finale-controller-fixture.cjs'),R=require('../field-model.js'),Codec=require('../trace-codec.js');
const ROOT=F.root,DIR='tests/fixtures/evidence-atomic-terminal/',ORIGIN='https://atomic-terminal-fixture.test';
const OUT=process.env.MKTY_TEST_OUTPUT||path.join(os.tmpdir(),'mkty-evidence-atomic-terminal-native');
const REPORT=path.join(OUT,'native-atomic-terminal-results.json');
const report={status:'not-run',tests:[],input:[],network:{fulfilled:0,rejected:[]},pageErrors:[],consoleErrors:[],realms:0,reloads:0,
 qualifications:{sourceOnly:true,disposableGuest:true,baseline:{head:'367237075df2ab934e3493c904d9a0dc4ba9313c',tree:'4487607202ea4a8913ad8bbf2cc1158ab87d1523'},
 input:'Native Playwright input through unchanged field controls. Read-only model/layout robot, real clock; no direct task.complete, won checkpoint assignment or clock override.',
 prerequisites:'Synthetic chapter9 core StoryPlan, prior phases with12 seconds, prepared operations core record, pinned chapter decisions and precision1/1, guest demo2100. Only final9.2 is earned here.',
 bootstrap:'Dedicated source-only loader hydrates canonical owner before evaluating unchanged field-art, legacy, field-missions scripts. No live index/app/chapter-space/rewards/cloud imports.',
 precision:'Manifest-pinned count/total rendered through a deterministic declared synthetic performance-only prior history. Full preceding StoryPlans are not restored.',
 ownership:'One fixed immutable adopted terminal command, no owner-wide multi-command transaction or cross-tab latest legacy snapshot.',
 durability:'Native transaction completion with strict hint, graceful document reloads. No process/OS power-loss, eviction or origin-deletion guarantee.',
 memory:'Fixed representation ledger plus separately bounded fixture/report observations; not JavaScript heap/RSS proof.',
 exclusions:'No whole earned campaign, authenticated/server rewards, production activation, actual player data, general daily/reset/mixed-release migration or physical-device acceptance.',
 inputFence:'Trusted stale-click cancellation is checked on an already complete/inactive board; this is not an active-model mutation counterfactual.',
 longContext:'This native9.2 case uses a small legal chapter9 context; the accepted chapter8 911-row context is covered by focused source/recovery tests, not mislabeled as native9.2 history.'}};
let browser,context,page,current='',routes,cache,timer,terminal=false;
const git=(...args)=>execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();
function save(){fs.mkdirSync(OUT,{recursive:true});const s=JSON.stringify(report,null,2)+'\n';assert(Buffer.byteLength(s)<=16*1024*1024,'Bounded native report');fs.writeFileSync(REPORT,s);}
function prepare(){
 routes=F.resources();routes.set('/',DIR+'index.html');for(const name of ['index.html','bootstrap.mjs','fixture.mjs','fixture.css','old-mirror.html','old-mirror.js'])routes.set('/'+DIR+name,DIR+name);
 routes.set('/tests/fixtures/evidence-phase-session/input-fence.mjs','tests/fixtures/evidence-phase-session/input-fence.mjs');
 cache=new Map([...new Set(routes.values())].map(file=>[file,fs.readFileSync(path.join(ROOT,file))]));
 const runtime=JSON.parse(fs.readFileSync(path.join(ROOT,'tests/fixtures/evidence-finale-controller/runtime-hashes.json')));
 for(const [file,expected]of Object.entries(runtime.hashes))assert.equal(F.sha(fs.readFileSync(path.join(ROOT,file))),expected,'Frozen runtime '+file);
 report.sourceHashes=Object.fromEntries([...new Set([...cache.keys(),...Object.keys(runtime.hashes),'tests/evidence-atomic-terminal-ui.cjs','.github/workflows/evidence-indexeddb-tests.yml'])].sort().map(file=>[file,F.sha(fs.readFileSync(path.join(ROOT,file)))]));
 report.resourceCache={files:cache.size,bytes:[...cache.values()].reduce((n,b)=>n+b.length,0)};assert(report.resourceCache.files<=220&&report.resourceCache.bytes<=32*1024*1024);
 const source=fs.readFileSync(path.join(ROOT,DIR+'fixture.mjs'),'utf8');
 assert(!/page\.clock|setFixedTime|setSystemTime/.test(source));assert(!/originalComplete\(|awardLifePoints\(9|MKTYRewards\.completeLife\(/.test(source));
 for(const name of ['app.js','chapter-space.js','rewards-client.js','cloud-save.js','storage.js'])assert(!source.includes("script('/"+name+"')"));
}
async function bounded(promise,label,ms=30000){let t;try{return await Promise.race([promise,new Promise((_,reject)=>{t=setTimeout(()=>reject(Error('Deadline: '+label)),ms);})]);}finally{clearTimeout(t);}}
async function newPage(url='/'){
 const p=await context.newPage();report.realms++;p.setDefaultTimeout(15000);
 p.on('pageerror',e=>report.pageErrors.push({test:current,error:e.message}));p.on('console',m=>{if(m.type()==='error')report.consoleErrors.push({test:current,text:m.text(),url:m.location().url});});
 await p.goto(ORIGIN+url);await ready(p);return p;
}
async function ready(p=page){await p.waitForFunction(()=>window.atomicFixtureReady===true);const error=await p.evaluate(()=>window.atomicBootstrapError||null);assert.equal(error,null);}
async function fresh(url='/'){
 if(context)await context.close();context=await browser.newContext({viewport:{width:900,height:900},serviceWorkers:'block'});
 await context.addInitScript(()=>{if(!sessionStorage.getItem('native-sentinel-initialized')){localStorage.setItem('mkty_pending_v2_unrelated','unrelated-pending-sentinel');sessionStorage.setItem('native-sentinel-initialized','yes');}});
 await context.route('**/*',route=>{
  const u=new URL(route.request().url()),file=u.origin===ORIGIN?routes.get(u.pathname):null;
  if(!file){report.network.rejected.push({test:current,url:u.href});return route.abort('blockedbyclient');}
  report.network.fulfilled++;return route.fulfill({body:cache.get(file),contentType:({'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.mp4':'video/mp4'})[path.extname(file)]||'application/octet-stream'});
 });
 await context.routeWebSocket('**/*',s=>{report.network.rejected.push({test:current,url:s.url(),kind:'websocket'});s.close();});
 page=await newPage(url);return page;
}
const facts=(p=page)=>p.evaluate(()=>H.facts());
function input(kind,target){assert(!terminal);assert(report.input.length<2048);report.input.push({test:current,n:report.input.length,at:Date.now(),kind,target});}
async function click(selector,p=page){input('click',selector);await p.locator(selector).click();}
async function settled(state,p=page){await p.waitForFunction(()=>H.settled);const f=await facts(p);assert.equal(f.operationError,null);if(state)assert.equal(f.view.state,state,JSON.stringify(f.view));return f;}
function noOldEffects(f){assert.deepEqual([f.counters.award,f.counters.rewards,f.counters.original],[0,0,0]);assert.equal(f.pendingQueueText,'unrelated-pending-sentinel');assert(f.budget.peak<=1016832);}
function canonical(f){noOldEffects(f);assert.equal(f.blockedReads,0);assert.equal(f.cacheSuspended,false);assert(f.derivedCacheBytes>0&&f.derivedCacheBytes<=8192);assert.equal(f.view.state,'READY');assert.equal(f.view.continueEnabled,true);assert.equal(f.cache.mkty_points,'5100');assert.equal(f.cache.mkty_final_moon_points,'5100');assert.equal(f.cache.mkty_life9,'complete');assert.equal(f.cache.mkty_life9_awarded,'yes');assert.equal(f.cache.mkty_field_finale_9_v1,null);assert.equal(JSON.parse(f.cache.mkty_story_plan_9_v1).phase,'complete');assert.equal(f.playEnabled,false);assert.equal(f.physicalBusy,false);assert.equal(f.retainedBytes,0);}
function bootstrap(f){const hydrated=f.events.find(e=>e.type==='canonical-hydrated'&&['ADOPTED','READY'].includes(e.state)),facade=f.events.find(e=>e.type==='facade-installed'),first=f.events.find(e=>e.type==='legacy-evaluation-start');assert(hydrated&&facade&&first);assert(hydrated.n<facade.n&&facade.n<first.n);assert(['ADOPTED','READY'].includes(facade.ownerState));for(const evaluation of f.events.filter(e=>e.type==='legacy-evaluation-start'))assert(['ADOPTED','READY'].includes(evaluation.ownerState));assert.deepEqual(f.loadOrder,['/field-art.js','/legacy.js','/field-missions.js']);}
function nativeProof(f){
 const active=new Set();let peak=0;for(const e of f.nativeEvents){
  if(e.type==='transaction'&&!e.fixture){active.add(e.tx);peak=Math.max(peak,active.size);if(e.mode==='readwrite')assert.equal(e.durability,'strict');}
  if(['complete','abort'].includes(e.type))active.delete(e.tx);
  if(e.type==='digest'){assert(e.bytes<=66048);assert.deepEqual(e.activeTransactions,[]);}
  if(e.type==='request'&&!e.fixture)assert(!['getAll','getAllKeys','openCursor','openKeyCursor','count'].includes(e.kind));
 }assert(peak<=1);assert.equal(active.size,0);return {peakPhysicalTransactions:peak};
}
async function start(){const before=await facts();assert.equal(before.active,'atomicSetup');assert.deepEqual(before.loadOrder,[]);await click('#atomicStart');const f=await settled('ADOPTED');assert.equal(f.counters.opens,1);assert.equal(f.model.complete,false);assert.equal(f.model.trace.length,0);assert.equal(f.active,'fieldMission');assert.equal(f.fieldDialogOpen,true);bootstrap(f);await click('#fieldResume');}
async function earn({fault,waitClock=false}={}){
 await start();if(fault)await page.evaluate(kind=>H.arm(kind),fault);
 const initial=(await facts()).model;assert.equal(initial.seed,16569);assert.equal(initial.stability,87);assert.deepEqual(initial.mods,{charges:1,stability:17,preview:1});
 if(waitClock){await page.waitForFunction(()=>MKTYField.snapshot().seconds>=1,{},{timeout:5000});assert((await facts()).model.seconds>=1);}
 let steps=0;while(true){const f=await facts(),s=f.model;assert(f.playEnabled);assert.equal(f.active,'fieldMission');assert.equal(f.fieldDialogOpen,false);assert(!s.failed);assert.equal(s.errors,0);assert.equal(s.attempt??0,0);assert.equal(s.failures??0,0);if(s.complete)break;assert(++steps<=20);
  const decision=R.layout(s).aligned(s.turn)?'launch':s.charges>0?'boost':'wait';await click(decision==='launch'?'#fieldSubmit':'[data-field-action="'+decision+'"]');
 }
 const won=(await facts()).model;assert.equal(won.home,3);assert.equal(won.stability,51);assert(R.won(won));assert(R.restore(won,11,4,16569));assert(won.trace.length>0);const raw=Codec.stringify(won,8192,'earned-limit');
 await click('#fieldSubmit');await page.waitForFunction(()=>H.facts().counters.captures===1);const f=await settled();assert.equal(f.earnedText,raw);assert.equal(f.counters.captures,1);assert.equal(f.counters.opens,1);noOldEffects(f);return {steps,raw,seconds:won.seconds,facts:f};
}
async function reload(p=page){report.reloads++;const prior=await facts(p);await p.reload();await ready(p);const f=await facts(p);assert.equal(f.counters.captures,0,'Fresh document, no captured callback closure');assert.equal(f.counters.opens,0,'Accepted result never reopens gameplay');noOldEffects(f);return {prior,facts:f};}
async function epilogue(p=page){await click('#atomicContinue',p);let f=await facts(p);assert.equal(f.epilogueOpen,true);assert.match(f.epilogueText,/Moonkatty is home/);assert.match(f.epilogueText,/1 \/ 1/);assert.match(f.epilogueText,/answered and shielded/);await click('[data-legacy-choice="done"]',p);f=await facts(p);assert.equal(f.active,'atomicHome');assert.equal(f.epilogueOpen,false);canonical(f);await click('#atomicReview',p);assert.equal((await facts(p)).active,'atomicResult');return f;}
async function test(name,run,ms=90000){current=name;const row={name,status:'running'};report.tests.push(row);save();const t=Date.now();try{row.details=await bounded(run(),name,ms);row.status='passed';console.log('PASS atomic-terminal: '+name);}catch(e){row.status='failed';row.error=e.stack;try{row.failure=await facts();}catch{}throw e;}finally{row.ms=Date.now()-t;save();}}
async function main(){
 if(process.env.GITHUB_ACTIONS!=='true'||process.env.CI!=='true')throw Error('Native atomic-terminal fixture is approved GitHub CI only; local browser/listener execution is not authorized.');
 prepare();report.commit=git('rev-parse','HEAD');report.tree=git('rev-parse','HEAD^{tree}');report.workflowSha=process.env.GITHUB_SHA;assert.equal(report.commit,report.workflowSha);assert.equal(git('status','--porcelain'),'');
 const {chromium}=require('playwright');assert.equal(require('playwright/package.json').version,'1.58.2');browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--disable-back-forward-cache']});
 report.versions={node:process.version,playwright:'1.58.2',chromium:browser.version()};report.status='running';
 await test('earned gate, exact duplicate/conflict, two real reloads and real epilogue/home',async()=>{
  await fresh();const played=await earn({waitClock:true});canonical(played.facts);nativeProof(played.facts);const release=played.facts.events.find(e=>e.type==='projection-released');assert(release);assert.equal(release.keysAfterRelease,0);assert.equal(release.derivedCacheBytes,0);assert.equal(release.playEnabled,false);
  await page.evaluate(()=>H.resubmit());const resubmitted=await settled('READY');canonical(resubmitted);assert.deepEqual(resubmitted.cache,played.facts.cache);assert.equal(resubmitted.counters.captures,1);
  const duplicate=await page.evaluate(()=>H.repeatAppend());assert.equal(duplicate.status,'duplicate');
  const conflict=await page.evaluate(()=>H.conflictingAppend());assert.equal(conflict.status,'conflict');canonical(await facts());
  const stale=await page.evaluate(()=>H.staleWrites());assert(stale.slice(0,3).every(x=>x.error==='atomic-owned-write-refused'));assert.equal(stale[3].returned,true);
  const old=await context.newPage();report.realms++;await old.goto(ORIGIN+'/'+DIR+'old-mirror.html');await old.waitForFunction(()=>window.oldMirrorReady===true);
  const staged=await old.evaluate(()=>oldMirror.stage());assert.equal(staged.persistent,false);assert.equal(staged.logical,'77777');assert.notEqual(staged.native,'77777');
  const flushed=await old.evaluate(()=>oldMirror.flush());assert.equal(flushed.retried,true);assert.equal(flushed.native,'77777');assert.equal(flushed.queue,'unrelated-pending-sentinel');canonical(await facts());
  await page.bringToFront();await page.evaluate(()=>H.changeNative());const mirror=await facts();assert.equal(mirror.nativePoints,'99999');canonical(mirror);
  const first=await reload();canonical(first.facts);bootstrap(first.facts);assert.equal(first.facts.nativePoints,'99999');assert.deepEqual(first.facts.cache,played.facts.cache);
  await page.evaluate(()=>H.clearNative());const second=await reload();canonical(second.facts);assert.equal(second.facts.nativePoints,null);assert.deepEqual(second.facts.cache,played.facts.cache);
  const final=await epilogue();await epilogue();return {played,duplicate:duplicate.status,conflict:conflict.status,stale,oldOverlay:{staged,flushed},firstReload:first.facts,secondReload:second.facts,home:final};
 });
 await test('canonical storage stop retains earned phase and reload resumes only its new owner',async()=>{
  await fresh();const played=await earn({fault:'stop'});assert.equal(played.facts.view.state,'UNSAVED');assert.equal(played.facts.playEnabled,false);assert.equal(await page.locator('#atomicContinue').isDisabled(),true);
  const beforeProbe=await facts();await page.evaluate(()=>H.exposeStale(true));await click('#fieldSubmit');await page.waitForFunction(()=>H.facts().trustedInputs.some(e=>e.prevented===true));
  const afterProbe=await facts();assert(afterProbe.inputFence.blocked>beforeProbe.inputFence.blocked);assert(afterProbe.trustedInputs.every(e=>e.isTrusted&&e.prevented));assert.deepEqual(afterProbe.model,beforeProbe.model);assert.equal(afterProbe.counters.captures,1);await page.evaluate(()=>H.exposeStale(false));
  const transition=await reload();assert.equal(transition.facts.view.state,'ADOPTED');assert(transition.facts.view.phasePin);assert.equal(transition.facts.active,'atomicResult');
  await click('#atomicRetry');const result=await settled('READY');canonical(result);return {played:played.facts,trustedStaleProbe:afterProbe.trustedInputs,recovered:transition.facts,result};
 });
 await test('native abort after add success retries exactly once without replaying gameplay',async()=>{
  await fresh();const played=await earn({fault:'abort'});assert.equal(played.facts.view.state,'UNSAVED');assert(played.facts.nativeEvents.some(e=>e.type==='abort-requested-after-success'));
  assert.equal(await page.locator('#atomicContinue').isDisabled(),true);await click('#atomicRetry');const f=await settled('READY');canonical(f);assert.equal(f.counters.captures,1);
  const requests=f.transport.filter(t=>t.kind==='append'&&t.run?.startsWith('fcommit1:'));assert.equal(requests.length,2);assert.deepEqual(requests.map(x=>[x.ordinal,x.length,x.seal]),Array(2).fill([0,requests[0].length,true]));return {failure:played.facts,result:f};
 });
 await test('native commit with lost acknowledgment uses adapter exact duplicate retry',async()=>{
  await fresh();const played=await earn({fault:'hold'});assert.equal(played.facts.view.state,'UNSAVED');assert(played.facts.retainedBytes>0);assert(played.facts.nativeEvents.some(e=>e.type==='watchdog-native-due'));assert(played.facts.nativeEvents.some(e=>e.type==='watchdog-delivered'));const held=await page.evaluate(()=>H.heldTerminal);assert.equal(held.terminal,'complete');
  await page.evaluate(()=>H.releaseHeld());await page.waitForFunction(()=>!H.facts().physicalBusy);await click('#atomicRetry');const f=await settled('READY');canonical(f);assert(f.transport.some(x=>x.kind==='exact-retry'&&x.result.status==='duplicate'));return {held,failure:played.facts,result:f};
 });
 await test('native commit before acknowledgment is recovered by a fresh document',async()=>{
  await fresh();const played=await earn({fault:'hold'});assert.equal(played.facts.view.state,'UNSAVED');const held=await page.evaluate(()=>H.heldTerminal);assert.equal(held.terminal,'complete');
  const transition=await reload();canonical(transition.facts);assert.equal(transition.facts.counters.captures,0);return {held,recovered:transition.facts};
 });
 await test('two realms propose different timestamps and loser adopts the immutable winner',async()=>{
  await fresh();const played=await earn({fault:'stop'}),first=page;assert.equal(played.facts.view.state,'UNSAVED');
  const second=await newPage('/?existing=1');assert.equal((await facts(second)).view.state,'ADOPTED');await click('#atomicRetry',second);const winner=await settled('READY',second);canonical(winner);
  await first.bringToFront();page=first;await click('#atomicRetry');const loser=await settled('READY');canonical(loser);assert.deepEqual(loser.cache,winner.cache);assert.deepEqual(loser.view.projection,winner.view.projection);
  assert.notDeepEqual(loser.lastSubmit.timestamps,winner.lastSubmit.timestamps,'Real separate commands selected different timestamps');assert.equal(loser.counters.captures,1);assert.equal(winner.counters.captures,0);await epilogue(first);await epilogue(second);return {winner,loser};
 });
 await test('different immutable adoption inputs are refused in a cooperating realm',async()=>{
  await fresh();const played=await earn({fault:'stop'}),first=page;const second=await newPage('/?existing=1');
  await second.evaluate(()=>H.conflictAdoption());const rejected=await settled('BLOCKED',second);assert.equal(rejected.view.reason,'atomic-command-conflict');assert.equal(rejected.view.continueEnabled,false);assert.deepEqual(rejected.cache,{});noOldEffects(rejected);
  page=first;await first.bringToFront();await click('#atomicRetry');const accepted=await settled('READY');canonical(accepted);assert.equal(accepted.view.manifest.baseline.points,2100);return {played:played.facts,rejected,accepted};
 });
 await test('actual Chromium native quota refusal blocks Continue until exact retry succeeds',async()=>{
  await fresh();await earn({fault:'stop'});const cdp=await context.newCDPSession(page),e={status:'unverified',protocol:'Storage.overrideQuotaForOrigin',before:await cdp.send('Storage.getUsageAndQuota',{origin:ORIGIN})};
  try{
   await cdp.send('Storage.overrideQuotaForOrigin',{origin:ORIGIN,quotaSize:1});e.override=await cdp.send('Storage.getUsageAndQuota',{origin:ORIGIN});assert.equal(e.override.overrideActive,true);
   const before=await facts(),mark=before.nativeEvents.length,t=process.hrtime.bigint();await new Promise(resolve=>setTimeout(resolve,31000));e.noWritePreparationMs=Number(process.hrtime.bigint()-t)/1e6;
   assert(e.noWritePreparationMs>30000);assert.equal((await facts()).nativeEvents.filter(x=>x.type==='transaction'&&x.mode==='readwrite').length,before.nativeEvents.filter(x=>x.type==='transaction'&&x.mode==='readwrite').length);
   await click('#atomicRetry');const failed=await settled('UNSAVED');e.nativeError=failed.nativeEvents.slice(mark).find(x=>['request-error','abort'].includes(x.type)&&x.error==='QuotaExceededError');
   assert(e.nativeError,'Actual QuotaExceededError required; injected failures and logical quota do not count');assert.equal(await page.locator('#atomicContinue').isDisabled(),true);e.failure=failed;e.status='verified';
  }finally{await cdp.send('Storage.overrideQuotaForOrigin',{origin:ORIGIN});await cdp.detach();}
  await click('#atomicRetry');e.result=await settled('READY');canonical(e.result);return e;
 },120000);
 for(const kind of ['missing-context','corrupt-phase'])await test('fresh recovery rejects '+kind+' without loading gameplay',async()=>{
  await fresh();await earn();await page.evaluate(kind=>H.corrupt(kind),kind);await page.reload();report.reloads++;await ready();const f=await facts();assert.equal(f.view.state,'BLOCKED');assert.deepEqual(f.loadOrder,[]);assert.equal(f.counters.opens,0);noOldEffects(f);return f;
 });
 await test('unavailable storage remains visibly blocked before any legacy script',async()=>{await fresh('/?storage=unavailable');const f=await facts();assert.equal(f.bootState,'BLOCKED');assert.deepEqual(f.loadOrder,[]);assert.equal(f.active,'atomicLoading');assert.match(await page.locator('#atomicLoadingStatus').textContent(),/indexeddb-unavailable/);noOldEffects(f);return f;});
 await test('newer native database version fails closed without reopening the gate',async()=>{await fresh();await earn();await page.evaluate(()=>H.upgrade());await page.reload();report.reloads++;await ready();const f=await facts();assert.equal(f.bootState,'BLOCKED');assert.deepEqual(f.loadOrder,[]);assert.match(await page.locator('#atomicLoadingStatus').textContent(),/unsupported-version/);return f;});
 assert.deepEqual(report.network.rejected,[],'No external/unmapped requests expected');assert.deepEqual(report.pageErrors,[]);assert.deepEqual(report.consoleErrors,[]);report.status='passed';save();
}
timer=setTimeout(()=>{terminal=true;report.status='failed';report.deadline='Native fixture exceeded8minutes';save();void browser?.close();process.exitCode=1;},480000);
main().catch(e=>{report.status='failed';report.error=e.stack;console.error(e.stack);process.exitCode=1;}).finally(async()=>{clearTimeout(timer);await browser?.close();save();});
