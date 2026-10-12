/* Native Chromium CI regression. No live campaign/reward state, synthetic prerequisites,
 * filled values or dispatched gameplay events. The real index and all shipped modules run.
 * Model coordinates guide the solver; only Tab, Arrow/Home/End, Enter/Space and native touch
 * change gameplay. Run in CI where browser execution is permitted, not a restricted executor. */
'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const fixture=require('./triangulation-browser-fixture.cjs'),reachable=require('./field-control-helper.cjs');
const out=process.env.MKTY_TEST_OUTPUT||fs.mkdtempSync(path.join(os.tmpdir(),'mkty-triangulation-keyboard-ui-'));
fs.mkdirSync(out,{recursive:true});
const report={passed:false,scope:'Real shipped index/controllers/CSS; isolated synthetic Chapter8 task, no campaign unlocks or live backend',cases:[],errors:[]};
let browser,page;
const slider=name=>'#fieldControls [data-field-slider="'+name+'"]';
const snapshot=p=>p.evaluate(()=>MKTYField.snapshot());
const lastFocusTarget=new WeakMap();
async function tabTo(p,selector){
 const focusTrace=[],initialDialog=await p.evaluate(()=>document.querySelector('dialog[open]')?.id||null);
 for(let i=0;i<90;i++){
  const state=await p.evaluate(({selector,previous})=>{
   const target=document.querySelector(selector),active=document.activeElement;
   // dialog.close() may return activeElement to BODY while the browser keeps its
   // sequential focus starting point at the now-hidden Resume button.
   const anchor=active&&active!==document.body?active:previous?document.querySelector(previous):null;
   return {found:!!target,reached:active===target,tag:active?.tagName,id:active?.id,action:active?.dataset?.fieldAction,value:active?.dataset?.value,dialog:document.querySelector('dialog[open]')?.id||null,focused:document.hasFocus(),key:anchor&&target&&(anchor.compareDocumentPosition(target)&Node.DOCUMENT_POSITION_PRECEDING)?'Shift+Tab':'Tab'};
  },{selector,previous:lastFocusTarget.get(p)||null});
  if(i<20)focusTrace.push(state);
  assert(state.found,'native keyboard target exists '+selector);
  assert(state.focused,'native keyboard must not leave the document '+JSON.stringify(focusTrace));
  assert.equal(state.dialog,initialDialog,'native navigation must not reopen a pause dialog '+JSON.stringify(focusTrace));
  if(state.reached){lastFocusTarget.set(p,selector);return p.locator(selector);}
  await p.keyboard.press(state.key);
 }
 throw Error('Native Tab did not reach '+selector+' '+JSON.stringify(focusTrace));
}
async function activate(p,selector,key='Enter'){
 const control=await tabTo(p,selector);await reachable(control,'keyboard '+selector);await p.keyboard.press(key);
}
async function range(p,name,value){
 const selector=slider(name),control=await tabTo(p,selector);await reachable(control,'keyboard range '+name);
 const max=Number(await control.getAttribute('max')),fromEnd=value>max/2;
 await p.keyboard.press(fromEnd?'End':'Home');
 // Use native page increments for long distances; read the browser's actual step,
 // then finish with arrows. No value assignment or assumed PageUp step size.
 let current=Number(await control.inputValue());
 for(let jump=0;jump<12&&Math.abs(value-current)>20;jump++){
  const previous=current;await p.keyboard.press(value>current?'PageUp':'PageDown');current=Number(await control.inputValue());
  if(current===previous||(value-previous)*(value-current)<=0)break;
 }
 const delta=value-current;
 for(let i=0;i<Math.abs(delta);i++)await p.keyboard.press(delta>0?'ArrowRight':'ArrowLeft');
 assert.equal(Number(await control.inputValue()),value,'native key range value '+name);
 assert(await control.evaluate(e=>e===document.activeElement),'range remains focused through every render');
 assert.equal(await p.locator('[data-field-read="'+name+'"]').textContent(),String(value));
 await reachable(control,'range focus after render '+name);
}
async function resume(p){await activate(p,'#fieldResume');assert.equal(await p.locator('#fieldDialog').isVisible(),false);}
async function bearings(p){
 const b=await p.evaluate(()=>FieldRules.layout(MKTYField.snapshot()));
 for(let i=0;i<3;i++){
  await activate(p,'#fieldControls [data-field-action="station"][data-value="'+i+'"]',i===1?'Space':'Enter');
  assert.equal((await snapshot(p)).station,i);
  await range(p,'angle',Math.round(b.bearings[i]));
  await activate(p,'#fieldControls [data-field-action="sample"]',i===1?'Space':'Enter');
  assert.equal((await snapshot(p)).samples[i],true,'bearing locked through native keyboard');
 }
 return b;
}
async function noPointer(p){
 const events=await p.evaluate(()=>__inputEvents);
 assert(!events.some(e=>['pointerdown','touchstart','mousedown'].includes(e.type)),'keyboard completion never uses pointer/touch');
 assert(events.some(e=>e.type==='input'&&e.trusted),'browser generated trusted native range input');
 assert(events.filter(e=>e.type==='keydown'||e.type==='input').every(e=>e.trusted),'no synthetic gameplay keyboard/input');
 return events.length;
}
async function close(f){assert.deepEqual(f.errors,[],'no page exceptions');report.errors.push(...f.errors);await f.context.close();}
async function dragMarkerRanges(f){
 const p=f.page,session=await f.context.newCDPSession(p),gestures=[];
 // Observe defaults after the production document listeners; never cancel or synthesize DOM input.
 await p.evaluate(()=>{window.__markerTouchEvents=[];for(const type of ['touchstart','touchmove','touchend','touchcancel','input','change'])window.addEventListener(type,e=>{if(!['pinX','pinY'].includes(e.target.dataset?.fieldSlider))return;__markerTouchEvents.push({type,name:e.target.dataset.fieldSlider,trusted:e.isTrusted,prevented:e.defaultPrevented,value:Number(e.target.value)});},{passive:true});});
 const scroll=()=>p.evaluate(()=>({app:[document.getElementById('app').scrollLeft,document.getElementById('app').scrollTop],deck:[document.querySelector('#fieldMission .field-deck').scrollLeft,document.querySelector('#fieldMission .field-deck').scrollTop],outer:[scrollX,scrollY,document.documentElement.scrollLeft,document.documentElement.scrollTop,document.body.scrollLeft,document.body.scrollTop]}));
 try{
  for(const name of ['pinX','pinY']){
   const control=await tabTo(p,slider(name));await reachable(control,'native marker drag '+name);
   const initial=Number(await control.inputValue()),max=Number(await control.getAttribute('max'));
   const directions=initial/max>=.5?[.18,.82]:[.82,.18];
   for(const fraction of [...directions,null]){
    const g=await control.evaluate(e=>{const b=e.getBoundingClientRect(),c=getComputedStyle(e),left=b.x+parseFloat(c.borderLeftWidth)+parseFloat(c.paddingLeft),width=b.width-parseFloat(c.borderLeftWidth)-parseFloat(c.borderRightWidth)-parseFloat(c.paddingLeft)-parseFloat(c.paddingRight),min=Number(e.min),max=Number(e.max),value=Number(e.value),x=left+8+(width-16)*(value-min)/(max-min),y=b.y+b.height/2;return{left,width,min,max,value,x,y,direction:c.direction,touchAction:c.touchAction,hit:document.elementFromPoint(x,y)===e};});
    assert(g.hit&&g.width>40,'native marker thumb is unobstructed');assert.equal(g.direction,'ltr');assert.equal(g.touchAction,'none');
    const vertical=fraction===null,end=vertical?{x:g.x,y:g.y+(g.y>100?-55:55)}:{x:g.left+8+(g.width-16)*fraction,y:g.y};
    assert(end.y>0&&end.y<p.viewportSize().height,'bounded native marker touch endpoint');
    const before=await snapshot(p),beforeScroll=await scroll(),eventStart=await p.evaluate(()=>{__markerTouchEvents=[];return __inputEvents.length;}),samples=[];
    const axis=name==='pinX'?'x':'y',other=axis==='x'?'y':'x',points=at=>[{id:1,x:at.x,y:at.y,radiusX:2,radiusY:2,force:1}];
    const check=async()=>{
     const value=Number(await control.inputValue()),state=await snapshot(p);samples.push(value);
     const emitted=await p.evaluate(()=>__markerTouchEvents.filter(e=>e.type==='input').at(-1));
     if(emitted){assert.equal(emitted.name,name);assert.equal(value,emitted.value);assert.equal(state.pin[axis],emitted.value,'native marker input reaches the exact emitted model value');}
     else{assert.equal(value,g.value,'before native input the range stays at its displayed value');assert.equal(state.pin[axis],before.pin[axis],'before native input the exact fractional checkpoint is preserved');}
     assert.equal(state.pin[other],before.pin[other],'native drag preserves exact other axis');
     assert.equal(await p.locator('[data-field-read="'+name+'"]').textContent(),String(value));
     assert.deepEqual(await p.evaluate(()=>JSON.parse(localStorage.getItem('triangulation-fixture-save')).pin),state.pin,'native marker save matches model');
     return value;
    };
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(g)});
    assert(Math.abs(Number(await control.inputValue())-g.value)<=1,'marker drag starts on current thumb');
    for(let step=1;step<=12;step++){
     await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points({x:g.x+(end.x-g.x)*step/12,y:g.y+(end.y-g.y)*step/12})});
     await p.waitForTimeout(20);await check();
    }
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(40);
    const value=await check(),afterScroll=await scroll(),trace=await p.evaluate(()=>__markerTouchEvents.slice()),input=await p.evaluate(start=>__inputEvents.slice(start).filter(e=>e.type==='input'),eventStart);
    assert.deepEqual(afterScroll,beforeScroll,'marker gestures never pan app, deck or document');
    assert(trace.some(e=>e.type==='touchstart')&&trace.some(e=>e.type==='touchmove')&&trace.some(e=>e.type==='touchend'),'full native marker gesture observed');
    assert(trace.every(e=>e.trusted&&!e.prevented),'trusted native marker events retain browser defaults');assert(!trace.some(e=>e.type==='touchcancel'),'marker gesture is not canceled');
    if(vertical)assert(Math.abs(value-g.value)<=1,'vertical gesture preserves marker coordinate');
    else{
     assert(Math.abs(value-(g.min+fraction*(g.max-g.min)))<=Math.max(2,(g.max-g.min)*.06),'native marker thumb reaches intended fraction');
     assert(Math.abs(value-g.value)>=(g.max-g.min)*.20,'native marker drag moves at least20%');
     assert(new Set(trace.filter(e=>e.type==='input').map(e=>e.value)).size>=2&&new Set(samples).size>=2,'marker drag produces multiple distinct native input values');
     assert(input.length>=2&&input.every(e=>e.trusted&&e.slider===name),'existing fixture confirms trusted marker input events');assert(trace.some(e=>e.type==='change'),'native marker drag commits a change');
    }
    gestures.push({name,vertical,from:g.value,to:value,trace,beforeScroll,afterScroll});
   }
  }
 }finally{await session.detach();}
 return gestures;
}
async function lifecycle(f){
 const p=f.page,before=await snapshot(p);
 await activate(p,'#fieldPause');
 await p.keyboard.press('ArrowRight');await p.keyboard.press('Home');await p.clock.runFor(3000);
 assert.deepEqual(await snapshot(p),before,'paused keyboard/time cannot mutate checkpoint');
 await activate(p,'#fieldExit');assert.equal(await p.locator('#fixtureHome').isVisible(),true);
 await activate(p,'#fixtureReopen');assert.deepEqual(await snapshot(p),before,'exit/reentry restores exact pin/bearings/trace');
 await resume(p);await tabTo(p,slider('pinX'));
 assert.equal(Number(await p.locator(slider('pinX')).inputValue()),Math.round(before.pin.x));
 await noPointer(p);await p.reload();await f.open();assert.deepEqual(await snapshot(p),before,'real document reload restores exact pin/bearings/trace');
 await resume(p);await tabTo(p,slider('pinX'));await reachable(p.locator(slider('pinX')),'restored marker focus');
 assert.equal(Number(await p.locator(slider('pinX')).inputValue()),Math.round(before.pin.x));
}
(async()=>{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 // Exact pre-fix controller on the same shipped index: bearings are reachable, the pin is not.
 let f=await fixture(browser,{baseline:true,width:390,height:640});page=f.page;await resume(page);await bearings(page);
 assert.equal(await page.locator(slider('pinX')).count(),0);
 for(let i=0;i<3;i++){
  await tabTo(page,'#fieldWorld [data-field-cell="'+i+'"]');
  await page.keyboard.press(i===1?'Space':'Enter');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowDown');
 }
 assert.equal((await snapshot(page)).pin,null);await activate(page,'#fieldSubmit');
 assert.equal((await snapshot(page)).complete,false);assert.equal((await snapshot(page)).notice,'intersection');
 await noPointer(page);report.cases.push({baseline:'exact captured controller',nativeKeyboardBlocked:true});await close(f);
 for(const spec of [
  {lang:'en',width:390,height:640,lifecycle:true},
  {lang:'en',width:320,height:480},
  {lang:'ru',width:650,height:480},
  {lang:'ar',width:390,height:640},
  {lang:'he',width:320,height:480}
 ]){
  f=await fixture(browser,spec);page=f.page;
  assert.equal((await snapshot(page)).pin,null,'initial coordinate readout does not manufacture a pin');
  for(const name of ['pinX','pinY']){
   assert.equal(await page.locator(slider(name)).getAttribute('aria-describedby'),'fieldMarkerHint');
   assert.equal(await page.locator(slider(name)).getAttribute('dir'),'ltr');
   assert.equal(await page.locator(slider(name)).evaluate(e=>getComputedStyle(e).direction),'ltr');
  }
  assert.equal(await page.locator('html').getAttribute('dir'),['ar','he'].includes(spec.lang)?'rtl':'ltr');
  const locale=await page.evaluate(()=>({lang:MKTYI18n.getLanguage(),x:MKTYI18n.t('MARKER X'),y:MKTYI18n.t('MARKER Y')}));
  assert.equal(locale.lang,spec.lang);assert.equal(await page.locator(slider('pinX')).getAttribute('aria-label'),locale.x);assert.equal(await page.locator(slider('pinY')).getAttribute('aria-label'),locale.y);
  if(spec.lang!=='en'){assert.notEqual(locale.x,'MARKER X');assert.notEqual(locale.y,'MARKER Y');}
  await resume(page);const b=await bearings(page);
  await activate(page,'#fieldSubmit');assert.equal((await snapshot(page)).notice,'intersection','three bearings alone do not complete');
  // Home/End prove full map bounds and physical LTR keyboard direction even in RTL locales.
  await range(page,'pinX',0);assert.deepEqual((await snapshot(page)).pin,{x:0,y:225});
  await page.keyboard.press('End');assert.deepEqual((await snapshot(page)).pin,{x:600,y:225});
  await page.keyboard.press('ArrowLeft');assert.equal((await snapshot(page)).pin.x,599);
  await range(page,'pinX',Math.round(b.source.x));
  if(spec.lifecycle)await lifecycle(f);
  await range(page,'pinY',450);assert.equal((await snapshot(page)).pin.y,450);
  await page.keyboard.press('Home');assert.equal((await snapshot(page)).pin.y,0);
  await page.keyboard.press('ArrowRight');assert.equal((await snapshot(page)).pin.y,1);
  await range(page,'pinY',Math.round(b.source.y));
  const placed=await snapshot(page);assert.deepEqual(placed.pin,{x:Math.round(b.source.x),y:Math.round(b.source.y)});
  assert.equal(await page.evaluate(()=>FieldRules.won(MKTYField.snapshot())),true,'same unmodified victory rule is met');
  await page.screenshot({path:path.join(out,`keyboard-${spec.lang}-${spec.width}x${spec.height}.png`),fullPage:true,animations:'disabled'});
  await activate(page,'#fieldSubmit');const complete=await snapshot(page);assert.equal(complete.complete,true);
  assert(await page.locator(slider('pinX')).isDisabled());assert(await page.locator(slider('pinY')).isDisabled());
  await page.keyboard.press('ArrowRight');await page.keyboard.press('Home');assert.deepEqual(await snapshot(page),complete,'completed checkpoint cannot move');
  await activate(page,'#fieldSubmit');assert.equal(await page.evaluate(()=>__completed.length),1);assert.deepEqual(await page.evaluate(()=>__completed[0]),complete);
  const events=await noPointer(page);report.cases.push({...spec,nativeKeyboardComplete:true,events,pin:complete.pin});await close(f);
 }
 // Real touchscreen map placement, including the existing fractional map coordinates.
 for(const spec of [{lang:'en',width:320,height:480},{lang:'ar',width:390,height:640}]){
  let baselinePin;
  for(const useBaseline of [true,false]){
   let markerDrags;
   f=await fixture(browser,{...spec,baseline:useBaseline});page=f.page;await resume(page);const b=await bearings(page);
   await page.locator('#fieldWorld > svg').scrollIntoViewIfNeeded();
   const point=await page.locator('#fieldWorld > svg').evaluate((svg,source)=>{const p=svg.createSVGPoint();p.x=source.x+.375;p.y=source.y+.625;const at=p.matrixTransform(svg.getScreenCTM());return{x:at.x,y:at.y};},b.source);
   assert(point.x>0&&point.x<spec.width&&point.y>0&&point.y<spec.height,'map intersection visible for native touchscreen');
   await page.touchscreen.tap(point.x,point.y);const touched=await snapshot(page);
   assert(touched.pin,'native touch creates pin');assert(Math.hypot(touched.pin.x-b.source.x,touched.pin.y-b.source.y)<2,'native touch maps to same source coordinates');
   assert(await page.evaluate(()=>FieldRules.won(MKTYField.snapshot())),'native map touch meets the unchanged victory rule before marker drags');
   if(useBaseline)baselinePin=touched.pin;
   else{
    assert.deepEqual(touched.pin,baselinePin,'baseline/candidate native touchscreen has identical coordinate mapping');
    assert(!Number.isInteger(touched.pin.y),'touch case must exercise fractional retained axis');
    assert.equal(Number(await page.locator(slider('pinX')).inputValue()),Math.round(touched.pin.x));
    assert.equal(Number(await page.locator(slider('pinY')).inputValue()),Math.round(touched.pin.y));
    await tabTo(page,slider('pinX'));await reachable(page.locator(slider('pinX')),'touch-to-keyboard marker');
    await page.keyboard.press('ArrowRight');const moved=await snapshot(page);
    assert.equal(moved.pin.x,Math.round(touched.pin.x)+1);assert.equal(moved.pin.y,touched.pin.y,'keyboard retains full fractional other axis');
    markerDrags=await dragMarkerRanges(f);
    await range(page,'pinX',Math.round(b.source.x));await range(page,'pinY',Math.round(b.source.y));
    assert.deepEqual((await snapshot(page)).pin,{x:Math.round(b.source.x),y:Math.round(b.source.y)},'real keyboard restores source after native marker drags');
    await page.screenshot({path:path.join(out,`touch-${spec.lang}-${spec.width}.png`),fullPage:true,animations:'disabled'});
   }
   await activate(page,'#fieldSubmit');assert.equal((await snapshot(page)).complete,true,'native touch pin still meets exact rule');
   report.cases.push({...spec,baseline:useBaseline,nativeMapMeetsWin:true,nativeTouchComplete:useBaseline,pin:touched.pin,...(markerDrags?{markerDrags,mixedInputComplete:true}: {})});await close(f);
  }
 }
 report.passed=true;console.log('PASS: baseline keyboard blocker; real-index native keyboard completion, RTL, 44px/clipping, exact pause/reentry/reload, completed guards, native touch, both-axis native marker drags and fractional-axis preservation');
})().catch(async error=>{report.failure=error.stack;console.error(error);process.exitCode=1;await page?.screenshot({path:path.join(out,'failure.png'),fullPage:true,animations:'disabled',timeout:5000}).catch(()=>{});}).finally(async()=>{fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2));await browser?.close();});
