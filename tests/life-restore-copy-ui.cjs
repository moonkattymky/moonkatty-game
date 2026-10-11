/* Bounded native Chromium presentation regression: 13 locales × two phone widths ×
   four real UI surfaces. No campaign playthroughs, backend, authentication, or real data.
   Run only where local browser/socket use is permitted (CI); screenshots are diagnostics. */
'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os');
const {keys}=require('./life-restore-copy-fixture.json');
const root=path.resolve(__dirname,'..'),out=process.env.MKTY_TEST_OUTPUT||fs.mkdtempSync(path.join(os.tmpdir(),'mkty-life-restore-copy-ui-'));
fs.mkdirSync(out,{recursive:true});
const langs=[['en','English'],['ru','Русский'],['uk','Українська'],['es','Español'],['pt','Português'],['de','Deutsch'],['fr','Français'],['it','Italiano'],['tr','Türkçe'],['he','עברית'],['ar','العربية'],['ko','한국어'],['zh','中文']];
const viewports=[{width:320,height:480},{width:390,height:640}];
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+new URL(req.url,'http://local').pathname.replace(/^\/$/,'/index.html'));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(error,body)=>{res.writeHead(error?404:200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(error?'':body);});
});
const report={cases:[],errors:[],badLocalResponses:[],blockedExternalRequests:[],screenshots:[]};
let browser,context,page,origin,lang,viewport,strings;
const normalize=s=>String(s).replace(/\s+/gu,' ').trim();
const label=surface=>`${lang} ${viewport.width}×${viewport.height} ${surface}`;
// Inspect every actual text fragment, including RTL runs. Scrolling may move only a
// real user-scrollable ancestor; hidden/clip overflow can never be forced open.
async function fragmentState(locator,aim=-1){
 return locator.evaluate((e,aim)=>{
  function rectangles(){const list=[],walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let n;while((n=walker.nextNode())){if(!n.textContent.trim())continue;const range=document.createRange();range.selectNodeContents(n);for(const r of range.getClientRects())if(r.width&&r.height)list.push(r);}return list;}
  if(aim>=0){
   for(let a=e.parentElement;a;a=a.parentElement){
    const style=getComputedStyle(a);
    if(!/^(auto|scroll)$/.test(style.overflowY)||a.scrollHeight<=a.clientHeight)continue;
    const line=rectangles()[aim],box=a.getBoundingClientRect();if(!line)break;
    const top=Math.max(0,box.top+a.clientTop),bottom=Math.min(innerHeight,box.top+a.clientTop+a.clientHeight);
    a.scrollTop+=line.top+line.height/2-(top+bottom)/2;
   }
   const scroller=document.scrollingElement,style=getComputedStyle(scroller);
   if(scroller&&!/hidden|clip/.test(style.overflowY)&&scroller.scrollHeight>innerHeight){const line=rectangles()[aim];if(line)scroller.scrollTop+=line.top+line.height/2-innerHeight/2;}
  }
  const clip={left:0,top:0,right:innerWidth,bottom:innerHeight};
  for(let a=e;a;a=a.parentElement){const style=getComputedStyle(a),r=a.getBoundingClientRect();
   if(/auto|scroll|hidden|clip/.test(style.overflowX)){clip.left=Math.max(clip.left,r.left+a.clientLeft);clip.right=Math.min(clip.right,r.left+a.clientLeft+a.clientWidth);}
   if(/auto|scroll|hidden|clip/.test(style.overflowY)){clip.top=Math.max(clip.top,r.top+a.clientTop);clip.bottom=Math.min(clip.bottom,r.top+a.clientTop+a.clientHeight);}
  }
  const rects=rectangles();
  return {text:e.textContent,fontSize:parseFloat(getComputedStyle(e).fontSize),ellipsis:getComputedStyle(e).textOverflow==='ellipsis',count:rects.length,lines:rects.map((r,i)=>{
   const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
   return {i,horizontal:r.left>=clip.left-1&&r.right<=clip.right+1,visible:r.top>=clip.top-1&&r.bottom<=clip.bottom+1&&(hit===e||e.contains(hit)),top:r.top,bottom:r.bottom};
  })};
 },aim);
}
async function check(surface,selector,index){
 const loc=page.locator(selector);await loc.waitFor({state:'visible'});
 const expected=lang==='en'?keys[index]:strings[keys[index]];
 assert.equal(typeof expected,'string',label(surface)+' has an exact runtime dictionary entry');
 assert.equal(normalize(await loc.textContent()),normalize(expected),label(surface)+' exact paragraph');
 if(lang!=='en')assert.notEqual(normalize(expected),normalize(keys[index]),label(surface)+' no English fallback');
 let state=await fragmentState(loc),seen=new Set();
 assert(state.count>0&&state.count<100,label(surface)+' bounded rendered text');
 assert(!state.ellipsis,label(surface)+' no ellipsis');
 const count=state.count;
 for(let step=0;step<=count&&seen.size<count;step++){
  assert.equal(state.count,count,label(surface)+' scrolling does not remove text');
  for(const line of state.lines){assert(line.horizontal,label(surface)+' horizontal text clipping');if(line.visible)seen.add(line.i);}
  if(seen.size===count)break;
  const next=state.lines.find(line=>!seen.has(line.i));state=await fragmentState(loc,next.i);
 }
 assert.equal(seen.size,count,label(surface)+' every full text fragment is reachable through user-scrollable containers');
 assert.equal(normalize(state.text),normalize(expected),label(surface)+' scrolling preserves the full paragraph');
 report.cases.push({lang,...viewport,surface,fragments:count,fontSize:state.fontSize});
 if(viewport.width===320&&['en','ru','ar','he'].includes(lang)){
  const file=`${lang}-${viewport.width}-${surface}.png`;await page.screenshot({path:path.join(out,file)});report.screenshots.push(file);
 }
}
(async()=>{
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 for(const [code,name] of langs){
  lang=code;viewport=viewports[0];const packRequests=[];
  context=await browser.newContext({viewport,hasTouch:true,reducedMotion:'reduce',serviceWorkers:'block'});page=await context.newPage();page.setDefaultTimeout(10000);
  page.on('pageerror',error=>report.errors.push({lang:code,message:error.message}));
  page.on('response',response=>{if(response.url().startsWith(origin+'/')&&response.status()>=400)report.badLocalResponses.push({lang:code,url:response.url(),status:response.status()});});
  await context.route('**/*',route=>{
   const url=route.request().url();
   if(!url.startsWith(origin+'/')){report.blockedExternalRequests.push({lang:code,url});return route.fulfill({status:200,contentType:route.request().resourceType()==='stylesheet'?'text/css':'application/javascript',body:''});}
   if(/\/locales\/runtime\//.test(url))packRequests.push(new URL(url).pathname);
   if(/\.mp4(?:\?|$)/.test(url))return route.fulfill({status:204,body:''});
   return route.continue();
  });
  await page.addInitScript(()=>{
   // Synthetic guest has completed only the free tutorial; no future-day gate.
   localStorage.setItem('mkty_life1','complete');localStorage.setItem('mkty_life1_awarded','yes');
   localStorage.setItem('mkty_life1_code_presented','yes');localStorage.setItem('mkty_life1_code_remaining_ms','0');
  });
  await page.goto(origin);await page.waitForFunction(()=>window.MKTYLocaleLoader&&window.MKTYI18n&&window.MKTYHub&&window.MKTYPace);
  assert.equal(await page.evaluate(()=>localStorage.getItem('mkty_lang')),null,'fresh guest uses the real language picker');
  assert.equal(await page.evaluate(c=>Boolean(window.MKTYLocales?.[c]),code),false,'pack is not preloaded by the fixture');
  await page.locator('#languages button').filter({hasText:name}).click();
  await page.waitForFunction(c=>MKTYI18n.getLanguage()===c&&(c==='en'||MKTYI18n.hasLocale(c)),code);
  assert.equal(await page.locator('html').getAttribute('dir'),['he','ar'].includes(code)?'rtl':'ltr');
  strings=await page.evaluate(c=>window.MKTYLocales?.[c]?.strings||{},code);
  assert.deepEqual([...new Set(packRequests)],code==='en'?[]:[`/locales/runtime/${code}.js`],'actual loader fetches only the requested pack');
  assert.equal(await page.evaluate(()=>window.Telegram?.WebApp?.initData||''),'','fixture has no authentication');
  for(viewport of viewports){
   await page.setViewportSize(viewport);await page.evaluate(()=>show('home'));
   await page.locator('#rulesBtn').click();await check('rules','#rules .rules-list article:first-child p',2);
   await page.locator('#rulesCloseBtn').click();await page.locator('#home [data-home-nav="more"]').click();
   await page.locator('.more-faq details:first-child summary').click();await check('faq','.more-faq details:first-child p',3);
   // Run the actual zero-life entry guard. Rendering is not replaced by a test stub.
   assert.equal(await page.evaluate(()=>{show('home');localStorage.setItem('mkty_global_lives','0');localStorage.setItem('mkty_life_restore_at',String(Date.now()));return MKTYPace.gate(2);}),false);
   await check('no-lives','#paceDialog #paceText',0);await page.locator('#paceCancel').click();
   await page.evaluate(()=>{localStorage.setItem('mkty_global_lives','8');localStorage.setItem('mkty_life_restore_at',String(Date.now()));localStorage.removeItem('mkty_pace_ack_2');window.lifeRestoreCopyStarted=false;MKTYPace.risky(2,()=>{window.lifeRestoreCopyStarted=true;});});
   await check('risk','#paceDialog #paceText',1);await page.locator('#paceCancel').click();
   assert.equal(await page.evaluate(()=>window.lifeRestoreCopyStarted),false,'cancel does not start a risky mission');
  }
  await context.close();context=null;
 }
 assert.equal(report.cases.length,13*2*4);assert.deepEqual(report.errors,[]);assert.deepEqual(report.badLocalResponses,[]);
 console.log('PASS: 104 actual UI paragraphs, 13 awaited lazy locales at 320/390 widths; no fallback, exact runtime text and every text fragment reachable');
})().catch(async error=>{
 report.failure=String(error?.stack||error);
 if(page&&!page.isClosed())try{await page.screenshot({path:path.join(out,'failure.png')});report.screenshots.push('failure.png');}catch{}
 console.error(error);process.exitCode=1;
}).finally(async()=>{
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
 if(context)await context.close();if(browser)await browser.close();server.close();
});
