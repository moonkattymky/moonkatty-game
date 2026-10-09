const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.join(__dirname,'..'),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.json':'application/json'};
const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://a').pathname.replace(/^\/$/,'/index.html'));fs.readFile(file,(err,b)=>{res.writeHead(err?404:200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(err?'':b);});});
(async()=>{
 await new Promise(r=>server.listen(0,r));const base='http://localhost:'+server.address().port;
 const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});const p=await b.newPage({viewport:{width:390,height:844}});
 const errors=[];p.on('pageerror',e=>errors.push(String(e)));
 await p.addInitScript(()=>{localStorage.setItem('mkty_lang','ru');window.Telegram={WebApp:{initData:'signed=1',initDataUnsafe:{user:{id:900,first_name:'Игорь'}},ready(){},expand(){},openLink(){},openTelegramLink(){}}};});
 await p.route('https://telegram.org/js/telegram-web-app.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
 const subs=[{id:7,platform:'x',kind:'follow',proof:'@moonfan',code:'MKTY-7F3A',day:'2026-10-07',status:'pending',points:0,created_at:'2026-10-07T09:10:00Z',telegram_id:555,username:'moonfan'},{id:8,platform:'tiktok',kind:'daily',proof:'https://www.tiktok.com/@moonkattymkty/video/7412345678901234567?comment_id=7420000000000000001',code:'MKTY-7F3A',day:'2026-10-07',status:'pending',points:0,created_at:'2026-10-07T09:12:00Z',telegram_id:555,username:'moonfan'}];
 const calls=[];
 await p.route('https://lswbmgoeinblzuqzakvi.supabase.co/functions/v1/**',async r=>{const body=JSON.parse(r.request().postData()||'{}');calls.push(body.action);let out={ok:true};
  const status={ok:true,code:'MKTY-7F3A',channel:'@moonkattymkty',today:'2026-10-07',points:{telegram_follow:5,x_follow:5,x_daily:5,tiktok_follow:5,tiktok_daily:5},telegram:{verified:false},youtube:{oauth_enabled:false},submissions:[{id:3,platform:'x',kind:'follow',proof:'@me',day:'2026-10-07',status:'pending'}],paid:{},player:{moon_points:120}};
  if(body.action==='social.status')out=status;
  else if(body.action==='social.telegram.verify')out={ok:true,verified:false,status:'not_member',awarded:false};
  else if(body.action==='social.submit'){status.submissions.push({id:4,platform:'tiktok',kind:'daily',proof:body.proof,day:'2026-10-07',status:'pending'});out=status;}
  else if(body.action==='admin.social.list')out={ok:true,submissions:subs,points:status.points};
  else if(body.action==='admin.social.review')out={ok:true,reward:{points:5}};
  else if(body.action==='admin.creator.list')out={ok:true,submissions:[],points:{base:250,tier_1k:250,tier_10k:500}};
  else out={ok:false,error:'action'};
  await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(out)});});
 await p.goto(base);
 await p.waitForSelector('#dailyMissions .sv-code strong:text("MKTY-7F3A")');
 const txt=await p.locator('#dailyMissions').innerText();
 assert.match(txt,/ВАШ КОД/);assert.match(txt,/@moonkattymkty/);assert.match(txt,/ПРОВЕРИТЬ ПОДПИСКУ/);assert.ok(!/CLAIM/.test(txt),'no open-and-claim');
 await p.click('[data-tgcheck]');await p.waitForSelector('text=Подписка не найдена');
 await p.fill('[data-sv="tiktok"] form[data-kind="daily"] input','https://www.tiktok.com/@moonkattymkty/video/7412345678901234567?comment_id=1234567');
 await p.click('[data-sv="tiktok"] form[data-kind="daily"] button');await p.waitForSelector('[data-sv="tiktok"] .sv-pending');
 assert.deepEqual(calls.filter(a=>a&&a.startsWith('social.')&&a!=='social.status'),['social.telegram.verify','social.submit']);
 assert.ok(!calls.includes('rewards.verify'));
 const ov=await p.evaluate(()=>document.documentElement.scrollWidth);assert.ok(ov<=390,'overflow '+ov);
 if(process.env.SHOT){await p.locator('#dailyMissions').scrollIntoViewIfNeeded();await p.locator('#dailyMissions').screenshot({path:process.env.SHOT+'/verify-ru.png'});}
 // admin
 await p.goto(base+'/admin.html?tab=social');await p.waitForSelector('text=MKTY-7F3A');
 const at=await p.locator('main').innerText();assert.match(at,/Соцсети/);assert.match(at,/ОДОБРИТЬ|APPROVE/);
 if(process.env.SHOT)await p.screenshot({path:process.env.SHOT+'/admin-social-ru.png',fullPage:true});
 p.once('dialog',d=>d.accept());await p.click('[data-sreview="approve"][data-id="7"]');await p.waitForSelector('text=+5 ⭐ ✓');
 assert.deepEqual(errors,[]);
 await b.close();server.close();console.log('PASS: social UI — code shown, telegram check, tiktok submit, no open-claim, admin «Соцсети» approve');
})().catch(e=>{console.error(e);process.exit(1);});
