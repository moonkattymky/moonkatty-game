/* Isolated browser regression through the real chapter plan and Confirm button.
 * Pacing stays enabled. Prerequisites are fixtures; no external service is called. */
'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..'),out=process.env.MKTY_TEST_OUTPUT||fs.mkdtempSync(path.join(require('node:os').tmpdir(),'mkty-board-lives-'));
fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://local').pathname.replace(/^\/$/,'/index.html'));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(e,body)=>{res.writeHead(e?404:200,{'Content-Type':({'.html':'text/html','.js':'application/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png'})[path.extname(file)]||'application/octet-stream'});res.end(e?'':body);});});
let browser,page;const errors=[];
const click=s=>page.locator(s).click(),lives=()=>page.evaluate(()=>getLifeBank());
const exit=async()=>{await click('#opsMenu');await click('#opsExit');assert.equal(await page.locator('.screen.active').getAttribute('id'),'storyPlan');};
async function plan(chapter,{replay=false}={}){
 await page.evaluate(({chapter,replay})=>{
  show('chapters');for(let n=1;n<chapter;n++)localStorage.setItem('mkty_life'+n,'complete');
  if(replay)localStorage.setItem('mkty_life1','complete');
  const s=StoryPlan.fresh(chapter,409+chapter,2);s.done=[0];localStorage.setItem('mkty_story_plan_'+chapter+'_v1',JSON.stringify(s));MKTYStory.menu(chapter);
 },{chapter,replay});
}
async function enter(){await click('[data-story-step="1"]');if(await page.locator('#paceDialog').isVisible())await click('#paceGo');assert.equal(await page.locator('.screen.active').getAttribute('id'),'operationsDeck');}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 for(const lang of ['en','ru']){
  page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{const url=route.request().url();if(!url.startsWith(origin+'/'))return route.fulfill({status:200,contentType:'application/javascript',body:''});if(/\.mp4(?:\?|$)/.test(url))return route.fulfill({status:204,body:''});return route.continue();});
  await page.addInitScript(lang=>{localStorage.setItem('mkty_lang',lang);localStorage.setItem('mkty_life1_code_presented','yes');localStorage.setItem('mkty_life3_memory_verified','yes');localStorage.setItem('mkty_legacy_v1',JSON.stringify({version:1,lead:'scout',airlock:'crew',events:{1:'scan',3:'shield',4:'north',5:'vent',6:'clear',7:'rescue',9:'wait'}}));},lang);
  await page.goto(origin);await page.waitForFunction(()=>window.MKTYStory&&window.MKTYOps&&window.MKTYPace);assert.equal(await page.evaluate(()=>MKTYPace.bypass()),false);
  await plan(1);assert.match(await page.locator('#storyRisk').innerText(),/9 \/ 9/);assert.equal(await page.locator('#storyRisk').evaluate(e=>e.classList.contains('free')),true);
  await enter();assert.equal(await page.locator('#operationsDeck').getAttribute('data-kind'),'pipes');const before=await page.evaluate(()=>MKTYStory.read(1).tasks[1].checkpoint.input);
  await click('#opsSubmit');assert.equal(await lives(),9,'ordinary tutorial confirm costs no life');assert.deepEqual(await page.evaluate(()=>MKTYStory.read(1).tasks[1].checkpoint.input),before);
  await exit();assert.match(await page.locator('#storyRisk').innerText(),/9 \/ 9/);await page.screenshot({path:path.join(out,'tutorial-'+lang+'.png')});
  await page.reload();await page.waitForFunction(()=>window.MKTYStory&&window.MKTYOps);await page.evaluate(()=>MKTYStory.menu(1));await enter();assert.equal(await page.evaluate(()=>MKTYStory.read(1).tasks[1].checkpoint.errors),1);
  await click('#opsSubmit');assert.equal(await lives(),9,'tutorial retry after reload remains free');assert.equal(await page.evaluate(()=>MKTYStory.read(1).tasks[1].checkpoint.errors),2);await exit();
  for(const chapter of [2,3]){await plan(chapter);await enter();await click('#opsSubmit');assert.equal(await lives(),9,'chapter '+chapter+' simulation is free');await exit();}
  for(const chapter of [4,9]){const before=await lives();await plan(chapter);await enter();await click('#opsSubmit');assert.equal(await lives(),before-1,'ordinary chapter '+chapter+' retains one-life cost');await exit();}
  const beforeReplay=await lives();await plan(1,{replay:true});await enter();await click('#opsSubmit');assert.equal(await lives(),beforeReplay-1,'completed LIFE1 replay retains its existing cost');await exit();
  assert.equal(await page.evaluate(()=>MKTYPace.bypass()),false);await page.close();page=null;
 }
 assert.deepEqual(errors,[]);console.log('PASS: EN/RU real plan→Confirm, free tutorial/reload/training and charged later chapters/LIFE1 replay with pacing enabled');
})().catch(async error=>{console.error(error);await page?.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
