/* Socket-free integration of the production cinematic, navigation, chapter router and pace dialog.
   Storage starts at a completed-chapter boundary; this does not claim an eight-stage playthrough.
   Native dialog/focus behavior is separately covered by locked-intro-browser.cjs in browser CI. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),app=fs.readFileSync(path.join(root,'app.js'),'utf8'),P=require('../story-plan.js');
function section(source,start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert(a>=0&&b>a,'production section: '+start);return source.slice(a,b);}
const entry=[null,'openMission','openMission2','openLife3MemoryGate','openMission4','openMission5','openMission6','openMission7','openMission8','openMission9'];
const epoch=Date.parse('2026-10-11T15:00:00Z'),midnight=Date.parse('2026-10-12T00:00:00Z');
function harness({n=2,locked=true,lives=9,completed=false,skipResult={ok:false}}={}){
 let now=epoch,timerId=0,invites=0,legacyOpens=0;const timers=new Map(),elements=new Map(),calls=[],screens=[],writes=[];
 const data=new Map([['mkty_lang','en'],['mkty_global_lives',String(lives)],['mkty_points','500'],['mkty_life1_memory_code','1234567890'],['mkty_life1_code_presented','yes'],['mkty_life1_code_remaining_ms','0']]);
 for(let i=1;i<n;i++){data.set('mkty_life'+i,'complete');data.set('mkty_life'+i+'_completed_at',String(locked?epoch:epoch-86400000));data.set('mkty_life'+i+'_awarded','yes');}
 if(lives<9)data.set('mkty_life_restore_at',String(epoch));if(completed)data.set('mkty_life'+n,'complete');
 const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>{writes.push([k,String(v)]);data.set(k,String(v));},removeItem:k=>{writes.push([k,null]);data.delete(k);}};
 class Events{
  constructor(){this.listeners=new Map();}
  addEventListener(type,fn){const set=this.listeners.get(type)||new Set();set.add(fn);this.listeners.set(type,set);}
  removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}
  fire(type){const e={type,target:this,preventDefault(){this.defaultPrevented=true;}};for(const fn of [...(this.listeners.get(type)||[])])fn(e);return e;}
 }
 class Element extends Events{
  constructor(id=''){super();this.id=id;this.dataset={};this.attributes={};this.children=[];this.style={setProperty(){}};this.classes=new Set();this.hidden=false;this.paused=true;this.loads=0;this.scrolls=0;this.classList={contains:x=>this.classes.has(x),add:x=>this.classes.add(x),remove:x=>this.classes.delete(x),toggle:(x,on)=>on?this.classes.add(x):this.classes.delete(x)};}
  set className(value){this.classes=new Set(value.split(' ').filter(Boolean));}get className(){return [...this.classes].join(' ');}
  set innerHTML(value){this.html=value;for(const m of value.matchAll(/id="([^"]+)"/g))get(m[1]);this.mapNodes=[...value.matchAll(/data-map-step="(\d+)"/g)].map(m=>{const el=new Element();el.dataset.mapStep=m[1];return el;});}get innerHTML(){return this.html||'';}
  append(...nodes){this.children.push(...nodes);for(const node of nodes){node.isConnected=true;if(node.id)elements.set(node.id,node);}}appendChild(node){this.append(node);}replaceChildren(...nodes){this.children=nodes;}before(node){if(node){node.isConnected=true;if(node.id)elements.set(node.id,node);}}
  setAttribute(k,v){this.attributes[k]=String(v);}getAttribute(k){return this.attributes[k];}removeAttribute(k){delete this.attributes[k];}compareDocumentPosition(){return 0;}querySelectorAll(){return this.mapNodes||[];}querySelector(){return null;}
  showModal(){this.open=true;}close(){this.open=false;}focus(){document.activeElement=this;}scrollIntoView(){this.scrolls++;}click(){if(!this.disabled)return this.onclick?.();}
  play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}load(){this.loads++;}
 }
 const get=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);};
 for(const id of ['home','chapters',...Array.from({length:9},(_,i)=>'life'+(i+1)),...Array.from({length:9},(_,i)=>'mission'+(i+1))])get(id).classes.add('screen');
 get('home').classes.add('active');for(let i=1;i<=9;i++){get('mission'+i).classes.add('mission-screen');get('life'+i+'Video');get(i===1?'skipBtn':'life'+i+'SkipBtn');}
 const document=Object.assign(new Events(),{body:get('body'),documentElement:get('html'),hidden:false,getElementById:get,createElement:()=>new Element(),
  querySelector:s=>s==='.screen.active'?[...elements.values()].find(e=>e.classes.has('screen')&&e.classes.has('active')):s==='dialog[open]'?[...elements.values()].find(e=>e.open):null,
  querySelectorAll:s=>s==='.screen'?[...elements.values()].filter(e=>e.classes.has('screen')):s==='.mission-screen.active'?[...elements.values()].filter(e=>e.classes.has('mission-screen')&&e.classes.has('active')):[]});
 const schedule=(fn,delay,repeat)=>{const id=++timerId;timers.set(id,{fn,delay,repeat,at:now+delay});return id;};
 class ClockDate extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
 const context={document,localStorage:storage,$:get,Date:ClockDate,performance:{now:()=>now-epoch},console,StoryPlan:P,crypto:require('node:crypto').webcrypto,Node:{DOCUMENT_POSITION_FOLLOWING:4},
  MutationObserver:class{observe(){}},MouseEvent:class{},queueMicrotask(){},setInterval:(fn,delay)=>schedule(fn,delay,true),setTimeout:(fn,delay)=>schedule(fn,delay,false),clearInterval:id=>timers.delete(id),clearTimeout:id=>timers.delete(id),
  requestAnimationFrame(){return 0;},cancelAnimationFrame(){},leaveMission(){},refreshLife1Geometry(){},life1MoveLoop(){},l1LastFrame:0,l1MoveFrame:0,remainingLife1CodeTime:()=>0,scrollTo(){},URL,Blob,
  MKTYStorage:{persistent:true},MKTYCampaign:{save(){},render(){},onScreen(id){screens.push(id);}},FieldArt:{map:(_n,steps)=>steps.map(t=>`<g data-map-step="${t.id}"></g>`).join('')},
  MKTYGrowth:{openInvite(){invites++;}},MKTYRewards:{call:async(action,payload)=>{calls.push({action,payload});return skipResult;}}};
 context.window=context;vm.createContext(context);
 // Original finale functions are peripheral adapters; all navigation/gating under test is production.
 for(let i=1;i<=9;i++)context[entry[i]]=()=>{legacyOpens++;context.show('mission'+i);};
 vm.runInContext('let activeCinematic=null;\n'+section(app,'function show(id){','function openMission(){')+'\n'+section(app,'function playLifeCinematic(n,onDone){','function startLife3(){')+'\n'+section(app,'const MKTY_MAX_LIVES=','function spendGlobalLife(eventKey){'),context,{filename:'app-controller-sections.js'});
 for(const file of ['pacing.js','story.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
 const run=code=>vm.runInContext(code,context),active=()=>document.querySelector('.screen.active')?.id;
 const advance=ms=>{const end=now+ms;for(;;){let next=null;for(const [id,timer]of timers)if(timer.at<=end&&(!next||timer.at<next.timer.at))next={id,timer};if(!next)break;now=next.timer.at;if(next.timer.repeat)next.timer.at+=next.timer.delay;else timers.delete(next.id);next.timer.fn();}now=end;};
 const enter=(chapter=n)=>context.playLifeCinematic(chapter,context[entry[chapter]]),skip=(chapter=n)=>get(chapter===1?'skipBtn':'life'+chapter+'SkipBtn').click();
 return {data,writes,storage,context,get,run,document,active,advance,enter,skip,calls,screens,timers,invites:()=>invites,legacyOpens:()=>legacyOpens,
  snapshot:()=>JSON.stringify([...data].sort()),open:(chapter=n)=>context[entry[chapter]](),setNow:t=>{const delta=t-now;for(const timer of timers.values())timer.at+=delta;now=t;},hidden:value=>{document.hidden=value;document.fire('visibilitychange');}};
}
function gated(h,kind='chapter',n=2){
 assert.equal(h.active(),'chapters','a refused completed cinematic returns to usable Chapters');
 assert.equal(h.get('paceDialog').open,true,'existing pace modal stays open');
 assert.match(h.get('paceTitle').textContent,kind==='chapter'?/Next chapter in/:/Out of lives/);
 assert.equal(h.run('activeCinematic'),null);assert.equal(h.get(n===1?'skipBtn':'life'+n+'SkipBtn').onclick,null);
 assert.equal(h.get('life'+n+'Video').paused,true);assert.equal(h.get('life'+n+'Video').listeners.get('ended').size,0);
 assert.equal(h.get('life'+n+'Video').listeners.get('error').size,0);
 assert.equal(h.storage.getItem('mkty_story_plan_'+n+'_v1'),null,'gate does not start a route');
}
(async()=>{
 // First assertion intentionally fails against the release baseline (active screen is life2).
 let h=harness();const before=h.snapshot();h.enter();assert.equal(h.active(),'life2');h.skip();gated(h);h.get('paceCancel').click();assert.equal(h.get('paceDialog').open,false);assert.equal(h.active(),'chapters');assert.equal(h.snapshot(),before,'blocked entry preserves all player data');
 // All cinematic chapters use the same safe return, for Skip, video completion/error and watchdog.
 for(let n=2;n<=9;n++)for(const finish of ['skip','ended','error','watchdog']){
  h=harness({n});const original=h.snapshot();h.enter();const stale=h.get('life'+n+'SkipBtn').onclick;
  if(finish==='skip')h.skip();else if(finish==='watchdog')h.advance(n===2?10000:20000);else h.get('life'+n+'Video').fire(finish);
  gated(h,'chapter',n);stale();h.skip();h.get('life'+n+'Video').fire('ended');h.advance(25000);assert.equal(h.active(),'chapters','late/repeated finish cannot reactivate intro');assert.equal(h.snapshot(),original);
  const e=h.get('paceDialog').fire('cancel');assert.equal(e.defaultPrevented,true);assert.equal(h.get('paceDialog').open,false);assert.equal(h.active(),'chapters');h.context.show('home');assert.equal(h.active(),'home');
 }
 for(const dismiss of ['paceCancel','escape','paceGo','paceInvite']){
  h=harness();h.enter();h.skip();const original=h.snapshot();if(dismiss==='escape')h.get('paceDialog').fire('cancel');else h.get(dismiss).click();h.advance(60);
  assert.equal(h.get('paceDialog').open,false);assert.equal(h.active(),dismiss==='paceGo'?'home':'chapters');assert.equal(h.invites(),Number(dismiss==='paceInvite'));assert.equal(h.get('dailyOps').scrolls,Number(dismiss==='paceGo'));assert.equal(h.snapshot(),original);
 }
 // The clock closes the modal at midnight; it must reveal a live destination, not a dead intro.
 h=harness();h.enter();h.skip();h.setNow(midnight-1000);h.advance(2000);assert.equal(h.context.MKTYPace.lockedUntil(2),0);assert.equal(h.get('paceDialog').open,false);assert.equal(h.active(),'chapters');h.open();assert.equal(h.active(),'storyPlan');assert(h.context.MKTYStory.read(2));
 // No-lives gate and automatic 12-hour restoration keep the same pacing/life rules.
 for(const dismiss of ['paceCancel','escape','paceGo'])for(let n=2;n<=9;n++){
  h=harness({n,locked:false,lives:0});const original=h.snapshot();h.enter();h.skip();gated(h,'lives',n);if(dismiss==='escape')h.get('paceDialog').fire('cancel');else h.get(dismiss).click();assert.equal(h.active(),dismiss==='paceGo'?'home':'chapters');assert.equal(h.snapshot(),original);assert.equal(h.context.getLifeBank(),0);
 }
 h=harness({locked:false,lives:0});h.enter();h.skip();h.setNow(epoch+12*3600000-1000);h.advance(2000);assert.equal(h.get('paceDialog').open,false);assert.equal(h.active(),'chapters');assert.equal(h.context.getLifeBank(),1);h.open();assert.equal(h.active(),'storyPlan');
 // Referral response is mocked at the transport boundary, never by replacing the gate or dialog.
 for(const ok of [false,true]){
  h=harness({skipResult:{ok}});h.context.MKTYPace.setServer({next_life:2,unlock_at:new Date(midnight).toISOString(),skips:1,locked:true});h.enter();h.skip();gated(h);assert.equal(h.get('paceSkip').hidden,false);await h.get('paceSkip').click();
  assert.deepEqual(JSON.parse(JSON.stringify(h.calls)),[{action:'chapter.skip',payload:{life:2}}]);assert.equal(h.get('paceSkip').disabled,false);assert.equal(h.active(),'chapters');assert.equal(h.get('paceDialog').open,!ok);assert.equal(h.context.MKTYPace.lockedUntil(2),ok?0:midnight);assert.equal(h.context.getLifeBank(),9);
  if(ok){h.open();assert.equal(h.active(),'storyPlan');}else{h.get('paceCancel').click();assert.equal(h.storage.getItem('mkty_pace_skip_2'),null);}
 }
 // Unlocked chapters still open their intended plan; Chapter 3 retains its memory-code gate.
 for(let n=1;n<=9;n++){
  h=harness({n,locked:false,lives:n===1?0:9});h.enter();h.skip();assert.equal(h.get('paceDialog').open,undefined);assert.equal(h.active(),n===3?'mission3':'storyPlan');assert.equal(h.legacyOpens(),Number(n===3));assert.equal(h.context.getLifeBank(),n===1?0:9);
 }
 h=harness({n:3,locked:false});h.storage.setItem('mkty_life3_memory_verified','yes');h.enter();h.skip();assert.equal(h.active(),'storyPlan');
 h=harness({completed:true,lives:0});h.enter();h.skip();assert.equal(h.active(),'storyPlan','completed chapters retain free replay access');
 // Existing direct callers keep their current navigable screen when refused.
 for(const id of ['home','chapters','mission1','storyPlan','life3']){
  h=harness();h.context.show(id);const original=h.snapshot();h.open();assert.equal(h.active(),id,'refused nonmatching caller is not redirected: '+id);h.get('paceCancel').click();assert.equal(h.active(),id);assert.equal(h.snapshot(),original);
 }
 h=harness({n:3});h.storage.removeItem('mkty_life2');h.enter();h.skip();assert.equal(h.active(),'chapters','missing prerequisite retains existing Chapters return');assert.equal(h.get('paceDialog').open,undefined);
 // Leaving and restarting an intro cannot let stale handlers or timers commandeer navigation.
 h=harness();h.enter();const old=h.get('life2SkipBtn').onclick,loads=h.get('life2Video').loads;h.enter();assert.equal(h.get('life2SkipBtn').onclick,old,'same intro start is idempotent');h.context.show('home');old();h.get('life2Video').fire('error');h.advance(25000);assert.equal(h.active(),'home');assert.equal(h.get('paceDialog').open,undefined);assert.equal(h.get('life2Video').loads,loads+1);
 h.enter();const fresh=h.get('life2SkipBtn').onclick;old();assert.equal(h.active(),'life2');assert.equal(h.get('life2SkipBtn').onclick,fresh);h.skip();gated(h);h.get('paceCancel').click();h.enter();h.skip();gated(h);assert.equal(h.document.listeners.get('visibilitychange').size,1,'only the permanent pacing visibility listener remains');
 h=harness();h.enter();h.advance(3000);h.hidden(true);h.advance(60000);assert.equal(h.active(),'life2','hidden time does not finish intro');h.hidden(false);h.advance(6750);assert.equal(h.active(),'life2');h.advance(250);gated(h);
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');assert.match(html,/story\.js\?v=20261011-locked-intro-1/,'changed controller has a fresh cache pin');
 console.log('PASS: real cinematic/story/pace controllers, 8 chapters x 4 finish paths, Cancel/Escape/Daily/Invite/referral, UTC unlock, zero lives/restoration, unlocked/code gate/tutorial/replay, preserved storage and navigation/repeat/hidden lifecycle');
})().catch(error=>{console.error(error);process.exitCode=1;});
