'use strict';
// SOURCE-ONLY protocol tests against actual unchanged final-handler callbacks.
// The adapter is an immutable Map double; no browser/server/account/IDB durability.
const assert=require('node:assert/strict');
const {webcrypto,createHash}=require('node:crypto');
const H=require('./evidence-invocation-original-helper.cjs');
const A=require('./evidence-invocation-archive-helper.cjs');
let checks=0,serial=0;
const eq=(a,b,message)=>{assert.deepStrictEqual(a,b,message);checks++;};
const ok=(value,message)=>{assert(value,message);checks++;};
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
const fresh=()=>import(A.url('invocation-fence.mjs')+'?independent-test='+ ++serial);
const groups=[],failures=[],measurements=[];
async function group(name,fn){if(process.env.MKTY_INVOCATION_GROUP&&!name.startsWith(process.env.MKTY_INVOCATION_GROUP))return;try{let timer;try{await Promise.race([fn(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('source fixture deadline: '+name)),20000);})]);}finally{clearTimeout(timer);}groups.push(name);}catch(error){failures.push({name,error:error.stack});console.error('FAIL '+name+'\n'+error.stack);}}
const eventRun=(chapter,event)=>`fr1:${A.SESSION}:${chapter}:${chapter===8?1:2}:${event}`;
async function harness(options={}) {
 const archive=await A.createArchiveFixture(options),module=await fresh(),game=H.originalFinalVM(options);
 game.ready();game.clear();const before=game.image();let active=false,current=true;
 // The cooperating caller owns the prepared-writer guard; the helper never reads game storage.
 const operationKey=H.opKey(game.chapter),preparedOperations=H.opText(game.chapter);
 archive.options.isCurrent=()=>current&&(active||(game.readNative(operationKey)===preparedOperations&&game.c.MKTYStorage.readItem(operationKey)===preparedOperations&&JSON.stringify(game.image())===JSON.stringify(before)));
 const fence=module.createInvocationFence(archive.options);
 return {...archive,module,game,before,fence,current:value=>{current=value;},
  invoke(){return fence.invoke(()=>{active=true;return game.invoke();});}};
}
async function armed(h){eq((await h.fence.prepare()).state,'PREPARED');eq((await h.fence.issue()).state,'ARMED');eq(h.game.counts().callbacks,0);return h;}
function receipt(h,event,chapter=h.options.chapter){
 const entry=h.store.get(eventRun(chapter,event));ok(entry,'fixed '+event+' archive exists');
 const bytes=entry.segments.get(0).payload;
 return {entry,bytes,data:JSON.parse(h.C.unframe(bytes,entry.descriptor)[0].text)};
}
function noReplay(h,count=0){try{h.fence.invoke(()=>h.game.invoke());}catch{}eq(h.game.counts().callbacks,count);}
function released(h){const r=h.budget.snapshot().reservations;for(const key of ['stream-candidate','returned-page','phase-assembly','helper-framing','helper-hash'])eq(r[key],0,key+' lease released');ok(h.budget.snapshot().peak<=1016832);}
async function inspect(archive,diskImage,{chapter=archive.options.chapter,operations='prepared'}={}) {
 const reload=await archive.fresh(),module=await fresh(),game=H.originalFinalVM({chapter,operations,diskImage});
 const before=game.image(),archives=reload.snapshot();
 const results=[];
 for(let i=0;i<2;i++) {
  const result=await module.inspectInvocationFence(reload.options);results.push(result);
  eq(result.invocationAllowed,false);eq(result.playEnabled,false);eq(result.continueEnabled,false);
  const expected=reload.store.has(eventRun(chapter,'RETURNED'))?'returned-observation':reload.store.has(eventRun(chapter,'ISSUED'))?'issued/no-return-observed':reload.store.has(eventRun(chapter,'PREPARED'))?'prepared-only':'absent/legacy-unattributed';
  eq(result.classification,expected,JSON.stringify(result));
  eq(game.image(),before);eq(game.logical,[]);eq(game.native,[]);eq(game.counts(),{callbacks:0,awards:0,opens:0});eq(reload.snapshot(),archives);
 }
 eq(reload.requests.some(row=>row.kind==='append'||row.kind==='retry'),false,'inspection uses reads only');
 released(reload);return {reload,game,results};
}
(async()=>{
 eq(H.verifySources(),12);
 const substratePins={
  'contract.mjs':'71dba721f871cc3183468b931846e0f967b4a8a3bbf2285b73fae4c34a4b1ee5',
  'adapter.mjs':'53c3b21262aec6477a8faa1f17e17204656f5b1069c1b15ff6e029c84d1fc318',
  'coordinator.mjs':'7375a44920f6a4efdc2819c1738e0938389cb344cdab6014fadc0590785185f7',
  'phase-budget.mjs':'0c0991ba9b2e402c2aec6dad9d3f917d5ff4536ac19301c7cc8964e52f86e288',
  'phase-writer-contract.mjs':'9d254b2f4e5daf28e37aaa7dea8a5c49529436f738e44de13c24f36c104a8bb8',
  'unsaved-result-gate.mjs':'c86ebe4af961a3fd1b544a5bb44233d5989704c330baf9e5b190075134121332'
 };
 for(const [file,pin] of Object.entries(substratePins))eq(createHash('sha256').update(H.source('prototypes/evidence-indexeddb/'+file)).digest('hex'),pin,'unchanged accepted substrate '+file);
 eq(H.source('index.html').includes('invocation-fence'),false,'candidate is not integrated into original game');
 await group('01 fresh exact commit and readback allow one synchronous original invocation',async()=>{
  for(const chapter of [8,9]) {
   const h=await armed(await harness({chapter}));
   const pre=receipt(h,'PREPARED'),issued=receipt(h,'ISSUED');
   eq(pre.data.previous,null);eq(issued.data.previous,pre.entry.head.root);
   eq(issued.data.writer,'final-prepared-operations-v1');eq(issued.data.phase,h.options.phasePin);eq(issued.data.context,h.options.contextPin);
   const events=h.events.filter(row=>['committed','read'].includes(row.kind));
   const committed=events.findIndex(row=>row.kind==='committed'&&row.run===eventRun(chapter,'ISSUED'));
   const read=events.findIndex(row=>row.kind==='read'&&row.run===eventRun(chapter,'ISSUED'));
   ok(committed>=0&&read>committed,'exact readback follows newly committed ISSUED');
   released(h);const result=h.invoke();ok(!result?.then,'original invoke API stays synchronous');
   eq(h.game.counts(),{callbacks:1,awards:1,opens:1});eq(h.game.logical.length,12);
   h.invoke();await h.fence.issue();await h.fence.prepare();await h.fence.retry();eq(h.game.counts().callbacks,1);
   await h.fence.recordReturned();const returned=receipt(h,'RETURNED');eq(returned.data.previous,issued.entry.head.root);
   eq([...h.store.keys()].filter(run=>run.startsWith('fr1:')),[eventRun(chapter,'PREPARED'),eventRun(chapter,'ISSUED'),eventRun(chapter,'RETURNED')]);
   for(const r of [pre,issued,returned]){ok(r.bytes.length<=692);ok(JSON.stringify(r.data).length*2<=1344);ok(JSON.stringify(r.entry.descriptor).length*2<=896);}
   const {results}=await inspect(h,h.game.image());measurements.push({chapter,receipts:[pre.bytes.length,issued.bytes.length,returned.bytes.length],classification:results[0]});
   eq(h.game.image().mkty_points,chapter===8?'2100':'5100');released(h);
  }
 });
 await group('02 all24 prepared native-failure prefixes reload without original RAM or replay',async()=>{
  let cases=0;
  for(const chapter of [8,9]) {
   const baseline=H.originalFinalVM({chapter});baseline.ready();baseline.clear();const before=baseline.image();baseline.invoke();
   const writes=baseline.logical.map(row=>({...row})),images=H.prefixImages(before,writes);
   for(let cut=0;cut<=12;cut++) {
    let h=await armed(await harness({chapter}));if(cut<12)h.game.cut(cut);h.invoke();
    eq(h.game.counts().callbacks,1);eq(h.game.logical,writes);eq(h.game.image(),images[cut]);
    ok(!h.store.has(eventRun(chapter,'RETURNED')),'callback returned while RETURNED is absent');
    const diskImage=h.game.image(),archive=h;h.game.discard();h=null;
    const {results}=await inspect(archive,diskImage);eq(results[0].invocationAllowed,false);
    ok(H.compatibleCuts(images,diskImage).includes(cut));cases++;
   }
  }
  eq(cases,26);measurements.push({nativeFaultCuts:24,successfulNativeEndsWithoutReturned:2});
 });
 await group('03 committed before invocation, PREPARED, empty and old archives never authorize reload',async()=>{
  for(const stage of ['empty','old','prepared','issued']) {
   const h=await harness({seedReferences:stage!=='empty'});
   if(stage==='prepared'||stage==='issued')eq((await h.fence.prepare()).state,'PREPARED');if(stage==='issued')await h.fence.issue();
   const before=h.game.image();await inspect(h,before);eq(h.game.counts().callbacks,0);
  }
  for(const chapter of [8,9]) {
   const old=await harness({chapter,operations:'absent'});eq((await old.fence.prepare()).state,'BLOCKED');noReplay(old);eq(old.requests.filter(row=>row.kind==='append').length,0);await inspect(old,old.game.image(),{operations:'absent'});
   eq(old.game.image()[H.opKey(chapter)],undefined);
  }
 });
 await group('04 immutable duplicate PREPARED or ISSUED never creates a second invocation slot',async()=>{
  for(const stage of ['PREPARED','ISSUED','RETURNED']) {
   const old=await harness();eq((await old.fence.prepare()).state,'PREPARED');if(stage!=='PREPARED')await old.fence.issue();
   if(stage==='RETURNED'){old.invoke();await old.fence.recordReturned();}
   const originalSnapshot=old.snapshot();
   const reload=await old.fresh(),M=await fresh();const fence=M.createInvocationFence(reload.options);let calls=0;
   await fence.prepare();await fence.issue();fence.invoke(()=>{calls++;});await fence.retry();fence.invoke(()=>{calls++;});
   eq(calls,0);eq(reload.snapshot(),originalSnapshot);ok(reload.requests.filter(row=>row.kind==='append').every(row=>row.q.descriptor.run===eventRun(8,'PREPARED')));
  }
 });
 await group('05 abort, commit-with-lost-ack and unknown retry use exact fixed candidate and never arm',async()=>{
  for(const event of ['PREPARED','ISSUED'])for(const terminal of ['aborted','committed','unknown']) {
   const h=await harness();if(event==='ISSUED')eq((await h.fence.prepare()).state,'PREPARED');let once=true,candidate=null;
   h.hooks.append=async(q,commit)=>{if(once){once=false;candidate=q;if(terminal==='aborted')return {status:'refused',reason:'transaction-aborted'};if(terminal==='committed')await commit(q);return {status:'outcomeUnknown',reason:'terminal-unobserved'};}return commit(q);};
   await (event==='PREPARED'?h.fence.prepare():h.fence.issue());const bytes=Array.from(candidate.payload),run=candidate.descriptor.run;
   noReplay(h);await h.fence.retry();noReplay(h);await h.fence.issue();noReplay(h);
   for(const row of h.requests.filter(row=>row.kind==='retry')){eq(row.q,candidate,'unknown retry preserves same request identity');eq(Array.from(row.q.payload),bytes);eq(row.q.descriptor.run,run);}
   ok(h.requests.filter(row=>row.kind==='append'&&row.q.descriptor.run===run).every(row=>Array.from(row.q.payload).join(',')===bytes.join(',')));
   ok([...h.store.keys()].filter(key=>key.startsWith('fr1:')).every(key=>/:(PREPARED|ISSUED)$/.test(key)));
  }
 });
 await group('06 corrupt, missing or mismatched ISSUED exact readback blocks original invocation',async()=>{
  for(const kind of ['payload','root','throughHead','missing','extra']) {
   const h=await harness();eq((await h.fence.prepare()).state,'PREPARED');
   h.hooks.read=(page,q)=>{if(q.captureIdentity.run!==eventRun(8,'ISSUED'))return page;
    if(kind==='payload')page.segments[0].payload[20]^=1;else if(kind==='root')page.segments[0].root='f'.repeat(64);
    else if(kind==='throughHead')page.throughHead+='x';else if(kind==='missing')return {status:'refused',reason:'read-failure'};else page.extra=true;return page;};
   await h.fence.issue();noReplay(h);await h.fence.retry();noReplay(h);released(h);
  }
 });
 await group('07 late, stale, physical-busy and observed old-writer changes revoke before call',async()=>{
  for(const change of ['stale','identity','physical','same-value','aba']) {
   const h=await harness();eq((await h.fence.prepare()).state,'PREPARED');const entered=deferred(),release=deferred();
   h.hooks.append=async(q,commit)=>{const result=await commit(q);entered.resolve();await release.promise;return result;};
   const pending=h.fence.issue();await entered.promise;
   if(change==='physical')h.physical(true);else if(change==='identity')h.setIdentity({...h.live(),generation:2});
   else {if(change==='same-value')h.game.disk.set('mkty_points',h.game.disk.get('mkty_points'));
    if(change==='aba'){const old=h.game.disk.get('mkty_points');h.game.disk.set('mkty_points','999');h.game.disk.set('mkty_points',old);}h.current(false);}
   release.resolve();await pending;noReplay(h);h.physical(false);h.current(true);await h.fence.retry();noReplay(h);
  }
  const h=await armed(await harness());h.current(false);noReplay(h);h.current(true);noReplay(h);
 });
 await group('08 reentry during append, readback, observer and original callback never invokes twice',async()=>{
  for(const seam of ['append','read']) {
   const h=await harness();eq((await h.fence.prepare()).state,'PREPARED');let calls=0;
   if(seam==='append')h.hooks.append=async(q,commit)=>{await h.fence.issue();await h.fence.retry();h.fence.invoke(()=>{calls++;});return commit(q);};
   else h.hooks.read=async page=>{await h.fence.issue();await h.fence.retry();h.fence.invoke(()=>{calls++;});return page;};
   await h.fence.issue();eq(calls,0);h.invoke();ok(h.game.counts().callbacks<=1);
  }
  const h=await armed(await harness());let count=0;
  h.fence.invoke(()=>{count++;h.fence.invoke(()=>{count++;});});eq(count,1);h.fence.invoke(()=>{count++;});eq(count,1);
 });
 await group('09 original throw and Promise return consume the capability without RETURNED authority',async()=>{
  for(const mode of ['throw','promise']) {
   const h=await armed(await harness());let calls=0;
   try{h.fence.invoke(()=>{calls++;if(mode==='throw')throw Error('fixture original failure');return Promise.resolve();});}catch{}
   h.fence.invoke(()=>{calls++;});await h.fence.recordReturned();eq(calls,1);ok(!h.store.has(eventRun(8,'RETURNED')));
   await inspect(h,h.game.image());
  }
 });
 await group('10 RETURNED absent, aborted or unknown remains inspection-only even with complete native bytes',async()=>{
  for(const mode of ['absent','abort','unknown']) {
   const h=await armed(await harness());h.invoke();
   if(mode!=='absent'){h.hooks.append=async(q,commit)=>{if(mode==='unknown'){await commit(q);return {status:'outcomeUnknown',reason:'terminal-unobserved'};}return {status:'refused',reason:'transaction-aborted'};};await h.fence.recordReturned();}
   const {results}=await inspect(h,h.game.image());eq(results[0].invocationAllowed,false);eq(h.game.image().mkty_life8_awarded,'yes');
   h.invoke();await h.fence.retry();h.invoke();eq(h.game.counts().callbacks,1);
  }
 });
 await group('11 incomplete discovery and malformed archive records preserve all bytes',async()=>{
  for(const kind of ['missing-context','missing-phase','corrupt-context','corrupt-phase','unsealed','duplicate-index','partial','wrong-watermark','read-abort']) {
   const h=await armed(await harness());const context=`fc1:${A.SESSION}:8`,phase=`fp2:${A.SESSION}:8:1`;
   // Deliberate fixture evidence loss/corruption; no candidate deletion API exists.
   if(kind==='missing-context')h.store.delete(context);if(kind==='missing-phase')h.store.delete(phase);
   if(kind==='corrupt-context'||kind==='corrupt-phase')h.store.get(kind==='corrupt-context'?context:phase).segments.get(0).payload[25]^=1;
   if(kind==='unsealed'){h.store.get(context).head.sealed=false;}
   const reload=await h.fresh(),M=await fresh(),before=reload.snapshot();
   if(kind==='duplicate-index')reload.hooks.recover=page=>({...page,heads:page.heads.length?[page.heads[0],page.heads[0]]:[],nextCursor:null});
   if(kind==='partial')reload.hooks.recover=page=>({...page,nextCursor:'not-a-valid-cursor'});
   if(kind==='wrong-watermark')reload.hooks.recover=page=>({...page,watermark:129});
   if(kind==='read-abort')reload.hooks.read=()=>({status:'refused',reason:'transaction-aborted'});
   const result=await M.inspectInvocationFence(reload.options);eq(result.invocationAllowed,false);eq(result.playEnabled,false);eq(result.continueEnabled,false);
   eq(reload.snapshot(),before);eq(reload.requests.some(row=>row.kind==='append'||row.kind==='retry'),false);released(reload);
  }
 });
 await group('12 malformed canonical records, writer versions and predecessor chains refuse inspection authority',async()=>{
  for(const kind of ['version','writer','extra','identity','phase-pin','previous','missing-prepared','whitespace','field-order']) {
   const h=await armed(await harness()),entry=receipt(h,'ISSUED'),data=A.clone(entry.data);
   if(kind==='version')data.version=99;
   if(kind==='writer')data.writer='final-absent-operations-v1';
   if(kind==='extra')data.resume=true;
   if(kind==='identity')data.identity='f'.repeat(64);
   if(kind==='phase-pin')data.phase.root='f'.repeat(64);
   if(kind==='previous')data.previous='f'.repeat(64);
   if(kind==='missing-prepared')h.store.delete(eventRun(8,'PREPARED'));
   else {
    const encoded=kind==='field-order'?Object.fromEntries(Object.entries(data).reverse()):data;
    const framed=h.C.frame([{name:'observation',encoding:'utf8',text:(kind==='whitespace'?' ':'')+JSON.stringify(encoded)}]);
    const descriptor={...entry.entry.descriptor,components:framed.components};
    h.store.delete(eventRun(8,'ISSUED'));await h.addArtifact(descriptor,framed.bytes);
   }
   const reload=await h.fresh(),M=await fresh(),before=reload.snapshot(),result=await M.inspectInvocationFence(reload.options);
   eq(result.invocationAllowed,false);ok(['incomplete/unverified','unsupported/conflicting'].includes(result.classification));
   eq(reload.snapshot(),before);eq(reload.requests.some(row=>['append','retry'].includes(row.kind)),false);
  }
 });
 await group('13 both final chains may coexist without supplying another invocation',async()=>{
  const first=await armed(await harness({chapter:8}));first.invoke();await first.fence.recordReturned();
  const second=await armed(await harness({chapter:9}));second.invoke();await second.fence.recordReturned();
  for(const [key,value] of second.store)first.store.set(key,value);
  await inspect(first,first.game.image());
  const reload9=await A.createArchiveFixture({chapter:9,shared:first.store});
  await inspect(reload9,second.game.image(),{chapter:9});
 });
 await group('14 every original pre-state key mutation across readback blocks invocation',async()=>{
  const baseline=await harness();
  for(const key of Object.keys(baseline.before)) {
   const h=await harness();eq((await h.fence.prepare()).state,'PREPARED');let changed=false;
   h.hooks.read=(page,q)=>{if(!changed&&q.captureIdentity.run===eventRun(8,'ISSUED')){changed=true;h.game.disk.set(key,h.game.disk.get(key)+' ');}return page;};
   await h.fence.issue();ok(changed);noReplay(h);eq(h.game.logical,[]);eq(h.game.native,[]);
  }
 });
 await group('15 discovery watermark is membership-only when ISSUED appears later',async()=>{
  const h=await harness();eq((await h.fence.prepare()).state,'PREPARED');const reload=await h.fresh(),M=await fresh();let once=true;
  reload.hooks.recover=async page=>{if(once){once=false;eq(page.watermark,3);await h.fence.issue();eq(h.fence.view().state,'ARMED');}return page;};
  const result=await M.inspectInvocationFence(reload.options);eq(result.classification,'prepared-only');eq(result.watermark,3);eq(result.membershipOnly,true);eq(result.invocationAllowed,false);
  ok(h.store.has(eventRun(8,'ISSUED')));eq(h.game.counts().callbacks,0);
  const other=M.createInvocationFence(reload.options);let called=0;await other.prepare();await other.issue();other.invoke(()=>{called++;});eq(called,0);
 });
 await group('16 budget observer reentry never obtains an invocation during journal preparation',async()=>{
  const a=await A.createArchiveFixture(),M=await fresh();let fence,calls=0,reentries=0;
  const budget=a.B.createPhaseBudget({observe(){if(fence){reentries++;fence.invoke(()=>{calls++;});void fence.issue();}}});
  fence=M.createInvocationFence({...a.options,budget});await fence.prepare();await fence.issue();eq(calls,0);ok(reentries>0);
  fence.invoke(()=>{calls++;});ok(calls<=1);fence.invoke(()=>{calls++;});ok(calls<=1);
 });
 await group('17 fixed caps, immutable pins, wrong identities and bounded metadata reject intact',async()=>{
  const h=await harness();eq(h.C.LIMIT.quota,8388608);eq(h.C.LIMIT.captures,128);eq(h.B.PHASE_BUDGET.ceiling,1016832);eq(h.B.PHASE_BUDGET.metadata,32768);
  const originalPins=A.clone([h.options.contextPin,h.options.phasePin]);eq((await h.fence.prepare()).state,'PREPARED');eq([h.options.contextPin,h.options.phasePin],originalPins);
  for(const mutate of [options=>{options.identity='f'.repeat(64);},options=>{options.chapter=9;options.phase=1;},
   options=>{options.phasePin={...options.phasePin,total:16385};},options=>{options.contextPin={...options.contextPin,total:69661};},
   options=>{options.sessionMetadataBytes=()=>32768;},options=>{options.scope='x'.repeat(129);}]) {
   const a=await A.createArchiveFixture(),M=await fresh(),options={...a.options};mutate(options);let calls=0;
   try{const fence=M.createInvocationFence(options);await fence.prepare();await fence.issue();fence.invoke(()=>{calls++;});}catch{}
   eq(calls,0);eq([...a.store.keys()].filter(key=>key.startsWith('fr1:')).length,0);
  }
 });
 await group('18 returned observations never certify native persistence or an executed prefix cursor',async()=>{
  for(const chapter of [8,9])for(const cut of chapter===8?[0,4,8]:[0,3,7]) {
   const h=await armed(await harness({chapter}));h.game.cut(cut);h.invoke();eq(h.game.persistent(),false);
   const native=h.game.image();await h.fence.recordReturned();ok(h.store.has(eventRun(chapter,'RETURNED')));
   eq(h.game.image(),native,'journal receipt never flushes original volatile overlay');
   const {results}=await inspect(h,native);eq(results[0].classification,'returned-observation');
   eq(results[0].invocationAllowed,false);eq(results[0].done,undefined);eq(results[0].cursor,undefined);
   eq(h.game.counts().callbacks,1);
  }
 });
 await group('19 reserve, allocation and release observer exceptions release every journal slot',async()=>{
  for(const type of ['reserve','allocate','release'])for(const label of ['stream-candidate','returned-page','helper-hash','helper-framing']) {
   const a=await A.createArchiveFixture(),M=await fresh();let injected=false,fence,calls=0;
   const budget=a.B.createPhaseBudget({observe(event){if(!injected&&event.type===type&&event.label===label){injected=true;throw Error('injected '+type+' '+label);}}});
   try{fence=M.createInvocationFence({...a.options,budget});await fence.prepare();await fence.issue();fence.invoke(()=>{calls++;});}catch{}
   ok(injected,type+' '+label+' was reached');eq(calls,0);
   for(const key of ['stream-candidate','returned-page','phase-assembly','helper-framing','helper-hash'])eq(budget.snapshot().reservations[key],0,type+' '+label+' must release '+key);
   eq(budget.snapshot().live,425984);ok(!fence||!fence.view().invocationAllowed);
  }
 });
 await group('20 every discovery, hash, append and readback await holds the one-shot capability closed',async()=>{
  const a=await A.createArchiveFixture(),M=await fresh(),queue=[],wake=[];let done=false,calls=0,waits=0;
  const park=kind=>{const d=deferred();queue.push({kind,...d});wake.shift()?.();return d.promise;};
  const crypto={subtle:{async digest(...args){await park('hash');return webcrypto.subtle.digest(...args);}}};
  const fence=M.createInvocationFence({...a.options,crypto});
  a.hooks.append=async(q,commit)=>{await park('append');return commit(q);};a.hooks.read=async page=>{await park('read');return page;};a.hooks.recover=async page=>{await park('recover');return page;};
  const work=(async()=>{await fence.prepare();await fence.issue();})().finally(()=>{done=true;wake.shift()?.();});
  while(!done){if(!queue.length)await new Promise(resolve=>wake.push(resolve));const next=queue.shift();if(!next)continue;
   waits++;const before=a.requests.length;eq(fence.view().invocationAllowed,false);fence.invoke(()=>{calls++;});
   await fence.issue();await fence.prepare();await fence.retry();eq(a.requests.length,before);eq(calls,0);next.resolve();
  }
  await work;ok(waits>10);eq(fence.view().state,'ARMED');fence.invoke(()=>{calls++;});eq(calls,1);fence.invoke(()=>{calls++;});eq(calls,1);released(a);
  measurements.push({everyAwaitBoundaries:waits});
 });
 await group('21 last-moment metadata and guard invalidations prevent original invocation',async()=>{
  for(const kind of ['metadata','physical-getter','current-getter']) {
   const a=await A.createArchiveFixture(),M=await fresh();let metadata=26384,current=true,attack=false,physical=false,calls=0;
   const coordinator={appendSegment:(...args)=>a.coordinator.appendSegment(...args),readSegments:(...args)=>a.coordinator.readSegments(...args),
    retry:(...args)=>a.coordinator.retry(...args),recover:(...args)=>a.coordinator.recover(...args),get retainedBytes(){return a.coordinator.retainedBytes;},
    get physicalBusy(){if(attack&&kind==='physical-getter'){attack=false;current=false;}return physical;}};
   const fence=M.createInvocationFence({...a.options,coordinator,sessionMetadataBytes:()=>metadata,isCurrent(){if(attack&&kind==='current-getter'){attack=false;physical=true;}return current;}});
   eq((await fence.prepare()).state,'PREPARED');eq((await fence.issue()).state,'ARMED');
   if(kind==='metadata')metadata=32768;else attack=true;
   try{fence.invoke(()=>{calls++;});}catch{}
   eq(calls,0,kind+' invalidates immediately before callback');ok(!fence.view().invocationAllowed);
  }
 });
 await group('22 concurrent contenders and duplicate ISSUED never create another capability',async()=>{
  const a=await A.createArchiveFixture(),b=await a.fresh(),M=await fresh(),N=await fresh();
  const first=M.createInvocationFence(a.options),second=N.createInvocationFence(b.options);let calls=0;
  const prepared=await Promise.all([first.prepare(),second.prepare()]);eq(prepared.filter(value=>value.state==='PREPARED').length,1);
  await Promise.all([first.issue(),second.issue()]);first.invoke(()=>{calls++;});second.invoke(()=>{calls++;});eq(calls,1);
  await Promise.all([first.retry(),second.retry()]);first.invoke(()=>{calls++;});second.invoke(()=>{calls++;});eq(calls,1);
  const h=await harness();eq((await h.fence.prepare()).state,'PREPARED');
  h.hooks.append=async(q,commit)=>{eq((await commit(q)).status,'committed');return commit(q);};
  await h.fence.issue();noReplay(h);ok(h.store.has(eventRun(8,'ISSUED')));await h.fence.retry();noReplay(h);
 });
 await group('23 maximum pin shapes and caller mutation preserve bounded immutable journal bytes',async()=>{
  const a=await A.createArchiveFixture(),M=await fresh();
  const contextPin={binding:'a'.repeat(64),root:'b'.repeat(64),ordinal:2,total:69660},phasePin={binding:'c'.repeat(64),root:'d'.repeat(64),ordinal:0,total:16384};
  const expectedContext=A.clone(a.options.expectedContext),saved=A.clone([contextPin,phasePin]);
  const fence=M.createInvocationFence({...a.options,contextPin,phasePin,expectedContext});
  contextPin.root='f'.repeat(64);phasePin.total=21;expectedContext.generation=99;
  eq((await fence.prepare()).state,'PREPARED');eq((await fence.issue()).state,'ARMED');let calls=0;fence.invoke(()=>{calls++;});await fence.recordReturned();eq(calls,1);
  for(const event of ['PREPARED','ISSUED','RETURNED']) {
   const row=receipt(a,event);eq(row.data.context,saved[0]);eq(row.data.phase,saved[1]);ok(row.bytes.length<=692);ok(JSON.stringify(row.data).length*2<=1344);
   ok(JSON.stringify(row.entry.descriptor).length*2<=896);
  }
  eq(receipt(a,'RETURNED').bytes.length,683);ok(fence.view().metadataPeak<=5120);ok(26384+fence.view().metadataPeak<=32768);released(a);
 });
 await group('24 quota, allocation and WebCrypto failures never spend an invocation capability',async()=>{
  for(const reason of ['native-quota','logical-quota','capture-limit','allocation-refused','connection-closed']) {
   const h=await harness();eq((await h.fence.prepare()).state,'PREPARED');h.hooks.append=()=>({status:'refused',reason});
   await h.fence.issue();noReplay(h);await h.fence.retry();noReplay(h);eq(h.store.has(eventRun(8,'ISSUED')),false);released(h);
  }
  const a=await A.createArchiveFixture(),M=await fresh();let reject=false,calls=0;
  const crypto={subtle:{digest(...args){return reject?Promise.reject(Error('fixture WebCrypto failure')):webcrypto.subtle.digest(...args);}}};
  const fence=M.createInvocationFence({...a.options,crypto});eq((await fence.prepare()).state,'PREPARED');reject=true;await fence.issue();
  try{fence.invoke(()=>{calls++;});}catch{}eq(calls,0);released(a);
 });
 await group('25 refused borrowing never releases another pre-existing workspace owner',async()=>{
  const a=await A.createArchiveFixture(),M=await fresh();a.budget.reserve('recovery-page',16384);
  const before=a.budget.snapshot().reservations;const result=await M.inspectInvocationFence(a.options);
  eq(result.invocationAllowed,false);eq(a.budget.snapshot().reservations,before,'pre-held recovery-page belongs to another owner');
  a.budget.release('recovery-page',16384);
  const b=await A.createArchiveFixture(),N=await fresh();let inject=false,borrowed=false,budget;
  budget=b.B.createPhaseBudget({observe(event){if(inject&&!borrowed&&event.type==='release'&&event.label==='stream-candidate'){borrowed=true;budget.reserve('returned-page',1024);}}});
  const fence=N.createInvocationFence({...b.options,budget});eq((await fence.prepare()).state,'PREPARED');inject=true;
  await fence.issue();ok(borrowed);let calls=0;try{fence.invoke(()=>{calls++;});}catch{}eq(calls,0);
  eq(budget.snapshot().reservations['returned-page'],1024,'refused readback does not release external page owner');
  budget.release('returned-page',1024);eq(budget.snapshot().live,425984);
 });
 await group('26 surviving later-only records block fresh prepare before any new journal write',async()=>{
  for(const event of ['ISSUED','RETURNED']) {
   const h=await harness(),options=h.options;
   const data={version:1,session:options.session,stage:'8:1',event,writer:'final-prepared-operations-v1',identity:options.identity,
    phase:A.clone(options.phasePin),context:A.clone(options.contextPin),previous:'f'.repeat(64)};
   const frame=h.C.frame([{name:'observation',encoding:'utf8',text:JSON.stringify(data)}]);
   const descriptor={format:h.C.FORMAT,scope:options.scope,run:eventRun(8,event),kind:'finale-recovery-observation',model:'finale-recovery-observation-v1',components:frame.components,note:''};
   await h.addArtifact(descriptor,frame.bytes);const before=h.snapshot();
   await h.fence.prepare();await h.fence.issue();noReplay(h);
   eq(h.requests.filter(row=>row.kind==='append').length,0,event+' survivor refuses before PREPARED append');
   eq(h.snapshot(),before);eq(h.game.logical,[]);eq(h.game.native,[]);
   const reload=await h.fresh(),M=await fresh(),result=await M.inspectInvocationFence(reload.options);
   eq(result.classification,'incomplete/unverified');eq(result.invocationAllowed,false);
  }
 });
 await group('27 truncated discovery and forged progress never prove journal absence',async()=>{
  for(const kind of ['truncated','empty','duplicate','wrong-cursor','refused']) {
   const h=await harness();let first=null;
   const corrupt=async page=>{if(kind==='refused')return {status:'refused',reason:'transaction-aborted'};
    if(kind==='truncated')return {...page,nextCursor:null};
    if(kind==='empty')return {...page,heads:[],nextCursor:null};
    if(kind==='duplicate'){first??=A.clone(page.heads[0]);return {...page,heads:first?[A.clone(first)]:[]};}
    if(page.nextCursor){const cursor=await h.C.untoken('r',page.nextCursor,webcrypto);return {...page,nextCursor:await h.C.token('r',{...cursor,next:cursor.next+1},webcrypto)};}return page;};
   h.hooks.recover=corrupt;const before=h.snapshot();await h.fence.prepare();await h.fence.issue();noReplay(h);
   eq(h.requests.filter(row=>row.kind==='append').length,0,kind+' discovery cannot append PREPARED');eq(h.snapshot(),before);
   const reload=await h.fresh(),M=await fresh();first=null;reload.hooks.recover=corrupt;
   const result=await M.inspectInvocationFence(reload.options);eq(result.invocationAllowed,false);eq(result.classification,'incomplete/unverified');
   eq(reload.snapshot(),before);eq(reload.requests.some(row=>row.kind==='append'||row.kind==='retry'),false);released(reload);
  }
 });
 eq(H.verifySources(),12);
 console.log(JSON.stringify({status:failures.length?'failed':'passed',suite:'source-only invocation fence',checks,groups,failures,measurements}));
 if(failures.length)process.exitCode=1;
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
