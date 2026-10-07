const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),http=require('http');
(async()=>{
 const root=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>{const f=path.join(root,new URL(req.url,'http://x').pathname.replace(/^\/$/,'/index.html'));fs.readFile(f,(e,b)=>{res.writeHead(e?404:200,{'Content-Type':({'.js':'application/javascript','.html':'text/html','.css':'text/css'})[path.extname(f)]||'application/octet-stream'});res.end(e?'':b)});});
 await new Promise(r=>server.listen(0,r));const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 try{
  const p=await browser.newPage({viewport:{width:390,height:844}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.route('https://telegram.org/**',r=>r.fulfill({body:''}));
  await p.addInitScript(()=>{localStorage.setItem('mkty_lang','ru');window.Telegram={WebApp:{initData:'auth_date=123&user=%7B%22id%22%3A101%7D',ready(){},expand(){},initDataUnsafe:{user:{id:101}}}};});
  let mode='online',sessionCount=0,completeCount=0;const player={telegram_id:101,moon_points:0,lives:9,story_life:0};
  await p.route('**/functions/v1/**',async r=>{
   const b=r.request().postDataJSON()||{};let result={ok:true,player:{...player},pace:{next_life:player.story_life+1,locked:false,skips:0}};let status=200;
   if(b.action==='session'){sessionCount++;result.session={token:'test-session',expires_at:Date.now()+43200000};}
   else if(mode==='auth'){status=401;result={ok:false,error:'auth'};}
   else if(mode==='offline'){status=503;result={ok:false,error:'unavailable'};}
   else if(!['player','life.complete','lives.spend'].includes(b.action)){status=503;result={ok:false,error:'unavailable'};}
   else if(b.action==='life.complete'){assert.equal(b.session,'test-session');if(player.story_life<b.life){completeCount++;player.story_life=b.life;player.moon_points+=500;}result.player={...player};result.awarded=true;}
   else if(b.action==='lives.spend'){player.lives--;result.player={...player};result.spent=true;}
   await r.fulfill({status,contentType:'application/json',body:JSON.stringify(result)});
  });
  await p.goto('http://localhost:'+server.address().port);await p.waitForFunction(()=>MKTYRewards.getLastPlayer());
  mode='auth';await p.evaluate(()=>awardLifePoints(1,500));await p.waitForFunction(()=>document.getElementById('rewardSyncStatus')?.textContent.includes('Сессия истекла'));
  assert.equal(await p.evaluate(()=>localStorage.getItem('mkty_points')),'0');assert.equal(await p.evaluate(()=>localStorage.getItem('mkty_life1')),'complete');
  assert.equal(await p.locator('#rewardSyncStatus').isVisible(),true);
  mode='online';await p.evaluate(()=>MKTYRewards.syncPlayer());assert.equal(await p.evaluate(()=>localStorage.getItem('mkty_points')),'500');assert.equal(completeCount,1);
  assert.equal(await p.locator('#rewardSyncStatus').isVisible(),false);
  await p.evaluate(()=>MKTYRewards.completeLife(1,500));assert.equal(completeCount,1);
  mode='offline';await p.evaluate(()=>MKTYRewards.completeLife(2,500));assert.equal(await p.evaluate(()=>localStorage.getItem('mkty_points')),'500');
  const exchangesBeforeReload=sessionCount;mode='online';await p.reload();await p.waitForFunction(()=>MKTYRewards.getLastPlayer()?.story_life===2);assert.equal(await p.evaluate(()=>localStorage.getItem('mkty_points')),'1000');assert.equal(sessionCount,exchangesBeforeReload,'bounded session reused after reload');
  await p.evaluate(()=>MKTYRewards.syncPlayer());assert.equal(completeCount,2);assert.deepEqual(errors,[]);
  console.log('PASS: 401/503 never credit optimistic points, pending banner, retry/reload, idempotency, session reuse');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1)});
