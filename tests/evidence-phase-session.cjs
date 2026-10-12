'use strict';
// Deterministic SOURCE-ONLY lifecycle evidence. Original controller/open/completion,
// guest-award, story, risk-button and storage functions run in an isolated VM.
// Won checkpoints are synthetic fixtures passed to original task closures, not
// earned gameplay. Native-like storage is a Map, archive transport is a double.
// Fresh module instances below model independent page realms, never an app reset.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {pathToFileURL}=require('node:url'),{webcrypto,createHash}=require('node:crypto');
const F=require('./evidence-finale-controller-fixture.cjs'),Pace=require('../pacing.js'),Field=require('../field-model.js'),Story=require('../story-plan.js');
const root=path.resolve(__dirname,'..'),url=f=>pathToFileURL(path.join(root,'prototypes/evidence-indexeddb',f)).href;
const source=f=>fs.readFileSync(path.join(root,f),'utf8'),slice=(f,a,b)=>source(f).split('\n').slice(a-1,b).join('\n');
const clone=x=>JSON.parse(JSON.stringify(x)),deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const SESSION='1234567890abcdef1234567890abcdef',SCOPE='fixture:phase-session';
// Already-prepared operations prerequisites are synthetic fixtures, never earned here.
const operationKey=n=>'mkty_operations_'+n+'_v1',operationRecord=(n,phase='core')=>({version:1,n,seed:731,round:3,phase,input:null,confirmed:false,actions:0,hints:0,errors:0,seconds:0});
const operationText=(n,phase='core')=>JSON.stringify(operationRecord(n,phase));
let serial=0,checks=0;const groups=[],failures=[],measurements=[];
const eq=(a,b,n)=>{assert.deepStrictEqual(a,b,n);checks++;},ok=(v,n)=>{assert(v,n);checks++;};
const preState=()=>({mkty_points:'100',mkty_global_lives:'9',mkty_life8:null,mkty_life9:null,mkty_life8_awarded:null,mkty_life9_awarded:null,
  mkty_life8_completed_at:null,mkty_life9_completed_at:null,mkty_spatial_report_8:null,mkty_spatial_report_9:null,
  mkty_final_moon_points:null,mkty_points_locked_at:null,mkty_pace_ack_8:null,mkty_pace_ack_9:null,mkty_life9_coordinates:null,
  [operationKey(8)]:operationText(8),[operationKey(9)]:operationText(9)});
