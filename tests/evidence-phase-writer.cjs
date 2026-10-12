'use strict';
/* Source-only fixed-writer contract tests adapted from the accepted read-only VM probe. No browser, listener, backend or repository mutation.
   Full unchanged field controller, legacy, spatial callback, StoryPlan and storage
   source run with a synthetic DOM/clock. Small app/support function ranges are
   evaluated verbatim. This is not a native-input or manager implementation test. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const F=require(path.join(root,'tests/evidence-finale-controller-fixture.cjs'));
const src=file=>fs.readFileSync(path.join(root,file),'utf8');
const slice=(file,first,last)=>src(file).split('\n').slice(first-1,last).join('\n');
const clone=v=>JSON.parse(JSON.stringify(v));
const sig=r=>r.kind+':'+r.key;
function harness(phase,{staged=false,override={},fault=null}={}){
 const seed={...F.seed(phase),mkty_points:phase.chapter===9?'2100':'100',...override};for(let n=1;n<=9;n++)if(seed[F.storyKey(n)])seed[F.storyKey(n)]=JSON.stringify(F.plan(n));const disk=new Map(Object.entries(seed)),nodes=new Map(),logical=[],native=[],events=[];
 let observe=null,currentWriter=null,firstTask=null,mode='setup',clock=Date.parse('2026-10-12T12:00:00Z'),faultAt=fault,callback,raw,successor,opened=0,awardCalls=0,originalCalls=0;
 class El{
  constructor(id=''){this.id=id;this.dataset={};this.style={setProperty(){}};this.classes=new Set();this.attributes={};this.children=[];this.open=false;this.textContent='';this.classList={add:(...xs)=>xs.forEach(x=>this.classes.add(x)),remove:(...xs)=>xs.forEach(x=>this.classes.delete(x)),contains:x=>this.classes.has(x),toggle(){}};}
  set innerHTML(s){this.html=s;for(const m of s.matchAll(/id="([^"]+)"/g))get(m[1]);this.buttons=[...s.matchAll(/data-legacy-choice="([^"]+)"/g)].map(m=>{const b=new El();b.dataset.legacyChoice=m[1];return b;});}
  get innerHTML(){return this.html||'';}setAttribute(k,v){this.attributes[k]=v;}removeAttribute(k){delete this.attributes[k];}getAttribute(k){return this.attributes[k];}append(...xs){this.children.push(...xs);for(const x of xs)if(x.id)nodes.set(x.id,x);}before(){}replaceChildren(...xs){this.children=xs;}querySelector(s){if(s.startsWith('#'))return get(s.slice(1));return get(this.id+' '+s);}querySelectorAll(s){return s==='button'?(this.buttons||[]):[];}addEventListener(){}remove(){}getAnimations(){return [];}compareDocumentPosition(){return 0;}showModal(){this.open=true;}close(){this.open=false;}click(){if(!this.disabled)this.onclick?.();}matches(){return false;}
 }
 const get=id=>{if(!nodes.has(id))nodes.set(id,new El(id));return nodes.get(id);};
 const document={getElementById:get,createElement:()=>new El(),body:get('body'),documentElement:get('html'),hidden:false,addEventListener(){},querySelector:s=>s==='.screen.active'?[...nodes.values()].find(e=>e.classes.has('active')):s==='dialog[open]'?[...nodes.values()].find(e=>e.open):get('selector '+s),querySelectorAll:s=>s==='.screen'?[...nodes.values()]:[]};
 function io(kind,key,value){const row={mode,kind,key:String(key),value:kind==='set'?String(value):null,success:false};native.push(row);if(faultAt!==null&&mode===(typeof faultAt==='number'?'dispatch':faultAt.mode)&&native.filter(r=>r.mode===mode).length-1===(typeof faultAt==='number'?faultAt:faultAt.cut)){faultAt=null;throw Error('synthetic native cut');}if(kind==='set')disk.set(String(key),String(value));else disk.delete(String(key));row.success=true;}
 const storage={getItem:k=>{observe?.('native-get',{mode,key:String(k)});return disk.get(String(k))??null;},setItem:(k,v)=>io('set',k,v),removeItem:k=>io('remove',k),key:i=>[...disk.keys()][i]??null,get length(){return disk.size;}};
 class ClockDate extends Date{static now(){return clock++;}}
 const c={console,document,localStorage:storage,sessionStorage:{length:0},Date:ClockDate,structuredClone,URLSearchParams,Uint32Array,Math,Set,Map,JSON,Node:{DOCUMENT_POSITION_FOLLOWING:4},MutationObserver:class{observe(){}},CustomEvent:class{constructor(type,o){this.type=type;this.detail=o?.detail;}},queueMicrotask(){},setTimeout(){},clearTimeout(){},setInterval(){},clearInterval(){},requestAnimationFrame(){return 1;},cancelAnimationFrame(){},matchMedia:()=>({matches:true}),addEventListener(){},dispatchEvent(e){if(e.type==='mkty:storage')observe?.('listener',{mode,...e.detail});},scrollTo(){},crypto:{getRandomValues:a=>{a[0]=4567;return a;}},Telegram:{WebApp:{initData:''}},FieldArt:{scene:()=>'',map:()=>''},activeCinematic:null,leaveMission(){},clearMissionDelays(){},renderMissionArchive(){},renderCrewNetwork(){},renderDailyMissions(){},tg:null,remainingLife1CodeTime:()=>0,Blob,URL};c.window=c;c.globalThis=c;
 vm.createContext(c);
 const run=(code,name)=>vm.runInContext(code,c,{filename:name});
 for(const file of ['storage.js','field-model.js','story-plan.js'])run(src(file),file);
 for(const [method,kind]of [['setItem','set'],['removeItem','remove']]){const orig=c.MKTYStorage[method];c.MKTYStorage[method]=function(k,v){const row={mode,kind,key:String(k),value:kind==='set'?String(v):null};logical.push(row);const forward=()=>{observe?.('forward-enter',row);const result=orig.apply(this,arguments);observe?.('forward-return',row);return result;};const result=currentWriter?currentWriter.handleWrite({op:kind,key:row.key,value:row.value},forward):forward();observe?.('original-resume',row);return result;};}
 run("const $=id=>document.getElementById(id);",'vm bindings');
 run(slice('app.js',94,106),'app.js:94-106');
 run(slice('app.js',840,847),'app.js:840-847');
 run(slice('app.js',850,850),'app.js:850');
 run(slice('app.js',869,876),'app.js:869-876');
 run(slice('app.js',972,986),'app.js:972-986');
 run(slice('app.js',473,491),'app.js:473-491');
 const appAward=c.awardLifePoints;c.awardLifePoints=(...a)=>{awardCalls++;return appAward(...a);};
 run(`window.MKTYPace=(()=>{const ls=localStorage;${slice('pacing.js',33,33)}return {onRecorded,bypass:()=>true};})();`,'pacing.js:33');
 run(`window.MKTYRewards=(()=>{const initData=()=>'',accountContext=()=>({account:'telegram'});${slice('rewards-client.js',227,243)}return {completeLife,accountScope:()=> 'telegram'};})();`,'rewards-client.js:227-243 guest branch');
 run(`window.MKTYOps=(()=>{const cache=new Map(),key=n=>'mkty_operations_'+n+'_v1';function read(n){if(localStorage.getItem(key(n))!==null)throw Error('Excluded operations branch');return null;}const renderReplay=()=>{};${slice('operations.js',56,56)}return {complete,isRun:()=>false,pending:()=>false};})();`,'operations.js:56 absent-only');
 run(src('continuation.js'),'continuation.js');
 run(`window.MKTYCampaign=(()=>{const key=n=>'mkty_campaign_checkpoint_'+n,done=n=>localStorage.getItem('mkty_life'+n)==='complete';let current=0,restoring=false;const render=()=>{};${slice('campaign.js',10,21)}function review(n){MKTYContinuation.review(n);}function restore(n){if(!done(n))throw Error('Probe only calls completed campaign restore');review(n);}${slice('campaign.js',98,103)}return {save,restore,onScreen,render};})();`,'campaign selected source');
 run(src('field-missions.js'),'field-missions.js');run(src('legacy.js'),'legacy.js');run(src('chapter-space.js'),'chapter-space.js');
 for(const name of ['openMission','openMission2','openLife3MemoryGate','openMission4','openMission5','openMission6','openMission7'])c[name]=()=>{};
 run(src('story.js'),'story.js');
 const originalOpen=c.MKTYField.open;
 c.MKTYField.open=function(task,saved){
  if((mode==='dispatch'||mode==='entry-confirm')&&staged){assert(!successor);successor={task,saved};events.push('successor-staged');return;}
  opened++;firstTask??=task;
  const complete=task.complete;
  return originalOpen.call(this,{...task,complete(cp){callback=complete;raw=cp;c.show('vm-result');events.push('captured');}},saved);
 };
 get('home').classes.add('active');
 c.MKTYSpatialFinale.open(phase.chapter);get('fieldResume').click();get('fieldSubmit').click();assert(callback,'Original field finish reached its callback');
 const preDispatch=Object.fromEntries(disk);
 function invoke(stage,writer,fn){mode=stage;currentWriter=writer;writer.begin();try{fn();writer.finish();}finally{mode='idle';currentWriter=null;}}
 function dispatch(writer){invoke('dispatch',writer,()=>{originalCalls++;callback(raw);});}
 function activate(writer){assert(successor);const next=successor;successor=null;invoke('successor-open',writer,()=>c.MKTYField.open(next.task,next.saved));}
 function epilogue(writer){const b=get('legacyOptions').buttons.find(b=>b.dataset.legacyChoice==='done');assert(b);invoke('epilogue',writer,()=>b.click());}
 function retry(){mode='retry';const r=c.MKTYStorage.retry();mode='idle';return r;}
 function freshOpen(writer){invoke('initial-open',writer,()=>originalOpen.call(c.MKTYField,firstTask));}
 function entryNavigation(writer){
   run(`window.MKTYPace=(()=>{const ls=localStorage,bypass=()=>false,free=()=>false,lives=()=>9;
     const open=(kind,n,go)=>{window.pendingRisk=go;};${slice('pacing.js',91,96)}
     return {gate:()=>true,risky};})();`,'original-risk-closure');
   invoke('entry-navigation',writer,()=>c.MKTYStory.open(9));
 }
 function entryConfirm(writer){assert(c.pendingRisk);invoke('entry-confirm',writer,()=>c.pendingRisk());}
 return {c,get,phase,logical,native,preDispatch,dispatch,activate,epilogue,retry,freshOpen,entryNavigation,entryConfirm,observe:fn=>{observe=fn;},
   put:(k,v)=>v===null?disk.delete(k):disk.set(k,v),readNative:k=>disk.get(k)??null,
   persistent:()=>c.MKTYStorage.persistent,now:()=>ClockDate.now(),
   counts:()=>({opened,awardCalls,originalCalls}),snapshot:()=>c.MKTYStorage.snapshot()};
}
(async()=>{
 const {createPhaseWriterContract:create}=await import('../prototypes/evidence-indexeddb/phase-writer-contract.mjs');
 const {createPhaseBudget}=await import('../prototypes/evidence-indexeddb/phase-budget.mjs');
 const {admitContext}=await import('../prototypes/evidence-indexeddb/finale-context-v1.mjs');
 const SESSION='0123456789abcdef0123456789abcdef',groups=[],cuts={dispatch:0,open:0,epilogue:0,entry:0,initial:0};let checks=0,peak=0;
 const eq=(a,b)=>{assert.deepEqual(a,b);checks++;},ok=x=>{assert(x);checks++;},bad=(f,re=/phase-writer-|finale-context-/)=>{assert.throws(f,re);checks++;};
 const phases=F.phases.map(p=>{p=clone(p);p.provenance.precisionAtCapture={count:0,total:0};if(p.mechanic===11)p.state.mods.stability=15;return p;});
 function setup(p,options={}){const h=harness(p,{staged:true,...options}),budget=createPhaseBudget({observe:options.budgetObserve});budget.reserve('raw-capsule',65536);budget.reserve('context-retained',65536);
   const baseSeed=(p.seed-p.index*7919)>>>0,context=admitContext({scope:'fixture:phase-writer',session:SESSION,
     storyText:h.preDispatch[F.storyKey(p.chapter)],binding:{version:1,session:SESSION,chapter:p.chapter,edition:2,baseSeed,
       storyKey:F.storyKey(p.chapter),sourceKey:F.sourceKey(p.chapter),route:'spatial-finale'}},budget);
   let current=true;
   function writer(stage='dispatch',phase=p.index,extra={}){const snap=h.snapshot(),sourceText=snap[F.sourceKey(p.chapter)];
     return create({stage,chapter:p.chapter,phase,baseSeed,sourceText,checkpoint:sourceText?JSON.parse(sourceText).checkpoint:undefined,
       legacyText:snap.mkty_legacy_v1,precisionCount:0,context,budget,now:h.now,isCurrent:()=>current,preState:{mkty_lang:'en',mkty_global_lives:'9'},...extra});}
   function run(w,method){for(const label of ['callback-scratch','callback-outer-story','callback-inner-story'])budget.reserve(label,65536);
     try{h[method](w);}finally{for(const label of ['callback-scratch','callback-outer-story','callback-inner-story'])budget.release(label,65536);peak=Math.max(peak,budget.snapshot().peak);}}
   return {h,budget,context,writer,run,current:()=>current,stale(){current=false;}};
 }
 function drain(t,w){return w.drain(t.h.readNative,t.h.persistent);}
 for(const p of phases){const t=setup(p),w=t.writer();t.run(w,'dispatch');ok(drain(t,w).ok);eq(w.view().cursor,[3,11,1,1,11][phases.indexOf(p)]);
   ok(Object.isFrozen(w.view()));ok(Object.isFrozen(w.smallTargets()));eq(t.h.counts().originalCalls,1);
   if(p.index<(p.chapter===8?1:2)){w.release();const o=t.writer('open',p.index+1);t.run(o,'activate');ok(drain(t,o).ok);eq(o.view().cursor,3);
     const rows=t.h.logical.filter(r=>r.mode==='successor-open');eq(rows[1].value,rows[2].value);o.release();}
   else if(p.chapter===9){ok(w.withStoryTarget(s=>JSON.parse(s).phase)==='complete');w.release();const e=t.writer('epilogue');t.run(e,'epilogue');ok(drain(t,e).ok);eq(e.view().cursor,1);e.release();}
   else{ok(w.withStoryTarget(s=>JSON.parse(s).phase)==='complete');w.release();}
   eq(t.budget.snapshot().reservations['post-target'],0);
 }
 groups.push('all five source-derived dispatches, three staged opens and epilogue');
 for(const p of phases)for(let cut=0;cut<(p.index===(p.chapter===8?1:2)?11:p.chapter===8?3:1);cut++){
   const t=setup(p,{fault:cut}),w=t.writer();t.run(w,'dispatch');eq(drain(t,w),{ok:false,reason:'persistence'});
   const counts=t.h.counts();ok(t.h.retry());ok(drain(t,w).ok);eq(t.h.counts(),counts);w.release();cuts.dispatch++;
 }
 for(const p of [phases[0],phases[2],phases[3]])for(let cut=0;cut<3;cut++){
   const t=setup(p,{fault:{mode:'successor-open',cut}}),w=t.writer();t.run(w,'dispatch');ok(drain(t,w).ok);w.release();
   const o=t.writer('open',p.index+1);t.run(o,'activate');eq(drain(t,o),{ok:false,reason:'persistence'});
   if(cut===2)eq(t.h.readNative(F.sourceKey(p.chapter)),t.h.snapshot()[F.sourceKey(p.chapter)]);
   const counts=t.h.counts();ok(t.h.retry());ok(drain(t,o).ok);eq(t.h.counts(),counts);o.release();cuts.open++;
 }
 {const t=setup(phases[4],{fault:{mode:'epilogue',cut:0}}),w=t.writer();t.run(w,'dispatch');ok(drain(t,w).ok);w.release();
   const e=t.writer('epilogue');t.run(e,'epilogue');eq(t.h.readNative('mkty_current_chapter'),'9');eq(drain(t,e),{ok:false,reason:'persistence'});
   const counts=t.h.counts();ok(t.h.retry());ok(drain(t,e).ok);eq(t.h.counts(),counts);e.release();cuts.epilogue++;}
 groups.push('27 dispatch, 9 successor and 1 epilogue native cuts, equality failures and exact retry');
 for(let cut=-1;cut<3;cut++){
   const t=setup(phases[0],{fault:cut<0?null:{mode:'initial-open',cut}}),key=F.sourceKey(8),s=JSON.parse(t.h.snapshot()[key]);delete s.checkpoint;t.h.put(key,JSON.stringify(s));
   const w=t.writer('open',0);t.run(w,'freshOpen');if(cut>=0){eq(drain(t,w),{ok:false,reason:'persistence'});ok(t.h.retry());cuts.initial++;}ok(drain(t,w).ok);w.release();
 }
 for(const fault of [null,{mode:'entry-navigation',cut:0},{mode:'entry-confirm',cut:0},{mode:'entry-confirm',cut:1}]){
   const t=setup(phases[2],{fault}),key=F.sourceKey(9),s=JSON.parse(t.h.snapshot()[key]);delete s.checkpoint;t.h.put(key,JSON.stringify(s));t.h.put('mkty_life8','complete');
   const n=t.writer('entry-navigation',0);t.run(n,'entryNavigation');if(fault?.mode==='entry-navigation'){eq(drain(t,n),{ok:false,reason:'persistence'});ok(t.h.retry());cuts.entry++;}ok(drain(t,n).ok);n.release();
   const e=t.writer('entry-confirm',0);t.run(e,'entryConfirm');if(fault?.mode==='entry-confirm'){eq(drain(t,e),{ok:false,reason:'persistence'});ok(t.h.retry());cuts.entry++;}ok(drain(t,e).ok);eq(e.view().cursor,2);e.release();
   const o=t.writer('open',0);t.run(o,'activate');ok(drain(t,o).ok);o.release();
 }
 groups.push('initial paused open and real story/risk closure entry with separate drains');
 for(const op of [{op:'clear'},{op:'retry'},{op:'remove',key:'absent'},{op:'set',key:'mkty_points',value:'100'},
   {op:'set',key:'mkty_legacy_v1',value:'x'.repeat(4097)}]){
   const t=setup(phases[0]),w=t.writer();w.begin();let forwarded=0;bad(()=>w.handleWrite(op,()=>forwarded++));eq(forwarded,0);eq(w.view().state,'blocked');bad(()=>w.finish());w.release();
 }
 {const t=setup(phases[0]),w=t.writer();w.begin();bad(()=>w.finish());eq(w.view().blocked,'incomplete');w.release();}
 {const t=setup(phases[0]),w=t.writer();t.stale();bad(()=>w.begin());w.release();}
 {const t=setup(phases[0]),w=t.writer();bad(()=>w.drain(t.h.readNative,t.h.persistent));w.release();}
 {const t=setup(phases[0]);for(const precisionCount of [65,.5,-1])bad(()=>t.writer('dispatch',0,{precisionCount}));bad(()=>t.writer('dispatch',0,{preState:{[F.storyKey(8)]:'{}'}}));
   bad(()=>t.writer('open',0));bad(()=>t.writer('entry-confirm',0));}

 {const t=setup(phases[0]);let w;w=t.writer('dispatch',0,{isCurrent(){try{w.begin();}catch{}return true;}});
   bad(()=>w.begin());eq(w.view().blocked,'reentrant');eq(w.view().state,'blocked');w.release();}
 groups.push('fixed stages, raw caps, unsupported parameters, stale lease and unobserved-invocation denial');
 {const t=setup(phases[0]),w=t.writer();t.run(w,'dispatch');eq(w.drain(()=>{throw Error('native unavailable');},()=>true),{ok:false,reason:'native-read'});ok(drain(t,w).ok);
   bad(()=>w.drain(k=>k==='mkty_lang'?'ru':t.h.readNative(k),()=>true));eq(w.view().blocked,'native-mismatch');bad(()=>drain(t,w));w.release();}
 {const t=setup(phases[0]),w=t.writer();w.begin();const s=clone(phases[0].provenance.legacyAtCapture);s.echo='answer';
   let forwarded=0;bad(()=>w.handleWrite({op:'set',key:'mkty_legacy_v1',value:JSON.stringify(s)},()=>{
     try{w.handleWrite({op:'clear'},()=>forwarded++);}catch{}forwarded++;}));eq(forwarded,1);eq(w.view().blocked,'reentrant');eq(w.view().cursor,0);w.release();}

 {const t=setup(phases[1]),w=t.writer(),remove=t.h.c.MKTYStorage.removeItem;
   // Test-only native pre-removal: method observation must count an absent remove.
   t.h.c.MKTYStorage.removeItem=function(key){t.h.put(String(key),null);return remove.apply(this,arguments);};
   t.run(w,'dispatch');ok(drain(t,w).ok);eq(t.h.logical.filter(r=>r.mode==='dispatch'&&r.kind==='remove').length,1);w.release();}
 {const t=setup(phases[1]),w=t.writer();t.run(w,'dispatch');ok(drain(t,w).ok);
   eq(w.drain(t.h.readNative,()=>false),{ok:false,reason:'persistence'});eq(w.view().drained,false);
   bad(()=>w.smallTargets());bad(()=>w.withStoryTarget(()=>null));w.release();}
 {const t=setup(phases[0]),w=t.writer();const initial=w.view().metadataBytes;ok(initial>0&&initial<32768);
   t.run(w,'dispatch');eq(w.view().metadataBytes,initial);ok(drain(t,w).ok);w.release();eq(w.view().metadataBytes,0);}
 groups.push('native read retry, irreversible mismatch and caught reentrant writes');
 {const t=setup(phases[1]),w=t.writer();for(const label of ['callback-scratch','callback-outer-story','callback-inner-story'])t.budget.reserve(label,65536);
   w.begin();const forged=JSON.stringify({...F.plan(8),createdAt:t.h.now(),coreSeconds:123}),key=F.storyKey(8);let forwarded=0;
   bad(()=>w.handleWrite({op:'set',key,value:forged},()=>{forwarded++;t.h.put(key,forged);}),/story-rewrite-mismatch/);
   eq(forwarded,1);eq(t.h.readNative(key),forged);eq(w.view().provisional,true);eq(w.view().cursor,0);eq(w.view().storyBytes,forged.length*2);
   bad(()=>w.handleWrite({op:'set',key:'mkty_life9_coordinates',value:'31.188,97.469'},()=>forwarded++));eq(forwarded,1);
   for(const label of ['callback-scratch','callback-outer-story','callback-inner-story'])t.budget.release(label,65536);w.release();eq(t.budget.snapshot().reservations['post-target'],0);}
 groups.push('post-write story failure admits already-written bytes, latches block and prevents all later writes');
 {const t=setup(phases[1]),w=t.writer();t.run(w,'dispatch');ok(drain(t,w).ok);let resolve;
   const held=w.withStoryTarget(text=>new Promise(r=>{resolve=()=>r(text.length);}));bad(()=>w.release());resolve();await assert.rejects(held,/phase-writer-reentrant/);checks++;w.release();eq(w.view().storyBytes,0);}


 const precisionVectors=[];
 for(const precisionCount of [0,1,9,10,64])for(const variant of ['crew-events','cargo-events','cargo-no-events']){
   const p=phases[4],t=setup(p);let left=precisionCount;
   for(let n=1;n<=8;n++){const precise=Math.min(8,left);left-=precise;t.h.put(F.storyKey(n),JSON.stringify(F.plan(n,precise)));}
   const legacy=clone(p.provenance.legacyAtCapture);if(variant!=='crew-events')legacy.airlock='cargo';
   if(variant==='cargo-no-events')legacy.events={};t.h.put('mkty_legacy_v1',JSON.stringify(legacy));
   eq(clone(t.h.c.MKTYLegacy.precise()),{count:precisionCount,total:precisionCount});
   const originalMods=clone(t.h.c.MKTYLegacy.mods(9,11));
   const expectedMods=clone(t.h.c.FieldRules.create(11,4,p.seed,originalMods).mods);
   const source=JSON.parse(t.h.snapshot()[F.sourceKey(9)]);delete source.checkpoint;t.h.put(F.sourceKey(9),JSON.stringify(source));
   const open=t.writer('open',2,{precisionCount});t.run(open,'freshOpen');ok(drain(t,open).ok);
   eq(JSON.parse(t.h.snapshot()[F.sourceKey(9)]).checkpoint.mods,expectedMods);eq(clone(t.h.c.MKTYField.snapshot().mods),expectedMods);open.release();
   const complete=clone(p.state);complete.mods=expectedMods;source.checkpoint=complete;t.h.put(F.sourceKey(9),JSON.stringify(source));
   const dispatch=t.writer('dispatch',2,{precisionCount});eq(dispatch.view().expectedOperations,11);dispatch.release();
   if(precisionCount<10&&expectedMods.stability<40){bad(()=>t.writer('dispatch',2,{precisionCount:precisionCount+1}),/phase-writer-checkpoint/);}
   precisionVectors.push({count:precisionCount,variant,mods:expectedMods});
 }
 groups.push('precision counts 0,1,9,10,64 preserve exact original legacy modifiers, gate opens and accepted gate checkpoints');
 // This extraction executes the current manager lease verbatim. It grants no
 // owner/handler authority and exists only in this synthetic test process.
 const manager=src('prototypes/evidence-indexeddb/unsaved-result-gate.mjs');
 const leaseSource=manager.slice(manager.indexOf('  function originalReadLease(){'),manager.indexOf('  function execute(',manager.indexOf('  function originalReadLease(){')));
 ok(leaseSource.startsWith('  function originalReadLease(){'));ok(leaseSource.includes("'original-read-workspace',196608"));
 const createReadLease=new Function('budget','C','current',`${leaseSource};return originalReadLease();`);
 const projectionLabels=['post-work-1','post-work-2','post-stringify'],originalLabels=['callback-scratch','callback-outer-story','callback-inner-story'];
 function exchanged(t,stage,phase,{exchangeEvent}={}){
   const lease=createReadLease(t.budget,{fail(message){throw Error(message);}},t.current);let exchanges=0;
   const writer=t.writer(stage,phase,{projectAfterRead(callback){exchanges++;exchangeEvent?.('enter',exchanges);
     try{return lease.project(()=>{exchangeEvent?.('projection',exchanges);return callback();});}
     finally{exchangeEvent?.('leave',exchanges);}}});
   function run(method){let primary;
     for(const label of originalLabels)t.budget.reserve(label,65536);
     try{lease.acquire();t.h[method](writer);}catch(error){primary=error;}
     finally{try{lease.release();}catch(error){primary??=error;}
       for(const label of originalLabels){const held=t.budget.snapshot().reservations[label];if(held)t.budget.release(label,held);}peak=Math.max(peak,t.budget.snapshot().peak);}
     if(primary)throw primary;
   }
   return {writer,run,exchanges:()=>exchanges};
 }
 for(const p of [phases[1],phases[4]]){
   let active=false,w,projecting=false,projectionCount=0;const timeline=[];
   const t=setup(p,{budgetObserve(e){if(!active)return;
     if(projectionLabels.includes(e.label)&&['reserve','allocate'].includes(e.type)){
       eq(e.reservations['original-read-workspace'],0);ok(projecting);timeline.push(e.label+':'+e.type);}
     if(e.label==='original-read-workspace'&&e.type==='reserve'){
       for(const key of projectionLabels)eq(e.reservations[key],0);timeline.push('read:reserve');}
     if(e.label==='original-read-workspace'&&e.type==='release')timeline.push('read:release');
   }});
   const x=exchanged(t,'dispatch',p.index,{exchangeEvent(kind){timeline.push('project:'+kind);if(kind==='enter')projecting=true;
     if(kind==='projection'){projectionCount++;eq(t.budget.snapshot().reservations['original-read-workspace'],0);ok(w.view().provisional);}
     if(kind==='leave')projecting=false;}});w=x.writer;active=true;
   t.h.observe((point,row)=>{if(row.mode!=='dispatch')return;
     const held=t.budget.snapshot().reservations;eq(held['original-read-workspace'],196608);
     for(const key of projectionLabels)eq(held[key],0);ok(!projecting);timeline.push(point+':'+row.key);
     if(point==='listener'&&row.key===F.storyKey(p.chapter)){
       const originalRead=t.h.c.MKTYStory.read(p.chapter);ok(originalRead&&originalRead.n===p.chapter);
       eq(t.budget.snapshot().reservations['original-read-workspace'],196608);
     }
   });
   x.run('dispatch');active=false;t.h.observe(null);eq(x.exchanges(),2);eq(projectionCount,2);eq(w.view().cursor,11);ok(drain(t,w).ok);
   const returns=timeline.map((v,i)=>v==='forward-return:'+F.storyKey(p.chapter)?i:-1).filter(i=>i>=0);
   for(const at of returns){const enter=timeline.indexOf('project:enter',at),release=timeline.indexOf('read:release',enter),projection=timeline.indexOf('project:projection',release),
     acquire=timeline.indexOf('read:reserve',projection),leave=timeline.indexOf('project:leave',acquire),resume=timeline.indexOf('original-resume:'+F.storyKey(p.chapter),leave);
     ok(at<enter&&enter<release&&release<projection&&projection<acquire&&acquire<leave&&leave<resume);}
   eq(t.budget.snapshot().ceiling,1016832);eq(t.budget.snapshot().peak,1015808);eq(t.budget.snapshot().reservations['original-read-workspace'],0);w.release();
 }
 // The genuine entry story write uses the same exchange; ack must stay before it.
 {let active=false;const t=setup(phases[2]),key=F.sourceKey(9),s=JSON.parse(t.h.snapshot()[key]);delete s.checkpoint;t.h.put(key,JSON.stringify(s));t.h.put('mkty_life8','complete');
   const n=t.writer('entry-navigation',0);t.run(n,'entryNavigation');ok(drain(t,n).ok);n.release();const x=exchanged(t,'entry-confirm',0);
   t.h.observe((point,row)=>{if(!active||row.mode!=='entry-confirm')return;eq(t.budget.snapshot().reservations['original-read-workspace'],196608);
     for(const label of projectionLabels)eq(t.budget.snapshot().reservations[label],0);});
   active=true;x.run('entryConfirm');active=false;t.h.observe(null);eq(x.exchanges(),1);eq(x.writer.view().cursor,2);ok(drain(t,x.writer).ok);
   eq(t.h.logical.filter(r=>r.mode==='entry-confirm').map(r=>r.key),['mkty_pace_ack_9',F.storyKey(9)]);x.writer.release();}
 groups.push('original read workspace covers real forward and listeners, exchanges only after return, and reacquires before original resumes');
 const exchangeFaults=[];
 for(const exchangeAt of [1,2])for(const type of ['release','reserve','allocate'])for(const faultKind of ['invalidate','throw']){
   let active=false,inExchange=false,ordinal=0,fired=false,t;
   t=setup(phases[1],{budgetObserve(e){if(active&&inExchange&&ordinal===exchangeAt&&!fired&&e.type===type&&e.label==='original-read-workspace'){
     fired=true;if(faultKind==='invalidate')t.stale();else throw Error('injected-read-exchange');}}});
   const x=exchanged(t,'dispatch',1,{exchangeEvent(kind,n){if(kind==='enter'){ordinal=n;inExchange=true;}if(kind==='leave')inExchange=false;}});
   active=true;bad(()=>x.run('dispatch'),/phase-writer-|stale-context|injected-read-exchange/);active=false;ok(fired);
   eq(x.writer.view().state,'blocked');eq(x.writer.view().provisional,true);eq(x.writer.view().cursor,exchangeAt===1?0:5);
   eq(t.h.native.filter(r=>r.mode==='dispatch').length,exchangeAt===1?1:6);eq(t.h.readNative('mkty_points'),'100');
   if(exchangeAt===2)ok(t.h.logical.some(r=>r.mode==='dispatch'&&r.key==='mkty_points'),'Original Story.write catches the rejected second rewrite; later award invocation still cannot forward');
   let later=0;bad(()=>x.writer.handleWrite({op:'set',key:'mkty_points',value:'2100'},()=>later++));eq(later,0);
   for(const label of [...projectionLabels,...originalLabels,'original-read-workspace'])eq(t.budget.snapshot().reservations[label],0);
   ok(t.budget.snapshot().peak<=1016832);x.writer.release();exchangeFaults.push({exchange:exchangeAt,type,faultKind});
 }
 groups.push('read-workspace release, reserve and allocate invalidation/throws latch block on both story writes, including caught failure');
 for(const label of projectionLabels){
   const account=createPhaseBudget();eq(account.snapshot().ceiling,1016832);account.reserve('original-read-workspace',196608);
   bad(()=>account.reserve(label,65536),/budget-lifetime/);eq(account.snapshot().reservations[label],0);account.release('original-read-workspace',196608);
   account.reserve(label,65536);bad(()=>account.reserve('original-read-workspace',196608),/budget-lifetime/);
   eq(account.snapshot().reservations['original-read-workspace'],0);account.release(label,65536);
 }
 {const t=setup(phases[1]),w=t.writer();for(const label of originalLabels)t.budget.reserve(label,65536);t.budget.reserve('original-read-workspace',196608);
   eq(t.budget.snapshot().live,1015808);bad(()=>t.budget.reserve('context-parse',65536),/transient-budget/);eq(t.budget.snapshot().reservations['context-parse'],0);
   t.budget.release('original-read-workspace',196608);for(const label of originalLabels)t.budget.release(label,65536);w.release();}
 groups.push('read/projection overlap rejected in both directions and unchanged 1016832-byte ceiling enforced');
 ok(peak<=1016832);eq(cuts,{dispatch:27,open:9,epilogue:1,entry:3,initial:3});
 console.log(JSON.stringify({status:'passed',checks,groups,cuts,precisionVectors,exchangeFaults,modeledPeak:peak,qualification:'Source-only deterministic VM, actual unchanged original handlers; synthetic clock/DOM/native Map and completed fixture inputs. No native gameplay, timings, archive or runtime integration claim.'},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
