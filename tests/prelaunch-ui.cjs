const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{chromium}=require('playwright');
const root=path.join(__dirname,'..'),out=process.env.MKTY_TEST_OUTPUT||'/tmp/mkty-prelaunch-ui';fs.mkdirSync(out,{recursive:true});
const email='moonkattymky@gmail.com',supportHref='mailto:'+email;
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.webp':'image/webp'};
const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://a').pathname.replace(/^\/$/,'/index.html'));fs.readFile(file,(e,b)=>{res.writeHead(e?404:200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(e?'':b);});});
(async()=>{await new Promise(r=>server.listen(0,r));const base='http://localhost:'+server.address().port,b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});try{
 const p=await b.newPage();const errors=[];p.on('pageerror',e=>errors.push(String(e)));
 for(const size of [{width:320,height:480},{width:390,height:844},{width:1365,height:900}]){await p.setViewportSize(size);for(const file of ['terms.html','privacy.html']){assert.equal((await p.goto(base+'/'+file)).status(),200);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,file+' fits '+size.width);assert.equal(await p.locator('article').count(),2);for(const href of await p.locator('a[href]').evaluateAll(a=>a.map(x=>x.getAttribute('href')))){if(href.startsWith('mailto:'))assert.equal(href,supportHref,'email links are not HTTP page paths and contain no player data');else if(!href.startsWith('http')&&!href.startsWith('#'))assert.equal((await p.request.get(base+'/'+href)).status(),200);}
 for(const article of await p.locator('article').all()){const contacts=article.locator('a[href^="mailto:"]');assert.equal(await contacts.count(),file==='terms.html'?1:2);for(const link of await contacts.all()){assert.equal(await link.innerText(),email);assert.equal(await link.getAttribute('dir'),'ltr');}}
 if(size.width===390)await p.screenshot({path:out+'/'+file+'.png',fullPage:true});}}
 await p.route('https://telegram.org/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
 await p.addInitScript(()=>{if(!localStorage.getItem('mkty_lang'))localStorage.setItem('mkty_lang','ru');});await p.goto(base);await p.waitForFunction(()=>window.MKTYHub&&window.MKTYI18n);await p.evaluate(()=>localStorage.setItem('mkty_support_persistence_test','preserved'));
 for(const lang of ['en','ru','uk','es','pt','de','fr','it','tr','he','ar','ko','zh']){
  await p.evaluate(lang=>setLang(lang),lang);await p.waitForTimeout(200);await p.evaluate(()=>MKTYHub.open('more'));
  assert.equal(await p.locator('#hubBody a[href="terms.html"]').count(),1);assert.equal(await p.locator('#hubBody a[href="privacy.html"]').count(),1);
  const text=await p.locator('#hubBody').innerText();assert(!/MKTY|Solana|Phantom|airdrop/.test(text.replace(/MKTY-XXXX/g,'')),lang+' has no token promotion');
  const label=await p.evaluate(()=>MKTYI18n.t('Support'));
  assert.equal(await p.locator('#hubBody [data-support-link]').innerText(),label);assert.equal(await p.locator('#hubBody [data-support-link]').getAttribute('href'),supportHref);
  const address=p.locator('#hubBody a[dir="ltr"][href^="mailto:"]');assert.equal(await address.innerText(),email);assert.equal(await address.evaluate(a=>getComputedStyle(a).direction),'ltr');
  assert.equal(await p.locator('#missionControl').getAttribute('dir'),['he','ar'].includes(lang)?'rtl':'ltr');
  for(const width of [320,390]){
   await p.setViewportSize({width,height:844});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,lang+' contact screen fits '+width);
   assert.equal(await p.locator('#app').evaluate(a=>a.scrollWidth<=a.clientWidth),true,lang+' app does not conceal horizontal overflow at '+width);
   for(const link of await p.locator('#hubBody a[href^="mailto:"]').all()){
    await link.scrollIntoViewIfNeeded();
    const box=await link.evaluate(a=>{const r=a.getBoundingClientRect();let left=0,right=innerWidth;for(let p=a.parentElement;p;p=p.parentElement){if(/hidden|clip|auto|scroll/.test(getComputedStyle(p).overflowX)){const b=p.getBoundingClientRect();left=Math.max(left,b.left+p.clientLeft);right=Math.min(right,b.left+p.clientLeft+p.clientWidth);}}return {left:r.left,right:r.right,width:r.width,clipLeft:left,clipRight:right};});
    assert(box.width>0&&box.left>=box.clipLeft-.5&&box.right<=box.clipRight+.5,lang+' support contact is not clipped at '+width+': '+JSON.stringify(box));
   }
  }
  // Observe actual link activation without launching an email app or sending a message.
  await p.evaluate(()=>{window.supportClicks=[];document.addEventListener('click',event=>{const link=event.target.closest('a[href^="mailto:"]');if(link){event.preventDefault();window.supportClicks.push(link.getAttribute('href'));}}, {once:true,capture:true});});
  await p.locator('#hubBody [data-support-link]').click();assert.deepEqual(await p.evaluate(()=>window.supportClicks),[supportHref]);assert.equal(await p.locator('.screen.active').getAttribute('id'),'missionControl');
  await p.evaluate(()=>show('rules'));assert.equal(await p.locator('#rules [data-support-link]').innerText(),label);assert.equal(await p.locator('#rules [data-support-link]').getAttribute('href'),supportHref);
  await p.evaluate(()=>MKTYHub.open('more'));assert.equal(await p.locator('#hubBody [data-support-link]').count(),1,'reopening has one support control');
  await p.reload();await p.waitForFunction(lang=>window.MKTYHub&&window.MKTYI18n?.getLanguage()===lang,lang);await p.evaluate(()=>MKTYHub.open('more'));
  assert.equal(await p.locator('#hubBody [data-support-link]').innerText(),label,lang+' support survives saved-language reload');
  assert.equal(await p.evaluate(()=>localStorage.getItem('mkty_support_persistence_test')),'preserved','no data clearing needed');
  if(lang!=='en')assert.equal(await p.locator('script[src*="locales/runtime/'+lang+'.js"]').getAttribute('src'),'locales/runtime/'+lang+'.js?v=20261011-guidance-locales-1','saved preference uses the fresh runtime pack URL');
 }
 for(const file of ['app.js','social.js']){const source=fs.readFileSync(path.join(root,file),'utf8');assert(source.includes('https://www.youtube.com/@moonkattymky'));assert(!source.includes('youtube.com/@moonkattymkty'));}
 const workflow=fs.readFileSync(path.join(root,'.github/workflows/deploy-pages.yml'),'utf8');assert(workflow.includes('|admin.html|'),'admin page excluded from deployed artifact');
 assert.deepEqual(errors,[]);console.log('PASS: legal pages at 3 viewports, working local links, 13-language support links with RTL, narrow layouts, repeated navigation and saved-language reload, More screen without token promotion and corrected social URLs');
 }finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>server.close());