function realLongContext(){
  const full=F.plan(8);for(const task of Story.plan(8,2).steps)full.tasks[task.id]={kind:task.kind,attempt:0,seconds:3,hints:0,errors:0};
  const proof=Field.create(8,0,Story.seedFor(full,0));proof.trace=[];
  const act=(action,value)=>{proof.trace.push(['act',action,value??null]);Field.act(proof,action,value);};
  const layout=Field.layout(proof);for(let i=0;i<3;i++){act('station',i);act('angle',Math.round(layout.bearings[i]));act('sample');}act('pin',layout.source);act('locate');
  full.tasks[0]={...full.tasks[0],proof,performance:Field.performance(proof)};proof.trace=[...Array.from({length:900},()=>['act','station',0]),...proof.trace];
  const replay=Field.create(8,0,proof.seed);for(const row of proof.trace)Field.act(replay,row[1],row[2]);assert(replay.complete&&Field.won(replay));assert(Field.restore(proof,8,0,proof.seed));
  const text=JSON.stringify(full);eq(proof.trace.length,911);eq(text.length*2,38628);eq(full.tasks[0].performance.precise,true);return text;
}
function originalVM(options={}){
  const seed={...F.seed(F.phases[0],{earned:true}),mkty_life7:'complete',[operationKey(8)]:operationText(8),[operationKey(9)]:operationText(9),[F.storyKey(9)]:JSON.stringify(F.plan(9)),[F.sourceKey(9)]:JSON.stringify({version:1,n:9,phase:0,seed:731,seconds:0})};
  // This slice pins zero precision; do not import the older sixteen-precision plans.
  for(let n=1;n<=9;n++)seed[F.storyKey(n)]=JSON.stringify(F.plan(n));
  seed.mkty_daily_demo=JSON.stringify({attempts:0,streak:0,solved:false,codes:[],cday:'2026-10-12'});if(options.skip!==null)seed.mkty_pace_skip_9='yes';
  if(options.operations==='absent')for(const n of [8,9])delete seed[operationKey(n)];
  if(options.story8)seed[F.storyKey(8)]=options.story8;if(options.story9)seed[F.storyKey(9)]=options.story9;
  const disk=new Map(Object.entries(seed)),nodes=new Map(),logical=[],native=[],rejections=[],handles=[],riskHandles=[];
  let session=null,mode='setup',clock=Date.parse('2026-10-12T12:00:00Z'),fault=null,awardCalls=0,callbackCalls=0,openCalls=0,lastCapture=null,lastDone=null;
  function listen(type,fn,options={}){this.listeners??=new Map();const rows=this.listeners.get(type)||[];rows.push({fn,capture:options===true||!!options.capture});this.listeners.set(type,rows);}
  function dispatch(event){const route=[];for(let n=this;n;n=n===c?null:n===document?c:n.parentElement||document)route.push(n);event.target=this;event.bubbles??=true;event.cancelable??=true;event.defaultPrevented=false;event.stopped=false;event.immediate=false;event.preventDefault=()=>{if(event.cancelable)event.defaultPrevented=true;};event.stopPropagation=()=>{event.stopped=true;};event.stopImmediatePropagation=()=>{event.immediate=true;event.stopped=true;};event.composedPath=()=>route.slice();const invoke=(node,capture)=>{for(const row of node.listeners?.get(event.type)||[]){if(row.capture===capture)row.fn.call(node,event);if(event.immediate)break;}if(!capture&&!event.immediate&&node['on'+event.type])event.result=node['on'+event.type](event);};for(const node of route.slice().reverse()){invoke(node,true);if(event.stopped)return !event.defaultPrevented;}for(const node of route){invoke(node,false);if(event.stopped||!event.bubbles)break;}return !event.defaultPrevented;}
  const fire=(target,type,init={})=>{const event={type,...init};dispatch.call(target,event);return event;};
  let animationFrame=null;
  const hooks={descriptor:null,complete:null,readNative:null,readItem:null,leave:null,risk:null,original:null};
  class El{
    constructor(id=''){Object.assign(this,{id,dataset:{},style:{setProperty(){}},classes:new Set(),attributes:{},children:[],open:false,textContent:''});this.classList={add:(...v)=>v.forEach(x=>this.classes.add(x)),remove:(...v)=>v.forEach(x=>this.classes.delete(x)),contains:x=>this.classes.has(x),toggle(){}};}
    set innerHTML(s){this.html=s;for(const m of s.matchAll(/id="([^"]+)"/g)){const child=get(m[1]);if(child!==this)child.parentElement=this;}this.buttons=[...s.matchAll(/data-legacy-choice="([^"]+)"/g)].map(m=>{const b=new El();b.parentElement=this;b.dataset.legacyChoice=m[1];return b;});}
    get innerHTML(){return this.html||'';}setAttribute(k,v){this.attributes[k]=v;}removeAttribute(k){delete this.attributes[k];}getAttribute(k){return this.attributes[k];}
    append(...v){this.children.push(...v);for(const e of v){e.parentElement=this;if(e.id)nodes.set(e.id,e);}}before(){}replaceChildren(...v){this.children=v;}querySelector(s){return get(s.startsWith('#')?s.slice(1):this.id+' '+s);}querySelectorAll(s){return s==='button'?(this.buttons||[]):[];}
    addEventListener(...args){listen.apply(this,args);}dispatchEvent(event){return dispatch.call(this,event);}contains(node){for(let n=node;n;n=n.parentElement)if(n===this)return true;return false;}remove(){}getAnimations(){return [];}compareDocumentPosition(){return 0;}showModal(){this.open=true;}close(){this.open=false;}click(){if(!this.disabled)return fire(this,'click').result;}matches(selector){return selector.split(',').some(s=>s[0]==='#'?this.id===s.slice(1):s==='[data-field-action]'?this.dataset.fieldAction!==undefined:s==='[data-field-slider]'?this.dataset.fieldSlider!==undefined:s==='[data-field-steer]'?this.dataset.fieldSteer!==undefined:false);}closest(selector){for(let n=this;n;n=n.parentElement)if(n.matches?.(selector))return n;return null;}focus(){}
  }
  const get=id=>{if(!nodes.has(id))nodes.set(id,new El(id));return nodes.get(id);};
  const document={getElementById:get,createElement:()=>new El(),body:get('body'),documentElement:get('html'),hidden:false,addEventListener:listen,dispatchEvent:dispatch,querySelector:s=>s==='.screen.active'?[...nodes.values()].find(e=>e.classes.has('active')):s==='dialog[open]'?[...nodes.values()].find(e=>e.open):get('selector '+s),querySelectorAll:s=>s==='.screen'?[...nodes.values()]:[]};
  function io(op,key,value){const row={mode,op,key:String(key),value:op==='set'?String(value):null};native.push(row);if(fault&&fault.mode===mode&&native.filter(x=>x.mode===mode).length-1===fault.cut){fault=null;throw Error('synthetic write cut');}if(op==='set')disk.set(row.key,row.value);else disk.delete(row.key);}
  const nativeStorage={getItem:k=>disk.get(String(k))??null,setItem:(k,v)=>io('set',k,v),removeItem:k=>io('remove',k),key:i=>[...disk.keys()][i]??null,get length(){return disk.size;}};
  class ClockDate extends Date{static now(){return clock++;}}
  const c={console,document,localStorage:nativeStorage,sessionStorage:{length:0},Date:ClockDate,structuredClone,URLSearchParams,Uint32Array,Math,Set,Map,JSON,Node:{DOCUMENT_POSITION_FOLLOWING:4},MutationObserver:class{observe(){}},CustomEvent:class{constructor(type,o){this.type=type;this.detail=o?.detail;}},queueMicrotask(){},setTimeout(){},clearTimeout(){},setInterval(){},clearInterval(){},requestAnimationFrame(fn){animationFrame=fn;return 1;},cancelAnimationFrame(){animationFrame=null;},matchMedia:()=>({matches:true}),addEventListener:listen,dispatchEvent:dispatch,scrollTo(){},crypto:{getRandomValues:a=>{a[0]=731;return a;}},Telegram:{WebApp:{initData:''}},FieldArt:{scene:()=>'',map:()=>''},activeCinematic:null,leaveMission(){},clearMissionDelays(){},renderMissionArchive(){},renderCrewNetwork(){},renderDailyMissions(){},tg:null,remainingLife1CodeTime:()=>0,Blob,URL};c.window=c;c.globalThis=c;document.defaultView=c;
  vm.createContext(c);const run=(s,n)=>vm.runInContext(s,c,{filename:n});
  for(const f of ['storage.js','field-model.js','story-plan.js'])run(source(f),f);
  for(const [method,op] of [['setItem','set'],['removeItem','remove'],['clear','clear'],['retry','retry']]){const original=c.MKTYStorage[method];c.MKTYStorage[method]=function(key,value){const operation={op,...(key===undefined?{}:{key:String(key)}),...(op==='set'?{value:String(value)}:{})};const forward=()=>{logical.push({mode,...operation});return original.apply(this,arguments);};try{return session?session.write(operation,forward):forward();}catch(error){rejections.push({mode,operation:clone(operation),reason:error.message});if(process.env.MKTY_PHASE_SESSION_DEBUG)console.error('WRITE_REJECTION',mode,operation,error.message);throw error;}};}
  run('const $=id=>document.getElementById(id);','vm bindings');
  for(const [a,b]of [[94,106],[369,385],[840,847],[850,850],[869,876],[972,986],[473,491]])run(slice('app.js',a,b),'app.js:'+a+'-'+b);
  const award=c.awardLifePoints;c.awardLifePoints=(...a)=>{awardCalls++;return award(...a);};
  c.PaceRules=Pace;
  run(`window.MKTYPace=(()=>{const root=window,Rules=PaceRules;${slice('pacing.js',22,33)}${slice('pacing.js',37,74)}${slice('pacing.js',84,96)}return {onRecorded,bypass,gate,risky};})();`,'original pacing risk and button');
  run(`window.MKTYRewards=(()=>{const initData=()=>'',accountContext=()=>({account:'telegram'});${slice('rewards-client.js',227,243)}return {completeLife,accountScope:()=> 'guest'};})();`,'original guest rewards branch');
  run(source('continuation.js'),'continuation.js');
  run(`window.MKTYCampaign=(()=>{const key=n=>'mkty_campaign_checkpoint_'+n,done=n=>localStorage.getItem('mkty_life'+n)==='complete';let current=0,restoring=false;const render=()=>{};${slice('campaign.js',10,21)}function review(n){MKTYContinuation.review(n);}function restore(n){if(!done(n))throw Error('Only completed campaign restore allowed');review(n);}${slice('campaign.js',98,103)}return {save,restore,onScreen,render};})();`,'original campaign selected functions');
  for(const f of ['field-missions.js','legacy.js','chapter-space.js'])run(source(f),f);
  for(const n of ['openMission','openMission2','openLife3MemoryGate','openMission4','openMission5','openMission6','openMission7'])c[n]=()=>{};
  // Match index.html: chapter-space captures app entries, operations wraps them, story captures operations.
  for(const f of ['mission-rules.js','operations-art.js','operations.js','story.js'])run(source(f),f);
  const fieldOpen=c.MKTYField.open;c.MKTYField.open=(task,saved)=>{const original=task.complete,save=task.save;task={...task,save(cp){hooks.original?.('save');return save(cp);},complete(cp){callbackCalls++;hooks.original?.('complete');return hooks.complete?hooks.complete(()=>original(cp),task,cp):original(cp);}};if(hooks.descriptor)task=hooks.descriptor(task);return session.stageTask(task,saved);};
  const epilogue=c.MKTYLegacy.epilogue;c.MKTYLegacy.epilogue=done=>{const finish=session.stageEpilogue(()=>{hooks.original?.('epilogue');return done();});return epilogue(()=>{lastDone=finish();return lastDone;});};
  const risky=c.MKTYPace.risky,paceGo=get('paceGo').onclick,paceCancel=get('paceCancel').onclick;
  c.MKTYPace.risky=(...args)=>{const result=risky(...args);if(get('paceDialog').open){let specification={chapter:9,confirm:()=>{hooks.original?.('confirm');return paceGo();},cancel:paceCancel};if(hooks.risk)specification=hooks.risk(specification);if(specification){const handle=session.stageRisk(specification);riskHandles.push(handle);get('paceGo').onclick=handle.confirm;get('paceCancel').onclick=handle.cancel;}}return result;};
  get('home').classes.add('active');
  const under=(name,fn)=>{const old=mode;mode=name;let result;try{result=fn();}catch(error){mode=old;throw error;}if(result&&typeof result.then==='function')return Promise.resolve(result).finally(()=>{mode=old;});mode=old;return result;};
  return {c,get,document,fire,tick:time=>animationFrame?.(time),disk,logical,native,rejections,handles,riskHandles,hooks,background:()=>Object.fromEntries(['mkty_lang','mkty_control_sound','mkty_light_fx','mkty_expeditions_v1','mkty_daily_demo','mkty_pace_skip_9'].map(k=>[k,seed[k]??null])),now:()=>ClockDate.now(),connect(s){session=s;},
    readItem:k=>hooks.readItem?hooks.readItem(k):c.MKTYStorage.readItem(k),readNative:k=>hooks.readNative?hooks.readNative(k):disk.get(k)??null,
    persistent:()=>c.MKTYStorage.persistent,retry:()=>under('retry',()=>c.MKTYStorage.retry()),
    leave(){hooks.leave?.();c.show('vm-result');},open(task,saved){handles.push(task);openCalls++;hooks.original?.('open');return fieldOpen(task,saved);},
    stageInitial:()=>session.initialEntry(()=>{hooks.original?.('initial');return options.initialSpatial?c.MKTYSpatialFinale.open(8):c.MKTYOps.open(8);}),current:()=>handles.at(-1),
    capture(i){const p=F.phases[i];let cp=clone(p.state);if(i===4){const rebuilt=c.FieldRules.create(p.mechanic,4,p.seed,c.MKTYLegacy.mods(9,11));for(const row of p.state.trace){assert.equal(row[0],'act');c.FieldRules.act(rebuilt,row[1],row[2]);}rebuilt.trace=clone(p.state.trace);rebuilt.seconds=p.state.seconds;assert(rebuilt.complete&&c.FieldRules.won(rebuilt));assert(c.FieldRules.restore(rebuilt,p.mechanic,4,p.seed));cp=clone(rebuilt);assert.equal(cp.mods.stability,15+Math.min(20,c.MKTYLegacy.precise().count*2));}under('save-'+i,()=>handles.at(-1).save(cp));lastCapture=under('capture-'+i,()=>handles.at(-1).complete(cp));return {promise:lastCapture,cp};},
    entry(){return under('entry-navigation',()=>session.entryNavigation(()=>{hooks.original?.('entry');return c.openMission9();}));},
    confirm(){return under('entry-confirm',()=>get('paceGo').click());},
    done(){return under('epilogue',()=>{get('legacyOptions').buttons.find(b=>b.dataset.legacyChoice==='done').click();return lastDone;});},
    cut(mode,cut){fault={mode,cut};},under,counts:()=>({awardCalls,callbackCalls,openCalls}),snapshot:()=>clone(c.MKTYStorage.snapshot())};
}
(async()=>{
  globalThis.crypto??=webcrypto;
  const C=await import(url('contract.mjs')),B=await import(url('phase-budget.mjs')),S=await import(url('synthetic-completion.mjs'));
  const {createCoordinator}=await import(url('coordinator.mjs'));
  const {installPhaseInputFence}=await import(pathToFileURL(path.join(__dirname,'fixtures/evidence-phase-session/input-fence.mjs')).href);
  const fresh=()=>import(url('unsaved-result-gate.mjs')+'?session-case='+ ++serial);
  async function harness(options={}){
    const module=options.module||await fresh(),game=originalVM(options),budget=B.createPhaseBudget({observe:options.observe});
    let identity={scope:SCOPE,generation:1,sourceIdentity:'disposable-guest:1'},physical=false,lease=null,identityHook=null;
    const stored=new Map(),heads=new Map(),requests=[],hooks={recover:null,append:null,read:null,retry:null};
    const id=()=>identityHook?identityHook():identity;
    async function commit(q,status='committed'){
      const descriptor=await C.descriptor(q.descriptor,webcrypto),rootHash=await C.chain(descriptor,q,q.payload,webcrypto),head=await C.makeHead(descriptor,q.ordinal,q.offset+q.payload.length,rootHash,!!q.seal,webcrypto);
      stored.set(q.descriptor.run+'#'+q.ordinal,{ordinal:q.ordinal,offset:q.offset,length:q.payload.length,root:rootHash,payload:new Uint8Array(q.payload)});heads.set(q.descriptor.run,head);
      return {status,receipt:{captureIdentity:{scope:q.descriptor.scope,run:q.descriptor.run},ordinal:q.ordinal,length:q.payload.length,root:rootHash,headToken:head.token,sealed:!!q.seal,acknowledgement:'idb-transaction-complete',durability:'strict'},currentHead:head};
    }
    const adapter={get physicalBusy(){return hooks.physicalBusy?hooks.physicalBusy():physical;},get retainedBytes(){return hooks.retainedBytes?hooks.retainedBytes():(lease?lease.payload.length+512:0);},async recover(q){requests.push({type:'recover',q});return hooks.recover?hooks.recover(q):{status:'page',heads:[],watermark:0,nextCursor:null};},
      async appendSegment(q){requests.push({type:'append',q});const r=hooks.append?await hooks.append(q,commit):await commit(q);if(r.status==='outcomeUnknown')lease=q;return r;},
      async retry(){requests.push({type:'retry',q:lease});if(!lease)return {status:'refused',reason:'no-retry'};const r=hooks.retry?await hooks.retry(lease,commit):await commit(lease,'duplicate');if(['committed','duplicate'].includes(r.status))lease=null;return r;},
      async readSegments(q){requests.push({type:'read',q});const ordinal=(q.afterOrdinal??-1)+1,s=stored.get(q.captureIdentity.run+'#'+ordinal),head=await C.headToken(q.throughHead,webcrypto);
        const page=s?{status:'page',segments:[{...s,payload:new Uint8Array(s.payload)}],payloadBytes:s.length,throughHead:q.throughHead,nextCursor:ordinal<head.ordinal?{captureIdentity:{...q.captureIdentity},throughHead:q.throughHead,afterOrdinal:ordinal}:null}:{status:'refused',reason:'read-failure'};return hooks.read?hooks.read(page,q):page;}};
    const coordinator=createCoordinator(adapter,id),manager=module.createFinalePhaseSession({coordinator,readIdentity:id,readItem:game.readItem,readNative:game.readNative,isPersistent:game.persistent,retryStorage:game.retry,leaveField:game.leave,openField:game.open,budget,crypto:options.crypto||webcrypto,now:game.now});game.connect(manager);const fence=installPhaseInputFence({document:game.document,readView:()=>manager.view()});
    const input={mode:'fresh-fixture',session:SESSION,identity:clone(identity),baseSeeds:{8:731,9:731},preState:preState(),background:game.background()};
    if(options.operations==='absent')for(const n of [8,9])delete input.preState[operationKey(n)];
    return {module,game,budget,manager,input,fence,coordinator,hooks,requests,stored,heads,commit,id,setIdentity:x=>{identity=x;},identityHook:x=>{identityHook=x;},physical:x=>{physical=x;},setLease:x=>{lease=x;}};
  }
  const group=async(name,fn)=>{if(process.env.MKTY_PHASE_SESSION_GROUP&&!name.includes(process.env.MKTY_PHASE_SESSION_GROUP))return;try{await fn();groups.push(name);}catch(error){failures.push({name,error:error.stack});console.error('FAIL '+name+'\n'+error.stack);}};
  const state=(h,want)=>eq(h.manager.view().state,want,JSON.stringify(h.manager.view()));
  async function initial(h){eq((await h.manager.begin(h.input)).state,'INITIAL');h.game.stageInitial();await h.game.under('open-0',()=>h.manager.openStaged());state(h,'PLAYING');return h;}
  async function phase(h,i){const capture=h.game.capture(i);eq((await capture.promise).state,'READY');eq(h.manager.view().counters.callbacks,i);await h.game.under('dispatch-'+i,()=>h.manager.continue());return h;}
  async function through(h,end=4){await initial(h);for(let i=0;i<=end;i++){await phase(h,i);if(i===1&&end>1){state(h,'WAIT_CHAPTER9');await h.game.entry();state(h,'WAIT_CONFIRM');await h.game.confirm();state(h,'OPEN_READY');await h.game.under('open-2',()=>h.manager.openStaged());state(h,'PLAYING');}else if(i<end){state(h,'OPEN_READY');await h.game.under('open-'+(i+1),()=>h.manager.openStaged());state(h,'PLAYING');}}return h;}
  function oldCapture(h){return {...S.makeSyntheticCompletion({scope:SCOPE,run:'legacy:1',totalBytes:256,summary:{version:1,resultId:'legacy:1',completedSteps:1,label:'synthetic'}}),context:clone(h.input.identity)};}
  function oldGate(h){return h.module.createUnsavedResultGate({coordinator:h.coordinator,readContext:h.id,onContinue(){}});}
  await group('01 invalid begin leaves realm available; both v1/v2 ownership directions',async()=>{
    for(const mutate of [x=>({...x,extra:true}),x=>({...x,mode:'reload'}),x=>({...x,session:'bad'}),x=>({...x,baseSeeds:{8:-1,9:731}}),x=>({...x,preState:{...x.preState,mkty_points:'200'}})]){
      const h=await harness();eq((await h.manager.begin(mutate(h.input))).state,'EMPTY');eq(h.requests.length,0);eq((await oldGate(h).accept(oldCapture(h))).state,'READY');eq((await h.manager.begin(h.input)).state,'EMPTY');}
    const h=await harness();await h.manager.begin(h.input);eq((await oldGate(h).accept(oldCapture(h))).reason,'realm-capture-retained');h.manager.invalidate();eq((await oldGate(h).accept(oldCapture(h))).reason,'realm-capture-retained');
  });
  await group('02 startup empty, positive, malformed, refused, thrown and reload remain distinct',async()=>{
    const cases=[{status:'page',heads:[{}],watermark:1,nextCursor:null},{status:'page',heads:[],watermark:1,nextCursor:null},{status:'page',heads:[],watermark:0,nextCursor:'cursor'},{status:'refused',reason:'page-too-small'},null,{status:'outcomeUnknown'}];
    for(const page of cases){const h=await harness();h.hooks.recover=()=>page;const v=await h.manager.begin(h.input);ok(['INSPECTION','BLOCKED'].includes(v.state));eq(v.playEnabled,false);eq(v.continueEnabled,false);eq(h.game.counts().openCalls,0);eq((await oldGate(h).accept(oldCapture(h))).reason,'realm-capture-retained');}
    for(const thrown of [false,true]){const h=await harness();if(thrown)h.hooks.recover=()=>{throw Error('recover read');};const v=await h.manager.begin({...h.input,mode:'inspection'});ok(['INSPECTION','BLOCKED'].includes(v.state));eq(h.requests[0].q,{scope:SCOPE,maxHeads:1,maxBytes:8192});eq(h.budget.snapshot().reservations['recovery-page'],0);}
    const h=await harness();h.physical(true);ok(['BLOCKED','INSPECTION'].includes((await h.manager.begin(h.input)).state));
  });
  await group('03 recovery await holds shared reservation and reentrant begin cannot start',async()=>{
    const h=await harness(),entered=deferred(),release=deferred();h.hooks.recover=async()=>{entered.resolve();await release.promise;return {status:'page',heads:[],watermark:0,nextCursor:null};};const pending=h.manager.begin(h.input);await entered.promise;
    for(let i=0;i<3;i++){eq((await h.manager.begin(h.input)).playEnabled,false);eq((await oldGate(h).accept(oldCapture(h))).reason,'realm-capture-retained');}eq(h.requests.length,1);eq(h.budget.snapshot().reservations['recovery-page'],16384);release.resolve();eq((await pending).state,'INITIAL');
    const stale=await harness(),r=deferred();stale.hooks.recover=()=>r.promise;const p=stale.manager.begin(stale.input);stale.setIdentity({...stale.input.identity,generation:2});r.resolve({status:'page',heads:[],watermark:0,nextCursor:null});eq((await p).state,'BLOCKED');
  });
  await group('04 complete continuous five-phase original-handler synthetic fixture',async()=>{
    const h=await through(await harness());state(h,'EPILOGUE_READY');eq(h.game.counts(),{awardCalls:2,callbackCalls:5,openCalls:5});eq(h.game.disk.get('mkty_points'),'5100');eq(h.game.disk.get('mkty_pace_ack_8'),undefined);eq(h.game.disk.get('mkty_pace_ack_9'),'yes');
    eq([...h.heads.keys()].filter(k=>k.startsWith('fc1:')).length,2);eq([...h.heads.keys()].filter(k=>k.startsWith('fp2:')).length,5);eq(h.manager.view().counters.contexts,2);eq(h.manager.view().counters.phases,5);
    const dispatch=[0,1,2,3,4].map(i=>h.game.logical.filter(r=>r.mode==='dispatch-'+i).length);eq(dispatch,[3,12,1,1,12]);
    for(const n of [8,9]){const rows=h.game.logical.filter(r=>r.mode==='dispatch-'+(n===8?1:4)),at=rows.findIndex(r=>r.key===operationKey(n));eq(rows[at-1].key,'mkty_life'+n+'_completed_at');eq(rows[at+1].key,F.storyKey(n));eq(JSON.parse(rows[at+1].value).phase,'complete');eq(rows.filter(r=>r.key===operationKey(n)).length,1);eq(rows[at].value,operationText(n,'complete'));eq(h.game.disk.get(operationKey(n)),operationText(n,'complete'));eq(h.game.c.MKTYOps.isRun(n),false);eq(h.game.c.MKTYOps.pending(n),false);}
    await h.game.done();state(h,'DONE');eq(h.manager.view().counters.done,1);const before=h.game.counts();await h.game.done();await h.manager.continue();await h.manager.retry();eq(h.game.counts(),before);eq(h.game.disk.get('mkty_final_moon_points'),'5100');
    eq(h.budget.snapshot().live,425984);ok(h.budget.snapshot().peak<=1016832);measurements.push({name:'five-phase-vm',dispatch,archiveRuns:[...h.heads.keys()],budgetPeak:h.budget.snapshot().peak});
  });
  await group('05 every dispatch, open, entry and epilogue native-like write cut drains without replay',async()=>{
    const baseline=await through(await harness());await baseline.game.done();const modes=[...Array.from({length:5},(_,i)=>'dispatch-'+i),...Array.from({length:5},(_,i)=>'open-'+i),'entry-navigation','entry-confirm','epilogue'];
    const cutCounts=Object.fromEntries(modes.map(mode=>[mode,baseline.game.native.filter(row=>row.mode===mode).length]));
    eq(cutCounts['dispatch-1'],12);eq(cutCounts['dispatch-4'],12);
    const operationsCuts=[8,9].map(n=>{const mode='dispatch-'+(n===8?1:4),rows=baseline.game.native.filter(row=>row.mode===mode);return {n,mode,cut:rows.findIndex(row=>row.key===operationKey(n))};});
    eq(operationsCuts.map(row=>row.cut),[5,4]);
    const reboots=[];
    const matrix=modes.flatMap(mode=>Array.from({length:cutCounts[mode]},(_,cut)=>({mode,cut})));
    for(const fault of matrix){const h=await harness();h.game.cut(fault.mode,fault.cut);let encountered=false;
      async function barrier(p){await p;if(!h.game.persistent()){encountered=true;eq(h.manager.view().playEnabled,false);const counts=h.game.counts(),target=h.game.snapshot();
        const operationCut=operationsCuts.find(row=>row.mode===fault.mode&&(row.cut===fault.cut||row.cut+1===fault.cut));
        if(operationCut){const {n,cut}=operationCut,key=operationKey(n);eq(target[key],operationText(n,'complete'));eq(h.game.disk.get(key),operationText(n,fault.cut===cut?'core':'complete'));
          const reboot=await harness();reboot.game.disk.clear();for(const [k,v]of h.game.disk)reboot.game.disk.set(k,v);
          reboot.hooks.recover=()=>({status:'page',heads:[{untrusted:'inspection-only'}],watermark:h.heads.size,nextCursor:null});const before=Object.fromEntries(reboot.game.disk);
          eq((await reboot.manager.begin({...reboot.input,mode:'inspection'})).state,'INSPECTION');await reboot.manager.retry();await reboot.manager.continue();await reboot.manager.openStaged();
          eq(Object.fromEntries(reboot.game.disk),before);eq(reboot.game.counts(),{awardCalls:0,callbackCalls:0,openCalls:0});eq(reboot.game.logical.length,0);reboots.push({chapter:n,cut:fault.cut,operationsNativePhase:fault.cut===cut?'core':'complete'});
        }
        await h.manager.retry();eq(h.game.counts(),counts);eq(Object.fromEntries(h.game.disk),target);ok(h.game.persistent());}}
      await h.manager.begin(h.input);h.game.stageInitial();await barrier(h.game.under('open-0',()=>h.manager.openStaged()));state(h,'PLAYING');
      for(let i=0;i<5;i++){eq((await h.game.capture(i).promise).state,'READY');await barrier(h.game.under('dispatch-'+i,()=>h.manager.continue()));if(i===1){state(h,'WAIT_CHAPTER9');await barrier(h.game.entry());state(h,'WAIT_CONFIRM');await barrier(h.game.confirm());}if(i<4){state(h,'OPEN_READY');await barrier(h.game.under('open-'+(i+1),()=>h.manager.openStaged()));state(h,'PLAYING');}}
      await barrier(h.game.done());state(h,'DONE');ok(encountered,JSON.stringify(fault));eq(h.game.counts(),{awardCalls:2,callbackCalls:5,openCalls:5});
    }eq(matrix.length,55);eq(reboots.length,4);measurements.push({name:'operations-write-cut-reboots',cases:reboots});measurements.push({name:'original-write-cuts',cases:matrix.length,dispatch:29,open:16,entry:cutCounts['entry-navigation']+cutCounts['entry-confirm'],epilogue:1,cutCounts});
  });
  await group('06 immutable capture and all retired task closures are inert',async()=>{
    const h=await initial(await harness()),old=h.game.current(),entered=deferred(),release=deferred();let first=true;h.hooks.append=async(q,commit)=>{if(first){first=false;entered.resolve();await release.promise;}return commit(q);};
    const {promise,cp}=h.game.capture(0);await entered.promise;cp.seconds=999;cp.trace=[];const before=h.game.logical.length;old.save(clone(F.phases[0].state));old.exit();await old.complete(clone(F.phases[0].state));eq(h.game.logical.length,before);release.resolve();eq((await promise).state,'READY');await h.game.under('dispatch-0',()=>h.manager.continue());await h.manager.openStaged();state(h,'PLAYING');
    const counts=h.game.counts(),rows=h.game.logical.length;old.save(clone(F.phases[0].state));old.exit();await old.complete(clone(F.phases[0].state));eq(h.game.logical.length,rows);eq(h.game.counts(),counts);eq(JSON.parse(h.game.disk.get(F.sourceKey(8))).seconds,3);
  });
  await group('07 observed same-value/remove/clear/retry and ABA permanently revoke',async()=>{
    for(const operation of [{op:'set',key:'mkty_points',value:'100'},{op:'remove',key:'mkty_absent'},{op:'clear'},{op:'retry'}]){const h=await initial(await harness());let forwarded=0;try{h.manager.write(operation,()=>{forwarded++;});}catch{}state(h,'BLOCKED');eq(forwarded,0);await h.game.current().complete(clone(F.phases[0].state));eq(h.manager.view().counters.captures,0);}
    const h=await initial(await harness()),key=F.sourceKey(8),old=h.game.disk.get(key);for(const value of [old+' ',old])try{h.manager.write({op:'set',key,value},()=>h.game.disk.set(key,value));}catch{}state(h,'BLOCKED');await h.manager.retry();state(h,'BLOCKED');
  });
  await group('08 physical busy after caller settlement blocks every callback authority',async()=>{
    const h=await initial(await harness());await h.game.capture(0).promise;state(h,'READY');h.physical(true);eq(h.manager.view().continueEnabled,false);await h.manager.continue();eq(h.game.counts().callbackCalls,0);h.physical(false);await h.manager.continue();state(h,'OPEN_READY');h.physical(true);await h.manager.openStaged();eq(h.game.counts().openCalls,1);h.physical(false);await h.manager.openStaged();state(h,'PLAYING');
    const x=await through(await harness());x.physical(true);await x.game.done();eq(x.manager.view().counters.done,0);x.physical(false);await x.game.done();state(x,'DONE');
  });
  await group('09 callback throw, swallowed mismatch, silent no-op and descriptor cardinality latch blocked',async()=>{
    for(const kind of ['throw','silent','swallowed-write','missing','duplicate','wrong-seed']){const h=await initial(await harness());await h.game.capture(0).promise;
      h.game.hooks.complete=(original)=>{if(kind==='throw')throw Error('original failed');if(kind==='silent')return;if(kind==='swallowed-write'){try{h.game.c.localStorage.setItem('mkty_points','999');}catch{}return original();}if(kind==='missing'){h.game.hooks.descriptor=()=>null;return original();}if(kind==='wrong-seed'){h.game.hooks.descriptor=t=>({...t,seed:t.seed+1});return original();}original();if(kind==='duplicate')h.game.c.MKTYSpatialFinale.open(8);};
      await h.manager.continue();state(h,'BLOCKED');const count=h.game.counts().callbackCalls;await h.manager.continue();await h.manager.retry();eq(h.game.counts().callbackCalls,count);eq(count,1);
    }
  });
  await group('10 exact unknown append retry, read failure, changed source and identity',async()=>{
    for(const kind of ['unknown','read-failure','identity','source']){const h=await initial(await harness());let once=true;
      if(kind==='read-failure')h.hooks.read=page=>once?(once=false,{status:'refused',reason:'transaction-aborted'}):page;
      else h.hooks.append=async(q,commit)=>{if(once){once=false;if(kind==='unknown')return {status:'outcomeUnknown',reason:'terminal-unobserved'};if(kind==='identity')h.setIdentity({...h.input.identity,generation:2});else h.game.disk.set(F.sourceKey(8),h.game.disk.get(F.sourceKey(8))+' ');}return commit(q);};
      const v=await h.game.capture(0).promise;if(['identity','source'].includes(kind)){ok(['BLOCKED','STALE'].includes(v.state));eq(h.game.counts().callbackCalls,0);}else{eq(v.state,'UNSAVED');const q=h.requests.find(r=>r.type==='append').q;eq((await h.manager.retry()).state,'READY');if(kind==='unknown')eq(h.requests.find(r=>r.type==='retry').q,q);eq(h.game.counts().callbackCalls,0);}
    }
  });
  await group('11 every asynchronous hash/append/read barrier rejects reentrant controls',async()=>{
    const queue=[],waiters=[];let finished=false,hashes=0,transport=0;
    const park=kind=>{const d=deferred();queue.push({kind,...d});waiters.shift()?.();return d.promise;};
    const crypto={subtle:{async digest(...args){await park('hash');return webcrypto.subtle.digest(...args);}}};
    const h=await initial(await harness({crypto}));h.hooks.append=async(q,commit)=>{await park('append');return commit(q);};h.hooks.read=async p=>{await park('read');return p;};
    const p=h.game.capture(0).promise.finally(()=>{finished=true;waiters.shift()?.();});
    while(!finished){if(!queue.length)await new Promise(r=>waiters.push(r));const d=queue.shift();if(!d)continue;d.kind==='hash'?hashes++:transport++;const rows=h.requests.length,counts=h.game.counts();eq(h.manager.view().playEnabled,false);eq((await h.manager.continue()).continueEnabled,false);await h.manager.retry();await h.manager.openStaged();await h.manager.begin(h.input);eq(h.requests.length,rows);eq(h.game.counts(),counts);d.resolve();}
    eq((await p).state,'READY');ok(hashes>=6);ok(transport>=4);measurements.push({name:'every-capture-await',hashes,transport});
  });
  await group('12 cancel chapter-nine risk returns without acknowledgement; missing confirm cannot progress',async()=>{
    const h=await through(await harness(),1);state(h,'WAIT_CHAPTER9');await h.game.entry();state(h,'WAIT_CONFIRM');h.game.get('paceCancel').click();state(h,'WAIT_CHAPTER9');eq(h.game.disk.get('mkty_pace_ack_9'),undefined);h.game.hooks.risk=spec=>({...spec,confirm(){}});await h.game.entry();state(h,'WAIT_CONFIRM');await h.game.confirm();state(h,'BLOCKED');eq(h.game.counts().openCalls,2);
  });
  await group('13 source and story changed before save or Continue cannot be adopted',async()=>{
    for(const seam of ['save','continue-source','continue-story']){const h=await initial(await harness());
      if(seam!=='save')await h.game.capture(0).promise;
      const key=seam==='continue-story'?F.storyKey(8):F.sourceKey(8),before=h.game.logical.length;
      h.game.disk.set(key,h.game.disk.get(key)+' ');
      if(seam==='save')h.game.current().save(clone(F.phases[0].state));else await h.manager.continue();
      state(h,'BLOCKED');eq(h.game.logical.length,before,'No stale original write');eq(h.game.counts().callbackCalls,0);
    }
  });
  await group('14 synchronous reservation observer reentry cannot claim v1 during begin',async()=>{
    let h,once=false,other;h=await harness({observe(e){if(h&&!once&&e.type==='allocate'&&e.label==='metadata'){once=true;other=oldGate(h).accept(oldCapture(h));}}});
    const v=await h.manager.begin(h.input);eq(v.state,'INITIAL');eq((await other).reason,'realm-capture-retained');eq(h.requests.filter(r=>r.type==='recover').length,1);
  });
  await group('15 failed first append and settled crash prefixes reload inspection without writes',async()=>{
    for(const prefix of ['empty-first-append','after-source-remove','points-before-marker','after-dispatch','after-open','before-epilogue']){
      const original=await harness();if(prefix==='empty-first-append'){await initial(original);original.hooks.append=async()=>({status:'refused',reason:'transaction-aborted'});await original.game.capture(0).promise;}
      else if(prefix==='before-epilogue')await through(original);
      else if(prefix==='after-dispatch'||prefix==='after-open'){await through(original,0);if(prefix==='after-open')await original.manager.openStaged();}
      else{await initial(original);await phase(original,0);await original.manager.openStaged();await original.game.capture(1).promise;original.game.cut('dispatch-1',prefix==='after-source-remove'?4:8);await original.game.under('dispatch-1',()=>original.manager.continue());ok(!original.game.persistent());if(prefix==='points-before-marker'){eq(original.game.disk.get('mkty_points'),'2100');eq(original.game.disk.get('mkty_life8_awarded'),undefined);}}
      const h=await harness();h.game.disk.clear();for(const [k,v] of original.game.disk)h.game.disk.set(k,v);
      h.hooks.recover=()=>({status:'page',heads:original.heads.size?[{untrusted:'inspection-only'}]:[],watermark:original.heads.size,nextCursor:null});
      const before=Object.fromEntries(h.game.disk);eq((await h.manager.begin({...h.input,mode:'inspection'})).state,'INSPECTION');
      await h.manager.continue();await h.manager.retry();await h.manager.openStaged();eq(h.manager.confirmEntry,undefined);eq(h.manager.cancelEntry,undefined);
      eq(Object.fromEntries(h.game.disk),before);eq(h.game.counts(),{awardCalls:0,callbackCalls:0,openCalls:0});eq(h.game.logical.length,0);
    }
  });
  await group('16 retired story mismatch blocks; transient witness read retries only correspondence',async()=>{
    for(const kind of ['changed','read-error']){const h=await through(await harness(),1);await h.game.entry();await h.game.confirm();await h.manager.openStaged();await h.game.capture(2).promise;
      if(kind==='changed')h.game.disk.set(F.storyKey(8),h.game.disk.get(F.storyKey(8))+' ');else h.game.hooks.readNative=k=>{if(k===F.storyKey(8))throw Error('transient retired read');return h.game.disk.get(k)??null;};
      const before=h.game.counts();await h.manager.continue();eq(h.game.counts(),before);
      if(kind==='changed'){state(h,'BLOCKED');await h.manager.retry();eq(h.game.counts(),before);}else{state(h,'WITNESS_RETRY');h.game.hooks.readNative=null;await h.manager.retry();state(h,'OPEN_READY');eq(h.game.counts().callbackCalls,before.callbackCalls+1);eq(h.game.counts().awardCalls,before.awardCalls);}
    }
  });
  await group('17 all witness and five-phase archive awaits hold authority through settlement',async()=>{
    const queue=[],waiters=[];let finished=false,delays=0,hashes=0,transport=0;
    const park=kind=>{const d=deferred();queue.push({kind,...d});waiters.shift()?.();return d.promise;};
    const crypto={subtle:{async digest(...args){await park('hash');return webcrypto.subtle.digest(...args);}}};
    const h=await harness({crypto});h.hooks.append=async(q,commit)=>{await park('append');return commit(q);};h.hooks.read=async page=>{await park('read');return page;};const p=(async()=>{await through(h);await h.game.done();})().finally(()=>{finished=true;waiters.shift()?.();});
    while(!finished){if(!queue.length)await new Promise(r=>waiters.push(r));const d=queue.shift();if(!d)continue;delays++;d.kind==='hash'?hashes++:transport++;const count=h.game.counts();ok(h.manager.view().busy);await h.manager.continue();await h.manager.retry();await h.manager.openStaged();eq(h.game.counts(),count);d.resolve();}
    await p;state(h,'DONE');ok(hashes>30);eq(transport,14);measurements.push({name:'whole-five-phase-delayed-awaits',delays,hashes,transport});
  });
  await group('18 physical idle is rechecked after fallible preparation before original invocation',async()=>{
    const h=await initial(await harness());await h.game.capture(0).promise;let fired=false;
    h.game.hooks.readItem=k=>{if(k==='mkty_legacy_v1'&&!fired){fired=true;h.physical(true);}return h.game.c.MKTYStorage.readItem(k);};
    await h.manager.continue();ok(fired);eq(h.game.counts().callbackCalls,0);eq(h.manager.view().continueEnabled,false);
  });
  await group('19 capture leaves field before bridge reads and rejects invalid/nonwon without dispatch',async()=>{
    for(const kind of ['invalid','nonwon','read-error']){const h=await initial(await harness());const cp=clone(F.phases[0].state);h.game.current().save(cp);let left=false,reads=0;
      h.game.hooks.leave=()=>{left=true;};h.game.hooks.readItem=k=>{reads++;ok(left,'Bridge current-source/story reads follow leave');if(kind==='read-error')throw Error('read failed');return h.game.c.MKTYStorage.readItem(k);};
      if(kind==='invalid')cp.extra=new Date();if(kind==='nonwon')cp.complete=false;
      const v=await h.game.current().complete(cp);eq(v.state,'BLOCKED');ok(left);ok(reads>0);eq(h.game.counts().callbackCalls,0);eq(h.requests.filter(r=>r.type==='append').length,0);
    }
  });
  await group('20 every initial native ledger key read failure and mismatch prevents PLAYING',async()=>{
    const keys=[...Object.keys(preState()).filter(key=>!key.startsWith('mkty_operations_')),'mkty_current_chapter',F.sourceKey(8)];
    for(const kind of ['throw','mismatch'])for(const key of keys){const h=await harness();await h.manager.begin(h.input);h.game.stageInitial();let once=true;
      h.game.hooks.readNative=k=>{if(k===key&&once){once=false;if(kind==='throw')throw Error('one native read failed');return 'wrong-native-target';}return h.game.disk.get(k)??null;};
      await h.manager.openStaged();ok(!once,key);eq(h.manager.view().playEnabled,false);const count=h.game.counts();h.game.hooks.readNative=null;
      if(kind==='throw'){state(h,'OPEN_DRAIN');await h.manager.drain();state(h,'PLAYING');}else{state(h,'BLOCKED');await h.manager.retry();state(h,'BLOCKED');}eq(h.game.counts(),count);
    }
  });
  await group('21 risk-attempt handles are branded, once-consumed and stale after Cancel',async()=>{
    const h=await through(await harness(),1);await h.game.entry();state(h,'WAIT_CONFIRM');const old=h.game.riskHandles.at(-1);ok(Object.isFrozen(old));old.cancel();state(h,'WAIT_CHAPTER9');await h.game.entry();state(h,'WAIT_CONFIRM');const current=h.game.riskHandles.at(-1);ok(current!==old);
    const rows=h.game.logical.length;await old.confirm();old.cancel();state(h,'WAIT_CONFIRM');eq(h.game.logical.length,rows);eq(h.game.disk.get('mkty_pace_ack_9'),undefined);await current.confirm();state(h,'OPEN_READY');const after=h.game.logical.length;await current.confirm();current.cancel();eq(h.game.logical.length,after);eq(h.game.disk.get('mkty_pace_ack_9'),'yes');
    for(const mode of ['missing','duplicate','foreign']){const k=await through(await harness(),1);k.game.hooks.risk=spec=>{if(mode==='missing')return null;if(mode==='duplicate'){k.manager.stageRisk(spec);return spec;}return {...spec,chapter:8};};await k.game.entry();state(k,'BLOCKED');eq(k.game.disk.get('mkty_pace_ack_9'),undefined);eq(k.game.counts().callbackCalls,2);}
  });
  await group('22 invalidating identity and physical getters cannot revive original authority',async()=>{
    for(const seam of ['identity','physicalBusy','retainedBytes'])for(const action of ['begin','open','continue']){
      const h=await harness();if(action==='open'){await h.manager.begin(h.input);h.game.stageInitial();}if(action==='continue'){await initial(h);await h.game.capture(0).promise;}
      const before=h.game.counts();let fired=false;const invalidate=()=>{if(!fired){fired=true;h.manager.invalidate();}};
      if(seam==='identity')h.identityHook(()=>{invalidate();return clone(h.input.identity);});else h.hooks[seam]=()=>{invalidate();return seam==='physicalBusy'?false:0;};
      if(action==='begin')await h.manager.begin(h.input);else if(action==='open')await h.manager.openStaged();else await h.manager.continue();
      ok(fired,seam+'/'+action);state(h,'BLOCKED');eq(h.game.counts(),before);await h.manager.retry();await h.manager.continue();await h.manager.openStaged();state(h,'BLOCKED');eq(h.game.counts(),before);eq(h.manager.view().playEnabled,false);eq(h.manager.view().continueEnabled,false);
    }
    const h=await through(await harness(),1);h.game.hooks.risk=spec=>({...spec,cancel(){h.manager.invalidate();return spec.cancel();}});await h.game.entry();const before=h.game.counts(),handle=h.game.riskHandles.at(-1);handle.cancel();state(h,'BLOCKED');await handle.confirm();await h.game.entry();state(h,'BLOCKED');eq(h.game.counts(),before);eq(h.game.disk.get('mkty_pace_ack_9'),undefined);
  });
  await group('23 invalidating budget observers at begin, admission and release edges stay blocked',async()=>{
    const cases=[
      ['begin','allocate','metadata'],['begin','reserve','recovery-page'],['begin','release','recovery-page'],['begin','reserve','raw-capsule'],
      ['begin','reserve','context-retained'],['begin','allocate','context-parse'],['begin','release','context-restore'],
      ['capture','allocate','raw-capsule'],['capture','release','raw-capsule'],['capture','reserve','phase-workspace'],
      ['capture','release','private-phase'],['capture','release','phase-workspace'],
      ['dispatch','reserve','callback-scratch'],['dispatch','release','callback-scratch'],['dispatch','release','original-read-workspace'],
      ['chapter8-retire','release','post-target'],['chapter8-retire','release','context-retained'],
      ['entry','reserve','context-retained'],['entry-confirm','release','post-target'],
      ['epilogue','release','raw-capsule'],['epilogue','release','context-retained']];
    for(const [stage,type,label]of cases){let h,armed=false,fired=false,atInvalidation;h=await harness({observe(e){if(h&&armed&&!fired&&e.type===type&&e.label===label){fired=true;atInvalidation=h.game.counts();h.manager.invalidate();}}});
      if(stage==='begin'){armed=true;await h.manager.begin(h.input);}
      else if(stage==='capture'){await initial(h);armed=true;await h.game.capture(0).promise;}
      else if(stage==='dispatch'){await initial(h);await h.game.capture(0).promise;armed=true;await h.manager.continue();}
      else if(stage==='chapter8-retire'){await through(h,0);await h.manager.openStaged();await h.game.capture(1).promise;armed=true;await h.manager.continue();}
      else if(stage==='entry'){await through(h,1);armed=true;await h.game.entry();}
      else if(stage==='entry-confirm'){await through(h,1);await h.game.entry();armed=true;await h.game.confirm();}
      else{await through(h);armed=true;await h.game.done();}
      ok(fired,[stage,type,label].join('/'));state(h,'BLOCKED');eq(h.game.counts(),atInvalidation);await h.manager.retry();await h.manager.continue();await h.manager.openStaged();state(h,'BLOCKED');eq(h.game.counts(),atInvalidation);eq(h.manager.view().playEnabled,false);eq(h.manager.view().continueEnabled,false);
    }measurements.push({name:'invalidating-budget-observer-edges',cases:cases.length});
  });
  await group('24 exact cloud outgoing and recovery keys fence begin and original Retry',async()=>{
    for(const key of ['mkty_cloud_restore_outgoing','mkty_cloud_recovery']){
      const h=await harness();h.game.disk.set(key,'synthetic-pending');await h.manager.begin(h.input);state(h,'BLOCKED');eq(h.game.counts(),{awardCalls:0,callbackCalls:0,openCalls:0});eq(h.game.logical.length,0);
      const k=await harness();k.game.cut('open-0',2);await k.manager.begin(k.input);k.game.stageInitial();await k.game.under('open-0',()=>k.manager.openStaged());state(k,'OPEN_DRAIN');ok(!k.game.persistent());k.game.disk.set(key,'synthetic-pending');const before=k.game.counts(),rows=k.game.native.length;
      await k.manager.retry();state(k,'BLOCKED');eq(k.game.native.length,rows,'No storage probe or overlay flush');eq(k.game.logical.filter(r=>r.op==='retry').length,0);eq(k.game.counts(),before);ok(!k.game.persistent());
    }
  });
  await group('25 chapter-nine raw result stays charged until epilogue callback and exact drain',async()=>{
    const h=await through(await harness());state(h,'EPILOGUE_READY');eq(h.budget.snapshot().reservations['raw-capsule'],65536);eq(h.budget.snapshot().reservations['context-retained'],65536);
    await h.manager.continue();await h.manager.drain();state(h,'EPILOGUE_READY');eq(h.budget.snapshot().reservations['raw-capsule'],65536);
    h.game.cut('epilogue',0);await h.game.done();state(h,'EPILOGUE_DRAIN');eq(h.manager.view().counters.done,1);eq(h.budget.snapshot().reservations['raw-capsule'],65536);eq(h.budget.snapshot().reservations['context-retained'],65536);ok(!h.game.persistent());
    const counts=h.game.counts();await h.game.done();eq(h.game.counts(),counts);await h.manager.retry();state(h,'DONE');eq(h.manager.view().counters.done,1);eq(h.budget.snapshot().reservations['raw-capsule'],0);eq(h.budget.snapshot().reservations['context-retained'],0);eq(h.budget.snapshot().live,425984);eq(h.game.counts(),counts);
  });
  await group('26 actual field handlers are fenced through initial, successor and entry drains',async()=>{
    for(const stage of ['initial','successor','docking','entry-navigation','entry-confirm']){
      const h=await harness();
      if(stage==='initial'){await h.manager.begin(h.input);h.game.stageInitial();h.game.cut('parked',0);await h.game.under('parked',()=>h.manager.openStaged());state(h,'OPEN_DRAIN');}
      else if(stage==='successor'||stage==='docking'){await through(h,stage==='successor'?0:2);h.game.cut('parked',0);await h.game.under('parked',()=>h.manager.openStaged());state(h,'OPEN_DRAIN');}
      else{await through(h,1);h.game.cut(stage,0);await h.game.entry();if(stage==='entry-confirm')await h.game.confirm();state(h,stage==='entry-navigation'?'ENTRY_NAV_DRAIN':'ENTRY_DRAIN');}
      const before=clone(h.game.c.MKTYField.snapshot()),writes=h.game.logical.length;
      for(const id of ['fieldResume','fieldSubmit','fieldExit'])eq(h.game.fire(h.game.get(id),'click').defaultPrevented,true,id+'/'+stage);
      eq(h.game.fire(h.game.get('fieldDialog'),'cancel',{bubbles:false}).defaultPrevented,true);
      for(const target of [h.game.document,h.game.c,h.game.document.body])for(const code of ['ArrowRight','KeyW','Space'])h.game.fire(target,'keydown',{code});
      eq(clone(h.game.c.MKTYField.snapshot()),before,'Original model cannot mutate while parked');eq(h.game.logical.length,writes);ok(h.fence.diagnostics().blocked>=4);
      await h.manager.retry();if(stage==='entry-navigation'){state(h,'WAIT_CONFIRM');await h.game.confirm();await h.manager.openStaged();}else if(stage==='entry-confirm')await h.manager.openStaged();state(h,'PLAYING');
      eq(h.game.fire(h.game.get('fieldResume'),'click').defaultPrevented,false);eq(h.game.get('fieldDialog').open,false);
      if(stage==='docking'){h.game.fire(h.game.document.body,'keydown',{code:'ArrowRight'});h.game.tick(100);h.game.tick(120);h.game.tick(140);ok(h.game.c.MKTYField.snapshot().trace.some(r=>r[0]==='tick'&&r[2]===1));h.game.fire(h.game.document.body,'keyup',{code:'ArrowRight'});}
      else{const n=h.game.c.MKTYField.snapshot().trace.length;eq(h.game.fire(h.game.get('fieldSubmit'),'click').defaultPrevented,false);ok(h.game.c.MKTYField.snapshot().trace.length>n,'Original Submit runs after drain: '+stage+' '+JSON.stringify(h.game.c.MKTYField.snapshot()));}
      h.game.get('fieldPause').click();h.game.fire(h.game.get('fieldDialog'),'cancel',{bubbles:false});eq(h.game.get('fieldDialog').open,false);h.game.get('fieldExit').click();state(h,'BLOCKED');
    }
  });
  await group('27 stale exit, read throws and nested save observers never gain authority',async()=>{
    const stale=await harness();let exits=0;stale.game.hooks.descriptor=t=>({...t,exit(){exits++;return t.exit();}});await initial(stale);stale.setIdentity({...stale.input.identity,generation:2});stale.game.current().exit();eq(exits,0);state(stale,'BLOCKED');
    for(const seam of ['open','continue']){const h=await harness();if(seam==='open'){await h.manager.begin(h.input);h.game.stageInitial();}else{await initial(h);await h.game.capture(0).promise;}
      h.game.hooks.readItem=()=>{throw Error('preparation read failed');};if(seam==='open')await h.manager.openStaged();else await h.manager.continue();state(h,'BLOCKED');eq(h.manager.view().busy,false);eq(h.game.counts().callbackCalls,0);
    }
    for(const nested of ['write','complete','save']){const h=await initial(await harness());let once=true,pending;const cp=clone(F.phases[0].state);h.game.c.addEventListener('mkty:storage',()=>{if(!once)return;once=false;if(nested==='write')h.game.c.localStorage.setItem(F.sourceKey(8),'{}');else if(nested==='complete')pending=h.game.current().complete(cp);else h.game.current().save(cp);});h.game.current().save(cp);if(pending)await pending;
      eq(h.manager.view().counters.captures,0);eq(h.game.counts().callbackCalls,0);if(nested==='write')state(h,'BLOCKED');else state(h,'PLAYING');ok(h.game.disk.get(F.sourceKey(8))!=='{}');
    }
  });
  await group('28 every finite retired-witness action retries only its uninvoked original',async()=>{
    for(const action of ['entry','confirm','open','continue','epilogue'])for(const fault of ['read','changed']){
      const h=await through(await harness(),action==='epilogue'?4:1);if(['confirm','open','continue'].includes(action))await h.game.entry();if(['open','continue'].includes(action))await h.game.confirm();if(action==='continue'){await h.manager.openStaged();await h.game.capture(2).promise;}
      if(fault==='changed')h.game.disk.set(F.storyKey(8),h.game.disk.get(F.storyKey(8))+' ');else h.game.hooks.readNative=k=>{if(k===F.storyKey(8))throw Error('retired witness read failed');return h.game.disk.get(k)??null;};
      const before=h.game.counts(),rows=h.game.logical.length;const run=()=>action==='entry'?h.game.entry():action==='confirm'?h.game.confirm():action==='open'?h.manager.openStaged():action==='continue'?h.manager.continue():h.game.done();await run();eq(h.game.counts(),before);eq(h.game.logical.length,rows);
      if(fault==='changed'){state(h,'BLOCKED');await h.manager.retry();eq(h.game.counts(),before);}else{state(h,'WITNESS_RETRY');await h.manager.retry();eq(h.game.counts(),before);h.game.hooks.readNative=null;await h.manager.retry();state(h,({entry:'WAIT_CONFIRM',confirm:'OPEN_READY',open:'PLAYING',continue:'OPEN_READY',epilogue:'DONE'})[action]);eq(h.game.logical.filter(r=>r.op==='retry').length,0,'Read-only witness retry never flushes storage');
        eq(h.game.counts().awardCalls,before.awardCalls);eq(h.game.counts().callbackCalls,before.callbackCalls+(action==='continue'?1:0));eq(h.game.counts().openCalls,before.openCalls+(action==='open'?1:0));}
    }
  });
  await group('29 unchanged original callbacks and live saves own the full read workspace',async()=>{
    const h=await harness(),seen=new Map();h.game.hooks.original=kind=>{seen.set(kind,(seen.get(kind)||0)+1);const held=h.budget.snapshot().reservations;eq(held['original-read-workspace'],196608,kind);for(const label of ['callback-scratch','callback-outer-story','callback-inner-story'])eq(held[label],65536,kind+'/'+label);eq(held['post-work-1'],0);eq(held['post-work-2'],0);eq(held['post-stringify'],0);};
    await through(h);await h.game.done();for(const kind of ['initial','open','save','complete','entry','confirm','epilogue'])ok(seen.has(kind),kind);eq(seen.get('open'),5);eq(seen.get('complete'),5);eq(seen.get('epilogue'),1);eq(h.budget.snapshot().reservations['original-read-workspace'],0);
    for(const [type,label] of [['reserve','original-read-workspace'],['allocate','original-read-workspace'],['release','original-read-workspace'],['release','callback-outer-story']]){let k,armed=false,fired=false;k=await harness({observe(e){if(armed&&!fired&&e.type===type&&e.label===label){fired=true;k.manager.invalidate();}}});await initial(k);armed=true;k.game.current().save(clone(F.phases[0].state));ok(fired);state(k,'BLOCKED');eq(k.manager.view().busy,false);eq(k.game.counts().callbackCalls,0);}
    measurements.push({name:'original-read-workspace-callbacks',counts:Object.fromEntries(seen)});
  });
  await group('30 default no-skip day gate and background pins stay explicit',async()=>{
    const h=await through(await harness({skip:null}),1);eq(h.input.background.mkty_pace_skip_9,null);await h.game.entry();state(h,'BLOCKED');eq(h.game.riskHandles.length,0);eq(h.game.disk.get('mkty_pace_ack_9'),undefined);eq(h.game.disk.get('mkty_daily_demo'),h.input.background.mkty_daily_demo);
    for(const key of Object.keys(h.input.background)){const k=await harness();k.game.disk.set(key,'changed-background');await k.manager.begin(k.input);state(k,'BLOCKED');eq(k.game.counts().openCalls,0);}
  });
  function archivedStory(h,chapter){const run=`fc1:${SESSION}:${chapter}`,rows=[...h.stored].filter(([key])=>key.startsWith(run+'#')).map(([,row])=>row).sort((a,b)=>a.ordinal-b.ordinal);const packet=Buffer.concat(rows.map(row=>Buffer.from(row.payload)));eq(packet.subarray(0,8).toString(),'ARCHIVE1');const length=Number(packet.readBigUInt64LE(12));return packet.subarray(20,20+length).toString('utf16le');}
  await group('31 real unchanged 911-row context archives exactly and survives retired witness checks',async()=>{
    const text=realLongContext(),h=await through(await harness({story8:text}),1);state(h,'WAIT_CHAPTER9');eq(archivedStory(h,8),text);const retired=h.game.disk.get(F.storyKey(8));eq(JSON.parse(retired).tasks[0].proof.trace,JSON.parse(text).tasks[0].proof.trace);eq(JSON.parse(retired).tasks[0].performance.precise,true);eq(h.budget.snapshot().reservations['context-retained'],0);
    await h.game.entry();state(h,'WAIT_CONFIRM');eq(h.budget.snapshot().reservations['context-retained'],65536);await h.game.confirm();await h.manager.openStaged();state(h,'PLAYING');
    for(let i=2;i<5;i++){const captured=h.game.capture(i);if(i===4)eq(captured.cp.mods.stability,17,'Unchanged original precision bonus');eq((await captured.promise).state,'READY');await h.manager.continue();if(i<4)await h.manager.openStaged();}
    state(h,'EPILOGUE_READY');eq(h.game.disk.get(F.storyKey(8)),retired);await h.game.done();state(h,'DONE');eq(archivedStory(h,8),text);eq(h.game.counts(),{awardCalls:2,callbackCalls:5,openCalls:5});ok(h.budget.snapshot().peak<=1016832);measurements.push({name:'real-911-row-continuous-context',storyUtf16:text.length*2,precision:1,gateStability:17,budgetPeak:h.budget.snapshot().peak});
  });
  await group('32 exact raw context boundary and next UTF-16 unit refusal precede original entry',async()=>{
    const pad=n=>{const text=JSON.stringify(F.plan(n));return text+' '.repeat(32768-text.length);},story8=pad(8),story9=pad(9),h=await through(await harness({story8,story9}));await h.game.done();state(h,'DONE');eq(archivedStory(h,8),story8);const entryTarget=h.game.logical.find(row=>row.mode==='entry-confirm'&&row.key===F.storyKey(9)).value;eq(archivedStory(h,9),entryTarget);ok(entryTarget!==story9,'Chapter-nine archive freezes actual original post-entry rewrite');eq(h.budget.snapshot().live,425984);ok(h.budget.snapshot().peak<=1016832);
    for(const target of ['initial-story','entry-story','entry-source']){const k=await harness(),key=target==='initial-story'?F.storyKey(8):target==='entry-story'?F.storyKey(9):F.sourceKey(9);if(target!=='initial-story')await through(k,1);const limit=target==='entry-source'?8192:32768,original=k.game.disk.get(key),over=original+' '.repeat(limit-original.length+1);k.game.disk.set(key,over);let parses=0,entries=0;const parse=JSON.parse;k.game.hooks.original=kind=>{if(kind==='initial'||kind==='entry')entries++;};JSON.parse=function(text,...args){if(text===over)parses++;return parse(text,...args);};
      try{if(target==='initial-story')await k.manager.begin(k.input);else await k.game.entry();}finally{JSON.parse=parse;}state(k,'BLOCKED');eq(parses,0,'Raw bound checked before parse');eq(entries,0,'Oversized source/context cannot reach original entry');
    }measurements.push({name:'raw-context-boundary',eachPreEntryStoryUtf16:65536,archivedChapter9Utf16:entryTarget.length*2,nextUnit:65538,budgetPeak:h.budget.snapshot().peak});
  });
  await group('33 final chapter-nine target is retained and checked before and after epilogue',async()=>{
    for(const fault of ['read','changed','post-done-changed']){const h=await through(await harness());eq(h.budget.snapshot().reservations['post-target'],65536);const rows=h.game.logical.length,before=h.game.counts();
      if(fault==='read')h.game.hooks.readNative=k=>{if(k===F.storyKey(9))throw Error('final target read failed');return h.game.disk.get(k)??null;};
      else if(fault==='changed')h.game.disk.set(F.storyKey(9),h.game.disk.get(F.storyKey(9))+' ');
      else{h.game.cut('epilogue',0);await h.game.done();state(h,'EPILOGUE_DRAIN');eq(h.manager.view().counters.done,1);h.game.disk.set(F.storyKey(9),h.game.disk.get(F.storyKey(9))+' ');await h.manager.retry();state(h,'BLOCKED');eq(h.manager.view().counters.done,1);eq(h.budget.snapshot().reservations['post-target'],65536);continue;}
      await h.game.done();eq(h.manager.view().counters.done,0);eq(h.game.counts(),before);eq(h.game.logical.length,rows);eq(h.budget.snapshot().reservations['post-target'],65536);
      if(fault==='changed'){state(h,'BLOCKED');await h.manager.retry();eq(h.manager.view().counters.done,0);}else{state(h,'WITNESS_RETRY');h.game.hooks.readNative=null;await h.manager.retry();state(h,'DONE');eq(h.manager.view().counters.done,1);eq(h.budget.snapshot().reservations['post-target'],0);eq(h.budget.snapshot().live,425984);eq(h.game.counts(),before);}
    }
  });
  await group('34 pending epilogue distinguishes persistence flush from read-only native retry',async()=>{
    for(const fault of ['persistence','read']){const h=await through(await harness()),before=h.game.counts();
      if(fault==='persistence'){h.game.cut('background-bank',0);h.game.under('background-bank',()=>h.game.c.getLifeBank());ok(!h.game.persistent());eq(h.game.disk.get('mkty_global_lives'),'9','Same-value failure still requires storage Retry');}
      else h.game.hooks.readNative=k=>{if(k===F.storyKey(9))throw Error('native target read failed');return h.game.disk.get(k)??null;};
      await h.game.done();state(h,'WITNESS_RETRY');eq(h.manager.view().counters.done,0);eq(h.game.counts(),before);eq(h.game.logical.filter(row=>row.op==='retry').length,0);h.game.hooks.readNative=null;
      await h.manager.retry();state(h,'DONE');eq(h.manager.view().counters.done,1);eq(h.game.counts(),before);eq(h.game.logical.filter(row=>row.op==='retry').length,fault==='persistence'?1:0);ok(h.game.persistent());eq(h.budget.snapshot().live,425984);
      await h.game.done();await h.manager.retry();eq(h.manager.view().counters.done,1);eq(h.game.counts(),before);
    }
  });
  await group('35 Cancel discards only the pending uninvoked risk confirmation',async()=>{
    const h=await through(await harness(),1);let cancels=0;h.game.hooks.risk=spec=>({...spec,cancel(){cancels++;return spec.cancel();}});await h.game.entry();state(h,'WAIT_CONFIRM');const old=h.game.riskHandles.at(-1),before=h.game.counts();
    h.game.hooks.readNative=k=>{if(k===F.storyKey(8))throw Error('defer confirmation witness');return h.game.disk.get(k)??null;};await old.confirm();state(h,'WITNESS_RETRY');eq(h.game.disk.get('mkty_pace_ack_9'),undefined);old.cancel();state(h,'WAIT_CHAPTER9');eq(cancels,1);eq(h.game.get('paceDialog').open,false);eq(h.game.counts(),before);
    h.game.hooks.readNative=null;const rows=h.game.logical.length;await h.manager.retry();await old.confirm();old.cancel();state(h,'WAIT_CHAPTER9');eq(h.game.logical.length,rows);eq(cancels,1);eq(h.game.disk.get('mkty_pace_ack_9'),undefined);eq(h.budget.snapshot().reservations['context-retained'],0);
    await h.game.entry();const current=h.game.riskHandles.at(-1);ok(current!==old);await current.confirm();state(h,'OPEN_READY');const consumed=h.game.logical.length;current.cancel();await current.confirm();state(h,'OPEN_READY');eq(cancels,1);eq(h.game.logical.length,consumed);await h.manager.openStaged();state(h,'PLAYING');eq(h.game.counts().callbackCalls,before.callbackCalls);
  });

  await group('36 exact prepared-operations input pair is explicit, canonical and fixed',async()=>{
    const variants=[null,operationText(8,'planning'),operationText(8,'complete'),operationText(8)+' ',JSON.stringify({...operationRecord(8),seed:732}),JSON.stringify({...operationRecord(8),round:2}),JSON.stringify({...operationRecord(8),seconds:1}),JSON.stringify({...operationRecord(8),extra:true}),JSON.stringify(Object.fromEntries(Object.entries(operationRecord(8)).reverse()))];
    for(const n of [8,9])for(const base of variants){const h=await harness(),value=base===null?null:base.replace('"n":8','"n":'+n);h.input.preState[operationKey(n)]=value;
      eq((await h.manager.begin(h.input)).state,'EMPTY');eq(h.requests.length,0);eq(h.game.logical.length,0);eq(h.game.counts(),{awardCalls:0,callbackCalls:0,openCalls:0});}
    for(const n of [8,9]){const h=await harness();delete h.input.preState[operationKey(n)];eq((await h.manager.begin(h.input)).state,'EMPTY');eq(h.requests.length,0);}
    for(const n of [8,9])for(const field of ['version','n','seed','round','phase','input','confirmed','actions','hints','errors','seconds']){
      const h=await harness(),record=operationRecord(n);delete record[field];h.input.preState[operationKey(n)]=JSON.stringify(record);eq((await h.manager.begin(h.input)).state,'EMPTY');eq(h.requests.length,0);}
    for(const n of [8,9])for(const value of [null,operationText(n)+' ',operationText(n,'planning'),JSON.stringify({...operationRecord(n),seconds:1})]){
      const h=await harness();value===null?h.game.disk.delete(operationKey(n)):h.game.disk.set(operationKey(n),value);eq((await h.manager.begin(h.input)).state,'BLOCKED');eq(h.game.logical.length,0);eq(h.game.counts(),{awardCalls:0,callbackCalls:0,openCalls:0});}
    const index=source('index.html'),order=['chapter-space.js','operations.js','story.js'].map(file=>index.indexOf('<script src="'+file));ok(order.every(at=>at>=0));ok(order[0]<order[1]&&order[1]<order[2]);
  });
  await group('37 real missing operations9 still attempts forbidden planning after original story risk',async()=>{
    for(const explicitNulls of [false,true]){const h=await harness({operations:'absent',initialSpatial:true});if(explicitNulls)for(const n of [8,9])h.input.preState[operationKey(n)]=null;
      await through(h,1);state(h,'WAIT_CHAPTER9');eq(h.game.logical.filter(row=>row.mode==='dispatch-1').length,11);await h.game.entry();state(h,'WAIT_CONFIRM');await h.game.confirm();state(h,'BLOCKED');
      const first=h.game.rejections.find(row=>row.operation.key===operationKey(9));ok(first);eq(first.mode,'entry-confirm');eq(first.reason,'phase-writer-operation');const attempt=JSON.parse(first.operation.value);eq(attempt.n,9);eq(attempt.phase,'planning');eq(attempt.round,0);
      eq(h.game.logical.filter(row=>row.mode==='entry-confirm').map(row=>row.key),['mkty_pace_ack_9',F.storyKey(9)]);eq(h.game.disk.get(operationKey(9)),undefined);eq(h.game.handles.length,2);eq(h.game.counts(),{awardCalls:1,callbackCalls:2,openCalls:2});
      const before=h.game.counts(),rows=h.game.logical.length;await h.manager.retry();await h.manager.continue();await h.manager.openStaged();state(h,'BLOCKED');eq(h.game.counts(),before);eq(h.game.logical.length,rows);
    }
  });
  await group('38 completed operations targets remain pinned through entry, Continue and epilogue',async()=>{
    for(const seam of ['entry','confirm','continue','epilogue'])for(const fault of ['changed','read-error']){
      const h=await through(await harness(),seam==='epilogue'?4:1),n=seam==='epilogue'?9:8,key=operationKey(n);
      if(seam==='confirm'||seam==='continue'){await h.game.entry();if(seam==='continue'){await h.game.confirm();await h.manager.openStaged();await h.game.capture(2).promise;}}
      eq(h.game.disk.get(key),operationText(n,'complete'));eq(h.game.c.MKTYOps.pending(n),false);const counts=h.game.counts(),rows=h.game.logical.length;
      if(fault==='changed'){h.game.disk.set(key,JSON.stringify({...operationRecord(n,'complete'),seconds:1}));eq(h.game.c.MKTYOps.pending(n),false,'Real cache may accept another complete record; manager must compare exact target');}
      else h.game.hooks.readNative=k=>{if(k===key)throw Error('temporary operations target read');return h.game.disk.get(k)??null;};
      const action=()=>seam==='entry'?h.game.entry():seam==='confirm'?h.game.confirm():seam==='continue'?h.manager.continue():h.game.done();await action();eq(h.game.counts(),counts);eq(h.game.logical.length,rows);eq(h.manager.view().playEnabled,false);
      if(fault==='changed'||seam!=='epilogue'){state(h,'BLOCKED');h.game.hooks.readNative=null;h.game.disk.set(key,operationText(n,'complete'));await h.manager.retry();await action();state(h,'BLOCKED');eq(h.game.counts(),counts);eq(h.game.logical.length,rows);}
      else{state(h,'WITNESS_RETRY');h.game.hooks.readNative=null;await h.manager.retry();state(h,'DONE');eq(h.game.counts(),counts);}
    }
    for(const n of [8,9]){const h=await initial(await harness()),key=operationKey(n);eq(h.game.c.MKTYOps.isRun(n),true);const original=h.game.disk.get(key);let forwarded=0;
      for(const value of [JSON.stringify({...operationRecord(n),seconds:1}),original])try{h.manager.write({op:'set',key,value},()=>{forwarded++;h.game.disk.set(key,value);});}catch{}
      state(h,'BLOCKED');eq(forwarded,0);eq(h.game.disk.get(key),original);eq(h.game.c.MKTYOps.isRun(n),true);await h.game.current().complete(clone(F.phases[0].state));eq(h.game.counts().callbackCalls,0);
    }
  });


  await group('39 operations drift is rejected before original parsing; real pagehide gains no write authority',async()=>{
    for(const seam of ['initial','confirm','continue'])for(const raw of ['{malformed',operationText(9,'planning'),operationText(9)+' '.repeat(32768)]){
      const h=await harness(),n=seam==='initial'?8:9,key=operationKey(n);if(seam==='initial')await h.manager.begin(h.input);else{await through(h,1);await h.game.entry();if(seam==='continue'){await h.game.confirm();await h.manager.openStaged();await h.game.capture(2).promise;}}
      eq(h.game.c.MKTYOps.isRun(n),true);const value=raw.replace('"n":9','"n":'+n);h.game.disk.set(key,value);const before=h.game.counts(),rows=h.game.logical.length,parse=JSON.parse;let parses=0,originals=0;h.game.hooks.original=()=>originals++;
      JSON.parse=function(text,...args){if(text===value)parses++;return parse(text,...args);};try{if(seam==='initial')h.game.stageInitial();else if(seam==='confirm')await h.game.confirm();else await h.manager.continue();}finally{JSON.parse=parse;}
      state(h,'BLOCKED');eq(parses,0);eq(originals,0);eq(h.game.counts(),before);eq(h.game.logical.length,rows);eq(h.game.disk.get(key),value);
    }
    for(const n of [8,9]){const h=await through(await harness(),n===8?1:2),key=operationKey(n),before=h.game.counts(),rows=h.game.logical.length,value=h.game.disk.get(key);
      h.game.fire(h.game.c,'pagehide',{bubbles:false});state(h,'BLOCKED');const rejected=h.game.rejections.find(row=>row.operation.key===key);ok(rejected);eq(rejected.operation,{op:'set',key,value});eq(h.game.disk.get(key),value);eq(h.game.logical.length,rows);eq(h.game.counts(),before);
      await h.manager.retry();await h.manager.continue();eq(h.game.logical.length,rows);eq(h.game.counts(),before);
    }
  });

  const report={status:failures.length?'failed':'passed',checks,groups,measurements,failures,qualifications:['Synthetic fixed disposable guest fixtures only; no real player, browser, IndexedDB, timing or gameplay claim','Full histories and fixture checkpoints are test diagnostics excluded from production modeled representation slots','Five-phase original closure chain and actual operations entry/read/complete wrappers in index order; operations8/9 core records are already-prepared synthetic prerequisites, not earned gameplay', 'Actual selected risk/epilogue/button/storage functions; fixture completion is injected, not earned','Gate checkpoints replay original fixture actions under pinned legacy/existing precision modifiers and preserve explicit fixture controller seconds; the 911-row proof and precise metadata remain unchanged; not earned gameplay','Capture/bubble routing is a source-VM event shim, not proof of native event defaults, touch, ranges, focus, timing or browser behavior','The main same-day synthetic chain explicitly seeds skip9=yes; default skip=null calendar gating is tested separately','Native Step C remains a separate gate'],sourceHashes:Object.fromEntries(['tests/evidence-phase-session.cjs','tests/fixtures/evidence-phase-session/input-fence.mjs','chapter-space.js','mission-rules.js','operations-art.js','operations.js','field-missions.js','legacy.js','story.js','story-plan.js','app.js','storage.js','pacing.js',...['unsaved-result-gate','adapter','coordinator','phase-budget','phase-writer-contract','prepared-operations','story-rewrite','retired-story-witness','finale-context-v1','finale-phase-v2','context-stream'].map(f=>'prototypes/evidence-indexeddb/'+f+'.mjs')].map(f=>[f,createHash('sha256').update(source(f)).digest('hex')]))};
  if(process.env.MKTY_PHASE_SESSION_REPORT)fs.writeFileSync(process.env.MKTY_PHASE_SESSION_REPORT,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(failures.length)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
