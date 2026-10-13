/* Source-only owner integration. No browser, network, database or live records. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),P=require('../story-plan.js'),OldP=require('./fixtures/story-plan-before-finale-evidence.js'),R=require('../field-model.js'),C=require('../trace-codec.js');
const makeA=require('./fixtures/finale-envelope-21-group-baseline.cjs'),A=makeA({field:R,codec:C}),makeOwner=require('../finale-evidence-owner.js'),O=makeOwner({codec:C,storyPlan:P,envelopes:A});
const input=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/finale-checkpoints-17-state.json'),'utf8')),copy=v=>JSON.parse(C.stringify(v)),checks=[],measurements=[];
const test=(n,fn)=>{fn();checks.push(n);},context={route:'opaque-synthetic-context',challenge:{id:'not-an-authoritative-binding'}};
const storyKey=n=>'mkty_story_plan_'+n+'_v1',activeKey=n=>'mkty_field_finale_'+n+'_v1';
const plan=n=>({...P.fresh(n,9000+n,2),createdAt:1,phase:'core',done:[0,1,2,3,4,5,6,7]});
const source=(c,p)=>({chapter:c.chapter,baseSeed:c.baseSeed,phase:p.index,context:copy(context),checkpoint:copy(p.state),provenance:copy(p.provenance)});
function snapshot(c,p,extra={}){return {[storyKey(c.chapter)]:JSON.stringify(plan(c.chapter)),[activeKey(c.chapter)]:C.stringify({version:1,n:c.chapter,phase:p.index,seed:c.baseSeed,seconds:0,checkpoint:p.state}),...extra};}
function storage(snapshot,{failWrite=false,failReadAfterWrite=false,persistent=true}={}){const map=new Map(Object.entries(snapshot)),writes=[];let written=false;return {map,writes,persistent,getItem(k){if(written&&failReadAfterWrite)throw Error('synthetic-read-failure');return map.get(k)??null;},setItem(k,v){writes.push(k);if(failWrite)throw Error('synthetic-quota');map.set(k,String(v));written=true;},removeItem(k){map.delete(k);},key:i=>[...map.keys()][i],get length(){return map.size;}};}
function storyVM(data,model=P){
 const store=storage(data),nodes=new Map();let active='home',rnd=777;
 class Element{constructor(id=''){this.id=id;this.dataset={};this.attributes={};this.children=[];this.classes=new Set();this.style={setProperty(){}};this.classList={contains:x=>this.classes.has(x),add:x=>this.classes.add(x),remove:x=>this.classes.delete(x),toggle(){}};}set innerHTML(v){this.html=v;for(const m of v.matchAll(/id="([^"]+)"/g))get(m[1]);this.mapNodes=[...v.matchAll(/data-map-step="(\d+)"/g)].map(m=>{const e=new Element();e.dataset.mapStep=m[1];return e;});}get innerHTML(){return this.html||'';}setAttribute(k,v){this.attributes[k]=v;}compareDocumentPosition(){return 0;}before(){}append(...v){this.children.push(...v);}replaceChildren(...v){this.children=v;}querySelectorAll(){return this.mapNodes||[];}click(){if(!this.disabled)this.onclick?.();}dispatchEvent(e){if(e.type==='click')this.onclick?.();}}
 const get=id=>{if(!nodes.has(id))nodes.set(id,new Element(id));return nodes.get(id);};
 for(const id of ['app','expeditionEntry','enterBtn',...Array.from({length:9},(_,i)=>'life'+(i+1)+'Complete')])get(id);
 const document={documentElement:get('html'),getElementById:get,createElement:()=>new Element(),querySelector:s=>s==='.screen.active'?get(active):null,hidden:false};
 const c={console,document,MutationObserver:class{observe(){}},localStorage:store,StoryPlan:model,Node:{DOCUMENT_POSITION_FOLLOWING:4},FieldArt:{map:(_n,steps)=>steps.map(t=>'<g data-map-step="'+t.id+'"></g>').join('')},crypto:{getRandomValues:a=>{a[0]=rnd++;return a;}},setInterval(){},setTimeout(){},queueMicrotask(){},addEventListener(){},MKTYCampaign:{render(){}},MKTYStorage:{identity:()=> 'synthetic-owner',persistent:true},show:id=>{get(active).classes.delete('active');active=id;get(id).classes.add('active');},MKTYOps:{pending:()=>false},URL,Blob};c.window=c;
 for(const [i,name]of ['openMission','openMission2','openLife3MemoryGate','openMission4','openMission5','openMission6','openMission7','openMission8','openMission9'].entries())c[name]=()=>c.show('mission'+(i+1));
 vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(root,'story.js'),'utf8'),c,{filename:'story.js'});return {c,store,get};
}
function captureAll(c){let snap=snapshot(c,c.phases[0]);for(const p of c.phases){snap[activeKey(c.chapter)]=snapshot(c,p)[activeKey(c.chapter)];const src=source(c,p),prepared=O.prepareCapture({snapshot:snap,source:src});assert(prepared.ok,prepared.error);const store=storage(snap),ack=O.persist(prepared,{storage:store,isPersistent:()=>true,source:src});assert(ack.ok,ack.error);assert(ack.mayRetireCapturedCheckpoint);snap=Object.fromEntries(store.map);}return snap;}
for(const c of input.campaigns)test('actual story completion, reload and archive: '+c.chapter+'/'+c.baseSeed,()=>{
 const snap=captureAll(c),before=JSON.parse(snap[storyKey(c.chapter)]).finaleEvidence,h=storyVM(snap);assert.equal(O.inspect(h.c.MKTYStory.read(c.chapter)).kind,'known');
 h.c.MKTYStory.complete(c.chapter);const raw=h.store.getItem(storyKey(c.chapter)),completed=JSON.parse(raw);assert.equal(completed.phase,'complete');assert.deepEqual(completed.finaleEvidence,before);assert.equal(O.inspect(completed).summary.evidenceComplete,true);
 const reload=storyVM(Object.fromEntries(h.store.map));assert.deepEqual(copy(reload.c.MKTYStory.read(c.chapter).finaleEvidence),before);reload.c.MKTYStory.replay(c.chapter);
 const pointer=reload.store.getItem('mkty_story_archive_latest_'+c.chapter);assert(pointer);const archived=JSON.parse(reload.store.getItem(pointer));assert.equal(archived.snapshot[storyKey(c.chapter)],raw);assert.equal(archived.snapshot[activeKey(c.chapter)],snap[activeKey(c.chapter)]);assert.equal(P.restore(JSON.parse(reload.store.getItem(storyKey(c.chapter)))).finaleEvidence,undefined);
});
test('all original earned checkpoints survive wrapped owner JSON writes exactly',()=>{
 assert.equal(input.phases.length,17);for(const p of input.phases){const c={chapter:p.chapter,baseSeed:(p.seed-p.index*7919)>>>0};const s=snapshot(c,p),r=O.prepareCapture({snapshot:s,source:source(c,p)});assert(r.ok,r.error);const ordinary=JSON.parse(JSON.stringify(P.restore(JSON.parse(r.write.value)))),read=O.inspect(ordinary);assert.equal(read.kind,'known');assert.deepEqual(read.envelope.completed.at(-1).checkpoint,p.state);if(p.index>0)assert(!read.summary.evidenceComplete);}
});
test('known packed wrapper preserves negative zero, while raw unknown data has only structural retention',()=>{
 const c=input.campaigns[0],p=c.phases[0],s=snapshot(c,p);let e=A.captureCompleted(A.begin({chapter:8,baseSeed:c.baseSeed,context}).candidate,{index:0,checkpoint:p.state,provenance:p.provenance}).candidate;
 e=copy(e);e.context.numericExample=-0;e.completed[0].provenance.numericExample=-0;const wrapper=O.encode(e),h=storyVM({...s,[storyKey(8)]:JSON.stringify({...plan(8),finaleEvidence:wrapper})});h.c.MKTYStory.complete(8);const read=O.inspect(JSON.parse(h.store.getItem(storyKey(8))));assert(Object.is(read.envelope.context.numericExample,-0));assert(Object.is(read.envelope.completed[0].provenance.numericExample,-0));assert.equal(JSON.parse(h.store.getItem(storyKey(8))).finaleEvidence.payload,wrapper.payload);
 const unknown={version:99,raw:-0,recovery:['future']},restored=P.restore({...plan(8),finaleEvidence:unknown});assert.strictEqual(restored.finaleEvidence,unknown);const ordinary=JSON.parse(JSON.stringify(restored));assert.equal(O.inspect(ordinary).kind,'opaque');assert(!Object.is(ordinary.finaleEvidence.raw,-0),'ordinary JSON normalizes unknown raw negative zero; do not claim byte preservation');
});
test('missing, unknown versions/types and unreadable known payload never invalidate gameplay plans',()=>{
 assert(!Object.hasOwn(P.restore(plan(8)),'finaleEvidence'));assert(!Object.hasOwn(P.restore(plan(9)),'finaleEvidence'));
 for(const n of [8,9])for(const evidence of [null,false,17,'future-wire-string',['future'],{version:7,payload:'opaque'}, {format:O.FORMAT,version:1,encoding:O.ENCODING,payload:'unreadable'}, {format:O.FORMAT,version:1,encoding:O.ENCODING,payload:'{}',futureField:true}]){
  const p={...plan(n),finaleEvidence:evidence},restored=P.restore(p);assert(restored);assert.deepEqual(restored.finaleEvidence,evidence);const h=storyVM({[storyKey(n)]:JSON.stringify(p)});h.c.MKTYStory.complete(n);assert.equal(h.c.MKTYStory.read(n).phase,'complete');assert.deepEqual(JSON.parse(h.store.getItem(storyKey(n))).finaleEvidence,evidence);
 }
 for(const n of [1,7])assert.equal(P.restore({...plan(n),finaleEvidence:{version:99}}).finaleEvidence,undefined,'ownership scope remains chapters 8/9');
});
test('unknown or damaged evidence is not overwritten by a new capture',()=>{
 const c=input.campaigns[0],p=c.phases[0];for(const evidence of [{version:99,data:'recover-me'},{format:O.FORMAT,version:1,encoding:O.ENCODING,payload:'unreadable'}]){const s=snapshot(c,p);s[storyKey(8)]=JSON.stringify({...plan(8),finaleEvidence:evidence});const bytes={...s},r=O.prepareCapture({snapshot:s,source:source(c,p)});assert(!r.ok);assert.match(r.error,/evidence_(opaque|unreadable)/);assert(r.recordingOnly);assert.deepEqual(s,bytes);assert(P.restore(JSON.parse(s[storyKey(8)])));}
});
test('mixed old/new clients: transport preserves opaque wrapper, old story writer actually drops it',()=>{
 const c=input.campaigns[0],s=captureAll(c),expected=JSON.parse(s[storyKey(8)]).finaleEvidence;
 const transport=C.unpackSnapshot(C.packSnapshot(s));assert.deepEqual(JSON.parse(transport[storyKey(8)]).finaleEvidence,expected);
 const old=storyVM(transport,OldP);old.c.MKTYStory.complete(8);assert.equal(Object.hasOwn(JSON.parse(old.store.getItem(storyKey(8))),'finaleEvidence'),false);const next=storyVM(Object.fromEntries(old.store.map));assert.equal(O.inspect(next.c.MKTYStory.read(8)).kind,'absent');assert.equal(next.c.MKTYStory.read(8).phase,'complete','no invented evidence or forced gameplay replay');
});
test('capture interruption, exact persisted recovery, and source retirement are separate',()=>{
 const c=input.campaigns[0],p=c.phases[0],src=source(c,p),s=snapshot(c,p),prepared=O.prepareCapture({snapshot:s,source:src});assert(prepared.ok);
 assert.deepEqual(s,snapshot(c,p),'preparation alone does not write or retire');const disk=storage(s),ack=O.persist(prepared,{storage:disk,isPersistent:()=>true,source:src});assert(ack.ok);assert.equal(disk.getItem(activeKey(8)),s[activeKey(8)]);
 const freshOwner=makeOwner({codec:C,storyPlan:P,envelopes:makeA({field:R,codec:C})}),recovery=freshOwner.prepareCapture({snapshot:Object.fromEntries(disk.map),source:copy(src)});assert.equal(recovery.change,'duplicate');assert.equal(recovery.write.value,disk.getItem(storyKey(8)));const priorWrites=disk.writes.length,recovered=freshOwner.acknowledge(recovery,{storage:disk,persistent:true,source:copy(src)});assert(recovered.ok);assert(recovered.retirementRecovery);assert(recovered.mayRetireCapturedCheckpoint);assert.equal(disk.writes.length,priorWrites,'recovery need not rewrite acknowledged bytes');
 // A synthetic caller now consumes the exact acknowledgement. The helper never deletes.
 disk.removeItem(activeKey(8));assert.equal(disk.getItem(activeKey(8)),null);assert.equal(O.inspect(JSON.parse(disk.getItem(storyKey(8)))).envelope.completed.length,1);
});
test('quota, memory-only writes and interrupted read-back retain source checkpoint without a gameplay gate',()=>{
 const c=input.campaigns[0],p=c.phases[0],src=source(c,p),s=snapshot(c,p,{'mkty_points':'12250','mkty_pending_v2_101':'unchanged'}),prepared=O.prepareCapture({snapshot:s,source:src});assert(prepared.ok);
 for(const cfg of [{failWrite:true},{persistent:false},{failReadAfterWrite:true}]){const store=storage(s,cfg),r=O.persist(prepared,{storage:store,isPersistent:()=>store.persistent,source:src});assert(!r.ok);assert(r.recordingOnly);assert(!r.mayRetireCapturedCheckpoint);assert.deepEqual(r.retainedSnapshot,s);assert.equal(store.map.get(activeKey(8)),s[activeKey(8)]);assert.equal(store.map.get('mkty_points'),'12250');assert.equal(store.map.get('mkty_pending_v2_101'),'unchanged');assert(P.restore(JSON.parse(store.map.get(storyKey(8)))));if(cfg.failWrite)assert.equal(store.map.get(storyKey(8)),s[storyKey(8)]);}
});
test('stale source or story write refuses recording without overwriting newer evidence',()=>{
 const c=input.campaigns[0],p=c.phases[0],src=source(c,p),s=snapshot(c,p),prepared=O.prepareCapture({snapshot:s,source:src});for(const key of [storyKey(8),activeKey(8)]){const store=storage(s);store.map.set(key,'newer-data');const r=O.persist(prepared,{storage:store,isPersistent:()=>true,source:src});assert(!r.ok);assert.equal(r.error,'source_changed');assert.equal(store.writes.length,0);assert.equal(store.map.get(key),'newer-data');}
 const store=storage(s);O.persist(prepared,{storage:store,isPersistent:()=>true,source:src});store.map.set(activeKey(8),'new-phase');const r=O.acknowledge(prepared,{storage:store,persistent:true,source:src});assert(!r.ok);assert(!r.mayRetireCapturedCheckpoint);
});
function heavy(count){const c=input.campaigns.find(c=>c.chapter===9),p=c.phases[1],trace=[...Array.from({length:count},(_,i)=>['tick',1,i%2?1:-1,0]),...copy(p.state.trace)],s=R.create(6,4,p.seed,p.state.mods);for(const row of trace)if(row[0]==='act')R.act(s,row[1],row[2]);else for(let i=0;i<row[1];i++)R.tick(s,1/60,{x:row[2],y:row[3]});assert(s.complete&&R.won(s));s.trace=trace;assert(R.restore(s,6,4,p.seed));return {c,p:{...p,state:s}};}
test('trace-heavy wrapper pre-packs losslessly within whole-entry and full-snapshot limits',()=>{
 const {c,p}=heavy(16000),s=snapshot(c,p),src=source(c,p),r=O.prepareCapture({snapshot:s,source:src});assert(r.ok,r.error);assert(r.sizes.rawEntryBytes<C.LIMITS.snapshotEntryBytes);assert(r.sizes.packedSnapshotBytes<=C.LIMITS.snapshotBytes);const roundtrip=C.unpackSnapshot(JSON.parse(JSON.stringify(r.transportSnapshot))),stored=JSON.parse(roundtrip[storyKey(9)]),decoded=O.inspect(stored);assert.equal(decoded.kind,'known');assert.deepEqual(decoded.envelope.completed[0].checkpoint,p.state);
 const naive={...stored,finaleEvidence:{...stored.finaleEvidence,payload:C.stringify({finale:r.candidate})}},naiveBytes=C.utf8Bytes(JSON.stringify(naive));assert(naiveBytes>C.LIMITS.snapshotEntryBytes);assert.throws(()=>C.packSnapshot({...s,[storyKey(9)]:JSON.stringify(naive)}),/snapshot_too_large/);
 const legacyRaw=O.prepareCapture({snapshot:s,source:src,mode:'raw'});assert(!legacyRaw.ok);assert.equal(legacyRaw.error,'snapshot_too_large');assert.deepEqual(s,snapshot(c,p));measurements.push({case:'16000-prefix-ticks',...r.sizes,stringifyOnlyEntryBytes:naiveBytes,rows:p.state.trace.length,ticks:p.state.trace.filter(t=>t[0]==='tick').reduce((n,t)=>n+t[1],0),rawLegacyRefusesWithoutDrop:true});
});
function multiChapterPreparation(){
 const golden=require('./fixtures/chapter1-proof.json'),one={...P.fresh(1,golden.route.seed,2),createdAt:1,phase:'complete',done:golden.proof.tasks.map(t=>t.id),tasks:Object.fromEntries(golden.proof.tasks.map(t=>[t.id,{attempt:t.attempt,kind:P.plan(1,2).steps[t.id].kind,proof:t.state}]))},out={[storyKey(1)]:C.stringify(one)};
 const helpers=require('./field-rules.cjs');
 for(let n=2;n<=8;n++){
  const story=P.fresh(n,1000+n,2),task=P.plan(n,2).steps.find(t=>t.kind==='field');assert.equal(task.id,0);story.createdAt=1;
  const state=R.create(n,task.fieldStage,P.seedFor(story,task.id,0));state.trace=[];
  const act=(a,v)=>{state.trace.push(['act',a,v??null]);R.act(state,a,v);};
  if(n===2)for(const job of helpers.crewOrder(state)){act('select',job);act('role',R.layout(state).jobs[job].role);act('assign');}
  if(n===3)while(!state.complete){const t=R.layout(state).target;for(const a of ['angle','power','trim'])act(a,t[a]);act('burn');}
  if(n===4){const b=R.layout(state);for(const site of b.requiredSites===2?[b.safe,b.backup]:[b.safe]){act('select',site);act('scan');act('sample');act('land');}}
  if(n===5)while(!state.complete){const b=R.layout(state);act('diagnose');act('isolate',b.fault);b.target.forEach((v,i)=>act('valve',[i,v]));act('stabilize');}
  if(n===6){state.trace.push(['tick',120,1,0]);for(let i=0;i<120;i++)R.tick(state,1/60,{x:1,y:0});act('brake');}
  if(n===7){const b=R.layout(state);for(const target of [...b.targets,b.exit]){let limit=0;while(state.pos!==target&&limit++<150){const next=helpers.route(state,target)[0];let waits=0;while(R.watched({...state,turn:state.turn+1},next)&&waits++<4)act('wait');act('move',next);}assert(limit<150);}}
  if(n===8){const b=R.layout(state);for(let i=0;i<3;i++){act('station',i);act('angle',Math.round(b.bearings[i]));act('sample');}act('pin',b.source);act('locate');}
  assert(R.restore(state,n,task.fieldStage,state.seed));if(n!==6)assert(state.complete&&R.won(state));
  const replay=R.create(n,task.fieldStage,state.seed);for(const row of state.trace)if(row[0]==='act')R.act(replay,row[1],row[2]);else for(let i=0;i<row[1];i++)R.tick(replay,1/60,{x:row[2],y:row[3]});const replayExpected=copy(state);delete replayExpected.trace;assert.deepEqual(replay,replayExpected);
  story.tasks[0]={kind:'field',attempt:0,[state.complete?'proof':'checkpoint']:state};if(state.complete)story.done=[0];assert(P.restore(story));out[storyKey(n)]=C.stringify(story);
 }
 return out;
}
test('honest composite nine-chapter preparation plus long finale measures aggregate budget',()=>{
 const prep=multiChapterPreparation(),{c,p}=heavy(16000),base=snapshot(c,p),s={...prep,...base},before={...s},r=O.prepareCapture({snapshot:s,source:source(c,p)});assert(r.ok,r.error);assert.equal(Object.keys(r.snapshot).filter(k=>/^mkty_story_plan_/.test(k)).length,9);
 const decoded=C.unpackSnapshot(r.transportSnapshot);for(const [key,value]of Object.entries(prep))assert.deepEqual(JSON.parse(decoded[key]),JSON.parse(value));assert.deepEqual(s,before);
 measurements.push({case:'composite-nine-chapter-preparation-and-16000-prefix-ticks',preparatoryCoverage:'existing full chapter1 eight-task fixture plus one ordinary field trace for each chapter2–8; chapter6 is an active checkpoint; chapter9 finale prerequisites remain synthetic',allNineLongSessionsCovered:false,...r.sizes,entryBytes:Object.fromEntries(Object.entries(r.transportSnapshot).map(([k,v])=>[k,C.utf8Bytes(v)]))});
 const higher=heavy(18000),bare=snapshot(higher.c,higher.p),alone=O.prepareCapture({snapshot:bare,source:source(higher.c,higher.p)});assert(alone.ok,alone.error);const combined={...prep,...bare},refused=O.prepareCapture({snapshot:combined,source:source(higher.c,higher.p)});assert(!refused.ok);assert.equal(refused.error,'snapshot_too_large');assert.deepEqual(combined,{...prep,...bare});measurements.push({case:'composite-nine-chapter-preparation-and-18000-prefix-ticks',barePackedSnapshotBytes:alone.sizes.packedSnapshotBytes,refused:refused.error,allNineLongSessionsCovered:false});
});
test('larger trace-heavy capture refuses rather than expanding limits or dropping prior records',()=>{
 const {c,p}=heavy(19500),s=snapshot(c,p),before={...s},r=O.prepareCapture({snapshot:s,source:source(c,p)});assert(!r.ok);assert.match(r.error,/too_large/);assert.deepEqual(s,before);assert(r.retainedSource.checkpoint.complete);assert(r.recordingOnly);measurements.push({case:'19500-prefix-ticks',refused:r.error,rows:p.state.trace.length,sourceEntryBytes:C.utf8Bytes(s[activeKey(9)])});
});
(async()=>{
 const ServerP=(await import('../server/rewards/models/story-plan.mjs')).default;
 test('mechanically generated story-plan mirror has identical recovery retention',()=>{for(const n of [8,9])for(const evidence of [{version:99,payload:'opaque'},null,JSON.parse(captureAll(input.campaigns.find(c=>c.chapter===n))[storyKey(n)]).finaleEvidence]){const p={...plan(n),finaleEvidence:evidence};const a=ServerP.restore(p),b=P.restore(p);delete a.createdAt;delete b.createdAt;assert.deepEqual(a,b);}});
 const report={scope:'isolated source-only owner integration; no index/controller/reward/API/SQL activation',passed:checks.length,checks,measurements,limits:C.LIMITS,knownPayloadLossless:true,fixtureTimingQualification:{fullModelStateMatches:5,controllerTimedActionOnlyCheckpoints:12,controllerSeconds:3,rawActionReplaySeconds:0,authoritativeTimingProof:false},allNineLongSessionsCovered:false,unknownDataGuarantee:'structural recovery retention; ordinary JSON may normalize numeric representation',oldStoryWriterPreservesEvidence:false,oldWriterRolloutDependency:'any old StoryPlan rewrite can drop the added field; mixed-writer evidence durability is not guaranteed',sourceOnlyServerMirror:'server/rewards/models/story-plan.mjs',productionCheckpointRetirement:false};
 console.log(JSON.stringify(report,null,2));
 if(process.env.MKTY_FINALE_OWNER_REPORT)fs.writeFileSync(process.env.MKTY_FINALE_OWNER_REPORT,JSON.stringify(report,null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1;});
