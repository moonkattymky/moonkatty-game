const {chromium}=require('./pace-hook.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..'),shot=process.env.MKTY_BOARD_SHOT||'/tmp/board-ru.png';let browser;
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.json':'application/json'};
const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://a').pathname.replace(/^\/$/,'/index.html'));fs.readFile(file,(err,b)=>{res.writeHead(err?404:200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(err?'':b);});});
(async()=>{await new Promise(r=>server.listen(0,r));browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
 const p=await browser.newPage({viewport:{width:390,height:844}}),errors=[],posts=[];p.on('pageerror',e=>errors.push(String(e)));
 await p.addInitScript(()=>{window.__xss=0;window.Telegram={WebApp:{initData:'signed=1',initDataUnsafe:{user:{id:1,first_name:'Игорь'}},ready(){},expand(){}}};});
 let hidden=false;await p.route('https://telegram.org/js/telegram-web-app.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
 await p.route('**/functions/v1/rewards',r=>r.fulfill({status:503,contentType:'application/json',body:'{"ok":false}'}));
 await p.route('**/functions/v1/mission-control',r=>{const b=r.request().postDataJSON?.()||{};posts.push(b);if(b.action==='privacy')hidden=b.hidden;
  const me={rank:2,callsign:'PILOT-0A1B2C3D',name:hidden?'PILOT-0A1B2C3D':'Игорь Шаргородский',photo:hidden?null:'https://t.me/i/userpic/320/igor.jpg',hidden,points:640,chapters:4,self:true};
  r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,total:5,hidden,updatedAt:'2026-10-07T08:00:00Z',self:me,entries:[
  {rank:1,callsign:'PILOT-11111111',name:'Анна Лунная',photo:'https://cdn4.telesco.pe/file/anna.jpg',hidden:false,points:900,chapters:6,self:false},me,
  {rank:3,callsign:'PILOT-22222222',name:'<img src=x onerror="window.__xss=1">Mallory',photo:'javascript:alert(1)',hidden:false,points:500,chapters:3,self:false},
  {rank:4,callsign:'PILOT-33333333',name:'PILOT-33333333',photo:null,hidden:true,points:300,chapters:2,self:false},
  {rank:5,callsign:'PILOT-44444444',name:'@moon_cat_with_a_really_really_long_username_here',photo:null,hidden:false,points:120,chapters:1,self:false}]})});});
 const png=fs.readFileSync(path.join(root,'art','og-preview-prelaunch.png'));await p.route(/https:\/\/(t\.me|cdn4\.telesco\.pe)\/.*/,r=>r.fulfill({status:200,contentType:'image/png',body:png}));
 await p.goto('http://localhost:'+server.address().port);await p.evaluate(()=>setLang('ru'));
 const board=async()=>{await p.evaluate(()=>MKTYHub.open('ranking'));await p.locator('[data-rank="online"]').click();await p.locator('.hub-standings').waitFor();};
 await board();const text=await p.locator('.hub-standings').innerText();
 assert.match(text,/Анна Лунная/);assert.match(text,/Игорь Шаргородский · ВЫ/);assert.match(text,/<img src=x/);assert.match(text,/PILOT-33333333/);
 assert.equal(await p.evaluate(()=>window.__xss),0);assert.equal(await p.locator('.hub-standings img').count(),2);
 assert.equal(await p.locator('.hub-standings img').first().getAttribute('loading'),'lazy');assert.equal(await p.locator('.hub-ava.anon').count(),1);
 assert.match(await p.locator('#hubBody').innerText(),/именем и фото из Telegram/);
 for(const w of [320,390]){await p.setViewportSize({width:w,height:844});await board();assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),w,'overflow '+w);
  for(const li of await p.locator('.hub-standings li').all()){const b=await li.boundingBox();assert(b.x>=0&&b.x+b.width<=w+0.5,'row overflow '+w);}}
 await p.setViewportSize({width:390,height:844});await board();await p.waitForTimeout(300);await p.screenshot({path:shot,fullPage:true});
 // Settings toggle persists server-side via verified POST.
 await p.evaluate(()=>MKTYHub.open('settings'));const t=p.locator('#hubBoardHide');assert.match(await t.innerText(),/Скрыть меня в рейтинге: ВЫКЛ/);
 await t.click();await p.waitForFunction(()=>document.getElementById('hubBoardHide').getAttribute('aria-pressed')==='true');
 assert.deepEqual(posts.at(-1),{initData:'signed=1',action:'privacy',hidden:true});assert.match(await t.innerText(),/ВКЛ/);
 await board();assert.equal(await p.locator('.hub-standings .self img').count(),0);assert.match(await p.locator('.hub-standings .self').innerText(),/PILOT-0A1B2C3D/);
 await p.evaluate(()=>MKTYHub.open('more'));assert.match(await p.locator('.more-privacy').innerText(),/Скрыть себя можно в Настройках/);
 for(const [lang,re] of [['en',/Hide me in standings/],['de',/Mich in der Rangliste verbergen/],['zh',/在排行榜中隐藏我/]]){await p.evaluate(l=>setLang(l),lang);await p.evaluate(()=>MKTYHub.open('settings'));assert.match(await p.locator('#hubBoardHide').innerText(),re,lang);}
 assert.deepEqual(errors,[]);console.log('PASS: leaderboard names/photos, escaping, unsafe photo dropped, hidden callsign, 320px layout, lazy images, privacy toggle, locales');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
