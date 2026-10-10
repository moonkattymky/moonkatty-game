'use strict';
/* Local-only browser regression: earn closing-gate completion through normal controls,
 * reload its real saved checkpoint, and advance the actual finale callback.
 * Story prerequisites are fixture setup; no completion/checkpoint is forged. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('./pace-hook.cjs');
const ROOT=path.resolve(__dirname,'..'),out=process.env.MKTY_TEST_OUTPUT||fs.mkdtempSync('/tmp/mkty-gate-checkpoints-');
fs.mkdirSync(out,{recursive:true});
let browser,page,origin;const errors=[],report={suite:'gate-checkpoints-ui',physicalDeviceCoverage:false,externalRequests:0};
const server=http.createServer((req,res)=>{
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);}catch{res.writeHead(400);return res.end();}
 const file=path.resolve(ROOT,'.'+(pathname==='/'?'/index.html':pathname));
 if(!['GET','HEAD'].includes(req.method)||!file.startsWith(ROOT+path.sep)||pathname.split('/').some(p=>p.startsWith('.'))||/^\/(server|tests|tools|docs|node_modules)\//.test(pathname)){res.writeHead(403);return res.end();}
 fs.readFile(file,(error,body)=>{res.writeHead(error?404:200,{'Content-Type':({'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json'})[path.extname(file)]||'application/octet-stream'});res.end(error||req.method==='HEAD'?'':body);});
});
(async()=>{
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce',serviceWorkers:'block'});page.setDefaultTimeout(7000);
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>{
  const r=route.request();if(new URL(r.url()).origin===origin&&['GET','HEAD'].includes(r.method()))return route.continue();
  report.externalRequests++;return route.abort('blockedbyclient');
 });
 await page.routeWebSocket('**/*',socket=>socket.close());
 await page.clock.install({time:new Date('2026-10-04T07:59:00Z')});await page.clock.pauseAt(new Date('2026-10-04T08:00:00Z'));
 await page.goto(origin+'/',{waitUntil:'load'});
 let runs=0;
 const actions=[...Array(3).fill('wait'),'launch',...Array(3).fill('wait'),'launch',...Array(7).fill('wait'),'launch'];
 const snapshot=()=>page.evaluate(()=>MKTYField.snapshot());
 for(const reloadCompletion of [false,true]){
  await page.reload({waitUntil:'load'});
  await page.evaluate(()=>{
   setLang('en');
   // Only preceding chapter progress and the first two finale phases are fixtures.
   // The closing gate state and its completion are earned through real controls.
   localStorage.removeItem('mkty_life9');localStorage.removeItem('mkty_spatial_report_9');
   for(let n=1;n<=8;n++)localStorage.removeItem('mkty_story_plan_'+n+'_v1');
   const story=StoryPlan.fresh(9,0,2);story.phase='core';story.done=[0,1,2,3,4,5,6,7];
   localStorage.setItem('mkty_story_plan_9_v1',JSON.stringify(story));
   localStorage.setItem('mkty_field_finale_9_v1',JSON.stringify({version:1,n:9,phase:2,seed:(0-2*7919)>>>0,seconds:0}));
   localStorage.setItem('mkty_legacy_v1',JSON.stringify({version:1,lead:'navigator',events:{}}));
   MKTYSpatialFinale.open(9);
  });
  await page.locator('#fieldResume').click();assert.equal((await snapshot()).stability,70);
  for(const a of actions){
   if(a==='launch')await page.locator('#fieldSubmit').click();
   else await page.locator('#fieldControls [data-field-action="'+a+'"]').click();
  }
  const complete=await snapshot();assert.equal(complete.complete,true);assert.equal(complete.home,3);assert.equal(complete.stability,-1);assert.equal(complete.errors,0);
  assert.deepEqual(await page.evaluate(()=>MKTYSpatialFinale.read(9).checkpoint),complete);
  if(reloadCompletion){
   await page.reload({waitUntil:'load'});await page.evaluate(()=>MKTYSpatialFinale.open(9));
   assert.deepEqual(await snapshot(),complete,'reload preserves the raw earned negative completion');
   assert.deepEqual(await page.evaluate(()=>MKTYSpatialFinale.read(9).checkpoint),complete);
   await page.locator('#fieldResume').click();
  }
  await page.locator('#fieldSubmit').click();
  assert.equal(await page.evaluate(()=>MKTYSpatialFinale.read(9)),null,'Continue finishes the actual finale');
  assert.equal(await page.evaluate(()=>localStorage.getItem('mkty_life9')),'complete');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mkty_spatial_report_9')).phases),3);
  assert.equal(await page.locator('#legacyDialog').isVisible(),true,'actual epilogue opens');
  await page.locator('#legacyOptions [data-legacy-choice]').click();runs++;
 }
 assert.deepEqual(errors,[]);
 Object.assign(report,{runs,completedRawStability:-1,realControlActions:actions.length,reloadAtCompletion:true,actualFinaleContinue:true,epilogueOpened:true,passed:true});
 console.log(JSON.stringify(report));
})().catch(async error=>{report.failure=error.stack;console.error(error);await page?.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(out,'gate-checkpoints-ui.json'),JSON.stringify(report,null,2));await browser?.close();server.close();});
