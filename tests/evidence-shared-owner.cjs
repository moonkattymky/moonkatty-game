'use strict';
// Portable source-only evidence: synthetic prerequisites, model-valid archived
// phase, Map transport and native WebCrypto. Failures below simulate abort/quota.
// No browser, native IndexedDB, server, player data, publication or network.
const assert=require('node:assert/strict'),H=require('./evidence-shared-owner-helper.cjs'),Field=require('../field-model.js');
const {fixture,archive,clean,clone,rawRecord,url,F,SCOPE,SESSION,PRINCIPAL,DAY,webcrypto}=H;
const run=`fshared1:${SESSION}`,groups=[],measurements=[];let checks=0,oldCallbacks=0;
const eq=(a,b,m)=>{assert.deepStrictEqual(a,b,m);checks++;},ok=(v,m)=>{assert(v,m);checks++;};
const saved={};for(const key of ['fetch','WebSocket','XMLHttpRequest','localStorage','awardLifePoints','terminalCallback','MKTYRewards'])saved[key]=globalThis[key];
for(const key of ['fetch','WebSocket','XMLHttpRequest'])globalThis[key]=()=>{throw Error('portable-test-network-forbidden');};
globalThis.localStorage={getItem(){throw Error('ambient-storage-forbidden');},setItem(){throw Error('ambient-storage-forbidden');}};
globalThis.awardLifePoints=globalThis.terminalCallback=()=>{oldCallbacks++;throw Error('old-callback-forbidden');};
globalThis.MKTYRewards={call(){oldCallbacks++;throw Error('old-rewards-forbidden');}};
const points=v=>Number(v.values.mkty_points),effectCount=h=>h.adapter.entries.get(run)?.segments.length-1;
function finish(a){a.owner.dispose();clean(a.budget);checks++;ok(a.budget.snapshot().peak<=1016832);}
async function adopted(h,options){const a=h.owner(options),v=await a.owner.adopt(h.manifest);eq([v.state,v.reason,v.revision],['ACTIVE',null,0]);return a;}
function ready(v,n,revision){eq([v.state,v.reason,points(v),v.revision],['READY',null,n,revision]);eq(v.values.mkty_life9,'complete');eq(v.values.mkty_final_moon_points,String(n));}
(async()=>{
  const C=await import(url('contract.mjs')),B=await import(url('phase-budget.mjs')),L=await import(url('shared-log.mjs')),X=await import(url('finale-context-v1.mjs'));
  async function group(name,work){await work();groups.push(name);}
  await group('01 both serial orders preserve original terminal and first-day claim semantics',async()=>{
    for(const dailyFirst of [true,false]){
      const h=await fixture(),a=await adopted(h),ticket=await a.owner.admitDaily();ok(ticket);let v;
      if(dailyFirst){v=await a.owner.checkin(ticket);eq([v.state,points(v),v.lastReceipt.delta],['ACTIVE',2103,3]);v=await a.owner.submitTerminal(h.phasePin);}
      else{v=await a.owner.submitTerminal(h.phasePin);ready(v,5100,1);eq(await a.owner.admitDaily(),null);v=await a.owner.checkin(ticket);eq(v.lastReceipt.delta,0);eq(v.lastReceipt.legacyResult.points,3);}
      ready(v,dailyFirst?5103:5100,2);const d=JSON.parse(v.values.mkty_daily_demo),original=JSON.parse(h.manifest.dailyText);
      eq([d.streak,d.last_day,d.attempts,d.solved,d.codes],[1,DAY,2,true,['MOONTEST']]);for(const key of ['cipher','opaque','shield_week'])eq(d[key],original[key]);
      eq(JSON.parse(v.projection.storyText).createdAt,h.intent.storyCompleted);eq(v.projection.addedSeconds,10);eq(v.values.mkty_points_locked_at,String(h.intent.lock));
      eq(effectCount(h),2);ok(v.head.head.sealed);eq(v.head.head.total,49152);eq(h.adapter.entries.size,3);finish(a);
    }
  });
  await group('02 simultaneous same-revision proposals recompute the loser in both orders',async()=>{
    for(const order of [['daily','terminal'],['terminal','daily']]){
      const h=await fixture(),a=await adopted(h),b=h.owner({transport:await h.adapter.fork()});eq((await b.owner.recover()).state,'ACTIVE');
      const ticket=await a.owner.admitDaily();h.adapter.raceNext(order);
      const result=await Promise.all([a.owner.checkin(ticket),b.owner.submitTerminal(h.phasePin)]);ok(result.every(v=>['ACTIVE','READY'].includes(v.state)));
      const expected=order[0]==='daily'?5103:5100;ready(await a.owner.recover(),expected,2);ready(await b.owner.recover(),expected,2);
      const requests=h.adapter.events.filter(e=>e.type==='append'&&e.run===run&&e.ordinal===1);eq(requests.length,2);eq(requests[0].expectedHead,requests[1].expectedHead);
      ok(h.adapter.events.some(e=>e.type==='result'&&e.status==='conflict'));eq(effectCount(h),2);finish(a);finish(b);
    }
  });
  await group('03 duplicate daily and terminal commands never reapply historical deltas',async()=>{
    const h=await fixture(),a=await adopted(h),ticket=await a.owner.admitDaily();await a.owner.checkin(ticket);const v=await a.owner.submitTerminal(h.phasePin),expected=clone(v.values),before=h.adapter.snapshot();
    for(let i=0;i<2;i++){const d=await a.owner.checkin(ticket);eq(d.values,expected);eq(d.lastReceipt.delta,3);ready(await a.owner.submitTerminal(h.phasePin),5103,2);}
    eq(h.adapter.snapshot(),before);eq(effectCount(h),2);eq(oldCallbacks,0);
    assert.throws(()=>{v.values.mkty_points='1';},TypeError);checks++;const mirror=clone(v.values);mirror.mkty_points='1';eq((await a.owner.recover()).values,expected);finish(a);
  });
  await group('04 duplicate older receipt with newer current head displays the current prefix',async()=>{
    const h=await fixture(),a=await adopted(h),b=h.owner({transport:await h.adapter.fork()});await b.owner.recover();const ticket=await b.owner.admitDaily();
    h.adapter.setMode('unknown-commit');eq((await a.owner.submitTerminal(h.phasePin)).state,'UNSAVED');ok(h.adapter.retainedBytes>0);
    ready(await b.owner.checkin(ticket),5100,2);const v=await a.owner.retry();ready(v,5100,2);eq(v.lastReceipt.id,'life:9:complete');eq(v.lastReceipt.revision,1);
    eq(h.adapter.retainedBytes,0);ok(h.adapter.events.some(e=>e.type==='result'&&e.status==='duplicate'&&e.ordinal===1));finish(a);finish(b);
  });
  await group('05 portable abort and quota simulations preserve old revision and allow exact retry',async()=>{
    for(const kind of ['daily','terminal'])for(const failure of ['abort','quota']){
      const h=await fixture(),a=await adopted(h),ticket=await a.owner.admitDaily(),before=h.adapter.snapshot();h.adapter.setMode(failure);
      const v=await(kind==='daily'?a.owner.checkin(ticket):a.owner.submitTerminal(h.phasePin));eq(v.state,'UNSAVED');eq(h.adapter.snapshot(),before);const mark=h.adapter.events.length;
      await(kind==='daily'?a.owner.submitTerminal(h.phasePin):a.owner.checkin(ticket));eq(h.adapter.events.length,mark);
      const r=await a.owner.retry();eq([r.state,points(r),r.revision],[kind==='daily'?'ACTIVE':'READY',kind==='daily'?2103:5100,1]);eq(effectCount(h),1);finish(a);
    }
  });
  await group('06 portable lost acknowledgments retain exact requests for both commands',async()=>{
    for(const kind of ['daily','terminal'])for(const failure of ['unknown-abort','unknown-commit']){
      const h=await fixture(),a=await adopted(h),ticket=await a.owner.admitDaily();h.adapter.setMode(failure);
      eq((await(kind==='daily'?a.owner.checkin(ticket):a.owner.submitTerminal(h.phasePin))).state,'UNSAVED');const retained=h.adapter.retained();ok(retained);const count=h.adapter.events.length;
      await a.owner.submitTerminal(h.phasePin);await a.owner.checkin(ticket);eq(h.adapter.events.length,count);eq(h.adapter.retained(),retained);
      const v=await a.owner.retry();eq([v.state,points(v),v.revision],[kind==='daily'?'ACTIVE':'READY',kind==='daily'?2103:5100,1]);eq(h.adapter.retainedBytes,0);eq(effectCount(h),1);finish(a);
    }
  });
  await group('07 two fresh module readers recover exact projection and receipt without writes',async()=>{
    const h=await fixture(),a=await adopted(h),ticket=await a.owner.admitDaily();await a.owner.checkin(ticket);const v=await a.owner.submitTerminal(h.phasePin),expected=clone({projection:v.projection,values:v.values,lastReceipt:v.lastReceipt});finish(a);
    const before=h.adapter.snapshot();for(let i=0;i<2;i++){const module=await import(url('shared-guest-owner.mjs')+'?reader='+i),b=h.owner({module,transport:await h.adapter.fork()}),r=await b.owner.recover();
      ready(r,5103,2);eq({projection:r.projection,values:r.values,lastReceipt:r.lastReceipt},expected);finish(b);}eq(h.adapter.snapshot(),before);
  });
  await group('08 account, old-save, unknown pending, unsupported baseline and daily admission refuse intact',async()=>{
    const bad=[m=>m.entry.initData='telegram-data',m=>m.entry.accountScope='telegram:123',m=>m.entry.origin='legacy',m=>m.entry.pendingQueueText='[]',m=>delete m.entry.pendingQueueText,
      m=>m.entry.pendingQueueText={unreadable:true},m=>m.principal='guest:other',m=>m.baseline.points=100,m=>m.baseline.life='complete',m=>m.baseline.awarded='yes',m=>m.baseline.completedAt=42,
      m=>m.dailyText=JSON.stringify({...H.daily(),last_day:DAY}),m=>m.dailyText=JSON.stringify({...H.daily(),cday:'2026-10-11'}),m=>m.dailyText=JSON.stringify({...H.daily(),streak:1}),
      m=>m.dailyText=JSON.stringify({...H.daily(),opaque:'界'.repeat(2048)})];
    for(const mutateManifest of bad){const h=await fixture({mutateManifest}),a=h.owner(),before=h.adapter.snapshot(),raw=clone(h.manifest);eq((await a.owner.adopt(h.manifest)).state,'BLOCKED');eq(h.adapter.snapshot(),before);eq(h.manifest,raw);finish(a);}
  });
  await group('09 missing or changed evidence and malformed stored effects block without grants',async()=>{
    for(const phaseInput of [i=>delete i.binding.provenance.terminalIntent,i=>{i.sourceText=JSON.stringify({...JSON.parse(i.sourceText),seconds:8});}]){
      const h=await fixture({phaseInput}),a=await adopted(h),before=h.adapter.snapshot();eq((await a.owner.submitTerminal(h.phasePin)).state,'BLOCKED');eq(h.adapter.snapshot(),before);finish(a);
    }
    for(const missing of ['context','phase']){const h=await fixture(),a=await adopted(h);h.adapter.entries.delete(missing==='context'?h.manifest.contextPin.descriptor.run:h.phasePin.descriptor.run);const before=h.adapter.snapshot();
      eq((await a.owner.submitTerminal(h.phasePin)).state,'BLOCKED');eq(h.adapter.snapshot(),before);finish(a);}
    const h=await fixture(),a=await adopted(h);await a.owner.submitTerminal(h.phasePin);const different=await fixture({intent:H.timestamps(11000)}),before=h.adapter.snapshot();
    eq((await a.owner.submitTerminal(different.phasePin)).state,'BLOCKED');eq(h.adapter.snapshot(),before);finish(a);
    for(const mutate of [r=>r.stateAfter.points++,r=>r.receipt.delta++,r=>r.command.timestamps.lock++,r=>r.revision=2]){
      const h=await fixture(),a=await adopted(h);await a.owner.submitTerminal(h.phasePin);finish(a);await h.adapter.rewrite(run,1,mutate);const before=h.adapter.snapshot(),b=h.owner();
      eq((await b.owner.recover()).state,'BLOCKED');eq(h.adapter.snapshot(),before);finish(b);
    }
  });
  await group('10 committed commands remain readable after rollover; fresh admission is refused',async()=>{
    const h=await fixture();let day=DAY;const a=await adopted(h,{day:()=>day}),ticket=await a.owner.admitDaily();await a.owner.checkin(ticket);await a.owner.submitTerminal(h.phasePin);const before=h.adapter.snapshot();day='2026-10-13';
    ready(await a.owner.checkin(ticket),5103,2);ready(await a.owner.submitTerminal(h.phasePin),5103,2);eq(await a.owner.admitDaily(),null);eq(h.adapter.snapshot(),before);finish(a);
    const b=h.owner({transport:await h.adapter.fork(),day:()=>day});ready(await b.owner.recover(),5103,2);eq(h.adapter.snapshot(),before);finish(b);
    const fresh=await fixture(),c=await adopted(fresh,{day:()=>DAY}),old=await c.owner.admitDaily();finish(c);const d=fresh.owner({day:()=>day});await d.owner.recover();const unchanged=fresh.adapter.snapshot();
    eq((await d.owner.checkin(old)).state,'BLOCKED');eq(await d.owner.admitDaily(),null);eq(fresh.adapter.snapshot(),unchanged);finish(d);
  });
  await group('11 midnight unresolved outcome never invokes insertion-capable retry or rewrites intent',async()=>{
    for(const kind of ['daily','terminal'])for(const failure of ['unknown-commit','unknown-abort']){
      const h=await fixture();let day=DAY;const a=await adopted(h,{day:()=>day}),ticket=await a.owner.admitDaily();h.adapter.setMode(failure);eq((await(kind==='daily'?a.owner.checkin(ticket):a.owner.submitTerminal(h.phasePin))).state,'UNSAVED');
      const retained=h.adapter.retained(),before=h.adapter.snapshot();day='2026-10-13';const mark=h.adapter.events.length;const v=await a.owner.retry();eq(v.state,'BLOCKED');eq(h.adapter.retained(),retained);eq(h.adapter.snapshot(),before);
      ok(!h.adapter.events.slice(mark).some(e=>e.type==='retry'||e.type==='append'));assert.throws(()=>a.owner.dispose(),/busy/);checks++;
      const b=h.owner({transport:await h.adapter.fork(),day:()=>day}),r=await b.owner.recover();eq([r.state,points(r),r.revision],[failure==='unknown-commit'&&kind==='terminal'?'READY':'ACTIVE',failure==='unknown-commit'?(kind==='daily'?2103:5100):2100,failure==='unknown-commit'?1:0]);finish(b);
      // Explicit test teardown returns the fixture admission clock to its original
      // day. The retained exact lease is then resolved, never discarded/rekeyed.
      day=DAY;await a.owner.retry();finish(a);
    }
  });
  await group('12 long legal 911-action story stays lossless through both effects and recovery',async()=>{
    const story=F.plan(9),proof=Field.create(8,0,731);proof.trace=[];const act=(action,value)=>{proof.trace.push(['act',action,value??null]);Field.act(proof,action,value);};
    const layout=Field.layout(proof);for(let i=0;i<3;i++){act('station',i);act('angle',Math.round(layout.bearings[i]));act('sample');}act('pin',layout.source);act('locate');
    proof.trace=[...Array.from({length:900},()=>['act','station',0]),...proof.trace];ok(Field.restore(proof,8,0,proof.seed));eq(proof.trace.length,911);story.tasks[0]={proof};story.finaleEvidence={opaque:'界🌙\ud800'};
    const h=await fixture({storyText:JSON.stringify(story)}),a=await adopted(h),ticket=await a.owner.admitDaily();await a.owner.checkin(ticket);const v=await a.owner.submitTerminal(h.phasePin),text=v.projection.storyText;
    eq(JSON.parse(text).tasks[0].proof.trace,proof.trace);eq(JSON.parse(text).finaleEvidence,story.finaleEvidence);measurements.push({case:'long-911-actions',contextUtf16:h.storyText.length*2,resultUtf16:text.length*2,peak:a.budget.snapshot().peak});finish(a);
    const b=h.owner();eq((await b.owner.recover()).projection.storyText,text);finish(b);
  });
  await group('13 fixed-slot codec validates historical prefixes, padding, ordering and size',async()=>{
    const adapter=await archive(),budget=B.createPhaseBudget(),log=L.createSharedLog({adapter,scope:SCOPE,session:SESSION,principal:PRINCIPAL,budget,crypto:webcrypto});
    const record=n=>X.freezeFinaleData({revision:n,opaque:'界🌙\ud800'}),first=await log.append(record(0),null);eq(first.status,'committed');const pin0=await log.head();eq([pin0.head.ordinal,pin0.head.total,pin0.head.sealed],[0,16384,false]);
    let lease=await log.readRecord(pin0,0);eq(lease.record,record(0));lease.dispose();await log.append(record(1),pin0);const pin1=await log.head();await log.append(record(2),pin1);const pin2=await log.head();eq([pin2.head.ordinal,pin2.head.total,pin2.head.sealed],[2,49152,true]);
    lease=await log.readRecord(pin0,0);eq(lease.record,record(0));lease.dispose();const duplicate=await log.append(record(1),pin0);eq(duplicate.status,'duplicate');eq(duplicate.receipt.headToken,pin1.head.token);eq(duplicate.currentHead.token,pin2.head.token);
    await assert.rejects(log.append(record(3),pin2),/full/);checks++;const before=adapter.snapshot();await assert.rejects(log.append(X.freezeFinaleData({huge:'x'.repeat(9000)}),null),/limit/);checks++;eq(adapter.snapshot(),before);await assert.rejects(log.append(X.freezeFinaleData({escaped:'\0'.repeat(3000)}),null),/limit/);checks++;eq(adapter.snapshot(),before);clean(budget);
    const entry=adapter.entries.get(run),last=entry.segments.pop();await assert.rejects(log.readRecord(pin2,0),/missing/);checks++;entry.segments.push(last);
    last.payload[16383]=1;await assert.rejects(log.readRecord(pin2,0),/chain/);checks++;last.payload[16383]=0;clean(budget);
    const e=adapter.entries.get(run);e.segments[1].payload[16383]=1;const tampered=await adapter.rehash(run);await assert.rejects(log.readRecord(tampered,1),/padding/);checks++;clean(budget);
  });
  await group('14 resource observer exceptions clean owned reservations and bound representations',async()=>{
    const events=[];const h=await fixture(),a=await adopted(h,{observe:e=>events.push(e)}),ticket=await a.owner.admitDaily();await a.owner.checkin(ticket);await a.owner.submitTerminal(h.phasePin);finish(a);
    const retained=events.filter(e=>e.type==='event'&&e.label==='shared-retained-state');ok(retained.length>0);ok(retained.every(e=>e.detail.bytes<=32768));
    const encoded=events.filter(e=>e.type==='event'&&e.label==='shared-log-record-encoded');eq(encoded.length,3);ok(encoded.every(e=>e.detail.payload===16384&&e.detail.jsonUtf16<=16376));
    const reads=h.adapter.events.filter(e=>e.type==='read'&&e.run===run);ok(reads.every(e=>e.maxBytes===16384));
    for(const [type,label]of [['reserve','atomic-record-workspace'],['allocate','atomic-record-workspace'],['release','atomic-record-workspace'],['reserve','returned-page'],['allocate','returned-page'],['release','returned-page'],
      ['reserve','helper-hash'],['allocate','helper-hash'],['release','helper-hash'],['reserve','helper-framing'],['release','helper-framing'],['reserve','post-target'],['allocate','post-target'],['event','shared-retained-state']]){
      const f=await fixture();let armed=false,fired=false;const b=await adopted(f,{observe(e){if(armed&&!fired&&e.type===type&&e.label===label){fired=true;throw Error('probe-observer');}}});armed=true;
      const v=await b.owner.submitTerminal(f.phasePin);armed=false;ok(fired,type+':'+label);eq(v.state,'BLOCKED');finish(b);
    }
    measurements.push({case:'normal',peak:a.budget.snapshot().peak,maxRetained:Math.max(...retained.map(e=>e.detail.bytes)),dailyUtf16:h.manifest.dailyText.length*2});eq(oldCallbacks,0);
  });
  await group('15 append and retry guards cross digest and adapter boundaries; retained proposal stays original',async()=>{
    const adapter=await archive(),budget=B.createPhaseBudget(),log=L.createSharedLog({adapter,scope:SCOPE,session:SESSION,principal:PRINCIPAL,budget,crypto:webcrypto});
    const first=X.freezeFinaleData({revision:0,tag:'first'}),other=X.freezeFinaleData({revision:0,tag:'other'});let allowed=true;
    adapter.setMode('unknown-abort');const unknown=await log.append(first,null,()=>allowed);eq(unknown.status,'outcomeUnknown');const original=clone(unknown.proposalPin),retained=adapter.retained();
    const blocked=await log.append(other,null,()=>allowed);eq(blocked.reason,'retry-pending');eq(adapter.retained(),retained);
    adapter.beforeInsert(()=>{allowed=false;});const stale=await log.retry(()=>allowed);eq(stale.reason,'stale-context');eq(stale.proposalPin,original);eq(adapter.retained(),retained);eq(adapter.entries.size,0);
    allowed=true;const retry=await log.retry(()=>allowed);eq(retry.status,'committed');eq(retry.proposalPin,original);eq(rawRecord(adapter.entries.get(run).segments[0].payload,0),first);
    ok(adapter.events.filter(e=>e.type==='append'||e.type==='retry').every(e=>e.guard));clean(budget);
    let eligible=true,digests=0;const second=await archive(),b=B.createPhaseBudget(),crypto={subtle:{async digest(...args){digests++;eligible=false;return webcrypto.subtle.digest(...args);}}};
    const digestLog=L.createSharedLog({adapter:second,scope:SCOPE,session:SESSION,principal:PRINCIPAL,budget:b,crypto});
    eq((await digestLog.append(first,null,()=>eligible)).reason,'stale-context');ok(digests>0);eq(second.entries.size,0);eq(second.events.filter(e=>e.type==='append').length,0);clean(b);
  });
  await group('16 each original-day owner command survives a cutoff during hashing or final pretransaction guard',async()=>{
    for(const kind of ['daily','terminal'])for(const edge of ['digest','adapter']){
      const h=await fixture();let day=DAY,armed=false,encoded=false;const crypto={subtle:{async digest(...args){if(encoded){day='2026-10-13';encoded=false;}return webcrypto.subtle.digest(...args);}}};
      const a=await adopted(h,{day:()=>day,crypto,observe(e){if(armed&&edge==='digest'&&e.type==='event'&&e.label==='shared-log-record-encoded')encoded=true;}}),ticket=await a.owner.admitDaily();
      const before=h.adapter.snapshot();armed=true;if(edge==='adapter')h.adapter.beforeInsert(()=>{day='2026-10-13';});
      const v=await(kind==='daily'?a.owner.checkin(ticket):a.owner.submitTerminal(h.phasePin));eq([v.state,v.reason],['BLOCKED','stale-context']);eq(h.adapter.snapshot(),before);eq(effectCount(h),0);
      const mark=h.adapter.events.length;eq((await a.owner.retry()).reason,'shared-day-rollover');ok(!h.adapter.events.slice(mark).some(e=>e.type==='append'||e.type==='retry'));
      armed=false;day=DAY;const r=await a.owner.retry();eq([r.state,points(r),r.revision],[kind==='daily'?'ACTIVE':'READY',kind==='daily'?2103:5100,1]);
      if(kind==='terminal')eq(r.values.mkty_points_locked_at,String(h.intent.lock));finish(a);
    }
  });
  await group('17 effect readback failure publishes no success and recovers without another append',async()=>{
    for(const kind of ['daily','terminal']){
      const h=await fixture(),a=await adopted(h),ticket=await a.owner.admitDaily(),read=h.adapter.readSegments;let failed=false;
      h.adapter.readSegments=async q=>{if(!failed&&q.captureIdentity.run===run&&q.afterOrdinal===0){failed=true;return {status:'refused',reason:'transaction-aborted'};}return read(q);};
      eq((await(kind==='daily'?a.owner.checkin(ticket):a.owner.submitTerminal(h.phasePin))).state,'UNSAVED');ok(failed);eq(effectCount(h),1);
      const writes=h.adapter.events.filter(e=>e.type==='append').length,r=await a.owner.retry();eq([r.state,points(r),r.revision],[kind==='daily'?'ACTIVE':'READY',kind==='daily'?2103:5100,1]);
      eq(h.adapter.events.filter(e=>e.type==='append').length,writes);finish(a);
    }
  });
  await group('18 bounded first-day output and malformed catalog refuse before any additional effect',async()=>{
    const seed={...H.daily(),opaque:''},empty=JSON.stringify(seed),text=JSON.stringify({...seed,opaque:'x'.repeat(2048-empty.length)});eq(text.length*2,4096);
    const h=await fixture({mutateManifest:m=>m.dailyText=text}),a=await adopted(h),ticket=await a.owner.admitDaily(),before=h.adapter.snapshot();
    eq((await a.owner.checkin(ticket)).state,'BLOCKED');eq(h.adapter.snapshot(),before);eq(effectCount(h),0);finish(a);
    for(const mutate of [(p,i)=>i===0?{...p,nextCursor:null}:p,(p,i)=>i===1?{...p,watermark:3}:p,(p,i)=>i===0?{...p,heads:[]}:p,(p,i,first)=>i===1?{...p,heads:first.heads}:p]){
      const f=await fixture(),read=f.adapter.recover;let calls=0,first;f.adapter.recover=async q=>{const p=await read(q);first??=p;return mutate(p,calls++,first);};
      const b=f.owner(),raw=f.adapter.snapshot();eq((await b.owner.recover()).state,'BLOCKED');eq(f.adapter.snapshot(),raw);finish(b);
    }
  });
  await group('19 physically busy unresolved requests retain their lease until exact same-command resolution',async()=>{
    for(const kind of ['daily','terminal']){
      const h=await fixture(),a=await adopted(h),ticket=await a.owner.admitDaily();h.adapter.setMode('unknown-abort');await(kind==='daily'?a.owner.checkin(ticket):a.owner.submitTerminal(h.phasePin));
      const original=h.adapter.retained();h.adapter.setBusy(true);const mark=h.adapter.events.length;eq((await a.owner.retry()).reason,'busy');eq(h.adapter.retained(),original);eq(h.adapter.events.length,mark);
      h.adapter.setBusy(false);const r=await a.owner.retry();eq([points(r),r.revision],[kind==='daily'?2103:5100,1]);finish(a);
      const f=await fixture(),b=await adopted(f),other=await b.owner.admitDaily();f.adapter.setMode('abort');await(kind==='daily'?b.owner.checkin(other):b.owner.submitTerminal(f.phasePin));
      const v=await(kind==='daily'?b.owner.checkin(other):b.owner.submitTerminal(f.phasePin));eq([v.state,points(v),v.revision],[kind==='daily'?'ACTIVE':'READY',kind==='daily'?2103:5100,1]);finish(b);
    }
  });
  await group('20 maximum accepted daily envelope survives both orders and fresh recovery under the existing ceiling',async()=>{
    const base={cday:DAY,streak:0,attempts:0,solved:false,codes:[],padding:''},text=JSON.stringify({...base,padding:'x'.repeat(2024-JSON.stringify(base).length)});eq(text.length*2,4048);
    for(const dailyFirst of [true,false]){
      const events=[],h=await fixture({mutateManifest:m=>m.dailyText=text}),a=await adopted(h,{observe:e=>events.push(e)}),ticket=await a.owner.admitDaily();let v;
      if(dailyFirst){await a.owner.checkin(ticket);v=await a.owner.submitTerminal(h.phasePin);}else{await a.owner.submitTerminal(h.phasePin);v=await a.owner.checkin(ticket);}
      ready(v,dailyFirst?5103:5100,2);eq(v.values.mkty_daily_demo.length*2,4096);eq(JSON.parse(v.values.mkty_daily_demo).padding,JSON.parse(text).padding);
      const expected=clone(v.values);finish(a);const b=h.owner({transport:await h.adapter.fork(),observe:e=>events.push(e)}),r=await b.owner.recover();ready(r,dailyFirst?5103:5100,2);eq(r.values,expected);finish(b);
      const retained=events.filter(e=>e.type==='event'&&e.label==='shared-retained-state');ok(retained.every(e=>e.detail.bytes<=32768));
      const dailyEvents=events.filter(e=>e.type==='event'&&e.label==='shared-daily-workspace');ok(dailyEvents.some(e=>e.detail.stage==='admission'));
      const projected=dailyEvents.filter(e=>e.detail.stage==='projection');ok(projected.length>0);ok(projected.every(e=>e.detail.inputBytes===4048&&e.detail.normalizedBytes===4048&&e.detail.outputBytes===4096));
      ok(dailyEvents.every(e=>e.detail.copies===6&&e.detail.conservativeBytes===6*Math.max(e.detail.inputBytes,e.detail.normalizedBytes,e.detail.outputBytes)+4096&&
        e.detail.conservativeBytes<=65536&&e.reservations['atomic-record-workspace']===65536));
      measurements.push({case:'maximum-daily-'+(dailyFirst?'first':'last'),inputUtf16:text.length*2,normalizedUtf16:4048,outputUtf16:v.values.mkty_daily_demo.length*2,maxDailyWorkspace:Math.max(...dailyEvents.map(e=>e.detail.conservativeBytes)),
        peak:Math.max(a.budget.snapshot().peak,b.budget.snapshot().peak),maxRetained:Math.max(...retained.map(e=>e.detail.bytes))});
    }
  });
  await group('21 terminal retry and exact resubmission recover timestamps from the original phase after early read abort',async()=>{
    for(const route of ['retry','resubmit']){
      const h=await fixture(),a=await adopted(h),before=h.adapter.snapshot();h.adapter.setReadMode('refuse');
      const v=await a.owner.submitTerminal(h.phasePin);eq([v.state,v.reason],['UNSAVED','transaction-aborted']);eq(h.adapter.snapshot(),before);eq(effectCount(h),0);
      const r=await(route==='retry'?a.owner.retry():a.owner.submitTerminal(h.phasePin));ready(r,5100,1);const record=rawRecord(h.adapter.entries.get(run).segments[1].payload,1);
      eq(record.command.phasePin,h.phasePin);eq(record.command.timestamps,h.intent);eq(effectCount(h),1);eq(r.values.mkty_points_locked_at,String(h.intent.lock));finish(a);
    }
    const h=await fixture(),a=await adopted(h);await a.owner.submitTerminal(h.phasePin);finish(a);
    const b=h.owner(),before=h.adapter.snapshot();h.adapter.setReadMode('refuse');eq((await b.owner.submitTerminal(h.phasePin)).state,'UNSAVED');
    ready(await b.owner.recover(),5100,1);eq(h.adapter.snapshot(),before);eq(effectCount(h),1);finish(b);
  });
  await group('22 combined maximum daily, escaped scope and long story either admit fully or refuse before owner write',async()=>{
    const story=F.plan(9),proof=Field.create(8,0,731);proof.trace=[];const act=(action,value)=>{proof.trace.push(['act',action,value??null]);Field.act(proof,action,value);};
    const layout=Field.layout(proof);for(let i=0;i<3;i++){act('station',i);act('angle',Math.round(layout.bearings[i]));act('sample');}act('pin',layout.source);act('locate');
    proof.trace=[...Array.from({length:900},()=>['act','station',0]),...proof.trace];ok(Field.restore(proof,8,0,proof.seed));story.tasks[0]={proof};
    const base={cday:DAY,streak:0,attempts:0,solved:false,codes:[],padding:''},text=JSON.stringify({...base,padding:'x'.repeat(2024-JSON.stringify(base).length)});
    for(const dailyFirst of [true,false]){
      const events=[],h=await fixture({scope:'\0'.repeat(128),storyText:JSON.stringify(story),mutateManifest:m=>m.dailyText=text}),a=h.owner({observe:e=>events.push(e)}),before=h.adapter.snapshot();
      const adoption=await a.owner.adopt(h.manifest);if(adoption.state==='BLOCKED'){eq(h.adapter.snapshot(),before);eq(h.adapter.entries.has(run),false);measurements.push({case:'combined-maximum',outcome:'refused-before-owner-write',reason:adoption.reason,peak:a.budget.snapshot().peak});finish(a);continue;}
      eq(adoption.state,'ACTIVE');const ticket=await a.owner.admitDaily();let v;if(dailyFirst){await a.owner.checkin(ticket);v=await a.owner.submitTerminal(h.phasePin);}else{await a.owner.submitTerminal(h.phasePin);v=await a.owner.checkin(ticket);}
      ready(v,dailyFirst?5103:5100,2);eq(v.values.mkty_daily_demo.length*2,4096);eq(JSON.parse(v.projection.storyText).tasks[0].proof.trace,proof.trace);const expected=clone(v.values);finish(a);
      const b=h.owner({transport:await h.adapter.fork()});eq((await b.owner.recover()).values,expected);finish(b);
      const retained=events.filter(e=>e.type==='event'&&e.label==='shared-retained-state');measurements.push({case:'combined-maximum',outcome:'recovered',peak:a.budget.snapshot().peak,maxRetained:Math.max(...retained.map(e=>e.detail.bytes))});
    }
  });
  console.log(JSON.stringify({suite:'evidence-shared-owner',status:'passed',groups:groups.length,checks,groupNames:groups,measurements,
    qualification:'Portable synthetic Map/WebCrypto model; abort/quota are simulated, not native IndexedDB, real tabs, actual quota, earned campaign or runtime integration'}));
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{for(const [key,value]of Object.entries(saved)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}});
