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
async function tabTo(p,selector){
 const focusTrace=[];
 for(let i=0;i<90;i++){
  if(i<20)focusTrace.push(await p.evaluate(()=>({tag:document.activeElement?.tagName,id:document.activeElement?.id,action:document.activeElement?.dataset?.fieldAction,value:document.activeElement?.dataset?.value,cell:document.activeElement?.dataset?.fieldCell,dialog:document.querySelector('dialog[open]')?.id,focused:document.hasFocus()})));
  if(await p.evaluate(s=>document.activeElement?.matches(s),selector))return p.locator(selector);
  await p.keyboard.press('Tab');
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
   f=await fixture(browser,{...spec,baseline:useBaseline});page=f.page;await resume(page);const b=await bearings(page);
   await page.locator('#fieldWorld svg').scrollIntoViewIfNeeded();
   const point=await page.locator('#fieldWorld svg').evaluate((svg,source)=>{const p=svg.createSVGPoint();p.x=source.x+.375;p.y=source.y+.625;const at=p.matrixTransform(svg.getScreenCTM());return{x:at.x,y:at.y};},b.source);
   assert(point.x>0&&point.x<spec.width&&point.y>0&&point.y<spec.height,'map intersection visible for native touchscreen');
   await page.touchscreen.tap(point.x,point.y);const touched=await snapshot(page);
   assert(touched.pin,'native touch creates pin');assert(Math.hypot(touched.pin.x-b.source.x,touched.pin.y-b.source.y)<2,'native touch maps to same source coordinates');
   if(useBaseline)baselinePin=touched.pin;
   else{
    assert.deepEqual(touched.pin,baselinePin,'baseline/candidate native touchscreen has identical coordinate mapping');
    assert(!Number.isInteger(touched.pin.y),'touch case must exercise fractional retained axis');
    assert.equal(Number(await page.locator(slider('pinX')).inputValue()),Math.round(touched.pin.x));
    assert.equal(Number(await page.locator(slider('pinY')).inputValue()),Math.round(touched.pin.y));
    await tabTo(page,slider('pinX'));await reachable(page.locator(slider('pinX')),'touch-to-keyboard marker');
    await page.keyboard.press('ArrowRight');const moved=await snapshot(page);
    assert.equal(moved.pin.x,Math.round(touched.pin.x)+1);assert.equal(moved.pin.y,touched.pin.y,'keyboard retains full fractional other axis');
    await page.screenshot({path:path.join(out,`touch-${spec.lang}-${spec.width}.png`),fullPage:true,animations:'disabled'});
   }
   await activate(page,'#fieldSubmit');assert.equal((await snapshot(page)).complete,true,'native touch pin still meets exact rule');
   report.cases.push({...spec,baseline:useBaseline,nativeTouchComplete:true,pin:touched.pin});await close(f);
  }
 }
 report.passed=true;console.log('PASS: baseline keyboard blocker; real-index native keyboard completion, RTL, 44px/clipping, exact pause/reentry/reload, completed guards, native touch and fractional-axis preservation');
})().catch(async error=>{report.failure=error.stack;console.error(error);process.exitCode=1;await page?.screenshot({path:path.join(out,'failure.png'),fullPage:true,animations:'disabled',timeout:5000}).catch(()=>{});}).finally(async()=>{fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2));await browser?.close();});
