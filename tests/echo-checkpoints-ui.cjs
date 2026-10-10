'use strict';
/* Local-only browser regression: earn Echo completion through normal controls,
 * reload its real saved checkpoint, and advance the actual finale callback.
 * Story prerequisites are fixture setup; no completion/checkpoint is forged. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('./pace-hook.cjs');
const ROOT=path.resolve(__dirname,'..'),out=process.env.MKTY_TEST_OUTPUT||fs.mkdtempSync('/tmp/mkty-echo-checkpoints-');
fs.mkdirSync(out,{recursive:true});
let browser,page,origin;const errors=[],report={suite:'echo-checkpoints-ui',physicalDeviceCoverage:false,externalRequests:0};
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
 const routes=[
  {seed:0,choice:'silent',noise:102,bands:[0,2,4,1,2,4,1,3,0,2],filters:[7]},
  {seed:0,choice:'answer',noise:105,bands:[4,1,3,0,2,4,2,4,1,2],filters:[]},
  {seed:7,choice:'silent',noise:105,bands:[1,4,2,0,3,1,4,3,1,4,1,4],filters:[]}
 ];
 const snapshot=()=>page.evaluate(()=>MKTYField.snapshot());
 for(const route of routes)for(const bonus of [0,1,2]){
  await page.reload({waitUntil:'load'});
  await page.evaluate(({seed,bonus})=>{
   setLang('en');
   // Seed only prerequisite story progress and the starting session seed. The
   // completion, trace and all receiver state below are earned through controls.
   const story=StoryPlan.fresh(8,seed,2);story.phase='core';story.done=[0,1,2,3,4,5,6,7];
   localStorage.setItem('mkty_story_plan_8_v1',JSON.stringify(story));
   localStorage.setItem('mkty_field_finale_8_v1',JSON.stringify({version:1,n:8,phase:0,seed,seconds:0}));
   localStorage.setItem('mkty_legacy_v1',JSON.stringify({version:1,lead:bonus>0?'scout':'navigator',events:bonus>1?{1:'antenna'}:{}}));
   MKTYSpatialFinale.open(8);
  },{seed:route.seed,bonus});
  await page.locator('#fieldResume').click();assert.equal((await snapshot()).charges,2+bonus);
  const act=(name,value)=>page.locator('#fieldControls [data-field-action="'+name+'"]'+(value===undefined?'':'[data-value="'+value+'"]')).click();
  const resumeAfterReload=async expected=>{
   await page.reload({waitUntil:'load'});await page.evaluate(()=>MKTYSpatialFinale.open(8));
   assert.deepEqual(await snapshot(),expected,'reload must restore the earned checkpoint without silently resetting it');
   assert.deepEqual(await page.evaluate(()=>MKTYSpatialFinale.read(8).checkpoint),expected);
   await page.locator('#fieldResume').click();
  };
  for(const [turn,band]of route.bands.entries()){
   await act('tune',band);if(route.filters.includes(turn))await act('filter');await page.locator('#fieldSubmit').click();
   if((await snapshot()).event){await resumeAfterReload(await snapshot());await act(route.choice);}
  }
  const complete=await snapshot();assert.equal(complete.complete,true);assert.equal(complete.noise,route.noise);assert.equal(complete.fragments,6);
  assert.deepEqual(await page.evaluate(()=>MKTYSpatialFinale.read(8).checkpoint),complete);
  await resumeAfterReload(complete);await page.locator('#fieldSubmit').click();
  assert.equal(await page.evaluate(()=>MKTYSpatialFinale.read(8).phase),1,'Continue advances the actual finale session');
  assert.equal((await snapshot()).n,3,'next phase delivers the probe');
  const legacy=await page.evaluate(()=>MKTYLegacy.read());assert.equal(legacy.echo,route.choice);assert.equal(legacy.decodeNoise,route.noise);runs++;
 }
 assert.deepEqual(errors,[]);
 Object.assign(report,{runs,completedNoise:[102,105],choices:['answer','silent'],campaignBonuses:[0,1,2],reloadAtEchoChoice:true,reloadAtCompletion:true,nextPhase:1,nextMechanic:3,passed:true});
 console.log(JSON.stringify(report));
})().catch(async error=>{report.failure=error.stack;console.error(error);await page?.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(out,'echo-checkpoints-ui.json'),JSON.stringify(report,null,2));await browser?.close();server.close();});
