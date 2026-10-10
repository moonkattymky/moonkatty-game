// One failure = exactly one life, in the browser fallback and the Telegram/server path. Also: ch3/ch5 have reachable 44px controls in their 568×320 scrollable decks.
const assertFieldControlReachable=require('./field-control-helper.cjs');
// Reset test setup through the normal input event; Playwright fill does not support range inputs.
const resetRange=(control,value)=>control.evaluate((e,value)=>{e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));},value);
const {chromium}=require('playwright'),assert=require('assert/strict'),fs=require('fs'),path=require('path'),http=require('http');
const root=path.resolve(__dirname,'..'),types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png'};
const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://a').pathname,f=path.join(root,u==='/'?'index.html':u);fs.readFile(f,(e,b)=>{if(e){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream'});res.end(b);});});
(async()=>{await new Promise(r=>server.listen(0,r));const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});const errors=[];
 const page=async()=>{const p=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});p.on('pageerror',e=>errors.push(e.message));await p.goto('http://localhost:'+server.address().port+'/');await p.evaluate(()=>{localStorage.clear();localStorage.setItem('mkty_life1','complete');localStorage.setItem('mkty_global_lives','9');});await p.reload();await p.waitForTimeout(400);return p;};
 // Browser fallback (no Telegram initData): local deduction only.
 let p=await page();assert.equal(await p.evaluate(()=>getLifeBank()),9);
 await p.evaluate(()=>MKTYPace.fail(5,'phase','test:a'));await p.waitForTimeout(300);assert.equal(await p.evaluate(()=>getLifeBank()),8,'browser: one failure = one life');
 await p.evaluate(()=>MKTYPace.fail(5,'phase','test:a'));await p.waitForTimeout(300);assert.equal(await p.evaluate(()=>getLifeBank()),8,'duplicate key is free');
 await p.evaluate(()=>MKTYPace.fail(5,'phase','test:b'));await p.waitForTimeout(300);assert.equal(await p.evaluate(()=>getLifeBank()),7);
 assert.deepEqual(await p.evaluate(()=>MKTYRewards.spendLife('x').then(r=>({ok:r.ok,lives:r.lives}))),{ok:true,lives:undefined},'fallback never deducts again');assert.equal(await p.evaluate(()=>getLifeBank()),7);
 // Telegram path: the server is authoritative and also deducts exactly once.
 p=await page();await p.evaluate(()=>{let server=9;MKTYRewards.spendLife=async()=>{server--;return {ok:true,source:'server',lives:server};};});
 await p.evaluate(()=>MKTYPace.fail(6,'phase','tg:a'));await p.waitForTimeout(300);assert.equal(await p.evaluate(()=>getLifeBank()),8,'telegram: one failure = one life');
 await p.evaluate(()=>MKTYPace.fail(6,'phase','tg:b'));await p.waitForTimeout(300);assert.equal(await p.evaluate(()=>getLifeBank()),7);
 // Compact decks scroll independently: every full-size regulator must be reachable
 // by keyboard and touch, never clipped or covered by the fixed action footer.
 await p.setViewportSize({width:568,height:320});
 for(const lang of ['ru','de','ar','en'])for(const n of [3,5]){await p.evaluate(({n,lang})=>{setLang(lang);MKTYField.open({chapter:n,id:2,fieldStage:2,seed:901,title:['Проверка','Review'],save:()=>{},complete:()=>{},exit:()=>{}},null);},{n,lang});await p.locator('#fieldResume').click();await p.waitForTimeout(150);
  const layout=await p.evaluate(()=>{const m=document.getElementById('fieldMission'),deck=m.querySelector('.field-deck'),footer=m.querySelector('.field-footer').getBoundingClientRect(),world=document.getElementById('fieldWorld').getBoundingClientRect();return {sh:m.scrollHeight,ch:m.clientHeight,width:document.documentElement.scrollWidth,appScroll:document.getElementById('app').scrollTop,overflow:getComputedStyle(deck).overflowY,footer:{top:footer.top,bottom:footer.bottom},world:{top:world.top,bottom:world.bottom}};});
  assert(layout.sh<=layout.ch&&layout.width<=568&&layout.appScroll===0,JSON.stringify({lang,n,layout}));assert.equal(layout.overflow,'auto');assert(layout.footer.top>=0&&layout.footer.bottom<=320.5&&layout.world.top>=0&&layout.world.bottom<=320.5,JSON.stringify({lang,n,layout}));
  const sliders=p.locator('#fieldControls input[type=range]');assert(await sliders.count()>=2);
  for(let i=0;i<await sliders.count();i++){const control=sliders.nth(i),label=JSON.stringify({lang,n,slider:i});
   // Native keyboard focus must scroll the entire regulator into its own panel.
   await control.focus();await assertFieldControlReachable(control,'keyboard '+label);const before=await control.inputValue(),arrow=await control.evaluate(e=>{const increase=Number(e.value)<Number(e.max),rtl=getComputedStyle(e).direction==='rtl';return increase!==rtl?'ArrowRight':'ArrowLeft';});await p.keyboard.press(arrow);assert.notEqual(await control.inputValue(),before,'keyboard changes regulator '+label);assert(await control.evaluate(e=>document.activeElement===e),'keyboard focus retained '+label);
   await resetRange(control,before);await control.click({trial:true});const reached=await assertFieldControlReachable(control,'touch '+label);
   const target=await control.evaluate(e=>{const value=(Number(e.value)-Number(e.min))/(Number(e.max)-Number(e.min)),fraction=value>.5?.2:.8;return getComputedStyle(e).direction==='rtl'?1-fraction:fraction;});await p.touchscreen.tap(reached.rect.left+reached.rect.width*target,reached.rect.top+reached.rect.height/2);assert.notEqual(await control.inputValue(),before,'touch changes regulator '+label);
   const applied=await control.evaluate(e=>{const s=MKTYField.snapshot();return {input:Number(e.value),model:e.dataset.fieldSlider==='valve'?s.valves[Number(e.dataset.index)]:s[e.dataset.fieldSlider]};});assert.equal(applied.model,applied.input,'touch change reaches field state '+label);await resetRange(control,before);
  }
  const scroll=await p.locator('.field-deck').evaluate(e=>({top:e.scrollTop,height:e.clientHeight,total:e.scrollHeight}));assert(scroll.total<=scroll.height||scroll.top>0,'overflowing deck was actually scrolled '+JSON.stringify({lang,n,scroll}));
  assert.equal(await p.evaluate(()=>document.getElementById('app').scrollTop),0,'only the control panel scrolls '+lang+' '+n);
 }
 assert.deepEqual(errors,[]);console.log('lives OK: browser and Telegram paths deduct exactly one life; ch3/ch5 controls are fully reachable by keyboard and touch at 568×320');await browser.close();server.close();
})().catch(e=>{console.error(e);process.exit(1);});
