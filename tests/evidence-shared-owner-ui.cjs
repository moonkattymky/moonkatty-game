'use strict';
/* GitHub CI only. Two real browser realms and native IndexedDB, with fixed
 * synthetic prerequisites. No earned gameplay or production activation claim. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {execFileSync}=require('node:child_process'),Helper=require('./evidence-shared-owner-helper.cjs'),F=Helper.F;
const ROOT=F.root,DIR='tests/fixtures/evidence-shared-owner/',ORIGIN='https://shared-owner-fixture.test';
const OUT=process.env.MKTY_TEST_OUTPUT||path.join(os.tmpdir(),'mkty-evidence-shared-owner-native');
const REPORT=path.join(OUT,'native-shared-owner-results.json'),RUN='fshared1:'+Helper.SESSION;
const BASELINE={kind:'frozen-local-portable-source-candidate',publicNativeAcceptance:false,head:'194c24cc2ab13503c57e025a7e8488a4ca32bc4c',tree:'6ed14bb711350f96d6c6ba7f22a7907424cfa745',
  sourceSetSha256:'1ae83c53ff49cc019b85f9c7039aebac84a40b8b446e20a8d934a7b90223a550'};
const report={status:'not-run',tests:[],network:{fulfilled:0,rejected:[]},pageErrors:[],consoleErrors:[],realms:0,reloads:0,
  qualifications:{baseline:BASELINE,sourceOnly:true,disposableGuest:true,nativeEarnedGameplay:false,
    prerequisites:'Fixed synthetic chapter 9 StoryPlan and model-valid archived phase from the accepted portable fixture. Injected JSON is prerequisite data only; canonical owner revisions are written by the unchanged native adapter.',
    scheduling:'Both proposals pause before native dispatch at the same observed head. Winner dispatch and terminal observation precede loser dispatch. This is deterministic stale-head CAS, not simultaneous physical transactions.',
    durability:'Native strict-hint transaction completion and graceful document reload only; no process/OS power-loss, origin deletion, eviction or physical-device claim.',
    resources:'Fixed encoded representation ledger and separately bounded fixture/report observations; not a JavaScript heap/RSS bound.',
    exclusions:'No natively earned 9.2 or full campaign, authenticated/server rewards, production routing, live player data, daily IIFE/native parity, general reset/migration or broad cross-release ownership.'}};
let browser,context,page,current='',routes,cache,seed,timer;
const git=(...args)=>execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();
const sourceHashes=files=>Object.fromEntries([...new Set(files)].sort().map(file=>[file,F.sha(fs.readFileSync(path.join(ROOT,file)))]));
function save(){fs.mkdirSync(OUT,{recursive:true});const text=JSON.stringify(report,null,2)+'\n';assert(Buffer.byteLength(text)<=16*1024*1024,'Bounded report');fs.writeFileSync(REPORT,text);}
async function prepare(){
  // These two independent legacy-handoff modules were not part of the frozen141 source set.
  // Keep every previous byte/hash pinned; do not repin the accepted baseline to the new experiment.
  const laterOnly=new Set(['legacy-adoption-codec.mjs','legacy-checkpoint-owner.mjs']);
  const prototype=fs.readdirSync(path.join(ROOT,'prototypes/evidence-indexeddb')).filter(x=>x.endsWith('.mjs')&&!laterOnly.has(x)).map(x=>'prototypes/evidence-indexeddb/'+x);
  const runtime=JSON.parse(fs.readFileSync(path.join(ROOT,'tests/fixtures/evidence-finale-controller/runtime-hashes.json')));
  const frozen=[...Object.keys(runtime.hashes),...prototype,'tests/fixtures/evidence-indexeddb/native-harness.js',
    'tests/evidence-finale-controller-fixture.cjs','tests/evidence-shared-owner-helper.cjs','tests/fixtures/finale-checkpoints-17-state.json'];
  const hashes=sourceHashes(frozen);assert.equal(F.sha(JSON.stringify(hashes)),BASELINE.sourceSetSha256,'Accepted source baseline unchanged');
  for(const [file,hash]of Object.entries(runtime.hashes))assert.equal(hashes[file],hash,'Frozen runtime '+file);
  const files=[...prototype,'trace-codec.js','story-plan.js','field-model.js','tests/fixtures/evidence-indexeddb/native-harness.js',...['index.html','bootstrap.mjs','fixture.mjs'].map(x=>DIR+x)];
  routes=new Map(files.map(file=>['/'+file,file]));routes.set('/',DIR+'index.html');cache=new Map(files.map(file=>[file,fs.readFileSync(path.join(ROOT,file))]));
  report.sourceHashes=sourceHashes([...frozen,...files,'prototypes/evidence-indexeddb/SHARED-TWO-ACTION-CONTRACT.txt',
    'tests/evidence-shared-owner.cjs','tests/evidence-shared-streak.cjs','tests/evidence-shared-owner-ui.cjs',
    '.github/workflows/evidence-indexeddb-tests.yml','.github/workflows/model-tests.yml','package-lock.json']);
  report.resourceCache={files:cache.size,bytes:[...cache.values()].reduce((n,b)=>n+b.length,0)};
  assert(report.resourceCache.files<=32&&report.resourceCache.bytes<=2*1024*1024);
  const fixture=await Helper.fixture();seed=JSON.parse(JSON.stringify({manifest:fixture.manifest,phasePin:fixture.phasePin,archives:fixture.adapter.snapshot()}));
  assert.equal(seed.archives.length,2);assert(seed.archives.every(x=>!x.run.startsWith('fshared1:')));
  report.syntheticInput={sha256:F.sha(JSON.stringify(seed)),bytes:Buffer.byteLength(JSON.stringify(seed)),archives:seed.archives.map(x=>({run:x.run,head:x.pin.head,segments:x.segments.length}))};
  assert(report.syntheticInput.bytes<=128*1024);
}
async function bounded(promise,label,ms=45000){let t;try{return await Promise.race([promise,new Promise((_,reject)=>{t=setTimeout(()=>reject(Error('Deadline: '+label)),ms);})]);}finally{clearTimeout(t);}}
async function ready(p){await p.waitForFunction(()=>window.sharedFixtureReady===true);assert.equal(await p.evaluate(()=>window.sharedBootstrapError||null),null);}
async function newPage(){
  const p=await context.newPage();report.realms++;p.setDefaultTimeout(15000);
  p.on('pageerror',e=>{assert(report.pageErrors.length<64);report.pageErrors.push({test:current,error:e.message});});
  p.on('console',m=>{if(m.type()==='error'){assert(report.consoleErrors.length<64);report.consoleErrors.push({test:current,text:m.text()});}});
  await p.goto(ORIGIN+'/');await ready(p);return p;
}
async function fresh(){
  if(context)await context.close();context=await browser.newContext({viewport:{width:900,height:700},serviceWorkers:'block'});
  await context.route('**/*',route=>{
    const u=new URL(route.request().url()),file=u.origin===ORIGIN&&!u.search?routes.get(u.pathname):null;
    if(!file||route.request().method()!=='GET'){assert(report.network.rejected.length<64);report.network.rejected.push({test:current,url:u.href,method:route.request().method()});return route.abort('blockedbyclient');}
    report.network.fulfilled++;return route.fulfill({body:cache.get(file),contentType:path.extname(file)==='.html'?'text/html':'application/javascript'});
  });
  await context.routeWebSocket('**/*',socket=>{assert(report.network.rejected.length<64);report.network.rejected.push({test:current,url:socket.url(),kind:'websocket'});socket.close();});
  page=await newPage();await page.evaluate(input=>H.prepare(input),seed);return settled('ACTIVE');
}
const facts=(p=page)=>p.evaluate(()=>H.facts());
async function settled(state,p=page){await p.waitForFunction(()=>H.facts().settled);const f=await facts(p);assert.equal(f.error,null);if(state)assert.equal(f.view.state,state,JSON.stringify(f.view));return f;}
const writeRows=f=>f.transport.filter(x=>x.run===RUN&&['append','exact-retry'].includes(x.kind));
const writes=f=>f.nativeEvents.filter(x=>x.type==='transaction'&&x.mode==='readwrite'&&!x.fixture).length;
function ledger(b,disposed=false){
  assert.equal(b.ceiling,1016832);assert(b.peak<=b.ceiling);assert(b.live<=b.peak);
  for(const [label,n]of Object.entries(b.reservations))if(!['metadata','adapter',...(disposed?[]:['atomic-retained','post-target'])].includes(label))assert.equal(n,0,'Released '+label);
  if(!disposed)assert.equal(b.reservations['atomic-retained'],32768);
}
function idle(f){assert.equal(f.error,null);assert.equal(f.settled,true);assert(Object.values(f.counters).every(x=>x===0),'No old callbacks');assert.equal(f.physicalBusy,false);assert.equal(f.retainedBytes,0);assert.equal(f.nativePhysical,0);ledger(f.budget);}
function canonical(f,points,revision=2){
  idle(f);const v=f.view;assert.deepEqual([v.state,v.reason,v.revision,v.continueEnabled],['READY',null,revision,true]);
  assert.equal(v.values.mkty_points,String(points));assert.equal(v.values.mkty_final_moon_points,String(points));assert.equal(v.values.mkty_life9,'complete');assert.equal(v.values.mkty_life9_awarded,'yes');
  assert.equal(JSON.parse(v.projection.storyText).phase,'complete');assert.equal(v.values.mkty_points_locked_at,String(Helper.timestamps(10000).lock));
  assert.equal(v.head.head.total,(revision+1)*16384);assert.equal(v.head.head.sealed,revision===2);
}
function receiptProof(f){
  const verified=[];
  for(const row of writeRows(f).filter(x=>['committed','duplicate'].includes(x.result?.status))){
    const r=row.result.receipt,h=row.result.currentHead;
    assert.deepEqual(r.captureIdentity,{scope:Helper.SCOPE,run:RUN});assert.equal(r.ordinal,row.ordinal);assert.equal(r.length,16384);
    assert.equal(r.acknowledgement,'idb-transaction-complete');assert.equal(r.durability,'strict');assert.equal(r.sealed,row.ordinal===2);
    assert(row.diagnostics.peakAccountedBytes<=393216);assert(row.diagnostics.requestBytes>16384&&row.diagnostics.requestBytes<=20480);
    assert.equal(row.diagnostics.inputCopyBytes,row.kind==='exact-retry'?0:16384);
    assert(h.ordinal>=r.ordinal);if(h.ordinal===r.ordinal){assert.equal(r.headToken,h.token);assert.equal(r.root,h.root);}
    const writeEvents=f.nativeEvents.slice(row.startNativeIndex,row.endNativeIndex),writeTx=writeEvents.find(e=>e.type==='transaction'&&e.mode==='readwrite'&&!e.fixture);assert(writeTx);
    const writeTerm=writeEvents.find(e=>e.type==='complete'&&e.tx===writeTx.tx);
    assert(writeTerm,'Native completion precedes acknowledgement');
    const published=f.events.find(e=>e.type==='settled'&&e.nativeIndex>=row.endNativeIndex&&['ACTIVE','READY'].includes(e.state));assert(published);
    const read=f.transport.find(x=>x.kind==='read'&&x.run===RUN&&x.afterOrdinal>=row.ordinal-1&&x.startNativeIndex>=row.endNativeIndex&&x.endNativeIndex<=published.nativeIndex&&x.result?.status==='page');
    assert(read,'Acknowledged owner effect requires native readback');
    const readEvents=f.nativeEvents.slice(read.startNativeIndex,read.endNativeIndex),readTx=readEvents.find(e=>e.type==='transaction'&&e.mode==='readonly'&&!e.fixture);assert(readTx);
    const readTerm=readEvents.find(e=>e.type==='complete'&&e.tx===readTx.tx);assert(readTerm,'Native readback completes before first visible settled projection');
    verified.push({ordinal:row.ordinal,status:row.result.status,receipt:r,currentHead:h,writeComplete:writeTerm.n,readComplete:readTerm.n,publishedAt:published.nativeIndex});
  }return verified;
}
function exactRetry(row,status){
  assert.equal(row.result.status,status);const d=row.diagnostics;assert.equal(d.op,'append');assert.equal(d.transactions,1);assert.equal(d.terminal,'complete');
  assert.equal(d.inputCopyBytes,0);assert(d.requestBytes>16384&&d.requestBytes<=20480);assert.equal(d.liveAccountedBytes,0);assert(d.peakAccountedBytes<=393216);
  if(status==='duplicate'){assert.equal(d.touchedWrites,0);assert.equal(d.duplicateReadBytes,16384);}else assert(d.touchedWrites>0);
}
function nativeProof(f){
  assert(f.nativeEvents.length<=20000);assert(f.transport.length<=1024);const active=new Set();let peak=0,digests=0;
  for(const row of f.transport){assert(row.diagnostics);assert(Number.isInteger(row.diagnostics.peakAccountedBytes)&&row.diagnostics.peakAccountedBytes<=393216,'Native adapter representation ceiling');}
  for(const e of f.nativeEvents){
    if(e.type==='transaction'&&!e.fixture){active.add(e.tx);peak=Math.max(peak,active.size);if(e.mode==='readwrite')assert.equal(e.durability,'strict');}
    if(['complete','abort'].includes(e.type))active.delete(e.tx);
    if(e.type==='digest'){digests++;assert(e.bytes<=66048);assert.deepEqual(e.activeTransactions,[]);}
    if(e.type==='request'&&!e.fixture)assert(!['getAll','getAllKeys','openCursor','openKeyCursor','count'].includes(e.kind));
  }
  assert(peak<=1);assert.equal(active.size,0);assert(digests>0);
  return {events:f.nativeEvents.length,sha256:F.sha(JSON.stringify(f.nativeEvents)),peakPhysicalTransactionsPerRealm:peak,digests,receipts:receiptProof(f),
    terminals:f.nativeEvents.filter(e=>['transaction','complete','abort','abort-requested-after-success','delivery-held','delivery-released','watchdog-native-due','watchdog-delivered'].includes(e.type))};
}
function evidence(f){return {view:f.view,budget:f.budget,counters:f.counters,transport:writeRows(f),events:f.events,native:nativeProof(f)};}
async function history(p=page){const h=await p.evaluate(()=>H.history());ledger(h.budget,true);return h;}
function historyCheck(h,order){
  assert.equal(h.records.length,3);assert.deepEqual(h.records.map(x=>x.revision),[0,1,2]);assert.deepEqual(h.records.slice(1).map(x=>x.command.kind),order);
  assert.deepEqual(h.records[0].manifest,seed.manifest);const terminal=h.records.find(x=>x.command?.kind==='terminal'),daily=h.records.find(x=>x.command?.kind==='daily');
  assert.equal(terminal.receipt.delta,3000);assert.equal(daily.receipt.delta,order[0]==='daily'?3:0);assert.equal(daily.receipt.legacyResult.points,3);
  assert.deepEqual(terminal.command.phasePin,seed.phasePin);assert.deepEqual(terminal.command.timestamps,Helper.timestamps(10000));
  assert.equal(daily.command.ticket.revision,0);assert.equal(daily.command.ticket.head.head.token,h.prefixes[0].head.token);
  assert.deepEqual(h.prefixes.map(x=>[x.head.ordinal,x.head.total,x.head.sealed]),[[0,16384,false],[1,32768,false],[2,49152,true]]);
  const end=h.records[2].stateAfter,d=JSON.parse(end.dailyText),original=JSON.parse(seed.manifest.dailyText);
  assert.deepEqual([end.points,end.locked,d.streak,d.last_day,d.attempts,d.solved,d.codes],[order[0]==='daily'?5103:5100,true,1,Helper.DAY,2,true,['MOONTEST']]);
  for(const key of ['cipher','opaque','shield_week'])assert.deepEqual(d[key],original[key]);
}
async function dispose(p=page){const b=await p.evaluate(()=>H.dispose());ledger(b,true);return b;}
async function reload(p=page){report.reloads++;await p.reload();await ready(p);return settled('READY',p);}
async function test(name,run,ms=60000){
  current=name;const row={name,status:'running'};report.tests.push(row);save();const start=Date.now();
  try{row.details=await bounded(run(),name,ms);row.status='passed';console.log('PASS shared-owner: '+name);}
  catch(error){row.status='failed';row.error=error.stack;try{row.failure=await facts();}catch{}throw error;}
  finally{row.ms=Date.now()-start;save();}
}
async function main(){
  if(process.env.GITHUB_ACTIONS!=='true'||process.env.CI!=='true')throw Error('Native shared-owner fixture is approved GitHub CI only; local browser/listener execution is not authorized.');
  await prepare();report.commit=git('rev-parse','HEAD');report.tree=git('rev-parse','HEAD^{tree}');report.workflowSha=process.env.GITHUB_SHA;
  assert.equal(report.commit,report.workflowSha);assert.equal(git('status','--porcelain'),'');
  const {chromium}=require('playwright');assert.equal(require('playwright/package.json').version,'1.58.2');
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--disable-back-forward-cache']});
  report.versions={node:process.version,playwright:'1.58.2',chromium:browser.version()};report.status='running';
  for(const order of [['daily','terminal'],['terminal','daily']])await test('same-head CAS '+order.join(' then ')+' with exact history, repeats and two reloads',async()=>{
    await fresh();const a=page,b=await newPage(),ticket=await a.evaluate(()=>H.admitDaily());assert(ticket);
    assert.equal((await facts(b)).view.head.head.token,ticket.head.head.token);
    await a.evaluate(()=>H.holdNextAppend('daily'));await b.evaluate(()=>H.holdNextAppend('terminal'));
    const daily=a.evaluate(t=>H.checkin(t),ticket),terminal=b.evaluate(()=>H.terminal());
    const outcomes=Promise.all([daily,terminal]);outcomes.catch(()=>{});
    await Promise.all([a.waitForFunction(()=>H.pendingAppend!==null),b.waitForFunction(()=>H.pendingAppend!==null)]);
    const proposals=await Promise.all([a.evaluate(()=>H.pendingAppend),b.evaluate(()=>H.pendingAppend)]);
    assert(proposals.every(q=>q.ordinal===1&&q.expectedHead===ticket.head.head.token));assert.notEqual(proposals[0].payloadDigest,proposals[1].payloadDigest);
    for(const p of [a,b]){const f=await facts(p),row=writeRows(f).find(x=>x.ordinal===1);assert(row&&!row.result);assert(!f.nativeEvents.slice(row.startNativeIndex).some(e=>e.type==='transaction'&&e.mode==='readwrite'));}
    const pages={daily:a,terminal:b},winner=pages[order[0]],loser=pages[order[1]],schedule=[];
    schedule.push({step:1,action:'both proposals captured',proposals});await winner.evaluate(()=>H.releaseAppend());
    const first=await settled(order[0]==='daily'?'ACTIVE':'READY',winner);schedule.push({step:2,action:'winner observed complete',kind:order[0],head:first.view.head.head});
    assert.equal(first.view.revision,1);assert.equal((await loser.evaluate(()=>H.pendingAppend)).expectedHead,ticket.head.head.token);
    await loser.evaluate(()=>H.releaseAppend());await outcomes;schedule.push({step:3,action:'loser dispatched against stale head',kind:order[1]});
    await Promise.all([a.evaluate(()=>H.recover()),b.evaluate(()=>H.recover())]);const expected=order[0]==='daily'?5103:5100;
    const af=await settled('READY',a),bf=await settled('READY',b);canonical(af,expected);canonical(bf,expected);assert.deepEqual(af.view.values,bf.view.values);
    const loserWrites=writeRows(await facts(loser)).filter(x=>x.ordinal>0);assert.equal(loserWrites.length,2);
    assert.deepEqual(loserWrites.map(x=>[x.ordinal,x.result.status]),[[1,'conflict'],[2,'committed']]);
    assert.deepEqual(loserWrites[0].command,loserWrites[1].command);assert.equal(loserWrites[1].expectedHead,first.view.head.head.token);
    const before=await history(a);historyCheck(before,order);const writeCount=writes(await facts(a));
    for(let i=0;i<2;i++){await a.evaluate(t=>H.checkin(t),ticket);await a.evaluate(()=>H.terminal());}
    const repeated=await settled('READY',a);canonical(repeated,expected);assert.equal(writes(repeated),writeCount);assert.deepEqual((await history(a)).records,before.records);
    assert.deepEqual(await a.evaluate(()=>H.staleWrites()),Array(3).fill('fixture-legacy-write-forbidden'));canonical(await facts(a),expected);assert.equal(writes(await facts(a)),writeCount);
    const staleMirror=await a.evaluate(()=>H.writeStaleMirror());assert.equal(staleMirror.mkty_points,'99999');await a.evaluate(()=>H.recover());const mirrored=await facts(a);canonical(mirrored,expected);assert.deepEqual(mirrored.view.values,af.view.values);assert.deepEqual((await history(a)).records,before.records);
    const reloads=[];for(let i=0;i<2;i++){const restored=await reload(a);canonical(restored,expected);assert.deepEqual(restored.nativeMirror,staleMirror);assert.deepEqual(restored.view.values,af.view.values);assert.deepEqual(restored.view.projection,af.view.projection);assert.equal(writes(restored),0);assert.deepEqual((await history(a)).records,before.records);reloads.push(evidence(await facts(a)));}
    return {schedule,history:before,staleMirror,winner:evidence(first),firstRealm:evidence(af),secondRealm:evidence(bf),reloads,disposed:[await dispose(a),await dispose(b)]};
  });
  for(const kind of ['daily','terminal'])await test('native abort after add success preserves prefix and retries '+kind,async()=>{
    await fresh();const ticket=await page.evaluate(()=>H.admitDaily()),before=await history();await page.evaluate(()=>H.arm('abort'));
    await page.evaluate(({kind,ticket})=>kind==='daily'?H.checkin(ticket):H.terminal(),{kind,ticket});const failed=await settled('UNSAVED');
    assert(failed.nativeEvents.some(e=>e.type==='abort-requested-after-success'));assert.equal(failed.view.continueEnabled,false);assert.equal(failed.retainedBytes,0);
    assert.deepEqual((await history()).records,before.records);await page.evaluate(()=>H.retry());const result=await settled(kind==='daily'?'ACTIVE':'READY');idle(result);
    assert.deepEqual([result.view.revision,Number(result.view.values.mkty_points)],[1,kind==='daily'?2103:5100]);
    const rows=writeRows(result).filter(x=>x.ordinal===1);assert.equal(rows.length,2);assert.equal(rows[0].payloadDigest,rows[1].payloadDigest);assert.deepEqual(rows[0].command,rows[1].command);
    assert.deepEqual(rows.map(x=>[x.result.status,x.result.reason]),[['refused','transaction-aborted'],['committed',null]]);
    assert.equal((await history()).records.length,2);return {failure:evidence(failed),result:evidence(result),disposed:await dispose()};
  });
  for(const kind of ['daily','terminal'])for(const fault of ['hold-complete','hold-abort'])await test(fault+' exact native retry of '+kind,async()=>{
    await fresh();const ticket=await page.evaluate(()=>H.admitDaily());await page.evaluate(fault=>H.arm(fault),fault);
    await page.evaluate(({kind,ticket})=>kind==='daily'?H.checkin(ticket):H.terminal(),{kind,ticket});const failed=await settled('UNSAVED'),held=await page.evaluate(()=>H.heldTerminal);
    assert.equal(held.terminal,fault==='hold-complete'?'complete':'abort');assert(failed.retainedBytes>0);assert.equal(failed.view.continueEnabled,false);
    const due=failed.nativeEvents.find(e=>e.type==='watchdog-native-due'),delivered=failed.nativeEvents.find(e=>e.type==='watchdog-delivered');assert(due&&delivered);assert(held.nativeEvent<delivered.n&&due.n<delivered.n);
    const mark=failed.transport.length;await page.evaluate(()=>H.terminal());await page.evaluate(t=>H.checkin(t),ticket);assert.equal((await facts()).transport.length,mark);
    assert(await page.evaluate(()=>H.releaseHeld())>0);await page.waitForFunction(()=>!H.facts().physicalBusy);await page.evaluate(()=>H.retry());
    const result=await settled(kind==='daily'?'ACTIVE':'READY');idle(result);assert.equal(result.view.revision,1);assert.equal(Number(result.view.values.mkty_points),kind==='daily'?2103:5100);
    const retry=writeRows(result).find(x=>x.kind==='exact-retry');assert(retry);exactRetry(retry,fault==='hold-complete'?'duplicate':'committed');
    // Retry digest is retained metadata; immutable native readback and adapter diagnostics independently constrain the exact lease.
    assert.equal(retry.payloadDigest,writeRows(result).find(x=>x.ordinal===1).payloadDigest);const stored=await history();assert.equal(stored.records.length,2);assert.equal(stored.payloadDigests[1],retry.payloadDigest);
    return {held,failure:evidence(failed),result:evidence(result),disposed:await dispose()};
  });
  await test('older exact receipt adopts newer current head without another grant',async()=>{
    await fresh();const a=page,b=await newPage(),ticket=await b.evaluate(()=>H.admitDaily());await a.evaluate(()=>H.arm('hold-complete'));await a.evaluate(()=>H.terminal());
    const failed=await settled('UNSAVED',a),held=await a.evaluate(()=>H.heldTerminal);assert.equal(held.terminal,'complete');
    await b.evaluate(t=>H.checkin(t),ticket);canonical(await settled('READY',b),5100);await a.evaluate(()=>H.releaseHeld());await a.waitForFunction(()=>!H.facts().physicalBusy);await a.evaluate(()=>H.retry());
    const result=await settled('READY',a);canonical(result,5100);assert.deepEqual([result.view.lastReceipt.id,result.view.lastReceipt.revision,result.view.lastReceipt.delta],['life:9:complete',1,3000]);
    const retry=writeRows(result).find(x=>x.kind==='exact-retry');exactRetry(retry,'duplicate');assert.equal(retry.result.receipt.ordinal,1);assert.equal(retry.result.currentHead.ordinal,2);
    const h=await history(a);historyCheck(h,['terminal','daily']);assert.equal(h.payloadDigests[1],retry.payloadDigest);return {held,failure:evidence(failed),result:evidence(result),history:h,disposed:[await dispose(a),await dispose(b)]};
  });
  await test('actual Chromium quota error preserves owner prefix until retry',async()=>{
    await fresh();const before=await history(),cdp=await context.newCDPSession(page),proof={status:'unverified',protocol:'Storage.overrideQuotaForOrigin',before:await cdp.send('Storage.getUsageAndQuota',{origin:ORIGIN})};
    try{
      await cdp.send('Storage.overrideQuotaForOrigin',{origin:ORIGIN,quotaSize:1});proof.override=await cdp.send('Storage.getUsageAndQuota',{origin:ORIGIN});assert.equal(proof.override.overrideActive,true);
      const initial=await facts(),mark=initial.nativeEvents.length,start=process.hrtime.bigint();await new Promise(resolve=>setTimeout(resolve,31000));proof.noWritePreparationMs=Number(process.hrtime.bigint()-start)/1e6;
      assert(proof.noWritePreparationMs>30000);assert.equal(writes(await facts()),writes(initial));await page.evaluate(()=>H.terminal());const failed=await settled('UNSAVED');
      proof.nativeError=failed.nativeEvents.slice(mark).find(e=>['request-error','abort'].includes(e.type)&&e.error==='QuotaExceededError');assert(proof.nativeError,'Actual native QuotaExceededError required');
      assert.equal(failed.view.continueEnabled,false);assert.deepEqual((await history()).records,before.records);proof.failure=evidence(failed);proof.status='verified';
    }finally{await cdp.send('Storage.overrideQuotaForOrigin',{origin:ORIGIN});await cdp.detach();}
    await page.evaluate(()=>H.retry());const result=await settled('READY');canonical(result,5100,1);assert.equal((await history()).records.length,2);proof.result=evidence(result);proof.disposed=await dispose();return proof;
  },120000);
  assert.deepEqual(report.network.rejected,[]);assert.deepEqual(report.pageErrors,[]);assert.deepEqual(report.consoleErrors,[]);
  assert.equal(report.tests.length,10);assert(report.tests.every(x=>x.status==='passed'));assert.equal(report.reloads,4);assert.equal(report.realms,13);
  assert.equal(git('status','--porcelain'),'');assert.deepEqual(sourceHashes(Object.keys(report.sourceHashes)),report.sourceHashes,'Sources unchanged after native run');report.status='passed';save();
}
timer=setTimeout(()=>{report.status='failed';report.deadline='Native shared-owner fixture exceeded 8 minutes';save();void browser?.close();process.exitCode=1;},480000);
main().catch(error=>{report.status='failed';report.error=error.stack;console.error(error.stack);process.exitCode=1;}).finally(async()=>{clearTimeout(timer);await browser?.close();save();});
