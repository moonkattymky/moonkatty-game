/* Actual-browser CI regression. Only the local checkout and mocked synthetic
   rewards are used. Do not run where browser/socket execution is unavailable. */
'use strict';
const {chromium}=require('./pace-hook.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..'),golden=require('./fixtures/chapter1-proof.json');
const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://local').pathname.replace(/^\/$/,'/index.html'));fs.readFile(file,(error,body)=>{res.writeHead(error?404:200,{'Content-Type':({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream'});res.end(error?'':body);});});
let browser,p,releasePlayer,reportPlayerHeld,holdPlayer=false,allowCompletion=false,awards=0,resetCount=0;
const errors=[],player={telegram_id:101,moon_points:0,lives:9,story_life:0};
let route={...golden.route,telegram_id:101};
const snapshot=()=>p.evaluate(()=>({plan:localStorage.getItem('mkty_story_plan_1_v1'),route:localStorage.getItem('mkty_proof_route_1'),checkpoint:localStorage.getItem('mkty_campaign_checkpoint_1'),archive:localStorage.getItem('mkty_story_archive_latest_1')}));
(async()=>{
 const {validateProof}=await import('../server/rewards/campaign.mjs');
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 p=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});p.setDefaultTimeout(10000);p.on('pageerror',error=>errors.push(error.message));
 await p.route('**/*',async request=>{
  const url=new URL(request.request().url());
  if(url.hostname==='127.0.0.1')return request.continue();
  if(url.hostname==='telegram.org')return request.fulfill({contentType:'application/javascript',body:''});
  if(url.href!=='https://lswbmgoeinblzuqzakvi.supabase.co/functions/v1/rewards')return request.abort();
  const body=request.request().postDataJSON();let result;
  if(body.action==='session')result={ok:true,session:{token:'synthetic-replay-test',expires_at:Date.now()+3600000}};
  else if(body.action==='player'){if(holdPlayer)await new Promise(resolve=>{releasePlayer=resolve;reportPlayerHeld?.();});result={ok:true,player:{...player}};}
  else if(body.action==='campaign.cloud')result={ok:true,revision:0,snapshot:{}};
  else if(body.action==='campaign.open'){
   // Server-issued challenges (audit 2026-10-17): the client sends no seed; the server picks one.
   if(body.reset){assert.equal(body.seed,undefined);resetCount++;route={life:body.life,seed:golden.route.seed+100+resetCount,edition:2,route:'replay-'+resetCount,telegram_id:101};}
   result={ok:true,route:{...route}};
  }else if(body.action==='life.complete'){
   if(!allowCompletion)result={ok:false,error:'unavailable'};
   else{assert(validateProof(route,body.proof));const awarded=awards===0;if(awarded){awards++;player.moon_points=500;player.story_life=1;}result={ok:true,awarded,player:{...player}};}
  }else result={ok:false,error:'unavailable'};
  return request.fulfill({status:result.ok?200:503,contentType:'application/json',body:JSON.stringify(result)});
 });
 await p.addInitScript(()=>{
  localStorage.setItem('mkty_lang','en');localStorage.setItem('mkty_life1_code_presented','yes');
  window.Telegram={WebApp:{initData:'user='+encodeURIComponent(JSON.stringify({id:101})),initDataUnsafe:{user:{id:101}},ready(){},expand(){}}};
 });
 await p.clock.install({time:new Date('2026-10-09T11:59:00Z')});await p.clock.pauseAt(new Date('2026-10-09T12:00:00Z'));
 await p.goto('http://127.0.0.1:'+server.address().port);await p.waitForFunction(()=>window.MKTYStory&&window.MKTYRewards);
 await p.evaluate(async()=>{await MKTYRewards.syncPlayer();});
 await p.evaluate(async golden=>{
  document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());
  const state=StoryPlan.fresh(1,golden.route.seed,2);state.phase='complete';state.done=golden.proof.tasks.map(task=>task.id);
  state.tasks=Object.fromEntries(golden.proof.tasks.map(task=>[task.id,{attempt:task.attempt,proof:task.state}]));
  localStorage.setItem('mkty_story_plan_1_v1',JSON.stringify(state));localStorage.setItem('mkty_proof_route_1',JSON.stringify({...golden.route,telegram_id:101}));
  localStorage.setItem('mkty_campaign_checkpoint_1','preserve-final-checkpoint');
  const result=await MKTYRewards.completeLife(1,500);if(!result.pending)throw Error('fixture must begin with a pending reward');MKTYStory.menu(1);
 },golden);
 const before=await snapshot();assert.match(await p.locator('#storyReplay').innerText(),/RETRY REWARD SYNC/);
 holdPlayer=true;const playerHeld=new Promise(resolve=>{reportPlayerHeld=resolve;});
 // Repeated real DOM clicks on both chapter replay entry points coalesce.
 await p.evaluate(()=>{const card=document.querySelector('#life1Complete .story-secondary');card.click();card.click();document.getElementById('storyReplay').click();});
 await p.waitForFunction(()=>document.getElementById('storyReplay').disabled);
 let heldTimeout;await Promise.race([playerHeld,new Promise((_,reject)=>{heldTimeout=setTimeout(()=>reject(Error('retry did not reach its synthetic player request')),10000);})]).finally(()=>clearTimeout(heldTimeout));
 assert.equal(resetCount,0);assert.deepEqual(await snapshot(),before);
 assert.equal(typeof releasePlayer,'function','retry reached the held synthetic player request');
 holdPlayer=false;releasePlayer();await p.waitForFunction(()=>!document.getElementById('storyReplay').disabled);
 assert.deepEqual(await snapshot(),before);assert.equal(resetCount,0);
 allowCompletion=true;await p.locator('#storyReplay').click();
 await p.waitForFunction(()=>MKTYRewards.pendingCompletion(1)===false&&!document.getElementById('storyReplay').disabled);
 assert.equal(awards,1);assert.equal(await p.evaluate(()=>localStorage.getItem('mkty_points')),'500');assert.deepEqual(await snapshot(),before);assert.equal(resetCount,0);
 assert.match(await p.locator('#storyReplay').innerText(),/NEW CHAPTER ROUTE/);await p.locator('#storyReplay').click();
 await p.waitForFunction(()=>{const plan=MKTYStory.read(1),receipt=JSON.parse(localStorage.getItem('mkty_proof_route_1'));return plan?.done.length===0&&receipt?.route==='replay-1'&&receipt.seed===plan.seed&&receipt.edition===plan.edition;});
 assert.equal(resetCount,1);assert.equal(awards,1);
 const archived=await p.evaluate(()=>JSON.parse(localStorage.getItem(localStorage.getItem('mkty_story_archive_latest_1'))));
 assert.equal(archived.snapshot.mkty_story_plan_1_v1,before.plan);assert.equal(archived.snapshot.mkty_campaign_checkpoint_1,before.checkpoint);
 const replayed=await snapshot();await p.evaluate(()=>{localStorage.setItem('mkty_pending_v2_101','{unreadable');MKTYStory.menu(1);});
 assert.match(await p.locator('#storySave').innerText(),/queue could not be read/);await p.locator('#storyReplay').click();
 await p.waitForFunction(()=>!document.getElementById('storyReplay').disabled);assert.deepEqual(await snapshot(),replayed);assert.equal(resetCount,1);
 assert.equal(await p.evaluate(()=>localStorage.getItem('mkty_pending_v2_101')),'{unreadable');assert.equal(awards,1);assert.deepEqual(errors,[]);
 console.log('PASS: actual story replay clicks preserve pending proof and route, explicit retry settles once, fresh replay archives/resets, and unreadable queue never resets');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{releasePlayer?.();await browser?.close();await new Promise(resolve=>server.close(resolve));});
