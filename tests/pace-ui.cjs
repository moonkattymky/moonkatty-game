/* Chapter pacing UI: countdown on chapters + dialog, UTC-midnight unlock, grandfathering, life loss & 0-life gate. */
const {chromium}=require('./pace-hook.cjs'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),http=require('http');
const root=path.resolve(__dirname,'..'),shot=process.env.MKTY_PACE_SHOT||'/tmp/pace-ru.png';
const server=http.createServer((req,res)=>{const name=new URL(req.url,'http://local').pathname,f=path.join(root,name==='/'?'index.html':name);fs.readFile(f,(e,b)=>{res.writeHead(e?404:200,{'Content-Type':({'.html':'text/html','.css':'text/css','.js':'application/javascript'})[path.extname(f)]||'application/octet-stream'});res.end(e?'':b);});});
(async()=>{await new Promise(r=>server.listen(0,r));const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 const errors=[];
 try{
  const p=await browser.newPage({viewport:{width:390,height:844}});p.on('pageerror',e=>errors.push(e.message));await p.route('https://telegram.org/**',r=>r.fulfill({body:''}));
  await p.clock.install({time:new Date('2026-10-10T16:17:00Z')});
  await p.addInitScript(()=>{if(sessionStorage.getItem('pace-fixture'))return;sessionStorage.setItem('pace-fixture','1');localStorage.removeItem('mkty_test_no_pacing');localStorage.setItem('mkty_lang','ru');localStorage.setItem('mkty_life1','complete');localStorage.setItem('mkty_life1_awarded','yes');localStorage.setItem('mkty_life1_code_presented','yes');localStorage.setItem('mkty_life1_code_remaining_ms','0');localStorage.setItem('mkty_points','500');localStorage.setItem('mkty_life1_completed_at',String(Date.parse('2026-10-10T15:00:00Z')));});
  await p.goto('http://localhost:'+server.address().port);
  assert.equal(await p.evaluate(()=>MKTYPace.lockedUntil(2)),Date.parse('2026-10-11T00:00:00Z'),'LIFE #2 opens at next 00:00 UTC');
  assert.equal(await p.evaluate(()=>MKTYPace.lockedUntil(1)),0);
  await p.evaluate(()=>show('chapters'));await p.waitForTimeout(100);
  assert.equal(await p.locator('#paceStrip').isVisible(),true);
  assert.match(await p.locator('#paceStrip').innerText(),/Следующая глава через 07:43/);
  assert.match(await p.locator('#chapterList [data-chapter="2"] small').first().innerText(),/ОТКРОЕТСЯ ЧЕРЕЗ 07:43/);
  await p.locator('#chapterList [data-chapter="2"]').click();
  assert.equal(await p.locator('#paceDialog').isVisible(),true,'countdown dialog');
  assert.equal(await p.locator('#paceClock').innerText(),'07:43');
  assert.match(await p.locator('#paceTitle').innerText(),/Следующая глава через/);
  assert.match(await p.locator('#paceText').innerText(),/ежедневные миссии/);
  assert.equal(await p.evaluate(()=>document.querySelector('.screen.active').id),'chapters','locked chapter did not open');
  await p.screenshot({path:shot});
  // Daily missions shortcut
  await p.locator('#paceGo').click();assert.equal(await p.evaluate(()=>document.querySelector('.screen.active').id),'home');
  // Direct entry points are gated too
  await p.evaluate(()=>openMission2());assert.equal(await p.locator('#paceDialog').isVisible(),true);await p.locator('#paceCancel').click();
  // Midnight UTC: chapter 2 opens
  await p.clock.setSystemTime(new Date('2026-10-11T00:00:05Z'));
  assert.equal(await p.evaluate(()=>MKTYPace.lockedUntil(2)),0);
  assert.equal(await p.evaluate(()=>MKTYPace.gate(2)),true);
  // Grandfathering: completed chapters without timestamps never lock
  assert.equal(await p.evaluate(()=>{localStorage.setItem('mkty_life2','complete');localStorage.setItem('mkty_life3','complete');return MKTYPace.lockedUntil(3)+MKTYPace.lockedUntil(4);}),0);
  // Server pace wins in Telegram
  assert.equal(await p.evaluate(()=>{MKTYPace.setServer({next_life:4,unlock_at:'2026-10-12T00:00:00.000Z',skips:1,locked:true});return MKTYPace.lockedUntil(4);}),Date.parse('2026-10-12T00:00:00Z'));
  await p.evaluate(()=>MKTYPace.open('chapter',4));assert.equal(await p.locator('#paceSkip').isVisible(),true,'referral pass offered');await p.locator('#paceCancel').click();
  await p.evaluate(()=>localStorage.removeItem('mkty_pace_server'));
  // Life loss: tutorial free, failures cost exactly one life (idempotent)
  assert.equal(await p.evaluate(()=>{localStorage.removeItem('mkty_life1');const r=MKTYPace.fail(1,'core','t1');localStorage.setItem('mkty_life1','complete');return r;}),false,'first LIFE #1 is a tutorial');
  assert.equal(await p.evaluate(()=>MKTYPace.fail(4,'training','sim')),false,'training is free');
  assert.equal(await p.evaluate(()=>{MKTYPace.fail(4,'board','b1');MKTYPace.fail(4,'board','b1');return getLifeBank();}),8);
  assert.match(await p.locator('#paceToast').innerText(),/−1 жизнь · осталось 8 \/ 9/);
  // Risk warning shown before the first risky attempt of a chapter
  await p.evaluate(()=>MKTYPace.risky(4,()=>{window.__went=1;}));assert.equal(await p.locator('#paceTitle').innerText(),'Рискованная попытка');await p.locator('#paceGo').click();
  assert.equal(await p.evaluate(()=>window.__went),1);
  // 0 lives: missions blocked until restore
  await p.evaluate(()=>{for(let i=0;i<8;i++)MKTYPace.fail(4,'flight','f'+i);});
  assert.equal(await p.evaluate(()=>getLifeBank()),0);
  assert.equal(await p.evaluate(()=>{localStorage.removeItem('mkty_life4');return MKTYPace.gate(4);}),false);
  assert.match(await p.locator('#paceTitle').innerText(),/Жизни закончились/);
  await p.locator('#paceCancel').click();
  await p.clock.setSystemTime(new Date('2026-10-11T12:00:10Z'));
  assert.equal(await p.evaluate(()=>getLifeBank()),1,'a life restores 12h after it was spent');
  assert.equal(await p.evaluate(()=>MKTYPace.gate(4)),true);
  // Rules + FAQ text, other locale
  assert.match(await p.evaluate(()=>document.querySelector('#rules .rules-list article').innerText),/по одной новой главе в день/);
  await p.evaluate(()=>{localStorage.setItem('mkty_lang','de');});await p.reload();
  assert.match(await p.evaluate(()=>document.querySelector('#rules .rules-list article').innerText),/ein neues Kapitel pro Tag/);
  assert.deepEqual(errors,[]);
  console.log('PASS: pacing UI (countdown, UTC unlock, grandfathering, server pace, referral pass, life loss, 0-life gate, locales)');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
