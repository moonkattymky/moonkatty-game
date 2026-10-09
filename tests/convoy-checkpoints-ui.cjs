'use strict';
/* Local-only browser regression: earn convoy power through normal controls,
 * reload its real saved checkpoint, and advance the actual finale callback.
 * Story prerequisites are fixture setup; no completion/checkpoint is forged. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('./pace-hook.cjs');
const ROOT=path.resolve(__dirname,'..'),out=process.env.MKTY_TEST_OUTPUT||fs.mkdtempSync('/tmp/mkty-convoy-checkpoints-');
fs.mkdirSync(out,{recursive:true});
let browser,page,origin;const errors=[],report={suite:'convoy-checkpoints-ui',physicalDeviceCoverage:false,externalRequests:0};
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
 await page.evaluate(()=>{
  setLang('en');
  // Only the earlier story and choices are seeded. All convoy state below is
  // earned through controls and written by the real field/finale controllers.
  const story=StoryPlan.fresh(9,5,2);story.phase='core';story.done=[0,1,2,3,4,5,6,7];
  localStorage.setItem('mkty_story_plan_9_v1',JSON.stringify(story));
  localStorage.setItem('mkty_legacy_v1',JSON.stringify({version:1,lead:'engineer',airlock:'crew',events:{6:'tow',9:'go'}}));
  MKTYSpatialFinale.open(9);
 });
 await page.locator('#fieldResume').click();
 const snapshot=()=>page.evaluate(()=>MKTYField.snapshot());
 const select=i=>page.locator('#fieldControls [data-field-action="select"][data-value="'+i+'"]').click();
 const move=i=>page.locator('#fieldWorld [data-field-cell="'+i+'"]').click();
 const gate=()=>page.locator('#fieldControls [data-field-action="gate"]').click();
 const route=async(ship,nodes)=>{await select(ship);for(const node of nodes)await move(node);};
 const start=await snapshot();assert.equal(start.n,9);assert.equal(start.stage,4);assert.equal(start.mods.cells,2);assert.equal(start.cells,5);
 await route(0,[3,5,7,5,4,6]); // Repeated POWER visit cannot award twice.
 await route(1,[3,5,3,1]);
 await route(2,[4,5]);
 const peak=await snapshot();assert.equal(peak.cells,8);assert.equal(peak.gate,false);assert.equal(peak.errors,0);
 assert.deepEqual(await page.evaluate(()=>MKTYSpatialFinale.read(9).checkpoint),peak,'real controller persisted the eight-cell checkpoint');
 const resumeAfterReload=async expected=>{
  await page.reload({waitUntil:'load'});
  await page.evaluate(()=>MKTYSpatialFinale.open(9));
  assert.deepEqual(await snapshot(),expected,'reload must restore the earned checkpoint instead of silently creating a new mission');
  assert.deepEqual(await page.evaluate(()=>MKTYSpatialFinale.read(9).checkpoint),expected,'opening must not overwrite it with a reset');
  await page.locator('#fieldResume').click();
 };
 await resumeAfterReload(peak);
 await route(0,[4,2]);await route(1,[4,6]);await gate();await gate();
 assert.equal((await snapshot()).cells,7,'the gate charges once');
 await route(1,[8]);await route(0,[4,6,8]);await route(2,[7,8]);
 const complete=await snapshot();assert.equal(complete.complete,true);assert.deepEqual(complete.ships,[8,8,8]);assert.equal(complete.cells,7);assert.equal(complete.errors,0);
 await resumeAfterReload(complete);
 await page.locator('#fieldSubmit').click();
 assert.equal(await page.evaluate(()=>MKTYSpatialFinale.read(9).phase),1,'Continue must advance the real finale session');
 const next=await snapshot();assert.equal(next.n,6,'next phase is return-vessel docking');assert.equal(next.complete,false);
 assert.deepEqual(errors,[]);
 Object.assign(report,{startingBonus:2,peakCells:peak.cells,completedCells:complete.cells,earnedMoves:complete.moves,reloads:2,nextPhase:1,nextMechanic:next.n,passed:true});
 console.log(JSON.stringify(report));
})().catch(async error=>{report.failure=error.stack;console.error(error);await page?.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(out,'convoy-checkpoints-ui.json'),JSON.stringify(report,null,2));await browser?.close();server.close();});
