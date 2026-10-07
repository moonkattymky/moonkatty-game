// One failure = exactly one life, in the browser fallback and the Telegram/server path. Also: ch3/ch5 decks fit 568×320 landscape.
const {chromium}=require('playwright'),assert=require('assert/strict'),fs=require('fs'),path=require('path'),http=require('http');
const root=path.resolve(__dirname,'..'),types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png'};
const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://a').pathname,f=path.join(root,u==='/'?'index.html':u);fs.readFile(f,(e,b)=>{if(e){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream'});res.end(b);});});
(async()=>{await new Promise(r=>server.listen(0,r));const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});const errors=[];
 const page=async()=>{const p=await browser.newPage({viewport:{width:390,height:844}});p.on('pageerror',e=>errors.push(e.message));await p.goto('http://localhost:'+server.address().port+'/');await p.evaluate(()=>{localStorage.clear();localStorage.setItem('mkty_life1','complete');localStorage.setItem('mkty_global_lives','9');});await p.reload();await p.waitForTimeout(400);return p;};
 // Browser fallback (no Telegram initData): local deduction only.
 let p=await page();assert.equal(await p.evaluate(()=>getLifeBank()),9);
 await p.evaluate(()=>MKTYPace.fail(5,'phase','test:a'));await p.waitForTimeout(300);assert.equal(await p.evaluate(()=>getLifeBank()),8,'browser: one failure = one life');
 await p.evaluate(()=>MKTYPace.fail(5,'phase','test:a'));await p.waitForTimeout(300);assert.equal(await p.evaluate(()=>getLifeBank()),8,'duplicate key is free');
 await p.evaluate(()=>MKTYPace.fail(5,'phase','test:b'));await p.waitForTimeout(300);assert.equal(await p.evaluate(()=>getLifeBank()),7);
 assert.deepEqual(await p.evaluate(()=>MKTYRewards.spendLife('x').then(r=>({ok:r.ok,lives:r.lives}))),{ok:true,lives:undefined},'fallback never deducts again');assert.equal(await p.evaluate(()=>getLifeBank()),7);
 // Telegram path: the server is authoritative and also deducts exactly once.
 p=await page();await p.evaluate(()=>{let server=9;MKTYRewards.spendLife=async()=>{server--;return {ok:true,source:'server',lives:server};};});
 await p.evaluate(()=>MKTYPace.fail(6,'phase','tg:a'));await p.waitForTimeout(300);assert.equal(await p.evaluate(()=>getLifeBank()),8,'telegram: one failure = one life');
 await p.evaluate(()=>MKTYPace.fail(6,'phase','tg:b'));await p.waitForTimeout(300);assert.equal(await p.evaluate(()=>getLifeBank()),7);
 // ch3/ch5 at 568×320: no page scroll and every regulator above the action button.
 await p.setViewportSize({width:568,height:320});
 for(const lang of ['ru','de','ar','en'])for(const n of [3,5]){await p.evaluate(({n,lang})=>{setLang(lang);MKTYField.open({chapter:n,id:2,fieldStage:2,seed:901,title:['Проверка','Review'],save:()=>{},complete:()=>{},exit:()=>{}},null);},{n,lang});await p.locator('#fieldResume').click();await p.waitForTimeout(150);
  const r=await p.evaluate(()=>{const m=document.getElementById('fieldMission'),top=document.getElementById('fieldSubmit').getBoundingClientRect().top;return {sh:m.scrollHeight,ch:m.clientHeight,w:document.documentElement.scrollWidth,sliders:[...m.querySelectorAll('input[type=range]')].map(e=>e.getBoundingClientRect().bottom),top};});
  assert(r.sh<=r.ch&&r.w<=568,JSON.stringify({lang,n,r}));assert(r.sliders.length>=2&&r.sliders.every(b=>b<=r.top),JSON.stringify({lang,n,r}));}
 assert.deepEqual(errors,[]);console.log('lives OK: browser and Telegram paths deduct exactly one life; ch3/ch5 fit 568×320');await browser.close();server.close();
})().catch(e=>{console.error(e);process.exit(1);});
