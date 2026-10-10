/* Bounded, network-free execution of the real loader, module and full controller.
   DOM mutation/focus and clocks are recorded; physical browser coverage is separate. */
'use strict';
const assert=require('node:assert/strict'),{fixture,source,R}=require('./field-art-module-helper.cjs');
const MARK='data-renderer="launch-window-rebuilt-v1"',checks=[];
const check=(name,fn)=>Promise.resolve().then(fn).then(()=>checks.push(name));
const board=f=>f.nodes.get('fieldWorld').innerHTML;
function unchangedExceptBoard(f,before,cursor,label,expected=0){assert.equal(f.observable(),before,label+' state, saves, trace, actions, input release, focus, controls and dialog unchanged');const writes=f.writes.slice(cursor);assert(writes.every(w=>w.id==='fieldWorld'),label+' only the board may change');assert.equal(writes.length,expected,label+' exact board repaint count');}
(async()=>{
 await check('numeric manifest IDs; fixed loader-relative same-origin URL; no eager requests',async()=>{
  const f=fixture();assert.equal(f.scripts.length,0);
  for(const n of ['3','trajectory','../trajectory',null,undefined,NaN,Infinity,3.5,0,1,2,11,{},[3]])assert.equal(await f.art.prepareScene(n),false);
  assert.equal(f.scripts.length,0);assert.equal(f.register(()=>'<svg ></svg>',{script:{},n:3}),false,'unrequested registration rejected');
  const a=f.art.prepareScene(3),b=f.art.prepareScene(3);assert.equal(a,b,'in-flight work is shared');assert.equal(f.scripts.length,1);assert.equal(f.scripts[0].src,'https://preview.example/game/art-scenes/trajectory.js?v=20261010-flight-1');assert.equal(f.scripts[0].async,true);assert.equal(f.modules.status(3),'loading');assert.equal([...f.timers.values()][0].ms,5000);
  f.load();assert.equal(await a,true);assert.equal(await b,true);assert.equal(f.modules.status(3),'ready');assert(f.art.scene(R.create(3,0,401),3).includes(MARK),'actual trajectory module loaded');assert.equal(await f.art.prepareScene(3),true);assert.equal(f.scripts.length,1);assert.equal(f.timers.size,0);
  const foreign=fixture({loaderURL:'https://elsewhere.example/field-art-loader.js'});assert.equal(await foreign.art.prepareScene(3),false);assert.equal(foreign.scripts.length,0,'cannot load a foreign-origin module');
  for(const key of ['map','background','palettes','sprite'])assert.equal(f.art[key],f.core[key],key+' public core helper remains untouched');
 });
 await check('script identity and version validation; registration stages until load; duplicate cannot replace',async()=>{
  const f=fixture(),state=R.create(3,0,401),old=f.art.scene(state,3),p=f.art.prepareScene(3),script=f.scripts[0];
  for(const options of [{script:{src:script.src}},{script:null},{api:2},{api:'1'},{version:'wrong'},{n:'3'},{n:4}])assert.equal(f.register(()=>'<svg data-test="bad"></svg>',options),false);
  assert.equal(f.register(null),false);let got;
  assert.equal(f.register((s,b,h,ch)=>{got={s,b,h,ch};return '<svg data-test="first"></svg>';}),true);
  assert.equal(f.art.scene(state,3),old,'before onload keeps synchronous fallback');assert.equal(f.register(()=>'<svg data-test="duplicate"></svg>'),false);script.onload();assert.equal(await p,true);
  for(const chapter of [0,3,9]){assert.equal(f.art.scene(state,chapter),'<svg data-test="first"></svg>');assert.equal(got.s,state);assert.equal(got.ch,chapter);assert.equal(JSON.stringify(got.b),JSON.stringify(R.layout(state)));}
  assert.deepEqual(Object.keys(got.h).sort(),['FieldRules','escape','localize']);assert.deepEqual(Object.keys(got.h.FieldRules).sort(),['condition','flightPoint','footprint']);assert(Object.isFrozen(got.h)&&Object.isFrozen(got.h.FieldRules));assert.equal(got.h.FieldRules.flightPoint,R.flightPoint);assert.equal(got.h.escape('<a&"\''),'&lt;a&amp;&quot;&#39;');
  assert(Object.isFrozen(f.modules));assert.equal(f.register(()=>'<svg data-test="late"></svg>'),false);script.onload();script.onerror();assert.equal(f.modules.status(3),'ready');assert.equal(f.art.scene(state,3),'<svg data-test="first"></svg>');
 });
 await check('offline failure retries only on explicit request; two-attempt bound',async()=>{
  const f=fixture(),a=f.art.prepareScene(3);f.scripts[0].onerror();assert.equal(await a,false);assert.equal(f.modules.status(3),'failed');for(let i=0;i<4;i++)f.art.scene(R.create(3,0,401),3);assert.equal(f.scripts.length,1,'ordinary fallback render never retries');
  const b=f.art.prepareScene(3);assert.equal(f.scripts.length,2);f.load();assert.equal(await b,true);assert(f.art.scene(R.create(3,0,401),3).includes(MARK));
  const dead=fixture();for(let i=0;i<2;i++){const p=dead.art.prepareScene(3);dead.scripts.at(-1).onerror();assert.equal(await p,false);}assert.equal(await dead.art.prepareScene(3),false);assert.equal(dead.scripts.length,2);
 });
 await check('timeout and stale script cannot register or complete a newer attempt',async()=>{
  const f=fixture(),a=f.art.prepareScene(3),old=f.scripts[0];f.timeout();assert.equal(await a,false);const b=f.art.prepareScene(3),live=f.scripts[1];
  f.run('art-scenes/trajectory.js',old);old.onload();old.onerror();assert.equal(f.modules.status(3),'loading');assert.equal(f.register(()=>'<svg data-old="yes"></svg>',{script:old}),false);f.load(live);assert.equal(await b,true);assert(f.art.scene(R.create(3,0,401),3).includes(MARK));
  const staged=fixture(),p=staged.art.prepareScene(3),script=staged.scripts[0];staged.run('art-scenes/trajectory.js',script);staged.timeout();assert.equal(await p,false);script.onload();assert.equal(staged.modules.status(3),'failed');assert(!staged.art.scene(R.create(3,0,401),3).includes(MARK),'register-before-timeout cannot install after late onload');
 });
 await check('wrong API/version or empty script fails closed; real retry recovers',async()=>{
  for(const invalid of [{api:0},{version:'future'}]){const f=fixture(),p=f.art.prepareScene(3);assert.equal(f.register(()=>'<svg ></svg>',invalid),false);f.scripts[0].onload();assert.equal(await p,false);const retry=f.art.prepareScene(3);f.load();assert.equal(await retry,true);}
  const f=fixture(),p=f.art.prepareScene(3);f.scripts[0].onload();assert.equal(await p,false);
 });
 await check('throwing and invalid renderers disable after one call and use exact core fallback',async()=>{
  for(const value of [undefined,null,{},42,'','<div></div>','<svg broken',new Error('renderer failure')]){const f=fixture(),s=R.create(3,1,29),expected=f.core.scene(s,3),p=f.art.prepareScene(3);let calls=0;f.register(()=>{calls++;if(value instanceof Error)throw value;return value;});f.scripts[0].onload();assert.equal(await p,true);for(let i=0;i<5;i++)assert.equal(f.art.scene(s,3),expected);assert.equal(calls,1);assert.equal(f.modules.status(3),'disabled');assert.equal(await f.art.prepareScene(3),false);assert.equal(f.scripts.length,1);}
 });
 await check('actual controller opens synchronously; delayed load repaints only board behind pause',async()=>{
  const f=fixture({controller:true}),plain=fixture({controller:true,loader:false});f.field.open(f.task());plain.field.open(plain.task());assert.equal(f.observable(),plain.observable(),'same synchronous gameplay/save/pause sequence without module');assert.equal(f.nodes.get('fieldDialog').open,true);assert(!board(f).includes(MARK));
  const angle=f.nodes.get('slider:angle');angle.focus();angle.value='53';const before=f.observable(),cursor=f.writes.length;f.load();await f.settle();unchangedExceptBoard(f,before,cursor,'paused readiness',1);assert.equal(f.nodes.get('slider:angle'),angle);assert.equal(angle.value,'53');assert(board(f).includes(MARK));
  const after=f.observable(),at=f.writes.length;f.scripts[0].onload();f.scripts[0].onerror();await f.settle();unchangedExceptBoard(f,after,at,'duplicate completion',0);
 });
 await check('after Resume no asynchronous repaint; next real slider action uses loaded module',async()=>{
  const f=fixture({controller:true});f.field.open(f.task());f.nodes.get('fieldResume').onclick();const angle=f.nodes.get('slider:angle');angle.focus();angle.value='53';const before=f.observable(),cursor=f.writes.length;f.load();await f.settle();unchangedExceptBoard(f,before,cursor,'active readiness',0);assert(!board(f).includes(MARK));assert.equal(angle.value,'53');
  const expected=f.snap();expected.trace.push(['act','angle',53]);R.act(expected,'angle',53);f.input('angle',53);assert.deepEqual(f.snap(),expected);assert(board(f).includes(MARK));assert.equal(f.nodes.get('slider:angle'),angle,'slider is not replaced by normal range updates');
 });
 await check('rapid exit, same-mechanic reentry and reset only repaint newest paused state',async()=>{
  for(const reset of [false,true]){const f=fixture({controller:true});const t=f.task();f.field.open(t);if(!reset)f.nodes.get('fieldExit').onclick();f.field.open(reset?t:f.task({seed:777,id:1}));assert.equal(f.scripts.length,1,'reentry shares module request');const before=f.observable(),cursor=f.writes.length;f.load();await f.settle();unchangedExceptBoard(f,before,cursor,reset?'reset':'reentry',1);assert(board(f).includes(MARK));}
 });
 await check('exit, hidden screen, closed dialog and other mechanism reject stale completion',async()=>{
  for(const kind of ['exit','hidden','dialog','other']){const f=fixture({controller:true});f.field.open(f.task());if(kind==='exit')f.nodes.get('fieldExit').onclick();if(kind==='hidden'){f.context.show('chapters');f.field.onScreen('chapters');}if(kind==='dialog')f.nodes.get('fieldDialog').close();if(kind==='other')f.field.open(f.task({chapter:4,mechanic:4}));const before=f.observable(),cursor=f.writes.length;f.load();await f.settle();unchangedExceptBoard(f,before,cursor,kind,0);assert(!board(f).includes(MARK));}
 });
 await check('offline controller continues playing; reopening recovers without action/save side effects',async()=>{
  const f=fixture({controller:true});f.field.open(f.task());let before=f.observable(),cursor=f.writes.length;f.scripts[0].onerror();await f.settle();unchangedExceptBoard(f,before,cursor,'offline failure',0);f.nodes.get('fieldResume').onclick();f.input('angle',52);assert.equal(f.snap().angle,52);f.nodes.get('fieldPause').onclick();f.nodes.get('fieldExit').onclick();f.field.open(f.task(),f.saves.at(-1));assert.equal(f.scripts.length,2);before=f.observable();cursor=f.writes.length;f.load();await f.settle();unchangedExceptBoard(f,before,cursor,'recovery',1);assert(board(f).includes(MARK));
 });
 await check('optional setup failures never escape actual controller open or change fallback saves',async()=>{
  for(const failure of ['throw','rejection','script-construction']){
   const f=fixture({controller:true}),plain=fixture({controller:true,loader:false});
   if(failure==='throw')f.art.prepareScene=()=>{throw new Error('optional setup blocked');};
   if(failure==='rejection')f.art.prepareScene=()=>Promise.reject(new Error('optional setup rejected'));
   if(failure==='script-construction'){const create=f.context.document.createElement;f.context.document.createElement=tag=>{if(tag==='script')throw new Error('script construction blocked');return create(tag);};}
   assert.doesNotThrow(()=>f.field.open(f.task()),failure+' must not escape open');plain.field.open(plain.task());await f.settle();assert.equal(f.observable(),plain.observable(),failure+' matches fallback open state, saves and pause');assert.equal(f.scripts.length,0);
   f.nodes.get('fieldResume').onclick();plain.nodes.get('fieldResume').onclick();f.input('angle',51);plain.input('angle',51);assert.equal(f.observable(),plain.observable(),failure+' preserves actual playable controller');
   if(failure==='script-construction'){assert.equal(f.modules.status(3),'failed');assert.equal(await f.art.prepareScene(3),false);assert.equal(await f.art.prepareScene(3),false);}
  }
 });
 await check('stale Chapter 3 completion preserves held Chapter 6 steering',async()=>{
  const f=fixture({controller:true});f.field.open(f.task());f.field.open(f.task({chapter:6,mechanic:6}));f.nodes.get('fieldResume').onclick();f.fire('keydown',{code:'ArrowRight'});const before=f.observable(),cursor=f.writes.length;f.load();await f.settle();unchangedExceptBoard(f,before,cursor,'docking input',0);[...f.frames.values()].at(-1)(100);[...f.frames.values()].at(-1)(140);assert(f.snap().trace.some(t=>t[0]==='tick'&&t[2]===1),'held input still drives the actual tick controller');
 });
 assert(!/\b(?:eval|Function|localStorage|sessionStorage|fetch|XMLHttpRequest)\b/.test(source('field-art-loader.js')),'loader contains no evaluation, persistence, or dynamic network API');
 console.log(JSON.stringify({checks:checks.length,coverage:checks,actualScripts:['field-art.js','field-art-loader.js','art-scenes/trajectory.js','field-missions.js'],browserCoverage:false,networkRequests:0},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
